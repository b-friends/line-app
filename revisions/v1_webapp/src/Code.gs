/* =====================================================
   Bフレンズ ソフトバレー 参加管理アプリ
   Code.gs — メインロジック

   スプレッドシート構成:
     ROSTER_SPREADSHEET_ID → 「Bフレンズ名簿」(Members のみ)
     SPREADSHEET_ID        → 運用用 (Schedule, Responses, GameSets, GameResults, ExportTemplate)
   ===================================================== */

const SHEET_NAMES = {
  MEMBERS:     'Members',
  SCHEDULE:    'Schedule',
  RESPONSES:   'Responses',
  GAMESETS:    'GameSets',
  GAMERESULTS: 'GameResults',
  EXPORT:      'ExportTemplate',
};

/* Members ヘッダーは名簿スプレッドシートの実際のヘッダー名をそのまま使用。
   コード内では MC.XXX で参照する。 */
const MC = {
  STATUS:       '入会',
  NO:           'Ｎｏ',
  FULL_NAME:    '氏 名',
  FURIGANA:     'ふりがな',
  ADDRESS:      '住 所',
  HOME_PHONE:   '自宅電話',
  MOBILE_PHONE: '携帯電話',
  GENDER:       '性別',
  BIRTH_DATE:   '生年月日',
  AGE_APRIL1:   '4/1年齢',
  INSURANCE:    'R７保険',
  CONTACT:      '連絡方法',
  LINE_ID:      'LINE ID',
  LINE_NAME:    'LINE表示名',
  NOTE:         'メモ',
};

const HEADERS = {
  Schedule: [
    'sessionId','monthKey','eventDate','title',
    'minAttendees','maxAttendees','openForResponse','note'
  ],
  Responses: [
    'lineId','no','fullName','sessionId','monthKey',
    'eventDate','title','answer','note','lineDisplayName','submittedAt'
  ],
  GameSets: [
    'sessionId','eventDate','gameNumber','teamName',
    'no','fullName','gender','ageApril1','createdAt'
  ],
  GameResults: [
    'sessionId','eventDate','gameNumber',
    'teamA','scoreA','teamB','scoreB',
    'winTeam','createdAt'
  ],
};

// ── Web App ──

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.publicConfig = getPublicConfig_();
  return t.evaluate()
    .setTitle(t.publicConfig.appTitle)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getPublicConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    liffId:   p.getProperty('LIFF_ID') || '',
    appTitle: p.getProperty('APP_TITLE') || 'Bフレンズ 参加管理',
  };
}

// ── 初期セットアップ（運用スプレッドシート側のみ） ──

function setupSheets() {
  const ss = getOpsSS_();
  ['Schedule','Responses','GameSets','GameResults'].forEach(name => {
    createSheetIfMissing_(ss, name, HEADERS[name]);
  });
  if (!ss.getSheetByName(SHEET_NAMES.EXPORT)) {
    const s = ss.insertSheet(SHEET_NAMES.EXPORT);
    s.getRange('A1').setValue('（提出用フォーマットをここに貼り付けてください）');
  }
  // Schedule にサンプル
  const sch = ss.getSheetByName(SHEET_NAMES.SCHEDULE);
  if (sch.getLastRow() === 1) {
    const today = new Date();
    const rows = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), 7 * i + 1);
      rows.push([
        'S' + Utilities.getUuid().slice(0, 8),
        Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM'),
        Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd'),
        '定例活動 ' + i, 6, 24, true, ''
      ]);
    }
    sch.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { ok: true, message: 'シート初期化完了', url: ss.getUrl() };
}

// ── LIFF セッション初期化 ──

function initializeSession(idToken) {
  const profile  = verifyIdToken_(idToken);
  const member   = findMemberByLineId_(profile.sub);
  const schedule = buildScheduleView_();
  const isAdmin  = checkAdmin_(profile.sub);
  return {
    ok: true,
    appTitle: getPublicConfig_().appTitle,
    memberFound: !!member,
    member: member ? {
      no: member[MC.NO], fullName: member[MC.FULL_NAME],
      gender: member[MC.GENDER], ageApril1: member[MC.AGE_APRIL1],
    } : null,
    lineProfileName: profile.name || '',
    schedule,
    isAdmin,
    nowJst: fmtJst_(new Date()),
  };
}

// ── 名簿の名前リスト取得（初回登録用）──

function getMemberNamesForRegistration(idToken) {
  verifyIdToken_(idToken);
  const rows = readObjects_(getRosterSheet_());
  const names = rows
    .filter(r => !r[MC.LINE_ID] && isActiveMember_(r))
    .map(r => r[MC.FULL_NAME])
    .filter(Boolean);
  return { ok: true, names };
}

// ── 既存メンバー紐付け（名簿にある人が LINE userId を登録）──

function registerMember(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    const fullName = String(payload.fullName || '').trim();
    if (!fullName) throw new Error('氏名は必須です。');

    const sheet = getRosterSheet_();
    const rows = readObjects_(sheet);

    const normalize = s => String(s||'').replace(/[\s　]+/g, '');
    const idx = rows.findIndex(r => normalize(r[MC.FULL_NAME]) === normalize(fullName));
    if (idx < 0) throw new Error('名簿に「' + fullName + '」が見つかりません。');

    if (!isActiveMember_(rows[idx])) throw new Error('この名前は現在休会または退会中です。');

    const headers = getSheetHeaders_(sheet);
    setColValue_(sheet, headers, idx + 2, MC.LINE_ID, profile.sub);
    setColValue_(sheet, headers, idx + 2, MC.LINE_NAME, profile.name || '');

    const member = rows[idx];
    return {
      ok: true,
      member: { no: member[MC.NO], fullName: member[MC.FULL_NAME], gender: member[MC.GENDER], ageApril1: member[MC.AGE_APRIL1] },
      lineProfileName: profile.name || '',
    };
  } finally { lock.releaseLock(); }
}

// ── 新規メンバー登録（名簿に新規行を追加 + LINE userId も同時登録）──

function registerNewMember(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    const fullName = String(payload.fullName || '').trim();
    const furigana = String(payload.furigana || '').trim();
    const gender   = String(payload.gender || '').trim();
    const birthDate = String(payload.birthDate || '').trim();
    const mobilePhone = String(payload.mobilePhone || '').trim();

    if (!fullName) throw new Error('氏名は必須です。');
    if (!gender)   throw new Error('性別は必須です。');

    const sheet = getRosterSheet_();
    const rows = readObjects_(sheet);
    const headers = getSheetHeaders_(sheet);

    // 重複チェック
    const normalize = s => String(s||'').replace(/[\s　]+/g, '');
    if (rows.some(r => normalize(r[MC.FULL_NAME]) === normalize(fullName))) {
      throw new Error('「' + fullName + '」は既に名簿に登録されています。既存メンバーの場合は名前を選択して紐付けしてください。');
    }

    // 次のNo を算出
    const maxNo = rows.reduce((mx, r) => Math.max(mx, Number(r[MC.NO]) || 0), 0);
    const newNo = maxNo + 1;

    // 4/1年齢を計算
    let ageApril1 = '';
    if (birthDate) {
      const bd = new Date(birthDate);
      const now = new Date();
      const aprilYear = now.getMonth() < 3 ? now.getFullYear() : now.getFullYear();
      const april1 = new Date(aprilYear, 3, 1);
      ageApril1 = Math.floor((april1 - bd) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // 新規行を追加
    const newRow = headers.map(h => {
      switch(h) {
        case MC.STATUS:       return '入会';
        case MC.NO:           return newNo;
        case MC.FULL_NAME:    return fullName;
        case MC.FURIGANA:     return furigana;
        case MC.GENDER:       return gender;
        case MC.BIRTH_DATE:   return birthDate;
        case MC.AGE_APRIL1:   return ageApril1;
        case MC.MOBILE_PHONE: return mobilePhone;
        case MC.CONTACT:      return 'LINE';
        case MC.LINE_ID:      return profile.sub;
        case MC.LINE_NAME:    return profile.name || '';
        case MC.NOTE:         return fmtJst_(new Date()) + ' LIFF新規登録';
        default:              return '';
      }
    });
    sheet.appendRow(newRow);

    return {
      ok: true,
      member: { no: String(newNo), fullName, gender, ageApril1: String(ageApril1) },
      lineProfileName: profile.name || '',
    };
  } finally { lock.releaseLock(); }
}

// ── 出欠回答 ──

function submitAvailability(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    const member = findMemberByLineId_(profile.sub);
    if (!member) return { ok: false, needsRegistration: true, message: '名簿に未登録です。先に初回登録を行ってください。' };

    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    if (!answers.length) throw new Error('回答対象がありません。');

    const scheduleMap = getScheduleMap_();
    const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES);
    const existing = readObjects_(sheet);
    const now = fmtJst_(new Date());

    answers.forEach(a => {
      const ses = scheduleMap[a.sessionId];
      if (!ses || String(ses.openForResponse).toLowerCase() === 'false') return;
      const answer = normalizeAnswer_(a.answer);
      const record = {
        lineId: profile.sub, no: member[MC.NO] || '', fullName: member[MC.FULL_NAME],
        sessionId: ses.sessionId, monthKey: ses.monthKey, eventDate: ses.eventDate,
        title: ses.title, answer, note: String(a.note||'').trim(),
        lineDisplayName: profile.name || '', submittedAt: now,
      };
      const ei = existing.findIndex(r => r.lineId === profile.sub && r.sessionId === ses.sessionId);
      if (ei >= 0) {
        writeRow_(sheet, ei + 2, HEADERS.Responses, record);
        existing[ei] = record;
      } else {
        appendRow_(sheet, HEADERS.Responses, record);
        existing.push(record);
      }
    });

    return { ok: true, memberName: member[MC.FULL_NAME], savedAt: now, schedule: buildScheduleView_(), message: '参加予定を保存しました。' };
  } finally { lock.releaseLock(); }
}

// ── 管理者: 当日参加チェック ──

function getAdminData(idToken, monthKey) {
  const profile = verifyIdToken_(idToken);
  ensureAdmin_(profile.sub);
  return { ok: true, schedule: buildScheduleView_(monthKey) };
}

function markAttendance(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    ensureAdmin_(profile.sub);
    const sessionId = String(payload.sessionId || '');
    const presentIds = (payload.presentLineUserIds || []).map(v => String(v).trim()).filter(Boolean);
    const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES);
    const rows = readObjects_(sheet);
    rows.forEach((r, i) => {
      if (r.sessionId !== sessionId) return;
      const newAns = presentIds.includes(r.lineId) ? 'attended' : r.answer;
      if (newAns !== r.answer) {
        r.answer = newAns;
        r.submittedAt = fmtJst_(new Date());
        writeRow_(sheet, i + 2, HEADERS.Responses, r);
      }
    });
    return { ok: true, schedule: buildScheduleView_(), message: '当日参加を更新しました。' };
  } finally { lock.releaseLock(); }
}

// ── チーム編成（参加者も実行可能）──

function generateTeams(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    // 参加者も実行可能（名簿登録済みであればOK）
    const caller = findMemberByLineId_(profile.sub);
    if (!caller) throw new Error('名簿に未登録です。');

    const sessionId = String(payload.sessionId || '');
    const numGames  = Number(payload.numGames || 3);

    const opsSS = getOpsSS_();
    const responses = readObjects_(opsSS.getSheetByName(SHEET_NAMES.RESPONSES));
    const attendees = responses.filter(r => r.sessionId === sessionId && (r.answer === 'yes' || r.answer === 'attended'));
    if (attendees.length < 6) throw new Error('参加者が6名未満のためチーム編成できません。');

    // 名簿から性別・年齢取得
    const members = readObjects_(getRosterSheet_());
    const memberMap = {};
    members.forEach(m => { if (m[MC.LINE_ID]) memberMap[m[MC.LINE_ID]] = m; });

    const winRates = calcWinRates_();

    const players = attendees.map(a => {
      const m = memberMap[a.lineId] || {};
      const wr = winRates[a.fullName];
      return {
        no: a.no || m[MC.NO] || '',
        fullName: a.fullName,
        lineId: a.lineId,
        gender: m[MC.GENDER] || '不明',
        ageApril1: Number(m[MC.AGE_APRIL1]) || 0,
        winRate: wr ? wr.winRate : 50,
        totalGames: wr ? wr.games : 0,
      };
    });

    const result = makeTeams(players, numGames);

    // GameSets に保存
    const gsSheet = opsSS.getSheetByName(SHEET_NAMES.GAMESETS);
    clearSessionRows_(gsSheet, sessionId);
    const now = fmtJst_(new Date());
    const eventDate = attendees[0] ? attendees[0].eventDate : '';
    result.games.forEach(game => {
      game.teams.forEach(team => {
        team.members.forEach(p => {
          appendRow_(gsSheet, HEADERS.GameSets, {
            sessionId, eventDate, gameNumber: game.gameNumber,
            teamName: team.name, no: p.no, fullName: p.fullName,
            gender: p.gender, ageApril1: p.ageApril1, createdAt: now,
          });
        });
      });
    });

    return { ok: true, result, message: numGames + 'ゲーム分のチーム編成を保存しました。' };
  } finally { lock.releaseLock(); }
}

// ── 試合結果入力（全員実行可能）──

function submitGameResults(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profile = verifyIdToken_(payload.idToken);
    const caller = findMemberByLineId_(profile.sub);
    if (!caller) throw new Error('名簿に未登録です。');
    const sessionId = String(payload.sessionId || '');
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (!results.length) throw new Error('結果データがありません。');

    const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.GAMERESULTS);
    clearSessionRows_(sheet, sessionId);

    const now = fmtJst_(new Date());
    const eventDate = results[0].eventDate || '';
    results.forEach(r => {
      const scoreA = Number(r.scoreA || 0);
      const scoreB = Number(r.scoreB || 0);
      const winTeam = scoreA > scoreB ? r.teamA : scoreB > scoreA ? r.teamB : 'draw';
      appendRow_(sheet, HEADERS.GameResults, {
        sessionId, eventDate, gameNumber: r.gameNumber,
        teamA: r.teamA, scoreA, teamB: r.teamB, scoreB,
        winTeam, createdAt: now,
      });
    });

    return { ok: true, message: results.length + 'ゲーム分の結果を保存しました。' };
  } finally { lock.releaseLock(); }
}

// ── 勝率データ取得（参加者も閲覧可能）──

function getWinRates(idToken) {
  verifyIdToken_(idToken);
  return { ok: true, winRates: calcWinRates_() };
}

function calcWinRates_() {
  const opsSS = getOpsSS_();
  const gsRows = readObjects_(opsSS.getSheetByName(SHEET_NAMES.GAMESETS));
  const grRows = readObjects_(opsSS.getSheetByName(SHEET_NAMES.GAMERESULTS));

  const resultMap = {};
  grRows.forEach(r => { resultMap[r.sessionId + '|' + r.gameNumber] = r; });

  const stats = {};
  gsRows.forEach(row => {
    const result = resultMap[row.sessionId + '|' + row.gameNumber];
    if (!result) return;
    const name = row.fullName;
    if (!stats[name]) stats[name] = { wins: 0, losses: 0, draws: 0, games: 0 };
    stats[name].games++;
    if (result.winTeam === 'draw') stats[name].draws++;
    else if (result.winTeam === row.teamName) stats[name].wins++;
    else stats[name].losses++;
  });

  Object.values(stats).forEach(s => {
    s.winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
  });
  return stats;
}

// ── 管理者: 提出用リスト生成 ──

function generateExportList(payload) {
  const profile = verifyIdToken_(payload.idToken);
  ensureAdmin_(profile.sub);
  const sessionId = String(payload.sessionId || '');

  const opsSS = getOpsSS_();
  const responses = readObjects_(opsSS.getSheetByName(SHEET_NAMES.RESPONSES));
  const attendees = responses
    .filter(r => r.sessionId === sessionId && (r.answer === 'yes' || r.answer === 'attended'))
    .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ja'));

  const members = readObjects_(getRosterSheet_());
  const memberMap = {};
  members.forEach(m => { if (m[MC.LINE_ID]) memberMap[m[MC.LINE_ID]] = m; });

  const list = attendees.map(a => {
    const m = memberMap[a.lineId] || {};
    return { no: a.no || m[MC.NO], fullName: a.fullName, furigana: m[MC.FURIGANA] || '', gender: m[MC.GENDER] || '', ageApril1: m[MC.AGE_APRIL1] || '' };
  });

  const exportSheet = opsSS.getSheetByName(SHEET_NAMES.EXPORT);
  const startRow = 3;
  const eventDate = attendees[0] ? attendees[0].eventDate : '';
  exportSheet.getRange('A1').setValue('参加者リスト — ' + eventDate);
  exportSheet.getRange('A2').setValue('No,氏名,ふりがな,性別,年齢');
  if (exportSheet.getLastRow() >= startRow) {
    exportSheet.getRange(startRow, 1, exportSheet.getLastRow() - startRow + 1, 5).clearContent();
  }
  if (list.length) {
    const data = list.map(l => [l.no, l.fullName, l.furigana, l.gender, l.ageApril1]);
    exportSheet.getRange(startRow, 1, data.length, 5).setValues(data);
  }

  return { ok: true, count: list.length, message: list.length + '名の参加者リストをExportTemplateシートに出力しました。' };
}

// ── スケジュールビュー ──

function buildScheduleView_(monthKey) {
  const opsSS = getOpsSS_();
  const schedRows = readObjects_(opsSS.getSheetByName(SHEET_NAMES.SCHEDULE))
    .filter(r => r.sessionId && String(r.openForResponse).toLowerCase() !== 'false');
  const respRows = readObjects_(opsSS.getSheetByName(SHEET_NAMES.RESPONSES));

  const grouped = {};
  schedRows.forEach(r => {
    if (monthKey && r.monthKey !== monthKey) return;
    const counts = countAnswers_(respRows, r.sessionId);
    if (!grouped[r.monthKey]) grouped[r.monthKey] = [];
    grouped[r.monthKey].push({
      sessionId: r.sessionId, monthKey: r.monthKey, eventDate: r.eventDate,
      title: r.title, minAttendees: Number(r.minAttendees||0), maxAttendees: Number(r.maxAttendees||0),
      note: r.note || '', counts,
      statusLabel: buildStatusLabel_(counts, Number(r.minAttendees||0), Number(r.maxAttendees||0)),
      attendees: listAttendees_(respRows, r.sessionId),
    });
  });
  return Object.keys(grouped).sort().map(k => ({
    monthKey: k,
    sessions: grouped[k].sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate))),
  }));
}

function listAttendees_(respRows, sessionId) {
  return respRows
    .filter(r => r.sessionId === sessionId && (r.answer === 'yes' || r.answer === 'attended'))
    .map(r => ({ lineId: r.lineId, no: r.no, fullName: r.fullName, answer: r.answer }))
    .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ja'));
}

function countAnswers_(respRows, sessionId) {
  return respRows.reduce((acc, r) => {
    if (r.sessionId !== sessionId) return acc;
    const a = normalizeAnswer_(r.answer);
    if (a === 'yes') acc.yes++;
    else if (a === 'no') acc.no++;
    else if (a === 'undecided') acc.undecided++;
    else if (a === 'attended') { acc.yes++; acc.attended++; }
    return acc;
  }, { yes: 0, no: 0, undecided: 0, attended: 0 });
}

function buildStatusLabel_(counts, min, max) {
  if (max && counts.yes >= max) return '定員到達';
  if (min && counts.yes < min) return '開催判断待ち';
  return '開催見込み';
}

// ── ヘルパー ──

function findMemberByLineId_(lineId) {
  const rows = readObjects_(getRosterSheet_());
  return rows.find(r => r[MC.LINE_ID] === lineId && isActiveMember_(r)) || null;
}

function isActiveMember_(r) {
  const s = String(r[MC.STATUS] || '').trim();
  return s !== '退会' && s !== '休会';
}

function getScheduleMap_() {
  return readObjects_(getOpsSS_().getSheetByName(SHEET_NAMES.SCHEDULE))
    .reduce((m, r) => { if (r.sessionId) m[r.sessionId] = r; return m; }, {});
}

function verifyIdToken_(idToken) {
  if (!idToken) throw new Error('IDトークンを取得できませんでした。');
  const chId = getReqProp_('LINE_LOGIN_CHANNEL_ID');
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', contentType: 'application/x-www-form-urlencoded',
    payload: { id_token: idToken, client_id: chId }, muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) throw new Error('LINE IDトークン検証失敗: ' + (body.error_description || body.message || res.getResponseCode()));
  return body;
}

function checkAdmin_(uid) {
  const raw = PropertiesService.getScriptProperties().getProperty('ADMIN_LINE_USER_IDS') || '';
  return raw.split(',').map(v => v.trim()).filter(Boolean).includes(uid);
}

function ensureAdmin_(uid) {
  if (!checkAdmin_(uid)) throw new Error('管理者権限がありません。');
}

function clearSessionRows_(sheet, sessionId) {
  const rows = readObjects_(sheet);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].sessionId === sessionId) sheet.deleteRow(i + 2);
  }
}

function normalizeAnswer_(a) {
  const v = String(a || '').trim().toLowerCase();
  return ['yes','no','undecided','attended'].includes(v) ? v : 'undecided';
}

// ── シート操作 ──

function createSheetIfMissing_(ss, name, headers) {
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
  }
  return s;
}

function appendRow_(sheet, headers, obj) {
  sheet.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function writeRow_(sheet, rowNum, headers, obj) {
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([headers.map(h => obj[h] !== undefined ? obj[h] : '')]);
}

function readObjects_(sheet) {
  const lr = sheet.getLastRow(), lc = sheet.getLastColumn();
  if (lr < 2 || lc < 1) return [];
  const vals = sheet.getRange(1, 1, lr, lc).getDisplayValues();
  const hdr = vals[0];
  return vals.slice(1).filter(r => r.some(c => c !== '')).map(r => hdr.reduce((o, h, i) => { o[h] = r[i]; return o; }, {}));
}

function getSheetHeaders_(sheet) {
  const lc = sheet.getLastColumn();
  if (lc < 1) return [];
  return sheet.getRange(1, 1, 1, lc).getDisplayValues()[0];
}

function setColValue_(sheet, headers, rowNum, colName, value) {
  const col = headers.indexOf(colName);
  if (col >= 0) sheet.getRange(rowNum, col + 1).setValue(value);
}

// ── スプレッドシート取得 ──

function getRosterSS_() { return SpreadsheetApp.openById(getReqProp_('ROSTER_SPREADSHEET_ID')); }
function getRosterSheet_() { return getRosterSS_().getSheetByName(SHEET_NAMES.MEMBERS); }
function getOpsSS_() { return SpreadsheetApp.openById(getReqProp_('SPREADSHEET_ID')); }

function getReqProp_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('スクリプトプロパティ ' + key + ' が未設定です。');
  return v;
}

function fmtJst_(d) { return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'); }
