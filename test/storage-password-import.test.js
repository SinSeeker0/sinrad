"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {resolveOfflineLocation}=require("../lib/offline-location"),{parsePasswordCsv}=require("../lib/password-import");
test("legacy offline folder is renamed without changing contents",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-migration-")),old=path.join(root,"Offline Mode");fs.mkdirSync(old);fs.writeFileSync(path.join(old,"feed.json"),"saved content");
 const next=resolveOfflineLocation(old,root);assert.equal(next,path.join(root,"SINRAD Offline Storage"));assert.equal(fs.readFileSync(path.join(next,"feed.json"),"utf8"),"saved content");assert.equal(resolveOfflineLocation(old,root),next);
});
test("conflicting libraries and custom storage paths are preserved",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-conflict-")),old=path.join(root,"Offline Mode"),next=path.join(root,"SINRAD Offline Storage");fs.mkdirSync(old);fs.mkdirSync(next);assert.equal(resolveOfflineLocation(old,root),old);assert.equal(resolveOfflineLocation(path.join(root,"My Downloads"),root),path.join(root,"My Downloads"));
});
test("unconfigured storage detects previous default library",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"sinrad-default-")),old=path.join(root,"Sinrad Offline");fs.mkdirSync(old);fs.writeFileSync(path.join(old,"feed.json"),"{}");assert.equal(resolveOfflineLocation(null,root),path.join(root,"SINRAD Offline Storage"));
});
test("browser CSV retains quoted commas, newlines, spaces and passwords",()=>{
 const result=parsePasswordCsv('\uFEFFname,url,username,password\r\n"Site, one",https://example.com,"a""b"," p,ass\nword "\r\n');assert.deepEqual(result,{entries:[{name:"Site, one",url:"https://example.com/",username:'a"b',password:" p,ass\nword "}],skipped:0});
});
test("Firefox columns work and unsafe or empty entries are skipped",()=>{
 const result=parsePasswordCsv("url,username,password,httpRealm\nhttps://example.org,user,secret,\njavascript:alert(1),u,p,\nhttps://empty.org,u,,");assert.equal(result.entries.length,1);assert.equal(result.skipped,2);assert.throws(()=>parsePasswordCsv("x,y,z\na,b,c"),/columns/);assert.throws(()=>parsePasswordCsv('url,username,password\n"unfinished'),/unfinished/);
});
