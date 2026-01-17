import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { AssessmentReleaseStatus, Role, SsdfStatus } from "@prisma/client";
import AssessmentTable from "@/components/assessment/assessment-table";
import AssessmentReleaseControls from "@/components/assessment/assessment-release-controls";
import AssessmentEditingControls from "@/components/assessment/assessment-editing-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { isReleaseLocked } from "@/lib/assessment-release";
import { canEditAssessment } from "@/lib/assessment-editing";
import { ensureOrganizationAccess } from "@/lib/tenant";
import { MAX_MATURITY_LEVEL } from "@/lib/ssdf";

export default async function AssessmentDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: {
    group?: string;
    practice?: string;
    status?: string;
    applicable?: string;
    owner?: string;
    team?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const allowEdit = canEdit(session?.user?.role);

  const assessment = await prisma.assessment.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      organization: true,
      editingLockedByUser: { select: { name: true, email: true } }
    }
  });

  if (!assessment) {
    notFound();
  }

  const hasAccess = await ensureOrganizationAccess(session, assessment.organizationId);
  if (!hasAccess) {
    notFound();
  }

  const groups = await prisma.ssdfGroup.findMany({ orderBy: { id: "asc" } });
  const practices = await prisma.ssdfPractice.findMany({ orderBy: { id: "asc" } });

  const where: any = {
    assessmentId: assessment.id
  };

  if (searchParams?.status) {
    where.status = searchParams.status;
  }

  if (searchParams?.applicable) {
    if (searchParams.applicable === "sim") {
      where.status = { not: SsdfStatus.NOT_APPLICABLE };
    }
    if (searchParams.applicable === "nao") {
      where.status = SsdfStatus.NOT_APPLICABLE;
    }
  }

  if (searchParams?.owner) {
    where.owner = { contains: searchParams.owner, mode: "insensitive" };
  }

  if (searchParams?.team) {
    where.team = { contains: searchParams.team, mode: "insensitive" };
  }

  if (searchParams?.group || searchParams?.practice) {
    where.ssdfTask = {
      practice: searchParams.group ? { groupId: searchParams.group } : undefined,
      practiceId: searchParams.practice || undefined
    };
  }

  const responses = await prisma.assessmentSsdfTaskResult.findMany({
    where,
    include: {
      ssdfTask: {
        include: {
          practice: { include: { group: true } }
        }
      }
    },
    orderBy: { ssdfTaskId: "asc" }
  });

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: assessment.id },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? AssessmentReleaseStatus.DRAFT;
  const isLocked = isReleaseLocked(releaseStatus);
  const canEditAssessmentRows = canEditAssessment({
    role: session?.user?.role,
    releaseStatus,
    editingMode: assessment.editingMode
  });
  const showReadOnlyBanner =
    session?.user?.role === Role.ASSESSOR &&
    releaseStatus !== AssessmentReleaseStatus.DRAFT;

  const rows = responses.map((response) => ({
    id: response.id,
    taskId: response.ssdfTask.id,
    taskName: response.ssdfTask.name,
    practiceId: response.ssdfTask.practice.id,
    practiceName: response.ssdfTask.practice.name,
    groupId: response.ssdfTask.practice.group.id,
    examples: response.ssdfTask.examples,
    references: response.ssdfTask.references,
    status: response.status,
    maturityLevel: response.maturityLevel,
    targetLevel: response.targetLevel,
    weight: response.weight,
    gap: response.targetLevel - response.maturityLevel,
    priority: (response.targetLevel - response.maturityLevel) * response.weight,
    progressWeighted:
      (response.maturityLevel / MAX_MATURITY_LEVEL) * response.weight,
    owner: response.owner,
    team: response.team,
    dueDate: response.dueDate ? response.dueDate.toISOString().slice(0, 10) : null,
    lastReview: response.lastReview ? response.lastReview.toISOString().slice(0, 10) : null,
    evidenceText: response.evidenceText,
    evidenceLinks: response.evidenceLinks,
    comments: response.comments
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Assessment
        </h1>
        <p className="text-muted-foreground">
          {assessment.organization.name} - {assessment.name} - {assessment.unit} - {assessment.scope}
        </p>
      </div>

      {showReadOnlyBanner ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este assessment esta aprovado ou em revisao e nao pode ser editado. Solicite ao admin liberar uma nova revisao.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumo do escopo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Responsavel</p>
            <p className="font-semibold">{assessment.assessmentOwner}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p className="font-semibold">{formatDate(assessment.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revisao</p>
            <p className="font-semibold">{formatDate(assessment.reviewDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Notas</p>
            <p className="text-sm text-muted-foreground">{assessment.notes || "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicacao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <AssessmentReleaseControls
            assessmentId={assessment.id}
            status={releaseStatus}
            canSubmit={allowEdit}
            canApprove={session?.user?.role === Role.ADMIN}
          />
          <AssessmentEditingControls
            assessmentId={assessment.id}
            editingMode={assessment.editingMode}
            releaseStatus={releaseStatus}
            lockedByName={assessment.editingLockedByUser?.name}
            lockedByEmail={assessment.editingLockedByUser?.email}
            lockedAt={assessment.editingLockedAt?.toISOString() ?? null}
            lockNote={assessment.editingLockNote}
            canToggle={session?.user?.role === Role.ADMIN}
          />
          {isLocked ? (
            <p className="text-sm text-muted-foreground">
              Edicoes bloqueadas enquanto o assessment estiver em revisao ou aprovado.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" method="GET">
            <select
              name="group"
              defaultValue={searchParams?.group || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.id}
                </option>
              ))}
            </select>
            <select
              name="practice"
              defaultValue={searchParams?.practice || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Pratica</option>
              {practices.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {practice.id}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={searchParams?.status || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Status</option>
              <option value={SsdfStatus.NOT_STARTED}>Nao iniciado</option>
              <option value={SsdfStatus.IN_PROGRESS}>Em andamento</option>
              <option value={SsdfStatus.IMPLEMENTED}>Implementado</option>
              <option value={SsdfStatus.NOT_APPLICABLE}>Nao aplicavel</option>
            </select>
            <select
              name="applicable"
              defaultValue={searchParams?.applicable || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Aplicavel</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
            <input
              name="owner"
              defaultValue={searchParams?.owner || ""}
              placeholder="Responsavel"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
            <input
              name="team"
              defaultValue={searchParams?.team || ""}
              placeholder="Area/Time"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
            <button
              type="submit"
              className="md:col-span-6 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar filtros
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabela principal</CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentTable
            assessmentId={assessment.id}
            responses={rows}
            canEdit={canEditAssessmentRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
