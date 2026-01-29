// Force desktop detection for mobile/browser spoof
window.DiscordNative = window.DiscordNative || {};

// Delete any conflicting globals
delete window.$;

let wpRequire;
try {
  wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
  webpackChunkdiscord_app.pop();
} catch (e) {
  console.error("Webpack chunk push failed:", e);
  return;
}

let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z;
let RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api;

if (!ApplicationStreamingStore) {
  ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
  RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
  QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
  ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
  GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
  FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
  api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;
} else {
  RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getRunningGames)?.exports?.ZP;
  QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getQuest)?.exports?.Z;
  ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z;
  GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getSFWDefaultChannel)?.exports?.ZP;
  FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z;
  api = Object.values(wpRequire.c).find(x => x?.exports?.tn?.get)?.exports?.tn;
}

if (!RunningGameStore || !QuestsStore || !FluxDispatcher || !api) {
  console.error("Failed to find required stores/modules. Discord update likely broke finders.");
  console.log("RunningGameStore:", !!RunningGameStore);
  console.log("QuestsStore:", !!QuestsStore);
  return;
}

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
let quests = [...QuestsStore.quests.values()].filter(x => 
  x.userStatus?.enrolledAt && 
  !x.userStatus?.completedAt && 
  new Date(x.config.expiresAt).getTime() > Date.now() && 
  supportedTasks.some(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
);

if (quests.length === 0) {
  console.log("No eligible uncompleted quests found!");
  return;
}

let isApp = typeof DiscordNative !== "undefined"; // Now forced true

let doJob = function () {
  const quest = quests.pop();
  if (!quest) return;

  const pid = Math.floor(Math.random() * 30000) + 1000;
  const applicationId = quest.config.application.id;
  const applicationName = quest.config.application.name;
  const questName = quest.config.messages.questName;
  const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
  const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
  const secondsNeeded = taskConfig.tasks[taskName].target;
  let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

  if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
    // Video logic unchanged - works fine on mobile
    const maxFuture = 10, speed = 7, interval = 1;
    const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
    let completed = false;
    let fn = async () => {
      while (true) {
        const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
        const diff = maxAllowed - secondsDone;
        const timestamp = secondsDone + speed;
        if (diff >= speed) {
          try {
            const res = await api.post({
              url: `/quests/${quest.id}/video-progress`,
              body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
            });
            completed = res.body.completed_at != null;
            secondsDone = Math.min(secondsNeeded, timestamp);
          } catch (e) { console.error("Video progress error:", e); }
        }
        if (timestamp >= secondsNeeded) break;
        await new Promise(r => setTimeout(r, interval * 1000));
      }
      if (!completed) {
        await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
      }
      console.log(`Video quest ${questName} completed!`);
      doJob();
    };
    fn();
    console.log(`Spoofing video for ${questName}.`);
  } else if (taskName === "PLAY_ON_DESKTOP") {
    // Forced execution even on "browser"
    try {
      const res = await api.get({ url: `/applications/public?application_ids=${applicationId}` });
      const appData = res.body[0];
      if (!appData) throw new Error("No app data");

      const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") || "unknown.exe";
      const fakeGame = {
        cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
        exeName,
        exePath: `c:/program files/\( {appData.name.toLowerCase()}/ \){exeName}`,
        hidden: false,
        isLauncher: false,
        id: applicationId,
        name: appData.name,
        pid: pid,
        pidPath: [pid],
        processName: appData.name,
        start: Date.now(),
      };

      const realGames = RunningGameStore.getRunningGames ? RunningGameStore.getRunningGames() : [];
      const fakeGames = [fakeGame];

      const realGetRunningGames = RunningGameStore.getRunningGames;
      const realGetGameForPID = RunningGameStore.getGameForPID;

      RunningGameStore.getRunningGames = () => fakeGames;
      RunningGameStore.getGameForPID = (p) => fakeGames.find(x => x.pid === p);

      FluxDispatcher.dispatch({
        type: "RUNNING_GAMES_CHANGE",
        removed: realGames,
        added: [fakeGame],
        games: fakeGames
      });

      let fn = data => {
        let progress = quest.config.configVersion === 1 
          ? data.userStatus.streamProgressSeconds 
          : Math.floor(data.userStatus.progress?.PLAY_ON_DESKTOP?.value || 0);
        console.log(`PLAY_ON_DESKTOP progress: \( {progress}/ \){secondsNeeded} for ${questName}`);
        if (progress >= secondsNeeded) {
          console.log(`PLAY_ON_DESKTOP quest ${questName} completed!`);
          // Restore originals
          RunningGameStore.getRunningGames = realGetRunningGames;
          RunningGameStore.getGameForPID = realGetGameForPID;
          FluxDispatcher.dispatch({
            type: "RUNNING_GAMES_CHANGE",
            removed: [fakeGame],
            added: [],
            games: []
          });
          FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
          doJob();
        }
      };

      FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
      console.log(`Spoofed game as ${applicationName} (PID \( {pid}). Monitor progress in console. Wait ~ \){Math.ceil((secondsNeeded - secondsDone) / 60)} min.`);
    } catch (e) {
      console.error("PLAY_ON_DESKTOP spoof failed:", e);
      console.log("Likely server ignored due to web client detection. Try desktop app if no progress after 5-10 min.");
    }
  } else if (taskName === "STREAM_ON_DESKTOP") {
    // Similar force for stream (if needed)
    try {
      let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
      ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });

      let fn = data => {
        let progress = quest.config.configVersion === 1 
          ? data.userStatus.streamProgressSeconds 
          : Math.floor(data.userStatus.progress?.STREAM_ON_DESKTOP?.value || 0);
        console.log(`STREAM_ON_DESKTOP progress: \( {progress}/ \){secondsNeeded}`);
        if (progress >= secondsNeeded) {
          console.log(`Stream quest completed!`);
          ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
          FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
          doJob();
        }
      };
      FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
      console.log(`Spoofed stream for ${applicationName}. Join VC & stream window if required.`);
    } catch (e) {
      console.error("STREAM_ON_DESKTOP failed:", e);
    }
  } else if (taskName === "PLAY_ACTIVITY") {
    // Unchanged, works if in VC
    const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? /* fallback logic */;
    const streamKey = `call:${channelId}:1`;
    let fn = async () => {
      while (true) {
        try {
          const res = await api.post({
            url: `/quests/${quest.id}/heartbeat`,
            body: { stream_key: streamKey, terminal: false }
          });
          const progress = res.body.progress?.PLAY_ACTIVITY?.value || 0;
          console.log(`PLAY_ACTIVITY progress: \( {progress}/ \){secondsNeeded}`);
          if (progress >= secondsNeeded) {
            await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
            console.log("Activity quest completed!");
            break;
          }
        } catch (e) { console.error("Heartbeat error:", e); }
        await new Promise(r => setTimeout(r, 20000));
      }
      doJob();
    };
    fn();
  }
};

doJob();
