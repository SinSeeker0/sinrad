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
  return { savedUrlIdentity: savedUrlIdentity, normalizeWebUrl: normalizeWebUrl, normalizeVaultDraft: normalizeVaultDraft, automaticLinkCategory: automaticLinkCategory, automaticLinkCategories: automaticLinkCategories };
});
