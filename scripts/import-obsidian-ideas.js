"use strict";

const {app,safeStorage}=require("electron");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const manifestPath=path.resolve(process.argv[2]||"");
const productionRoot=path.resolve(process.argv[3]||path.join(app.getPath("appData"),"Sinrad"));
app.setPath("userData",productionRoot);
const dataFile=path.join(productionRoot,"sinrad-data.json");
const backupFile=dataFile+".before-ideas-"+Date.now()+".bak";
const tempFile=dataFile+".ideas-tmp";
const mediaRoot=path.join(productionRoot,"ideas","media");

function encryptionAvailable(){return safeStorage.isEncryptionAvailable()&&!(process.platform==="linux"&&typeof safeStorage.getSelectedStorageBackend==="function"&&safeStorage.getSelectedStorageBackend()==="basic_text");}
function decode(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.format==="sinrad-encrypted-v1"){if(!encryptionAvailable())throw new Error("OS encryption is unavailable");return JSON.parse(safeStorage.decryptString(Buffer.from(parsed.payload,"base64")));}return parsed;}
function encode(data){const raw=JSON.stringify(data);if(Buffer.byteLength(raw,"utf8")>10*1024*1024)throw new Error("Imported state exceeds SINRAD's 10 MB safety limit");return encryptionAvailable()?JSON.stringify({format:"sinrad-encrypted-v1",payload:safeStorage.encryptString(raw).toString("base64")}):raw;}
function internalType(value){return value==="problem"?"bug":value==="quick change"?"ui":value==="task"?"task":"idea";}
function copyMedia(media){
  const source=path.resolve(String(media&&media.path||"")),extension=path.extname(source).toLowerCase();
  if(![".jpg",".jpeg",".png",".webp",".gif",".mp4",".webm",".mp3"].includes(extension)||!fs.existsSync(source))return null;
  const stat=fs.statSync(source),maximum=[".mp4",".webm",".mp3"].includes(extension)?128*1024*1024:20*1024*1024;if(!stat.isFile()||stat.size<1||stat.size>maximum)return null;
  const bytes=fs.readFileSync(source),name=crypto.createHash("sha256").update(bytes).digest("hex")+extension,target=path.join(mediaRoot,name);
  if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{mode:0o600});
  return {name:String(media.name||path.basename(source)).slice(0,260),file:name};
}

app.whenReady().then(function(){
  try{
    if(!manifestPath||!fs.existsSync(manifestPath))throw new Error("Import manifest is missing");
    if(!fs.existsSync(dataFile))throw new Error("SINRAD production data was not found");
    const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));if(manifest.format!=="sinrad-obsidian-ideas-v1"||!Array.isArray(manifest.items))throw new Error("Unsupported import manifest");
    const state=decode(fs.readFileSync(dataFile,"utf8"));if(!state||typeof state!=="object"||Array.isArray(state))throw new Error("SINRAD data is invalid");
    if(process.argv.includes("--verify")){
      const wanted=new Set(manifest.items.map(function(item){return String(item.importKey||"");}).filter(Boolean)),found=(Array.isArray(state.ideas)?state.ideas:[]).filter(function(item){return wanted.has(String(item.importKey||""));}),groups=found.reduce(function(counts,item){counts[item.group]=(counts[item.group]||0)+1;return counts;},{}),attachments=found.flatMap(function(item){return Array.isArray(item.attachments)?item.attachments:[];}),missing=attachments.filter(function(media){return !fs.existsSync(path.join(mediaRoot,String(media.file||"")));});
      process.stdout.write(JSON.stringify({ok:found.length===wanted.size&&missing.length===0,ideas:found.length,expected:wanted.size,groups:groups,media:attachments.length,missingMedia:missing.length}));app.exit(found.length===wanted.size&&missing.length===0?0:2);return;
    }
    fs.mkdirSync(mediaRoot,{recursive:true,mode:0o700});
    const existing=new Set((Array.isArray(state.ideas)?state.ideas:[]).map(function(item){return String(item.importKey||"");}).filter(Boolean));
    const created=Date.now(),added=[];let mediaCount=0;
    manifest.items.forEach(function(item,index){
      const key=String(item.importKey||"");if(!key||existing.has(key))return;
      const attachments=(Array.isArray(item.attachments)?item.attachments:[]).map(copyMedia).filter(Boolean);mediaCount+=attachments.length;
      const group=["app","other","unsorted"].includes(item.group)?item.group:"unsorted";
      added.push({id:crypto.randomUUID(),title:String(item.title||"Untitled idea").slice(0,120),details:String(item.details||""),original:String(item.original||item.details||""),references:(Array.isArray(item.references)?item.references:[]).join("\n"),type:internalType(item.type),group:group,status:group==="app"?"ready":"inbox",attachments:attachments,importKey:key,created:created+index,updated:created+index});
      existing.add(key);
    });
    state.ideas=added.concat(Array.isArray(state.ideas)?state.ideas:[]);
    fs.copyFileSync(dataFile,backupFile,fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(tempFile,encode(state),{encoding:"utf8",mode:0o600});
    fs.renameSync(tempFile,dataFile);
    process.stdout.write(JSON.stringify({ok:true,added:added.length,media:mediaCount,backup:backupFile}));
    app.exit(0);
  }catch(error){try{if(fs.existsSync(tempFile))fs.unlinkSync(tempFile);}catch(_){}process.stderr.write(String(error&&error.stack||error));app.exit(1);}
});
