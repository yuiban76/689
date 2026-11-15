/* Presentation and navigation only. The existing engine owns gameplay and saves. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const shell = document.querySelector(".app-shell");
  const pageNames = { home: "選擇模式", solo: "單人比賽", multiplayer: "多人大廳", career: "生涯首頁", badges: "專精與徽章", training: "已移除訓練", tasks: "實戰目標", upgrades: "能力升級", builder: "建立球員", saves: "角色與存檔", season: "賽季與成績", roster: "球團名單", match: "比賽現場" };
  const pages = {};
  let screen = "home";
  let origin = readStorage("jiuju-mode-context-v1", "solo");
  if (!["solo", "career", "multiplayer"].includes(origin)) origin = "solo";
  let previousPhase = state.phase;
  let previousMyTurn = false;
  let mounted = false;
  const create = (tag, className, html = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.innerHTML = html;
    return node;
  };
  const routeButton = (view, label, style = "") => `<button type="button" class="${style}" data-ui-view="${view}">${label}</button>`;
  const page = (id) => {
    const section = create("section", "screen");
    section.id = `screen-${id}`;
    section.setAttribute("aria-label", pageNames[id]);
    section.hidden = true;
    pages[id] = section;
    shell.append(section);
    return section;
  };
  const move = (selector, parent) => {
    const node = document.querySelector(selector);
    if (node && parent) parent.append(node);
    return node;
  };
  const disclosure = (label, className = "") => {
    const node = create("details", `drawer ${className}`, `<summary>${label}</summary>`);
    return node;
  };

  document.querySelector(".topbar-season")?.remove();
  document.querySelector(".live-indicator")?.remove();
  const settingsButton = create("button", "quiet-button", "設定");
  settingsButton.type = "button";
  settingsButton.dataset.openSettings = "true";
  document.querySelector(".topbar-actions").append(settingsButton);
  const settings = create("dialog", "settings-dialog", `<form method="dialog"><div class="section-heading"><h2>閱讀與遊戲設定</h2><button value="close" aria-label="關閉設定">關閉</button></div><label class="setting-row"><span>加大文字</span><input id="large-text-setting" type="checkbox"></label><p>角色會自動保存在這個瀏覽器。換裝置前可從「生涯 → 角色與存檔」匯出。</p><div class="settings-reset"></div><details class="drawer"><summary>玩法說明</summary><div id="help-content"></div></details></form>`);
  shell.append(settings);
  move("#new-game", settings.querySelector(".settings-reset"));
  move(".rules-card", settings.querySelector("#help-content"));
  const nav = document.querySelector(".section-nav");
  nav.innerHTML = `<button type="button" data-ui-view="home" class="back-button">‹ 模式選單</button><span class="breadcrumb" id="ui-breadcrumb"></span><div id="ui-context-actions"></div>`;
  const subnav = create("nav", "mode-tabs");
  subnav.setAttribute("aria-label", "目前模式功能");
  nav.after(subnav);

  const home = page("home");
  home.innerHTML = `<div class="home-heading"><div class="baseball-label">2026 球季</div><h2>今天，想怎麼上場？</h2><p>選一個模式，開始你的棒球時刻。</p></div><div class="resume-strip" id="resume-strip" hidden><div><span>你的球員</span><strong id="resume-name"></strong></div>${routeButton("career", "繼續生涯", "primary-button")}</div><div class="mode-grid"><article class="mode-card mode-solo"><div class="mode-art" aria-hidden="true"><span class="mode-diamond"></span><b>1</b></div><h3>單人</h3><p>選擇球隊與位置，快速開賽或挑戰完整賽季。</p>${routeButton("solo", "進入單人", "primary-button")}</article><article class="mode-card mode-multi"><div class="mode-art" aria-hidden="true"><span class="mode-diamond"></span><b>9</b></div><h3>多人</h3><p>和朋友各守一個位置，空缺由 NPC 補位。</p>${routeButton("multiplayer", "進入多人", "primary-button")}</article><article class="mode-card mode-career"><div class="mode-art" aria-hidden="true"><span class="mode-diamond"></span><b>MP</b></div><h3>生涯</h3><p>從 60 OVR 一軍先發起步，完整實戰打造明星。</p>${routeButton("career", "進入生涯", "primary-button")}</article></div><div class="home-footnote"><span>最多九人同隊</span><span>免費本地 NPC</span><span>角色自動保存</span></div>`;

  const solo = page("solo");
  solo.innerHTML = `<div class="page-heading"><h2>單人比賽</h2><p>選好球隊與位置，就能上場。</p></div><div class="solo-options"><div class="panel"><h3>快速比賽</h3><div id="solo-team-controls"></div><p>你控制一個位置，其餘球員由 NPC 補位。</p>${routeButton("multiplayer", "選擇我的位置", "secondary-button")}<button class="primary-button" type="button" id="solo-start">開始快速比賽</button><p class="inline-status" id="solo-room-note" role="status"></p></div><div class="panel"><h3>球隊賽季</h3><p>逐場推進例行賽與季後賽，查看聯盟排名和球團成員。</p>${routeButton("season", "查看賽程", "secondary-button")}</div></div>`;
  move(".match-team-controls", solo.querySelector("#solo-team-controls"));
  page("multiplayer").append(byId("network-card"));
  const lobbyStart = create("div", "lobby-start", `${routeButton("match", "返回比賽現場", "secondary-button")}<button type="button" class="primary-button" id="lobby-start">準備好了，開始比賽</button>`);
  byId("network-card").append(lobbyStart);
  const career = page("career");
  page("badges");
  career.append(byId("career-mode-panel"));
  document.querySelector(".career-tabs").hidden = true;
  const quickLinks = create("div", "career-quick-links", `${routeButton("upgrades", "能力升級", "primary-button")}${routeButton("training", "球場訓練", "secondary-button")}${routeButton("tasks", "生涯任務", "secondary-button")}${routeButton("season", "查看賽程", "secondary-button")}`);
  document.querySelector(".career-resource-bar").after(quickLinks);
  document.querySelector("#career-mode-title").textContent = "我的球員生涯";
  const keygamePanel = document.querySelector('[data-career-panel="keygame"]');
  move(".career-overview-goal", keygamePanel);
  move(".career-feedback-row", keygamePanel);
  const upgrades = page("upgrades");
  upgrades.innerHTML = `<div class="page-heading"><h2>能力升級</h2><p>用生涯幣提升能力；模板上限與等級要求會顯示在每一項旁邊。</p></div><p class="inline-status" id="upgrade-empty"></p>`;
  const playerCard = document.querySelector(".player-development-card");
  playerCard.setAttribute("aria-labelledby", "player-detail-name");
  const rosterLayout = document.querySelector(".development-layout");
  const badgeDrawer = disclosure("能力徽章與進度", "badge-drawer");
  move("#career-badge-grid", badgeDrawer);
  move(".career-badge-note", badgeDrawer);
  upgrades.append(badgeDrawer);
  const builder = page("builder");
  builder.append(document.querySelector(".custom-player-studio"));
  const saves = page("saves");
  saves.innerHTML = `<div class="page-heading"><h2>角色與存檔</h2><p>切換角色、建立新球員，或將角色檔帶到另一台裝置。</p></div>${routeButton("builder", "建立新球員", "primary-button")}`;
  move("#custom-player-list", saves);
  move("#custom-player-status", saves);
  move(".player-save-panel", saves);
  const season = page("season");
  season.innerHTML = `<div class="page-heading"><h2>賽程與排名</h2><p id="season-context"></p></div>${routeButton("roster", "查看球團名單", "secondary-button")}`;
  move("#season-schedule-panel", season);
  move(".standings-card", season);
  page("roster").append(rosterLayout);
  const match = page("match");
  match.append(document.querySelector(".main-grid"));
  const gameCard = byId("game-card");
  const scoreboard = document.querySelector(".scoreboard-block");
  const scoreDetails = disclosure("逐局比分", "line-score-drawer");
  move("#line-score", scoreDetails);
  gameCard.append(scoreDetails);
  const countLights = byId("count-lights");
  scoreboard.append(countLights);
  const outGroup = create("span", "count-light-group out-count-group", `<b>出局</b><span class="count-light-row"><i class="count-light" data-ui-out></i><i class="count-light" data-ui-out></i><i class="count-light" data-ui-out></i></span>`);
  countLights.append(outGroup);
  const matchLayout = create("div", "match-layout");
  const matchMain = create("div", "match-main");
  const matchAside = create("aside", "match-aside");
  matchAside.setAttribute("aria-label", "比賽資料");
  matchLayout.append(matchMain, matchAside);
  scoreboard.after(matchLayout);
  const currentPlay = create("section", "current-play", `<div class="section-heading"><h3>現場轉播</h3><span class="live-badge">比賽進行中</span></div><p id="latest-play" role="status" aria-live="polite"></p><div id="current-owner" class="current-owner"></div>`);
  matchMain.append(currentPlay);
  const commentary = document.querySelector(".decision-commentary");
  move("#situation-text", currentPlay);
  const history = disclosure("歷史轉播", "history-drawer");
  move("#play-log", history);
  commentary.remove();
  matchMain.append(document.querySelector(".action-zone"), history);
  move(".field-panel", matchAside);
  move(".at-bat-card", matchAside);
  const statsDrawer = disclosure("本場個人數據");
  move(".stats-card", statsDrawer);
  matchAside.append(statsDrawer);
  const fieldDrawer = disclosure("查看球場與球員分工");
  move("#match-event-panel", fieldDrawer);
  matchAside.append(fieldDrawer);
  const momentum = move(".momentum-card", matchMain);
  momentum.classList.add("momentum-strip");
  const lineup = disclosure("查看本場先發陣容", "lineup-drawer");
  move("#pregame-lineup", lineup);
  byId("welcome-panel").after(lineup);
  matchLayout.append(matchMain, matchAside);
  scoreboard.after(matchLayout);
  document.querySelector(".side-column").remove();
  // Retain these IDs as compatibility anchors for existing callers and old links.
  byId("development-panel").hidden = true;
  byId("player-hub").hidden = true;
  const titleAnchors = { "game-card": "match", "network-card": "multiplayer", "career-feature": "career", "development-panel": "career", "player-builder-feature": "builder", "season-feature": "season", "roster-feature": "roster", "player-attributes": "upgrades" };

  function tabs() {
    const careerPages = ["career", "upgrades", "badges", "training", "tasks", "builder", "saves"];
    let items = [];
    if (careerPages.includes(screen) || ["season", "roster"].includes(screen) && origin === "career") {
      items = [["career", "生涯首頁"], ["upgrades", "能力升級"], ["badges", "專精與徽章"], ["season", "賽季與成績"], ["saves", "角色與存檔"]];
    } else if (["solo", "season", "roster"].includes(screen)) {
      items = [["solo", "快速比賽"], ["season", "球隊賽季"]];
    } else if (screen === "multiplayer") {
      items = [["multiplayer", "房間與位置"], ["season", "賽季賽程"]];
    }
    subnav.innerHTML = items.map(([id, name]) => `<button type="button" data-ui-view="${id}" ${id === screen ? 'aria-current="page" class="is-active"' : ""}>${name}</button>`).join("");
    subnav.hidden = !items.length;
  }

  function navigate(view, options = {}) {
    let next = titleAnchors[options.targetId] || view;
    if (window.CareerMode && ["training", "tasks"].includes(next)) {
      if (next === "training") window.CareerMode.retiredTraining();
      next = "career";
    }
    if (next === "multiplayer" && !["pre", "gameover"].includes(state.phase) && view === "multiplayer" && !options.explicit) next = "match";
    if (!pageNames[next]) next = "home";
    if (next === "career" && !selectedCareerPlayer()) next = "builder";
    if (next === "solo") origin = "solo";
    if (next === "multiplayer" && !(origin === "solo" && options.positionOnly)) origin = "multiplayer";
    if (["career", "upgrades", "badges", "training", "tasks", "builder", "saves"].includes(next)) origin = "career";
    screen = next;
    activeView = ["match", "multiplayer", "season", "roster"].includes(next) ? next : "career";
    document.body.dataset.screen = screen;
    document.body.dataset.origin = origin;
    writeStorage("jiuju-mode-context-v1", origin);
    document.body.dataset.activeView = activeView;
    document.body.dataset.careerPage = next;
    for (const [id, node] of Object.entries(pages)) node.hidden = id !== next && !(id === "career" && ["training", "tasks"].includes(next));
    if (next === "upgrades") {
      const player = selectedCareerPlayer();
      if (player) {
        selectedAthleteId = player.id;
        developmentTeamId = player.teamId;
      }
      upgrades.insertBefore(playerCard, badgeDrawer);
      playerCard.hidden = !player;
      badgeDrawer.hidden = !player;
      byId("upgrade-empty").textContent = player ? "" : "先建立球員，再開始能力養成。";
    } else if (next === "roster") {
      rosterLayout.append(playerCard);
      playerCard.hidden = false;
    }
    if (["career", "tasks", "training"].includes(next)) setCareerTab(next === "tasks" ? "keygame" : next === "training" ? "training" : "overview");
    byId("ui-breadcrumb").textContent = `${origin === "career" ? "球員生涯" : origin === "multiplayer" ? "多人" : "單人"} / ${pageNames[next]}`;
    byId("ui-context-actions").innerHTML = next === "match"
      ? `${routeButton("multiplayer", network.role === "solo" ? "位置" : `房間 ${network.roomCode || "連線中"}`, "quiet-button")}<button type="button" class="quiet-button" data-open-settings>說明</button>`
      : !["pre", "gameover"].includes(state.phase) ? routeButton("match", "返回比賽", "primary-button") : "";
    nav.hidden = next === "home";
    tabs();
    renderDevelopment();
    refresh();
    window.CareerMode?.render();
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
    if (options.history !== false) historyReplace(next);
  }

  function historyReplace(next) {
    // replaceState keeps navigation from growing indefinitely while playing.
    window.history.replaceState(null, "", `${location.pathname}${location.search}${next === "home" ? "" : `#${next}`}`);
  }

  function refresh() {
    if (!mounted) return;
    const active = !["pre", "gameover"].includes(state.phase);
    if (active && ["pre", "gameover"].includes(previousPhase)) {
      previousPhase = state.phase;
      navigate("match", { scroll: true });
      return;
    }
    previousPhase = state.phase;
    const player = selectedCareerPlayer();
    byId("resume-strip").hidden = !player;
    byId("resume-name").textContent = player ? `${player.name}　OVR ${player.overall}` : "";
    const latest = state.log[state.log.length - 1];
    byId("latest-play").textContent = latest?.message || "選好位置，準備迎接第一球。";
    document.querySelector(".live-badge").textContent = state.phase === "pre" ? "賽前準備" : state.phase === "gameover" ? "全場結束" : "即時更新";
    const owner = activeEventSlot();
    byId("current-owner").textContent = state.phase === "pre" ? "賽前準備" : state.phase === "gameover" ? "比賽結束，查看本場表現。" : owner?.controller === "human" ? owner.playerId === network.localPlayerId ? "輪到你操作" : `等待 ${owner.name} 操作` : "NPC 隊友正在處理本球";
    const myTurn = localControlsActiveEvent();
    document.body.dataset.myTurn = String(myTurn);
    if (myTurn && !previousMyTurn && screen === "match" && matchMedia("(max-width: 760px)").matches) {
      requestAnimationFrame(() => {
        measureDock();
        document.querySelector(".current-play").scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
    previousMyTurn = myTurn;
    document.body.dataset.matchPhase = state.phase;
    byId("count-lights").hidden = false;
    byId("count-lights").setAttribute("aria-label", `壞球 ${state.balls}，好球 ${state.strikes}，出局 ${state.outs}`);
    document.querySelectorAll("[data-ui-out]").forEach((light, i) => light.classList.toggle("is-on", i < state.outs));
    const connectedRoom = network.role !== "solo";
    byId("solo-start").disabled = connectedRoom || active || !slotForPlayer(network.localPlayerId);
    byId("solo-room-note").textContent = connectedRoom ? "目前在多人房間，請從多人大廳開始比賽。" : active ? "有一場比賽進行中，可從上方返回現場。" : "";
    byId("lobby-start").disabled = byId("start-game").disabled || active;
    byId("season-context").textContent = `目前球隊：${teamFor(seasonTeamId()).name}。此為球隊賽季；各角色生涯賽季獨立保存。`;
    const summary = document.querySelector(".lineup-drawer");
    summary.hidden = state.phase !== "pre";
    byId("home-team-name").style.borderColor = teamFor(state.teamId).color;
    byId("away-team-name").style.borderColor = teamFor(state.opponentId).color;
  }

  function seasonTeamId() {
    if (network.role !== "solo") return state.teamId;
    return origin === "career" ? selectedCareerPlayer()?.teamId || selectedTeamId : selectedTeamId;
  }

  function measureDock() {
    const height = document.querySelector(".action-zone").getBoundingClientRect().height;
    document.documentElement.style.setProperty("--dock-height", `${Math.ceil(height)}px`);
  }
  new ResizeObserver(measureDock).observe(document.querySelector(".action-zone"));

  window.GameUI = { navigate, refresh, seasonTeamId, isCareerContext: () => origin === "career", currentScreen: () => screen };
  document.addEventListener("click", (event) => {
    const settingsControl = event.target.closest("[data-open-settings]");
    if (settingsControl) { settings.showModal(); return; }
    const target = event.target.closest("[data-ui-view], a[data-view]");
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const targetId = target.getAttribute("href")?.slice(1) || "";
    const view = target.dataset.uiView || target.dataset.view;
    navigate(view, { targetId, explicit: true, positionOnly: screen === "solo" && view === "multiplayer" });
  }, true);
  byId("solo-start").addEventListener("click", () => { if (!byId("solo-start").disabled) requestStart(); });
  byId("lobby-start").addEventListener("click", () => { if (!byId("lobby-start").disabled) requestStart(); });
  byId("custom-player-form").addEventListener("submit", () => {
    if (selectedCareerPlayer()) navigate("career");
  });
  const preferences = readStorage("jiuju-reading-v1", {});
  const largeText = byId("large-text-setting");
  largeText.checked = preferences.largeText === true;
  document.body.classList.toggle("large-text", largeText.checked);
  largeText.addEventListener("change", () => {
    document.body.classList.toggle("large-text", largeText.checked);
    writeStorage("jiuju-reading-v1", { largeText: largeText.checked });
  });
  settings.addEventListener("click", (event) => { if (event.target === settings) settings.close(); });
  window.addEventListener("hashchange", () => {
    const value = location.hash.slice(1);
    navigate(titleAnchors[value] || value || "home", { history: false });
  });
  mounted = true;
  const initial = location.hash.slice(1);
  navigate(titleAnchors[initial] || (pageNames[initial] ? initial : "home"), { scroll: false, history: false });
})();
