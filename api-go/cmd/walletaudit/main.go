// Command walletaudit lists wallets whose balance isn't explained by the
// escrow ledger and wallet-paid orders. It is read-only: the whole run is one
// read-only transaction, and it changes nothing.
//
//	DATABASE_URL=postgres://... go run ./cmd/walletaudit [-all] [-json]
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"luxebeau/internal/audit"
)

func naira(kobo int64) string {
	sign := ""
	if kobo < 0 {
		sign, kobo = "-", -kobo
	}
	return fmt.Sprintf("%s₦%d.%02d", sign, kobo/100, kobo%100)
}

func main() {
	all := flag.Bool("all", false, "list every wallet, not only unexplained ones")
	asJSON := flag.Bool("json", false, "print JSON instead of a table")
	flag.Parse()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required (this tool never guesses which database to audit)")
		os.Exit(2)
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot connect:", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	var findings []audit.WalletFinding
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SET TRANSACTION READ ONLY").Error; err != nil {
			return err
		}
		var err error
		findings, err = audit.Wallets(ctx, tx)
		return err
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "audit failed:", err)
		os.Exit(1)
	}
	listed := findings
	if !*all {
		listed = audit.Unexplained(findings)
	}

	if *asJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(listed)
		return
	}

	var unexplained int64
	for _, f := range audit.Unexplained(findings) {
		if f.Difference > 0 {
			unexplained += f.Difference
		}
	}
	fmt.Printf("%d wallets checked, %d with a difference. Money with no record: %s\n\n", len(findings), len(audit.Unexplained(findings)), naira(unexplained))
	if len(listed) == 0 {
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "USER\tEMAIL\tBALANCE\tEXPLAINED\tDIFFERENCE")
	for _, f := range listed {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", f.UserID, f.Email, naira(f.Balance), naira(f.Expected), naira(f.Difference))
	}
	w.Flush()
	fmt.Println("\nA positive difference is money in the wallet that no escrow release, refund or order explains.")
}
