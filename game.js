"use strict";

const $ = (id) => document.getElementById(id);
const actionButtons = [...document.querySelectorAll("[data-action]")];
const PROTOCOL_VERSION = 2;
const MAX_PLAYERS = 9;
const MAX_LOG = 14;
const ACTION_TIMEOUT_MS = { defense: 7000, fielding: 5000, home: 10000 };
const SESSION_STORAGE_KEY = "jiuju-session-id-v1";

function readPersistentSessionId() {
  const fallback = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing.slice(0, 80);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fallback);
  } catch {}
  return fallback;
}

const POSITION_DEFS = [
  { code: "P", name: "投手", short: "投", contact: 62, power: 58, speed: 50, fielding: 61, arm: 78 },
  { code: "C", name: "捕手", short: "捕", contact: 73, power: 65, speed: 46, fielding: 78, arm: 84 },
  { code: "1B", name: "一壘", short: "一", contact: 76, power: 81, speed: 48, fielding: 70, arm: 65 },
  { code: "2B", name: "二壘", short: "二", contact: 70, power: 68, speed: 72, fielding: 82, arm: 67 },
  { code: "3B", name: "三壘", short: "三", contact: 79, power: 77, speed: 59, fielding: 73, arm: 80 },
  { code: "SS", name: "游擊", short: "游", contact: 72, power: 61, speed: 82, fielding: 88, arm: 86 },
  { code: "LF", name: "左外", short: "左", contact: 76, power: 81, speed: 69, fielding: 72, arm: 70 },
  { code: "CF", name: "中外", short: "中", contact: 82, power: 67, speed: 86, fielding: 85, arm: 75 },
  { code: "RF", name: "右外", short: "右", contact: 74, power: 86, speed: 71, fielding: 76, arm: 88 },
];

const POSITION_BY_CODE = Object.fromEntries(POSITION_DEFS.map((position) => [position.code, position]));

const CAREER_STORAGE_KEY = "jiuju-career-v2";
const LEAGUE_STORAGE_KEY = "jiuju-league-v2";
const CUSTOM_PLAYERS_STORAGE_KEY = "jiuju-custom-players-v1";
const MAX_CUSTOM_PLAYERS = 18;
const DEFAULT_TEAM_ID = "taipei";
const DEFAULT_OPPONENT_ID = "kaohsiung";

const TEAM_DEFS = [
  { id: "taipei", name: "台北雷霆", city: "台北", shortName: "雷霆", stadium: "雷霆巨蛋", style: "速度壓迫", color: "#d8f26d", bonus: { contact: 3, speed: 3, fielding: 1 } },
  { id: "kaohsiung", name: "高雄海鷗", city: "高雄", shortName: "海鷗", stadium: "海風球場", style: "長打火力", color: "#ff9d59", bonus: { power: 4, armStrength: 2, clutch: 2 } },
  { id: "taichung", name: "台中獵鷹", city: "台中", shortName: "獵鷹", stadium: "中央公園球場", style: "穩定守備", color: "#8be5d1", bonus: { fielding: 4, reaction: 3, discipline: 1 } },
  { id: "hsinchu", name: "新竹星火", city: "新竹", shortName: "星火", stadium: "風城球場", style: "選球控場", color: "#b7a7ff", bonus: { vision: 4, control: 3, discipline: 3 } },
  { id: "taoyuan", name: "桃園飛翼", city: "桃園", shortName: "飛翼", stadium: "航空城球場", style: "全能平衡", color: "#72c9ff", bonus: { contact: 2, speed: 2, armAccuracy: 2, break: 2 } },
  { id: "chiayi", name: "嘉義巨浪", city: "嘉義", shortName: "巨浪", stadium: "木都球場", style: "投手養成", color: "#f59eb5", bonus: { velocity: 4, stamina: 3, break: 3, power: 2 } },
];

const ROSTER_BLUEPRINTS = [
  { position: "CF", number: "07", role: "全能中外", archetype: "五拍工具人", bats: "左", throws: "右", ratings: { contact: 82, power: 67, vision: 79, discipline: 72, clutch: 75, bunt: 62, dragBunt: 70, speed: 86, stealing: 75, fielding: 85, armStrength: 75, armAccuracy: 78, reaction: 86, blocking: 42, popTime: 2.1, velocity: 55, control: 48, break: 46, stamina: 45 } },
  { position: "RF", number: "23", role: "強肩右外", archetype: "長打砲", bats: "右", throws: "右", ratings: { contact: 74, power: 86, vision: 63, discipline: 68, clutch: 77, bunt: 38, dragBunt: 28, speed: 71, stealing: 52, fielding: 76, armStrength: 89, armAccuracy: 82, reaction: 73, blocking: 40, popTime: 2.1, velocity: 60, control: 43, break: 42, stamina: 44 } },
  { position: "3B", number: "31", role: "強襲三壘", archetype: "關鍵長打", bats: "右", throws: "右", ratings: { contact: 79, power: 77, vision: 71, discipline: 66, clutch: 82, bunt: 41, dragBunt: 30, speed: 59, stealing: 35, fielding: 73, armStrength: 80, armAccuracy: 78, reaction: 70, blocking: 42, popTime: 2.1, velocity: 61, control: 43, break: 44, stamina: 46 } },
  { position: "1B", number: "44", role: "重砲一壘", archetype: "純力量", bats: "左", throws: "左", ratings: { contact: 76, power: 92, vision: 65, discipline: 76, clutch: 79, bunt: 22, dragBunt: 16, speed: 43, stealing: 18, fielding: 68, armStrength: 61, armAccuracy: 64, reaction: 62, blocking: 48, popTime: 2.1, velocity: 53, control: 43, break: 40, stamina: 49 } },
  { position: "LF", number: "12", role: "角落外野", archetype: "攻擊型", bats: "右", throws: "右", ratings: { contact: 76, power: 81, vision: 70, discipline: 69, clutch: 74, bunt: 44, dragBunt: 34, speed: 69, stealing: 48, fielding: 72, armStrength: 70, armAccuracy: 73, reaction: 68, blocking: 40, popTime: 2.1, velocity: 56, control: 44, break: 42, stamina: 45 } },
  { position: "2B", number: "08", role: "二壘工兵", archetype: "擊球串聯", bats: "左", throws: "右", ratings: { contact: 70, power: 68, vision: 77, discipline: 78, clutch: 69, bunt: 58, dragBunt: 55, speed: 72, stealing: 62, fielding: 82, armStrength: 67, armAccuracy: 81, reaction: 83, blocking: 40, popTime: 2.1, velocity: 54, control: 45, break: 41, stamina: 45 } },
  { position: "SS", number: "19", role: "游擊核心", archetype: "防守魔術師", bats: "右", throws: "右", ratings: { contact: 72, power: 61, vision: 73, discipline: 67, clutch: 70, bunt: 63, dragBunt: 61, speed: 82, stealing: 70, fielding: 88, armStrength: 86, armAccuracy: 88, reaction: 91, blocking: 40, popTime: 2.1, velocity: 57, control: 45, break: 43, stamina: 46 } },
  { position: "C", number: "02", role: "主戰捕手", archetype: "投手指揮官", bats: "右", throws: "右", ratings: { contact: 73, power: 65, vision: 69, discipline: 73, clutch: 83, bunt: 30, dragBunt: 22, speed: 44, stealing: 12, fielding: 79, armStrength: 85, armAccuracy: 84, reaction: 76, blocking: 88, popTime: 1.94, velocity: 58, control: 56, break: 54, stamina: 57 } },
  { position: "P", number: "55", role: "先發投手", archetype: "控球王牌", bats: "右", throws: "右", pitchMix: ["四縫線速球", "滑球", "變速球", "曲球"], ratings: { contact: 58, power: 52, vision: 58, discipline: 62, clutch: 76, bunt: 50, dragBunt: 20, speed: 43, stealing: 10, fielding: 61, armStrength: 70, armAccuracy: 68, reaction: 57, blocking: 40, popTime: 2.1, velocity: 85, control: 82, break: 79, stamina: 87 } },
];

const TEAM_PLAYER_NAMES = {
  taipei: ["林昱辰", "陳柏翰", "王子謙", "吳承恩", "張偉倫", "李明哲", "蔡瑞峰", "高宇翔", "周凱翔"],
  kaohsiung: ["蘇冠廷", "洪政勳", "葉俊豪", "鄭凱文", "林威廷", "黃彥翔", "許廷威", "曾冠宇", "何昊恩"],
  taichung: ["邱品睿", "羅立安", "沈柏勳", "江承翰", "陳奕勳", "郭柏辰", "吳俊賢", "賴志豪", "謝秉哲"],
  hsinchu: ["彭子皓", "廖冠霖", "鄧皓文", "許家銘", "高靖凱", "柯宇翔", "方彥鈞", "蘇子謙", "朱柏翰"],
  taoyuan: ["黃少謙", "林冠宇", "徐睿恩", "鄭博元", "謝承翰", "陳昱安", "楊哲維", "洪士軒", "吳柏勳"],
  chiayi: ["張凱傑", "李冠廷", "蔡岳霖", "王俊皓", "郭彥廷", "陳柏宇", "曾奕翔", "林家佑", "趙子豪"],
};

function createSeasonStats() {
  return {
    batting: { G: 0, PA: 0, AB: 0, R: 0, H: 0, doubles: 0, triples: 0, HR: 0, RBI: 0, BB: 0, SO: 0, SB: 0, CS: 0, HBP: 0, SF: 0 },
    pitching: { G: 0, GS: 0, W: 0, L: 0, SV: 0, IP: 0, H: 0, ER: 0, BB: 0, SO: 0, HR: 0, HBP: 0, WP: 0 },
    fielding: { G: 0, GS: 0, INN: 0, PO: 0, A: 0, E: 0, DP: 0, PB: 0, SB: 0, CS: 0 },
  };
}

const CUSTOM_ARCHETYPES = {
  balanced: { label: "五拍工具人", role: "自創全能", adjustments: { contact: 6, power: 4, vision: 5, discipline: 4, clutch: 5, speed: 4, stealing: 3, fielding: 4, reaction: 4, armAccuracy: 3 } },
  slugger: { label: "長打砲", role: "自創長打", adjustments: { contact: -2, power: 14, vision: -3, discipline: -2, clutch: 9, speed: -7, stealing: -8, fielding: -4, reaction: -4, armStrength: 3 } },
  speedster: { label: "速度跑者", role: "自創快腿", adjustments: { contact: 4, power: -8, vision: 2, discipline: 2, clutch: 3, speed: 14, stealing: 14, bunt: 10, dragBunt: 10, fielding: 5, reaction: 5 } },
  defender: { label: "守備專家", role: "自創鐵壁", adjustments: { contact: -3, power: -6, vision: 2, discipline: 3, clutch: 2, speed: 5, stealing: 1, fielding: 14, reaction: 13, armStrength: 8, armAccuracy: 10 } },
  pitcher: { label: "控球投手", role: "自創王牌", adjustments: { contact: -8, power: -7, vision: 2, discipline: 4, clutch: 8, speed: -4, fielding: 3, reaction: 3, velocity: 8, control: 14, break: 12, stamina: 14 } },
};

function buildTeamRoster(team, teamIndex) {
  const names = TEAM_PLAYER_NAMES[team.id] || [];
  return ROSTER_BLUEPRINTS.map((blueprint, playerIndex) => {
    const variance = ((teamIndex * 5 + playerIndex * 3) % 7) - 3;
    const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
      const bonus = team.bonus[key] || 0;
      const adjustedVariance = ["popTime"].includes(key) ? variance * -0.015 : variance;
      const adjusted = key === "popTime" ? Math.max(1.78, Math.min(2.3, value + adjustedVariance)) : Math.max(20, Math.min(99, value + bonus + adjustedVariance));
      return [key, Number(adjusted.toFixed(key === "popTime" ? 2 : 0))];
    }));
    ratings.contactL = Math.max(20, Math.min(99, ratings.contact + ((teamIndex + playerIndex) % 5) - 2));
    ratings.contactR = Math.max(20, Math.min(99, ratings.contact + ((teamIndex * 2 + playerIndex + 1) % 5) - 2));
    ratings.powerL = Math.max(20, Math.min(99, ratings.power + ((teamIndex * 3 + playerIndex) % 5) - 2));
    ratings.powerR = Math.max(20, Math.min(99, ratings.power + ((teamIndex + playerIndex * 2) % 5) - 2));
    return {
      id: `${team.id}-${blueprint.position.toLowerCase()}`,
      teamId: team.id,
      name: names[playerIndex] || `${team.shortName}${blueprint.position}`,
      position: blueprint.position,
      number: blueprint.number,
      role: blueprint.role,
      archetype: blueprint.archetype,
      pitchMix: blueprint.pitchMix || [],
      bats: blueprint.bats,
      throws: blueprint.throws,
      age: 21 + ((teamIndex * 3 + playerIndex * 2) % 13),
      height: 168 + ((teamIndex * 7 + playerIndex * 4) % 21),
      weight: 66 + ((teamIndex * 9 + playerIndex * 6) % 31),
      potential: Math.min(99, 78 + ((teamIndex * 4 + playerIndex * 7) % 18)),
      ratings,
      stats: createSeasonStats(),
    };
  });
}

const LEAGUE_TEAMS = TEAM_DEFS.map((team, teamIndex) => ({ ...team, roster: buildTeamRoster(team, teamIndex) }));
const TEAM_BY_ID = Object.fromEntries(LEAGUE_TEAMS.map((team) => [team.id, team]));
const BASE_PLAYER_BY_ID = Object.fromEntries(LEAGUE_TEAMS.flatMap((team) => team.roster).map((player) => [player.id, player]));

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeCustomPlayer(raw, index = 0) {
  const source = raw && typeof raw === "object" ? raw : {};
  const position = POSITION_BY_CODE[source.position] ? source.position : "CF";
  const teamId = TEAM_BY_ID[source.teamId] ? source.teamId : DEFAULT_TEAM_ID;
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const rawRatings = source.ratings && typeof source.ratings === "object" ? source.ratings : {};
  const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
    const candidate = Number(rawRatings[key]);
    if (key === "popTime") return [key, Number.isFinite(candidate) ? Math.max(1.78, Math.min(2.3, candidate)) : value];
    return [key, Number.isFinite(candidate) ? Math.max(20, Math.min(99, candidate)) : value];
  }));
  ratings.contactL = Number(rawRatings.contactL || ratings.contact);
  ratings.contactR = Number(rawRatings.contactR || ratings.contact);
  ratings.powerL = Number(rawRatings.powerL || ratings.power);
  ratings.powerR = Number(rawRatings.powerR || ratings.power);
  const stats = source.stats || {};
  const defaults = createSeasonStats();
  return {
    ...blueprint,
    ...source,
    id: String(source.id || `custom-${Date.now()}-${index}`),
    teamId,
    name: String(source.name || "自創球員").replace(/[<>]/g, "").trim().slice(0, 14) || "自創球員",
    position,
    number: String(source.number || "99").replace(/\D/g, "").slice(0, 2).padStart(2, "0") || "99",
    role: String(source.role || "自創球員").slice(0, 12),
    archetype: String(source.archetype || "自訂全能").slice(0, 18),
    pitchMix: Array.isArray(source.pitchMix) ? source.pitchMix.slice(0, 5) : blueprint.pitchMix || [],
    bats: ["左", "右", "兩側"].includes(source.bats) ? source.bats : "右",
    throws: source.throws === "左" ? "左" : "右",
    age: Math.max(16, Math.min(45, Number(source.age) || 18)),
    height: Math.max(150, Math.min(220, Number(source.height) || 175)),
    weight: Math.max(45, Math.min(140, Number(source.weight) || 72)),
    potential: Math.max(80, Math.min(99, Number(source.potential) || 90)),
    ratings,
    stats: {
      ...defaults,
      ...stats,
      batting: { ...defaults.batting, ...(stats.batting || {}) },
      pitching: { ...defaults.pitching, ...(stats.pitching || {}) },
      fielding: { ...defaults.fielding, ...(stats.fielding || {}) },
    },
    isCustom: true,
    active: source.active !== false,
  };
}

let customPlayers = readStorage(CUSTOM_PLAYERS_STORAGE_KEY, []);
customPlayers = Array.isArray(customPlayers) ? customPlayers.map(normalizeCustomPlayer).slice(0, MAX_CUSTOM_PLAYERS) : [];
let customPlayerIndex = {};

function refreshCustomPlayerIndex() {
  customPlayerIndex = Object.fromEntries(customPlayers.map((player) => [player.id, player]));
}

function playerDefinitionFor(playerId) {
  return BASE_PLAYER_BY_ID[playerId] || customPlayerIndex[playerId] || null;
}

refreshCustomPlayerIndex();

let careerStore = readStorage(CAREER_STORAGE_KEY, {});
let leagueStore = readStorage(LEAGUE_STORAGE_KEY, {});
const initialCustomPlayer = customPlayers.slice().reverse().find((player) => player.active !== false) || null;
let selectedTeamId = DEFAULT_TEAM_ID;
let selectedOpponentId = DEFAULT_OPPONENT_ID;
let developmentTeamId = initialCustomPlayer?.teamId || DEFAULT_TEAM_ID;
let selectedAthleteId = initialCustomPlayer?.id || `${DEFAULT_TEAM_ID}-cf`;
let selectedCustomPlayerId = initialCustomPlayer?.id || "";

function createCareerProfile(player) {
  return {
    level: 1,
    xp: 0,
    trainingPoints: 6,
    fatigue: 0,
    morale: 72,
    boosts: Object.fromEntries(Object.keys(player.ratings).map((key) => [key, 0])),
    unlockedPerks: [],
    stats: createSeasonStats(),
  };
}

function profileFor(playerId) {
  const player = playerDefinitionFor(playerId);
  if (!player) return null;
  if (!careerStore[playerId]) careerStore[playerId] = createCareerProfile(player);
  const profile = careerStore[playerId];
  profile.boosts = { ...createCareerProfile(player).boosts, ...(profile.boosts || {}) };
  profile.stats = {
    ...createSeasonStats(),
    ...(profile.stats || {}),
    batting: { ...createSeasonStats().batting, ...(profile.stats?.batting || {}) },
    pitching: { ...createSeasonStats().pitching, ...(profile.stats?.pitching || {}) },
    fielding: { ...createSeasonStats().fielding, ...(profile.stats?.fielding || {}) },
  };
  return profile;
}

function overallForPlayer(player) {
  const ratings = player.ratings || player;
  const groups = player.position === "P"
    ? [ratings.velocity, ratings.control, ratings.break, ratings.stamina, ratings.clutch]
    : player.position === "C"
      ? [ratings.contact, ratings.power, ratings.fielding, ratings.armStrength, ratings.blocking]
      : [ratings.contact, ratings.power, ratings.speed, ratings.fielding, ratings.reaction];
  return Math.round(groups.reduce((sum, value) => sum + Number(value || 0), 0) / groups.length);
}

function developedPlayer(playerId) {
  const base = playerDefinitionFor(playerId);
  if (!base) return null;
  const profile = profileFor(playerId);
  const ratings = Object.fromEntries(Object.entries(base.ratings).map(([key, value]) => [key, Math.min(key === "popTime" ? 2.3 : 99, Number(value) + Number(profile?.boosts?.[key] || 0))]));
  return {
    ...base,
    ratings,
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    trainingPoints: profile?.trainingPoints || 0,
    fatigue: profile?.fatigue || 0,
    morale: profile?.morale || 72,
    overall: overallForPlayer({ ...base, ratings }),
    stats: profile?.stats || createSeasonStats(),
    contact: ratings.contact,
    power: ratings.power,
    speed: ratings.speed,
    fielding: ratings.fielding,
    arm: ratings.armStrength,
  };
}

function activeCustomPlayerForPosition(teamId, position) {
  const matches = customPlayers.filter((player) => player.active !== false && player.teamId === teamId && player.position === position);
  return matches[matches.length - 1] || null;
}

function rosterForTeam(teamId = state?.teamId || selectedTeamId) {
  const roster = TEAM_BY_ID[teamId]?.roster || [];
  return roster.map((basePlayer) => activeCustomPlayerForPosition(teamId, basePlayer.position) || basePlayer);
}

function activeLineup() {
  const roster = rosterForTeam(state?.teamId || selectedTeamId);
  return (roster.length ? roster : []).map((player) => developedPlayer(player.id));
}

function playerForPosition(position, teamId = state?.teamId || selectedTeamId) {
  const player = rosterForTeam(teamId).find((candidate) => candidate.position === position);
  return player ? developedPlayer(player.id) : null;
}

function npcNameForPosition(position, teamId = state?.teamId || selectedTeamId) {
  return playerForPosition(position, teamId)?.name || `NPC ${positionName(position)}`;
}

function teamFor(id) {
  return TEAM_BY_ID[id] || TEAM_BY_ID[DEFAULT_TEAM_ID];
}

function teamRecord(teamId) {
  return leagueStore[teamId] || { W: 0, L: 0, T: 0, RF: 0, RA: 0 };
}

function calculateBattingLine(stats = {}) {
  const ab = Number(stats.AB || 0);
  const h = Number(stats.H || 0);
  const bb = Number(stats.BB || 0);
  const hbp = Number(stats.HBP || 0);
  const sf = Number(stats.SF || 0);
  const obpDenominator = ab + bb + hbp + sf;
  const totalBases = h + Number(stats.doubles || 0) + Number(stats.triples || 0) * 2 + Number(stats.HR || 0) * 3;
  const average = ab ? h / ab : 0;
  const onBase = obpDenominator ? (h + bb + hbp) / obpDenominator : 0;
  const slugging = ab ? totalBases / ab : 0;
  return { AVG: average, OBP: onBase, SLG: slugging, OPS: onBase + slugging };
}

function calculatePitchingLine(stats = {}) {
  const innings = Number(stats.IP || 0);
  const fipConstant = 3.1;
  return { ERA: innings ? (Number(stats.ER || 0) * 9) / innings : 0, WHIP: innings ? (Number(stats.H || 0) + Number(stats.BB || 0)) / innings : 0, K9: innings ? (Number(stats.SO || 0) * 9) / innings : 0, FIP: innings ? ((Number(stats.HR || 0) * 13) + (3 * (Number(stats.BB || 0) + Number(stats.HBP || 0))) - (2 * Number(stats.SO || 0))) / innings + fipConstant : 0 };
}

function calculateFieldingLine(stats = {}) {
  const chances = Number(stats.PO || 0) + Number(stats.A || 0) + Number(stats.E || 0);
  return { FPCT: chances ? (Number(stats.PO || 0) + Number(stats.A || 0)) / chances : 0, RF9: Number(stats.INN || 0) ? ((Number(stats.PO || 0) + Number(stats.A || 0)) * 9) / Number(stats.INN) : 0 };
}

const TRAINING_META = {
  hitting: { title: "打擊訓練", detail: "CONTACT +1 · VISION +1", cost: 1, xp: 42, gains: { contact: 1, vision: 1 } },
  power: { title: "力量訓練", detail: "POWER +1 · CLUTCH +1", cost: 1, xp: 42, gains: { power: 1, clutch: 1 } },
  defense: { title: "守備訓練", detail: "FIELDING +1 · REACTION +1", cost: 1, xp: 42, gains: { fielding: 1, reaction: 1 } },
  speed: { title: "跑壘訓練", detail: "SPEED +1 · STEALING +1", cost: 1, xp: 38, gains: { speed: 1, stealing: 1 } },
  pitching: { title: "投球訓練", detail: "CONTROL +1 · BREAK +1", cost: 1, xp: 44, gains: { control: 1, break: 1 } },
  recovery: { title: "恢復訓練", detail: "疲勞 -20 · 士氣 +5", cost: 0, xp: 18, gains: {} },
};

function xpToNextLevel(level) {
  return 100 + Math.max(0, level - 1) * 45;
}

function awardCareerXp(profile, amount) {
  profile.xp += amount;
  let levels = 0;
  while (profile.xp >= xpToNextLevel(profile.level)) {
    profile.xp -= xpToNextLevel(profile.level);
    profile.level += 1;
    profile.trainingPoints += 2;
    levels += 1;
  }
  if (levels > 0 && profile.level >= 3 && !profile.unlockedPerks.includes("專注時刻")) profile.unlockedPerks.push("專注時刻");
  if (levels > 0 && profile.level >= 5 && !profile.unlockedPerks.includes("關鍵先生")) profile.unlockedPerks.push("關鍵先生");
  return levels;
}

function replaceMatchTeams(teamId, opponentId, shouldCommit = true) {
  if (!isAuthority() || !TEAM_BY_ID[teamId] || !TEAM_BY_ID[opponentId] || teamId === opponentId) return false;
  const previousSlots = clone(state.slots);
  const previousRevision = state.revision;
  state = createState(teamId, opponentId);
  state.revision = previousRevision;
  POSITION_DEFS.forEach(({ code }) => {
    const previous = previousSlots[code];
    if (!previous || previous.controller !== "human" || !previous.playerId) return;
    Object.assign(state.slots[code], {
      playerId: previous.playerId,
      sessionId: previous.sessionId,
      connectionKey: previous.connectionKey,
      name: previous.name,
      controller: "human",
      connected: previous.connected,
    });
  });
  selectedTeamId = teamId;
  selectedOpponentId = opponentId;
  developmentTeamId = teamId;
  if (!rosterForTeam(developmentTeamId).some((player) => player.id === selectedAthleteId)) selectedAthleteId = rosterForTeam(developmentTeamId)[0]?.id || selectedAthleteId;
  if (shouldCommit) commitState();
  else render();
  return true;
}

function chooseOpponentFor(teamId, preferredId = selectedOpponentId) {
  if (preferredId && preferredId !== teamId && TEAM_BY_ID[preferredId]) return preferredId;
  return TEAM_DEFS.find((team) => team.id !== teamId)?.id || DEFAULT_OPPONENT_ID;
}

function applyTeamSelection(teamId) {
  const opponentId = chooseOpponentFor(teamId, selectedOpponentId);
  if (network.role === "guest" && network.connected) return;
  replaceMatchTeams(teamId, opponentId);
}

function applyOpponentSelection(opponentId) {
  if (!TEAM_BY_ID[opponentId] || opponentId === selectedTeamId || (network.role === "guest" && network.connected)) return;
  replaceMatchTeams(selectedTeamId, opponentId);
}

function trainSelectedPlayer(trainingType) {
  const player = playerDefinitionFor(selectedAthleteId);
  const meta = TRAINING_META[trainingType];
  if (!player || !meta) return;
  const profile = profileFor(player.id);
  if (profile.trainingPoints < meta.cost) {
    network.status = `${player.name} 的訓練點不足；完成比賽或升級可獲得更多訓練點。`;
    renderNetwork();
    return;
  }
  profile.trainingPoints -= meta.cost;
  Object.entries(meta.gains).forEach(([key, amount]) => {
    profile.boosts[key] = Math.min(20, Number(profile.boosts[key] || 0) + amount);
  });
  if (trainingType === "recovery") {
    profile.fatigue = Math.max(0, profile.fatigue - 20);
    profile.morale = Math.min(99, profile.morale + 5);
  } else {
    profile.fatigue = Math.min(100, profile.fatigue + 6);
    profile.morale = Math.max(20, profile.morale - 1);
  }
  const previousLevel = profile.level;
  const levels = awardCareerXp(profile, meta.xp);
  writeStorage(CAREER_STORAGE_KEY, careerStore);
  network.status = `${player.name} 完成${meta.title}：${meta.detail}${levels ? `，升到 Lv.${profile.level}！` : "。"}`;
  if (previousLevel !== profile.level) flashCard("celebrate");
  render();
}

function buildCustomPlayer({ name, number, teamId, position, bats, throws, archetype }) {
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const team = TEAM_BY_ID[teamId] || TEAM_BY_ID[DEFAULT_TEAM_ID];
  const style = CUSTOM_ARCHETYPES[archetype] || CUSTOM_ARCHETYPES.balanced;
  const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
    if (key === "popTime") return [key, value];
    const adjusted = Number(value) + Number(team.bonus[key] || 0) + Number(style.adjustments[key] || 0);
    return [key, Math.max(20, Math.min(96, Math.round(adjusted)))];
  }));
  ratings.contactL = Math.max(20, Math.min(99, ratings.contact + (bats === "左" ? 3 : 0)));
  ratings.contactR = Math.max(20, Math.min(99, ratings.contact + (bats === "右" ? 3 : 0)));
  ratings.powerL = Math.max(20, Math.min(99, ratings.power + (bats === "左" ? 3 : 0)));
  ratings.powerR = Math.max(20, Math.min(99, ratings.power + (bats === "右" ? 3 : 0)));
  const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const potential = archetype === "pitcher" ? 96 : archetype === "balanced" ? 92 : 90;
  return normalizeCustomPlayer({
    id: `custom-${token}`,
    teamId,
    name: cleanName(name),
    position,
    number: String(number || "99").replace(/\D/g, "").slice(0, 2).padStart(2, "0") || "99",
    role: style.role,
    archetype: style.label,
    pitchMix: position === "P" ? ["四縫線速球", "滑球", "變速球", "曲球"] : [],
    bats,
    throws,
    age: 18,
    height: position === "P" ? 181 : 175,
    weight: position === "P" ? 78 : 72,
    potential,
    ratings,
    active: true,
  });
}

function syncMatchAthletes() {
  if (!state?.slots || !state.teamId) return;
  POSITION_DEFS.forEach(({ code }) => {
    const slot = state.slots[code];
    const player = playerForPosition(code, state.teamId);
    if (!slot || !player) return;
    slot.athleteId = player.id;
    if (slot.controller === "npc") slot.name = player.name;
  });
}

function setCustomPlayerStatus(message, tone = "") {
  const status = $("custom-player-status");
  if (!status) return;
  status.textContent = message;
  status.className = `custom-player-status ${tone}`.trim();
}

function persistCustomPlayers() {
  writeStorage(CUSTOM_PLAYERS_STORAGE_KEY, customPlayers);
  writeStorage(CAREER_STORAGE_KEY, careerStore);
}

function useCustomPlayer(playerId) {
  const player = customPlayerIndex[playerId];
  if (!player) return;
  customPlayers.forEach((candidate) => {
    if (candidate.teamId === player.teamId && candidate.position === player.position) candidate.active = candidate.id === player.id;
  });
  refreshCustomPlayerIndex();
  persistCustomPlayers();
  selectedCustomPlayerId = player.id;
  selectedAthleteId = player.id;
  developmentTeamId = player.teamId;
  network.displayName = player.name;
  const nameInput = $("player-name-input");
  if (nameInput) nameInput.value = player.name;
  if (network.role === "guest") {
    if (network.connected) sendToHost({ type: "name", protocol: PROTOCOL_VERSION, name: player.name });
    setCustomPlayerStatus(`${player.name} 已選為你的角色；下一場會使用 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}。`, "is-success");
    render();
    return;
  }
  if (state.phase === "pre" || state.phase === "gameover") {
    if (state.teamId === player.teamId) claimLocalPosition(player.position, false);
    syncMatchAthletes();
    commitState();
    setCustomPlayerStatus(`${player.name} 已套用到 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}，現在可以開始比賽。`, "is-success");
  } else {
    setCustomPlayerStatus(`${player.name} 已選取，下一場比賽開始時會套用到 ${teamFor(player.teamId).name}。`, "is-success");
    render();
  }
}

function createCustomPlayerFromForm(event) {
  event.preventDefault();
  if (customPlayers.length >= MAX_CUSTOM_PLAYERS) {
    setCustomPlayerStatus(`最多建立 ${MAX_CUSTOM_PLAYERS} 名自創球員，請先使用現有角色。`, "is-error");
    return;
  }
  const player = buildCustomPlayer({
    name: $("custom-player-name")?.value,
    number: $("custom-player-number")?.value,
    teamId: $("custom-player-team")?.value || selectedTeamId,
    position: $("custom-player-position")?.value || "CF",
    bats: $("custom-player-bats")?.value || "右",
    throws: $("custom-player-throws")?.value || "右",
    archetype: $("custom-player-archetype")?.value || "balanced",
  });
  customPlayers.forEach((candidate) => {
    if (candidate.teamId === player.teamId && candidate.position === player.position) candidate.active = false;
  });
  customPlayers.push(player);
  refreshCustomPlayerIndex();
  profileFor(player.id);
  selectedCustomPlayerId = player.id;
  selectedAthleteId = player.id;
  developmentTeamId = player.teamId;
  persistCustomPlayers();
  const form = $("custom-player-form");
  if (form) form.reset();
  network.status = `${player.name} 已建立，${teamFor(player.teamId).name} 的 ${positionName(player.position)} 位置現在由他先發。`;
  useCustomPlayer(player.id);
  setCustomPlayerStatus(`${player.name} 建立完成並已套用到你的角色；現在可以開始比賽。`, "is-success");
}

function recordMatchCareer(result) {
  if (state.leagueRecorded) return;
  const homeTeam = teamRecord(state.teamId);
  const awayTeam = teamRecord(state.opponentId);
  homeTeam.RF += state.score.home;
  homeTeam.RA += state.score.away;
  awayTeam.RF += state.score.away;
  awayTeam.RA += state.score.home;
  if (result === "win" || result === "walkoff") { homeTeam.W += 1; awayTeam.L += 1; }
  else if (result === "loss") { homeTeam.L += 1; awayTeam.W += 1; }
  else { homeTeam.T += 1; awayTeam.T += 1; }
  leagueStore[state.teamId] = homeTeam;
  leagueStore[state.opponentId] = awayTeam;
  Object.entries(state.slots).forEach(([position, slot]) => {
    if (!slot.athleteId) return;
    const profile = profileFor(slot.athleteId);
    const season = profile.stats;
    const match = state.playerStats[position] || {};
    if (match.plateAppearances > 0) season.batting.G += 1;
    season.batting.PA += Number(match.plateAppearances || 0);
    season.batting.AB += Number(match.atBats || 0);
    season.batting.R += Number(match.runs || 0);
    season.batting.H += Number(match.hits || 0);
    season.batting.doubles += Number(match.doubles || 0);
    season.batting.triples += Number(match.triples || 0);
    season.batting.HR += Number(match.homeRuns || 0);
    season.batting.RBI += Number(match.runsBattedIn || 0);
    season.batting.BB += Number(match.walks || 0);
    season.batting.SO += Number(match.strikeouts || 0);
    season.batting.SB += Number(match.steals || 0);
    season.batting.CS += Number(match.caughtStealing || 0);
    season.fielding.G += 1;
    season.fielding.GS += 1;
    season.fielding.INN += state.inning >= 9 ? 9 : state.inning;
    season.fielding.PO += Number(match.putouts || 0);
    season.fielding.A += Number(match.assists || 0);
    season.fielding.E += Number(match.errors || 0);
    const isPitcher = position === "P";
    if (isPitcher) {
      season.pitching.G += 1;
      season.pitching.GS += 1;
      if (result === "win" || result === "walkoff") season.pitching.W += 1;
      if (result === "loss") season.pitching.L += 1;
      season.pitching.IP += state.inning >= 9 ? 9 : state.inning;
      season.pitching.ER += state.score.away;
      season.pitching.H += Math.max(0, state.score.away + Number(match.hits || 0));
      season.pitching.BB += Number(match.walks || 0);
      season.pitching.SO += Number(match.strikeouts || 0);
    }
    awardCareerXp(profile, (match.decisions || 0) * 4 + (match.hits || 0) * 8 + (match.putouts || 0) * 3 + 20);
    profile.trainingPoints = Math.min(12, profile.trainingPoints + 1);
    profile.fatigue = Math.min(100, profile.fatigue + 8);
    profile.morale = Math.max(20, Math.min(99, profile.morale + (result === "win" || result === "walkoff" ? 4 : -2)));
  });
  state.leagueRecorded = true;
  writeStorage(LEAGUE_STORAGE_KEY, leagueStore);
  writeStorage(CAREER_STORAGE_KEY, careerStore);
}

function formatRate(value, digits = 3) {
  return Number(value || 0).toFixed(digits).replace(/^0(?=\.)/, "");
}

function renderDevelopment() {
  const panel = $("development-panel");
  if (!panel) return;
  if (network.role === "guest" && state.teamId) selectedTeamId = state.teamId;
  const teamSelect = $("team-select");
  const opponentSelect = $("opponent-select");
  if (teamSelect) {
    teamSelect.innerHTML = TEAM_DEFS.map((team) => `<option value="${team.id}">${team.name} · ${team.style}</option>`).join("");
    teamSelect.value = selectedTeamId;
    teamSelect.disabled = network.role === "guest" && network.connected || !["pre", "gameover"].includes(state.phase);
  }
  if (opponentSelect) {
    opponentSelect.innerHTML = TEAM_DEFS.filter((team) => team.id !== selectedTeamId).map((team) => `<option value="${team.id}">${team.name} · ${team.stadium}</option>`).join("");
    opponentSelect.value = selectedOpponentId === selectedTeamId ? chooseOpponentFor(selectedTeamId) : selectedOpponentId;
    opponentSelect.disabled = teamSelect?.disabled || false;
  }
  const customTeamSelect = $("custom-player-team");
  if (customTeamSelect) {
    const previousTeam = customTeamSelect.value;
    customTeamSelect.innerHTML = TEAM_DEFS.map((team) => `<option value="${team.id}">${team.name}</option>`).join("");
    customTeamSelect.value = TEAM_BY_ID[previousTeam] ? previousTeam : selectedTeamId;
  }
  const customPositionSelect = $("custom-player-position");
  if (customPositionSelect) {
    const previousPosition = customPositionSelect.value;
    customPositionSelect.innerHTML = POSITION_DEFS.map((position) => `<option value="${position.code}">${position.code} · ${position.name}</option>`).join("");
    customPositionSelect.value = POSITION_BY_CODE[previousPosition] ? previousPosition : "CF";
  }
  $("custom-player-count").textContent = `${customPlayers.length} / ${MAX_CUSTOM_PLAYERS} 名自創球員`;
  const customList = $("custom-player-list");
  if (customList) {
    customList.innerHTML = customPlayers.length
      ? customPlayers.slice().reverse().map((basePlayer) => {
        const player = developedPlayer(basePlayer.id);
        const team = teamFor(player.teamId);
        const selected = player.id === selectedCustomPlayerId;
        return `<div class="custom-player-row ${selected ? "is-selected" : ""}"><div class="custom-player-row-main"><b>${escapeHtml(player.name)}</b><small>${team.name} · ${positionName(player.position)} · ${player.archetype} · ${basePlayer.active ? "目前先發" : "替補角色"}</small></div><strong>${player.overall}</strong><button type="button" class="custom-player-use" data-custom-action="use" data-custom-player-id="${escapeHtml(player.id)}">${selected ? "目前使用" : "使用角色"}</button></div>`;
      }).join("")
      : `<p class="custom-player-empty">尚未建立自創球員。先設定姓名、位置與類型，打造你的第一名球員。</p>`;
  }
  const browseTeam = teamFor(developmentTeamId);
  const browseRoster = rosterForTeam(developmentTeamId);
  $("development-team-label").textContent = `${browseTeam.name} · ${browseTeam.city} · ${browseTeam.style}`;
  $("team-tabs").innerHTML = TEAM_DEFS.map((team) => `<button class="team-tab ${team.id === developmentTeamId ? "is-active" : ""}" data-development-team="${team.id}" type="button"><span>${team.shortName}</span><small>${team.city}</small></button>`).join("");
  $("roster-count").textContent = `${LEAGUE_TEAMS.length} 隊 · ${LEAGUE_TEAMS.reduce((sum, team) => sum + team.roster.length, 0)} 名球員 · ${customPlayers.length} 名自創`;
  $("roster-list").innerHTML = browseRoster.map((basePlayer) => {
    const player = developedPlayer(basePlayer.id);
    return `<button class="roster-player ${player.id === selectedAthleteId ? "is-selected" : ""}" data-athlete-id="${player.id}" type="button"><span class="roster-number">${player.number}</span><span class="roster-player-main"><b>${escapeHtml(player.name)}</b><small>${player.position} · ${player.isCustom ? "自創" : player.role}</small></span><strong>${player.overall}</strong></button>`;
  }).join("");
  const selectedInBrowse = browseRoster.some((candidate) => candidate.id === selectedAthleteId);
  const player = selectedInBrowse ? developedPlayer(selectedAthleteId) : developedPlayer(browseRoster[0]?.id);
  if (!player) return;
  selectedAthleteId = player.id;
  const profile = profileFor(player.id);
  const ratings = player.ratings;
  $("player-detail-name").textContent = player.name;
  $("player-detail-position").textContent = `${player.position} · ${player.role}`;
  $("player-detail-meta").textContent = `#${player.number} · ${player.bats}打／${player.throws}投 · ${player.age}歲 · ${player.height}cm / ${player.weight}kg · ${player.archetype}`;
  $("player-overall").textContent = player.overall;
  $("player-progress").textContent = `Lv.${profile.level} · XP ${profile.xp}/${xpToNextLevel(profile.level)} · 訓練點 ${profile.trainingPoints} · 潛力 ${player.potential}`;
  $("player-morale").textContent = `士氣 ${profile.morale} · 疲勞 ${profile.fatigue}`;
  const ratingGroups = [
    ["打擊", [["Contact", ratings.contact], ["vs L Contact", ratings.contactL], ["vs R Contact", ratings.contactR], ["Power", ratings.power], ["vs L Power", ratings.powerL], ["vs R Power", ratings.powerR], ["Vision", ratings.vision], ["Discipline", ratings.discipline], ["Clutch", ratings.clutch], ["Bunt", ratings.bunt]]],
    ["跑壘", [["Speed", ratings.speed], ["Stealing", ratings.stealing]]],
    ["守備", [["Fielding", ratings.fielding], ["Reaction", ratings.reaction], ["Arm Strength", ratings.armStrength], ["Arm Accuracy", ratings.armAccuracy], ["Blocking", ratings.blocking], ["Pop Time", Number(ratings.popTime || 0).toFixed(2)]]],
    ["投球", [["Velocity", ratings.velocity], ["Control", ratings.control], ["Break", ratings.break], ["Stamina", ratings.stamina]]],
  ];
  $("player-attributes").innerHTML = ratingGroups.map(([title, rows]) => `<div class="attribute-group"><h4>${title}</h4>${rows.map(([label, value]) => `<div class="attribute-row"><span>${label}</span><i><b style="width:${label === "Pop Time" ? Math.max(20, 100 - Number(value) * 28) : value}%"></b></i><strong>${value}</strong></div>`).join("")}</div>`).join("");
  Object.entries(TRAINING_META).forEach(([key, meta]) => {
    const button = document.querySelector(`[data-training="${key}"]`);
    if (button) button.disabled = profile.trainingPoints < meta.cost;
  });
  const batting = player.stats.batting;
  const pitching = player.stats.pitching;
  const fielding = player.stats.fielding;
  const battingRates = calculateBattingLine(batting);
  const pitchingRates = calculatePitchingLine(pitching);
  const fieldingRates = calculateFieldingLine(fielding);
  const pitchMix = player.pitchMix?.length ? `<div class="pitch-mix"><b>球種</b> ${player.pitchMix.map((pitch) => `<span>${pitch}</span>`).join("")}</div>` : "";
  $("player-statline").innerHTML = `${pitchMix}
    <div class="statline-section"><h4>打擊生涯／賽季</h4><div class="statline-grid"><span>G <b>${batting.G}</b></span><span>PA <b>${batting.PA}</b></span><span>AB <b>${batting.AB}</b></span><span>R <b>${batting.R}</b></span><span>H <b>${batting.H}</b></span><span>2B <b>${batting.doubles}</b></span><span>3B <b>${batting.triples}</b></span><span>HR <b>${batting.HR}</b></span><span>RBI <b>${batting.RBI}</b></span><span>BB <b>${batting.BB}</b></span><span>SO <b>${batting.SO}</b></span><span>SB <b>${batting.SB}</b></span><span>CS <b>${batting.CS}</b></span><span>HBP <b>${batting.HBP}</b></span><span>SF <b>${batting.SF}</b></span><span>AVG <b>${formatRate(battingRates.AVG)}</b></span><span>OBP <b>${formatRate(battingRates.OBP)}</b></span><span>SLG <b>${formatRate(battingRates.SLG)}</b></span><span>OPS <b>${formatRate(battingRates.OPS)}</b></span></div></div>
    <div class="statline-section"><h4>投球</h4><div class="statline-grid"><span>G <b>${pitching.G}</b></span><span>GS <b>${pitching.GS}</b></span><span>W <b>${pitching.W}</b></span><span>L <b>${pitching.L}</b></span><span>SV <b>${pitching.SV}</b></span><span>IP <b>${pitching.IP}</b></span><span>H <b>${pitching.H}</b></span><span>ER <b>${pitching.ER}</b></span><span>HR <b>${pitching.HR}</b></span><span>BB <b>${pitching.BB}</b></span><span>K <b>${pitching.SO}</b></span><span>HBP <b>${pitching.HBP}</b></span><span>WP <b>${pitching.WP}</b></span><span>ERA <b>${pitchingRates.ERA.toFixed(2)}</b></span><span>FIP <b>${pitchingRates.FIP.toFixed(2)}</b></span><span>WHIP <b>${pitchingRates.WHIP.toFixed(2)}</b></span><span>K/9 <b>${pitchingRates.K9.toFixed(1)}</b></span></div></div>
    <div class="statline-section"><h4>守備</h4><div class="statline-grid"><span>G <b>${fielding.G}</b></span><span>GS <b>${fielding.GS}</b></span><span>INN <b>${fielding.INN}</b></span><span>PO <b>${fielding.PO}</b></span><span>A <b>${fielding.A}</b></span><span>E <b>${fielding.E}</b></span><span>DP <b>${fielding.DP}</b></span><span>PB <b>${fielding.PB}</b></span><span>SB <b>${fielding.SB}</b></span><span>CS <b>${fielding.CS}</b></span><span>FPCT <b>${fieldingRates.FPCT.toFixed(3)}</b></span><span>RF/9 <b>${fieldingRates.RF9.toFixed(2)}</b></span></div></div>`;
  const standings = LEAGUE_TEAMS.map((team) => {
    const record = teamRecord(team.id);
    const games = record.W + record.L + record.T;
    return { team, record, pct: games ? (record.W + record.T * 0.5) / games : 0, diff: record.RF - record.RA };
  }).sort((left, right) => right.pct - left.pct || right.diff - left.diff || right.record.W - left.record.W);
  $("league-standings").innerHTML = standings.map((row, index) => `<div class="standing-row"><b>${index + 1}</b><span class="standing-team"><i style="background:${row.team.color}"></i>${row.team.name}</span><span>${row.record.W}-${row.record.L}-${row.record.T}</span><span>${formatRate(row.pct, 3)}</span><span>${row.diff >= 0 ? "+" : ""}${row.diff}</span></div>`).join("");
}

const lineup = [
  { position: "CF", number: "07", name: "林昱辰", contact: 82, power: 67 },
  { position: "RF", number: "23", name: "陳柏翰", contact: 74, power: 86 },
  { position: "3B", number: "31", name: "王子謙", contact: 79, power: 77 },
  { position: "1B", number: "44", name: "吳承恩", contact: 76, power: 92 },
  { position: "LF", number: "12", name: "張偉倫", contact: 76, power: 81 },
  { position: "2B", number: "08", name: "李明哲", contact: 70, power: 64 },
  { position: "SS", number: "19", name: "蔡瑞峰", contact: 70, power: 72 },
  { position: "C", number: "02", name: "高宇翔", contact: 73, power: 58 },
  { position: "P", number: "55", name: "周凱翔", contact: 61, power: 56 },
];

const ACTION_META = {
  power: { icon: "↗", title: "全力揮擊", detail: "長打機會高，三振風險也高", key: "1" },
  contact: { icon: "●", title: "推打找空檔", detail: "穩定擊球，串聯攻勢", key: "2" },
  patient: { icon: "◌", title: "耐心選球", detail: "看清楚球路，等待保送", key: "3" },
  bunt: { icon: "⌁", title: "短打戰術", detail: "推進跑者，代價是出局數", key: "4" },
  steal: { icon: "»", title: "發動盜壘", detail: "抓時機，搶下一個壘包", key: "5" },
};

const DEFENSE_ACTION_META = {
  "defense-fast": { icon: "⚡", title: "強攻配球", detail: "壓低球數，三振與長打風險都提高", key: "1" },
  "defense-break": { icon: "⌁", title: "變化球引誘", detail: "製造滾地球，失投時可能被打穿", key: "2" },
  "defense-control": { icon: "●", title: "穩定控球", detail: "降低大局風險，但可能讓打者上壘", key: "3" },
  "defense-pickoff": { icon: "↩", title: "牽制跑者", detail: "打亂對手節奏，成功可直接抓出局", key: "4" },
  "defense-intentional": { icon: "◌", title: "敬遠中心打者", detail: "避開長打，代價是增加壘上壓力", key: "5" },
};

const FIELDING_ACTION_META = {
  "fielding-catch": { icon: "✦", title: "穩穩接殺", detail: "用基本功處理來球，失誤風險最低", key: "1" },
  "fielding-dive": { icon: "⌁", title: "飛身撲球", detail: "拚出額外出局機會，失敗可能多掉一分", key: "2" },
  "fielding-hold": { icon: "●", title: "守住落點", detail: "先控制球，再讓隊友完成補位", key: "3" },
  "fielding-relay": { icon: "↪", title: "快速接力", detail: "依肩力與判斷縮短跑者推進距離", key: "4" },
  "fielding-throw": { icon: "↗", title: "冒險長傳", detail: "有機會製造關鍵出局，也可能暴投", key: "5" },
};

const SIGNAL_META = {
  steady: "穩一點",
  runner: "注意跑者",
  cover: "我來補位",
  npc: "先交給 NPC",
};

const network = {
  role: "solo",
  peer: null,
  hostConnection: null,
  connections: new Map(),
  connected: false,
  roomCode: "",
  hostId: "",
  status: "單機模式：你可以選一個位置，其餘由 NPC 補位。",
  localPlayerId: "local",
  assignedPosition: "CF",
  displayName: "主場球員",
  sessionId: readPersistentSessionId(),
  awaiting: false,
  lastRevision: -1,
  nextPlayerNumber: 1,
  npcTimer: null,
  actionTimer: null,
  countdownTimer: null,
  signalTimer: null,
  hostSeenAt: 0,
  heartbeatTimer: null,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));
const hasRunners = () => Object.values(state.bases).some(Boolean);
const currentBatter = () => {
  const rosterLineup = activeLineup();
  return rosterLineup[state.batterIndex % Math.max(1, rosterLineup.length)] || lineup[state.batterIndex % lineup.length];
};
const currentBatterSlot = () => state.slots[currentBatter().position];
const positionName = (position) => POSITION_BY_CODE[position]?.name || position;
const positionShort = (position) => POSITION_BY_CODE[position]?.short || position;
const cleanName = (value) => String(value || "玩家").replace(/[<>]/g, "").trim().slice(0, 14) || "玩家";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

function randomSeed() {
  if (window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] || 0x13579bdf;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function nextRandom() {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function createPlayerStats() {
  return Object.fromEntries(POSITION_DEFS.map(({ code }) => [code, {
    plateAppearances: 0,
    atBats: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    runsBattedIn: 0,
    walks: 0,
    strikeouts: 0,
    runs: 0,
    steals: 0,
    caughtStealing: 0,
    fieldingChances: 0,
    putouts: 0,
    assists: 0,
    errors: 0,
    decisions: 0,
    timeouts: 0,
  }]));
}

function createSlot(definition, teamId = DEFAULT_TEAM_ID) {
  const athlete = playerForPosition(definition.code, teamId) || { id: "", name: `NPC ${definition.name}` };
  return {
    position: definition.code,
    athleteId: athlete.id,
    playerId: null,
    sessionId: null,
    connectionKey: null,
    name: athlete.name,
    controller: "npc",
    connected: true,
  };
}

function createSlots(teamId = DEFAULT_TEAM_ID) {
  return Object.fromEntries(POSITION_DEFS.map((definition) => [definition.code, createSlot(definition, teamId)]));
}

function createState(teamId = selectedTeamId, opponentId = selectedOpponentId) {
  return {
    version: PROTOCOL_VERSION,
    teamId,
    opponentId,
    phase: "pre",
    inning: 1,
    half: "top",
    defenseOwner: "P",
    defenseMode: "strategy",
    defenseAction: "",
    outs: 0,
    balls: 0,
    strikes: 0,
    score: { away: 0, home: 0 },
    innings: [],
    bases: { first: null, second: null, third: null },
    batterIndex: 0,
    currentHalfRuns: 0,
    hits: 0,
    steals: 0,
    decisions: 0,
    momentum: 50,
    teamChemistry: 50,
    eventToken: 0,
    actionDeadline: 0,
    timeouts: 0,
    pendingAwayRuns: 0,
    log: [],
    slots: createSlots(teamId),
    playerStats: createPlayerStats(),
    result: "",
    leagueRecorded: false,
    revision: 0,
    rngState: randomSeed() | 0,
    actionLock: false,
  };
}

let state = createState();

function ensureInning() {
  if (!state.innings[state.inning - 1]) state.innings[state.inning - 1] = { away: null, home: null };
  return state.innings[state.inning - 1];
}

function slotForPlayer(playerId) {
  return Object.values(state.slots).find((slot) => slot.playerId === playerId) || null;
}

function publicState() {
  const snapshot = clone(state);
  Object.values(snapshot.slots).forEach((slot) => {
    slot.connectionKey = null;
    slot.sessionId = null;
  });
  delete snapshot.rngState;
  snapshot.actionLock = false;
  return snapshot;
}

function normalizeState(snapshot) {
  const normalizedTeamId = TEAM_BY_ID[snapshot.teamId] ? snapshot.teamId : DEFAULT_TEAM_ID;
  const normalizedOpponentId = TEAM_BY_ID[snapshot.opponentId] && snapshot.opponentId !== normalizedTeamId ? snapshot.opponentId : DEFAULT_OPPONENT_ID;
  const base = createState(normalizedTeamId, normalizedOpponentId);
  selectedTeamId = normalizedTeamId;
  selectedOpponentId = normalizedOpponentId;
  const normalized = {
    ...base,
    ...snapshot,
    score: { ...base.score, ...(snapshot.score || {}) },
    bases: { ...base.bases, ...(snapshot.bases || {}) },
    innings: Array.isArray(snapshot.innings) ? snapshot.innings : [],
    log: Array.isArray(snapshot.log) ? snapshot.log : [],
    playerStats: Object.fromEntries(POSITION_DEFS.map(({ code }) => [code, {
      ...base.playerStats[code],
      ...(snapshot.playerStats?.[code] || {}),
    }])),
    slots: createSlots(normalizedTeamId),
    actionLock: false,
  };
  POSITION_DEFS.forEach(({ code }) => {
    const incoming = snapshot.slots?.[code];
    if (incoming) normalized.slots[code] = { ...normalized.slots[code], ...incoming, connectionKey: null, sessionId: null };
  });
  return normalized;
}

function peerAvailable() {
  return typeof window.Peer === "function";
}

function isAuthority() {
  return network.role === "solo" || network.role === "host";
}

function isGuest() {
  return network.role === "guest";
}

function setStatus(message) {
  network.status = message;
  renderNetwork();
  renderLobby();
}

function renderTeamSignals() {
  document.querySelectorAll("[data-signal]").forEach((button) => {
    button.disabled = network.role === "guest" && !network.connected;
  });
}

function showTeamSignal(name, signal) {
  const label = SIGNAL_META[signal];
  if (!label) return;
  const status = $("team-signal-status");
  if (!status) return;
  status.textContent = `${cleanName(name || network.displayName)}：${label}`;
  window.clearTimeout(network.signalTimer);
  network.signalTimer = window.setTimeout(() => {
    status.textContent = "用短訊息提醒隊友，不會打斷目前事件。";
  }, 3600);
}

function broadcastTeamSignal(name, signal) {
  if (!SIGNAL_META[signal]) return;
  showTeamSignal(name, signal);
  if (network.role !== "host") return;
  const packet = { type: "signal", protocol: PROTOCOL_VERSION, name: cleanName(name), signal };
  network.connections.forEach((record) => sendConnection(record.connection, packet));
}

function sendTeamSignal(signal) {
  if (!SIGNAL_META[signal]) return;
  if (network.role === "guest") {
    if (!network.connected) {
      setStatus("尚未連上房主，暫時不能發送團隊訊息。");
      return;
    }
    showTeamSignal(network.displayName, signal);
    sendToHost({ type: "signal", protocol: PROTOCOL_VERSION, signal });
    return;
  }
  broadcastTeamSignal(network.displayName, signal);
}

function sendConnection(connection, message) {
  if (!connection || !connection.open) return false;
  try {
    connection.send(message);
    return true;
  } catch {
    return false;
  }
}

function sendToHost(message) {
  return sendConnection(network.hostConnection, message);
}

function sendSnapshotTo(connection) {
  sendConnection(connection, { type: "snapshot", protocol: PROTOCOL_VERSION, state: publicState() });
}

function isDecisionPhase() {
  return state.phase === "defense" || state.phase === "home";
}

function clearActionDeadline() {
  window.clearTimeout(network.actionTimer);
  network.actionTimer = null;
  state.actionDeadline = 0;
  state.eventToken = (state.eventToken || 0) + 1;
}

function chooseTimeoutAction() {
  if (state.phase === "defense") return state.defenseMode === "fielding" ? "fielding-hold" : "defense-control";
  if (state.strikes === 2) return "contact";
  return state.balls >= 2 ? "patient" : "contact";
}

function scheduleActionTimeout() {
  window.clearTimeout(network.actionTimer);
  network.actionTimer = null;
  if (!isAuthority() || !isDecisionPhase() || !state.actionDeadline) return;
  const token = state.eventToken;
  const delay = Math.max(100, state.actionDeadline - Date.now() + 80);
  network.actionTimer = window.setTimeout(() => {
    network.actionTimer = null;
    if (!isDecisionPhase() || state.eventToken !== token) return;
    if (Date.now() < state.actionDeadline || state.actionLock) {
      scheduleActionTimeout();
      return;
    }
    const slot = activeEventSlot();
    if (!slot || slot.controller !== "human") return;
    const action = chooseTimeoutAction();
    const fallbackName = state.phase === "defense" ? state.defenseMode === "fielding" ? "守住落點" : "穩定控球" : "安全推打";
    addLog(`${positionName(slot.position)} 玩家逾時，NPC 接手採用${fallbackName}。`, "danger");
    performActionForPlayer(null, action, true, "timeout");
  }, delay);
}

function armActionDeadline() {
  if (!isAuthority() || !isDecisionPhase()) {
    clearActionDeadline();
    return;
  }
  state.eventToken = (state.eventToken || 0) + 1;
  const timeoutKey = state.phase === "defense" && state.defenseMode === "fielding" ? "fielding" : state.phase;
  state.actionDeadline = Date.now() + ACTION_TIMEOUT_MS[timeoutKey];
  scheduleActionTimeout();
}

function broadcastState() {
  if (network.role !== "host") return;
  const message = { type: "snapshot", protocol: PROTOCOL_VERSION, state: publicState() };
  const deliver = () => network.connections.forEach((record) => sendConnection(record.connection, message));
  deliver();
  // A newly-opened WebRTC data channel can report `open` one tick before its
  // transport is ready. A small idempotent resend prevents a state transition
  // from being lost without creating a continuous sync loop.
  window.setTimeout(deliver, 120);
}

function commitState() {
  if (!isAuthority()) return;
  state.revision += 1;
  broadcastState();
  render();
}

function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  const incomingRevision = Number(snapshot.revision ?? -1);
  if (incomingRevision < network.lastRevision) return;
  state = normalizeState(snapshot);
  network.lastRevision = incomingRevision;
  network.awaiting = false;
  if (network.role === "guest") network.status = "已同步：輪到你的打席時，按下你的決策。";
  render();
}

function renderNetwork() {
  const badge = $("connection-badge");
  if (!badge) return;
  let label = "單機 + NPC";
  let tone = "";
  if (network.role === "host") {
    const guests = [...network.connections.values()].filter((record) => record.joined).length;
    label = network.connected ? `房主 · ${guests + 1}/${MAX_PLAYERS}` : "建立房間中";
    tone = network.connected ? "is-host" : "";
  } else if (network.role === "guest") {
    label = network.connected ? `已連線 · ${positionShort(network.assignedPosition)}` : "連線中";
    tone = network.connected ? "is-ready" : "";
  }
  if (network.status.includes("失敗") || network.status.includes("錯誤")) tone = "is-error";
  badge.className = `network-badge ${tone}`;
  badge.innerHTML = `<i></i> ${escapeHtml(label)}`;
  $("connection-status").textContent = network.status;
  $("room-code-panel").hidden = network.role !== "host" || !network.roomCode;
  $("room-code-value").textContent = network.roomCode || "------";
  $("create-room").disabled = network.role === "host" && Boolean(network.peer?.open);
  $("join-room").disabled = network.role === "guest" && network.connected;
  const reconnectButton = $("reconnect-room");
  if (reconnectButton) reconnectButton.hidden = !(network.role === "guest" && !network.connected && Boolean(network.roomCode));
  renderTeamSignals();
}

function startHeartbeat() {
  window.clearInterval(network.heartbeatTimer);
  network.heartbeatTimer = window.setInterval(() => {
    const now = Date.now();
    if (network.role === "host") {
      network.connections.forEach((record) => {
        if (!record.joined) return;
        if (now - record.lastSeen > 12000) {
          try { record.connection.close(); } catch {}
          return;
        }
        sendConnection(record.connection, { type: "ping", at: now });
      });
    } else if (network.role === "guest" && network.hostConnection) {
      if (now - network.hostSeenAt > 20000) {
        network.connected = false;
        network.status = "房主暫時沒有回應，正在等待重新連線。";
        renderNetwork();
      }
      sendToHost({ type: "ping", at: now });
    }
  }, 4000);
}

function disconnectNetwork() {
  window.clearInterval(network.heartbeatTimer);
  window.clearTimeout(network.npcTimer);
  window.clearTimeout(network.actionTimer);
  window.clearTimeout(network.signalTimer);
  network.npcTimer = null;
  network.actionTimer = null;
  network.connections.forEach((record) => { try { record.connection.close(); } catch {} });
  network.connections.clear();
  try { network.hostConnection?.close(); } catch {}
  try { network.peer?.destroy(); } catch {}
  network.role = "solo";
  network.peer = null;
  network.hostConnection = null;
  network.connected = false;
  network.roomCode = "";
  network.hostId = "";
  network.localPlayerId = "local";
  network.assignedPosition = "CF";
  network.awaiting = false;
  network.lastRevision = -1;
  network.hostSeenAt = 0;
  network.status = "單機模式：你可以選一個位置，其餘由 NPC 補位。";
  const signalStatus = $("team-signal-status");
  if (signalStatus) signalStatus.textContent = "用短訊息提醒隊友，不會打斷目前事件。";
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function prepareFreshState() {
  const previousSlots = clone(state.slots);
  state = createState(state.teamId, state.opponentId);
  POSITION_DEFS.forEach(({ code }) => {
    const previous = previousSlots[code];
    if (!previous) return;
    state.slots[code] = {
      ...state.slots[code],
      playerId: previous.playerId,
      sessionId: previous.sessionId,
      connectionKey: previous.connectionKey,
      name: previous.controller === "human" ? previous.name : npcNameForPosition(code, state.teamId),
      controller: previous.controller === "human" ? "human" : "npc",
      connected: previous.controller === "human" ? previous.connected : true,
    };
  });
}

function claimLocalPosition(position, shouldCommit = true) {
  if (!POSITION_BY_CODE[position] || !isAuthority()) return false;
  const target = state.slots[position];
  if (target.controller === "human" && target.playerId !== network.localPlayerId) {
    setStatus(`${positionName(position)} 已由其他玩家選擇。`);
    return false;
  }
  const previous = slotForPlayer(network.localPlayerId);
  if (previous && previous.position !== position) {
    previous.controller = "npc";
    previous.playerId = null;
    previous.sessionId = null;
    previous.connectionKey = null;
    previous.name = npcNameForPosition(previous.position);
    previous.connected = true;
  }
  target.controller = "human";
  target.playerId = network.localPlayerId;
  target.sessionId = network.sessionId;
  target.connectionKey = network.role === "host" ? "host-local" : null;
  target.name = network.displayName;
  target.connected = true;
  network.assignedPosition = position;
  if (shouldCommit) commitState();
  else render();
  return true;
}

function releaseLocalPosition(shouldCommit = true) {
  if (!isAuthority()) return;
  const slot = slotForPlayer(network.localPlayerId);
  if (!slot) return;
  slot.controller = "npc";
  slot.playerId = null;
  slot.sessionId = null;
  slot.connectionKey = null;
  slot.name = npcNameForPosition(slot.position);
  slot.connected = true;
  network.assignedPosition = "";
  if (shouldCommit) commitState();
  else render();
}

function updateLocalName(name, shouldCommit = true) {
  network.displayName = cleanName(name);
  const slot = slotForPlayer(network.localPlayerId);
  if (slot) {
    slot.name = network.displayName;
    if (shouldCommit) commitState();
    else render();
  }
}

function chooseNPCPosition(requested) {
  if (POSITION_BY_CODE[requested] && state.slots[requested].controller === "npc") return requested;
  return POSITION_DEFS.find(({ code }) => state.slots[code].controller === "npc")?.code || "";
}

function hostHandleJoin(record, message) {
  if (message.protocol !== PROTOCOL_VERSION) {
    sendConnection(record.connection, { type: "error", message: "遊戲版本不同，請重新整理頁面。" });
    return;
  }
  const sessionId = String(message.sessionId || "").slice(0, 80);
  if (!sessionId) {
    sendConnection(record.connection, { type: "error", message: "缺少玩家連線識別，請重新加入。" });
    return;
  }
  let slot = Object.values(state.slots).find((candidate) => candidate.sessionId === sessionId);
  let playerId = slot?.playerId || `player-${network.nextPlayerNumber++}`;
  if (!slot) {
    const position = chooseNPCPosition(message.requestedPosition);
    if (!position) {
      sendConnection(record.connection, { type: "error", message: "房間的九個位置都已有人，請等待下一場。" });
      return;
    }
    slot = state.slots[position];
  }
  network.connections.forEach((oldRecord) => {
    if (oldRecord !== record && oldRecord.playerId === playerId) {
      oldRecord.removed = true;
      try { oldRecord.connection.close(); } catch {}
    }
  });
  record.joined = true;
  record.playerId = playerId;
  record.sessionId = sessionId;
  record.position = slot.position;
  record.name = cleanName(message.name || `球員 ${playerId}`);
  record.lastSeen = Date.now();
  slot.playerId = playerId;
  slot.sessionId = sessionId;
  slot.connectionKey = record.key;
  slot.controller = "human";
  slot.connected = true;
  slot.name = record.name;
  sendConnection(record.connection, {
    type: "welcome",
    protocol: PROTOCOL_VERSION,
    playerId,
    position: slot.position,
    state: publicState(),
  });
  network.status = `${slot.name} 加入 ${positionName(slot.position)}，目前 ${humanPlayerCount()}/${MAX_PLAYERS} 名真人。`;
  commitState();
}

function attachHostConnection(connection) {
  const key = `${connection.peer}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = { key, connection, joined: false, playerId: null, sessionId: null, position: "", lastSeen: Date.now(), lastSignalAt: 0, removed: false };
  network.connections.set(key, record);
  const remove = () => {
    if (record.removed) return;
    record.removed = true;
    network.connections.delete(key);
    if (record.playerId) {
      const slot = state.slots[record.position];
      if (slot?.connectionKey === key && slot.playerId === record.playerId) {
        slot.controller = "npc";
        slot.playerId = null;
        slot.connectionKey = null;
        slot.name = npcNameForPosition(slot.position);
        slot.connected = true;
        if (state.phase !== "pre" && state.phase !== "gameover") addLog(`${positionName(slot.position)} 玩家離線，NPC 暫時接手。`, "danger");
        network.status = `${positionName(slot.position)} 已離線，NPC 補位中。`;
        commitState();
      }
    }
    renderNetwork();
  };
  connection.on("open", () => sendConnection(connection, { type: "hello", protocol: PROTOCOL_VERSION }));
  connection.on("data", (message) => {
    record.lastSeen = Date.now();
    if (!message || typeof message !== "object") return;
    if (message.type === "join") hostHandleJoin(record, message);
    else if (message.type === "ping") sendConnection(connection, { type: "pong", at: Date.now() });
    else if (!record.joined) return;
    else if (message.type === "claim") hostClaimPlayerPosition(record, message.position);
    else if (message.type === "release") hostReleasePlayerPosition(record);
    else if (message.type === "name") hostUpdatePlayerName(record, message.name);
    else if (message.type === "signal") hostHandleSignal(record, message.signal);
    else if (message.type === "start") requestStartFromPlayer(record);
    else if (message.type === "reset") sendConnection(connection, { type: "status", message: "只有房主可以重新開打。", awaiting: false });
    else if (message.type === "action") hostHandleAction(record, message);
  });
  connection.on("close", remove);
  connection.on("error", remove);
}

function hostClaimPlayerPosition(record, position) {
  if (!POSITION_BY_CODE[position]) return;
  if (!(state.phase === "pre" || state.phase === "gameover" || (state.phase === "home" && state.balls === 0 && state.strikes === 0))) {
    sendConnection(record.connection, { type: "status", message: "下一個安全事件才能換守備位置。" });
    return;
  }
  const target = state.slots[position];
  if (target.controller === "human" && target.playerId !== record.playerId) {
    sendConnection(record.connection, { type: "status", message: `${positionName(position)} 已被其他玩家控制。` });
    return;
  }
  const previous = slotForPlayer(record.playerId);
  if (previous && previous.position !== position) {
    previous.controller = "npc";
    previous.playerId = null;
    previous.connectionKey = null;
    previous.name = npcNameForPosition(previous.position);
    previous.connected = true;
  }
  target.controller = "human";
  target.playerId = record.playerId;
  target.sessionId = record.sessionId;
  target.connectionKey = record.key;
  target.connected = true;
  target.name = record.name || target.name;
  record.position = position;
  sendConnection(record.connection, { type: "position", position });
  network.status = `${target.name} 已轉到 ${positionName(position)}。`;
  commitState();
}

function hostReleasePlayerPosition(record) {
  const slot = slotForPlayer(record.playerId);
  if (!slot) return;
  slot.controller = "npc";
  slot.playerId = null;
  slot.connectionKey = null;
  slot.name = npcNameForPosition(slot.position);
  slot.connected = true;
  record.position = "";
  sendConnection(record.connection, { type: "position", position: "" });
  commitState();
}

function hostUpdatePlayerName(record, name) {
  const slot = slotForPlayer(record.playerId);
  if (!slot) return;
  record.name = cleanName(name);
  slot.name = record.name;
  commitState();
}

function hostHandleSignal(record, signal) {
  if (!record.joined || !SIGNAL_META[signal]) return;
  const now = Date.now();
  if (now - (record.lastSignalAt || 0) < 900) return;
  record.lastSignalAt = now;
  broadcastTeamSignal(record.name || `球員 ${record.playerId}`, signal);
}

function requestStartFromPlayer(record) {
  if (!record.playerId) return;
  startGame();
}

function hostHandleAction(record, message) {
  if (message.protocol !== PROTOCOL_VERSION || Number(message.revision) !== state.revision) {
    sendSnapshotTo(record.connection);
    sendConnection(record.connection, { type: "status", message: "這一步已經更新，已重新同步最新狀態。" });
    return;
  }
  const accepted = performActionForPlayer(record.playerId, message.action);
  if (!accepted) {
    sendSnapshotTo(record.connection);
    sendConnection(record.connection, { type: "status", message: "這個位置目前不能執行此操作。", awaiting: false });
  }
}

function attachGuestConnection(connection) {
  network.hostConnection = connection;
  let joinSent = false;
  const sendJoin = () => {
    if (joinSent || !connection.open) return;
    joinSent = true;
    sendConnection(connection, {
      type: "join",
      protocol: PROTOCOL_VERSION,
      sessionId: network.sessionId,
      name: network.displayName,
      requestedPosition: network.assignedPosition,
    });
  };
  connection.on("open", () => {
    network.connected = true;
    network.hostSeenAt = Date.now();
    sendJoin();
    network.status = "已連上房主，正在取得位置與比賽狀態。";
    renderNetwork();
  });
  connection.on("data", (message) => {
    network.hostSeenAt = Date.now();
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      sendJoin();
    } else if (message.type === "welcome") {
      network.localPlayerId = message.playerId;
      network.assignedPosition = message.position || "";
      network.connected = true;
      applySnapshot(message.state);
    } else if (message.type === "snapshot") {
      if (message.protocol === PROTOCOL_VERSION) applySnapshot(message.state);
    } else if (message.type === "position") {
      network.assignedPosition = message.position || "";
      network.awaiting = false;
      render();
    } else if (message.type === "signal") {
      showTeamSignal(message.name, message.signal);
    } else if (message.type === "status") {
      if (message.awaiting === false) network.awaiting = false;
      network.status = message.message || network.status;
      render();
    } else if (message.type === "ping") {
      sendConnection(connection, { type: "pong", at: Date.now() });
    } else if (message.type === "pong") {
      network.hostSeenAt = Date.now();
    } else if (message.type === "error") {
      network.status = message.message || "房間連線失敗。";
      network.connected = false;
      renderNetwork();
    }
  });
  const close = () => {
    if (network.hostConnection !== connection) return;
    network.connected = false;
    network.awaiting = false;
    network.status = "與房主的連線已中斷；可以重新加入房間。";
    renderNetwork();
    render();
  };
  connection.on("close", close);
  connection.on("error", close);
}

function createHostPeer(attempt = 0) {
  try {
    network.peer = new window.Peer(`jiuju-${network.roomCode}`, { debug: 0 });
    network.peer.on("open", () => {
      network.connected = true;
      network.status = `房間已建立，${humanPlayerCount()}/${MAX_PLAYERS} 名真人；把代碼交給隊友。`;
      startHeartbeat();
      renderNetwork();
      renderLobby();
    });
    network.peer.on("connection", attachHostConnection);
    network.peer.on("disconnected", () => {
      network.status = "房間訊號暫時中斷，正在嘗試恢復。";
      try { network.peer.reconnect(); } catch {}
      renderNetwork();
    });
    network.peer.on("error", () => {
      if (attempt < 2) {
        try { network.peer.destroy(); } catch {}
        network.roomCode = makeRoomCode();
        createHostPeer(attempt + 1);
      } else {
        network.status = "房間建立失敗，請再按一次建立房間。";
        network.connected = false;
        renderNetwork();
      }
    });
  } catch {
    network.status = "目前無法建立房間，單機模式仍可使用。";
    network.role = "solo";
    network.roomCode = "";
    renderNetwork();
  }
}

function createRoom() {
  if (!peerAvailable()) {
    setStatus("目前瀏覽器無法載入免費聯線模組，單機模式仍可使用。");
    return;
  }
  disconnectNetwork();
  network.role = "host";
  network.localPlayerId = "host";
  network.sessionId = `host-${Date.now()}`;
  network.displayName = cleanName($("player-name-input")?.value || network.displayName);
  state = createState(selectedTeamId, selectedOpponentId);
  claimLocalPosition("CF", false);
  network.roomCode = makeRoomCode();
  network.status = "正在建立房間，請稍候……";
  render();
  createHostPeer();
}

function joinRoom() {
  if (!peerAvailable()) {
    setStatus("目前瀏覽器無法載入免費聯線模組，單機模式仍可使用。");
    return;
  }
  const code = $("room-code-input").value.replace(/\D/g, "").slice(0, 6);
  $("room-code-input").value = code;
  if (code.length !== 6) {
    setStatus("請輸入 6 位數房間代碼。");
    return;
  }
  disconnectNetwork();
  network.role = "guest";
  network.roomCode = code;
  network.hostId = `jiuju-${code}`;
  network.displayName = cleanName($("player-name-input")?.value || network.displayName);
  network.status = "正在尋找房主……";
  state = createState(selectedTeamId, selectedOpponentId);
  render();
  try {
    network.peer = new window.Peer(undefined, { debug: 0 });
    network.peer.on("open", () => {
      const connection = network.peer.connect(network.hostId, { reliable: true, serialization: "json" });
      attachGuestConnection(connection);
      startHeartbeat();
    });
    network.peer.on("disconnected", () => {
      network.status = "聯線訊號暫時中斷，正在嘗試恢復。";
      try { network.peer.reconnect(); } catch {}
      renderNetwork();
    });
    network.peer.on("error", () => {
      network.connected = false;
      network.status = "找不到這個房間，請確認代碼或請房主重新建立。";
      renderNetwork();
    });
  } catch {
    network.status = "目前無法加入房間，請重新整理頁面後再試。";
    network.role = "solo";
    renderNetwork();
  }
}

function reconnectRoom() {
  if (network.role !== "guest" || !network.roomCode) return;
  $("room-code-input").value = network.roomCode;
  network.status = "正在重新連線，嘗試取回原本位置……";
  renderNetwork();
  joinRoom();
}

function requestStart() {
  if (network.role === "guest") {
    if (!network.connected) return;
    network.status = "已通知房主開始比賽；NPC 會補足其他位置。";
    sendToHost({ type: "start", protocol: PROTOCOL_VERSION });
    renderNetwork();
    return;
  }
  startGame();
}

function requestReset() {
  if (network.role === "guest") {
    network.status = network.connected ? "只有房主可以重新開打，請由房主按下重新開打。" : "目前尚未連上房主，無法重新開打。";
    renderNetwork();
    return;
  }
  resetGame();
}

function humanPlayerCount() {
  return Object.values(state.slots).filter((slot) => slot.controller === "human" && slot.playerId).length;
}

function addLog(message, tone = "") {
  state.log.push({ message: String(message), tone });
  if (state.log.length > MAX_LOG) state.log.shift();
}

function setMomentum(delta) {
  state.momentum = clamp(state.momentum + delta, 8, 96);
  state.teamChemistry = clamp(state.teamChemistry + Math.round(delta * 0.35), 8, 96);
}

function resetBases() {
  state.bases = { first: null, second: null, third: null };
}

function scoreRun(runnerPosition = null) {
  state.score.home += 1;
  state.currentHalfRuns += 1;
  if (runnerPosition && state.playerStats[runnerPosition]) state.playerStats[runnerPosition].runs += 1;
  setMomentum(8);
}

function checkWalkoff() {
  if (state.phase === "home" && state.inning >= 9 && state.score.home > state.score.away) {
    ensureInning().home = state.currentHalfRuns;
    endGame("walkoff");
    return true;
  }
  return false;
}

function markPlateAppearance({ atBat = true, hitType = "", walk = false, strikeout = false, rbi = 0 } = {}) {
  const batter = currentBatter();
  const stats = state.playerStats[batter.position];
  if (!stats) return;
  stats.plateAppearances += 1;
  if (atBat) stats.atBats += 1;
  if (hitType) {
    stats.hits += 1;
    if (hitType === "double") stats.doubles += 1;
    if (hitType === "triple") stats.triples += 1;
    if (hitType === "homer") stats.homeRuns += 1;
  }
  if (walk) stats.walks += 1;
  if (strikeout) stats.strikeouts += 1;
  stats.runsBattedIn += rbi;
}

function formatCount() {
  return `球數 ${state.balls} - ${state.strikes}`;
}

function flashCard(tone) {
  const card = $("game-card");
  card.classList.remove("celebrate", "danger");
  void card.offsetWidth;
  if (tone) card.classList.add(tone);
}

function updateBaseView() {
  ["first", "second", "third"].forEach((base) => {
    document.querySelector(`[data-base="${base}"]`)?.classList.toggle("active", Boolean(state.bases[base]));
  });
  const labels = { first: "一壘", second: "二壘", third: "三壘" };
  const occupied = Object.entries(state.bases)
    .filter(([, value]) => value)
    .map(([base, value]) => `${labels[base]}（${positionShort(value)}）`);
  $("field-note").textContent = occupied.length ? `${occupied.join("、")}有人，隊友正在把壓力變成分數。` : "壘上乾淨，先把球送進場內。";
  document.querySelectorAll(".out-light").forEach((light, index) => light.classList.toggle("active", index < state.outs));
  $("outs-badge").textContent = `${state.outs} OUT`;
}

function renderLineScore() {
  const lastInning = Math.max(9, state.inning);
  const awayTeam = teamFor(state.opponentId);
  const homeTeam = teamFor(state.teamId);
  const cells = ["<span class=\"line-label\">隊伍</span>"];
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${inning}</span>`);
  cells.push("<span class=\"line-total\">R</span>");
  cells.push(`<span class="line-label">${escapeHtml(awayTeam.shortName)}</span>`);
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${state.innings[inning - 1]?.away ?? "·"}</span>`);
  cells.push(`<span class="line-total">${state.score.away}</span>`);
  cells.push(`<span class="line-label">${escapeHtml(homeTeam.shortName)}</span>`);
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${state.innings[inning - 1]?.home ?? "·"}</span>`);
  cells.push(`<span class="line-total">${state.score.home}</span>`);
  $("line-score").innerHTML = cells.join("");
}

function renderLog() {
  const visibleEvents = [...state.log].reverse();
  $("play-log").innerHTML = visibleEvents.length
    ? visibleEvents.map((event, index) => `<div class="play-event ${index === 0 ? "" : event.tone ? `is-${escapeHtml(event.tone)}` : ""}"><strong>${index === 0 ? "NOW" : String(visibleEvents.length - index).padStart(2, "0")}</strong><span>${escapeHtml(event.message)}</span></div>`).join("")
    : `<div class="play-event"><strong>—</strong><span>比賽記錄會從第一球開始。</span></div>`;
}

function renderLobby() {
  const grid = $("position-grid");
  if (!grid) return;
  const humanCount = humanPlayerCount();
  $("team-slots-count").textContent = `${humanCount} / ${MAX_PLAYERS} 真人`;
  const localSlot = slotForPlayer(network.localPlayerId);
  $("role-status").textContent = localSlot
    ? `你目前是 ${positionName(localSlot.position)} · ${localSlot.name}；點選其他空缺位置即可換位。`
    : "你尚未選擇位置；空缺位置會由 NPC 補位。";
  $("release-position").disabled = !localSlot || state.phase === "home" && !(state.balls === 0 && state.strikes === 0);
  grid.innerHTML = POSITION_DEFS.map((definition) => {
    const slot = state.slots[definition.code];
    const isLocal = slot.playerId === network.localPlayerId;
    const isHuman = slot.controller === "human";
    const ownerClass = isHuman ? "is-human" : "is-npc";
    const disabled = isHuman && !isLocal;
    return `<button class="position-slot ${isLocal ? "is-local" : ""} ${isHuman ? "is-human" : ""} ${currentBatter().position === definition.code && state.phase === "home" ? "is-active" : ""}" data-position="${definition.code}" type="button" ${disabled ? "disabled" : ""} aria-label="${escapeHtml(`${definition.name}，${isHuman ? slot.name : "NPC"}`)}">
      <span class="position-code">${definition.code}</span>
      <span class="position-name">${definition.name}</span>
      <span class="position-owner ${ownerClass}">${escapeHtml(isHuman ? slot.name : "NPC 補位")}</span>
    </button>`;
  }).join("");
}

function renderBatter() {
  const batter = currentBatter();
  const defense = state.phase === "defense";
  const active = state.phase === "home" || defense;
  const position = defense ? state.defenseOwner : batter.position;
  const slot = state.slots[position];
  const definition = POSITION_BY_CODE[position];
  $("batter-number").textContent = active ? (defense ? definition.short : batter.number) : "—";
  $("batter-name").textContent = active ? (defense ? `${definition.name}守備` : batter.name) : state.phase === "gameover" ? "全場比賽結束" : "等待開賽";
  $("batter-meta").textContent = active
    ? defense
      ? `${definition.name} · ${slot?.controller === "npc" ? "NPC 補位中" : `${slot?.name || "隊友"} 控制`} · ${state.defenseMode === "fielding" ? "責任區來球處理" : "客隊進攻前的守備決策"}`
      : `${positionName(batter.position)} · ${slot?.controller === "npc" ? "NPC 補位中" : `${slot?.name || "隊友"} 控制`} · 第 ${state.decisions + 1} 個團隊決策`
    : state.phase === "gameover" ? "下一場比賽，新的九局，新的故事。" : "先選擇一個球員位置，再開始比賽。";
  const firstValue = defense ? definition.fielding : batter.contact;
  const secondValue = defense ? definition.arm : batter.power;
  $("contact-meter").style.width = `${active ? firstValue : 0}%`;
  $("power-meter").style.width = `${active ? secondValue : 0}%`;
  $("contact-value").textContent = active ? firstValue : "—";
  $("power-value").textContent = active ? secondValue : "—";
  const meterLabels = document.querySelectorAll(".meter-row > span");
  if (meterLabels[0]) meterLabels[0].textContent = defense ? "FIELDING" : "CONTACT";
  if (meterLabels[1]) meterLabels[1].textContent = defense ? "ARM" : "POWER";
}

function activeEventPosition() {
  return state.phase === "defense" ? state.defenseOwner : currentBatter().position;
}

function activeEventSlot() {
  return state.slots[activeEventPosition()];
}

function localControlsActiveEvent() {
  const eventSlot = activeEventSlot();
  return (state.phase === "home" || state.phase === "defense")
    && eventSlot?.controller === "human"
    && eventSlot.playerId === network.localPlayerId
    && (network.role !== "guest" || network.connected)
    && !network.awaiting
    && !state.actionLock;
}

function activeActionMeta() {
  if (state.phase !== "defense") return ACTION_META;
  return state.defenseMode === "fielding" ? FIELDING_ACTION_META : DEFENSE_ACTION_META;
}

function canAction(action) {
  if (state.phase === "defense") return Object.prototype.hasOwnProperty.call(activeActionMeta(), action);
  if (!["power", "contact", "patient", "bunt", "steal"].includes(action)) return false;
  if (action === "bunt" && !hasRunners()) return false;
  if (action === "steal" && !canSteal()) return false;
  return true;
}

function renderDecisionTimer() {
  const timer = $("decision-timer");
  if (!timer) return;
  timer.className = "decision-timer";
  if (!isDecisionPhase()) {
    timer.textContent = state.phase === "pre" ? "尚未開始" : state.phase === "cpu" ? "NPC 進攻" : "已結束";
    return;
  }
  const slot = activeEventSlot();
  if (slot?.controller === "npc") {
    timer.textContent = "NPC 補位";
    return;
  }
  if (!state.actionDeadline) {
    timer.textContent = "等待計時";
    return;
  }
  const remaining = Math.ceil((state.actionDeadline - Date.now()) / 1000);
  if (remaining <= 0) {
    timer.textContent = "接管中";
    timer.classList.add("is-expired");
  } else {
    timer.textContent = `剩餘 ${remaining}s`;
    if (remaining <= 3) timer.classList.add("is-warning");
  }
}

function renderActions() {
  const batter = currentBatter();
  const defense = state.phase === "defense";
  const actionMeta = activeActionMeta();
  const position = activeEventPosition();
  const slot = activeEventSlot();
  const localTurn = localControlsActiveEvent();
  const ownerText = slot?.controller === "npc" ? "NPC 正在閱讀球況" : slot?.playerId === network.localPlayerId ? "輪到你決定" : `等待 ${slot?.name || "隊友"}`;
  $("action-title-batting").textContent = defense ? `${positionName(position)} ${state.defenseMode === "fielding" ? "守備事件" : "守備決策"} · ${ownerText}` : state.phase === "home" ? `${batter.position} ${batter.name} · ${ownerText}` : "選擇一個策略";
  $("pitch-count-note").textContent = network.awaiting ? "決策已送出，等待同步" : defense ? state.defenseMode === "fielding" ? `客隊攻勢：${state.pendingAwayRuns} 分危機` : "選擇客隊進攻前的守備策略" : state.phase === "home" ? `${state.balls} 壞球 · ${state.strikes} 好球` : "選擇一個策略";
  const actionKeys = Object.keys(actionMeta);
  actionButtons.forEach((button) => {
    const action = actionKeys[actionButtons.indexOf(button)];
    button.dataset.action = action;
    const allowed = localTurn && canAction(action);
    button.disabled = !allowed;
    const meta = actionMeta[action];
    if (meta) {
      button.querySelector(".action-icon").textContent = meta.icon;
      button.querySelector("b").textContent = meta.title;
      button.querySelector("small").textContent = meta.detail;
      button.querySelector("kbd").textContent = meta.key;
    }
  });
  renderDecisionTimer();
  $("action-hint").textContent = network.awaiting
    ? "決策已送出，房主正在驗證並同步結果。"
    : defense && slot?.controller === "npc"
      ? state.defenseMode === "fielding" ? `${positionName(position)} 目前由 NPC 補位；真人加入或接手後即可處理來球。` : "投手或捕手目前由 NPC 補位；真人加入或接手後即可操作守備策略。"
      : defense
        ? state.defenseMode === "fielding"
          ? localTurn ? "這是你的責任區；基本接球最穩，冒險撲球可能追回更多分數。" : `目前由 ${slot?.name || "隊友"} 處理${positionName(position)}的來球。`
          : localTurn ? "守備策略會影響 NPC 客隊這個半局的得分風險。" : `目前由 ${slot?.name || "隊友"} 決定守備策略。`
        : state.phase !== "home"
          ? "比賽開始後，輪到你的球員打擊時才會啟用操作。"
          : slot?.controller === "npc"
            ? "這個位置目前由 NPC 補位；真人加入或接手後即可操作。"
            : !localTurn
              ? `目前由 ${slot?.name || "隊友"} 決定，其他隊友可以觀察球況。`
              : !hasRunners()
                ? "提示：現在沒有跑者，先把人送上壘包，再考慮其他戰術。"
                : state.strikes === 2
                  ? "兩好球！推打能降低三振風險，耐心選球也可能逼出保送。"
              : "提示：隊友在壘上時，短打與盜壘會改變整個半局。";
}

function renderResultSummary() {
  const panel = $("result-summary");
  if (!panel) return;
  if (state.phase !== "gameover") {
    panel.innerHTML = "";
    return;
  }
  const rows = POSITION_DEFS.map((definition) => {
    const slot = state.slots[definition.code];
    const stats = state.playerStats[definition.code] || {};
    const contribution = (stats.hits || 0) * 5 + (stats.runs || 0) * 3 + (stats.steals || 0) * 2 + (stats.decisions || 0) * 0.1 - (stats.timeouts || 0);
    return { definition, slot, stats, contribution };
  }).sort((left, right) => right.contribution - left.contribution);
  const top = rows[0];
  panel.innerHTML = `
    <div class="result-summary-heading">
      <p>TEAM CONTRIBUTION</p>
      <span>${top ? `本場焦點：${escapeHtml(top.slot?.name || top.definition.name)}` : "全隊紀錄"} · 逾時接管 ${state.timeouts || 0} 次</span>
    </div>
    <div class="result-grid">
      ${rows.map(({ definition, slot, stats }, index) => `<div class="result-player ${index === 0 ? "is-mvp" : ""}">
        <div class="result-player-top"><strong>${definition.code}${index === 0 ? " · MVP" : ""}</strong><b>${stats.hits || 0}H · ${stats.runs || 0}R</b></div>
        <div class="result-player-name">${escapeHtml(slot?.name || `NPC ${definition.name}`)}</div>
        <span class="result-player-meta">${slot?.controller === "human" ? "真人" : "NPC"} · ${stats.steals || 0} 盜壘 · ${stats.decisions || 0} 決策${stats.timeouts ? ` · ${stats.timeouts} 次逾時` : ""}</span>
      </div>`).join("")}
    </div>`;
}

function render() {
  const batter = currentBatter();
  const batterSlot = state.slots[batter.position];
  const homeTeam = teamFor(state.teamId);
  const awayTeam = teamFor(state.opponentId);
  const phaseText = { pre: "賽前準備", defense: `${homeTeam.shortName}守備 · ${state.defenseOwner || "P"}`, cpu: "NPC 客隊進攻", home: `輪到 ${batter.position}`, gameover: "比賽結束" }[state.phase];
  $("game-title").textContent = `${homeTeam.name} vs. ${awayTeam.name}`;
  $("away-team-name").textContent = awayTeam.name;
  $("away-team-record").textContent = `${awayTeam.stadium} · 先攻`;
  $("home-team-name").textContent = homeTeam.name;
  $("home-team-record").textContent = `${homeTeam.style} · NPC 補位`;
  $("phase-chip").textContent = phaseText;
  $("inning-label").textContent = state.phase === "pre" ? "尚未開打" : state.phase === "gameover" ? `${state.inning} 局結束` : `${state.inning} 局${state.half === "top" ? "上" : "下"}`;
  $("outs-label").textContent = `${state.outs} 出局`;
  $("count-label").textContent = formatCount();
  $("away-score").textContent = state.score.away;
  $("home-score").textContent = state.score.home;
  $("situation-text").textContent = state.phase === "pre"
    ? "選擇你的守備位置；空缺位置由免費 NPC 補位，房主驗證每個團隊決策。"
    : state.phase === "defense"
      ? state.defenseMode === "fielding"
        ? `${state.inning} 局上，球往${positionName(state.defenseOwner)}方向飛去；由責任區球員處理來球。`
        : `${state.inning} 局上，${positionName(state.defenseOwner)} 玩家要先決定守備策略；結果由房主公平計算。`
      : state.phase === "cpu"
      ? `NPC ${awayTeam.name} 正在完成半局進攻，下一個半局由 ${homeTeam.name} 球員接手。`
      : state.phase === "gameover"
        ? "最後一球已經落地。看看團隊與個人留下的數字，再決定要不要再戰。"
        : batterSlot?.controller === "npc"
          ? `${state.inning} 局下，${batter.name} 的位置目前由 NPC 補位。真人玩家可以隨時接手空缺位置。`
          : `${state.inning} 局下，${batter.name} 站上打擊區。${batterSlot?.name || "隊友"} 正在做決策。`;
  $("momentum-score").textContent = state.momentum;
  $("momentum-bar").style.width = `${state.momentum}%`;
  $("momentum-copy").textContent = state.teamChemistry >= 75 ? "團隊默契正在升溫，隊友的配合讓每個決策更清楚。" : state.teamChemistry <= 30 ? "默契偏低，先用穩定選擇找回節奏。" : state.phase === "pre" ? "比賽還沒開始，先找到你要守護的位置。" : "兩隊拉鋸中，每個壘包都值得計算。";
  const localStats = state.playerStats[network.assignedPosition] || { hits: 0, runs: 0, steals: 0, decisions: 0 };
  $("stat-hits").textContent = localStats.hits || 0;
  $("stat-runs").textContent = localStats.runs || 0;
  $("stat-steals").textContent = localStats.steals || 0;
  $("stat-pitches").textContent = localStats.decisions || 0;
  $("welcome-panel").hidden = state.phase !== "pre";
  $("batting-panel").hidden = state.phase !== "home" && state.phase !== "defense";
  $("gameover-panel").hidden = state.phase !== "gameover";
  $("start-game").disabled = (network.role === "guest" && !network.connected) || !slotForPlayer(network.localPlayerId);
  $("gameover-title").textContent = state.result === "win" || state.result === "walkoff" ? "主場勝利！" : state.result === "tie" ? "延長賽後仍然平手" : "客隊帶走勝利";
  $("gameover-copy").textContent = `最終比分：${homeTeam.name} ${state.score.home}：${state.score.away} ${awayTeam.name}。這場比賽留下 ${humanPlayerCount()} 名真人玩家與 NPC 隊友的共同紀錄。`;
  renderResultSummary();
  updateBaseView();
  renderLineScore();
  renderLog();
  renderBatter();
  renderActions();
  renderNetwork();
  renderLobby();
  renderDevelopment();
  scheduleNpcTurn();
}

function resetMatchState() {
  window.clearTimeout(network.actionTimer);
  network.actionTimer = null;
  const previousSlots = clone(state.slots);
  const previousRevision = state.revision;
  state = createState(state.teamId, state.opponentId);
  state.revision = previousRevision;
  POSITION_DEFS.forEach(({ code }) => {
    const previous = previousSlots[code];
    if (!previous) return;
    const target = state.slots[code];
    if (previous.controller === "human" && previous.playerId) {
      Object.assign(target, {
        playerId: previous.playerId,
        sessionId: previous.sessionId,
        connectionKey: previous.connectionKey,
        name: previous.name,
        controller: "human",
        connected: previous.connected,
      });
    }
  });
  network.awaiting = false;
}

function resetGame() {
  if (!isAuthority()) return;
  resetMatchState();
  addLog("新比賽準備開始；每個位置都可以由真人或 NPC 負責。", "big");
  commitState();
}

function startGame() {
  if (!isAuthority() || !(state.phase === "pre" || state.phase === "gameover")) return;
  resetMatchState();
  addLog(`比賽開始！NPC ${teamFor(state.opponentId).name} 先攻，${teamFor(state.teamId).name} 準備在主場接手。`, "big");
  beginDefenseHalf();
  commitState();
}

function beginDefenseHalf() {
  state.phase = "defense";
  state.half = "top";
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.currentHalfRuns = 0;
  state.defenseMode = "strategy";
  state.defenseAction = "";
  state.pendingAwayRuns = 0;
  state.defenseOwner = state.slots.C.controller === "human" ? "C" : state.slots.P.controller === "human" ? "P" : "P";
  addLog(`${state.inning} 局上，${teamFor(state.teamId).name} 的${positionName(state.defenseOwner)}準備面對客隊打線。`, "big");
  armActionDeadline();
}

function simulateAwayHalf(defenseAction = "defense-control") {
  state.phase = "cpu";
  state.half = "top";
  resetBases();
  state.outs = 3;
  state.balls = 0;
  state.strikes = 0;
  state.defenseAction = defenseAction;
  const profiles = {
    "defense-fast": [0.1, 0.28, 0.55],
    "defense-break": [0.07, 0.2, 0.48],
    "defense-control": [0.04, 0.13, 0.35],
    "defense-pickoff": [0.05, 0.18, 0.42],
    "defense-intentional": [0.06, 0.22, 0.46],
  };
  const [threeRun, twoRun, oneRun] = profiles[defenseAction] || profiles["defense-control"];
  const roll = nextRandom();
  const runs = roll < threeRun ? 3 : roll < twoRun ? 2 : roll < oneRun ? 1 : 0;
  if (runs === 0) {
    const actionName = DEFENSE_ACTION_META[defenseAction]?.title || "穩定控球";
    completeAwayHalf(0, `${state.inning} 局上${actionName}奏效，客隊三上三下。`);
    return;
  }
  const fieldingPositions = ["1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  state.pendingAwayRuns = runs;
  state.defenseMode = "fielding";
  state.defenseOwner = fieldingPositions[Math.floor(nextRandom() * fieldingPositions.length)];
  state.phase = "defense";
  addLog(`${state.inning} 局上球打進場內，往${positionName(state.defenseOwner)}方向飛去，暫時形成 ${runs} 分危機。`, "danger");
  armActionDeadline();
}

function completeAwayHalf(runs, message, tone = "") {
  state.phase = "cpu";
  state.half = "top";
  resetBases();
  state.outs = 3;
  state.balls = 0;
  state.strikes = 0;
  state.score.away += runs;
  state.pendingAwayRuns = 0;
  ensureInning().away = runs;
  if (message) addLog(message, tone);
  if (state.inning >= 9 && state.score.home > state.score.away) endGame("win");
}

function resolveFieldingAction(action) {
  const definition = POSITION_BY_CODE[state.defenseOwner] || POSITION_BY_CODE.CF;
  const defender = playerForPosition(state.defenseOwner, state.teamId) || definition;
  const defenderRatings = defender.ratings || defender;
  const baseRuns = state.pendingAwayRuns;
  const fielding = Number(defenderRatings.fielding || definition.fielding) / 100;
  const arm = Number(defenderRatings.armStrength || definition.arm) / 100;
  const reaction = Number(defenderRatings.reaction || definition.fielding) / 100;
  const roll = nextRandom();
  let finalRuns = baseRuns;
  if (action === "fielding-catch") {
    if (roll < 0.48 + fielding * 0.22 + reaction * 0.12) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-dive") {
    if (roll < 0.18 + fielding * 0.38 + reaction * 0.22) finalRuns = Math.max(0, baseRuns - 2);
    else finalRuns = Math.min(3, baseRuns + 1);
  } else if (action === "fielding-hold") {
    if (roll < 0.61 + fielding * 0.2 + reaction * 0.11 && nextRandom() < 0.65) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-relay") {
    if (roll < 0.35 + arm * 0.34 + Number(defenderRatings.armAccuracy || definition.arm) / 100 * 0.2) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-throw") {
    if (roll < 0.26 + arm * 0.42 + Number(defenderRatings.armAccuracy || definition.arm) / 100 * 0.18) finalRuns = Math.max(0, baseRuns - 1);
    else finalRuns = Math.min(3, baseRuns + 1);
  }
  const fieldStats = state.playerStats[state.defenseOwner];
  if (fieldStats) {
    fieldStats.fieldingChances += 1;
    if (finalRuns < baseRuns) fieldStats.putouts += 1;
    else if (finalRuns > baseRuns) fieldStats.errors += 1;
    else fieldStats.assists += 1;
  }
  const actionName = FIELDING_ACTION_META[action]?.title || "守住落點";
  if (finalRuns < baseRuns) {
    setMomentum(7);
    completeAwayHalf(finalRuns, `${positionName(state.defenseOwner)}${actionName}成功，守備追回 ${baseRuns - finalRuns} 分。`, "big");
  } else if (finalRuns > baseRuns) {
    setMomentum(-9);
    completeAwayHalf(finalRuns, `${positionName(state.defenseOwner)}${actionName}失手，客隊多拿 ${finalRuns} 分。`, "danger");
  } else {
    setMomentum(-3);
    completeAwayHalf(finalRuns, `${positionName(state.defenseOwner)}${actionName}完成，客隊拿下 ${finalRuns} 分。`, "danger");
  }
}

function beginHomeHalf() {
  state.phase = "home";
  state.half = "bottom";
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.currentHalfRuns = 0;
  state.defenseMode = "strategy";
  state.defenseAction = "";
  state.pendingAwayRuns = 0;
  resetBases();
  addLog(`${state.inning} 局下，${teamFor(state.teamId).name} 球員進攻。`, "big");
  setMomentum(state.score.home >= state.score.away ? 5 : -2);
  armActionDeadline();
}

function nextBatter() {
  const rosterLineup = activeLineup();
  state.batterIndex = (state.batterIndex + 1) % Math.max(1, rosterLineup.length);
  state.balls = 0;
  state.strikes = 0;
}

function finishPlateAppearance(result = {}) {
  markPlateAppearance(result);
  state.balls = 0;
  state.strikes = 0;
  if (state.outs >= 3) {
    finishHomeHalf();
    return;
  }
  nextBatter();
}

function recordOut(reason) {
  state.outs += 1;
  setMomentum(-4);
  addLog(`${currentBatter().name}${reason}，${state.outs} 出局。`, "danger");
  flashCard("danger");
  finishPlateAppearance({ atBat: true, strikeout: reason.includes("三振") });
}

function applyHit(kind) {
  const batter = currentBatter();
  const batterPosition = batter.position;
  state.hits += 1;
  let runs = 0;
  if (kind === "single") {
    if (state.bases.third) { scoreRun(state.bases.third); runs += 1; }
    state.bases.third = state.bases.second;
    state.bases.second = state.bases.first;
    state.bases.first = batterPosition;
  } else if (kind === "double") {
    if (state.bases.third) { scoreRun(state.bases.third); runs += 1; }
    if (state.bases.second) { scoreRun(state.bases.second); runs += 1; }
    state.bases.third = state.bases.first;
    state.bases.second = batterPosition;
    state.bases.first = null;
  } else if (kind === "triple") {
    ["first", "second", "third"].forEach((base) => { if (state.bases[base]) { scoreRun(state.bases[base]); runs += 1; } });
    state.bases = { first: null, second: null, third: batterPosition };
  } else if (kind === "homer") {
    ["first", "second", "third"].forEach((base) => { if (state.bases[base]) { scoreRun(state.bases[base]); runs += 1; } });
    scoreRun(batterPosition);
    runs += 1;
    resetBases();
  }
  const labels = { single: "一壘安打", double: "二壘安打", triple: "三壘安打", homer: "全壘打" };
  addLog(`${batter.name} ${labels[kind]}${runs ? `，送回 ${runs} 分` : ""}！`, kind === "homer" || runs > 0 ? "big" : "");
  setMomentum(kind === "homer" ? 18 : 7);
  flashCard("celebrate");
  finishPlateAppearance({ atBat: true, hitType: kind, rbi: runs });
  checkWalkoff();
}

function applyWalk() {
  const batter = currentBatter();
  const batterPosition = batter.position;
  let run = false;
  if (!state.bases.first) state.bases.first = batterPosition;
  else if (!state.bases.second) {
    state.bases.second = state.bases.first;
    state.bases.first = batterPosition;
  } else if (!state.bases.third) {
    state.bases.third = state.bases.second;
    state.bases.second = state.bases.first;
    state.bases.first = batterPosition;
  } else {
    scoreRun(state.bases.third);
    state.bases.third = state.bases.second;
    state.bases.second = state.bases.first;
    state.bases.first = batterPosition;
    run = true;
  }
  addLog(`${batter.name} 選到四壞球保送${run ? "，擠回 1 分" : ""}。`, run ? "big" : "");
  setMomentum(5);
  finishPlateAppearance({ atBat: false, walk: true, rbi: run ? 1 : 0 });
  checkWalkoff();
}

function resolveSwing(action) {
  const batter = currentBatter();
  const roll = nextRandom();
  const ratings = batter.ratings || batter;
  const contactBoost = (Number(ratings.contact || 60) * 0.72 + Number(ratings.vision || 60) * 0.28) / 1000;
  const powerBoost = (Number(ratings.power || 60) * 0.84 + Number(ratings.clutch || 60) * 0.16) / 1200;
  let result = "out";
  if (action === "power") {
    if (roll < 0.015 + powerBoost * 0.75) result = "homer";
    else if (roll < 0.075 + powerBoost * 0.75) result = "double";
    else if (roll < 0.25 + contactBoost * 0.7) result = "single";
    else if (roll < 0.52) result = "foul";
    else if (roll < 0.76) result = "miss";
  } else {
    if (roll < 0.008 + powerBoost * 0.3) result = "homer";
    else if (roll < 0.055 + powerBoost * 0.42) result = "double";
    else if (roll < 0.24 + contactBoost * 0.7) result = "single";
    else if (roll < 0.55 + contactBoost * 0.1) result = "foul";
    else if (roll < 0.79 + contactBoost * 0.04) result = "miss";
  }
  if (["single", "double", "homer"].includes(result)) { applyHit(result); return; }
  if (result === "foul") {
    if (state.strikes < 2) state.strikes += 1;
    addLog(`${batter.name} 把球打成界外，${state.balls} 壞球 ${state.strikes} 好球。`);
    setMomentum(1);
    return;
  }
  if (result === "miss") {
    state.strikes += 1;
    if (state.strikes >= 3) recordOut("揮棒落空，遭到三振");
    else { addLog(`${batter.name} 揮棒落空，${state.strikes} 好球。`, "danger"); setMomentum(-2); }
    return;
  }
  recordOut("擊出內野滾地球");
}

function resolvePatient() {
  const batter = currentBatter();
  const patience = Number(batter.ratings?.discipline || 60) / 100;
  if (nextRandom() < 0.4 + patience * 0.3) {
    state.balls += 1;
    if (state.balls >= 4) applyWalk();
    else { addLog(`${batter.name} 放掉壞球，${state.balls} 壞球。`); setMomentum(2); }
  } else {
    state.strikes += 1;
    if (state.strikes >= 3) recordOut("看著好球進壘，遭到三振");
    else { addLog(`${batter.name} 沒有出棒，主審判好球。${state.strikes} 好球。`, "danger"); setMomentum(-1); }
  }
}

function resolveBunt() {
  const batter = currentBatter();
  const roll = nextRandom();
  if (roll < 0.2) { applyHit("single"); return; }
  if (roll < 0.76) {
    const scored = state.bases.third ? 1 : 0;
    if (state.bases.third) scoreRun(state.bases.third);
    state.bases.third = state.bases.second;
    state.bases.second = state.bases.first;
    state.bases.first = null;
    state.outs += 1;
    addLog(`${batter.name} 執行犧牲短打，跑者推進${scored ? "並帶回 1 分" : ""}。`, scored ? "big" : "");
    setMomentum(scored ? 7 : 3);
    if (scored) flashCard("celebrate");
    finishPlateAppearance({ atBat: true, rbi: scored });
    checkWalkoff();
    return;
  }
  recordOut("短打點到，投手輕鬆接殺");
}

function canSteal() {
  return (state.bases.first && !state.bases.second) || (state.bases.second && !state.bases.third);
}

function resolveSteal() {
  let from = null;
  let to = null;
  if (state.bases.first && !state.bases.second) { from = "first"; to = "second"; }
  else if (state.bases.second && !state.bases.third) { from = "second"; to = "third"; }
  if (!from) return;
  const labels = { first: "一壘", second: "二壘", third: "三壘" };
  const runnerPosition = state.bases[from];
  const runner = playerForPosition(runnerPosition, state.teamId) || {};
  const runnerRatings = runner.ratings || runner;
  const stealChance = 0.46 + Number(runnerRatings.stealing || 50) / 260 + Number(runnerRatings.speed || 50) / 500;
  if (nextRandom() < stealChance) {
    state.bases[from] = null;
    state.bases[to] = runnerPosition;
    state.steals += 1;
    if (state.playerStats[runnerPosition]) {
      state.playerStats[runnerPosition].steals += 1;
      state.playerStats[runnerPosition].decisions += 1;
    }
    setMomentum(8);
    addLog(`盜壘成功！${positionShort(runnerPosition)}號跑者從${labels[from]}滑進${labels[to]}。`, "big");
    flashCard("celebrate");
  } else {
    state.bases[from] = null;
    state.outs += 1;
    if (state.playerStats[runnerPosition]) state.playerStats[runnerPosition].caughtStealing += 1;
    setMomentum(-10);
    addLog(`盜壘失敗，${positionShort(runnerPosition)}號跑者在${labels[to]}前被觸殺。`, "danger");
    flashCard("danger");
    if (state.outs >= 3) finishHomeHalf();
  }
}

function chooseNpcAction() {
  const batter = currentBatter();
  if (canSteal() && state.outs < 2 && nextRandom() < 0.08) return "steal";
  if (hasRunners() && state.outs < 2 && nextRandom() < 0.12) return "bunt";
  if (state.strikes === 2) return nextRandom() < 0.68 ? "contact" : "patient";
  if (batter.power >= 82 && nextRandom() < 0.48) return "power";
  if (state.balls >= 2 && nextRandom() < 0.34) return "patient";
  return nextRandom() < 0.62 ? "contact" : "power";
}

function chooseNpcDefenseAction() {
  if (state.defenseMode === "fielding") {
    const definition = POSITION_BY_CODE[state.defenseOwner] || POSITION_BY_CODE.CF;
    const defender = playerForPosition(state.defenseOwner, state.teamId) || definition;
    const defenderRatings = defender.ratings || defender;
    const roll = nextRandom();
    if (Number(defenderRatings.fielding || definition.fielding) >= 84 && roll < 0.35) return "fielding-dive";
    if (Number(defenderRatings.armStrength || definition.arm) >= 82 && roll < 0.62) return "fielding-throw";
    return roll < 0.32 ? "fielding-catch" : roll < 0.67 ? "fielding-hold" : "fielding-relay";
  }
  const roll = nextRandom();
  if (state.inning >= 9 && state.score.home < state.score.away) return roll < 0.42 ? "defense-fast" : "defense-break";
  if (state.outs === 2) return roll < 0.55 ? "defense-break" : "defense-control";
  return roll < 0.28 ? "defense-fast" : roll < 0.58 ? "defense-break" : "defense-control";
}

function scheduleNpcTurn() {
  if (!isAuthority() || (state.phase !== "home" && state.phase !== "defense") || state.actionLock || network.npcTimer) return;
  const slot = activeEventSlot();
  if (slot?.controller !== "npc") return;
  network.npcTimer = window.setTimeout(() => {
    network.npcTimer = null;
    if (state.phase === "defense" && activeEventSlot()?.controller === "npc") performActionForPlayer(null, chooseNpcDefenseAction(), true);
    else if (state.phase === "home" && currentBatterSlot()?.controller === "npc") performActionForPlayer(null, chooseNpcAction(), true);
  }, 520);
}

function performActionForPlayer(playerId, action, npc = false, reason = "") {
  if (!isAuthority() || (state.phase !== "home" && state.phase !== "defense") || state.actionLock || !canAction(action)) return false;
  const slot = activeEventSlot();
  if (!npc && (slot.controller !== "human" || slot.playerId !== playerId)) return false;
  if (!npc && state.actionDeadline && Date.now() > state.actionDeadline) {
    const fallbackName = state.phase === "defense" ? state.defenseMode === "fielding" ? "守住落點" : "穩定控球" : "安全推打";
    addLog(`${positionName(slot.position)} 玩家逾時，NPC 接手採用${fallbackName}。`, "danger");
    return performActionForPlayer(null, chooseTimeoutAction(), true, "timeout");
  }
  state.actionLock = true;
  state.decisions += 1;
  if (slot.controller === "human" && !npc && state.playerStats[slot.position]) state.playerStats[slot.position].decisions += 1;
  if (npc && reason === "timeout" && slot.controller === "human") {
    state.timeouts += 1;
    if (state.playerStats[slot.position]) state.playerStats[slot.position].timeouts += 1;
  }
  if (state.phase === "defense") {
    state.defenseAction = action;
    if (state.defenseMode === "fielding") resolveFieldingAction(action);
    else simulateAwayHalf(action);
    if (state.phase === "cpu") beginHomeHalf();
  } else if (action === "power" || action === "contact") resolveSwing(action);
  else if (action === "patient") resolvePatient();
  else if (action === "bunt") resolveBunt();
  else if (action === "steal") resolveSteal();
  state.actionLock = false;
  if (isDecisionPhase()) armActionDeadline();
  else clearActionDeadline();
  commitState();
  return true;
}

function handleAction(action) {
  if (!localControlsActiveEvent() || !canAction(action)) return;
  if (network.role === "guest") {
    network.awaiting = true;
    const sent = sendToHost({ type: "action", protocol: PROTOCOL_VERSION, revision: state.revision, action });
    if (!sent) {
      network.awaiting = false;
      network.status = "決策傳送失敗，請確認連線後再試。";
    } else {
      network.status = "已送出決策，等待房主驗證。";
    }
    render();
    return;
  }
  performActionForPlayer(network.localPlayerId, action);
}

function finishHomeHalf() {
  ensureInning().home = state.currentHalfRuns;
  state.phase = "cpu";
  state.half = "bottom";
  resetBases();
  state.balls = 0;
  state.strikes = 0;
  addLog(`${state.inning} 局下結束，${teamFor(state.teamId).shortName} 這半局拿下 ${state.currentHalfRuns} 分。`, state.currentHalfRuns > 0 ? "big" : "");
  if (state.inning >= 9 && state.score.home > state.score.away) { endGame("win"); return; }
  if (state.inning >= 9 && state.score.home < state.score.away) { endGame("loss"); return; }
  if (state.inning >= 9 && state.score.home === state.score.away) {
    if (state.inning >= 12) { endGame("tie"); return; }
    state.inning += 1;
    addLog("九局打完仍是平手，進入延長賽。", "big");
  } else state.inning += 1;
  beginDefenseHalf();
}

function endGame(result) {
  clearActionDeadline();
  state.phase = "gameover";
  state.half = "bottom";
  state.balls = 0;
  state.strikes = 0;
  state.result = result;
  recordMatchCareer(result);
  if (result === "walkoff" || result === "win") {
    addLog(`比賽結束！${teamFor(state.teamId).name} 靠著主場攻勢贏下比賽。`, "big");
    flashCard("celebrate");
  } else if (result === "tie") {
    addLog("比賽在延長賽後仍然平手。", "danger");
    flashCard("danger");
  } else {
    addLog("比賽結束，客隊守住最後一個出局數。", "danger");
    flashCard("danger");
  }
}

function bindEvents() {
  $("create-room").addEventListener("click", createRoom);
  $("join-room").addEventListener("click", joinRoom);
  $("reconnect-room")?.addEventListener("click", reconnectRoom);
  $("room-code-input").addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom(); });
  $("copy-room").addEventListener("click", async () => {
    if (!network.roomCode) return;
    try {
      await navigator.clipboard.writeText(network.roomCode);
      setStatus("房間代碼已複製，可以傳給朋友。" );
    } catch {
      setStatus(`房間代碼是 ${network.roomCode}，請手動複製。`);
    }
  });
  $("start-game").addEventListener("click", requestStart);
  $("new-game").addEventListener("click", requestReset);
  $("rematch").addEventListener("click", requestStart);
  $("release-position").addEventListener("click", () => {
    if (network.role === "guest") {
      if (network.connected) sendToHost({ type: "release", protocol: PROTOCOL_VERSION });
    } else releaseLocalPosition();
  });
  $("position-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-position]");
    if (!button || button.disabled) return;
    const position = button.dataset.position;
    if (network.role === "guest") {
      if (!network.connected) return;
      sendToHost({ type: "claim", protocol: PROTOCOL_VERSION, position });
      network.status = `正在申請 ${positionName(position)} 位置……`;
      renderNetwork();
    } else claimLocalPosition(position);
  });
  $("team-signals")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-signal]");
    if (!button || button.disabled) return;
    sendTeamSignal(button.dataset.signal);
  });
  $("player-name-input").addEventListener("change", () => {
    const name = cleanName($("player-name-input").value);
    $("player-name-input").value = name;
    network.displayName = name;
    if (network.role === "guest") {
      if (network.connected) sendToHost({ type: "name", protocol: PROTOCOL_VERSION, name });
    } else updateLocalName(name);
  });
  $("team-select")?.addEventListener("change", (event) => applyTeamSelection(event.target.value));
  $("opponent-select")?.addEventListener("change", (event) => applyOpponentSelection(event.target.value));
  $("team-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-development-team]");
    if (!button) return;
    developmentTeamId = button.dataset.developmentTeam;
    const firstPlayer = rosterForTeam(developmentTeamId)[0];
    if (firstPlayer) selectedAthleteId = firstPlayer.id;
    renderDevelopment();
  });
  $("roster-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-athlete-id]");
    if (!button) return;
    selectedAthleteId = button.dataset.athleteId;
    renderDevelopment();
  });
  $("custom-player-form")?.addEventListener("submit", createCustomPlayerFromForm);
  $("custom-player-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-custom-action]");
    if (!button) return;
    if (button.dataset.customAction === "use") useCustomPlayer(button.dataset.customPlayerId);
  });
  $("training-actions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-training]");
    if (!button || button.disabled) return;
    trainSelectedPlayer(button.dataset.training);
  });
  actionButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const keyMap = state.phase === "defense"
      ? Object.fromEntries(Object.entries(activeActionMeta()).map(([action, meta]) => [meta.key, action]))
      : { "1": "power", "2": "contact", "3": "patient", "4": "bunt", "5": "steal" };
    const action = keyMap[event.key];
    if (!action) return;
    const button = document.querySelector(`[data-action="${action}"]`);
    if (button && !button.disabled) button.click();
  });
}

function bootstrap() {
  const preferredPlayer = customPlayers[customPlayers.length - 1] || null;
  if (preferredPlayer) {
    selectedCustomPlayerId = preferredPlayer.id;
    selectedAthleteId = preferredPlayer.id;
    developmentTeamId = preferredPlayer.teamId;
    network.displayName = preferredPlayer.name;
    if ($("player-name-input")) $("player-name-input").value = preferredPlayer.name;
  }
  updateLocalName($("player-name-input")?.value || network.displayName, false);
  claimLocalPosition(preferredPlayer?.teamId === state.teamId ? preferredPlayer.position : "CF", false);
  syncMatchAthletes();
  bindEvents();
  network.countdownTimer = window.setInterval(renderDecisionTimer, 250);
  render();
}

bootstrap();
