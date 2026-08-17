const E = window.electronAPI || {};
const pet = document.getElementById("pet");
const menu = document.getElementById("menu");
let ignored = true;       // current setIgnoreMouseEvents state
let menuOpen = false;
let MASK = null;          // {GW,GH,solid:Uint8Array} when the image has transparency
let petW = 120, petH = 120;

const PIN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-3.6 0-6.5 2.8-6.5 6.3 0 4.7 5.6 11.2 6.1 11.8.2.2.6.2.8 0 .5-.6 6.1-7.1 6.1-11.8C18.5 4.8 15.6 2 12 2zm0 8.6a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"/></svg>';

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]); }); }

function setIgnoreFalse(){ if(ignored){ E.setMouseIgnore && E.setMouseIgnore(false); ignored=false; } }
function setIgnoreTrue(){ if(!ignored){ E.setMouseIgnore && E.setMouseIgnore(true,{forward:true}); ignored=true; } }

/* downsample the image alpha into a occupancy grid for per-pixel click-through */
function buildMask(img){
  try{
    const ar = img.naturalWidth/img.naturalHeight;
    const GW = 48, GH = Math.max(1, Math.round(48/ar));
    const cv = document.createElement("canvas"); cv.width=GW; cv.height=GH;
    const ctx = cv.getContext("2d"); ctx.drawImage(img,0,0,GW,GH);
    const d = ctx.getImageData(0,0,GW,GH).data;
    const solid = new Uint8Array(GW*GH); let translucent=false; let minGX=GW,maxGX=-1,minGY=GH,maxGY=-1;
    for(let i=0;i<GW*GH;i++){ const a=d[i*4+3]; const s=a>30?1:0; solid[i]=s; if(a<250) translucent=true; if(s){ const gx=i%GW, gy=(i/GW)|0; if(gx<minGX)minGX=gx; if(gx>maxGX)maxGX=gx; if(gy<minGY)minGY=gy; if(gy>maxGY)maxGY=gy; } }
    // size the pet box to the image aspect so the grid maps 1:1 (no letterbox)
    const BASE=120; if(ar>=1){ petW=BASE; petH=Math.round(BASE/ar); } else { petH=BASE; petW=Math.round(BASE*ar); }
    pet.style.width=petW+"px"; pet.style.height=petH+"px";
    MASK = translucent ? {GW,GH,solid,bbox:[minGX,maxGX,minGY,maxGY]} : null;   // fully opaque image -> no passthrough possible
  }catch(e){ MASK=null; petW=120; petH=120; }     // canvas read blocked -> whole-box fallback
}

(function loadFace(){
  const names = ["norma.gif","norma.png","norma.webp"]; let i=0;
  (function next(){
    if(i>=names.length) return;
    const im=new Image();
    im.onload=()=>{ Array.from(pet.children).forEach(c=>{ if(c.id!=="petTimer") c.remove(); }); const img=document.createElement("img"); img.src=names[i]; img.alt="Norma"; img.draggable=false; pet.appendChild(img); if(!document.getElementById("petTimer")){ const t=document.createElement("div"); t.id="petTimer"; t.innerHTML="<span>30:00</span>"; pet.appendChild(t); } buildMask(img); paintKill(); };
    im.onerror=()=>{ i++; next(); };
    im.src=names[i];
  })();
})();

E.setMouseIgnore && E.setMouseIgnore(true, { forward:true });
document.addEventListener("mousemove",(e)=>{
  if(menuOpen){ setIgnoreFalse(); return; }              // whole window interactive while the menu is open
  const el=document.elementFromPoint(e.clientX,e.clientY);
    const inPet = el && el.closest("#pet");
  if(inPet){
    if(MASK){
      const rect=pet.getBoundingClientRect(); const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
      if(cx<0||cy<0||cx>=rect.width||cy>=rect.height){ setIgnoreTrue(); return; }
      const gx=Math.min(MASK.GW-1,Math.max(0,Math.floor(cx/rect.width*MASK.GW)));
      const gy=Math.min(MASK.GH-1,Math.max(0,Math.floor(cy/rect.height*MASK.GH)));
      if(MASK.solid[gy*MASK.GW+gx]) setIgnoreFalse(); else setIgnoreTrue();   // only the character pixels are "solid"
    } else setIgnoreFalse();
  } else {
    setIgnoreTrue();
  }
});

pet.addEventListener("pointerdown",(e)=>{ if(e.button!==0) return; E.petDragStart && E.petDragStart({x:e.clientX,y:e.clientY}); });
window.addEventListener("pointerup",()=>{ E.petDragEnd && E.petDragEnd(); });

function openMenu(){ menu.classList.add("show"); menuOpen=true; setIgnoreFalse(); paintKill(); }
function closeMenu(){ menu.classList.remove("show"); menuOpen=false; paintKill(); }
pet.addEventListener("contextmenu",(e)=>{ e.preventDefault(); menuOpen?closeMenu():openMenu(); });
menu.addEventListener("contextmenu",(e)=>e.preventDefault());
menu.addEventListener("click",doMenuAct);
function doMenuAct(e){
  const nav=e.target.closest("[data-nav]");
  const pin=e.target.closest("[data-pin]");
  const fold=e.target.closest("[data-folder]");
  const kill=e.target.closest("[data-kill]");
  if(!nav&&!pin&&!fold&&!kill) return;
  const now=Date.now();
  if(!kill && now-(doMenuAct._t||0)<400) return;
  doMenuAct._t=now;
  if(kill){
    if(!(_petKillAt && _petKillAt>Date.now()) && !window.confirm("Shut this PC down in 30 minutes?")) return;
    const act=E.killToggle||null;
    if(act){ Promise.resolve(act(30)).then(function(r){ _petKillAt=(r&&r.armed)?(r.at||0):0; paintKill(); }).catch(function(){}); }
    else if(_petKillAt && _petKillAt>Date.now()){ if(E.killCancel) Promise.resolve(E.killCancel()).catch(function(){}); }
    else if(E.killArm){ Promise.resolve(E.killArm(30)).then(function(r){ if(r&&r.at){ _petKillAt=r.at; paintKill(); } }).catch(function(){}); }
    return;
  }
  if(fold){
    const p=fold.getAttribute("data-folder");
    if(p && E.openPath) E.openPath(p);
    closeMenu();
    return;
  }
  if(nav){ E.petNav && E.petNav(nav.dataset.nav); } else { E.petPin && E.petPin(); }
  closeMenu();
}

function renderRecents(list){
  const box=document.getElementById("rfList");
  if(!box) return;
  list=Array.isArray(list)?list.slice(0,3):[];
  if(!list.length){ box.innerHTML='<div class="rf-empty">no recents yet</div>'; return; }
  box.innerHTML=list.map(function(f){
    const pin=f.pinned?'<span class="rf-pin" title="Pinned">'+PIN_SVG+'</span>':'';
    const name=f.name||f.path||"";
    return '<div class="rf-item" data-folder="'+esc(f.path||'')+'" title="'+esc(f.path||'')+'">'+pin+'<span class="rf-name">'+esc(name)+'</span></div>';
  }).join("");
}

if(E.onRecentFolders) E.onRecentFolders(renderRecents);
if(E.petRecents){ try{ Promise.resolve(E.petRecents()).then(renderRecents).catch(function(){}); }catch(_){} }

let _petKillAt=0;
function killClock(){
  const ms=Math.max(0, (_petKillAt||0)-Date.now());
  const s=Math.ceil(ms/1000);
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function paintKill(){
  const b=document.getElementById("petKill");
  const t=document.getElementById("petTimer");
  const armed=!!(_petKillAt && _petKillAt>Date.now());
  if(!armed){
    _petKillAt=0;
    if(b){
      b.classList.remove("armed");
      b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg><span>Arm</span>';
      b.title="Arm kill switch — shut this PC down in 30 minutes";
    }
    if(t) t.classList.remove("show");
    return;
  }
  const clock=killClock();
  if(b){
    b.classList.add("armed");
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg><span>Armed · '+clock+"</span>";
    b.title="Cancel shutdown — "+clock+" left";
  }
  if(t){
    const sp=t.querySelector("span");
    if(sp) sp.textContent=clock;
    t.classList.toggle("show", !menuOpen);
  }
}
if(E.onKillStatus) E.onKillStatus(function(s){ _petKillAt=(s&&s.armed)?(s.at||0):0; paintKill(); });
if(E.killStatus){ try{ Promise.resolve(E.killStatus()).then(function(s){ _petKillAt=(s&&s.armed)?(s.at||0):0; paintKill(); }); }catch(_){} }
setInterval(paintKill, 1000);

