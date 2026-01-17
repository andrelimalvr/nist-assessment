import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, organizationId: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  const controlId = url.searchParams.get("controlId");

  if (!groupId && !controlId) {
    return NextResponse.json({ error: "Informe groupId ou controlId" }, { status: 400 });
  }

  if (groupId) {
    const results = await prisma.assessmentSsdfTaskResult.findMany({
      where: {
        assessmentId: assessment.id,
        ssdfTask: { practice: { groupId } }
      },
      include: {
        ssdfTask: {
          include: {
            practice: { include: { group: true } }
          }
        }
      },
      orderBy: { ssdfTaskId: "asc" }
    });

    const resultIds = results.map((result) => result.id);
    const taskIds = results.map((result) => result.ssdfTaskId);

    const evidences = resultIds.length
      ? await prisma.evidence.findMany({
          where: { ssdfResultId: { in: resultIds } },
          orderBy: { createdAt: "desc" },
          include: { ssdfResult: { select: { ssdfTaskId: true } } }
        })
      : [];

    const mappings = taskIds.length
      ? await prisma.ssdfCisMapping.findMany({
          where: { ssdfTaskId: { in: taskIds } },
          include: { cisControl: true, cisSafeguard: true }
        })
      : [];

    return NextResponse.json({
      tasks: results.map((result) => ({
        id: result.id,
        taskId: result.ssdfTaskId,
        taskName: result.ssdfTask.name,
        groupId: result.ssdfTask.practice.group.id,
        status: result.status,
        maturity: result.maturityLevel,
        owner: result.owner
      })),
      evidences: evidences.map((evidence) => ({
        id: evidence.id,
        taskId: evidence.ssdfResult.ssdfTaskId,
        description: evidence.description,
        reviewStatus: evidence.reviewStatus,
        link: evidence.link,
        owner: evidence.owner
      })),
      mappings: mappings.map((mapping) => ({
        id: mapping.id,
        ssdfTaskId: mapping.ssdfTaskId,
        cisControlId: mapping.cisControlId,
        cisSafeguardId: mapping.cisSafeguardId,
        mappingType: mapping.mappingType
      }))
    });
  }

  const mappings = await prisma.ssdfCisMapping.findMany({
    where: {
      OR: [
        { cisControlId: controlId },
        { cisSafeguard: { controlId: controlId ?? undefined } }
      ]
    },
    include: {
      ssdfTask: { include: { practice: { include: { group: true } } } },
      cisControl: true,
      cisSafeguard: true
    }
  });

  const taskIds = Array.from(new Set(mappings.map((mapping) => mapping.ssdfTaskId)));
  const results = taskIds.length
    ? await prisma.assessmentSsdfTaskResult.findMany({
        where: { assessmentId: assessment.id, ssdfTaskId: { in: taskIds } },
        include: {
          ssdfTask: { include: { practice: { include: { group: true } } } }
        }
      })
    : [];

  const resultIds = results.map((result) => result.id);
  const evidences = resultIds.length
    ? await prisma.evidence.findMany({
        where: { ssdfResultId: { in: resultIds } },
        orderBy: { createdAt: "desc" },
        include: { ssdfResult: { select: { ssdfTaskId: true } } }
      })
    : [];

  return NextResponse.json({
    tasks: results.map((result) => ({
      id: result.id,
      taskId: result.ssdfTaskId,
      taskName: result.ssdfTask.name,
      groupId: result.ssdfTask.practice.group.id,
      status: result.status,
      maturity: result.maturityLevel,
      owner: result.owner
    })),
    evidences: evidences.map((evidence) => ({
      id: evidence.id,
      taskId: evidence.ssdfResult.ssdfTaskId,
      description: evidence.description,
      reviewStatus: evidence.reviewStatus,
      link: evidence.link,
      owner: evidence.owner
    })),
    mappings: mappings.map((mapping) => ({
      id: mapping.id,
      ssdfTaskId: mapping.ssdfTaskId,
      cisControlId: mapping.cisControlId,
      cisSafeguardId: mapping.cisSafeguardId,
      mappingType: mapping.mappingType
    }))
  });
}
