// S.I.R Quick Save — background service worker
// Sends page URL + title to the S.I.R desktop app's localhost server

const PORT = 47821;
const BASES = ['http://127.0.0.1:' + PORT, 'http://localhost:' + PORT];
const BRIDGE_KEY = '__SINRAD_BRIDGE_KEY__';
let sessionToken = '';
let sessionBase = '';

function reloadForExtensionUpdate(response) {
  const expected = response && response.headers && response.headers.get('X-Sinrad-Extension-Version');
  const loaded = chrome.runtime.getManifest().version;
  if (!expected || expected === loaded) return false;
  chrome.action.setBadgeBackgroundColor({ color: '#f5a623' });
  chrome.action.setBadgeText({ text: '↻' });
  setTimeout(() => chrome.runtime.reload(), 50);
  return true;
}

function setStatus(ok) {
  chrome.action.setBadgeBackgroundColor({ color: ok ? '#168a45' : '#c62828' });
  chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

async function getToken() {
  if (sessionToken && sessionBase) return sessionToken;
  let lastError = null;
  for (const base of BASES) {
    try {
      const response = await fetch(base + '/token', { cache: 'no-store', headers: { 'X-Sinrad-Bridge-Key': BRIDGE_KEY } });
      if (reloadForExtensionUpdate(response)) throw new Error('S.I.R extension updated. Try again in a moment.');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data.token) throw new Error('token missing');
      sessionToken = data.token;
      sessionBase = base;
      return sessionToken;
    } catch (error) { lastError = error; }
  }
  throw new Error('Sinrad token request failed' + (lastError && lastError.message ? ': ' + lastError.message : ''));
}

async function authorizedRequest(route, options) {
  let token = await getToken();
  const request = Object.assign({}, options || {});
  request.method = request.method || 'POST';
  request.headers = Object.assign({}, request.headers || {}, { 'X-Sinrad-Token': token, 'X-Sinrad-Bridge-Key': BRIDGE_KEY });
  let response = await fetch(sessionBase + route, request);
  if (reloadForExtensionUpdate(response)) throw new Error('S.I.R extension updated. Try again in a moment.');
  if (response.status === 401) {
    sessionToken = '';
    sessionBase = '';
    token = await getToken();
    request.headers = Object.assign({}, request.headers, { 'X-Sinrad-Token': token, 'X-Sinrad-Bridge-Key': BRIDGE_KEY });
    response = await fetch(sessionBase + route, request);
    if (reloadForExtensionUpdate(response)) throw new Error('S.I.R extension updated. Try again in a moment.');
  }
  let result = null;
  try { result = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(result && result.error || 'Sinrad rejected the save');
  if (!result.ok) throw new Error(result.error || 'Save failed');
  return result;
}

async function postJson(route, payload) {
  return authorizedRequest(route, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

async function postToSinrad(payload) {
  await postJson('/park', payload);
  setStatus(true);
  return true;
}

async function saveToSinrad(url, title, lot) {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('Only web URLs can be saved');
  return postToSinrad({ url, title: title || '', lot: !!lot });
}

async function saveBatchToSinrad(tabs) {
  const safeTabs = (tabs || []).filter((tab) => /^https?:\/\//i.test(tab && tab.url || '')).map((tab) => ({ url: tab.url, title: tab.title || '' }));
  if (!safeTabs.length) throw new Error('No web tabs to park');
  return postToSinrad({ tabs: safeTabs, lot: true });
}

function notifyUnavailable(error) {
  setStatus(false);
  chrome.notifications.create('sinrad-err-' + Date.now(), {
    type: 'basic', iconUrl: 'icon.png', title: 'S.I.R not connected',
    message: (error && error.message) || 'Start Sinrad, then try again', priority: 1, silent: true
  });
}

function saveOne(url, title, lot) {
  return saveToSinrad(url, title, lot).catch((error) => {
    notifyUnavailable(error);
    throw error;
  });
}

function captureMhtml(tabId) {
  return new Promise((resolve, reject) => {
    chrome.pageCapture.saveAsMHTML({ tabId }, (blob) => {
      const error = chrome.runtime.lastError;
      if (error || !blob) reject(new Error(error && error.message || 'The browser could not capture this page'));
      else resolve(blob);
    });
  });
}

function collectPageMetadata() {
  function clean(value, maximum) {
    return String(value == null ? '' : value).replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, maximum);
  }
  function block(value, maximum) {
    return String(value == null ? '' : value).replace(/\0/g, '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maximum);
  }
  function meta(name) {
    const node = document.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]');
    return node ? clean(node.content, 4000) : '';
  }
  const host = location.hostname.toLowerCase();
  const isReddit = host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'redd.it' || host.endsWith('.redd.it');
  const post = document.querySelector('shreddit-post[post-title],shreddit-post,[data-testid="post-container"],main article,article');
  function attribute(name) { return post && post.getAttribute ? clean(post.getAttribute(name), 4000) : ''; }
  function postNode(selector) { try { return post && post.querySelector(selector); } catch (_) { return null; } }
  function nodeText(selector) { const node = postNode(selector); return node ? block(node.innerText || node.textContent, 30000) : ''; }
  function richContentBlocks(root) {
    if (!root) return [];
    const blocks = [];
    function runsFor(node) {
      const runs = [];
      function add(value, marks) {
        const valueText = String(value || '').replace(/\s+/g, ' ');
        if (!valueText) return;
        const previous = runs[runs.length - 1],next = {text:valueText,bold:!!marks.bold,italic:!!marks.italic,code:!!marks.code};
        if (previous && previous.bold === next.bold && previous.italic === next.italic && previous.code === next.code) previous.text += next.text;
        else runs.push(next);
      }
      function walk(current, marks) {
        if (!current) return;
        if (current.nodeType === Node.TEXT_NODE) { add(current.nodeValue, marks);return; }
        if (current.nodeType !== Node.ELEMENT_NODE) return;
        const tag = current.tagName.toLowerCase();
        if (tag === 'br') { add('\n', marks);return; }
        if (tag === 'ul' || tag === 'ol') return;
        const next = {bold:marks.bold || tag === 'strong' || tag === 'b',italic:marks.italic || tag === 'em' || tag === 'i',code:marks.code || tag === 'code'};
        Array.from(current.childNodes || []).forEach((child) => walk(child, next));
      }
      walk(node, {});
      if (runs.length) { runs[0].text = runs[0].text.replace(/^\s+/, '');runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, ''); }
      return runs.filter((run) => run.text).slice(0, 80);
    }
    function push(type, node, extra) { const runs = runsFor(node);if (runs.length && blocks.length < 300) blocks.push(Object.assign({type, runs}, extra || {})); }
    function walkList(list, depth) {
      const ordered = list.tagName.toLowerCase() === 'ol';let index = 0;
      Array.from(list.children || []).forEach((item) => {
        if (item.tagName.toLowerCase() !== 'li') return;index++;
        push('listItem', item, {ordered, index, depth});
        Array.from(item.children || []).filter((child) => /^(ul|ol)$/i.test(child.tagName)).forEach((child) => walkList(child, depth + 1));
      });
    }
    function walkBlocks(container) {
      Array.from(container.children || []).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'p') push('paragraph', child);
        else if (/^h[1-6]$/.test(tag)) push('heading', child, {level:Number(tag.slice(1)) || 1});
        else if (tag === 'ul' || tag === 'ol') walkList(child, 0);
        else if (tag === 'blockquote') push('quote', child);
        else if (tag === 'pre') push('code', child);
        else walkBlocks(child);
      });
    }
    walkBlocks(root);if (!blocks.length) push('paragraph', root);
    return blocks;
  }

  let title = attribute('post-title') || nodeText('h1') || meta('og:title') || clean(document.title, 1000);
  let author = attribute('author') || attribute('post-author') || nodeText('[data-testid="post_author_link"],a[href*="/user/"]');
  author = clean(author.replace(/^\/?u\//i, ''), 200);
  let community = attribute('subreddit-prefixed-name') || nodeText('[data-testid="subreddit-name"],a[href^="/r/"]');
  const communityMatch = location.pathname.match(/\/r\/([A-Za-z0-9_]{2,21})/i);
  if (!community && communityMatch) community = 'r/' + communityMatch[1];
  community = clean(community, 120);
  const contentNode = postNode('[id$="-post-rtjson-content"],shreddit-post-text-body [data-post-click-location="text-body"],shreddit-post-text-body [slot="text-body"],shreddit-post-text-body .md,[data-post-click-location="text-body"] > .md');
  let content = contentNode ? block(contentNode.innerText || contentNode.textContent, 30000) : '';
  if (!content && !isReddit) content = clean(meta('og:description') || meta('description'), 30000);
  const contentBlocks = richContentBlocks(contentNode);
  const rawDate = attribute('created-timestamp') || (postNode('time[datetime]') && postNode('time[datetime]').getAttribute('datetime')) || '';
  const parsedDate = Date.parse(rawDate);
  const score = Number(attribute('score').replace(/[^0-9-]/g, '')) || 0;
  const commentCount = Number((attribute('comment-count') || attribute('comments-count')).replace(/[^0-9]/g, '')) || 0;

  const candidates = new Map();
  let mediaOrder = 0;
  function addMedia(value, tier) {
    let raw = String(value || '').replace(/&amp;/g, '&').trim();
    if (!raw) return;
    if (/\s/.test(raw)) raw = raw.split(/\s+/).filter((part) => /^https?:\/\//i.test(part)).pop() || raw;
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== 'https:') return;
      const mediaHost = url.hostname.toLowerCase();
      let rank = Number(tier) || 0;
      if (['i.redd.it', 'preview.redd.it', 'external-preview.redd.it'].includes(mediaHost)) rank += 10000;
      if (/avatar|emoji|icon|award|profile/i.test(url.pathname)) rank -= 50000;
      const href = url.toString();
      const kind = /\.(?:mp4|webm)$/i.test(url.pathname) ? 'video' : 'image';
      const key = mediaHost + url.pathname;
      const previous = candidates.get(key);
      if (!previous || previous.rank < rank) candidates.set(key, { href, rank, kind, order: previous ? previous.order : mediaOrder++ });
    } catch (_) {}
  }
  const roots = post ? [post] : [];
  if (post) {
    for (let rootIndex = 0; rootIndex < roots.length && rootIndex < 80; rootIndex++) {
      let nodes = [];
      try { nodes = Array.from(roots[rootIndex].querySelectorAll('*')).slice(0, 6000); } catch (_) {}
      nodes.forEach((node) => { if (node.shadowRoot && roots.length < 80) roots.push(node.shadowRoot); });
    }
    const primarySelector = '.media-lightbox-img,img[id^="post-image"],[slot="post-media-container"] figure img,gallery-carousel figure img,[data-testid="post-media"] img,video,shreddit-player';
    roots.forEach((root) => {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll(primarySelector)); } catch (_) {}
      nodes.forEach((node) => {
        if (node.getAttribute && (node.getAttribute('role') === 'presentation' || /post-background|avatar|emoji/i.test(node.className || node.alt || ''))) return;
        const tag = String(node.tagName || '').toLowerCase();
        if (tag === 'shreddit-player') {
          try {
            const packaged = JSON.parse(node.getAttribute('packaged-media-json') || '{}'),permutations = packaged && packaged.playbackMp4s && Array.isArray(packaged.playbackMp4s.permutations) ? packaged.playbackMp4s.permutations : [];
            const choices = permutations.map((entry) => entry && entry.source).filter((source) => source && source.url).sort((a, b) => Number(b.dimensions && b.dimensions.height || 0) - Number(a.dimensions && a.dimensions.height || 0));
            const preferred = choices.find((source) => Number(source.dimensions && source.dimensions.height || 0) <= 720) || choices[0];if (preferred) addMedia(preferred.url, 80000);
          } catch (_) {}
          addMedia(node.getAttribute('preview'), 65000);return;
        }
        if (tag === 'video') { addMedia(node.currentSrc || node.src || node.getAttribute('src'), 70000);addMedia(node.poster || node.getAttribute('poster'), 50000);return; }
        addMedia(node.currentSrc || node.src || node.getAttribute('src') || node.getAttribute('data-src'), 50000);
        const srcset = node.getAttribute && node.getAttribute('srcset');
        if (srcset) addMedia(srcset.split(',').pop().trim().split(/\s+/)[0], 50000);
      });
    });
    ['thumbnail', 'preview', 'poster'].forEach((name) => {
      const value = attribute(name);
      addMedia(value, 20000);
      const matches = value.match(/https?:[^"'\s\\]+/g) || [];
      matches.forEach((match) => addMedia(match.replace(/\\u0026/g, '&').replace(/\\\//g, '/'), 20000));
    });
    if (!Array.from(candidates.values()).some((entry) => entry.rank >= 50000)) roots.forEach((root) => {
      let nodes = [];
      try { nodes = Array.from(root.querySelectorAll('img,video[poster],source[src],[data-src]')).slice(0, 5000); } catch (_) {}
      nodes.forEach((node) => {
        if (/avatar|emoji|icon|award|profile|post-background/i.test(String(node.className || '') + ' ' + String(node.alt || ''))) return;
        const width = Number(node.naturalWidth || node.videoWidth || node.width || 0),height = Number(node.naturalHeight || node.videoHeight || node.height || 0);
        if (width && height && width < 240 && height < 240) return;
        addMedia(node.poster || node.currentSrc || node.src || node.getAttribute('src') || node.getAttribute('data-src'), 1000);
        const srcset = node.getAttribute && node.getAttribute('srcset');
        if (srcset) addMedia(srcset.split(',').pop().trim().split(/\s+/)[0], 1000);
      });
    });
  }
  addMedia(meta('og:image'), 500);
  const values = Array.from(candidates.values()),videoValues = values.filter((entry) => entry.kind === 'video' && entry.rank >= 60000),hasPrimary = values.some((entry) => entry.rank >= 50000);
  const mediaUrls = (videoValues.length ? videoValues.sort((a, b) => b.rank - a.rank).slice(0, 1) : values.filter((entry) => !hasPrimary || entry.rank >= 50000).sort((a, b) => a.order - b.order)).map((entry) => entry.href).slice(0, 20);
  const comments = [];
  if (isReddit) {
    const nodes = Array.from(document.querySelectorAll('shreddit-comment,[data-testid="comment"],.Comment')).slice(0, 80);
    nodes.forEach((node) => {
      let bodyNode = null;
      try { bodyNode = node.querySelector('[slot="comment"],[id$="-comment-rtjson-content"],[data-testid="comment-body"],.md'); } catch (_) {}
      const body = bodyNode ? block(bodyNode.innerText || bodyNode.textContent, 12000) : '';
      const contentBlocks = richContentBlocks(bodyNode);
      const value = (name) => clean(node.getAttribute && node.getAttribute(name), 4000);
      let commentAuthor = value('author');
      if (!commentAuthor) { const authorNode = node.querySelector && node.querySelector('a[href*="/user/"]');commentAuthor = authorNode ? clean(authorNode.textContent, 200) : ''; }
      const avatarUrl = value('avatar') || value('author-avatar-url');
      const commentMedia = [],commentGifs = [];
      function addCommentMedia(raw, gifLike) {
        try { const url = new URL(String(raw || '').replace(/&amp;/g, '&'), location.href);if (url.protocol === 'https:' && !commentMedia.includes(url.toString()) && commentMedia.length < 4) commentMedia.push(url.toString());if(gifLike&&!commentGifs.includes(url.toString()))commentGifs.push(url.toString()); } catch (_) {}
      }
      if (bodyNode) {
        let mediaNodes = [];
        try { mediaNodes = Array.from(bodyNode.querySelectorAll('img[src],img[data-src],video[src],video source[src],shreddit-player[src]')).slice(0, 12); } catch (_) {}
        mediaNodes.forEach((mediaNode) => {
          const tag = String(mediaNode.tagName || '').toLowerCase();
          if (tag === 'img' && /avatar|emoji|award|flair/i.test(String(mediaNode.className || '') + ' ' + String(mediaNode.alt || ''))) return;
          const player=tag==='source'&&mediaNode.closest?mediaNode.closest('video'):mediaNode,raw=mediaNode.currentSrc || mediaNode.src || mediaNode.getAttribute('src') || mediaNode.getAttribute('data-src'),gifLike=/\.gif(?:$|[?#])/i.test(String(raw||''))||((tag==='video'||tag==='source')&&(player&&(player.loop||/gif/i.test(String(player.getAttribute&&player.getAttribute('aria-label')||'')+' '+String(player.className||'')))));
          addCommentMedia(raw,gifLike);
        });
      }
      if (!body && !commentMedia.length) return;
      const created = Date.parse(value('created') || value('created-timestamp'));
      comments.push({author:clean(commentAuthor.replace(/^\/?u\//i, ''), 200),avatarUrl,body,contentBlocks,mediaUrls:commentMedia,gifMediaUrls:commentGifs,score:Number(value('score').replace(/[^0-9-]/g, '')) || 0,depth:Number(value('depth')) || 0,date:Number.isFinite(created) ? created : 0});
    });
  }
  let authorFlair = '',postFlair = '',authorAvatarUrl = '';
  if (post) {
    const allRoots = roots || [];
    allRoots.some((root) => { let flair=null;try{const authorRoot=root.host&&String(root.host.tagName||'').toLowerCase()==='author-flair-event-handler';flair=root.querySelector(authorRoot?'.flair-content,[aria-label^="Flair:"]':'author-flair-event-handler .flair-content,author-flair-event-handler [aria-label^="Flair:"]');}catch(_){}if(!flair)return false;authorFlair=clean(flair.innerText||flair.textContent,300)||clean(String(flair.getAttribute('aria-label')||'').replace(/^Flair:\s*/i,'').replace(/(?::[a-z0-9_-]+:)+$/i,''),300);return !!authorFlair; });
    allRoots.some((root) => { let flair=null;try{const flairRoot=root.host&&String(root.host.tagName||'').toLowerCase()==='shreddit-post-flair';flair=root.querySelector(flairRoot?'.flair-content,[aria-label^="Flair:"]':'shreddit-post-flair .flair-content,shreddit-post-flair [aria-label^="Flair:"],[slot="post-flair"] .flair-content');}catch(_){}if(!flair)return false;postFlair=clean(flair.innerText||flair.textContent,300)||clean(String(flair.getAttribute('aria-label')||'').replace(/^Flair:\s*/i,'').replace(/:[a-z0-9_-]+:/ig,' '),300);return !!postFlair; });
    let avatar=null;try{avatar=post.querySelector('[slot="credit-bar"] a[href*="/user/"] img,faceplate-hovercard[data-id="user-hover-card"] img');}catch(_){}authorAvatarUrl=avatar?clean(avatar.currentSrc||avatar.src||avatar.getAttribute('src'),4000):attribute('icon');
  }
  return {
    pageReady: !!post,
    platform: isReddit ? 'reddit' : 'web', community, title, author, authorFlair, postFlair, authorAvatarUrl, content, contentBlocks,
    date: Number.isFinite(parsedDate) ? parsedDate : Date.now(), score, commentCount, mediaUrls, comments
  };
}

function capturePageMetadata(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId }, func: collectPageMetadata }, (results) => {
      const error = chrome.runtime.lastError;
      resolve(!error && results && results[0] && results[0].result ? results[0].result : {});
    });
  });
}

async function savePageOffline(tab, options) {
  const captureOptions = options && typeof options === 'object' ? options : {};
  if (!tab || !Number.isInteger(tab.id) || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Only web pages can be saved offline');
  const metadata = captureOptions.metadata || await capturePageMetadata(tab.id);
  const blob = await captureMhtml(tab.id);
  if (!blob.size || blob.size > 256 * 1024 * 1024) throw new Error('Saved page must be under 256 MB');
  let captureId = '';
  try {
    const started = await postJson('/capture/start', { url: tab.url, title: tab.title || '', size: blob.size, mime: blob.type || 'multipart/related', metadata, sourceId: captureOptions.sourceId || '' });
    captureId = started.captureId;
    const chunkSize = 1024 * 1024;
    for (let offset = 0, index = 0; offset < blob.size; offset += chunkSize, index++) {
      const bytes = await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer();
      await authorizedRequest('/capture/chunk?id=' + encodeURIComponent(captureId) + '&index=' + index, { headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    }
    await postJson('/capture/finish', { captureId });
    setStatus(true);
    if (captureOptions.notify !== false) chrome.notifications.create('sinrad-offline-' + Date.now(), { type: 'basic', iconUrl: 'icon.png', title: 'Saved for offline use', message: (tab.title || tab.url).slice(0, 180), priority: 0, silent: true });
  } catch (error) {
    if (captureId) postJson('/capture/cancel', { captureId }).catch(() => {});
    throw error;
  }
}

function waitForTab(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { chrome.tabs.onUpdated.removeListener(onUpdated); reject(new Error('Reddit page took too long to load')); }, timeoutMs || 30000);
    function finish(tab) { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(onUpdated); resolve(tab); }
    function onUpdated(id, change, tab) { if (id === tabId && change.status === 'complete') finish(tab); }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error || !tab) { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(onUpdated); reject(new Error(error && error.message || 'Reddit tab was unavailable')); }
      else if (tab.status === 'complete') finish(tab);
    });
  });
}

function collectRedditPostCandidates(community) {
  const wanted = String(community || '').toLowerCase();
  const output = [],roots=[document],seenRoots=new Set(),queue=[document];
  while(queue.length&&roots.length<500){const root=queue.shift();if(!root||seenRoots.has(root))continue;seenRoots.add(root);if(root!==document)roots.push(root);let nodes=[];try{nodes=root.querySelectorAll('*');}catch(_){}Array.from(nodes||[]).forEach((node)=>{if(node.shadowRoot&&!seenRoots.has(node.shadowRoot))queue.push(node.shadowRoot);});}
  function compactNumber(value) {
    const text = String(value == null ? '' : value).trim().replace(/,/g, '');
    const match = text.match(/(-?\d+(?:\.\d+)?)\s*([km])?/i);
    if (!match) return 0;
    const multiplier = match[2] && match[2].toLowerCase() === 'm' ? 1000000 : (match[2] ? 1000 : 1);
    return Math.round(Number(match[1]) * multiplier) || 0;
  }
  roots.forEach((root)=>root.querySelectorAll('a[href*="/comments/"],shreddit-post[permalink*="/comments/"],[permalink*="/comments/"],[data-permalink*="/comments/"]').forEach((link) => {
    try {
      const raw=link.href||link.getAttribute('permalink')||link.getAttribute('data-permalink')||link.getAttribute('content-href')||'',url = new URL(raw, location.href);
      const match = url.pathname.match(/^\/r\/([A-Za-z0-9_]{2,21})\/comments\/([A-Za-z0-9]+)(?:\/([^/?#]+))?\/?/i);
      if (!match || match[1].toLowerCase() !== wanted) return;
      const full = 'https://www.reddit.com/r/' + match[1] + '/comments/' + match[2] + '/' + (match[3] ? match[3] + '/' : '');
      if (output.some((entry) => entry.url === full)) return;
      const card = link.matches&&link.matches('shreddit-post,[data-testid="post-container"],article')?link:link.closest('shreddit-post,[data-testid="post-container"],article,.thing');
      const attr = (name) => card && card.getAttribute ? card.getAttribute(name) : '';
      const score = compactNumber(attr('score') || attr('upvote-count') || (card && card.querySelector('[data-post-click-location="vote"]') || {}).textContent);
      const comments = compactNumber(attr('comment-count') || attr('comments-count') || (card && card.querySelector('a[href*="/comments/"] [aria-label*="comment" i]') || {}).textContent);
      output.push({url:full,score:score,comments:comments});
    } catch (_) {}
  }));
  let next='';for(const root of roots){const link=root.querySelector('a[rel="next"],span.next-button a,a[aria-label="Next page"]');if(!link)continue;try{const candidate=new URL(link.href,location.href);if(candidate.pathname.toLowerCase().startsWith('/r/'+wanted+'/')&&candidate.searchParams.has('after')){next=candidate.href;break;}}catch(_){}}
  return {posts:output,next:next};
}

function redditPostKey(value) {
  try { const match = new URL(String(value || '')).pathname.match(/^\/r\/([A-Za-z0-9_]{2,21})\/comments\/([A-Za-z0-9]+)/i);return match ? (match[1] + ':' + match[2]).toLowerCase() : ''; }
  catch (_) { return ''; }
}

function scrollRedditListing() {
  const before = document.documentElement.scrollHeight;
  window.scrollBy({top:Math.max(1200, window.innerHeight * 2),behavior:'instant'});
  return {before:before,top:window.scrollY};
}

async function gatherRedditCandidates(tabId, community, known, target, kind) {
  const found = new Map(),visitedPages=new Set();let stableRounds = 0,lastTop = -1;
  for (let attempt = 0; attempt < 32; attempt++) {
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: collectRedditPostCandidates, args: [community] });
    const snapshot=results&&results[0]&&results[0].result||{},entries=Array.isArray(snapshot)?snapshot:(Array.isArray(snapshot.posts)?snapshot.posts:[]);
    entries.forEach((entry, index) => {
      const key = redditPostKey(entry && entry.url);if (!key) return;
      const score = Math.max(0, Number(entry.score) || 0),comments = Math.max(0, Number(entry.comments) || 0);
      const listBonus = kind === 'top' ? 1200 : (kind === 'hot' ? 700 : 80);
      const rank = listBonus + Math.min(20000, score) + comments * 8 + Math.max(0, 200 - index * 4);
      const prior = found.get(key);if (!prior || rank > prior.rank) found.set(key,{url:entry.url,score:score,comments:comments,rank:rank,kind:kind});
    });
    const unseen = Array.from(found.keys()).filter((key) => !known.has(key)).length;
    if (unseen >= target && attempt >= 3) break;
    if(snapshot.next&&!visitedPages.has(snapshot.next)){visitedPages.add(snapshot.next);await chrome.tabs.update(tabId,{url:snapshot.next});await waitForTab(tabId,30000);stableRounds=0;lastTop=-1;continue;}
    const scrolled = await chrome.scripting.executeScript({ target: { tabId }, func: scrollRedditListing });
    const top = scrolled && scrolled[0] && scrolled[0].result ? Number(scrolled[0].result.top) : -1;
    if (top === lastTop) stableRounds++;else stableRounds = 0;
    lastTop = top;if (stableRounds >= 6) break;
    await new Promise((resolve) => setTimeout(resolve, 1300));
  }
  return Array.from(found.entries()).filter((entry) => !known.has(entry[0])).map((entry) => entry[1]);
}

async function waitForRedditPost(tabId) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const metadata = await capturePageMetadata(tabId);
    const title = String(metadata && metadata.title || '').trim();
    if (metadata && metadata.pageReady && metadata.platform === 'reddit' && title && title !== 'Reddit - The heart of the internet') {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return await capturePageMetadata(tabId);
    }
    await new Promise((resolve) => setTimeout(resolve, 1250));
  }
  throw new Error('Reddit did not finish loading the post');
}

async function closeBackgroundTab(tabId) {
  if (!Number.isInteger(tabId)) return;
  try { await chrome.tabs.remove(tabId); } catch (_) {}
}

async function runOfflineJob(job) {
  let listingId = null, saved = 0, failed = 0;
  const known = new Set([].concat(job.knownKeys || [],(job.knownUrls || []).map(redditPostKey)).map((value) => String(value || '').toLowerCase()).filter(Boolean));
  try {
    const target = Math.min(100, Number(job.limit) || 30),candidates = new Map();
    const listings = [{path:'hot/',kind:'hot'},{path:'top/?sort=top&t=week',kind:'top'},{path:'new/',kind:'new'}];
    for (const source of listings) {
      const listing = await chrome.tabs.create({ url: 'https://old.reddit.com/r/' + encodeURIComponent(job.handle) + '/' + source.path, active: false });listingId = listing.id;
      await waitForTab(listing.id, 30000);
      const batch = await gatherRedditCandidates(listing.id, job.handle, known, target, source.kind);
      batch.forEach((candidate) => {const key=redditPostKey(candidate.url),prior=candidates.get(key);if(key&&(!prior||candidate.rank>prior.rank))candidates.set(key,candidate);});
      await closeBackgroundTab(listingId);listingId = null;
    }
    const selected = Array.from(candidates.values()).sort((a,b) => b.rank-a.rank).slice(0,target);
    if(!selected.length)throw new Error('Reddit did not expose any unseen posts for r/'+job.handle);
    for (const candidate of selected) {
      let postId = null;
      try {
        const post = await chrome.tabs.create({ url:candidate.url, active: false }); postId = post.id;
        const loadedPost = await waitForTab(post.id, 30000);
        const metadata = await waitForRedditPost(post.id);
        metadata.score = Math.max(Number(metadata.score)||0,candidate.score||0);metadata.commentCount = Math.max(Number(metadata.commentCount)||0,candidate.comments||0);
        const latest = await chrome.tabs.get(post.id);
        await savePageOffline(latest || loadedPost, { sourceId: job.sourceId, notify: false, metadata });
        saved++;
      } catch (_) { failed++; }
      finally { await closeBackgroundTab(postId); }
    }
    await postJson('/offline/job-finish', { sourceId: job.sourceId, ok: saved > 0 || failed === 0, saved, failed, error: saved === 0 ? 'Reddit pages could not be captured' : '' });
    if (saved) chrome.notifications.create('sinrad-reddit-sync-' + Date.now(), { type: 'basic', iconUrl: 'icon.png', title: 'Offline Reddit updated', message: 'Saved ' + saved + ' new r/' + job.handle + ' post' + (saved === 1 ? '' : 's'), priority: 0, silent: true });
  } catch (error) {
    await closeBackgroundTab(listingId);
    await postJson('/offline/job-finish', { sourceId: job.sourceId, ok: false, saved, failed, error: String(error && error.message || error).slice(0, 300) }).catch(() => {});
    setStatus(false);chrome.notifications.create('sinrad-reddit-sync-error-' + Date.now(), { type: 'basic', iconUrl: 'icon.png', title: 'Offline Reddit needs attention', message: String(error && error.message || error).slice(0, 180), priority: 1, silent: true });
  }
}

let offlinePollRunning = false;
async function pollOfflineJobs() {
  if (offlinePollRunning) return;
  offlinePollRunning = true;let handledJob=false;
  try {
    const result = await authorizedRequest('/offline/jobs', { method: 'GET', cache: 'no-store' });
    if (result.job) {handledJob=true;await runOfflineJob(result.job);}
  } catch (_) {}
  finally { offlinePollRunning = false;if(handledJob)setTimeout(pollOfflineJobs,1500); }
}

// === Toolbar icon click: save current page ===
chrome.action.onClicked.addListener((tab) => {
  saveOne(tab.url, tab.title, false).catch(() => {});
});

// === Right-click context menu ===
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sinrad-offline-poll', { periodInMinutes: 1 });
  setTimeout(pollOfflineJobs, 1000);
  chrome.contextMenus.removeAll(() => {
    // Opera groups these page commands into one S.I.R submenu. This costs one
    // extra click but keeps Quick Save and both bulk actions together.
    chrome.contextMenus.create({
      id: 'sinrad-quick-save',
      title: 'S.I.R Quick Save → Links',
      contexts: ['page', 'link', 'selection']
    });
    chrome.contextMenus.create({
      id: 'sinrad-add-subreddit-offline',
      title: 'Add subreddit to Offline',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'sinrad-park-all',
      title: 'Park all tabs → Parking Lot',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'sinrad-park-all-close',
      title: 'Park all tabs & close saved → Parking Lot',
      contexts: ['page']
    });
  });
});

chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('sinrad-offline-poll', { periodInMinutes: 1 }); setTimeout(pollOfflineJobs, 1000); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm && alarm.name === 'sinrad-offline-poll') pollOfflineJobs(); });
chrome.alarms.create('sinrad-offline-poll', { periodInMinutes: 1 });
pollOfflineJobs();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sinrad-quick-save') {
    const sel = (info.selectionText || '').trim();
    const targetUrl = info.linkUrl || (/^https?:\/\//i.test(sel) ? sel : tab.url);
    saveOne(targetUrl, tab.title, false).catch(() => {});
  } else if (info.menuItemId === 'sinrad-add-subreddit-offline') {
    let handle='';try{const match=new URL(tab&&tab.url||'').pathname.match(/^\/r\/([A-Za-z0-9_]{2,21})(?:\/|$)/i);handle=match?match[1]:'';}catch(_){}
    if(!handle){notifyUnavailable(new Error('Open a subreddit page first'));return;}
    postJson('/offline/source-add',{handle}).then(() => chrome.notifications.create('sinrad-reddit-source-'+Date.now(),{type:'basic',iconUrl:'icon.png',title:'Added to Offline',message:'r/'+handle+' will keep an unread pool in SINRAD.',priority:0,silent:true})).catch((error)=>notifyUnavailable(error));
  } else if (info.menuItemId === 'sinrad-park-all' || info.menuItemId === 'sinrad-park-all-close') {
    const shouldClose = info.menuItemId === 'sinrad-park-all-close';
    
    // Park all tabs in current window
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      const targets = tabs.filter((t) => t.url && /^https?:\/\//i.test(t.url));
      if (!targets.length) return;
      try {
        await saveBatchToSinrad(targets);
        const savedIds = targets.map((t) => t.id).filter((id) => Number.isInteger(id));
        if (shouldClose && savedIds.length) await chrome.tabs.remove(savedIds);
      } catch (error) {
        notifyUnavailable(error);
      }
    });
  }
});
