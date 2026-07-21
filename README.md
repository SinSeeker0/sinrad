# Sinrad — Personal Command Center (Electron desktop app)

A clean **dark + cyan** desktop app: full‑bleed layout, custom title bar with a
glitching wordmark, module sidebar, live status bar, and a floating **Norma**
companion. Every module works; data saves to a real file on disk.

## ⬇️ Download & run (no build, no Node needed)

Go to the **Releases** page on GitHub and grab the single file for your OS:

- **Windows:** `Sinrad-...-portable.exe` → just double‑click (no install), or `Sinrad-Setup-...exe` (installer).
- **Linux:** `Sinrad-....AppImage` → `chmod +x Sinrad-*.AppImage && ./Sinrad-*.AppImage`; or the `....deb`.
- **macOS:** `Sinrad-....dmg`.

These are built **automatically by GitHub Actions** (`.github/workflows/release.yml`) on Windows + Linux + macOS runners whenever a version tag is pushed — so *you* never build anything either. Users just download and run.

## 🛠 Publish a new release

1. Bump the number in **two** places so they match: `"version"` in `package.json` **and** `EDIT_COUNT` in `index.html` (the app shows `v1.<N>.0 | #N edits`).
2. Commit, then tag & push:
   ```bash
   git add -A && git commit -m "release 1.23.0"
   git tag v1.23.0 && git push && git push --tags
   ```
3. GitHub builds all three OS installers and posts them on the Releases page (or use **Actions → Release → Run workflow**).

Build locally instead: `npm install` then `npm run dist` (or `npm run build:linux` / `build:win` / `build:mac`). Tip: building a *Linux* package is most reliable on Linux/WSL2 and a *Windows* package on Windows — the GitHub workflow handles all three for you, so you don't have to.

## Modules

| Module | What it does |
|---|---|
| 🔐 **Vault** | Passwords with show/hide, copy, **open site**, ★ favorites, ⚠ priority, search + filters. |
| 🔗 **Link Saver** | Inline **Title / URL / Category / ＋Add** bar, `All` + category pills, `★ Favorites`, one‑click‑open cards. |
| 📁 **Folders** | Quick‑access groups for notes & links. |
| 🖥️ **Console** | Live system log rendered as a **terminal** (colour‑coded levels, blinking prompt). |

## 🖼 Change ANY image — NO code editing

Drop files with these **exact names** into this folder (next to `index.html`) and
**restart** the app. Real animated `.gif`s **will animate**. The app tries
`.gif → .png → .webp` per slot (and `.svg` for the logo), and only uses the
built‑in images when a file is missing (e.g. the in‑browser live preview, which
can't read local files).

| File | Controls |
|---|---|
| `celebrate-1.gif` | 1st celebration popup image |
| `celebrate-2.gif` | 2nd celebration popup image |
| `norma.gif` | floating Norma / desktop‑pet face |
| `logo.png` | the **logo tile** (the gradient “S”) — also `.svg` / `.gif` / `.webp` |

- **More celebration art:** open `index.html`, find the `CELEBRATE_FILES` array
  near the top of the `<script>`, add a line, e.g. `["win.gif","win.png"],`. The
  popup picks one at random (never the same twice in a row). The big `data:`
  strings in `CELEBRATE_EMBED` are just fallbacks — leave them alone.
- **Shipped defaults** (`celebrate-1.png`, `celebrate-2.png`, `norma.png`) are
  single still frames because the chat flattened the original uploads; replacing
  them with real `.gif`s (same names) is what makes them move.
- **Packaged app includes your swaps:** the build globs every image in the
  folder (`*.png *.gif *.webp *.svg`), so a dropped‑in `.gif` ships inside the
  installer — no extra config.

## 🐾 Floating Norma (lives OUTSIDE the app)

Pressing **–** on the Norma card sends her floating on your **desktop** as a
separate transparent, always‑on‑top, click‑through window — drag her **anywhere
on screen**. **Right‑click** her for a quick menu (jump to a module, or
**📌 Pin to panel** to dock her back). Empty space around her passes clicks
straight through to your desktop.

> True desktop‑floating needs the **Electron build** (a browser can't open a 2nd
> window). In the in‑browser preview she falls back to an in‑page bubble.

## Run / build it  (one command)

You need **Node.js 18+**. From the `sinrad-app` folder:

```bash
# make the script executable (first time only)
chmod +x build.sh

./build.sh          # install deps + build an installer for THIS OS  -> ./dist
./build.sh run      # just launch the app (no packaging)
./build.sh all      # build for mac + windows + linux
```

`build.sh` works in macOS Terminal, Linux shells, WSL, and Git Bash on Windows.
(Prefer npm directly? `npm install` then `npm start` to run, or `npm run dist`
to package.)

## Where your data lives

`%APPDATA%\Sinrad\sinrad-data.json` (Windows) ·
`~/Library/Application Support/Sinrad/sinrad-data.json` (macOS) ·
`~/.config/Sinrad/sinrad-data.json` (Linux).

## Project layout

```
sinrad-app/
├── index.html        # entire UI + logic (fallback art embedded)
├── pet.html          # the floating desktop companion window
├── build.sh          # one-command installer builder / launcher
├── logo.png          # logo tile  (drop logo.svg/.gif/.webp to change)
├── celebrate-1.png   # celebration art #1  (replace with .gif to animate)
├── celebrate-2.png   # celebration art #2  (replace with .gif to animate)
├── norma.png         # floating Norma face (replace with .gif to animate)
├── main.js           # main window + pet window + IPC + on-disk store
├── preload.js        # secure bridge (contextBridge)
├── package.json
└── README.md
```

## Notes

- Theme colours live in the `:root` CSS variables at the top of `index.html`
  (`--cyan`, `--pink`, `--violet`, …). The title glitch is the `brandglitch`
  keyframes; the logo auto‑swaps to `logo.*` when present.
- **Spotify / Reminders / Apps** modules were removed per request.
