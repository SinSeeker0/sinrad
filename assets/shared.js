(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SinradShared = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function savedUrlIdentity(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      return url.toString();
    } catch (_) { return ""; }
  }
  function normalizeWebUrl(value) {
    let raw=String(value==null?"":value).trim();
    if(!raw)return "";
    try{
      if(raw.indexOf("www.")===0)raw="https://"+raw;
      if(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw))raw="https://"+raw;
      const url=new URL(raw);
      return url.protocol==="http:"||url.protocol==="https:"?url.toString():"";
    }catch(_){return "";}
  }
  function normalizeVaultDraft(draft) {
    draft=draft&&typeof draft==="object"?draft:{};
    let name=String(draft.name==null?"":draft.name).trim();
    const rawUrl=String(draft.url==null?"":draft.url).trim();
    const url=rawUrl?normalizeWebUrl(rawUrl):"";
    if(rawUrl&&!url)return {ok:false,error:"Website must be an http(s) URL"};
    const username=String(draft.username==null?"":draft.username).trim(),password=String(draft.password==null?"":draft.password);
    if(!name){try{name=url?new URL(url).hostname.replace(/^www\./,""):"";}catch(_){} name=name||username||((password||draft.favorite||draft.priority)?"Untitled entry":"");}
    if(!name)return {ok:false,error:"Enter at least one detail before saving"};
    return {ok:true,value:{name:name,url:url,username:username,password:password,favorite:!!draft.favorite,priority:!!draft.priority}};
  }
  function automaticLinkCategory(value,fallback) {
    try {
      const host=new URL(String(value||"")).hostname.toLowerCase().replace(/^www\./,"");
      if(host==="youtu.be"||host==="youtube.com"||host.endsWith(".youtube.com"))return "YouTube";
    } catch (_) {}
    return String(fallback||"");
  }
  function automaticLinkCategories(value,fallback) {
    const prior=String(fallback||"");
    const main=automaticLinkCategory(value,prior);
    return {main:main,all:Array.from(new Set([main,prior].filter(Boolean)))};
  }
  function primarySelection(values) {
    return Array.isArray(values)&&values.length?String(values[0]||""):"";
  }
  function globalSearch(data,query,limit) {
    data=data&&typeof data==="object"?data:{};
    const raw=String(query||"").trim(),tokens=raw.toLowerCase().split(/\s+/).filter(Boolean);
    if(!tokens.length)return [];
    const found=[];
    function add(kind,view,item,title,detail,values){
      title=String(title||"Untitled");detail=String(detail||"");
      const hay=values.map(function(value){return String(value||"").toLowerCase();}).join("\n");
      if(!tokens.every(function(token){return hay.indexOf(token)>=0;}))return;
      const lowerTitle=title.toLowerCase(),needle=raw.toLowerCase();
      const score=(lowerTitle.indexOf(needle)===0?100:lowerTitle.indexOf(needle)>=0?50:0)+(Number(item&&item.created)||0)/1e15;
      found.push({kind:kind,view:view,id:String(item&&item.id||""),title:title,detail:detail,score:score});
    }
    (Array.isArray(data.vault)?data.vault:[]).forEach(function(item){add("Vault","vault",item,item.name,item.username||item.url,[item.name,item.url,item.username]);});
    (Array.isArray(data.links)?data.links:[]).forEach(function(item){const parked=item.src==="park"&&!item.category&&!item.inLinks;add(parked?"Parking Lot":"Links",parked?"lot":"links",item,item.title,item.url,[item.title,item.url,item.note,item.category].concat(Array.isArray(item.categories)?item.categories:[]));});
    (Array.isArray(data.folders)?data.folders:[]).forEach(function(item){add("Folders","folders",item,item.name||item.path,item.path,[item.name,item.path,item.category]);});
    (Array.isArray(data.shots)?data.shots:[]).forEach(function(item){add("Screenies","shots",item,item.name||item.path,item.collection||item.path,[item.name,item.path,item.collection]);});
    found.sort(function(a,b){return b.score-a.score||a.title.localeCompare(b.title);});
    return found.slice(0,Math.max(1,Math.min(50,Number(limit)||24))).map(function(item){delete item.score;return item;});
  }
  return { savedUrlIdentity: savedUrlIdentity, normalizeWebUrl: normalizeWebUrl, normalizeVaultDraft: normalizeVaultDraft, automaticLinkCategory: automaticLinkCategory, automaticLinkCategories: automaticLinkCategories, primarySelection: primarySelection, globalSearch: globalSearch };
});
