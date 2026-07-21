// Pure-Node recursive folder scanner (no Electron deps) used by the console "rad" command.
// scanFolders(roots, opts, handlers) -> { abort() }
//   opts: { query, maxDepth, skipHidden, cap, visitCap, conc, flushMs, skip:[...] }
//   handlers: { onChunk(items:[{name,path}]), onDone({truncated}), shouldAbort()->bool }
const fs = require("fs");
const path = require("path");

const DEFAULT_SKIP = ["node_modules","bower_components","vendor","dist","build","coverage",
  ".next",".nuxt",".output",".turbo","__pycache__",".venv","venv","target",".gradle",".git",".hg",".svn"];

function scanFolders(roots, opts, handlers){
  opts = opts || {}; handlers = handlers || {};
  const query = String(opts.query || "").toLowerCase();
  const maxDepth = (opts.maxDepth == null) ? 4 : opts.maxDepth;
  const skipHidden = opts.skipHidden !== false;
  const cap = opts.cap || 300;
  const visitCap = opts.visitCap || 300000;
  const conc = opts.conc || 8;
  const flushMs = opts.flushMs || 120;
  const skip = new Set(DEFAULT_SKIP);
  if(Array.isArray(opts.skip)) opts.skip.forEach(function(s){ skip.add(s); });

  let aborted = false, stopped = false, active = 0;
  let totalFound = 0, visited = 0, truncated = false;
  let buffer = [];
  const queue = (roots || []).map(function(r){ return { dir: String(r), depth: 0 }; });

  function flush(){ if(buffer.length){ try{ handlers.onChunk && handlers.onChunk(buffer); }catch(e){} buffer = []; } }
  function done(){ if(timer){ clearInterval(timer); timer = null; } flush(); try{ handlers.onDone && handlers.onDone({ truncated: truncated }); }catch(e){} }
  let timer = setInterval(flush, flushMs);

  function tryNext(){
    while(!aborted && !stopped && active < conc && queue.length){
      const job = queue.shift(); active++;
      processJob(job).then(function(){
        active--;
        if(aborted || stopped){ if(active === 0){ stopped = true; done(); } }
        else { tryNext(); if(active === 0 && queue.length === 0){ stopped = true; done(); } }
      });
    }
  }

  async function processJob(job){
    if(aborted) return;
    visited++;
    if(visited > visitCap){ truncated = true; aborted = true; return; }
    if(handlers.shouldAbort && handlers.shouldAbort()){ aborted = true; return; }
    let entries;
    try{ entries = await fs.promises.readdir(job.dir, { withFileTypes: true }); }catch(e){ return; } // permission / missing -> skip
    for(let i=0;i<entries.length;i++){
      if(aborted) break;
      const ent = entries[i];
      let isDir;
      if(ent && typeof ent.isDirectory === "function"){ isDir = ent.isDirectory(); }
      else { try{ isDir = fs.statSync(path.join(job.dir, ent.name)).isDirectory(); }catch(e){ continue; } }
      if(!isDir) continue;
      const name = ent.name;
      if(skipHidden && name.charCodeAt(0) === 46) continue;   // skip dot-folders
      if(skip.has(name)) continue;
      const full = path.join(job.dir, name);
      if(query && name.toLowerCase().indexOf(query) >= 0){
        totalFound++; buffer.push({ name: name, path: full });
        if(totalFound >= cap){ truncated = true; aborted = true; break; }
      }
      if(job.depth + 1 < maxDepth) queue.push({ dir: full, depth: job.depth + 1 });
    }
  }

  if(queue.length === 0){ stopped = true; done(); }
  else { tryNext(); }
  return { abort: function(){ aborted = true; } };
}

module.exports = scanFolders;
