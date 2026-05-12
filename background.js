/* ============================================================
   Context Explain — background.js

   Streaming is now done directly in content.js (fetch from
   content script), so this service worker has almost nothing
   to do. It only needs to exist so Chrome registers the
   extension action / handles install events.
   ============================================================ */

chrome.runtime.onInstalled.addListener(() => {
  // Nothing to set up — all logic lives in content.js
});
