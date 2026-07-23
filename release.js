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

// 2. Next EDIT_COUNT — copy-proof: never go backwards vs the last committed value
//    (the workspace copy can reset the in-file number, so we trust git history as the floor)
const idxPath = "index.html";
let idx = fs.readFileSync(idxPath, "utf8");
const editsIn = (t) => { const mm = t.match(/const EDIT_COUNT\s*=\s*(\d+)/); return mm ? parseInt(mm[1], 10) : 0; };
const headIdx = out("git show HEAD:index.html");
const newN = Math.max(editsIn(idx), headIdx ? editsIn(headIdx) : 0) + 1;

// 3. Next VERSION — v2, patch bump per release. Copy-proof + always v2:
//    continue from package.json when it's already 2.0.x, otherwise fall back to the
//    highest existing v2 tag (so a stale/uncopied folder still produces a v2 tag).
const tagExists = (v) => out('git tag -l "' + v + '"') !== "";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const pm = String(pkg.version || "").match(/^(\d+)\.(\d+)\.(\d+)/);
let basePatch;
if (pm && pm[1] === "2" && pm[2] === "0") {
  basePatch = parseInt(pm[3], 10);
} else {
  basePatch = 0;
  const tags = out("git tag --list v2.*").split(/\r?\n/);
  for (const t of tags) { const mm = t.trim().match(/^v2\.0\.(\d+)$/); if (mm) basePatch = Math.max(basePatch, parseInt(mm[1], 10)); }
}
let patch = basePatch + 1;
while (tagExists("v2.0." + patch)) patch++;        // never reuse a tag
const ver = "2.0." + patch;
const tag = "v" + ver;

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
