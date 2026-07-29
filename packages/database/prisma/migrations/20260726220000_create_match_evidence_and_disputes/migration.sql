ALTER TYPE "match_audit_action" ADD VALUE 'EVIDENCE_SUBMITTED';
ALTER TYPE "match_audit_action" ADD VALUE 'EVIDENCE_WITHDRAWN';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_RESPONDED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_CANCELLED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_ASSIGNED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_REVIEW_STARTED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "match_audit_action" ADD VALUE 'DISPUTE_RESPONSE_EXPIRED';

CREATE TYPE "match_evidence_type" AS ENUM
  ('SCREENSHOT_DECLARATION', 'VIDEO_DECLARATION', 'MATCH_SUMMARY_DECLARATION', 'TEXT_STATEMENT');
CREATE TYPE "match_evidence_status" AS ENUM ('ACTIVE', 'WITHDRAWN', 'LOCKED');
CREATE TYPE "match_dispute_status" AS ENUM
  ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "match_dispute_reason_code" AS ENUM
  ('SCORE_MISMATCH', 'WRONG_WINNER', 'OPPONENT_NO_SHOW', 'OPPONENT_DISCONNECTED',
   'INVALID_RESULT_SUBMISSION', 'RULESET_VIOLATION', 'ACCOUNT_IDENTITY_ISSUE', 'OTHER');
CREATE TYPE "dispute_resolution_type" AS ENUM
  ('UPHOLD_RESULT', 'CORRECT_RESULT', 'VOID_MATCH', 'REJECT_DISPUTE');

ALTER TABLE "match_participants"
  ADD CONSTRAINT "match_participants_id_user_id_key" UNIQUE ("id", "user_id");

CREATE TABLE "match_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "submitted_by_user_id" UUID NOT NULL,
  "type" "match_evidence_type" NOT NULL,
  "status" "match_evidence_status" NOT NULL DEFAULT 'ACTIVE',
  "payload" JSONB NOT NULL,
  "captured_at" TIMESTAMPTZ(3),
  "submitted_at" TIMESTAMPTZ(3) NOT NULL,
  "withdrawn_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_evidence_payload_object_check" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "match_evidence_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_evidence_withdrawn_check" CHECK (
    ("status" = 'WITHDRAWN' AND "withdrawn_at" IS NOT NULL)
    OR ("status" IN ('ACTIVE', 'LOCKED') AND "withdrawn_at" IS NULL)
  )
);

CREATE TABLE "match_disputes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "opened_by_participant_id" UUID NOT NULL,
  "opened_by_user_id" UUID NOT NULL,
  "status" "match_dispute_status" NOT NULL DEFAULT 'OPEN',
  "reason_code" "match_dispute_reason_code" NOT NULL,
  "claim_payload" JSONB NOT NULL,
  "result_snapshot" JSONB NOT NULL,
  "response_deadline_at" TIMESTAMPTZ(3) NOT NULL,
  "review_deadline_at" TIMESTAMPTZ(3) NOT NULL,
  "assigned_reviewer_user_id" UUID,
  "assigned_at" TIMESTAMPTZ(3),
  "resolved_at" TIMESTAMPTZ(3),
  "resolution_type" "dispute_resolution_type",
  "resolution_reason_code" VARCHAR(64),
  "resolution_note" VARCHAR(500),
  "resolved_by_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_disputes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_disputes_claim_object_check" CHECK (jsonb_typeof("claim_payload") = 'object'),
  CONSTRAINT "match_disputes_snapshot_object_check" CHECK (jsonb_typeof("result_snapshot") = 'object'),
  CONSTRAINT "match_disputes_version_check" CHECK ("version" > 0),
  CONSTRAINT "match_disputes_deadline_check"
    CHECK ("response_deadline_at" > "created_at" AND "review_deadline_at" >= "response_deadline_at"),
  CONSTRAINT "match_disputes_assignment_check"
    CHECK (("assigned_reviewer_user_id" IS NULL) = ("assigned_at" IS NULL)),
  CONSTRAINT "match_disputes_resolution_check" CHECK (
    ("status" IN ('RESOLVED', 'REJECTED')
      AND "resolved_at" IS NOT NULL AND "resolution_type" IS NOT NULL
      AND "resolution_reason_code" IS NOT NULL AND "resolved_by_user_id" IS NOT NULL)
    OR
    ("status" IN ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'CANCELLED', 'EXPIRED')
      AND "resolved_at" IS NULL AND "resolution_type" IS NULL
      AND "resolved_by_user_id" IS NULL)
  )
);

CREATE TABLE "match_dispute_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dispute_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "submitted_by_user_id" UUID NOT NULL,
  "statement" VARCHAR(2000) NOT NULL,
  "evidence_ids" JSONB NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_dispute_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_dispute_responses_dispute_id_key" UNIQUE ("dispute_id"),
  CONSTRAINT "match_dispute_responses_statement_check" CHECK (length(trim("statement")) > 0),
  CONSTRAINT "match_dispute_responses_evidence_array_check"
    CHECK (jsonb_typeof("evidence_ids") = 'array'),
  CONSTRAINT "match_dispute_responses_version_check" CHECK ("version" > 0)
);

CREATE TABLE "match_result_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "match_result_id" UUID NOT NULL,
  "dispute_id" UUID NOT NULL,
  "previous_payload" JSONB,
  "new_payload" JSONB,
  "previous_status" "match_result_status" NOT NULL,
  "resolution_type" "dispute_resolution_type" NOT NULL,
  "resolved_by_user_id" UUID NOT NULL,
  "reason_code" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_result_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_result_revisions_payload_check" CHECK (
    ("previous_payload" IS NULL OR jsonb_typeof("previous_payload") = 'object')
    AND ("new_payload" IS NULL OR jsonb_typeof("new_payload") = 'object')
  )
);

CREATE UNIQUE INDEX "match_disputes_one_active_match_key"
  ON "match_disputes" ("match_id")
  WHERE "status" IN ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW');
CREATE INDEX "match_evidence_match_participant_status_idx"
  ON "match_evidence" ("match_id", "participant_id", "status");
CREATE INDEX "match_evidence_user_submitted_idx"
  ON "match_evidence" ("submitted_by_user_id", "submitted_at");
CREATE INDEX "match_evidence_status_submitted_idx"
  ON "match_evidence" ("status", "submitted_at");
CREATE INDEX "match_disputes_match_created_idx" ON "match_disputes" ("match_id", "created_at");
CREATE INDEX "match_disputes_opener_created_idx"
  ON "match_disputes" ("opened_by_user_id", "created_at");
CREATE INDEX "match_disputes_status_response_deadline_idx"
  ON "match_disputes" ("status", "response_deadline_at");
CREATE INDEX "match_disputes_status_reviewer_idx"
  ON "match_disputes" ("status", "assigned_reviewer_user_id");
CREATE INDEX "match_disputes_reason_created_idx"
  ON "match_disputes" ("reason_code", "created_at");
CREATE INDEX "match_disputes_review_deadline_idx" ON "match_disputes" ("review_deadline_at");
CREATE INDEX "match_dispute_responses_participant_idx"
  ON "match_dispute_responses" ("participant_id", "submitted_at");
CREATE INDEX "match_dispute_responses_user_idx"
  ON "match_dispute_responses" ("submitted_by_user_id");
CREATE INDEX "match_result_revisions_result_created_idx"
  ON "match_result_revisions" ("match_result_id", "created_at");
CREATE UNIQUE INDEX "match_result_revisions_dispute_id_key" ON "match_result_revisions" ("dispute_id");
CREATE INDEX "match_result_revisions_actor_idx" ON "match_result_revisions" ("resolved_by_user_id");

ALTER TABLE "match_evidence"
  ADD CONSTRAINT "match_evidence_match_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_evidence_owner_fkey"
    FOREIGN KEY ("participant_id", "submitted_by_user_id", "match_id")
    REFERENCES "match_participants" ("id", "user_id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_evidence_submitter_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_disputes"
  ADD CONSTRAINT "match_disputes_match_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_disputes_opener_fkey"
    FOREIGN KEY ("opened_by_participant_id", "opened_by_user_id", "match_id")
    REFERENCES "match_participants" ("id", "user_id", "match_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_disputes_opened_by_fkey"
    FOREIGN KEY ("opened_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_disputes_reviewer_fkey"
    FOREIGN KEY ("assigned_reviewer_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "match_disputes_resolver_fkey"
    FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "match_dispute_responses"
  ADD CONSTRAINT "match_dispute_responses_dispute_id_fkey"
    FOREIGN KEY ("dispute_id") REFERENCES "match_disputes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_dispute_responses_owner_fkey"
    FOREIGN KEY ("participant_id", "submitted_by_user_id")
    REFERENCES "match_participants" ("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_dispute_responses_submitter_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_result_revisions"
  ADD CONSTRAINT "match_result_revisions_result_id_fkey"
    FOREIGN KEY ("match_result_id") REFERENCES "match_results" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_result_revisions_dispute_id_fkey"
    FOREIGN KEY ("dispute_id") REFERENCES "match_disputes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "match_result_revisions_actor_fkey"
    FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
