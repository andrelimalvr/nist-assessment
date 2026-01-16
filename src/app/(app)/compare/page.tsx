import AssessmentPicker from "@/components/assessment/assessment-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { CisStatus, ImplementationGroup, MappingType, Role, SsdfStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { MAX_MATURITY_LEVEL } from "@/lib/ssdf";
import { getCisStatusLabel, getControlDisplay, getSafeguardDisplay, ptBR } from "@/lib/i18n/ptBR";
import CoverageDiffTable from "@/components/compare/coverage-diff-table";
import HeatmapTable from "@/components/compare/heatmap-table";
import GapRankingTable from "@/components/compare/gap-ranking-table";

const mappingFactors: Record<MappingType, number> = {
  DIRECT: 1,
  PARTIAL: 0.7,
  SUPPORTS: 0.4
};

const groupIds = ["PO", "PS", "PW", "RV"] as const;

export default async function ComparePage({
  searchParams
}: {
  searchParams?: {
    assessmentId?: string;
    control?: string;
    ig?: string;
    group?: string;
    status?: string;
    source?: string;
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
          {ptBR.compare.title}
        </h1>
        <p className="text-muted-foreground">{ptBR.common.assessmentNotFound}</p>
      </div>
    );
  }

  const [safeguards, results, mappings, ssdfResults, cisControls] = await Promise.all([
    prisma.cisSafeguard.findMany({ include: { control: true }, orderBy: { id: "asc" } }),
    prisma.assessmentCisResult.findMany({
      where: { assessmentId: selected.id },
      include: { cisSafeguard: true }
    }),
    prisma.ssdfCisMapping.findMany({
      include: {
        ssdfTask: { include: { practice: { include: { group: true } } } },
        cisSafeguard: { select: { controlId: true } }
      }
    }),
    prisma.assessmentSsdfTaskResult.findMany({
      where: { assessmentId: selected.id },
      select: { ssdfTaskId: true, maturityLevel: true, status: true }
    }),
    prisma.cisControl.findMany({ orderBy: { id: "asc" } })
  ]);

  const resultBySafeguardId = new Map(
    results
      .filter((result) => result.cisSafeguardId)
      .map((result) => [result.cisSafeguardId as string, result])
  );

  const ssdfResultMap = new Map(ssdfResults.map((result) => [result.ssdfTaskId, result]));

  const safeguardGroups = new Map<string, Set<string>>();
  for (const mapping of mappings) {
    if (!mapping.cisSafeguardId) continue;
    const groupId = mapping.ssdfTask.practice.groupId;
    const set = safeguardGroups.get(mapping.cisSafeguardId) ?? new Set<string>();
    set.add(groupId);
    safeguardGroups.set(mapping.cisSafeguardId, set);
  }

  const coverageDiff = safeguards.map((safeguard) => {
    const result = resultBySafeguardId.get(safeguard.id);
    const effectiveStatus =
      result?.manualOverride && result.manualStatus ? result.manualStatus : result?.derivedStatus;
    const effectiveMaturity =
      result?.manualOverride && result.manualMaturityLevel !== null
        ? result.manualMaturityLevel
        : result?.derivedMaturityLevel ?? 0;
    const sourceKey = result
      ? result.manualOverride
        ? "MANUAL"
        : result.derivedFromSsdf
          ? "SSDF_MAPPED"
          : "MANUAL"
      : "NOT_MAPPED";
    const sourceLabel =
      ptBR.sources[sourceKey as keyof typeof ptBR.sources] ?? ptBR.common.notAvailable;
    const groups = safeguardGroups.get(safeguard.id);
    const ssdfGroups = groups ? Array.from(groups).sort() : [];

    return {
      id: safeguard.id,
      safeguardLabel: getSafeguardDisplay(safeguard.id, safeguard.name),
      controlId: safeguard.control.id,
      controlLabel: getControlDisplay(safeguard.control.id, safeguard.control.name),
      ig: safeguard.implementationGroup,
      status: effectiveStatus ?? null,
      statusLabel: getCisStatusLabel(effectiveStatus) || ptBR.common.notAvailable,
      maturity: effectiveMaturity,
      coverage: result?.derivedCoverageScore ?? 0,
      sourceKey,
      sourceLabel,
      gapReason: result ? ptBR.common.notAvailable : ptBR.compare.notMappedReason,
      ssdfGroups
    };
  });

  const controlFilter = searchParams?.control ?? "";
  const igFilter = searchParams?.ig ?? "";
  const statusFilter = searchParams?.status ?? "";
  const sourceFilter = searchParams?.source ?? "";
  const groupFilter = searchParams?.group ?? "";

  const filteredCoverageDiff = coverageDiff.filter((row) => {
    if (controlFilter && row.controlId !== controlFilter) return false;
    if (igFilter && row.ig !== igFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (sourceFilter && row.sourceKey !== sourceFilter) return false;
    if (groupFilter && !row.ssdfGroups.includes(groupFilter)) return false;
    return true;
  });

  const coverageMatrix: Record<string, Record<string, { weightSum: number; weightedMaturity: number }>> =
    {};

  for (const control of cisControls) {
    coverageMatrix[control.id] = {};
    for (const groupId of groupIds) {
      coverageMatrix[control.id][groupId] = { weightSum: 0, weightedMaturity: 0 };
    }
  }

  for (const mapping of mappings) {
    const controlId = mapping.cisSafeguard?.controlId ?? mapping.cisControlId;
    if (!controlId) continue;
    const groupId = mapping.ssdfTask.practice.groupId as (typeof groupIds)[number];
    const result = ssdfResultMap.get(mapping.ssdfTaskId);
    if (!result || result.status === SsdfStatus.NOT_APPLICABLE) continue;

    const factor = mappingFactors[mapping.mappingType];
    const weight = mapping.weight * factor;
    coverageMatrix[controlId][groupId].weightSum += weight;
    coverageMatrix[controlId][groupId].weightedMaturity += result.maturityLevel * weight;
  }

  const gapRanking = filteredCoverageDiff
    .map((item) => {
      const igWeight = item.ig === ImplementationGroup.IG1 ? 3 : item.ig === ImplementationGroup.IG2 ? 2 : 1;
      const gapScore = (MAX_MATURITY_LEVEL - item.maturity) * igWeight;
      return {
        safeguardId: item.id,
        safeguardLabel: item.safeguardLabel,
        ig: item.ig,
        maturity: item.maturity,
        coverage: item.coverage,
        sourceLabel: item.sourceLabel,
        gapScore
      };
    })
    .sort((a, b) => b.gapScore - a.gapScore)
    .slice(0, 10);

  const visibleControls = controlFilter
    ? cisControls.filter((control) => control.id === controlFilter)
    : cisControls;
  const visibleGroups = groupFilter ? [groupFilter] : groupIds;

  const heatmapRows = visibleControls.map((control) => {
    const scores: Record<string, number> = {};
    for (const groupId of visibleGroups) {
      const cell = coverageMatrix[control.id][groupId];
      const score =
        cell.weightSum > 0
          ? (cell.weightedMaturity / (MAX_MATURITY_LEVEL * cell.weightSum)) * 100
          : 0;
      scores[groupId] = score;
    }
    return {
      controlId: control.id,
      controlLabel: getControlDisplay(control.id, control.name),
      scores
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {ptBR.compare.title}
          </h1>
          <p className="text-muted-foreground">
            {ptBR.compare.subtitle}
          </p>
        </div>
        <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/compare" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.compare.filtersTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" method="GET">
            <input type="hidden" name="assessmentId" value={selected.id} />
            <select
              name="control"
              defaultValue={controlFilter}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">{ptBR.filters.control}</option>
              {cisControls.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlDisplay(control.id, control.name)}
                </option>
              ))}
            </select>
            <select
              name="ig"
              defaultValue={igFilter}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">{ptBR.filters.ig}</option>
              <option value="IG1">IG1</option>
              <option value="IG2">IG2</option>
              <option value="IG3">IG3</option>
            </select>
            <select
              name="group"
              defaultValue={groupFilter}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">{ptBR.filters.group}</option>
              {groupIds.map((groupId) => (
                <option key={groupId} value={groupId}>
                  {groupId}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">{ptBR.filters.status}</option>
              <option value={CisStatus.NOT_STARTED}>{ptBR.statuses.NOT_STARTED}</option>
              <option value={CisStatus.IN_PROGRESS}>{ptBR.statuses.IN_PROGRESS}</option>
              <option value={CisStatus.IMPLEMENTED}>{ptBR.statuses.IMPLEMENTED}</option>
              <option value={CisStatus.NOT_APPLICABLE}>{ptBR.statuses.NOT_APPLICABLE}</option>
            </select>
            <select
              name="source"
              defaultValue={sourceFilter}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">{ptBR.filters.source}</option>
              <option value="SSDF_MAPPED">{ptBR.sources.SSDF_MAPPED}</option>
              <option value="MANUAL">{ptBR.sources.MANUAL}</option>
              <option value="NOT_MAPPED">{ptBR.sources.NOT_MAPPED}</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {ptBR.common.applyFilters}
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.compare.coverageDiffTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <CoverageDiffTable
            rows={filteredCoverageDiff.map((row) => ({
              safeguardId: row.id,
              safeguardLabel: row.safeguardLabel,
              controlId: row.controlId,
              controlLabel: row.controlLabel,
              ig: row.ig,
              statusLabel: row.statusLabel,
              maturity: row.maturity,
              coverage: row.coverage,
              sourceLabel: row.sourceLabel,
              gapReason: row.gapReason
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.compare.heatmapTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <HeatmapTable groups={visibleGroups} rows={heatmapRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ptBR.compare.gapsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <GapRankingTable rows={gapRanking} />
        </CardContent>
      </Card>
    </div>
  );
}
