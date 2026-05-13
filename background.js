/* ============================================================
   background.js — Service Worker for Context Explain
   ============================================================ */

// ─── Context Menu Registration ───────────────────────────────────────────────
function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'explain-image',
      title: '◆ Explain this image',
      contexts: ['image']
    });
    chrome.contextMenus.create({
      id: 'ask-image',
      title: '? Ask about this image',
      contexts: ['image']
    });
  });
}

chrome.runtime.onInstalled.addListener(registerContextMenus);
chrome.runtime.onStartup.addListener(registerContextMenus);

// ─── Context Menu Click Handler ───────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== 'explain-image' && info.menuItemId !== 'ask-image') return;

  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    // No image URL available — send error message
    chrome.tabs.sendMessage(tab.id, {
      type: 'IMAGE_CONTEXT_MENU',
      action: info.menuItemId,
      srcUrl: null,
      error: 'Could not determine image URL.'
    }).catch(() => {}); // Tab may not have content script (e.g., chrome:// pages)
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: 'IMAGE_CONTEXT_MENU',
    action: info.menuItemId,      // 'explain-image' | 'ask-image'
    srcUrl: srcUrl,
    pageUrl: info.pageUrl || tab.url || ''
  }).catch(() => {}); // Content script may not be ready
});
