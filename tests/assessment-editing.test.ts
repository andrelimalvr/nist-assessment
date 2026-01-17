import assert from "node:assert/strict";
import { AssessmentReleaseStatus, EditingMode, Role } from "@prisma/client";
import { canEditAssessment } from "../src/lib/assessment-editing";

assert.equal(
  canEditAssessment({
    role: Role.ADMIN,
    releaseStatus: AssessmentReleaseStatus.APPROVED,
    editingMode: EditingMode.LOCKED_ADMIN_ONLY
  }),
  true
);

assert.equal(
  canEditAssessment({
    role: Role.ASSESSOR,
    releaseStatus: AssessmentReleaseStatus.DRAFT,
    editingMode: EditingMode.UNLOCKED_FOR_ASSESSORS
  }),
  true
);

assert.equal(
  canEditAssessment({
    role: Role.ASSESSOR,
    releaseStatus: AssessmentReleaseStatus.APPROVED,
    editingMode: EditingMode.UNLOCKED_FOR_ASSESSORS
  }),
  false
);

assert.equal(
  canEditAssessment({
    role: Role.ASSESSOR,
    releaseStatus: AssessmentReleaseStatus.DRAFT,
    editingMode: EditingMode.LOCKED_ADMIN_ONLY
  }),
  false
);

assert.equal(
  canEditAssessment({
    role: Role.VIEWER,
    releaseStatus: AssessmentReleaseStatus.DRAFT,
    editingMode: EditingMode.UNLOCKED_FOR_ASSESSORS
  }),
  false
);
