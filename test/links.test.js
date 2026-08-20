"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { savedUrlIdentity, normalizeVaultDraft, automaticLinkCategory, automaticLinkCategories } = require("../assets/shared.js");

test("different paths on the same site are not duplicates", function () {
  const listing = "https://example.test/?tags=popular&tab=explore";
  const post = "https://example.test/posts/6Qa8xlGwYa9?tags=popular&tab=explore";
  assert.notEqual(savedUrlIdentity(listing), savedUrlIdentity(post));
});

test("URL identity preserves case-sensitive paths and query differences", function () {
  assert.notEqual(savedUrlIdentity("https://example.test/Post/ABC"), savedUrlIdentity("https://example.test/post/abc"));
  assert.notEqual(savedUrlIdentity("https://example.test/post?id=1"), savedUrlIdentity("https://example.test/post?id=2"));
  assert.equal(savedUrlIdentity("HTTPS://EXAMPLE.TEST/post?id=1"), savedUrlIdentity("https://example.test/post?id=1"));
});

test("vault drafts validate and normalize before saving", function () {
  assert.deepEqual(normalizeVaultDraft({name:""}), {ok:false,error:"Enter at least one detail before saving"});
  assert.equal(normalizeVaultDraft({name:"Example",url:"chrome://extensions"}).ok,false);
  const result=normalizeVaultDraft({name:" Example ",url:"example.com",username:" user ",password:" secret "});
  assert.equal(result.ok,true);
  assert.equal(result.value.name,"Example");
  assert.equal(result.value.url,"https://example.com/");
  assert.equal(result.value.username,"user");
  assert.equal(result.value.password," secret ");
  assert.equal(normalizeVaultDraft({url:"youtube.com"}).value.name,"youtube.com");
});

test("YouTube links automatically use the YouTube category", function () {
  assert.equal(automaticLinkCategory("https://www.youtube.com/watch?v=abc","Check out"),"YouTube");
  assert.equal(automaticLinkCategory("https://music.youtube.com/watch?v=abc",""),"YouTube");
  assert.equal(automaticLinkCategory("https://youtu.be/abc","Guides"),"YouTube");
  assert.equal(automaticLinkCategory("https://notyoutube.com/watch?v=abc","Guides"),"Guides");
  assert.deepEqual(automaticLinkCategories("https://youtube.com/watch?v=abc","Guides"),{main:"YouTube",all:["YouTube","Guides"]});
});
