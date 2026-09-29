import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gantt = readFileSync(new URL("../docs/ad-validate-gantt.html", import.meta.url), "utf8");
const stories = readFileSync(new URL("../docs/ad-validate-user-stories.html", import.meta.url), "utf8");

for (const [name, html] of [["gantt", gantt], ["stories", stories]]) {
  assert.match(html, /family=Sarabun/, `${name} must load Sarabun`);
  assert.match(html, /#7F70EF/i, `${name} must use the Plus AdTech primary color`);
  assert.match(html, /data-lang="th"/, `${name} must provide Thai`);
  assert.match(html, /data-lang="en"/, `${name} must provide English`);
  assert.match(html, /22\s+September\s+2026|22\s+กันยายน\s+2569/, `${name} must use the approved start date`);
  assert.match(html, /16\s+November\s+2026|16\s+พฤศจิกายน\s+2569/, `${name} must use the eight-week end date`);
}

assert.match(gantt, /<svg[^>]+role="img"[^>]+aria-labelledby="ad-validate-gantt-title ad-validate-gantt-desc"/s);
assert.match(gantt, /<title id="ad-validate-gantt-title">/);
assert.match(gantt, /<desc id="ad-validate-gantt-desc">/);
assert.match(gantt, /href="ad-validate-user-stories\.html#AV-101"/);
assert.match(gantt, /href="ad-validate-user-stories\.html#AV-112"/);

const storyIds = [...stories.matchAll(/<article[^>]+id="(AV-\d{3})"/g)].map((match) => match[1]);
assert.deepEqual(storyIds, Array.from({ length: 12 }, (_, index) => `AV-${101 + index}`));
assert.match(stories, /As a|ในฐานะ/);
assert.match(stories, /Acceptance Criteria/);
assert.match(stories, /User Flow/);
assert.match(stories, /href="ad-validate-gantt\.html"/);

console.log("Ad Validate Gantt and 12 bilingual user stories verified");
