-- Add soft delete to users
alter table "users"
  add column "deleted_at" timestamp with time zone;

create index "users_deleted_at_idx" on "users"("deleted_at");
