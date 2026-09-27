"use strict";
// Run the packaged app resources against isolated data; never register a protocol
// or use the user's actual offline library during verification.
const electron=require("electron"),{app,ipcMain,dialog,BrowserWindow}=electron;
const fs=require("fs"),path=require("path"),assert=require("assert/strict");
const archive=path.resolve(process.argv[2]||"dist-verify/compression-history-layout-247/win-unpacked/resources/app.asar");
if(!fs.existsSync(archive)){console.error("Packaged app not found; finish packaging before running this check.");process.exit(1);}
const root=fs.mkdtempSync(path.join(path.dirname(path.dirname(archive)),"verification-"));
for(const name of ["data","documents","session","downloads"])fs.mkdirSync(path.join(root,name));
app.setPath("userData",path.join(root,"data"));app.setPath("documents",path.join(root,"documents"));app.setPath("sessionData",path.join(root,"session"));app.setPath("downloads",path.join(root,"downloads"));
Object.defineProperty(app,"isPackaged",{value:true});app.setAsDefaultProtocolClient=()=>false;
app.getVersion=()=>JSON.parse(fs.readFileSync(path.join(archive,"package.json"),"utf8")).version;
app.disableHardwareAcceleration();
const legacy=path.join(root,"documents","Offline Mode"),packagedMediaRef="media/"+"a".repeat(24)+"/"+"b".repeat(64)+".png";fs.mkdirSync(path.join(legacy,"media","a".repeat(24)),{recursive:true});fs.writeFileSync(path.join(legacy,packagedMediaRef),Buffer.from([137,80,78,71,13,10,26,10]));fs.writeFileSync(path.join(legacy,"feed.json"),JSON.stringify({items:[{id:"backend-favorite",sourceKey:"reddit:backend",sourceId:"backend-source",platform:"reddit",title:"Favorite persistence",content:"Fixture",url:"https://www.reddit.com/r/Test/comments/backend/fixture/",date:Date.now(),downloadedAt:Date.now(),favorite:false,read:false,media:[packagedMediaRef],mediaUrls:["https://preview.redd.it/original-name.png"]}],sources:[{id:"backend-source",platform:"reddit",handle:"Test",enabled:false,syncRequestedAt:0,lastSync:Date.now()}],settings:{}}));
const csv=path.join(root,"password-test.csv"),compressionDestination=path.join(root,"compressed-output");fs.writeFileSync(csv,'name,url,username,password\nExample,https://example.test/,test,synthetic-password\nExample,https://example.test/,test,synthetic-password');fs.mkdirSync(compressionDestination);
dialog.showOpenDialog=async(...args)=>{const options=args[args.length-1];return {canceled:false,filePaths:[options&&options.title==="Choose compression output destination"?compressionDestination:csv]};};
const cleanupQuestions=[];dialog.showMessageBox=async(...args)=>{const options=args[args.length-1];if(options.title==="Compression cleanup")cleanupQuestions.push(options.message);return {response:options.title==="Compress archive batch"?1:0};};
const handlers=new Map(),handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(name,fn)=>{handlers.set(name,fn);handle(name,fn);};
require(path.join(archive,"main.js"));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 let win;for(let n=0;n<120;n++){win=BrowserWindow.getAllWindows().find(w=>/index\.html/.test(w.webContents.getURL()));if(win&&!win.webContents.isLoading())break;await pause(250);}
 assert(win,"Main window did not load");const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 await pause(3600);
 const sourceBefore=(await handlers.get('offline-load')(event)).sources.find(row=>row.id==='backend-source');
 await handlers.get('offline-item-update')(event,'backend-favorite',{favorite:true});
 const favored=await handlers.get('offline-load')(event);assert.equal(favored.items.find(row=>row.id==='backend-favorite').favorite,true);assert.equal(favored.sources.find(row=>row.id==='backend-source').syncRequestedAt,sourceBefore.syncRequestedAt);
 await handlers.get('offline-item-update')(event,'backend-favorite',{favorite:false});
 const unfavored=await handlers.get('offline-load')(event);assert.equal(unfavored.items.find(row=>row.id==='backend-favorite').favorite,false);assert.equal(unfavored.sources.find(row=>row.id==='backend-source').syncRequestedAt,sourceBefore.syncRequestedAt);
 const imageDownload=await handlers.get('offline-media-download')(event,packagedMediaRef);assert.equal(imageDownload.ok,true);assert.equal(imageDownload.count,1);assert.equal(path.basename(imageDownload.file),'original-name.png');assert.equal(path.dirname(imageDownload.file),path.join(root,'downloads'));assert.deepEqual(fs.readdirSync(path.join(root,'downloads')),['original-name.png']);
 const postDownload=await handlers.get('offline-item-download')(event,'backend-favorite');assert.equal(postDownload.ok,true);assert.equal(postDownload.count,1);assert.equal(path.dirname(postDownload.folder),root);assert.equal(postDownload.folder,path.join(root,'downloads'));assert(fs.readdirSync(path.join(root,'downloads')).every(name=>fs.statSync(path.join(root,'downloads',name)).isFile()));
 await pause(400);const persisted=JSON.parse(fs.readFileSync(path.join(root,'documents','SINRAD Offline Storage','feed.json'),'utf8'));assert.equal(persisted.items.find(row=>row.id==='backend-favorite').favorite,false);

 assert(fs.existsSync(path.join(root,"documents","SINRAD Offline Storage","feed.json")),"Legacy folder not migrated");
 const home=await win.webContents.executeJavaScript(`(()=>{const freshEmpty=timelineDeck().length===0&&document.querySelectorAll('.deck-column').length===0;state.settings.timelineDeck=[{key:'packaged-reddit',id:'reddit',width:520,autoWidth:false,stack:false,source:'',configured:true}];offlineData.items=[{id:'preview-offline',platform:'reddit',community:'r/SINRAD',title:'A new saved post is ready',sourceLabel:'r/SINRAD',content:'Open it from Clip and keep reading offline.',createdAt:Date.now(),downloadedAt:Date.now(),score:127,commentCount:18}];renderNav();renderView();return {freshEmpty,active:document.querySelector('.nav-item.active')?.dataset.nav,notes:document.querySelectorAll('[data-deck-id="reddit"] .misskey-note').length,title:document.querySelector('.deck-workspace-head h1')?.textContent,labels:Array.from(document.querySelectorAll('#nav .nav-txt b')).map(n=>n.textContent),edit:EDIT_COUNT};})()`);
 assert(home.freshEmpty);assert.deepEqual({active:home.active,notes:home.notes,title:home.title},{active:"home",notes:1,title:"Timeline"});assert(['Timeline','Monitoring','Clipping','Folders','Links','Ideas','More','Settings'].every(label=>home.labels.includes(label)));assert(!home.labels.includes('Switch UI'));
 await pause(600);
 await win.webContents.executeJavaScript(`(()=>{offlineData.items=[{id:'preview-offline',platform:'reddit',community:'r/SINRAD',title:'A new saved post is ready',sourceLabel:'r/SINRAD',content:'Open it from Clip and keep reading offline.',createdAt:Date.now(),downloadedAt:Date.now(),score:127,commentCount:18}];currentView='home';offlineMode=false;monitoringMode=false;renderNav();renderView();})()`);
 fs.writeFileSync(path.join(root,"home-deck-ui.png"),(await win.webContents.capturePage()).toPNG());
 const shellRoutes=await win.webContents.executeJavaScript(`(async()=>{const pause=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('[data-action="shell-monitor"]').click();await pause(80);const notifications=monitoringMode&&!offlineMode;document.querySelector('[data-action="shell-clip"]').click();await pause(80);const clip=offlineMode&&!monitoringMode;document.querySelector('[data-nav="folders"]').click();await pause(40);const drive=!offlineMode&&!monitoringMode&&currentView==='folders';currentView='home';renderNav();renderView();const fixture=document.createElement('article');fixture.className='of-card';fixture.innerHTML='<img class="of-media" src="assets/page-counter/1.png"><h2>Image test</h2>';document.body.appendChild(fixture);fixture.querySelector('img').click();const viewer=!!document.querySelector('#post-image-zoom .post-image-main')&&!document.querySelector('#post-image-zoom button');closePostImage();fixture.remove();return {notifications,clip,drive,viewer};})()`);
 assert.deepEqual(shellRoutes,{notifications:true,clip:true,drive:true,viewer:true});
 await win.webContents.executeJavaScript(`(()=>{const fixture=document.createElement('article');fixture.id='viewer-preview-fixture';fixture.className='of-card';fixture.innerHTML='<img class="of-media" src="norma.gif"><h2>Image preview</h2>';document.body.appendChild(fixture);fixture.querySelector('img').click();})()`);
 const viewerUi=await win.webContents.executeJavaScript(`(()=>{const dialog=document.querySelector('#post-image-zoom'),rect=dialog&&dialog.getBoundingClientRect();return {display:dialog&&getComputedStyle(dialog).display,width:rect&&rect.width,height:rect&&rect.height,text:dialog&&dialog.textContent};})()`);assert(viewerUi.width>500&&viewerUi.height>400&&!viewerUi.text.trim(),JSON.stringify(viewerUi));
 await pause(250);
 fs.writeFileSync(path.join(root,"image-viewer-ui.png"),(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript(`closePostImage();document.querySelector('#viewer-preview-fixture')?.remove()`);
 const pick=await handlers.get("password-import-pick")(event);assert.equal(pick.count,2);assert(!JSON.stringify(pick).includes("synthetic-password"));
 const imported=await handlers.get("password-import-confirm")(event);assert.equal(imported.added,1);assert.equal(imported.duplicates,1);
 assert.equal((await handlers.get("update-install")(event)).ok,false,"Must not claim an undownloaded installer succeeded");
 const result=await win.webContents.executeJavaScript(`(async()=>{
   const pause=ms=>new Promise(r=>setTimeout(r,ms));
   state.vault=(await E.storeLoad()).vault;
   currentView="ideas";ideaPane="ready";ideaViewingId="";
   state.ideas=Array.from({length:60},(_,i)=>({id:"scroll-"+i,title:"Idea "+i,details:"Scroll test details",status:"ready",group:"app",type:["bug","idea","ui","task"][i%4],created:i}));renderNav();renderView();await pause(200);
   const target=document.querySelector('.idea-list-card[data-id="scroll-25"]');target.scrollIntoView({block:"center"});const original=listScrollContainer().scrollTop;
   target.click();await pause(80);leaveIdeaReader();await pause(200);
   if(original<100||Math.abs(listScrollContainer().scrollTop-original)>3)throw Error("Ideas scroll did not restore "+original+" / "+listScrollContainer().scrollTop);
   const colors=new Set(Array.from(document.querySelectorAll('.idea-list-card')).slice(0,4).map(el=>getComputedStyle(el).borderLeftColor));if(colors.size!==4)throw Error("Idea type colors missing");
   renderUpdateResult({ok:true,available:true,current:"2.0.31",latest:"2.0.32",canAuto:true},true);
   renderUpdateResult({ok:true,available:false,current:"2.0.32",latest:"2.0.32"},true);
   if(document.querySelector('#update-toast')||updState)throw Error("Stale update prompt remains");
   return {scroll:true,colors:true,updaterCleared:true,edit:EDIT_COUNT};
 })()`);
 if(process.argv.includes("--compression")){
   const {execFileSync}=require("child_process"),ffmpeg="C:\\ytdl\\ffmpeg.exe",clip=path.join(root,"generated-test.mp4");
   execFileSync(ffmpeg,["-v","error","-n","-f","lavfi","-i","testsrc2=size=640x360:rate=120","-t","8","-c:v","libx264","-preset","ultrafast","-crf","16",clip],{windowsHide:true,timeout:30000});
   const sourceSize=fs.statSync(clip).size,updates=[],send=win.webContents.send.bind(win.webContents);win.webContents.send=(name,...args)=>{if(name==="compression-progress")updates.push(JSON.parse(JSON.stringify(args[0])));return send(name,...args);};
   const destination=await handlers.get("compression-destination-choose")(event);assert.equal(destination.settings.outputFolder,compressionDestination);
   const pending=handlers.get("compression-start")(event,{source:clip,preset:"ultra",capFps:true});
   assert.equal((await handlers.get("compression-start")(event,{source:clip,preset:"ultra"})).ok,false,"Concurrent jobs must be refused");
   const compressed=await pending;assert(compressed.ok,JSON.stringify(compressed));assert.equal(compressed.status.compressed,1);assert(updates.some(p=>p.percent>0&&p.percent<100),"Live progress missing");assert.equal(fs.statSync(clip).size,sourceSize);
   const output=compressed.status.results[0];assert(output.outputBytes<sourceSize);assert(fs.existsSync(output.path));
   assert.equal(path.dirname(output.path),compressed.status.output,"Single-video output must be inside its own folder");assert.equal(path.dirname(compressed.status.output),compressionDestination,"Custom compression destination ignored");assert.equal(compressed.status.history.length,1);
   const meta=JSON.parse(execFileSync("C:\\ytdl\\ffprobe.exe",["-v","error","-show_entries","stream=codec_name,avg_frame_rate,width,height","-of","json",output.path],{encoding:"utf8",windowsHide:true}));assert.equal(meta.streams[0].codec_name,"hevc");assert.equal(meta.streams[0].avg_frame_rate,"60/1");
   const zipped=await handlers.get("compression-zip")(event);assert(zipped.ok,JSON.stringify(zipped));assert(fs.statSync(zipped.path).size>0);assert(execFileSync(path.join(process.env.SystemRoot||"C:\\Windows","System32","tar.exe"),["-tf",zipped.path],{encoding:"utf8",windowsHide:true}).includes(path.basename(output.path)));
   assert.equal((await handlers.get("compression-start")(event,{source:clip,preset:"ultra"})).ok,false,"Existing output must not be overwritten");
   // Use the completed status after the deliberate overwrite refusal.
   const panel=await win.webContents.executeJavaScript('(async()=>{currentView="compress";applyCompressionStatus('+JSON.stringify(compressed.status)+');compressionSelectedPath=compressionHistory[0].id;renderNav();renderView();const player=document.querySelector("#compress-preview video");paintCompression();if(player!==document.querySelector("#compress-preview video"))throw Error("Progress replaces video player");return !!player&&!!document.querySelector(".compress-results")&&!!document.querySelector(".compress-job.video")&&document.querySelectorAll("[data-compression-option]").length===2;})()');assert(panel);
   const interruptedClip=path.join(root,"interrupt-test.mp4");execFileSync(ffmpeg,["-v","error","-n","-f","lavfi","-i","testsrc2=size=1280x720:rate=120","-t","20","-c:v","libx264","-preset","ultrafast","-crf","16",interruptedClip],{windowsHide:true,timeout:30000});
   let cancelled=false;win.webContents.send=(name,...args)=>{if(name==="compression-progress"&&!cancelled&&args[0].percent>0){cancelled=true;handlers.get("compression-cancel")(event);}return send(name,...args);};
   const paused=await handlers.get("compression-start")(event,{source:interruptedClip,preset:"extreme",capFps:true,turbo:true});assert.equal(paused.ok,false);assert.equal(paused.status.interrupted,true);assert.equal(paused.status.cancelled,true);assert(fs.existsSync(path.join(root,"data","compression-last.json")));
   win.webContents.send=send;const resumed=await handlers.get("compression-start")(event,{source:interruptedClip,preset:"extreme",capFps:true,turbo:true,resume:true});assert(resumed.ok,JSON.stringify(resumed));assert.equal(resumed.status.resumed,true);assert.equal(resumed.status.finished,true);
   const history=handlers.get("compression-status")(event).history;assert.equal(history.length,2,"Compression history must retain completed jobs");assert(fs.existsSync(path.join(root,"data","compression-history.json")));
   const removed=await handlers.get("compression-history-remove")(event,history[1].id);assert(removed.ok);assert.equal(removed.history.length,1);assert(fs.existsSync(output.path),"Removing history must not delete compressed files");
   const batchSource=path.join(root,"mixed-batch"),batchFolder=path.join(batchSource,"Folder C"),batchZip=path.join(batchSource,"Pack A.zip");fs.mkdirSync(batchFolder,{recursive:true});fs.copyFileSync(zipped.path,batchZip);fs.copyFileSync(clip,path.join(batchFolder,"clip.mp4"));
   const batchResult=await handlers.get("compression-batch-start")(event,{sources:[batchZip,batchFolder],preset:"extreme",capFps:true,turbo:true});assert(batchResult.ok,JSON.stringify(batchResult));
   const batchHistory=handlers.get("compression-status")(event).history;assert.equal(batchHistory.length,3);assert(batchHistory.slice(0,2).every(item=>item.zipVerified&&fs.existsSync(item.zipPath)));assert.equal(cleanupQuestions.length,4,"Each ZIP asks two independent cleanup questions");assert(batchHistory.slice(0,2).every(item=>fs.existsSync(item.source)&&fs.existsSync(item.output)),"Keep choices preserve both folders");
   const resetDestination=await handlers.get("compression-destination-reset")(event);assert.equal(resetDestination.settings.outputFolder,"");
   await win.webContents.executeJavaScript(`(async()=>{
     const initial=offlineData;offlineData={items:[{id:'recent-read',read:true,historyAt:Date.now()+3600000},{id:'old-read',read:true,historyAt:Date.now()-1},{id:'unread',read:false}],sources:[]};offlineTab='history';offlineQuery='';if(timelineItems().map(i=>i.id).join(',')!=='recent-read,unread')throw Error('Read grace filtering failed');offlineFilter='history';if(offlineFilteredItems()[0].id!=='old-read')throw Error('History grace filtering failed');offlineData=initial;
     const initialMonitor=monitoringData;monitoringData={events:[{id:'a1',monitorId:'a'},{id:'a2',monitorId:'a'},{id:'b1',monitorId:'b'},{id:'expired',monitorId:'b',read:true,readAt:Date.now()-3600001}],monitors:[]};monitoringQuery='';monitoringFilter='all';if(monitoringFilteredEvents().map(i=>i.id).join(',')!=='a1,b1,a2')throw Error('Artist mixing / read delay failed');monitoringData=initialMonitor;
     const fixture=document.createElement('article');fixture.className='of-card';fixture.innerHTML='<img class="of-media" src="assets/page-counter/1.png"><h2>Open title</h2>';document.body.appendChild(fixture);fixture.querySelector('img').click();if(!document.getElementById('post-image-zoom')||!document.querySelector('#post-image-zoom .post-image-main'))throw Error('Image viewer missing');document.querySelector('#post-image-zoom .post-image-canvas').click();if(document.getElementById('post-image-zoom'))throw Error('Image viewer did not finish');fixture.remove();
     applyCompressionStatus(await E.compressionStatus());currentView='compress';offlineMode=false;monitoringMode=false;compressionSelectedPath='';compressionSource='C:\\Media\\Folder 26';compressionSummary=null;compressionTurbo=true;compressionCapFps=true;renderNav();renderView();await new Promise(r=>setTimeout(r,350));
     const controls=Array.from(document.querySelectorAll('.compress-presets button'));if(controls.some(el=>el.getBoundingClientRect().width>180))throw Error('Compression controls still stretch');
   })()`);
   fs.writeFileSync(path.join(root,"compression-ui.png"),(await win.webContents.capturePage()).toPNG());
   result.compression={liveProgress:true,fps:60,sourceBytes:sourceSize,outputBytes:output.outputBytes,folderOutput:true,customDestination:true,zip:true,mixedTopLevelBatch:2,cleanupQuestions:4,persistentHistory:true,manualHistoryRemoval:true,resultsPanel:true,safePause:true,resume:true};
 }
 result.polish=await require("./ui-polish-checks")(win,path.join(root,"polish"));
 result.offlineExperience=await require("./offline-ui-checks")(win,path.join(root,"offline-review"));
 console.log("Packaged checks passed",JSON.stringify({root,migration:true,passwordImport:true,...result}));app.exit(0);
}
app.whenReady().then(run).catch(error=>{console.error(error.stack);app.exit(1);});
