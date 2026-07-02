(function () {
  const modeLabels = {
    minor: "職業二軍頻道",
    amateur: "業餘頻道",
    free: "自由頻道"
  };
  const topEntries = {};

  async function database() {
    if (!firebase.apps.length) firebase.initializeApp(window.BBOFirebaseConfig);
    if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    return firebase.database();
  }

  async function record(result) {
    try {
      const db = await database();
      await db.ref(`challengeResults/${result.mode}`).push().set({
        score: Number(Number(result.score).toFixed(1)),
        wins: result.wins,
        losses: result.losses,
        nickname: sanitizeNickname(result.nickname),
        team: result.team || null,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (error) {
      console.error("儲存挑戰統計失敗", error);
    }
  }

  function sanitizeNickname(value) {
    const nickname = String(value || "").trim();
    return nickname || "匿名玩家";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getHighestEntry(values) {
    return values.reduce((best, item) => {
      const score = Number(item?.score);
      if (!Number.isFinite(score)) {
        return best;
      }
      if (!best || score > Number(best.score)) {
        return item;
      }
      return best;
    }, null);
  }

  function renderMode(mode, values) {
    const scores = values.map(item => Number(item.score)).filter(Number.isFinite);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const highest = scores.length ? Math.max(...scores) : 0;
    const lowest = scores.length ? Math.min(...scores) : 0;
    const highestEntry = getHighestEntry(values);
    topEntries[mode] = highestEntry || null;
    const highestNickname = highestEntry ? sanitizeNickname(highestEntry.nickname) : "暫無紀錄";
    const hasTeam = Boolean(highestEntry?.team);
    return `
      <div class="statistics-card">
        <h2>${modeLabels[mode]}</h2>
        <div><span>完成次數</span><strong>${scores.length}</strong></div>
        <div><span>平均分數</span><strong>${average.toFixed(1)}</strong></div>
        <div><span>最高分數</span><strong>${highest.toFixed(1)}</strong></div>
        <div><span>最高分玩家</span><strong>${highestNickname}</strong></div>
        <div><span>最低分數</span><strong>${lowest.toFixed(1)}</strong></div>
        <button class="statistics-team-button" onclick="BBOStats.showTopTeam('${mode}')">
          ${hasTeam ? "查看第一名隊伍" : "第一名隊伍未保存"}
        </button>
      </div>
    `;
  }

  function formatPositions(player) {
    return Array.isArray(player.positions) && player.positions.length
      ? player.positions.join("/")
      : "-";
  }

  function comboTeamName(team) {
    if (["WBC", "WBCS", "WBC Team Taiwan", "WBCS Team Taiwan"].includes(team)) return "中華隊";
    if (team === "中信兄弟" || team === "兄弟") return "兄弟";
    if (team === "和信鯨" || team === "中信鯨") return "和信鯨/中信鯨";
    if (["俊國", "興農", "義大", "富邦"].includes(team)) return "俊國/興農/義大/富邦";
    if (team === "米迪亞" || team === "誠泰") return "米迪亞/誠泰";
    if (["Lamigo", "樂天", "LaNew", "第一金剛"].includes(team)) return "Lamigo/樂天/LaNew/第一金剛";
    return team;
  }

  function cardTypeClass(cardType) {
    return {
      藍: "card-blue",
      黃: "card-yellow",
      紅: "card-red",
      紫: "card-purple"
    }[cardType] || "";
  }

  function scoreBarStyle(score) {
    const width = Math.max(18, Math.min(100, Number(score) || 0));
    return `--ability-width:${width}%`;
  }

  function renderStat(label, value) {
    const numberValue = Number(value);
    const highClass = Number.isFinite(numberValue) && numberValue >= 80 ? "stat-high" : "";
    return `<span class="stat-item"><span>${label}</span><strong class="${highClass}">${escapeHtml(value ?? "-")}</strong></span>`;
  }

  function storedPlayerComboBonus(player, combo) {
    if (!player?.team || !combo?.team) return 0;
    return comboTeamName(player.team) === combo.team ? Number(combo.bonus || 0) : 0;
  }

  function applyStoredComboStats(player, bonus) {
    const stats = player.stats || {};
    const boost = Number(bonus) || 0;
    const boosted = value => Math.min(99, Math.max(0, (Number(value) || 0) + boost));
    if (!boost) return stats;
    return player.type === "hitter"
      ? {
        power: boosted(stats.power),
        contact: boosted(stats.contact),
        speed: boosted(stats.speed),
        fielding: boosted(stats.fielding),
        arm: boosted(stats.arm)
      }
      : {
        stamina: boosted(stats.stamina),
        control: boosted(stats.control),
        velocity: boosted(stats.velocity),
        breaking: boosted(stats.breaking)
      };
  }

  function renderStats(player, bonus = 0) {
    const stats = applyStoredComboStats(player, bonus);
    const items = player.type === "hitter"
      ? [
        ["力量", stats.power],
        ["打擊", stats.contact],
        ["速度", stats.speed],
        ["傳球", stats.arm],
        ["守備", stats.fielding]
      ]
      : [
        ["體力", stats.stamina],
        ["控球", stats.control],
        ["球威", stats.velocity],
        ["變化", stats.breaking]
      ];
    return `<div class="stats stats-grid statistics-team-stats ${bonus ? "combo-boosted-stats" : ""}">${items.map(([label, value]) => renderStat(label, value)).join("")}</div>`;
  }

  function formatShortYear(year) {
    return String(Number(year) % 100).padStart(2, "0");
  }

  function comboTierClass(combo) {
    const count = Number(combo?.count || 0);
    if (count >= 16) return "statistics-team-tier-purple";
    if (count >= 12) return "statistics-team-tier-red";
    if (count >= 9) return "statistics-team-tier-yellow";
    if (count >= 6) return "statistics-team-tier-blue";
    return "statistics-team-tier-none";
  }

  function renderPlayer(player, combo = null) {
    const score = Number(player.score || 0);
    const bonus = storedPlayerComboBonus(player, combo);
    return `
      <div class="statistics-team-player">
        <div class="statistics-team-player-head">
          <span class="roster-player-name ability-name-bar ${cardTypeClass(player.cardType)} ${bonus ? "combo-boosted-card" : ""}" style="${scoreBarStyle(score)}">
            ${escapeHtml(formatShortYear(player.year))} ${escapeHtml(player.name)}${bonus ? `<span class="combo-badge">+${bonus}</span>` : ""}
          </span>
          <span class="simulation-slot">${escapeHtml(player.slot)}</span>
          <strong>${score.toFixed(1)}</strong>
        </div>
        <div class="statistics-team-subline">
          <span>${escapeHtml(player.cardType)}卡</span>
          <span>${escapeHtml(player.team)}</span>
          <span>${escapeHtml(formatPositions(player))}</span>
        </div>
        ${renderStats(player, bonus)}
      </div>
    `;
  }

  function showTopTeam(mode) {
    const entry = topEntries[mode];
    const panel = document.getElementById("statisticsTopTeam");
    if (!panel) return;
    if (!entry?.team) {
      panel.hidden = false;
      panel.innerHTML = `
        <button class="statistics-team-close" onclick="BBOStats.closeTopTeam()">×</button>
        <h2>${modeLabels[mode]} 第一名隊伍</h2>
        <p>這筆第一名是舊紀錄，當時還沒有保存隊伍資料。之後新的挑戰紀錄會自動保存陣容。</p>
      `;
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const combo = entry.team.combo;
    const hitterCount = (entry.team.hitters || []).length;
    const pitcherCount = (entry.team.pitchers || []).length;
    panel.hidden = false;
    panel.innerHTML = `
      <button class="statistics-team-close" onclick="BBOStats.closeTopTeam()">×</button>
      <div class="statistics-team-hero ${comboTierClass(combo)}">
        <div>
          <span class="statistics-team-kicker">CHAMPION ROSTER</span>
          <h2>${modeLabels[mode]} 第一名隊伍</h2>
          <p>${combo ? `${escapeHtml(combo.team)}組合隊｜${combo.count}人 全能力 +${combo.bonus}` : "雜牌軍｜沒有組合隊加成"}</p>
        </div>
        <div class="statistics-team-score">
          <span>${Number(entry.wins || 0)}-${Number(entry.losses || 0)}</span>
          <strong>${Number(entry.score || 0).toFixed(1)}</strong>
        </div>
      </div>
      <div class="statistics-team-meta">
        <span>玩家：<strong>${escapeHtml(sanitizeNickname(entry.nickname))}</strong></span>
        <span>野手：<strong>${hitterCount}</strong></span>
        <span>投手：<strong>${pitcherCount}</strong></span>
        <span>組合隊：<strong>${combo ? `+${combo.bonus}` : "無"}</strong></span>
      </div>
      <h3 class="statistics-team-section-title">野手陣容</h3>
      <div class="statistics-team-roster">${(entry.team.hitters || []).map(player => renderPlayer(player, combo)).join("")}</div>
      <h3 class="statistics-team-section-title">投手群</h3>
      <div class="statistics-team-roster">${(entry.team.pitchers || []).map(player => renderPlayer(player, combo)).join("")}</div>
    `;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function closeTopTeam() {
    const panel = document.getElementById("statisticsTopTeam");
    if (panel) panel.hidden = true;
  }

  async function getHighestScore(mode) {
    try {
      const snapshot = await (await database())
        .ref(`challengeResults/${mode}`)
        .orderByChild("score")
        .limitToLast(1)
        .once("value");
      const value = Object.values(snapshot.val() || {})[0] || null;
      return value ? {
        score: Number(value.score) || 0,
        nickname: sanitizeNickname(value.nickname)
      } : null;
    } catch (error) {
      console.error("讀取最高分失敗", error);
      return null;
    }
  }

  async function open() {
    window.BBOGame.showStatisticsView();
    const container = document.getElementById("statisticsResults");
    container.innerHTML = '<div class="info">統計資料載入中...</div>';
    try {
      const snapshot = await (await database()).ref("challengeResults").once("value");
      const data = snapshot.val() || {};
      container.innerHTML = ["minor", "amateur", "free"]
        .map(mode => renderMode(mode, Object.values(data[mode] || {})))
        .join("");
      closeTopTeam();
    } catch (error) {
      container.innerHTML = `<div class="info">統計資料載入失敗：${error.message}</div>`;
    }
  }

  window.openStatistics = open;
  window.BBOStats = { record, getHighestScore, sanitizeNickname, showTopTeam, closeTopTeam };
})();
