"use strict";

function cleanSubreddit(value){
  const name = String(value || "").trim().replace(/^r\//i, "");
  if(!/^[A-Za-z0-9_]{2,21}$/.test(name)) throw new Error("Enter a valid subreddit name");
  return name;
}

function cleanUsername(value){
  const name = String(value || "").trim().replace(/^\/?u\//i, "");
  if(!/^[A-Za-z0-9_-]{3,20}$/.test(name)) throw new Error("Enter your Reddit username");
  return name;
}

function userAgent(username, version){
  return "windows:com.sinrad.desktop:v"+String(version||"0.0.0")+" (by /u/"+cleanUsername(username)+")";
}

function authorizationUrl(clientId, state, redirectUri){
  const id = String(clientId || "").trim();
  if(!/^[A-Za-z0-9_-]{5,80}$/.test(id)) throw new Error("Enter a valid Reddit client ID");
  const url = new URL("https://www.reddit.com/api/v1/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", String(state || ""));
  url.searchParams.set("redirect_uri", String(redirectUri || ""));
  url.searchParams.set("duration", "permanent");
  url.searchParams.set("scope", "identity read");
  return url.toString();
}

function redditMediaUrl(value){
  try{
    const url = new URL(String(value || ""));
    if(url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    const redditAvatar=host==="www.redditstatic.com"&&url.pathname.startsWith("/avatars/");
    const imageHost=["i.redd.it","preview.redd.it","external-preview.redd.it","styles.redditmedia.com"].includes(host)||redditAvatar;
    const videoHost=["v.redd.it","packaged-media.redd.it"].includes(host)&&/\.(?:mp4|webm)$/i.test(url.pathname);
    if(!imageHost&&!videoHost) return "";
    return url.toString();
  }catch(_){ return ""; }
}

function postMediaUrls(post){
  const data = post || {};
  const out = [];
  function add(value){ const safe=redditMediaUrl(value); if(safe && !out.includes(safe)) out.push(safe); }
  add(data.url_overridden_by_dest);
  add(data.secure_media && data.secure_media.reddit_video && data.secure_media.reddit_video.fallback_url);
  add(data.media && data.media.reddit_video && data.media.reddit_video.fallback_url);
  add(data.thumbnail);
  const images = data.preview && Array.isArray(data.preview.images) ? data.preview.images : [];
  images.forEach(function(image){
    add(image && image.source && image.source.url);
    const resolutions = image && Array.isArray(image.resolutions) ? image.resolutions : [];
    if(resolutions.length) add(resolutions[Math.min(resolutions.length-1, 3)].url);
  });
  return out.slice(0, 20);
}

function normalizePost(post, source, now){
  const data = post && post.data ? post.data : post || {};
  const redditId = String(data.name || (data.id ? "t3_"+data.id : ""));
  if(!/^t3_[A-Za-z0-9]+$/.test(redditId)) return null;
  const permalink = String(data.permalink || "");
  return {
    sourceKey:"reddit:"+redditId,
    sourceId:source.id,
    platform:"reddit",
    community:"r/"+String(data.subreddit || source.handle),
    title:String(data.title || "Untitled Reddit post"),
    author:String(data.author || "[deleted]"),
    content:String(data.selftext || ""),
    date:Number(data.created_utc || 0) * 1000 || now,
    url:permalink ? "https://www.reddit.com"+permalink : "https://www.reddit.com/r/"+encodeURIComponent(source.handle),
    downloadedAt:now,
    updatedAt:now,
    score:Number(data.score || 0),
    commentCount:Number(data.num_comments || 0),
    mediaUrls:postMediaUrls(data),
    media:[],
    comments:[]
  };
}

function parseListing(payload, source, now){
  const children = payload && payload.data && Array.isArray(payload.data.children) ? payload.data.children : [];
  return children.map(function(post){return normalizePost(post, source, now || Date.now());}).filter(Boolean);
}

function parseComments(payload, limit){
  const listing = Array.isArray(payload) ? payload[1] : null;
  const children = listing && listing.data && Array.isArray(listing.data.children) ? listing.data.children : [];
  return children.filter(function(entry){return entry && entry.kind === "t1" && entry.data && entry.data.body;}).slice(0, Math.max(0, Math.min(5, Number(limit)||0))).map(function(entry){
    return {author:String(entry.data.author || "[deleted]"), body:String(entry.data.body || ""), score:Number(entry.data.score || 0)};
  });
}

module.exports = { cleanSubreddit, cleanUsername, userAgent, authorizationUrl, redditMediaUrl, normalizePost, parseListing, parseComments };
