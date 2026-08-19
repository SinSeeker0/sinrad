# S.I.R Quick Save — Browser Extension

One-click save any web page or link to S.I.R through an authenticated local connection.

## Install (Chrome / Opera GX / Edge / Brave / Vivaldi)

1. Open your browser's extensions page:
   - **Opera GX**: `opera://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **"Load unpacked"** (or "Load unpacked extension")

4. In Sinrad, run `ext open` and select the folder it opens.

5. Done! Sinrad updates that stable folder in place, so future app updates do not require loading it again. If Opera does not notice changed files immediately, click **Reload** once on `opera://extensions`.

## Usage

- **Click the toolbar icon** → saves current page to Links [Check out]
- **Right-click anywhere** → "Save page to S.I.R"
- **Right-click a link** → "Save link to S.I.R"
- **Select text that's a URL, right-click** → "Save selection to S.I.R"
- **Park ALL tabs** → waits for acknowledgements; the close option leaves failed tabs open

## Requirements

- The S.I.R desktop app must be running (it hosts an extension-only localhost bridge)
- That's it. No account, no internet, no config.
