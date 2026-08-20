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

async function saveToSinrad(url, title, lot) {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('Only web URLs can be saved');
  let token = await getToken();
  let response = await fetch(sessionBase + '/park', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sinrad-Token': token, 'X-Sinrad-Bridge-Key': BRIDGE_KEY },
    body: JSON.stringify({ url, title: title || '', lot: !!lot })
  });
  if (response.status === 401) {
    sessionToken = '';
    sessionBase = '';
    token = await getToken();
    response = await fetch(sessionBase + '/park', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sinrad-Token': token, 'X-Sinrad-Bridge-Key': BRIDGE_KEY },
      body: JSON.stringify({ url, title: title || '', lot: !!lot })
    });
  }
  if (!response.ok) throw new Error('Sinrad rejected the save');
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Save failed');
  setStatus(true);
  return true;
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

// === Toolbar icon click: save current page ===
chrome.action.onClicked.addListener((tab) => {
  saveOne(tab.url, tab.title, false).catch(() => {});
});

// === Right-click context menu ===
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'sinrad-save-page',
    title: 'Save page to S.I.R',
    contexts: ['page']
  });
  chrome.contextMenus.create({
    id: 'sinrad-save-link',
    title: 'Save link to S.I.R',
    contexts: ['link']
  });
  chrome.contextMenus.create({
    id: 'sinrad-save-selection',
    title: 'Save selection to S.I.R',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'sinrad-park-all',
    title: 'Park ALL tabs to S.I.R',
    contexts: ['page']
  });
  chrome.contextMenus.create({
    id: 'sinrad-park-all-close',
    title: 'Park ALL tabs & close them',
    contexts: ['page']
  });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sinrad-save-link') {
    saveOne(info.linkUrl, tab.title, false).catch(() => {});
  } else if (info.menuItemId === 'sinrad-save-selection') {
    const sel = (info.selectionText || '').trim();
    if (sel.match(/^https?:\/\//)) {
      saveOne(sel, tab.title, false).catch(() => {});
    } else {
      saveOne(tab.url, tab.title, false).catch(() => {});
    }
  } else if (info.menuItemId === 'sinrad-park-all' || info.menuItemId === 'sinrad-park-all-close') {
    const shouldClose = info.menuItemId === 'sinrad-park-all-close';
    
    // Park all tabs in current window
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      const targets = tabs.filter((t) => t.url && /^https?:\/\//i.test(t.url));
      if (!targets.length) return;
      const results = await Promise.allSettled(targets.map((t) => saveToSinrad(t.url, t.title, true)));
      const savedIds = targets.filter((_t, i) => results[i].status === 'fulfilled').map((t) => t.id);
      const failed = targets.length - savedIds.length;
      if (shouldClose && savedIds.length) await chrome.tabs.remove(savedIds);
      chrome.notifications.create('sinrad-parked-' + Date.now(), {
        type: 'basic', iconUrl: 'icon.png', title: 'S.I.R',
        message: 'Parked ' + savedIds.length + ' tab(s)' + (shouldClose ? ' and closed only those saved' : '') + (failed ? '; ' + failed + ' left open' : ''),
        priority: failed ? 1 : 0, silent: true
      });
    });
  } else {
    saveOne(tab.url, tab.title, false).catch(() => {});
  }
});
