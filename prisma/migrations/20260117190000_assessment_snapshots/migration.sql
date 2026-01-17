-- CreateEnum
CREATE TYPE "AssessmentSnapshotType" AS ENUM ('AUTO', 'MANUAL', 'APPROVED');

-- CreateTable
CREATE TABLE "assessment_snapshots" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "release_id" TEXT,
    "type" "AssessmentSnapshotType" NOT NULL DEFAULT 'AUTO',
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "assessment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_snapshots_assessment_id_idx" ON "assessment_snapshots"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_snapshots_release_id_idx" ON "assessment_snapshots"("release_id");

-- CreateIndex
CREATE INDEX "assessment_snapshots_type_idx" ON "assessment_snapshots"("type");

-- CreateIndex
CREATE INDEX "assessment_snapshots_created_at_idx" ON "assessment_snapshots"("created_at");

-- AddForeignKey
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "assessment_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_snapshots" ADD CONSTRAINT "assessment_snapshots_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
