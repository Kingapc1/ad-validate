import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../docs/ad-validate-e2e-userflow.html", import.meta.url),
  "utf8",
);

assert.match(html, /<html lang="th">/, "Thai must be the default language");
assert.match(html, /family=Prompt/, "Prompt must be loaded from Google Fonts");
assert.match(html, /class="swimlane-board"/, "A swimlane board must exist");
assert.match(
  html,
  /grid-template-columns:\s*minmax\(\d+px,\s*\.\d+fr\)/,
  "Desktop layout must use vertical lane columns",
);

for (const lane of ["tl", "mcc", "new-job", "ad-validate", "external"]) {
  assert.match(html, new RegExp(`data-lane="${lane}"`), `${lane} lane must exist`);
}

for (const phase of [
  "prepare",
  "present",
  "launch",
  "scan",
  "evaluate",
  "remediate",
  "complete",
  "sync",
]) {
  assert.match(html, new RegExp(`data-phase="${phase}"`), `${phase} phase must exist`);
}

for (const requirement of [
  "Revision Notes",
  "Critical",
  "Auto-fix",
  "External fix",
  "Exception",
  "24 ชั่วโมง",
  "Idempotent",
  "Customer Approve",
  "eventual consistency",
  "optimistic locking",
]) {
  assert.match(html, new RegExp(requirement, "i"), `${requirement} must be represented`);
}

assert.match(html, /aria-label="กรองเฟส"/, "Phase filter must be accessible");
assert.match(html, /data-filter="all"/, "Show-all filter must exist");
assert.match(html, /function\s+applyFilter/, "Filter behavior must exist");
assert.match(html, /@media\s*\(max-width:\s*820px\)/, "Mobile layout must exist");
assert.match(html, /@media\s+print/, "Print layout must exist");

console.log("ad-validate-e2e-userflow.html: vertical swimlane contract verified");
