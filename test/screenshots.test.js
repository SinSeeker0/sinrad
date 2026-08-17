"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validDirectories, listScreenshotFiles } = require("../lib/screenshots.js");

test("screenshot discovery is asynchronous, filtered, and newest-first", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-shots-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const oldImage = path.join(root, "old.png");
  const newImage = path.join(root, "new.jpg");
  fs.writeFileSync(oldImage, "old");
  fs.writeFileSync(newImage, "new");
  fs.writeFileSync(path.join(root, "ignore.txt"), "ignore");
  const oldTime = new Date(Date.now() - 60_000);
  fs.utimesSync(oldImage, oldTime, oldTime);

  const result = await listScreenshotFiles([root]);
  assert.deepEqual(result.files.map(function (file) { return file.name; }), ["new.jpg", "old.png"]);
  assert.deepEqual(result.roots, [root]);
});

test("directory validation removes invalid entries, duplicates, and applies its cap", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-roots-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const one = path.join(root, "one");
  const two = path.join(root, "two");
  fs.mkdirSync(one);
  fs.mkdirSync(two);

  const result = await validDirectories([one, one, path.join(root, "missing"), two], 1);
  assert.deepEqual(result, [path.resolve(one)]);
});
