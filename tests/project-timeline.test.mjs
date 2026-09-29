import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../docs/project-timeline.html", import.meta.url), "utf8");

assert.match(html, /<html lang="th">/, "Thai must be the default language");
assert.match(html, /family=Prompt/, "Prompt must be loaded from Google Fonts");
assert.match(html, /data-lang="th"/, "Thai language control must exist");
assert.match(html, /data-lang="en"/, "English language control must exist");
assert.match(html, /document\.documentElement\.lang\s*=\s*lang/, "Switching language must update the document language");
assert.match(html, /localStorage\.setItem\("ad-validate-timeline-lang", lang\)/, "Language choice must be remembered");

for (const phase of ["0", "1", "2", "3", "4", "5", "6", "7"]) {
  assert.match(html, new RegExp(`data-phase="${phase}"`), `Phase ${phase} must be present`);
}

for (const section of ["milestones", "risks", "scope-cut"]) {
  assert.match(html, new RegExp(`id="${section}"`), `${section} section must be present`);
}

assert.match(html, /@media\s*\(max-width:\s*760px\)/, "Mobile layout must be defined");
assert.match(html, /@media\s+print/, "Print layout must be defined");

console.log("project-timeline.html: structure and bilingual controls verified");
