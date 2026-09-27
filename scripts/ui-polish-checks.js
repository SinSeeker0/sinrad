"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert/strict");

// Runs against both the source renderer and the packaged renderer with isolated
// test data. Assert visible state, not only internal routing flags.
module.exports = async function checkPolish(win, directory) {
  if (directory) fs.mkdirSync(directory, {recursive:true});
  const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const run = code => win.webContents.executeJavaScript(code);
  const capture = async name => {
    await pause(300);
    if(directory) {
      // Hidden smoke windows can retain the previous compositor frame.
      await win.webContents.capturePage(); await pause(100);
      fs.writeFileSync(path.join(directory,name+".png"),(await win.webContents.capturePage()).toPNG());
    }
  };
  await run(`closeSettings();closeGlobalSearch(true);closePostImage();stopCelebrate();`);
  // Exercise responsive CSS below the production window's minimum width.
  win.setMinimumSize(600,500);
  if(win.isMaximized())win.unmaximize();
  await pause(200);
  for (const width of [1280,800]) {
    win.setSize(width,900); await pause(100);
    await run(`document.querySelector('[data-nav="home"]').click()`);
    for (const [selector,label] of [
      ['[data-action="shell-monitor"]','Monitoring'],
      ['[data-action="shell-clip"]','Clipping'],
      ['[data-nav="folders"]','Folders'],
      ['[data-action="shell-monitor"]','Monitoring'],
      ['[data-nav="links"]','Links'],
      ['[data-nav="ideas"]','Ideas'],
      ['[data-nav="home"]','Timeline']
    ]) {
      for (let repeat=0;repeat<2;repeat++) {
        await run(`document.querySelector(${JSON.stringify(selector)}).click()`);
        await pause(100);
        const selected = await run(`Array.from(document.querySelectorAll('#nav [aria-current="page"]')).map(el=>el.getAttribute('aria-label'))`);
        assert.deepEqual(selected,[label],`${width}px ${label} selection, click ${repeat+1}`);
      }
    }
    await run(`document.querySelector('[data-nav="home"]').click();`);
    for(let toggle=0;toggle<2;toggle++) {
      const state = await run(`(()=>{const old=document.querySelector('[data-action="shell-more"]').getAttribute('aria-expanded');document.querySelector('[data-action="shell-more"]').click();const button=document.querySelector('[data-action="shell-more"]');return {changed:button.getAttribute('aria-expanded')!==old,current:button.hasAttribute('aria-current'),active:button.classList.contains('active'),visible:getComputedStyle(document.querySelector('#shellMorePanel')).display!=='none',expanded:button.getAttribute('aria-expanded')==='true',selection:document.querySelector('#nav [aria-current="page"]').getAttribute('aria-label')};})()`);
      assert(state.changed&&!state.current&&!state.active&&state.visible===state.expanded&&state.selection==='Timeline');
    }
    const layout = await run(`(()=>{const sidebar=document.querySelector('.sidebar'),content=document.querySelector('#content');return {sidebarWidth:sidebar.getBoundingClientRect().width,sidebarOverflow:sidebar.scrollWidth>sidebar.clientWidth+1,contentOverflow:content.scrollWidth>content.clientWidth+1,labels:Array.from(document.querySelectorAll('#nav button')).every(el=>!!el.getAttribute('aria-label'))};})()`);
    assert(!layout.sidebarOverflow&&!layout.contentOverflow&&layout.labels,JSON.stringify(layout));
    assert.equal(layout.sidebarWidth,width===800?70:250);
    await run(`(()=>{if(!offlineData.items.length)offlineData.items=[{id:'polish-preview',platform:'web',community:'Saved pages',author:'SINRAD',title:'Your saved posts, ready to read',content:'A focused timeline with clearer labels and more readable details.',downloadedAt:Date.now(),date:Date.now(),media:[],favorite:false}];if(!timelineDeck().length)state.settings.timelineDeck=[{key:'polish-reddit',id:'reddit',width:520,autoWidth:false,stack:false,source:'',configured:true}];timelineFeedSnapshots.clear();renderView();})()`);
    const noteFonts=await run(`Array.from(document.querySelectorAll('.of-note-author time,.of-note-author small,.misskey-note p')).map(el=>parseFloat(getComputedStyle(el).fontSize))`);
    assert(noteFonts.length&&noteFonts.every(size=>size>=11),JSON.stringify(noteFonts));
    await capture('timeline-'+width);
  }
  win.setSize(1280,900);await pause(100);
  await run(`if(!sidebarMore)document.querySelector('[data-action="shell-more"]').click();document.querySelector('[data-nav="compress"]').click();`);
  await capture('compress');
  const controls = await run(`Array.from(document.querySelectorAll('.compress-presets button,.compress-check')).map(el=>({width:el.getBoundingClientRect().width,font:parseFloat(getComputedStyle(el.querySelector('b')||el).fontSize)}))`);
  assert(controls.length>=4&&controls.every(el=>el.width<=180&&el.font>=11),JSON.stringify(controls));
  await run(`document.querySelector('[data-action="settings-open"]').click();document.querySelector('[data-settings-tab="general"]').click()`);
  await capture('settings-general');
  const settings = await run(`(()=>{const card=document.querySelector('.settings-card'),row=document.querySelector('.setting-label'),rect=card.getBoundingClientRect();return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:innerWidth,height:innerHeight,font:parseFloat(getComputedStyle(row).fontSize),groups:document.querySelectorAll('.settings-group').length,close:!!document.querySelector('[data-settings-close]')};})()`);
  assert(Math.abs((settings.left+settings.right)/2-settings.width/2)<2);assert(Math.abs((settings.top+settings.bottom)/2-settings.height/2)<2);assert(settings.left>0&&settings.top>0&&settings.right<settings.width&&settings.bottom<settings.height);assert(settings.font>=11);assert.equal(settings.groups,3);assert(settings.close);
  await run(`document.querySelector('[data-settings-tab="tools"]').click()`);
  await capture('settings-tools');
  await run(`closeSettings();document.querySelector('[data-nav="links"]').click();`);
  await capture('links');
  await run(`document.querySelector('[data-nav="ideas"]').click();`);
  await capture('ideas');
  await run(`document.querySelector('[data-action="shell-monitor"]').click();`);
  await capture('notifications');
  await run(`document.querySelector('[data-nav="home"]').click();`);
  return {selectedRoutes:true,repeatedNavigation:true,moreDisclosure:true,readability:true,responsive:true};
};
