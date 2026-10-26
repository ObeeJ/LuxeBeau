package admin

import (
	"context"
	"fmt"
	"log/slog"

	"luxebeau/internal/domain"
)

type Service struct {
	repo   Repository
	logger *slog.Logger
}

func NewService(repo Repository, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) ListUsers(ctx context.Context, f UserFilter) ([]domain.User, error) {
	return s.repo.ListUsers(ctx, f)
}

func (s *Service) GetUser(ctx context.Context, id string) (*domain.User, error) {
	return s.repo.GetUser(ctx, id)
}

// UpdateUser applies an admin patch. Guards protect the platform: another admin
// cannot be demoted or suspended through this surface, and a user can never be
// promoted to admin here (admins are provisioned out-of-band).
func (s *Service) UpdateUser(ctx context.Context, actorID, id string, u UserUpdate) (*domain.User, error) {
	target, err := s.repo.GetUser(ctx, id)
	if err != nil {
		return nil, err
	}
	if target == nil {
		return nil, fmt.Errorf("user not found")
	}
	if u.Role != nil && *u.Role == "admin" {
		return nil, fmt.Errorf("cannot grant admin role through this surface")
	}
	if target.Role == "admin" && id != actorID {
		return nil, fmt.Errorf("cannot modify another administrator")
	}

	updated, err := s.repo.UpdateUser(ctx, id, u)
	if err != nil {
		return nil, err
	}

	// Keep the artisan profile's verified badge in sync with the user record.
	if u.Verified != nil && updated != nil && updated.Role == "artisan" {
		if err := s.repo.SetArtisanVerified(ctx, id, *u.Verified); err != nil {
			s.logger.Warn("failed to sync artisan verified flag", slog.String("user", id), slog.Any("error", err))
		}
	}
	return updated, nil
}

func (s *Service) ListApplications(ctx context.Context) ([]Application, error) {
	return s.repo.ListApplications(ctx)
}

// VerifyUser approves a seller/artisan: records the CAC number, sets the
// verified badge and marks KYC verified.
func (s *Service) VerifyUser(ctx context.Context, id, cacNumber string) (*domain.User, error) {
	target, err := s.repo.GetUser(ctx, id)
	if err != nil {
		return nil, err
	}
	if target == nil {
		return nil, fmt.Errorf("user not found")
	}
	verified := true
	kyc := "verified"
	patch := UserUpdate{Verified: &verified, KYCStatus: &kyc}
	if cacNumber != "" {
		patch.CACNumber = &cacNumber
	}
	updated, err := s.repo.UpdateUser(ctx, id, patch)
	if err != nil {
		return nil, err
	}
	if updated != nil && updated.Role == "artisan" {
		if err := s.repo.SetArtisanVerified(ctx, id, true); err != nil {
			s.logger.Warn("failed to sync artisan verified flag", slog.String("user", id), slog.Any("error", err))
		}
	}
	return updated, nil
}

func (s *Service) DeleteUser(ctx context.Context, actorID, id string) error {
	if id == actorID {
		return fmt.Errorf("you cannot delete your own account")
	}
	target, err := s.repo.GetUser(ctx, id)
	if err != nil {
		return err
	}
	if target == nil {
		return fmt.Errorf("user not found")
	}
	if target.Role == "admin" {
		return fmt.Errorf("cannot delete another administrator")
	}
	return s.repo.DeleteUser(ctx, id)
}

func (s *Service) ListProducts(ctx context.Context, jurisdiction string) ([]domain.Product, error) {
	return s.repo.ListProducts(ctx, jurisdiction)
}

func (s *Service) DeleteProduct(ctx context.Context, id uint) error {
	return s.repo.DeleteProduct(ctx, id)
}

func (s *Service) ListOrders(ctx context.Context) ([]domain.Order, error) {
	return s.repo.ListOrders(ctx)
}

func (s *Service) ListBookings(ctx context.Context) ([]domain.Booking, error) {
	return s.repo.ListBookings(ctx)
}
