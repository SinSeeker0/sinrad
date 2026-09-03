"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {isPrivateAddress,checkLink}=require("../lib/link-health.js");

test("link checker blocks local and private network targets",function(){
  ["127.0.0.1","10.0.0.2","172.16.4.2","192.168.1.2","169.254.1.1","::1","fd00::1"].forEach(function(address){assert.equal(isPrivateAddress(address),true,address);});
  ["1.1.1.1","8.8.8.8","2606:4700:4700::1111"].forEach(function(address){assert.equal(isPrivateAddress(address),false,address);});
});

test("link checker refuses localhost without making a request",async function(){
  const result=await checkLink("http://127.0.0.1/private");
  assert.equal(result.status,"blocked");
});
