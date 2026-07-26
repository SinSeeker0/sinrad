// S.I.R Quick Save — background service worker
// Sends page URL + title to the S.I.R desktop app's localhost server

const PORT = 47821;

function saveToSinrad(url, title) {
  if (!url) return;
  const finalUrl = url.match(/^https?:\/\//) ? url : url;
  const params = new URLSearchParams({ url: finalUrl, title: title || '' });
  fetch('http://localhost:' + PORT + '/park?' + params.toString(), { mode: 'no-cors' })
    .then(() => { /* notification handled by the app */ })
    .catch(() => {
      chrome.notifications.create('sinrad-err-' + Date.now(), {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'S.I.R not running',
        message: 'Start the app to save links',
        priority: -1,
        silent: true
      });
    });
}

// === Toolbar icon click: save current page ===
chrome.action.onClicked.addListener((tab) => {
  saveToSinrad(tab.url, tab.title);
});

// === Right-click context menu ===
chrome.runtime.onInstalled.addListener(() => {
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
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sinrad-save-link') {
    saveToSinrad(info.linkUrl, tab.title);
  } else if (info.menuItemId === 'sinrad-save-selection') {
    const sel = (info.selectionText || '').trim();
    if (sel.match(/^https?:\/\//)) {
      saveToSinrad(sel, tab.title);
    } else {
      saveToSinrad(tab.url, tab.title);
    }
  } else {
    saveToSinrad(tab.url, tab.title);
  }
});
