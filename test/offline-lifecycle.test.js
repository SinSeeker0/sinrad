"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {OfflineFeedStore}=require('../lib/offline-feed');
const DAY=86400000;
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'sinrad-lifecycle-'));try{return run(new OfflineFeedStore(root),root);}finally{fs.rmSync(root,{recursive:true,force:true});}}

test('viewed posts stay active for 30 minutes, persist their deadline, and enter expiring history',()=>fixture((store,root)=>{
  store.mergeItems('',[{sourceKey:'viewed',title:'Viewed',platform:'reddit'}]);
  const item=store.updateItem(store.snapshot().items[0].id,{read:true});
  assert.equal(item.historyAt-item.readAt,30*60000);
  assert.equal(store.takeHistory().length,0);
  assert.equal(new OfflineFeedStore(root).snapshot().items[0].historyAt,item.historyAt);
  store.updateItem(item.id,{read:true});assert.equal(store.snapshot().items[0].historyAt,item.historyAt);
  assert.equal(store.cleanupHistory(item.historyAt-1).removed,0);
  assert.equal(store.cleanupHistory(item.readAt+7*DAY+1).removed,1);
}));

test('legacy one-hour deadlines migrate once and manual history gains finite default retention',()=>fixture((store,root)=>{
  const now=Date.now();fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(store.file,JSON.stringify({settings:{historyCleanupMode:'manual'},items:[{sourceKey:'legacy',read:true,readAt:now,historyAt:now+3600000}],sources:[]}));
  const snapshot=store.snapshot();assert.equal(snapshot.items[0].historyAt,now+1800000);
  assert.equal(snapshot.settings.historyCleanupMode,'age');assert.equal(snapshot.settings.historyRetentionHours,168);
  store.save();assert.equal(new OfflineFeedStore(root).snapshot().items[0].historyAt,now+1800000);
}));

test('daily jobs replace stale unread posts without requiring a view and retain the old cache on failure',()=>fixture(store=>{
  let now=Date.now();const source=store.addSource({platform:'reddit',handle:'test',limit:2,intervalHours:168,lastSync:now});
  store.mergeItems(source.id,[{sourceKey:'old1',platform:'reddit',title:'Old one',downloadedAt:now-2*DAY,url:'https://www.reddit.com/r/test/comments/aaa/'},{sourceKey:'old2',platform:'reddit',title:'Old two',downloadedAt:now-2*DAY,url:'https://www.reddit.com/r/test/comments/bbb/'}]);
  const main=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
  const context={offlineFeed:store,_offlineActiveJobs:new Map(),setImmediate:fn=>fn(),_offlineNotify:()=>{},_offlineCanonicalUrl:url=>url,Date:class extends Date{static now(){return now;}}};
  vm.runInNewContext(main.slice(main.indexOf('function _nextOfflineJob(){'),main.indexOf('function _localJson(')),context);
  const job=context._nextOfflineJob();assert.equal(job.limit,2);assert.equal(job.knownUrls.length,2);
  context._finishOfflineJob({sourceId:source.id,ok:false,saved:0,error:'Offline'});
  assert.equal(store.snapshot().items.length,2);assert.equal(context._nextOfflineJob(),null);
  now+=DAY+1;assert.equal(context._nextOfflineJob().limit,2);
  store.mergeItems(source.id,[{sourceKey:'new1',platform:'reddit',title:'New one',downloadedAt:now}]);
  const partial=context._finishOfflineJob({sourceId:source.id,ok:true,saved:1});assert.equal(partial.continueRefill,true);assert.equal(partial.remaining,1);
  assert.equal(store.snapshot().items.length,2);assert.equal(store.snapshot().items.filter(item=>item.sourceKey.startsWith('old')).length,1);
  assert.equal(context._nextOfflineJob().limit,1);
  store.mergeItems(source.id,[{sourceKey:'new2',platform:'reddit',title:'New two',downloadedAt:now}]);
  context._finishOfflineJob({sourceId:source.id,ok:true,saved:1});
  assert.deepEqual(store.snapshot().items.map(item=>item.sourceKey).sort(),['new1','new2']);
}));

test('daily replacement protects viewed grace, favorites, and other sources',()=>fixture(store=>{
  const now=Date.now(),source=store.addSource({platform:'reddit',handle:'test',limit:1});
  store.mergeItems(source.id,[{sourceKey:'viewed',title:'Viewed',read:true,readAt:now,historyAt:now+1800000,downloadedAt:now-2*DAY},{sourceKey:'favorite',title:'Favorite',favorite:true,downloadedAt:now-2*DAY},{sourceKey:'new',title:'New',downloadedAt:now}]);
  store.mergeItems('',[{sourceKey:'manual',title:'Manual',downloadedAt:now-2*DAY}]);
  assert.equal(store.retireReplacedPosts(source.id,now).removed,0);assert.equal(store.snapshot().items.length,4);
}));

test('duplicate keys expire after seven days across restarts and can be remembered again',()=>fixture((store,root)=>{
  const now=Date.now(),source=store.addSource({platform:'reddit',handle:'test',seenPostKeys:['test:old']});
  assert.deepEqual(store.recentPostKeys(source.id,now),['test:old']);
  const reopened=new OfflineFeedStore(root);assert.deepEqual(reopened.recentPostKeys(source.id,now+6*DAY),['test:old']);
  assert.deepEqual(reopened.recentPostKeys(source.id,now+7*DAY+1),[]);
  reopened.rememberPost(source.id,'test:old',now+8*DAY);assert.deepEqual(reopened.recentPostKeys(source.id,now+8*DAY),['test:old']);
}));
