CREATE TYPE "matchmaking_request_status" AS ENUM ('PENDING', 'SEARCHING', 'PROPOSED', 'MATCHED', 'CANCELLED', 'EXPIRED', 'FAILED');
CREATE TYPE "matchmaking_proposal_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "matchmaking_search_scope" AS ENUM ('CROSSPLAY_GROUP', 'SAME_PLATFORM');

CREATE UNIQUE INDEX "user_game_accounts_identity_key"
ON "user_game_accounts"("id", "user_id", "game_id", "game_platform_id");
CREATE UNIQUE INDEX "game_rulesets_id_game_mode_key"
ON "game_rulesets"("id", "game_id", "game_mode_id");

CREATE TABLE "matchmaking_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "user_game_account_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "game_mode_id" UUID NOT NULL,
  "game_ruleset_id" UUID NOT NULL,
  "game_platform_id" UUID NOT NULL,
  "crossplay_group_id" UUID NOT NULL,
  "status" "matchmaking_request_status" NOT NULL DEFAULT 'PENDING',
  "search_scope" "matchmaking_search_scope" NOT NULL DEFAULT 'CROSSPLAY_GROUP',
  "criteria" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "search_started_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "cancelled_at" TIMESTAMPTZ(3),
  "matched_at" TIMESTAMPTZ(3),
  "last_evaluated_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matchmaking_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matchmaking_requests_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "matchmaking_requests_priority_check" CHECK ("priority" BETWEEN -100 AND 100),
  CONSTRAINT "matchmaking_requests_version_check" CHECK ("version" > 0),
  CONSTRAINT "matchmaking_requests_status_timestamps_check" CHECK (
    ("status" <> 'SEARCHING' OR "search_started_at" IS NOT NULL) AND
    ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL) AND
    ("status" <> 'MATCHED' OR "matched_at" IS NOT NULL)
  )
);

CREATE TABLE "matchmaking_proposals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "matchmaking_proposal_status" NOT NULL DEFAULT 'PENDING',
  "request_a_id" UUID NOT NULL,
  "request_b_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "game_mode_id" UUID NOT NULL,
  "game_ruleset_id" UUID NOT NULL,
  "crossplay_group_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_a_at" TIMESTAMPTZ(3),
  "accepted_b_at" TIMESTAMPTZ(3),
  "rejected_at" TIMESTAMPTZ(3),
  "rejected_by_user_id" UUID,
  "completed_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matchmaking_proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matchmaking_proposals_distinct_pair_check" CHECK ("request_a_id" <> "request_b_id"),
  CONSTRAINT "matchmaking_proposals_canonical_pair_check" CHECK ("request_a_id"::text < "request_b_id"::text),
  CONSTRAINT "matchmaking_proposals_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "matchmaking_proposals_version_check" CHECK ("version" > 0),
  CONSTRAINT "matchmaking_proposals_acceptance_check" CHECK (
    "status" <> 'ACCEPTED' OR
    ("accepted_a_at" IS NOT NULL AND "accepted_b_at" IS NOT NULL AND "completed_at" IS NOT NULL)
  ),
  CONSTRAINT "matchmaking_proposals_rejection_check" CHECK (
    "status" <> 'REJECTED' OR
    ("rejected_at" IS NOT NULL AND "rejected_by_user_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "matchmaking_requests_one_active_user_key"
ON "matchmaking_requests"("user_id")
WHERE "status" IN ('PENDING', 'SEARCHING', 'PROPOSED');
CREATE INDEX "matchmaking_requests_user_created_idx" ON "matchmaking_requests"("user_id", "created_at");
CREATE INDEX "matchmaking_requests_account_idx" ON "matchmaking_requests"("user_game_account_id");
CREATE INDEX "matchmaking_requests_platform_idx" ON "matchmaking_requests"("game_platform_id");
CREATE INDEX "matchmaking_requests_expires_idx" ON "matchmaking_requests"("expires_at");
CREATE INDEX "matchmaking_requests_candidate_idx"
ON "matchmaking_requests"("status", "game_id", "game_mode_id", "game_ruleset_id", "crossplay_group_id", "priority" DESC, "created_at", "id");
CREATE UNIQUE INDEX "matchmaking_proposals_active_pair_key"
ON "matchmaking_proposals"("request_a_id", "request_b_id")
WHERE "status" = 'PENDING';
CREATE INDEX "matchmaking_proposals_request_a_idx" ON "matchmaking_proposals"("request_a_id");
CREATE INDEX "matchmaking_proposals_request_b_idx" ON "matchmaking_proposals"("request_b_id");
CREATE INDEX "matchmaking_proposals_status_expires_idx" ON "matchmaking_proposals"("status", "expires_at");
CREATE INDEX "matchmaking_proposals_catalog_idx" ON "matchmaking_proposals"("game_id", "game_mode_id", "game_ruleset_id");
CREATE INDEX "matchmaking_proposals_rejector_idx" ON "matchmaking_proposals"("rejected_by_user_id");

ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_account_identity_fkey" FOREIGN KEY ("user_game_account_id", "user_id", "game_id", "game_platform_id") REFERENCES "user_game_accounts"("id", "user_id", "game_id", "game_platform_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_mode_game_fkey" FOREIGN KEY ("game_mode_id", "game_id") REFERENCES "game_modes"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_ruleset_game_mode_fkey" FOREIGN KEY ("game_ruleset_id", "game_id", "game_mode_id") REFERENCES "game_rulesets"("id", "game_id", "game_mode_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_platform_game_fkey" FOREIGN KEY ("game_platform_id", "game_id") REFERENCES "game_platforms"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_requests" ADD CONSTRAINT "matchmaking_requests_crossplay_game_fkey" FOREIGN KEY ("crossplay_group_id", "game_id") REFERENCES "crossplay_groups"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_request_a_id_fkey" FOREIGN KEY ("request_a_id") REFERENCES "matchmaking_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_request_b_id_fkey" FOREIGN KEY ("request_b_id") REFERENCES "matchmaking_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_mode_game_fkey" FOREIGN KEY ("game_mode_id", "game_id") REFERENCES "game_modes"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_ruleset_game_mode_fkey" FOREIGN KEY ("game_ruleset_id", "game_id", "game_mode_id") REFERENCES "game_rulesets"("id", "game_id", "game_mode_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_crossplay_game_fkey" FOREIGN KEY ("crossplay_group_id", "game_id") REFERENCES "crossplay_groups"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matchmaking_proposals" ADD CONSTRAINT "matchmaking_proposals_rejector_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "enforce_one_active_proposal_per_request"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'PENDING' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(LEAST(NEW."request_a_id"::text, NEW."request_b_id"::text), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(GREATEST(NEW."request_a_id"::text, NEW."request_b_id"::text), 0));
  IF EXISTS (
    SELECT 1 FROM "matchmaking_proposals" p
    WHERE p."status" = 'PENDING' AND p."id" <> NEW."id"
      AND (p."request_a_id" IN (NEW."request_a_id", NEW."request_b_id")
        OR p."request_b_id" IN (NEW."request_a_id", NEW."request_b_id"))
  ) THEN
    RAISE EXCEPTION 'active proposal already exists for request' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "matchmaking_proposals_one_active_request_trigger"
BEFORE INSERT OR UPDATE OF "status", "request_a_id", "request_b_id" ON "matchmaking_proposals"
FOR EACH ROW EXECUTE FUNCTION "enforce_one_active_proposal_per_request"();
