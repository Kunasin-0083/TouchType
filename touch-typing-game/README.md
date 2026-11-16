# เว็บไซต์เกมฝึกพิมพ์สัมผัสภาษาไทยและภาษาอังกฤษ (Touch Typing Learning Game)
สำหรับผู้เริ่มต้นและผู้ที่ต้องการพัฒนาทักษะการพิมพ์สัมผัส

## 1. ภาพรวมโปรเจกต์
- รองรับการพิมพ์สัมผัสทั้งภาษาไทยและภาษาอังกฤษ (QWERTY)
- ระบบศูนย์การเรียนรู้ 6 บทเรียน พร้อมผังแป้นเหย้า แป้นแถวบน และแถวล่าง
- ระบบแบบทดสอบก่อนเรียน (Pre-test) และหลังเรียน (Post-test) พร้อมรายงานเปรียบเทียบพัฒนาการ
- โหมดเกม 10 ระดับความยาก พร้อมระบบสุ่มคำใหม่ทุกครั้งที่เริ่มหรือเล่นซ้ำ
- ระบบ Virtual Keyboard และ Hands Diagram ไฮไลต์ปุ่มเป้าหมายและตำแหน่งนิ้วมือแบบ Real-time
- บันทึกผลคะแนนและประวัติการเล่นลง Google Sheets อัตโนมัติ
- ตารางจัดอันดับส่วนกลาง (Global Leaderboard) สามารถดูได้ทุกคนแม้ไม่ได้เข้าสู่ระบบ

## 2. การเชื่อมต่อ Google Sheets & Google Apps Script
- **Google Sheet ID:** `1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY`
- **Google Apps Script Web App URL:** `https://script.google.com/macros/s/AKfycbzc4JSewT2lJ99qNPEKA3Y9tx_z-mizs6xEJ8_CjbaAOCaXD_eDRVDn0pjDdHJ-5MuIEA/exec`

### โครงสร้างตารางใน Google Sheets:
1. **ชีท Users (ข้อมูลผู้ใช้งาน)**
   - คอลัมน์: `uid` | `username` | `password` | `displayName` | `createdAt` | `status`
2. **ชีท Scores (ประวัติคะแนน)**
   - คอลัมน์: `scoreId` | `uid` | `displayName` | `gameMode` | `testType` | `language` | `levelId` | `score` | `totalCharacters` | `correctCharacters` | `incorrectCharacters` | `accuracy` | `grossWpm` | `netWpm` | `timeTakenSeconds` | `passed` | `createdAt`

### วิธีติดตั้ง Google Apps Script ลงใน Google Sheets ของคุณ:
1. เปิด Google Sheets: https://docs.google.com/spreadsheets/d/1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> **Apps Script**
3. ลบโค้ดเดิมทั้งหมดในไฟล์ `Code.gs` แล้วคัดลอกโค้ดจากโฟลเดอร์ `google-apps-script/Code.gs` ไปวาง
4. กดบันทึก (รูปแผ่นดิสก์)
5. กดปุ่ม **ทำให้ใช้งานได้ (Deploy)** -> **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
6. เลือกประเภท: **เว็บแอป (Web App)**
   - ผู้ดำเนินการ (Execute as): **ฉัน (Me)**
   - ผู้มีสิทธิ์เข้าถึง (Who has access): **ทุกคน (Anyone)**
7. กด **ทำให้ใช้งานได้ (Deploy)** และคัดลอก URL ของ Web App มาใช้งาน

## 3. วิธีเปิดใช้งานโปรเจกต์ในคอมพิวเตอร์
1. แตกไฟล์ `touch-typing-game.zip`
2. เปิดโฟลเดอร์ใน Visual Studio Code
3. คลิกขวาที่ไฟล์ `index.html` แล้วเลือก **Open with Live Server**
4. เว็บไซต์จะเปิดขึ้นที่บราวเซอร์พร้อมใช้งานทันที

## 4. วิธี Deploy ขึ้น Firebase Hosting (ทางเลือกเสริม)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
