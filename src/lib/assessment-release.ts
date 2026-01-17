import { AssessmentReleaseStatus, SsdfStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isApplicable, MAX_MATURITY_LEVEL } from "@/lib/ssdf";

const GROUP_ORDER = ["PO", "PS", "PW", "RV"] as const;

export type ReleaseGroupStats = {
  id: string;
  name: string;
  total: number;
  applicable: number;
  implemented: number;
  weightedProgress: number;
  weightSum: number;
};

export type ReleaseTotals = {
  total: number;
  applicable: number;
  implemented: number;
  weightedProgress: number;
  weightSum: number;
};

export type AssessmentSnapshot = {
  generatedAt: string;
  groupStats: ReleaseGroupStats[];
  totals: ReleaseTotals;
};

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
      }
    }
  });

  const statsMap = new Map<string, ReleaseGroupStats>();

  for (const response of responses) {
    const group = response.ssdfTask.practice.group;
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
    if (isApplicable(response.status)) {
      entry.applicable += 1;
      if (response.status === SsdfStatus.IMPLEMENTED) {
        entry.implemented += 1;
      }
      entry.weightedProgress += (response.maturityLevel / MAX_MATURITY_LEVEL) * response.weight;
      entry.weightSum += response.weight;
    }

    statsMap.set(group.id, entry);
  }

  const groupStats = GROUP_ORDER.map((groupId) => statsMap.get(groupId)).filter(Boolean) as ReleaseGroupStats[];
  const totals = groupStats.reduce(
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

  return {
    generatedAt: new Date().toISOString(),
    groupStats,
    totals
  };
}
