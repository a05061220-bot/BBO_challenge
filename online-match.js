(function () {
  let auth;
  let database;
  let uid;
  let queueRef;
  let playerRef;
  let matchRef;
  let playerListener;
  let matchListener;
  let matching = false;
  let nickname = localStorage.getItem("bbo-online-nickname") || "";

  function cleanNickname(value) {
    return String(value || "")
      .replace(/[^\p{L}\p{N}_ -]/gu, "")
      .trim()
      .slice(0, 16);
  }

  function configured() {
    const config = window.BBOFirebaseConfig || {};
    return Boolean(config.apiKey && config.databaseURL && config.projectId && config.appId);
  }

  function setStatus(message) {
    const status = document.getElementById("onlineMatchStatus");
    if (status) status.textContent = message;
  }

  function setMatchingUi(isMatching) {
    matching = isMatching;
    document.getElementById("onlineMatchButton").hidden = isMatching;
    document.getElementById("onlineCancelButton").hidden = !isMatching;
  }

  async function ensureFirebase() {
    if (!configured()) {
      throw new Error("尚未設定 Firebase，請先填寫 firebase-config.js");
    }
    if (!window.firebase) {
      throw new Error("Firebase SDK 載入失敗，請檢查網路連線");
    }
    if (!firebase.apps.length) firebase.initializeApp(window.BBOFirebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    if (!auth.currentUser) await auth.signInAnonymously();
    uid = auth.currentUser.uid;
    return uid;
  }

  async function openOnlineMode() {
    await window.BBOOnlineMatch.leave();
    const enteredNickname = prompt("請輸入連線對戰暱稱（最多 16 字）", nickname);
    if (enteredNickname === null) return;
    nickname = cleanNickname(enteredNickname);
    if (!nickname) {
      alert("請輸入有效的暱稱");
      return;
    }
    localStorage.setItem("bbo-online-nickname", nickname);
    const mode = document.getElementById("onlineModeSelect")?.value || "minor";
    window.BBOGame.startOnlineDraft(mode);
    setStatus(`${nickname}｜${{ free: "自由", minor: "職業二軍", amateur: "業餘" }[mode]}頻道：完成選秀後即可尋找對手`);
  }

  async function findOnlineOpponent() {
    if (matching) return;
    const snapshot = window.BBOGame.getOnlineDraftSnapshot();
    if (!snapshot) {
      alert("請先完成 16 人選秀");
      return;
    }

    try {
      await ensureFirebase();
      setMatchingUi(true);
      setStatus("正在尋找對手...");
      playerRef = database.ref(`onlinePlayers/${uid}`);
      queueRef = database.ref(`matchQueue/${snapshot.mode}/${uid}`);
      await playerRef.onDisconnect().remove();
      await queueRef.onDisconnect().remove();
      await playerRef.set({ uid, nickname, mode: snapshot.mode, team: snapshot.team, state: "matching" });
      await queueRef.set({ uid, createdAt: firebase.database.ServerValue.TIMESTAMP });
      listenForAssignment();
      await tryCreateMatch(snapshot.mode, snapshot.team);
    } catch (error) {
      console.error("連線配對失敗", error);
      setMatchingUi(false);
      setStatus(error.message);
      alert(`連線配對失敗：${error.message}`);
    }
  }

  async function tryCreateMatch(mode, localTeam) {
    const queue = await database.ref(`matchQueue/${mode}`).orderByChild("createdAt").limitToFirst(20).once("value");
    const opponents = [];
    queue.forEach(child => {
      if (child.key !== uid) opponents.push(child.key);
    });
    for (const opponentUid of opponents) {
      const pairId = [uid, opponentUid].sort().join("_");
      const lockRef = database.ref(`pairLocks/${pairId}`);
      const lock = await lockRef.transaction(current => current || uid);
      if (!lock.committed || lock.snapshot.val() !== uid) continue;
      await lockRef.onDisconnect().remove();

      const opponent = (await database.ref(`onlinePlayers/${opponentUid}`).once("value")).val();
      if (!opponent?.team || opponent.mode !== mode) {
        await lockRef.remove();
        continue;
      }

      const newMatchRef = database.ref("matches").push();
      const match = {
        player1: uid,
        player2: opponentUid,
        nickname1: nickname,
        nickname2: opponent.nickname || "匿名玩家",
        mode,
        team1: localTeam,
        team2: opponent.team,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      await newMatchRef.set(match);
      await newMatchRef.onDisconnect().remove();
      await database.ref().update({
        [`onlinePlayers/${uid}/matchId`]: newMatchRef.key,
        [`onlinePlayers/${opponentUid}/matchId`]: newMatchRef.key,
        [`matchQueue/${mode}/${uid}`]: null,
        [`matchQueue/${mode}/${opponentUid}`]: null,
        [`pairLocks/${pairId}`]: null
      });
      return;
    }

    setTimeout(() => {
      if (matching) tryCreateMatch(mode, localTeam).catch(console.error);
    }, 2500);
  }

  function listenForAssignment() {
    if (playerListener) playerRef.off("value", playerListener);
    playerListener = playerRef.on("value", snapshot => {
      const player = snapshot.val();
      if (player?.matchId) joinMatch(player.matchId).catch(console.error);
    });
  }

  async function joinMatch(matchId) {
    if (matchRef?.key === matchId) return;
    matchRef = database.ref(`matches/${matchId}`);
    await matchRef.onDisconnect().remove();
    setMatchingUi(false);
    setStatus("配對成功，正在建立比賽...");

    if (matchListener) matchRef.off("value", matchListener);
    matchListener = matchRef.on("value", async snapshot => {
      const match = snapshot.val();
      if (!match) {
        setStatus("對手已離線，配對資料已清除");
        return;
      }
      const localIsPlayer1 = match.player1 === uid;
      const localNickname = localIsPlayer1 ? match.nickname1 : match.nickname2;
      const opponentNickname = localIsPlayer1 ? match.nickname2 : match.nickname1;
      window.BBOGame.showOnlineMatchup(
        localIsPlayer1 ? match.team1 : match.team2,
        localIsPlayer1 ? match.team2 : match.team1,
        localIsPlayer1,
        match.mode,
        localNickname || nickname,
        opponentNickname || "匿名玩家"
      );
      if (match.resultHtml) {
        window.BBOGame.renderOnlineSeries(match.resultHtml);
      } else if (localIsPlayer1) {
        const resultHtml = window.BBOGame.simulateOnlineSeries();
        await matchRef.child("resultHtml").set(resultHtml);
      }
    });
  }

  async function cancelOnlineMatch() {
    matching = false;
    setMatchingUi(false);
    setStatus("已取消匹配");
    if (queueRef) await queueRef.remove().catch(() => {});
    if (playerRef) await playerRef.remove().catch(() => {});
  }

  async function searchAgainOnline() {
    await leave();
    await findOnlineOpponent();
  }

  async function leave() {
    matching = false;
    if (playerRef && playerListener) playerRef.off("value", playerListener);
    if (matchRef && matchListener) matchRef.off("value", matchListener);
    await Promise.all([
      queueRef?.remove().catch(() => {}),
      playerRef?.remove().catch(() => {}),
      matchRef?.remove().catch(() => {})
    ]);
    queueRef = null;
    playerRef = null;
    matchRef = null;
    playerListener = null;
    matchListener = null;
  }

  window.openOnlineMode = openOnlineMode;
  window.findOnlineOpponent = findOnlineOpponent;
  window.cancelOnlineMatch = cancelOnlineMatch;
  window.searchAgainOnline = searchAgainOnline;
  window.BBOOnlineMatch = { leave };
})();
