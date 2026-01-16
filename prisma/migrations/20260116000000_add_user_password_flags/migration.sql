-- Add must_change_password and password_changed_at to users
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
