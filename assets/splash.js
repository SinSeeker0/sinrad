var done=false;
function finish(){ if(done) return; done=true; try{ if(window.electronAPI&&window.electronAPI.bootDone) window.electronAPI.bootDone(); }catch(e){} }
function toFileURL(p){ return /^([a-zA-Z]:)/.test(p) ? "file:///"+p.replace(/\\/g,"/") : "file://"+p; }
var video=document.getElementById("bv");
video.muted=false; try{ video.volume=1; }catch(e){}
video.addEventListener("ended", finish);           // video played to the end -> open the app
video.addEventListener("error", finish);            // can't play -> don't get stuck, open the app
// safety net: if the video never even starts within 8s, open the app anyway
var startGuard=setTimeout(finish, 8000);
video.addEventListener("playing", function(){ clearTimeout(startGuard); });
function setSrc(v){ if(!v){ finish(); return; } video.src=toFileURL(v); var pr=video.play(); if(pr&&pr.catch) pr.catch(function(){ finish(); }); }
if(window.electronAPI&&window.electronAPI.onBootVideo){ window.electronAPI.onBootVideo(setSrc); }
