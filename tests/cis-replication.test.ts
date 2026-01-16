import assert from "node:assert/strict";
import { CisStatus, MappingType, SsdfStatus } from "@prisma/client";
import { computeDerivedCisResult } from "../src/lib/cis/replication";

{
  const mappings = [
    { ssdfTaskId: "PO.1.1", mappingType: MappingType.DIRECT, weight: 1 },
    { ssdfTaskId: "PO.1.2", mappingType: MappingType.PARTIAL, weight: 1 }
  ];
  const results = [
    { ssdfTaskId: "PO.1.1", status: SsdfStatus.IMPLEMENTED, maturityLevel: 3 },
    { ssdfTaskId: "PO.1.2", status: SsdfStatus.IN_PROGRESS, maturityLevel: 1 }
  ];

  const derived = computeDerivedCisResult(mappings, results);

  assert.equal(derived.derivedStatus, CisStatus.IN_PROGRESS);
  assert.equal(derived.derivedMaturityLevel, 2);
  assert.ok(Math.abs(derived.derivedCoverageScore - 72.55) < 0.02);
}

{
  const mappings = [
    { ssdfTaskId: "PS.1.1", mappingType: MappingType.DIRECT, weight: 1 }
  ];
  const results = [
    { ssdfTaskId: "PS.1.1", status: SsdfStatus.NOT_APPLICABLE, maturityLevel: 0 }
  ];

  const derived = computeDerivedCisResult(mappings, results);

  assert.equal(derived.derivedStatus, CisStatus.NOT_APPLICABLE);
  assert.equal(derived.derivedMaturityLevel, 0);
  assert.equal(derived.derivedCoverageScore, 0);
}
