ALTER TYPE "match_status" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "match_status" ADD VALUE 'AWAITING_RESULT';
ALTER TYPE "match_status" ADD VALUE 'RESULT_CONFLICT';
ALTER TYPE "match_status" ADD VALUE 'COMPLETED';

ALTER TYPE "match_audit_action" ADD VALUE 'MATCH_STARTED';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_SUBMITTED';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_WITHDRAWN';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_CONFIRMED';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_CONFLICTED';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_ADMIN_RESOLVED';
ALTER TYPE "match_audit_action" ADD VALUE 'RESULT_SUBMISSION_EXPIRED';

CREATE TYPE "match_result_submission_status" AS ENUM
  ('ACTIVE', 'WITHDRAWN', 'SUPERSEDED', 'CONFIRMED', 'CONFLICTING');
CREATE TYPE "match_result_status" AS ENUM
  ('CONFIRMED', 'CONFLICT', 'ADMIN_RESOLVED', 'VOIDED');
CREATE TYPE "match_result_confirmation_method" AS ENUM
  ('PARTICIPANT_AGREEMENT', 'ADMIN_RESOLUTION');
CREATE TYPE "match_result_conflict_reason" AS ENUM
  ('SUBMISSIONS_DIFFER', 'OPPONENT_DID_NOT_SUBMIT', 'INVALID_STATE_RECOVERY');

ALTER TABLE "matches"
  ADD COLUMN "started_at" TIMESTAMPTZ(3),
  ADD COLUMN "result_submission_deadline_at" TIMESTAMPTZ(3),
  ADD COLUMN "result_conflict_deadline_at" TIMESTAMPTZ(3),
  ADD COLUMN "completed_at" TIMESTAMPTZ(3);

ALTER TABLE "match_participants"
  ADD CONSTRAINT "match_participants_id_match_id_key" UNIQUE ("id", "match_id"),
  ADD CONSTRAINT "match_participants_owner_match_key" UNIQUE ("id", "user_id", "match_id");

CREATE TABLE "match_result_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "submitted_by_user_id" UUID NOT NULL,
  "status" "match_result_submission_status" NOT NULL DEFAULT 'ACTIVE',
  "result_payload" JSONB NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL,
  "withdrawn_at" TIMESTAMPTZ(3),
  "superseded_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_result_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_result_submissions_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_result_submissions_payload_object_check"
    CHECK (jsonb_typeof("result_payload") = 'object'),
  CONSTRAINT "match_result_submissions_timestamp_check" CHECK (
    ("status" = 'WITHDRAWN' AND "withdrawn_at" IS NOT NULL AND "superseded_at" IS NULL)
    OR ("status" = 'SUPERSEDED' AND "superseded_at" IS NOT NULL AND "withdrawn_at" IS NULL)
    OR ("status" IN ('ACTIVE', 'CONFIRMED', 'CONFLICTING')
      AND "withdrawn_at" IS NULL AND "superseded_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "match_result_submissions_active_participant_key"
  ON "match_result_submissions" ("participant_id")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "match_result_submissions_match_status_idx"
  ON "match_result_submissions" ("match_id", "status");
CREATE INDEX "match_result_submissions_participant_status_idx"
  ON "match_result_submissions" ("participant_id", "status");
CREATE INDEX "match_result_submissions_user_submitted_idx"
  ON "match_result_submissions" ("submitted_by_user_id", "submitted_at");

CREATE TABLE "match_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "status" "match_result_status" NOT NULL,
  "result_payload" JSONB,
  "winner_participant_id" UUID,
  "loser_participant_id" UUID,
  "is_draw" BOOLEAN NOT NULL DEFAULT false,
  "confirmation_method" "match_result_confirmation_method",
  "conflict_reason" "match_result_conflict_reason",
  "confirmed_at" TIMESTAMPTZ(3),
  "resolved_by_user_id" UUID,
  "resolution_reason_code" VARCHAR(64),
  "resolution_note" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_results_match_id_key" UNIQUE ("match_id"),
  CONSTRAINT "match_results_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_results_payload_object_check"
    CHECK ("result_payload" IS NULL OR jsonb_typeof("result_payload") = 'object'),
  CONSTRAINT "match_results_winner_loser_check"
    CHECK ("winner_participant_id" IS NULL OR "winner_participant_id" <> "loser_participant_id"),
  CONSTRAINT "match_results_outcome_check" CHECK (
    ("status" = 'CONFLICT'
      AND "result_payload" IS NULL
      AND "winner_participant_id" IS NULL
      AND "loser_participant_id" IS NULL
      AND "is_draw" = false
      AND "confirmation_method" IS NULL
      AND "confirmed_at" IS NULL
      AND "conflict_reason" IS NOT NULL)
    OR
    ("status" IN ('CONFIRMED', 'ADMIN_RESOLVED')
      AND "result_payload" IS NOT NULL
      AND "confirmed_at" IS NOT NULL
      AND "confirmation_method" IS NOT NULL
      AND "conflict_reason" IS NULL
      AND (
        ("is_draw" = true AND "winner_participant_id" IS NULL AND "loser_participant_id" IS NULL)
        OR
        ("is_draw" = false AND "winner_participant_id" IS NOT NULL AND "loser_participant_id" IS NOT NULL)
      ))
    OR
    ("status" = 'VOIDED'
      AND "winner_participant_id" IS NULL
      AND "loser_participant_id" IS NULL)
  )
);

CREATE INDEX "match_results_status_created_idx" ON "match_results" ("status", "created_at");
CREATE INDEX "match_results_winner_idx" ON "match_results" ("winner_participant_id");
CREATE INDEX "match_results_confirmed_at_idx" ON "match_results" ("confirmed_at");
CREATE INDEX "match_results_resolver_idx" ON "match_results" ("resolved_by_user_id");
CREATE INDEX "matches_status_result_deadline_idx"
  ON "matches" ("status", "result_submission_deadline_at");
CREATE INDEX "matches_status_conflict_deadline_idx"
  ON "matches" ("status", "result_conflict_deadline_at");
CREATE INDEX "matches_started_at_idx" ON "matches" ("started_at");
CREATE INDEX "matches_completed_at_idx" ON "matches" ("completed_at");

ALTER TABLE "match_result_submissions"
  ADD CONSTRAINT "match_result_submissions_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_result_submissions_owner_fkey"
  FOREIGN KEY ("participant_id", "submitted_by_user_id", "match_id")
  REFERENCES "match_participants" ("id", "user_id", "match_id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_result_submissions_submitter_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_results"
  ADD CONSTRAINT "match_results_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_winner_match_fkey"
  FOREIGN KEY ("winner_participant_id", "match_id")
  REFERENCES "match_participants" ("id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_loser_match_fkey"
  FOREIGN KEY ("loser_participant_id", "match_id")
  REFERENCES "match_participants" ("id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_results_resolver_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_result_timestamps_check" CHECK (
    ("status" IN ('CREATED', 'AWAITING_READY', 'READY', 'CANCELLED', 'EXPIRED')
      AND "started_at" IS NULL
      AND "result_submission_deadline_at" IS NULL
      AND "result_conflict_deadline_at" IS NULL
      AND "completed_at" IS NULL)
    OR
    ("status" IN ('IN_PROGRESS', 'AWAITING_RESULT')
      AND "started_at" IS NOT NULL
      AND "result_submission_deadline_at" > "started_at"
      AND "result_conflict_deadline_at" IS NULL
      AND "completed_at" IS NULL)
    OR
    ("status" = 'RESULT_CONFLICT'
      AND "started_at" IS NOT NULL
      AND "result_submission_deadline_at" > "started_at"
      AND "result_conflict_deadline_at" IS NOT NULL
      AND "completed_at" IS NULL)
    OR
    ("status" = 'COMPLETED'
      AND "started_at" IS NOT NULL
      AND "result_submission_deadline_at" > "started_at"
      AND "completed_at" IS NOT NULL)
    OR
    ("status" = 'VOIDED')
  );
