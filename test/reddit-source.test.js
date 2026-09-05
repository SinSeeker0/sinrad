"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Reddit = require("../lib/reddit-source.js");

test("Reddit source validates community and user identifiers", function(){
  assert.equal(Reddit.cleanSubreddit("r/AskReddit"),"AskReddit");
  assert.equal(Reddit.cleanUsername("u/example_user"),"example_user");
  assert.throws(function(){Reddit.cleanSubreddit("../private");});
});

test("Reddit authorization uses permanent OAuth with read-only scopes", function(){
  const url=new URL(Reddit.authorizationUrl("abcde12345","state-token","http://127.0.0.1:47821/reddit/callback"));
  assert.equal(url.hostname,"www.reddit.com");
  assert.equal(url.searchParams.get("duration"),"permanent");
  assert.equal(url.searchParams.get("scope"),"identity read");
  assert.equal(url.searchParams.get("state"),"state-token");
});

test("Reddit posts normalize into the shared offline-feed format", function(){
  const source={id:"source-1",handle:"AskReddit"},now=123456789;
  const items=Reddit.parseListing({data:{children:[{data:{name:"t3_abc",subreddit:"AskReddit",title:"Question",author:"poster",selftext:"Body",created_utc:100,permalink:"/r/AskReddit/comments/abc/question/",score:25,num_comments:8,url_overridden_by_dest:"https://i.redd.it/example.jpg"}}]}},source,now);
  assert.equal(items.length,1);
  assert.equal(items[0].sourceKey,"reddit:t3_abc");
  assert.equal(items[0].community,"r/AskReddit");
  assert.equal(items[0].mediaUrls[0],"https://i.redd.it/example.jpg");
  assert.equal(items[0].url,"https://www.reddit.com/r/AskReddit/comments/abc/question/");
});

test("automatic media caching only accepts approved Reddit image and video hosts", function(){
  assert.equal(Reddit.redditMediaUrl("https://preview.redd.it/a.png"),"https://preview.redd.it/a.png");
  assert.equal(Reddit.redditMediaUrl("https://packaged-media.redd.it/post/pb/m2-res_720p.mp4?token=safe"),"https://packaged-media.redd.it/post/pb/m2-res_720p.mp4?token=safe");
  assert.equal(Reddit.redditMediaUrl("https://www.redditstatic.com/avatars/defaults/v2/avatar_default_6.png"),"https://www.redditstatic.com/avatars/defaults/v2/avatar_default_6.png");
  assert.equal(Reddit.redditMediaUrl("https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png"),"");
  assert.equal(Reddit.redditMediaUrl("https://v.redd.it/post/HLSPlaylist.m3u8"),"");
  assert.equal(Reddit.redditMediaUrl("https://example.com/a.png"),"");
  assert.equal(Reddit.redditMediaUrl("http://i.redd.it/a.png"),"");
});

test("low Reddit video previews expand to balanced quality choices", function(){
  const urls=Reddit.preferredVideoUrls("https://v.redd.it/post/CMAF_96.mp4?source=fallback");
  assert.equal(urls[0],"https://v.redd.it/post/CMAF_720.mp4?source=fallback");
  assert.equal(urls[1],"https://v.redd.it/post/CMAF_480.mp4?source=fallback");
  assert.equal(urls.at(-1),"https://v.redd.it/post/CMAF_96.mp4?source=fallback");
  assert.deepEqual(Reddit.preferredVideoUrls("https://i.redd.it/example.jpg"),["https://i.redd.it/example.jpg"]);
});

test("useful comments are flattened to safe offline text", function(){
  const payload=[{}, {data:{children:[{kind:"t1",data:{author:"one",body:"First",score:9}},{kind:"more",data:{}},{kind:"t1",data:{author:"two",body:"Second",score:4}}]}}];
  assert.deepEqual(Reddit.parseComments(payload,1),[{author:"one",body:"First",score:9}]);
});
