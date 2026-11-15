"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function careerChecks(page, artifactDir) {
  // The main smoke suite leaves a career match in progress. Finish it through
  // the authoritative action API, retaining NPC control for other positions.
  const finish = () => page.evaluate(() => {
    let steps = 0;
    while (state.phase !== "gameover" && steps++ < 1800) {
      clearMatchTiming(); clearActionDeadline();
      window.clearTimeout(network.npcTimer); network.npcTimer = null;
      const slot = activeEventSlot();
      const action = state.phase === "defense" ? chooseNpcDefenseAction() : state.homeMode === "runner" ? "runner-hold" : "contact";
      const manual = slot.controller === "human";
      if (!performActionForPlayer(manual ? network.localPlayerId : null, action, !manual, "", manual && actionUsesMatchTiming(action) ? matchTimingConfig(action).targetCenter : null)) throw Error("rejected " + action + " " + state.phase);
    }
    return {phase:state.phase,steps,position:customPlayerIndex[state.careerPlayerId]?.position,
      stats:state.playerStats[customPlayerIndex[state.careerPlayerId]?.position],world:CareerMode.worldFor(state.careerPlayerId)};
  });
  let result = await finish();
  assert.equal(result.phase,"gameover"); assert.equal(result.world.played,1);
  const firstId = await page.evaluate(() => state.careerPlayerId);
  const firstSaved = await page.evaluate((id) => {
    const coins=profileFor(id).careerCoins;
    recordMatchCareer(state.result); commitState();
    return {coins,after:profileFor(id).careerCoins,world:CareerMode.worldFor(id),solo:JSON.stringify(scheduleStore)};
  },firstId);
  assert.equal(firstSaved.after,firstSaved.coins);
  // Refresh cannot replay the completed game or its rewards.
  await page.reload();
  assert.equal(await page.evaluate((id)=>CareerMode.worldFor(id).played,firstId),1);
  assert.equal(await page.evaluate((id)=>profileFor(id).careerCoins,firstId),firstSaved.coins);
  for(const position of ["P","C","1B","2B","3B","SS","LF","RF"]) {
    const id = await page.evaluate((position) => {
      const player=buildCustomPlayer({name:"驗證"+position,number:"12",teamId:TEAM_DEFS[0].id,position,bats:"右",throws:"右",archetype:templatesForPosition(position)[0].id});
      customPlayers.push(player); refreshCustomPlayerIndex(); profileFor(player.id);
      useCustomPlayer(player.id); GameUI.navigate("career"); CareerMode.startNext();
      return player.id;
    },position);
    assert.equal(await page.evaluate(()=>state.careerPlayerId),id);
    assert.equal(await page.evaluate(()=>Object.values(state.slots).filter(s=>s.controller==="human").length),1);
    assert.equal(await page.evaluate(()=>state.half),"top","first half is always top");
    assert.equal(await page.evaluate(()=>state.phase),await page.evaluate(()=>state.schedulePlayerIsAway?"home":"defense"),"career follows official batting order");
    const changed = await page.evaluate((position)=>claimLocalPosition(position==="P"?"C":"P"),position);
    assert.equal(changed,false,"career role locked");
    if(position==="P") {
      await page.evaluate(()=>{ clearActionDeadline(); window.clearTimeout(network.npcTimer); network.npcTimer=null; commitState(); });
      const checkpoint=await page.evaluate(()=>({id:state.matchId,rng:state.rngState,game:state.scheduleGameId}));
      await page.reload();
      await page.evaluate((id)=>{useCustomPlayer(id); GameUI.navigate("career"); CareerMode.startNext();clearActionDeadline();},id);
      const resumed=await page.evaluate(()=>({id:state.matchId,rng:state.rngState,game:state.scheduleGameId}));
      assert.deepEqual(resumed,checkpoint,"resume same match and random state");
    }
    result=await finish();
    assert.equal(result.phase,"gameover",position);
    assert.equal(result.world.played,1,position);
    assert.ok(result.stats.decisions>0,position+" manual involvement");
    if(position==="P") {
      assert.ok(result.stats.pitchingOuts>=24);
      assert.equal(result.world.stats.pitching.SO,result.stats.pitchingStrikeouts);
      assert.equal(result.world.stats.batting.SO,result.stats.strikeouts);
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(scheduleStore)),firstSaved.solo,"career must not advance solo league");
    assert.equal(await page.evaluate((id)=>CareerMode.worldFor(id).played,firstId),1,"characters isolated");
    console.log("PASS full career game",position,result.stats.decisions,"decisions",result.world.lastReport.grade,"grade");
  }
  // A scheduled away game must actually bat first and finish normally.
  let checkedAway = false;
  for(let game=0;game<10&&!checkedAway;game++) {
    await page.evaluate(()=>{GameUI.navigate("career");CareerMode.startNext();});
    const away=await page.evaluate(()=>state.schedulePlayerIsAway);
    assert.equal(await page.evaluate(()=>state.phase),away?"home":"defense");
    result=await finish(); assert.equal(result.phase,"gameover"); assert.ok(result.world.played>=2);
    checkedAway=away;
  }
  assert.equal(checkedAway,true,"covered an actual scheduled away game");
  // All currently selectable position/template combinations must start at 60,
  // be capable of 90, and have a measured progression path using actual prices.
  const calibration=await page.evaluate(require("./career-calibration.cjs"));
  fs.writeFileSync(path.join(artifactDir,"career-calibration.json"),JSON.stringify(calibration,null,2));
  console.log("PASS calibration",calibration.length,"position/template pairs; 80 OVR",Math.min(...calibration.map(r=>r.at80))+"–"+Math.max(...calibration.map(r=>r.at80)),"games; 90 OVR",Math.min(...calibration.map(r=>r.at90))+"–"+Math.max(...calibration.map(r=>r.at90)),"games");
  for(const row of calibration){assert.equal(row.start,60,JSON.stringify(row)); assert.ok(row.potential>=90,JSON.stringify(row));assert.ok(row.at80>=20&&row.at80<=30,JSON.stringify(row));assert.ok(row.at90>=60&&row.at90<=90,JSON.stringify(row));}
  // Drive a real browser's league through the rest of its season and use the
  // visible next-season control; preserve character growth and archive stats.
  const endOfSeason = await page.evaluate(()=>{
    const player=selectedCareerPlayer(), w=CareerMode.worldFor(player.id), games=CareerEngine.scheduleFor(w,SEASON_SCHEDULE);
    for(let i=0;i<135;i++){
      const g=CareerEngine.nextGame(w,games); if(!g)break;
      const ownHome=g.homeTeamId===w.teamId, m={decisions:5,plateAppearances:4,atBats:4,hits:1,earned:{hits:1}};
      CareerEngine.settle(w,games,g,{homeScore:ownHome?8:0,awayScore:ownHome?0:8},player.position,m,CareerEngine.payout(player.position,m));
    }
    CareerMode.persist(); GameUI.navigate("season");
    return {year:w.year,coins:profileFor(player.id).careerCoins,ratings:developedPlayer(player.id).ratings,specialist:{...w.specialist},id:player.id,finished:w.postseason.finished};
  });
  assert.equal(endOfSeason.finished,true);
  await page.locator('[data-career-command="next-season"]').click();
  assert.deepEqual(await page.evaluate((id)=>{const w=CareerMode.worldFor(id);return {year:w.year,played:w.played,history:w.history.length,specialist:w.specialist,coins:profileFor(id).careerCoins,ratings:developedPlayer(id).ratings};},endOfSeason.id),
    {year:2027,played:0,history:1,specialist:endOfSeason.specialist,coins:endOfSeason.coins,ratings:endOfSeason.ratings});
  await page.reload();
  assert.equal(await page.evaluate((id)=>CareerMode.worldFor(id).year,endOfSeason.id),2027);
  assert.equal(await page.locator("#career-season-view").isVisible(),true,"refresh preserves career season context");
  // Real exported data includes isolated worlds. Exercise the old import path.
  const snapshot = await page.evaluate(()=>playerSavePayload());
  assert.equal(snapshot.version,2);
  assert.ok(Object.values(snapshot.careerLeagues).some(w=>w.played===1));
  const old={...snapshot,version:1}; delete old.careerLeagues;
  await page.evaluate(()=>GameUI.navigate("saves"));
  page.on("dialog",dialog=>dialog.accept());
  await page.locator("#import-player-save").setInputFiles({name:"old-v1.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(old))});
  assert.equal(await page.evaluate(()=>CareerMode.worldFor(customPlayers[0].id).played),0,"old stats are historical only");
  await page.locator("#import-player-save").setInputFiles({name:"new-v2.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(snapshot))});
  assert.equal(await page.evaluate(()=>CareerMode.worldFor(customPlayers[0].id).played),1);
  await page.evaluate((id)=>useCustomPlayer(id),firstId);
  await page.reload();
  assert.equal(await page.evaluate(()=>selectedCustomPlayerId),firstId,"selected character survives refresh");
  console.log("PASS: 9 positions, locked roles, match resume, single settlement, independent leagues and v1/v2 saves");
};
