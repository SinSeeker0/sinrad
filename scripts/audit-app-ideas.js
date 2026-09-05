"use strict";

const {app,safeStorage}=require("electron");
const fs=require("fs");
const path=require("path");

const manifestPath=path.resolve(process.argv[2]||"");
const productionRoot=path.resolve(process.argv[3]||path.join(app.getPath("appData"),"Sinrad"));
app.setPath("userData",productionRoot);
const dataFile=path.join(productionRoot,"sinrad-data.json"),tempFile=dataFile+".audit-tmp",backupFile=dataFile+".before-idea-audit-"+Date.now()+".bak";

const implemented=[2,5,8,11,16,18,21,27,29,31,33,36,37,38,39,41,48,60,62,69,73,78,82,84,85,86,87,88,95,98,104,109,110,118,123,125,126,133,136,137,139,140,141,146,147,162,163];
const closed=[12,17,25,30,32,44,54,55,56,61,63,66,67,70,72,80,83,89,90,92,103,112,117,119,120,121];
const testing=[10,14,19,23,26,35,42,43,46,49,51,53,58,65,74,76,77,94,97,114,115,116,132,138];
const moveToOther=[124,127,134,148,150,151,152,153,154,155,156,157];

function encryptionAvailable(){return safeStorage.isEncryptionAvailable()&&!(process.platform==="linux"&&typeof safeStorage.getSelectedStorageBackend==="function"&&safeStorage.getSelectedStorageBackend()==="basic_text");}
function decode(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.format==="sinrad-encrypted-v1"){if(!encryptionAvailable())throw new Error("OS encryption is unavailable");return JSON.parse(safeStorage.decryptString(Buffer.from(parsed.payload,"base64")));}return parsed;}
function encode(data){const raw=JSON.stringify(data);if(Buffer.byteLength(raw,"utf8")>10*1024*1024)throw new Error("Audited state exceeds SINRAD's 10 MB safety limit");return encryptionAvailable()?JSON.stringify({format:"sinrad-encrypted-v1",payload:safeStorage.encryptString(raw).toString("base64")}):raw;}

app.whenReady().then(function(){
  try{
    const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8")),source=manifest.items.filter(function(item){return item.group==="app";}),state=decode(fs.readFileSync(dataFile,"utf8")),byKey=new Map((state.ideas||[]).map(function(item){return [String(item.importKey||""),item];}));
    if(source.length!==163)throw new Error("Expected 163 imported App ideas, found "+source.length);
    const assigned=new Set(implemented.concat(closed,testing,moveToOther)),missing=[];for(let index=1;index<=source.length;index++)if(!assigned.has(index))missing.push(index);
    const duplicates=implemented.concat(closed,testing,moveToOther).filter(function(value,index,array){return array.indexOf(value)!==index;});if(duplicates.length)throw new Error("Duplicate audit indexes: "+duplicates.join(", "));
    const reviewedAt=Date.now(),counts={ready:0,testing:0,done:0,other:0};
    source.forEach(function(sourceItem,zeroIndex){
      const index=zeroIndex+1,item=byKey.get(String(sourceItem.importKey||""));if(!item)throw new Error("Imported idea "+index+" is missing from live data");
      if(moveToOther.includes(index)){item.group="other";item.status="inbox";item.reviewNote="Retagged as Other: this note is not a SINRAD app feature.";counts.other++;}
      else if(implemented.includes(index)){item.group="app";item.status="done";item.reviewNote="Implemented and confirmed in the current SINRAD code or regression tests.";counts.done++;}
      else if(closed.includes(index)){item.group="app";item.status="done";item.reviewNote="Reviewed and closed: this was intentionally removed, superseded, or excluded from the current product direction.";counts.done++;}
      else if(testing.includes(index)){item.group="app";item.status="testing";item.reviewNote="Partially present or likely implemented. It needs a hands-on check before it can be marked Done.";counts.testing++;}
      else{item.group="app";item.status="ready";item.reviewNote="Not found as a complete current feature. Ready for future implementation or a clearer decision.";counts.ready++;}
      item.reviewedAt=reviewedAt;item.updated=reviewedAt+zeroIndex;
    });
    if(missing.length!==counts.ready)throw new Error("Audit coverage mismatch");
    if(process.argv.includes("--verify")){process.stdout.write(JSON.stringify({ok:true,counts:counts,covered:source.length}));app.exit(0);return;}
    fs.copyFileSync(dataFile,backupFile,fs.constants.COPYFILE_EXCL);fs.writeFileSync(tempFile,encode(state),{encoding:"utf8",mode:0o600});fs.renameSync(tempFile,dataFile);
    process.stdout.write(JSON.stringify({ok:true,counts:counts,covered:source.length,backup:backupFile}));app.exit(0);
  }catch(error){try{if(fs.existsSync(tempFile))fs.unlinkSync(tempFile);}catch(_){}process.stderr.write(String(error&&error.stack||error));app.exit(1);}
});
