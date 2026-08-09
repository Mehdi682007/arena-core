CREATE TABLE "site_settings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'primary',
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_settings_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "site_settings_revisions_actor_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "site_settings_revisions_created_idx" ON "site_settings_revisions"("created_at" DESC);
CREATE INDEX "site_settings_revisions_actor_idx" ON "site_settings_revisions"("actor_user_id", "created_at" DESC);
