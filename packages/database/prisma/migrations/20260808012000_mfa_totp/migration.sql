CREATE TABLE "user_mfa_totp" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "secret_ciphertext" VARCHAR(1024) NOT NULL,
    "secret_iv" VARCHAR(64) NOT NULL,
    "secret_tag" VARCHAR(64) NOT NULL,
    "enabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_mfa_totp_pkey"
        PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "totp_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(3),

    CONSTRAINT "mfa_recovery_codes_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_mfa_totp_user_id_key"
    ON "user_mfa_totp"("user_id");

CREATE INDEX "user_mfa_totp_enabled_at_idx"
    ON "user_mfa_totp"("enabled_at");

CREATE UNIQUE INDEX "mfa_recovery_codes_totp_id_code_hash_key"
    ON "mfa_recovery_codes"(
        "totp_id",
        "code_hash"
    );

CREATE INDEX "mfa_recovery_codes_totp_id_consumed_at_idx"
    ON "mfa_recovery_codes"(
        "totp_id",
        "consumed_at"
    );

ALTER TABLE "user_mfa_totp"
    ADD CONSTRAINT "user_mfa_totp_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_totp_id_fkey"
    FOREIGN KEY ("totp_id")
    REFERENCES "user_mfa_totp"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;