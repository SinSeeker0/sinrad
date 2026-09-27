"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const level = String(process.argv[2] || "standard").toLowerCase();
const allowed = new Set(["quick", "standard", "ui"]);

if (level === "help" || level === "--help" || level === "-h") {
  console.log("Usage: node scripts/sinrad-verify.js <quick|standard|ui>");
  process.exit(0);
}

if (!allowed.has(level)) {
  console.error(`Unknown verification level: ${level}`);
  process.exit(2);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function captureGit(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status || 1);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

if (level === "quick") {
  const files = new Set([
    ...captureGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...captureGit(["ls-files", "--others", "--exclude-standard"]),
  ]);
  const scripts = [...files].filter((file) => /\.(?:cjs|mjs|js)$/i.test(file));
  if (!scripts.length) {
    console.log("Quick verification passed: no changed JavaScript files.");
    process.exit(0);
  }
  for (const file of scripts) run(process.execPath, ["--check", file]);
  console.log(`Quick verification passed: ${scripts.length} JavaScript file(s).`);
  process.exit(0);
}

function runNpm(script) {
  if (process.platform === "win32") {
    run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm run ${script}`]);
    return;
  }
  run("npm", ["run", script]);
}

runNpm("check");
if (level === "ui") runNpm("test:ui");
console.log(`${level[0].toUpperCase()}${level.slice(1)} verification passed.`);
