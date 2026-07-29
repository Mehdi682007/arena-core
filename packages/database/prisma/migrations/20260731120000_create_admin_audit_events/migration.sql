CREATE TABLE "admin_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "actor_type" VARCHAR(16) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" VARCHAR(128),
    "source" VARCHAR(64) NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_audit_events_actor_type_check"
      CHECK ("actor_type" IN ('USER', 'SYSTEM', 'SUPPORT')),
    CONSTRAINT "admin_audit_events_metadata_object_check"
      CHECK (jsonb_typeof("metadata") = 'object')
);

ALTER TABLE "admin_audit_events"
  ADD CONSTRAINT "admin_audit_events_actor_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "admin_audit_events_order_idx"
  ON "admin_audit_events"("created_at" DESC, "id" DESC);
CREATE INDEX "admin_audit_events_actor_created_idx"
  ON "admin_audit_events"("actor_user_id", "created_at" DESC);
CREATE INDEX "admin_audit_events_target_created_idx"
  ON "admin_audit_events"("target_type", "target_id", "created_at" DESC);
CREATE INDEX "admin_audit_events_action_created_idx"
  ON "admin_audit_events"("action", "created_at" DESC);

CREATE OR REPLACE FUNCTION reject_admin_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin audit events are append-only';
END;
$$;

CREATE TRIGGER "admin_audit_events_no_update"
BEFORE UPDATE ON "admin_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_mutation();

CREATE TRIGGER "admin_audit_events_no_delete"
BEFORE DELETE ON "admin_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_mutation();
