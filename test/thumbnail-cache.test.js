"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { thumbnailKey, pruneThumbnailCache } = require("../lib/thumbnail-cache.js");

test("thumbnail keys invalidate when an image changes", function () {
  const file = path.resolve("screen.png");
  const first = thumbnailKey(file, { mtimeMs: 1000, size: 20 });
  assert.equal(first, thumbnailKey(file, { mtimeMs: 1000, size: 20 }));
  assert.notEqual(first, thumbnailKey(file, { mtimeMs: 1001, size: 20 }));
  assert.notEqual(first, thumbnailKey(file, { mtimeMs: 1000, size: 21 }));
});

test("thumbnail cache pruning keeps the newest files within limits", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-thumbs-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  for (let index = 0; index < 3; index++) {
    const file = path.join(root, String(index).padStart(64, "a") + ".jpg");
    fs.writeFileSync(file, Buffer.alloc(10, index));
    const when = new Date(Date.now() - (3 - index) * 1000);
    fs.utimesSync(file, when, when);
  }
  fs.writeFileSync(path.join(root, "unrelated.txt"), "keep");

  const result = await pruneThumbnailCache(root, { maxFiles: 2, maxBytes: 20 });
  const remaining = fs.readdirSync(root).filter(function (name) { return name.endsWith(".jpg"); });
  assert.equal(result.removed, 1);
  assert.equal(remaining.length, 2);
  assert.equal(fs.existsSync(path.join(root, "unrelated.txt")), true);
});

test("thumbnail cache pruning removes stale files even below size limits", async function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinrad-thumbs-age-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const stale=path.join(root,"b".repeat(64)+".jpg"),fresh=path.join(root,"c".repeat(64)+".jpg");
  fs.writeFileSync(stale,"old");fs.writeFileSync(fresh,"new");
  const old=new Date(Date.now()-10*24*60*60*1000);fs.utimesSync(stale,old,old);
  const result=await pruneThumbnailCache(root,{maxFiles:50,maxBytes:1024,maxAgeMs:24*60*60*1000});
  assert.equal(result.removed,1);
  assert.equal(fs.existsSync(stale),false);
  assert.equal(fs.existsSync(fresh),true);
});
