-- Create enums
create type "Role" as enum ('ADMIN', 'ASSESSOR', 'VIEWER');
create type "TaskStatus" as enum ('NAO_INICIADO', 'EM_ANDAMENTO', 'IMPLEMENTADO', 'NA');
create type "EvidenceType" as enum ('DOCUMENTO', 'TICKET', 'URL', 'PRINT', 'PIPELINE', 'OUTRO');

-- Create tables
create table "users" (
  "id" text primary key,
  "name" text not null,
  "email" text not null,
  "password_hash" text not null,
  "role" "Role" not null default 'VIEWER',
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null
);

create table "organizations" (
  "id" text primary key,
  "name" text not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null
);

create table "assessments" (
  "id" text primary key,
  "organization_id" text not null,
  "unit" text not null,
  "scope" text not null,
  "assessment_owner" text not null,
  "start_date" timestamp with time zone not null,
  "review_date" timestamp with time zone,
  "notes" text,
  "created_by_id" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null,
  constraint "assessments_organization_id_fkey" foreign key ("organization_id") references "organizations"("id") on delete restrict on update cascade,
  constraint "assessments_created_by_id_fkey" foreign key ("created_by_id") references "users"("id") on delete set null on update cascade
);

create table "ssdf_groups" (
  "id" text primary key,
  "name" text not null,
  "description" text
);

create table "ssdf_practices" (
  "id" text primary key,
  "group_id" text not null,
  "name" text not null,
  constraint "ssdf_practices_group_id_fkey" foreign key ("group_id") references "ssdf_groups"("id") on delete restrict on update cascade
);

create table "ssdf_tasks" (
  "id" text primary key,
  "practice_id" text not null,
  "name" text not null,
  "examples" text,
  "references" text,
  constraint "ssdf_tasks_practice_id_fkey" foreign key ("practice_id") references "ssdf_practices"("id") on delete restrict on update cascade
);

create table "assessment_task_responses" (
  "id" text primary key,
  "assessment_id" text not null,
  "task_id" text not null,
  "applicable" boolean not null default true,
  "status" "TaskStatus" not null default 'NAO_INICIADO',
  "maturity" integer not null default 0,
  "target" integer not null default 3,
  "weight" integer not null default 3,
  "evidence_text" text,
  "evidence_links" text,
  "owner" text,
  "team" text,
  "due_date" timestamp with time zone,
  "last_review" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null,
  constraint "assessment_task_responses_assessment_id_fkey" foreign key ("assessment_id") references "assessments"("id") on delete cascade on update cascade,
  constraint "assessment_task_responses_task_id_fkey" foreign key ("task_id") references "ssdf_tasks"("id") on delete restrict on update cascade
);

create table "evidences" (
  "id" text primary key,
  "response_id" text not null,
  "description" text not null,
  "type" "EvidenceType" not null,
  "link" text,
  "owner" text,
  "date" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null,
  constraint "evidences_response_id_fkey" foreign key ("response_id") references "assessment_task_responses"("id") on delete cascade on update cascade
);

create table "audit_logs" (
  "id" text primary key,
  "user_id" text,
  "entity" text not null,
  "entity_id" text not null,
  "action" text not null,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamp with time zone not null default now(),
  constraint "audit_logs_user_id_fkey" foreign key ("user_id") references "users"("id") on delete set null on update cascade
);

-- Indexes
create unique index "users_email_key" on "users"("email");
create unique index "organizations_name_key" on "organizations"("name");
create index "assessments_organization_id_idx" on "assessments"("organization_id");
create index "ssdf_practices_group_id_idx" on "ssdf_practices"("group_id");
create index "ssdf_tasks_practice_id_idx" on "ssdf_tasks"("practice_id");
create unique index "assessment_task_responses_assessment_id_task_id_key" on "assessment_task_responses"("assessment_id", "task_id");
create index "assessment_task_responses_assessment_id_status_idx" on "assessment_task_responses"("assessment_id", "status");
create index "assessment_task_responses_task_id_idx" on "assessment_task_responses"("task_id");
create index "evidences_response_id_idx" on "evidences"("response_id");
create index "audit_logs_entity_entity_id_idx" on "audit_logs"("entity", "entity_id");
