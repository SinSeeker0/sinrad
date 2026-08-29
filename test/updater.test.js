"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

test("Windows runtime identity matches the installed shortcut identity", function () {
  assert.equal(pkg.build.appId, "com.sinrad.desktop");
  assert.equal(pkg.build.nsis.guid, "da39281a-1d2a-5e1e-89f8-967e70dfa570");
  assert.match(main, new RegExp("PACKAGED_APP_ID=\\\"" + pkg.build.appId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\\""));
  assert.match(main, /APP_ID=app\.isPackaged\?PACKAGED_APP_ID:PACKAGED_APP_ID\+"\.dev"/);
  assert.match(main, /setAppUserModelId\(APP_ID\)/);
  assert.ok(pkg.build.extraResources.includes("icon.ico"));
  assert.ok(pkg.build.extraResources.includes("icon.png"));
  assert.match(main, /path\.join\(process\.resourcesPath, process\.platform === "win32" \? "icon\.ico" : "icon\.png"\)/);
  assert.match(main, /icon:process\.platform === "win32" \? undefined : WINDOW_ICON/);
  assert.match(main, /setAppDetails\(\{appId:APP_ID,appIconPath:exe,appIconIndex:0/);
});

test("automatic updates use silent NSIS installation while fresh installs retain the wizard", function () {
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.match(main, /quitAndInstall\(true,true\)/);
});
