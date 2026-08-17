"use strict";

const fs = require("node:fs");
const path = require("node:path");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".jfif"]);

async function validDirectories(candidates, limit = 20) {
  const output = [];
  const seen = new Set();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (output.length >= limit || typeof candidate !== "string" || !candidate) continue;
    const resolved = path.resolve(candidate);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    try {
      if ((await fs.promises.stat(resolved)).isDirectory()) {
        seen.add(key);
        output.push(resolved);
      }
    } catch (_) {}
  }
  return output;
}

async function listScreenshotFiles(roots) {
  const files = [];
  await Promise.all(roots.map(async function (dir) {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch (_) { return; }
    const candidates = entries.filter(function (entry) {
      return entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase());
    });
    for (let offset = 0; offset < candidates.length; offset += 32) {
      await Promise.all(candidates.slice(offset, offset + 32).map(async function (entry) {
        const full = path.join(dir, entry.name);
        try {
          const stat = await fs.promises.stat(full);
          if (stat.isFile()) files.push({ path: full, name: entry.name, mtime: stat.mtimeMs || +stat.mtime, size: stat.size });
        } catch (_) {}
      }));
    }
  }));
  files.sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); });
  return { files: files, roots: roots, truncated: false };
}

module.exports = { IMAGE_EXTENSIONS, validDirectories, listScreenshotFiles };
