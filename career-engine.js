"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CareerEngine = api;
})(typeof window === "object" ? window : globalThis, () => {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const number = (value) => Math.max(0, Number(value) || 0);
  const TRACKS = Object.freeze({
    contact: { label: "擊球串聯", detail: "安打 +3、保送 +2", effect: "擊球接觸判定", points: (m) => number(m.hits) * 3 + number(m.walks) * 2 },
    power: { label: "長打威脅", detail: "二壘打 +4、三壘打 +6、全壘打 +10", effect: "長打判定", points: (m) => number(m.doubles) * 4 + number(m.triples) * 6 + number(m.homeRuns) * 10 },
    speed: { label: "跑壘突破", detail: "成功盜壘 +5、得分 +1、盜壘失敗 −2", effect: "盜壘成功率", points: (m) => Math.max(0, number(m.steals) * 5 + number(m.runs) - number(m.caughtStealing) * 2) },
    defense: { label: "鐵壁防線", detail: "成功處理 +2、阻止失分 +3、失誤 −3", effect: "守備成功率", points: (m) => Math.max(0, number(m.fieldSuccess) * 2 + number(m.savedRuns) * 3 - number(m.errors) * 3) },
    pitching: { label: "投手主宰", detail: "實戰三振 +2、無失分半局 +2", effect: "投球壓制判定", points: (m) => number(m.pitchingStrikeouts) * 2 + number(m.scorelessHalves) * 2 },
    catcher: { label: "本壘指揮", detail: "成功配球 +2、阻止推進 +3", effect: "捕手配球判定", points: (m) => number(m.catcherSuccess) * 2 + number(m.runnerStops) * 3 },
  });
  function specialization(position, templateId) {
    if (position === "P") return "pitching";
    if (position === "C") return "catcher";
    if (["slugger", "corner-cannon"].includes(templateId)) return "power";
    if (templateId === "speedster") return "speed";
    if (["defender", "middle-infield"].includes(templateId)) return "defense";
    return "contact";
  }
  function badge(points) {
    const n = number(points);
    if (n >= 150) return { tier: 3, label: "金", next: 150, bonus: .03 };
    if (n >= 70) return { tier: 2, label: "銀", next: 150, bonus: .02 };
    if (n >= 24) return { tier: 1, label: "銅", next: 70, bonus: .01 };
    return { tier: 0, label: "未解鎖", next: 24, bonus: 0 };
  }
  function upgradePrice(value, focus = false) {
    const base = value >= 90 ? 500 : value >= 85 ? 340 : value >= 80 ? 240 : value >= 75 ? 78 : value >= 70 ? 55 : 36;
    return Math.ceil(base * (focus ? .9 : 1));
  }
  function grade(position, m) {
    const e = m.earned || {};
    let contribution = number(e.hits) * 9 + number(e.walks) * 6 + number(e.homeRuns) * 6 + number(e.runs) * 3;
    if (position === "P") contribution = number(e.scorelessHalves) * 2 + number(e.pitchingStrikeouts) * 2 - number(m.pitchingER) * 3;
    else if (position === "C") contribution += number(e.catcherSuccess) * 2 + number(e.runnerStops) * 3;
    else contribution += number(e.fieldSuccess) * 4 + number(e.savedRuns) * 4;
    return clamp(Math.round(60 + contribution - number(m.strikeouts) * (position === "P" ? 0 : 2) - number(m.errors) * 5 - number(m.caughtStealing) * 3 - number(m.timeouts) * 6), 25, 99);
  }
  function objective(position, gameNo = 1) {
    if (position === "P") return { label: "投出 2 個無失分半局", key: "scorelessHalves", target: 2 };
    if (position === "C") return { label: "完成 2 個成功配球半局", key: "catcherSuccess", target: 2 };
    if (position === "1B") return { label: "完成 1 次一壘接球出局", key: "fieldSuccess", target: 1 };
    if (["2B", "SS"].includes(position)) return { label: "完成 1 次中線守備處理", key: "fieldSuccess", target: 1 };
    if (position === "3B") return { label: "完成 1 次三壘守備處理", key: "fieldSuccess", target: 1 };
    if (gameNo % 2 === 0) return { label: "以安打或保送上壘 1 次", key: "onBase", target: 1 };
    return { label: "完成 1 次外野接殺或回傳", key: "fieldSuccess", target: 1 };
  }
  function keyGame(game, world) {
    if (!game) return null;
    if (game.isPostseason) return { label: game.title, detail: "個人評分達到 78", minGrade: 78 };
    const played = world.played || 0;
    if (played === 0) return { label: "一軍先發首戰", detail: "個人評分達到 68", minGrade: 68 };
    if (played >= 100 && played % 5 === 0) return { label: "排名卡位戰", detail: "個人評分達到 78", minGrade: 78 };
    if ((played + 1) % 10 === 0) return { label: "宿敵之夜", detail: "個人評分達到 75", minGrade: 75 };
    return null;
  }
  function payout(position, match, { career = true, objective: goal, keyGame: key } = {}) {
    const played = number(match.decisions) > 0;
    const score = grade(position, match);
    const completed = !!goal && number(match.earned?.[goal.key]) >= goal.target;
    const keyComplete = !!key && score >= key.minGrade && played;
    const base = played ? career ? 120 : 32 : 0;
    const performance = played ? career ? clamp(Math.round((score - 50) * 1.4), 0, 60) : Math.min(45, number(match.hits) * 10 + number(match.putouts) * 2) : 0;
    const role = career && played && completed ? 20 : 0;
    const keyBonus = career && keyComplete ? 30 : 0;
    return { grade: score, base, performance, role, keyBonus, coins: base + performance + role + keyBonus, xp: played ? career ? 80 + Math.round(Math.max(0, score - 60) * .7) : 20 + number(match.decisions) * 4 : 0, objectiveCompleted: completed && played, keyCompleted: keyComplete };
  }
  function emptyStats() {
    return { batting: { G: 0, PA: 0, AB: 0, R: 0, H: 0, doubles: 0, triples: 0, HR: 0, RBI: 0, BB: 0, SO: 0, SB: 0, CS: 0 }, pitching: { G: 0, GS: 0, W: 0, L: 0, outs: 0, IP: 0, H: 0, ER: 0, BB: 0, SO: 0, HR: 0 }, fielding: { G: 0, GS: 0, INN: 0, PO: 0, A: 0, E: 0 } };
  }
  function accumulate(stats, position, match, result) {
    const legacyOuts = Object.hasOwn(stats?.pitching || {}, "outs") ? null : Math.round(number(stats?.pitching?.IP) * 3);
    const target = stats || emptyStats();
    const defaults = emptyStats();
    for (const group of Object.keys(defaults)) target[group] = { ...defaults[group], ...(target[group] || {}) };
    const add = (group, key, value) => target[group][key] = number(target[group][key]) + number(value);
    if (number(match.plateAppearances)) add("batting", "G", 1);
    const batting = { PA: "plateAppearances", AB: "atBats", R: "runs", H: "hits", doubles: "doubles", triples: "triples", HR: "homeRuns", RBI: "runsBattedIn", BB: "walks", SO: "strikeouts", SB: "steals", CS: "caughtStealing" };
    for (const [key, metric] of Object.entries(batting)) add("batting", key, match[metric]);
    add("fielding", "G", 1); add("fielding", "GS", 1);
    add("fielding", "INN", number(match.teamDefenseOuts) / 3);
    for (const [key, metric] of Object.entries({ PO: "putouts", A: "assists", E: "errors" })) add("fielding", key, match[metric]);
    if (position === "P" && number(match.pitchingOuts)) {
      // Legacy IP in this game was a decimal innings count. Preserve it once.
      if (legacyOuts !== null) target.pitching.outs = legacyOuts;
      add("pitching", "G", 1); add("pitching", "GS", 1);
      add("pitching", "outs", match.pitchingOuts);
      target.pitching.IP = target.pitching.outs / 3;
      for (const [key, metric] of Object.entries({ H: "pitchingHits", ER: "pitchingER", BB: "pitchingWalks", SO: "pitchingStrikeouts", HR: "pitchingHomeRuns" })) add("pitching", key, match[metric]);
      if (["win", "walkoff"].includes(result)) add("pitching", "W", 1);
      if (result === "loss") add("pitching", "L", 1);
    }
    return target;
  }
  function innings(outs) { return `${Math.floor(number(outs) / 3)}.${number(outs) % 3}`; }
  function newWorld(playerId, teamId, teamIds, year = 2026, overall = 60) {
    return { version: 1, playerId, teamId, year, season: 1, startOverall: overall, teamIds: [...teamIds], played: 0, completed: {}, settled: {}, stats: emptyStats(), history: [], postseason: null, pending: null, specialist: Object.fromEntries(Object.keys(TRACKS).map((key) => [key, 0])), honours: 0, lastReport: null };
  }
  function normalizeWorld(raw, playerId, teamId, teamIds, overall = 60) {
    const base = newWorld(playerId, teamId, teamIds, 2026, overall);
    if (!raw || raw.version !== 1 || raw.playerId !== playerId || raw.teamId !== teamId) return base;
    const world = { ...base, ...copy(raw), playerId, teamId, teamIds: [...teamIds] };
    world.year = clamp(world.year, 2026, 2200); world.season = Math.max(1, Math.floor(number(world.season)));
    world.completed = raw.completed && typeof raw.completed === "object" ? copy(raw.completed) : {};
    world.settled = raw.settled && typeof raw.settled === "object" ? copy(raw.settled) : {};
    world.history = Array.isArray(raw.history) ? copy(raw.history) : [];
    world.specialist = Object.fromEntries(Object.keys(TRACKS).map((key) => [key, number(raw.specialist?.[key])]));
    world.stats = raw.stats && typeof raw.stats === "object" ? copy(raw.stats) : emptyStats();
    return world;
  }
  function scheduleFor(world, template) {
    return template.map((game) => ({ ...game, id: `${world.year}-${String(game.gameNo).padStart(3, "0")}`, date: `${world.year}${game.date.slice(4)}` }));
  }
  function standings(world, schedule) {
    const table = Object.fromEntries(world.teamIds.map((id) => [id, { teamId: id, W: 0, L: 0, T: 0, RF: 0, RA: 0 }]));
    for (const game of schedule) {
      const score = world.completed[game.id];
      if (!score) continue;
      const home = table[game.homeTeamId], away = table[game.awayTeamId];
      home.RF += score.homeScore; home.RA += score.awayScore; away.RF += score.awayScore; away.RA += score.homeScore;
      if (score.homeScore > score.awayScore) { home.W++; away.L++; }
      else if (score.homeScore < score.awayScore) { home.L++; away.W++; }
      else { home.T++; away.T++; }
    }
    return Object.values(table).map((row) => ({ ...row, pct: row.W + row.L + row.T ? (row.W + row.T * .5) / (row.W + row.L + row.T) : 0, diff: row.RF - row.RA })).sort((a, b) => b.pct - a.pct || b.diff - a.diff || b.W - a.W || world.teamIds.indexOf(a.teamId) - world.teamIds.indexOf(b.teamId));
  }
  const won = (game, teamId) => game.homeScore === game.awayScore ? "" : game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
  function simulatedScore(game) {
    let seed = 2166136261;
    for (const c of `${game.id}:${game.homeTeamId}:${game.awayTeamId}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    return { ...game, homeScore: seed % 8, awayScore: (seed >>> 5) % 8 };
  }
  function series(world, stage, high, low, bestOf) {
    return { stage, teamIds: [high, low], bestOf, games: [], winner: "" };
  }
  function nextSeriesGame(world, s) {
    const n = s.games.length + 1;
    const homeHigh = s.bestOf === 7 ? [1, 2, 6, 7].includes(n) : [1, 2, 5].includes(n);
    const previousStageEnd = s.stage === "taiwan" ? world.postseason.challenge.games.at(-1)?.date : null;
    const baseDate = previousStageEnd || world.regularEndDate || `${world.year}-10-31`;
    const date = new Date(`${baseDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 3 + (n - 1) * 2);
    return { id: `${world.year}-${s.stage}-${n}`, stage: s.stage, isPostseason: true, title: s.stage === "challenge" ? "季後挑戰賽" : "台灣大賽", gameNo: n, date: date.toISOString().slice(0, 10), homeTeamId: s.teamIds[homeHigh ? 0 : 1], awayTeamId: s.teamIds[homeHigh ? 1 : 0] };
  }
  function updateWinner(s) {
    const target = Math.floor(s.bestOf / 2) + 1;
    s.winner = s.teamIds.find((id) => s.games.filter((game) => won(game, id) === id).length >= target) || "";
  }
  function advancePostseason(world, schedule) {
    if (schedule.some((game) => !world.completed[game.id])) return;
    world.regularEndDate = schedule.at(-1)?.date;
    if (!world.postseason) {
      const seeds = standings(world, schedule).slice(0, 3).map((row) => row.teamId);
      world.postseason = { seeds, challenge: series(world, "challenge", seeds[1], seeds[2], 5), final: null, champion: "", finished: false };
    }
    const post = world.postseason;
    for (let step = 0; step < 20; step++) {
      const s = post.challenge.winner ? post.final ||= series(world, "taiwan", post.seeds[0], post.challenge.winner, 7) : post.challenge;
      if (s.winner) { post.champion = s.winner; post.finished = true; return; }
      if (s.teamIds.includes(world.teamId)) return;
      const game = nextSeriesGame(world, s);
      const score = simulatedScore(game);
      if (score.homeScore === score.awayScore) score.homeScore++;
      s.games.push(score); updateWinner(s);
    }
  }
  function nextGame(world, schedule) {
    const regular = schedule.find((g) => !world.completed[g.id] && [g.homeTeamId, g.awayTeamId].includes(world.teamId));
    if (regular) return regular;
    const post = world.postseason;
    if (!post || post.finished) return null;
    const s = post.challenge.winner ? post.final : post.challenge;
    return s && !s.winner && s.teamIds.includes(world.teamId) ? nextSeriesGame(world, s) : null;
  }
  function settle(world, schedule, game, score, position, match, report) {
    if (!game || world.settled[game.id] || ![game.homeTeamId, game.awayTeamId].includes(world.teamId)) return false;
    const expected = nextGame(world, schedule);
    if (!expected || expected.id !== game.id) return false;
    const entry = { ...game, homeScore: number(score.homeScore), awayScore: number(score.awayScore) };
    if (game.isPostseason && entry.homeScore === entry.awayScore) return false;
    if (game.isPostseason) {
      const s = game.stage === "challenge" ? world.postseason.challenge : world.postseason.final;
      s.games.push(entry); updateWinner(s);
    } else {
      world.completed[game.id] = entry;
      for (const other of schedule) if (other.date <= game.date && !world.completed[other.id] && ![other.homeTeamId, other.awayTeamId].includes(world.teamId)) world.completed[other.id] = simulatedScore(other);
      if (!schedule.some((g) => !world.completed[g.id] && [g.homeTeamId, g.awayTeamId].includes(world.teamId))) {
        for (const other of schedule) if (!world.completed[other.id]) world.completed[other.id] = simulatedScore(other);
      }
    }
    world.settled[game.id] = true;
    world.played++;
    const result = entry.homeScore === entry.awayScore ? "tie" : won(entry, world.teamId) === world.teamId ? "win" : "loss";
    world.stats = accumulate(world.stats, position, match, result);
    if (number(match.decisions) > 0) {
      for (const [key, track] of Object.entries(TRACKS)) world.specialist[key] += track.points(match.earned || {});
      world.honours += report.keyCompleted ? 3 : report.objectiveCompleted ? 1 : 0;
    }
    world.lastReport = { ...report, gameId: game.id, result, year: world.year, date: game.date };
    world.pending = null;
    advancePostseason(world, schedule);
    return true;
  }
  function nextSeason(world, schedule, overall) {
    if (!world.postseason?.finished || nextGame(world, schedule) || world.pending) return false;
    const rank = standings(world, schedule).findIndex((row) => row.teamId === world.teamId) + 1;
    world.history.push({ year: world.year, season: world.season, teamId: world.teamId, rank, champion: world.postseason.champion, stats: copy(world.stats), postseason: copy(world.postseason), startOverall: world.startOverall, endOverall: overall });
    world.year++; world.season++; world.startOverall = overall;
    world.played = 0; world.completed = {}; world.settled = {}; world.stats = emptyStats(); world.postseason = null; world.lastReport = null;
    return true;
  }
  return { TRACKS, specialization, badge, upgradePrice, grade, objective, keyGame, payout, emptyStats, accumulate, innings, newWorld, normalizeWorld, scheduleFor, standings, nextGame, settle, nextSeason, advancePostseason };
});
