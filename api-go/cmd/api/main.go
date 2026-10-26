package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

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
	"luxebeau/internal/mail"
	"luxebeau/internal/media"
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
	if len(jwtSecret) < 32 {
		logger.Error("FATAL: JWT_SECRET must be set to at least 32 random bytes. Server execution halted.")
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
		&domain.EmailOTP{},
		&domain.RefreshToken{},
	); err != nil {
		logger.Error("Auto-migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	logger.Info("Database migrations completed")

	// ── Seed catalogue (idempotent) ─────────────────────────
	if err := seed.Run(db, logger); err != nil {
		logger.Error("Catalogue seed failed", slog.Any("error", err))
	}
	// Databases seeded before demo passwords became configurable still carry
	// the old shared password on the demo accounts; replace it.
	if err := seed.RetireDefaultPassword(db, logger); err != nil {
		logger.Error("Demo password rotation failed", slog.Any("error", err))
	}

	// ── Dependency Injection Wiring ─────────────────────────
	// Repositories (data access layer)
	userRepo := auth.NewGormUserRepository(db)
	walletRepo := auth.NewGormWalletRepository(db)
	productRepo := catalog.NewGormProductRepository(db)
	bookingRepo := booking.NewGormBookingRepository(db)
	orderRepo := order.NewGormOrderRepository(db)

	// Email (Cloudflare Email Service over SMTP in production)
	smtpPort, _ := strconv.Atoi(envOrDefault("SMTP_PORT", "465"))
	mailer := mail.New(mail.Config{
		From:         os.Getenv("EMAIL_FROM"),
		AppURL:       envOrDefault("APP_URL", "http://localhost:3000"),
		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     smtpPort,
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		DevDir:       os.Getenv("MAIL_DEV_DIR"),
	}, logger)

	// Product and artisan photos (Cloudflare Images direct uploads)
	images := media.New(media.Config{
		AccountID:   os.Getenv("CF_ACCOUNT_ID"),
		APIToken:    os.Getenv("CF_IMAGES_API_TOKEN"),
		AccountHash: os.Getenv("CF_IMAGES_ACCOUNT_HASH"),
		Variant:     os.Getenv("CF_IMAGES_VARIANT"),
	})

	// Services (business logic layer)
	authService := auth.NewService(db, userRepo, walletRepo, mailer, auth.Config{
		JWTSecret:      jwtSecret,
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
	}, logger)
	catalogService := catalog.NewCatalogService(productRepo, logger)
	bookingService := booking.NewBookingService(bookingRepo, db, logger)
	orderService := order.NewOrderService(orderRepo, productRepo, db, logger)

	// Admin (internal governance) + KYC (identity verification)
	adminRepo := admin.NewGormRepository(db)
	adminService := admin.NewService(adminRepo, logger)
	premblyProvider := kyc.NewPremblyProvider(os.Getenv("PREMBLY_API_KEY"), os.Getenv("PREMBLY_APP_ID"), logger)
	kycService := kyc.NewService(premblyProvider, db, logger)

	// Handlers (HTTP presentation layer)
	authHandler := auth.NewAuthHandler(authService, auth.CookieConfig{
		Domain: os.Getenv("COOKIE_DOMAIN"),
		Secure: os.Getenv("COOKIE_SECURE") != "false",
	}, logger)
	catalogHandler := catalog.NewCatalogHandler(catalogService, logger)
	bookingHandler := booking.NewBookingHandler(bookingService, mailer, images, logger)
	studio := booking.NewStudio(db, logger)
	orderHandler := order.NewOrderHandler(orderService, logger).WithMailer(mailer)
	adminHandler := admin.NewHandler(adminService, mailer, logger)
	kycHandler := kyc.NewHandler(kycService, logger)

	// Seller surface (manage own products + view own sales)
	sellerService := seller.NewService(seller.NewGormRepository(db), logger)
	sellerHandler := seller.NewHandler(sellerService, images, mailer, logger)

	// Escrow engine (held funds; wallet rail live, cNGN stub; WhatsApp notifier)
	escrowRails := escrow.NewRegistry(escrow.NewWalletSettlement(logger), escrow.NewCNGNSettlement(logger))
	escrowNotifier := escrow.NewWhatsAppNotifier(os.Getenv("WHATSAPP_TOKEN"), os.Getenv("WHATSAPP_PHONE_ID"), logger)
	escrowService := escrow.NewService(escrow.NewGormRepository(db), escrowRails, escrowNotifier, logger)
	escrowHandler := escrow.NewHandler(escrowService, logger)

	// ── Router ──────────────────────────────────────────────
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	// Client IPs drive rate limits, so only trust forwarding headers from a
	// known platform or proxy list; by default trust none.
	if os.Getenv("TRUSTED_PLATFORM") == "cloudflare" {
		r.TrustedPlatform = gin.PlatformCloudflare
	}
	if err := r.SetTrustedProxies(splitList(os.Getenv("TRUSTED_PROXIES"))); err != nil {
		logger.Error("invalid TRUSTED_PROXIES", slog.Any("error", err))
		os.Exit(1)
	}
	r.Use(middleware.Logger(logger))
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.CORS(splitList(envOrDefault("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"))))

	// ── Health Check ────────────────────────────────────────
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "luxebeau-api"})
	})

	// ── Payment webhooks ────────────────────────────────────
	// No user session and no CSRF header: each is authenticated by verifying
	// the provider signature over the raw body (fail-closed: a missing secret
	// returns 503, never trusts an unsigned payload).
	hooks := r.Group("/api/v1/webhooks")
	{
		hooks.POST("/paystack",
			middleware.RequireHMACSignature(os.Getenv("PAYSTACK_SECRET_KEY"), "x-paystack-signature"),
			orderHandler.PaystackWebhook)
		hooks.POST("/flutterwave",
			middleware.RequireSharedSecret(os.Getenv("FLUTTERWAVE_SECRET_HASH"), "verif-hash"),
			orderHandler.FlutterwaveWebhook)
		hooks.POST("/monnify",
			middleware.RequireHMACSignature(os.Getenv("MONNIFY_SECRET"), "monnify-signature"),
			orderHandler.MonnifyWebhook)
		hooks.POST("/crypto",
			middleware.RequireSharedSecret(os.Getenv("CRYPTO_WEBHOOK_SECRET"), "x-webhook-secret"),
			orderHandler.CryptoWebhook)
	}

	// ── Public Routes ───────────────────────────────────────
	v1 := r.Group("/api/v1", middleware.CSRF())
	{
		// Auth (rate limited per client IP)
		authLimit := middleware.RateLimiter(1, 5)
		v1.POST("/auth/register", authLimit, authHandler.Register)
		v1.POST("/auth/verify-email", authLimit, authHandler.VerifyEmail)
		v1.POST("/auth/resend-code", authLimit, authHandler.ResendCode)
		v1.POST("/auth/login", authLimit, authHandler.Login)
		v1.POST("/auth/google", authLimit, authHandler.Google)
		v1.POST("/auth/verify-login", authLimit, authHandler.VerifyLogin)
		v1.POST("/auth/refresh", middleware.RateLimiter(2, 10), authHandler.Refresh)
		v1.POST("/auth/logout", authHandler.Logout)

		// Public Catalog
		v1.GET("/products", catalogHandler.ListProducts)
		v1.GET("/products/:id", catalogHandler.GetProduct)

		// Public Artisans
		v1.GET("/artisans", bookingHandler.ListArtisans)
		v1.GET("/artisans/:id", bookingHandler.GetArtisanProfile)
		v1.GET("/artisans/:id/availability", middleware.RateLimiter(5, 20), bookingHandler.Availability)
	}

	// ── Protected Routes ────────────────────────────────────
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(authService))
	{
		// Auth
		protected.GET("/auth/me", authHandler.Me)

		// Products (seller/admin only — can add middleware later)
		protected.POST("/products", auth.RequireRole("admin"), catalogHandler.CreateProduct)

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

		// Artisan studio: services, opening hours and one-off slots
		artisanGroup := protected.Group("/me/artisan")
		artisanGroup.Use(auth.RequireRole("artisan"))
		{
			artisanGroup.PUT("/services", studio.PutServices)
			artisanGroup.GET("/schedule", studio.GetScheduleHandler)
			artisanGroup.PUT("/schedule", studio.PutSchedule)
			artisanGroup.GET("/slots", studio.GetSlots)
			artisanGroup.POST("/slots", studio.PostSlot)
			artisanGroup.DELETE("/slots/:id", studio.DeleteSlot)
		}

		// Photo uploads (direct to Cloudflare Images) for partners
		protected.POST("/me/uploads/image", auth.RequireRole("seller", "artisan", "admin"), middleware.RateLimiter(1, 10), images.UploadHandler(logger))

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
			sellerGroup.PATCH("/sales/:orderId", sellerHandler.Fulfil)
		}

		// ── Admin console (internal only) ────────────────────
		adminGroup := protected.Group("/admin")
		adminGroup.Use(auth.RequireRole("admin"))
		{
			adminGroup.GET("/applications", adminHandler.ListApplications)
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
	}

	// ── Start Server ────────────────────────────────────────
	addr := fmt.Sprintf(":%s", port)
	logger.Info("LuxeBeau API listening", slog.String("addr", addr))
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		logger.Error("Server failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func splitList(v string) []string {
	var out []string
	for _, item := range strings.Split(v, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

func envOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
