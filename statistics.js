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

  function renderPlayer(player) {
    const stats = player.stats || {};
    const statText = player.type === "hitter"
      ? `力${stats.power ?? "-"} 打${stats.contact ?? "-"} 速${stats.speed ?? "-"} 守${stats.fielding ?? "-"} 傳${stats.arm ?? "-"}`
      : `體${stats.stamina ?? "-"} 控${stats.control ?? "-"} 威${stats.velocity ?? "-"} 變${stats.breaking ?? "-"}`;
    return `
      <div class="statistics-team-player">
        <strong>${escapeHtml(player.slot)}｜${escapeHtml(player.year)} ${escapeHtml(player.name)}</strong>
        <span>${escapeHtml(player.cardType)}｜${escapeHtml(player.team)}｜${escapeHtml(formatPositions(player))}｜${escapeHtml(statText)}｜加權 ${Number(player.score || 0).toFixed(1)}</span>
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
    panel.hidden = false;
    panel.innerHTML = `
      <button class="statistics-team-close" onclick="BBOStats.closeTopTeam()">×</button>
      <h2>${modeLabels[mode]} 第一名隊伍</h2>
      <div class="statistics-team-meta">
        <span>玩家：<strong>${escapeHtml(sanitizeNickname(entry.nickname))}</strong></span>
        <span>戰績：<strong>${Number(entry.wins || 0)}-${Number(entry.losses || 0)}</strong></span>
        <span>分數：<strong>${Number(entry.score || 0).toFixed(1)}</strong></span>
        <span>組合隊：<strong>${combo ? `${escapeHtml(combo.team)}｜${combo.count}人 +${combo.bonus}` : "雜牌軍"}</strong></span>
      </div>
      <h3>野手</h3>
      <div class="statistics-team-roster">${(entry.team.hitters || []).map(renderPlayer).join("")}</div>
      <h3>投手</h3>
      <div class="statistics-team-roster">${(entry.team.pitchers || []).map(renderPlayer).join("")}</div>
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
