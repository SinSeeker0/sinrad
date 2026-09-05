"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { OfflineFeedStore } = require("../lib/offline-feed.js");

function withStore(run){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-test-"));
  try{return run(new OfflineFeedStore(root),root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}

test("offline sources reject duplicates and keep portable adapter fields", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit",limit:30,intervalHours:24,sort:"new",topComments:3});
    assert.equal(source.label,"AskReddit");
    assert.equal(store.snapshot().sources.length,1);
    assert.throws(function(){store.addSource({platform:"reddit",handle:"askreddit"});},/already subscribed/);
  });
});

test("offline source remembers previously downloaded Reddit posts", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit",seenPostKeys:["askreddit:abc","ASKREDDIT:ABC","bad key"]});
    assert.deepEqual(source.seenPostKeys,["askreddit:abc"]);
    assert.deepEqual(store.updateSource(source.id,{lastSync:123}).seenPostKeys,["askreddit:abc"]);
  });
});

test("offline merge deduplicates source keys and preserves reading state and cached media", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"});
    store.mergeItems(source.id,[{sourceKey:"reddit:t3_abc",platform:"reddit",title:"First",date:100,media:["media/"+"a".repeat(64)+".jpg"],comments:[{author:"reader",body:"useful",score:4}]}]);
    const first=store.snapshot().items[0];
    store.updateItem(first.id,{read:true,favorite:true});
    const result=store.mergeItems(source.id,[{sourceKey:"reddit:t3_abc",platform:"reddit",title:"Updated",date:100}]);
    const updated=store.snapshot().items[0];
    assert.equal(result.added,0);
    assert.equal(updated.title,"Updated");
    assert.equal(updated.read,true);
    assert.equal(updated.favorite,true);
    assert.equal(updated.media.length,1);
    assert.equal(updated.comments.length,1);
  });
});

test("offline feed shows the most recently downloaded posts first", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"});
    store.mergeItems(source.id,[
      {sourceKey:"reddit:t3_old_download",platform:"reddit",title:"Newer Reddit post",date:300,downloadedAt:1000},
      {sourceKey:"reddit:t3_new_download",platform:"reddit",title:"Older Reddit post",date:100,downloadedAt:2000}
    ]);
    assert.deepEqual(store.snapshot().items.map(function(item){return item.sourceKey;}),["reddit:t3_new_download","reddit:t3_old_download"]);
  });
});

test("age cleanup removes old history but protects unread posts and favorites", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"}),now=Date.now(),old=now-10*24*60*60*1000;
    store.configure({historyCleanupMode:"age",historyRetentionHours:48,maxItems:100});
    store.mergeItems(source.id,[{sourceKey:"reddit:t3_old",platform:"reddit",title:"Old",date:old},{sourceKey:"reddit:t3_fav",platform:"reddit",title:"Favorite",date:old,favorite:true},{sourceKey:"reddit:t3_new",platform:"reddit",title:"New",date:now}]);
    const stale=store.data.items.find(function(item){return item.sourceKey==="reddit:t3_old";}),favorite=store.data.items.find(function(item){return item.sourceKey==="reddit:t3_fav";});
    stale.read=true;stale.readAt=old;favorite.read=true;favorite.readAt=old;favorite.favorite=true;store.save();
    store.prune(now);
    assert.deepEqual(store.snapshot().items.map(function(item){return item.sourceKey;}).sort(),["reddit:t3_fav","reddit:t3_new"]);
  });
});

test("reading stamps history time and marking unread clears it", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"});store.mergeItems(source.id,[{sourceKey:"reddit:t3_read_at",platform:"reddit",title:"Read me"}]);
    const id=store.snapshot().items[0].id,read=store.updateItem(id,{read:true});assert.equal(read.read,true);assert.ok(read.readAt>0);
    const unread=store.updateItem(id,{read:false});assert.equal(unread.read,false);assert.equal(unread.readAt,0);
  });
});

test("manual history cleanup keeps read posts", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"});store.mergeItems(source.id,[{sourceKey:"reddit:t3_manual",platform:"reddit",title:"Keep me",read:true}]);
    store.configure({historyCleanupMode:"manual"});assert.equal(store.cleanupHistory(Date.now()+100000000).removed,0);assert.equal(store.snapshot().items.length,1);
  });
});

test("storage cleanup deletes oldest history first and protects unread posts", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"}),now=Date.now();store.configure({historyCleanupMode:"storage",historyStorageMB:100});
    store.mergeItems(source.id,[{sourceKey:"reddit:t3_old_history",platform:"reddit",title:"Old history",captureSize:60*1024*1024,read:true,readAt:now-2000},{sourceKey:"reddit:t3_new_history",platform:"reddit",title:"New history",captureSize:30*1024*1024,read:true,readAt:now-1000},{sourceKey:"reddit:t3_unread_space",platform:"reddit",title:"Unread",captureSize:20*1024*1024}]);
    const result=store.cleanupHistory(now),keys=store.snapshot().items.map(function(item){return item.sourceKey;});assert.equal(result.removed,1);assert.deepEqual(keys.sort(),["reddit:t3_new_history","reddit:t3_unread_space"]);
  });
});

test("three-day freshness removes old nonfavorites and reports sources to refill", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit"}),now=Date.now(),old=now-4*24*60*60*1000;store.configure({freshnessDays:3});
    store.mergeItems(source.id,[{sourceKey:"reddit:t3_stale",platform:"reddit",title:"Stale",downloadedAt:old},{sourceKey:"reddit:t3_fresh",platform:"reddit",title:"Fresh",downloadedAt:now},{sourceKey:"reddit:t3_old_favorite",platform:"reddit",title:"Favorite",downloadedAt:old,favorite:true}]);
    const favorite=store.data.items.find(function(item){return item.sourceKey==="reddit:t3_old_favorite";});favorite.favorite=true;store.save();
    const result=store.cleanupStale(now),keys=store.snapshot().items.map(function(item){return item.sourceKey;}).sort();assert.equal(result.removed,1);assert.deepEqual(result.sourceIds,[source.id]);assert.deepEqual(keys,["reddit:t3_fresh","reddit:t3_old_favorite"]);
  });
});

test("deleted offline records can be restored before their files are purged", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-undo-test-"));
  try{
    const store=new OfflineFeedStore(root),source=store.addSource({platform:"reddit",handle:"AskReddit"}),media=await store.writeMedia("reddit:t3_undo",0,Buffer.from("undo"),".jpg");store.mergeItems(source.id,[{sourceKey:"reddit:t3_undo",platform:"reddit",media:[media]}]);
    const taken=store.takeItems([store.snapshot().items[0].id]);assert.equal(store.snapshot().items.length,0);assert.equal(fs.existsSync(store.resolveMedia(media)),true);
    assert.equal(store.restoreItems(taken),1);assert.equal(store.snapshot().items.length,1);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("replacing a low-quality post video removes only the old media file", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-video-replace-test-"));
  try{
    const store=new OfflineFeedStore(root),source=store.addSource({platform:"reddit",handle:"AskReddit"}),oldRef=await store.writeMedia("reddit:t3_quality",0,Buffer.from("old"),".mp4"),newRef=await store.writeMedia("reddit:t3_quality",1,Buffer.from("new"),".mp4");store.mergeItems(source.id,[{sourceKey:"reddit:t3_quality",platform:"reddit",media:[oldRef]}]);
    const item=store.snapshot().items[0],changed=store.replaceItemMedia(item.id,[newRef]);assert.deepEqual(changed.media,[newRef]);assert.equal(fs.existsSync(store.resolveMedia(oldRef)),false);assert.equal(fs.existsSync(store.resolveMedia(newRef)),true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("sync cleanup deletes read posts and files but keeps unread and favorites", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-rotate-test-"));
  try{
    const store=new OfflineFeedStore(root),source=store.addSource({platform:"reddit",handle:"AskReddit"}),readMedia=await store.writeMedia("reddit:t3_read",0,Buffer.from("read"),".jpg"),favMedia=await store.writeMedia("reddit:t3_fav",0,Buffer.from("favorite"),".jpg");
    store.mergeItems(source.id,[{sourceKey:"reddit:t3_read",platform:"reddit",title:"Read",date:3,media:[readMedia]},{sourceKey:"reddit:t3_fav",platform:"reddit",title:"Favorite",date:2,media:[favMedia]},{sourceKey:"reddit:t3_unread",platform:"reddit",title:"Unread",date:1}]);
    const read=store.snapshot().items.find(function(item){return item.sourceKey==="reddit:t3_read";}),favorite=store.snapshot().items.find(function(item){return item.sourceKey==="reddit:t3_fav";});store.updateItem(read.id,{read:true});store.updateItem(favorite.id,{read:true,favorite:true});
    const result=store.removeReadItems([source.id]),keys=store.snapshot().items.map(function(item){return item.sourceKey;});
    assert.equal(result.removed,1);assert.deepEqual(keys.sort(),["reddit:t3_fav","reddit:t3_unread"]);assert.equal(fs.existsSync(store.resolveMedia(readMedia)),false);assert.equal(fs.existsSync(store.resolveMedia(favMedia)),true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("lowering a source limit trims only its oldest nonfavorite posts", function(){
  withStore(function(store){
    const source=store.addSource({platform:"reddit",handle:"AskReddit",limit:3});store.mergeItems(source.id,[{sourceKey:"reddit:t3_one",platform:"reddit",date:1},{sourceKey:"reddit:t3_two",platform:"reddit",date:2},{sourceKey:"reddit:t3_three",platform:"reddit",date:3},{sourceKey:"reddit:t3_favorite",platform:"reddit",date:0}]);const favorite=store.snapshot().items.find(function(item){return item.sourceKey==="reddit:t3_favorite";});store.updateItem(favorite.id,{favorite:true});store.updateSource(source.id,{limit:2});
    assert.deepEqual(store.snapshot().items.map(function(item){return item.sourceKey;}).sort(),["reddit:t3_favorite","reddit:t3_three","reddit:t3_two"]);
  });
});

test("offline media paths cannot escape the cache directory", function(){
  withStore(function(store){
    assert.equal(store.resolveMedia("../../secret.txt"),"");
    assert.equal(store.resolveMedia("media/not-a-hash.jpg"),"");
    assert.match(store.resolveMedia("media/"+"b".repeat(64)+".webp"),/media[\\/]b{64}\.webp$/);
    assert.match(store.resolveMedia("media/"+"c".repeat(64)+".mp4"),/media[\\/]c{64}\.mp4$/);
    assert.match(store.resolveMedia("media/"+"d".repeat(24)+"/"+"e".repeat(64)+".gif"),/media[\\/]d{24}[\\/]e{64}\.gif$/);
  });
});

test("new offline media is organized into a folder for each post", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-organized-test-"));
  try{
    const store=new OfflineFeedStore(root),first=await store.writeMedia("reddit:t3_grouped","post-0",Buffer.from("one"),".jpg"),second=await store.writeMedia("reddit:t3_grouped","comment-0",Buffer.from("two"),".gif");
    assert.match(first,/^media\/[a-f0-9]{24}\/[a-f0-9]{64}\.jpg$/);
    assert.equal(first.split("/")[1],second.split("/")[1]);
    assert.equal(fs.existsSync(store.resolveMedia(first)),true);
    assert.equal(fs.existsSync(store.resolveMedia(second)),true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("offline video and safe rich text metadata survive locally", async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-offline-video-test-"));
  try{
    const store=new OfflineFeedStore(root),ref=await store.writeMedia("reddit:t3_video",0,Buffer.from("video bytes"),".mp4"),avatar=await store.writeMedia("reddit:t3_video","avatar",Buffer.from("avatar bytes"),".png"),commentImage=await store.writeMedia("reddit:t3_video","comment",Buffer.from("comment image"),".jpg");
    const captureRef="captures/"+"9".repeat(64)+".mhtml";fs.mkdirSync(path.join(root,"captures"),{recursive:true});fs.writeFileSync(path.join(root,captureRef),"capture");
    store.addCapture({captureRef:captureRef,url:"https://www.reddit.com/r/test/comments/video/post/",platform:"reddit",title:"Video",author:"poster",authorFlair:"Helpful human",postFlair:"Datamined",authorAvatar:avatar,media:[ref],comments:[{author:"reader",avatar:avatar,body:"Look",contentBlocks:[{type:"quote",runs:[{text:"Quoted reply"}]}],media:[commentImage]}],contentBlocks:[{type:"paragraph",runs:[{text:"Important",bold:true},{text:" details"}]},{type:"listItem",depth:0,runs:[{text:"First point"}]}]});
    const item=store.snapshot().items[0],media=await store.readMedia(ref);assert.equal(item.authorFlair,"Helpful human");assert.equal(item.postFlair,"Datamined");assert.equal(item.authorAvatar,avatar);assert.equal(item.comments[0].avatar,avatar);assert.equal(item.comments[0].contentBlocks[0].type,"quote");assert.deepEqual(item.comments[0].media,[commentImage]);assert.equal(item.contentBlocks.length,2);assert.equal(item.contentBlocks[0].runs[0].bold,true);assert.equal(media.extension,".mp4");assert.equal(media.bytes.toString(),"video bytes");
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("offline browser captures stay inside their private directory and prune with the item", function(){
  withStore(function(store,root){
    const name="c".repeat(64)+".mhtml",ref="captures/"+name,target=path.join(root,"captures",name);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,"saved page");
    store.configure({historyCleanupMode:"age",historyRetentionHours:24,maxItems:100});store.addCapture({captureRef:ref,captureSize:10,title:"Saved page",url:"https://example.com"});
    assert.equal(store.snapshot().items[0].captureRef,ref);
    assert.equal(store.resolveCapture("../../secret.mhtml"),"");
    store.data.items[0].read=true;store.data.items[0].readAt=Date.now()-3*24*60*60*1000;store.save();store.prune(Date.now());
    assert.equal(fs.existsSync(target),false);
  });
});

test("browser captures keep post metadata and replace an older save of the same page", function(){
  withStore(function(store,root){
    const firstRef="captures/"+"d".repeat(64)+".mhtml",secondRef="captures/"+"e".repeat(64)+".mhtml";
    const firstPath=path.join(root,firstRef),secondPath=path.join(root,secondRef);
    const oldMedia="media/"+"f".repeat(64)+".jpg",oldAvatar="media/"+"b".repeat(64)+".png",oldCommentMedia="media/"+"c".repeat(64)+".gif",newMedia="media/"+"a".repeat(64)+".png",newAvatar="media/"+"6".repeat(64)+".png";
    fs.mkdirSync(path.dirname(firstPath),{recursive:true});fs.mkdirSync(path.join(root,"media"),{recursive:true});
    fs.writeFileSync(firstPath,"first");fs.writeFileSync(path.join(root,oldMedia),"old image");fs.writeFileSync(path.join(root,oldAvatar),"old avatar");fs.writeFileSync(path.join(root,oldCommentMedia),"old gif");
    store.addCapture({captureRef:firstRef,url:"https://www.reddit.com/r/test/comments/abc/post/",platform:"reddit",community:"r/test",title:"Original",author:"reader",authorAvatar:oldAvatar,content:"Full post body",date:100,score:12,commentCount:3,media:[oldMedia],comments:[{author:"one",body:"old",media:[oldCommentMedia]}]});
    const first=store.snapshot().items[0];store.updateItem(first.id,{read:true,favorite:true});
    fs.writeFileSync(secondPath,"second");fs.writeFileSync(path.join(root,newMedia),"new image");fs.writeFileSync(path.join(root,newAvatar),"new avatar");
    const extraMedia=["1","2","3","4","5"].map(function(value){return "media/"+value.repeat(64)+".jpg";}),newMediaList=[newMedia].concat(extraMedia);
    const result=store.addCapture({captureRef:secondRef,url:first.url,platform:"reddit",community:"r/test",title:"Updated",author:"poster",authorFlair:"Reader",postFlair:"News",authorAvatar:newAvatar,content:"Updated body",contentBlocks:[{type:"heading",level:1,runs:[{text:"Updated body",bold:true}]}],date:200,score:20,commentCount:5,media:newMediaList,comments:[{author:"one",body:"First comment",score:8,depth:0,date:150},{author:"two",body:"Reply",score:3,depth:1,date:160}]});
    const saved=store.snapshot().items[0];
    assert.equal(result.added,0);assert.equal(result.updated,1);assert.equal(store.snapshot().items.length,1);
    assert.equal(saved.title,"Updated");assert.equal(saved.author,"poster");assert.equal(saved.authorFlair,"Reader");assert.equal(saved.postFlair,"News");assert.equal(saved.content,"Updated body");assert.equal(saved.contentBlocks[0].type,"heading");assert.equal(saved.platform,"reddit");
    assert.equal(saved.captureRef,secondRef);assert.deepEqual(saved.media,newMediaList);assert.equal(saved.comments.length,2);assert.equal(saved.comments[1].depth,1);assert.equal(saved.read,true);assert.equal(saved.favorite,true);
    assert.equal(fs.existsSync(firstPath),false);assert.equal(fs.existsSync(path.join(root,oldMedia)),false);assert.equal(fs.existsSync(path.join(root,oldAvatar)),false);assert.equal(fs.existsSync(path.join(root,oldCommentMedia)),false);
  });
});

test("broken automatic Reddit shells are removed without touching real captures", function(){
  withStore(function(store,root){
    const source=store.addSource({platform:"reddit",adapter:"extension",handle:"Example"});
    const brokenRef="captures/"+"1".repeat(64)+".mhtml",realRef="captures/"+"2".repeat(64)+".mhtml";
    fs.mkdirSync(path.join(root,"captures"),{recursive:true});fs.writeFileSync(path.join(root,brokenRef),"broken");fs.writeFileSync(path.join(root,realRef),"real");
    store.addCapture({sourceId:source.id,captureRef:brokenRef,url:"https://www.reddit.com/r/Example/comments/abc/",platform:"reddit",community:"r/Example",title:"Reddit - The heart of the internet"});
    store.addCapture({sourceId:source.id,captureRef:realRef,url:"https://www.reddit.com/r/Example/comments/def/real_post/",platform:"reddit",community:"r/Example",title:"Real post",content:"Loaded"});
    const result=store.removeBrokenExtensionCaptures();
    assert.equal(result.removed,1);assert.deepEqual(result.sourceIds,[source.id]);assert.equal(store.snapshot().items.length,1);assert.equal(store.snapshot().items[0].title,"Real post");assert.equal(fs.existsSync(path.join(root,brokenRef)),false);assert.equal(fs.existsSync(path.join(root,realRef)),true);
  });
});
