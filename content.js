(function () {
  'use strict';

  /**********************
   * DESKTOP SPOOF LAYER
   **********************/
  if (!window.DiscordNative) {
    window.DiscordNative = {
      isDesktop: true,
      platform: "win32",
      getVersion: () => "1.0.9005",
      app: {
        getReleaseChannel: () => "stable"
      }
    };
  }

  Object.defineProperty(navigator, "userAgent", {
    get: () =>
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
  });

  Object.defineProperty(navigator, "platform", {
    get: () => "Win32"
  });

  /**********************
   * UI BUTTON
   **********************/
  const waitForBody = setInterval(() => {
    if (document.body) {
      clearInterval(waitForBody);
      createRunButton();
    }
  }, 500);

  function createRunButton() {
    if (document.getElementById("runDiscordQuestBtn")) return;

    const btn = document.createElement("div");
    btn.id = "runDiscordQuestBtn";
    btn.textContent = "Run Quests";

    Object.assign(btn.style, {
      position: "fixed",
      bottom: "18px",
      right: "18px",
      zIndex: 999999,
      padding: "10px 16px",
      background: "#5865F2",
      color: "#fff",
      fontWeight: "600",
      borderRadius: "8px",
      fontSize: "14px",
      boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
    });

    btn.onclick = () => {
      btn.textContent = "Running…";
      btn.style.pointerEvents = "none";
      runQuestScript();
      setTimeout(() => {
        btn.textContent = "Run Quests";
        btn.style.pointerEvents = "auto";
      }, 3000);
    };

    document.body.appendChild(btn);
  }

  /**********************
   * QUEST SCRIPT
   **********************/
  function runQuestScript() {
    try {
      delete window.$;

      let wpRequire;
      try {
        wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
      } catch (e) {
        console.error("Webpack not ready");
        return;
      }

      let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z;
      let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getRunningGames)?.exports?.ZP;
      let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getQuest)?.exports?.Z;
      let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z;
      let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.ZP?.getSFWDefaultChannel)?.exports?.ZP;
      let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z;
      let api = Object.values(wpRequire.c).find(x => x?.exports?.tn?.get)?.exports?.tn;

      if (!QuestsStore || !api) {
        console.log("Quest system not available yet. Reload Discord.");
        return;
      }

      const supportedTasks = [
        "WATCH_VIDEO",
        "WATCH_VIDEO_ON_MOBILE"
      ];

      let quests = [...QuestsStore.quests.values()].filter(q =>
        q.userStatus?.enrolledAt &&
        !q.userStatus?.completedAt &&
        new Date(q.config.expiresAt).getTime() > Date.now() &&
        supportedTasks.some(t =>
          Object.keys((q.config.taskConfig ?? q.config.taskConfigV2).tasks).includes(t)
        )
      );

      if (!quests.length) {
        console.log("No incomplete quests found.");
        return;
      }

      (async function doJob() {
        const quest = quests.pop();
        if (!quest) return;

        const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
        const taskName = supportedTasks.find(t => taskConfig.tasks[t]);
        const secondsNeeded = taskConfig.tasks[taskName].target;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
        const speed = 7;

        while (secondsDone < secondsNeeded) {
          const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + 10;
          if (secondsDone + speed <= maxAllowed) {
            secondsDone += speed;
            await api.post({
              url: `/quests/${quest.id}/video-progress`,
              body: { timestamp: Math.min(secondsNeeded, secondsDone) }
            });
          }
          await new Promise(r => setTimeout(r, 1000));
        }

        await api.post({
          url: `/quests/${quest.id}/video-progress`,
          body: { timestamp: secondsNeeded }
        });

        console.log("Quest completed:", quest.config.messages.questName);
        doJob();
      })();

    } catch (err) {
      console.error("Quest script error:", err);
    }
  }

})();
