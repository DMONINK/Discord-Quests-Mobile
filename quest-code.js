// Updated Quest automation for 2025 - multi-quest support + browser warnings
(function() {
  'use strict';

  function waitForWebpack(callback, maxAttempts = 100, attempt = 0) {
    if (attempt >= maxAttempts) {
      console.error('Failed to load webpack after', maxAttempts, 'attempts');
      return;
    }

    if (typeof window.webpackChunkdiscord_app === 'undefined') {
      setTimeout(() => waitForWebpack(callback, maxAttempts, attempt + 1), 100);
      return;
    }

    let wpRequire;
    try {
      delete window.$;
      wpRequire = window.webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
      window.webpackChunkdiscord_app.pop();
      
      if (!wpRequire || !wpRequire.c || Object.keys(wpRequire.c).length === 0) {
        setTimeout(() => waitForWebpack(callback, maxAttempts, attempt + 1), 100);
        return;
      }
      
      const moduleCount = Object.keys(wpRequire.c).length;
      if (moduleCount < 10) {
        setTimeout(() => waitForWebpack(callback, maxAttempts, attempt + 1), 100);
        return;
      }
      
      console.log(`Webpack loaded with ${moduleCount} modules`);
    } catch (error) {
      console.error('Error accessing webpack:', error);
      setTimeout(() => waitForWebpack(callback, maxAttempts, attempt + 1), 100);
      return;
    }

    callback(wpRequire);
  }

  function runQuestCode(wpRequire) {
    try {
      const userAgent = navigator.userAgent;
      console.log('Current User-Agent:', userAgent);
      const hasElectron = userAgent.includes("Electron/");
      if (!hasElectron) {
        console.warn('User-Agent does not contain "Electron/". Non-video quests likely won\'t work in browser.');
      } else {
        console.log('User-Agent override detected (Electron/) - might help with some quests');
      }

      let ApplicationStreamingStore, RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api;

      try {
        console.log('Loading Discord stores...');
        
        ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z;
        if (!ApplicationStreamingStore) throw new Error('Could not find ApplicationStreamingStore');
        
        RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getRunningGames)?.exports?.ZP;
        if (!RunningGameStore) throw new Error('Could not find RunningGameStore');
        
        QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getQuest)?.exports?.Z;
        if (!QuestsStore) throw new Error('Could not find QuestsStore');
        
        ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z;
        if (!ChannelStore) throw new Error('Could not find ChannelStore');
        
        GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getSFWDefaultChannel)?.exports?.ZP;
        if (!GuildChannelStore) throw new Error('Could not find GuildChannelStore');
        
        FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z;
        if (!FluxDispatcher) throw new Error('Could not find FluxDispatcher');
        
        api = Object.values(wpRequire.c).find(x => x?.exports?.tn?.get)?.exports?.tn;
        if (!api) throw new Error('Could not find API');
        
        console.log('All Discord stores loaded successfully');
      } catch (error) {
        console.error('Error loading Discord stores:', error);
        console.log('Wait for Discord to fully load and try again.');
        return;
      }

      const isApp = typeof window.DiscordNative !== "undefined";
      if (!isApp) {
        console.warn('Running in browser. Non-video quests (play/stream) no longer work reliably here - use desktop app for those.');
      }

      const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

      let quests = [...QuestsStore.quests.values()]
        .filter(x => 
          x.userStatus?.enrolledAt && 
          !x.userStatus?.completedAt && 
          new Date(x.config.expiresAt).getTime() > Date.now() &&
          supportedTasks.some(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
        );

      if (quests.length === 0) {
        console.log("No eligible uncompleted quests found. Accept some first, slut.");
        return;
      }

      console.log(`Found ${quests.length} quest(s) to rape. Starting...`);

      function doJob() {
        const quest = quests.pop();
        if (!quest) {
          console.log("All quests completed. Go claim your dirty rewards.");
          return;
        }

        const pid = Math.floor(Math.random() * 30000) + 1000;
        const applicationId = quest.config.application?.id;
        const applicationName = quest.config.application?.name || "Unknown Game";
        const questName = quest.config.messages.questName;
        const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
        const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
        const secondsNeeded = taskConfig.tasks[taskName].target;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        console.log(`Starting on: \( {questName} ( \){taskName}) - Need ${secondsNeeded} seconds`);

        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
          const maxFuture = 10, speed = 7, interval = 1;
          const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
          let completed = false;

          (async () => {
            while (true) {
              const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
              const diff = maxAllowed - secondsDone;
              const timestamp = secondsDone + speed;

              if (diff >= speed) {
                const res = await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: Math.min(secondsNeeded, timestamp + Math.random())}});
                completed = res.body.completed_at != null;
                secondsDone = Math.min(secondsNeeded, timestamp);
              }

              if (timestamp >= secondsNeeded) break;
              await new Promise(resolve => setTimeout(resolve, interval * 1000));
            }

            if (!completed) {
              await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: secondsNeeded}});
            }

            console.log(`${questName} video quest completed!`);
            doJob();
          })();

          console.log(`Spoofing video watch for ${questName}...`);

        } else if (taskName === "PLAY_ON_DESKTOP") {
          if (!isApp && !hasElectron) {
            console.warn(`Skipping ${questName} - PLAY_ON_DESKTOP no longer works in browser. Use desktop app.`);
            doJob();
            return;
          }

          api.get({url: `/applications/public?application_ids=${applicationId}`}).then(res => {
            const appData = res.body[0];
            if (!appData?.executables) {
              console.error("Failed to get app executables");
              doJob();
              return;
            }

            const exeName = appData.executables.find(x => x.os === "win32")?.name?.replace(">", "") || "app.exe";

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

            const realGames = RunningGameStore.getRunningGames();
            const fakeGames = [fakeGame];
            const realGetRunningGames = RunningGameStore.getRunningGames;
            const realGetGameForPID = RunningGameStore.getGameForPID;

            RunningGameStore.getRunningGames = () => fakeGames;
            RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid);
            FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames});

            const unsubscribe = (data) => {
              let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
              console.log(`${questName} progress: \( {progress}/ \){secondsNeeded}`);

              if (progress >= secondsNeeded) {
                console.log(`${questName} completed!`);
                RunningGameStore.getRunningGames = realGetRunningGames;
                RunningGameStore.getGameForPID = realGetGameForPID;
                FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: []});
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", unsubscribe);
                doJob();
              }
            };

            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", unsubscribe);
            console.log(`Spoofed running \( {applicationName}. Wait ~ \){Math.ceil((secondsNeeded - secondsDone) / 60)} mins.`);
          }).catch(err => {
            console.error("Error spoofing game:", err);
            doJob();
          });

        } else if (taskName === "STREAM_ON_DESKTOP") {
          if (!isApp && !hasElectron) {
            console.warn(`Skipping ${questName} - STREAM_ON_DESKTOP no longer works in browser. Use desktop app.`);
            doJob();
            return;
          }

          const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
          ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
            id: applicationId,
            pid,
            sourceName: null
          });

          const unsubscribe = (data) => {
            let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
            console.log(`${questName} progress: \( {progress}/ \){secondsNeeded}`);

            if (progress >= secondsNeeded) {
              console.log(`${questName} completed!`);
              ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
              FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", unsubscribe);
              doJob();
            }
          };

          FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", unsubscribe);
          console.log(`Spoofed streaming \( {applicationName}. Stream something in VC for ~ \){Math.ceil((secondsNeeded - secondsDone) / 60)} mins (need 1+ viewer).`);

        } else if (taskName === "PLAY_ACTIVITY") {
          const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id || Object.values(GuildChannelStore.getAllGuilds()).find(g => g?.VOCAL?.length > 0)?.VOCAL[0]?.channel?.id;
          if (!channelId) {
            console.error("No suitable channel found for activity");
            doJob();
            return;
          }
          const streamKey = `call:${channelId}:1`;

          (async () => {
            while (true) {
              const res = await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: false}});
              const progress = res.body.progress.PLAY_ACTIVITY.value;
              console.log(`${questName} progress: \( {progress}/ \){secondsNeeded}`);

              await new Promise(resolve => setTimeout(resolve, 20000));

              if (progress >= secondsNeeded) {
                await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: true}});
                console.log(`${questName} completed!`);
                doJob();
                break;
              }
            }
          })();
        }
      }

      doJob();

    } catch (error) {
      console.error('Fatal error in quest code:', error);
    }
  }

  waitForWebpack(runQuestCode);
})();
