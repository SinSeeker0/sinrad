"use strict";

const fs=require("fs");
const path=require("path");

const VIDEO_EXTENSIONS=new Set([".mp4",".m4v",".mov",".mkv"]);
const IMAGE_EXTENSIONS=new Set([".jpg",".jpeg",".png",".webp",".gif",".avif",".bmp",".tif",".tiff"]);
const PRESETS={
  ultra:{label:"Ultra",cq:38,maxrate:"2500k",bufsize:"5M",estimateMin:.07,estimateMax:.30},
  extreme:{label:"Extreme",cq:42,maxrate:"1500k",bufsize:"3M",estimateMin:.05,estimateMax:.22}
};

function preset(value){return PRESETS[String(value||"").toLowerCase()]||PRESETS.ultra;}
function outputPathFor(source,presetName,destination){
  const resolved=path.resolve(source),parsed=path.parse(resolved),label=String(presetName||"ultra").toLowerCase();
  const root=destination?path.resolve(destination):parsed.dir;
  if(fs.existsSync(resolved)&&fs.statSync(resolved).isDirectory())return path.join(root,parsed.base+" compressed "+label);
  return path.join(root,parsed.name+" compressed "+label);
}
function targetPathFor(source,kind,output,relative){return kind==="folder"?path.join(output,relative):path.join(output,path.basename(source));}
function classify(file){const ext=path.extname(file).toLowerCase();return VIDEO_EXTENSIONS.has(ext)?"video":IMAGE_EXTENSIONS.has(ext)?"image":"other";}
async function walk(root){
  const found=[];
  async function visit(current,relative){
    const stat=await fs.promises.lstat(current);
    if(stat.isSymbolicLink())return;
    if(stat.isFile()){found.push({path:current,relative:relative||path.basename(current),size:stat.size,type:classify(current),mtime:stat.mtime});return;}
    if(!stat.isDirectory())return;
    const entries=await fs.promises.readdir(current,{withFileTypes:true});
    for(const entry of entries){if(entry.isSymbolicLink())continue;await visit(path.join(current,entry.name),path.join(relative,entry.name));}
  }
  const stat=await fs.promises.lstat(root);
  if(stat.isSymbolicLink())throw new Error("Linked folders are not supported");
  if(stat.isFile())found.push({path:root,relative:path.basename(root),size:stat.size,type:classify(root),mtime:stat.mtime});
  else if(stat.isDirectory())await visit(root,"");
  else throw new Error("Choose a folder or video file");
  return {kind:stat.isDirectory()?"folder":"file",files:found};
}
function summarize(source,kind,files,presetName,destination){
  const totals={bytes:0,videoBytes:0,imageBytes:0,otherBytes:0,files:files.length,videos:0,images:0,other:0};
  files.forEach(function(file){totals.bytes+=file.size;if(file.type==="video"){totals.videoBytes+=file.size;totals.videos++;}else if(file.type==="image"){totals.imageBytes+=file.size;totals.images++;}else{totals.otherBytes+=file.size;totals.other++;}});
  const selected=preset(presetName),unchanged=totals.imageBytes+totals.otherBytes;
  return Object.assign({source:path.resolve(source),name:path.basename(source),kind:kind,output:outputPathFor(source,presetName,destination),destination:destination?path.resolve(destination):"",preset:String(presetName||"ultra").toLowerCase(),estimatedMin:Math.round(unchanged+totals.videoBytes*selected.estimateMin),estimatedMax:Math.round(unchanged+totals.videoBytes*selected.estimateMax)},totals);
}
async function probe(file,ffmpeg){
  const executable=path.join(path.dirname(ffmpeg),process.platform==="win32"?"ffprobe.exe":"ffprobe");
  return new Promise(resolve=>{require("child_process").execFile(executable,["-v","error","-show_entries","format=duration:stream=codec_type,bit_rate,width,height,avg_frame_rate","-of","json",file],{windowsHide:true,timeout:15000,maxBuffer:1048576},(error,stdout)=>{try{if(error)return resolve(null);const data=JSON.parse(stdout),video=data.streams.find(s=>s.codec_type==="video")||{},rate=String(video.avg_frame_rate||"0/1").split("/");resolve({duration:Number(data.format.duration)||0,width:video.width,height:video.height,fps:Number(rate[0])/Number(rate[1]),audioRate:data.streams.filter(s=>s.codec_type==="audio").reduce((n,s)=>n+(Number(s.bit_rate)||192000),0)});}catch(_){resolve(null);}});});
}
async function analyze(source,presetName,ffmpeg,destination){const resolved=path.resolve(String(source||""));if(!fs.existsSync(resolved))throw new Error("That folder or video no longer exists");if(destination&&(!fs.existsSync(destination)||!fs.statSync(destination).isDirectory()))throw new Error("The compression destination no longer exists");const planned=outputPathFor(resolved,presetName,destination),relative=path.relative(resolved,planned);if(fs.statSync(resolved).isDirectory()&&(relative===""||(!relative.startsWith(".."+path.sep)&&relative!==".."&&!path.isAbsolute(relative))))throw new Error("Choose an output destination outside the source folder");const result=await walk(resolved);if(ffmpeg){const videos=result.files.filter(file=>file.type==="video");let cursor=0;async function worker(){while(cursor<videos.length){const file=videos[cursor++];file.media=await probe(file.path,ffmpeg);}}await Promise.all(Array.from({length:Math.min(4,videos.length)},worker));}const summary=summarize(resolved,result.kind,result.files,presetName,destination);
  summary.duration=result.files.reduce((sum,f)=>sum+(f.media&&f.media.duration||0),0);summary.highFps=result.files.filter(f=>f.media&&f.media.fps>60.5).length;
  summary.estimatedMax=result.files.reduce((sum,f)=>sum+(f.type==="video"&&f.media&&f.media.duration?Math.min(f.size,Math.ceil(f.media.duration*(parseInt(preset(presetName).maxrate)*1000+f.media.audioRate)/8*1.03)):f.size),0);
  summary.estimatedMin=null;return {summary,files:result.files};}
function progressParser(onProgress){let pending="",values={};return chunk=>{pending+=String(chunk);const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){const at=line.indexOf("=");if(at<0)continue;values[line.slice(0,at)]=line.slice(at+1);if(line.startsWith("progress=")){onProgress({seconds:Math.max(0,Number(values.out_time_us)||0)/1e6,bytes:Number(values.total_size)||0,speed:parseFloat(values.speed)||0,frame:Number(values.frame)||0});values={};}}};}
function encodingArgs(file,temp,presetName,capFps,turbo){const selected=preset(presetName),args=["-hide_banner","-loglevel","error","-nostdin","-progress","pipe:1","-stats_period","0.5","-n","-i",file,"-map","0:v:0","-map","0:a?","-map_metadata","0","-c:v","hevc_nvenc","-preset",turbo?"p3":"p5","-tune","hq","-rc","vbr","-cq",String(selected.cq),"-b:v","0","-maxrate",selected.maxrate,"-bufsize",selected.bufsize,"-vf","scale=w='min(iw,1920)':h='min(ih,1080)':force_original_aspect_ratio=decrease:force_divisible_by=2"+(capFps?",fps=fps='min(source_fps,60)'":""),"-c:a","copy"];
 if([".mp4",".m4v",".mov"].includes(path.extname(temp).toLowerCase()))args.push("-movflags","+faststart","-tag:v","hvc1");return args.concat(temp);}

module.exports={VIDEO_EXTENSIONS,IMAGE_EXTENSIONS,PRESETS,preset,outputPathFor,targetPathFor,classify,walk,summarize,analyze,probe,progressParser,encodingArgs};
