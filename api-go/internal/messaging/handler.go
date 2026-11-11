package messaging

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

// heartbeatEvery keeps the live feed alive through proxies and Render's idle
// timeout. It is a variable so tests can shorten it.
var heartbeatEvery = 25 * time.Second

func uid(c *gin.Context) string { return c.GetString("userID") }

// ListConversations: GET /me/conversations
func (h *Handler) ListConversations(c *gin.Context) {
	list, err := h.service.ListConversations(c.Request.Context(), uid(c))
	if err != nil {
		h.logger.Error("list conversations failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load your conversations.")
		return
	}
	response.OK(c, gin.H{"conversations": list})
}

type sendRequest struct {
	RecipientID string `json:"recipient_id" binding:"required,uuid"`
	Body        string `json:"body" binding:"required,max=2000"`
}

// Send: POST /me/messages
func (h *Handler) Send(c *gin.Context) {
	var req sendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a message (max 2000 characters) and a valid recipient.")
		return
	}
	msg, err := h.service.Send(c.Request.Context(), uid(c), req.RecipientID, req.Body)
	switch {
	case err == nil:
	case errors.Is(err, ErrEmptyMessage), errors.Is(err, ErrMessageTooLong), errors.Is(err, ErrSelfMessage):
		response.BadRequest(c, err.Error())
		return
	case errors.Is(err, ErrRecipientNotFound):
		response.NotFound(c, "We couldn't find that person.")
		return
	default:
		h.logger.Error("send message failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't send that message.")
		return
	}
	response.Created(c, gin.H{"message": msg})
}

// ListMessages: GET /me/conversations/:id/messages?limit=30&before=ID
func (h *Handler) ListMessages(c *gin.Context) {
	convID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	before, _ := strconv.Atoi(c.DefaultQuery("before", "0"))
	msgs, err := h.service.ListMessages(c.Request.Context(), uid(c), convID, limit, before)
	if errors.Is(err, ErrNotParticipant) {
		response.NotFound(c, "Conversation not found.")
		return
	}
	if err != nil {
		h.logger.Error("list messages failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load messages.")
		return
	}
	response.OK(c, gin.H{"messages": msgs})
}

// MarkRead: POST /me/conversations/:id/read
func (h *Handler) MarkRead(c *gin.Context) {
	if err := h.service.MarkRead(c.Request.Context(), uid(c), c.Param("id")); err != nil {
		if errors.Is(err, ErrNotParticipant) {
			response.NotFound(c, "Conversation not found.")
			return
		}
		h.logger.Error("mark read failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't mark messages as read.")
		return
	}
	response.OK(c, gin.H{"ok": true})
}

// Stream: GET /me/messages/stream — SSE endpoint.
// The client connects once and receives "data: <convID>\n\n" whenever a new
// message arrives. On disconnect or timeout the client reconnects and polls
// for missed messages via ListMessages.
func (h *Handler) Stream(c *gin.Context) {
	userID := uid(c)
	ch, cleanup := h.service.Subscribe(userID)
	defer cleanup()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no") // disable Nginx buffering

	// The server closes ordinary responses after its WriteTimeout (30s). A live
	// feed has to stay open, so lift the deadline for this one connection.
	if err := http.NewResponseController(c.Writer).SetWriteDeadline(time.Time{}); err != nil {
		h.logger.Warn("could not lift the write deadline for the live feed", slog.Any("error", err))
	}
	// Say hello straight away: browsers only treat the stream as open once the
	// first bytes arrive, and the first heartbeat is up to 25 seconds away.
	fmt.Fprint(c.Writer, ": connected\n\n")
	c.Writer.Flush()

	// Heartbeats keep the connection alive through proxies and idle timeouts.
	ticker := time.NewTicker(heartbeatEvery)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case convID, ok := <-ch:
			if !ok {
				return false
			}
			fmt.Fprintf(w, "data: %s\n\n", convID)
			return true
		case <-ticker.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			return true
		case <-c.Request.Context().Done():
			return false
		}
	})
}
