/* =====================================================
   DevData.gs — 動作検証用ダミーデータ投入
   Apps Script エディタから直接実行する
   本番運用前に必ず deleteDummyData() で削除すること
   ===================================================== */

// ダミーメンバーのプレフィックス（削除時の識別用）
const DUMMY_PREFIX = 'DUMMY_';

/**
 * ダミーデータを全投入
 * 実行順: メンバー → スケジュール → 参加回答
 */
function insertDummyData() {
  insertDummyMembers();
  insertDummySchedule();
  insertDummyResponses();
  Logger.log('ダミーデータ投入完了');
}

/**
 * ダミーメンバー20名を名簿に追加
 * 男女・年齢・勝率がバラけるよう設定
 */
function insertDummyMembers() {
  const sheet = getRosterSheet_();
  const headers = getSheetHeaders_(sheet);
  const existing = readObjects_(sheet);
  const maxNo = existing.reduce((mx, r) => Math.max(mx, Number(r[MC.NO]) || 0), 0);

  const members = [
    // [氏名, ふりがな, 性別, 生年月日, 携帯, 住所, ステータス]
    ['田中 太郎',   'たなか たろう',   '男', '1975-04-15', '090-0001-0001', '東京都新宿区1-1', '入会'],
    ['鈴木 花子',   'すずき はなこ',   '女', '1982-07-20', '090-0001-0002', '東京都渋谷区2-2', '入会'],
    ['佐藤 健一',   'さとう けんいち', '男', '1968-11-03', '090-0001-0003', '東京都港区3-3',   '入会'],
    ['山田 美咲',   'やまだ みさき',   '女', '1990-02-14', '090-0001-0004', '東京都品川区4-4', '入会'],
    ['伊藤 浩二',   'いとう こうじ',   '男', '1985-09-28', '090-0001-0005', '東京都目黒区5-5', '入会'],
    ['渡辺 由美',   'わたなべ ゆみ',   '女', '1978-06-10', '090-0001-0006', '東京都世田谷区6-6','入会'],
    ['中村 大輔',   'なかむら だいすけ','男', '1992-03-05', '090-0001-0007', '東京都杉並区7-7', '入会'],
    ['小林 恵子',   'こばやし けいこ', '女', '1970-12-25', '090-0001-0008', '東京都中野区8-8', '入会'],
    ['加藤 誠',     'かとう まこと',   '男', '1988-08-18', '090-0001-0009', '東京都練馬区9-9', '入会'],
    ['吉田 さくら', 'よしだ さくら',   '女', '1995-05-30', '090-0001-0010', '東京都板橋区10-10','入会'],
    ['山本 隆',     'やまもと たかし', '男', '1965-01-22', '090-0001-0011', '東京都豊島区11-11','入会'],
    ['松本 奈々',   'まつもと なな',   '女', '1987-10-08', '090-0001-0012', '東京都北区12-12', '入会'],
    ['井上 修',     'いのうえ おさむ', '男', '1972-04-17', '090-0001-0013', '東京都荒川区13-13','入会'],
    ['木村 真理',   'きむら まり',     '女', '1993-07-12', '090-0001-0014', '東京都足立区14-14','入会'],
    ['林 俊介',     'はやし しゅんすけ','男', '1980-02-28', '090-0001-0015', '東京都葛飾区15-15','入会'],
    ['清水 陽子',   'しみず ようこ',   '女', '1976-09-03', '090-0001-0016', '東京都江戸川区16-16','入会'],
    ['山口 博',     'やまぐち ひろし', '男', '1960-06-14', '090-0001-0017', '東京都江東区17-17','入会'],
    ['斎藤 麻衣',   'さいとう まい',   '女', '1998-11-19', '090-0001-0018', '東京都墨田区18-18','入会'],
    ['体験 太郎',   'たいけん たろう', '男', '2000-03-10', '090-0001-0019', '東京都台東区19-19','体験'],
    ['体験 花子',   'たいけん はなこ', '女', '2001-08-25', '090-0001-0020', '東京都文京区20-20','体験'],
  ];

  const april1 = new Date(new Date().getFullYear(), 3, 1);
  members.forEach((m, i) => {
    const [fullName, furigana, gender, birthDate, mobile, address, status] = m;
    // 重複チェック
    if (existing.some(r => r[MC.FULL_NAME] === fullName)) return;
    const bd = new Date(birthDate);
    const age = Math.floor((april1 - bd) / (365.25 * 24 * 60 * 60 * 1000));
    const newNo = maxNo + i + 1;
    const row = headers.map(h => {
      switch(h) {
        case MC.STATUS:       return status;
        case MC.NO:           return newNo;
        case MC.FULL_NAME:    return fullName;
        case MC.FURIGANA:     return furigana;
        case MC.GENDER:       return gender;
        case MC.BIRTH_DATE:   return birthDate;
        case MC.AGE_APRIL1:   return age;
        case MC.MOBILE_PHONE: return mobile;
        case MC.ADDRESS:      return address;
        case MC.CONTACT:      return 'LINE';
        case MC.LINE_ID:      return DUMMY_PREFIX + 'U' + String(newNo).padStart(4, '0');
        case MC.LINE_NAME:    return fullName;
        case MC.NOTE:         return 'ダミーデータ';
        default:              return '';
      }
    });
    sheet.appendRow(row);
  });
  Logger.log('ダミーメンバー投入完了');
}

/**
 * 今日の日付でダミースケジュールを1件追加
 */
function insertDummySchedule() {
  const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.SCHEDULE);
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const monthKey = today.slice(0, 7);
  const existing = readObjects_(sheet);
  if (existing.some(r => r.eventDate === today && r.title === 'ダミー活動')) {
    Logger.log('ダミースケジュール既存');
    return;
  }
  appendRow_(sheet, HEADERS.Schedule, {
    sessionId: DUMMY_PREFIX + 'S001',
    monthKey, eventDate: today, title: 'ダミー活動',
    minAttendees: 3, maxAttendees: 40, openForResponse: true, note: 'ダミーデータ',
  });
  Logger.log('ダミースケジュール投入完了: ' + today);
}

/**
 * ダミーメンバー全員を今日のセッションに「参加」で回答
 */
function insertDummyResponses() {
  const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES);
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const monthKey = today.slice(0, 7);
  const sessionId = DUMMY_PREFIX + 'S001';
  const existing = readObjects_(sheet);
  const members = readObjects_(getRosterSheet_())
    .filter(r => r[MC.LINE_ID] && r[MC.LINE_ID].startsWith(DUMMY_PREFIX));
  const now = fmtJst_(new Date());

  members.forEach(m => {
    if (existing.some(r => r.lineId === m[MC.LINE_ID] && r.sessionId === sessionId)) return;
    appendRow_(sheet, HEADERS.Responses, {
      lineId: m[MC.LINE_ID], no: m[MC.NO], fullName: m[MC.FULL_NAME],
      sessionId, monthKey, eventDate: today, title: 'ダミー活動',
      answer: 'yes', note: '', lineDisplayName: m[MC.LINE_NAME], submittedAt: now,
    });
  });
  Logger.log('ダミー参加回答投入完了: ' + members.length + '名');
}

/**
 * ダミーデータを全削除
 * メンバー・スケジュール・参加回答・GameSets・GameResults から削除
 */
function deleteDummyData() {
  // Responses
  _deleteRowsWithPrefix_(getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES), 'lineId');
  _deleteRowsWithPrefix_(getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES), 'sessionId');
  // GameSets
  _deleteRowsWithPrefix_(getOpsSS_().getSheetByName(SHEET_NAMES.GAMESETS), 'sessionId');
  // GameResults
  _deleteRowsWithPrefix_(getOpsSS_().getSheetByName(SHEET_NAMES.GAMERESULTS), 'sessionId');
  // Schedule
  _deleteRowsWithPrefix_(getOpsSS_().getSheetByName(SHEET_NAMES.SCHEDULE), 'sessionId');
  // Members
  _deleteRowsWithPrefix_(getRosterSheet_(), MC.LINE_ID);
  Logger.log('ダミーデータ削除完了');
}

function _deleteRowsWithPrefix_(sheet, colName) {
  const rows = readObjects_(sheet);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][colName] || '').startsWith(DUMMY_PREFIX)) {
      sheet.deleteRow(i + 2);
    }
  }
}

/**
 * ダミーの当日参加チェック（attended）を設定
 * チーム編成テスト用
 */
function setDummyAttended() {
  const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES);
  const rows = readObjects_(sheet);
  const sessionId = DUMMY_PREFIX + 'S001';
  rows.forEach((r, i) => {
    if (r.sessionId === sessionId && r.answer === 'yes') {
      sheet.getRange(i + 2, HEADERS.Responses.indexOf('answer') + 1).setValue('attended');
    }
  });
  Logger.log('ダミーattended設定完了');
}
