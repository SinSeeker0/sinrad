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

// 2. Next version = current EDIT_COUNT + 1, skipping any tag that already exists
const idxPath = "index.html";
const idx = fs.readFileSync(idxPath, "utf8");
const m = idx.match(/const EDIT_COUNT\s*=\s*(\d+)/);
let n = m ? parseInt(m[1], 10) : 0;
const tagExists = (v) => out('git tag -l "v' + v + '"') !== "";
let newN = n + 1;
while (tagExists("1." + newN + ".0")) newN++;      // never reuse a tag (handles version tangles)
const ver = "1." + newN + ".0";
const tag = "v" + ver;

// 3. Bump EDIT_COUNT in index.html and version in package.json (kept in sync)
fs.writeFileSync(idxPath, idx.replace(/const EDIT_COUNT\s*=\s*\d+/, "const EDIT_COUNT = " + newN));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
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
