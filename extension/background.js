// S.I.R Quick Save — background service worker
// Sends page URL + title to the S.I.R desktop app's localhost server

const PORT = 47821;
const BASES = ['http://127.0.0.1:' + PORT, 'http://localhost:' + PORT];
const BRIDGE_KEY = '__SINRAD_BRIDGE_KEY__';
let sessionToken = '';
let sessionBase = '';

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
  if (response.status === 401) {
    sessionToken = '';
    sessionBase = '';
    token = await getToken();
    request.headers = Object.assign({}, request.headers, { 'X-Sinrad-Token': token, 'X-Sinrad-Bridge-Key': BRIDGE_KEY });
    response = await fetch(sessionBase + route, request);
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
      const commentMedia = [];
      function addCommentMedia(raw) {
        try { const url = new URL(String(raw || '').replace(/&amp;/g, '&'), location.href);if (url.protocol === 'https:' && !commentMedia.includes(url.toString()) && commentMedia.length < 4) commentMedia.push(url.toString()); } catch (_) {}
      }
      if (bodyNode) {
        let mediaNodes = [];
        try { mediaNodes = Array.from(bodyNode.querySelectorAll('img[src],img[data-src],video[src],video source[src],shreddit-player[src]')).slice(0, 12); } catch (_) {}
        mediaNodes.forEach((mediaNode) => {
          const tag = String(mediaNode.tagName || '').toLowerCase();
          if (tag === 'img' && /avatar|emoji|award|flair/i.test(String(mediaNode.className || '') + ' ' + String(mediaNode.alt || ''))) return;
          addCommentMedia(mediaNode.currentSrc || mediaNode.src || mediaNode.getAttribute('src') || mediaNode.getAttribute('data-src'));
        });
      }
      if (!body && !commentMedia.length) return;
      const created = Date.parse(value('created') || value('created-timestamp'));
      comments.push({author:clean(commentAuthor.replace(/^\/?u\//i, ''), 200),avatarUrl,body,contentBlocks,mediaUrls:commentMedia,score:Number(value('score').replace(/[^0-9-]/g, '')) || 0,depth:Number(value('depth')) || 0,date:Number.isFinite(created) ? created : 0});
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

async function savePageOffline(tab) {
  if (!tab || !Number.isInteger(tab.id) || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Only web pages can be saved offline');
  const metadata = await capturePageMetadata(tab.id);
  const blob = await captureMhtml(tab.id);
  if (!blob.size || blob.size > 256 * 1024 * 1024) throw new Error('Saved page must be under 256 MB');
  let captureId = '';
  try {
    const started = await postJson('/capture/start', { url: tab.url, title: tab.title || '', size: blob.size, mime: blob.type || 'multipart/related', metadata });
    captureId = started.captureId;
    const chunkSize = 1024 * 1024;
    for (let offset = 0, index = 0; offset < blob.size; offset += chunkSize, index++) {
      const bytes = await blob.slice(offset, Math.min(blob.size, offset + chunkSize)).arrayBuffer();
      await authorizedRequest('/capture/chunk?id=' + encodeURIComponent(captureId) + '&index=' + index, { headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    }
    await postJson('/capture/finish', { captureId });
    setStatus(true);
    chrome.notifications.create('sinrad-offline-' + Date.now(), { type: 'basic', iconUrl: 'icon.png', title: 'Saved for offline use', message: (tab.title || tab.url).slice(0, 180), priority: 0, silent: true });
  } catch (error) {
    if (captureId) postJson('/capture/cancel', { captureId }).catch(() => {});
    throw error;
  }
}

// === Toolbar icon click: save current page ===
chrome.action.onClicked.addListener((tab) => {
  saveOne(tab.url, tab.title, false).catch(() => {});
});

// === Right-click context menu ===
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Opera groups these page commands into one S.I.R submenu. This costs one
    // extra click but keeps Quick Save and both bulk actions together.
    chrome.contextMenus.create({
      id: 'sinrad-quick-save',
      title: 'S.I.R Quick Save → Links',
      contexts: ['page', 'link', 'selection']
    });
    chrome.contextMenus.create({
      id: 'sinrad-save-offline',
      title: 'Save page for offline use',
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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sinrad-quick-save') {
    const sel = (info.selectionText || '').trim();
    const targetUrl = info.linkUrl || (/^https?:\/\//i.test(sel) ? sel : tab.url);
    saveOne(targetUrl, tab.title, false).catch(() => {});
  } else if (info.menuItemId === 'sinrad-save-offline') {
    savePageOffline(tab).catch((error) => notifyUnavailable(error));
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
        chrome.notifications.create('sinrad-parked-' + Date.now(), {
          type: 'basic', iconUrl: 'icon.png', title: 'S.I.R',
          message: 'Saved all ' + targets.length + ' tab(s) to Parking Lot' + (shouldClose ? ' and closed them' : ''),
          priority: 0, silent: true
        });
      } catch (error) {
        notifyUnavailable(error);
      }
    });
  }
});
