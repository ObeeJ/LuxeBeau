// Package review lets buyers rate what they really bought or booked. A review
// is only allowed once the seller's payout was released (goods received) or the
// booking was completed, each buyer reviews each listing once, and a moderator
// can hide a review. Ratings shown on listings are computed from the visible
// reviews, never typed in by hand.
package review

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

var (
	ErrInvalidReview   = errors.New("invalid review")
	ErrNotEligible     = errors.New("not eligible to review this")
	ErrAlreadyReviewed = errors.New("already reviewed")
	ErrNotFound        = errors.New("review not found")
)

const MaxBodyRunes = 500

type Service struct {
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{db: db, logger: logger}
}

type CreateInput struct {
	TargetType string
	TargetID   string
	Rating     int
	Body       string
}

// PublicReview is the shape the storefront shows.
type PublicReview struct {
	ID            uint   `json:"id"`
	Author        string `json:"author"`
	VerifiedBuyer bool   `json:"verified_buyer"`
	Rating        int    `json:"rating"`
	Date          string `json:"date"`
	Text          string `json:"text"`
	Item          string `json:"item"`
}

type Page struct {
	Reviews []PublicReview `json:"reviews"`
	Count   int64          `json:"count"`
	Average float64        `json:"average"`
}

type Reviewable struct {
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
	Name       string `json:"name"`
}

type AdminReview struct {
	ID         uint      `json:"id"`
	Author     string    `json:"author"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	TargetName string    `json:"target_name"`
	Rating     int       `json:"rating"`
	Body       string    `json:"body"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

func validTarget(t string) bool {
	return t == domain.ReviewTargetProduct || t == domain.ReviewTargetArtisan
}

// eligible checks that the buyer really earned a review of this listing and
// returns the listing's display name.
func (s *Service) eligible(ctx context.Context, db *gorm.DB, reviewerID, targetType string, id uint) (string, error) {
	switch targetType {
	case domain.ReviewTargetProduct:
		var p domain.Product
		if err := db.WithContext(ctx).First(&p, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", ErrNotEligible
			}
			return "", err
		}
		if p.SellerID == reviewerID {
			return "", ErrNotEligible
		}
		var n int64
		err := db.WithContext(ctx).Table("order_items oi").
			Joins("JOIN orders o ON o.id = oi.order_id").
			Joins("JOIN escrows e ON e.reference = oi.order_id AND e.kind = ?", domain.EscrowKindOrder).
			Where("oi.product_id = ? AND o.buyer_id = ? AND e.payee_id = ? AND e.state = ?", id, reviewerID, p.SellerID, domain.EscrowReleased).
			Count(&n).Error
		if err != nil {
			return "", err
		}
		if n == 0 {
			return "", ErrNotEligible
		}
		return p.Name, nil
	case domain.ReviewTargetArtisan:
		var a domain.Artisan
		if err := db.WithContext(ctx).First(&a, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", ErrNotEligible
			}
			return "", err
		}
		if a.UserID == reviewerID {
			return "", ErrNotEligible
		}
		var b domain.Booking
		err := db.WithContext(ctx).Where("buyer_id = ? AND artisan_id = ? AND status = ?", reviewerID, id, domain.BookingCompleted).
			Order("booking_date DESC").First(&b).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrNotEligible
		}
		if err != nil {
			return "", err
		}
		return b.ServiceName, nil
	}
	return "", ErrInvalidReview
}

func parseID(s string) (uint, bool) {
	n, err := strconv.ParseUint(strings.TrimSpace(s), 10, 32)
	return uint(n), err == nil && n > 0
}

// Create stores a review and refreshes the listing's rating, atomically.
func (s *Service) Create(ctx context.Context, reviewerID string, in CreateInput) (*domain.Review, error) {
	body := strings.TrimSpace(in.Body)
	id, idOK := parseID(in.TargetID)
	if !validTarget(in.TargetType) || !idOK || in.Rating < 1 || in.Rating > 5 || utf8.RuneCountInString(body) > MaxBodyRunes {
		return nil, ErrInvalidReview
	}
	targetID := strconv.FormatUint(uint64(id), 10)
	var out *domain.Review
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		name, err := s.eligible(ctx, tx, reviewerID, in.TargetType, id)
		if err != nil {
			return err
		}
		var existing int64
		if err := tx.Model(&domain.Review{}).
			Where("reviewer_id = ? AND target_type = ? AND target_id = ?", reviewerID, in.TargetType, targetID).
			Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return ErrAlreadyReviewed
		}
		r := &domain.Review{ReviewerID: reviewerID, TargetType: in.TargetType, TargetID: targetID,
			ItemName: name, Rating: in.Rating, Body: body, Status: domain.ReviewVisible}
		if err := tx.Create(r).Error; err != nil {
			low := strings.ToLower(err.Error())
			if strings.Contains(low, "unique") || strings.Contains(low, "duplicate") {
				return ErrAlreadyReviewed
			}
			return err
		}
		if err := recompute(tx, in.TargetType, targetID); err != nil {
			return err
		}
		out = r
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// recompute rewrites the listing's rating and review count from its visible reviews.
func recompute(tx *gorm.DB, targetType, targetID string) error {
	var agg struct {
		Avg float64
		N   int64
	}
	if err := tx.Model(&domain.Review{}).
		Select("COALESCE(AVG(rating), 0) AS avg, COUNT(*) AS n").
		Where("target_type = ? AND target_id = ? AND status = ?", targetType, targetID, domain.ReviewVisible).
		Scan(&agg).Error; err != nil {
		return err
	}
	rating := math.Round(agg.Avg*10) / 10
	var model any = &domain.Product{}
	if targetType == domain.ReviewTargetArtisan {
		model = &domain.Artisan{}
	}
	return tx.Model(model).Where("id = ?", targetID).
		Updates(map[string]any{"rating": rating, "reviews_count": agg.N}).Error
}

// authorName shows a first name and last initial: "Ada Obi" becomes "Ada O.".
func authorName(full string) string {
	parts := strings.Fields(full)
	switch len(parts) {
	case 0:
		return "Customer"
	case 1:
		return parts[0]
	}
	last, _ := utf8.DecodeRuneInString(parts[len(parts)-1])
	return parts[0] + " " + strings.ToUpper(string(last)) + "."
}

type reviewRow struct {
	domain.Review
	AuthorName string
}

// List returns a listing's visible reviews, newest first.
func (s *Service) List(ctx context.Context, targetType, targetID string, limit, offset int) (*Page, error) {
	if !validTarget(targetType) || strings.TrimSpace(targetID) == "" {
		return nil, ErrInvalidReview
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	visible := func() *gorm.DB {
		return s.db.WithContext(ctx).Model(&domain.Review{}).
			Where("reviews.target_type = ? AND reviews.target_id = ? AND reviews.status = ?", targetType, targetID, domain.ReviewVisible)
	}
	var agg struct {
		Avg float64
		N   int64
	}
	if err := visible().Select("COALESCE(AVG(reviews.rating), 0) AS avg, COUNT(*) AS n").Scan(&agg).Error; err != nil {
		return nil, err
	}
	var rows []reviewRow
	if err := visible().
		Select("reviews.*, users.name AS author_name").
		Joins("LEFT JOIN users ON users.id = reviews.reviewer_id").
		Order("reviews.created_at DESC, reviews.id DESC").Limit(limit).Offset(offset).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	page := &Page{Reviews: make([]PublicReview, 0, len(rows)), Count: agg.N, Average: math.Round(agg.Avg*10) / 10}
	for _, r := range rows {
		page.Reviews = append(page.Reviews, PublicReview{
			ID: r.ID, Author: authorName(r.AuthorName), VerifiedBuyer: true, Rating: r.Rating,
			Date: r.CreatedAt.Format("2 Jan 2006"), Text: r.Body, Item: r.ItemName,
		})
	}
	return page, nil
}

// Reviewable lists what this buyer has earned a review for and not yet written.
func (s *Service) Reviewable(ctx context.Context, userID string) ([]Reviewable, error) {
	out := []Reviewable{}
	var prods []struct {
		ID   uint
		Name string
	}
	err := s.db.WithContext(ctx).Table("order_items oi").
		Select("DISTINCT p.id AS id, p.name AS name").
		Joins("JOIN orders o ON o.id = oi.order_id").
		Joins("JOIN products p ON p.id = oi.product_id").
		Joins("JOIN escrows e ON e.reference = oi.order_id AND e.kind = ? AND e.payee_id = p.seller_id", domain.EscrowKindOrder).
		Where("o.buyer_id = ? AND e.state = ? AND p.seller_id <> ?", userID, domain.EscrowReleased, userID).
		Scan(&prods).Error
	if err != nil {
		return nil, err
	}
	var done []domain.Review
	if err := s.db.WithContext(ctx).Where("reviewer_id = ?", userID).Find(&done).Error; err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, d := range done {
		seen[d.TargetType+":"+d.TargetID] = true
	}
	for _, p := range prods {
		id := strconv.FormatUint(uint64(p.ID), 10)
		if !seen["product:"+id] {
			out = append(out, Reviewable{TargetType: domain.ReviewTargetProduct, TargetID: id, Name: p.Name})
		}
	}
	var books []domain.Booking
	if err := s.db.WithContext(ctx).Joins("JOIN artisans a ON a.id = bookings.artisan_id").
		Where("bookings.buyer_id = ? AND bookings.status = ? AND a.user_id <> ?", userID, domain.BookingCompleted, userID).
		Order("bookings.booking_date DESC").Find(&books).Error; err != nil {
		return nil, err
	}
	for _, b := range books {
		id := strconv.FormatUint(uint64(b.ArtisanID), 10)
		if seen["artisan:"+id] {
			continue
		}
		seen["artisan:"+id] = true
		out = append(out, Reviewable{TargetType: domain.ReviewTargetArtisan, TargetID: id, Name: b.ServiceName})
	}
	return out, nil
}

// AdminList returns reviews of any state for moderation, newest first.
func (s *Service) AdminList(ctx context.Context, status string, limit, offset int) ([]AdminReview, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	scope := func() *gorm.DB {
		q := s.db.WithContext(ctx).Model(&domain.Review{})
		if status == domain.ReviewVisible || status == domain.ReviewHidden {
			q = q.Where("reviews.status = ?", status)
		}
		return q
	}
	var total int64
	if err := scope().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []reviewRow
	if err := scope().Select("reviews.*, users.name AS author_name").
		Joins("LEFT JOIN users ON users.id = reviews.reviewer_id").
		Order("reviews.created_at DESC, reviews.id DESC").Limit(limit).Offset(offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]AdminReview, 0, len(rows))
	for _, r := range rows {
		out = append(out, AdminReview{ID: r.ID, Author: r.AuthorName, TargetType: r.TargetType, TargetID: r.TargetID,
			TargetName: r.ItemName, Rating: r.Rating, Body: r.Body, Status: r.Status, CreatedAt: r.CreatedAt})
	}
	return out, total, nil
}

// SetStatus hides or restores a review and refreshes the listing's rating.
func (s *Service) SetStatus(ctx context.Context, id uint, status string) error {
	if status != domain.ReviewVisible && status != domain.ReviewHidden {
		return ErrInvalidReview
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var r domain.Review
		if err := tx.First(&r, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return err
		}
		if err := tx.Model(&r).Update("status", status).Error; err != nil {
			return err
		}
		return recompute(tx, r.TargetType, r.TargetID)
	})
}
