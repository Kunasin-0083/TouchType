/**
 * Google Sheets & Apps Script API Integration
 * Sheet ID: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
 * Web App URL: https://script.google.com/macros/s/AKfycbzga1CPf2iHIK9fscIuO4J__Dxo-pKgByxp094keIzOGXvBftW8HxHFb3Rqb1X_pvj_yQ/exec
 */

import { EarnedMedalItem, PrePostComparisonRecord, ScoreRecord, User, UserMedalProfile } from '../types';
import {
  buildUserAvatarKeys,
  getSavedAvatarForScore,
  getSavedAvatarForUser,
  hydrateAvatarFromIndexedDB,
  isValidAvatarData,
  saveAvatarToVault
} from './avatarStorage';

export const SHEET_ID = '1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY';
const LEGACY_DEPRECATED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzc4JSewT2lJ99qNPEKA3Y9tx_z-mizs6xEJ8_CjbaAOCaXD_eDRVDn0pjDdHJ-5MuIEA/exec';
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzga1CPf2iHIK9fscIuO4J__Dxo-pKgByxp094keIzOGXvBftW8HxHFb3Rqb1X_pvj_yQ/exec';
export const APPS_SCRIPT_URL = DEFAULT_APPS_SCRIPT_URL;
const CUSTOM_APPS_SCRIPT_URL_KEY = 'touch_typing_custom_apps_script_url_v1';

export function getActiveAppsScriptUrl(): string {
  try {
    const saved = localStorage.getItem(CUSTOM_APPS_SCRIPT_URL_KEY);
    const cleanSaved = saved ? saved.trim().split('?')[0] : '';
    if (
      cleanSaved &&
      cleanSaved !== LEGACY_DEPRECATED_SCRIPT_URL &&
      /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(cleanSaved)
    ) {
      return cleanSaved;
    }
    if (cleanSaved === LEGACY_DEPRECATED_SCRIPT_URL) {
      localStorage.removeItem(CUSTOM_APPS_SCRIPT_URL_KEY);
    }
  } catch {
    // ignore
  }
  return DEFAULT_APPS_SCRIPT_URL;
}

export function setCustomAppsScriptUrl(rawUrl: string): { ok: boolean; normalizedUrl?: string; error?: string } {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) {
    try {
      localStorage.removeItem(CUSTOM_APPS_SCRIPT_URL_KEY);
    } catch {
      // ignore
    }
    return { ok: true, normalizedUrl: DEFAULT_APPS_SCRIPT_URL };
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(\?.*)?$/i.test(cleaned)) {
    return {
      ok: false,
      error: 'รูปแบบ URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://script.google.com/macros/s/... และลงท้ายด้วย /exec'
    };
  }
  const withoutQuery = cleaned.split('?')[0];
  try {
    localStorage.setItem(CUSTOM_APPS_SCRIPT_URL_KEY, withoutQuery);
  } catch {
    // ignore
  }
  return { ok: true, normalizedUrl: withoutQuery };
}

export function resetAppsScriptUrl(): string {
  try {
    localStorage.removeItem(CUSTOM_APPS_SCRIPT_URL_KEY);
  } catch {
    // ignore
  }
  return DEFAULT_APPS_SCRIPT_URL;
}

export const DEMO_SEED_STUDENT_IDS = new Set(['66309010001', '66309010002']);

export function isDemoSeedStudent(u?: { uid?: string; username?: string; studentId?: string } | null): boolean {
  if (!u) return false;
  const uid = String(u.uid || '').trim().toLowerCase();
  const sid = String(u.studentId || '').trim().toLowerCase();
  const uname = String(u.username || '').trim().toLowerCase();
  return (
    uid.startsWith('seed_') ||
    uid === 'std_66309010001' ||
    uid === 'std_66309010002' ||
    DEMO_SEED_STUDENT_IDS.has(sid) ||
    DEMO_SEED_STUDENT_IDS.has(uname)
  );
}

export const CLASSROOM_OPTIONS = [
  'ปวช.3/1',
  'ปวช.3/2',
  'ปวช.3/3',
  'ปวช.3/4',
  'ปวช.1',
  'ปวช.2',
  'ทั่วไป'
] as const;

export const APPS_SCRIPT_CODE_TEMPLATE = String.raw`/**
 * Google Apps Script Backend for TouchTyping Game
 * Sheet ID: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
 */

function ensureSheetHeaders(sheet, expectedHeaders) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(expectedHeaders);
    return;
  }
  var lastCol = sheet.getLastColumn();
  if (lastCol < expectedHeaders.length) {
    var missing = expectedHeaders.slice(lastCol);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = data.action || 'getLeaderboard';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var SCORE_HEADERS = [
      'Score ID', 'UID', 'Display Name', 'Avatar', 'Avatar BG', 'Game Mode', 'Test Type',
      'Language', 'Level ID', 'Score', 'Total Chars', 'Correct Chars', 'Incorrect Chars',
      'Accuracy %', 'Gross WPM', 'Net WPM', 'Time (s)', 'Passed', 'Rank Tier', 'Created At',
      'Classroom', 'Student ID'
    ];
    var USER_HEADERS = [
      'UID', 'Username', 'Password', 'Display Name', 'Avatar', 'Avatar BG', 'Role', 'Created At',
      'Student ID', 'Full Name', 'Classroom', 'Classroom Updated At'
    ];
    var MEDAL_HEADERS = [
      'Account Key', 'UID', 'Student ID', 'Display Name', 'Full Name', 'Classroom',
      'Has Pretest', 'Has Lesson', 'Has Posttest', 'Passed Levels', 'Has All 10 Levels',
      'Grand Complete 100%', 'Achievement IDs', 'Earned Medals JSON', 'Total Medals',
      'Completion %', 'Best Score', 'Best WPM', 'Best Accuracy', 'Updated At'
    ];
    var PRE_POST_HEADERS = [
      'Account Key', 'UID', 'Student ID', 'Display Name', 'Full Name', 'Classroom',
      'Pre-Test Quiz (/10)', 'Pre-Test Quiz (%)', 'Pre-Test Quiz Date',
      'Post-Test Quiz (/10)', 'Post-Test Quiz (%)', 'Post-Test Quiz Date',
      'Quiz Diff (+/-)',
      'Pre-Test Typing (WPM)', 'Pre-Test Typing (Acc%)', 'Pre-Test Typing Date',
      'Post-Test Typing (WPM)', 'Post-Test Typing (Acc%)', 'Post-Test Typing Date',
      'Typing WPM Diff (+/-)', 'Typing Acc Diff (+/-)', 'Updated At'
    ];

    function numOrEmpty(val) {
      return (val !== null && val !== undefined && val !== '' && !isNaN(Number(val))) ? Number(val) : '';
    }

    function upsertPrePostSheetRow(payload) {
      var ppSheet = ss.getSheetByName('PrePostTests');
      if (!ppSheet) {
        ppSheet = ss.insertSheet('PrePostTests');
      }
      ensureSheetHeaders(ppSheet, PRE_POST_HEADERS);

      var accKeyP = String(payload.accountKey || payload.studentId || payload.uid || '').trim().toLowerCase();
      if (!accKeyP || accKeyP === 'guest' || accKeyP === 'guest_default') return;

      var rowsP = ppSheet.getDataRange().getValues();
      var foundIdx = -1;
      for (var pi = 1; pi < rowsP.length; pi++) {
        var rKey = String(rowsP[pi][0] || '').trim().toLowerCase();
        var rUid = String(rowsP[pi][1] || '').trim().toLowerCase();
        var rSid = String(rowsP[pi][2] || '').trim().toLowerCase();
        if (rKey === accKeyP || (payload.uid && rUid === String(payload.uid).trim().toLowerCase()) || (payload.studentId && rSid === String(payload.studentId).trim().toLowerCase())) {
          foundIdx = pi + 1;
          break;
        }
      }

      var prev = foundIdx > 0 ? rowsP[foundIdx - 1] : [];
      var preQ = numOrEmpty(payload.pretestQuizScore) !== '' ? Number(payload.pretestQuizScore) : numOrEmpty(prev[6]);
      var preQPct = numOrEmpty(payload.pretestQuizPercent) !== '' ? Number(payload.pretestQuizPercent) : (preQ !== '' ? Math.round((preQ / 10) * 100) : numOrEmpty(prev[7]));
      var preQDate = String(payload.pretestQuizDate || prev[8] || '');

      var postQ = numOrEmpty(payload.posttestQuizScore) !== '' ? Number(payload.posttestQuizScore) : numOrEmpty(prev[9]);
      var postQPct = numOrEmpty(payload.posttestQuizPercent) !== '' ? Number(payload.posttestQuizPercent) : (postQ !== '' ? Math.round((postQ / 10) * 100) : numOrEmpty(prev[10]));
      var postQDate = String(payload.posttestQuizDate || prev[11] || '');

      var qDiff = (preQ !== '' && postQ !== '') ? (Number(postQ) - Number(preQ)) : '';

      var preTW = numOrEmpty(payload.pretestTypingWpm) !== '' ? Number(payload.pretestTypingWpm) : numOrEmpty(prev[13]);
      var preTA = numOrEmpty(payload.pretestTypingAccuracy) !== '' ? Number(payload.pretestTypingAccuracy) : numOrEmpty(prev[14]);
      var preTDate = String(payload.pretestTypingDate || prev[15] || '');

      var postTW = numOrEmpty(payload.posttestTypingWpm) !== '' ? Number(payload.posttestTypingWpm) : numOrEmpty(prev[16]);
      var postTA = numOrEmpty(payload.posttestTypingAccuracy) !== '' ? Number(payload.posttestTypingAccuracy) : numOrEmpty(prev[17]);
      var postTDate = String(payload.posttestTypingDate || prev[18] || '');

      var tWpmDiff = (preTW !== '' && postTW !== '') ? (Number(postTW) - Number(preTW)) : '';
      var tAccDiff = (preTA !== '' && postTA !== '') ? (Number(postTA) - Number(preTA)) : '';

      var rowDataP = [
        accKeyP,
        String(payload.uid || prev[1] || ''),
        String(payload.studentId || prev[2] || accKeyP),
        String(payload.displayName || prev[3] || ''),
        String(payload.fullName || payload.displayName || prev[4] || ''),
        String(payload.classroom || prev[5] || 'ทั่วไป'),
        preQ,
        preQPct,
        preQDate,
        postQ,
        postQPct,
        postQDate,
        qDiff,
        preTW,
        preTA,
        preTDate,
        postTW,
        postTA,
        postTDate,
        tWpmDiff,
        tAccDiff,
        String(payload.updatedAt || new Date().toISOString())
      ];

      if (foundIdx > 0) {
        ppSheet.getRange(foundIdx, 1, 1, rowDataP.length).setValues([rowDataP]);
      } else {
        ppSheet.appendRow(rowDataP);
      }
    }

    if (action === 'savePrePostComparison') {
      upsertPrePostSheetRow(data);
      return createJsonResponse({ success: true, message: 'Pre/Post comparison saved successfully' });
    }
    
    if (action === 'saveScore') {
      var scoresSheet = ss.getSheetByName('Scores');
      if (!scoresSheet) {
        scoresSheet = ss.insertSheet('Scores');
      }
      ensureSheetHeaders(scoresSheet, SCORE_HEADERS);
      var scoreClassroom = String(data.classroom || '').trim();
      var scoreStudentId = String(data.studentId || '').trim();
      scoresSheet.appendRow([
        data.scoreId || Utilities.getUuid(),
        data.uid || 'guest',
        data.displayName || 'Guest',
        data.avatar || '',
        data.avatarBg || 'from-cyan-500 to-blue-600',
        data.gameMode || 'ranked',
        data.testType || 'RANKED',
        data.language || 'th',
        data.levelId || 'ranked',
        Number(data.score) || 0,
        Number(data.totalCharacters) || 0,
        Number(data.correctCharacters) || 0,
        Number(data.incorrectCharacters) || 0,
        Number(data.accuracy) || 0,
        Number(data.grossWpm) || 0,
        Number(data.netWpm) || 0,
        Number(data.timeTakenSeconds) || 0,
        data.passed ? true : false,
        data.rankTier || 'Unranked',
        data.createdAt || new Date().toISOString(),
        scoreClassroom,
        scoreStudentId
      ]);

      // Auto-sync Pre-Test & Post-Test scores into dedicated PrePostTests sheet for comparison
      var sMode = String(data.gameMode || '').toLowerCase();
      var sType = String(data.testType || '').toUpperCase();
      var sLevel = String(data.levelId || '').toLowerCase();
      if (sMode === 'pretest' || sMode === 'posttest' || sType === 'PRE_TEST' || sType === 'POST_TEST') {
        var isPre = sMode === 'pretest' || sType === 'PRE_TEST';
        var isQuiz = sLevel.indexOf('quiz') !== -1;
        var rawUidStr = String(data.uid || '').trim();
        var derivedSid = rawUidStr.indexOf('std_') === 0 ? rawUidStr.replace(/^std_/, '').split('_')[0] : rawUidStr;
        var ppPatch = {
          accountKey: (scoreStudentId || derivedSid || '').toLowerCase(),
          uid: data.uid || '',
          studentId: scoreStudentId || derivedSid || '',
          displayName: data.displayName || '',
          fullName: data.fullName || data.displayName || '',
          classroom: scoreClassroom || 'ทั่วไป',
          updatedAt: data.createdAt || new Date().toISOString()
        };
        if (isQuiz) {
          var qPts = Number(data.correctCharacters) || Math.round((Number(data.score) || 0) / 100);
          var qPct = Number(data.accuracy) || Math.round((qPts / 10) * 100);
          if (isPre) {
            ppPatch.pretestQuizScore = qPts;
            ppPatch.pretestQuizPercent = qPct;
            ppPatch.pretestQuizDate = data.createdAt || new Date().toISOString();
          } else {
            ppPatch.posttestQuizScore = qPts;
            ppPatch.posttestQuizPercent = qPct;
            ppPatch.posttestQuizDate = data.createdAt || new Date().toISOString();
          }
        } else {
          if (isPre) {
            ppPatch.pretestTypingWpm = Number(data.netWpm) || 0;
            ppPatch.pretestTypingAccuracy = Number(data.accuracy) || 0;
            ppPatch.pretestTypingDate = data.createdAt || new Date().toISOString();
          } else {
            ppPatch.posttestTypingWpm = Number(data.netWpm) || 0;
            ppPatch.posttestTypingAccuracy = Number(data.accuracy) || 0;
            ppPatch.posttestTypingDate = data.createdAt || new Date().toISOString();
          }
        }
        upsertPrePostSheetRow(ppPatch);
      }

      return createJsonResponse({ success: true, message: 'Score saved successfully' });
    }

    if (action === 'getLeaderboard') {
      var scoresSheet = ss.getSheetByName('Scores');
      if (!scoresSheet) {
        return createJsonResponse({ success: true, scores: [] });
      }

      // Build latest user avatar & classroom lookup from Users sheet
      var userAvatarMap = {};
      var userClassroomMap = {};
      var usersSheetLb = ss.getSheetByName('Users');
      if (usersSheetLb) {
        var uRows = usersSheetLb.getDataRange().getValues();
        for (var ui = 1; ui < uRows.length; ui++) {
          var ur = uRows[ui];
          var uAvatar = String(ur[4] || '');
          var uBg = String(ur[5] || '');
          var uRoom = String(ur[10] || '').trim();
          var uRoomTs = ur[11] ? new Date(ur[11]).getTime() : (ur[7] ? new Date(ur[7]).getTime() : ui);
          if (isNaN(uRoomTs)) uRoomTs = ui;
          if (uAvatar || uBg) {
            var uInfo = { avatar: uAvatar, avatarBg: uBg };
            if (ur[0]) userAvatarMap[String(ur[0]).trim().toLowerCase()] = uInfo;
            if (ur[1]) {
              var uKey = String(ur[1]).trim().toLowerCase();
              userAvatarMap[uKey] = uInfo;
              userAvatarMap['std_' + uKey] = uInfo;
            }
            if (ur[3]) userAvatarMap['name:' + String(ur[3]).trim().toLowerCase()] = uInfo;
          }
          if (uRoom) {
            var roomInfo = { classroom: uRoom, ts: uRoomTs };
            if (ur[0]) userClassroomMap[String(ur[0]).trim().toLowerCase()] = roomInfo;
            if (ur[1]) {
              var uKeyR = String(ur[1]).trim().toLowerCase();
              userClassroomMap[uKeyR] = roomInfo;
              userClassroomMap['std_' + uKeyR] = roomInfo;
            }
            if (ur[3]) userClassroomMap['name:' + String(ur[3]).trim().toLowerCase()] = roomInfo;
          }
        }
      }

      var rows = scoresSheet.getDataRange().getValues();
      var scores = [];
      var scoreLatestAvatarMap = {};
      var scoreLatestRoomMap = {};
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (r[0]) {
          var sUidKey = String(r[1] || '').trim().toLowerCase();
          var sNameKey = 'name:' + String(r[2] || '').trim().toLowerCase();
          var rawAvatar = String(r[3] || '');
          var rawBg = String(r[4] || 'from-cyan-500 to-blue-600');
          var rowMode = String(r[5] || '');
          var rowTestType = String(r[6] || '');
          var rowCreatedAt = String(r[19] || '');
          var rowClassroom = String(r[20] || '').trim();
          var rowTs = rowCreatedAt ? new Date(rowCreatedAt).getTime() : i;
          if (isNaN(rowTs)) rowTs = i;

          if (rawAvatar && (rawAvatar.indexOf('data:image') === 0 || rawAvatar.indexOf('http') === 0)) {
            if (sUidKey && (!scoreLatestAvatarMap[sUidKey] || rowTs >= scoreLatestAvatarMap[sUidKey].ts)) {
              scoreLatestAvatarMap[sUidKey] = { avatar: rawAvatar, avatarBg: rawBg, ts: rowTs };
            }
            if (r[2] && (!scoreLatestAvatarMap[sNameKey] || rowTs >= scoreLatestAvatarMap[sNameKey].ts)) {
              scoreLatestAvatarMap[sNameKey] = { avatar: rawAvatar, avatarBg: rawBg, ts: rowTs };
            }
          }

          var detectedRoom = rowClassroom || ((rowMode === 'profile_classroom' || rowTestType === 'CLASSROOM_UPDATE') ? String(r[8] || r[18] || '').trim() : '');
          if (detectedRoom) {
            if (sUidKey && (!scoreLatestRoomMap[sUidKey] || rowTs >= scoreLatestRoomMap[sUidKey].ts)) {
              scoreLatestRoomMap[sUidKey] = { classroom: detectedRoom, ts: rowTs };
            }
            if (r[2] && (!scoreLatestRoomMap[sNameKey] || rowTs >= scoreLatestRoomMap[sNameKey].ts)) {
              scoreLatestRoomMap[sNameKey] = { classroom: detectedRoom, ts: rowTs };
            }
          }

          if (rowMode === 'profile_avatar' || rowTestType === 'AVATAR_UPDATE' || rowMode === 'profile_classroom' || rowTestType === 'CLASSROOM_UPDATE') {
            continue;
          }

          scores.push({
            scoreId: r[0],
            uid: r[1],
            displayName: r[2],
            classroom: rowClassroom,
            avatar: rawAvatar,
            avatarBg: rawBg,
            gameMode: r[5],
            testType: r[6],
            language: r[7],
            levelId: r[8],
            levelTitle: r[5] === 'game' ? 'ด่านที่ ' + r[8] : String(r[8] || r[5]),
            score: Number(r[9]) || 0,
            totalCharacters: Number(r[10]) || 0,
            correctCharacters: Number(r[11]) || 0,
            incorrectCharacters: Number(r[12]) || 0,
            accuracy: Number(r[13]) || 0,
            grossWpm: Number(r[14]) || 0,
            netWpm: Number(r[15]) || 0,
            timeTakenSeconds: Number(r[16]) || 0,
            passed: Boolean(r[17]),
            rankTier: r[18] || '',
            createdAt: r[19] || new Date().toISOString()
          });
        }
      }

      // Attach each player's latest avatar & classroom
      for (var k = 0; k < scores.length; k++) {
        var sc = scores[k];
        var kUid = String(sc.uid || '').trim().toLowerCase();
        var kName = 'name:' + String(sc.displayName || '').trim().toLowerCase();
        var fromUser = userAvatarMap[kUid] || userAvatarMap[kName];
        var fromScore = scoreLatestAvatarMap[kUid] || scoreLatestAvatarMap[kName];
        if (fromUser && fromUser.avatar) {
          sc.avatar = fromUser.avatar;
          if (fromUser.avatarBg) sc.avatarBg = fromUser.avatarBg;
        } else if (fromScore && fromScore.avatar) {
          sc.avatar = fromScore.avatar;
          if (fromScore.avatarBg) sc.avatarBg = fromScore.avatarBg;
        }
        var roomUser = userClassroomMap[kUid] || userClassroomMap[kName];
        var roomScore = scoreLatestRoomMap[kUid] || scoreLatestRoomMap[kName];
        if (roomUser && roomScore) {
          sc.classroom = roomScore.ts >= roomUser.ts ? roomScore.classroom : roomUser.classroom;
        } else if (roomUser) {
          sc.classroom = roomUser.classroom;
        } else if (roomScore) {
          sc.classroom = roomScore.classroom;
        }
      }

      scores.sort(function(a, b) {
        return (b.score - a.score) || (b.accuracy - a.accuracy) || (b.netWpm - a.netWpm);
      });
      return createJsonResponse({ success: true, scores: scores.slice(0, 2000) });
    }

    if (action === 'register') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        usersSheet = ss.insertSheet('Users');
      }
      ensureSheetHeaders(usersSheet, USER_HEADERS);
      var regUsername = String(data.username || data.studentId || '').trim();
      var regStudentId = String(data.studentId || data.username || '').trim();
      var regPassword = String(data.password || '').trim();
      var regKey = regUsername.toLowerCase();
      var regSidKey = regStudentId.toLowerCase();

      var existingRows = usersSheet.getDataRange().getValues();
      for (var rIdx = 1; rIdx < existingRows.length; rIdx++) {
        var exU = String(existingRows[rIdx][1] || '').trim().toLowerCase();
        var exSid = String(existingRows[rIdx][8] || '').trim().toLowerCase();
        if ((regKey && (exU === regKey || exSid === regKey)) || (regSidKey && (exU === regSidKey || exSid === regSidKey))) {
          return createJsonResponse({ success: false, message: 'รหัสผู้ใช้งานนี้ถูกสมัครไว้แล้ว กรุณาเข้าสู่ระบบ' });
        }
      }

      var regNow = new Date().toISOString();
      var nextRow = usersSheet.getLastRow() + 1;
      var newRowValues = [
        data.uid || Utilities.getUuid(),
        regUsername,
        regPassword,
        data.displayName || regUsername,
        data.avatar || '',
        data.avatarBg || 'from-cyan-500 to-blue-600',
        data.role || 'student',
        regNow,
        regStudentId,
        data.fullName || data.displayName || regUsername,
        data.classroom || 'ทั่วไป',
        data.classroomUpdatedAt || regNow
      ];
      var targetRange = usersSheet.getRange(nextRow, 1, 1, newRowValues.length);
      // Keep Username, Password, Student ID as plain text so leading zeros are preserved
      usersSheet.getRange(nextRow, 2, 1, 2).setNumberFormat('@');
      usersSheet.getRange(nextRow, 9, 1, 1).setNumberFormat('@');
      targetRange.setValues([newRowValues]);
      return createJsonResponse({ success: true, message: 'Registered successfully' });
    }

    if (action === 'login') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        return createJsonResponse({ success: false, message: 'ไม่พบข้อมูลบัญชีผู้ใช้งานใน Google Sheets' });
      }
      var inputId = String(data.username || data.studentId || '').trim().toLowerCase();
      var inputIdNoZero = inputId.replace(/^0+/, '');
      var inputPass = String(data.password !== undefined && data.password !== null ? data.password : '');
      var inputPassTrim = inputPass.trim();
      var inputPassNoZero = /^0+\d+$/.test(inputPassTrim) ? inputPassTrim.replace(/^0+/, '') : inputPassTrim;

      var rows = usersSheet.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        var rowUid = String(rows[j][0] || '').trim().toLowerCase();
        var rowUser = String(rows[j][1] || '').trim().toLowerCase();
        var rowSid = String(rows[j][8] || '').trim().toLowerCase();
        var rowUserNoZero = rowUser.replace(/^0+/, '');
        var rowSidNoZero = rowSid.replace(/^0+/, '');

        var idMatched =
          (rowUser && rowUser === inputId) ||
          (rowSid && rowSid === inputId) ||
          (rowUid && rowUid === inputId) ||
          (inputIdNoZero && /^\d+$/.test(inputId) && ((rowUserNoZero && rowUserNoZero === inputIdNoZero) || (rowSidNoZero && rowSidNoZero === inputIdNoZero)));

        if (!idMatched) continue;

        var rowPass = String(rows[j][2] !== undefined && rows[j][2] !== null ? rows[j][2] : '');
        var rowPassTrim = rowPass.trim();
        var rowPassNoZero = /^0+\d+$/.test(rowPassTrim) ? rowPassTrim.replace(/^0+/, '') : rowPassTrim;

        var passMatched =
          rowPass === inputPass ||
          rowPassTrim === inputPassTrim ||
          (rowPassNoZero && inputPassNoZero && /^\d+$/.test(rowPassTrim) && /^\d+$/.test(inputPassTrim) && rowPassNoZero === inputPassNoZero);

        if (passMatched) {
          var resolvedSid = String(rows[j][8] || rows[j][1] || '').trim();
          var resolvedUname = String(rows[j][1] || rows[j][8] || '').trim();
          var resolvedDisplay = String(rows[j][3] || rows[j][9] || resolvedUname).trim();
          return createJsonResponse({
            success: true,
            user: {
              uid: String(rows[j][0] || '').trim(),
              username: resolvedUname,
              displayName: resolvedDisplay,
              avatar: rows[j][4] || '',
              avatarBg: rows[j][5] || 'from-cyan-500 to-blue-600',
              role: rows[j][6] || 'student',
              createdAt: rows[j][7] || '',
              studentId: resolvedSid,
              fullName: String(rows[j][9] || resolvedDisplay).trim(),
              classroom: String(rows[j][10] || '').trim() || 'ทั่วไป',
              classroomUpdatedAt: rows[j][11] || rows[j][7] || ''
            }
          });
        }
      }
      return createJsonResponse({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (action === 'updateAvatar') {
      var targetUidA = String(data.uid || '').trim().toLowerCase();
      var targetUserA = String(data.username || data.studentId || '').trim().toLowerCase();
      var targetNameA = String(data.displayName || '').trim().toLowerCase();
      var newAvatar = String(data.avatar || '');
      var newAvatarBg = String(data.avatarBg || 'from-cyan-500 to-blue-600');

      var usersSheetA = ss.getSheetByName('Users');
      if (usersSheetA) {
        var uRowsA = usersSheetA.getDataRange().getValues();
        for (var ua = 1; ua < uRowsA.length; ua++) {
          var rowUid = String(uRowsA[ua][0] || '').trim().toLowerCase();
          var rowUname = String(uRowsA[ua][1] || '').trim().toLowerCase();
          var rowDname = String(uRowsA[ua][3] || '').trim().toLowerCase();
          if (
            (targetUidA && rowUid === targetUidA) ||
            (targetUserA && (rowUname === targetUserA || rowUid === 'std_' + targetUserA)) ||
            (targetNameA && rowDname === targetNameA)
          ) {
            usersSheetA.getRange(ua + 1, 5, 1, 2).setValues([[newAvatar, newAvatarBg]]);
          }
        }
      }

      var scoresSheetA = ss.getSheetByName('Scores');
      if (scoresSheetA) {
        var sRowsA = scoresSheetA.getDataRange().getValues();
        for (var sa = 1; sa < sRowsA.length; sa++) {
          var sRowUid = String(sRowsA[sa][1] || '').trim().toLowerCase();
          var sRowName = String(sRowsA[sa][2] || '').trim().toLowerCase();
          if (
            (targetUidA && sRowUid === targetUidA) ||
            (targetUserA && (sRowUid === targetUserA || sRowUid === 'std_' + targetUserA)) ||
            (targetNameA && sRowName === targetNameA)
          ) {
            scoresSheetA.getRange(sa + 1, 4, 1, 2).setValues([[newAvatar, newAvatarBg]]);
          }
        }
      }

      return createJsonResponse({ success: true, message: 'Avatar updated successfully' });
    }

    if (action === 'saveUserMedals') {
      var medalsSheet = ss.getSheetByName('UserMedals');
      if (!medalsSheet) {
        medalsSheet = ss.insertSheet('UserMedals');
      }
      ensureSheetHeaders(medalsSheet, MEDAL_HEADERS);
      var accountKey = String(data.accountKey || data.studentId || data.uid || '').toLowerCase();
      var rowsM = medalsSheet.getDataRange().getValues();
      var rowData = [
        accountKey,
        data.uid || '',
        data.studentId || '',
        data.displayName || '',
        data.fullName || '',
        data.classroom || '',
        Boolean(data.hasPretest),
        Boolean(data.hasLesson),
        Boolean(data.hasPosttest),
        Array.isArray(data.passedLevels) ? data.passedLevels.join(',') : '',
        Boolean(data.hasAll10Levels),
        Boolean(data.isGrandComplete),
        Array.isArray(data.achievementIds) ? data.achievementIds.join(',') : '',
        JSON.stringify(data.earnedMedals || []),
        Number(data.totalMedalsCount) || 0,
        Number(data.completionPercent) || 0,
        Number(data.bestScore) || 0,
        Number(data.bestWpm) || 0,
        Number(data.bestAccuracy) || 0,
        data.updatedAt || new Date().toISOString()
      ];
      var foundRow = -1;
      for (var m = 1; m < rowsM.length; m++) {
        if (String(rowsM[m][0] || '').toLowerCase() === accountKey) {
          foundRow = m + 1;
          break;
        }
      }
      if (foundRow > 0) {
        medalsSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        medalsSheet.appendRow(rowData);
      }
      return createJsonResponse({ success: true, message: 'User medals synced successfully' });
    }

    if (action === 'getUserData') {
      var targetKey = String(data.accountKey || data.studentId || data.uid || '').toLowerCase();
      var targetUid = String(data.uid || '').toLowerCase();
      var targetName = String(data.displayName || '').trim().toLowerCase();

      var userScores = [];
      var scoresSheetU = ss.getSheetByName('Scores');
      if (scoresSheetU) {
        var rowsS = scoresSheetU.getDataRange().getValues();
        for (var sIdx = 1; sIdx < rowsS.length; sIdx++) {
          var rowS = rowsS[sIdx];
          if (!rowS[0]) continue;
          var rUid = String(rowS[1] || '').toLowerCase();
          var rName = String(rowS[2] || '').trim().toLowerCase();
          var matches =
            (targetUid && rUid === targetUid) ||
            (targetKey && (rUid === targetKey || rUid === 'std_' + targetKey || rUid.indexOf('std_' + targetKey + '_') === 0)) ||
            (targetName && rName === targetName);
          if (matches) {
            userScores.push({
              scoreId: rowS[0],
              uid: rowS[1],
              displayName: rowS[2],
              classroom: String(rowS[20] || '').trim(),
              avatar: rowS[3] || '',
              avatarBg: rowS[4] || 'from-cyan-500 to-blue-600',
              gameMode: rowS[5],
              testType: rowS[6],
              language: rowS[7],
              levelId: rowS[8],
              levelTitle: rowS[5] === 'game' ? 'ด่านที่ ' + rowS[8] : String(rowS[8] || rowS[5]),
              score: Number(rowS[9]) || 0,
              totalCharacters: Number(rowS[10]) || 0,
              correctCharacters: Number(rowS[11]) || 0,
              incorrectCharacters: Number(rowS[12]) || 0,
              accuracy: Number(rowS[13]) || 0,
              grossWpm: Number(rowS[14]) || 0,
              netWpm: Number(rowS[15]) || 0,
              timeTakenSeconds: Number(rowS[16]) || 0,
              passed: Boolean(rowS[17]),
              rankTier: rowS[18] || '',
              createdAt: rowS[19] || new Date().toISOString()
            });
          }
        }
      }

      var medalProfile = null;
      var medalsSheetU = ss.getSheetByName('UserMedals');
      if (medalsSheetU) {
        var rowsMU = medalsSheetU.getDataRange().getValues();
        for (var mu = 1; mu < rowsMU.length; mu++) {
          var rm = rowsMU[mu];
          var rmKey = String(rm[0] || '').toLowerCase();
          var rmUid = String(rm[1] || '').toLowerCase();
          var rmSid = String(rm[2] || '').toLowerCase();
          if (
            (targetKey && (rmKey === targetKey || rmSid === targetKey)) ||
            (targetUid && rmUid === targetUid)
          ) {
            var parsedMedals = [];
            try { parsedMedals = JSON.parse(rm[13] || '[]'); } catch (ex) {}
            var passedLvls = String(rm[9] || '').split(',').map(function(n) { return Number(n); }).filter(function(n) { return n >= 1 && n <= 10; });
            var achIds = String(rm[12] || '').split(',').filter(function(x) { return Boolean(x); });
            medalProfile = {
              accountKey: rm[0],
              uid: rm[1],
              studentId: rm[2],
              displayName: rm[3],
              fullName: rm[4],
              classroom: rm[5],
              hasPretest: Boolean(rm[6]),
              hasLesson: Boolean(rm[7]),
              hasPosttest: Boolean(rm[8]),
              passedLevels: passedLvls,
              hasAll10Levels: Boolean(rm[10]),
              isGrandComplete: Boolean(rm[11]),
              achievementIds: achIds,
              earnedMedals: parsedMedals,
              totalMedalsCount: Number(rm[14]) || parsedMedals.length,
              completionPercent: Number(rm[15]) || 0,
              bestScore: Number(rm[16]) || 0,
              bestWpm: Number(rm[17]) || 0,
              bestAccuracy: Number(rm[18]) || 0,
              updatedAt: rm[19] || new Date().toISOString()
            };
            break;
          }
        }
      }

      var userAvatar = '';
      var userAvatarBg = '';
      var userClassroom = '';
      var userClassroomUpdatedAt = '';
      var usersSheetU = ss.getSheetByName('Users');
      if (usersSheetU) {
        var rowsUU = usersSheetU.getDataRange().getValues();
        for (var uu = 1; uu < rowsUU.length; uu++) {
          var ru = rowsUU[uu];
          var ruUid = String(ru[0] || '').trim().toLowerCase();
          var ruName = String(ru[1] || '').trim().toLowerCase();
          var ruDisp = String(ru[3] || '').trim().toLowerCase();
          if (
            (targetUid && ruUid === targetUid) ||
            (targetKey && (ruName === targetKey || ruUid === 'std_' + targetKey)) ||
            (targetName && ruDisp === targetName)
          ) {
            userAvatar = String(ru[4] || '');
            userAvatarBg = String(ru[5] || '');
            userClassroom = String(ru[10] || '').trim();
            userClassroomUpdatedAt = String(ru[11] || ru[7] || '');
            break;
          }
        }
      }

      var prePostComp = null;
      var ppSheetU = ss.getSheetByName('PrePostTests');
      if (ppSheetU) {
        var ppRowsU = ppSheetU.getDataRange().getValues();
        for (var ppu = 1; ppu < ppRowsU.length; ppu++) {
          var rpp = ppRowsU[ppu];
          var rppKey = String(rpp[0] || '').trim().toLowerCase();
          var rppUid = String(rpp[1] || '').trim().toLowerCase();
          var rppSid = String(rpp[2] || '').trim().toLowerCase();
          if (
            (targetKey && (rppKey === targetKey || rppSid === targetKey)) ||
            (targetUid && rppUid === targetUid)
          ) {
            prePostComp = {
              accountKey: rpp[0],
              uid: rpp[1],
              studentId: rpp[2],
              displayName: rpp[3],
              fullName: rpp[4],
              classroom: rpp[5] || 'ทั่วไป',
              pretestQuizScore: rpp[6] !== '' && rpp[6] !== null && rpp[6] !== undefined ? Number(rpp[6]) : null,
              pretestQuizTotal: 10,
              pretestQuizPercent: rpp[7] !== '' && rpp[7] !== null && rpp[7] !== undefined ? Number(rpp[7]) : null,
              pretestQuizDate: rpp[8] ? String(rpp[8]) : undefined,
              posttestQuizScore: rpp[9] !== '' && rpp[9] !== null && rpp[9] !== undefined ? Number(rpp[9]) : null,
              posttestQuizTotal: 10,
              posttestQuizPercent: rpp[10] !== '' && rpp[10] !== null && rpp[10] !== undefined ? Number(rpp[10]) : null,
              posttestQuizDate: rpp[11] ? String(rpp[11]) : undefined,
              quizScoreDiff: rpp[12] !== '' && rpp[12] !== null && rpp[12] !== undefined ? Number(rpp[12]) : null,
              pretestTypingWpm: rpp[13] !== '' && rpp[13] !== null && rpp[13] !== undefined ? Number(rpp[13]) : null,
              pretestTypingAccuracy: rpp[14] !== '' && rpp[14] !== null && rpp[14] !== undefined ? Number(rpp[14]) : null,
              pretestTypingDate: rpp[15] ? String(rpp[15]) : undefined,
              posttestTypingWpm: rpp[16] !== '' && rpp[16] !== null && rpp[16] !== undefined ? Number(rpp[16]) : null,
              posttestTypingAccuracy: rpp[17] !== '' && rpp[17] !== null && rpp[17] !== undefined ? Number(rpp[17]) : null,
              posttestTypingDate: rpp[18] ? String(rpp[18]) : undefined,
              typingWpmDiff: rpp[19] !== '' && rpp[19] !== null && rpp[19] !== undefined ? Number(rpp[19]) : null,
              typingAccuracyDiff: rpp[20] !== '' && rpp[20] !== null && rpp[20] !== undefined ? Number(rpp[20]) : null,
              updatedAt: rpp[21] ? String(rpp[21]) : new Date().toISOString()
            };
            break;
          }
        }
      }

      return createJsonResponse({
        success: true,
        scores: userScores,
        medalProfile: medalProfile,
        prePostComparison: prePostComp,
        userAvatar: userAvatar,
        userAvatarBg: userAvatarBg,
        userClassroom: userClassroom,
        userClassroomUpdatedAt: userClassroomUpdatedAt
      });
    }

    if (action === 'updateClassroom') {
      var targetUidC = String(data.uid || '').trim().toLowerCase();
      var targetSidC = String(data.studentId || data.username || '').trim().toLowerCase();
      var targetNameC = String(data.displayName || '').trim().toLowerCase();
      var newRoom = String(data.classroom || 'ทั่วไป').trim();
      var updatedAtC = String(data.updatedAt || new Date().toISOString());

      var usersSheetC = ss.getSheetByName('Users');
      if (!usersSheetC) {
        usersSheetC = ss.insertSheet('Users');
      }
      ensureSheetHeaders(usersSheetC, USER_HEADERS);
      var uRowsC = usersSheetC.getDataRange().getValues();
      var foundInUsers = false;
      for (var uc = 1; uc < uRowsC.length; uc++) {
        var rUidC = String(uRowsC[uc][0] || '').trim().toLowerCase();
        var rUserC = String(uRowsC[uc][1] || '').trim().toLowerCase();
        var rSidC = String(uRowsC[uc][8] || '').trim().toLowerCase();
        var rNameC = String(uRowsC[uc][3] || '').trim().toLowerCase();
        if (
          (targetUidC && rUidC === targetUidC) ||
          (targetSidC && (rUserC === targetSidC || rSidC === targetSidC || rUidC === 'std_' + targetSidC)) ||
          (targetNameC && rNameC === targetNameC)
        ) {
          usersSheetC.getRange(uc + 1, 11, 1, 2).setValues([[newRoom, updatedAtC]]);
          foundInUsers = true;
        }
      }
      if (!foundInUsers && (data.uid || data.studentId || data.username)) {
        usersSheetC.appendRow([
          data.uid || ('std_' + targetSidC),
          data.username || data.studentId || targetSidC,
          '1234',
          data.displayName || data.fullName || data.studentId || '',
          data.avatar || '',
          data.avatarBg || 'from-cyan-500 to-blue-600',
          'student',
          updatedAtC,
          data.studentId || data.username || '',
          data.fullName || data.displayName || '',
          newRoom,
          updatedAtC
        ]);
      }

      var medalsSheetC = ss.getSheetByName('UserMedals');
      if (medalsSheetC) {
        ensureSheetHeaders(medalsSheetC, MEDAL_HEADERS);
        var mRowsC = medalsSheetC.getDataRange().getValues();
        for (var mc = 1; mc < mRowsC.length; mc++) {
          var mKeyC = String(mRowsC[mc][0] || '').trim().toLowerCase();
          var mUidC = String(mRowsC[mc][1] || '').trim().toLowerCase();
          var mSidC = String(mRowsC[mc][2] || '').trim().toLowerCase();
          if (
            (targetUidC && mUidC === targetUidC) ||
            (targetSidC && (mKeyC === targetSidC || mSidC === targetSidC))
          ) {
            medalsSheetC.getRange(mc + 1, 6).setValue(newRoom);
            medalsSheetC.getRange(mc + 1, 20).setValue(updatedAtC);
          }
        }
      }

      var scoresSheetC = ss.getSheetByName('Scores');
      if (scoresSheetC) {
        ensureSheetHeaders(scoresSheetC, SCORE_HEADERS);
        var sRowsC = scoresSheetC.getDataRange().getValues();
        for (var scIdx = 1; scIdx < sRowsC.length; scIdx++) {
          var sUidC = String(sRowsC[scIdx][1] || '').trim().toLowerCase();
          var sDispC = String(sRowsC[scIdx][2] || '').trim().toLowerCase();
          var sSidC = String(sRowsC[scIdx][21] || '').trim().toLowerCase();
          if (
            (targetUidC && sUidC === targetUidC) ||
            (targetSidC && (sUidC === targetSidC || sUidC === 'std_' + targetSidC || sSidC === targetSidC)) ||
            (targetNameC && sDispC === targetNameC)
          ) {
            scoresSheetC.getRange(scIdx + 1, 21).setValue(newRoom);
          }
        }
      }

      return createJsonResponse({ success: true, message: 'Classroom updated successfully', classroom: newRoom, updatedAt: updatedAtC });
    }

    if (action === 'updateUserPassword') {
      var targetUidP = String(data.uid || '').trim().toLowerCase();
      var targetSidP = String(data.studentId || data.username || '').trim().toLowerCase();
      var targetSidPNoZero = /^0+\d+$/.test(targetSidP) ? targetSidP.replace(/^0+/, '') : targetSidP;
      var targetNameP = String(data.displayName || '').trim().toLowerCase();
      var nextPassP = String(data.newPassword !== undefined && data.newPassword !== null ? data.newPassword : data.password || '').trim();

      if (!nextPassP || nextPassP.length < 4) {
        return createJsonResponse({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' });
      }

      var usersSheetP = ss.getSheetByName('Users');
      if (!usersSheetP) {
        usersSheetP = ss.insertSheet('Users');
      }
      ensureSheetHeaders(usersSheetP, USER_HEADERS);

      var uRowsP = usersSheetP.getDataRange().getValues();
      var updatedCountP = 0;
      for (var up = 1; up < uRowsP.length; up++) {
        var rUidP = String(uRowsP[up][0] || '').trim().toLowerCase();
        var rUserP = String(uRowsP[up][1] || '').trim().toLowerCase();
        var rSidP = String(uRowsP[up][8] || '').trim().toLowerCase();
        var rDispP = String(uRowsP[up][3] || '').trim().toLowerCase();
        var rUserPNoZero = /^0+\d+$/.test(rUserP) ? rUserP.replace(/^0+/, '') : rUserP;
        var rSidPNoZero = /^0+\d+$/.test(rSidP) ? rSidP.replace(/^0+/, '') : rSidP;

        var matchedP =
          (targetUidP && rUidP === targetUidP) ||
          (targetSidP && (rUserP === targetSidP || rSidP === targetSidP || rUidP === 'std_' + targetSidP)) ||
          (targetSidPNoZero && /^\d+$/.test(targetSidP) && ((rUserPNoZero && rUserPNoZero === targetSidPNoZero) || (rSidPNoZero && rSidPNoZero === targetSidPNoZero))) ||
          (!targetUidP && !targetSidP && targetNameP && rDispP === targetNameP);

        if (matchedP) {
          var passCell = usersSheetP.getRange(up + 1, 3);
          passCell.setNumberFormat('@');
          passCell.setValue(nextPassP);
          updatedCountP++;
        }
      }

      var createdRowP = false;
      if (updatedCountP === 0 && (targetSidP || targetUidP)) {
        var nowIsoP = new Date().toISOString();
        var appendRowIdxP = usersSheetP.getLastRow() + 1;
        var cleanUnameP = String(data.studentId || data.username || targetSidP).trim();
        var newRowP = [
          String(data.uid || ('std_' + targetSidP)),
          cleanUnameP,
          nextPassP,
          String(data.displayName || data.fullName || cleanUnameP),
          String(data.avatar || ''),
          String(data.avatarBg || 'from-cyan-500 to-blue-600'),
          'student',
          nowIsoP,
          cleanUnameP,
          String(data.fullName || data.displayName || cleanUnameP),
          String(data.classroom || 'ทั่วไป'),
          nowIsoP
        ];
        usersSheetP.getRange(appendRowIdxP, 2, 1, 2).setNumberFormat('@');
        usersSheetP.getRange(appendRowIdxP, 9, 1, 1).setNumberFormat('@');
        usersSheetP.getRange(appendRowIdxP, 1, 1, newRowP.length).setValues([newRowP]);
        createdRowP = true;
      }

      return createJsonResponse({
        success: true,
        message: 'Password updated successfully',
        updatedRows: updatedCountP,
        createdRow: createdRowP
      });
    }

    if (action === 'deleteUser') {
      var delUid = String(data.uid || '').trim().toLowerCase();
      var delSid = String(data.studentId || data.username || '').trim().toLowerCase();
      var delSidNoZero = /^0+\d+$/.test(delSid) ? delSid.replace(/^0+/, '') : delSid;
      var delName = String(data.displayName || '').trim().toLowerCase();
      var delRelated = data.deleteRelatedData !== false;

      if (delSid === 'teacher' || delSid === 'admin' || delUid === 'teacher_01' || delUid.indexOf('teacher_') === 0) {
        return createJsonResponse({ success: false, message: 'ไม่สามารถลบบัญชีครูผู้สอนหรือผู้ดูแลระบบได้' });
      }

      function matchesDeleteTarget(rUid, rUser, rSid, rDisp) {
        var cUid = String(rUid || '').trim().toLowerCase();
        var cUser = String(rUser || '').trim().toLowerCase();
        var cSid = String(rSid || '').trim().toLowerCase();
        var cDisp = String(rDisp || '').trim().toLowerCase();
        var cUserNZ = /^0+\d+$/.test(cUser) ? cUser.replace(/^0+/, '') : cUser;
        var cSidNZ = /^0+\d+$/.test(cSid) ? cSid.replace(/^0+/, '') : cSid;

        if (delUid && cUid === delUid) return true;
        if (
          delSid &&
          (cUser === delSid ||
            cSid === delSid ||
            cUid === delSid ||
            cUid === 'std_' + delSid ||
            cUid.indexOf('std_' + delSid + '_') === 0)
        ) {
          return true;
        }
        if (
          delSidNoZero &&
          /^\d+$/.test(delSid) &&
          ((cUserNZ && cUserNZ === delSidNoZero) || (cSidNZ && cSidNZ === delSidNoZero))
        ) {
          return true;
        }
        if (!delUid && !delSid && delName && cDisp === delName) return true;
        return false;
      }

      var deletedUsers = 0;
      var usersSheetD = ss.getSheetByName('Users');
      if (usersSheetD) {
        var uRowsD = usersSheetD.getDataRange().getValues();
        for (var ud = uRowsD.length - 1; ud >= 1; ud--) {
          var rowRoleD = String(uRowsD[ud][6] || '').trim().toLowerCase();
          var rowUserD = String(uRowsD[ud][1] || '').trim().toLowerCase();
          if (rowRoleD === 'teacher' || rowRoleD === 'admin' || rowUserD === 'teacher' || rowUserD === 'admin') {
            continue;
          }
          if (matchesDeleteTarget(uRowsD[ud][0], uRowsD[ud][1], uRowsD[ud][8], uRowsD[ud][3])) {
            usersSheetD.deleteRow(ud + 1);
            deletedUsers++;
          }
        }
      }

      var deletedScores = 0;
      var deletedMedals = 0;
      var deletedPrePost = 0;

      if (delRelated) {
        var scoresSheetD = ss.getSheetByName('Scores');
        if (scoresSheetD) {
          var sRowsD = scoresSheetD.getDataRange().getValues();
          for (var sd = sRowsD.length - 1; sd >= 1; sd--) {
            if (matchesDeleteTarget(sRowsD[sd][1], '', sRowsD[sd][21], sRowsD[sd][2])) {
              scoresSheetD.deleteRow(sd + 1);
              deletedScores++;
            }
          }
        }

        var medalsSheetD = ss.getSheetByName('UserMedals');
        if (medalsSheetD) {
          var mRowsD = medalsSheetD.getDataRange().getValues();
          for (var md = mRowsD.length - 1; md >= 1; md--) {
            if (matchesDeleteTarget(mRowsD[md][1], mRowsD[md][0], mRowsD[md][2], mRowsD[md][3])) {
              medalsSheetD.deleteRow(md + 1);
              deletedMedals++;
            }
          }
        }

        var ppSheetD = ss.getSheetByName('PrePostTests');
        if (ppSheetD) {
          var pRowsD = ppSheetD.getDataRange().getValues();
          for (var pd = pRowsD.length - 1; pd >= 1; pd--) {
            if (matchesDeleteTarget(pRowsD[pd][1], pRowsD[pd][0], pRowsD[pd][2], pRowsD[pd][3])) {
              ppSheetD.deleteRow(pd + 1);
              deletedPrePost++;
            }
          }
        }
      }

      return createJsonResponse({
        success: true,
        message: 'User deleted successfully',
        deletedUsers: deletedUsers,
        deletedScores: deletedScores,
        deletedMedals: deletedMedals,
        deletedPrePost: deletedPrePost
      });
    }

    if (action === 'getUserScores') {
      var targetUidS = String(data.uid || '').trim().toLowerCase();
      var targetNameS = String(data.displayName || '').trim().toLowerCase();
      var foundUserScores = [];
      var scoresSheetUS = ss.getSheetByName('Scores');
      if (scoresSheetUS) {
        var rowsUS = scoresSheetUS.getDataRange().getValues();
        for (var usi = 1; usi < rowsUS.length; usi++) {
          var rus = rowsUS[usi];
          if (!rus[0]) continue;
          var rUidUS = String(rus[1] || '').trim().toLowerCase();
          var rNameUS = String(rus[2] || '').trim().toLowerCase();
          if ((targetUidS && rUidUS === targetUidS) || (!targetUidS && targetNameS && rNameUS === targetNameS)) {
            foundUserScores.push({
              scoreId: rus[0],
              uid: rus[1],
              displayName: rus[2],
              classroom: String(rus[20] || '').trim(),
              avatar: rus[3] || '',
              avatarBg: rus[4] || 'from-cyan-500 to-blue-600',
              gameMode: rus[5],
              testType: rus[6],
              language: rus[7],
              levelId: rus[8],
              levelTitle: rus[5] === 'game' ? 'ด่านที่ ' + rus[8] : String(rus[8] || rus[5]),
              score: Number(rus[9]) || 0,
              totalCharacters: Number(rus[10]) || 0,
              correctCharacters: Number(rus[11]) || 0,
              incorrectCharacters: Number(rus[12]) || 0,
              accuracy: Number(rus[13]) || 0,
              grossWpm: Number(rus[14]) || 0,
              netWpm: Number(rus[15]) || 0,
              timeTakenSeconds: Number(rus[16]) || 0,
              passed: Boolean(rus[17]),
              rankTier: rus[18] || '',
              createdAt: rus[19] || new Date().toISOString()
            });
          }
        }
      }
      return createJsonResponse({ success: true, scores: foundUserScores });
    }

    if (action === 'getTeacherData') {
      function findSheetIgnoreCase(names) {
        var sheets = ss.getSheets();
        for (var ni = 0; ni < names.length; ni++) {
          var exact = ss.getSheetByName(names[ni]);
          if (exact) return exact;
        }
        for (var si0 = 0; si0 < sheets.length; si0++) {
          var sNameLow = String(sheets[si0].getName() || '').trim().toLowerCase();
          for (var nj = 0; nj < names.length; nj++) {
            if (sNameLow === String(names[nj]).toLowerCase()) return sheets[si0];
          }
        }
        return null;
      }

      function findHeaderCol(headerRow, aliases, fallbackIdx) {
        if (headerRow && headerRow.length > 0) {
          for (var hi = 0; hi < headerRow.length; hi++) {
            var hNorm = String(headerRow[hi] || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
            if (!hNorm) continue;
            for (var ai = 0; ai < aliases.length; ai++) {
              if (hNorm === aliases[ai]) return hi;
            }
          }
        }
        return fallbackIdx;
      }

      var allUsers = [];
      var userAvatarMapT = {};
      var userRoomMapT = {};
      var usersSheetT = findSheetIgnoreCase(['Users', 'User', 'Students', 'ผู้ใช้งาน', 'นักเรียน']);
      if (usersSheetT) {
        var uRowsT = usersSheetT.getDataRange().getValues();
        var uHeader = uRowsT.length > 0 ? uRowsT[0] : [];
        var cUid = findHeaderCol(uHeader, ['uid', 'userid', 'id'], 0);
        var cUser = findHeaderCol(uHeader, ['username', 'user', 'login', 'ชื่อผู้ใช้', 'รหัสผู้ใช้'], 1);
        var cDisp = findHeaderCol(uHeader, ['displayname', 'nickname', 'name', 'ชื่อที่แสดง', 'ชื่อเล่น'], 3);
        var cAv = findHeaderCol(uHeader, ['avatar', 'photo', 'image', 'รูปโปรไฟล์'], 4);
        var cBg = findHeaderCol(uHeader, ['avatarbg', 'bg', 'gradient'], 5);
        var cRole = findHeaderCol(uHeader, ['role', 'สิทธิ์', 'บทบาท'], 6);
        var cCreated = findHeaderCol(uHeader, ['createdat', 'created', 'registeredat', 'วันที่สมัคร'], 7);
        var cSid = findHeaderCol(uHeader, ['studentid', 'รหัสนักเรียน', 'รหัสนักศึกษา'], 8);
        var cFull = findHeaderCol(uHeader, ['fullname', 'studentname', 'ชื่อนามสกุล', 'ชื่อสกุล', 'ชื่อเต็ม'], 9);
        var cRoom = findHeaderCol(uHeader, ['classroom', 'room', 'class', 'ห้องเรียน', 'ห้อง', 'ชั้นเรียน'], 10);
        var cRoomUpd = findHeaderCol(uHeader, ['classroomupdatedat', 'roomupdatedat', 'updatedat'], 11);

        for (var ut = 1; ut < uRowsT.length; ut++) {
          var urt = uRowsT[ut];
          var rawUidV = String(urt[cUid] !== undefined ? urt[cUid] : '').trim();
          var rawUserV = String(urt[cUser] !== undefined ? urt[cUser] : '').trim();
          var rawDispV = String(urt[cDisp] !== undefined ? urt[cDisp] : '').trim();
          var rawSidV = String(urt[cSid] !== undefined ? urt[cSid] : '').trim();
          var rawFullV = String(urt[cFull] !== undefined ? urt[cFull] : '').trim();
          if (!rawUidV && !rawUserV && !rawDispV && !rawSidV && !rawFullV) continue;

          var roleT = String(urt[cRole] !== undefined ? urt[cRole] : 'student').trim().toLowerCase() || 'student';
          var avT = String(urt[cAv] !== undefined ? urt[cAv] : '');
          var bgT = String(urt[cBg] !== undefined ? urt[cBg] : '') || 'from-cyan-500 to-blue-600';
          var roomT = String(urt[cRoom] !== undefined ? urt[cRoom] : '').trim() || 'ทั่วไป';
          var createdValT = urt[cCreated] ? (urt[cCreated] instanceof Date ? urt[cCreated].toISOString() : String(urt[cCreated])) : new Date().toISOString();
          var roomUpdRaw = urt[cRoomUpd] ? (urt[cRoomUpd] instanceof Date ? urt[cRoomUpd].toISOString() : String(urt[cRoomUpd])) : createdValT;

          if (avT) {
            if (rawUidV) userAvatarMapT[rawUidV.toLowerCase()] = { avatar: avT, avatarBg: bgT };
            if (rawUserV) {
              userAvatarMapT[rawUserV.toLowerCase()] = { avatar: avT, avatarBg: bgT };
              userAvatarMapT['std_' + rawUserV.toLowerCase()] = { avatar: avT, avatarBg: bgT };
            }
            if (rawDispV) userAvatarMapT['name:' + rawDispV.toLowerCase()] = { avatar: avT, avatarBg: bgT };
          }
          var uRoomTsT = new Date(roomUpdRaw).getTime();
          if (isNaN(uRoomTsT)) uRoomTsT = ut;
          if (rawUidV) userRoomMapT[rawUidV.toLowerCase()] = { classroom: roomT, ts: uRoomTsT };
          if (rawUserV) {
            var uKeyT = rawUserV.toLowerCase();
            userRoomMapT[uKeyT] = { classroom: roomT, ts: uRoomTsT };
            userRoomMapT['std_' + uKeyT] = { classroom: roomT, ts: uRoomTsT };
          }
          if (rawSidV) {
            var sKeyT = rawSidV.toLowerCase();
            userRoomMapT[sKeyT] = { classroom: roomT, ts: uRoomTsT };
            userRoomMapT['std_' + sKeyT] = { classroom: roomT, ts: uRoomTsT };
          }

          if (roleT !== 'teacher' && roleT !== 'admin' && rawUserV.toLowerCase() !== 'teacher' && rawUserV.toLowerCase() !== 'admin') {
            var fallbackIdT = rawSidV || rawUserV || rawUidV || ('row_' + ut);
            var resolvedDispT = rawDispV || rawFullV || rawUserV || fallbackIdT;
            var resolvedFullT = rawFullV || rawDispV || rawUserV || fallbackIdT;
            allUsers.push({
              uid: rawUidV || ('std_' + fallbackIdT.toLowerCase()),
              username: rawUserV || fallbackIdT,
              displayName: resolvedDispT,
              avatar: avT,
              avatarBg: bgT,
              role: roleT,
              createdAt: createdValT,
              studentId: rawSidV || rawUserV || fallbackIdT,
              fullName: resolvedFullT,
              classroom: roomT,
              classroomUpdatedAt: roomUpdRaw
            });
          }
        }
      }

      var allScoresT = [];
      var scoreAvMapT = {};
      var scoreRoomMapT = {};
      var scoresSheetT = ss.getSheetByName('Scores');
      if (scoresSheetT) {
        var sRowsT = scoresSheetT.getDataRange().getValues();
        for (var st = 1; st < sRowsT.length; st++) {
          var rt = sRowsT[st];
          if (!rt[0]) continue;
          var rModeT = String(rt[5] || '');
          var rTypeT = String(rt[6] || '');
          var rAvT = String(rt[3] || '');
          var rBgT = String(rt[4] || 'from-cyan-500 to-blue-600');
          var rRoomT = String(rt[20] || '').trim();
          var rTsT = rt[19] ? new Date(rt[19]).getTime() : st;
          if (isNaN(rTsT)) rTsT = st;
          var uidKT = String(rt[1] || '').trim().toLowerCase();
          var nameKT = 'name:' + String(rt[2] || '').trim().toLowerCase();

          if (rAvT && (rAvT.indexOf('data:image') === 0 || rAvT.indexOf('http') === 0)) {
            if (uidKT && (!scoreAvMapT[uidKT] || rTsT >= scoreAvMapT[uidKT].ts)) {
              scoreAvMapT[uidKT] = { avatar: rAvT, avatarBg: rBgT, ts: rTsT };
            }
            if (rt[2] && (!scoreAvMapT[nameKT] || rTsT >= scoreAvMapT[nameKT].ts)) {
              scoreAvMapT[nameKT] = { avatar: rAvT, avatarBg: rBgT, ts: rTsT };
            }
          }

          var resolvedScoreRoom = rRoomT || ((rModeT === 'profile_classroom' || rTypeT === 'CLASSROOM_UPDATE') ? String(rt[8] || rt[18] || '').trim() : '');
          if (resolvedScoreRoom) {
            if (uidKT && (!scoreRoomMapT[uidKT] || rTsT >= scoreRoomMapT[uidKT].ts)) {
              scoreRoomMapT[uidKT] = { classroom: resolvedScoreRoom, ts: rTsT };
            }
            if (rt[2] && (!scoreRoomMapT[nameKT] || rTsT >= scoreRoomMapT[nameKT].ts)) {
              scoreRoomMapT[nameKT] = { classroom: resolvedScoreRoom, ts: rTsT };
            }
          }

          if (rModeT === 'profile_avatar' || rTypeT === 'AVATAR_UPDATE' || rModeT === 'profile_classroom' || rTypeT === 'CLASSROOM_UPDATE') continue;
          allScoresT.push({
            scoreId: rt[0],
            uid: rt[1],
            displayName: rt[2],
            classroom: rRoomT,
            avatar: rAvT,
            avatarBg: rBgT,
            gameMode: rt[5],
            testType: rt[6],
            language: rt[7],
            levelId: rt[8],
            levelTitle: rt[5] === 'game' ? 'ด่านที่ ' + rt[8] : String(rt[8] || rt[5]),
            score: Number(rt[9]) || 0,
            totalCharacters: Number(rt[10]) || 0,
            correctCharacters: Number(rt[11]) || 0,
            incorrectCharacters: Number(rt[12]) || 0,
            accuracy: Number(rt[13]) || 0,
            grossWpm: Number(rt[14]) || 0,
            netWpm: Number(rt[15]) || 0,
            timeTakenSeconds: Number(rt[16]) || 0,
            passed: Boolean(rt[17]),
            rankTier: rt[18] || '',
            createdAt: rt[19] || new Date().toISOString()
          });
        }
      }

      for (var si = 0; si < allScoresT.length; si++) {
        var scT = allScoresT[si];
        var uk = String(scT.uid || '').trim().toLowerCase();
        var nk = 'name:' + String(scT.displayName || '').trim().toLowerCase();
        var uaInfo = userAvatarMapT[uk] || userAvatarMapT[nk];
        var saInfo = scoreAvMapT[uk] || scoreAvMapT[nk];
        if (uaInfo && uaInfo.avatar) {
          scT.avatar = uaInfo.avatar;
          if (uaInfo.avatarBg) scT.avatarBg = uaInfo.avatarBg;
        } else if (saInfo && saInfo.avatar) {
          scT.avatar = saInfo.avatar;
          if (saInfo.avatarBg) scT.avatarBg = saInfo.avatarBg;
        }
        var urInfo = userRoomMapT[uk] || userRoomMapT[nk];
        var srInfo = scoreRoomMapT[uk] || scoreRoomMapT[nk];
        if (urInfo && srInfo) {
          scT.classroom = srInfo.ts >= urInfo.ts ? srInfo.classroom : urInfo.classroom;
        } else if (urInfo) {
          scT.classroom = urInfo.classroom;
        } else if (srInfo) {
          scT.classroom = srInfo.classroom;
        }
      }

      var allMedalsT = [];
      var medalsSheetT = ss.getSheetByName('UserMedals');
      if (medalsSheetT) {
        var mRowsT = medalsSheetT.getDataRange().getValues();
        for (var mt = 1; mt < mRowsT.length; mt++) {
          var rmt = mRowsT[mt];
          if (!rmt[0]) continue;
          var parsedMedalsT = [];
          try { parsedMedalsT = JSON.parse(rmt[13] || '[]'); } catch (ex) {}
          var passedLvlsT = String(rmt[9] || '').split(',').map(function(n) { return Number(n); }).filter(function(n) { return n >= 1 && n <= 10; });
          var achIdsT = String(rmt[12] || '').split(',').filter(function(x) { return Boolean(x); });
          allMedalsT.push({
            accountKey: rmt[0],
            uid: rmt[1],
            studentId: rmt[2],
            displayName: rmt[3],
            fullName: rmt[4],
            classroom: rmt[5],
            hasPretest: Boolean(rmt[6]),
            hasLesson: Boolean(rmt[7]),
            hasPosttest: Boolean(rmt[8]),
            passedLevels: passedLvlsT,
            hasAll10Levels: Boolean(rmt[10]),
            isGrandComplete: Boolean(rmt[11]),
            achievementIds: achIdsT,
            earnedMedals: parsedMedalsT,
            totalMedalsCount: Number(rmt[14]) || parsedMedalsT.length,
            completionPercent: Number(rmt[15]) || 0,
            bestScore: Number(rmt[16]) || 0,
            bestWpm: Number(rmt[17]) || 0,
            bestAccuracy: Number(rmt[18]) || 0,
            updatedAt: rmt[19] || new Date().toISOString()
          });
        }
      }

      var allPrePostT = [];
      var ppSheetT = ss.getSheetByName('PrePostTests');
      if (ppSheetT) {
        var ppRowsT = ppSheetT.getDataRange().getValues();
        for (var ppt = 1; ppt < ppRowsT.length; ppt++) {
          var rppt = ppRowsT[ppt];
          if (!rppt[0]) continue;
          allPrePostT.push({
            accountKey: rppt[0],
            uid: rppt[1],
            studentId: rppt[2],
            displayName: rppt[3],
            fullName: rppt[4],
            classroom: rppt[5] || 'ทั่วไป',
            pretestQuizScore: rppt[6] !== '' && rppt[6] !== null && rppt[6] !== undefined ? Number(rppt[6]) : null,
            pretestQuizTotal: 10,
            pretestQuizPercent: rppt[7] !== '' && rppt[7] !== null && rppt[7] !== undefined ? Number(rppt[7]) : null,
            pretestQuizDate: rppt[8] ? String(rppt[8]) : undefined,
            posttestQuizScore: rppt[9] !== '' && rppt[9] !== null && rppt[9] !== undefined ? Number(rppt[9]) : null,
            posttestQuizTotal: 10,
            posttestQuizPercent: rppt[10] !== '' && rppt[10] !== null && rppt[10] !== undefined ? Number(rppt[10]) : null,
            posttestQuizDate: rppt[11] ? String(rppt[11]) : undefined,
            quizScoreDiff: rppt[12] !== '' && rppt[12] !== null && rppt[12] !== undefined ? Number(rppt[12]) : null,
            pretestTypingWpm: rppt[13] !== '' && rppt[13] !== null && rppt[13] !== undefined ? Number(rppt[13]) : null,
            pretestTypingAccuracy: rppt[14] !== '' && rppt[14] !== null && rppt[14] !== undefined ? Number(rppt[14]) : null,
            pretestTypingDate: rppt[15] ? String(rppt[15]) : undefined,
            posttestTypingWpm: rppt[16] !== '' && rppt[16] !== null && rppt[16] !== undefined ? Number(rppt[16]) : null,
            posttestTypingAccuracy: rppt[17] !== '' && rppt[17] !== null && rppt[17] !== undefined ? Number(rppt[17]) : null,
            posttestTypingDate: rppt[18] ? String(rppt[18]) : undefined,
            typingWpmDiff: rppt[19] !== '' && rppt[19] !== null && rppt[19] !== undefined ? Number(rppt[19]) : null,
            typingAccuracyDiff: rppt[20] !== '' && rppt[20] !== null && rppt[20] !== undefined ? Number(rppt[20]) : null,
            updatedAt: rppt[21] ? String(rppt[21]) : new Date().toISOString()
          });
        }
      }

      return createJsonResponse({
        success: true,
        users: allUsers,
        scores: allScoresT,
        medalProfiles: allMedalsT,
        prePostComparisons: allPrePostT,
        syncedAt: new Date().toISOString()
      });
    }

    return createJsonResponse({ success: false, message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var params = (e && e.parameter && e.parameter.action) ? e.parameter : { action: 'getLeaderboard' };
  return doPost({ postData: { contents: JSON.stringify(params) } });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

const LOCAL_STORAGE_USERS_KEY = 'touch_typing_users_v2';
const LOCAL_STORAGE_SCORES_KEY = 'touch_typing_scores_v2';
const LOCAL_STORAGE_CURRENT_USER = 'touch_typing_current_user_v2';
const LOCAL_STORAGE_USER_MEDALS_KEY = 'touch_typing_user_medals_v2';
const LOCAL_STORAGE_CLASSROOMS_KEY = 'touch_typing_classrooms_v1';
const LOCAL_STORAGE_DELETED_USERS_KEY = 'touch_typing_deleted_users_v1';
const REALTIME_UPDATE_EVENT = 'touch_typing_realtime_update';
const REALTIME_CHANNEL_NAME = 'touch_typing_realtime_channel_v2';

function getDeletedUserKeysSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_USERS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map((x: unknown) => String(x || '').trim().toLowerCase()).filter(Boolean)) : new Set();
  } catch {
    return new Set();
  }
}

function buildDeletedTargetKeys(target: {
  uid?: string;
  username?: string;
  studentId?: string;
}): string[] {
  const keys = new Set<string>();
  const add = (v?: string) => {
    const c = String(v || '').trim().toLowerCase();
    if (!c || c === 'guest' || c === 'guest_default' || c === 'teacher' || c === 'admin') return;
    keys.add(c);
  };
  add(target.uid);
  if (target.studentId) {
    add(target.studentId);
    add(`std_${String(target.studentId).trim().toLowerCase()}`);
  }
  if (target.username) {
    add(target.username);
    add(`std_${String(target.username).trim().toLowerCase()}`);
  }
  return Array.from(keys);
}

function markUserDeletedLocally(target: { uid?: string; username?: string; studentId?: string }) {
  try {
    const set = getDeletedUserKeysSet();
    buildDeletedTargetKeys(target).forEach(k => set.add(k));
    localStorage.setItem(LOCAL_STORAGE_DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function unmarkUserDeletedLocally(target: { uid?: string; username?: string; studentId?: string }) {
  try {
    const set = getDeletedUserKeysSet();
    let changed = false;
    buildDeletedTargetKeys(target).forEach(k => {
      if (set.delete(k)) changed = true;
    });
    if (changed) {
      localStorage.setItem(LOCAL_STORAGE_DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

export function extractStudentIdFromUid(uid?: string): string {
  const raw = String(uid || '').trim();
  if (!raw) return '';
  if (/^std_/i.test(raw)) {
    return raw.replace(/^std_/i, '').split('_')[0] || raw;
  }
  // Preserve full usr_xxxxxxxx or other UIDs intact so distinct accounts never collide
  return raw;
}

function isTargetDeleted(
  deletedSet: Set<string>,
  target: { uid?: string; username?: string; studentId?: string; accountKey?: string }
): boolean {
  if (deletedSet.size === 0) return false;
  const candidates = [
    target.uid,
    target.username,
    target.studentId,
    target.accountKey,
    target.studentId ? `std_${target.studentId}` : undefined,
    target.username ? `std_${target.username}` : undefined
  ];
  for (const raw of candidates) {
    const clean = String(raw || '').trim().toLowerCase();
    if (!clean) continue;
    if (deletedSet.has(clean)) return true;
    const stripped = extractStudentIdFromUid(clean).toLowerCase();
    if (stripped && stripped !== clean && deletedSet.has(stripped)) return true;
  }
  return false;
}

interface ClassroomVaultEntry {
  classroom: string;
  updatedAt: string;
}

function buildUserClassroomKeys(u: {
  uid?: string;
  username?: string;
  studentId?: string;
  displayName?: string;
} | null | undefined): string[] {
  if (!u) return [];
  const keys = new Set<string>();
  const add = (raw?: string) => {
    const clean = String(raw || '').trim().toLowerCase();
    if (!clean || clean === 'guest' || clean === 'guest_default') return;
    keys.add(clean);
  };
  add(u.uid);
  if (u.studentId) {
    add(u.studentId);
    add(`std_${String(u.studentId).trim().toLowerCase()}`);
  }
  if (u.username) {
    add(u.username);
    add(`std_${String(u.username).trim().toLowerCase()}`);
  }
  if (u.displayName) {
    add(`name:${String(u.displayName).trim().toLowerCase()}`);
  }
  return Array.from(keys);
}

function getClassroomVaultMap(): Record<string, ClassroomVaultEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLASSROOMS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getSavedClassroomForUser(
  u: { uid?: string; username?: string; studentId?: string; displayName?: string } | null | undefined
): ClassroomVaultEntry | null {
  const keys = buildUserClassroomKeys(u);
  if (keys.length === 0) return null;
  const map = getClassroomVaultMap();
  let best: ClassroomVaultEntry | null = null;
  let bestTs = -1;
  for (const k of keys) {
    const entry = map[k];
    if (!entry?.classroom) continue;
    const ts = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    if (ts >= bestTs) {
      bestTs = ts;
      best = entry;
    }
  }
  return best;
}

function saveClassroomToVault(
  u: { uid?: string; username?: string; studentId?: string; displayName?: string } | null | undefined,
  classroom: string,
  updatedAt: string = new Date().toISOString()
) {
  const cleanRoom = classroom.trim();
  if (!cleanRoom) return;
  const keys = buildUserClassroomKeys(u);
  if (keys.length === 0) return;
  try {
    const map = getClassroomVaultMap();
    const nextTs = new Date(updatedAt).getTime() || Date.now();
    for (const k of keys) {
      const prev = map[k];
      const prevTs = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
      if (!prev || nextTs >= prevTs) {
        map[k] = { classroom: cleanRoom, updatedAt };
      }
    }
    localStorage.setItem(LOCAL_STORAGE_CLASSROOMS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

let realtimeChannel: BroadcastChannel | null = null;
function getRealtimeChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!realtimeChannel) {
    try {
      realtimeChannel = new BroadcastChannel(REALTIME_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return realtimeChannel;
}

export function getAccountKey(user: User | null | undefined): string {
  if (!user) return '';
  const raw = user.studentId || user.username || user.uid || '';
  return raw.trim().toLowerCase();
}

export function isRecordOwnedByUser(score: ScoreRecord, user: User | null | undefined): boolean {
  if (!user || !score) return false;
  if (String(score.uid || '').startsWith('seed_')) return false;

  const sUid = String(score.uid || '').trim().toLowerCase();
  const uUid = String(user.uid || '').trim().toLowerCase();
  const uSid = String(user.studentId || '').trim().toLowerCase();
  const uUsername = String(user.username || '').trim().toLowerCase();

  if (uUid && sUid === uUid) return true;
  if (
    uSid &&
    (sUid === uSid || sUid === `std_${uSid}` || sUid.startsWith(`std_${uSid}_`))
  ) {
    return true;
  }
  if (
    uUsername &&
    (sUid === uUsername || sUid === `std_${uUsername}` || sUid.startsWith(`std_${uUsername}_`))
  ) {
    return true;
  }
  if (user.uid === 'guest_default' && sUid === 'guest') return true;
  if (
    (!sUid || sUid === 'guest') &&
    user.displayName &&
    score.displayName &&
    score.displayName.trim().toLowerCase() === user.displayName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

function sanitizeAvatarBg(bg: unknown): string {
  const s = String(bg || '').trim();
  return s.includes('from-') ? s : 'from-cyan-500 to-blue-600';
}

function isClassroomMarkerText(val: string): boolean {
  const t = val.trim();
  if (!t) return false;
  return /^(ปวช\.|ปวส\.|ม\.|ทั่วไป$|ผู้สอน$|ห้อง)/.test(t);
}

export function normalizeRemoteUserRecord(raw: any): User {
  const cleanAvatar = isValidAvatarData(raw?.avatar) ? String(raw.avatar) : '';
  const cleanBg = sanitizeAvatarBg(raw?.avatarBg);
  const rawUid = String(raw?.uid || '').trim();
  const rawUsername = String(raw?.username || raw?.studentId || rawUid).trim();
  const rawSid = String(raw?.studentId || raw?.username || rawUid).trim();
  const rawDisplay = String(raw?.displayName || raw?.fullName || rawUsername).trim();
  const rawFull = String(raw?.fullName || raw?.displayName || rawUsername).trim();
  return {
    ...raw,
    uid: rawUid || `std_${rawSid.toLowerCase()}`,
    username: rawUsername,
    studentId: rawSid,
    displayName: rawDisplay,
    fullName: rawFull,
    classroom: String(raw?.classroom || 'ทั่วไป').trim() || 'ทั่วไป',
    role: (raw?.role || 'student') as User['role'],
    avatar: cleanAvatar,
    avatarBg: cleanBg,
    createdAt: raw?.createdAt || new Date().toISOString()
  };
}

export function normalizeRemoteScoreRecord(raw: any): ScoreRecord {
  if (!raw) return raw;
  const rawMode = String(raw.gameMode ?? '').trim().toLowerCase();
  const isLegacyShifted = rawMode === 'th' || rawMode === 'en';

  if (!isLegacyShifted) {
    return {
      ...raw,
      avatar: isValidAvatarData(raw.avatar) ? String(raw.avatar) : '',
      avatarBg: sanitizeAvatarBg(raw.avatarBg),
      classroom: String(raw.classroom || '').trim()
    };
  }

  // Decode legacy 18-column Google Sheet Scores rows (without Avatar/Avatar BG columns)
  const rawLevel = String(raw.testType ?? '').trim();
  const rawLevelLow = rawLevel.toLowerCase();
  const rawLang: 'th' | 'en' = rawMode === 'en' ? 'en' : 'th';
  const rawScore = Number(raw.language) || 0;
  const rawTotalChars = Number(raw.levelId) || 0;
  const rawCorrectChars = Number(raw.score) || 0;
  const rawIncorrectChars = Number(raw.totalCharacters) || 0;
  const rawAccuracy = Number(raw.correctCharacters) || 0;
  const rawGrossWpm = Number(raw.incorrectCharacters) || 0;
  const rawNetWpm = Number(raw.accuracy) || 0;
  const rawTimeTaken = Number(raw.grossWpm) || 0;
  const rawPassed = Boolean(Number(raw.netWpm) > 0 || raw.netWpm === true || String(raw.netWpm).toLowerCase() === 'true');

  let gameMode: ScoreRecord['gameMode'] = 'ranked';
  let testType: ScoreRecord['testType'] = 'NONE';
  let levelTitle = rawLevel;
  let classroom = String(raw.classroom || '').trim();

  if (rawLevelLow === 'profile_avatar') {
    gameMode = 'profile_avatar' as ScoreRecord['gameMode'];
    testType = 'AVATAR_UPDATE' as ScoreRecord['testType'];
  } else if (isClassroomMarkerText(rawLevel)) {
    gameMode = 'profile_classroom' as ScoreRecord['gameMode'];
    testType = 'CLASSROOM_UPDATE' as ScoreRecord['testType'];
    classroom = rawLevel;
  } else if (rawLevelLow.includes('pretest')) {
    gameMode = 'pretest';
    testType = 'PRE_TEST';
    levelTitle = rawLevelLow.includes('quiz') ? 'แบบทดสอบก่อนเรียน (Pre-Test)' : 'ทดสอบพิมพ์ก่อนเรียน';
  } else if (rawLevelLow.includes('posttest')) {
    gameMode = 'posttest';
    testType = 'POST_TEST';
    levelTitle = rawLevelLow.includes('quiz') ? 'แบบทดสอบหลังเรียน (Post-Test)' : 'ทดสอบพิมพ์หลังเรียน';
  } else if (rawLevelLow.startsWith('ranked')) {
    gameMode = 'ranked';
    testType = 'RANKED';
  } else if (rawLevelLow.startsWith('lesson')) {
    gameMode = 'lesson';
    testType = 'NONE';
  } else if (/^(10|[1-9])$/.test(rawLevel)) {
    gameMode = 'game';
    testType = 'NONE';
    levelTitle = `ด่านที่ ${rawLevel}`;
  } else {
    const legacyModeHint = String(raw.avatar || '').trim().toLowerCase();
    if (['game', 'ranked', 'pretest', 'posttest', 'lesson', 'practice'].includes(legacyModeHint)) {
      gameMode = legacyModeHint as ScoreRecord['gameMode'];
    }
    const legacyTestHint = String(raw.avatarBg || '').trim().toUpperCase();
    if (['PRE_TEST', 'POST_TEST', 'RANKED', 'NONE'].includes(legacyTestHint)) {
      testType = legacyTestHint as ScoreRecord['testType'];
    }
  }

  return {
    scoreId: String(raw.scoreId || ''),
    uid: String(raw.uid || ''),
    displayName: String(raw.displayName || ''),
    classroom,
    avatar: isValidAvatarData(raw.avatar) ? String(raw.avatar) : '',
    avatarBg: sanitizeAvatarBg(raw.avatarBg),
    gameMode,
    testType,
    language: rawLang,
    levelId: rawLevel,
    levelTitle,
    score: rawScore,
    totalCharacters: rawTotalChars,
    correctCharacters: rawCorrectChars,
    incorrectCharacters: rawIncorrectChars,
    accuracy: rawAccuracy,
    grossWpm: rawGrossWpm,
    netWpm: rawNetWpm,
    timeTakenSeconds: rawTimeTaken,
    passed: rawPassed,
    rankTier: String(raw.rankTier || ''),
    createdAt: String(raw.createdAt || new Date().toISOString())
  };
}

export function notifyUserDataUpdated(accountKey?: string) {
  if (typeof window === 'undefined') return;
  const payload = { accountKey: accountKey || '', timestamp: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent(REALTIME_UPDATE_EVENT, { detail: payload }));
  } catch {
    // ignore
  }
  try {
    getRealtimeChannel()?.postMessage(payload);
  } catch {
    // ignore
  }
}

export function subscribeUserDataUpdates(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = () => listener();
  const handleStorage = (e: StorageEvent) => {
    if (
      !e.key ||
      e.key === LOCAL_STORAGE_SCORES_KEY ||
      e.key === LOCAL_STORAGE_USER_MEDALS_KEY ||
      e.key === LOCAL_STORAGE_CURRENT_USER ||
      e.key === LOCAL_STORAGE_USERS_KEY ||
      e.key === LOCAL_STORAGE_CLASSROOMS_KEY
    ) {
      listener();
    }
  };

  window.addEventListener(REALTIME_UPDATE_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  const channel = getRealtimeChannel();
  const handleChannelMessage = () => listener();
  if (channel) {
    channel.addEventListener('message', handleChannelMessage);
  }

  return () => {
    window.removeEventListener(REALTIME_UPDATE_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.removeEventListener('message', handleChannelMessage);
    }
  };
}

function getAllSavedMedalProfiles(): Record<string, UserMedalProfile> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_MEDALS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getAllSavedUserMedalProfiles(): Record<string, UserMedalProfile> {
  return getAllSavedMedalProfiles();
}

export function saveLocalUserMedalProfile(profile: UserMedalProfile, silent: boolean = false) {
  if (!profile.accountKey) return;
  try {
    const map = getAllSavedMedalProfiles();
    map[profile.accountKey] = profile;
    localStorage.setItem(LOCAL_STORAGE_USER_MEDALS_KEY, JSON.stringify(map));
    if (!silent) {
      notifyUserDataUpdated(profile.accountKey);
    }
  } catch {
    // ignore
  }
}

export function computeUserMedalProfile(
  user: User,
  userScores: ScoreRecord[],
  existingProfile?: UserMedalProfile | null
): UserMedalProfile {
  const accountKey = getAccountKey(user);
  const nowIso = new Date().toISOString();

  const existingMedalTimeMap = new Map<string, string>();
  (existingProfile?.earnedMedals || []).forEach(m => {
    if (m?.id && m?.earnedAt) {
      existingMedalTimeMap.set(m.id, m.earnedAt);
    }
  });

  const pretestScores = userScores.filter(s => s.gameMode === 'pretest' || s.testType === 'PRE_TEST');
  const lessonScores = userScores.filter(s => s.gameMode === 'lesson' || s.gameMode === 'practice');
  const posttestScores = userScores.filter(s => s.gameMode === 'posttest' || s.testType === 'POST_TEST');
  const passedGameScores = userScores.filter(s => s.gameMode === 'game' && s.passed);

  const hasPretest = pretestScores.length > 0 || Boolean(existingProfile?.hasPretest);
  const hasLesson = lessonScores.length > 0 || Boolean(existingProfile?.hasLesson);
  const hasPosttest = posttestScores.length > 0 || Boolean(existingProfile?.hasPosttest);

  const levelEarnedAtMap = new Map<number, string>();
  (existingProfile?.passedLevels || []).forEach(lvl => {
    if (lvl >= 1 && lvl <= 10) {
      levelEarnedAtMap.set(lvl, existingMedalTimeMap.get(`level_${lvl}`) || existingProfile?.updatedAt || nowIso);
    }
  });
  passedGameScores.forEach(s => {
    const lvl = Number(s.levelId);
    if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 10) {
      const prevTime = levelEarnedAtMap.get(lvl);
      if (!prevTime || new Date(s.createdAt).getTime() < new Date(prevTime).getTime()) {
        levelEarnedAtMap.set(lvl, s.createdAt || nowIso);
      }
    }
  });

  const passedLevels = Array.from(levelEarnedAtMap.keys()).sort((a, b) => a - b);
  const hasAll10Levels = passedLevels.length === 10 || Boolean(existingProfile?.hasAll10Levels);
  const isGrandComplete =
    (hasPretest && hasLesson && hasAll10Levels && hasPosttest) || Boolean(existingProfile?.isGrandComplete);

  const totalPlayed = userScores.length;
  const passedCount = userScores.filter(s => s.passed).length;
  const bestScore = Math.max(
    existingProfile?.bestScore || 0,
    userScores.reduce((m, s) => Math.max(m, s.score || 0), 0)
  );
  const bestWpm = Math.max(
    existingProfile?.bestWpm || 0,
    userScores.reduce((m, s) => Math.max(m, s.netWpm || 0), 0)
  );
  const bestAccuracy = Math.max(
    existingProfile?.bestAccuracy || 0,
    userScores.reduce((m, s) => Math.max(m, s.accuracy || 0), 0)
  );

  const achSet = new Set<string>(existingProfile?.achievementIds || []);
  if (totalPlayed >= 1) achSet.add('first_step');
  if (bestAccuracy >= 95) achSet.add('sharpshooter_95');
  if (bestWpm >= 40) achSet.add('speed_40');
  if (passedCount >= 5) achSet.add('pro_5_passed');
  const achievementIds = Array.from(achSet);

  const earliestDate = (records: ScoreRecord[], fallbackId: string) => {
    if (existingMedalTimeMap.has(fallbackId)) return existingMedalTimeMap.get(fallbackId)!;
    if (records.length === 0) return existingProfile?.updatedAt || nowIso;
    const sorted = [...records].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return sorted[0]?.createdAt || nowIso;
  };

  const earnedMedals: EarnedMedalItem[] = [];

  if (isGrandComplete) {
    earnedMedals.push({
      id: 'grand_100',
      category: 'grand',
      title: 'เหรียญตราเกียรติยศ พิชิตหลักสูตร 100%',
      subtitle: 'ผ่านครบทุกกิจกรรมและทุกด่านสมบูรณ์แบบ',
      icon: '👑',
      earnedAt: existingMedalTimeMap.get('grand_100') || nowIso
    });
  }
  if (hasPretest) {
    earnedMedals.push({
      id: 'activity_pretest',
      category: 'activity',
      title: 'เหรียญปฐมนิเทศ (Pre-Test)',
      subtitle: 'ทำแบบทดสอบก่อนเรียนสำเร็จ',
      icon: '🛡️',
      earnedAt: earliestDate(pretestScores, 'activity_pretest')
    });
  }
  if (hasLesson) {
    earnedMedals.push({
      id: 'activity_lesson',
      category: 'activity',
      title: 'เหรียญนักเรียนรู้ (Learning Center)',
      subtitle: 'ฝึกพิมพ์ในศูนย์การเรียนรู้สำเร็จ',
      icon: '📘',
      earnedAt: earliestDate(lessonScores, 'activity_lesson')
    });
  }
  if (hasAll10Levels) {
    earnedMedals.push({
      id: 'activity_10levels',
      category: 'activity',
      title: 'เหรียญพิชิตเกม 10 ด่าน',
      subtitle: 'ผ่านเกมฝึกพิมพ์สัมผัสครบทั้ง 10 ด่าน',
      icon: '🎮',
      earnedAt: existingMedalTimeMap.get('activity_10levels') || nowIso
    });
  }
  if (hasPosttest) {
    earnedMedals.push({
      id: 'activity_posttest',
      category: 'activity',
      title: 'เหรียญสำเร็จหลักสูตร (Post-Test)',
      subtitle: 'ทำแบบทดสอบหลังเรียนสำเร็จ',
      icon: '🎓',
      earnedAt: earliestDate(posttestScores, 'activity_posttest')
    });
  }

  passedLevels.forEach(lvl => {
    earnedMedals.push({
      id: `level_${lvl}`,
      category: 'level',
      title: `เหรียญด่านที่ ${lvl}`,
      subtitle: `ผ่านโหมดเกมฝึกพิมพ์ด่านที่ ${lvl}`,
      icon: `${lvl}`,
      earnedAt: levelEarnedAtMap.get(lvl) || nowIso
    });
  });

  const achievementMeta: Record<string, { title: string; subtitle: string; icon: string }> = {
    first_step: { title: 'ก้าวแรกสู่นักพิมพ์', subtitle: 'เล่นจบอย่างน้อย 1 ด่าน', icon: '🌱' },
    sharpshooter_95: { title: 'แม่นยำดั่งจับวาง', subtitle: 'ทำความแม่นยำได้ 95% ขึ้นไป', icon: '🎯' },
    speed_40: { title: 'ลมกรดติดสปีด', subtitle: 'ทำความเร็วทะลุ 40 WPM', icon: '⚡' },
    pro_5_passed: { title: 'ระดับมือโปร', subtitle: 'ผ่านครบ 5 ด่านขึ้นไป', icon: '🏆' }
  };

  achievementIds.forEach(id => {
    const meta = achievementMeta[id];
    if (!meta) return;
    earnedMedals.push({
      id: `ach_${id}`,
      category: 'achievement',
      title: meta.title,
      subtitle: meta.subtitle,
      icon: meta.icon,
      earnedAt: existingMedalTimeMap.get(`ach_${id}`) || nowIso
    });
  });

  const totalSteps = 13;
  const completedSteps =
    (hasPretest ? 1 : 0) +
    (hasLesson ? 1 : 0) +
    passedLevels.length +
    (hasPosttest ? 1 : 0);
  const completionPercent = Math.round((completedSteps / totalSteps) * 100);

  return {
    accountKey,
    uid: user.uid,
    studentId: user.studentId || user.username,
    displayName: user.displayName,
    fullName: user.fullName || user.displayName,
    classroom: user.classroom || '',
    hasPretest,
    hasLesson,
    hasPosttest,
    passedLevels,
    hasAll10Levels,
    isGrandComplete,
    achievementIds,
    earnedMedals,
    totalMedalsCount: earnedMedals.length,
    completionPercent,
    bestScore,
    bestWpm,
    bestAccuracy,
    updatedAt: nowIso
  };
}

export function getUserMedalProfile(user: User | null): UserMedalProfile | null {
  if (!user) return null;
  const accountKey = getAccountKey(user);
  if (!accountKey) return null;

  const allProfiles = getAllSavedMedalProfiles();
  const saved = allProfiles[accountKey] || null;
  const userScores = getLocalScores().filter(s => isRecordOwnedByUser(s, user));
  const computed = computeUserMedalProfile(user, userScores, saved);

  // Keep local vault refreshed if medals increased
  if (!saved || computed.totalMedalsCount > saved.totalMedalsCount || computed.completionPercent > saved.completionPercent) {
    saveLocalUserMedalProfile(computed, true);
  }
  return computed;
}

const LOCAL_STORAGE_PREPOST_KEY = 'touch_typing_prepost_v1';

function getAllSavedPrePostMap(): Record<string, PrePostComparisonRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREPOST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getAllSavedPrePostComparisons(): PrePostComparisonRecord[] {
  return Object.values(getAllSavedPrePostMap());
}

export function saveLocalPrePostComparison(
  record: PrePostComparisonRecord,
  silent: boolean = false
) {
  if (!record || !record.accountKey) return;
  try {
    const map = getAllSavedPrePostMap();
    map[record.accountKey.trim().toLowerCase()] = record;
    localStorage.setItem(LOCAL_STORAGE_PREPOST_KEY, JSON.stringify(map));
    if (!silent) {
      notifyUserDataUpdated(record.accountKey);
    }
  } catch {
    // ignore storage errors
  }
}

function isQuizScoreRecord(s: ScoreRecord): boolean {
  const lvl = String(s.levelId || '').toLowerCase();
  const title = String(s.levelTitle || '').toLowerCase();
  return lvl.includes('quiz') || title.includes('ข้อสอบ');
}

function extractQuizPoints(s: ScoreRecord): number {
  if (typeof s.correctCharacters === 'number' && s.correctCharacters >= 0 && s.correctCharacters <= 10) {
    if (s.totalCharacters === 10 || isQuizScoreRecord(s)) {
      return s.correctCharacters;
    }
  }
  return Math.max(0, Math.min(10, Math.round((Number(s.score) || 0) / 100)));
}

export function computePrePostComparison(
  user: Pick<User, 'uid' | 'username' | 'studentId' | 'displayName' | 'fullName' | 'classroom'>,
  userScores: ScoreRecord[],
  existing?: PrePostComparisonRecord | null
): PrePostComparisonRecord {
  const accountKey = getAccountKey(user as User);
  const newestFirst = [...userScores].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const preAll = newestFirst.filter(s => s.gameMode === 'pretest' || s.testType === 'PRE_TEST');
  const postAll = newestFirst.filter(s => s.gameMode === 'posttest' || s.testType === 'POST_TEST');

  const preQuizRecs = preAll.filter(isQuizScoreRecord);
  const postQuizRecs = postAll.filter(isQuizScoreRecord);
  const preTypingRecs = preAll.filter(s => !isQuizScoreRecord(s));
  const postTypingRecs = postAll.filter(s => !isQuizScoreRecord(s));

  const latestPreQuiz = preQuizRecs[0] || null;
  const latestPostQuiz = postQuizRecs[0] || null;
  const latestPreTyping = preTypingRecs[0] || null;
  const latestPostTyping = postTypingRecs[0] || null;

  // Prefer newest timestamp between score record and existing saved comparison record
  const pickQuiz = (
    rec: ScoreRecord | null,
    exScore: number | null | undefined,
    exTotal: number | undefined,
    exPct: number | null | undefined,
    exDate: string | undefined
  ) => {
    const recTs = rec?.createdAt ? new Date(rec.createdAt).getTime() : 0;
    const exTs = exDate ? new Date(exDate).getTime() : 0;
    if (rec && (exScore === null || exScore === undefined || recTs >= exTs)) {
      const pts = extractQuizPoints(rec);
      const total = rec.totalCharacters > 0 && rec.totalCharacters <= 20 ? rec.totalCharacters : 10;
      return {
        score: pts,
        total,
        percent: rec.accuracy > 0 ? Math.round(rec.accuracy) : Math.round((pts / total) * 100),
        date: rec.createdAt
      };
    }
    if (exScore !== null && exScore !== undefined) {
      const total = exTotal || 10;
      return {
        score: exScore,
        total,
        percent: exPct !== null && exPct !== undefined ? exPct : Math.round((exScore / total) * 100),
        date: exDate
      };
    }
    return { score: null, total: 10, percent: null, date: undefined };
  };

  const pickTyping = (
    rec: ScoreRecord | null,
    exWpm: number | null | undefined,
    exAcc: number | null | undefined,
    exDate: string | undefined
  ) => {
    const recTs = rec?.createdAt ? new Date(rec.createdAt).getTime() : 0;
    const exTs = exDate ? new Date(exDate).getTime() : 0;
    if (rec && (exWpm === null || exWpm === undefined || recTs >= exTs)) {
      return {
        wpm: Math.round(Number(rec.netWpm) || 0),
        accuracy: Math.round(Number(rec.accuracy) || 0),
        date: rec.createdAt
      };
    }
    if (exWpm !== null && exWpm !== undefined) {
      return {
        wpm: exWpm,
        accuracy: exAcc ?? 0,
        date: exDate
      };
    }
    return { wpm: null, accuracy: null, date: undefined };
  };

  const preQ = pickQuiz(
    latestPreQuiz,
    existing?.pretestQuizScore,
    existing?.pretestQuizTotal,
    existing?.pretestQuizPercent,
    existing?.pretestQuizDate
  );
  const postQ = pickQuiz(
    latestPostQuiz,
    existing?.posttestQuizScore,
    existing?.posttestQuizTotal,
    existing?.posttestQuizPercent,
    existing?.posttestQuizDate
  );
  const preT = pickTyping(
    latestPreTyping,
    existing?.pretestTypingWpm,
    existing?.pretestTypingAccuracy,
    existing?.pretestTypingDate
  );
  const postT = pickTyping(
    latestPostTyping,
    existing?.posttestTypingWpm,
    existing?.posttestTypingAccuracy,
    existing?.posttestTypingDate
  );

  const quizScoreDiff =
    preQ.score !== null && postQ.score !== null ? postQ.score - preQ.score : null;
  const typingWpmDiff =
    preT.wpm !== null && postT.wpm !== null ? postT.wpm - preT.wpm : null;
  const typingAccuracyDiff =
    preT.accuracy !== null && postT.accuracy !== null ? postT.accuracy - preT.accuracy : null;

  const latestTs = Math.max(
    preQ.date ? new Date(preQ.date).getTime() : 0,
    postQ.date ? new Date(postQ.date).getTime() : 0,
    preT.date ? new Date(preT.date).getTime() : 0,
    postT.date ? new Date(postT.date).getTime() : 0,
    existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0
  );

  return {
    accountKey,
    uid: user.uid,
    studentId: user.studentId || user.username || accountKey,
    displayName: user.displayName || user.fullName || user.username,
    fullName: user.fullName || user.displayName || user.username,
    classroom: user.classroom || existing?.classroom || 'ทั่วไป',
    pretestQuizScore: preQ.score,
    pretestQuizTotal: preQ.total,
    pretestQuizPercent: preQ.percent,
    pretestQuizDate: preQ.date,
    posttestQuizScore: postQ.score,
    posttestQuizTotal: postQ.total,
    posttestQuizPercent: postQ.percent,
    posttestQuizDate: postQ.date,
    quizScoreDiff,
    pretestTypingWpm: preT.wpm,
    pretestTypingAccuracy: preT.accuracy,
    pretestTypingDate: preT.date,
    posttestTypingWpm: postT.wpm,
    posttestTypingAccuracy: postT.accuracy,
    posttestTypingDate: postT.date,
    typingWpmDiff,
    typingAccuracyDiff,
    updatedAt: latestTs > 0 ? new Date(latestTs).toISOString() : new Date().toISOString()
  };
}

export function getUserPrePostComparison(
  user: User | null,
  providedUserScores?: ScoreRecord[]
): PrePostComparisonRecord | null {
  if (!user) return null;
  const accountKey = getAccountKey(user);
  if (!accountKey) return null;

  const map = getAllSavedPrePostMap();
  const saved = map[accountKey] || null;
  const scores = providedUserScores ?? getLocalScores().filter(s => isRecordOwnedByUser(s, user));
  const computed = computePrePostComparison(user, scores, saved);

  const hasAnyData =
    computed.pretestQuizScore !== null ||
    computed.posttestQuizScore !== null ||
    computed.pretestTypingWpm !== null ||
    computed.posttestTypingWpm !== null;

  if (hasAnyData && (!saved || computed.updatedAt !== saved.updatedAt || computed.classroom !== saved.classroom)) {
    saveLocalPrePostComparison(computed, true);
  }
  return computed;
}

export async function apiSyncPrePostToSheet(
  user: User,
  comparison: PrePostComparisonRecord
): Promise<{ success: boolean; error?: string }> {
  if (!user || user.username === 'guest') return { success: false, error: 'Guest user' };
  const result = await sendToAppsScript(
    {
      action: 'savePrePostComparison',
      sheetId: SHEET_ID,
      ...comparison
    },
    7000
  );
  return { success: result.success, error: result.error };
}

export const AVATAR_GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-pink-500 to-rose-600',
  'from-blue-600 to-violet-700',
  'from-yellow-400 to-amber-600',
  'from-slate-700 to-slate-900'
];

function isClassroomSyncRecord(score: Partial<ScoreRecord> | null | undefined): boolean {
  if (!score) return false;
  return (
    (score.gameMode as string) === 'profile_classroom' ||
    (score.testType as string) === 'CLASSROOM_UPDATE'
  );
}

function isAvatarSyncRecord(score: Partial<ScoreRecord> | null | undefined): boolean {
  if (!score) return false;
  return (
    (score.gameMode as string) === 'profile_avatar' ||
    (score.testType as string) === 'AVATAR_UPDATE' ||
    isClassroomSyncRecord(score)
  );
}

function extractClassroomFromScore(score: Partial<ScoreRecord> | null | undefined): string {
  if (!score) return '';
  if (score.classroom && String(score.classroom).trim()) {
    return String(score.classroom).trim();
  }
  if (isClassroomSyncRecord(score)) {
    const candidate = String(score.levelId || score.rankTier || '').trim();
    if (candidate && candidate !== 'profile_classroom' && candidate !== 'ClassroomSync') {
      return candidate;
    }
  }
  return '';
}

function applyVaultAvatarToUser(user: User): User {
  const saved = getSavedAvatarForUser(user);
  const savedRoom = getSavedClassroomForUser(user);
  const userRoomTs = user.classroomUpdatedAt ? new Date(user.classroomUpdatedAt).getTime() : 0;
  const vaultRoomTs = savedRoom?.updatedAt ? new Date(savedRoom.updatedAt).getTime() : 0;

  let resolvedClassroom = user.classroom || '';
  let resolvedRoomUpdatedAt = user.classroomUpdatedAt;
  if (savedRoom && (!resolvedClassroom || vaultRoomTs >= userRoomTs)) {
    resolvedClassroom = savedRoom.classroom;
    resolvedRoomUpdatedAt = savedRoom.updatedAt;
  }

  if (saved) {
    return {
      ...user,
      classroom: resolvedClassroom || user.classroom,
      classroomUpdatedAt: resolvedRoomUpdatedAt,
      avatar: saved.avatar,
      avatarBg: saved.avatarBg || user.avatarBg || 'from-cyan-500 to-blue-600'
    };
  }
  const cleanAvatar = isValidAvatarData(user.avatar) ? user.avatar! : '';
  return {
    ...user,
    classroom: resolvedClassroom || user.classroom,
    classroomUpdatedAt: resolvedRoomUpdatedAt,
    avatar: cleanAvatar,
    avatarBg: user.avatarBg || 'from-cyan-500 to-blue-600'
  };
}

function safeWriteScoresToStorage(scores: ScoreRecord[]) {
  const realScores = scores.filter(s => !isAvatarSyncRecord(s));
  try {
    localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(realScores));
  } catch {
    // Recover cleanly from localStorage quota by stripping redundant inline base64 copies
    // from score history (the Avatar Vault already holds each account's authoritative photo).
    try {
      const compact = realScores.map(s => ({
        ...s,
        avatar: s.avatar && s.avatar.startsWith('data:image') ? '' : s.avatar || ''
      }));
      localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(compact));
    } catch {
      // ignore
    }
  }
}

export function getLocalUsers(): User[] {
  const defaultTeacher: User = {
    uid: 'teacher_01',
    username: 'teacher',
    studentId: 'TEACHER',
    fullName: 'อาจารย์ผู้สอน ประจำวิชาพิมพ์สัมผัส',
    classroom: 'ผู้สอน',
    displayName: 'ครูผู้สอน',
    role: 'teacher',
    avatar: '',
    avatarBg: 'from-indigo-500 to-purple-600',
    createdAt: new Date().toISOString()
  };

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (!raw) {
      const rawSeedUsers: User[] = [
        defaultTeacher,
        {
          uid: 'std_66309010001',
          username: '66309010001',
          studentId: '66309010001',
          fullName: 'นายกิตติศักดิ์ มุ่งมั่น',
          classroom: 'ปวช.3/1',
          displayName: 'กิตติศักดิ์',
          role: 'student',
          avatar: '',
          avatarBg: 'from-amber-400 to-orange-500',
          createdAt: new Date().toISOString()
        },
        {
          uid: 'std_66309010002',
          username: '66309010002',
          studentId: '66309010002',
          fullName: 'นางสาวพิมพ์ชนก นิ้วทอง',
          classroom: 'ปวช.3/2',
          displayName: 'พิมพ์ชนก',
          role: 'student',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          createdAt: new Date().toISOString()
        }
      ];
      const seedUsers: User[] = rawSeedUsers.map(applyVaultAvatarToUser);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(seedUsers));
      return seedUsers;
    }
    const parsed: User[] = JSON.parse(raw).map((u: User) => {
      let normalized = u;
      if (
        u &&
        (u.username?.toLowerCase() === 'teacher' || u.studentId?.toLowerCase() === 'teacher') &&
        u.role !== 'teacher' &&
        u.role !== 'admin'
      ) {
        normalized = { ...u, role: 'teacher' as const };
      }
      return applyVaultAvatarToUser(normalized);
    });
    const hasTeacher = parsed.some(u => u.role === 'teacher' || u.role === 'admin' || u.username?.toLowerCase() === 'teacher');
    if (!hasTeacher) {
      const updated = [applyVaultAvatarToUser(defaultTeacher), ...parsed];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return [applyVaultAvatarToUser(defaultTeacher)];
  }
}

export function saveLocalUser(user: User) {
  try {
    const targetUid = String(user.uid || '').trim().toLowerCase();
    const targetUsername = String(user.username || '').trim().toLowerCase();
    const targetStudentId = String(user.studentId || '').trim().toLowerCase();

    const users = getLocalUsers().filter(u => {
      const uUid = String(u.uid || '').trim().toLowerCase();
      const uUsername = String(u.username || '').trim().toLowerCase();
      const uStudentId = String(u.studentId || '').trim().toLowerCase();
      if (targetUid && uUid === targetUid) return false;
      if (targetUsername && uUsername === targetUsername) return false;
      if (targetStudentId && uStudentId === targetStudentId) return false;
      return true;
    });

    users.push(user);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // Retry after compacting score storage if quota was tight
    try {
      safeWriteScoresToStorage(getLocalScores());
      const users = getLocalUsers().filter(
        u =>
          String(u.uid || '').toLowerCase() !== String(user.uid || '').toLowerCase() &&
          String(u.username || '').toLowerCase() !== String(user.username || '').toLowerCase()
      );
      users.push(user);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  }
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const isTeacherAccount = parsed?.role === 'teacher' || parsed?.role === 'admin';
    if (!parsed || (!parsed.studentId && !isTeacherAccount) || parsed.uid === 'guest_default' || parsed.username === 'guest') {
      localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER);
      return null;
    }
    return applyVaultAvatarToUser(parsed);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  try {
    if (user) {
      const cleanUser: User = {
        ...user,
        avatar: isValidAvatarData(user.avatar) ? user.avatar! : '',
        avatarBg: user.avatarBg || 'from-cyan-500 to-blue-600'
      };
      // If user has a valid avatar and the vault has nothing stored yet, persist it to the vault
      const existingVault = getSavedAvatarForUser(cleanUser);
      if (!existingVault && isValidAvatarData(cleanUser.avatar)) {
        saveAvatarToVault(buildUserAvatarKeys(cleanUser), cleanUser.avatar!, cleanUser.avatarBg!);
      }
      const resolvedUser = applyVaultAvatarToUser(cleanUser);
      try {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(resolvedUser));
      } catch {
        safeWriteScoresToStorage(getLocalScores());
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(resolvedUser));
      }
      saveLocalUser(resolvedUser);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER);
    }
  } catch {
    // ignore
  }
}

async function syncAvatarToGoogleSheets(
  user: User,
  avatar: string,
  avatarBg: string,
  updatedAt: string
): Promise<boolean> {
  if (!user || user.username === 'guest' || user.uid === 'guest_default') return false;

  // 1. Try dedicated updateAvatar endpoint (updates Users + Scores sheets directly)
  const updateRes = await sendToAppsScript(
    {
      action: 'updateAvatar',
      sheetId: SHEET_ID,
      uid: user.uid,
      username: user.username,
      studentId: user.studentId || user.username,
      displayName: user.displayName,
      avatar,
      avatarBg,
      updatedAt
    },
    7000
  );

  if (updateRes.success) {
    return true;
  }

  // 2. Graceful fallback for older deployed Google Apps Scripts:
  //    store a silent AVATAR_UPDATE checkpoint row via existing saveScore endpoint
  //    so the latest profile picture persists in Google Sheets and restores on revisit!
  const fallbackRes = await sendToAppsScript(
    {
      action: 'saveScore',
      sheetId: SHEET_ID,
      scoreId: `avatar_${getAccountKey(user) || user.uid}_${Date.now()}`,
      uid: user.uid,
      displayName: user.displayName,
      avatar,
      avatarBg,
      gameMode: 'profile_avatar',
      testType: 'AVATAR_UPDATE',
      language: 'th',
      levelId: 'profile_avatar',
      score: 0,
      totalCharacters: 0,
      correctCharacters: 0,
      incorrectCharacters: 0,
      accuracy: 0,
      grossWpm: 0,
      netWpm: 0,
      timeTakenSeconds: 0,
      passed: false,
      rankTier: 'AvatarSync',
      createdAt: updatedAt
    },
    7000
  );

  return fallbackRes.success;
}

export async function hydrateCurrentUserAvatar(user: User | null): Promise<User | null> {
  if (!user || user.username === 'guest') return user;
  const restored = await hydrateAvatarFromIndexedDB(user);
  if (!restored) return user;

  const updated: User = {
    ...user,
    avatar: restored.avatar,
    avatarBg: restored.avatarBg || user.avatarBg || 'from-cyan-500 to-blue-600'
  };

  if (updated.avatar !== (user.avatar || '') || updated.avatarBg !== user.avatarBg) {
    try {
      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(updated));
    } catch {
      // ignore
    }
    saveLocalUser(updated);
    notifyUserDataUpdated(getAccountKey(updated));
  }
  return updated;
}

export function updateUserAvatar(avatar: string, avatarBg: string): User | null {
  const current = getCurrentUser();
  if (current) {
    const cleanAvatar = isValidAvatarData(avatar) ? avatar : '';
    const cleanBg = avatarBg || 'from-cyan-500 to-blue-600';
    const updatedAt = new Date().toISOString();

    // 1. Persist immediately into dedicated localStorage + IndexedDB Avatar Vault
    saveAvatarToVault(buildUserAvatarKeys(current), cleanAvatar, cleanBg, updatedAt);

    const updated: User = {
      ...current,
      avatar: cleanAvatar,
      avatarBg: cleanBg
    };

    try {
      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(updated));
    } catch {
      safeWriteScoresToStorage(getLocalScores());
      try {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
    saveLocalUser(updated);

    // 2. Update matching local scores safely (with automatic quota protection)
    try {
      const scores = getLocalScores();
      const updatedScores = scores.map(s => {
        if (isRecordOwnedByUser(s, updated)) {
          return { ...s, avatar: cleanAvatar, avatarBg: cleanBg };
        }
        return s;
      });
      safeWriteScoresToStorage(updatedScores);
    } catch {
      // ignore
    }

    // 3. Notify all views (Leaderboard, Navbar, Profile) in realtime
    notifyUserDataUpdated(getAccountKey(updated));

    // 4. Sync updated avatar to Google Sheets so returning on any device restores it
    syncAvatarToGoogleSheets(updated, cleanAvatar, cleanBg, updatedAt).catch(() => {});

    return updated;
  }
  return null;
}

export function getLocalScores(): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCORES_KEY);
    if (!raw) {
      // Seed default demonstrative records for the Ranking Match
      const initialSeed: ScoreRecord[] = [
        {
          scoreId: 'rank_seed_1',
          uid: 'seed_u1',
          displayName: 'พิมพ์ดี มือโปร',
          avatar: '',
          avatarBg: 'from-amber-400 to-orange-500',
          gameMode: 'ranked',
          testType: 'RANKED',
          language: 'th',
          levelId: 'ranked',
          levelTitle: 'ประลองจัดอันดับ (Ranked Arena)',
          score: 2450,
          totalCharacters: 340,
          correctCharacters: 334,
          incorrectCharacters: 6,
          accuracy: 98,
          grossWpm: 72,
          netWpm: 70,
          timeTakenSeconds: 60,
          passed: true,
          rankTier: 'Grandmaster',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          scoreId: 'rank_seed_2',
          uid: 'seed_u2',
          displayName: 'สมศรี ลมกรด',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          gameMode: 'ranked',
          testType: 'RANKED',
          language: 'th',
          levelId: 'ranked',
          levelTitle: 'ประลองจัดอันดับ (Ranked Arena)',
          score: 2180,
          totalCharacters: 310,
          correctCharacters: 302,
          incorrectCharacters: 8,
          accuracy: 97,
          grossWpm: 64,
          netWpm: 62,
          timeTakenSeconds: 60,
          passed: true,
          rankTier: 'Master',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          scoreId: 'rank_seed_3',
          uid: 'seed_u3',
          displayName: 'Alex CyberKey',
          avatar: '',
          avatarBg: 'from-purple-500 to-indigo-600',
          gameMode: 'ranked',
          testType: 'RANKED',
          language: 'en',
          levelId: 'ranked',
          levelTitle: 'Ranked Arena Showdown',
          score: 2050,
          totalCharacters: 320,
          correctCharacters: 310,
          incorrectCharacters: 10,
          accuracy: 97,
          grossWpm: 68,
          netWpm: 64,
          timeTakenSeconds: 60,
          passed: true,
          rankTier: 'Master',
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
        },
        {
          scoreId: 'rank_seed_4',
          uid: 'seed_u4',
          displayName: 'ธนากร ฝึกพิมพ์ไว',
          avatar: '',
          avatarBg: 'from-emerald-400 to-teal-600',
          gameMode: 'ranked',
          testType: 'RANKED',
          language: 'th',
          levelId: 'ranked',
          levelTitle: 'ประลองจัดอันดับ (Ranked Arena)',
          score: 1840,
          totalCharacters: 270,
          correctCharacters: 260,
          incorrectCharacters: 10,
          accuracy: 96,
          grossWpm: 56,
          netWpm: 53,
          timeTakenSeconds: 60,
          passed: true,
          rankTier: 'Diamond',
          createdAt: new Date(Date.now() - 3600000 * 14).toISOString()
        },
        {
          scoreId: 'rank_seed_5',
          uid: 'seed_u5',
          displayName: 'น้องมุก มือไว',
          avatar: '',
          avatarBg: 'from-pink-500 to-rose-600',
          gameMode: 'ranked',
          testType: 'RANKED',
          language: 'th',
          levelId: 'ranked',
          levelTitle: 'ประลองจัดอันดับ (Ranked Arena)',
          score: 1520,
          totalCharacters: 240,
          correctCharacters: 228,
          incorrectCharacters: 12,
          accuracy: 95,
          grossWpm: 48,
          netWpm: 45,
          timeTakenSeconds: 60,
          passed: true,
          rankTier: 'Platinum',
          createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
        }
      ];
      localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(initialSeed));
      return initialSeed;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalScore(score: ScoreRecord) {
  if (isAvatarSyncRecord(score)) return;
  try {
    const list = getLocalScores();
    const existsIdx = list.findIndex(s => s.scoreId === score.scoreId);
    if (existsIdx >= 0) {
      list[existsIdx] = score;
    } else {
      list.unshift(score);
    }
    safeWriteScoresToStorage(list);

    const currentUser = getCurrentUser();
    if (currentUser && isRecordOwnedByUser(score, currentUser)) {
      const accountKey = getAccountKey(currentUser);
      const saved = getAllSavedMedalProfiles()[accountKey] || null;
      const userScores = list.filter(s => isRecordOwnedByUser(s, currentUser));
      const updatedProfile = computeUserMedalProfile(currentUser, userScores, saved);
      saveLocalUserMedalProfile(updatedProfile, true);
      notifyUserDataUpdated(accountKey);
    } else {
      notifyUserDataUpdated();
    }
  } catch {
    // ignore
  }
}

export function deleteLocalScore(scoreId: string) {
  try {
    const list = getLocalScores().filter(s => s.scoreId !== scoreId);
    localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(list));
    notifyUserDataUpdated();
  } catch {
    // ignore
  }
}

export function clearStudentScores(uid: string, displayName?: string) {
  try {
    const list = getLocalScores().filter(s => {
      if (s.uid === uid) return false;
      if (displayName && s.displayName === displayName) return false;
      return true;
    });
    localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(list));

    // Also clear saved medal profile for this student
    const users = getLocalUsers();
    const targetUser = users.find(u => u.uid === uid || (displayName && u.displayName === displayName));
    if (targetUser) {
      const key = getAccountKey(targetUser);
      const medalMap = getAllSavedMedalProfiles();
      if (medalMap[key]) {
        delete medalMap[key];
        localStorage.setItem(LOCAL_STORAGE_USER_MEDALS_KEY, JSON.stringify(medalMap));
      }
      notifyUserDataUpdated(key);
    } else {
      notifyUserDataUpdated();
    }
  } catch {
    // ignore
  }
}

export async function sendToAppsScript(
  payload: Record<string, unknown>,
  timeoutMs: number = 8000,
  overrideUrl?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const targetUrl = overrideUrl || getActiveAppsScriptUrl();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const resData = await response.json();
      return { success: resData.success !== false, data: resData };
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function testAppsScriptConnection(urlToTest?: string): Promise<{
  ok: boolean;
  hasTeacherData: boolean;
  usersCount: number;
  scoresCount: number;
  message: string;
}> {
  const target = (urlToTest || getActiveAppsScriptUrl()).trim().split('?')[0];
  const res = await sendToAppsScript(
    {
      action: 'getTeacherData',
      sheetId: SHEET_ID
    },
    10000,
    target
  );

  if (res.success && res.data && Array.isArray(res.data.users)) {
    const usersCount = res.data.users.length;
    const scoresCount = Array.isArray(res.data.scores) ? res.data.scores.length : 0;
    return {
      ok: true,
      hasTeacherData: true,
      usersCount,
      scoresCount,
      message: `เชื่อมต่อ Google Sheet สำเร็จ! พบผู้ใช้ในชีต Users ทั้งหมด ${usersCount} คน และประวัติคะแนน ${scoresCount} รายการ`
    };
  }

  const rawMsg = String(res.data?.message || res.error || '');
  if (/invalid action|unknown action/i.test(rawMsg)) {
    return {
      ok: false,
      hasTeacherData: false,
      usersCount: 0,
      scoresCount: 0,
      message: 'URL นี้ยังเป็น Apps Script เวอร์ชันเก่า (ยังไม่รองรับ getTeacherData) กรุณาวางโค้ดล่าสุดแล้วเลือก Deploy → Manage deployments → แก้ไข → New version → Deploy หรือวาง URL ใหม่ที่ได้จากการ Deploy'
    };
  }

  return {
    ok: false,
    hasTeacherData: false,
    usersCount: 0,
    scoresCount: 0,
    message: `ไม่สามารถเชื่อมต่อ Web App URL นี้ได้ (${rawMsg || 'กรุณาตรวจสอบสิทธิ์ Anyone และลองใหม่'})`
  };
}

export interface StudentRegisterPayload {
  studentId: string;
  fullName: string;
  classroom?: string;
  displayName?: string;
  password: string;
  avatar?: string;
  avatarBg?: string;
  role?: 'student' | 'teacher' | 'admin';
  autoLogin?: boolean;
}

const LOCAL_STORAGE_PASSWORDS_KEY = 'touch_typing_passwords_v2';

function getLocalPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PASSWORDS_KEY);
    if (!raw) {
      return {
        'teacher': '1234',
        '66309010001': '1234',
        '66309010002': '1234'
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed['teacher']) {
      parsed['teacher'] = '1234';
    }
    return parsed;
  } catch {
    return {
      'teacher': '1234',
      '66309010001': '1234',
      '66309010002': '1234'
    };
  }
}

function saveLocalPassword(identifier: string, pass: string) {
  try {
    const map = getLocalPasswords();
    map[identifier.toLowerCase()] = pass;
    localStorage.setItem(LOCAL_STORAGE_PASSWORDS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export async function apiRegisterStudent(
  payload: StudentRegisterPayload
): Promise<{ success: boolean; user?: User; message?: string }> {
  const cleanId = payload.studentId.trim();
  const cleanFullName = payload.fullName.trim();
  const cleanDisplayName = (payload.displayName || cleanFullName.split(' ')[0] || cleanId).trim();
  const cleanClassroom = (payload.classroom || '').trim();
  const role = payload.role || 'student';

  if (!cleanId) {
    return { success: false, message: 'กรุณาระบุรหัสนักเรียนหรือรหัสผู้ใช้งาน' };
  }
  if (!cleanFullName) {
    return { success: false, message: 'กรุณาระบุชื่อ-นามสกุล' };
  }
  if (!payload.password || payload.password.length < 4) {
    return { success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
  }

  const existingUsers = getLocalUsers();
  const localPasswords = getLocalPasswords();
  const hasLocalDuplicate = existingUsers.some(u => {
    const idMatch =
      (u.studentId && u.studentId.toLowerCase() === cleanId.toLowerCase()) ||
      u.username.toLowerCase() === cleanId.toLowerCase();
    if (!idMatch) return false;
    // Only treat as blocking duplicate locally if it was registered locally with a password
    return Boolean(
      localPasswords[cleanId.toLowerCase()] ||
        localPasswords[u.username.toLowerCase()] ||
        (u.studentId ? localPasswords[u.studentId.toLowerCase()] : undefined)
    );
  });
  if (hasLocalDuplicate) {
    return { success: false, message: `รหัสผู้ใช้งาน ${cleanId} มีในระบบแล้ว กรุณาเข้าสู่ระบบ` };
  }

  const nowIso = new Date().toISOString();
  const newUser: User = {
    uid: (role === 'teacher' ? 'teacher_' : 'std_') + cleanId.toLowerCase(),
    username: cleanId.toLowerCase(),
    studentId: cleanId,
    fullName: cleanFullName,
    classroom: cleanClassroom || 'ทั่วไป',
    classroomUpdatedAt: nowIso,
    displayName: cleanDisplayName,
    avatar: payload.avatar || '',
    avatarBg: payload.avatarBg || (role === 'teacher' ? 'from-indigo-500 to-purple-600' : 'from-cyan-500 to-blue-600'),
    role,
    createdAt: nowIso
  };

  // Sync registration to Google Sheets first so account is stored reliably
  const remoteRes = await sendToAppsScript(
    {
      action: 'register',
      sheetId: SHEET_ID,
      username: cleanId,
      studentId: cleanId,
      fullName: cleanFullName,
      classroom: newUser.classroom,
      classroomUpdatedAt: nowIso,
      password: payload.password,
      displayName: cleanDisplayName,
      avatar: newUser.avatar,
      avatarBg: newUser.avatarBg,
      role,
      uid: newUser.uid
    },
    12000
  );

  // If Google Sheets explicitly rejected due to duplicate account, surface that message
  if (
    !remoteRes.success &&
    remoteRes.data &&
    remoteRes.data.success === false &&
    typeof remoteRes.data.message === 'string' &&
    (remoteRes.data.message.includes('แล้ว') ||
      remoteRes.data.message.toLowerCase().includes('exist') ||
      remoteRes.data.message.toLowerCase().includes('duplicate'))
  ) {
    return { success: false, message: remoteRes.data.message };
  }

  if (isValidAvatarData(newUser.avatar)) {
    saveAvatarToVault(buildUserAvatarKeys(newUser), newUser.avatar!, newUser.avatarBg!);
  }
  if (newUser.classroom) {
    saveClassroomToVault(newUser, newUser.classroom, nowIso);
  }
  unmarkUserDeletedLocally(newUser);
  saveLocalUser(newUser);
  saveLocalPassword(cleanId, payload.password);
  saveLocalPassword(newUser.username, payload.password);
  if (payload.autoLogin !== false) {
    setCurrentUser(newUser);
  }
  notifyUserDataUpdated(getAccountKey(newUser));

  return { success: true, user: newUser, message: 'สมัครสมาชิกสำเร็จ!' };
}

export async function apiRegisterUser(
  username: string,
  password: string,
  displayName: string,
  avatar: string = '',
  avatarBg: string = 'from-cyan-500 to-blue-600',
  studentId?: string,
  fullName?: string,
  classroom?: string
): Promise<{ success: boolean; user?: User; message?: string }> {
  return apiRegisterStudent({
    studentId: studentId || username,
    fullName: fullName || displayName || username,
    classroom: classroom || 'ปวช.3',
    displayName: displayName || username,
    password,
    avatar,
    avatarBg
  });
}

function normalizeRemoteLoginError(rawMsg?: string): string {
  const msg = String(rawMsg || '').trim();
  if (!msg) return 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid credentials') || lower.includes('invalid') || lower.includes('wrong')) {
    return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง';
  }
  if (lower.includes('not found')) {
    return 'ไม่พบข้อมูลบัญชีผู้ใช้งานใน Google Sheets กรุณาตรวจสอบรหัสหรือสมัครสมาชิกใหม่';
  }
  return msg;
}

function buildUserFromSheetLogin(raw: Record<string, any>, fallbackId: string): User {
  const cleanFallback = fallbackId.trim();
  const cleanLower = cleanFallback.toLowerCase();
  const rawUsername = String(raw.username || raw.studentId || cleanFallback).trim();
  const rawStudentId = String(raw.studentId || raw.username || cleanFallback).trim();
  const rawDisplayName = String(raw.displayName || raw.fullName || rawUsername || cleanFallback).trim();
  const rawFullName = String(raw.fullName || raw.displayName || rawUsername || cleanFallback).trim();
  const rawRole = String(raw.role || '').trim().toLowerCase();
  const remoteRole: 'student' | 'teacher' | 'admin' =
    rawRole === 'teacher' || cleanLower === 'teacher'
      ? 'teacher'
      : rawRole === 'admin' || cleanLower === 'admin'
      ? 'admin'
      : 'student';
  const rawUid = String(
    raw.uid || (remoteRole === 'teacher' ? `teacher_${cleanLower}` : `std_${cleanLower}`)
  ).trim();
  const rawClassroom = String(raw.classroom || '').trim();
  const rawCreatedAt = String(raw.createdAt || new Date().toISOString());
  const rawRoomUpdatedAt = raw.classroomUpdatedAt ? String(raw.classroomUpdatedAt) : undefined;

  return {
    uid: rawUid,
    username: rawUsername,
    studentId: rawStudentId,
    fullName: rawFullName,
    classroom: rawClassroom || 'ทั่วไป',
    classroomUpdatedAt: rawRoomUpdatedAt || (rawClassroom ? rawCreatedAt : undefined),
    displayName: rawDisplayName,
    avatar: isValidAvatarData(raw.avatar) ? String(raw.avatar) : '',
    avatarBg:
      typeof raw.avatarBg === 'string' && raw.avatarBg.includes('from-')
        ? raw.avatarBg
        : remoteRole === 'teacher'
        ? 'from-indigo-500 to-purple-600'
        : 'from-cyan-500 to-blue-600',
    role: remoteRole,
    createdAt: rawCreatedAt
  };
}

async function attemptGoogleSheetLogin(
  username: string,
  password: string,
  timeoutMs: number = 15000
): Promise<{
  reached: boolean;
  success: boolean;
  user?: Record<string, any>;
  message?: string;
}> {
  const payload = {
    action: 'login',
    sheetId: SHEET_ID,
    username,
    studentId: username,
    password
  };

  let res = await sendToAppsScript(payload, timeoutMs);
  // Retry once on transient network/abort error (common during Apps Script cold start)
  if (!res.success && !res.data) {
    res = await sendToAppsScript(payload, timeoutMs);
  }

  if (!res.data) {
    return { reached: false, success: false, message: res.error };
  }

  const candidateUser =
    res.data.user && typeof res.data.user === 'object'
      ? res.data.user
      : res.success && (res.data.uid || res.data.username || res.data.displayName)
      ? res.data
      : undefined;

  if (res.success && candidateUser) {
    return { reached: true, success: true, user: candidateUser, message: res.data.message };
  }

  return {
    reached: true,
    success: false,
    message: typeof res.data.message === 'string' ? res.data.message : undefined
  };
}

export async function apiLoginUser(
  studentIdOrUsername: string,
  password: string
): Promise<{ success: boolean; user?: User; message?: string }> {
  const rawId = studentIdOrUsername.trim();
  const cleanId = rawId.toLowerCase();
  const rawPass = password;
  const trimmedPass = password.trim();

  if (!rawId) {
    return { success: false, message: 'กรุณากรอกรหัสนักเรียนหรือรหัสครูผู้สอน' };
  }
  if (!rawPass) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' };
  }

  const localUsers = getLocalUsers();
  const localMatch = localUsers.find(
    u =>
      (u.studentId && u.studentId.trim().toLowerCase() === cleanId) ||
      u.username.trim().toLowerCase() === cleanId ||
      u.uid.trim().toLowerCase() === cleanId
  );
  const localPasswords = getLocalPasswords();
  const storedLocalPass =
    localPasswords[cleanId] ??
    (localMatch?.username ? localPasswords[localMatch.username.trim().toLowerCase()] : undefined) ??
    (localMatch?.studentId ? localPasswords[localMatch.studentId.trim().toLowerCase()] : undefined);

  const completeLocalLogin = (userToLogin: User) => {
    const resolvedMatch = applyVaultAvatarToUser(userToLogin);
    setCurrentUser(resolvedMatch);
    hydrateCurrentUserAvatar(resolvedMatch).catch(() => {});
    apiSyncUserAccountData(resolvedMatch).catch(() => {});
    return {
      success: true,
      user: resolvedMatch,
      message:
        resolvedMatch.role === 'teacher' || resolvedMatch.role === 'admin'
          ? 'เข้าสู่ระบบครูผู้สอนสำเร็จ'
          : 'เข้าสู่ระบบสำเร็จ'
    };
  };

  // Built-in local teacher/admin fast-path when matching stored teacher password
  if (
    (cleanId === 'teacher' || cleanId === 'admin') &&
    localMatch &&
    (localMatch.role === 'teacher' || localMatch.role === 'admin') &&
    (storedLocalPass !== undefined ? storedLocalPass === rawPass : rawPass === '1234')
  ) {
    return completeLocalLogin(localMatch);
  }

  // Primary authentication directly against Google Sheets (Users sheet)
  const attempts: Array<{ u: string; p: string }> = [{ u: rawId, p: rawPass }];
  const pushUniqueAttempt = (u: string, p: string) => {
    if (!u || !p) return;
    if (!attempts.some(a => a.u === u && a.p === p)) {
      attempts.push({ u, p });
    }
  };

  if (cleanId !== rawId) {
    pushUniqueAttempt(cleanId, rawPass);
  }
  if (trimmedPass !== rawPass) {
    pushUniqueAttempt(rawId, trimmedPass);
    if (cleanId !== rawId) pushUniqueAttempt(cleanId, trimmedPass);
  }
  // Google Sheets strips leading zeros from numeric cells (e.g. phone/birthday passwords like 0812345678 -> 812345678)
  if (/^0+\d+$/.test(trimmedPass)) {
    const noZeroPass = trimmedPass.replace(/^0+/, '');
    if (noZeroPass) {
      pushUniqueAttempt(rawId, noZeroPass);
      if (cleanId !== rawId) pushUniqueAttempt(cleanId, noZeroPass);
    }
  }
  if (/^0+\d+$/.test(rawId)) {
    const noZeroId = rawId.replace(/^0+/, '');
    if (noZeroId) {
      pushUniqueAttempt(noZeroId, trimmedPass);
      if (/^0+\d+$/.test(trimmedPass)) {
        const noZeroPass = trimmedPass.replace(/^0+/, '');
        if (noZeroPass) pushUniqueAttempt(noZeroId, noZeroPass);
      }
    }
  }

  let sheetReached = false;
  let lastSheetMessage: string | undefined;

  for (const candidate of attempts) {
    const sheetResult = await attemptGoogleSheetLogin(candidate.u, candidate.p, 15000);
    if (!sheetResult.reached) {
      // Stop further retries if Google Sheets is completely unreachable
      break;
    }
    sheetReached = true;
    lastSheetMessage = sheetResult.message;

    if (sheetResult.success && sheetResult.user) {
      const remoteUserRaw = buildUserFromSheetLogin(sheetResult.user, rawId);

      // Reconcile avatar with persistent vault
      if (isValidAvatarData(remoteUserRaw.avatar) && !getSavedAvatarForUser(remoteUserRaw)) {
        saveAvatarToVault(
          buildUserAvatarKeys(remoteUserRaw),
          remoteUserRaw.avatar!,
          remoteUserRaw.avatarBg!
        );
      }
      // Reconcile classroom from Google Sheets if vault does not have a newer entry
      if (remoteUserRaw.classroom && remoteUserRaw.classroom !== 'ทั่วไป') {
        const existingRoom = getSavedClassroomForUser(remoteUserRaw);
        const remoteRoomTs = remoteUserRaw.classroomUpdatedAt
          ? new Date(remoteUserRaw.classroomUpdatedAt).getTime()
          : 0;
        const vaultRoomTs = existingRoom?.updatedAt
          ? new Date(existingRoom.updatedAt).getTime()
          : 0;
        if (!existingRoom || remoteRoomTs > vaultRoomTs) {
          saveClassroomToVault(
            remoteUserRaw,
            remoteUserRaw.classroom,
            remoteUserRaw.classroomUpdatedAt || remoteUserRaw.createdAt || new Date().toISOString()
          );
        }
      }

      const remoteUser = applyVaultAvatarToUser(remoteUserRaw);
      saveLocalUser(remoteUser);
      saveLocalPassword(rawId, rawPass);
      saveLocalPassword(cleanId, rawPass);
      saveLocalPassword(remoteUser.username, rawPass);
      if (remoteUser.studentId) {
        saveLocalPassword(remoteUser.studentId, rawPass);
      }
      setCurrentUser(remoteUser);
      hydrateCurrentUserAvatar(remoteUser).catch(() => {});
      apiSyncUserAccountData(remoteUser).catch(() => {});

      return {
        success: true,
        user: remoteUser,
        message:
          remoteUser.role === 'teacher' || remoteUser.role === 'admin'
            ? 'เข้าสู่ระบบครูผู้สอนสำเร็จ'
            : 'เข้าสู่ระบบสำเร็จ'
      };
    }
  }

  // Secondary fallback: ONLY allow local login when an explicit matching password was saved locally
  // (e.g., offline mode, built-in demo accounts, or account registered while offline)
  if (
    localMatch &&
    storedLocalPass !== undefined &&
    (storedLocalPass === rawPass || storedLocalPass === trimmedPass)
  ) {
    // If Sheet was reachable yet didn't have this locally-registered student account, sync it to Google Sheets
    const isSeedAccount =
      cleanId === 'teacher' ||
      cleanId === 'admin' ||
      cleanId === '66309010001' ||
      cleanId === '66309010002';
    if (sheetReached && !isSeedAccount) {
      sendToAppsScript(
        {
          action: 'register',
          sheetId: SHEET_ID,
          uid: localMatch.uid,
          username: localMatch.studentId || localMatch.username,
          studentId: localMatch.studentId || localMatch.username,
          password: storedLocalPass,
          displayName: localMatch.displayName,
          fullName: localMatch.fullName || localMatch.displayName,
          classroom: localMatch.classroom || 'ทั่วไป',
          classroomUpdatedAt: localMatch.classroomUpdatedAt || localMatch.createdAt || new Date().toISOString(),
          avatar: localMatch.avatar || '',
          avatarBg: localMatch.avatarBg || 'from-cyan-500 to-blue-600',
          role: localMatch.role || 'student'
        },
        10000
      ).catch(() => {});
    }
    return completeLocalLogin(localMatch);
  }

  if (!sheetReached) {
    return {
      success: false,
      message: 'ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'
    };
  }

  return {
    success: false,
    message: normalizeRemoteLoginError(lastSheetMessage)
  };
}

export async function apiSyncUserMedalsToSheet(
  user: User,
  profile: UserMedalProfile
): Promise<{ success: boolean; error?: string }> {
  if (!user || user.username === 'guest') return { success: false, error: 'Guest user' };
  const result = await sendToAppsScript(
    {
      action: 'saveUserMedals',
      sheetId: SHEET_ID,
      ...profile
    },
    6000
  );
  return { success: result.success, error: result.error };
}

async function syncClassroomToGoogleSheets(
  user: User,
  classroom: string,
  updatedAt: string,
  medalProfile?: UserMedalProfile | null
): Promise<boolean> {
  if (!user || user.username === 'guest' || user.uid === 'guest_default') return false;
  const cleanRoom = classroom.trim() || 'ทั่วไป';

  const updatePromise = sendToAppsScript(
    {
      action: 'updateClassroom',
      sheetId: SHEET_ID,
      uid: user.uid,
      username: user.username,
      studentId: user.studentId || user.username,
      displayName: user.displayName,
      fullName: user.fullName || user.displayName,
      avatar: user.avatar || '',
      avatarBg: user.avatarBg || 'from-cyan-500 to-blue-600',
      classroom: cleanRoom,
      updatedAt
    },
    7000
  );

  const medalToSync =
    medalProfile ||
    getUserMedalProfile({ ...user, classroom: cleanRoom, classroomUpdatedAt: updatedAt });

  const medalPromise = medalToSync
    ? apiSyncUserMedalsToSheet(
        { ...user, classroom: cleanRoom, classroomUpdatedAt: updatedAt },
        { ...medalToSync, classroom: cleanRoom, updatedAt }
      )
    : Promise.resolve({ success: false });

  const [updateRes, medalRes] = await Promise.all([updatePromise, medalPromise]);

  if (updateRes.success) {
    return true;
  }

  // Graceful fallback for older deployed Google Apps Scripts:
  // store a silent CLASSROOM_UPDATE checkpoint via saveScore so TeacherDashboard across devices
  // still receives the student's latest classroom selection in realtime.
  const fallbackRes = await sendToAppsScript(
    {
      action: 'saveScore',
      sheetId: SHEET_ID,
      scoreId: `classroom_${getAccountKey(user) || user.uid}_${Date.now()}`,
      uid: user.uid,
      studentId: user.studentId || user.username,
      displayName: user.displayName,
      classroom: cleanRoom,
      avatar: user.avatar || '',
      avatarBg: user.avatarBg || 'from-cyan-500 to-blue-600',
      gameMode: 'profile_classroom',
      testType: 'CLASSROOM_UPDATE',
      language: 'th',
      levelId: cleanRoom,
      score: 0,
      totalCharacters: 0,
      correctCharacters: 0,
      incorrectCharacters: 0,
      accuracy: 0,
      grossWpm: 0,
      netWpm: 0,
      timeTakenSeconds: 0,
      passed: false,
      rankTier: cleanRoom,
      createdAt: updatedAt
    },
    7000
  );

  return Boolean(updateRes.success || medalRes.success || fallbackRes.success);
}

export async function apiSyncUserAccountData(
  user: User
): Promise<{ success: boolean; syncedFromSheet: boolean; medalProfile: UserMedalProfile | null; scoresCount: number; updatedUser?: User }> {
  if (!user || user.username === 'guest') {
    return { success: false, syncedFromSheet: false, medalProfile: null, scoresCount: 0 };
  }

  // 0. Ensure IndexedDB backup is hydrated first
  let hydratedUser = (await hydrateCurrentUserAvatar(user)) || user;
  const accountKey = getAccountKey(hydratedUser);
  let remoteScores: ScoreRecord[] = [];
  let remoteMedalProfile: UserMedalProfile | null = null;
  let remotePrePostComparison: PrePostComparisonRecord | null = null;
  let syncedFromSheet = false;
  let remoteUserAvatar = '';
  let remoteUserBg = '';
  let remoteUserClassroom = '';
  let remoteUserClassroomUpdatedAt = '';

  // 1. Try dedicated per-user endpoint (scores + UserMedals + PrePostTests + Users avatar & classroom)
  const userDataRes = await sendToAppsScript(
    {
      action: 'getUserData',
      sheetId: SHEET_ID,
      accountKey,
      uid: hydratedUser.uid,
      studentId: hydratedUser.studentId || hydratedUser.username,
      displayName: hydratedUser.displayName
    },
    5000
  );

  if (
    userDataRes.success &&
    userDataRes.data &&
    (Array.isArray(userDataRes.data.scores) ||
      userDataRes.data.medalProfile ||
      userDataRes.data.prePostComparison ||
      userDataRes.data.userAvatar ||
      userDataRes.data.userClassroom)
  ) {
    syncedFromSheet = true;
    if (Array.isArray(userDataRes.data.scores)) {
      remoteScores = userDataRes.data.scores.map(normalizeRemoteScoreRecord);
    }
    if (userDataRes.data.medalProfile) {
      remoteMedalProfile = userDataRes.data.medalProfile;
    }
    if (userDataRes.data.prePostComparison) {
      remotePrePostComparison = userDataRes.data.prePostComparison;
    }
    remoteUserAvatar = isValidAvatarData(userDataRes.data.userAvatar) ? String(userDataRes.data.userAvatar) : '';
    remoteUserBg = sanitizeAvatarBg(userDataRes.data.userAvatarBg);
    remoteUserClassroom = String(userDataRes.data.userClassroom || '').trim();
    remoteUserClassroomUpdatedAt = String(userDataRes.data.userClassroomUpdatedAt || '');
  } else {
    // 2. Graceful fallback to getLeaderboard so older Apps Script deployments still restore user records, avatars & classrooms
    const lbRes = await sendToAppsScript(
      {
        action: 'getLeaderboard',
        sheetId: SHEET_ID
      },
      4500
    );
    if (lbRes.success && lbRes.data && Array.isArray(lbRes.data.scores)) {
      syncedFromSheet = true;
      remoteScores = lbRes.data.scores
        .map(normalizeRemoteScoreRecord)
        .filter((s: ScoreRecord) => isRecordOwnedByUser(s, hydratedUser));
    }
  }

  // Reconcile latest profile picture between local Vault and Google Sheets (including AVATAR_UPDATE checkpoints)
  const localVaultEntry = getSavedAvatarForUser(hydratedUser);
  const localVaultTime = localVaultEntry?.updatedAt ? new Date(localVaultEntry.updatedAt).getTime() : 0;

  const remoteAvatarCandidates = remoteScores
    .filter(s => isValidAvatarData(s.avatar))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  let bestRemoteAvatar = '';
  let bestRemoteBg = '';
  let bestRemoteTime = 0;

  if (remoteAvatarCandidates.length > 0) {
    bestRemoteAvatar = remoteAvatarCandidates[0].avatar!;
    bestRemoteBg = remoteAvatarCandidates[0].avatarBg || hydratedUser.avatarBg || 'from-cyan-500 to-blue-600';
    bestRemoteTime = new Date(remoteAvatarCandidates[0].createdAt || 0).getTime();
  }
  if (isValidAvatarData(remoteUserAvatar) && (!bestRemoteAvatar || bestRemoteTime === 0)) {
    bestRemoteAvatar = remoteUserAvatar;
    bestRemoteBg = remoteUserBg || bestRemoteBg || hydratedUser.avatarBg || 'from-cyan-500 to-blue-600';
  }

  if (bestRemoteAvatar) {
    const shouldAdoptRemote =
      !localVaultEntry ||
      (!localVaultEntry.avatar && bestRemoteTime >= localVaultTime) ||
      (bestRemoteTime > localVaultTime + 1500);

    if (shouldAdoptRemote) {
      saveAvatarToVault(
        buildUserAvatarKeys(hydratedUser),
        bestRemoteAvatar,
        bestRemoteBg || hydratedUser.avatarBg || 'from-cyan-500 to-blue-600',
        bestRemoteTime > 0 ? new Date(bestRemoteTime).toISOString() : new Date().toISOString()
      );
      hydratedUser = {
        ...hydratedUser,
        avatar: bestRemoteAvatar,
        avatarBg: bestRemoteBg || hydratedUser.avatarBg || 'from-cyan-500 to-blue-600'
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(hydratedUser));
      } catch {
        // ignore
      }
      saveLocalUser(hydratedUser);
    } else if (
      syncedFromSheet &&
      localVaultEntry &&
      isValidAvatarData(localVaultEntry.avatar) &&
      localVaultTime > bestRemoteTime + 1500
    ) {
      // Local has a newer changed photo -> push to Google Sheets so it stays synced across devices
      syncAvatarToGoogleSheets(
        hydratedUser,
        localVaultEntry.avatar,
        localVaultEntry.avatarBg,
        localVaultEntry.updatedAt
      ).catch(() => {});
    }
  } else if (syncedFromSheet && localVaultEntry && isValidAvatarData(localVaultEntry.avatar)) {
    // Remote has no photo yet, but user already saved one locally -> push to Google Sheets
    syncAvatarToGoogleSheets(
      hydratedUser,
      localVaultEntry.avatar,
      localVaultEntry.avatarBg,
      localVaultEntry.updatedAt
    ).catch(() => {});
  }

  // Reconcile latest classroom between local Classroom Vault and Google Sheets (Users / UserMedals / Scores)
  const localRoomVault = getSavedClassroomForUser(hydratedUser);
  const localRoomStr = (localRoomVault?.classroom || hydratedUser.classroom || '').trim();
  const localRoomTime = localRoomVault?.updatedAt
    ? new Date(localRoomVault.updatedAt).getTime()
    : hydratedUser.classroomUpdatedAt
    ? new Date(hydratedUser.classroomUpdatedAt).getTime()
    : 0;

  let bestRemoteRoom = '';
  let bestRemoteRoomTime = 0;
  const considerRemoteRoom = (roomRaw?: string, tsRaw?: string) => {
    const clean = String(roomRaw || '').trim();
    if (!clean) return;
    const ts = tsRaw ? new Date(tsRaw).getTime() : 0;
    const validTs = Number.isNaN(ts) ? 0 : ts;
    if (!bestRemoteRoom || validTs >= bestRemoteRoomTime) {
      bestRemoteRoom = clean;
      bestRemoteRoomTime = validTs;
    }
  };
  considerRemoteRoom(remoteUserClassroom, remoteUserClassroomUpdatedAt);
  if (remoteMedalProfile?.classroom) {
    considerRemoteRoom(remoteMedalProfile.classroom, remoteMedalProfile.updatedAt);
  }
  remoteScores.forEach(rs => {
    const rRoom = extractClassroomFromScore(rs);
    if (rRoom) considerRemoteRoom(rRoom, rs.createdAt);
  });

  if (bestRemoteRoom) {
    const shouldAdoptRemoteRoom =
      !localRoomStr ||
      bestRemoteRoomTime > localRoomTime + 1500 ||
      (localRoomStr === 'ทั่วไป' && bestRemoteRoom !== 'ทั่วไป' && localRoomTime === 0);

    if (shouldAdoptRemoteRoom && bestRemoteRoom !== hydratedUser.classroom) {
      const adoptedIso = bestRemoteRoomTime > 0 ? new Date(bestRemoteRoomTime).toISOString() : new Date().toISOString();
      saveClassroomToVault(hydratedUser, bestRemoteRoom, adoptedIso);
      hydratedUser = {
        ...hydratedUser,
        classroom: bestRemoteRoom,
        classroomUpdatedAt: adoptedIso
      };
      try {
        const cur = getCurrentUser();
        if (cur && getAccountKey(cur) === accountKey) {
          localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify({ ...cur, classroom: bestRemoteRoom, classroomUpdatedAt: adoptedIso }));
        }
      } catch {
        // ignore
      }
      saveLocalUser(hydratedUser);
    } else if (
      syncedFromSheet &&
      localRoomStr &&
      localRoomStr !== bestRemoteRoom &&
      localRoomTime > bestRemoteRoomTime + 1500
    ) {
      syncClassroomToGoogleSheets(
        hydratedUser,
        localRoomStr,
        localRoomVault?.updatedAt || hydratedUser.classroomUpdatedAt || new Date().toISOString()
      ).catch(() => {});
    }
  } else if (syncedFromSheet && localRoomStr) {
    syncClassroomToGoogleSheets(
      hydratedUser,
      localRoomStr,
      localRoomVault?.updatedAt || hydratedUser.classroomUpdatedAt || new Date().toISOString()
    ).catch(() => {});
  }

  // Merge real remote scores into local score store (excluding AVATAR_UPDATE / CLASSROOM_UPDATE checkpoint rows)
  const realRemoteScores = remoteScores.filter(rs => !isAvatarSyncRecord(rs));
  const localScores = getLocalScores();
  const mergedMap = new Map<string, ScoreRecord>();
  localScores.forEach(s => {
    if (s?.scoreId && !isAvatarSyncRecord(s)) mergedMap.set(s.scoreId, s);
  });
  let addedRemote = 0;
  realRemoteScores.forEach(rs => {
    if (!rs || !rs.scoreId) return;
    if (!mergedMap.has(rs.scoreId)) {
      mergedMap.set(rs.scoreId, rs);
      addedRemote++;
    }
  });

  const mergedAll = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (addedRemote > 0) {
    safeWriteScoresToStorage(mergedAll);
  }

  const userScores = mergedAll.filter(s => isRecordOwnedByUser(s, hydratedUser));
  const localSavedProfile = getAllSavedMedalProfiles()[accountKey] || null;

  // Union local saved medals + remote saved medals + recomputed medals from all scores
  const baseProfile = localSavedProfile && remoteMedalProfile
    ? computeUserMedalProfile(hydratedUser, userScores, {
        ...remoteMedalProfile,
        classroom: hydratedUser.classroom || remoteMedalProfile.classroom || localSavedProfile.classroom || 'ทั่วไป',
        hasPretest: Boolean(localSavedProfile.hasPretest || remoteMedalProfile.hasPretest),
        hasLesson: Boolean(localSavedProfile.hasLesson || remoteMedalProfile.hasLesson),
        hasPosttest: Boolean(localSavedProfile.hasPosttest || remoteMedalProfile.hasPosttest),
        passedLevels: Array.from(
          new Set([...(localSavedProfile.passedLevels || []), ...(remoteMedalProfile.passedLevels || [])])
        ).sort((a, b) => a - b),
        hasAll10Levels: Boolean(localSavedProfile.hasAll10Levels || remoteMedalProfile.hasAll10Levels),
        isGrandComplete: Boolean(localSavedProfile.isGrandComplete || remoteMedalProfile.isGrandComplete),
        achievementIds: Array.from(
          new Set([...(localSavedProfile.achievementIds || []), ...(remoteMedalProfile.achievementIds || [])])
        ),
        earnedMedals: [
          ...(remoteMedalProfile.earnedMedals || []),
          ...(localSavedProfile.earnedMedals || [])
        ],
        bestScore: Math.max(localSavedProfile.bestScore || 0, remoteMedalProfile.bestScore || 0),
        bestWpm: Math.max(localSavedProfile.bestWpm || 0, remoteMedalProfile.bestWpm || 0),
        bestAccuracy: Math.max(localSavedProfile.bestAccuracy || 0, remoteMedalProfile.bestAccuracy || 0)
      })
    : computeUserMedalProfile(hydratedUser, userScores, remoteMedalProfile || localSavedProfile);

  saveLocalUserMedalProfile(baseProfile, true);

  // Merge and persist Pre-Test / Post-Test comparison record from Google Sheets + local scores
  const localSavedPrePost = getAllSavedPrePostMap()[accountKey] || null;
  const mergedPrePostBase = localSavedPrePost && remotePrePostComparison
    ? computePrePostComparison(
        hydratedUser,
        userScores,
        {
          ...remotePrePostComparison,
          pretestQuizScore: localSavedPrePost.pretestQuizScore ?? remotePrePostComparison.pretestQuizScore,
          pretestQuizPercent: localSavedPrePost.pretestQuizPercent ?? remotePrePostComparison.pretestQuizPercent,
          pretestQuizDate: localSavedPrePost.pretestQuizDate || remotePrePostComparison.pretestQuizDate,
          posttestQuizScore: localSavedPrePost.posttestQuizScore ?? remotePrePostComparison.posttestQuizScore,
          posttestQuizPercent: localSavedPrePost.posttestQuizPercent ?? remotePrePostComparison.posttestQuizPercent,
          posttestQuizDate: localSavedPrePost.posttestQuizDate || remotePrePostComparison.posttestQuizDate,
          pretestTypingWpm: localSavedPrePost.pretestTypingWpm ?? remotePrePostComparison.pretestTypingWpm,
          pretestTypingAccuracy: localSavedPrePost.pretestTypingAccuracy ?? remotePrePostComparison.pretestTypingAccuracy,
          pretestTypingDate: localSavedPrePost.pretestTypingDate || remotePrePostComparison.pretestTypingDate,
          posttestTypingWpm: localSavedPrePost.posttestTypingWpm ?? remotePrePostComparison.posttestTypingWpm,
          posttestTypingAccuracy: localSavedPrePost.posttestTypingAccuracy ?? remotePrePostComparison.posttestTypingAccuracy,
          posttestTypingDate: localSavedPrePost.posttestTypingDate || remotePrePostComparison.posttestTypingDate
        }
      )
    : computePrePostComparison(hydratedUser, userScores, remotePrePostComparison || localSavedPrePost);

  const hasAnyPrePost =
    mergedPrePostBase.pretestQuizScore !== null ||
    mergedPrePostBase.posttestQuizScore !== null ||
    mergedPrePostBase.pretestTypingWpm !== null ||
    mergedPrePostBase.posttestTypingWpm !== null;
  if (hasAnyPrePost) {
    saveLocalPrePostComparison(mergedPrePostBase, true);
    if (
      syncedFromSheet &&
      (!remotePrePostComparison ||
        remotePrePostComparison.pretestQuizScore !== mergedPrePostBase.pretestQuizScore ||
        remotePrePostComparison.posttestQuizScore !== mergedPrePostBase.posttestQuizScore ||
        remotePrePostComparison.pretestTypingWpm !== mergedPrePostBase.pretestTypingWpm ||
        remotePrePostComparison.posttestTypingWpm !== mergedPrePostBase.posttestTypingWpm ||
        remotePrePostComparison.classroom !== mergedPrePostBase.classroom)
    ) {
      apiSyncPrePostToSheet(hydratedUser, mergedPrePostBase).catch(() => {});
    }
  }

  notifyUserDataUpdated(accountKey);

  // If local has more medals or a newer classroom than remote, push updated medals back to Google Sheets
  if (
    syncedFromSheet &&
    (!remoteMedalProfile ||
      baseProfile.totalMedalsCount > (remoteMedalProfile.totalMedalsCount || 0) ||
      (hydratedUser.classroom && remoteMedalProfile.classroom !== hydratedUser.classroom))
  ) {
    apiSyncUserMedalsToSheet(hydratedUser, baseProfile).catch(() => {});
  }

  return {
    success: true,
    syncedFromSheet,
    medalProfile: baseProfile,
    scoresCount: userScores.length,
    updatedUser: hydratedUser
  };
}

export async function apiSaveScore(score: ScoreRecord): Promise<{ success: boolean; message: string }> {
  const currentUser = getCurrentUser();
  const isOwner = Boolean(currentUser && isRecordOwnedByUser(score, currentUser));
  const resolvedClassroom =
    score.classroom || (isOwner ? currentUser?.classroom : '') || '';
  const scoreToSave: ScoreRecord = isOwner && currentUser
    ? {
        ...score,
        classroom: resolvedClassroom,
        avatar: score.avatar || currentUser.avatar || '',
        avatarBg: score.avatarBg || currentUser.avatarBg || 'from-cyan-500 to-blue-600'
      }
    : { ...score, classroom: resolvedClassroom };

  saveLocalScore(scoreToSave);

  const updatedProfile = isOwner && currentUser
    ? getUserMedalProfile(currentUser)
    : null;

  const isPreOrPost =
    scoreToSave.gameMode === 'pretest' ||
    scoreToSave.gameMode === 'posttest' ||
    scoreToSave.testType === 'PRE_TEST' ||
    scoreToSave.testType === 'POST_TEST';

  let updatedPrePost: PrePostComparisonRecord | null = null;
  if (isPreOrPost && isOwner && currentUser) {
    updatedPrePost = getUserPrePostComparison(currentUser);
    if (updatedPrePost) {
      saveLocalPrePostComparison(updatedPrePost, false);
    }
  }

  const scorePromise = sendToAppsScript({
    action: 'saveScore',
    sheetId: SHEET_ID,
    ...scoreToSave,
    classroom: resolvedClassroom,
    fullName: isOwner && currentUser ? currentUser.fullName || currentUser.displayName : scoreToSave.displayName,
    studentId: isOwner && currentUser ? currentUser.studentId || currentUser.username : '',
    earnedMedalsCount: updatedProfile?.totalMedalsCount ?? 0,
    earnedMedalsList: updatedProfile?.earnedMedals.map(m => m.title).join(' | ') || ''
  });

  const medalPromise =
    currentUser && updatedProfile
      ? apiSyncUserMedalsToSheet(currentUser, updatedProfile)
      : Promise.resolve({ success: false });

  const prePostPromise =
    currentUser && updatedPrePost
      ? apiSyncPrePostToSheet(currentUser, updatedPrePost)
      : Promise.resolve({ success: false });

  const [result] = await Promise.all([scorePromise, medalPromise, prePostPromise]);

  if (result.success) {
    return { success: true, message: 'บันทึกคะแนนและเหรียญตราลง Google Sheets สำเร็จเรียบร้อย!' };
  } else {
    return {
      success: true,
      message: 'บันทึกคะแนนและเหรียญตราในเครื่องเรียบร้อยแล้ว (จะซิงค์กับ Google Sheets อัตโนมัติเมื่อออนไลน์)'
    };
  }
}

function enrichScoresWithUserAvatars(scores: ScoreRecord[]): ScoreRecord[] {
  const localUsers = getLocalUsers();
  const currentUser = getCurrentUser();
  const userList: User[] = currentUser
    ? [currentUser, ...localUsers.filter(u => u.uid !== currentUser.uid)]
    : localUsers;

  // Build latest-avatar lookup from ALL score rows (including AVATAR_UPDATE checkpoints, newest first)
  // so older high scores automatically inherit any newer uploaded profile photo from the same player.
  const latestScoreAvatarByKey = new Map<string, { avatar: string; avatarBg: string; ts: number }>();
  const newestFirst = [...scores].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  for (const s of newestFirst) {
    if (!isValidAvatarData(s.avatar)) continue;
    const ts = new Date(s.createdAt || 0).getTime();
    const entry = {
      avatar: s.avatar!,
      avatarBg: s.avatarBg || 'from-cyan-500 to-blue-600',
      ts
    };
    const uidKey = String(s.uid || '').trim().toLowerCase();
    const nameKey = s.displayName ? `name:${s.displayName.trim().toLowerCase()}` : '';
    if (uidKey && uidKey !== 'guest' && uidKey !== 'guest_default' && !latestScoreAvatarByKey.has(uidKey)) {
      latestScoreAvatarByKey.set(uidKey, entry);
    }
    if (nameKey && !latestScoreAvatarByKey.has(nameKey)) {
      latestScoreAvatarByKey.set(nameKey, entry);
    }
  }

  return scores
    .filter(score => !isAvatarSyncRecord(score))
    .map(score => {
      const uidKey = String(score.uid || '').trim().toLowerCase();
      const nameKey = score.displayName ? `name:${score.displayName.trim().toLowerCase()}` : '';

      const matchedUser = userList.find(u => isRecordOwnedByUser(score, u));
      const vaultEntry = getSavedAvatarForScore(score);
      const latestFromScores =
        (uidKey && uidKey !== 'guest' && uidKey !== 'guest_default' ? latestScoreAvatarByKey.get(uidKey) : undefined) ||
        (nameKey ? latestScoreAvatarByKey.get(nameKey) : undefined);

      const vaultTime = vaultEntry?.updatedAt ? new Date(vaultEntry.updatedAt).getTime() : 0;
      const remoteScoreTime = latestFromScores?.ts || 0;

      let resolvedAvatar = '';
      let resolvedBg = score.avatarBg || 'from-cyan-500 to-blue-600';

      if (
        latestFromScores &&
        isValidAvatarData(latestFromScores.avatar) &&
        remoteScoreTime > vaultTime + 1500
      ) {
        resolvedAvatar = latestFromScores.avatar;
        resolvedBg = latestFromScores.avatarBg || resolvedBg;
      } else if (vaultEntry && isValidAvatarData(vaultEntry.avatar)) {
        resolvedAvatar = vaultEntry.avatar;
        resolvedBg = vaultEntry.avatarBg || resolvedBg;
      } else if (vaultEntry && vaultEntry.avatar === '' && vaultTime >= remoteScoreTime) {
        // User explicitly reset to default illustrated avatar more recently than old score rows
        resolvedAvatar = '';
        resolvedBg = vaultEntry.avatarBg || resolvedBg;
      } else if (matchedUser && isValidAvatarData(matchedUser.avatar)) {
        resolvedAvatar = matchedUser.avatar!;
        resolvedBg = matchedUser.avatarBg || resolvedBg;
      } else if (latestFromScores && isValidAvatarData(latestFromScores.avatar)) {
        resolvedAvatar = latestFromScores.avatar;
        resolvedBg = latestFromScores.avatarBg || resolvedBg;
      } else if (isValidAvatarData(score.avatar)) {
        resolvedAvatar = score.avatar!;
      }

      return {
        ...score,
        avatar: resolvedAvatar,
        avatarBg: resolvedBg
      };
    });
}

export async function apiFetchLeaderboard(): Promise<ScoreRecord[]> {
  const deletedKeys = getDeletedUserKeysSet();
  const isRealValidScore = (s: ScoreRecord) =>
    Boolean(s) &&
    !String(s.uid || '').startsWith('seed_') &&
    !isAvatarSyncRecord(s) &&
    !(deletedKeys.size > 0 && isTargetDeleted(deletedKeys, { uid: s.uid }));

  try {
    const res = await sendToAppsScript({
      action: 'getLeaderboard',
      sheetId: SHEET_ID
    });

    if (res.success && res.data && Array.isArray(res.data.scores)) {
      const localReal = getLocalScores().filter(isRealValidScore);
      const combined: ScoreRecord[] = res.data.scores
        .map(normalizeRemoteScoreRecord)
        .filter(isRealValidScore);
      localReal.forEach(l => {
        if (!combined.some(c => c.scoreId === l.scoreId)) {
          combined.push(l);
        }
      });
      const enriched = enrichScoresWithUserAvatars(combined);
      enriched.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm);
      return enriched;
    }
  } catch {
    // fallback
  }

  return enrichScoresWithUserAvatars(getLocalScores().filter(isRealValidScore)).sort(
    (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
  );
}

export function updateStudentClassroom(
  studentUid: string,
  newClassroom: string,
  studentId?: string,
  studentInfo?: Partial<User>
): User | null {
  const cleanRoom = newClassroom.trim() || 'ทั่วไป';
  const updatedAt = new Date().toISOString();
  const users = getLocalUsers();
  const targetUid = studentUid.trim().toLowerCase();
  const targetSid = String(studentId || studentInfo?.studentId || studentInfo?.username || '').trim().toLowerCase();

  let updatedUser: User | null = null;
  const nextUsers = users.map(u => {
    const matches =
      u.uid.toLowerCase() === targetUid ||
      (targetSid &&
        (String(u.studentId || '').toLowerCase() === targetSid ||
          String(u.username || '').toLowerCase() === targetSid));
    if (matches) {
      updatedUser = { ...u, classroom: cleanRoom, classroomUpdatedAt: updatedAt };
      return updatedUser;
    }
    return u;
  });

  if (!updatedUser && studentInfo) {
    updatedUser = {
      uid: studentUid || `std_${targetSid || Date.now()}`,
      username: studentInfo.username || targetSid || studentUid,
      studentId: studentInfo.studentId || studentId || studentInfo.username || studentUid,
      fullName: studentInfo.fullName || studentInfo.displayName || studentId || studentUid,
      displayName: studentInfo.displayName || studentInfo.fullName || studentId || studentUid,
      classroom: cleanRoom,
      classroomUpdatedAt: updatedAt,
      role: studentInfo.role || 'student',
      avatar: studentInfo.avatar || '',
      avatarBg: studentInfo.avatarBg || 'from-cyan-500 to-blue-600',
      createdAt: studentInfo.createdAt || updatedAt
    };
    nextUsers.push(updatedUser);
  }

  if (updatedUser) {
    saveClassroomToVault(updatedUser, cleanRoom, updatedAt);

    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(nextUsers));
    } catch {
      // ignore
    }

    // Update currentUser session immediately if the updated student is logged in
    const current = getCurrentUser();
    if (
      current &&
      (current.uid.toLowerCase() === targetUid ||
        (targetSid &&
          (String(current.studentId || '').toLowerCase() === targetSid ||
            String(current.username || '').toLowerCase() === targetSid)))
    ) {
      const nextCurrent: User = {
        ...current,
        classroom: cleanRoom,
        classroomUpdatedAt: updatedAt
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(nextCurrent));
      } catch {
        // ignore
      }
      updatedUser = nextCurrent;
    }

    // Update local scores owned by this student with latest classroom
    try {
      const scores = getLocalScores();
      let changedScores = false;
      const nextScores = scores.map(s => {
        if (isRecordOwnedByUser(s, updatedUser)) {
          if (s.classroom !== cleanRoom) {
            changedScores = true;
            return { ...s, classroom: cleanRoom };
          }
        }
        return s;
      });
      if (changedScores) {
        safeWriteScoresToStorage(nextScores);
      }
    } catch {
      // ignore
    }

    // Also update or compute saved medal profile with the new classroom
    const key = getAccountKey(updatedUser);
    const medalMap = getAllSavedMedalProfiles();
    let updatedMedal: UserMedalProfile | null = null;
    if (key) {
      const existingMedal = medalMap[key];
      if (existingMedal) {
        updatedMedal = { ...existingMedal, classroom: cleanRoom, updatedAt };
      } else {
        const userScores = getLocalScores().filter(s => isRecordOwnedByUser(s, updatedUser));
        updatedMedal = computeUserMedalProfile(updatedUser, userScores, null);
        updatedMedal = { ...updatedMedal, classroom: cleanRoom, updatedAt };
      }
      medalMap[key] = updatedMedal;
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_MEDALS_KEY, JSON.stringify(medalMap));
      } catch {
        // ignore
      }
    }

    notifyUserDataUpdated(key);

    syncClassroomToGoogleSheets(updatedUser, cleanRoom, updatedAt, updatedMedal).catch(() => {});
  }

  return updatedUser;
}

export async function apiUpdateStudentClassroom(
  user: User,
  newClassroom: string
): Promise<{ success: boolean; syncedToSheet: boolean; user: User }> {
  const cleanRoom = newClassroom.trim() || 'ทั่วไป';
  const updatedAt = new Date().toISOString();
  const updatedLocal =
    updateStudentClassroom(user.uid, cleanRoom, user.studentId || user.username, user) || {
      ...user,
      classroom: cleanRoom,
      classroomUpdatedAt: updatedAt
    };

  const key = getAccountKey(updatedLocal);
  const medalProfile = key ? getAllSavedMedalProfiles()[key] || getUserMedalProfile(updatedLocal) : null;
  const syncedToSheet = await syncClassroomToGoogleSheets(
    updatedLocal,
    cleanRoom,
    updatedLocal.classroomUpdatedAt || updatedAt,
    medalProfile
  );

  return {
    success: true,
    syncedToSheet,
    user: updatedLocal
  };
}

export interface TeacherUserTarget {
  uid: string;
  username?: string;
  studentId?: string;
  displayName?: string;
  fullName?: string;
  classroom?: string;
  avatar?: string;
  avatarBg?: string;
  role?: string;
}

export async function apiTeacherUpdateUserPassword(
  target: TeacherUserTarget,
  newPassword: string
): Promise<{
  success: boolean;
  syncedToSheet: boolean;
  needsScriptUpdate?: boolean;
  message: string;
}> {
  const cleanPass = newPassword.trim();
  if (cleanPass.length < 4) {
    return {
      success: false,
      syncedToSheet: false,
      message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร'
    };
  }

  const cleanSid = String(target.studentId || target.username || '').trim();
  const cleanUid = String(target.uid || '').trim();
  if (!cleanSid && !cleanUid) {
    return {
      success: false,
      syncedToSheet: false,
      message: 'ไม่พบข้อมูลรหัสบัญชีผู้ใช้งาน'
    };
  }

  // 1. Update local password vault immediately for all identifiers of this user
  if (cleanSid) {
    saveLocalPassword(cleanSid, cleanPass);
    saveLocalPassword(cleanSid.toLowerCase(), cleanPass);
  }
  if (target.username) {
    saveLocalPassword(target.username.trim(), cleanPass);
  }
  if (cleanUid) {
    saveLocalPassword(cleanUid, cleanPass);
  }

  // 2. Sync new password directly to Google Sheets (Users sheet)
  const remoteRes = await sendToAppsScript(
    {
      action: 'updateUserPassword',
      sheetId: SHEET_ID,
      uid: cleanUid,
      username: target.username || cleanSid,
      studentId: cleanSid,
      displayName: target.displayName || target.fullName || cleanSid,
      fullName: target.fullName || target.displayName || cleanSid,
      classroom: target.classroom || 'ทั่วไป',
      avatar: target.avatar || '',
      avatarBg: target.avatarBg || 'from-cyan-500 to-blue-600',
      newPassword: cleanPass
    },
    12000
  );

  notifyUserDataUpdated(cleanSid.toLowerCase() || cleanUid.toLowerCase());

  if (remoteRes.success) {
    return {
      success: true,
      syncedToSheet: true,
      message: `เปลี่ยนรหัสผ่านของ ${target.fullName || target.displayName || cleanSid} และอัปเดตลง Google Sheets เรียบร้อยแล้ว`
    };
  }

  const remoteMsg = String(remoteRes.data?.message || remoteRes.error || '').toLowerCase();
  const needsScriptUpdate =
    remoteMsg.includes('unknown action') || remoteMsg.includes('invalid action');

  return {
    success: true,
    syncedToSheet: false,
    needsScriptUpdate,
    message: needsScriptUpdate
      ? `เปลี่ยนรหัสผ่านในเครื่องแล้ว แต่ต้องอัปเดตและ Deploy โค้ด Google Apps Script เวอร์ชันล่าสุดเพื่ออัปเดตรหัสลง Google Sheets`
      : `เปลี่ยนรหัสผ่านในเครื่องแล้ว แต่ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้ (${remoteRes.error || remoteRes.data?.message || 'เครือข่ายขัดข้อง'})`
  };
}

export async function apiTeacherDeleteUser(
  target: TeacherUserTarget
): Promise<{
  success: boolean;
  syncedToSheet: boolean;
  needsScriptUpdate?: boolean;
  message: string;
}> {
  const cleanUid = String(target.uid || '').trim();
  const cleanSid = String(target.studentId || target.username || '').trim();
  const cleanSidLower = cleanSid.toLowerCase();
  const cleanUidLower = cleanUid.toLowerCase();

  // Safety guard: never allow deleting teacher or admin accounts
  if (
    target.role === 'teacher' ||
    target.role === 'admin' ||
    cleanSidLower === 'teacher' ||
    cleanSidLower === 'admin' ||
    cleanUidLower === 'teacher_01' ||
    cleanUidLower.startsWith('teacher_')
  ) {
    return {
      success: false,
      syncedToSheet: false,
      message: 'ไม่สามารถลบบัญชีครูผู้สอนหรือผู้ดูแลระบบได้'
    };
  }

  const targetUserObj: User = {
    uid: cleanUid || `std_${cleanSidLower}`,
    username: String(target.username || cleanSidLower).trim().toLowerCase(),
    studentId: cleanSid || cleanUid,
    fullName: target.fullName || target.displayName || cleanSid,
    displayName: target.displayName || target.fullName || cleanSid,
    classroom: target.classroom || 'ทั่วไป',
    role: 'student',
    avatar: '',
    avatarBg: 'from-cyan-500 to-blue-600',
    createdAt: new Date().toISOString()
  };

  // 1. Mark tombstoned so background polling won't resurrect deleted user from un-updated sheet
  markUserDeletedLocally(targetUserObj);

  // 2. Remove from local Users list
  try {
    const remainingUsers = getLocalUsers().filter(u => {
      const uUid = String(u.uid || '').trim().toLowerCase();
      const uSid = String(u.studentId || '').trim().toLowerCase();
      const uUser = String(u.username || '').trim().toLowerCase();
      if (cleanUidLower && uUid === cleanUidLower) return false;
      if (cleanSidLower && (uSid === cleanSidLower || uUser === cleanSidLower || uUid === `std_${cleanSidLower}`)) {
        return false;
      }
      return true;
    });
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(remainingUsers));
  } catch {
    // ignore
  }

  // 3. Remove from local Passwords map
  try {
    const passMap = getLocalPasswords();
    let passChanged = false;
    [cleanSidLower, cleanUidLower, String(target.username || '').trim().toLowerCase()].forEach(k => {
      if (k && Object.prototype.hasOwnProperty.call(passMap, k)) {
        delete passMap[k];
        passChanged = true;
      }
    });
    if (passChanged) {
      localStorage.setItem(LOCAL_STORAGE_PASSWORDS_KEY, JSON.stringify(passMap));
    }
  } catch {
    // ignore
  }

  // 4. Remove owned Scores locally
  try {
    const remainingScores = getLocalScores().filter(s => !isRecordOwnedByUser(s, targetUserObj));
    safeWriteScoresToStorage(remainingScores);
  } catch {
    // ignore
  }

  // 5. Remove saved Medal profile locally
  try {
    const medalMap = getAllSavedMedalProfiles();
    let medalChanged = false;
    Object.keys(medalMap).forEach(k => {
      const m = medalMap[k];
      const kl = k.trim().toLowerCase();
      const mUid = String(m?.uid || '').trim().toLowerCase();
      const mSid = String(m?.studentId || '').trim().toLowerCase();
      if (
        (cleanSidLower && (kl === cleanSidLower || mSid === cleanSidLower)) ||
        (cleanUidLower && (kl === cleanUidLower || mUid === cleanUidLower))
      ) {
        delete medalMap[k];
        medalChanged = true;
      }
    });
    if (medalChanged) {
      localStorage.setItem(LOCAL_STORAGE_USER_MEDALS_KEY, JSON.stringify(medalMap));
    }
  } catch {
    // ignore
  }

  // 6. Remove saved Pre/Post comparison locally
  try {
    const ppMap = getAllSavedPrePostMap();
    let ppChanged = false;
    Object.keys(ppMap).forEach(k => {
      const p = ppMap[k];
      const kl = k.trim().toLowerCase();
      const pUid = String(p?.uid || '').trim().toLowerCase();
      const pSid = String(p?.studentId || '').trim().toLowerCase();
      if (
        (cleanSidLower && (kl === cleanSidLower || pSid === cleanSidLower)) ||
        (cleanUidLower && (kl === cleanUidLower || pUid === cleanUidLower))
      ) {
        delete ppMap[k];
        ppChanged = true;
      }
    });
    if (ppChanged) {
      localStorage.setItem(LOCAL_STORAGE_PREPOST_KEY, JSON.stringify(ppMap));
    }
  } catch {
    // ignore
  }

  // 7. Remove classroom vault entries & local quiz snapshots
  try {
    const roomMap = getClassroomVaultMap();
    let roomChanged = false;
    buildUserClassroomKeys(targetUserObj).forEach(k => {
      if (Object.prototype.hasOwnProperty.call(roomMap, k)) {
        delete roomMap[k];
        roomChanged = true;
      }
    });
    if (roomChanged) {
      localStorage.setItem(LOCAL_STORAGE_CLASSROOMS_KEY, JSON.stringify(roomMap));
    }
    if (cleanUid) {
      localStorage.removeItem(`touch_typing_pretest_quiz_v2_${cleanUid}`);
      localStorage.removeItem(`touch_typing_posttest_quiz_v2_${cleanUid}`);
    }
  } catch {
    // ignore
  }

  // 8. Delete from Google Sheets (Users, Scores, UserMedals, PrePostTests)
  const remoteRes = await sendToAppsScript(
    {
      action: 'deleteUser',
      sheetId: SHEET_ID,
      uid: cleanUid,
      username: target.username || cleanSid,
      studentId: cleanSid,
      displayName: target.displayName || target.fullName || '',
      deleteRelatedData: true
    },
    12000
  );

  notifyUserDataUpdated();

  if (remoteRes.success) {
    return {
      success: true,
      syncedToSheet: true,
      message: `ลบบัญชีผู้ใช้ ${target.fullName || target.displayName || cleanSid} ออกจากระบบและ Google Sheets เรียบร้อยแล้ว`
    };
  }

  const remoteMsg = String(remoteRes.data?.message || remoteRes.error || '').toLowerCase();
  const needsScriptUpdate =
    remoteMsg.includes('unknown action') || remoteMsg.includes('invalid action');

  return {
    success: true,
    syncedToSheet: false,
    needsScriptUpdate,
    message: needsScriptUpdate
      ? `ลบบัญชีในเครื่องเรียบร้อยแล้ว แต่ต้องอัปเดตและ Deploy โค้ด Google Apps Script เวอร์ชันล่าสุดเพื่อลบแถวใน Google Sheets อัตโนมัติ`
      : `ลบบัญชีในเครื่องเรียบร้อยแล้ว แต่ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้ (${remoteRes.error || remoteRes.data?.message || 'เครือข่ายขัดข้อง'})`
  };
}

export interface TeacherDashboardSnapshot {
  users: User[];
  scores: ScoreRecord[];
  medalProfiles: UserMedalProfile[];
  prePostComparisons: PrePostComparisonRecord[];
  sheetUsersCount: number;
  sheetUserKeys: string[];
  syncedFromSheet: boolean;
  needsScriptUpdate: boolean;
  dataSourceMode: 'full_sheet' | 'leaderboard_fallback' | 'local_only';
  syncedAt: string;
}

function pickNewestClassroom(
  ...candidates: { classroom?: string; updatedAt?: string }[]
): { classroom: string; updatedAt?: string } {
  let bestRoom = '';
  let bestTs = -1;
  let bestIso: string | undefined;

  for (const c of candidates) {
    const clean = String(c.classroom || '').trim();
    if (!clean) continue;
    const rawTs = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
    const ts = Number.isNaN(rawTs) ? 0 : rawTs;

    if (!bestRoom) {
      bestRoom = clean;
      bestTs = ts;
      bestIso = c.updatedAt;
      continue;
    }

    // Prefer a specific classroom over 'ทั่วไป' if neither has a real timestamp
    if (ts === 0 && bestTs === 0) {
      if (bestRoom === 'ทั่วไป' && clean !== 'ทั่วไป') {
        bestRoom = clean;
        bestIso = c.updatedAt;
      }
      continue;
    }

    if (ts >= bestTs) {
      bestRoom = clean;
      bestTs = ts;
      bestIso = c.updatedAt;
    }
  }

  return { classroom: bestRoom || 'ทั่วไป', updatedAt: bestIso };
}

export async function apiFetchTeacherDashboardData(): Promise<TeacherDashboardSnapshot> {
  const localUsers = getLocalUsers();
  const localScores = getLocalScores();
  const localMedalsMap = getAllSavedMedalProfiles();
  const localPrePostMap = getAllSavedPrePostMap();

  let remoteUsers: User[] = [];
  let remoteScores: ScoreRecord[] = [];
  let remoteMedalProfiles: UserMedalProfile[] = [];
  let remotePrePostComparisons: PrePostComparisonRecord[] = [];
  let syncedFromSheet = false;
  let needsScriptUpdate = false;
  let dataSourceMode: 'full_sheet' | 'leaderboard_fallback' | 'local_only' = 'local_only';

  try {
    // 1. Try full teacher data endpoint (ALL Users + ALL Scores + UserMedals + PrePostTests)
    const teacherRes = await sendToAppsScript(
      {
        action: 'getTeacherData',
        sheetId: SHEET_ID
      },
      10000
    );

    if (
      teacherRes.success &&
      teacherRes.data &&
      (Array.isArray(teacherRes.data.users) ||
        Array.isArray(teacherRes.data.scores) ||
        Array.isArray(teacherRes.data.medalProfiles) ||
        Array.isArray(teacherRes.data.prePostComparisons))
    ) {
      syncedFromSheet = true;
      dataSourceMode = 'full_sheet';
      if (Array.isArray(teacherRes.data.users)) {
        remoteUsers = teacherRes.data.users.map(normalizeRemoteUserRecord);
      }
      if (Array.isArray(teacherRes.data.scores)) {
        remoteScores = teacherRes.data.scores.map(normalizeRemoteScoreRecord);
      }
      if (Array.isArray(teacherRes.data.medalProfiles)) {
        remoteMedalProfiles = teacherRes.data.medalProfiles;
      }
      if (Array.isArray(teacherRes.data.prePostComparisons)) {
        remotePrePostComparisons = teacherRes.data.prePostComparisons;
      }
    } else {
      const teacherErrMsg = String(teacherRes.data?.message || teacherRes.error || '').toLowerCase();
      if (teacherErrMsg.includes('invalid action') || teacherErrMsg.includes('unknown action')) {
        needsScriptUpdate = true;
      }

      // 2. Graceful fallback for older Apps Script deployments:
      //    Fetch getLeaderboard AND pull each discovered student's full score history via getUserScores
      //    so Pre-Test, Post-Test, 10-Level Game, Lessons & Ranked scores all appear!
      const lbRes = await sendToAppsScript(
        {
          action: 'getLeaderboard',
          sheetId: SHEET_ID
        },
        7000
      );
      if (lbRes.success && lbRes.data && Array.isArray(lbRes.data.scores)) {
        syncedFromSheet = true;
        dataSourceMode = 'leaderboard_fallback';
        const fallbackScoreMap = new Map<string, ScoreRecord>();
        (lbRes.data.scores as ScoreRecord[]).map(normalizeRemoteScoreRecord).forEach(sc => {
          if (sc && sc.scoreId) fallbackScoreMap.set(sc.scoreId, sc);
        });

        // Collect all unique discovered student UIDs (from leaderboard + local users/medals/prepost)
        const targetQueries = new Map<string, { uid: string; displayName: string }>();
        (lbRes.data.scores as ScoreRecord[]).map(normalizeRemoteScoreRecord).forEach(sc => {
          const uid = String(sc.uid || '').trim();
          if (!uid || uid === 'guest' || uid === 'guest_default' || uid.startsWith('seed_') || uid.startsWith('teacher_')) return;
          if (!targetQueries.has(uid.toLowerCase())) {
            targetQueries.set(uid.toLowerCase(), { uid, displayName: sc.displayName || '' });
          }
        });
        localUsers.forEach(u => {
          if (u.role === 'teacher' || u.role === 'admin' || u.username?.toLowerCase() === 'teacher') return;
          const uid = String(u.uid || '').trim();
          if (!uid || uid.startsWith('seed_') || uid.startsWith('teacher_')) return;
          if (!targetQueries.has(uid.toLowerCase())) {
            targetQueries.set(uid.toLowerCase(), { uid, displayName: u.displayName || '' });
          }
        });

        // Fetch full score histories per student in parallel batches of 5 (capped at 25 to keep fast)
        const queryList = Array.from(targetQueries.values()).slice(0, 25);
        for (let i = 0; i < queryList.length; i += 5) {
          const chunk = queryList.slice(i, i + 5);
          const batchResults = await Promise.all(
            chunk.map(q =>
              sendToAppsScript(
                {
                  action: 'getUserScores',
                  sheetId: SHEET_ID,
                  uid: q.uid,
                  displayName: q.displayName
                },
                5000
              ).catch(() => ({ success: false, data: null }))
            )
          );
          batchResults.forEach(res => {
            if (res.success && res.data && Array.isArray(res.data.scores)) {
              (res.data.scores as ScoreRecord[]).map(normalizeRemoteScoreRecord).forEach(sc => {
                if (sc && sc.scoreId) fallbackScoreMap.set(sc.scoreId, sc);
              });
            }
          });
        }

        remoteScores = Array.from(fallbackScoreMap.values());
      }
    }
  } catch {
    // Offline fallback uses local cache seamlessly
  }

  // Filter out any users deleted locally by the teacher so un-updated sheets cannot resurrect them
  const deletedKeys = getDeletedUserKeysSet();
  if (deletedKeys.size > 0) {
    remoteUsers = remoteUsers.filter(ru => !isTargetDeleted(deletedKeys, ru));
    remoteScores = remoteScores.filter(rs => !isTargetDeleted(deletedKeys, { uid: rs.uid }));
    remoteMedalProfiles = remoteMedalProfiles.filter(rm => !isTargetDeleted(deletedKeys, rm));
    remotePrePostComparisons = remotePrePostComparisons.filter(rpp => !isTargetDeleted(deletedKeys, rpp));
  }

  // Extract newest remote classroom per student key from Scores (including CLASSROOM_UPDATE checkpoints)
  const remoteScoreRoomByKey = new Map<string, { classroom: string; updatedAt: string }>();
  const registerRemoteScoreRoom = (keyRaw: string, room: string, createdAt: string) => {
    const k = keyRaw.trim().toLowerCase();
    if (!k || !room) return;
    const prev = remoteScoreRoomByKey.get(k);
    const nextTs = createdAt ? new Date(createdAt).getTime() : 0;
    const prevTs = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
    if (!prev || nextTs >= prevTs) {
      remoteScoreRoomByKey.set(k, { classroom: room, updatedAt: createdAt });
    }
  };

  remoteScores.forEach(rs => {
    const room = extractClassroomFromScore(rs);
    if (!room) return;
    const uidRaw = String(rs.uid || '').trim().toLowerCase();
    const cleanSid = extractStudentIdFromUid(rs.uid).toLowerCase();
    if (uidRaw) registerRemoteScoreRoom(uidRaw, room, rs.createdAt || '');
    if (cleanSid) registerRemoteScoreRoom(cleanSid, room, rs.createdAt || '');
    if (rs.displayName) registerRemoteScoreRoom(`name:${rs.displayName.trim().toLowerCase()}`, room, rs.createdAt || '');
  });

  // Merge Users grounded in Google Sheets:
  // - When dataSourceMode === 'full_sheet', the Google Sheet `Users` tab is authoritative (no demo seed pollution).
  // - In fallback/offline mode, exclude hardcoded demo seed accounts so only real users appear.
  const userByKey = new Map<string, User>();
  const getNormalizedUserKey = (u: { studentId?: string; username?: string; uid?: string }) =>
    String(u.studentId || u.username || u.uid || '').trim().toLowerCase();

  const localByKey = new Map<string, User>();
  localUsers.forEach(u => {
    if (isDemoSeedStudent(u)) return;
    const key = getNormalizedUserKey(u);
    if (key) localByKey.set(key, applyVaultAvatarToUser(u));
  });

  if (dataSourceMode !== 'full_sheet') {
    localByKey.forEach((u, key) => {
      userByKey.set(key, u);
    });
  } else {
    // Always preserve teacher/admin accounts in local cache
    localByKey.forEach((u, key) => {
      if (u.role === 'teacher' || u.role === 'admin' || u.username?.toLowerCase() === 'teacher') {
        userByKey.set(key, u);
      }
    });
  }

  remoteUsers.forEach(ru => {
    const key = getNormalizedUserKey(ru);
    if (!key) return;
    const existing = userByKey.get(key) || localByKey.get(key);
    const vaultRoom = getSavedClassroomForUser(existing || ru);
    const scoreRoom =
      remoteScoreRoomByKey.get(key) ||
      remoteScoreRoomByKey.get(String(ru.uid || '').trim().toLowerCase()) ||
      remoteScoreRoomByKey.get(`name:${String(ru.displayName || '').trim().toLowerCase()}`);

    if (isValidAvatarData(ru.avatar) && !getSavedAvatarForUser(ru)) {
      saveAvatarToVault(buildUserAvatarKeys(ru), ru.avatar!, ru.avatarBg || 'from-cyan-500 to-blue-600');
    }

    const newestRoom = pickNewestClassroom(
      { classroom: ru.classroom, updatedAt: ru.classroomUpdatedAt || ru.createdAt },
      { classroom: existing?.classroom, updatedAt: existing?.classroomUpdatedAt },
      { classroom: vaultRoom?.classroom, updatedAt: vaultRoom?.updatedAt },
      { classroom: scoreRoom?.classroom, updatedAt: scoreRoom?.updatedAt }
    );

    if (newestRoom.classroom && newestRoom.updatedAt) {
      saveClassroomToVault(existing || ru, newestRoom.classroom, newestRoom.updatedAt);
    }

    const mergedUser: User = applyVaultAvatarToUser({
      uid: ru.uid || existing?.uid || `std_${key}`,
      username: ru.username || existing?.username || key,
      studentId: ru.studentId || ru.username || existing?.studentId || key,
      fullName:
        (ru.fullName && ru.fullName !== ru.username ? ru.fullName : '') ||
        ru.displayName ||
        existing?.fullName ||
        ru.username ||
        key,
      classroom: newestRoom.classroom,
      classroomUpdatedAt: newestRoom.updatedAt,
      displayName: ru.displayName || ru.fullName || existing?.displayName || ru.username || key,
      role: (ru.role || existing?.role || 'student') as User['role'],
      avatar: isValidAvatarData(ru.avatar) ? ru.avatar : existing?.avatar || '',
      avatarBg: ru.avatarBg || existing?.avatarBg || 'from-cyan-500 to-blue-600',
      createdAt: ru.createdAt || existing?.createdAt || new Date().toISOString()
    });
    userByKey.set(key, mergedUser);
  });

  // Merge Medal Profiles (remote + local) and enrich student classrooms by newest timestamp
  const mergedMedalsMap: Record<string, UserMedalProfile> = { ...localMedalsMap };
  remoteMedalProfiles.forEach(rm => {
    const key = String(rm.accountKey || rm.studentId || rm.uid || '').trim().toLowerCase();
    if (!key) return;
    const existingM = mergedMedalsMap[key];
    const existingU = userByKey.get(key);
    const vaultRoom = getSavedClassroomForUser(existingU || rm);
    const scoreRoom =
      remoteScoreRoomByKey.get(key) ||
      remoteScoreRoomByKey.get(String(rm.uid || '').trim().toLowerCase()) ||
      remoteScoreRoomByKey.get(`name:${String(rm.displayName || '').trim().toLowerCase()}`);

    const newestRoom = pickNewestClassroom(
      { classroom: existingU?.classroom, updatedAt: existingU?.classroomUpdatedAt },
      { classroom: existingM?.classroom, updatedAt: existingM?.updatedAt },
      { classroom: vaultRoom?.classroom, updatedAt: vaultRoom?.updatedAt },
      { classroom: rm.classroom, updatedAt: rm.updatedAt },
      { classroom: scoreRoom?.classroom, updatedAt: scoreRoom?.updatedAt }
    );

    if (newestRoom.classroom && newestRoom.updatedAt) {
      saveClassroomToVault(existingU || rm, newestRoom.classroom, newestRoom.updatedAt);
    }

    const mergedM: UserMedalProfile = existingM
      ? {
          ...rm,
          classroom: newestRoom.classroom,
          hasPretest: Boolean(existingM.hasPretest || rm.hasPretest),
          hasLesson: Boolean(existingM.hasLesson || rm.hasLesson),
          hasPosttest: Boolean(existingM.hasPosttest || rm.hasPosttest),
          passedLevels: Array.from(
            new Set([...(existingM.passedLevels || []), ...(rm.passedLevels || [])])
          ).sort((a, b) => a - b),
          hasAll10Levels: Boolean(existingM.hasAll10Levels || rm.hasAll10Levels),
          isGrandComplete: Boolean(existingM.isGrandComplete || rm.isGrandComplete),
          achievementIds: Array.from(
            new Set([...(existingM.achievementIds || []), ...(rm.achievementIds || [])])
          ),
          earnedMedals:
            (rm.earnedMedals?.length || 0) >= (existingM.earnedMedals?.length || 0)
              ? rm.earnedMedals
              : existingM.earnedMedals,
          totalMedalsCount: Math.max(existingM.totalMedalsCount || 0, rm.totalMedalsCount || 0),
          completionPercent: Math.max(existingM.completionPercent || 0, rm.completionPercent || 0),
          bestScore: Math.max(existingM.bestScore || 0, rm.bestScore || 0),
          bestWpm: Math.max(existingM.bestWpm || 0, rm.bestWpm || 0),
          bestAccuracy: Math.max(existingM.bestAccuracy || 0, rm.bestAccuracy || 0),
          updatedAt:
            new Date(rm.updatedAt || 0).getTime() >= new Date(existingM.updatedAt || 0).getTime()
              ? rm.updatedAt
              : existingM.updatedAt
        }
      : { ...rm, classroom: newestRoom.classroom };
    mergedMedalsMap[key] = mergedM;

    if (!existingU) {
      userByKey.set(
        key,
        applyVaultAvatarToUser({
          uid: rm.uid || `std_${key}`,
          username: key,
          studentId: rm.studentId || key,
          fullName: rm.fullName || rm.displayName || key,
          classroom: newestRoom.classroom,
          classroomUpdatedAt: newestRoom.updatedAt || rm.updatedAt,
          displayName: rm.displayName || rm.fullName || key,
          role: 'student',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          createdAt: rm.updatedAt || new Date().toISOString()
        })
      );
    } else if (newestRoom.classroom && newestRoom.classroom !== existingU.classroom) {
      userByKey.set(key, {
        ...existingU,
        classroom: newestRoom.classroom,
        classroomUpdatedAt: newestRoom.updatedAt
      });
    }
  });

  // Also apply any newer CLASSROOM_UPDATE checkpoint from Scores to existing users (for older deployed Apps Scripts)
  userByKey.forEach((u, key) => {
    const scoreRoom =
      remoteScoreRoomByKey.get(key) ||
      remoteScoreRoomByKey.get(String(u.uid || '').trim().toLowerCase()) ||
      remoteScoreRoomByKey.get(`name:${String(u.displayName || '').trim().toLowerCase()}`);
    if (!scoreRoom) return;
    const newestRoom = pickNewestClassroom(
      { classroom: u.classroom, updatedAt: u.classroomUpdatedAt },
      { classroom: scoreRoom.classroom, updatedAt: scoreRoom.updatedAt }
    );
    if (newestRoom.classroom && newestRoom.classroom !== u.classroom) {
      if (newestRoom.updatedAt) {
        saveClassroomToVault(u, newestRoom.classroom, newestRoom.updatedAt);
      }
      userByKey.set(key, {
        ...u,
        classroom: newestRoom.classroom,
        classroomUpdatedAt: newestRoom.updatedAt
      });
    }
  });

  // Ensure students discovered ONLY via CLASSROOM_UPDATE or remote scores also have their latest classroom attached
  remoteScores.forEach(rs => {
    if (!rs || !rs.uid || rs.uid === 'guest' || rs.uid === 'guest_default') return;
    if (String(rs.uid).startsWith('seed_') || String(rs.uid).startsWith('teacher_')) return;
    const cleanSid = extractStudentIdFromUid(rs.uid);
    const key = cleanSid.toLowerCase();
    if (!key || userByKey.has(key)) return;
    // Prevent duplicate ghost row if this score already belongs to a user from Google Sheet Users
    const alreadyOwned = Array.from(userByKey.values()).some(u => isRecordOwnedByUser(rs, u));
    if (alreadyOwned) return;
    const scoreRoom =
      remoteScoreRoomByKey.get(key) ||
      remoteScoreRoomByKey.get(String(rs.uid).trim().toLowerCase()) ||
      remoteScoreRoomByKey.get(`name:${String(rs.displayName || '').trim().toLowerCase()}`);
    if (scoreRoom || !isAvatarSyncRecord(rs)) {
      userByKey.set(
        key,
        applyVaultAvatarToUser({
          uid: rs.uid,
          username: key,
          studentId: cleanSid,
          fullName: rs.displayName || cleanSid,
          classroom: scoreRoom?.classroom || extractClassroomFromScore(rs) || 'ทั่วไป',
          classroomUpdatedAt: scoreRoom?.updatedAt || rs.createdAt,
          displayName: rs.displayName || cleanSid,
          role: 'student',
          avatar: isValidAvatarData(rs.avatar) ? rs.avatar! : '',
          avatarBg: rs.avatarBg || 'from-cyan-500 to-blue-600',
          createdAt: rs.createdAt || new Date().toISOString()
        })
      );
    }
  });

  // Merge PrePostComparisons (remote PrePostTests sheet + local saved store + discovered scores)
  const mergedPrePostMap: Record<string, PrePostComparisonRecord> = { ...localPrePostMap };
  remotePrePostComparisons.forEach(rpp => {
    const key = String(rpp.accountKey || rpp.studentId || rpp.uid || '').trim().toLowerCase();
    if (!key) return;
    const ex = mergedPrePostMap[key];
    if (!ex) {
      mergedPrePostMap[key] = rpp;
    } else {
      const rTs = new Date(rpp.updatedAt || 0).getTime();
      const exTs = new Date(ex.updatedAt || 0).getTime();
      const primary = rTs >= exTs ? rpp : ex;
      const secondary = rTs >= exTs ? ex : rpp;
      const preQ = primary.pretestQuizScore ?? secondary.pretestQuizScore;
      const postQ = primary.posttestQuizScore ?? secondary.posttestQuizScore;
      const preTW = primary.pretestTypingWpm ?? secondary.pretestTypingWpm;
      const postTW = primary.posttestTypingWpm ?? secondary.posttestTypingWpm;
      const preTA = primary.pretestTypingAccuracy ?? secondary.pretestTypingAccuracy;
      const postTA = primary.posttestTypingAccuracy ?? secondary.posttestTypingAccuracy;
      mergedPrePostMap[key] = {
        ...secondary,
        ...primary,
        pretestQuizScore: preQ,
        pretestQuizPercent: primary.pretestQuizPercent ?? secondary.pretestQuizPercent,
        pretestQuizDate: primary.pretestQuizDate || secondary.pretestQuizDate,
        posttestQuizScore: postQ,
        posttestQuizPercent: primary.posttestQuizPercent ?? secondary.posttestQuizPercent,
        posttestQuizDate: primary.posttestQuizDate || secondary.posttestQuizDate,
        quizScoreDiff: preQ !== null && postQ !== null ? postQ - preQ : null,
        pretestTypingWpm: preTW,
        pretestTypingAccuracy: preTA,
        pretestTypingDate: primary.pretestTypingDate || secondary.pretestTypingDate,
        posttestTypingWpm: postTW,
        posttestTypingAccuracy: postTA,
        posttestTypingDate: primary.posttestTypingDate || secondary.posttestTypingDate,
        typingWpmDiff: preTW !== null && postTW !== null ? postTW - preTW : null,
        typingAccuracyDiff: preTA !== null && postTA !== null ? postTA - preTA : null
      };
    }

    if (!userByKey.has(key)) {
      userByKey.set(
        key,
        applyVaultAvatarToUser({
          uid: rpp.uid || `std_${key}`,
          username: key,
          studentId: rpp.studentId || key,
          fullName: rpp.fullName || rpp.displayName || key,
          classroom: rpp.classroom || 'ทั่วไป',
          classroomUpdatedAt: rpp.updatedAt,
          displayName: rpp.displayName || rpp.fullName || key,
          role: 'student',
          avatar: '',
          avatarBg: 'from-cyan-500 to-blue-600',
          createdAt: rpp.updatedAt || new Date().toISOString()
        })
      );
    }
  });

  // Merge all real scores (remote + local), excluding demo seed_* records and avatar/classroom sync markers
  const scoreMap = new Map<string, ScoreRecord>();
  const addScore = (s: ScoreRecord) => {
    if (!s || !s.scoreId) return;
    if (String(s.uid || '').startsWith('seed_')) return;
    scoreMap.set(s.scoreId, s);
  };
  remoteScores.forEach(addScore);
  localScores.forEach(addScore);

  const enrichedScores = enrichScoresWithUserAvatars(Array.from(scoreMap.values())).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Also recompute/enrich PrePostComparison for every student who has Pre/Post score rows
  userByKey.forEach((u, key) => {
    if (u.role === 'teacher' || u.role === 'admin') return;
    const uScores = enrichedScores.filter(s => isRecordOwnedByUser(s, u));
    const computed = computePrePostComparison(u, uScores, mergedPrePostMap[key] || null);
    if (
      computed.pretestQuizScore !== null ||
      computed.posttestQuizScore !== null ||
      computed.pretestTypingWpm !== null ||
      computed.posttestTypingWpm !== null
    ) {
      mergedPrePostMap[key] = computed;
    }
  });

  // Persist newly discovered remote students, medals & Pre/Post comparisons locally so teacher stays synced offline too
  if (
    remoteUsers.length > 0 ||
    remoteMedalProfiles.length > 0 ||
    remotePrePostComparisons.length > 0 ||
    remoteScoreRoomByKey.size > 0
  ) {
    try {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(Array.from(userByKey.values())));
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_USER_MEDALS_KEY, JSON.stringify(mergedMedalsMap));
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_PREPOST_KEY, JSON.stringify(mergedPrePostMap));
    } catch {
      // ignore
    }
  }

  const sheetUserKeys = remoteUsers
    .map(u => getNormalizedUserKey(u))
    .filter(Boolean);

  return {
    users: Array.from(userByKey.values()),
    scores: enrichedScores,
    medalProfiles: Object.values(mergedMedalsMap),
    prePostComparisons: Object.values(mergedPrePostMap),
    sheetUsersCount: remoteUsers.length,
    sheetUserKeys,
    syncedFromSheet,
    needsScriptUpdate,
    dataSourceMode,
    syncedAt: new Date().toISOString()
  };
}

export interface PublicPlayerProfile {
  playerKey: string;
  uid: string;
  studentId: string;
  displayName: string;
  fullName: string;
  classroom: string;
  avatar: string;
  avatarBg: string;
  allScores: ScoreRecord[];
  medalProfile: UserMedalProfile | null;
  prePostComparison: PrePostComparisonRecord | null;
  totalPlayed: number;
  bestOverallScore: number;
  bestOverallCategory: string;
  bestRankedScore: number;
  bestRankedRecord: ScoreRecord | null;
  bestGameScore: number;
  totalGameLevelsScore: number;
  passedLevelsCount: number;
  bestWpm: number;
  bestWpmRecord: ScoreRecord | null;
  avgWpm: number;
  bestAccuracy: number;
  avgAccuracy: number;
  bestLessonRecord: ScoreRecord | null;
  totalMedalsCount: number;
  completionPercent: number;
  isGrandComplete: boolean;
  lastActiveAt: string | null;
}

export interface GlobalLeaderboardSnapshot {
  scores: ScoreRecord[];
  players: PublicPlayerProfile[];
  syncedFromSheet: boolean;
  syncedAt: string;
}

export async function apiFetchGlobalLeaderboardData(): Promise<GlobalLeaderboardSnapshot> {
  const snapshot = await apiFetchTeacherDashboardData();

  // Build maps for fast lookup by accountKey / uid / displayName
  const medalByKey = new Map<string, UserMedalProfile>();
  snapshot.medalProfiles.forEach(m => {
    const keys = [
      String(m.accountKey || '').trim().toLowerCase(),
      String(m.studentId || '').trim().toLowerCase(),
      String(m.uid || '').trim().toLowerCase(),
      m.displayName ? `name:${m.displayName.trim().toLowerCase()}` : ''
    ];
    keys.forEach(k => {
      if (k && !medalByKey.has(k)) medalByKey.set(k, m);
    });
  });

  const prePostByKey = new Map<string, PrePostComparisonRecord>();
  snapshot.prePostComparisons.forEach(pp => {
    const keys = [
      String(pp.accountKey || '').trim().toLowerCase(),
      String(pp.studentId || '').trim().toLowerCase(),
      String(pp.uid || '').trim().toLowerCase(),
      pp.displayName ? `name:${pp.displayName.trim().toLowerCase()}` : ''
    ];
    keys.forEach(k => {
      if (k && !prePostByKey.has(k)) prePostByKey.set(k, pp);
    });
  });

  // Collect all unique non-teacher, non-seed players from Users + Scores + Medals
  const playerUsersMap = new Map<string, User>();
  const registerPlayerUser = (u: User) => {
    if (!u) return;
    if (u.role === 'teacher' || u.role === 'admin') return;
    const rawUid = String(u.uid || '').trim();
    if (rawUid.startsWith('seed_') || rawUid.startsWith('teacher_')) return;
    const key = String(u.studentId || u.username || u.uid || u.displayName || '')
      .trim()
      .toLowerCase();
    if (!key || key === 'guest' || key === 'guest_default') return;
    if (!playerUsersMap.has(key)) {
      playerUsersMap.set(key, u);
    }
  };

  snapshot.users.forEach(registerPlayerUser);

  // Also ensure any guest/score-only player present in Google Sheet Scores has a profile entry
  snapshot.scores.forEach(s => {
    if (!s || String(s.uid || '').startsWith('seed_')) return;
    const matched = Array.from(playerUsersMap.values()).some(u => isRecordOwnedByUser(s, u));
    if (matched) return;
    const cleanUid = String(s.uid || '').trim();
    const isGuest = !cleanUid || cleanUid === 'guest' || cleanUid === 'guest_default';
    const key = isGuest
      ? `name:${String(s.displayName || 'ผู้เล่น').trim().toLowerCase()}`
      : extractStudentIdFromUid(cleanUid).toLowerCase();
    if (!key || playerUsersMap.has(key)) return;
    playerUsersMap.set(key, {
      uid: cleanUid || key,
      username: key,
      studentId: isGuest ? '' : extractStudentIdFromUid(cleanUid),
      fullName: s.displayName || 'ผู้เล่น',
      displayName: s.displayName || 'ผู้เล่น',
      classroom: s.classroom || 'ทั่วไป',
      role: 'student',
      avatar: isValidAvatarData(s.avatar) ? s.avatar! : '',
      avatarBg: s.avatarBg || 'from-cyan-500 to-blue-600',
      createdAt: s.createdAt || new Date().toISOString()
    });
  });

  const players: PublicPlayerProfile[] = Array.from(playerUsersMap.entries()).map(([playerKey, u]) => {
    const ownedScores = snapshot.scores
      .filter(s => {
        if (playerKey.startsWith('name:')) {
          const targetName = playerKey.slice(5);
          return String(s.displayName || '').trim().toLowerCase() === targetName;
        }
        return isRecordOwnedByUser(s, u);
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const lookupKeys = [
      playerKey,
      String(u.studentId || '').trim().toLowerCase(),
      String(u.uid || '').trim().toLowerCase(),
      u.displayName ? `name:${u.displayName.trim().toLowerCase()}` : ''
    ];

    let savedMedal: UserMedalProfile | null = null;
    for (const k of lookupKeys) {
      if (k && medalByKey.has(k)) {
        savedMedal = medalByKey.get(k)!;
        break;
      }
    }
    const medalProfile = computeUserMedalProfile(u, ownedScores, savedMedal);

    let savedPrePost: PrePostComparisonRecord | null = null;
    for (const k of lookupKeys) {
      if (k && prePostByKey.has(k)) {
        savedPrePost = prePostByKey.get(k)!;
        break;
      }
    }
    const prePostComparison = computePrePostComparison(u, ownedScores, savedPrePost);

    const rankedScores = ownedScores.filter(s => s.gameMode === 'ranked' || s.testType === 'RANKED');
    const bestRankedRecord =
      rankedScores.length > 0
        ? [...rankedScores].sort(
            (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
          )[0]
        : null;

    const gameScores = ownedScores.filter(s => s.gameMode === 'game');
    const bestGameByLevel = new Map<number, ScoreRecord>();
    gameScores.forEach(gs => {
      const lvl = Number(gs.levelId);
      if (!Number.isFinite(lvl) || lvl < 1 || lvl > 10) return;
      const ex = bestGameByLevel.get(lvl);
      if (!ex || gs.score > ex.score || (gs.score === ex.score && gs.accuracy > ex.accuracy)) {
        bestGameByLevel.set(lvl, gs);
      }
    });
    const bestGameScore =
      gameScores.length > 0 ? Math.max(...gameScores.map(g => Number(g.score) || 0)) : 0;
    const totalGameLevelsScore = Array.from(bestGameByLevel.values()).reduce(
      (sum, g) => sum + (Number(g.score) || 0),
      0
    );

    const lessonScores = ownedScores.filter(s => s.gameMode === 'lesson' || s.gameMode === 'practice');
    const bestLessonRecord =
      lessonScores.length > 0
        ? [...lessonScores].sort(
            (a, b) => b.netWpm - a.netWpm || b.accuracy - a.accuracy || b.score - a.score
          )[0]
        : null;

    const typingOnly = ownedScores.filter(s => !isQuizScoreRecord(s) && (Number(s.netWpm) || 0) > 0);
    const bestWpmRecord =
      typingOnly.length > 0
        ? [...typingOnly].sort(
            (a, b) => b.netWpm - a.netWpm || b.accuracy - a.accuracy || b.score - a.score
          )[0]
        : null;
    const bestWpm = Math.max(bestWpmRecord?.netWpm || 0, medalProfile.bestWpm || 0);
    const avgWpm =
      typingOnly.length > 0
        ? Math.round(typingOnly.reduce((sum, s) => sum + (Number(s.netWpm) || 0), 0) / typingOnly.length)
        : bestWpm;
    const bestAccuracy = Math.max(
      typingOnly.length > 0 ? Math.max(...typingOnly.map(s => Number(s.accuracy) || 0)) : 0,
      medalProfile.bestAccuracy || 0
    );
    const avgAccuracy =
      typingOnly.length > 0
        ? Math.round(typingOnly.reduce((sum, s) => sum + (Number(s.accuracy) || 0), 0) / typingOnly.length)
        : bestAccuracy;

    const topOverallRecord =
      ownedScores.length > 0
        ? [...ownedScores].sort(
            (a, b) => b.score - a.score || b.netWpm - a.netWpm || b.accuracy - a.accuracy
          )[0]
        : null;
    const bestOverallScore = Math.max(topOverallRecord?.score || 0, medalProfile.bestScore || 0);
    const bestOverallCategory = topOverallRecord
      ? topOverallRecord.gameMode === 'ranked' || topOverallRecord.testType === 'RANKED'
        ? 'ประลองจัดอันดับ'
        : topOverallRecord.gameMode === 'game'
        ? `เกมด่านที่ ${topOverallRecord.levelId}`
        : topOverallRecord.gameMode === 'posttest' || topOverallRecord.testType === 'POST_TEST'
        ? 'Post-Test'
        : topOverallRecord.gameMode === 'pretest' || topOverallRecord.testType === 'PRE_TEST'
        ? 'Pre-Test'
        : 'ฝึกพิมพ์บทเรียน'
      : '-';

    const latestAvatarFromScores = ownedScores.find(s => isValidAvatarData(s.avatar));
    const resolvedAvatar = isValidAvatarData(u.avatar)
      ? u.avatar!
      : latestAvatarFromScores?.avatar || '';
    const resolvedAvatarBg =
      u.avatarBg || latestAvatarFromScores?.avatarBg || 'from-cyan-500 to-blue-600';

    const resolvedClassroom =
      u.classroom && u.classroom !== 'ทั่วไป'
        ? u.classroom
        : medalProfile.classroom && medalProfile.classroom !== 'ทั่วไป'
        ? medalProfile.classroom
        : prePostComparison.classroom && prePostComparison.classroom !== 'ทั่วไป'
        ? prePostComparison.classroom
        : ownedScores.find(s => s.classroom && s.classroom !== 'ทั่วไป')?.classroom ||
          u.classroom ||
          'ทั่วไป';

    const lastActiveAt =
      ownedScores[0]?.createdAt || prePostComparison.updatedAt || medalProfile.updatedAt || null;

    return {
      playerKey,
      uid: u.uid,
      studentId: u.studentId || '',
      displayName: u.displayName || u.fullName || u.username || 'ผู้เล่น',
      fullName: u.fullName || u.displayName || u.username || 'ผู้เล่น',
      classroom: resolvedClassroom,
      avatar: resolvedAvatar,
      avatarBg: resolvedAvatarBg,
      allScores: ownedScores,
      medalProfile,
      prePostComparison,
      totalPlayed: ownedScores.length,
      bestOverallScore,
      bestOverallCategory,
      bestRankedScore: bestRankedRecord?.score || 0,
      bestRankedRecord,
      bestGameScore,
      totalGameLevelsScore,
      passedLevelsCount: medalProfile.passedLevels.length,
      bestWpm,
      bestWpmRecord,
      avgWpm,
      bestAccuracy,
      avgAccuracy,
      bestLessonRecord,
      totalMedalsCount: medalProfile.totalMedalsCount,
      completionPercent: medalProfile.completionPercent,
      isGrandComplete: medalProfile.isGrandComplete,
      lastActiveAt
    };
  });

  return {
    scores: snapshot.scores,
    players,
    syncedFromSheet: snapshot.syncedFromSheet,
    syncedAt: snapshot.syncedAt
  };
}
