"use strict";

// Requires reviewed work to be committed, runs checks, creates one npm version
// commit/tag, and pushes only that commit and tag.
const { execFileSync } = require("child_process");
const fs = require("fs");

process.chdir(__dirname);

function run(command, args) {
  return execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" && command === "npm" });
}
function output(command, args) {
  return String(execFileSync(command, args, { encoding: "utf8", shell: false })).trim();
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
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const match = String(packageJson.version || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) throw new Error("package.json version must use major.minor.patch format");
const version = match[1] + "." + match[2] + "." + (Number(match[3]) + 1);
packageJson.version = version;
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
packageLock.version = version;
if (packageLock.packages && packageLock.packages[""]) packageLock.packages[""].version = version;
fs.writeFileSync("package-lock.json", JSON.stringify(packageLock, null, 2) + "\n");
const tag = "v" + version;
run("git", ["add", "--", "package.json", "package-lock.json"]);
run("git", ["commit", "-m", "release " + version]);
run("git", ["tag", tag]);
run("git", ["push", "--atomic", "origin", "HEAD", tag]);
console.log("Released " + tag + ". GitHub Actions will build the installers.");
