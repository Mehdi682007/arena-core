ALTER TYPE "ledger_transaction_type" ADD VALUE IF NOT EXISTS 'MATCH_WINNER_SETTLEMENT';
ALTER TYPE "ledger_transaction_type" ADD VALUE IF NOT EXISTS 'MATCH_DRAW_REFUND';
ALTER TYPE "ledger_transaction_type" ADD VALUE IF NOT EXISTS 'MATCH_VOID_REFUND';
ALTER TYPE "match_entry_reservation_status" ADD VALUE IF NOT EXISTS 'SETTLED';

CREATE TYPE "match_entry_settlement_outcome" AS ENUM (
  'WINNER_CREDITED',
  'LOSER_CONTRIBUTED',
  'DRAW_REFUNDED',
  'VOID_REFUNDED'
);
CREATE TYPE "match_settlement_status" AS ENUM ('PENDING', 'SETTLED', 'REFUNDED', 'VOIDED', 'FAILED');
CREATE TYPE "match_settlement_type" AS ENUM (
  'WINNER_TAKES_ALL',
  'DRAW_REFUND',
  'VOID_REFUND',
  'ADMIN_CORRECTION'
);

ALTER TABLE "matches" ADD COLUMN "settlement_eligible_at" TIMESTAMPTZ(3);
ALTER TABLE "match_entry_reservations"
  ADD COLUMN "settlement_id" UUID,
  ADD COLUMN "settlement_outcome" "match_entry_settlement_outcome";

CREATE TABLE "match_settlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "asset_code" VARCHAR(32) NOT NULL,
  "status" "match_settlement_status" NOT NULL,
  "type" "match_settlement_type" NOT NULL,
  "total_escrow_amount" BIGINT NOT NULL,
  "distributed_amount" BIGINT NOT NULL,
  "refunded_amount" BIGINT NOT NULL,
  "retained_amount" BIGINT NOT NULL DEFAULT 0,
  "winner_participant_id" UUID,
  "result_id" UUID,
  "dispute_id" UUID,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "settlement_transaction_id" UUID,
  "settled_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "failure_code" VARCHAR(64),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_settlements_asset_check" CHECK ("asset_code" = 'ARENA_POINT'),
  CONSTRAINT "match_settlements_amounts_check" CHECK (
    "total_escrow_amount" >= 0 AND "distributed_amount" >= 0 AND
    "refunded_amount" >= 0 AND "retained_amount" = 0 AND
    "total_escrow_amount" = "distributed_amount" + "refunded_amount" + "retained_amount"
  ),
  CONSTRAINT "match_settlements_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_settlements_fingerprint_check" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "match_settlements_terminal_check" CHECK (
    ("status" IN ('SETTLED', 'REFUNDED') AND "settled_at" IS NOT NULL AND "settlement_transaction_id" IS NOT NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("status" = 'FAILED' AND "failed_at" IS NOT NULL AND "settled_at" IS NULL AND "settlement_transaction_id" IS NULL)
    OR ("status" IN ('PENDING', 'VOIDED') AND "failed_at" IS NULL)
  ),
  CONSTRAINT "match_settlements_winner_check" CHECK (
    ("type" = 'WINNER_TAKES_ALL' AND "winner_participant_id" IS NOT NULL AND "distributed_amount" = "total_escrow_amount" AND "refunded_amount" = 0)
    OR ("type" IN ('DRAW_REFUND', 'VOID_REFUND') AND "winner_participant_id" IS NULL AND "distributed_amount" = 0 AND "refunded_amount" = "total_escrow_amount")
    OR ("type" = 'ADMIN_CORRECTION')
  )
);

CREATE UNIQUE INDEX "match_settlements_match_id_key" ON "match_settlements"("match_id");
CREATE UNIQUE INDEX "match_settlements_idempotency_key" ON "match_settlements"("idempotency_key");
CREATE UNIQUE INDEX "match_settlements_transaction_id_key" ON "match_settlements"("settlement_transaction_id");
CREATE INDEX "match_settlements_result_idx" ON "match_settlements"("result_id");
CREATE INDEX "match_settlements_dispute_idx" ON "match_settlements"("dispute_id");
CREATE INDEX "match_settlements_status_created_idx" ON "match_settlements"("status", "created_at");
CREATE INDEX "match_settlements_type_idx" ON "match_settlements"("type");
CREATE INDEX "match_settlements_winner_idx" ON "match_settlements"("winner_participant_id");
CREATE INDEX "match_settlements_settled_idx" ON "match_settlements"("settled_at");
CREATE INDEX "matches_status_settlement_eligible_idx" ON "matches"("status", "settlement_eligible_at");
CREATE INDEX "match_entry_reservations_settlement_idx" ON "match_entry_reservations"("settlement_id");

ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_winner_match_fkey"
  FOREIGN KEY ("winner_participant_id", "match_id") REFERENCES "match_participants"("id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_result_id_fkey"
  FOREIGN KEY ("result_id") REFERENCES "match_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_dispute_id_fkey"
  FOREIGN KEY ("dispute_id") REFERENCES "match_disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_transaction_id_fkey"
  FOREIGN KEY ("settlement_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_entry_reservations" ADD CONSTRAINT "match_entry_reservations_settlement_id_fkey"
  FOREIGN KEY ("settlement_id") REFERENCES "match_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_entry_reservations" ADD CONSTRAINT "match_entry_reservations_settlement_state_check" CHECK (
  ("settlement_id" IS NULL AND "settlement_outcome" IS NULL)
  OR ("settlement_id" IS NOT NULL AND "settlement_outcome" IS NOT NULL AND "status" IN ('SETTLED', 'REFUNDED'))
);
