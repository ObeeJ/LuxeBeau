package revenue

import (
	"errors"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"luxebeau/internal/response"
)

type Handler struct {
	db     *gorm.DB
	logger *slog.Logger
}

func NewHandler(db *gorm.DB, logger *slog.Logger) *Handler {
	return &Handler{db: db, logger: logger}
}

// Summary: GET /api/v1/admin/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|week|month
// (admin only; the route is mounted inside the admin group). With no
// parameters it returns the last 30 days by day, ending today in Lagos.
func (h *Handler) Summary(c *gin.Context) {
	now := time.Now().In(Lagos)
	to := c.DefaultQuery("to", now.Format("2006-01-02"))
	from := c.DefaultQuery("from", now.AddDate(0, 0, -29).Format("2006-01-02"))
	group := c.DefaultQuery("group", "day")

	s, err := Build(c.Request.Context(), h.db, from, to, group)
	switch {
	case errors.Is(err, ErrInvalidRange):
		response.BadRequest(c, "Choose a valid date range: the start must not be after the end, and it can cover at most 366 days.")
		return
	case errors.Is(err, ErrInvalidGroup):
		response.BadRequest(c, "Group by day, week or month.")
		return
	case err != nil:
		h.logger.Error("revenue summary failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load revenue right now. Please try again.")
		return
	}
	response.OK(c, s)
}
