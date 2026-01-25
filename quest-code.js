(function() {
  'use strict';

  function waitForWebpack(callback, attempts = 0) {
    if (attempts > 100) return console.error('Webpack timeout... reload page~');
    if (window.webpackChunkdiscord_app) {
      let req;
      window.webpackChunkdiscord_app.push([[Math.random()], {}, r => req = r]);
      window.webpackChunkdiscord_app.pop();
      callback(req);
    } else setTimeout(() => waitForWebpack(callback, attempts + 1), 200);
  }

  waitForWebpack(wpRequire => {
    const find = filter => {
      for (let k in wpRequire.c) {
        let m = wpRequire.c[k]?.exports;
        if (m && (filter(m) || filter(m?.default))) return m?.default || m;
      }
      return null;
    };

    let ApplicationStreamingStore = find(m => m?.getStreamerActiveStreamMetadata);
    let RunningGameStore = find(m => m?.getRunningGames);
    let QuestsStore = find(m => m?.getQuest);
    let FluxDispatcher = find(m => m?.flushWaitQueue);
    let api = find(m => m?.post && m?.get)?.default || find(m => m?.Bo?.get)?.Bo;

    if (!QuestsStore || !api) return console.error('Modules missing... try again later ♡');

    const supported = ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY"];
    let quests = [...QuestsStore.quests.values()].filter(q => 
      q.userStatus?.enrolledAt && !q.userStatus?.completedAt &&
      new Date(q.config.expiresAt) > new Date() &&
      supported.some(t => (q.config.taskConfig ?? q.config.taskConfigV2)?.tasks?.[t])
    );

    if (!quests.length) return console.log("No quests ready... accept some first~");

    console.log(`Found ${quests.length} quest(s)! Going one by one...`);

    let isApp = typeof DiscordNative !== "undefined";

    function nextQuest() {
      let quest = quests.shift();
      if (!quest) return console.log("All done! Claim your cute rewards sweetie 💕");

      let appId = quest.config.application?.id;
      let appName = quest.config.application?.name || "App";
      let qName = quest.config.messages.questName;
      let cfg = quest.config.taskConfig ?? quest.config.taskConfigV2;
      let task = supported.find(t => cfg.tasks[t]);
      let need = cfg.tasks[task].target;
      let done = quest.userStatus.progress?.[task]?.value ?? 0;

      console.log(`Working on \( {qName} ( \){task}) - \( {done}/ \){need}s`);

      if (task.includes("VIDEO")) {
        let enrolled = new Date(quest.userStatus.enrolledAt).getTime();
        let comp = false;
        let ts = done;

        (async () => {
          while (ts < need) {
            ts += 7 + Math.random() * 2;
            ts = Math.min(need, ts);
            let res = await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: ts}});
            comp = res.body.completed_at != null;
            await new Promise(r => setTimeout(r, 1200));
          }
          if (!comp) await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: need}});
          console.log(`${qName} finished!`);
          nextQuest();
        })();
        console.log(`Faking video for ${qName}...`);

      } else if (task === "PLAY_ON_DESKTOP") {
        if (!isApp) {
          console.warn(`Skipping ${qName} - PLAY_ON_DESKTOP doesn't work in browser/Kiwi anymore! Use desktop app please~`);
          nextQuest();
          return;
        }
        // Spoof attempt (only if somehow isApp true - rare in Kiwi)
        api.get({url: `/applications/public?application_ids=${appId}`}).then(res => {
          let appData = res.body[0];
          if (!appData?.executables) { console.error("No exe data"); nextQuest(); return; }
          let exe = appData.executables.find(x => x.os === "win32")?.name?.replace(">","") || "game.exe";

          let pid = Math.floor(Math.random() * 30000) + 1000;
          let fakeGame = {
            cmdLine: `C:\\Program Files\\${appData.name}\\${exe}`,
            exeName: exe,
            exePath: `c:/program files/\( {appData.name.toLowerCase()}/ \){exe}`,
            hidden: false,
            isLauncher: false,
            id: appId,
            name: appData.name,
            pid,
            pidPath: [pid],
            processName: appData.name,
            start: Date.now()
          };

          let realGames = RunningGameStore.getRunningGames();
          let fakeGames = [fakeGame];
          let realGet = RunningGameStore.getRunningGames;
          let realPID = RunningGameStore.getGameForPID;

          RunningGameStore.getRunningGames = () => fakeGames;
          RunningGameStore.getGameForPID = p => fakeGames.find(g => g.pid === p);
          FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: fakeGames, games: fakeGames});

          let check = data => {
            let prog = Math.floor(data.userStatus.progress?.PLAY_ON_DESKTOP?.value || 0);
            console.log(`${qName} progress: \( {prog}/ \){need}`);
            if (prog >= need) {
              console.log(`${qName} done!`);
              RunningGameStore.getRunningGames = realGet;
              RunningGameStore.getGameForPID = realPID;
              FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: fakeGames, added: [], games: []});
              FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", check);
              nextQuest();
            }
          };
          FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", check);
          console.log(`Spoofing \( {appName} run... wait ~ \){Math.ceil((need - done)/60)} min if it works`);
        }).catch(e => { console.error("Spoof fail:", e); nextQuest(); });

      } else {
        console.warn(`Skipping ${qName} - ${task} needs desktop app!`);
        nextQuest();
      }
    }

    nextQuest();
  });
})();
