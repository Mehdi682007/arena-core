CREATE TYPE "game_account_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'DISCONNECTED');
CREATE TYPE "game_account_verification_method" AS ENUM ('UNVERIFIED', 'MANUAL');
CREATE TYPE "game_account_review_action" AS ENUM ('VERIFY', 'REJECT', 'SUSPEND', 'RESTORE', 'DISCONNECT');

CREATE TABLE "user_game_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "game_platform_id" UUID NOT NULL,
    "handle" VARCHAR(256) NOT NULL,
    "normalized_handle" VARCHAR(256) NOT NULL,
    "display_handle" VARCHAR(256) NOT NULL,
    "status" "game_account_status" NOT NULL DEFAULT 'PENDING',
    "verification_method" "game_account_verification_method" NOT NULL DEFAULT 'UNVERIFIED',
    "verification_metadata" JSONB,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "disconnected_at" TIMESTAMPTZ(3),
    "last_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_game_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_game_accounts_primary_verified_check" CHECK (NOT "is_primary" OR "status" = 'VERIFIED'),
    CONSTRAINT "user_game_accounts_status_timestamps_check" CHECK (
      ("status" <> 'VERIFIED' OR ("verified_at" IS NOT NULL AND "last_verified_at" IS NOT NULL)) AND
      ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL) AND
      ("status" <> 'SUSPENDED' OR "suspended_at" IS NOT NULL) AND
      ("status" <> 'DISCONNECTED' OR "disconnected_at" IS NOT NULL)
    )
);

CREATE TABLE "game_account_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_account_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" "game_account_review_action" NOT NULL,
    "reason_code" VARCHAR(64),
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_account_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_game_accounts_user_game_idx" ON "user_game_accounts"("user_id", "game_id");
CREATE INDEX "user_game_accounts_user_game_platform_idx" ON "user_game_accounts"("user_id", "game_platform_id");
CREATE INDEX "user_game_accounts_platform_handle_idx" ON "user_game_accounts"("game_platform_id", "normalized_handle");
CREATE INDEX "user_game_accounts_status_created_at_idx" ON "user_game_accounts"("status", "created_at");
CREATE INDEX "user_game_accounts_is_primary_idx" ON "user_game_accounts"("is_primary");
CREATE UNIQUE INDEX "user_game_accounts_primary_user_game_key" ON "user_game_accounts"("user_id", "game_id") WHERE "is_primary" = true;
CREATE UNIQUE INDEX "user_game_accounts_active_user_platform_key" ON "user_game_accounts"("user_id", "game_platform_id") WHERE "status" IN ('PENDING', 'VERIFIED', 'SUSPENDED');
CREATE UNIQUE INDEX "user_game_accounts_active_platform_handle_key" ON "user_game_accounts"("game_platform_id", "normalized_handle") WHERE "status" IN ('PENDING', 'VERIFIED', 'SUSPENDED');
CREATE INDEX "game_account_reviews_account_created_idx" ON "game_account_reviews"("game_account_id", "created_at");
CREATE INDEX "game_account_reviews_actor_idx" ON "game_account_reviews"("actor_user_id");
CREATE INDEX "game_account_reviews_action_idx" ON "game_account_reviews"("action");
CREATE INDEX "game_account_reviews_created_at_idx" ON "game_account_reviews"("created_at");

ALTER TABLE "user_game_accounts" ADD CONSTRAINT "user_game_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_game_accounts" ADD CONSTRAINT "user_game_accounts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_game_accounts" ADD CONSTRAINT "user_game_accounts_game_platform_game_fkey" FOREIGN KEY ("game_platform_id", "game_id") REFERENCES "game_platforms"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_account_reviews" ADD CONSTRAINT "game_account_reviews_account_id_fkey" FOREIGN KEY ("game_account_id") REFERENCES "user_game_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_account_reviews" ADD CONSTRAINT "game_account_reviews_actor_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
