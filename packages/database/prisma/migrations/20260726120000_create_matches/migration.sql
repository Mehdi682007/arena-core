CREATE TYPE "match_status" AS ENUM ('CREATED', 'AWAITING_READY', 'READY', 'CANCELLED', 'EXPIRED', 'VOIDED');
CREATE TYPE "match_participant_side" AS ENUM ('SIDE_A', 'SIDE_B');
CREATE TYPE "match_participant_status" AS ENUM ('PENDING', 'READY', 'CANCELLED');
CREATE TYPE "match_audit_action" AS ENUM ('CREATED', 'USER_CANCELLED', 'EXPIRED', 'ADMIN_VOIDED');

CREATE TABLE "matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "matchmaking_proposal_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "game_mode_id" UUID NOT NULL,
  "game_ruleset_id" UUID NOT NULL,
  "crossplay_group_id" UUID NOT NULL,
  "status" "match_status" NOT NULL DEFAULT 'CREATED',
  "game_snapshot" JSONB NOT NULL,
  "mode_snapshot" JSONB NOT NULL,
  "ruleset_snapshot" JSONB NOT NULL,
  "crossplay_snapshot" JSONB NOT NULL,
  "ready_deadline_at" TIMESTAMPTZ(3) NOT NULL,
  "scheduled_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "voided_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matches_proposal_id_key" UNIQUE ("matchmaking_proposal_id"),
  CONSTRAINT "matches_ready_deadline_check" CHECK ("ready_deadline_at" > "created_at"),
  CONSTRAINT "matches_version_check" CHECK ("version" > 0),
  CONSTRAINT "matches_snapshots_object_check" CHECK (
    jsonb_typeof("game_snapshot") = 'object' AND
    jsonb_typeof("mode_snapshot") = 'object' AND
    jsonb_typeof("ruleset_snapshot") = 'object' AND
    jsonb_typeof("crossplay_snapshot") = 'object'
  ),
  CONSTRAINT "matches_snapshot_version_check" CHECK (
    "game_snapshot"->>'schemaVersion' = '1' AND
    "mode_snapshot"->>'schemaVersion' = '1' AND
    "ruleset_snapshot"->>'schemaVersion' = '1' AND
    "crossplay_snapshot"->>'schemaVersion' = '1'
  ),
  CONSTRAINT "matches_status_timestamps_check" CHECK (
    ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL) AND
    ("status" <> 'VOIDED' OR "voided_at" IS NOT NULL)
  )
);

CREATE TABLE "match_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "user_game_account_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "game_platform_id" UUID NOT NULL,
  "side" "match_participant_side" NOT NULL,
  "status" "match_participant_status" NOT NULL DEFAULT 'PENDING',
  "participant_snapshot" JSONB NOT NULL,
  "ready_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_participants_match_side_key" UNIQUE ("match_id", "side"),
  CONSTRAINT "match_participants_match_user_key" UNIQUE ("match_id", "user_id"),
  CONSTRAINT "match_participants_snapshot_object_check" CHECK (
    jsonb_typeof("participant_snapshot") = 'object' AND
    "participant_snapshot"->>'schemaVersion' = '1'
  ),
  CONSTRAINT "match_participants_status_timestamp_check" CHECK (
    ("status" <> 'READY' OR "ready_at" IS NOT NULL) AND
    ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL)
  )
);

CREATE TABLE "match_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" "match_audit_action" NOT NULL,
  "reason_code" VARCHAR(64),
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_audit_events_admin_void_reason_check" CHECK (
    "action" <> 'ADMIN_VOIDED' OR "reason_code" IS NOT NULL
  )
);

CREATE INDEX "matches_status_ready_deadline_idx" ON "matches"("status", "ready_deadline_at");
CREATE INDEX "matches_catalog_created_idx" ON "matches"("game_id", "game_mode_id", "created_at");
CREATE INDEX "matches_created_at_idx" ON "matches"("created_at");
CREATE INDEX "match_participants_user_created_idx" ON "match_participants"("user_id", "created_at");
CREATE INDEX "match_participants_account_idx" ON "match_participants"("user_game_account_id");
CREATE INDEX "match_audit_events_match_created_idx" ON "match_audit_events"("match_id", "created_at");
CREATE INDEX "match_audit_events_actor_idx" ON "match_audit_events"("actor_user_id");
CREATE INDEX "match_audit_events_action_created_idx" ON "match_audit_events"("action", "created_at");

ALTER TABLE "matches" ADD CONSTRAINT "matches_proposal_id_fkey" FOREIGN KEY ("matchmaking_proposal_id") REFERENCES "matchmaking_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_mode_game_fkey" FOREIGN KEY ("game_mode_id", "game_id") REFERENCES "game_modes"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_ruleset_game_mode_fkey" FOREIGN KEY ("game_ruleset_id", "game_id", "game_mode_id") REFERENCES "game_rulesets"("id", "game_id", "game_mode_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_crossplay_game_fkey" FOREIGN KEY ("crossplay_group_id", "game_id") REFERENCES "crossplay_groups"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_account_identity_fkey" FOREIGN KEY ("user_game_account_id", "user_id", "game_id", "game_platform_id") REFERENCES "user_game_accounts"("id", "user_id", "game_id", "game_platform_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_platform_game_fkey" FOREIGN KEY ("game_platform_id", "game_id") REFERENCES "game_platforms"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_audit_events" ADD CONSTRAINT "match_audit_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_audit_events" ADD CONSTRAINT "match_audit_events_actor_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
