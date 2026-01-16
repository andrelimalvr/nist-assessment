import { NextResponse } from "next/server";
import { z } from "zod";
import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const payloadSchema = z.object({
  applicable: z.boolean(),
  status: z.nativeEnum(TaskStatus),
  maturity: z.number().min(0).max(5),
  target: z.number().min(0).max(5),
  weight: z.number().min(1).max(5),
  owner: z.string().optional(),
  team: z.string().optional(),
  dueDate: z.string().optional(),
  lastReview: z.string().optional(),
  evidenceText: z.string().optional(),
  evidenceLinks: z.string().optional(),
  notes: z.string().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; responseId: string } }
) {
  const session = await requireAuth([Role.ADMIN, Role.ASSESSOR]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const existing = await prisma.assessmentTaskResponse.findUnique({
    where: { id: params.responseId }
  });

  if (!existing || existing.assessmentId !== params.id) {
    return NextResponse.json({ error: "Resposta nao encontrada" }, { status: 404 });
  }

  const data = {
    applicable: parsed.data.applicable,
    status: parsed.data.status,
    maturity: parsed.data.maturity,
    target: parsed.data.target,
    weight: parsed.data.weight,
    owner: parsed.data.owner || null,
    team: parsed.data.team || null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    lastReview: parsed.data.lastReview ? new Date(parsed.data.lastReview) : null,
    evidenceText: parsed.data.evidenceText || null,
    evidenceLinks: parsed.data.evidenceLinks || null,
    notes: parsed.data.notes || null
  };

  const updated = await prisma.assessmentTaskResponse.update({
    where: { id: params.responseId },
    data
  });

  const beforeJson = JSON.parse(JSON.stringify(existing));
  const afterJson = JSON.parse(JSON.stringify(updated));

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entity: "AssessmentTaskResponse",
      entityId: params.responseId,
      action: "update",
      before: beforeJson,
      after: afterJson
    }
  });

  return NextResponse.json({ success: true });
}
