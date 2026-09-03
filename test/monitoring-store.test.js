"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MonitoringStore } = require("../lib/monitoring-store.js");

function withStore(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-monitor-test-"));
  try{return run(new MonitoringStore(root),root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}

function target(){return {kind:"pawchive",key:"pawchive:patreon:52511814",url:"https://pawchive.pw/patreon/user/52511814",service:"patreon",creatorId:"52511814"};}

test("new watchers default to daily checks", function(){
  withStore(function(store){
    assert.equal(store.snapshot().settings.defaultIntervalMinutes,1440);
    assert.equal(store.add({target:target(),label:"Artist"}).intervalMinutes,1440);
  });
});

test("monitoring watchlist rejects the same source twice", function(){
  withStore(function(store){
    store.add({target:target(),label:"Artist"});
    assert.throws(function(){store.add({target:target(),label:"Same artist"});},/already watching/);
    assert.equal(store.snapshot().monitors.length,1);
  });
});

test("monitoring events deduplicate and preserve read state", function(){
  withStore(function(store){
    const monitor=store.add({target:target(),label:"Artist"});
    const update={key:"pawchive:patreon:52511814:post-1",title:"New post",url:"https://pawchive.pw/post-1",date:Date.now(),mediaRef:"media/"+"a".repeat(64)+".png"};
    assert.equal(store.mergeEvents(monitor.id,[update,update]).length,1);
    const event=store.snapshot().events[0];store.updateEvent(event.id,{read:true});
    assert.equal(store.mergeEvents(monitor.id,[update]).length,0);
    assert.equal(store.snapshot().events[0].read,true);
    assert.match(store.snapshot().events[0].mediaRef,/^media\//);
  });
});

test("monitoring media stays inside its private cache", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-monitor-media-test-"));
  try{
    const store=new MonitoringStore(root),ref=await store.writeMedia("post-1","preview",Buffer.from([0x89,0x50,0x4e,0x47]),".png");
    assert.match(ref,/^media\/[a-f0-9]{64}\.png$/);
    assert.equal(store.resolveMedia("../../secret.png"),"");
    const media=await store.readMedia(ref);assert.deepEqual(Array.from(media.bytes),[0x89,0x50,0x4e,0x47]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("monitoring settings and pause state survive reload", function(){
  withStore(function(store,root){
    const monitor=store.add({target:target(),label:"Artist",intervalMinutes:30});
    store.updateMonitor(monitor.id,{enabled:false,initialized:true,gallerySeeded:true,lastSeenKey:"post-2"});
    store.configure({notifications:false,retentionDays:45,maxEvents:500});
    const reloaded=new MonitoringStore(root);reloaded.load();const snapshot=reloaded.snapshot();
    assert.equal(snapshot.settings.notifications,false);
    assert.equal(snapshot.settings.retentionDays,45);
    assert.equal(snapshot.monitors[0].enabled,false);
    assert.equal(snapshot.monitors[0].gallerySeeded,true);
    assert.equal(snapshot.monitors[0].lastSeenKey,"post-2");
  });
});

test("monitoring download folder defaults and chosen path survive reload", function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-monitor-folder-test-")),defaultFolder=path.join(root,"Downloads"),chosen=path.join(root,"Creator Output");
  try{const store=new MonitoringStore(path.join(root,"store"),defaultFolder);assert.equal(store.snapshot().settings.downloadFolder,path.resolve(defaultFolder));store.setDownloadFolder(chosen);const reloaded=new MonitoringStore(path.join(root,"store"),defaultFolder);reloaded.load();assert.equal(reloaded.snapshot().settings.downloadFolder,path.resolve(chosen));assert.throws(function(){reloaded.setDownloadFolder("relative-folder");},/valid output folder/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
