"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("browser extension prefers IPv4 and retains localhost migration fallback", function () {
  const root = path.resolve(__dirname, "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:47821/*", "http://localhost:47821/*"]);
  assert.match(background, /http:\/\/127\.0\.0\.1:/);
  assert.match(background, /http:\/\/localhost:/);
  assert.match(background, /X-Sinrad-Bridge-Key/);
  assert.match(background, /__SINRAD_BRIDGE_KEY__/);
});

test("extension version and required files are present", function () {
  const root = path.resolve(__dirname, "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  for (const file of ["background.js", "icon.png", "manifest.json"]) {
    assert.equal(fs.statSync(path.join(root, file)).isFile(), true);
  }
});

test("extension keeps Links saving separate from Parking Lot bulk actions", function () {
  const root = path.resolve(__dirname, "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  assert.equal(manifest.version, "1.1.6");
  assert.match(background, /id: 'sinrad-quick-save'[\s\S]*title: 'S\.I\.R Quick Save → Links'[\s\S]*contexts: \['page', 'link', 'selection'\]/);
  assert.match(background, /id: 'sinrad-park-all'[\s\S]*contexts: \['page'\]/);
  assert.match(background, /id: 'sinrad-park-all-close'[\s\S]*contexts: \['page'\]/);
  assert.match(background, /saveOne\(targetUrl, tab\.title, false\)/);
  assert.match(background, /saveToSinrad\(t\.url, t\.title, true\)/);
});
