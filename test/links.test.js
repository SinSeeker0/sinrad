"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { savedUrlIdentity, normalizeVaultDraft, automaticLinkCategory, automaticLinkCategories, smartLinkCategories, exactDuplicateGroups, mergeExactDuplicates, primarySelection, removeLinkCategory, isParkedLink, buildGlobalSearchIndex, searchGlobalIndex, globalSearch } = require("../assets/shared.js");

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

test("smart category rules preserve YouTube as the primary category", function () {
  const rules=[{pattern:"docs.example.com",category:"Guides"},{pattern:"youtube.com",category:"Interesting"}];
  assert.deepEqual(smartLinkCategories("https://docs.example.com/start","",rules),{main:"Guides",all:["Guides"]});
  assert.deepEqual(smartLinkCategories("https://youtube.com/watch?v=1","Check out",rules),{main:"YouTube",all:["YouTube","Interesting","Check out"]});
});

test("duplicate review only merges exact URLs and preserves useful metadata", function () {
  const links=[
    {id:"new",url:"https://example.com/page?a=1",category:"Guides",categories:["Guides"],favorite:false,note:"",opens:2},
    {id:"old",url:"https://example.com/page?a=1",category:"Interesting",categories:["Interesting"],favorite:true,note:"keep me",opens:3},
    {id:"different",url:"https://example.com/page?a=2",category:"",categories:[]}
  ];
  assert.equal(exactDuplicateGroups(links).length,1);
  const result=mergeExactDuplicates(links);
  assert.equal(result.removed,1);assert.equal(result.links.length,2);
  assert.deepEqual(result.links[0].categories,["Guides","Interesting"]);
  assert.equal(result.links[0].favorite,true);assert.equal(result.links[0].note,"keep me");assert.equal(result.links[0].opens,5);
});

test("folder Add safely chooses the first selected category", function () {
  assert.equal(primarySelection(["Mods","Games"]),"Mods");
  assert.equal(primarySelection([]),"");
  assert.equal(primarySelection(null),"");
});

test("deleting a category removes it from primary and secondary link tags", function () {
  const primary={category:"Guides",categories:["Guides","Interesting"]};
  const secondary={category:"YouTube",categories:["YouTube","Guides"]};
  removeLinkCategory(primary,"Guides");
  removeLinkCategory(secondary,"Guides");
  assert.deepEqual(primary,{category:"Interesting",categories:["Interesting"]});
  assert.deepEqual(secondary,{category:"YouTube",categories:["YouTube"]});
});

test("global search spans modules without exposing or searching vault passwords", function () {
  const state={
    vault:[{id:"v1",name:"Mail account",username:"sean@example.com",password:"private-needle"}],
    links:[{id:"l1",title:"Animation guide",url:"https://example.com/guide",category:"Guides"},{id:"l2",title:"Parked animation",url:"https://park.test",src:"park",category:"",inLinks:false}],
    folders:[{id:"f1",name:"Animation assets",path:"C:\\Art\\Animation"}],
    shots:[{id:"s1",name:"animation-frame.png",path:"C:\\Shots\\animation-frame.png"}],
    ideas:[{id:"i1",title:"Animation controls",details:"Let users stop the animation",type:"ui",status:"inbox"}]
  };
  assert.deepEqual(globalSearch(state,"private-needle"),[]);
  const results=globalSearch(state,"animation");
  assert.deepEqual(results.map(function(item){return item.view;}).sort(),["folders","ideas","links","lot","shots"]);
  assert.equal(results.some(function(item){return Object.prototype.hasOwnProperty.call(item,"password");}),false);
  assert.deepEqual(searchGlobalIndex(buildGlobalSearchIndex(state),"animation"),results);
});

test("parked links stay in Parking Lot even when automatically categorized", function () {
  const parked={id:"youtube-parked",title:"Saved for later",url:"https://youtube.com/watch?v=1",src:"park",category:"YouTube",categories:["YouTube"],inLinks:false};
  assert.equal(isParkedLink(parked),true);
  const result=globalSearch({links:[parked]},"saved for later");
  assert.equal(result.length,1);
  assert.equal(result[0].kind,"Parking Lot");
  assert.equal(result[0].view,"lot");
  parked.inLinks=true;
  assert.equal(isParkedLink(parked),false);
  assert.equal(globalSearch({links:[parked]},"saved for later")[0].view,"links");
});
