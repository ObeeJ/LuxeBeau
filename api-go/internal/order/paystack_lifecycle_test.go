package order

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/auth"
	"luxebeau/internal/domain"
	"luxebeau/internal/middleware"
)

func signHMAC(secret string, body []byte) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestPaystackEndToEndLifecycleAndInvariants(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 1. Setup SQLite in-memory DB
	db, err := gorm.Open(sqlite.Open("file:paystack_test?mode=memory&cache=shared&_busy_timeout=5000"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(1)
	}

	err = db.AutoMigrate(
		&domain.User{},
		&domain.Wallet{},
		&domain.Product{},
		&domain.Order{},
		&domain.OrderItem{},
		&domain.Escrow{},
		&domain.LedgerEntry{},
		&domain.EmailOTP{},
		&domain.DeliveryZone{},
	)
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	paystackSecret := "sk_test_e99eb614f281d0953422461442593ffc90b370fa"
	_ = os.Setenv("PAYSTACK_SECRET_KEY", paystackSecret)

	userRepo := &mockUserRepo{db: db}
	walletRepo := auth.NewGormWalletRepository(db)
	productRepo := &mockProductRepo{db: db}
	orderRepo := &mockOrderRepo{db: db}

	userService := auth.NewService(db, userRepo, walletRepo, noopCodes{}, auth.Config{JWTSecret: "test-secret-32-chars-long-key-01"}, logger)
	orderService := NewOrderService(orderRepo, productRepo, db, logger)
	orderHandler := NewOrderHandler(orderService, logger)

	// Register test buyer
	buyer, err := userService.Register(context.Background(), "Amaka Buyer", "amaka@test.ng", "SecurePass123!", "+2348011112222")
	if err != nil {
		t.Fatalf("failed to register buyer: %v", err)
	}

	// Seed two distinct sellers
	seller1 := &domain.User{ID: "seller-1-uuid", Name: "Adunni Organics", Email: "seller1@test.ng", Role: "seller", Verified: true}
	seller2 := &domain.User{ID: "seller-2-uuid", Name: "Kemi Skincare", Email: "seller2@test.ng", Role: "seller", Verified: true}
	db.Create(seller1)
	db.Create(seller2)
	db.Create(&domain.Wallet{UserID: seller1.ID, Balance: 0})
	db.Create(&domain.Wallet{UserID: seller2.ID, Balance: 0})

	// Seed products for both sellers (subtotal under ₦10,000 so delivery fee of ₦1,500 applies)
	prod1 := &domain.Product{SellerID: seller1.ID, Name: "Shea Glow Butter", Brand: "Adunni", Price: 400000, Stock: 10} // ₦4,000
	prod2 := &domain.Product{SellerID: seller2.ID, Name: "Rosewater Mist", Brand: "Kemi", Price: 300000, Stock: 10}      // ₦3,000
	db.Create(prod1)
	db.Create(prod2)

	// Setup Gin router with webhook and verification routes
	r := gin.New()
	v1 := r.Group("/api/v1")
	{
		v1.POST("/webhooks/paystack",
			middleware.RequireHMACSignature(paystackSecret, "x-paystack-signature"),
			orderHandler.PaystackWebhook,
		)

		// Mock authentication context for buyer
		authBuyer := func(c *gin.Context) {
			c.Set("userID", buyer.ID)
			c.Set("userRole", "buyer")
			c.Next()
		}
		v1.POST("/orders/:id/verify", authBuyer, orderHandler.VerifyPayment)
	}

	// ── STEP 1: CREATE MULTI-SELLER CARD CHECKOUT ORDER ──
	// Buyer orders 1x Prod1 (4,000 NGN) and 1x Prod2 (3,000 NGN)
	// Subtotal: 7,000 NGN (700,000 kobo). Delivery fee: 1,500 NGN (150,000 kobo). Total: 8,500 NGN (850,000 kobo).
	orderReq := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{
		{ProductID: prod1.ID, Qty: 1},
		{ProductID: prod2.ID, Qty: 1},
	}
	order, err := orderService.CreateCheckout(
		context.Background(),
		buyer.ID,
		orderReq,
		"15 Admiralty Way, Lekki Phase 1", "Lagos", "Lagos", "+2348011112222",
		"card",
	)
	if err != nil {
		t.Fatalf("CreateCheckout failed: %v", err)
	}

	if order.PaymentStatus != "pending" {
		t.Fatalf("expected initial payment status 'pending', got: %s", order.PaymentStatus)
	}
	// Goods 700,000 + each of the two sellers' default delivery (2 x 150,000) +
	// the platform fee, 3.5% of the goods (24,500), + the gateway's cut that the
	// buyer carries on a card payment (25,754: 1.5% plus ₦100 of the grossed-up
	// charge of 1,050,254). Everything the sellers and the platform are owed
	// is untouched by it.
	expectedTotal := int64(700000 + 300000 + 24500 + 25754)
	if order.Total != expectedTotal {
		t.Fatalf("expected order total %d kobo, got %d kobo", expectedTotal, order.Total)
	}

	// Verify no escrows exist yet
	var escrowsBefore []domain.Escrow
	db.Where("reference = ?", order.ID).Find(&escrowsBefore)
	if len(escrowsBefore) != 0 {
		t.Fatalf("expected 0 escrows before payment, found %d", len(escrowsBefore))
	}

	// ── STEP 2: SECURITY TESTS (TAMPERING & FORGERY DEFENSE) ──

	// 2a: Unsigned Webhook Request -> Must fail with 401
	payload := PaystackWebhookPayload{
		Event: "charge.success",
		Data: struct {
			Reference string `json:"reference"`
			Status    string `json:"status"`
			Amount    int64  `json:"amount"`
			Currency  string `json:"currency"`
		}{
			Reference: order.ID,
			Status:    "success",
			Amount:    order.Total,
			Currency:  "NGN",
		},
	}
	bodyBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/v1/webhooks/paystack", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected unsigned webhook to return 401, got %d", w.Code)
	}

	// 2b: Invalid Signature Webhook Request -> Must fail with 401
	req = httptest.NewRequest("POST", "/api/v1/webhooks/paystack", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-paystack-signature", "deadbeef000011112222333344445555")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected invalid signature webhook to return 401, got %d", w.Code)
	}

	// 2c: Tampered Amount (e.g. attacker changes amount to ₦100 = 10,000 kobo)
	tamperedPayload := payload
	tamperedPayload.Data.Amount = 10000
	tamperedBody, _ := json.Marshal(tamperedPayload)
	tamperedSig := signHMAC(paystackSecret, tamperedBody)

	req = httptest.NewRequest("POST", "/api/v1/webhooks/paystack", bytes.NewReader(tamperedBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-paystack-signature", tamperedSig)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected webhook to acknowledge with 200, got %d", w.Code)
	}
	var tamperedEnvelope struct {
		Data struct {
			Outcome string `json:"outcome"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &tamperedEnvelope)
	if tamperedEnvelope.Data.Outcome != string(domain.PaymentAmountInvalid) {
		t.Errorf("expected outcome 'amount_invalid', got %v (body: %s)", tamperedEnvelope.Data.Outcome, w.Body.String())
	}

	// Verify order is still pending
	details, _ := orderService.GetOrderDetails(context.Background(), order.ID)
	if details.PaymentStatus != "pending" {
		t.Errorf("order payment status changed to %s after tampered amount", details.PaymentStatus)
	}

	// ── STEP 3: LEGITIMATE PAYMENT VIA SIGNED PAYSTACK WEBHOOK ──
	validSig := signHMAC(paystackSecret, bodyBytes)
	req = httptest.NewRequest("POST", "/api/v1/webhooks/paystack", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-paystack-signature", validSig)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected valid webhook to return 200, got %d: %s", w.Code, w.Body.String())
	}
	var validEnvelope struct {
		Data struct {
			Outcome string `json:"outcome"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &validEnvelope)
	if validEnvelope.Data.Outcome != string(domain.PaymentMarkedPaid) {
		t.Fatalf("expected outcome 'paid', got %v (body: %s)", validEnvelope.Data.Outcome, w.Body.String())
	}

	// ── STEP 4: VERIFY POST-PAYMENT STATE & DOUBLE-ENTRY LEDGER ──
	paidOrder, err := orderService.GetOrderDetails(context.Background(), order.ID)
	if err != nil || paidOrder.PaymentStatus != "paid" {
		t.Fatalf("expected order payment status 'paid', got: %s (err: %v)", paidOrder.PaymentStatus, err)
	}

	// Verify Escrow Holds: Exactly 2 escrows (one per seller)
	var escrows []domain.Escrow
	db.Where("kind = ? AND reference = ?", domain.EscrowKindOrder, order.ID).Find(&escrows)
	if len(escrows) != 2 {
		t.Fatalf("expected exactly 2 escrow holds for multi-seller order, got %d", len(escrows))
	}

	seller1Found := false
	seller2Found := false
	var totalHeld int64
	for _, e := range escrows {
		totalHeld += e.Amount
		if e.State != domain.EscrowFunded {
			t.Errorf("expected escrow state to be 'funded', got %s", e.State)
		}
		if e.PayeeID == seller1.ID {
			seller1Found = true
			if e.Amount != 550000 { // 4,000 NGN goods + their own 1,500 NGN delivery
				t.Errorf("expected seller 1 escrow to be 550,000 kobo, got %d", e.Amount)
			}
		}
		if e.PayeeID == seller2.ID {
			seller2Found = true
			if e.Amount != 450000 { // 3,000 NGN goods + their own 1,500 NGN delivery
				t.Errorf("expected seller 2 escrow to be 450,000 kobo, got %d", e.Amount)
			}
		}
	}
	if !seller1Found || !seller2Found {
		t.Errorf("missing escrow for seller1 (%v) or seller2 (%v)", seller1Found, seller2Found)
	}
	// The sellers hold their goods and their own delivery; neither the platform
	// fee nor the gateway's fee is in their money.
	if totalHeld != paidOrder.Subtotal+paidOrder.DeliveryFee {
		t.Errorf("total escrows held %d != goods %d + delivery %d", totalHeld, paidOrder.Subtotal, paidOrder.DeliveryFee)
	}

	// Verify Double-Entry Ledger Entries
	var ledgerEntries []domain.LedgerEntry
	db.Find(&ledgerEntries)
	if len(ledgerEntries) != 4 { // 2x fund escrows + platform fee + processing fee
		t.Fatalf("expected 4 ledger entries, got %d", len(ledgerEntries))
	}

	var sumDebitedFromGateway int64
	var sumCreditedToEscrow int64
	var sumCreditedToPlatform int64
	var sumCreditedToProcessor int64

	for _, entry := range ledgerEntries {
		if entry.FromAccount == "gateway" {
			sumDebitedFromGateway += entry.Amount
		}
		if entry.ToAccount == "escrow" {
			sumCreditedToEscrow += entry.Amount
		}
		if entry.ToAccount == "platform" {
			sumCreditedToPlatform += entry.Amount
		}
		if entry.ToAccount == "processor" {
			sumCreditedToProcessor += entry.Amount
		}
	}

	if sumDebitedFromGateway != paidOrder.Total {
		t.Errorf("ledger debit from gateway %d != order total %d", sumDebitedFromGateway, paidOrder.Total)
	}
	if sumCreditedToEscrow != paidOrder.Subtotal+paidOrder.DeliveryFee {
		t.Errorf("ledger credit to escrow %d != goods %d + delivery %d", sumCreditedToEscrow, paidOrder.Subtotal, paidOrder.DeliveryFee)
	}
	if sumCreditedToPlatform != paidOrder.PlatformFee {
		t.Errorf("ledger credit to platform %d != order platform fee %d", sumCreditedToPlatform, paidOrder.PlatformFee)
	}
	if sumCreditedToProcessor != paidOrder.ProcessingFee {
		t.Errorf("ledger credit to the processor %d != order processing fee %d", sumCreditedToProcessor, paidOrder.ProcessingFee)
	}
	if credits := sumCreditedToEscrow + sumCreditedToPlatform + sumCreditedToProcessor; credits != sumDebitedFromGateway {
		t.Errorf("FINANCIAL INVARIANT VIOLATION: debits (%d) != credits (%d)", sumDebitedFromGateway, credits)
	}

	// ── STEP 5: CONCURRENCY & IDEMPOTENCY VERIFICATION ──
	// Blast 10 concurrent duplicate webhook deliveries
	var wg sync.WaitGroup
	concurrentCount := 10
	outcomes := make([]string, concurrentCount)

	for i := 0; i < concurrentCount; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			req := httptest.NewRequest("POST", "/api/v1/webhooks/paystack", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("x-paystack-signature", validSig)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			var resp struct {
				Data struct {
					Outcome string `json:"outcome"`
				} `json:"data"`
			}
			_ = json.Unmarshal(w.Body.Bytes(), &resp)
			outcomes[idx] = resp.Data.Outcome
		}(i)
	}
	wg.Wait()

	// Every single concurrent request MUST be "ignored" because order is already paid
	for _, outcome := range outcomes {
		if outcome != string(domain.PaymentIgnored) {
			t.Errorf("expected concurrent outcome 'ignored', got %s", outcome)
		}
	}

	// Ensure no duplicate escrows or ledger entries were created
	var escrowsAfter []domain.Escrow
	db.Where("kind = ? AND reference = ?", domain.EscrowKindOrder, order.ID).Find(&escrowsAfter)
	if len(escrowsAfter) != 2 {
		t.Errorf("CONCURRENCY BUG: duplicate escrows created! expected 2, got %d", len(escrowsAfter))
	}

	var ledgerAfter []domain.LedgerEntry
	db.Find(&ledgerAfter)
	// The same 4 rows as after the first payment: 2 fund + platform fee + processing fee.
	if len(ledgerAfter) != 4 {
		t.Errorf("CONCURRENCY BUG: duplicate ledger entries! expected 4, got %d", len(ledgerAfter))
	}

	// ── STEP 6: IDEMPOTENT VERIFICATION FALLBACK ──
	// Calling /orders/:id/verify on an already paid order returns HTTP 200 with verified: true
	verifyReq := httptest.NewRequest("POST", "/api/v1/orders/"+order.ID+"/verify", nil)
	verifyW := httptest.NewRecorder()
	r.ServeHTTP(verifyW, verifyReq)

	if verifyW.Code != http.StatusOK {
		t.Errorf("expected verify endpoint to return 200, got %d", verifyW.Code)
	}
}
