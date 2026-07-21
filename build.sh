#!/usr/bin/env bash
# ============================================================
#  Sinrad — one-command app builder
#  Usage:
#     ./build.sh            # install deps (first run) + build an installer for THIS OS
#     ./build.sh run        # just launch the app (dev / no packaging)
#     ./build.sh all        # build for mac + win + linux (needs wine for win on non-win)
#  Works in: macOS Terminal, Linux shell, WSL, or Git Bash on Windows.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo " Sinrad — Personal Command Center builder"
echo "=============================================="

# 1. toolchain check
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Install Node 18+ from https://nodejs.org and re-run." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found." >&2; exit 1
fi
echo "Using node $(node -v) / npm $(npm -v)"

# 2. dependencies (Electron + electron-builder) — only on first run
if [ ! -d node_modules/electron ] || [ ! -d node_modules/electron-builder ]; then
  echo "==> Installing dependencies (one-time, ~150 MB)..."
  npm install
else
  echo "==> Dependencies already installed."
fi

MODE="${1:-build}"

# 3a. just run it
if [ "$MODE" = "run" ] || [ "$MODE" = "start" ]; then
  echo "==> Launching Sinrad..."
  npm start
  exit 0
fi

# 3b. pick target(s)
case "$MODE" in
  all) TARGETS="" ;;                 # electron-builder builds every configured target
  *)
    case "$(uname -s)" in
      Darwin)               TARGETS="--mac" ;;
      MINGW*|MSYS*|CYGWIN*) TARGETS="--win" ;;
      *)                    TARGETS="--linux" ;;
    esac
    ;;
esac

echo "==> Packaging $([ -n "$TARGETS" ] && echo "$TARGETS" || echo "all platforms") into ./dist ..."
# shellcheck disable=SC2086
npx electron-builder $TARGETS

echo ""
echo "✅  Done! Installers are in:  $(pwd)/dist"
echo "    macOS  -> .dmg / .zip      Windows -> .exe      Linux -> .AppImage / .deb"
