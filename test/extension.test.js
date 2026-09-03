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
  assert.equal(manifest.version, "1.2.5");
  assert.match(background, /id: 'sinrad-quick-save'[\s\S]*title: 'S\.I\.R Quick Save → Links'[\s\S]*contexts: \['page', 'link', 'selection'\]/);
  assert.match(background, /id: 'sinrad-park-all'[\s\S]*contexts: \['page'\]/);
  assert.match(background, /id: 'sinrad-park-all-close'[\s\S]*contexts: \['page'\]/);
  assert.match(background, /saveOne\(targetUrl, tab\.title, false\)/);
  assert.match(background, /saveBatchToSinrad\(targets\)/);
  assert.doesNotMatch(background, /Promise\.allSettled\(targets\.map/);
  assert.match(background, /postToSinrad\(\{ tabs: safeTabs, lot: true \}\)/);
});

test("extension captures the current page into SINRAD without another archiver", function () {
  const root = path.resolve(__dirname, "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
  assert.ok(manifest.permissions.includes("pageCapture"));
  assert.ok(manifest.permissions.includes("scripting"));
  assert.match(background, /chrome\.pageCapture\.saveAsMHTML/);
  assert.match(background, /chrome\.scripting\.executeScript/);
  assert.match(background, /metadata: isReddit \? 'reddit' : 'web'|platform: isReddit \? 'reddit' : 'web'/);
  assert.match(background, /\.media-lightbox-img/);
  assert.match(background, /querySelectorAll\('shreddit-comment/);
  assert.match(background, /packaged-media-json/);
  assert.match(background, /authorFlair, postFlair, authorAvatarUrl, content, contentBlocks/);
  assert.match(background, /mediaUrls, comments/);
  assert.match(background, /shreddit-post-flair/);
  assert.match(background, /avatarUrl,body,contentBlocks,mediaUrls:commentMedia/);
  assert.doesNotMatch(background, /\[slot="text-body"\],\.md/);
  assert.match(background, /slice\(0, 20\)/);
  assert.match(background, /id: 'sinrad-save-offline'/);
  assert.match(background, /postJson\('\/capture\/start',[\s\S]*metadata/);
  assert.match(background, /authorizedRequest\('\/capture\/chunk\?id='/);
  assert.match(background, /postJson\('\/capture\/finish'/);
});
