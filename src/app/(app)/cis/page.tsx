import AssessmentPicker from "@/components/assessment/assessment-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { CisStatus, ImplementationGroup, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { updateCisOverride } from "@/app/(app)/cis/actions";
import ControlSummaryTable from "@/components/cis/control-summary-table";
import { getCisStatusLabel, getControlDisplay, getSafeguardDisplay, ptBR } from "@/lib/i18n/ptBR";

type IgStats = {
  total: number;
  scoreSum: number;
};

export default async function CisDashboardPage({
  searchParams
}: {
  searchParams?: { assessmentId?: string };
}) {
  const session = await getServerSession(authOptions);
  const allowEdit = session?.user?.role === Role.ADMIN || session?.user?.role === Role.ASSESSOR;
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
          {ptBR.cis.title}
        </h1>
        <p className="text-muted-foreground">{ptBR.common.assessmentNotFound}</p>
      </div>
    );
  }

  const [cisControls, safeguards, results] = await Promise.all([
    prisma.cisControl.findMany({
      include: { safeguards: true },
      orderBy: { id: "asc" }
    }),
    prisma.cisSafeguard.findMany({
      include: { control: true },
      orderBy: { id: "asc" }
    }),
    prisma.assessmentCisResult.findMany({
      where: { assessmentId: selected.id },
      include: {
        cisControl: true,
        cisSafeguard: { include: { control: true } }
      }
    })
  ]);

  const resultBySafeguardId = new Map(
    results
      .filter((result) => result.cisSafeguardId)
      .map((result) => [result.cisSafeguardId as string, result])
  );

  const taskIds = new Set(results.flatMap((result) => result.derivedFromTaskIds));
  const ssdfTasks =
    taskIds.size > 0
      ? await prisma.ssdfTask.findMany({
          where: { id: { in: Array.from(taskIds) } },
          orderBy: { id: "asc" }
        })
      : [];
  const taskLabelMap = new Map(
    ssdfTasks.map((task) => [task.id, `${task.id} - ${task.name}`])
  );

  const igStats: Record<ImplementationGroup, IgStats> = {
    IG1: { total: 0, scoreSum: 0 },
    IG2: { total: 0, scoreSum: 0 },
    IG3: { total: 0, scoreSum: 0 }
  };

  safeguards.forEach((safeguard) => {
    igStats[safeguard.implementationGroup].total += 1;
    const result = resultBySafeguardId.get(safeguard.id);
    const score = result?.derivedCoverageScore ?? 0;
    igStats[safeguard.implementationGroup].scoreSum += score;
  });

  const controlSummary = cisControls.map((control) => {
    const controlSafeguards = safeguards.filter((safeguard) => safeguard.controlId === control.id);
    const controlResults = controlSafeguards
      .map((safeguard) => resultBySafeguardId.get(safeguard.id))
      .filter(Boolean);

    const manualOverrides = controlResults.filter((result) => result?.manualOverride);
    const avgMaturity =
      controlResults.length > 0
        ? controlResults.reduce((sum, result) => {
            const effective =
              result?.manualOverride && result.manualMaturityLevel !== null
                ? result.manualMaturityLevel
                : result?.derivedMaturityLevel ?? 0;
            return sum + effective;
          }, 0) / controlResults.length
        : 0;
    const avgCoverage =
      controlResults.length > 0
        ? controlResults.reduce((sum, result) => sum + (result?.derivedCoverageScore ?? 0), 0) /
          controlResults.length
        : 0;

    return {
      controlId: control.id,
      controlLabel: getControlDisplay(control.id, control.name),
      safeguardsTotal: controlSafeguards.length,
      derivedCount: controlResults.length,
      manualOverrideCount: manualOverrides.length,
      notMappedCount: controlSafeguards.length - controlResults.length,
      avgMaturity,
      avgCoverage
    };
  });

  const safeguardsRows = safeguards.map((safeguard) => {
    const result = resultBySafeguardId.get(safeguard.id);
    const effectiveStatus =
      result?.manualOverride && result.manualStatus ? result.manualStatus : result?.derivedStatus;
    const effectiveMaturity =
      result?.manualOverride && result.manualMaturityLevel !== null
        ? result.manualMaturityLevel
        : result?.derivedMaturityLevel ?? 0;
    const originKey = result
      ? result.manualOverride
        ? "MANUAL"
        : result.derivedFromSsdf
          ? "SSDF_MAPPED"
          : "MANUAL"
      : "NOT_MAPPED";
    const originLabel =
      ptBR.sources[originKey as keyof typeof ptBR.sources] ?? ptBR.common.notAvailable;
    const sourceTasks = result?.derivedFromTaskIds
      .map((taskId) => taskLabelMap.get(taskId) ?? taskId)
      .join(", ");

    return {
      id: safeguard.id,
      name: getSafeguardDisplay(safeguard.id, safeguard.name),
      controlLabel: getControlDisplay(safeguard.control.id, safeguard.control.name),
      ig: safeguard.implementationGroup,
      status: getCisStatusLabel(effectiveStatus),
      maturity: effectiveMaturity,
      coverage: result?.derivedCoverageScore ?? 0,
      origin: originLabel,
      sourceTasks
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {ptBR.cis.title}
          </h1>
          <p className="text-muted-foreground">
            {ptBR.cis.subtitle}
          </p>
        </div>
        <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/cis" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["IG1", "IG2", "IG3"] as ImplementationGroup[]).map((ig) => {
          const stats = igStats[ig];
          const coverage = stats.total > 0 ? stats.scoreSum / stats.total : 0;
          return (
            <Card key={ig}>
              <CardHeader>
                <CardTitle>
                  {ptBR.cis.coverageLabel} {ig}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatNumber(coverage, 1)}%</p>
                <p className="text-sm text-muted-foreground">
                  {stats.total} {ptBR.cis.safeguardsLabel.toLowerCase()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.cis.manualOverrideTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {allowEdit ? (
            <form action={updateCisOverride} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="assessmentId" value={selected.id} />
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">{ptBR.columns.safeguard}</label>
                <select
                  name="cisSafeguardId"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  required
                >
                  <option value="">{ptBR.common.select}</option>
                  {safeguards.map((safeguard) => (
                    <option key={safeguard.id} value={safeguard.id}>
                      {getSafeguardDisplay(safeguard.id, safeguard.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ptBR.cis.overrideQuestion}</label>
                <select
                  name="manualOverride"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  defaultValue="true"
                >
                  <option value="true">{ptBR.common.yes}</option>
                  <option value="false">{ptBR.common.no}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ptBR.cis.manualStatus}</label>
                <select
                  name="manualStatus"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  <option value={CisStatus.NOT_STARTED}>{ptBR.statuses.NOT_STARTED}</option>
                  <option value={CisStatus.IN_PROGRESS}>{ptBR.statuses.IN_PROGRESS}</option>
                  <option value={CisStatus.IMPLEMENTED}>{ptBR.statuses.IMPLEMENTED}</option>
                  <option value={CisStatus.NOT_APPLICABLE}>{ptBR.statuses.NOT_APPLICABLE}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ptBR.cis.manualMaturity}</label>
                <input
                  name="manualMaturityLevel"
                  type="number"
                  min={0}
                  max={3}
                  defaultValue={0}
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  {ptBR.cis.saveOverride}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{ptBR.common.readOnly}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.cis.summaryTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ControlSummaryTable rows={controlSummary} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.cis.safeguardsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ptBR.columns.safeguard}</TableHead>
                <TableHead>{ptBR.columns.control}</TableHead>
                <TableHead>{ptBR.columns.ig}</TableHead>
                <TableHead>{ptBR.columns.status}</TableHead>
                <TableHead>{ptBR.columns.maturity}</TableHead>
                <TableHead>{ptBR.columns.coverage}</TableHead>
                <TableHead>{ptBR.columns.source}</TableHead>
                <TableHead>{ptBR.cis.relatedSsdf}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeguardsRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.controlLabel}</TableCell>
                  <TableCell>{row.ig}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.maturity}</TableCell>
                  <TableCell>{formatNumber(row.coverage, 1)}%</TableCell>
                  <TableCell>{row.origin}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.sourceTasks || ptBR.common.notAvailable}
                  </TableCell>
                </TableRow>
              ))}
              {safeguardsRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    {ptBR.cis.emptySafeguards}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
