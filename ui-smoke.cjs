"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const http = require("node:http");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"))); }
const artifactDir = path.join(__dirname, ".qa-output");
fs.mkdirSync(artifactDir, { recursive: true });
const errors = [];
(async () => {
  const server = http.createServer((request, response) => {
    const file = path.resolve(__dirname, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(__dirname + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, content) => {
      if (error) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8');
      response.end(content);
    });
  });
  await new Promise((resolve) => server.listen(8877, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8877/", { waitUntil: "networkidle" });
    console.log("loaded", await page.locator("body").getAttribute("data-screen"), errors);
    assert.deepEqual(errors, []);
    assert.equal(await page.locator(".mode-card").count(), 3);
    if (process.argv[2]) {
      assert.equal(await page.locator('link[rel="stylesheet"]').getAttribute("href"), "./light.css?v=clear-layout-2026a");
      await page.getByRole("button", { name: "進入單人", exact: true }).click();
      assert.equal(await page.locator("body").getAttribute("data-screen"), "solo");
      console.log("PASS: published homepage, light stylesheet and mode navigation", process.argv[2]);
      return;
    }
    await page.screenshot({ path: path.join(artifactDir, "home-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "進入生涯", exact: true }).click();
    assert.equal(await page.locator("body").getAttribute("data-screen"), "builder");
    await page.locator("#custom-player-name").fill("晴天球員");
    await page.locator("#custom-player-team").selectOption("taichung");
    await page.locator("#custom-player-submit").click();
    assert.equal(await page.locator("body").getAttribute("data-screen"), "career");
    assert.equal(await page.locator("#career-mode-name").textContent(), "晴天球員");
    await page.getByRole("button", { name: "能力升級", exact: true }).click();
    assert.equal(await page.locator("#player-detail-name").textContent(), "晴天球員");
    const upgrade = page.locator("[data-attribute-upgrade]:enabled").first();
    const beforeCoins = await page.locator("#player-coin-badge").textContent();
    await upgrade.click();
    assert.notEqual(await page.locator("#player-coin-badge").textContent(), beforeCoins);
    await page.getByRole("button", { name: "訓練", exact: true }).click();
    await page.locator('[data-practice="hitting"]').click();
    await page.locator("[data-practice-choice]").first().click();
    await page.locator("#practice-execute-button").click();
    await page.getByRole("button", { name: "生涯首頁", exact: true }).click();
    await page.screenshot({ path: path.join(artifactDir, "career-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "查看賽程", exact: true }).click();
    assert.ok((await page.locator("#season-context").textContent()).includes("樂園桃猿"));
    assert.ok((await page.locator("#schedule-progress").textContent()).includes("樂園桃猿"));
    await page.getByRole("button", { name: "查看球團名單", exact: true }).click();
    assert.equal(await page.locator("#roster-list button").count(), 9);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "‹ 模式選單", exact: true }).click();
    assert.ok((await page.locator("#resume-name").textContent()).includes("晴天球員"));
    await page.evaluate(() => GameUI.navigate("saves"));
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-player-save").click()]);
    const exportPath = path.join(artifactDir, "player-export.json");
    await download.saveAs(exportPath);
    const importedContext = await browser.newContext();
    const importedPage = await importedContext.newPage();
    importedPage.on("dialog", (dialog) => dialog.accept());
    await importedPage.goto("http://127.0.0.1:8877/");
    await importedPage.evaluate(() => GameUI.navigate("saves"));
    await importedPage.locator("#import-player-save").setInputFiles(exportPath);
    await importedPage.waitForFunction(() => customPlayers.some((player) => player.name === "晴天球員"));
    await importedPage.reload();
    assert.ok((await importedPage.locator("#resume-name").textContent()).includes("晴天球員"));
    await importedContext.close();
    const measurements = [];
    for (const width of [375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["home", "solo", "multiplayer", "career", "training", "tasks", "upgrades", "builder", "saves", "season", "roster"]) {
        await page.evaluate((value) => window.GameUI.navigate(value, { explicit: true }), view);
        const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        measurements.push({ view, ...sizes });
        assert.ok(sizes.scroll <= width + 1, `overflow ${view} at ${width}: ${sizes.scroll}`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.GameUI.navigate("home"));
    await page.screenshot({ path: path.join(artifactDir, "home-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "進入單人", exact: true }).click();
    await page.locator("#solo-start").click();
    assert.equal(await page.locator("body").getAttribute("data-screen"), "match");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, "match-mobile.png"), fullPage: true });
    const progress = await page.evaluate(() => ({ phase: state.phase, inning: state.inning }));
    await page.evaluate(() => window.GameUI.navigate("home"));
    assert.deepEqual(await page.evaluate(() => ({ phase: state.phase, inning: state.inning })), progress);
    await page.evaluate(() => window.GameUI.navigate("match"));
    // Drive the real action entry points without changing the engine's state.
    for (let turn = 0; turn < 1000; turn++) {
      const status = await page.evaluate(() => {
        if (state.phase === "gameover") return "done";
        if (matchTimingChallenge) { finishMatchTiming(false); return "timing"; }
        const slot = activeEventSlot();
        if (slot?.controller === "npc") {
          window.clearTimeout(network.npcTimer); network.npcTimer = null;
          performActionForPlayer(null, state.phase === "defense" ? chooseNpcDefenseAction() : state.homeMode === "runner" ? "runner-hold" : chooseNpcAction(), true);
          return "npc";
        }
        const button = [...document.querySelectorAll("[data-action]")].find((node) => !node.disabled);
        if (button) { button.click(); return "action"; }
        return state.phase;
      });
      if (status === "done") break;
      await page.waitForTimeout(40);
    }
    console.log("match result", await page.evaluate(() => ({ phase: state.phase, inning: state.inning })));
    assert.equal(await page.evaluate(() => state.phase), "gameover");
    await page.evaluate(() => window.GameUI.navigate("career"));
    await page.locator("#start-career-match").click();
    assert.equal(await page.locator("body").getAttribute("data-screen"), "match");
    for (let step = 0; step < 40; step++) {
      if (await page.evaluate(() => localControlsActiveEvent())) break;
      await page.evaluate(() => {
        const slot = activeEventSlot();
        if (slot?.controller === "npc") {
          window.clearTimeout(network.npcTimer); network.npcTimer = null;
          performActionForPlayer(null, state.phase === "defense" ? chooseNpcDefenseAction() : state.homeMode === "runner" ? "runner-hold" : chooseNpcAction(), true);
        }
      });
      await page.waitForTimeout(50);
    }
    assert.equal(await page.evaluate(() => localControlsActiveEvent()), true);
    await page.locator("#match-actions-grid").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifactDir, "match-mobile-myturn.png"), fullPage: false });
    const bounds = await page.locator("#match-actions-grid").boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844, "mobile decisions visible");
    await page.locator(".history-drawer summary").click();
    const dock = await page.locator(".action-zone").boundingBox();
    assert.ok(dock.y >= 0 && dock.y + dock.height <= 845, "history cannot displace the action dock");
    await page.setViewportSize({ width: 375, height: 667 });
    const smallDock = await page.locator(".action-zone").boundingBox();
    assert.ok(smallDock.height < 400 && smallDock.y >= 0 && smallDock.y + smallDock.height <= 668, "small phone dock fits");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-action]:enabled").first().click();
    if (await page.locator("#match-timing-panel").isVisible()) {
      await page.locator("#match-timing-button").click();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(artifactDir, "match-desktop.png"), fullPage: false });
    // Check both mode entrances select the correct team without forking the season save.
    await page.evaluate(() => window.GameUI.navigate("solo"));
    await page.evaluate(() => window.GameUI.navigate("season"));
    assert.equal(await page.evaluate(() => GameUI.seasonTeamId()), await page.evaluate(() => selectedTeamId));
    const soloTeam = await page.evaluate(() => teamFor(selectedTeamId).name);
    assert.ok((await page.locator("#schedule-progress").textContent()).includes(soloTeam));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => { document.body.classList.add("large-text"); GameUI.navigate("upgrades"); });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "large text stays within mobile width");
    const hostContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    host.on("pageerror", (error) => errors.push(error.stack || error.message));
    guest.on("pageerror", (error) => errors.push(error.stack || error.message));
    await Promise.all([host.goto("http://127.0.0.1:8877/"), guest.goto("http://127.0.0.1:8877/")]);
    await host.getByRole("button", { name: "進入多人", exact: true }).click();
    await host.locator("#create-room").click();
    await host.waitForFunction(() => network.role === "host" && network.connected, { timeout: 20000 });
    const code = await host.locator("#room-code-value").textContent();
    await guest.getByRole("button", { name: "進入多人", exact: true }).click();
    await guest.locator("#room-code-input").fill(code);
    await guest.locator("#join-room").click();
    await guest.waitForFunction(() => network.role === "guest" && network.connected, { timeout: 20000 });
    await host.waitForFunction(() => humanPlayerCount() === 2, { timeout: 10000 });
    await host.locator("#lobby-start").click();
    await guest.waitForFunction(() => document.body.dataset.screen === "match", { timeout: 10000 });
    assert.equal(await host.locator("body").getAttribute("data-screen"), "match");
    await guest.waitForFunction(() => localControlsActiveEvent(), { timeout: 12000 });
    const initialRevision = await host.evaluate(() => state.revision);
    await guest.locator("[data-action]:enabled").first().click();
    if (await guest.locator("#match-timing-panel").isVisible()) await guest.locator("#match-timing-button").click();
    await host.waitForFunction((revision) => state.revision > revision, initialRevision, { timeout: 12000 });
    await guest.waitForFunction((revision) => state.revision > revision, initialRevision, { timeout: 12000 });
    await guest.getByRole("button", { name: "‹ 模式選單", exact: true }).click();
    const awayRevision = await guest.evaluate(() => state.revision);
    await host.evaluate(() => commitState());
    await guest.waitForFunction((revision) => state.revision > revision, awayRevision, { timeout: 10000 });
    assert.equal(await guest.locator("body").getAttribute("data-screen"), "home", "sync preserves the chosen page");
    console.log("PASS: two real browser clients join, enter the shared match, and synchronize a guest action");
    await Promise.all([host.evaluate(() => disconnectNetwork()), guest.evaluate(() => disconnectNetwork())]);
    await hostContext.close(); await guestContext.close();
    console.log("responsive layouts checked", measurements.length);
    assert.deepEqual(errors, []);
    console.log("PASS: mode entry, creation, upgrade, training, schedule, roster, persistence and responsive navigation");
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
