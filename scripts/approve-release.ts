import { AssessmentReleaseStatus, AuditAction, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildAssessmentSnapshot } from "../src/lib/assessment-release";
import { logAuditEvent } from "../src/lib/audit/log";

const NOTE_SUBMIT = "Envio para revisao via script";
const NOTE_APPROVE = "Aprovado via script";

async function main() {
  let assessmentId = process.env.ASSESSMENT_ID || "demo-assessment-1";
  let assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    select: { id: true, organizationId: true }
  });

  if (!assessment) {
    assessment = await prisma.assessment.findFirst({
      where: { deletedAt: null },
      select: { id: true, organizationId: true }
    });
    if (!assessment) {
      throw new Error("Nenhum assessment encontrado.");
    }
    console.log(`Assessment ${assessmentId} nao encontrado. Usando ${assessment.id}.`);
    assessmentId = assessment.id;
  }

  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null }
  });

  if (!admin) {
    throw new Error("Admin nao encontrado.");
  }

  let release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId },
    orderBy: { createdAt: "desc" }
  });

  if (!release) {
    release = await prisma.assessmentRelease.create({
      data: {
        assessmentId,
        status: AssessmentReleaseStatus.DRAFT,
        createdByUserId: admin.id
      }
    });
  }

  const requestContext = {
    requestId: "script",
    ip: "127.0.0.1",
    userAgent: "script"
  };

  if (release.status === AssessmentReleaseStatus.DRAFT) {
    const previous = release.status;
    release = await prisma.assessmentRelease.update({
      where: { id: release.id },
      data: { status: AssessmentReleaseStatus.IN_REVIEW, notes: NOTE_SUBMIT }
    });

    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "AssessmentRelease",
      entityId: release.id,
      fieldName: "status",
      oldValue: previous,
      newValue: release.status,
      organizationId: assessment.organizationId,
      actor: { id: admin.id, email: admin.email, role: admin.role },
      requestContext,
      metadata: { notes: NOTE_SUBMIT }
    });
  }

  if (release.status === AssessmentReleaseStatus.IN_REVIEW) {
    const previous = release.status;
    const snapshot = await buildAssessmentSnapshot(assessmentId);
    release = await prisma.assessmentRelease.update({
      where: { id: release.id },
      data: {
        status: AssessmentReleaseStatus.APPROVED,
        notes: NOTE_APPROVE,
        approvedAt: new Date(),
        approvedByUserId: admin.id,
        snapshot
      }
    });

    await logAuditEvent({
      action: AuditAction.UPDATE,
      entityType: "AssessmentRelease",
      entityId: release.id,
      fieldName: "status",
      oldValue: previous,
      newValue: release.status,
      organizationId: assessment.organizationId,
      actor: { id: admin.id, email: admin.email, role: admin.role },
      requestContext,
      metadata: { notes: NOTE_APPROVE }
    });
  }

  if (release.status === AssessmentReleaseStatus.APPROVED) {
    console.log(`Release aprovado para assessment ${assessmentId}.`);
  } else {
    console.log(`Release atualizado para status ${release.status} no assessment ${assessmentId}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
