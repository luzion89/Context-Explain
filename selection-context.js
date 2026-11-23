/* Selection and bounded context extraction in the current document. */
(() => {
  if (globalThis.ctxSelection) return;

  const LIMIT = 500;
  const PDF_LAYER = '.textLayer, [data-pdf-text-layer]';
  const IGNORE = 'script,style,template,noscript,textarea,input,select,[hidden],[inert],[aria-hidden="true"],#ctx-explain-root,#ctx-explain-trigger,.ctx-explain-hover-popup';
  const BLOCK = /^(block|flex|grid|flow-root|list-item|table)/;
  const clean = text => text.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const element = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

  function read(doc, openRoots) {
    const selection = doc.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection.rangeCount) return null;
    const roots = new Set(openRoots);
    for (const node of [selection.anchorNode, selection.focusNode]) {
      const root = node?.getRootNode();
      if (root?.mode === 'open') roots.add(root);
    }

    let range = selection.getRangeAt(0).cloneRange();
    if (roots.size && selection.getComposedRanges) {
      const [composed] = selection.getComposedRanges({ shadowRoots: [...roots] });
      if (composed?.startContainer.getRootNode() === composed?.endContainer.getRootNode()) {
        range = doc.createRange();
        range.setStart(composed.startContainer, composed.startOffset);
        range.setEnd(composed.endContainer, composed.endOffset);
      }
    }
    const { startContainer: start, endContainer: end } = range;
    if (range.collapsed || start.ownerDocument !== doc || end.ownerDocument !== doc ||
        start.getRootNode().mode === 'closed' || end.getRootNode().mode === 'closed' ||
        !range.toString().trim() ||
        [start, end].some(node => element(node)?.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),#ctx-explain-root'))) return null;
    return { range, selectedText: text };
  }

  function scan(scope) {
    const info = new WeakMap();
    function describe(el) {
      if (!el) return { hidden: false, block: null };
      if (info.has(el)) return info.get(el);
      const parent = describe(el === scope ? null : el.parentElement);
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      const result = {
        hidden: parent.hidden || el.matches(IGNORE) || style.display === 'none' ||
          style.contentVisibility === 'hidden' || ['hidden', 'collapse'].includes(style.visibility) ||
          (style.position === 'absolute' && (style.clipPath !== 'none' || style.clip !== 'auto') &&
            el.offsetWidth <= 1 && el.offsetHeight <= 1),
        block: BLOCK.test(style.display) ? el : parent.block
      };
      info.set(el, result);
      return result;
    }
    return describe;
  }

  function adjacent(node, scope, backwards, descend) {
    if (descend && node.childNodes.length) return backwards ? node.lastChild : node.firstChild;
    while (node !== scope) {
      const sibling = backwards ? node.previousSibling : node.nextSibling;
      if (sibling) return sibling;
      node = node.parentNode;
    }
    return null;
  }

  function around(range, scope, backwards, describe, pdf) {
    const boundary = backwards ? range.startContainer : range.endContainer;
    const offset = backwards ? range.startOffset : range.endOffset;
    let block = describe(element(boundary)).block;
    let text = '';
    let node = boundary.nodeType === Node.TEXT_NODE ? boundary :
      boundary.childNodes[offset - Number(backwards)] || adjacent(boundary, scope, backwards, false);
    for (let count = 0; node && text.length < LIMIT && count < 1800; count++) {
      const details = describe(element(node));
      if (!details.hidden) {
        if (node.nodeType === Node.TEXT_NODE) {
          const length = LIMIT - text.length;
          const start = node === boundary && !backwards ? offset : 0;
          const end = node === boundary && backwards ? offset : node.length;
          const part = node.data.slice(backwards ? Math.max(start, end - length) : start,
            backwards ? end : Math.min(end, start + length));
          const gap = details.block !== block ? '\n' : pdf && node !== boundary ? ' ' : '';
          text = backwards ? part + gap + text : text + gap + part;
          block = details.block;
        } else if (node.localName === 'br') {
          text = backwards ? '\n' + text : text + '\n';
        }
      }
      node = adjacent(node, scope, backwards, !details.hidden);
    }
    return clean(text);
  }

  function details(range) {
    const root = range.startContainer.getRootNode();
    const common = element(range.commonAncestorContainer);
    const layer = common?.closest(PDF_LAYER);
    const scope = layer || common?.closest('article,main,[role="main"],blockquote') ||
      (root.nodeType === Node.DOCUMENT_NODE ? root.body : root);
    return { scope, layer };
  }

  function extract({ range, selectedText }, source) {
    const { scope, layer } = details(range);
    const usable = scope?.isConnected && scope.contains(range.endContainer);
    const describe = usable ? scan(scope) : null;
    const contextBefore = usable ? around(range, scope, true, describe, layer).trimStart() : '';
    const contextAfter = usable ? around(range, scope, false, describe, layer).trimEnd() : '';
    return {
      ...source,
      selectedText,
      contextBefore,
      contextAfter,
      sourceType: layer ? 'pdf-text-layer' : source.sourceType,
      contextQuality: contextBefore || contextAfter ? 'range' : 'selection-only',
      range,
      scope
    };
  }

  // The nearby quote is the portable anchor. Only recover a unique best match.
  function findQuote(scope, { selectedText, contextBefore, contextAfter }, limit = 24000) {
    const quote = normalize(selectedText);
    if (!scope?.isConnected || !quote) return null;
    const describe = scan(scope);
    const doc = scope.ownerDocument;
    const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (describe(element(node)).hidden) return NodeFilter.FILTER_REJECT;
        return node.nodeType === Node.TEXT_NODE ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    let text = '';
    let previousBlock;
    let node;
    const spans = [];
    while (text.length < limit && (node = walker.nextNode())) {
      const block = describe(node.parentElement).block;
      const gap = text && previousBlock !== block;
      previousBlock = block;
      if (gap && !text.endsWith(' ')) text += ' ';
      const tokens = /\s+|\S+/g;
      let token;
      while (text.length < limit && (token = tokens.exec(node.data))) {
        if (/^\s/.test(token[0])) {
          if (text && !text.endsWith(' ')) text += ' ';
        } else {
          spans.push({ at: text.length, node, offset: token.index, length: token[0].length });
          text += token[0].slice(0, limit - text.length);
        }
      }
    }
    // A truncated search cannot establish uniqueness in the supplied scope.
    if (text.length === limit) return null;
    const before = normalize(contextBefore || '').slice(-60);
    const after = normalize(contextAfter || '').slice(0, 60);
    let match = null;
    let best = -1;
    let ambiguous = false;
    let startSpan = 0, endSpan = 0;
    for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) {
      const end = at + quote.length;
      const score = (before && text.slice(0, at).trimEnd().endsWith(before) ? before.length : 0) +
        (after && text.slice(end).trimStart().startsWith(after) ? after.length : 0);
      if (score < best) continue;
      if (score === best) { ambiguous = true; continue; }
      while (startSpan + 1 < spans.length && spans[startSpan + 1].at <= at) startSpan++;
      while (endSpan + 1 < spans.length && spans[endSpan + 1].at < end) endSpan++;
      const start = spans[startSpan], finish = spans[endSpan];
      if (at >= start.at + start.length || end > finish.at + finish.length) continue;
      match = [start, at, finish, end];
      best = score;
      ambiguous = false;
    }
    if (!match || ambiguous || (best === 0 && (before || after))) return null;
    const [start, at, finish, end] = match;
    const range = doc.createRange();
    range.setStart(start.node, start.offset + at - start.at);
    range.setEnd(finish.node, finish.offset + end - finish.at);
    return range;
  }

  function refresh(snapshot, doc, source) {
    const candidate = doc.createRange();
    try {
      const { start, startOffset, end, endOffset } = snapshot.boundaries;
      if (start.isConnected && end.isConnected) {
        candidate.setStart(start, startOffset);
        candidate.setEnd(end, endOffset);
        if (candidate.toString().trim() === snapshot.selectedText) return extract({ ...snapshot, range: candidate }, source);
      }
    } catch { /* The page changed a saved boundary. */ }
    const range = findQuote(snapshot.scope, snapshot);
    if (range) return { ...extract({ ...snapshot, range }, source), contextQuality: 'quote' };
    return { ...source, sourceType: snapshot.sourceType, selectedText: snapshot.selectedText,
      contextBefore: '', contextAfter: '', contextQuality: 'selection-only', range: null };
  }

  globalThis.ctxSelection = { read, extract, refresh, findQuote };
})();
