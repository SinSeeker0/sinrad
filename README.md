# Sinrad — S.I.R

An offline-first Electron desktop app for passwords, links, temporary tab stacks, quick folders, screenshots, monitoring, and device-folder search.

## Features

- **Vault:** encrypted local credentials, favorites, priority, search, reveal, and copy.
- **Links:** categorized bookmarks with favorites and multi-select.
- **Parking Lot:** temporary links grouped into site stacks.
- **Quick Folders:** pinned paths and recent folders shared with the desktop pet.
- **Screenies:** watch screenshot folders, organize captures, copy, reveal, and slideshow.
- **Console:** activity log plus `rad`, `park`, `parklist`, and settings commands.
- **Quick capture:** global hotkey and the included Manifest V3 browser extension.
- **Offline Reader:** cached feeds plus complete browser snapshots saved by the included extension.
- **Monitoring:** quiet Pawchive/Bakemono and F95 checks, editable check times, full in-app Pawchive artist libraries, and organized attachment/archive downloads for a chosen date range. Downloads use the Windows Downloads folder by default.
- **Desktop extras:** floating Norma pet, optional boot videos, update checks, autostart, and a confirmed 30-minute shutdown timer.

## Install

Download the latest installer from [GitHub Releases](https://github.com/SinSeeker0/sinrad/releases). Windows uses NSIS; Linux provides AppImage and deb packages.

## Browser extension

1. In Sinrad Settings → Tools, open the browser-extension folder. Sinrad updates this stable folder in place.
2. Open your browser's extensions page and enable Developer mode.
3. Choose **Load unpacked** and select the opened `extension` directory.

The extension talks only to Sinrad's authenticated localhost bridge. It can save the current rendered page into Offline Reader as one MHTML file, so no second archiving extension is needed. “Park all and close” closes only tabs the app acknowledges. Opera keeps the same unpacked extension across Sinrad upgrades; click **Reload** in Opera's extension page only if it does not detect an update automatically.

## Data and security

- Data is stored under Electron's OS `userData` directory, never in the repository.
- The state file is encrypted with Electron `safeStorage` when OS encryption is available.
- Writes are atomic and the previous state is retained as `sinrad-data.json.bak`.
- Existing plaintext data is migrated automatically on the next successful save.
- Copied passwords are removed from the clipboard after 45 seconds if unchanged.

Back up both `sinrad-data.json` and its `.bak` file. The encryption is tied to the current OS user, so restore them under the same account. If OS encryption is temporarily unavailable, Sinrad locks writes rather than replacing encrypted data.

## Development

Requires Node.js 22 or newer.

```bash
npm ci
npm start
npm run check
npm run dist
```

Use `release.bat`, `release.sh`, or `node release.js` from a clean `main` branch after committing reviewed changes. The helper runs checks, creates one version commit/tag, and pushes only that tag.

## Settings

Use the top-right gear for autostart, hotkeys, download folders, intro and animation folders, hidden-folder scanning, click mode, and pet auto-undock. Use the list button or `Ctrl+Shift+P` to jump to any page or command without working through the sidebar.

## License

[MIT](LICENSE)
