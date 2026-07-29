-- F3.1 game catalog foundation. This migration intentionally contains
-- PostgreSQL checks and partial indexes that Prisma cannot express.

CREATE TYPE "game_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "platform_family" AS ENUM ('PLAYSTATION', 'XBOX', 'PC', 'NINTENDO', 'MOBILE', 'OTHER');
CREATE TYPE "catalog_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "game_mode_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "game_ruleset_status" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

CREATE TABLE "games" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(64) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "short_name" VARCHAR(60),
  "description" VARCHAR(2000),
  "status" "game_status" NOT NULL DEFAULT 'DRAFT',
  "is_visible" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "games_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "games_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "games_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") BETWEEN 2 AND 80),
  CONSTRAINT "games_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "games_short_name_check" CHECK ("short_name" IS NULL OR length(btrim("short_name")) BETWEEN 1 AND 60),
  CONSTRAINT "games_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "games_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE TABLE "platforms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "key" VARCHAR(64) NOT NULL, "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(100) NOT NULL, "family" "platform_family" NOT NULL,
  "status" "catalog_status" NOT NULL DEFAULT 'ACTIVE', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "platforms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platforms_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "platforms_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") BETWEEN 2 AND 80),
  CONSTRAINT "platforms_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "platforms_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "platforms_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE TABLE "game_platforms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL, "platform_id" UUID NOT NULL,
  "status" "catalog_status" NOT NULL DEFAULT 'ACTIVE', "is_default" BOOLEAN NOT NULL DEFAULT false,
  "external_label" VARCHAR(120),
  "sort_order" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "game_platforms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_platforms_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "game_platforms_default_check" CHECK (NOT "is_default" OR "status" = 'ACTIVE'),
  CONSTRAINT "game_platforms_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE TABLE "crossplay_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL, "key" VARCHAR(64) NOT NULL,
  "name" VARCHAR(100) NOT NULL, "description" VARCHAR(1000), "status" "catalog_status" NOT NULL DEFAULT 'ACTIVE',
  "sort_order" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "crossplay_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crossplay_groups_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "crossplay_groups_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "crossplay_groups_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "crossplay_groups_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE TABLE "crossplay_group_platforms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL,
  "crossplay_group_id" UUID NOT NULL, "game_platform_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crossplay_group_platforms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_modes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL, "key" VARCHAR(64) NOT NULL,
  "slug" VARCHAR(80) NOT NULL, "name" VARCHAR(100) NOT NULL, "description" VARCHAR(1000),
  "status" "game_mode_status" NOT NULL DEFAULT 'DRAFT',
  "team_size_min" INTEGER NOT NULL, "team_size_max" INTEGER NOT NULL,
  "participant_count_min" INTEGER NOT NULL, "participant_count_max" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "game_modes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_modes_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "game_modes_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") BETWEEN 2 AND 80),
  CONSTRAINT "game_modes_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "game_modes_sizes_check" CHECK (
    "team_size_min" > 0 AND "team_size_max" >= "team_size_min"
    AND "participant_count_min" > 0 AND "participant_count_max" >= "participant_count_min"
  ),
  CONSTRAINT "game_modes_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "game_modes_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE TABLE "game_rulesets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL, "game_mode_id" UUID NOT NULL,
  "key" VARCHAR(64) NOT NULL, "version" INTEGER NOT NULL, "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000),
  "status" "game_ruleset_status" NOT NULL DEFAULT 'DRAFT', "is_default" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "published_at" TIMESTAMPTZ(3), "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "game_rulesets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_rulesets_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "game_rulesets_version_check" CHECK ("version" > 0),
  CONSTRAINT "game_rulesets_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "game_rulesets_configuration_check" CHECK (jsonb_typeof("configuration") = 'object'),
  CONSTRAINT "game_rulesets_publish_check" CHECK (
    ("status" IN ('ACTIVE', 'SUPERSEDED') AND "published_at" IS NOT NULL)
    OR ("status" IN ('DRAFT', 'ARCHIVED') AND ("published_at" IS NULL OR "status" = 'ARCHIVED'))
  ),
  CONSTRAINT "game_rulesets_default_check" CHECK (NOT "is_default" OR "status" = 'ACTIVE'),
  CONSTRAINT "game_rulesets_archive_check" CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "games_key_key" ON "games"("key");
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");
CREATE INDEX "games_status_sort_order_idx" ON "games"("status", "sort_order");
CREATE UNIQUE INDEX "platforms_key_key" ON "platforms"("key");
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");
CREATE INDEX "platforms_status_sort_order_idx" ON "platforms"("status", "sort_order");
CREATE UNIQUE INDEX "game_platforms_game_id_platform_id_key" ON "game_platforms"("game_id", "platform_id");
CREATE UNIQUE INDEX "game_platforms_id_game_id_key" ON "game_platforms"("id", "game_id");
CREATE UNIQUE INDEX "game_platforms_one_default_per_game_key" ON "game_platforms"("game_id") WHERE "is_default";
CREATE INDEX "game_platforms_game_status_sort_idx" ON "game_platforms"("game_id", "status", "sort_order");
CREATE UNIQUE INDEX "crossplay_groups_game_id_key_key" ON "crossplay_groups"("game_id", "key");
CREATE UNIQUE INDEX "crossplay_groups_id_game_id_key" ON "crossplay_groups"("id", "game_id");
CREATE INDEX "crossplay_groups_game_status_sort_idx" ON "crossplay_groups"("game_id", "status", "sort_order");
CREATE UNIQUE INDEX "crossplay_group_platforms_group_platform_key" ON "crossplay_group_platforms"("crossplay_group_id", "game_platform_id");
CREATE UNIQUE INDEX "crossplay_group_platforms_game_platform_key" ON "crossplay_group_platforms"("game_id", "game_platform_id");
CREATE UNIQUE INDEX "game_modes_game_id_key_key" ON "game_modes"("game_id", "key");
CREATE UNIQUE INDEX "game_modes_game_id_slug_key" ON "game_modes"("game_id", "slug");
CREATE UNIQUE INDEX "game_modes_id_game_id_key" ON "game_modes"("id", "game_id");
CREATE INDEX "game_modes_game_status_sort_idx" ON "game_modes"("game_id", "status", "sort_order");
CREATE UNIQUE INDEX "game_rulesets_game_key_version_key" ON "game_rulesets"("game_id", "key", "version");
CREATE UNIQUE INDEX "game_rulesets_one_default_per_mode_key" ON "game_rulesets"("game_id", "game_mode_id") WHERE "is_default" AND "status" = 'ACTIVE';
CREATE INDEX "game_rulesets_game_mode_status_idx" ON "game_rulesets"("game_id", "game_mode_id", "status");

ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crossplay_groups" ADD CONSTRAINT "crossplay_groups_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crossplay_group_platforms" ADD CONSTRAINT "crossplay_group_platforms_group_game_fkey" FOREIGN KEY ("crossplay_group_id", "game_id") REFERENCES "crossplay_groups"("id", "game_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crossplay_group_platforms" ADD CONSTRAINT "crossplay_group_platforms_platform_game_fkey" FOREIGN KEY ("game_platform_id", "game_id") REFERENCES "game_platforms"("id", "game_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_modes" ADD CONSTRAINT "game_modes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_rulesets" ADD CONSTRAINT "game_rulesets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "game_rulesets" ADD CONSTRAINT "game_rulesets_mode_game_fkey" FOREIGN KEY ("game_mode_id", "game_id") REFERENCES "game_modes"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;
