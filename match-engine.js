"use strict";

(function exposeMatchEngine(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.MatchEngine = engine;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const FIELDING_POSITIONS = Object.freeze(["1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
  const EVENT_TIMEOUT_MS = Object.freeze({ pitch: 15000, catcherCall: 12000, fielding: 8000, batting: 15000, runner: 9000 });

  function createRandom(seed = 1) {
    let state = Number(seed) | 0;
    const random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    random.state = () => state;
    return random;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function expectedEventSequence(fieldingCursor = 0) {
    const start = Math.abs(Number(fieldingCursor) || 0) % FIELDING_POSITIONS.length;
    return [
      { type: "pitch", owner: "P" },
      { type: "catcher-call", owner: "C" },
      { type: "fielding", owner: FIELDING_POSITIONS[start] },
      { type: "fielding", owner: FIELDING_POSITIONS[(start + 1) % FIELDING_POSITIONS.length] },
    ];
  }

  function createAwayHalfPlan({
    inning = 1,
    fieldingCursor = 0,
    pitchAction = "defense-control",
    catcherAction = "catcher-low",
    timingScore = 65,
    offensiveStrength = 1,
    random = Math.random,
  } = {}) {
    const start = Math.abs(Number(fieldingCursor) || 0) % FIELDING_POSITIONS.length;
    const pitchRisk = {
      "defense-fast": 0.29,
      "defense-break": 0.32,
      "defense-control": 0.27,
      "defense-pickoff": 0.25,
      "defense-intentional": 0.4,
    }[pitchAction] ?? 0.28;
    const callRisk = {
      "catcher-fastball": 0.015,
      "catcher-break": -0.025,
      "catcher-low": -0.035,
      "catcher-pickoff": -0.015,
      "catcher-away": -0.02,
    }[catcherAction] ?? -0.02;
    const timingFactor = clamp(1.25 - Number(timingScore || 65) / 230, 0.82, 1.15);
    const risk = clamp((pitchRisk + callRisk) * clamp(Number(offensiveStrength) || 1, 0.9, 1.13) * timingFactor, 0.12, 0.48);
    const plays = [0, 1].map((index) => {
      const position = FIELDING_POSITIONS[(start + index) % FIELDING_POSITIONS.length];
      const infield = ["1B", "2B", "3B", "SS"].includes(position);
      const potentialRuns = random() < risk ? 1 + (index === 1 && random() < 0.08 ? 1 : 0) : 0;
      const pressure = random();
      return {
        number: index + 1,
        position,
        kind: infield ? "groundball" : "flyball",
        potentialRuns,
        runnerCount: pressure < 0.2 ? 2 : pressure < 0.55 ? 1 : 0,
        leadRunnerOnThird: pressure < 0.13,
        situation: infield
          ? pressure < 0.55 ? "一壘有跑者，選擇守一壘、封殺或嘗試雙殺。" : "內野滾地球，判斷先抓出局還是冒險撲球。"
          : pressure < 0.4 ? "外野飛球，先決定接殺或落地後快速回傳。" : "外野來球，留意跑者推進並選擇回傳目標。",
      };
    });
    return {
      inning: Number(inning) || 1,
      plays,
      nextFieldingCursor: (start + plays.length) % FIELDING_POSITIONS.length,
      runRisk: risk,
      eventSequence: expectedEventSequence(start),
    };
  }

  function resolveFieldingPlay({ play, action, ratings = {}, difficultyScale = 0.88, planFactor = 1, random = Math.random } = {}) {
    const fielding = clamp(Number(ratings.fielding ?? 70) / 100, 0.3, 1);
    const arm = clamp(Number(ratings.armStrength ?? ratings.arm ?? 70) / 100, 0.3, 1);
    const accuracy = clamp(Number(ratings.armAccuracy ?? 70) / 100, 0.3, 1);
    const reaction = clamp(Number(ratings.reaction ?? ratings.fielding ?? 70) / 100, 0.3, 1);
    const skillFactor = clamp(Number(difficultyScale) * Number(planFactor), 0.45, 1.15);
    const roll = random();
    let savedRun = false;
    let extraRun = false;
    let outs = 0;
    let error = false;

    if (play?.kind === "groundball") {
      if (action === "fielding-double" && play.runnerCount > 0) {
        outs = roll < (0.18 + fielding * 0.28 + reaction * 0.16) * skillFactor ? 2 : 1;
        error = outs === 0;
      } else if (["fielding-force", "fielding-first", "fielding-home"].includes(action)) {
        const targetBonus = action === "fielding-home" && play.leadRunnerOnThird ? 0.14 : 0;
        outs = roll < (0.3 + fielding * 0.22 + reaction * 0.12 + targetBonus) * skillFactor ? 1 : 0;
        savedRun = action === "fielding-home" && play.leadRunnerOnThird && outs === 1;
        error = outs === 0 && roll > 0.92;
      } else if (action === "fielding-dive") {
        const success = roll < (0.14 + fielding * 0.34 + reaction * 0.2) * skillFactor;
        outs = success ? 1 : 0;
        savedRun = success;
        extraRun = !success && roll > 0.58;
        error = !success && extraRun;
      } else {
        outs = roll < (0.4 + fielding * 0.18 + reaction * 0.1) * skillFactor ? 1 : 0;
      }
    } else if (action === "fielding-catch") {
      const success = roll < (0.4 + fielding * 0.18 + reaction * 0.1) * skillFactor;
      outs = success ? 1 : 0;
      savedRun = success;
      error = !success && roll > 0.78;
      extraRun = error;
    } else if (action === "fielding-dive") {
      const success = roll < (0.14 + fielding * 0.34 + reaction * 0.2) * skillFactor;
      outs = success ? 1 : 0;
      savedRun = success;
      extraRun = !success && roll > 0.5;
      error = extraRun;
    } else if (["fielding-relay", "fielding-cutoff", "fielding-throw"].includes(action)) {
      const chance = action === "fielding-throw"
        ? 0.22 + arm * 0.38 + accuracy * 0.16
        : action === "fielding-relay"
          ? 0.28 + arm * 0.28 + accuracy * 0.17
          : 0.34 + arm * 0.22 + accuracy * 0.17;
      const success = roll < chance * skillFactor;
      outs = success && play.runnerCount > 0 ? 1 : 0;
      savedRun = success;
      extraRun = action === "fielding-throw" && !success && play.potentialRuns === 0;
      error = extraRun;
    } else {
      outs = roll < (0.52 + fielding * 0.16 + reaction * 0.08) * skillFactor ? 1 : 0;
    }

    let runs = Math.max(0, Number(play?.potentialRuns) || 0);
    if (savedRun) runs = Math.max(0, runs - 1);
    if (extraRun) runs += 1;
    return { runs, outs, error, savedRun, extraRun };
  }

  function simulateAwayHalf({
    seed = 1,
    inning = 1,
    fieldingCursor = 0,
    pitchAction = "defense-control",
    catcherAction = "catcher-low",
    timingScore = 65,
    offensiveStrength = 1,
    actions = null,
  } = {}) {
    const random = createRandom(seed);
    const plan = createAwayHalfPlan({ inning, fieldingCursor, pitchAction, catcherAction, timingScore, offensiveStrength, random });
    const plays = plan.plays.map((play, index) => {
      const infield = play.kind === "groundball";
      const action = actions?.[index] || (infield ? "fielding-force" : "fielding-relay");
      const ratings = { fielding: 74, armStrength: 75, armAccuracy: 75, reaction: 74 };
      const result = resolveFieldingPlay({ play, action, ratings, random });
      return { ...play, action, result };
    });
    return {
      inning: plan.inning,
      plays,
      runs: Math.min(3, plays.reduce((sum, play) => sum + play.result.runs, 0)),
      nextFieldingCursor: plan.nextFieldingCursor,
      eventSequence: plan.eventSequence,
      runRisk: plan.runRisk,
      finalRngState: random.state(),
    };
  }

  function consumeEventSubmission(state, submission) {
    const event = state?.activeEvent;
    if (!event || !submission || !event.id || event.id !== submission.eventId) return false;
    if (Number(submission.revision) !== Number(state.revision)) return false;
    if (state.lastSettledEventId === event.id) return false;
    state.lastSettledEventId = event.id;
    return true;
  }

  return Object.freeze({
    FIELDING_POSITIONS,
    EVENT_TIMEOUT_MS,
    createRandom,
    expectedEventSequence,
    createAwayHalfPlan,
    resolveFieldingPlay,
    simulateAwayHalf,
    consumeEventSubmission,
  });
});
