"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { normalizeHttpUrl, isPathInside } = require("../lib/security.js");

test("only http(s) links are accepted", function () {
  assert.equal(normalizeHttpUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(normalizeHttpUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeHttpUrl("file:///etc/passwd"), null);
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("not a url"), null);
});

test("path containment rejects siblings and prefix lookalikes", function () {
  const root = path.resolve("test-root");
  assert.equal(isPathInside(path.join(root, "folder", "image.png"), [root]), true);
  assert.equal(isPathInside(root, [root]), true);
  assert.equal(isPathInside(path.resolve("test-root-other", "image.png"), [root]), false);
  assert.equal(isPathInside(path.resolve(root, "..", "outside.png"), [root]), false);
});
