import assert from "node:assert/strict";
import { compareControlId, compareSafeguardId } from "../src/lib/sorters";

assert.ok(compareControlId("2", "10") < 0);
assert.ok(compareControlId("10", "2") > 0);

assert.ok(compareSafeguardId("16.2", "16.10") < 0);
assert.ok(compareSafeguardId("16.10", "16.2") > 0);
