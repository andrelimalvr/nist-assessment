import {
  AssessmentReleaseStatus,
  ImplementationGroup,
  SsdfStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isApplicable, MAX_MATURITY_LEVEL } from "@/lib/ssdf";

const GROUP_ORDER = ["PO", "PS", "PW", "RV"] as const;
const IG_ORDER: ImplementationGroup[] = [
  ImplementationGroup.IG1,
  ImplementationGroup.IG2,
  ImplementationGroup.IG3
];

export type ReleaseGroupStats = {
  id: string;
  name: string;
  total: number;
  applicable: number;
  implemented: number;
  maturitySum: number;
  maturityAvg: number;
  coverageRate: number;
  weightedProgress: number;
  weightSum: number;
  weightedScore: number;
};

export type ReleaseTotals = {
  total: number;
  applicable: number;
  implemented: number;
  maturitySum: number;
  maturityAvg: number;
  coverageRate: number;
  weightedProgress: number;
  weightSum: number;
  weightedScore: number;
};

export type PracticeStats = {
  id: string;
  name: string;
  groupId: string;
  total: number;
  applicable: number;
  implemented: number;
  maturitySum: number;
  maturityAvg: number;
  coverageRate: number;
  weightedProgress: number;
  weightSum: number;
  weightedScore: number;
};

export type SnapshotTask = {
  id: string;
  taskId: string;
  taskName: string;
  groupId: string;
  groupName: string;
  practiceId: string;
  practiceName: string;
  status: SsdfStatus;
  maturityLevel: number;
  targetLevel: number;
  gap: number;
  weight: number;
  owner: string | null;
  team: string | null;
  dueDate: string | null;
  evidenceCount: number;
};

export type CisControlSnapshot = {
  controlId: string;
  controlName: string;
  safeguardsTotal: number;
  derivedCount: number;
  manualOverrideCount: number;
  gapCount: number;
  avgMaturity: number;
  avgCoverage: number;
};

export type CisIgSnapshot = {
  ig: ImplementationGroup;
  total: number;
  avgCoverage: number;
};

export type AssessmentSnapshot = {
  version: number;
  generatedAt: string;
  groupStats: ReleaseGroupStats[];
  totals: ReleaseTotals;
  practiceStats: PracticeStats[];
  tasks: SnapshotTask[];
  cis: {
    controls: CisControlSnapshot[];
    igStats: CisIgSnapshot[];
  };
};

const emptyTotals: ReleaseTotals = {
  total: 0,
  applicable: 0,
  implemented: 0,
  maturitySum: 0,
  maturityAvg: 0,
  coverageRate: 0,
  weightedProgress: 0,
  weightSum: 0,
  weightedScore: 0
};

export function normalizeSnapshot(raw: any): AssessmentSnapshot {
  return {
    version: typeof raw?.version === "number" ? raw.version : 1,
    generatedAt: raw?.generatedAt ?? new Date().toISOString(),
    groupStats: raw?.groupStats ?? [],
    totals: { ...emptyTotals, ...(raw?.totals ?? {}) },
    practiceStats: raw?.practiceStats ?? [],
    tasks: raw?.tasks ?? [],
    cis: {
      controls: raw?.cis?.controls ?? [],
      igStats: raw?.cis?.igStats ?? []
    }
  };
}

export function isReleaseLocked(status?: AssessmentReleaseStatus | null) {
  return status === AssessmentReleaseStatus.IN_REVIEW || status === AssessmentReleaseStatus.APPROVED;
}

export async function getLatestAssessmentRelease(assessmentId: string) {
  return prisma.assessmentRelease.findFirst({
    where: { assessmentId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLatestApprovedRelease(assessmentId: string) {
  return prisma.assessmentRelease.findFirst({
    where: { assessmentId, status: AssessmentReleaseStatus.APPROVED },
    orderBy: { approvedAt: "desc" }
  });
}

export async function buildAssessmentSnapshot(assessmentId: string): Promise<AssessmentSnapshot> {
  const responses = await prisma.assessmentSsdfTaskResult.findMany({
    where: { assessmentId },
    include: {
      ssdfTask: {
        include: {
          practice: { include: { group: true } }
        }
      },
      evidences: { select: { id: true } }
    }
  });

  const statsMap = new Map<string, ReleaseGroupStats>();
  const practiceMap = new Map<string, PracticeStats>();

  const tasks: SnapshotTask[] = [];

  for (const response of responses) {
    const group = response.ssdfTask.practice.group;
    const entry = statsMap.get(group.id) ?? {
      id: group.id,
      name: group.name,
      total: 0,
      applicable: 0,
      implemented: 0,
      maturitySum: 0,
      maturityAvg: 0,
      coverageRate: 0,
      weightedProgress: 0,
      weightSum: 0,
      weightedScore: 0
    };

    const practice = response.ssdfTask.practice;
    const practiceEntry = practiceMap.get(practice.id) ?? {
      id: practice.id,
      name: practice.name,
      groupId: practice.groupId,
      total: 0,
      applicable: 0,
      implemented: 0,
      maturitySum: 0,
      maturityAvg: 0,
      coverageRate: 0,
      weightedProgress: 0,
      weightSum: 0,
      weightedScore: 0
    };

    entry.total += 1;
    practiceEntry.total += 1;
    if (isApplicable(response.status)) {
      entry.applicable += 1;
      practiceEntry.applicable += 1;
      if (response.status === SsdfStatus.IMPLEMENTED) {
        entry.implemented += 1;
        practiceEntry.implemented += 1;
      }
      entry.maturitySum += response.maturityLevel;
      practiceEntry.maturitySum += response.maturityLevel;
      entry.weightedProgress += (response.maturityLevel / MAX_MATURITY_LEVEL) * response.weight;
      entry.weightSum += response.weight;
      practiceEntry.weightedProgress += (response.maturityLevel / MAX_MATURITY_LEVEL) * response.weight;
      practiceEntry.weightSum += response.weight;
    }

    statsMap.set(group.id, entry);
    practiceMap.set(practice.id, practiceEntry);

    tasks.push({
      id: response.id,
      taskId: response.ssdfTaskId,
      taskName: response.ssdfTask.name,
      groupId: group.id,
      groupName: group.name,
      practiceId: practice.id,
      practiceName: practice.name,
      status: response.status,
      maturityLevel: response.maturityLevel,
      targetLevel: response.targetLevel,
      gap: Math.max(response.targetLevel - response.maturityLevel, 0),
      weight: response.weight,
      owner: response.owner,
      team: response.team,
      dueDate: response.dueDate ? response.dueDate.toISOString() : null,
      evidenceCount: response.evidences.length
    });
  }

  const finalizeStats = (stats: ReleaseGroupStats | PracticeStats) => {
    const coverageRate = stats.applicable > 0 ? stats.implemented / stats.applicable : 0;
    const maturityAvg = stats.applicable > 0 ? stats.maturitySum / stats.applicable : 0;
    const weightedScore = stats.weightSum > 0 ? stats.weightedProgress / stats.weightSum : 0;
    return { ...stats, coverageRate, maturityAvg, weightedScore };
  };

  const groupStats = GROUP_ORDER.map((groupId) => statsMap.get(groupId))
    .filter(Boolean)
    .map((item) => finalizeStats(item!)) as ReleaseGroupStats[];

  const practiceStats = Array.from(practiceMap.values())
    .map((item) => finalizeStats(item))
    .sort((a, b) => {
      if (a.groupId !== b.groupId) return a.groupId.localeCompare(b.groupId);
      return a.id.localeCompare(b.id);
    });

  const totals = groupStats.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.applicable += item.applicable;
      acc.implemented += item.implemented;
      acc.maturitySum += item.maturitySum;
      acc.weightedProgress += item.weightedProgress;
      acc.weightSum += item.weightSum;
      return acc;
    },
    {
      total: 0,
      applicable: 0,
      implemented: 0,
      maturitySum: 0,
      maturityAvg: 0,
      coverageRate: 0,
      weightedProgress: 0,
      weightSum: 0,
      weightedScore: 0
    }
  );

  const finalizedTotals = finalizeStats(totals);

  const [cisControls, safeguards, cisResults] = await Promise.all([
    prisma.cisControl.findMany({ orderBy: { id: "asc" } }),
    prisma.cisSafeguard.findMany({ include: { control: true }, orderBy: { id: "asc" } }),
    prisma.assessmentCisResult.findMany({
      where: { assessmentId },
      include: { cisSafeguard: { include: { control: true } } }
    })
  ]);

  const resultBySafeguardId = new Map(
    cisResults
      .filter((result) => result.cisSafeguardId)
      .map((result) => [result.cisSafeguardId as string, result])
  );

  const safeguardsByControl = new Map<string, typeof safeguards>();
  for (const safeguard of safeguards) {
    const list = safeguardsByControl.get(safeguard.controlId) ?? [];
    list.push(safeguard);
    safeguardsByControl.set(safeguard.controlId, list);
  }

  const controls: CisControlSnapshot[] = cisControls.map((control) => {
    const controlSafeguards = safeguardsByControl.get(control.id) ?? [];
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
      controlName: control.name,
      safeguardsTotal: controlSafeguards.length,
      derivedCount: controlResults.length,
      manualOverrideCount: manualOverrides.length,
      gapCount: controlSafeguards.length - controlResults.length,
      avgMaturity,
      avgCoverage
    };
  });

  const igTotals: Record<ImplementationGroup, { total: number; scoreSum: number }> = {
    IG1: { total: 0, scoreSum: 0 },
    IG2: { total: 0, scoreSum: 0 },
    IG3: { total: 0, scoreSum: 0 }
  };

  safeguards.forEach((safeguard) => {
    const stats = igTotals[safeguard.implementationGroup];
    stats.total += 1;
    const result = resultBySafeguardId.get(safeguard.id);
    stats.scoreSum += result?.derivedCoverageScore ?? 0;
  });

  const igStats: CisIgSnapshot[] = IG_ORDER.map((ig) => {
    const stats = igTotals[ig];
    return {
      ig,
      total: stats.total,
      avgCoverage: stats.total > 0 ? stats.scoreSum / stats.total : 0
    };
  });

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    groupStats,
    totals: finalizedTotals,
    practiceStats,
    tasks,
    cis: {
      controls,
      igStats
    }
  };
}

export async function createAssessmentSnapshot(params: {
  assessmentId: string;
  type: "AUTO" | "MANUAL" | "APPROVED";
  label?: string | null;
  createdByUserId?: string | null;
  releaseId?: string | null;
}) {
  const snapshot = await buildAssessmentSnapshot(params.assessmentId);
  return prisma.assessmentSnapshot.create({
    data: {
      assessmentId: params.assessmentId,
      releaseId: params.releaseId ?? null,
      type: params.type,
      label: params.label ?? null,
      snapshot,
      createdByUserId: params.createdByUserId ?? null
    }
  });
}

export async function getLatestAssessmentSnapshot(assessmentId: string) {
  return prisma.assessmentSnapshot.findFirst({
    where: { assessmentId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLatestApprovedSnapshot(assessmentId: string) {
  return prisma.assessmentSnapshot.findFirst({
    where: { assessmentId, type: "APPROVED" },
    orderBy: { createdAt: "desc" }
  });
}
