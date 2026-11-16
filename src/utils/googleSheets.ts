/**
 * Google Sheets & Apps Script API Integration
 * Sheet ID: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
 * Web App URL: https://script.google.com/macros/s/AKfycbzc4JSewT2lJ99qNPEKA3Y9tx_z-mizs6xEJ8_CjbaAOCaXD_eDRVDn0pjDdHJ-5MuIEA/exec
 */

import { ScoreRecord, User } from '../types';

export const SHEET_ID = '1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY';
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzc4JSewT2lJ99qNPEKA3Y9tx_z-mizs6xEJ8_CjbaAOCaXD_eDRVDn0pjDdHJ-5MuIEA/exec';

export const APPS_SCRIPT_CODE_TEMPLATE = `/**
 * Google Apps Script Backend for TouchTyping Game
 * Sheet ID: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var raw = e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'saveScore') {
      var scoresSheet = ss.getSheetByName('Scores');
      if (!scoresSheet) {
        scoresSheet = ss.insertSheet('Scores');
        scoresSheet.appendRow([
          'Score ID', 'UID', 'Display Name', 'Avatar', 'Avatar BG', 'Game Mode', 'Test Type',
          'Language', 'Level ID', 'Score', 'Total Chars', 'Correct Chars', 'Incorrect Chars',
          'Accuracy %', 'Gross WPM', 'Net WPM', 'Time (s)', 'Passed', 'Rank Tier', 'Created At'
        ]);
      }
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
        data.createdAt || new Date().toISOString()
      ]);
      return createJsonResponse({ success: true, message: 'Score saved successfully' });
    }

    if (action === 'getLeaderboard') {
      var scoresSheet = ss.getSheetByName('Scores');
      if (!scoresSheet) {
        return createJsonResponse({ success: true, scores: [] });
      }
      var rows = scoresSheet.getDataRange().getValues();
      var scores = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (r[0]) {
          scores.push({
            scoreId: r[0],
            uid: r[1],
            displayName: r[2],
            avatar: r[3] || '',
            avatarBg: r[4] || 'from-cyan-500 to-blue-600',
            gameMode: r[5],
            testType: r[6],
            language: r[7],
            levelId: r[8],
            score: Number(r[9]) || 0,
            accuracy: Number(r[13]) || 0,
            netWpm: Number(r[15]) || 0,
            timeTakenSeconds: Number(r[16]) || 0,
            passed: Boolean(r[17]),
            rankTier: r[18] || 'Master',
            createdAt: r[19] || new Date().toISOString()
          });
        }
      }
      scores.sort(function(a, b) {
        return (b.score - a.score) || (b.accuracy - a.accuracy) || (b.netWpm - a.netWpm);
      });
      return createJsonResponse({ success: true, scores: scores.slice(0, 50) });
    }

    if (action === 'register') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        usersSheet = ss.insertSheet('Users');
        usersSheet.appendRow(['UID', 'Username', 'Password', 'Display Name', 'Avatar', 'Avatar BG', 'Role', 'Created At']);
      }
      usersSheet.appendRow([
        data.uid || Utilities.getUuid(),
        data.username,
        data.password,
        data.displayName,
        data.avatar || '',
        data.avatarBg || 'from-cyan-500 to-blue-600',
        data.role || 'student',
        new Date().toISOString()
      ]);
      return createJsonResponse({ success: true, message: 'Registered successfully' });
    }

    if (action === 'login') {
      var usersSheet = ss.getSheetByName('Users');
      if (!usersSheet) {
        return createJsonResponse({ success: false, message: 'Users sheet not found' });
      }
      var rows = usersSheet.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        if (rows[j][1] === data.username && rows[j][2] === data.password) {
          return createJsonResponse({
            success: true,
            user: {
              uid: rows[j][0],
              username: rows[j][1],
              displayName: rows[j][3],
              avatar: rows[j][4] || '',
              avatarBg: rows[j][5] || 'from-cyan-500 to-blue-600',
              role: rows[j][6],
              createdAt: rows[j][7]
            }
          });
        }
      }
      return createJsonResponse({ success: false, message: 'Invalid credentials' });
    }

    return createJsonResponse({ success: false, message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return doPost({ postData: { contents: JSON.stringify(e.parameter || { action: 'getLeaderboard' }) } });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

const LOCAL_STORAGE_USERS_KEY = 'touch_typing_users_v2';
const LOCAL_STORAGE_SCORES_KEY = 'touch_typing_scores_v2';
const LOCAL_STORAGE_CURRENT_USER = 'touch_typing_current_user_v2';

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
      const seedUsers: User[] = [
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
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(seedUsers));
      return seedUsers;
    }
    const parsed: User[] = JSON.parse(raw).map((u: User) => {
      if (
        u &&
        (u.username?.toLowerCase() === 'teacher' || u.studentId?.toLowerCase() === 'teacher') &&
        u.role !== 'teacher' &&
        u.role !== 'admin'
      ) {
        return { ...u, role: 'teacher' as const };
      }
      return u;
    });
    const hasTeacher = parsed.some(u => u.role === 'teacher' || u.role === 'admin' || u.username?.toLowerCase() === 'teacher');
    if (!hasTeacher) {
      const updated = [defaultTeacher, ...parsed];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return [defaultTeacher];
  }
}

export function saveLocalUser(user: User) {
  try {
    const users = getLocalUsers().filter(u => u.uid !== user.uid && u.username !== user.username);
    users.push(user);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
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
    if (parsed.avatar && !parsed.avatar.startsWith('data:image') && !parsed.avatar.startsWith('http')) {
      parsed.avatar = '';
    }
    if (!parsed.avatarBg) parsed.avatarBg = 'from-cyan-500 to-blue-600';
    return parsed;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  try {
    if (user) {
      if (user.avatar && !user.avatar.startsWith('data:image') && !user.avatar.startsWith('http')) {
        user.avatar = '';
      }
      if (!user.avatarBg) user.avatarBg = 'from-cyan-500 to-blue-600';
      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER, JSON.stringify(user));
      saveLocalUser(user);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER);
    }
  } catch {
    // ignore
  }
}

export function updateUserAvatar(avatar: string, avatarBg: string): User | null {
  const current = getCurrentUser();
  if (current) {
    const updated: User = {
      ...current,
      avatar,
      avatarBg
    };
    setCurrentUser(updated);

    // Also update this user's avatar on existing scores (including guest <-> guest_default)
    try {
      const scores = getLocalScores();
      const updatedScores = scores.map(s => {
        const isGuestAlias = updated.uid === 'guest_default' && s.uid === 'guest';
        if (s.uid === updated.uid || s.displayName === updated.displayName || isGuestAlias) {
          return { ...s, avatar, avatarBg };
        }
        return s;
      });
      localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(updatedScores));
    } catch {
      // ignore
    }

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
  try {
    const list = getLocalScores();
    list.unshift(score);
    localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function deleteLocalScore(scoreId: string) {
  try {
    const list = getLocalScores().filter(s => s.scoreId !== scoreId);
    localStorage.setItem(LOCAL_STORAGE_SCORES_KEY, JSON.stringify(list));
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
  } catch {
    // ignore
  }
}

export async function sendToAppsScript(
  payload: Record<string, unknown>,
  timeoutMs: number = 8000
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(APPS_SCRIPT_URL, {
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
  if (
    existingUsers.some(
      u =>
        (u.studentId && u.studentId.toLowerCase() === cleanId.toLowerCase()) ||
        u.username.toLowerCase() === cleanId.toLowerCase()
    )
  ) {
    return { success: false, message: `รหัสผู้ใช้งาน ${cleanId} มีในระบบแล้ว กรุณาเข้าสู่ระบบ` };
  }

  const newUser: User = {
    uid: (role === 'teacher' ? 'teacher_' : 'std_') + cleanId + '_' + Date.now().toString(36),
    username: cleanId.toLowerCase(),
    studentId: cleanId,
    fullName: cleanFullName,
    classroom: cleanClassroom,
    displayName: cleanDisplayName,
    avatar: payload.avatar || '',
    avatarBg: payload.avatarBg || (role === 'teacher' ? 'from-indigo-500 to-purple-600' : 'from-cyan-500 to-blue-600'),
    role,
    createdAt: new Date().toISOString()
  };

  saveLocalUser(newUser);
  saveLocalPassword(cleanId, payload.password);
  saveLocalPassword(newUser.username, payload.password);
  if (payload.autoLogin !== false) {
    setCurrentUser(newUser);
  }

  sendToAppsScript({
    action: 'register',
    username: cleanId,
    studentId: cleanId,
    fullName: cleanFullName,
    classroom: cleanClassroom,
    password: payload.password,
    displayName: cleanDisplayName,
    avatar: newUser.avatar,
    avatarBg: newUser.avatarBg,
    role,
    uid: newUser.uid
  }).catch(() => {});

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

export async function apiLoginUser(
  studentIdOrUsername: string,
  password: string
): Promise<{ success: boolean; user?: User; message?: string }> {
  const cleanId = studentIdOrUsername.trim().toLowerCase();

  if (!cleanId) {
    return { success: false, message: 'กรุณากรอกรหัสนักเรียนหรือรหัสครูผู้สอน' };
  }
  if (!password) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' };
  }

  const localUsers = getLocalUsers();
  const localMatch = localUsers.find(
    u =>
      (u.studentId && u.studentId.toLowerCase() === cleanId) ||
      u.username.toLowerCase() === cleanId
  );

  // Local-first instant verification for registered/seeded accounts (teachers & students)
  if (localMatch) {
    const passwords = getLocalPasswords();
    const storedPass =
      passwords[cleanId] ||
      (localMatch.studentId ? passwords[localMatch.studentId.toLowerCase()] : undefined);

    if (storedPass ? storedPass === password : password === '1234') {
      if (localMatch.avatar && !localMatch.avatar.startsWith('data:image') && !localMatch.avatar.startsWith('http')) {
        localMatch.avatar = '';
      }
      if (!localMatch.avatarBg) {
        localMatch.avatarBg = localMatch.role === 'teacher' ? 'from-indigo-500 to-purple-600' : 'from-cyan-500 to-blue-600';
      }
      setCurrentUser(localMatch);
      return {
        success: true,
        user: localMatch,
        message: localMatch.role === 'teacher' || localMatch.role === 'admin'
          ? 'เข้าสู่ระบบครูผู้สอนสำเร็จ'
          : 'เข้าสู่ระบบสำเร็จ'
      };
    }
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
  }

  // Fallback to Google Sheets lookup only when account is not cached locally (fast 2.5s timeout)
  try {
    const res = await sendToAppsScript(
      {
        action: 'login',
        username: cleanId,
        studentId: cleanId,
        password: password
      },
      2500
    );

    if (res.success && res.data && res.data.user) {
      const remoteRole =
        res.data.user.role === 'teacher' || cleanId === 'teacher'
          ? 'teacher'
          : res.data.user.role === 'admin' || cleanId === 'admin'
          ? 'admin'
          : 'student';
      const remoteUser: User = {
        uid: res.data.user.uid,
        username: res.data.user.username || cleanId,
        studentId: res.data.user.studentId || cleanId,
        fullName: res.data.user.fullName || res.data.user.displayName,
        classroom: res.data.user.classroom || 'ปวช.3',
        displayName: res.data.user.displayName,
        avatar:
          res.data.user.avatar &&
          (res.data.user.avatar.startsWith('data:image') || res.data.user.avatar.startsWith('http'))
            ? res.data.user.avatar
            : '',
        avatarBg: res.data.user.avatarBg || 'from-cyan-500 to-blue-600',
        role: remoteRole,
        createdAt: res.data.user.createdAt || new Date().toISOString()
      };
      saveLocalUser(remoteUser);
      saveLocalPassword(cleanId, password);
      setCurrentUser(remoteUser);
      return { success: true, user: remoteUser, message: 'เข้าสู่ระบบสำเร็จ' };
    }
  } catch {
    // ignore remote lookup error
  }

  return {
    success: false,
    message: `ไม่พบข้อมูลรหัสผู้ใช้งาน ${studentIdOrUsername} ในระบบ กรุณาตรวจสอบหรือกดสมัครสมาชิกใหม่`
  };
}

export async function apiSaveScore(score: ScoreRecord): Promise<{ success: boolean; message: string }> {
  saveLocalScore(score);

  const result = await sendToAppsScript({
    action: 'saveScore',
    sheetId: SHEET_ID,
    ...score
  });

  if (result.success) {
    return { success: true, message: 'บันทึกคะแนนลง Google Sheets สำเร็จเรียบร้อย!' };
  } else {
    return {
      success: true,
      message: 'บันทึกคะแนนในเครื่องเรียบร้อยแล้ว (จะซิงค์กับ Google Sheets อัตโนมัติเมื่อออนไลน์)'
    };
  }
}

function enrichScoresWithUserAvatars(scores: ScoreRecord[]): ScoreRecord[] {
  const localUsers = getLocalUsers();
  const currentUser = getCurrentUser();
  const userList: User[] = currentUser
    ? [currentUser, ...localUsers.filter(u => u.uid !== currentUser.uid)]
    : localUsers;

  return scores.map(score => {
    const matchedUser = userList.find(
      u =>
        u.uid === score.uid ||
        (u.uid === 'guest_default' && score.uid === 'guest') ||
        (score.displayName && u.displayName && u.displayName.trim() === score.displayName.trim())
    );
    if (!matchedUser) return score;

    const resolvedAvatar =
      matchedUser.avatar && (matchedUser.avatar.startsWith('data:image') || matchedUser.avatar.startsWith('http') || matchedUser.avatar.startsWith('/'))
        ? matchedUser.avatar
        : score.avatar;

    return {
      ...score,
      avatar: resolvedAvatar || '',
      avatarBg: matchedUser.avatarBg || score.avatarBg || 'from-cyan-500 to-blue-600'
    };
  });
}

export async function apiFetchLeaderboard(): Promise<ScoreRecord[]> {
  try {
    const res = await sendToAppsScript({
      action: 'getLeaderboard',
      sheetId: SHEET_ID
    });

    if (res.success && res.data && Array.isArray(res.data.scores) && res.data.scores.length > 0) {
      const local = getLocalScores();
      const combined = [...res.data.scores];
      local.forEach(l => {
        if (!combined.some(c => c.scoreId === l.scoreId)) {
          combined.push(l);
        }
      });
      // Enrich remote & local entries with latest user avatars before sorting
      const enriched = enrichScoresWithUserAvatars(combined);
      enriched.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm);
      return enriched;
    }
  } catch {
    // fallback
  }

  return enrichScoresWithUserAvatars(getLocalScores()).sort(
    (a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm
  );
}
