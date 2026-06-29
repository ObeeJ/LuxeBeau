package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"luxebeau/internal/admin"
	"luxebeau/internal/auth"
	"luxebeau/internal/booking"
	"luxebeau/internal/catalog"
	"luxebeau/internal/domain"
	"luxebeau/internal/escrow"
	"luxebeau/internal/kyc"
	"luxebeau/internal/middleware"
	"luxebeau/internal/order"
	"luxebeau/internal/seed"
	"luxebeau/internal/seller"
)

func main() {
	// ── Logger ──────────────────────────────────────────────
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)
	logger.Info("Starting LuxeBeau API Server")

	// ── Environment ─────────────────────────────────────────
	port := envOrDefault("PORT", "8080")
	dbURL := envOrDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/luxebeau?sslmode=disable")
	
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		logger.Error("FATAL: JWT_SECRET environment variable is not set. Server execution halted.")
		os.Exit(1)
	}

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
		&domain.Wallet{},
		&domain.Product{},
		&domain.Artisan{},
		&domain.BookingSlot{},
		&domain.Booking{},
		&domain.Order{},
		&domain.OrderItem{},
		&domain.Escrow{},
		&domain.LedgerEntry{},
	); err != nil {
		logger.Error("Auto-migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	logger.Info("Database migrations completed")

	// ── Seed catalogue (idempotent) ─────────────────────────
	if err := seed.Run(db, logger); err != nil {
		logger.Error("Catalogue seed failed", slog.Any("error", err))
	}

	// ── Seed Database ───────────────────────────────────────
	seedDatabase(db, logger)

	// ── Dependency Injection Wiring ─────────────────────────
	// Repositories (data access layer)
	userRepo := auth.NewGormUserRepository(db)
	walletRepo := auth.NewGormWalletRepository(db)
	productRepo := catalog.NewGormProductRepository(db)
	bookingRepo := booking.NewGormBookingRepository(db)
	orderRepo := order.NewGormOrderRepository(db)

	// Services (business logic layer)
	authService := auth.NewAuthService(userRepo, walletRepo, jwtSecret, logger)
	catalogService := catalog.NewCatalogService(productRepo, logger)
	bookingService := booking.NewBookingService(bookingRepo, db, logger)
	orderService := order.NewOrderService(orderRepo, productRepo, db, logger)

	// Admin (internal governance) + KYC (identity verification)
	adminRepo := admin.NewGormRepository(db)
	adminService := admin.NewService(adminRepo, logger)
	premblyProvider := kyc.NewPremblyProvider(os.Getenv("PREMBLY_API_KEY"), os.Getenv("PREMBLY_APP_ID"), logger)
	kycService := kyc.NewService(premblyProvider, db, logger)

	// Handlers (HTTP presentation layer)
	authHandler := auth.NewAuthHandler(authService, logger)
	catalogHandler := catalog.NewCatalogHandler(catalogService, logger)
	bookingHandler := booking.NewBookingHandler(bookingService, logger)
	orderHandler := order.NewOrderHandler(orderService, logger)
	adminHandler := admin.NewHandler(adminService, logger)
	kycHandler := kyc.NewHandler(kycService, logger)

	// Seller surface (manage own products + view own sales)
	sellerService := seller.NewService(seller.NewGormRepository(db), logger)
	sellerHandler := seller.NewHandler(sellerService, logger)

	// Escrow engine (held funds; wallet rail live, cNGN stub; WhatsApp notifier)
	escrowRails := escrow.NewRegistry(escrow.NewWalletSettlement(logger), escrow.NewCNGNSettlement(logger))
	escrowNotifier := escrow.NewWhatsAppNotifier(os.Getenv("WHATSAPP_TOKEN"), os.Getenv("WHATSAPP_PHONE_ID"), logger)
	escrowService := escrow.NewService(escrow.NewGormRepository(db), escrowRails, escrowNotifier, logger)
	escrowHandler := escrow.NewHandler(escrowService, logger)

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
		// Auth (Rate Limited to 5 req/sec burst 10 to protect logins/register)
		v1.POST("/auth/register", middleware.RateLimiter(5, 10), authHandler.Register)
		v1.POST("/auth/login", middleware.RateLimiter(5, 10), authHandler.Login)

		// Public Catalog
		v1.GET("/products", catalogHandler.ListProducts)
		v1.GET("/products/:id", catalogHandler.GetProduct)

		// Public Artisans
		v1.GET("/artisans", bookingHandler.ListArtisans)
		v1.GET("/artisans/:id", bookingHandler.GetArtisanProfile)

		// Payment webhooks — no user session, but each is authenticated by
		// verifying the provider signature over the raw body (fail-closed: a
		// missing secret returns 503, never trusts an unsigned payload).
		v1.POST("/webhooks/paystack",
			middleware.RequireHMACSignature(os.Getenv("PAYSTACK_SECRET_KEY"), "x-paystack-signature"),
			orderHandler.PaystackWebhook)
		v1.POST("/webhooks/flutterwave",
			middleware.RequireSharedSecret(os.Getenv("FLUTTERWAVE_SECRET_HASH"), "verif-hash"),
			orderHandler.FlutterwaveWebhook)
		v1.POST("/webhooks/monnify",
			middleware.RequireHMACSignature(os.Getenv("MONNIFY_SECRET"), "monnify-signature"),
			orderHandler.MonnifyWebhook)
		v1.POST("/webhooks/crypto",
			middleware.RequireSharedSecret(os.Getenv("CRYPTO_WEBHOOK_SECRET"), "x-webhook-secret"),
			orderHandler.CryptoWebhook)
	}

	// ── Protected Routes ────────────────────────────────────
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(authService))
	{
		// Auth
		protected.GET("/auth/me", authHandler.Me)

		// Products (seller/admin only — can add middleware later)
		protected.POST("/products", catalogHandler.CreateProduct)

		// Bookings (Rate Limited to 2 req/sec burst 5 to protect scheduler state)
		protected.POST("/bookings", middleware.RateLimiter(2, 5), bookingHandler.CreateBooking)
		protected.PATCH("/bookings/:id/confirm", bookingHandler.ConfirmBooking)

		// Orders
		protected.POST("/orders", orderHandler.CreateOrder)
		protected.GET("/orders/:id", orderHandler.GetOrder)
		protected.GET("/me/orders", orderHandler.ListMyOrders)

		// Bookings (the signed-in user's own bookings, role-aware)
		protected.GET("/me/bookings", bookingHandler.ListMyBookings)

		// Identity verification (NIN/BVN via Prembly)
		protected.POST("/me/kyc", kycHandler.Submit)
		protected.POST("/me/artisan-onboard", bookingHandler.OnboardArtisan)
		protected.POST("/me/seller-onboard", bookingHandler.OnboardSeller)
		protected.GET("/me/artisan", bookingHandler.GetMyArtisanProfile)

		// ── Escrow (held funds + B2B2C escrow links) ─────────
		protected.GET("/escrows", escrowHandler.List)
		protected.POST("/escrows", escrowHandler.Create)
		protected.GET("/escrows/:id", escrowHandler.Get)
		protected.POST("/escrows/:id/fund", escrowHandler.Fund)
		protected.POST("/escrows/:id/release", escrowHandler.Release)
		protected.POST("/escrows/:id/refund", escrowHandler.Refund)
		protected.POST("/escrows/:id/dispute", escrowHandler.Dispute)

		// ── Seller surface (own products + sales) ────────────
		sellerGroup := protected.Group("/me")
		sellerGroup.Use(auth.RequireRole("seller", "admin"))
		{
			sellerGroup.GET("/products", sellerHandler.ListProducts)
			sellerGroup.POST("/products", sellerHandler.CreateProduct)
			sellerGroup.PATCH("/products/:id", sellerHandler.UpdateProduct)
			sellerGroup.DELETE("/products/:id", sellerHandler.DeleteProduct)
			sellerGroup.GET("/sales", sellerHandler.ListSales)
		}

		// ── Admin console (internal only) ────────────────────
		adminGroup := protected.Group("/admin")
		adminGroup.Use(auth.RequireRole("admin"))
		{
			adminGroup.GET("/users", adminHandler.ListUsers)
			adminGroup.GET("/users/:id", adminHandler.GetUser)
			adminGroup.PATCH("/users/:id", adminHandler.UpdateUser)
			adminGroup.POST("/users/:id/verify", adminHandler.VerifyUser)
			adminGroup.DELETE("/users/:id", adminHandler.DeleteUser)
			adminGroup.GET("/products", adminHandler.ListProducts)
			adminGroup.DELETE("/products/:id", adminHandler.DeleteProduct)
			adminGroup.GET("/orders", adminHandler.ListOrders)
			adminGroup.GET("/bookings", adminHandler.ListBookings)
			adminGroup.GET("/escrows", escrowHandler.AdminList)
			adminGroup.POST("/escrows/:id/resolve", escrowHandler.AdminResolve)
		}

		// Wallets
		protected.GET("/wallets/me", authHandler.GetWallet)
		protected.POST("/wallets/credit", authHandler.CreditWallet)
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
