package escrow

import (
	"fmt"

	"gorm.io/gorm"
)

// ledgerGuardSQL makes the ledger enforce its own rules in the database, so a
// code bug or a hand-typed SQL statement cannot quietly rewrite money history.
//
//   - amount must be positive. Added NOT VALID so rows written before this rule
//     are not re-checked (the migration cannot fail on old data); every new row
//     is checked.
//   - rows are append-only. UPDATE, DELETE and TRUNCATE are refused; a mistake is
//     corrected with a new reversing entry, never by editing history.
//
// Every statement is safe to run on each startup.
const ledgerGuardSQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ledger_entries_amount_positive'
      AND conrelid = 'ledger_entries'::regclass
  ) THEN
    ALTER TABLE ledger_entries
      ADD CONSTRAINT ledger_entries_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ledger_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed; post a reversing entry instead', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_no_change ON ledger_entries;
CREATE TRIGGER ledger_entries_no_change
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();

DROP TRIGGER IF EXISTS ledger_entries_no_truncate ON ledger_entries;
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_append_only();
`

// walletGuardSQL prevents the wallet balance from going negative at the
// database level. The application already checks balance >= amount before
// debiting, but under read-committed two concurrent withdrawals can both pass
// that check before either commits. The constraint is the last line of defence.
//
// NOT VALID skips re-checking existing rows (safe: no row should already be
// negative, but we do not want the migration to fail if one somehow is).
const walletGuardSQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallets_balance_non_negative'
      AND conrelid = 'wallets'::regclass
  ) THEN
    ALTER TABLE wallets
      ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0) NOT VALID;
  END IF;
END $$;
`

// EnsureLedgerGuards installs the ledger's database-level rules. Call it once
// at startup, after the table has been migrated. It does nothing on databases
// other than PostgreSQL (the unit tests use SQLite).
func EnsureLedgerGuards(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}
	if err := db.Exec(ledgerGuardSQL).Error; err != nil {
		return fmt.Errorf("install ledger guards: %w", err)
	}
	if err := db.Exec(walletGuardSQL).Error; err != nil {
		return fmt.Errorf("install wallet guard: %w", err)
	}
	return nil
}
