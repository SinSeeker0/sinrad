"use strict";
const assert=require('assert/strict');
module.exports=async function(win){
 win.show();
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const prior={deck:state.settings.timelineDeck,items:offlineData.items},match=window.matchMedia;
  window.matchMedia=query=>query==='(prefers-reduced-motion: reduce)'?{matches:false}:match.call(window,query);
  offlineMode=false;monitoringMode=false;currentView='home';timelineFeedSnapshots.clear();
  state.settings.timelineDeck=[{key:'paint-test',id:'reddit',width:320,autoWidth:false,configured:true,source:''}];
  offlineData.items=[{id:'paint-post',platform:'reddit',community:'r/Test',title:'Paint test',content:'',media:[],read:false}];renderView();
  await new Promise(r=>setTimeout(r,250));
  const content=document.querySelector('#content'),original=content.animate,animations=[];
  content.animate=function(frames,options){animations.push(frames);return original.call(this,frames,options);};
  openTimelineRedditReader('paint-post');await new Promise(r=>setTimeout(r,250));
  leaveTimelineOfflineReader();
  document.querySelector('[data-action="deck-menu"]').click();
  await new Promise(r=>setTimeout(r,40));
  const rootAnimations=animations.length,opacity=Number(getComputedStyle(content).opacity);
  content.animate=original;window.matchMedia=match;content.getAnimations().forEach(a=>a.cancel());
  offlineData.items=prior.items;state.settings.timelineDeck=prior.deck;timelineFeedSnapshots.clear();renderView();
  return {rootAnimations,opacity};
 })()`);
 assert.equal(result.rootAnimations,0,'Reader/menu animated the retained workspace: '+JSON.stringify(result));
 assert.equal(result.opacity,1);
 await win.webContents.executeJavaScript(`(async()=>{
  window.mediaSizingPrior={deck:state.settings.timelineDeck,items:offlineData.items};
  timelineFeedSnapshots.clear();state.settings.timelineDeck=[{key:'sizing',id:'reddit',width:320,autoWidth:false,source:'',configured:true}];
  offlineData.items=['Landscape','Portrait','Short screenshot'].map((title,i)=>({id:'sizing-'+i,title,platform:'reddit',community:'r/Test',media:[],read:false}));renderView();
  const sizes=[[1600,900],[600,1000],[700,200]];
  await Promise.all(Array.from(document.querySelectorAll('.of-card-copy')).map(async(copy,i)=>{const c=document.createElement('canvas');[c.width,c.height]=sizes[i];const ctx=c.getContext('2d');ctx.fillStyle=['#41684e','#50758a','#adad8e'][i];ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#ffffff';ctx.font='40px sans-serif';ctx.fillText(offlineData.items[i].title,20,60);const img=document.createElement('img');img.className='of-media';img.src=c.toDataURL();copy.append(img);await img.decode();}));
 })()`);
 for(const width of [320,900]){
  const sizing=await win.webContents.executeJavaScript(`(()=>{state.settings.timelineDeck[0].width=${width};renderView();return Array.from(document.querySelectorAll('.of-media')).map(img=>{const r=img.getBoundingClientRect(),style=getComputedStyle(img),b=parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth),v=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);return {ratio:(r.width-b)/(r.height-v),natural:img.naturalWidth/img.naturalHeight,width:r.width,height:r.height,copy:img.parentElement.getBoundingClientRect().width};});})()`);
  for(const s of sizing){assert(Math.abs(s.ratio-s.natural)<0.03,JSON.stringify(s));assert(s.copy<=800&&s.width<=s.copy&&s.height<=620,JSON.stringify(s));}
  const fs=require('fs'),path=require('path');const folder=path.join(__dirname,'..','outputs','timeline-265');fs.mkdirSync(folder,{recursive:true});
  await new Promise(r=>setTimeout(r,100));fs.writeFileSync(path.join(folder,'media-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 await win.webContents.executeJavaScript(`offlineData.items=mediaSizingPrior.items;state.settings.timelineDeck=mediaSizingPrior.deck;timelineFeedSnapshots.clear();renderView();`);
};
