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
      title: '？ Ask about this image',
      contexts: ['image']
    });
  });
}

chrome.runtime.onInstalled.addListener(registerContextMenus);
chrome.runtime.onStartup.addListener(registerContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !['explain-image', 'ask-image'].includes(info.menuItemId)) return;
  const message = {
    type: 'IMAGE_CONTEXT_MENU',
    action: info.menuItemId,
    srcUrl: info.srcUrl || null,
    error: info.srcUrl ? null : 'Could not determine image URL.'
  };
  const frameId = info.frameId ?? 0;
  chrome.tabs.sendMessage(tab.id, message, { frameId }).catch(() => {
    if (frameId) chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => {});
  });
});

let historyWrites = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'CTX_SOURCE' && sender.tab) {
    respond({ url: sender.tab.url, title: sender.tab.title });
  } else if (message.type === 'CTX_SELECTION' && sender.tab?.id != null) {
    // The notice carries no text and only reaches this tab's extension scripts.
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'CTX_SELECTION_CHANGED', token: message.token, at: message.at
    }).catch(() => {});
  } else if (message.type === 'CTX_HISTORY') {
    // All frames and the popup share the same storage key.
    const write = historyWrites.then(async () => {
      const { ctxHistory = [] } = await chrome.storage.local.get('ctxHistory');
      let history = ctxHistory;
      switch (message.action) {
        case 'add':
          history = [message.entry, ...history].slice(0, 2000);
          break;
        case 'followup': {
          const entry = history.find(item => item.id === message.id);
          if (!entry) return history;
          (entry.followUps ||= []).push(message.followup);
          break;
        }
        case 'delete':
          history = history.filter(item => item.id !== message.id);
          break;
        case 'clear':
          history = [];
          break;
        default:
          return history;
      }
      await chrome.storage.local.set({ ctxHistory: history });
      return history;
    });
    historyWrites = write.catch(() => {});
    const historyPage = sender.url?.startsWith(chrome.runtime.getURL(''));
    write.then(history => respond({ ok: true, history: historyPage ? history : undefined }),
      () => respond({ ok: false }));
    return true;
  }
});
