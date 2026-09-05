"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Preview=require("../lib/site-preview.js");

test("preview metadata resolves rich images and favicons",function(){
  const html='<html><head><link rel="shortcut icon" href="/assets/icon.png"><meta content="/art/cover.jpg?x=1&amp;y=2" property="og:image"></head></html>';
  assert.deepEqual(Preview.parsePreviewTags(html,"https://example.com/posts/1"),{image:"https://example.com/art/cover.jpg?x=1&y=2",icon:"https://example.com/assets/icon.png"});
});

test("preview metadata rejects non-web image schemes",function(){
  const result=Preview.parsePreviewTags('<meta property="og:image" content="file:///secret.png"><link rel="icon" href="data:image/png,x">',"https://example.com/");
  assert.deepEqual(result,{image:"",icon:""});
});

test("YouTube previews recognize normal, short and Shorts URLs",function(){
  assert.equal(Preview.youtubeThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(Preview.youtubeThumbnail("https://youtu.be/dQw4w9WgXcQ?t=10"),"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(Preview.youtubeThumbnail("https://youtube.com/shorts/dQw4w9WgXcQ"),"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(Preview.youtubeThumbnail("https://example.com/watch?v=dQw4w9WgXcQ"),"");
});

test("site icon fallback uses the website origin",function(){
  assert.equal(Preview.faviconServiceUrl("https://www.sankakucomplex.com/tags/test"),"https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fwww.sankakucomplex.com&sz=64");
  assert.equal(Preview.faviconServiceUrl("file:///secret"),"");
});

test("old Sankaku tag links preview through the current web app",function(){
  assert.equal(Preview.sankakuPreviewUrl("https://www.sankakucomplex.com/?tags=wonder_turkey"),"https://sankaku.app/?tags=wonder_turkey");
  assert.equal(Preview.sankakuPreviewUrl("https://chan.sankakucomplex.com/?tags=norigure18"),"https://sankaku.app/?tags=norigure18");
  assert.equal(Preview.sankakuPreviewUrl("https://example.com/?tags=test"),"");
  assert.equal(Preview.sankakuTagQuery("https://www.sankakucomplex.com/?tags=wonder_turkey"),"wonder_turkey");
  assert.equal(Preview.sankakuTagQuery("https://chan.sankakucomplex.com/?tags/norigure18"),"norigure18");
  assert.equal(Preview.sankakuTagQuery("https://www.sankakucomplex.com/tags/huoji_(wonderturkey)"),"huoji_(wonderturkey)");
  assert.equal(Preview.sankakuTagQuery("https://www.sankakucomplex.com/tags/wonder_turkey"),"wonder_turkey");
});

test("Sankaku previews try multiple still images and skip videos",function(){
  const candidates=Preview.sankakuImageCandidates({data:[{sample_url:"/sample-a.webp",preview_url:"/preview-a.avif",file_url:"/clip.mp4"},{sample_url:"/sample-b.jpg",file_url:"/full-b.png"}]});
  assert.deepEqual(candidates,["https://sankakuapi.com/sample-a.webp","https://sankakuapi.com/preview-a.avif","https://sankakuapi.com/sample-b.jpg"]);
  assert.deepEqual(Preview.sankakuImageCandidates([{file_type:"image/jpeg",file_url:"/full.jpg",sample_url:"/sample.webp"}]),["https://sankakuapi.com/full.jpg","https://sankakuapi.com/sample.webp"]);
});

test("preview image sniffing requires a supported image",function(){
  assert.equal(Preview.imageMime(Buffer.from([0xff,0xd8,0xff,0x00]),"application/octet-stream"),"image/jpeg");
  assert.equal(Preview.imageMime(Buffer.from("<html>nope</html>"),"text/html"),"");
});
