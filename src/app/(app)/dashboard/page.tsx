import AssessmentPicker from "@/components/assessment/assessment-picker";
import ExportMenu from "@/components/assessment/export-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const GROUP_ORDER = ["PO", "PS", "PW", "RV"] as const;

type GroupStats = {
  id: string;
  name: string;
  total: number;
  applicable: number;
  implemented: number;
  weightedProgress: number;
  weightSum: number;
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { assessmentId?: string };
}) {
  const assessments = await prisma.assessment.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

  const assessmentOptions = assessments.map((assessment) => ({
    id: assessment.id,
    label: `${assessment.organization.name} - ${assessment.unit}`
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

  const responses = await prisma.assessmentTaskResponse.findMany({
    where: { assessmentId: selected.id },
    include: {
      task: {
        include: {
          practice: { include: { group: true } }
        }
      }
    }
  });

  const statsMap = new Map<string, GroupStats>();

  for (const response of responses) {
    const group = response.task.practice.group;
    const entry = statsMap.get(group.id) ?? {
      id: group.id,
      name: group.name,
      total: 0,
      applicable: 0,
      implemented: 0,
      weightedProgress: 0,
      weightSum: 0
    };

    entry.total += 1;
    if (response.applicable) {
      entry.applicable += 1;
      if (response.status === "IMPLEMENTADO") {
        entry.implemented += 1;
      }
      entry.weightedProgress += (response.maturity / 5) * response.weight;
      entry.weightSum += response.weight;
    }

    statsMap.set(group.id, entry);
  }

  const stats = GROUP_ORDER.map((groupId) => statsMap.get(groupId)).filter(Boolean) as GroupStats[];

  const totals = stats.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.applicable += item.applicable;
      acc.implemented += item.implemented;
      acc.weightedProgress += item.weightedProgress;
      acc.weightSum += item.weightSum;
      return acc;
    },
    { total: 0, applicable: 0, implemented: 0, weightedProgress: 0, weightSum: 0 }
  );

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
          <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/dashboard" />
          <ExportMenu assessmentId={selected.id} />
        </div>
      </div>

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
                    <TableCell className="font-semibold">{group.id}</TableCell>
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
    </div>
  );
}
