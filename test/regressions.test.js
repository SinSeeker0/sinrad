"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "preload.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "assets", "renderer.js"), "utf8");
const splash = fs.readFileSync(path.join(root, "assets", "splash.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "index.css"), "utf8");
const shellCss = fs.readFileSync(path.join(root, "assets", "shell.css"), "utf8");
const timelineCss = fs.readFileSync(path.join(root, "assets", "timeline.css"), "utf8");
const timelineRefinementCss = fs.readFileSync(path.join(root, "assets", "timeline-refinement.css"), "utf8");
const deckCss = fs.readFileSync(path.join(root, "assets", "deck.css"), "utf8");
const notificationsCss = fs.readFileSync(path.join(root, "assets", "notifications-refinement.css"), "utf8");
const splashCss = fs.readFileSync(path.join(root, "assets", "splash.css"), "utf8");
const petCss = fs.readFileSync(path.join(root, "assets", "pet.css"), "utf8");
const extension = fs.readFileSync(path.join(root, "extension", "background.js"), "utf8");
const offlineFeed = fs.readFileSync(path.join(root, "lib", "offline-feed.js"), "utf8");
const monitoringStore = fs.readFileSync(path.join(root, "lib", "monitoring", "store.js"), "utf8");
const monitoringQueue = fs.readFileSync(path.join(root, "lib", "monitoring", "download-queue.js"), "utf8");
const packageFile = fs.readFileSync(path.join(root, "package.json"), "utf8");
const testLauncher = fs.readFileSync(path.join(root, "test-app.bat"), "utf8");

test("development mode uses isolated data and does not claim the production protocol", function () {
  const isolation = main.indexOf('app.setPath("userData",path.join(app.getPath("appData"),"Sinrad-Dev"))');
  const dataFile = main.indexOf('const DATA_DIR = app.getPath("userData")');
  assert.ok(isolation >= 0 && isolation < dataFile);
  assert.match(main, /if\(!app\.isPackaged\) app\.setPath[\s\S]*else app\.setAsDefaultProtocolClient\(PROTOCOL\)/);
  assert.match(testLauncher, /npm run dev/i);
});

test("localhost bridge requires the per-installation secret", function () {
  assert.match(main, /if\(!bridgeTrusted\)\{ _localJson\(res,403/);
  assert.doesNotMatch(main, /!bridgeTrusted\s*&&/);
});

test("failed backup restore rolls back the in-memory state", function () {
  assert.match(renderer, /const previousState=state;[\s\S]*if\(!saved\)\{state=previousState;/);
});

test("deleted category is also removed from the active filter", function () {
  assert.match(renderer, /linkCats=linkCats\.filter\(function\(category\)\{return category!==name;\}\)/);
});

test("large views use browser-backed rendering virtualization", function () {
  const css=fs.readFileSync(path.join(root,"assets","index.css"),"utf8");
  const timelineCss=fs.readFileSync(path.join(root,"assets","timeline-refinement.css"),"utf8");
  const monitoringCss=fs.readFileSync(path.join(root,"assets","notifications-refinement.css"),"utf8");
  assert.match(css,/content-visibility:auto/);
  assert.match(timelineCss,/\.deck-view \.deck-monitor-post[^\n]*content-visibility:auto/);
  assert.match(timelineCss,/\.deck-view \.deck-column \.misskey-note[^\n]*content-visibility:auto/);
  assert.match(monitoringCss,/\.monitoring-mode \.mon-event[^\n]*content-visibility:auto/);
});

test("monitoring feed cards do not use the global image zoom", function () {
  assert.doesNotMatch(renderer,/const selector="[^"]*mon-event-preview/);
  assert.doesNotMatch(renderer,/const selector="[^"]*mon-artist-preview/);
  assert.doesNotMatch(renderer,/const selector="[^"]*\.deck-view \.deck-monitor-media/);
  assert.doesNotMatch(renderer,/const selector="[^"]*\.mon-reader img\.mon-reader-media/);
  assert.match(renderer,/monitoringId:monitoringCard&&monitoringCard\.dataset\.id/);
  assert.match(timelineRefinementCss,/\.deck-view \.deck-monitor-gallery \.deck-monitor-media\{[^}]*cursor:pointer/);
  assert.match(timelineCss,/@keyframes clippingLightboxFade[\s\S]*@keyframes clippingLightboxImageIn/);
});

test("the removed player has no remaining app or package wiring", function () {
  [html,css,renderer,preload,main,packageFile].forEach(function(source){
    assert.doesNotMatch(source,/norma-music|\bnm-|bgmAudio|BGM_DIR|bgm\/\*\*|autoplayMusic|music-(?:request|read|cmd|toggle|next|prev|open-folder)/i);
  });
});

test("clock has only one repeating timer", function () {
  assert.equal((renderer.match(/setInterval\(tickClock,1000\)/g)||[]).length,1);
  assert.match(renderer,/TOTAL_OPEN_BASE[\s\S]*settings\.totalOpenMs[\s\S]*SESSION [\s\S]*TOTAL /);
  assert.match(renderer,/beforeunload[\s\S]*commitOpenTime\(false\)/);
});

test("new watchers default to a daily check", function () {
  assert.match(monitoringStore,/defaultIntervalMinutes:1440/);
  assert.match(monitoringStore,/intervalMinutes:boundedNumber\(input&&input\.intervalMinutes,1440/);
  assert.match(renderer,/defaultIntervalMinutes:1440/);
  assert.match(renderer,/defaultIntervalMinutes\)\|\|1440/);
});

test("new productivity features remain wired into the renderer", function () {
  ["undoLastChange","duplicateReviewModal","smartRulesModal","checkSavedLinks","openCommandPalette"].forEach(function(name){assert.match(renderer,new RegExp("function "+name+"\\("),name);});
});

test("Ctrl+Z is captured globally before focused controls can swallow it", function () {
  assert.match(renderer,/window\.addEventListener\("keydown"[\s\S]*undoLastChange\(\);[\s\S]*\},true\)/);
});

test("Ctrl+Shift+P is captured globally before focused controls can swallow it", function () {
  assert.match(renderer,/window\.addEventListener\("keydown"[\s\S]*hotkeyMatches\(ev,"commandPalette"\)[\s\S]*openCommandPalette\(\)[\s\S]*\},true\)/);
});

test("Electron forwards Ctrl+Shift+P before the page can lose it", function () {
  assert.match(main,/before-input-event[\s\S]*_inputHotkey\(input\)===_runtimeHotkeys\.commandPalette[\s\S]*send\("command-palette"\)/);
  assert.match(preload,/onCommandPalette[\s\S]*ipcRenderer\.on\(\"command-palette\"/);
  assert.match(renderer,/onCommandPalette\)E\.onCommandPalette\(openCommandPalette\)/);
});

test("Offline Reader is a dedicated mode backed by privileged IPC", function () {
  assert.match(renderer,/function setOfflineMode\(enabled,quiet,useLoadedData\)/);
  assert.match(renderer,/classList\.toggle\("offline-mode",offlineMode\)/);
  assert.match(renderer,/function renderOfflineView\(\)/);
  assert.match(preload,/offlineLoad:[\s\S]*offlineRefresh:[\s\S]*onOfflineChanged:/);
  assert.match(main,/let offlineFeed = new OfflineFeedStore\(_initialOfflineRoot\(\)\)/);
  assert.match(main,/ipcMain\.handle\("offline-refresh"/);
});

test("Offline posts and individual feed images expose distinct downloads", function () {
  assert.match(renderer,/mi\("offline-item-download",item\.id,"Download post"/);
  assert.match(renderer,/data-ctx="monitor-event"/);
  assert.match(renderer,/mi\("monitoring-event-download",item\.id,"Download whole post"/);
  assert.match(renderer,/data-ctx="offline-media"/);
  assert.match(renderer,/data-post-id=/);
  assert.match(renderer,/mi\("offline-media-download",id,"Download image"/);
  assert.doesNotMatch(renderer,/mi\("offline-item-open",item\.id,"Open post"/);
  assert.doesNotMatch(renderer,/mi\("monitoring-event-open",item\.id,"Open post"/);
  assert.match(renderer,/!offlineMode&&!monitoringMode&&currentView==="home"\)[\s\S]*openTimelineRedditReader\(item\.id\)/);
  assert.match(preload,/offlineItemDownload: \(id\) => ipcRenderer\.invoke\("offline-item-download", id\)/);
  assert.match(preload,/offlineMediaDownload: \(ref\) => ipcRenderer\.invoke\("offline-media-download", ref\)/);
  assert.match(main,/ipcMain\.handle\("offline-item-download"/);
  assert.match(main,/ipcMain\.handle\("offline-media-download"/);
  assert.doesNotMatch(main,/SINRAD Offline Downloads/);
  assert.doesNotMatch(main,/function _postDownloadFolder/);
  assert.match(renderer,/String\(item\.id\)===String\(id\)/);
  assert.match(renderer,/case "offline-item-open"[\s\S]*openTimelineRedditReader\(item\.id\)/);
  assert.match(renderer,/function removeTimelineOfflineItem\(id\)/);
  assert.match(renderer,/case "offline-item-remove"[\s\S]*removeTimelineOfflineItem\(id\)/);
});

test("Monitoring reader enlarges images in place and eagerly plays GIFs", function () {
  assert.match(deckCss,/\.deck-monitoring-posts\{display:flex;flex-direction:column;gap:12px\}/);
  assert.match(renderer,/data-action="monitoring-image-expand"/);
  assert.match(renderer,/loading="lazy" decoding="async"/);
  assert.match(renderer,/\.gif\(\?:\$\|\\\?\)/);
  assert.match(renderer,/figure\.classList\.toggle\("expanded"\)/);
  assert.match(notificationsCss,/max-height:calc\(100dvh - 96px\)/);
  assert.match(renderer,/media\.tagName==='IMG'&&media\.naturalWidth\)\{ready\(\);return;\}/);
  assert.match(main,/const animated=file\.kind==="image"&&\/\\\.gif\$\/i/);
  assert.match(main,/file\.kind==="video"\?MonitoringSources\.pawchiveFileUrl\(file\)/);
  assert.match(main,/file\.kind==="audio"\|\|animated\)\?MONITOR_MEDIA_PROTOCOL\+":\/\/file"\+file\.path/);
  assert.match(main,/MONITOR_MEDIA_PROTOCOL,privileges:\{[^}]*stream:true/);
  assert.match(main,/responseHeaders\.set\("Content-Type",mediaType\)/);
  assert.match(deckCss,/width:min\(1800px,90vw\)/);
  assert.match(css,/#ctxmenu\{z-index:120000\}/);
  assert.match(deckCss,/\.deck-preview-panel \.mon-file\{width:min\(820px,100%\)/);
  assert.match(deckCss,/\.mon-file\.expanded\{width:100%}/);
  assert.match(notificationsCss,/\.monitoring-mode \.mon-file\.expanded\{width:100%}/);
  assert.match(css,/\.mon-media-frame\{[^}]*background:transparent/);
  assert.match(css,/\.mon-reader-media\{[^}]*background:transparent/);
  assert.match(css,/\.mon-file figcaption\{[^}]*width:min\(820px,100%\)/);
  assert.match(renderer,/viewMonitoringDetail\(monitoringDetail,false\)/);
});

test("App navigation, monitoring shuffle, fullscreen video, and tooltip guards stay wired", function () {
  assert.match(html,/id="appBackButton"[\s\S]*id="appForwardButton"/);
  assert.match(renderer,/function navigateAppHistory\(direction\)/);
  assert.match(renderer,/setInterval\(refreshTimelineMonitoringShuffle,2\*60\*60\*1000\)/);
  assert.match(renderer,/config\.source!=="inbox"/);
  assert.match(renderer,/video\.controls=true[\s\S]*requestFullscreen/);
  assert.match(renderer,/fullscreenchange[\s\S]*video\.controls=document\.fullscreenElement===video/);
  assert.match(renderer,/new MutationObserver[\s\S]*attributeFilter:\["title"\]/);
});

test("Monitoring is a dedicated mode backed by privileged IPC", function () {
  assert.match(renderer,/function setMonitoringMode\(enabled/);
  assert.match(renderer,/classList\.toggle\("monitoring-mode",monitoringMode\)/);
  assert.match(renderer,/function renderMonitoringView\(\)/);
  assert.match(preload,/monitoringLoad:[\s\S]*monitoringRefresh:[\s\S]*monitoringMedia:[\s\S]*onMonitoringChanged:/);
  assert.match(main,/new MonitoringStore\(MONITORING_DIR,app\.getPath\("downloads"\)\)/);
  assert.match(main,/ipcMain\.handle\("monitoring-refresh"/);
  assert.match(main,/ipcMain\.handle\("monitoring-media"/);
  assert.match(main,/items\.slice\(0,24\)[\s\S]*baseline:true/);
  assert.match(renderer,/data-tab="collections">Folders/);
  assert.match(renderer,/monitoringTab==='collections'[\s\S]*mon-collections-blank/);
  assert.match(notificationsCss,/mon-collections-tab\{margin-right:18px\}/);
});

test("Pawchive posts open and download inside the privileged Monitor reader", function () {
  assert.match(preload,/monitoringPostDetail:[\s\S]*monitoringDownload:[\s\S]*monitoringDownloadAll:[\s\S]*monitoringArtistDetail:[\s\S]*monitoringArtistPostDetail:[\s\S]*monitoringArtistDownloadAll:/);
  assert.match(main,/protocol\.handle\(MONITOR_MEDIA_PROTOCOL/);
  assert.match(main,/"Accept-Encoding":"identity"[\s\S]*redirect:"follow"/);
  assert.match(main,/ipcMain\.handle\("monitoring-post-detail"/);
  assert.match(main,/ipcMain\.handle\("monitoring-download-all"/);
  assert.match(main,/ipcMain\.handle\("monitoring-artist-detail"/);
  assert.match(main,/ipcMain\.handle\("monitoring-artist-post-detail"/);
  assert.match(main,/ipcMain\.handle\("monitoring-artist-download-all"/);
  assert.match(main,/new MonitoringStore\(MONITORING_DIR,app\.getPath\("downloads"\)\)/);
  assert.match(main,/ipcMain\.handle\("monitoring-output-open"/);
  assert.match(main,/ipcMain\.handle\("monitoring-output-choose"/);
  assert.match(preload,/monitoringOutputOpen:[\s\S]*monitoringOutputChoose:/);
  assert.match(renderer,/function viewMonitoringDetail\(detail,showBack\)/);
  assert.match(renderer,/item\.kind!=="pawchive"[\s\S]*openTarget\(item\.url/);
  assert.match(html,/media-src[^;]*sinrad-monitor:/);
});

test("Pawchive reader uses quick previews, flat media and contextual downloads", function () {
  const detailView=renderer.slice(renderer.indexOf("function monitoringFilePreview"),renderer.indexOf("function renderMonitoringView"));
  assert.match(main,/file\.kind==="image"&&!animated\?MONITOR_MEDIA_PROTOCOL/);
  assert.match(main,/function _pawchiveImagePreview\(file\)[\s\S]*pawchiveThumbnailUrl\(file\)[\s\S]*2\*1024\*1024/);
  assert.match(detailView,/data-ctx="monitor-file"/);
  assert.doesNotMatch(detailView,/data-action="monitoring-post-back"|← Back/);
  assert.match(detailView,/class="mon-reader-creator"[\s\S]*data-action="monitoring-post-artist-open"/);
  assert.match(detailView,/monitoringPostPager\('top'\)/);
  assert.match(renderer,/function monitoringPostPager\(position\)[\s\S]*data-action="monitoring-post-page"[\s\S]*aria-current="page"/);
  assert.match(detailView,/monitoringPostPager\('top'\)[\s\S]*monitoringPostPager\('bottom'\)/);
  assert.match(renderer,/monitoringPostSequence=monitoringFilteredEvents\(\)[\s\S]*item\.read=true/);
  assert.match(renderer,/case "monitoring-post-artist-open"[\s\S]*E\.monitoringArtistDetail/);
  assert.match(css,/\.mon-reader-creator\{[^}]*background:transparent[^}]*cursor:pointer/);
  assert.match(renderer,/type==="monitor-file"[\s\S]*Download image/);
  assert.doesNotMatch(renderer,/type==="monitor-file"[^\n]*monitoring-post-back/);
  assert.doesNotMatch(renderer,/type==="monitor-file"[^\n]*(?:Next post|Previous post)/);
  assert.match(renderer,/if\(leaveMonitoringPost\(\)\)\{ev\.preventDefault\(\);return;\}/);
  assert.match(css,/\.mon-reader-post\{[^}]*border:0[^}]*background:transparent/);
  assert.match(css,/\.mon-file\{[^}]*border:0[^}]*background:transparent/);
  assert.match(detailView,/class="mon-file-row"/);
  assert.match(detailView,/data-action="monitoring-video-toggle"[^>]*preload="metadata" playsinline><source[^>]*type=/);
  assert.doesNotMatch(detailView,/<video[^>]* controls/);
  assert.match(detailView,/media\.readyState>=1\)ready\(\)/);
  assert.match(detailView,/mon-reader-audio[^>]*controls preload="none"/);
  assert.match(detailView,/class="mon-media-file"[^>]*data-action="monitoring-download"[^>]*data-index/);
  assert.match(detailView,/mon-download-arrow/);
  assert.doesNotMatch(detailView,/mon-media-file">Right-click to download/);
  assert.match(css,/\.mon-file-row\{[^}]*width:min\(920px,100%\)[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*grid-auto-flow:row/);
  assert.match(css,/\.mon-media-frame\.image\{[^}]*aspect-ratio:auto/);
  assert.match(html,/media-src[^;]*https:\/\/file\.pawchive\.pw/);
  assert.match(renderer,/if\(!monitoringMode\|\|e\.defaultPrevented[\s\S]*showCardMenu\("monitor-post"[\s\S]*showCardMenu\("monitor-artist"/);
});

test("browser snapshots enter Offline Reader through the authenticated bridge", function () {
  assert.match(main,/CAPTURE_MAX_BYTES=256\*1024\*1024/);
  assert.match(main,/"\/capture\/start","\/capture\/chunk","\/capture\/finish"/);
  assert.match(main,/offlineFeed\.addCapture/);
  assert.match(main,/async function _captureFinish/);
  assert.match(main,/await _cacheRedditMedia\(item,20\)/);
  assert.match(main,/metadata:_captureMetadata/);
  assert.match(main,/u\.pathname==="\/capture\/start"\?4194304/);
  assert.match(preload,/offlineCaptureOpen:/);
  assert.doesNotMatch(renderer,/Open saved page/);
  assert.match(renderer,/function offlineGallery\(item\)/);
  assert.match(renderer,/function offlinePostBody\(item\)/);
  assert.match(renderer,/sinrad-offline:\/\/media\//);
  assert.match(renderer,/class="of-gallery-video/);
  assert.match(main,/protocol\.handle\(OFFLINE_MEDIA_PROTOCOL/);
  assert.match(main,/authorFlair:authorFlair,postFlair:postFlair,authorAvatarUrl/);
  assert.match(renderer,/class="of-comment"/);
  assert.match(renderer,/class="of-post-flair"/);
  assert.match(renderer,/function offlineCommentMedia\(comment\)/);
  assert.match(renderer,/data-preview-loop="5"/);
  assert.match(renderer,/function offlinePostNeighbors\(id\)/);
  assert.match(renderer,/mi\("offline-item-remove",item\.id,"Delete post"/);
  assert.match(renderer,/offlineData\.sync&&\(offlineData\.sync\.active\|\|offlineData\.sync\.queued\)/);
  assert.match(renderer,/class="of-storage"/);
  assert.match(renderer,/function offlineSourceLimitModal\(source\)/);
  assert.match(main,/offlineFeed\.cleanupHistory/);
  assert.match(main,/knownKeys:offlineFeed\.recentPostKeys/);
  assert.match(preload,/offlineItemRemove:/);
  assert.match(preload,/offlineSourceUpdate:/);
  assert.match(renderer,/function offlineRichBlocks\(blocks,className\)/);
  assert.match(extension,/contentBlocks = richContentBlocks\(bodyNode\)/);
  assert.match(main,/contentBlocks:commentBlocks\(entry\.contentBlocks\)/);
  assert.match(main,/comment\.avatar=ref/);
  assert.match(renderer,/const inMode=offlineMode\|\|monitoringMode[\s\S]*if\(inMode&&inContent&&!interactive\)/);
  assert.match(renderer,/const item=offlineSelectedId&&offlineItem\(offlineSelectedId\)/);
  assert.doesNotMatch(renderer,/mi\("offline-item-back","","Back"/);
  assert.match(css,/\.of-gallery-stage\{[^}]*height:clamp\(430px,70vh,760px\)[^}]*border:1px solid/);
  assert.match(css,/\.of-body\.rich\{[^}]*white-space:normal/);
});

test("module previews stay behind cached, lazy and privileged bridges",function(){
  const css=fs.readFileSync(path.join(root,"assets","index.css"),"utf8");
  assert.match(preload,/sitePreview:[\s\S]*folderPreview:/);
  assert.match(main,/ipcMain\.handle\("site-preview"/);
  assert.match(main,/ipcMain\.handle\("folder-preview"/);
  assert.match(renderer,/function hydrateModulePreviews\(/);
  assert.match(renderer,/new IntersectionObserver\(/);
  assert.match(css,/\.link-preview[\s\S]*\.folder-preview[\s\S]*\.lot-site-preview/);
});

test("Park All uses one acknowledged batch and categorized parked links stay isolated", function () {
  assert.match(main,/Array\.isArray\(data\.tabs\)[\s\S]*_sendParkWithAck\(\{tabs:tabs,lot:true,batch:true\}\)/);
  assert.match(main,/X-Sinrad-Extension-Version/);
  assert.match(renderer,/d\.lot&&Array\.isArray\(d\.tabs\)[\s\S]*_persistProtocolParkBatch\(batch,false\)/);
  assert.match(renderer,/function _queueLegacyParkCompletion\([\s\S]*setTimeout\([\s\S]*_showParkCompletion/);
  assert.match(renderer,/_persistProtocolParkBatch\(q,true\)[\s\S]*protocolParkAck/);
  assert.match(renderer,/function _inLot\(l\)\{ return SinradShared\.isParkedLink\(l\); \}/);
});

test("completion animation can be dismissed by clicking it", function () {
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const css=fs.readFileSync(path.join(root,"assets","index.css"),"utf8");
  assert.match(html,/id="celebrate"[^>]*Click to close/);
  assert.match(renderer,/celebrateOverlay\.addEventListener\("click",stopCelebrate\)/);
  assert.match(css,/#celebrate\.show\{[^}]*pointer-events:auto[^}]*cursor:pointer/);
});

test("Ideas is a local module with chat import, approval and Codex handoff", function () {
  const shared=fs.readFileSync(path.join(root,"assets","shared.js"),"utf8");
  assert.match(renderer,/{id:"ideas"[\s\S]*name:"Ideas"/);
  assert.match(renderer,/function viewIdeas\(\)/);
  assert.match(renderer,/function parseIdeaImport\(value\)/);
  assert.match(renderer,/SINRAD_IDEAS_V1/);
  assert.match(renderer,/data-action="idea-import-check"/);
  assert.match(renderer,/data-action="idea-import-add"/);
  assert.match(renderer,/data-action="idea-import-images-pick"/);
  assert.match(renderer,/function importIdeaImageFiles\(files\)/);
  assert.match(renderer,/function ideaImportMediaFor\(item,total\)/);
  assert.match(renderer,/attachments:ideaImportMediaFor\(item,total\)/);
  assert.match(main,/ipcMain\.handle\("idea-images-pick"/);
  assert.match(main,/ipcMain\.handle\("idea-images-import"/);
  assert.match(main,/ipcMain\.handle\("idea-image-copy"/);
  assert.match(preload,/ideaImagesPick:[\s\S]*ideaImagesImport:[\s\S]*ideaImageCopy:/);
  assert.match(renderer,/ITQ queues this batch and clears the input/);
  assert.match(renderer,/function ideaCodexText\(item\)/);
  assert.match(renderer,/const IDEA_GROUPS=\{app:"App",other:"Other",unsorted:"Unsorted"\}/);
  assert.match(renderer,/data-action="idea-group-filter"/);
  assert.match(renderer,/function ideaDetailView\(item\)/);
  assert.match(renderer,/case "idea-edit": ideaModal/);
  assert.match(renderer,/data-action="idea-edit-images-pick"/);
  assert.match(renderer,/data-ctx="idea-media"/);
  assert.match(renderer,/case "idea-image-copy"/);
  assert.match(renderer,/sinrad-idea:\/\/media\//);
  assert.match(main,/const IDEA_MEDIA_PROTOCOL="sinrad-idea"/);
  assert.match(html,/sinrad-idea:/);
  assert.match(renderer,/idea-reader-audit/);
  assert.match(renderer,/Only App ideas can enter In Progress, Testing, or Done/);
  assert.match(renderer,/ready:"In Progress"/);
  assert.match(renderer,/status:group==="app"\?"ready":"inbox"/);
  assert.match(renderer,/status=editing\?ideaStatus\(item\.status\):"ready"/);
  assert.match(renderer,/const filters=ideaPane==="inbox"/);
  assert.doesNotMatch(renderer,/class="idea-head-actions"><button/);
  assert.match(renderer,/mi\("idea-new","","New detailed idea"/);
  assert.match(renderer,/data-action="idea-status"/);
  assert.match(renderer,/Copy for Codex/);
  assert.match(shared,/add\("Ideas","ideas"/);
});

test("the main app uses the requested readability scale increase", function () {
  assert.match(main,/mainWin\.webContents\.setZoomFactor\(1\.16\)/);
});

test("offline Reddit sync continues past known posts and surfaces interest", function () {
  const extension=fs.readFileSync(path.join(root,"extension","background.js"),"utf8");
  assert.match(extension,/gatherRedditCandidates/);
  assert.match(extension,/known\.has\(key\)/);
  assert.match(extension,/kind === 'top'/);
  assert.match(renderer,/class="of-interest popular">Popular/);
  assert.match(renderer,/class="of-interest">Interesting/);
});

test("offline videos use balanced quality and feed sources stay mixed", function () {
  assert.match(main,/preferredVideoUrls\(task\.url\)/);
  assert.match(main,/36\*1024\*1024/);
  assert.match(main,/_upgradeLowQualityOfflineVideos/);
  assert.match(renderer,/function offlineMixSources\(items\)/);
  assert.match(renderer,/return offlineMixSources\(/);
  const vm=require("node:vm"),code=renderer.slice(renderer.indexOf("function offlineMixSources(items)"),renderer.indexOf("function offlineSourceName(item)")),context={};vm.runInNewContext(code,context);
  const input=[{id:"a1",sourceId:"a"},{id:"a2",sourceId:"a"},{id:"a3",sourceId:"a"},{id:"b1",sourceId:"b"},{id:"b2",sourceId:"b"}];
  assert.deepEqual(Array.from(context.offlineMixSources(input),item=>item.id),["a1","b1","a2","b2","a3"]);
  assert.equal(input.length,5);
});

test("list navigation preserves its visual anchor and partial Reddit batches continue", function () {
  assert.match(renderer,/function captureListPosition\(preferredId\)/);
  assert.match(renderer,/function restoreListPosition\(anchor,focus\)/);
  assert.match(renderer,/offlineReturnAnchor=captureListPosition\(id\)/);
  assert.match(renderer,/renderViewAnchored\(anchor,true\)/);
  assert.match(main,/continueRefill=saved>0&&kept<source\.limit/);
  assert.match(main,/syncRequestedAt:continueRefill\?now\+1:0/);
  assert.match(offlineFeed,/freshnessDays:1/);
  assert.match(offlineFeed,/cleanupStale\(now\)/);
});

test("startup intro can be skipped with one guarded click", function () {
  assert.match(splash,/document\.addEventListener\("click",finish\)/);
  assert.match(splash,/function finish\(\)\{ if\(done\) return; done=true;/);
  assert.match(splashCss,/html,body\{[^}]*cursor:pointer/);
});

test("Monitor returns from its post reader before exiting Monitoring Mode", function () {
  assert.match(renderer,/function leaveMonitoringPost\(\)/);
  assert.match(renderer,/function toggleMonitoringMode\(\)\{closeSettings\(\);if\(!leaveMonitoringPost\(\)&&!leaveMonitoringArtist\(\)\)setMonitoringMode\(!monitoringMode\);\}/);
  assert.match(renderer,/case "monitoring-mode": toggleMonitoringMode\(\); break;/);
  assert.match(renderer,/const requestId=\+\+monitoringDetailRequest[\s\S]*if\(requestId!==monitoringDetailRequest\)break;/);
});

test("the retired console no longer consumes workspace width", function () {
  assert.doesNotMatch(html,/id="consoleDock"/);
  assert.doesNotMatch(html,/WORK IN PROGRESS/i);
});

test("navigation remains compact and accessible as the app grows", function () {
  assert.match(renderer,/<button type="button" class="nav-item/);
  assert.match(renderer,/aria-current="page"/);
  assert.match(html,/class="command-palette"[^>]*id="commandPalette"/);
  assert.match(renderer,/"Timeline"/);
  assert.match(renderer,/"Monitoring"/);
  assert.match(renderer,/"Clipping"/);
  assert.match(html,/placeholder="Find a page or command…"/);
  assert.doesNotMatch(html,/>⌘<\/button>/);
  assert.match(renderer,/group:"Navigate"/);
  assert.match(renderer,/group:"Create"/);
  assert.match(renderer,/group:"Actions"/);
  assert.match(renderer,/class="cp-group"/);
  assert.match(renderer,/aria-label="Previous Screenies page"/);
  assert.match(renderer,/if\(\$\("#content"\)\)\$\("#content"\)\.scrollTop=0/);
});

test("context menus share the calm icon-led desktop treatment", function () {
  assert.match(renderer,/const CTX_ICON=\{/);
  assert.match(renderer,/function contextIcon\(/);
  assert.match(renderer,/\/deck-add\/\.test\(a\)[\s\S]*M12 5v14M5 12h14/);
  assert.match(css,/#ctxmenu\.show\{animation:ctx-menu-in/);
  assert.match(css,/#ctxmenu \.ci-ico\{[^}]*background:transparent/);
  assert.match(css,/#ctxmenu \.ci:hover\{[^}]*linear-gradient/);
  assert.match(css,/#ctxmenu\{min-width:196px;max-width:258px;padding:5px/);
  assert.match(css,/#ctxmenu \.ci\{min-height:27px;padding:4px 7px/);
  const categoryMenus=renderer.slice(renderer.indexOf("function miCat("),renderer.indexOf("function showMenu("));
  assert.doesNotMatch(categoryMenus,/class="cdot"/);
  assert.match(petCss,/#menu\{[^}]*width:160px[^}]*linear-gradient[^}]*border:1px solid #4a453b[^}]*padding:5px/);
  assert.match(petCss,/#menu \.mi\{min-height:27px;padding:3px 7px[^}]*font-size:10\.5px/);
  const petHtml=fs.readFileSync(path.join(root,"pet.html"),"utf8");
  assert.doesNotMatch(petHtml,/data-nav=|>\s*(?:Vault|Links|Folders|Screenies|Ideas)\s*</);
  assert.match(petHtml,/data-pin="1"[\s\S]*Recent Folders[\s\S]*id="petKill"/);
  assert.doesNotMatch(renderer,/function menuItem\(nav,label,icon\)/);
  assert.match(main,/width:304, height:340/);
});

test("Settings stays focused and exposes editable hotkeys", function () {
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.match(renderer,/shellNavButton\("settings-open"/);
  assert.match(html,/id="settingsPanel"/);
  ["general","parking","tools"].forEach(function(tab){assert.match(renderer,new RegExp('id:"'+tab+'"'),tab);});
  assert.doesNotMatch(renderer,/settingsTab==="search"/);
  assert.match(renderer,/if\(settingsTab==="parking"\)\{[\s\S]*settingsStacks\(\)[\s\S]*<div class="setting-stacks">/);
  assert.match(renderer,/settingContextRow\("Browser extension","extension"/);
  assert.doesNotMatch(renderer,/data-action="settings-back"/);
  ["globalSearch","commandPalette","undo","quickSave"].forEach(function(name){assert.match(renderer,new RegExp('settingHotkeyRow\\("'+name+'"'),name);});
  ["scan","park-url","park-list","stack-open","shots-refresh","backup","restore","update"].forEach(function(action){assert.doesNotMatch(renderer,new RegExp('data-setting-action=\\"'+action+'\\"'),action);});
  assert.match(preload,/hotkeysUpdate:[\s\S]*hotkeyCapture:/);
  assert.match(main,/ipcMain\.handle\("hotkeys-update"[\s\S]*ipcMain\.on\("hotkey-capture"/);
});

test("Settings opens as a centered organized workspace", function () {
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const css=fs.readFileSync(path.join(root,"assets","index.css"),"utf8");
  const titlebar=html.slice(html.indexOf('<div class="titlebar"'),html.indexOf('<div class="body">'));
  assert.doesNotMatch(titlebar,/data-action="settings-open"|data-action="offline-mode"|data-action="monitoring-mode"/);
  assert.match(renderer,/shellNavButton\("settings-open"/);
  assert.doesNotMatch(renderer,/shellNavButton\("shell-search"/);
  assert.doesNotMatch(html,/CONTROL CENTER/);
  assert.match(css,/\.settings-open\{[^}]*border:0[^}]*background:transparent/);
  assert.match(css,/\.offline-toggle\.active,\.monitoring-toggle\.active\{[^}]*box-shadow:none/);
  assert.doesNotMatch(css,/\.window\.offline-mode \.global-search/);
  assert.doesNotMatch(css,/\.window\.monitoring-mode \.global-search/);
  assert.match(renderer,/function openGlobalSearchResult\(index\)\{[\s\S]*?if\(offlineMode\)setOfflineMode\(false,true\);if\(monitoringMode\)setMonitoringMode\(false,true\);[\s\S]*?currentView=item\.view/);
  assert.match(html,/class="settings-head"[\s\S]*data-settings-close/);
  assert.match(shellCss,/\.settings-panel\.show\s*\{\s*display:grid/);
  assert.match(shellCss,/\.settings-card\s*\{[^}]*width:min\(1180px,100%\)[^}]*height:min\(780px,100%\)/);
  assert.match(renderer,/function settingsGroup\(/);
  assert.match(renderer,/name:"Organization"[\s\S]*name:"Tools & storage"/);
  assert.doesNotMatch(renderer,/function settingCommandRow\([^)]*\)\{return '[^']*<small>/);
});

test("Settings controls censoring, Offline collection, and focused single feeds", function () {
  assert.match(shellCss,/settings-panel\.show \.settings-card[\s\S]*settings-card-in/);
  assert.match(renderer,/settingToggle\("censor","Censor mode"/);
  assert.match(renderer,/function applyCensorMode\(\)[\s\S]*classList\.toggle\("censor-mode"/);
  assert.match(renderer,/function monitoringPrivateText\([^)]*\)[\s\S]*censorModeActive\(\)[\s\S]*classList\.contains\("censor-mode"\)[\s\S]*replace\(\/\[\\p\{L\}\\p\{N\}\]/u);
  assert.match(renderer,/function monitoringEventCard\([^)]*\)[\s\S]*monitoringPrivateText\(item\.title/);
  assert.match(renderer,/function viewMonitoringWatchlist\([^)]*\)[\s\S]*monitoringPrivateText\(item\.label/);
  assert.match(renderer,/function viewMonitoringDetail\([^)]*\)[\s\S]*privateBody=monitoringPrivateText/);
  assert.match(renderer,/function applyCensorMode\(\)[\s\S]*E\.setCensorMode\(active\)/);
  assert.match(main,/ipcMain\.on\("censor-mode"[\s\S]*censorModeEnabled=!!enabled/);
  assert.match(main,/function _showMonitoringNotification\(events\)\{[\s\S]*if\(censorModeEnabled\|\|/);
  assert.match(renderer,/function settingMonitoringRow\(\)\{const censored=censorModeActive\(\)[\s\S]*Paused while Censor Mode is on[\s\S]*disabled/);
  assert.match(renderer,/CENSOR_AWAY_MS=5\*60\*1000[\s\S]*function returnFromCensorAway\(\)[\s\S]*promptAwayCensor\(\)/);
  assert.match(renderer,/window\.addEventListener\("blur",beginCensorAway\)[\s\S]*window\.addEventListener\("focus",returnFromCensorAway\)/);
  assert.match(renderer,/persistentCensorOff[\s\S]*Turn off the censor/);
  assert.match(renderer,/class="mon-censor-toggle[\s\S]*data-action="censor-toggle"[\s\S]*>cen<\/button>/);
  assert.match(renderer,/function animateCensorSweep\(\)[\s\S]*censor-sweep-on[\s\S]*Math\.min\(index,18\)\*32/);
  assert.match(renderer,/function refreshTimelineCensorColumns\(\)[\s\S]*timelineColumnBody\(config\)[\s\S]*hydrateMonitoringMedia\(\)/);
  assert.match(renderer,/function refreshTimelineCensorColumns\(\)[\s\S]*\[document,timelineSurfaceCache\]/);
  assert.match(renderer,/function monitoringMediaUrl\(ref\)[\s\S]*sinrad-monitor:\/\/cache\//);
  assert.match(renderer,/function retryMonitoringMedia\(image,ref\)[\s\S]*E\.monitoringMedia\(ref\)/);
  assert.match(renderer,/deferredMediaObserver[\s\S]*virtualMedia==="1"[\s\S]*removeAttribute\("src"\)/);
  assert.match(renderer,/function offlineMediaUrl\(ref\)[\s\S]*jpg\|jpeg\|png\|webp\|gif\|mp4\|webm/);
  assert.match(renderer,/function hydrateOfflineMedia\(\)[\s\S]*observedMedia\.has\(image\)[\s\S]*image\.dataset\.virtualMedia="1"[\s\S]*deferMediaLoad\(image,load\)/);
  assert.match(main,/parsed\.hostname==="cache"[\s\S]*monitoringStore\.resolveMedia\("media\/"\+name\)/);
  assert.match(shellCss,/html\.censor-mode:not\(\.censor-sweeping\) \.monitoring-shell img[\s\S]*censor-sweep-on img[\s\S]*filter:blur\(22px\) saturate\(\.45\)!important/);
  assert.match(renderer,/function openSettings\(\)[\s\S]*Promise\.all\(requests[\s\S]*settingsTab===openedTab/);
  assert.match(renderer,/data-offline-collection/);
  assert.doesNotMatch(renderer,/class="of-collection-toggle"/);
  assert.match(renderer,/offlineSettings\(\{collectionPaused:!collecting\}\)/);
  assert.match(renderer,/class="deck-workspace'\+\(singleFeed\?' single-feed'/);
  assert.match(renderer,/Math\.min\(1100,[\s\S]*viewport-56/);
  assert.match(timelineRefinementCss,/\.deck-workspace\.single-feed\{[^}]*justify-content:center/);
});

test("module switches reuse cached surfaces and Timeline keeps right-click space", function () {
  assert.match(renderer,/let timelineSurfaceCache=null[\s\S]*function cacheTimelineSurface\(/);
  assert.match(renderer,/function renderTimelinePersistent\(content\)\{[\s\S]*content\.replaceChildren\(timelineSurfaceCache\)/);
  assert.match(renderer,/offlineDataReady[\s\S]*refreshOfflineDataAfterPaint\(\)/);
  assert.match(renderer,/monitoringDataReady[\s\S]*refreshMonitoringDataAfterPaint\(\)/);
  assert.match(renderer,/monitoringFilter[\s\S]*opacity:\.58[\s\S]*duration:180/);
  assert.match(renderer,/function animateTimelineColumn[\s\S]*animateTimelineColumn\(item\.key,"add"\)/);
  assert.match(renderer,/let timelinePan=null[\s\S]*\.deck-column>header[\s\S]*glideTimeline\(workspace,velocity\)/);
  assert.match(timelineRefinementCss,/\.deck-title:hover[\s\S]*\.deck-title:hover:after/);
  assert.match(renderer,/case "deck-source-set"[\s\S]*animateTimelineColumn\(item\.key,"switch"\)/);
  assert.match(timelineRefinementCss,/\.deck-workspace:not\(\.single-feed\)::after\{[^}]*flex:0 0 clamp\(150px,14vw,220px\)/);
  assert.match(renderer,/classList\.add\("confirm-modal"\)/);
  assert.match(shellCss,/\.modal\.confirm-modal\s*\{[^}]*border-bottom:3px solid[^}]*radial-gradient/);
});

test("Settings uses the top gear, close button and Escape", function () {
  assert.match(html,/class="settings-head"/);
  assert.match(renderer,/closest\("\[data-settings-close\]"\)\)\{closeSettings\(\)/);
  assert.match(renderer,/case "settings-open": toggleSettings\(\)/);
  assert.match(renderer,/function toggleSettings\(\)\{[^}]*classList\.contains\("show"\)\)closeSettings\(\);else openSettings\(\);\}/);
  assert.match(renderer,/if\(ev\.key==="Escape"\)\{[\s\S]*?closeTimelinePreview\(\)[\s\S]*?closeSettings\(\)/);
});

test("compact UI cleanup keeps page counts visual and horizontal chrome out", function () {
  assert.doesNotMatch(html,/id="pageCounter"/);
  assert.doesNotMatch(html,/id="thinkbar"|id="tbWave"/);
  assert.doesNotMatch(renderer,/buildThinkBar|shot-banner/);
  assert.match(renderer,/assets\/page-counter\/'\+digit\+'\.png/);
  assert.match(renderer,/function pageCounterMarkup\(\)\{return '<div class="page-counter" id="pageCounter"/);
  assert.match(renderer,/function head\([^)]*\)[\s\S]*?pageCounterMarkup\(\)/);
  assert.match(renderer,/of-head-actions[^\n]*pageCounterMarkup\(\)/);
  assert.doesNotMatch(renderer,/mon-head-actions[^\n]*pageCounterMarkup\(\)/);
  assert.match(css,/\.nav\{[^}]*overflow-x:hidden/);
  assert.match(html,/class="norma-stage"[\s\S]*class="norma-dock-gif"/);
  assert.match(css,/#norma\.floating-placeholder\{[^}]*height:180px[^}]*min-height:180px/);
  assert.match(css,/\.page-counter img\{[^}]*height:58px/);
  assert.match(css,/\.setting-switch input:checked\+i::after\{[^}]*transform:translateX/);
  for(let digit=0;digit<=9;digit++)assert.ok(fs.existsSync(path.join(root,"assets","page-counter",digit+".png")),"counter digit "+digit);
});

test("Link maintenance stays out of the card header and important tools live in Settings", function () {
  assert.doesNotMatch(renderer,/data-action="undo-history">Undo/);
  assert.match(renderer,/settingContextRow\("Exact duplicates","duplicates"/);
  assert.match(renderer,/settingContextRow\("Smart categories","smart-rules"/);
  assert.match(renderer,/settingContextRow\("Link health","link-health"/);
  assert.doesNotMatch(renderer,/data-setting-action=/);
  assert.match(renderer,/settingHotkeyRow\("undo"/);
});

test("Settings switches animate in place and mode tabs close Settings", function () {
  assert.match(renderer,/runSettingsCommand\(state\.radCmd\+" set "\+toggle\.dataset\.settingToggle[\s\S]*?,false,true\)/);
  assert.match(renderer,/settingOpenModeToggle"\)await runSettingsCommand\([^\n]*,false,true\)/);
  assert.match(css,/\.setting-switch i::after\{[^}]*cubic-bezier\(\.2,1\.45,\.35,1\)/);
  assert.match(css,/\.setting-switch:active input:checked\+i::after/);
  assert.match(renderer,/function setOfflineMode\([^)]*\)\{\s*closeSettings\(\);/);
  assert.match(renderer,/function setMonitoringMode\([^)]*\)\{\s*closeSettings\(\);/);
  assert.match(preload,/getAutostart:[^\n]*"get-autostart"/);
  assert.match(main,/function _autostartSettings\(\)[\s\S]*executableWillLaunchAtLogin/);
  assert.match(renderer,/toggle\.dataset\.settingToggle==="autostart"[\s\S]*state\.settings\.autoStart=!!\(result&&result\.enabled\)/);
});

test("Settings opens the supported intro and animation folders", function () {
  assert.match(renderer,/settingContextRow\("Intro videos","media-intros"/);
  assert.match(renderer,/settingContextRow\("App animations","media-animations"/);
  assert.match(preload,/mediaAssets:[^\n]*"media-assets"/);
  assert.match(preload,/mediaOpen:[^\n]*"media-open"/);
  assert.match(main,/const ANIMATION_FILES=\["norma\.gif","checking\.gif","updating\.gif","complete\.gif"\]/);
  assert.match(main,/ipcMain\.handle\("media-open"[\s\S]*kind==="intros"\?BOOT_DIR:kind==="animations"\?ANIMATION_DIR/);
  assert.match(renderer,/custom\.norma[\s\S]*custom\.checking[\s\S]*custom\.updating[\s\S]*custom\.complete/);
});

test("offline storage has a visible configurable folder and organized post media", function () {
  assert.match(main,/DEFAULT_OFFLINE_DIR = app\.isPackaged \? path\.join\(app\.getPath\("documents"\),"SINRAD Offline Storage"\)/);
  assert.match(main,/ipcMain\.handle\("offline-storage-open"/);
  assert.match(main,/ipcMain\.handle\("offline-storage-choose"/);
  assert.match(preload,/offlineStorageOpen:[\s\S]*offlineStorageChoose:/);
  assert.match(renderer,/settingFolderRow\("Clipping library",offlineData\.storagePath,"offline-storage"/);
  assert.match(renderer,/key==="offline-storage"[\s\S]*settings-offline-open/);
  assert.match(renderer,/settings-offline-change/);
  assert.match(main,/async function _switchOfflineRoot[\s\S]*await fs\.promises\.cp/);
  assert.match(main,/const \{[^}]*dialog[^}]*\} = require\("electron"\)/);
  assert.match(offlineFeed,/postFolder=crypto\.createHash[\s\S]*"media\/" \+ postFolder \+ "\/" \+ name/);
});

test("dedicated views use persistent navigation and contextual secondary actions", function () {
  assert.doesNotMatch(renderer,/data-action="offline-exit">← Back<\/button>/);
  assert.doesNotMatch(renderer,/data-action="offline-item-back">← Back<\/button>/);
  assert.doesNotMatch(renderer,/data-action="monitoring-exit">← Back<\/button>/);
  assert.doesNotMatch(renderer,/data-action="monitoring-post-back">← Back<\/button>/);
  assert.match(renderer,/type==="monitor-post"[^\n]*monitoring-post-back[^\n]*"Back"/);
  assert.match(renderer,/function rememberMonitoringReturn\(id\)/);
  assert.match(renderer,/function monitoringPostNeighbors\(\)/);
  assert.match(renderer,/case "monitoring-post-nav": await navigateMonitoringPost/);
  assert.match(renderer,/data-ctx="monitor-watchlist"/);
  assert.doesNotMatch(renderer,/class="mon-watch-actions"><button class="btn primary" data-action="monitoring-add"/);
  assert.doesNotMatch(renderer,/Open saved page/);
  assert.match(renderer,/data-ctx="offline-item"/);
  assert.match(renderer,/offline-source-follow/);
  assert.match(main,/u\.pathname==="\/offline\/jobs"/);
  assert.match(main,/ipcMain\.handle\("offline-extension-status"/);
  assert.doesNotMatch(main,/oauth\.reddit\.com|reddit\.com\/api\/v1\/access_token|reddit\/callback/);
  assert.doesNotMatch(renderer,/Reddit Data API|Reddit client ID|Connect Reddit/);
  assert.match(main,/site-preview-v4/);
  assert.match(renderer,/offlineExtensionRequiredModal\(name\)/);
  assert.match(renderer,/function settingsMenuHtml\(key\)/);
  assert.match(shellCss,/\.settings-group \.setting-row\s*\{[^}]*min-height:58px/);
  assert.match(shellCss,/\.settings-group \.setting-hotkey-input\s*\{[^}]*width:168px/);
});

test("recently visited links are surfaced first without a boxed badge", function () {
  assert.match(renderer,/\.sort\(function\(a,b\)\{return Number\(b\.lastOpened\|\|0\)-Number\(a\.lastOpened\|\|0\)/);
  assert.match(renderer,/class="lc-recent">Recently visited/);
  assert.match(renderer,/l\.lastOpened=nowMs\(\);[\s\S]*if\(currentView==="links"[^)]*\)renderView\(\)/);
  assert.match(css,/\.lc-recent\{[^}]*position:absolute/);
  assert.doesNotMatch(css,/\.lc-recent\{[^}]*border:/);
});

test("monitoring cards avoid repeated open and unread buttons", function () {
  assert.match(renderer,/function monitoringEventCard\(item\)[\s\S]*<article class="mon-event[\s\S]*data-action="monitoring-event-open"/);
  assert.doesNotMatch(renderer,/data-action="monitoring-event-read"/);
  assert.doesNotMatch(renderer,/>Open ↗<\/button>/);
  assert.match(renderer,/label\.textContent="Clipping"/);
  assert.match(renderer,/label\.textContent="Monitor"/);
  assert.doesNotMatch(renderer,/label\.textContent=offlineMode\?"Exit Offline"/);
  assert.doesNotMatch(renderer,/label\.textContent=monitoringMode\?"Exit Monitor"/);
  assert.match(css,/\.mon-events\{align-items:start\}/);
  assert.match(css,/\.mon-event\{min-height:0;height:auto;align-self:start\}/);
  assert.match(css,/\.mon-event p\{-webkit-line-clamp:2\}/);
});

test("link menus and Parking controls stay visually quiet", function () {
  assert.doesNotMatch(renderer,/class="cm-site"/);
  assert.doesNotMatch(css,/\.cm-site/);
  assert.doesNotMatch(renderer,/dh-title" style=/);
  assert.match(css,/\.lot-row:hover\{border-color:var\(--border\);background:var\(--panel\);box-shadow:none\}/);
  assert.match(css,/\.drill-head \.dh-open\{font-weight:550\}/);
  assert.match(renderer,/mode==="icon"\?'<svg viewBox="0 0 24 24"/);
  assert.match(css,/\.lot-site-preview\{[^}]*border:0[^}]*background:transparent/);
});

test("watchlist uses artist profiles and keeps controls out of every card", function () {
  assert.match(renderer,/class="mon-watch[\s\S]*data-action="monitoring-monitor-open"[\s\S]*data-ctx="monitor"/);
  assert.match(renderer,/class="mon-watch-hero"[\s\S]*class="mon-watch-identity"[\s\S]*class="mon-watch-meta"/);
  assert.doesNotMatch(renderer,/class="mon-watch-buttons"/);
  assert.doesNotMatch(renderer,/data-action="monitoring-settings"/);
  assert.match(renderer,/data-monitoring-notifications/);
  assert.match(renderer,/id="settingOpenModeToggle"/);
  assert.doesNotMatch(renderer,/id="settingOpenMode"/);
  assert.match(renderer,/type==="monitor"[\s\S]*monitoring-monitor-toggle[\s\S]*monitoring-monitor-refresh[\s\S]*monitoring-monitor-remove/);
  assert.match(renderer,/type==="monitor"[\s\S]*monitoring-monitor-interval/);
  assert.match(renderer,/function viewMonitoringArtist[\s\S]*class="mon-artist-grid"/);
  assert.match(renderer,/type==="monitor-artist"[\s\S]*Download everything/);
  assert.match(renderer,/data-action="monitoring-artist-date-open" data-side="from"[\s\S]*data-action="monitoring-artist-date-open" data-side="to"[\s\S]*monitoring-artist-download-range/);
  assert.match(renderer,/function monitoringArtistRangeInfo[\s\S]*No works match this date range/);
  assert.match(renderer,/function monitoringArtistDatePicker[\s\S]*monitoring-artist-date-year[\s\S]*monitoring-artist-date-month[\s\S]*monitoring-artist-date-pick/);
  assert.match(renderer,/data-action="monitoring-artist-date-edge" data-edge=/);
  assert.match(renderer,/edge==='latest'\?'Latest':'Earliest'/);
  assert.match(renderer,/case "monitoring-artist-date-edge"[\s\S]*days\[0\][\s\S]*days\[days\.length-1\]/);
  assert.match(renderer,/monitoringArtistPostDays[\s\S]*new Set/);
  assert.doesNotMatch(renderer,/id="mon_range_(?:from|to)" type="(?:date|range)"|id="mon_range_year"/);
  assert.match(renderer,/Only the works inside the selected dates are shown below/);
  assert.match(renderer,/Monitoring downloads[\s\S]*monitoring-output/);
  assert.match(css,/\.mon-artist-grid\{display:grid/);
  assert.match(css,/button\.nav-item\{[^}]*background:transparent/);
  assert.match(css,/\.shot-grid\.size-s\{grid-template-columns:repeat\(auto-fill,minmax\(210px,1fr\)\)/);
});

test("Monitoring downloads are queued, visible globally and ZIP checked",function(){
  assert.match(main,/require\("\.\/lib\/monitoring\/index\.js"\)/);
  assert.match(main,/new MonitoringDownloadQueue/);
  assert.match(main,/The downloaded ZIP is incomplete/);
  assert.match(main,/tail\.lastIndexOf\(Buffer\.from\(\[0x50,0x4b,0x05,0x06\]\)\)/);
  assert.match(html,/id="monitorDownloadStatus"[\s\S]*aria-live="polite"/);
  assert.match(renderer,/function paintMonitoringDownload/);
  assert.match(renderer,/case "monitoring-output-open"/);
  assert.match(monitoringQueue,/class MonitoringDownloadQueue[\s\S]*this\.pending[\s\S]*_pump/);
});

test("Monitoring collections persist named post groups and expose shared send menus",function(){
  assert.match(renderer,/function monitoringCollections\(\)[\s\S]*state\.settings\.monitoringCollections/);
  assert.match(renderer,/function monitoringCollectionAddModal\([\s\S]*New collection[\s\S]*monitoringRecentCollectionId/);
  assert.match(renderer,/function monitoringCollectionSendMenu\([\s\S]*monitoring-collection-send-recent/);
  assert.match(renderer,/function monitoringCollectionSendMenu\([\s\S]*monitoring-collection-send/);
  assert.match(renderer,/type==="monitor-event"[\s\S]*monitoringCollectionSendMenu\(type,id\)/);
  assert.match(renderer,/type==="monitor-post"[\s\S]*monitoringCollectionSendMenu\(type,id\)/);
  assert.match(renderer,/type==="monitor-artist-post"[\s\S]*monitoringCollectionSendMenu\(type,id\)/);
  assert.match(renderer,/type==="monitor-collections"[\s\S]*Add collection/);
  assert.match(renderer,/case "monitoring-collection-send-recent"[\s\S]*monitoringRecentCollectionId/);
  assert.match(notificationsCss,/\.mon-collection-grid/);
  assert.match(css,/\.ci-submenu:hover>\.ci-submenu-panel/);
});

test("Timeline deck keeps module pages intact and persists readable columns",function(){
  assert.match(renderer,/const TIMELINE_DEFAULT_COLUMN_WIDTH=450/);
  assert.match(renderer,/width:TIMELINE_DEFAULT_COLUMN_WIDTH,autoWidth:false/);
  assert.match(renderer,/Default: 450 px/);
  assert.match(renderer,/settings:\{timelineDeck:\[\]\}/);
  assert.doesNotMatch(renderer,/deck\.unshift\(\{key:"deck-reddit-home"/);
  assert.doesNotMatch(renderer,/deck\[index\]\.id==="reddit"&&deck\.length===1/);
  assert.match(renderer,/const TIMELINE_MODULES=\{reddit:[\s\S]*notifications:[\s\S]*channels:[\s\S]*compression:[\s\S]*reminders:/);
  assert.match(renderer,/function timelineDeck\(\)[\s\S]*state\.settings\.timelineDeck=deck/);
  assert.match(renderer,/case "deck-add"[\s\S]*case "deck-menu"[\s\S]*case "deck-settings"[\s\S]*case "deck-auto-width"[\s\S]*case "deck-stack-left"[\s\S]*case "deck-remove"[\s\S]*case "deck-move"/);
  assert.match(renderer,/function timelineActivityRows[\s\S]*monitoringData\.events[\s\S]*offlineData\.items[\s\S]*compressionHistory[\s\S]*state\.links/);
  assert.match(timelineCss,/\.deck-workspace\{[^}]*overflow-x:auto[^}]*overflow-y:hidden/);
  assert.match(timelineCss,/\.deck-column\.narrow[\s\S]*\.deck-column\.medium[\s\S]*\.deck-column\.wide/);
  assert.match(deckCss,/\.deck-lane>\.deck-column\+\.deck-column:before[\s\S]*\.deck-context-menu[\s\S]*\.deck-switch/);
  assert.match(renderer,/function captureTimelinePosition[\s\S]*workspace\.scrollLeft[\s\S]*data-deck-key/);
  assert.match(renderer,/function timelineSourceMenu[\s\S]*data-deck-width/);
  assert.match(renderer,/configured:item\.configured!==false[\s\S]*Choose a source from the column menu/);
  assert.match(renderer,/function openTimelineAddWindow[\s\S]*deck-add-modal[\s\S]*case "deck-add-open"/);
  assert.match(renderer,/showMenu\(e\.clientX,e\.clientY,mi\("deck-add-open"/);
  assert.match(renderer,/const column=e\.target\.closest\("\.deck-column"\);if\(column&&!column\.querySelector\("\.deck-empty"\)\)return/);
  assert.match(renderer,/showCardMenu\(type,id,x,y,columnKey\)/);
  assert.match(renderer,/columnKey\?monitoringCollectionSendMenu\(type,id,false\)[\s\S]*type==="monitor-event"[\s\S]*mi\("deck-menu",columnKey,"Column settings"/);
  assert.match(renderer,/if\(enabled&&!monitoringMode&&!offlineMode&&currentView==="home"\)rememberTimelinePosition\(\)/);
  assert.match(renderer,/data-monitoring-original[\s\S]*sinrad-monitor:\/\/file/);
  assert.match(main,/needsMediaBackfill[\s\S]*item\.mediaRef&&!\(item\.meta&&item\.meta\.mediaPath\)/);
  assert.doesNotMatch(renderer,/translateY\(8px\) scale\(\.995\)/);
  assert.match(renderer,/value:"inbox",label:"Inbox",group:"MONITORING"/);
  assert.match(renderer,/class="mon-source pawchive"[\s\S]*assets\/pawchive\.png/);
  assert.match(renderer,/class="mon-event-avatar" data-action="monitoring-monitor-open"/);
  assert.match(renderer,/image\.draggable=false/);
  assert.match(renderer,/monitoringFilter==="inbox"\?monitoringNewestRows\(filtered\):offlineMixSources\(filtered\)/);
  assert.match(renderer,/kind==="channel"\)\{monitoringTab="watchlist";await setMonitoringMode\(true\);await openMonitoringArtist\(id,null\)/);
  assert.match(deckCss,/Timeline correction pass[\s\S]*\.deck-add-controls\{position:fixed[\s\S]*\.deck-monitor-gallery/);
  assert.match(renderer,/data-deck-header[\s\S]*data-deck-drag[\s\S]*clearDeckDragMarkers/);
  assert.match(renderer,/timelineShuffleValue[\s\S]*sort\(function\(a,b\)/);
  assert.match(main,/_offlineStorageSummaryAsync[\s\S]*fs\.promises\.stat/);
  assert.match(renderer,/Duplicate column/);
  assert.match(renderer,/TIMELINE_ADD_GROUPS=\[\['Clipping',[\s\S]*\['Monitoring',[\s\S]*\['Activity',[\s\S]*\['Processing',[\s\S]*Library \/ Personal/);
  assert.match(renderer,/startDroppedCompressionBatch[\s\S]*compressionBatchStart\(\{sources:sources/);
  assert.match(main,/Array\.isArray\(input\.sources\)[\s\S]*_safeCompressionSource/);
});
