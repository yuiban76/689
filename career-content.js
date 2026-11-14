(function (root) {
  "use strict";

  // Challenge metrics are keys from a player's single-match stat line in game.js.
  // Rewards stay below the existing key-game payouts so these role objectives
  // add a small, repeatable bonus without replacing the main career milestones.
  const positionChallenges = {
    P: {
      id: "role-pitcher-command",
      position: "P",
      title: "投手丘的節奏",
      detail: "完成 2 次有效決策，穩住投打交鋒的節奏。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 24, coins: 20, legacy: 3 },
    },
    C: {
      id: "role-catcher-calls",
      position: "C",
      title: "本壘後方的指揮",
      detail: "完成 2 次有效決策，讓投捕配合保持清楚。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 24, coins: 20, legacy: 3 },
    },
    "1B": {
      id: "role-first-base-anchor",
      position: "1B",
      title: "一壘守成",
      detail: "完成 2 次有效決策，穩穩接住內野傳球與攻守轉換。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 22, coins: 18, legacy: 3 },
    },
    "2B": {
      id: "role-second-base-turn",
      position: "2B",
      title: "二壘快手",
      detail: "完成 2 次有效決策，維持內野中線的攻守串聯。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 24, coins: 19, legacy: 3 },
    },
    "3B": {
      id: "role-third-base-reaction",
      position: "3B",
      title: "三壘反應時間",
      detail: "完成 2 次有效決策，準備處理強襲球與邊線戰術。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 22, coins: 18, legacy: 3 },
    },
    SS: {
      id: "role-shortstop-link",
      position: "SS",
      title: "游擊防線的樞紐",
      detail: "完成 2 次有效決策，帶動內野中線的溝通與補位。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 26, coins: 22, legacy: 4 },
    },
    LF: {
      id: "role-left-field-cover",
      position: "LF",
      title: "左外野的守備範圍",
      detail: "完成 2 次有效決策，兼顧落點判斷與內野補位。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 22, coins: 18, legacy: 3 },
    },
    CF: {
      id: "role-center-field-captain",
      position: "CF",
      title: "中外野的廣角視野",
      detail: "完成 2 次有效決策，帶領外野判斷落點並守住空檔。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 26, coins: 22, legacy: 4 },
    },
    RF: {
      id: "role-right-field-cannon",
      position: "RF",
      title: "右外野強肩",
      detail: "完成 2 次有效決策，掌握傳回內野與阻止多推進的時機。",
      metric: "decisions",
      target: 2,
      rewards: { xp: 24, coins: 20, legacy: 3 },
    },
  };

  // Keep the PRACTICE_SCENARIOS question/choices/correct/lesson shape, with
  // position and drillType metadata so the caller can select a role-specific drill.
  const positionScenarios = {
    P: [{
      id: "role-pitcher-count",
      position: "P",
      drillType: "pitching",
      question: "一出局、一壘有人，打者連續追打高球。下一球怎麼配？",
      choices: ["改投低位變化球，讓打者改變揮棒平面", "再投一顆相同高度的速球", "把球投進好球帶正中央"],
      correct: 0,
      lesson: "連續改變球速與高度，能破壞打者節奏；低位失投也比紅中更容易控制傷害。",
    }],
    C: [{
      id: "role-catcher-runner",
      position: "C",
      drillType: "defense",
      question: "一壘跑者領先距離偏大，投手看向本壘準備投球，你先注意什麼？",
      choices: ["確認投手動作與跑者起動，再準備接球或傳二壘", "只盯著打者，不管跑者", "提早離開本壘去二壘等待"],
      correct: 0,
      lesson: "捕手先讀投手與跑者的動作，才能在接球、阻殺和守本壘之間及時切換。",
    }],
    "1B": [{
      id: "role-first-base-bag",
      position: "1B",
      drillType: "defense",
      question: "游擊方向滾地球已傳向一壘，打者全速衝壘。你該如何處理？",
      choices: ["先踩穩壘包並伸手迎球，確保接球後再離壘", "提前離壘伸手攔截，賭傳球不會偏", "轉身背對來球，讓二壘手補接"],
      correct: 0,
      lesson: "一壘手先確保踩壘和接球順序，穩定完成出局比提前冒險更重要。",
    }],
    "2B": [{
      id: "role-second-base-double-play",
      position: "2B",
      drillType: "defense",
      question: "一壘有人、一出局，滾地球往二壘方向來，游擊手正在補位。你怎麼做？",
      choices: ["踩二壘封殺跑者，迅速轉身傳一壘", "先等球停下來再決定", "離開壘包追球，讓游擊手自行處理"],
      correct: 0,
      lesson: "雙殺要先確保二壘封殺，再用連續腳步和傳球爭取一壘出局。",
    }],
    "3B": [{
      id: "role-third-base-bunt",
      position: "3B",
      drillType: "defense",
      question: "無人出局、一壘有人，打者擺出短打姿勢。三壘手的第一步是？",
      choices: ["讀球棒角度，視情況前衝並確認一壘補位", "留在原位等球滾到壘線", "只看一壘跑者，不與隊友溝通"],
      correct: 0,
      lesson: "短打守備要由投球前的站位開始，三壘手前衝時也要確認一壘有人補位。",
    }],
    SS: [{
      id: "role-shortstop-cutoff",
      position: "SS",
      drillType: "defense",
      question: "外野手接到安打，一壘跑者想多跑一個壘包。游擊手如何幫助球隊？",
      choices: ["移到中繼線接球，對準下一個可能推進的壘包", "站在內野中央等外野手自行判斷", "跑去一壘後方，讓中繼線留空"],
      correct: 0,
      lesson: "游擊手負責串起外野回傳與內野封殺，站上中繼線能縮短傳球並加快決策。",
    }],
    LF: [{
      id: "role-left-field-base-hit",
      position: "LF",
      drillType: "defense",
      question: "左外野前方形成安打，二壘跑者正要繞過三壘。你先做什麼？",
      choices: ["快速到球後方接球，傳向中繼手", "直接朝本壘長傳，不確認中繼位置", "先停下來看跑者是否折返"],
      correct: 0,
      lesson: "外野先確實處理球，再透過中繼手傳回內野，可以降低多推進的機會。",
    }],
    CF: [{
      id: "role-center-field-call",
      position: "CF",
      drillType: "defense",
      question: "中外野與右外野之間的高飛球正在下墜，兩名外野手都能追到。誰應該接球？",
      choices: ["中外野手大聲呼叫並接球，另一人立即補位", "兩人都不呼叫，等球落地再處理", "兩人同時伸手，避免讓隊友接球"],
      correct: 0,
      lesson: "中外野手負責協調外野落點；清楚呼叫能避免碰撞，也讓另一名外野手及時補位。",
    }],
    RF: [{
      id: "role-right-field-relay",
      position: "RF",
      drillType: "defense",
      question: "右外野深遠安打，一壘跑者已繞過二壘，三壘手正在中繼線上。你應該怎麼傳？",
      choices: ["傳給三壘方向的中繼手，讓他快速判斷是否傳本壘", "不看跑者與中繼位置，直接大力長傳本壘", "把球傳向一壘，先確認打者跑者位置"],
      correct: 0,
      lesson: "強肩外野手善用中繼線，能讓傳球路徑更穩定，也保留本壘封殺的時間。",
    }],
  };

  const positionCodes = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  positionCodes.forEach((code) => {
    const challenge = positionChallenges[code];
    const scenarios = positionScenarios[code];
    if (!challenge || challenge.position !== code || !challenge.id || !challenge.title || !challenge.detail) {
      throw new Error(`Invalid career challenge data for ${code}`);
    }
    if (typeof challenge.metric !== "string" || !Number.isFinite(challenge.target) || challenge.target < 1) {
      throw new Error(`Invalid career challenge metric for ${code}`);
    }
    ["xp", "coins", "legacy"].forEach((reward) => {
      if (!Number.isFinite(challenge.rewards?.[reward]) || challenge.rewards[reward] < 0) {
        throw new Error(`Invalid career challenge reward ${reward} for ${code}`);
      }
    });
    if (!Array.isArray(scenarios) || scenarios.length < 1) {
      throw new Error(`Missing career scenario for ${code}`);
    }
    scenarios.forEach((scenario) => {
      if (scenario.position !== code || !scenario.id || !scenario.drillType || !scenario.question
        || !Array.isArray(scenario.choices) || scenario.choices.length < 2
        || !Number.isInteger(scenario.correct) || !hasOwn(scenario.choices, scenario.correct)
        || !scenario.lesson || Object.values(scenario).some((value) => typeof value === "function")) {
        throw new Error(`Invalid career scenario data for ${code}`);
      }
    });
  });

  root.JiujuuCareerContent = { positionChallenges, positionScenarios };
}(typeof window !== "undefined" ? window : globalThis));
