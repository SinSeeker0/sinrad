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
function showUpdateToast(r){
  const wrap=$("#toasts");if(!wrap)return;
  const old=$("#update-toast");if(old)old.remove();
  const item=document.createElement("div");item.id="update-toast";item.className="toast update-toast";
  item.innerHTML='<span class="ut-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/></svg></span><span class="ut-copy"><b>Update ready</b><small></small></span><button data-action="update-open">View update <b>→</b></button>';
  const detail=item.querySelector("small");if(detail)detail.textContent="S.I.R v"+String(r&&r.latest||"")+" is available";
  wrap.appendChild(item);
}
function renderUpdateResult(r, silent){
  const t=$("#um-title"), v=$("#um-ver"), cur=$("#um-current"), d=$("#um-date"), n=$("#um-notes"), go=$("#um-go"), lat=$("#um-later"), quiet=$(".um-quiet");
  if(!silent){ try{ if(r&&r.ok&&!r.available) toast("You're up to date","ok"); else if(r&&!r.ok) toast("Update check failed","err"); }catch(_){} }
  if(cur)cur.textContent="v"+String(r&&r.current||APP_VERSION||"0.0.0").replace(/^v/i,"");
  if(quiet)quiet.style.display=(r&&r.ok&&r.available)?"":"none";
  setUpdProgress(false);
  setUpdateGif((!r||!r.ok)?null:(!r.available?"complete":"checking"));
  if(!r||!r.ok){ if(t)t.textContent="Update check failed"; if(v)v.textContent=r&&r.current?("v"+r.current):""; if(d)d.textContent=""; if(n)n.textContent=(r&&r.error)||"Could not reach GitHub. Check your connection."; if(go){go.style.display="none";} if(lat){lat.style.display="";lat.textContent="Close";} showUpdateModal(); return; }
  if(!r.available){ if(t)t.textContent="You are up to date"; if(v)v.textContent="v"+r.current; if(d)d.textContent=""; if(n)n.textContent="Latest on GitHub is v"+(r.latest||r.current)+" — you're on it."; if(go){go.style.display="none";} if(lat){lat.style.display="";lat.textContent="Close";} showUpdateModal(); return; }
  if(t)t.textContent="New Version Available";
  if(v)v.textContent="v"+r.latest;
  if(d)d.textContent=r.date||"";
  if(n)n.textContent=(r.notes||"").trim()||"This release includes the latest S.I.R improvements and fixes.";
  if(go){ go.style.display=""; go.disabled=false; go.textContent=r.canAuto?"Update now":(r.asset?"Download":"Open releases"); }
  if(lat){ lat.style.display=""; lat.disabled=false; lat.textContent="Later"; }
  updState = r;
  if(silent){showUpdateToast(r);return;}
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
let currentUpdatePhase=null;
function setUpdateGif(phase){ const gif=$("#um-gif"),svg=$("#um-ico-svg"),card=$(".um-card"),head=$(".um-head"),src=phase?UPD_GIF_SRC[phase]:null;currentUpdatePhase=phase||null;if(card){card.classList.remove("phase-checking","phase-updating","phase-complete");if(phase)card.classList.add("phase-"+phase);}if(src&&gif){gif.src=src;gif.style.display="block";if(svg)svg.style.display="none";if(head)head.classList.add("has-art");}else{if(gif){gif.style.display="none";gif.removeAttribute("src");}if(svg)svg.style.display="block";if(head)head.classList.remove("has-art");} }
let UPD_GIF_SRC={checking:"checking.gif",updating:"updating.gif",complete:"complete.gif"};
function settingsMenu(push){
  function p(s,n){ s=String(s); while(s.length<n)s+=' '; return s; }
  var introOn=!(state.settings&&state.settings.introEnabled===false);
  var hiddenOn=state.scanSkipHidden!==false;
  var scrollOn=!(state.settings&&state.settings.autoScroll===false);
  var click=(state.openMode==='single')?'single':'double';
  var st=function(on){ return on?'ON':'off'; };
  var L=[];
  L.push('settings  ·  type  '+state.radCmd+' set <name>  to toggle  ·  '+state.radCmd+' set <name> on|off  to force');
  var autoOn=!!(state.settings&&state.settings.autoStart);
  var hkOn=!(state.settings&&state.settings.hotkeyEnabled===false);
  L.push(p('  boot intro video',22)+p(st(introOn),5)+state.radCmd+' set intro');
  L.push(p('  skip hidden folders',22)+p(st(hiddenOn),5)+state.radCmd+' set hidden');
  L.push(p('  auto-scroll console',22)+p(st(scrollOn),5)+state.radCmd+' set autoscroll');
  L.push(p('  auto-start on login',22)+p(st(autoOn),5)+state.radCmd+' set autostart');
  L.push(p('  hotkey '+currentHotkeys().quickSave,22)+p(st(hkOn),5)+state.radCmd+' set hk');
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
  if(k==='intro'||k==='boot'||k==='splash'||k==='bootvideo'){ if(!state.settings)state.settings={}; var ci=!(state.settings.introEnabled===false); var ni=(v==='on')?true:(v==='off')?false:!ci; state.settings.introEnabled=ni; saveState(); push('> boot intro video: '+onoff(ni)); return; }
  if(k==='hidden'){ var ch=state.scanSkipHidden!==false; var nh=(v==='on')?true:(v==='off')?false:!ch; state.scanSkipHidden=nh; saveState(); push('> skip hidden folders: '+onoff(nh)); return; }
  if(k==='autoscroll'||k==='scroll'){ if(!state.settings)state.settings={}; var cs=!(state.settings.autoScroll===false); var ns=(v==='on')?true:(v==='off')?false:!cs; state.settings.autoScroll=ns; saveState(); push('> auto-scroll console: '+onoff(ns)); updateAutoScrollBtn(); renderTermBody(); return; }
  if(k==='autostart'||k==='startup'||k==='autorun'||k==='login'){ if(!state.settings)state.settings={}; var ca=!!state.settings.autoStart; var na=(v==='on')?true:(v==='off')?false:!ca; state.settings.autoStart=na; saveState(); if(E&&E.setAutostart){ E.setAutostart(na).then(function(r){ push('> auto-start on boot: '+onoff(!!r)); }).catch(function(){ push('> auto-start on boot: '+onoff(na)); }); } else { push('> auto-start on boot: '+onoff(na)+' (desktop only)'); } return; }
  if(k==='hotkey'||k==='hotkeys'||k==='hk'){ if(!state.settings)state.settings={}; var ch=!(state.settings.hotkeyEnabled===false); var nh=(v==='on')?true:(v==='off')?false:!ch; state.settings.hotkeyEnabled=nh; saveState(); push('> hotkey ('+currentHotkeys().quickSave+'): '+onoff(nh)); if(E&&E.hotkeyToggle){ E.hotkeyToggle(nh).catch(function(){}); } return; }
  if(k==="pet"||k==="norma"||k==="petundock"){ if(!state.settings)state.settings={}; var cp=!!state.settings.petAutoUndock; var np=(v==="on")?true:(v==="off")?false:!cp; state.settings.petAutoUndock=np; saveState(); push("> pet auto-undock on boot: "+onoff(np)); return; }
  push('> usage: '+state.radCmd+' set <name>  toggles · names: autostart, hotkey, intro, hidden, autoscroll, click, pet   (add on|off to force)');
}
let STORE_MODE="Memory";
const EDIT_COUNT = 217;
const APP_OPENED_AT = Date.now();
let TOTAL_OPEN_BASE = 0;
let APP_VERSION="0.0.0";

var DEFAULT_CATS={ "Anime":"#ff5470", "Interesting":"#4d9bff", "Check out":"#e8e8ef", "Artist":"#8b5cf6", "Guides":"#16c79a", "YouTube":"#ff7185" };
function getCatColors(){ var base=Object.assign({},DEFAULT_CATS); try{ if(state&&state.categories){ for(var k in state.categories){ base[k]=state.categories[k]; } } }catch(e){} return base; }
var CAT_COLORS=Object.assign({},DEFAULT_CATS);
function refreshCatColors(){ CAT_COLORS=getCatColors(); }
function addCategory(name,color){ rememberUndo("Added category "+name); if(!state.categories) state.categories={}; state.categories[name]=color; saveState(); refreshCatColors(); renderView(); log("info","added category: "+name); }
function deleteCategory(name){ if(!state.categories || !state.categories[name]) return; rememberUndo("Deleted category "+name); delete state.categories[name]; state.links.forEach(function(l){ SinradShared.removeLinkCategory(l,name); }); linkCats=linkCats.filter(function(category){return category!==name;}); saveState(); refreshCatColors(); renderView(); log("warn","deleted category: "+name); }
function randomColor(){ var h=Math.floor(Math.random()*360); return "hsl("+h+",65%,55%)"; }
var DEFAULT_FOLDER_CATS={ "Mods":"#964B00" };
var FOLDER_CATS=Object.assign({},DEFAULT_FOLDER_CATS);
function refreshFolderCats(){ FOLDER_CATS=Object.assign({},DEFAULT_FOLDER_CATS); try{ if(state&&state.folderCategories){ for(var k in state.folderCategories){ FOLDER_CATS[k]=state.folderCategories[k]; } } }catch(e){} }
const FAV_COLOR="#f5a623", PRI_COLOR="#ff4d8d", ALL_COLOR="#27b4ff";

const revealed=new Set();
let currentView="vault";
let offlineMode=false,offlineTab="feed",offlineFilter="all",offlineQuery="",offlineSelectedId="",offlineLoading=false,offlineSyncing=false;
let offlineData={settings:{retentionDays:30,maxItems:2000},sources:[],items:[],updatedAt:0,storagePath:""};
let offlineAuth={connected:false,username:"",clientId:"",secure:false};
const offlineMediaCache=new Map();
let monitoringMode=false,monitoringTab="activity",monitoringFilter="all",monitoringQuery="",monitoringLoading=false,monitoringSyncing=false,monitoringFocusId="",monitoringDetail=null,monitoringDetailLoading=false,monitoringDetailRequest=0,monitoringArtist=null,monitoringArtistLoading=false,monitoringArtistRequest=0,monitoringArtistRange={monitorId:"",from:"",to:""},monitoringDatePicker={side:"",level:"year",year:0,month:-1};
let monitoringData={settings:{notifications:true,defaultIntervalMinutes:1440,retentionDays:90,maxEvents:2000,downloadFolder:""},monitors:[],events:[],updatedAt:0};
const monitoringMediaCache=new Map();
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
const HOTKEY_DEFAULTS={globalSearch:"Ctrl+Shift+F",commandPalette:"Ctrl+Shift+P",undo:"Ctrl+Z",quickSave:"Ctrl+Alt+P"};
function normalizeHotkey(value,fallback){
  const parts=String(value||"").replace(/\s+/g,"").split("+").filter(Boolean),mods={ctrl:false,alt:false,shift:false};let key="";
  parts.forEach(function(part){const upper=part.toUpperCase();if(upper==="CTRL"||upper==="CONTROL"||upper==="CMD")mods.ctrl=true;else if(upper==="ALT")mods.alt=true;else if(upper==="SHIFT")mods.shift=true;else if(/^[A-Z0-9]$/.test(upper)||/^F(?:[1-9]|1[0-2])$/.test(upper))key=upper;});
  if(!key||(!mods.ctrl&&!mods.alt))return fallback;
  return [mods.ctrl?"Ctrl":"",mods.alt?"Alt":"",mods.shift?"Shift":"",key].filter(Boolean).join("+");
}
function currentHotkeys(){if(!state.settings)state.settings={};const source=state.settings.hotkeys&&typeof state.settings.hotkeys==="object"?state.settings.hotkeys:{};const hotkeys={};Object.keys(HOTKEY_DEFAULTS).forEach(function(name){hotkeys[name]=normalizeHotkey(source[name],HOTKEY_DEFAULTS[name]);});state.settings.hotkeys=hotkeys;return hotkeys;}
function hotkeyFromEvent(ev){const key=String(ev.key||"").toUpperCase();if(!(/^[A-Z0-9]$/.test(key)||/^F(?:[1-9]|1[0-2])$/.test(key)))return "";if(!(ev.ctrlKey||ev.metaKey||ev.altKey))return "";return [(ev.ctrlKey||ev.metaKey)?"Ctrl":"",ev.altKey?"Alt":"",ev.shiftKey?"Shift":"",key].filter(Boolean).join("+");}
function hotkeyMatches(ev,name){return hotkeyFromEvent(ev)===currentHotkeys()[name];}
function hotkeyDisplay(value){return String(value||"").replace(/\+/g," + ");}
function paintHotkeyLabels(){const hotkeys=currentHotkeys(),searchKey=document.querySelector("#globalSearch>kbd"),commands=document.querySelector(".cmd-open");if(searchKey)searchKey.textContent=hotkeyDisplay(hotkeys.globalSearch);if(commands)commands.title="Commands · "+hotkeyDisplay(hotkeys.commandPalette);}
const undoStack=[];
function undoSnapshot(){
  return JSON.parse(JSON.stringify({vault:state.vault||[],links:state.links||[],folders:state.folders||[],shots:state.shots||[],categories:state.categories||{},folderCategories:state.folderCategories||{},shotCollections:state.shotCollections||{},linkRules:(state.settings&&state.settings.linkRules)||[]}));
}
function rememberUndo(label){undoStack.push({label:String(label||"Changed data"),at:Date.now(),data:undoSnapshot()});if(undoStack.length>20)undoStack.shift();}
function restoreUndoSnapshot(data){state.vault=data.vault||[];state.links=data.links||[];state.folders=data.folders||[];state.shots=data.shots||[];state.categories=data.categories||{};state.folderCategories=data.folderCategories||{};state.shotCollections=data.shotCollections||{};if(!state.settings)state.settings={};state.settings.linkRules=data.linkRules||[];refreshCatColors();refreshFolderCats();}
async function undoLastChange(){const entry=undoStack.pop();if(!entry){toast("Nothing to undo yet","warn");return false;}const current=undoSnapshot();restoreUndoSnapshot(entry.data);const saved=await flushSave();if(!saved){restoreUndoSnapshot(current);toast("Undo could not be saved","err");return false;}renderView();renderTermBody();toast("Undid: "+entry.label,"ok");return true;}
function undoHistoryModal(){const rows=undoStack.slice().reverse();const body=rows.length?'<div class="history-list">'+rows.map(function(entry,index){return '<div class="history-row"><b>'+esc(entry.label)+'</b><small>'+esc(new Date(entry.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}))+'</small></div>';}).join("")+'</div>':'<p style="color:var(--muted);margin:0">No changes to undo this session.</p>';openModal("Undo history",body,rows.length?"Undo latest":"Close",function(){if(!rows.length){closeModal();return;}closeModal();undoLastChange();});const cancel=$("#modalCancelBtn");if(cancel)cancel.classList.toggle("hidden",!rows.length);}
function currentLinkRules(){return (state.settings&&Array.isArray(state.settings.linkRules))?state.settings.linkRules:[];}
function smartCategories(url,fallback){return SinradShared.smartLinkCategories(url,fallback,currentLinkRules());}
function applySmartToLink(link){if(!link)return link;const result=smartCategories(link.url,link.category),existing=linkCategoryList(link);link.category=result.main;link.categories=Array.from(new Set(result.all.concat(existing).filter(Boolean)));return link;}

async function loadState(){
  if(E&&E.storeLoad){ try{ const d=await E.storeLoad(); if(d&&typeof d==="object"){ state=Object.assign(defaultState(),d); const sec=E.storeSecurity?await E.storeSecurity():"permissions-only"; STORE_MODE=sec==="encrypted"?"Encrypted local file":"Restricted local file"; } }catch(e){} }
  if(STORE_MODE==="Memory"){ try{ const raw=localStorage.getItem(KEY); if(raw){ state=Object.assign(defaultState(),JSON.parse(raw)); STORE_MODE="Local Storage"; } }catch(e){ STORE_MODE="Memory"; } }
  const d=defaultState(); for(const k in d){ if(state[k]===undefined) state[k]=d[k]; }
  if(!state.settings)state.settings={};TOTAL_OPEN_BASE=Math.max(0,Number(state.settings.totalOpenMs)||0);
  document.getElementById("store-mode").textContent=STORE_MODE; refreshCatColors(); refreshFolderCats();
}
let _saveT=null,_saveInFlight=null,_saveQueued=false,_saveWaiters=[];
function saveState(){ markGlobalSearchDirty(); if(_saveT) clearTimeout(_saveT); _saveT=setTimeout(flushSave,650); }
function performStoreSave(){
  if(E&&E.storeSave){ try{ return Promise.resolve(E.storeSave(state)).then(function(ok){ if(ok===false)toast("Could not save—existing data was protected","err"); return ok!==false; }).catch(function(){ toast("Save failed","err"); return false; }); }catch(e){ return Promise.resolve(false); } }
  try{ localStorage.setItem(KEY,JSON.stringify(state)); return Promise.resolve(true); }catch(e){ return Promise.resolve(false); }
}
function flushSave(){
  if(_saveT){ clearTimeout(_saveT); _saveT=null; }
  markGlobalSearchDirty();
  if(_saveInFlight){ _saveQueued=true; return new Promise(function(resolve){_saveWaiters.push(resolve);}); }
  _saveInFlight=performStoreSave();
  return _saveInFlight.then(function(ok){
    _saveInFlight=null;
    if(_saveQueued){
      _saveQueued=false;
      const waiters=_saveWaiters.splice(0);
      flushSave().then(function(nextOk){waiters.forEach(function(resolve){resolve(nextOk);});});
    }
    return ok;
  });
}
async function migrateExistingYouTubeLinks(){
  if(!state.settings)state.settings={};
  if(state.settings.youtubeCategoryMigrationV2)return 0;
  let changed=0;
  (state.links||[]).forEach(function(link){
    if(SinradShared.automaticLinkCategory(link.url,"")!=="YouTube")return;
    const prior=(link.category&&link.category!=="YouTube")?link.category:"";
    link.categories=Array.from(new Set(["YouTube"].concat(Array.isArray(link.categories)?link.categories:[]).concat(prior?[prior]:[]).filter(Boolean)));
    if(link.category!=="YouTube"){link.category="YouTube";changed++;}
  });
  state.settings.youtubeCategoryMigrated=true;
  state.settings.youtubeCategoryMigrationV2=true;
  await flushSave();
  return changed;
}
window.addEventListener("beforeunload",function(){ commitOpenTime(false); flushSave(); });

function uid(){ try{ return crypto.randomUUID(); }catch(e){ return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function linkify(m){ var e=esc(m); try{ return e.replace(/(https?:\/\/[^\s<]+)/g,'<span class="lnk">$1</span>'); }catch(_){ return e; } }
function $(s,r){ return (r||document).querySelector(s); }
function nowMs(){ return Date.now(); }
function find(a,id){ return a.find(x=>x.id===id); }
function baseName(p){ const s=String(p||"").replace(/[\\/]+$/,""); const i=Math.max(s.lastIndexOf("/"),s.lastIndexOf("\\")); return i>=0?s.slice(i+1):s; }
function normCat(l){ return (l&&l.category&&String(l.category).trim())||(l&&Array.isArray(l.tags)&&l.tags[0])||""; }
function linkCategoryList(l){ return Array.from(new Set([normCat(l)].concat(l&&Array.isArray(l.categories)?l.categories:[]).filter(Boolean))); }
function linkHasCategory(l,category){ return linkCategoryList(l).indexOf(category)>=0; }
function match(term,...f){ term=(term||"").trim().toLowerCase(); if(!term) return true; return f.some(x=>String(x==null?"":x).toLowerCase().includes(term)); }
function edgeShadow(it){ const L=it.favorite?FAV_COLOR:null; const cc=it.category?(CAT_COLORS[it.category]||FOLDER_CATS[it.category]):null; const R=cc?cc:(it.priority?PRI_COLOR:null); const p=[]; if(L)p.push("inset 3px 0 0 "+L); if(R)p.push("inset -3px 0 0 "+R); return p.length?("box-shadow:"+p.join(",")):""; }
function pill(label,active,color,attrs){ const tone=`color-mix(in srgb, ${color} 52%, #aaa194)`,edge=`color-mix(in srgb, ${color} ${active?34:20}%, #343129)`; const st=`color:${tone};border-color:${edge};background:${active?`color-mix(in srgb, ${color} 7%, #171612)`:'#151410'};box-shadow:${active?`inset 0 -1px ${tone}`:'none'}`; return `<button class="pill" style="${st}" ${attrs}>${label}</button>`; }
function searchRow(key,ph){ return `<div class="mod-search toolbar"><div class="search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/></svg><input data-search="${key}" placeholder="${ph}" value="${esc(searchTerms[key]||"")}" /></div></div>`; }

function toast(msg,type){ const w=$("#toasts"); const t=document.createElement("div"); t.className="toast"+(type?" "+type:""); t.textContent=msg; w.appendChild(t); setTimeout(()=>{ t.style.transition="opacity .3s, transform .3s"; t.style.opacity="0"; t.style.transform="translateX(20px)"; setTimeout(()=>t.remove(),300); },2600); }
function log(level,message,meta){ const e={id:uid(),ts:nowMs(),level:level||"info",message:String(message)}; if(meta)e.meta=meta; state.console.unshift(e); if(state.console.length>500)state.console.length=500; saveState(); renderTermBody(); }
function safeWebUrl(u){ try{ var x=String(u||"").trim(); if(x.indexOf("www.")===0)x="https://"+x; if(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(x))x="https://"+x; var p=new URL(x); return (p.protocol==="http:"||p.protocol==="https:")?p.toString():""; }catch(_){ return ""; } }
function normUrl(u){ return (window.SinradShared&&window.SinradShared.savedUrlIdentity)?window.SinradShared.savedUrlIdentity(u):String(u==null?"":u).trim(); }
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
async function loadArt(){ let custom={};try{if(E&&E.mediaAssets)custom=await E.mediaAssets()||{};}catch(_){} const g=await Promise.all(CELEBRATE_FILES.map(function(files){return probeImg((custom.complete?[custom.complete]:[]).concat(files));})); EFFECTIVE=CELEBRATE_FILES.map((_,i)=>g[i]||CELEBRATE_EMBED[i]||""); const n=await probeImg((custom.norma?[custom.norma]:[]).concat(NORMA_FILES)); const normaImages=[$("#normaGif"),$(".norma-dock-gif")];normaImages.forEach(function(image){if(image)image.src=n||(NORMA_EMBED&&NORMA_EMBED.indexOf("data:")===0?NORMA_EMBED:"");}); const c=$("#celebrate"); if(c&&c.classList.contains("show")){ const im=$("#celImg"); if(im&&EFFECTIVE[celIdx])im.src=EFFECTIVE[celIdx]; } const ug=await Promise.all([probeImg((custom.checking?[custom.checking]:[]).concat(["checking.gif","checking.png","checking.webp"])),probeImg((custom.updating?[custom.updating]:[]).concat(["updating.gif","updating.png","updating.webp"])),probeImg((custom.complete?[custom.complete]:[]).concat(["complete.gif","complete.png","complete.webp"]))]); UPD_GIF_SRC={checking:ug[0]||"checking.gif",updating:ug[1]||"updating.gif",complete:ug[2]||"complete.gif"}; if(currentUpdatePhase)setUpdateGif(currentUpdatePhase); }
function stopCelebrate(){ const c=$("#celebrate");clearTimeout(celebrate._t);if(c)c.classList.remove("show"); }
function celebrate(){ const c=$("#celebrate"); if(!c)return; const pool=(EFFECTIVE&&EFFECTIVE.length)?EFFECTIVE:CELEBRATE_EMBED; const im=$("#celImg"); if(im&&pool.length){ let p=0; if(pool.length>1){ do{ p=Math.floor(Math.random()*pool.length); }while(p===celIdx); } celIdx=p; im.src=pool[p]; } c.classList.remove("show"); void c.offsetWidth; c.classList.add("show"); clearTimeout(celebrate._t); celebrate._t=setTimeout(stopCelebrate,4000); }
const celebrateOverlay=$("#celebrate");if(celebrateOverlay)celebrateOverlay.addEventListener("click",stopCelebrate);

function renderNav(){ $("#nav").innerHTML=MODULES.map(m=>`<button type="button" class="nav-item ${m.id===currentView?"active":""}" data-action="nav" data-nav="${m.id}"${m.id===currentView?' aria-current="page"':""}><span class="nav-ico">${m.ico}</span><span class="nav-txt"><b>${esc(m.name)}</b><span>${esc(m.sub)}</span></span></button>`).join(""); }
let globalSearchItems=[],globalSearchActive=-1;
let _globalWorker=null,_globalRevision=0,_globalIndexedRevision=-1,_globalIndexingRevision=-1,_globalQueryId=0,_globalQueuedQuery=null,_globalIndexTimer=null;
const GLOBAL_SEARCH_COLORS={Vault:"#ff79c6",Links:"#27b4ff","Parking Lot":"#f5a623",Folders:"#33d17a",Screenies:"#7c5cff"};
function globalSearchSnapshot(){
  return {
    vault:(state.vault||[]).map(function(v){return {id:v.id,name:v.name,url:v.url,username:v.username,created:v.created};}),
    links:(state.links||[]).map(function(l){return {id:l.id,title:l.title,url:l.url,note:l.note,category:l.category,categories:l.categories,src:l.src,inLinks:l.inLinks,created:l.created};}),
    folders:(state.folders||[]).map(function(f){return {id:f.id,name:f.name,path:f.path,category:f.category,created:f.created};}),
    shots:(state.shots||[]).map(function(s){return {id:s.id,name:s.name,path:s.path,collection:s.collection,created:s.created||s.added};})
  };
}
function postGlobalSearchIndex(){
  if(!_globalWorker)return;
  if(_globalIndexingRevision===_globalRevision)return;
  if(_globalIndexTimer){clearTimeout(_globalIndexTimer);_globalIndexTimer=null;}
  _globalIndexingRevision=_globalRevision;
  _globalWorker.postMessage({type:"index",revision:_globalRevision,state:globalSearchSnapshot()});
}
function scheduleGlobalSearchIndex(immediate){
  if(!_globalWorker)return;
  if(_globalIndexTimer)clearTimeout(_globalIndexTimer);
  if(immediate){postGlobalSearchIndex();return;}
  _globalIndexTimer=setTimeout(function(){
    _globalIndexTimer=null;
    const run=function(){if(_globalIndexedRevision!==_globalRevision)postGlobalSearchIndex();};
    if(typeof requestIdleCallback==="function")requestIdleCallback(run,{timeout:1200});else run();
  },350);
}
function markGlobalSearchDirty(){_globalRevision++;scheduleGlobalSearchIndex(false);}
function paintGlobalSearchResults(results){
  const panel=$("#globalSearchResults");if(!panel)return;
  globalSearchItems=Array.isArray(results)?results:[];globalSearchActive=-1;
  if(!globalSearchItems.length){panel.innerHTML='<div class="gs-empty">No matches across S.I.R</div>';panel.classList.add("show");return;}
  const groups={};globalSearchItems.forEach(function(item,index){(groups[item.kind]=groups[item.kind]||[]).push({item:item,index:index});});
  panel.innerHTML=["Vault","Links","Parking Lot","Folders","Screenies"].filter(function(kind){return groups[kind]&&groups[kind].length;}).map(function(kind){return '<div class="gs-group">'+esc(kind)+'</div>'+groups[kind].map(function(entry){const item=entry.item,color=GLOBAL_SEARCH_COLORS[kind]||"#27b4ff";return '<button type="button" class="gs-result" role="option" data-action="global-result" data-index="'+entry.index+'" style="--gs-color:'+color+'"><span class="gs-dot"></span><span class="gs-copy"><b>'+esc(item.title)+'</b><small>'+esc(item.detail||"")+'</small></span><span class="gs-kind">'+esc(kind)+'</span></button>';}).join("");}).join("");
  panel.classList.add("show");
}
function initGlobalSearchWorker(){
  if(typeof Worker==="undefined")return;
  try{
    _globalWorker=new Worker("assets/search-worker.js");
    _globalWorker.onmessage=function(event){const message=event.data||{};if(message.type==="indexed"){_globalIndexedRevision=Number(message.revision)||0;_globalIndexingRevision=-1;if(_globalIndexedRevision!==_globalRevision){scheduleGlobalSearchIndex(true);return;}if(_globalQueuedQuery){const queued=_globalQueuedQuery;_globalQueuedQuery=null;_globalWorker.postMessage(queued);}return;}if(message.type==="results"&&message.id===_globalQueryId){paintGlobalSearchResults(message.results);}};
    _globalWorker.onerror=function(){try{_globalWorker.terminate();}catch(_){} _globalWorker=null;};
    postGlobalSearchIndex();
  }catch(_){_globalWorker=null;}
}
function closeGlobalSearch(clear){const panel=$("#globalSearchResults"),input=$("#globalSearchInput");_globalQueryId++;_globalQueuedQuery=null;if(panel){panel.classList.remove("show");panel.innerHTML="";}globalSearchItems=[];globalSearchActive=-1;if(clear&&input)input.value="";}
function paintGlobalSearchActive(){document.querySelectorAll(".gs-result").forEach(function(row,index){row.classList.toggle("active",index===globalSearchActive);if(index===globalSearchActive)row.scrollIntoView({block:"nearest"});});}
function renderGlobalSearch(){
  const input=$("#globalSearchInput"),panel=$("#globalSearchResults");if(!input||!panel)return;
  const query=input.value.trim();globalSearchActive=-1;
  if(!query){closeGlobalSearch(false);return;}
  if(!_globalWorker){paintGlobalSearchResults(SinradShared.globalSearch(state,query,30));return;}
  const request={type:"search",id:++_globalQueryId,query:query,limit:30};
  if(_globalIndexedRevision!==_globalRevision){_globalQueuedQuery=request;panel.innerHTML='<div class="gs-empty">Searching…</div>';panel.classList.add("show");scheduleGlobalSearchIndex(true);return;}
  _globalWorker.postMessage(request);
}
function openGlobalSearchResult(index){
  const item=globalSearchItems[Number(index)];if(!item)return;
  const query=($("#globalSearchInput")||{}).value||"";if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);currentView=item.view;searchTerms={};searchTerms[currentView]=query.trim();if(currentView==="lot")linkDrill=null;if(currentView==="shots")shotPage=0;
  closeGlobalSearch(true);renderNav();renderView();
  setTimeout(function(){const card=document.querySelector('[data-id="'+CSS.escape(item.id)+'"]');if(card){card.scrollIntoView({block:"center"});card.classList.add("search-hit");setTimeout(function(){card.classList.remove("search-hit");},1200);}},30);
}
function renderConsole(){
  const dock=$("#consoleDock"); if(!dock)return;
  dock.innerHTML='<div class="console-wip" role="status"><span>Work in progress</span><i aria-hidden="true"></i></div>';
}
function updateAutoScrollBtn(){ var b=$("#autoScrollBtn"); if(!b) return; var on=!(state.settings&&state.settings.autoScroll===false); b.classList.toggle("on",on); b.textContent=(on?"✓ ":"")+"Auto Scroll"; }

function renderTermBody(){
  const dock=$("#consoleDock"); if(!dock)return;
  if(!dock.querySelector(".console-wip"))renderConsole();
}
function _sendCollToLinks(coll){ if(!coll) return; var n=0; rememberUndo("Sent stack to Links"); state.links.forEach(function(l){ if((l.coll||"")===coll && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); if(n){ saveState(); renderView(); log("info","sent "+n+" link(s) from "+coll+" to Links"); } }
function _lotSendSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var n=0; rememberUndo("Sent parked links to Links"); ids.forEach(function(x){ var l=find(state.links,x); if(l && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); colls.forEach(function(c){ state.links.forEach(function(l){ if((l.coll||"")===c && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); }); saveState(); lotSelLinks={}; lotSelColls={}; renderView(); log("info","sent "+n+" parked link(s) to Links"); }
function renameStack(coll){
  if(!coll) return;
  openModal("✏️ Rename stack", '<div class="field"><label>New name</label><input id="rs_name" value="'+esc(coll).replace(/"/g,'&quot;')+'"></div>', "Rename", function(){ var el=document.getElementById("rs_name"); var v=el?el.value:""; v=(v||"").trim(); if(!v || v===coll){ closeModal(); return; } var exists=state.links.some(function(l){ return _inLot(l)&&(l.coll||"")===v; }); state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===coll) l.coll=v; }); saveState(); closeModal(); log("info","renamed stack "+coll+" -> "+v+(exists?" (merged into existing)":"")); renderView(); });
  setTimeout(function(){ var i=document.getElementById("rs_name"); if(i){ i.focus(); i.select(); } },30);
}

function renderView(){ if(monitoringMode){renderMonitoringView();return;} if(offlineMode){renderOfflineView();return;} if(currentView!=="lot"){ lotSelLinks={}; lotSelColls={}; } if(currentView!=="links"){ linkSelLinks={}; } const c=$("#content"); try{ c.parentElement.classList.toggle("lot-active", currentView==="lot"); }catch(_){} switch(currentView){ case "vault":c.innerHTML=viewVault();break; case "links":c.innerHTML=viewLinks();break; case "lot":c.innerHTML=viewLot();break; case "folders":c.innerHTML=viewFolders();break; case "shots":c.innerHTML=viewShots(); shotsHydrateThumbs(); break; default:c.innerHTML=viewVault(); } hydrateModulePreviews(); }
function pageItemCount(){
  const content=$("#content");if(!content)return 0;
  if(offlineMode){if(content.querySelector(".of-reader"))return 1;return content.querySelectorAll(offlineTab==="sources"?".of-source":".of-card").length;}
  if(monitoringMode){if(content.querySelector(".mon-reader"))return 1;if(content.querySelector(".mon-artist"))return content.querySelectorAll(".mon-artist-post").length;return content.querySelectorAll(monitoringTab==="watchlist"?".mon-watch":".mon-event").length;}
  const selector={vault:".vault-card",links:".link-card",lot:".lot-row,.lot-item",folders:".folder-row",shots:".shot-card"}[currentView]||"";
  return selector?content.querySelectorAll(selector).length:0;
}
function renderPageCounter(){
  const counter=$("#pageCounter");if(!counter)return;
  const count=pageItemCount(),label=count+" item"+(count===1?"":"s")+" shown on this page";
  if(counter.dataset.count===String(count))return;
  counter.innerHTML=String(count).split("").map(function(digit){return '<img src="assets/page-counter/'+digit+'.png" alt="">';}).join("");
  counter.dataset.count=String(count);counter.title=label;counter.setAttribute("aria-label",label);
}
function initPageCounter(){const content=$("#content");if(!content)return;new MutationObserver(renderPageCounter).observe(content,{childList:true,subtree:true});renderPageCounter();}
function pageCounterMarkup(){return '<div class="page-counter" id="pageCounter" title="Items shown on this page" aria-label="Items shown on this page"></div>';}
function head(t,d,a){ return `<div class="mod-head"><div><h1>${esc(t)}</h1><p>${esc(d)}</p></div><div class="spacer"></div>${pageCounterMarkup()}${a||""}</div>`; }
function emptyState(i,m){ return `<div class="empty"><div class="e-ico">${i}</div><p>${esc(m)}</p></div>`; }

function offlineDate(ts){if(!ts)return "Never";return new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function offlineItem(id){return (offlineData.items||[]).find(function(item){return item.id===id;});}
async function loadOfflineData(){
  if(!E||!E.offlineLoad){toast("Offline Reader needs the desktop build","warn");return;}
  offlineLoading=true;renderView();
  try{const result=await Promise.all([E.offlineLoad(),E.offlineAuthStatus()]);if(result[0])offlineData=result[0];if(result[1])offlineAuth=result[1];}
  catch(error){toast("Could not load Offline Reader","err");}
  offlineLoading=false;renderView();
}
function setOfflineMode(enabled,quiet){
  closeSettings();
  if(enabled&&monitoringMode)setMonitoringMode(false,true);
  offlineMode=!!enabled;offlineSelectedId="";
  const win=$("#window"),button=$("#offlineToggle");if(win)win.classList.toggle("offline-mode",offlineMode);
  if(button){button.classList.toggle("active",offlineMode);const label=button.querySelector("b");if(label)label.textContent="Offline";button.title=offlineMode?"Return to normal SINRAD":"Switch to the Offline Reader";}
  if(offlineMode)loadOfflineData();else if(!quiet){renderNav();renderView();}
}
function offlineFilteredItems(){
  const query=offlineQuery.trim().toLowerCase();
  return (offlineData.items||[]).filter(function(item){
    if(offlineFilter==="unread"&&item.read)return false;if(offlineFilter==="favorite"&&!item.favorite)return false;
    return !query||[item.title,item.author,item.content,item.community,item.platform].some(function(value){return String(value||"").toLowerCase().includes(query);});
  });
}
function offlineSourceName(item){const source=(offlineData.sources||[]).find(function(entry){return entry.id===item.sourceId;});return source?source.label:(item.community||item.platform);}
function offlineMediaKind(ref){return /\.(?:mp4|webm)$/i.test(String(ref||""))?"video":"image";}
function offlineMediaUrl(ref){const match=String(ref||"").replace(/\\/g,"/").match(/^media\/((?:[a-f0-9]{24}\/)?[a-f0-9]{64}\.(?:mp4|webm))$/i);return match?"sinrad-offline://media/"+match[1].split("/").map(encodeURIComponent).join("/"):"";}
function offlineAvatar(ref,label){return ref?'<img class="of-avatar" data-offline-media="'+esc(ref)+'" alt="'+esc(label||'User avatar')+'" loading="lazy">':'<span class="of-avatar fallback" aria-hidden="true">u/</span>';}
function offlineCommentMedia(comment){return (Array.isArray(comment.media)?comment.media:[]).map(function(ref,index){if(offlineMediaKind(ref)==="video")return '<video class="of-comment-media" src="'+esc(offlineMediaUrl(ref))+'" autoplay loop muted playsinline controls aria-label="Comment video '+(index+1)+'"></video>';return '<img class="of-comment-media" data-offline-media="'+esc(ref)+'" alt="Comment image '+(index+1)+'" loading="lazy">';}).join("");}
function offlineMediaTag(item,detail){const refs=Array.isArray(item.media)?item.media:[],ref=refs.find(function(value){return offlineMediaKind(value)==="image";});return ref?'<img class="of-media'+(detail?' detail':'')+'" data-offline-media="'+esc(ref)+'" alt="" loading="lazy">':"";}
function offlineGallery(item){
  const refs=Array.isArray(item.media)?item.media.filter(Boolean):[];if(!refs.length)return "";
  const images=refs.map(function(ref,index){const active=index===0?' active':'',position=' data-gallery-image="'+index+'"';if(offlineMediaKind(ref)==="video")return '<video class="of-gallery-video'+active+'"'+position+' src="'+esc(offlineMediaUrl(ref))+'" controls preload="metadata" playsinline aria-label="Post video '+(index+1)+' of '+refs.length+'"></video>';return '<img class="of-gallery-image'+active+'" data-offline-media="'+esc(ref)+'"'+position+' alt="Post image '+(index+1)+' of '+refs.length+'" loading="lazy">';}).join("");
  const controls=refs.length>1?'<button type="button" class="of-gallery-nav prev" data-action="offline-gallery-prev" aria-label="Previous image">‹</button><button type="button" class="of-gallery-nav next" data-action="offline-gallery-next" aria-label="Next image">›</button><span class="of-gallery-count"><b>1</b> / '+refs.length+'</span>':"";
  return '<section class="of-gallery'+(refs.length===1?' single':'')+'" data-gallery-index="0"><div class="of-gallery-stage">'+images+controls+'</div></section>';
}
function offlineRichRuns(runs){return (Array.isArray(runs)?runs:[]).map(function(run){let value=esc(run&&run.text||"");if(run&&run.code)value='<code>'+value+'</code>';if(run&&run.italic)value='<em>'+value+'</em>';if(run&&run.bold)value='<strong>'+value+'</strong>';return value;}).join("");}
function offlineRichBlocks(blocks,className){return '<div class="'+esc(className||"of-rich")+' rich">'+(Array.isArray(blocks)?blocks:[]).map(function(block){const body=offlineRichRuns(block.runs);if(block.type==="heading")return '<h'+Math.min(4,Math.max(2,Number(block.level)||2))+'>'+body+'</h'+Math.min(4,Math.max(2,Number(block.level)||2))+'>';if(block.type==="listItem")return '<div class="of-rich-li" style="--list-depth:'+Math.min(8,Number(block.depth)||0)+'"><span>'+(block.ordered?esc(block.index)+'.':'•')+'</span><p>'+body+'</p></div>';if(block.type==="quote")return '<blockquote>'+body+'</blockquote>';if(block.type==="code")return '<pre><code>'+body+'</code></pre>';return '<p>'+body+'</p>';}).join("")+'</div>';}
function offlinePostBody(item){
  const blocks=Array.isArray(item.contentBlocks)?item.contentBlocks:[];if(blocks.length)return offlineRichBlocks(blocks,"of-body");
  return item.content?'<div class="of-body">'+esc(item.content)+'</div>':"";
}
function offlineFeedCard(item){
  const author=item.author?'<span>u/'+esc(item.author)+'</span>':'<span>Offline snapshot</span>';
  const postStats=item.platform==="reddit"?'<span>▲ '+esc(item.score)+'</span><span>◌ '+esc(item.commentCount)+'</span>':'<span>'+esc(Math.max(1,Math.round((item.captureSize||0)/1024)))+' KB</span><span>MHTML</span>';
  return '<article class="of-card'+(item.read?' read':'')+(item.captureRef?' captured':'')+'" data-action="offline-item-open" data-id="'+esc(item.id)+'">'+offlineMediaTag(item,false)+'<div class="of-card-copy"><div class="of-card-meta"><b>'+esc(item.platform.toUpperCase())+'</b><span>'+esc(offlineSourceName(item))+'</span><time>'+esc(offlineDate(item.date))+'</time></div><h2>'+esc(item.title)+'</h2><p>'+esc(item.content||((item.media&&item.media.length)?"Media post":"Open to read the saved post"))+'</p><div class="of-card-foot">'+author+postStats+'<button type="button" data-action="offline-item-favorite" data-id="'+esc(item.id)+'" title="Favorite">'+(item.favorite?'★':'☆')+'</button></div></div></article>';
}
function viewOfflineDetail(item){
  const savedComments=item.comments||[];
  const comments=savedComments.length?'<section class="of-comments"><h3>Comments <span>'+savedComments.length+' saved</span></h3>'+savedComments.map(function(comment){const when=comment.date?'<time>'+esc(offlineDate(comment.date))+'</time>':'',blocks=Array.isArray(comment.contentBlocks)?comment.contentBlocks:[],body=blocks.length?offlineRichBlocks(blocks,"of-comment-body"):(comment.body?'<div class="of-comment-body"><p>'+esc(comment.body)+'</p></div>':'');return '<article class="of-comment" style="--comment-depth:'+Math.min(8,Number(comment.depth)||0)+'"><div class="of-comment-row">'+offlineAvatar(comment.avatar,'u/'+(comment.author||'[deleted]'))+'<div class="of-comment-copy"><header><b>u/'+esc(comment.author||'[deleted]')+'</b>'+when+'<span>▲ '+esc(comment.score)+'</span></header>'+body+offlineCommentMedia(comment)+'</div></div></article>';}).join("")+'</section>':"";
  const flair=item.authorFlair?'<span class="of-author-flair">'+esc(item.authorFlair)+'</span>':'';
  const byline=(item.author?'u/'+esc(item.author)+flair+' · ':'')+'cached '+esc(offlineDate(item.downloadedAt)),postFlair=item.postFlair?'<span class="of-post-flair">'+esc(item.postFlair)+'</span>':'';
  const stats=item.platform==="reddit"?'<div class="of-post-stats"><span>▲ '+esc(item.score)+'</span><span>◌ '+esc(item.commentCount)+' comments</span></div>':'';
  return '<div class="of-reader"><button type="button" class="mode-back" data-action="offline-item-back">← Back</button><article class="of-article"><div class="of-post-head"><div class="of-kicker">'+esc(item.platform.toUpperCase())+' · '+esc(offlineSourceName(item))+' · '+esc(offlineDate(item.date))+'</div><h1>'+esc(item.title)+'</h1><div class="of-author-row">'+offlineAvatar(item.authorAvatar,'u/'+(item.author||'[deleted]'))+'<div><div class="of-byline">'+byline+'</div>'+postFlair+'</div></div></div>'+offlineGallery(item)+offlinePostBody(item)+stats+comments+'</article></div>';
}
function viewOfflineSources(){
  const auth=offlineAuth.connected?'<div class="of-connect connected"><span class="of-source-icon reddit">r/</span><div><b>Reddit connected</b><small>u/'+esc(offlineAuth.username)+' · credentials '+(offlineAuth.secure?'encrypted':'protected locally')+'</small></div><button class="btn sm ghost" data-action="offline-reddit-disconnect">Disconnect</button></div>':'<div class="of-connect"><span class="of-source-icon reddit">r/</span><div><b>Connect Reddit</b><small>Uses Reddit OAuth and its official Data API.</small></div><button class="btn sm primary" data-action="offline-reddit-connect">Connect</button></div>';
  const sources=(offlineData.sources||[]).length?'<div class="of-source-list">'+offlineData.sources.map(function(source){return '<article class="of-source"><span class="of-source-icon reddit">r/</span><div><b>'+esc(source.label)+'</b><small>'+esc(source.sort)+' '+esc(source.limit)+' posts · every '+esc(source.intervalHours)+'h'+(source.topComments?' · '+esc(source.topComments)+' comments':'')+'</small><small class="'+(source.lastError?'error':'')+'">'+(source.lastError?esc(source.lastError):'Last sync: '+esc(offlineDate(source.lastSync)))+'</small></div><button class="btn sm ghost" data-action="offline-source-refresh" data-id="'+esc(source.id)+'">Sync</button><button class="btn sm danger" data-action="offline-source-remove" data-id="'+esc(source.id)+'">Remove</button></article>';}).join("")+'</div>':emptyState("r/","No Reddit feeds yet. Connect Reddit, then add a subreddit.");
  return '<div class="of-sources">'+auth+'<div class="of-source-actions"><button class="btn primary" data-action="offline-source-add"'+(offlineAuth.connected?'':' disabled')+'>＋ Add subreddit</button><button class="btn ghost" data-action="offline-retention">Retention: '+esc(offlineData.settings.retentionDays)+' days</button></div>'+sources+'<div class="of-coming"><b>Adapter slots ready</b><span>YouTube transcripts and X/Twitter can plug into this same feed later.</span></div></div>';
}
function renderOfflineView(){
  const content=$("#content");if(!content)return;
  if(offlineLoading){content.innerHTML='<div class="of-loading"><i></i><b>Loading Offline Reader…</b></div>';return;}
  const selected=offlineSelectedId&&offlineItem(offlineSelectedId);if(selected){content.innerHTML=viewOfflineDetail(selected);hydrateOfflineMedia();return;}
  const items=offlineFilteredItems(),unread=(offlineData.items||[]).filter(function(item){return !item.read;}).length;
  const nav='<header class="of-head"><div class="mode-heading"><button type="button" class="mode-back" data-action="offline-exit">← Back</button><div><span class="of-mode-mark"><i></i> OFFLINE READER</span><h1>Your cached feed</h1><p>Everything shown here remains available without internet.</p></div></div><div class="of-head-actions">'+pageCounterMarkup()+'<button class="btn ghost" data-action="offline-refresh"'+(offlineSyncing?' disabled':'')+'>'+(offlineSyncing?'Syncing…':'↻ Sync now')+'</button></div></header><nav class="of-tabs"><button class="'+(offlineTab==='feed'?'active':'')+'" data-action="offline-tab" data-tab="feed">Feed <b>'+esc(offlineData.items.length)+'</b></button><button class="'+(offlineTab==='sources'?'active':'')+'" data-action="offline-tab" data-tab="sources">Sources <b>'+esc(offlineData.sources.length)+'</b></button><span></span><small>'+esc(unread)+' unread · updated '+esc(offlineDate(offlineData.updatedAt))+'</small></nav>';
  if(offlineTab==="sources"){content.innerHTML='<div class="offline-shell">'+nav+viewOfflineSources()+'</div>';return;}
  const toolbar='<div class="of-toolbar"><input id="offlineSearch" value="'+esc(offlineQuery)+'" placeholder="Search downloaded posts…"><div><button class="'+(offlineFilter==='all'?'active':'')+'" data-action="offline-filter" data-filter="all">All</button><button class="'+(offlineFilter==='unread'?'active':'')+'" data-action="offline-filter" data-filter="unread">Unread</button><button class="'+(offlineFilter==='favorite'?'active':'')+'" data-action="offline-filter" data-filter="favorite">Favorites</button></div></div>';
  const body=items.length?'<div class="of-feed">'+items.map(offlineFeedCard).join("")+'</div>':emptyState("◫",offlineData.items.length?"No downloaded posts match this filter.":"Your offline feed is empty. Add a source, then sync it while online.");
  content.innerHTML='<div class="offline-shell">'+nav+toolbar+body+'</div>';hydrateOfflineMedia();
}
function hydrateOfflineMedia(){
  if(!E||!E.offlineMedia)return;
  document.querySelectorAll("[data-offline-media]").forEach(function(image){
    const ref=image.dataset.offlineMedia;if(!ref||image.dataset.loading)return;image.dataset.loading="1";
    if(offlineMediaCache.has(ref)){image.src=offlineMediaCache.get(ref);return;}
    E.offlineMedia(ref).then(function(src){if(src){offlineMediaCache.set(ref,src);image.src=src;}else image.remove();}).catch(function(){image.remove();});
  });
}
function redditConnectModal(){
  const body='<p class="of-modal-note">Create or request a Reddit Data API app, choose an installed app, and set this exact redirect URI:</p><div class="of-copyline">http://127.0.0.1:47821/reddit/callback</div><button type="button" class="btn sm ghost" data-action="offline-reddit-help">Open Reddit API setup ↗</button><div class="field"><label>Reddit client ID</label><input id="or_client" placeholder="Client ID"></div><div class="field"><label>Your Reddit username</label><input id="or_user" placeholder="without u/"></div>';
  openModal("Connect Reddit",body,"Connect",async function(){const button=$("#modal-confirm");if(button){button.disabled=true;button.textContent="Opening Reddit…";}const result=await E.offlineRedditConnect({clientId:$("#or_client").value,username:$("#or_user").value});if(!result||!result.ok){if(button){button.disabled=false;button.textContent="Connect";}toast(result&&result.error||"Could not start Reddit connection","err");return;}closeModal();toast("Approve access in the Reddit tab","ok");});
}
function redditSourceModal(){
  const body='<div class="field"><label>Subreddit</label><input id="ors_name" placeholder="e.g. AskReddit"></div><div class="field"><label>Posts per sync</label><input id="ors_limit" type="number" min="1" max="100" value="30"></div><div class="field"><label>Update every</label><select id="ors_interval"><option value="6">6 hours</option><option value="12">12 hours</option><option value="24" selected>Daily</option><option value="168">Weekly</option></select></div><div class="field"><label>Sort</label><select id="ors_sort"><option value="new">Newest</option><option value="hot">Hot</option><option value="top">Top</option></select></div><div class="field"><label>Useful top comments</label><select id="ors_comments"><option value="0">None — fastest</option><option value="3">Top 3</option><option value="5">Top 5</option></select></div>';
  openModal("Add Reddit feed",body,"Add & sync",async function(){const button=$("#modal-confirm");if(button){button.disabled=true;button.textContent="Adding…";}const result=await E.offlineSourceAdd({platform:"reddit",handle:$("#ors_name").value,limit:Number($("#ors_limit").value),intervalHours:Number($("#ors_interval").value),sort:$("#ors_sort").value,topComments:Number($("#ors_comments").value)});if(!result||!result.ok){if(button){button.disabled=false;button.textContent="Add & sync";}toast(result&&result.error||"Could not add source","err");return;}closeModal();await loadOfflineData();toast("Reddit feed added — first sync started","ok");});
}
function offlineRetentionModal(){
  const body='<div class="field"><label>Keep downloaded posts for</label><input id="of_retention" type="number" min="1" max="3650" value="'+esc(offlineData.settings.retentionDays)+'"><div class="hint">Days. Favorites are always kept.</div></div><div class="field"><label>Maximum cached posts</label><input id="of_max" type="number" min="100" max="20000" value="'+esc(offlineData.settings.maxItems)+'"></div>';
  openModal("Offline storage",body,"Save",async function(){const result=await E.offlineSettings({retentionDays:Number($("#of_retention").value),maxItems:Number($("#of_max").value)});if(result){offlineData=result;closeModal();renderView();toast("Offline retention updated","ok");}else toast("Could not save retention settings","err");});
}
if(E&&E.onOfflineChanged)E.onOfflineChanged(function(data){if(data)offlineData=data;if(offlineMode){offlineLoading=false;offlineSyncing=false;E.offlineAuthStatus().then(function(status){offlineAuth=status;renderView();});}});

function monitoringDate(ts){if(!ts)return "Never";return new Date(ts).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function monitoringMonitor(id){return (monitoringData.monitors||[]).find(function(item){return item.id===id;});}
function monitoringEvent(id){return (monitoringData.events||[]).find(function(item){return item.id===id;});}
function monitoringInterval(value){const minutes=Number(value)||1440;if(minutes<60)return minutes+"m";if(minutes%1440===0)return (minutes/1440)+"d";return (minutes/60)+"h";}
function monitoringFilteredEvents(){
  const query=monitoringQuery.trim().toLowerCase();
  return (monitoringData.events||[]).filter(function(item){
    if(monitoringFilter==="unread"&&item.read)return false;
    const monitor=monitoringMonitor(item.monitorId);return !query||[item.title,item.summary,item.author,monitor&&monitor.label,item.kind].some(function(value){return String(value||"").toLowerCase().includes(query);});
  });
}
function monitoringMediaTag(ref,className,alt){return ref?'<img class="'+esc(className||"")+'" data-monitoring-media="'+esc(ref)+'" alt="'+esc(alt||"")+'" loading="lazy">':"";}
function hydrateMonitoringMedia(){
  if(!E||!E.monitoringMedia)return;
  document.querySelectorAll("[data-monitoring-media]").forEach(function(image){
    const ref=image.dataset.monitoringMedia;if(!ref||image.dataset.loading)return;image.dataset.loading="1";
    if(monitoringMediaCache.has(ref)){image.src=monitoringMediaCache.get(ref);return;}
    E.monitoringMedia(ref).then(function(src){if(src){monitoringMediaCache.set(ref,src);image.src=src;}else image.remove();}).catch(function(){image.remove();});
  });
}
async function loadMonitoringData(){
  if(!E||!E.monitoringLoad){toast("Monitoring Mode needs the desktop build","warn");return;}
  monitoringLoading=true;renderView();
  try{const result=await E.monitoringLoad();if(result)monitoringData=result;}catch(_){toast("Could not load Monitoring Mode","err");}
  monitoringLoading=false;renderView();
}
function setMonitoringMode(enabled,quiet){
  closeSettings();
  if(enabled&&offlineMode)setOfflineMode(false,true);
  monitoringMode=!!enabled;if(!monitoringMode){monitoringDetailRequest++;monitoringArtistRequest++;monitoringDetail=null;monitoringDetailLoading=false;monitoringArtist=null;monitoringArtistLoading=false;}const win=$("#window"),button=$("#monitoringToggle");if(win)win.classList.toggle("monitoring-mode",monitoringMode);
  if(button){button.classList.toggle("active",monitoringMode);const label=button.querySelector("b");if(label)label.textContent="Monitor";button.title=monitoringMode?"Return to normal SINRAD":"Switch to Monitoring Mode";}
  if(monitoringMode)loadMonitoringData();else if(!quiet){renderNav();renderView();}
}
function leaveMonitoringPost(){
  if(!monitoringMode||(!monitoringDetail&&!monitoringDetailLoading))return false;
  monitoringDetailRequest++;monitoringDetail=null;monitoringDetailLoading=false;monitoringFocusId="";renderView();return true;
}
function leaveMonitoringArtist(){
  if(!monitoringMode||(!monitoringArtist&&!monitoringArtistLoading))return false;
  monitoringArtistRequest++;monitoringArtist=null;monitoringArtistLoading=false;monitoringFocusId="";renderView();return true;
}
function toggleMonitoringMode(){closeSettings();if(!leaveMonitoringPost()&&!leaveMonitoringArtist())setMonitoringMode(!monitoringMode);}
function monitoringEventCard(item){
  const monitor=monitoringMonitor(item.monitorId),source=item.kind==="f95"?"F95ZONE":"PAWCHIVE";
  const avatar=monitoringMediaTag(monitor&&monitor.avatarRef,"mon-event-avatar-img",monitor&&monitor.label),preview=monitoringMediaTag(item.mediaRef,"mon-event-preview",item.title);
  return '<article class="mon-event'+(item.mediaRef?' has-image':' text-only')+(item.read?' read':'')+(item.id===monitoringFocusId?' focused':'')+'" data-action="monitoring-event-open" data-id="'+esc(item.id)+'" title="Open update"><div class="mon-event-media">'+(preview||'<div class="mon-event-placeholder"><b>'+esc(source)+'</b><span>'+esc(item.kind==='f95'?'New thread reply':'New creator post')+'</span></div>')+'<span class="mon-source '+esc(item.kind)+'">'+source+'</span><span class="mon-event-avatar"><i>'+(item.kind==='f95'?'F':esc((monitor&&monitor.label||'P').charAt(0)))+'</i>'+avatar+'</span></div><div class="mon-event-copy"><div class="mon-event-meta"><b>'+esc(monitor&&monitor.label||source)+'</b><time>'+esc(monitoringDate(item.date))+'</time></div><h2>'+esc(item.title)+'</h2>'+(item.summary?'<p>'+esc(item.summary)+'</p>':'')+'</div></article>';
}
function viewMonitoringWatchlist(){
  const monitors=monitoringData.monitors||[];
  const list=monitors.length?'<div class="mon-watch-list">'+monitors.map(function(item){
    const type=item.kind==="f95"?"F95zone":"Pawchive",status=item.lastError?item.lastError:(item.initialized?'Last checked '+monitoringDate(item.lastChecked):'Creating first baseline…');
    const avatar=monitoringMediaTag(item.avatarRef,"mon-watch-avatar-img",item.label),banner=monitoringMediaTag(item.bannerRef,"mon-watch-banner","");
    return '<article class="mon-watch'+(item.enabled?'':' paused')+'" data-action="monitoring-monitor-open" data-ctx="monitor" data-id="'+esc(item.id)+'" title="Open artist · right-click for watcher options"><div class="mon-watch-hero">'+(banner||'<div class="mon-watch-banner-fallback"></div>')+'<span class="mon-watch-avatar '+esc(item.kind)+'"><i>'+(item.kind==='f95'?'F95':esc((item.label||'P').charAt(0)))+'</i>'+avatar+'</span><div class="mon-watch-identity"><b>'+esc(item.label)+'</b><span>'+esc(type)+' · '+(item.enabled?'Watching':'Paused')+'</span></div></div><div class="mon-watch-meta"><span>Every '+esc(monitoringInterval(item.intervalMinutes))+'</span><span class="'+(item.lastError?'error':'')+'">'+esc(status)+'</span></div></article>';
  }).join('')+'</div>':emptyState("◉","Nothing is being watched yet. Add a Pawchive, Bakemono or F95zone link.");
  return '<div class="mon-watch-actions"><button class="btn primary" data-action="monitoring-add">＋ Add watcher</button></div>'+list;
}
function monitoringArtistPostCard(item){
  const preview=item.previewSrc?'<img class="mon-artist-preview" src="'+esc(item.previewSrc)+'" alt="" loading="lazy">':'<div class="mon-event-placeholder"><b>PAWCHIVE</b><span>Artist post</span></div>';
  return '<article class="mon-artist-post" data-action="monitoring-artist-post-open" data-ctx="monitor-artist-post" data-id="'+esc(item.postId)+'" title="Open post · right-click for options"><div class="mon-artist-post-media">'+preview+'</div><div class="mon-artist-post-copy"><time>'+esc(monitoringDate(item.date))+'</time><h2>'+esc(item.title)+'</h2>'+(item.summary?'<p>'+esc(item.summary)+'</p>':'')+'<small>'+esc(item.attachmentCount||0)+' file'+(Number(item.attachmentCount)===1?'':'s')+'</small></div></article>';
}
function monitoringDateInput(value){const date=new Date(Number(value)||Date.now()),part=function(number){return String(number).padStart(2,'0');};return date.getFullYear()+'-'+part(date.getMonth()+1)+'-'+part(date.getDate());}
function monitoringArtistRangeInfo(artist){
  const all=(artist.posts||[]),newest=all.length?all[0].date:Date.now(),oldest=all.length?all[all.length-1].date:Date.now();
  if(monitoringArtistRange.monitorId!==artist.monitorId)monitoringArtistRange={monitorId:artist.monitorId,from:monitoringDateInput(oldest),to:monitoringDateInput(newest)};
  const fromTime=new Date(monitoringArtistRange.from+'T00:00:00').getTime(),toTime=new Date(monitoringArtistRange.to+'T23:59:59.999').getTime();
  const valid=Number.isFinite(fromTime)&&Number.isFinite(toTime)&&fromTime<=toTime;
  return {all:all,posts:valid?all.filter(function(post){return post.date>=fromTime&&post.date<=toTime;}):[],oldest:monitoringDateInput(oldest),newest:monitoringDateInput(newest),valid:valid};
}
function monitoringRangeDateLabel(value){const date=new Date(String(value||'')+'T12:00:00');return Number.isFinite(date.getTime())?date.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'Choose date';}
function monitoringArtistPostDays(artist){
  const days=new Map();(artist.posts||[]).forEach(function(post){const iso=monitoringDateInput(post.date),item=days.get(iso)||{iso:iso,date:new Date(iso+'T12:00:00'),count:0};item.count++;days.set(iso,item);});return Array.from(days.values()).sort(function(a,b){return b.date-a.date;});
}
function monitoringArtistDatePicker(artist){
  if(!monitoringDatePicker.side)return '';
  const days=monitoringArtistPostDays(artist),side=monitoringDatePicker.side==='to'?'To':'From',head='<div class="mon-date-picker-head"><b>Choose '+side+' date</b>'+(monitoringDatePicker.level==='year'?'':'<button type="button" data-action="monitoring-artist-date-back">← Back</button>')+'</div>';let options='';
  if(monitoringDatePicker.level==='year'){
    const years=Array.from(new Set(days.map(function(item){return item.date.getFullYear();})));options='<div class="mon-date-options years">'+years.map(function(year){const count=days.filter(function(item){return item.date.getFullYear()===year;}).reduce(function(total,item){return total+item.count;},0);return '<button type="button" data-action="monitoring-artist-date-year" data-year="'+year+'"><b>'+year+'</b><small>'+count+' work'+(count===1?'':'s')+'</small></button>';}).join('')+'</div>';
  }else if(monitoringDatePicker.level==='month'){
    const months=Array.from(new Set(days.filter(function(item){return item.date.getFullYear()===monitoringDatePicker.year;}).map(function(item){return item.date.getMonth();})));options='<div class="mon-date-options months">'+months.map(function(month){const matching=days.filter(function(item){return item.date.getFullYear()===monitoringDatePicker.year&&item.date.getMonth()===month;}),count=matching.reduce(function(total,item){return total+item.count;},0),label=new Date(2000,month,1).toLocaleDateString([],{month:'long'});return '<button type="button" data-action="monitoring-artist-date-month" data-month="'+month+'"><b>'+esc(label)+'</b><small>'+count+' work'+(count===1?'':'s')+'</small></button>';}).join('')+'</div>';
  }else{
    const matching=days.filter(function(item){return item.date.getFullYear()===monitoringDatePicker.year&&item.date.getMonth()===monitoringDatePicker.month;});options='<div class="mon-date-options days">'+matching.map(function(item){return '<button type="button" data-action="monitoring-artist-date-pick" data-date="'+item.iso+'"><b>'+item.date.getDate()+'</b><span>'+esc(item.date.toLocaleDateString([],{weekday:'short'}))+'</span><small>'+item.count+' post'+(item.count===1?'':'s')+'</small></button>';}).join('')+'</div>';
  }
  return '<div class="mon-date-picker">'+head+options+'</div>';
}
function viewMonitoringArtist(artist){
  const avatar=monitoringMediaTag(artist.avatarRef,"mon-artist-avatar-img",artist.label),banner=monitoringMediaTag(artist.bannerRef,"mon-artist-banner","");
  const info=monitoringArtistRangeInfo(artist),posts=info.posts,cards=posts.length?'<div class="mon-artist-grid">'+posts.map(monitoringArtistPostCard).join('')+'</div>':emptyState("◎",info.valid?"No works match this date range.":"Choose a valid From and To date.");
  const range='<div class="mon-artist-range"><div class="mon-range-title"><b>Filter works by date</b><span>'+esc(posts.length)+' of '+esc(info.all.length)+' shown</span></div><div class="mon-range-fields"><button type="button" class="mon-range-date'+(monitoringDatePicker.side==='from'?' active':'')+'" data-action="monitoring-artist-date-open" data-side="from"><small>From</small><b>'+esc(monitoringRangeDateLabel(monitoringArtistRange.from))+'</b></button><span>→</span><button type="button" class="mon-range-date'+(monitoringDatePicker.side==='to'?' active':'')+'" data-action="monitoring-artist-date-open" data-side="to"><small>To</small><b>'+esc(monitoringRangeDateLabel(monitoringArtistRange.to))+'</b></button><button class="btn" data-action="monitoring-artist-range-reset">Show all</button><button class="btn primary" data-action="monitoring-artist-download-range"'+(!posts.length||!info.valid?' disabled':'')+'>Download shown ('+esc(posts.length)+')</button></div>'+monitoringArtistDatePicker(artist)+'</div>';
  return '<div class="mon-artist" data-ctx="monitor-artist" data-id="'+esc(artist.monitorId)+'"><button type="button" class="mode-back" data-action="monitoring-artist-back">← Back</button><section class="mon-artist-hero">'+(banner||'<div class="mon-watch-banner-fallback"></div>')+'<div class="mon-artist-shade"></div><span class="mon-artist-avatar"><i>'+esc((artist.label||'P').charAt(0))+'</i>'+avatar+'</span><div class="mon-artist-title"><span>'+esc(String(artist.service||'Pawchive').toUpperCase())+'</span><h1>'+esc(artist.label)+'</h1><p>'+esc(info.all.length)+' works · checked every '+esc(monitoringInterval(artist.intervalMinutes))+'</p></div></section>'+range+'<div class="mon-artist-note">Only the works inside the selected dates are shown below. Right-click this page for more options.</div>'+cards+'</div>';
}
function monitoringFilePreview(file){
  if(file.kind==='image')return '<div class="mon-media-frame image"><img class="mon-reader-media" src="'+esc(file.src)+'" alt="" loading="lazy"><span class="mon-media-state">Loading preview…</span></div>';
  if(file.kind==='video')return '<div class="mon-media-frame video"><video class="mon-reader-media" src="'+esc(file.src)+'" controls preload="auto" playsinline></video><span class="mon-media-state">Loading video…</span></div>';
  if(file.kind==='audio')return '<div class="mon-media-frame audio"><audio class="mon-reader-audio" src="'+esc(file.src)+'" controls preload="auto"></audio><span class="mon-media-state">Loading audio…</span></div>';
  return '<div class="mon-media-file">Right-click to download</div>';
}
function viewMonitoringDetail(detail){
  const files=(detail.files||[]),media=files.map(function(file,index){return '<figure class="mon-file" data-ctx="monitor-file" data-id="'+index+'" title="Right-click to download">'+monitoringFilePreview(file)+'<figcaption><b>'+esc(file.name)+'</b><small>'+esc(file.kind)+'</small></figcaption></figure>';}).join('');
  const creator=detail.monitorId?'<button type="button" class="mon-reader-creator" data-action="monitoring-post-artist-open" data-id="'+esc(detail.monitorId)+'" title="Open '+esc(detail.creator)+' artist page">'+esc(detail.creator)+'</button>':esc(detail.creator);
  return '<div class="mon-reader"><button type="button" class="mode-back" data-action="monitoring-post-back">← Back</button><article class="mon-reader-post" data-ctx="monitor-post" data-id="current"><div class="mon-reader-kicker">PAWCHIVE · '+creator+' · '+esc(monitoringDate(detail.date))+'</div><h1>'+esc(detail.title)+'</h1>'+(detail.author?'<div class="mon-reader-byline">'+esc(detail.author)+'</div>':'')+'<div class="mon-reader-body">'+esc(detail.content||'This post contains no additional text.')+'</div>'+(files.length?'<section class="mon-files"><h2>Files · '+files.length+'</h2><div class="mon-file-row" data-count="'+Math.min(files.length,3)+'">'+media+'</div></section>':'<p class="mon-no-files">No downloadable files were listed for this post.</p>')+'</article></div>';
}
function hydrateMonitoringDetailMedia(){
  document.querySelectorAll('.mon-media-frame').forEach(function(frame){
    const media=frame.querySelector('img,video,audio'),state=frame.querySelector('.mon-media-state');if(!media||!state)return;
    const ready=function(){frame.classList.add('ready');frame.classList.remove('failed');};
    const failed=function(){frame.classList.add('failed');state.textContent='Preview unavailable · right-click to download';};
    media.addEventListener(media.tagName==='IMG'?'load':'loadedmetadata',ready,{once:true});media.addEventListener('error',failed,{once:true});
    if(media.tagName==='IMG'&&media.complete)(media.naturalWidth?ready():failed());
  });
}
function renderMonitoringView(){
  const content=$("#content");if(!content)return;
  if(monitoringLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Loading Monitoring Mode…</b></div>';return;}
  if(monitoringDetailLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Opening Pawchive post…</b></div>';return;}
  if(monitoringDetail){content.innerHTML='<div class="monitoring-shell">'+viewMonitoringDetail(monitoringDetail)+'</div>';hydrateMonitoringDetailMedia();return;}
  if(monitoringArtistLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Loading all artist works…</b></div>';return;}
  if(monitoringArtist){content.innerHTML='<div class="monitoring-shell">'+viewMonitoringArtist(monitoringArtist)+'</div>';hydrateMonitoringMedia();return;}
  const unread=(monitoringData.events||[]).filter(function(item){return !item.read;}).length,events=monitoringFilteredEvents();
  const head='<header class="mon-head"><div class="mode-heading"><button type="button" class="mode-back" data-action="monitoring-exit">← Back</button><div><span class="mon-mode-mark"><i></i> MONITORING MODE</span><h1>Your watch desk</h1><p>Quiet checks for new creator posts and thread replies.</p></div></div><div class="mon-head-actions">'+pageCounterMarkup()+'<button class="btn ghost" data-action="monitoring-refresh"'+(monitoringSyncing?' disabled':'')+'>'+(monitoringSyncing?'Checking…':'↻ Check now')+'</button><button class="btn primary" data-action="monitoring-add">＋ Add watcher</button></div></header>';
  const tabs='<nav class="mon-tabs"><button class="'+(monitoringTab==='activity'?'active':'')+'" data-action="monitoring-tab" data-tab="activity">Activity <b>'+esc(monitoringData.events.length)+'</b></button><button class="'+(monitoringTab==='watchlist'?'active':'')+'" data-action="monitoring-tab" data-tab="watchlist">Watchlist <b>'+esc(monitoringData.monitors.length)+'</b></button><span></span><small>'+esc(unread)+' unread · updated '+esc(monitoringDate(monitoringData.updatedAt))+'</small></nav>';
  if(monitoringTab==='watchlist'){content.innerHTML='<div class="monitoring-shell">'+head+tabs+viewMonitoringWatchlist()+'</div>';hydrateMonitoringMedia();return;}
  const toolbar='<div class="mon-toolbar"><input id="monitoringSearch" value="'+esc(monitoringQuery)+'" placeholder="Search monitoring activity…"><div><button class="'+(monitoringFilter==='all'?'active':'')+'" data-action="monitoring-filter" data-filter="all">All</button><button class="'+(monitoringFilter==='unread'?'active':'')+'" data-action="monitoring-filter" data-filter="unread">Unread</button><button data-action="monitoring-mark-read"'+(unread?'':' disabled')+'>Mark all read</button></div></div>';
  const body=events.length?'<div class="mon-events">'+events.map(monitoringEventCard).join('')+'</div>':emptyState("◎",monitoringData.events.length?'Nothing matches this filter.':'No new updates yet. Add a watcher; its first check quietly records the current latest entry.');
  content.innerHTML='<div class="monitoring-shell">'+head+tabs+toolbar+body+'</div>';
  hydrateMonitoringMedia();
  if(monitoringFocusId)setTimeout(function(){const row=document.querySelector('.mon-event.focused');if(row)row.scrollIntoView({block:'center'});},30);
}
function monitoringAddModal(){
  const interval=Number(monitoringData.settings&&monitoringData.settings.defaultIntervalMinutes)||1440;
  const body='<p class="mon-modal-note">Paste a Pawchive/Bakemono creator page or an F95zone thread. SINRAD detects the source automatically.</p><div class="field"><label>Page URL</label><input id="mon_url" placeholder="https://pawchive.pw/... or https://f95zone.to/threads/..."></div><div class="field"><label>Name <span style="color:var(--dim)">(optional)</span></label><input id="mon_label" placeholder="Artist or thread name"></div><div class="field"><label>Check every</label><select id="mon_interval">'+monitoringIntervalOptions(interval)+'</select></div>';
  openModal("Add watcher",body,"Start watching",async function(){const button=$("#modal-confirm");if(button){button.disabled=true;button.textContent="Adding…";}const result=await E.monitoringAdd({url:val("mon_url"),label:val("mon_label"),intervalMinutes:Number(val("mon_interval"))});if(!result||!result.ok){if(button){button.disabled=false;button.textContent="Start watching";}toast(result&&result.error||"Could not add watcher","err");return;}closeModal();monitoringTab="watchlist";await loadMonitoringData();toast("Watcher added · first check is a quiet baseline","ok");});
}
function monitoringIntervalOptions(selected){
  return [[15,'15 minutes'],[30,'30 minutes'],[60,'1 hour'],[180,'3 hours'],[360,'6 hours'],[720,'12 hours'],[1440,'Daily'],[4320,'Every 3 days'],[10080,'Weekly']].map(function(item){return '<option value="'+item[0]+'"'+(Number(selected)===item[0]?' selected':'')+'>'+item[1]+'</option>';}).join('');
}
function monitoringIntervalModal(id){
  const monitor=monitoringMonitor(id);if(!monitor)return;
  openModal("Edit check time",'<div class="field"><label>Check '+esc(monitor.label)+' every</label><select id="mon_edit_interval">'+monitoringIntervalOptions(monitor.intervalMinutes)+'</select></div>',"Save",async function(){const updated=await E.monitoringMonitorUpdate(id,{intervalMinutes:Number(val("mon_edit_interval"))});if(!updated){toast("Could not update check time","err");return;}closeModal();await loadMonitoringData();if(monitoringArtist&&monitoringArtist.monitorId===id)monitoringArtist.intervalMinutes=updated.intervalMinutes;renderView();toast("Check time updated","ok");});
}
if(E&&E.onMonitoringChanged)E.onMonitoringChanged(function(data){if(data)monitoringData=data;monitoringLoading=false;monitoringSyncing=false;if(monitoringMode)renderView();});
if(E&&E.onMonitoringOpenEvent)E.onMonitoringOpenEvent(function(id){monitoringFocusId=String(id||"");monitoringTab="activity";monitoringFilter="all";setMonitoringMode(true);});
if(E&&E.onMonitoringDownloadProgress)E.onMonitoringDownloadProgress(function(progress){if(!monitoringArtist||!progress||progress.monitorId!==monitoringArtist.monitorId)return;const note=document.querySelector('.mon-artist-note');if(note)note.textContent='Downloading '+progress.done+' / '+progress.total+' works · '+progress.files+' files saved'+(progress.failed?' · '+progress.failed+' skipped':'');});

function fmtDate(ts){ if(!ts) return ''; var d=new Date(ts); var t=d.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit'}); var now=new Date(); var sameDay=d.toDateString()===now.toDateString(); if(sameDay) return '['+t+'] Today'; var yesterday=new Date(now); yesterday.setDate(now.getDate()-1); if(d.toDateString()===yesterday.toDateString()) return '['+t+'] Yesterday'; return '['+t+'] '+d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
const _modulePreviewCache=new Map(),_modulePreviewPending=new Map();
let _modulePreviewObserver=null;
function _previewKey(kind,value,mode){
  value=String(value||"");mode=mode==="icon"?"icon":"rich";
  if(kind==="site"&&mode==="icon"){try{value=new URL(value).origin;}catch(_){}}
  return kind+"\u0000"+mode+"\u0000"+value;
}
function _previewRemember(key,result){
  if(_modulePreviewCache.has(key))_modulePreviewCache.delete(key);
  _modulePreviewCache.set(key,result||{data:"",kind:"missing"});
  while(_modulePreviewCache.size>180)_modulePreviewCache.delete(_modulePreviewCache.keys().next().value);
}
function _previewPaint(img,result){
  if(!img||!img.isConnected)return;
  const shell=img.closest(".module-preview");
  if(!result||!result.data){if(shell)shell.classList.add("missing");return;}
  img.onload=function(){if(shell){shell.classList.add("ready");shell.classList.toggle("icon-only",result.kind==="icon");}};
  img.onerror=function(){if(shell)shell.classList.add("missing");};
  img.src=result.data;
}
function _previewLoad(img){
  const folder=img.getAttribute("data-preview-folder"),url=img.getAttribute("data-preview-url"),mode=img.getAttribute("data-preview-mode")||"rich",kind=folder?"folder":"site",value=folder||url||"";
  if(!value||!E)return;
  const key=_previewKey(kind,value,mode),cached=_modulePreviewCache.get(key);if(cached){_previewPaint(img,cached);return;}
  let task=_modulePreviewPending.get(key);
  if(!task){task=Promise.resolve(kind==="folder"&&E.folderPreview?E.folderPreview(value):(E.sitePreview?E.sitePreview(value,mode):null)).then(function(result){if(typeof result==="string")result={data:result,kind:kind};result=result||{data:"",kind:"missing"};_previewRemember(key,result);return result;},function(){const miss={data:"",kind:"missing"};_previewRemember(key,miss);return miss;}).finally(function(){_modulePreviewPending.delete(key);});_modulePreviewPending.set(key,task);}
  task.then(function(result){_previewPaint(img,result);});
}
function hydrateModulePreviews(){
  if(_modulePreviewObserver){try{_modulePreviewObserver.disconnect();}catch(_){}_modulePreviewObserver=null;}
  const imgs=document.querySelectorAll("img.module-preview-img[data-preview-url],img.module-preview-img[data-preview-folder]");if(!imgs.length)return;
  if(typeof IntersectionObserver==="undefined"){imgs.forEach(_previewLoad);return;}
  _modulePreviewObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;_modulePreviewObserver.unobserve(entry.target);_previewLoad(entry.target);});},{root:$("#content")||null,rootMargin:"280px",threshold:.01});
  imgs.forEach(function(img){const folder=img.getAttribute("data-preview-folder"),url=img.getAttribute("data-preview-url"),mode=img.getAttribute("data-preview-mode")||"rich",cached=_modulePreviewCache.get(_previewKey(folder?"folder":"site",folder||url,mode));if(cached)_previewPaint(img,cached);else _modulePreviewObserver.observe(img);});
}
function sitePreviewMarkup(url,mode,classes){
  const host=hostOf(url),letter=(host||"web").replace(/^www\./,"").charAt(0).toUpperCase()||"W";
  const fallback=mode==="icon"?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.7 2.5 4 5.5 4 9s-1.3 6.5-4 9c-2.7-2.5-4-5.5-4-9s1.3-6.5 4-9z"/></svg>':esc(letter);
  return `<span class="module-preview ${classes||""}"><img class="module-preview-img" data-preview-url="${esc(url||"")}" data-preview-mode="${mode==="icon"?"icon":"rich"}" alt=""><span class="module-preview-fallback">${fallback}</span></span>`;
}
function folderPreviewMarkup(folder){return `<span class="module-preview folder-preview"><img class="module-preview-img" data-preview-folder="${esc(folder||"")}" alt=""><span class="module-preview-fallback">${ICO_FOLDER}</span></span>`;}
function viewVault(){
  const term=searchTerms.vault||"";
  let items=state.vault.filter(v=>{ const passF=vaultFilter==="all"?true:vaultFilter==="fav"?!!v.favorite:!!v.priority; return passF&&match(term,v.name,v.url,v.username); });
  const pills=`<div class="toolbar vaultfilter"><div class="lf-left">${pill("All",vaultFilter==="all",ALL_COLOR,'data-action="vault-filter" data-filter="all"')}${pill(ICO_STAR+" Favorites",vaultFilter==="fav",FAV_COLOR,'data-action="vault-filter" data-filter="fav"')}${pill(ICO_WARN+" Priority",vaultFilter==="pri",PRI_COLOR,'data-action="vault-filter" data-filter="pri"')}</div></div>`;
  let body;
  if(!state.vault.length) body=emptyState(ICO_LOCK,"No entries yet. Add your first password above.");
  else if(!items.length) body=emptyState(ICO_SEARCH,"Nothing matches your search or filter.");
  else body=`<div class="grid vault-grid">`+items.map(v=>{ const show=revealed.has(v.id); const pw=show?esc(v.password):"•".repeat(Math.min(14,Math.max(6,(v.password||"").length))); return `<div class="card vault-card" style="${edgeShadow(v)}" data-ctx="vault" data-id="${v.id}" data-action="vault-open">${v.url?sitePreviewMarkup(v.url,"rich","vault-preview"):""}<div class="row"><div style="flex:1;min-width:0"><h3>${esc(v.name)}</h3><div class="sub">${esc(v.url||"—")}</div></div></div><div class="meta">User: <span class="mono">${esc(v.username||"—")}</span></div><div class="meta" style="opacity:.6">${fmtDate(v.created)}</div><div class="meta">Pass: <span class="mono">${pw}</span></div></div>`; }).join("")+`</div>`;
  const addbar=`<div class="toolbar linkbar"><div class="lin-input" style="cursor:default;color:var(--muted);opacity:.85;display:flex;align-items:center;gap:8px">${ICO_LOCK}Entries are saved locally on this device</div><button type="button" class="btn primary" data-action="vault-new">＋ Add entry</button></div>`;
  return head("Secure Vault",""+openVerb()+" · right-click for more · Ctrl+F to search")+addbar+searchRow("vault","Search vault...")+pills+body;
}

function collColor(name){ var h=0; name=String(name||''); for(var i=0;i<name.length;i++){ h=(h*31+name.charCodeAt(i))%360; } return 'hsl('+h+',55%,55%)'; }
function isTagPage(u){ var s=String(u||''); return s.indexOf('/tags/')>=0 || s.indexOf('/tag/')>=0; }
function linkDisplayPath(u){ try{ const x=new URL(u); const p=(x.pathname==="/"?"":x.pathname)+(x.search||""); return p||x.hostname; }catch(_){ return String(u||""); } }
function _linkSelCount(){ return Object.keys(linkSelLinks).length; }
function _linkDeleteSel(){ var ids=Object.keys(linkSelLinks); var n=ids.length; if(!n) return; function go(){ rememberUndo("Deleted "+n+" links"); var kill={}; ids.forEach(function(x){kill[x]=1;}); state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); linkSelLinks={}; renderView(); log("warn","deleted "+n+" link(s)"); } if(n>4){ confirmModal("Delete "+n+" link(s)?").then(function(y){ if(y) go(); }); } else { go(); } }
function _linkClearSel(){ linkSelLinks={}; renderView(); }
function duplicateReviewModal(){
  const groups=SinradShared.exactDuplicateGroups(state.links||[]);
  if(!groups.length){openModal("Duplicate review",'<p style="margin:0;color:var(--muted)">No exact duplicate URLs found. Different pages from the same site are kept separate.</p>',"Close",closeModal);const cancel=$("#modalCancelBtn");if(cancel)cancel.classList.add("hidden");return;}
  const body='<p style="margin-top:0;color:var(--muted)">Only identical full URLs will merge. Categories, favorites, notes, and open counts are preserved.</p><div class="dup-list">'+groups.map(function(group){return '<div class="dup-row"><b>'+esc(group[0].title||group[0].url)+'</b><small>'+group.length+' copies</small></div>';}).join("")+'</div>';
  openModal("Duplicate review",body,"Merge "+groups.reduce(function(total,group){return total+group.length-1;},0)+" duplicate(s)",function(){rememberUndo("Merged exact duplicates");const result=SinradShared.mergeExactDuplicates(state.links);state.links=result.links;saveState();closeModal();renderView();toast("Merged "+result.removed+" exact duplicate"+(result.removed===1?"":"s"),"ok");log("ok","duplicate review merged "+result.removed+" exact duplicate(s)");});
}
function smartRulesModal(){
  const rules=currentLinkRules(),categories=Object.keys(CAT_COLORS);
  const rows=rules.length?'<div class="rule-list">'+rules.map(function(rule,index){return '<div class="rule-row"><b>'+esc(rule.pattern)+'</b><small>→ '+esc(rule.category)+'</small><button type="button" class="rule-remove" data-action="rule-del" data-index="'+index+'" title="Remove rule">×</button></div>';}).join("")+'</div>':'<p style="color:var(--dim);margin-top:0">No rules yet.</p>';
  const form='<div class="field"><label>Website or URL text</label><input id="rule_pattern" placeholder="e.g. github.com or /tutorial/"></div><div class="field"><label>Category</label><select id="rule_category">'+categories.map(function(category){return '<option value="'+esc(category)+'">'+esc(category)+'</option>';}).join("")+'</select><div class="hint">First matching rule wins. YouTube always remains the main category.</div></div>';
  openModal("Smart category rules",rows+form,"Add rule",function(){const pattern=val("rule_pattern").toLowerCase(),category=val("rule_category");if(!pattern||!category){toast("Enter a website or URL text","warn");return;}rememberUndo("Added smart category rule");if(!state.settings)state.settings={};state.settings.linkRules=currentLinkRules().concat({pattern:pattern,category:category});(state.links||[]).forEach(function(link){if(!_inLot(link))applySmartToLink(link);});saveState();closeModal();renderView();toast("Rule added and applied","ok");});
}
let _linkCheckRunning=false,_linkCheckDone=0,_linkCheckTotal=0;
function paintLinkCheckProgress(){const button=$("#linkCheckBtn");if(button)button.textContent=_linkCheckRunning?("Checking "+_linkCheckDone+"/"+_linkCheckTotal):"Check now";}
async function checkSavedLinks(){
  if(_linkCheckRunning){toast("Link check is already running","warn");return;}
  if(!E||!E.linkCheck){toast("Link checking needs the desktop app","warn");return;}
  const groups=new Map();(state.links||[]).forEach(function(link){const key=normUrl(link.url);if(key){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(link);}});
  const jobs=Array.from(groups.entries());if(!jobs.length){toast("No links to check","warn");return;}
  _linkCheckRunning=true;_linkCheckDone=0;_linkCheckTotal=jobs.length;paintLinkCheckProgress();let cursor=0;
  async function worker(){while(cursor<jobs.length){const job=jobs[cursor++];let result;try{result=await E.linkCheck(job[0]);}catch(error){result={status:"broken",code:0,error:String(error&&error.message||error)};}job[1].forEach(function(link){link.health={status:result.status||"broken",code:Number(result.code)||0,error:String(result.error||""),checkedAt:Date.now()};});_linkCheckDone++;paintLinkCheckProgress();}}
  try{await Promise.all(Array.from({length:Math.min(6,jobs.length)},worker));await flushSave();renderView();const broken=(state.links||[]).filter(function(link){return link.health&&link.health.status==="broken";}).length;toast(broken?(broken+" broken link"+(broken===1?"":"s")+" found"):"Link check complete — no broken links","ok");log("info","link check completed: "+broken+" broken");}finally{_linkCheckRunning=false;paintLinkCheckProgress();}
}
function viewLinks(){
  if(currentView!=="links"){ linkSelLinks={}; }
  const term=searchTerms.links||"";
  const selN=_linkSelCount();
  const selBar=selN?`<div class="lot-bar" style="border-color:rgba(39,180,255,.55);background:#0e1420"><span class="lb-n" style="color:var(--cyan)">${selN} selected</span><button type="button" class="lb-del" data-action="link-sel-del">Delete</button><button type="button" class="lb-clear" data-action="link-sel-clear"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Clear</button></div>`:"";
  const card=(l)=>{const host=hostOf(l.url),cat=normCat(l),cats=linkCategoryList(l),color=cat?(CAT_COLORS[cat]||"#cfd3dc"):"#cfd3dc",recent=Number(l.lastOpened||0)>0&&(Date.now()-Number(l.lastOpened)<30*24*60*60*1000),multi=cats.length>1?`<span class="lc-multicats" title="${esc(cats.join(" + "))}">${cats.map(function(c){return `<i style="background:${CAT_COLORS[c]||"#cfd3dc"}"></i>`;}).join("")}<b>${cats.length}</b></span>`:"",health=l.health&&l.health.status?`<span class="health-badge ${esc(l.health.status)}" title="Checked ${esc(fmtDate(l.health.checkedAt))}${l.health.code?' · HTTP '+esc(l.health.code):''}">${esc(l.health.status)}</span>`:"";return `<div class="link-card${linkSelLinks[l.id]?" sel":""}${recent?" recently-visited":""}" style="--link-accent:${color};${edgeShadow(l)}" data-ctx="link" data-id="${l.id}" data-action="link-open">${recent?'<span class="lc-recent">Recently visited</span>':''}${sitePreviewMarkup(l.url,"rich","link-preview")}<div class="lc-info"><div class="lc-top"><div class="lc-heading"><h3 class="lc-title">${esc(l.title)}</h3><span class="lc-host">${esc(host)}</span></div>${multi}${l.favorite?`<span class="lc-star" title="Favorite">★</span>`:""}</div><div class="lc-path" title="${esc(l.url)}">${esc(linkDisplayPath(l.url))}</div>${l.note?`<div class="lc-note">${esc(l.note)}</div>`:""}<div class="lc-foot"><span>${recent?"Visited "+fmtDate(l.lastOpened):fmtDate(l.created)}</span>${health}</div></div></div>`;};
  const addbar=`<div class="toolbar linkbar"><input class="lin-input" id="lk_title" placeholder="Title (optional)"><input class="lin-input lk-url" id="lk_url" placeholder="https://..."><button type="button" class="btn primary" data-action="link-add">＋ Add</button></div>`;
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${Object.keys(CAT_COLORS).map(c=>{ var lab=esc(c); if(state.categories&&state.categories[c]){ lab+='<span class="cat-del" data-action="cat-del-pill" data-cat="'+esc(c)+'" title="Delete category">×</span>'; } return pill(lab,linkCats.indexOf(c)>=0,CAT_COLORS[c],'data-action="link-cat" data-cat="'+esc(c)+'"'); }).join("")}</div><div class="lf-right">${pill(ICO_STAR+" Favorites",linkFav,FAV_COLOR,'data-action="link-fav"')}<button class="cat-add-btn" data-action="cat-add" title="Add category">+</button></div></div>`;
  const items=state.links.filter(l=>{ if(_inLot(l)) return false; const cats=linkCategoryList(l); const catOk=!linkCats.length||linkCats.every(function(c){return c?cats.indexOf(c)>=0:cats.length===0;}); const favOk=!linkFav||!!l.favorite; return catOk&&favOk&&match(term,l.title,l.url,l.note||""); }).slice().sort(function(a,b){return Number(b.lastOpened||0)-Number(a.lastOpened||0)||Number(b.created||0)-Number(a.created||0);});
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
  const itemRow=(l,col)=>`<div class="lot-item${lotSelLinks[l.id]?" sel":""}" data-ctx="link" data-id="${l.id}" data-action="link-open">${sitePreviewMarkup(l.url,"icon","lot-site-preview")}<span class="li-main"><span class="li-title">${esc(l.title)}</span><span class="li-url">${esc(l.url)}</span></span>${l.note?`<span class="li-note">${esc(l.note)}</span>`:""}${isTagPage(l.url)?`<span class="li-tag">tag</span>`:""}<span class="li-date" title="${esc(fmtDate(l.created))}">${esc(fmtDate(l.created))}</span></div>`;
  if(linkDrill){
    let items=parked0().filter(l=>(l.coll||"")===linkDrill);
    items=items.slice().sort((a,b)=>(isTagPage(b.url)?1:0)-(isTagPage(a.url)?1:0));
    const col=collColor(linkDrill);
    const dhead=`<div class="drill-head"><button class="dh-back" data-action="link-drill-back">‹ back</button><span class="dh-title">${esc(linkDrill)}</span><span class="cc-count" style="margin-left:8px">${items.length}</span><button class="dh-open" data-action="link-openall" data-coll="${esc(linkDrill)}">open all (${items.length})</button></div>`;
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
function _inLot(l){ return SinradShared.isParkedLink(l); }
function parked0(){ const term=searchTerms.lot||""; return state.links.filter(l=> _inLot(l) && match(term,l.title,l.url,l.note||"")); }




async function doLinkAdd(){
  const t=$("#lk_title"),u=$("#lk_url"),url=safeWebUrl(u?u.value:"");
  if(!url){ toast("Paste a valid http(s) link","warn"); if(u)u.focus(); return; }
  const title=(t&&t.value.trim())||hostOf(url)||"Saved link";
  const selected=(linkCats||[]).filter(function(c){ return c && c!=="all"; });
  const chosen=selected.length===1?selected[0]:"",auto=smartCategories(url,chosen),category=auto.main;
  const entry={id:uid(),title,url,category,categories:auto.all,favorite:false,created:nowMs()};
  rememberUndo("Added link "+title);
  state.links.unshift(entry);
  const saved=await flushSave();
  if(!saved){ state.links=state.links.filter(function(item){return item.id!==entry.id;}); toast("Link could not be saved — your existing data was left unchanged","err"); return; }
  log("ok","Saved link: "+title+(category?" ["+category+"]":"")); celebrate(); renderView(); toast(category==="YouTube"?"Saved to YouTube":"Link saved","ok");
}

function viewFolders(){
  const term=searchTerms.folders||"";
  let items=state.folders.filter(f=>{ const catOk=!folderCats.length||folderCats.indexOf(normCat(f))>=0; const passF=folderFilter==="all"?true:!!f.favorite; return catOk&&passF&&match(term,f.name,f.path); });
  const addbar=`<div class="toolbar linkbar"><input class="lin-input" id="fd_name" placeholder="Name (optional)"><input class="lin-input lk-url" id="fd_path" placeholder="Folder path  e.g. C:\\Users\\you\\Documents"><button type="button" class="btn primary" data-action="folder-add">＋ Add</button></div>`;
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${Object.keys(FOLDER_CATS).map(c=>pill(c,folderCats.indexOf(c)>=0,FOLDER_CATS[c],'data-action="folder-cat" data-cat="'+esc(c)+'"')).join("")+'<button class="cat-add-btn" data-action="cat-add" data-type="folder" title="Add category">+</button>'}</div><div class="lf-right">${pill(ICO_STAR+" Favorites",folderFilter==="fav",FAV_COLOR,'data-action="folder-filter" data-filter="'+(folderFilter==="fav"?"all":"fav")+'"')}</div></div>`;
  let body;
  if(!state.folders.length) body=emptyState(ICO_FOLDER,"No quick folders yet — paste a path above. "+openVerb()+" · right-click for more.");
  else if(!items.length) body=emptyState(ICO_SEARCH,"Nothing matches. Try a different tab or Ctrl+F.");
  else body=`<div class="folder-list">`+items.map(f=>{ const p=f.path||f.name||""; const label=(f.name&&f.path)?f.name:baseName(p); const pinned=isPetPinned(p); return `<div class="folder-row" style="${edgeShadow(f)}" data-ctx="folder" data-id="${f.id}" data-action="folder-open">${folderPreviewMarkup(p)}<div class="fr-main"><div class="fr-name">${esc(label||"Untitled")}</div><div class="fr-path" title="${esc(p)}">${esc(p)}</div></div><div class="fr-meta">${pinned?`<span class="fr-pin" title="Pinned to Pet Recents">${ICO_PIN_DIAG}</span>`:""}<span class="fr-date">${esc(fmtDate(f.created))}</span></div></div>`; }).join("")+`</div>`;
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
const _thumbPending={};
function shotThumbKey(p,mtime){ return String(p||"")+"\u0000"+String(Math.trunc(Number(mtime)||0)); }
function shotCacheSet(key,url){
  _shotThumbs[key]=url;
  const i=_shotThumbOrder.indexOf(key); if(i>=0) _shotThumbOrder.splice(i,1);
  _shotThumbOrder.push(key);
  while(_shotThumbOrder.length>200){ const old=_shotThumbOrder.shift(); delete _shotThumbs[old]; }
}
function shotThumbRequest(path,key){
  if(_thumbPending[key]) return _thumbPending[key];
  _thumbPending[key]=Promise.resolve(E.shotsThumb(path)).then(function(url){ if(url)shotCacheSet(key,url); return url||""; },function(){return "";}).finally(function(){ delete _thumbPending[key]; });
  return _thumbPending[key];
}
function shotLoadThumb(img){
  const p=img.getAttribute("data-spath"); if(!p) return;
  const key=shotThumbKey(p,img.getAttribute("data-smtime"));
  if(_shotThumbs[key]){ img.src=_shotThumbs[key]; img.classList.remove("loading"); return; }
  if(!E||!E.shotsThumb) return;
  img.classList.add("loading");
  shotThumbRequest(p,key).then(function(url){ if(!img.isConnected||shotThumbKey(img.getAttribute("data-spath"),img.getAttribute("data-smtime"))!==key)return; if(url){ img.onerror=function(){ img.onerror=null; img.removeAttribute("src"); img.classList.add("loading"); }; img.src=url; img.classList.remove("loading"); } });
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
    if(p&&_shotThumbs[key]){ img.src=_shotThumbs[key]; img.classList.remove("loading"); return; }
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
  const pager=pages>1?`<div class="shot-pager"><button type="button" data-action="shot-page" data-dir="-1" aria-label="Previous Screenies page"${shotPage<=0?" disabled":""}>‹ Prev</button><button type="button" data-action="shot-page" data-dir="1" aria-label="Next Screenies page"${shotPage>=pages-1?" disabled":""}>Next ›</button></div>`:"";
  const pills=`<div class="toolbar linkfilter"><div class="lf-left">${
    Object.keys(cols).map(c=>pill(c,shotFilter===c,cols[c],'data-action="shot-filter" data-filter="'+esc(c)+'"')).join("")
  }<button class="cat-add-btn" data-action="cat-add" data-type="shot" title="Add category">+</button></div><div class="lf-right"><span class="shot-summary">${all.length} · ${shotPage+1}/${pages}</span>${pager}<div class="shot-sizes"><button type="button" class="${shotSize==="s"?"on":""}" data-action="shot-size" data-size="s" title="Small">Small</button><button type="button" class="${shotSize==="l"?"on":""}" data-action="shot-size" data-size="l" title="Wide">Wide</button></div></div></div>`;
  let body;
  if(!_shotIndex.length) body=emptyState(ICO_FOLDER,"No screenshots found — drop PNGs in your Screenshots folder, or add another folder.");
  else if(!all.length) body=emptyState(ICO_SEARCH,"Nothing in this tray yet.");
  else body=`<div class="shot-grid size-${shotSize}">`+slice.map(function(s){
    const src=_shotThumbs[shotThumbKey(s.path,s.mtime)]||"";
    return `<div class="shot-card" data-ctx="shot" data-id="${esc(s.id)}" data-action="shot-open"><img class="shot-thumb${src?"":" loading"}" data-spath="${esc(s.path)}" data-smtime="${esc(s.mtime||0)}"${src?' src="'+src+'"':""} alt=""><div class="shot-cap"><b>${esc(s.name)}</b><span>${esc(fmtDate(s.mtime))}</span></div></div>`;
  }).join("")+`</div>`;
  return head("Screenies", (shotFilter==="inbox"?"Inbox — unfiled captures":"Tray: "+shotFilter)+" · click to open · right-click to file / copy / look up")+pills+searchRow("shots","Search screenies...")+body;
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
    if(e.target.closest("button,input,.shotbox,.shotshow,#overlay,#ctxmenu")) return;
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

async function doFolderAdd(){
  const n=$("#fd_name"),p=$("#fd_path"),name=n?n.value.trim():"",path=p?p.value.trim():"";
  if(!path){ toast("Paste a folder path","warn"); if(p)p.focus(); return; }
  const category=SinradShared.primarySelection(folderCats);
  const entry={id:uid(),name,path,category:category,favorite:false,created:nowMs()};
  rememberUndo("Added folder "+(name||baseName(path)));
  state.folders.unshift(entry);
  const saved=await flushSave();
  if(!saved){ state.folders=state.folders.filter(function(item){return item.id!==entry.id;}); toast("Folder could not be saved — your existing data was left unchanged","err"); return; }
  log("ok","Added quick folder: "+(name||baseName(path))+(category?" ["+category+"]":"")); celebrate(); renderView(); toast("Folder saved","ok");
}
function folderEditModal(id){ const f=find(state.folders,id); if(!f)return; const p=f.path||f.name||""; openModal("Edit Quick Folder",`<div class="field"><label>Name (optional)</label><input id="fe_name" value="${esc(f.name||"")}"></div><div class="field"><label>Folder path</label><input id="fe_path" value="${esc(p)}"></div>`,"Save",async()=>{ const nextPath=$("#fe_path").value.trim(); if(!nextPath){ toast("Path required","warn"); return; } const before={name:f.name,path:f.path};rememberUndo("Edited folder "+(f.name||baseName(p))); f.name=$("#fe_name").value.trim(); f.path=nextPath; const saved=await flushSave();if(!saved){f.name=before.name;f.path=before.path;toast("Folder update could not be saved","err");return;}log("info","Updated quick folder: "+(f.name||baseName(nextPath))); closeModal(); renderView(); toast("Folder updated","ok"); }); }

function viewConsole(){
  const term=searchTerms.console||"";
  const items=state.console.filter(c=>match(term,c.message,c.level)).slice().reverse();
  const toolbar=`<div class="toolbar"><button class="btn sm danger" data-action="console-clear">🗑 Clear log</button></div>`;
  const lines=items.length?items.map(c=>{ const ts=new Date(c.ts).toLocaleTimeString([],{hour12:false}); const addBtn=(c.meta&&c.meta.url)?`<button class="term-add" data-action="console-add-link" data-id="${c.id}" title="Save this site to Links">＋</button>`:""; return `<div class="term-line"><span class="tt">[${ts}]</span>&nbsp;<span class="lv ${c.level}">${esc(c.level.toUpperCase())}</span>&nbsp;<span class="ms">${linkify(c.message)}</span>${addBtn}</div>`; }).join(""):`<div class="term-empty">// no activity yet — type a command below (try: ${esc(state.radCmd)} "Anime")</div>`;
  const termHtml=`<div class="term"><div class="term-bar"><span class="d r"></span><span class="d y"></span><span class="d g"></span><span class="t">activity.log · Ctrl+F to grep · ＋ saves a VISIT to Links</span></div><div class="term-body">${lines}</div></div>`;
  return head("Console","Live log + commands · Ctrl+F to grep")+searchRow("console","Grep the log...")+toolbar+termHtml;
}

function openModal(t,b,l,onC,onX,danger){ $("#modal-title").innerHTML=t; $("#modal-body").innerHTML=b; const mc=$("#modal-confirm"); if(mc){ mc.disabled=false; mc.textContent=l||"Save"; mc.classList.remove("hidden"); mc.classList.toggle("kill-go",!!danger); if(danger) mc.classList.remove("primary"); else mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb){ xb.classList.remove("hidden"); xb.textContent="Cancel"; } const md=document.querySelector("#overlay .modal"); if(md) md.classList.toggle("danger",!!danger); modalOnConfirm=onC||null; modalOnCancel=onX||null; $("#overlay").classList.add("show"); const f=$("#modal-body input, #modal-body textarea, #modal-body select"); if(f)setTimeout(()=>f.focus(),30); }
function closeModal(){ $("#overlay").classList.remove("show"); modalOnConfirm=null; modalOnCancel=null; const md=document.querySelector("#overlay .modal"); if(md) md.classList.remove("danger"); const mc=$("#modal-confirm"); if(mc){ mc.disabled=false; mc.classList.remove("kill-go"); mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb) xb.textContent="Cancel"; }
function cancelModal(){ const c=modalOnCancel; closeModal(); if(typeof c==="function")c(); }
const modalConfirmButton=$("#modal-confirm");
function reportActionError(label,error){const message=String(error&&error.message||error||"Unknown error");try{console.error("[sinrad] "+label.toLowerCase()+" failed:",error);}catch(_){}toast(label+" failed: "+message,"err");}
function confirmActiveModal(){if(typeof modalOnConfirm!=="function")return;try{const result=modalOnConfirm();if(result&&typeof result.catch==="function")result.catch(function(error){const button=$("#modal-confirm");if(button){button.disabled=false;button.textContent="Save";}reportActionError("Save",error);});}catch(error){reportActionError("Save",error);}}
if(modalConfirmButton)modalConfirmButton.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();confirmActiveModal();});
const modalCancelButton=$("#modalCancelBtn");
if(modalCancelButton)modalCancelButton.addEventListener("click",function(event){event.stopPropagation();cancelModal();});
function confirmModal(m,danger,spec){ return new Promise(res=>{ spec=spec||{}; const ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>'; const title=spec.title||(danger?ico+" Arm kill switch":"⚠️ Confirm"); const go=spec.go||(danger?"Arm it":"Yes, do it"); openModal(title,`<p style="margin:0;color:var(--muted)">${esc(m)}</p>`,go,()=>{closeModal();res(true);},()=>res(false),!!danger); const xb=$("#modalCancelBtn"); if(xb&&spec.cancel) xb.textContent=spec.cancel; setTimeout(()=>{const b=$("#modal-confirm");if(b)b.focus();},30); }); }
function val(id){ const e=$("#"+id); return e?e.value.trim():""; }
function backupExportModal(){
  if(!E||!E.backupExport){toast("Encrypted backups need the desktop app","warn");return;}
  openModal("Encrypted backup",'<p style="margin-top:0;color:var(--muted)">Choose a password you can remember. It cannot be recovered.</p><div class="field"><label>Password (8+ characters)</label><input id="backup_pass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirm password</label><input id="backup_pass2" type="password" autocomplete="new-password"></div>',"Save backup",async function(){
    const pass=$("#backup_pass").value,again=$("#backup_pass2").value;
    if(pass.length<8){toast("Use at least 8 characters","warn");return;}
    if(pass!==again){toast("Passwords do not match","warn");return;}
    const result=await E.backupExport(state,pass);
    if(result&&result.ok){closeModal();toast("Encrypted backup saved","ok");log("ok","Encrypted backup created");}
    else if(!(result&&result.canceled))toast((result&&result.error)||"Backup failed","err");
  });
}
function backupImportModal(){
  if(!E||!E.backupImport){toast("Encrypted backups need the desktop app","warn");return;}
  openModal("Restore encrypted backup",'<p style="margin-top:0;color:var(--muted)">Select your .sirbackup file after entering its password.</p><div class="field"><label>Backup password</label><input id="backup_pass" type="password" autocomplete="current-password"></div>',"Choose backup",async function(){
    const pass=$("#backup_pass").value;if(!pass){toast("Enter the backup password","warn");return;}
    const result=await E.backupImport(pass);if(!result||!result.ok){if(!(result&&result.canceled))toast((result&&result.error)||"Restore failed","err");return;}
    closeModal();
    if(!(await confirmModal("Replace the current S.I.R data with this backup?")))return;
    const previousState=state;
    state=Object.assign(defaultState(),result.data);const saved=await flushSave();
    if(!saved){state=previousState;toast("Could not save restored data — your current data was left unchanged","err");return;}
    refreshCatColors();refreshFolderCats();renderNav();renderView();renderTermBody();toast("Backup restored","ok");log("ok","Encrypted backup restored");
  });
}
function vaultModal(e){ e=e||{}; openModal(`${e.id?"Edit":"New"} Vault Entry`,`<div class="field"><label>Site / service name <span style="color:var(--dim)">(optional)</span></label><input id="v_name" value="${esc(e.name||"")}" placeholder="e.g. Gmail"></div><div class="field"><label>Website URL</label><input id="v_url" value="${esc(e.url||"")}" placeholder="https://..."></div><div class="field"><label>Username / email</label><input id="v_user" value="${esc(e.username||"")}" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="v_pass" type="password" value="${esc(e.password||"")}" placeholder="••••••••"></div><div class="checkrow" style="gap:18px"><label class="checkrow"><input type="checkbox" id="v_fav" ${e.favorite?"checked":""}> Favorite</label><label class="checkrow"><input type="checkbox" id="v_pri" ${e.priority?"checked":""}> Priority</label></div><div class="form-error" id="v_error"></div>`,"Save",async()=>{
  const result=SinradShared.normalizeVaultDraft({name:val("v_name"),url:val("v_url"),username:val("v_user"),password:$("#v_pass").value,favorite:$("#v_fav").checked,priority:$("#v_pri").checked});
  if(!result.ok){const error=$("#v_error");if(error)error.textContent=result.error;toast(result.error,"warn");return;}
  const btn=$("#modal-confirm");if(btn&&btn.disabled)return;if(btn){btn.disabled=true;btn.textContent="Saving…";}
  const existing=e.id?find(state.vault,e.id):null,previous=existing?Object.assign({},existing):null;
  rememberUndo((existing?"Edited":"Added")+" vault entry "+result.value.name);
  const entry=existing?Object.assign(existing,result.value):Object.assign({id:uid(),created:nowMs()},result.value);
  if(!existing)state.vault.unshift(entry);
  const saved=await flushSave();
  if(!saved){if(existing)Object.assign(existing,previous);else state.vault=state.vault.filter(x=>x.id!==entry.id);if(btn){btn.disabled=false;btn.textContent="Save";}toast("Vault save failed — your existing data was left unchanged","err");return;}
  closeModal();renderView();celebrate();toast(existing?"Entry updated":"Entry saved","ok");log(existing?"info":"ok",(existing?"Updated":"Added")+" vault entry: "+entry.name);
}); }

/* context menu — quiet actions with one shared outline icon language */
const CTX_ICON={
  open:'<svg viewBox="0 0 24 24"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v8"/></svg>',
  refresh:'<svg viewBox="0 0 24 24"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></svg>',
  folder:'<svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M5 20h14"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><path d="M8 6v12M16 6v12"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>',
  image:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>',
  delete:'<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/></svg>',
  tag:'<svg viewBox="0 0 24 24"><path d="M4 5h9l7 7-8 8-8-8z"/><circle cx="9" cy="10" r="1"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m10 6-6 6 6 6M5 12h15"/></svg>'
};
function contextIcon(action,fallback){const a=String(action||"");if(/del|remove|forget/.test(a))return CTX_ICON.delete;if(/download/.test(a))return CTX_ICON.download;if(/back/.test(a))return CTX_ICON.back;if(/refresh|check/.test(a))return CTX_ICON.refresh;if(/copy/.test(a))return CTX_ICON.copy;if(/edit/.test(a))return CTX_ICON.edit;if(/fav/.test(a))return CTX_ICON.star;if(/pri|pin/.test(a))return CTX_ICON.pin;if(/reveal|folder/.test(a))return CTX_ICON.folder;if(/pause/.test(a))return CTX_ICON.pause;if(/resume/.test(a))return CTX_ICON.play;if(/shot/.test(a))return CTX_ICON.image;if(/open|original|nav/.test(a))return CTX_ICON.open;return fallback||CTX_ICON.tag;}
function mi(a,id,label,color,danger,icon){ const st=color?` style="--ci-accent:${color}"`:``; return `<div class="ci${danger?" danger":""}" data-action="${a}" data-id="${id}"${st}><span class="ci-ico">${contextIcon(a,icon)}</span><span class="ci-label">${esc(label)}</span></div>`; }
function miT(a,id,label,on,color,icon){ const st=color?` style="--ci-accent:${color}"`:``; return `<div class="ci${on?" on":""}" data-action="${a}" data-id="${id}"${st}><span class="ci-ico">${contextIcon(a,icon)}</span><span class="ci-label">${esc(label)}</span>${on?'<span class="ci-state">On</span>':""}</div>`; }
function miCat(id,cat,on){ const color=CAT_COLORS[cat]||"#cfd3dc",label=cat==="__none__"?"No category":cat; return `<div class="ci cat${on?" on":""}" data-action="link-cat-set" data-id="${id}" data-cat="${esc(cat)}"><span class="ci-label" style="color:${color}">${esc(label)}</span>${on?'<span class="ci-check">✓</span>':""}</div>`; }
function miCatF(id,cat,on){ const color=FOLDER_CATS[cat]||"#cfd3dc",label=cat==="__none__"?"No category":cat; return `<div class="ci cat${on?" on":""}" data-action="folder-cat-set" data-id="${id}" data-cat="${esc(cat)}"><span class="ci-label" style="color:${color}">${esc(label)}</span>${on?'<span class="ci-check">✓</span>':""}</div>`; }
function showMenu(x,y,html){ const m=$("#ctxmenu"); m.innerHTML=html; m.classList.add("show"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function hideMenu(){ $("#ctxmenu").classList.remove("show"); }
function moveMenuTo(x,y){ const m=$("#ctxmenu"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function alignMenuToBubble(el){ const m=$("#ctxmenu"); const br=el.getBoundingClientRect(); const mr=m.getBoundingClientRect(); let left=br.right+8, top=br.bottom-mr.height; if(top<4)top=4; if(left+mr.width>window.innerWidth-8)left=window.innerWidth-mr.width-8; if(left<4)left=4; m.style.top=top+"px"; m.style.left=left+"px"; }
function showCardMenu(type,id,x,y){
  let it="";
  if(type==="vault"){ const v=find(state.vault,id); if(!v)return; if(v.url)it+=mi("vault-open",id,"Open site"); it+=mi("vault-copy-u",id,"Copy username")+mi("vault-copy-p",id,"Copy password")+mi("vault-eye",id,revealed.has(id)?"Hide password":"Show password")+miT("vault-fav",id,"Favorite",v.favorite,FAV_COLOR)+miT("vault-pri",id,"Priority",v.priority,PRI_COLOR)+mi("vault-edit",id,"Edit")+`<div class="cdiv"></div>`+mi("vault-del",id,"Delete","#ff5470",true); }
  else if(type==="link"){ const l=find(state.links,id); if(!l)return; const host=hostOf(l.url),cats=linkCategoryList(l),transfer=currentView==="lot"?mi(l.inLinks?"link-unsend":"link-send",id,l.inLinks?"Remove from Links":"Send to Links",null,false,l.inLinks?"←":"→"):""; it+=`<div class="cm-link-head"><span><b>${esc(l.title)}</b><small>${esc(host)}</small></span></div>`+mi("link-open",id,"Open link",null,false,"↗")+miT("link-fav-toggle",id,"Favorite",l.favorite,FAV_COLOR,"★")+`<div class="cdiv"></div><div class="cm-head">Categories</div>`+Object.keys(CAT_COLORS).map(c=>miCat(id,c,cats.indexOf(c)>=0)).join("")+miCat(id,"__none__",!cats.length)+`<div class="cdiv"></div>`+transfer+mi("link-del",id,"Delete link","#ff5470",true,"×"); }
  else if(type==="folder"){ const f=find(state.folders,id); if(!f)return; const fp=f.path||f.name||""; const pn=petPinCount(); const pinned=isPetPinned(fp); const pinLab=pinned?("Unpin from Pet Recents ("+pn+"/3)"):(pn>=3?"Pet recents full (3/3)":"Pin to Pet Recents ("+pn+"/3)"); it+=mi("folder-open",id,"Open")+miT("folder-fav",id,"Favorite",f.favorite,FAV_COLOR)+mi("folder-edit",id,"Edit")+miT("folder-pet-pin",id,pinLab,pinned,"#ff79c6")+`<div class="cdiv"></div><div class="cm-head">Category</div>`+Object.keys(FOLDER_CATS).map(c=>miCatF(id,c,normCat(f)===c)).join("")+miCatF(id,"__none__",!normCat(f))+`<div class="cdiv"></div>`+mi("folder-del",id,"Remove","#ff5470",true); }
  else if(type==="shot"){ const s=shotById(id); if(!s)return; it+=mi("shot-open",id,"Open")+mi("shot-copy",id,"Copy image")+mi("shot-lookup",id,"Look up on Google Lens","#27b4ff")+`<div class="cdiv"></div>`+mi("shot-reveal",id,"Reveal in Explorer")+mi("shot-refresh","","Refresh","#ff79c6"); }
  else if(type==="monitor"){ const monitor=monitoringMonitor(id); if(!monitor)return; it+=mi("monitoring-monitor-open",id,"Open artist",null,false,"↗")+mi("monitoring-monitor-interval",id,"Edit check time",null,false,"◷")+mi("monitoring-monitor-toggle",id,monitor.enabled?"Pause watcher":"Resume watcher",null,false,monitor.enabled?CTX_ICON.pause:CTX_ICON.play)+mi("monitoring-monitor-refresh",id,"Check now",null,false,"↻")+`<div class="cdiv"></div>`+mi("monitoring-exit","","Back",null,false,CTX_ICON.back)+mi("monitoring-monitor-remove",id,"Remove watcher","#d86565",true,"×"); }
  else if(type==="monitor-artist"){if(!monitoringArtist||monitoringArtist.monitorId!==id)return;it+=mi("monitoring-artist-back","","Back",null,false,CTX_ICON.back)+`<div class="cdiv"></div>`+mi("monitoring-monitor-interval",id,"Edit check time",null,false,"◷")+mi("monitoring-artist-download-all",id,"Download everything",null,false,CTX_ICON.download)+mi("monitoring-artist-original",id,"Open original",null,false,"↗");}
  else if(type==="monitor-artist-post"){if(!monitoringArtist)return;it+=mi("monitoring-artist-post-open",id,"Open post",null,false,"↗")+mi("monitoring-artist-post-download-all",id,"Download post files",null,false,CTX_ICON.download)+`<div class="cdiv"></div>`+mi("monitoring-artist-back","","Back",null,false,CTX_ICON.back);}
  else if(type==="monitor-file"){ const index=Number(id),file=monitoringDetail&&monitoringDetail.files&&monitoringDetail.files[index];if(!file)return;const label=file.kind==="image"?"Download image":file.kind==="video"?"Download video":file.kind==="audio"?"Download audio":"Download file";it+=mi("monitoring-post-back","","Back",null,false,CTX_ICON.back)+'<div class="cdiv"></div><div class="ci" data-action="monitoring-download" data-index="'+index+'"><span class="ci-ico">'+CTX_ICON.download+'</span><span class="ci-label">'+esc(label)+'</span></div>'; }
  else if(type==="monitor-post"){ if(!monitoringDetail)return;it+=mi("monitoring-post-back","","Back",null,false,CTX_ICON.back)+`<div class="cdiv"></div>`+mi("monitoring-original","","Open original",null,false,"↗");if((monitoringDetail.files||[]).length>1)it+=mi("monitoring-download-all","","Download all files",null,false,"↓"); }
  else return;
  showMenu(x,y,it);
}

function openByAction(a,id){
  if(a==="vault-open"){ const v=find(state.vault,id); if(v&&v.url){ openTarget(v.url,"url"); log("info","Opened site: "+v.name); } }
  else if(a==="link-open"){ const l=find(state.links,id); if(l){ l.opens=(l.opens||0)+1; l.lastOpened=nowMs(); saveState(); openTarget(l.url,"url"); log("info","Opened link: "+l.title); if(currentView==="links"&&!offlineMode&&!monitoringMode)renderView(); } }
  else if(a==="folder-open"){ const f=find(state.folders,id); if(f){ const p=f.path||f.name||""; if(p){ openTarget(p,"app"); recordFolderVisit(p); } } }
}
document.addEventListener("dblclick",(ev)=>{ const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action; if((a==="vault-open"||a==="link-open"||a==="folder-open")&&(state.openMode||'double')==='double'){ openByAction(a,t.dataset.id); } });
function runPrimaryAddAction(action){
  if(action==="vault-new"){ vaultModal(); return null; }
  if(action==="link-add")return doLinkAdd();
  if(action==="folder-add")return doFolderAdd();
  return null;
}
document.addEventListener("click",function(ev){
  const target=ev.target.closest&&ev.target.closest('[data-action="vault-new"],[data-action="link-add"],[data-action="folder-add"]');
  if(!target)return;
  ev.preventDefault();
  ev.stopPropagation();
  try{const result=runPrimaryAddAction(target.dataset.action);if(result&&typeof result.catch==="function")result.catch(function(error){reportActionError("Add",error);});}catch(error){reportActionError("Add",error);}
},true);
document.addEventListener("click",async(ev)=>{
  const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action,id=t.dataset.id;
  if((a==="vault-open"||a==="link-open"||a==="folder-open")&&!t.closest("#ctxmenu")&&(state.openMode||'double')==='double')return;
  switch(a){
    case "nav": if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);currentView=t.dataset.nav; $("#content").classList.remove("searching"); searchTerms={}; renderNav(); renderView(); break;
    case "settings-back": closeSettings();break;
    case "settings-duplicates": closeSettings();duplicateReviewModal();break;
    case "settings-rules": closeSettings();smartRulesModal();break;
    case "settings-link-check": await checkSavedLinks();if($("#settingsPanel")&&$("#settingsPanel").classList.contains("show"))renderSettings();break;
    case "settings-extension": await runSettingsCommand("ext open",false);break;
    case "settings-offline-open": await openOfflineStorageFolder();break;
    case "settings-offline-change": await chooseOfflineStorageFolder();break;
    case "settings-monitoring-output-open": await openMonitoringOutputFolder();break;
    case "settings-monitoring-output-change": await chooseMonitoringOutputFolder();break;
    case "settings-media-intros": await openSettingsMediaFolder("intros");break;
    case "settings-media-animations": await openSettingsMediaFolder("animations");break;
    case "offline-mode": setOfflineMode(!offlineMode); break;
    case "offline-exit": setOfflineMode(false);break;
    case "monitoring-mode": toggleMonitoringMode(); break;
    case "monitoring-exit": setMonitoringMode(false);break;
    case "monitoring-post-back": leaveMonitoringPost();break;
    case "monitoring-post-artist-open": {if(!monitoringDetail||!E||!E.monitoringArtistDetail)break;const monitorId=monitoringDetail.monitorId||id,requestId=++monitoringArtistRequest;monitoringDetail=null;monitoringArtistLoading=true;monitoringArtistRange={monitorId:"",from:"",to:""};renderView();const result=await E.monitoringArtistDetail(monitorId);if(requestId!==monitoringArtistRequest)break;monitoringArtistLoading=false;if(result&&result.ok){monitoringArtist=result.artist;renderView();}else{renderView();toast(result&&result.error||"Could not load that artist","err");}break;}
    case "monitoring-artist-back": leaveMonitoringPost();leaveMonitoringArtist();break;
    case "monitoring-tab": monitoringTab=t.dataset.tab==="watchlist"?"watchlist":"activity";monitoringFocusId="";monitoringDetail=null;monitoringArtist=null;renderView();break;
    case "monitoring-filter": monitoringFilter=t.dataset.filter==="unread"?"unread":"all";monitoringFocusId="";renderView();break;
    case "monitoring-add": monitoringAddModal();break;
    case "monitoring-monitor-open": {const monitor=monitoringMonitor(id);if(!monitor)break;if(monitor.kind!=="pawchive"||!E||!E.monitoringArtistDetail){if(monitor.url)openTarget(monitor.url,"url");break;}const requestId=++monitoringArtistRequest;monitoringArtistLoading=true;monitoringArtistRange={monitorId:"",from:"",to:""};monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();const result=await E.monitoringArtistDetail(id);if(requestId!==monitoringArtistRequest)break;monitoringArtistLoading=false;if(result&&result.ok){monitoringArtist=result.artist;renderView();}else{renderView();toast(result&&result.error||"Could not load that artist","err");}break;}
    case "monitoring-monitor-interval": monitoringIntervalModal(id);break;
    case "monitoring-artist-original": if(monitoringArtist&&monitoringArtist.url)openTarget(monitoringArtist.url,"url");break;
    case "monitoring-artist-range-reset": if(monitoringArtist){monitoringArtistRange={monitorId:"",from:"",to:""};monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-date-open": if(monitoringArtist){const side=t.dataset.side==='to'?'to':'from';monitoringDatePicker={side:monitoringDatePicker.side===side?'':side,level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-date-year": if(monitoringArtist&&monitoringDatePicker.side){monitoringDatePicker.level="month";monitoringDatePicker.year=Number(t.dataset.year);renderView();}break;
    case "monitoring-artist-date-month": if(monitoringArtist&&monitoringDatePicker.side){monitoringDatePicker.level="day";monitoringDatePicker.month=Number(t.dataset.month);renderView();}break;
    case "monitoring-artist-date-back": if(monitoringArtist&&monitoringDatePicker.side){if(monitoringDatePicker.level==="day")monitoringDatePicker.level="month";else monitoringDatePicker.level="year";renderView();}break;
    case "monitoring-artist-date-pick": if(monitoringArtist&&monitoringDatePicker.side&&t.dataset.date){const side=monitoringDatePicker.side,date=t.dataset.date;if(side==="from"){monitoringArtistRange.from=date;if(new Date(date)>new Date(monitoringArtistRange.to))monitoringArtistRange.to=date;}else{monitoringArtistRange.to=date;if(new Date(date)<new Date(monitoringArtistRange.from))monitoringArtistRange.from=date;}monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-post-open": {if(!monitoringArtist||!E||!E.monitoringArtistPostDetail)break;const requestId=++monitoringDetailRequest;monitoringDetailLoading=true;renderView();const result=await E.monitoringArtistPostDetail(monitoringArtist.monitorId,id);if(requestId!==monitoringDetailRequest)break;monitoringDetailLoading=false;if(result&&result.ok){monitoringDetail=result.detail;renderView();}else{renderView();toast(result&&result.error||"Could not open that post","err");}break;}
    case "monitoring-artist-download-range": {if(!monitoringArtist||!E||!E.monitoringArtistDownloadAll)break;const from=monitoringArtistRange.from,to=monitoringArtistRange.to,fromTime=new Date(from+"T00:00:00").getTime(),toTime=new Date(to+"T23:59:59.999").getTime();if(!from||!to||!Number.isFinite(fromTime)||!Number.isFinite(toTime)||fromTime>toTime){toast("Choose a valid From and To date","warn");break;}const selected=(monitoringArtist.posts||[]).filter(function(post){return post.date>=fromTime&&post.date<=toTime;}).length;if(!selected){toast("No works are inside that date range","warn");break;}const approved=await confirmModal("Download available files from "+selected+" works to the Monitoring output folder?",false,{title:"Download date range",go:"Download"});if(!approved)break;toast("Date-range download started — keep SINRAD open","ok");const result=await E.monitoringArtistDownloadAll(monitoringArtist.monitorId,from,to);if(result&&result.ok)toast("Downloaded "+result.count+" files from "+result.postCount+" works"+(result.failed?" · "+result.failed+" skipped":""),result.failed?"warn":"ok");else toast(result&&result.error||"Date-range download failed","err");break;}
    case "monitoring-artist-download-all": {if(!monitoringArtist||!E||!E.monitoringArtistDownloadAll)break;const approved=await confirmModal("Download every available file from "+monitoringArtist.posts.length+" works to the Monitoring output folder? This may use a lot of storage.",false,{title:"Download artist",go:"Download"});if(!approved)break;toast("Artist download started — keep SINRAD open","ok");const result=await E.monitoringArtistDownloadAll(monitoringArtist.monitorId,"","");if(result&&result.ok)toast("Downloaded "+result.count+" files from "+result.postCount+" works"+(result.failed?" · "+result.failed+" skipped":""),result.failed?"warn":"ok");else toast(result&&result.error||"Artist download failed","err");break;}
    case "monitoring-artist-post-download-all": {if(!monitoringArtist||!E||!E.monitoringArtistPostDownloadAll)break;const result=await E.monitoringArtistPostDownloadAll(monitoringArtist.monitorId,id);if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "monitoring-refresh": {if(!E||!E.monitoringRefresh||monitoringSyncing)break;monitoringSyncing=true;renderView();const result=await E.monitoringRefresh("");monitoringSyncing=false;await loadMonitoringData();toast(result&&result.ok?(result.baselined?"Watchers initialized — future updates will appear here":("Found "+result.added+" new update"+(result.added===1?"":"s"))):(result&&result.error||"Monitoring check could not finish"),result&&result.ok?"ok":"warn");break;}
    case "monitoring-monitor-refresh": {if(!E||!E.monitoringRefresh||monitoringSyncing)break;monitoringSyncing=true;renderView();const result=await E.monitoringRefresh(id);monitoringSyncing=false;await loadMonitoringData();toast(result&&result.ok?(result.baselined?"Baseline saved — future updates will be reported":("Found "+result.added+" new update"+(result.added===1?"":"s"))):(result&&result.error||"Watcher check could not finish"),result&&result.ok?"ok":"warn");break;}
    case "monitoring-monitor-toggle": {const monitor=monitoringMonitor(id);if(monitor&&E&&E.monitoringMonitorUpdate){await E.monitoringMonitorUpdate(id,{enabled:!monitor.enabled});await loadMonitoringData();toast(monitor.enabled?"Watcher paused":"Watcher resumed","ok");}break;}
    case "monitoring-monitor-remove": if(await confirmModal("Remove this watcher and its activity history?")){await E.monitoringRemove(id);await loadMonitoringData();toast("Watcher removed","ok");}break;
    case "monitoring-mark-read": if(E&&E.monitoringMarkRead){await E.monitoringMarkRead();await loadMonitoringData();toast("Monitoring activity marked read","ok");}break;
    case "monitoring-event-open": {const item=monitoringEvent(id);if(item){if(!item.read&&E&&E.monitoringEventUpdate){item.read=true;await E.monitoringEventUpdate(id,{read:true});}monitoringFocusId="";if(item.kind!=="pawchive"||!E||!E.monitoringPostDetail){if(item.url)openTarget(item.url,"url");renderView();break;}const requestId=++monitoringDetailRequest;monitoringDetailLoading=true;renderView();const result=await E.monitoringPostDetail(id);if(requestId!==monitoringDetailRequest)break;monitoringDetailLoading=false;if(result&&result.ok){monitoringDetail=result.detail;renderView();}else{renderView();toast(result&&result.error||"Could not open that Pawchive post","err");}}break;}
    case "monitoring-original": if(monitoringDetail&&monitoringDetail.originalUrl)openTarget(monitoringDetail.originalUrl,"url");break;
    case "monitoring-download": {if(!monitoringDetail)break;const index=Number(t.dataset.index),result=monitoringDetail.eventId&&E&&E.monitoringDownload?await E.monitoringDownload(monitoringDetail.eventId,index):E&&E.monitoringArtistDownload?await E.monitoringArtistDownload(monitoringDetail.monitorId,monitoringDetail.postId,index):null;if(result&&result.ok)toast("Attachment downloaded","ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "monitoring-download-all": {if(!monitoringDetail)break;const result=monitoringDetail.eventId&&E&&E.monitoringDownloadAll?await E.monitoringDownloadAll(monitoringDetail.eventId):E&&E.monitoringArtistPostDownloadAll?await E.monitoringArtistPostDownloadAll(monitoringDetail.monitorId,monitoringDetail.postId):null;if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "offline-tab": offlineTab=t.dataset.tab==="sources"?"sources":"feed";offlineSelectedId="";renderView();break;
    case "offline-filter": offlineFilter=t.dataset.filter||"all";renderView();break;
    case "offline-refresh": {if(!E||!E.offlineRefresh||offlineSyncing)break;offlineSyncing=true;renderView();const result=await E.offlineRefresh("");offlineSyncing=false;await loadOfflineData();toast(result&&result.ok?("Synced "+result.added+" new item"+(result.added===1?"":"s")):(result&&result.error||"Sync could not finish"),result&&result.ok?"ok":"warn");break;}
    case "offline-source-refresh": {if(!E||!E.offlineRefresh||offlineSyncing)break;offlineSyncing=true;renderView();const result=await E.offlineRefresh(id);offlineSyncing=false;await loadOfflineData();toast(result&&result.ok?("Synced "+result.added+" new item"+(result.added===1?"":"s")):(result&&result.error||"Sync could not finish"),result&&result.ok?"ok":"warn");break;}
    case "offline-reddit-connect": redditConnectModal();break;
    case "offline-reddit-help": openTarget("https://support.reddithelp.com/hc/en-us/articles/14945211791892-Reddit-Developer-Interfaces","url");break;
    case "offline-reddit-disconnect": if(await confirmModal("Disconnect Reddit? Downloaded posts will stay available.")){await E.offlineRedditDisconnect();await loadOfflineData();toast("Reddit disconnected","ok");}break;
    case "offline-source-add": redditSourceModal();break;
    case "offline-source-remove": if(await confirmModal("Remove this subscription? Already downloaded posts will stay until retention removes them.")){await E.offlineSourceRemove(id,false);await loadOfflineData();toast("Subscription removed","ok");}break;
    case "offline-retention": offlineRetentionModal();break;
    case "offline-item-open": {const item=offlineItem(id);if(item){offlineSelectedId=id;if(!item.read&&E&&E.offlineItemUpdate){item.read=true;E.offlineItemUpdate(id,{read:true}).catch(function(){});}renderView();}break;}
    case "offline-item-back": offlineSelectedId="";renderView();break;
    case "offline-gallery-prev":
    case "offline-gallery-next": {const gallery=t.closest(".of-gallery"),images=gallery?Array.from(gallery.querySelectorAll("[data-gallery-image]")):[];if(!gallery||images.length<2)break;const direction=a==="offline-gallery-next"?1:-1,current=Number(gallery.dataset.galleryIndex)||0,next=(current+direction+images.length)%images.length;images.forEach(function(image,index){image.classList.toggle("active",index===next);if(index!==next&&image.tagName==="VIDEO")image.pause();});gallery.dataset.galleryIndex=String(next);const count=gallery.querySelector(".of-gallery-count b");if(count)count.textContent=String(next+1);break;}
    case "offline-item-favorite": {const item=offlineItem(id);if(item&&E&&E.offlineItemUpdate){item.favorite=!item.favorite;await E.offlineItemUpdate(id,{favorite:item.favorite});renderView();}break;}
    case "offline-original": {const item=offlineItem(id);if(item&&item.url)openTarget(item.url,"url");break;}
    case "offline-capture-open": {const item=offlineItem(id);if(item&&item.captureRef&&E&&E.offlineCaptureOpen){const result=await E.offlineCaptureOpen(item.captureRef);if(!result||!result.ok)toast(result&&result.error||"Could not open the saved page","err");}break;}
    case "win-min": E&&E.winMin?E.winMin():toast("Window controls work in the desktop build"); break;
    case "win-max": E&&E.winMax?E.winMax():toast("Window controls work in the desktop build"); break;
    case "win-close": E&&E.winClose?E.winClose():toast("Window controls work in the desktop build"); break;
    case "vault-edit": vaultModal(find(state.vault,id)); break;
    case "vault-del": { const v=find(state.vault,id); if(v&&await confirmModal("Delete "+v.name+"?")){ rememberUndo("Deleted vault entry "+v.name); state.vault=state.vault.filter(x=>x.id!==id); log("warn","Deleted vault entry: "+v.name); saveState(); renderView(); toast("Deleted","ok"); } break; }
    case "vault-fav": { const v=find(state.vault,id); if(v){ rememberUndo("Changed vault favorite"); v.favorite=!v.favorite; log("info",(v.favorite?"Favorited":"Unfavorited")+": "+v.name); saveState(); renderView(); } break; }
    case "vault-pri": { const v=find(state.vault,id); if(v){ rememberUndo("Changed vault priority"); v.priority=!v.priority; log("info",(v.priority?"Priority on":"Priority off")+": "+v.name); saveState(); renderView(); } break; }
    case "vault-eye": if(revealed.has(id))revealed.delete(id); else revealed.add(id); renderView(); break;
    case "vault-open": openByAction("vault-open",id); break;
    case "vault-copy-u": { const v=find(state.vault,id); if(v)copy(v.username||"","Username"); break; }
    case "vault-copy-p": { const v=find(state.vault,id); if(v)copy(v.password||"","Password"); break; }
    case "vault-filter": vaultFilter=t.dataset.filter; renderView(); break;
    case "link-cat": { const cat=t.dataset.cat; if(cat==="all"){ linkCats=[]; } else { const idx=linkCats.indexOf(cat); if(idx>=0) linkCats.splice(idx,1); else linkCats.push(cat); const ai=linkCats.indexOf("all"); if(ai>=0) linkCats.splice(ai,1); } renderView(); break; }
    case "link-fav": linkFav=!linkFav; renderView(); break;
    case "link-fav-toggle": { const l=find(state.links,id); if(l){ rememberUndo("Changed link favorite"); l.favorite=!l.favorite; log("info",(l.favorite?"Favorited":"Unfavorited")+" link: "+l.title); saveState(); renderView(); } break; }
    case "link-cat-set": { const l=find(state.links,id); if(l){ rememberUndo("Changed link categories"); const cat=t.dataset.cat,isYouTube=SinradShared.automaticLinkCategory(l.url,"")==="YouTube"; if(isYouTube){ let cats=linkCategoryList(l); if(cat==="__none__")cats=["YouTube"]; else if(cat!=="YouTube"){cats=cats.indexOf(cat)>=0?cats.filter(x=>x!==cat):cats.concat(cat);} l.category="YouTube";l.categories=Array.from(new Set(["YouTube"].concat(cats))); } else { l.category=(cat==="__none__")?"":cat;l.categories=l.category?[l.category]:[]; } log("info","Tagged link "+l.title+" → "+linkCategoryList(l).join(", ")); saveState(); renderView(); } break; }
    case "link-open": openByAction("link-open",id); break;
    case 'link-drill': linkDrill=t.dataset.coll||null; renderView(); break;
    case 'link-drill-back': linkDrill=null; renderView(); break;
    case 'link-openall': { var cn=t.dataset.coll; var list=state.links.filter(function(l){return _inLot(l)&&(l.coll||'')===cn;}); if(list.length>8 && !(await confirmModal('Open '+list.length+' tabs from '+cn+'?'))) break; list.forEach(function(l){ if(E&&E.shellOpen)E.shellOpen(l.url); else try{window.open(l.url,'_blank');}catch(_){} }); log('info','opened '+list.length+' links from '+cn); break; }
        case "cat-del-ctx": { var cn3=(t.dataset.cat||"").trim(); if(cn3){ confirmModal("Delete category \""+cn3+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn3); toast("Category deleted","ok"); } }); } break; }
    case "cat-del": { const cat=t.dataset.cat; if(cat&&state.categories&&state.categories[cat]){ confirmModal("Delete category \""+cat+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cat); toast("Category deleted","ok"); } }); } break; }
    case "cat-add": { const catType=t.dataset.type||"link"; openModal("New Category", '<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:60px;height:40px;border:none;border-radius:4px;background:var(--input);cursor:pointer;padding:0"></div></div>', "Create", function(){ var name=($("#cat_name")||{}).value||""; name=name.trim(); if(!name){ toast("Name required","warn"); return; } var cc=CAT_COLORS[name]; if(cc&&(!state.categories||!state.categories[name])&&DEFAULT_CATS[name]){ toast("Category already exists","warn"); return; } if(state.categories&&state.categories[name]){ toast("Category already exists","warn"); return; } var color=($("#cat_color")||{}).value||"#27b4ff"; if(catType==="folder"){if(!state.folderCategories)state.folderCategories={};state.folderCategories[name]=color;saveState();refreshFolderCats();renderView();}else if(catType==="shot"){if(!state.shotCollections)state.shotCollections={};if(state.shotCollections[name]||SHOT_DEFAULT_COLS[name]){toast("Category already exists","warn");return;}state.shotCollections[name]=color;saveState();renderView();}else{addCategory(name,color);}closeModal(); toast("Category created: "+name,"ok"); }); setTimeout(function(){ var i=document.getElementById("cat_name"); if(i) i.focus(); },30); break; }
    case "cat-del-pill": { var cn2=(t.dataset.cat||"").trim(); if(cn2){ confirmModal("Delete category \""+cn2+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn2); toast("Category deleted","ok"); } }); } break; }
    case "cat-delete": { var cn=id; confirmModal("Delete category \""+cn+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn); toast("Category deleted","ok"); } }); break; }
    case "link-del": { const l=find(state.links,id); if(l&&await confirmModal("Delete "+l.title+"?")){ rememberUndo("Deleted link "+l.title); state.links=state.links.filter(x=>x.id!==id); log("warn","Deleted link: "+l.title); saveState(); renderView(); } break; }
    case "undo-history": undoHistoryModal(); break;
    case "undo-last": undoLastChange(); break;
    case "duplicate-review": duplicateReviewModal(); break;
    case "smart-rules": smartRulesModal(); break;
    case "rule-del": { const index=Number(t.dataset.index),rules=currentLinkRules(); if(rules[index]){rememberUndo("Removed smart category rule");if(!state.settings)state.settings={};state.settings.linkRules=rules.filter(function(_rule,i){return i!==index;});saveState();smartRulesModal();toast("Rule removed","ok");} break; }
    case "link-check": checkSavedLinks(); break;
    case "command-open": openCommandPalette(); break;
    case "settings-open": toggleSettings(); break;
    case "folder-pet-pin": { const f=find(state.folders,id); if(f){ const p=f.path||f.name||""; const on=togglePetPin(p, f.name||baseName(p)); log("info",(on?"Pinned":"Unpinned")+" folder to Pet Recents: "+(f.name||p)); toast(on?"Pinned to Pet Recents":"Unpinned from Pet Recents","ok"); renderView(); } break; }
    case "open-folder-path": { const p=t.dataset.path; if(p) openTarget(p,"app"); break; }
    case "shot-filter": { const f=t.dataset.filter||"inbox"; shotFilter=(shotFilter===f)?"inbox":f; shotPage=0; renderView(); break; }
    case "shot-refresh": shotsRefresh(false); break;
    case "shot-size": shotSize=t.dataset.size||"m"; if(!state.settings)state.settings={}; state.settings.shotSize=shotSize; saveState(); renderView(); break;
    case "shot-page": shotPage+=(parseInt(t.dataset.dir,10)||0); if(shotPage<0)shotPage=0; renderView(); if($("#content"))$("#content").scrollTop=0; break;
    case "shot-slideshow": shotSlideshowStart(); break;
    case "kill-toggle": killToggle(); break;
    case "store-menu": { const sc=$("#storeControl"),sm=$("#storeMenu"); if(sc&&sm){const open=sc.classList.toggle("open");t.setAttribute("aria-expanded",open?"true":"false");const mode=$("#store-menu-mode");if(mode)mode.textContent=$("#store-mode").textContent;} break; }
    case "backup-export": backupExportModal(); break;
    case "backup-import": backupImportModal(); break;
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
    case "folder-fav": { const f=find(state.folders,id); if(f){ rememberUndo("Changed folder favorite"); f.favorite=!f.favorite; log("info",(f.favorite?"Favorited":"Unfavorited")+" folder: "+(f.name||"")); saveState(); renderView(); } break; }
    case "folder-del": { const f=find(state.folders,id); if(f&&await confirmModal("Remove "+(f.name||baseName(f.path||f.name))+"?")){ rememberUndo("Removed folder "+(f.name||baseName(f.path||f.name))); state.folders=state.folders.filter(x=>x.id!==id); log("warn","Removed quick folder"); saveState(); renderView(); } break; }
    case "folder-cat": { const cat=t.dataset.cat; const idx=folderCats.indexOf(cat); if(idx>=0){folderCats.splice(idx,1);}else{folderCats.push(cat);} renderView(); break; }
    case "folder-cat-set": { const f=find(state.folders,id); if(f){ rememberUndo("Changed folder category"); f.category=(t.dataset.cat==="__none__")?"":t.dataset.cat; log("info","Tagged folder "+(f.name||baseName(f.path||f.name))+" → "+(f.category||"none")); saveState(); renderView(); } break; }
    case "folder-filter": folderFilter=t.dataset.filter; renderView(); break;
    case "console-clear": if(await confirmModal("Clear the entire activity log?")){ state.console=[]; log("warn","Activity log cleared"); saveState(); renderView(); } break;
    case "console-add-link": { const c=find(state.console,id); if(c&&c.meta&&c.meta.url){ const u=c.meta.url,auto=smartCategories(u,""); rememberUndo("Saved console link"); state.links.unshift({id:uid(),title:hostOf(u),url:u,category:auto.main,categories:auto.all,favorite:false,created:nowMs()}); c.meta=null; log("ok","Saved visited site to Links: "+u); saveState(); renderView(); toast(auto.main==="YouTube"?"Added to YouTube":"Added to Links","ok"); } break; }
    case "console-add-folder": { const c=find(state.console,id); const p=c&&c.meta&&(c.meta.path||c.meta.openPath); if(p){ state.folders.unshift({id:uid(),name:baseName(p),path:p,category:"",favorite:false,created:nowMs()}); c.meta=null; log("ok","Saved opened folder to Quick Folders: "+p); saveState(); renderView(); toast("Added to Folders","ok"); } break; }
    case "norma-min": setFloating(true); break;
    case "norma-dock": setFloating(false); break;
    case "norma-pin": setFloating(!isFloating()); break;
    case "update-check": updateCheckClick(false); break;
    case "update-open": { const notice=$("#update-toast");if(notice)notice.remove();showUpdateModal();break; }
    case "open-github": openGithub(); break;
    case "toggle-autoscroll": { if(!state.settings)state.settings={}; state.settings.autoScroll=(state.settings.autoScroll===false); saveState(); updateAutoScrollBtn(); log("info","auto-scroll: "+(state.settings.autoScroll?"on":"off")); break; }
    case "update-later": hideUpdateModal(); break;
    case "update-go": updateGoClick(); break;
    case "global-result": openGlobalSearchResult(t.dataset.index); break;
    case "modal-cancel": cancelModal(); break;
    case "modal-confirm": confirmActiveModal(); break;
  }
});
function hostOf(u){ try{ const h=new URL(u).hostname; return h||String(u).slice(0,40); }catch(e){ return String(u).slice(0,40); } }

let _searchRenderTimer=null;
document.addEventListener("input",(ev)=>{ const s=ev.target.closest("[data-search]"); if(!s)return; const k=s.dataset.search,pos=s.value.length; searchTerms[k]=s.value; if(_searchRenderTimer)clearTimeout(_searchRenderTimer); _searchRenderTimer=setTimeout(function(){ _searchRenderTimer=null; if(k==="console"){ renderTermBody(); return; } renderView(); const again=document.querySelector('[data-search="'+k+'"]'); if(again){ again.focus(); try{ again.setSelectionRange(pos,pos); }catch(e){} } },140); });
document.addEventListener("input",function(ev){
  if(!ev.target||ev.target.id!=="offlineSearch")return;
  const position=ev.target.value.length;offlineQuery=ev.target.value;
  if(_searchRenderTimer)clearTimeout(_searchRenderTimer);
  _searchRenderTimer=setTimeout(function(){_searchRenderTimer=null;renderView();const input=$("#offlineSearch");if(input){input.focus();try{input.setSelectionRange(position,position);}catch(_){}}},140);
});
document.addEventListener("input",function(ev){
  if(!ev.target||ev.target.id!=="monitoringSearch")return;
  const position=ev.target.value.length;monitoringQuery=ev.target.value;monitoringFocusId="";
  if(_searchRenderTimer)clearTimeout(_searchRenderTimer);
  _searchRenderTimer=setTimeout(function(){_searchRenderTimer=null;renderView();const input=$("#monitoringSearch");if(input){input.focus();try{input.setSelectionRange(position,position);}catch(_){}}},140);
});
const globalSearchInput=$("#globalSearchInput");
if(globalSearchInput){
  globalSearchInput.addEventListener("input",renderGlobalSearch);
  globalSearchInput.addEventListener("focus",renderGlobalSearch);
  globalSearchInput.addEventListener("keydown",function(ev){
    const rows=Array.from(document.querySelectorAll(".gs-result"));
    if(ev.key==="ArrowDown"&&rows.length){ev.preventDefault();ev.stopPropagation();globalSearchActive=(globalSearchActive+1)%rows.length;paintGlobalSearchActive();}
    else if(ev.key==="ArrowUp"&&rows.length){ev.preventDefault();ev.stopPropagation();globalSearchActive=(globalSearchActive<=0?rows.length:globalSearchActive)-1;paintGlobalSearchActive();}
    else if(ev.key==="Enter"&&rows.length){ev.preventDefault();ev.stopPropagation();const row=rows[globalSearchActive>=0?globalSearchActive:0];openGlobalSearchResult(row.dataset.index);}
    else if(ev.key==="Escape"){ev.preventDefault();ev.stopPropagation();closeGlobalSearch(false);globalSearchInput.blur();}
  });
}
document.addEventListener("click",function(ev){const wrap=$("#globalSearch");if(wrap&&!wrap.contains(ev.target))closeGlobalSearch(false);});

let settingsTab="general";
function settingToggle(key,label,_detail,on){return '<div class="setting-row"><b class="setting-label">'+esc(label)+'</b><label class="setting-switch"><input type="checkbox" data-setting-toggle="'+esc(key)+'"'+(on?' checked':'')+'><i></i></label></div>';}
function settingContextRow(title,key,detail){return '<div class="setting-row setting-context-row" data-settings-menu="'+esc(key)+'" title="Right-click for options"><b class="setting-label">'+esc(title)+'</b><span class="setting-context-hint">'+esc(detail||"Right-click")+'</span></div>';}
function settingFolderRow(title,folder,key){return '<div class="setting-row setting-context-row" data-settings-menu="'+esc(key||"offline-storage")+'" title="Right-click for folder options"><b class="setting-label">'+esc(title)+'</b><div class="setting-folder-control"><code class="setting-path" title="'+esc(folder||"Loading folder…")+'">'+esc(folder||"Loading folder…")+'</code><span class="setting-context-hint">Right-click</span></div></div>';}
function settingOpenModeRow(){return '<div class="setting-row"><b class="setting-label">Open cards with one click</b><label class="setting-switch"><input type="checkbox" id="settingOpenModeToggle"'+(state.openMode==='single'?' checked':'')+'><i></i></label></div>';}
function settingMonitoringRow(){return '<div class="setting-row"><b class="setting-label">Windows notifications</b><label class="setting-switch"><input type="checkbox" data-monitoring-notifications'+(monitoringData.settings.notifications?' checked':'')+'><i></i></label></div>';}
function settingHotkeyRow(name,label,enabled){const hotkey=currentHotkeys()[name],toggle=name==="quickSave"?'<label class="setting-switch" title="Enable quick save"><input type="checkbox" data-setting-toggle="hk"'+(enabled?' checked':'')+'><i></i></label>':'';return '<div class="setting-row"><b class="setting-label">'+esc(label)+'</b><div class="setting-hotkey-control"><input class="setting-hotkey-input" data-hotkey-field="'+esc(name)+'" value="'+esc(hotkeyDisplay(hotkey))+'" readonly aria-label="'+esc(label)+' hotkey">'+toggle+'</div></div>';}
function settingsStacks(){const counts={};(state.links||[]).filter(_inLot).forEach(function(link){const key=link.coll||_parkHost(link.url);counts[key]=(counts[key]||0)+1;});return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]||a.localeCompare(b);}).map(function(key){return {name:key,count:counts[key]};});}
function renderSettings(){
  const tabs=$("#settingsTabs"),body=$("#settingsBody");if(!tabs||!body)return;
  const names=[{id:"general",name:"General"},{id:"parking",name:"Parking"},{id:"tools",name:"Tools"}];
  tabs.innerHTML='<button type="button" class="settings-back" data-action="settings-back">← Back</button>'+names.map(function(tab){return '<button type="button" class="'+(settingsTab===tab.id?'active':'')+'" data-settings-tab="'+tab.id+'">'+tab.name+'</button>';}).join("");
  const s=state.settings||{};
  if(settingsTab==="general"){
    body.innerHTML='<div class="settings-section"><div class="settings-section-title">Startup and behavior</div>'+
      settingToggle("intro","Boot animation","Play the intro animation before the main window.",s.introEnabled!==false)+
      settingToggle("autostart","Start with Windows","Open SINRAD after signing in.",!!s.autoStart)+
      settingToggle("pet","Undock Norma on startup","Start the desktop pet outside the main panel.",!!s.petAutoUndock)+
      settingOpenModeRow()+
      '<div class="settings-section-title">Monitoring</div>'+settingMonitoringRow()+
      '</div>';
    return;
  }
  if(settingsTab==="parking"){
    const stacks=settingsStacks();
    body.innerHTML='<div class="settings-section"><div class="settings-section-title">Stacks</div>'+(stacks.length?'<div class="setting-stacks">'+stacks.map(function(stack){return '<span class="setting-chip"><span>'+esc(stack.name)+'</span><b>'+stack.count+'</b></span>';}).join("")+'</div>':'<div class="setting-empty">No stacks</div>')+'</div>';
    return;
  }
  body.innerHTML='<div class="settings-section"><div class="settings-section-title">Link library</div>'+
    settingContextRow("Exact duplicates","duplicates","Review")+
    settingContextRow("Smart categories","smart-rules","Edit rules")+
    settingContextRow("Link health","link-health",_linkCheckRunning?("Checking "+_linkCheckDone+"/"+_linkCheckTotal):"Check now")+
    '<div class="settings-section-title">Media folders</div>'+settingFolderRow("Offline library",offlineData.storagePath,"offline-storage")+settingFolderRow("Monitoring downloads",monitoringData.settings&&monitoringData.settings.downloadFolder,"monitoring-output")+settingContextRow("Intro videos","media-intros","Open folder")+settingContextRow("App animations","media-animations","Open folder")+
    '<div class="settings-section-title">Extension</div>'+settingContextRow("Browser extension","extension","Open folder")+
    '<div class="settings-section-title">Hotkeys</div>'+settingHotkeyRow("globalSearch","Global search",true)+settingHotkeyRow("commandPalette","Commands",true)+settingHotkeyRow("undo","Undo",true)+settingHotkeyRow("quickSave","Quick save",s.hotkeyEnabled!==false)+
    '</div>';
}
function paintSettingsToggle(open){const button=$("#settingsToggle");if(!button)return;button.classList.toggle("active",!!open);button.setAttribute("aria-expanded",open?"true":"false");button.setAttribute("aria-label",open?"Close settings":"Open settings");}
function openSettings(){closeGlobalSearch(false);closeCommandPalette();const panel=$("#settingsPanel");if(!panel)return;panel.classList.add("show");panel.setAttribute("aria-hidden","false");paintSettingsToggle(true);renderSettings();if(E&&E.monitoringLoad)E.monitoringLoad().then(function(data){if(data)monitoringData=data;if(panel.classList.contains("show"))renderSettings();}).catch(function(){});if(E&&E.offlineLoad)E.offlineLoad().then(function(data){if(data)offlineData=data;if(panel.classList.contains("show"))renderSettings();}).catch(function(){});}
function closeSettings(){const panel=$("#settingsPanel");if(panel){panel.classList.remove("show");panel.setAttribute("aria-hidden","true");}paintSettingsToggle(false);}
function toggleSettings(){const panel=$("#settingsPanel");if(panel&&panel.classList.contains("show"))closeSettings();else openSettings();}
async function runSettingsCommand(command,showConsole,keepControls){if(showConsole){closeSettings();commandNavigate("console");}await handleCommand(command);if(!showConsole&&!keepControls)renderSettings();}
async function openOfflineStorageFolder(){if(!E||!E.offlineStorageOpen){toast("Offline folders need the desktop app","warn");return;}if(!await E.offlineStorageOpen())toast("Could not open the offline folder","err");}
async function chooseOfflineStorageFolder(){if(!E||!E.offlineStorageChoose){toast("Offline folders need the desktop app","warn");return;}const result=await E.offlineStorageChoose();if(result&&result.ok){if(result.snapshot)offlineData=result.snapshot;renderSettings();if(offlineMode)renderView();toast("Offline library moved to the selected folder","ok");}else if(result&&!result.canceled)toast(result.error||"Could not change the offline folder","err");}
async function openMonitoringOutputFolder(){if(!E||!E.monitoringOutputOpen){toast("Monitoring folders need the desktop app","warn");return;}if(!await E.monitoringOutputOpen())toast("Could not open the Monitoring folder","err");}
async function chooseMonitoringOutputFolder(){if(!E||!E.monitoringOutputChoose){toast("Monitoring folders need the desktop app","warn");return;}const result=await E.monitoringOutputChoose();if(result&&result.ok){if(result.snapshot)monitoringData=result.snapshot;renderSettings();toast("Future Monitoring downloads will use this folder","ok");}else if(result&&!result.canceled)toast(result.error||"Could not change the Monitoring folder","err");}
async function openSettingsMediaFolder(kind){if(!E||!E.mediaOpen){toast("Media folders need the desktop app","warn");return;}const ok=await E.mediaOpen(kind);if(!ok)toast("Could not open that folder","err");}
function settingsMenuHtml(key){let items="";if(key==="duplicates")items=mi("settings-duplicates","","Review exact duplicates");else if(key==="smart-rules")items=mi("settings-rules","","Edit rules");else if(key==="link-health")items=mi("settings-link-check","",_linkCheckRunning?("Checking "+_linkCheckDone+"/"+_linkCheckTotal):"Check now");else if(key==="offline-storage")items=mi("settings-offline-open","","Open folder")+mi("settings-offline-change","","Change folder");else if(key==="monitoring-output")items=mi("settings-monitoring-output-open","","Open folder")+mi("settings-monitoring-output-change","","Change folder");else if(key==="media-intros")items=mi("settings-media-intros","","Open folder");else if(key==="media-animations")items=mi("settings-media-animations","","Open folder");else if(key==="extension")items=mi("settings-extension","","Open folder");return items+(items?'<div class="cdiv"></div>':'')+mi("settings-back","","Back",null,false,CTX_ICON.back);}
const settingsPanel=$("#settingsPanel");
if(settingsPanel){
  settingsPanel.addEventListener("click",async function(ev){
    if(ev.target===settingsPanel){closeSettings();return;}
    const tab=ev.target.closest("[data-settings-tab]");if(tab){settingsTab=tab.dataset.settingsTab;renderSettings();return;}
  });
  settingsPanel.addEventListener("contextmenu",function(ev){const row=ev.target.closest("[data-settings-menu]");if(!row)return;ev.preventDefault();ev.stopPropagation();showMenu(ev.clientX,ev.clientY,settingsMenuHtml(row.dataset.settingsMenu));});
  settingsPanel.addEventListener("change",async function(ev){
    const notifications=ev.target.closest("[data-monitoring-notifications]");if(notifications){if(!E||!E.monitoringSettings){notifications.checked=!notifications.checked;toast("Monitoring settings need the desktop app","warn");return;}const result=await E.monitoringSettings({notifications:notifications.checked});if(!result){notifications.checked=!notifications.checked;toast("Could not save notification setting","err");return;}monitoringData=result;toast("Monitoring notifications "+(monitoringData.settings.notifications?"on":"off"),"ok");return;}
    const toggle=ev.target.closest("[data-setting-toggle]");if(toggle){await runSettingsCommand(state.radCmd+" set "+toggle.dataset.settingToggle+" "+(toggle.checked?"on":"off"),false,true);return;}
    if(ev.target.id==="settingOpenModeToggle")await runSettingsCommand(state.radCmd+" set "+(ev.target.checked?"single":"double"),false,true);
  });
  settingsPanel.addEventListener("focusin",function(ev){const field=ev.target.closest("[data-hotkey-field]");if(!field)return;field.classList.add("recording");field.select();if(E&&E.hotkeyCapture)E.hotkeyCapture(true);});
  settingsPanel.addEventListener("focusout",function(ev){const field=ev.target.closest("[data-hotkey-field]");if(!field)return;field.classList.remove("recording");setTimeout(function(){if(!settingsPanel.querySelector("[data-hotkey-field]:focus")&&E&&E.hotkeyCapture)E.hotkeyCapture(false);},0);});
  settingsPanel.addEventListener("keydown",async function(ev){
    const field=ev.target.closest("[data-hotkey-field]");if(!field)return;
    ev.preventDefault();ev.stopPropagation();
    if(ev.key==="Escape"){field.blur();return;}
    if(["Control","Shift","Alt","Meta"].indexOf(ev.key)>=0)return;
    const combo=hotkeyFromEvent(ev);if(!combo){toast("Use Ctrl or Alt with a letter, number, or F-key","warn");return;}
    const name=field.dataset.hotkeyField,hotkeys=currentHotkeys(),conflict=Object.keys(hotkeys).find(function(key){return key!==name&&hotkeys[key]===combo;});if(conflict){toast("That hotkey is already in use","warn");return;}
    hotkeys[name]=combo;state.settings.hotkeys=hotkeys;field.value=hotkeyDisplay(combo);saveState();paintHotkeyLabels();if(E&&E.hotkeysUpdate)await E.hotkeysUpdate(hotkeys);field.blur();toast("Hotkey changed","ok");
  });
}

let commandActive=0,commandItems=[];
function commandDefinitions(){const hotkeys=currentHotkeys();return [
  {group:"Navigate",id:"search",icon:"⌕",name:"Search everything",hint:hotkeyDisplay(hotkeys.globalSearch)},{group:"Navigate",id:"vault",icon:"◇",name:"Go to Vault"},{group:"Navigate",id:"links",icon:"↗",name:"Go to Links"},{group:"Navigate",id:"lot",icon:"P",name:"Go to Parking Lot"},{group:"Navigate",id:"folders",icon:"□",name:"Go to Folders"},{group:"Navigate",id:"shots",icon:"▣",name:"Go to Screenies"},{group:"Navigate",id:"offline",icon:"◫",name:offlineMode?"Exit Offline Reader":"Open Offline Reader"},{group:"Navigate",id:"monitoring",icon:"◎",name:monitoringMode?"Exit Monitoring Mode":"Open Monitoring Mode"},{group:"Navigate",id:"settings",icon:"⚙",name:"Open Settings"},
  {group:"Create",id:"add-vault",icon:"+",name:"Add vault entry"},{group:"Create",id:"add-link",icon:"+",name:"Add link"},{group:"Create",id:"add-folder",icon:"+",name:"Add folder"},
  {group:"Actions",id:"undo",icon:"↶",name:"Undo latest change",hint:hotkeyDisplay(hotkeys.undo)},{group:"Actions",id:"duplicates",icon:"≋",name:"Review exact duplicates"},{group:"Actions",id:"rules",icon:"⌁",name:"Smart category rules"},{group:"Actions",id:"check-links",icon:"✓",name:"Check saved links"},{group:"Actions",id:"backup",icon:"↓",name:"Create encrypted backup"},{group:"Actions",id:"restore",icon:"↑",name:"Restore encrypted backup"},{group:"Actions",id:"update",icon:"↻",name:"Check for updates"}
];}
function renderCommandPalette(){const input=$("#commandInput"),list=$("#commandList");if(!input||!list)return;const query=input.value.trim().toLowerCase();commandItems=commandDefinitions().filter(function(command){return !query||command.name.toLowerCase().indexOf(query)>=0||command.id.indexOf(query)>=0;});if(commandActive>=commandItems.length)commandActive=0;let lastGroup="";list.innerHTML=commandItems.length?commandItems.map(function(command,index){const heading=command.group!==lastGroup?'<div class="cp-group">'+esc(command.group)+'</div>':'';lastGroup=command.group;return heading+'<button type="button" class="cp-item'+(index===commandActive?' active':'')+'" data-command="'+command.id+'"><i>'+command.icon+'</i><b>'+esc(command.name)+'</b><small>'+esc(command.hint||"")+'</small></button>';}).join(""):'<div class="cp-empty">No matching command</div>';}
function openCommandPalette(){const palette=$("#commandPalette"),input=$("#commandInput");if(!palette||!input)return;closeGlobalSearch(false);palette.classList.add("show");palette.setAttribute("aria-hidden","false");input.value="";commandActive=0;renderCommandPalette();setTimeout(function(){input.focus();},20);}
if(E&&E.onCommandPalette)E.onCommandPalette(openCommandPalette);
function closeCommandPalette(){const palette=$("#commandPalette");if(palette){palette.classList.remove("show");palette.setAttribute("aria-hidden","true");}}
function commandNavigate(view,focus){if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);currentView=view;searchTerms={};renderNav();renderView();if(focus)setTimeout(function(){const target=$(focus);if(target)target.focus();},20);}
function runPaletteCommand(id){closeCommandPalette();switch(id){case "search":{if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);renderView();const input=$("#globalSearchInput");if(input){input.focus();input.select();renderGlobalSearch();}break;}case "undo":undoLastChange();break;case "settings":openSettings();break;case "offline":setOfflineMode(!offlineMode);break;case "monitoring":toggleMonitoringMode();break;case "vault":case "links":case "lot":case "folders":case "shots":commandNavigate(id);break;case "add-vault":commandNavigate("vault");vaultModal();break;case "add-link":commandNavigate("links","#lk_url");break;case "add-folder":commandNavigate("folders","#fd_path");break;case "duplicates":commandNavigate("links");duplicateReviewModal();break;case "rules":commandNavigate("links");smartRulesModal();break;case "check-links":commandNavigate("links");checkSavedLinks();break;case "backup":backupExportModal();break;case "restore":backupImportModal();break;case "update":updateCheckClick(false);break;}}
const commandInput=$("#commandInput"),commandPalette=$("#commandPalette");
if(commandInput){commandInput.addEventListener("input",function(){commandActive=0;renderCommandPalette();});commandInput.addEventListener("keydown",function(ev){if(ev.key==="ArrowDown"&&commandItems.length){ev.preventDefault();commandActive=(commandActive+1)%commandItems.length;renderCommandPalette();}else if(ev.key==="ArrowUp"&&commandItems.length){ev.preventDefault();commandActive=(commandActive<=0?commandItems.length:commandActive)-1;renderCommandPalette();}else if(ev.key==="Enter"&&commandItems.length){ev.preventDefault();runPaletteCommand(commandItems[commandActive].id);}else if(ev.key==="Escape"){ev.preventDefault();closeCommandPalette();}});}
if(commandPalette){commandPalette.addEventListener("click",function(ev){const item=ev.target.closest("[data-command]");if(item){runPaletteCommand(item.dataset.command);return;}if(ev.target===commandPalette)closeCommandPalette();});}
window.addEventListener("keydown",function(ev){
  if(ev.target&&ev.target.closest&&ev.target.closest("[data-hotkey-field]"))return;
  if(hotkeyMatches(ev,"commandPalette")){
    ev.preventDefault();ev.stopImmediatePropagation();openCommandPalette();return;
  }
  if(!hotkeyMatches(ev,"undo"))return;
  if($("#overlay").classList.contains("show")||($("#commandPalette")&&$("#commandPalette").classList.contains("show"))||($("#settingsPanel")&&$("#settingsPanel").classList.contains("show")))return;
  if(!undoStack.length)return;
  ev.preventDefault();ev.stopImmediatePropagation();undoLastChange();
},true);

document.addEventListener("keydown",(ev)=>{
  if(ev.target&&ev.target.closest&&ev.target.closest("[data-hotkey-field]"))return;
  if(hotkeyMatches(ev,"globalSearch")){ev.preventDefault();const input=$("#globalSearchInput");if(input){input.focus();input.select();renderGlobalSearch();}return;}
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&ev.key.toLowerCase()==="f"){
    const k={vault:"vault",links:"links",folders:"folders",console:"console",lot:"lot",shots:"shots"}[currentView];
    if(!k)return; ev.preventDefault();
    if(currentView==="console"){ const i=document.querySelector('[data-search="console"]'); if(i){i.focus();i.select();} return; }
    $("#content").classList.add("searching"); const i=document.querySelector('[data-search="'+k+'"]'); if(i){i.focus();i.select();}
    return;
  }
  if(ev.key==="Enter"&&$("#overlay").classList.contains("show")&&ev.target.tagName!=="TEXTAREA"&&ev.target.tagName!=="SELECT"&&ev.target.tagName!=="BUTTON"){ ev.preventDefault(); confirmActiveModal(); return; }
  if($("#shotshow")&&$("#shotshow").classList.contains("on")){ ev.preventDefault(); shotSlideshowStop(); return; }
    if($("#shotbox")&&$("#shotbox").classList.contains("show")){
    if(ev.key==="Escape"){ ev.preventDefault(); shotHide(); return; }
    if(ev.key==="ArrowLeft"){ ev.preventDefault(); shotStep(-1); return; }
    if(ev.key==="ArrowRight"){ ev.preventDefault(); shotStep(1); return; }
  }
  if(ev.key==="Escape"){ if($("#settingsPanel")&&$("#settingsPanel").classList.contains("show")){closeSettings();return;} if($("#commandPalette")&&$("#commandPalette").classList.contains("show")){closeCommandPalette();return;} if($("#shotbox")&&$("#shotbox").classList.contains("show")){shotHide();return;} if($("#overlay").classList.contains("show")){cancelModal();return;} if($("#ctxmenu").classList.contains("show")){hideMenu();return;} if(leaveMonitoringPost()){ev.preventDefault();return;} if(leaveMonitoringArtist()){ev.preventDefault();return;} const ct=$("#content"); if(ct.classList.contains("searching")){ ct.classList.remove("searching"); searchTerms[currentView]=""; renderView(); } return; }
  if(ev.key==="Enter"&&!$("#overlay").classList.contains("show")&&ev.target&&ev.target.id){ if(ev.target.id.indexOf("lk_")===0){ ev.preventDefault(); doLinkAdd(); } else if(ev.target.id.indexOf("fd_")===0){ ev.preventDefault(); doFolderAdd(); } else if(ev.target.id==="termInput"){ ev.preventDefault(); const v=ev.target.value; ev.target.value=""; handleCommand(v); } }
});

document.addEventListener("contextmenu", function(ev){
  const inMode=offlineMode||monitoringMode,inContent=ev.target.closest&&ev.target.closest("#content"),interactive=ev.target.closest&&ev.target.closest("button,input,textarea,select,a,img,video,audio,[data-action],[data-ctx],#ctxmenu,#overlay");
  if(inMode&&inContent&&!interactive){
    let menu="";
    if(offlineMode){
      const item=offlineSelectedId&&offlineItem(offlineSelectedId);
      if(item){menu=mi("offline-item-back","","Back",null,false,CTX_ICON.back);if(item.captureRef)menu+=mi("offline-capture-open",item.id,"Open saved page");menu+='<div class="cdiv"></div>'+mi("offline-item-favorite",item.id,item.favorite?"Remove favorite":"Favorite",null,false,CTX_ICON.star)+mi("offline-original",item.id,"Open original");}
      else menu=mi("offline-exit","","Back",null,false,CTX_ICON.back);
    }else if(monitoringDetail)menu=mi("monitoring-post-back","","Back",null,false,CTX_ICON.back);
    else if(monitoringArtist)menu=mi("monitoring-artist-back","","Back",null,false,CTX_ICON.back)+mi("monitoring-monitor-interval",monitoringArtist.monitorId,"Edit check time",null,false,"◷")+mi("monitoring-artist-download-all",monitoringArtist.monitorId,"Download everything",null,false,CTX_ICON.download);
    else menu=mi("monitoring-exit","","Back",null,false,CTX_ICON.back);
    ev.preventDefault();ev.stopImmediatePropagation();showMenu(ev.clientX,ev.clientY,menu);return;
  }
  var pill=ev.target.closest('[data-action="link-cat"]');
  if(pill && pill.dataset.cat && pill.dataset.cat!=="all"){
    var cat=pill.dataset.cat;
    if(state.categories && state.categories[cat]){
      ev.preventDefault();
      showMenu(ev.clientX, ev.clientY, '<div class="ci danger" data-action="cat-del-ctx" data-cat="'+esc(cat)+'"><span class="ci-ico">'+CTX_ICON.delete+'</span><span class="ci-label">Delete category "'+esc(cat)+'"</span></div>');
    }
  }
});

document.getElementById("norma").addEventListener("contextmenu", function(ev){
  if(!this.classList.contains("floating-placeholder")) return;
  ev.preventDefault();
  showMenu(ev.clientX, ev.clientY, mi("norma-dock","","Dock Norma",null,false,CTX_ICON.pin));
});
document.addEventListener("contextmenu",(e)=>{ const c=e.target.closest("[data-ctx]"); if(c){ e.preventDefault(); showCardMenu(c.dataset.ctx,c.dataset.id,e.clientX,e.clientY); } });
document.addEventListener("contextmenu",function(e){ if(currentView!=="shots") return; if(e.target.closest("[data-ctx]")) return; if(e.target.closest("#ctxmenu")||e.target.closest("#overlay")||e.target.closest("#shotbox")||e.target.closest("#shotshow")) return; e.preventDefault(); showMenu(e.clientX,e.clientY,mi("shot-refresh","","Refresh","#ff79c6")); });
$("#ctxmenu").addEventListener("click",hideMenu);
document.addEventListener("click",(e)=>{ const m=$("#ctxmenu"); if(m.classList.contains("show")&&!m.contains(e.target)&&!e.target.closest("#norma-bubble")&&!e.target.closest("#norma"))hideMenu(); });
document.addEventListener("click",function(e){const sc=$("#storeControl");if(sc&&sc.classList.contains("open")&&!sc.contains(e.target)){sc.classList.remove("open");const b=sc.querySelector('[data-action="store-menu"]');if(b)b.setAttribute("aria-expanded","false");}});

function isFloating(){ return $("#norma").classList.contains("floating-placeholder"); }
function setFloating(f){ if(f){ $("#norma").classList.add("floating-placeholder"); if(E&&E.petShow){E.petShow();} else { $("#norma-bubble").classList.add("show"); } log("info","Norma sent floating"); } else { $("#norma").classList.remove("floating-placeholder"); try{ $("#norma").scrollIntoView({block:"nearest"}); }catch(_){} $("#norma-bubble").classList.remove("show"); if(E&&E.petHide)E.petHide(); log("info","Norma pinned to panel"); } }
(function(){ const card=$("#norma"),bubble=$("#norma-bubble"); let moved=false;
  function menu(x,y){showMenu(x,y,mi("norma-dock","","Dock Norma",null,false,CTX_ICON.pin));}

  bubble.addEventListener("contextmenu",e=>{e.preventDefault();const m=$("#ctxmenu");if(m.classList.contains("show")){hideMenu();}else{moved=false;menu(e.clientX,e.clientY);const br=bubble.getBoundingClientRect();alignMenuToBubble(bubble);}});
  let drag=false,ox=0,oy=0;
  bubble.addEventListener("pointerdown",e=>{if(e.button!==0)return;drag=true;moved=false;ox=e.clientX-bubble.offsetLeft;oy=e.clientY-bubble.offsetTop;try{bubble.setPointerCapture(e.pointerId);}catch(_){}bubble.style.cursor="grabbing";});
  bubble.addEventListener("pointermove",e=>{if(!drag)return;moved=true;let x=e.clientX-ox,y=e.clientY-oy;x=Math.max(4,Math.min(window.innerWidth-72,x));y=Math.max(4,Math.min(window.innerHeight-72,y));bubble.style.left=x+"px";bubble.style.top=y+"px"; if($("#ctxmenu").classList.contains("show")){ const br=bubble.getBoundingClientRect(); alignMenuToBubble(bubble); } });
  bubble.addEventListener("pointerup",e=>{if(e.button!==0)return;drag=false;bubble.style.cursor="grab";});
  const bdot=$("#bubbleDot"); if(bdot){ bdot.addEventListener("pointerdown",e=>e.stopPropagation()); bdot.addEventListener("click",e=>{e.stopPropagation();setFloating(false);}); }
})();

var _lastParked=null;
function protocolParkAck(d,ok){ if(d&&d.requestId&&E&&E.protocolParkAck)E.protocolParkAck(d.requestId,!!ok); }
if(E&&E.onHotkeyPark) E.onHotkeyPark(function(txt){ var p=_parkParseClip(txt); if(!p){ try{toast("clipboard has no link","warn");}catch(_){} return; } var url=(p.url||"").trim(); if(url.indexOf("www.")===0) url="https://"+url; var nu=normUrl(url); if(!nu){ toast("could not parse URL","warn"); return; } var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ log("info","hotkey: already in Links — "+ex.title); toast("Already in Links","warn"); return; } var raw=p.title||_parkHost(url); var title=raw.length>45?raw.slice(0,42)+"...":raw; var auto=smartCategories(url,"Check out"),category=auto.main; rememberUndo("Saved hotkey link"); var link={id:uid(),title:title,url:url,category:category,categories:auto.all,favorite:false,created:nowMs()}; state.links.unshift(link); saveState(); log("ok","hotkey → Links ["+auto.all.join(", ")+"]: "+title); celebrate(); renderView(); toast("Added to "+category,"ok"); });
if(E&&E.hotkeyStatus) E.hotkeyStatus(function(mm){ if(mm&&mm.enabled===false){ log('info','hotkey disabled — use Settings → Tools to enable'); } else { log(mm&&mm.ok?'ok':'warn', 'hotkey '+(mm&&mm.ok?'ready':'FAILED')+' ('+(mm&&mm.combo||currentHotkeys().quickSave)+')'); } });
var _batchParkQueue=[], _batchParkTimer=null;
function _protocolParkItem(item){ if(!item||typeof item.url!=="string")return null; var url=item.url.trim(); if(url.indexOf("www.")===0)url="https://"+url; return normUrl(url)?{url:url,title:item.title||_parkHost(url),requestId:item.requestId||""}:null; }
async function _persistProtocolParkBatch(q){
  var added=0,dup=0,addedIds=[];
  for(var i=0;i<q.length;i++){ var r=_parkOne(q[i].title,q[i].url); if(r.dup)dup++; else if(!r.bad){added++;if(r.id)addedIds.push(r.id);} }
  var persisted=added>0?await flushSave():true;
  if(added>0&&persisted){ renderView();celebrate();log("ok","extension \u2192 Parking Lot: "+added+" link(s) parked"+(dup?" ("+dup+" exact duplicates skipped)":""));toast("Parked "+added+" tab"+(added===1?"":"s")+" to Parking Lot","ok");if(E&&E.showNotif)E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:added+" tab"+(added===1?"":"s")+" parked \u2713"}); }
  else if(added>0&&!persisted){ var failedIds={};addedIds.forEach(function(id){failedIds[id]=1;});state.links=state.links.filter(function(link){return !failedIds[link.id];});toast("Could not persist parked tabs","err"); }
  else if(dup>0){toast(dup+" tab"+(dup===1?" was":"s were")+" already parked","warn");}
  return persisted;
}
if(E&&E.onProtocolPark) E.onProtocolPark(async function(d){
  if(!d){protocolParkAck(d,false);return;}
  if(d.lot&&Array.isArray(d.tabs)){
    var batch=d.tabs.map(_protocolParkItem).filter(Boolean);
    if(!batch.length){protocolParkAck(d,false);return;}
    protocolParkAck(d,await _persistProtocolParkBatch(batch));
    return;
  }
  var item=_protocolParkItem(d);if(!item){protocolParkAck(d,false);return;}var url=item.url,nu=normUrl(url);
  if(d.lot){
    _batchParkQueue.push({url:url,title:item.title,requestId:d.requestId||""});
    if(_batchParkTimer)clearTimeout(_batchParkTimer);
    _batchParkTimer=setTimeout(async function(){
      _batchParkTimer=null;
      var q=_batchParkQueue;_batchParkQueue=[];
      var persisted=await _persistProtocolParkBatch(q);
      for(var j=0;j<q.length;j++)protocolParkAck(q[j],persisted);
    },900);
    return;
  }
  var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ protocolParkAck(d,true); toast("Already in Links","warn"); if(E&&E.showNotif) E.showNotif({title:"Homie you already saved this exact link (\u00b4\u3002\uff3f\u3002\u0060)",body:ex.title||url}); return; } var raw=d.title||_parkHost(url); var title=raw.length>45?raw.slice(0,42)+"...":raw; var auto=smartCategories(url,"Check out"),category=auto.main; rememberUndo("Saved extension link"); var link={id:uid(),title:title,url:url,category:category,categories:auto.all,favorite:false,created:nowMs()}; state.links.unshift(link); saveState(); var persisted=await flushSave(); protocolParkAck(d,persisted); if(!persisted){state.links=state.links.filter(function(item){return item.id!==link.id;});toast("Could not persist link","err");return;} log("ok","extension \u2192 Links ["+auto.all.join(", ")+"]: "+title); celebrate(); renderView(); toast("Saved to "+category,"ok"); if(E&&E.showNotif) E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:"Link saved \u2713  "+title}); });
if(E&&E.dataPath) E.dataPath(function(pp){ log('info','data file: '+pp); });
var lotSelLinks={}, lotSelColls={};
var linkSelLinks={};
function _lotCountSel(){ var t=Object.keys(lotSelLinks).length; Object.keys(lotSelColls).forEach(function(c){ state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===c) t++; }); }); return t; }
function _lotDeleteSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var total=_lotCountSel(); if(!total) return; function go(){ rememberUndo("Deleted "+total+" parked links"); var kill={}; ids.forEach(function(x){var selected=find(state.links,x);if(_inLot(selected))kill[x]=1;}); colls.forEach(function(c){ state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===c) kill[l.id]=1; }); }); var n=Object.keys(kill).length; state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); lotSelLinks={}; lotSelColls={}; renderView(); log("warn","deleted "+n+" parked link(s)"); } if(total>4){ confirmModal("Delete "+total+" parked link(s)?").then(function(y){ if(y) go(); }); } else { go(); } }
function _lotClearSel(){ lotSelLinks={}; lotSelColls={}; renderView(); }
document.addEventListener("click", function(ev){
  var rb=ev.target.closest&&ev.target.closest(".lr-rename"); if(rb){ ev.stopPropagation(); ev.preventDefault(); var rr=rb.closest(".lot-row"); if(rr) renameStack(rr.dataset.coll); return; }
  var sb=ev.target.closest&&ev.target.closest(".lr-send, .lb-send"); if(sb){ ev.stopPropagation(); ev.preventDefault(); if(sb.classList.contains("lb-send")){ _lotSendSel(); } else { var r2=sb.closest(".lot-row"); if(r2) _sendCollToLinks(r2.dataset.coll); } return; }
  var ma=ev.target.closest&&ev.target.closest("#ctxmenu [data-action]"); if(ma){ var act=ma.getAttribute("data-action"); if(act==="link-send"||act==="link-unsend"){ ev.stopPropagation(); ev.preventDefault(); var lid=ma.getAttribute("data-id"); var ll=lid?find(state.links,lid):null; if(ll){ rememberUndo(act==="link-send"?"Sent link to Links":"Removed link from Links"); ll.inLinks=(act==="link-send"); if(ll.inLinks)applySmartToLink(ll); saveState(); hideMenu(); renderView(); log("info",(act==="link-send"?"sent to Links: ":"removed from Links: ")+(ll.title||ll.url)); } return; } }
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
function _parkOne(title,url){ url=(url||'').trim(); if(url.indexOf('www.')===0)url='https://'+url; var nu=normUrl(url); if(!nu)return {bad:true}; var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ _lastParked=ex.id; return {dup:true,id:ex.id}; } var auto=SinradShared.automaticLinkCategories(url,''); var link={id:uid(),title:title||_parkHost(url),url:url,category:auto.main,categories:auto.all,coll:_parkHost(url),note:'',src:'park',opens:0,lastOpened:0,created:nowMs()}; state.links.unshift(link); saveState(); _lastParked=link.id; return {id:link.id}; }
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
  else if(cmd==="help"){ push("> commands:"); push('>   '+state.radCmd+' "term"        search folders on your device by name'); push(">   stop                  cancel a running scan"); push(">   roots [add|rm|clear]  folders to scan (default: home)"); push(">   depth <n>             how deep to scan (default 4)"); push('>   '+state.radCmd+' set              settings menu (autostart / hk / intro / pet)'); push('>   '+state.radCmd+' set single|double click   open with one or two clicks'); push(">   park [url]            save clipboard (or a URL) to the Parking Lot"); push(">   parklist              bulk-import URLs from the clipboard"); push(">   parked [stack]        list stacks / links in a stack"); push(">   note <text>           add a note to the last parked link"); push(">   retag <category>      move last parked link into a category"); push(">   stack <name>          rename the stack of the last parked link"); push(">   openall <stack> [!]   open every link in a stack"); push(">   stackmin <n>          stacks form at n+ links"); push(">   ext / bookmarklet     install the browser extension"); push(">   (Screenshots)          inbox + trays · refresh · slideshow · 100 per page"); push(">   setrad <word>         rename the search command"); push(">   help                  show this list"); flush(); return; }
  else if(cmd==='park'){ var p=null; if(arg){ if(_parkIsUrl(arg)){ var u=arg; if(u.indexOf('www.')===0)u='https://'+u; p={title:_parkHost(u),url:u}; } else { push('> not a URL — click the park bookmarklet then  park ,  or  park https://...'); flush(); return; } } else { var clip=(E&&E.clipRead)?await E.clipRead():''; p=_parkParseClip(clip); if(!p){ var bl=_parkBulk(clip); if(bl.added>0){ push('> imported '+bl.added+' links ('+bl.dup+' dupes skipped) into '+bl.stacks+' stack(s)'); celebrate(); renderView(); flush(); return; } push('> clipboard has no link — copy a URL (Ctrl+C) then  park ,  or copy many lines then  park / parklist'); flush(); return; } } var r=_parkOne(p.title,p.url); var lk=r.id?find(state.links,r.id):null; if(r.bad){ push('> could not parse that URL'); } else if(r.dup){ push('> already parked: '+(lk?lk.title:'')+'   (use  note / retag  to update)'); } else { push('> parked  '+(lk?lk.title:'')+(lk&&lk.category?'  ['+lk.category+']':'')+'   ·  note <text>  adds a note'); celebrate(); } renderView(); flush(); return; }
  else if(cmd==='note'){ if(!_lastParked){ push('> nothing parked yet this session — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } lk.note=arg||''; saveState(); push('> note set on  '+(lk.title||lk.url)); renderView(); flush(); return; }
  else if(cmd==='retag'){ if(!_lastParked){ push('> nothing parked yet this session — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } if(!arg){ push('> usage: retag <category>   (e.g.  retag Guides )'); flush(); return; } lk.category=arg; saveState(); push('> recategorised  '+(lk.title||lk.url)+'  ->  '+arg); renderView(); flush(); return; }
  else if(cmd==='stack'){ if(!_lastParked){ push('> nothing parked yet — use  park  first'); flush(); return; } var lk=find(state.links,_lastParked); if(!lk){ push('> last parked link gone'); flush(); return; } if(!arg){ push('> usage: stack <collection>'); flush(); return; } lk.coll=arg; saveState(); push('> stacked  '+(lk.title||lk.url)+'  ->  '+arg); renderView(); flush(); return; }
  else if(cmd==='parked'){ var q=(arg||'').trim().toLowerCase(); if(!q){ var gc={}; state.links.forEach(function(l){ var k=_inLot(l)?(l.coll||''):''; if(k) gc[k]=(gc[k]||0)+1; }); var ks=Object.keys(gc).sort(function(a,b){return gc[b]-gc[a];}); if(!ks.length){ push('> no stacks yet —  park  some links and they auto-group by site'); } else { push('> stacks  ('+ks.length+')  —  parked <stack>  to list ·  openall <stack> !  to open all'); ks.forEach(function(k){ push('  · '+k+'   ('+gc[k]+')'); }); } } else { var list=state.links.filter(function(l){ var c=(l.coll||'').toLowerCase(); return _inLot(l)&&(c===q || c.indexOf(q)>=0); }); if(!list.length){ push('> no stack matches  '+arg); } else { push('> '+arg+'  ('+list.length+')'); list.forEach(function(l,i){ push('  '+(i+1)+'. '+(l.title||l.url)+(isTagPage(l.url)?'  [tag page]':'')); }); } } flush(); return; }
  else if(cmd==='openall'){ var raw=arg||''; var force=/[!]/.test(raw); var q=raw.replace(/[!]/g,'').trim().toLowerCase(); var list=state.links.filter(function(l){ var c=(l.coll||'').toLowerCase(); return _inLot(l)&&(c===q || c.indexOf(q)>=0); }); if(!list.length){ push('> no stack matches  '+q); flush(); return; } if(list.length>8 && !force){ push('> '+list.length+' links in  '+q+'  —  type  openall '+q+' !  to open them all'); flush(); return; } list.forEach(function(l){ if(E&&E.shellOpen)E.shellOpen(l.url); else try{window.open(l.url,'_blank');}catch(_){} }); push('> opened '+list.length+' links from  '+q); flush(); return; }
  else if(cmd==='parklist'){ var clip=(E&&E.clipRead)?await E.clipRead():''; var bl=_parkBulk(clip); if(bl.n===0){ push('> clipboard has no links to import — copy a OneTab export or a list of URLs first'); } else { push('> imported '+bl.added+' links ('+bl.dup+' dupes skipped) into '+bl.stacks+' stack(s)'); celebrate(); } renderView(); flush(); return; }
  else if(cmd==='stackmin'){ var n=parseInt(arg,10); if(!arg||isNaN(n)||n<1){ push('> usage: stackmin <n>  (stacks form at n+ links; now '+((state.settings&&state.settings.stackMin)||3)+')'); } else { if(!state.settings)state.settings={}; state.settings.stackMin=n; saveState(); push('> stacks now form at '+n+'+ links'); renderView(); } flush(); return; }
  else if(cmd==='extension'||cmd==='ext'||cmd==='bookmarklet'||cmd==='bm'){ var sub=(arg||'').trim().toLowerCase(); if(sub==='open'&&E&&E.extOpen){ E.extOpen(); push('> opening extension folder...'); flush(); return; } push('> S.I.R Quick Save extension — one-click save, zero prompts'); push(''); push('> 1. type  ext open  (opens the extension folder for you)'); push('> 2. open  opera://extensions  (or chrome://extensions)'); push('> 3. enable  Developer mode  (top-right toggle)'); push('> 4. click  Load unpacked'); push('> 5. select that folder'); push(''); push('> done — toolbar icon + right-click "Save to S.I.R" on any page'); if(E&&E.extDir){ E.extDir().then(function(p){ push(''); push('> folder location: '+p); }); } flush(); return; }
  else { push("> unknown command: "+cmd+"  -  type  help"); flush(); return; }
}
function parseCommand(line){ const m=line.match(/^(\S+)\s*([\s\S]*)$/); if(!m)return {cmd:line.trim(),arg:""}; let arg=(m[2]||"").trim(); if(arg.length>=2&&arg[0]==='"'&&arg[arg.length-1]==='"')arg=arg.slice(1,-1); return {cmd:m[1],arg:arg}; }
function pushRaw(message,meta,silent){ const e={id:uid(),ts:nowMs(),level:"raw",message:String(message),raw:true}; if(meta)e.meta=meta; state.console.unshift(e); if(state.console.length>500)state.console.length=500; saveState(); if(!silent)renderTermBody(); }
let scanActive=false, currentScanId=null; const pendingScans={};
if(E){ if(E.onFsChunk)E.onFsChunk(p=>{ const pend=pendingScans[p.id]; if(!pend)return; (p.items||[]).forEach(it=>{ pend.found++; pushRaw("> "+it.name,{openPath:it.path},true); }); renderTermBody(); }); if(E.onFsDone)E.onFsDone(p=>{ const pend=pendingScans[p.id]; if(pend){ pushRaw("> done - "+pend.found+" folder(s)"+(p.truncated?"   (truncated: narrow the query or raise  depth)":""),null,false); delete pendingScans[p.id]; } scanActive=false; currentScanId=null; renderTermBody(); }); }

function formatOpenTime(milliseconds){
  const total=Math.max(0,Math.floor(Number(milliseconds||0)/1000));
  return String(Math.floor(total/3600)).padStart(2,"0")+":"+String(Math.floor(total%3600/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}
function currentSessionMs(){return Math.max(0,Date.now()-APP_OPENED_AT);}
function commitOpenTime(schedule){if(!state.settings)state.settings={};state.settings.totalOpenMs=TOTAL_OPEN_BASE+currentSessionMs();if(schedule)saveState();}
function tickClock(){
  const session=currentSessionMs(),uptime=$("#uptime"),clock=$("#clock");
  if(uptime)uptime.textContent="SESSION "+formatOpenTime(session);
  if(clock)clock.textContent="TOTAL "+formatOpenTime(TOTAL_OPEN_BASE+session);
}
setInterval(tickClock,1000);
setInterval(function(){commitOpenTime(true);},60000);
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
  const configuredHotkeys=currentHotkeys();paintHotkeyLabels();try{if(E&&E.hotkeysUpdate)await E.hotkeysUpdate(configuredHotkeys);}catch(_){}
  initGlobalSearchWorker();
  const migratedYouTube=await migrateExistingYouTubeLinks();
  if(state.settings&&state.settings.petAutoUndock){ setFloating(true); }
  const runIdle=function(task){if(typeof requestIdleCallback==="function")requestIdleCallback(task,{timeout:1600});else setTimeout(task,80);};
  try{ if(E&&E.appVersion){ const v=await E.appVersion(); if(v) APP_VERSION=String(v).replace(/^v/i,""); } }catch(_){}
  const av=$('#appver'); if(av)av.textContent='v'+APP_VERSION;
  const ae=$("#appedits"); if(ae)ae.textContent="#"+EDIT_COUNT+" edits";
  initPageCounter(); renderNav(); renderView(); renderTermBody(); tickClock();
  { const ng=$("#normaGif"); const nd=(NORMA_EMBED&&NORMA_EMBED.indexOf("data:")===0)?NORMA_EMBED:""; if(ng&&nd)ng.src=nd; }
  runIdle(loadArt);
  if(E&&E.onNormaDock)E.onNormaDock(()=>setFloating(false));
  if(E&&E.onNormaNav)E.onNormaNav(m=>{ if(offlineMode)setOfflineMode(false);currentView=m; $("#content").classList.remove("searching"); searchTerms={}; renderNav(); renderView(); });
  if(E&&E.onRecordRecentFolder) E.onRecordRecentFolder(function(info){ if(info&&info.path) rememberFolder(info.path, info.name); });
  if(E&&E.onRecentFolders) E.onRecentFolders(function(){ if(currentView==="folders") renderView(); });
if(enforcePetPinCap()) toast("Pet recents only holds 3 pins — extra pins were released","warn");
  if(state.settings&&state.settings.killAt&&state.settings.killAt>Date.now()){ _killAt=state.settings.killAt; killPaint(); }
  try{ if(E&&E.killStatus){ const ks=await E.killStatus(); if(ks){ _killAt=(ks.armed)?(ks.at||0):0; if(!state.settings) state.settings={}; state.settings.killAt=_killAt; saveState(); killPaint(); } } }catch(_){}
  ["mousemove","keydown","pointerdown","wheel","click"].forEach(function(ev){ document.addEventListener(ev, shotIdleKick, {passive:true}); });
  shotIdleKick();
  if(E&&E.onAppFocus) E.onAppFocus(function(){ shotSlideshowStop(); });
  try{ syncPetRecents(); }catch(_){}
  log("info","S.I.R ready (v"+APP_VERSION+", "+EDIT_COUNT+" edits).");
  if(migratedYouTube)toast("Moved "+migratedYouTube+" existing YouTube link"+(migratedYouTube===1?"":"s")+" to YouTube","ok");
})();
