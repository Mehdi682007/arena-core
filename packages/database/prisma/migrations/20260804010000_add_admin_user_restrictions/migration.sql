-- Add an explicit permanent administrative restriction state.
--
-- Existing DISABLED and DELETED states are retained because they have
-- different lifecycle semantics and may already be referenced by data.

ALTER TYPE "user_status"
ADD VALUE IF NOT EXISTS 'BANNED';

ALTER TABLE "users"
ADD COLUMN "status_changed_at" TIMESTAMPTZ(3),
ADD COLUMN "suspended_until" TIMESTAMPTZ(3),
ADD COLUMN "restriction_reason_code" VARCHAR(64),
ADD COLUMN "restriction_note" VARCHAR(500);

CREATE INDEX "users_status_suspended_until_idx"
ON "users" ("status", "suspended_until");