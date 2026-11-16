/**
 * Google Apps Script for Touch Typing Learning Game
 * Connected to Sheet ID: 1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY
 */

const SHEET_ID = "1rpaY_Qh953H6g1FEv3ErGDfOIRy5OMgzHlCbgh_yyhY";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets(ss);

    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const action = data.action || (e && e.parameter ? e.parameter.action : "getLeaderboard");

    if (action === "ping") {
      return createResponse({ success: true, message: "Apps Script API Connected Successfully!", timestamp: new Date().toISOString() });
    }

    if (action === "register") {
      return handleRegister(ss, data);
    }

    if (action === "login") {
      return handleLogin(ss, data);
    }

    if (action === "saveScore") {
      return handleSaveScore(ss, data);
    }

    if (action === "getLeaderboard") {
      return handleGetLeaderboard(ss, data);
    }

    if (action === "getUserScores") {
      return handleGetUserScores(ss, data);
    }

    return createResponse({ success: false, message: "Invalid action: " + action });

  } catch (error) {
    return createResponse({ success: false, error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets(ss) {
  let userSheet = ss.getSheetByName("Users");
  if (!userSheet) {
    userSheet = ss.insertSheet("Users");
    userSheet.appendRow(["uid", "username", "password", "displayName", "createdAt", "status"]);
    userSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#e2e8f0");
  }

  let scoreSheet = ss.getSheetByName("Scores");
  if (!scoreSheet) {
    scoreSheet = ss.insertSheet("Scores");
    scoreSheet.appendRow([
      "scoreId", "uid", "displayName", "gameMode", "testType", "language",
      "levelId", "score", "totalCharacters", "correctCharacters",
      "incorrectCharacters", "accuracy", "grossWpm", "netWpm",
      "timeTakenSeconds", "passed", "createdAt"
    ]);
    scoreSheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#e2e8f0");
  }
}

function handleRegister(ss, data) {
  const sheet = ss.getSheetByName("Users");
  const values = sheet.getDataRange().getValues();
  const username = (data.username || "").trim().toLowerCase();
  const password = (data.password || "").trim();
  const displayName = (data.displayName || data.username || "ผู้เรียน").trim();

  if (!username || !password) {
    return createResponse({ success: false, message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" });
  }

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === username) {
      return createResponse({ success: false, message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" });
    }
  }

  const uid = "usr_" + Utilities.getUuid().slice(0, 8);
  const createdAt = new Date().toISOString();

  sheet.appendRow([uid, username, password, displayName, createdAt, "active"]);

  return createResponse({
    success: true,
    user: { uid: uid, username: username, displayName: displayName, createdAt: createdAt }
  });
}

function handleLogin(ss, data) {
  const sheet = ss.getSheetByName("Users");
  const values = sheet.getDataRange().getValues();
  const username = (data.username || "").trim().toLowerCase();
  const password = (data.password || "").trim();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === username && String(values[i][2]) === password) {
      return createResponse({
        success: true,
        user: {
          uid: values[i][0],
          username: values[i][1],
          displayName: values[i][3],
          createdAt: values[i][4]
        }
      });
    }
  }

  return createResponse({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
}

function handleSaveScore(ss, data) {
  const sheet = ss.getSheetByName("Scores");
  const scoreId = "sc_" + Utilities.getUuid().slice(0, 8);
  const now = new Date().toISOString();

  sheet.appendRow([
    scoreId,
    data.uid || "guest",
    data.displayName || "ผู้ไม่ประสงค์ออกนาม",
    data.gameMode || "game",
    data.testType || "NONE",
    data.language || "th",
    data.levelId || 1,
    Number(data.score || 0),
    Number(data.totalCharacters || 0),
    Number(data.correctCharacters || 0),
    Number(data.incorrectCharacters || 0),
    Number(data.accuracy || 0),
    Number(data.grossWpm || 0),
    Number(data.netWpm || 0),
    Number(data.timeTakenSeconds || 0),
    Boolean(data.passed),
    now
  ]);

  return createResponse({ success: true, scoreId: scoreId, createdAt: now });
}

function handleGetLeaderboard(ss, data) {
  const sheet = ss.getSheetByName("Scores");
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return createResponse({ success: true, scores: [] });
  }

  const scores = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    scores.push({
      scoreId: row[0],
      uid: row[1],
      displayName: row[2],
      gameMode: row[3],
      testType: row[4],
      language: row[5],
      levelId: row[6],
      score: Number(row[7] || 0),
      totalCharacters: Number(row[8] || 0),
      correctCharacters: Number(row[9] || 0),
      incorrectCharacters: Number(row[10] || 0),
      accuracy: Number(row[11] || 0),
      grossWpm: Number(row[12] || 0),
      netWpm: Number(row[13] || 0),
      timeTakenSeconds: Number(row[14] || 0),
      passed: Boolean(row[15]),
      createdAt: row[16]
    });
  }

  // Sort descending by score, then accuracy, then speed
  scores.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || b.netWpm - a.netWpm);

  return createResponse({ success: true, scores: scores.slice(0, 100) });
}

function handleGetUserScores(ss, data) {
  const sheet = ss.getSheetByName("Scores");
  const values = sheet.getDataRange().getValues();
  const uid = data.uid;
  const userScores = [];

  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === uid) {
      userScores.push({
        scoreId: values[i][0],
        displayName: values[i][2],
        gameMode: values[i][3],
        testType: values[i][4],
        language: values[i][5],
        levelId: values[i][6],
        score: Number(values[i][7] || 0),
        accuracy: Number(values[i][11] || 0),
        netWpm: Number(values[i][13] || 0),
        passed: Boolean(values[i][15]),
        createdAt: values[i][16]
      });
    }
  }

  return createResponse({ success: true, scores: userScores });
}

function createResponse(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
