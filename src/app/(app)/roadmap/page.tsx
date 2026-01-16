import AssessmentPicker from "@/components/assessment/assessment-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RoadmapTable from "@/components/roadmap/roadmap-table";
import { prisma } from "@/lib/prisma";
import { statusLabels } from "@/lib/ssdf";
import { getServerSession } from "next-auth";
import { Role, SsdfStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAccessibleOrganizationIds } from "@/lib/tenant";

export default async function RoadmapPage({
  searchParams
}: {
  searchParams?: {
    assessmentId?: string;
    group?: string;
    owner?: string;
    status?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const accessibleOrgIds = await getAccessibleOrganizationIds(session);
  const assessmentFilter =
    session?.user?.role === Role.ADMIN || accessibleOrgIds === null
      ? { organization: { is: { deletedAt: null } }, deletedAt: null }
      : { organizationId: { in: accessibleOrgIds }, deletedAt: null };

  const assessments = await prisma.assessment.findMany({
    where: assessmentFilter,
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

  const assessmentOptions = assessments.map((assessment) => ({
    id: assessment.id,
    label: `${assessment.organization.name} - ${assessment.name} - ${assessment.unit}`
  }));

  const selectedId = searchParams?.assessmentId ?? assessments[0]?.id;
  const selected = assessments.find((item) => item.id === selectedId);

  if (!selected) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Roadmap
        </h1>
        <p className="text-muted-foreground">Nenhum assessment encontrado.</p>
      </div>
    );
  }

  const where: any = {
    assessmentId: selected.id,
    status: { not: SsdfStatus.NOT_APPLICABLE }
  };

  if (searchParams?.owner) {
    where.owner = { contains: searchParams.owner, mode: "insensitive" };
  }

  if (searchParams?.status) {
    where.status = searchParams.status;
  }

  if (searchParams?.group) {
    where.ssdfTask = { practice: { groupId: searchParams.group } };
  }

  const responses = await prisma.assessmentSsdfTaskResult.findMany({
    where,
    include: {
      ssdfTask: {
        include: {
          practice: { include: { group: true } }
        }
      }
    }
  });

  const items = responses.map((response) => {
    const gap = response.targetLevel - response.maturityLevel;
    const priority = gap * response.weight;
    return {
      id: response.id,
      groupId: response.ssdfTask.practice.group.id,
      taskId: response.ssdfTask.id,
      taskName: response.ssdfTask.name,
      statusLabel: statusLabels[response.status],
      gap,
      priority,
      maturity: response.maturityLevel,
      target: response.targetLevel,
      weight: response.weight,
      owner: response.owner,
      team: response.team
    };
  });

  const groups = await prisma.ssdfGroup.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Roadmap
          </h1>
          <p className="text-muted-foreground">
            Priorize tarefas por gap e peso para orientar o plano de acao.
          </p>
        </div>
        <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/roadmap" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" method="GET">
            <input type="hidden" name="assessmentId" value={selected.id} />
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
            <input
              name="owner"
              defaultValue={searchParams?.owner || ""}
              placeholder="Responsavel"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
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
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista priorizada</CardTitle>
        </CardHeader>
        <CardContent>
          <RoadmapTable rows={items} />
        </CardContent>
      </Card>
    </div>
  );
}
