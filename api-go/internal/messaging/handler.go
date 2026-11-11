package messaging

import (
	"errors"
	"fmt"
	"log/slog"
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
	if req.RecipientID == uid(c) {
		response.BadRequest(c, "You cannot message yourself.")
		return
	}
	msg, err := h.service.Send(c.Request.Context(), uid(c), req.RecipientID, req.Body)
	switch {
	case err == nil:
	case errors.Is(err, ErrEmptyMessage), errors.Is(err, ErrMessageTooLong):
		response.BadRequest(c, err.Error())
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

	// Send a heartbeat every 25 seconds to keep the connection alive through
	// proxies and Render's 30-second idle timeout.
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w gin.ResponseWriter) bool {
		select {
		case convID, ok := <-ch:
			if !ok {
				return false
			}
			fmt.Fprintf(w, "data: %s\n\n", convID)
			w.(gin.ResponseWriter).Flush()
			return true
		case <-ticker.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			w.(gin.ResponseWriter).Flush()
			return true
		case <-c.Request.Context().Done():
			return false
		}
	})
}
