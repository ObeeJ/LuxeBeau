// Package revenue answers "how much has LuxeBeau earned?" for the admin
// dashboard. It only reads.
//
// LuxeBeau's own revenue is the platform fee (paid by buyers), plus ad
// payments, less any platform fee given back on a fully refunded order. The
// payment gateway's processing fee is collected from the buyer but belongs to
// the gateway, so it is reported separately and never counted as revenue.
//
// Days, weeks and months are Lagos days (WAT, UTC+1, no daylight saving): a sale
// at 00:30 in Lagos counts on that day, not the previous UTC day. Weeks start on
// Monday.
package revenue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/audit"
	"luxebeau/internal/domain"
)

var (
	ErrInvalidRange = errors.New("invalid date range")
	ErrInvalidGroup = errors.New("invalid group")
)

const (
	maxDays = 366
	// vatBps is the VAT rate assumed to be inside net revenue. It is an
	// estimate for the dashboard, not a tax computation.
	vatBps = 750
)

// Lagos is the time zone revenue days are counted in.
var Lagos = time.FixedZone("WAT", 3600)

type Totals struct {
	PlatformFees            int64 `json:"platform_fees"`
	AdRevenue               int64 `json:"ad_revenue"`
	FeeRefunds              int64 `json:"fee_refunds"`
	Net                     int64 `json:"net"`
	EstimatedVAT            int64 `json:"estimated_vat"`
	ProcessingFeesCollected int64 `json:"processing_fees_collected"`
	OrdersPaid              int64 `json:"orders_paid"`
	AdsPaid                 int64 `json:"ads_paid"`
}

type Point struct {
	Period       string `json:"period"`
	PlatformFees int64  `json:"platform_fees"`
	AdRevenue    int64  `json:"ad_revenue"`
	FeeRefunds   int64  `json:"fee_refunds"`
	Net          int64  `json:"net"`
}

type RangeInfo struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Group string `json:"group"`
}

type Health struct {
	UnbalancedEscrows int `json:"unbalanced_escrows"`
}

type Summary struct {
	Range  RangeInfo `json:"range"`
	Totals Totals    `json:"totals"`
	Series []Point   `json:"series"`
	Health Health    `json:"health"`
}

// bucket names the period a moment falls in.
func bucket(t time.Time, group string) string {
	t = t.In(Lagos)
	switch group {
	case "month":
		return t.Format("2006-01")
	case "week":
		back := (int(t.Weekday()) + 6) % 7 // days since Monday
		return t.AddDate(0, 0, -back).Format("2006-01-02")
	}
	return t.Format("2006-01-02")
}

// Build summarises revenue from the first date to the last (both inclusive,
// YYYY-MM-DD, Lagos days), grouped by "day", "week" or "month".
func Build(ctx context.Context, db *gorm.DB, from, to, group string) (*Summary, error) {
	switch group {
	case "day", "week", "month":
	default:
		return nil, ErrInvalidGroup
	}
	start, err := time.ParseInLocation("2006-01-02", from, Lagos)
	if err != nil {
		return nil, fmt.Errorf("%w: from %q", ErrInvalidRange, from)
	}
	last, err := time.ParseInLocation("2006-01-02", to, Lagos)
	if err != nil {
		return nil, fmt.Errorf("%w: to %q", ErrInvalidRange, to)
	}
	if last.Before(start) {
		return nil, fmt.Errorf("%w: the end is before the start", ErrInvalidRange)
	}
	end := last.AddDate(0, 0, 1) // exclusive
	if end.Sub(start) > maxDays*24*time.Hour {
		return nil, fmt.Errorf("%w: more than %d days", ErrInvalidRange, maxDays)
	}

	// An entry for every period in the range, so empty ones show as zero.
	var series []Point
	index := map[string]int{}
	for cur := start; cur.Before(end); cur = cur.AddDate(0, 0, 1) {
		key := bucket(cur, group)
		if _, ok := index[key]; !ok {
			index[key] = len(series)
			series = append(series, Point{Period: key})
		}
	}

	var rows []struct {
		Type      string
		Amount    int64
		CreatedAt time.Time
	}
	if err := db.WithContext(ctx).Model(&domain.LedgerEntry{}).
		Select("type, amount, created_at").
		Where("created_at >= ? AND created_at < ?", start.UTC(), end.UTC()).
		Where("(type IN ? AND to_account = ?) OR type IN ?", []string{"fee", "ad"}, "platform", []string{"fee_refund", "processing"}).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	var tot Totals
	for _, r := range rows {
		p := &series[index[bucket(r.CreatedAt, group)]]
		switch r.Type {
		case "fee":
			tot.PlatformFees += r.Amount
			p.PlatformFees += r.Amount
		case "ad":
			tot.AdRevenue += r.Amount
			p.AdRevenue += r.Amount
		case "fee_refund":
			tot.FeeRefunds += r.Amount
			p.FeeRefunds += r.Amount
		case "processing":
			tot.ProcessingFeesCollected += r.Amount
		}
	}
	for i := range series {
		series[i].Net = series[i].PlatformFees + series[i].AdRevenue - series[i].FeeRefunds
	}
	tot.Net = tot.PlatformFees + tot.AdRevenue - tot.FeeRefunds
	if tot.Net > 0 {
		tot.EstimatedVAT = tot.Net * vatBps / (10000 + vatBps)
	}

	if err := db.WithContext(ctx).Model(&domain.Order{}).
		Where("payment_status = ? AND created_at >= ? AND created_at < ?", "paid", start.UTC(), end.UTC()).
		Count(&tot.OrdersPaid).Error; err != nil {
		return nil, err
	}
	if err := db.WithContext(ctx).Model(&domain.FeaturedAd{}).
		Where("paid_at >= ? AND paid_at < ?", start.UTC(), end.UTC()).
		Count(&tot.AdsPaid).Error; err != nil {
		return nil, err
	}

	escrows, err := audit.Escrows(ctx, db)
	if err != nil {
		return nil, err
	}

	return &Summary{
		Range:  RangeInfo{From: from, To: to, Group: group},
		Totals: tot,
		Series: series,
		Health: Health{UnbalancedEscrows: len(audit.Broken(escrows))},
	}, nil
}
