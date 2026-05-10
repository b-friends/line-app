/* =====================================================
   TeamMaker.gs — チーム編成ロジック
   ソフトバレー: 基本4対4（最低3人/チーム）
   14名以上→4チーム、13名以下→2チーム
   年齢・性別・勝率バランス＋ローテーション
   ===================================================== */

/**
 * @param {Object[]} players - [{no, fullName, lineId, gender, ageApril1, winRate, totalGames}]
 * @param {number} numGames
 * @return {{games: Array, summary: string}}
 */
function makeTeams(players, numGames) {
  const n = players.length;
  const numTeams = n >= 14 ? 4 : 2;

  // 年齢層分類
  players.forEach(p => {
    p._cat = p.ageApril1 <= 35 ? 'young' : p.ageApril1 <= 50 ? 'mid' : 'senior';
  });

  const games = [];
  const pairCount = {};

  for (let g = 0; g < numGames; g++) {
    const pool = g === 0
      ? balancedShuffle_(players)
      : rotationShuffle_(players, pairCount);

    // スネークドラフト（勝率順にソートしてから振り分け → チーム間の勝率合計が均等に）
    const sorted = pool.slice().sort((a, b) => b.winRate - a.winRate);
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      name: 'チーム' + String.fromCharCode(65 + i),
      members: [],
    }));

    sorted.forEach((p, i) => {
      const round = Math.floor(i / numTeams);
      const pos = i % numTeams;
      const teamIdx = round % 2 === 0 ? pos : numTeams - 1 - pos;
      teams[teamIdx].members.push(p);
    });

    // ペアカウント更新
    teams.forEach(t => {
      for (let i = 0; i < t.members.length; i++) {
        for (let j = i + 1; j < t.members.length; j++) {
          const key = pairKey_(t.members[i], t.members[j]);
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });

    // 対戦組合せ（4チーム時はゲームごとにローテーション）
    let matchups;
    if (numTeams === 4) {
      const patterns = [
        ['チームA vs チームB（コート1）', 'チームC vs チームD（コート2）'],
        ['チームA vs チームC（コート1）', 'チームB vs チームD（コート2）'],
        ['チームA vs チームD（コート1）', 'チームB vs チームC（コート2）'],
      ];
      matchups = patterns[g % patterns.length];
    } else {
      matchups = ['チームA vs チームB'];
    }

    games.push({
      gameNumber: g + 1,
      teams: teams.map(t => ({
        name: t.name,
        members: t.members.map(p => ({
          no: p.no, fullName: p.fullName, gender: p.gender,
          ageApril1: p.ageApril1, winRate: p.winRate, totalGames: p.totalGames,
        })),
        genderSummary: genderSummary_(t.members),
        ageSummary: ageSummary_(t.members),
        avgWinRate: avgWinRate_(t.members),
      })),
      matchups,
    });
  }

  return {
    games,
    numTeams,
    playerCount: n,
    summary: n + '名 → ' + numTeams + 'チーム × ' + numGames + 'ゲーム',
  };
}

/** 初回: 性別×年齢層バケットからラウンドロビン */
function balancedShuffle_(players) {
  const buckets = {};
  players.forEach(p => {
    const key = p.gender + '_' + p._cat;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(p);
  });
  Object.values(buckets).forEach(arr => shuffleArray_(arr));
  const keys = Object.keys(buckets).sort();
  const result = [];
  let added = true;
  while (added) {
    added = false;
    keys.forEach(k => {
      if (buckets[k].length) { result.push(buckets[k].shift()); added = true; }
    });
  }
  return result;
}

/** 2ゲーム目以降: 同チーム回数が多いペアを離す＋性別交互 */
function rotationShuffle_(players, pairCount) {
  const pool = players.slice();
  shuffleArray_(pool);
  pool.sort((a, b) => {
    const scoreA = pool.reduce((s, p) => s + (pairCount[pairKey_(a, p)] || 0), 0);
    const scoreB = pool.reduce((s, p) => s + (pairCount[pairKey_(b, p)] || 0), 0);
    return scoreB - scoreA;
  });
  return interleaveByGender_(pool);
}

function interleaveByGender_(players) {
  const males = players.filter(p => p.gender === '男');
  const females = players.filter(p => p.gender !== '男');
  const result = [];
  const maxLen = Math.max(males.length, females.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < females.length) result.push(females[i]);
    if (i < males.length) result.push(males[i]);
  }
  return result;
}

function pairKey_(a, b) {
  const ids = [a.fullName, b.fullName].sort();
  return ids[0] + '|' + ids[1];
}

function genderSummary_(members) {
  const m = members.filter(p => p.gender === '男').length;
  return '男' + m + ' 女' + (members.length - m);
}

function ageSummary_(members) {
  const ages = members.map(p => p.ageApril1).filter(a => a > 0);
  if (!ages.length) return '-';
  return '平均' + Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) + '歳';
}

function avgWinRate_(members) {
  const rates = members.map(p => p.winRate).filter(r => r !== undefined);
  if (!rates.length) return '-';
  return Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) + '%';
}

function shuffleArray_(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
