# Database migrations

## Strategy

AutoMigrate (GORM) handles table and column creation at startup — it is additive only and safe for the free Render plan where there is no pre-deploy hook.

This folder holds **constraint and index migrations** that AutoMigrate cannot express, plus any future destructive changes (column renames, type changes, data backfills). Each file is numbered and idempotent.

## Running

Apply manually via the Supabase SQL editor or psql:

```bash
psql "$DATABASE_URL" -f migrations/0001_baseline_constraints.sql
```

Or run all in order:

```bash
for f in api-go/migrations/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -f "$f"
done
```

## Rollback

Each migration file includes a comment describing how to reverse it. For constraint additions, the rollback is:

```sql
ALTER TABLE <table> DROP CONSTRAINT <name>;
DROP INDEX IF EXISTS <name>;
```

## Adding a new migration

1. Create `NNNN_description.sql` (next number in sequence).
2. Make every statement idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO $$ BEGIN IF NOT EXISTS ...`).
3. Add a rollback comment at the top.
4. Apply to production before or alongside the code deploy that needs it.
