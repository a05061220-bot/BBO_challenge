window.DraftConfig = {
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
    { key: "CF", label: "外野", x: "50%", y: "10%" },
    { key: "LF", label: "外野", x: "16%", y: "28%" },
    { key: "RF", label: "外野", x: "84%", y: "28%" },
    { key: "SS", label: "游擊", x: "38%", y: "42%" },
    { key: "2B", label: "二壘", x: "62%", y: "42%" },
    { key: "3B", label: "三壘", x: "23%", y: "62%" },
    { key: "1B", label: "一壘", x: "77%", y: "62%" },
    { key: "C", label: "捕手", x: "50%", y: "82%" },
    { key: "DH", label: "指打", x: "12%", y: "82%" }
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
  seasonWeights: {
    hitterPower: 0.28,
    hitterContact: 0.28,
    hitterSpeed: 0.12,
    hitterFielding: 0.18,
    hitterArm: 0.14,
    pitcherVelocity: 0.2,
    pitcherControl: 0.3,
    pitcherStamina: 0.25,
    pitcherBreaking: 0.25
  }
};