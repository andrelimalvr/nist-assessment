-- Add enums
create type "SsdfStatus" as enum ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'NOT_APPLICABLE');
create type "CisStatus" as enum ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'NOT_APPLICABLE');
create type "MetricType" as enum ('QUANT', 'QUAL');
create type "MappingType" as enum ('DIRECT', 'PARTIAL', 'SUPPORTS');
create type "ImplementationGroup" as enum ('IG1', 'IG2', 'IG3');
create type "DgLevel" as enum ('DG1', 'DG2', 'DG3');

-- Add assessment fields
alter table "assessments"
  add column "name" text not null default 'Assessment',
  add column "dg_level" "DgLevel" not null default 'DG1';

update "assessments" set "name" = "unit" where "name" = 'Assessment';

-- User organizations (multi-tenant)
create table "user_organizations" (
  "user_id" text not null,
  "organization_id" text not null,
  "created_at" timestamp with time zone not null default now(),
  primary key ("user_id", "organization_id"),
  constraint "user_organizations_user_id_fkey" foreign key ("user_id") references "users"("id") on delete cascade on update cascade,
  constraint "user_organizations_organization_id_fkey" foreign key ("organization_id") references "organizations"("id") on delete cascade on update cascade
);

create index "user_organizations_organization_id_idx" on "user_organizations"("organization_id");

-- Rename assessment task responses to SSDF results
alter table "assessment_task_responses" rename to "assessment_ssdf_task_results";
alter table "assessment_ssdf_task_results" rename column "task_id" to "ssdf_task_id";
alter table "assessment_ssdf_task_results" rename column "maturity" to "maturity_level";
alter table "assessment_ssdf_task_results" rename column "target" to "target_level";
alter table "assessment_ssdf_task_results" rename column "notes" to "comments";

alter table "assessment_ssdf_task_results"
  add column "metric_value" double precision,
  add column "metric_type" "MetricType",
  add column "updated_by_id" text;

alter table "assessment_ssdf_task_results"
  alter column "status" drop default,
  alter column "status" type "SsdfStatus"
  using case
    when "status" = 'NAO_INICIADO' then 'NOT_STARTED'::"SsdfStatus"
    when "status" = 'EM_ANDAMENTO' then 'IN_PROGRESS'::"SsdfStatus"
    when "status" = 'IMPLEMENTADO' then 'IMPLEMENTED'::"SsdfStatus"
    when "status" = 'NA' then 'NOT_APPLICABLE'::"SsdfStatus"
    else 'NOT_STARTED'::"SsdfStatus"
  end;

alter table "assessment_ssdf_task_results"
  alter column "evidence_links" type text[]
  using case
    when "evidence_links" is null or "evidence_links" = '' then array[]::text[]
    else string_to_array("evidence_links", ',')
  end;

alter table "assessment_ssdf_task_results"
  alter column "status" set default 'NOT_STARTED',
  alter column "evidence_links" set default array[]::text[],
  alter column "target_level" set default 2;

alter table "assessment_ssdf_task_results" drop column "applicable";

alter table "assessment_ssdf_task_results"
  add constraint "assessment_ssdf_task_results_updated_by_id_fkey"
  foreign key ("updated_by_id") references "users"("id") on delete set null on update cascade;

alter table "assessment_ssdf_task_results"
  drop constraint "assessment_task_responses_assessment_id_fkey",
  drop constraint "assessment_task_responses_task_id_fkey";

alter table "assessment_ssdf_task_results"
  add constraint "assessment_ssdf_task_results_assessment_id_fkey"
  foreign key ("assessment_id") references "assessments"("id") on delete cascade on update cascade,
  add constraint "assessment_ssdf_task_results_ssdf_task_id_fkey"
  foreign key ("ssdf_task_id") references "ssdf_tasks"("id") on delete restrict on update cascade;

drop index "assessment_task_responses_assessment_id_status_idx";
drop index "assessment_task_responses_task_id_idx";
drop index "assessment_task_responses_assessment_id_task_id_key";

create unique index "assessment_ssdf_task_results_assessment_id_ssdf_task_id_key"
  on "assessment_ssdf_task_results"("assessment_id", "ssdf_task_id");
create index "assessment_ssdf_task_results_assessment_id_status_idx"
  on "assessment_ssdf_task_results"("assessment_id", "status");
create index "assessment_ssdf_task_results_ssdf_task_id_idx"
  on "assessment_ssdf_task_results"("ssdf_task_id");

-- Update evidences foreign key
alter table "evidences" rename column "response_id" to "ssdf_result_id";
alter table "evidences" drop constraint "evidences_response_id_fkey";
alter table "evidences"
  add constraint "evidences_ssdf_result_id_fkey"
  foreign key ("ssdf_result_id") references "assessment_ssdf_task_results"("id") on delete cascade on update cascade;

drop index "evidences_response_id_idx";
create index "evidences_ssdf_result_id_idx" on "evidences"("ssdf_result_id");

-- CIS controls and safeguards
create table "cis_controls" (
  "id" text primary key,
  "name" text not null,
  "description" text
);

create table "cis_safeguards" (
  "id" text primary key,
  "control_id" text not null,
  "name" text not null,
  "description" text,
  "implementation_group" "ImplementationGroup" not null,
  constraint "cis_safeguards_control_id_fkey" foreign key ("control_id") references "cis_controls"("id") on delete restrict on update cascade
);

create index "cis_safeguards_control_id_idx" on "cis_safeguards"("control_id");

-- SSDF -> CIS mappings
create table "ssdf_cis_mappings" (
  "id" text primary key,
  "ssdf_task_id" text not null,
  "cis_control_id" text,
  "cis_safeguard_id" text,
  "mapping_type" "MappingType" not null default 'DIRECT',
  "weight" double precision not null default 1,
  "notes" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null,
  constraint "ssdf_cis_mappings_ssdf_task_id_fkey" foreign key ("ssdf_task_id") references "ssdf_tasks"("id") on delete restrict on update cascade,
  constraint "ssdf_cis_mappings_cis_control_id_fkey" foreign key ("cis_control_id") references "cis_controls"("id") on delete set null on update cascade,
  constraint "ssdf_cis_mappings_cis_safeguard_id_fkey" foreign key ("cis_safeguard_id") references "cis_safeguards"("id") on delete set null on update cascade
);

create unique index "ssdf_cis_mappings_ssdf_task_id_cis_control_id_cis_safeguard_id_key"
  on "ssdf_cis_mappings"("ssdf_task_id", "cis_control_id", "cis_safeguard_id");
create index "ssdf_cis_mappings_ssdf_task_id_idx" on "ssdf_cis_mappings"("ssdf_task_id");
create index "ssdf_cis_mappings_cis_control_id_idx" on "ssdf_cis_mappings"("cis_control_id");
create index "ssdf_cis_mappings_cis_safeguard_id_idx" on "ssdf_cis_mappings"("cis_safeguard_id");

-- Assessment CIS results
create table "assessment_cis_results" (
  "id" text primary key,
  "assessment_id" text not null,
  "cis_control_id" text,
  "cis_safeguard_id" text,
  "derived_status" "CisStatus",
  "derived_maturity_level" integer,
  "derived_coverage_score" double precision,
  "derived_from_ssdf" boolean not null default true,
  "derived_from_task_ids" text[] not null default array[]::text[],
  "manual_override" boolean not null default false,
  "manual_status" "CisStatus",
  "manual_maturity_level" integer,
  "updated_by_id" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null,
  constraint "assessment_cis_results_assessment_id_fkey" foreign key ("assessment_id") references "assessments"("id") on delete cascade on update cascade,
  constraint "assessment_cis_results_cis_control_id_fkey" foreign key ("cis_control_id") references "cis_controls"("id") on delete set null on update cascade,
  constraint "assessment_cis_results_cis_safeguard_id_fkey" foreign key ("cis_safeguard_id") references "cis_safeguards"("id") on delete set null on update cascade,
  constraint "assessment_cis_results_updated_by_id_fkey" foreign key ("updated_by_id") references "users"("id") on delete set null on update cascade
);

create unique index "assessment_cis_results_assessment_id_cis_control_id_cis_safeguard_id_key"
  on "assessment_cis_results"("assessment_id", "cis_control_id", "cis_safeguard_id");
create index "assessment_cis_results_assessment_id_idx" on "assessment_cis_results"("assessment_id");
create index "assessment_cis_results_cis_control_id_idx" on "assessment_cis_results"("cis_control_id");
create index "assessment_cis_results_cis_safeguard_id_idx" on "assessment_cis_results"("cis_safeguard_id");

-- Audit log org reference
alter table "audit_logs"
  add column "organization_id" text;
create index "audit_logs_organization_id_idx" on "audit_logs"("organization_id");

-- Cleanup old enum
drop type "TaskStatus";
