package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
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
	"luxebeau/internal/influencer"
	"luxebeau/internal/jobs"
	"luxebeau/internal/kyc"
	"luxebeau/internal/mail"
	"luxebeau/internal/media"
	"luxebeau/internal/messaging"
	"luxebeau/internal/middleware"
	"luxebeau/internal/order"
	"luxebeau/internal/promotion"
	"luxebeau/internal/revenue"
	"luxebeau/internal/review"
	"luxebeau/internal/seed"
	"luxebeau/internal/seller"
	"luxebeau/internal/social"
	"luxebeau/internal/storefront"
	"luxebeau/internal/withdrawal"
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
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dbURL,
		PreferSimpleProtocol: true, // disables prepared statement caching to support Supabase PgBouncer transaction pooling
	}), &gorm.Config{
		PrepareStmt: false,
	})
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
		&domain.Withdrawal{},
		&domain.DeliveryZone{},
		&domain.InfluencerPackage{},
		&domain.InfluencerReferral{},
		&domain.InfluencerCommission{},
		&domain.Storefront{},
		&domain.ReservedHandle{},
		&domain.StorefrontHandleHistory{},
		&domain.FeaturedAd{},
		&domain.Review{},
		&domain.IdempotencyRecord{},
		&domain.UserProfile{},
		&domain.Conversation{},
		&domain.Message{},
	); err != nil {
		logger.Error("Auto-migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	logger.Info("Database migrations completed")
	if err := escrow.EnsureLedgerGuards(db); err != nil {
		logger.Error("Ledger guards failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Seed catalogue (idempotent) ─────────────────────────
	if err := seed.Run(db, logger); err != nil {
		logger.Error("Catalogue seed failed", slog.Any("error", err))
	}
	// Databases seeded before demo passwords became configurable still carry
	// the old shared password on the demo accounts; replace it.
	if err := seed.RetireDefaultPassword(db, logger); err != nil {
		logger.Error("Demo password rotation failed", slog.Any("error", err))
	}
	// Ensure the platform wallet row exists so escrow fee credits never fail.
	if err := seed.SeedPlatformWallet(db, logger); err != nil {
		logger.Error("Platform wallet seed failed", slog.Any("error", err))
		os.Exit(1)
	}
	// Seed featured ads spotlight if empty
	if err := seed.SeedFeaturedAds(db, logger); err != nil {
		logger.Warn("Featured ads seed failed", slog.Any("error", err))
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
		From:                 os.Getenv("EMAIL_FROM"),
		AppURL:               envOrDefault("APP_URL", "http://localhost:3000"),
		SMTPHost:             os.Getenv("SMTP_HOST"),
		SMTPPort:             smtpPort,
		SMTPUsername:         os.Getenv("SMTP_USERNAME"),
		SMTPPassword:         os.Getenv("SMTP_PASSWORD"),
		CloudflareAccountID:  os.Getenv("CF_ACCOUNT_ID"),
		CloudflareEmailToken: os.Getenv("CF_EMAIL_API_TOKEN"),
		RelayURL:             os.Getenv("MAIL_RELAY_URL"),
		RelaySecret:          os.Getenv("MAIL_RELAY_SECRET"),

		BrevoAPIKey: os.Getenv("BREVO_API_KEY"),
		DevDir:      os.Getenv("MAIL_DEV_DIR"),
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
	smileProvider := kyc.NewSmileProvider(os.Getenv("SMILE_API_KEY"), os.Getenv("SMILE_PARTNER_ID"), logger)
	stripeProvider := kyc.NewStripeProvider(os.Getenv("STRIPE_SECRET_KEY"), logger)
	manualProvider := kyc.NewManualProvider(logger)
	kycRouter := kyc.NewProviderRouter(premblyProvider, smileProvider, stripeProvider, manualProvider)
	kycService := kyc.NewService(kycRouter, db, logger)

	// Handlers (HTTP presentation layer)
	authHandler := auth.NewAuthHandler(authService, auth.CookieConfig{
		Domain: os.Getenv("COOKIE_DOMAIN"),
		Secure: os.Getenv("COOKIE_SECURE") != "false",
	}, logger)
	catalogHandler := catalog.NewCatalogHandler(catalogService, logger)
	bookingHandler := booking.NewBookingHandler(bookingService, mailer, images, logger)
	studio := booking.NewStudio(db, logger)
	orderHandler := order.NewOrderHandler(orderService, db, logger).WithMailer(mailer)
	adminHandler := admin.NewHandler(adminService, mailer, logger)
	kycHandler := kyc.NewHandler(kycService, logger)

	// Seller surface (manage own products + view own sales)
	sellerService := seller.NewService(seller.NewGormRepository(db), logger)
	sellerHandler := seller.NewHandler(sellerService, images, mailer, logger)

	// Escrow engine (held funds; wallet rail live, cNGN stub; WhatsApp notifier)
	escrowRails := escrow.NewRegistry(escrow.NewWalletSettlement(logger), escrow.NewHeldSettlement(), escrow.NewCNGNSettlement(logger))
	escrowNotifier := escrow.NewWhatsAppNotifier(os.Getenv("WHATSAPP_TOKEN"), os.Getenv("WHATSAPP_PHONE_ID"), logger)
	escrowService := escrow.NewService(escrow.NewGormRepository(db), escrowRails, escrowNotifier, logger)
	escrowHandler := escrow.NewHandler(escrowService, logger)

	// Storefront engine
	storefrontRepo := storefront.NewGormStorefrontRepository(db)
	storefrontService := storefront.NewService(storefrontRepo, db, logger)
	storefrontHandler := storefront.NewHandler(storefrontService, authService, logger)

	// Seed default reserved handles
	reservedList := make([]domain.ReservedHandle, 0, len(storefront.DefaultReservedHandles))
	for _, h := range storefront.DefaultReservedHandles {
		reservedList = append(reservedList, domain.ReservedHandle{
			Handle: h,
			Reason: "system",
		})
	}
	if err := storefrontRepo.SeedReservedHandles(context.Background(), reservedList); err != nil {
		logger.Warn("Failed to seed reserved handles", slog.Any("error", err))
	}

	// Influencer referral packages
	influencerService := influencer.NewService(db, logger)
	influencerHandler := influencer.NewHandler(influencerService, logger)

	// Social profiles
	socialHandler := social.NewHandler(social.NewService(db).WithAvatarValidator(images.ValidURL), logger)

	// Messaging (async + SSE realtime)
	messagingService := messaging.NewService(db)
	messagingHandler := messaging.NewHandler(messagingService, logger)

	// Partner bank withdrawals
	withdrawalService := withdrawal.NewService(db, os.Getenv("PAYSTACK_SECRET_KEY"), logger)
	withdrawalHandler := withdrawal.NewHandler(withdrawalService, logger)
	// Paystack reports bank payout results (transfer.success / failed / reversed)
	// on the same webhook as card payments; route them to the withdrawal service.
	orderHandler.WithTransferHandler(withdrawalService)

	// Paid ads & featured promotions
	promotionRepo := promotion.NewGormRepository(db)
	promotionService := promotion.NewServiceWithDB(promotionRepo, db, logger)
	// A Paystack payment whose reference is not an order is an ad payment.
	orderHandler.WithFallbackConfirmer(promotionService)
	promotionHandler := promotion.NewHandler(promotionService, logger)

	// ── Router ──────────────────────────────────────────────
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Struct-based rate limiter: cleanup goroutine respects SIGTERM.
	rateLimiter := middleware.NewIPRateLimiter(ctx)
	reviewHandler := review.NewHandler(review.NewService(db, logger), logger)

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
	// After CORS so a browser can still read the 413 message.
	r.Use(middleware.BodyLimit(middleware.DefaultBodyLimit))

	// ── Health Check ────────────────────────────────────────
	healthzHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "luxebeau-api"})
	}
	r.GET("/healthz", healthzHandler)
	r.HEAD("/healthz", func(c *gin.Context) { c.Status(200) })

	// Readiness: proves the database answers. /healthz only proves the process
	// is up. Point load balancers and keep-awake pings that must also keep the
	// database active (Supabase pauses idle free projects) at this one.
	readyzHandler := func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err == nil {
			pingCtx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
			defer cancel()
			err = sqlDB.PingContext(pingCtx)
		}
		if err != nil {
			logger.Error("readiness check failed", slog.Any("error", err))
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "service": "luxebeau-api"})
			return
		}
		c.JSON(200, gin.H{"status": "ready", "service": "luxebeau-api"})
	}
	r.GET("/readyz", readyzHandler)
	r.HEAD("/readyz", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err == nil {
			pingCtx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
			defer cancel()
			err = sqlDB.PingContext(pingCtx)
		}
		if err != nil {
			c.Status(http.StatusServiceUnavailable)
			return
		}
		c.Status(200)
	})
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "luxebeau-api", "health": "/healthz"})
	})
	r.HEAD("/", func(c *gin.Context) {
		c.Status(200)
	})

	// ── Payment webhooks ────────────────────────────────────
	// No user session and no CSRF header: each is authenticated by verifying
	// the provider signature over the raw body (fail-closed: a missing secret
	// returns 503, never trusts an unsigned payload).
	hooks := r.Group("/api/v1/webhooks")
	{
		hooks.POST("/paystack",
			middleware.RequireHMACSignatureAny("x-paystack-signature",
				os.Getenv("PAYSTACK_WEBHOOK_SECRET"),
				os.Getenv("PAYSTACK_SECRET_KEY"),
			),
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
		authLimit := rateLimiter.RateLimit(1, 5)
		v1.POST("/auth/register", authLimit, authHandler.Register)
		v1.POST("/auth/verify-email", authLimit, authHandler.VerifyEmail)
		v1.POST("/auth/resend-code", authLimit, authHandler.ResendCode)
		v1.POST("/auth/login", authLimit, authHandler.Login)
		v1.POST("/auth/forgot-password", authLimit, authHandler.ForgotPassword)
		v1.POST("/auth/reset-password", authLimit, authHandler.ResetPassword)
		v1.POST("/auth/google", authLimit, authHandler.Google)
		v1.POST("/auth/verify-login", authLimit, authHandler.VerifyLogin)
		v1.POST("/auth/refresh", rateLimiter.RateLimit(2, 10), authHandler.Refresh)
		v1.POST("/auth/logout", authHandler.Logout)

		// Public Catalog
		v1.GET("/products", catalogHandler.ListProducts)
		v1.GET("/products/:id", catalogHandler.GetProduct)

		// Public Artisans
		v1.GET("/artisans", bookingHandler.ListArtisans)
		v1.GET("/artisans/:id", bookingHandler.GetArtisanProfile)
		v1.GET("/artisans/:id/availability", rateLimiter.RateLimit(5, 20), bookingHandler.Availability)

		// Public profiles
		v1.GET("/profiles/:handle", socialHandler.GetPublicProfile)

		// Public reviews (visible ones only)
		v1.GET("/reviews", reviewHandler.List)

		// Public Storefronts
		v1.GET("/storefronts/:handle", storefrontHandler.GetPublicStorefront)
		v1.POST("/storefronts/check-handle", storefrontHandler.CheckHandle)
		v1.POST("/storefronts/theme-preview", storefrontHandler.ThemePreview)

		// Featured Ads & Sponsored Spotlights
		v1.GET("/featured-ads/active", promotionHandler.ListActive)
		v1.GET("/featured-ads/pricing", promotionHandler.PricingInfo)
		v1.POST("/featured-ads/:id/click", promotionHandler.RecordClick)
	}

	// ── Protected Routes ────────────────────────────────────
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(authService))
	{
		// Auth
		protected.GET("/auth/me", authHandler.Me)
		protected.PATCH("/me/profile", authHandler.UpdateProfile)

		// Bookings (Rate Limited to 2 req/sec burst 5 to protect scheduler state)
		protected.POST("/bookings", rateLimiter.RateLimit(2, 5), bookingHandler.CreateBooking)
		protected.PATCH("/bookings/:id/confirm", bookingHandler.ConfirmBooking)
		protected.POST("/bookings/:id/cancel", rateLimiter.RateLimit(2, 10), bookingHandler.CancelBooking)
		protected.PATCH("/bookings/:id/complete", auth.RequireRole("artisan", "admin"), bookingHandler.CompleteBooking)
		protected.PATCH("/bookings/:id/no-show", auth.RequireRole("artisan", "admin"), bookingHandler.MarkNoShow)

		// Orders
		protected.POST("/orders", orderHandler.CreateOrder)
		// A quote does a database lookup per bag item, so it is rate limited.
		protected.POST("/orders/quote", rateLimiter.RateLimit(5, 20), orderHandler.QuoteOrder)
		protected.GET("/orders/:id", orderHandler.GetOrder)
		protected.POST("/orders/:id/verify", orderHandler.VerifyPayment)
		protected.GET("/me/orders", orderHandler.ListMyOrders)

		// Bookings (the signed-in user's own bookings, role-aware)
		protected.GET("/me/bookings", bookingHandler.ListMyBookings)

		// Reviews: only for what the buyer really received or had completed
		protected.POST("/reviews", rateLimiter.RateLimit(1, 5), reviewHandler.Create)
		protected.GET("/me/reviewable", reviewHandler.Reviewable)

		// Social profiles
		protected.GET("/me/profile/social", socialHandler.GetMyProfile)
		protected.PATCH("/me/profile/social", socialHandler.UpdateMyProfile)

		// Messaging
		protected.GET("/me/conversations", messagingHandler.ListConversations)
		protected.POST("/me/messages", rateLimiter.RateLimit(2, 10), messagingHandler.Send)
		protected.GET("/me/conversations/:id/messages", messagingHandler.ListMessages)
		protected.POST("/me/conversations/:id/read", messagingHandler.MarkRead)
		// SSE stream — long-lived; the handler lifts the 30s write deadline itself.
		protected.GET("/me/messages/stream", messagingHandler.Stream)

		// Identity verification (NIN/BVN via Prembly)
		protected.GET("/me/kyc/kinds", kycHandler.Kinds)
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
		protected.POST("/me/uploads/image", auth.RequireRole("seller", "artisan", "admin"), rateLimiter.RateLimit(1, 10), images.UploadHandler(logger))
		protected.POST("/me/profile/avatar", rateLimiter.RateLimit(1, 10), images.AvatarUploadHandler(logger))

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
			sellerGroup.GET("/delivery-zones", sellerHandler.ListDeliveryZones)
			sellerGroup.POST("/delivery-zones", sellerHandler.UpsertDeliveryZones)

			// Influencer partnerships
			sellerGroup.GET("/influencer-packages", influencerHandler.List)
			sellerGroup.POST("/influencer-packages", influencerHandler.Create)
			sellerGroup.GET("/influencer-packages/:id", influencerHandler.Get)
			sellerGroup.PATCH("/influencer-packages/:id", influencerHandler.Update)
			sellerGroup.PATCH("/influencer-packages/:id/state", influencerHandler.SetState)
			sellerGroup.GET("/influencer-packages/:id/commissions", influencerHandler.GetCommissions)
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
			adminGroup.GET("/influencer/packages", influencerHandler.AdminList)
			adminGroup.GET("/influencer-commissions", influencerHandler.AdminCommissions)
			adminGroup.GET("/reviews", reviewHandler.AdminList)
			adminGroup.PATCH("/reviews/:id", reviewHandler.SetStatus)
			adminGroup.GET("/revenue", revenue.NewHandler(db, logger).Summary)
			adminGroup.GET("/promotions", promotionHandler.AdminList)
			adminGroup.PATCH("/promotions/:id/status", promotionHandler.AdminUpdateStatus)
		}

		// Wallets & Withdrawals
		protected.GET("/wallets/me", authHandler.GetWallet)
		protected.POST("/me/wallet/withdraw", auth.RequireRole("seller", "artisan", "admin"), withdrawalHandler.Initiate)
		protected.POST("/me/wallet/resolve-account", auth.RequireRole("seller", "artisan", "admin"), rateLimiter.RateLimit(1, 5), withdrawalHandler.ResolveAccount)
		protected.GET("/me/wallet/withdrawals", auth.RequireRole("seller", "artisan", "admin"), withdrawalHandler.List)

		// Promotions & Paid Ads (sellers, artisans, admin)
		protected.POST("/me/promotions", auth.RequireRole("seller", "artisan", "admin"), promotionHandler.CreatePromotion)
		protected.POST("/me/promotions/:id/pay-wallet", auth.RequireRole("seller", "artisan", "admin"), promotionHandler.PayAdWithWallet)
		protected.GET("/me/promotions", auth.RequireRole("seller", "artisan", "admin"), promotionHandler.ListMyPromotions)

		// ── Storefront configuration (sellers, artisans, admin) ──
		sfGroup := protected.Group("/me/storefront")
		sfGroup.Use(auth.RequireRole("seller", "artisan", "admin"))
		{
			sfGroup.GET("", storefrontHandler.GetMyStorefront)
			sfGroup.POST("", storefrontHandler.SaveStorefront)
			sfGroup.POST("/check-handle", storefrontHandler.CheckHandle)
			sfGroup.POST("/theme-preview", storefrontHandler.ThemePreview)
		}
	}

	// ── Background work ─────────────────────────────────────
	bookingJobs := booking.NewMaintenance(db, mailer, logger)
	go jobs.Run(ctx, 5*time.Minute, logger,
		jobs.Task{Name: "escrow auto-release", Run: escrowService.SweepAutoReleases},
		jobs.Task{Name: "expire unanswered bookings", Run: bookingJobs.ExpireStale},
		jobs.Task{Name: "booking reminders", Run: bookingJobs.SendReminders},
		jobs.Task{Name: "influencer payouts", Run: influencerService.PayOutEarned},
		// A bank payout that was debited but never reached Paystack is resent
		// (with its original reference, so it can never be paid twice).
		jobs.Task{Name: "retry stuck withdrawals", Run: func(ctx context.Context) (int, error) {
			retried, err := withdrawalService.RetryPending(ctx, 2*time.Minute)
			if err != nil {
				return retried, err
			}
			// After a day unsent, check with the bank and give the money back
			// (never if the bank actually holds the payout).
			refunded, err := withdrawalService.ExpireStuck(ctx, 24*time.Hour)
			return retried + refunded, err
		}},
	)

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
	// On SIGTERM (a deploy or restart) stop taking new requests and let the
	// ones in flight finish, instead of cutting them off mid-payment.
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("Graceful shutdown failed", slog.Any("error", err))
		}
	}()
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("Server failed", slog.Any("error", err))
		os.Exit(1)
	}
	<-shutdownDone
	logger.Info("LuxeBeau API stopped")
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
