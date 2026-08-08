CREATE TABLE "mfa_totp_rotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "totp_id" UUID NOT NULL,
    "candidate_secret_ciphertext" VARCHAR(1024) NOT NULL,
    "candidate_secret_iv" VARCHAR(64) NOT NULL,
    "candidate_secret_tag" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mfa_totp_rotations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_totp_rotations_user_id_key"
    ON "mfa_totp_rotations"("user_id");

CREATE UNIQUE INDEX "mfa_totp_rotations_totp_id_key"
    ON "mfa_totp_rotations"("totp_id");

CREATE INDEX "mfa_totp_rotations_expires_at_idx"
    ON "mfa_totp_rotations"("expires_at");

ALTER TABLE "mfa_totp_rotations"
    ADD CONSTRAINT "mfa_totp_rotations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_totp_rotations"
    ADD CONSTRAINT "mfa_totp_rotations_totp_id_fkey"
    FOREIGN KEY ("totp_id") REFERENCES "user_mfa_totp"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
