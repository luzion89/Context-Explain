/* Frame metadata and coordinates, using only documents Chrome exposes to this frame. */
(() => {
  if (globalThis.ctxFrame) return;

  const inFrame = window !== window.top;
  const stableUrl = href => /^(https?:|file:)/i.test(href || '') ? href : '';
  const isFoliate = () => {
    for (let el = window.frameElement; el; el = el.parentElement || el.getRootNode().host) {
      if (el.localName === 'foliate-view' || el.localName === 'foliate-paginator') return true;
    }
    return false;
  };

  function source() {
    let topDocument;
    try { topDocument = window.top.document; } catch { /* Cross-origin frame. */ }
    const frameUrl = location.href;
    return {
      documentTitle: topDocument?.title || document.title || '',
      sourceUrl: stableUrl(topDocument?.URL) || stableUrl(frameUrl),
      frameUrl,
      sourceType: !inFrame ? 'web' : isFoliate() ? 'epub' : 'iframe'
    };
  }

  async function resolveSource(metadata = source()) {
    // Chrome provides the tab metadata even when parent DOM access is forbidden.
    if (!inFrame) return metadata;
    try {
      const tab = await chrome.runtime.sendMessage({ type: 'CTX_SOURCE' });
      return { ...metadata, sourceUrl: stableUrl(tab?.url) || metadata.sourceUrl,
        documentTitle: tab?.title || metadata.documentTitle };
    } catch {
      return metadata;
    }
  }

  function viewport() {
    const bounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    let view = window;
    let x = 0, y = 0, scaleX = 1, scaleY = 1;
    while (view !== view.top) {
      const frame = view.frameElement;
      if (!frame) break; // Use the local viewport at cross-origin boundaries.
      const parent = frame.ownerDocument.defaultView;
      const rect = frame.getBoundingClientRect();
      const sx = rect.width / (frame.offsetWidth || rect.width || 1);
      const sy = rect.height / (frame.offsetHeight || rect.height || 1);
      x = rect.left + (x + frame.clientLeft) * sx;
      y = rect.top + (y + frame.clientTop) * sy;
      scaleX *= sx || 1;
      scaleY *= sy || 1;
      const intersect = (left, top, right, bottom) => {
        bounds.left = Math.max(bounds.left, (left - x) / scaleX);
        bounds.top = Math.max(bounds.top, (top - y) / scaleY);
        bounds.right = Math.min(bounds.right, (right - x) / scaleX);
        bounds.bottom = Math.min(bounds.bottom, (bottom - y) / scaleY);
      };
      intersect(0, 0, parent.innerWidth, parent.innerHeight);
      for (let el = frame.parentElement || frame.getRootNode().host; el;
        el = el.parentElement || el.getRootNode().host) {
        const style = parent.getComputedStyle(el);
        const clipX = style.overflowX !== 'visible';
        const clipY = style.overflowY !== 'visible';
        if (!clipX && !clipY) continue;
        const box = el.getBoundingClientRect();
        intersect(clipX ? box.left : -Infinity, clipY ? box.top : -Infinity,
          clipX ? box.right : Infinity, clipY ? box.bottom : Infinity);
      }
      view = parent;
    }
    return bounds;
  }

  globalThis.ctxFrame = { inFrame, isFoliate, stableUrl, source, resolveSource, viewport };
})();
