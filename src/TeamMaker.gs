/* =====================================================
   TeamMaker.gs — チーム編成ロジック（強化版）
   - 補正勝率・得点差の複合スコアでチーム均一化
   - 局所探索（スワップ）でチーム間スコア差を最小化
   - 同チーム回数・対戦回数を考慮したローテーション
   - 体験者は余り発生時に優先参加
   ===================================================== */

/**
 * 1ゲーム分のチーム編成
 * @param {Object[]} players [{no,fullName,lineId,gender,ageApril1,winRate,totalGames,isTrial}]
 * @param {number} gameNumber
 * @param {Object} pairCount    同チーム回数 {key: count}
 * @param {Object} vsCount      対戦回数    {key: count}
 * @return {{teams, matchups, numTeams}}
 */
function makeOneGame(players, gameNumber, pairCount, vsCount) {
  const n = players.length;
  const numTeams = n >= 13 ? 4 : 2;
  vsCount = vsCount || {};

  // 複合スコアを計算（チーム均一化の基準）
  const scores = computeScores_(players);

  // 初期配置: スネークドラフト（複合スコア順）
  let teams = snakeDraft_(players, scores, numTeams);

  // 局所探索: チーム間スコア差 + 同チーム回数ペナルティを最小化
  teams = localSearch_(teams, scores, pairCount, numTeams);

  // ペアカウント更新
  teams.forEach(t => {
    for (let i = 0; i < t.length; i++)
      for (let j = i + 1; j < t.length; j++) {
        const key = pairKey_(t[i], t[j]);
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
  });

  // 対戦組み合わせ（対戦回数が少ないペアを優先）
  const matchups = buildMatchups_(teams, vsCount, numTeams, gameNumber);

  // 対戦カウント更新
  matchups.forEach(mu => {
    const key = [mu.teamA, mu.teamB].sort().join('|');
    vsCount[key] = (vsCount[key] || 0) + 1;
  });

  return {
    numTeams,
    teams: teams.map((members, i) => ({
      name: 'チーム' + String.fromCharCode(65 + i),
      members: members.map(p => ({
        no: p.no, fullName: p.fullName, gender: p.gender,
        ageApril1: p.ageApril1, winRate: p.winRate, totalGames: p.totalGames,
        avgScoreDiff: p.avgScoreDiff || 0, isTrial: p.isTrial || false,
      })),
      genderSummary: genderSummary_(members),
      ageSummary: ageSummary_(members),
      avgWinRate: avgWinRate_(members),
    })),
    matchups: matchups.map(mu =>
      mu.teamA + ' vs ' + mu.teamB + (mu.court ? '（コート' + mu.court + '）' : '')
    ),
  };
}

/**
/**
 * 複合スコア計算
 * 補正勝率(60%) + 平均得点差正規化(40%)
 * 試合数が少ない人はベイズ補正で50%に近づく
 */
function computeScores_(players) {
  const diffs = players.map(p => p.avgScoreDiff || 0);
  const minDiff = Math.min(...diffs);
  const maxDiff = Math.max(...diffs);
  const diffRange = maxDiff - minDiff || 1;

  return players.map(p => {
    const winScore  = p.winRate / 100;
    const diffScore = ((p.avgScoreDiff || 0) - minDiff) / diffRange;
    return winScore * 0.6 + diffScore * 0.4;
  });
}

/** スネークドラフト */
function snakeDraft_(players, scores, numTeams) {
  const indexed = players.map((p, i) => ({ p, s: scores[i] }))
    .sort((a, b) => b.s - a.s);
  const teams = Array.from({ length: numTeams }, () => []);
  indexed.forEach(({ p }, i) => {
    const round = Math.floor(i / numTeams);
    const pos   = i % numTeams;
    const ti    = round % 2 === 0 ? pos : numTeams - 1 - pos;
    teams[ti].push(p);
  });
  return teams;
}

/**
 * 局所探索（スワップ）
 * チーム間スコア差 + 同チームペナルティを最小化
 * 最大200回スワップ試行
 */
function localSearch_(teams, scores, pairCount, numTeams) {
  const playerScore = {};
  teams.forEach((t, ti) => t.forEach(p => { playerScore[p.fullName] = scores[teams.flat().indexOf(p)]; }));

  // スコアマップを再構築（インデックスがずれないよう）
  const allPlayers = teams.flat();
  const scoreMap = {};
  allPlayers.forEach((p, i) => { scoreMap[p.fullName] = scores[i] || 0; });

  function teamScore(t) {
    return t.reduce((s, p) => s + (scoreMap[p.fullName] || 0), 0) / (t.length || 1);
  }

  function pairPenalty(t) {
    let pen = 0;
    for (let i = 0; i < t.length; i++)
      for (let j = i + 1; j < t.length; j++)
        pen += pairCount[pairKey_(t[i], t[j])] || 0;
    return pen;
  }

  function totalCost(ts) {
    const avgs = ts.map(teamScore);
    const mean = avgs.reduce((s, v) => s + v, 0) / numTeams;
    const variance = avgs.reduce((s, v) => s + (v - mean) ** 2, 0);
    const penalty  = ts.reduce((s, t) => s + pairPenalty(t), 0);
    return variance * 10 + penalty * 0.5;
  }

  let best = teams.map(t => [...t]);
  let bestCost = totalCost(best);

  for (let iter = 0; iter < 200; iter++) {
    // ランダムに2チームを選んでメンバーをスワップ
    const ti = Math.floor(Math.random() * numTeams);
    let tj = Math.floor(Math.random() * (numTeams - 1));
    if (tj >= ti) tj++;
    if (!best[ti].length || !best[tj].length) continue;
    const ai = Math.floor(Math.random() * best[ti].length);
    const bi = Math.floor(Math.random() * best[tj].length);

    const next = best.map(t => [...t]);
    [next[ti][ai], next[tj][bi]] = [next[tj][bi], next[ti][ai]];

    // 性別バランスが極端に崩れるスワップは却下
    const maleA = next[ti].filter(p => p.gender === '男').length;
    const maleB = next[tj].filter(p => p.gender === '男').length;
    const totalMale = maleA + maleB;
    if (Math.abs(maleA - maleB) > totalMale * 0.6 + 1) continue;

    const cost = totalCost(next);
    if (cost < bestCost) { best = next; bestCost = cost; }
  }

  return best;
}

/**
 * 対戦組み合わせ構築
 * 対戦回数が少ないペアを優先
 */
function buildMatchups_(teams, vsCount, numTeams, gameNumber) {
  const names = teams.map((_, i) => 'チーム' + String.fromCharCode(65 + i));
  if (numTeams === 2) {
    return [{ teamA: names[0], teamB: names[1], court: null }];
  }
  // 4チーム: 3パターンをローテーション、対戦回数が少ない組み合わせを優先
  const patterns = [
    [[0,1],[2,3]],
    [[0,2],[1,3]],
    [[0,3],[1,2]],
  ];
  // 各パターンの対戦回数合計を計算
  const patternCosts = patterns.map(pat =>
    pat.reduce((s, [a, b]) => {
      const key = [names[a], names[b]].sort().join('|');
      return s + (vsCount[key] || 0);
    }, 0)
  );
  // 最小コストのパターンを選択（同コストならゲーム番号でローテーション）
  const minCost = Math.min(...patternCosts);
  const candidates = patterns.filter((_, i) => patternCosts[i] === minCost);
  const pat = candidates[(gameNumber - 1) % candidates.length];
  return pat.map(([a, b], i) => ({ teamA: names[a], teamB: names[b], court: i + 1 }));
}

/**
 * 休憩者の自動提案
 * 余り人数分を一般メンバーから優先的に選ぶ（体験者は最後）
 * 前ゲームで参加した人（休憩していない人）を先に休憩候補にする
 */
function suggestRest(allPlayers) {
  const n = allPlayers.length;
  const playCount = n >= 13 ? Math.min(n, 16) : Math.min(n, 8);
  const restCount = n - playCount;
  if (restCount <= 0) return [];

  // 体験者は最後に休憩候補、在席参加率が高い人を優先的に休憩候補
  const sorted = allPlayers.slice().sort((a, b) => {
    if (a.isTrial !== b.isTrial) return a.isTrial ? 1 : -1;
    return b.attendanceRate - a.attendanceRate;
  });

  return sorted.slice(0, restCount).map(p => p.lineId);
}

// ── ユーティリティ ──

function pairKey_(a, b) {
  return [a.fullName, b.fullName].sort().join('|');
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
  const rates = members.map(p => p.winRate);
  if (!rates.length) return '-';
  return Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) + '%';
}

function shuffleArray_(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
