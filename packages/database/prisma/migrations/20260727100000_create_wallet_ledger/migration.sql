CREATE TYPE "wallet_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "ledger_account_type" AS ENUM ('USER_AVAILABLE', 'SYSTEM_ISSUANCE', 'SYSTEM_ADJUSTMENT');
CREATE TYPE "ledger_account_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "ledger_transaction_type" AS ENUM ('ISSUANCE', 'ADMIN_ADJUSTMENT', 'REVERSAL');
CREATE TYPE "ledger_transaction_status" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "ledger_entry_direction" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "wallet_audit_action" AS ENUM
  ('WALLET_CREATED', 'POINTS_ISSUED', 'BALANCE_ADJUSTED', 'TRANSACTION_REVERSED',
   'RECONCILIATION_CHECKED', 'RECONCILIATION_MISMATCH');

CREATE TABLE "wallets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "status" "wallet_status" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "closed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallets_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "wallets_version_check" CHECK ("version" > 0),
  CONSTRAINT "wallets_closed_check" CHECK (
    ("status" = 'CLOSED' AND "closed_at" IS NOT NULL) OR
    ("status" IN ('ACTIVE', 'SUSPENDED') AND "closed_at" IS NULL)
  )
);

CREATE TABLE "ledger_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wallet_id" UUID,
  "asset_code" VARCHAR(32) NOT NULL,
  "type" "ledger_account_type" NOT NULL,
  "status" "ledger_account_status" NOT NULL DEFAULT 'ACTIVE',
  "system_key" VARCHAR(64),
  "current_balance" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "closed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_accounts_asset_check" CHECK ("asset_code" = 'ARENA_POINT'),
  CONSTRAINT "ledger_accounts_version_check" CHECK ("version" > 0),
  CONSTRAINT "ledger_accounts_owner_type_check" CHECK (
    ("type" = 'USER_AVAILABLE' AND "wallet_id" IS NOT NULL AND "system_key" IS NULL AND "current_balance" >= 0)
    OR
    ("type" IN ('SYSTEM_ISSUANCE', 'SYSTEM_ADJUSTMENT') AND "wallet_id" IS NULL AND "system_key" IS NOT NULL)
  ),
  CONSTRAINT "ledger_accounts_closed_check" CHECK (
    ("status" = 'CLOSED' AND "closed_at" IS NOT NULL) OR
    ("status" IN ('ACTIVE', 'SUSPENDED') AND "closed_at" IS NULL)
  )
);

CREATE TABLE "ledger_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ledger_transaction_type" NOT NULL,
  "status" "ledger_transaction_status" NOT NULL DEFAULT 'POSTED',
  "asset_code" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reference_type" VARCHAR(32) NOT NULL,
  "reference_id" VARCHAR(128),
  "description" VARCHAR(200),
  "internal_note" VARCHAR(500),
  "created_by_user_id" UUID NOT NULL,
  "reverses_transaction_id" UUID,
  "posted_at" TIMESTAMPTZ(3) NOT NULL,
  "reversed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_transactions_idempotency_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "ledger_transactions_reverses_key" UNIQUE ("reverses_transaction_id"),
  CONSTRAINT "ledger_transactions_asset_check" CHECK ("asset_code" = 'ARENA_POINT'),
  CONSTRAINT "ledger_transactions_idempotency_format_check"
    CHECK ("idempotency_key" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  CONSTRAINT "ledger_transactions_fingerprint_check"
    CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ledger_transactions_reference_check"
    CHECK ("reference_type" IN ('ADMIN_ADJUSTMENT', 'SYSTEM_ISSUANCE', 'MANUAL_TEST')),
  CONSTRAINT "ledger_transactions_reversal_check" CHECK (
    ("type" = 'REVERSAL' AND "reverses_transaction_id" IS NOT NULL)
    OR ("type" <> 'REVERSAL' AND "reverses_transaction_id" IS NULL)
  ),
  CONSTRAINT "ledger_transactions_status_check" CHECK (
    ("status" = 'POSTED' AND "reversed_at" IS NULL)
    OR ("status" = 'REVERSED' AND "reversed_at" IS NOT NULL)
  )
);

CREATE TABLE "ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "direction" "ledger_entry_direction" NOT NULL,
  "amount" BIGINT NOT NULL,
  "balance_after" BIGINT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_transaction_sequence_key" UNIQUE ("transaction_id", "sequence"),
  CONSTRAINT "ledger_entries_transaction_account_key" UNIQUE ("transaction_id", "account_id"),
  CONSTRAINT "ledger_entries_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "ledger_entries_sequence_check" CHECK ("sequence" > 0)
);

CREATE TABLE "wallet_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wallet_id" UUID,
  "actor_user_id" UUID NOT NULL,
  "action" "wallet_audit_action" NOT NULL,
  "reason_code" VARCHAR(64) NOT NULL,
  "transaction_id" UUID,
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_audit_events_reason_check" CHECK (length(trim("reason_code")) > 0)
);

CREATE UNIQUE INDEX "ledger_accounts_wallet_asset_type_key"
  ON "ledger_accounts" ("wallet_id", "asset_code", "type") WHERE "wallet_id" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_accounts_system_asset_key"
  ON "ledger_accounts" ("system_key", "asset_code") WHERE "system_key" IS NOT NULL;
CREATE INDEX "wallets_status_created_idx" ON "wallets" ("status", "created_at");
CREATE INDEX "ledger_accounts_wallet_status_idx" ON "ledger_accounts" ("wallet_id", "status");
CREATE INDEX "ledger_accounts_type_asset_idx" ON "ledger_accounts" ("type", "asset_code");
CREATE INDEX "ledger_transactions_type_posted_idx" ON "ledger_transactions" ("type", "posted_at");
CREATE INDEX "ledger_transactions_actor_posted_idx"
  ON "ledger_transactions" ("created_by_user_id", "posted_at");
CREATE INDEX "ledger_transactions_reference_idx"
  ON "ledger_transactions" ("reference_type", "reference_id");
CREATE INDEX "ledger_entries_account_created_idx" ON "ledger_entries" ("account_id", "created_at");
CREATE INDEX "wallet_audit_events_wallet_created_idx"
  ON "wallet_audit_events" ("wallet_id", "created_at");
CREATE INDEX "wallet_audit_events_actor_created_idx"
  ON "wallet_audit_events" ("actor_user_id", "created_at");
CREATE INDEX "wallet_audit_events_transaction_idx" ON "wallet_audit_events" ("transaction_id");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_actor_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reverses_fkey"
  FOREIGN KEY ("reverses_transaction_id") REFERENCES "ledger_transactions" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "ledger_accounts" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_audit_events" ADD CONSTRAINT "wallet_audit_events_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_audit_events" ADD CONSTRAINT "wallet_audit_events_actor_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_balanced_ledger_transaction() RETURNS TRIGGER AS $$
DECLARE debit_total BIGINT; credit_total BIGINT; entry_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
         COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0),
         COUNT(*)
    INTO debit_total, credit_total, entry_count
    FROM ledger_entries WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);
  IF entry_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'ledger transaction must contain balanced debit and credit entries'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced_transaction_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction();

CREATE FUNCTION prevent_posted_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'posted ledger rows are immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entries_immutable_trigger"
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_ledger_mutation();
