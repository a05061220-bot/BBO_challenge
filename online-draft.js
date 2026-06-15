(function () {
  let auth;
  let db;
  let uid;
  let nickname = localStorage.getItem("bbo-online-nickname") || "";
  let mode = "free";
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
    return currentMatch.player1 === uid ? 0 : 1;
  }

  function canAct() {
    const state = currentMatch?.state;
    if (!state || state.finished) return false;
    const actor = state.currentPool ? state.picker : state.spinner;
    return actor === localTeamIndex();
  }

  async function open() {
    await leave();
    const entered = prompt("請輸入線上選秀對戰暱稱（最多 16 字）", nickname);
    if (entered === null) return;
    nickname = cleanNickname(entered);
    if (!nickname) return alert("請輸入有效的暱稱");
    localStorage.setItem("bbo-online-nickname", nickname);
    mode = document.getElementById("onlineDraftModeSelect")?.value || "free";
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
      playerRef = db.ref(`draftPlayers/${uid}`);
      queueRef = db.ref(`draftQueue/${mode}/${uid}`);
      await playerRef.onDisconnect().remove();
      await queueRef.onDisconnect().remove();
      listenForAssignment();
      listenForQueue();
      await playerRef.set({
        uid,
        nickname,
        mode,
        state: "matching",
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      await queueRef.set({ uid, createdAt: firebase.database.ServerValue.TIMESTAMP });
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
      queue.forEach(child => { if (child.key !== uid) opponents.push(child.key); });
      for (const opponentUid of opponents) {
        const pairId = [uid, opponentUid].sort().join("_");
        const lockRef = db.ref(`draftPairLocks/${pairId}`);
        const lock = await lockRef.transaction(current => current || uid);
        if (!lock.committed || lock.snapshot.val() !== uid) continue;
        const opponent = (await db.ref(`draftPlayers/${opponentUid}`).once("value")).val();
        const opponentExpired = !opponent?.updatedAt || Date.now() - opponent.updatedAt > 60000;
        if (!opponent || opponent.mode !== mode || opponentExpired) {
          await db.ref(`draftQueue/${mode}/${opponentUid}`).remove();
          await lockRef.remove();
          continue;
        }
        const ref = db.ref("draftMatches").push();
        const labels = [nickname, opponent.nickname || "匿名玩家"];
        await ref.set({
          player1: uid,
          player2: opponentUid,
          mode,
          labels,
          state: window.BBOGame.createOnlineVersusState(mode, labels),
          revision: 0,
          deadline: Date.now() + 15000
        });
        await db.ref().update({
          [`draftPlayers/${uid}/matchId`]: ref.key,
          [`draftPlayers/${opponentUid}/matchId`]: ref.key,
          [`draftQueue/${mode}/${uid}`]: null,
          [`draftQueue/${mode}/${opponentUid}`]: null,
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
      } else if (match.state.finished && match.player1 === uid) {
        const resultHtml = window.BBOGame.simulateOnlineSeries();
        await matchRef.child("resultHtml").set(resultHtml);
      }
      startTimer();
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

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!currentMatch?.state || currentMatch.state.finished) return clearInterval(timer);
      const seconds = Math.max(0, Math.ceil((currentMatch.deadline - Date.now()) / 1000));
      const actor = currentMatch.state.currentPool ? currentMatch.state.picker : currentMatch.state.spinner;
      const action = currentMatch.state.currentPool ? "選擇球員" : "按下 SPIN";
      document.getElementById("versusStatus").textContent =
        `${currentMatch.labels[actor]} ${action}｜剩餘 ${seconds} 秒${canAct() ? "（你的回合）" : ""}`;
      if (seconds > 0) return;
      clearInterval(timer);
      const lock = await matchRef.child("autoLock").transaction(value =>
        value?.revision === currentMatch.revision ? undefined : { revision: currentMatch.revision, uid }
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
  window.BBOOnlineDraft = { canAct, stateChanged, leave };
})();
