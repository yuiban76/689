"use strict";

const $ = (id) => document.getElementById(id);
const actionButtons = [...document.querySelectorAll("[data-action]")];
const PROTOCOL_VERSION = 5;
const MAX_PLAYERS = 9;
const MAX_LOG = 14;
const MATCH_EVENT_TIMEOUTS = window.MatchEngine?.EVENT_TIMEOUT_MS || { pitch: 15000, catcherCall: 12000, fielding: 8000, batting: 15000, runner: 9000 };
const ACTION_TIMEOUT_MS = { defense: MATCH_EVENT_TIMEOUTS.pitch, catcher: MATCH_EVENT_TIMEOUTS.catcherCall, fielding: MATCH_EVENT_TIMEOUTS.fielding, home: MATCH_EVENT_TIMEOUTS.batting, runner: MATCH_EVENT_TIMEOUTS.runner };
const MATCH_TIMING_TIMEOUT_MS = 5000;
const DIFFICULTY_CONFIG = {
  label: "競技",
  swingWindow: 0.9,
  patientBase: 0.32,
  buntHitChance: 0.12,
  stealBaseChance: 0.32,
  fieldingSuccessScale: 0.88,
};
const SESSION_STORAGE_KEY = "jiuju-session-id-v1";
const PRACTICE_SESSIONS_PER_DAY = 0; // Retired; retained only for old save compatibility.
const MAX_NETWORK_BOOST = 79; // Covers the full legal 20–99 attribute range.

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
const PLAYER_SAVE_VERSION = 2;
const MAX_CUSTOM_PLAYERS = 18;
const CPBL_SEASON_YEAR = 2026;
const CPBL_DATA_SNAPSHOT = "2026-08-23";
const CPBL_TOTAL_SEASON_GAMES = 360;
const DEFAULT_TEAM_ID = "taipei";
const DEFAULT_OPPONENT_ID = "kaohsiung";

const TEAM_DEFS = [
  { id: "taipei", name: "中洲兄弟", city: "台中", shortName: "中洲", stadium: "臺中洲際棒球場", style: "火力與串聯", color: "#f4c542", bonus: { contact: 5, power: 5, vision: 2, discipline: 2, armAccuracy: 1 }, leagueStats: { games: 31, wins: 16, losses: 15, ties: 0, battingAvg: .282, onBasePct: .334, sluggingPct: .374, era: 3.61 } },
  { id: "kaohsiung", name: "統合超商獅", city: "台南", shortName: "統合獅", stadium: "臺南亞太國際棒球場", style: "控球與機動", color: "#f26b38", bonus: { contact: 3, vision: 3, discipline: 3, control: 3, break: 3, speed: 2 }, leagueStats: { games: 31, wins: 15, losses: 16, ties: 0, battingAvg: .271, onBasePct: .334, sluggingPct: .343, era: 2.87 } },
  { id: "taichung", name: "樂園桃猿", city: "桃園", shortName: "樂園猿", stadium: "桃園國際棒球場", style: "投手壓制", color: "#e74675", bonus: { fielding: 2, reaction: 2, control: 4, break: 5, stamina: 2 }, leagueStats: { games: 27, wins: 15, losses: 12, ties: 0, battingAvg: .253, onBasePct: .308, sluggingPct: .334, era: 2.14 } },
  { id: "hsinchu", name: "富利悍將", city: "新北", shortName: "富利", stadium: "新莊棒球場", style: "長打與強肩", color: "#5a8dee", bonus: { power: 2, armStrength: 2, velocity: -1, control: -2, fielding: -1 }, leagueStats: { games: 27, wins: 12, losses: 15, ties: 0, battingAvg: .248, onBasePct: .305, sluggingPct: .316, era: 4.26 } },
  { id: "taoyuan", name: "味冠龍", city: "台北", shortName: "味冠", stadium: "天母棒球場", style: "守備與先發", color: "#cf3038", bonus: { fielding: 3, reaction: 3, control: 4, break: 3, stamina: 2, contact: -2 }, leagueStats: { games: 29, wins: 16, losses: 13, ties: 0, battingAvg: .232, onBasePct: .305, sluggingPct: .315, era: 2.87 } },
  { id: "chiayi", name: "南鋼雄鷹", city: "高雄", shortName: "南鋼", stadium: "澄清湖棒球場", style: "速度與選球", color: "#61b6c9", bonus: { contact: 3, discipline: 4, speed: 4, stealing: 3, power: 1, control: -1, velocity: -1 }, leagueStats: { games: 29, wins: 13, losses: 16, ties: 0, battingAvg: .271, onBasePct: .340, sluggingPct: .355, era: 3.95 } },
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
  taipei: ["岳正華", "詹子玄", "王威宸", "許基鴻", "宋勝睿", "王正順", "江昆宇", "高育傑", "鄭皓均"],
  kaohsiung: ["陳杰憲", "林嘉緯", "潘杰凱", "林梓豪", "蘇志傑", "林敬凱", "陳勝平", "陳仲羽", "布雷格"],
  taichung: ["成進", "林正華", "梁嘉榮", "廖建福", "陳辰威", "林利", "林成飛", "林宏育", "威能迪"],
  hsinchu: ["林哲玄", "申浩瑋", "李宗玄", "范國辰", "孔念安", "王政棠", "王盛偉", "戴沛峰", "鈴木俊輔"],
  taoyuan: ["郭天鑫", "陳梓豪", "劉基宏", "朱育玄", "拿姆．伊漾", "李楷威", "張正禹", "吉力吉洛．鞏冠", "剛龍"],
  chiayi: ["藍寅綸", "王柏榮", "郭富林", "摩鷹", "陳文傑", "吳念廷", "曾梓祐", "吳明宏", "厚勁"],
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

const BUILD_POINT_BUDGET = 18;
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
  { id: "balanced", label: "五工具球員", role: "全能成長", detail: "攻守均衡，所有主項都有中高上限", positions: "field", focus: ["contact", "power", "speed", "fielding"], adjustments: CUSTOM_ARCHETYPES.balanced.adjustments, capBoosts: { contact: 3, power: 3, speed: 3, fielding: 3 }, potential: 91 },
  { id: "contact", label: "擊球串聯", role: "高上壘打者", detail: "高擊球與選球上限，以持續上壘帶動攻勢", positions: "field", focus: ["contact", "vision", "discipline", "speed"], adjustments: { contact: 11, power: -5, vision: 8, discipline: 8, clutch: 5, speed: 5, stealing: 5, bunt: 8, dragBunt: 7, fielding: 1 }, capBoosts: { contact: 5, vision: 5, discipline: 5, speed: 2 }, potential: 92 },
  { id: "slugger", label: "長打砲", role: "中心打者", detail: "長打與關鍵打擊高上限，守備與速度受到限制", positions: "field", focus: ["power", "clutch", "contact"], adjustments: CUSTOM_ARCHETYPES.slugger.adjustments, capBoosts: { power: 6, clutch: 5, contact: 2 }, potential: 93 },
  { id: "speedster", label: "飛毛腿跑者", role: "速度跑者", detail: "速度、盜壘、短打為主，力量上限較低", positions: "field", focus: ["speed", "stealing", "bunt", "dragBunt"], adjustments: CUSTOM_ARCHETYPES.speedster.adjustments, capBoosts: { speed: 6, stealing: 6, bunt: 5, dragBunt: 5 }, potential: 91 },
  { id: "defender", label: "守備魔術師", role: "守備核心", detail: "範圍、反應與傳球高上限，長打受到限制", positions: "field", focus: ["fielding", "reaction", "armStrength", "armAccuracy"], adjustments: CUSTOM_ARCHETYPES.defender.adjustments, capBoosts: { fielding: 6, reaction: 6, armStrength: 4, armAccuracy: 5 }, potential: 92 },
  { id: "middle-infield", label: "內野引擎", role: "二游核心", detail: "適合二壘與游擊：守備、反應、速度兼備", positions: ["2B", "SS"], focus: ["fielding", "reaction", "speed", "contact"], adjustments: { contact: 6, power: -6, speed: 9, stealing: 5, fielding: 11, reaction: 12, armAccuracy: 8 }, capBoosts: { fielding: 6, reaction: 6, speed: 4, armAccuracy: 4 }, potential: 92 },
  { id: "corner-cannon", label: "強肩角落", role: "邊線攻防", detail: "適合三壘與角落外野：長打、臂力與關鍵一擊", positions: ["3B", "LF", "RF"], focus: ["power", "clutch", "armStrength"], adjustments: { contact: 3, power: 10, clutch: 8, speed: 1, fielding: 4, armStrength: 12, armAccuracy: 5 }, capBoosts: { power: 5, clutch: 4, armStrength: 6 }, potential: 92 },
  { id: "catcher-captain", label: "配球指揮官", role: "主戰捕手", detail: "擋球、臂力與關鍵時刻的領導力", positions: ["C"], focus: ["blocking", "armStrength", "armAccuracy", "clutch"], adjustments: { contact: 1, power: 1, discipline: 6, clutch: 9, speed: -4, stealing: -6, fielding: 8, reaction: 6, armStrength: 11, armAccuracy: 9, blocking: 16 }, capBoosts: { blocking: 7, armStrength: 5, armAccuracy: 5, clutch: 3 }, potential: 93 },
  { id: "pitcher-control", label: "控球王牌", role: "精準先發", detail: "控球、變化球與吃局能力優先", positions: ["P"], focus: ["control", "break", "stamina", "clutch"], adjustments: CUSTOM_ARCHETYPES.pitcher.adjustments, capBoosts: { control: 6, break: 5, stamina: 4 }, potential: 93 },
  { id: "pitcher-flame", label: "火球強投", role: "三振型先發", detail: "球速與三振威脅極高，控球上限較低", positions: ["P"], focus: ["velocity", "break", "stamina"], adjustments: { contact: -9, power: -8, speed: -5, fielding: 2, reaction: 2, velocity: 17, control: -2, break: 10, stamina: 9, clutch: 7 }, capBoosts: { velocity: 7, break: 4, stamina: 3 }, potential: 94 },
  { id: "pitcher-break", label: "變化球大師", role: "球路型投手", detail: "用球路位移與控球讓打者失去節奏", positions: ["P"], focus: ["break", "control", "clutch"], adjustments: { contact: -8, power: -7, speed: -4, fielding: 2, velocity: 6, control: 9, break: 17, stamina: 8, clutch: 8 }, capBoosts: { break: 7, control: 4, clutch: 3 }, potential: 93 },
  { id: "pitcher-workhorse", label: "耐投工作馬", role: "吃局先發", detail: "體力、控球與守備穩定，球速成長較慢", positions: ["P"], focus: ["stamina", "control", "fielding"], adjustments: { contact: -6, power: -7, speed: -3, fielding: 8, reaction: 5, velocity: -2, control: 10, break: 5, stamina: 17, clutch: 5 }, capBoosts: { stamina: 7, control: 5, fielding: 3 }, potential: 92 },
  { id: "pitcher-closer", label: "終結者", role: "高壓後援", detail: "球速、變化球與關鍵能力高，體力上限受限", positions: ["P"], focus: ["velocity", "break", "clutch"], adjustments: { contact: -9, power: -8, speed: -4, velocity: 13, control: 2, break: 12, stamina: -7, clutch: 13 }, capBoosts: { velocity: 6, break: 6, clutch: 5 }, potential: 93 },
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
  const splitParent = { contactL: "contact", contactR: "contact", powerL: "power", powerR: "power" }[key];
  if (splitParent) return Math.min(99, builderCapFor(position, template, splitParent) + 3);
  const pitchingKeys = ["velocity", "control", "break", "stamina"];
  const fieldingKeys = ["fielding", "reaction", "armStrength", "armAccuracy", "blocking"];
  let cap = 88;
  if (position === "P" && pitchingKeys.includes(key)) cap = 88;
  if (position === "P" && !pitchingKeys.includes(key) && key !== "clutch") cap = 72;
  if (position !== "P" && pitchingKeys.includes(key)) cap = 68;
  if (position === "C" && key === "blocking") cap = 90;
  if (position !== "C" && key === "blocking") cap = 72;
  if (template.focus.includes(key)) cap += 6;
  cap += Number(template.capBoosts?.[key] || 0);
  if (fieldingKeys.includes(key) && template.id === "slugger") cap = Math.min(cap, 82);
  if (["speed", "stealing"].includes(key) && template.id === "slugger") cap = Math.min(cap, 76);
  if (key === "stamina" && template.id === "pitcher-closer") cap = Math.min(cap, 82);
  if (builderOverallKeys(position).includes(key)) cap = Math.max(cap, key === "speed" ? 84 : 88);
  return Math.min(96, Math.max(60, Math.round(cap)));
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
    const pitchingKey = ["velocity", "control", "break", "stamina"].includes(key);
    const base = position === "P" ? (pitchingKey ? 53 : 38) : (pitchingKey ? 35 : key === "blocking" ? (position === "C" ? 52 : 32) : 50);
    const adjusted = base + Number(team.bonus[key] || 0) * 0.35 + Number(template.adjustments[key] || 0) * 0.55;
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
      version: 2,
      templateId: buildTemplate.id,
      templateLabel: buildTemplate.label,
      pointBudget: BUILD_POINT_BUDGET,
      caps: Object.fromEntries(Object.keys(blueprint.ratings).filter((key) => key !== "popTime").map((key) => [key, Math.max(builderCapFor(position, buildTemplate, key), Number(ratings[key] || 0))])),
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
    postseason: source.seasonYear === CPBL_SEASON_YEAR && source.postseason && typeof source.postseason === "object" ? source.postseason : null,
  };
}
let scheduleStore = normalizeScheduleStore(readStorage(SCHEDULE_STORAGE_KEY, {}));
const initialCustomPlayer = customPlayerIndex[readStorage(PLAYER_SAVE_META_KEY, {}).activePlayerId] || customPlayers.slice().reverse().find((player) => player.active !== false) || null;
let selectedTeamId = DEFAULT_TEAM_ID;
let selectedOpponentId = DEFAULT_OPPONENT_ID;
let developmentTeamId = initialCustomPlayer?.teamId || DEFAULT_TEAM_ID;
let selectedAthleteId = initialCustomPlayer?.id || `${DEFAULT_TEAM_ID}-cf`;
let selectedCustomPlayerId = initialCustomPlayer?.id || "";
let careerStatus = "建立自創球員後，就能展開自己的球員生涯。";
let careerStatusTone = "";
let activeCareerTab = "overview";
let activePracticeChallenge = null;
let practiceAnimationFrame = 0;
let practiceRuntimeTimer = 0;
let matchTimingChallenge = null;
let matchTimingAnimationFrame = 0;
let matchTimingTimer = 0;
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
  const potentialRatings = Object.fromEntries(Object.keys(draft.ratings).map((key) => [key, builderCapFor(draft.position, template, key)]));
  if (capNote) capNote.textContent = `初始總評固定 60；最終潛力總評 ${overallForPlayer({ position: draft.position, ratings: potentialRatings })}。建立後模板與能力投入固定，無洗點；使用實戰生涯幣逐點升級。`;
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
    trainingPoints: 0,
    careerCoins: 80,
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
    legacyPoints: 0,
    focusMeter: 0,
    preGamePlan: "",
    preGamePlanDay: "",
    keyGameIndex: 0,
    keyGamesCompleted: 0,
    completedPositionChallenges: [],
    recentMatches: [],
    record: { games: 0, wins: 0, losses: 0, ties: 0 },
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
    profile.preGamePlan = "";
    profile.preGamePlanDay = "";
  }
  profile.practiceSessions = clamp(Number(profile.practiceSessions ?? PRACTICE_SESSIONS_PER_DAY), 0, PRACTICE_SESSIONS_PER_DAY);
  profile.practiceScore = Math.max(0, Number(profile.practiceScore || 0));
  profile.lastPractice = String(profile.lastPractice || "");
  const legacyTrainingPoints = Math.max(0, Number(profile.trainingPoints || 0));
  profile.careerCoins = Math.max(0, Number.isFinite(Number(profile.careerCoins)) ? Number(profile.careerCoins) : 80 + legacyTrainingPoints * 35);
  profile.trainingPoints = 0;
  profile.developmentPath = DEVELOPMENT_PATHS[profile.developmentPath] ? profile.developmentPath : "balanced";
  profile.goalIndex = clamp(Number(profile.goalIndex || 0), 0, CAREER_GOALS.length - 1);
  profile.goalProgress = Math.max(0, Number(profile.goalProgress || 0));
  profile.lastGrade = clamp(Number(profile.lastGrade || 0), 0, 99);
  profile.legacyPoints = Math.max(0, Number(profile.legacyPoints || 0));
  profile.focusMeter = clamp(Number(profile.focusMeter || 0), 0, 100);
  profile.preGamePlan = GAME_PREP_PLANS[profile.preGamePlan] ? profile.preGamePlan : "";
  profile.preGamePlanDay = String(profile.preGamePlanDay || "");
  profile.keyGameIndex = Math.max(0, Number(profile.keyGameIndex || 0));
  profile.keyGamesCompleted = Math.max(0, Number(profile.keyGamesCompleted || 0));
  profile.completedPositionChallenges = Array.isArray(profile.completedPositionChallenges)
    ? [...new Set(profile.completedPositionChallenges.map((id) => String(id).slice(0, 64)))].slice(0, 9)
    : [];
  profile.recentMatches = Array.isArray(profile.recentMatches) ? profile.recentMatches.slice(0, 5) : [];
  profile.record = {
    games: Math.max(0, Number(profile.record?.games || 0)),
    wins: Math.max(0, Number(profile.record?.wins || 0)),
    losses: Math.max(0, Number(profile.record?.losses || 0)),
    ties: Math.max(0, Number(profile.record?.ties || 0)),
  };
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
  const leftContactBonus = base.bats === "左" ? 3 : 0;
  const rightContactBonus = base.bats === "右" ? 3 : 0;
  ratings.contactL = clamp(Number(ratings.contact || 0) + leftContactBonus, 20, 99);
  ratings.contactR = clamp(Number(ratings.contact || 0) + rightContactBonus, 20, 99);
  ratings.powerL = clamp(Number(ratings.power || 0) + leftContactBonus, 20, 99);
  ratings.powerR = clamp(Number(ratings.power || 0) + rightContactBonus, 20, 99);
  return {
    ...base,
    ratings,
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    trainingPoints: profile?.trainingPoints || 0,
    careerCoins: profile?.careerCoins || 0,
    specialist: profile?.specialist || {},
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

function defaultLineupIdsForTeam(teamId) {
  const roster = TEAM_BY_ID[teamId]?.roster || [];
  return Object.fromEntries(POSITION_DEFS.map(({ code }) => {
    const player = activeCustomPlayerForPosition(teamId, code) || roster.find((candidate) => candidate.position === code);
    return [code, player?.id || ""];
  }));
}

function normalizeLineupIds(teamId, incoming = {}) {
  const defaults = defaultLineupIdsForTeam(teamId);
  return Object.fromEntries(POSITION_DEFS.map(({ code }) => {
    const candidate = playerDefinitionFor(incoming?.[code]);
    const valid = candidate?.teamId === teamId && candidate.position === code;
    return [code, valid ? candidate.id : defaults[code]];
  }));
}

function rosterForTeam(teamId = state?.teamId || selectedTeamId) {
  const roster = TEAM_BY_ID[teamId]?.roster || [];
  return roster.map((basePlayer) => activeCustomPlayerForPosition(teamId, basePlayer.position) || basePlayer);
}

function activeLineup() {
  const teamId = state?.teamId || selectedTeamId;
  const roster = rosterForTeam(teamId);
  return (roster.length ? roster : []).map((player) => {
    const networkPlayer = matchPlayerForPosition(player.position, teamId);
    if (networkPlayer) return networkPlayer;
    const selectedId = state?.teamId === teamId ? state.lineupIds?.[player.position] : "";
    const selected = playerDefinitionFor(selectedId);
    if (selected?.teamId === teamId && selected.position === player.position) return developedPlayer(selected.id);
    return developedPlayer(player.id);
  });
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
  const innings = Object.hasOwn(stats, "outs") ? Number(stats.outs || 0) / 3 : Number(stats.IP || 0);
  const fipConstant = 3.1;
  return { ERA: innings ? (Number(stats.ER || 0) * 9) / innings : 0, WHIP: innings ? (Number(stats.H || 0) + Number(stats.BB || 0)) / innings : 0, K9: innings ? (Number(stats.SO || 0) * 9) / innings : 0, FIP: innings ? ((Number(stats.HR || 0) * 13) + (3 * (Number(stats.BB || 0) + Number(stats.HBP || 0))) - (2 * Number(stats.SO || 0))) / innings + fipConstant : 0 };
}

function calculateFieldingLine(stats = {}) {
  const chances = Number(stats.PO || 0) + Number(stats.A || 0) + Number(stats.E || 0);
  return { FPCT: chances ? (Number(stats.PO || 0) + Number(stats.A || 0)) / chances : 0, RF9: Number(stats.INN || 0) ? ((Number(stats.PO || 0) + Number(stats.A || 0)) * 9) / Number(stats.INN) : 0 };
}

const PRACTICE_META = {
  hitting: { title: "打擊挑戰", detail: "擊球能力 · 擊球視野 · 關鍵打擊", xp: 28, focus: ["contact", "vision", "clutch"] },
  defense: { title: "守備反應", detail: "守備範圍 · 反應速度 · 傳球", xp: 27, focus: ["fielding", "reaction", "armAccuracy"] },
  pitching: { title: "投球控制", detail: "投球控球 · 變化球 · 體力", xp: 30, focus: ["control", "break", "stamina"] },
  speed: { title: "跑壘判斷", detail: "跑壘速度 · 盜壘 · 短打", xp: 25, focus: ["speed", "stealing", "bunt"] },
};

const PRACTICE_SCENARIOS = {
  hitting: [
    { question: "球數 3 壞 1 好，投手控球開始不穩，你要怎麼進攻？", choices: ["鎖定好球帶中央，等失投", "任何球都全力揮擊", "直接嘗試短打"], correct: 0, lesson: "領先球數時縮小攻擊區，能提高上壘與強擊球機會。" },
    { question: "兩好球後遇到外角變化球，你的優先目標是？", choices: ["保護好球帶、往反方向推打", "只等紅中速球", "每球都拉打"], correct: 0, lesson: "兩好球後先延長打席，再等待能確實處理的球。" },
  ],
  defense: [
    { question: "一出局、三壘有人，淺外野飛球落向你，你要先做什麼？", choices: ["確認接球並快速對準本壘", "提早往內野跑", "接到後慢慢回傳"], correct: 0, lesson: "先確實接殺，再用腳步與傳球壓制犧牲飛球。" },
    { question: "滾地球穿向二游間、跑者速度快，你的最佳處理是？", choices: ["正面擋下後快速傳一壘", "冒險空手反手撈球", "放慢等隊友處理"], correct: 0, lesson: "先把球留在身前，穩定完成出局比華麗動作更重要。" },
  ],
  pitching: [
    { question: "滿球數、壘上有人，打者剛連續追打外角球，你要怎麼配？", choices: ["外角邊緣控球，保留引誘空間", "紅中直球硬拚", "連投三顆相同位置"], correct: 0, lesson: "滿球數仍要利用打者傾向，不必把球送進最甜的位置。" },
    { question: "第一球搶到好球後，下一球最合理的目的？", choices: ["改變速度或視線高度", "完全重複上一球", "故意投到正中央"], correct: 0, lesson: "球速差與進壘點變化能破壞打者節奏。" },
  ],
  speed: [
    { question: "一壘有人、兩出局，外野深遠飛球落地，你在一壘要怎麼做？", choices: ["兩出局立即啟動，全速推進", "先回壘確認接球", "只前進到二壘"], correct: 0, lesson: "兩出局不需等待接殺結果，起跑能多爭取一個壘包。" },
    { question: "你在一壘準備盜壘，最該觀察哪個訊號？", choices: ["投手固定式節奏與捕手傳球", "觀眾音量", "下一棒背號"], correct: 0, lesson: "抓住投手固定節奏，並評估捕手臂力，才是成功盜壘的基礎。" },
  ],
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
  { label: "完成 2 次球場訓練", detail: "先建立穩定的每日準備節奏。", kind: "practice", target: 2, reward: 35 },
  { label: "完成 1 場關鍵賽事", detail: "把訓練成果帶進正式比賽。", kind: "match", target: 1, reward: 45 },
  { label: "訓練拿到 80 分", detail: "完成一次高品質的實戰操作。", kind: "score", target: 1, reward: 40 },
  { label: "累積 150 XP", detail: "持續比賽與訓練，建立自己的球風。", kind: "xp", target: 150, reward: 55 },
  { label: "連續完成 3 次準備", detail: "讓教練看見你的職業態度。", kind: "practice", target: 3, reward: 50 },
  { label: "再完成 2 場比賽", detail: "用穩定出賽爭取固定先發。", kind: "match", target: 2, reward: 70 },
  { label: "訓練拿到 90 分", detail: "把一項技術練到能在壓力下執行。", kind: "score", target: 1, reward: 65 },
  { label: "累積 300 XP", detail: "完成本階段專精，邁向球隊核心。", kind: "xp", target: 300, reward: 100 },
];

const KEY_GAME_DEFS = [
  { chapter: "菜鳥登場", label: "第一次一軍機會", story: "教練只承諾你一次證明自己的機會。", detail: "完成比賽且評分達到 65", xp: 70, coins: 75, legacy: 18, reward: "70 XP · 75 生涯幣 · 18 信任", test: ({ grade }) => grade >= 65 },
  { chapter: "菜鳥登場", label: "板凳席的目光", story: "隊友開始注意這名新人的比賽態度。", detail: "完成 2 次有效決策", xp: 75, coins: 80, legacy: 20, reward: "75 XP · 80 生涯幣 · 20 信任", test: ({ match }) => Number(match.decisions || 0) >= 2 },
  { chapter: "菜鳥登場", label: "第一次系列戰", story: "面對同區對手，這是提高教練信任的捷徑。", detail: "幫助球隊拿下勝利", xp: 85, coins: 90, legacy: 24, reward: "85 XP · 90 生涯幣 · 24 信任", test: ({ result }) => result === "win" || result === "walkoff" },
  { chapter: "爭取先發", label: "教練的考驗", story: "教練要求你把訓練品質帶進正式比賽。", detail: "單場評分達到 76", xp: 90, coins: 95, legacy: 26, reward: "90 XP · 95 生涯幣 · 26 信任", test: ({ grade }) => grade >= 76 },
  { chapter: "爭取先發", label: "攻守建功", story: "一個能在攻守兩端幫助球隊的人才值得先發。", detail: "敲出安打或完成守備機會", xp: 95, coins: 100, legacy: 28, reward: "95 XP · 100 生涯幣 · 28 信任", test: ({ match }) => Number(match.hits || 0) + Number(match.putouts || 0) + Number(match.assists || 0) >= 1 },
  { chapter: "爭取先發", label: "站穩打線", story: "媒體開始討論你是否該獲得固定先發。", detail: "完成 3 次決策且評分達到 75", xp: 100, coins: 110, legacy: 30, reward: "100 XP · 110 生涯幣 · 30 信任", test: ({ grade, match }) => grade >= 75 && Number(match.decisions || 0) >= 3 },
  { chapter: "球隊核心", label: "終止連敗", story: "球隊陷入低潮，休息區需要有人挺身而出。", detail: "拿下勝利且評分達到 78", xp: 110, coins: 120, legacy: 34, reward: "110 XP · 120 生涯幣 · 34 信任", test: ({ result, grade }) => (result === "win" || result === "walkoff") && grade >= 78 },
  { chapter: "球隊核心", label: "王牌對決", story: "對方派出最強投手，這是明星球員的舞台。", detail: "敲出安打或將評分提高到 82", xp: 115, coins: 125, legacy: 36, reward: "115 XP · 125 生涯幣 · 36 信任", test: ({ grade, match }) => grade >= 82 || Number(match.hits || 0) >= 1 },
  { chapter: "球隊核心", label: "宿敵之夜", story: "滿場觀眾等待你在宿敵戰留下代表作。", detail: "完成 4 次有效決策", xp: 120, coins: 135, legacy: 38, reward: "120 XP · 135 生涯幣 · 38 信任", test: ({ match }) => Number(match.decisions || 0) >= 4 },
  { chapter: "冠軍追逐", label: "季後賽卡位", story: "每一場都牽動排名，球隊把勝負交到你手上。", detail: "幫助球隊贏球且評分達到 80", xp: 130, coins: 145, legacy: 42, reward: "130 XP · 145 生涯幣 · 42 信任", test: ({ result, grade }) => (result === "win" || result === "walkoff") && grade >= 80 },
  { chapter: "冠軍追逐", label: "背水一戰", story: "輸球就可能告別球季，休息區只相信最穩定的人。", detail: "攻守合計完成 2 次貢獻", xp: 140, coins: 155, legacy: 46, reward: "140 XP · 155 生涯幣 · 46 信任", test: ({ match }) => Number(match.hits || 0) + Number(match.putouts || 0) + Number(match.assists || 0) >= 2 },
  { chapter: "冠軍追逐", label: "傳奇之夜", story: "所有累積都在這一晚接受檢驗。", detail: "拿下勝利並取得 88 分評價", xp: 170, coins: 190, legacy: 55, reward: "170 XP · 190 生涯幣 · 55 信任", test: ({ result, grade }) => (result === "win" || result === "walkoff") && grade >= 88 },
];

const CAREER_RANKS = [
  { label: "新人報到", min: 0, next: 60 },
  { label: "輪值成員", min: 60, next: 150 },
  { label: "穩定先發", min: 150, next: 300 },
  { label: "球隊核心", min: 300, next: 520 },
  { label: "聯盟明星", min: 520, next: 800 },
  { label: "傳奇門檻", min: 800, next: 1100 },
];

const GAME_PREP_PLANS = {
  hitting: { label: "打擊會議", detail: "已完成對手投手報告；本日打擊判斷獲得小幅加成。", focus: 12, xp: 8, fatigue: 2, morale: 1 },
  defense: { label: "守備佈陣", detail: "已完成落點與跑者傾向會議；本日守備成功率獲得小幅加成。", focus: 10, xp: 10, fatigue: 2, morale: 1 },
  recovery: { label: "恢復日", detail: "完成伸展、冰敷與睡眠管理，降低疲勞並提升士氣。", focus: 3, xp: 4, fatigue: -15, morale: 4 },
};

const CAREER_CHAPTERS = [
  { label: "菜鳥登場", target: "完成 3 場關鍵賽事", games: 0, legacy: 0, story: "教練團觀察期", copy: "把握有限上場機會，讓每一次打席與守備都留下印象。", quote: "先證明你能幫助球隊贏球。" },
  { label: "爭取先發", target: "教練信任達到 45", games: 3, legacy: 55, story: "先發競爭開始", copy: "你已進入輪值競爭，穩定決策比偶爾的亮眼數據更重要。", quote: "我要看的不是一場爆發，是你每天都準備好了。" },
  { label: "球隊核心", target: "完成 9 場關鍵賽事", games: 6, legacy: 170, story: "休息區需要你的聲音", copy: "球隊開始依賴你的表現，宿敵戰與低潮期都會把壓力交給你。", quote: "現在，隊友會看你怎麼回應逆境。" },
  { label: "冠軍追逐", target: "贏下傳奇之夜", games: 10, legacy: 360, story: "把名字留在旗幟上", copy: "例行賽只是起點，接下來每次上場都可能決定球季。", quote: "明星贏數據，核心替球隊贏下十月。" },
];

const CAREER_BADGES = [
  { id: "contact", label: "精準擊球", detail: "由安打與保送累積", value: (stats, profile) => Number(stats.batting.H || 0) * 14 + Number(stats.batting.BB || 0) * 8 + Number(profile.keyGamesCompleted || 0) * 4 },
  { id: "power", label: "長打威脅", detail: "由二壘打、三壘打與全壘打累積", value: (stats) => Number(stats.batting.doubles || 0) * 12 + Number(stats.batting.triples || 0) * 18 + Number(stats.batting.HR || 0) * 30 },
  { id: "defense", label: "鐵壁守備", detail: "由刺殺與助殺累積，失誤會扣分", value: (stats) => Math.max(0, Number(stats.fielding.PO || 0) * 14 + Number(stats.fielding.A || 0) * 9 - Number(stats.fielding.E || 0) * 12) },
  { id: "speed", label: "飛毛腿", detail: "由成功盜壘與得分累積", value: (stats) => Number(stats.batting.SB || 0) * 28 + Number(stats.batting.R || 0) * 8 },
];

function developmentPathFor(pathId) {
  return DEVELOPMENT_PATHS[pathId] || DEVELOPMENT_PATHS.balanced;
}

function activeCareerGoal(profile) {
  const index = clamp(Number(profile?.goalIndex || 0), 0, CAREER_GOALS.length - 1);
  return CAREER_GOALS[index] || CAREER_GOALS[0];
}

function careerCoachTrust(profile) {
  if (!profile) return 0;
  return clamp(Math.round(18
    + Number(profile.legacyPoints || 0) * .13
    + Number(profile.keyGamesCompleted || 0) * 3
    + Math.max(0, Number(profile.lastGrade || 0) - 60) * .12), 0, 99);
}

function careerChapterIndexFor(profile) {
  if (!profile) return 0;
  const games = Number(profile.record?.games || 0);
  const legacy = Number(profile.legacyPoints || 0);
  let index = 0;
  CAREER_CHAPTERS.forEach((chapter, chapterIndex) => {
    if (games >= chapter.games && legacy >= chapter.legacy) index = chapterIndex;
  });
  return index;
}

function careerChapterFor(profile) {
  return CAREER_CHAPTERS[careerChapterIndexFor(profile)] || CAREER_CHAPTERS[0];
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
  const reward = Math.max(25, Number(goal.reward || 25));
  profile.careerCoins = Math.max(0, Number(profile.careerCoins || 0) + reward);
  return `完成目標「${completed}」，獲得 ${reward} 生涯幣`;
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
    profile.careerCoins = Math.max(0, Number(profile.careerCoins || 0) + 70);
    levels += 1;
  }

  return levels;
}

function serializeCareerProfile(profile) {
  return {
    level: clamp(Number(profile?.level || 1), 1, 99),
    xp: Math.max(0, Number(profile?.xp || 0)),
    trainingPoints: 0,
    careerCoins: Math.max(0, Number(profile?.careerCoins || 0)),
    fatigue: clamp(Number(profile?.fatigue || 0), 0, 100),
    morale: clamp(Number(profile?.morale || 72), 0, 99),
    developmentPath: DEVELOPMENT_PATHS[profile?.developmentPath] ? profile.developmentPath : "balanced",
    goalIndex: clamp(Number(profile?.goalIndex || 0), 0, CAREER_GOALS.length - 1),
    goalProgress: Math.max(0, Number(profile?.goalProgress || 0)),
    lastGrade: clamp(Number(profile?.lastGrade || 0), 0, 99),
    legacyPoints: Math.max(0, Number(profile?.legacyPoints || 0)),
    focusMeter: 0,
    specialist: { ...(profile?.specialist || {}) },
    preGamePlan: GAME_PREP_PLANS[profile?.preGamePlan] ? profile.preGamePlan : "",
    preGamePlanDay: String(profile?.preGamePlanDay || ""),
    keyGameIndex: Math.max(0, Number(profile?.keyGameIndex || 0)),
    keyGamesCompleted: Math.max(0, Number(profile?.keyGamesCompleted || 0)),
    completedPositionChallenges: Array.isArray(profile?.completedPositionChallenges)
      ? [...new Set(profile.completedPositionChallenges.map((id) => String(id).slice(0, 64)))].slice(0, 9)
      : [],
    recentMatches: Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice(0, 5) : [],
    record: {
      games: Math.max(0, Number(profile?.record?.games || 0)),
      wins: Math.max(0, Number(profile?.record?.wins || 0)),
      losses: Math.max(0, Number(profile?.record?.losses || 0)),
      ties: Math.max(0, Number(profile?.record?.ties || 0)),
    },
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
    trainingPoints: 0,
    careerCoins: Math.max(0, Number(incomingProfile.careerCoins ?? (Number(incomingProfile.trainingPoints || 0) * 35 || 80))),
    fatigue: clamp(Number(incomingProfile.fatigue || 0), 0, 100),
    morale: clamp(Number(incomingProfile.morale || 72), 0, 99),
    developmentPath: DEVELOPMENT_PATHS[incomingProfile.developmentPath] ? incomingProfile.developmentPath : "balanced",
    goalIndex: clamp(Number(incomingProfile.goalIndex || 0), 0, CAREER_GOALS.length - 1),
    goalProgress: Math.max(0, Number(incomingProfile.goalProgress || 0)),
    lastGrade: clamp(Number(incomingProfile.lastGrade || 0), 0, 99),
    legacyPoints: Math.max(0, Number(incomingProfile.legacyPoints || 0)),
    focusMeter: 0,
    specialist: Object.fromEntries(Object.keys(window.CareerEngine.TRACKS).map((key) => [key, clamp(incomingProfile.specialist?.[key], 0, 1000000)])),
    preGamePlan: GAME_PREP_PLANS[incomingProfile.preGamePlan] ? incomingProfile.preGamePlan : "",
    preGamePlanDay: String(incomingProfile.preGamePlanDay || ""),
    keyGameIndex: Math.max(0, Number(incomingProfile.keyGameIndex || 0)),
    keyGamesCompleted: Math.max(0, Number(incomingProfile.keyGamesCompleted || 0)),
    completedPositionChallenges: Array.isArray(incomingProfile.completedPositionChallenges)
      ? [...new Set(incomingProfile.completedPositionChallenges.map((id) => String(id).slice(0, 64)))].slice(0, 9)
      : [],
    recentMatches: Array.isArray(incomingProfile.recentMatches) ? incomingProfile.recentMatches.slice(0, 5) : [],
    record: {
      games: Math.max(0, Number(incomingProfile.record?.games || 0)),
      wins: Math.max(0, Number(incomingProfile.record?.wins || 0)),
      losses: Math.max(0, Number(incomingProfile.record?.losses || 0)),
      ties: Math.max(0, Number(incomingProfile.record?.ties || 0)),
    },
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
    const selectedId = state?.lineupIds?.[position];
    const selected = playerDefinitionFor(selectedId);
    if (selected?.teamId === teamId && selected.position === position) return developedPlayer(selected.id);
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

function setCareerTab(tabId) {
  activeCareerTab = ["overview", "keygame", "training", "badges"].includes(tabId) ? tabId : "overview";
  document.querySelectorAll("[data-career-tab]").forEach((button) => {
    const active = button.dataset.careerTab === activeCareerTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-career-panel]").forEach((panel) => {
    const active = panel.dataset.careerPanel === activeCareerTab;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

function runPracticeDrill() { window.CareerMode?.retiredTraining(); }

function clearPracticeRuntime() {
  if (practiceAnimationFrame) window.cancelAnimationFrame(practiceAnimationFrame);
  if (practiceRuntimeTimer) window.clearTimeout(practiceRuntimeTimer);
  practiceAnimationFrame = 0;
  practiceRuntimeTimer = 0;
}

function beginPracticeExecution(choiceIndex) {
  const challenge = activePracticeChallenge;
  const player = selectedCareerPlayer();
  const meta = challenge ? PRACTICE_META[challenge.drillType] : null;
  const option = challenge?.options?.[choiceIndex];
  if (!challenge || challenge.stage !== "decision" || !player || !meta || !option) return;
  const profile = profileFor(player.id);
  if (!profile || profile.practiceSessions <= 0) {
    activePracticeChallenge = null;
    setCareerStatus("今天的訓練次數已用完；明天會自動恢復。", "is-error");
    render();
    return;
  }
  const focusAverage = meta.focus.reduce((sum, key) => sum + Number(player.ratings[key] || 50), 0) / meta.focus.length;
  const execution = {
    kind: challenge.drillType,
    focusAverage,
    decisionCorrect: option.correct,
    markerPosition: 0,
    signalGo: false,
    completed: false,
    targetDirection: ["up", "left", "right", "down"][Math.floor(Math.random() * 4)],
    targetWidth: clamp(14 + (focusAverage - 50) * .12, 13, 22),
    targetCenter: 25 + Math.random() * 50,
    signalDelay: 750 + Math.random() * 950,
  };
  challenge.stage = "execution";
  challenge.selectedOption = option;
  challenge.execution = execution;
  setCareerStatus(`${option.correct ? "情境判斷正確" : "情境判斷有風險"}；現在完成操作挑戰，操作表現仍能拉高評分。`, option.correct ? "" : "is-error");
  render();
  startPracticeExecutionRuntime();
}

function startPracticeExecutionRuntime() {
  clearPracticeRuntime();
  const challenge = activePracticeChallenge;
  const execution = challenge?.execution;
  if (!challenge || challenge.stage !== "execution" || !execution || execution.completed) return;
  const signal = $("practice-signal");
  const executeButton = $("practice-execute-button");
  if (execution.kind === "speed") {
    if (signal) {
      signal.textContent = "紅燈 · 不要起跑";
      signal.className = "practice-signal is-waiting";
    }
    if (executeButton) {
      executeButton.textContent = "起跑";
      executeButton.disabled = false;
    }
    practiceRuntimeTimer = window.setTimeout(() => {
      if (activePracticeChallenge?.execution !== execution || execution.completed) return;
      execution.signalGo = true;
      execution.signalAt = performance.now();
      if (signal) {
        signal.textContent = "綠燈！現在起跑";
        signal.className = "practice-signal is-go";
      }
      practiceRuntimeTimer = window.setTimeout(() => finishPracticeExecution(35, "起跑反應太慢"), 1800);
    }, execution.signalDelay);
    return;
  }
  if (execution.kind === "defense") {
    execution.startedAt = performance.now();
    if (signal) {
      const directionLabel = { up: "前方短打", left: "左側滾地", right: "右側滾地", down: "身後飛球" }[execution.targetDirection];
      signal.textContent = `${directionLabel}！立刻移動`;
      signal.className = "practice-signal is-go";
    }
    practiceRuntimeTimer = window.setTimeout(() => finishPracticeExecution(30, "守備起步太慢"), 2600);
    return;
  }
  execution.startedAt = performance.now();
  if (signal) {
    signal.textContent = execution.kind === "hitting" ? "球進甜蜜點時揮棒" : "指針進入控球區時放球";
    signal.className = "practice-signal is-go";
  }
  if (executeButton) {
    executeButton.textContent = execution.kind === "hitting" ? "揮棒" : "放球";
    executeButton.disabled = false;
  }
  const animate = (timestamp) => {
    if (activePracticeChallenge?.execution !== execution || execution.completed) return;
    const elapsed = timestamp - execution.startedAt;
    const cycle = (elapsed % 1700) / 1700;
    execution.markerPosition = cycle <= .5 ? cycle * 200 : (1 - cycle) * 200;
    const marker = $("practice-timing-marker");
    if (marker) marker.style.left = `${execution.markerPosition}%`;
    practiceAnimationFrame = window.requestAnimationFrame(animate);
  };
  practiceAnimationFrame = window.requestAnimationFrame(animate);
  practiceRuntimeTimer = window.setTimeout(() => finishPracticeExecution(32, "錯過操作時間"), 5200);
}

function handlePracticeExecution(direction = "") {
  const challenge = activePracticeChallenge;
  const execution = challenge?.execution;
  if (!challenge || challenge.stage !== "execution" || !execution || execution.completed) return;
  if (execution.kind === "speed") {
    if (!execution.signalGo) {
      finishPracticeExecution(25, "提前起跑，形成失誤");
      return;
    }
    const reaction = performance.now() - execution.signalAt;
    const score = clamp(Math.round(102 - Math.max(0, reaction - 160) / 7), 42, 99);
    finishPracticeExecution(score, `起跑反應 ${Math.round(reaction)}ms`);
    return;
  }
  if (execution.kind === "defense") {
    const reaction = performance.now() - execution.startedAt;
    const correct = direction === execution.targetDirection;
    const score = correct ? clamp(Math.round(103 - Math.max(0, reaction - 300) / 18), 65, 99) : 35;
    finishPracticeExecution(score, correct ? `守備方向正確，反應 ${Math.round(reaction)}ms` : "第一步方向判斷錯誤");
    return;
  }
  const targetLeft = execution.targetCenter - execution.targetWidth / 2;
  const targetRight = execution.targetCenter + execution.targetWidth / 2;
  const distance = Math.abs(execution.markerPosition - execution.targetCenter);
  const inside = execution.markerPosition >= targetLeft && execution.markerPosition <= targetRight;
  const score = inside
    ? clamp(Math.round(100 - distance * 1.2), 82, 99)
    : clamp(Math.round(78 - Math.max(0, distance - execution.targetWidth / 2) * 1.4), 35, 79);
  finishPracticeExecution(score, inside ? "操作落在完美區域" : "操作時機偏離目標區");
}

function finishPracticeExecution(executionScore, executionMessage) {
  const challenge = activePracticeChallenge;
  const execution = challenge?.execution;
  if (!challenge || !execution || execution.completed) return;
  execution.completed = true;
  clearPracticeRuntime();
  finalizePracticeChallenge(executionScore, executionMessage);
}

function finalizePracticeChallenge() { window.CareerMode?.retiredTraining(); }

function selectDevelopmentPath() { setCareerStatus("模板建立後固定；請在能力頁規劃升級。"); }

function chooseGamePrep() { window.CareerMode?.retiredTraining(); }

function startPracticeGame() { window.CareerMode?.startNext(); }

function startScheduledGame() {
  if (window.GameUI?.isCareerContext() && window.CareerMode) return window.CareerMode.startNext();
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
  const playerTeamId = window.GameUI?.seasonTeamId() || player?.teamId || selectedTeamId;
  const scheduled = nextScheduledGame(playerTeamId);
  if (!scheduled) {
    const postseason = scheduleStore.postseason;
    scheduleStatus = postseason?.championTeamId
      ? `2026 球季已結束，冠軍是 ${teamFor(postseason.championTeamId).name}。`
      : `${teamFor(playerTeamId).name} 的 2026 賽程已完成。`;
    renderDevelopment();
    return;
  }
  const playerIsAway = scheduled.awayTeamId === playerTeamId;
  const opponentId = playerIsAway ? scheduled.homeTeamId : scheduled.awayTeamId;
  if (state.teamId !== playerTeamId || state.opponentId !== opponentId) replaceMatchTeams(playerTeamId, opponentId, false);
  selectedTeamId = playerTeamId;
  selectedOpponentId = opponentId;
  developmentTeamId = playerTeamId;
  selectedAthleteId = player?.teamId === playerTeamId ? player.id : rosterForTeam(playerTeamId)[0]?.id || selectedAthleteId;
  claimLocalPosition(player?.teamId === playerTeamId ? player.position : network.assignedPosition || "CF", false);
  const scheduleType = scheduled.isPostseason ? scheduled.title : "例行賽";
  scheduleStatus = `${scheduleType} · ${scheduled.date} · ${teamFor(scheduled.awayTeamId).name} @ ${teamFor(scheduled.homeTeamId).name}；開始後會以玩家球隊視角進行。`;
  startGame("season", {
    id: scheduled.id,
    gameNo: scheduled.gameNo,
    date: scheduled.date,
    officialHomeTeamId: scheduled.homeTeamId,
    officialAwayTeamId: scheduled.awayTeamId,
    playerIsAway,
    stage: scheduled.stage || "regular",
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

function buildTemplateForPlayer(player) {
  return templateForPosition(player?.position || "CF", player?.builder?.templateId || player?.archetype);
}

function attributeCapForPlayer(player, key) {
  const configured = Number(player?.builder?.caps?.[key]);
  if (Number.isFinite(configured) && configured > 0) return Math.max(configured, builderCapFor(player.position, buildTemplateForPlayer(player), key));
  return builderCapFor(player.position, buildTemplateForPlayer(player), key);
}

function attributeUpgradeGate(nextValue, projectedOverall = 0) {
  if (projectedOverall >= 90) return { level: 15, label: "90 OVR 需 Lv.15" };
  if (nextValue >= 90) return { level: 15, label: "Lv.15 解鎖" };
  if (nextValue > 85) return { level: 10, label: "Lv.10 解鎖" };
  if (nextValue > 80) return { level: 6, label: "Lv.6 解鎖" };
  if (nextValue > 75) return { level: 3, label: "Lv.3 解鎖" };
  return { level: 1, label: "可升級" };
}

function attributeUpgradePrice(player, key, currentValue) {
  return window.CareerEngine.upgradePrice(currentValue, buildTemplateForPlayer(player).focus.includes(key));
}

function setPlayerUpgradeStatus(message, tone = "") {
  const status = $("player-upgrade-status");
  if (status) {
    status.textContent = message;
    status.className = `player-upgrade-status ${tone}`.trim();
  }
}

function upgradeSelectedAttribute(key) {
  const player = customPlayerIndex[selectedAthleteId];
  if (!player?.isCustom || !Object.prototype.hasOwnProperty.call(player.ratings, key) || ["contactL", "contactR", "powerL", "powerR", "popTime"].includes(key)) {
    setPlayerUpgradeStatus("只有你的自創球員主能力可以用生涯幣升級。", "is-error");
    return;
  }
  if (!(state.phase === "pre" || state.phase === "gameover")) {
    setPlayerUpgradeStatus("比賽進行中不能調整能力；請在賽前或賽後升級。", "is-error");
    return;
  }
  const profile = profileFor(player.id);
  const current = Number(player.ratings[key] || 0) + Number(profile.boosts?.[key] || 0);
  const cap = attributeCapForPlayer(player, key);
  const next = current + 1;
  const gate = attributeUpgradeGate(next, overallForPlayer({ position: player.position, ratings: { ...developedPlayer(player.id).ratings, [key]: next } }));
  const price = attributeUpgradePrice(player, key, current);
  if (next > cap) {
    setPlayerUpgradeStatus(`${BUILDER_LABEL_BY_KEY[key] || key} 已達此模板的 ${cap} 上限。`, "is-error");
    return;
  }
  if (profile.level < gate.level) {
    setPlayerUpgradeStatus(`${BUILDER_LABEL_BY_KEY[key] || key} 升到 ${next} 需要 ${gate.label}。`, "is-error");
    return;
  }
  if (profile.careerCoins < price) {
    setPlayerUpgradeStatus(`生涯幣不足：${BUILDER_LABEL_BY_KEY[key] || key} ${current} → ${next} 需要 ${price} 生涯幣。`, "is-error");
    return;
  }
  profile.careerCoins -= price;
  profile.boosts[key] = Math.min(MAX_NETWORK_BOOST, Number(profile.boosts[key] || 0) + 1);
  profile.morale = Math.min(99, Number(profile.morale || 72) + 1);
  persistCustomPlayers();
  if (network.role === "guest" && network.connected) sendToHost({ type: "custom", protocol: PROTOCOL_VERSION, position: player.position, customPlayer: networkPlayerSnapshotFor(player), name: player.name });
  const levelHint = next >= 75 ? ` · 下一段會更昂貴` : "";
  render();
  setPlayerUpgradeStatus(`${BUILDER_LABEL_BY_KEY[key] || key} ${current} → ${next}，花費 ${price} 生涯幣${levelHint}。`, "is-success");
}

function buildCustomPlayer({ name, number, teamId, position, bats, throws, archetype, buildRatings }) {
  const blueprint = ROSTER_BLUEPRINTS.find((candidate) => candidate.position === position) || ROSTER_BLUEPRINTS[0];
  const template = templateForPosition(position, archetype);
  const templateRatings = buildTemplateRatings(position, teamId, bats, template.id);
  const sourceRatings = buildRatings && typeof buildRatings === "object" ? { ...buildRatings } : { ...templateRatings };
  normalizeBuilderOverall(position, sourceRatings, template);
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
  const potential = Number(template.potential || (position === "P" ? 92 : 90));
  return normalizeCustomPlayer({
    id: `custom-${token}`,
    teamId,
    name: cleanName(name),
    position,
    number: String(number || "99").replace(/\D/g, "").slice(0, 2).padStart(2, "0") || "99",
    role: template.role,
    archetype: template.label,
    builder: { version: 2, templateId: template.id, pointBudget: BUILD_POINT_BUDGET, caps: Object.fromEntries(Object.keys(blueprint.ratings).filter((key) => key !== "popTime").map((key) => [key, builderCapFor(position, template, key)])) },
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
    if (state.lineupIds) state.lineupIds[code] = player.id;
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
    careerLeagues: window.CareerMode?.exportLeagues() || {},
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
  status.textContent = message || (meta.savedAt ? `${formatPlayerSaveTime(meta.savedAt)}；存在此瀏覽器` : "角色會自動保存在這個瀏覽器；換裝置時請匯出角色檔。");
}

function persistPlayerSaveMeta(savedAt = new Date().toISOString()) {
  writeStorage(PLAYER_SAVE_META_KEY, { savedAt, playerCount: customPlayers.length, activePlayerId: selectedCustomPlayerId });
  renderPlayerSaveStatus();
}

function persistCustomPlayers() {
  writeStorage(CUSTOM_PLAYERS_STORAGE_KEY, customPlayers);
  writeStorage(CAREER_STORAGE_KEY, careerStore);
  window.CareerMode?.persist();
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
    if (payload?.format !== PLAYER_SAVE_FORMAT || ![1, PLAYER_SAVE_VERSION].includes(Number(payload.version)) || !Array.isArray(payload.customPlayers)) throw new Error("invalid-save");
    if (window.CareerMode && !window.CareerMode.validateImport(payload)) throw new Error("invalid-career-save");
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
    window.CareerMode?.importLeagues(payload.careerLeagues || {});
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
  selectedCustomPlayerId = player.id;
  selectedAthleteId = player.id;
  developmentTeamId = player.teamId;
  network.displayName = player.name;
  network.assignedPosition = player.position;
  const nameInput = $("player-name-input");
  if (nameInput) nameInput.value = player.name;
  persistCustomPlayers();
  if (network.role === "guest") {
    if (network.connected) sendToHost({ type: "custom", protocol: PROTOCOL_VERSION, position: player.position, customPlayer: networkPlayerSnapshotFor(player), name: player.name });
    setCareerStatus(`${player.name} 已選為你的 My Player；正式生涯賽會累積他的獨立球季進度。`);
    setCustomPlayerStatus(`${player.name} 已選為你的角色；下一場會使用 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}。`, "is-success");
    render();
    return;
  }
  if (state.phase === "pre" || state.phase === "gameover") {
    if (state.teamId === player.teamId && state.lineupIds) state.lineupIds[player.position] = player.id;
    if (state.teamId === player.teamId) claimLocalPosition(player.position, false);
    syncMatchAthletes();
    commitState();
    setCareerStatus(`${player.name} 已選為你的 My Player；現在可以開始正式生涯賽程。`);
    setCustomPlayerStatus(`${player.name} 已套用到 ${teamFor(player.teamId).name} 的 ${positionName(player.position)}，現在可以開始比賽。`, "is-success");
  } else {
    setCareerStatus(`${player.name} 已選為你的 My Player；下一場比賽會套用最新能力。`);
    setCustomPlayerStatus(`${player.name} 已選取，下一場比賽開始時會套用到 ${teamFor(player.teamId).name}。`, "is-success");
    render();
  }
}

function setSelectedPlayerForMatch() {
  const player = developedPlayer(selectedAthleteId);
  if (!player) return;
  if (network.role === "guest") {
    if (player.isCustom) useCustomPlayer(player.id);
    else setCustomPlayerStatus("多人房間的官方先發由房主安排；你可以選擇自己的自創角色進入位置。", "is-error");
    return;
  }
  if (!isAuthority()) return;
  if (!(state.phase === "pre" || state.phase === "gameover")) {
    setCustomPlayerStatus("比賽進行中；下一場開始前才能調整先發。", "is-error");
    return;
  }
  if (player.teamId !== state.teamId) replaceMatchTeams(player.teamId, chooseOpponentFor(player.teamId), false);
  const slot = state.slots[player.position];
  if (slot?.controller === "human" && slot.playerId !== network.localPlayerId) {
    setCustomPlayerStatus(`${positionName(player.position)} 目前由 ${slot.name} 控制；請先由該玩家交出位置。`, "is-error");
    return;
  }
  if (player.isCustom) {
    useCustomPlayer(player.id);
    setActiveView("match", { scroll: false });
    return;
  }
  customPlayers.forEach((candidate) => {
    if (candidate.teamId === player.teamId && candidate.position === player.position) candidate.active = false;
  });
  refreshCustomPlayerIndex();
  selectedCustomPlayerId = "";
  selectedAthleteId = player.id;
  developmentTeamId = player.teamId;
  network.displayName = player.name;
  network.assignedPosition = player.position;
  const nameInput = $("player-name-input");
  if (nameInput) nameInput.value = player.name;
  state.lineupIds[player.position] = player.id;
  claimLocalPosition(player.position, false);
  const localSlot = slotForPlayer(network.localPlayerId);
  if (localSlot?.position === player.position) {
    localSlot.athleteId = player.id;
    localSlot.playerSnapshot = null;
    localSlot.name = player.name;
  }
  persistCustomPlayers();
  commitState();
  setCustomPlayerStatus(`${player.name} 已列入 ${teamFor(player.teamId).name} 先發，能力值會套用到本場比賽。`, "is-success");
  setActiveView("match", { scroll: false });
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

function careerRankFor(points = 0) {
  const value = Math.max(0, Number(points || 0));
  return CAREER_RANKS.slice().reverse().find((rank) => value >= rank.min) || CAREER_RANKS[0];
}

function badgeLevelFor(value = 0) {
  const score = Math.max(0, Number(value || 0));
  if (score >= 150) return { label: "金", next: 150, className: "is-gold" };
  if (score >= 70) return { label: "銀", next: 150, className: "is-silver" };
  if (score >= 24) return { label: "銅", next: 70, className: "is-bronze" };
  return { label: "未解鎖", next: 24, className: "" };
}

function applyMatchToCareerProfile(profile, position, match, result) {
  if (!profile || profile.settledMatches?.[state.matchId]) return;
  profile.settledMatches ||= {};
  profile.settledMatches[state.matchId] = true;
  window.CareerEngine.accumulate(profile.stats, position, match, result);
  const report = window.CareerEngine.payout(position, match, { career: false });
  awardCareerXp(profile, report.xp);
  profile.careerCoins += report.coins;
  profile.lastGrade = report.grade;
  profile.recentMatches = [{ result, grade: report.grade, xp: report.xp, coins: report.coins, date: careerDayKey(), breakdown: report }, ...(profile.recentMatches || [])].slice(0, 5);
  profile.record.games++;
  if (result === "win" || result === "walkoff") profile.record.wins++;
  else if (result === "loss") profile.record.losses++;
  else profile.record.ties++;
}

function nextScheduledGame(teamId = selectedCareerPlayer()?.teamId || selectedTeamId) {
  const regularGame = SEASON_SCHEDULE.find((game) => !scheduleStore.completed[game.id] && (!teamId || game.homeTeamId === teamId || game.awayTeamId === teamId));
  if (regularGame) return regularGame;
  const postseason = ensurePostseason(teamId);
  if (!postseason) return null;
  const activeSeries = [postseason.challenge, postseason.taiwan].find((series) => series && !postseasonSeriesWinner(series) && series.teamIds.includes(teamId));
  return activeSeries?.games.find((game) => !scheduleStore.completed[game.id]) || null;
}

function playedSeasonGameCount(teamId = "") {
  return SEASON_SCHEDULE.reduce((count, game) => {
    if (!scheduleStore.completed[game.id]) return count;
    if (!teamId || game.homeTeamId === teamId || game.awayTeamId === teamId) return count + 1;
    return count;
  }, 0);
}

function standingsSnapshot() {
  return TEAM_DEFS.map((team) => {
    const saved = teamRecord(team.id);
    const savedGames = Number(saved.W || 0) + Number(saved.L || 0) + Number(saved.T || 0);
    const baseline = team.leagueStats || {};
    const record = savedGames > 0
      ? saved
      : { W: Number(baseline.wins || 0), L: Number(baseline.losses || 0), T: Number(baseline.ties || 0), RF: 0, RA: 0 };
    const games = Number(record.W || 0) + Number(record.L || 0) + Number(record.T || 0);
    return {
      teamId: team.id,
      W: Number(record.W || 0),
      L: Number(record.L || 0),
      T: Number(record.T || 0),
      games,
      pct: games ? (Number(record.W || 0) + Number(record.T || 0) * 0.5) / games : 0,
      runDiff: Number(record.RF || 0) - Number(record.RA || 0),
    };
  }).sort((a, b) => b.pct - a.pct || b.W - a.W || b.runDiff - a.runDiff || a.teamId.localeCompare(b.teamId));
}

function addSeasonDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatSeasonDate(date);
}

function createPostseasonSeries(stage, higherSeedTeamId, lowerSeedTeamId, bestOf, startDate, title) {
  const homePattern = bestOf === 7
    ? [higherSeedTeamId, higherSeedTeamId, lowerSeedTeamId, lowerSeedTeamId, lowerSeedTeamId, higherSeedTeamId, higherSeedTeamId]
    : [higherSeedTeamId, higherSeedTeamId, lowerSeedTeamId, lowerSeedTeamId, higherSeedTeamId];
  const dayOffsets = bestOf === 7 ? [0, 1, 3, 4, 5, 7, 8] : [0, 1, 3, 4, 6];
  return {
    stage,
    title,
    bestOf,
    teamIds: [higherSeedTeamId, lowerSeedTeamId],
    games: homePattern.map((homeTeamId, index) => {
      const awayTeamId = homeTeamId === higherSeedTeamId ? lowerSeedTeamId : higherSeedTeamId;
      return {
        id: `${CPBL_SEASON_YEAR}-post-${stage}-${index + 1}`,
        gameNo: index + 1,
        date: addSeasonDays(startDate, dayOffsets[index]),
        half: `${title} G${index + 1}`,
        stage,
        title,
        isPostseason: true,
        bestOf,
        homeTeamId,
        awayTeamId,
        stadium: teamFor(homeTeamId).stadium,
        status: "scheduled",
      };
    }),
  };
}

function postseasonSeriesRecord(series) {
  const wins = Object.fromEntries((series?.teamIds || []).map((teamId) => [teamId, 0]));
  if (!series) return wins;
  const targetWins = Math.floor(Number(series.bestOf || 0) / 2) + 1;
  for (const game of series.games || []) {
    const winnerTeamId = scheduleStore.completed[game.id]?.winnerTeamId;
    if (!winnerTeamId || wins[winnerTeamId] === undefined) continue;
    wins[winnerTeamId] += 1;
    if (wins[winnerTeamId] >= targetWins) break;
  }
  return wins;
}

function postseasonSeriesWinner(series) {
  if (!series) return "";
  const targetWins = Math.floor(Number(series.bestOf || 0) / 2) + 1;
  const wins = postseasonSeriesRecord(series);
  return series.teamIds.find((teamId) => Number(wins[teamId] || 0) >= targetWins) || "";
}

function simulatePostseasonSeries(series) {
  if (!series || postseasonSeriesWinner(series)) return false;
  const preferredWinner = series.teamIds[0];
  const targetWins = Math.floor(series.bestOf / 2) + 1;
  let preferredWins = 0;
  let opponentWins = 0;
  series.games.forEach((game, index) => {
    if (preferredWins >= targetWins || opponentWins >= targetWins || scheduleStore.completed[game.id]) return;
    const opponent = series.teamIds.find((teamId) => teamId !== preferredWinner);
    const winnerTeamId = index % 3 === 2 && opponentWins < targetWins - 1 ? opponent : preferredWinner;
    if (winnerTeamId === preferredWinner) preferredWins += 1;
    else opponentWins += 1;
    const homeWon = winnerTeamId === game.homeTeamId;
    scheduleStore.completed[game.id] = {
      gameNo: game.gameNo,
      date: game.date,
      homeScore: homeWon ? 4 : 2,
      awayScore: homeWon ? 2 : 4,
      result: homeWon ? "win" : "loss",
      winnerTeamId,
      isPostseason: true,
      stage: game.stage,
      simulated: true,
      playedAt: new Date().toISOString(),
    };
  });
  return true;
}

function ensurePostseason(teamId = selectedCareerPlayer()?.teamId || selectedTeamId) {
  if (playedSeasonGameCount(teamId) < 120) return scheduleStore.postseason;
  let changed = false;
  if (!scheduleStore.postseason?.seedTeamIds?.length) {
    const seedTeamIds = standingsSnapshot().slice(0, 3).map((entry) => entry.teamId);
    scheduleStore.postseason = {
      version: 1,
      generatedAt: new Date().toISOString(),
      seedTeamIds,
      challenge: createPostseasonSeries("challenge", seedTeamIds[1], seedTeamIds[2], 5, "2026-11-03", "季後挑戰賽"),
      taiwan: null,
      championTeamId: "",
    };
    changed = true;
  }
  const postseason = scheduleStore.postseason;
  if (postseason.challenge && !postseason.challenge.teamIds.includes(teamId) && !postseasonSeriesWinner(postseason.challenge)) {
    changed = simulatePostseasonSeries(postseason.challenge) || changed;
  }
  const challengeWinner = postseasonSeriesWinner(postseason.challenge);
  if (challengeWinner && !postseason.taiwan) {
    const finalStartDate = addSeasonDays(postseason.challenge.games.at(-1)?.date || "2026-11-09", 4);
    postseason.taiwan = createPostseasonSeries("taiwan", postseason.seedTeamIds[0], challengeWinner, 7, finalStartDate, "台灣大賽");
    changed = true;
  }
  const championTeamId = postseasonSeriesWinner(postseason.taiwan);
  if (championTeamId && postseason.championTeamId !== championTeamId) {
    postseason.championTeamId = championTeamId;
    changed = true;
  }
  if (changed) writeStorage(SCHEDULE_STORAGE_KEY, scheduleStore);
  return postseason;
}

function postseasonGames() {
  const postseason = scheduleStore.postseason;
  return [postseason?.challenge, postseason?.taiwan].filter(Boolean).flatMap((series) => series.games || []);
}

function scheduledGameById(gameId) {
  if (state.careerPlayerId && window.CareerMode) return window.CareerMode.gameById(state.careerPlayerId, gameId);
  return SEASON_SCHEDULE.find((game) => game.id === gameId) || postseasonGames().find((game) => game.id === gameId) || null;
}

function markScheduledGameCompleted(result) {
  if (state.matchMode !== "season" || !state.scheduleGameId || scheduleStore.completed[state.scheduleGameId]) return;
  const scheduled = scheduledGameById(state.scheduleGameId) || (state.scheduleStage && state.scheduleStage !== "regular" ? {
    id: state.scheduleGameId,
    gameNo: state.scheduleGameNo,
    date: state.scheduleDate,
    stage: state.scheduleStage,
    isPostseason: true,
    homeTeamId: state.scheduleOfficialHomeTeamId,
    awayTeamId: state.scheduleOfficialAwayTeamId,
  } : null);
  if (!scheduled) return;
  const playerWon = result === "win" || result === "walkoff";
  const playerIsAway = Boolean(state.schedulePlayerIsAway);
  const officialHomeScore = playerIsAway ? state.score.away : state.score.home;
  const officialAwayScore = playerIsAway ? state.score.home : state.score.away;
  const officialHomeResult = playerIsAway ? (playerWon ? "loss" : result === "loss" ? "win" : "tie") : result;
  const winnerTeamId = officialHomeScore > officialAwayScore
    ? scheduled.homeTeamId
    : officialAwayScore > officialHomeScore
      ? scheduled.awayTeamId
      : "";
  scheduleStore.completed[state.scheduleGameId] = {
    gameNo: scheduled.gameNo,
    date: scheduled.date,
    homeScore: officialHomeScore,
    awayScore: officialAwayScore,
    result: officialHomeResult,
    winnerTeamId,
    isPostseason: Boolean(scheduled.isPostseason),
    stage: scheduled.stage || "regular",
    playedAt: new Date().toISOString(),
  };
  if (scheduled.isPostseason) ensurePostseason(state.teamId);
  writeStorage(SCHEDULE_STORAGE_KEY, scheduleStore);
}

function recordTeamResult(result) {
  if (state.matchMode === "practice" || state.matchMode === "career") return;
  if (state.matchMode === "season" && (state.scheduleStage && state.scheduleStage !== "regular" || scheduledGameById(state.scheduleGameId)?.isPostseason)) return;
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
  if (state.careerPlayerId && window.CareerMode) return window.CareerMode.recordMatch(result);
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
  if (localCustomPlayer?.isCustom) {
    setCustomPlayerStatus(`${localCustomPlayer.name} 的賽後成長已保存。`, "is-success");
    if (state.matchMode === "career") {
      const recent = profileFor(localCustomPlayer.id)?.recentMatches?.[0];
      const keyText = recent?.keyGame?.completed ? `完成「${recent.keyGame.label}」` : `未完成「${recent?.keyGame?.label || "本場挑戰"}」`;
      setCareerStatus(`${localCustomPlayer.name} ${keyText}；評分 ${recent?.grade || "—"}，獲得 ${recent?.xp || 0} XP。`, recent?.keyGame?.completed ? "" : "is-error");
    }
  }
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
  if (localCustomPlayer?.isCustom) {
    setCustomPlayerStatus(`${localCustomPlayer.name} 的多人賽後成長已保存。`, "is-success");
    if (state.matchMode === "career") {
      const recent = profileFor(localCustomPlayer.id)?.recentMatches?.[0];
      const keyText = recent?.keyGame?.completed ? `完成「${recent.keyGame.label}」` : `未完成「${recent?.keyGame?.label || "本場挑戰"}」`;
      setCareerStatus(`${localCustomPlayer.name} ${keyText}；評分 ${recent?.grade || "—"}，獲得 ${recent?.xp || 0} XP。`, recent?.keyGame?.completed ? "" : "is-error");
    }
  }
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

function renderCareerFeedback(player, profile) {
  const lastGrade = $("career-last-grade");
  const lastCopy = $("career-last-copy");
  const focusStat = $("career-focus-stat");
  const focusCopy = $("career-focus-copy");
  const recordLine = $("career-record-line");
  const perkLine = $("career-perk-line");
  if (!player || !profile) {
    if (lastGrade) lastGrade.textContent = "—";
    if (lastCopy) lastCopy.textContent = "完成訓練或比賽後，這裡會留下你的評分。";
    if (focusStat) focusStat.textContent = "—";
    if (focusCopy) focusCopy.textContent = "選擇一條養成路線，讓每次投入都有方向。";
    if (recordLine) recordLine.textContent = "0 場 · 0 勝";
    if (perkLine) perkLine.textContent = "尚未解鎖生涯能力";
    return;
  }
  const path = developmentPathFor(profile.developmentPath);
  const focusKey = path.keys[0];
  const focusLabel = BUILDER_LABEL_BY_KEY[focusKey] || focusKey;
  const focusBoost = Number(profile.boosts?.[focusKey] || 0);
  const recent = profile.recentMatches?.[0];
  const resultLabel = recent ? ({ win: "勝利", walkoff: "再見勝利", loss: "敗戰", tie: "和局" }[recent.result] || recent.result) : "尚未完成比賽";
  const record = profile.record || { games: 0, wins: 0, losses: 0, ties: 0 };
  if (lastGrade) lastGrade.textContent = profile.lastGrade ? `${profile.lastGrade} 分` : "—";
  if (lastCopy) lastCopy.textContent = profile.lastPractice || (recent ? `${resultLabel} · +${recent.xp} XP` : "完成訓練或比賽後，這裡會留下你的評分。");
  if (focusStat) focusStat.textContent = `${focusLabel} +${focusBoost}`;
  if (focusCopy) focusCopy.textContent = `${path.label} · 相關訓練會額外獲得 XP`;
  if (recordLine) recordLine.textContent = `${record.games} 場 · ${record.wins} 勝 · ${record.losses} 敗`;
  if (perkLine) perkLine.textContent = profile.unlockedPerks?.length ? `已解鎖：${profile.unlockedPerks.join("、")}` : `Lv.${profile.level < 3 ? 3 : 5} 解鎖下一個能力`;
}

function renderCareerSpotlight(player, profile) {
  const rankLabel = $("career-legacy-rank");
  const rankCopy = $("career-legacy-copy");
  const rankBar = $("career-legacy-bar");
  const focusState = $("career-focus-state");
  const focusCopy = $("career-focus-meter-copy");
  const focusBar = $("career-focus-bar");
  if (!player || !profile) {
    if (rankLabel) rankLabel.textContent = "等待評估";
    if (rankCopy) rankCopy.textContent = "建立球員後開始累積教練信任。";
    if (rankBar) rankBar.style.width = "0%";
    if (focusState) focusState.textContent = "累積中";
    if (focusCopy) focusCopy.textContent = "訓練與比賽好表現會填滿專注條。";
    if (focusBar) focusBar.style.width = "0%";
    return;
  }
  const rank = careerRankFor(profile.legacyPoints);
  const trust = careerCoachTrust(profile);
  const trustStatus = trust >= 85 ? "不可取代" : trust >= 65 ? "球隊核心" : trust >= 45 ? "固定先發" : trust >= 28 ? "輪值競爭" : "觀察名單";
  if (rankLabel) rankLabel.textContent = `${trust}% · ${trustStatus}`;
  if (rankCopy) rankCopy.textContent = `${rank.label} · ${profile.legacyPoints} 生涯聲望`;
  if (rankBar) rankBar.style.width = `${trust}%`;
  const ready = Number(profile.focusMeter || 0) >= 100;
  if (focusState) focusState.textContent = ready ? "火熱啟動" : `${Math.round(profile.focusMeter || 0)} / 100`;
  if (focusCopy) focusCopy.textContent = ready ? "下一場關鍵賽事獲得擊球與 XP 加成。" : "答對訓練情境與比賽好表現會累積專注。";
  if (focusBar) focusBar.style.width = `${clamp(Math.round(profile.focusMeter || 0), 0, 100)}%`;
}

function renderCareerKeyGame(player, profile) {
  const title = $("career-key-game-title");
  const opponent = $("career-key-game-opponent");
  const goal = $("career-key-game-goal");
  const reward = $("career-key-game-reward");
  const roleTitle = $("career-position-challenge-title");
  const roleCopy = $("career-position-challenge-copy");
  const roleReward = $("career-position-challenge-reward");
  const history = $("career-history");
  if (!player || !profile) {
    if (title) title.textContent = "建立球員後解鎖";
    if (opponent) opponent.textContent = "關鍵賽事會依你的球隊與生涯階段安排。";
    if (goal) goal.textContent = "—";
    if (reward) reward.textContent = "獎勵：—";
    if (roleTitle) roleTitle.textContent = "建立球員後解鎖";
    if (roleCopy) roleCopy.textContent = "九個守備位置各有一項專屬挑戰。";
    if (roleReward) roleReward.textContent = "獎勵：—";
    if (history) history.innerHTML = '<p class="career-history-empty">尚無生涯賽事紀錄。</p>';
    return;
  }
  const keyGame = KEY_GAME_DEFS[Number(profile.keyGameIndex || 0) % KEY_GAME_DEFS.length];
  const opponentId = chooseOpponentFor(player.teamId, selectedOpponentId);
  if (title) title.textContent = keyGame.label;
  if (opponent) opponent.textContent = `${teamFor(player.teamId).shortName} vs ${teamFor(opponentId).shortName} · 第 ${Number(profile.keyGameIndex || 0) + 1} 場關鍵賽事`;
  if (goal) goal.textContent = keyGame.detail;
  if (reward) reward.textContent = `獎勵：${keyGame.reward}${profile.focusMeter >= 100 ? " · 火熱加成已就緒" : ""}`;
  const roleChallenge = window.JiujuuCareerContent?.positionChallenges?.[player.position];
  const roleChallengeComplete = Boolean(roleChallenge && profile.completedPositionChallenges?.includes(roleChallenge.id));
  if (roleTitle) roleTitle.textContent = roleChallenge ? `${positionName(player.position)} · ${roleChallenge.title}` : "尚無位置挑戰";
  if (roleCopy) roleCopy.textContent = roleChallenge
    ? `${roleChallengeComplete ? "已完成" : roleChallenge.detail} · 專屬於${positionName(player.position)}`
    : "建立球員後查看位置專屬挑戰。";
  if (roleReward) roleReward.textContent = roleChallenge
    ? roleChallengeComplete ? "已領取挑戰獎勵" : `完成後 +${roleChallenge.rewards.xp} XP · ${roleChallenge.rewards.coins} 生涯幣 · ${roleChallenge.rewards.legacy} 聲望`
    : "獎勵：—";
  if (history) {
    const recent = profile.recentMatches || [];
    history.innerHTML = recent.length ? recent.map((match) => {
      const resultLabel = ({ win: "勝", walkoff: "再見勝", loss: "敗", tie: "和" }[match.result] || "完賽");
      const keyLabel = match.keyGame ? `${match.keyGame.completed ? "完成" : "未完成"} · ${match.keyGame.label}` : "一般賽事";
      const roleLabel = match.positionChallenge ? ` · 位置挑戰：${match.positionChallenge.title}` : "";
      return `<div class="career-history-row"><b>${resultLabel} · ${match.grade} 分</b><span>${keyLabel}${roleLabel}</span><small>+${match.xp} XP</small></div>`;
    }).join("") : '<p class="career-history-empty">完成第一場關鍵賽事後，這裡會留下紀錄。</p>';
  }
}

function renderCareerBadges(player, profile) {
  const grid = $("career-badge-grid");
  if (!grid) return;
  if (!player || !profile) {
    grid.innerHTML = '<p class="career-history-empty">建立球員後，能力徽章會依實際比賽數據成長。</p>';
    return;
  }
  grid.innerHTML = CAREER_BADGES.map((badge) => {
    const value = Math.max(0, Math.round(badge.value(profile.stats, profile)));
    const level = badgeLevelFor(value);
    const previous = level.label === "金" ? 150 : level.label === "銀" ? 70 : level.label === "銅" ? 24 : 0;
    const progress = level.label === "金" ? 100 : clamp(Math.round(((value - previous) / Math.max(1, level.next - previous)) * 100), 0, 100);
    return `<article class="career-badge ${level.className}"><span>${level.label}</span><b>${badge.label}</b><small>${badge.detail}</small><div class="career-meter"><i style="width:${progress}%"></i></div><em>${value} / ${level.next}</em></article>`;
  }).join("");
}

function renderPracticeChallenge() {
  const panel = $("practice-challenge");
  const label = $("practice-challenge-label");
  const question = $("practice-challenge-question");
  const choices = $("practice-choices");
  const executionPanel = $("practice-execution");
  const timingTrack = $("practice-timing-track");
  const targetZone = $("practice-target-zone");
  const directionPad = $("practice-direction-pad");
  const executeButton = $("practice-execute-button");
  const executionHint = $("practice-execution-hint");
  if (!panel || !choices) return;
  panel.hidden = !activePracticeChallenge;
  if (!activePracticeChallenge) {
    choices.innerHTML = "";
    if (executionPanel) executionPanel.hidden = true;
    return;
  }
  const meta = PRACTICE_META[activePracticeChallenge.drillType];
  const execution = activePracticeChallenge.execution;
  const isExecution = activePracticeChallenge.stage === "execution" && execution;
  if (label) label.textContent = `${meta.title} · ${isExecution ? "操作挑戰" : "情境判斷"}`;
  if (question) question.textContent = isExecution
    ? ({ hitting: "看準移動指針進入甜蜜區，按下揮棒。", pitching: "讓指針進入控球區後放球。", defense: "依打球方向按下正確的第一步。", speed: "紅燈時等待，綠燈亮起立刻起跑。" }[execution.kind])
    : activePracticeChallenge.question;
  choices.hidden = Boolean(isExecution);
  choices.classList.toggle("is-locked", Boolean(isExecution));
  choices.innerHTML = isExecution ? "" : activePracticeChallenge.options.map((option, index) => `<button type="button" data-practice-choice="${index}">${option.label}</button>`).join("");
  if (!executionPanel) return;
  executionPanel.hidden = !isExecution;
  if (!isExecution) return;
  const usesTiming = execution.kind === "hitting" || execution.kind === "pitching";
  if (timingTrack) timingTrack.hidden = !usesTiming;
  if (directionPad) directionPad.hidden = execution.kind !== "defense";
  if (executeButton) executeButton.hidden = execution.kind === "defense";
  if (targetZone && usesTiming) {
    targetZone.style.left = `${execution.targetCenter - execution.targetWidth / 2}%`;
    targetZone.style.width = `${execution.targetWidth}%`;
  }
  if (executionHint) executionHint.textContent = {
    hitting: "越靠近綠色區中央，擊球評分越高。",
    pitching: "模板的控球能力會讓目標區稍微變寬。",
    defense: "方向與反應時間都會影響評分。",
    speed: "提前按會形成 false start；綠燈後越快越好。",
  }[execution.kind];
}

function renderCareerClubhouse(player, profile, connectedToRoom) {
  const journey = $("career-journey");
  const chapterLabel = $("career-chapter-label");
  const storyTitle = $("career-story-title");
  const storyCopy = $("career-story-copy");
  const storyQuote = $("career-story-quote");
  const prepStatus = $("career-prep-status");
  const heroOverall = $("career-hero-ovr");
  const coins = $("career-mode-coins");
  const trust = $("career-mode-trust");
  const condition = $("career-mode-condition");
  const next = $("career-clubhouse-next");
  const nextNote = $("career-clubhouse-note");
  const avatar = document.querySelector(".career-player-identity .career-avatar-mark");
  if (!player || !profile) {
    if (journey) journey.innerHTML = CAREER_CHAPTERS.map((chapter, index) => `<article class="career-journey-step ${index === 0 ? "is-current" : "is-locked"}"><b>${String(index + 1).padStart(2, "0")}</b><span>${chapter.label}</span><small>${chapter.target}</small></article>`).join("");
    if (chapterLabel) chapterLabel.textContent = "第 1 章";
    if (storyTitle) storyTitle.textContent = CAREER_CHAPTERS[0].story;
    if (storyCopy) storyCopy.textContent = "建立球員後，教練團會開始評估你的比賽表現。";
    if (storyQuote) storyQuote.textContent = "「名單上還有一個位置，先讓我們看看你是誰。」— 首席教練";
    if (prepStatus) prepStatus.textContent = "建立球員後即可安排每天的比賽日計畫。";
    if (heroOverall) heroOverall.textContent = "—";
    if (coins) coins.textContent = "—";
    if (trust) trust.textContent = "—";
    if (condition) condition.textContent = "—";
    if (next) next.textContent = "等待球團安排";
    if (nextNote) nextNote.textContent = "建立球員後，教練會交付第一場任務。";
    if (avatar) avatar.textContent = "MP";
  } else {
    const chapterIndex = careerChapterIndexFor(profile);
    const chapter = careerChapterFor(profile);
    const trustValue = careerCoachTrust(profile);
    const keyGame = KEY_GAME_DEFS[Number(profile.keyGameIndex || 0) % KEY_GAME_DEFS.length];
    const opponentId = chooseOpponentFor(player.teamId, selectedOpponentId);
    if (journey) journey.innerHTML = CAREER_CHAPTERS.map((candidate, index) => `<article class="career-journey-step ${index < chapterIndex ? "is-complete" : index === chapterIndex ? "is-current" : "is-locked"}"><b>${index < chapterIndex ? "✓" : String(index + 1).padStart(2, "0")}</b><span>${candidate.label}</span><small>${candidate.target}</small></article>`).join("");
    if (chapterLabel) chapterLabel.textContent = `第 ${chapterIndex + 1} 章 · ${chapter.label}`;
    if (storyTitle) storyTitle.textContent = chapter.story;
    if (storyCopy) storyCopy.textContent = chapter.copy;
    if (storyQuote) storyQuote.textContent = `「${chapter.quote}」— 首席教練`;
    if (heroOverall) heroOverall.textContent = player.overall;
    if (coins) coins.textContent = `${profile.careerCoins}`;
    if (trust) trust.textContent = `${trustValue}%`;
    if (condition) condition.textContent = `疲勞 ${profile.fatigue} · 士氣 ${profile.morale}`;
    if (next) next.textContent = `${keyGame.chapter} · ${keyGame.label}`;
    if (nextNote) nextNote.textContent = `${teamFor(player.teamId).shortName} vs ${teamFor(opponentId).shortName} · ${keyGame.detail}`;
    if (avatar) avatar.textContent = player.position;
    const selectedPrep = profile.preGamePlanDay === careerDayKey() ? GAME_PREP_PLANS[profile.preGamePlan] : null;
    if (prepStatus) prepStatus.textContent = selectedPrep
      ? `今日已完成「${selectedPrep.label}」：${selectedPrep.detail}`
      : connectedToRoom
        ? "目前在多人房間；離開後可安排單人生涯的比賽日計畫。"
        : "每天可選一次賽前計畫，會使用 1 次訓練額度。";
  }
  document.querySelectorAll("[data-game-prep]").forEach((button) => {
    const selected = Boolean(profile && profile.preGamePlanDay === careerDayKey() && profile.preGamePlan === button.dataset.gamePrep);
    button.classList.toggle("is-selected", selected);
    button.disabled = !player || !profile || profile.practiceSessions <= 0 || Boolean(profile.preGamePlanDay === careerDayKey()) || connectedToRoom || !(state.phase === "pre" || state.phase === "gameover");
  });
}

function renderCareerMode() {
  if (window.CareerMode) { window.CareerMode.render(); return; }
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
    if (modeCopy) modeCopy.textContent = "建立角色後，關鍵賽事、情境訓練與能力徽章會在這裡展開。";
    if (energy) energy.textContent = "0 / 3";
    if (score) score.textContent = "—";
  } else {
    if (modeName) modeName.textContent = player.name;
    if (modeMeta) modeMeta.textContent = `${player.position} · ${positionName(player.position)} · ${player.archetype}`;
    if (modeProgress) modeProgress.textContent = `Lv.${profile.level} · XP ${profile.xp}/${xpToNextLevel(profile.level)}`;
    if (modeCopy) modeCopy.textContent = connectedToRoom ? "目前在多人房間；角色仍會保存，離開後可繼續單人生涯。" : "完成關鍵賽事、訓練判斷與徽章里程碑，再帶著角色加入九人房間。";
    if (energy) energy.textContent = `${profile.practiceSessions} / ${PRACTICE_SESSIONS_PER_DAY}`;
    if (score) score.textContent = `${profile.lastGrade || "—"}`;
  }
  renderCareerClubhouse(player, profile, connectedToRoom);
  renderCareerDevelopment(player, profile);
  renderCareerFeedback(player, profile);
  renderCareerSpotlight(player, profile);
  renderCareerKeyGame(player, profile);
  renderCareerBadges(player, profile);
  renderPracticeChallenge();
  setCareerTab(activeCareerTab);
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

function renderPostseason(teamId, nextGame = null) {
  const stateLabel = $("postseason-state");
  const bracket = $("postseason-bracket");
  const scheduleList = $("postseason-schedule-list");
  const status = $("postseason-status");
  if (!bracket || !scheduleList || !status) return;
  const regularPlayed = playedSeasonGameCount(teamId);
  const postseason = regularPlayed >= 120 ? ensurePostseason(teamId) : null;
  const seedTeamIds = postseason?.seedTeamIds || standingsSnapshot().slice(0, 3).map((entry) => entry.teamId);
  const seedNumber = (candidateId) => Math.max(1, seedTeamIds.indexOf(candidateId) + 1);
  const seriesCard = (series, fallbackTeamIds, title, bestOf) => {
    const teamIds = series?.teamIds || fallbackTeamIds;
    const wins = series ? postseasonSeriesRecord(series) : {};
    const winnerTeamId = series ? postseasonSeriesWinner(series) : "";
    return `<article class="postseason-series-card ${!winnerTeamId && postseason ? "is-active" : ""}">
      <span>${escapeHtml(title)} · ${bestOf} 戰 ${Math.floor(bestOf / 2) + 1} 勝 · ${winnerTeamId ? "系列賽結束" : postseason ? "進行中" : "預估"}</span>
      ${teamIds.map((candidateId) => candidateId
        ? `<div class="postseason-team-line"><b>#${seedNumber(candidateId)} ${escapeHtml(teamFor(candidateId).shortName)}${winnerTeamId === candidateId ? " · 晉級" : ""}</b><strong>${series ? Number(wins[candidateId] || 0) : "—"}</strong></div>`
        : `<div class="postseason-team-line"><b>挑戰賽勝隊</b><strong>—</strong></div>`).join("")}
    </article>`;
  };
  const challengeFallback = [seedTeamIds[1], seedTeamIds[2]];
  const challengeWinner = postseasonSeriesWinner(postseason?.challenge);
  const taiwanFallback = [seedTeamIds[0], challengeWinner || ""];
  bracket.innerHTML = `${seriesCard(postseason?.challenge, challengeFallback, "季後挑戰賽", 5)}<div class="postseason-advance" aria-hidden="true">→</div>${seriesCard(postseason?.taiwan, taiwanFallback, "台灣大賽", 7)}`;

  if (!postseason) {
    if (stateLabel) stateLabel.textContent = "預估席次";
    scheduleList.innerHTML = '<p class="season-schedule-empty">完成 120 場例行賽後，正式鎖定季後賽球隊與日期。</p>';
    const rank = seedTeamIds.indexOf(teamId) + 1;
    status.textContent = rank > 0 ? `${teamFor(teamId).shortName} 目前預估第 ${rank} 名；例行賽進度 ${regularPlayed} / 120。` : `${teamFor(teamId).shortName} 目前在季後賽席次之外；例行賽進度 ${regularPlayed} / 120。`;
    return;
  }

  const championTeamId = postseason.championTeamId || postseasonSeriesWinner(postseason.taiwan);
  if (stateLabel) stateLabel.textContent = championTeamId ? `冠軍 · ${teamFor(championTeamId).shortName}` : "季後賽進行中";
  const playerPostseasonGames = [postseason.challenge, postseason.taiwan]
    .filter((series) => series?.teamIds.includes(teamId))
    .flatMap((series) => series.games || []);
  scheduleList.innerHTML = playerPostseasonGames.length
    ? playerPostseasonGames.map((game) => {
      const completed = scheduleStore.completed[game.id];
      const isNext = game.id === nextGame?.id;
      const score = completed ? `${completed.awayScore}：${completed.homeScore}` : "—";
      return `<div class="postseason-game-row ${isNext ? "is-next" : ""} ${completed ? "is-completed" : ""}"><span>G${game.gameNo}</span><span><b>${game.title}</b><small>${game.date.replaceAll("-", "/")} · ${escapeHtml(teamFor(game.awayTeamId).shortName)} @ ${escapeHtml(teamFor(game.homeTeamId).shortName)}</small></span><strong>${completed ? score : isNext ? "下一戰" : "視需要"}</strong></div>`;
    }).join("")
    : '<p class="season-schedule-empty">本隊未取得季後賽席次；仍可查看上方系列賽戰況。</p>';

  const qualified = seedTeamIds.includes(teamId);
  const challengeLoser = postseasonSeriesWinner(postseason.challenge) && postseason.challenge.teamIds.includes(teamId) && postseasonSeriesWinner(postseason.challenge) !== teamId;
  const finalLoser = championTeamId && postseason.taiwan?.teamIds.includes(teamId) && championTeamId !== teamId;
  status.textContent = championTeamId === teamId
    ? `恭喜 ${teamFor(teamId).name} 拿下 2026 台灣大賽冠軍！`
    : challengeLoser || finalLoser
      ? `${teamFor(teamId).name} 的季後賽旅程已結束。`
      : !qualified
        ? `${teamFor(teamId).name} 未進入前三名，2026 球季已結束。`
        : nextGame?.isPostseason
          ? `下一戰：${nextGame.title} G${nextGame.gameNo}，${teamFor(nextGame.awayTeamId).shortName} @ ${teamFor(nextGame.homeTeamId).shortName}。`
          : "等待下一個系列賽對手確認。";
}

function renderSeasonSchedule() {
  const panel = $("season-schedule-panel");
  if (!panel) return;
  const player = selectedCareerPlayer();
  const teamId = window.GameUI?.seasonTeamId() || (network.role !== "solo" && state.teamId ? state.teamId : player?.teamId || selectedTeamId);
  const team = teamFor(teamId);
  const teamGames = SEASON_SCHEDULE.filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId);
  const activeScheduledGame = state.matchMode === "season" && state.scheduleGameId && state.phase !== "gameover"
    ? scheduledGameById(state.scheduleGameId)
    : null;
  const next = activeScheduledGame || nextScheduledGame(teamId);
  const played = playedSeasonGameCount(teamId);
  const completedTotal = SEASON_SCHEDULE.filter((game) => scheduleStore.completed[game.id]).length;
  const progress = $("schedule-progress");
  const nextLabel = $("schedule-next");
  const status = $("season-schedule-status");
  const list = $("season-schedule-list");
  const button = $("start-next-scheduled-game");
  if (progress) progress.textContent = `${team.name} ${played} / 120 場 · 全聯盟 ${Math.min(CPBL_TOTAL_SEASON_GAMES, completedTotal)} / ${CPBL_TOTAL_SEASON_GAMES} 場`;
  if (nextLabel) {
    nextLabel.textContent = next
      ? `${activeScheduledGame ? "目前多人賽程" : "下一場"}：${next.date.replaceAll("-", "/")} ${next.isPostseason ? `${next.title} G${next.gameNo}` : next.half} · ${teamFor(next.awayTeamId).shortName} @ ${teamFor(next.homeTeamId).shortName} · ${next.stadium}`
      : `${team.name} 的 2026 賽程已完成。`;
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
      ? `${network.role === "guest" ? "請房主開始賽程" : next.isPostseason ? `開始${next.title} G${next.gameNo}` : "開始下一場例行賽"} <span>↗</span>`
      : "本隊賽程已完成";
  }
  renderPostseason(teamId, next);
  if (!list) return;
  if (!teamGames.length) {
    list.innerHTML = `<p class="season-schedule-empty">尚未找到 ${escapeHtml(team.name)} 的賽程。</p>`;
    return;
  }
  const nextRegularIndex = next && !next.isPostseason ? teamGames.findIndex((game) => game.id === next.id) : -1;
  const visibleGames = nextRegularIndex >= 0
    ? teamGames.slice(Math.max(0, nextRegularIndex - 2), nextRegularIndex + 8)
    : teamGames.slice(-5);
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
  const matchButton = $("set-match-player");
  const matchStatus = $("player-match-selection-status");
  const selectedLineupId = state.lineupIds?.[player.position];
  const playerSlot = state.slots?.[player.position];
  const isStarting = selectedLineupId === player.id || playerSlot?.athleteId === player.id;
  const isLocalController = playerSlot?.controller === "human" && playerSlot.playerId === network.localPlayerId;
  const canSetMatchPlayer = ["pre", "gameover"].includes(state.phase) && (network.role !== "guest" || player.isCustom);
  if (matchButton) {
    matchButton.disabled = !canSetMatchPlayer || playerSlot?.controller === "human" && playerSlot.playerId !== network.localPlayerId;
    matchButton.textContent = isLocalController ? "目前由你控制" : isStarting ? "接手這個位置" : "帶入本場先發";
  }
  if (matchStatus) {
    matchStatus.textContent = state.phase !== "pre" && state.phase !== "gameover"
      ? "比賽進行中，下一場才能調整先發。"
      : playerSlot?.controller === "human" && playerSlot.playerId !== network.localPlayerId
        ? `${player.position} 目前由 ${playerSlot.name} 控制。`
        : player.teamId !== state.teamId
          ? `按下後會切換主隊至 ${teamFor(player.teamId).name}。`
          : isStarting ? `目前先發：${player.name} · ${positionName(player.position)}` : "選定後會套用到本場的打線與能力值。";
  }
  const ratings = player.ratings;
  $("player-detail-name").textContent = player.name;
  $("player-detail-position").textContent = `${player.position} · ${player.role}`;
  const officialPerformance = player.performance ? ` · 2026 AVG ${Number(player.performance.avg || 0).toFixed(3)} / OPS ${Number(player.performance.ops || 0).toFixed(3)}` : "";
  $("player-detail-meta").textContent = `#${player.number} · ${player.bats}打／${player.throws}投 · ${player.age}歲 · ${player.height}cm / ${player.weight}kg · ${player.archetype}${officialPerformance}`;
  $("player-overall").textContent = player.overall;
  $("player-progress").textContent = player.isCustom
    ? `Lv.${profile.level} · XP ${profile.xp}/${xpToNextLevel(profile.level)} · 固定模板 ${player.archetype}`
    : `官方球員 · 2026 能力快照 · 潛力 ${player.potential}`;
  $("player-morale").textContent = player.isCustom ? "90 OVR 需 Lv.15；賽前／賽後手動升級，不提供洗點。" : "官方能力快照";
  const coinBadge = $("player-coin-badge");
  if (coinBadge) coinBadge.textContent = player.isCustom ? `生涯幣 ${profile.careerCoins}` : "官方球員";
  const ratingGroups = [
    ["打擊", [["contact", "擊球能力"], ["contactL", "對左投擊球"], ["contactR", "對右投擊球"], ["power", "長打力量"], ["powerL", "對左投長打"], ["powerR", "對右投長打"], ["vision", "擊球視野"], ["discipline", "選球能力"], ["clutch", "關鍵打擊"], ["bunt", "短打能力"]]],
    ["跑壘", [["speed", "跑壘速度"], ["stealing", "盜壘能力"]]],
    ["守備", [["fielding", "守備範圍"], ["reaction", "反應速度"], ["armStrength", "臂力"], ["armAccuracy", "傳球準確度"], ["blocking", "擋球能力"], ["popTime", "捕手傳球時間"]]],
    ["投球", [["velocity", "球速"], ["control", "投球控球"], ["break", "變化球"], ["stamina", "投手體力"]]],
  ];
  const derivedAttributes = new Set(["contactL", "contactR", "powerL", "powerR", "popTime"]);
  const isEditableNow = ["pre", "gameover"].includes(state.phase);
  $("player-attributes").innerHTML = ratingGroups.map(([title, rows]) => `<div class="attribute-group"><h4>${title}</h4>${rows.map(([key, label]) => {
    const value = Number(ratings[key] || 0);
    const isDerived = derivedAttributes.has(key);
    const canUpgrade = player.isCustom && !isDerived;
    const cap = canUpgrade ? attributeCapForPlayer(player, key) : null;
    const next = value + 1;
    const gate = canUpgrade ? attributeUpgradeGate(next, overallForPlayer({ position: player.position, ratings: { ...ratings, [key]: next } })) : null;
    const price = canUpgrade ? attributeUpgradePrice(player, key, value) : 0;
    const lockedByLevel = canUpgrade && profile.level < gate.level;
    const lockedByCoins = canUpgrade && profile.careerCoins < price;
    const lockedByCap = canUpgrade && next > cap;
    const disabled = !canUpgrade || !isEditableNow || lockedByLevel || lockedByCoins || lockedByCap;
    const buttonLabel = !player.isCustom ? "官方" : isDerived ? "衍生" : !isEditableNow ? "賽後再升" : lockedByCap ? "封頂" : lockedByLevel ? `Lv.${gate.level}` : lockedByCoins ? `${price} 幣` : `+1 · ${price} 幣`;
    const displayValue = key === "popTime" ? value.toFixed(2) : value;
    const barValue = key === "popTime" ? Math.max(20, 100 - value * 28) : value;
    return `<div class="attribute-row ${canUpgrade ? "is-upgradeable" : ""}"><span>${label}</span><i><b style="width:${barValue}%"></b></i><strong>${displayValue}${cap ? `<small>/${cap}</small>` : ""}</strong>${canUpgrade || player.isCustom ? `<button class="attribute-upgrade" data-attribute-upgrade="${key}" type="button" ${disabled ? "disabled" : ""}>${buttonLabel}</button>` : ""}</div>`;
  }).join("")}</div>`).join("");
  setPlayerUpgradeStatus(player.isCustom ? "模板鎖定每項上限；能力越高，生涯幣成本與等級要求越高。" : "官方 2026 球員是固定能力快照，請選擇自創球員進行生涯升級。");
  const batting = player.stats.batting;
  const pitching = player.stats.pitching;
  const fielding = player.stats.fielding;
  const battingRates = calculateBattingLine(batting);
  const pitchingRates = calculatePitchingLine(pitching);
  const fieldingRates = calculateFieldingLine(fielding);
  const pitchMix = player.pitchMix?.length ? `<div class="pitch-mix"><b>球種</b> ${player.pitchMix.map((pitch) => `<span>${pitch}</span>`).join("")}</div>` : "";
  $("player-statline").innerHTML = `${pitchMix}
    <div class="statline-section"><h4>打擊生涯／賽季</h4><div class="statline-grid"><span>G <b>${batting.G}</b></span><span>PA <b>${batting.PA}</b></span><span>AB <b>${batting.AB}</b></span><span>R <b>${batting.R}</b></span><span>H <b>${batting.H}</b></span><span>2B <b>${batting.doubles}</b></span><span>3B <b>${batting.triples}</b></span><span>HR <b>${batting.HR}</b></span><span>RBI <b>${batting.RBI}</b></span><span>BB <b>${batting.BB}</b></span><span>SO <b>${batting.SO}</b></span><span>SB <b>${batting.SB}</b></span><span>CS <b>${batting.CS}</b></span><span>HBP <b>${batting.HBP}</b></span><span>SF <b>${batting.SF}</b></span><span>AVG <b>${formatRate(battingRates.AVG)}</b></span><span>OBP <b>${formatRate(battingRates.OBP)}</b></span><span>SLG <b>${formatRate(battingRates.SLG)}</b></span><span>OPS <b>${formatRate(battingRates.OPS)}</b></span></div></div>
    <div class="statline-section"><h4>投球</h4><div class="statline-grid"><span>G <b>${pitching.G}</b></span><span>GS <b>${pitching.GS}</b></span><span>W <b>${pitching.W}</b></span><span>L <b>${pitching.L}</b></span><span>SV <b>${pitching.SV}</b></span><span>IP <b>${window.CareerEngine.innings(pitching.outs ?? Math.round(Number(pitching.IP || 0) * 3))}</b></span><span>H <b>${pitching.H}</b></span><span>ER <b>${pitching.ER}</b></span><span>HR <b>${pitching.HR}</b></span><span>BB <b>${pitching.BB}</b></span><span>K <b>${pitching.SO}</b></span><span>HBP <b>${pitching.HBP}</b></span><span>WP <b>${pitching.WP}</b></span><span>ERA <b>${pitchingRates.ERA.toFixed(2)}</b></span><span>FIP <b>${pitchingRates.FIP.toFixed(2)}</b></span><span>WHIP <b>${pitchingRates.WHIP.toFixed(2)}</b></span><span>K/9 <b>${pitchingRates.K9.toFixed(1)}</b></span></div></div>
    <div class="statline-section"><h4>守備</h4><div class="statline-grid"><span>G <b>${fielding.G}</b></span><span>GS <b>${fielding.GS}</b></span><span>INN <b>${fielding.INN}</b></span><span>PO <b>${fielding.PO}</b></span><span>A <b>${fielding.A}</b></span><span>E <b>${fielding.E}</b></span><span>DP <b>${fielding.DP}</b></span><span>PB <b>${fielding.PB}</b></span><span>SB <b>${fielding.SB}</b></span><span>CS <b>${fielding.CS}</b></span><span>FPCT <b>${fieldingRates.FPCT.toFixed(3)}</b></span><span>RF/9 <b>${fieldingRates.RF9.toFixed(2)}</b></span></div></div>`;
  const standings = LEAGUE_TEAMS.map((team) => {
    const record = teamRecord(team.id);
    const games = record.W + record.L + record.T;
    return { team, record, pct: games ? (record.W + record.T * 0.5) / games : 0, diff: record.RF - record.RA };
  }).sort((left, right) => right.pct - left.pct || right.diff - left.diff || right.record.W - left.record.W);
  $("league-standings").innerHTML = standings.map((row, index) => `<div class="standing-row"><b>${index + 1}</b><span class="standing-team"><i style="background:${row.team.color}"></i>${row.team.name}</span><span>${row.record.W}-${row.record.L}-${row.record.T}</span><span>${formatRate(row.pct, 3)}</span><span>${row.diff >= 0 ? "+" : ""}${row.diff}</span></div>`).join("");
}

const lineup = [
  { position: "CF", number: "07", name: "岳正華", contact: 82, power: 67 },
  { position: "RF", number: "23", name: "詹子玄", contact: 74, power: 86 },
  { position: "3B", number: "31", name: "王威宸", contact: 79, power: 77 },
  { position: "1B", number: "44", name: "許基鴻", contact: 76, power: 92 },
  { position: "LF", number: "12", name: "宋勝睿", contact: 76, power: 81 },
  { position: "2B", number: "08", name: "王正順", contact: 70, power: 64 },
  { position: "SS", number: "19", name: "江昆宇", contact: 70, power: 72 },
  { position: "C", number: "02", name: "高育傑", contact: 73, power: 58 },
  { position: "P", number: "55", name: "鄭皓均", contact: 61, power: 56 },
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
  "fielding-first": { icon: "➜", title: "傳一壘", detail: "先確保一個出局，穩定處理滾地球", key: "1" },
  "fielding-force": { icon: "↪", title: "封殺領先跑者", detail: "依壘上跑者選擇封殺位置", key: "2" },
  "fielding-double": { icon: "⇄", title: "啟動雙殺", detail: "有跑者時拚連續抓下兩個出局", key: "3" },
  "fielding-home": { icon: "⌂", title: "傳本壘", detail: "三壘有跑者時阻止失分", key: "4" },
  "fielding-dive": { icon: "⌁", title: "飛身攔截", detail: "撲球可能多抓出局，失手會讓跑者推進", key: "5" },
};

const OUTFIELD_ACTION_META = {
  "fielding-catch": { icon: "✦", title: "接殺出局", detail: "穩穩收下飛球，直接結束打者跑壘", key: "1" },
  "fielding-dive": { icon: "⌁", title: "飛身接球", detail: "拚接殺機會，落地後可能多掉一分", key: "2" },
  "fielding-relay": { icon: "↪", title: "傳給中繼", detail: "交給隊友縮短傳球距離", key: "3" },
  "fielding-cutoff": { icon: "●", title: "傳給補位", detail: "先確保球回到內野，控制跑者推進", key: "4" },
  "fielding-throw": { icon: "↗", title: "直接長傳", detail: "強肩有機會抓到跑者，失手會增加危機", key: "5" },
};

const CATCHER_ACTION_META = {
  "catcher-fastball": { icon: "●", title: "速球搶好球", detail: "配合投手搶下好球數，失投風險稍高", key: "1" },
  "catcher-break": { icon: "⌁", title: "變化球引誘", detail: "誘使打者追打，爭取弱擊球", key: "2" },
  "catcher-low": { icon: "↘", title: "低球製造滾地", detail: "壓低球路，讓內野有封殺機會", key: "3" },
  "catcher-away": { icon: "⇢", title: "外角配球", detail: "拉開好球帶邊緣，降低長打風險", key: "4" },
  "catcher-pickoff": { icon: "↩", title: "提醒牽制", detail: "跑者有機會時打亂節奏，保護壘包", key: "5" },
};

const RUNNER_ACTION_META = {
  steal: { icon: "»", title: "搶下一個壘包", detail: "判斷投手動作後起跑", key: "1" },
  "runner-hold": { icon: "●", title: "留在壘包", detail: "不冒險，等待打者推進", key: "2" },
};

const SIGNAL_META = {
  steady: "穩一點",
  runner: "注意跑者",
  cover: "我來補位",
  npc: "先交給 NPC",
};

const TEAM_PLAN_META = {
  steady: { label: "穩定執行", detail: "選球與基本守備更穩" },
  runner: { label: "跑者先行", detail: "盜壘與短打更積極" },
  cover: { label: "守備補位", detail: "責任區處理更有把握" },
  npc: { label: "NPC 補位", detail: "把下一個空缺交給 NPC" },
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

const VIEW_TARGETS = {
  match: "game-card",
  multiplayer: "network-card",
  career: "career-feature",
  season: "season-feature",
  roster: "roster-feature",
};
let activeView = "match";

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
    defenseOpportunities: 0,
    runnerOpportunities: 0,
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
    careerPlayerId: String(schedule.careerPlayerId || ""),
    scheduleGameId: String(schedule.id || ""),
    scheduleGameNo: Number(schedule.gameNo || 0),
    scheduleDate: String(schedule.date || ""),
    scheduleOfficialHomeTeamId: String(schedule.officialHomeTeamId || ""),
    scheduleOfficialAwayTeamId: String(schedule.officialAwayTeamId || ""),
    schedulePlayerIsAway: Boolean(schedule.playerIsAway),
    scheduleStage: String(schedule.stage || "regular"),
    phase: "pre",
    inning: 1,
    half: "top",
    defenseOwner: "P",
    defenseMode: "strategy",
    defenseAction: "",
    homeMode: "batter",
    runnerDecisionPosition: "",
    runnerDecisionUsed: false,
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
    teamPlan: "",
    teamPlanOwner: "",
    teamPlanToken: 0,
    eventToken: 0,
    actionDeadline: 0,
    timeouts: 0,
    pendingAwayRuns: 0,
    awaySeries: null,
    currentAwayPlay: null,
    fieldingCursor: 0,
    matchId: `m-${randomSeed().toString(36)}`,
    eventSequence: 0,
    activeEvent: null,
    lastSettledEventId: "",
    log: [],
    slots: createSlots(teamId),
    playerStats: createPlayerStats(),
    lineupIds: defaultLineupIdsForTeam(teamId),
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
    lineupIds: normalizeLineupIds(normalizedTeamId, snapshot.lineupIds),
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

function setActiveView(viewId = "match", { targetId = "", scroll = true } = {}) {
  if (window.GameUI) return window.GameUI.navigate(viewId, { targetId, scroll });
  activeView = VIEW_TARGETS[viewId] ? viewId : "match";
  document.body.dataset.activeView = activeView;
  document.querySelectorAll(".section-nav-link").forEach((link) => {
    const isActive = link.dataset.view === activeView;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const visibleDetails = activeView === "career"
    ? [targetId && ["player-builder-feature", "career-feature"].includes(targetId)
      ? targetId
      : selectedCareerPlayer() ? "career-feature" : "player-builder-feature"]
    : activeView === "season"
      ? ["season-feature"]
      : activeView === "roster"
        ? ["roster-feature"]
      : [];
  document.querySelectorAll(".feature-disclosure").forEach((detail) => {
    if (!visibleDetails.includes(detail.id)) detail.open = false;
    if (targetId && detail.id === targetId) detail.open = true;
  });
  if (!scroll) return;
  const target = $(targetId || VIEW_TARGETS[activeView]);
  if (target) window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

function applyTeamPlan(name, signal) {
  const plan = TEAM_PLAN_META[signal];
  if (!plan || !isAuthority()) return false;
  state.teamPlan = signal;
  state.teamPlanOwner = cleanName(name || network.displayName);
  state.teamPlanToken = (state.teamPlanToken || 0) + 1;
  state.teamChemistry = clamp(state.teamChemistry + 3, 8, 96);
  setMomentum(signal === "runner" ? 2 : 1);
  addLog(`${state.teamPlanOwner} 發出「${plan.label}」：${plan.detail}。`, "big");
  return true;
}

function teamPlanMultiplier(action) {
  const plan = state.teamPlan;
  if (plan === "steady" && ["contact", "patient", "defense-control", "fielding-catch", "fielding-hold"].includes(action)) return 1.08;
  if (plan === "runner" && ["steal", "bunt"].includes(action)) return 1.15;
  if (plan === "cover" && String(action).startsWith("fielding-")) return 1.12;
  return 1;
}

function teamPlanMatchesAction(action) {
  if (!state.teamPlan) return false;
  if (state.teamPlan === "steady") return ["contact", "patient", "defense-control", "fielding-catch", "fielding-hold"].includes(action);
  if (state.teamPlan === "runner") return ["steal", "bunt"].includes(action);
  if (state.teamPlan === "cover") return String(action).startsWith("fielding-");
  return state.teamPlan === "npc";
}

function consumeTeamPlan(action = "") {
  if (!teamPlanMatchesAction(action)) return;
  state.teamPlan = "";
  state.teamPlanOwner = "";
  state.teamPlanToken = 0;
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
  const plan = TEAM_PLAN_META[signal];
  status.textContent = `${cleanName(name || network.displayName)}：${label}${plan ? ` · ${plan.detail}` : ""}`;
  window.clearTimeout(network.signalTimer);
  network.signalTimer = window.setTimeout(() => {
    status.textContent = "用短訊息提醒隊友；下一個對應決策會帶來小幅團隊加成。";
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
  applyTeamPlan(network.displayName, signal);
  broadcastTeamSignal(network.displayName, signal);
  commitState();
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
  state.activeEvent = null;
  state.eventToken = (state.eventToken || 0) + 1;
}

function chooseTimeoutAction() {
  if (state.phase === "defense") {
    if (state.defenseMode === "catcher") return "catcher-low";
    if (state.defenseMode === "fielding") return state.currentAwayPlay?.kind === "groundball" ? "fielding-first" : "fielding-relay";
    return "defense-control";
  }
  if (state.homeMode === "runner") return "runner-hold";
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
    const fallbackName = DEFENSE_ACTION_META[action]?.title || CATCHER_ACTION_META[action]?.title || FIELDING_ACTION_META[action]?.title || OUTFIELD_ACTION_META[action]?.title || RUNNER_ACTION_META[action]?.title || (state.phase === "defense" ? "穩定控球" : "安全推打");
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
  const timeoutKey = state.phase === "defense"
    ? state.defenseMode === "fielding" ? "fielding" : state.defenseMode === "catcher" ? "catcher" : "defense"
    : state.homeMode === "runner" ? "runner" : "home";
  state.actionDeadline = Date.now() + ACTION_TIMEOUT_MS[timeoutKey];
  const options = Object.entries(activeActionMeta())
    .filter(([action]) => canAction(action))
    .map(([action, meta]) => ({ action, label: meta.title }));
  const owner = activeEventPosition();
  const type = state.phase === "defense"
    ? state.defenseMode === "fielding" ? "fielding" : state.defenseMode === "catcher" ? "catcher-call" : "pitch"
    : state.homeMode === "runner" ? "runner" : "batting";
  const situation = state.phase === "defense"
    ? state.defenseMode === "fielding"
      ? state.currentAwayPlay?.situation || `${positionName(owner)}處理${state.currentAwayPlay?.kind === "groundball" ? "內野滾地球" : "外野飛球"}。`
      : state.defenseMode === "catcher"
        ? `${positionName(owner)}與投手配球；上一球策略：${DEFENSE_ACTION_META[state.awaySeries?.pitchAction]?.title || "穩定控球"}。`
        : "投手先選擇策略，捕手下一步調整球種和落點。"
    : state.homeMode === "runner"
      ? `${positionName(owner)}是目前可推進的跑者；選擇起跑或留在壘包。`
      : `${positionName(owner)}打者處理目前球數與投球。`;
  state.eventSequence = (state.eventSequence || 0) + 1;
  state.activeEvent = {
    id: `${state.matchId}:E${state.eventSequence}`,
    type,
    owner,
    options,
    deadline: state.actionDeadline,
    situation,
    situationData: {
      inning: state.inning,
      half: state.half,
      outs: state.outs,
      balls: state.balls,
      strikes: state.strikes,
      score: { ...state.score },
      bases: { ...state.bases },
      position: owner,
      play: state.currentAwayPlay ? { number: state.currentAwayPlay.number, kind: state.currentAwayPlay.kind } : null,
    },
    revision: state.revision + 1,
  };
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
  if (state.activeEvent) state.activeEvent.revision = state.revision;
  window.CareerMode?.capture();
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
  if (!window.GameUI && state.phase !== "pre") setActiveView(network.role === "solo" ? "match" : "multiplayer", { scroll: false });
  if (network.role === "guest" && state.phase === "gameover" && previousPhase !== "gameover" && state.leagueRecorded) recordLocalGuestMatchCareer();
  if (network.role === "guest") network.status = "已同步：輪到你的打席時，按下你的決策。";
  render();
}

function renderPlayerHub() {
  if (window.CareerMode) return;
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
  const nextAction = $("hub-next-action");
  const coins = $("hub-coins");
  const trust = $("hub-trust");
  const morale = $("hub-morale");
  if (!player || !profile) {
    if (avatar) avatar.textContent = "MP";
    if (name) name.textContent = "建立你的 My Player";
    if (meta) meta.textContent = "從 60 OVR 開始，選擇自己的位置與成長路線。";
    if (overall) overall.textContent = "—";
    if (level) level.textContent = "Lv.—";
    if (xp) xp.textContent = "XP —";
    if (progressBar) progressBar.style.width = "0%";
    if (coins) coins.textContent = "—";
    if (trust) trust.textContent = "—";
    if (morale) morale.textContent = "—";
    if (nextTitle) nextTitle.textContent = "先建立你的球員";
    if (nextCopy) nextCopy.textContent = "選一個模板，再把建造點放到你真正想玩的能力。";
    if (nextAction) {
      nextAction.classList.add("hub-action-primary");
      nextAction.dataset.view = "career";
      nextAction.href = "#player-builder-feature";
      nextAction.querySelector("b")?.replaceChildren("建立球員");
      nextAction.querySelector("small")?.replaceChildren("進入自創球員工坊");
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
  if (coins) coins.textContent = profile.careerCoins;
  if (trust) trust.textContent = `${careerCoachTrust(profile)}%`;
  if (morale) morale.textContent = profile.morale;
  if (nextTitle) nextTitle.textContent = goal.label;
  if (nextCopy) nextCopy.textContent = `${goal.detail} ${goalProgress}/${goal.target}；${path.label}訓練可獲得額外 XP。`;
  if (nextAction) {
    nextAction.classList.remove("hub-action-primary");
    nextAction.dataset.view = "career";
    nextAction.href = "#career-feature";
    nextAction.querySelector("b")?.replaceChildren("前往訓練");
    nextAction.querySelector("small")?.replaceChildren("完成下一個生涯目標");
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
  if (state.careerPlayerId && !["pre", "gameover"].includes(state.phase) && position !== customPlayerIndex[state.careerPlayerId]?.position) { setStatus("生涯比賽只能操作自己建立的固定位置。"); return false; }
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
    else if (message.type === "reset") sendConnection(connection, { type: "status", message: "只有房主可以回到賽前設定。", awaiting: false });
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
  applyTeamPlan(record.name || `球員 ${record.playerId}`, signal);
  broadcastTeamSignal(record.name || `球員 ${record.playerId}`, signal);
  commitState();
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
  const validEvent = message.protocol === PROTOCOL_VERSION
    && Number(message.revision) === state.revision
    && message.eventId === state.activeEvent?.id
    && (window.MatchEngine?.consumeEventSubmission
      ? window.MatchEngine.consumeEventSubmission(state, { eventId: message.eventId, revision: message.revision })
      : Boolean(state.activeEvent && state.lastSettledEventId !== state.activeEvent.id));
  if (!validEvent) {
    sendSnapshotTo(record.connection);
    sendConnection(record.connection, { type: "status", message: "這一步已經更新，已重新同步最新狀態。" });
    return;
  }
  const settledEventId = state.lastSettledEventId;
  const accepted = performActionForPlayer(record.playerId, message.action, false, "", message.timingPosition);
  if (!accepted) {
    if (state.lastSettledEventId === settledEventId) state.lastSettledEventId = "";
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
  if (window.CareerMode?.guardRoom()) return;
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
  if (window.CareerMode?.guardRoom()) return;
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
  if (window.GameUI?.isCareerContext() && window.CareerMode && network.role === "solo") return window.CareerMode.startNext();
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
    network.status = network.connected ? "只有房主可以回到賽前設定，請由房主按下回到賽前。" : "目前尚未連上房主，無法回到賽前設定。";
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
  window.CareerMode?.creditRun(runnerPosition);
  state.score.home += 1;
  state.currentHalfRuns += 1;
  if (runnerPosition && state.playerStats[runnerPosition]) state.playerStats[runnerPosition].runs += 1;
  setMomentum(8);
}

function checkWalkoff() {
  if (state.careerPlayerId && state.schedulePlayerIsAway) return false;
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
  window.CareerMode?.creditBatting(batter.position, { hitType, walk, strikeout });
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
    .map(([base, value]) => state.phase === "defense" ? `${labels[base]}（客隊）` : `${labels[base]}（${positionShort(value)}）`);
  $("field-note").textContent = occupied.length
    ? `${occupied.join("、")}有人，${state.phase === "defense" ? "守備要判斷先抓出局或限制跑者推進。" : "隊友正在把壓力變成分數。"}`
    : "壘上乾淨，先把球送進場內。";
  document.querySelectorAll(".out-light").forEach((light, index) => light.classList.toggle("active", index < state.outs));
  $("outs-badge").textContent = `${state.outs} OUT`;
}

function renderLineScore() {
  const lastInning = Math.max(9, state.inning);
  const swap = Boolean(state.schedulePlayerIsAway && (state.matchMode === "season" || state.careerPlayerId));
  const awayKey = swap ? "home" : "away", homeKey = swap ? "away" : "home";
  const awayTeam = teamFor(swap ? state.teamId : state.opponentId);
  const homeTeam = teamFor(swap ? state.opponentId : state.teamId);
  const cells = ["<span class=\"line-label\">隊伍</span>"];
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${inning}</span>`);
  cells.push("<span class=\"line-total\">R</span>");
  cells.push(`<span class="line-label">${escapeHtml(awayTeam.shortName)}</span>`);
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${state.innings[inning - 1]?.[awayKey] ?? "·"}</span>`);
  cells.push(`<span class="line-total">${state.score[awayKey]}</span>`);
  cells.push(`<span class="line-label">${escapeHtml(homeTeam.shortName)}</span>`);
  for (let inning = 1; inning <= lastInning; inning += 1) cells.push(`<span class="${state.inning === inning ? "line-current" : ""}">${state.innings[inning - 1]?.[homeKey] ?? "·"}</span>`);
  cells.push(`<span class="line-total">${state.score[homeKey]}</span>`);
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
  const teamPlanLabel = $("team-plan-label");
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
  if (teamPlanLabel) {
    const plan = TEAM_PLAN_META[state.teamPlan];
    teamPlanLabel.textContent = plan ? `${plan.label}${state.teamPlanOwner ? ` · ${state.teamPlanOwner}` : ""}` : "未設定";
  }
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
  const runnerDecision = state.phase === "home" && state.homeMode === "runner";
  const active = state.phase === "home" || defense;
  const position = defense ? state.defenseOwner : runnerDecision ? state.runnerDecisionPosition : batter.position;
  const slot = state.slots[position];
  const definition = POSITION_BY_CODE[position];
  const runner = runnerDecision ? matchPlayerForPosition(position, state.teamId) || definition : null;
  $("batter-number").textContent = active ? (defense || runnerDecision ? definition.short : batter.number) : "—";
  $("batter-name").textContent = active ? defense ? `${definition.name}守備` : runnerDecision ? `${runner.name}跑壘` : batter.name : state.phase === "gameover" ? "全場比賽結束" : "等待開賽";
  $("batter-meta").textContent = active
    ? defense
      ? `${definition.name} · ${slot?.controller === "npc" ? "NPC 補位中" : `${slot?.name || "隊友"} 控制`} · ${state.defenseMode === "fielding" ? "責任區來球處理" : state.defenseMode === "catcher" ? "投捕配球交接" : "投手球路策略"}`
      : runnerDecision
        ? `${positionName(position)} · ${slot?.controller === "npc" ? "NPC 補位中" : `${slot?.name || "隊友"} 控制`} · 跑壘時機判斷`
        : `${positionName(batter.position)} · ${slot?.controller === "npc" ? "NPC 補位中" : `${slot?.name || "隊友"} 控制`} · 第 ${state.decisions + 1} 個團隊決策`
    : state.phase === "gameover" ? "下一場比賽，新的九局，新的故事。" : "先選擇一個球員位置，再開始比賽。";
  const firstValue = defense ? definition.fielding : runnerDecision ? Number(runner?.speed || 60) : batter.contact;
  const secondValue = defense ? definition.arm : runnerDecision ? Number(runner?.stealing || 60) : batter.power;
  $("contact-meter").style.width = `${active ? firstValue : 0}%`;
  $("power-meter").style.width = `${active ? secondValue : 0}%`;
  $("contact-value").textContent = active ? firstValue : "—";
  $("power-value").textContent = active ? secondValue : "—";
  const meterLabels = document.querySelectorAll(".meter-row > span");
  if (meterLabels[0]) meterLabels[0].textContent = defense ? "FIELDING" : runnerDecision ? "SPEED" : "CONTACT";
  if (meterLabels[1]) meterLabels[1].textContent = defense ? "ARM" : runnerDecision ? "STEAL" : "POWER";
}

function activeEventPosition() {
  if (state.phase === "defense") return state.defenseOwner;
  if (state.phase === "home" && state.homeMode === "runner" && state.runnerDecisionPosition) return state.runnerDecisionPosition;
  return currentBatter().position;
}

function activeEventSlot() {
  return state.slots[activeEventPosition()];
}

function matchTimingEventKey() {
  return [state.activeEvent?.id || "", state.eventToken, state.phase, state.defenseMode, state.defenseOwner, state.homeMode, state.inning, state.batterIndex, state.balls, state.strikes].join("|");
}

function actionUsesMatchTiming(action) {
  if (state.phase === "home") return ["power", "contact", "bunt"].includes(action);
  return state.phase === "defense" && state.defenseMode === "strategy" && Object.prototype.hasOwnProperty.call(DEFENSE_ACTION_META, action);
}

function timingSeedFor(action) {
  const source = `${matchTimingEventKey()}|${action}|${state.teamId}|${state.opponentId}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function matchTimingConfig(action) {
  const pitching = state.phase === "defense";
  const athlete = pitching ? matchPlayerForPosition("P", state.teamId) || playerForPosition("P", state.teamId) : currentBatter();
  const ratings = athlete?.ratings || athlete || {};
  const skill = pitching
    ? Number(ratings.control || 60)
    : action === "bunt"
      ? Number(ratings.bunt || 55)
      : Number(ratings.contact || 60) * .68 + Number(ratings.vision || 60) * .32;
  const actionWidth = action === "contact" ? 3 : action === "bunt" ? 2 : 0;
  const targetWidth = clamp(Math.round(13 + Math.max(0, skill - 35) * .12 + actionWidth), 13, 25);
  const seed = timingSeedFor(action);
  const targetCenter = 24 + (seed % 5200) / 100;
  return {
    action,
    kind: pitching ? "pitching" : "hitting",
    skill,
    targetWidth,
    targetCenter,
    cycleMs: pitching ? 1550 : action === "power" ? 1400 : 1650,
  };
}

function timingScoreFromConfig(config, markerPosition) {
  const position = clamp(Number(markerPosition || 0), 0, 100);
  const distance = Math.abs(position - config.targetCenter);
  const inside = distance <= config.targetWidth / 2;
  return inside
    ? clamp(Math.round(100 - distance * 1.35), 82, 99)
    : clamp(Math.round(79 - Math.max(0, distance - config.targetWidth / 2) * 1.45), 25, 79);
}

function matchTimingScoreFor(action, markerPosition) {
  return timingScoreFromConfig(matchTimingConfig(action), markerPosition);
}

function timingGrade(score) {
  if (score >= 94) return "完美";
  if (score >= 82) return "良好";
  if (score >= 60) return "稍早／稍晚";
  return "失去節奏";
}

function npcMatchTimingScore(action) {
  const config = matchTimingConfig(action);
  return clamp(Math.round(42 + config.skill * .45 + nextRandom() * 18), 45, 98);
}

function clearMatchTiming() {
  if (matchTimingAnimationFrame) window.cancelAnimationFrame(matchTimingAnimationFrame);
  if (matchTimingTimer) window.clearTimeout(matchTimingTimer);
  matchTimingAnimationFrame = 0;
  matchTimingTimer = 0;
  matchTimingChallenge = null;
}

function beginMatchTiming(action) {
  if (!localControlsActiveEvent() || !canAction(action) || !actionUsesMatchTiming(action)) return false;
  clearMatchTiming();
  matchTimingChallenge = {
    action,
    eventKey: matchTimingEventKey(),
    config: matchTimingConfig(action),
    markerPosition: 0,
    startedAt: performance.now(),
  };
  render();
  const challenge = matchTimingChallenge;
  const animate = (timestamp) => {
    if (matchTimingChallenge !== challenge || challenge.eventKey !== matchTimingEventKey()) return;
    const cycle = ((timestamp - challenge.startedAt) % challenge.config.cycleMs) / challenge.config.cycleMs;
    challenge.markerPosition = cycle <= .5 ? cycle * 200 : (1 - cycle) * 200;
    const marker = $("match-timing-marker");
    const score = $("match-timing-score");
    if (marker) marker.style.left = `${challenge.markerPosition}%`;
    if (score) score.textContent = `${timingScoreFromConfig(challenge.config, challenge.markerPosition)} 分`;
    matchTimingAnimationFrame = window.requestAnimationFrame(animate);
  };
  matchTimingAnimationFrame = window.requestAnimationFrame(animate);
  matchTimingTimer = window.setTimeout(() => finishMatchTiming(true), MATCH_TIMING_TIMEOUT_MS);
  return true;
}

function finishMatchTiming(timedOut = false) {
  const challenge = matchTimingChallenge;
  if (!challenge || challenge.eventKey !== matchTimingEventKey()) {
    clearMatchTiming();
    render();
    return;
  }
  const timingPosition = timedOut
    ? challenge.config.targetCenter < 50 ? 100 : 0
    : challenge.markerPosition;
  const action = challenge.action;
  clearMatchTiming();
  if (network.role === "guest") {
    network.awaiting = true;
    const sent = sendToHost({ type: "action", protocol: PROTOCOL_VERSION, revision: state.revision, eventId: state.activeEvent?.id || "", action, timingPosition });
    if (!sent) {
      network.awaiting = false;
      network.status = "時機操作傳送失敗，請確認連線後再試。";
    } else network.status = "時機操作已送出，等待房主驗證結果。";
    render();
    return;
  }
  performActionForPlayer(network.localPlayerId, action, false, timedOut ? "timing-timeout" : "", timingPosition);
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
  if (state.phase !== "defense") return state.homeMode === "runner" ? RUNNER_ACTION_META : ACTION_META;
  if (state.defenseMode === "catcher") return CATCHER_ACTION_META;
  if (state.defenseMode !== "fielding") return DEFENSE_ACTION_META;
  if (state.currentAwayPlay?.kind !== "groundball") return OUTFIELD_ACTION_META;
  const actions = { ...FIELDING_ACTION_META };
  if (!(state.currentAwayPlay?.runnerCount > 0)) delete actions["fielding-double"];
  if (!state.currentAwayPlay?.leadRunnerOnThird) delete actions["fielding-home"];
  return actions;
}

function canAction(action) {
  if (state.phase === "defense") {
    if (!Object.prototype.hasOwnProperty.call(activeActionMeta(), action)) return false;
    if (action === "fielding-double" && !(state.currentAwayPlay?.runnerCount > 0)) return false;
    if (action === "fielding-home" && !state.currentAwayPlay?.leadRunnerOnThird) return false;
    return true;
  }
  if (state.homeMode === "runner") return action === "runner-hold" || (action === "steal" && canSteal());
  if (!["power", "contact", "patient", "bunt"].includes(action)) return false;
  if (action === "bunt" && !hasRunners()) return false;
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

function renderCountLights() {
  const lights = $("count-lights");
  if (!lights) return;
  const balls = Math.max(0, Math.min(4, Number(state.balls) || 0));
  const strikes = Math.max(0, Math.min(3, Number(state.strikes) || 0));
  const isBatterDecision = state.phase === "home";
  lights.hidden = !isBatterDecision;
  lights.setAttribute("aria-label", `壞球 ${balls}、好球 ${strikes}`);
  [
    ["balls", balls, "壞球"],
    ["strikes", strikes, "好球"],
  ].forEach(([type, value, label]) => {
    document.querySelectorAll(`[data-count-light="${type}"]`).forEach((light, index) => {
      light.classList.toggle("is-on", index < value);
    });
    const group = lights.querySelector(`.count-light-group[aria-label^="${label}"]`);
    group?.setAttribute("aria-label", `${label} ${value} 顆`);
  });
}

function renderMatchTiming() {
  const panel = $("match-timing-panel");
  const actionsGrid = $("match-actions-grid");
  if (!panel || !actionsGrid) return false;
  const active = Boolean(matchTimingChallenge && matchTimingChallenge.eventKey === matchTimingEventKey() && localControlsActiveEvent());
  if (!active && matchTimingChallenge) clearMatchTiming();
  panel.hidden = !active;
  actionsGrid.hidden = active;
  if (!active) return false;
  const challenge = matchTimingChallenge;
  const config = challenge.config;
  const kind = $("match-timing-kind");
  const title = $("match-timing-title");
  const target = $("match-timing-target");
  const marker = $("match-timing-marker");
  const buttonLabel = $("match-timing-button-label");
  const hint = $("match-timing-hint");
  if (kind) kind.textContent = config.kind === "pitching" ? "PITCH RELEASE · 投球放球點" : "BAT TIMING · 擊球時機";
  if (title) title.textContent = config.kind === "pitching" ? "指針進入控球區時放球" : config.action === "bunt" ? "在綠色區內把球點下去" : "看準綠色甜蜜區揮棒";
  if (target) {
    target.style.left = `${config.targetCenter - config.targetWidth / 2}%`;
    target.style.width = `${config.targetWidth}%`;
  }
  if (marker) marker.style.left = `${challenge.markerPosition}%`;
  if (buttonLabel) buttonLabel.textContent = config.kind === "pitching" ? "放球" : config.action === "bunt" ? "觸擊" : "揮棒";
  if (hint) hint.textContent = config.kind === "pitching"
    ? "放球越接近中央，這個半局的失分風險越低。"
    : "時機會直接影響安打、長打、界外與揮空機率。";
  return true;
}

function renderActions() {
  const batter = currentBatter();
  const defense = state.phase === "defense";
  const actionMeta = activeActionMeta();
  const position = activeEventPosition();
  const slot = activeEventSlot();
  const localTurn = localControlsActiveEvent();
  const timingActive = renderMatchTiming();
  const ownerText = slot?.controller === "npc" ? "NPC 正在閱讀球況" : slot?.playerId === network.localPlayerId ? "輪到你決定" : `等待 ${slot?.name || "隊友"}`;
  $("action-title-batting").textContent = defense
    ? `${positionName(position)} ${state.defenseMode === "fielding" ? "守備事件" : state.defenseMode === "catcher" ? "捕手配球" : "投手決策"} · ${ownerText}`
    : state.phase === "home" && state.homeMode === "runner"
      ? `${positionName(position)}跑者 · ${ownerText}`
      : state.phase === "home" ? `${batter.position} ${batter.name} · ${ownerText}` : "選擇一個策略";
  $("pitch-count-note").textContent = timingActive
    ? defense ? "完成放球時機" : "完成擊球時機"
    : network.awaiting ? "決策已送出，等待同步"
      : defense ? state.defenseMode === "fielding" ? `客隊攻勢：${state.pendingAwayRuns} 分預估` : state.defenseMode === "catcher" ? "捕手接手配球，決定球種與落點" : "投手先設定球路策略"
        : state.phase === "home" && state.homeMode === "runner" ? "跑者起跑時機 · 可選擇盜壘或留壘"
          : state.phase === "home" ? `${state.balls} 壞球 · ${state.strikes} 好球` : "選擇一個策略";
  renderCountLights();
  const actionKeys = Object.keys(actionMeta);
  actionButtons.forEach((button) => {
    const action = actionKeys[actionButtons.indexOf(button)];
    const meta = action ? actionMeta[action] : null;
    button.hidden = !meta;
    if (!meta) {
      button.disabled = true;
      button.removeAttribute("data-action");
      return;
    }
    button.dataset.action = action;
    const allowed = localTurn && !timingActive && canAction(action);
    button.disabled = !allowed;
    button.querySelector(".action-icon").textContent = meta.icon;
    button.querySelector("b").textContent = meta.title;
    button.querySelector("small").textContent = meta.detail;
    button.querySelector("kbd").textContent = meta.key;
  });
  renderDecisionTimer();
  $("action-hint").textContent = timingActive
    ? "按下畫面按鈕或空白鍵；越接近綠色區中央，實戰效果越好。"
    : network.awaiting
    ? "決策已送出，房主正在驗證並同步結果。"
    : defense && slot?.controller === "npc"
      ? state.defenseMode === "fielding" ? `${positionName(position)} 目前由 NPC 補位；真人加入或接手後即可處理來球。` : "投手或捕手目前由 NPC 補位；真人加入或接手後即可操作守備策略。"
      : defense
        ? state.defenseMode === "fielding"
          ? localTurn ? "這是你的責任區；基本接球最穩，冒險撲球可能追回更多分數。" : `目前由 ${slot?.name || "隊友"} 處理${positionName(position)}的來球。`
          : state.defenseMode === "catcher"
            ? localTurn ? "捕手配球會配合投手策略，改變擊球落點與跑者風險。" : `目前由 ${slot?.name || "隊友"} 接手投捕配合。`
            : localTurn ? "投手策略會影響球種與客隊打球落點。" : `目前由 ${slot?.name || "隊友"} 決定投球策略。`
        : state.phase !== "home"
          ? "比賽開始後，輪到你的球員打擊時才會啟用操作。"
          : state.homeMode === "runner"
            ? slot?.controller === "npc" ? "NPC 正在判讀投手動作與下一個壘包。" : localTurn ? "判斷投手起動與捕手站位，再決定搶壘或留壘。" : `目前由 ${slot?.name || "隊友"} 決定跑壘。`
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

function renderMatchEvent() {
  const panel = $("match-event-panel");
  if (!panel) return;
  const event = state.activeEvent;
  const active = Boolean(event && (state.phase === "defense" || state.phase === "home"));
  panel.hidden = !active;
  document.querySelectorAll("[data-field-position]").forEach((marker) => {
    const position = marker.dataset.fieldPosition;
    const involved = state.phase === "defense"
      ? ["P", "C", ...(state.awaySeries?.plan?.plays || []).map((play) => play.position)].includes(position)
      : active && position === event?.owner;
    const isActive = active && position === event.owner;
    marker.classList.toggle("is-involved", involved);
    marker.classList.toggle("is-active", isActive);
    if (isActive) marker.setAttribute("aria-current", "step");
    else marker.removeAttribute("aria-current");
  });
  if (!active) return;
  const labels = {
    pitch: "投手設定球路",
    "catcher-call": "投捕配合",
    fielding: "守備落點事件",
    runner: "跑者推進判斷",
    batting: "打者攻勢決策",
  };
  const title = event.type === "pitch"
    ? `${state.inning} 局${state.half === "top" ? "上" : "下"} · 投手開局配球`
    : event.type === "catcher-call"
      ? `${state.inning} 局${state.half === "top" ? "上" : "下"} · 捕手接手配球`
      : event.type === "fielding"
        ? `${state.inning} 局${state.half === "top" ? "上" : "下"} · 第 ${state.currentAwayPlay?.number || 1} 個守備球`
        : event.type === "runner"
          ? `${state.inning} 局${state.half === "top" ? "上" : "下"} · 跑者要不要起跑？`
          : `${state.inning} 局${state.half === "top" ? "上" : "下"} · 打者 ${currentBatter().name} 的打席`;
  $("match-event-kicker").textContent = labels[event.type] || "LIVE GAME EVENT";
  $("match-event-title").textContent = title;
  $("match-event-copy").textContent = event.situation || "依照目前球數和壘上狀況選擇行動。";
  const ownerSlot = state.slots[event.owner];
  const ownerLabel = ownerSlot?.controller === "npc"
    ? `${positionName(event.owner)} · NPC 安全接手`
    : ownerSlot?.playerId === network.localPlayerId
      ? `你的責任位置 · ${positionName(event.owner)}`
      : `${positionName(event.owner)} · ${ownerSlot?.name || "等待隊友"} 負責`;
  $("match-event-owner").textContent = ownerLabel;
  const flow = $("match-event-flow");
  if (flow && state.phase === "defense" && state.awaySeries) {
    const series = state.awaySeries;
    const steps = [
      { position: "P", name: "投手", done: Boolean(series.pitchAction), current: event.type === "pitch" },
      { position: "C", name: "捕手", done: Boolean(series.catcherAction), current: event.type === "catcher-call" },
      ...(series.plan?.plays || []).map((play, index) => ({
        position: play.position,
        name: `守備球 ${index + 1}`,
        done: index < Number(series.playIndex || 0),
        current: event.type === "fielding" && index === Number(series.playIndex || 0),
      })),
    ];
    flow.innerHTML = steps.map((step) => `<span class="match-event-step ${step.done ? "is-done" : ""} ${step.current ? "is-current" : ""}"><b>${escapeHtml(step.position)}</b><small>${escapeHtml(step.name)}</small></span>`).join("");
  } else if (flow) {
    const steps = state.phase === "home" && state.homeMode === "runner"
      ? [{ name: "跑者判斷", current: true }, { name: "打者接續", current: false }]
      : [{ name: "打者決策", current: true }, { name: "跑者推進", current: false }];
    flow.innerHTML = steps.map((step) => `<span class="match-event-step ${step.current ? "is-current" : ""}"><b>${step.current ? "NOW" : "NEXT"}</b><small>${step.name}</small></span>`).join("");
  }
}

function renderPlayerMatchResult() {
  const panel = $("player-result-card");
  if (!panel) return;
  panel.hidden = state.phase !== "gameover";
  if (state.phase !== "gameover") return;
  const localSlot = slotForPlayer(network.localPlayerId);
  const position = localSlot?.position || network.assignedPosition || "CF";
  const athleteId = localSlot?.athleteId || state.lineupIds?.[position];
  const player = developedPlayer(athleteId) || matchPlayerForPosition(position, state.teamId) || POSITION_BY_CODE[position];
  const profile = athleteId ? profileFor(athleteId) : null;
  const stats = state.playerStats[position] || {};
  const recent = profile?.recentMatches?.[0];
  const resultLabel = { win: "勝利", walkoff: "再見勝利", loss: "敗戰", tie: "和局" }[state.result] || "完成比賽";
  const defenseValue = `${Number(stats.putouts || 0) + Number(stats.assists || 0)} 處理 · ${Number(stats.errors || 0)} 失誤`;
  const cells = position === "P" ? [
    ["投球局數", window.CareerEngine.innings(stats.pitchingOuts || 0)],
    ["奪三振", stats.pitchingStrikeouts || 0], ["責失分", stats.pitchingER || 0],
    ["無失分半局", stats.earned?.scorelessHalves || 0], ["投球保送", stats.pitchingWalks || 0], ["獎勵 XP", `+${recent?.xp || 0}`],
  ] : [
    ...(position === "C" ? [["成功配球半局", stats.earned?.catcherSuccess || 0]] : []),
    ["安打", stats.hits || 0],
    ["得分", stats.runs || 0],
    ["打點", stats.runsBattedIn || 0],
    ["盜壘", stats.steals || 0],
    ["守備", `${Number(stats.defenseOpportunities || 0)} 事件 · ${defenseValue}`],
    ...(recent?.positionChallenge ? [["位置挑戰", `完成 · ${recent.positionChallenge.title}`]] : []),
    ["獎勵 XP", `+${recent?.xp || 0}`],
  ];
  $("player-result-name").textContent = `${player?.name || "本場球員"} · ${positionName(position)}`;
  $("player-result-grade").textContent = profile?.lastGrade ? `${profile.lastGrade}` : "—";
  $("player-result-grid").innerHTML = cells.map(([label, value]) => `<div class="player-result-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const record = profile?.record || { games: 0, wins: 0, losses: 0, ties: 0 };
  $("player-result-copy").textContent = `${resultLabel} · ${recent?.xp ? `獲得 ${recent.xp} XP` : "本場沒有額外 XP"}${recent?.coins ? `、${recent.coins} 生涯幣` : ""} · 目前 Lv.${profile?.level || 1}、生涯幣 ${profile?.careerCoins || 0}、士氣 ${profile?.morale || 72} · 生涯 ${record.games} 場 ${record.wins} 勝。`;
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
    const contribution = (stats.hits || 0) * 5 + (stats.runs || 0) * 3 + (stats.steals || 0) * 2
      + (stats.putouts || 0) * 2 + (stats.assists || 0) + (stats.defenseOpportunities || 0) * 1.5
      + (stats.runnerOpportunities || 0) + (stats.decisions || 0) * 0.1 - (stats.timeouts || 0);
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
        <span class="result-player-meta">${slot?.controller === "human" ? "真人" : "NPC"} · ${stats.steals || 0} 盜壘 · ${stats.defenseOpportunities || 0} 守備事件 · ${stats.decisions || 0} 決策${stats.timeouts ? ` · ${stats.timeouts} 次逾時` : ""}</span>
      </div>`).join("")}
    </div>`;
}

function renderPregameLineup() {
  const panel = $("pregame-lineup");
  const grid = $("pregame-lineup-grid");
  if (!panel || !grid) return;
  const isPreGame = state.phase === "pre";
  panel.hidden = !isPreGame;
  if (!isPreGame) return;
  const players = activeLineup();
  const humanCount = humanPlayerCount();
  const localSlot = slotForPlayer(network.localPlayerId);
  const status = $("pregame-lineup-status");
  const note = $("pregame-lineup-note");
  if (status) status.textContent = `${humanCount} / ${MAX_PLAYERS} 真人已鎖定 · ${MAX_PLAYERS - humanCount} 個位置由 NPC 補位`;
  if (note) note.textContent = localSlot
    ? `你的角色：${localSlot.name} · ${positionName(localSlot.position)}；其餘位置會使用目前先發球員。`
    : "先到多人頁選擇位置；沒有真人控制的位置會由免費 NPC 補位。";
  grid.innerHTML = players.map((player) => {
    const slot = state.slots[player.position];
    const isHuman = slot?.controller === "human";
    const owner = isHuman ? (slot.playerId === network.localPlayerId ? "你的角色" : `${slot.name} 控制`) : "NPC 補位";
    const overall = player.overall ?? overallForPlayer(player);
    return `<div class="pregame-lineup-player ${isHuman ? "is-human" : ""}"><span class="pregame-lineup-position">${player.position}</span><div><b>${escapeHtml(player.name)}</b><small>OVR ${overall} · ${positionName(player.position)}</small></div><em>${escapeHtml(owner)}</em></div>`;
  }).join("");
}

function render() {
  const batter = currentBatter();
  const batterSlot = state.slots[batter.position];
  const homeTeam = teamFor(state.teamId);
  const awayTeam = teamFor(state.opponentId);
  const scheduleHomeTeam = (state.matchMode === "season" || state.careerPlayerId) && state.scheduleOfficialHomeTeamId ? teamFor(state.scheduleOfficialHomeTeamId) : homeTeam;
  const scheduleAwayTeam = (state.matchMode === "season" || state.careerPlayerId) && state.scheduleOfficialAwayTeamId ? teamFor(state.scheduleOfficialAwayTeamId) : awayTeam;
  const displayHomeScore = (state.matchMode === "season" || state.careerPlayerId) && state.schedulePlayerIsAway ? state.score.away : state.score.home;
  const displayAwayScore = (state.matchMode === "season" || state.careerPlayerId) && state.schedulePlayerIsAway ? state.score.home : state.score.away;
  const postseasonLabel = state.scheduleStage === "challenge" ? "季後挑戰賽" : state.scheduleStage === "taiwan" ? "台灣大賽" : "";
  const modePrefix = state.matchMode === "practice"
    ? "單人練習 · "
    : state.matchMode === "season"
      ? postseasonLabel
        ? `${postseasonLabel}${state.scheduleGameNo ? ` G${state.scheduleGameNo}` : ""} · `
        : `2026 例行賽${state.scheduleGameNo ? `第 ${state.scheduleGameNo} 場` : ""} · `
      : "";
  const phaseText = { pre: `${modePrefix}賽前準備`, defense: `${modePrefix}${homeTeam.shortName}守備 · ${state.defenseOwner || "P"}`, cpu: `${modePrefix}NPC 客隊進攻`, home: state.homeMode === "runner" ? `${modePrefix}${state.runnerDecisionPosition} 跑壘` : `${modePrefix}輪到 ${batter.position}`, gameover: `${modePrefix}比賽結束` }[state.phase];
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
        ? `${state.inning} 局${state.half === "top" ? "上" : "下"}，球往${positionName(state.defenseOwner)}方向飛去；由責任區球員處理來球。`
        : state.defenseMode === "catcher"
          ? `${state.inning} 局${state.half === "top" ? "上" : "下"}，捕手接手投捕配合，決定球種與落點。`
          : `${state.inning} 局${state.half === "top" ? "上" : "下"}，投手先決定球路策略；捕手接著調整配球。`
      : state.phase === "cpu"
      ? `NPC ${awayTeam.name} 正在完成半局進攻，下一個半局由 ${homeTeam.name} 球員接手。`
      : state.phase === "gameover"
        ? "最後一球已經落地。看看團隊與個人留下的數字，再決定要不要再戰。"
        : state.homeMode === "runner"
          ? `${state.inning} 局${state.half === "top" ? "上" : "下"}，${positionName(state.runnerDecisionPosition)} 跑者判斷是否推進；打者 ${batter.name} 留在打擊區。`
          : batterSlot?.controller === "npc"
            ? `${state.inning} 局${state.half === "top" ? "上" : "下"}，${batter.name} 的位置目前由 NPC 補位。真人玩家可以隨時接手空缺位置。`
            : `${state.inning} 局${state.half === "top" ? "上" : "下"}，${batter.name} 站上打擊區。${batterSlot?.name || "隊友"} 正在做決策。`;
  $("momentum-score").textContent = state.momentum;
  $("momentum-bar").style.width = `${state.momentum}%`;
  const activePlan = TEAM_PLAN_META[state.teamPlan];
  $("momentum-copy").textContent = activePlan
    ? `目前戰術：${activePlan.label}。下一個對應決策會獲得團隊加成。`
    : state.teamChemistry >= 75
      ? "團隊默契正在升溫，隊友的配合讓每個決策更清楚。"
      : state.teamChemistry <= 30
        ? "默契偏低，先用穩定選擇找回節奏。"
        : state.phase === "pre"
          ? "比賽還沒開始，先找到你要守護的位置。"
          : "兩隊拉鋸中，每個壘包都值得計算。";
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
  const resultCopy = state.matchMode === "practice" ? "練習賽完成。" : state.matchMode === "career" ? "生涯賽事完成。" : state.matchMode === "season" ? `${postseasonLabel || "2026 例行賽"}${postseasonLabel ? ` G${state.scheduleGameNo}` : `第 ${state.scheduleGameNo} 場`}完成。` : "最終比分：";
  $("gameover-copy").textContent = `${resultCopy} ${scheduleHomeTeam.name} ${displayHomeScore}：${displayAwayScore} ${scheduleAwayTeam.name}。這場比賽留下 ${humanPlayerCount()} 名真人玩家與 NPC 隊友的共同紀錄。`;
  renderResultSummary();
  renderPlayerMatchResult();
  updateBaseView();
  renderLineScore();
  renderLog();
  renderBatter();
  renderActions();
  renderMatchEvent();
  renderPregameLineup();
  renderNetwork();
  renderLobby();
  renderDevelopment();
  renderPlayerHub();
  window.GameUI?.refresh();
  scheduleNpcTurn();
}

function resetMatchState(matchMode = "league", scheduleContext = null) {
  window.clearTimeout(network.actionTimer);
  network.actionTimer = null;
  clearMatchTiming();
  const previousSlots = clone(state.slots);
  const previousLineupIds = clone(state.lineupIds || {});
  const previousRevision = state.revision;
  state = createState(state.teamId, state.opponentId, matchMode, scheduleContext);
  state.revision = previousRevision;
  state.lineupIds = normalizeLineupIds(state.teamId, previousLineupIds);
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
  setActiveView(network.role === "solo" ? "match" : "multiplayer", { scroll: false });
  resetMatchState(matchMode, scheduleContext);
  addLog(`比賽開始！${teamFor(state.teamId).name} 對上 ${teamFor(state.opponentId).name}；${state.careerPlayerId && state.schedulePlayerIsAway ? "你的球隊先攻" : "你的球隊後攻"}。`, "big");
  if (state.careerPlayerId && state.schedulePlayerIsAway) beginHomeHalf();
  else beginDefenseHalf();
  commitState();
}

function beginDefenseHalf() {
  state.phase = "defense";
  state.half = state.careerPlayerId && state.schedulePlayerIsAway ? "bottom" : "top";
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.currentHalfRuns = 0;
  state.defenseMode = "strategy";
  state.defenseAction = "";
  state.pendingAwayRuns = 0;
  state.awaySeries = { pitchAction: "", pitchTimingScore: 65, pitchPlanFactor: 1, catcherAction: "", plan: null, playIndex: 0, runs: 0, outs: 0 };
  state.currentAwayPlay = null;
  state.defenseOwner = "P";
  addLog(`${state.inning} 局${state.half === "top" ? "上" : "下"}，${teamFor(state.teamId).name} 投捕先溝通配球，再由守備陣容處理兩個關鍵球。`, "big");
  armActionDeadline();
}

function simulateAwayHalf(defenseAction = "defense-control", timingScore = 65) {
  if (!state.awaySeries) state.awaySeries = { pitchAction: "", pitchTimingScore: 65, pitchPlanFactor: 1, catcherAction: "", plan: null, playIndex: 0, runs: 0, outs: 0 };
  state.awaySeries.pitchAction = defenseAction;
  state.awaySeries.pitchTimingScore = clamp(Number(timingScore || 65), 0, 100);
  const pitcher = matchPlayerForPosition("P", state.teamId);
  const quality = pitcher?.ratings || {};
  state.awaySeries.pitchPlanFactor = teamPlanMultiplier(defenseAction) * clamp(.8 + (Number(quality.control || 60) + Number(quality.break || 60) + Number(quality.velocity || 60)) / 900, .9, 1.15) * (window.CareerMode?.modifier(pitcher, "pitching") || 1);
  state.awaySeries.pitchManual = state.actionCredit?.manual === true;
  state.defenseAction = defenseAction;
  state.defenseMode = "catcher";
  state.defenseOwner = "C";
  state.currentAwayPlay = null;
  addLog(`${positionName("P")} 完成${DEFENSE_ACTION_META[defenseAction]?.title || "投球策略"}；${positionName("C")} 接手配球，準備誘導客隊打者。`);
}

function startAwayFieldingPlay(index = 0) {
  const series = state.awaySeries;
  const play = series?.plan?.plays?.[index];
  if (!series || !play) return false;
  series.playIndex = index;
  state.currentAwayPlay = play;
  state.defenseMode = "fielding";
  state.defenseOwner = play.position;
  state.pendingAwayRuns = Math.min(6, Number(series.runs || 0) + Number(play.potentialRuns || 0));
  const bases = { first: null, second: null, third: null };
  if (play.leadRunnerOnThird) bases.third = "AWY3";
  if (play.runnerCount >= 2) bases.second = "AWY2";
  else if (play.runnerCount === 1 && !play.leadRunnerOnThird) bases.first = "AWY1";
  state.bases = bases;
  state.outs = Math.min(2, Number(series.outs || 0));
  addLog(`${state.inning} 局${state.half === "top" ? "上" : "下"}第 ${play.number} 個守備球：${positionName(play.position)}責任區，${play.situation}`, play.potentialRuns ? "danger" : "");
  return true;
}

function resolveCatcherAction(action) {
  const series = state.awaySeries;
  if (!series) return;
  series.catcherAction = action;
  series.catcherManual = state.actionCredit?.manual === true;
  const opponentStats = teamFor(state.opponentId).leagueStats || {};
  const offensiveStrength = clamp(
    1 + (Number(opponentStats.sluggingPct || 0.33) - 0.33) * 2 + (Number(opponentStats.onBasePct || 0.32) - 0.32) * 1.2,
    0.9,
    1.13,
  );
  const catcher = matchPlayerForPosition("C", state.teamId);
  const catcherRatings = catcher?.ratings || {};
  const catcherQuality = clamp(.8 + (Number(catcherRatings.blocking || 60) + Number(catcherRatings.fielding || 60) + Number(catcherRatings.armAccuracy || 60)) / 900, .9, 1.15);
  const defensivePlan = Number(series.pitchPlanFactor || 1) * teamPlanMultiplier(action) * catcherQuality * (window.CareerMode?.modifier(catcher, "catcher") || 1);
  series.plan = window.MatchEngine.createAwayHalfPlan({
    inning: state.inning,
    fieldingCursor: state.fieldingCursor,
    pitchAction: series.pitchAction,
    catcherAction: action,
    timingScore: series.pitchTimingScore,
    offensiveStrength: clamp(offensiveStrength / defensivePlan, 0.9, 1.13),
    random: nextRandom,
  });
  series.playIndex = 0;
  series.runs = 0;
  series.outs = 0;
  state.fieldingCursor = series.plan.nextFieldingCursor;
  addLog(`${positionName("C")} 選擇${CATCHER_ACTION_META[action]?.title || "配球"}；投手與捕手完成交接，客隊擊出兩個守備事件。`, "big");
  startAwayFieldingPlay(0);
}

function completeAwayHalf(runs, message, tone = "") {
  state.phase = "cpu";
  state.half = state.careerPlayerId && state.schedulePlayerIsAway ? "bottom" : "top";
  resetBases();
  state.outs = 3;
  state.balls = 0;
  state.strikes = 0;
  const halfRuns = Math.max(0, Math.floor(Number(runs) || 0));
  window.CareerMode?.creditPitchingHalf(halfRuns);
  state.score.away += halfRuns;
  state.pendingAwayRuns = 0;
  state.awaySeries = null;
  state.currentAwayPlay = null;
  ensureInning().away = halfRuns;
  if (message) addLog(message, tone);
  if (state.careerPlayerId && state.schedulePlayerIsAway) {
    if (state.inning >= 9) {
      if (state.score.home > state.score.away) { endGame("win"); return; }
      if (state.score.home < state.score.away) { endGame("loss"); return; }
      if (state.inning >= 12 && !scheduledGameById(state.scheduleGameId)?.isPostseason) { endGame("tie"); return; }
    }
    state.inning++;
    return;
  }
  if (state.inning >= 9 && state.score.home > state.score.away) endGame("win");
}

function resolveFieldingAction(action) {
  const play = state.currentAwayPlay;
  const series = state.awaySeries;
  if (!play || !series) return;
  const definition = POSITION_BY_CODE[state.defenseOwner] || POSITION_BY_CODE.CF;
  const defender = matchPlayerForPosition(state.defenseOwner, state.teamId) || definition;
  const result = window.MatchEngine.resolveFieldingPlay({
    play,
    action,
    ratings: defender.ratings || defender,
    difficultyScale: DIFFICULTY_CONFIG.fieldingSuccessScale,
    planFactor: teamPlanMultiplier(action) * (window.CareerMode?.modifier(defender, "defense") || 1),
    random: nextRandom,
  });
  series.runs = Math.min(6, Number(series.runs || 0) + result.runs);
  series.outs = Math.min(3, Number(series.outs || 0) + result.outs);
  state.outs = Math.min(2, series.outs);
  const fieldStats = state.playerStats[state.defenseOwner];
  if (fieldStats) {
    fieldStats.fieldingChances += 1;
    fieldStats.defenseOpportunities += 1;
    if (["fielding-catch", "fielding-dive", "fielding-first"].includes(action)) fieldStats.putouts += result.outs;
    else if (result.outs > 0) fieldStats.assists += result.outs;
    if (result.error) fieldStats.errors += 1;
    window.CareerMode?.creditFielding(state.defenseOwner, result);
    if (series.catcherManual && series.catcherAction === "catcher-pickoff" && play.runnerCount > 0 && result.savedRun && !series.runnerStopCredited) {
      window.CareerMode?.credit("C", "runnerStops", 1, true);
      series.runnerStopCredited = true;
    }
    if (result.outs === 0 && !result.error) state.playerStats.P.pitchingHits = Number(state.playerStats.P.pitchingHits || 0) + 1;
  }
  if (result.savedRun || result.outs > 0) setMomentum(4 + result.outs * 2);
  else setMomentum(result.error ? -8 : -2);
  const actionMeta = FIELDING_ACTION_META[action] || OUTFIELD_ACTION_META[action];
  const outcome = result.error
    ? `${positionName(state.defenseOwner)}${actionMeta?.title || "守備處理"}出現傳球或接球失誤，客隊多一次推進機會。`
    : result.savedRun
      ? `${positionName(state.defenseOwner)}${actionMeta?.title || "守備處理"}成功，這球阻止了失分。`
      : `${positionName(state.defenseOwner)}${actionMeta?.title || "守備處理"}完成，守備仍在壓力中。`;
  addLog(outcome, result.error ? "danger" : result.savedRun ? "big" : "");
  if (series.playIndex + 1 < series.plan.plays.length) {
    startAwayFieldingPlay(series.playIndex + 1);
    return;
  }
  const finalRuns = Math.min(6, series.runs);
  const halfSummary = finalRuns === 0
    ? `${state.inning} 局${state.half === "top" ? "上" : "下"}守備成功封鎖客隊，沒有失分。`
    : `${state.inning} 局${state.half === "top" ? "上" : "下"}客隊拿下 ${finalRuns} 分，主場守備完成半局。`;
  completeAwayHalf(finalRuns, halfSummary, finalRuns > 0 ? "danger" : "big");
}

function beginHomeHalf() {
  state.phase = "home";
  state.half = state.careerPlayerId && state.schedulePlayerIsAway ? "top" : "bottom";
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.currentHalfRuns = 0;
  state.homeMode = "batter";
  state.runnerDecisionPosition = "";
  state.runnerDecisionUsed = false;
  state.defenseMode = "strategy";
  state.defenseAction = "";
  state.pendingAwayRuns = 0;
  resetBases();
  if (state.teamPlan === "cover") consumeTeamPlan("defense-control");
  addLog(`${state.inning} 局${state.half === "top" ? "上" : "下"}，${teamFor(state.teamId).name} 球員進攻。`, "big");
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
  nextBatter();
  if (state.outs >= 3) {
    finishHomeHalf();
    return;
  }
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

function careerFocusMultiplier() { return 1; }

function careerPrepMultiplier() { return 1; }

function resolveSwing(action, timingScore = 65) {
  const batter = currentBatter();
  const rawRoll = nextRandom();
  const roll = clamp(rawRoll - (Number(timingScore || 65) - 65) / 420, 0, .999);
  const ratings = batter.ratings || batter;
  const countFactor = state.strikes === 2 ? 0.92 : state.balls >= 2 ? 1.04 : 1;
  const swingWindow = DIFFICULTY_CONFIG.swingWindow * opponentPitchingFactor() * countFactor * teamPlanMultiplier(action) * careerFocusMultiplier(batter);
  const contactBoost = (Number(ratings.contact || 60) * 0.72 + Number(ratings.vision || 60) * 0.28) / 1180 * swingWindow * (window.CareerMode?.modifier(batter, "contact") || 1);
  const powerBoost = (Number(ratings.power || 60) * 0.84 + Number(ratings.clutch || 60) * 0.16) / 1450 * swingWindow * (window.CareerMode?.modifier(batter, "power") || 1);
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
  const planBonus = (teamPlanMultiplier("patient") - 1) * 0.75;
  if (nextRandom() < clamp(DIFFICULTY_CONFIG.patientBase + patience * 0.25 + countBonus + planBonus, 0.18, 0.74)) {
    state.balls += 1;
    if (state.balls >= 4) applyWalk();
    else { addLog(`${batter.name} 放掉壞球，${state.balls} 壞球。`); setMomentum(2); }
  } else {
    state.strikes += 1;
    if (state.strikes >= 3) recordOut("看著好球進壘，遭到三振");
    else { addLog(`${batter.name} 沒有出棒，主審判好球。${state.strikes} 好球。`, "danger"); setMomentum(-1); }
  }
}

function resolveBunt(timingScore = 65) {
  const batter = currentBatter();
  const roll = nextRandom();
  const timingFactor = clamp(.55 + Number(timingScore || 65) / 120, .75, 1.35);
  if (roll < DIFFICULTY_CONFIG.buntHitChance * teamPlanMultiplier("bunt") * timingFactor) { applyHit("single"); return; }
  if (roll < clamp(.55 + Number(timingScore || 65) / 400, .6, .8)) {
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

function runnerDecisionBase() {
  if (state.bases.first && !state.bases.second) return "first";
  if (state.bases.second && !state.bases.third) return "second";
  return "";
}

function beginRunnerDecision() {
  if (state.phase !== "home" || state.homeMode !== "batter" || state.runnerDecisionUsed || state.outs >= 2) return false;
  const base = runnerDecisionBase();
  const position = base ? state.bases[base] : "";
  if (!position || !state.slots[position]) return false;
  state.homeMode = "runner";
  state.runnerDecisionPosition = position;
  return true;
}

function resolveSteal() {
  let from = null;
  let to = null;
  if (state.homeMode === "runner" && state.runnerDecisionPosition) {
    if (state.bases.first === state.runnerDecisionPosition && !state.bases.second) { from = "first"; to = "second"; }
    else if (state.bases.second === state.runnerDecisionPosition && !state.bases.third) { from = "second"; to = "third"; }
  } else if (state.bases.first && !state.bases.second) { from = "first"; to = "second"; }
  else if (state.bases.second && !state.bases.third) { from = "second"; to = "third"; }
  if (!from) return;
  const labels = { first: "一壘", second: "二壘", third: "三壘" };
  const runnerPosition = state.bases[from];
  const runner = matchPlayerForPosition(runnerPosition, state.teamId) || {};
  const runnerRatings = runner.ratings || runner;
  const stealChance = (DIFFICULTY_CONFIG.stealBaseChance + Number(runnerRatings.stealing || 50) / 330 + Number(runnerRatings.speed || 50) / 720 + (teamPlanMultiplier("steal") - 1) * 0.35) * (window.CareerMode?.modifier(runner, "speed") || 1);
  if (nextRandom() < stealChance) {
    state.bases[from] = null;
    state.bases[to] = runnerPosition;
    state.steals += 1;
    if (state.playerStats[runnerPosition]) {
      state.playerStats[runnerPosition].steals += 1;
      window.CareerMode?.credit(runnerPosition, "steals", 1);
    }
    setMomentum(8);
    addLog(`盜壘成功！${positionShort(runnerPosition)}號跑者從${labels[from]}滑進${labels[to]}。`, "big");
    flashCard("celebrate");
  } else {
    state.bases[from] = null;
    state.outs += 1;
    if (state.playerStats[runnerPosition]) state.playerStats[runnerPosition].caughtStealing += 1;
    window.CareerMode?.credit(runnerPosition, "caughtStealing", 1);
    setMomentum(-10);
    addLog(`盜壘失敗，${positionShort(runnerPosition)}號跑者在${labels[to]}前被觸殺。`, "danger");
    flashCard("danger");
    if (state.outs >= 3) finishHomeHalf();
  }
}

function chooseNpcAction() {
  const batter = currentBatter();
  if (hasRunners() && state.outs < 2 && nextRandom() < 0.12) return "bunt";
  if (state.strikes === 2) return nextRandom() < 0.68 ? "contact" : "patient";
  if (batter.power >= 82 && nextRandom() < 0.48) return "power";
  if (state.balls >= 2 && nextRandom() < 0.34) return "patient";
  return nextRandom() < 0.62 ? "contact" : "power";
}

function chooseNpcDefenseAction() {
  if (state.defenseMode === "catcher") {
    if (canSteal() && nextRandom() < 0.18) return "catcher-pickoff";
    if (state.awaySeries?.pitchAction === "defense-break") return nextRandom() < 0.62 ? "catcher-low" : "catcher-away";
    return nextRandom() < 0.36 ? "catcher-break" : nextRandom() < 0.7 ? "catcher-low" : "catcher-away";
  }
  if (state.defenseMode === "fielding") {
    const definition = POSITION_BY_CODE[state.defenseOwner] || POSITION_BY_CODE.CF;
    const defender = matchPlayerForPosition(state.defenseOwner, state.teamId) || definition;
    const defenderRatings = defender.ratings || defender;
    const roll = nextRandom();
    if (Number(defenderRatings.fielding || definition.fielding) >= 84 && roll < 0.28) return "fielding-dive";
    if (state.currentAwayPlay?.kind === "groundball") {
      if (state.currentAwayPlay.runnerCount > 0 && roll < 0.35) return "fielding-double";
      if (state.currentAwayPlay.leadRunnerOnThird && roll < 0.58) return "fielding-home";
      return roll < 0.5 ? "fielding-first" : "fielding-force";
    }
    if (Number(defenderRatings.armStrength || definition.arm) >= 82 && roll < 0.56) return "fielding-throw";
    return roll < 0.42 ? "fielding-catch" : roll < 0.72 ? "fielding-relay" : "fielding-cutoff";
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
    else if (state.phase === "home" && activeEventSlot()?.controller === "npc") performActionForPlayer(null, state.homeMode === "runner" ? (nextRandom() < 0.08 ? "steal" : "runner-hold") : chooseNpcAction(), true);
  }, 520);
}

function performActionForPlayer(playerId, action, npc = false, reason = "", timingPosition = null) {
  if (!isAuthority() || (state.phase !== "home" && state.phase !== "defense") || state.actionLock || !canAction(action)) return false;
  const slot = activeEventSlot();
  if (!npc && (slot.controller !== "human" || slot.playerId !== playerId)) return false;
  if (!npc && state.actionDeadline && Date.now() > state.actionDeadline) {
    const fallbackName = state.phase === "defense" ? state.defenseMode === "fielding" ? "守住落點" : "穩定控球" : "安全推打";
    addLog(`${positionName(slot.position)} 玩家逾時，NPC 接手採用${fallbackName}。`, "danger");
    return performActionForPlayer(null, chooseTimeoutAction(), true, "timeout");
  }
  const usesTiming = actionUsesMatchTiming(action);
  if (usesTiming && !npc && (timingPosition == null || !Number.isFinite(Number(timingPosition)))) return false;
  const timingScore = usesTiming
    ? npc ? npcMatchTimingScore(action) : matchTimingScoreFor(action, Number(timingPosition))
    : 65;
  const batterIndexBefore = state.batterIndex;
  const decisionPosition = slot.position;
  state.actionCredit = { position: decisionPosition, manual: !npc && slot.controller === "human", action, timingScore };
  const runnerDecision = state.phase === "home" && state.homeMode === "runner";
  state.actionLock = true;
  state.decisions += 1;
  if (slot.controller === "human" && !npc && state.playerStats[slot.position]) {
    state.playerStats[slot.position].decisions += 1;
    if (state.phase === "defense" && state.defenseMode !== "fielding") state.playerStats[slot.position].defenseOpportunities += 1;
    if (runnerDecision) state.playerStats[slot.position].runnerOpportunities += 1;
  }
  if (npc && reason === "timeout" && slot.controller === "human") {
    state.timeouts += 1;
    if (state.playerStats[slot.position]) state.playerStats[slot.position].timeouts += 1;
  }
  if (usesTiming && !npc) {
    const timingKind = state.phase === "defense" ? "投球放球點" : action === "bunt" ? "短打時機" : "擊球時機";
    addLog(`${slot.name || positionName(slot.position)} ${timingKind} ${timingScore} 分 · ${timingGrade(timingScore)}。`, timingScore >= 82 ? "big" : timingScore < 55 ? "danger" : "");
  }
  if (state.phase === "defense") {
    state.defenseAction = action;
    if (state.defenseMode === "fielding") resolveFieldingAction(action);
    else if (state.defenseMode === "catcher") resolveCatcherAction(action);
    else simulateAwayHalf(action, timingScore);
    if (state.phase === "cpu") beginHomeHalf();
  } else if (runnerDecision) {
    if (action === "steal") resolveSteal();
    else {
      const base = state.bases.first === decisionPosition ? "一壘" : "二壘";
      addLog(`${positionName(decisionPosition)}跑者選擇留在${base}，觀察下一球再推進。`);
    }
    if (state.phase === "home") {
      state.homeMode = "batter";
      state.runnerDecisionPosition = "";
      state.runnerDecisionUsed = true;
    }
  } else if (action === "power" || action === "contact") resolveSwing(action, timingScore);
  else if (action === "patient") resolvePatient();
  else if (action === "bunt") resolveBunt(timingScore);
  else if (action === "steal") resolveSteal();
  if (state.phase === "home" && state.homeMode === "batter") {
    if (state.batterIndex !== batterIndexBefore) state.runnerDecisionUsed = false;
    if (!state.runnerDecisionUsed) beginRunnerDecision();
  }
  consumeTeamPlan(action);
  state.actionLock = false;
  if (isDecisionPhase()) armActionDeadline();
  else clearActionDeadline();
  commitState();
  return true;
}

function handleAction(action) {
  if (!localControlsActiveEvent() || !canAction(action)) return;
  if (actionUsesMatchTiming(action)) {
    beginMatchTiming(action);
    return;
  }
  if (network.role === "guest") {
    network.awaiting = true;
    const sent = sendToHost({ type: "action", protocol: PROTOCOL_VERSION, revision: state.revision, eventId: state.activeEvent?.id || "", action });
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
  state.half = state.careerPlayerId && state.schedulePlayerIsAway ? "top" : "bottom";
  resetBases();
  state.balls = 0;
  state.strikes = 0;
  addLog(`${state.inning} 局${state.half === "top" ? "上" : "下"}結束，${teamFor(state.teamId).shortName} 這半局拿下 ${state.currentHalfRuns} 分。`, state.currentHalfRuns > 0 ? "big" : "");
  if (state.careerPlayerId && state.schedulePlayerIsAway) { beginDefenseHalf(); return; }
  if (state.inning >= 9 && state.score.home > state.score.away) { endGame("win"); return; }
  if (state.inning >= 9 && state.score.home < state.score.away) { endGame("loss"); return; }
  if (state.inning >= 9 && state.score.home === state.score.away) {
    const isPostseason = scheduledGameById(state.scheduleGameId)?.isPostseason;
    if (state.inning >= 12 && !isPostseason) { endGame("tie"); return; }
    state.inning += 1;
    addLog(isPostseason && state.inning > 12 ? "季後賽沒有和局，繼續延長直到分出勝負。" : "九局打完仍是平手，進入延長賽。", "big");
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
    addLog(`比賽結束！${teamFor(state.teamId).name} 以團隊表現贏下比賽。`, "big");
    flashCard("celebrate");
  } else if (result === "tie") {
    addLog("比賽在延長賽後仍然平手。", "danger");
    flashCard("danger");
  } else {
    addLog("比賽結束，對手取得勝利。", "danger");
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
  $("set-match-player")?.addEventListener("click", setSelectedPlayerForMatch);
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
  $("practice-challenge")?.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-practice-choice]");
    if (choice) {
      beginPracticeExecution(Number(choice.dataset.practiceChoice));
      return;
    }
    const direction = event.target.closest("[data-practice-direction]");
    if (direction) {
      handlePracticeExecution(direction.dataset.practiceDirection);
      return;
    }
    const execute = event.target.closest("[data-practice-execute]");
    if (execute && !execute.disabled) handlePracticeExecution();
  });
  $("career-mode-panel")?.addEventListener("click", (event) => {
    const prepButton = event.target.closest("[data-game-prep]");
    if (prepButton) {
      if (!prepButton.disabled) chooseGamePrep(prepButton.dataset.gamePrep);
      return;
    }
    const tabButton = event.target.closest("[data-career-tab]");
    if (!tabButton) return;
    setCareerTab(tabButton.dataset.careerTab);
  });
  $("development-paths")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-development-path]");
    if (!button || button.disabled) return;
    selectDevelopmentPath(button.dataset.developmentPath);
  });
  $("start-career-match")?.addEventListener("click", startPracticeGame);
  $("start-next-scheduled-game")?.addEventListener("click", startScheduledGame);
  $("player-attributes")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-attribute-upgrade]");
    if (!button || button.disabled) return;
    upgradeSelectedAttribute(button.dataset.attributeUpgrade);
  });
  document.querySelectorAll("a[href^='#']").forEach((link) => link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href")?.slice(1);
    const target = targetId ? $(targetId) : null;
    const disclosure = target?.closest("details");
    if (disclosure) disclosure.open = true;
    if (link.dataset.view) {
      event.preventDefault();
      setActiveView(link.dataset.view, { targetId });
    }
  }));
  actionButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  $("match-timing-button")?.addEventListener("click", () => finishMatchTiming(false));
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    if (window.GameUI && document.body.dataset.screen !== "match") return;
    if (matchTimingChallenge && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      finishMatchTiming(false);
      return;
    }
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
  const preferredPlayer = initialCustomPlayer;
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
  setActiveView("match", { scroll: false });
  bindEvents();
  network.countdownTimer = window.setInterval(renderDecisionTimer, 250);
  render();
}

bootstrap();
