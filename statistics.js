(function () {
  const modeLabels = {
    minor: "職業二軍頻道",
    amateur: "業餘頻道",
    free: "自由頻道"
  };

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
    const highestNickname = highestEntry ? sanitizeNickname(highestEntry.nickname) : "暫無紀錄";
    return `
      <div class="statistics-card">
        <h2>${modeLabels[mode]}</h2>
        <div><span>完成次數</span><strong>${scores.length}</strong></div>
        <div><span>平均分數</span><strong>${average.toFixed(1)}</strong></div>
        <div><span>最高分數</span><strong>${highest.toFixed(1)}</strong></div>
        <div><span>最高分玩家</span><strong>${highestNickname}</strong></div>
        <div><span>最低分數</span><strong>${lowest.toFixed(1)}</strong></div>
      </div>
    `;
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
    } catch (error) {
      container.innerHTML = `<div class="info">統計資料載入失敗：${error.message}</div>`;
    }
  }

  window.openStatistics = open;
  window.BBOStats = { record, getHighestScore, sanitizeNickname };
})();
