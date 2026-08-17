"use strict";

// Requires reviewed work to be committed, runs checks, creates one npm version
// commit/tag, and pushes only that commit and tag.
const { execFileSync } = require("child_process");
const fs = require("fs");

process.chdir(__dirname);

function run(command, args) {
  return execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}
function output(command, args) {
  return String(execFileSync(command, args, { encoding: "utf8", shell: process.platform === "win32" })).trim();
}

if (output("git", ["status", "--porcelain"])) {
  console.error("Release stopped: commit or stash your changes first.");
  process.exit(1);
}
if (output("git", ["branch", "--show-current"]) !== "main") {
  console.error("Release stopped: switch to the main branch first.");
  process.exit(1);
}

run("npm", ["run", "check"]);
run("npm", ["version", "patch", "-m", "release %s"]);

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const tag = "v" + version;
run("git", ["push", "--atomic", "origin", "HEAD", tag]);
console.log("Released " + tag + ". GitHub Actions will build the installers.");
