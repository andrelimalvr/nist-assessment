-- CreateEnum
CREATE TYPE "AssessmentReleaseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "assessment_cis_results" DROP CONSTRAINT "assessment_cis_results_assessment_id_fkey";

-- DropForeignKey
ALTER TABLE "assessment_ssdf_task_results" DROP CONSTRAINT "assessment_ssdf_task_results_assessment_id_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_ssdf_result_id_fkey";

-- DropForeignKey
ALTER TABLE "user_organizations" DROP CONSTRAINT "user_organizations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "user_organizations" DROP CONSTRAINT "user_organizations_user_id_fkey";

-- DropIndex
DROP INDEX "audit_logs_action_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_actor_user_id_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_entity_type_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_field_name_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_org_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_request_id_idx";

-- DropIndex
DROP INDEX "audit_logs_timestamp_desc_idx";

-- AlterTable
ALTER TABLE "assessment_cis_results" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "assessment_ssdf_task_results" RENAME CONSTRAINT "assessment_task_responses_pkey" TO "assessment_ssdf_task_results_pkey";

-- AlterTable
ALTER TABLE "assessment_ssdf_task_results" ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_review" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "review_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "entity" DROP NOT NULL,
ALTER COLUMN "entity_id" DROP NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "evidences" ADD COLUMN     "review_status" "EvidenceReviewStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "valid_until" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ssdf_cis_mappings" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_organizations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "assessment_releases" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "status" "AssessmentReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "assessment_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_task_histories" (
    "id" TEXT NOT NULL,
    "assessment_task_result_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" TEXT,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,

    CONSTRAINT "assessment_task_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_histories" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" TEXT,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "evidence_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_releases_assessment_id_idx" ON "assessment_releases"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_releases_status_idx" ON "assessment_releases"("status");

-- CreateIndex
CREATE INDEX "assessment_task_histories_assessment_task_result_id_idx" ON "assessment_task_histories"("assessment_task_result_id");

-- CreateIndex
CREATE INDEX "assessment_task_histories_changed_at_idx" ON "assessment_task_histories"("changed_at");

-- CreateIndex
CREATE INDEX "evidence_histories_evidence_id_idx" ON "evidence_histories"("evidence_id");

-- CreateIndex
CREATE INDEX "evidence_histories_changed_at_idx" ON "evidence_histories"("changed_at");

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_releases" ADD CONSTRAINT "assessment_releases_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_releases" ADD CONSTRAINT "assessment_releases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_releases" ADD CONSTRAINT "assessment_releases_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_ssdf_task_results" ADD CONSTRAINT "assessment_ssdf_task_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_ssdf_result_id_fkey" FOREIGN KEY ("ssdf_result_id") REFERENCES "assessment_ssdf_task_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_task_histories" ADD CONSTRAINT "assessment_task_histories_assessment_task_result_id_fkey" FOREIGN KEY ("assessment_task_result_id") REFERENCES "assessment_ssdf_task_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_task_histories" ADD CONSTRAINT "assessment_task_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_histories" ADD CONSTRAINT "evidence_histories_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_histories" ADD CONSTRAINT "evidence_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_cis_results" ADD CONSTRAINT "assessment_cis_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "assessment_cis_results_assessment_id_cis_control_id_cis_safegua" RENAME TO "assessment_cis_results_assessment_id_cis_control_id_cis_saf_key";

-- RenameIndex
ALTER INDEX "ssdf_cis_mappings_ssdf_task_id_cis_control_id_cis_safeguard_id_" RENAME TO "ssdf_cis_mappings_ssdf_task_id_cis_control_id_cis_safeguard_key";
