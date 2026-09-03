"use strict";

importScripts("shared.js");

let index=[];
let revision=0;

self.onmessage=function(event){
  const message=event.data||{};
  if(message.type==="index"){
    index=SinradShared.buildGlobalSearchIndex(message.state||{});
    revision=Number(message.revision)||0;
    self.postMessage({type:"indexed",revision:revision});
    return;
  }
  if(message.type==="search"){
    const results=SinradShared.searchGlobalIndex(index,message.query,message.limit);
    self.postMessage({type:"results",id:message.id,revision:revision,results:results});
  }
};
