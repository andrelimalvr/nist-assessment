-- Add soft delete + SSO flags to organizations
ALTER TABLE "organizations" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "enforce_sso" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "sso_provider_key" TEXT;

-- Auth config table
CREATE TABLE "auth_configs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL DEFAULT 'default',
  "sso_enabled" BOOLEAN NOT NULL DEFAULT false,
  "issuer_url" TEXT,
  "client_id" TEXT,
  "scopes" TEXT NOT NULL DEFAULT 'openid profile email',
  "allow_password_login" BOOLEAN NOT NULL DEFAULT true,
  "domain_allow_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enforce_sso" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "auth_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_configs_key_key" ON "auth_configs"("key");

-- Audit log extensions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditAction') THEN
    CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'OTHER');
  END IF;
END $$;

ALTER TABLE "audit_logs" ADD COLUMN "actor_email" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "actor_role" "Role";
ALTER TABLE "audit_logs" ADD COLUMN "field_name" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "old_value" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "new_value" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "metadata" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "audit_logs" ADD COLUMN "error_message" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "request_id" TEXT;

ALTER TABLE "audit_logs" ADD COLUMN "action_enum" "AuditAction" NOT NULL DEFAULT 'OTHER';
UPDATE "audit_logs"
SET "action_enum" = CASE
  WHEN "action" ILIKE 'create' THEN 'CREATE'::"AuditAction"
  WHEN "action" ILIKE 'update' THEN 'UPDATE'::"AuditAction"
  WHEN "action" ILIKE 'delete' THEN 'DELETE'::"AuditAction"
  WHEN "action" ILIKE 'login' THEN 'LOGIN'::"AuditAction"
  WHEN "action" ILIKE 'logout' THEN 'LOGOUT'::"AuditAction"
  WHEN "action" ILIKE 'export' THEN 'EXPORT'::"AuditAction"
  WHEN "action" ILIKE 'override' THEN 'UPDATE'::"AuditAction"
  ELSE 'OTHER'::"AuditAction"
END;
ALTER TABLE "audit_logs" DROP COLUMN "action";
ALTER TABLE "audit_logs" RENAME COLUMN "action_enum" TO "action";

CREATE INDEX "audit_logs_timestamp_desc_idx" ON "audit_logs" ("created_at" DESC);
CREATE INDEX "audit_logs_actor_user_id_timestamp_idx" ON "audit_logs" ("user_id", "created_at" DESC);
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs" ("action", "created_at" DESC);
CREATE INDEX "audit_logs_entity_type_timestamp_idx" ON "audit_logs" ("entity", "created_at" DESC);
CREATE INDEX "audit_logs_field_name_timestamp_idx" ON "audit_logs" ("field_name", "created_at" DESC);
CREATE INDEX "audit_logs_org_timestamp_idx" ON "audit_logs" ("organization_id", "created_at" DESC);
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs" ("request_id");
