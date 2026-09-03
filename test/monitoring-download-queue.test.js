"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {MonitoringDownloadQueue}=require("../lib/monitoring/download-queue.js");

test("monitoring downloads run in order and report queue progress",async function(){
  const order=[],updates=[],complete=[],queue=new MonitoringDownloadQueue({onUpdate:function(item){updates.push(item);},onComplete:function(item){complete.push(item);}});
  const first=queue.enqueue("First",2,async function(report){order.push("first-start");await new Promise(function(resolve){setTimeout(resolve,10);});report({done:1,files:1});order.push("first-end");return {ok:true,count:2};});
  const second=queue.enqueue("Second",1,async function(){order.push("second");return {ok:true,count:1};});
  await Promise.all([first,second]);assert.deepEqual(order,["first-start","first-end","second"]);assert.equal(complete.length,2);assert.ok(updates.some(function(item){return item.status==="active"&&item.queued===1;}));assert.ok(updates.some(function(item){return item.status==="done"&&item.files===2;}));
});

test("canceled monitoring downloads do not send completion notifications",async function(){
  let completed=0;const queue=new MonitoringDownloadQueue({onComplete:function(){completed++;}}),result=await queue.enqueue("Canceled",1,async function(){return {ok:false,canceled:true};});assert.equal(result.canceled,true);assert.equal(completed,0);
});
