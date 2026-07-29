CREATE TYPE "notification_type" AS ENUM (
  'MATCHMAKING_PROPOSAL_CREATED', 'MATCHMAKING_PROPOSAL_ACCEPTED', 'MATCH_READY_REQUIRED',
  'MATCH_STARTED', 'MATCH_RESULT_WAITING', 'MATCH_RESULT_CONFIRMED', 'MATCH_RESULT_CONFLICT',
  'MATCH_DISPUTE_OPENED', 'MATCH_DISPUTE_RESPONSE_RECEIVED', 'MATCH_DISPUTE_RESOLVED',
  'MATCH_SETTLEMENT_COMPLETED', 'RATING_UPDATED', 'SECURITY_SIGN_IN'
);
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "notification_outbox_status" AS ENUM (
  'PENDING', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'FAILED',
  'DEAD_LETTERED', 'CANCELLED'
);
CREATE TYPE "notification_delivery_attempt_status" AS ENUM (
  'SUCCEEDED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'SKIPPED'
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_user_id" UUID NOT NULL,
  "type" "notification_type" NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
  "locale" VARCHAR(5) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "payload" JSONB NOT NULL,
  "source_type" VARCHAR(40) NOT NULL,
  "source_id" VARCHAR(128) NOT NULL,
  "deduplication_key" VARCHAR(64) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(3),
  "archived_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_content_check" CHECK (
    "schema_version" > 0 AND "version" > 0 AND length(trim("subject")) > 0
    AND length(trim("body")) > 0 AND jsonb_typeof("payload") = 'object'
  ),
  CONSTRAINT "notifications_hash_check" CHECK (
    "deduplication_key" ~ '^[0-9a-f]{64}$' AND "payload_hash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "notifications_expiry_check" CHECK (
    "expires_at" IS NULL OR "expires_at" > "created_at"
  ),
  CONSTRAINT "notifications_locale_check" CHECK ("locale" IN ('fa', 'en'))
);

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "notification_type" NOT NULL,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_version_check" CHECK ("version" > 0)
);

CREATE TABLE "notification_outbox_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "channel" "notification_channel" NOT NULL,
  "status" "notification_outbox_status" NOT NULL DEFAULT 'PENDING',
  "deduplication_key" VARCHAR(96) NOT NULL,
  "available_at" TIMESTAMPTZ(3) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "dead_lettered_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(64),
  "payload_snapshot" JSONB NOT NULL,
  "claim_token" UUID,
  "claim_expires_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_outbox_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_outbox_attempt_check" CHECK ("attempt_count" >= 0 AND "version" > 0),
  CONSTRAINT "notification_outbox_snapshot_check" CHECK (
    jsonb_typeof("payload_snapshot") = 'object'
  ),
  CONSTRAINT "notification_outbox_claim_check" CHECK (
    ("status" = 'PROCESSING' AND "claim_token" IS NOT NULL AND "claim_expires_at" IS NOT NULL)
    OR ("status" <> 'PROCESSING' AND "claim_token" IS NULL AND "claim_expires_at" IS NULL)
  ),
  CONSTRAINT "notification_outbox_state_check" CHECK (
    ("status" = 'DELIVERED' AND "delivered_at" IS NOT NULL AND "dead_lettered_at" IS NULL)
    OR ("status" = 'DEAD_LETTERED' AND "dead_lettered_at" IS NOT NULL AND "delivered_at" IS NULL)
    OR ("status" IN ('PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'FAILED', 'CANCELLED')
        AND "delivered_at" IS NULL AND "dead_lettered_at" IS NULL)
  )
);

CREATE TABLE "notification_delivery_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "outbox_message_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "notification_delivery_attempt_status" NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "provider_message_id" VARCHAR(255),
  "error_code" VARCHAR(64),
  "error_category" VARCHAR(32),
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_delivery_attempts_time_check" CHECK (
    "attempt_number" > 0 AND "completed_at" >= "started_at" AND length(trim("provider")) > 0
  ),
  CONSTRAINT "notification_delivery_attempts_error_check" CHECK (
    ("status" = 'SUCCEEDED' AND "error_code" IS NULL AND "error_category" IS NULL)
    OR ("status" = 'SKIPPED')
    OR ("status" IN ('RETRYABLE_FAILURE', 'PERMANENT_FAILURE') AND "error_code" IS NOT NULL
        AND "error_category" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "notifications_deduplication_key" ON "notifications"("deduplication_key");
CREATE INDEX "notifications_recipient_created_idx" ON "notifications"("recipient_user_id", "created_at" DESC, "id");
CREATE INDEX "notifications_recipient_read_idx" ON "notifications"("recipient_user_id", "read_at");
CREATE INDEX "notifications_recipient_archived_idx" ON "notifications"("recipient_user_id", "archived_at");
CREATE INDEX "notifications_type_created_idx" ON "notifications"("type", "created_at");
CREATE INDEX "notifications_source_idx" ON "notifications"("source_type", "source_id");
CREATE INDEX "notifications_expires_idx" ON "notifications"("expires_at");
CREATE UNIQUE INDEX "notification_preferences_user_type_key" ON "notification_preferences"("user_id", "type");
CREATE INDEX "notification_preferences_type_idx" ON "notification_preferences"("type");
CREATE UNIQUE INDEX "notification_outbox_deduplication_key" ON "notification_outbox_messages"("deduplication_key");
CREATE UNIQUE INDEX "notification_outbox_notification_channel_key" ON "notification_outbox_messages"("notification_id", "channel");
CREATE INDEX "notification_outbox_status_available_idx" ON "notification_outbox_messages"("status", "available_at", "id");
CREATE INDEX "notification_outbox_channel_status_idx" ON "notification_outbox_messages"("channel", "status");
CREATE INDEX "notification_outbox_delivered_idx" ON "notification_outbox_messages"("delivered_at");
CREATE INDEX "notification_outbox_dead_lettered_idx" ON "notification_outbox_messages"("dead_lettered_at");
CREATE INDEX "notification_outbox_created_idx" ON "notification_outbox_messages"("created_at");
CREATE INDEX "notification_outbox_claim_expires_idx" ON "notification_outbox_messages"("claim_expires_at");
CREATE UNIQUE INDEX "notification_delivery_attempts_outbox_number_key" ON "notification_delivery_attempts"("outbox_message_id", "attempt_number");
CREATE INDEX "notification_delivery_attempts_status_created_idx" ON "notification_delivery_attempts"("status", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_outbox_messages" ADD CONSTRAINT "notification_outbox_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_outbox_id_fkey"
  FOREIGN KEY ("outbox_message_id") REFERENCES "notification_outbox_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
