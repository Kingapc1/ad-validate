# PROGRESS — Ad Validate

อัปเดตล่าสุด: 2026-09-25

## งานปัจจุบัน: Tag Firing Inspector (Plus AdTech → Conversion Tracking)

Spec หลัก: [`docs/superpowers/specs/2026-09-25-tag-firing-inspector-design.md`](docs/superpowers/specs/2026-09-25-tag-firing-inspector-design.md) (PRD + Tech spec + Internal API + UI spec)

### เสร็จแล้ว
- [x] Grill ครบทุกหัวข้อหลัก (D1–D22 ใน §3 ของ spec)
- [x] ขอบเขต 2 โหมด: Pre-launch (Ad Validate) / Live (Ad Optimizer, แจ้งเตือนอย่างเดียว) — §4
- [x] Business rules: เกณฑ์ผ่านต่อ event, สถานะ, การยืนยัน 3 ชั้น, ADS / CLK / WEB-01–17 / CNS / HIS, ลำดับตัดสินผลการ์ด P-027 — §9
- [x] Tech spec: ขั้นตอนการรัน (หลาย pass), วิธีหา initiator, channel adapter — §10
- [x] Internal API: สั่งรัน / ดูผล / callback / error codes — §11
- [x] UI spec: หน้า Conversion Tracking, ฟอร์ม event, Result drawer, การ์ด P-027 "ตรวจ 3 จุด" — §15–16

### รอยืนยันจาก PO
- [ ] D20 / D22 (Q14): ADS + CLK = Critical, CNS + HIS = Warning/ข้อมูล, รวมไว้ในการ์ด P-027 — ใช้ข้อที่แนะนำไปก่อน
- [ ] ค่าที่ใส่เองโดยยังไม่ได้คุย: รอ hit 5 วินาที, run ≤ 5 นาที p95, ≤ 5 URL, เก็บหลักฐาน 180 วัน, โควตา 30 run/ชม., role `mcc_lead`, เกณฑ์ conversion แรก 7 วัน / 30 click

### รอคำตอบจาก CTO / ทีม Plus AdTech / Dev
- [ ] Open questions Q1–Q17 ใน §19 ของ spec (สำคัญสุด: Q5 bundle.js โหลด gtag เองไหม, Q10 Meta/TikTok `test_event_code`, Q13 passthrough ของ Google Ads ทำข้อมูลเพี้ยนไหม, Q17 เวลาต่อ run)

### ยังไม่ได้ทำ
- [ ] แก้เอกสารเดิมให้ตรงกับ spec ตาม §20: `docs/PRD.md`, `docs/AD_VALIDATE_USER_STORIES_FULL.md` (AV-106, AV-108), `diagrams/rule-set.html` (P-025/027/028), การ์ด P-027 ใน `prototype/reference/new-job-ad-validate.integrated.v2.html`, timeline
- [ ] แตก Jira ticket (ฝั่ง Plus AdTech: Inspector service + UI / ฝั่ง Ad Validate: การ์ด P-027 + gate)
- [ ] Commit (repo ยังไม่มี commit แรก และมีไฟล์ untracked หลายไฟล์)
