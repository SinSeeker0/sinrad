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

test("preview image sniffing requires a supported image",function(){
  assert.equal(Preview.imageMime(Buffer.from([0xff,0xd8,0xff,0x00]),"application/octet-stream"),"image/jpeg");
  assert.equal(Preview.imageMime(Buffer.from("<html>nope</html>"),"text/html"),"");
});
