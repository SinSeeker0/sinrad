# S.I.R — Personal Command Center

Was a password manager at first but kinda turned into something more idk i kept coming up with ideas i wanna add and i still got ideas i need to add so lets see how far i can take this.

## Modules

- **Vault** — store logins locally; show/hide and copy password, copy username, open site, favorites, priority, search.
- **Links** — save links with title, URL, category (Anime / Interesting / Check out / Artist / Guides), favorites; filter and search.
- **Parking Lot** — temporary holding area for links; auto-stacks by site; send individual links or whole stacks to Links; search with Ctrl+F; rename stacks; multi-select + delete.
- **Quick Folders** — pin folder paths; open with double-click; favorites; search.
- **Console** — docked terminal with command input; logs activity; `rad "query"` scans your folders; `rad set` for app settings; one-click save chips for visited sites/folders.

## Quick Capture

- **Bookmarklet** — one-click browser bookmark saves the current page (or selected URL) straight to Links [Check out]. Type `bookmarklet` in the console for the code. Uses a custom `sinrad://` protocol — no extension needed.
- **Global Hotkey (Ctrl+Alt+P)** — copies clipboard URL and saves to Links [Check out]. Toggle with `rad set hk off` before gaming so it doesn't eat your keybinds.
- **Park command** — type `park` in the console to grab whatever URL is in your clipboard into the Parking Lot. Paste a list of URLs to bulk-import.

## App Features

- **Auto-update** — checks GitHub Releases on launch; downloads and installs in one click (Windows/Linux); falls back to opening the release page if needed.
- **Auto-start on boot** — `rad set autostart on` makes the app launch when you log in. Toggle off anytime.
- **NSIS Installer** (Windows) — proper install/uninstall, Start Menu + Desktop shortcuts, pinned taskbar survives updates.
- **Floating Norma** — transparent always-on-top desktop pet; drag anywhere; right-click menu; docks back into the app.
- **Music player** — plays BGM from the `bgm/` folder; auto-play on boot if enabled (`rad set music on`).
- **Boot intro** — drop a video in `boot/` and it plays on launch (`rad set intro off` to skip).
- **Celebration** — random art zooms across the screen on every save; drop your own `.gif` or `.png` in to customize.
- **Search** — Ctrl+F in every module; Esc to close.
- **Square UI** — clean angular design, minimal border-radius, dark theme.

## Terminal Commands

| Command | What it does |
|---------|-------------|
| `rad "query"` | Search your folders |
| `rad set` | Show all toggleable settings |
| `rad set autostart` | Toggle launch on boot |
| `rad set hk` | Toggle global hotkey (Ctrl+Alt+P) |
| `rad set music` | Toggle BGM auto-play |
| `rad set intro` | Toggle boot video |
| `park` | Save clipboard URL to Parking Lot |
| `park <url>` | Park a specific URL |
| `parklist` | Bulk-import URLs from clipboard |
| `bookmarklet` | Show the one-click browser bookmark code |
| `help` | List all commands |

## Settings (`rad set <name> on|off`)

`autostart` · `hotkey` · `music` · `intro` · `hidden` · `autoscroll` · `click`

## Install

Grab the latest **Setup** from [Releases](https://github.com/SinSeeker0/sinrad/releases). Windows and Linux available. Download, run the installer, done.

## Dev / Build

```bash
npm install
npm start          # run in dev
npm run dist       # build installer
```

Ships as a proper installer (NSIS on Windows, AppImage/deb on Linux).
