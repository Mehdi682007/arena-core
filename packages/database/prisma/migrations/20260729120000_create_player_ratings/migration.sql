CREATE TYPE "rating_outcome" AS ENUM ('WIN', 'LOSS', 'DRAW', 'VOID');
CREATE TYPE "match_rating_application_status" AS ENUM ('APPLIED', 'FAILED', 'REVERSED');

CREATE TABLE "player_ratings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "game_mode_id" UUID NOT NULL,
  "crossplay_group_id" UUID NOT NULL,
  "policy_key" VARCHAR(32) NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "matches_played" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "provisional_matches_played" INTEGER NOT NULL DEFAULT 0,
  "highest_rating" INTEGER NOT NULL,
  "lowest_rating" INTEGER NOT NULL,
  "last_match_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_ratings_rating_check" CHECK ("rating" BETWEEN 100 AND 3000 AND "highest_rating" BETWEEN 100 AND 3000 AND "lowest_rating" BETWEEN 100 AND 3000),
  CONSTRAINT "player_ratings_stats_check" CHECK ("matches_played" >= 0 AND "wins" >= 0 AND "losses" >= 0 AND "draws" >= 0 AND "wins" + "losses" + "draws" = "matches_played"),
  CONSTRAINT "player_ratings_provisional_check" CHECK ("provisional_matches_played" BETWEEN 0 AND "matches_played"),
  CONSTRAINT "player_ratings_range_check" CHECK ("highest_rating" >= "rating" AND "lowest_rating" <= "rating"),
  CONSTRAINT "player_ratings_policy_check" CHECK ("policy_key" = 'ELO' AND "policy_version" > 0 AND "version" > 0)
);

CREATE TABLE "match_rating_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "match_result_id" UUID NOT NULL,
  "status" "match_rating_application_status" NOT NULL,
  "policy_key" VARCHAR(32) NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "actor_user_id" UUID,
  "applied_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "failure_code" VARCHAR(64),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_rating_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_rating_applications_policy_check" CHECK ("policy_key" = 'ELO' AND "policy_version" > 0 AND "version" > 0),
  CONSTRAINT "match_rating_applications_fingerprint_check" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "match_rating_applications_state_check" CHECK (
    ("status" = 'APPLIED' AND "applied_at" IS NOT NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("status" = 'FAILED' AND "applied_at" IS NULL AND "failed_at" IS NOT NULL AND "failure_code" IS NOT NULL)
    OR ("status" = 'REVERSED' AND "applied_at" IS NOT NULL)
  )
);

CREATE TABLE "player_rating_changes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "player_rating_id" UUID NOT NULL,
  "rating_application_id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "match_result_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "opponent_user_id" UUID NOT NULL,
  "outcome" "rating_outcome" NOT NULL,
  "rating_before" INTEGER NOT NULL,
  "rating_after" INTEGER NOT NULL,
  "rating_delta" INTEGER NOT NULL,
  "opponent_rating_before" INTEGER NOT NULL,
  "policy_key" VARCHAR(32) NOT NULL,
  "policy_version" INTEGER NOT NULL,
  "calculation_snapshot" JSONB NOT NULL,
  "applied_at" TIMESTAMPTZ(3) NOT NULL,
  "reversed_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_rating_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_rating_changes_equation_check" CHECK ("rating_after" = "rating_before" + "rating_delta"),
  CONSTRAINT "player_rating_changes_bounds_check" CHECK ("rating_before" BETWEEN 100 AND 3000 AND "rating_after" BETWEEN 100 AND 3000 AND "opponent_rating_before" BETWEEN 100 AND 3000),
  CONSTRAINT "player_rating_changes_snapshot_check" CHECK (jsonb_typeof("calculation_snapshot") = 'object'),
  CONSTRAINT "player_rating_changes_policy_check" CHECK ("policy_key" = 'ELO' AND "policy_version" > 0 AND "version" > 0),
  CONSTRAINT "player_rating_changes_users_check" CHECK ("user_id" <> "opponent_user_id")
);

CREATE UNIQUE INDEX "player_ratings_scope_key" ON "player_ratings"("user_id", "game_id", "game_mode_id", "crossplay_group_id", "policy_key", "policy_version");
CREATE INDEX "player_ratings_user_idx" ON "player_ratings"("user_id");
CREATE INDEX "player_ratings_leaderboard_idx" ON "player_ratings"("game_id", "game_mode_id", "crossplay_group_id", "policy_key", "policy_version", "rating" DESC, "matches_played" DESC, "wins" DESC, "updated_at", "id");
CREATE INDEX "player_ratings_updated_idx" ON "player_ratings"("updated_at");
CREATE UNIQUE INDEX "match_rating_applications_match_id_key" ON "match_rating_applications"("match_id");
CREATE UNIQUE INDEX "match_rating_applications_result_id_key" ON "match_rating_applications"("match_result_id");
CREATE UNIQUE INDEX "match_rating_applications_idempotency_key" ON "match_rating_applications"("idempotency_key");
CREATE INDEX "match_rating_applications_status_created_idx" ON "match_rating_applications"("status", "created_at");
CREATE INDEX "match_rating_applications_failed_idx" ON "match_rating_applications"("failed_at");
CREATE INDEX "match_rating_applications_applied_idx" ON "match_rating_applications"("applied_at");
CREATE UNIQUE INDEX "player_rating_changes_match_user_key" ON "player_rating_changes"("match_id", "user_id");
CREATE INDEX "player_rating_changes_rating_applied_idx" ON "player_rating_changes"("player_rating_id", "applied_at");
CREATE INDEX "player_rating_changes_user_applied_idx" ON "player_rating_changes"("user_id", "applied_at");
CREATE INDEX "player_rating_changes_application_idx" ON "player_rating_changes"("rating_application_id");

ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_mode_game_fkey" FOREIGN KEY ("game_mode_id", "game_id") REFERENCES "game_modes"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_crossplay_game_fkey" FOREIGN KEY ("crossplay_group_id", "game_id") REFERENCES "crossplay_groups"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_rating_applications" ADD CONSTRAINT "match_rating_applications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_rating_applications" ADD CONSTRAINT "match_rating_applications_result_id_fkey" FOREIGN KEY ("match_result_id") REFERENCES "match_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_rating_applications" ADD CONSTRAINT "match_rating_applications_actor_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_rating_changes" ADD CONSTRAINT "player_rating_changes_rating_id_fkey" FOREIGN KEY ("player_rating_id") REFERENCES "player_ratings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_rating_changes" ADD CONSTRAINT "player_rating_changes_application_id_fkey" FOREIGN KEY ("rating_application_id") REFERENCES "match_rating_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_rating_changes" ADD CONSTRAINT "player_rating_changes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_rating_changes" ADD CONSTRAINT "player_rating_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "player_rating_changes" ADD CONSTRAINT "player_rating_changes_opponent_id_fkey" FOREIGN KEY ("opponent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
