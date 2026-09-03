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
  function smartLinkCategories(value,fallback,rules) {
    const automatic=automaticLinkCategories(value,fallback),raw=String(value||"").toLowerCase();
    let smart="";
    (Array.isArray(rules)?rules:[]).some(function(rule){
      const pattern=String(rule&&rule.pattern||"").trim().toLowerCase(),category=String(rule&&rule.category||"").trim();
      if(pattern&&category&&raw.indexOf(pattern)>=0){smart=category;return true;}
      return false;
    });
    if(!smart)return automatic;
    const youtube=automatic.main==="YouTube";
    const main=youtube?"YouTube":smart;
    return {main:main,all:Array.from(new Set([main,smart].concat(automatic.all).filter(Boolean)))};
  }
  function exactDuplicateGroups(links) {
    const groups=new Map();
    (Array.isArray(links)?links:[]).forEach(function(link){const key=savedUrlIdentity(link&&link.url);if(!key)return;(groups.get(key)||groups.set(key,[]).get(key)).push(link);});
    return Array.from(groups.values()).filter(function(group){return group.length>1;});
  }
  function mergeExactDuplicates(links) {
    const input=Array.isArray(links)?links:[],groups=exactDuplicateGroups(input),removed=new Set();
    groups.forEach(function(group){
      const keep=group[0],categories=[];
      group.forEach(function(link){
        [link.category].concat(Array.isArray(link.categories)?link.categories:[]).filter(Boolean).forEach(function(category){if(categories.indexOf(category)<0)categories.push(category);});
        if(link!==keep)removed.add(link);
      });
      keep.favorite=group.some(function(link){return !!link.favorite;});
      keep.inLinks=group.some(function(link){return !!link.inLinks;});
      keep.note=keep.note||((group.find(function(link){return !!link.note;})||{}).note)||"";
      keep.opens=group.reduce(function(total,link){return total+(Number(link.opens)||0);},0);
      const youtube=automaticLinkCategory(keep.url,"")==="YouTube";
      keep.category=youtube?"YouTube":(keep.category||categories[0]||"");
      keep.categories=Array.from(new Set((youtube?["YouTube"]:[]).concat(categories,keep.category||[]).filter(Boolean)));
    });
    return {links:input.filter(function(link){return !removed.has(link);}),groups:groups.length,removed:removed.size};
  }
  function primarySelection(values) {
    return Array.isArray(values)&&values.length?String(values[0]||""):"";
  }
  function removeLinkCategory(link,name) {
    if(!link||typeof link!=="object")return link;
    name=String(name||"");
    const current=String(link.category||"");
    const existing=Array.isArray(link.categories)?link.categories.map(String):[];
    if(current!==name&&existing.indexOf(name)<0)return link;
    const remaining=Array.from(new Set(existing.filter(function(category){return category&&category!==name;})));
    link.category=current===name?(remaining[0]||""):current;
    if(link.category&&remaining.indexOf(link.category)<0)remaining.unshift(link.category);
    link.categories=remaining;
    return link;
  }
  function isParkedLink(link) {
    return !!(link&&link.src==="park"&&!link.inLinks);
  }
  function buildGlobalSearchIndex(data) {
    data=data&&typeof data==="object"?data:{};
    function add(kind,view,item,title,detail,values){
      title=String(title||"Untitled");detail=String(detail||"");
      const hay=values.map(function(value){return String(value||"").toLowerCase();}).join("\n");
      index.push({kind:kind,view:view,id:String(item&&item.id||""),title:title,detail:detail,hay:hay,created:Number(item&&item.created)||0});
    }
    const index=[];
    (Array.isArray(data.vault)?data.vault:[]).forEach(function(item){add("Vault","vault",item,item.name,item.username||item.url,[item.name,item.url,item.username]);});
    (Array.isArray(data.links)?data.links:[]).forEach(function(item){const parked=isParkedLink(item);add(parked?"Parking Lot":"Links",parked?"lot":"links",item,item.title,item.url,[item.title,item.url,item.note,item.category].concat(Array.isArray(item.categories)?item.categories:[]));});
    (Array.isArray(data.folders)?data.folders:[]).forEach(function(item){add("Folders","folders",item,item.name||item.path,item.path,[item.name,item.path,item.category]);});
    (Array.isArray(data.shots)?data.shots:[]).forEach(function(item){add("Screenies","shots",item,item.name||item.path,item.collection||item.path,[item.name,item.path,item.collection]);});
    return index;
  }
  function searchGlobalIndex(index,query,limit) {
    const raw=String(query||"").trim(),tokens=raw.toLowerCase().split(/\s+/).filter(Boolean);
    if(!tokens.length)return [];
    const needle=raw.toLowerCase(),found=[];
    (Array.isArray(index)?index:[]).forEach(function(item){
      if(!tokens.every(function(token){return item.hay.indexOf(token)>=0;}))return;
      const lowerTitle=item.title.toLowerCase();
      const score=(lowerTitle.indexOf(needle)===0?100:lowerTitle.indexOf(needle)>=0?50:0)+item.created/1e15;
      found.push({kind:item.kind,view:item.view,id:item.id,title:item.title,detail:item.detail,score:score});
    });
    found.sort(function(a,b){return b.score-a.score||a.title.localeCompare(b.title);});
    return found.slice(0,Math.max(1,Math.min(50,Number(limit)||24))).map(function(item){delete item.score;return item;});
  }
  function globalSearch(data,query,limit) { return searchGlobalIndex(buildGlobalSearchIndex(data),query,limit); }
  return { savedUrlIdentity: savedUrlIdentity, normalizeWebUrl: normalizeWebUrl, normalizeVaultDraft: normalizeVaultDraft, automaticLinkCategory: automaticLinkCategory, automaticLinkCategories: automaticLinkCategories, smartLinkCategories: smartLinkCategories, exactDuplicateGroups: exactDuplicateGroups, mergeExactDuplicates: mergeExactDuplicates, primarySelection: primarySelection, removeLinkCategory: removeLinkCategory, isParkedLink: isParkedLink, buildGlobalSearchIndex: buildGlobalSearchIndex, searchGlobalIndex: searchGlobalIndex, globalSearch: globalSearch };
});
