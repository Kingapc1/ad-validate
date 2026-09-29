# Ad Validate — Background Run, คิวรอส่งตรวจ และ Notification (Design Spec)

Status: Draft — รอ PO review ก่อนเริ่มออกแบบ UI จริง
Date: 2026-09-25
Owner: PO (Plus AdTech)
Related: `docs/PRD.md` (FR-03, FR-05, FR-06), `docs/AD_VALIDATE_USER_STORIES_FULL.md` (AV-103, AV-104, AV-107, AV-108, AV-111)
Diagrams: [`diagrams/user-flow-v2.html`](../../../diagrams/user-flow-v2.html), [`diagrams/ad-validate-v2.html`](../../../diagrams/ad-validate-v2.html) (v1 ยังเก็บไว้ที่ `user-flow.html`, `ad-validate.html`)

---

## 1. ปัญหา (Feedback)

- การ crawl หน้าเว็บ, ดึงข้อมูลจาก Ads API และส่ง API ที่แก้ไขในหน้า Ad Validate ใช้เวลานาน
- ปัจจุบัน (prototype) กด “เริ่มตรวจ / ตรวจใหม่” แล้วเจอหน้า Loading ที่บล็อกหน้าจอจนกว่าจะเสร็จ และปุ่ม Apply ในแต่ละข้อยิง mutation ทันทีแล้วเปลี่ยนเป็น Pass เลย (`prototype/reference/new-job-ad-validate.integrated.html` — `.a-apply`, `.si-apply`, `.vni-applyall`)
- ผลที่ได้: MCC ต้องนั่งรอ ทำงานอื่นไม่ได้ และการแก้หลายข้อทำให้ต้องยิง API และรอหลายรอบ

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
1. ทุกรอบตรวจที่ผู้ใช้กดเองรันใน background โดยไม่บล็อกหน้าจอ
2. การแก้ไขแล้วกด Apply จะเก็บเป็น draft ในคิวก่อน แล้วรวมส่งครั้งเดียวด้วยปุ่ม “ส่งตรวจสอบใหม่” ซึ่งยิงการแก้ไขทั้งชุดแล้วตรวจใหม่ทั้งชุด
3. แจ้งคนที่กดว่าตรวจเสร็จแล้ว ทาง In-app + LINE OA XPluser (ใช้ Email เป็นช่องทางสำรอง)
4. Cron 00:00 รันตามเวลาเดิม เป็น full re-scan ทุกงานที่ค้าง และส่ง digest ตอนเช้า

**ไม่ใช่เป้าหมาย**
- ไม่ re-scan เฉพาะข้อ รอบตรวจทุกรอบเป็นแบบทั้งชุดเสมอ
- ไม่ให้ cron ยิง draft แทนผู้ใช้
- ไม่เปลี่ยน gate policy (Critical / Warning / Manual) หรือ rule set
- ไม่ทำหน้าตั้งค่าช่องทางแจ้งเตือนรายคน (ใช้กฎ LINE เป็นหลัก Email เป็นสำรอง ตายตัว)

## 3. การตัดสินใจที่ได้จากการ grill (2026-09-25)

| # | คำถาม | ตัดสินใจ |
|---|---|---|
| D1 | Apply ยิงไป platform ตอนไหน | **เก็บเป็น draft ก่อน** ยิงตอนกด “ส่งตรวจสอบใหม่” |
| D2 | Cron 00:00 ทำอะไร | **Full re-scan** ทุก job ที่อยู่ในขั้น Validate และยังไม่ proceed |
| D3 | Cron เจอ job ที่มี draft ค้าง | **Scan อย่างเดียว เก็บ draft ไว้** ถ้าค่าต้นทางเปลี่ยนจะติดป้าย “ค่าต้นทางเปลี่ยน” |
| D4 | ช่องทางแจ้งเตือน | In-app (bell + toast) + LINE OA XPluser + Email |
| D5 | Cron แจ้งเตือนไหม | **Digest รวม 1 ข้อความตอนเช้า** ต่อ MCC เฉพาะงานที่ผลเปลี่ยน |
| D6 | ระหว่างรัน หน้าเป็นยังไง | **อ่านได้อย่างเดียว** Apply / ส่งตรวจ / ดำเนินการต่อถูกล็อก |
| D7 | Draft ยิงไม่สำเร็จบางข้อ | **ทำต่อ + คืนข้อที่พลาดเข้าคิว** พร้อมเหตุผล |
| D8 | ใครได้รับแจ้ง (รอบที่ผู้ใช้กดเอง) | **คนที่กดส่งตรวจ** |
| D9 | XPluser พร้อมไหม | **มีแล้ว** มี API ภายในและ mapping พนักงาน ↔ LINE userId |
| D10 | “เริ่มตรวจ” ครั้งแรกเป็น background ไหม | **ใช่** ใช้ flow เดียวกัน ไม่มีหน้า Loading บล็อกอีก |
| D11 | LINE กับ Email | **LINE หลัก, Email สำรอง** ส่ง Email เมื่อยังไม่ผูก LINE หรือส่ง LINE ไม่สำเร็จ |

## 4. ผลกระทบต่อ scope ⚠️

- **AV-111** ปัจจุบันเขียนไว้ว่า scheduled job *“does not start a new Google scan automatically”* และในหัวข้อ out-of-scope มี *“automatic scheduled campaign scans”* เรื่อง D2 จึงเป็น **change request** ที่ต้องประเมิน effort ใหม่ และอาจกระทบวัน UAT ของ Google Ads ในเดือนตุลาคม
- ต้องแก้ PRD FR-03 / FR-05 / FR-06 และ user stories ตามตารางใน §10 (ยังไม่ได้แก้ในรอบนี้)

## 5. Flow

แหล่งอ้างอิงหลักคือ `diagrams/ad-validate-v2.html#flow`

```
เปิด Ad Validate → context ใช้ได้?
  └ MCC กด “เริ่มตรวจ” / “ส่งตรวจสอบใหม่ (n)” → confirm → run = queued
       └ Worker: applying → scanning → evaluating → completed | completed_with_errors | failed
            (ระหว่างนี้หน้าอ่านได้อย่างเดียว ผู้ใช้ออกจากหน้าได้)
       └ แจ้งคนที่กด: In-app + LINE XPluser (Email สำรอง)
  └ มี Critical? → แก้ไข → Apply = draft → คิวรอส่งตรวจ (n) → วนกลับไปกดส่งตรวจสอบใหม่
  └ เหลือ Warning/Manual? → ผู้มีสิทธิ์ยืนยัน + audit
  └ Validation completed → outcome กลับ New Job

Cron 00:00 → full re-scan ทุก job ที่ยังไม่ proceed (ไม่ยิง draft, ข้าม job ที่มี run active)
         → Digest 08:30 ต่อ MCC เจ้าของงาน
```

### วิธีแก้แต่ละประเภทหลังเปลี่ยน flow

| Remediation (FR-05) | เดิม | ใหม่ |
|---|---|---|
| `auto_fix` / แก้ค่าที่ส่งผ่าน API | ยิงทันที → Pass | **Apply → draft** → ยิงตอนส่งตรวจสอบใหม่ → Pass เมื่อ re-scan ยืนยันแล้วเท่านั้น |
| `external_fix` (แก้ใน Ads Manager / GTM) | กด “ตรวจซ้ำ” ทีละข้อ | ไม่มี draft ให้กด “ส่งตรวจสอบใหม่” เพื่อรันทั้งชุด |
| `exception` | บันทึกทันที | **บันทึกทันทีเหมือนเดิม** (ไม่แตะ platform จึงไม่ต้องเข้าคิว) และ gate คำนวณใหม่จาก run ล่าสุด |

## 6. Model

### 6.1 Validation run (ขยายจาก `validation_runs`)
- `trigger`: `user` | `cron`
- `run_state`: `queued` → `applying` (ข้ามได้ถ้าไม่มี draft) → `scanning` → `evaluating` → `completed` | `completed_with_errors` | `failed`
- `requested_by` (สำหรับ trigger = user), `draft_set_id`, `progress` (ขั้นปัจจุบัน + n/m), `started_at`, `finished_at`
- **Invariant:** หนึ่ง job มี run ที่ active ได้ไม่เกิน 1 run ถ้ามีคำขอใหม่เข้ามาระหว่างนั้น
  - trigger = user → เข้าคิวต่อท้าย (สถานะ queued)
  - trigger = cron → ข้าม job นั้นไป
- Idempotency: `job_id + draft_set_hash + trigger` ภายในช่วงเวลาสั้นๆ ให้คืน run เดิม (ตาม AC ของ PRD ที่ว่า retry แล้วต้องได้ run เดียว)
- `failed` ไม่เปลี่ยน gate โดยยังใช้ run ล่าสุดที่ completed และ draft ทั้งหมดยังอยู่ในคิว

### 6.2 Draft (ตารางใหม่ `finding_drafts`)
- `job_id`, `finding_rule_id`, `before`, `after`, `base_snapshot_ref`, `created_by`, `updated_at`
- `status`: `pending` → `sending` → `sent` | `send_failed` (กลับเป็น pending พร้อม `last_error`) | `cancelled`
- `stale`: เป็น true เมื่อ scan ล่าสุด (รวมถึงรอบ cron) พบค่าที่ platform ไม่ตรงกับ `before` ต้องให้ผู้ใช้ review ก่อนส่ง
- หนึ่ง finding มี draft ที่ pending ได้ 1 รายการ ถ้า Apply ซ้ำจะเขียนทับ draft เดิม
- Audit: สร้าง / แก้ / ยกเลิก / ส่ง draft บันทึกเป็น `finding_actions` (append-only ตาม FR-07)

### 6.3 Notification (service แยก รับ event)
- Event: `run.finished {run_id, job_id, trigger, run_state, summary, failed_drafts[]}`
- ผู้รับ: trigger = user → `requested_by` ส่วน trigger = cron → ไม่ส่งทันที แต่ไปรวมใน digest ของ MCC เจ้าของงาน
- ช่องทาง: In-app ส่งทุกครั้ง, ส่ง LINE XPluser ก่อน และถ้ายังไม่ผูก LINE หรือส่งไม่สำเร็จหลัง retry ครบให้ส่ง Email
- Digest 08:30: ต่อ MCC หนึ่งข้อความ เฉพาะงานที่ gate เปลี่ยน, มี Critical ใหม่ หรือมี draft ที่ stale ถ้าไม่มีงานเข้าเงื่อนไขก็ไม่ส่ง
- ทุกการส่งบันทึก `delivery_events` (ช่องทาง, ผลลัพธ์, retry)

### 6.4 API (ร่าง — ชื่อจริงรอ Tech Lead)
- `PUT /jobs/{job_id}/drafts/{rule_id}` · `DELETE …` · `GET /jobs/{job_id}/drafts`
- `POST /jobs/{job_id}/validation-runs` → `202 {run_id, run_state:"queued"}` (ไม่รอผล)
- `GET /validation-runs/{id}` (poll ทุก 5 วินาที หรือใช้ SSE `/validation-runs/{id}/events`)
- Proceed (`POST /validation-runs/{id}/proceed`) ถูกปฏิเสธเมื่อ job มี run active หรือมี draft ที่ pending

## 7. UX/UI design spec (แผนก่อนเริ่มออกแบบจริง)

### 7.1 หลักการ
1. **ไม่มีสถานะ “ผ่าน” ปลอม** — draft ไม่ใช่ Pass จะเป็น Pass ได้ก็ต่อเมื่อ re-scan ยืนยันแล้วเท่านั้น
2. **เห็นเสมอว่ามีอะไรค้างส่ง** — จำนวน draft แสดงบนปุ่มหลัก และบน queue bar
3. **ปล่อยให้ผู้ใช้ไปทำงานอื่นได้** — confirm แล้วต้องบอกชัดว่าปิดหน้าได้ และจะได้รับแจ้งทางช่องทางไหน
4. **ผลรอบก่อนต้องไม่หายไประหว่างรัน** — แสดงแบบจางและติดป้ายเวลา
5. **เมื่อผลใหม่มา ต้องบอกว่าอะไรเปลี่ยน** ไม่ใช่แค่ render list ใหม่

### 7.2 Screen / state inventory

| # | Screen / state | จุดสำคัญในการออกแบบ |
|---|---|---|
| S1 | **Finding card — draft** | Badge 🟠 “รอส่งตรวจ” (ไม่ใช้สีเขียว), แสดง before → after, ปุ่ม “แก้ไข” / “ยกเลิก draft”, สถานะ Critical/Warning ยังเป็นแบบเดิม |
| S2 | **Finding card — draft stale** | Badge ⚠️ “ค่าต้นทางเปลี่ยน” + ค่าใหม่จาก platform, ต้องกด “ตรวจ draft อีกครั้ง” ก่อนจึงจะนับรวมในการส่ง |
| S3 | **Finding card — send failed** | กลับเป็น “รอส่งตรวจ” พร้อม inline error (เช่น “token ไม่มีสิทธิ์แก้ Auto-apply”) และลิงก์วิธีแก้ |
| S4 | **Header action button** | ไม่มี draft → `ตรวจใหม่` (secondary) · มี draft → `ส่งตรวจสอบใหม่ · n รายการ` (primary) · มี run active → `กำลังตรวจ…` (disabled + spinner) · ยังไม่เคยตรวจ → `เริ่มตรวจ` |
| S5 | **Queue bar (sticky ด้านล่าง)** | “มี n การแก้ไขรอส่งตรวจ · ดูรายการ · [ส่งตรวจสอบใหม่]” เปิด drawer รายการ draft (แก้ / ยกเลิกได้) · ถ้ามี stale ให้ปุ่มส่งเป็น disabled พร้อมบอกเหตุผล |
| S6 | **Confirm modal** | รายการ draft (before → after, แยกตาม platform) + ข้อความ “ระบบจะส่งการแก้ไขไป Google Ads แล้วตรวจทั้งชุดใหม่ ใช้เวลาประมาณ X นาที ปิดหน้านี้ได้” + ช่องทางแจ้งเตือนที่จะได้รับ (“LINE XPluser: ชื่อบัญชี” หรือ “Email: …” ถ้ายังไม่ผูก LINE) · ปุ่ม `ส่งตรวจสอบใหม่` / `ยกเลิก` |
| S7 | **Running banner** | Stepper 4 ขั้น (ส่งการแก้ไข n/m → ดึงข้อมูล Ads → ตรวจเว็บ / Tag → ประเมินเงื่อนไข) + เวลาที่ผ่านไป + ปุ่ม “ไปทำงานอื่น” · findings ด้านล่างจางลงและติดป้าย “ผลรอบก่อน · 09:40” · ปุ่ม action ทั้งหมด disabled พร้อม tooltip “กำลังตรวจ — แก้ไขได้หลังตรวจเสร็จ” |
| S8 | **Queued behind another run** | Banner “รอคิว — ระบบกำลังตรวจรอบอัตโนมัติ (00:00) อยู่ รอบของคุณจะเริ่มต่อทันที” |
| S9 | **Completed — What changed** | Toast + banner สรุป “แก้แล้ว x · ยังไม่ผ่าน y · พบใหม่ z” คลิกแล้ว filter list ได้ · gate อัปเดตตามผลใหม่ |
| S10 | **Completed with errors** | Banner เหลือง “ส่งสำเร็จ 2/3 · 1 รายการกลับเข้าคิว” + ลิงก์ไปที่ card นั้น |
| S11 | **Failed** | Banner แดง พร้อมสาเหตุที่ผู้ใช้แก้ได้ + ปุ่ม “ลองใหม่” · ผลรอบก่อนยังแสดงอยู่ |
| S12 | **Job list (New Job)** | Pill ต่องาน: `กำลังตรวจ`, `รอส่งตรวจ n`, `ตรวจเสร็จ — ยังไม่เปิดดู` (มีจุด unread) |
| S13 | **Notification center (bell)** | รายการ run.finished / digest, จุด unread, คลิกแล้ว deep link ไปที่ job โดยเปิด What changed |
| S14 | **LINE XPluser — Flex message** | Header ตามสถานะ (✅ ผ่าน / ⛔ Critical n / ⚠️ มีปัญหา), ชื่องาน + platform + เวลา, สรุป n/n, ปุ่ม “เปิดผลตรวจ” (deep link) |
| S15 | **LINE digest 08:30** | รายการงานสูงสุด 5 งาน + “ดูทั้งหมด” · แต่ละงาน: ชื่อ, สิ่งที่เปลี่ยน, ลิงก์ |
| S16 | **Email fallback** | เนื้อหาเดียวกับ S14 / S15 แบบ HTML เรียบง่าย |

### 7.3 Microcopy (ร่าง)
- ปุ่ม: `เริ่มตรวจ` · `ตรวจใหม่` · `ส่งตรวจสอบใหม่ · 3 รายการ` · `กำลังตรวจ…` · `Apply` เปลี่ยนเป็น **`เพิ่มในคิวส่งตรวจ`** (ข้อเสนอ เพื่อให้ผู้ใช้ไม่เข้าใจว่า Apply = แก้เสร็จแล้ว — ต้องตัดสินใจใน review)
- Toast หลัง Apply: “เพิ่ม P-001 ในคิวแล้ว — กด ‘ส่งตรวจสอบใหม่’ เมื่อแก้ครบ”
- Toast หลังส่ง: “เริ่มตรวจแล้ว — เราจะแจ้งทาง LINE XPluser เมื่อเสร็จ ปิดหน้านี้ได้”
- LINE: “✅ ตรวจเสร็จแล้ว · งาน #35371801 (Google Ads) · ผ่าน 17/19 · Warning 2 · [เปิดผลตรวจ]”

### 7.4 Visual / system
- ใช้ Plus AdTech design system (primary `#7F70EF`, Sarabun, token เดียวกับ prototype)
- สีสถานะ: draft = amber outline (ไม่เติมสีพื้น), stale = amber + ไอคอน warning, running = primary tint, สีของ Critical/Warning ใช้ของเดิม
- Accessibility: banner ที่แสดงความคืบหน้าใช้ `aria-live="polite"`, ปุ่มที่ disabled ต้องมีข้อความบอกเหตุผล (ไม่ใช้สีอย่างเดียว), toast ไม่เป็นช่องทางเดียวที่แจ้งว่าตรวจเสร็จ
- Responsive: queue bar และ modal ต้องใช้ได้ที่ความกว้าง 375px (MCC เปิดจาก deep link ใน LINE บนมือถือ)

### 7.5 Deliverables ของเฟสออกแบบ (ขั้นถัดไป)
1. Low-fi wireframe S1–S11 (ในหน้า Ad Validate) ใช้ prototype เดิมเป็นฐาน
2. ~~Hi-fi mockup HTML~~ → ทำแล้วเป็น prototype ที่กดใช้งานได้: `prototype/reference/new-job-ad-validate.integrated.v2.html` (S1–S15, dev panel มีตัวจำลอง cron / ส่งไม่สำเร็จ / ไม่ผูก LINE) · S16 Email ยังเป็นแค่ข้อความใน preview
3. LINE Flex message JSON + ภาพ preview (S14, S15)
4. Email template (S16)
5. Hand-off: ตาราง state × component × copy สำหรับ Dev

## 8. Edge cases
- ผู้ใช้สองคน Apply ข้อเดียวกัน → last-write-wins บน draft และแสดง “แก้ล่าสุดโดย … เวลา …”
- Run นานเกิน timeout (ค่าเริ่มต้นเสนอ 20 นาที) → `failed` + แจ้งเตือน
- Worker ล่มกลางคัน → run ที่ค้างเกิน heartbeat จะถูก re-queue 1 ครั้ง ถ้าเกินนั้นเป็น `failed`
- Mutation สำเร็จแต่ scan ยังเห็นค่าเก่า (eventual consistency) → ข้อนั้นแสดง “ส่งแล้ว รอ platform อัปเดต” และตรวจอีกครั้งอัตโนมัติ 1 ครั้งภายใน run เดียวกัน
- Upstream job ถูกยกเลิกระหว่างรัน → ยกเลิก run ถ้ายังไม่ถึงขั้น applying ถ้าเลยขั้นนั้นแล้วให้รันจนจบแต่ไม่ส่ง outcome
- ผู้ใช้ไม่ผูก LINE และไม่มี Email → แจ้งเฉพาะ In-app และบันทึก delivery failure
- Scan expiry (FR-06 24 ชม.) — ผล cron ทำให้ผลสดทุกวัน ต้องยืนยันว่านับเป็น “scan ล่าสุด” สำหรับ proceed หรือไม่

## 9. Acceptance criteria (ร่าง)
1. กดเริ่มตรวจ / ส่งตรวจสอบใหม่ แล้ว API ตอบ `202` ภายใน 1 วินาที และ UI ไม่บล็อก
2. Apply ไม่เรียก platform mutation · finding ยังไม่เป็น Pass · จำนวนในคิวเพิ่มขึ้น
3. ส่งตรวจสอบใหม่แล้วระบบยิง draft ทุกข้อ และประเมิน rule **ทั้งชุด** ใน run เดียว
4. Draft ที่ยิงไม่สำเร็จกลับเข้าคิวพร้อม error · run = `completed_with_errors`
5. ระหว่างที่ run active: backend ปฏิเสธ proceed / สร้าง draft / สร้าง run ซ้อน (สร้าง run ใหม่ได้เฉพาะแบบเข้าคิว)
6. เมื่อ run จบ ผู้กดได้รับ In-app ทันที และได้ LINE (หรือ Email ถ้าไม่มี LINE) ภายใน 1 นาที
7. Cron 00:00 สร้าง run สำหรับทุก job ที่ยังไม่ proceed และไม่มี run active · ไม่ยิง draft · ติดป้าย draft ที่ stale
8. Digest ส่ง 08:30 ต่อ MCC เฉพาะเมื่อมีงานที่เข้าเงื่อนไข
9. Proceed ถูกปฏิเสธถ้ามี draft pending
10. ทุก action ของ draft และทุก delivery ค้นย้อนหลังได้จาก `job_id` / `validation_run_id`

## 10. งานที่ต้องปรับในเอกสารอื่น (หลัง spec นี้ approve)
| เอกสาร | เปลี่ยน |
|---|---|
| PRD FR-03 | background run, run_state, one-active-run invariant |
| PRD FR-05 | Apply = draft, ยิงทั้งชุดตอนส่งตรวจ |
| PRD FR-06 | proceed ต้องไม่มี run active และไม่มี draft pending · นิยามว่าผล cron นับเป็น scan ล่าสุดหรือไม่ |
| PRD §3 system flow | เพิ่ม Worker, Notification service, XPluser |
| AV-104 / AV-108 | async run + draft queue |
| AV-111 | cron full re-scan (change request) |
| ใหม่ AV-113 | Draft queue + ส่งตรวจสอบใหม่ (UI + API) |
| ใหม่ AV-114 | Notification: In-app + LINE XPluser + Email fallback + digest |

## 11. Open decisions
1. ETA ที่แสดงผู้ใช้ และ timeout ของ run (เสนอ 20 นาที)
2. API contract ของ XPluser (endpoint, auth, rate limit, รูปแบบ Flex message)
3. Digest ส่งวันหยุดด้วยหรือไม่
4. ผลจาก cron นับเป็น “scan ล่าสุด” สำหรับ proceed ได้หรือไม่ (FR-06)
5. เปลี่ยนชื่อปุ่ม Apply เป็น “เพิ่มในคิวส่งตรวจ” หรือไม่
6. ถ้าคนที่กดไม่ใช่ MCC เจ้าของงาน ต้องแจ้งเจ้าของงานด้วยหรือไม่ (เสนอว่าแจ้งแค่ In-app)
7. Worker runtime / queue technology (รอ Tech Lead เลือก backend stack — PRD §12 ข้อ 1)
