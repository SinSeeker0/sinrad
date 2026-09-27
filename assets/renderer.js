"use strict";
function removeNativeHoverText(root){
  if(!root)return;if(root.nodeType===1&&root.hasAttribute("title"))root.removeAttribute("title");
  if(root.querySelectorAll)root.querySelectorAll("[title]").forEach(function(node){node.removeAttribute("title");});
}
removeNativeHoverText(document);
new MutationObserver(function(changes){changes.forEach(function(change){if(change.type==="attributes")change.target.removeAttribute("title");else change.addedNodes.forEach(removeNativeHoverText);});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["title"]});
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
  item.innerHTML='<span class="ut-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/></svg></span><span class="ut-copy"><b>Update available</b><small></small></span><button data-action="update-open">View update <b>→</b></button>';
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
  if(!r.available){ updState=null;const old=$("#update-toast");if(old)old.remove();if(silent)return; if(t)t.textContent="You are up to date"; if(v)v.textContent="v"+r.current; if(d)d.textContent=""; if(n)n.textContent="Latest on GitHub is v"+(r.latest||r.current)+" — you're on it."; if(go){go.style.display="none";} if(lat){lat.style.display="";lat.textContent="Close";} showUpdateModal(); return; }
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
    if(!res||!res.temp)throw Error(res&&res.error||"No newer update is ready");
    setUpdProgress(true,100); const pctEl=$("#um-pct"); if(pctEl) pctEl.textContent="100%";
    updState=Object.assign({},r,{temp:true});
    if(go){go.disabled=false; go.textContent="Install & relaunch";} if(lat)lat.disabled=false;
    toast("Download complete","ok");doInstall();
  }).catch(function(e){ setUpdProgress(false); toast("Download failed: "+(e&&e.message||e),"err"); if(go)go.disabled=false; if(lat)lat.disabled=false; });
}
async function doInstall(){
  if(!E||!E.updateInstall){ toast("Install needs the desktop build","warn"); return; }
  const go=$("#um-go"); if(go){go.disabled=true; go.textContent="Installing…";}
  try{if(!await flushSave())throw Error("Your changes could not be saved. Try again.");const res=await E.updateInstall();if(!res||!res.ok)throw Error(res&&res.error||"The installer could not start");const old=$("#update-toast");if(old)old.remove();hideUpdateModal();toast("Installing update — SINRAD will reopen","ok");}catch(e){toast("Install failed: "+(e&&e.message||e),"err");if(go){go.disabled=false;go.textContent="Install & relaunch";}}
}
function autoCheckUpdate(){ if(!E||!E.updateCheck) return; Promise.resolve(E.updateCheck(APP_VERSION)).then(function(r){ if(r&&r.ok) renderUpdateResult(r, true); }).catch(function(){}); }
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
  if(k==='autostart'||k==='startup'||k==='autorun'||k==='login'){ if(!state.settings)state.settings={}; var ca=!!state.settings.autoStart; var na=(v==='on')?true:(v==='off')?false:!ca; if(E&&E.setAutostart){ E.setAutostart(na).then(function(r){var applied=!!(r&&r.enabled);state.settings.autoStart=applied;saveState();push('> auto-start on boot: '+onoff(applied)+(r&&r.ok?'':(' · '+String(r&&r.error||'Windows did not apply the change'))));}).catch(function(error){push('> auto-start unchanged: '+String(error&&error.message||error));}); } else { push('> auto-start needs the desktop app'); } return; }
  if(k==='hotkey'||k==='hotkeys'||k==='hk'){ if(!state.settings)state.settings={}; var ch=!(state.settings.hotkeyEnabled===false); var nh=(v==='on')?true:(v==='off')?false:!ch; state.settings.hotkeyEnabled=nh; saveState(); push('> hotkey ('+currentHotkeys().quickSave+'): '+onoff(nh)); if(E&&E.hotkeyToggle){ E.hotkeyToggle(nh).catch(function(){}); } return; }
  if(k==="pet"||k==="norma"||k==="petundock"){ if(!state.settings)state.settings={}; var cp=!!state.settings.petAutoUndock; var np=(v==="on")?true:(v==="off")?false:!cp; state.settings.petAutoUndock=np; saveState(); push("> pet auto-undock on boot: "+onoff(np)); return; }
  push('> usage: '+state.radCmd+' set <name>  toggles · names: autostart, hotkey, intro, hidden, autoscroll, click, pet   (add on|off to force)');
}
let STORE_MODE="Memory";
const EDIT_COUNT = 299;
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
let currentView="home";
let deckMenuId="",deckSettingsId="",deckSourceId="",deckDragKey="",timelineSavedPosition=null;
let offlineMode=false,offlineTab="history",offlineFilter="history",offlineQuery="",offlineSelectedId="",offlineBrowseIds=[],offlineReturnAnchor=null,offlineLoading=false,offlineSyncing=false;
let offlineSourceBrowse="",offlineReturnToTimeline=false;
let offlineTimelineQuietUntil=0;
let offlineData={settings:{collectionPaused:false,retentionDays:30,maxItems:2000,historyCleanupMode:"age",historyRetentionHours:168,historyStorageMB:1024,freshnessDays:1,feedLayout:"cards"},sources:[],items:[],updatedAt:0,storagePath:"",storage:{bytes:0,files:0},sync:{active:false,queued:false}},offlineDataReady=false;
let offlineExtension={connected:false,lastSeen:0,version:"",method:"browser-extension"};
const offlineMediaCache=new Map();
function rememberMedia(cache,key,value,limit){if(cache.has(key))cache.delete(key);cache.set(key,value);while(cache.size>limit||Array.from(cache.values()).reduce((n,v)=>n+v.length*2,0)>48*1024*1024)cache.delete(cache.keys().next().value);}
let monitoringMode=false,monitoringTab="activity",monitoringFilter="all",monitoringQuery="",monitoringLoading=false,monitoringSyncing=false,monitoringFocusId="",monitoringDetail=null,monitoringDetailLoading=false,monitoringDetailRequest=0,monitoringPostSequence=[],monitoringArtist=null,monitoringArtistLoading=false,monitoringArtistRequest=0,monitoringArtistRange={monitorId:"",from:"",to:""},monitoringDatePicker={side:"",level:"year",year:0,month:-1},monitoringReturnScroll=0,monitoringReturnId="",monitoringReturnAnchor=null,monitoringArtistReturnAnchor=null;
let monitoringCollectionMenuPost=null;
let monitoringData={settings:{notifications:true,defaultIntervalMinutes:1440,retentionDays:90,maxEvents:2000,downloadFolder:""},monitors:[],events:[],updatedAt:0},monitoringDataReady=false;
const monitoringMediaCache=new Map();
let timelineMonitoringShuffleSeed=Math.random().toString(36).slice(2);
let compressionPreset="ultra",compressionSource="",compressionSummary=null,compressionBusy=false,compressionZipBusy=false,compressionProgress={active:false},compressionHistory=[],compressionSettings={outputFolder:""};
let searchTerms={};
let vaultFilter="all", folderFilter="all", ideaFilter="all", ideaGroupFilter="all", ideaPane="import", ideaViewingId="", ideaReturnAnchor=null, ideaImportText="", ideaImportPreview=[], ideaImportMedia=[], ideaEditMedia=[];
let linkCats=[], linkFav=false, linkDrill=null, folderCats=[]; let shotFilter="inbox", shotOpenId=null;
const appNavigationBackStack=[],appNavigationForwardStack=[];
let appNavigationRestoring=false;
function appNavigationSnapshot(){const content=$("#content");return {currentView:currentView,offlineMode:offlineMode,offlineTab:offlineTab,offlineFilter:offlineFilter,offlineSourceBrowse:offlineSourceBrowse,offlineSelectedId:offlineSelectedId,offlineBrowseIds:offlineBrowseIds.slice(),monitoringMode:monitoringMode,monitoringTab:monitoringTab,monitoringFilter:monitoringFilter,monitoringDetail:monitoringDetail,monitoringArtist:monitoringArtist,monitoringPostSequence:monitoringPostSequence.slice(),ideaPane:ideaPane,ideaViewingId:ideaViewingId,linkDrill:linkDrill,scrollTop:content?content.scrollTop:0};}
function appNavigationKey(item){return JSON.stringify([item.currentView,item.offlineMode,item.offlineTab,item.offlineSourceBrowse,item.offlineSelectedId,item.monitoringMode,item.monitoringTab,item.monitoringFilter,item.monitoringDetail&&item.monitoringDetail.postId,item.monitoringArtist&&item.monitoringArtist.monitorId,item.ideaPane,item.ideaViewingId,item.linkDrill]);}
function updateAppNavigationButtons(){const back=$("#appBackButton"),forward=$("#appForwardButton");if(back)back.disabled=!appNavigationBackStack.length;if(forward)forward.disabled=!appNavigationForwardStack.length;}
function rememberAppNavigation(){if(appNavigationRestoring)return;const snapshot=appNavigationSnapshot(),last=appNavigationBackStack[appNavigationBackStack.length-1];if(!last||appNavigationKey(last)!==appNavigationKey(snapshot)){appNavigationBackStack.push(snapshot);if(appNavigationBackStack.length>80)appNavigationBackStack.shift();}appNavigationForwardStack.length=0;updateAppNavigationButtons();}
function restoreAppNavigation(snapshot){if(!snapshot)return;appNavigationRestoring=true;currentView=snapshot.currentView;offlineMode=!!snapshot.offlineMode;offlineTab=snapshot.offlineTab;offlineFilter=snapshot.offlineFilter;offlineSourceBrowse=snapshot.offlineSourceBrowse;offlineSelectedId=snapshot.offlineSelectedId;offlineBrowseIds=snapshot.offlineBrowseIds||[];monitoringMode=!!snapshot.monitoringMode;monitoringTab=snapshot.monitoringTab;monitoringFilter=snapshot.monitoringFilter;monitoringDetail=snapshot.monitoringDetail;monitoringArtist=snapshot.monitoringArtist;monitoringPostSequence=snapshot.monitoringPostSequence||[];ideaPane=snapshot.ideaPane;ideaViewingId=snapshot.ideaViewingId;linkDrill=snapshot.linkDrill;monitoringDetailLoading=false;monitoringArtistLoading=false;document.querySelector(".deck-preview-overlay")?.remove();const win=$("#window");if(win){win.classList.toggle("offline-mode",offlineMode);win.classList.toggle("monitoring-mode",monitoringMode);}renderNav();renderView();requestAnimationFrame(function(){const content=$("#content");if(content)content.scrollTop=Number(snapshot.scrollTop)||0;appNavigationRestoring=false;updateAppNavigationButtons();});}
function navigateAppHistory(direction){const source=direction<0?appNavigationBackStack:appNavigationForwardStack,target=direction<0?appNavigationForwardStack:appNavigationBackStack;if(!source.length)return;target.push(appNavigationSnapshot());restoreAppNavigation(source.pop());updateAppNavigationButtons();}
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
  {id:"home",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></svg>',name:"Home",sub:"Your deck"},
  {id:"vault",ico:ICO_LOCK,name:"Vault",sub:"Passwords"},
  {id:"links",ico:ICO_LINK,name:"Links",sub:"Saved links"},
  {id:"lot",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/></svg>',name:"Parking Lot",sub:"Parked stacks"},
  {id:"folders",ico:ICO_FOLDER,name:"Folders",sub:"Quick access"},
  {id:"shots",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="#27b4ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>',name:"Screenies",sub:"Inbox"},
  {id:"ideas",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="#d7ac45" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.2 14.5A7 7 0 1 1 15.8 14.5C14.6 15.4 14 16.3 14 18h-4c0-1.7-.6-2.6-1.8-3.5z"/></svg>',name:"Ideas",sub:"Build notes"},
  {id:"compress",ico:'<svg viewBox="0 0 24 24" fill="none" stroke="#d7ac45" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v6H3"/><path d="m3 9 6-6"/><path d="M16 21v-6h5"/><path d="m21 15-6 6"/><rect x="8" y="8" width="8" height="8"/></svg>',name:"Compress",sub:"Videos & folders"},
];

function defaultState(){ return { vault:[], links:[], folders:[], ideas:[], console:[], radCmd:"rad", scanRoots:[], scanDepth:4, scanSkipHidden:true, petRecents:[], petPins:[], shots:[], shotWatch:[], shotCollections:null, settings:{timelineDeck:[]}}; }
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
  return JSON.parse(JSON.stringify({vault:state.vault||[],links:state.links||[],folders:state.folders||[],ideas:state.ideas||[],shots:state.shots||[],categories:state.categories||{},folderCategories:state.folderCategories||{},shotCollections:state.shotCollections||{},linkRules:(state.settings&&state.settings.linkRules)||[]}));
}
function rememberUndo(label){undoStack.push({label:String(label||"Changed data"),at:Date.now(),data:undoSnapshot()});if(undoStack.length>20)undoStack.shift();}
function rememberOfflineUndo(label,token){if(!token)return;undoStack.push({label:String(label||"Deleted Clipping post"),at:Date.now(),kind:"offline",token:String(token)});if(undoStack.length>20)undoStack.shift();}
function restoreUndoSnapshot(data){state.vault=data.vault||[];state.links=data.links||[];state.folders=data.folders||[];state.ideas=data.ideas||[];state.shots=data.shots||[];state.categories=data.categories||{};state.folderCategories=data.folderCategories||{};state.shotCollections=data.shotCollections||{};if(!state.settings)state.settings={};state.settings.linkRules=data.linkRules||[];refreshCatColors();refreshFolderCats();}
async function undoLastChange(){const entry=undoStack.pop();if(!entry){toast("Nothing to undo yet","warn");return false;}const anchor=captureListPosition();if(entry.kind==="offline"){const result=E&&E.offlineItemRestore?await E.offlineItemRestore(entry.token):null;if(!result||!result.ok){toast(result&&result.error||"That Clipping undo is no longer available","err");return false;}await loadOfflineData(anchor);toast("Undid: "+entry.label,"ok");return true;}const current=undoSnapshot();restoreUndoSnapshot(entry.data);const saved=await flushSave();if(!saved){restoreUndoSnapshot(current);toast("Undo could not be saved","err");return false;}renderViewAnchored(anchor,false);renderTermBody();toast("Undid: "+entry.label,"ok");return true;}
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

let sidebarMore=false;
function shellNavButton(action,id,label,icon,active){
  const disclosure=action==="shell-more";
  return '<button type="button" class="nav-item shell-nav-item '+(active?'active':'')+'" data-action="'+action+'" aria-label="'+label+'" title="'+label+'"'+(id?' data-nav="'+id+'" data-id="'+id+'"':'')+(active?' aria-current="page"':'')+(disclosure?' aria-expanded="'+sidebarMore+'" aria-controls="shellMorePanel"':'')+'><span class="nav-ico" aria-hidden="true">'+icon+'</span><span class="nav-txt"><b>'+label+'</b></span>'+(disclosure?'<span class="shell-disclosure" aria-hidden="true">'+(sidebarMore?'−':'+')+'</span>':'')+'</button>';
}
function renderNav(){
  const home=MODULES.find(function(item){return item.id==="home"}),links=MODULES.find(function(item){return item.id==="links"}),folders=MODULES.find(function(item){return item.id==="folders"}),ideas=MODULES.find(function(item){return item.id==="ideas"});
  const bell='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',clip='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 12 6-6a4 4 0 0 1 6 6l-8 8a7 7 0 0 1-10-10l8-8"/></svg>',search='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',more='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>',gear='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.5 6A8 8 0 0 0 9 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 10.5 18l.2 2.6h4L15 18a8 8 0 0 0 1.5-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/></svg>';
  const extra=MODULES.filter(function(item){return ["vault","lot","shots","compress"].includes(item.id);}).map(function(item){return shellNavButton("nav",item.id,item.name,item.ico,!offlineMode&&!monitoringMode&&currentView===item.id);}).join("");
  $("#nav").innerHTML='<div class="shell-nav-group">'+shellNavButton("nav","home","Timeline",home.ico,!monitoringMode&&(offlineMode?offlineReturnToTimeline:currentView==="home"))+shellNavButton("shell-monitor","","Monitoring",bell,monitoringMode)+shellNavButton("shell-clip","","Clipping",clip,offlineMode&&!offlineReturnToTimeline)+shellNavButton("nav","folders","Folders",folders.ico,!offlineMode&&!monitoringMode&&currentView==="folders")+'</div><div class="shell-nav-separator"></div><div class="shell-nav-group">'+shellNavButton("nav","links","Links",links.ico,!offlineMode&&!monitoringMode&&currentView==="links")+shellNavButton("nav","ideas","Ideas",ideas.ico,!offlineMode&&!monitoringMode&&currentView==="ideas")+'</div><div class="shell-nav-separator"></div><div class="shell-nav-group shell-nav-bottom">'+shellNavButton("shell-more","","More",more,false)+'<div id="shellMorePanel" class="shell-more-panel '+(sidebarMore?'open':'')+'">'+extra+'</div>'+shellNavButton("settings-open","","Settings",gear,false)+'</div>';
}
let globalSearchItems=[],globalSearchActive=-1;
let _globalWorker=null,_globalRevision=0,_globalIndexedRevision=-1,_globalIndexingRevision=-1,_globalQueryId=0,_globalQueuedQuery=null,_globalIndexTimer=null;
const GLOBAL_SEARCH_COLORS={Vault:"#ff79c6",Links:"#27b4ff","Parking Lot":"#f5a623",Folders:"#33d17a",Screenies:"#7c5cff",Ideas:"#d7ac45"};
function globalSearchSnapshot(){
  return {
    vault:(state.vault||[]).map(function(v){return {id:v.id,name:v.name,url:v.url,username:v.username,created:v.created};}),
    links:(state.links||[]).map(function(l){return {id:l.id,title:l.title,url:l.url,note:l.note,category:l.category,categories:l.categories,src:l.src,inLinks:l.inLinks,created:l.created};}),
    folders:(state.folders||[]).map(function(f){return {id:f.id,name:f.name,path:f.path,category:f.category,created:f.created};}),
    ideas:(state.ideas||[]).map(function(i){return {id:i.id,title:i.title,details:i.details,original:i.original,references:i.references,type:i.type,status:i.status,group:i.group,attachments:i.attachments,importKey:i.importKey,reviewNote:i.reviewNote,reviewedAt:i.reviewedAt,created:i.created,updated:i.updated};}),
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
  panel.innerHTML=["Vault","Links","Parking Lot","Folders","Screenies","Ideas"].filter(function(kind){return groups[kind]&&groups[kind].length;}).map(function(kind){return '<div class="gs-group">'+esc(kind)+'</div>'+groups[kind].map(function(entry){const item=entry.item,color=GLOBAL_SEARCH_COLORS[kind]||"#27b4ff";return '<button type="button" class="gs-result" role="option" data-action="global-result" data-index="'+entry.index+'" style="--gs-color:'+color+'"><span class="gs-dot"></span><span class="gs-copy"><b>'+esc(item.title)+'</b><small>'+esc(item.detail||"")+'</small></span><span class="gs-kind">'+esc(kind)+'</span></button>';}).join("");}).join("");
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
function closeGlobalSearch(clear){const panel=$("#globalSearchResults"),input=$("#globalSearchInput"),box=$("#globalSearch");_globalQueryId++;_globalQueuedQuery=null;if(panel){panel.classList.remove("show");panel.innerHTML="";}if(box)box.classList.remove("shell-open");globalSearchItems=[];globalSearchActive=-1;if(clear&&input)input.value="";}
function paintGlobalSearchActive(){document.querySelectorAll(".gs-result").forEach(function(row,index){row.classList.toggle("active",index===globalSearchActive);if(index===globalSearchActive)row.scrollIntoView({block:"nearest"});});}
function renderGlobalSearch(){
  const input=$("#globalSearchInput"),panel=$("#globalSearchResults");if(!input||!panel)return;
  const query=input.value.trim();globalSearchActive=-1;
  if(!query){_globalQueryId++;_globalQueuedQuery=null;globalSearchItems=[];panel.classList.remove("show");panel.innerHTML="";return;}
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

function timelineItems(){return offlineMixSources((offlineData.items||[]).filter(item=>!item.read||Number(item.historyAt)>Date.now()));}
const TIMELINE_MODULES={reddit:"Clipping",notifications:"Notifications",channels:"Channels",favorites:"Favorites",history:"History",monitoring:"Monitoring",downloads:"Downloads",compression:"Compression",activity:"Clipping activity",ideas:"Ideas",links:"Links",reminders:"Reminders"};
const TIMELINE_DEFAULT_COLUMN_WIDTH=450;
function timelineDeck(){
  if(!state.settings)state.settings={};let deck=Array.isArray(state.settings.timelineDeck)?state.settings.timelineDeck:[];
  deck=deck.filter(function(item){return item&&TIMELINE_MODULES[item.id];}).map(function(item,index){return {key:String(item.key||"deck-"+item.id+"-"+index),id:item.id,width:Math.max(280,Math.min(900,Number(item.width)||({narrow:300,medium:450,wide:600}[item.size])||TIMELINE_DEFAULT_COLUMN_WIDTH)),autoWidth:item.autoWidth!==false,stack:index>0&&item.stack===true,source:String(item.source||""),configured:item.configured!==false};});
  if(deck[0])deck[0].stack=false;state.settings.timelineDeck=deck;return deck;
}
function captureTimelinePosition(){const workspace=document.querySelector(".deck-workspace");if(!workspace)return timelineSavedPosition;const columns={};workspace.querySelectorAll(".deck-column[data-deck-key]").forEach(function(column){const scroller=column.querySelector(".deck-column-scroll");columns[column.dataset.deckKey]={top:scroller?scroller.scrollTop:0};});timelineSavedPosition={left:workspace.scrollLeft,columns:columns};return timelineSavedPosition;}
function restoreTimelinePosition(position){
  if(!position)return;
  const revision=viewRenderRevision;
  const apply=function(){
    if(revision!==viewRenderRevision)return;
    const workspace=document.querySelector(".deck-workspace");if(!workspace)return;
    workspace.scrollLeft=position.left||0;
    const anchor=position.anchorKey&&document.querySelector('.deck-column[data-deck-key="'+CSS.escape(position.anchorKey)+'"]');
    if(anchor){const delta=anchor.getBoundingClientRect().left-workspace.getBoundingClientRect().left-(position.anchorOffset||0);workspace.scrollLeft+=delta;}
    document.querySelectorAll(".deck-column[data-deck-key]").forEach(function(column){
      const scroller=column.querySelector(".deck-column-scroll"),saved=position.columns&&position.columns[column.dataset.deckKey];if(!scroller||saved==null)return;
      const record=typeof saved==="number"?{top:saved}:saved;scroller.scrollTop=record.top||0;
      if(record.id){const row=Array.from(scroller.querySelectorAll("[data-id]")).find(function(node){return node.dataset.id===record.id;});if(row)scroller.scrollTop+=row.getBoundingClientRect().top-scroller.getBoundingClientRect().top-(record.offset||0);}
    });
  };
  apply();
}
function rememberTimelinePosition(){timelineSavedPosition=captureTimelinePosition();}
function closeTimelinePreview(){const overlay=document.querySelector(".deck-preview-overlay");if(!overlay)return false;overlay.remove();monitoringDetail=null;restoreTimelinePosition(timelineSavedPosition);return true;}
async function openTimelineMonitoringPreview(id){const item=monitoringEvent(id);if(!item)return;rememberTimelinePosition();if(item.kind!=="pawchive"||!E||!E.monitoringPostDetail){if(item.url)openTarget(item.url,"url");return;}const overlay=document.createElement("div");overlay.className="deck-preview-overlay";overlay.innerHTML='<button class="deck-preview-backdrop" data-action="deck-preview-close" aria-label="Close preview"></button><section class="deck-preview-panel"><div class="deck-preview-loading">Loading post…</div></section>';document.body.appendChild(overlay);if((!item.read||!item.readAt)&&E.monitoringEventUpdate){item.read=true;item.readAt=Date.now();E.monitoringEventUpdate(id,{read:true}).catch(function(){});}const result=await E.monitoringPostDetail(id);if(!overlay.isConnected)return;if(!result||!result.ok){overlay.remove();toast(result&&result.error||"Could not open that post","err");return;}monitoringDetail=result.detail;overlay.querySelector(".deck-preview-panel").innerHTML=viewMonitoringDetail(monitoringDetail,false);hydrateMonitoringDetailMedia();}
function timelineEmpty(text){return '<div class="deck-empty">'+esc(text)+'</div>';}
function timelineSmallRows(items,kind){return items.length?'<div class="deck-rows">'+items.slice(0,20).map(function(item){const rowKind=kind==="activity"?(item.kind||"activity"):kind,title=item.title||item.name||item.label||"Activity",meta=rowKind==="link"?(item.url||""):offlineDate(item.date||item.updated||item.created||item.downloadedAt||Date.now());return '<button type="button" class="deck-row" data-action="deck-row-open" data-kind="'+rowKind+'" data-id="'+esc(item.id)+'"><b>'+esc(title)+'</b><small>'+esc(meta)+'</small></button>';}).join("")+'</div>':timelineEmpty("Nothing here yet.");}
function timelineActivityRows(){
  const rows=[];(monitoringData.events||[]).forEach(function(item){rows.push({id:item.id,title:item.title||"Monitoring discovery",date:item.date,kind:"monitor",read:item.read,icon:"◉",summary:(monitoringMonitor(item.monitorId)||{}).label||item.kind});});
  (offlineData.items||[]).forEach(function(item){rows.push({id:item.id,title:"Saved clipping · "+(item.title||offlineSourceName(item)),date:item.downloadedAt,kind:"offline",read:item.read,icon:"↓",summary:offlineSourceName(item)});});
  (compressionHistory||[]).forEach(function(item){rows.push({id:item.id,title:(item.name||"File")+" finished compressing",date:item.finishedAt,kind:"compress",read:true,icon:"↘",summary:offlineBytes(item.inputBytes)+" → "+offlineBytes(item.outputBytes)});});
  (state.links||[]).forEach(function(item){rows.push({id:item.id,title:"Saved link · "+(item.title||item.url),date:item.created||item.added||0,kind:"link"});});
  return rows.sort(function(a,b){return Number(b.date)-Number(a.date);});
}
function timelineNotificationRows(){const rows=timelineActivityRows();return rows.length?'<div class="deck-notifications">'+rows.slice(0,30).map(function(item){return '<button class="deck-notification '+(item.read?'':'fresh')+'" data-action="deck-row-open" data-kind="'+item.kind+'" data-id="'+esc(item.id)+'"><i>'+esc(item.icon||"•")+'</i><span><b>'+esc(item.title)+'</b><small>'+esc(item.summary||"")+'</small></span><time>'+esc(offlineDate(item.date))+'</time></button>';}).join('')+'</div>':timelineEmpty("Activity will appear here automatically.");}
const timelineFeedSnapshots=new Map();
function monitoringInboxEvent(event){return !!event&&event.kind==="pawchive";}
function monitoringNewestRows(items){return items.slice().sort(function(a,b){return Number(b.date||0)-Number(a.date||0)||Number(b.discoveredAt||0)-Number(a.discoveredAt||0);});}
function timelineLiveFeedRows(config){
  if(config.id==="reddit")return timelineItems().filter(function(item){return !config.source||offlineGroupKey(item)===config.source.toLowerCase();});
  if(config.id==="monitoring")return (monitoringData.events||[]).filter(function(event){const monitor=monitoringMonitor(event.monitorId),source=config.source;return !source||(source==="inbox"&&monitoringInboxEvent(event))||(source==="pawchive"&&event.kind==="pawchive")||event.monitorId===source||(monitor&&String(monitor.label).toLowerCase()===source.toLowerCase());});
  return [];
}
function timelineFeedSnapshot(config){
  const signature=config.id+"|"+(config.source||"")+"|"+(config.configured===false?"0":"1");let snapshot=timelineFeedSnapshots.get(config.key);
  if(!snapshot||snapshot.signature!==signature){const live=timelineLiveFeedRows(config);snapshot={signature:signature,kind:config.id,rows:config.id==="monitoring"?(config.source==="inbox"?monitoringNewestRows(live):timelineShuffledRows(live)):live.slice(),pending:[]};timelineFeedSnapshots.set(config.key,snapshot);}
  const current=timelineLiveFeedRows(config);if(!snapshot.rows.length&&!snapshot.pending.length&&current.length)snapshot.rows=config.id==="monitoring"?(config.source==="inbox"?monitoringNewestRows(current):timelineShuffledRows(current)):current.slice();return snapshot;
}
function timelinePendingMarkup(config,snapshot){const count=snapshot&&snapshot.pending.length||0;return count?'<button class="deck-new-posts" data-action="deck-load-pending" data-id="'+esc(config.key)+'">↑ '+count+' new post'+(count===1?'':'s')+'</button>':'';}
function stageTimelineFeedUpdates(kind){
 timelineDeck().filter(config=>config.id===kind&&config.configured!==false).forEach(config=>{const snapshot=timelineFeedSnapshots.get(config.key);if(!snapshot)return;const known=new Set(snapshot.rows.concat(snapshot.pending).map(item=>item.id));timelineLiveFeedRows(config).forEach(item=>{if(!known.has(item.id)){snapshot.pending.push(item);known.add(item.id);}});const column=document.querySelector('[data-deck-key="'+CSS.escape(config.key)+'"]'),old=column?.querySelector('.deck-new-posts');if(snapshot.pending.length){const text='↑ '+snapshot.pending.length+' new post'+(snapshot.pending.length===1?'':'s');if(old)old.textContent=text;else if(column)column.insertAdjacentHTML('beforeend',timelinePendingMarkup(config,snapshot));}});
}
function refreshTimelineLightColumns(){["notifications","activity","channels","downloads"].forEach(function(id){document.querySelectorAll('.deck-column[data-deck-id="'+id+'"] .deck-column-scroll').forEach(function(node){const column=node.closest('.deck-column'),config=timelineDeck().find(function(item){return item.key===column.dataset.deckKey;});if(config){const html=timelineColumnBody(config);if(node._markup!==html){const top=node.scrollTop;node.innerHTML=html;node._markup=html;node.scrollTop=top;}}});});}
function timelineShuffleValue(value){let hash=2166136261,text=timelineMonitoringShuffleSeed+String(value||"");for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
function timelineShuffledRows(items){const original=items.slice(),rows=items.slice().sort(function(a,b){return timelineShuffleValue(a.id)-timelineShuffleValue(b.id);});if(rows.length>1&&rows.every(function(item,index){return item===original[index];}))rows.push(rows.shift());return rows;}
function refreshTimelineMonitoringShuffle(){timelineMonitoringShuffleSeed=Math.random().toString(36).slice(2);timelineDeck().filter(function(config){return config.id==="monitoring"&&config.source!=="inbox";}).forEach(function(config){const snapshot=timelineFeedSnapshots.get(config.key);if(!snapshot)return;snapshot.rows=timelineShuffledRows(snapshot.rows);const column=document.querySelector('[data-deck-key="'+CSS.escape(config.key)+'"]'),scroller=column&&column.querySelector(".deck-column-scroll");if(scroller){const top=scroller.scrollTop;scroller.innerHTML=timelineMonitoringRows(config,snapshot.rows);scroller.scrollTop=top;}});hydrateMonitoringMedia();}
setInterval(refreshTimelineMonitoringShuffle,2*60*60*1000);
function timelineMonitoringRows(config,providedRows){
  const rows=providedRows||(config.source==="inbox"?monitoringNewestRows(timelineLiveFeedRows(config)):timelineShuffledRows(timelineLiveFeedRows(config))),focused=config.source&&config.source!=="pawchive"&&config.source!=="inbox";
  const page=Math.min(monitoringFeedPages.get("deck:"+config.key)||0,Math.max(0,Math.ceil(rows.length/60)-1));
  const pager=monitoringFeedPager(page,Math.ceil(rows.length/60),"deck-monitor-page",config.key);
  return rows.length?'<div class="deck-monitoring-posts">'+pager+rows.slice(page*60,(page+1)*60).map(function(item){
    const monitor=monitoringMonitor(item.monitorId),privateLabel=monitoringPrivateText((monitor&&monitor.label)||item.kind,item.monitorId),privateTitle=monitoringPrivateText(item.title,item.id+":title"),privateSummary=monitoringPrivateText(item.summary,item.id+":summary"),refs=(item.mediaRefs||[]).concat(item.mediaRef?[item.mediaRef]:[]).filter(function(ref,index,list){return ref&&list.indexOf(ref)===index;}),original=monitoringOriginalMediaTag(item.meta&&item.meta.mediaPath,item.mediaRef,"deck-monitor-media",privateTitle),media=refs.length||original?'<div class="deck-monitor-gallery '+(refs.length>1?'multi':'')+'">'+(original||monitoringMediaTag(refs[0],"deck-monitor-media",privateTitle))+refs.slice(1,4).map(function(ref){return monitoringMediaTag(ref,"deck-monitor-media",privateTitle);}).join('')+'</div>':'',avatar=!focused&&monitor?monitoringMediaTag(monitor.avatarRef,"deck-monitor-avatar",privateLabel):"",identity=focused?monitoringDate(item.date):privateLabel+' · '+monitoringDate(item.date);
    return '<article class="deck-monitor-post" data-action="deck-row-open" data-kind="monitor" data-ctx="monitor-event" data-id="'+esc(item.id)+'">'+media+'<div class="deck-monitor-copy">'+(avatar?'<button type="button" class="deck-monitor-author" data-action="deck-row-open" data-kind="channel" data-id="'+esc(monitor.id)+'" title="Open artist page" aria-label="Open artist page">'+avatar+'<i>'+esc(privateLabel.charAt(0)||"M")+'</i></button>':'')+'<div><b>'+esc(privateTitle)+'</b><small>'+esc(identity)+'</small>'+(privateSummary?'<p>'+esc(privateSummary)+'</p>':'')+'</div></div></article>';
  }).join('')+pager+'</div>':timelineEmpty(config.source==="inbox"?"No new artist posts in Inbox.":"No monitoring discoveries yet.");
}
function timelineColumnBody(config){const id=config.id,source=config.source;
  if(config.configured===false&&(id==="reddit"||id==="monitoring"))return timelineEmpty("Choose a source from the column menu.");
  if(id==="reddit"){const snapshot=timelineFeedSnapshot(config),items=snapshot.rows;return (items.length?items.map(function(item){return offlineFeedCard(item,"deck-open-offline");}).join(""):timelineEmpty(source?"No cached posts from r/"+source+" yet.":"Add subreddits in Clip to start your Home feed."));}
  if(id==="favorites")return timelineSmallRows((offlineData.items||[]).filter(function(item){return item.favorite;}),"offline");
  if(id==="history")return timelineSmallRows((offlineData.items||[]).filter(function(item){return item.read&&Number(item.historyAt)<=Date.now();}),"offline");
  if(id==="notifications")return timelineNotificationRows();
  if(id==="activity")return timelineSmallRows((offlineData.items||[]).slice().sort(function(a,b){return Number(b.downloadedAt)-Number(a.downloadedAt);}),"offline");
  if(id==="monitoring"){const snapshot=timelineFeedSnapshot(config);return timelineMonitoringRows(config,snapshot.rows);}
  if(id==="channels"){const monitors=(monitoringData.monitors||[]).filter(function(item){return item.kind==="pawchive";});return timelineSmallRows(monitors,"channel");}
  if(id==="downloads"){const rows=(monitoringData.downloads||[]).map(item=>({id:item.id,title:item.label+(item.status==="failed"?" · Failed":""),date:item.finishedAt}));if(timelineDownloadProgress?.status==="active")rows.unshift({id:timelineDownloadProgress.id,title:timelineDownloadProgress.label+" · "+timelineDownloadProgress.done+" / "+timelineDownloadProgress.total,date:Date.now()});return timelineSmallRows(rows,"download");}
  if(id==="compression")return compressionProgressHtml()||timelineSmallRows(compressionHistory||[],"compress");
  if(id==="ideas")return timelineSmallRows((state.ideas||[]).filter(function(item){return ideaStatus(item.status)!=="done"&&(!source||ideaType(item.type)===source);}),"idea");
  if(id==="links")return timelineSmallRows((state.links||[]).filter(function(item){return item.inLinks!==false;}),"link");
  if(id==="reminders")return timelineSmallRows((state.ideas||[]).filter(function(item){return /remind|later|follow.?up/i.test((item.title||"")+" "+(item.details||""));}),"idea");
  return timelineEmpty("This module is ready.");
}
function timelineSourceLabel(item){if(item.configured===false)return "Choose source";if(!item.source)return item.id==="reddit"?"Home":item.id==="monitoring"?"All":item.id==="ideas"?"All":"";return item.id==="reddit"?"r/"+item.source:(monitoringMonitor(item.source)&&monitoringMonitor(item.source).label)||item.source.charAt(0).toUpperCase()+item.source.slice(1);}
function timelineSourceMenu(item,index){if(deckSourceId!==item.key)return "";let choices=[];if(item.id==="reddit")choices=[{value:"",label:"Home",group:"CLIPPING"}].concat(offlineSourceGroups().map(function(group){return {value:group.key,label:"r/"+group.label,group:"SUBREDDITS"};}));else if(item.id==="monitoring")choices=[{value:"",label:"All Monitoring",group:"MONITORING"},{value:"inbox",label:"Inbox",group:"MONITORING"},{value:"pawchive",label:"Pawchive",group:"MONITORING"}].concat((monitoringData.monitors||[]).filter(function(monitor){return monitor.kind==="pawchive";}).map(function(monitor){return {value:monitor.id,label:monitor.label,group:"PAWCHIVE ARTISTS"};}));else if(item.id==="ideas")choices=[{value:"",label:"All Ideas"},{value:"problem",label:"Problems"},{value:"feature",label:"Features"},{value:"quick",label:"Quick Changes"},{value:"task",label:"Tasks"}];let group="";return choices.length?'<div class="deck-source-menu">'+choices.map(function(choice){const heading=choice.group&&choice.group!==group?(group=choice.group,'<small>'+esc(choice.group)+'</small>'):'';return heading+'<button data-action="deck-source-set" data-index="'+index+'" data-source="'+esc(choice.value)+'" class="'+(item.configured!==false&&choice.value===item.source?'active':'')+'">'+esc(choice.label)+'</button>';}).join('')+'</div>':"";}
function timelineColumnMenu(item,index,total){const open=deckMenuId===item.key,settings=deckSettingsId===item.key;return '<button class="deck-menu-button" data-action="deck-menu" data-id="'+esc(item.key)+'" aria-expanded="'+open+'" title="Column menu">•••</button>'+(open?'<div class="deck-context-menu"><button data-action="deck-settings" data-id="'+esc(item.key)+'"><span>⚙</span> Column settings</button><button data-action="deck-auto-width" data-index="'+index+'"><span>↔</span> Auto-adjust width <i class="deck-switch '+(item.autoWidth?'on':'')+'"></i></button>'+(timelineSourceChoices(item).length?'<button data-action="deck-source" data-id="'+esc(item.key)+'"><span>⌁</span> Change source / view</button>':'')+'<div class="deck-menu-label">Move</div><button data-action="deck-move" data-direction="-1" data-index="'+index+'"'+(index?'':' disabled')+'><span>←</span> Swap with left column</button><button data-action="deck-move" data-direction="1" data-index="'+index+'"'+(index===total-1?' disabled':'')+'><span>→</span> Swap with right column</button><button data-action="deck-stack-left" data-index="'+index+'"'+(index?'':' disabled')+'><span>▱</span> '+(item.stack?'Unstack column':'Stack on left column')+'</button><button data-action="deck-duplicate" data-index="'+index+'"><span>⧉</span> Duplicate column</button><button class="danger" data-action="deck-remove" data-index="'+index+'"><span>×</span> Remove column</button></div>':'')+(settings?'<div class="deck-local-settings"><b>Exact column width</b><label><input type="number" min="280" max="900" step="10" value="'+item.width+'" data-deck-width="'+index+'"><span>px</span></label><small>Default: 450 px · Used exactly when Auto-adjust width is off.</small></div>':'')+timelineSourceMenu(item,index);}
function timelineSourceChoices(item){if(item.id==="reddit"||item.id==="monitoring"||item.id==="ideas")return [1];return [];}
let timelineShellOnly=false;
function timelineColumn(item,index,total){const label=TIMELINE_MODULES[item.id],source=timelineSourceLabel(item);return '<section class="deck-column '+(item.stack?' stacked':'')+(deckMenuId===item.key||deckSettingsId===item.key||deckSourceId===item.key?' menu-open':'')+'" data-deck-id="'+esc(item.id)+'" data-deck-key="'+esc(item.key)+'"><header draggable="true" data-deck-header="'+esc(item.key)+'" data-index="'+index+'"><span class="deck-grip" draggable="true" data-deck-drag="'+esc(item.key)+'" title="Drag to reorder" aria-label="Drag column">⠿</span><button type="button" class="deck-title" data-action="deck-open-module" data-module="'+esc(item.id)+'">'+esc(label)+'</button>'+(source&&timelineSourceChoices(item).length?'<button class="deck-source" data-action="deck-source" data-id="'+esc(item.key)+'">· '+esc(source)+'</button>':'')+timelineColumnMenu(item,index,total)+'</header><div class="deck-column-scroll">'+(timelineShellOnly?'':timelineColumnBody(item))+'</div>'+timelinePendingMarkup(item,timelineFeedSnapshots.get(item.key))+'</section>';}
function timelineLanes(deck){const lanes=[];deck.forEach(function(item,index){if(!item.stack||!lanes.length)lanes.push({items:[],root:item});lanes[lanes.length-1].items.push({item:item,index:index});});return lanes;}
function timelineAutoWidths(lanes){
  const workspace=document.querySelector('.deck-workspace'),viewport=workspace?workspace.clientWidth:($('#content')?.clientWidth||window.innerWidth-240),laneGap=workspace?(parseFloat(getComputedStyle(workspace).gap)||8):8,gap=Math.max(0,lanes.length-1)*laneGap;
  const automatic=lanes.filter(lane=>lane.items.some(entry=>entry.item.autoWidth)),manual=lanes.filter(lane=>!lane.items.some(entry=>entry.item.autoWidth)).reduce((sum,lane)=>sum+lane.root.width,0);
  const widths=new Map(),minimum={reddit:360,monitoring:340,notifications:300};let remaining=viewport-gap-manual,pool=automatic.slice();
  if(lanes.length===1&&lanes[0].items.length===1&&["reddit","monitoring"].includes(lanes[0].root.id)&&automatic.length){widths.set(lanes[0].root.key,Math.min(1100,Math.max(minimum[lanes[0].root.id],viewport-56)));return widths;}
  while(pool.length){const share=remaining/pool.length,limited=pool.filter(lane=>(minimum[lane.root.id]||285)>share);if(!limited.length){pool.forEach(lane=>widths.set(lane.root.key,share));break;}limited.forEach(lane=>{const width=minimum[lane.root.id]||285;widths.set(lane.root.key,width);remaining-=width;});pool=pool.filter(lane=>!limited.includes(lane));}
  return widths;
}
function resizeTimelineLanes(){const workspace=document.querySelector('.deck-workspace');if(!workspace)return;const position=captureTimelinePosition(),lanes=timelineLanes(timelineDeck()),widths=timelineAutoWidths(lanes);Array.from(workspace.children).forEach((node,index)=>{const lane=lanes[index];if(lane)node.style.setProperty('--lane-width',(widths.get(lane.root.key)||lane.root.width)+'px');});restoreTimelinePosition(position);}
let timelineResizeObserver;
function renderTimelinePersistent(content){
  if(!content.querySelector('.deck-workspace')&&timelineSurfaceCache){content.replaceChildren(timelineSurfaceCache);timelineSurfaceCache=null;}
  const oldWorkspace=content.querySelector('.deck-workspace');if(!oldWorkspace){content.innerHTML=viewTimeline();content.querySelectorAll('.deck-column').forEach(node=>{const config=timelineDeck().find(item=>item.key===node.dataset.deckKey);node._feedSignature=config.id+'|'+config.source+'|'+config.configured;node._snapshot=timelineFeedSnapshots.get(config.key);});content.querySelectorAll('.deck-lane').forEach(lane=>lane.dataset.laneKey=lane.querySelector('.deck-column').dataset.deckKey);}
  else {
    const oldColumns=new Map(Array.from(oldWorkspace.querySelectorAll('.deck-column')).map(node=>[node.dataset.deckKey,node]));
    timelineShellOnly=true;const template=document.createElement('template');try{template.innerHTML=viewTimeline();}finally{timelineShellOnly=false;}
    const next=template.content.querySelector('.deck-workspace'),deck=timelineDeck(),used=new Set(),usedLanes=new Set();oldWorkspace.className=next.className;
    Array.from(next.children).forEach((freshLane,laneIndex)=>{
      const rootKey=freshLane.querySelector('.deck-column').dataset.deckKey;
      let lane=Array.from(oldWorkspace.children).find(node=>node.dataset.laneKey===rootKey);
      if(!lane){lane=document.createElement('div');lane.dataset.laneKey=rootKey;oldWorkspace.append(lane);}
      usedLanes.add(lane);lane.className=freshLane.className;lane.style.cssText=freshLane.style.cssText;
      const before=oldWorkspace.children[laneIndex];if(before!==lane){if(oldWorkspace.moveBefore)oldWorkspace.moveBefore(lane,before||null);else oldWorkspace.insertBefore(lane,before||null);}
      Array.from(freshLane.children).forEach((fresh,index)=>{
        const config=deck.find(item=>item.key===fresh.dataset.deckKey),signature=config.id+'|'+config.source+'|'+config.configured,old=oldColumns.get(config.key);
        let column=fresh;
        if(old&&old._feedSignature===signature&&old._snapshot===timelineFeedSnapshots.get(config.key)&&!(old._snapshot&&!old._snapshot.rows.length&&!old._snapshot.pending.length&&timelineLiveFeedRows(config).length)){
          column=old;old.className=fresh.className;old.querySelector('header').replaceWith(fresh.querySelector('header'));
          if(!['reddit','monitoring'].includes(config.id)){const scroller=old.querySelector('.deck-column-scroll'),html=timelineColumnBody(config);if(scroller._markup!==html){const top=scroller.scrollTop;scroller.innerHTML=html;scroller._markup=html;scroller.scrollTop=top;}}
        }else {fresh._feedSignature=signature;fresh.querySelector('.deck-column-scroll').innerHTML=timelineColumnBody(config);fresh._snapshot=timelineFeedSnapshots.get(config.key);}
        used.add(column);const before=lane.children[index];if(before!==column){if(column.isConnected&&lane.moveBefore)lane.moveBefore(column,before||null);else lane.insertBefore(column,before||null);}
      });
    });
    oldColumns.forEach(node=>{if(!used.has(node))node.remove();});Array.from(oldWorkspace.children).forEach(node=>{if(!usedLanes.has(node))node.remove();});
    content.querySelector('.deck-workspace-head').replaceWith(template.content.querySelector('.deck-workspace-head'));
  }
  cleanupMediaObservers();
  if(!timelineResizeObserver){timelineResizeObserver=new ResizeObserver(()=>resizeTimelineLanes());timelineResizeObserver.observe(content);}
}
function timelineLane(lane,total,autoWidths){const automatic=lane.items.some(function(entry){return entry.item.autoWidth;}),width=automatic?(autoWidths.get(lane.root.key)||TIMELINE_DEFAULT_COLUMN_WIDTH):lane.root.width;return '<div class="deck-lane'+(automatic?' auto-width':'')+'" style="--lane-width:'+width+'px">'+lane.items.map(function(entry){return timelineColumn(entry.item,entry.index,timelineDeck().length);}).join('')+'</div>';}
const TIMELINE_ADD_GROUPS=[['Clipping',[['reddit','Clipping']]],['Monitoring',[['monitoring','Monitoring']]],['Activity',[['notifications','Notifications']]],['Processing',[['downloads','Downloads'],['compression','Compression']]],['Library / Personal',[['ideas','Ideas'],['links','Links'],['favorites','Favorites'],['history','History'],['reminders','Reminders']]]];
function animateTimelineColumn(key,kind){requestAnimationFrame(function(){const column=document.querySelector('[data-deck-key="'+CSS.escape(String(key))+'"]');if(!column||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;column.getAnimations().forEach(function(animation){animation.cancel();});column.animate(kind==="switch"?[{opacity:.55,transform:"translateY(5px)"},{opacity:1,transform:"translateY(0)"}]:[{opacity:0,transform:"translateX(22px) scale(.985)"},{opacity:1,transform:"translateX(0) scale(1)"}],{duration:kind==="switch"?170:230,easing:"cubic-bezier(.2,.75,.25,1)"});});}
function addTimelineColumn(module){if(!TIMELINE_MODULES[module])return;const needsSource=module==="reddit"||module==="monitoring",item={key:uid(),id:module,width:TIMELINE_DEFAULT_COLUMN_WIDTH,autoWidth:false,stack:false,source:"",configured:!needsSource};state.settings.timelineDeck.push(item);deckMenuId="";deckSettingsId="";deckSourceId="";saveState();renderView();animateTimelineColumn(item.key,"add");}
function openTimelineAddWindow(){timelineSavedPosition=captureTimelinePosition();const groups=TIMELINE_ADD_GROUPS.map(function(group){return '<section class="deck-add-group"><div>'+esc(group[0])+'</div>'+group[1].map(function(entry){return '<button type="button" data-action="deck-add-module" data-module="'+entry[0]+'">＋ '+esc(entry[1])+'</button>';}).join('')+'</section>';}).join('');openModal("Add a column",'<div class="deck-add-modal">'+groups+'</div>',"",null);const confirm=$("#modal-confirm");if(confirm)confirm.classList.add("hidden");}
function viewTimeline(){const deck=timelineDeck(),lanes=timelineLanes(deck),autoWidths=timelineAutoWidths(lanes),singleFeed=lanes.length===1&&lanes[0].items.length===1&&["reddit","monitoring"].includes(lanes[0].root.id);return '<div class="timeline-view deck-view"><header class="deck-workspace-head"><div><h1>Timeline</h1><span>'+deck.length+' column'+(deck.length===1?'':'s')+' · '+lanes.length+' workspace lane'+(lanes.length===1?'':'s')+'</span></div></header><main class="deck-workspace'+(singleFeed?' single-feed':'')+'" data-action="deck-space">'+lanes.map(function(lane){return timelineLane(lane,lanes.length,autoWidths);}).join("")+'</main><div class="deck-add-controls"><button class="deck-floating-add" type="button" data-action="deck-add-toggle" title="Add column">＋</button></div></div>';}
function _sendCollToLinks(coll){ if(!coll) return; var n=0; rememberUndo("Sent stack to Links"); state.links.forEach(function(l){ if((l.coll||"")===coll && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); if(n){ saveState(); renderView(); log("info","sent "+n+" link(s) from "+coll+" to Links"); } }
function _lotSendSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var n=0; rememberUndo("Sent parked links to Links"); ids.forEach(function(x){ var l=find(state.links,x); if(l && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); colls.forEach(function(c){ state.links.forEach(function(l){ if((l.coll||"")===c && _inLot(l)){ l.inLinks=true; applySmartToLink(l); n++; } }); }); saveState(); lotSelLinks={}; lotSelColls={}; renderView(); log("info","sent "+n+" parked link(s) to Links"); }
function renameStack(coll){
  if(!coll) return;
  openModal("✏️ Rename stack", '<div class="field"><label>New name</label><input id="rs_name" value="'+esc(coll).replace(/"/g,'&quot;')+'"></div>', "Rename", function(){ var el=document.getElementById("rs_name"); var v=el?el.value:""; v=(v||"").trim(); if(!v || v===coll){ closeModal(); return; } var exists=state.links.some(function(l){ return _inLot(l)&&(l.coll||"")===v; }); state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===coll) l.coll=v; }); saveState(); closeModal(); log("info","renamed stack "+coll+" -> "+v+(exists?" (merged into existing)":"")); renderView(); });
  setTimeout(function(){ var i=document.getElementById("rs_name"); if(i){ i.focus(); i.select(); } },30);
}

let viewRenderRevision=0;
const viewScrollPositions=new Map();
let renderedViewScrollKey="";
function currentViewScrollKey(){
  if(offlineMode){if(offlineSelectedId)return "clip:post:"+offlineSelectedId;return ["clip",offlineTab,offlineFilter,offlineSourceBrowse,offlineQuery].join(":");}
  if(monitoringMode){if(monitoringDetail)return "monitoring:post:"+(monitoringDetail.id||monitoringDetail.url||monitoringDetail.title||"current");if(monitoringArtist)return "monitoring:artist:"+(monitoringArtist.monitorId||monitoringArtist.label||"current");return ["monitoring",monitoringFilter,monitoringQuery].join(":");}
  if(currentView==="home")return "";
  return ["module",currentView,currentView==="ideas"?ideaPane:"",currentView==="links"?(linkDrill&&linkDrill.id||""):""].join(":");
}
function rememberRenderedViewPosition(){if(!renderedViewScrollKey)return;const anchor=captureListPosition();if(anchor&&((anchor.ids&&anchor.ids.length)||anchor.top>0))viewScrollPositions.set(renderedViewScrollKey,anchor);}
function restoreRenderedViewPosition(){const key=currentViewScrollKey();renderedViewScrollKey=key;if(key&&viewScrollPositions.has(key))restoreListPosition(viewScrollPositions.get(key),false);else if(key){const content=listScrollContainer();if(content)content.scrollTop=0;}}
let timelineSurfaceCache=null;
function cacheTimelineSurface(){const content=$("#content"),surface=content&&content.querySelector(":scope > .deck-view");if(surface){timelineSurfaceCache=surface;surface.remove();}}
function renderView(){rememberRenderedViewPosition();const deckPosition=currentView==="home"&&!offlineMode&&!monitoringMode?captureTimelinePosition():timelineSavedPosition;viewRenderRevision++;animateNavigation();if((currentView!=="home"||offlineMode||monitoringMode)&&!(offlineMode&&offlineReturnToTimeline))cacheTimelineSurface(); if(monitoringMode){renderMonitoringView();restoreRenderedViewPosition();return;} if(offlineMode){renderOfflineView();restoreRenderedViewPosition();return;} if(currentView!=="lot"){ lotSelLinks={}; lotSelColls={}; } if(currentView!=="links"){ linkSelLinks={}; } const c=$("#content");closeTimelineReaderSurface(); try{ c.parentElement.classList.toggle("lot-active", currentView==="lot"); }catch(_){} switch(currentView){ case "home":renderTimelinePersistent(c);break; case "vault":c.innerHTML=viewVault();break; case "links":c.innerHTML=viewLinks();break; case "lot":c.innerHTML=viewLot();break; case "folders":c.innerHTML=viewFolders();break; case "shots":c.innerHTML=viewShots(); shotsHydrateThumbs(); break; case "ideas":c.innerHTML=viewIdeas();break; case "compress":c.innerHTML=viewCompression();break; default:c.innerHTML=viewTimeline(); } hydrateModulePreviews();if(currentView==="home"){renderedViewScrollKey="";hydrateOfflineMedia();hydrateMonitoringMedia();restoreTimelinePosition(deckPosition);}else restoreRenderedViewPosition(); }
let lastNavigationKey="";
function animateNavigation(){const key=monitoringMode?["monitor",monitoringTab,monitoringFilter,monitoringDetail&&monitoringDetail.title,monitoringArtist&&monitoringArtist.label].join("|"):offlineMode?["offline",offlineTab,offlineFilter,offlineSelectedId].join("|"):[currentView,currentView==="ideas"?ideaPane+"|"+ideaViewingId:""].join("|");const content=$("#content");if(offlineMode&&offlineReturnToTimeline&&content?.querySelector('.deck-view')){lastNavigationKey=key;content.getAnimations().forEach(animation=>animation.cancel());return;}if(key===lastNavigationKey)return;lastNavigationKey=key;requestAnimationFrame(function(){if(key!==lastNavigationKey)return;const content=$("#content");if(content&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){content.getAnimations().forEach(function(animation){animation.cancel();});content.animate([{opacity:.58},{opacity:1}],{duration:180,easing:"cubic-bezier(.2,.75,.25,1)"});}});}
const LIST_ANCHOR_SELECTOR=".of-card,.mon-event,.mon-watch,.mon-artist-post,.idea-list-card,.vault-card,.link-card,.folder-row,.shot-card,.lot-row,.lot-item";
function listScrollContainer(){let node=document.querySelector(".idea-main");while(node&&node!==$("#content")){if(/auto|scroll/.test(getComputedStyle(node).overflowY))return node;node=node.parentElement;}return $("#content");}
function captureListPosition(preferredId){const content=listScrollContainer();if(!content)return null;const rows=Array.from(content.querySelectorAll(LIST_ANCHOR_SELECTOR)),contentRect=content.getBoundingClientRect();let row=preferredId?rows.find(function(node){return node.dataset.id===String(preferredId);}):null;if(!row)row=rows.find(function(node){return node.getBoundingClientRect().bottom>contentRect.top+1;})||rows[rows.length-1];return {id:row&&row.dataset.id||"",ids:rows.map(function(node){return node.dataset.id||"";}).filter(Boolean),offset:row?row.getBoundingClientRect().top-contentRect.top:0,top:content.scrollTop};}
function restoreListPosition(anchor,focus){if(!anchor)return;const revision=viewRenderRevision;const apply=function(){if(revision!==viewRenderRevision)return;const content=listScrollContainer();if(!content)return;const ids=anchor.ids||[],index=ids.indexOf(anchor.id),order=[anchor.id].concat(index>=0?ids.slice(index+1):[],index>0?ids.slice(0,index).reverse():[]).filter(Boolean),rows=Array.from(content.querySelectorAll(LIST_ANCHOR_SELECTOR));let row=null;for(const id of order){row=rows.find(function(node){return node.dataset.id===id;});if(row)break;}if(row){const delta=row.getBoundingClientRect().top-content.getBoundingClientRect().top-anchor.offset;content.scrollTop=Math.max(0,content.scrollTop+delta);if(focus){row.classList.add("list-return-focus");setTimeout(function(){row.classList.remove("list-return-focus");},900);}}else content.scrollTop=Math.max(0,anchor.top||0);};requestAnimationFrame(apply);setTimeout(apply,120);setTimeout(apply,300);}
function renderViewAnchored(anchor,focus){renderView();restoreListPosition(anchor,focus);}
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

function compressionPercent(){const p=compressionProgress||{};return p.finished?100:Math.min(99,Math.max(0,Math.round(Number(p.percent)||0)));}
let compressionCapFps=false,compressionTurbo=true,compressionSelectedPath="",compressionAnalysisRequest=0;
function applyCompressionStatus(status){const next=status||{active:false};if(Array.isArray(next.history))compressionHistory=next.history.slice();if(next.settings)compressionSettings=Object.assign({outputFolder:""},next.settings);compressionProgress=Object.assign({},next);delete compressionProgress.history;delete compressionProgress.settings;}
function compressionVisualHtml(){const p=compressionProgress||{},total=Math.max(1,p.totalBytes||compressionSummary&&compressionSummary.bytes||1),written=Math.max(0,(p.outputBytes||0)+(p.currentBytes||0)),ratio=Math.min(100,100*written/total),stage=p.finished?3:(String(p.current||"").startsWith("Finishing ")?2:(p.active?1:0));return '<div class="compress-visual"><div class="compress-stages"><span class="'+(stage>=0?'on':'')+'">Inspect</span><span class="'+(stage>=1?'on':'')+'">Encode</span><span class="'+(stage>=2?'on':'')+'">Finish</span><span class="'+(stage>=3?'on':'')+'">Ready</span></div><div class="compress-size-row"><span>Original</span><i><b style="width:100%"></b></i><em>'+offlineBytes(total)+'</em></div><div class="compress-size-row output"><span>Written</span><i><b style="width:'+ratio+'%"></b></i><em>'+offlineBytes(written)+'</em></div></div>';}
function compressionProgressHtml(){const p=compressionProgress||{},pct=compressionPercent();if(p.batchPending&&!p.active)return '<section class="compress-progress"><b>Archive batch paused · '+esc(p.batchPending.error||p.batchPending.stage||"Ready to resume")+'</b><button class="btn" data-action="compression-batch-resume">Resume batch</button></section>';if(!p.active&&!p.finished&&!p.error)return "";
 const eta=p.etaSeconds!=null?" · "+Math.ceil(p.etaSeconds/60)+" min remaining for this video":"";
 return '<section class="compress-progress '+(p.error?'failed':p.finished?'complete':'')+'"><div><b>'+esc(p.interrupted?p.current:(p.error||(p.finished?(p.failed?"Finished with "+p.failed+" encoding failure(s)":"Compression complete"):"Compressing "+(p.current||"Inspecting…"))))+'</b><span>'+pct+'%</span></div><div class="compress-bar"><i style="width:'+pct+'%"></i></div><small>'+(p.done||0)+' of '+(p.total||0)+' files · '+offlineBytes((p.outputBytes||0)+(p.currentBytes||0))+' written'+eta+(p.speed?' · '+p.speed.toFixed(1)+'× speed':'')+'</small>'+compressionVisualHtml()+'</section>';
}
function compressionHistoryRows(){return compressionHistory.length?compressionHistory.map(function(item){const kind=item.kind==="folder"?"folder":"video",ratio=item.inputBytes?Math.round(100*item.outputBytes/item.inputBytes):0;return '<article class="compress-job '+kind+(compressionSelectedPath===item.id?' selected':'')+'" data-action="compression-history-select" data-ctx="compression-history" data-id="'+esc(item.id)+'"><div class="compress-job-top"><span>'+kind+'</span><time>'+esc(offlineDate(item.finishedAt))+'</time></div><b>'+esc(item.name)+'</b><small>'+offlineBytes(item.inputBytes)+' → '+offlineBytes(item.outputBytes)+(ratio?' · '+ratio+'%':'')+' · '+esc(item.preset)+'</small><p>'+esc(item.output)+'</p>'+(item.zipPath?'<em>ZIP ready · '+offlineBytes(item.zipBytes||0)+'</em>':'')+'</article>';}).join(""):'<p class="compress-empty">Completed videos and folders will stay here until you remove them.</p>';}
function compressionPreviewHtml(){const item=compressionHistory.find(entry=>entry.id===compressionSelectedPath);if(!item)return "";return (item.kind==="video"&&item.previewUrl?'<video controls preload="metadata" src="'+esc(item.previewUrl)+'"></video><small>If this HEVC video cannot play here, right-click the card to open its folder.</small>':'')+'<p>'+esc(item.output)+'</p>';}
function compressionCheck(name,title,enabled,disabled){return '<label class="compress-check '+(enabled?'active':'')+'"><input type="checkbox" data-compression-option="'+name+'" '+(enabled?'checked ':'')+(disabled?'disabled':'')+'><i aria-hidden="true"></i><span>'+title+'</span></label>';}
function compressionZipHtml(){const latest=compressionHistory[0];if(!latest||latest.zipPath)return "";return '<section class="compress-zip"><span><b>Latest output ready</b><small>Create a ZIP after you finish checking it.</small></span><button type="button" class="btn" data-action="compression-zip" data-id="'+esc(latest.id)+'"'+(compressionZipBusy?' disabled':'')+'>'+(compressionZipBusy?'Creating…':'Create ZIP')+'</button></section>';}
function paintCompression(){const page=document.querySelector(".compress-page");if(!page)return;const progress=document.querySelector("#compress-progress-slot");if(progress)progress.innerHTML=compressionProgressHtml();}
function viewCompression(){
 const s=compressionSummary,p=compressionProgress||{},running=!!p.active,source=s?s.source:(compressionSource||p.source||""),disabled=running||compressionBusy;
 const estimate=s&&s.kind==="batch"?'<p class="compress-estimate-note">'+s.archives+' ZIPs · extract, compress and ZIP individually</p>':s?'<div class="compress-stats"><div><small>Current size</small><b>'+offlineBytes(s.bytes)+'</b></div><div><small>Videos</small><b>'+s.videos+' · '+(s.duration?Math.ceil(s.duration/60)+' min':offlineBytes(s.videoBytes))+'</b></div><div><small>Images preserved</small><b>'+s.images+' · '+offlineBytes(s.imageBytes)+'</b></div><div><small>Estimated ceiling</small><b>'+offlineBytes(s.estimatedMax)+'</b></div></div><p class="compress-estimate-note">Size varies by content. This is a bitrate-based ceiling, not a promised result.</p>':'';
 return head("Compress","Shrink a video or folder while preserving names and structure")+'<div class="compress-page"><div class="compress-work"><section class="compress-drop" data-compression-drop="true"><h2>'+esc(compressionBusy?"Inspecting videos…":source||"Drop a folder or video here")+'</h2><div><button type="button" class="btn" data-action="compression-pick-folder"'+(disabled?' disabled':'')+'>Choose folder</button><button type="button" class="btn" data-action="compression-pick-file"'+(disabled?' disabled':'')+'>Choose video</button></div></section><section class="compress-options"><div class="compress-control-row"><div class="compress-presets"><button type="button" data-action="compression-preset" data-preset="ultra" class="'+(compressionPreset==='ultra'?'active':'')+'"'+(disabled?' disabled':'')+'><b>Ultra</b><span>More detail</span></button><button type="button" data-action="compression-preset" data-preset="extreme" class="'+(compressionPreset==='extreme'?'active':'')+'"'+(disabled?' disabled':'')+'><b>Extreme</b><span>Smallest size</span></button></div><div class="compress-checks">'+compressionCheck("turbo","Turbo GPU",compressionTurbo,disabled)+compressionCheck("fps","60 FPS limit",compressionCapFps,disabled)+'</div></div>'+estimate+(s&&s.highFps?'<p class="compress-estimate-note">'+s.highFps+' high-frame-rate video(s). Original frame rate is kept unless enabled.</p>':'')+(s?'<div class="compress-output"><small>Output folder</small><span title="'+esc(s.output)+'">'+esc(s.output)+'</span></div>':'')+'<div class="compress-actions">'+(running?'<button type="button" class="btn" data-action="compression-cancel">Pause safely</button>':'')+(p.interrupted&&!running?'<button type="button" class="btn primary" data-action="compression-resume">Resume</button>':'')+'<button type="button" class="btn primary" data-action="compression-start"'+(!s||disabled||!s.videos?' disabled':'')+'>Compress '+(s&&s.kind==='file'?'video':'folder')+'</button></div></section><div id="compress-progress-slot">'+compressionProgressHtml()+'</div></div><aside class="compress-results"><div class="compress-results-head"><h2>Output history</h2><small>'+compressionHistory.length+' saved</small></div><div id="compress-preview">'+compressionPreviewHtml()+'</div>'+compressionZipHtml()+'<div id="compress-results-list">'+compressionHistoryRows()+'</div><small>Right-click an entry to open, ZIP, or remove it. Removing it here does not delete its files.</small></aside></div>';
}
async function analyzeCompression(source){
 if(!E||!E.compressionAnalyze||compressionProgress.active)return;const request=++compressionAnalysisRequest;
 compressionSource=String(source||"");compressionSummary=null;compressionBusy=true;renderView();
 try{if(E.compressionBatchInspect){const batch=await E.compressionBatchInspect(compressionSource);if(batch.zips){compressionSummary={source:compressionSource,kind:"batch",archives:batch.count,videos:batch.count,files:batch.count,output:compressionSettings.outputFolder||"Beside each original",bytes:0,videoBytes:0,images:0,imageBytes:0,estimatedMax:0};return;}}const result=await E.compressionAnalyze(compressionSource,compressionPreset);if(request!==compressionAnalysisRequest)return;if(!result||!result.ok)throw Error(result&&result.error||"Could not inspect that selection");compressionSummary=result.summary;if(!result.encoder)toast("FFmpeg was not found","warn");}catch(error){if(request===compressionAnalysisRequest)toast(error.message,"err");}
 finally{if(request===compressionAnalysisRequest){compressionBusy=false;renderView();}}
}
async function pickCompression(kind){if(!E||!E.compressionPick||compressionProgress.active)return;const selected=await E.compressionPick(kind);if(selected)await analyzeCompression(selected);}
async function startCompression(resume){if(compressionSummary&&compressionSummary.kind==="batch")return startCompressionBatch(false);if(!compressionSummary||compressionBusy||compressionProgress.active||!E||!E.compressionStart)return;compressionSelectedPath="";const prior=resume?compressionProgress:null;compressionProgress=Object.assign({active:true,total:compressionSummary.files,done:0,current:"Starting…",results:[]},prior||{}, {active:true,interrupted:false,error:""});renderView();
 try{const result=await E.compressionStart({source:compressionSummary.source,preset:compressionPreset,capFps:compressionCapFps,turbo:compressionTurbo,resume:!!resume});if(!result||!result.ok){applyCompressionStatus(Object.assign({active:false,error:result&&result.error||"Compression failed"},result&&result.status||{}));toast(compressionProgress.cancelled?"Compression paused safely":compressionProgress.error,compressionProgress.cancelled?"ok":"err");}else{applyCompressionStatus(result.status||{active:false,finished:true});compressionSelectedPath=compressionHistory[0]&&compressionHistory[0].id||"";toast(compressionProgress.failed?"Finished — some videos were copied unchanged after encoding errors":"Compression complete",compressionProgress.failed?"warn":"ok");}}catch(error){compressionProgress={...compressionProgress,active:false,error:error.message};toast(error.message,"err");}renderView();
}
async function resumeCompression(){const saved=compressionProgress;if(!saved.interrupted||!saved.source)return;compressionPreset=saved.preset||"ultra";compressionCapFps=!!saved.capFps;compressionTurbo=saved.turbo!==false;await analyzeCompression(saved.source);if(compressionSummary){compressionProgress=saved;await startCompression(true);}}
async function startCompressionBatch(resume){if(!E||!E.compressionBatchStart||compressionProgress.active)return;compressionProgress={active:true,current:"Preparing archive batch",results:[]};renderView();try{const result=await E.compressionBatchStart({source:compressionSource,preset:compressionPreset,turbo:compressionTurbo,capFps:compressionCapFps,resume:!!resume});applyCompressionStatus(await E.compressionStatus());if(!result.canceled)toast(result.ok?"Archive batch complete":result.error||"Batch paused",result.ok?"ok":"err");}catch(error){compressionProgress.active=false;toast(error.message,"err");}renderView();}
async function startDroppedCompressionBatch(files){if(!E||!E.compressionBatchStart||compressionProgress.active)return;const sources=Array.from(files||[]).map(function(file){return E.compressionDropPath?E.compressionDropPath(file):"";}).filter(Boolean);if(!sources.length)return;compressionProgress={active:true,current:"Preparing "+sources.length+" top-level item"+(sources.length===1?"":"s"),results:[]};renderView();try{const result=await E.compressionBatchStart({sources:sources,preset:compressionPreset,turbo:compressionTurbo,capFps:compressionCapFps});applyCompressionStatus(await E.compressionStatus());if(!result.canceled)toast(result.ok?"Compression batch complete":result.error||"Batch paused",result.ok?"ok":"err");}catch(error){compressionProgress.active=false;toast(error.message,"err");}renderView();}
async function zipCompression(id){if(compressionZipBusy||!E||!E.compressionZip)return;compressionZipBusy=true;renderView();try{const result=await E.compressionZip(id||"");if(!result||!result.ok)throw Error(result&&result.error||"Could not create ZIP");if(Array.isArray(result.history))compressionHistory=result.history;toast("ZIP ready","ok");if(E.compressionCleanup){const cleaned=await E.compressionCleanup(id||compressionHistory[0].id);if(cleaned&&cleaned.history)compressionHistory=cleaned.history;}}catch(error){toast(error.message,"err");}finally{compressionZipBusy=false;renderView();}}
function offlineDate(ts){if(!ts)return "Never";return new Date(ts).toLocaleString([],{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
let postImageItems=[],postImageIndex=0,postImageFocus=null;
function closePostImage(){const box=document.getElementById("post-image-zoom");if(box)box.remove();postImageItems=[];postImageIndex=0;const focus=postImageFocus;postImageFocus=null;if(focus&&focus.isConnected)focus.focus({preventScroll:true});}
function paintPostImage(){const image=document.querySelector("#post-image-zoom .post-image-main"),item=postImageItems[postImageIndex];if(image&&item){image.src=item.src;if(item.offlineRef){image.dataset.ctx="offline-media";image.dataset.id=item.offlineRef;if(item.postId)image.dataset.postId=item.postId;}else if(item.monitoringId){image.dataset.ctx="monitor-event";image.dataset.id=item.monitoringId;delete image.dataset.postId;}else if(item.ctx){image.dataset.ctx=item.ctx;if(item.itemId)image.dataset.id=item.itemId;if(item.fileIndex)image.dataset.index=item.fileIndex;delete image.dataset.postId;}else{delete image.dataset.ctx;delete image.dataset.id;delete image.dataset.index;delete image.dataset.postId;}}}
function stepPostImage(direction){if(!postImageItems.length)return;postImageIndex=(postImageIndex+direction+postImageItems.length)%postImageItems.length;paintPostImage();}
function wirePostImagePan(box,image){let drag=null,moved=false;image.draggable=false;image.addEventListener("dragstart",function(event){event.preventDefault();});image.addEventListener("pointerdown",function(event){if(event.button!==0)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,left:box.scrollLeft,top:box.scrollTop};moved=false;image.setPointerCapture(event.pointerId);image.classList.add("dragging");});image.addEventListener("pointermove",function(event){if(!drag)return;event.preventDefault();const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;box.scrollLeft=drag.left-dx;box.scrollTop=drag.top-dy;});const finish=function(event){if(!drag)return;drag=null;image.classList.remove("dragging");if(image.hasPointerCapture(event.pointerId))image.releasePointerCapture(event.pointerId);};image.addEventListener("pointerup",finish);image.addEventListener("pointercancel",finish);image.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();if(moved)moved=false;});}
document.addEventListener("click",function(event){
  const selector=".of-reader img:not(.of-avatar),.of-card img.of-media";
  const picture=event.target.closest&&event.target.closest(selector);if(!picture||!picture.src)return;
  event.preventDefault();event.stopImmediatePropagation();closePostImage();postImageFocus=document.activeElement;
  const card=picture.closest('.of-card');if(card)markOfflineViewed(offlineItem(card.dataset.id));
  postImageItems=Array.from(document.querySelectorAll(selector)).filter(image=>image.src).map(function(image){const offlineCard=image.closest('.of-card,.of-reader'),monitoringCard=image.closest('.deck-monitor-post');return {src:image.src,offlineRef:image.dataset.offlineMedia||"",monitoringId:monitoringCard&&monitoringCard.dataset.id||"",postId:image.dataset.postId||(offlineCard&&offlineCard.dataset.id)||"",ctx:image.dataset.ctx||"",itemId:image.dataset.id||"",fileIndex:image.dataset.index||""};});postImageIndex=Math.max(0,postImageItems.findIndex(item=>item.src===picture.src));
  const box=document.createElement("div");box.id="post-image-zoom";box.tabIndex=-1;box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Enlarged image. Scroll or drag the image to move around it. Click outside or press Escape to close.");box.innerHTML='<div class="post-image-canvas"><img class="post-image-main" alt="Expanded post image"></div>';box.addEventListener("click",function(event){if(event.target===box||event.target.classList.contains("post-image-canvas"))closePostImage();});document.body.appendChild(box);const image=box.querySelector(".post-image-main");wirePostImagePan(box,image);paintPostImage();box.focus({preventScroll:true});
},true);
document.addEventListener("keydown",function(event){if(!document.getElementById("post-image-zoom"))return;if(["Escape","ArrowRight","ArrowLeft","Tab"].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==="Escape")closePostImage();else if(event.key==="ArrowRight")stepPostImage(1);else if(event.key==="ArrowLeft")stepPostImage(-1);}},true);
function markOfflineViewed(item){if(!item||item.read)return;item.read=true;item.readAt=Date.now();item.historyAt=item.readAt+30*60*1000;if(E&&E.offlineItemUpdate)E.offlineItemUpdate(item.id,{read:true}).catch(function(){toast("Could not save viewed status","warn");});}

// Feed changes arrive through data events; never rebuild a reading surface on a timer.
function offlineItem(id){return (offlineData.items||[]).find(function(item){return String(item.id)===String(id);});}
function offlineItemForMedia(ref){return (offlineData.items||[]).find(function(item){return Array.isArray(item.media)&&item.media.includes(String(ref||""));});}
async function loadOfflineData(anchor,background){
  if(!E||!E.offlineLoad){toast("Clipping Reader needs the desktop build","warn");return;}
  if(!background){offlineLoading=true;renderView();}
  try{const result=await Promise.all([E.offlineLoad(),E.offlineExtensionStatus()]);if(result[0]){offlineData=result[0];offlineDataReady=true;}if(result[1])offlineExtension=result[1];offlineSyncing=!!(offlineData.sync&&(offlineData.sync.active||offlineData.sync.queued));}
  catch(error){toast("Could not load Clipping Reader","err");}
  offlineLoading=false;if(!background||offlineMode&&!offlineSelectedId)renderViewAnchored(anchor,false);
}
function refreshOfflineDataAfterPaint(){return new Promise(function(resolve){requestAnimationFrame(function(){resolve(loadOfflineData(captureListPosition(),true));});});}
function setOfflineMode(enabled,quiet,useLoadedData){
  closeSettings();
  if(enabled&&monitoringMode)setMonitoringMode(false,true);
  offlineMode=!!enabled;offlineReturnToTimeline=false;offlineSelectedId="";offlineBrowseIds=[];offlineReturnAnchor=null;
  const win=$("#window"),button=$("#offlineToggle");if(win)win.classList.toggle("offline-mode",offlineMode);
  if(button){button.classList.toggle("active",offlineMode);const label=button.querySelector("b");if(label)label.textContent="Clipping";button.title=offlineMode?"Return to normal SINRAD":"Switch to Clipping";}
  renderNav();
  if(offlineMode){if(useLoadedData||offlineDataReady){offlineLoading=false;renderView();return refreshOfflineDataAfterPaint();}return loadOfflineData();}else if(!quiet)renderView();
}
function offlineGroupKey(item){return offlineRedditName(item).toLowerCase()||String(item.community||item.platform||"Saved pages").toLowerCase();}
function offlineSourceGroups(){
  const groups=new Map();(offlineData.sources||[]).forEach(source=>groups.set(source.handle.toLowerCase(),{key:source.handle.toLowerCase(),label:source.label,id:source.id,source,count:0}));
  (offlineData.items||[]).forEach(item=>{const key=offlineGroupKey(item);if(!groups.has(key))groups.set(key,{key,label:item.community||item.platform||"Saved pages",id:"",count:0});groups.get(key).count++;});
  return Array.from(groups.values());
}
function offlineFilteredItems(){
  const query=offlineQuery.trim().toLowerCase();
  return offlineMixSources((offlineData.items||[]).filter(item=>{
    if(offlineTab==="sources"){if(offlineGroupKey(item)!==offlineSourceBrowse)return false;}
    else if(offlineTab==="favorite"){if(!item.favorite)return false;}
    else if(!item.read||Date.now()<Number(item.historyAt||item.readAt||0))return false;
    return !query||[item.title,item.author,item.content,item.community,item.platform].some(value=>String(value||"").toLowerCase().includes(query));
  }));
}

function offlineMixSources(items){
  const pools=new Map(),order=[];(Array.isArray(items)?items:[]).forEach(function(item){const key=String(item.sourceId||item.monitorId||item.community||item.platform||item.id);if(!pools.has(key)){pools.set(key,[]);order.push(key);}pools.get(key).push(item);});
  const mixed=[],active=order.slice();while(active.length){for(let index=0;index<active.length;){const pool=pools.get(active[index]);if(pool&&pool.length)mixed.push(pool.shift());if(!pool||!pool.length)active.splice(index,1);else index++;}}return mixed;
}
function offlineSourceName(item){const source=(offlineData.sources||[]).find(function(entry){return entry.id===item.sourceId;});return source?source.label:(item.community||item.platform);}
function offlineRedditName(item){const match=String(item&&item.community||"").match(/^r\/([A-Za-z0-9_]{2,21})$/i);return match?match[1]:"";}
function offlineRedditSource(item){const name=offlineRedditName(item).toLowerCase();return name?(offlineData.sources||[]).find(function(source){return source.platform==="reddit"&&String(source.handle||"").toLowerCase()===name;}):null;}
function offlineItemMenu(item,includeNavigation){
  let menu="";
  if(includeNavigation){const neighbors=offlinePostNeighbors(item.id);if(neighbors.next)menu+=mi("offline-item-nav",neighbors.next.id,"Next post",null,false,"→");if(neighbors.previous)menu+=mi("offline-item-nav",neighbors.previous.id,"Previous post",null,false,"←");}
  const reddit=offlineRedditName(item),source=offlineRedditSource(item);
  if(reddit&&!source)menu+='<div class="cdiv"></div>'+mi("offline-source-follow",item.id,"Add r/"+reddit+" to Clipping",null,false,CTX_ICON.download);
  return menu+(menu?'<div class="cdiv"></div>':'')+(item.read?mi("offline-item-unread",item.id,"Mark as unread",null,false,"○"):"")+mi("offline-item-favorite",item.id,item.favorite?"Remove favorite":"Favorite",null,false,CTX_ICON.star)+mi("offline-item-download",item.id,"Download post",null,false,CTX_ICON.download)+mi("offline-original",item.id,"Open original")+mi("offline-item-remove",item.id,"Delete post","#ff5470",true,CTX_ICON.delete);
}
function offlinePostNeighbors(id){const ids=offlineBrowseIds.includes(id)?offlineBrowseIds:offlineFilteredItems().map(function(item){return item.id;}),index=ids.indexOf(id);return {previous:index>0?offlineItem(ids[index-1]):null,next:index>=0&&index<ids.length-1?offlineItem(ids[index+1]):null};}
function offlineMediaKind(ref){return /\.(?:mp4|webm)$/i.test(String(ref||""))?"video":"image";}
function offlineMediaUrl(ref){const match=String(ref||"").replace(/\\/g,"/").match(/^media\/((?:[a-f0-9]{24}\/)?[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif|mp4|webm))$/i);return match?"sinrad-offline://media/"+match[1].split("/").map(encodeURIComponent).join("/"):"";}
function offlineAvatar(ref,label){return ref?'<img class="of-avatar" data-offline-media="'+esc(ref)+'" alt="'+esc(label||'User avatar')+'" loading="lazy">':'<span class="of-avatar fallback" aria-hidden="true">u/</span>';}
function offlineCommentMedia(comment){const gifs=new Set(Array.isArray(comment.gifMedia)?comment.gifMedia:[]);return (Array.isArray(comment.media)?comment.media:[]).map(function(ref,index){if(offlineMediaKind(ref)==="video"){const gif=gifs.has(ref);return '<video class="of-comment-media'+(gif?' gif':'')+'" src="'+esc(offlineMediaUrl(ref))+'" loop muted playsinline '+(gif?'':'controls ')+'aria-label="Comment '+(gif?'GIF ':'video ')+(index+1)+'"></video>';}return '<img class="of-comment-media" data-offline-media="'+esc(ref)+'" alt="Comment image '+(index+1)+'" loading="lazy">';}).join("");}
function offlineMediaTag(item,detail){const refs=Array.isArray(item.media)?item.media:[],ref=refs.find(function(value){return offlineMediaKind(value)==="video";})||refs.find(function(value){return offlineMediaKind(value)==="image";});if(!ref)return "";if(offlineMediaKind(ref)==="video")return '<video class="of-media'+(detail?' detail':'')+' of-video-preview" src="'+esc(offlineMediaUrl(ref))+'" muted loop playsinline preload="none" data-preview-loop="5" aria-label="Video preview"></video>';return '<img class="of-media'+(detail?' detail':'')+'" data-offline-media="'+esc(ref)+'" data-ctx="offline-media" data-id="'+esc(ref)+'" data-post-id="'+esc(item.id)+'" alt="" loading="lazy">';}
function offlineGallery(item){
  const refs=Array.isArray(item.media)?item.media.filter(Boolean):[];if(!refs.length)return "";
  const images=refs.map(function(ref,index){const active=index===0?' active':'',position=' data-gallery-image="'+index+'"';if(offlineMediaKind(ref)==="video")return '<video class="of-gallery-video'+active+'"'+position+' src="'+esc(offlineMediaUrl(ref))+'" controls preload="metadata" playsinline aria-label="Post video '+(index+1)+' of '+refs.length+'"></video>';return '<img class="of-gallery-image'+active+'" data-offline-media="'+esc(ref)+'" data-ctx="offline-media" data-id="'+esc(ref)+'" data-post-id="'+esc(item.id)+'"'+position+' alt="Post image '+(index+1)+' of '+refs.length+'" loading="lazy">';}).join("");
  const controls=refs.length>1?'<button type="button" class="of-gallery-nav prev" data-action="offline-gallery-prev" aria-label="Previous image">‹</button><button type="button" class="of-gallery-nav next" data-action="offline-gallery-next" aria-label="Next image">›</button><span class="of-gallery-count"><b>1</b> / '+refs.length+'</span>':"";
  return '<section class="of-gallery'+(refs.length===1?' single':'')+'" data-gallery-index="0"><div class="of-gallery-stage">'+images+controls+'</div></section>';
}
function offlineRichRuns(runs){return (Array.isArray(runs)?runs:[]).map(function(run){let value=esc(run&&run.text||"");if(run&&run.code)value='<code>'+value+'</code>';if(run&&run.italic)value='<em>'+value+'</em>';if(run&&run.bold)value='<strong>'+value+'</strong>';return value;}).join("");}
function offlineRichBlocks(blocks,className){return '<div class="'+esc(className||"of-rich")+' rich">'+(Array.isArray(blocks)?blocks:[]).map(function(block){const body=offlineRichRuns(block.runs);if(block.type==="heading")return '<h'+Math.min(4,Math.max(2,Number(block.level)||2))+'>'+body+'</h'+Math.min(4,Math.max(2,Number(block.level)||2))+'>';if(block.type==="listItem")return '<div class="of-rich-li" style="--list-depth:'+Math.min(8,Number(block.depth)||0)+'"><span>'+(block.ordered?esc(block.index)+'.':'•')+'</span><p>'+body+'</p></div>';if(block.type==="quote")return '<blockquote>'+body+'</blockquote>';if(block.type==="code")return '<pre><code>'+body+'</code></pre>';return '<p>'+body+'</p>';}).join("")+'</div>';}
function offlinePostBody(item){
  const blocks=Array.isArray(item.contentBlocks)?item.contentBlocks:[];if(blocks.length)return offlineRichBlocks(blocks,"of-body");
  return item.content?'<div class="of-body">'+esc(item.content)+'</div>':"";
}
function removeTimelineOfflineItem(id){
  const value=String(id);timelineFeedSnapshots.forEach(function(snapshot){if(snapshot.kind!=="reddit")return;snapshot.rows=snapshot.rows.filter(function(item){return String(item.id)!==value;});snapshot.pending=snapshot.pending.filter(function(item){return String(item.id)!==value;});});
  document.querySelectorAll('.deck-column[data-deck-id="reddit"] .of-card[data-id="'+CSS.escape(value)+'"]').forEach(function(card){card.remove();});
  document.querySelectorAll('.deck-column[data-deck-id="reddit"]').forEach(function(column){const snapshot=timelineFeedSnapshots.get(column.dataset.deckKey),button=column.querySelector('.deck-new-posts');if(!button)return;if(snapshot&&snapshot.pending.length)button.textContent='↑ '+snapshot.pending.length+' new post'+(snapshot.pending.length===1?'':'s');else button.remove();});
}
function reconcileRemovedTimelineOfflineItems(){const ids=new Set((offlineData.items||[]).map(function(item){return String(item.id);}));timelineFeedSnapshots.forEach(function(snapshot){if(snapshot.kind!=="reddit")return;snapshot.rows.concat(snapshot.pending).forEach(function(item){if(!ids.has(String(item.id)))removeTimelineOfflineItem(item.id);});});}
function offlineFavoriteIcon(active){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"></path></svg>';}
function paintOfflineFavoriteButton(button,active){if(!button)return;button.classList.toggle("is-favorite",!!active);button.setAttribute("aria-pressed",active?"true":"false");button.setAttribute("title",active?"Remove favorite":"Favorite");button.innerHTML=offlineFavoriteIcon(active);}
function offlineFeedCard(item,openAction){
  openAction=typeof openAction==="string"?openAction:"offline-item-open";
  const author=item.author?'<span>u/'+esc(item.author)+'</span>':'<span>Clipping snapshot</span>';
  const postStats=item.platform==="reddit"?'<span>▲ '+esc(item.score)+'</span><span>◌ '+esc(item.commentCount)+'</span>':'<span>'+esc(Math.max(1,Math.round((item.captureSize||0)/1024)))+' KB</span><span>MHTML</span>';
  const score=Number(item.score)||0,comments=Number(item.commentCount)||0,interest=item.platform!=="reddit"?"":(score>=500||comments>=80?'<span class="of-interest popular">Popular</span>':(score>=75||comments>=20?'<span class="of-interest">Interesting</span>':""));
  return '<article class="of-card misskey-note'+(item.read?' read':'')+(item.captureRef?' captured':'')+'" data-action="'+esc(openAction)+'" data-ctx="offline-item" data-id="'+esc(item.id)+'"><div class="of-card-copy"><div class="of-note-author"><span class="of-note-avatar">'+esc((item.author||item.community||"S").charAt(0).toUpperCase())+'</span><div><b>'+esc(item.author?'u/'+item.author:offlineSourceName(item))+'</b><small>'+esc(offlineSourceName(item))+'</small>'+interest+'</div><time>'+esc(offlineDate(item.date||item.downloadedAt))+'</time></div><h2>'+esc(item.title)+'</h2><p>'+esc(item.content||((item.media&&item.media.length)?"Media post":"Open to read the saved post"))+'</p>'+offlineMediaTag(item,false)+'<div class="of-card-foot">'+author+'<span>↶ '+esc(item.commentCount||0)+'</span><span>↻</span>'+postStats+'<button type="button" data-action="offline-item-favorite" data-id="'+esc(item.id)+'" class="'+(item.favorite?'is-favorite':'')+'" aria-pressed="'+(item.favorite?'true':'false')+'" title="'+(item.favorite?'Remove favorite':'Favorite')+'">'+offlineFavoriteIcon(item.favorite)+'</button></div></div></article>';
}
function viewOfflineDetail(item){
  const savedComments=item.comments||[];
  const comments=savedComments.length?'<section class="of-comments"><h3>Comments <span>'+savedComments.length+' saved</span></h3>'+savedComments.map(function(comment){const when=comment.date?'<time>'+esc(offlineDate(comment.date))+'</time>':'',blocks=Array.isArray(comment.contentBlocks)?comment.contentBlocks:[],body=blocks.length?offlineRichBlocks(blocks,"of-comment-body"):(comment.body?'<div class="of-comment-body"><p>'+esc(comment.body)+'</p></div>':'');return '<article class="of-comment" style="--comment-depth:'+Math.min(8,Number(comment.depth)||0)+'"><div class="of-comment-row">'+offlineAvatar(comment.avatar,'u/'+(comment.author||'[deleted]'))+'<div class="of-comment-copy"><header><b>u/'+esc(comment.author||'[deleted]')+'</b>'+when+'<span>▲ '+esc(comment.score)+'</span></header>'+body+offlineCommentMedia(comment)+'</div></div></article>';}).join("")+'</section>':"";
  const flair=item.authorFlair?'<span class="of-author-flair">'+esc(item.authorFlair)+'</span>':'';
  const byline=(item.author?'u/'+esc(item.author)+flair+' · ':'')+'cached '+esc(offlineDate(item.downloadedAt)),postFlair=item.postFlair?'<span class="of-post-flair">'+esc(item.postFlair)+'</span>':'';
  const stats=item.platform==="reddit"?'<div class="of-post-stats"><span>▲ '+esc(item.score)+'</span><span>◌ '+esc(item.commentCount)+' comments</span></div>':'';
  return '<div class="of-reader" data-ctx="offline-item" data-id="'+esc(item.id)+'"><article class="of-article"><div class="of-post-head"><div class="of-kicker">'+esc(String(item.platform||"offline").toUpperCase())+' · '+esc(offlineSourceName(item)||"Saved post")+' · '+esc(offlineDate(item.date))+'</div><h1>'+esc(item.title||"Untitled post")+'</h1><div class="of-author-row">'+offlineAvatar(item.authorAvatar,'u/'+(item.author||'[deleted]'))+'<div><div class="of-byline">'+byline+'</div>'+postFlair+'</div></div></div>'+offlineGallery(item)+offlinePostBody(item)+stats+comments+'</article></div>';
}
function viewOfflineSources(){
  const bridge=offlineExtension.connected?'<div class="of-connect connected"><span class="of-source-icon reddit">r/</span><div><b>Browser extension connected</b><small>Reddit pages are saved with your normal browser session. No Reddit API.</small></div></div>':'<div class="of-connect"><span class="of-source-icon reddit">r/</span><div><b>Browser extension not detected</b><small>Subscriptions can be added now, but downloads wait until the SINRAD extension is running.</small></div><button class="btn sm primary" data-action="offline-extension-open">Open extension folder</button></div>';
  const sources='<div class="of-source-list">'+offlineSourceGroups().map(group=>{
    const source=group.source,status=source?(source.lastError|| (source.syncRequestedAt?'Waiting for browser extension':'Last sync: '+offlineDate(source.lastSync))):'Saved locally';
    return '<button type="button" class="of-source" data-action="offline-source-browse" data-source="'+esc(group.key)+'" data-ctx="offline-source" data-id="'+esc(group.id)+'"><span class="of-source-icon reddit">r/</span><div><b>'+esc(group.label)+'</b><small>'+group.count+' downloaded'+(source?' · daily refresh':'')+'</small><small>'+esc(status)+'</small></div></button>';
  }).join("")+'</div>';
  return '<div class="of-sources">'+bridge+'<div class="of-source-actions"><button class="btn primary" data-action="offline-source-add">＋ Add subreddit</button></div>'+sources+'</div>';
}
function openTimelineRedditReader(id){
 const item=offlineItem(id);if(!item){toast("That saved post could not be found","warn");return;}rememberTimelinePosition();offlineReturnToTimeline=true;offlineReturnAnchor=null;offlineSelectedId=String(item.id);offlineMode=true;offlineLoading=false;
 const column=document.querySelector('.deck-column [data-id="'+CSS.escape(id)+'"]')?.closest('.deck-column'),snapshot=column&&timelineFeedSnapshots.get(column.dataset.deckKey);offlineBrowseIds=(snapshot?snapshot.rows:timelineItems()).map(entry=>entry.id);
 markOfflineViewed(item);renderNav();renderView();
}
function closeTimelineReaderSurface(){const host=document.querySelector('.timeline-reader-host');if(!host)return false;host.remove();cleanupMediaObservers();return true;}
function leaveTimelineOfflineReader(){if(!offlineReturnToTimeline)return false;offlineSelectedId="";offlineBrowseIds=[];offlineReturnAnchor=null;offlineMode=false;offlineReturnToTimeline=false;currentView="home";deckMenuId="";deckSettingsId="";deckSourceId="";closeTimelineReaderSurface();renderNav();stageTimelineFeedUpdates("reddit");stageTimelineFeedUpdates("monitoring");refreshTimelineLightColumns();hydrateOfflineMedia();hydrateMonitoringMedia();return true;}
function renderOfflineView(){
  animateNavigation();let content=$("#content");if(!content)return;
  if(offlineReturnToTimeline&&content.querySelector('.deck-view')){let host=content.querySelector('.timeline-reader-host');if(!host){host=document.createElement('div');host.className='timeline-reader-host';content.append(host);}content=host;}
  if(offlineLoading){content.innerHTML='<div class="of-loading"><i></i><b>Loading saved content…</b></div>';return;}
  const selected=offlineSelectedId&&offlineItem(offlineSelectedId);if(selected){if(content.dataset.readerId!==selected.id||!content.querySelector(".of-reader")){content.innerHTML=viewOfflineDetail(selected);content.dataset.readerId=selected.id;content.scrollTop=0;}hydrateOfflineMedia();return;}delete content.dataset.readerId;
  const storage=offlineData.storage||{bytes:0,files:0},nav='<header class="of-head"><h1>Clipping</h1><div class="of-head-actions"><span class="of-storage">'+esc(offlineBytes(storage.bytes))+' · '+esc(storage.files||0)+' files</span>'+pageCounterMarkup()+'</div></header><nav class="of-tabs">'+[['history','History'],['sources','Sources'],['favorite','Favorites']].map(([id,label])=>'<button class="'+(offlineTab===id?'active':'')+'" data-action="offline-tab" data-tab="'+id+'">'+label+'</button>').join('')+'</nav>';
  if(offlineTab==="sources"&&!offlineSourceBrowse){content.innerHTML='<div class="offline-shell">'+nav+viewOfflineSources()+'</div>';return;}
  const items=offlineFilteredItems(),group=offlineSourceGroups().find(entry=>entry.key===offlineSourceBrowse);
  const sourceHead=offlineTab==="sources"?'<div class="of-source-heading"><h2>'+esc(group?group.label:offlineSourceBrowse)+'</h2></div>':'';
  const toolbar='<div class="of-toolbar"><input id="offlineSearch" value="'+esc(offlineQuery)+'" placeholder="Search saved posts…" aria-label="Search saved posts"></div>';
  const body=items.length?'<div class="of-feed cards">'+items.map(item=>offlineFeedCard(item)).join('')+'</div>':emptyState('◫',offlineTab==='history'?'Viewed posts move here after 30 minutes.':offlineTab==='favorite'?'No favorite posts yet.':'No downloaded posts from this source yet.');
  content.innerHTML='<div class="offline-shell">'+nav+sourceHead+toolbar+body+'</div>';hydrateOfflineMedia();
}

const mediaRequests=new Map(),mediaRequestQueue=[];let activeMediaRequests=0;
function pumpMediaRequests(){
 while(activeMediaRequests<4&&mediaRequestQueue.length){const job=mediaRequestQueue.shift();if(!Array.from(job.nodes).some(node=>node.isConnected&&!node.closest('[inert]'))){mediaRequests.delete(job.key);job.resolve(undefined);continue;}if(document.hidden){mediaRequestQueue.unshift(job);break;}activeMediaRequests++;Promise.resolve().then(job.load).then(job.resolve,job.reject).finally(()=>{activeMediaRequests--;mediaRequests.delete(job.key);pumpMediaRequests();});}
}
function requestCachedMedia(kind,ref,cache,limit,node){if(cache.has(ref))return Promise.resolve(cache.get(ref));const key=kind+'|'+ref,existing=mediaRequests.get(key);if(existing){existing.nodes.add(node);return existing.promise;}const job={key,nodes:new Set([node]),load:async()=>{const src=await (kind==='offline'?E.offlineMedia(ref):E.monitoringMedia(ref));if(src)rememberMedia(cache,ref,src,limit);return src;}};job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});mediaRequests.set(key,job);mediaRequestQueue.push(job);pumpMediaRequests();return job.promise;}
const deferredMediaLoads=new WeakMap(),observedMedia=new Set(),observedVideos=new Set();
let mediaForeground=!document.hidden;
function cleanupMediaObservers(){observedMedia.forEach(node=>{if(!node.isConnected){deferredMediaObserver?.unobserve(node);deferredMediaLoads.delete(node);observedMedia.delete(node);}});observedVideos.forEach(node=>{if(!node.isConnected){node.pause();previewVideoObserver?.unobserve(node);observedVideos.delete(node);}});}
function updateMediaForeground(){pumpMediaRequests();mediaForeground=!document.hidden&&document.hasFocus();if(!mediaForeground)document.querySelectorAll(".mon-reader video,.mon-reader audio").forEach(media=>media.pause());cleanupMediaObservers();observedVideos.forEach(video=>{if(mediaForeground&&video.dataset.visible==="1"&&!video.closest("[inert]"))video.play().catch(()=>{});else video.pause();});}
window.addEventListener("blur",updateMediaForeground);window.addEventListener("focus",updateMediaForeground);document.addEventListener("visibilitychange",updateMediaForeground);
new MutationObserver(cleanupMediaObservers).observe(document.body,{childList:true,subtree:true});
const deferredMediaObserver=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(function(entries){entries.forEach(function(entry){const node=entry.target,load=deferredMediaLoads.get(node);if(entry.isIntersecting){if(load&&!node.dataset.loading)load();return;}if(node.isConnected&&node.dataset.virtualMedia==="1"&&node.hasAttribute("src")){node.removeAttribute("src");node.classList.remove("loaded");delete node.dataset.loading;}});},{rootMargin:"700px 500px"}):null;
const previewVideoObserver=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(function(entries){entries.forEach(function(entry){const video=entry.target;video.dataset.visible=entry.isIntersecting?"1":"0";if(entry.isIntersecting&&mediaForeground&&!video.closest("[inert]"))video.play().catch(function(){});else video.pause();});},{rootMargin:"250px 0px"}):null;
function deferMediaLoad(node,load){if(node.tagName==="IMG"&&!node.dataset.sizeBound){node.dataset.sizeBound="1";const rememberSize=function(){if(node.naturalWidth&&node.naturalHeight){node.style.aspectRatio=node.naturalWidth+" / "+node.naturalHeight;}};node.addEventListener("load",rememberSize);rememberSize();}if(!deferredMediaObserver){load();return;}observedMedia.add(node);deferredMediaLoads.set(node,load);deferredMediaObserver.observe(node);}
function hydrateOfflineMedia(){
  if(!E||!E.offlineMedia)return;
  document.querySelectorAll("[data-offline-media]").forEach(function(image){
    const ref=image.dataset.offlineMedia;if(!ref||image.dataset.loading||observedMedia.has(image))return;
    const load=function(){if(!image.isConnected)return;image.dataset.loading="1";if(offlineMediaCache.has(ref)){image.src=offlineMediaCache.get(ref);return;}requestCachedMedia("offline",ref,offlineMediaCache,80,image).then(function(src){if(src===undefined){delete image.dataset.loading;return;}if(!image.isConnected)return;if(src){rememberMedia(offlineMediaCache,ref,src,80);image.src=src;}else image.remove();}).catch(function(){if(image.isConnected)image.remove();});};if(image.closest(".deck-column-scroll")){image.dataset.virtualMedia="1";deferMediaLoad(image,load);}else load();
  });
  document.querySelectorAll("video[data-preview-loop]").forEach(function(video){if(video.dataset.previewBound)return;video.dataset.previewBound="1";video.muted=true;video.addEventListener("timeupdate",function(){const limit=Number(video.dataset.previewLoop)||5;if(video.currentTime>=Math.min(limit,video.duration||limit)){video.currentTime=0;if(mediaForeground&&video.dataset.visible==="1"&&!video.closest("[inert]"))video.play().catch(function(){});}});(observedVideos.add(video),previewVideoObserver?previewVideoObserver.observe(video):video.play().catch(function(){}));});
  document.querySelectorAll("video.of-comment-media").forEach(function(video){if(video.dataset.gifCheck)return;video.dataset.gifCheck="1";const present=function(){if(video.classList.contains("gif")||(Number.isFinite(video.duration)&&video.duration>0&&video.duration<=6)){video.controls=false;video.muted=true;video.loop=true;video.classList.add("gif");observedVideos.add(video);previewVideoObserver?.observe(video);}};video.addEventListener("loadedmetadata",present,{once:true});present();});
}
function offlineBytes(bytes){const value=Math.max(0,Number(bytes)||0),units=["B","KB","MB","GB"];let size=value,index=0;while(size>=1024&&index<units.length-1){size/=1024;index++;}return (index?size.toFixed(size>=10?1:2):String(Math.round(size)))+" "+units[index];}
function redditSourceModal(){
  const body='<div class="field"><label>Subreddit</label><input id="ors_name" placeholder="e.g. AskReddit"></div><div class="field"><label>Unread posts to keep</label><input id="ors_limit" type="number" min="1" max="100" value="30"></div><div class="field"><label>Update every</label><select id="ors_interval"><option value="6">6 hours</option><option value="12">12 hours</option><option value="24" selected>Daily</option><option value="168">Weekly</option></select></div><div class="hint">Sync clears read posts that are not favorites, then refills the unread pool. No Reddit API is used.</div>';
  openModal("Add Reddit feed",body,"Add to downloads",async function(){const button=$("#modal-confirm");if(button){button.disabled=true;button.textContent="Adding…";}const result=await E.offlineSourceAdd({platform:"reddit",handle:$("#ors_name").value,limit:Number($("#ors_limit").value),intervalHours:Number($("#ors_interval").value),sort:"new",topComments:0});if(!result||!result.ok){if(button){button.disabled=false;button.textContent="Add to downloads";}toast(result&&result.error||"Could not add source","err");return;}closeModal();await loadOfflineData();toast(offlineExtension.connected?"Reddit download queued":"Added — waiting for the browser extension",offlineExtension.connected?"ok":"warn");});
}
function offlineSourceLimitModal(source){const body='<div class="field"><label>Unread posts to keep for r/'+esc(source.handle)+'</label><input id="ofs_limit" type="number" min="1" max="100" value="'+esc(source.limit)+'"><div class="hint">Favorites are kept separately and never removed by Sync.</div></div>';openModal("Clipping post limit",body,"Save",async function(){const result=await E.offlineSourceUpdate(source.id,{limit:Number($("#ofs_limit").value)});if(!result){toast("Could not change the post limit","err");return;}closeModal();await loadOfflineData();toast("Post limit updated","ok");});}
function offlineExtensionRequiredModal(name){
  const community=name?"r/"+name:"this community";
  openModal("Browser extension not connected",'<div class="field"><b>'+esc(community)+' was added to downloads</b><div class="hint">SINRAD will start saving posts automatically when the browser extension connects. No Reddit API is needed.</div></div><div class="field"><label>Connection status</label><div>Not connected</div></div>',"Open extension folder",function(){closeModal();if(E&&E.extOpen)E.extOpen();});
}
function offlineRetentionModal(){
  const settings=offlineData.settings||{},body='<div class="field"><label>Other saved pages: expire after</label><input id="of_fresh_days" type="number" min="1" max="30" value="'+esc(settings.freshnessDays||1)+'"><div class="hint">Days. Reddit sources refresh daily; their old posts stay until replacements are saved.</div></div><div class="field"><label>History cleanup</label><select id="of_history_mode"><option value="manual"'+(settings.historyCleanupMode==="manual"?' selected':'')+'>Manual only</option><option value="age"'+(settings.historyCleanupMode==="age"?' selected':'')+'>After a set time</option><option value="storage"'+(settings.historyCleanupMode==="storage"?' selected':'')+'>When storage reaches a limit</option></select></div><div class="field"><label>Delete history after</label><input id="of_history_hours" type="number" min="1" max="87600" value="'+esc(settings.historyRetentionHours||168)+'"><div class="hint">Hours after the post was read. Used only for timed cleanup.</div></div><div class="field"><label>Storage limit</label><input id="of_history_mb" type="number" min="100" max="102400" value="'+esc(settings.historyStorageMB||1024)+'"><div class="hint">MB. Oldest History posts are removed first; Favorites and Unread are protected.</div></div><div class="field"><label>Maximum cached posts</label><input id="of_max" type="number" min="100" max="20000" value="'+esc(settings.maxItems)+'"></div>';
  openModal("Clipping history",body,"Save",async function(){const result=await E.offlineSettings({freshnessDays:Number($("#of_fresh_days").value),historyCleanupMode:$("#of_history_mode").value,historyRetentionHours:Number($("#of_history_hours").value),historyStorageMB:Number($("#of_history_mb").value),maxItems:Number($("#of_max").value)});if(result){offlineData=result;closeModal();renderView();toast("Clipping cleanup updated","ok");}else toast("Could not save Clipping settings","err");});
}
if(E&&E.onOfflineChanged)E.onOfflineChanged(function(data){const onTimeline=!offlineMode&&!monitoringMode&&currentView==="home",position=onTimeline?captureTimelinePosition():null,anchor=!onTimeline&&offlineMode&&!offlineSelectedId?captureListPosition():null;if(data)offlineData=data;reconcileRemovedTimelineOfflineItems();offlineSyncing=!!(offlineData.sync&&(offlineData.sync.active||offlineData.sync.queued));stageTimelineFeedUpdates("reddit");if(onTimeline){restoreTimelinePosition(position);refreshTimelineLightColumns();return;}if(offlineMode&&!offlineSelectedId){offlineLoading=false;E.offlineExtensionStatus().then(function(status){offlineExtension=status;renderViewAnchored(anchor,false);});}});

function monitoringDate(ts){if(!ts)return "Never";return new Date(ts).toLocaleString([],{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function monitoringMonitor(id){return (monitoringData.monitors||[]).find(function(item){return item.id===id;});}
function monitoringEvent(id){return (monitoringData.events||[]).find(function(item){return item.id===id;});}
function monitoringInterval(value){const minutes=Number(value)||1440;if(minutes<60)return minutes+"m";if(minutes%1440===0)return (minutes/1440)+"d";return (minutes/60)+"h";}
function monitoringFilteredEvents(){
  const query=monitoringQuery.trim().toLowerCase();
  const filtered=(monitoringData.events||[]).filter(function(item){
    if(monitoringFilter!=="inbox"&&item.readAt&&Date.now()-item.readAt>=3600000)return false;
    if(monitoringFilter==="inbox"&&!monitoringInboxEvent(item))return false;
    if(monitoringFilter==="unread"&&item.read&&!item.readAt)return false;
    const monitor=monitoringMonitor(item.monitorId);return !query||[item.title,item.summary,item.author,monitor&&monitor.label,item.kind].some(function(value){return String(value||"").toLowerCase().includes(query);});
  });
  return monitoringFilter==="inbox"?monitoringNewestRows(filtered):offlineMixSources(filtered);
}
function monitoringMediaTag(ref,className,alt){return ref?'<img class="'+esc(className||"")+'" data-monitoring-media="'+esc(ref)+'" data-virtual-media="1" alt="'+esc(alt||"")+'" loading="lazy">':"";}
function monitoringOriginalMediaTag(mediaPath,fallbackRef,className,alt){const path=String(mediaPath||"");if(!/^\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32,128}\.(?:jpe?g|png|webp|gif)$/i.test(path))return "";return '<img class="'+esc(className||"")+'" data-monitoring-original="'+esc(path)+'" data-monitoring-fallback="'+esc(fallbackRef||"")+'" data-virtual-media="1" alt="'+esc(alt||"")+'" loading="lazy">';}
function monitoringMediaUrl(ref){const name=String(ref||"").replace(/^media\//,"");return /^[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif)$/i.test(name)?"sinrad-monitor://cache/"+encodeURIComponent(name):"";}
function retryMonitoringMedia(image,ref){
  if(!image.isConnected)return;
  if(image.dataset.mediaFallback==="1"){image.remove();return;}
  image.dataset.mediaFallback="1";monitoringMediaCache.delete(ref);
  Promise.resolve(E&&E.monitoringMedia?E.monitoringMedia(ref):"").then(function(src){if(!image.isConnected)return;if(src){image.src=src;image.dataset.loading="1";}else image.remove();}).catch(function(){if(image.isConnected)image.remove();});
}
function hydrateMonitoringMedia(){
  if(!E||!E.monitoringMedia)return;
  document.querySelectorAll("[data-monitoring-original]").forEach(function(image){
    const mediaPath=image.dataset.monitoringOriginal;if(!mediaPath||image.dataset.loading||observedMedia.has(image))return;
    image.addEventListener("load",function(){if(image.classList.contains("mon-event-preview"))image.classList.add("loaded");});
    image.addEventListener("error",function(){const ref=image.dataset.monitoringFallback;if(ref){image.removeAttribute("data-monitoring-original");image.dataset.monitoringMedia=ref;delete image.dataset.loading;retryMonitoringMedia(image,ref);}else image.remove();},{once:true});
    const load=function(){if(!image.isConnected)return;image.dataset.loading="1";image.src=image.dataset.monitoringMedia?monitoringMediaUrl(image.dataset.monitoringMedia):"sinrad-monitor://file"+mediaPath;};deferMediaLoad(image,load);
  });
  document.querySelectorAll("[data-monitoring-media]").forEach(function(image){
    const ref=image.dataset.monitoringMedia;if(!ref||image.dataset.loading||observedMedia.has(image))return;
    if(!image.dataset.mediaErrorBound){image.dataset.mediaErrorBound="1";image.addEventListener("error",function(){retryMonitoringMedia(image,ref);});}
    image.addEventListener("load",function(){delete image.dataset.mediaFallback;});
    if(image.classList.contains("mon-event-preview")){image.addEventListener("load",function(){image.classList.add("loaded");});}
    const load=function(){if(!image.isConnected)return;const src=monitoringMediaUrl(ref);delete image.dataset.mediaFallback;if(src){image.dataset.loading="1";image.src=src;}else retryMonitoringMedia(image,ref);};deferMediaLoad(image,load);
  });
}
async function loadMonitoringData(anchor,background){
  if(!E||!E.monitoringLoad){toast("Monitoring Mode needs the desktop build","warn");return;}
  if(!background){monitoringLoading=true;renderView();}
  let changed=false;try{const result=await E.monitoringLoad();if(result){changed=JSON.stringify(result)!==JSON.stringify(monitoringData);monitoringData=result;monitoringDataReady=true;}}catch(_){toast("Could not load Monitoring Mode","err");}
  monitoringLoading=false;if(!background||changed&&monitoringMode&&!monitoringDetail&&!monitoringArtist)renderViewAnchored(anchor,false);
}
function refreshMonitoringDataAfterPaint(){return new Promise(function(resolve){requestAnimationFrame(function(){resolve(loadMonitoringData(captureListPosition(),true));});});}
function setMonitoringMode(enabled,quiet){
  closeSettings();
  if(enabled&&offlineMode)setOfflineMode(false,true);
  if(enabled&&!monitoringMode&&!offlineMode&&currentView==="home")rememberTimelinePosition();
  monitoringMode=!!enabled;if(!monitoringMode){monitoringDetailRequest++;monitoringArtistRequest++;monitoringDetail=null;monitoringDetailLoading=false;monitoringPostSequence=[];monitoringArtist=null;monitoringArtistLoading=false;monitoringReturnAnchor=null;monitoringArtistReturnAnchor=null;}const win=$("#window"),button=$("#monitoringToggle");if(win)win.classList.toggle("monitoring-mode",monitoringMode);
  if(button){button.classList.toggle("active",monitoringMode);const label=button.querySelector("b");if(label)label.textContent="Monitor";button.title=monitoringMode?"Return to normal SINRAD":"Switch to Monitoring Mode";}
  renderNav();
  if(monitoringMode){if(monitoringDataReady){monitoringLoading=false;renderView();return refreshMonitoringDataAfterPaint();}return loadMonitoringData();}else if(!quiet)renderView();
}
function leaveMonitoringPost(){
  if(!monitoringMode||(!monitoringDetail&&!monitoringDetailLoading))return false;
  const anchor=monitoringReturnAnchor;monitoringDetailRequest++;monitoringDetail=null;monitoringDetailLoading=false;monitoringPostSequence=[];monitoringFocusId="";renderViewAnchored(anchor,true);return true;
}
function leaveMonitoringArtist(){
  if(!monitoringMode||(!monitoringArtist&&!monitoringArtistLoading))return false;
  const anchor=monitoringArtistReturnAnchor;monitoringArtistRequest++;monitoringArtist=null;monitoringArtistLoading=false;monitoringFocusId="";monitoringArtistReturnAnchor=null;renderViewAnchored(anchor,true);return true;
}
async function openMonitoringArtist(id,returnAnchor){
  const monitor=monitoringMonitor(id);if(!monitor)return false;
  if(monitor.kind!=="pawchive"||!E||!E.monitoringArtistDetail){if(monitor.url)openTarget(monitor.url,"url");return false;}
  monitoringArtistReturnAnchor=returnAnchor===undefined?captureListPosition(id):returnAnchor;
  const requestId=++monitoringArtistRequest;monitoringArtistLoading=true;monitoringArtistRange={monitorId:"",from:"",to:""};monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();
  const result=await E.monitoringArtistDetail(id);if(requestId!==monitoringArtistRequest)return false;
  monitoringArtistLoading=false;if(result&&result.ok){monitoringArtist=result.artist;renderView();const content=$("#content");if(content)content.scrollTop=0;return true;}
  renderViewAnchored(monitoringArtistReturnAnchor,false);toast(result&&result.error||"Could not load that artist","err");return false;
}
function toggleMonitoringMode(){closeSettings();if(!leaveMonitoringPost()&&!leaveMonitoringArtist())setMonitoringMode(!monitoringMode);}
function monitoringPrivateText(value,salt){
  const input=String(value||"");if(!(censorModeActive()||document.documentElement.classList.contains("censor-mode"))||!input)return input;
  const glyphs="qxzvkrmptn",key=String(salt||input);let hash=2166136261;
  for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619);}
  let index=0;return input.replace(/[\p{L}\p{N}]/gu,function(){hash=Math.imul(hash^(index++ + 1),16777619);return glyphs[Math.abs(hash)%glyphs.length];});
}
function monitoringEventCard(item){
  const monitor=monitoringMonitor(item.monitorId),source=item.kind==="f95"?"F95ZONE":"PAWCHIVE";
  const privateLabel=monitoringPrivateText(monitor&&monitor.label||source,item.monitorId),privateTitle=monitoringPrivateText(item.title,item.id+":title"),privateSummary=monitoringPrivateText(item.summary,item.id+":summary");
  const avatar=monitoringMediaTag(monitor&&monitor.avatarRef,"mon-event-avatar-img",privateLabel),preview=monitoringOriginalMediaTag(item.meta&&item.meta.mediaPath,item.mediaRef,"mon-event-preview",privateTitle)||monitoringMediaTag(item.mediaRef,"mon-event-preview",privateTitle);
  const placeholder='<div class="mon-event-placeholder" aria-hidden="true"></div>';
  const sourceBadge=item.kind==='pawchive'?'<span class="mon-source pawchive"><img src="assets/pawchive.png" alt=""></span>':'<span class="mon-source f95">'+source+'</span>',artistButton=monitor&&monitor.kind==='pawchive'?'<button type="button" class="mon-event-avatar" data-action="monitoring-monitor-open" data-id="'+esc(monitor.id)+'" title="Open artist page" aria-label="Open artist page"><i>'+esc(privateLabel.charAt(0)||'P')+'</i>'+avatar+'</button>':'<span class="mon-event-avatar"><i>F</i>'+avatar+'</span>';
  return '<article class="mon-event'+(item.mediaRef?' has-image':' text-only')+(item.read?' read':'')+(item.id===monitoringFocusId?' focused':'')+'" data-action="monitoring-event-open" data-ctx="monitor-event" data-id="'+esc(item.id)+'"><div class="mon-event-media">'+placeholder+(preview||'')+sourceBadge+artistButton+'</div><div class="mon-event-copy"><div class="mon-event-meta"><b>'+esc(privateLabel)+'</b><time>'+esc(monitoringDate(item.date))+'</time></div><h2>'+esc(privateTitle)+'</h2>'+(privateSummary?'<p>'+esc(privateSummary)+'</p>':'')+'</div></article>';
}
function rememberMonitoringReturn(id){const content=$("#content");monitoringReturnScroll=content?content.scrollTop:0;monitoringReturnId=String(id||"");monitoringReturnAnchor=captureListPosition(id);}
function monitoringPostListInfo(){
  if(!monitoringDetail)return {kind:"",items:[],index:-1};let items=[],current="",kind="";
  if(monitoringDetail.eventId){kind="event";items=monitoringPostSequence.length?monitoringPostSequence.slice():monitoringFilteredEvents().filter(function(item){return item.kind==="pawchive";}).map(function(item){return String(item.id);});current=String(monitoringDetail.eventId);}
  else if(monitoringArtist&&monitoringDetail.postId){kind="artist";items=monitoringArtistRangeInfo(monitoringArtist).posts.map(function(item){return String(item.postId);});current=String(monitoringDetail.postId);}
  return {kind:kind,items:items,index:items.indexOf(current)};
}
function monitoringPostNeighbors(){const info=monitoringPostListInfo(),make=function(index){return index>=0&&index<info.items.length?{kind:info.kind,id:info.items[index],index:index}:null;};return {previous:make(info.index-1),next:make(info.index+1)};}
function monitoringFeedPager(page,total,action,id){
  if(total<2)return "";
  const current=page+1,pages=[];
  for(let value=Math.max(1,current-1);value<=Math.min(total,current+1);value++)pages.push(value);
  if(!pages.includes(1))pages.unshift(1);
  if(!pages.includes(total))pages.push(total);
  const button=function(value,label,disabled){return '<button type="button" data-action="'+action+'" data-id="'+esc(id||'')+'" data-page="'+(value-1)+'"'+(disabled?' disabled':'')+(value===current&&typeof label==='number'?' class="active" aria-current="page"':'')+'>'+label+'</button>';};
  let previous=0,numbers="";
  pages.forEach(function(value){if(previous&&value-previous>1)numbers+='<span aria-hidden="true">…</span>';numbers+=button(value,value,false);previous=value;});
  return '<nav class="mon-feed-pages" aria-label="Feed pages">'+button(current-1,'‹ Prev',current===1)+numbers+button(current+1,'Next ›',current===total)+'<small>'+current+' of '+total+'</small></nav>';
}
function monitoringPostPager(position){
  const info=monitoringPostListInfo(),total=info.items.length,current=info.index+1;if(current<1||total<2)return "";
  const pages=[];for(let page=Math.max(1,current-2);page<=Math.min(total,current+2);page++)pages.push(page);if(!pages.includes(1))pages.unshift(1);if(!pages.includes(total))pages.push(total);
  let prior=0,numbers="";pages.forEach(function(page){if(prior&&page-prior>1)numbers+='<span aria-hidden="true">…</span>';numbers+='<button type="button" class="'+(page===current?'active':'')+'" data-action="monitoring-post-page" data-index="'+(page-1)+'"'+(page===current?' aria-current="page"':'')+'>'+page+'</button>';prior=page;});
  return '<nav class="mon-post-pages '+(position==='bottom'?'bottom':'top')+'" aria-label="Activity post navigation"><button type="button" data-action="monitoring-post-nav" data-id="previous"'+(current===1?' disabled':'')+'>‹ Prev</button>'+numbers+'<button type="button" data-action="monitoring-post-nav" data-id="next"'+(current===total?' disabled':'')+'>Next ›</button><small>'+current+' of '+total+'</small></nav>';
}
async function navigateMonitoringPostIndex(index){
  const info=monitoringPostListInfo(),targetIndex=Number(index);if(!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=info.items.length){toast("That post is no longer available","warn");return;}const target={kind:info.kind,id:info.items[targetIndex]};
  const requestId=++monitoringDetailRequest;monitoringDetailLoading=true;renderView();let result=null;
  if(target.kind==="event"&&E&&E.monitoringPostDetail){const item=monitoringEvent(target.id);if(item&&(!item.read||!item.readAt)&&E.monitoringEventUpdate){item.read=true;item.readAt=Date.now();await E.monitoringEventUpdate(item.id,{read:true});}result=await E.monitoringPostDetail(target.id);}
  else if(target.kind==="artist"&&monitoringArtist&&E&&E.monitoringArtistPostDetail)result=await E.monitoringArtistPostDetail(monitoringArtist.monitorId,target.id);
  if(requestId!==monitoringDetailRequest)return;monitoringDetailLoading=false;if(result&&result.ok){monitoringDetail=result.detail;renderView();const content=$("#content");if(content)content.scrollTop=0;}else{renderView();toast(result&&result.error||"Could not open that post","err");}
}
async function navigateMonitoringPost(direction){const info=monitoringPostListInfo(),index=info.index+(direction==="previous"?-1:1);if(index<0||index>=info.items.length){toast(direction==="previous"?"No previous post":"No next post","warn");return;}await navigateMonitoringPostIndex(index);}
function viewMonitoringWatchlist(){
  const monitors=monitoringData.monitors||[];
  const list=monitors.length?'<div class="mon-watch-list">'+monitors.map(function(item){
    const type=item.kind==="f95"?"F95zone":"Pawchive",status=item.lastError?item.lastError:(item.initialized?'Last checked '+monitoringDate(item.lastChecked):'Creating first baseline…');
    const privateLabel=monitoringPrivateText(item.label,item.id),avatar=monitoringMediaTag(item.avatarRef,"mon-watch-avatar-img",privateLabel),banner=monitoringMediaTag(item.bannerRef,"mon-watch-banner","");
    return '<article class="mon-watch'+(item.enabled?'':' paused')+'" data-action="monitoring-monitor-open" data-ctx="monitor" data-id="'+esc(item.id)+'"><div class="mon-watch-hero">'+(banner||'<div class="mon-watch-banner-fallback"></div>')+'<span class="mon-watch-avatar '+esc(item.kind)+'"><i>'+(item.kind==='f95'?'F95':esc(privateLabel.charAt(0)||'P'))+'</i>'+avatar+'</span><div class="mon-watch-identity"><b>'+esc(privateLabel)+'</b><span>'+esc(type)+' · '+(item.enabled?'Watching':'Paused')+'</span></div></div><div class="mon-watch-meta"><span>Every '+esc(monitoringInterval(item.intervalMinutes))+'</span><span class="'+(item.lastError?'error':'')+'">'+esc(status)+'</span></div></article>';
  }).join('')+'</div>':emptyState("◉","Nothing is being watched yet. Add a Pawchive, Bakemono or F95zone link.");
  return '<div class="mon-watchlist" data-ctx="monitor-watchlist" data-id="watchlist">'+list+'</div>';
}
function monitoringArtistPostCard(item){
  const preview=item.previewSrc?'<img class="mon-artist-preview" src="'+esc(item.previewSrc)+'" alt="" loading="lazy">':'<div class="mon-event-placeholder"><b>PAWCHIVE</b><span>Artist post</span></div>';
  const privateTitle=monitoringPrivateText(item.title,item.postId+":title"),privateSummary=monitoringPrivateText(item.summary,item.postId+":summary");
  return '<article class="mon-artist-post" data-action="monitoring-artist-post-open" data-ctx="monitor-artist-post" data-id="'+esc(item.postId)+'"><div class="mon-artist-post-media">'+preview+'</div><div class="mon-artist-post-copy"><time>'+esc(monitoringDate(item.date))+'</time><h2>'+esc(privateTitle)+'</h2>'+(privateSummary?'<p>'+esc(privateSummary)+'</p>':'')+'<small>'+esc(item.attachmentCount||0)+' file'+(Number(item.attachmentCount)===1?'':'s')+'</small></div></article>';
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
  const days=monitoringArtistPostDays(artist),side=monitoringDatePicker.side==='to'?'To':'From',edge=monitoringDatePicker.side==='to'?'latest':'earliest',head='<div class="mon-date-picker-head"><b>Choose '+side+' date</b><div><button type="button" data-action="monitoring-artist-date-edge" data-edge="'+edge+'">'+(edge==='latest'?'Latest':'Earliest')+'</button></div></div>';let options='';
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
  const privateLabel=monitoringPrivateText(artist.label,artist.monitorId);
  const avatar=monitoringMediaTag(artist.avatarRef,"mon-artist-avatar-img",privateLabel),banner=monitoringMediaTag(artist.bannerRef,"mon-artist-banner","");
  const info=monitoringArtistRangeInfo(artist),posts=info.posts,cards=posts.length?'<div class="mon-artist-grid">'+posts.map(monitoringArtistPostCard).join('')+'</div>':emptyState("◎",info.valid?"No works match this date range.":"Choose a valid From and To date.");
  const range='<div class="mon-artist-range"><div class="mon-range-title"><b>Filter works by date</b><span>'+esc(posts.length)+' of '+esc(info.all.length)+' shown</span></div><div class="mon-range-fields"><button type="button" class="mon-range-date'+(monitoringDatePicker.side==='from'?' active':'')+'" data-action="monitoring-artist-date-open" data-side="from"><small>From</small><b>'+esc(monitoringRangeDateLabel(monitoringArtistRange.from))+'</b></button><span>→</span><button type="button" class="mon-range-date'+(monitoringDatePicker.side==='to'?' active':'')+'" data-action="monitoring-artist-date-open" data-side="to"><small>To</small><b>'+esc(monitoringRangeDateLabel(monitoringArtistRange.to))+'</b></button><button class="btn" data-action="monitoring-artist-range-reset">Show all</button><button class="btn primary" data-action="monitoring-artist-download-range"'+(!posts.length||!info.valid?' disabled':'')+'>Download shown ('+esc(posts.length)+')</button></div>'+monitoringArtistDatePicker(artist)+'</div>';
  return '<div class="mon-artist" data-ctx="monitor-artist" data-id="'+esc(artist.monitorId)+'"><section class="mon-artist-hero">'+(banner||'<div class="mon-watch-banner-fallback"></div>')+'<div class="mon-artist-shade"></div><span class="mon-artist-avatar"><i>'+esc(privateLabel.charAt(0)||'P')+'</i>'+avatar+'</span><div class="mon-artist-title"><span>'+esc(String(artist.service||'Pawchive').toUpperCase())+'</span><h1>'+esc(privateLabel)+'</h1><p>'+esc(info.all.length)+' works · checked every '+esc(monitoringInterval(artist.intervalMinutes))+'</p></div></section>'+range+'<div class="mon-artist-note">Only the works inside the selected dates are shown below. Right-click this page for more options.</div>'+cards+'</div>';
}
function monitoringFilePreview(file,index,displayName){
  if(file.kind==='image')return '<div class="mon-media-frame image"><img class="mon-reader-media'+(/\.gif(?:$|\?)/i.test(String(file.name||file.src||''))?' animated':'')+'" src="'+esc(file.src)+'" data-action="monitoring-image-expand" data-ctx="monitor-file" data-id="'+index+'" data-index="'+index+'" alt="" loading="lazy" decoding="async"><span class="mon-media-state">Loading preview…</span></div>';
  if(file.kind==='video')return '<div class="mon-media-frame video"><video class="mon-reader-media" data-action="monitoring-video-toggle" data-ctx="monitor-file" data-id="'+index+'" preload="metadata" playsinline><source src="'+esc(file.src)+'" type="'+(String(file.name||'').toLowerCase().endsWith('.webm')?'video/webm':'video/mp4')+'"></video><span class="mon-media-state">Loading video…</span></div>';
  if(file.kind==='audio')return '<div class="mon-media-frame audio"><audio class="mon-reader-audio" src="'+esc(file.src)+'" controls preload="none"></audio><span class="mon-media-state">Loading audio…</span></div>';
  return '<button type="button" class="mon-media-file" data-action="monitoring-download" data-index="'+index+'"><span class="mon-media-file-icon"><svg viewBox="0 0 48 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 10h36v26H6zM3 4h42v6H3zM18 18h12v5H18z"/></svg></span><b>'+esc(displayName||file.name)+'</b><small>ZIP / FILE · DOWNLOAD</small><span class="mon-download-arrow" aria-hidden="true">↓</span></button>';
}
function viewMonitoringDetail(detail,showBack){
  const privateCreator=monitoringPrivateText(detail.creator,detail.monitorId||detail.postId||detail.eventId),privateTitle=monitoringPrivateText(detail.title,(detail.postId||detail.eventId)+":title"),privateAuthor=monitoringPrivateText(detail.author,(detail.postId||detail.eventId)+":author"),privateBody=monitoringPrivateText(detail.content,(detail.postId||detail.eventId)+":body");
  const files=(detail.files||[]),media=files.map(function(file,index){const plain=file.kind!=="image"&&file.kind!=="video"&&file.kind!=="audio",privateName=monitoringPrivateText(file.name,(detail.postId||detail.eventId)+":file:"+index);return '<figure class="mon-file" data-ctx="monitor-file" data-id="'+index+'">'+monitoringFilePreview(file,index,privateName)+(plain?'':'<figcaption><b>'+esc(privateName)+'</b><small>'+esc(file.kind)+'</small></figcaption>')+'</figure>';}).join('');
  const creator=detail.monitorId?'<button type="button" class="mon-reader-creator" data-action="monitoring-post-artist-open" data-id="'+esc(detail.monitorId)+'" title="Open artist page">'+esc(privateCreator)+'</button>':esc(privateCreator);
  const pager=showBack===false?'':monitoringPostPager('top'),bottomPager=showBack===false?'':monitoringPostPager('bottom');
  return '<div class="mon-reader"><article class="mon-reader-post" data-ctx="monitor-post" data-id="current"><div class="mon-reader-kicker">PAWCHIVE · '+creator+' · '+esc(monitoringDate(detail.date))+'</div>'+pager+'<h1>'+esc(privateTitle)+'</h1>'+(detail.author?'<div class="mon-reader-byline">'+esc(privateAuthor)+'</div>':'')+'<div class="mon-reader-body">'+esc(privateBody||'This post contains no additional text.')+'</div>'+(files.length?'<section class="mon-files"><h2>Files · '+files.length+'</h2><div class="mon-file-row" data-count="'+Math.min(files.length,3)+'">'+media+'</div></section>':'<p class="mon-no-files">No downloadable files were listed for this post.</p>')+bottomPager+'</article></div>';
}
function hydrateMonitoringDetailMedia(){
  document.querySelectorAll('.mon-media-frame').forEach(function(frame){
    const media=frame.querySelector('img,video,audio'),state=frame.querySelector('.mon-media-state');if(!media||!state)return;
    const ready=function(){frame.classList.add('ready');frame.classList.remove('failed');};
    const failed=function(){if(media.tagName==='IMG'&&media.naturalWidth){ready();return;}frame.classList.add('failed');state.textContent='Preview unavailable · right-click to download';};
    media.addEventListener(media.tagName==='IMG'?'load':'loadedmetadata',ready,{once:true});media.addEventListener('error',failed,{once:true});
    if(media.tagName==='IMG'&&media.complete)(media.naturalWidth?ready():failed());else if(media.tagName!=='IMG'&&media.readyState>=1)ready();
  });
}
const monitoringFeedPages=new Map();
const MONITORING_PAGE_SIZE=60;
function renderMonitoringView(){
  animateNavigation();
  const content=$("#content");if(!content)return;
  if(monitoringLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Loading Monitoring Mode…</b></div>';return;}
  if(monitoringDetailLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Opening Pawchive post…</b></div>';return;}
  if(monitoringDetail){content.innerHTML='<div class="monitoring-shell">'+viewMonitoringDetail(monitoringDetail)+'</div>';hydrateMonitoringDetailMedia();return;}
  if(monitoringArtistLoading){content.innerHTML='<div class="mon-loading"><i></i><b>Loading all artist works…</b></div>';return;}
  if(monitoringArtist){content.innerHTML='<div class="monitoring-shell">'+viewMonitoringArtist(monitoringArtist)+'</div>';hydrateMonitoringMedia();return;}
  const unread=(monitoringData.events||[]).filter(function(item){return !item.read;}).length,events=monitoringFilteredEvents();
  const head='<header class="mon-head"><div class="mode-heading"><div><h1>Notifications</h1></div></div></header>';
  const tabs='<nav class="mon-tabs"><button class="'+(monitoringTab==='activity'?'active':'')+'" data-action="monitoring-tab" data-tab="activity">Activity <b>'+esc(monitoringData.events.length)+'</b></button><button class="'+(monitoringTab==='watchlist'?'active':'')+'" data-action="monitoring-tab" data-tab="watchlist">Watchlist <b>'+esc(monitoringData.monitors.length)+'</b></button><span></span><button class="mon-collections-tab '+(monitoringTab==='collections'?'active':'')+'" data-action="monitoring-tab" data-tab="collections">Folders</button><button class="mon-censor-toggle '+(censorModeActive()?'active':'')+'" data-action="censor-toggle" aria-label="Toggle Censor Mode" aria-pressed="'+censorModeActive()+'">cen</button><small>'+esc(unread)+' unread · updated '+esc(monitoringDate(monitoringData.updatedAt))+'</small></nav>';
  if(monitoringTab==='collections'){content.innerHTML='<div class="monitoring-shell">'+head+tabs+viewMonitoringCollections()+'</div>';hydrateMonitoringMedia();return;}
  if(monitoringTab==='watchlist'){const watchToolbar='<div class="mon-toolbar mon-watch-toolbar"><span>Watching '+esc(monitoringData.monitors.length)+' source'+(monitoringData.monitors.length===1?'':'s')+'</span><small>Right-click to add or manage watchers</small></div>';content.innerHTML='<div class="monitoring-shell">'+head+tabs+watchToolbar+viewMonitoringWatchlist()+'</div>';hydrateMonitoringMedia();return;}
  const toolbar='<div class="mon-toolbar"><input id="monitoringSearch" value="'+esc(monitoringQuery)+'" placeholder="Search monitoring activity…"><div><button class="'+(monitoringFilter==='inbox'?'active':'')+'" aria-pressed="'+(monitoringFilter==='inbox')+'" data-action="monitoring-filter" data-filter="inbox">Inbox</button></div></div>';
  const pageKey=monitoringFilter+":"+monitoringQuery;
  const focusIndex=monitoringFocusId?events.findIndex(item=>item.id===monitoringFocusId):-1;
  const page=Math.min(Math.max(0,Math.ceil(events.length/MONITORING_PAGE_SIZE)-1),focusIndex>=0?Math.floor(focusIndex/MONITORING_PAGE_SIZE):(monitoringFeedPages.get(pageKey)||0));
  monitoringFeedPages.set(pageKey,page);
  const pageRows=events.slice(page*MONITORING_PAGE_SIZE,(page+1)*MONITORING_PAGE_SIZE);
  const pager=monitoringFeedPager(page,Math.ceil(events.length/MONITORING_PAGE_SIZE),"monitoring-feed-page");
  const body=events.length?'<div class="mon-events">'+pageRows.map(monitoringEventCard).join('')+'</div>'+pager:emptyState("◎",monitoringData.events.length?'Nothing matches this filter.':'No new updates yet. Add a watcher; its first check quietly records the current latest entry.');
  content.innerHTML='<div class="monitoring-shell">'+head+tabs+toolbar+pager+body+'</div>';
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
if(E&&E.onMonitoringChanged)E.onMonitoringChanged(function(data){const onTimeline=!offlineMode&&!monitoringMode&&currentView==="home",anchor=monitoringMode&&!monitoringDetail&&!monitoringArtist?captureListPosition():null;const changed=!!data&&JSON.stringify([data.events,data.monitors])!==JSON.stringify([monitoringData.events,monitoringData.monitors]);if(data)monitoringData=data;monitoringLoading=false;monitoringSyncing=false;if(!changed)return;stageTimelineFeedUpdates("monitoring");if(onTimeline){refreshTimelineLightColumns();return;}if(monitoringMode&&!monitoringDetail&&!monitoringArtist&&!monitoringDetailLoading)renderViewAnchored(anchor,false);});
if(E&&E.onMonitoringOpenEvent)E.onMonitoringOpenEvent(function(id){monitoringFocusId=String(id||"");monitoringTab="activity";monitoringFilter="all";setMonitoringMode(true);});
let monitoringDownloadHideTimer=null,timelineDownloadProgress=null;
function paintMonitoringDownload(progress){
  const status=$("#monitorDownloadStatus"),text=$("#monitorDownloadText");if(!status||!text||!progress)return;clearTimeout(monitoringDownloadHideTimer);status.classList.add("show");status.classList.toggle("done",progress.status==="done");status.classList.toggle("failed",progress.status==="failed");
  if(progress.status==="active")text.textContent="Downloading "+progress.done+" / "+(progress.total||"?")+(progress.queued?" · "+progress.queued+" queued":"");else if(progress.status==="done")text.textContent="Download complete · "+(progress.files||progress.done||0)+" saved";else if(progress.status==="failed")text.textContent="Download failed · click to open folder";else{text.textContent="Download canceled";monitoringDownloadHideTimer=setTimeout(function(){status.classList.remove("show");},1800);}
  if(progress.status==="done"||progress.status==="failed")monitoringDownloadHideTimer=setTimeout(function(){status.classList.remove("show");},6000);
  if(monitoringArtist&&progress.status==="active"){const note=document.querySelector('.mon-artist-note');if(note)note.textContent='Downloading '+progress.done+' / '+(progress.total||'?')+' works · '+progress.files+' files saved'+(progress.failed?' · '+progress.failed+' skipped':'');}
}
if(E&&E.onMonitoringDownloadProgress)E.onMonitoringDownloadProgress(function(progress){timelineDownloadProgress=progress;paintMonitoringDownload(progress);refreshTimelineLightColumns();});

function fmtDate(ts){ if(!ts) return ''; var d=new Date(ts); var t=d.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit'}); var now=new Date(); var sameDay=d.toDateString()===now.toDateString(); if(sameDay) return '['+t+'] Today'; var yesterday=new Date(now); yesterday.setDate(now.getDate()-1); if(d.toDateString()===yesterday.toDateString()) return '['+t+'] Yesterday'; return '['+t+'] '+d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
const _modulePreviewCache=new Map(),_modulePreviewPending=new Map();
let _modulePreviewObserver=null;
function _previewKey(kind,value,mode){
  value=String(value||"");mode=mode==="icon"?"icon":"rich";
  if(kind==="site"&&mode==="icon"){try{value=new URL(value).origin;}catch(_){}}
  return kind+"\u0000"+mode+"\u0000"+value;
}
function _previewRemember(key,result){
  if(!result||!result.data)return;
  if(_modulePreviewCache.has(key))_modulePreviewCache.delete(key);
  _modulePreviewCache.set(key,result);
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

const IDEA_TYPES={idea:"Feature",ui:"Quick change",bug:"Problem",task:"Task"};
const IDEA_STATUSES={inbox:"Inbox",ready:"In Progress",testing:"Testing",done:"Done"};
const IDEA_GROUPS={app:"App",other:"Other",unsorted:"Unsorted"};
function ideaType(value){return Object.prototype.hasOwnProperty.call(IDEA_TYPES,value)?value:"idea";}
function ideaStatus(value){value=value==="planned"?"ready":value==="working"?"testing":value;return Object.prototype.hasOwnProperty.call(IDEA_STATUSES,value)?value:"inbox";}
function ideaGroup(value){return Object.prototype.hasOwnProperty.call(IDEA_GROUPS,value)?value:"app";}
function ideaById(id){return find(state.ideas||[],id);}
function ideaTitleFromText(value){const first=String(value||"").split(/\r?\n/).map(function(line){return line.trim();}).find(Boolean)||"Untitled idea";return first.replace(/^[#>*\-\s]+/,"").slice(0,90)||"Untitled idea";}
function ideaUrls(value){const matches=String(value||"").match(/https?:\/\/[^\s<>]+/gi)||[];return Array.from(new Set(matches.map(function(url){return url.replace(/[),.;]+$/,"");}))).join("\n");}
function ideaCodexText(item){
  if(!item)return "";
  const parts=["SINRAD IDEA","","Title: "+String(item.title||"Untitled idea"),"Type: "+IDEA_TYPES[ideaType(item.type)],"Tag: "+IDEA_GROUPS[ideaGroup(item.group)],"Status: "+IDEA_STATUSES[ideaStatus(item.status)],"","What I want:",String(item.details||item.original||"").trim()||"No extra details yet."];
  if(item.references)parts.push("","References:",String(item.references).trim());
  if(item.reviewNote)parts.push("","Audit:",String(item.reviewNote).trim());
  if(item.original&&String(item.original).trim()!==String(item.details||"").trim())parts.push("","Original note (preserve this context):",String(item.original).trim());
  parts.push("","Please inspect the current SINRAD app, confirm the intended behavior, implement this change without breaking existing workflows, and test the packaged build.");
  return parts.join("\n");
}
function ideaVisibleItems(){
  const term=searchTerms.ideas||"";
  const workflow=ideaFilter!=="all"&&ideaFilter!=="inbox";
  return (state.ideas||[]).filter(function(item){return (ideaFilter==="all"||ideaStatus(item.status)===ideaFilter)&&(workflow?ideaGroup(item.group)==="app":ideaGroupFilter==="all"||ideaGroup(item.group)===ideaGroupFilter)&&match(term,item.title,item.details,item.original,item.references,item.reviewNote,item.type,item.status,item.group);}).slice().sort(function(a,b){return Number(b.updated||b.created||0)-Number(a.updated||a.created||0);});
}
function ideaImportInstructions(){
  const staged=ideaImportMedia.map(function(item){return item.name;});
  return ["I am collecting development ideas for SINRAD. I will send screenshots first, then explain what I want. Talk with me normally and help clarify it. When I ask for the final import, return only this plain-text format:","","SINRAD_IDEAS_V1","","IDEA","TITLE: Short clear title","TYPE: problem | quick change | feature | task","TAG: app | other | unsorted","DETAILS: A concise description of what should change","REFERENCES: screenshot names or links, separated by |","---","IDEA","TITLE: Another idea","TYPE: feature","TAG: app","DETAILS: Description","REFERENCES:","",staged.length?("These screenshots are already staged in SINRAD. Use their exact filenames in REFERENCES so SINRAD attaches each one to the correct idea:\n"+staged.join("\n")):"Use the exact screenshot filenames shown in this chat in REFERENCES.","","Keep my intent and screenshot references. Split separate requests into separate IDEA blocks. Use app for SINRAD changes, other for unrelated projects, and unsorted when unclear. Do not include markdown fences or any text outside the format.","","The app is local and does not use AI. I will paste your final block into SINRAD's Chat Import screen."].join("\n");
}
function ideaImportType(value,title,details){
  const raw=String(value||"").toLowerCase(),text=(String(title||"")+" "+String(details||"")).toLowerCase();
  if(/problem|bug|fix|broken|issue/.test(raw))return "bug";
  if(/quick|ui|change/.test(raw))return "ui";
  if(/task|chore/.test(raw))return "task";
  if(/feature|idea/.test(raw))return "idea";
  if(/\b(?:bug|broken|issue|doesn'?t|not working)\b/.test(text))return "bug";
  if(/\b(?:shorter|smaller|spacing|button|colour|color|animation|icon|ui)\b/.test(text))return "ui";
  return "idea";
}
function parseIdeaImport(value){
  const raw=String(value||"").replace(/\r/g,"").trim();if(!raw)return [];
  const body=raw.replace(/^\s*SINRAD_IDEAS_V1\s*/i,"").trim(),blocks=body.split(/\n\s*---+\s*\n|\n(?=\s*IDEA\s*\n)/i),items=[];
  blocks.forEach(function(block){
    let text=String(block||"").replace(/^\s*IDEA\s*\n?/i,"").trim();if(!text)return;
    const fields={};let active="";
    text.split("\n").forEach(function(line){const match=line.match(/^\s*(TITLE|TYPE|TAG|GROUP|DETAILS?|SUMMARY|REFERENCES?|REFS?)\s*:\s*(.*)$/i);if(match){active=match[1].toLowerCase();fields[active]=match[2].trim();}else if(active&&line.trim())fields[active]+=(fields[active]?"\n":"")+line.trim();});
    const title=fields.title||"",details=fields.details||fields.detail||fields.summary||"",refs=fields.references||fields.reference||fields.refs||fields.ref||"";
    if(title||details)items.push({title:ideaTitleFromText(title||details),details:details||title,references:String(refs).split("|").map(function(ref){return ref.trim();}).filter(Boolean).join("\n"),type:ideaImportType(fields.type,title,details),group:ideaGroup(fields.tag||fields.group)});
  });
  if(items.length)return items.slice(0,100);
  const refs=body.split("\n").filter(function(line){return /^\s*references?\s*:/i.test(line);}).map(function(line){return line.replace(/^\s*references?\s*:\s*/i,"").trim();}).join("\n");
  body.split("\n").forEach(function(line){const match=line.match(/^\s*[•*-]\s+(.+?)\s*$/);if(!match)return;const title=match[1].trim();if(title)items.push({title:ideaTitleFromText(title),details:title,references:refs,type:ideaImportType("",title,title)});});
  return items.slice(0,100);
}
function ideaModal(item){
  item=item||{};const editing=!!item.id,type=ideaType(item.type),status=editing?ideaStatus(item.status):"ready",group=ideaGroup(item.group);
  ideaEditMedia=(Array.isArray(item.attachments)?item.attachments:[]).map(function(media){return {name:String(media.name||"Attachment"),file:String(media.file||"")};}).filter(function(media){return media.file;});
  const typeOptions=Object.keys(IDEA_TYPES).map(function(key){return '<option value="'+key+'"'+(key===type?' selected':'')+'>'+esc(IDEA_TYPES[key])+'</option>';}).join("");
  const statusOptions=Object.keys(IDEA_STATUSES).map(function(key){return '<option value="'+key+'"'+(key===status?' selected':'')+'>'+esc(IDEA_STATUSES[key])+'</option>';}).join("");
  const groupOptions=Object.keys(IDEA_GROUPS).map(function(key){return '<option value="'+key+'"'+(key===group?' selected':'')+'>'+esc(IDEA_GROUPS[key])+'</option>';}).join("");
  const original=editing&&item.original?'<details class="idea-original"><summary>Original note</summary><div>'+esc(item.original)+'</div></details>':"";
  openModal(editing?"Edit idea":"New idea",'<div class="idea-modal-grid"><div class="field idea-modal-title"><label>Short title</label><input id="idea_title" value="'+esc(item.title||"")+'" placeholder="e.g. Make the settings rows shorter"></div><div class="field"><label>Type</label><select id="idea_type">'+typeOptions+'</select></div><div class="field"><label>Tag</label><select id="idea_group">'+groupOptions+'</select></div><div class="field"><label>Status</label><select id="idea_status">'+statusOptions+'</select></div></div><div class="field"><label>Details — write naturally</label><textarea id="idea_details" rows="7" placeholder="Say what you want changed in your own words">'+esc(item.details||"")+'</textarea></div><div class="field"><label>References <span style="color:var(--dim)">(links, filenames, or reminders)</span></label><textarea id="idea_refs" rows="3" placeholder="https://... or image-214.png">'+esc(item.references||"")+'</textarea></div><div class="idea-edit-media-head"><b>Images</b><button type="button" class="btn" data-action="idea-edit-images-pick">Add images</button></div><div id="idea_edit_media"></div>'+original,"Save",async function(){
    const details=$("#idea_details").value.trim(),enteredTitle=val("idea_title"),title=enteredTitle||ideaTitleFromText(details),nextType=ideaType(val("idea_type")),nextGroup=ideaGroup(val("idea_group")),nextStatus=ideaStatus(val("idea_status")),references=$("#idea_refs").value.trim();
    if(!details&&!enteredTitle){toast("Write the idea first","warn");return;}
    if(nextStatus!=="inbox"&&nextGroup!=="app"){toast("Only App ideas can enter In Progress, Testing, or Done","warn");return;}
    const existing=editing?ideaById(item.id):null,previous=existing?Object.assign({},existing,{attachments:(existing.attachments||[]).map(function(media){return Object.assign({},media);})}):null;
    rememberUndo((existing?"Edited":"Added")+" idea "+title);
    const attachments=ideaEditMedia.map(function(media){return {name:media.name,file:media.file};}),entry=existing?Object.assign(existing,{title:title,details:details,references:references,type:nextType,group:nextGroup,status:nextStatus,attachments:attachments,updated:nowMs()}):{id:uid(),title:title,details:details,original:details,references:references,type:nextType,group:nextGroup,status:nextStatus,attachments:attachments,created:nowMs(),updated:nowMs()};
    if(!existing)state.ideas.unshift(entry);
    const saved=await flushSave();
    if(!saved){if(existing)Object.assign(existing,previous);else state.ideas=state.ideas.filter(function(candidate){return candidate.id!==entry.id;});toast("Idea could not be saved","err");return;}
    closeModal();renderView();toast(existing?"Idea updated":"Idea saved","ok");
  });
  renderIdeaEditMedia();
}
function ideaEditMediaHtml(){
  if(!ideaEditMedia.length)return '<div class="idea-edit-media-empty">No images attached yet.</div>';
  return '<div class="idea-attachments">'+ideaEditMedia.map(function(media,index){return '<figure><img src="sinrad-idea://media/'+encodeURIComponent(media.file)+'" alt="'+esc(media.name)+'"><figcaption>'+esc(media.name)+'</figcaption><button type="button" data-action="idea-edit-image-remove" data-index="'+index+'" title="Remove image">×</button></figure>';}).join("")+'</div>';
}
function renderIdeaEditMedia(){const target=$("#idea_edit_media");if(target)target.innerHTML=ideaEditMediaHtml();}
async function pickIdeaEditImages(){
  if(!E||!E.ideaImagesPick){toast("Adding images needs the desktop build","warn");return;}
  const result=await E.ideaImagesPick();if(result&&result.ok){(result.items||[]).forEach(function(media){if(media&&media.file&&!ideaEditMedia.some(function(saved){return saved.file===media.file;}))ideaEditMedia.push({name:String(media.name||"Image"),file:String(media.file)});});renderIdeaEditMedia();if(result.items&&result.items.length)toast("Added "+result.items.length+" image"+(result.items.length===1?"":"s"),"ok");}else if(!(result&&result.canceled))toast(result&&result.error||"Images could not be added","err");
}
async function ideaQuickAdd(){
  const box=$("#idea_quick"),raw=box?box.value.trim():"";if(!raw){toast("Write the idea first","warn");if(box)box.focus();return;}
  const entry={id:uid(),title:ideaTitleFromText(raw),details:raw,original:raw,references:ideaUrls(raw),type:ideaType(val("idea_quick_type")),group:"app",status:"ready",created:nowMs(),updated:nowMs()};
  rememberUndo("Added idea "+entry.title);state.ideas.unshift(entry);const saved=await flushSave();
  if(!saved){state.ideas=state.ideas.filter(function(item){return item.id!==entry.id;});toast("Idea could not be saved","err");return;}
  renderView();toast("Added to Ideas inbox","ok");
}
function copyVisibleIdeas(){
  const items=ideaVisibleItems();if(!items.length){toast("No ideas are visible","warn");return;}
  const text="SINRAD IDEAS TO REVIEW\n\n"+items.map(function(item,index){return "--- IDEA "+(index+1)+" ---\n"+ideaCodexText(item);}).join("\n\n");copy(text,"Ideas for Codex");
}
function ideaStatusIcon(status){return status==="inbox"?"⌑":status==="ready"?"✓":status==="testing"?"△":"▣";}
function ideaSideNav(counts){
  const rows=[{id:"inbox",label:"Inbox"},{id:"import",label:"Chat import"},{id:"ready",label:"In Progress"},{id:"testing",label:"Testing"},{id:"done",label:"Done"}];
  return '<aside class="idea-side"><div class="idea-side-label">Ideas</div>'+rows.map(function(row){const count=row.id==="import"?"":counts[row.id]||0;return '<button type="button" class="idea-side-item'+(ideaPane===row.id?' active':'')+'" data-action="idea-pane" data-pane="'+row.id+'"><span class="idea-side-icon">'+ideaStatusIcon(row.id)+'</span><b>'+row.label+'</b>'+(row.id!=="import"?'<span>'+count+'</span>':'')+'</button>';}).join("")+'</aside>';
}
function mergeIdeaImportMedia(items){
  (Array.isArray(items)?items:[]).forEach(function(item){if(!item||!item.file||ideaImportMedia.some(function(saved){return saved.file===item.file;}))return;ideaImportMedia.push({name:String(item.name||"Screenshot"),file:String(item.file)});});
}
async function pickIdeaImportImages(){
  if(!E||!E.ideaImagesPick){toast("Image import needs the desktop build","warn");return;}
  const result=await E.ideaImagesPick();if(result&&result.ok){mergeIdeaImportMedia(result.items);renderView();if(result.items&&result.items.length)toast("Staged "+result.items.length+" image"+(result.items.length===1?"":"s"),"ok");}else if(!(result&&result.canceled))toast(result&&result.error||"Images could not be added","err");
}
async function importIdeaImageFiles(files){
  if(!E||!E.ideaImagesImport)return;const selected=Array.from(files||[]).filter(function(file){return /^image\/(?:jpeg|png|webp|gif)$/i.test(file.type)||/\.(?:jpe?g|png|webp|gif)$/i.test(file.name||"");}).slice(0,20);if(!selected.length){toast("Drop or paste JPG, PNG, WebP, or GIF images","warn");return;}
  try{const payload=[];for(const file of selected)payload.push({name:file.name||("pasted-image-"+Date.now()+".png"),type:file.type||"",bytes:new Uint8Array(await file.arrayBuffer())});const result=await E.ideaImagesImport(payload);if(!result||!result.ok)throw new Error(result&&result.error||"Images could not be added");mergeIdeaImportMedia(result.items);renderView();toast("Staged "+result.items.length+" image"+(result.items.length===1?"":"s"),"ok");}catch(error){toast(String(error&&error.message||error),"err");}
}
function ideaImportMediaFor(item,total){
  if(Array.isArray(item.attachments))return item.attachments.slice();if(total===1)return ideaImportMedia.slice();const text=[item.title,item.details,item.references].join("\n").toLowerCase();return ideaImportMedia.filter(function(media){return text.includes(String(media.name||"").toLowerCase());});
}
function ideaImportMediaUsage(items){
  const used=new Set();(items||[]).forEach(function(item){ideaImportMediaFor(item,items.length).forEach(function(media){used.add(media.file);});});return {used:used,unmatched:ideaImportMedia.filter(function(media){return !used.has(media.file);})};
}
function ideaImportView(){
  const preview=ideaImportPreview||[],usage=ideaImportMediaUsage(preview),valid=preview.length>0&&usage.unmatched.length===0;
  const cards=preview.length?preview.map(function(item){const media=ideaImportMediaFor(item,preview.length);return '<article class="idea-import-card type-'+ideaType(item.type)+'"><div><span>'+esc(IDEA_TYPES[ideaType(item.type)])+' · '+esc(IDEA_GROUPS[ideaGroup(item.group)])+'</span><b>'+esc(item.title)+'</b>'+(media.length?'<small>'+media.length+' image'+(media.length===1?'':'s')+'</small>':item.references?'<small>'+esc(String(item.references).split(/\r?\n/)[0])+'</small>':'')+'</div><p>'+esc(item.details||item.title)+'</p></article>';}).join(""):'<div class="idea-import-empty">Paste the final block from your chat, then check it here before saving.</div>';
  const staged=ideaImportMedia.length?'<div class="idea-import-media">'+ideaImportMedia.map(function(media,index){return '<figure><img src="sinrad-idea://media/'+encodeURIComponent(media.file)+'" alt="'+esc(media.name)+'"><figcaption>'+esc(media.name)+'</figcaption><button type="button" data-action="idea-import-image-remove" data-index="'+index+'" title="Remove image">×</button></figure>';}).join("")+'</div>':'<div class="idea-import-drop-empty"><b>Add the image first</b><span>Paste, drop, or choose screenshots. Then send the same images to your chat.</span></div>';
  const warning=usage.unmatched.length?'<div class="idea-import-warning">'+usage.unmatched.length+' staged image'+(usage.unmatched.length===1?' is':'s are')+' not named in the chat result.</div>':'';
  return '<main class="idea-main"><header class="idea-page-head"><div><h1>Import ideas from a chat</h1></div><button type="button" class="idea-copy-instructions" data-action="idea-copy-instructions"><span>▣</span><b>Copy chat instructions</b></button></header><div class="idea-steps"><div><span>1</span><b>Add images here</b><small>Paste, drop, or choose screenshots</small></div><div><span>2</span><b>Send them to the chat</b><small>Then describe the change normally</small></div><div><span>3</span><b>Paste the result</b><small>SINRAD matches the filenames</small></div></div><div class="idea-import-drop" data-idea-drop="true">'+staged+'<button type="button" class="btn" data-action="idea-import-images-pick">Add images</button></div><div class="idea-import-columns"><section class="idea-import-panel"><h2>Paste the chat result</h2><p>You do not need to understand or edit the format.</p><textarea id="idea_import_text" spellcheck="false" placeholder="SINRAD_IDEAS_V1\n\nPaste the final block here...">'+esc(ideaImportText)+'</textarea><footer><small>ITQ queues this batch and clears the input.</small><button type="button" class="btn" data-action="idea-import-check" title="Into the queue">ITQ</button></footer></section><section class="idea-import-panel preview"><h2>Queue · '+preview.length+' idea'+(preview.length===1?'':'s')+'</h2><p>Collect batches here, then add the entire queue.</p><div class="idea-import-preview">'+cards+'</div>'+warning+'<footer><button type="button" class="btn" data-action="idea-import-cancel"'+(!preview.length?' disabled':'')+'>Cancel</button><button type="button" class="btn primary" data-action="idea-import-add"'+(!valid?' disabled':'')+'>Add Ideas ('+preview.length+')</button></footer></section></div></main>';
}
function ideaMediaMarkup(media,large){
  const source='sinrad-idea://media/'+encodeURIComponent(media.file||""),extension=String(media.file||"").split(".").pop().toLowerCase(),name=esc(media.name||"Idea attachment");
  if(extension==="mp4"||extension==="webm")return '<figure><video src="'+source+'" controls preload="metadata"></video><figcaption>'+name+'</figcaption></figure>';
  if(extension==="mp3")return '<figure class="audio"><audio src="'+source+'" controls preload="metadata"></audio><figcaption>'+name+'</figcaption></figure>';
  return '<figure data-ctx="idea-media" data-id="'+esc(media.file||"")+'"><img src="'+source+'" alt="'+name+'" loading="'+(large?'eager':'lazy')+'"><figcaption>'+name+'</figcaption></figure>';
}
function ideaDetailView(item){
  const attachments=Array.isArray(item.attachments)?item.attachments:[],media=attachments.length?'<div class="idea-reader-media">'+attachments.map(function(file){return ideaMediaMarkup(file,true);}).join("")+'</div>':'<div class="idea-reader-no-media">No media attached to this idea.</div>',details=String(item.details||item.original||"").trim(),refs=String(item.references||"").trim(),review=String(item.reviewNote||"").trim();
  return '<main class="idea-reader" data-ctx="idea" data-id="'+esc(item.id)+'"><header><div class="idea-reader-meta">'+esc(IDEA_TYPES[ideaType(item.type)])+' · '+esc(IDEA_GROUPS[ideaGroup(item.group)])+' · '+esc(IDEA_STATUSES[ideaStatus(item.status)])+'</div><h1>'+esc(item.title||"Untitled idea")+'</h1></header>'+media+'<section class="idea-reader-copy">'+(review?'<div class="idea-reader-audit"><b>Review</b><span>'+esc(review)+'</span></div>':'')+'<h2>Idea</h2><div>'+esc(details||"No details yet.")+'</div>'+(refs?'<h2>References</h2><div class="idea-reader-refs">'+esc(refs)+'</div>':'')+'</section></main>';
}
function ideaListView(counts){
  ideaFilter=ideaPane;const items=ideaVisibleItems();
  const body=items.length?'<div class="idea-list">'+items.map(function(item){const status=ideaStatus(item.status),type=ideaType(item.type),group=ideaGroup(item.group),details=String(item.details||item.original||"").trim();return '<article class="idea-list-card status-'+status+' type-'+type+'" data-action="idea-open" data-ctx="idea" data-id="'+esc(item.id)+'"><div class="idea-list-card-head"><span>'+esc(IDEA_TYPES[type])+' · <b>'+esc(IDEA_GROUPS[group])+'</b></span><time>'+esc(fmtDate(item.updated||item.created))+'</time></div><h2>'+esc(item.title||"Untitled idea")+'</h2><p>'+esc(details||"No details yet.")+'</p>'+((item.attachments||[]).length?'<small>'+item.attachments.length+' media attachment'+(item.attachments.length===1?'':'s')+'</small>':item.references?'<small>'+esc(String(item.references).split(/\r?\n/)[0])+'</small>':'')+'</article>';}).join("")+'</div>':'<div class="idea-list-empty"><b>No '+esc(IDEA_STATUSES[ideaPane]).toLowerCase()+' ideas</b><span>Ideas moved here will appear in this list.</span></div>';
  const filters=ideaPane==="inbox"?'<div class="idea-group-filters"><button type="button" data-action="idea-group-filter" data-filter="all" class="'+(ideaGroupFilter==="all"?'active':'')+'">All tags</button>'+Object.keys(IDEA_GROUPS).map(function(group){return '<button type="button" data-action="idea-group-filter" data-filter="'+group+'" class="'+(ideaGroupFilter===group?'active':'')+'">'+esc(IDEA_GROUPS[group])+'</button>';}).join("")+'</div>':'';
  return '<main class="idea-main"><header class="idea-page-head"><div><h1>'+esc(IDEA_STATUSES[ideaPane])+'</h1><p>'+counts[ideaPane]+' saved idea'+(counts[ideaPane]===1?'':'s')+'</p></div></header>'+searchRow("ideas","Search ideas and references...")+filters+body+'</main>';
}
function viewIdeas(){
  const all=state.ideas||[],counts={inbox:0,ready:0,testing:0,done:0};all.forEach(function(item){const status=ideaStatus(item.status);if(status==="inbox"||ideaGroup(item.group)==="app")counts[status]++;});
  const top='<div class="idea-workspace-top"><div><b>S.I.R</b><span>Ideas</span></div><div><button type="button" data-action="idea-search" title="Search ideas">'+ICO_SEARCH+'</button><button type="button" data-action="settings-open" title="Settings">⚙</button></div></div>';
  const viewing=ideaViewingId?ideaById(ideaViewingId):null;if(ideaViewingId&&!viewing)ideaViewingId="";
  return '<div class="ideas-view">'+top+'<div class="idea-workspace-body">'+ideaSideNav(counts)+(viewing?ideaDetailView(viewing):ideaPane==="import"?ideaImportView():ideaListView(counts))+'</div></div>';
}

function collColor(name){ var h=0; name=String(name||''); for(var i=0;i<name.length;i++){ h=(h*31+name.charCodeAt(i))%360; } return 'hsl('+h+',55%,55%)'; }
function isTagPage(u){ var s=String(u||''); return s.indexOf('/tags/')>=0 || s.indexOf('/tag/')>=0; }
function linkDisplayPath(u){ try{ const x=new URL(u); const p=(x.pathname==="/"?"":x.pathname)+(x.search||""); return p||x.hostname; }catch(_){ return String(u||""); } }
function _linkSelCount(){ return Object.keys(linkSelLinks).length; }
function _linkDeleteSel(){ var ids=Object.keys(linkSelLinks); var n=ids.length; if(!n) return; function go(){ const anchor=captureListPosition();rememberUndo("Deleted "+n+" links"); var kill={}; ids.forEach(function(x){kill[x]=1;}); state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); linkSelLinks={}; renderViewAnchored(anchor,false); log("warn","deleted "+n+" link(s)"); } if(n>4){ confirmModal("Delete "+n+" links?").then(function(y){ if(y) go(); }); } else { go(); } }
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
  return head("Links",""+openVerb()+" · click multiple categories · ctrl-click cards to select")+addbar+pills+searchRow("links","Search links...")+body+selBar;
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
    const dhead=`<div class="drill-head"><span class="dh-title">${esc(linkDrill)}</span><span class="cc-count" style="margin-left:8px">${items.length}</span><button class="dh-open" data-action="link-openall" data-coll="${esc(linkDrill)}">open all (${items.length})</button></div>`;
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
  return head("Folders",""+openVerb()+" · right-click for more · Ctrl+F to search")+addbar+searchRow("folders","Search folders...")+pills+body;
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

function openModal(t,b,l,onC,onX,danger){ $("#modal-title").innerHTML=t; $("#modal-body").innerHTML=b; const mc=$("#modal-confirm"); if(mc){ mc.disabled=false; mc.textContent=l||"Save"; mc.classList.remove("hidden"); mc.classList.toggle("kill-go",!!danger); if(danger) mc.classList.remove("primary"); else mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb){ xb.classList.remove("hidden"); xb.textContent="Cancel"; } const md=document.querySelector("#overlay .modal"); if(md){md.classList.toggle("danger",!!danger);md.classList.remove("confirm-modal","censor-prompt");} modalOnConfirm=onC||null; modalOnCancel=onX||null; $("#overlay").classList.add("show"); const f=$("#modal-body input, #modal-body textarea, #modal-body select"); if(f)setTimeout(()=>f.focus(),30); }
function closeModal(){ $("#overlay").classList.remove("show"); modalOnConfirm=null; modalOnCancel=null; const md=document.querySelector("#overlay .modal"); if(md) md.classList.remove("danger","censor-prompt"); const mc=$("#modal-confirm"); if(mc){ mc.disabled=false; mc.classList.remove("kill-go"); mc.classList.add("primary"); } const xb=$("#modalCancelBtn"); if(xb) xb.textContent="Cancel"; }
$("#overlay").addEventListener("click",function(event){if(event.target===this&&(this.querySelector(".deck-add-modal")||censorReturnPromptOpen))cancelModal();});
function cancelModal(){ const c=modalOnCancel; closeModal(); if(typeof c==="function")c(); }
const modalConfirmButton=$("#modal-confirm");
function reportActionError(label,error){const message=String(error&&error.message||error||"Unknown error");try{console.error("[sinrad] "+label.toLowerCase()+" failed:",error);}catch(_){}toast(label+" failed: "+message,"err");}
function confirmActiveModal(){if(typeof modalOnConfirm!=="function")return;try{const result=modalOnConfirm();if(result&&typeof result.catch==="function")result.catch(function(error){const button=$("#modal-confirm");if(button){button.disabled=false;button.textContent="Save";}reportActionError("Save",error);});}catch(error){reportActionError("Save",error);}}
if(modalConfirmButton)modalConfirmButton.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();confirmActiveModal();});
const modalCancelButton=$("#modalCancelBtn");
if(modalCancelButton)modalCancelButton.addEventListener("click",function(event){event.stopPropagation();cancelModal();});
function confirmModal(m,danger,spec){ return new Promise(res=>{ spec=spec||{}; const ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>'; const title=spec.title||(danger?ico+" Arm kill switch":"Confirm"); const go=spec.go||(danger?"Arm it":"Confirm"); openModal(title,`<p style="margin:0;color:var(--muted)">${esc(m)}</p>`,go,()=>{closeModal();res(true);},()=>res(false),!!danger); const modal=document.querySelector("#overlay .modal");if(modal)modal.classList.add("confirm-modal");const xb=$("#modalCancelBtn"); if(xb&&spec.cancel) xb.textContent=spec.cancel; setTimeout(()=>{const b=$("#modal-confirm");if(b)b.focus();},30); }); }
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
};
function contextIcon(action,fallback){const a=String(action||"");if(/deck-add/.test(a))return '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';if(/del|remove|forget/.test(a))return CTX_ICON.delete;if(/download/.test(a))return CTX_ICON.download;if(/refresh|check/.test(a))return CTX_ICON.refresh;if(/copy/.test(a))return CTX_ICON.copy;if(/edit/.test(a))return CTX_ICON.edit;if(/fav/.test(a))return CTX_ICON.star;if(/pri|pin/.test(a))return CTX_ICON.pin;if(/reveal|folder/.test(a))return CTX_ICON.folder;if(/pause/.test(a))return CTX_ICON.pause;if(/resume/.test(a))return CTX_ICON.play;if(/shot/.test(a))return CTX_ICON.image;if(/open|original|nav/.test(a))return CTX_ICON.open;return fallback||CTX_ICON.tag;}
function mi(a,id,label,color,danger,icon){ const st=color?` style="--ci-accent:${color}"`:``; return `<div class="ci${danger?" danger":""}" data-action="${a}" data-id="${id}"${st}><span class="ci-ico">${contextIcon(a,icon)}</span><span class="ci-label">${esc(label)}</span></div>`; }
function miT(a,id,label,on,color,icon){ const st=color?` style="--ci-accent:${color}"`:``; return `<div class="ci${on?" on":""}" data-action="${a}" data-id="${id}"${st}><span class="ci-ico">${contextIcon(a,icon)}</span><span class="ci-label">${esc(label)}</span>${on?'<span class="ci-state">On</span>':""}</div>`; }
function miCat(id,cat,on){ const color=CAT_COLORS[cat]||"#cfd3dc",label=cat==="__none__"?"No category":cat; return `<div class="ci cat${on?" on":""}" data-action="link-cat-set" data-id="${id}" data-cat="${esc(cat)}"><span class="ci-label" style="color:${color}">${esc(label)}</span>${on?'<span class="ci-check">✓</span>':""}</div>`; }
function miCatF(id,cat,on){ const color=FOLDER_CATS[cat]||"#cfd3dc",label=cat==="__none__"?"No category":cat; return `<div class="ci cat${on?" on":""}" data-action="folder-cat-set" data-id="${id}" data-cat="${esc(cat)}"><span class="ci-label" style="color:${color}">${esc(label)}</span>${on?'<span class="ci-check">✓</span>':""}</div>`; }
function showMenu(x,y,html){ const m=$("#ctxmenu"); m.innerHTML=html; m.classList.add("show"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.classList.toggle("submenu-left",left>window.innerWidth/2);m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function hideMenu(){ $("#ctxmenu").classList.remove("show"); }
document.addEventListener("contextmenu",function(event){const menu=$("#ctxmenu");if(menu&&menu.classList.contains("show")){event.preventDefault();event.stopImmediatePropagation();hideMenu();}},true);
function moveMenuTo(x,y){ const m=$("#ctxmenu"); const r=m.getBoundingClientRect(); let top=y,left=x; if(top+r.height>window.innerHeight-8)top=window.innerHeight-r.height-8; if(left+r.width>window.innerWidth-8)left=window.innerWidth-r.width-8; m.style.top=Math.max(4,top)+"px"; m.style.left=Math.max(4,left)+"px"; }
function alignMenuToBubble(el){ const m=$("#ctxmenu"); const br=el.getBoundingClientRect(); const mr=m.getBoundingClientRect(); let left=br.right+8, top=br.bottom-mr.height; if(top<4)top=4; if(left+mr.width>window.innerWidth-8)left=window.innerWidth-mr.width-8; if(left<4)left=4; m.style.top=top+"px"; m.style.left=left+"px"; }
function showCardMenu(type,id,x,y,columnKey){
  if(type==="compression-history"){const item=compressionHistory.find(entry=>entry.id===id);if(!item)return;showMenu(x,y,mi("compression-history-open",id,"Open output folder")+(item.zipPath?mi("compression-history-open-zip",id,"Open ZIP"):mi("compression-zip",id,"Create ZIP"))+mi("compression-history-reveal",id,"Show in Explorer")+'<div class="cdiv"></div>'+mi("compression-history-remove",id,"Remove from output list","#ff5470",true));return;}
  let it="";
  if(type==="vault"){ const v=find(state.vault,id); if(!v)return; if(v.url)it+=mi("vault-open",id,"Open site"); it+=mi("vault-import","","Import browser passwords")+mi("vault-copy-u",id,"Copy username")+mi("vault-copy-p",id,"Copy password")+mi("vault-eye",id,revealed.has(id)?"Hide password":"Show password")+miT("vault-fav",id,"Favorite",v.favorite,FAV_COLOR)+miT("vault-pri",id,"Priority",v.priority,PRI_COLOR)+mi("vault-edit",id,"Edit")+`<div class="cdiv"></div>`+mi("vault-del",id,"Delete","#ff5470",true); }
  else if(type==="link"){ const l=find(state.links,id); if(!l)return; const host=hostOf(l.url),cats=linkCategoryList(l),transfer=currentView==="lot"?mi(l.inLinks?"link-unsend":"link-send",id,l.inLinks?"Remove from Links":"Send to Links",null,false,l.inLinks?"←":"→"):""; it+=`<div class="cm-link-head"><span><b>${esc(l.title)}</b><small>${esc(host)}</small></span></div>`+mi("link-open",id,"Open link",null,false,"↗")+miT("link-fav-toggle",id,"Favorite",l.favorite,FAV_COLOR,"★")+`<div class="cdiv"></div><div class="cm-head">Categories</div>`+Object.keys(CAT_COLORS).map(c=>miCat(id,c,cats.indexOf(c)>=0)).join("")+miCat(id,"__none__",!cats.length)+`<div class="cdiv"></div>`+transfer+mi("link-del",id,"Delete link","#ff5470",true,"×"); }
  else if(type==="folder"){ const f=find(state.folders,id); if(!f)return; const fp=f.path||f.name||""; const pn=petPinCount(); const pinned=isPetPinned(fp); const pinLab=pinned?("Unpin from Pet Recents ("+pn+"/3)"):(pn>=3?"Pet recents full (3/3)":"Pin to Pet Recents ("+pn+"/3)"); it+=mi("folder-open",id,"Open")+miT("folder-fav",id,"Favorite",f.favorite,FAV_COLOR)+mi("folder-edit",id,"Edit")+miT("folder-pet-pin",id,pinLab,pinned,"#ff79c6")+`<div class="cdiv"></div><div class="cm-head">Category</div>`+Object.keys(FOLDER_CATS).map(c=>miCatF(id,c,normCat(f)===c)).join("")+miCatF(id,"__none__",!normCat(f))+`<div class="cdiv"></div>`+mi("folder-del",id,"Remove","#ff5470",true); }
  else if(type==="idea"){ const idea=ideaById(id);if(!idea)return;const current=ideaStatus(idea.status);it+=mi("idea-edit",id,"Edit idea")+mi("idea-copy",id,"Copy for Codex",null,false,CTX_ICON.copy)+'<div class="cdiv"></div><div class="cm-head">Status</div>'+Object.keys(IDEA_STATUSES).map(function(status){return '<div class="ci'+(status===current?' on':'')+'" data-action="idea-status" data-id="'+esc(id)+'" data-status="'+status+'"><span class="ci-ico">'+(status===current?'✓':'○')+'</span><span class="ci-label">'+esc(IDEA_STATUSES[status])+'</span></div>';}).join("")+'<div class="cdiv"></div>'+mi("idea-del",id,"Delete idea","#ff5470",true); }
  else if(type==="idea-media"){it+=mi("idea-image-copy",id,"Copy image",null,false,CTX_ICON.copy);}
  else if(type==="shot"){ const s=shotById(id); if(!s)return; it+=mi("shot-open",id,"Open")+mi("shot-copy",id,"Copy image")+mi("shot-lookup",id,"Look up on Google Lens","#27b4ff")+`<div class="cdiv"></div>`+mi("shot-reveal",id,"Reveal in Explorer")+mi("shot-refresh","","Refresh","#ff79c6"); }
  else if(type==="monitor"){ const monitor=monitoringMonitor(id); if(!monitor)return; it+=mi("monitoring-monitor-open",id,"Open artist",null,false,"↗")+mi("monitoring-monitor-interval",id,"Edit check time",null,false,"◷")+mi("monitoring-monitor-toggle",id,monitor.enabled?"Pause watcher":"Resume watcher",null,false,monitor.enabled?CTX_ICON.pause:CTX_ICON.play)+mi("monitoring-monitor-refresh",id,"Check now",null,false,"↻")+`<div class="cdiv"></div>`+mi("monitoring-monitor-remove",id,"Remove watcher","#d86565",true,"×"); }
  else if(type==="monitor-watchlist"){it+=mi("monitoring-add","","Add watcher",null,false,"+");}
  else if(type==="monitor-artist"){if(!monitoringArtist||monitoringArtist.monitorId!==id)return;it+=mi("monitoring-artist-back","","Back",null,false,"←")+mi("monitoring-top","","Back to top",null,false,"↑")+'<div class="cdiv"></div>'+mi("monitoring-monitor-interval",id,"Edit check time",null,false,"◷")+mi("monitoring-artist-download-all",id,"Download everything",null,false,CTX_ICON.download)+mi("monitoring-artist-original",id,"Open original",null,false,"↗");}
  else if(type==="monitor-artist-post"){if(!monitoringArtist)return;it+=mi("monitoring-top","","Back to top",null,false,"↑")+'<div class="cdiv"></div>'+mi("monitoring-artist-post-download-all",id,"Download post files",null,false,CTX_ICON.download)+monitoringCollectionSendMenu(type,id);}
  else if(type==="monitor-event"){const item=monitoringEvent(id);if(!item)return;const actions=mi("monitoring-top","","Back to top",null,false,"↑")+'<div class="cdiv"></div>'+mi("monitoring-event-download",item.id,"Download whole post",null,false,CTX_ICON.download)+(item.url?mi("monitoring-event-original",item.id,"Open original",null,false,CTX_ICON.open):'');it+=columnKey?monitoringCollectionSendMenu(type,id,false)+'<div class="cdiv"></div>'+actions:actions+monitoringCollectionSendMenu(type,id);}
  else if(type==="monitor-file"){ const index=Number(id),file=monitoringDetail&&monitoringDetail.files&&monitoringDetail.files[index];if(!file)return;const label=file.kind==="image"?"Download image":file.kind==="video"?"Download video":file.kind==="audio"?"Download audio":"Download file";it+='<div class="ci" data-action="monitoring-download" data-index="'+index+'"><span class="ci-ico">'+CTX_ICON.download+'</span><span class="ci-label">'+esc(label)+'</span></div>'; }
  else if(type==="monitor-post"){ if(!monitoringDetail)return;it+=mi("monitoring-post-back","","Back",null,false,"←")+mi("monitoring-top","","Back to top",null,false,"↑")+'<div class="cdiv"></div>'+mi("monitoring-original","","Open original",null,false,"↗");if((monitoringDetail.files||[]).length>1)it+=mi("monitoring-download-all","","Download all files",null,false,"↓");it+=monitoringCollectionSendMenu(type,id); }
  else if(type==="monitor-collection-folder"){it+=mi("monitoring-collection-rename",id,"Rename collection",null,false,"✎");}
  else if(type==="monitor-collections"){if(monitoringOpenCollectionId)it+=mi("monitoring-collection-back","","Back",null,false,"←")+'<div class="cdiv"></div>';it+=mi("monitoring-collection-add","","Add collection",null,false,"+");}
  else if(type==="offline-item"){const item=offlineItem(id);if(!item)return;it+=offlineItemMenu(item,false);}
  else if(type==="offline-media"){it+=mi("offline-media-download",id,"Download image",null,false,CTX_ICON.download);}
  else if(type==="offline-source"){const source=(offlineData.sources||[]).find(function(entry){return entry.id===id;});if(!source)return;it+=mi("offline-source-limit",id,"Change unread limit",null,false,"#")+'<div class="cdiv"></div>'+mi("offline-source-remove",id,"Remove source","#ff5470",true,CTX_ICON.delete);}
  else return;
  if(columnKey)it=type==="monitor-event"?it+'<div class="cdiv"></div>'+mi("deck-menu",columnKey,"Column settings",null,false,"⚙"):mi("deck-menu",columnKey,"Column settings",null,false,"⚙")+'<div class="cdiv"></div>'+it;
  showMenu(x,y,it);
}
function leaveIdeaReader(){if(!ideaViewingId)return false;const anchor=ideaReturnAnchor;ideaViewingId="";ideaReturnAnchor=null;renderViewAnchored(anchor,true);return true;}

function openByAction(a,id){
  if(a==="vault-open"){ const v=find(state.vault,id); if(v&&v.url){ openTarget(v.url,"url"); log("info","Opened site: "+v.name); } }
  else if(a==="link-open"){ const l=find(state.links,id); if(l){ l.opens=(l.opens||0)+1; l.lastOpened=nowMs(); saveState(); openTarget(l.url,"url"); log("info","Opened link: "+l.title); if(currentView==="links"&&!offlineMode&&!monitoringMode)renderView(); } }
  else if(a==="folder-open"){ const f=find(state.folders,id); if(f){ const p=f.path||f.name||""; if(p){ openTarget(p,"app"); recordFolderVisit(p); } } }
}
document.addEventListener("dblclick",(ev)=>{ const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action; if((a==="vault-open"||a==="link-open"||a==="folder-open")&&(state.openMode||'double')==='double'){ openByAction(a,t.dataset.id); } });
document.addEventListener("dblclick",function(ev){const video=ev.target.closest&&ev.target.closest(".mon-media-frame.video video.mon-reader-media");if(!video||video.controls||document.fullscreenElement===video)return;ev.preventDefault();clearTimeout(video._sinradClickTimer);video.controls=true;video.play().catch(function(){});const open=video.requestFullscreen||video.webkitRequestFullscreen;if(!open){video.controls=false;return;}const pending=open.call(video);if(pending&&pending.catch)pending.catch(function(){video.controls=false;});});
document.addEventListener("fullscreenchange",function(){document.querySelectorAll(".mon-media-frame.video video.mon-reader-media").forEach(function(video){video.controls=document.fullscreenElement===video;});});
document.addEventListener("webkitfullscreenchange",function(){document.querySelectorAll(".mon-media-frame.video video.mon-reader-media").forEach(function(video){video.controls=document.webkitFullscreenElement===video;});});
function sizeExpandedMonitoringImage(image,figure){
  if(!image||!figure||!figure.classList.contains("expanded"))return;
  const width=Number(image.naturalWidth)||image.getBoundingClientRect().width,height=Number(image.naturalHeight)||image.getBoundingClientRect().height,ratio=width>0&&height>0?width/height:1;
  const row=figure.parentElement,panel=figure.closest(".deck-preview-panel"),availableWidth=Math.max(240,Number(row&&row.clientWidth)||innerWidth-80),availableHeight=Math.max(240,Math.min(innerHeight-72,panel?panel.clientHeight-72:innerHeight-96));
  const fittedWidth=Math.min(availableWidth,availableHeight*ratio),fittedHeight=fittedWidth/ratio;
  image.style.width=Math.round(fittedWidth)+"px";image.style.height=Math.round(fittedHeight)+"px";image.style.maxWidth="none";image.style.maxHeight="none";image.style.marginLeft="auto";image.style.marginRight="auto";
}
function animateMonitoringImageCollapse(image){
  const before=image.getBoundingClientRect();resetExpandedMonitoringImage(image);
  animateMonitoringImageGeometry(image,before);
}
function animateMonitoringImageGeometry(image,before){
  const after=image.getBoundingClientRect();
  if(!after.width||!after.height||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  image.getAnimations().forEach(animation=>animation.cancel());
  image.animate([{transformOrigin:'top left',transform:'translate('+(before.left-after.left)+'px,'+(before.top-after.top)+'px) scale('+(before.width/after.width)+','+(before.height/after.height)+')'},{transformOrigin:'top left',transform:'none'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
}
function resetExpandedMonitoringImage(image){if(!image)return;["width","height","maxWidth","maxHeight","marginLeft","marginRight"].forEach(function(key){image.style[key]="";});}
window.addEventListener("resize",function(){document.querySelectorAll(".mon-file.expanded .mon-media-frame.image img.mon-reader-media").forEach(function(image){sizeExpandedMonitoringImage(image,image.closest(".mon-file"));});});
document.addEventListener("keydown",function(ev){if(!ev.altKey)return;if(ev.key==="ArrowLeft"){ev.preventDefault();navigateAppHistory(-1);}else if(ev.key==="ArrowRight"){ev.preventDefault();navigateAppHistory(1);}});
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
const APP_NAVIGATION_ACTIONS=new Set(["nav","deck-nav","deck-open-offline","deck-open-monitor","deck-open-idea","deck-open-module","deck-row-open","shell-monitor","shell-clip","timeline-sources","offline-mode","offline-exit","offline-tab","offline-source-browse","offline-item-open","offline-item-nav","monitoring-mode","monitoring-exit","monitoring-post-back","monitoring-artist-back","monitoring-post-nav","monitoring-post-page","monitoring-post-artist-open","monitoring-tab","monitoring-monitor-open","monitoring-artist-post-open","monitoring-event-open","global-result","idea-open","idea-pane"]);
document.addEventListener("click",function(ev){const target=ev.target.closest&&ev.target.closest("[data-action]");if(target&&APP_NAVIGATION_ACTIONS.has(target.dataset.action))rememberAppNavigation();},true);
document.addEventListener("click",async(ev)=>{
  if((deckMenuId||deckSettingsId||deckSourceId)&&!ev.target.closest(".deck-context-menu,.deck-menu-button,.deck-local-settings,.deck-source-menu,.deck-source")){deckMenuId="";deckSettingsId="";deckSourceId="";if(currentView==="home"&&!offlineMode&&!monitoringMode){renderView();return;}}
  const t=ev.target.closest("[data-action]"); if(!t)return; const a=t.dataset.action,id=t.dataset.id;
  if((a==="vault-open"||a==="link-open"||a==="folder-open")&&!t.closest("#ctxmenu")&&(state.openMode||'double')==='double')return;
  switch(a){
    case "app-back": navigateAppHistory(-1);break;
    case "app-forward": navigateAppHistory(1);break;
    case "nav": if(t.dataset.nav==="home"&&leaveTimelineOfflineReader())break;if(t.dataset.nav==="ideas"&&leaveIdeaReader())break;if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);currentView=t.dataset.nav;if(currentView==="links")linkDrill=null; $("#content").classList.remove("searching"); searchTerms={}; renderNav(); renderView(); break;
    case "deck-nav": {const view=t.dataset.view;if(view==="offline"){setOfflineMode(true);break;}if(view==="monitor"){setMonitoringMode(true);break;}currentView=view||"home";renderNav();renderView();break;}
    case "deck-open-offline": openTimelineRedditReader(id);break;
    case "deck-open-monitor": {setMonitoringMode(true);openMonitoringEvent(id);break;}
    case "deck-open-idea": {currentView="ideas";ideaViewingId=id;ideaPane="ready";renderNav();renderView();break;}
    case "deck-add-toggle": openTimelineAddWindow();break;
    case "deck-add-open": openTimelineAddWindow();break;
    case "deck-add-module": {const module=t.dataset.module;if(!TIMELINE_MODULES[module])break;closeModal();addTimelineColumn(module);break;}
    case "deck-add": addTimelineColumn(t.dataset.module);break;
    case "deck-menu": {deckSettingsId="";deckSourceId="";deckMenuId=deckMenuId===id?"":id;renderView();break;}
    case "deck-settings": {deckMenuId="";deckSettingsId=deckSettingsId===id?"":id;renderView();setTimeout(function(){document.querySelector('[data-deck-width]')?.focus();},20);break;}
    case "deck-source": {deckMenuId="";deckSettingsId="";deckSourceId=deckSourceId===id?"":id;renderView();break;}
    case "deck-source-set": {const item=timelineDeck()[Number(t.dataset.index)];if(item){item.source=String(t.dataset.source||"");item.configured=true;timelineFeedSnapshots.delete(item.key);deckSourceId="";saveState();renderView();animateTimelineColumn(item.key,"switch");}break;}
    case "deck-auto-width": {const item=timelineDeck()[Number(t.dataset.index)];if(item){item.autoWidth=!item.autoWidth;deckMenuId="";saveState();renderView();}break;}
    case "deck-duplicate": {const index=Number(t.dataset.index),deck=timelineDeck(),item=deck[index];if(item){deck.splice(index+1,0,Object.assign({},item,{key:uid(),stack:false}));deckMenuId="";saveState();renderView();}break;}
    case "deck-stack-left": {const index=Number(t.dataset.index),deck=timelineDeck();if(index>0&&deck[index]){deck[index].stack=!deck[index].stack;deckMenuId="";deckSettingsId="";saveState();renderView();}break;}
    case "deck-remove": {const index=Number(t.dataset.index),deck=timelineDeck();if(deck[index]){timelineFeedSnapshots.delete(deck[index].key);deck.splice(index,1);if(deck[index])deck[index].stack=false;deckMenuId="";deckSettingsId="";saveState();renderView();}break;}
    case "deck-move": {const index=Number(t.dataset.index),next=index+Number(t.dataset.direction),deck=timelineDeck();if(deck[index]&&deck[next]){const item=deck.splice(index,1)[0];deck.splice(next,0,item);if(deck[0])deck[0].stack=false;deckMenuId="";deckSettingsId="";saveState();renderView();}break;}
    case "deck-monitor-page": {const config=timelineDeck().find(item=>item.key===id),column=t.closest(".deck-column"),scroller=column&&column.querySelector(".deck-column-scroll");if(!config||!scroller)break;monitoringFeedPages.set("deck:"+id,Math.max(0,Number(t.dataset.page)||0));scroller.innerHTML=timelineMonitoringRows(config,timelineFeedSnapshot(config).rows);scroller.scrollTop=0;hydrateMonitoringMedia();break;}
    case "deck-load-pending": {const config=timelineDeck().find(item=>item.key===id),snapshot=config&&timelineFeedSnapshots.get(config.key),column=document.querySelector('[data-deck-key="'+CSS.escape(id)+'"]');if(!snapshot||!snapshot.pending.length||!column)break;const pending=config.id==='monitoring'?(config.source==="inbox"?monitoringNewestRows(snapshot.pending):timelineShuffledRows(snapshot.pending)):snapshot.pending.slice();snapshot.rows=config.source==="inbox"?monitoringNewestRows(pending.concat(snapshot.rows)):pending.concat(snapshot.rows);snapshot.pending=[];column.querySelector('.deck-new-posts')?.remove();const scroller=column.querySelector('.deck-column-scroll');if(config.id==='monitoring'){monitoringFeedPages.set('deck:'+id,0);scroller.innerHTML=timelineMonitoringRows(config,snapshot.rows);}else if(config.id==='reddit')scroller.insertAdjacentHTML('afterbegin',pending.map(item=>offlineFeedCard(item,'deck-open-offline')).join(''));else {const template=document.createElement('template');template.innerHTML=timelineMonitoringRows(config,pending);const list=scroller.querySelector('.deck-monitoring-posts');if(list)list.prepend(...template.content.firstElementChild.children);else scroller.append(template.content);}scroller.scrollTop=0;hydrateOfflineMedia();hydrateMonitoringMedia();break;}
    case "deck-open-module": {const module=t.dataset.module;if(module==="reddit"){offlineTab="sources";offlineSourceBrowse="";setOfflineMode(true);break;}if(["favorites","history"].includes(module)){offlineTab=module==="favorites"?"favorite":"history";offlineFilter=offlineTab;offlineSourceBrowse="";setOfflineMode(true);break;}if(["notifications","monitoring","channels","downloads"].includes(module)){setMonitoringMode(true);monitoringTab=module==="channels"?"watchlist":"activity";renderView();break;}if(module==="compression")currentView="compress";else if(module==="ideas"||module==="reminders")currentView="ideas";else if(module==="links")currentView="links";else break;renderNav();renderView();break;}
    case "deck-row-open": {rememberTimelinePosition();const kind=t.dataset.kind;if(kind==="offline"){openTimelineRedditReader(id);}else if(kind==="monitor"){await openTimelineMonitoringPreview(id);}else if(kind==="channel"){monitoringTab="watchlist";await setMonitoringMode(true);await openMonitoringArtist(id,null);}else if(kind==="idea"){currentView="ideas";ideaViewingId=id;ideaPane="ready";renderNav();renderView();}else if(kind==="link"){openByAction("link-open",id);}else if(kind==="compress"||kind==="download"){currentView="compress";renderNav();renderView();}break;}
    case "deck-preview-close": closeTimelinePreview();break;
    case "shell-more": sidebarMore=!sidebarMore;renderNav();break;
    case "shell-search": {const searchBox=$("#globalSearch"),input=$("#globalSearchInput");if(searchBox)searchBox.classList.add("shell-open");if(input){input.focus();input.select();}break;}
    case "shell-monitor": {if(offlineMode)setOfflineMode(false,true);if(!monitoringMode)setMonitoringMode(true);else{monitoringDetail=null;monitoringArtist=null;renderNav();renderView();}break;}
    case "shell-clip": {if(monitoringMode)setMonitoringMode(false,true);if(offlineMode){offlineSelectedId="";offlineBrowseIds=[];renderNav();renderView();}else setOfflineMode(true);break;}
    case "timeline-sources": {offlineTab="sources";offlineSourceBrowse="";setOfflineMode(true);break;}
    case "compression-pick-folder": await pickCompression("folder");break;
    case "compression-pick-file": await pickCompression("file");break;
    case "compression-preset": compressionPreset=t.dataset.preset==="extreme"?"extreme":"ultra";if(compressionSource)await analyzeCompression(compressionSource);else renderView();break;
    case "compression-start": await startCompression(false);break;
    case "compression-batch-start": await startCompressionBatch(false);break;
    case "compression-batch-resume": await startCompressionBatch(true);break;
    case "compression-resume": await resumeCompression();break;
    case "compression-cancel": if(E&&E.compressionCancel)await E.compressionCancel();break;
    case "compression-history-select": compressionSelectedPath=id;renderView();break;
    case "compression-history-open": {const item=compressionHistory.find(entry=>entry.id===id);if(item&&E&&E.openPath)await E.openPath(item.output);break;}
    case "compression-history-open-zip": {const item=compressionHistory.find(entry=>entry.id===id);if(item&&item.zipPath&&E&&E.openPath)await E.openPath(item.zipPath);break;}
    case "compression-history-reveal": {const item=compressionHistory.find(entry=>entry.id===id);if(item&&E&&E.compressionReveal)await E.compressionReveal(item.output);break;}
    case "compression-history-remove": {if(!E||!E.compressionHistoryRemove)break;const result=await E.compressionHistoryRemove(id);if(result&&result.ok){compressionHistory=result.history||[];if(compressionSelectedPath===id)compressionSelectedPath="";renderView();toast("Removed from output list","ok");}else toast(result&&result.error||"Could not remove output entry","err");break;}
    case "compression-zip": await zipCompression(id);break;
    case "idea-quick-add": await ideaQuickAdd();break;
    case "idea-new": ideaModal();break;
    case "idea-open": ideaReturnAnchor=captureListPosition(id);ideaViewingId=id;renderView();$("#content").scrollTop=0;break;
    case "idea-edit": ideaModal(ideaById(id));break;
    case "idea-edit-images-pick": await pickIdeaEditImages();break;
    case "idea-edit-image-remove": {const index=Number(t.dataset.index);if(Number.isInteger(index)&&index>=0&&index<ideaEditMedia.length){ideaEditMedia.splice(index,1);renderIdeaEditMedia();}break;}
    case "idea-pane": ideaViewingId="";ideaPane=t.dataset.pane||"inbox";ideaFilter=ideaPane==="import"?"all":ideaPane;searchTerms.ideas="";renderView();break;
    case "idea-copy-instructions": await copy(ideaImportInstructions(),"Chat instructions");break;
    case "idea-import-images-pick": await pickIdeaImportImages();break;
    case "idea-import-image-remove": {const index=Number(t.dataset.index);if(Number.isInteger(index)&&index>=0&&index<ideaImportMedia.length){ideaImportMedia.splice(index,1);renderView();}break;}
    case "idea-import-check": {const box=$("#idea_import_text"),raw=box?box.value:"",batch=parseIdeaImport(raw);if(!batch.length){toast("No ideas were found","warn");break;}if(ideaImportMediaUsage(batch).unmatched.length){toast("Name every staged image in the references before ITQ","warn");break;}ideaImportPreview=ideaImportPreview.concat(batch.map(function(item){return Object.assign({},item,{original:raw,attachments:ideaImportMediaFor(item,batch.length)});}));ideaImportText="";ideaImportMedia=[];renderView();$("#idea_import_text").focus();break;}
    case "idea-import-cancel": ideaImportPreview=[];renderView();break;
    case "idea-import-add": {if(!ideaImportPreview.length||ideaImportMediaUsage(ideaImportPreview).unmatched.length)break;const created=nowMs(),raw=ideaImportText,total=ideaImportPreview.length;rememberUndo("Imported "+total+" ideas");const added=ideaImportPreview.map(function(item,index){const group=ideaGroup(item.group);return {id:uid(),title:item.title,details:item.details,original:item.original||raw,references:item.references||ideaUrls(item.original||raw),type:ideaType(item.type),group:group,status:group==="app"?"ready":"inbox",attachments:ideaImportMediaFor(item,total).map(function(media){return {name:media.name,file:media.file};}),created:created+index,updated:created+index};});state.ideas=added.concat(state.ideas||[]);const saved=await flushSave();if(!saved){state.ideas=(state.ideas||[]).filter(function(item){return added.indexOf(item)<0;});toast("Ideas could not be saved","err");break;}ideaImportPreview=[];ideaImportText="";ideaImportMedia=[];ideaPane=added.some(function(item){return item.status==="ready";})?"ready":"inbox";ideaFilter=ideaPane;renderView();toast("Added "+added.length+" idea"+(added.length===1?"":"s")+" to "+IDEA_STATUSES[ideaPane],"ok");break;}
    case "idea-search": {if(ideaPane==="import"){ideaPane="inbox";ideaFilter="inbox";}renderView();const input=document.querySelector('[data-search="ideas"]');if(input){input.focus();input.select();}break;}
    case "idea-filter": ideaFilter=t.dataset.filter||"all";renderView();break;
    case "idea-group-filter": ideaGroupFilter=t.dataset.filter||"all";renderView();break;
    case "idea-copy": {const idea=ideaById(id);if(idea)await copy(ideaCodexText(idea),"Codex prompt");break;}
    case "idea-image-copy": {const ok=E&&E.ideaImageCopy?await E.ideaImageCopy(id):false;toast(ok?"Image copied":"Could not copy image",ok?"ok":"err");break;}
    case "idea-copy-visible": copyVisibleIdeas();break;
    case "idea-status": {const idea=ideaById(id),status=ideaStatus(t.dataset.status);if(idea&&status!=="inbox"&&ideaGroup(idea.group)!=="app"){toast("Only App ideas can enter In Progress, Testing, or Done","warn");break;}if(idea&&idea.status!==status){rememberUndo("Changed idea status");idea.status=status;idea.updated=nowMs();await flushSave();renderView();toast("Moved to "+IDEA_STATUSES[status],"ok");}break;}
    case "idea-del": {const idea=ideaById(id);if(idea&&await confirmModal("Delete "+(idea.title||"this idea")+"?")){const anchor=captureListPosition(id);rememberUndo("Deleted idea "+(idea.title||""));state.ideas=state.ideas.filter(function(item){return item.id!==id;});await flushSave();renderViewAnchored(anchor,false);toast("Idea deleted","ok");}break;}
    case "settings-duplicates": closeSettings();duplicateReviewModal();break;
    case "settings-rules": closeSettings();smartRulesModal();break;
    case "settings-link-check": await checkSavedLinks();if($("#settingsPanel")&&$("#settingsPanel").classList.contains("show"))renderSettings();break;
    case "settings-extension": await runSettingsCommand("ext open",false);break;
    case "settings-offline-open": await openOfflineStorageFolder();break;
    case "settings-offline-change": await chooseOfflineStorageFolder();break;
    case "settings-offline-history": closeSettings();offlineRetentionModal();break;
    case "settings-monitoring-output-open": await openMonitoringOutputFolder();break;
    case "monitoring-output-open": await openMonitoringOutputFolder();break;
    case "settings-monitoring-output-change": await chooseMonitoringOutputFolder();break;
    case "settings-compression-output-open": if(E&&E.compressionDestinationOpen&&!await E.compressionDestinationOpen())toast("Could not open the compression destination","err");break;
    case "settings-compression-output-change": await chooseCompressionDestination();break;
    case "settings-compression-output-reset": await resetCompressionDestination();break;
    case "settings-media-intros": await openSettingsMediaFolder("intros");break;
    case "settings-media-animations": await openSettingsMediaFolder("animations");break;
    case "offline-mode": setOfflineMode(!offlineMode); break;
    case "offline-exit": setOfflineMode(false);break;
    case "monitoring-mode": toggleMonitoringMode(); break;
    case "monitoring-exit": setMonitoringMode(false);break;
    case "monitoring-post-back": leaveMonitoringPost();break;
    case "monitoring-artist-back": leaveMonitoringArtist();break;
    case "monitoring-top": {const target=document.querySelector(".deck-preview-panel")||$("#content");if(target)target.scrollTo({top:0,behavior:"smooth"});break;}
    case "monitoring-post-nav": await navigateMonitoringPost(id==="previous"?"previous":"next");break;
    case "monitoring-post-page": await navigateMonitoringPostIndex(Number(t.dataset.index));break;
    case "monitoring-post-artist-open": {if(!monitoringDetail||!E||!E.monitoringArtistDetail)break;const monitorId=monitoringDetail.monitorId||id,requestId=++monitoringArtistRequest;monitoringArtistReturnAnchor=monitoringReturnAnchor;monitoringDetail=null;monitoringArtistLoading=true;monitoringArtistRange={monitorId:"",from:"",to:""};renderView();const result=await E.monitoringArtistDetail(monitorId);if(requestId!==monitoringArtistRequest)break;monitoringArtistLoading=false;if(result&&result.ok){monitoringArtist=result.artist;renderView();}else{renderView();toast(result&&result.error||"Could not load that artist","err");}break;}
    case "monitoring-tab": monitoringTab=["watchlist","collections"].includes(t.dataset.tab)?t.dataset.tab:"activity";monitoringFocusId="";monitoringDetail=null;monitoringArtist=null;renderView();break;
    case "monitoring-collection-add": monitoringCollectionAddModal();break;
    case "monitoring-collection-send": sendMonitoringPostToCollection(t.dataset.collection);break;
    case "monitoring-collection-send-recent": {const collections=monitoringCollections(),recent=monitoringCollection(state.settings&&state.settings.monitoringRecentCollectionId)||collections[0];sendMonitoringPostToCollection(recent&&recent.id);break;}
    case "monitoring-collection-rename": {const collection=monitoringCollection(id);if(!collection)break;hideMenu();openModal("Rename collection",'<div class="field"><label>Collection name</label><input id="rename_collection" maxlength="80" value="'+esc(collection.name)+'"></div>',"Save",function(){const name=val("rename_collection").trim();if(!name){toast("Give the collection a name","warn");return;}if(monitoringCollections().some(item=>item.id!==id&&item.name.toLowerCase()===name.toLowerCase())){toast("That collection already exists","warn");return;}collection.name=name;collection.updatedAt=Date.now();saveState();closeModal();renderView();});break;}
    case "monitoring-collection-open": monitoringOpenCollectionId=id;renderView();break;
    case "monitoring-collection-back": monitoringOpenCollectionId="";renderView();break;
    case "monitoring-collection-post-open": {const collection=monitoringCollection(t.dataset.collection),post=collection&&(collection.posts||[]).find(function(item){return item.key===id;});if(!post)break;const event=post.eventId&&monitoringEvent(post.eventId);if(event){monitoringTab="activity";monitoringFilter="all";monitoringFocusId=event.id;renderView();requestAnimationFrame(function(){const card=Array.from(document.querySelectorAll('.mon-event[data-id]')).find(function(node){return node.dataset.id===String(event.id);});if(card)card.click();});}else if(post.url)openTarget(post.url,"url");break;}
    case "monitoring-feed-page": monitoringFeedPages.set(monitoringFilter+":"+monitoringQuery,Math.max(0,Number(t.dataset.page)||0));monitoringFocusId="";viewScrollPositions.delete(currentViewScrollKey());renderMonitoringView();$("#content").scrollTop=0;break;
    case "monitoring-filter": monitoringFilter=t.dataset.filter==="inbox"&&monitoringFilter!=="inbox"?"inbox":"all";monitoringFocusId="";viewScrollPositions.delete(currentViewScrollKey());renderView();break;
    case "censor-toggle": setCensorModeEnabled(!censorModeActive());break;
    case "monitoring-add": monitoringAddModal();break;
    case "monitoring-monitor-open": await openMonitoringArtist(id);break;
    case "monitoring-monitor-interval": monitoringIntervalModal(id);break;
    case "monitoring-artist-original": if(monitoringArtist&&monitoringArtist.url)openTarget(monitoringArtist.url,"url");break;
    case "monitoring-artist-range-reset": if(monitoringArtist){monitoringArtistRange={monitorId:"",from:"",to:""};monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-date-open": if(monitoringArtist){const side=t.dataset.side==='to'?'to':'from';monitoringDatePicker={side:monitoringDatePicker.side===side?'':side,level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-date-year": if(monitoringArtist&&monitoringDatePicker.side){monitoringDatePicker.level="month";monitoringDatePicker.year=Number(t.dataset.year);renderView();}break;
    case "monitoring-artist-date-month": if(monitoringArtist&&monitoringDatePicker.side){monitoringDatePicker.level="day";monitoringDatePicker.month=Number(t.dataset.month);renderView();}break;
    case "monitoring-artist-date-edge": if(monitoringArtist&&monitoringDatePicker.side){const days=monitoringArtistPostDays(monitoringArtist),side=monitoringDatePicker.side,item=t.dataset.edge==="latest"?days[0]:days[days.length-1];if(item){if(side==="from"){monitoringArtistRange.from=item.iso;if(new Date(item.iso)>new Date(monitoringArtistRange.to))monitoringArtistRange.to=item.iso;}else{monitoringArtistRange.to=item.iso;if(new Date(item.iso)<new Date(monitoringArtistRange.from))monitoringArtistRange.from=item.iso;}}monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-date-pick": if(monitoringArtist&&monitoringDatePicker.side&&t.dataset.date){const side=monitoringDatePicker.side,date=t.dataset.date;if(side==="from"){monitoringArtistRange.from=date;if(new Date(date)>new Date(monitoringArtistRange.to))monitoringArtistRange.to=date;}else{monitoringArtistRange.to=date;if(new Date(date)<new Date(monitoringArtistRange.from))monitoringArtistRange.from=date;}monitoringDatePicker={side:"",level:"year",year:0,month:-1};renderView();}break;
    case "monitoring-artist-post-open": {if(!monitoringArtist||!E||!E.monitoringArtistPostDetail)break;rememberMonitoringReturn(id);const requestId=++monitoringDetailRequest;monitoringDetailLoading=true;renderView();const result=await E.monitoringArtistPostDetail(monitoringArtist.monitorId,id);if(requestId!==monitoringDetailRequest)break;monitoringDetailLoading=false;if(result&&result.ok){monitoringDetail=result.detail;renderView();}else{renderView();toast(result&&result.error||"Could not open that post","err");}break;}
    case "monitoring-artist-download-range": {if(!monitoringArtist||!E||!E.monitoringArtistDownloadAll)break;const from=monitoringArtistRange.from,to=monitoringArtistRange.to,fromTime=new Date(from+"T00:00:00").getTime(),toTime=new Date(to+"T23:59:59.999").getTime();if(!from||!to||!Number.isFinite(fromTime)||!Number.isFinite(toTime)||fromTime>toTime){toast("Choose a valid From and To date","warn");break;}const selected=(monitoringArtist.posts||[]).filter(function(post){return post.date>=fromTime&&post.date<=toTime;}).length;if(!selected){toast("No works are inside that date range","warn");break;}const approved=await confirmModal("Download available files from "+selected+" works to the Monitoring output folder?",false,{title:"Download date range",go:"Download"});if(!approved)break;toast("Date-range download started — keep SINRAD open","ok");const result=await E.monitoringArtistDownloadAll(monitoringArtist.monitorId,from,to);if(result&&result.ok)toast("Downloaded "+result.count+" files from "+result.postCount+" works"+(result.failed?" · "+result.failed+" skipped":""),result.failed?"warn":"ok");else toast(result&&result.error||"Date-range download failed","err");break;}
    case "monitoring-artist-download-all": {if(!monitoringArtist||!E||!E.monitoringArtistDownloadAll)break;const approved=await confirmModal("Download every available file from "+monitoringArtist.posts.length+" works to the Monitoring output folder? This may use a lot of storage.",false,{title:"Download artist",go:"Download"});if(!approved)break;toast("Artist download started — keep SINRAD open","ok");const result=await E.monitoringArtistDownloadAll(monitoringArtist.monitorId,"","");if(result&&result.ok)toast("Downloaded "+result.count+" files from "+result.postCount+" works"+(result.failed?" · "+result.failed+" skipped":""),result.failed?"warn":"ok");else toast(result&&result.error||"Artist download failed","err");break;}
    case "monitoring-artist-post-download-all": {if(!monitoringArtist||!E||!E.monitoringArtistPostDownloadAll)break;const result=await E.monitoringArtistPostDownloadAll(monitoringArtist.monitorId,id);if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "monitoring-refresh": {if(!E||!E.monitoringRefresh||monitoringSyncing)break;monitoringSyncing=true;renderView();const result=await E.monitoringRefresh("");monitoringSyncing=false;await loadMonitoringData();toast(result&&result.ok?(result.baselined?"Watchers initialized — future updates will appear here":("Found "+result.added+" new update"+(result.added===1?"":"s"))):(result&&result.error||"Monitoring check could not finish"),result&&result.ok?"ok":"warn");break;}
    case "monitoring-monitor-refresh": {if(!E||!E.monitoringRefresh||monitoringSyncing)break;monitoringSyncing=true;renderView();const result=await E.monitoringRefresh(id);monitoringSyncing=false;await loadMonitoringData();toast(result&&result.ok?(result.baselined?"Baseline saved — future updates will be reported":("Found "+result.added+" new update"+(result.added===1?"":"s"))):(result&&result.error||"Watcher check could not finish"),result&&result.ok?"ok":"warn");break;}
    case "monitoring-monitor-toggle": {const monitor=monitoringMonitor(id);if(monitor&&E&&E.monitoringMonitorUpdate){await E.monitoringMonitorUpdate(id,{enabled:!monitor.enabled});await loadMonitoringData();toast(monitor.enabled?"Watcher paused":"Watcher resumed","ok");}break;}
    case "monitoring-monitor-remove": if(await confirmModal("Remove this watcher and its activity history?")){const anchor=captureListPosition(id);await E.monitoringRemove(id);await loadMonitoringData(anchor);toast("Watcher removed","ok");}break;
    case "monitoring-mark-read": if(E&&E.monitoringMarkRead){await E.monitoringMarkRead();await loadMonitoringData();toast("Monitoring activity marked read","ok");}break;
    case "monitoring-event-open": {const item=monitoringEvent(id);if(item){rememberMonitoringReturn(id);monitoringPostSequence=monitoringFilteredEvents().filter(function(entry){return entry.kind==="pawchive";}).map(function(entry){return String(entry.id);});if((!item.read||!item.readAt)&&E&&E.monitoringEventUpdate){item.read=true;item.readAt=Date.now();await E.monitoringEventUpdate(id,{read:true});}monitoringFocusId="";if(item.kind!=="pawchive"||!E||!E.monitoringPostDetail){monitoringPostSequence=[];if(item.url)openTarget(item.url,"url");renderView();break;}const requestId=++monitoringDetailRequest;monitoringDetailLoading=true;renderView();const result=await E.monitoringPostDetail(id);if(requestId!==monitoringDetailRequest)break;monitoringDetailLoading=false;if(result&&result.ok){monitoringDetail=result.detail;renderView();}else{monitoringPostSequence=[];renderView();toast(result&&result.error||"Could not open that Pawchive post","err");}}break;}
    case "monitoring-event-download": {const item=monitoringEvent(id);if(!item||!E||!E.monitoringDownloadAll)break;const result=await E.monitoringDownloadAll(item.id);if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "monitoring-event-original": {const item=monitoringEvent(id);if(item&&item.url)openTarget(item.url,"url");break;}
    case "monitoring-original": if(monitoringDetail&&monitoringDetail.originalUrl)openTarget(monitoringDetail.originalUrl,"url");break;
    case "monitoring-download": {if(!monitoringDetail)break;const index=Number(t.dataset.index),result=monitoringDetail.eventId&&E&&E.monitoringDownload?await E.monitoringDownload(monitoringDetail.eventId,index):E&&E.monitoringArtistDownload?await E.monitoringArtistDownload(monitoringDetail.monitorId,monitoringDetail.postId,index):null;if(result&&result.ok)toast("Attachment downloaded","ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "monitoring-image-expand": {const figure=t.closest(".mon-file"),image=t.closest("img.mon-reader-media");if(figure&&image){const before=image.getBoundingClientRect(),expanded=figure.classList.toggle("expanded");if(expanded)requestAnimationFrame(function(){sizeExpandedMonitoringImage(image,figure);animateMonitoringImageGeometry(image,before);figure.scrollIntoView({block:"center",behavior:"smooth"});});else animateMonitoringImageCollapse(image);}break;}
    case "monitoring-video-toggle": {const video=t.closest("video");if(video){if(video.controls||document.fullscreenElement===video||document.webkitFullscreenElement===video)break;clearTimeout(video._sinradClickTimer);video._sinradClickTimer=setTimeout(function(){if(video.paused)video.play().catch(function(){});else video.pause();},220);}break;}
    case "monitoring-download-all": {if(!monitoringDetail)break;const result=monitoringDetail.eventId&&E&&E.monitoringDownloadAll?await E.monitoringDownloadAll(monitoringDetail.eventId):E&&E.monitoringArtistPostDownloadAll?await E.monitoringArtistPostDownloadAll(monitoringDetail.monitorId,monitoringDetail.postId):null;if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "offline-tab": offlineTab=["history","sources","favorite"].includes(t.dataset.tab)?t.dataset.tab:"history";offlineFilter=offlineTab;offlineSourceBrowse="";offlineSelectedId="";offlineBrowseIds=[];offlineQuery="";renderView();break;
    case "offline-source-browse": offlineTab="sources";offlineSourceBrowse=t.dataset.source;offlineQuery="";renderView();break;
    case "offline-filter": offlineFilter=["unread","history","favorite"].includes(t.dataset.filter)?t.dataset.filter:"unread";offlineBrowseIds=[];renderView();break;
    case "offline-layout": {const result=E&&E.offlineSettings?await E.offlineSettings({feedLayout:t.dataset.layout==="scroll"?"scroll":"cards"}):null;if(result){offlineData=result;renderView();}break;}
    case "offline-refresh": {if(!E||!E.offlineRefresh||offlineSyncing)break;const anchor=captureListPosition();offlineSyncing=true;renderViewAnchored(anchor,false);const result=await E.offlineRefresh("");await loadOfflineData(anchor);const removed=Number(result&&result.removed)||0;toast(result&&result.ok?(offlineExtension.connected?((removed?"Refreshed "+removed+" old post"+(removed===1?"":"s")+" · ":"")+"filling every unread slot"):"Queued — waiting for the browser extension"):(result&&result.error||"Sync could not be queued"),result&&result.ok&&offlineExtension.connected?"ok":"warn");break;}
    case "offline-source-refresh": {if(!E||!E.offlineRefresh||offlineSyncing)break;const anchor=captureListPosition();offlineSyncing=true;renderViewAnchored(anchor,false);const result=await E.offlineRefresh(id);await loadOfflineData(anchor);const removed=Number(result&&result.removed)||0;toast(result&&result.ok?(offlineExtension.connected?((removed?"Refreshed "+removed+" old post"+(removed===1?"":"s")+" · ":"")+"filling every unread slot"):"Queued — waiting for the browser extension"):(result&&result.error||"Sync could not be queued"),result&&result.ok&&offlineExtension.connected?"ok":"warn");break;}
    case "offline-extension-open": if(E&&E.extOpen)await E.extOpen();break;
    case "offline-source-add": redditSourceModal();break;
    case "offline-source-follow": {const item=offlineItem(id),name=offlineRedditName(item);if(!item||!name||!E||!E.offlineSourceAdd)break;const result=await E.offlineSourceAdd({platform:"reddit",handle:name,limit:30,intervalHours:24,sort:"new",topComments:0});if(!result||!result.ok){toast(result&&result.error||"Could not start background downloads","err");break;}await loadOfflineData();offlineExtension=await E.offlineExtensionStatus();if(!offlineExtension.connected){offlineExtensionRequiredModal(name);break;}toast("Background browser download queued for r/"+name,"ok");break;}
    case "offline-source-remove": if(await confirmModal("Remove this subscription? Already downloaded posts will stay until retention removes them.")){await E.offlineSourceRemove(id,false);await loadOfflineData();toast("Subscription removed","ok");}break;
    case "offline-source-limit": {const source=(offlineData.sources||[]).find(function(entry){return entry.id===id;});if(source)offlineSourceLimitModal(source);break;}
    case "offline-retention": offlineRetentionModal();break;
    case "offline-item-open": {const item=offlineItem(id);if(item){if(!offlineMode&&!monitoringMode&&currentView==="home"){closePostImage();openTimelineRedditReader(item.id);break;}offlineBrowseIds=offlineFilteredItems().map(function(entry){return entry.id;});offlineReturnAnchor=captureListPosition(id);offlineSelectedId=id;markOfflineViewed(item);renderView();const content=$("#content");if(content)content.scrollTop=0;}break;}
    case "offline-item-nav": {const item=offlineItem(id);if(item){offlineSelectedId=id;markOfflineViewed(item);renderView();const content=$("#content");if(content)content.scrollTop=0;}break;}
    case "offline-gallery-prev":
    case "offline-gallery-next": {const gallery=t.closest(".of-gallery"),images=gallery?Array.from(gallery.querySelectorAll("[data-gallery-image]")):[];if(!gallery||images.length<2)break;const direction=a==="offline-gallery-next"?1:-1,current=Number(gallery.dataset.galleryIndex)||0,next=(current+direction+images.length)%images.length;images.forEach(function(image,index){image.classList.toggle("active",index===next);if(index!==next&&image.tagName==="VIDEO")image.pause();});gallery.dataset.galleryIndex=String(next);const count=gallery.querySelector(".of-gallery-count b");if(count)count.textContent=String(next+1);break;}
    case "offline-item-favorite": {const item=offlineItem(id);if(item&&E&&E.offlineItemUpdate){const prior=item.favorite;item.favorite=!item.favorite;timelineFeedSnapshots.forEach(function(snapshot){snapshot.rows.concat(snapshot.pending).forEach(function(row){if(row.id===id)row.favorite=item.favorite;});});offlineTimelineQuietUntil=Date.now()+1800;const button=t.closest('button[data-action="offline-item-favorite"]');paintOfflineFavoriteButton(button,item.favorite);E.offlineItemUpdate(id,{favorite:item.favorite}).catch(function(){item.favorite=prior;paintOfflineFavoriteButton(button,prior);toast("Could not update favorite","warn");});}break;}
    case "offline-item-download": {const item=offlineItem(id);if(!item||!E||!E.offlineItemDownload)break;const result=await E.offlineItemDownload(item.id);if(result&&result.ok)toast("Downloaded "+result.count+" file"+(result.count===1?"":"s"),"ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "offline-media-download": {if(!E||!E.offlineMediaDownload)break;const result=await E.offlineMediaDownload(id);if(result&&result.ok)toast("Image downloaded","ok");else if(!(result&&result.canceled))toast(result&&result.error||"Download failed","err");break;}
    case "offline-item-unread": {const item=offlineItem(id);if(item&&E&&E.offlineItemUpdate){const anchor=offlineSelectedId?offlineReturnAnchor:captureListPosition(id);await E.offlineItemUpdate(id,{read:false});if(offlineSelectedId===id){offlineSelectedId="";offlineReturnAnchor=null;}await loadOfflineData(anchor);toast("Moved back to Unread","ok");}break;}
    case "offline-item-remove": {const item=offlineItem(id);if(item&&E&&E.offlineItemRemove){const anchor=offlineSelectedId?offlineReturnAnchor:captureListPosition(id),result=await E.offlineItemRemove(id);if(result&&result.ok){rememberOfflineUndo("Deleted Clipping post",result.undoToken);offlineData={...offlineData,items:(offlineData.items||[]).filter(function(entry){return String(entry.id)!==String(id);})};removeTimelineOfflineItem(id);offlineBrowseIds=offlineBrowseIds.filter(function(value){return value!==id;});if(offlineSelectedId===id){offlineSelectedId="";offlineReturnAnchor=null;}await loadOfflineData(anchor);toast("Post deleted · Ctrl+Z to undo","ok");}}break;}
    case "offline-history-clear": {if(E&&E.offlineHistoryClear){const anchor=captureListPosition(),result=await E.offlineHistoryClear();if(result&&result.ok){rememberOfflineUndo("Cleared Clipping history",result.undoToken);offlineSelectedId="";offlineBrowseIds=[];offlineReturnAnchor=null;await loadOfflineData(anchor);toast(result.removed?"History cleared · Ctrl+Z to undo":"History is already empty",result.removed?"ok":"warn");}}break;}
    case "offline-original": {const item=offlineItem(id);if(item&&item.url)openTarget(item.url,"url");break;}
    case "offline-capture-open": {const item=offlineItem(id);if(item&&item.captureRef&&E&&E.offlineCaptureOpen){const result=await E.offlineCaptureOpen(item.captureRef);if(!result||!result.ok)toast(result&&result.error||"Could not open the saved page","err");}break;}
    case "win-min": E&&E.winMin?E.winMin():toast("Window controls work in the desktop build"); break;
    case "win-max": E&&E.winMax?E.winMax():toast("Window controls work in the desktop build"); break;
    case "win-close": E&&E.winClose?E.winClose():toast("Window controls work in the desktop build"); break;
    case "vault-import": await passwordImportModal(); break;
    case "vault-edit": vaultModal(find(state.vault,id)); break;
    case "vault-del": { const v=find(state.vault,id); if(v&&await confirmModal("Delete "+v.name+"?")){ const anchor=captureListPosition(id);rememberUndo("Deleted vault entry "+v.name); state.vault=state.vault.filter(x=>x.id!==id); log("warn","Deleted vault entry: "+v.name); saveState(); renderViewAnchored(anchor,false); toast("Deleted","ok"); } break; }
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
    case 'link-openall': { var cn=t.dataset.coll; var list=state.links.filter(function(l){return _inLot(l)&&(l.coll||'')===cn;}); if(list.length>8 && !(await confirmModal('Open '+list.length+' tabs from '+cn+'?'))) break; list.forEach(function(l){ if(E&&E.shellOpen)E.shellOpen(l.url); else try{window.open(l.url,'_blank');}catch(_){} }); log('info','opened '+list.length+' links from '+cn); break; }
        case "cat-del-ctx": { var cn3=(t.dataset.cat||"").trim(); if(cn3){ confirmModal("Delete category \""+cn3+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn3); toast("Category deleted","ok"); } }); } break; }
    case "cat-del": { const cat=t.dataset.cat; if(cat&&state.categories&&state.categories[cat]){ confirmModal("Delete category \""+cat+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cat); toast("Category deleted","ok"); } }); } break; }
    case "cat-add": { const catType=t.dataset.type||"link"; openModal("New Category", '<div class="field"><label>Category name</label><input id="cat_name" placeholder="e.g. Tutorials"></div><div class="field"><label>Color</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cat_color" value="#27b4ff" style="width:60px;height:40px;border:none;border-radius:4px;background:var(--input);cursor:pointer;padding:0"></div></div>', "Create", function(){ var name=($("#cat_name")||{}).value||""; name=name.trim(); if(!name){ toast("Name required","warn"); return; } var cc=CAT_COLORS[name]; if(cc&&(!state.categories||!state.categories[name])&&DEFAULT_CATS[name]){ toast("Category already exists","warn"); return; } if(state.categories&&state.categories[name]){ toast("Category already exists","warn"); return; } var color=($("#cat_color")||{}).value||"#27b4ff"; if(catType==="folder"){if(!state.folderCategories)state.folderCategories={};state.folderCategories[name]=color;saveState();refreshFolderCats();renderView();}else if(catType==="shot"){if(!state.shotCollections)state.shotCollections={};if(state.shotCollections[name]||SHOT_DEFAULT_COLS[name]){toast("Category already exists","warn");return;}state.shotCollections[name]=color;saveState();renderView();}else{addCategory(name,color);}closeModal(); toast("Category created: "+name,"ok"); }); setTimeout(function(){ var i=document.getElementById("cat_name"); if(i) i.focus(); },30); break; }
    case "cat-del-pill": { var cn2=(t.dataset.cat||"").trim(); if(cn2){ confirmModal("Delete category \""+cn2+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn2); toast("Category deleted","ok"); } }); } break; }
    case "cat-delete": { var cn=id; confirmModal("Delete category \""+cn+"\"? Links will become uncategorized.").then(function(y){ if(y){ deleteCategory(cn); toast("Category deleted","ok"); } }); break; }
    case "link-del": { const l=find(state.links,id); if(l&&await confirmModal("Delete "+l.title+"?")){ const anchor=captureListPosition(id);rememberUndo("Deleted link "+l.title); state.links=state.links.filter(x=>x.id!==id); log("warn","Deleted link: "+l.title); saveState(); renderViewAnchored(anchor,false); } break; }
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
    case "shot-forget": { const s=shotById(id); if(s&&await confirmModal("Remove "+s.name+" from Shots? The file on disk stays.")){ const anchor=captureListPosition(id);state.shots=state.shots.filter(function(x){ return x.id!==id; }); if(shotOpenId===id) shotHide(); saveState(); renderViewAnchored(anchor,false); toast("Removed from Shots","ok"); } break; }
    case "folder-open": openByAction("folder-open",id); break;
    case "folder-edit": folderEditModal(id); break;
    case "folder-fav": { const f=find(state.folders,id); if(f){ rememberUndo("Changed folder favorite"); f.favorite=!f.favorite; log("info",(f.favorite?"Favorited":"Unfavorited")+" folder: "+(f.name||"")); saveState(); renderView(); } break; }
    case "folder-del": { const f=find(state.folders,id); if(f&&await confirmModal("Remove "+(f.name||baseName(f.path||f.name))+"?")){ const anchor=captureListPosition(id);rememberUndo("Removed folder "+(f.name||baseName(f.path||f.name))); state.folders=state.folders.filter(x=>x.id!==id); log("warn","Removed quick folder"); saveState(); renderViewAnchored(anchor,false); } break; }
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
document.addEventListener("input",function(ev){if(ev.target&&ev.target.id==="idea_import_text")ideaImportText=ev.target.value;});
document.addEventListener("change",function(ev){const option=ev.target&&ev.target.dataset&&ev.target.dataset.compressionOption;if(option==="turbo")compressionTurbo=!!ev.target.checked;else if(option==="fps")compressionCapFps=!!ev.target.checked;else return;renderView();});
document.addEventListener("change",function(ev){const field=ev.target&&ev.target.closest&&ev.target.closest("[data-deck-width]");if(!field)return;const item=timelineDeck()[Number(field.dataset.deckWidth)],width=Math.max(280,Math.min(900,Number(field.value)||TIMELINE_DEFAULT_COLUMN_WIDTH));if(item){item.width=width;item.autoWidth=false;deckSettingsId="";saveState();renderView();}});
document.addEventListener("paste",function(ev){if(currentView!=="ideas"||ideaPane!=="import"||!ev.clipboardData)return;const files=Array.from(ev.clipboardData.files||[]).filter(function(file){return /^image\//i.test(file.type||"");});if(!files.length)return;ev.preventDefault();importIdeaImageFiles(files);});
document.addEventListener("dragover",function(ev){if(deckDragKey)return;const timelineColumn=ev.target&&ev.target.closest&&ev.target.closest('.deck-column[data-deck-id="compression"]');if((currentView!=="compress"&&!timelineColumn)||offlineMode||monitoringMode)return;ev.preventDefault();const drop=timelineColumn||document.querySelector("[data-compression-drop]");if(drop)drop.classList.add("dragging");});
document.addEventListener("dragleave",function(ev){const drop=ev.target&&ev.target.closest&&ev.target.closest('.deck-column[data-deck-id="compression"], [data-compression-drop]');if(drop&&!drop.contains(ev.relatedTarget))drop.classList.remove("dragging");});
document.addEventListener("drop",async function(ev){
  if(deckDragKey)return;
  const timelineColumn=ev.target&&ev.target.closest&&ev.target.closest('.deck-column[data-deck-id="compression"]');if((currentView!=="compress"&&!timelineColumn)||offlineMode||monitoringMode)return;ev.preventDefault();const drop=timelineColumn||document.querySelector("[data-compression-drop]");if(drop)drop.classList.remove("dragging");
  if(compressionProgress.active)return;const files=Array.from(ev.dataTransfer&&ev.dataTransfer.files||[]);if(!files.length)return;
  if(timelineColumn||files.length>1){await startDroppedCompressionBatch(files);return;}
  try{const source=E&&E.compressionDropPath?E.compressionDropPath(files[0]):"";if(source)await analyzeCompression(source);else toast("Could not read that dropped item","err");}catch(_){toast("Could not read that dropped item","err");}
});
document.addEventListener("dragover",function(ev){const zone=ev.target&&ev.target.closest&&ev.target.closest("[data-idea-drop]");if(!zone)return;ev.preventDefault();zone.classList.add("dragging");});
document.addEventListener("dragleave",function(ev){const zone=ev.target&&ev.target.closest&&ev.target.closest("[data-idea-drop]");if(zone)zone.classList.remove("dragging");});
document.addEventListener("drop",function(ev){const zone=ev.target&&ev.target.closest&&ev.target.closest("[data-idea-drop]");if(!zone)return;ev.preventDefault();zone.classList.remove("dragging");importIdeaImageFiles(ev.dataTransfer&&ev.dataTransfer.files);});
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
document.addEventListener("click",function(ev){const wrap=$("#globalSearch");if(wrap&&!wrap.contains(ev.target)&&!ev.target.closest('[data-action="shell-search"]'))closeGlobalSearch(false);});

let settingsTab="general";
const CENSOR_AWAY_MS=5*60*1000;
let censorAwayAt=0,censorAwayTimer=null,censorAutoActive=false,censorReturnPromptOpen=false;
function settingCopy(label,detail){return '<span class="setting-copy"><b class="setting-label">'+esc(label)+'</b>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</span>';}
function settingToggle(key,label,detail,on){return '<div class="setting-row setting-toggle-row">'+settingCopy(label,detail)+'<label class="setting-switch"><input type="checkbox" data-setting-toggle="'+esc(key)+'"'+(on?' checked':'')+'><i></i></label></div>';}
function settingContextRow(title,key,detail,description){return '<div class="setting-row setting-context-row" data-settings-menu="'+esc(key)+'">'+settingCopy(title,description)+'<span class="setting-context-hint">'+esc(detail||"Options")+' <b>›</b></span></div>';}
function settingFolderRow(title,folder,key,description){return '<div class="setting-row setting-context-row" data-settings-menu="'+esc(key||"offline-storage")+'">'+settingCopy(title,description)+'<div class="setting-folder-control"><code class="setting-path">'+esc(folder||"Loading folder…")+'</code><span class="setting-context-hint">Manage <b>›</b></span></div></div>';}
function settingOpenModeRow(){return '<div class="setting-row setting-toggle-row">'+settingCopy("Open cards with one click","Use a single click instead of a double click.")+'<label class="setting-switch"><input type="checkbox" id="settingOpenModeToggle"'+(state.openMode==='single'?' checked':'')+'><i></i></label></div>';}
function settingMonitoringRow(){const censored=censorModeActive();return '<div class="setting-row setting-toggle-row">'+settingCopy("Windows notifications",censored?"Paused while Censor Mode is on.":"Show an alert when a monitored source updates.")+'<label class="setting-switch"><input type="checkbox" data-monitoring-notifications'+(monitoringData.settings.notifications&&!censored?' checked':'')+(censored?' disabled':'')+'><i></i></label></div>';}
function settingOfflineCollectionRow(){return '<div class="setting-row setting-toggle-row">'+settingCopy("Clipping collection","Pause new Clipping downloads while allowing the current save to finish.")+'<label class="setting-switch"><input type="checkbox" data-offline-collection'+(offlineData.settings?.collectionPaused?'':' checked')+'><i></i></label></div>';}
function censorModeActive(){return !!(state.settings&&state.settings.censorMode)||censorAutoActive;}
let censorSweepRevision=0;
function syncCensorOffButton(){
  let button=document.getElementById("persistentCensorOff");
  if(!button){button=document.createElement("button");button.id="persistentCensorOff";button.type="button";button.textContent="Turn off the censor";button.addEventListener("click",function(){setCensorModeEnabled(false);});document.body.appendChild(button);}
  button.hidden=!censorModeActive();
}
function applyCensorMode(){const active=censorModeActive();syncCensorOffButton();document.documentElement.classList.toggle("censor-mode",active);document.documentElement.classList.toggle("censor-away-covered",active&&!!censorAwayAt&&state.settings.censorPrivacyScreen!==false);if(!active){censorSweepRevision++;document.documentElement.classList.remove("censor-sweeping");document.querySelectorAll(".censor-sweep-on").forEach(function(card){card.classList.remove("censor-sweep-on");});}if(E&&E.setCensorMode)E.setCensorMode(active);}
function refreshTimelineCensorColumns(){
  [document,timelineSurfaceCache].filter(Boolean).forEach(function(root){root.querySelectorAll('.deck-column[data-deck-id="monitoring"]').forEach(function(column){
    const config=timelineDeck().find(function(item){return item.key===column.dataset.deckKey;}),scroller=column.querySelector(".deck-column-scroll");
    if(!config||!scroller)return;const top=scroller.scrollTop;scroller.innerHTML=timelineColumnBody(config);scroller.scrollTop=top;column._snapshot=timelineFeedSnapshots.get(config.key);
  });
  });
  cleanupMediaObservers();hydrateMonitoringMedia();
}
function monitoringCollections(){if(!state.settings)state.settings={};if(!Array.isArray(state.settings.monitoringCollections))state.settings.monitoringCollections=[];return state.settings.monitoringCollections;}
function monitoringCollection(id){return monitoringCollections().find(function(item){return item.id===id;});}
function monitoringCollectionPost(type,id){
  if(type==="monitor-event"){
    const item=monitoringEvent(id),monitor=item&&monitoringMonitor(item.monitorId);if(!item)return null;
    return {key:"event:"+item.id,eventId:item.id,monitorId:item.monitorId||"",kind:item.kind||"",title:item.title||"Untitled post",summary:item.summary||"",creator:monitor&&monitor.label||item.author||"Monitoring",date:item.date||Date.now(),url:item.url||"",mediaRef:item.mediaRef||"",mediaPath:item.meta&&item.meta.mediaPath||"",addedAt:Date.now()};
  }
  if(type==="monitor-artist-post"){
    const item=monitoringArtist&&(monitoringArtist.posts||[]).find(function(post){return String(post.postId)===String(id);});if(!item)return null;
    return {key:"artist:"+monitoringArtist.monitorId+":"+item.postId,monitorId:monitoringArtist.monitorId,postId:item.postId,kind:"pawchive",title:item.title||"Untitled post",summary:item.summary||"",creator:monitoringArtist.label||"Pawchive",date:item.date||Date.now(),url:item.url||"",previewSrc:item.previewSrc||"",addedAt:Date.now()};
  }
  if(type==="monitor-post"&&monitoringDetail){
    const detail=monitoringDetail,event=detail.eventId&&monitoringEvent(detail.eventId),image=(detail.files||[]).find(function(file){return file.kind==="image";});
    return {key:detail.eventId?"event:"+detail.eventId:"post:"+(detail.monitorId||"")+":"+(detail.postId||"current"),eventId:detail.eventId||"",monitorId:detail.monitorId||"",postId:detail.postId||"",kind:"pawchive",title:detail.title||"Untitled post",summary:detail.content||"",creator:detail.creator||detail.author||"Pawchive",date:detail.date||Date.now(),url:detail.originalUrl||"",mediaRef:event&&event.mediaRef||"",previewSrc:image&&image.src||"",addedAt:Date.now()};
  }
  return null;
}
function monitoringCollectionSendMenu(type,id,withDivider){
  const post=monitoringCollectionPost(type,id);if(!post)return "";monitoringCollectionMenuPost=post;
  const collections=monitoringCollections(),recent=monitoringCollection(state.settings&&state.settings.monitoringRecentCollectionId),hint=recent?"Recent: "+recent.name:"Choose a collection";
  const choices=collections.length?collections.map(function(collection){return '<div class="ci" data-action="monitoring-collection-send" data-collection="'+esc(collection.id)+'"><span class="ci-ico">→</span><span class="ci-label">'+esc(collection.name)+'</span></div>';}).join(""):'<div class="ci ci-disabled"><span class="ci-label">No collections yet</span></div>';
  return (withDivider===false?'':'<div class="cdiv"></div>')+'<div class="ci ci-submenu" data-action="monitoring-collection-send-recent" title="'+esc(hint)+'"><span class="ci-ico">→</span><span class="ci-label">Send to</span><span class="ci-arrow">‹</span><div class="ci-submenu-panel">'+choices+'</div></div>';
}
function monitoringCollectionCard(post,collectionId){
  const title=monitoringPrivateText(post.title,post.key+":title"),summary=monitoringPrivateText(post.summary,post.key+":summary"),creator=monitoringPrivateText(post.creator,post.key+":creator");
  const media=monitoringOriginalMediaTag(post.mediaPath,post.mediaRef,"mon-event-preview",title)||(post.mediaRef?monitoringMediaTag(post.mediaRef,"mon-event-preview",title):(post.previewSrc?'<img class="mon-event-preview loaded" src="'+esc(post.previewSrc)+'" alt="'+esc(title)+'" loading="lazy">':""));
  return '<article class="mon-event mon-collection-post'+(media?' has-image':' text-only')+'" data-action="monitoring-collection-post-open" data-collection="'+esc(collectionId)+'" data-id="'+esc(post.key)+'"><div class="mon-event-media"><div class="mon-event-placeholder" aria-hidden="true"></div>'+media+'</div><div class="mon-event-copy"><div class="mon-event-meta"><b>'+esc(creator)+'</b><time>'+esc(monitoringDate(post.date))+'</time></div><h2>'+esc(title)+'</h2>'+(summary?'<p>'+esc(summary)+'</p>':'')+'</div></article>';
}
let monitoringOpenCollectionId="";
function viewMonitoringCollections(){
  const collections=monitoringCollections(),selected=collections.find(item=>item.id===monitoringOpenCollectionId);
  if(selected){const posts=selected.posts||[];return '<div class="mon-collections" data-ctx="monitor-collections" data-id="collections"><section class="mon-collection"><header><h2>'+esc(selected.name)+'</h2><span>'+posts.length+' posts</span></header>'+(posts.length?'<div class="mon-events mon-collection-grid">'+posts.map(post=>monitoringCollectionCard(post,selected.id)).join('')+'</div>':'<p>Right-click a Monitoring post and choose Send to.</p>')+'</section></div>';}
  const content=collections.map(function(collection){const posts=collection.posts||[],previews=posts.filter(post=>post.mediaPath||post.mediaRef||post.previewSrc).slice(0,3);let layers="";for(let index=0;index<3;index++){const post=previews[index];const media=post?(monitoringOriginalMediaTag(post.mediaPath,post.mediaRef,"collection-folder-image","")||(post.mediaRef?monitoringMediaTag(post.mediaRef,"collection-folder-image",""):'<img class="collection-folder-image" src="'+esc(post.previewSrc)+'" alt="" loading="lazy">')):"";layers+='<span class="collection-folder-layer layer-'+index+'">'+media+'</span>';}
    return '<button type="button" class="mon-collection collection-folder" data-ctx="monitor-collection-folder" data-action="monitoring-collection-open" data-id="'+esc(collection.id)+'"><span class="collection-folder-art">'+layers+'<span class="collection-folder-pocket"><h2>'+esc(collection.name)+'</h2></span></span><small>'+posts.length+' POST'+(posts.length===1?'':'S')+'</small></button>';
  }).join('');
  return '<div class="mon-collections '+(collections.length?'collection-folders':'mon-collections-blank')+'" data-ctx="monitor-collections" data-id="collections" aria-label="Folders">'+content+'</div>';
}
function monitoringCollectionAddModal(){hideMenu();openModal("New collection",'<div class="field"><label>Collection name</label><input id="mon_collection_name" maxlength="80" placeholder="Name this collection"></div>',"Create",function(){const name=val("mon_collection_name").trim();if(!name){toast("Give the collection a name","warn");return;}if(monitoringCollections().some(function(item){return item.name.toLowerCase()===name.toLowerCase();})){toast("That collection already exists","warn");return;}const collection={id:uid(),name:name,posts:[],createdAt:Date.now(),updatedAt:Date.now()};monitoringCollections().unshift(collection);state.settings.monitoringRecentCollectionId=collection.id;saveState();closeModal();renderView();toast("Collection created","ok");});}
function sendMonitoringPostToCollection(collectionId){const collection=monitoringCollection(collectionId),post=monitoringCollectionMenuPost;if(!collection){toast("Create a collection first","warn");return false;}if(!post){toast("That post is no longer available","warn");return false;}if(!Array.isArray(collection.posts))collection.posts=[];const existing=collection.posts.findIndex(function(item){return item.key===post.key;});if(existing>=0)collection.posts.splice(existing,1);collection.posts.unshift(Object.assign({},post,{addedAt:Date.now()}));collection.updatedAt=Date.now();state.settings.monitoringRecentCollectionId=collection.id;saveState();hideMenu();if(monitoringMode&&monitoringTab==="collections")renderView();toast(existing>=0?"Moved to the top of "+collection.name:"Sent to "+collection.name,"ok");return true;}
function refreshCensorContent(){refreshTimelineCensorColumns();if(monitoringMode)renderView();}
function refreshCensorControls(){const panel=$("#settingsPanel");if(panel&&panel.classList.contains("show")&&settingsTab==="general")renderSettings();}
function animateCensorSweep(){if(!censorModeActive()||window.matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.remove("censor-sweeping");return;}const revision=++censorSweepRevision,root=document.documentElement;root.classList.add("censor-sweeping");requestAnimationFrame(function(){if(revision!==censorSweepRevision)return;const cards=Array.from(document.querySelectorAll(".monitoring-shell .mon-event,.monitoring-shell .mon-watch,.monitoring-shell .mon-artist-post,.monitoring-shell .mon-reader-post,.deck-column[data-deck-id=\"monitoring\"] .deck-monitor-post"));if(!cards.length){root.classList.remove("censor-sweeping");return;}cards.forEach(function(card,index){setTimeout(function(){if(revision===censorSweepRevision)card.classList.add("censor-sweep-on");},Math.min(index,18)*32);});setTimeout(function(){if(revision!==censorSweepRevision)return;root.classList.remove("censor-sweeping");cards.forEach(function(card){card.classList.remove("censor-sweep-on");});},Math.min(cards.length,19)*32+190);});}
function setCensorModeEnabled(enabled){if(!state.settings)state.settings={};state.settings.censorMode=!!enabled;censorAutoActive=false;if(!enabled&&document.hasFocus()&&!document.hidden){censorAwayAt=0;clearTimeout(censorAwayTimer);censorAwayTimer=null;}if(enabled)document.documentElement.classList.add("censor-sweeping");applyCensorMode();refreshCensorContent();if(enabled)animateCensorSweep();saveState();refreshCensorControls();toast("Censor mode "+(enabled?"on":"off"),"ok");}
function activateAwayCensor(onReturn){if(state.settings&&state.settings.censorMode)return;if(!onReturn&&document.hasFocus()&&!document.hidden){censorAwayAt=0;censorAwayTimer=null;return;}censorAutoActive=true;censorSweepRevision++;document.documentElement.classList.remove("censor-sweeping");applyCensorMode();refreshCensorContent();refreshCensorControls();}
function beginCensorAway(){
  document.documentElement.classList.toggle("censor-away-covered",censorModeActive()&&state.settings.censorPrivacyScreen!==false);
  if(censorAwayAt)return;
  censorAwayAt=Date.now();
  clearTimeout(censorAwayTimer);
  if(!(state.settings&&state.settings.censorMode))censorAwayTimer=setTimeout(activateAwayCensor,CENSOR_AWAY_MS);
}
function promptAwayCensor(){syncCensorOffButton();}
function returnFromCensorAway(){
  if(!censorAwayAt){document.documentElement.classList.remove("censor-away-covered");return;}
  const elapsed=Date.now()-censorAwayAt;censorAwayAt=0;clearTimeout(censorAwayTimer);censorAwayTimer=null;
  if(!(state.settings&&state.settings.censorMode)&&elapsed>=CENSOR_AWAY_MS){activateAwayCensor(true);promptAwayCensor();}
  requestAnimationFrame(function(){if(document.hasFocus()&&!document.hidden)document.documentElement.classList.remove("censor-away-covered");});
}
function settingHotkeyRow(name,label,enabled){const hotkey=currentHotkeys()[name],toggle=name==="quickSave"?'<label class="setting-switch" aria-label="Enable quick save"><input type="checkbox" data-setting-toggle="hk"'+(enabled?' checked':'')+'><i></i></label>':'';return '<div class="setting-row">'+settingCopy(label,"Click the shortcut, then press a new key combination.")+'<div class="setting-hotkey-control"><input class="setting-hotkey-input" data-hotkey-field="'+esc(name)+'" value="'+esc(hotkeyDisplay(hotkey))+'" readonly aria-label="'+esc(label)+' hotkey">'+toggle+'</div></div>';}
function settingsGroup(icon,title,description,content){return '<section class="settings-group"><header><i>'+icon+'</i><div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div></header><div class="settings-group-rows">'+content+'</div></section>';}
function settingsStacks(){const counts={};(state.links||[]).filter(_inLot).forEach(function(link){const key=link.coll||_parkHost(link.url);counts[key]=(counts[key]||0)+1;});return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]||a.localeCompare(b);}).map(function(key){return {name:key,count:counts[key]};});}
function renderSettings(){
  const tabs=$("#settingsTabs"),body=$("#settingsBody");if(!tabs||!body)return;
  const names=[{id:"general",icon:"◉",name:"General",detail:"Startup and behavior"},{id:"parking",icon:"▤",name:"Organization",detail:"Parking stacks"},{id:"tools",icon:"⌘",name:"Tools & storage",detail:"Folders, links and hotkeys"}];
  tabs.innerHTML=names.map(function(tab){return '<button type="button" class="'+(settingsTab===tab.id?'active':'')+'" data-settings-tab="'+tab.id+'"><i>'+tab.icon+'</i><span><b>'+tab.name+'</b><small>'+tab.detail+'</small></span></button>';}).join("");
  const s=state.settings||{};
  if(settingsTab==="general"){
    body.innerHTML='<div class="settings-page"><div class="settings-page-title"><span>General</span><h1>App preferences</h1><p>Choose how SINRAD starts, opens content, and alerts you.</p></div>'+settingsGroup("↗","Startup and behavior","Control what happens when you sign in or launch the app.",
      settingToggle("intro","Boot animation","Play the intro animation before the main window.",s.introEnabled!==false)+
      settingToggle("autostart","Start with Windows","Open SINRAD after signing in.",!!s.autoStart)+
      settingToggle("pet","Undock Norma on startup","Start the desktop pet outside the main panel.",!!s.petAutoUndock)+
      settingOpenModeRow())+
      settingsGroup("◌","Privacy & content","Hide Monitoring artwork whenever you need a safer screen.",settingToggle("censor","Censor mode","Blur Monitoring media now and automatically after five minutes away.",censorModeActive())+settingToggle("censorPrivacyScreen","No peaking screen","Cover the app while away when censor mode is on. Turn off to keep only media censoring.",s.censorPrivacyScreen!==false))+
      settingsGroup("◎","Background activity","Control alerts and automatic Clipping collection.",settingMonitoringRow()+settingOfflineCollectionRow())+'</div>';
    return;
  }
  if(settingsTab==="parking"){
    const stacks=settingsStacks();
    body.innerHTML='<div class="settings-page"><div class="settings-page-title"><span>Organization</span><h1>Parking stacks</h1><p>See how saved links are grouped across your Parking Lot.</p></div>'+settingsGroup("▤","Current stacks","Stacks form automatically from saved links.",stacks.length?'<div class="setting-stacks">'+stacks.map(function(stack){return '<span class="setting-chip"><span>'+esc(stack.name)+'</span><b>'+stack.count+'</b></span>';}).join("")+'</div>':'<div class="setting-empty">No stacks yet. Park a few related links to create one.</div>')+'</div>';
    return;
  }
  body.innerHTML='<div class="settings-page"><div class="settings-page-title"><span>Tools & storage</span><h1>Manage SINRAD</h1><p>Review your library, storage locations, extension, and shortcuts.</p></div>'+settingsGroup("↗","Link library","Keep saved links clean and correctly organized.",
    settingContextRow("Exact duplicates","duplicates","Review","Find identical saved URLs.")+
    settingContextRow("Smart categories","smart-rules","Edit rules","Automatically categorize matching websites.")+
    settingContextRow("Link health","link-health",_linkCheckRunning?("Checking "+_linkCheckDone+"/"+_linkCheckTotal):"Check now","Find saved links that no longer respond."))+
    settingsGroup("◷","Clipping reader","Control retention for posts you have already viewed.",settingContextRow("History cleanup","offline-history",(offlineData.settings&&offlineData.settings.historyCleanupMode)||"Manual","Choose when read posts and cached files are removed."))+
    settingsGroup("□","Media folders","Choose where local content and downloads are kept.",settingFolderRow("Clipping library",offlineData.storagePath,"offline-storage","Cached posts and media.")+settingFolderRow("Monitoring downloads",monitoringData.settings&&monitoringData.settings.downloadFolder,"monitoring-output","Downloaded creator files.")+settingFolderRow("Compression output",compressionSettings.outputFolder||"Beside each original","compression-output","Compressed files and archives.")+settingContextRow("Intro videos","media-intros","Open folder","Videos used during app startup.")+settingContextRow("App animations","media-animations","Open folder","Custom interface animation files."))+
    settingsGroup("◇","Browser connection","Manage the companion browser extension.",settingContextRow("Browser extension","extension","Open folder","Open the installable extension folder."))+
    settingsGroup("⌘","Keyboard shortcuts","Click a shortcut field to record a replacement.",settingHotkeyRow("globalSearch","Global search",true)+settingHotkeyRow("commandPalette","Commands",true)+settingHotkeyRow("undo","Undo",true)+settingHotkeyRow("quickSave","Quick save",s.hotkeyEnabled!==false))+'</div>';
}
function paintSettingsToggle(open){const button=$("#settingsToggle");if(!button)return;button.classList.toggle("active",!!open);button.setAttribute("aria-expanded",open?"true":"false");button.setAttribute("aria-label",open?"Close settings":"Open settings");}
function openSettings(){closeGlobalSearch(false);closeCommandPalette();const panel=$("#settingsPanel");if(!panel)return;panel.classList.add("show");panel.setAttribute("aria-hidden","false");paintSettingsToggle(true);renderSettings();const openedTab=settingsTab,requests=[E&&E.getAutostart?E.getAutostart():null,E&&E.monitoringLoad?E.monitoringLoad():null,E&&E.offlineLoad?E.offlineLoad():null];Promise.all(requests.map(function(request){return Promise.resolve(request).catch(function(){return null;});})).then(function(results){let changed=false;const startup=results[0];if(startup&&startup.ok){if(!state.settings)state.settings={};if(state.settings.autoStart!==!!startup.enabled){state.settings.autoStart=!!startup.enabled;saveState();changed=true;}}if(results[1]){monitoringData=results[1];monitoringDataReady=true;changed=true;}if(results[2]){offlineData=results[2];offlineDataReady=true;changed=true;}if(changed&&panel.classList.contains("show")&&settingsTab===openedTab)renderSettings();});}
function closeSettings(){const panel=$("#settingsPanel");if(panel){panel.classList.remove("show");panel.setAttribute("aria-hidden","true");}paintSettingsToggle(false);}
function toggleSettings(){const panel=$("#settingsPanel");if(panel&&panel.classList.contains("show"))closeSettings();else openSettings();}
async function runSettingsCommand(command,showConsole,keepControls){if(showConsole){closeSettings();commandNavigate("console");}await handleCommand(command);if(!showConsole&&!keepControls)renderSettings();}
async function openOfflineStorageFolder(){if(!E||!E.offlineStorageOpen){toast("Clipping folders need the desktop app","warn");return;}if(!await E.offlineStorageOpen())toast("Could not open the Clipping folder","err");}
async function chooseOfflineStorageFolder(){if(!E||!E.offlineStorageChoose){toast("Clipping folders need the desktop app","warn");return;}const result=await E.offlineStorageChoose();if(result&&result.ok){if(result.snapshot)offlineData=result.snapshot;renderSettings();if(offlineMode)renderView();toast("Clipping library moved to the selected folder","ok");}else if(result&&!result.canceled)toast(result.error||"Could not change the Clipping folder","err");}
async function openMonitoringOutputFolder(){if(!E||!E.monitoringOutputOpen){toast("Monitoring folders need the desktop app","warn");return;}if(!await E.monitoringOutputOpen())toast("Could not open the Monitoring folder","err");}
async function chooseMonitoringOutputFolder(){if(!E||!E.monitoringOutputChoose){toast("Monitoring folders need the desktop app","warn");return;}const result=await E.monitoringOutputChoose();if(result&&result.ok){if(result.snapshot)monitoringData=result.snapshot;renderSettings();toast("Future Monitoring downloads will use this folder","ok");}else if(result&&!result.canceled)toast(result.error||"Could not change the Monitoring folder","err");}
async function chooseCompressionDestination(){if(!E||!E.compressionDestinationChoose){toast("Compression folders need the desktop app","warn");return;}const result=await E.compressionDestinationChoose();if(result&&result.ok){compressionSettings=result.settings||{outputFolder:""};renderSettings();if(currentView==="compress"&&compressionSource)await analyzeCompression(compressionSource);toast("Future compressed outputs will use this folder","ok");}else if(result&&!result.canceled)toast(result.error||"Could not change the compression destination","err");}
async function resetCompressionDestination(){if(!E||!E.compressionDestinationReset)return;const result=await E.compressionDestinationReset();if(result&&result.ok){compressionSettings=result.settings||{outputFolder:""};renderSettings();if(currentView==="compress"&&compressionSource)await analyzeCompression(compressionSource);toast("Compressed outputs will be placed beside their originals","ok");}}
async function openSettingsMediaFolder(kind){if(!E||!E.mediaOpen){toast("Media folders need the desktop app","warn");return;}const ok=await E.mediaOpen(kind);if(!ok)toast("Could not open that folder","err");}
function settingsMenuHtml(key){let items="";if(key==="duplicates")items=mi("settings-duplicates","","Review exact duplicates");else if(key==="smart-rules")items=mi("settings-rules","","Edit rules");else if(key==="link-health")items=mi("settings-link-check","",_linkCheckRunning?("Checking "+_linkCheckDone+"/"+_linkCheckTotal):"Check now");else if(key==="offline-history")items=mi("settings-offline-history","","Configure cleanup")+mi("offline-history-clear","","Clear history now","#ff5470",true,CTX_ICON.delete);else if(key==="offline-storage")items=mi("settings-offline-open","","Open folder")+mi("settings-offline-change","","Change folder");else if(key==="monitoring-output")items=mi("settings-monitoring-output-open","","Open folder")+mi("settings-monitoring-output-change","","Change folder");else if(key==="compression-output")items=(compressionSettings.outputFolder?mi("settings-compression-output-open","","Open folder"):"")+mi("settings-compression-output-change","","Change folder")+(compressionSettings.outputFolder?mi("settings-compression-output-reset","","Use beside each original"):"");else if(key==="media-intros")items=mi("settings-media-intros","","Open folder");else if(key==="media-animations")items=mi("settings-media-animations","","Open folder");else if(key==="extension")items=mi("settings-extension","","Open folder");return items;}
const settingsPanel=$("#settingsPanel");
if(settingsPanel){
  settingsPanel.addEventListener("click",async function(ev){
    if(ev.target===settingsPanel){closeSettings();return;}
    if(ev.target.closest("[data-settings-close]")){closeSettings();return;}
    const tab=ev.target.closest("[data-settings-tab]");if(tab){settingsTab=tab.dataset.settingsTab;renderSettings();return;}
  });
  settingsPanel.addEventListener("contextmenu",function(ev){const row=ev.target.closest("[data-settings-menu]");if(!row)return;ev.preventDefault();ev.stopPropagation();showMenu(ev.clientX,ev.clientY,settingsMenuHtml(row.dataset.settingsMenu));});
  settingsPanel.addEventListener("change",async function(ev){
    const notifications=ev.target.closest("[data-monitoring-notifications]");if(notifications){if(!E||!E.monitoringSettings){notifications.checked=!notifications.checked;toast("Monitoring settings need the desktop app","warn");return;}const result=await E.monitoringSettings({notifications:notifications.checked});if(!result){notifications.checked=!notifications.checked;toast("Could not save notification setting","err");return;}monitoringData=result;toast("Monitoring notifications "+(monitoringData.settings.notifications?"on":"off"),"ok");return;}
    const collection=ev.target.closest("[data-offline-collection]");if(collection){const collecting=collection.checked;if(!E||!E.offlineSettings){collection.checked=!collecting;toast("Clipping collection needs the desktop app","warn");return;}collection.disabled=true;const result=await E.offlineSettings({collectionPaused:!collecting});if(!result){collection.checked=!collecting;collection.disabled=false;toast("Could not change Clipping collection","err");return;}offlineData=result;renderSettings();if(offlineMode)renderView();toast(collecting?"Clipping collection resumed":"Clipping collection paused. Any current save can finish.","ok");return;}
    const toggle=ev.target.closest("[data-setting-toggle]");if(toggle){if(toggle.dataset.settingToggle==="autostart"){const requested=toggle.checked;toggle.disabled=true;if(!E||!E.setAutostart){toggle.checked=!requested;toast("Start with Windows needs the desktop app","warn");return;}const result=await E.setAutostart(requested);if(!state.settings)state.settings={};state.settings.autoStart=!!(result&&result.enabled);saveState();renderSettings();toast(result&&result.ok?("Start with Windows "+(result.enabled?"on":"off")):(result&&result.error||"Windows did not apply the startup setting"),result&&result.ok?"ok":"err");return;}if(toggle.dataset.settingToggle==="censorPrivacyScreen"){state.settings.censorPrivacyScreen=toggle.checked;saveState();applyCensorMode();return;}if(toggle.dataset.settingToggle==="censor"){setCensorModeEnabled(toggle.checked);return;}await runSettingsCommand(state.radCmd+" set "+toggle.dataset.settingToggle+" "+(toggle.checked?"on":"off"),false,true);return;}
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
  {group:"Navigate",id:"search",icon:"⌕",name:"Search everything",hint:hotkeyDisplay(hotkeys.globalSearch)},{group:"Navigate",id:"vault",icon:"◇",name:"Go to Vault"},{group:"Navigate",id:"links",icon:"↗",name:"Go to Links"},{group:"Navigate",id:"lot",icon:"P",name:"Go to Parking Lot"},{group:"Navigate",id:"folders",icon:"□",name:"Go to Folders"},{group:"Navigate",id:"shots",icon:"▣",name:"Go to Screenies"},{group:"Navigate",id:"ideas",icon:"◇",name:"Go to Ideas"},{group:"Navigate",id:"compress",icon:"↘",name:"Go to Compress"},{group:"Navigate",id:"offline",icon:"◫",name:offlineMode?"Exit Clipping Reader":"Open Clipping Reader"},{group:"Navigate",id:"monitoring",icon:"◎",name:monitoringMode?"Exit Monitoring Mode":"Open Monitoring Mode"},{group:"Navigate",id:"settings",icon:"⚙",name:"Open Settings"},
  {group:"Create",id:"add-vault",icon:"+",name:"Add vault entry"},{group:"Create",id:"add-link",icon:"+",name:"Add link"},{group:"Create",id:"add-folder",icon:"+",name:"Add folder"},{group:"Create",id:"add-idea",icon:"+",name:"Add idea"},
  {group:"Actions",id:"undo",icon:"↶",name:"Undo latest change",hint:hotkeyDisplay(hotkeys.undo)},{group:"Actions",id:"duplicates",icon:"≋",name:"Review exact duplicates"},{group:"Actions",id:"rules",icon:"⌁",name:"Smart category rules"},{group:"Actions",id:"check-links",icon:"✓",name:"Check saved links"},{group:"Actions",id:"backup",icon:"↓",name:"Create encrypted backup"},{group:"Actions",id:"restore",icon:"↑",name:"Restore encrypted backup"},{group:"Actions",id:"update",icon:"↻",name:"Check for updates"}
];}
function renderCommandPalette(){const input=$("#commandInput"),list=$("#commandList");if(!input||!list)return;const query=input.value.trim().toLowerCase();commandItems=commandDefinitions().filter(function(command){return !query||command.name.toLowerCase().indexOf(query)>=0||command.id.indexOf(query)>=0;});if(commandActive>=commandItems.length)commandActive=0;let lastGroup="";list.innerHTML=commandItems.length?commandItems.map(function(command,index){const heading=command.group!==lastGroup?'<div class="cp-group">'+esc(command.group)+'</div>':'';lastGroup=command.group;return heading+'<button type="button" class="cp-item'+(index===commandActive?' active':'')+'" data-command="'+command.id+'"><i>'+command.icon+'</i><b>'+esc(command.name)+'</b><small>'+esc(command.hint||"")+'</small></button>';}).join(""):'<div class="cp-empty">No matching command</div>';}
function openCommandPalette(){const palette=$("#commandPalette"),input=$("#commandInput");if(!palette||!input)return;closeGlobalSearch(false);palette.classList.add("show");palette.setAttribute("aria-hidden","false");input.value="";commandActive=0;renderCommandPalette();setTimeout(function(){input.focus();},20);}
if(E&&E.onCommandPalette)E.onCommandPalette(openCommandPalette);
function closeCommandPalette(){const palette=$("#commandPalette");if(palette){palette.classList.remove("show");palette.setAttribute("aria-hidden","true");}}
function commandNavigate(view,focus){if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);currentView=view;searchTerms={};renderNav();renderView();if(focus)setTimeout(function(){const target=$(focus);if(target)target.focus();},20);}
function focusTabSearch(){
  const content=$("#content");content.classList.add("searching");
  document.getElementById("tabFindBar")?.remove();
  let input=content.querySelector('#monitoringSearch,#offlineSearch,[data-search],#inlineTabSearch');
  if(!input){
    const bar=document.createElement("div");bar.className="mon-toolbar inline-tab-search";
    bar.innerHTML='<input id="inlineTabSearch" type="search" aria-label="Search this tab" placeholder="Search this tab…">';
    const shell=content.querySelector('.monitoring-shell,.deck-view')||content;
    const anchor=shell.querySelector('.mon-tabs,.deck-workspace-head');
    if(anchor)anchor.after(bar);else shell.prepend(bar);
    input=bar.querySelector('input');
    input.addEventListener('input',function(){const query=input.value.trim().toLowerCase();const cards=shell.querySelectorAll('.mon-watch,.mon-collection,.mon-artist-post,.deck-monitor-post,.deck-row,.of-card');cards.forEach(function(card){card.hidden=!!query&&!card.textContent.toLowerCase().includes(query);});});
  }
  input.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});input.focus({preventScroll:true});input.select();
}
function runPaletteCommand(id){closeCommandPalette();switch(id){case "search":{$("#globalSearch").classList.add("shell-open");if(offlineMode)setOfflineMode(false,true);if(monitoringMode)setMonitoringMode(false,true);renderView();const input=$("#globalSearchInput");if(input){input.focus();input.select();renderGlobalSearch();}break;}case "undo":undoLastChange();break;case "settings":openSettings();break;case "offline":setOfflineMode(!offlineMode);break;case "monitoring":toggleMonitoringMode();break;case "vault":case "links":case "lot":case "folders":case "shots":case "ideas":case "compress":commandNavigate(id);break;case "add-vault":commandNavigate("vault");vaultModal();break;case "add-link":commandNavigate("links","#lk_url");break;case "add-folder":commandNavigate("folders","#fd_path");break;case "add-idea":commandNavigate("ideas");ideaModal();break;case "duplicates":commandNavigate("links");duplicateReviewModal();break;case "rules":commandNavigate("links");smartRulesModal();break;case "check-links":commandNavigate("links");checkSavedLinks();break;case "backup":backupExportModal();break;case "restore":backupImportModal();break;case "update":updateCheckClick(false);break;}}
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
  if(hotkeyMatches(ev,"globalSearch")||((ev.ctrlKey||ev.metaKey)&&ev.shiftKey&&ev.key.toLowerCase()==="f")){ev.preventDefault();$("#globalSearch").classList.add("shell-open");const input=$("#globalSearchInput");if(input){input.focus();input.select();renderGlobalSearch();}return;}
  if((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&ev.key.toLowerCase()==="f"){
    ev.preventDefault();
    focusTabSearch();
    return;
  }
  if(ev.key==="Enter"&&$("#overlay").classList.contains("show")&&ev.target.tagName!=="TEXTAREA"&&ev.target.tagName!=="SELECT"&&ev.target.tagName!=="BUTTON"){ ev.preventDefault(); confirmActiveModal(); return; }
  if($("#shotshow")&&$("#shotshow").classList.contains("on")){ ev.preventDefault(); shotSlideshowStop(); return; }
    if($("#shotbox")&&$("#shotbox").classList.contains("show")){
    if(ev.key==="Escape"){ ev.preventDefault(); shotHide(); return; }
    if(ev.key==="ArrowLeft"){ ev.preventDefault(); shotStep(-1); return; }
    if(ev.key==="ArrowRight"){ ev.preventDefault(); shotStep(1); return; }
  }
  if(ev.key==="Escape"){ if(closeTimelinePreview()){ev.preventDefault();return;} if($("#settingsPanel")&&$("#settingsPanel").classList.contains("show")){closeSettings();return;} if($("#commandPalette")&&$("#commandPalette").classList.contains("show")){closeCommandPalette();return;} if($("#shotbox")&&$("#shotbox").classList.contains("show")){shotHide();return;} if($("#overlay").classList.contains("show")){cancelModal();return;} if($("#ctxmenu").classList.contains("show")){hideMenu();return;} if(leaveMonitoringPost()){ev.preventDefault();return;} if(leaveMonitoringArtist()){ev.preventDefault();return;} const ct=$("#content"); if(ct.classList.contains("searching")){ ct.classList.remove("searching"); searchTerms[currentView]=""; renderView(); } return; }
  if(ev.key==="Enter"&&!$("#overlay").classList.contains("show")&&ev.target&&ev.target.id){ if(ev.target.id.indexOf("lk_")===0){ ev.preventDefault(); doLinkAdd(); } else if(ev.target.id.indexOf("fd_")===0){ ev.preventDefault(); doFolderAdd(); } else if(ev.target.id==="termInput"){ ev.preventDefault(); const v=ev.target.value; ev.target.value=""; handleCommand(v); } }
});

document.addEventListener("contextmenu", function(ev){
  if(currentView==="compress"&&ev.target.closest(".compress-drop,.compress-options")){ev.preventDefault();ev.stopImmediatePropagation();showMenu(ev.clientX,ev.clientY,mi("compression-batch-start","","Compress contained folders / ZIPs individually"));return;}
  const inMode=offlineMode||monitoringMode,inContent=ev.target.closest&&ev.target.closest("#content"),interactive=ev.target.closest&&ev.target.closest("button,input,textarea,select,a,img,video,audio,[data-action],[data-ctx],#ctxmenu,#overlay");
  if(inMode&&inContent&&!interactive){
    let menu="";
    if(offlineMode){
      const item=offlineSelectedId&&offlineItem(offlineSelectedId);
      if(item)menu=offlineItemMenu(item,true);
      else menu=offlineFilter==="history"?mi("offline-history-clear","","Clear all history","#ff5470",true,CTX_ICON.delete):"";
    }else if(monitoringDetail){ev.preventDefault();ev.stopImmediatePropagation();showCardMenu("monitor-post","current",ev.clientX,ev.clientY);return;}
    else if(monitoringArtist){ev.preventDefault();ev.stopImmediatePropagation();showCardMenu("monitor-artist",monitoringArtist.monitorId,ev.clientX,ev.clientY);return;}
    else if(monitoringTab==="watchlist")menu=mi("monitoring-add","","Add watcher",null,false,"+");
    if(menu){ev.preventDefault();ev.stopImmediatePropagation();showMenu(ev.clientX,ev.clientY,menu);}return;
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
document.addEventListener("contextmenu",(e)=>{ const c=e.target.closest("[data-ctx]"); if(c){ e.preventDefault();const column=c.closest(".deck-column[data-deck-key]");showCardMenu(c.dataset.ctx,c.dataset.id,e.clientX,e.clientY,column&&column.dataset.deckKey); } });
document.addEventListener("contextmenu",function(e){
  if(!monitoringMode||e.defaultPrevented||!e.target.closest("#content")||e.target.closest("[data-ctx],#ctxmenu,#overlay"))return;
  if(monitoringDetail){e.preventDefault();showCardMenu("monitor-post","current",e.clientX,e.clientY);return;}
  if(monitoringArtist){e.preventDefault();showCardMenu("monitor-artist",monitoringArtist.monitorId,e.clientX,e.clientY);return;}
  if(monitoringTab==="watchlist"){e.preventDefault();showCardMenu("monitor-watchlist","",e.clientX,e.clientY);return;}
  e.preventDefault();showMenu(e.clientX,e.clientY,mi("monitoring-top","","Back to top",null,false,"↑"));
});
document.addEventListener("contextmenu",function(e){const header=e.target.closest&&e.target.closest("[data-deck-header]");if(!header||currentView!=="home"||offlineMode||monitoringMode)return;e.preventDefault();e.stopImmediatePropagation();const key=header.dataset.deckHeader;deckSettingsId="";deckSourceId="";deckMenuId=key;renderView();});
document.addEventListener("contextmenu",function(e){if(currentView!=="home"||offlineMode||monitoringMode||!e.target.closest(".deck-workspace")||e.target.closest("button"))return;const column=e.target.closest(".deck-column");if(column&&!column.querySelector(".deck-empty"))return;e.preventDefault();showMenu(e.clientX,e.clientY,mi("deck-add-open","","Add column",null,false,"+"));});
function clearDeckDragMarkers(){document.querySelectorAll(".deck-drop-before,.deck-drop-after,.deck-dragging").forEach(function(node){node.classList.remove("deck-drop-before","deck-drop-after","deck-dragging");});}
document.addEventListener("dragstart",function(e){const grip=e.target.closest&&e.target.closest("[data-deck-drag],[data-deck-header]");if(!grip)return;if(e.target.closest("button,input")&&!e.target.closest(".deck-title")){e.preventDefault();return;}deckDragKey=grip.dataset.deckDrag||grip.dataset.deckHeader;timelineSavedPosition=captureTimelinePosition();grip.closest(".deck-column").classList.add("deck-dragging");if(e.dataTransfer){e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",deckDragKey);}});
document.addEventListener("dragover",function(e){if(!deckDragKey)return;const column=e.target.closest&&e.target.closest(".deck-column[data-deck-key]");if(!column||column.dataset.deckKey===deckDragKey)return;e.preventDefault();const rect=column.getBoundingClientRect(),marker=e.clientX<rect.left+rect.width/2?"deck-drop-before":"deck-drop-after";if(column.classList.contains(marker))return;document.querySelectorAll(".deck-drop-before,.deck-drop-after").forEach(node=>node.classList.remove("deck-drop-before","deck-drop-after"));column.classList.add(marker);});
document.addEventListener("drop",function(e){if(!deckDragKey)return;const target=e.target.closest&&e.target.closest(".deck-column[data-deck-key]");if(!target||target.dataset.deckKey===deckDragKey){clearDeckDragMarkers();deckDragKey="";return;}e.preventDefault();const deck=timelineDeck(),from=deck.findIndex(function(item){return item.key===deckDragKey;}),targetIndex=deck.findIndex(function(item){return item.key===target.dataset.deckKey;}),after=target.classList.contains("deck-drop-after");if(from>=0&&targetIndex>=0){const moved=deck.splice(from,1)[0];let insert=targetIndex+(after?1:0);if(from<insert)insert--;deck.splice(Math.max(0,insert),0,moved);if(deck[0])deck[0].stack=false;saveState();clearDeckDragMarkers();deckDragKey="";renderView();restoreTimelinePosition(timelineSavedPosition);}else{clearDeckDragMarkers();deckDragKey="";}});
document.addEventListener("dragend",function(){clearDeckDragMarkers();deckDragKey="";});
let timelinePan=null,timelineGlideFrame=0,suppressTimelineClick=false;
function stopTimelineGlide(){if(timelineGlideFrame)cancelAnimationFrame(timelineGlideFrame);timelineGlideFrame=0;document.querySelector(".deck-workspace.pan-gliding")?.classList.remove("pan-gliding");}
function glideTimeline(workspace,velocity){let last=performance.now();workspace.classList.add("pan-gliding");const step=function(now){const elapsed=Math.min(32,now-last);last=now;velocity*=Math.pow(.91,elapsed/16.67);const before=workspace.scrollLeft;workspace.scrollLeft+=velocity*elapsed;if(Math.abs(velocity)<.025||Math.abs(workspace.scrollLeft-before)<.1){workspace.classList.remove("pan-gliding");timelineGlideFrame=0;return;}timelineGlideFrame=requestAnimationFrame(step);};timelineGlideFrame=requestAnimationFrame(step);}
document.addEventListener("pointerdown",function(e){
  const workspace=e.target.closest&&e.target.closest(".deck-workspace");
  if(!workspace||currentView!=="home"||offlineMode||monitoringMode||e.button!==0)return;
  stopTimelineGlide();
  if(e.target.closest(".deck-column>header,.deck-context-menu,.deck-source-menu,.deck-local-settings,button,a,input,textarea,select,[contenteditable]"))return;
  timelinePan={workspace:workspace,pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:workspace.scrollLeft,lastX:e.clientX,lastTime:performance.now(),velocity:0,active:false};
});
document.addEventListener("pointermove",function(e){
  if(!timelinePan||e.pointerId!==timelinePan.pointerId)return;
  const dx=e.clientX-timelinePan.x,dy=e.clientY-timelinePan.y;
  if(!timelinePan.active){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>5){timelinePan=null;return;}if(Math.abs(dx)<5)return;timelinePan.active=true;timelinePan.workspace.classList.add("panning");try{timelinePan.workspace.setPointerCapture(e.pointerId);}catch(_){}}
  e.preventDefault();const now=performance.now(),elapsed=Math.max(1,now-timelinePan.lastTime),speed=(timelinePan.lastX-e.clientX)/elapsed;timelinePan.velocity=timelinePan.velocity*.58+speed*.42;timelinePan.lastX=e.clientX;timelinePan.lastTime=now;timelinePan.workspace.scrollLeft=timelinePan.left-dx;
});
function finishTimelinePan(e){if(!timelinePan||e.pointerId!==timelinePan.pointerId)return;const pan=timelinePan,workspace=pan.workspace;timelinePan=null;workspace.classList.remove("panning");try{if(workspace.hasPointerCapture(e.pointerId))workspace.releasePointerCapture(e.pointerId);}catch(_){}if(pan.active){suppressTimelineClick=true;setTimeout(function(){suppressTimelineClick=false;},0);const velocity=Math.max(-2.4,Math.min(2.4,pan.velocity));if(Math.abs(velocity)>.08)glideTimeline(workspace,velocity);}}
document.addEventListener("pointerup",finishTimelinePan);
document.addEventListener("pointercancel",finishTimelinePan);
document.addEventListener("dragstart",function(e){if(e.target.closest&&e.target.closest(".deck-workspace")&&!e.target.closest("[data-deck-header]"))e.preventDefault();});
document.addEventListener("click",function(e){if(!suppressTimelineClick||!e.target.closest||!e.target.closest(".deck-workspace"))return;e.preventDefault();e.stopImmediatePropagation();},{capture:true});
document.addEventListener("contextmenu",function(e){if(currentView!=="ideas"||offlineMode||monitoringMode)return;if(e.target.closest("[data-ctx],button,input,textarea,select,#ctxmenu,#overlay"))return;e.preventDefault();showMenu(e.clientX,e.clientY,mi("idea-new","","New detailed idea",null,false,"+")+mi("idea-copy-visible","","Copy visible ideas for Codex",null,false,CTX_ICON.copy));});
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
var _batchParkQueue=[], _batchParkTimer=null, _batchParkBusy=false;
var _legacyParkNotice={added:0,dup:0}, _legacyParkNoticeTimer=null;
function _protocolParkItem(item){ if(!item||typeof item.url!=="string")return null; var url=item.url.trim(); if(url.indexOf("www.")===0)url="https://"+url; return normUrl(url)?{url:url,title:item.title||_parkHost(url),requestId:item.requestId||""}:null; }
function _showParkCompletion(added,dup){
  if(added>0){celebrate();log("ok","extension \u2192 Parking Lot: "+added+" link(s) parked"+(dup?" ("+dup+" exact duplicates skipped)":""));toast("Parked "+added+" tab"+(added===1?"":"s")+" to Parking Lot","ok");if(E&&E.showNotif)E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:added+" tab"+(added===1?"":"s")+" parked \u2713"});}
  else if(dup>0)toast(dup+" tab"+(dup===1?" was":"s were")+" already parked","warn");
}
function _queueLegacyParkCompletion(added,dup){
  _legacyParkNotice.added+=added;_legacyParkNotice.dup+=dup;
  if(_legacyParkNoticeTimer)clearTimeout(_legacyParkNoticeTimer);
  _legacyParkNoticeTimer=setTimeout(function(){var done=_legacyParkNotice;_legacyParkNotice={added:0,dup:0};_legacyParkNoticeTimer=null;_showParkCompletion(done.added,done.dup);},1200);
}
async function _persistProtocolParkBatch(q,deferCompletion){
  var added=0,dup=0,addedIds=[];
  for(var i=0;i<q.length;i++){ var r=_parkOne(q[i].title,q[i].url); if(r.dup)dup++; else if(!r.bad){added++;if(r.id)addedIds.push(r.id);} }
  var persisted=added>0?await flushSave():true;
  if(added>0&&persisted){ renderView();if(deferCompletion)_queueLegacyParkCompletion(added,dup);else _showParkCompletion(added,dup); }
  else if(added>0&&!persisted){ var failedIds={};addedIds.forEach(function(id){failedIds[id]=1;});state.links=state.links.filter(function(link){return !failedIds[link.id];});toast("Could not persist parked tabs","err"); }
  else if(dup>0){if(deferCompletion)_queueLegacyParkCompletion(0,dup);else _showParkCompletion(0,dup);}
  return persisted;
}
function _scheduleLegacyParkDrain(delay){
  if(_batchParkTimer)clearTimeout(_batchParkTimer);
  _batchParkTimer=setTimeout(async function(){
    _batchParkTimer=null;if(_batchParkBusy||!_batchParkQueue.length){if(_batchParkQueue.length)_scheduleLegacyParkDrain(80);return;}
    var q=_batchParkQueue;_batchParkQueue=[];_batchParkBusy=true;
    var persisted=await _persistProtocolParkBatch(q,true);
    for(var j=0;j<q.length;j++)protocolParkAck(q[j],persisted);
    _batchParkBusy=false;if(_batchParkQueue.length)_scheduleLegacyParkDrain(80);
  },delay==null?180:delay);
}
if(E&&E.onProtocolPark) E.onProtocolPark(async function(d){
  if(!d){protocolParkAck(d,false);return;}
  if(d.lot&&Array.isArray(d.tabs)){
    var batch=d.tabs.map(_protocolParkItem).filter(Boolean);
    if(!batch.length){protocolParkAck(d,false);return;}
    protocolParkAck(d,await _persistProtocolParkBatch(batch,false));
    return;
  }
  var item=_protocolParkItem(d);if(!item){protocolParkAck(d,false);return;}var url=item.url,nu=normUrl(url);
  if(d.lot){
    _batchParkQueue.push({url:url,title:item.title,requestId:d.requestId||""});
    _scheduleLegacyParkDrain();
    return;
  }
  var ex=null; for(var a=0;a<state.links.length;a++){ if(normUrl(state.links[a].url)===nu){ex=state.links[a];break;} } if(ex){ protocolParkAck(d,true); toast("Already in Links","warn"); if(E&&E.showNotif) E.showNotif({title:"Homie you already saved this exact link (\u00b4\u3002\uff3f\u3002\u0060)",body:ex.title||url}); return; } var raw=d.title||_parkHost(url); var title=raw.length>45?raw.slice(0,42)+"...":raw; var auto=smartCategories(url,"Check out"),category=auto.main; rememberUndo("Saved extension link"); var link={id:uid(),title:title,url:url,category:category,categories:auto.all,favorite:false,created:nowMs()}; state.links.unshift(link); saveState(); var persisted=await flushSave(); protocolParkAck(d,persisted); if(!persisted){state.links=state.links.filter(function(item){return item.id!==link.id;});toast("Could not persist link","err");return;} log("ok","extension \u2192 Links ["+auto.all.join(", ")+"]: "+title); celebrate(); renderView(); toast("Saved to "+category,"ok"); if(E&&E.showNotif) E.showNotif({title:"Sinrad is informing you that \uff08\uffe3\ufe36\uffe3\uff09\u2197",body:"Link saved \u2713  "+title}); });
if(E&&E.dataPath) E.dataPath(function(pp){ log('info','data file: '+pp); });
var lotSelLinks={}, lotSelColls={};
var linkSelLinks={};
function _lotCountSel(){ var t=Object.keys(lotSelLinks).length; Object.keys(lotSelColls).forEach(function(c){ state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===c) t++; }); }); return t; }
function _lotDeleteSel(){ var ids=Object.keys(lotSelLinks), colls=Object.keys(lotSelColls); var total=_lotCountSel(); if(!total) return; function go(){ const anchor=captureListPosition();rememberUndo("Deleted "+total+" parked links"); var kill={}; ids.forEach(function(x){var selected=find(state.links,x);if(_inLot(selected))kill[x]=1;}); colls.forEach(function(c){ state.links.forEach(function(l){ if(_inLot(l)&&(l.coll||"")===c) kill[l.id]=1; }); }); var n=Object.keys(kill).length; state.links=state.links.filter(function(l){ return !kill[l.id]; }); saveState(); lotSelLinks={}; lotSelColls={}; renderViewAnchored(anchor,false); log("warn","deleted "+n+" parked link(s)"); } if(total>4){ confirmModal("Delete "+total+" parked link(s)?").then(function(y){ if(y) go(); }); } else { go(); } }
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
if(E&&E.onCompressionProgress)E.onCompressionProgress(function(progress){applyCompressionStatus(progress);document.querySelectorAll('.deck-column[data-deck-id="compression"] .deck-column-scroll').forEach(node=>{const top=node.scrollTop;node.innerHTML=compressionProgressHtml()||timelineSmallRows(compressionHistory||[],"compress");node.scrollTop=top;});if(currentView==="compress"&&!offlineMode&&!monitoringMode){if(progress&&Array.isArray(progress.history))renderView();else paintCompression();}});

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
  applyCensorMode();
  try{if(E&&E.compressionStatus)applyCompressionStatus(await E.compressionStatus()||{active:false});}catch(_){}
  const configuredHotkeys=currentHotkeys();paintHotkeyLabels();try{if(E&&E.hotkeysUpdate)await E.hotkeysUpdate(configuredHotkeys);}catch(_){}
  initGlobalSearchWorker();
  const migratedYouTube=await migrateExistingYouTubeLinks();
  if(state.settings&&state.settings.petAutoUndock){ setFloating(true); }
  const runIdle=function(task){if(typeof requestIdleCallback==="function")requestIdleCallback(task,{timeout:1600});else setTimeout(task,80);};
  try{ if(E&&E.appVersion){ const v=await E.appVersion(); if(v) APP_VERSION=String(v).replace(/^v/i,""); } }catch(_){}
  const av=$('#appver'); if(av)av.textContent='v'+APP_VERSION;
  const ae=$("#appedits"); if(ae)ae.textContent="#"+EDIT_COUNT+" edits";
  initPageCounter(); renderNav(); renderView(); updateAppNavigationButtons(); renderTermBody(); tickClock();
  runIdle(async function(){
    try{
      const homeData=await Promise.all([
        E&&E.offlineLoad?E.offlineLoad():null,
        E&&E.offlineExtensionStatus?E.offlineExtensionStatus():null,
        E&&E.monitoringLoad?E.monitoringLoad():null
      ]);
      if(homeData[0]){offlineData=homeData[0];offlineDataReady=true;}if(homeData[1])offlineExtension=homeData[1];if(homeData[2]){monitoringData=homeData[2];monitoringDataReady=true;}
      offlineSyncing=!!(offlineData.sync&&(offlineData.sync.active||offlineData.sync.queued));
      if(currentView==="home"&&!offlineMode&&!monitoringMode)renderView();
    }catch(_){}
  });
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
  window.addEventListener("blur",beginCensorAway);
  window.addEventListener("focus",returnFromCensorAway);
  if(E&&E.onAppFocus) E.onAppFocus(function(){ shotSlideshowStop();returnFromCensorAway(); });
  try{ syncPetRecents(); }catch(_){}
  log("info","S.I.R ready (v"+APP_VERSION+", "+EDIT_COUNT+" edits).");
  if(migratedYouTube)toast("Moved "+migratedYouTube+" existing YouTube link"+(migratedYouTube===1?"":"s")+" to YouTube","ok");
})();
async function passwordImportModal(){
  if(!E||!E.passwordImportPick){toast("Password import needs the desktop app","warn");return;}
  try{
    const result=await E.passwordImportPick();if(result&&result.canceled)return;
    if(!result||!result.ok)throw Error(result&&result.error||"Could not read the CSV");
    if(!result.count){await E.passwordImportCancel();toast("No valid passwords found","warn");return;}
    openModal("Import browser passwords","<p>Import "+result.count+" entries into your local Vault? Exact duplicates will be skipped.</p><p>"+result.skipped+" invalid rows skipped. Your exported CSV contains readable passwords: remove it yourself once you have checked the import.</p>","Import",async()=>{
      const button=$("#modal-confirm");button.disabled=true;
      try{
        if(!await flushSave())throw Error("Could not save your current changes");
        const added=await E.passwordImportConfirm();if(!added||!added.ok)throw Error(added&&added.error||"Import failed");
        const loaded=await E.storeLoad();if(!loaded||!Array.isArray(loaded.vault))throw Error("Imported, but reload failed. Restart SINRAD before editing the Vault.");
        state.vault=loaded.vault;markGlobalSearchDirty();closeModal();renderView();toast("Imported "+added.added+" passwords; "+added.duplicates+" duplicates skipped","ok");
      }catch(error){button.disabled=false;toast(error.message,"err");}
    },()=>{E.passwordImportCancel();});
  }catch(error){toast(error.message,"err");}
}
document.addEventListener("contextmenu",function(e){if(currentView!=="vault"||offlineMode||monitoringMode||!e.target.closest("#content")||e.target.closest("[data-ctx],button,input,textarea,select,#ctxmenu,#overlay"))return;e.preventDefault();showMenu(e.clientX,e.clientY,mi("vault-import","","Import browser passwords"));});

if(E&&E.onDisplayLayoutChanged)E.onDisplayLayoutChanged(()=>requestAnimationFrame(resizeTimelineLanes));

if(E&&E.onStoreWriteError)E.onStoreWriteError(message=>toast("Save failed: "+message,"err"));
