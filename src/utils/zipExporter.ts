import JSZip from 'jszip';
import { APPS_SCRIPT_CODE_TEMPLATE, SHEET_ID, APPS_SCRIPT_URL } from './googleSheets';
import {
  THAI_EASY_WORDS,
  THAI_MEDIUM_WORDS,
  THAI_HARD_WORDS,
  THAI_SENTENCES,
  EN_EASY_WORDS,
  EN_MEDIUM_WORDS,
  EN_HARD_WORDS,
  EN_SENTENCES
} from '../data/words';

export async function generateProjectZipBlob(): Promise<Blob> {
  const zip = new JSZip();

  // Root files
  zip.file(
    'README.md',
`# เว็บไซต์เกมฝึกพิมพ์สัมผัสภาษาไทยและภาษาอังกฤษ (Touch Typing Learning Game)
สำหรับผู้เริ่มต้นและผู้ที่ต้องการพัฒนาทักษะการพิมพ์สัมผัส พร้อมระบบแข่งขันจัดอันดับ

## 1. ภาพรวมโปรเจกต์
- รองรับการพิมพ์สัมผัสทั้งภาษาไทยและภาษาอังกฤษ (QWERTY)
- **โหมดประลองจัดอันดับ (Ranked Arena)**: โหมดจับเวลา 60 วินาทีแบบมาตรฐาน สกอร์บอร์ดวัดผลจากโหมดนี้โดยเฉพาะ เน้นทั้งความเร็ว (Net WPM) และความแม่นยำ (Accuracy Multiplier สูงสุด 1.5x พร้อมหักคะแนนหนักเมื่อพิมพ์ผิด)
- **ระบบเลือกและเปลี่ยนรูปโปรไฟล์ (Profile Avatar)**: รองรับทั้งรูปอวาตาร์เกมเมอร์ 16 แบบ, ไล่ระดับสีพื้นหลัง (Gradient) และการอัปโหลดรูปภาพส่วนตัว (Custom Photo Upload) โดยรูปจะแสดงผลบน Scoreboard และ Podium ทันที
- **ระบบธีมสว่างและธีมมืด (Dark / Light Theme)**: สลับธีมได้นุ่มนวล พร้อมการปรับโทนสีสบายตา
- ระบบศูนย์การเรียนรู้ 6 บทเรียน พร้อมผังแป้นเหย้า แป้นแถวบน และแถวล่าง
- ระบบแบบทดสอบก่อนเรียน (Pre-test) และหลังเรียน (Post-test) พร้อมรายงานเปรียบเทียบพัฒนาการ
- โหมดเกม 10 ระดับความยาก พร้อมระบบสุ่มคำใหม่ทุกครั้งที่เริ่มหรือเล่นซ้ำ
- ระบบ Virtual Keyboard และ Hands Diagram ไฮไลต์ปุ่มเป้าหมายและตำแหน่งนิ้วมือแบบ Real-time
- บันทึกผลคะแนนและประวัติการเล่นลง Google Sheets อัตโนมัติ
- ตารางจัดอันดับส่วนกลาง (Global Leaderboard) สามารถดูได้ทุกคนแม้ไม่ได้เข้าสู่ระบบ พร้อมแสดงรูปโปรไฟล์ของผู้เล่น

## 2. การเชื่อมต่อ Google Sheets & Google Apps Script
- Google Sheet ID: \`${SHEET_ID}\`
- Google Apps Script Web App URL: \`${APPS_SCRIPT_URL}\`

### โครงสร้างตารางใน Google Sheets:
1. **ชีท Users (ข้อมูลผู้ใช้งาน)**
   - คอลัมน์: uid | username | password | displayName | createdAt | status
2. **ชีท Scores (ประวัติคะแนน)**
   - คอลัมน์: scoreId | uid | displayName | gameMode | testType | language | levelId | score | totalCharacters | correctCharacters | incorrectCharacters | accuracy | grossWpm | netWpm | timeTakenSeconds | passed | createdAt

### วิธีติดตั้ง Google Apps Script ลงใน Google Sheets ของคุณ:
1. เปิด Google Sheets: https://docs.google.com/spreadsheets/d/${SHEET_ID}
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> **Apps Script**
3. ลบโค้ดเดิมทั้งหมดในไฟล์ \`Code.gs\` แล้วคัดลอกโค้ดจากโฟลเดอร์ \`google-apps-script/Code.gs\` ไปวาง
4. กดบันทึก (รูปแผ่นดิสก์)
5. กดปุ่ม **ทำให้ใช้งานได้ (Deploy)** -> **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
6. เลือกประเภท: **เว็บแอป (Web App)**
   - ผู้ดำเนินการ (Execute as): **ฉัน (Me)**
   - ผู้มีสิทธิ์เข้าถึง (Who has access): **ทุกคน (Anyone)**
7. กด **ทำให้ใช้งานได้ (Deploy)** และคัดลอก URL ของ Web App มาใช้งาน

## 3. วิธีเปิดใช้งานโปรเจกต์ในคอมพิวเตอร์
1. แตกไฟล์ \`touch-typing-game.zip\`
2. เปิดโฟลเดอร์ใน Visual Studio Code
3. คลิกขวาที่ไฟล์ \`index.html\` แล้วเลือก **Open with Live Server**
4. เว็บไซต์จะเปิดขึ้นที่บราวเซอร์พร้อมใช้งานทันที

## 4. วิธี Deploy ขึ้น Firebase Hosting (ทางเลือกเสริม)
\`\`\`bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
\`\`\`
`
  );

  // Standalone index.html
  zip.file(
    'index.html',
`<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>เกมฝึกพิมพ์สัมผัส ไทย-อังกฤษ (Touch Typing Tutor)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Kanit', sans-serif; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <div class="max-w-6xl mx-auto p-6">
    <header class="flex justify-between items-center py-4 border-b border-slate-800 mb-8">
      <div>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          ⌨️ เกมฝึกพิมพ์สัมผัส ไทย-อังกฤษ
        </h1>
        <p class="text-sm text-slate-400">Touch Typing Tutor & Gamified Dashboard</p>
      </div>
      <div class="flex gap-2">
        <span class="px-3 py-1 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded text-xs">
          Google Sheets: Connected
        </span>
      </div>
    </header>
    <main class="text-center py-12">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl">
        <h2 class="text-xl font-bold text-cyan-300 mb-4">ยินดีต้อนรับสู่โปรเจกต์ฝึกพิมพ์สัมผัส</h2>
        <p class="text-slate-300 mb-6">
          โปรเจกต์นี้มาพร้อมระบบเกม 10 ด่าน บทเรียนแป้นเหย้า แป้นเยือน แบบทดสอบก่อน-หลังเรียน 
          และเชื่อมโยงกับ Google Sheets โดยตรง!
        </p>
        <p class="text-sm text-slate-400">
          ดูคู่มือการติดตั้งแบบละเอียดได้ในไฟล์ <strong>README.md</strong> หรือโฟลเดอร์ <strong>google-apps-script/</strong>
        </p>
      </div>
    </main>
  </div>
</body>
</html>`
  );

  // Google Apps Script folder
  const gasFolder = zip.folder('google-apps-script');
  if (gasFolder) {
    gasFolder.file('Code.gs', APPS_SCRIPT_CODE_TEMPLATE);
    gasFolder.file(
      'appsscript.json',
      JSON.stringify(
        {
          timeZone: 'Asia/Bangkok',
          dependencies: {},
          exceptionLogging: 'STACKDRIVER',
          runtimeVersion: 'V8',
          webapp: {
            executeAs: 'USER_DEPLOYING',
            access: 'ANYONE'
          }
        },
        null,
        2
      )
    );
    gasFolder.file(
      'README.md',
      `# Google Apps Script API สำหรับ Touch Typing Game
ชีทปลายทาง: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
นำโค้ดใน Code.gs ไปวางในส่วนขยาย Apps Script ของ Google Sheets แล้ว Deploy เป็น Web App แบบ Execute as: Me และ Access: Anyone`
    );
  }

  // Data folder
  const dataFolder = zip.folder('assets/data');
  if (dataFolder) {
    dataFolder.file(
      'thai-words.json',
      JSON.stringify(
        {
          easy: THAI_EASY_WORDS,
          medium: THAI_MEDIUM_WORDS,
          hard: THAI_HARD_WORDS
        },
        null,
        2
      )
    );
    dataFolder.file(
      'english-words.json',
      JSON.stringify(
        {
          easy: EN_EASY_WORDS,
          medium: EN_MEDIUM_WORDS,
          hard: EN_HARD_WORDS
        },
        null,
        2
      )
    );
    dataFolder.file('thai-sentences.json', JSON.stringify({ sentences: THAI_SENTENCES }, null, 2));
    dataFolder.file('english-sentences.json', JSON.stringify({ sentences: EN_SENTENCES }, null, 2));
  }

  // Config files
  zip.file(
    'firebase.json',
    JSON.stringify(
      {
        hosting: {
          public: '.',
          ignore: ['firebase.json', '**/.*', '**/node_modules/**']
        }
      },
      null,
      2
    )
  );

  zip.file(
    '.firebaserc.example',
    JSON.stringify(
      {
        projects: {
          default: 'your-firebase-project-id'
        }
      },
      null,
      2
    )
  );

  zip.file(
    'package.json',
    JSON.stringify(
      {
        name: 'touch-typing-game',
        version: '1.0.0',
        description: 'Thai & English Touch Typing Tutor with Google Sheets Leaderboard',
        scripts: {
          start: 'npx serve .'
        }
      },
      null,
      2
    )
  );

  return await zip.generateAsync({ type: 'blob' });
}

export async function downloadProjectZip() {
  const blob = await generateProjectZipBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'touch-typing-game.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
