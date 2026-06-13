(function () {
  const config = window.DraftConfig;

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomName() {
    const last = ["王", "陳", "林", "張", "黃", "李", "郭", "鄭"];
    const first = ["志豪", "智勝", "國慶", "威倫", "建民", "宗賢", "子豪", "家駒", "耀勳", "宏裕"];

    return last[rand(0, last.length - 1)] + first[rand(0, first.length - 1)];
  }

  function createHitterPositions() {
    return [...new Set(config.multiHitterPositionSets[rand(0, config.multiHitterPositionSets.length - 1)])];
  }

  function slotGroup(slotKey) {
    if (slotKey === "LF" || slotKey === "CF" || slotKey === "RF" || slotKey.startsWith("OF")) {
      return "OF";
    }

    return slotKey;
  }

  function formatHitterPositions(positions) {
    return positions.map(pos => pos === "OF" ? "外野" : pos).join("/");
  }

  function cardTypeClass(cardType) {
    return {
      "藍": "card-blue",
      "黃": "card-yellow",
      "紅": "card-red",
      "紫": "card-purple"
    }[cardType] || "";
  }

  function statItem(label, value) {
    return `<span class="stat-item"><span>${label}</span><strong class="${value > 80 ? "stat-high" : ""}">${value}</strong></span>`;
  }

  function renderPlayerStats(player, statsClass) {
    const stats = player.type === "hitter"
      ? [
          ["力量", player.power],
          ["打擊", player.contact],
          ["速度", player.speed],
          ["傳球", player.arm],
          ["守備", player.fielding]
        ]
      : [
          ["體力", player.stamina],
          ["控球", player.control],
          ["球威", player.velocity],
          ["變化", player.breaking]
        ];

    return `<div class="${statsClass} stats-grid">${stats.map(([label, value]) => statItem(label, value)).join("")}</div>`;
  }

  function normalizeImportedPlayer(raw, index) {
    if (!raw || !raw.type) {
      return null;
    }

    if (raw.type === "hitter") {
      return {
        id: raw.id || `import-h-${index}`,
        type: "hitter",
        name: raw.name || "未命名",
        team: raw.team || "未知球隊",
        year: Number(raw.year) || 0,
        positions: Array.isArray(raw.positions) ? raw.positions.filter(Boolean) : [],
        power: Number(raw.power) || 0,
        contact: Number(raw.contact) || 0,
        speed: Number(raw.speed) || 0,
        fielding: Number(raw.fielding) || 0,
        arm: Number(raw.arm) || 0,
        cardType: raw.cardType || "藍",
        hittingHand: raw.hittingHand || "",
        levelUp: raw.levelUp || "",
        potentials: Array.isArray(raw.potentials) ? raw.potentials : []
      };
    }

    return {
      id: raw.id || `import-p-${index}`,
      type: "pitcher",
      name: raw.name || "未命名",
      team: raw.team || "未知球隊",
      year: Number(raw.year) || 0,
      role: raw.role || (Array.isArray(raw.roles) ? raw.roles[0] : "SP") || "SP",
      roles: Array.isArray(raw.roles) ? raw.roles.filter(Boolean) : (raw.role ? [raw.role] : []),
      stamina: Number(raw.stamina) || 0,
      control: Number(raw.control) || 0,
      velocity: Number(raw.velocity) || 0,
      breaking: Number(raw.breaking) || 0,
      cardType: raw.cardType || "藍",
      throwType: raw.throwType || "",
      levelUp: raw.levelUp || "",
      potentials: Array.isArray(raw.potentials) ? raw.potentials : []
    };
  }

  function buildDraftPoolsFromImported(players) {
    const pools = new Map();

    players.forEach((rawPlayer, index) => {
      const player = normalizeImportedPlayer(rawPlayer, index);

      if (!player) {
        return;
      }

      const poolKey = `${player.team}::${player.year}`;
      if (!pools.has(poolKey)) {
        pools.set(poolKey, {
          team: player.team,
          year: player.year,
          players: []
        });
      }

      pools.get(poolKey).players.push(player);
    });

    return [...pools.values()].sort((left, right) => {
      const yearDiff = left.year - right.year;
      if (yearDiff !== 0) {
        return yearDiff;
      }

      return left.team.localeCompare(right.team, "zh-Hant");
    });
  }

  function generateTeamRoster(team, year) {
    const players = [];

    for (let i = 0; i < 12; i++) {
      players.push({
        id: crypto.randomUUID(),
        type: "hitter",
        name: randomName(),
        team,
        year,
        positions: createHitterPositions(),
        power: rand(60, 100),
        contact: rand(60, 100),
        speed: rand(60, 100),
        fielding: rand(60, 100),
        arm: rand(60, 100)
      });
    }

    const pitcherRolePlan = ["SP", "SP", "SP", "RP", "RP", "CP", "CP"];

    pitcherRolePlan.forEach(role => {
      players.push({
        id: crypto.randomUUID(),
        type: "pitcher",
        name: randomName(),
        team,
        year,
        role,
        velocity: rand(60, 100),
        control: rand(60, 100),
        stamina: rand(60, 100),
        breaking: rand(60, 100)
      });
    });

    return players;
  }

  function buildFallbackPools() {
    const teams = [];

    for (const year of config.years) {
      for (const team of config.teams) {
        teams.push({
          team,
          year,
          players: generateTeamRoster(team, year)
        });
      }
    }

    return teams;
  }

  const importedDraft = Array.isArray(window.BBOImportedDraft) ? window.BBOImportedDraft : [];
  const TEAMS = importedDraft.length ? buildDraftPoolsFromImported(importedDraft) : buildFallbackPools();

  let currentPool = null;
  let selectedPlayerId = null;
  let draftStarted = false;
  let playerPickedThisRound = false;

  const roster = {
    hitters: {},
    pitchers: {
      SP1: null,
      SP2: null,
      SP3: null,
      RP1: null,
      RP2: null,
      CP1: null,
      CP2: null
    }
  };

  function rosterCount() {
    return Object.keys(roster.hitters).length + Object.values(roster.pitchers).filter(Boolean).length;
  }

  function getSelectedPlayer() {
    if (!currentPool || !selectedPlayerId) {
      return null;
    }

    return currentPool.players.find(player => player.id === selectedPlayerId) || null;
  }

  function isPlayerAlreadyOnRoster(playerId) {
    return Object.values(roster.hitters).some(player => player?.id === playerId) ||
      Object.values(roster.pitchers).some(player => player?.id === playerId);
  }

  function clearSelection() {
    selectedPlayerId = null;
  }

  function selectPlayer(playerId) {
    const player = currentPool?.players.find(candidate => candidate.id === playerId);

    if (!player || isPlayerUnavailable(player)) {
      return;
    }

    selectedPlayerId = playerId;
    playerPickedThisRound = true;
    renderRoster();
    renderPlayers();
  }

  function getAvailableRosterSlotsForPlayer(player) {
    if (isPlayerAlreadyOnRoster(player.id)) {
      return [];
    }

    if (player.type === "hitter") {
      return config.hitterSlotConfigs.filter(slot => {
        if (roster.hitters[slot.key]) {
          return false;
        }

        return slot.key === "DH" || player.positions.includes(slotGroup(slot.key));
      }).map(slot => slot.key);
    }

    return config.pitcherSlots.filter(slot => !roster.pitchers[slot] && slot.startsWith(player.role));
  }

  function canPlayerUseSlot(player, slotKey) {
    if (player.type === "hitter") {
      return slotKey === "DH" || player.positions.includes(slotGroup(slotKey));
    }

    return slotKey.startsWith(player.role);
  }

  function isPlayerUnavailable(player) {
    return getAvailableRosterSlotsForPlayer(player).length === 0;
  }

  function renderRoster() {
    const selectedPlayer = getSelectedPlayer();
    const fieldHtml = config.fieldSlots.map(slot => {
      const player = roster.hitters[slot.key];
      const eligible = !player && selectedPlayer && canPlayerUseSlot(selectedPlayer, slot.key);

      return `
<div class="field-slot clickable ${player ? "occupied" : "empty"} ${eligible ? "eligible" : ""}" style="--x:${slot.x};--y:${slot.y};" onclick="addSelectedToSlot('${slot.key}')">
<b>${slot.label}</b><br>
${player?.name || "點選加入"}
</div>
`;
    }).join("");

    const pitcherHtml = config.pitcherSlots.map(slot => {
      const player = roster.pitchers[slot];
      const eligible = !player && selectedPlayer && canPlayerUseSlot(selectedPlayer, slot);

      return `
<div class="pitcher-slot clickable ${player ? "occupied" : "empty"} ${eligible ? "eligible" : ""}" onclick="addSelectedToSlot('${slot}')">
<b>${slot}</b><br>
${player?.name || "點選加入"}
</div>
`;
    }).join("");

    document.getElementById("fieldRoster").innerHTML = fieldHtml;
    document.getElementById("pitcherRoster").innerHTML = pitcherHtml;
    document.getElementById("counter").innerHTML = `${rosterCount()} / ${config.rosterLimits.total}`;
  }

  function renderPlayers() {
    if (!currentPool) {
      document.getElementById("players").innerHTML = "";
      return;
    }

    const selectedPlayer = getSelectedPlayer();

    const html = currentPool.players.map(player => {
      const unavailable = isPlayerUnavailable(player);
      const eligibleSlots = selectedPlayer && selectedPlayer.id === player.id ? getAvailableRosterSlotsForPlayer(player) : [];
      const isSelected = selectedPlayerId === player.id;
      const badgeClass = unavailable ? "unavailable" : eligibleSlots.length ? "eligible" : "";
      const statsClass = unavailable ? "stats unavailable" : "stats";
      const info = renderPlayerStats(player, statsClass);

      return `
<div class="player ${isSelected ? "selected" : ""} ${unavailable ? "unavailable" : ""}" onclick="selectPlayer('${player.id}')">
<b class="player-name ${cardTypeClass(player.cardType)}">${player.name}</b>
<span class="badge ${badgeClass}">${player.type === "hitter" ? formatHitterPositions(player.positions) : player.role}</span>
${info}
</div>
`;
    }).join("");

    document.getElementById("players").innerHTML = html;
  }

  function addSelectedToSlot(slotKey) {
    const player = getSelectedPlayer();

    if (!player) {
      alert("請先選擇一位球員");
      return;
    }

    if (isPlayerAlreadyOnRoster(player.id)) {
      alert("這位球員已經在你的陣容裡了");
      return;
    }

    if (player.type === "hitter") {
      if (slotKey !== "DH" && !player.positions.includes(slotGroup(slotKey))) {
        alert("這位球員不是這個守位");
        return;
      }

      if (roster.hitters[slotKey]) {
        alert("這個守位已經有人了");
        return;
      }

      roster.hitters[slotKey] = player;
    } else {
      if (!slotKey.startsWith(player.role)) {
        alert("這位投手只能放在對應的先發/後援區");
        return;
      }

      if (roster.pitchers[slotKey]) {
        alert("這個守位已經有人了");
        return;
      }

      roster.pitchers[slotKey] = player;
    }

    clearSelection();
    renderRoster();
    renderPlayers();

    if (rosterCount() >= config.rosterLimits.total) {
      alert("選秀完成！");
    }
  }

  function spinTeam() {
    if (draftStarted && !playerPickedThisRound) {
      alert("請先選擇一位球員再 SPIN");
      return;
    }

    if (rosterCount() >= config.rosterLimits.total) {
      alert("陣容已滿");
      return;
    }

    currentPool = TEAMS[rand(0, TEAMS.length - 1)];
    draftStarted = true;
    playerPickedThisRound = false;
    clearSelection();

    document.getElementById("teamInfo").innerHTML = `🎯 ${currentPool.year} ${currentPool.team}`;
    document.getElementById("selectionInfo").innerHTML = "先選球員，再點對應守位加入隊伍";

    renderPlayers();
    renderRoster();
  }

  function remakeDraft() {
    currentPool = null;
    selectedPlayerId = null;
    draftStarted = false;
    playerPickedThisRound = false;

    roster.hitters = {};
    roster.pitchers = {
      SP1: null,
      SP2: null,
      SP3: null,
      RP1: null,
      RP2: null,
      CP1: null,
      CP2: null
    };

    document.getElementById("teamInfo").innerHTML = "按下 SPIN 開始";
    document.getElementById("selectionInfo").innerHTML = "";
    document.getElementById("result").innerHTML = "";

    renderRoster();
    renderPlayers();
  }

  function hitterScore(player) {
    const weights = config.seasonWeights;

    return (
      player.power * weights.hitterPower +
      player.contact * weights.hitterContact +
      player.speed * weights.hitterSpeed +
      player.fielding * weights.hitterFielding +
      player.arm * weights.hitterArm
    );
  }

  function pitcherScore(player) {
    const weights = config.seasonWeights;

    return (
      player.velocity * weights.pitcherVelocity +
      player.control * weights.pitcherControl +
      player.stamina * weights.pitcherStamina +
      player.breaking * weights.pitcherBreaking
    );
  }

  function simulateSeason() {
    const hitters = Object.values(roster.hitters);
    const pitchers = Object.values(roster.pitchers).filter(Boolean);

    if (hitters.length < config.rosterLimits.hitters) {
      alert("野手未滿9位");
      return;
    }

    if (pitchers.length < config.rosterLimits.pitchers) {
      alert("投手未滿7位");
      return;
    }

    const hAvg = hitters.reduce((sum, player) => sum + hitterScore(player), 0) / hitters.length;
    const pAvg = pitchers.reduce((sum, player) => sum + pitcherScore(player), 0) / pitchers.length;
    const score = hAvg * 0.6 + pAvg * 0.4;

    const leagueAverageScore = 74;
    const leagueStrengthPerGame = 0.5;
    const projectedGameStrength = (score - leagueAverageScore) / 20;
    const winRate = Math.max(0, Math.min(1, 0.5 + projectedGameStrength * leagueStrengthPerGame));
    const wins = Math.round(winRate * 120);
    const losses = 120 - wins;
    const scoreDiff = score - leagueAverageScore;

    let grade = "D";
    if (wins === 120) grade = "S";
    else if (wins >= 110) grade = "A+";
    else if (wins >= 100) grade = "A";
    else if (wins >= 90) grade = "B";
    else if (wins >= 80) grade = "C";

    document.getElementById("result").innerHTML = `${wins}-${losses}<br>${grade}`;
    document.getElementById("selectionInfo").innerHTML = `
      <div class="comparison-info">
        比較基準：聯盟平均隊伍<br>
        你的隊伍分數 ${score.toFixed(1)} vs 聯盟平均 ${leagueAverageScore.toFixed(1)}<br>
        差距 ${scoreDiff >= 0 ? "+" : ""}${scoreDiff.toFixed(1)}，換算成 120 場勝場。
      </div>
    `;
  }

  window.selectPlayer = selectPlayer;
  window.addSelectedToSlot = addSelectedToSlot;
  window.spinTeam = spinTeam;
  window.remakeDraft = remakeDraft;
  window.simulateSeason = simulateSeason;

  renderRoster();
  renderPlayers();
})();
