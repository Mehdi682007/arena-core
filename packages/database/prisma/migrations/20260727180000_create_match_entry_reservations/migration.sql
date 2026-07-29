ALTER TYPE "ledger_account_type" ADD VALUE 'MATCH_ESCROW';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'MATCH_ENTRY_RESERVATION';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'MATCH_ENTRY_REFUND';

CREATE TYPE "match_entry_reservation_status" AS ENUM (
  'NOT_REQUIRED',
  'RESERVED',
  'RELEASED',
  'REFUNDED',
  'CANCELLED',
  'EXPIRED',
  'FAILED'
);

CREATE TABLE "match_entry_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "wallet_id" UUID,
  "ledger_account_id" UUID,
  "escrow_account_id" UUID,
  "asset_code" VARCHAR(32) NOT NULL,
  "amount" BIGINT NOT NULL,
  "status" "match_entry_reservation_status" NOT NULL,
  "requirement_snapshot" JSONB NOT NULL,
  "reservation_snapshot" JSONB NOT NULL,
  "ledger_transaction_id" UUID,
  "refund_ledger_transaction_id" UUID,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reserved_at" TIMESTAMPTZ(3),
  "released_at" TIMESTAMPTZ(3),
  "refunded_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_entry_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_entry_reservations_asset_check" CHECK ("asset_code" = 'ARENA_POINT'),
  CONSTRAINT "match_entry_reservations_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "match_entry_reservations_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_entry_reservations_fingerprint_check"
    CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "match_entry_reservations_requirement_snapshot_check"
    CHECK (jsonb_typeof("requirement_snapshot") = 'object'),
  CONSTRAINT "match_entry_reservations_reservation_snapshot_check"
    CHECK (jsonb_typeof("reservation_snapshot") = 'object'),
  CONSTRAINT "match_entry_reservations_required_fields_check" CHECK (
    ("status" = 'NOT_REQUIRED' AND "amount" = 0 AND "wallet_id" IS NULL
      AND "ledger_account_id" IS NULL AND "escrow_account_id" IS NULL
      AND "ledger_transaction_id" IS NULL AND "reserved_at" IS NULL)
    OR
    ("status" <> 'NOT_REQUIRED' AND "amount" > 0 AND "wallet_id" IS NOT NULL
      AND "ledger_account_id" IS NOT NULL AND "escrow_account_id" IS NOT NULL
      AND "ledger_transaction_id" IS NOT NULL AND "reserved_at" IS NOT NULL)
  ),
  CONSTRAINT "match_entry_reservations_release_timestamp_check"
    CHECK (("status" = 'RELEASED') = ("released_at" IS NOT NULL)),
  CONSTRAINT "match_entry_reservations_refund_timestamp_check"
    CHECK (("status" = 'REFUNDED') = ("refunded_at" IS NOT NULL)),
  CONSTRAINT "match_entry_reservations_refund_transaction_check"
    CHECK (("status" = 'REFUNDED') = ("refund_ledger_transaction_id" IS NOT NULL)),
  CONSTRAINT "match_entry_reservations_cancel_timestamp_check"
    CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "match_entry_reservations_idempotency_key"
  ON "match_entry_reservations"("idempotency_key");
CREATE UNIQUE INDEX "match_entry_reservations_match_participant_key"
  ON "match_entry_reservations"("match_id", "participant_id");
CREATE INDEX "match_entry_reservations_user_created_idx"
  ON "match_entry_reservations"("user_id", "created_at");
CREATE INDEX "match_entry_reservations_match_status_idx"
  ON "match_entry_reservations"("match_id", "status");
CREATE INDEX "match_entry_reservations_status_expires_idx"
  ON "match_entry_reservations"("status", "expires_at");
CREATE INDEX "match_entry_reservations_escrow_account_idx"
  ON "match_entry_reservations"("escrow_account_id");

ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_participant_match_fkey"
  FOREIGN KEY ("participant_id", "match_id")
  REFERENCES "match_participants"("id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_escrow_account_id_fkey"
  FOREIGN KEY ("escrow_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_ledger_transaction_id_fkey"
  FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations"
  ADD CONSTRAINT "match_entry_reservations_refund_ledger_transaction_id_fkey"
  FOREIGN KEY ("refund_ledger_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
