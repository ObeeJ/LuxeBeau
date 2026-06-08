package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"luxebeau/internal/auth"
	"luxebeau/internal/booking"
	"luxebeau/internal/catalog"
	"luxebeau/internal/domain"
	"luxebeau/internal/middleware"
	"luxebeau/internal/order"
)

func main() {
	// ── Logger ──────────────────────────────────────────────
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)
	logger.Info("Starting LuxeBeau API Server")

	// ── Environment ─────────────────────────────────────────
	port := envOrDefault("PORT", "8080")
	dbURL := envOrDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/luxebeau?sslmode=disable")
	jwtSecret := envOrDefault("JWT_SECRET", "luxebeau-dev-secret-change-in-prod")

	// ── Database (GORM + Supabase PostgreSQL) ───────────────
	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		logger.Error("Failed to connect to database", slog.Any("error", err))
		os.Exit(1)
	}

	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(50)

	logger.Info("Connected to PostgreSQL")

	// ── Auto-Migrate ────────────────────────────────────────
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Product{},
		&domain.Artisan{},
		&domain.BookingSlot{},
		&domain.Booking{},
		&domain.Order{},
		&domain.OrderItem{},
	); err != nil {
		logger.Error("Auto-migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	logger.Info("Database migrations completed")

	// ── Dependency Injection Wiring ─────────────────────────
	// Repositories (data access layer)
	userRepo := auth.NewGormUserRepository(db)
	productRepo := catalog.NewGormProductRepository(db)
	bookingRepo := booking.NewGormBookingRepository(db)
	orderRepo := order.NewGormOrderRepository(db)

	// Services (business logic layer)
	authService := auth.NewAuthService(userRepo, jwtSecret, logger)
	catalogService := catalog.NewCatalogService(productRepo, logger)
	bookingService := booking.NewBookingService(bookingRepo, logger)
	orderService := order.NewOrderService(orderRepo, productRepo, db, logger)

	// Handlers (HTTP presentation layer)
	authHandler := auth.NewAuthHandler(authService, logger)
	catalogHandler := catalog.NewCatalogHandler(catalogService, logger)
	bookingHandler := booking.NewBookingHandler(bookingService, logger)
	orderHandler := order.NewOrderHandler(orderService, logger)

	// ── Router ──────────────────────────────────────────────
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Logger(logger))
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.CORS())

	// ── Health Check ────────────────────────────────────────
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "luxebeau-api"})
	})

	// ── Public Routes ───────────────────────────────────────
	v1 := r.Group("/api/v1")
	{
		// Auth
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)

		// Public Catalog
		v1.GET("/products", catalogHandler.ListProducts)
		v1.GET("/products/:id", catalogHandler.GetProduct)

		// Public Artisans
		v1.GET("/artisans", bookingHandler.ListArtisans)
		v1.GET("/artisans/:id", bookingHandler.GetArtisanProfile)

		// Paystack Webhook (no auth)
		v1.POST("/webhooks/paystack", orderHandler.PaystackWebhook)
	}

	// ── Protected Routes ────────────────────────────────────
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(authService))
	{
		// Auth
		protected.GET("/auth/me", authHandler.Me)

		// Products (seller/admin only — can add middleware later)
		protected.POST("/products", catalogHandler.CreateProduct)

		// Bookings
		protected.POST("/bookings", bookingHandler.CreateBooking)
		protected.PATCH("/bookings/:id/confirm", bookingHandler.ConfirmBooking)

		// Orders
		protected.POST("/orders", orderHandler.CreateOrder)
		protected.GET("/orders/:id", orderHandler.GetOrder)
	}

	// ── Start Server ────────────────────────────────────────
	addr := fmt.Sprintf(":%s", port)
	logger.Info("LuxeBeau API listening", slog.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Error("Server failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func envOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
