"use strict";

const $ = (id) => document.getElementById(id);
const actionButtons = [...document.querySelectorAll("[data-action]")];
const PROTOCOL_VERSION = 3;
const MAX_PLAYERS = 9;
const MAX_LOG = 14;
const ACTION_TIMEOUT_MS = { defense: 7000, fielding: 5000, home: 10000 };
const DIFFICULTY_CONFIG = {
  label: "競技",
  swingWindow: 0.9,
  patientBase: 0.32,
  buntHitChance: 0.12,
  stealBaseChance: 0.32,
  fieldingSuccessScale: 0.88,
};
const SESSION_STORAGE_KEY = "jiuju-session-id-v1";
const PRACTICE_SESSIONS_PER_DAY = 3;
const MAX_NETWORK_BOOST = 20;

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
const SCHEDULE_STORAGE_KEY = "jiuju-cpbl-season-v1";
const CUSTOM_PLAYERS_STORAGE_KEY = "jiuju-custom-players-v1";
const PLAYER_SAVE_META_KEY = "jiuju-player-save-meta-v1";
const PLAYER_SAVE_FORMAT = "689-player-save";
const PLAYER_SAVE_VERSION = 1;
const MAX_CUSTOM_PLAYERS = 18;
const CPBL_SEASON_YEAR = 2026;
const CPBL_DATA_SNAPSHOT = "2026-08-23";
const CPBL_TOTAL_SEASON_GAMES = 360;
const DEFAULT_TEAM_ID = "taipei";
const DEFAULT_OPPONENT_ID = "kaohsiung";

const TEAM_DEFS = [
  { id: "taipei", name: "中信兄弟", city: "台中", shortName: "兄弟", stadium: "臺中洲際棒球場", style: "火力與串聯", color: "#f4c542", bonus: { contact: 5, power: 5, vision: 2, discipline: 2, armAccuracy: 1 }, leagueStats: { games: 31, wins: 16, losses: 15, ties: 0, battingAvg: .282, onBasePct: .334, sluggingPct: .374, era: 3.61 } },
  { id: "kaohsiung", name: "統一7-ELEVEn獅", city: "台南", shortName: "統一獅", stadium: "臺南亞太國際棒球場", style: "控球與機動", color: "#f26b38", bonus: { contact: 3, vision: 3, discipline: 3, control: 3, break: 3, speed: 2 }, leagueStats: { games: 31, wins: 15, losses: 16, ties: 0, battingAvg: .271, onBasePct: .334, sluggingPct: .343, era: 2.87 } },
  { id: "taichung", name: "樂天桃猿", city: "桃園", shortName: "桃猿", stadium: "樂天桃園棒球場", style: "投手壓制", color: "#e74675", bonus: { fielding: 2, reaction: 2, control: 4, break: 5, stamina: 2 }, leagueStats: { games: 27, wins: 15, losses: 12, ties: 0, battingAvg: .253, onBasePct: .308, sluggingPct: .334, era: 2.14 } },
  { id: "hsinchu", name: "富邦悍將", city: "新北", shortName: "悍將", stadium: "新莊棒球場", style: "長打與強肩", color: "#5a8dee", bonus: { power: 2, armStrength: 2, velocity: -1, control: -2, fielding: -1 }, leagueStats: { games: 27, wins: 12, losses: 15, ties: 0, battingAvg: .248, onBasePct: .305, sluggingPct: .316, era: 4.26 } },
  { id: "taoyuan", name: "味全龍", city: "台北", shortName: "味全", stadium: "天母棒球場", style: "守備與先發", color: "#cf3038", bonus: { fielding: 3, reaction: 3, control: 4, break: 3, stamina: 2, contact: -2 }, leagueStats: { games: 29, wins: 16, losses: 13, ties: 0, battingAvg: .232, onBasePct: .305, sluggingPct: .315, era: 2.87 } },
  { id: "chiayi", name: "台鋼雄鷹", city: "高雄", shortName: "雄鷹", stadium: "澄清湖棒球場", style: "速度與選球", color: "#61b6c9", bonus: { contact: 3, discipline: 4, speed: 4, stealing: 3, power: 1, control: -1, velocity: -1 }, leagueStats: { games: 29, wins: 13, losses: 16, ties: 0, battingAvg: .271, onBasePct: .340, sluggingPct: .355, era: 3.95 } },
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
  taipei: ["岳政華", "詹子賢", "王威晨", "許基宏", "宋晟睿", "王政順", "江坤宇", "高宇杰", "鄭浩均"],
  kaohsiung: ["陳傑憲", "林佳緯", "潘傑楷", "林子豪", "蘇智傑", "林靖凱", "陳聖平", "陳重羽", "布雷克"],
  taichung: ["成晉", "林政華", "梁家榮", "廖健富", "陳晨威", "林立", "林承飛", "林泓育", "威能帝"],
  hsinchu: ["林哲瑄", "申皓瑋", "李宗賢", "范國宸", "孔念恩", "王正棠", "王勝偉", "戴培峰", "鈴木駿輔"],
  taoyuan: ["郭天信", "陳子豪", "劉基鴻", "朱育賢", "拿莫．伊漾", "李凱威", "張政禹", "吉力吉撈．鞏冠", "鋼龍"],
  chiayi: ["藍寅倫", "王柏融", "郭阜林", "魔鷹", "陳文杰", "吳念庭", "曾子祐", "吳明鴻", "後勁"],
};

// 2026 CPBL 主力先發快照：以官方球員名單、團隊攻守數據與球員成績做遊戲化換算。
// 數值調整保持在小幅範圍，避免單一球員破壞多人房間平衡。
const CPBL_PLAYER_PROFILES = {
  taipei: {
    CF: { adjustments: { contact: 2, speed: 7, stealing: 5, fielding: 2 } },
    RF: { adjustments: { contact: 5, power: 7, clutch: 4, armStrength: 2 } },
    "3B": { adjustments: { contact: 4, discipline: 4, speed: 3, fielding: 3 } },
    "1B": { adjustments: { contact: 3, power: 8, discipline: 2, speed: -4 } },
    LF: { adjustments: { contact: 5, power: 5, speed: 2, armStrength: 3 } },
    "2B": { adjustments: { contact: 3, vision: 3, fielding: 2 } },
    SS: { adjustments: { fielding: 7, reaction: 7, armAccuracy: 5, speed: 3 } },
    C: { adjustments: { blocking: 6, armStrength: 4, armAccuracy: 4 } },
    P: { adjustments: { velocity: 4, control: 5, break: 4, stamina: 4 } },
  },
  kaohsiung: {
    CF: { adjustments: { contact: 12, vision: 8, discipline: 8, clutch: 5, speed: 3 }, performance: { avg: .335, obp: .418, slg: .443, ops: .861 } },
    RF: { adjustments: { contact: 4, speed: 5, fielding: 3 } },
    "3B": { adjustments: { contact: 4, power: 3, speed: 2 } },
    "1B": { adjustments: { contact: 2, power: 7 } },
    LF: { adjustments: { power: 7, clutch: 5, armStrength: 2 } },
    "2B": { adjustments: { fielding: 5, reaction: 4, speed: 3 } },
    SS: { adjustments: { fielding: 4, reaction: 4, armAccuracy: 3 } },
    C: { adjustments: { blocking: 5, armAccuracy: 4 } },
    P: { adjustments: { control: 5, break: 6, stamina: 3 } },
  },
  taichung: {
    CF: { adjustments: { contact: 5, speed: 4, fielding: 3 } },
    RF: { adjustments: { speed: 5, fielding: 3, armStrength: 3 } },
    "3B": { adjustments: { contact: 3, power: 4, fielding: 3 } },
    "1B": { adjustments: { contact: 4, power: 5, clutch: 4 } },
    LF: { adjustments: { contact: 3, speed: 6, stealing: 4 } },
    "2B": { adjustments: { contact: 9, power: 7, speed: 5, fielding: 3 } },
    SS: { adjustments: { fielding: 5, reaction: 4, armAccuracy: 3 } },
    C: { adjustments: { power: 7, contact: 4, clutch: 5 } },
    P: { adjustments: { velocity: 5, control: 6, break: 6, stamina: 4 } },
  },
  hsinchu: {
    CF: { adjustments: { fielding: 6, reaction: 5, armStrength: 3 } },
    RF: { adjustments: { contact: 3, power: 4, speed: 3 } },
    "3B": { adjustments: { contact: 4, speed: 3, fielding: 4 } },
    "1B": { adjustments: { power: 7, clutch: 4 } },
    LF: { adjustments: { contact: 7, discipline: 2 }, performance: { avg: .308, obp: .323, slg: .411, ops: .734 } },
    "2B": { adjustments: { contact: 4, vision: 4, discipline: 3 } },
    SS: { adjustments: { fielding: 5, reaction: 5, armAccuracy: 4 } },
    C: { adjustments: { blocking: 5, armStrength: 4 } },
    P: { adjustments: { control: 4, break: 3, stamina: 4 } },
  },
  taoyuan: {
    CF: { adjustments: { contact: 6, speed: 5, stealing: 4 }, performance: { avg: .291, obp: .342, slg: .421, ops: .763 } },
    RF: { adjustments: { power: 7, clutch: 4 } },
    "3B": { adjustments: { power: 7, contact: 3 } },
    "1B": { adjustments: { power: 8, contact: 3 } },
    LF: { adjustments: { contact: 3, speed: 4 } },
    "2B": { adjustments: { contact: 5, vision: 4, fielding: 3 } },
    SS: { adjustments: { fielding: 5, reaction: 4, speed: 2 } },
    C: { adjustments: { power: 8, armStrength: 3, blocking: 3 } },
    P: { adjustments: { control: 4, break: 5, stamina: 3 } },
  },
  chiayi: {
    CF: { adjustments: { contact: 4, speed: 5 } },
    RF: { adjustments: { contact: 4, power: 5, clutch: 4 } },
    "3B": { adjustments: { power: 6, armStrength: 3 } },
    "1B": { adjustments: { power: 10, contact: 2, clutch: 5 } },
    LF: { adjustments: { contact: 7, speed: 3 }, performance: { avg: .286, obp: .344, slg: .389, ops: .733 } },
    "2B": { adjustments: { contact: 5, vision: 4, discipline: 3 } },
    SS: { adjustments: { contact: 8, speed: 3, fielding: 3 }, performance: { avg: .299, obp: .367, slg: .386, ops: .753 } },
    C: { adjustments: { blocking: 5, armStrength: 4 } },
    P: { adjustments: { velocity: 4, control: 3, break: 3, stamina: 5 } },
  },
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

const BUILD_POINT_BUDGET = 36;
const BUILD_STARTING_OVERALL = 60;
const BUILDER_GROUPS = [
  {
    key: "batting",
    label: "打擊",
    rows: [
      ["contact", "擊球能力"], ["contactL", "對左投擊球"], ["contactR", "對右投擊球"],
      ["power", "長打力量"], ["powerL", "對左投長打"], ["powerR", "對右投長打"],
      ["vision", "擊球視野"], ["discipline", "選球能力"], ["clutch", "關鍵打擊"],
      ["bunt", "短打能力"], ["dragBunt", "拖曳短打"],
    ],
  },
  {
    key: "running",
    label: "跑壘",
    rows: [["speed", "跑壘速度"], ["stealing", "盜壘能力"]],
  },
  {
    key: "fielding",
    label: "守備",
    rows: [["fielding", "守備範圍"], ["reaction", "反應速度"], ["armStrength", "臂力"], ["armAccuracy", "傳球準確度"], ["blocking", "擋球能力"]],
  },
  {
    key: "pitching",
    label: "投球",
    rows: [["velocity", "球速"], ["control", "投球控球"], ["break", "變化球"], ["stamina", "投手體力"]],
  },
];

const PLAYER_BUILD_TEMPLATES = [
  { id: "balanced", label: "五工具球員", role: "全能成長", detail: "打擊、跑壘、守備都不偏科", positions: "field", focus: ["contact", "power", "speed", "fielding"], adjustments: CUSTOM_ARCHETYPES.balanced.adjustments },
  { id: "contact", label: "擊球串聯", role: "高上壘打者", detail: "專注擊球、選球與跑壘壓力", positions: "field", focus: ["contact", "vision", "discipline", "speed"], adjustments: { contact: 11, power: -5, vision: 8, discipline: 8, clutch: 5, speed: 5, stealing: 5, bunt: 8, dragBunt: 7, fielding: 1 } },
  { id: "slugger", label: "長打砲", role: "中心打者", detail: "用力量與關鍵打擊改變比分", positions: "field", focus: ["power", "powerL", "powerR", "clutch"], adjustments: CUSTOM_ARCHETYPES.slugger.adjustments },
  { id: "speedster", label: "飛毛腿跑者", role: "速度跑者", detail: "速度、盜壘與短打製造機會", positions: "field", focus: ["speed", "stealing", "bunt", "dragBunt"], adjustments: CUSTOM_ARCHETYPES.speedster.adjustments },
  { id: "defender", label: "守備魔術師", role: "守備核心", detail: "範圍、反應與傳球穩定可靠", positions: "field", focus: ["fielding", "reaction", "armStrength", "armAccuracy"], adjustments: CUSTOM_ARCHETYPES.defender.adjustments },
  { id: "catcher-captain", label: "配球指揮官", role: "主戰捕手", detail: "擋球、臂力與關鍵時刻的領導力", positions: ["C"], focus: ["blocking", "armStrength", "armAccuracy", "clutch"], adjustments: { contact: 1, power: 1, discipline: 6, clutch: 9, speed: -4, stealing: -6, fielding: 8, reaction: 6, armStrength: 11, armAccuracy: 9, blocking: 16 } },
  { id: "pitcher-control", label: "控球王牌", role: "精準先發", detail: "控球、變化球與吃局能力優先", positions: ["P"], focus: ["control", "break", "stamina", "clutch"], adjustments: CUSTOM_ARCHETYPES.pitcher.adjustments },
  { id: "pitcher-flame", label: "火球強投", role: "三振型先發", detail: "球速與三振威脅拉到最高", positions: ["P"], focus: ["velocity", "break", "stamina"], adjustments: { contact: -9, power: -8, speed: -5, fielding: 2, reaction: 2, velocity: 17, control: -2, break: 10, stamina: 9, clutch: 7 } },
  { id: "pitcher-break", label: "變化球大師", role: "球路型投手", detail: "用球路位移與控球讓打者失去節奏", positions: ["P"], focus: ["break", "control", "clutch"], adjustments: { contact: -8, power: -7, speed: -4, fielding: 2, velocity: 6, control: 9, break: 17, stamina: 8, clutch: 8 } },
];

function templatesForPosition(position) {
  return PLAYER_BUILD_TEMPLATES.filter((template) => template.positions === "field" ? position !== "P" : template.positions.includes(position));
}

function templateForPosition(position, templateId = "") {
  const available = templatesForPosition(position);
  const requested = String(templateId || "");
  return available.find((template) => template.id === requested)
    || available.find((template) => template.label === requested)
    || (position === "P" ? available.find((template) => template.id === "pitcher-control") : available[0])
    || PLAYER_BUILD_TEMPLATES[0];
}

function builderCapFor(position, template, key) {
  const pitchingKeys = ["velocity", "control", "break", "stamina"];
  const fieldingKeys = ["fielding", "reaction", "armStrength", "armAccuracy", "blocking"];
  let cap = 92;
  if (template.focus.includes(key)) cap = 99;
  if (position === "P" && !pitchingKeys.includes(key) && key !== "clutch") cap = 80;
  if (position !== "P" && pitchingKeys.includes(key)) cap = 76;
  if (position === "C" && key === "blocking") cap = 99;
  if (position !== "C" && key === "blocking") cap = 82;
  if (fieldingKeys.includes(key) && template.id === "slugger") cap = Math.min(cap, 88);
  return cap;
}

const OVERALL_WEIGHTS_BY_POSITION = {
  P: { velocity: .22, control: .23, break: .22, stamina: .18, clutch: .15 },
  C: { contact: .22, power: .18, fielding: .20, armStrength: .17, blocking: .23 },
  "1B": { contact: .25, power: .30, clutch: .18, discipline: .12, fielding: .15 },
  "2B": { contact: .24, speed: .16, fielding: .24, reaction: .22, armAccuracy: .14 },
  "3B": { contact: .24, power: .25, fielding: .18, armStrength: .17, reaction: .16 },
  SS: { contact: .18, speed: .20, fielding: .25, reaction: .22, armAccuracy: .15 },
  LF: { contact: .24, power: .28, speed: .14, fielding: .16, reaction: .18 },
  CF: { contact: .22, speed: .23, fielding: .23, reaction: .20, power: .12 },
  RF: { contact: .22, power: .28, armStrength: .18, fielding: .16, reaction: .16 },
};
const OVERALL_STAR_THRESHOLD = 78;
const OVERALL_STAR_CURVE = .18;

function overallWeightsFor(position) {
  return OVERALL_WEIGHTS_BY_POSITION[position] || OVERALL_WEIGHTS_BY_POSITION.CF;
}

function weightedOverallFor(position, ratings) {
  return Object.entries(overallWeightsFor(position)).reduce((sum, [key, weight]) => sum + Number(ratings?.[key] || 0) * weight, 0);
}

function builderOverallKeys(position) {
  return Object.keys(overallWeightsFor(position));
}

function normalizeBuilderOverall(position, ratings, template) {
  const keys = builderOverallKeys(position);
  let guard = 0;
  while (Math.round(weightedOverallFor(position, ratings)) !== BUILD_STARTING_OVERALL && guard < 800) {
    const current = weightedOverallFor(position, ratings);
    const direction = current < BUILD_STARTING_OVERALL ? 1 : -1;
    const candidates = keys.filter((key) => direction > 0
      ? Number(ratings[key] || 0) < builderCapFor(position, template, key)
      : Number(ratings[key] || 0) > 20);
    if (!candidates.length) break;
    candidates.sort((a, b) => {
      const aNext = current + direction * Number(overallWeightsFor(position)[a] || 0);
      const bNext = current + direction * Number(overallWeightsFor(position)[b] || 0);
      const aDistance = Math.abs(BUILD_STARTING_OVERALL - aNext);
      const bDistance = Math.abs(BUILD_STARTING_OVERALL - bNext);
      if (aDistance !== bDistance) return aDistance - bDistance;
      const aFocus = template.focus.includes(a) ? 1 : 0;
      const bFocus = template.focus.includes(b) ? 1 : 0;
      if (aFocus !== bFocus) return direction > 0 ? bFocus - aFocus : aFocus - bFocus;
      return direction > 0 ? Number(ratings[a] || 0) - Number(ratings[b] || 0) : Number(ratings[b] || 0) - Number(ratings[a] || 0);
    });
    const key = candidates[0];
    ratings[key] = Number(ratings[key] || 0) + direction;
    guard += 1;
  }
  return ratings;
}

function splitBuilderRatings(ratings, bats) {
  ratings.contactL = Math.max(20, Math.min(99, Number(ratings.contact || 50) + (bats === "左" ? 3 : 0)));
  ratings.contactR = Math.max(20, Math.min(99, Number(ratings.contact || 50) + (bats === "右" ? 3 : 0)));
  ratings.powerL = Math.max(20, Math.min(99, Number(ratings.power || 50) + (bats === "左" ? 3 : 0)));
  ratings.powerR = Math.max(20, Math.min(99, Number(ratings.power || 50) + (bats === "右" ? 3 : 0)));
  return ratings;
}

function buildTemplateRatings(position, teamId, bats, templateId) {
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const team = TEAM_BY_ID[teamId] || TEAM_BY_ID[DEFAULT_TEAM_ID];
  const template = templateForPosition(position, templateId);
  const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
    if (key === "popTime") return [key, value];
    const adjusted = Number(value) + Number(team.bonus[key] || 0) + Number(template.adjustments[key] || 0);
    return [key, Math.max(20, Math.min(builderCapFor(position, template, key), Math.round(adjusted)))];
  }));
  normalizeBuilderOverall(position, ratings, template);
  return splitBuilderRatings(ratings, bats);
}

function buildTeamRoster(team, teamIndex) {
  const names = TEAM_PLAYER_NAMES[team.id] || [];
  return ROSTER_BLUEPRINTS.map((blueprint, playerIndex) => {
    const profile = CPBL_PLAYER_PROFILES[team.id]?.[blueprint.position] || {};
    const playerAdjustments = profile.adjustments || {};
    const variance = ((teamIndex * 5 + playerIndex * 3) % 7) - 3;
    const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
      const bonus = (team.bonus[key] || 0) + (playerAdjustments[key] || 0);
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
      starting: true,
      isOfficial: true,
      dataSource: `CPBL ${CPBL_SEASON_YEAR} · ${CPBL_DATA_SNAPSHOT}`,
      performance: profile.performance || null,
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

const CPBL_SEASON_START_DATE = new Date(Date.UTC(CPBL_SEASON_YEAR, 2, 28));
const CPBL_SEASON_END_DATE = new Date(Date.UTC(CPBL_SEASON_YEAR, 9, 31));

function formatSeasonDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function seasonDateForMatchday(matchdayIndex) {
  const matchdays = CPBL_TOTAL_SEASON_GAMES / (TEAM_DEFS.length / 2);
  const ratio = matchdays <= 1 ? 0 : matchdayIndex / (matchdays - 1);
  const timestamp = CPBL_SEASON_START_DATE.getTime() + (CPBL_SEASON_END_DATE.getTime() - CPBL_SEASON_START_DATE.getTime()) * ratio;
  return formatSeasonDate(new Date(timestamp));
}

function roundRobinRounds(teamIds) {
  const circle = teamIds.slice();
  const rounds = [];
  for (let round = 0; round < circle.length - 1; round += 1) {
    const games = [];
    for (let pair = 0; pair < circle.length / 2; pair += 1) {
      const first = circle[pair];
      const second = circle[circle.length - 1 - pair];
      const homeFirst = (round + pair) % 2 === 0;
      games.push({ homeTeamId: homeFirst ? first : second, awayTeamId: homeFirst ? second : first });
    }
    rounds.push(games);
    circle.splice(1, 0, circle.pop());
  }
  return rounds;
}

function createSeasonSchedule() {
  const rounds = roundRobinRounds(TEAM_DEFS.map((team) => team.id));
  const games = [];
  let gameNo = 1;
  for (let cycle = 0; cycle < CPBL_TOTAL_SEASON_GAMES / (TEAM_DEFS.length * (TEAM_DEFS.length - 1) / 2); cycle += 1) {
    rounds.forEach((roundGames, roundIndex) => {
      const matchdayIndex = cycle * rounds.length + roundIndex;
      roundGames.forEach(({ homeTeamId, awayTeamId }, pairIndex) => {
        const alternatingHome = (cycle + roundIndex + pairIndex) % 2 === 0;
        const finalHomeTeamId = alternatingHome ? homeTeamId : awayTeamId;
        const finalAwayTeamId = alternatingHome ? awayTeamId : homeTeamId;
        games.push({
          id: `${CPBL_SEASON_YEAR}-${String(gameNo).padStart(3, "0")}`,
          gameNo,
          date: seasonDateForMatchday(matchdayIndex),
          half: matchdayIndex < rounds.length * 12 ? "上半季" : "下半季",
          homeTeamId: finalHomeTeamId,
          awayTeamId: finalAwayTeamId,
          stadium: TEAM_BY_ID[finalHomeTeamId]?.stadium || "主場球場",
          status: "scheduled",
        });
        gameNo += 1;
      });
    });
  }
  return games;
}

const SEASON_SCHEDULE = createSeasonSchedule();

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

function careerDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCustomPlayer(raw, index = 0) {
  const source = raw && typeof raw === "object" ? raw : {};
  const position = POSITION_BY_CODE[source.position] ? source.position : "CF";
  const teamId = TEAM_BY_ID[source.teamId] ? source.teamId : DEFAULT_TEAM_ID;
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const incomingBuilder = source.builder && typeof source.builder === "object" ? source.builder : {};
  const buildTemplate = templateForPosition(position, incomingBuilder.templateId || source.templateId || source.archetype);
  const rawRatings = source.ratings && typeof source.ratings === "object" ? source.ratings : {};
  const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
    const candidate = Number(rawRatings[key]);
    if (key === "popTime") return [key, Number.isFinite(candidate) ? Math.max(1.78, Math.min(2.3, candidate)) : value];
    return [key, Number.isFinite(candidate) ? Math.max(20, Math.min(99, candidate)) : value];
  }));
  ratings.contactL = Math.max(20, Math.min(99, Number(rawRatings.contactL || ratings.contact)));
  ratings.contactR = Math.max(20, Math.min(99, Number(rawRatings.contactR || ratings.contact)));
  ratings.powerL = Math.max(20, Math.min(99, Number(rawRatings.powerL || ratings.power)));
  ratings.powerR = Math.max(20, Math.min(99, Number(rawRatings.powerR || ratings.power)));
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
    archetype: String(source.archetype || buildTemplate.label || "自訂全能").slice(0, 18),
    builder: {
      version: 1,
      templateId: buildTemplate.id,
      templateLabel: buildTemplate.label,
      pointBudget: BUILD_POINT_BUDGET,
      caps: Object.fromEntries(Object.keys(blueprint.ratings).filter((key) => key !== "popTime").map((key) => [key, builderCapFor(position, buildTemplate, key)])),
      migrated: !incomingBuilder.version,
    },
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
function normalizeScheduleStore(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    seasonYear: CPBL_SEASON_YEAR,
    completed: source.seasonYear === CPBL_SEASON_YEAR && source.completed && typeof source.completed === "object" ? source.completed : {},
  };
}
let scheduleStore = normalizeScheduleStore(readStorage(SCHEDULE_STORAGE_KEY, {}));
const initialCustomPlayer = customPlayers.slice().reverse().find((player) => player.active !== false) || null;
let selectedTeamId = DEFAULT_TEAM_ID;
let selectedOpponentId = DEFAULT_OPPONENT_ID;
let developmentTeamId = initialCustomPlayer?.teamId || DEFAULT_TEAM_ID;
let selectedAthleteId = initialCustomPlayer?.id || `${DEFAULT_TEAM_ID}-cf`;
let selectedCustomPlayerId = initialCustomPlayer?.id || "";
let careerStatus = "建立自創球員後，就能進入單人訓練場。";
let careerStatusTone = "";
let scheduleStatus = "完整 360 場賽季已建立；每支球隊各 120 場，進度保存在這個瀏覽器。";
let builderDraft = null;

const BUILDER_LABEL_BY_KEY = Object.fromEntries(BUILDER_GROUPS.flatMap((group) => group.rows).map(([key, label]) => [key, label]));

function createBuilderDraft(position, teamId, bats, templateId) {
  const template = templateForPosition(position, templateId);
  const baseRatings = buildTemplateRatings(position, teamId, bats, template.id);
  return {
    position,
    teamId,
    bats,
    templateId: template.id,
    baseRatings,
    ratings: { ...baseRatings },
    pointsSpent: 0,
  };
}

function builderDraftFromForm() {
  const position = $("custom-player-position")?.value || "CF";
  const teamId = $("custom-player-team")?.value || selectedTeamId;
  const bats = $("custom-player-bats")?.value || "右";
  const templateId = $("custom-player-archetype")?.value || templateForPosition(position).id;
  if (!builderDraft || builderDraft.position !== position || builderDraft.teamId !== teamId || builderDraft.bats !== bats || builderDraft.templateId !== templateForPosition(position, templateId).id) {
    builderDraft = createBuilderDraft(position, teamId, bats, templateId);
  }
  return builderDraft;
}

function builderUpgradeCost(value) {
  if (Number(value) >= 90) return 3;
  if (Number(value) >= 80) return 2;
  return 1;
}

function builderRemainingPoints(draft) {
  return BUILD_POINT_BUDGET - Number(draft?.pointsSpent || 0);
}

function builderAdjustRating(key, direction) {
  const draft = builderDraftFromForm();
  const template = templateForPosition(draft.position, draft.templateId);
  const current = Number(draft.ratings[key] || 0);
  const next = current + (direction > 0 ? 1 : -1);
  const cap = builderCapFor(draft.position, template, key);
  if (next < 20 || next > cap) return;
  const cost = direction > 0 ? builderUpgradeCost(current) : builderUpgradeCost(next);
  const nextSpent = draft.pointsSpent + (direction > 0 ? cost : -cost);
  if (direction > 0 && nextSpent > BUILD_POINT_BUDGET) return;
  draft.ratings[key] = next;
  draft.pointsSpent = nextSpent;
  if (["contact", "power"].includes(key)) splitBuilderRatings(draft.ratings, draft.bats);
  renderBuilder();
}

function builderStrengths(draft) {
  const rows = BUILDER_GROUPS.flatMap((group) => group.rows).filter(([key]) => !["contactL", "contactR", "powerL", "powerR"].includes(key));
  const sorted = rows.map(([key, label]) => ({ key, label, value: Number(draft.ratings[key] || 0) })).sort((a, b) => b.value - a.value);
  return {
    strengths: sorted.slice(0, 3).map((item) => `${item.label} ${item.value}`),
    weaknesses: sorted.slice(-3).reverse().map((item) => `${item.label} ${item.value}`),
  };
}

function renderBuilder() {
  const panel = $("builder-panel");
  if (!panel) return;
  const draft = builderDraftFromForm();
  const template = templateForPosition(draft.position, draft.templateId);
  const remaining = builderRemainingPoints(draft);
  const { strengths, weaknesses } = builderStrengths(draft);
  const overall = overallForPlayer({ position: draft.position, ratings: draft.ratings });
  const templateSelect = $("custom-player-archetype");
  if (templateSelect) templateSelect.value = template.id;
  const templateCopy = $("builder-template-copy");
  const points = $("builder-points");
  const overallEl = $("builder-overall");
  const strengthsEl = $("builder-strengths");
  const weaknessesEl = $("builder-weaknesses");
  const capNote = $("builder-cap-note");
  if (templateCopy) templateCopy.textContent = `${template.label} · ${template.detail}`;
  if (points) points.textContent = `可用建造點 ${remaining} / ${BUILD_POINT_BUDGET}`;
  if (overallEl) overallEl.textContent = overall;
  if (strengthsEl) strengthsEl.textContent = strengths.join(" · ");
  if (weaknessesEl) weaknessesEl.textContent = weaknesses.join(" · ");
  if (capNote) capNote.textContent = `初始總評統一為 ${BUILD_STARTING_OVERALL}；OVR 會依位置權重計算，模板重點：${template.focus.map((key) => BUILDER_LABEL_BY_KEY[key] || key).join("、")}；能力上限會依位置與模板改變。`;
  const templateGrid = $("builder-template-grid");
  if (templateGrid) {
    templateGrid.innerHTML = templatesForPosition(draft.position).map((candidate) => `<button type="button" class="builder-template-choice ${candidate.id === template.id ? "is-selected" : ""}" data-builder-template="${candidate.id}"><b>${candidate.label}</b><small>${candidate.role}</small><span>${candidate.detail}</span></button>`).join("");
  }
  const attributes = $("builder-attributes");
  if (!attributes) return;
  attributes.innerHTML = BUILDER_GROUPS.map((group) => `<section class="builder-attribute-group"><div class="builder-group-heading"><h4>${group.label}</h4><span>${group.rows.filter(([key]) => template.focus.includes(key)).length} 項重點</span></div>${group.rows.map(([key, label]) => {
    const value = Number(draft.ratings[key] || 0);
    const cap = builderCapFor(draft.position, template, key);
    const plusCost = builderUpgradeCost(value);
    const plusDisabled = value >= cap || remaining < plusCost;
    const isFocus = template.focus.includes(key);
    return `<div class="builder-attribute-row ${isFocus ? "is-focus" : ""}"><div class="builder-attribute-name"><b>${label}</b>${isFocus ? "<small>模板重點</small>" : ""}</div><button type="button" class="builder-adjust" data-builder-key="${key}" data-builder-adjust="-1" aria-label="降低${label}">−</button><strong>${value}</strong><button type="button" class="builder-adjust" data-builder-key="${key}" data-builder-adjust="1" ${plusDisabled ? "disabled" : ""} aria-label="提升${label}">＋</button><span class="builder-cap">/${cap}</span><i><b style="width:${Math.min(100, Math.round((value / cap) * 100))}%"></b></i></div>`;
  }).join("")}</section>`).join("");
}

function createCareerProfile(player) {
  return {
    level: 1,
    xp: 0,
    trainingPoints: 6,
    fatigue: 0,
    morale: 72,
    boosts: Object.fromEntries(Object.keys(player.ratings).map((key) => [key, 0])),
    unlockedPerks: [],
    practiceDay: careerDayKey(),
    practiceSessions: PRACTICE_SESSIONS_PER_DAY,
    practiceScore: 0,
    lastPractice: "",
    developmentPath: "balanced",
    goalIndex: 0,
    goalProgress: 0,
    lastGrade: 0,
    recentMatches: [],
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
  const today = careerDayKey();
  if (profile.practiceDay !== today) {
    profile.practiceDay = today;
    profile.practiceSessions = PRACTICE_SESSIONS_PER_DAY;
  }
  profile.practiceSessions = clamp(Number(profile.practiceSessions ?? PRACTICE_SESSIONS_PER_DAY), 0, PRACTICE_SESSIONS_PER_DAY);
  profile.practiceScore = Math.max(0, Number(profile.practiceScore || 0));
  profile.lastPractice = String(profile.lastPractice || "");
  profile.developmentPath = DEVELOPMENT_PATHS[profile.developmentPath] ? profile.developmentPath : "balanced";
  profile.goalIndex = clamp(Number(profile.goalIndex || 0), 0, CAREER_GOALS.length - 1);
  profile.goalProgress = Math.max(0, Number(profile.goalProgress || 0));
  profile.lastGrade = clamp(Number(profile.lastGrade || 0), 0, 99);
  profile.recentMatches = Array.isArray(profile.recentMatches) ? profile.recentMatches.slice(0, 5) : [];
  return profile;
}

function overallForPlayer(player) {
  const ratings = player.ratings || player;
  const weighted = weightedOverallFor(player.position, ratings);
  const starCurve = Math.max(0, weighted - OVERALL_STAR_THRESHOLD) * OVERALL_STAR_CURVE;
  return Math.round(weighted + starCurve);
}

function developedPlayerFromProfile(base, profile) {
  if (!base) return null;
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

function developedPlayer(playerId) {
  const base = playerDefinitionFor(playerId);
  if (!base) return null;
  return developedPlayerFromProfile(base, profileFor(playerId));
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
  const teamId = state?.teamId || selectedTeamId;
  const roster = rosterForTeam(teamId);
  return (roster.length ? roster : []).map((player) => matchPlayerForPosition(player.position, teamId) || developedPlayer(player.id));
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
  hitting: { title: "打擊訓練", detail: "擊球能力 +1 · 擊球視野 +1", cost: 1, xp: 42, gains: { contact: 1, vision: 1 } },
  power: { title: "力量訓練", detail: "長打力量 +1 · 關鍵打擊 +1", cost: 1, xp: 42, gains: { power: 1, clutch: 1 } },
  defense: { title: "守備訓練", detail: "守備範圍 +1 · 反應速度 +1", cost: 1, xp: 42, gains: { fielding: 1, reaction: 1 } },
  speed: { title: "跑壘訓練", detail: "跑壘速度 +1 · 盜壘能力 +1", cost: 1, xp: 38, gains: { speed: 1, stealing: 1 } },
  pitching: { title: "投球訓練", detail: "投球控球 +1 · 變化球 +1", cost: 1, xp: 44, gains: { control: 1, break: 1 } },
  recovery: { title: "恢復訓練", detail: "疲勞 -20 · 士氣 +5", cost: 0, xp: 18, gains: {} },
};

const PRACTICE_META = {
  hitting: { title: "打擊挑戰", detail: "擊球能力 · 擊球視野 · 關鍵打擊", xp: 28, focus: ["contact", "vision", "clutch"] },
  defense: { title: "守備反應", detail: "守備範圍 · 反應速度 · 傳球", xp: 27, focus: ["fielding", "reaction", "armAccuracy"] },
  pitching: { title: "投球控制", detail: "投球控球 · 變化球 · 體力", xp: 30, focus: ["control", "break", "stamina"] },
  speed: { title: "跑壘判斷", detail: "跑壘速度 · 盜壘 · 短打", xp: 25, focus: ["speed", "stealing", "bunt"] },
};

const DEVELOPMENT_PATHS = {
  balanced: { label: "全能養成", short: "均衡", detail: "每個位置都穩定成長", training: "hitting", keys: ["contact", "fielding", "speed"] },
  contact: { label: "上壘核心", short: "選球", detail: "擊球、視野與選球", training: "hitting", keys: ["contact", "vision", "discipline"] },
  power: { label: "長打核心", short: "長打", detail: "力量與關鍵打擊", training: "hitting", keys: ["power", "clutch", "contact"] },
  defense: { label: "守備核心", short: "守備", detail: "範圍、反應與傳球", training: "defense", keys: ["fielding", "reaction", "armAccuracy"] },
  speed: { label: "速度核心", short: "跑壘", detail: "速度、盜壘與短打", training: "speed", keys: ["speed", "stealing", "bunt"] },
  pitching: { label: "王牌投手", short: "投球", detail: "控球、球路與體力", training: "pitching", keys: ["control", "break", "stamina"] },
};

const CAREER_GOALS = [
  { label: "完成 3 次訓練", detail: "把今天的訓練次數用在成長上。", kind: "practice", target: 3 },
  { label: "完成 1 場比賽", detail: "把訓練成果帶進真正的比賽。", kind: "match", target: 1 },
  { label: "訓練拿到 85 分", detail: "專注完成一次高品質訓練。", kind: "score", target: 1 },
  { label: "累積 120 XP", detail: "持續投入，解鎖下一個等級。", kind: "xp", target: 120 },
];

function developmentPathFor(pathId) {
  return DEVELOPMENT_PATHS[pathId] || DEVELOPMENT_PATHS.balanced;
}

function activeCareerGoal(profile) {
  const index = clamp(Number(profile?.goalIndex || 0), 0, CAREER_GOALS.length - 1);
  return CAREER_GOALS[index] || CAREER_GOALS[0];
}

function advanceCareerGoal(profile, kind, value = 1) {
  if (!profile) return "";
  const goal = activeCareerGoal(profile);
  let progress = Number(profile.goalProgress || 0);
  if (goal.kind === "practice" && kind === "practice") progress += 1;
  if (goal.kind === "match" && kind === "match") progress += 1;
  if (goal.kind === "score" && kind === "score" && Number(value) >= 85) progress += 1;
  if (goal.kind === "xp" && kind === "xp") progress += Number(value || 0);
  profile.goalProgress = Math.min(goal.target, progress);
  if (profile.goalProgress < goal.target) return "";
  const completed = goal.label;
  profile.goalIndex = (Number(profile.goalIndex || 0) + 1) % CAREER_GOALS.length;
  profile.goalProgress = 0;
  profile.trainingPoints = Math.min(12, Number(profile.trainingPoints || 0) + 1);
  return `完成目標「${completed}」，獲得 1 訓練點`;
}

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

function serializeCareerProfile(profile) {
  return {
    level: clamp(Number(profile?.level || 1), 1, 99),
    xp: Math.max(0, Number(profile?.xp || 0)),
    trainingPoints: clamp(Number(profile?.trainingPoints || 0), 0, 12),
    fatigue: clamp(Number(profile?.fatigue || 0), 0, 100),
    morale: clamp(Number(profile?.morale || 72), 0, 99),
    developmentPath: DEVELOPMENT_PATHS[profile?.developmentPath] ? profile.developmentPath : "balanced",
    goalIndex: clamp(Number(profile?.goalIndex || 0), 0, CAREER_GOALS.length - 1),
    goalProgress: Math.max(0, Number(profile?.goalProgress || 0)),
    lastGrade: clamp(Number(profile?.lastGrade || 0), 0, 99),
    recentMatches: Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice(0, 5) : [],
    boosts: Object.fromEntries(Object.entries(profile?.boosts || {}).map(([key, value]) => [key, clamp(Number(value || 0), 0, MAX_NETWORK_BOOST)])),
    unlockedPerks: Array.isArray(profile?.unlockedPerks) ? profile.unlockedPerks.slice(0, 12).map((perk) => String(perk).slice(0, 24)) : [],
  };
}

function networkPlayerSnapshotFor(player) {
  if (!player?.isCustom) return null;
  const basePlayer = clone(player);
  delete basePlayer.stats;
  delete basePlayer.active;
  return {
    player: basePlayer,
    profile: serializeCareerProfile(profileFor(player.id)),
  };
}

function normalizeNetworkPlayerSnapshot(raw, teamId = state?.teamId || selectedTeamId, position = "") {
  if (!raw || typeof raw !== "object" || !raw.player || raw.player.isCustom !== true) return null;
  const player = normalizeCustomPlayer(raw.player);
  if (!player.isCustom || (position && player.position !== position)) return null;
  if (TEAM_BY_ID[teamId]) player.teamId = teamId;
  const baseProfile = createCareerProfile(player);
  const incomingProfile = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const profile = {
    ...baseProfile,
    level: clamp(Number(incomingProfile.level || 1), 1, 99),
    xp: Math.max(0, Number(incomingProfile.xp || 0)),
    trainingPoints: clamp(Number(incomingProfile.trainingPoints || 0), 0, 12),
    fatigue: clamp(Number(incomingProfile.fatigue || 0), 0, 100),
    morale: clamp(Number(incomingProfile.morale || 72), 0, 99),
    developmentPath: DEVELOPMENT_PATHS[incomingProfile.developmentPath] ? incomingProfile.developmentPath : "balanced",
    goalIndex: clamp(Number(incomingProfile.goalIndex || 0), 0, CAREER_GOALS.length - 1),
    goalProgress: Math.max(0, Number(incomingProfile.goalProgress || 0)),
    lastGrade: clamp(Number(incomingProfile.lastGrade || 0), 0, 99),
    recentMatches: Array.isArray(incomingProfile.recentMatches) ? incomingProfile.recentMatches.slice(0, 5) : [],
    boosts: Object.fromEntries(Object.keys(player.ratings).map((key) => [key, clamp(Number(incomingProfile.boosts?.[key] || 0), 0, MAX_NETWORK_BOOST)])),
    unlockedPerks: Array.isArray(incomingProfile.unlockedPerks) ? incomingProfile.unlockedPerks.slice(0, 12).map((perk) => String(perk).slice(0, 24)) : [],
  };
  return { player, profile };
}

function developedNetworkPlayer(snapshot) {
  if (!snapshot?.player) return null;
  return developedPlayerFromProfile(snapshot.player, snapshot.profile);
}

function matchPlayerForPosition(position, teamId = state?.teamId || selectedTeamId) {
  if (teamId === state?.teamId) {
    const networkPlayer = developedNetworkPlayer(state?.slots?.[position]?.playerSnapshot);
    if (networkPlayer) return networkPlayer;
  }
  return playerForPosition(position, teamId);
}

function customPlayerForNetworkPosition(position, teamId = state?.teamId || selectedTeamId) {
  const selected = customPlayerIndex[selectedCustomPlayerId];
  if (selected?.teamId === teamId && selected.position === position) return selected;
  return activeCustomPlayerForPosition(teamId, position);
}

function networkPayloadForPosition(position, teamId = state?.teamId || selectedTeamId) {
  return networkPlayerSnapshotFor(customPlayerForNetworkPosition(position, teamId));
}

function selectedCareerPlayer() {
  const selected = customPlayerIndex[selectedCustomPlayerId];
  const fallback = customPlayers.slice().reverse().find((player) => player.active !== false) || customPlayers[customPlayers.length - 1];
  const player = selected || fallback;
  return player ? developedPlayer(player.id) : null;
}

function setCareerStatus(message, tone = "") {
  careerStatus = String(message || "");
  careerStatusTone = tone;
  const status = $("career-mode-status");
  if (status) {
    status.textContent = careerStatus;
    status.className = `career-mode-status ${careerStatusTone}`.trim();
  }
}

function runPracticeDrill(drillType) {
  const player = selectedCareerPlayer();
  const meta = PRACTICE_META[drillType];
  if (!player || !meta) {
    setCareerStatus("先建立一名自創球員，才能進入個人訓練。", "is-error");
    return;
  }
  if (network.role !== "solo") {
    setCareerStatus("單人訓練需要離開多人房間；你的生涯資料不會因此遺失。", "is-error");
    return;
  }
  if (!(state.phase === "pre" || state.phase === "gameover")) {
    setCareerStatus("比賽進行中，請先完成這場比賽再進入訓練。", "is-error");
    return;
  }
  const profile = profileFor(player.id);
  if (profile.practiceSessions <= 0) {
    setCareerStatus("今天的訓練次數已用完；明天會自動恢復。", "is-error");
    return;
  }
  const focusAverage = meta.focus.reduce((sum, key) => sum + Number(player.ratings[key] || 50), 0) / meta.focus.length;
  const score = clamp(Math.round(focusAverage + (Math.random() * 18 - 9)), 35, 99);
  const bonusXp = Math.max(0, Math.round((score - 70) / 8));
  const path = developmentPathFor(profile.developmentPath);
  const pathBonus = path.training === drillType ? 8 : 0;
  profile.practiceSessions -= 1;
  profile.practiceScore += score;
  profile.lastPractice = `${meta.title} · ${score} 分`;
  profile.lastGrade = score;
  const previousLevel = profile.level;
  const earnedXp = meta.xp + bonusXp + pathBonus;
  const levels = awardCareerXp(profile, earnedXp);
  profile.trainingPoints = Math.min(12, profile.trainingPoints + (score >= 86 ? 1 : 0));
  profile.fatigue = Math.min(100, profile.fatigue + 5);
  profile.morale = Math.min(99, profile.morale + (score >= 80 ? 2 : 0));
  const practiceGoal = activeCareerGoal(profile);
  const goalValue = practiceGoal.kind === "score" ? score : practiceGoal.kind === "xp" ? earnedXp : 1;
  const goalMessage = advanceCareerGoal(profile, practiceGoal.kind, goalValue);
  persistCustomPlayers();
  const levelText = levels ? `，升到 Lv.${profile.level}` : "";
  const pathText = pathBonus ? `；符合${path.label}，額外 +${pathBonus} XP` : "";
  const goalText = goalMessage ? `；${goalMessage}` : "";
  setCareerStatus(`${player.name} 完成${meta.title}，評分 ${score}；獲得 ${earnedXp} XP${pathText}${levelText}${goalText}。`);
  if (previousLevel !== profile.level || score >= 90) flashCard("celebrate");
  render();
}

function selectDevelopmentPath(pathId) {
  const player = selectedCareerPlayer();
  const path = developmentPathFor(pathId);
  if (!player) {
    setCareerStatus("先建立一名自創球員，才能選擇發展路線。", "is-error");
    render();
    return;
  }
  const profile = profileFor(player.id);
  profile.developmentPath = DEVELOPMENT_PATHS[pathId] ? pathId : "balanced";
  persistCustomPlayers();
  setCareerStatus(`${player.name} 已改走「${path.label}」；符合路線的訓練會額外獲得 XP。`);
  render();
}

function startPracticeGame() {
  const player = selectedCareerPlayer();
  if (!player) {
    setCareerStatus("先建立一名自創球員，才能開始球員生涯練習賽。", "is-error");
    return;
  }
  if (network.role !== "solo") {
    setCareerStatus("練習賽是你的單人內容；請先離開多人房間。", "is-error");
    return;
  }
  if (!(state.phase === "pre" || state.phase === "gameover")) {
    setCareerStatus("目前已有比賽進行中，完成後才能開始下一場練習賽。", "is-error");
    return;
  }
  const opponentId = chooseOpponentFor(player.teamId, selectedOpponentId);
  if (state.teamId !== player.teamId || state.opponentId !== opponentId) replaceMatchTeams(player.teamId, opponentId, false);
  selectedTeamId = player.teamId;
  selectedOpponentId = opponentId;
  developmentTeamId = player.teamId;
  selectedAthleteId = player.id;
  claimLocalPosition(player.position, false);
  setCareerStatus(`${player.name} 已進入單人練習賽，隊友與對手由免費 NPC 補位。`);
  startGame("practice");
}

function startScheduledGame() {
  if (network.role === "guest") {
    if (!network.connected) {
      scheduleStatus = "請先連上房間，才能請房主開始多人賽程。";
      renderDevelopment();
      return;
    }
    if (!(state.phase === "pre" || state.phase === "gameover")) {
      scheduleStatus = "目前已有比賽進行中，完成後才能開始下一場賽季賽。";
      renderDevelopment();
      return;
    }
    network.status = "已通知房主開始下一場多人賽程；等待房主同步賽事。";
    scheduleStatus = "已通知房主；下一場賽程會同步到所有玩家。";
    sendToHost({ type: "start-scheduled", protocol: PROTOCOL_VERSION });
    renderNetwork();
    renderDevelopment();
    return;
  }
  if (network.role !== "solo" && network.role !== "host") {
    scheduleStatus = "目前無法啟動 2026 賽季賽，單機或房主模式才能開始。";
    renderDevelopment();
    return;
  }
  if (!(state.phase === "pre" || state.phase === "gameover")) {
    scheduleStatus = "目前已有比賽進行中，完成後才能開始下一場賽季賽。";
    renderDevelopment();
    return;
  }
  const player = selectedCareerPlayer();
  const playerTeamId = player?.teamId || selectedTeamId;
  const scheduled = nextScheduledGame(playerTeamId);
  if (!scheduled) {
    scheduleStatus = `${teamFor(playerTeamId).name} 的 2026 賽季已完成。`;
    renderDevelopment();
    return;
  }
  const playerIsAway = scheduled.awayTeamId === playerTeamId;
  const opponentId = playerIsAway ? scheduled.homeTeamId : scheduled.awayTeamId;
  if (state.teamId !== playerTeamId || state.opponentId !== opponentId) replaceMatchTeams(playerTeamId, opponentId, false);
  selectedTeamId = playerTeamId;
  selectedOpponentId = opponentId;
  developmentTeamId = playerTeamId;
  selectedAthleteId = player?.id || rosterForTeam(playerTeamId)[0]?.id || selectedAthleteId;
  claimLocalPosition(player?.position || network.assignedPosition || "CF", false);
  scheduleStatus = `${scheduled.date} · ${teamFor(scheduled.awayTeamId).name} @ ${teamFor(scheduled.homeTeamId).name}；開始後會以玩家球隊視角進行。`;
  startGame("season", {
    id: scheduled.id,
    gameNo: scheduled.gameNo,
    date: scheduled.date,
    officialHomeTeamId: scheduled.homeTeamId,
    officialAwayTeamId: scheduled.awayTeamId,
    playerIsAway,
  });
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
      athleteId: previous.athleteId,
      playerSnapshot: previous.playerSnapshot,
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
  persistCustomPlayers();
  if (network.role === "guest" && network.connected && player.isCustom) {
    const localCustom = customPlayerIndex[player.id];
    if (localCustom) sendToHost({ type: "custom", protocol: PROTOCOL_VERSION, position: localCustom.position, customPlayer: networkPlayerSnapshotFor(localCustom), name: localCustom.name });
  }
  network.status = `${player.name} 完成${meta.title}：${meta.detail}${levels ? `，升到 Lv.${profile.level}！` : "。"}`;
  if (previousLevel !== profile.level) flashCard("celebrate");
  render();
}

function buildCustomPlayer({ name, number, teamId, position, bats, throws, archetype, buildRatings }) {
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const template = templateForPosition(position, archetype);
  const templateRatings = buildTemplateRatings(position, teamId, bats, template.id);
  const sourceRatings = buildRatings && typeof buildRatings === "object" ? buildRatings : templateRatings;
  const ratings = Object.fromEntries(Object.entries(blueprint.ratings).map(([key, value]) => {
    if (key === "popTime") return [key, Number(sourceRatings[key] || value)];
    const adjusted = Number(sourceRatings[key] ?? value);
    return [key, Math.max(20, Math.min(builderCapFor(position, template, key), Math.round(adjusted)))];
  }));
  splitBuilderRatings(ratings, bats);
  ["contactL", "contactR", "powerL", "powerR"].forEach((key) => {
    if (Number.isFinite(Number(sourceRatings[key]))) ratings[key] = Math.max(20, Math.min(99, Math.round(Number(sourceRatings[key]))));
  });
  const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const potential = position === "P" ? 96 : template.id === "balanced" ? 92 : 90;
  return normalizeCustomPlayer({
    id: `custom-${token}`,
    teamId,
    name: cleanName(name),
    position,
    number: String(number || "99").replace(/\D/g, "").slice(0, 2).padStart(2, "0") || "99",
    role: template.role,
    archetype: template.label,
    builder: { version: 1, templateId: template.id, pointBudget: BUILD_POINT_BUDGET },
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
    if (slot?.controller === "human" && slot.playerId && slot.playerId !== network.localPlayerId) return;
    const customPlayer = customPlayerForNetworkPosition(code, state.teamId);
    const player = customPlayer || playerForPosition(code, state.teamId);
    if (!slot || !player) return;
    slot.athleteId = player.id;
    slot.playerSnapshot = slot.controller === "human" && slot.playerId === network.localPlayerId ? networkPlayerSnapshotFor(customPlayer) : null;
    if (slot.controller === "npc") slot.name = player.name;
  });
}

function setCustomPlayerStatus(message, tone = "") {
  const status = $("custom-player-status");
  if (!status) return;
  status.textContent = message;
  status.className = `custom-player-status ${tone}`.trim();
}

function playerSavePayload() {
  const savedAt = new Date().toISOString();
  return {
    format: PLAYER_SAVE_FORMAT,
    version: PLAYER_SAVE_VERSION,
    savedAt,
    activePlayerId: selectedCustomPlayerId || customPlayers.find((player) => player.active !== false)?.id || "",
    customPlayers: customPlayers.map((player) => clone(player)),
    career: Object.fromEntries(customPlayers.map((player) => [player.id, clone(careerStore[player.id] || profileFor(player.id))])),
  };
}

function formatPlayerSaveTime(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "尚未建立角色存檔";
  return `上次保存：${new Date(timestamp).toLocaleString("zh-TW", { hour12: false })}`;
}

function renderPlayerSaveStatus(message = "") {
  const status = $("player-save-status");
  if (!status) return;
  const meta = readStorage(PLAYER_SAVE_META_KEY, {});
  status.textContent = message || (meta.savedAt ? `${formatPlayerSaveTime(meta.savedAt)}；存在此瀏覽器` : "角色會保存在這個瀏覽器；想換裝置時，請匯出角色檔。");
}

function persistPlayerSaveMeta(savedAt = new Date().toISOString()) {
  writeStorage(PLAYER_SAVE_META_KEY, { savedAt, playerCount: customPlayers.length });
  renderPlayerSaveStatus();
}

function persistCustomPlayers() {
  writeStorage(CUSTOM_PLAYERS_STORAGE_KEY, customPlayers);
  writeStorage(CAREER_STORAGE_KEY, careerStore);
  persistPlayerSaveMeta();
}

function savePlayerNow() {
  persistCustomPlayers();
  setCustomPlayerStatus(customPlayers.length ? "角色與生涯進度已立即保存。" : "目前還沒有自創球員；建立角色後會自動保存。", "is-success");
  render();
}

function exportPlayerSave() {
  if (!customPlayers.length) {
    setCustomPlayerStatus("目前沒有可匯出的自創球員，請先建立角色。", "is-error");
    return;
  }
  const payload = playerSavePayload();
  const fileDate = payload.savedAt.slice(0, 10);
  const activePlayer = customPlayerIndex[payload.activePlayerId];
  const safeName = String(activePlayer?.name || "player-save").replace(/[^\w\u4e00-\u9fff-]/g, "-").slice(0, 20) || "player-save";
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `689-${safeName}-${fileDate}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  renderPlayerSaveStatus(`已匯出角色檔：${activePlayer?.name || "自創球員"}；請妥善保存檔案。`);
  setCustomPlayerStatus("角色檔已下載；換裝置時可用匯入角色檔恢復。", "is-success");
}

async function importPlayerSave(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > 1024 * 1024) {
    setCustomPlayerStatus("角色檔太大，請選擇 1 MB 以內的 JSON 檔。", "is-error");
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== PLAYER_SAVE_FORMAT || Number(payload.version) !== PLAYER_SAVE_VERSION || !Array.isArray(payload.customPlayers)) throw new Error("invalid-save");
    const incomingPlayers = payload.customPlayers.slice(0, MAX_CUSTOM_PLAYERS).map((player, index) => normalizeCustomPlayer(player, index));
    if (!incomingPlayers.length) throw new Error("empty-save");
    if (!window.confirm(`匯入後會取代目前的 ${customPlayers.length} 名自創球員與其生涯進度，確定要匯入嗎？`)) return;
    const previousCustomIds = new Set(customPlayers.map((player) => player.id));
    previousCustomIds.forEach((playerId) => delete careerStore[playerId]);
    customPlayers = incomingPlayers;
    refreshCustomPlayerIndex();
    const incomingCareer = payload.career && typeof payload.career === "object" ? payload.career : {};
    customPlayers.forEach((player) => {
      if (incomingCareer[player.id] && typeof incomingCareer[player.id] === "object") careerStore[player.id] = incomingCareer[player.id];
      profileFor(player.id);
    });
    const activePlayer = customPlayerIndex[payload.activePlayerId] || customPlayers.find((player) => player.active !== false) || customPlayers[0];
    selectedCustomPlayerId = activePlayer?.id || "";
    selectedAthleteId = selectedCustomPlayerId || `${DEFAULT_TEAM_ID}-cf`;
    developmentTeamId = activePlayer?.teamId || DEFAULT_TEAM_ID;
    builderDraft = null;
    persistCustomPlayers();
    if (activePlayer) useCustomPlayer(activePlayer.id);
    setCustomPlayerStatus(`已匯入 ${customPlayers.length} 名角色；${activePlayer?.name || "自創球員"} 現在是目前使用角色。`, "is-success");
    render();
  } catch {
    setCustomPlayerStatus("角色檔格式不正確，請匯入由 689 匯出的 JSON 檔。", "is-error");
  }
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
  network.assignedPosition = player.position;
  const nameInput = $("player-name-input");
  if (nameInput) nameInput.value = player.name;
  if (network.role === "guest") {
    if (network.connected) sendToHost({ type: "custom", protocol: PROTOCOL_VERSION, position: player.position, customPlayer: networkPlayerSnapshotFor(player), name: player.name });
    setCareerStatus(`${player.name} 已選為你的 My Player；單人訓練會累積他的生涯進度。`);
    setCustomPlayerStatus(`${player.name} 已選為你的角色；下一場會使用 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}。`, "is-success");
    render();
    return;
  }
  if (state.phase === "pre" || state.phase === "gameover") {
    if (state.teamId === player.teamId) claimLocalPosition(player.position, false);
    syncMatchAthletes();
    commitState();
    setCareerStatus(`${player.name} 已選為你的 My Player；現在可以訓練或開始單人練習賽。`);
    setCustomPlayerStatus(`${player.name} 已套用到 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}，現在可以開始比賽。`, "is-success");
  } else {
    setCareerStatus(`${player.name} 已選為你的 My Player；下一場比賽會套用最新能力。`);
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
  const draft = builderDraftFromForm();
  const player = buildCustomPlayer({
    name: $("custom-player-name")?.value,
    number: $("custom-player-number")?.value,
    teamId: $("custom-player-team")?.value || selectedTeamId,
    position: $("custom-player-position")?.value || "CF",
    bats: $("custom-player-bats")?.value || "右",
    throws: $("custom-player-throws")?.value || "右",
    archetype: draft.templateId,
    buildRatings: draft.ratings,
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
  builderDraft = null;
  network.status = `${player.name} 已建立，${teamFor(player.teamId).name} 的 ${positionName(player.position)} 位置現在由他先發。`;
  useCustomPlayer(player.id);
  setCustomPlayerStatus(`${player.name} 建立完成並已套用到你的角色；現在可以開始比賽。`, "is-success");
}

function applyMatchToCareerProfile(profile, position, match, result) {
  if (!profile) return;
  const season = profile.stats;
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
  if (position === "P") {
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
  const matchXp = (match.decisions || 0) * 4 + (match.hits || 0) * 8 + (match.putouts || 0) * 3 + 20;
  awardCareerXp(profile, matchXp);
  const matchGrade = clamp(Math.round(60 + (match.hits || 0) * 12 + (match.runs || 0) * 8 + (match.putouts || 0) * 2 + (match.decisions || 0) * 1.5 - (match.timeouts || 0) * 8), 35, 99);
  profile.lastGrade = matchGrade;
  profile.recentMatches = [{ result, grade: matchGrade, xp: matchXp, date: careerDayKey() }, ...(profile.recentMatches || [])].slice(0, 5);
  const matchGoal = activeCareerGoal(profile);
  advanceCareerGoal(profile, matchGoal.kind, matchGoal.kind === "xp" ? matchXp : 1);
  profile.trainingPoints = Math.min(12, profile.trainingPoints + 1);
  profile.fatigue = Math.min(100, profile.fatigue + 8);
  profile.morale = Math.max(20, Math.min(99, profile.morale + (result === "win" || result === "walkoff" ? 4 : -2)));
}

function nextScheduledGame(teamId = selectedCareerPlayer()?.teamId || selectedTeamId) {
  return SEASON_SCHEDULE.find((game) => !scheduleStore.completed[game.id] && (!teamId || game.homeTeamId === teamId || game.awayTeamId === teamId)) || null;
}

function playedSeasonGameCount(teamId = "") {
  return SEASON_SCHEDULE.reduce((count, game) => {
    if (!scheduleStore.completed[game.id]) return count;
    if (!teamId || game.homeTeamId === teamId || game.awayTeamId === teamId) return count + 1;
    return count;
  }, 0);
}

function markScheduledGameCompleted(result) {
  if (state.matchMode !== "season" || !state.scheduleGameId || scheduleStore.completed[state.scheduleGameId]) return;
  const scheduled = SEASON_SCHEDULE.find((game) => game.id === state.scheduleGameId);
  if (!scheduled) return;
  const playerWon = result === "win" || result === "walkoff";
  const playerIsAway = Boolean(state.schedulePlayerIsAway);
  const officialHomeScore = playerIsAway ? state.score.away : state.score.home;
  const officialAwayScore = playerIsAway ? state.score.home : state.score.away;
  const officialHomeResult = playerIsAway ? (playerWon ? "loss" : result === "loss" ? "win" : "tie") : result;
  scheduleStore.completed[state.scheduleGameId] = {
    gameNo: scheduled.gameNo,
    date: scheduled.date,
    homeScore: officialHomeScore,
    awayScore: officialAwayScore,
    result: officialHomeResult,
    playedAt: new Date().toISOString(),
  };
  writeStorage(SCHEDULE_STORAGE_KEY, scheduleStore);
}

function recordTeamResult(result) {
  if (state.matchMode === "practice") return;
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
}

function recordMatchCareer(result) {
  if (state.leagueRecorded) return;
  recordTeamResult(result);
  Object.entries(state.slots).forEach(([position, slot]) => {
    if (!slot.athleteId) return;
    const profile = profileFor(slot.athleteId);
    if (!profile) return;
    applyMatchToCareerProfile(profile, position, state.playerStats[position] || {}, result);
  });
  markScheduledGameCompleted(result);
  state.leagueRecorded = true;
  if (state.matchMode !== "practice") writeStorage(LEAGUE_STORAGE_KEY, leagueStore);
  persistCustomPlayers();
  const localSlot = slotForPlayer(network.localPlayerId);
  const localCustomPlayer = localSlot?.athleteId ? customPlayerIndex[localSlot.athleteId] : null;
  if (localCustomPlayer?.isCustom) setCustomPlayerStatus(`${localCustomPlayer.name} 的多人賽後成長已保存。`, "is-success");
}

function recordLocalGuestMatchCareer() {
  if (network.lastGuestRecordedRevision === state.revision) return;
  const slot = slotForPlayer(network.localPlayerId);
  if (!slot?.athleteId) return;
  const profile = profileFor(slot.athleteId);
  if (!profile) return;
  applyMatchToCareerProfile(profile, slot.position, state.playerStats[slot.position] || {}, state.result);
  network.lastGuestRecordedRevision = state.revision;
  recordTeamResult(state.result);
  markScheduledGameCompleted(state.result);
  if (state.matchMode !== "practice") writeStorage(LEAGUE_STORAGE_KEY, leagueStore);
  persistCustomPlayers();
  const localCustomPlayer = customPlayerIndex[slot.athleteId];
  if (localCustomPlayer?.isCustom) setCustomPlayerStatus(`${localCustomPlayer.name} 的多人賽後成長已保存。`, "is-success");
}

function formatRate(value, digits = 3) {
  return Number(value || 0).toFixed(digits).replace(/^0(?=\.)/, "");
}

function renderCareerDevelopment(player, profile) {
  const pathList = $("development-paths");
  const focusLabel = $("career-focus-label");
  const goalTitle = $("career-goal-title");
  const goalCopy = $("career-goal-copy");
  const goalBar = $("career-goal-bar");
  const selectedPath = developmentPathFor(profile?.developmentPath);
  if (focusLabel) focusLabel.textContent = player ? selectedPath.label : "建立後選擇";
  if (pathList) {
    pathList.innerHTML = Object.entries(DEVELOPMENT_PATHS).map(([id, path]) => `<button type="button" class="development-path ${player && id === (profile?.developmentPath || "balanced") ? "is-selected" : ""}" data-development-path="${id}" ${player ? "" : "disabled"}><b>${path.label}</b><small>${path.detail}</small></button>`).join("");
  }
  const goal = player && profile ? activeCareerGoal(profile) : null;
  const progress = goal ? Math.min(goal.target, Number(profile.goalProgress || 0)) : 0;
  if (goalTitle) goalTitle.textContent = goal ? goal.label : "建立球員後解鎖";
  if (goalCopy) goalCopy.textContent = goal ? `${goal.detail} ${progress} / ${goal.target}${profile.lastGrade ? ` · 最近評分 ${profile.lastGrade}` : ""}` : "完成訓練或比賽，累積你的生涯進度。";
  if (goalBar) goalBar.style.width = `${goal ? Math.round((progress / goal.target) * 100) : 0}%`;
}

function renderCareerMode() {
  const panel = $("career-mode-panel");
  if (!panel) return;
  const player = selectedCareerPlayer();
  const profile = player ? profileFor(player.id) : null;
  const connectedToRoom = network.role !== "solo";
  const modeName = $("career-mode-name");
  const modeMeta = $("career-mode-meta");
  const modeProgress = $("career-mode-progress");
  const modeCopy = $("career-mode-copy");
  const energy = $("career-mode-energy");
  const score = $("career-mode-score");
  const matchButton = $("start-career-match");
  if (!player || !profile) {
    if (modeName) modeName.textContent = "尚未建立自創球員";
    if (modeMeta) modeMeta.textContent = "先到上方工坊建立你的 My Player";
    if (modeProgress) modeProgress.textContent = "Lv.— · XP— · OVR—";
    if (modeCopy) modeCopy.textContent = "這裡會成為你的個人主場：訓練、練習賽與生涯成長都不需要加入多人房間。";
    if (energy) energy.textContent = "今日訓練 0 / 3";
    if (score) score.textContent = "累積評分 —";
  } else {
    if (modeName) modeName.textContent = player.name;
    if (modeMeta) modeMeta.textContent = `${player.position} · ${positionName(player.position)} · ${player.archetype}`;
    if (modeProgress) modeProgress.textContent = `Lv.${profile.level} · XP ${profile.xp}/${xpToNextLevel(profile.level)} · OVR ${player.overall}`;
    if (modeCopy) modeCopy.textContent = connectedToRoom ? "目前在多人房間；離開房間後即可進行自己的單人訓練。" : "把今天的訓練做好，再帶著成長後的角色加入九人房間。";
    if (energy) energy.textContent = `今日訓練 ${profile.practiceSessions} / ${PRACTICE_SESSIONS_PER_DAY}`;
    if (score) score.textContent = `累積評分 ${profile.practiceScore || 0} · 最近 ${profile.lastGrade || "—"}`;
  }
  renderCareerDevelopment(player, profile);
  document.querySelectorAll("[data-practice]").forEach((button) => {
    button.disabled = !player || !profile || profile.practiceSessions <= 0 || connectedToRoom || !(state.phase === "pre" || state.phase === "gameover");
  });
  if (matchButton) matchButton.disabled = !player || connectedToRoom || !(state.phase === "pre" || state.phase === "gameover");
  const status = $("career-mode-status");
  if (status) {
    status.textContent = careerStatus;
    status.className = `career-mode-status ${careerStatusTone}`.trim();
  }
}

function renderSeasonSchedule() {
  const panel = $("season-schedule-panel");
  if (!panel) return;
  const player = selectedCareerPlayer();
  const teamId = network.role !== "solo" && state.teamId ? state.teamId : player?.teamId || selectedTeamId;
  const team = teamFor(teamId);
  const teamGames = SEASON_SCHEDULE.filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId);
  const activeScheduledGame = state.matchMode === "season" && state.scheduleGameId && state.phase !== "gameover"
    ? SEASON_SCHEDULE.find((game) => game.id === state.scheduleGameId) || null
    : null;
  const next = activeScheduledGame || nextScheduledGame(teamId);
  const played = playedSeasonGameCount(teamId);
  const completedTotal = Object.keys(scheduleStore.completed).length;
  const progress = $("schedule-progress");
  const nextLabel = $("schedule-next");
  const status = $("season-schedule-status");
  const list = $("season-schedule-list");
  const button = $("start-next-scheduled-game");
  if (progress) progress.textContent = `${team.name} ${played} / 120 場 · 全聯盟 ${Math.min(CPBL_TOTAL_SEASON_GAMES, completedTotal)} / ${CPBL_TOTAL_SEASON_GAMES} 場`;
  if (nextLabel) {
    nextLabel.textContent = next
      ? `${activeScheduledGame ? "目前多人賽程" : "下一場"}：${next.date.replaceAll("-", "/")} ${next.half} · ${teamFor(next.awayTeamId).shortName} @ ${teamFor(next.homeTeamId).shortName} · ${next.stadium}`
      : `${team.name} 的 2026 賽季已完成。`;
  }
  if (status) {
    status.textContent = activeScheduledGame
      ? `${activeScheduledGame.date} · ${teamFor(activeScheduledGame.awayTeamId).name} @ ${teamFor(activeScheduledGame.homeTeamId).name}；${network.role === "guest" ? "房主已啟動，多人玩家共用這場賽程。" : "這場賽程已同步到房間。"}`
      : scheduleStatus;
    status.className = "season-schedule-status";
  }
  if (button) {
    const canRequest = network.role === "solo" || network.role === "host" || (network.role === "guest" && network.connected);
    button.disabled = !next || !canRequest || !(state.phase === "pre" || state.phase === "gameover");
    button.innerHTML = next
      ? `${network.role === "guest" ? "請房主開始賽程" : "開始下一場賽季賽"} <span>↗</span>`
      : "本隊賽季已完成";
  }
  if (!list) return;
  if (!teamGames.length) {
    list.innerHTML = `<p class="season-schedule-empty">尚未找到 ${escapeHtml(team.name)} 的賽程。</p>`;
    return;
  }
  const nextIndex = Math.max(0, teamGames.findIndex((game) => game.id === next?.id));
  const visibleGames = teamGames.slice(Math.max(0, nextIndex - 2), nextIndex + 8);
  list.innerHTML = visibleGames.map((game) => {
    const completed = scheduleStore.completed[game.id];
    const isNext = game.id === next?.id;
    const home = teamFor(game.homeTeamId);
    const away = teamFor(game.awayTeamId);
    const score = completed ? ` · ${completed.homeScore}：${completed.awayScore}` : "";
    const stateLabel = completed ? "已完成" : isNext ? "下一場" : "待進行";
    return `<div class="season-schedule-row ${isNext ? "is-next" : ""} ${completed ? "is-completed" : ""}">
      <span class="season-schedule-date"><b>${game.date.slice(5).replace("-", "/")}</b><small>${game.half}</small></span>
      <span class="season-schedule-match"><b>${escapeHtml(away.shortName)} @ ${escapeHtml(home.shortName)}</b><small>${escapeHtml(away.name)} 對 ${escapeHtml(home.name)} · ${escapeHtml(game.stadium)}${score}</small></span>
      <strong>${stateLabel}</strong>
    </div>`;
  }).join("");
}

function renderDevelopment() {
  const panel = $("development-panel");
  if (!panel) return;
  if (network.role === "guest" && state.teamId) selectedTeamId = state.teamId;
  renderCareerMode();
  renderSeasonSchedule();
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
  const customTemplateSelect = $("custom-player-archetype");
  if (customTemplateSelect) {
    const currentPosition = customPositionSelect?.value || "CF";
    const previousTemplate = builderDraft?.position === currentPosition ? builderDraft.templateId : customTemplateSelect.value;
    customTemplateSelect.innerHTML = templatesForPosition(currentPosition).map((template) => `<option value="${template.id}">${template.label} · ${template.role}</option>`).join("");
    customTemplateSelect.value = templateForPosition(currentPosition, previousTemplate).id;
  }
  renderBuilder();
  renderPlayerSaveStatus();
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
  $("development-team-label").textContent = `${browseTeam.name} · ${browseTeam.city} · ${browseTeam.style} · 2026 主力先發快照`;
  const teamStats = browseTeam.leagueStats || {};
  const teamDataNote = $("team-data-note");
  if (teamDataNote) teamDataNote.textContent = `2026 官方數據快照（${CPBL_DATA_SNAPSHOT}）：${teamStats.wins || 0} 勝 ${teamStats.losses || 0} 敗 · AVG ${Number(teamStats.battingAvg || 0).toFixed(3)} · OBP ${Number(teamStats.onBasePct || 0).toFixed(3)} · SLG ${Number(teamStats.sluggingPct || 0).toFixed(3)} · ERA ${Number(teamStats.era || 0).toFixed(2)}`;
  $("team-tabs").innerHTML = TEAM_DEFS.map((team) => `<button class="team-tab ${team.id === developmentTeamId ? "is-active" : ""}" data-development-team="${team.id}" type="button"><span>${team.shortName}</span><small>${team.city}</small></button>`).join("");
  $("roster-count").textContent = `${LEAGUE_TEAMS.length} 隊 · ${LEAGUE_TEAMS.reduce((sum, team) => sum + team.roster.length, 0)} 名球員 · ${customPlayers.length} 名自創`;
  $("roster-list").innerHTML = browseRoster.map((basePlayer) => {
    const player = developedPlayer(basePlayer.id);
    return `<button class="roster-player ${player.id === selectedAthleteId ? "is-selected" : ""}" data-athlete-id="${player.id}" type="button"><span class="roster-number">${player.number}</span><span class="roster-player-main"><b>${escapeHtml(player.name)}</b><small>${player.position} · ${player.isCustom ? "自創" : player.isOfficial ? "2026 主力先發" : player.role}</small></span><strong>${player.overall}</strong></button>`;
  }).join("");
  const selectedInBrowse = browseRoster.some((candidate) => candidate.id === selectedAthleteId);
  const player = selectedInBrowse ? developedPlayer(selectedAthleteId) : developedPlayer(browseRoster[0]?.id);
  if (!player) return;
  selectedAthleteId = player.id;
  const profile = profileFor(player.id);
  const ratings = player.ratings;
  $("player-detail-name").textContent = player.name;
  $("player-detail-position").textContent = `${player.position} · ${player.role}`;
  const officialPerformance = player.performance ? ` · 2026 AVG ${Number(player.performance.avg || 0).toFixed(3)} / OPS ${Number(player.performance.ops || 0).toFixed(3)}` : "";
  $("player-detail-meta").textContent = `#${player.number} · ${player.bats}打／${player.throws}投 · ${player.age}歲 · ${player.height}cm / ${player.weight}kg · ${player.archetype}${officialPerformance}`;
  $("player-overall").textContent = player.overall;
  $("player-progress").textContent = `Lv.${profile.level} · XP ${profile.xp}/${xpToNextLevel(profile.level)} · 訓練點 ${profile.trainingPoints} · 潛力 ${player.potential}`;
  $("player-morale").textContent = `士氣 ${profile.morale} · 疲勞 ${profile.fatigue}`;
  const ratingGroups = [
    ["打擊", [["擊球能力", ratings.contact], ["對左投擊球", ratings.contactL], ["對右投擊球", ratings.contactR], ["長打力量", ratings.power], ["對左投長打", ratings.powerL], ["對右投長打", ratings.powerR], ["擊球視野", ratings.vision], ["選球能力", ratings.discipline], ["關鍵打擊", ratings.clutch], ["短打能力", ratings.bunt]]],
    ["跑壘", [["跑壘速度", ratings.speed], ["盜壘能力", ratings.stealing]]],
    ["守備", [["守備範圍", ratings.fielding], ["反應速度", ratings.reaction], ["臂力", ratings.armStrength], ["傳球準確度", ratings.armAccuracy], ["擋球能力", ratings.blocking], ["捕手傳球時間", Number(ratings.popTime || 0).toFixed(2)]]],
    ["投球", [["球速", ratings.velocity], ["投球控球", ratings.control], ["變化球", ratings.break], ["投手體力", ratings.stamina]]],
  ];
  $("player-attributes").innerHTML = ratingGroups.map(([title, rows]) => `<div class="attribute-group"><h4>${title}</h4>${rows.map(([label, value]) => `<div class="attribute-row"><span>${label}</span><i><b style="width:${label === "捕手傳球時間" ? Math.max(20, 100 - Number(value) * 28) : value}%"></b></i><strong>${value}</strong></div>`).join("")}</div>`).join("");
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
  { position: "CF", number: "07", name: "岳政華", contact: 82, power: 67 },
  { position: "RF", number: "23", name: "詹子賢", contact: 74, power: 86 },
  { position: "3B", number: "31", name: "王威晨", contact: 79, power: 77 },
  { position: "1B", number: "44", name: "許基宏", contact: 76, power: 92 },
  { position: "LF", number: "12", name: "宋晟睿", contact: 76, power: 81 },
  { position: "2B", number: "08", name: "王政順", contact: 70, power: 64 },
  { position: "SS", number: "19", name: "江坤宇", contact: 70, power: 72 },
  { position: "C", number: "02", name: "高宇杰", contact: 73, power: 58 },
  { position: "P", number: "55", name: "鄭浩均", contact: 61, power: 56 },
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
  lastGuestRecordedRevision: -1,
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
    playerSnapshot: null,
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

function createState(teamId = selectedTeamId, opponentId = selectedOpponentId, matchMode = "league", scheduleContext = null) {
  const schedule = scheduleContext && typeof scheduleContext === "object" ? scheduleContext : {};
  return {
    version: PROTOCOL_VERSION,
    teamId,
    opponentId,
    matchMode,
    scheduleGameId: String(schedule.id || ""),
    scheduleGameNo: Number(schedule.gameNo || 0),
    scheduleDate: String(schedule.date || ""),
    scheduleOfficialHomeTeamId: String(schedule.officialHomeTeamId || ""),
    scheduleOfficialAwayTeamId: String(schedule.officialAwayTeamId || ""),
    schedulePlayerIsAway: Boolean(schedule.playerIsAway),
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
    if (!incoming) return;
    const playerSnapshot = normalizeNetworkPlayerSnapshot(incoming.playerSnapshot, normalizedTeamId, code);
    normalized.slots[code] = {
      ...normalized.slots[code],
      ...incoming,
      athleteId: playerSnapshot?.player.id || incoming.athleteId || normalized.slots[code].athleteId,
      playerSnapshot,
      connectionKey: null,
      sessionId: null,
    };
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

function canChangePositionNow() {
  return state.phase === "pre" || state.phase === "gameover" || (state.phase === "home" && state.balls === 0 && state.strikes === 0);
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
  const previousPhase = state.phase;
  state = normalizeState(snapshot);
  network.lastRevision = incomingRevision;
  network.awaiting = false;
  if (network.role === "guest" && state.phase === "gameover" && previousPhase !== "gameover" && state.leagueRecorded) recordLocalGuestMatchCareer();
  if (network.role === "guest") network.status = "已同步：輪到你的打席時，按下你的決策。";
  render();
}

function renderPlayerHub() {
  const player = selectedCareerPlayer();
  const profile = player ? profileFor(player.id) : null;
  const avatar = $("hub-avatar");
  const name = $("player-hub-title");
  const meta = $("hub-player-meta");
  const overall = $("hub-player-ovr");
  const level = $("hub-level");
  const xp = $("hub-xp");
  const progressBar = $("hub-progress-bar");
  const nextTitle = $("hub-next-title");
  const nextCopy = $("hub-next-copy");
  const buildLink = $("hub-build-player");
  if (!player || !profile) {
    if (avatar) avatar.textContent = "MP";
    if (name) name.textContent = "建立你的 My Player";
    if (meta) meta.textContent = "從 60 OVR 開始，選擇自己的位置與成長路線。";
    if (overall) overall.textContent = "—";
    if (level) level.textContent = "Lv.—";
    if (xp) xp.textContent = "XP —";
    if (progressBar) progressBar.style.width = "0%";
    if (nextTitle) nextTitle.textContent = "先建立你的球員";
    if (nextCopy) nextCopy.textContent = "選一個模板，再把建造點放到你真正想玩的能力。";
    if (buildLink) {
      buildLink.classList.add("hub-action-primary");
      buildLink.querySelector("b")?.replaceChildren("建立球員");
    }
    return;
  }
  const path = developmentPathFor(profile.developmentPath);
  const goal = activeCareerGoal(profile);
  const goalProgress = Math.min(goal.target, Number(profile.goalProgress || 0));
  const nextXp = xpToNextLevel(profile.level);
  if (avatar) avatar.textContent = player.position;
  if (name) name.textContent = player.name;
  if (meta) meta.textContent = `${player.position} · ${positionName(player.position)} · ${path.label}`;
  if (overall) overall.textContent = player.overall;
  if (level) level.textContent = `Lv.${profile.level}`;
  if (xp) xp.textContent = `XP ${profile.xp}/${nextXp}`;
  if (progressBar) progressBar.style.width = `${Math.min(100, Math.round((profile.xp / nextXp) * 100))}%`;
  if (nextTitle) nextTitle.textContent = goal.label;
  if (nextCopy) nextCopy.textContent = `${goal.detail} ${goalProgress}/${goal.target}；${path.label}訓練可獲得額外 XP。`;
  if (buildLink) {
    buildLink.classList.remove("hub-action-primary");
    buildLink.querySelector("b")?.replaceChildren("管理球員");
  }
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
  network.lastGuestRecordedRevision = -1;
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
      athleteId: previous.athleteId,
      playerSnapshot: previous.playerSnapshot,
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
  if (!canChangePositionNow()) {
    setStatus("下一個安全事件才能換守備位置。");
    return false;
  }
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
    previous.playerSnapshot = null;
    previous.name = npcNameForPosition(previous.position);
    previous.connected = true;
  }
  const customPlayer = customPlayerForNetworkPosition(position, state.teamId);
  const athlete = playerForPosition(position, state.teamId);
  target.controller = "human";
  target.playerId = network.localPlayerId;
  target.sessionId = network.sessionId;
  target.connectionKey = network.role === "host" ? "host-local" : null;
  target.name = network.displayName;
  target.athleteId = customPlayer?.id || athlete?.id || target.athleteId;
  target.playerSnapshot = networkPlayerSnapshotFor(customPlayer);
  target.connected = true;
  network.assignedPosition = position;
  if (shouldCommit) commitState();
  else render();
  return true;
}

function releaseLocalPosition(shouldCommit = true) {
  if (!isAuthority()) return false;
  if (!canChangePositionNow()) {
    setStatus("下一個安全事件才能把位置交給 NPC。");
    return false;
  }
  const slot = slotForPlayer(network.localPlayerId);
  if (!slot) return false;
  slot.controller = "npc";
  slot.playerId = null;
  slot.sessionId = null;
  slot.connectionKey = null;
  slot.playerSnapshot = null;
  slot.name = npcNameForPosition(slot.position);
  slot.connected = true;
  network.assignedPosition = "";
  if (shouldCommit) commitState();
  else render();
  return true;
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
  record.customPlayer = normalizeNetworkPlayerSnapshot(message.customPlayer, state.teamId, slot.position);
  slot.playerId = playerId;
  slot.sessionId = sessionId;
  slot.connectionKey = record.key;
  slot.controller = "human";
  slot.connected = true;
  slot.name = record.name;
  slot.playerSnapshot = record.customPlayer;
  slot.athleteId = record.customPlayer?.player.id || playerForPosition(slot.position, state.teamId)?.id || slot.athleteId;
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
  const record = { key, connection, joined: false, playerId: null, sessionId: null, position: "", customPlayer: null, lastSeen: Date.now(), lastSignalAt: 0, removed: false };
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
        slot.playerSnapshot = null;
        slot.athleteId = playerForPosition(slot.position, state.teamId)?.id || slot.athleteId;
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
    else if (message.type === "claim") hostClaimPlayerPosition(record, message.position, message.customPlayer);
    else if (message.type === "release") hostReleasePlayerPosition(record);
    else if (message.type === "name") hostUpdatePlayerName(record, message.name);
    else if (message.type === "custom") hostUpdateCustomPlayer(record, message.position, message.customPlayer, message.name);
    else if (message.type === "signal") hostHandleSignal(record, message.signal);
    else if (message.type === "start") requestStartFromPlayer(record);
    else if (message.type === "start-scheduled") requestScheduledStartFromPlayer(record);
    else if (message.type === "reset") sendConnection(connection, { type: "status", message: "只有房主可以重新開打。", awaiting: false });
    else if (message.type === "action") hostHandleAction(record, message);
  });
  connection.on("close", remove);
  connection.on("error", remove);
}

function hostClaimPlayerPosition(record, position, incomingCustomPlayer = null) {
  if (!POSITION_BY_CODE[position]) return;
  if (!canChangePositionNow()) {
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
    previous.playerSnapshot = null;
    previous.athleteId = playerForPosition(previous.position, state.teamId)?.id || previous.athleteId;
    previous.name = npcNameForPosition(previous.position);
    previous.connected = true;
  }
  const customPlayer = normalizeNetworkPlayerSnapshot(incomingCustomPlayer, state.teamId, position) || (record.customPlayer?.player.position === position ? record.customPlayer : null);
  target.controller = "human";
  target.playerId = record.playerId;
  target.sessionId = record.sessionId;
  target.connectionKey = record.key;
  target.playerSnapshot = customPlayer;
  target.athleteId = customPlayer?.player.id || playerForPosition(position, state.teamId)?.id || target.athleteId;
  target.connected = true;
  target.name = record.name || target.name;
  record.customPlayer = customPlayer;
  record.position = position;
  sendConnection(record.connection, { type: "position", position });
  network.status = `${target.name} 已轉到 ${positionName(position)}。`;
  commitState();
}

function hostReleasePlayerPosition(record) {
  const slot = slotForPlayer(record.playerId);
  if (!slot) return;
  if (!canChangePositionNow()) {
    sendConnection(record.connection, { type: "status", message: "下一個安全事件才能把位置交給 NPC。" });
    return;
  }
  slot.controller = "npc";
  slot.playerId = null;
  slot.connectionKey = null;
  slot.playerSnapshot = null;
  slot.athleteId = playerForPosition(slot.position, state.teamId)?.id || slot.athleteId;
  slot.name = npcNameForPosition(slot.position);
  slot.connected = true;
  record.position = "";
  record.customPlayer = null;
  sendConnection(record.connection, { type: "position", position: "" });
  commitState();
}

function hostUpdatePlayerName(record, name) {
  const slot = slotForPlayer(record.playerId);
  if (!slot) return;
  record.name = cleanName(name);
  slot.name = record.name;
  if (record.customPlayer?.player) record.customPlayer.player.name = record.name;
  if (slot.playerSnapshot?.player) slot.playerSnapshot.player.name = record.name;
  commitState();
}

function hostUpdateCustomPlayer(record, position, incomingCustomPlayer, name = "") {
  if (!record.joined) return;
  if (!canChangePositionNow()) {
    sendConnection(record.connection, { type: "status", message: "下一個安全事件才能更新自創球員。" });
    return;
  }
  const nextName = name || incomingCustomPlayer?.player?.name;
  if (nextName) record.name = cleanName(nextName);
  hostClaimPlayerPosition(record, position || record.position, incomingCustomPlayer);
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

function requestScheduledStartFromPlayer(record) {
  if (!record.playerId) return;
  startScheduledGame();
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
      customPlayer: networkPayloadForPosition(network.assignedPosition, selectedTeamId),
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
  claimLocalPosition(customPlayerIndex[selectedCustomPlayerId]?.position || "CF", false);
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
  network.assignedPosition = customPlayerIndex[selectedCustomPlayerId]?.position || "CF";
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
  if (state.matchMode === "season") {
    startScheduledGame();
    return;
  }
  if (network.role === "guest") {
    if (!network.connected) return;
    network.status = "已通知房主開始比賽；NPC 會補足其他位置。";
    sendToHost({ type: "start", protocol: PROTOCOL_VERSION });
    renderNetwork();
    return;
  }
  startGame(network.role === "solo" && state.matchMode === "practice" ? "practice" : "league");
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
  const localPlayer = localSlot?.playerSnapshot
    ? developedNetworkPlayer(localSlot.playerSnapshot)
    : localSlot?.athleteId
      ? developedPlayer(localSlot.athleteId)
      : customPlayerIndex[selectedCustomPlayerId]
        ? developedPlayer(selectedCustomPlayerId)
        : null;
  const localPosition = localSlot?.position || localPlayer?.position || network.assignedPosition;
  const isCustom = Boolean(localPlayer?.isCustom);
  $("lobby-role-mark").textContent = localPosition || "MP";
  $("lobby-role-name").textContent = localPlayer?.name || network.displayName || "尚未選擇角色";
  $("lobby-role-meta").textContent = localPlayer
    ? `${positionName(localPosition)} · ${isCustom ? "My Player 自創角色" : "球隊先發球員"}`
    : "選擇已保存角色後，會把能力帶進房間。";
  $("lobby-role-ovr").textContent = localPlayer?.overall ?? "—";
  $("lobby-role-level").textContent = localPlayer?.isCustom ? `等級 ${localPlayer.level || 1}` : localPlayer ? "官方球員" : "等級 —";
  const readiness = network.role === "solo"
    ? "單機可開始"
    : network.role === "host"
      ? network.connected ? `房主已準備 · ${humanCount}/${MAX_PLAYERS} 真人` : "房主準備中"
      : network.connected
        ? localSlot ? "已加入房間 · 等待房主開始" : "已連線 · 等待位置"
        : "等待房間連線";
  $("lobby-readiness").textContent = readiness;
  const roomLiveStatus = $("room-live-status");
  const roomHumanCount = $("room-human-count");
  const roomEventOwner = $("room-event-owner");
  if (roomLiveStatus) roomLiveStatus.textContent = network.role === "solo"
    ? "單機 + NPC"
    : network.connected
      ? network.role === "host" ? "房主控制中" : "已加入房間"
      : "等待連線";
  if (roomHumanCount) roomHumanCount.textContent = `${humanCount} / ${MAX_PLAYERS}`;
  if (roomEventOwner) roomEventOwner.textContent = state.phase === "pre"
    ? "等待開賽"
    : state.phase === "gameover"
      ? "比賽結束"
      : state.phase === "defense"
        ? `${positionName(state.defenseOwner)} 守備`
        : state.phase === "home"
          ? `${positionName(currentBatter().position)} 打擊`
          : "NPC 進攻";
  $("role-status").textContent = localSlot
    ? `你目前是 ${positionName(localSlot.position)} · ${localSlot.name}；點選其他空缺位置即可換位。`
    : "你尚未選擇位置；空缺位置會由 NPC 補位。";
  $("release-position").disabled = !localSlot || state.phase === "home" && !(state.balls === 0 && state.strikes === 0);
  grid.innerHTML = POSITION_DEFS.map((definition) => {
    const slot = state.slots[definition.code];
    const player = slot?.playerSnapshot
      ? developedNetworkPlayer(slot.playerSnapshot)
      : slot?.athleteId
        ? developedPlayer(slot.athleteId)
        : null;
    const isLocal = slot.playerId === network.localPlayerId;
    const isHuman = slot.controller === "human";
    const ownerClass = isHuman ? "is-human" : "is-npc";
    const disabled = isHuman && !isLocal;
    const rating = player?.overall != null ? `OVR ${player.overall}` : "OVR —";
    const level = player?.isCustom ? `等級 ${player.level || 1}` : "官方球員";
    const roleLabel = isHuman ? slot.name : "NPC 補位";
    return `<button class="position-slot ${isLocal ? "is-local" : ""} ${isHuman ? "is-human" : ""} ${currentBatter().position === definition.code && state.phase === "home" ? "is-active" : ""}" data-position="${definition.code}" type="button" ${disabled ? "disabled" : ""} aria-label="${escapeHtml(`${definition.name}，${roleLabel}，${rating}，${level}`)}">
      <span class="position-code">${definition.code}</span>
      <span class="position-name">${definition.name}</span>
      <span class="position-owner ${ownerClass}">${escapeHtml(roleLabel)}</span>
      <span class="position-rating">${escapeHtml(`${rating} · ${level}`)}</span>
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
  const scheduleHomeTeam = state.matchMode === "season" && state.scheduleOfficialHomeTeamId ? teamFor(state.scheduleOfficialHomeTeamId) : homeTeam;
  const scheduleAwayTeam = state.matchMode === "season" && state.scheduleOfficialAwayTeamId ? teamFor(state.scheduleOfficialAwayTeamId) : awayTeam;
  const displayHomeScore = state.matchMode === "season" && state.schedulePlayerIsAway ? state.score.away : state.score.home;
  const displayAwayScore = state.matchMode === "season" && state.schedulePlayerIsAway ? state.score.home : state.score.away;
  const modePrefix = state.matchMode === "practice" ? "單人練習 · " : state.matchMode === "season" ? `2026 賽季${state.scheduleGameNo ? `第 ${state.scheduleGameNo} 場` : ""} · ` : "";
  const phaseText = { pre: `${modePrefix}賽前準備`, defense: `${modePrefix}${homeTeam.shortName}守備 · ${state.defenseOwner || "P"}`, cpu: `${modePrefix}NPC 客隊進攻`, home: `${modePrefix}輪到 ${batter.position}`, gameover: `${modePrefix}比賽結束` }[state.phase];
  $("game-title").textContent = `${scheduleHomeTeam.name} vs. ${scheduleAwayTeam.name}`;
  $("away-team-name").textContent = scheduleAwayTeam.name;
  $("away-team-record").textContent = `${scheduleAwayTeam.stadium} · 先攻`;
  $("home-team-name").textContent = scheduleHomeTeam.name;
  $("home-team-record").textContent = `${scheduleHomeTeam.style} · NPC 補位`;
  $("phase-chip").textContent = phaseText;
  $("inning-label").textContent = state.phase === "pre" ? "尚未開打" : state.phase === "gameover" ? `${state.inning} 局結束` : `${state.inning} 局${state.half === "top" ? "上" : "下"}`;
  $("outs-label").textContent = `${state.outs} 出局`;
  $("count-label").textContent = formatCount();
  $("away-score").textContent = displayAwayScore;
  $("home-score").textContent = displayHomeScore;
  $("situation-text").textContent = state.phase === "pre"
    ? `${DIFFICULTY_CONFIG.label}難度：選擇你的守備位置；空缺位置由免費 NPC 補位，房主驗證每個團隊決策。`
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
  const resultCopy = state.matchMode === "practice" ? "練習賽完成。" : state.matchMode === "season" ? `2026 賽季第 ${state.scheduleGameNo} 場完成。` : "最終比分：";
  $("gameover-copy").textContent = `${resultCopy} ${scheduleHomeTeam.name} ${displayHomeScore}：${displayAwayScore} ${scheduleAwayTeam.name}。這場比賽留下 ${humanPlayerCount()} 名真人玩家與 NPC 隊友的共同紀錄。`;
  renderResultSummary();
  updateBaseView();
  renderLineScore();
  renderLog();
  renderBatter();
  renderActions();
  renderNetwork();
  renderLobby();
  renderDevelopment();
  renderPlayerHub();
  scheduleNpcTurn();
}

function resetMatchState(matchMode = "league", scheduleContext = null) {
  window.clearTimeout(network.actionTimer);
  network.actionTimer = null;
  const previousSlots = clone(state.slots);
  const previousRevision = state.revision;
  state = createState(state.teamId, state.opponentId, matchMode, scheduleContext);
  state.revision = previousRevision;
  POSITION_DEFS.forEach(({ code }) => {
    const previous = previousSlots[code];
    if (!previous) return;
    const target = state.slots[code];
    if (previous.controller === "human" && previous.playerId) {
      Object.assign(target, {
        athleteId: previous.athleteId,
        playerSnapshot: previous.playerSnapshot,
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
  resetMatchState("league");
  addLog("新比賽準備開始；每個位置都可以由真人或 NPC 負責。", "big");
  commitState();
}

function startGame(matchMode = "league", scheduleContext = null) {
  if (!isAuthority() || !(state.phase === "pre" || state.phase === "gameover")) return;
  resetMatchState(matchMode, scheduleContext);
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
    "defense-fast": [0.14, 0.34, 0.66],
    "defense-break": [0.11, 0.3, 0.6],
    "defense-control": [0.08, 0.23, 0.5],
    "defense-pickoff": [0.09, 0.25, 0.53],
    "defense-intentional": [0.1, 0.28, 0.58],
  };
  const opponentStats = teamFor(state.opponentId).leagueStats || {};
  const offensiveStrength = clamp(1 + (Number(opponentStats.sluggingPct || 0.33) - 0.33) * 2 + (Number(opponentStats.onBasePct || 0.32) - 0.32) * 1.2, 0.9, 1.13);
  const [baseThreeRun, baseTwoRun, baseOneRun] = profiles[defenseAction] || profiles["defense-control"];
  const threeRun = clamp(baseThreeRun * offensiveStrength, 0.03, 0.22);
  const twoRun = clamp(baseTwoRun * offensiveStrength, threeRun + 0.04, 0.5);
  const oneRun = clamp(baseOneRun * offensiveStrength, twoRun + 0.08, 0.82);
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
  const defender = matchPlayerForPosition(state.defenseOwner, state.teamId) || definition;
  const defenderRatings = defender.ratings || defender;
  const baseRuns = state.pendingAwayRuns;
  const fielding = Number(defenderRatings.fielding || definition.fielding) / 100;
  const arm = Number(defenderRatings.armStrength || definition.arm) / 100;
  const reaction = Number(defenderRatings.reaction || definition.fielding) / 100;
  const roll = nextRandom();
  let finalRuns = baseRuns;
  if (action === "fielding-catch") {
    if (roll < (0.4 + fielding * 0.18 + reaction * 0.1) * DIFFICULTY_CONFIG.fieldingSuccessScale) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-dive") {
    if (roll < (0.14 + fielding * 0.34 + reaction * 0.2) * DIFFICULTY_CONFIG.fieldingSuccessScale) finalRuns = Math.max(0, baseRuns - 2);
    else finalRuns = Math.min(3, baseRuns + 1);
  } else if (action === "fielding-hold") {
    if (roll < (0.52 + fielding * 0.16 + reaction * 0.08) * DIFFICULTY_CONFIG.fieldingSuccessScale && nextRandom() < 0.62) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-relay") {
    if (roll < (0.28 + arm * 0.28 + Number(defenderRatings.armAccuracy || definition.arm) / 100 * 0.17) * DIFFICULTY_CONFIG.fieldingSuccessScale) finalRuns = Math.max(0, baseRuns - 1);
  } else if (action === "fielding-throw") {
    if (roll < (0.22 + arm * 0.38 + Number(defenderRatings.armAccuracy || definition.arm) / 100 * 0.16) * DIFFICULTY_CONFIG.fieldingSuccessScale) finalRuns = Math.max(0, baseRuns - 1);
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

function opponentPitchingFactor() {
  const pitcher = matchPlayerForPosition("P", state.opponentId) || POSITION_BY_CODE.P;
  const pitcherRatings = pitcher.ratings || pitcher;
  const pitchingQuality = (Number(pitcherRatings.velocity || 60) * 0.2 + Number(pitcherRatings.control || 60) * 0.4 + Number(pitcherRatings.break || 60) * 0.4) / 100;
  const era = Number(teamFor(state.opponentId).leagueStats?.era || 3.8);
  const eraPressure = clamp((3.8 - era) * 0.03, -0.03, 0.05);
  return clamp(1.02 - pitchingQuality * 0.12 - eraPressure, 0.84, 0.98);
}

function resolveSwing(action) {
  const batter = currentBatter();
  const roll = nextRandom();
  const ratings = batter.ratings || batter;
  const countFactor = state.strikes === 2 ? 0.92 : state.balls >= 2 ? 1.04 : 1;
  const swingWindow = DIFFICULTY_CONFIG.swingWindow * opponentPitchingFactor() * countFactor;
  const contactBoost = (Number(ratings.contact || 60) * 0.72 + Number(ratings.vision || 60) * 0.28) / 1180 * swingWindow;
  const powerBoost = (Number(ratings.power || 60) * 0.84 + Number(ratings.clutch || 60) * 0.16) / 1450 * swingWindow;
  let result = "out";
  if (action === "power") {
    if (roll < 0.01 + powerBoost * 0.65) result = "homer";
    else if (roll < 0.06 + powerBoost * 0.62) result = "double";
    else if (roll < 0.215 + contactBoost * 0.6) result = "single";
    else if (roll < 0.49) result = "foul";
    else if (roll < 0.74) result = "miss";
  } else {
    if (roll < 0.005 + powerBoost * 0.2) result = "homer";
    else if (roll < 0.045 + powerBoost * 0.34) result = "double";
    else if (roll < 0.215 + contactBoost * 0.6) result = "single";
    else if (roll < 0.52 + contactBoost * 0.08) result = "foul";
    else if (roll < 0.76 + contactBoost * 0.03) result = "miss";
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
  const countBonus = state.balls >= 2 ? 0.07 : state.strikes === 2 ? -0.1 : 0;
  if (nextRandom() < clamp(DIFFICULTY_CONFIG.patientBase + patience * 0.25 + countBonus, 0.18, 0.68)) {
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
  if (roll < DIFFICULTY_CONFIG.buntHitChance) { applyHit("single"); return; }
  if (roll < 0.7) {
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
  const runner = matchPlayerForPosition(runnerPosition, state.teamId) || {};
  const runnerRatings = runner.ratings || runner;
  const stealChance = DIFFICULTY_CONFIG.stealBaseChance + Number(runnerRatings.stealing || 50) / 330 + Number(runnerRatings.speed || 50) / 720;
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
    const defender = matchPlayerForPosition(state.defenseOwner, state.teamId) || definition;
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
      sendToHost({ type: "claim", protocol: PROTOCOL_VERSION, position, customPlayer: networkPayloadForPosition(position, state.teamId) });
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
  $("save-player-now")?.addEventListener("click", savePlayerNow);
  $("export-player-save")?.addEventListener("click", exportPlayerSave);
  $("import-player-save")?.addEventListener("change", importPlayerSave);
  $("custom-player-position")?.addEventListener("change", () => {
    builderDraft = null;
    renderDevelopment();
  });
  $("custom-player-team")?.addEventListener("change", () => {
    builderDraft = null;
    renderDevelopment();
  });
  $("custom-player-bats")?.addEventListener("change", () => {
    builderDraft = null;
    renderDevelopment();
  });
  $("custom-player-archetype")?.addEventListener("change", (event) => {
    const position = $("custom-player-position")?.value || "CF";
    const teamId = $("custom-player-team")?.value || selectedTeamId;
    const bats = $("custom-player-bats")?.value || "右";
    builderDraft = createBuilderDraft(position, teamId, bats, event.target.value);
    renderBuilder();
  });
  $("builder-panel")?.addEventListener("click", (event) => {
    const templateButton = event.target.closest("[data-builder-template]");
    if (templateButton) {
      const templateSelect = $("custom-player-archetype");
      if (templateSelect) templateSelect.value = templateButton.dataset.builderTemplate;
      const position = $("custom-player-position")?.value || "CF";
      const teamId = $("custom-player-team")?.value || selectedTeamId;
      const bats = $("custom-player-bats")?.value || "右";
      builderDraft = createBuilderDraft(position, teamId, bats, templateButton.dataset.builderTemplate);
      renderBuilder();
      return;
    }
    const adjustButton = event.target.closest("[data-builder-adjust]");
    if (!adjustButton || adjustButton.disabled) return;
    builderAdjustRating(adjustButton.dataset.builderKey, Number(adjustButton.dataset.builderAdjust));
  });
  $("custom-player-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-custom-action]");
    if (!button) return;
    if (button.dataset.customAction === "use") useCustomPlayer(button.dataset.customPlayerId);
  });
  $("practice-actions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-practice]");
    if (!button || button.disabled) return;
    runPracticeDrill(button.dataset.practice);
  });
  $("development-paths")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-development-path]");
    if (!button || button.disabled) return;
    selectDevelopmentPath(button.dataset.developmentPath);
  });
  $("start-career-match")?.addEventListener("click", startPracticeGame);
  $("start-next-scheduled-game")?.addEventListener("click", startScheduledGame);
  $("training-actions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-training]");
    if (!button || button.disabled) return;
    trainSelectedPlayer(button.dataset.training);
  });
  document.querySelectorAll("a[href^='#']").forEach((link) => link.addEventListener("click", () => {
    const targetId = link.getAttribute("href")?.slice(1);
    const target = targetId ? $(targetId) : null;
    const disclosure = target?.closest("details");
    if (disclosure) disclosure.open = true;
  }));
  document.querySelectorAll(".section-nav-link").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll(".section-nav-link").forEach((item) => item.classList.remove("is-active"));
    link.classList.add("is-active");
  }));
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
    network.assignedPosition = preferredPlayer.position;
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
