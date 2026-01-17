-- AlterTable
ALTER TABLE "assessment_releases" ADD COLUMN "base_release_id" TEXT;

-- CreateIndex
CREATE INDEX "assessment_releases_base_release_id_idx" ON "assessment_releases"("base_release_id");

-- AddForeignKey
ALTER TABLE "assessment_releases" ADD CONSTRAINT "assessment_releases_base_release_id_fkey" FOREIGN KEY ("base_release_id") REFERENCES "assessment_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
