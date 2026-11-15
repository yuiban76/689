/* Browser adapter for the pure per-character career league. */
(() => {
  "use strict";
  const E = window.CareerEngine;
  const KEY = "jiuju-career-leagues-v1";
  let leagues = readStorage(KEY, {});
  if (!leagues || typeof leagues !== "object" || Array.isArray(leagues)) leagues = {};
  const ids = TEAM_DEFS.map((team) => team.id);
  let notice = "";
  let rendering = false;
  const html = escapeHtml;
  const card = (label, value) => `<div class="career-number"><span>${html(label)}</span><strong>${html(String(value))}</strong></div>`;
  const button = (command, label, disabled = false) => `<button type="button" class="primary-button" data-career-command="${command}" ${disabled ? "disabled" : ""}>${label}</button>`;

  function profile(playerId) {
    const p = profileFor(playerId);
    if (!p) return null;
    if (p.progressionVersion !== 3) {
      p.legacyStats = clone(p.stats);
      p.progressionVersion = 3;
    }
    p.specialist ||= {};
    p.settledMatches ||= {};
    return p;
  }
  function worldFor(playerId) {
    const player = customPlayerIndex[playerId];
    if (!player) return null;
    if (!leagues[playerId]) {
      leagues[playerId] = E.newWorld(playerId, player.teamId, ids, CPBL_SEASON_YEAR, developedPlayer(playerId).overall);
      leagues[playerId].honours = Number(profile(playerId).legacyPoints || 0);
      persist();
    }
    const w = leagues[playerId];
    const checkpoint = w.profileCheckpoint;
    if (checkpoint?.profile && careerStore[playerId]?.lastCareerSettlement !== checkpoint.matchId) careerStore[playerId] = clone(checkpoint.profile);
    return w;
  }
  function persist() { writeStorage(KEY, leagues); }
  function schedule(w) { return E.scheduleFor(w, SEASON_SCHEDULE); }
  function selected() {
    const player = selectedCareerPlayer();
    if (!player) return null;
    const w = worldFor(player.id);
    return { player, world: w, profile: profile(player.id), schedule: schedule(w) };
  }
  function gameById(playerId, gameId) {
    const w = worldFor(playerId);
    if (!w) return null;
    const next = E.nextGame(w, schedule(w));
    return schedule(w).find((game) => game.id === gameId) || (next?.id === gameId ? next : null);
  }
  function idle() { return ["pre", "gameover"].includes(state.phase); }
  function startNext() {
    const current = selected();
    if (!current) { window.GameUI.navigate("builder"); return; }
    if (network.role !== "solo") { notice = "請先離開多人房間，再繼續獨立生涯。"; render(); return; }
    if (!idle()) {
      if (state.careerPlayerId === current.player.id) window.GameUI.navigate("match");
      else { notice = "請先完成目前進行中的比賽。"; render(); }
      return;
    }
    const { player, world, schedule: games } = current;
    const pending = world.pending;
    if (pending?.state && !world.settled[pending.gameId]) {
      clearMatchTiming(); clearActionDeadline(); window.clearTimeout(network.npcTimer); network.npcTimer = null;
      const snapshot = clone(pending.state);
      if (snapshot.careerPlayerId !== player.id || snapshot.teamId !== player.teamId) { world.pending = null; persist(); return startNext(); }
      state = normalizeState(snapshot);
      state.rngState = snapshot.rngState;
      const ownSlot = state.slots[player.position];
      ownSlot.playerId = network.localPlayerId; ownSlot.name = player.name; ownSlot.controller = "human";
      ownSlot.connected = true; ownSlot.athleteId = player.id; ownSlot.playerSnapshot = null;
      network.assignedPosition = player.position; network.awaiting = false;
      armActionDeadline();
      window.GameUI.navigate("match"); commitState();
      return;
    }
    E.advancePostseason(world, games);
    const game = E.nextGame(world, games);
    if (!game) { notice = "本季已完成，可到「賽季與成績」查看總結並開始下一季。"; persist(); render(); return; }
    const away = game.awayTeamId === player.teamId;
    const opponent = away ? game.homeTeamId : game.awayTeamId;
    replaceMatchTeams(player.teamId, opponent, false);
    selectedTeamId = player.teamId; selectedOpponentId = opponent;
    developmentTeamId = player.teamId; selectedAthleteId = player.id;
    POSITION_DEFS.forEach(({ code }) => {
      const base = TEAM_BY_ID[player.teamId].roster.find((candidate) => candidate.position === code);
      state.lineupIds[code] = code === player.position ? player.id : base.id;
      const slot = state.slots[code];
      slot.athleteId = state.lineupIds[code]; slot.playerSnapshot = null;
      if (code !== player.position) { slot.controller = "npc"; slot.playerId = null; }
    });
    claimLocalPosition(player.position, false);
    startGame("career", { id: game.id, careerPlayerId: player.id, gameNo: game.gameNo, date: game.date,
      officialHomeTeamId: game.homeTeamId, officialAwayTeamId: game.awayTeamId,
      playerIsAway: away, stage: game.stage || "regular" });
    notice = "";
  }
  function capture() {
    if (!state.careerPlayerId || state.leagueRecorded || idle() || network.role !== "solo") return;
    const w = worldFor(state.careerPlayerId);
    if (!w || w.settled[state.scheduleGameId]) return;
    const snapshot = clone(state);
    snapshot.actionLock = false;
    for (const slot of Object.values(snapshot.slots)) { slot.connectionKey = null; slot.sessionId = null; }
    w.pending = { gameId: state.scheduleGameId, state: snapshot };
    persist();
  }
  function recordMatch(result) {
    const player = customPlayerIndex[state.careerPlayerId];
    if (!player || network.role !== "solo") return;
    const w = worldFor(player.id);
    if (w.settled[state.scheduleGameId]) { state.leagueRecorded = true; return; }
    const games = schedule(w);
    const game = E.nextGame(w, games);
    if (!game || game.id !== state.scheduleGameId) return;
    const p = profile(player.id);
    const match = state.playerStats[player.position] || {};
    const goal = E.objective(player.position, w.played + 1);
    const key = E.keyGame(game, w);
    const report = E.payout(player.position, match, { career: true, objective: goal, keyGame: key });
    const score = { homeScore: state.schedulePlayerIsAway ? state.score.away : state.score.home, awayScore: state.schedulePlayerIsAway ? state.score.home : state.score.away };
    if (!E.settle(w, games, game, score, player.position, match, report)) return;
    E.accumulate(p.stats, player.position, match, result);
    const levels = awardCareerXp(p, report.xp);
    report.levelBonus = levels * 70;
    w.lastReport.levelBonus = report.levelBonus;
    p.careerCoins += report.coins;
    p.lastGrade = report.grade;
    p.specialist = { ...w.specialist };
    p.record.games++;
    if (["win", "walkoff"].includes(result)) p.record.wins++;
    else if (result === "loss") p.record.losses++;
    else p.record.ties++;
    p.recentMatches = [{ result, grade: report.grade, xp: report.xp, coins: report.coins, date: game.date, breakdown: report, keyGame: key ? { label: key.label, completed: report.keyCompleted } : null }, ...p.recentMatches].slice(0, 5);
    p.lastCareerSettlement = `${player.id}:${w.year}:${game.id}`;
    w.profileCheckpoint = { matchId: p.lastCareerSettlement, profile: clone(p) };
    // One authoritative checkpoint allows profile recovery after an interrupted write.
    persist();
    writeStorage(CAREER_STORAGE_KEY, careerStore);
    persistPlayerSaveMeta();
    state.leagueRecorded = true;
    notice = `完賽：${report.grade} 分，獲得 ${report.coins} 生涯幣與 ${report.xp} XP。${levels ? `另獲升級獎勵 ${report.levelBonus} 幣。` : ""}`;
  }
  function modifier(player, track) {
    if (!player?.isCustom && !customPlayerIndex[player?.id]) return 1;
    const points = player.specialist || careerStore[player.id]?.specialist || {};
    return 1 + E.badge(points[track]).bonus;
  }
  function credit(position, key, amount = 1, manualOverride = false) {
    if (!state.careerPlayerId) return;
    if (!manualOverride && (!state.actionCredit?.manual || state.actionCredit.position !== position)) return;
    const stats = state.playerStats[position];
    if (!stats) return;
    stats.earned ||= {};
    stats.earned[key] = Math.max(0, Number(stats.earned[key] || 0) + amount);
  }
  function creditBatting(position, { hitType, walk, strikeout }) {
    if (hitType) { credit(position, "hits"); credit(position, "onBase"); }
    if (walk) { credit(position, "walks"); credit(position, "onBase"); }
    if (hitType === "double") credit(position, "doubles");
    if (hitType === "triple") credit(position, "triples");
    if (hitType === "homer") credit(position, "homeRuns");
    if (strikeout) credit(position, "strikeouts");
  }
  function creditRun(position) {
    if (Number(state.playerStats[position]?.earned?.onBase || 0) > 0) credit(position, "runs", 1, true);
  }
  function creditFielding(position, result) {
    if (result.outs > 0 || result.savedRun) credit(position, "fieldSuccess");
    if (result.savedRun) credit(position, "savedRuns");
    if (result.error) { credit(position, "errors"); if (state.awaySeries) state.awaySeries.fieldErrors = Number(state.awaySeries.fieldErrors || 0) + 1; }
  }
  function creditPitchingHalf(runs) {
    const series = state.awaySeries;
    const pitcher = state.playerStats.P;
    if (!series || !pitcher) return;
    const remainingOuts = Math.max(0, 3 - Number(series.outs || 0));
    const ratings = matchPlayerForPosition("P", state.teamId)?.ratings || {};
    let strikeouts = 0;
    for (let n = 0; n < remainingOuts; n++) {
      if (nextRandom() < clamp(.25 + (Number(ratings.velocity || 60) + Number(ratings.break || 60)) / 450 + Number(series.pitchTimingScore || 65) / 600, .3, .85)) strikeouts++;
    }
    pitcher.pitchingOuts = Number(pitcher.pitchingOuts || 0) + 3;
    pitcher.pitchingStrikeouts = Number(pitcher.pitchingStrikeouts || 0) + strikeouts;
    const errors = Number(series.fieldErrors || 0);
    pitcher.pitchingER = Number(pitcher.pitchingER || 0) + Math.max(0, runs - errors);
    if (series.pitchAction === "defense-intentional") pitcher.pitchingWalks = Number(pitcher.pitchingWalks || 0) + 1;
    POSITION_DEFS.forEach(({ code }) => state.playerStats[code].teamDefenseOuts = Number(state.playerStats[code].teamDefenseOuts || 0) + 3);
    if (strikeouts) addLog(`投手在本半局取得 ${strikeouts} 次三振，其餘出局由守備完成。`);
    if (series.pitchManual) {
      credit("P", "pitchingStrikeouts", strikeouts, true);
      if (!runs) credit("P", "scorelessHalves", 1, true);
    }
    if (series.catcherManual && !runs) credit("C", "catcherSuccess", 1, true);

  }
  function statsPanel(stats, position, label) {
    const b = stats.batting || {}, p = stats.pitching || {}, f = stats.fielding || {};
    const rates = calculateBattingLine(b), pitch = calculatePitchingLine(p);
    const values = position === "P" ? [["投球局數", E.innings(p.outs ?? Math.round(Number(p.IP || 0) * 3))], ["三振", p.SO || 0], ["保送", p.BB || 0], ["責失分", p.ER || 0], ["ERA", pitch.ERA.toFixed(2)], ["WHIP", pitch.WHIP.toFixed(2)]]
      : [["出賽", b.G || 0], ["打擊率", formatRate(rates.AVG)], ["安打", b.H || 0], ["全壘打", b.HR || 0], ["打點", b.RBI || 0], ["盜壘", b.SB || 0], ["保送", b.BB || 0], ["OPS", rates.OPS.toFixed(3)], ["刺殺／助殺", `${f.PO || 0} / ${f.A || 0}`], ["失誤", f.E || 0]];
    return `<section class="panel career-stat-panel"><h3>${html(label)}</h3><div class="career-number-grid">${values.map(([l, v]) => card(l, v)).join("")}</div></section>`;
  }
  function render() {
    if (rendering || !window.GameUI || !$("career-home-content")) return;
    rendering = true;
    try {
      const current = selected();
      if (!current) { $("career-home-content").innerHTML = `<h2>建立你的明星球員</h2><p>從 60 OVR 開始，直接擔任一軍先發。</p>`; return; }
      const { player, world, profile: p, schedule: games } = current;
      const next = E.nextGame(world, games);
      const goal = E.objective(player.position, world.played + 1);
      const key = E.keyGame(next, world);

      const identity = `<div class="career-identity"><div><h2>${html(player.name)}</h2><p>${html(teamFor(player.teamId).name)} · #${html(player.number)} · ${html(positionName(player.position))}先發</p><small>固定模板：${html(player.archetype)}</small></div><div class="career-rating"><span>OVR</span><strong>${player.overall}</strong></div></div>`;
      $("career-home-content").innerHTML = `<div class="career-new-hero"><section class="panel">${identity}<div class="career-number-grid">${card("生涯幣", p.careerCoins)}${card("球員等級", `Lv.${p.level}`)}${card("本季出賽", `${world.played} 場`)}</div></section><section class="panel next-career-game"><span class="baseball-label">${world.year} 第 ${world.season} 季</span><h3>${world.pending ? "繼續未完成的比賽" : next ? key?.label || "下一場例行賽" : "本季已結束"}</h3><p>${next ? `${next.date}　${html(teamFor(next.awayTeamId).shortName)} @ ${html(teamFor(next.homeTeamId).shortName)}` : "查看球季總結，帶著你的成長迎接下一季。"}</p><div class="career-objective"><strong>位置目標：${html(goal.label)}</strong><small>完成獎勵：20 生涯幣${key ? `；${html(key.detail)}，額外 30 幣` : ""}。未達成仍可推進賽程。</small></div>${next ? button("start", world.pending ? "繼續比賽" : "開始完整比賽", network.role !== "solo" || (!idle() && state.careerPlayerId !== player.id)) : button("summary", "查看球季總結")}</section></div><p class="career-mode-status" id="career-mode-status" role="status">${html(notice || "完整九局・實戰賺取生涯幣・模板固定・每名角色獨立球季")}</p>`;
      $("career-badges-content").innerHTML = `<div class="page-heading"><h2>專精與徽章</h2><p>你的固定球風：${html(E.TRACKS[E.specialization(player.position, buildTemplateForPlayer(player).id)].label)}。僅親自操作的生涯實戰貢獻會累積進度；逾時與 NPC 接管不計。</p></div><div class="career-badge-grid">${Object.entries(E.TRACKS).map(([id, track]) => {
        const points = Number(world.specialist[id] || 0), tier = E.badge(points);
        return `<article class="career-badge"><span>${html(tier.label)}</span><h3>${html(track.label)}</h3><strong>${points} / ${tier.next}</strong><small>${html(track.detail)}</small><p>${html(track.effect)} ${tier.tier ? `+${tier.tier}%` : "尚未加成"}</p><div class="career-meter"><i style="width:${Math.min(100, points / tier.next * 100)}%"></i></div><small>銅 24／銀 70／金 150；加成不保證成功。</small></article>`;
      }).join("")}</div>`;
      renderSeason(current);
      const breakdown = world.lastReport;
      const homeSummary = $("career-last-summary");
      if (homeSummary) homeSummary.remove();
      if (breakdown) {
        const summary = document.createElement("section"); summary.id = "career-last-summary"; summary.className = "panel career-stat-panel";
        summary.innerHTML = `<h3>上一場個人結算 · ${breakdown.grade} 分</h3><p>完賽 ${breakdown.base}＋表現 ${breakdown.performance}＋位置目標 ${breakdown.role}＋重點賽事 ${breakdown.keyBonus}＝<strong>${breakdown.coins} 生涯幣</strong>；${breakdown.xp} XP。${breakdown.levelBonus ? `等級提升另獲 ${breakdown.levelBonus} 幣。` : ""}</p><small>位置目標：${breakdown.objectiveCompleted ? "達成" : "未達成"}；重點挑戰：${breakdown.keyCompleted ? "達成" : "未達成或本場無挑戰"}。本場獎勵已保存。</small>`;
        $("career-home-content").append(summary);
      }
      const badgeHeading = $("career-badges-content").querySelector(".page-heading p");
      if (badgeHeading) badgeHeading.append(` 生涯榮譽 ${world.honours}；不影響先發資格。`);
      if (state.careerPlayerId === player.id && state.phase === "gameover" && breakdown) {
        $("player-result-copy").textContent = `評分 ${breakdown.grade}；完賽 ${breakdown.base}＋表現 ${breakdown.performance}＋位置目標 ${breakdown.role}＋重點賽事 ${breakdown.keyBonus}＝${breakdown.coins} 生涯幣；${breakdown.xp} XP。${breakdown.levelBonus ? `另有等級提升獎勵 ${breakdown.levelBonus} 幣。` : ""}已保存，本場不會重複領獎。`;
      }
      const rules = document.querySelector(".player-upgrade-rules");
      if (rules) rules.innerHTML = "<span>實戰完賽：120 幣</span><span>個人表現：最多 60 幣</span><span>位置目標：20 幣</span><span>重點賽事：30 幣</span>";

      const capNote = $("builder-cap-note");
      if (capNote && builderDraft) {
        const template = templateForPosition(builderDraft.position, builderDraft.templateId);
        const caps = Object.fromEntries(Object.keys(builderDraft.ratings).map((name) => [name, builderCapFor(builderDraft.position, template, name)]));
        capNote.textContent = `建立時總評固定 60；模板潛力總評 ${overallForPlayer({ position: builderDraft.position, ratings: caps })}。建立後模板與能力投入固定，無洗點；用實戰生涯幣逐點升級。`;
      }
    } finally { rendering = false; }
  }
  function renderSeason({ player, world, profile: p, schedule: games }) {
    const next = E.nextGame(world, games);
    const standings = E.standings(world, games);
    const rows = standings.map((r, i) => `<div class="standing-row"><b>${i + 1}</b><span>${html(teamFor(r.teamId).name)}</span><span>${r.W}-${r.L}-${r.T}</span><span>${r.pct.toFixed(3)}</span><span>${r.diff}</span></div>`).join("");
    const personal = games.filter((g) => [g.homeTeamId, g.awayTeamId].includes(world.teamId));
    const index = personal.findIndex((g) => !world.completed[g.id]);
    const visible = personal.slice(Math.max(0, (index < 0 ? personal.length - 8 : index) - 2), index < 0 ? personal.length : index + 7);
    const post = world.postseason;
    const series = post ? [post.challenge, post.final].filter(Boolean).map((s) => `<article class="panel"><h4>${s.stage === "challenge" ? "季後挑戰賽・五戰三勝" : "台灣大賽・七戰四勝"}</h4><p>${s.teamIds.map((id) => `${html(teamFor(id).name)} ${s.games.filter((g) => (g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId) === id).length} 勝`).join("／")}</p>${s.winner ? `<strong>晉級：${html(teamFor(s.winner).name)}</strong>` : "進行中"}</article>`).join("") : "<p>例行賽結束後，由排名前三名進入季後賽。</p>";
    $("career-season-view").innerHTML = `<div class="page-heading"><h2>${world.year} 生涯球季</h2><p>${html(player.name)} · ${html(teamFor(world.teamId).name)} · ${world.played} 場。此賽季與其他角色、單人模式各自保存。</p></div>${next ? button("start", world.pending ? "繼續未完成比賽" : "開始下一場生涯賽", network.role !== "solo" || !idle()) : ""}<div class="career-season-columns"><section class="panel"><h3>聯盟排名</h3><div class="standing-head"><span>#</span><span>球隊</span><span>戰績</span><span>勝率</span><span>分差</span></div>${rows}</section><section class="panel"><h3>近期賽程</h3>${visible.map((g) => { const done = world.completed[g.id]; return `<div class="season-schedule-row"><span>${g.date.slice(5)}</span><span>${html(teamFor(g.awayTeamId).shortName)} @ ${html(teamFor(g.homeTeamId).shortName)}</span><b>${done ? `${done.awayScore}:${done.homeScore}` : "待開賽"}</b></div>`; }).join("")}</section></div>${statsPanel(world.stats, player.position, "本季個人成績")}${statsPanel(p.stats, player.position, "生涯累積成績（含舊版歷史）")}<section class="panel"><h3>季後賽</h3><div class="career-postseason">${series}</div>${post?.finished ? `<p>本季冠軍：${html(teamFor(post.champion).name)}；球員 OVR ${world.startOverall} → ${player.overall}。</p>${button("next-season", `開始 ${world.year + 1} 球季`, !idle() || network.role !== "solo")}` : ""}</section><section class="panel"><h3>歷年球季</h3>${world.history.length ? world.history.slice().reverse().map((h) => `<details class="drawer"><summary>${h.year} · 第 ${h.rank} 名 · OVR ${h.startOverall} → ${h.endOverall}</summary><p>冠軍：${html(teamFor(h.champion).name)}</p>${statsPanel(h.stats, player.position, `${h.year} 成績`)}</details>`).join("") : "<p>完成第一季後，這裡會保留各季成績與成長摘要。</p>"}</section>`;
  }
  function retiredTraining() { notice = "訓練玩法已移除。請透過正式生涯比賽賺取生涯幣與專精進度。"; }
  function guardRoom() {
    if (state.careerPlayerId && !idle()) { setStatus("請先完成生涯比賽，再建立或加入多人房間。"); return true; }
    return false;
  }
  function exportLeagues() { return Object.fromEntries(customPlayers.map((p) => [p.id, clone(worldFor(p.id))])); }
  function validateImport(payload) {
    if (payload.version === 1) return true;
    if (!payload.careerLeagues || typeof payload.careerLeagues !== "object") return false;
    return payload.customPlayers.every((p) => {
      const raw = payload.careerLeagues[p.id];
      return !raw || raw.version === 1 && raw.playerId === p.id && raw.teamId === p.teamId && Number.isInteger(raw.year) && raw.year >= 2026 && raw.year <= 2200;
    });
  }
  function importLeagues(raw) {
    leagues = Object.fromEntries(customPlayers.map((p) => {
      const world = E.normalizeWorld(raw[p.id], p.id, p.teamId, ids, developedPlayer(p.id).overall);
      // Imported profile data and world belong to the same explicit save operation.
      delete world.profileCheckpoint;
      return [p.id, world];
    }));
    persist();
  }
  window.CareerMode = { startNext, capture, recordMatch, render, persist, exportLeagues, validateImport, importLeagues, retiredTraining, guardRoom, modifier, credit, creditRun, creditBatting, creditFielding, creditPitchingHalf, worldFor, gameById };
  // Old controls are removed only after the base UI has finished attaching its listeners.
  $("career-mode-panel").innerHTML = '<div id="career-home-content"></div>';
  $("screen-badges").innerHTML = '<div id="career-badges-content"></div>';
  const seasonNode = document.createElement("div"); seasonNode.id = "career-season-view"; $("screen-season").append(seasonNode);
  const legacyBadge = $("career-badge-grid"); if (legacyBadge) legacyBadge.remove();
  const badgeNote = document.querySelector(".career-badge-note"); if (badgeNote) badgeNote.textContent = "徽章現在由獨立生涯實戰成長，可到「專精與徽章」查看。";
  document.addEventListener("click", (event) => {
    const node = event.target.closest("[data-career-command]");
    if (!node || node.disabled) return;
    if (node.dataset.careerCommand === "start") startNext();
    if (node.dataset.careerCommand === "summary") window.GameUI.navigate("season");
    if (node.dataset.careerCommand === "next-season") {
      const current = selected();
      if (current && idle() && E.nextSeason(current.world, current.schedule, current.player.overall)) {
        persist(); notice = "新球季開始！能力、貨幣與徽章都已保留。"; render();
      }
    }
  });
  const oldHash = location.hash.slice(1);
  if (["training", "tasks", "practice-actions"].includes(oldHash)) { retiredTraining(); window.GameUI.navigate("career"); }
  customPlayers.forEach((p) => worldFor(p.id));
  writeStorage(CAREER_STORAGE_KEY, careerStore);
  render();
})();
