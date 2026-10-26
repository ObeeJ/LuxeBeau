package seller

import (
	"log/slog"
	"strconv"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/media"
	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	images  *media.Images
	logger  *slog.Logger
}

func NewHandler(service *Service, images *media.Images, logger *slog.Logger) *Handler {
	return &Handler{service: service, images: images, logger: logger}
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
