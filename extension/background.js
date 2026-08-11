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

function saveToSinradLot(url, title) {
  if (!url) return;
  const finalUrl = url.match(/^https?:\/\//) ? url : url;
  const params = new URLSearchParams({ url: finalUrl, title: title || '', lot: '1' });
  fetch('http://localhost:' + PORT + '/park?' + params.toString(), { mode: 'no-cors' })
    .then(() => { /* handled by app */ })
    .catch(() => {});
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
  } else if (info.menuItemId === 'sinrad-park-all' || info.menuItemId === 'sinrad-park-all-close') {
    const shouldClose = info.menuItemId === 'sinrad-park-all-close';
    
    // Park all tabs in current window
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      let count = 0;
      const tabIds = [];
      
      tabs.forEach((t) => {
        if (t.url && t.url.match(/^https?:\/\//)) {
          saveToSinradLot(t.url, t.title);
          tabIds.push(t.id);
          count++;
        }
      });
      
      if (count > 0) {
        // Close tabs if requested
        if (shouldClose) {
          // Small delay to ensure parking requests are sent
          setTimeout(() => {
            chrome.tabs.remove(tabIds, () => {
              chrome.notifications.create('sinrad-parked-closed-' + Date.now(), {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'S.I.R',
                message: 'Parked and closed ' + count + ' tabs',
                priority: 1,
                silent: true
              });
            });
          }, 500);
        } else {
          chrome.notifications.create('sinrad-parked-all-' + Date.now(), {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'S.I.R',
            message: 'Parked ' + count + ' tabs',
            priority: 1,
            silent: true
          });
        }
      }
    });
  } else {
    saveToSinrad(tab.url, tab.title);
  }
});
