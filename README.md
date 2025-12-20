# Discord Web Quest Completer

Chrome extension that automatically completes Discord quests for you. No more manually watching videos or playing games - just click a button and let it run.

## What it does

This extension hooks into Discord's quest system and automatically completes the requirements. It works with:

- Video watching quests (WATCH_VIDEO, WATCH_VIDEO_ON_MOBILE)
- Desktop game playing (PLAY_ON_DESKTOP) 
- Desktop streaming (STREAM_ON_DESKTOP)
- Activity playing (PLAY_ACTIVITY)

The extension spoofs your user-agent to make Discord think you're using the desktop app, which is required for some quest types to work properly.

## Installation

1. Clone or download this repo
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Toggle "Developer mode" on (top right corner)
4. Click "Load unpacked" and select the extension folder
5. You're done!

## How to use

1. Go to `https://discord.com/quest-home` in your browser
2. Accept a quest if you haven't already
3. Look for the "🚀 Run Quest Code" button in the bottom right corner
4. Click it and check the browser console (F12) for progress updates

The extension will automatically detect your active quest and start completing it. Progress is logged to the console so you can see what's happening.

## Requirements

- Chrome or any Chromium-based browser (Edge, Brave, etc.)
- A Discord account with quests available
- An accepted quest on the quest-home page

## How it works

The extension uses a few tricks:

- **User-Agent override**: Modifies HTTP headers and navigator properties to mimic Discord desktop
- **Webpack module injection**: Hooks into Discord's internal stores (QuestsStore, RunningGameStore, etc.)
- **API spoofing**: Intercepts quest progress updates and sends fake data

For streaming quests, you still need at least one other person in the voice channel - the extension can't fake that part.

## Troubleshooting

**Button doesn't appear:**
- Make sure you're on `discord.com/quest-home`
- Refresh the page
- Check that the extension is enabled in `chrome://extensions/`

**Quest not completing:**
- Open the console (F12) and check for error messages
- Make sure you've accepted the quest first
- Some quest types work better in the actual Discord desktop app
- Try refreshing and running the code again

**User-Agent warnings:**
- The console might show warnings about user-agent detection - this is normal
- The extension uses multiple methods to override it, so it should still work

## Technical details

Built with Manifest V3. Uses:
- `declarativeNetRequest` for header modification
- Content scripts for quest page interaction
- Background service worker for script injection
- Webpack module interception for Discord internals

## Disclaimer

This is a tool for automating Discord quests. Use at your own risk and be aware of Discord's Terms of Service. I'm not responsible if your account gets flagged or banned.

## License

MIT - do whatever you want with it

