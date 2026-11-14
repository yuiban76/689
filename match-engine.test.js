"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const MatchEngine = require("./match-engine.js");
require("./career-content.js");
const CareerContent = globalThis.JiujuuCareerContent;

test("fixed seeds replay the same away-half sequence and result", () => {
  const first = MatchEngine.simulateAwayHalf({ seed: 348921, inning: 4, fieldingCursor: 5 });
  const replay = MatchEngine.simulateAwayHalf({ seed: 348921, inning: 4, fieldingCursor: 5 });
  assert.deepEqual(replay, first);
});

test("away-half decisions follow pitcher, catcher, then two legal fielding roles", () => {
  const plan = MatchEngine.createAwayHalfPlan({ seed: 7, random: MatchEngine.createRandom(7), fieldingCursor: 3 });
  assert.deepEqual(plan.eventSequence.map(({ type }) => type), ["pitch", "catcher-call", "fielding", "fielding"]);
  assert.deepEqual(plan.eventSequence.slice(2).map(({ owner }) => owner), ["SS", "LF"]);
  assert.equal(plan.plays.length, 2);
  assert.ok(plan.plays.every(({ position, kind }) => MatchEngine.FIELDING_POSITIONS.includes(position) && ["groundball", "flyball"].includes(kind)));
});

test("stale, mismatched, and duplicate submissions cannot settle an event twice", () => {
  const state = {
    revision: 12,
    activeEvent: { id: "match-a:E8" },
    lastSettledEventId: "match-a:E7",
  };
  assert.equal(MatchEngine.consumeEventSubmission(state, { eventId: "match-a:E7", revision: 12 }), false);
  assert.equal(MatchEngine.consumeEventSubmission(state, { eventId: "match-a:E8", revision: 11 }), false);
  assert.equal(MatchEngine.consumeEventSubmission(state, { eventId: "match-a:E8", revision: 12 }), true);
  assert.equal(MatchEngine.consumeEventSubmission(state, { eventId: "match-a:E8", revision: 12 }), false);
});

test("each defensive position has a challenge and a role-specific practice scenario", () => {
  const positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  positions.forEach((position) => {
    assert.equal(CareerContent.positionChallenges[position].position, position);
    assert.ok(CareerContent.positionChallenges[position].rewards.xp > 0);
    assert.ok(CareerContent.positionScenarios[position].length > 0);
    assert.ok(CareerContent.positionScenarios[position].every((scenario) => scenario.position === position && scenario.choices.length >= 2));
  });
});

test("1, 3, 5, and 9 player rooms keep every event assigned to a player or NPC", () => {
  const positions = ["P", "C", ...MatchEngine.FIELDING_POSITIONS];
  for (const humanCount of [1, 3, 5, 9]) {
    const humanPositions = new Set(positions.slice(0, humanCount));
    let cursor = 0;
    for (let inning = 1; inning <= 9; inning += 1) {
      const plan = MatchEngine.createAwayHalfPlan({ inning, fieldingCursor: cursor, random: MatchEngine.createRandom(inning * 53 + humanCount) });
      cursor = plan.nextFieldingCursor;
      const eventOwners = ["P", "C", ...plan.plays.map((play) => play.position)];
      assert.equal(eventOwners.length, 4);
      assert.ok(eventOwners.every((owner) => positions.includes(owner)));
      assert.ok(eventOwners.some((owner) => humanPositions.has(owner)) || humanCount === 0);
      assert.ok(eventOwners.every((owner) => humanPositions.has(owner) || positions.includes(owner)), `room ${humanCount}, inning ${inning} has an unassigned event`);
    }
  }
});

test("1,000 nine-inning games cover every fielding position and keep outcomes and waits bounded", () => {
  let totalHomeRuns = 0;
  let totalAwayRuns = 0;
  let totalHalves = 0;
  let homeWins = 0;
  let awayWins = 0;
  let ties = 0;
  let maxAwayHalfWaitMs = 0;
  for (let game = 1; game <= 1000; game += 1) {
    let cursor = 0;
    let homeRuns = 0;
    let awayRuns = 0;
    const opportunities = Object.fromEntries(MatchEngine.FIELDING_POSITIONS.map((position) => [position, 0]));
    for (let inning = 1; inning <= 9; inning += 1) {
      const half = MatchEngine.simulateAwayHalf({ seed: game * 1009 + inning, inning, fieldingCursor: cursor });
      const homeHalf = MatchEngine.simulateAwayHalf({ seed: game * 2017 + inning, inning, fieldingCursor: cursor });
      cursor = half.nextFieldingCursor;
      awayRuns += half.runs;
      homeRuns += homeHalf.runs;
      totalHalves += 1;
      half.plays.forEach(({ position }) => { opportunities[position] += 1; });
      const halfWaitMs = MatchEngine.EVENT_TIMEOUT_MS.pitch
        + MatchEngine.EVENT_TIMEOUT_MS.catcherCall
        + MatchEngine.EVENT_TIMEOUT_MS.fielding * half.plays.length;
      maxAwayHalfWaitMs = Math.max(maxAwayHalfWaitMs, halfWaitMs);
    }
    assert.ok(Object.values(opportunities).every((count) => count >= 2), `game ${game} missed a position: ${JSON.stringify(opportunities)}`);
    assert.ok(homeRuns >= 0 && awayRuns >= 0 && homeRuns <= 54 && awayRuns <= 54, `game ${game} produced invalid runs: ${homeRuns}-${awayRuns}`);
    if (homeRuns > awayRuns) homeWins += 1;
    else if (awayRuns > homeRuns) awayWins += 1;
    else ties += 1;
    totalHomeRuns += homeRuns;
    totalAwayRuns += awayRuns;
  }
  const runsPerHalf = (totalHomeRuns + totalAwayRuns) / (totalHalves * 2);
  const homeWinRate = homeWins / 1000;
  const awayWinRate = awayWins / 1000;
  assert.ok(runsPerHalf > 0.15 && runsPerHalf < 1.5, `unexpected mean runs per half: ${runsPerHalf}`);
  assert.ok(homeWinRate > 0.35 && homeWinRate < 0.65, `home win rate outside expected balance range: ${homeWinRate}`);
  assert.ok(awayWinRate > 0.35 && awayWinRate < 0.65, `away win rate outside expected balance range: ${awayWinRate}`);
  assert.ok(ties >= 0 && ties < 1000);
  assert.equal(maxAwayHalfWaitMs, 43000, "worst-case away-half event wait should stay under 45 seconds");
});
