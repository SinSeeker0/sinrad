"use strict";

const path = require("path");

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

function isPathInside(candidate, roots) {
  let resolved;
  try { resolved = path.resolve(String(candidate || "")); } catch (_) { return false; }
  return (roots || []).some(function (root) {
    try {
      const base = path.resolve(String(root || ""));
      const rel = path.relative(base, resolved);
      return rel === "" || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel));
    } catch (_) {
      return false;
    }
  });
}

module.exports = { normalizeHttpUrl, isPathInside };
