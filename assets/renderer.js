"use strict";
const KEY="sinrad.data.v3";
const E=window.electronAPI||null;
/* ---------------- updater UI ---------------- */
const GH_REPO_URL = "https://github.com/SinSeeker0/sinrad";
let updState = null;
function openGithub(){ if(E&&E.shellOpen){ E.shellOpen(GH_REPO_URL); } else { try{ window.open(GH_REPO_URL,"_blank","noopener"); }catch(e){} } }
function showUpdateModal(){ const m=$("#update-modal"); if(m){ m.classList.add("show"); } }
function hideUpdateModal(){ const m=$("#update-modal"); if(m) m.classList.remove("show"); updState=null; }
function setUpdProgress(show, pct){ const box=$("#um-prog"); if(box) box.classList.toggle("show", !!show); const fill=$("#um-barfill"); if(fill) fill.style.width=(pct||0)+"%"; }
function renderUpdateResult(r, silent){
  const t=$("#um-title"), v=$("#um-ver"), d=$("#um-date"), n=$("#um-notes"), go=$("#um-go"), lat=$("#um-later");
  if(!silent){ try{ if(r&&r.ok&&r.available) toast("Update available: v"+(r.latest||""),"ok"); else if(r&&r.ok) toast("You're up to date","ok"); else if(r&&!r.ok) toast("Update check failed","err"); }catch(_){} }
  setUpdProgress(false);
  setUpdateGif((!r||!r.ok)?null:(!r.available?"complete":"checking"));
  if(!r||!r.ok){ if(t)t.textContent="Update check failed"; if(v)v.textContent=r&&r.current?("v"+r.current):""; if(d)d.textContent=""; if(n)n.textContent=(r&&r.error)||"Could not reach GitHub. Check your connection."; if(go){go.style.display="none";} if(lat){lat.style.display="";lat.textContent="Close";} showUpdateModal(); return; }
  if(!r.available){ if(t)t.textContent="You are up to date"; if(v)v.textContent="v"+r.current; if(d)d.textContent=""; if(n)n.textContent="Latest on GitHub is v"+(r.latest||r.current)+" — you're on it."; if(go){go.style.display="none";} if(lat){lat.style.display="";lat.textContent="Close";} showUpdateModal(); return; }
  if(t)t.textContent="New Version Available";
  if(v)v.textContent="v"+r.latest;
  if(d)d.textContent=r.date||"";
  if(n)n.textContent=(r.notes||"").trim()||"(no release notes)";
  if(go){ go.style.display=""; go.disabled=false; go.textContent=r.canAuto?"Update now":(r.asset?"Download":"Open releases"); }
  if(lat){ lat.style.display=""; lat.disabled=false; lat.textContent="Not now"; }
  updState = r;
  showUpdateModal();
}
function updateCheckClick(silent){
  if(!E||!E.updateCheck){ if(!silent) toast("Update check works in the desktop build","warn"); return; }
  if(!silent){ const t=$("#um-title"); if(t)t.textContent="Checking…"; const n=$("#um-notes"); if(n)n.textContent="Contacting GitHub…"; setUpdateGif("checking"); showUpdateModal(); }
  Promise.resolve(E.updateCheck(APP_VERSION)).then(function(r){ renderUpdateResult(r, !!silent); }).catch(function(e){ renderUpdateResult({ok:false,error:String(e&&e.message||e)}, !!silent); });
}
function updateGoClick(){
  const r=updState; if(!r) return;
  if(r.temp){ setUpdateGif("updating"); doInstall(); return; }
  if(!r.canAuto){ if(E&&E.shellOpen) E.shellOpen((r.asset&&r.asset.url)||r.page||GH_REPO_URL+"/releases/latest"); else openGithub(); hideUpdateModal(); return; }
  const go=$("#um-go"), lat=$("#um-later"); if(go)go.disabled=true; if(lat)lat.disabled=true;
  if(!E||!E.updateDownload){ toast("Update download needs the desktop build","warn"); return; }
  setUpdProgress(true,0); setUpdateGif("updating");
  Promise.resolve(E.updateDownload({url:r.asset&&r.asset.url, name:r.asset&&r.asset.name})).then(function(res){
    if(res&&res.manual){ hideUpdateModal(); return; }
    setUpdProgress(true,100); const pctEl=$("#um-pct"); if(pctEl) pctEl.textContent="100%";
    updState=Object.assign({},r,{temp:true});
    if(go){go.disabled=false; go.textContent="Install & relaunch";} if(lat)lat.disabled=false;
    toast("Download complete","ok");
  }).catch(function(e){ setUpdProgress(false); toast("Download failed: "+(e&&e.message||e),"err"); if(go)go.disabled=false; if(lat)lat.disabled=false; });
}
function doInstall(){
  if(!E||!E.updateInstall){ toast("Install needs the desktop build","warn"); return; }
  const go=$("#um-go"); if(go){go.disabled=true; go.textContent="Installing…";}
  Promise.resolve(E.updateInstall()).then(function(res){ if(res&&res.manual){ openGithub(); } hideUpdateModal(); }).catch(function(e){ toast("Install failed: "+(e&&e.message||e),"err"); if(go){go.disabled=false; go.textContent="Install & relaunch";} });
}
function autoCheckUpdate(){ if(!E||!E.updateCheck) return; Promise.resolve(E.updateCheck(APP_VERSION)).then(function(r){ if(r&&r.ok&&r.available) renderUpdateResult(r, true); }).catch(function(){}); }
if(E&&E.onUpdateProgress){ E.onUpdateProgress(function(p){ const tot=p.total||0; const pct=p.percent!=null?Math.round(p.percent):(tot?Math.min(100,Math.round((p.got/tot)*100)):0); const mb=function(b){return (b/1048576).toFixed(1);}; const pctEl=$("#um-pct"); setUpdProgress(true,pct); if(pctEl) pctEl.textContent=pct+"%"+(tot?("  "+mb(p.got)+"/"+mb(tot)+" MB"):""); }); }
(function(){ const m=$("#update-modal"); if(m) m.addEventListener("click",function(e){ if(e.target&&e.target.id==="update-modal") hideUpdateModal(); }); document.addEventListener("keydown",function(e){ if(e.key==="Escape"){ const m2=$("#update-modal"); if(m2&&m2.classList.contains("show")) hideUpdateModal(); } }); })();
setTimeout(autoCheckUpdate, 1500);
function openVerb(){ return (state.openMode==='single')?'Single-click':'Double-click'; }
function setUpdateGif(phase){ const gif=$("#um-gif"), svg=$("#um-ico-svg"); const src=phase?UPD_GIF_SRC[phase]:null; if(gif){ if(src){ gif.src=src; gif.style.display="block"; if(svg)svg.style.display="none"; } else { gif.style.display="none"; gif.removeAttribute("src"); if(svg)svg.style.display="block"; } } }
let UPD_GIF_SRC={checking:null,updating:null,complete:null};
function settingsMenu(push){
  function p(s,n){ s=String(s); while(s.length<n)s+=' '; return s; }
  var musicOn=!!(state.settings&&state.settings.autoplayMusic);
  var introOn=!(state.settings&&state.settings.introEnabled===false);
  var hiddenOn=state.scanSkipHidden!==false;
  var scrollOn=!(state.settings&&state.settings.autoScroll===false);
  var click=(state.openMode==='single')?'single':'double';
  var st=function(on){ return on?'ON':'off'; };
  var L=[];
  L.push('settings  ·  type  '+state.radCmd+' set <name>  to toggle  ·  '+state.radCmd+' set <name> on|off  to force');
  var autoOn=!!(state.settings&&state.settings.autoStart);
  var hkOn=!(state.settings&&state.settings.hotkeyEnabled===false);
  L.push(p('  music on boot',22)+p(st(musicOn),5)+state.radCmd+' set music');
  L.push(p('  boot intro video',22)+p(st(introOn),5)+state.radCmd+' set intro');
  L.push(p('  skip hidden folders',22)+p(st(hiddenOn),5)+state.radCmd+' set hidden');
  L.push(p('  auto-scroll console',22)+p(st(scrollOn),5)+state.radCmd+' set autoscroll');
  L.push(p('  auto-start on login',22)+p(st(autoOn),5)+state.radCmd+' set autostart');
  L.push(p('  hotkey Ctrl+Alt+P',22)+p(st(hkOn),5)+state.radCmd+' set hk');
  var petOn=!!(state.settings&&state.settings.petAutoUndock);
  L.push(p('  open with',22)+p(click,5)+state.radCmd+' set click');
  L.push(p('  pet auto-undock',22)+p(st(petOn),5)+state.radCmd+' set pet');
  push(L.join('\n'));
}
function handleSet(inner,push){
  var t=(inner||'').trim().toLowerCase();
  if(t===''){ settingsMenu(push); return; }
  var parts=t.split(/\s+/); var k=parts[0]; var v=parts[1]||'';
  function setClick(m){ state.openMode=m; saveState(); }
  function onoff(x){ return x?'ON':'off'; }
  if(k==='click'||k==='open'||k==='openmode'){ setClick(state.openMode==='single'?'double':'single'); push('> open with: '+state.openMode+'-click'); return; }
  if(k==='single'){ setClick('single'); push('> open with: single-click'); return; }
  if(k==='double'){ setClick('double'); push('> open with: double-click'); return; }
  if(k==='music'||k==='autoplay'||k==='bgm'){ if(!state.settings)state.settings={}; var c=!!state.settings.autoplayMusic; var n=(v==='on')?true:(v==='off')?false:!c; state.settings.autoplayMusic=n; saveState(); push('> music on boot: '+onoff(n)); return; }
  if(k==='intro'||k==='boot'||k==='splash'||k==='bootvideo'){ if(!state.settings)state.settings={}; var ci=!(state.settings.introEnabled===false); var ni=(v==='on')?true:(v==='off')?false:!ci; state.settings.introEnabled=ni; saveState(); push('> boot intro video: '+onoff(ni)); return; }
  if(k==='hidden'){ var ch=state.scanSkipHidden!==false; var nh=(v==='on')?true:(v==='off')?false:!ch; state.scanSkipHidden=nh; saveState(); push('> skip hidden folders: '+onoff(nh)); return; }
  if(k==='autoscroll'||k==='scroll'){ if(!state.settings)state.settings={}; var cs=!(state.settings.autoScroll===false); var ns=(v==='on')?true:(v==='off')?false:!cs; state.settings.autoScroll=ns; saveState(); push('> auto-scroll console: '+onoff(ns)); updateAutoScrollBtn(); renderTermBody(); return; }
  if(k==='autostart'||k==='startup'||k==='autorun'||k==='login'){ if(!state.settings)state.settings={}; var ca=!!state.settings.autoStart; var na=(v==='on')?true:(v==='off')?false:!ca; state.settings.autoStart=na; saveState(); if(E&&E.setAutostart){ E.setAutostart(na).then(function(r){ push('> auto-start on boot: '+onoff(!!r)); }).catch(function(){ push('> auto-start on boot: '+onoff(na)); }); } else { push('> auto-start on boot: '+onoff(na)+' (desktop only)'); } return; }
  if(k==='hotkey'||k==='hotkeys'||k==='hk'){ if(!state.settings)state.settings={}; var ch=!(state.settings.hotkeyEnabled===false); var nh=(v==='on')?true:(v==='off')?false:!ch; state.settings.hotkeyEnabled=nh; saveState(); push('> hotkey (Ctrl+Alt+P): '+onoff(nh)); if(E&&E.hotkeyToggle){ E.hotkeyToggle(nh).catch(function(){}); } return; }
  if(k==="pet"||k==="norma"||k==="petundock"){ if(!state.settings)state.settings={}; var cp=!!state.settings.petAutoUndock; var np=(v==="on")?true:(v==="off")?false:!cp; state.settings.petAutoUndock=np; saveState(); push("> pet auto-undock on boot: "+onoff(np)); return; }
  push('> usage: '+state.radCmd+' set <name>  toggles · names: autostart, hotkey, intro, music, hidden, autoscroll, click, pet   (add on|off to force)');
}
const NM_PLAY=`<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
const NM_PAUSE=`<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const bgmAudio=new Audio(); bgmAudio.volume=0.5; let bgmTracks=[]; let bgmIdx=0; let bgmDir="";
try{ if(state.music&&state.music.volume!=null) bgmAudio.volume=state.music.volume; if(state.music&&state.music.idx) bgmIdx=state.music.idx; }catch(_){}
function updateMusicUI(){ const t=$("#nm-track"); const p=$("#nm-play"); if(t) t.textContent = bgmTracks.length? bgmTracks[bgmIdx].name : ("No tracks — drop audio files in: "+(bgmDir||"the bgm folder")); if(p) p.innerHTML = (bgmTracks.length && !bgmAudio.paused)? NM_PAUSE : NM_PLAY; const tb=$("#thinkbar"); if(tb){ if(bgmTracks.length && !bgmAudio.paused) tb.classList.add("playing"); else tb.classList.remove("playing"); } const d=$("#nm-disc"); if(d){ if(bgmTracks.length && !bgmAudio.paused) d.classList.add("spin"); else d.classList.remove("spin"); } }
bgmAudio.addEventListener("play",function(){ const tb=$("#thinkbar"); if(tb) tb.classList.add("playing"); });
bgmAudio.addEventListener("pause",function(){ const tb=$("#thinkbar"); if(tb) tb.classList.remove("playing"); });
bgmAudio.addEventListener("ended",function(){ const tb=$("#thinkbar"); if(tb) tb.classList.remove("playing"); });
function musicSetTrack(i){ if(!bgmTracks.length) return; bgmIdx=((i%bgmTracks.length)+bgmTracks.length)%bgmTracks.length; bgmAudio.src=bgmTracks[bgmIdx].url; const pr=bgmAudio.play(); if(pr&&pr.catch) pr.catch(function(){}); updateMusicUI(); try{ if(!state.music) state.music={}; state.music.idx=bgmIdx; saveState(); }catch(_){} }
function musicToggle(){ if(!bgmTracks.length) return; if(bgmAudio.paused){ const pr=bgmAudio.play(); if(pr&&pr.catch) pr.catch(function(){}); } else { bgmAudio.pause(); } updateMusicUI(); }
function musicNext(){ musicSetTrack(bgmIdx+1); }
function musicPrev(){ musicSetTrack(bgmIdx-1); }
bgmAudio.addEventListener("ended", musicNext);
bgmAudio.addEventListener("play", updateMusicUI);
bgmAudio.addEventListener("pause", updateMusicUI);
let bgmFirstList=true;
let bgmObjectUrls=[];
async function musicLoadList(payload){ bgmDir=(payload&&payload.dir)||''; const list=(payload&&payload.files)||[]; bgmObjectUrls.forEach(function(u){try{URL.revokeObjectURL(u);}catch(_){}}); bgmObjectUrls=[]; bgmTracks=[]; for(const f of list){ try{ const bytes=E&&E.musicRead?await E.musicRead(f.path):null; if(!bytes||!bytes.byteLength)continue; const url=URL.createObjectURL(new Blob([bytes])); bgmObjectUrls.push(url); bgmTracks.push({name:f.name,path:f.path,url:url}); }catch(_){} } if(bgmTracks.length){ const i=bgmIdx<bgmTracks.length?bgmIdx:0; if(bgmFirstList){ bgmFirstList=false; if(state.settings && state.settings.autoplayMusic){ musicSetTrack(i); } else { bgmIdx=i; bgmAudio.src=bgmTracks[i].url; updateMusicUI(); try{ if(!state.music) state.music={}; state.music.idx=i; saveState(); }catch(_){} } } else { musicSetTrack(i); } } else { bgmAudio.pause(); updateMusicUI(); } }
if(E&&E.onMusicList) E.onMusicList(musicLoadList);
if(E&&E.onMusicCmd) E.onMusicCmd(function(c){ if(c==="toggle") musicToggle(); else if(c==="next") musicNext(); else if(c==="prev") musicPrev(); });
updateMusicUI();



let STORE_MODE="Memory";
const EDIT_COUNT = 113;
let APP_VERSION="0.0.0";

var DEFAULT_CATS={ "Anime":"#ff5470", "Interesting":"#4d9bff", "Check out":"#e8e8ef", "Artist":"#8b5cf6", "Guides":"#16c79a" };
function getCatColors(){ var base=Object.assign({},DEFAULT_CATS); try{ if(state&&state.categories){ for(var k in state.categories){ base[k]=state.categories[k]; } } }catch(e){} return base; }
var CAT_COLORS=Object.assign({},DEFAULT_CATS);
function refreshCatColors(){ CAT_COLORS=getCatColors(); }
function addCategory(name,color){ if(!state.categories) state.categories={}; state.categories[name]=color; saveState(); refreshCatColors(); renderView(); log("info","added category: "+name); }
function deleteCategory(name){ if(!state.categories || !state.categories[name]) return; delete state.categories[name]; state.links.forEach(function(l){ if(l.category===name) l.category=""; }); saveState(); refreshCatColors(); renderView(); log("warn","deleted category: "+name); }
function randomColor(){ var h=Math.floor(Math.random()*360); return "hsl("+h+",65%,55%)"; }
var DEFAULT_FOLDER_CATS={ "Mods":"#964B00" };
var FOLDER_CATS=Object.assign({},DEFAULT_FOLDER_CATS);
function refreshFolderCats(){ FOLDER_CATS=Object.assign({},DEFAULT_FOLDER_CATS); try{ if(state&&state.folderCategories){ for(var k in state.folderCategories){ FOLDER_CATS[k]=state.folderCategories[k]; } } }catch(e){} }
const FAV_COLOR="#f5a623", PRI_COLOR="#ff4d8d", ALL_COLOR="#27b4ff";

const revealed=new Set();
let currentView="vault";
let searchTerms={};
let vaultFilter="all", folderFilter="all";
let linkCats=[], linkFav=false, linkDrill=null, folderCats=[]; let shotFilter="inbox", shotOpenId=null;
let modalOnConfirm=null, modalOnCancel=null;

const CELEBRATE_FILES=[["complete.gif","complete.png","complete.webp"]];
const NORMA_FILES=["norma.gif","norma.png","norma.webp"];
const CELEBRATE_EMBED=[];
const NORMA_EMBED="";
let EFFECTIVE=null, celIdx=0;

const ICO_LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICO_LINK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>';
const ICO_FOLDER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const ICO_TERM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/></svg>';
const ICO_SEARCH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
const ICO_STAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z"/></svg>';
const ICO_WARN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none"/></svg>';
const ICO_PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3z"/></svg>';
const ICO_PIN_DIAG='<svg class="pin-mark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-3.6 0-6.5 2.8-6.5 6.3 0 4.7 5.6 11.2 6.1 11.8.2.2.6.2.8 0 .5-.6 6.1-7.1 6.1-11.8C18.5 4.8 15.6 2 12 2zm0 8.6a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"/></svg>';
const ICO_EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const MODULES=[
  {id:"vault",ico:ICO_LOCK,name:"Vault",sub:"Passwords"},
  {id:"links",ico:ICO_LINK,name:"Links",sub:"Saved links"},
  {id:"lot",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/></svg>',name:"Parking Lot",sub:"Parked stacks"},
  {id:"folders",ico:ICO_FOLDER,name:"Folders",sub:"Quick access"},
  {id:"shots",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="#27b4ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>',name:"Screenies",sub:"Inbox"},
];

function defaultState(){ return { vault:[], links:[], folders:[], console:[], radCmd:"rad", scanRoots:[], scanDepth:4, scanSkipHidden:true, petRecents:[], petPins:[], shots:[], shotWatch:[], shotCollections:null }; }
let state=defaultState();

async function loadState(){
  if(E&&E.storeLoad){ try{ const d=await E.storeLoad(); if(d&&typeof d==="object"){ state=Object.assign(defaultState(),d); const sec=E.storeSecurity?await E.storeSecurity():"permissions-only"; STORE_MODE=sec==="encrypted"?"Encrypted local file":"Restricted local file"; } }catch(e){} }
  if(STORE_MODE==="Memory"){ try{ const raw=localStorage.getItem(KEY); if(raw){ state=Object.assign(defaultState(),JSON.parse(raw)); STORE_MODE="Local Storage"; } }catch(e){ STORE_MODE="Memory"; } }
  const d=defaultState(); for(const k in d){ if(state[k]===undefined) state[k]=d[k]; }
  document.getElementById("store-mode").textContent=STORE_MODE; refreshCatColors(); refreshFolderCats();
}
let _saveT=null;
function saveState(){ if(_saveT) clearTimeout(_saveT); _saveT=setTimeout(flushSave,400); }
function flushSave(){ _saveT=null; if(E&&E.storeSave){ try{ Promise.resolve(E.storeSave(state)).then(function(ok){ if(ok===false) toast("Could not save—existing data was protected","err"); }).catch(function(){ toast("Save failed","err"); }); }catch(e){} } else { try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} } }
window.addEventListener("beforeunload",function(){ if(_saveT){ clearTimeout(_saveT); flushSave(); } });

function uid(){ try{ return crypto.randomUUID(); }catch(e){ return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function linkify(m){ var e=esc(m); try{ return e.replace(/(https?:\/\/[^\s<]+)/g,'<span class="lnk">$1</span>'); }catch(_){ return e; } }
function $(s,r){ return (r||document).querySelector(s); }
function nowMs(){ return Date.now(); }
function find(a,id){ return a.find(x=>x.id===id); }
function baseName(p){ const s=String(p||"").replace(/[\\/]+$/,""); const i=Math.max(s.lastIndexOf("/"),s.lastIndexOf("\\")); return i>=0?s.slice(i+1):s; }
function normCat(l){ return (l&&l.category&&String(l.category).trim())||(l&&Array.isArray(l.tags)&&l.tags[0])||""; }
function match(term,...f){ term=(term||"").trim().toLowerCase(); if(!term) return true; return f.some(x=>String(x==null?"":x).toLowerCase().includes(term)); }
function edgeShadow(it){ const L=it.favorite?FAV_COLOR:null; const cc=it.category?(CAT_COLORS[it.category]||FOLDER_CATS[it.category]):null; const R=cc?cc:(it.priority?PRI_COLOR:null); const p=[]; if(L)p.push("inset 3px 0 0 "+L); if(R)p.push("inset -3px 0 0 "+R); return p.length?("box-shadow:"+p.join(",")):""; }
function pill(label,active,color,attrs){ const st=active?`color:${color};border-color:${color};background:color-mix(in srgb, ${color} 18%, transparent);box-shadow:0 0 12px color-mix(in srgb, ${color} 45%, transparent)`:`color:${color};border-color:color-mix(in srgb, ${color} 38%, transparent)`; return `<button class="pill" style="${st}" ${attrs}>${label}</button>`; }
function searchRow(key,ph){ return `<div class="mod-search toolbar"><div class="search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/></svg><input data-search="${key}" placeholder="${ph}" value="${esc(searchTerms[key]||"")}" /></div></div>`; }

function toast(msg,type){ const w=$("#toasts"); const t=document.createElement("div"); t.className="toast"+(type?" "+type:""); t.textContent=msg; w.appendChild(t); setTimeout(()=>{ t.style.transition="opacity .3s, transform .3s"; t.style.opacity="0"; t.style.transform="translateX(20px)"; setTimeout(()=>t.remove(),300); },2600); }
function log(level,message,meta){ const e={id:uid(),ts:nowMs(),level:level||"info",message:String(message)}; if(meta)e.meta=meta; state.console.unshift(e); if(state.console.length>500)state.console.length=500; saveState(); renderTermBody(); }
function safeWebUrl(u){ try{ var x=String(u||"").trim(); if(x.indexOf("www.")===0)x="https://"+x; if(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(x))x="https://"+x; var p=new URL(x); return (p.protocol==="http:"||p.protocol==="https:")?p.toString():""; }catch(_){ return ""; } }
function normUrl(u){ let x=String(u==null?"":u).trim().toLowerCase(); while(x.length&&x.charAt(x.length-1)==="/")x=x.slice(0,-1); return x; }
function recordVisit(url){ const saved=state.links.some(l=>normUrl(l.url)===normUrl(url)); log("info","VISIT  "+url, saved?null:{url:url}); }
function recordFolderVisit(p){ const saved=state.folders.some(f=>normUrl(f.path||"")===normUrl(p)); log("info","OPEN   "+p, saved?null:{path:p}); }
function normFolderPath(p){ return String(p||"").replace(/[\\/]+$/,"").replace(/\\/g,"/").toLowerCase(); }
function folderDisplayName(p){
  const k=normFolderPath(p);
  const f=(state.folders||[]).find(function(x){ return normFolderPath(x.path||"")===k; });
  if(f){ if(f.name&&f.path) return f.name; return f.name||baseName(f.path||p); }
  return baseName(p);
}
function isPetPinned(p){ return (state.petPins||[]).some(function(x){ return normFolderPath(x.path)===normFolderPath(p); }); }
function petFolderSlots(){
  const pins=state.petPins||[], recents=state.petRecents||[], slots=[], seen=new Set();
  function push(item, pinned){
    if(slots.length>=3 || !item || !item.path) return;
    const k=normFolderPath(item.path); if(!k||seen.has(k)) return;
    seen.add(k); slots.push({path:item.path, name:folderDisplayName(item.path), pinned:!!pinned});
  }
  pins.forEach(function(x){ push(x,true); });
  recents.forEach(function(x){ push(x,false); });
  return slots;
}
function syncPetRecents(){ if(E&&E.syncPetRecents) E.syncPetRecents(petFolderSlots()); }
function rememberFolder(p, name){
  if(!p) return;
  const item={path:p, name:folderDisplayName(p)||name||baseName(p), ts:nowMs()};
  state.petRecents=(state.petRecents||[]).filter(function(r){ return normFolderPath(r.path)!==normFolderPath(p); });
  state.petRecents.unshift(item);
  if(state.petRecents.length>20) state.petRecents.length=20;
  saveState(); syncPetRecents();
}
function petPinCount(){ return (state.petPins||[]).length; }
function enforcePetPinCap(){
  state.petPins=state.petPins||[];
  if(state.petPins.length<=3) return false;
  state.petPins=state.petPins.slice(0,3);
  saveState(); syncPetRecents();
  return true;
}
function togglePetPin(p, name){
  if(!p) return false;
  state.petPins=state.petPins||[];
  const k=normFolderPath(p);
  const idx=state.petPins.findIndex(function(x){ return normFolderPath(x.path)===k; });
  if(idx>=0){ state.petPins.splice(idx,1); saveState(); syncPetRecents(); return false; }
  if(state.petPins.length>=3){ toast("Pet recents only holds 3 pins — unpin one first","warn"); return null; }
  state.petPins.push({path:p, name:folderDisplayName(p)||name||baseName(p)});
  saveState(); syncPetRecents(); return true;
}
function openTarget(target,type){ if(!target)return; if(type==="url"){ recordVisit(target,true); } if(type==="app"){ if(E&&E.openPath){ E.openPath(target).then(ok=>{ if(ok===false)toast("Could not open path: "+target,"err"); }); } else { toast("Opening local apps requires the desktop build.","warn"); } return; } if(E&&E.shellOpen){ E.shellOpen(target); } else { try{ window.open(target,"_blank","noopener"); }catch(e){ toast("Blocked popup: "+target,"warn"); } } }
async function copy(text,label){ try{ if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); } else { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } toast((label||"Value")+" copied"+(label==="Password"?" · clears in 45s":""),"ok"); log("ok","Copied "+(label||"value")+" to clipboard"); if(label==="Password"&&E&&E.clipClearIf){ setTimeout(function(){ E.clipClearIf(text).catch(function(){}); },45000); } }catch(e){ toast("Copy failed","err"); } }

function probeImg(names){ return new Promise(res=>{ let i=0; (function n(){ if(i>=names.length)return res(null); const im=new Image(); im.onload=()=>res(names[i]); im.onerror=()=>{i++;n();}; im.src=names[i]; })(); }); }
async function loadArt(){ const g=await Promise.all(CELEBRATE_FILES.map(probeImg)); EFFECTIVE=CELEBRATE_FILES.map((_,i)=>g[i]||CELEBRATE_EMBED[i]||""); const n=await probeImg(NORMA_FILES); const ng=$("#normaGif"); if(ng)ng.src=n||(NORMA_EMBED&&NORMA_EMBED.indexOf("data:")===0?NORMA_EMBED:""); const c=$("#celebrate"); if(c&&c.classList.contains("show")){ const im=$("#celImg"); if(im&&EFFECTIVE[celIdx])im.src=EFFECTIVE[celIdx]; } const ug=await Promise.all([probeImg(["checking.gif","checking.png","checking.webp"]),probeImg(["updating.gif","updating.png","updating.webp"]),probeImg(["complete.gif","complete.png","complete.webp"])]); UPD_GIF_SRC={checking:ug[0],updating:ug[1],complete:ug[2]}; }
function celebrate(){ const c=$("#celebrate"); if(!c)return; const pool=(EFFECTIVE&&EFFECTIVE.length)?EFFECTIVE:CELEBRATE_EMBED; const im=$("#celImg"); if(im&&pool.length){ let p=0; if(pool.length>1){ do{ p=Math.floor(Math.random()*pool.length); }while(p===celIdx); } celIdx=p; im.src=pool[p]; } c.classList.remove("show"); void c.offsetWidth; c.classList.add("show"); clearTimeout(celebrate._t); celebrate._t=setTimeout(()=>c.classList.remove("show"),4000); }

function renderNav(){ $("#nav").innerHTML=MODULES.map(m=>`<div class="nav-item ${m.id===currentView?"active":""}" data-action="nav" data-nav="${m.id}"><span class="nav-ico">${m.ico}</span><span class="nav-txt"><b>${esc(m.name)}</b><span>${esc(m.sub)}</span></span></div>`).join(""); }
function renderConsole(){
  const dock=$("#consoleDock"); if(!dock)return;
  const t0=searchTerms.console||"";
  const asOn=!(state.settings&&state.settings.autoScroll===false);
  dock.innerHTML=
    '<div class="dock-head"><div class="dock-title">'+ICO_TERM+'CONSOLE</div><div class="dock-tools">'+
    '<button class="btn sm danger" data-action="console-clear" title="Clear log">🗑 Clear</button>'+
    '<button id="autoScrollBtn" class="dock-asbtn'+(asOn?' on':'')+'" data-action="toggle-autoscroll" title="Toggle auto-scroll">'+(asOn?'✓ ':'')+'Auto Scroll</button>'+
    '</div></div>'+
    '<div class="dock-search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/></svg>'+
    '<input data-search="console" placeholder="Grep the log…" value="'+esc(t0)+'"></div>'+
    '<div class="term dock-term"><div class="term-body" id="termBody"></div></div>'+
    '<div class="dock-input"><span class="di-prompt">$</span><input id="termInput" class="di-input" placeholder="type a command — try: '+state.radCmd+' &quot;Anime&quot;  ·  help" autocomplete="off"></div>';
  updateAutoScrollBtn();
}
function updateAutoScrollBtn(){ var b=$("#autoScrollBtn"); if(!b) return; var on=!(state.settings&&state.settings.autoScroll===false); b.classList.toggle("on",on); b.textContent=(on?"✓ ":"")+"Auto Scroll"; }

function renderTermBody(){
  const dock=$("#consoleDock"); if(!dock)return;
  if(!$("#termBody")) renderConsole();
  const tb=$("#termBody"); if(!tb)return;
  const autoScroll=!(state.settings&&state.settings.autoScroll===false); const savedTop=tb.scrollTop;
  const term=searchTerms.console||"";
  const items=state.console.filter(c=>match(term,c.message,c.level)).slice().reverse();
  const lines=items.length?items.map(c=>{ const ts=new Date(c.ts).toLocaleTimeString([],{hour12:false}); let addBtn=""; const folderPath=(c.meta&&(c.meta.path||c.meta.openPath))||""; if(c.meta&&c.meta.url){ if(!state.links.some(l=>normUrl(l.url)===normUrl(c.meta.url))) addBtn=`<button class="term-add" data-action="console-add-link" data-id="${c.id}" title="Save this site to Links">＋ Link</button>`; } else if(folderPath){ if(!state.folders.some(f=>normUrl(f.path||"")===normUrl(folderPath))) addBtn=`<button class="term-add" data-action="console-add-folder" data-id="${c.id}" title="Save this folder to Quick Folders">＋ Folder</button>`; } return `<div class="term-line"${folderPath?` data-action="open-folder-path" data-path="${esc(folderPath)}" style="cursor:pointer"`:""}><span class="tt">[${ts}]</span>&nbsp;<span class="lv ${c.level}">${esc(c.level.toUpperCase())}</span>&nbsp;<span class="ms">${linkify(c.message)}</span>${addBtn}</div>`; }).join(""):`<div class="term-empty">// no activity yet — open a site or folder, or type ${esc(state.radCmd)} "query"</div>`;
  tb.innerHTML=lines;
  if(autoScroll){ tb.scrollTop=tb.scrollHeight; } else { tb.scrollTop=Math.min(savedTop, tb.scrollHeight); }
}
function _sendCollToLinks(coll){ if(!coll) return; var n=0; state.links.forEach(function(l){ if((l.coll||"")===coll && !l.inLinks){ l.inLinks=true; n++; } }); if(n){ saveState(); renderView(); log("info","sent "+n+" link(s) from "+coll+" to Links"); } }
function _lotSendSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var n=0; ids.forEach(function(x){ var l=find(state.links,x); if(l && !l.inLinks){ l.inLinks=true; n++; } }); colls.forEach(function(c){ state.links.forEach(function(l){ if((l.coll||"")===c && !l.inLinks){ l.inLinks=true; n++; } }); }); saveState(); lotSelLinks={}; lotSelColls={}; renderView(); log("info","sent "+n+" parked link(s) to Links"); }
function renameStack(coll){
  if(!coll) return;
  openModal("✏️ Rename stack", '<div class="field"><label>New name</label><input id="rs_name" value="'+esc(coll).replace(/"/g,'&quot;')+'"></div>', "Rename", function(){ var el=document.getElementById("rs_name"); var v=el?el.value:""; v=(v||"").trim(); if(!v || v===coll){ closeModal(); return; } var exists=state.links.some(function(l){ return (l.coll||"")===v; }); state.links.forEach(function(l){ if((l.coll||"")===coll) l.coll=v; }); saveState(); closeModal(); log("info","renamed stack "+coll+" -> "+v+(exists?" (merged into existing)":"")); renderView(); });
  setTimeout(function(){ var i=document.getElementById("rs_name"); if(i){ i.focus(); i.select(); } },30);
}

function renderView(){ if(currentView!=="lot"){ lotSelLinks={}; lotSelColls={}; } if(currentView!=="links"){ linkSelLinks={}; } const c=$("#content"); try{ c.parentElement.classList.toggle("lot-active", currentView==="lot"); }catch(_){} switch(currentView){ case "vault":c.innerHTML=viewVault();break; case "links":c.innerHTML=viewLinks();break; case "lot":c.innerHTML=viewLot();break; case "folders":c.innerHTML=viewFolders();break; case "shots":c.innerHTML=viewShots(); shotsHydrateThumbs(); break; default:c.innerHTML=viewVault(); } }
function head(t,d,a){ return `<div class="mod-head"><div><h1>${esc(t)}</h1><p>${esc(d)}</p></div><div class="spacer"></div>${a||""}</div>`; }
function emptyState(i,m){ return `<div class="empty"><div class="e-ico">${i}</div><p>${esc(m)}</p></div>`; }

function fmtDate(ts){ if(!ts) return ''; var d=new Date(ts); var t=d.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit'}); var now=new Date(); var sameDay=d.toDateString()===now.toDateString(); if(sameDay) return '['+t+'] Today'; var yesterday=new Date(now); yesterday.setDate(now.getDate()-1); if(d.toDateString()===yesterday.toDateString()) return '['+t+'] Yesterday'; return '['+t+'] '+d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function viewVault(){
  const term=searchTerms.vault||"";
  let items=state.vault.filter(v=>{ const passF=vaultFilter==="all"?true:vaultFilter==="fav"?!!v.favorite:!!v.priority; return passF&&match(term,v.name,v.url,v.username); });
  const pills=`<div class="toolbar"><div class="lf-left">${pill("All",vaultFilter==="all",ALL_COLOR,'data-action="vault-filter" data-filter="all"')}${pill(ICO_STAR+" Favorites",vaultFilter==="fav",FAV_COLOR,'data-action="vault-filter" data-filter="fav"')}${pill(ICO_WARN+" Priority",vaultFilter==="pri",PRI_COLOR,'data-action="vault-filter" data-filter="pri"')}</div></div>`;
  let body;
  if(!state.vault.length) body=emptyState(ICO_LOCK,"No entries yet. Add your first password above.");
  else if(!items.length) body=emptyState(ICO_SEARCH,"Nothing matches your search or filter.");
  else body=`<div class="grid">`+items.map(v=>{ const show=revealed.has(v.id); const pw=show?esc(v.password):"•".repeat(Math.min(14,Math.max(6,(v.password||"").length))); return `<div class="card" style="${edgeShadow(v)}" data-ctx="vault" data-id="${v.id}" data-action="vault-open"><div class="row"><div style="flex:1;min-width:0"><h3>${esc(v.name)}</h3><div class="sub">${esc(v.url||"—")}</div></div></div><div class="meta">User: <span class="mono">${esc(v.username||"—")}</span></div><div class="meta" style="opacity:.6">${fmtDate(v.created)}</div><div class="meta">Pass: <span class="mono">${pw}</span></div></div>`; }).join("")+`</div>`;
  const addbar=`<div class="toolbar linkbar"><div class="lin-input" style="cursor:default;color:var(--muted);opacity:.85;display:flex;align-items:center;gap:8px">${ICO_LOCK}Entries are saved locally on this device</div><button class="btn primary" data-action="vault-new">＋ Add entry</button></div>`;
  return head("Secure Vault",""+openVerb()+" · right-click for more · Ctrl+F to search")+addbar+searchRow("vault","Search vault...")+pills+body;
}

function collColor(name){ var h=0; name=String(name||''); for(var i=0;i<name.length;i++){ h=(h*31+name.charCodeAt(i))%360; } return 'hsl('+h+',55%,55%)'; }
function isTagPage(u){ var s=String(u||''); return s.indexOf('/tags/')>=0 || s.indexOf('/tag/')>=0; }
function _linkSelCount(){ return Object.keys(linkSelLinks).length; }
function _linkDeleteSel(){ var ids=Object.keys(linkSelLinks); var n=ids.length; if(!n) return; function go(){ var kill={}; ids.forEach(function(x){kill[x]=1;}); state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); linkSelLinks={}; renderView(); log("warn","deleted "+n+" link(s)"); } if(n>4){ confirmModal("Delete "+n+" link(s)?").then(function(y){ if(y) go(); }); } else { go(); } }
function _linkClearSel(){ linkSelLinks={}; renderView(); }
function viewLinks(){
  if(currentView!=="links"){ linkSelLinks={}; }
  const term=searchTerms.links||"";
  const selN=_linkSelCount();
  const selBar=selN?`<div class="lot-bar" style="border-color:rgba(39,180,255,.55);background:#0e1420"><span class="lb-n" style="color:var(--cyan)">${selN} selected</span><button type="button" class="lb-del" data-action="link-sel-del">Delete</button><button type="button" class="lb-clear" data-action="link-sel-clear"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Clear</button></div>`:"";
  const card=(l)=>`<div class="link-card${linkSelLinks[l.id]?" sel":""}" style="${edgeShadow(l)}" data-ctx="link" data-id="${l.id}" data-action="link-open"><h3 class="lc-title">${esc(l.title)}</h3><div class="lc-url" title="${esc(l.url)}">${esc(l.url)}</div><div style="font-size:10px;color:var(--dim);margin-top:2px">${fmtDate(l.created)}</div>${l.note?`<div class="lc-note">${esc(l.note)}</div>`:""}${isTagPage(l.url)?`<span class="lc-tag">tag page</span>`:""}</div>`;
  const addbar=`<div class="toolbar linkbar"><input class="lin-input" id="lk_title" placeholder="Title"><input class="lin-input lk-url" id="lk_url" placeholder="https://..."><button class="btn primary" data-action="link-add">＋ Add</button></div>`;
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${Object.keys(CAT_COLORS).map(c=>{ var lab=esc(c); if(state.categories&&state.categories[c]){ lab+='<span class="cat-del" data-action="cat-del-pill" data-cat="'+esc(c)+'" title="Delete category">×</span>'; } return pill(lab,linkCats.indexOf(c)>=0,CAT_COLORS[c],'data-action="link-cat" data-cat="'+esc(c)+'"'); }).join("")}</div><div class="lf-right">${pill(ICO_STAR+" Favorites",linkFav,FAV_COLOR,'data-action="link-fav"')}<button class="cat-add-btn" data-action="cat-add" title="Add category">+</button></div></div>`;
  const items=state.links.filter(l=>{ if(_inLot(l)) return false; const catOk=!linkCats.length||linkCats.indexOf(normCat(l))>=0||(!normCat(l)&&linkCats.indexOf("")>=0); const favOk=!linkFav||!!l.favorite; return catOk&&favOk&&match(term,l.title,l.url,l.note||""); });
  let body;
  if(!items.length) body=emptyState(ICO_LINK,"No saved links yet — add one above. Parked / imported links live in the Parking Lot.");
  else body=`<div class="grid linkgrid">`+items.map(card).join("")+`</div>`;
  return head("Link Saver",""+openVerb()+" · click multiple categories · ctrl-click cards to select")+addbar+pills+searchRow("links","Search links...")+body+selBar;
}
function viewLot(){
  const term=searchTerms.lot||"";
  const THRESH=(state.settings&&state.settings.stackMin)||3;
  const selN=(typeof _lotCountSel==="function")?_lotCountSel():0;
  const bar=selN?`<div class="lot-bar"><span class="lb-n">${selN} selected</span><button type="button" class="lb-send">→ Links</button><button type="button" class="lb-del">Delete</button><button type="button" class="lb-clear"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Clear</button></div>`:"";
  const itemRow=(l,col)=>`<div class="lot-item${lotSelLinks[l.id]?" sel":""}" data-ctx="link" data-id="${l.id}" data-action="link-open"><span class="li-dot" style="background:var(--dim)"></span><span class="li-main"><span class="li-title">${esc(l.title)}</span><span class="li-url">${esc(l.url)}</span></span>${l.note?`<span class="li-note">${esc(l.note)}</span>`:""}${isTagPage(l.url)?`<span class="li-tag">tag</span>`:""}<span class="li-date" title="${esc(fmtDate(l.created))}">${esc(fmtDate(l.created))}</span></div>`;
  if(linkDrill){
    let items=parked0().filter(l=>(l.coll||"")===linkDrill);
    items=items.slice().sort((a,b)=>(isTagPage(b.url)?1:0)-(isTagPage(a.url)?1:0));
    const col=collColor(linkDrill);
    const dhead=`<div class="drill-head"><button class="dh-back" data-action="link-drill-back">‹ back</button><span class="dh-title" style="color:#ff79c6">${esc(linkDrill)}</span><span class="cc-count" style="margin-left:8px">${items.length}</span><button class="dh-open" data-action="link-openall" data-coll="${esc(linkDrill)}">open all (${items.length})</button></div>`;
    let body; if(!items.length) body=emptyState(ICO_FOLDER,"nothing in this stack yet"); else body=`<div class="lot-items">`+items.map(l=>itemRow(l,col)).join("")+`</div>`;
    return `<div class="lot-view">`+head("Parking Lot","stack: "+linkDrill+" · ctrl-click to select · Delete to remove")+dhead+searchRow("lot","Search in "+linkDrill+"...")+body+bar+`</div>`;
  }
  const parked=parked0();
  const groups={};
  parked.forEach(l=>{ const k=l.coll||""; (groups[k]=groups[k]||[]).push(l); });
  const stackKeys=Object.keys(groups).filter(k=>k!=="" && groups[k].length>=THRESH).sort((a,b)=>groups[b].length-groups[a].length);
  const flatKeys=Object.keys(groups).filter(k=>k==="" || groups[k].length<THRESH);
  let html="";
  if(stackKeys.length){
    html+=`<div class="lot-list">`+stackKeys.map(k=>{ const col=collColor(k); return `<div class="lot-row${lotSelColls[k]?" sel":""}" data-action="link-drill" data-coll="${esc(k)}"><span class="lr-name">${esc(k)}</span><span class="lr-count">${groups[k].length}</span><button class="lr-open" data-action="link-openall" data-coll="${esc(k)}" title="open all in browser">open all</button><span class="lr-hint">open stack ›</span><button type="button" class="lr-send" title="send stack to Links">→ Links</button><button type="button" class="lr-rename" title="rename stack">✎</button></div>`; }).join("")+`</div>`;
  }
  let flat=[]; flatKeys.forEach(k=>groups[k].forEach(l=>flat.push(l)));
  if(flat.length){ html+=`<div style="margin:16px 0 6px;font-size:11px;letter-spacing:.5px;color:var(--dim);text-transform:uppercase">unstacked · ${flat.length}</div><div class="lot-items">`+flat.map(l=>itemRow(l,collColor(l.coll||l.url))).join("")+`</div>`; }
  if(!stackKeys.length && !flat.length) html=emptyState(ICO_FOLDER,"Parking Lot is empty — use  park ,  parklist , or the hotkey to send tabs here.");
  const total=parked.length; const stacks=stackKeys.length;
  const banner=`<div class="lot-banner"><span class="lb-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/></svg></span><div><b>${total}</b> parked · <b>${stacks}</b> stack${stacks===1?"":"s"} · forms at ${THRESH}+ · <span class="lb-cmd">stackmin &lt;n&gt;</span> to change</div></div>`;
  return `<div class="lot-view">`+head("Parking Lot","ctrl-click to select · Delete to remove · click a row to open a stack")+banner+searchRow("lot","Search the parking lot...")+html+bar+`</div>`;
}
function _inLot(l){ return l.src==="park" && !l.category && !l.inLinks; }
function parked0(){ const term=searchTerms.lot||""; return state.links.filter(l=> _inLot(l) && match(term,l.title,l.url,l.note||"")); }




function doLinkAdd(){ const t=$("#lk_title"),u=$("#lk_url"); const title=t?t.value.trim():"",url=safeWebUrl(u?u.value:""); if(!title||!url){ toast("A title and valid http(s) URL are required","warn"); return; } const selected=(linkCats||[]).filter(function(c){ return c && c!=="all"; }); const category=selected.length===1?selected[0]:""; state.links.unshift({id:uid(),title,url,category,favorite:false,created:nowMs()}); log("ok","Saved link: "+title+(category?" ["+category+"]":"")); saveState(); celebrate(); renderView(); toast("Link saved","ok"); }

function viewFolders(){
  const term=searchTerms.folders||"";
  let items=state.folders.filter(f=>{ const catOk=!folderCats.length||folderCats.indexOf(normCat(f))>=0; const passF=folderFilter==="all"?true:!!f.favorite; return catOk&&passF&&match(term,f.name,f.path); });
  const addbar=`<div class="toolbar linkbar"><input class="lin-input" id="fd_name" placeholder="Name (optional)"><input class="lin-input lk-url" id="fd_path" placeholder="Folder path  e.g. C:\\Users\\you\\Documents"><button class="btn primary" data-action="folder-add">＋ Add</button></div>`;
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${Object.keys(FOLDER_CATS).map(c=>pill(c,folderCats.indexOf(c)>=0,FOLDER_CATS[c],'data-action="folder-cat" data-cat="'+esc(c)+'"')).join("")+'<button class="cat-add-btn" data-action="cat-add" data-type="folder" title="Add category">+</button>'}</div><div class="lf-right">${pill(ICO_STAR+" Favorites",folderFilter==="fav",FAV_COLOR,'data-action="folder-filter" data-filter="'+(folderFilter==="fav"?"all":"fav")+'"')}</div></div>`;
  let body;
  if(!state.folders.length) body=emptyState(ICO_FOLDER,"No quick folders yet — paste a path above. "+openVerb()+" · right-click for more.");
  else if(!items.length) body=emptyState(ICO_SEARCH,"Nothing matches. Try a different tab or Ctrl+F.");
  else body=`<div class="folder-list">`+items.map(f=>{ const p=f.path||f.name||""; const label=(f.name&&f.path)?f.name:baseName(p); const pinned=isPetPinned(p); return `<div class="folder-row" style="${edgeShadow(f)}" data-ctx="folder" data-id="${f.id}" data-action="folder-open"><span class="fr-ico">${ICO_FOLDER}</span><div class="fr-main"><div class="fr-name">${esc(label||"Untitled")}</div><div class="fr-path" title="${esc(p)}">${esc(p)}</div></div><div class="fr-meta">${pinned?`<span class="fr-pin" title="Pinned to Pet Recents">${ICO_PIN_DIAG}</span>`:""}<span class="fr-date">${esc(fmtDate(f.created))}</span></div></div>`; }).join("")+`</div>`;
  return head("Quick Folders",""+openVerb()+" · right-click for more · Ctrl+F to search")+addbar+searchRow("folders","Search folders...")+pills+body;
}

const SHOT_DEFAULT_COLS={};
const SHOT_PAGE=100;
let _shotIndex=[];
let shotPage=0;
let shotSize="l";
let _ssTimer=null;
function getShotCols(){ return Object.assign({}, (state.shotCollections&&typeof state.shotCollections==="object")?state.shotCollections:{}); }
const _shotFullUrls={}; const _shotFullOrder=[];
async function shotFileURL(p){ p=String(p||""); if(_shotFullUrls[p])return _shotFullUrls[p]; if(!E||!E.shotsRead)return ""; const bytes=await E.shotsRead(p); if(!bytes||!bytes.byteLength)return ""; const ext=(p.split(".").pop()||"png").toLowerCase(); const mime={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",bmp:"image/bmp",jfif:"image/jpeg"}[ext]||"application/octet-stream"; const url=URL.createObjectURL(new Blob([bytes],{type:mime})); _shotFullUrls[p]=url; _shotFullOrder.push(p); while(_shotFullOrder.length>30){const old=_shotFullOrder.shift();URL.revokeObjectURL(_shotFullUrls[old]);delete _shotFullUrls[old];} return url; }
function shotMeta(path){ const k=normFolderPath(path); return (state.shots||[]).find(function(s){ return normFolderPath(s.path)===k; })||null; }
function shotEnsure(path, name, mtime){
  let s=shotMeta(path);
  if(!s){ s={id:uid(), path:path, name:name||baseName(path), mtime:mtime||0, collection:"", note:"", added:nowMs()}; state.shots=state.shots||[]; state.shots.push(s); }
  return s;
}
function shotIsInboxRow(s){ return !s.collection; }
function shotsVisible(){
  const term=searchTerms.shots||"";
  const rows=_shotIndex.map(function(f){
    const m=shotMeta(f.path);
    return { id:m?m.id:("v:"+f.path), path:f.path, name:f.name, mtime:f.mtime, size:f.size, collection:(m&&m.collection)||"", note:(m&&m.note)||"" };
  });
  return rows.filter(function(s){
    if(shotFilter==="inbox"){ if(s.collection) return false; }
    else if((s.collection||"")!==shotFilter) return false;
    return match(term, s.name, s.note||"", s.collection||"", s.path);
  }).slice().sort(function(a,b){ return (b.mtime||0)-(a.mtime||0); });
}
async function shotsRefresh(silent){
  if(!E||!E.shotsScan) return;
  try{
    const pack=await E.shotsScan(state.shotWatch&&state.shotWatch.length?state.shotWatch:null);
    if(pack&&pack.roots&&!(state.shotWatch&&state.shotWatch.length)){ state.shotWatch=pack.roots.slice(); }
    _shotIndex=(pack&&pack.files)||[];
    const keep=(state.shots||[]).filter(function(s){ return !!(s.collection||s.note); });
    if(keep.length!==(state.shots||[]).length){ state.shots=keep; saveState(); }
    if(!silent) toast("Refreshed · "+_shotIndex.length+" images","ok");
    if(currentView==="shots") renderView();
  }catch(e){ if(!silent) toast("Could not scan screenshot folders","warn"); }
}
const _shotThumbs={};
const _shotThumbOrder=[];
const _thumbQueue=[];
const _thumbPending={};
let _thumbActive=0;
function shotThumbKey(p,mtime){ return String(p||"")+"\u0000"+String(Math.trunc(Number(mtime)||0)); }
function shotCacheSet(key,url){
  _shotThumbs[key]=url;
  const i=_shotThumbOrder.indexOf(key); if(i>=0) _shotThumbOrder.splice(i,1);
  _shotThumbOrder.push(key);
  while(_shotThumbOrder.length>200){ const old=_shotThumbOrder.shift(); delete _shotThumbs[old]; }
}
function shotThumbPump(){
  while(_thumbActive<4 && _thumbQueue.length){
    const job=_thumbQueue.shift(); _thumbActive++;
    Promise.resolve(E.shotsThumb(job.path)).then(function(url){ if(url)shotCacheSet(job.key,url); job.resolve(url||""); },function(){job.resolve("");}).finally(function(){ _thumbActive--; delete _thumbPending[job.key]; shotThumbPump(); });
  }
}
function shotThumbRequest(path,key){
  if(_thumbPending[key]) return _thumbPending[key];
  _thumbPending[key]=new Promise(function(resolve){ _thumbQueue.push({path:path,key:key,resolve:resolve}); shotThumbPump(); });
  return _thumbPending[key];
}
function shotLoadThumb(img){
  const p=img.getAttribute("data-spath"); if(!p) return;
  const key=shotThumbKey(p,img.getAttribute("data-smtime"));
  if(_shotThumbs[key]){ img.src=_shotThumbs[key]; return; }
  if(!E||!E.shotsThumb) return;
  shotThumbRequest(p,key).then(function(url){ if(url&&img.isConnected&&shotThumbKey(img.getAttribute("data-spath"),img.getAttribute("data-smtime"))===key) img.src=url; });
}
let _thumbObs=null;
function shotsHydrateThumbs(){
  if(_thumbObs){ try{ _thumbObs.disconnect(); }catch(_){} _thumbObs=null; }
  const root=document.getElementById("content");
  const imgs=document.querySelectorAll("img.shot-thumb[data-spath]");
  if(!imgs.length) return;
  if(typeof IntersectionObserver==="undefined"){ imgs.forEach(shotLoadThumb); return; }
  _thumbObs=new IntersectionObserver(function(ents){
    ents.forEach(function(ent){ if(!ent.isIntersecting) return; _thumbObs.unobserve(ent.target); shotLoadThumb(ent.target); });
  },{ root:root||null, rootMargin:"240px", threshold:0.01 });
  imgs.forEach(function(img){
    const p=img.getAttribute("data-spath");
    const key=shotThumbKey(p,img.getAttribute("data-smtime"));
    if(p&&_shotThumbs[key]){ img.src=_shotThumbs[key]; return; }
    _thumbObs.observe(img);
  });
}
let _shotScanning=false;
function viewShots(){
  if(!_shotIndex.length && !_shotScanning && E&&E.shotsScan){ _shotScanning=true; shotsRefresh(true).then(function(){ _shotScanning=false; }); }
  if(state.settings&&state.settings.shotSize){ shotSize=state.settings.shotSize==="s"?"s":"l"; }
  const cols=getShotCols();
  const all=shotsVisible();
  const pages=Math.max(1, Math.ceil(all.length/SHOT_PAGE));
  if(shotPage>pages-1) shotPage=pages-1;
  if(shotPage<0) shotPage=0;
  const slice=all.slice(shotPage*SHOT_PAGE, shotPage*SHOT_PAGE+SHOT_PAGE);
  const inboxN=_shotIndex.filter(function(f){ const m=shotMeta(f.path); return !(m&&m.collection); }).length;
  const tray=shotFilter==="inbox"?"Inbox":shotFilter;
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${
    Object.keys(cols).map(c=>pill(c,shotFilter===c,cols[c],'data-action="shot-filter" data-filter="'+esc(c)+'"')).join("")
  }<button class="cat-add-btn" data-action="cat-add" data-type="shot" title="Add category">+</button></div><div class="lf-right"></div></div>`;
  const banner=`<div class="shot-banner"><span class="lb-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg></span><div><div class="sb-title"><b>${esc(tray.toUpperCase())}</b> · ${all.length} image${all.length===1?"":"s"} · page ${shotPage+1}/${pages}${shotFilter==="inbox"?" · unfiled":""}</div><div style="font-size:11px;color:var(--dim);margin-top:2px">watching ${(state.shotWatch&&state.shotWatch.length)?state.shotWatch.length:"default"} folder(s) · images only · right-click to refresh</div></div><div class="shot-tools"><div class="shot-sizes"><button type="button" class="${shotSize==="s"?"on":""}" data-action="shot-size" data-size="s" title="Small">Small</button><button type="button" class="${shotSize==="l"?"on":""}" data-action="shot-size" data-size="l" title="Wide">Wide</button></div></div></div>`;
  let body;
  if(!_shotIndex.length) body=emptyState(ICO_FOLDER,"No screenshots found — drop PNGs in your Screenshots folder, or add another folder.");
  else if(!all.length) body=emptyState(ICO_SEARCH,"Nothing in this tray yet.");
  else body=`<div class="shot-grid size-${shotSize}">`+slice.map(function(s){
    const src=_shotThumbs[shotThumbKey(s.path,s.mtime)]||"";
    return `<div class="shot-card" data-ctx="shot" data-id="${esc(s.id)}" data-action="shot-open"><img class="shot-thumb" data-spath="${esc(s.path)}" data-smtime="${esc(s.mtime||0)}" src="${src}" alt=""><div class="shot-cap"><b>${esc(s.name)}</b><span>${esc(fmtDate(s.mtime))}</span></div></div>`;
  }).join("")+`</div>`;
  const pager=pages>1?`<div class="shot-pager"><button type="button" data-action="shot-page" data-dir="-1"${shotPage<=0?" disabled":""}>‹ Prev</button><span>Page ${shotPage+1} / ${pages} · ${SHOT_PAGE} per page</span><button type="button" data-action="shot-page" data-dir="1"${shotPage>=pages-1?" disabled":""}>Next ›</button></div>`:"";
  return head("Screenies", (shotFilter==="inbox"?"Inbox — unfiled captures":"Tray: "+shotFilter)+" · click to open · right-click to file / copy / look up")+banner+pills+searchRow("shots","Search screenies...")+body+pager;
}
function shotById(id){
  if(!id) return null;
  if(String(id).indexOf("v:")===0){
    const path=String(id).slice(2);
    const f=_shotIndex.find(function(x){ return x.path===path; });
    if(!f) return null;
    return { id:id, path:f.path, name:f.name, mtime:f.mtime, collection:"", note:"" };
  }
  return find(state.shots||[], id);
}
function shotFileTo(id, col){
  const s=shotById(id); if(!s) return;
  const rec=shotEnsure(s.path, s.name, s.mtime);
  rec.collection=col||"";
  if(!rec.collection && !rec.note){ state.shots=(state.shots||[]).filter(function(x){ return x.id!==rec.id; }); }
  saveState(); toast(col?("Filed → "+col):"Moved to Inbox","ok");
  if(shotOpenId) shotShow(rec.collection?rec.id:("v:"+s.path)); else renderView();
}
async function shotShow(id){
  const s=shotById(id); if(!s) return;
  shotOpenId=s.id;
  const box=$("#shotbox"), img=$("#shotbox-img"), nm=$("#shotbox-name");
  if(!box) return;
  box.classList.remove("zoomed"); shotResetPan();
  if(img){ img.style.width=""; img.style.height=""; img.style.maxWidth=""; img.style.maxHeight=""; img.removeAttribute("src"); img.alt=s.name; const url=await shotFileURL(s.path); if(shotOpenId===s.id&&url)img.src=url; }
  if(nm) nm.textContent=s.name+(s.collection?"  ·  "+s.collection:"");
  box.classList.add("show");
}
function shotHide(){ shotOpenId=null; const box=$("#shotbox"); if(box){ box.classList.remove("show"); box.classList.remove("zoomed"); box.classList.remove("panning"); } const img=$("#shotbox-img"); if(img){ img.style.width=""; img.style.height=""; img.style.maxWidth=""; img.style.maxHeight=""; img.style.transform=""; } _panX=0; _panY=0; }
let _panX=0,_panY=0,_panning=false,_panMoved=false,_panLX=0,_panLY=0;
function shotResetPan(){
  _panX=0; _panY=0;
  const img=$("#shotbox-img");
  if(img) img.style.transform="";
  const box=$("#shotbox"); if(box) box.classList.remove("panning");
}
function shotApplyPan(){
  const img=$("#shotbox-img"); if(!img) return;
  const maxX=Math.max(40,(img.offsetWidth-window.innerWidth)/2+80);
  const maxY=Math.max(40,(img.offsetHeight-window.innerHeight)/2+80);
  _panX=Math.max(-maxX,Math.min(maxX,_panX));
  _panY=Math.max(-maxY,Math.min(maxY,_panY));
  img.style.transform="translate("+_panX+"px,"+_panY+"px)";
}
function shotToggleZoom(){
  const box=$("#shotbox"), img=$("#shotbox-img");
  if(!box||!img) return;
  if(_panMoved){ _panMoved=false; return; }
  const on=!box.classList.contains("zoomed");
  box.classList.toggle("zoomed", on);
  shotResetPan();
  if(!on){ img.style.width=""; img.style.height=""; img.style.maxWidth=""; img.style.maxHeight=""; return; }
  const nw=img.naturalWidth||1, nh=img.naturalHeight||1;
  const fill=Math.min((window.innerWidth*0.94)/nw,(window.innerHeight*0.94)/nh);
  const scale=Math.max(fill, 2);
  img.style.maxWidth="none"; img.style.maxHeight="none";
  img.style.width=Math.round(nw*scale)+"px";
  img.style.height="auto";
}
(function(){
  const box=document.getElementById("shotbox");
  const img=document.getElementById("shotbox-img");
  if(!box||!img) return;
  img.addEventListener("pointerdown", function(e){
    if(e.button!==0 || !box.classList.contains("zoomed")) return;
    _panning=true; _panMoved=false; _panLX=e.clientX; _panLY=e.clientY;
    box.classList.add("panning");
    try{ img.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault(); e.stopPropagation();
  });
  img.addEventListener("pointermove", function(e){
    if(!_panning) return;
    const dx=e.clientX-_panLX, dy=e.clientY-_panLY;
    if(Math.abs(dx)+Math.abs(dy)>3) _panMoved=true;
    _panLX=e.clientX; _panLY=e.clientY;
    _panX+=dx; _panY+=dy;
    shotApplyPan();
    e.preventDefault();
  });
  function endPan(){ _panning=false; box.classList.remove("panning"); }
  img.addEventListener("pointerup", endPan);
  img.addEventListener("pointercancel", endPan);
})();
(function(){ const box=document.getElementById("shotbox"); if(!box) return; box.addEventListener("click",function(e){ if(e.target===box) shotHide(); });
  const im=document.getElementById("shotbox-img");
  if(im) im.addEventListener("contextmenu",function(e){ e.preventDefault(); e.stopPropagation(); if(shotOpenId) showCardMenu("shot", shotOpenId, e.clientX, e.clientY); });
})();
(function(){ const el=document.getElementById("shotshow"); if(!el) return; el.addEventListener("click",function(){ shotSlideshowStop(); }); })();
(function(){
  let down=false, moved=false, y0=0, s0=0;
  document.addEventListener("dragstart", function(e){ if(currentView==="shots") e.preventDefault(); }, true);
  document.addEventListener("pointerdown", function(e){
    if(currentView!=="shots" || e.button!==0) return;
    if(e.target.closest("button,input,.shot-banner,.shotbox,.shotshow,#overlay,#ctxmenu")) return;
    const el=document.getElementById("content"); if(!el) return;
    down=true; moved=false; y0=e.clientY; s0=el.scrollTop;
    try{ e.preventDefault(); }catch(_){}
  });
  document.addEventListener("pointermove", function(e){
    if(!down) return;
    const el=document.getElementById("content"); if(!el) return;
    const dy=e.clientY-y0;
    if(!moved && Math.abs(dy)<8) return;
    moved=true;
    el.classList.add("shot-drag");
    el.scrollTop=s0-dy;
    e.preventDefault();
  }, {passive:false});
  document.addEventListener("pointerup", function(){ down=false; const el=document.getElementById("content"); if(el) el.classList.remove("shot-drag"); }, true);
  document.addEventListener("click", function(e){
    if(!moved) return;
    e.stopPropagation(); e.preventDefault();
    moved=false;
  }, true);
})();
function shotStep(dir){
  const list=shotsVisible(); if(!list.length||!shotOpenId) return;
  let i=list.findIndex(function(s){ return s.id===shotOpenId || s.path===(shotById(shotOpenId)||{}).path; });
  if(i<0) i=0; else i=(i+dir+list.length)%list.length;
  shotShow(list[i].id);
}
function shotLookup(id){
  const s=shotById(id); if(!s||!E||!E.shotsLookup) return;
  Promise.resolve(E.shotsLookup(s.path)).then(function(ok){
    if(ok) toast("Copied — paste into Google Lens (Ctrl+V)","ok");
    else toast("Could not open Look up","warn");
  });
}
function shotCopy(id){
  const s=shotById(id); if(!s||!E||!E.shotsCopy){ toast("Copy needs the desktop app","warn"); return; }
  Promise.resolve(E.shotsCopy(s.path)).then(function(ok){ toast(ok?"Copied to clipboard":"Could not copy","ok"); });
}
function shotSlideshowStop(){
  if(_ssTimer){ clearInterval(_ssTimer); _ssTimer=null; }
  const el=$("#shotshow"); if(el) el.classList.remove("on");
  const a=$("#shotshow-img-a"), b=$("#shotshow-img-b");
  if(a){ a.classList.remove("on"); a.removeAttribute("src"); }
  if(b){ b.classList.remove("on"); b.removeAttribute("src"); }
  _ssFlip=false;
  shotIdleKick();
}
let _ssFlip=false;
function shotSlideshowStart(fromIdle){
  const list=fromIdle
    ? _shotIndex.map(function(f){ return {path:f.path}; })
    : shotsVisible();
  if(list.length<2){ if(!fromIdle) toast("Need at least 2 images for a slideshow","warn"); return; }
  if(!_shotIndex.length && fromIdle) return;
  shotHide();
  const el=$("#shotshow"), a=$("#shotshow-img-a"), b=$("#shotshow-img-b");
  if(!el||!a||!b) return;
  el.classList.add("on");
  _ssFlip=false;
  async function tick(){
    const s=list[Math.floor(Math.random()*list.length)];
    const next=_ssFlip?b:a;
    const prev=_ssFlip?a:b;
    next.onload=function(){ next.classList.add("on"); prev.classList.remove("on"); };
    const url=await shotFileURL(s.path); if(!url)return; next.src=url;
    if(next.complete){ next.classList.add("on"); prev.classList.remove("on"); }
    _ssFlip=!_ssFlip;
  }
  a.classList.remove("on"); b.classList.remove("on");
  tick();
  if(_ssTimer) clearInterval(_ssTimer);
  _ssTimer=setInterval(tick, 3000);
}
const SHOT_IDLE_MS=300000;
let _idleT=null;
function shotIdleKick(){
  if(_idleT) clearTimeout(_idleT);
  if($("#shotshow")&&$("#shotshow").classList.contains("on")) return;
  _idleT=setTimeout(function(){ shotSlideshowStart(true); }, SHOT_IDLE_MS);
}

function doFolderAdd(){ const n=$("#fd_name"),p=$("#fd_path"); const name=n?n.value.trim():"",path=p?p.value.trim():""; if(!path){ toast("Paste a folder path","warn"); return; } state.folders.unshift({id:uid(),name,path,category:folderCat!=="all"?folderCat:"",favorite:false,created:nowMs()}); log("ok","Added quick folder: "+(name||baseName(path))+(folderCat!=="all"?" ["+folderCat+"]":"")); saveState(); celebrate(); renderView(); toast("Folder saved","ok"); }
function folderEditModal(id){ const f=find(state.folders,id); if(!f)return; const p=f.path||f.name||""; openModal("Edit Quick Folder",`<div class="field"><label>Name (optional)</label><input id="fe_name" value="${esc(f.name||"")}"></div><div class="field"><label>Folder path</label><input id="fe_path" value="${esc(p)}"></div>`,"Save",()=>{ const path=$("#fe_path").value.trim(); if(!path){ toast("Path required","warn"); return; } f.name=$("#fe_name").value.trim(); f.path=path; log("info","Updated quick folder: "+(f.name||baseName(path))); saveState(); closeModal(); renderView(); toast("Folder updated","ok"); }); }

function viewConsole(){
  const term=searchTerms.console||"";
  const items=state.console.filter(c=>match(term,c.message,c.level)).slice().reverse();
  const toolbar=`<div class="toolbar"><button class="btn sm danger" data-action="console-clear">🗑 Clear log</button></div>`;
  const lines=items.length?items.map(c=>{ const ts=new Date(c.ts).toLocaleTimeString([],{hour12:false}); const addBtn=(c.meta&&c.meta.url)?`<button class="term-add" data-action="console-add-link" data-id="${c.id}" title="Save this site to Links">＋</button>`:""; return `<div class="term-line"><span class="tt">[${ts}]</span>&nbsp;<span class="lv ${c.level}">${esc(c.level.toUpperCase())}</span>&nbsp;<span class="ms">${linkify(c.message)}</span>${addBtn}</div>`; }).join(""):`<div class="term-empty">// no activity yet — type a command below (try: ${esc(state.radCmd)} "Anime")</div>`;
  const termHtml=`<div class="term"><div class="term-bar"><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="t">activity.log · Ctrl+F to grep · ＋ saves a VISIT to Links</span></div><div class="term-body">${lines}</div></div>`;
  return head("Console","Live log + commands · Ctrl+F to grep")+searchRow("console","Grep the log...")+toolbar+termHtml;
}

function openModal(t,b,l,onC,onX,danger){ $("#modal-title").innerHTML=t; $("#modal-body").innerHTML=b; const mc=$("#modal-confirm"); if(mc){ mc.textContent=l||"Save"; mc.classList.remove("hidden"); mc.classList.toggle("kill-go",!!danger); if(danger) mc.classList.remove("primary"); else mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb){ xb.classList.remove("hidden"); xb.textContent="Cancel"; } const md=document.querySelector("#overlay .modal"); if(md) md.classList.toggle("danger",!!danger); modalOnConfirm=onC||null; modalOnCancel=onX||null; $("#overlay").classList.add("show"); const f=$("#modal-body input, #modal-body textarea, #modal-body select"); if(f)setTimeout(()=>f.focus(),30); }
function closeModal(){ $("#overlay").classList.remove("show"); modalOnConfirm=null; modalOnCancel=null; const md=document.querySelector("#overlay .modal"); if(md) md.classList.remove("danger"); const mc=$("#modal-confirm"); if(mc){ mc.classList.remove("kill-go"); mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb) xb.textContent="Cancel"; }
function cancelModal(){ const c=modalOnCancel; closeModal(); if(typeof c==="function")c(); }
function confirmModal(m,danger,spec){ return new Promise(res=>{ spec=spec||{}; const ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>'; const title=spec.title||(danger?ico+" Arm kill switch":"⚠️ Confirm"); const go=spec.go||(danger?"Arm it":"Yes, do it"); openModal(title,`<p style="margin:0;color:var(--muted)">${esc(m)}</p>`,go,()=>{closeModal();res(true);},()=>res(false),!!danger); const xb=$("#modalCancelBtn"); if(xb&&spec.cancel) xb.textContent=spec.cancel; setTimeout(()=>{const b=$("#modal-confirm");if(b)b.focus();},30); }); }
function val(id){ const e=$("#"+id); return e?e.value.trim():""; }
function vaultModal(e){ e=e||{}; openModal(`${e.id?"Edit":"New"} Vault Entry`,`<div class="field"><label>Site / service name</label><input id="v_name" value="${esc(e.name||"")}" placeholder="e.g. Gmail"></div><div class="field"><label>Website URL</label><input id="v_url" value="${esc(e.url||"")}" placeholder="https://..."></div><div class="field"><label>Username / email</label><input id="v_user" value="${esc(e.username||"")}" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="v_pass" type="password" value="${esc(e.password||"")}" placeholder="••••••••"></div><div class="checkrow" style="gap:18px"><label class="checkrow"><input type="checkbox" id="v_fav" ${e.favorite?"checked":""}> Favorite</label><label class="checkrow"><input type="checkbox" id="v_pri" ${e.priority?"checked":""}> Priority</label></div>`,"Save",()=>{ const name=val("v_name"),rawUrl=val("v_url"),url=rawUrl?safeWebUrl(rawUrl):""; if(!name){ toast("Name is required","warn"); return; } if(rawUrl&&!url){ toast("Website must be an http(s) URL","warn"); return; } const d={name,url,username:val("v_user"),password:$("#v_pass").value,favorite:$("#v_fav").checked,priority:$("#v_pri").checked}; if(e.id){ Object.assign(find(state.vault,e.id),d); log("info","Updated vault entry: "+name); toast("Entry updated","ok"); } else { state.vault.unshift(Object.assign({id:uid(),created:nowMs()},d)); log("ok","Added vault entry: "+name); toast("Entry saved","ok"); } saveState(); closeModal(); celebrate(); renderView(); }); }

/* context menu — text coloured per item */
function mi(a,id,label,color,danger){ const st=color?` style="color:${color}"`:``; return `<div class="ci${danger?" danger":""}" data-action="${a}" data-id="${id}"${st}>${esc(label)}</div>`; }
function miT(a,id,label,on,color){ const st=color?` style="color:${color}"`:``; return `<div class="ci${on?" on":""}" data-action="${a}" data-id="${id}"${st}>${on?"✓ ":""}${esc(label)}</div>`; }
function miCat(id,cat,on){ const color=CAT_COLORS[cat]||"#cfd3dc"; return `<div class="ci${on?" on":""}" data-action="link-cat-set" data-id="${id}" data-cat="${esc(cat)}" style="color:${color}"><span class="cdot" style="background:${color}"></span>${on?"✓ ":""}${esc(cat)}</div>`; }
function miCatF(id,cat,on){ const color=FOLDER_CATS[cat]||"#cfd3dc"; return `<div class="ci${on?" on":""}" data-action="folder-cat-set" data-id="${id}" data-cat="${esc(cat)}" style="color:${color}"><span class="cdot" style="background:${color}"></span>${on?"✓ ":""}${esc(cat)}</div>`; }
function showMenu(x,y,html){ const m=$("#ctxmenu"); m.innerHTML=html; m.classList.add("show"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function hideMenu(){ $("#ctxmenu").classList.remove("show"); }
function moveMenuTo(x,y){ const m=$("#ctxmenu"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function alignMenuToBubble(el){ const m=$("#ctxmenu"); const br=el.getBoundingClientRect(); const mr=m.getBoundingClientRect(); let left=br.right+8, top=br.bottom-mr.height; if(top<4)top=4; if(left+mr.width>window.innerWidth-8)left=window.innerWidth-mr.width-8; if(left<4)left=4; m.style.top=top+"px"; m.style.left=left+"px"; }
function showCardMenu(type,id,x,y){
  let it="";
  if(type==="vault"){ const v=find(state.vault,id); if(!v)return; if(v.url)it+=mi("vault-open",id,"Open site"); it+=mi("vault-copy-u",id,"Copy username")+mi("vault-copy-p",id,"Copy password")+mi("vault-eye",id,revealed.has(id)?"Hide password":"Show password")+miT("vault-fav",id,"Favorite",v.favorite,FAV_COLOR)+miT("vault-pri",id,"Priority",v.priority,PRI_COLOR)+mi("vault-edit",id,"Edit")+`<div class="cdiv"></div>`+mi("vault-del",id,"Delete","#ff5470",true); }
  else if(type==="link"){ const l=find(state.links,id); if(!l)return; it+=mi("link-open",id,"Open")+miT("link-fav-toggle",id,"Favorite",l.favorite,FAV_COLOR)+`<div class="cdiv"></div><div class="cm-head">Category</div>`+Object.keys(CAT_COLORS).map(c=>miCat(id,c,normCat(l)===c)).join("")+miCat(id,"__none__",!normCat(l))+mi(l.inLinks?"link-unsend":"link-send", id, l.inLinks?"Remove from Links":"Send to Links")+`<div class="cdiv"></div>`+mi("link-del",id,"Delete","#ff5470",true); }
  else if(type==="folder"){ const f=find(state.folders,id); if(!f)return; const fp=f.path||f.name||""; const pn=petPinCount(); const pinned=isPetPinned(fp); const pinLab=pinned?("Unpin from Pet Recents ("+pn+"/3)"):(pn>=3?"Pet recents full (3/3)":"Pin to Pet Recents ("+pn+"/3)"); it+=mi("folder-open",id,"Open")+miT("folder-fav",id,"Favorite",f.favorite,FAV_COLOR)+mi("folder-edit",id,"Edit")+miT("folder-pet-pin",id,pinLab,pinned,"#ff79c6")+`<div class="cdiv"></div><div class="cm-head">Category</div>`+Object.keys(FOLDER_CATS).map(c=>miCatF(id,c,normCat(f)===c)).join("")+miCatF(id,"__none__",!normCat(f))+`<div class="cdiv"></div>`+mi("folder-del",id,"Remove","#ff5470",true); }
  else if(type==="shot"){ const s=shotById(id); if(!s)return; it+=mi("shot-open",id,"Open")+mi("shot-copy",id,"Copy image")+mi("shot-lookup",id,"Look up on Google Lens","#27b4ff")+`<div class="cdiv"></div>`+mi("shot-reveal",id,"Reveal in Explorer")+mi("shot-refresh","","Refresh","#ff79c6"); }
  else return;
  showMenu(x,y,it);
}

function openByAction(a,id){
  if(a==="vault-open"){ const v=find(state.vault,id); if(v&&v.url){ openTarget(v.url,"url"); log("info","Opened site: "+v.name); } }
  else if(a==="link-open"){ const l=find(state.links,id); if(l){ l.opens=(l.opens||0)+1; l.lastOpened=nowMs(); saveState(); openTarget(l.url,"url"); log("info","Opened link: "+l.title); } }
  else if(a==="folder-open"){ const f=find(state.folders,id); if(f){ const p=f.path||f.name||""; if(p){ openTarget(p,"app"); recordFolderVisit(p); } } }
}
document.addEventListener("dblclick",(ev)=>{ const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action; if((a==="vault-open"||a==="link-open"||a==="folder-open")&&(state.openMode||'double')==='double'){ openByAction(a,t.dataset.id); } });
document.addEventListener("click",async(ev)=>{
  const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action,id=t.dataset.id;
  if((a==="vault-open"||a==="link-open"||a==="folder-open")&&!t.closest("#ctxmenu")&&(state.openMode||'double')==='double')return;
  switch(a){
    case "nav": currentView=t.dataset.nav; $("#content").classList.remove("searching"); searchTerms={}; renderNav(); renderView(); break;
    case "win-min": E&&E.winMin?E.winMin():toast("Window controls work in the desktop build"); break;
    case "win-max": E&&E.winMax?E.winMax():toast("Window controls work in the desktop build"); break;
    case "win-close": E&&E.winClose?E.winClose():toast("Window controls work in the desktop build"); break;
    case "vault-new": vaultModal(); break;
    case "vault-edit": vaultModal(find(state.vault,id)); break;
    case "vault-del": { const v=find(state.vault,id); if(v&&await confirmModal("Delete "+v.name+"?")){ state.vault=state.vault.filter(x=>x.id!==id); log("warn","Deleted vault entry: "+v.name); saveState(); renderView(); toast("Deleted","ok"); } break; }
    case "vault-fav": { const v=find(state.vault,id); if(v){ v.favorite=!v.favorite; log("info",(v.favorite?"Favorited":"Unfavorited")+": "+v.name); saveState(); renderView(); } break; }
    case "vault-pri": { const v=find(state.vault,id); if(v){ v.priority=!v.priority; log("info",(v.priority?"Priority on":"Priority off")+": "+v.name); saveState(); renderView(); } break; }
    case "vault-eye": if(revealed.has(id))revealed.delete(id); else revealed.add(id); renderView(); break;
    case "vault-open": openByAction("vault-open",id); break;
    case "vault-copy-u": { const v=find(state.vault,id); if(v)copy(v.username||"","Username"); break; }
    case "vault-copy-p": { const v=find(state.vault,id); if(v)copy(v.password||"","Password"); break; }
    case "vault-filter": vaultFilter=t.dataset.filter; renderView(); break;
    case "link-add": doLinkAdd(); break;
    case "link-cat": { const cat=t.dataset.cat; if(cat==="all"){ linkCats=[]; } else { const idx=linkCats.indexOf(cat); if(idx>=0) linkCats.splice(idx,1); else linkCats.push(cat); const ai=linkCats.indexOf("all"); if(ai>=0) linkCats.splice(ai,1); } renderView(); break; }
    case "link-fav": linkFav=!linkFav; renderView(); break;
    case "link-fav-toggle": { const l=find(state.links,id); if(l){ l.favorite=!l.favorite; log("info",(l.favorite?"Favorited":"Unfavorited")+" link: "+l.title); saveState(); renderView(); } break; }
    case "link-cat-set": { const l=find(state.links,id); if(l){ l.category=(t.dataset.cat==="__none__")?"":t.dataset.cat; log("info","Tagged link "+l.title+" → "+(l.category||"none")); saveState(); renderView(); } break; }
    case "link-open": openByAction("link-open",id); break;
    case 'link-drill': linkDrill=t.dataset.coll||null; renderView(); break;
    case 'link-drill-back': linkDrill=null; renderView(); break;
    case 'link-openall': { var cn=t.dataset.coll; var list=state.links.filter(function(l){return (l.coll||'')===cn;}); if(list.length>8 && !(await confirmModal('Open '+list.length+' tabs from '+cn+'?'))) break; list.forEach(function(l){ if(E&&E.shellOpen)E.shellOpen(l.url); else try{window.open(l.url,'_blank');}catch(_){} }); log('info','opened '+list.length+' links from '+cn); break; }
        case "cat-del-ctx": { var cn3=(t.dataset.cat||"").trim(); if(cn3){ confirmModal("Delete category \""+cn3+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn3); toast("Category deleted","ok"); } }); } break; }
    case "cat-del": { const cat=t.dataset.cat; if(cat&&state.categories&&state.categories[cat]){ confirmModal("Delete category \""+cat+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cat); toast("Category deleted","ok"); } }); } break; }
    case "cat-add": { const catType=t.dataset.type||"link"; openModal("New Category", '<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:60px;height:40px;border:none;border-radius:4px;background:var(--input);cursor:pointer;padding:0"></div></div>', "Create", function(){ var name=($("#cat_name")||{}).value||""; name=name.trim(); if(!name){ toast("Name required","warn"); return; } var cc=CAT_COLORS[name]; if(cc&&(!state.categories||!state.categories[name])&&DEFAULT_CATS[name]){ toast("Category already exists","warn"); return; } if(state.categories&&state.categories[name]){ toast("Category already exists","warn"); return; } var color=($("#cat_color")||{}).value||"#27b4ff"; if(catType==="folder"){if(!state.folderCategories)state.folderCategories={};state.folderCategories[name]=color;saveState();refreshFolderCats();renderView();}else if(catType==="shot"){if(!state.shotCollections)state.shotCollections={};if(state.shotCollections[name]||SHOT_DEFAULT_COLS[name]){toast("Category already exists","warn");return;}state.shotCollections[name]=color;saveState();renderView();}else{addCategory(name,color);}closeModal(); toast("Category created: "+name,"ok"); }); setTimeout(function(){ var i=document.getElementById("cat_name"); if(i) i.focus(); },30); break; }
    case "cat-del-pill": { var cn2=(t.dataset.cat||"").trim(); if(cn2){ confirmModal("Delete category \""+cn2+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn2); toast("Category deleted","ok"); } }); } break; }
    case "cat-delete": { var cn=id; confirmModal("Delete category \""+cn+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn); toast("Category deleted","ok"); } }); break; }
    case "link-del": { const l=find(state.links,id); if(l&&await confirmModal("Delete "+l.title+"?")){ state.links=state.links.filter(x=>x.id!==id); log("warn","Deleted link: "+l.title); saveState(); renderView(); } break; }
    case "folder-pet-pin": { const f=find(state.folders,id); if(f){ const p=f.path||f.name||""; const on=togglePetPin(p, f.name||baseName(p)); log("info",(on?"Pinned":"Unpinned")+" folder to Pet Recents: "+(f.name||p)); toast(on?"Pinned to Pet Recents":"Unpinned from Pet Recents","ok"); renderView(); } break; }
    case "open-folder-path": { const p=t.dataset.path; if(p) openTarget(p,"app"); break; }
    case "folder-add": doFolderAdd(); break;
    case "shot-filter": { const f=t.dataset.filter||"inbox"; shotFilter=(shotFilter===f)?"inbox":f; shotPage=0; renderView(); break; }
    case "shot-refresh": shotsRefresh(false); break;
    case "shot-size": shotSize=t.dataset.size||"m"; if(!state.settings)state.settings={}; state.settings.shotSize=shotSize; saveState(); renderView(); break;
    case "shot-page": shotPage+=(parseInt(t.dataset.dir,10)||0); if(shotPage<0)shotPage=0; renderView(); break;
    case "shot-slideshow": shotSlideshowStart(); break;
    case "kill-toggle": killToggle(); break;
    case "shot-copy":
    case "shot-copy-open": shotCopy(shotOpenId||id); break;
    case "shot-watch": { if(E&&E.shotsPickFolder){ E.shotsPickFolder().then(function(dir){ if(!dir) return; state.shotWatch=state.shotWatch||[]; if(state.shotWatch.indexOf(dir)<0){ state.shotWatch.push(dir); saveState(); toast("Watching "+dir,"ok"); shotsRefresh(); } }); } break; }
    case "shot-open": shotShow(id); break;
    case "shot-close": shotHide(); break;
    case "shot-zoom": { shotToggleZoom(); break; }
    case "shot-prev": shotStep(-1); break;
    case "shot-next": shotStep(1); break;
    case "shot-lookup":
    case "shot-lookup-open": shotLookup(shotOpenId||id); break;
    case "shot-reveal":
    case "shot-reveal-open": { const s=shotById(shotOpenId||id); if(s&&E&&E.shotsReveal) E.shotsReveal(s.path); break; }
    case "shot-file": shotFileTo(id, t.dataset.col||t.textContent||""); renderView(); break;
    case "shot-file-open": if(shotOpenId) shotFileTo(shotOpenId, t.dataset.col||""); renderView(); break;
    case "shot-unfile": shotFileTo(id, ""); renderView(); break;
    case "shot-fav": { const s=shotById(id); if(s){ s.favorite=!s.favorite; saveState(); renderView(); } break; }
    case "shot-forget": { const s=shotById(id); if(s&&await confirmModal("Remove "+s.name+" from Shots? The file on disk stays.")){ state.shots=state.shots.filter(function(x){ return x.id!==id; }); if(shotOpenId===id) shotHide(); saveState(); renderView(); toast("Removed from Shots","ok"); } break; }
    case "folder-open": openByAction("folder-open",id); break;
    case "folder-edit": folderEditModal(id); break;
    case "folder-fav": { const f=find(state.folders,id); if(f){ f.favorite=!f.favorite; log("info",(f.favorite?"Favorited":"Unfavorited")+" folder: "+(f.name||"")); saveState(); renderView(); } break; }
    case "folder-del": { const f=find(state.folders,id); if(f&&await confirmModal("Remove "+(f.name||baseName(f.path||f.name))+"?")){ state.folders=state.folders.filter(x=>x.id!==id); log("warn","Removed quick folder"); saveState(); renderView(); } break; }
    case "folder-cat": { const cat=t.dataset.cat; const idx=folderCats.indexOf(cat); if(idx>=0){folderCats.splice(idx,1);}else{folderCats.push(cat);} renderView(); break; }
    case "folder-cat-set": { const f=find(state.folders,id); if(f){ f.category=(t.dataset.cat==="__none__")?"":t.dataset.cat; log("info","Tagged folder "+(f.name||baseName(f.path||f.name))+" → "+(f.category||"none")); saveState(); renderView(); } break; }
    case "folder-filter": folderFilter=t.dataset.filter; renderView(); break;
    case "console-clear": if(await confirmModal("Clear the entire activity log?")){ state.console=[]; log("warn","Activity log cleared"); saveState(); renderView(); } break;
    case "console-add-link": { const c=find(state.console,id); if(c&&c.meta&&c.meta.url){ const u=c.meta.url; state.links.unshift({id:uid(),title:hostOf(u),url:u,category:"",favorite:false,created:nowMs()}); c.meta=null; log("ok","Saved visited site to Links: "+u); saveState(); renderView(); toast("Added to Links","ok"); } break; }
    case "console-add-folder": { const c=find(state.console,id); const p=c&&c.meta&&(c.meta.path||c.meta.openPath); if(p){ state.folders.unshift({id:uid(),name:baseName(p),path:p,category:"",favorite:false,created:nowMs()}); c.meta=null; log("ok","Saved opened folder to Quick Folders: "+p); saveState(); renderView(); toast("Added to Folders","ok"); } break; }
    case "norma-min": setFloating(true); break;
    case "norma-dock": setFloating(false); break;
    case "norma-pin": setFloating(!isFloating()); break;
    case "music-toggle": musicToggle(); break;
    case "music-next": musicNext(); break;
    case "music-prev": musicPrev(); break;
    case "music-open-folder": if(bgmDir && E && E.openPath){ E.openPath(bgmDir); } else if(bgmDir && E && E.shellOpen){ E.shellOpen(bgmDir); } break;
    case "update-check": updateCheckClick(false); break;
    case "open-github": openGithub(); break;
    case "toggle-autoscroll": { if(!state.settings)state.settings={}; state.settings.autoScroll=(state.settings.autoScroll===false); saveState(); updateAutoScrollBtn(); log("info","auto-scroll: "+(state.settings.autoScroll?"on":"off")); break; }
    case "update-later": hideUpdateModal(); break;
    case "update-go": updateGoClick(); break;
    case "modal-cancel": cancelModal(); break;
    case "modal-confirm": if(typeof modalOnConfirm==="function")modalOnConfirm(); break;
  }
});
function hostOf(u){ try{ const h=new URL(u).hostname; return h||String(u).slice(0,40); }catch(e){ return String(u).slice(0,40); } }

let _searchRenderTimer=null;
document.addEventListener("input",(ev)=>{ const s=ev.target.closest("[data-search]"); if(!s)return; const k=s.dataset.search,pos=s.value.length; searchTerms[k]=s.value; if(_searchRenderTimer)clearTimeout(_searchRenderTimer); _searchRenderTimer=setTimeout(function(){ _searchRenderTimer=null; if(k==="console"){ renderTermBody(); return; } renderView(); const again=document.querySelector('[data-search="'+k+'"]'); if(again){ again.focus(); try{ again.setSelectionRange(pos,pos); }catch(e){} } },140); });

document.addEventListener("keydown",(ev)=>{
  if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==="f"){
    const k={vault:"vault",links:"links",folders:"folders",console:"console",lot:"lot",shots:"shots"}[currentView];
    if(!k)return; ev.preventDefault();
    if(currentView==="console"){ const i=document.querySelector('[data-search="console"]'); if(i){i.focus();i.select();} return; }
    $("#content").classList.add("searching"); const i=document.querySelector('[data-search="'+k+'"]'); if(i){i.focus();i.select();}
    return;
  }
  if(ev.key==="Enter"&&$("#overlay").classList.contains("show")&&ev.target.tagName!=="TEXTAREA"&&ev.target.tagName!=="SELECT"&&ev.target.tagName!=="BUTTON"){ ev.preventDefault(); if(typeof modalOnConfirm==="function")modalOnConfirm(); return; }
  if($("#shotshow")&&$("#shotshow").classList.contains("on")){ ev.preventDefault(); shotSlideshowStop(); return; }
    if($("#shotbox")&&$("#shotbox").classList.contains("show")){
    if(ev.key==="Escape"){ ev.preventDefault(); shotHide(); return; }
    if(ev.key==="ArrowLeft"){ ev.preventDefault(); shotStep(-1); return; }
    if(ev.key==="ArrowRight"){ ev.preventDefault(); shotStep(1); return; }
  }
  if(ev.key==="Escape"){ if($("#shotbox")&&$("#shotbox").classList.contains("show")){shotHide();return;} if($("#overlay").classList.contains("show")){cancelModal();return;} if($("#ctxmenu").classList.contains("show")){hideMenu();return;} const ct=$("#content"); if(ct.classList.contains("searching")){ ct.classList.remove("searching"); searchTerms[currentView]=""; renderView(); } return; }
  if(ev.key==="Enter"&&!$("#overlay").classList.contains("show")&&ev.target&&ev.target.id){ if(ev.target.id.indexOf("lk_")===0){ ev.preventDefault(); doLinkAdd(); } else if(ev.target.id.indexOf("fd_")===0){ ev.preventDefault(); doFolderAdd(); } else if(ev.target.id==="termInput"){ ev.preventDefault(); const v=ev.target.value; ev.target.value=""; handleCommand(v); } }
});

document.addEventListener("contextmenu", function(ev){
  var pill=ev.target.closest('[data-action="link-cat"]');
  if(pill && pill.dataset.cat && pill.dataset.cat!=="all"){
    var cat=pill.dataset.cat;
    if(state.categories && state.categories[cat]){
      ev.preventDefault();
      showMenu(ev.clientX, ev.clientY, '<div class="ci danger" data-action="cat-del-ctx" data-cat="'+esc(cat)+'">Delete category "'+esc(cat)+'"</div>');
    }
  }
});

document.getElementById("norma").addEventListener("contextmenu", function(ev){
  if(!this.classList.contains("floating-placeholder")) return;
  ev.preventDefault();
  showMenu(ev.clientX, ev.clientY, '<div class="ci" data-action="norma-dock"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3z"/></svg>Dock Norma</div>');
});
document.addEventListener("contextmenu",(e)=>{ const c=e.target.closest("[data-ctx]"); if(c){ e.preventDefault(); showCardMenu(c.dataset.ctx,c.dataset.id,e.clientX,e.clientY); } });
document.addEventListener("contextmenu",function(e){ if(currentView!=="shots") return; if(e.target.closest("[data-ctx]")) return; if(e.target.closest("#ctxmenu")||e.target.closest("#overlay")||e.target.closest("#shotbox")||e.target.closest("#shotshow")) return; e.preventDefault(); showMenu(e.clientX,e.clientY,mi("shot-refresh","","Refresh","#ff79c6")); });
$("#ctxmenu").addEventListener("click",hideMenu);
document.addEventListener("click",(e)=>{ const m=$("#ctxmenu"); if(m.classList.contains("show")&&!m.contains(e.target)&&!e.target.closest("#norma-bubble")&&!e.target.closest("#norma"))hideMenu(); });

function isFloating(){ return $("#norma").classList.contains("floating-placeholder"); }
function setFloating(f){ if(f){ $("#norma").classList.add("floating-placeholder"); if(E&&E.petShow){E.petShow();} else { $("#norma-bubble").classList.add("show"); } log("info","Norma sent floating"); } else { $("#norma").classList.remove("floating-placeholder"); try{ $("#norma").scrollIntoView({block:"nearest"}); }catch(_){} $("#norma-bubble").classList.remove("show"); if(E&&E.petHide)E.petHide(); log("info","Norma pinned to panel"); } }
(function(){ const card=$("#norma"),bubble=$("#norma-bubble"); let moved=false;
  function menu(x,y){ showMenu(x,y,`<div class="ci" data-action="nav" data-nav="vault">${ICO_LOCK} Vault</div><div class="ci" data-action="nav" data-nav="links">${ICO_LINK} Links</div><div class="ci" data-action="nav" data-nav="folders">${ICO_FOLDER} Folders</div><div class="ci" data-action="nav" data-nav="shots">Shots</div>`); }

  bubble.addEventListener("contextmenu",e=>{e.preventDefault();const m=$("#ctxmenu");if(m.classList.contains("show")){hideMenu();}else{moved=false;menu(e.clientX,e.clientY);const br=bubble.getBoundingClientRect();alignMenuToBubble(bubble);}});
  let drag=false,ox=0,oy=0;
  bubble.addEventListener("pointerdown",e=>{if(e.button!==0)return;drag=true;moved=false;ox=e.clientX-bubble.offsetLeft;oy=e.clientY-bubble.offsetTop;try{bubble.setPointerCapture(e.pointerId);}catch(_){}bubble.style.cursor="grabbing";});
  bubble.addEventListener("pointermove",e=>{if(!drag)return;moved=true;let x=e.clientX-ox,y=e.clientY-oy;x=Math.max(4,Math.min(window.innerWidth-72,x));y=Math.max(4,Math.min(window.innerHeight-72,y));bubble.style.left=x+"px";bubble.style.top=y+"px"; if($("#ctxmenu").classList.contains("show")){ const br=bubble.getBoundingClientRect(); alignMenuToBubble(bubble); } });
  bubble.addEventListener("pointerup",e=>{if(e.button!==0)return;drag=false;bubble.style.cursor="grab";});
  const bdot=$("#bubbleDot"); if(bdot){ bdot.addEventListener("pointerdown",e=>e.stopPropagation()); bdot.addEventListener("click",e=>{e.stopPropagation();setFloating(false);}); }
})();

var _lastParked=null;
if(E&&E.onHotkeyPark) E.onHotkeyPark(function(txt){ var p=_parkParseClip(txt); if(!p){ try{toast("clipboard has no link","warn");}catch(_){} return; } var url=(p.url||"").trim(); if(url.indexOf("www.")===0) url="https://"+url; var nu=normUrl(url); if(!nu){ toast("could not parse URL","warn"); return; } var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ log("info","hotkey: already in Links — "+ex.title); toast("Already in Links","warn"); return; } var raw=p.title||_parkHost(url); var title=raw.length>45?raw.slice(0,42)+"...":raw; var link={id:uid(),title:title,url:url,category:"Check out",favorite:false,created:nowMs()}; state.links.unshift(link); saveState(); log("ok","hotkey → Links [Check out]: "+title); celebrate(); renderView(); toast("Added to Check out","ok"); });
if(E&&E.hotkeyStatus) E.hotkeyStatus(function(mm){ if(mm&&mm.enabled===false){ log('info','hotkey disabled — use  rad set hk  to enable'); } else { log(mm&&mm.ok?'ok':'warn', 'hotkey '+(mm&&mm.ok?'ready':'FAILED')+' ('+(mm&&mm.combo||'')+')'); } });
var _batchParkQueue=[], _batchParkTimer=null;
if(E&&E.onProtocolPark) E.onProtocolPark(function(d){ if(!d||!d.url) return; var url=d.url.trim(); if(url.indexOf("www.")===0) url="https://"+url; var nu=normUrl(url); if(!nu) return;
  if(d.lot){
    _batchParkQueue.push({url:url,title:d.title||_parkHost(url)});
    if(!_batchParkTimer){
      _batchParkTimer=setTimeout(function(){
        _batchParkTimer=null;
        var q=_batchParkQueue; _batchParkQueue=[];
        var added=0, dup=0;
        for(var i=0;i<q.length;i++){
          var r=_parkOne(q[i].title,q[i].url);
          if(r.dup) dup++; else if(!r.bad) added++;
        }
        if(added>0){ saveState(); renderView(); celebrate(); log("ok","extension \u2192 Parking Lot: "+added+" link(s) parked"+(dup?" ("+dup+" dupes skipped)":"")); toast("Parked "+added+" tab"+(added===1?"":"s")+" to Parking Lot","ok"); if(E&&E.showNotif) E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:added+" tab"+(added===1?"":"s")+" parked \u2713"}); }
        else if(dup>0){ toast(dup+" tab"+(dup===1?" was":"s were")+" already parked","warn"); }
      }, 600);
    }
    return;
  }
  var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ toast("Already in Links","warn"); if(E&&E.showNotif) E.showNotif({title:"Homie you already saved this link (\u00b4\u3002\uff3f\u3002\u0060)",body:ex.title||url}); return; } var raw=d.title||_parkHost(url); var title=raw.length>45?raw.slice(0,42)+"...":raw; var link={id:uid(),title:title,url:url,category:"Check out",favorite:false,created:nowMs()}; state.links.unshift(link); saveState(); log("ok","extension \u2192 Links [Check out]: "+title); celebrate(); renderView(); toast("Saved to Check out","ok"); if(E&&E.showNotif) E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:"Link saved \u2713  "+title}); });
if(E&&E.dataPath) E.dataPath(function(pp){ log('info','data file: '+pp); });
var lotSelLinks={}, lotSelColls={};
var linkSelLinks={};
function _lotCountSel(){ var t=Object.keys(lotSelLinks).length; Object.keys(lotSelColls).forEach(function(c){ state.links.forEach(function(l){ if((l.coll||"")===c) t++; }); }); return t; }
function _lotDeleteSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var total=_lotCountSel(); if(!total) return; function go(){ var kill={}; ids.forEach(function(x){kill[x]=1;}); colls.forEach(function(c){ state.links.forEach(function(l){ if((l.coll||"")===c) kill[l.id]=1; }); }); var n=Object.keys(kill).length; state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); lotSelLinks={}; lotSelColls={}; renderView(); log("warn","deleted "+n+" parked link(s)"); } if(total>4){ confirmModal("Delete "+total+" parked link(s)?").then(function(y){ if(y) go(); }); } else { go(); } }
function _lotClearSel(){ lotSelLinks={}; lotSelColls={}; renderView(); }
document.addEventListener("click", function(ev){
  var rb=ev.target.closest&&ev.target.closest(".lr-rename"); if(rb){ ev.stopPropagation(); ev.preventDefault(); var rr=rb.closest(".lot-row"); if(rr) renameStack(rr.dataset.coll); return; }
  var sb=ev.target.closest&&ev.target.closest(".lr-send, .lb-send"); if(sb){ ev.stopPropagation(); ev.preventDefault(); if(sb.classList.contains("lb-send")){ _lotSendSel(); } else { var r2=sb.closest(".lot-row"); if(r2) _sendCollToLinks(r2.dataset.coll); } return; }
  var ma=ev.target.closest&&ev.target.closest("#ctxmenu [data-action]"); if(ma){ var act=ma.getAttribute("data-action"); if(act==="link-send"||act==="link-unsend"){ ev.stopPropagation(); ev.preventDefault(); var lid=ma.getAttribute("data-id"); var ll=lid?find(state.links,lid):null; if(ll){ ll.inLinks=(act==="link-send"); saveState(); hideMenu(); renderView(); log("info",(act==="link-send"?"sent to Links: ":"removed from Links: ")+(ll.title||ll.url)); } return; } }
  var t=ev.target.closest&&ev.target.closest(".lot-bar .lb-del, .lot-bar .lb-clear, .lot-item, .lot-row");
  if(!t) return;
  if(t.classList.contains("lb-del")){ ev.stopPropagation(); ev.preventDefault(); _lotDeleteSel(); return; }
  if(t.classList.contains("lb-clear")){ ev.stopPropagation(); ev.preventDefault(); _lotClearSel(); return; }
  if(!(ev.ctrlKey||ev.metaKey)) return;
  ev.stopPropagation(); ev.preventDefault();
  if(t.classList.contains("lot-item")){ var lid=t.dataset.id; if(lotSelLinks[lid]) delete lotSelLinks[lid]; else lotSelLinks[lid]=1; }
  else { var cc=t.dataset.coll; if(lotSelColls[cc]) delete lotSelColls[cc]; else lotSelColls[cc]=1; }
  renderView();
}, true);
document.addEventListener("click", function(ev){
  if(currentView!=="links") return;
  var sb=ev.target.closest&&ev.target.closest("[data-action=\"link-sel-del\"]"); if(sb){ ev.stopPropagation(); ev.preventDefault(); _linkDeleteSel(); return; }
  var cb=ev.target.closest&&ev.target.closest("[data-action=\"link-sel-clear\"]"); if(cb){ ev.stopPropagation(); ev.preventDefault(); _linkClearSel(); return; }
  var t=ev.target.closest&&ev.target.closest(".link-card");
  if(!t) return;
  if(!(ev.ctrlKey||ev.metaKey)) return;
  ev.stopPropagation(); ev.preventDefault();
  var lid=t.dataset.id; if(linkSelLinks[lid]) delete linkSelLinks[lid]; else linkSelLinks[lid]=1;
  renderView();
}, true);
document.addEventListener("keydown", function(ev){
  if(currentView==="links" && (ev.key==="Delete"||ev.key==="Backspace")){
    var ae=document.activeElement; if(ae && (ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.isContentEditable)) return;
    if(!_linkSelCount()) return;
    ev.preventDefault(); _linkDeleteSel(); return;
  }
  if(currentView!=="lot") return;
  if(ev.key!=="Delete" && ev.key!=="Backspace") return;
  var ae=document.activeElement; if(ae && (ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.isContentEditable)) return;
  if(!_lotCountSel()) return;
  ev.preventDefault(); _lotDeleteSel();
});

function _parkIsUrl(s){ s=(s||'').trim(); return s.indexOf('://')>0 || s.indexOf('www.')===0; }
function _parkHost(u){ var i=u.indexOf('://'); var s=i>=0?u.slice(i+3):u; var j=s.indexOf('/'); if(j>=0)s=s.slice(0,j); var k=s.indexOf('?'); if(k>=0)s=s.slice(0,k); if(s.indexOf('www.')===0)s=s.slice(4); return s||u; }
function _parkParseClip(raw){ raw=(raw||'').trim(); if(!raw)return null; var sep=raw.indexOf(' ||| '); if(sep>=0){ var t=raw.slice(0,sep).trim(); var u=raw.slice(sep+5).trim(); if(!_parkIsUrl(u)){ if(_parkIsUrl(t)){ var tmp=t;t=u;u=tmp; } else return null; } if(u.indexOf('www.')===0)u='https://'+u; return {title:t||_parkHost(u),url:u}; } if(_parkIsUrl(raw)){ var v=raw; if(v.indexOf('www.')===0)v='https://'+v; return {title:_parkHost(v),url:v}; } return null; }
function _parkOne(title,url){ url=(url||'').trim(); if(url.indexOf('www.')===0)url='https://'+url; var nu=normUrl(url); if(!nu)return {bad:true}; var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ _lastParked=ex.id; return {dup:true,id:ex.id}; } var link={id:uid(),title:title||_parkHost(url),url:url,category:'',coll:_parkHost(url),note:'',src:'park',opens:0,lastOpened:0,created:nowMs()}; state.links.unshift(link); saveState(); _lastParked=link.id; return {id:link.id}; }
function _extractUrl(s){ var i=String(s).indexOf('http://'); var j=String(s).indexOf('https://'); var k=(i>=0&&j>=0)?Math.min(i,j):(i>=0?i:j); if(k<0) return ''; var rest=String(s).slice(k); var m=rest.match(/^[^\s<>"']+/); return m?m[0].replace(/[),.;]+$/,''):''; }
function _parkBulk(text){
  var lines=String(text||'').split(/\r?\n/);
  var added=0, dup=0, colls={};
  for(var i=0;i<lines.length;i++){
    var ln=lines[i].trim(); if(!ln) continue;
    var t=null, u=null;
    if(ln.indexOf(' ||| ')>=0){ var a=ln.split(' ||| '); t=a[0].trim(); u=a[1].trim(); }
    else if(ln.indexOf('\t')>=0){ var a=ln.split('\t'); var x=a[0].trim(), y=(a[1]||'').trim(); if(_parkIsUrl(y)){u=y;t=x;} else if(_parkIsUrl(x)){u=x;t=y;} else continue; }
    else if(ln.indexOf(' | ')>=0){ var a=ln.split(' | '); var x=a[0].trim(), y=a.slice(1).join(' | ').trim(); if(_parkIsUrl(y)){u=y;t=x;} else if(_parkIsUrl(x)){u=x;t=y;} else { u=_extractUrl(ln); t=ln; } }
    else if(ln.indexOf(' - ')>=0){ var a=ln.split(' - '); var x=a[0].trim(), y=a.slice(1).join(' - ').trim(); if(_parkIsUrl(y)){u=y;t=x;} else if(_parkIsUrl(x)){u=x;t=y;} else { u=_extractUrl(ln); t=ln; } }
    else if(_parkIsUrl(ln)){ u=ln; t=null; }
    else { u=_extractUrl(ln); t=ln; }
    if(!u) continue;
    if(!_parkIsUrl(u)){ var eu=_extractUrl(u); if(eu){ if(t===u)t=u; u=eu; } else continue; }
    var r=_parkOne(t,u); if(r.bad) continue; if(r.dup){ dup++; } else { added++; var lk=find(state.links,r.id); if(lk&&lk.coll) colls[lk.coll]=1; }
  }
  return {n:added+dup, added:added, dup:dup, stacks:Object.keys(colls).length};
}

async function handleCommand(line){
  if(!line.trim())return;
  const pc=parseCommand(line); const cmd=pc.cmd,arg=pc.arg;
  const out=[]; const push=(m,meta)=>out.push({message:m,meta:meta});
  const flush=()=>{ if(!out.length)return; for(let i=0;i<out.length;i++)pushRaw(out[i].message,out[i].meta,true); out.length=0; renderTermBody(); };
  push("> "+line);
  if(cmd===state.radCmd){
    var _setInner=(arg==='set'||arg==='settings')?'':((arg||'').indexOf('set ')===0?(arg||'').slice(4):((arg||'').indexOf('settings ')===0?(arg||'').slice(9):null));
    if(_setInner!==null){ handleSet(_setInner,push); flush(); return; }
    if(!arg){ push('> usage: '+state.radCmd+' <search term>   ·   '+state.radCmd+' set  for settings'); flush(); return; }
    const rootsLabel=(state.scanRoots&&state.scanRoots.length)?state.scanRoots.join(", "):"~ (home)";
    push("> ...searching "+rootsLabel+"   depth<="+(state.scanDepth||4)+(state.scanSkipHidden?"   (hidden skipped)":""));
    if(!E){ push("> (preview: searching saved folders only - disk search needs the desktop app)"); const q=arg.toLowerCase(); const matches=state.folders.filter(f=>{ const nm=(f.name||baseName(f.path||f.name)||"").toLowerCase(); const pa=(f.path||"").toLowerCase(); return nm.indexOf(q)>=0||pa.indexOf(q)>=0; }); if(!matches.length)push('> no folders match "'+arg+'"'); else { matches.forEach(f=>push("> "+(f.name||baseName(f.path||f.name)||f.path),{folderId:f.id,path:f.path||""})); push("> "+matches.length+" folder(s) found"); } flush(); return; }
    if(scanActive){ push("> a scan is running - type  stop  to cancel"); flush(); return; }
    flush(); scanActive=true; currentScanId=uid(); pendingScans[currentScanId]={found:0};
    E.fsScan({id:currentScanId,query:arg,roots:(state.scanRoots||[]),maxDepth:(state.scanDepth||4),skipHidden:(state.scanSkipHidden!==false),cap:300}); return;
  } else if(cmd==="stop"){ if(scanActive&&currentScanId){ if(E)E.fsScanCancel({id:currentScanId}); push("> cancelling scan..."); } else push("> no scan running"); flush(); return; }
  else if(cmd==="setrad"){ if(arg){ state.radCmd=arg.split(/\s+/)[0]; saveState(); push("> search command set to: "+state.radCmd); } else push("> usage: setrad <word>"); flush(); return; }
  else if(cmd==="roots"){ if(!arg){ push("> scan roots: "+((state.scanRoots&&state.scanRoots.length)?state.scanRoots.join(" | "):"(default: home)")); } else if(arg==="clear"){ state.scanRoots=[]; saveState(); push("> scan roots cleared (default: home)"); } else if(arg.indexOf("add ")===0){ const p=arg.slice(4).trim(); if(p){ state.scanRoots=state.scanRoots||[]; state.scanRoots.push(p); saveState(); push("> added root: "+p); } } else if(arg.indexOf("rm ")===0){ const p=arg.slice(3).trim(); state.scanRoots=(state.scanRoots||[]).filter(r=>r!==p); saveState(); push("> removed root: "+p); } else push("> usage: roots | roots add /path | roots rm /path | roots clear"); flush(); return; }
  else if(cmd==="depth"){ const n=parseInt(arg,10); if(arg&&!isNaN(n)&&n>=0){ state.scanDepth=n; saveState(); push("> scan depth set to: "+n); } else push("> scan depth: "+(state.scanDepth||4)+"   usage: depth <number>"); flush(); return; }
  else if(cmd==='set'||cmd==='settings'||cmd==='setting'){ push('> settings moved under  '+state.radCmd+' set  — try:  '+state.radCmd+' set   for the menu'); flush(); return; }
  else if(cmd==="help"){ push("> commands:"); push('>   '+state.radCmd+' "term"        search folders on your device by name'); push(">   stop                  cancel a running scan"); push(">   roots [add|rm|clear]  folders to scan (default: home)"); push(">   depth <n>             how deep to scan (default 4)"); push('>   '+state.radCmd+' set              settings menu (autostart / hk / intro / music / pet)'); push('>   '+state.radCmd+' set single|double click   open with one or two clicks'); push(">   park [url]            save clipboard (or a URL) to the Parking Lot"); push(">   parklist              bulk-import URLs from the clipboard"); push(">   parked [stack]        list stacks / links in a stack"); push(">   note <text>           add a note to the last parked link"); push(">   retag <category>      move last parked link into a category"); push(">   stack <name>          rename the stack of the last parked link"); push(">   openall <stack> [!]   open every link in a stack"); push(">   stackmin <n>          stacks form at n+ links"); push(">   ext / bookmarklet     install the browser extension"); push(">   (Screenshots)          inbox + trays · refresh · slideshow · 100 per page"); push(">   setrad <word>         rename the search command"); push(">   help                  show this list"); flush(); return; }
  else if(cmd==='park'){ var p=null; if(arg){ if(_parkIsUrl(arg)){ var u=arg; if(u.indexOf('www.')===0)u='https://'+u; p={title:_parkHost(u),url:u}; } else { push('> not a URL — click the park bookmarklet then  park ,  or  park https://...'); flush(); return; } } else { var clip=(E&&E.clipRead)?await E.clipRead():''; p=_parkParseClip(clip); if(!p){ var bl=_parkBulk(clip); if(bl.added>0){ push('> imported '+bl.added+' links ('+bl.dup+' dupes skipped) into '+bl.stacks+' stack(s)'); celebrate(); renderView(); flush(); return; } push('> clipboard has no link — copy a URL (Ctrl+C) then  park ,  or copy many lines then  park / parklist'); flush(); return; } } var r=_parkOne(p.title,p.url); var lk=r.id?find(state.links,r.id):null; if(r.bad){ push('> could not parse that URL'); } else if(r.dup){ push('> already parked: '+(lk?lk.title:'')+'   (use  note / retag  to update)'); } else { push('> parked  '+(lk?lk.title:'')+(lk&&lk.category?'  ['+lk.category+']':'')+'   ·  note <text>  adds a note'); celebrate(); } renderView(); flush(); return; }
  else if(cmd==='note'){ if(!_lastParked){ push('> nothing parked yet this session — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } lk.note=arg||''; saveState(); push('> note set on  '+(lk.title||lk.url)); renderView(); flush(); return; }
  else if(cmd==='retag'){ if(!_lastParked){ push('> nothing parked yet this session — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } if(!arg){ push('> usage: retag <category>   (e.g.  retag Guides )'); flush(); return; } lk.category=arg; saveState(); push('> recategorised  '+(lk.title||lk.url)+'  ->  '+arg); renderView(); flush(); return; }
  else if(cmd==='stack'){ if(!_lastParked){ push('> nothing parked yet — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } if(!arg){ push('> usage: stack <collection>'); flush(); return; } lk.coll=arg; saveState(); push('> stacked  '+(lk.title||lk.url)+'  ->  '+arg); renderView(); flush(); return; }
  else if(cmd==='parked'){ var q=(arg||'').trim().toLowerCase(); if(!q){ var gc={}; state.links.forEach(function(l){ var k=l.coll||''; if(k) gc[k]=(gc[k]||0)+1; }); var ks=Object.keys(gc).sort(function(a,b){return gc[b]-gc[a];}); if(!ks.length){ push('> no stacks yet —  park  some links and they auto-group by site'); } else { push('> stacks  ('+ks.length+')  —  parked <stack>  to list ·  openall <stack> !  to open all'); ks.forEach(function(k){ push('  · '+k+'   ('+gc[k]+')'); }); } } else { var list=state.links.filter(function(l){ var c=(l.coll||'').toLowerCase(); return c===q || c.indexOf(q)>=0; }); if(!list.length){ push('> no stack matches  '+arg); } else { push('> '+arg+'  ('+list.length+')'); list.forEach(function(l,i){ push('  '+(i+1)+'. '+(l.title||l.url)+(isTagPage(l.url)?'  [tag page]':'')); }); } } flush(); return; }
  else if(cmd==='openall'){ var raw=arg||''; var force=/[!]/.test(raw); var q=raw.replace(/[!]/g,'').trim().toLowerCase(); var list=state.links.filter(function(l){ var c=(l.coll||'').toLowerCase(); return c===q || c.indexOf(q)>=0; }); if(!list.length){ push('> no stack matches  '+q); flush(); return; } if(list.length>8 && !force){ push('> '+list.length+' links in  '+q+'  —  type  openall '+q+' !  to open them all'); flush(); return; } list.forEach(function(l){ if(E&&E.shellOpen)E.shellOpen(l.url); else try{window.open(l.url,'_blank');}catch(_){} }); push('> opened '+list.length+' links from  '+q); flush(); return; }
  else if(cmd==='parklist'){ var clip=(E&&E.clipRead)?await E.clipRead():''; var bl=_parkBulk(clip); if(bl.n===0){ push('> clipboard has no links to import — copy a OneTab export or a list of URLs first'); } else { push('> imported '+bl.added+' links ('+bl.dup+' dupes skipped) into '+bl.stacks+' stack(s)'); celebrate(); } renderView(); flush(); return; }
  else if(cmd==='stackmin'){ var n=parseInt(arg,10); if(!arg||isNaN(n)||n<1){ push('> usage: stackmin <n>  (stacks form at n+ links; now '+((state.settings&&state.settings.stackMin)||3)+')'); } else { if(!state.settings)state.settings={}; state.settings.stackMin=n; saveState(); push('> stacks now form at '+n+'+ links'); renderView(); } flush(); return; }
  else if(cmd==='extension'||cmd==='ext'||cmd==='bookmarklet'||cmd==='bm'){ var sub=(arg||'').trim().toLowerCase(); if(sub==='open'&&E&&E.extOpen){ E.extOpen(); push('> opening extension folder...'); flush(); return; } push('> S.I.R Quick Save extension — one-click save, zero prompts'); push(''); push('> 1. type  ext open  (opens the extension folder for you)'); push('> 2. open  opera://extensions  (or chrome://extensions)'); push('> 3. enable  Developer mode  (top-right toggle)'); push('> 4. click  Load unpacked'); push('> 5. select that folder'); push(''); push('> done — toolbar icon + right-click "Save to S.I.R" on any page'); if(E&&E.extDir){ E.extDir().then(function(p){ push(''); push('> folder location: '+p); }); } flush(); return; }
  else { push("> unknown command: "+cmd+"  -  type  help"); flush(); return; }
}
function parseCommand(line){ const m=line.match(/^(\S+)\s*([\s\S]*)$/); if(!m)return {cmd:line.trim(),arg:""}; let arg=(m[2]||"").trim(); if(arg.length>=2&&arg[0]==='"'&&arg[arg.length-1]==='"')arg=arg.slice(1,-1); return {cmd:m[1],arg:arg}; }
function pushRaw(message,meta,silent){ const e={id:uid(),ts:nowMs(),level:"raw",message:String(message),raw:true}; if(meta)e.meta=meta; state.console.unshift(e); if(state.console.length>500)state.console.length=500; saveState(); if(!silent)renderTermBody(); }
let scanActive=false, currentScanId=null; const pendingScans={};
if(E){ if(E.onFsChunk)E.onFsChunk(p=>{ const pend=pendingScans[p.id]; if(!pend)return; (p.items||[]).forEach(it=>{ pend.found++; pushRaw("> "+it.name,{openPath:it.path},true); }); renderTermBody(); }); if(E.onFsDone)E.onFsDone(p=>{ const pend=pendingScans[p.id]; if(pend){ pushRaw("> done - "+pend.found+" folder(s)"+(p.truncated?"   (truncated: narrow the query or raise  depth)":""),null,false); delete pendingScans[p.id]; } scanActive=false; currentScanId=null; renderTermBody(); }); }

function tickClock(){ $("#clock").textContent=new Date().toLocaleTimeString([],{hour12:false}); }
setInterval(tickClock,1000);
function buildThinkBar(){ const w=$("#tbWave"); if(w){ let h=""; for(let i=0;i<64;i++){ h+='<i style="animation-delay:'+(Math.random()*1.2).toFixed(2)+'s;animation-duration:'+(0.8+Math.random()*0.9).toFixed(2)+'s"></i>'; } w.innerHTML=h; } const tb=$("#thinkbar"); if(tb){ const cols=["#27b4ff","#b14bff","#ff4d8d","#33d17a"]; let ci=0; tb.style.setProperty("--acc",cols[0]); setInterval(()=>{ ci=(ci+1)%cols.length; tb.style.setProperty("--acc",cols[ci]); },4200); } }

let _killAt=0, _killTick=null;
const KILL_ICO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>';
function killClock(){
  const ms=Math.max(0, (_killAt||0)-Date.now());
  const s=Math.ceil(ms/1000);
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function killPaint(){
  const armed=!!(_killAt && _killAt>Date.now());
  if(!armed) _killAt=0;
  const clock=armed?killClock():"";
  const btn=document.getElementById("killBtn");
  if(btn){
    if(!armed){
      btn.classList.remove("armed");
      btn.innerHTML=KILL_ICO+'<span class="kill-min"></span>';
      btn.title="Sleep timer — shut down this PC in 30 minutes";
    } else {
      btn.classList.add("armed");
      btn.innerHTML=KILL_ICO+'<span class="kill-min">'+clock+"</span>";
      btn.title="Cancel shutdown — "+clock+" left";
    }
  }
  ["normaKillClock","normaFloatClock","nbKillClock"].forEach(function(id){
    const el=document.getElementById(id);
    if(!el) return;
    el.textContent=clock;
    el.classList.toggle("show", armed);
  });
}
async function killToggle(){
  try{
    if(!E||!(E.killToggle||E.killArm)){ toast("Sleep timer needs the desktop app","warn"); return; }
    const was=!!(_killAt && _killAt>Date.now());
    if(!was && !(await confirmModal("Shut this PC down in 30 minutes?",true,{title:"Arm sleep timer",go:"Arm timer",cancel:"Keep PC on"}))) return;
    const r=E.killToggle? await E.killToggle(30) : (was? await E.killCancel() : await E.killArm(30));
    _killAt=(r&&r.armed)?(r.at||0):0;
    if(!state.settings) state.settings={};
    state.settings.killAt=_killAt;
    saveState();
    killPaint();
    if(_killAt){ toast("PC shuts down in 30 minutes","ok"); log("warn","sleep timer armed — shutdown in 30 minutes"); }
    else { toast("Shutdown cancelled","ok"); }
  }catch(err){ toast("Sleep timer failed: "+(err&&err.message||err),"err"); }
}
if(E&&E.onKillStatus) E.onKillStatus(function(s){ _killAt=(s&&s.armed)?(s.at||0):0; if(!state.settings) state.settings={}; if(state.settings.killAt!==_killAt){ state.settings.killAt=_killAt; saveState(); } killPaint(); });
if(E&&E.onKillAsk) E.onKillAsk(function(){ killToggle(); });
if(!_killTick) _killTick=setInterval(killPaint, 1000);

(async function boot(){
  await loadState();
  if(state.settings&&state.settings.petAutoUndock){ setFloating(true); }
  try{ if(state.music&&state.music.volume!=null) bgmAudio.volume=state.music.volume; if(state.music&&typeof state.music.idx==='number'&&state.music.idx) bgmIdx=state.music.idx; }catch(_){}
  if(E&&E.musicRequest) E.musicRequest();
  try{ if(E&&E.appVersion){ const v=await E.appVersion(); if(v) APP_VERSION=String(v).replace(/^v/i,""); } }catch(_){}
  const av=$('#appver'); if(av)av.textContent='v'+APP_VERSION;
  const ae=$("#appedits"); if(ae)ae.textContent="#"+EDIT_COUNT+" edits";
  buildThinkBar(); renderNav(); renderView(); renderTermBody(); tickClock();
  { const ng=$("#normaGif"); const nd=(NORMA_EMBED&&NORMA_EMBED.indexOf("data:")===0)?NORMA_EMBED:""; if(ng&&nd)ng.src=nd; }
  loadArt();
  if(E&&E.onNormaDock)E.onNormaDock(()=>setFloating(false));
  if(E&&E.onNormaNav)E.onNormaNav(m=>{ currentView=m; $("#content").classList.remove("searching"); searchTerms={}; renderNav(); renderView(); });
  if(E&&E.onRecordRecentFolder) E.onRecordRecentFolder(function(info){ if(info&&info.path) rememberFolder(info.path, info.name); });
  if(E&&E.onRecentFolders) E.onRecentFolders(function(){ if(currentView==="folders") renderView(); });
if(enforcePetPinCap()) toast("Pet recents only holds 3 pins — extra pins were released","warn");
  if(state.settings&&state.settings.killAt&&state.settings.killAt>Date.now()){ _killAt=state.settings.killAt; killPaint(); }
  try{ if(E&&E.killStatus){ const ks=await E.killStatus(); if(ks){ _killAt=(ks.armed)?(ks.at||0):0; if(!state.settings) state.settings={}; state.settings.killAt=_killAt; saveState(); killPaint(); } } }catch(_){}
  ["mousemove","keydown","pointerdown","wheel","click"].forEach(function(ev){ document.addEventListener(ev, shotIdleKick, {passive:true}); });
  shotIdleKick();
  if(E&&E.onAppFocus) E.onAppFocus(function(){ shotSlideshowStop(); });
  try{ syncPetRecents(); }catch(_){}
  log("info","S.I.R booted — Personal Command Center ready (v"+APP_VERSION+", "+EDIT_COUNT+" edits).");
})();
