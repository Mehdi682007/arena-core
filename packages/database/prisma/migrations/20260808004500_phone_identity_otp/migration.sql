CREATE TYPE "phone_otp_purpose" AS ENUM (
    'SIGN_IN',
    'VERIFY_PHONE',
    'CHANGE_PHONE',
    'RECOVERY'
);

CREATE TABLE "user_phones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "phone_e164" VARCHAR(32) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_phones_pkey"
        PRIMARY KEY ("id")
);

CREATE TABLE "phone_otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "user_phone_id" UUID,
    "phone_e164" VARCHAR(32) NOT NULL,
    "purpose" "phone_otp_purpose" NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "requested_ip_hash" VARCHAR(128),

    CONSTRAINT "phone_otp_challenges_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_phones_phone_e164_key"
    ON "user_phones"("phone_e164");

CREATE INDEX "user_phones_user_id_idx"
    ON "user_phones"("user_id");

CREATE INDEX "user_phones_user_id_is_primary_idx"
    ON "user_phones"("user_id", "is_primary");

CREATE INDEX "user_phones_verified_at_idx"
    ON "user_phones"("verified_at");

CREATE INDEX "phone_otp_challenges_user_purpose_created_idx"
    ON "phone_otp_challenges"(
        "user_id",
        "purpose",
        "created_at"
    );

CREATE INDEX "phone_otp_challenges_user_phone_id_idx"
    ON "phone_otp_challenges"("user_phone_id");

CREATE INDEX "phone_otp_challenges_expires_at_idx"
    ON "phone_otp_challenges"("expires_at");

ALTER TABLE "user_phones"
    ADD CONSTRAINT "user_phones_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "phone_otp_challenges"
    ADD CONSTRAINT "phone_otp_challenges_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "phone_otp_challenges"
    ADD CONSTRAINT "phone_otp_challenges_user_phone_id_fkey"
    FOREIGN KEY ("user_phone_id")
    REFERENCES "user_phones"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;