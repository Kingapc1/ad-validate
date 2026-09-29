# Ad Validate P-003 — ใช้เงื่อนไข Conversion Tag Health จาก Ad Optimizer

Status: Draft รอ PO review
Date: 2026-09-29
Owner: PO (Plus AdTech)
Rule: **P-003 สถานะ Conversion = Active / No recent conversions** (Configuration · Critical · Google Ads)
Source of truth ของเงื่อนไข: Jira **MC-5705** — การ์ด Conversion Tag Health (Smart Alerts `sa-6`) ใน Ads Optimizer รวม Intake update 2026-09-22 และ 2026-09-25
Related: `diagrams/rule-set.html` (P-003), `docs/superpowers/specs/2026-09-25-tag-firing-inspector-design.md` (P-027), `prototype/reference/new-job-ad-validate.integrated.v2.html`

---

## 1. ปัญหา

1. **P-003 กับ Ad Optimizer ใช้เกณฑ์คนละชุด:** ตอนนี้ P-003 ตัดสินจาก `conversion_action.status = ENABLED` + `metrics.conversions` ใน lookback ที่ยังไม่ได้ตกลง (`rule-set.html`: "เช่น 7 วันล่าสุด") ส่วน Ad Optimizer มีการ์ด Conversion Tag Health ที่ PO ตกลงเกณฑ์แล้ว (3 / 7 / 14 วัน · clicks ≥ 20 · learning 7 วัน) ผลจึงอาจขัดกัน เช่น Ad Validate บอกว่าไม่ผ่าน แต่ Ad Optimizer บอกว่า Healthy
2. **การ์ดบอกแค่ข้อความเดียว:** ตอนนี้การ์ด P-003 ขึ้นแค่ประโยคเดียว เช่น `tag "ซื้อสินค้า" ไม่ส่งสัญญาณมา 6 วัน` ผู้ใช้ไม่เห็นว่ามี conversion action อะไรบ้าง ตัวไหนปกติ และตัวไหนมีปัญหา
3. **งานเปิดใหม่เสี่ยงถูกบล็อกผิด:** งานที่ยังไม่มีโฆษณาวิ่งจะมี conversion = 0 เสมอ ถ้าใช้ "conversion = 0 → fail" ตรงๆ จะบล็อกทุกงาน (ปัญหาเดียวกับ P-027 ใน §1 ของ spec Inspector)

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
1. P-003 ใช้ **classifier ตัวเดียวกับ Ad Optimizer** (`classifyConversionAction`) ไม่เขียน logic ซ้ำ ผลของสองระบบจึงตรงกันเสมอ
2. การ์ด P-003 แสดงตาราง conversion action รายตัวพร้อมป้าย Health แบบเดียวกับการ์ด Conversion Tag Health
3. แปลงกลุ่ม Health เป็นสถานะของ Ad Validate (ผ่าน / เตือน / บล็อก) ให้ชัดเจน โดย**ไม่บล็อกงานที่แค่ยังไม่มีข้อมูล**

**ไม่ใช่เป้าหมาย (รอบนี้)**
- ไม่เปลี่ยนเกณฑ์หรือป้ายของ Ad Optimizer (MC-5705 เป็นเจ้าของ) ถ้าจะเปลี่ยนต้องแก้ที่นั่น แล้ว P-003 จะได้ตามไปเอง
- ไม่แก้ tag ให้อัตโนมัติ P-003 ยังเป็น "ทีมแก้นอกระบบ" (`act: ack`)
- ไม่รองรับ Meta / TikTok (Google Ads เท่านั้น เหมือน MC-5705)
- ไม่ใช้ Inspector (synthetic test) ใน P-003 เพราะเป็นงานของ P-027 ส่วน P-003 อ่านจาก Google Ads API อย่างเดียว

## 3. เงื่อนไข Conversion Tag Health (ยกมาจาก MC-5705 ฉบับล่าสุด)

### 3.1 ขอบเขตข้อมูล

| หัวข้อ | ค่า | ที่มา |
|---|---|---|
| Conversion action ที่ตรวจ | เฉพาะ `status = ENABLED` ส่วน REMOVED / HIDDEN / อื่นๆ ข้ามไปเลย (ไม่แสดง ไม่นับ) | Intake update 2026-09-22 |
| Origin | แสดงทุก origin (WEBSITE / GOOGLE_HOSTED / GOOGLE_ANALYTICS_4 / APP …) | Note for Developer |
| Lookback | **30 วัน** (เป็นหน้าต่างดึงข้อมูล ไม่ใช่เกณฑ์ที่ 4) | comment 1 |
| Clicks ขั้นต่ำก่อนตัดสิน | **≥ 20** ใน 30 วัน | comment 1 |
| อายุขั้นต่ำของ action (learning) | **7 วัน** | comment 1 |
| เกณฑ์เงียบ | **> 3 / > 7 / > 14 วัน** | Note for Developer |
| ค่าเกณฑ์ | อ่านจาก config / rule settings ห้าม hard-code | comment 1 |

### 3.2 GAQL (ต้องแยกเป็น 2 query)

ห้ามรวม `metrics.conversion_last_*` กับ `segments.date` ใน query เดียว เพราะ Google คืนผลเป็น `[]` โดยไม่แจ้ง error (บั๊กที่พบใน MC-5705 และแก้แล้วที่ commit `f649f913c5c`)

```sql
-- Q1 inventory + วันที่ล่าสุด (ไม่มีช่วงวันที่)
SELECT conversion_action.id, conversion_action.name, conversion_action.status,
       conversion_action.category, conversion_action.origin,
       conversion_action.primary_for_goal, conversion_action.type,
       metrics.conversion_last_conversion_date,
       metrics.conversion_last_received_request_date_time
FROM conversion_action
WHERE conversion_action.status = 'ENABLED'

-- Q2 จำนวน conversion ใน lookback
SELECT conversion_action.id, metrics.all_conversions
FROM conversion_action
WHERE segments.date DURING LAST_30_DAYS
```

ห้ามใส่ `primary_for_goal = TRUE` หรือ `type = 'WEBPAGE'` ใน WHERE ของ Q1 เพราะจะทำให้แถว Google hosted / GA4 หายไป ถ้าต้องกรองเฉพาะ Primary ให้กรองตอนประเมินผล ดู §4.2

### 3.3 ป้าย Health และลำดับการตัดสิน

conversion action หนึ่งตัวได้ **ป้ายหลักเพียงป้ายเดียว** (ป้ายที่รุนแรงที่สุดชนะ) เหตุผลที่เหลือไปอยู่ใน `relatedReasons` (`+N related`)

| ลำดับ | เงื่อนไข | ป้าย | กลุ่ม |
|---|---|---|---|
| 0 | `status = ENABLED` **และ** `all_conversions (30d) ≥ 1` → ผ่านทันที ไม่มีเหตุผลรอง | Receiving signals | 🟢 Healthy |
| 1 | conversion = 0 และ (clicks < 20 **หรือ** action อายุ < 7 วัน) | Need more data | ⚪ Insufficient data |
| 2 | conversion = 0 · origin = WEBSITE · `last_received_request` ภายใน 3 วัน | Tag fires, no conversions | 🟡 Needs attention |
| 3 | conversion = 0 · origin = WEBSITE · เงียบ > 14 วัน | Possibly inactive | 🔴 Broken |
| 4 | conversion = 0 · origin = WEBSITE · เงียบ > 7 วัน | Stale signal | 🟡 Needs attention |
| 5 | conversion = 0 · origin = WEBSITE · เงียบ > 3 วัน | Signal delayed | 🟡 Needs attention |
| 6 | conversion = 0 · origin ≠ WEBSITE | Need more data | ⚪ Insufficient data |

กติกาที่ต้องคงไว้:
- ป้ายที่อิงเวลา (`Signal delayed` / `Stale signal` / `Possibly inactive`) และ `Tag fires, no conversions` ใช้ได้**เฉพาะ origin = WEBSITE** ทั้งในป้ายหลักและใน `relatedReasons`
- "เงียบ" คิดจาก `conversion_last_received_request_date_time` (สัญญาณ tag) แยกจาก `conversion_last_conversion_date` (conversion จริง) ต้องใช้ทั้งสอง field เพื่อแยกเคส "tag ยิงแต่ไม่มีคนทำ conversion" ออกจาก "tag เงียบไปเลย"
- ห้ามใช้คำว่า "Inactive" เป็นข้อสรุป ให้ใช้ `Possibly inactive`
- `Action disabled` ยังอยู่ในโค้ดเป็น safety net แต่ไม่ควรเกิด เพราะ Q1 กรอง ENABLED แล้ว

> ลำดับ 1–6 เรียงตามที่อ่านได้จาก Test Case ใน MC-5705 ลำดับจริงในโค้ดอยู่ที่ `conversion-tag-health.domain.ts` (`classifyConversionAction`) **Dev ต้องยึดโค้ดเป็นหลัก** ถ้าไม่ตรงกับตารางนี้ให้แก้ตารางนี้ อย่าแก้โค้ด

## 4. การแปลงผลเป็นสถานะของ Ad Validate

### 4.1 Mapping

| กลุ่ม Health ของ action | สถานะในการ์ด P-003 | ผลต่อปุ่ม "ดำเนินการต่อ" |
|---|---|---|
| มี 🔴 Broken อย่างน้อย 1 ตัว | **ไม่ผ่าน · Critical** | บล็อก |
| ไม่มี Broken แต่มี 🟡 Needs attention | **ไม่ผ่าน · Warning** | ไปต่อได้ ต้องกดยืนยัน (ตาม gate `warnings` เดิม) |
| มีแต่ 🟢 Healthy (อาจมี ⚪ ปนอยู่ด้วย) | **ผ่าน** | — |
| มีแต่ ⚪ Insufficient data | **ผ่าน · รอยืนยันหลังออนไลน์** (ไม่บล็อก) | — |
| ไม่มี conversion action ที่ ENABLED เลย | **ไม่ผ่าน · Critical** | บล็อก (ต้องสร้าง conversion ก่อน) |
| ดึงข้อมูลไม่สำเร็จ (API error / token หมดอายุ) | **ตรวจไม่ได้** | บล็อก + ปุ่ม "ตรวจอีกครั้ง" · ห้ามตีเป็น "ผ่าน" |

เหตุผลของแถว "Insufficient data → ผ่าน": งานเปิดใหม่ไม่มีคลิก จึงเข้า `Need more data` แทบทุกตัว ถ้าบล็อกจะเกิดปัญหาเดียวกับ P-027 ส่วนการยืนยันว่า tag ยิงจริงก่อนออนไลน์เป็นหน้าที่ของ P-027 (Inspector)

### 4.2 action ไหนนับเข้า verdict

- **แสดง** ทุก action ที่ ENABLED (เหมือนการ์ดใน Ad Optimizer)
- **นับเข้า verdict** เฉพาะ `primary_for_goal = TRUE` ส่วน Secondary ที่เป็น Broken / Needs attention จะแสดงป้ายตามจริง แต่ทำให้การ์ดเป็น**สูงสุดแค่ Warning** ไม่บล็อก
- เหตุผล: action ที่เป็น Secondary ไม่ได้ใช้ bidding ถ้าพังก็ไม่ทำให้แคมเปญเสีย *— รอ PO ยืนยัน (Q1)*

## 5. UI ของการ์ด P-003

ใช้ตาราง 7 คอลัมน์และป้ายสีชุดเดียวกับการ์ด Conversion Tag Health (ลด 1 คอลัมน์เมื่อจอแคบ ดูด้านล่าง)

```
┌ สถานะ Conversion = Active / No recent conversions          [ไม่ผ่าน · Critical] ┐
│ ⓘ ใช้เกณฑ์เดียวกับ Ad Optimizer › Conversion Tag Health · ข้อมูล 30 วันล่าสุด     │
│                                                                                 │
│ สรุป: 🔴 1 Broken · 🟡 1 Needs attention · 🟢 2 Healthy · ⚪ 1 Insufficient data  │
│ [All (5)] [Broken (1)] [Needs attention (1)] [Healthy (2)] [Insufficient (1)]   │
│                                                                                 │
│ Conversion action      Goal      Source   Opt.     Conv.30d  Health        Last │
│ ซื้อสินค้า (Purchase)    Purchase  Website  Primary  0         🔴 Possibly    …  │
│                                                              inactive +1       │
│ กรอกฟอร์ม (Lead)        Lead      Website  Primary  0         🟡 Tag fires,  …  │
│                                                              no conversions    │
│ โทรจากโฆษณา             Call      Google   Primary  12        🟢 Receiving   …  │
│ …                                                                               │
│                                                                                 │
│ 💡 สิ่งที่ต้องทำ: ให้ทีมเว็บตรวจ tag ของ "ซื้อสินค้า" (เงียบ 18 วัน) บนหน้า thank-you │
│ [แก้แล้ว · ให้ระบบตรวจซ้ำ]  [เปิดใน Ad Optimizer]  [เปิดใน Google Ads]              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

กติกา UI:
1. **เรียงแถว** Broken → Needs attention → Healthy → Insufficient data และในกลุ่มเดียวกันให้ Primary ขึ้นก่อน
2. ชิปกรองมีตัวเลขในวงเล็บที่ตรงกับจำนวนแถวจริง และผลรวมของ 4 กลุ่มต้องเท่ากับ All
3. แถว Secondary มีป้าย `Secondary · ไม่นับเข้าผลตรวจ` เพื่อให้เข้าใจว่าทำไมแถวแดงแต่การ์ดไม่บล็อก (ตาม §4.2)
4. `+N related` กางออกได้ เพื่อดู "Also matched"
5. บรรทัด "สิ่งที่ต้องทำ" สร้างจากแถวที่รุนแรงที่สุด 1 แถว:
   - `Possibly inactive` / `Stale signal` / `Signal delayed` → "ตรวจ tag ของ … บนหน้า … (เงียบ N วัน)"
   - `Tag fires, no conversions` → "tag ยิงอยู่แต่ไม่มี conversion — ตรวจ trigger / ค่า conversion ของ …"
   - มีแต่ Insufficient data → "ยังไม่มีข้อมูลพอตัดสิน — ระบบจะตรวจอีกครั้งหลังออนไลน์ (Ad Optimizer)"
6. ปุ่ม **"แก้แล้ว · ให้ระบบตรวจซ้ำ"** จะดึง Q1 + Q2 ใหม่และประเมินใหม่ทั้งการ์ด (ใช้ flow `recheck` เดิม)
7. ปุ่ม **"เปิดใน Ad Optimizer"** deep link ไป `ads-optimizer/overview/detail/detect-conversion-tag-health` ของร้านนั้น
8. จอแคบกว่า 768px: ซ่อนคอลัมน์ Goal และ Action optimization และให้แสดง Primary / Secondary เป็น tag เล็กใต้ชื่อแทน

## 6. Tech notes

| เรื่อง | รายละเอียด |
|---|---|
| Reuse | เรียก `classifyConversionAction` และ data function ของ `conversion-tag-health.data.ts` ตรงๆ (lib `autodigi-services-lib`) **ห้าม copy logic มาไว้ใน Ad Validate** |
| Adapter | ใน Ads Platform Adapter (Google) เพิ่ม method `getConversionTagHealth(customerId)` ที่คืน `{ rows: ConversionTagHealthRow[], fetchedAt, lookbackDays }` และเก็บเป็น snapshot ของ run |
| Rule evaluation | P-003 อ่าน snapshot → ใช้ §4.1 / §4.2 → สร้าง finding พร้อม `evidence.rows` ทั้งตาราง |
| Snapshot | เก็บ rows ทั้งหมดไว้กับ run เพื่อตรวจสอบย้อนหลังได้ว่าตอน validate เห็นอะไร (ไม่ต้องไปดึง Ad Optimizer ย้อนหลัง) |
| Storage | ไม่เขียนลง `smart_alert_cards` / `smart_alert_histories` ของ Ad Optimizer เพราะ Ad Validate มี validation store ของตัวเอง |
| Global toggle | ไม่ผูกกับ Global toggle ของ `sa-6` คือ P-003 ทำงานเสมอ แม้ admin จะปิดการ์ดใน Ad Optimizer |
| Config | เกณฑ์ (3/7/14, 20 clicks, 7 วัน, 30 วัน) อ่านจาก config ชุดเดียวกับ Ad Optimizer |
| Rule version | การเปลี่ยนแหล่งเกณฑ์นับเป็น rule version ใหม่ของ P-003 run เก่าจึงยังอ้างเกณฑ์เดิม |

## 7. Acceptance criteria

- [ ] conversion action ชุดเดียวกัน ป้าย Health ใน P-003 **ตรงกับ** การ์ด Conversion Tag Health ใน Ad Optimizer ทุกแถว (เมื่อดึงในช่วงเวลาเดียวกัน)
- [ ] แสดงเฉพาะ action ที่ ENABLED และการกรองต้องอยู่ที่ Q1 ไม่ใช่ซ่อนใน UI
- [ ] มี Primary ที่เป็น Broken อย่างน้อย 1 ตัว → การ์ดไม่ผ่าน Critical และปุ่ม "ดำเนินการต่อ" กดไม่ได้
- [ ] มีแค่ Needs attention → การ์ดเป็น Warning และไปต่อได้หลังยืนยัน
- [ ] งานเปิดใหม่ที่ทุก action เป็น `Need more data` → การ์ด**ผ่าน**พร้อมข้อความ "รอยืนยันหลังออนไลน์" และไม่บล็อก
- [ ] action ที่มี conversion ≥ 1 ใน 30 วัน → `Receiving signals` เสมอ แม้ conversion ล่าสุดจะเกิน 3 / 7 / 14 วัน
- [ ] action ที่ origin ≠ WEBSITE ไม่มีป้ายอิงเวลาหรือ `Tag fires, no conversions` ทั้งในป้ายหลักและ related
- [ ] Secondary ที่ Broken ทำให้การ์ดเป็นแค่ Warning และแถวมีป้าย "ไม่นับเข้าผลตรวจ"
- [ ] ไม่มี conversion action ที่ ENABLED เลย → Critical
- [ ] API error → "ตรวจไม่ได้" ไม่ใช่ผ่าน และมีปุ่มตรวจอีกครั้ง
- [ ] ชิปกรองนับถูก และ 4 กลุ่มรวมกันเท่ากับ All
- [ ] ปุ่ม "เปิดใน Ad Optimizer" ไปที่หน้า detail ของร้านที่ถูกต้อง

## 8. Test cases หลัก

| # | สถานการณ์ | คาดหวัง |
|---|---|---|
| T1 | งานใหม่ ยังไม่มีคลิก ทุก action conversion = 0 | ทุกแถว `Need more data` · การ์ดผ่าน (รอยืนยันหลังออนไลน์) |
| T2 | Primary · Website · conv 0 · clicks ≥ 20 · อายุ > 7 วัน · เงียบ 18 วัน | `Possibly inactive` · การ์ด Critical · บล็อก |
| T3 | Primary · Website · conv 0 · tag ยิงภายใน 3 วัน · last conversion > 14 วัน | `Tag fires, no conversions` + `+1 related` (Possibly inactive) · การ์ด Warning |
| T4 | Primary · conv 3 ใน 30 วัน · last conversion 10 วันก่อน | `Receiving signals` · ไม่มี related |
| T5 | Primary · GA4 import · conv 0 · เงียบ 20 วัน | `Need more data` · ไม่มีป้ายอิงเวลา |
| T6 | Secondary · Website · Possibly inactive · Primary อื่น Healthy | การ์ด Warning (ไม่บล็อก) · แถวมีป้าย "ไม่นับเข้าผลตรวจ" |
| T7 | action ที่ REMOVED | ไม่มีในตาราง และไม่นับในชิป |
| T8 | Google Ads API timeout | "ตรวจไม่ได้" + ปุ่มตรวจอีกครั้ง |
| T9 | เทียบกับ Ad Optimizer ของร้านเดียวกัน | ป้ายตรงกันทุกแถว |

## 9. คำถามที่ยังเปิดอยู่

| # | คำถาม | ใครตอบ | ค่าที่ใช้ไปก่อน |
|---|---|---|---|
| Q1 | นับเข้า verdict เฉพาะ Primary ใช่ไหม (§4.2) | PO | ใช่ ส่วน Secondary ทำให้การ์ดเป็นสูงสุดแค่ Warning |
| Q2 | "Needs attention" ควรเป็น Warning (ไปต่อได้) หรือ Critical | PO | Warning |
| Q3 | Insufficient data ทั้งหมด → ผ่าน หรือ "ตรวจเอง" (manual) | PO | ผ่าน + ข้อความ "รอยืนยันหลังออนไลน์" เพราะ P-027 รับผิดชอบการยืนยันก่อนออนไลน์ |
| Q4 | ลำดับ rule จริงในโค้ดตรงกับ §3.3 ไหม | Dev (Bankz) | ยึดโค้ด |
| Q5 | Ad Validate เรียก lib ตรงได้ไหม หรือต้องผ่าน GraphQL ของ Ad Optimizer | Dev | เรียก lib ตรง (อยู่ใน mono repo เดียวกัน) |
| Q6 | ข้อความอธิบายการ์ดใน Ad Optimizer ยังพูดถึง "or is disabled" (`template-data.ts:346`, i18n `ads-optimizer-misc`) — ควรแก้พร้อมกันไหม เพื่อไม่ให้สองหน้าพูดไม่ตรงกัน | PO | แยกเป็น follow-up ของ MC-5705 |

## 10. ไฟล์ที่ต้องอัปเดตตาม spec นี้

| ไฟล์ | สิ่งที่ต้องแก้ |
|---|---|
| `diagrams/rule-set.html` | P-003: แหล่งข้อมูลเป็น "Google Ads API · classifier เดียวกับ Ad Optimizer (MC-5705)" · Logic เปลี่ยนเป็น §3.3 + §4.1 · ตัดข้อความ "lookback ต้องตกลงกับทีม เช่น 7 วัน" |
| `docs/PRD.md` | FR-03: อ้าง spec นี้สำหรับ P-003 |
| `prototype/reference/new-job-ad-validate.integrated.v2.html` | การ์ด P-003 เป็นตาราง Health ตาม §5 |
