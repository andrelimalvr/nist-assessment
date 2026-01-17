import assert from "node:assert/strict";
import {
  applySortDirection,
  compareCisStatus,
  compareControlId,
  compareImplementationGroup,
  compareNumbers,
  compareSafeguardId,
  compareSsdfId
} from "../src/lib/sorters";
import { sortRows } from "../src/lib/table-sorting";

assert.ok(compareControlId("2", "10") < 0);
assert.ok(compareControlId("10", "2") > 0);

assert.ok(compareSafeguardId("16.2", "16.10") < 0);
assert.ok(compareSafeguardId("16.10", "16.2") > 0);

assert.ok(compareSsdfId("PO.2.9", "PO.2.10") < 0);
assert.ok(compareSsdfId("PO.2.10", "PO.2.9") > 0);

assert.ok(applySortDirection(compareNumbers(100, 0), "desc") < 0);
assert.ok(applySortDirection(compareNumbers(0, 100), "desc") > 0);

assert.ok(compareCisStatus("IMPLEMENTED", "IN_PROGRESS") < 0);
assert.ok(compareCisStatus("NOT_APPLICABLE", "NOT_STARTED") > 0);
assert.ok(compareCisStatus("", "NOT_APPLICABLE") > 0);

assert.ok(compareImplementationGroup("IG1", "IG2") < 0);
assert.ok(compareImplementationGroup("IG3", "IG2") > 0);

const safeguardRows = [
  { id: "a", safeguardId: "16.10" },
  { id: "b", safeguardId: "16.2" }
];
const sortedSafeguards = sortRows(safeguardRows, "safeguardId", "asc", {
  safeguardId: { type: "safeguardId", accessor: (row) => row.safeguardId }
});
assert.equal(sortedSafeguards[0].safeguardId, "16.2");

const coverageRows = [
  { id: "a", coverage: 100 },
  { id: "b", coverage: 0 }
];
const sortedCoverage = sortRows(coverageRows, "coverage", "desc", {
  coverage: { type: "number", accessor: (row) => row.coverage }
});
assert.equal(sortedCoverage[0].coverage, 100);
