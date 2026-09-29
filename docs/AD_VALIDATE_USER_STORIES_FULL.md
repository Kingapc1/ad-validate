# Ad Validate — Full User Stories for Dev

Version: Draft 1.0 · 22 September 2026  
Scope: Google Ads vertical slice, target UAT 30 October 2026  
Source: `docs/PRD.md`, `diagrams/ad-validate.html`, `diagrams/rule-set.html`, and the project timeline  
Status: For PO, DMS Lead, and Tech Lead review. Dates and sizing are planning targets, not approved estimates.

## How to use this backlog

The cards in `ad-validate-user-stories.html` are the short view. This file is the implementation and review view. Each story needs an owner, estimate, API feasibility result, and test data before it enters a sprint. Google rule IDs and production severity must be signed off against the rule inventory; presentation data in the prototype is not production truth.

**Shared definitions**

- A **validation run** is one user-requested scan of one job/account using one immutable rule-set version. Connector retries stay within that run.
- **Critical** blocks proceed on the backend. **Warning/Manual** can proceed only under the approved confirmation policy. **Info/Not applicable** do not block.
- A **finding** records the evaluated rule, result, evidence/source, severity, owner, suggested action, and evaluation time.
- A **current scan** is a completed run within the approved expiry window. The PRD proposes 24 hours; Tech Lead must confirm the final value.
- **Done** for every story means implementation, meaningful success/failure tests, audit/security checks where relevant, reviewed documentation, and a demo with representative data.

## Dependency order

`AV-101 → AV-102 → AV-103 → AV-104/105/106 → AV-107 → AV-108/109 → AV-110/111 → AV-112`

---

<a id="av-101"></a>
## AV-101 — Confirm New Job contract and module boundary

**Priority / target / owner:** P0 · 30 Sep · PO + Tech Lead  
**User story:** As a Tech Lead, I want a signed launch and completion contract so New Job and Ad Validate can be developed and tested independently.  
**Value:** Prevent integration rework and ensure Ad Validate has its own lifecycle and ownership.

**Scope:** Define launch context, completion outcome, authentication/identity, callback delivery, service ownership, and failure behavior. Ad Validate must not read New Job DOM or internal state.

**Flow:** New Job offers Validate → passes context → Ad Validate validates context and starts a run → completed result is delivered back → New Job decides whether Send Mail is enabled.

**Acceptance criteria**

1. Given a launch request, when required fields are inspected, then the contract specifies `job_id`, platform, website URL, ad account ID, expected campaign context, user identity, and return/callback destination with types and validation rules.
2. Given completion, when Ad Validate sends an outcome, then the payload specifies run ID, status, rule-set version, summary, actor, timestamp, and an idempotency key.
3. Given duplicate or failed delivery, when upstream retries or the callback is retried, then neither system creates duplicate business actions.
4. Given a standalone Ad Validate deployment, when New Job UI is absent, then Ad Validate still loads and processes a mock launch context.
5. PO and Tech Lead record the final service boundary, owner, versioning strategy, and sample request/response in a decision log.

**Errors/edges:** Missing field, invalid platform/account pairing, cancelled upstream job, expired launch token, callback target unavailable.  
**Test data/evidence:** Valid and invalid Google launch payloads; sample completion payload; contract test results.  
**Dependencies:** New Job owner, identity service, credential owner.  
**Open decisions:** Service versus backend module, source of truth for job/account mapping, callback transport and authentication.

<a id="av-102"></a>
## AV-102 — Validate launch context before scan

**Priority / target / owner:** P0 · 9 Oct · Dev  
**User story:** As a DMS Operator, I want to see what is missing before starting validation so I can correct it in New Job.  
**Value:** Avoid invalid scans and provide a clear recovery path.

**Preconditions:** A launch context has been received under AV-101. Operator identity is known.  
**Flow:** Open Ad Validate → validate required fields and account access → show missing or invalid items → direct operator back to the relevant source, or enable Start Validate.

**Acceptance criteria**

1. Given missing `job_id`, platform, website URL, or ad account ID, when the page loads, then Start Validate is disabled and each missing item is named.
2. Given an account ID that does not belong to the selected platform, when checked, then scan is rejected with an actionable reason.
3. Given absent/expired credentials or insufficient read scope, when access is checked, then no run starts and the UI identifies the access problem without exposing secrets.
4. Given corrected data, when context is reloaded, then the validation state updates and Start Validate becomes available.
5. Backend repeats all precondition checks; disabled UI alone is insufficient.

**Errors/edges:** Invalid URL, inactive account, no campaign, upstream job cancelled after launch, transient credential check failure.  
**Test data/evidence:** Missing-field matrix, wrong-platform account, credential denial, valid Google account.  
**Dependencies:** AV-101, account mapping, credential service.  
**Open decisions:** Which optional business fields are required for specific Google rules.

<a id="av-103"></a>
## AV-103 — Create one validation run and enforce the gate

**Priority / target / owner:** P0 · 9 Oct · Dev  
**User story:** As a DMS Operator, I want one visible run for each requested scan so I cannot proceed before a valid result exists.  
**Value:** Reliable run history and a backend-enforced pre-launch gate.

**Preconditions:** AV-102 passes.  
**Flow:** Operator presses Start Validate → API creates run with `scanning` state → runner receives run ID → UI displays progress → findings determine gate state.

**Acceptance criteria**

1. Given the same start request is retried, when the API receives it again, then the original run ID is returned and no duplicate run is created.
2. Given a scan in progress, when Start Validate is pressed again, then UI and backend prevent a second concurrent run under the agreed policy.
3. Given no current completed scan, when Proceed is requested, then backend rejects it.
4. Given at least one unresolved Critical finding, when Proceed is requested, then backend rejects it even if the UI request is forged.
5. Run persists job/account context, platform, rule-set version, status, creation/update timestamps, and initiating actor.

**Errors/edges:** Runner crashes, request timeout after run creation, concurrent operators, expired run, cancelled job.  
**Test data/evidence:** Duplicate request/concurrency test, Critical gate API test, run-state transition log.  
**Dependencies:** AV-101/102, run store, role service.  
**Open decisions:** Concurrency policy and scan-expiry duration.

<a id="av-104"></a>
## AV-104 — Run Google Ads and tag-health scan

**Priority / target / owner:** P0 · 16 Oct · Dev  
**User story:** As Ad Validate, I want a runner that gathers Google Ads and tag-health snapshots so the same run can evaluate all applicable rules.  
**Value:** Repeatable and observable scan orchestration.

**Preconditions:** A valid run exists, with credential references and an approved Google account.  
**Flow:** Runner takes run ID → loads context → fetches Google configuration/conversion data and website/tag health → normalizes snapshots → records source/time → invokes rule evaluation → persists outcome.

**Acceptance criteria**

1. Google and tag-health fetching are separate adapters from rule evaluation; normalized snapshot contracts are documented.
2. Connector timeout, rate limit, partial response, and authorization failure have distinct retry/failure states; failures cannot be shown as Pass.
3. Retry of a connector does not create a new validation run or duplicate findings.
4. Runner records source reference, observed time, connector response metadata, and run correlation ID without storing tokens in logs.
5. UI can obtain progress and a final state without requiring a long blocking HTTP request.

**Errors/edges:** Google API rate limit, no campaign, no conversion action, website redirect loop, consent banner, tag-health service unavailable.  
**Test data/evidence:** Success, partial, timeout, permission-denied, and retry fixtures; one staging end-to-end Google scan.  
**Dependencies:** AV-103, Google credentials/API scopes, tag-health contract.  
**Open decisions:** Queue/worker runtime, timeout/retry/backoff policy, snapshot retention.

<a id="av-105"></a>
## AV-105 — Evaluate a versioned Google rule set

**Priority / target / owner:** P0 · 16 Oct · PO + Dev  
**User story:** As a DMS Lead, I want every finding tied to the exact rule version used so past decisions remain auditable after rules change.  
**Value:** Stable gate decisions and explainable history.

**Preconditions:** Production Google rule inventory has been reviewed; snapshots are available from AV-104.  
**Flow:** Resolve active Google rule-set version → check applicability/dependencies → evaluate each rule → persist immutable findings and a gate summary.

**Acceptance criteria**

1. Every rule has ID, platform, category, severity, check type, evaluator version, applicability, evidence source, and remediation type.
2. Each run freezes the selected rule-set version; changing active rules does not alter historical results.
3. Conditional rules, including Google P-028 where applicable, run only when their dependencies and product conditions are satisfied.
4. Not applicable and unavailable evidence are distinct states; missing evidence cannot silently become Pass.
5. Rule evaluation produces deterministic results for the approved fixture set.

**Errors/edges:** Rule-set changes mid-run, stale snapshot, rule evaluator error, dependency unavailable.  
**Test data/evidence:** Fixture per representative Critical/Warning/Manual/Not applicable rule; version migration test.  
**Dependencies:** AV-104, signed Google rule inventory.  
**Open decisions:** Code configuration versus admin UI; which of the prototype's 17 Google rules are MVP production rules.

<a id="av-106"></a>
## AV-106 — Check conversion activity and tag health

**Priority / target / owner:** P0 · 16 Oct · Dev + Web/Tracking  
**User story:** As a DMS Operator, I want to know whether conversion and tracking are actually working so I can correct them before customer approval.  
**Value:** Prevent launches with broken or duplicate measurement.

**Preconditions:** Google conversion data and tag-health evidence are available.  
**Flow:** Inspect conversion method/activity → inspect Google Ads tag, GA4 tag, and Plus AdTech script → assess duplicate-event risk → show finding and remediation owner.

**Acceptance criteria**

1. A conversion that exists but has not fired is not reported as a verified Pass.
2. No firing conversion cannot be bypassed by exception; backend gate policy enforces this.
3. Findings show inspected URL/account, source, scan timestamp, observed condition, and recheck instructions.
4. Unreachable website, blocked scan, or missing API data is marked as unavailable/manual evidence, never Pass.
5. Duplicate-event findings identify the competing sources when evidence supports the claim.

**Errors/edges:** Consent banner, redirects, delayed conversion propagation, GTM and legacy script both firing, website changes during scan.  
**Test data/evidence:** Firing, non-firing, no-action, duplicate-tag, and unavailable-site fixtures; Web/Tracking review.  
**Dependencies:** AV-104/105, tag-health service, Web/Tracking Team.  
**Open decisions:** Exact firing window and handling of delayed platform reporting.

<a id="av-107"></a>
## AV-107 — Show actionable findings and history

**Priority / target / owner:** P0 · 23 Oct · Dev  
**User story:** As a DMS Operator, I want findings grouped and explained so I know what failed, why it matters, and who should fix it.  
**Value:** Faster remediation and fewer ambiguous decisions.

**Preconditions:** Rule evaluation has created findings.  
**Flow:** Open result → view summary and gate state → filter Setup/Configuration/Customization and severity → open a finding → choose an allowed action.

**Acceptance criteria**

1. Every finding shows rule ID/version, result, severity, reason, impact, evidence, remediation, owner, and timestamp.
2. Critical, Warning, Info, Manual, and Not applicable are visually and textually distinct; color is not the only signal.
3. User can identify unresolved blocking findings and the action needed to clear them.
4. Current and prior runs can be opened by job ID and validation run ID without rewriting old findings.
5. Empty, loading, partial, and connector-error states tell the user what to do next.

**Errors/edges:** Partial result, stale run, no findings, inaccessible evidence reference.  
**Test data/evidence:** UI fixtures for every severity and error state; keyboard/accessibility review.  
**Dependencies:** AV-103/105/106, finding store.

<a id="av-108"></a>
## AV-108 — Fix findings and re-scan

**Priority / target / owner:** P0 · 23 Oct · Dev  
**User story:** As a DMS Operator, I want to preview an auto-fix or open an external tool, then re-scan to verify the result.  
**Value:** Close the loop between diagnosis and verified repair.

**Preconditions:** Finding and allowed remediation type exist; actor has permission.  
**Flow:** Select finding → preview API mutation or open Ads Manager/GTM → confirm/action → record event → re-scan affected rule or full run → refresh gate.

**Acceptance criteria**

1. Auto-fix displays before/after preview and requires explicit user confirmation before a platform mutation.
2. Only supported, reversible/verifiable fixes are eligible for bulk action; a failed mutation is not marked resolved.
3. External fix provides a deep link and user-initiated re-scan; a user claim alone does not turn finding into Pass.
4. Action history stores actor, time, before/after, reason where applicable, connector response reference, and resulting evaluation.
5. Eventual consistency is handled with a pending/recheck state instead of incorrectly reporting failure or success.

**Errors/edges:** Mutation succeeds but re-scan sees old value, permission changes, two operators act concurrently, platform mutation fails.  
**Test data/evidence:** Preview/confirm/cancel tests, mutation failure, external re-scan, concurrency fixture.  
**Dependencies:** AV-107, Google mutation permissions and rollback policy.

<a id="av-109"></a>
## AV-109 — Approve Warning/Manual exception

**Priority / target / owner:** P1 · 23 Oct · DMS Lead + Dev  
**User story:** As a DMS Lead, I want to acknowledge allowed Warning/Manual findings with evidence so a proceed decision is accountable.  
**Value:** Controlled exceptions with a complete audit trail.

**Preconditions:** Run is current; finding is eligible; actor has Reviewer/Lead permission.  
**Flow:** Lead opens finding → enters reason/evidence → backend checks policy and permission → appends audit event → gate is re-evaluated.

**Acceptance criteria**

1. Operator without approval permission cannot create an exception through UI or API.
2. Eligible exceptions require actor, reason, evidence/reference, finding ID/version, and timestamp.
3. Critical findings and no-firing-conversion conditions cannot be bypassed.
4. The decision is append-only; later changes create new audit events rather than altering history.
5. Proceed becomes available only if the backend gate policy is satisfied after the exception.

**Errors/edges:** Expired run, finding changed after re-scan, duplicate approval, stale UI, missing evidence.  
**Test data/evidence:** Authorized/unauthorized API tests, bypass-denial tests, audit trail review.  
**Dependencies:** AV-103/106/107, identity/role service.  
**Open decisions:** Who may approve Warning versus Manual and whether two-person approval is required.

<a id="av-110"></a>
## AV-110 — Deliver completion outcome to New Job

**Priority / target / owner:** P0 · 23 Oct · Dev  
**User story:** As New Job, I want a reliable validation outcome so Send Mail becomes available only after Ad Validate passes the gate.  
**Value:** Reliable handoff to customer approval without bypassing validation.

**Preconditions:** Current run passes backend gate; completion contract AV-101 is approved.  
**Flow:** Operator selects Proceed → backend checks gate and persists completion → emits delivery event → sends outcome → New Job acknowledges and enables Send Mail.

**Acceptance criteria**

1. Backend rejects completion when run is absent, expired, scanning, blocked, or otherwise outside approved policy.
2. Outcome includes job ID, run ID, status, platform, rule-set version, summary, completion time, and actor.
3. Sending the same outcome more than once with the same idempotency key has one logical effect upstream.
4. Delivery failure is persisted and retried without reversing a completed validation decision.
5. UI shows pending/failed/synced delivery state and does not imply New Job received the result until acknowledged.

**Errors/edges:** Callback timeout, duplicate response, cancelled upstream job, upstream unavailable, run expires between UI display and Proceed.  
**Test data/evidence:** Contract test, duplicate delivery test, unavailable-upstream/recovery test.  
**Dependencies:** AV-101/103/107/109, delivery store, New Job integration owner.

<a id="av-111"></a>
## AV-111 — Retry pending delivery and expire old scans

**Priority / target / owner:** P1 · 23 Oct · Tech Lead + Dev  
**User story:** As a DMS Lead, I want pending callbacks retried and old results expired so no outcome is lost or incorrectly treated as current.  
**Value:** Operational reliability after the user leaves the page.

**Preconditions:** Delivery events and run expiry policy exist.  
**Flow:** Scheduled worker finds due pending deliveries → retries with the same idempotency key → records response/backoff → marks runs expired under approved policy → exposes state to UI/operations.

**Acceptance criteria**

1. Only due, unresolved delivery events are retried; acknowledged events are not resent unnecessarily.
2. Retry retains the original event/run identity and idempotency key and records attempt count and next attempt time.
3. Expired results cannot satisfy a new Proceed request; user receives a re-scan instruction.
4. Worker is safe when two instances run concurrently and provides failure visibility/alerting.
5. This scheduled job does **not** start a new Google scan automatically.

**Errors/edges:** Scheduler outage, repeated upstream failure, poisoned event, concurrent workers, clock/time-zone boundary.  
**Test data/evidence:** Backoff/concurrency/expiry fixtures; operations log and alert example.  
**Dependencies:** AV-103/110.  
**Open decisions:** Cron versus queue scheduler, cadence, maximum attempts, dead-letter handling, expiry duration.

<a id="av-112"></a>
## AV-112 — UAT and deliver Google Ads slice

**Priority / target / owner:** P0 · 30 Oct · PO + DMS Lead + Dev  
**User story:** As a PO, I want DMS to test the full Google Ads path and sign off so the team can make an informed release decision.  
**Value:** A reviewable handoff with evidence instead of an unverified feature-complete claim.

**Preconditions:** AV-101–110 P0 scope is integrated in staging; required P1 policy is agreed.  
**Flow:** Prepare realistic test cases → DMS runs UAT → log defects by severity → fix and retest blockers → PO/Lead records sign-off or release constraints.

**Acceptance criteria**

1. UAT covers valid scan, missing context, Critical block, Warning/Manual policy, conversion not firing, fix/re-scan, callback failure/retry, and expired result.
2. No unresolved severity-one blocker remains; any lower-severity issue has owner, workaround, and decision.
3. Rule inventory/version, API contracts, operation notes, and short DMS user guide are available.
4. PO and DMS Lead record UAT evidence, date, sign-off, and release decision.
5. Delivery status is reported honestly as staging-ready, pilot-ready, or production-ready according to the decision; the October target alone does not imply production deployment.

**Errors/edges:** Credential/app review incomplete, tag-health service unavailable, late API contract changes, missing test data.  
**Test data/evidence:** UAT checklist with run IDs/screenshots, defect list, sign-off record, release checklist.  
**Dependencies:** All prior Google P0 stories, Dev estimate and environment readiness.

---

## Backlog after the October Google slice

Meta Ads and TikTok Ads production adapters/rules, automatic scheduled campaign scans, and an admin UI for rule management require separate scope, API feasibility, estimates, and dates. They are not implied by the October Google Ads UAT target.
