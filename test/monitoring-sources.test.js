"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Sources = require("../lib/monitoring/sources.js");

test("monitoring accepts Pawchive and Bakemono creator links as one source", function(){
  const paw=Sources.parseTarget("https://pawchive.pw/patreon/user/52511814");
  const bake=Sources.parseTarget("https://bakemono.app/c/patreon/52511814/artist-name");
  assert.equal(paw.kind,"pawchive");
  assert.equal(bake.kind,"pawchive");
  assert.equal(paw.key,bake.key);
  assert.equal(bake.displayHost,"bakemono");
});

test("monitoring normalizes an F95zone page link to its thread", function(){
  const target=Sources.parseTarget("https://f95zone.to/threads/brown-dust-2-browndustx-mod.252931/page-156");
  assert.equal(target.kind,"f95");
  assert.equal(target.threadId,"252931");
  assert.equal(target.url,"https://f95zone.to/threads/brown-dust-2-browndustx-mod.252931");
  assert.throws(function(){Sources.parseTarget("https://example.com/threads/252931");},/supports Pawchive/);
});

test("Pawchive posts become sorted, deduplicatable monitoring events", function(){
  const target=Sources.parseTarget("https://bakemono.app/c/patreon/52511814/artist");
  const items=Sources.parsePawchivePosts([
    {id:"old",title:"Older",published:"2026-08-20T10:00:00Z",content:"<b>Old text</b>"},
    {id:"new",title:"Newest",published:"2026-08-21T10:00:00Z",content:"<p>New text</p>",file:{path:"/5d/4b/"+"a".repeat(64)+".png"},attachments:[{}]}
  ],target,Date.now());
  assert.deepEqual(items.map(function(item){return item.title;}),["Newest","Older"]);
  assert.match(items[0].key,/pawchive:patreon:52511814:new/);
  assert.equal(items[0].url,"https://bakemono.app/p/patreon/52511814/new");
  assert.equal(items[0].summary,"New text");
  assert.equal(items[0].mediaUrl,"https://img.pawchive.pw/thumbnail/data/5d/4b/"+"a".repeat(64)+".png");
  assert.equal(items[0].mediaPath,"/5d/4b/"+"a".repeat(64)+".png");
  assert.equal(items[0].meta.mediaPath,items[0].mediaPath);
  assert.equal(Sources.pawchiveThumbnailUrl({path:"../../secret.png"}),"");
});

test("F95zone HTML exposes the latest page and stable reply IDs", function(){
  const target=Sources.parseTarget("https://f95zone.to/threads/example.252931/page-2");
  const html='<html><head><title>Example | F95zone</title></head><body><a href="/threads/example.252931/page-9">9</a>'+
    '<article class="message" data-content="post-700" data-author="ModMaker"><time datetime="2026-08-21T12:00:00Z"></time><div class="message-body"><div class="bbWrapper">New mod file attached</div></div></article>'+
    '<article class="message" data-content="post-701" data-author="Reader"><time datetime="2026-08-21T13:00:00Z"></time><div class="message-body"><div class="bbWrapper">Thanks</div></div></article></body></html>';
  assert.equal(Sources.f95LastPage(html,"252931"),9);
  const items=Sources.parseF95Posts(html,target,9,Date.now());
  assert.deepEqual(items.map(function(item){return item.meta.postId;}),["701","700"]);
  assert.match(items[0].url,/page-9#post-701$/);
  assert.equal(items[0].author,"Reader");
});

test("Pawchive detail keeps readable text and only validated unique files", function(){
  const valid="/5d/4b/"+"c".repeat(64)+".mp4";
  const detail=Sources.parsePawchiveDetail({id:"post-1",title:"Post",content:"<p>First line</p><p>Second line</p><script>bad()</script>",file:{name:"clip.mp4",path:valid},attachments:[{name:"duplicate.mp4",path:valid},{name:"unsafe.exe",path:"../../secret.exe"}]});
  assert.equal(detail.content,"First line\nSecond line");
  assert.equal(detail.files.length,1);
  assert.equal(detail.files[0].kind,"video");
  assert.equal(Sources.pawchiveFileUrl(detail.files[0]),"https://file.pawchive.pw/data"+valid);
  assert.equal(Sources.pawchiveFileUrl("../../secret.png"),"");
});

test("Pawchive detail keeps exposed ZIP archives and other file types", function(){
  const archive="/aa/bb/"+"d".repeat(64)+".zip",document="/cc/dd/"+"e".repeat(64)+".psd";
  const detail=Sources.parsePawchiveDetail({id:"post-2",attachments:[{name:"project files.zip",path:archive},{name:"source.psd",path:document}]});
  assert.deepEqual(detail.files.map(function(file){return file.kind;}),["file","file"]);
  assert.equal(Sources.pawchiveFileUrl(detail.files[0]),"https://file.pawchive.pw/data"+archive);
  assert.equal(Sources.pawchivePostUrl(Sources.parseTarget("https://pawchive.pw/fanbox/user/12"),"34"),"https://pawchive.pw/fanbox/user/12/post/34");
});

test("Pawchive post pages remain usable when the JSON post endpoint is unavailable", function(){
  const image="/aa/bb/"+"a".repeat(64)+".png",video="/cc/dd/"+"b".repeat(64)+".mp4";
  const html='<article data-service="fanbox" data-user="12" data-id="34"><a class="post__user-name">Artist</a><h1 class="post__title"><span>New work</span> <span>(Fanbox)</span></h1><div class="post__published">Published: 2026-09-22 04:30:00</div><div class="post__content"><p>First line</p><p>Second line</p></div><h2>Files</h2><a class="fileThumb" href="https://file.pawchive.pw/data'+image+'?f=cover.png"></a><video><source src="https://file.pawchive.pw/data'+video+'?f=movie.mp4"></video><a class="post__attachment-link" href="https://file.pawchive.pw/data'+video+'?f=movie.mp4"></a></article>';
  const detail=Sources.parsePawchiveDetailHtml(html);
  assert.equal(detail.id,"34");assert.equal(detail.title,"New work");assert.equal(detail.author,"Artist");
  assert.equal(detail.content,"First line\nSecond line");
  assert.deepEqual(detail.files.map(function(file){return [file.name,file.kind];}),[["cover.png","image"],["movie.mp4","video"]]);
});

test("Pawchive creator pages replace the unavailable JSON listing endpoint", function(){
  const image="/aa/bb/"+"a".repeat(64)+".jpeg";
  const html='<h1 class="user-header__name"><a><span itemprop="name">Artist Name</span></a></h1><small>Showing 1 - 50 of 73</small><article class="post-card post-card--preview" data-id="34" data-service="fanbox" data-user="12"><a href="/fanbox/user/12/post/34"><header class="post-card__header">New work</header><div class="post-card__image-container"><img class="post-card__image" src="https://img.pawchive.pw/thumbnail/data'+image+'"></div><footer class="post-card__footer"><time class="timestamp" datetime="2026-09-22 04:30:00">date</time><div>3 attachments</div></footer></a></article>';
  const target=Sources.parseTarget("https://pawchive.pw/fanbox/user/12"),posts=Sources.parsePawchivePostsHtml(html,target,Date.now());
  assert.equal(Sources.pawchiveCreatorNameHtml(html),"Artist Name");assert.equal(Sources.pawchivePostCountHtml(html),73);assert.equal(posts.length,1);
  assert.equal(posts[0].meta.postId,"34");assert.equal(posts[0].title,"New work");assert.equal(posts[0].author,"Artist Name");assert.equal(posts[0].meta.attachments,3);assert.equal(posts[0].mediaPath,image);assert.equal(posts[0].meta.mediaPath,image);
});

test("Pawchive works can be limited to an inclusive date range", function(){
  const posts=[{id:"before",date:new Date(2026,0,31,23,59).getTime()},{id:"start",date:new Date(2026,1,1,0,0).getTime()},{id:"end",date:new Date(2026,1,28,23,59).getTime()},{id:"after",date:new Date(2026,2,1,0,0).getTime()}];
  assert.deepEqual(Sources.filterPostsByDate(posts,"2026-02-01","2026-02-28").map(function(post){return post.id;}),["start","end"]);
  assert.throws(function(){Sources.filterPostsByDate(posts,"2026-02-28","2026-02-01");},/From date/);
  assert.throws(function(){Sources.filterPostsByDate(posts,"2026-02-30","2026-03-01");},/valid date range/);
});
