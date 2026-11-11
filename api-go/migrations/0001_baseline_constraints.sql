-- Migration 0001: baseline constraints
-- These are also applied at startup by EnsureLedgerGuards / walletGuardSQL,
-- so this file is safe to run on an existing database (all statements are
-- idempotent via IF NOT EXISTS / CREATE OR REPLACE).

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
-- Prevents two concurrent retries from both creating an order.
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
