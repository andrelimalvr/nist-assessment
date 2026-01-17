import AssessmentPicker from "@/components/assessment/assessment-picker";
import ExportMenu from "@/components/assessment/export-menu";
import RoadmapTopActions from "@/components/roadmap/roadmap-top-actions";
import DrilldownDrawer from "@/components/assessment/drilldown-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { Role, SsdfStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import {
  buildAssessmentSnapshot,
  getLatestApprovedSnapshot,
  AssessmentSnapshot
} from "@/lib/assessment-release";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { assessmentId?: string };
}) {
  const view = searchParams?.view === "official" ? "official" : "draft";
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
          Dashboard
        </h1>
        <p className="text-muted-foreground">Nenhum assessment encontrado.</p>
      </div>
    );
  }

  let snapshot: AssessmentSnapshot | null = null;
  let approvedReleaseId: string | null = null;

  if (view === "official") {
    const approved = await getLatestApprovedSnapshot(selected.id);
    if (approved?.snapshot) {
      snapshot = approved.snapshot as AssessmentSnapshot;
      approvedReleaseId = approved.releaseId ?? approved.id;
    }
  } else {
    snapshot = await buildAssessmentSnapshot(selected.id);
  }

  const showMetrics = view === "draft" || approvedReleaseId !== null;

  const topActionsRaw = await prisma.assessmentSsdfTaskResult.findMany({
    where: { assessmentId: selected.id, status: { not: SsdfStatus.NOT_APPLICABLE } },
    include: {
      ssdfTask: { include: { practice: { include: { group: true } } } }
    }
  });

  const topActions = topActionsRaw
    .map((response) => {
      const gap = Math.max(response.targetLevel - response.maturityLevel, 0);
      const priority = gap * response.weight;
      return {
        id: response.id,
        groupId: response.ssdfTask.practice.group.id,
        taskId: response.ssdfTask.id,
        taskName: response.ssdfTask.name,
        gap,
        weight: response.weight,
        priority,
        statusLabel: response.status,
        owner: response.owner
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
  const stats = snapshot?.groupStats ?? [];
  const totals =
    snapshot?.totals ?? { total: 0, applicable: 0, implemented: 0, weightedProgress: 0, weightSum: 0 };

  const overallImplementedRate = totals.applicable > 0 ? totals.implemented / totals.applicable : 0;
  const overallScore = totals.weightSum > 0 ? totals.weightedProgress / totals.weightSum : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Visao geral do assessment e score ponderado por grupo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-white/80 p-1 text-xs dark:bg-slate-900/70">
            <a
              className={`rounded-full px-3 py-1 ${view === "draft" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              href={`/dashboard?assessmentId=${selected.id}&view=draft`}
            >
              Rascunho
            </a>
            <a
              className={`rounded-full px-3 py-1 ${view === "official" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              href={`/dashboard?assessmentId=${selected.id}&view=official`}
            >
              Oficial
            </a>
          </div>
          <AssessmentPicker
            assessments={assessmentOptions}
            selectedId={selected.id}
            basePath="/dashboard"
            extraParams={{ view }}
          />
          <ExportMenu assessmentId={selected.id} reportView={view} />
        </div>
      </div>

      {view === "official" && !approvedReleaseId ? (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard oficial indisponivel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum release aprovado para este assessment. Envie para revisao e aprove para publicar.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showMetrics ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tarefas aplicaveis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totals.applicable}</p>
              <p className="text-sm text-muted-foreground">de {totals.total} tarefas no total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>% Implementadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatPercent(overallImplementedRate, 1)}</p>
              <p className="text-sm text-muted-foreground">{totals.implemented} implementadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Score ponderado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatNumber(overallScore * 100, 1)}</p>
              <p className="text-sm text-muted-foreground">Score 0-100</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showMetrics ? (
        <Card>
          <CardHeader>
            <CardTitle>Resumo por grupo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {stats.map((group) => {
                const implementedRate = group.applicable > 0 ? group.implemented / group.applicable : 0;
                const weightedScore = group.weightSum > 0 ? group.weightedProgress / group.weightSum : 0;
                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{group.id}</span>
                      <span>{formatNumber(weightedScore * 100, 1)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(weightedScore * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPercent(implementedRate, 1)} implementadas
                    </p>
                  </div>
                );
              })}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Tarefas (Total)</TableHead>
                  <TableHead>Aplicaveis (Sim)</TableHead>
                  <TableHead>Implementadas</TableHead>
                  <TableHead>% Implementadas</TableHead>
                  <TableHead>Score ponderado (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((group) => {
                  const implementedRate = group.applicable > 0 ? group.implemented / group.applicable : 0;
                  const weightedScore = group.weightSum > 0 ? group.weightedProgress / group.weightSum : 0;
                  return (
                    <TableRow key={group.id}>
                      <TableCell className="font-semibold">
                        <DrilldownDrawer
                          assessmentId={selected.id}
                          type="group"
                          targetId={group.id}
                          label={group.id}
                          className="font-semibold text-primary hover:underline"
                        />
                      </TableCell>
                      <TableCell>{group.total}</TableCell>
                      <TableCell>{group.applicable}</TableCell>
                      <TableCell>{group.implemented}</TableCell>
                      <TableCell>{formatPercent(implementedRate, 1)}</TableCell>
                      <TableCell>{formatNumber(weightedScore * 100, 1)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="font-semibold">TOTAL</TableCell>
                  <TableCell>{totals.total}</TableCell>
                  <TableCell>{totals.applicable}</TableCell>
                  <TableCell>{totals.implemented}</TableCell>
                  <TableCell>{formatPercent(overallImplementedRate, 1)}</TableCell>
                  <TableCell>{formatNumber(overallScore * 100, 1)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {showMetrics ? (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 proximas acoes</CardTitle>
          </CardHeader>
          <CardContent>
            <RoadmapTopActions rows={topActions} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
