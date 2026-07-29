-- Generated from the Prisma schema with:
-- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- The final check constraints and partial unique index are intentional
-- PostgreSQL additions because Prisma Schema cannot express them directly.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "user_status" AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DISABLED',
    'DELETED'
);

CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "last_authenticated_at" TIMESTAMPTZ(3),
    "security_version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_security_version_check" CHECK ("security_version" >= 0),
    CONSTRAINT "users_deleted_state_check" CHECK (
        ("status" = 'DELETED' AND "deleted_at" IS NOT NULL)
        OR ("status" <> 'DELETED' AND "deleted_at" IS NULL)
    )
);

CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'fa',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "country_code" CHAR(2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_profiles_display_name_check" CHECK (length(btrim("display_name")) > 0),
    CONSTRAINT "user_profiles_locale_check" CHECK ("locale" IN ('fa', 'en')),
    CONSTRAINT "user_profiles_timezone_check" CHECK (length(btrim("timezone")) > 0),
    CONSTRAINT "user_profiles_country_code_check" CHECK (
        "country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'
    )
);

CREATE TABLE "user_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "user_emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_emails_email_check" CHECK (length(btrim("email")) > 0),
    CONSTRAINT "user_emails_normalized_email_check" CHECK (
        length(btrim("normalized_email")) > 0
        AND "normalized_email" = lower("normalized_email")
    )
);

CREATE TABLE "password_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(512) NOT NULL,
    "password_algorithm" VARCHAR(32) NOT NULL,
    "password_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_credentials_hash_check" CHECK (length("password_hash") > 0),
    CONSTRAINT "password_credentials_algorithm_check" CHECK (
        length(btrim("password_algorithm")) > 0
    ),
    CONSTRAINT "password_credentials_failed_attempt_count_check" CHECK (
        "failed_attempt_count" >= 0
    )
);

CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "security_version" INTEGER NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revocation_reason" VARCHAR(128),
    "ip_hash" VARCHAR(128),
    "user_agent" VARCHAR(512),
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_sessions_token_hash_check" CHECK (length("token_hash") > 0),
    CONSTRAINT "user_sessions_security_version_check" CHECK ("security_version" >= 0),
    CONSTRAINT "user_sessions_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "user_sessions_last_seen_check" CHECK (
        "last_seen_at" IS NULL OR "last_seen_at" >= "created_at"
    ),
    CONSTRAINT "user_sessions_revocation_check" CHECK (
        ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL)
        OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL)
    ),
    CONSTRAINT "user_sessions_revoked_at_check" CHECK (
        "revoked_at" IS NULL OR "revoked_at" >= "created_at"
    ),
    CONSTRAINT "user_sessions_revocation_reason_check" CHECK (
        "revocation_reason" IS NULL OR length(btrim("revocation_reason")) > 0
    )
);

CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_email_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_verification_tokens_hash_check" CHECK (length("token_hash") > 0),
    CONSTRAINT "email_verification_tokens_expiry_check" CHECK (
        "expires_at" > "created_at"
    ),
    CONSTRAINT "email_verification_tokens_consumed_check" CHECK (
        "consumed_at" IS NULL OR "consumed_at" >= "created_at"
    ),
    CONSTRAINT "email_verification_tokens_attempt_count_check" CHECK ("attempt_count" >= 0)
);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "requested_ip_hash" VARCHAR(128),
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_reset_tokens_hash_check" CHECK (length("token_hash") > 0),
    CONSTRAINT "password_reset_tokens_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "password_reset_tokens_consumed_check" CHECK (
        "consumed_at" IS NULL OR "consumed_at" >= "created_at"
    )
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roles_key_check" CHECK (length(btrim("key")) > 0),
    CONSTRAINT "roles_name_check" CHECK (length(btrim("name")) > 0)
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "permissions_key_check" CHECK (length(btrim("key")) > 0)
);

CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" UUID,
    "expires_at" TIMESTAMPTZ(3),
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_expiry_check" CHECK (
        "expires_at" IS NULL OR "expires_at" > "assigned_at"
    )
);

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");
CREATE INDEX "user_profiles_country_code_idx" ON "user_profiles"("country_code");
CREATE UNIQUE INDEX "user_emails_normalized_email_key" ON "user_emails"("normalized_email");
CREATE UNIQUE INDEX "user_emails_one_primary_per_user_key"
    ON "user_emails"("user_id") WHERE "is_primary" = true;
CREATE INDEX "user_emails_user_id_idx" ON "user_emails"("user_id");
CREATE INDEX "user_emails_user_id_is_primary_idx"
    ON "user_emails"("user_id", "is_primary");
CREATE INDEX "user_emails_verified_at_idx" ON "user_emails"("verified_at");
CREATE UNIQUE INDEX "password_credentials_user_id_key"
    ON "password_credentials"("user_id");
CREATE INDEX "password_credentials_locked_until_idx"
    ON "password_credentials"("locked_until");
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX "user_sessions_status_idx" ON "user_sessions"("status");
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
CREATE INDEX "user_sessions_user_id_status_idx" ON "user_sessions"("user_id", "status");
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key"
    ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_email_id_idx"
    ON "email_verification_tokens"("user_email_id");
CREATE INDEX "email_verification_tokens_expires_at_idx"
    ON "email_verification_tokens"("expires_at");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
    ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx"
    ON "password_reset_tokens"("expires_at");
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "user_roles_expires_at_idx" ON "user_roles"("expires_at");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

ALTER TABLE "user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_emails"
    ADD CONSTRAINT "user_emails_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_credentials"
    ADD CONSTRAINT "password_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_user_email_id_fkey"
    FOREIGN KEY ("user_email_id") REFERENCES "user_emails"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey"
    FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
