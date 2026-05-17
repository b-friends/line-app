/* =====================================================
   DevData.gs — 動作検証用ダミーデータ投入
   Apps Script エディタから直接実行する
   本番運用前に必ず deleteDummyData() で削除すること
   ===================================================== */

const DUMMY_PREFIX = 'DUMMY_';

// 検証期間のセッション（5/17〜5/22 毎日）
const VERIFICATION_SESSIONS = [
  { date: '2026-05-17', title: '検証活動①' },
  { date: '2026-05-18', title: '検証活動②' },
  { date: '2026-05-19', title: '検証活動③' },
  { date: '2026-05-20', title: '検証活動④' },
  { date: '2026-05-21', title: '検証活動⑤' },
  { date: '2026-05-22', title: '検証活動⑥' },
];

/**
 * ダミーデータを全投入して活動報告書も更新
 */
function insertDummyData() {
  insertDummyMembers();
  insertDummySchedule();
  insertDummyResponses();
  VERIFICATION_SESSIONS.forEach((_, i) => {
    updateActivityReport_(DUMMY_PREFIX + 'S' + String(i + 1).padStart(3, '0'));
  });
  Logger.log('ダミーデータ投入完了');
}

/**
 * ダミーメンバー20名を名簿に追加（男女・年齢・体験をバランスよく配置）
 */
function insertDummyMembers() {
  const sheet = getRosterSheet_();
  const headers = getSheetHeaders_(sheet);
  const existing = readObjects_(sheet);
  const maxNo = existing.reduce((mx, r) => Math.max(mx, Number(r[MC.NO]) || 0), 0);

  const members = [
    // [氏名, ふりがな, 性別, 生年月日, 携帯, 住所, ステータス]
    ['田中 太郎',   'たなか たろう',   '男', '1975-04-15', '090-0001-0001', '東京都新宿区1-1',    '入会'],
    ['鈴木 花子',   'すずき はなこ',   '女', '1982-07-20', '090-0001-0002', '東京都渋谷区2-2',    '入会'],
    ['佐藤 健一',   'さとう けんいち', '男', '1968-11-03', '090-0001-0003', '東京都港区3-3',      '入会'],
    ['山田 美咲',   'やまだ みさき',   '女', '1990-02-14', '090-0001-0004', '東京都品川区4-4',    '入会'],
    ['伊藤 浩二',   'いとう こうじ',   '男', '1985-09-28', '090-0001-0005', '東京都目黒区5-5',    '入会'],
    ['渡辺 由美',   'わたなべ ゆみ',   '女', '1978-06-10', '090-0001-0006', '東京都世田谷区6-6',  '入会'],
    ['中村 大輔',   'なかむら だいすけ','男', '1992-03-05', '090-0001-0007', '東京都杉並区7-7',    '入会'],
    ['小林 恵子',   'こばやし けいこ', '女', '1970-12-25', '090-0001-0008', '東京都中野区8-8',    '入会'],
    ['加藤 誠',     'かとう まこと',   '男', '1988-08-18', '090-0001-0009', '東京都練馬区9-9',    '入会'],
    ['吉田 さくら', 'よしだ さくら',   '女', '1995-05-30', '090-0001-0010', '東京都板橋区10-10',  '入会'],
    ['山本 隆',     'やまもと たかし', '男', '1965-01-22', '090-0001-0011', '東京都豊島区11-11',  '入会'],
    ['松本 奈々',   'まつもと なな',   '女', '1987-10-08', '090-0001-0012', '東京都北区12-12',    '入会'],
    ['井上 修',     'いのうえ おさむ', '男', '1972-04-17', '090-0001-0013', '東京都荒川区13-13',  '入会'],
    ['木村 真理',   'きむら まり',     '女', '1993-07-12', '090-0001-0014', '東京都足立区14-14',  '入会'],
    ['林 俊介',     'はやし しゅんすけ','男', '1980-02-28', '090-0001-0015', '東京都葛飾区15-15',  '入会'],
    ['清水 陽子',   'しみず ようこ',   '女', '1976-09-03', '090-0001-0016', '東京都江戸川区16-16','入会'],
    ['山口 博',     'やまぐち ひろし', '男', '1960-06-14', '090-0001-0017', '東京都江東区17-17',  '入会'],
    ['斎藤 麻衣',   'さいとう まい',   '女', '1998-11-19', '090-0001-0018', '東京都墨田区18-18',  '入会'],
    ['体験 太郎',   'たいけん たろう', '男', '2000-03-10', '090-0001-0019', '東京都台東区19-19',  '体験'],
    ['体験 花子',   'たいけん はなこ', '女', '2001-08-25', '090-0001-0020', '東京都文京区20-20',  '体験'],
  ];

  const april1 = new Date(new Date().getFullYear(), 3, 1);
  members.forEach((m, i) => {
    const [fullName, furigana, gender, birthDate, mobile, address, status] = m;
    if (existing.some(r => r[MC.FULL_NAME] === fullName)) return;
    const bd = new Date(birthDate);
    const age = Math.floor((april1 - bd) / (365.25 * 24 * 60 * 60 * 1000));
    const newNo = maxNo + i + 1;
    const row = headers.map(h => {
      switch (h) {
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
    appendRowRaw_(sheet, headers, row);
  });
  Logger.log('ダミーメンバー投入完了');
}

/**
 * VERIFICATION_SESSIONS のセッションをScheduleに追加
 */
function insertDummySchedule() {
  const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.SCHEDULE);
  const existing = readObjects_(sheet);

  VERIFICATION_SESSIONS.forEach((ses, i) => {
    const sessionId = DUMMY_PREFIX + 'S' + String(i + 1).padStart(3, '0');
    if (existing.some(r => r.sessionId === sessionId)) {
      Logger.log('既存スケジュール: ' + sessionId);
      return;
    }
    appendRow_(sheet, HEADERS.Schedule, {
      sessionId,
      monthKey:        ses.date.slice(0, 7),
      eventDate:       ses.date,
      title:           ses.title,
      minAttendees:    3,
      maxAttendees:    40,
      openForResponse: true,
      note:            'ダミーデータ',
    });
  });
  Logger.log('ダミースケジュール投入完了');
}

/**
 * ダミーメンバー全員を全セッションに「参加済（attended）」で登録
 */
function insertDummyResponses() {
  const sheet = getOpsSS_().getSheetByName(SHEET_NAMES.RESPONSES);
  const existing = readObjects_(sheet);
  const members = readObjects_(getRosterSheet_())
    .filter(r => r[MC.LINE_ID] && r[MC.LINE_ID].startsWith(DUMMY_PREFIX));
  const now = fmtJst_(new Date());

  VERIFICATION_SESSIONS.forEach((ses, i) => {
    const sessionId = DUMMY_PREFIX + 'S' + String(i + 1).padStart(3, '0');
    members.forEach(m => {
      if (existing.some(r => r.lineId === m[MC.LINE_ID] && r.sessionId === sessionId)) return;
      appendRow_(sheet, HEADERS.Responses, {
        lineId:          m[MC.LINE_ID],
        no:              m[MC.NO],
        fullName:        m[MC.FULL_NAME],
        sessionId,
        monthKey:        ses.date.slice(0, 7),
        eventDate:       ses.date,
        title:           ses.title,
        answer:          'attended',
        note:            '',
        lineDisplayName: m[MC.LINE_NAME],
        submittedAt:     now,
      });
    });
  });
  Logger.log('ダミー参加回答投入完了: ' + members.length + '名 × ' + VERIFICATION_SESSIONS.length + 'セッション');
}

/**
 * ダミーデータを全削除
 * Members・Schedule・Responses・GameSets・GameResults・Report_シートを削除
 */
function deleteDummyData() {
  const opsSS = getOpsSS_();

  _deleteRowsWithPrefix_(opsSS.getSheetByName(SHEET_NAMES.RESPONSES),  'lineId');
  _deleteRowsWithPrefix_(opsSS.getSheetByName(SHEET_NAMES.RESPONSES),  'sessionId');
  _deleteRowsWithPrefix_(opsSS.getSheetByName(SHEET_NAMES.GAMESETS),   'sessionId');
  _deleteRowsWithPrefix_(opsSS.getSheetByName(SHEET_NAMES.GAMERESULTS),'sessionId');
  _deleteRowsWithPrefix_(opsSS.getSheetByName(SHEET_NAMES.SCHEDULE),   'sessionId');
  _deleteRowsWithPrefix_(getRosterSheet_(), MC.LINE_ID);

  // ダミーセッションが含まれる月のレポートシートを削除
  const dummyMonths = [...new Set(VERIFICATION_SESSIONS.map(s => s.date.slice(0, 7).replace('-', '')))];
  dummyMonths.forEach(ym => {
    const rs = opsSS.getSheetByName('Report_' + ym);
    if (rs) opsSS.deleteSheet(rs);
  });

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
