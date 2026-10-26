package catalog

import (
	"log/slog"
	"strconv"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type CatalogHandler struct {
	service domain.ProductService
	logger  *slog.Logger
}

func NewCatalogHandler(service domain.ProductService, logger *slog.Logger) *CatalogHandler {
	return &CatalogHandler{service: service, logger: logger}
}

// maxPageSize caps ?limit= so one request can't pull the whole table.
const maxPageSize = 100

func (h *CatalogHandler) ListProducts(c *gin.Context) {
	category := c.Query("category")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 || limit > maxPageSize {
		limit = maxPageSize
	}
	if page < 1 {
		page = 1
	}

	products, err := h.service.ListProducts(c.Request.Context(), category, search, page, limit)
	if err != nil {
		response.InternalError(c, "Failed to fetch products")
		return
	}

	response.OK(c, gin.H{"products": products, "page": page, "limit": limit})
}

func (h *CatalogHandler) GetProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	product, err := h.service.GetProduct(c.Request.Context(), uint(id))
	if err != nil {
		response.InternalError(c, "Failed to fetch product")
		return
	}
	if product == nil {
		response.NotFound(c, "Product not found")
		return
	}

	response.OK(c, gin.H{"product": product})
}
