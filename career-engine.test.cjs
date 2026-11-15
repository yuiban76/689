"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./career-engine.js");
const teams = ["a", "b", "c", "d", "e", "f"];
// Same 6-team / 120-game format as the browser, with 3 games per date.
const template = [];
for (let round = 0; round < 24; round++) {
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
    const n = template.length + 1;
    template.push({ gameNo:n, date:new Date(Date.UTC(2026,2,28 + Math.floor((n-1)/3))).toISOString().slice(0,10),
      homeTeamId:teams[round % 2 ? b:a], awayTeamId:teams[round % 2 ? a:b] });
  }
}
const sample = { decisions:8, plateAppearances:4, atBats:3, hits:1, walks:1, strikeouts:1, putouts:2,
  pitchingOuts:27, pitchingStrikeouts:7, pitchingER:2, teamDefenseOuts:27,
  earned:{ hits:1, onBase:2, walks:1, fieldSuccess:2, scorelessHalves:5, pitchingStrikeouts:7, catcherSuccess:5 }};
test("nine role goals, grades and event-based progression", () => {
  for (const position of ["P","C","1B","2B","3B","SS","LF","CF","RF"]) {
    const goal = E.objective(position);
    assert.notEqual(goal.key, "decisions");
    const report = E.payout(position,sample,{objective:goal});
    assert.equal(report.objectiveCompleted,true,position);
    assert.ok(report.coins>=120);
    assert.equal(E.grade(position,{decisions:999}),60);
    assert.equal(E.payout(position,{decisions:0,earned:{hits:99}}).coins,0);
  }
  assert.equal(E.TRACKS.pitching.points({decisions:999}),0);
  assert.ok(E.grade("P",sample)>E.grade("P",{...sample,pitchingER:20}));
  assert.ok(E.grade("C",sample)>E.grade("C",{...sample,earned:{}}));
  assert.equal(E.badge(150).bonus,.03);
});
test("pitcher Ks, batter Ks and canonical innings stay independent; legacy innings migrate once", () => {
  const stats={pitching:{IP:1.6666666666666667,SO:3},batting:{SO:2}};
  E.accumulate(stats,"P",{...sample,pitchingOuts:1,pitchingStrikeouts:2,strikeouts:1},"win");
  assert.equal(stats.pitching.outs,6); assert.equal(E.innings(stats.pitching.outs),"2.0");
  assert.equal(stats.pitching.SO,5); assert.equal(stats.batting.SO,3);
  E.accumulate(stats,"P",{pitchingOuts:1},"loss");
  assert.equal(E.innings(stats.pitching.outs),"2.1");
});
test("120 regular games, peer simulation, playoffs, idempotency, new year and isolated characters", () => {
  const untouched = E.newWorld("other","b",teams);
  for (const ownTeam of teams) {
    const w=E.newWorld("player",ownTeam,teams);
    let games=E.scheduleFor(w,template);
    assert.equal(games.filter(g=>[g.homeTeamId,g.awayTeamId].includes(ownTeam)).length,120);
    let count=0, postCount=0;
    for (; count<140; count++) {
      const game=E.nextGame(w,games);
      if (!game) break;
      const ownHome=game.homeTeamId===ownTeam;
      const score={homeScore:ownHome?5:1,awayScore:ownHome?1:5};
      const report=E.payout("P",sample,{objective:E.objective("P"),keyGame:E.keyGame(game,w)});
      assert.equal(E.settle(w,games,game,score,"P",sample,report),true);
      const snapshot=JSON.stringify(w);
      assert.equal(E.settle(w,games,game,score,"P",sample,report),false);
      assert.equal(JSON.stringify(w),snapshot);
      if(game.isPostseason)postCount++;
    }
    assert.equal(Object.keys(w.completed).length,360);
    assert.equal(w.postseason.finished,true);
    assert.equal(w.postseason.champion,ownTeam);
    assert.equal(postCount,4);
    assert.equal(count,124);
    const specialist={...w.specialist};
    assert.equal(E.nextSeason(w,games,90),true);
    assert.equal(w.year,2027); assert.equal(w.history.length,1);
    assert.equal(w.history[0].stats.pitching.SO,124*7);
    assert.equal(w.stats.pitching.SO,0); assert.deepEqual(w.specialist,specialist);
    games=E.scheduleFor(w,template); assert.ok(E.nextGame(w,games).id.startsWith("2027-"));
    assert.equal(E.nextSeason(w,games,90),false);
  }
  assert.equal(untouched.played,0); assert.deepEqual(untouched.completed,{});
});
test("eliminated team finishes the postseason without extra games", () => {
  const w=E.newWorld("loser","a",teams), games=E.scheduleFor(w,template);
  for(let i=0;i<120;i++){
    const game=E.nextGame(w,games), home=game.homeTeamId==="a";
    E.settle(w,games,game,{homeScore:home?0:5,awayScore:home?5:0},"CF",sample,E.payout("CF",sample));
  }
  assert.equal(w.postseason.finished,true);
  assert.equal(E.nextGame(w,games),null);
  assert.equal(E.nextSeason(w,games,75),true);
});
test("second seed plays both postseason series in date order; playoff ties cannot settle", () => {
  const w=E.newWorld("second","b",teams), games=E.scheduleFor(w,template);
  for(const g of games) {
    const homeRank=teams.indexOf(g.homeTeamId),awayRank=teams.indexOf(g.awayTeamId);
    w.completed[g.id]={...g,homeScore:homeRank<awayRank?5:1,awayScore:homeRank<awayRank?1:5};
  }
  E.advancePostseason(w,games);
  assert.deepEqual(w.postseason.seeds,["a","b","c"]);
  const first=E.nextGame(w,games), unchanged=JSON.stringify(w);
  assert.equal(first.stage,"challenge");
  assert.ok(first.date>games.at(-1).date);
  assert.equal(E.settle(w,games,first,{homeScore:1,awayScore:1},"C",sample,E.payout("C",sample)),false);
  assert.equal(JSON.stringify(w),unchanged);
  let previous=games.at(-1).date,count=0;
  while(E.nextGame(w,games)) {
    const g=E.nextGame(w,games),home=g.homeTeamId===w.teamId;
    assert.ok(g.date>previous);previous=g.date;
    E.settle(w,games,g,{homeScore:home?5:1,awayScore:home?1:5},"C",sample,E.payout("C",sample));
    count++;
    assert.ok(count<13);
  }
  assert.equal(count,7); assert.equal(w.postseason.champion,"b");
  assert.deepEqual(E.normalizeWorld(JSON.parse(JSON.stringify(w)),"second","b",teams),w);
});
