"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

app.setPath("userData",path.join(app.getPath("temp"),"sinrad-ui-smoke"));

let savedState=null;
ipcMain.handle("store-load",()=>null);
ipcMain.handle("store-security",()=>"permissions-only");
ipcMain.handle("store-save",(_event,data)=>{savedState=data;return true;});
ipcMain.handle("app-version",()=>"0.0.0-test");
ipcMain.handle("kill-status",()=>({armed:false,at:0}));
ipcMain.handle("pet-recents",()=>[]);
ipcMain.handle("update-check",()=>({ok:true,available:false,current:"0.0.0-test",latest:"0.0.0-test"}));

async function run(){
  const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  await win.loadFile(path.join(__dirname,"..","index.html"));
  const result=await win.webContents.executeJavaScript(`(async function(){
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const waitFor=async selector=>{for(let i=0;i<100;i++){const el=document.querySelector(selector);if(el)return el;await pause(25);}throw new Error("Missing "+selector);};
    const click=selector=>{const el=document.querySelector(selector);if(!el)throw new Error("Missing "+selector);el.click();};
    await waitFor('[data-nav="links"]');
    click('[data-nav="links"]');await pause(30);
    document.querySelector('#lk_url').value='https://example.test/smoke-link';
    click('[data-action="link-add"]');await pause(80);
    const link=Array.from(document.querySelectorAll('.link-card .lc-title')).some(el=>el.textContent.includes('example.test'));
    click('[data-nav="folders"]');await pause(30);
    document.querySelector('#fd_path').value='C:\\\\Sinrad-Smoke-Test';
    click('[data-action="folder-add"]');await pause(80);
    const folder=Array.from(document.querySelectorAll('.folder-row .fr-path')).some(el=>el.textContent.includes('Sinrad-Smoke-Test'));
    click('[data-nav="vault"]');await pause(30);
    click('[data-action="vault-new"]');await pause(30);
    document.querySelector('#v_name').value='Sinrad Smoke Entry';
    click('#modal-confirm');await pause(80);
    const vault=Array.from(document.querySelectorAll('.card h3')).some(el=>el.textContent==='Sinrad Smoke Entry');
    return {link,folder,vault};
  })()`);
  const persisted=!!(savedState&&savedState.links&&savedState.links.length&&savedState.folders&&savedState.folders.length&&savedState.vault&&savedState.vault.length);
  if(!result.link||!result.folder||!result.vault||!persisted)throw new Error("UI Add smoke test failed: "+JSON.stringify({result,persisted}));
  console.log("UI Add smoke test passed:",JSON.stringify(result));
  win.destroy();
}

app.whenReady().then(run).then(()=>app.quit()).catch(error=>{console.error(error&&error.stack||error);app.exit(1);});
