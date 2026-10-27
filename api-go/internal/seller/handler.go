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
