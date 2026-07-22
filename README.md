# S.I.R — Personal Command Center

Was a password manger at first but kinda turned into something more idk i kept coming up with ideas i wanna add and  i still got ideas i need to add so lets see how far i can take this

## Features

**Modules**
- **Vault** — store logins locally; show/hide and copy the password, copy the username, double-click opens the site, mark favorites and priority, search and filter.
- **Link Saver** — save links with a title, URL, one category and a favorite toggle; filter by All / category / favorites; double-click to open.
- **Quick Folders** — pin folder paths (double-click to open); mark favorites; search.
- **Console (docked right panel)** — always-visible terminal log with a command box; the `rad "query"` command scans your files and folders for matches on Linux and returns clickable results. It auto-logs sites and folders you open, each with a one-click add chip for ones you missed (already-saved ones are skipped).

**Interface**
- Custom frameless title bar with a glitching S.I.R wordmark and min / max / close buttons.
- Live status bar: pulsing ready dot, version and edit count, an animated equalizer "thinkbar", store badge and clock.
- Color-coded cards — gold left edge for favorites, right edge for category or priority; colored right-click menus; filter pills.
- Cards open on double-click; a single click does nothing on them, and right-click opens the per-item menu.
- Status bar now has a cyan Check Update button (auto-checks your GitHub Releases on launch; on Windows and Linux it downloads with a progress bar and installs in one click, on macOS it opens the release page) plus a GitHub icon that opens the project page.
- A Settings panel (gear, bottom-right) holds preferences — currently a glowing Double Click / Single Click toggle for opening items (more options to come), and the UI uses clean line-icons instead of emoji.
- Ctrl+F search inside every module (Esc closes and clears it).
- Floating Norma — send the companion out as a transparent, always-on-top, click-through desktop window you can drag anywhere; right-click menu; docks back into the panel.
- Celebration popup on every save — the image zooms through the screen over a glitching "COMPLETE" wordmark with scanlines, picking random art each time.
- Swap the celebration art and the Norma face by dropping files in (animated .gifs work), no code editing.
- Everything saves to a real file on disk, so it is still there next launch.
- Ships as download-and-run apps for Windows, Linux and macOS, no install needed.
