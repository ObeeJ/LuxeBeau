package seller

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/mail"
	"luxebeau/internal/media"
	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	images  *media.Images
	mailer  *mail.Mailer
	logger  *slog.Logger
}

func NewHandler(service *Service, images *media.Images, mailer *mail.Mailer, logger *slog.Logger) *Handler {
	return &Handler{service: service, images: images, mailer: mailer, logger: logger}
}

// productRequest is the seller-editable shape. Prices arrive in Kobo, matching
// the rest of the API.
type productRequest struct {
	Name          string   `json:"name" binding:"required"`
	Brand         string   `json:"brand" binding:"required"`
	Price         int64    `json:"price" binding:"required,min=1"`
	OriginalPrice int64    `json:"original_price"`
	Category      string   `json:"category" binding:"required"`
	Stock         int      `json:"stock" binding:"min=0"`
	Badge         string   `json:"badge"`
	Blurb         string   `json:"blurb"`
	Details       []string `json:"details"`
	BgColor       string   `json:"bg_color"`
	FgColor       string   `json:"fg_color"`
	ImageURL      string   `json:"image_url" binding:"max=500"`
}

func (r productRequest) toDomain() *domain.Product {
	return &domain.Product{
		Name:          r.Name,
		Brand:         r.Brand,
		Price:         r.Price,
		OriginalPrice: r.OriginalPrice,
		Category:      r.Category,
		Stock:         r.Stock,
		Badge:         r.Badge,
		Blurb:         r.Blurb,
		Details:       domain.StringArray(r.Details),
		BgColor:       r.BgColor,
		FgColor:       r.FgColor,
		ImageURL:      r.ImageURL,
	}
}

func sellerID(c *gin.Context) string {
	v, _ := c.Get("userID")
	s, _ := v.(string)
	return s
}

func (h *Handler) ListProducts(c *gin.Context) {
	products, err := h.service.ListProducts(c.Request.Context(), sellerID(c))
	if err != nil {
		response.InternalError(c, "Failed to fetch your products")
		return
	}
	response.OK(c, gin.H{"products": products})
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req productRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid product: "+err.Error())
		return
	}
	if !h.images.ValidURL(req.ImageURL) {
		response.BadRequest(c, "Upload product photos through LuxeBeau.")
		return
	}
	p, err := h.service.CreateProduct(c.Request.Context(), sellerID(c), req.toDomain())
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, gin.H{"product": p})
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	var req productRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid product: "+err.Error())
		return
	}
	if !h.images.ValidURL(req.ImageURL) {
		response.BadRequest(c, "Upload product photos through LuxeBeau.")
		return
	}
	p, err := h.service.UpdateProduct(c.Request.Context(), sellerID(c), uint(id), req.toDomain())
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"product": p})
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	if err := h.service.DeleteProduct(c.Request.Context(), sellerID(c), uint(id)); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Product removed"})
}

func (h *Handler) ListSales(c *gin.Context) {
	orders, err := h.service.ListSales(c.Request.Context(), sellerID(c))
	if err != nil {
		response.InternalError(c, "Failed to fetch your sales")
		return
	}
	response.OK(c, gin.H{"orders": orders})
}

type fulfilRequest struct {
	Status       string `json:"status" binding:"required,oneof=processing shipped delivered"`
	TrackingNote string `json:"tracking_note" binding:"max=200"`
}

// Fulfil: PATCH /me/sales/:orderId. The seller moves their own items in an
// order forward; the buyer is emailed when items ship or arrive.
func (h *Handler) Fulfil(c *gin.Context) {
	var req fulfilRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Choose processing, shipped or delivered. Tracking notes are up to 200 characters.")
		return
	}
	orderID := c.Param("orderId")
	if len(orderID) > 50 {
		response.NotFound(c, "Order not found")
		return
	}
	f, err := h.service.Fulfil(c.Request.Context(), sellerID(c), orderID, req.Status, req.TrackingNote)
	switch {
	case errors.Is(err, ErrSaleNotFound):
		response.NotFound(c, "Order not found")
		return
	case errors.Is(err, ErrNotPaid):
		response.Conflict(c, "This order hasn't been paid yet. Wait for payment before sending it.")
		return
	case errors.Is(err, ErrBackwards):
		response.Conflict(c, "These items are already further along. Status can only move forward.")
		return
	case errors.Is(err, ErrOrderClosed):
		response.Conflict(c, "This order was cancelled.")
		return
	case errors.Is(err, ErrInvalidStage):
		response.BadRequest(c, "Choose processing, shipped or delivered.")
		return
	case err != nil:
		h.logger.Error("fulfil order failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't update this order. Please try again.")
		return
	}
	if h.mailer != nil && f.Notify && f.BuyerMail != "" {
		info := mail.FulfilmentEmail{OrderID: f.Order.ID, Stage: f.Stage, Seller: sellerName(c), Items: f.Items, Note: req.TrackingNote}
		if f.ReleaseBy != nil {
			info.ReleaseBy = f.ReleaseBy.In(lagos).Format("Mon 2 Jan 2006")
		}
		to, name := f.BuyerMail, f.BuyerName
		h.mailer.Go("order_progress", func(ctx context.Context) error { return h.mailer.OrderProgress(ctx, to, name, info) })
	}
	response.OK(c, gin.H{"status": f.Stage, "order_status": f.Order.ShippingStatus})
}

// lagos is the time zone dates in emails use.
var lagos = func() *time.Location {
	if loc, err := time.LoadLocation("Africa/Lagos"); err == nil {
		return loc
	}
	return time.FixedZone("WAT", 3600) // Lagos is UTC+1 all year
}()

func sellerName(c *gin.Context) string {
	if u, ok := c.Get("user"); ok {
		if user, ok := u.(*domain.User); ok && user.Name != "" {
			return user.Name
		}
	}
	return "Your seller"
}

// ── Storefront slug ──────────────────────────────────────────────────────────

type slugRequest struct {
	Slug string `json:"slug" binding:"required,min=3,max=80"`
}

func (h *Handler) SetStorefrontSlug(c *gin.Context) {
	var req slugRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Slug must be 3–80 characters.")
		return
	}
	uid := sellerID(c)
	slug, err := SetStorefrontSlug(c.Request.Context(), h.service.DB(), uid, req.Slug)
	switch err {
	case nil:
	case ErrSlugTaken:
		response.Conflict(c, "That storefront name is already taken. Try another.")
		return
	case ErrSlugInvalid:
		response.BadRequest(c, "Use only lowercase letters, numbers and hyphens (e.g. arike-spa).")
		return
	default:
		response.InternalError(c, "Could not save storefront name.")
		return
	}
	response.OK(c, gin.H{"storefront_slug": slug, "url": "https://" + slug + ".luxebeau.com"})
}

// ── Delivery zones ───────────────────────────────────────────────────────────

type deliveryZoneInput struct {
	City    string `json:"city"`     // empty = catch-all
	FeeKobo int64  `json:"fee_kobo"` // 0 = free delivery
}

func (h *Handler) ListDeliveryZones(c *gin.Context) {
	zones, err := ListDeliveryZones(c.Request.Context(), h.service.DB(), sellerID(c))
	if err != nil {
		response.InternalError(c, "Failed to fetch delivery zones")
		return
	}
	response.OK(c, gin.H{"zones": zones})
}

func (h *Handler) UpsertDeliveryZones(c *gin.Context) {
	var inputs []deliveryZoneInput
	if err := c.ShouldBindJSON(&inputs); err != nil || len(inputs) == 0 {
		response.BadRequest(c, "Send an array of delivery zones.")
		return
	}
	zones := make([]domain.DeliveryZone, len(inputs))
	for i, z := range inputs {
		zones[i] = domain.DeliveryZone{City: z.City, FeeKobo: z.FeeKobo}
	}
	if err := UpsertDeliveryZones(c.Request.Context(), h.service.DB(), sellerID(c), zones); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "Delivery zones saved"})
}

// ── Public storefront ────────────────────────────────────────────────────────

// GetStorefront returns the partner's public profile by their brand slug.
// This powers arike-spa.luxebeau.com — the frontend resolves the subdomain
// to this endpoint.
func (h *Handler) GetStorefront(c *gin.Context) {
	slug := c.Param("slug")
	if len(slug) < 3 || len(slug) > 80 {
		response.NotFound(c, "Storefront not found")
		return
	}
	var u domain.User
	if err := h.service.DB().WithContext(c.Request.Context()).
		Select("id", "name", "role", "verified", "storefront_slug", "jurisdiction").
		Where("storefront_slug = ? AND verified = ? AND status = ?", slug, true, "active").
		First(&u).Error; err != nil {
		response.NotFound(c, "Storefront not found")
		return
	}
	response.OK(c, gin.H{"partner": u})
}

// GetStorefrontProducts returns a seller's live products for their storefront.
func (h *Handler) GetStorefrontProducts(c *gin.Context) {
	slug := c.Param("slug")
	var u domain.User
	if err := h.service.DB().WithContext(c.Request.Context()).
		Select("id", "role", "verified", "status").
		Where("storefront_slug = ? AND verified = ? AND status = ?", slug, true, "active").
		First(&u).Error; err != nil {
		response.NotFound(c, "Storefront not found")
		return
	}
	if u.Role != "seller" && u.Role != "admin" {
		response.NotFound(c, "Storefront not found")
		return
	}
	products, err := h.service.ListProducts(c.Request.Context(), u.ID)
	if err != nil {
		response.InternalError(c, "Failed to load products")
		return
	}
	response.OK(c, gin.H{"products": products})
}

// GetStorefrontServices returns an artisan's services and availability for their storefront.
func (h *Handler) GetStorefrontServices(c *gin.Context) {
	slug := c.Param("slug")
	var u domain.User
	if err := h.service.DB().WithContext(c.Request.Context()).
		Select("id", "role", "verified", "status").
		Where("storefront_slug = ? AND verified = ? AND status = ?", slug, true, "active").
		First(&u).Error; err != nil {
		response.NotFound(c, "Storefront not found")
		return
	}
	if u.Role != "artisan" {
		response.NotFound(c, "Storefront not found")
		return
	}
	var artisan domain.Artisan
	if err := h.service.DB().WithContext(c.Request.Context()).
		Where("user_id = ?", u.ID).First(&artisan).Error; err != nil {
		response.NotFound(c, "Storefront not found")
		return
	}
	response.OK(c, gin.H{"artisan": artisan, "services": artisan.Services})
}
