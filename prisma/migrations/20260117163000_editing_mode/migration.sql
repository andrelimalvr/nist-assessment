-- CreateEnum
CREATE TYPE "EditingMode" AS ENUM ('LOCKED_ADMIN_ONLY', 'UNLOCKED_FOR_ASSESSORS');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "editing_mode" "EditingMode" NOT NULL DEFAULT 'UNLOCKED_FOR_ASSESSORS',
ADD COLUMN "editing_locked_by_user_id" TEXT,
ADD COLUMN "editing_locked_at" TIMESTAMP(3),
ADD COLUMN "editing_lock_note" TEXT;

-- CreateIndex
CREATE INDEX "assessments_editing_mode_idx" ON "assessments"("editing_mode");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_editing_locked_by_user_id_fkey" FOREIGN KEY ("editing_locked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
