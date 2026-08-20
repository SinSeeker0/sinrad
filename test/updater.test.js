"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

test("Windows runtime identity matches the installed shortcut identity", function () {
  assert.match(main, new RegExp("setAppUserModelId\\(\\\"" + pkg.build.appId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\\"\\)"));
});

test("automatic updates use silent NSIS installation while fresh installs retain the wizard", function () {
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.match(main, /quitAndInstall\(true,true\)/);
});
