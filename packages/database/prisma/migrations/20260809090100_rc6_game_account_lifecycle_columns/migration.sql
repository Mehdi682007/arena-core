ALTER TABLE "user_game_accounts"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN "submitted_at" TIMESTAMPTZ(3),
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
  ADD COLUMN "reviewed_by_user_id" UUID,
  ADD COLUMN "rejection_reason_code" VARCHAR(64),
  ADD COLUMN "review_message" VARCHAR(500),
  ADD COLUMN "suspension_reason_code" VARCHAR(64),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

UPDATE "user_game_accounts"
SET "submitted_at" = "created_at"
WHERE "status" <> 'DRAFT' AND "submitted_at" IS NULL;

ALTER TABLE "user_game_accounts"
  ADD CONSTRAINT "user_game_accounts_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "user_game_accounts_reviewer_reviewed_idx"
  ON "user_game_accounts"("reviewed_by_user_id", "reviewed_at");
CREATE INDEX "user_game_accounts_deleted_at_idx"
  ON "user_game_accounts"("deleted_at");

DROP INDEX IF EXISTS "user_game_accounts_active_user_platform_key";
DROP INDEX IF EXISTS "user_game_accounts_active_platform_handle_key";
DROP INDEX IF EXISTS "user_game_accounts_primary_user_game_key";

CREATE UNIQUE INDEX "user_game_accounts_active_user_platform_key"
  ON "user_game_accounts"("user_id", "game_platform_id")
  WHERE "status" IN ('DRAFT', 'PENDING', 'VERIFIED', 'CHANGES_REQUESTED', 'SUSPENDED')
    AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "user_game_accounts_active_platform_handle_key"
  ON "user_game_accounts"("game_platform_id", "normalized_handle")
  WHERE "status" IN ('DRAFT', 'PENDING', 'VERIFIED', 'CHANGES_REQUESTED', 'SUSPENDED')
    AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "user_game_accounts_primary_user_game_key"
  ON "user_game_accounts"("user_id", "game_id")
  WHERE "is_primary" = true AND "status" = 'VERIFIED' AND "deleted_at" IS NULL;
