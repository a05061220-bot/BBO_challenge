window.DraftConfig = {
  musicTracks: [
    "music/BEART_BEATS_320k.mp3",
    "music/FIGHT_FIGHT_FIGHT_128k.mp3",
    "music/FLY_ HIGH_320k.mp3",
    "music/FUN_ FAIR_320k.mp3",
    "music/IRONHORSE_320k.mp3",
    "music/MAGUSEASON1_320k.mp3",
    "music/MAGUSEASON2_320k.mp3",
    "music/MAGUSEASON3_320k.mp3",
    "music/MBCESPN_320k.mp3",
    "music/MY_HERO_320k.mp3",
    "music/NEW_JOURNEY_320k.mp3",
    "music/SHINING_STAR_320k.mp3",
    "music/SUMMER_EXERCISE_320k.mp3",
    "music/THE_CHALLENGERS_320k.mp3"
  ],
  teams: [
    "兄弟象",
    "統一獅",
    "興農牛",
    "LaNew熊",
    "Lamigo",
    "中信兄弟",
    "富邦悍將",
    "味全龍"
  ],
  years: [
    2003, 2006, 2008, 2010,
    2012, 2015, 2018, 2020,
    2022, 2024
  ],
  hitterSlotConfigs: [
    { key: "C", label: "捕手" },
    { key: "1B", label: "一壘" },
    { key: "2B", label: "二壘" },
    { key: "3B", label: "三壘" },
    { key: "SS", label: "游擊" },
    { key: "OF1", label: "外野" },
    { key: "OF2", label: "外野" },
    { key: "OF3", label: "外野" },
    { key: "DH", label: "指定打擊" }
  ],
  fieldSlots: [
    { key: "CF", label: "中外野", x: "50%", y: "27%" },
    { key: "LF", label: "左外野", x: "29%", y: "36%" },
    { key: "RF", label: "右外野", x: "71%", y: "36%" },
    { key: "SS", label: "游擊", x: "40%", y: "50%" },
    { key: "2B", label: "二壘", x: "60%", y: "50%" },
    { key: "3B", label: "三壘", x: "31%", y: "64%" },
    { key: "1B", label: "一壘", x: "69%", y: "64%" },
    { key: "C", label: "捕手", x: "50%", y: "82%" },
    { key: "DH", label: "指打", x: "31%", y: "86%" }
  ],
  pitcherSlots: ["SP1", "SP2", "SP3", "RP1", "RP2", "CP1", "CP2"],
  multiHitterPositionSets: [
    ["C"],
    ["1B"],
    ["2B"],
    ["3B"],
    ["SS"],
    ["OF"],
    ["DH"],
    ["1B", "3B"],
    ["2B", "SS"],
    ["1B", "OF"],
    ["3B", "OF"],
    ["OF", "DH"],
    ["1B", "2B", "SS"],
    ["1B", "3B", "OF"]
  ],
  rosterLimits: {
    hitters: 9,
    pitchers: 7,
    total: 16
  },
  roundLimits: {
    hitters: 2,
    pitchers: 2
  },
  seasonWeights: {
    hitters: {
      C:  { power: 0.25, contact: 0.25, speed: 0.10, fielding: 0.20, arm: 0.20 },
      "1B": { power: 0.25, contact: 0.25, speed: 0.15, fielding: 0.25, arm: 0.10 },
      "2B": { power: 0.25, contact: 0.25, speed: 0.20, fielding: 0.20, arm: 0.10 },
      "3B": { power: 0.25, contact: 0.25, speed: 0.10, fielding: 0.15, arm: 0.25 },
      SS: { power: 0.25, contact: 0.25, speed: 0.20, fielding: 0.20, arm: 0.10 },
      OF: { power: 0.25, contact: 0.25, speed: 0.20, fielding: 0.15, arm: 0.15 },
      DH: { power: 0.34, contact: 0.34, speed: 0.32, fielding: 0, arm: 0 }
    },
    pitchers: {
      SP: { stamina: 0.30, control: 0.23, velocity: 0.25, breaking: 0.22 },
      RP: { stamina: 0.15, control: 0.25, velocity: 0.30, breaking: 0.30 },
      CP: { stamina: 0.10, control: 0.25, velocity: 0.35, breaking: 0.30 }
    }
  },
  simulation: {
    games: 120,
    hitterTeamWeight: 0.6,
    pitcherTeamWeight: 0.4,
    leagueAverageScores: {
      amateur: 55,
      minor: 61,
      free: 67
    },
    scoreScale: 20,
    strengthPerGame: 0.5
  }
};
