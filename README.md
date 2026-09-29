# Ad Validate

ระบบตรวจความพร้อมของแคมเปญโฆษณาก่อนส่งต่อให้ลูกค้าอนุมัติ โดยรองรับ Google Ads, Meta Ads และ TikTok Ads

Repo นี้แยกออกจากต้นแบบ Plug AI New Job เพื่อให้ Ad Validate มี lifecycle, release และ ownership ของตัวเอง โดยระบบเดิมเป็นเพียงผู้ส่ง `job context` เข้ามาและรับผล validation กลับไป

## เอกสารหลัก

- [Project brief](docs/PROJECT_BRIEF.md)
- [Product requirements and flows](docs/PRD.md)
- [Project timeline — Interactive TH/EN](docs/project-timeline.html)
- [Project timeline — Source](docs/PROJECT_TIMELINE.md)
- [MVP Gantt plan — TH/EN](docs/ad-validate-gantt.html)
- [MVP user story cards — TH/EN](docs/ad-validate-user-stories.html)
- [Implementation plan](docs/superpowers/plans/2026-09-18-ad-validate-mvp.md)
- [Flow diagrams](diagrams/index.html)
- [User flow แบบ end-to-end](diagrams/user-flow.html)
- [Ad Validate — flow, logic, structure](diagrams/ad-validate.html)

## Prototype reference

ไฟล์ `prototype/reference/new-job-ad-validate.integrated.html` เป็น snapshot แบบ read-only จากต้นแบบเดิม ซึ่งยังรวม Plug AI New Job อยู่ ใช้เพื่ออ้างอิงหน้าตา, copy และ validation rules เท่านั้น ไม่ใช่ฐาน production ของ repo ใหม่นี้

Source เดิมยังอยู่ที่:

`C:\Users\NITRO V 16S AI\Desktop\ai_internal_system\wireframe\new-job-ad-validate.html`

## Repository status

- Local Git repository: พร้อมใช้งาน
- Default branch: `main`
- GitHub remote: ยังไม่ได้สร้าง
- Production stack/API contracts: ต้องยืนยันกับ Tech Lead ก่อนเริ่ม implementation
