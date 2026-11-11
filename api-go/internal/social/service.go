// Package social manages public user profiles (bio, avatar, handle).
package social

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

var (
	ErrHandleTaken   = errors.New("that handle is already taken")
	ErrHandleInvalid = errors.New("handle must be 3-30 characters: letters, numbers and underscores only")
	ErrURLInvalid    = errors.New("links must start with https:// and be reasonably short")
	ErrNotFound      = errors.New("profile not found")
)

const (
	maxAvatarURLLen = 500
	maxWebsiteLen   = 200
)

// validLink accepts an empty value or an https URL within the length limit. Any
// other scheme (javascript:, data:, http:) or a relative path is refused, since
// these values are shown to other people as links and images.
func validLink(raw string, max int) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true
	}
	if len(raw) > max {
		return false
	}
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.Host != ""
}

var handleRe = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Service struct{ db *gorm.DB }

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type UpdateInput struct {
	AvatarURL    string
	Bio          string
	SocialHandle string
	Website      string
}

func (s *Service) validate(in UpdateInput) error {
	h := strings.ToLower(strings.TrimSpace(in.SocialHandle))
	if h != "" && !handleRe.MatchString(h) {
		return ErrHandleInvalid
	}
	if len([]rune(in.Bio)) > 300 {
		return errors.New("bio must be 300 characters or fewer")
	}
	if !validLink(in.AvatarURL, maxAvatarURLLen) || !validLink(in.Website, maxWebsiteLen) {
		return ErrURLInvalid
	}
	return nil
}

// Upsert creates or updates the caller's profile.
func (s *Service) Upsert(ctx context.Context, userID string, in UpdateInput) (*domain.UserProfile, error) {
	if err := s.validate(in); err != nil {
		return nil, err
	}
	p := &domain.UserProfile{
		UserID:       userID,
		AvatarURL:    strings.TrimSpace(in.AvatarURL),
		Bio:          strings.TrimSpace(in.Bio),
		SocialHandle: strings.ToLower(strings.TrimSpace(in.SocialHandle)),
		Website:      strings.TrimSpace(in.Website),
	}
	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"avatar_url", "bio", "social_handle", "website", "updated_at"}),
		}).Create(p).Error
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, ErrHandleTaken
		}
		return nil, err
	}
	return p, nil
}

// GetByUserID returns the profile for a user, or nil if none exists yet.
func (s *Service) GetByUserID(ctx context.Context, userID string) (*domain.UserProfile, error) {
	var p domain.UserProfile
	if err := s.db.WithContext(ctx).First(&p, "user_id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// PublicProfile is the full public view of a user's profile page.
type PublicProfile struct {
	UserID       string       `json:"user_id"`
	Name         string       `json:"name"`
	Role         string       `json:"role"`
	Verified     bool         `json:"verified"`
	AvatarURL    string       `json:"avatar_url"`
	Bio          string       `json:"bio"`
	SocialHandle string       `json:"social_handle"`
	Website      string       `json:"website"`
	Stats        ProfileStats `json:"stats"`
}

// ProfileStats holds only what a person already shows publicly (their visible
// reviews). Order and booking counts are private activity and are not exposed.
type ProfileStats struct {
	Reviews int64 `json:"reviews"`
}

// GetPublic returns the public profile for a handle or user ID.
func (s *Service) GetPublic(ctx context.Context, handle string) (*PublicProfile, error) {
	var p domain.UserProfile
	err := s.db.WithContext(ctx).First(&p, "social_handle = ?", strings.ToLower(handle)).Error
	if errors.Is(err, gorm.ErrRecordNotFound) && uuidRe.MatchString(handle) {
		// Fall back to user ID lookup. Only for text shaped like an id: PostgreSQL
		// rejects anything else for a uuid column, which would turn an unknown
		// handle into a server error instead of "not found".
		err = s.db.WithContext(ctx).First(&p, "user_id = ?", handle).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var u domain.User
	if err := s.db.WithContext(ctx).Select("id", "name", "role", "verified").
		First(&u, "id = ?", p.UserID).Error; err != nil {
		return nil, err
	}

	var stats ProfileStats
	s.db.WithContext(ctx).Model(&domain.Review{}).
		Where("reviewer_id = ? AND status = 'visible'", p.UserID).Count(&stats.Reviews)
	return &PublicProfile{
		UserID: u.ID, Name: u.Name, Role: u.Role, Verified: u.Verified,
		AvatarURL: p.AvatarURL, Bio: p.Bio, SocialHandle: p.SocialHandle, Website: p.Website,
		Stats: stats,
	}, nil
}
