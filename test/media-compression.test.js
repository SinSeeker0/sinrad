"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const MediaCompression=require("../lib/media-compression.js");

test("compression output names preserve the original name",function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-compress-"));
  try{
    const folder=path.join(root,"Folder 26"),video=path.join(root,"clip.mp4");fs.mkdirSync(folder);fs.writeFileSync(video,"video");
    assert.equal(MediaCompression.outputPathFor(folder,"ultra"),path.join(root,"Folder 26 compressed ultra"));
    assert.equal(MediaCompression.outputPathFor(video,"extreme"),path.join(root,"clip compressed extreme"));
    const destination=path.join(root,"output");fs.mkdirSync(destination);
    assert.equal(MediaCompression.outputPathFor(video,"extreme",destination),path.join(destination,"clip compressed extreme"));
    assert.equal(MediaCompression.targetPathFor(video,"file",path.join(root,"clip compressed extreme"),"clip.mp4"),path.join(root,"clip compressed extreme","clip.mp4"));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("compression analysis separates videos, images, and copied files",async function(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-compress-"));
  try{
    fs.writeFileSync(path.join(root,"movie.mp4"),Buffer.alloc(1000));fs.writeFileSync(path.join(root,"cover.jpg"),Buffer.alloc(200));fs.writeFileSync(path.join(root,"notes.txt"),Buffer.alloc(100));
    const result=await MediaCompression.analyze(root,"extreme"),summary=result.summary;
    assert.equal(summary.videos,1);assert.equal(summary.images,1);assert.equal(summary.other,1);assert.equal(summary.bytes,1300);
    assert.equal(summary.estimatedMin,null);assert.equal(summary.estimatedMax,1300);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("unsupported video containers are copied instead of silently transcoded",function(){
  assert.equal(MediaCompression.classify("clip.mp4"),"video");
  assert.equal(MediaCompression.classify("clip.mkv"),"video");
  assert.equal(MediaCompression.classify("clip.webm"),"other");
  assert.equal(MediaCompression.classify("image.webp"),"image");
});
test("encoder progress handles partial lines and reports media time",()=>{
 const events=[],parse=MediaCompression.progressParser(p=>events.push(p));parse("out_time_us=125");parse("00000\ntotal_size=1048576\nspeed=2.5x\nframe=300\nprogress=continue\nout_time_us=N/A\nprogress=end\n");assert.equal(events.length,2);assert.equal(events[0].seconds,12.5);assert.equal(events[0].bytes,1048576);assert.equal(events[0].speed,2.5);assert.equal(events[1].seconds,0);
});
test("balanced encoder retains quality targets and makes frame cap opt-in",()=>{
 const args=MediaCompression.encodingArgs("source.mp4","output.mp4","ultra",false);assert.equal(args[args.indexOf("-preset")+1],"p5");assert.equal(args[args.indexOf("-cq")+1],"38");assert(args.includes("pipe:1"));assert(!args.some(a=>a.includes("fps=fps")));assert(MediaCompression.encodingArgs("s","o.mkv","extreme",true).some(a=>a.includes("min(source_fps,60)")));
});
test("turbo mode selects the faster NVIDIA encoder preset",()=>{
 const args=MediaCompression.encodingArgs("source.mp4","output.mp4","ultra",true,true);assert.equal(args[args.indexOf("-preset")+1],"p3");assert(args.some(a=>a.includes("min(source_fps,60)")));
});
