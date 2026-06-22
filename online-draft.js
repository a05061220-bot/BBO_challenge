(function () {
  let auth;
  let db;
  let uid;
  const playerId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().replaceAll("-", "")
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let nickname = localStorage.getItem("bbo-online-nickname") || "";
  let mode = "minor";
  let playerRef;
  let queueRef;
  let queueModeRef;
  let matchRef;
  let playerListener;
  let queueListener;
  let matchListener;
  let timer;
  let heartbeatTimer;
  let retryTimer;
  let creatingMatch = false;
  let matching = false;
  let currentMatch;
  let currentRevision = -1;
  let lastFreeSpinNoticeId = null;

  function cleanNickname(value) {
    return String(value || "").replace(/[^\p{L}\p{N}_ -]/gu, "").trim().slice(0, 16);
  }

  async function ensureFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(window.BBOFirebaseConfig);
    auth = firebase.auth();
    db = firebase.database();
    if (!auth.currentUser) await auth.signInAnonymously();
    uid = auth.currentUser.uid;
  }

  function setMatchStatus(message) {
    const status = document.getElementById("onlineDraftMatchStatus");
    if (status) status.textContent = message;
  }

  function localTeamIndex() {
    if (!currentMatch) return -1;
    return currentMatch.player1 === playerId ? 0 : 1;
  }

  function canAct() {
    const state = currentMatch?.state;
    if (!state || state.finished) return false;
    const actor = state.currentPool ? state.picker : state.spinner;
    return actor === localTeamIndex();
  }

  function canEditLineup(teamIndex) {
    const state = currentMatch?.state;
    return Boolean(
      state?.finished &&
      state.lineupDeadline > Date.now() &&
      teamIndex === localTeamIndex() &&
      !state.lineupReady?.[teamIndex]
    );
  }

  function getLineupReadyInfo() {
    const ready = currentMatch?.state?.lineupReady || [false, false];
    const localIndex = localTeamIndex();
    return {
      ready,
      count: ready.filter(Boolean).length,
      localReady: Boolean(ready[localIndex])
    };
  }

  async function open() {
    await leave();
    const entered = prompt("請輸入線上選秀對戰暱稱（最多 16 字）", nickname);
    if (entered === null) return;
    nickname = cleanNickname(entered);
    if (!nickname) return alert("請輸入有效的暱稱");
    localStorage.setItem("bbo-online-nickname", nickname);
    mode = document.getElementById("onlineDraftModeSelect")?.value || "minor";
    document.getElementById("onlineDraftMatchNickname").textContent = nickname;
    document.getElementById("onlineDraftMatchMode").textContent = {
      free: "自由頻道",
      minor: "職業二軍頻道",
      amateur: "業餘頻道"
    }[mode];
    setMatchStatus("正在尋找對手...");
    window.BBOGame.showOnlineDraftMatchView();
    await findOpponent();
  }

  async function findOpponent() {
    try {
      await ensureFirebase();
      matching = true;
      setMatchStatus("正在尋找對手...");
      playerRef = db.ref(`draftPlayers/${playerId}`);
      queueRef = db.ref(`draftQueue/${mode}/${playerId}`);
      await playerRef.onDisconnect().remove();
      await queueRef.onDisconnect().remove();
      listenForAssignment();
      listenForQueue();
      await playerRef.set({
        playerId,
        authUid: uid,
        nickname,
        mode,
        state: "matching",
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      await queueRef.set({ playerId, authUid: uid, createdAt: firebase.database.ServerValue.TIMESTAMP });
      startHeartbeat();
      await tryCreateMatch();
    } catch (error) {
      console.error("選秀對戰配對失敗", error);
      matching = false;
      setMatchStatus(`配對失敗：${error.message}`);
      alert(`選秀對戰配對失敗：${error.message}`);
    }
  }

  async function tryCreateMatch() {
    if (!matching || creatingMatch || matchRef) return;
    creatingMatch = true;
    clearTimeout(retryTimer);
    try {
      const queue = await db.ref(`draftQueue/${mode}`).orderByChild("createdAt").limitToFirst(20).once("value");
      const opponents = [];
      queue.forEach(child => { if (child.key !== playerId) opponents.push(child.key); });
      for (const opponentId of opponents) {
        const pairId = [playerId, opponentId].sort().join("_");
        const lockRef = db.ref(`draftPairLocks/${pairId}`);
        const lock = await lockRef.transaction(current => current || playerId);
        if (!lock.committed || lock.snapshot.val() !== playerId) continue;
        const opponent = (await db.ref(`draftPlayers/${opponentId}`).once("value")).val();
        const opponentExpired = !opponent?.updatedAt || Date.now() - opponent.updatedAt > 60000;
        if (!opponent || opponent.mode !== mode || opponentExpired) {
          await db.ref(`draftQueue/${mode}/${opponentId}`).remove();
          await lockRef.remove();
          continue;
        }
        const ref = db.ref("draftMatches").push();
        const labels = [nickname, opponent.nickname || "匿名玩家"];
        await ref.set({
          player1: playerId,
          player2: opponentId,
          mode,
          labels,
          state: window.BBOGame.createOnlineVersusState(mode, labels),
          revision: 0,
          deadline: Date.now() + 15000
        });
        await db.ref().update({
          [`draftPlayers/${playerId}/matchId`]: ref.key,
          [`draftPlayers/${opponentId}/matchId`]: ref.key,
          [`draftQueue/${mode}/${playerId}`]: null,
          [`draftQueue/${mode}/${opponentId}`]: null,
          [`draftPairLocks/${pairId}`]: null
        });
        queueRef = null;
        matching = false;
        stopMatchmakingTimers();
        return;
      }
      scheduleRetry();
    } catch (error) {
      console.error("選秀對戰配對重試失敗", error);
      setMatchStatus(`配對重試中：${error.message}`);
      scheduleRetry();
    } finally {
      creatingMatch = false;
    }
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    if (matching) retryTimer = setTimeout(() => tryCreateMatch(), 2500);
  }

  function listenForQueue() {
    queueModeRef = db.ref(`draftQueue/${mode}`);
    queueListener = queueModeRef.on("value", snapshot => {
      if (!matching) return;
      const waitingCount = snapshot.numChildren();
      setMatchStatus(`正在尋找對手... 同頻道等待中：${waitingCount} 人`);
      if (waitingCount > 1) tryCreateMatch();
    }, error => setMatchStatus(`無法讀取配對佇列：${error.message}`));
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (matching && playerRef) {
        playerRef.child("updatedAt").set(firebase.database.ServerValue.TIMESTAMP).catch(console.error);
      }
    }, 15000);
  }

  function stopMatchmakingTimers() {
    clearInterval(heartbeatTimer);
    clearTimeout(retryTimer);
    heartbeatTimer = retryTimer = null;
  }

  function listenForAssignment() {
    playerListener = playerRef.on("value", snapshot => {
      const value = snapshot.val();
      if (value?.matchId) joinMatch(value.matchId).catch(console.error);
    });
  }

  async function joinMatch(matchId) {
    if (matchRef?.key === matchId) return;
    matching = false;
    stopMatchmakingTimers();
    if (queueModeRef && queueListener) queueModeRef.off("value", queueListener);
    queueModeRef = null;
    queueListener = null;
    setMatchStatus("配對成功，正在進入選秀...");
    matchRef = db.ref(`draftMatches/${matchId}`);
    await matchRef.onDisconnect().remove();
    matchListener = matchRef.on("value", async snapshot => {
      try {
        const match = snapshot.val();
        if (!match) return;
        currentMatch = match;
        const notice = match.state?.freeSpinNotice;
        if (notice && notice.teamIndex === localTeamIndex() && notice.id !== lastFreeSpinNoticeId) {
          lastFreeSpinNoticeId = notice.id;
          alert("目前選秀名單沒有任何可加入球員，已免費贈送你一次 SPIN 機會！");
        }
        if (match.revision !== currentRevision) {
          currentRevision = match.revision;
          if (currentRevision === 0) window.BBOGame.startOnlineVersusDraft(match.state);
          else window.BBOGame.importOnlineVersusState(match.state);
        }
        if (match.resultHtml) {
          window.BBOGame.renderOnlineDraftSeries(match.resultHtml);
        }
        startTimer();
      } catch (error) {
        console.error("載入線上選秀對戰失敗", error);
        setMatchStatus(`載入對戰失敗：${error.message}`);
      }
    });
  }

  async function stateChanged(state) {
    if (!matchRef || !currentMatch) return;
    const revision = Number(currentMatch.revision || 0) + 1;
    const serializedState = JSON.parse(JSON.stringify(state));
    currentMatch.state = serializedState;
    currentMatch.revision = revision;
    currentMatch.deadline = Date.now() + 15000;
    await matchRef.update({
      state: serializedState,
      revision,
      deadline: currentMatch.deadline,
      autoLock: null
    });
  }

  async function markLineupReady() {
    if (!matchRef || !currentMatch?.state?.finished) return;
    const teamIndex = localTeamIndex();
    if (teamIndex < 0 || currentMatch.state.lineupDeadline <= Date.now()) return;
    if (currentMatch.state.lineupReady?.[teamIndex]) return;
    await matchRef.transaction(match => {
      if (!match?.state?.finished || match.resultHtml) return match;
      if (match.state.lineupDeadline <= Date.now()) return match;
      const ready = [0, 1].map(index => Boolean(match.state.lineupReady?.[index]));
      ready[teamIndex] = true;
      match.state.lineupReady = ready;
      match.revision = Number(match.revision || 0) + 1;
      return match;
    });
  }

  async function createResultIfNeeded() {
    if (!currentMatch || currentMatch.player1 !== playerId || currentMatch.resultHtml) return;
    const resultLock = await matchRef.child("resultLock").transaction(value => value || playerId);
    if (!resultLock.committed || resultLock.snapshot.val() !== playerId) return;
    try {
      const resultHtml = window.BBOGame.simulateOnlineDraftSeriesNow();
      if (!resultHtml) throw new Error("對戰結果產生失敗");
      await matchRef.child("resultHtml").set(resultHtml);
    } catch (error) {
      console.error("產生線上選秀對戰結果失敗", error);
      await matchRef.child("resultLock").remove();
      setMatchStatus(`產生結果失敗：${error.message}`);
    }
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!currentMatch?.state) return clearInterval(timer);
      if (currentMatch.state.finished) {
        const status = document.getElementById("versusStatus");
        if (currentMatch.resultHtml) {
          status.classList.remove("lineup-adjustment-active");
          status.textContent = "線上選秀對戰完成";
          return clearInterval(timer);
        }
        const ready = currentMatch.state.lineupReady || [false, false];
        const readyCount = ready.filter(Boolean).length;
        const bothReady = readyCount >= 2;
        const seconds = Math.max(0, Math.ceil((currentMatch.state.lineupDeadline - Date.now()) / 1000));
        status.classList.toggle("lineup-adjustment-active", seconds > 0 && !bothReady);
        if (seconds > 0 && !bothReady) {
          status.textContent =
            `請調整你的棒次｜剩餘 ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}｜準備 ${readyCount}/2`;
        } else if (bothReady) {
          status.textContent = "雙方已準備完成，正在產生對戰結果...";
        } else {
          status.textContent = "棒次調整時間結束，正在產生對戰結果...";
        }
        if (seconds > 0 && !bothReady) return;
        clearInterval(timer);
        await createResultIfNeeded();
        return;
      }
      const seconds = Math.max(0, Math.ceil((currentMatch.deadline - Date.now()) / 1000));
      const actor = currentMatch.state.currentPool ? currentMatch.state.picker : currentMatch.state.spinner;
      const action = currentMatch.state.currentPool ? "選擇球員" : "按下 SPIN";
      document.getElementById("versusStatus").textContent =
        `${currentMatch.labels[actor]} ${action}｜剩餘 ${seconds} 秒${canAct() ? "（你的回合）" : ""}`;
      if (seconds > 0) return;
      clearInterval(timer);
      const lock = await matchRef.child("autoLock").transaction(value =>
        value?.revision === currentMatch.revision ? undefined : { revision: currentMatch.revision, playerId }
      );
      if (lock.committed) window.BBOGame.autoOnlineVersusAction();
    }, 250);
  }

  async function leave() {
    clearInterval(timer);
    matching = false;
    creatingMatch = false;
    stopMatchmakingTimers();
    if (playerRef && playerListener) playerRef.off("value", playerListener);
    if (queueModeRef && queueListener) queueModeRef.off("value", queueListener);
    if (matchRef && matchListener) matchRef.off("value", matchListener);
    await Promise.all([
      queueRef?.remove().catch(() => {}),
      playerRef?.remove().catch(() => {}),
      matchRef?.remove().catch(() => {})
    ]);
    queueRef = playerRef = matchRef = null;
    queueModeRef = null;
    queueListener = null;
    currentMatch = null;
    currentRevision = -1;
    lastFreeSpinNoticeId = null;
  }

  async function cancel() {
    await leave();
    window.showHome();
  }

  async function searchAgain() {
    await leave();
    await findOpponent();
  }

  window.openOnlineDraftMode = open;
  window.searchAgainOnlineDraft = searchAgain;
  window.cancelOnlineDraftMatch = cancel;
  window.BBOOnlineDraft = { canAct, canEditLineup, getLineupReadyInfo, markLineupReady, stateChanged, leave };
})();
