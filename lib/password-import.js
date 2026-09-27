"use strict";
function parsePasswordCsv(text){
  const rows=[];let row=[],cell="",quoted=false;
  const input=String(text).replace(/^\uFEFF/,"");
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(cell);cell="";if(c!==','){if(row.some(Boolean))rows.push(row);row=[];if(c==='\r'&&input[i+1]==='\n')i++;}}else cell+=c;}
  if(quoted)throw Error("The CSV contains an unfinished quoted field");
  row.push(cell);if(row.some(Boolean))rows.push(row);
  const headers=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
  const column=(...names)=>names.map(n=>headers.indexOf(n)).find(i=>i>=0);
  const url=column("url","website","origin","hostname"),user=column("username","user name","login"),password=column("password"),name=column("name","title");
  if(url===undefined||user===undefined||password===undefined)throw Error("Expected URL, username, and password columns from a browser password CSV");
  let skipped=0;const entries=[];
  for(const values of rows){let address;try{address=new URL(values[url]);if(!["https:","http:"].includes(address.protocol))throw Error();}catch(_){skipped++;continue;}
    if(!values[password]){skipped++;continue;}entries.push({name:values[name]||address.hostname,url:address.href,username:values[user]||"",password:values[password]});}
  return {entries,skipped};
}
module.exports={parsePasswordCsv};
