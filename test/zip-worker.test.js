"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),os=require("os"),{execFileSync}=require("child_process");
const script=path.resolve(__dirname,"../lib/zip-worker.ps1");
function worker(mode,source,destination){return JSON.parse(execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script,"-Mode",mode,"-Source",source].concat(destination?["-Destination",destination]:[]),{encoding:"utf8",windowsHide:true,timeout:60000}).trim());}
test("ZIP archives round-trip nested Unicode files and reject overwrite",{skip:process.platform!=="win32"},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-zip-test-")),source=path.join(root,"Folder 26"),zip=path.join(root,"sample.zip"),extract=path.join(root,"unpacked");
 try{fs.mkdirSync(path.join(source,"nested"),{recursive:true});fs.writeFileSync(path.join(source,"nested","動画.txt"),"hello archive");assert.equal(worker("pack",source,zip).verified,true);assert.equal(worker("inspect",zip).files,1);assert.equal(worker("extract",zip,extract).files,1);assert.equal(fs.readFileSync(path.join(extract,"Folder 26","nested","動画.txt"),"utf8"),"hello archive");assert.throws(()=>worker("pack",source,zip));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("ZIP extraction rejects traversal without writing outside destination",{skip:process.platform!=="win32"},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-zip-invalid-")),zip=path.join(root,"unsafe.zip"),extract=path.join(root,"extract");
 try{execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command","Add-Type -AssemblyName System.IO.Compression; $f=[IO.File]::Open($env:SINRAD_TEST_ZIP,[IO.FileMode]::CreateNew); $z=[IO.Compression.ZipArchive]::new($f,[IO.Compression.ZipArchiveMode]::Create); $null=$z.CreateEntry('../escaped.txt'); $z.Dispose(); $f.Dispose()"],{env:{...process.env,SINRAD_TEST_ZIP:zip},windowsHide:true});assert.throws(()=>worker("extract",zip,extract));assert(!fs.existsSync(extract));assert(!fs.existsSync(path.join(root,"escaped.txt")));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
