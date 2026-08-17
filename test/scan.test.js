"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const scanFolders = require("../scan.js");

function runScan(roots, options) {
  return new Promise(function (resolve) {
    const found = [];
    scanFolders(roots, Object.assign({ flushMs: 5 }, options), {
      onChunk: function (items) { found.push.apply(found, items); },
      onDone: function (info) { resolve({ found, info }); }
    });
  });
}

test("folder scan finds matches and skips dependency folders", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-scan-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(root, "Anime Library"));
  fs.mkdirSync(path.join(root, "node_modules", "Anime Hidden"), { recursive: true });
  const result = await runScan([root], { query: "anime", maxDepth: 4 });
  assert.deepEqual(result.found.map(function (item) { return item.name; }), ["Anime Library"]);
  assert.equal(result.info.truncated, false);
});

test("folder scan enforces its result cap", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-cap-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  for (let i = 0; i < 5; i++) fs.mkdirSync(path.join(root, "match-" + i));
  const result = await runScan([root], { query: "match", cap: 2, maxDepth: 2 });
  assert.equal(result.found.length, 2);
  assert.equal(result.info.truncated, true);
});
