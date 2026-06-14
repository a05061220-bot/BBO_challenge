(function () {
  const config = window.DraftConfig;

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const backgroundMusic = new Audio();
  backgroundMusic.volume = 0.35;
  let musicQueue = [];
  let musicStarted = false;

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = rand(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function playNextMusicTrack() {
    if (!config.musicTracks?.length) {
      return;
    }

    if (!musicQueue.length) {
      musicQueue = shuffle(config.musicTracks);
    }

    backgroundMusic.src = musicQueue.shift();
    backgroundMusic.play().catch(() => {
      musicStarted = false;
    });
  }

  function startBackgroundMusic() {
    if (musicStarted) {
      return;
    }

    musicStarted = true;
    playNextMusicTrack();
  }

  function toggleMusicMute() {
    backgroundMusic.muted = !backgroundMusic.muted;
    const button = document.getElementById("muteMusicButton");
    button.textContent = backgroundMusic.muted ? "🔇" : "🔊";
    button.title = backgroundMusic.muted ? "取消靜音" : "靜音";
  }

  function skipMusicTrack() {
    musicStarted = true;
    playNextMusicTrack();
  }

  backgroundMusic.addEventListener("ended", playNextMusicTrack);

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

  function formatShortYear(year) {
    return String(Number(year) % 100).padStart(2, "0");
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
    return `<span class="stat-item"><span>${label}</span><strong class="${value >= 80 ? "stat-high" : ""}">${value}</strong></span>`;
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

  function renderRosterPlayer(player) {
    if (!player) {
      return "點選加入";
    }

    return `
<span class="roster-player-name ${cardTypeClass(player.cardType)}">${formatShortYear(player.year)} ${player.name}</span>
<div class="roster-player-tooltip">${renderPlayerStats(player, "stats roster-tooltip-stats")}</div>
`;
  }

  function cardTypeRank(cardType) {
    return {
      "紫": 4,
      "紅": 3,
      "黃": 2,
      "藍": 1
    }[cardType] || 0;
  }

  function playerOverall(player) {
    if (player.type === "hitter") {
      return (player.power + player.contact + player.speed + player.fielding + player.arm) / 5;
    }

    return (player.stamina + player.control + player.velocity + player.breaking) / 4;
  }

  function compareDraftPlayers(left, right) {
    const cardDiff = cardTypeRank(right.cardType) - cardTypeRank(left.cardType);
    if (cardDiff !== 0) {
      return cardDiff;
    }

    const overallDiff = playerOverall(right) - playerOverall(left);
    if (overallDiff !== 0) {
      return overallDiff;
    }

    return left.name.localeCompare(right.name, "zh-Hant");
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

    const sortedPools = [...pools.values()].sort((left, right) => {
      const yearDiff = left.year - right.year;
      if (yearDiff !== 0) {
        return yearDiff;
      }

      return left.team.localeCompare(right.team, "zh-Hant");
    });

    sortedPools.forEach(pool => pool.players.sort(compareDraftPlayers));
    return sortedPools;
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
  let rerollUsed = false;
  let playerFilter = "all";
  let roundPicks = {
    hitters: 0,
    pitchers: 0
  };

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

  function eliteRosterCount() {
    const players = [
      ...Object.values(roster.hitters),
      ...Object.values(roster.pitchers)
    ].filter(Boolean);

    return players.filter(player => player.cardType === "紅" || player.cardType === "紫").length;
  }

  function purpleRosterCount() {
    const players = [
      ...Object.values(roster.hitters),
      ...Object.values(roster.pitchers)
    ].filter(Boolean);

    return players.filter(player => player.cardType === "紫").length;
  }

  function rosterCardTypeCounts() {
    const counts = { "紫": 0, "紅": 0, "黃": 0, "藍": 0 };
    const players = [
      ...Object.values(roster.hitters),
      ...Object.values(roster.pitchers)
    ].filter(Boolean);

    players.forEach(player => {
      if (Object.hasOwn(counts, player.cardType)) {
        counts[player.cardType]++;
      }
    });

    return counts;
  }

  function clearSelection() {
    selectedPlayerId = null;
  }

  function randomPool(pools) {
    return pools[rand(0, pools.length - 1)];
  }

  function updateRerollButtons() {
    const canReroll = draftStarted && rosterCount() < config.rosterLimits.total;
    document.getElementById("rerollYearButton").disabled = !canReroll || rerollUsed;
    document.getElementById("rerollTeamButton").disabled = !canReroll || rerollUsed;
  }

  function showCurrentPool() {
    clearSelection();
    document.getElementById("teamInfo").innerHTML = `🎯 ${currentPool.year} ${currentPool.team}`;
    updateRoundInfo();
    renderPlayers();
    renderRoster();
    updateRerollButtons();
  }

  function updateRoundInfo() {
    const counts = rosterCardTypeCounts();
    document.getElementById("selectionInfo").innerHTML = `
      <span>本輪已選：打者 ${roundPicks.hitters} / ${config.roundLimits.hitters}，投手 ${roundPicks.pitchers} / ${config.roundLimits.pitchers}</span>
      <span class="card-counts" title="紫卡最多2位；紅卡與紫卡合計最多10位">
        <span class="card-count card-purple">紫 ${counts["紫"]}</span>
        <span class="card-count card-red">紅 ${counts["紅"]}</span>
        <span class="card-count card-yellow">黃 ${counts["黃"]}</span>
        <span class="card-count card-blue">藍 ${counts["藍"]}</span>
        <span class="elite-count">紅紫 ${counts["紫"] + counts["紅"]}/10</span>
      </span>
    `;
  }

  function selectPlayer(playerId) {
    const player = currentPool?.players.find(candidate => candidate.id === playerId);

    if (!player || isPlayerUnavailable(player)) {
      return;
    }

    selectedPlayerId = playerId;
    renderRoster();
    renderPlayers();
    updateRerollButtons();
    updateRoundInfo();
  }

  function isRoundLimitReached(player) {
    return player.type === "hitter"
      ? roundPicks.hitters >= config.roundLimits.hitters
      : roundPicks.pitchers >= config.roundLimits.pitchers;
  }

  function getAvailableRosterSlotsForPlayer(player) {
    const eliteLimitReached =
      (player.cardType === "紅" || player.cardType === "紫") &&
      eliteRosterCount() >= 10;
    const purpleLimitReached = player.cardType === "紫" && purpleRosterCount() >= 2;

    if (isPlayerAlreadyOnRoster(player.id) || isRoundLimitReached(player) || eliteLimitReached || purpleLimitReached) {
      return [];
    }

    if (player.type === "hitter") {
      return config.fieldSlots.filter(slot => {
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
${renderRosterPlayer(player)}
</div>
`;
    }).join("");

    const pitcherHtml = config.pitcherSlots.map(slot => {
      const player = roster.pitchers[slot];
      const eligible = !player && selectedPlayer && canPlayerUseSlot(selectedPlayer, slot);

      return `
<div class="pitcher-slot clickable ${player ? "occupied" : "empty"} ${eligible ? "eligible" : ""}" onclick="addSelectedToSlot('${slot}')">
<b>${slot}</b><br>
${renderRosterPlayer(player)}
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

    const visiblePlayers = currentPool.players.filter(player => {
      if (playerFilter === "hitter") {
        return player.type === "hitter";
      }
      if (playerFilter === "pitcher") {
        return player.type === "pitcher";
      }
      return true;
    });

    const html = visiblePlayers.map(player => {
      const unavailable = isPlayerUnavailable(player);
      const eligibleSlots = selectedPlayer && selectedPlayer.id === player.id ? getAvailableRosterSlotsForPlayer(player) : [];
      const isSelected = selectedPlayerId === player.id;
      const badgeClass = unavailable ? "unavailable" : eligibleSlots.length ? "eligible" : "";
      const statsClass = unavailable ? "stats unavailable" : "stats";
      const info = renderPlayerStats(player, statsClass);

      return `
<div class="player ${isSelected ? "selected" : ""} ${unavailable ? "unavailable" : ""}" onclick="selectPlayer('${player.id}')">
<b class="player-name ${cardTypeClass(player.cardType)}">${formatShortYear(player.year)} ${player.name}</b>
<span class="badge position-badge ${badgeClass}">${player.type === "hitter" ? formatHitterPositions(player.positions) : player.role}</span>
${info}
</div>
`;
    }).join("");

    document.getElementById("players").innerHTML = html;
  }

  function setPlayerFilter(filter) {
    playerFilter = filter;
    document.querySelectorAll("[data-player-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.playerFilter === filter);
    });
    renderPlayers();
  }

  function showDraftPanel() {
    document.getElementById("draftPanel").hidden = false;
    document.getElementById("simulationPanel").hidden = true;
  }

  function renderSimulationPlayer(slotKey, player, score) {
    return `
<div class="simulation-player">
  <div class="simulation-player-head">
    <span class="roster-player-name ${cardTypeClass(player.cardType)}">${formatShortYear(player.year)} ${player.name}</span>
    <span class="simulation-slot">${slotKey}</span>
    <strong>${score.toFixed(1)}</strong>
  </div>
  ${renderPlayerStats(player, "stats stats-grid simulation-stats")}
</div>
`;
  }

  function showSimulationPanel({ wins, losses, grade, score, leagueAverageScore, scoreDiff, hitterEntries, pitcherEntries }) {
    const hitterOrder = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
    const pitcherOrder = ["SP1", "SP2", "SP3", "RP1", "RP2", "CP1", "CP2"];
    const sortedHitters = [...hitterEntries].sort(
      ([leftSlot], [rightSlot]) => hitterOrder.indexOf(leftSlot) - hitterOrder.indexOf(rightSlot)
    );
    const sortedPitchers = [...pitcherEntries].sort(
      ([leftSlot], [rightSlot]) => pitcherOrder.indexOf(leftSlot) - pitcherOrder.indexOf(rightSlot)
    );
    const hitterHtml = sortedHitters
      .map(([slotKey, player]) => renderSimulationPlayer(slotKey, player, hitterScore(player, slotKey)))
      .join("");
    const pitcherHtml = sortedPitchers
      .map(([slotKey, player]) => renderSimulationPlayer(slotKey, player, pitcherScore(player)))
      .join("");

    document.getElementById("draftPanel").hidden = true;
    document.getElementById("simulationPanel").hidden = false;
    document.getElementById("simulationPanel").innerHTML = `
      <div class="simulation-summary">
        <div><span>模擬戰績</span><strong>${wins}-${losses}</strong></div>
        <div><span>評級</span><strong>${grade}</strong></div>
        <div><span>隊伍分數</span><strong>${score.toFixed(1)}</strong></div>
        <div><span>聯盟差距</span><strong>${scoreDiff >= 0 ? "+" : ""}${scoreDiff.toFixed(1)}</strong></div>
      </div>
      <div class="simulation-section">
        <h3>打者陣容</h3>
        <div class="simulation-roster">${hitterHtml}</div>
      </div>
      <div class="simulation-section">
        <h3>投手陣容</h3>
        <div class="simulation-roster">${pitcherHtml}</div>
      </div>
      <div class="simulation-note">聯盟平均分數：${leagueAverageScore.toFixed(1)}</div>
    `;
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

    if ((player.cardType === "紅" || player.cardType === "紫") && eliteRosterCount() >= 10) {
      alert("選秀陣容中的紅卡與紫卡合計最多10位");
      return;
    }

    if (player.cardType === "紫" && purpleRosterCount() >= 2) {
      alert("選秀陣容中的紫卡最多2位");
      return;
    }

    if (isRoundLimitReached(player)) {
      alert(player.type === "hitter" ? "本輪最多選擇兩位打者" : "本輪最多選擇兩位投手");
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

    if (player.type === "hitter") {
      roundPicks.hitters++;
    } else {
      roundPicks.pitchers++;
    }
    playerPickedThisRound = true;
    clearSelection();
    renderRoster();
    renderPlayers();
    updateRerollButtons();
    updateRoundInfo();

    if (rosterCount() >= config.rosterLimits.total) {
      alert("選秀完成！");
    }
  }

  function spinTeam() {
    startBackgroundMusic();

    if (draftStarted && !playerPickedThisRound) {
      alert("請先選擇一位球員再 SPIN");
      return;
    }

    if (rosterCount() >= config.rosterLimits.total) {
      alert("陣容已滿");
      return;
    }

    showDraftPanel();
    currentPool = randomPool(TEAMS);
    draftStarted = true;
    playerPickedThisRound = false;
    roundPicks = {
      hitters: 0,
      pitchers: 0
    };
    showCurrentPool();
  }

  function rerollYear() {
    if (!draftStarted || rerollUsed) {
      return;
    }

    const alternatives = TEAMS.filter(pool => pool.team === currentPool.team && pool.year !== currentPool.year);
    if (!alternatives.length) {
      alert("這支球隊沒有其他可抽選年份");
      return;
    }

    currentPool = randomPool(alternatives);
    rerollUsed = true;
    showCurrentPool();
  }

  function rerollTeam() {
    if (!draftStarted || rerollUsed) {
      return;
    }

    const alternatives = TEAMS.filter(pool => pool.year === currentPool.year && pool.team !== currentPool.team);
    if (!alternatives.length) {
      alert("這個年份沒有其他可抽選球隊");
      return;
    }

    currentPool = randomPool(alternatives);
    rerollUsed = true;
    showCurrentPool();
  }

  function remakeDraft() {
    currentPool = null;
    selectedPlayerId = null;
    draftStarted = false;
    playerPickedThisRound = false;
    rerollUsed = false;
    roundPicks = {
      hitters: 0,
      pitchers: 0
    };

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
    showDraftPanel();

    renderRoster();
    renderPlayers();
    updateRerollButtons();
  }

  function hitterScore(player, slotKey) {
    const weights = config.seasonWeights;

    if (slotKey === "DH") {
      return (
        player.power * weights.dhPower +
        player.contact * weights.dhContact +
        player.speed * weights.dhSpeed
      );
    }

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
    const hitterEntries = Object.entries(roster.hitters);
    const hitters = hitterEntries.map(([, player]) => player);
    const pitcherEntries = Object.entries(roster.pitchers).filter(([, player]) => Boolean(player));
    const pitchers = pitcherEntries.map(([, player]) => player);

    if (hitters.length < config.rosterLimits.hitters) {
      alert("野手未滿9位");
      return;
    }

    if (pitchers.length < config.rosterLimits.pitchers) {
      alert("投手未滿7位");
      return;
    }

    const hAvg = hitterEntries.reduce((sum, [slotKey, player]) => sum + hitterScore(player, slotKey), 0) / hitterEntries.length;
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
    showSimulationPanel({
      wins,
      losses,
      grade,
      score,
      leagueAverageScore,
      scoreDiff,
      hitterEntries,
      pitcherEntries
    });
  }

  window.selectPlayer = selectPlayer;
  window.addSelectedToSlot = addSelectedToSlot;
  window.spinTeam = spinTeam;
  window.rerollYear = rerollYear;
  window.rerollTeam = rerollTeam;
  window.toggleMusicMute = toggleMusicMute;
  window.skipMusicTrack = skipMusicTrack;
  window.setPlayerFilter = setPlayerFilter;
  window.remakeDraft = remakeDraft;
  window.simulateSeason = simulateSeason;

  renderRoster();
  renderPlayers();
  updateRerollButtons();
})();
