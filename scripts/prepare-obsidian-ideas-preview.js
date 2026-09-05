"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const inputs=process.argv.slice(2,-1),outputRoot=process.argv.at(-1);
if(inputs.length<1||!outputRoot)throw new Error("Pass one or more Markdown files and an output folder");
const vaultRoot=path.dirname(path.dirname(inputs[0]));

const sensitive=/(?:discord\s+(?:token|backup\s*codes?)|token\s+value|access\s+key|secret\s+access|wix\s+api|metaquotes|\blogin\s*:|\bpassword\s*:|\binvestor\s*:|credit\s*card\s*(?:number|details?)\s*:)/i;
const secretShape=/(?:\beyJ[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b[a-zA-Z0-9_=-]{80,}\b)/;
const ignoreOnly=/^(?:tags?\s*:.*|\[?redacted.*|h+m+|you already know|to be used|found some more(?: hehe)?|\]+)$/i;

function references(text){
  const found=[];
  for(const match of String(text).matchAll(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))found.push(match[1].trim());
  for(const match of String(text).matchAll(/https?:\/\/[^\s)>]+/g))found.push(match[0].replace(/[.,;]+$/, ""));
  return Array.from(new Set(found));
}
function visibleText(text){
  return String(text).replace(/!\[\[[^\]]+\]\]/g," ").replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1").replace(/https?:\/\/\S+/g," ").replace(/[*_#>`]/g," ").replace(/\s+/g," ").trim();
}
function titleFor(text){
  let title=visibleText(text).replace(/^(?:alr(?:ight)?|okay|umm?|oh+|just thought of this|just got an idea|another idea|an idea|i wanna|i want to|should|could|make sure to|don'?t forget to|gotta)\s*[:,;-]?\s*/i,"");
  title=title.split(/(?<=[.!?])\s+/)[0]||title;
  if(title.length>92)title=title.slice(0,89).replace(/\s+\S*$/,'')+"…";
  if(!title)title="Visual reference idea";
  return title.charAt(0).toUpperCase()+title.slice(1);
}
function typeFor(text){
  const value=visibleText(text).toLowerCase();
  if(/\b(?:fix|broken|doesn'?t work|not working|issue|laggy|wonky|removed|missing|prevent|too small|error)\b/.test(value))return "problem";
  if(/\b(?:ui|layout|look like|smaller|shorter|spacing|colour|color|outline|border|icon|animation|screen|panel|button|title bar)\b/.test(value))return "quick change";
  if(/\b(?:look into|research|check out|ask |download|remember|find a way|investigate|learn more|grab |refer to)\b/.test(value))return "task";
  return "feature";
}
function bucketFor(text,refs,source){
  const value=visibleText(text).toLowerCase(),appHeavySource=/Second|Third/i.test(String(source||"")),directApp=/\b(?:sinrad|s\.i\.r|norma|parking lot|screenies|vault|website tracker|rad\s+\w+|pet\s+(?:dock|floating|pop|quick)|link to my google drive account|mods? categor\w* (?:in|and) folders?)\b/.test(value),explicitApp=/\b(?:(?:for|in|to)\s+(?:the|my|this)\s+app|app\s+(?:should|feature|button|tab|module|settings?))\b/.test(value);let appScore=0;
  if(directApp)appScore+=3;
  if(directApp||explicitApp)return "app";
  if(/\b(?:character|mc|story|dream|artifact|skill|ability|weapon|scene|world|fair(?:y|ies)|new project|anime|mods?|modding|discord server|server backup|google drive account|vpn|burner account|temp mail|lovers lab|nikke|nahida\.live)\b/.test(value))return "other";
  if(/\b(?:module|settings?\s+(?:tab|option|menu)|app\s+(?:boot|close|open|update|window)|update\s+(?:button|screen|installer)|browser\s+extension|extension\s+(?:folder|access)|console|hotkey|ctrl\s+alt\s+p|links?\s+(?:tab|module|storage)|folders?\s+module|screenshot\s+(?:manager|module)|screenies|notification)\b/.test(value))appScore+=2;
  if(/\b(?:software|password manager|link saver|auto\s*start|taskbar|global pause|music player|bgm|boot\s*(?:up|video|screen)|right.click menu|recently visited)\b/.test(value))appScore+=1;
  if(appHeavySource&&/\b(?:app|software|module|tab|settings?|links?|folders?|website|passwords?|player|gifs?|music|update|quick controls?|pop.?out|screenshots?|favorites?|categor(?:y|ies)|search|extension|console|hotkey|notification|startup|boot|taskbar|right.click|double.click|daily news|reminder|local storage|eject|autoplay|mode)\b/.test(value))appScore+=2;
  if(appScore>=2)return "app";
  const vague=/^(?:visual reference idea|use this|use these|try this|try out this idea|do something with|have to put this|you already know|look interesting|these look interesting|could be useful|gotta add this|add this|remember this|check this|refer to|nice looking|halo|ears|to be used|found some more)\b/i;
  if((vague.test(value)&&value.length<110)||value.length<6||(value.length<12&&refs.length)||(!value&&refs.length))return "unsorted";
  return "other";
}
function unsafeBlock(text){
  if(sensitive.test(text)||secretShape.test(text))return "sensitive";
  const compact=String(text).replace(/\s/g,"");if(compact.length>220&&((compact.match(/[▓▒░█]/g)||[]).length/compact.length)>.35)return "ascii";
  return "";
}
function splitBlocks(raw){
  const lines=String(raw).replace(/^\uFEFF/,"").replace(/\r/g,"").split("\n"),blocks=[];let current=[];
  function push(){if(current.some(function(line){return line.trim();}))blocks.push(current.join("\n").trim());current=[];}
  lines.forEach(function(line){
    const bullet=line.match(/^\s{0,2}(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    if(bullet){push();current=[bullet[1]];return;}
    if(!line.trim()){push();return;}
    if(/^\s{3,}(?:[-*+]\s+|\d+[.)]\s+)/.test(line)&&current.length){current.push(line.trim());return;}
    current.push(line);
  });push();return blocks;
}
function extract(file){
  const raw=fs.readFileSync(file,"utf8"),blocks=splitBlocks(raw),items=[];let excludedSensitive=0,excludedNoise=0;
  blocks.forEach(function(block){
    const unsafe=unsafeBlock(block);if(unsafe==="sensitive"){excludedSensitive++;return;}if(unsafe==="ascii"){excludedNoise++;return;}
    const refs=references(block),text=visibleText(block);
    if(!text||ignoreOnly.test(text)||(/^\d{8,}$/.test(text))){if(refs.length&&items.length)items[items.length-1].references=Array.from(new Set(items[items.length-1].references.concat(refs)));else excludedNoise++;return;}
    if(text.length<5&&!refs.length){excludedNoise++;return;}
    if(/^(?:for a truly glitchy|up:|down:|middle:)/i.test(text)&&items.length&&/zalgo/i.test(items[items.length-1].title)){items[items.length-1].details+="\n\n"+block.trim();items[items.length-1].references=Array.from(new Set(items[items.length-1].references.concat(refs)));return;}
    const source=path.basename(file);items.push({title:titleFor(block),type:typeFor(block),details:block.trim(),references:refs,source:source,bucket:bucketFor(block,refs,source)});
  });
  return {file:file,items:items,excludedSensitive:excludedSensitive,excludedNoise:excludedNoise};
}
function safeMarkdown(value){return String(value).replace(/\r/g,"");}
function importType(type){return type==="problem"?"problem":type==="quick change"?"quick change":type==="task"?"task":"feature";}

const fileIndex=new Map();
function indexFiles(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(entry.name===".obsidian"||entry.name===".stfolder")continue;const full=path.join(folder,entry.name);if(entry.isDirectory())indexFiles(full);else{const relative=path.relative(vaultRoot,full).replace(/\\/g,"/").toLowerCase(),base=entry.name.toLowerCase();fileIndex.set(relative,full);if(!fileIndex.has(base))fileIndex.set(base,full);}}}
indexFiles(vaultRoot);
function resolveAttachment(ref){if(/^https?:\/\//i.test(ref))return "";const clean=String(ref||"").split("#")[0].replace(/\\/g,"/").replace(/^\.\//,"").toLowerCase();return fileIndex.get(clean)||fileIndex.get(path.basename(clean))||"";}
function markdownTarget(file){return "/"+path.resolve(file).replace(/\\/g,"/");}
function renderedDetails(item){
  return safeMarkdown(item.details).replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,function(full,ref){const resolved=resolveAttachment(ref);return resolved?"!["+ref+"](<"+markdownTarget(resolved)+">)":"`Missing attachment: "+ref+"`";});
}

const groups=inputs.map(extract),all=groups.flatMap(function(group){return group.items;}),sensitiveCount=groups.reduce(function(sum,group){return sum+group.excludedSensitive;},0),noiseCount=groups.reduce(function(sum,group){return sum+group.excludedNoise;},0),buckets={app:[],other:[],unsorted:[]};
all.forEach(function(item){buckets[item.bucket].push(item);});
fs.mkdirSync(outputRoot,{recursive:true});

let preview="# Sorted Obsidian ideas preview\n\nNothing in this preview has been added to SINRAD.\n\n";
preview+="- App ideas: **"+buckets.app.length+"**\n- Other ideas: **"+buckets.other.length+"**\n- Unsorted ideas: **"+buckets.unsorted.length+"**\n- Total: **"+all.length+"**\n- Sensitive credential sections excluded: **"+sensitiveCount+"**\n\nOpen a category below to review every original note and its media.\n\n- [App ideas](<app-ideas.md>)\n- [Other ideas](<other-ideas.md>)\n- [Unsorted ideas](<unsorted-ideas.md>)\n";
fs.writeFileSync(path.join(outputRoot,"obsidian-ideas-preview.md"),preview,"utf8");

const labels={app:"App ideas",other:"Other ideas",unsorted:"Unsorted ideas"},batchSize=80,batches=[],attachmentManifest=[];
Object.keys(buckets).forEach(function(bucket){let page="# "+labels[bucket]+"\n\nNothing on this page has been imported.\n\n";buckets[bucket].forEach(function(item,index){page+="## "+(index+1)+". "+safeMarkdown(item.title)+"\n\n- Type: "+item.type+"\n- Source: `"+item.source+"`\n"+(item.references.length?"- References: "+item.references.map(function(ref){const resolved=resolveAttachment(ref);return resolved?"["+ref+"](<"+markdownTarget(resolved)+">)":"`"+ref.replace(/`/g,"'")+"`";}).join(", ")+"\n":"")+"\n<details><summary>Original note and media</summary>\n\n"+renderedDetails(item)+"\n\n</details>\n\n";item.references.filter(function(ref){return !/^https?:\/\//i.test(ref);}).forEach(function(ref){attachmentManifest.push({bucket:bucket,title:item.title,reference:ref,path:resolveAttachment(ref)||null});});});fs.writeFileSync(path.join(outputRoot,bucket+"-ideas.md"),page,"utf8");
  for(let start=0;start<buckets[bucket].length;start+=batchSize){const batch=buckets[bucket].slice(start,start+batchSize);let text="SINRAD_IDEAS_V1\n\n";text+=batch.map(function(item){const refs=Array.from(new Set(item.references.concat([item.source])));return ["IDEA","TITLE: "+item.title,"TYPE: "+importType(item.type),"TAG: "+bucket,"DETAILS: "+item.details.replace(/\r?\n/g," ").replace(/\s+/g," ").trim(),"REFERENCES: "+refs.join(" | ")].join("\n");}).join("\n---\n");text+="\n";const name=bucket+"-ideas-import-part-"+(Math.floor(start/batchSize)+1)+".txt";fs.writeFileSync(path.join(outputRoot,name),text,"utf8");batches.push(name);}
});
const attachmentsFound=attachmentManifest.filter(function(item){return item.path;}).length,attachmentsMissing=attachmentManifest.length-attachmentsFound;
fs.writeFileSync(path.join(outputRoot,"obsidian-ideas-attachments.json"),JSON.stringify(attachmentManifest,null,2),"utf8");
const importItems=all.map(function(item){const attachments=item.references.filter(function(ref){return !/^https?:\/\//i.test(ref);}).map(function(ref){return {name:ref,path:resolveAttachment(ref)||""};}).filter(function(media){return !!media.path;});const key=crypto.createHash("sha256").update(item.source+"\0"+item.details).digest("hex");return {importKey:"obsidian:"+key,title:item.title,type:importType(item.type),group:item.bucket,details:item.details,original:item.details,references:Array.from(new Set(item.references.concat([item.source]))),source:item.source,attachments:attachments};});
fs.writeFileSync(path.join(outputRoot,"obsidian-ideas-import.json"),JSON.stringify({format:"sinrad-obsidian-ideas-v1",created:new Date().toISOString(),items:importItems},null,2),"utf8");
fs.writeFileSync(path.join(outputRoot,"obsidian-ideas-summary.json"),JSON.stringify({total:all.length,categories:{app:buckets.app.length,other:buckets.other.length,unsorted:buckets.unsorted.length},attachments:{found:attachmentsFound,missing:attachmentsMissing},sources:groups.map(function(group){return {file:group.file,count:group.items.length,excludedSensitive:group.excludedSensitive,excludedNoise:group.excludedNoise};}),batches:batches},null,2),"utf8");
console.log(JSON.stringify({total:all.length,categories:{app:buckets.app.length,other:buckets.other.length,unsorted:buckets.unsorted.length},attachments:{found:attachmentsFound,missing:attachmentsMissing},sensitiveExcluded:sensitiveCount,noiseExcluded:noiseCount,batches:batches},null,2));
