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
    document.querySelectorAll("#muteMusicButton, [data-music-mute]").forEach(button => {
      button.textContent = backgroundMusic.muted ? "🔇" : "🔊";
      button.title = backgroundMusic.muted ? "取消靜音" : "靜音";
    });
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

  function queryTeamLabel(pool) {
    return pool.league === "Team Taiwan" ? "WBC Team Taiwan" : pool.team;
  }

  function positionMatchesFilter(player, filter) {
    if (filter === "ALL") {
      return true;
    }

    if (player.type === "hitter") {
      return player.positions.includes(filter);
    }

    return player.role === filter;
  }

  function getQueryPools() {
    return TEAMS.filter(pool => Array.isArray(pool.players) && pool.players.length > 0);
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

  function scoreBarStyle(score) {
    const width = Math.max(0, Math.min(100, score / 95 * 100));
    return `--ability-width:${width.toFixed(1)}%`;
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

  function normalizeAbility(value) {
    return Math.max(60, Number(value) || 0);
  }

  function normalizeImportedPlayer(raw, index) {
    if (!raw || !raw.type) {
      return null;
    }

    if (raw.type === "hitter") {
      return {
        id: raw.id || `import-h-${index}`,
        league: raw.league || "CPBL",
        type: "hitter",
        name: raw.name || "未命名",
        team: raw.team || (raw.league === "Team Taiwan" ? "WBC" : "未知球隊"),
        year: Number(raw.year) || 0,
        positions: Array.isArray(raw.positions) ? raw.positions.filter(Boolean) : [],
        power: normalizeAbility(raw.power),
        contact: normalizeAbility(raw.contact),
        speed: normalizeAbility((Number(raw.speed) || 0) - (raw.cardType === "紫" ? 5 : 0)),
        fielding: normalizeAbility(raw.fielding),
        arm: normalizeAbility(raw.arm),
        cardType: raw.cardType || "藍",
        hittingHand: raw.hittingHand || "",
        levelUp: raw.levelUp || "",
        potentials: Array.isArray(raw.potentials) ? raw.potentials : []
      };
    }

    return {
      id: raw.id || `import-p-${index}`,
      league: raw.league || "CPBL",
      type: "pitcher",
      name: raw.name || "未命名",
      team: raw.team || (raw.league === "Team Taiwan" ? "WBC" : "未知球隊"),
      year: Number(raw.year) || 0,
      role: raw.role || (Array.isArray(raw.roles) ? raw.roles[0] : "SP") || "SP",
      roles: Array.isArray(raw.roles) ? raw.roles.filter(Boolean) : (raw.role ? [raw.role] : []),
      stamina: Number(raw.stamina) || 0,
      control: normalizeAbility(raw.control),
      velocity: normalizeAbility(raw.velocity),
      breaking: normalizeAbility(raw.breaking),
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

      const poolKey = `${player.league}::${player.team}::${player.year}`;
      if (!pools.has(poolKey)) {
        pools.set(poolKey, {
          league: player.league,
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
          league: "CPBL",
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

  let gameMode = "minor";
  let onlineDraftMode = false;
  let queryPlayerFilter = "all";
  let queryPositionFilter = "ALL";
  let queryPage = 1;
  const queryPageSize = 60;
  let currentPool = null;
  let selectedPlayerId = null;
  let draftStarted = false;
  let playerPickedThisRound = false;
  let yearRerollUsed = false;
  let teamRerollUsed = false;
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

  const versusHitterSlots = ["C", "1B", "2B", "3B", "SS", "OF1", "OF2", "OF3", "DH"];
  const versusPitcherSlots = ["SP1", "SP2", "SP3", "RP1", "RP2", "CP1", "CP2"];
  const lineupWeights = [1.08, 1.06, 1.05, 1.04, 1, 0.98, 0.96, 0.94, 0.89];
  let versusState = createVersusState();
  let onlineVersusMode = false;
  let onlineAutoOverride = false;
  let versusAdjustmentTimer;
  let versusAdjustmentNoticeDeadline = 0;

  function createVersusTeam() {
    return {
      hitters: Object.fromEntries(versusHitterSlots.map(slot => [slot, null])),
      pitchers: Object.fromEntries(versusPitcherSlots.map(slot => [slot, null])),
      lineup: [...versusHitterSlots]
    };
  }

  function createVersusState() {
    return {
      teams: [createVersusTeam(), createVersusTeam()],
      mode: "free",
      currentPool: null,
      pendingPlayerId: null,
      draggedLineup: null,
      spinner: 0,
      picker: 0,
      picksInPool: 0,
      finished: false,
      lineupDeadline: null,
      lineupReady: [false, false]
    };
  }

  function rosterCount() {
    return Object.keys(roster.hitters).length + Object.values(roster.pitchers).filter(Boolean).length;
  }

  function rosterPlayers() {
    return [
      ...Object.values(roster.hitters),
      ...Object.values(roster.pitchers)
    ].filter(Boolean);
  }

  function normalizePlayerName(name) {
    return String(name || "").trim().toLocaleLowerCase("zh-Hant");
  }

  function getSelectedPlayer() {
    if (!currentPool || !selectedPlayerId) {
      return null;
    }

    return currentPool.players.find(player => player.id === selectedPlayerId) || null;
  }

  function isPlayerAlreadyOnRoster(player) {
    const normalizedName = normalizePlayerName(player.name);
    return rosterPlayers().some(rosterPlayer =>
      rosterPlayer.id === player.id ||
      normalizePlayerName(rosterPlayer.name) === normalizedName
    );
  }

  function eliteRosterCount() {
    return rosterPlayers().filter(player => player.cardType === "紅" || player.cardType === "紫").length;
  }

  function purpleRosterCount() {
    return rosterPlayers().filter(player => player.cardType === "紫").length;
  }

  function rosterCardTypeCounts() {
    const counts = { "紫": 0, "紅": 0, "黃": 0, "藍": 0 };
    rosterPlayers().forEach(player => {
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
    const canReroll = draftStarted && Boolean(currentPool) && rosterCount() < config.rosterLimits.total;
    document.getElementById("rerollYearButton").disabled = !canReroll || yearRerollUsed;
    document.getElementById("rerollTeamButton").disabled = !canReroll || teamRerollUsed;
  }

  function showCurrentPool() {
    clearSelection();
    document.getElementById("teamInfo").innerHTML = `🎯 ${currentPool.year} ${currentPool.team}`;
    updateRoundInfo();
    renderPlayers();
    renderRoster();
    updateRerollButtons();
    grantFreeSpinIfPoolBlocked();
  }

  function grantFreeSpinIfPoolBlocked() {
    if (!currentPool || currentPool.players.some(player => !isPlayerUnavailable(player))) {
      return false;
    }

    currentPool = null;
    playerPickedThisRound = true;
    clearSelection();
    document.getElementById("teamInfo").innerHTML = "目前名單無可加入球員，獲得一次免費 SPIN";
    document.getElementById("players").innerHTML = "";
    updateRerollButtons();
    alert("因限制或可用球員不足，目前名單沒有任何球員可以加入。已免費贈送一次 SPIN 機會！");
    return true;
  }

  function updateRoundInfo() {
    const counts = rosterCardTypeCounts();
    const limits = getModeCardLimits();
    const limitInfo = limits
      ? `<span class="elite-count">紅紫 ${counts["紫"] + counts["紅"]}/${limits.elite}</span>`
      : `<span class="elite-count">自由頻道：卡色不限</span>`;
    document.getElementById("selectionInfo").innerHTML = `
      <span>本輪已選：打者 ${roundPicks.hitters} / ${config.roundLimits.hitters}，投手 ${roundPicks.pitchers} / ${config.roundLimits.pitchers}</span>
      <span class="card-counts" title="${limits ? `紫卡最多${limits.purple}位；紅卡與紫卡合計最多${limits.elite}位` : "自由頻道卡色數量不限"}">
        <span class="card-count card-purple">紫 ${counts["紫"]}</span>
        <span class="card-count card-red">紅 ${counts["紅"]}</span>
        <span class="card-count card-yellow">黃 ${counts["黃"]}</span>
        <span class="card-count card-blue">藍 ${counts["藍"]}</span>
        ${limitInfo}
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
    updateOnlineDraftUi();
    scrollMobileDraftTarget(player.type === "pitcher" ? "pitcherRoster" : "fieldRoster");
  }

  function isMobileDraftLayout() {
    return window.matchMedia("(max-width: 700px)").matches && !document.getElementById("gameView").hidden;
  }

  function scrollMobileDraftTarget(elementId) {
    if (!isMobileDraftLayout()) return;
    const target = document.getElementById(elementId);
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function scrollMobileDraftPlayers() {
    if (!isMobileDraftLayout()) return;
    const target = document.getElementById("players");
    if (!target || !currentPool) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function isRoundLimitReached(player) {
    return player.type === "hitter"
      ? roundPicks.hitters >= config.roundLimits.hitters
      : roundPicks.pitchers >= config.roundLimits.pitchers;
  }

  function getAvailableRosterSlotsForPlayer(player) {
    const limits = getModeCardLimits();
    const eliteLimitReached = limits &&
      (player.cardType === "紅" || player.cardType === "紫") &&
      eliteRosterCount() >= limits.elite;
    const purpleLimitReached = limits && player.cardType === "紫" && purpleRosterCount() >= limits.purple;

    if (isPlayerAlreadyOnRoster(player) || isRoundLimitReached(player) || eliteLimitReached || purpleLimitReached) {
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

  function showView(viewId) {
    ["homeView", "gameView", "queryView", "statisticsView", "onlineDraftMatchView", "versusView"].forEach(id => {
      document.getElementById(id).hidden = id !== viewId;
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showStatisticsView() {
    showView("statisticsView");
  }

  function showOnlineDraftMatchView() {
    showView("onlineDraftMatchView");
  }

  function enterGame(mode) {
    onlineDraftMode = false;
    gameMode = mode;
    document.getElementById("gameModeTitle").textContent = {
      minor: "職業二軍頻道",
      amateur: "業餘頻道",
      free: "自由頻道"
    }[mode];
    remakeDraft();
    updateOnlineDraftUi();
    showView("gameView");
  }

  function showHome() {
    window.BBOOnlineMatch?.leave();
    window.BBOOnlineDraft?.leave();
    showView("homeView");
  }

  function updateOnlineDraftUi() {
    const panel = document.getElementById("onlineMatchPanel");
    const seasonButton = document.getElementById("seasonSimulationButton");
    if (!panel || !seasonButton) return;
    panel.hidden = !onlineDraftMode;
    seasonButton.hidden = onlineDraftMode;
    document.getElementById("simulationCardTitle").textContent = onlineDraftMode ? "連線配對" : "模擬球季";
    if (onlineDraftMode && rosterCount() < config.rosterLimits.total) {
      document.getElementById("onlineMatchButton").disabled = true;
      document.getElementById("onlineMatchStatus").textContent =
        `請先完成選秀（${rosterCount()} / ${config.rosterLimits.total}）`;
    }
  }

  function startOnlineDraft(mode = "free") {
    onlineDraftMode = true;
    gameMode = mode;
    document.getElementById("gameModeTitle").textContent = `連線對戰｜${{
      minor: "職業二軍頻道",
      amateur: "業餘頻道",
      free: "自由頻道"
    }[mode]}`;
    remakeDraft();
    updateOnlineDraftUi();
    showView("gameView");
  }

  function getModeCardLimits() {
    return {
      minor: { purple: 2, elite: 10 },
      amateur: { purple: 1, elite: 6 },
      free: null
    }[gameMode];
  }

  function populateQueryYears() {
    queryPage = 1;
    const yearSelect = document.getElementById("queryYear");
    const years = [...new Set(getQueryPools()
      .filter(pool =>
        Number.isInteger(pool.year) &&
        pool.year > 0
      )
      .map(pool => pool.year))]
      .sort((left, right) => right - left);

    yearSelect.innerHTML = years.length
      ? `<option value="ALL">ALL 年度</option>${years.map(year => `<option value="${year}">${year}</option>`).join("")}`
      : '<option value="">無可選年份</option>';
    yearSelect.disabled = years.length === 0;
    populateQueryTeams();
  }

  function populateQueryTeams() {
    queryPage = 1;
    const yearValue = document.getElementById("queryYear").value;
    const year = Number(yearValue);
    const teamSelect = document.getElementById("queryTeam");
    const teams = getQueryPools()
      .filter(pool =>
        yearValue === "ALL" || pool.year === year
      )
      .map(pool => queryTeamLabel(pool))
      .filter((team, index, items) => items.indexOf(team) === index)
      .sort((left, right) => left.localeCompare(right, "zh-Hant"));
    teamSelect.innerHTML = teams.length
      ? `<option value="ALL">ALL 球隊</option>${teams.map(team => `<option value="${team}">${team}</option>`).join("")}`
      : '<option value="">無可選球隊</option>';
    teamSelect.disabled = teams.length === 0;
    populateQueryPositions();
  }

  function populateQueryPositions() {
    const positionSelect = document.getElementById("queryPosition");
    const hitterOptions = [
      ["ALL", "ALL 守位"],
      ["C", "捕手 C"],
      ["1B", "一壘 1B"],
      ["2B", "二壘 2B"],
      ["3B", "三壘 3B"],
      ["SS", "游擊 SS"],
      ["OF", "外野 OF"]
    ];
    const pitcherOptions = [
      ["ALL", "ALL 守位"],
      ["SP", "先發 SP"],
      ["RP", "中繼 RP"],
      ["CP", "終結 CP"]
    ];
    const options = queryPlayerFilter === "hitter"
      ? hitterOptions
      : queryPlayerFilter === "pitcher"
        ? pitcherOptions
        : [...hitterOptions, ...pitcherOptions.slice(1)];
    positionSelect.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    queryPositionFilter = options.some(([value]) => value === queryPositionFilter) ? queryPositionFilter : "ALL";
    positionSelect.value = queryPositionFilter;
    renderPlayerQuery();
  }

  function renderPlayerQuery() {
    const yearValue = document.getElementById("queryYear").value;
    const year = Number(yearValue);
    const team = document.getElementById("queryTeam").value;
    const position = document.getElementById("queryPosition").value;
    const pools = getQueryPools().filter(candidate =>
      (yearValue === "ALL" || candidate.year === year) &&
      (team === "ALL" || queryTeamLabel(candidate) === team)
    );
    const players = pools.flatMap(pool => pool.players).filter(player => {
      if (queryPlayerFilter === "hitter") return player.type === "hitter";
      if (queryPlayerFilter === "pitcher") return player.type === "pitcher";
      return true;
    }).filter(player => positionMatchesFilter(player, position))
      .sort(compareDraftPlayers);
    if (!pools.length) {
      document.getElementById("querySummary").textContent = "目前沒有符合條件的球隊資料";
      document.getElementById("queryResults").innerHTML = "";
      document.getElementById("queryPagination").innerHTML = "";
      return;
    }

    const totalPages = Math.max(1, Math.ceil(players.length / queryPageSize));
    queryPage = Math.max(1, Math.min(queryPage, totalPages));
    const pagePlayers = players.slice((queryPage - 1) * queryPageSize, queryPage * queryPageSize);
    const yearLabel = yearValue === "ALL" ? "ALL 年度" : year;
    const teamLabel = team === "ALL" ? "ALL 球隊" : team;
    const positionLabel = position === "ALL" ? "ALL 守位" : position;
    document.getElementById("querySummary").textContent =
      `${yearLabel} ${teamLabel} ${positionLabel}，共 ${players.length} 位球員，顯示第 ${queryPage}/${totalPages} 頁`;
    document.getElementById("queryResults").innerHTML = pagePlayers.map(player => `
      <div class="player query-player">
        <b class="player-name ${cardTypeClass(player.cardType)}">${formatShortYear(player.year)} ${player.name}</b>
        <span class="badge position-badge">${player.type === "hitter" ? formatHitterPositions(player.positions) : player.role}</span>
        ${renderPlayerStats(player, "stats stats-grid")}
      </div>
    `).join("");
    document.getElementById("queryPagination").innerHTML = totalPages > 1 ? `
      <button ${queryPage <= 1 ? "disabled" : ""} onclick="setQueryPage(${queryPage - 1})">上一頁</button>
      <span>第 ${queryPage} / ${totalPages} 頁</span>
      <button ${queryPage >= totalPages ? "disabled" : ""} onclick="setQueryPage(${queryPage + 1})">下一頁</button>
    ` : "";
  }

  function setQueryPlayerFilter(filter) {
    queryPlayerFilter = filter;
    queryPage = 1;
    document.querySelectorAll("[data-query-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.queryFilter === filter);
    });
    populateQueryPositions();
  }

  function setQueryPositionFilter(filter) {
    queryPositionFilter = filter;
    queryPage = 1;
    renderPlayerQuery();
  }

  function setQueryPage(page) {
    queryPage = page;
    renderPlayerQuery();
  }

  function openPlayerQuery() {
    showView("queryView");
    populateQueryYears();
  }

  function showDraftPanel() {
    document.getElementById("draftPanel").hidden = false;
    document.getElementById("simulationPanel").hidden = true;
  }

  function renderSimulationPlayer(slotKey, player, score) {
    return `
<div class="simulation-player">
  <div class="simulation-player-head">
    <span class="roster-player-name ability-name-bar ${cardTypeClass(player.cardType)}" style="${scoreBarStyle(score)}">${formatShortYear(player.year)} ${player.name}</span>
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

    if (isPlayerAlreadyOnRoster(player)) {
      alert("這位球員的其他年度卡片已經在你的陣容裡了");
      return;
    }

    const limits = getModeCardLimits();
    if (limits && (player.cardType === "紅" || player.cardType === "紫") && eliteRosterCount() >= limits.elite) {
      alert(`選秀陣容中的紅卡與紫卡合計最多${limits.elite}位`);
      return;
    }

    if (limits && player.cardType === "紫" && purpleRosterCount() >= limits.purple) {
      alert(`選秀陣容中的紫卡最多${limits.purple}位`);
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
    scrollMobileDraftPlayers();

    if (rosterCount() >= config.rosterLimits.total) {
      if (onlineDraftMode) {
        document.getElementById("onlineMatchButton").disabled = false;
        document.getElementById("onlineMatchStatus").textContent = "選秀完成，可以開始尋找對手";
        alert("選秀完成！現在可以按下「尋找對手」。");
      } else {
        alert("選秀完成！即將自動模擬 120 場球季。");
        simulateSeason();
      }
    } else {
      grantFreeSpinIfPoolBlocked();
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
    if (!draftStarted || yearRerollUsed) {
      return;
    }

    const alternatives = TEAMS.filter(pool =>
      pool.league === currentPool.league &&
      pool.team === currentPool.team &&
      pool.year !== currentPool.year
    );
    if (!alternatives.length) {
      alert("這支球隊沒有其他可抽選年份");
      return;
    }

    currentPool = randomPool(alternatives);
    yearRerollUsed = true;
    showCurrentPool();
  }

  function rerollTeam() {
    if (!draftStarted || teamRerollUsed) {
      return;
    }

    const alternatives = TEAMS.filter(pool =>
      pool.league === currentPool.league &&
      pool.year === currentPool.year &&
      pool.team !== currentPool.team
    );
    if (!alternatives.length) {
      alert("這個年份沒有其他可抽選球隊");
      return;
    }

    currentPool = randomPool(alternatives);
    teamRerollUsed = true;
    showCurrentPool();
  }

  function remakeDraft() {
    currentPool = null;
    selectedPlayerId = null;
    draftStarted = false;
    playerPickedThisRound = false;
    yearRerollUsed = false;
    teamRerollUsed = false;
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
    updateOnlineDraftUi();
    scrollMobileDraftPlayers();
  }

  function hitterScore(player, slotKey) {
    const position = slotGroup(slotKey);
    const weights = config.seasonWeights.hitters[position];

    if (!weights) {
      throw new Error(`找不到打者守位 ${position} 的模擬權重`);
    }

    return (
      player.power * weights.power +
      player.contact * weights.contact +
      player.speed * weights.speed +
      player.fielding * weights.fielding +
      player.arm * weights.arm
    );
  }

  function pitcherScore(player) {
    const weights = config.seasonWeights.pitchers[player.role];

    if (!weights) {
      throw new Error(`找不到投手角色 ${player.role} 的模擬權重`);
    }

    return (
      player.velocity * weights.velocity +
      player.control * weights.control +
      player.stamina * weights.stamina +
      player.breaking * weights.breaking
    );
  }

  async function simulateSeason() {
    try {
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
      const simulation = config.simulation;
      const score = hAvg * simulation.hitterTeamWeight + pAvg * simulation.pitcherTeamWeight;

      const leagueAverageScore = simulation.leagueAverageScores[gameMode];
      const projectedGameStrength = (score - leagueAverageScore) / simulation.scoreScale;
      const winRate = Math.max(0, Math.min(1, 0.5 + projectedGameStrength * simulation.strengthPerGame));
      const wins = Math.round(winRate * simulation.games);
      const losses = simulation.games - wins;
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
      let nickname = "";
      const highestEntry = await window.BBOStats?.getHighestScore?.(gameMode);
      if (!highestEntry || score > Number(highestEntry.score || 0)) {
        const input = window.prompt("恭喜刷新本頻道最高分！請輸入你的暱稱：", "");
        nickname = window.BBOStats?.sanitizeNickname?.(input) || "匿名玩家";
      }
      window.BBOStats?.record({ mode: gameMode, score, wins, losses, nickname });
    } catch (error) {
      console.error("模擬球季失敗", error);
      alert(`模擬球季失敗：${error.message}`);
    }
  }

  function versusTeamPlayers(team) {
    return [
      ...Object.values(team.hitters),
      ...Object.values(team.pitchers)
    ].filter(Boolean);
  }

  function versusPlayerLabel(teamIndex) {
    return versusState.labels?.[teamIndex] || (teamIndex === 0 ? "玩家1" : "玩家2");
  }

  function versusAllPlayers() {
    return versusState.teams.flatMap(versusTeamPlayers);
  }

  function versusTeamCount(team) {
    return versusTeamPlayers(team).length;
  }

  function isVersusPlayerDrafted(player) {
    const name = normalizePlayerName(player.name);
    return versusAllPlayers().some(drafted =>
      drafted.id === player.id || normalizePlayerName(drafted.name) === name
    );
  }

  function versusTeamCardCounts(team) {
    const counts = { "紫": 0, "紅": 0, "黃": 0, "藍": 0 };
    versusTeamPlayers(team).forEach(player => counts[player.cardType]++);
    return counts;
  }

  function versusCardLimitReached(team, player) {
    const limits = {
      minor: { purple: 2, elite: 10 },
      amateur: { purple: 1, elite: 6 },
      free: null
    }[versusState.mode];
    if (!limits) {
      return false;
    }
    const counts = versusTeamCardCounts(team);
    return (player.cardType === "紫" && counts["紫"] >= limits.purple) ||
      ((player.cardType === "紫" || player.cardType === "紅") && counts["紫"] + counts["紅"] >= limits.elite);
  }

  function getVersusSlots(team, player) {
    if (player.type === "pitcher") {
      return versusPitcherSlots.filter(slot => slot.startsWith(player.role) && !team.pitchers[slot]);
    }

    const positionSlots = versusHitterSlots.filter(slot =>
      slot !== "DH" &&
      !team.hitters[slot] &&
      player.positions.includes(slotGroup(slot))
    );
    if (!team.hitters.DH) {
      positionSlots.push("DH");
    }
    return positionSlots;
  }

  function isVersusPlayerAvailable(player, teamIndex = versusState.picker) {
    const team = versusState.teams[teamIndex];
    return !versusState.finished &&
      !isVersusPlayerDrafted(player) &&
      !versusCardLimitReached(team, player) &&
      getVersusSlots(team, player).length > 0;
  }

  function getVersusSuitablePools(teamIndex) {
    return TEAMS.filter(pool => pool.players.some(player => isVersusPlayerAvailable(player, teamIndex)));
  }

  function ensureVersusPickerHasChoices() {
    const hasChoice = versusState.currentPool?.players.some(player => isVersusPlayerAvailable(player));
    if (hasChoice) {
      return true;
    }

    const suitablePools = getVersusSuitablePools(versusState.picker);
    if (!suitablePools.length) {
      return false;
    }
    versusState.currentPool = randomPool(suitablePools);
    return true;
  }

  function grantVersusFreeSpinIfPoolBlocked() {
    const hasChoice = versusState.currentPool?.players.some(player => isVersusPlayerAvailable(player));
    if (!versusState.currentPool || hasChoice) {
      return false;
    }

    versusState.spinner = versusState.picker;
    versusState.currentPool = null;
    versusState.pendingPlayerId = null;
    versusState.picksInPool = 0;
    versusState.freeSpinNotice = {
      teamIndex: versusState.picker,
      id: Date.now()
    };
    if (!onlineVersusMode) {
      alert(`${versusPlayerLabel(versusState.picker)}目前沒有任何可加入球員，免費獲得一次 SPIN 機會！`);
    }
    return true;
  }

  function versusPlayerCard(player) {
    const unavailable = !isVersusPlayerAvailable(player);
    const selected = versusState.pendingPlayerId === player.id;
    return `
      <div class="player ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}" onclick="versusPickPlayer('${player.id}')">
        <b class="player-name ${cardTypeClass(player.cardType)}">${formatShortYear(player.year)} ${player.name}</b>
        <span class="badge position-badge ${unavailable ? "unavailable" : ""}">${player.type === "hitter" ? formatHitterPositions(player.positions) : player.role}</span>
        ${renderPlayerStats(player, unavailable ? "stats unavailable" : "stats")}
      </div>
    `;
  }

  function versusAverageStats(players, stats) {
    if (!players.length) {
      return Object.fromEntries(stats.map(stat => [stat, 0]));
    }
    return Object.fromEntries(stats.map(stat => [
      stat,
      Math.round(players.reduce((sum, player) => sum + player[stat], 0) / players.length)
    ]));
  }

  function versusAverageClass(value) {
    if (value > 91) return "average-purple";
    if (value > 80) return "average-red";
    return "";
  }

  function renderVersusAverages(items) {
    return `<span class="versus-averages">${items.map(([label, value]) =>
      `<span>${label}<strong class="${versusAverageClass(value)}">${value || "-"}</strong></span>`
    ).join("")}</span>`;
  }

  function renderVersusRoster(teamIndex) {
    const team = versusState.teams[teamIndex];
    const counts = versusTeamCardCounts(team);
    const limits = {
      minor: { purple: 2, elite: 10 },
      amateur: { purple: 1, elite: 6 },
      free: null
    }[versusState.mode];
    document.getElementById(`versusCounts${teamIndex + 1}`).innerHTML = `
      <span class="card-count card-purple"><b>紫</b>${counts["紫"]}</span>
      <span class="card-count card-red"><b>紅</b>${counts["紅"]}</span>
      <span class="card-count card-yellow"><b>黃</b>${counts["黃"]}</span>
      <span class="card-count card-blue"><b>藍</b>${counts["藍"]}</span>
      ${limits ? `<span class="versus-elite-limit">紅紫 ${counts["紫"] + counts["紅"]}/${limits.elite}</span>` : ""}
    `;
    const pendingPlayer = versusState.currentPool?.players.find(player => player.id === versusState.pendingPlayerId);
    const availableSlots = pendingPlayer && versusState.picker === teamIndex ? getVersusSlots(team, pendingPlayer) : [];
    const hitterPlayers = Object.values(team.hitters).filter(Boolean);
    const pitcherPlayers = Object.values(team.pitchers).filter(Boolean);
    const hitterAverages = versusAverageStats(hitterPlayers, ["power", "contact", "speed", "fielding", "arm"]);
    const pitcherAverages = versusAverageStats(pitcherPlayers, ["stamina", "control", "velocity", "breaking"]);
    const hitterRows = team.lineup.map((slot, orderIndex) => {
      const player = team.hitters[slot];
      const canPlace = availableSlots.includes(slot);
      return `
        <div class="versus-roster-row ${player ? "lineup-draggable" : ""} ${canPlace ? "placeable" : ""}"
          draggable="${Boolean(player)}"
          ondragstart="startVersusLineupDrag(${teamIndex},${orderIndex})"
          ondragover="allowVersusLineupDrop(event)"
          ondrop="dropVersusLineup(${teamIndex},${orderIndex})"
          onclick="${canPlace ? `placeVersusPlayer('${slot}')` : ""}">
          <span class="slot">${orderIndex + 1}. ${slotGroup(slot)}</span>
          <span class="versus-roster-player ${player ? `ability-name-bar ${cardTypeClass(player.cardType)}` : ""}" ${player ? `style="${scoreBarStyle(hitterScore(player, slot))}"` : ""}>${player ? `${formatShortYear(player.year)} ${player.name}` : canPlace ? "可放入" : "尚未選擇"}</span>
          ${player ? `<div class="versus-roster-tooltip">${renderPlayerStats(player, "stats stats-grid")}</div>` : ""}
          <span class="drag-handle">${player ? "⋮⋮" : ""}</span>
        </div>
      `;
    }).join("");

    const pitcherRows = versusPitcherSlots.map(slot => {
      const player = team.pitchers[slot];
      const canPlace = availableSlots.includes(slot);
      return `
        <div class="versus-roster-row ${canPlace ? "placeable" : ""}" onclick="${canPlace ? `placeVersusPlayer('${slot}')` : ""}">
          <span class="slot">${slot}</span>
          <span class="versus-roster-player ${player ? `ability-name-bar ${cardTypeClass(player.cardType)}` : ""}" ${player ? `style="${scoreBarStyle(pitcherScore(player))}"` : ""}>${player ? `${formatShortYear(player.year)} ${player.name}` : canPlace ? "可放入" : "尚未選擇"}</span>
          ${player ? `<div class="versus-roster-tooltip">${renderPlayerStats(player, "stats stats-grid")}</div>` : ""}
          <span></span>
        </div>
      `;
    }).join("");

    document.getElementById(`versusRoster${teamIndex + 1}`).innerHTML = `
      <div class="versus-roster-section">
        <h3>打者與棒次 ${renderVersusAverages([["力量", hitterAverages.power], ["打擊", hitterAverages.contact], ["速度", hitterAverages.speed], ["守備", hitterAverages.fielding], ["傳球", hitterAverages.arm]])}</h3>
        <div class="versus-roster-list">${hitterRows}</div>
      </div>
      <div class="versus-roster-section">
        <h3>投手群 ${renderVersusAverages([["體力", pitcherAverages.stamina], ["控球", pitcherAverages.control], ["球威", pitcherAverages.velocity], ["變化", pitcherAverages.breaking]])}</h3>
        <div class="versus-roster-list">${pitcherRows}</div>
      </div>
      <div class="simulation-note">${versusTeamCount(team)} / ${config.rosterLimits.total}</div>
    `;
  }

  function renderVersusMode() {
    renderVersusRoster(0);
    renderVersusRoster(1);

    document.getElementById("versusTeam1").classList.toggle("active", !versusState.finished && versusState.picker === 0);
    document.getElementById("versusTeam2").classList.toggle("active", !versusState.finished && versusState.picker === 1);
    const adjustmentSeconds = getVersusAdjustmentSeconds();
    const adjustingLineup = adjustmentSeconds > 0;
    const readySuffix = onlineVersusMode && versusState.finished ? `｜準備 ${versusLineupReadyCount()}/2` : "";
    const status = document.getElementById("versusStatus");
    status.classList.toggle("lineup-adjustment-active", adjustingLineup);
    status.textContent = versusState.finished
      ? adjustingLineup
        ? `請調整棒次｜剩餘 ${formatVersusCountdown(adjustmentSeconds)}${readySuffix}`
        : `棒次調整時間結束，準備進行三戰兩勝${readySuffix}`
      : `目前由${versusPlayerLabel(versusState.picker)}${versusState.currentPool ? "選擇一位球員" : "按下 SPIN"}`;

    const spinButton = document.getElementById("versusSpinButton");
    spinButton.disabled = versusState.finished || Boolean(versusState.currentPool);
    spinButton.textContent = `🎲 ${versusPlayerLabel(versusState.spinner)} SPIN`;
    updateVersusReadyButton(adjustingLineup);
    document.getElementById("versusSimulateButton").disabled = !versusState.finished || adjustingLineup;
    document.getElementById("versusModeSelect").disabled = Boolean(versusState.currentPool) || versusAllPlayers().length > 0;

    document.getElementById("versusPoolInfo").textContent = versusState.currentPool
      ? `${versusState.currentPool.year} ${versusState.currentPool.team}｜${versusPlayerLabel(versusState.picker)}選擇`
      : versusState.finished
        ? adjustingLineup ? "請拖曳左右兩隊的打者調整棒次" : "棒次已鎖定"
        : `等待${versusPlayerLabel(versusState.spinner)} SPIN`;
    document.getElementById("versusPlayers").innerHTML = versusState.currentPool
      ? versusState.currentPool.players.map(versusPlayerCard).join("")
      : "";
    startVersusAdjustmentTimer();
  }

  function getVersusAdjustmentSeconds() {
    return Math.max(0, Math.ceil((Number(versusState.lineupDeadline || 0) - Date.now()) / 1000));
  }

  function formatVersusCountdown(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function versusLineupReadyCount() {
    return (versusState.lineupReady || []).filter(Boolean).length;
  }

  function updateVersusReadyButton(adjustingLineup) {
    const button = document.getElementById("versusReadyButton");
    if (!button) return;
    button.hidden = !(onlineVersusMode && versusState.finished && adjustingLineup);
    if (button.hidden) return;
    const localReady = Boolean(window.BBOOnlineDraft?.getLineupReadyInfo?.().localReady);
    button.disabled = localReady;
    button.textContent = localReady ? "已準備完成" : "準備完成";
  }

  function startVersusAdjustmentTimer() {
    clearInterval(versusAdjustmentTimer);
    if (!versusState.finished || !versusState.lineupDeadline) return;
    if (versusAdjustmentNoticeDeadline !== versusState.lineupDeadline && getVersusAdjustmentSeconds() > 0) {
      versusAdjustmentNoticeDeadline = versusState.lineupDeadline;
      alert("雙方選秀完成！請在 1 分鐘內拖曳打者調整棒次。");
    }
    if (onlineVersusMode || getVersusAdjustmentSeconds() <= 0) return;
    versusAdjustmentTimer = setInterval(() => {
      if (getVersusAdjustmentSeconds() <= 0) clearInterval(versusAdjustmentTimer);
      renderVersusMode();
    }, 1000);
  }

  function openVersusMode() {
    onlineVersusMode = false;
    document.querySelector("#versusView .view-nav h1").textContent = "單機對戰";
    resetVersusMode();
    document.getElementById("versusSpinButton").hidden = false;
    document.getElementById("versusReadyButton").hidden = true;
    document.getElementById("versusSimulateButton").hidden = false;
    document.getElementById("versusResetButton").hidden = false;
    startBackgroundMusic();
    showView("versusView");
  }

  function resetVersusMode() {
    const selectedMode = document.getElementById("versusModeSelect")?.value || "minor";
    versusState = createVersusState();
    versusState.mode = selectedMode;
    document.querySelector("#versusTeam1 h2").textContent = "玩家1";
    document.querySelector("#versusTeam2 h2").textContent = "玩家2";
    document.getElementById("versusResult").hidden = true;
    document.getElementById("versusResult").innerHTML = "";
    renderVersusMode();
  }

  function versusSpin() {
    if (onlineVersusMode && !onlineAutoOverride && !window.BBOOnlineDraft?.canAct()) {
      return;
    }
    if (versusState.finished || versusState.currentPool) {
      return;
    }
    startBackgroundMusic();
    const suitablePools = getVersusSuitablePools(versusState.spinner);
    if (!suitablePools.length) {
      alert("目前找不到符合空缺守位的球員，請重新對戰。");
      return;
    }
    versusState.currentPool = randomPool(suitablePools);
    versusState.picker = versusState.spinner;
    versusState.picksInPool = 0;
    grantVersusFreeSpinIfPoolBlocked();
    renderVersusMode();
    if (onlineVersusMode) window.BBOOnlineDraft?.stateChanged(versusState);
  }

  function versusPickPlayer(playerId) {
    if (onlineVersusMode && !window.BBOOnlineDraft?.canAct()) {
      return;
    }
    const player = versusState.currentPool?.players.find(candidate => candidate.id === playerId);
    if (!player || !isVersusPlayerAvailable(player)) {
      return;
    }

    versusState.pendingPlayerId = versusState.pendingPlayerId === playerId ? null : playerId;
    renderVersusMode();
  }

  function placeVersusPlayer(slot) {
    if (onlineVersusMode && !onlineAutoOverride && !window.BBOOnlineDraft?.canAct()) {
      return;
    }
    const player = versusState.currentPool?.players.find(candidate => candidate.id === versusState.pendingPlayerId);
    if (!player || !isVersusPlayerAvailable(player) || !getVersusSlots(versusState.teams[versusState.picker], player).includes(slot)) {
      return;
    }
    const team = versusState.teams[versusState.picker];
    if (player.type === "hitter") {
      team.hitters[slot] = player;
    } else {
      team.pitchers[slot] = player;
    }

    versusState.pendingPlayerId = null;
    versusState.picksInPool++;
    if (versusState.teams.every(candidate => versusTeamCount(candidate) >= config.rosterLimits.total)) {
      versusState.finished = true;
      versusState.currentPool = null;
      versusState.lineupDeadline = Date.now() + 60000;
      versusState.lineupReady = [false, false];
    } else if (versusState.picksInPool === 1) {
      versusState.picker = 1 - versusState.spinner;
      grantVersusFreeSpinIfPoolBlocked();
    } else {
      versusState.spinner = 1 - versusState.spinner;
      versusState.picker = versusState.spinner;
      versusState.currentPool = null;
      versusState.pendingPlayerId = null;
      versusState.picksInPool = 0;
    }
    renderVersusMode();
    if (onlineVersusMode) window.BBOOnlineDraft?.stateChanged(versusState);
  }

  function startOnlineVersusDraft(state) {
    onlineVersusMode = true;
    versusState = hydrateOnlineVersusState(state);
    document.querySelector("#versusView .view-nav h1").textContent = "線上選秀對戰";
    document.getElementById("versusSpinButton").hidden = false;
    document.getElementById("versusReadyButton").hidden = true;
    document.getElementById("versusSimulateButton").hidden = true;
    document.getElementById("versusResetButton").hidden = true;
    document.getElementById("versusModeSelect").disabled = true;
    document.getElementById("versusResult").hidden = true;
    document.getElementById("versusResult").innerHTML = "";
    document.querySelector("#versusTeam1 h2").textContent = versusPlayerLabel(0);
    document.querySelector("#versusTeam2 h2").textContent = versusPlayerLabel(1);
    renderVersusMode();
    showView("versusView");
  }

  function importOnlineVersusState(state) {
    versusState = hydrateOnlineVersusState(state);
    document.querySelector("#versusTeam1 h2").textContent = versusPlayerLabel(0);
    document.querySelector("#versusTeam2 h2").textContent = versusPlayerLabel(1);
    renderVersusMode();
  }

  function createOnlineVersusState(mode, labels) {
    const state = createVersusState();
    state.mode = mode;
    state.labels = labels;
    return state;
  }

  function hydrateOnlineVersusState(state) {
    const hydrated = { ...createVersusState(), ...JSON.parse(JSON.stringify(state || {})) };
    hydrated.teams = [0, 1].map(teamIndex => {
      const emptyTeam = createVersusTeam();
      const savedTeam = hydrated.teams?.[teamIndex] || {};
      return {
        ...emptyTeam,
        ...savedTeam,
        hitters: { ...emptyTeam.hitters, ...(savedTeam.hitters || {}) },
        pitchers: { ...emptyTeam.pitchers, ...(savedTeam.pitchers || {}) },
        lineup: savedTeam.lineup || emptyTeam.lineup
      };
    });
    hydrated.lineupReady = [0, 1].map(index => Boolean(hydrated.lineupReady?.[index]));
    return hydrated;
  }

  function autoOnlineVersusAction() {
    onlineAutoOverride = true;
    try {
      if (!versusState.currentPool) {
        versusSpin();
        return;
      }
      const player = versusState.currentPool.players.find(candidate => isVersusPlayerAvailable(candidate));
      if (!player) return;
      versusState.pendingPlayerId = player.id;
      const slot = getVersusSlots(versusState.teams[versusState.picker], player)[0];
      if (slot) placeVersusPlayer(slot);
    } finally {
      onlineAutoOverride = false;
    }
  }

  function startVersusLineupDrag(teamIndex, orderIndex) {
    if (!canAdjustVersusLineup(teamIndex)) return;
    versusState.draggedLineup = { teamIndex, orderIndex };
  }

  function allowVersusLineupDrop(event) {
    event.preventDefault();
  }

  function dropVersusLineup(teamIndex, targetIndex) {
    const dragged = versusState.draggedLineup;
    if (!canAdjustVersusLineup(teamIndex) || !dragged || dragged.teamIndex !== teamIndex || dragged.orderIndex === targetIndex) {
      return;
    }
    const lineup = versusState.teams[teamIndex].lineup;
    const [slot] = lineup.splice(dragged.orderIndex, 1);
    lineup.splice(targetIndex, 0, slot);
    versusState.draggedLineup = null;
    renderVersusMode();
    if (onlineVersusMode) window.BBOOnlineDraft?.stateChanged(versusState);
  }

  function canAdjustVersusLineup(teamIndex) {
    if (!versusState.finished || getVersusAdjustmentSeconds() <= 0) return false;
    return !onlineVersusMode || window.BBOOnlineDraft?.canEditLineup(teamIndex);
  }

  function markOnlineDraftLineupReady() {
    if (!onlineVersusMode || !versusState.finished || getVersusAdjustmentSeconds() <= 0) return;
    window.BBOOnlineDraft?.markLineupReady?.();
  }

  function setVersusMode(mode) {
    if (versusAllPlayers().length > 0 || versusState.currentPool) {
      return;
    }
    versusState.mode = mode;
    renderVersusMode();
  }

  function versusOffenseScore(team) {
    const totalWeight = lineupWeights.reduce((sum, weight) => sum + weight, 0);
    return team.lineup.reduce((sum, slot, index) => {
      return sum + hitterScore(team.hitters[slot], slot) * lineupWeights[index];
    }, 0) / totalWeight;
  }

  function versusPitchingScore(team, gameIndex) {
    const starter = team.pitchers[`SP${gameIndex + 1}`];
    const bullpen = ["RP1", "RP2", "CP1", "CP2"].map(slot => team.pitchers[slot]);
    const bullpenAverage = bullpen.reduce((sum, player) => sum + pitcherScore(player), 0) / bullpen.length;
    return pitcherScore(starter) * 0.65 + bullpenAverage * 0.35;
  }

  function simulateInnings(expectedRuns) {
    const innings = [];
    const inningRate = Math.max(0.08, expectedRuns / 9);
    for (let inning = 0; inning < 9; inning++) {
      let runs = 0;
      if (Math.random() < Math.min(0.75, inningRate * 0.8)) runs++;
      if (Math.random() < Math.min(0.35, inningRate * 0.28)) runs++;
      if (Math.random() < Math.min(0.16, inningRate * 0.12)) runs++;
      innings.push(runs);
    }
    return innings;
  }

  function sumInnings(innings) {
    return innings.reduce((sum, runs) => sum + runs, 0);
  }

  function renderVersusGame(game) {
    const teams = [game.away, game.home];
    const inningHeaders = Array.from({ length: 9 }, (_, index) => `<th class="inning-cell">${index + 1}</th>`).join("");
    const rows = teams.map(teamIndex => {
      const innings = game.innings[teamIndex];
      return `
        <tr>
          <td class="team-cell">${versusPlayerLabel(teamIndex)}${teamIndex === game.away ? "（先攻）" : "（後攻）"}</td>
          ${innings.map(runs => `<td class="inning-cell">${runs}</td>`).join("")}
          <td class="summary-cell runs-cell">${game.runs[teamIndex]}</td>
          <td class="summary-cell">${game.hits[teamIndex]}</td>
          <td class="summary-cell">${game.errors[teamIndex]}</td>
        </tr>
      `;
    }).join("");
    return `
      <div class="versus-game-result">
        <div class="versus-game-heading">
          <h3>第${game.game}戰｜SP${game.game}</h3>
          <div class="game-awards">
            <span>勝投：${game.awards.winningPitcher}</span>
            <span>敗投：${game.awards.losingPitcher}</span>
            <span>救援：${game.awards.savePitcher || "無"}</span>
            <span>全壘打：${game.awards.homeRuns.length ? game.awards.homeRuns.join("、") : "無"}</span>
            <span class="mvp-award">MVP：${game.awards.mvp.name}｜${game.awards.mvp.stats}</span>
          </div>
        </div>
        <table class="scoreboard">
          <thead><tr><th class="team-cell">TEAM</th>${inningHeaders}<th class="summary-cell runs-cell">R</th><th class="summary-cell">H</th><th class="summary-cell">E</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="versus-outcome">
          <div class="${game.winner === 0 ? "win" : "lose"}">${versusPlayerLabel(0)}<br>${game.winner === 0 ? "WIN" : "LOSE"}</div>
          <div class="${game.winner === 1 ? "win" : "lose"}">${versusPlayerLabel(1)}<br>${game.winner === 1 ? "WIN" : "LOSE"}</div>
        </div>
      </div>
    `;
  }

  function simulateVersusSeries() {
    if (!versusState.finished || getVersusAdjustmentSeconds() > 0) {
      return;
    }

    const offenses = versusState.teams.map(versusOffenseScore);
    const wins = [0, 0];
    const games = [];
    for (let gameIndex = 0; gameIndex < 3 && Math.max(...wins) < 2; gameIndex++) {
      const home = Math.random() < 0.5 ? 0 : 1;
      const away = 1 - home;
      const pitching = versusState.teams.map(team => versusPitchingScore(team, gameIndex));
      const innings = [
        simulateInnings(4.5 + (offenses[0] - pitching[1]) / 7),
        simulateInnings(4.5 + (offenses[1] - pitching[0]) / 7)
      ];
      const runs = innings.map(sumInnings);
      while (runs[0] === runs[1]) {
        const winner = Math.random() < 0.5 ? 0 : 1;
        innings[winner][8]++;
        runs[winner]++;
      }
      const winner = runs[0] > runs[1] ? 0 : 1;
      const hits = runs.map(runTotal => runTotal + rand(3, 9));
      const errors = [rand(0, 2), rand(0, 2)];
      const loser = 1 - winner;
      const winningStarter = versusState.teams[winner].pitchers[`SP${gameIndex + 1}`];
      const losingStarter = versusState.teams[loser].pitchers[`SP${gameIndex + 1}`];
      const savePitcher = runs[winner] - runs[loser] <= 3 ? versusState.teams[winner].pitchers.CP1 : null;
      const hitterPerformances = versusState.teams.flatMap((team, teamIndex) =>
        team.lineup.map(slot => {
          const player = team.hitters[slot];
          const atBats = rand(3, 5);
          const playerHits = Math.min(atBats, rand(0, Math.max(1, Math.round(playerOverall(player) / 25))));
          const homeRuns = Math.random() < Math.max(0.04, (player.power - 65) / 180) ? 1 : 0;
          const rbi = Math.max(homeRuns, rand(0, Math.min(4, runs[teamIndex] + 1)));
          return { player, teamIndex, atBats, hits: playerHits, homeRuns, rbi };
        })
      );
      const homeRuns = hitterPerformances
        .filter(performance => performance.homeRuns > 0)
        .map(performance => `${versusPlayerLabel(performance.teamIndex)} ${performance.player.name}`);
      const mvp = hitterPerformances
        .filter(performance => performance.teamIndex === winner)
        .sort((left, right) =>
          (right.homeRuns * 5 + right.rbi * 2 + right.hits) -
          (left.homeRuns * 5 + left.rbi * 2 + left.hits)
        )[0];
      const awards = {
        winningPitcher: `${versusPlayerLabel(winner)} ${winningStarter.name}`,
        losingPitcher: `${versusPlayerLabel(loser)} ${losingStarter.name}`,
        savePitcher: savePitcher ? `${versusPlayerLabel(winner)} ${savePitcher.name}` : "",
        homeRuns,
        mvp: {
          name: `${versusPlayerLabel(winner)} ${mvp.player.name}`,
          stats: `${mvp.atBats}打數 ${mvp.hits}安打 ${mvp.homeRuns}全壘打 ${mvp.rbi}打點`
        }
      };
      wins[winner]++;
      games.push({ game: gameIndex + 1, home, away, innings, runs, hits, errors, winner, awards });
    }

    const champion = wins[0] > wins[1] ? 0 : 1;
    document.getElementById("versusResult").hidden = false;
    document.getElementById("versusResult").innerHTML = `
      <h2>${versusPlayerLabel(champion)}獲勝｜系列賽 ${wins[0]}-${wins[1]}</h2>
      ${games.map(renderVersusGame).join("")}
      <div class="simulation-note">雙方先後攻每場隨機；第 1 至第 3 戰依序使用 SP1、SP2、SP3。</div>
    `;
    return document.getElementById("versusResult").innerHTML;
  }

  function getOnlineDraftSnapshot() {
    if (rosterCount() < config.rosterLimits.total) return null;
    return JSON.parse(JSON.stringify({
      mode: gameMode,
      team: {
        hitters: {
          C: roster.hitters.C || null,
          "1B": roster.hitters["1B"] || null,
          "2B": roster.hitters["2B"] || null,
          "3B": roster.hitters["3B"] || null,
          SS: roster.hitters.SS || null,
          OF1: roster.hitters.LF || null,
          OF2: roster.hitters.CF || null,
          OF3: roster.hitters.RF || null,
          DH: roster.hitters.DH || null
        },
        pitchers: { ...roster.pitchers },
        lineup: [...versusHitterSlots]
      }
    }));
  }

  function showOnlineMatchup(localTeam, opponentTeam, localIsPlayer1, mode, localNickname, opponentNickname) {
    onlineVersusMode = false;
    document.querySelector("#versusView .view-nav h1").textContent = "連線對戰";
    versusState = createVersusState();
    versusState.teams = localIsPlayer1 ? [localTeam, opponentTeam] : [opponentTeam, localTeam];
    versusState.labels = localIsPlayer1
      ? [localNickname, opponentNickname]
      : [opponentNickname, localNickname];
    versusState.mode = mode;
    versusState.finished = true;
    document.querySelector("#versusTeam1 h2").textContent = versusPlayerLabel(0);
    document.querySelector("#versusTeam2 h2").textContent = versusPlayerLabel(1);
    renderVersusMode();
    document.getElementById("versusSpinButton").hidden = true;
    document.getElementById("versusReadyButton").hidden = true;
    document.getElementById("versusSimulateButton").hidden = true;
    document.getElementById("versusResetButton").hidden = true;
    document.getElementById("versusModeSelect").disabled = true;
    document.getElementById("versusPoolInfo").textContent = "配對成功，等待比賽結果";
    document.getElementById("versusResult").hidden = true;
    showView("versusView");
  }

  function renderOnlineSeries(resultHtml) {
    const result = document.getElementById("versusResult");
    result.hidden = false;
    result.innerHTML = `${resultHtml}<div class="online-rematch"><button onclick="searchAgainOnline()">再次搜尋對手</button></div>`;
    document.getElementById("versusPoolInfo").textContent = "連線對戰完成";
  }

  function renderOnlineDraftSeries(resultHtml) {
    const result = document.getElementById("versusResult");
    result.hidden = false;
    result.innerHTML = `${resultHtml}<div class="online-rematch"><button onclick="searchAgainOnlineDraft()">再次配對選秀對戰</button></div>`;
    document.getElementById("versusPoolInfo").textContent = "線上選秀對戰完成";
  }

  window.selectPlayer = selectPlayer;
  window.addSelectedToSlot = addSelectedToSlot;
  window.spinTeam = spinTeam;
  window.rerollYear = rerollYear;
  window.rerollTeam = rerollTeam;
  window.toggleMusicMute = toggleMusicMute;
  window.skipMusicTrack = skipMusicTrack;
  window.setPlayerFilter = setPlayerFilter;
  window.enterGame = enterGame;
  window.showHome = showHome;
  window.openPlayerQuery = openPlayerQuery;
  window.populateQueryYears = populateQueryYears;
  window.populateQueryTeams = populateQueryTeams;
  window.setQueryPositionFilter = setQueryPositionFilter;
  window.renderPlayerQuery = renderPlayerQuery;
  window.setQueryPage = setQueryPage;
  window.setQueryPlayerFilter = setQueryPlayerFilter;
  window.remakeDraft = remakeDraft;
  window.simulateSeason = simulateSeason;
  window.openVersusMode = openVersusMode;
  window.resetVersusMode = resetVersusMode;
  window.versusSpin = versusSpin;
  window.versusPickPlayer = versusPickPlayer;
  window.placeVersusPlayer = placeVersusPlayer;
  window.startVersusLineupDrag = startVersusLineupDrag;
  window.allowVersusLineupDrop = allowVersusLineupDrop;
  window.dropVersusLineup = dropVersusLineup;
  window.markOnlineDraftLineupReady = markOnlineDraftLineupReady;
  window.simulateVersusSeries = simulateVersusSeries;
  window.setVersusMode = setVersusMode;
  window.BBOGame = {
    startOnlineDraft,
    getOnlineDraftSnapshot,
    showOnlineMatchup,
    simulateOnlineSeries: simulateVersusSeries,
    renderOnlineSeries,
    showStatisticsView,
    showOnlineDraftMatchView,
    createOnlineVersusState,
    startOnlineVersusDraft,
    importOnlineVersusState,
    autoOnlineVersusAction,
    renderOnlineDraftSeries
  };

  renderRoster();
  renderPlayers();
  updateRerollButtons();
  showView("homeView");
})();
