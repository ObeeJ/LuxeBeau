package escrow

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func actor(c *gin.Context) (id, role string) {
	v, _ := c.Get("userID")
	id, _ = v.(string)
	r, _ := c.Get("userRole")
	role, _ = r.(string)
	return id, role
}

type createRequest struct {
	Title        string `json:"title" binding:"required"`
	Amount       int64  `json:"amount" binding:"required,min=1"` // kobo
	BuyerPhone   string `json:"buyer_phone"`
	BuyerName    string `json:"buyer_name"`
	DeliveryCity string `json:"delivery_city"`
	Note         string `json:"note"`
	Rail         string `json:"rail"`
}

// Create makes an escrow link: the signed-in seller/artisan is the payee, the
// buyer is off-platform (reachable by phone / WhatsApp). This is the B2B2C flow.
func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid escrow: "+err.Error())
		return
	}
	uid, _ := actor(c)
	e, err := h.service.Create(c.Request.Context(), CreateInput{
		Kind:         domain.EscrowKindLink,
		BuyerPhone:   req.BuyerPhone,
		BuyerName:    req.BuyerName,
		PayeeID:      uid,
		Title:        req.Title,
		Amount:       req.Amount,
		Rail:         req.Rail,
		DeliveryCity: req.DeliveryCity,
		Note:         req.Note,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, gin.H{"escrow": e})
}

// List returns the signed-in user's escrows (as buyer and as payee).
func (h *Handler) List(c *gin.Context) {
	uid, _ := actor(c)
	asBuyer, err := h.service.List(c.Request.Context(), Filter{BuyerID: uid})
	if err != nil {
		response.InternalError(c, "Failed to fetch escrows")
		return
	}
	asPayee, err := h.service.List(c.Request.Context(), Filter{PayeeID: uid})
	if err != nil {
		response.InternalError(c, "Failed to fetch escrows")
		return
	}
	response.OK(c, gin.H{"buying": asBuyer, "selling": asPayee})
}

func (h *Handler) Get(c *gin.Context) {
	e, err := h.service.Get(c.Request.Context(), c.Param("id"))
	if err != nil || e == nil {
		response.NotFound(c, "Escrow not found")
		return
	}
	// Only the buyer, the payee, or an admin may view an escrow. Return 404
	// (not 403) so the endpoint can't be used as an existence oracle.
	uid, role := actor(c)
	if role != "admin" && e.BuyerID != uid && e.PayeeID != uid {
		response.NotFound(c, "Escrow not found")
		return
	}
	response.OK(c, gin.H{"escrow": e})
}

func (h *Handler) Fund(c *gin.Context) {
	uid, role := actor(c)
	e, err := h.service.Get(c.Request.Context(), c.Param("id"))
	if err != nil || e == nil {
		response.NotFound(c, "Escrow not found")
		return
	}
	if role != "admin" && e.BuyerID != uid {
		response.Fail(c, 403, "FORBIDDEN", "Only the buyer can fund this escrow.")
		return
	}
	funded, err := h.service.Fund(c.Request.Context(), e.ID)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"escrow": funded})
}

// Release: the buyer confirms delivery/completion and frees the funds.
func (h *Handler) Release(c *gin.Context) {
	uid, role := actor(c)
	released, err := h.service.Release(c.Request.Context(), c.Param("id"), uid, role == "admin")
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"escrow": released})
}

func (h *Handler) Refund(c *gin.Context) {
	uid, role := actor(c)
	refunded, err := h.service.Refund(c.Request.Context(), c.Param("id"), uid, role == "admin")
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"escrow": refunded})
}

type disputeRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *Handler) Dispute(c *gin.Context) {
	var req disputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "A reason is required to open a dispute.")
		return
	}
	uid, _ := actor(c)
	e, err := h.service.Dispute(c.Request.Context(), c.Param("id"), uid, req.Reason)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"escrow": e})
}

// ── Admin oversight ──

func (h *Handler) AdminList(c *gin.Context) {
	list, err := h.service.List(c.Request.Context(), Filter{State: c.Query("state"), Kind: c.Query("kind")})
	if err != nil {
		response.InternalError(c, "Failed to fetch escrows")
		return
	}
	response.OK(c, gin.H{"escrows": list})
}

type resolveRequest struct {
	Decision string `json:"decision" binding:"required,oneof=release refund"`
}

func (h *Handler) AdminResolve(c *gin.Context) {
	var req resolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Decision must be 'release' or 'refund'.")
		return
	}
	e, err := h.service.Resolve(c.Request.Context(), c.Param("id"), req.Decision)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"escrow": e})
}
