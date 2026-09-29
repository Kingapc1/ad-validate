# Plus AdTech — Tag Firing Inspector (PRD + Tech Spec + UI Spec)

Status: Draft รอ PO/CTO review
Date: 2026-09-25
Owner: PO (Plus AdTech)
Feature home: Plus AdTech → Conversion Tracking
Consumers: Ad Validate (โหมด Pre-launch), Ad Optimizer (โหมด Live)
Related: `docs/PRD.md` (FR-03, rule P-027 / P-028), `docs/AD_VALIDATE_USER_STORIES_FULL.md` (AV-106, AV-108), `diagrams/rule-set.html` (P-025, P-027, P-028), `docs/superpowers/specs/2026-09-25-background-validate-notify-design.md`

---

## 1. ปัญหา

1. **P-027 บล็อกงานเปิดใหม่ทุกงาน:** การ์ด "วิธีติด Conversion Tag" ใช้ `metrics.conversions > 0` ใน 7 วันล่าสุดจาก Google Ads API เป็นตัวตัดสินว่า conversion ยิงอยู่หรือไม่ แต่งานเปิดใหม่ยังไม่มีโฆษณาวิ่ง ค่านี้จึงเป็น 0 เสมอ และงานจะเข้ากรณี "ไม่พบสัญญาณ ยืนยันข้ามไม่ได้" ทุกครั้ง
2. **ระบบเดาว่าใครเป็นคนติดตั้ง:** Google Ads API ไม่มีฟิลด์ที่บอกว่าใครสร้าง tag (`creation_source` ไม่มีอยู่จริง) เมื่อไม่ใช่ Plus AdTech ระบบจึงเดาไว้ก่อนว่า "น่าจะเป็น GTM"
3. **ยังไม่มีการตรวจว่า tag ยิงจริง:** P-025 ตรวจแค่ว่ามี `bundle.js` อยู่บนหน้า ไม่ได้ตรวจว่ามีคลิกแล้วมี hit ส่งออกไปจริง
4. **P-028 ต้องขอสิทธิ์ GTM API:** ต้องได้สิทธิ์เข้า container ของลูกค้าทุกราย และอ่านได้แค่ config ไม่เห็นสิ่งที่ยิงออกไปจริง

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
1. ตรวจได้ว่า tag บนเว็บ**ยิงจริง**ไปยัง conversion action ที่ถูกต้อง โดยไม่ต้องรอ traffic จากโฆษณา
2. แยกได้จากหลักฐานว่าตัวที่ยิงคือ **Plus AdTech** (`bundle.js`) หรือ **GTM** (`gtm.js`)
3. เป็น module เดียวในหน้า Conversion Tracking ของ Plus AdTech ที่ Ad Validate และ Ad Optimizer เรียกใช้ผ่าน Internal API
4. ผลตรวจไม่ทำให้ข้อมูลของลูกค้าเพี้ยน

**ไม่ใช่เป้าหมาย (รอบนี้)**
- ไม่ทดสอบ form submit (เพราะจะสร้าง lead ปลอมให้ลูกค้า)
- ไม่อ่าน GTM container ผ่าน GTM API
- ไม่ยืนยันว่า hit **ถูกนับเป็น conversion** ในโหมด Pre-launch เพราะ Google Ads นับ conversion เฉพาะ hit ที่ผูกกับการคลิกหรือการดูโฆษณา การทดสอบที่ไม่มีคลิกโฆษณาจึงไม่ถูกนับอยู่แล้ว (ชั้นที่ 3 ย้ายไปยืนยันในโหมด Live ดู §9.6)
- ไม่คลิกโฆษณาของตัวเองเพื่อสร้าง conversion ทดสอบ (เสียเงินและเสี่ยงผิดนโยบาย invalid click)
- ไม่หยุดแคมเปญอัตโนมัติในโหมด Live
- ช่องทาง GA4 / Meta / TikTok ออกแบบ adapter รองรับไว้ แต่ **implement แค่ Google Ads ในชุดแรก**
- ไม่ครอบคลุมเรื่องผู้รับและช่องทางแจ้งเตือนของ Ad Optimizer (Ad Optimizer เป็นเจ้าของ)

## 3. การตัดสินใจจากการ grill (2026-09-25)

| # | คำถาม | ตัดสินใจ |
|---|---|---|
| D1 | ต้องรองรับกี่โหมด | **2 โหมด:** Pre-launch (งานเปิดใหม่ใน Ad Validate) และ Live (งานที่ออนไลน์แล้วใน Ad Optimizer) |
| D2 | หลักฐานที่ใช้ในโหมด Pre-launch | **Synthetic test:** คลิก Trigger Element → ดักจับ request → เทียบ `AW-ID/label` กับ conversion action ใน Google Ads |
| D3 | ชนิด conversion ที่ต้องรองรับ | **คลิกปุ่มบนเว็บลูกค้า** และ **widget ของ Plus AdTech** ส่วน form submit ตัดออก |
| D4 | แยก Plus AdTech กับ GTM ด้วยอะไร | ใช้ **initiator ของ network request** เป็นหลัก และใช้ script/DOM บนหน้าเป็นหลักฐานประกอบ |
| D5 | ช่องทางปลายทาง | ใช้ **Channel adapter** ช่องทางละตัว ชุดแรกทำ Google Ads และรองรับ GA4 / Meta / TikTok ในภายหลัง |
| D6 | โหมด Live ถ้าไม่ผ่าน | **แจ้งเตือนอย่างเดียว** โดยแจ้งใน Ad Optimizer |
| D7 | ตัวทดสอบอยู่ที่ไหน | **ฟังก์ชัน Inspector ในหน้า Conversion Tracking ของ Plus AdTech** โดยระบบอื่นเรียกผ่าน Internal API |
| D8 | กรณี GTM จะรู้ได้อย่างไรว่าต้องคลิกอะไร | บันทึกเป็น event Type **`External (GTM)`** ในหน้า Conversion Tracking เพื่อใช้ทดสอบอย่างเดียว Plus AdTech ไม่ยิง event นี้เอง |
| D9 | เกณฑ์ผ่านต้องยิงได้กี่ event | **event ทุกตัวที่ผูกกับ conversion action ของงานนี้** ต้องยิงได้ (Critical) ส่วน event อื่นเป็น Warning และประเมินเฉพาะช่องทางของงาน |
| D10 | GTM ที่ยิงได้ถูกต้องครบ | **ผ่านเมื่อใส่เหตุผล** ระบบระบุเครื่องมือเอง ผู้ใช้ใส่แค่เหตุผลที่ไม่ใช้ Plus AdTech |
| D11 | ปล่อยให้ request ถึงปลายทางจริงไหม | **แก้ไข (ดู D18):** Google Ads **ปล่อยผ่าน** แล้วตรวจ response · ช่องทางอื่น **abort** แล้วตรวจด้วยวิธีที่ไม่ปนข้อมูลของแต่ละช่องทาง · scanner ใช้ user-agent เฉพาะ |
| D12 | เข้าเว็บไม่ได้ / consent / selector เสีย | กดยอมรับ consent อัตโนมัติ ถ้า bot protection หรือเว็บล่มให้เป็น **"ตรวจไม่ได้"** ซึ่งต้องแนบหลักฐาน Tag Assistant และให้หัวหน้าทีม approve ถ้า selector ใช้ไม่ได้ให้เป็น **ไม่ผ่าน** พร้อม deep link ไปแก้ |
| D13 | Viewport | **desktop เป็นค่าเริ่มต้น** |
| D14 | element ที่มีแค่บนมือถือ | event ตั้ง viewport = `mobile` ได้ แล้วจะทดสอบ event นั้นบน mobile |
| D15 | URL ที่ทดสอบ | ค่าเริ่มต้นคือ **Website URL ที่ตั้งไว้ใน Plus AdTech** และแต่ละ event ตั้ง Test URL เองได้ (override) |
| D16 | Ad Validate ใช้ผลแบบไหน | **สั่งรันใหม่ทุกครั้ง** แล้วผูกหลักฐานไว้กับ run ของ Ad Validate และผลจะแสดงย้อนกลับในหน้า Conversion Tracking |
| D17 | P-025 / P-028 | ใช้ **Inspector run เดียวกัน** P-028 เปลี่ยนจาก GTM API มาใช้ Inspector จึงไม่ต้องใช้สิทธิ์ GTM API |
| D18 | จะรู้ได้อย่างไรว่า hit ถึงปลายทาง | แบ่งการยืนยันเป็น **3 ชั้น** (ส่งถูก → ถึงปลายทาง → นับเป็น conversion) โหมด Pre-launch ยืนยันได้ถึงชั้นที่ 2 โดย **Google Ads ปล่อย hit ผ่านแล้วตรวจ response** ส่วนช่องทางอื่นใช้กลยุทธ์ของแต่ละช่องทาง (§9.6) |
| D19 | จะรู้ได้อย่างไรว่านับเป็น conversion | ยืนยันใน **โหมด Live** ด้วยการตรวจ **"conversion แรกหลังออนไลน์"** และการ์ด P-027 ใช้คำว่า "Tag ยิงถูกต้อง รอยืนยัน conversion หลังออนไลน์" |
| D20 | จะเพิ่มความมั่นใจให้ถึง ≥ 90% อย่างไร | ตรวจทุกจุดที่ทำให้ conversion ไม่ถูกนับ: **ADS** (การตั้งค่า Google Ads) และ **CLK** (จำลองคลิกโฆษณาด้วย gclid ทดสอบ) เป็น Critical ส่วน **CNS** (consent) และ **HIS** (ประวัติบัญชี) เป็น Warning / หลักฐานเสริม (§9.7–9.10) *— PO ใช้ข้อที่แนะนำ รอยืนยัน* |
| D21 | จุดตรวจฝั่งเว็บไซต์ | ใส่ **WEB-01 ถึง WEB-17 ทั้งหมดใน MVP** (§9.9) |
| D22 | การ์ด P-027 | เพิ่ม **จุดที่ 3 "Conversion ถูกนับในแคมเปญนี้"** (ADS + CLK) รวมไว้ในการ์ดเดียว *— รอยืนยัน* |

---

# ส่วนที่ 1: PRD

## 4. ขอบเขตของ 2 โหมด

| หัวข้อ | โหมด Pre-launch | โหมด Live |
|---|---|---|
| สถานะงาน | งานเปิดใหม่ ยังไม่ออนไลน์ | งานออนไลน์แล้ว |
| ระบบที่ใช้ผล | **Ad Validate** การ์ด P-027 (และ P-025, P-028) | **Ad Optimizer** (health monitor) |
| คนสั่งรัน | ผู้ใช้กด "ตรวจสอบ" ในการ์ด P-027 หรือกด Inspector ในหน้า Conversion Tracking | Scheduler ของ Ad Optimizer วันละ 1 ครั้ง (และกด Inspector เองได้) |
| หลักฐานที่ใช้ | Inspector run (synthetic click) | Inspector run + `metrics.conversions` / `metrics.clicks` จาก Ads API |
| event ที่ประเมิน | event ที่ผูกกับ conversion action ของงาน (Critical) + event อื่น (Warning) | เหมือนกัน |
| ผลเมื่อไม่ผ่าน | **บล็อก gate** จากฝั่ง backend จนกว่าจะแก้ หรือมีหลักฐานที่ได้รับ approve | **แจ้งเตือนอย่างเดียว** ไม่หยุดแคมเปญ |
| Severity | ตามตารางผลลัพธ์ใน §9.4 | Critical: ไม่ยิง / ID ไม่ตรง · Warning: ยิงอยู่แต่ conversion = 0 ติดกัน **3 วัน** ขณะที่ click ≥ **30** (ค่าเริ่มต้น ปรับรายบัญชีได้) · Warning: ยิงซ้ำ |
| การแจ้งผล | ใช้ flow แจ้งเตือนของ Ad Validate (In-app + LINE XPluser, Email สำรอง) | เป็นของ Ad Optimizer (อยู่นอกขอบเขต spec นี้) |
| ความสดของผล | รันใหม่ทุกครั้งที่ตรวจ | รันใหม่ทุกรอบ scheduler |
| ในขอบเขตของ spec นี้ | Inspector module + Internal API + การ์ด P-027/025/028 | Inspector module + Internal API + สัญญา (contract) ของผลที่ส่งให้ Ad Optimizer |
| นอกขอบเขต | — | UI ของ Ad Optimizer, ผู้รับแจ้งเตือน, dedupe การแจ้งเตือน |

## 5. ผู้ใช้

| ผู้ใช้ | ต้องการอะไร |
|---|---|
| DMS Operator / MCC | ยืนยันก่อนเปิดงานว่า conversion ยิงจริง โดยไม่ต้องใช้ Tag Assistant เองทุกงาน |
| Tracking / Web implementer | รู้ว่า event ไหนเสีย เสียที่ URL ไหน และเสียเพราะอะไร เพื่อแก้ได้ตรงจุด |
| หัวหน้าทีม | approve exception ที่มีหลักฐานจริงรองรับ |
| Ad Optimizer (ระบบ) | ได้ผลตรวจที่ใช้เกณฑ์เดียวกับตอนเปิดงาน |

## 6. User stories

- **INS-01:** ในฐานะ Tracking implementer ฉันต้องการกดปุ่ม Inspector ในหน้า Conversion Tracking เพื่อดูว่า event แต่ละตัวยิงไปถูกปลายทางหรือไม่ ก่อนส่งงานให้ MCC
- **INS-02:** ในฐานะ Tracking implementer ฉันต้องการบันทึก event ที่ติดตั้งผ่าน GTM เป็น Type `External (GTM)` เพื่อให้ Inspector ทดสอบได้ แม้ Plus AdTech จะไม่ได้เป็นคนยิง
- **INS-03:** ในฐานะ Tracking implementer ฉันต้องการตั้ง Test URL และ viewport ราย event เพื่อทดสอบ element ที่มีเฉพาะบางหน้าหรือเฉพาะบนมือถือได้
- **INS-04:** ในฐานะ MCC ฉันต้องการให้การ์ด P-027 ใน Ad Validate รัน Inspector แล้วบอกเองว่างานนี้ติดตั้งด้วย Plus AdTech หรือ GTM เพื่อไม่ต้องเดาหรือเลือกเอง
- **INS-05:** ในฐานะ MCC เมื่อเว็บบล็อก scanner ฉันต้องการแนบหลักฐาน Tag Assistant ให้หัวหน้าทีม approve เพื่อให้งานไปต่อได้โดยไม่ข้ามการตรวจ
- **INS-06:** ในฐานะ Ad Optimizer ฉันต้องการเรียก Inspector ผ่าน API ทุกวัน เพื่อแจ้งเตือนเมื่อ tag ของงานที่ออนไลน์อยู่หยุดทำงาน

## 7. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-INS-01 | หน้า Conversion Tracking มีปุ่ม **Inspector** สั่งรันได้ทั้งแบบทุก event ที่เปิดอยู่ และแบบเลือกบาง event | P0 |
| FR-INS-02 | event มี field ใหม่ คือ `test_urls[]` (ไม่บังคับ ค่าเริ่มต้นคือ Website URL), `viewport` (`desktop` เป็นค่าเริ่มต้น / `mobile`) และ `install_source` (`plus_adtech` / `external_gtm`) | P0 |
| FR-INS-03 | เพิ่ม event Type **`External (GTM)`** มี Trigger Element, ช่องทาง และ `AW-ID/label` เหมือน event ปกติ แต่ **ต้องไม่ถูก publish ไปยิงผ่าน bundle.js** | P0 |
| FR-INS-04 | Inspector เปิด URL ด้วย headless browser, กดยอมรับ consent, คลิก Trigger Element, ดักจับ request ไปยัง endpoint ของช่องทาง แล้ว **abort** | P0 |
| FR-INS-05 | ทุก hit ที่ดักจับได้ต้องระบุ initiator root ได้ว่าเป็น `plus_adtech` / `gtm` / `other` / `unknown` | P0 |
| FR-INS-06 | Google Ads adapter ดึง `AW-ID` + `label` จาก hit แล้วเทียบกับ `conversion_action.tag_snippets` ของบัญชีเพื่อหา conversion action | P0 |
| FR-INS-07 | ผลต้องแยกตาม **event × URL × channel** และมีสถานะตาม §9.3 | P0 |
| FR-INS-08 | Internal API สั่งรัน / ดูสถานะ / ดูผล และส่ง callback เมื่อรันเสร็จ (§11) | P0 |
| FR-INS-09 | หลักฐานของแต่ละ run เก็บแบบ immutable: เวลา, URL, viewport, request ที่จับได้ (ตัดข้อมูลส่วนบุคคลออก), initiator stack, screenshot ของ element | P0 |
| FR-INS-10 | ผล run ที่สั่งจาก Ad Validate หรือ Ad Optimizer ต้องแสดงในประวัติของหน้า Conversion Tracking ด้วย | P1 |
| FR-INS-11 | Ad Validate การ์ด P-027 ใช้ผลลัพธ์ตาม §9.4 ส่วน P-025 / P-028 ประเมินจาก run เดียวกัน | P0 |
| FR-INS-12 | สถานะ "ตรวจไม่ได้" รับหลักฐาน Tag Assistant (ไฟล์/ภาพ) และให้ผู้มีสิทธิ์ approve พร้อมบันทึก audit | P0 |
| FR-INS-13 | Channel adapter สำหรับ GA4 / Meta / TikTok | P2 |
| FR-INS-14 | ตรวจการตั้งค่า Google Ads ADS-01 ถึง ADS-05 และ HIS-01 (§9.7, §9.10) | P0 |
| FR-INS-15 | จำลองเส้นทางคลิกโฆษณาด้วย gclid ทดสอบ CLK-01 ถึง CLK-05 และทดสอบ Final URL ของโฆษณาด้วย (§9.8) | P0 |
| FR-INS-16 | ตรวจฝั่งเว็บไซต์ WEB-01 ถึง WEB-17 รวม pass แบบ navigation จริง, SPA และ cross-domain (§9.9, §10.1) | P0 |
| FR-INS-17 | ตรวจ Consent Mode CNS-01 (§9.10) | P1 |

## 8. Non-functional requirements

- **ข้อมูลลูกค้าต้องไม่ปน:** ปล่อยผ่านได้เฉพาะ hit ที่ adapter กำหนดเป็น `passthrough` (ตอนนี้มีแค่ Google Ads) นอกนั้นต้องถูก abort 100% ถ้าเจอ request ไปยังโดเมน analytics อื่นที่ไม่รู้จัก ให้ abort ด้วย
- **Google Ads passthrough:** ต้องตัด `gclid`, `gbraid`, `wbraid` และ cookie `_gcl_*` ออกก่อนปล่อย (browser context ใหม่ไม่ควรมีอยู่แล้ว แต่ต้องตรวจซ้ำ) เพื่อให้แน่ใจว่า hit ไม่ผูกกับการคลิกโฆษณาใดและไม่ถูกนับเป็น conversion
- **User-agent:** `PlusAdTechInspector/1.0 (+https://plus-adtech.com/inspector)` เพื่อให้ลูกค้ากรองออกได้
- **เวลา:** 1 run (≤ 5 URL × ≤ 20 event รวมทุก pass ใน §10.1) เสร็จภายใน **5 นาที** ที่ p95 และ timeout รวมที่ 8 นาที (เพิ่มจากเดิมเพราะมี pass ของ CLK / SPA / navigation)
- **Concurrency:** จำกัดไม่เกิน 2 browser context ต่อ 1 domain พร้อมกัน เพื่อไม่ให้เว็บลูกค้ารับโหลดหนัก
- **Privacy:** ห้ามเก็บ cookie หรือ header ที่เป็น credential และตัด query ที่ดูเหมือน PII (email, phone) ออกจาก hit ก่อนบันทึก
- **Retention:** เก็บหลักฐาน 180 วัน (ตัวเลขต้องให้ฝ่ายกฎหมายยืนยัน)
- **Determinism:** input เดียวกันต้องได้สถานะเดียวกัน ถ้าผลไม่นิ่ง (flaky) ให้ retry ภายใน run 1 ครั้งก่อนสรุปว่าไม่ผ่าน

## 9. Business rules

### 9.1 เลือก event ที่จะประเมิน

1. โหลด event ที่ `enabled = true` ของ business นั้น
2. **event ที่ผูกกับงาน** (`bound`) คือ event ที่ `AW-ID/label` ตรงกับ conversion action ที่แคมเปญของงานใช้เป็น goal (Ad Validate ส่ง `conversion_action_ids` มากับ request)
3. event ที่ไม่ได้ผูกกับงาน คือ `unbound` ใช้เพื่อแสดงข้อมูลและออก Warning
4. ประเมินเฉพาะช่องทางที่ request ระบุ (`channels`) ช่องทางอื่นที่ event ติ๊กไว้จะแสดงเป็นข้อมูลอย่างเดียว

### 9.2 เกณฑ์ผ่านต่อ event

event ผ่านเมื่อ ในทุก Test URL ที่ element ของ event แสดงอยู่ใน viewport ที่ตั้งไว้:
- คลิกแล้วได้ hit ไปยัง endpoint ของช่องทางนั้น **อย่างน้อย 1 hit**
- `AW-ID` + `label` ตรงกับ conversion action ที่คาดไว้
- initiator ตรงกับ `install_source` ของ event (`plus_adtech` → bundle.js, `external_gtm` → gtm.js)
- ไม่มี hit ซ้ำไปยัง `AW-ID/label` เดียวกันจาก initiator อื่นในคลิกเดียวกัน (ถ้ามีจะเป็น duplicate และส่งต่อให้ P-028)

ถ้า element **ไม่มี**อยู่บน URL นั้นเลย จะไม่นับ URL นั้น แต่ต้องเจอ element ได้**อย่างน้อย 1 URL** ไม่อย่างนั้นจะเป็น `selector_not_found`

### 9.3 สถานะต่อ event × URL

| สถานะ | ความหมาย |
|---|---|
| `fired` | ยิงถูก ID และ initiator ตรง |
| `fired_wrong_id` | ยิงออก แต่ `AW-ID/label` ไม่ตรงกับ conversion action ใดที่คาดไว้ |
| `fired_wrong_source` | ยิงถูก ID แต่ initiator ไม่ตรงกับ `install_source` ที่ตั้งไว้ |
| `duplicate` | ID เดียวกันถูกยิงจากมากกว่า 1 initiator |
| `not_fired` | คลิก element ได้ แต่ไม่มี hit ออกภายใน 5 วินาที |
| `selector_not_found` | หา element ไม่เจอ หรือ element ไม่แสดงบน viewport ที่ตั้งไว้ |
| `blocked` | bot protection / captcha / HTTP 403 หรือ 429 |
| `site_error` | timeout, 5xx, DNS error, redirect loop |

### 9.4 ผลลัพธ์ของการ์ด P-027 (ระดับงาน)

คิดจาก event ที่ `bound` ตามลำดับความสำคัญจากบนลงล่าง (เจอแถวแรกที่ตรงให้ใช้แถวนั้น)

| ลำดับ | เงื่อนไข | ผล | ทางออก |
|---|---|---|---|
| 1 | ยังไม่มี run | **ยังไม่ตรวจ** | กด "ตรวจสอบ" |
| 2 | ไม่มี event ใด `bound` เลย | **บล็อก** | สร้างหรือผูก event ใน Conversion Tracking |
| 3 | มี `duplicate` | **บล็อก (P-028)** | ปิด tag ที่ซ้ำ แล้วตรวจซ้ำ |
| 4 | มี `not_fired` / `fired_wrong_id` | **บล็อก** ข้ามไม่ได้ | แก้การติดตั้ง แล้วตรวจซ้ำ |
| 5 | มี `selector_not_found` | **ไม่ผ่าน** | deep link ไปแก้ Trigger Element ของ event นั้น |
| 6 | มี `blocked` / `site_error` (และไม่มีข้อ 2–5) | **ตรวจไม่ได้** | ตรวจซ้ำ หรือแนบหลักฐาน Tag Assistant แล้วให้หัวหน้าทีม approve |
| 7 | ทุกตัว `fired` + initiator = Plus AdTech ทั้งหมด | **ผ่านอัตโนมัติ** | — |
| 8 | ทุกตัว `fired` + มีอย่างน้อย 1 ตัวที่ initiator = GTM | **ผ่านเมื่อใส่เหตุผล** | ผู้ใช้ใส่เหตุผลที่ไม่ใช้ Plus AdTech (ระบบระบุเครื่องมือให้เอง) |

- event ที่ `unbound` และไม่ `fired` เป็น **Warning** ไม่บล็อก
- `fired_wrong_source` ให้แสดงเป็น Warning และเสนอให้แก้ `install_source` ของ event ให้ตรงกับความจริง จากนั้นใช้ผลตาม initiator จริง
- ข้อห้ามเดิมของ PRD ยังใช้อยู่: **ไม่พบ conversion ยิงเลย ห้ามข้ามด้วย exception** exception ของสถานะ "ตรวจไม่ได้" ต้องมีหลักฐานว่ายิงจริง
- ตารางนี้ถูกขยายด้วยจุดตรวจ ADS / CLK / WEB ใน **§9.11** ให้ใช้ §9.11 เป็นลำดับสุดท้าย

### 9.5 P-025 และ P-028 ที่ใช้ run เดียวกัน

| Rule | เงื่อนไขใหม่ |
|---|---|
| P-025 Plus AdTech script | จากการโหลดหน้าใน run: เจอ `gateway.plus-adtech.com/bundle.js` ได้ 200 เพียง 1 ชุดต่อหน้า และไม่มี `gateway.autodigi.net` (ใช้กับทุก Test URL) |
| P-028 Plus AdTech vs GTM | มี event `bound` ที่สถานะเป็น `duplicate` = ไม่ผ่าน **ไม่ต้องใช้ GTM API แล้ว** เงื่อนไข visibleIf เดิม (`P-027 pass && trackingMethod = adtech`) **ตัดออก** เพราะ duplicate เกิดได้ทั้ง 2 กรณี |

### 9.6 การยืนยัน 3 ชั้น (ส่งถูก → ถึงปลายทาง → นับเป็น conversion)

| ชั้น | คำถาม | ยืนยันด้วย | โหมด |
|---|---|---|---|
| 1. ส่งถูก | tag สร้าง hit ไปถูก ID / event ไหม | Inspector ดักจับ hit แล้วเทียบ ID (§9.2) | Pre-launch + Live |
| 2. ถึงปลายทาง | ปลายทางรับ hit นั้นไหม | กลยุทธ์ของแต่ละช่องทาง (ตารางด้านล่าง) | Pre-launch + Live |
| 3. นับเป็น conversion | platform นับเป็น conversion ไหม | `metrics.conversions > 0` ของ conversion action ที่ผูกกับงาน หลังมี traffic จากโฆษณาจริง | **Live เท่านั้น** |

**ทำไมชั้นที่ 3 ยืนยันในโหมด Pre-launch ไม่ได้:** Google Ads, Meta และ TikTok นับ conversion เฉพาะ event ที่ผูกกับการคลิกหรือการดูโฆษณา hit ทดสอบที่ไม่มีการคลิกโฆษณาจึงไม่ถูกนับอยู่แล้ว

**กลยุทธ์ชั้นที่ 2 ของแต่ละช่องทาง**

| ช่องทาง | กลยุทธ์ (`delivery_mode`) | วิธีตรวจ | ผ่านเมื่อ | ปนข้อมูลลูกค้าไหม | ชุด |
|---|---|---|---|---|---|
| Google Ads | `passthrough` | ปล่อย hit ไปจริง (ตัด click ID ออก) แล้วอ่าน response | HTTP 200 / 204 หรือ 302 ไปยังโดเมนของ Google ตามปกติ | ไม่ปน เพราะไม่มีคลิกโฆษณา จึงไม่นับเป็น conversion | **1** |
| GA4 | `replay_validate` | abort hit จริง แล้ว (a) แปลง parameter เป็น Measurement Protocol payload ส่งไป `/debug/mp/collect` ซึ่งไม่บันทึกลงรายงาน (b) ใช้ GA4 Admin API ยืนยันว่า measurement ID เป็น data stream ของ property ที่ผูกกับ business | `validationMessages` ว่าง และ ID มีอยู่จริง | ไม่ปน | 2 |
| Meta | `replay_test` | abort hit จริง แล้ว replay event เดียวกันผ่าน Conversions API พร้อม `test_event_code` จากนั้นอ่าน response (`events_received`) | `events_received ≥ 1` และไม่มี error | **ต้องยืนยันก่อน** (Q10) | 2 |
| TikTok | `replay_test` | abort hit จริง แล้ว replay ผ่าน Events API พร้อม `test_event_code` | response `code = 0` | **ต้องยืนยันก่อน** (Q10) | 2 |

ข้อจำกัดที่ต้องบันทึกไว้:
- **GA4 validation server ไม่ได้ตรวจว่า measurement ID และ `api_secret` ถูกต้อง** จึงต้องใช้ Admin API ยืนยัน ID เพิ่มในขั้น (b)
- `replay_*` พิสูจน์ว่า**ข้อมูลใน hit** ใช้ได้ที่ปลายทาง แต่ไม่ได้พิสูจน์ว่า hit จาก browser ผ่าน network ได้จริง (เช่น โดน ad blocker ฝั่งผู้ใช้) ซึ่งยอมรับได้ในรอบนี้
- Meta และ TikTok ต้องใช้ access token ของ Conversions API / Events API ราย pixel ซึ่ง Plus AdTech ต้องมีอยู่แล้วถ้าส่ง server event (Q11)

**สถานะชั้นที่ 2 (ต่อ hit)**

| สถานะ | ความหมาย |
|---|---|
| `delivered` | ปลายทางรับแล้ว |
| `delivery_rejected` | ปลายทางตอบ error / validation ไม่ผ่าน / ID ไม่มีอยู่จริง |
| `delivery_unverified` | ช่องทางนั้นยังไม่มีกลยุทธ์ชั้นที่ 2 หรือไม่มี token ยืนยันได้แค่ชั้นที่ 1 |

**ผลต่อ §9.4:**
- hit ที่ `fired` แต่ `delivery_rejected` ให้นับเหมือน `fired_wrong_id` (**บล็อก**) เพราะปลายทางไม่รับ
- `delivery_unverified` **ไม่บล็อก** แต่แสดงในการ์ดว่า "ยืนยันได้แค่ว่า tag ส่งถูก"
- ถ้าผ่านทั้งชั้นที่ 1 และ 2 การ์ด P-027 ใช้คำว่า **"Tag ยิงถูกต้องและปลายทางรับแล้ว รอยืนยัน conversion หลังออนไลน์"** ห้ามใช้คำว่า "conversion ทำงานแล้ว"

**ชั้นที่ 3 ในโหมด Live: "conversion แรกหลังออนไลน์"**
- หลังงานออนไลน์ Ad Optimizer ตรวจทุกวันว่า conversion action ที่ผูกกับงานมี `metrics.conversions > 0` แล้วหรือยัง
- ถ้าครบ **7 วัน** หรือ click ≥ **30** (ถึงเกณฑ์ไหนก่อน) แล้วยังเป็น 0 ให้ออก **Warning "ยังไม่พบ conversion แรก"** พร้อมผล Inspector ล่าสุด
- ถ้า Inspector ล่าสุดไม่ผ่านด้วย ให้เป็น **Critical** ตามโหมด Live เดิม
- ค่า 7 วัน / 30 click เป็นค่าเริ่มต้นที่ปรับรายบัญชีได้ (ดู Q12)

### 9.7 ADS: การตั้งค่า Google Ads ที่ทำให้ conversion ไม่ถูกนับ

ตรวจผ่าน Google Ads API ไม่ต้องเปิดเว็บ ประเมินเฉพาะ conversion action ที่ `bound`

| ID | จุดที่ตรวจ | Field / วิธี | ไม่ผ่านเมื่อ | Severity |
|---|---|---|---|---|
| ADS-01 | Auto-tagging | `customer.auto_tagging_enabled` | `false` (ไม่มี gclid จึงผูก conversion กับคลิกไม่ได้) | Critical |
| ADS-02 | Conversion action เปิดใช้และเป็น Primary | `conversion_action.status`, `conversion_action.primary_for_goal` | ไม่ใช่ `ENABLED` หรือ `primary_for_goal = false` (ไม่นับในคอลัมน์ Conversions) | Critical |
| ADS-03 | Goal ถูกใช้ในแคมเปญของงาน | `customer_conversion_goal.biddable`, `campaign_conversion_goal.biddable` ตาม `category` + `origin` ของ action | goal ของ action เป็น `biddable = false` ในแคมเปญของงาน | Critical |
| ADS-04 | AW-ID เป็นของบัญชีที่ถูกต้อง | `customer.conversion_tracking_setting.conversion_tracking_id` / `google_ads_conversion_customer` เทียบกับ `AW-ID` ใน hit | ID ไม่ตรง (เช่น ใช้ tag ของอีกบัญชีภายใต้ MCC) | Critical |
| ADS-05 | ชนิดของ conversion action | `conversion_action.type` | ถ้าเป็นแบบ import จาก GA4 ต้องตรวจ hit ของ GA4 และการ link GA4 กับ Google Ads แทน ถ้า adapter GA4 ยังไม่พร้อมให้เป็น `delivery_unverified` | Critical / Unverified |

### 9.8 CLK: จำลองเส้นทางคลิกโฆษณาด้วย gclid ทดสอบ

Inspector เปิด **Final URL ของโฆษณาในงาน** (จาก Ads API ตัด URL ซ้ำออก ≤ 5 URL) และ Test URL ของ event พร้อม `?gclid=INSPECTOR_TEST_<run_id>` ค่านี้จับคู่กับคลิกจริงไม่ได้ จึงไม่ถูกนับเป็น conversion

| ID | จุดที่ตรวจ | วิธีตรวจ | ไม่ผ่านเมื่อ | Severity |
|---|---|---|---|---|
| CLK-01 | gclid ไม่หายหลัง redirect | ดู URL สุดท้ายหลัง redirect | ไม่มี `gclid` ใน URL สุดท้าย | Critical |
| CLK-02 | Cookie ถูกเก็บ (Conversion Linker) | อ่าน cookie `_gcl_aw` | ไม่มี cookie หรือค่าไม่ตรงกับ gclid ทดสอบ | Critical |
| CLK-03 | Hit แนบ gclid ไปด้วย | parameter `gclid` / `gclaw` ใน conversion hit | hit ไม่มี gclid ทดสอบ | Critical |
| CLK-04 | Cross-domain | ถ้า Test URL อยู่คนละโดเมนกับ Final URL ให้เดินจาก Final URL ไปยัง Test URL ผ่านลิงก์จริงบนหน้า | gclid ไม่ถูกส่งต่อไปยังโดเมนปลายทาง | Critical |
| CLK-05 | Final URL มี tag | Final URL ทุกตัวต้องผ่าน WEB-04 | Final URL ที่ไม่มี tag | Critical |

**ความปลอดภัยของข้อมูล:** Inspector อ่านและตรวจ gclid ใน hit ก่อน แล้วค่อย**ตัด click ID ออก**ก่อนปล่อย passthrough ตาม §8 hit ที่ถึง Google จึงไม่มี gclid ทดสอบ

### 9.9 WEB: จุดตรวจฝั่งเว็บไซต์ (ทั้งหมดอยู่ใน MVP)

| ID | กลุ่ม | จุดที่ตรวจ | วิธีตรวจ | ไม่ผ่านเมื่อ | Severity |
|---|---|---|---|---|---|
| WEB-01 | หน้าเว็บ | CSP บล็อก tag | header `Content-Security-Policy` + console event `securitypolicyviolation` | บล็อกโดเมน `googleadservices.com`, `google.com`, `googletagmanager.com` หรือ `plus-adtech.com` | Critical |
| WEB-02 | หน้าเว็บ | JS error จาก tag | console error ที่ stack มาจาก script ของ tag | มี error **และ** event ไม่ยิง = Critical · มี error แต่ยังยิงได้ = Warning | Critical / Warning |
| WEB-03 | หน้าเว็บ | tag พร้อมใช้ช้า | เวลาจากเริ่มโหลดหน้าจนถึง `window.gtag` / bundle พร้อม | > 5 วินาที | Warning |
| WEB-04 | หน้าเว็บ | Final URL ติด tag | โหลดทุก Final URL และเช็คว่ามี tag ของ `AW-ID` ที่คาดไว้ | Final URL ไม่มี tag หรือ redirect ไปโดเมนที่ไม่มี tag | Critical |
| WEB-05 | หน้าเว็บ | redirect chain | นับจำนวน redirect | > 3 ครั้ง = Warning · loop = `site_error` | Warning |
| WEB-06 | ติดตั้ง | config ซ้ำ / หลาย container | นับ `gtag('config', AW-…)` ต่อ ID และจำนวน `GTM-` container | config ID เดียวกัน > 1 ครั้ง หรือ container > 1 ตัว | Warning |
| WEB-07 | ติดตั้ง | tag อยู่ใน iframe | frame ที่เป็นต้นทางของ hit | hit มาจาก cross-origin iframe | Warning |
| WEB-08 | ติดตั้ง | SPA | ทดสอบ 2 รอบ: เปิดหน้าตรงๆ และเปลี่ยนหน้าแบบ client-side (คลิกลิงก์ภายในที่ไม่ reload) ก่อนคลิก event | รอบที่เปลี่ยนหน้าแบบ client-side ไม่ยิง | Critical |
| WEB-09 | Trigger | selector ตรงหลาย element | ทดสอบทุก element ที่ตรงและแสดงอยู่ (สูงสุด 3 ตัวต่อหน้า) | มีบางตัวไม่ยิง | Critical |
| WEB-10 | Trigger | element ถูกบัง | `document.elementFromPoint` ที่จุดกึ่งกลางของ element | element อื่นบังอยู่ (popup, chat, banner) | Warning |
| WEB-11 | Trigger | หน้าเปลี่ยนก่อน hit ส่งเสร็จ | ทดสอบอีกรอบโดย**ปล่อยให้ navigate จริง** (ลิงก์ในแท็บเดิม) แล้วดูว่า hit ส่งสำเร็จก่อน unload หรือใช้ `sendBeacon` / `keepalive` | hit ถูกยกเลิก (`net::ERR_ABORTED`) หรือไม่ถูกส่ง | Critical |
| WEB-12 | Hit | ยิงเองตอนโหลดหน้า | ดักจับ hit ของ conversion action ช่วงโหลดหน้าจนถึงก่อนคลิกครั้งแรก | มี hit ของ event แบบ click ก่อนมีการคลิก | Critical |
| WEB-13 | Hit | 1 คลิกยิงหลายครั้ง (source เดียวกัน) | นับ hit ต่อ `AW-ID/label` ต่อ 1 คลิก | > 1 | Critical |
| WEB-14 | Hit | value / currency | ถ้าแคมเปญใช้ value-based bidding (`campaign.bidding_strategy_type` เป็น `MAXIMIZE_CONVERSION_VALUE` / `TARGET_ROAS`) ต้องมี `value` > 0 และ `currency` ตรงกับ `customer.currency_code` | ไม่มี value หรือสกุลเงินไม่ตรง | Critical (เฉพาะ value-based) |
| WEB-15 | Cookie | domain ของ `_gcl_aw` | domain ของ cookie ต้องครอบคลุม host ของ Test URL ทุกตัว | cookie อยู่ที่ subdomain ที่ไม่ครอบคลุมหน้าที่ conversion เกิด | Critical |
| WEB-16 | Cookie | cookie ถูกลบ | อ่าน `_gcl_aw` ตอนโหลดหน้าเสร็จ และอีกครั้งก่อนคลิก | cookie หายไประหว่างนั้น (มักเกิดจาก script ของ CMP) | Critical |
| WEB-17 | เข้าถึง | Bot protection | HTTP 403 / 429 / หน้า challenge | ถูกบล็อก = สถานะ **ตรวจไม่ได้** และแนะนำให้ลูกค้า allowlist user-agent / IP ของ Inspector | ตรวจไม่ได้ |

### 9.10 CNS / HIS: consent และประวัติบัญชี

| ID | จุดที่ตรวจ | วิธีตรวจ | ผล | Severity |
|---|---|---|---|---|
| CNS-01 | Consent Mode | อ่าน `gcs` / `gcd` ใน hit ก่อนและหลังกดยอมรับ banner | หลังกดยอมรับแล้วยังไม่เป็นสถานะ granted (`gcs=G111`) = Warning "conversion จะถูกนับแบบ modeled เท่านั้น" | Warning |
| HIS-01 | ประวัติ conversion | `metrics.all_conversions` ของ conversion action ที่ `bound` ใน 30 วันล่าสุด (ทุกแคมเปญในบัญชี) | > 0 = หลักฐานเสริมว่าเส้นทางเคยทำงานจริง แสดงเป็น ✓ ข้อมูลในการ์ด | ข้อมูล (ไม่บล็อก) |

### 9.11 ผลลัพธ์ของการ์ด P-027 (ฉบับขยาย แทนที่ §9.4)

การ์ดมี **3 จุด:**
1. **Tag ยิงบนเว็บไซต์:** §9.2–9.6 + WEB-01 ถึง WEB-16
2. **เครื่องมือที่ติดตั้ง:** initiator (Plus AdTech / GTM + เหตุผล)
3. **Conversion ถูกนับในแคมเปญนี้:** ADS-01 ถึง ADS-05 + CLK-01 ถึง CLK-05

ลำดับการตัดสิน (เจอแถวแรกที่ตรงให้ใช้แถวนั้น):

| ลำดับ | เงื่อนไข | ผล |
|---|---|---|
| 1 | ยังไม่มี run | ยังไม่ตรวจ |
| 2 | ไม่มี event ใด `bound` | **บล็อก** |
| 3 | ADS-xx ที่เป็น Critical ไม่ผ่าน | **บล็อก** (แก้ใน Google Ads แล้วตรวจซ้ำ บางข้ออาจแก้ด้วย auto-fix ได้ในอนาคต) |
| 4 | `duplicate` (P-028) หรือ WEB-13 | **บล็อก** |
| 5 | `not_fired` / `fired_wrong_id` / `delivery_rejected` / WEB-01 / WEB-04 / WEB-08 / WEB-09 / WEB-11 / WEB-12 / WEB-14 | **บล็อก** ข้ามไม่ได้ |
| 6 | CLK-xx / WEB-15 / WEB-16 ไม่ผ่าน | **บล็อก** ข้ามไม่ได้ |
| 7 | `selector_not_found` | **ไม่ผ่าน** แก้ selector |
| 8 | `blocked` / `site_error` / WEB-17 (และไม่มีข้อ 2–7) | **ตรวจไม่ได้** แนบหลักฐาน + approve |
| 9 | ผ่านทั้งหมด + initiator = Plus AdTech | **ผ่านอัตโนมัติ** |
| 10 | ผ่านทั้งหมด + มี initiator = GTM | **ผ่านเมื่อใส่เหตุผล** |

- Warning (WEB-02 แบบยังยิงได้, WEB-03, WEB-05, WEB-06, WEB-07, WEB-10, CNS-01, `fired_wrong_source`, event `unbound` ที่ไม่ยิง) **แสดงในการ์ดแต่ไม่บล็อก**
- HIS-01 แสดงเป็นหลักฐานเสริมเท่านั้น
- ความมั่นใจเป้าหมาย ≥ 90% วัดจาก success metric §18 ("งานที่ผ่าน P-027 เห็น conversion แรกภายใน 7 วัน") ตัวเลขนี้ยังเป็นค่าประเมิน ต้องวัดจริงใน UAT

---

# ส่วนที่ 2: Technical spec

## 10. Architecture

```
┌────────────── Plus AdTech ──────────────┐
│ Conversion Tracking UI ── Inspector btn │
│            │                            │
│    Inspector Service (API)              │
│      ├ Run orchestrator (queue)         │
│      ├ Browser worker (Playwright/CDP)  │
│      ├ Channel adapters (GAds, …)       │
│      ├ Evaluator (§9)                   │
│      └ Evidence store                   │
└───────▲──────────────────────▲──────────┘
        │ Internal API         │ Internal API
   Ad Validate            Ad Optimizer
 (P-025/027/028)        (daily scheduler)
```

### 10.1 ขั้นตอนของ run

0. **ADS checks:** ดึงข้อมูลจาก Google Ads API ครั้งเดียว ได้แก่ `customer.auto_tagging_enabled`, `conversion_tracking_setting`, `currency_code`, conversion action (`status`, `primary_for_goal`, `type`, `category`, `origin`, `tag_snippets`), `customer_conversion_goal`, `campaign_conversion_goal`, `campaign.bidding_strategy_type`, Final URL ของโฆษณา และ `metrics.all_conversions` 30 วัน แล้วประเมิน ADS-01 ถึง ADS-05 และ HIS-01 (ทำคู่ขนานกับขั้นตอนที่ 1–8)
1. **Resolve:** โหลด event config + Website URL แล้วสร้าง test matrix = event × (Test URL ∪ Final URL) × viewport
2. **Prepare browser:** เปิด context ใหม่ต่อ URL × viewport พร้อม user-agent ของ Inspector เปิด request interception, เก็บ console (error + `securitypolicyviolation`) และอ่าน response header ของหน้า (WEB-01)
3. **Load page (pass A: landing):** เปิด URL พร้อม `?gclid=INSPECTOR_TEST_<run_id>` รอ `networkidle` (สูงสุด 15 วินาที) แล้วบันทึก: script ที่โหลด (P-025, WEB-06), redirect chain + URL สุดท้าย (WEB-05, CLK-01), เวลาที่ tag พร้อม (WEB-03), **hit ที่เกิดก่อนคลิก** (WEB-12) และ `_gcl_aw` (CLK-02)
4. **Consent:** ตรวจหา CMP ที่รู้จัก (Cookiebot, OneTrust, CookieYes, PDPA banner ไทยที่พบบ่อย) แล้วกดยอมรับ บันทึก `consent_state` และ `gcs` / `gcd` ก่อนและหลัง (CNS-01) จากนั้นอ่าน `_gcl_aw` อีกครั้ง (WEB-16)
5. **Per event (pass B: click แบบกันไม่ให้ออกจากหน้า):** หาทุก element ที่ตรง selector และแสดงอยู่ (≤ 3, WEB-09) → เช็คว่าไม่ถูกบัง (WEB-10) → scroll ให้เห็น → คลิกโดยบล็อกการ navigate ออกจากหน้า (`tel:`, `line://`, `target=_blank`, link ข้ามโดเมน) → รอ hit 5 วินาที → นับ hit ต่อคลิก (WEB-13), เช็ค gclid ใน hit (CLK-03), value / currency (WEB-14), frame ต้นทาง (WEB-07)
5a. **Pass C (navigation จริง):** สำหรับ event ที่ element เป็นลิงก์ในแท็บเดิม ให้คลิกอีกครั้งโดยปล่อย navigate จริง แล้วตรวจว่า hit ส่งสำเร็จก่อน unload (WEB-11)
5b. **Pass D (SPA):** ถ้าตรวจพบว่าเป็น SPA (มี `history.pushState` เมื่อคลิกลิงก์ภายใน) ให้เปิดหน้าแรก → คลิกลิงก์ภายในไปยัง Test URL → คลิก event อีกครั้ง (WEB-08)
5c. **Pass E (cross-domain):** ถ้า Test URL อยู่คนละโดเมนกับ Final URL ให้เดินจาก Final URL ไปผ่านลิงก์จริง แล้วตรวจ gclid ที่ปลายทาง (CLK-04) และ domain ของ cookie (WEB-15)
6. **Capture + ส่งต่อตาม `delivery_mode`:** ทุก request ที่ match endpoint ของ adapter ให้บันทึก URL, body, initiator stack แล้ว
   - `passthrough` (Google Ads): บันทึกและตรวจ gclid ทดสอบก่อน (CLK-03) → ตัด click ID ออก → `route.continue()` → บันทึก HTTP status และ redirect chain
   - `replay_validate` / `replay_test`: `route.abort()` → ส่ง payload ไปยัง endpoint ทดสอบของช่องทางนั้นจากฝั่ง server (§9.6)
   - request ไป analytics ที่ไม่รู้จัก: `route.abort()`
7. **Attribute:** เดิน async stack trace ของ initiator ไปจนถึง **script ต้นทาง (root)** แล้วจัดกลุ่มเป็น `plus_adtech` / `gtm` / `other`
8. **Evaluate:** ใช้กฎใน §9 แล้วบันทึก evidence และส่ง callback

### 10.2 วิธีหา initiator (ตัดสินว่าใครเป็นคนยิง)

- ใช้ CDP `Network.requestWillBeSent.initiator` (`type`, `stack` + `parent` แบบ async) ไล่ขึ้นไปจนถึง frame ที่อยู่บนสุด
- ใช้ `url` ของ root frame ตัดสิน:
  - `gateway.plus-adtech.com/*` → `plus_adtech`
  - `googletagmanager.com/gtm.js` หรือ script ที่ถูก inject โดย gtm.js → `gtm`
  - อื่นๆ → `other`
- **ข้อควรระวัง:** ถ้า bundle.js โหลด `gtag/js?id=AW-…` เอง frame สุดท้ายจะเป็น `gtag/js` ต้องไล่ต่อไปจนถึง**คนที่ inject gtag** ห้ามหยุดที่ gtag
- **ข้อควรระวัง:** hit แบบ `sendBeacon` / `<img>` pixel อาจมี stack ไม่ครบ ให้ fallback ไปใช้ลำดับเหตุการณ์: listener ของ element ที่คลิกผูกมาจาก script ไหน (`DOMDebugger.getEventListeners`) ถ้ายังระบุไม่ได้ ให้เป็น `unknown` แล้วใช้สถานะ `fired_wrong_source` (ไม่ผ่านอัตโนมัติ)
- **ต้องมี test fixture:** (a) PADT ยิงตรง (b) PADT โหลด gtag (c) GTM + Google Ads tag (d) GTM + gtag event (e) PADT + GTM ยิงซ้ำ (f) sendBeacon
- **Fixture เพิ่มสำหรับ §9.7–9.10:** (g) CSP บล็อก googleadservices (h) redirect ที่ทำ gclid หาย (i) ไม่มี Conversion Linker (j) CMP ที่ลบ `_gcl_aw` (k) SPA ที่ listener หลุดหลังเปลี่ยนหน้า (l) ปุ่ม LINE ในแท็บเดิมที่ hit ถูกยกเลิก (m) tag ยิงตอนโหลดหน้า (n) 1 คลิกยิง 2 ครั้ง (o) selector ตรง 2 ปุ่มแต่ยิงแค่ปุ่มเดียว (p) cookie ตั้งไว้ที่ subdomain ผิด (q) value-based campaign ที่ hit ไม่มี value · และบัญชี Google Ads ทดสอบสำหรับ ADS-01 ถึง ADS-05

### 10.3 Channel adapter interface

```ts
interface ChannelAdapter {
  channel: 'google_ads' | 'ga4' | 'meta' | 'tiktok';
  matches(req: CapturedRequest): boolean;          // เช็คว่า URL ตรงกับ endpoint ของช่องทางนี้
  extract(req: CapturedRequest): HitIdentity;       // ดึง ID ออกจาก hit
  resolveExpected(event: EventConfig, ctx: AccountCtx): Promise<ExpectedIdentity[]>;
  compare(hit: HitIdentity, expected: ExpectedIdentity[]): 'match' | 'mismatch';
  deliveryMode: 'passthrough' | 'replay_validate' | 'replay_test' | 'none';
  sanitize?(req: CapturedRequest): CapturedRequest;               // passthrough: ตัด click ID ออกก่อนปล่อย
  verifyDelivery(hit: CapturedHit, ctx: AccountCtx): Promise<     // ชั้นที่ 2
    'delivered' | 'delivery_rejected' | 'delivery_unverified'>;
}
```

| Adapter | `matches` | `extract` | `resolveExpected` | `deliveryMode` | ชุด |
|---|---|---|---|---|---|
| Google Ads | `googleadservices.com/pagead/conversion/*`, `google.com/pagead/1p-conversion/*`, `google.com/ccm/collect` | `AW-ID` จาก path, `label` จาก query | `conversion_action.tag_snippets[].event_snippet` → `send_to` | `passthrough` | **1** |
| GA4 | `*.google-analytics.com/g/collect`, `*/g/collect` (server-side) | `tid`, `en` | GA4 Admin API key events | `replay_validate` | 2 |
| Meta | `facebook.com/tr` | `id`, `ev` | Pixel ID + event name ใน event config | `replay_test` | 2 |
| TikTok | `analytics.tiktok.com/api/v2/pixel*` | pixel code, `event` | Pixel code + event ใน event config | `replay_test` | 2 |

ถ้า adapter ยังไม่มี token หรือยังไม่ implement ชั้นที่ 2 ให้ `verifyDelivery` คืน `delivery_unverified` เสมอ ห้ามคืน `delivered`

## 11. Internal API

**Base:** `https://api.plus-adtech.internal/inspector/v1`
**Auth:** service-to-service token (`Authorization: Bearer <service token>`) โดยแต่ละ consumer มี scope ของตัวเอง: `inspector:run`, `inspector:read`
**Idempotency:** `Idempotency-Key` header ใช้ key เดิมภายใน 10 นาทีจะได้ run เดิมคืน

### 11.1 สั่งรัน

`POST /runs`

```json
{
  "business_id": "biz_123",
  "requested_by": { "system": "ad_validate", "user_id": "emp_456", "ref_id": "av_run_789" },
  "mode": "pre_launch",
  "channels": ["google_ads"],
  "google_ads": { "customer_id": "1234567890", "login_customer_id": "9876543210" },
  "conversion_action_ids": ["customers/1234567890/conversionActions/111"],
  "event_ids": null,
  "url_override": null,
  "callback_url": "https://ad-validate.internal/hooks/inspector"
}
```

| Field | ความหมาย |
|---|---|
| `mode` | `pre_launch` \| `live` \| `manual` (กดจากหน้า Conversion Tracking) ใช้บันทึกและกำหนด priority ของคิว |
| `conversion_action_ids` | ใช้แยก event เป็น `bound` / `unbound` ถ้าเป็น `null` ทุก event จะเป็น `bound` |
| `event_ids` | `null` = ทุก event ที่เปิดอยู่ |
| `url_override` | ใช้ URL นี้แทน Test URL ทั้งหมด (สำหรับ debug เท่านั้น) |

**Response `202`**
```json
{ "run_id": "ins_01J…", "status": "queued", "estimated_seconds": 120 }
```

### 11.2 ดูสถานะและผล

`GET /runs/{run_id}`

```json
{
  "run_id": "ins_01J…",
  "status": "completed",
  "mode": "pre_launch",
  "started_at": "2026-09-25T09:00:02Z",
  "finished_at": "2026-09-25T09:01:48Z",
  "inspector_version": "1.0.0",
  "consent_state": "granted_auto",
  "summary": {
    "verdict": "pass_with_reason",
    "install_sources": ["gtm"],
    "bound": { "total": 2, "fired": 2, "delivered": 2, "delivery_unverified": 0 },
    "verification_level": "delivered",
    "unbound": { "total": 19, "fired": 17 }
  },
  "rules": {
    "P-025": { "status": "pass", "pages": [ { "url": "https://…", "bundle_count": 1, "autodigi": false, "http": 200 } ] },
    "P-027": { "status": "pass_with_reason", "detected_source": "gtm" },
    "P-028": { "status": "pass" }
  },
  "checks": [
    { "id": "ADS-01", "status": "pass", "severity": "critical", "observed": { "auto_tagging_enabled": true } },
    { "id": "ADS-03", "status": "fail", "severity": "critical", "observed": { "campaign": "customers/…/campaigns/555", "category": "CONTACT", "origin": "WEBSITE", "biddable": false } },
    { "id": "CLK-01", "status": "pass", "severity": "critical", "url": "https://example.co.th/promo", "observed": { "final_url": "https://www.example.co.th/promo?gclid=INSPECTOR_TEST_…" } },
    { "id": "WEB-11", "status": "fail", "severity": "critical", "event_id": "evt_line", "url": "https://example.co.th/", "observed": { "hit_status": "net::ERR_ABORTED", "transport": "xhr" } },
    { "id": "CNS-01", "status": "warning", "severity": "warning", "observed": { "gcs_before": "G100", "gcs_after": "G111" } },
    { "id": "HIS-01", "status": "info", "severity": "info", "observed": { "all_conversions_30d": 42 } }
  ],
  "events": [
    {
      "event_id": "evt_call",
      "name": "Call_AdTech",
      "install_source": "plus_adtech",
      "bound": true,
      "viewport": "mobile",
      "results": [
        {
          "url": "https://example.co.th/",
          "channel": "google_ads",
          "status": "fired",
          "hit": { "aw_id": "AW-123456789", "label": "AbC-dEfG", "conversion_action": "customers/…/conversionActions/111" },
          "initiator": { "source": "plus_adtech", "root_url": "https://gateway.plus-adtech.com/bundle.js" },
          "delivery": { "mode": "passthrough", "status": "delivered", "http_status": 200, "detail": null },
          "duplicates": [],
          "evidence": { "screenshot_url": "…", "har_ref": "…" }
        }
      ]
    }
  ]
}
```

`status` ของ run: `queued` → `running` → `completed` | `completed_with_errors` | `failed` | `cancelled`

`summary.verdict`: `pass` | `pass_with_reason` | `fail` | `selector_fail` | `inconclusive` | `blocked_duplicate` | `no_bound_event`

`checks[].status`: `pass` | `fail` | `warning` | `info` | `not_applicable` | `inconclusive` · `checks[].id` ใช้รหัสจาก §9.7–9.10 ผู้เรียก (Ad Validate / Ad Optimizer) ต้องใช้ลำดับใน §9.11 ตัดสินผลของการ์ด และห้ามตีความ `checks` เอง

`summary.verification_level` (ชั้นสูงสุดที่ยืนยันได้ครบทุก event `bound`): `fired` (ชั้นที่ 1) | `delivered` (ชั้นที่ 2) · ชั้นที่ 3 ไม่อยู่ใน Inspector เพราะเป็นหน้าที่ของ Ad Optimizer

### 11.3 Callback (webhook)

Inspector ส่ง `POST {callback_url}` เมื่อ run จบ

```json
{ "event": "inspector.run.finished", "run_id": "ins_01J…", "status": "completed", "verdict": "pass_with_reason", "ref_id": "av_run_789" }
```

- เซ็นชื่อด้วย header `X-Inspector-Signature: sha256=<HMAC>`
- retry แบบ exponential backoff 5 ครั้ง (1, 2, 4, 8, 16 นาที) ถ้ายังไม่สำเร็จ consumer ต้อง poll ด้วย `GET /runs/{id}`

### 11.4 Endpoints อื่น

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/businesses/{id}/events?install_source=` | ดู event config (สำหรับแสดงในการ์ด P-027 ก่อนรัน) |
| `GET` | `/businesses/{id}/runs?limit=&mode=` | ประวัติ run (ใช้แสดงในหน้า Conversion Tracking) |
| `POST` | `/runs/{id}/cancel` | ยกเลิก run ที่ยัง `queued` / `running` |
| `GET` | `/runs/{id}/evidence/{evidence_id}` | ดึง screenshot / HAR แบบ signed URL อายุ 15 นาที |

### 11.5 Error codes

| HTTP | code | ความหมาย |
|---|---|---|
| 400 | `invalid_request` | field ไม่ครบหรือรูปแบบผิด |
| 403 | `scope_denied` | token ไม่มีสิทธิ์ |
| 404 | `business_not_found` | ไม่พบ business |
| 409 | `run_in_progress` | business นี้มี run ของ mode เดียวกันที่ยังทำงานอยู่ (response จะมี `run_id` เดิม) |
| 422 | `no_website_url` | ยังไม่ได้ตั้ง Website URL และ event ก็ไม่มี Test URL |
| 422 | `google_ads_auth` | credential ของ Google Ads ใช้ไม่ได้หรือ scope ไม่ครบ |
| 429 | `rate_limited` | เกินโควตา (ค่าเริ่มต้น 30 run / ชั่วโมง / consumer) |

## 12. Data model (ส่วนที่เพิ่ม)

```
conversion_event (เดิม) + 
  install_source   enum('plus_adtech','external_gtm')  default 'plus_adtech'
  test_urls        text[]   null → ใช้ business.website_url
  viewport         enum('desktop','mobile')  default 'desktop'

inspector_run
  id, business_id, mode, requested_by_system, requested_by_user, ref_id,
  status, verdict, consent_state, inspector_version,
  started_at, finished_at, request_json, summary_json

inspector_result
  run_id, event_id, url, viewport, channel, status,
  hit_json, initiator_source, initiator_root_url, duplicates_json, evidence_ref

inspector_exception          -- ใช้กับสถานะ "ตรวจไม่ได้"
  id, run_id, ref_system, ref_id, evidence_file_ref, reason,
  submitted_by, approved_by, approved_at, status   (append-only)
```

## 13. การเชื่อมกับ Ad Validate

- ตอนกดตรวจการ์ด P-027 หรือตอนเริ่ม run ของ Ad Validate ให้เรียก `POST /runs` โดยใช้ `mode=pre_launch` และ `ref_id` = ID ของ run ใน Ad Validate
- run ของ Ad Validate เก็บ `inspector_run_id` ไว้ ผลของ P-025 / P-027 / P-028 จึงอ้างถึง Inspector run เดียวกันเสมอ
- เมื่อได้ `pass_with_reason` ให้เขียน `job.tracking_method` เป็นค่าจาก `detected_source` (ผู้ใช้แก้ไม่ได้) และเขียน `job.exception_reason` จากที่ผู้ใช้กรอก
- Gate ฝั่ง backend: บล็อกเมื่อ verdict เป็น `fail` / `blocked_duplicate` / `no_bound_event` / `selector_fail` หรือเป็น `inconclusive` ที่ยังไม่มี `inspector_exception.status = approved`

## 14. การเชื่อมกับ Ad Optimizer (สัญญาเท่านั้น)

- Ad Optimizer เรียก `POST /runs` ด้วย `mode=live` วันละครั้งต่อ business ที่มีงานออนไลน์ โดยส่ง `conversion_action_ids` ของแคมเปญที่ active อยู่
- Ad Optimizer รวมผล Inspector กับ `metrics.conversions` / `metrics.clicks` เอง เพื่อออก Warning "ยิงอยู่แต่ conversion = 0"
- Ad Optimizer เป็นเจ้าของการยืนยัน **ชั้นที่ 3 "conversion แรกหลังออนไลน์"** ตาม §9.6 และควรส่งผลกลับให้ Ad Validate แสดงในประวัติของงาน (สัญญาของ API ส่วนนี้ยังต้องตกลงกัน ดู Q12)
- ผู้รับแจ้งเตือน, ช่องทาง, dedupe และ UI เป็นของ Ad Optimizer

---

# ส่วนที่ 3: UI spec

ใช้ Plus AdTech design system (primary `#7F70EF`, Sarabun) และ component เดิมของหน้า Conversion Tracking

## 15. หน้า Conversion Tracking

### 15.1 Toolbar

เพิ่มปุ่ม **`Inspector`** (outline, ไอคอน `troubleshoot`) ระหว่าง `Sync` กับ `Create Event`

- คลิกแล้วเปิด **Inspector modal** (§15.4)
- ถ้าไม่มี Website URL และไม่มี Test URL เลย ปุ่มจะ disabled และมี tooltip "ตั้ง Website URL ใน Settings ก่อน"
- ระหว่างรัน ปุ่มเปลี่ยนเป็น `กำลังตรวจ… (n/m)` แต่ผู้ใช้ยังใช้หน้าได้ตามปกติ

### 15.2 ตาราง event

| การเปลี่ยนแปลง | รายละเอียด |
|---|---|
| คอลัมน์ใหม่ **Inspector** (ต่อจาก Triggers) | chip แสดงผลล่าสุด: `ยิงสำเร็จ` (เขียว) / `ไม่ยิง` (แดง) / `Selector เสีย` (แดง outline) / `ยิงซ้ำ` (แดง) / `ตรวจไม่ได้` (amber) / `ยังไม่ตรวจ` (เทา) + เวลาที่ตรวจ ("2 ชม.ที่แล้ว") คลิกแล้วเปิด Result drawer |
| ป้ายใต้ชื่อ event | ถ้า `install_source = external_gtm` แสดง badge `GTM` สีเทาข้างไอคอนช่องทาง |
| Filter "All Type" | เพิ่มตัวเลือก `External (GTM)` |
| เมนู `…` ของแต่ละแถว | เพิ่ม `ตรวจ event นี้` (รัน Inspector เฉพาะ event นี้) |

### 15.3 ฟอร์ม Create / Edit Event

เพิ่ม section **"การทดสอบ (Inspector)"** ต่อจาก Trigger

| Field | Control | Default / Validation |
|---|---|---|
| ติดตั้งด้วย | Segmented: `Plus AdTech` / `GTM (External)` | `Plus AdTech` ถ้าเลือก GTM จะมี helper text: "event นี้ใช้ทดสอบอย่างเดียว Plus AdTech จะไม่ยิง event นี้" และ Type จะล็อกเป็น `External (GTM)` |
| Test URL | Input หลายบรรทัด (chips) | ว่างได้ ถ้าว่างจะแสดง placeholder เป็น Website URL จริง ต้องเป็น `https://` โดเมนเดียวกับ Website URL (ถ้าต่างโดเมนจะเตือน แต่ไม่บล็อก) สูงสุด 5 URL |
| ทดสอบบน | Radio: `Desktop` / `Mobile` | `Desktop` · helper: "เลือก Mobile ถ้าปุ่มนี้แสดงเฉพาะบนมือถือ เช่น ปุ่มโทร" |
| Trigger Element | (field เดิม) | เพิ่มปุ่ม `ทดสอบ selector` ซึ่งเปิดหน้าแรกของ Test URL แล้วแสดงว่าเจอ element กี่ตัว พร้อม thumbnail |

### 15.4 Inspector modal (ก่อนรัน)

- หัวข้อ: **ตรวจการยิง Tag**
- รายการ event ให้ติ๊กเลือก (ค่าเริ่มต้น: ทุก event ที่เปิดอยู่) แสดงจำนวน URL × viewport ของแต่ละ event
- ช่องทาง: ตอนนี้มีแค่ `Google Ads` (ติ๊กไว้และแก้ไม่ได้) ช่องทางอื่นแสดงเป็น disabled พร้อมป้าย "เร็วๆ นี้"
- ข้อความแจ้ง: "ระบบจะเปิดเว็บไซต์และคลิกปุ่มจริง Google Ads จะได้รับ hit ทดสอบ แต่**ไม่นับเป็น conversion** เพราะไม่ได้มาจากการคลิกโฆษณา ส่วนช่องทางอื่นจะตรวจแบบไม่ส่งข้อมูลจริง ข้อมูลของลูกค้าจะไม่เพี้ยน ใช้เวลาประมาณ X นาที ปิดหน้านี้ได้"
- ปุ่ม: `เริ่มตรวจ` / `ยกเลิก`

### 15.5 Result drawer (ด้านขวา)

1. **Header:** ชื่อ event, badge ติดตั้งด้วย, สถานะรวม, เวลา, ผู้สั่งรัน (`คุณ A` / `Ad Validate` / `Ad Optimizer`)
2. **ตารางผล:** แถว = URL × viewport, คอลัมน์ = ช่องทาง และในแต่ละช่องแสดง chip สถานะ
3. **รายละเอียดเมื่อกดแถว:**
   - Screenshot ที่ครอบ element ที่คลิก
   - Hit ที่จับได้: `AW-123456789 / AbC-dEfG` → ชื่อ conversion action
   - ยิงจาก: `Plus AdTech (bundle.js)` หรือ `GTM (GTM-XXXX)`
   - ถ้ายิงซ้ำ: แสดงทุก hit พร้อมต้นทาง
4. **คำแนะนำตามสถานะ:**

| สถานะ | ข้อความ | Action |
|---|---|---|
| `not_fired` | "คลิกปุ่มแล้วไม่มีการส่งข้อมูลไป Google Ads ภายใน 5 วินาที" | `แก้ event` · `ตรวจซ้ำ` |
| `fired_wrong_id` | "ยิงไปที่ AW-… / … ซึ่งไม่ตรงกับ conversion action ของงานนี้" | `แก้ event` |
| `fired_wrong_source` | "ยิงจาก GTM แต่ event ตั้งไว้เป็น Plus AdTech" | `เปลี่ยนเป็น GTM (External)` |
| `duplicate` | "Plus AdTech และ GTM ยิงไปที่ conversion เดียวกัน ทำให้นับซ้ำ" | `ดูวิธีปิด tag ใน GTM` |
| `selector_not_found` | "ไม่พบ element `{selector}` บนหน้านี้ (Desktop)" | `แก้ Trigger Element` · `เปลี่ยนเป็น Mobile` |
| `blocked` / `site_error` | "เว็บไซต์บล็อกระบบตรวจ / เข้าไม่ได้ ({code})" | `ตรวจซ้ำ` |

5. **แท็บ "สุขภาพเว็บไซต์" (ระดับ run):** รายการ WEB / CLK / CNS จัดกลุ่มตาม §9.9 (หน้าเว็บ / ติดตั้ง / Trigger / Hit / Cookie / เข้าถึง) แต่ละข้อแสดงสถานะ, URL, สิ่งที่ตรวจพบ และคำแนะนำ เช่น
   - WEB-11: "ปุ่ม LINE เปิดในแท็บเดิม ทำให้ hit ถูกยกเลิกก่อนส่งเสร็จ แนะนำตั้ง transport เป็น beacon หรือเปิดในแท็บใหม่"
   - WEB-12: "Contact_AdTech ยิงตอนโหลดหน้าโดยไม่มีคลิก conversion จะถูกนับเกินจริง"
   - CLK-01: "redirect จาก http ไป https ทำให้ gclid หาย"
6. **แท็บ "การตั้งค่า Google Ads":** รายการ ADS-01 ถึง ADS-05 และ HIS-01 พร้อม deep link ไป Google Ads
7. **Footer:** `ตรวจซ้ำ event นี้` และ `ดูประวัติ` (รายการ run ย้อนหลัง)

## 16. การ์ด P-027 ใน Ad Validate (แก้จากของเดิม)

### 16.1 โครงการ์ด

- หัวข้อเปลี่ยนเป็น: **วิธีติด Conversion Tag — ตรวจ 3 จุด**
- ปุ่มหลักเปลี่ยนจาก `ตรวจสอบจาก Google Ads Manager` เป็น **`ตรวจสอบการยิง Tag`**
- จุดที่ 1 **"Tag ยิงบนเว็บไซต์"**: Inspector คลิกทุก event ที่ผูกกับงานนี้ เทียบกับ conversion action ใน Google Ads และตรวจ WEB-01 ถึง WEB-16 แสดงสรุปเป็น "ผ่าน n/m จุด" และกดขยายดูรายข้อได้
- จุดที่ 2 **"ระบุเครื่องมือที่ติดตั้ง"**: ระบบระบุเครื่องมือเอง ถ้าเป็น GTM ต้องใส่เหตุผล
- จุดที่ 3 **"Conversion ถูกนับในแคมเปญนี้"**: ADS-01 ถึง ADS-05 (การตั้งค่า Google Ads) + CLK-01 ถึง CLK-05 (จำลองการคลิกโฆษณา) แต่ละข้อที่ไม่ผ่านมี deep link ไปยังหน้าที่ต้องแก้ใน Google Ads หรือเว็บไซต์
- Warning (CNS-01, WEB แบบ Warning) แสดงเป็นรายการสีเหลืองใต้จุดที่เกี่ยวข้อง และ HIS-01 แสดงเป็นบรรทัดข้อมูล "conversion นี้เคยบันทึกได้ 42 ครั้งใน 30 วัน"
- ลิงก์ `เปิดใน Conversion Tracking ↗` ไปยังหน้า Conversion Tracking ของ business นั้น

### 16.2 สถานะของการ์ด

| สถานะ | Banner | จุดที่ 1 | จุดที่ 2 | Action |
|---|---|---|---|---|
| ยังไม่ตรวจ | ฟ้า: "กด 'ตรวจสอบการยิง Tag' ระบบจะเปิดเว็บและคลิกปุ่ม conversion ให้" | ยังไม่ตรวจ | รอผลจุดที่ 1 | `ตรวจสอบการยิง Tag` |
| กำลังตรวจ | primary tint: "กำลังตรวจ n/m event… ปิดหน้านี้ได้" | spinner | — | disabled |
| ผ่านอัตโนมัติ | เขียว: "Tag ยิงถูกต้องและปลายทางรับแล้ว รอยืนยัน conversion หลังออนไลน์" | ✓ "ยิงครบ 2/2 event · Google Ads รับแล้ว" | ✓ "Plus AdTech (ระบบตรวจพบ)" | `ดูผลตรวจ` |
| ผ่านเมื่อใส่เหตุผล | amber: "ตรวจพบว่าติดตั้งด้วย GTM" | ✓ "ยิงครบ 2/2 event · Google Ads รับแล้ว" | ⚠ ช่องเหตุผล (บังคับ ≥ 10 ตัวอักษร) ส่วนเครื่องมือแสดง `GTM (GTM-XXXX)` แบบอ่านอย่างเดียว | `บันทึกเหตุผล` |
| ไม่ผ่าน: selector | แดง | ✗ "หา element ของ Call_AdTech ไม่เจอ" | — | `แก้ใน Conversion Tracking ↗` · `ตรวจซ้ำ` |
| ตรวจไม่ได้ | amber: "เว็บไซต์บล็อกระบบตรวจ" | ! "ตรวจไม่ได้ (403)" | — | `ตรวจซ้ำ` · `แนบหลักฐาน Tag Assistant` |
| รอ approve | amber: "รอหัวหน้าทีม approve หลักฐาน" | ! แนบแล้ว | — | (สำหรับผู้มีสิทธิ์) `Approve` / `Reject` |
| บล็อก | แดง: "ต้องแก้การติดตั้งก่อน ข้ามไม่ได้" | ✗ "Contact_AdTech ไม่ยิง" หรือ "ID ไม่ตรง" | — | `ดูผลตรวจ` · `ตรวจซ้ำ` |
| บล็อก (ยิงซ้ำ) | แดง: "Plus AdTech และ GTM ยิงซ้ำกัน ดู P-028" | ✗ | — | `ไปที่ P-028` |
| บล็อก (ปลายทางไม่รับ) | แดง: "Google Ads ไม่รับ hit ของ Call_AdTech (HTTP 4xx)" | ✗ | — | `ดูผลตรวจ` · `ตรวจซ้ำ` |

ทุกสถานะที่ผ่านต้องแสดงบรรทัดเล็กใต้การ์ดว่า **"ยืนยันแล้ว: ส่งถูก ✓ · ปลายทางรับ ✓ · นับเป็น conversion — รอหลังออนไลน์"** ถ้าช่องทางไหนเป็น `delivery_unverified` ให้แสดง "ปลายทางรับ — ยังยืนยันไม่ได้" แทน

### 16.3 Modal แนบหลักฐาน (สถานะ "ตรวจไม่ได้")

- อัปโหลด: ไฟล์ export ของ Tag Assistant (`.json`) หรือภาพหน้าจอ (`.png`/`.jpg`, ≤ 10 MB, สูงสุด 5 ไฟล์)
- ช่องบังคับ: `AW-ID/label` ที่เห็นในหลักฐาน, URL ที่ทดสอบ, หมายเหตุ
- ข้อความ: "หลักฐานต้องแสดงว่า conversion ยิงจริง หัวหน้าทีมจะตรวจก่อน approve"
- บันทึกเป็น audit แบบ append-only (ใคร / เมื่อไหร่ / run ไหน)

### 16.4 "วิธีที่ระบบใช้ตรวจ (สำหรับ dev)"

แสดง `inspector_run_id`, เวลา, consent state, ตาราง event × URL × สถานะ, initiator root URL และลิงก์ไปดู evidence

---

## 17. Edge cases

| กรณี | การจัดการ |
|---|---|
| Consent banner ที่ไม่รู้จัก | ถ้าไม่มี hit เลย และตรวจพบ banner ที่ยังไม่ได้กด ให้เป็น `blocked` (ไม่ใช่ `not_fired`) พร้อมเหตุผล `consent_unhandled` |
| Element อยู่ใน iframe / shadow DOM | รองรับ shadow DOM แบบ open ถ้าเป็น iframe ข้ามโดเมนให้เป็น `selector_not_found` พร้อมเหตุผล `cross_origin_iframe` |
| คลิกแล้ว navigate ไปหน้า thank-you | บล็อกการ navigate แต่ยังจับ hit ที่ยิงก่อน unload ถ้า tag ยิงบนหน้า thank-you ให้ใส่ URL นั้นเป็น Test URL ของ event แยก |
| ปุ่ม `tel:` / `line://` | ดักจับการเปิด external protocol แล้วยกเลิก |
| Server-side GTM (sGTM) | hit ไปโดเมนของลูกค้าเอง (`/g/collect` บน first-party domain) Google Ads adapter ต้องรองรับ path pattern ด้วย และ initiator ยังเป็น gtm.js |
| Enhanced conversions | ไม่ต้องตรวจในรอบนี้ แต่ห้ามเก็บ `em`/`ph` hashed ไว้ใน evidence |
| เว็บเปลี่ยนระหว่างรัน | ผลเป็นของ run นั้น ถ้าต้องการผลใหม่ให้ตรวจซ้ำ |
| มี GTM หลาย container | แสดง `GTM (GTM-A, GTM-B)` และตรวจ duplicate ข้าม container ด้วย |
| Tag ยิงช้า (> 5 วินาที) | retry 1 ครั้งด้วย wait 10 วินาที ถ้ายังไม่ยิงให้เป็น `not_fired` |
| Website URL redirect ไปโดเมนอื่น | ทำต่อได้ แต่บันทึก `final_url` และเตือนเมื่อโดเมนเปลี่ยน |

## 18. Success metrics

- งานเปิดใหม่ที่ถูกบล็อกโดย P-027 เพราะ "ไม่พบสัญญาณ" ลดลงจาก ~100% เหลือเฉพาะงานที่ tag เสียจริง
- ≥ 90% ของ run ได้ผลที่ชัดเจน (ไม่ใช่ "ตรวจไม่ได้")
- ความเห็นระหว่าง Inspector กับการตรวจด้วย Tag Assistant ของทีม Tracking ตรงกัน ≥ 95% (วัดจาก 30 เว็บตัวอย่างใน UAT)
- 0 เคสที่ hit จาก Inspector หลุดไปถึงปลายทางของช่องทางที่ต้อง abort (GA4 / Meta / TikTok)
- 0 เคสที่ hit แบบ passthrough ของ Google Ads ถูกนับเป็น conversion (ตรวจจากบัญชีทดสอบ)
- ≥ 90% ของงานที่ผ่าน P-027 เห็น conversion แรกภายใน 7 วันหลังออนไลน์

## 19. คำถามที่ยังเปิดอยู่

| # | คำถาม | ถามใคร | ถ้ายังไม่มีคำตอบ |
|---|---|---|---|
| Q1 | event config เก็บ `AW-ID/label` ราย event อยู่แล้ว หรือต้องดึงผ่าน "Google Ads Raw" | CTO / ทีม Plus AdTech | ใช้ `conversion_action.tag_snippets` จาก Ads API เป็นแหล่งหลัก |
| Q2 | Trigger Element เก็บเป็น CSS selector หรือรูปแบบอื่น (ใช้ใน widget กับปุ่มบนเว็บเหมือนกันหรือไม่) | ทีม Plus AdTech | ถือว่าเป็น CSS selector |
| Q3 | selector ของ widget Plus AdTech (ใช้กับ P-025 และหลักฐานประกอบ) | ทีม Plus AdTech | ใช้ Trigger Element ของแต่ละ event แทน |
| Q4 | ตัวสแกนเดิมของ Ad Optimizer ใช้ headless browser หรือไม่ ใช้ infra ร่วมกันได้ไหม | ทีม Ad Optimizer | สร้าง browser worker ใหม่ใน Inspector service |
| Q5 | bundle.js โหลด `gtag/js` เองหรือยิง hit เอง (มีผลต่อ §10.2) | ทีม Plus AdTech | รองรับทั้งสองแบบด้วย fixture (a) และ (b) |
| Q6 | ใครมีสิทธิ์ approve exception "ตรวจไม่ได้" | PO / DMS lead | Role `mcc_lead` |
| Q7 | ระยะเวลาเก็บหลักฐาน 180 วันเหมาะสมหรือไม่ (PDPA) | Legal | 180 วัน |
| Q8 | โควตาและค่าใช้จ่ายของ browser worker สำหรับการสแกน Live รายวันทุก business | CTO | จำกัด 1 run / business / วัน |
| Q9 | Google Ads API ดึงสถานะ tag ราย conversion action แบบที่เห็นใน UI (Unverified / Recording conversions) ได้ไหม · เอกสารที่เช็คแล้วพบแค่ `customer.conversion_tracking_setting.conversion_tracking_status` ซึ่งเป็นระดับบัญชี | ทีม Dev (ทดลองจริง) | ไม่ใช้สถานะนี้ ใช้ HTTP response ของ passthrough แทน |
| Q10 | event ของ Meta CAPI / TikTok Events API ที่ส่งพร้อม `test_event_code` ถูกเอาไปใช้ optimize หรือนับในรายงานไหม (เอกสารที่หาได้ยังไม่ยืนยัน) | ทีม Dev ทดสอบกับ pixel ทดสอบ | ถ้ายืนยันไม่ได้ ให้ Meta/TikTok เป็น `delivery_unverified` |
| Q11 | Plus AdTech มี access token ของ Meta CAPI / TikTok Events API ราย pixel อยู่แล้วหรือไม่ และมี GA4 Admin API access ไหม | ทีม Plus AdTech | ถ้าไม่มี ให้ช่องทางนั้นเป็น `delivery_unverified` |
| Q12 | เกณฑ์ "conversion แรกหลังออนไลน์" (7 วัน / 30 click) และ API ที่ Ad Optimizer ใช้ส่งผลกลับให้ Ad Validate | PO + ทีม Ad Optimizer | ใช้ค่าเริ่มต้น และยังไม่ส่งผลกลับ |
| Q13 | การปล่อย hit ของ Google Ads ทำให้ข้อมูลใน Google Ads เพี้ยนหรือไม่ (เช่น นับใน diagnostics หรือ "all conversions") | ทีม Dev ทดสอบกับบัญชีทดสอบก่อนเปิดใช้จริง | ถ้าพบว่าเพี้ยน ให้กลับไปใช้ abort และเป็น `delivery_unverified` |
| Q14 | ยืนยัน D20 / D22: ADS + CLK เป็น Critical, CNS + HIS เป็น Warning / ข้อมูล และรวมทั้งหมดไว้ในการ์ด P-027 (ไม่แยกเป็นกฎใหม่) | PO | ใช้ตามที่เขียนไว้ |
| Q15 | ข้อ ADS-xx ข้อไหนควรแก้ด้วย auto-fix ได้ (เช่น เปิด auto-tagging หรือตั้ง Primary) | PO + Dev | เป็น external fix ทั้งหมดในรอบนี้ |
| Q16 | การตรวจว่าเป็น SPA (ดู `history.pushState`) ครอบคลุม framework ที่ลูกค้าใช้บ่อยหรือไม่ | Dev (ทดสอบกับเว็บลูกค้าจริง 10 เว็บ) | ถ้าตรวจไม่ได้ ให้ข้าม WEB-08 เป็น `not_applicable` |
| Q17 | การเพิ่ม pass ทำให้เวลาต่อ run เกิน 5 นาทีหรือไม่ และต้องเพิ่มจำนวน browser worker เท่าไร | CTO | จำกัด Final URL ≤ 5 และ element ≤ 3 ต่อหน้า |

## 20. ผลกระทบต่อเอกสารเดิม (ยังไม่ได้แก้ในรอบนี้)

| เอกสาร | ต้องแก้ |
|---|---|
| `docs/PRD.md` | FR-03 เพิ่ม Inspector เป็นแหล่งหลักฐาน · §Rules: P-028 ไม่ต้องใช้ GTM API แล้ว · §Acceptance: ข้อ "Google conversion method" ให้ใช้เกณฑ์ใน §9.4 |
| `docs/AD_VALIDATE_USER_STORIES_FULL.md` | AV-106 ใช้ flow ของ Inspector · AV-108 เพิ่ม exception ที่ต้องมีหลักฐาน Tag Assistant |
| `diagrams/rule-set.html` | P-025 / P-027 / P-028 เปลี่ยนแหล่งข้อมูลเป็น "Plus AdTech Inspector" · ตัด GTM API ออก · P-028 ตัด visibleIf ออก |
| `prototype/reference/new-job-ad-validate.integrated.v2.html` | การ์ด P-027 ตาม §16 |
| Timeline | เพิ่มงาน Plus AdTech (Inspector service + UI) ซึ่งเป็น dependency ใหม่ของ AV-106 และอาจกระทบวัน UAT 30 ต.ค. |
