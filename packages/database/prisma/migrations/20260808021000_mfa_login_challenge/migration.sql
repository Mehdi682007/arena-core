ALTER TABLE "user_sessions"
    ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);

CREATE TABLE "mfa_login_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "security_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "mfa_login_challenges_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_login_challenges_token_hash_key"
    ON "mfa_login_challenges"("token_hash");

CREATE INDEX "mfa_login_challenges_user_id_created_at_idx"
    ON "mfa_login_challenges"(
        "user_id",
        "created_at"
    );

CREATE INDEX "mfa_login_challenges_expires_at_idx"
    ON "mfa_login_challenges"("expires_at");

ALTER TABLE "mfa_login_challenges"
    ADD CONSTRAINT "mfa_login_challenges_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;