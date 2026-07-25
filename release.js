// S.I.R release helper — bumps the version, commits, tags, and pushes in one shot.
// Run via release.bat (double-click) or `node release.js` from any terminal.
const { execSync } = require("child_process");
const fs = require("fs");

process.chdir(__dirname); // always work inside this script's folder (safe after moving the folder)

function run(cmd){ try { execSync(cmd, { stdio: "inherit" }); } catch (e) { process.exit(e.status || 1); } }
function out(cmd){ try { return execSync(cmd, { encoding: "utf8" }).trim(); } catch (e) { return ""; } }

console.log("\n=== S.I.R release helper ===\n");

// 1. Is there anything new to release? (prevents empty / accidental releases)
const porcelain = out("git status --porcelain");
if (!porcelain) {
  console.log("Nothing new to release since the last release.");
  console.log("Copy the latest workspace files in here first, then run this again.\n");
  process.exit(0);
}

const idxPath = "index.html";
let idx = fs.readFileSync(idxPath, "utf8");
const em = idx.match(/const EDIT_COUNT\s*=\s*(\d+)/);
const newN = (em ? parseInt(em[1], 10) : 0) + 1;
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const pm = String(pkg.version || "2.0.0").match(/^(\d+)\.(\d+)\.(\d+)/);
const b0 = pm ? (parseInt(pm[1],10)||2) : 2;
const b1 = pm ? (parseInt(pm[2],10)||0) : 0;
let patchN = (pm ? (parseInt(pm[3],10)||0) : 0) + 1;
const tagExists = (v) => out('git tag -l "v' + v + '"') !== "";
while (tagExists(b0 + "." + b1 + "." + patchN)) patchN++;
const ver = b0 + "." + b1 + "." + patchN;
const tag = "v" + ver;
idx = idx.replace(/const EDIT_COUNT\s*=\s*\d+/, "const EDIT_COUNT = " + newN);
idx = idx.replace(/const APP_VERSION\s*=\s*"[^"]*"/, 'const APP_VERSION="' + ver + '"');
fs.writeFileSync(idxPath, idx);
pkg.version = ver;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("Bumped -> " + ver + "  (EDIT_COUNT " + newN + ")\n");
// 4. Write EDIT_COUNT + APP_VERSION (index.html) and version (package.json) in sync
idx = idx.replace(/const EDIT_COUNT\s*=\s*\d+/, "const EDIT_COUNT = " + newN);
idx = idx.replace(/const APP_VERSION\s*=\s*[^\n;]+;/, 'const APP_VERSION="' + ver + '";');
fs.writeFileSync(idxPath, idx);
pkg.version = ver;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("Bumped -> " + ver + "  (EDIT_COUNT " + newN + ")\n");

// 4. Commit + push + tag + push tags  (a sign-in window may pop up the first time)
run("git add -A");
run('git commit -m "release ' + ver + '"');
run("git push");
run("git tag " + tag);
run("git push --tags");

// 5. Done — point them at the Releases page
let owner = "YOUR_GITHUB", repo = "sinrad";
const rm = (out("git remote get-url origin") || "").match(/github\.com[\/:]([^\/]+?)\/([^\/\.]+)/);
if (rm) { owner = rm[1]; repo = rm[2]; }
console.log("\nPushed " + tag + ". GitHub is building now (~3-8 min).");
console.log("Releases page: https://github.com/" + owner + "/" + repo + "/releases");
console.log("Tell your friend to download " + ver + ".\n");
