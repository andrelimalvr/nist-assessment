import {
  CisStatus,
  MappingType,
  PrismaClient,
  SsdfStatus
} from "@prisma/client";
import { MAX_MATURITY_LEVEL } from "@/lib/ssdf";

export type MappingInput = {
  ssdfTaskId: string;
  mappingType: MappingType;
  weight: number;
};

export type SsdfResultInput = {
  ssdfTaskId: string;
  status: SsdfStatus;
  maturityLevel: number;
};

const mappingFactors: Record<MappingType, number> = {
  DIRECT: 1,
  PARTIAL: 0.7,
  SUPPORTS: 0.4
};

export function computeDerivedCisResult(
  mappings: MappingInput[],
  results: SsdfResultInput[]
) {
  const resultMap = new Map(results.map((result) => [result.ssdfTaskId, result]));
  const derivedFromTaskIds = Array.from(
    new Set(
      mappings
        .map((mapping) => mapping.ssdfTaskId)
        .filter((taskId) => resultMap.has(taskId))
    )
  );

  const applicableMappings = mappings.filter((mapping) => {
    const result = resultMap.get(mapping.ssdfTaskId);
    return result && result.status !== SsdfStatus.NOT_APPLICABLE;
  });

  if (applicableMappings.length === 0) {
    return {
      derivedStatus: CisStatus.NOT_APPLICABLE,
      derivedMaturityLevel: 0,
      derivedCoverageScore: 0,
      derivedFromTaskIds
    };
  }

  const statuses = applicableMappings
    .map((mapping) => resultMap.get(mapping.ssdfTaskId)?.status)
    .filter(Boolean) as SsdfStatus[];

  let derivedStatus = CisStatus.IMPLEMENTED;
  if (statuses.some((status) => status === SsdfStatus.NOT_STARTED)) {
    derivedStatus = CisStatus.NOT_STARTED;
  } else if (statuses.some((status) => status === SsdfStatus.IN_PROGRESS)) {
    derivedStatus = CisStatus.IN_PROGRESS;
  } else if (statuses.some((status) => status === SsdfStatus.NOT_APPLICABLE)) {
    derivedStatus = CisStatus.NOT_APPLICABLE;
  }

  let weightedMaturity = 0;
  let weightSum = 0;

  for (const mapping of applicableMappings) {
    const result = resultMap.get(mapping.ssdfTaskId);
    if (!result) continue;
    const factor = mappingFactors[mapping.mappingType];
    const weight = mapping.weight * factor;
    weightSum += weight;
    weightedMaturity += result.maturityLevel * weight;
  }

  const maturityAverage = weightSum > 0 ? weightedMaturity / weightSum : 0;
  const derivedMaturityLevel = Math.max(
    0,
    Math.min(MAX_MATURITY_LEVEL, Math.round(maturityAverage))
  );
  const derivedCoverageScore =
    weightSum > 0
      ? Number(((weightedMaturity / (MAX_MATURITY_LEVEL * weightSum)) * 100).toFixed(2))
      : 0;

  return {
    derivedStatus,
    derivedMaturityLevel,
    derivedCoverageScore,
    derivedFromTaskIds
  };
}

type TargetKey = {
  cisControlId: string | null;
  cisSafeguardId: string | null;
};

async function recalculateCisForTarget(
  prisma: PrismaClient,
  assessmentId: string,
  target: TargetKey,
  updatedById?: string | null
) {
  const mappings = await prisma.ssdfCisMapping.findMany({
    where: {
      cisControlId: target.cisControlId ?? undefined,
      cisSafeguardId: target.cisSafeguardId ?? undefined
    },
    include: {
      cisSafeguard: { select: { controlId: true } }
    }
  });

  if (mappings.length === 0) return;

  const taskIds = mappings.map((mapping) => mapping.ssdfTaskId);
  const results = await prisma.assessmentSsdfTaskResult.findMany({
    where: {
      assessmentId,
      ssdfTaskId: { in: taskIds }
    },
    select: {
      ssdfTaskId: true,
      status: true,
      maturityLevel: true
    }
  });

  const derived = computeDerivedCisResult(
    mappings.map((mapping) => ({
      ssdfTaskId: mapping.ssdfTaskId,
      mappingType: mapping.mappingType,
      weight: mapping.weight
    })),
    results
  );

  const resolvedControlId =
    target.cisControlId ?? mappings[0]?.cisSafeguard?.controlId ?? null;

  await prisma.assessmentCisResult.upsert({
    where: {
      assessmentId_cisControlId_cisSafeguardId: {
        assessmentId,
        cisControlId: resolvedControlId,
        cisSafeguardId: target.cisSafeguardId
      }
    },
    update: {
      derivedStatus: derived.derivedStatus,
      derivedMaturityLevel: derived.derivedMaturityLevel,
      derivedCoverageScore: derived.derivedCoverageScore,
      derivedFromTaskIds: derived.derivedFromTaskIds,
      derivedFromSsdf: true,
      updatedById: updatedById ?? null
    },
    create: {
      assessmentId,
      cisControlId: resolvedControlId,
      cisSafeguardId: target.cisSafeguardId,
      derivedStatus: derived.derivedStatus,
      derivedMaturityLevel: derived.derivedMaturityLevel,
      derivedCoverageScore: derived.derivedCoverageScore,
      derivedFromTaskIds: derived.derivedFromTaskIds,
      derivedFromSsdf: true,
      updatedById: updatedById ?? null
    }
  });
}

export async function recalculateCisForSsdfTask(
  prisma: PrismaClient,
  assessmentId: string,
  ssdfTaskId: string,
  updatedById?: string | null
) {
  const mappings = await prisma.ssdfCisMapping.findMany({
    where: { ssdfTaskId },
    select: { cisControlId: true, cisSafeguardId: true }
  });

  const targets = new Map<string, TargetKey>();
  for (const mapping of mappings) {
    const key = mapping.cisSafeguardId
      ? `s:${mapping.cisSafeguardId}`
      : `c:${mapping.cisControlId}`;
    if (!targets.has(key)) {
      targets.set(key, {
        cisControlId: mapping.cisControlId ?? null,
        cisSafeguardId: mapping.cisSafeguardId ?? null
      });
    }
  }

  for (const target of targets.values()) {
    await recalculateCisForTarget(prisma, assessmentId, target, updatedById);
  }
}

export async function recalculateCisForAssessment(
  prisma: PrismaClient,
  assessmentId: string,
  updatedById?: string | null
) {
  const mappings = await prisma.ssdfCisMapping.findMany({
    select: { cisControlId: true, cisSafeguardId: true }
  });

  const targets = new Map<string, TargetKey>();
  for (const mapping of mappings) {
    const key = mapping.cisSafeguardId
      ? `s:${mapping.cisSafeguardId}`
      : `c:${mapping.cisControlId}`;
    if (!targets.has(key)) {
      targets.set(key, {
        cisControlId: mapping.cisControlId ?? null,
        cisSafeguardId: mapping.cisSafeguardId ?? null
      });
    }
  }

  for (const target of targets.values()) {
    await recalculateCisForTarget(prisma, assessmentId, target, updatedById);
  }
}
