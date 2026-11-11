-- Migration 0001: baseline constraints
-- These are also applied at startup by EnsureLedgerGuards / walletGuardSQL
-- (api-go/internal/escrow/ledgerguard.go, the source of truth for the ledger and
-- wallet rules; keep this copy in step with it). The idempotency index is also
-- created by AutoMigrate from the struct tag in domain/idempotency.go. Every
-- statement is idempotent, so this file is safe to run on an existing database.
--
-- ROLLBACK:
--   ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_amount_positive;
--   DROP TRIGGER IF EXISTS ledger_entries_no_change ON ledger_entries;
--   DROP TRIGGER IF EXISTS ledger_entries_no_truncate ON ledger_entries;
--   DROP FUNCTION IF EXISTS ledger_entries_append_only();
--   ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_non_negative;
--   DROP INDEX IF EXISTS idx_idem_key_user_op;

-- Ledger: amount must be positive.
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

-- Ledger: append-only trigger.
CREATE OR REPLACE FUNCTION ledger_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed', TG_OP
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

-- Wallet: balance cannot go negative.
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

-- Idempotency: unique index on (key, user_id, operation).
-- The order handler claims a key by inserting a row BEFORE it creates the order,
-- and this index makes the database pick exactly one winner when two requests
-- arrive together (see api-go/internal/order/idempotency.go).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_idem_key_user_op'
  ) THEN
    CREATE UNIQUE INDEX idx_idem_key_user_op
      ON idempotency_records (key, user_id, operation);
  END IF;
END $$;
