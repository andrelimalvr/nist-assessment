import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { AuditAction, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { buildAssessmentSnapshot, normalizeSnapshot } from "@/lib/assessment-release";
import { buildAssessmentReportHtml } from "@/lib/report/assessment-report";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestContext } from "@/lib/audit/request";

export const runtime = "nodejs";

type SnapshotRecord = {
  id: string;
  type: string;
  label: string | null;
  createdAt: Date;
  snapshot: any;
};

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
    include: { organization: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment nao encontrado" }, { status: 404 });
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso a organizacao" }, { status: 403 });
  }

  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "official" ? "official" : "draft";

  const snapshotRecords = await prisma.assessmentSnapshot.findMany({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, label: true, createdAt: true, snapshot: true }
  });

  const snapshots: SnapshotRecord[] = snapshotRecords.map((record) => ({
    ...record,
    snapshot: normalizeSnapshot(record.snapshot)
  }));

  const approvedSnapshots = snapshots.filter((snapshot) => snapshot.type === "APPROVED");
  const latestApproved = approvedSnapshots[approvedSnapshots.length - 1] ?? null;

  let currentLabel = "Rascunho atual";
  let currentSnapshot = await buildAssessmentSnapshot(assessment.id);
  let currentSnapshotId: string | null = null;

  if (view === "official" && latestApproved) {
    currentSnapshot = latestApproved.snapshot;
    currentLabel = latestApproved.label
      ? `${latestApproved.label} (Aprovado)`
      : `Aprovado ${latestApproved.createdAt.toISOString().slice(0, 10)}`;
    currentSnapshotId = latestApproved.id;
  }

  let previousSnapshot: SnapshotRecord | null = null;
  if (view === "draft" && latestApproved) {
    previousSnapshot = latestApproved;
  } else if (snapshots.length > 1) {
    previousSnapshot = snapshots[snapshots.length - 2];
  } else if (snapshots.length === 1) {
    previousSnapshot = snapshots[0];
  }

  const previousLabel = previousSnapshot
    ? previousSnapshot.label
      ? `${previousSnapshot.label}`
      : `Snapshot ${previousSnapshot.createdAt.toISOString().slice(0, 10)}`
    : "Sem comparativo";

  const timeline = snapshots.map((snapshot) => ({
    label: snapshot.label || snapshot.createdAt.toISOString().slice(0, 10),
    score: snapshot.snapshot?.totals?.weightedScore ?? 0,
    coverage: snapshot.snapshot?.totals?.coverageRate ?? 0
  }));

  if (view === "draft") {
    timeline.push({
      label: "Atual",
      score: currentSnapshot.totals.weightedScore,
      coverage: currentSnapshot.totals.coverageRate
    });
  }

  const tasks = currentSnapshot.tasks.map((task) => ({
    taskId: task.taskId,
    taskName: task.taskName,
    groupId: task.groupId,
    gap: task.gap,
    weight: task.weight,
    priority: task.gap * task.weight,
    hasEvidence: task.evidenceCount > 0,
    owner: task.owner
  }));

  const ranked = tasks.sort((a, b) => b.priority - a.priority);
  const top = ranked.slice(0, 10);
  const plan30 = top.slice(0, 3);
  const plan60 = top.slice(3, 6);
  const plan90 = top.slice(6, 10);

  const html = buildAssessmentReportHtml({
    generatedAt: new Date(),
    assessment: {
      organizationName: assessment.organization.name,
      assessmentName: assessment.name,
      unit: assessment.unit,
      scope: assessment.scope,
      owner: assessment.assessmentOwner,
      designGoal: assessment.dgLevel,
      startDate: assessment.startDate,
      reviewDate: assessment.reviewDate
    },
    current: { label: currentLabel, snapshot: currentSnapshot },
    previous: previousSnapshot
      ? { label: previousLabel, snapshot: previousSnapshot.snapshot }
      : null,
    timeline,
    cisControls: currentSnapshot.cis.controls,
    igStats: currentSnapshot.cis.igStats,
    roadmap: {
      top,
      plan30,
      plan60,
      plan90
    }
  });

  const browser = await chromium.launch();
  let pdf: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("screen");
    pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" }
    });
  } finally {
    await browser.close();
  }

  await logAuditEvent({
    action: AuditAction.EXPORT,
    entityType: "Report",
    entityId: assessment.id,
    organizationId: assessment.organizationId,
    actor: { id: session.user.id, email: session.user.email, role: session.user.role },
    requestContext: { ...getRequestContext(), route: new URL(request.url).pathname },
    metadata: {
      reportType: "assessment_pdf",
      assessmentId: assessment.id,
      snapshotIdsUsed: {
        current: currentSnapshotId,
        previous: previousSnapshot?.id ?? null
      }
    }
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"ssdf-report-${assessment.id}.pdf\"`
    }
  });
}
