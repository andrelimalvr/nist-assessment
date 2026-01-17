import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sidebarPath = path.join(process.cwd(), "src/components/layout/sidebar.tsx");
const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

assert.ok(sidebarContent.includes("/docs"));
assert.ok(sidebarContent.includes("Documentacao"));

const docsPagePath = path.join(process.cwd(), "src/app/(app)/docs/page.tsx");
assert.ok(fs.existsSync(docsPagePath));
