"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CACHE_VERSION = "thumb-v1";

function thumbnailKey(file, stat) {
  return crypto.createHash("sha256").update([
    CACHE_VERSION,
    path.resolve(file),
    String(Math.trunc(stat.mtimeMs || 0)),
    String(stat.size || 0)
  ].join("\0")).digest("hex");
}

async function pruneThumbnailCache(directory, limits) {
  const maxFiles = Math.max(1, Number(limits && limits.maxFiles) || 1500);
  const maxBytes = Math.max(1, Number(limits && limits.maxBytes) || 256 * 1024 * 1024);
  const maxAgeMs = Math.max(0, Number(limits && limits.maxAgeMs) || 0);
  let entries;
  try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
  catch (_) { return { files: 0, bytes: 0, removed: 0 }; }
  const files = [];
  await Promise.all(entries.filter(function (entry) {
    return entry.isFile() && /^[a-f0-9]{64}\.(?:jpg|png)$/.test(entry.name);
  }).map(async function (entry) {
    try {
      const file = path.join(directory, entry.name);
      const stat = await fs.promises.stat(file);
      files.push({ file: file, size: stat.size, mtime: stat.mtimeMs || 0 });
    } catch (_) {}
  }));
  files.sort(function (a, b) { return b.mtime - a.mtime; });
  let bytes = files.reduce(function (sum, file) { return sum + file.size; }, 0);
  let removed = 0;
  for (let index = files.length - 1; index >= 0 && (files.length - removed > maxFiles || bytes > maxBytes); index--) {
    try { await fs.promises.unlink(files[index].file); bytes -= files[index].size; removed++; }
    catch (_) {}
  }
  if (maxAgeMs > 0) {
    const cutoff=Date.now()-maxAgeMs;
    for (let index=files.length-removed-1; index>=0; index--) {
      if(files[index].mtime>=cutoff)break;
      try { await fs.promises.unlink(files[index].file); bytes-=files[index].size; removed++; }
      catch (_) {}
    }
  }
  return { files: files.length - removed, bytes: bytes, removed: removed };
}

module.exports = { CACHE_VERSION, thumbnailKey, pruneThumbnailCache };
