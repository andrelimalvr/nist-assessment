-- Add soft delete to assessments
alter table "assessments"
  add column "deleted_at" timestamp with time zone;

create index "assessments_deleted_at_idx" on "assessments"("deleted_at");
