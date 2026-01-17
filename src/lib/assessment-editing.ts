import { AssessmentReleaseStatus, EditingMode, Role } from "@prisma/client";

type EditingContext = {
  role?: Role | string | null;
  releaseStatus?: AssessmentReleaseStatus | null;
  editingMode?: EditingMode | null;
};

export function canEditAssessment(context: EditingContext) {
  if (context.role === Role.ADMIN) return true;
  if (context.role !== Role.ASSESSOR) return false;

  const editingMode = context.editingMode ?? EditingMode.UNLOCKED_FOR_ASSESSORS;
  if (editingMode !== EditingMode.UNLOCKED_FOR_ASSESSORS) return false;

  const status = context.releaseStatus ?? AssessmentReleaseStatus.DRAFT;
  return status === AssessmentReleaseStatus.DRAFT;
}

export function isEditingUnlocked(mode?: EditingMode | null) {
  return (mode ?? EditingMode.UNLOCKED_FOR_ASSESSORS) === EditingMode.UNLOCKED_FOR_ASSESSORS;
}
