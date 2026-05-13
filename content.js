/* ============================================================
   Context Explain — content.js
   ============================================================ */

// ─── Markdown + KaTeX Renderer ───────────────────────────────────────────────
// marked.js handles all Markdown; KaTeX handles LaTeX math.

function renderMarkdown(raw) {
  if (!raw) return '';

  // 1. Extract LaTeX math blocks BEFORE passing to marked, so marked doesn't
  //    mangle backslashes / underscores inside formulas.
  const maths = [];
  const ph = (display, tex) => {
    maths.push({ display, tex });
    return `MATHPH${maths.length - 1}MATHPH`;
  };

  let text = raw;
  text = text.replace(/\$\$([\s\S]+?)\$\$/g,   (_, t) => ph(true,  t));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g,    (_, t) => ph(true,  t));
  text = text.replace(/\\\(([^]*?)\\\)/g,        (_, t) => ph(false, t));
  // single $ — only when clearly math (not currency: must have letter/digit after $)
  text = text.replace(/(?<![\\$])\$([^$\n]{1,200}?)\$(?!\d)/g, (_, t) => ph(false, t));

  // 2. Run marked (full CommonMark-compatible Markdown)
  let html;
  try {
    // Custom renderer: keep code block styling consistent with our panel CSS
    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }) => {
      if (lang === 'mermaid') {
        // Render as a mermaid div; actual diagram injected after DOM insertion
        const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<div class="mermaid-block" data-raw="${escaped}">\
<div class="mermaid-loading">⟳ Rendering diagram…</div></div>`;
      }
      const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
      return `<pre class="code-block">${langLabel}<code>${escaped}</code></pre>`;
    };
    html = marked.parse(text, {
      gfm: true,
      breaks: false,
      renderer,
    });
  } catch (e) {
    html = `<p>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`;
  }

  // 3. Restore math placeholders → KaTeX rendered HTML
  if (typeof katex !== 'undefined') {
    html = html.replace(/MATHPH(\d+)MATHPH/g, (_, idx) => {
      const { display, tex } = maths[parseInt(idx)];
      try {
        return katex.renderToString(tex, {
          displayMode: display, throwOnError: false, output: 'html', trust: false,
        });
      } catch (e) {
        return `<code class="math-fallback">${tex}</code>`;
      }
    });
  } else {
    // KaTeX unavailable — restore raw LaTeX inside <code>
    html = html.replace(/MATHPH(\d+)MATHPH/g, (_, idx) => {
      const { tex } = maths[parseInt(idx)];
      return `<code class="math-fallback">${tex}</code>`;
    });
  }

  return html;
}

// ─── Mermaid renderer ────────────────────────────────────────────────────────
function renderMermaidBlocks(container) {
  if (typeof mermaid === 'undefined') return;
  const blocks = container.querySelectorAll('.mermaid-block[data-raw]');
  if (!blocks.length) return;

  // Initialize once
  if (!renderMermaidBlocks._init) {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    renderMermaidBlocks._init = true;
  }

  blocks.forEach((el, i) => {
    const raw = el.dataset.raw
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    const id = `mermaid-${Date.now()}-${i}`;
    mermaid.render(id, raw).then(({ svg }) => {
      el.innerHTML = svg;
      el.removeAttribute('data-raw');
    }).catch(err => {
      el.innerHTML = `<pre class="mermaid-error">Mermaid error: ${err.message||err}</pre>`;
    });
  });
}


const PANEL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { all: initial; }

  .panel {
    position: fixed;
    background: rgba(10, 10, 16, 0.97);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(232, 160, 48, 0.22);
    border-radius: 13px;
    box-shadow: 0 28px 72px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06);
    width: 380px;
    max-height: 520px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    z-index: 2147483647;
    opacity: 0;
    transform: translateY(10px) scale(0.98);
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
    user-select: text;
  }
  .panel.visible { opacity: 1; transform: translateY(0) scale(1); }

  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }
  .panel-header:active { cursor: grabbing; }

  .logo { color: #e8a030; font-family: 'SF Mono','Fira Code',monospace; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }

  .header-right { display: flex; align-items: center; gap: 6px; }

  .retry-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: transparent; border: none; color: #555; font-size: 13px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s;
    display: none;
  }
  .retry-btn.visible { display: flex; }
  .retry-btn:hover { color: #e8a030; background: rgba(232,160,48,0.12); }

  .close-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: transparent; border: none; color: #555; font-size: 17px; line-height: 1;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s; flex-shrink: 0;
  }
  .close-btn:hover { color: #e8a030; background: rgba(232,160,48,0.12); }

  .term-block {
    padding: 9px 14px;
    background: rgba(232,160,48,0.07);
    border-left: 3px solid #e8a030;
    font-family: 'SF Mono','Fira Code',monospace;
    color: #e8d5a8; font-size: 12px; line-height: 1.5;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; flex-shrink: 0; word-break: break-word;
  }

  .conversation-body {
    padding: 0; overflow-y: auto; flex-grow: 1;
    scrollbar-width: thin; scrollbar-color: rgba(232,160,48,0.18) transparent;
  }
  .conversation-body::-webkit-scrollbar { width: 4px; }
  .conversation-body::-webkit-scrollbar-thumb { background: rgba(232,160,48,0.2); border-radius: 2px; }

  .response-block {
    padding: 13px 15px; color: #d0ccc4; line-height: 1.75; font-size: 13.5px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    word-break: break-word; border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .response-block:last-child { border-bottom: none; }
  .response-block p { margin: 0 0 8px; }
  .response-block p:last-child { margin-bottom: 0; }
  .response-block .para-break { height: 6px; }
  .response-block h1 { font-size: 15px; font-weight: 700; color: #f0e8d4; margin: 10px 0 6px; }
  .response-block h2 { font-size: 14px; font-weight: 700; color: #f0e8d4; margin: 10px 0 5px; }
  .response-block h3 { font-size: 13px; font-weight: 700; color: #e8d5a8; margin: 8px 0 4px; }
  .response-block strong { color: #f0e8d4; font-weight: 600; }
  .response-block em { color: #c8c0b0; font-style: italic; }
  .response-block del { opacity: 0.5; text-decoration: line-through; }
  .response-block a { color: #e8a030; text-decoration: none; border-bottom: 1px solid rgba(232,160,48,0.3); }
  .response-block a:hover { border-bottom-color: #e8a030; }
  .response-block code {
    font-family: 'SF Mono','Fira Code',monospace; font-size: 11.5px;
    background: rgba(232,160,48,0.1); color: #e8d5a8;
    padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(232,160,48,0.15);
  }
  .response-block pre.code-block {
    background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; padding: 11px 13px; overflow-x: auto; margin: 8px 0; position: relative;
  }
  .response-block pre.code-block code {
    background: none; border: none; padding: 0; font-size: 11.5px; color: #c8f0a8;
    display: block; line-height: 1.6; white-space: pre;
  }
  .response-block .code-lang { position: absolute; top: 6px; right: 10px; font-size: 10px; color: #555; font-family: 'SF Mono',monospace; }
  .response-block ul, .response-block ol { padding-left: 18px; margin: 6px 0; }
  .response-block li { margin: 3px 0; }
  .response-block blockquote { border-left: 3px solid rgba(232,160,48,0.4); padding-left: 11px; margin: 6px 0; color: #9a9080; font-style: italic; }
  .response-block .katex-display { margin: 10px 0; overflow-x: auto; }
  .response-block .katex { font-size: 1em; color: #e8d5c0; }
  .response-block .math-fallback { background: rgba(232,160,48,0.08); color: #c8b890; padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }
  .response-block .mermaid-block { margin: 10px 0; text-align: center; }
  .response-block .mermaid-block svg { max-width: 100%; height: auto; border-radius: 6px; }
  .response-block .mermaid-loading { color: #888; font-size: 12px; padding: 12px 0; }
  .response-block .mermaid-error { color: #d06060; font-size: 11.5px; white-space: pre-wrap; }
  .response-block hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 10px 0; }

  .status-loading { color: #666; font-style: italic; font-size: 13px; }
  .cursor-blink {
    display: inline-block; width: 2px; height: 1em; background: #e8a030;
    vertical-align: text-bottom; margin-left: 2px;
    animation: blink 0.75s step-end infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .error-msg { color: #d06060; font-size: 13px; line-height: 1.5; }

  .question-bubble {
    padding: 9px 15px;
    background: rgba(232,160,48,0.06);
    border-left: 2px solid rgba(232,160,48,0.35);
    font-size: 12.5px; color: #a89870;
    font-style: italic; word-break: break-word;
  }

  /* ── Footer ── */
  .panel-footer { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); }
  .footer-actions { display: flex; align-items: center; padding: 8px 14px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .copy-btn {
    padding: 4px 13px; border-radius: 20px;
    border: 1px solid rgba(232,160,48,0.35); background: transparent;
    color: #e8a030; font-size: 11.5px; font-weight: 500; cursor: pointer;
    font-family: -apple-system, sans-serif; transition: background 0.15s, color 0.15s;
  }
  .copy-btn:hover:not(:disabled) { background: #e8a030; color: #0a0a0c; }
  .copy-btn:disabled { opacity: 0.3; cursor: default; }

  .footer-status { font-size: 11px; color: #444; flex-grow: 1; text-align: right; letter-spacing: 0.02em; }
  .footer-status.done { color: #5a9e6f; }
  .footer-status.error-st { color: #d06060; }
  .footer-status.streaming { color: #888; }
  .footer-status.stalled { color: #c09040; }

  /* ── Follow-up ── */
  .followup-area { display: none; padding: 9px 10px 10px; gap: 7px; align-items: flex-end; }
  .followup-area.visible { display: flex; }
  .followup-input {
    flex: 1; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
    color: #d4d0c8; font-size: 12.5px; font-family: -apple-system, sans-serif;
    padding: 7px 10px; resize: none; outline: none;
    line-height: 1.5; min-height: 34px; max-height: 90px; overflow-y: auto;
    transition: border-color 0.15s;
  }
  .followup-input::placeholder { color: #3a3a48; }
  .followup-input:focus { border-color: rgba(232,160,48,0.4); }
  .followup-send {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px;
    background: #e8a030; border: none; color: #0a0a0c; font-size: 15px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, opacity 0.15s; font-weight: 700;
  }
  .followup-send:hover { background: #f0b040; }
  .followup-send:disabled { opacity: 0.3; cursor: default; }
`;

// ─── State ────────────────────────────────────────────────────────────────────
let triggerBtn = null;       // now a wrapper div containing two buttons
let panelRoot = null;
let shadowRoot = null;
let panelEl = null;
let conversationBody = null;
let currentResponseBlock = null;
let copyBtn = null;
let footerStatus = null;
let retryBtn = null;
let followupArea = null;
let followupInput = null;
let followupSend = null;
let currentPort = null;          // kept for potential future use, not used for streaming
let currentAbortController = null; // AbortController for in-flight fetch
let isStreaming = false;
let streamTimeout = null;
let stallCheckInterval = null;
let lastChunkTime = 0;
let accumulatedText = '';
let conversationMessages = [];
let currentTerm = '';
let currentContextBefore = '';
let currentContextAfter = '';

// Panel position memory: contextKey -> {left, top}
const panelPositions = new Map();

// ─── Page annotation state ────────────────────────────────────────────────────
// Map: contextKey -> { term, explanation, followUps, nodes: [<mark el>], scrollMarkers: [el] }
const pageAnnotations = new Map();
let scrollbarCanvas = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isEditable(node) {
  if (!node) return false;
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') return true;
  if (node.isContentEditable) return true;
  if (node.closest && node.closest('[contenteditable="true"]')) return true;
  return false;
}

function extractContext(selection) {
  const selectedText = selection.toString().trim();
  const range = selection.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;

  const blockTags = ['P','DIV','ARTICLE','SECTION','LI','TD','BLOCKQUOTE','MAIN','FIGURE','HEADER','FOOTER'];
  while (container && !blockTags.includes(container.tagName) && container !== document.body) {
    container = container.parentElement;
  }

  const fullText = (container || document.body).innerText || '';
  const idx = fullText.indexOf(selectedText);
  const contextLen = 400;
  const before = idx > 0 ? fullText.substring(Math.max(0, idx - contextLen), idx) : '';
  const after = fullText.substring(idx + selectedText.length, idx + selectedText.length + contextLen);
  return {
    selectedText,
    contextBefore: before.trimStart(),
    contextAfter: after.trimEnd(),
    range: range.cloneRange()
  };
}

// Make a stable key from term + context snippet (handles same word in different places)
function makeContextKey(term, contextBefore, contextAfter) {
  const snippet = (contextBefore.slice(-60) + '|' + term + '|' + contextAfter.slice(0, 60));
  return snippet;
}

// ─── History ──────────────────────────────────────────────────────────────────
function saveToHistory(term, contextBefore, contextAfter, explanation, followUps) {
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2),
    ts: Date.now(),
    url: location.href,
    pageTitle: document.title,
    term, contextBefore, contextAfter,
    explanation,
    followUps: followUps || []
  };
  return new Promise(resolve => {
    chrome.storage.local.get(['ctxHistory'], (data) => {
      const hist = data.ctxHistory || [];
      hist.unshift(entry);
      if (hist.length > 2000) hist.length = 2000;
      chrome.storage.local.set({ ctxHistory: hist }, () => resolve(entry));
    });
  });
}

function updateHistoryFollowup(historyId, question, answer) {
  if (!historyId) return Promise.resolve();
  return new Promise(resolve => {
    chrome.storage.local.get(['ctxHistory'], (data) => {
      const hist = data.ctxHistory || [];
      const entry = hist.find(e => e.id === historyId);
      if (entry) {
        if (!entry.followUps) entry.followUps = [];
        entry.followUps.push({ q: question, a: answer });
        chrome.storage.local.set({ ctxHistory: hist }, resolve);
      } else {
        resolve();
      }
    });
  });
}

let currentHistoryId = null;

// ─── Page Annotation ──────────────────────────────────────────────────────────

function annotateRange(range, contextKey, entry) {
  if (!range) return;
  try {
    // Wrap selected text in <mark> elements
    const marks = [];
    const fragment = range.cloneContents();
    const text = fragment.textContent;
    if (!text.trim()) return;

    // Create wrapper span
    const wrapper = document.createElement('span');
    wrapper.className = 'ctx-explain-mark';
    wrapper.dataset.contextKey = contextKey;
    Object.assign(wrapper.style, {
      borderBottom: '2px solid rgba(232,160,48,0.7)',
      cursor: 'pointer',
      position: 'relative',
      display: 'inline',
    });

    // Surround range contents
    try {
      range.surroundContents(wrapper);
      marks.push(wrapper);
    } catch (e) {
      // Range spans multiple elements — wrap each text node individually
      const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (range.intersectsNode(node)) textNodes.push(node);
      }
      for (const tn of textNodes) {
        const span = document.createElement('span');
        span.className = 'ctx-explain-mark';
        span.dataset.contextKey = contextKey;
        Object.assign(span.style, {
          borderBottom: '2px solid rgba(232,160,48,0.7)',
          cursor: 'pointer',
          display: 'inline',
        });
        tn.parentNode.insertBefore(span, tn);
        span.appendChild(tn);
        marks.push(span);
      }
    }

    // Store annotation
    if (!pageAnnotations.has(contextKey)) {
      pageAnnotations.set(contextKey, { entry, marks, scrollMarkers: [] });
    } else {
      pageAnnotations.get(contextKey).marks.push(...marks);
    }

    // Attach hover behavior
    for (const mark of marks) {
      attachMarkHover(mark, contextKey);
    }

    // Add scrollbar marker
    addScrollbarMarker(contextKey, marks[0]);

  } catch (e) {
    // Annotation failed silently — common on dynamic pages
  }
}

function attachMarkHover(mark, contextKey) {
  let hoverPopup = null;
  let hoverTimeout = null;

  const showPopup = () => {
    clearTimeout(hoverTimeout);
    if (hoverPopup) return;

    const rect = mark.getBoundingClientRect();

    hoverPopup = document.createElement('div');
    hoverPopup.className = 'ctx-explain-hover-popup';
    Object.assign(hoverPopup.style, {
      position: 'fixed',
      zIndex: '2147483646',
      display: 'flex',
      gap: '4px',
      opacity: '0',
      transition: 'opacity 0.1s',
      pointerEvents: 'all',
    });

    // ── View History button ──
    const viewBtn = document.createElement('button');
    viewBtn.textContent = '✦';
    viewBtn.title = 'View explanation';
    Object.assign(viewBtn.style, {
      width: '26px', height: '26px',
      padding: '0',
      borderRadius: '13px',
      background: '#0f0f11',
      border: '1.5px solid rgba(232,160,48,0.65)',
      color: '#e8a030',
      fontSize: '12px',
      cursor: 'pointer',
      fontFamily: '-apple-system,sans-serif',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      lineHeight: '1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    // ── Remove button ──
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    Object.assign(removeBtn.style, {
      height: '24px',
      width: '24px',
      borderRadius: '12px',
      background: '#0f0f11',
      border: '1.5px solid rgba(200,80,80,0.45)',
      color: 'rgba(200,80,80,0.7)',
      fontSize: '11px',
      cursor: 'pointer',
      fontFamily: '-apple-system,sans-serif',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      lineHeight: '1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0',
    });
    removeBtn.title = 'Remove annotation';

    hoverPopup.appendChild(viewBtn);
    hoverPopup.appendChild(removeBtn);

    // Position: right of mark, vertically centered
    const popupW = 120;
    let left = rect.right + 4;
    if (left + popupW > window.innerWidth - 8) left = rect.left - popupW - 4;
    hoverPopup.style.left = Math.max(4, left) + 'px';
    hoverPopup.style.top = rect.top + (rect.height - 24) / 2 + 'px';

    document.body.appendChild(hoverPopup);
    requestAnimationFrame(() => { if (hoverPopup) hoverPopup.style.opacity = '1'; });

    // Keep popup alive while hovering it
    hoverPopup.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
    hoverPopup.addEventListener('mouseleave', hidePopup);

    // ── View History ──
    viewBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    viewBtn.addEventListener('click', e => {
      e.stopPropagation();
      dismissPopup();
      const ann = pageAnnotations.get(contextKey);
      if (!ann) return;
      // Always read from storage to get the latest followUps
      chrome.storage.local.get(['ctxHistory'], (data) => {
        const hist = data.ctxHistory || [];
        const fresh = hist.find(e => e.id === ann.entry.id) || ann.entry;
        openFromHistory(fresh, rect.right + 4, rect.top);
      });
    });

    // ── Remove annotation ──
    removeBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      dismissPopup();
      removeAnnotation(contextKey);
    });
  };

  const hidePopup = () => {
    hoverTimeout = setTimeout(dismissPopup, 280);
  };

  const dismissPopup = () => {
    if (hoverPopup) { hoverPopup.remove(); hoverPopup = null; }
  };

  mark.addEventListener('mouseenter', showPopup);
  mark.addEventListener('mouseleave', hidePopup);
}

function removeAnnotation(contextKey) {
  const ann = pageAnnotations.get(contextKey);
  if (!ann) return;

  // Unwrap all mark spans (restore plain text nodes)
  for (const mark of ann.marks) {
    if (!mark.parentNode) continue;
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }

  pageAnnotations.delete(contextKey);
  redrawScrollbarMarkers();

  // Delete from storage history too
  chrome.storage.local.get(['ctxHistory'], (data) => {
    const hist = data.ctxHistory || [];
    const entry = ann.entry;
    const idx = hist.findIndex(e => e.id === entry.id);
    if (idx !== -1) {
      hist.splice(idx, 1);
      chrome.storage.local.set({ ctxHistory: hist });
    }
  });
}

// ─── Scrollbar Overlay ────────────────────────────────────────────────────────

function ensureScrollbarCanvas() {
  if (scrollbarCanvas && document.body.contains(scrollbarCanvas)) return scrollbarCanvas;

  scrollbarCanvas = document.createElement('canvas');
  scrollbarCanvas.id = 'ctx-explain-scrollbar';
  const W = 12;
  Object.assign(scrollbarCanvas.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: W + 'px',
    height: '100vh',
    zIndex: '2147483640',
    pointerEvents: 'none',
  });
  scrollbarCanvas.width = W;
  scrollbarCanvas.height = window.innerHeight;
  document.body.appendChild(scrollbarCanvas);

  window.addEventListener('resize', redrawScrollbarMarkers);
  return scrollbarCanvas;
}

function redrawScrollbarMarkers() {
  if (!scrollbarCanvas) return;
  const canvas = scrollbarCanvas;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const docH = document.documentElement.scrollHeight;
  const viewH = window.innerHeight;
  const scrollFraction = viewH / docH;

  for (const [, ann] of pageAnnotations) {
    const mark = ann.marks[0];
    if (!mark || !document.body.contains(mark)) continue;

    const rect = mark.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    // Map absolute position to scrollbar track area
    // Track occupies the full canvas height but represents the full doc
    const y = (absTop / docH) * canvas.height;

    ctx.fillStyle = 'rgba(232, 160, 48, 0.7)';
    ctx.fillRect(2, Math.max(0, y - 2), canvas.width - 4, 4);
  }
}

function addScrollbarMarker(contextKey, markEl) {
  ensureScrollbarCanvas();
  // Delay to let layout settle
  setTimeout(redrawScrollbarMarkers, 100);
  setTimeout(redrawScrollbarMarkers, 600);
}

// ─── Open from history (annotated mark clicked) ───────────────────────────────
function openFromHistory(entry, btnX, btnY) {
  removePanel();

  currentTerm = entry.term;
  currentContextBefore = entry.contextBefore || '';
  currentContextAfter = entry.contextAfter || '';
  currentHistoryId = entry.id;
  _askModeFirstMessage = false;

  const contextKey = makeContextKey(entry.term, entry.contextBefore, entry.contextAfter);

  // Build panel — will restore saved position if available
  buildPanel(btnX, btnY, contextKey);

  // Load conversation from history
  conversationMessages = [{
    role: 'user',
    content: buildInitialPrompt({ selectedText: entry.term, contextBefore: entry.contextBefore, contextAfter: entry.contextAfter })
  }];

  // Show cached explanation immediately (no streaming)
  if (currentResponseBlock) {
    if (entry.explanation) {
      currentResponseBlock.innerHTML = renderMarkdown(entry.explanation);
      renderMermaidBlocks(currentResponseBlock);
    } else {
      // Ask mode: no initial explanation — remove the default "Thinking…" block entirely
      currentResponseBlock.remove();
      currentResponseBlock = null;
    }
  }

  // Show follow-ups
  if (entry.followUps && entry.followUps.length > 0) {
    for (const fu of entry.followUps) {
      conversationMessages.push({ role: 'user',      content: fu.q });
      conversationMessages.push({ role: 'assistant', content: fu.a });

      const bubble = document.createElement('div');
      bubble.className = 'question-bubble';
      bubble.textContent = fu.q;
      conversationBody.appendChild(bubble);

      const block = document.createElement('div');
      block.className = 'response-block';
      block.innerHTML = renderMarkdown(fu.a);
      renderMermaidBlocks(block);
      conversationBody.appendChild(block);
    }
  } else {
    // Just the explanation
    conversationMessages.push({ role: 'assistant', content: entry.explanation });
  }

  accumulatedText = '';
  isStreaming = false;

  if (footerStatus) { footerStatus.textContent = 'From history'; footerStatus.className = 'footer-status done'; }
  if (copyBtn) copyBtn.disabled = false;
  if (followupArea) followupArea.classList.add('visible');
  if (followupInput) followupInput.focus();
}

// ─── Trigger Buttons (Explain + Ask) ─────────────────────────────────────────
function removeTriggerBtn() {
  if (triggerBtn && triggerBtn.parentNode) triggerBtn.parentNode.removeChild(triggerBtn);
  triggerBtn = null;
}

function showTriggerBtn(x, y) {
  removeTriggerBtn();

  // Wrapper div holding two pill buttons side by side
  const wrap = document.createElement('div');
  wrap.id = 'ctx-explain-trigger';
  Object.assign(wrap.style, {
    position: 'fixed',
    zIndex: '2147483647',
    left: Math.min(x, window.innerWidth - 76) + 'px',
    top: Math.min(y, window.innerHeight - 32) + 'px',
    display: 'flex',
    gap: '4px',
    opacity: '0',
    transform: 'scale(0.85) translateY(-2px)',
    transition: 'opacity 0.12s, transform 0.12s',
    userSelect: 'none',
    pointerEvents: 'all',
  });

  const btnStyle = {
    height: '26px',
    borderRadius: '13px',
    background: '#0f0f11',
    border: '1.5px solid rgba(232,160,48,0.6)',
    color: '#e8a030',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 3px 12px rgba(0,0,0,0.55)',
    padding: '0 8px',
    lineHeight: '1',
    fontFamily: '-apple-system,sans-serif',
    whiteSpace: 'nowrap',
    position: 'relative',
  };

  // ── Explain button ──
  const explainBtn = document.createElement('button');
  explainBtn.innerHTML = '✦';
  explainBtn.title = 'Explain';
  Object.assign(explainBtn.style, btnStyle);

  // Tooltip label
  const explainLabel = makeTooltip('Explain');
  explainBtn.appendChild(explainLabel);

  explainBtn.addEventListener('mouseenter', () => { explainLabel.style.opacity = '1'; explainLabel.style.transform = 'translateX(-50%) translateY(0)'; });
  explainBtn.addEventListener('mouseleave', () => { explainLabel.style.opacity = '0'; explainLabel.style.transform = 'translateX(-50%) translateY(-3px)'; });

  // ── Ask button ──
  const askBtn = document.createElement('button');
  askBtn.innerHTML = '?';
  Object.assign(askBtn.style, {
    ...btnStyle,
    fontSize: '13px',
    fontWeight: '700',
    color: '#a8c8f0',
    border: '1.5px solid rgba(120,180,255,0.45)',
  });

  const askLabel = makeTooltip('Ask');
  askBtn.appendChild(askLabel);

  askBtn.addEventListener('mouseenter', () => { askLabel.style.opacity = '1'; askLabel.style.transform = 'translateX(-50%) translateY(0)'; });
  askBtn.addEventListener('mouseleave', () => { askLabel.style.opacity = '0'; askLabel.style.transform = 'translateX(-50%) translateY(-3px)'; });

  wrap.appendChild(explainBtn);
  wrap.appendChild(askBtn);

  // Stop mousedown from clearing selection
  wrap.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });

  explainBtn.addEventListener('click', e => {
    e.stopPropagation();
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) return;
    const ctx = extractContext(sel);
    removeTriggerBtn();
    showPanel(ctx, x, y, 'explain');
  });

  askBtn.addEventListener('click', e => {
    e.stopPropagation();
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) return;
    const ctx = extractContext(sel);
    removeTriggerBtn();
    showPanel(ctx, x, y, 'ask');
  });

  document.body.appendChild(wrap);
  triggerBtn = wrap;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (triggerBtn) { triggerBtn.style.opacity = '1'; triggerBtn.style.transform = 'scale(1) translateY(0)'; }
  }));
}

function makeTooltip(text) {
  const tip = document.createElement('span');
  tip.textContent = text;
  Object.assign(tip.style, {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%) translateY(-3px)',
    background: 'rgba(10,10,16,0.95)',
    color: '#d4d0c8',
    fontSize: '11px',
    padding: '3px 7px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.12s, transform 0.12s',
    zIndex: '1',
  });
  return tip;
}

// ─── Panel core builder ───────────────────────────────────────────────────────
function removePanel() {
  abortStream();
  _askModeFirstMessage = false;
  _askModeQuestion = null;
  // Save panel position before removing
  if (panelEl) {
    const key = makeContextKey(currentTerm, currentContextBefore, currentContextAfter);
    if (key) panelPositions.set(key, { left: panelEl.style.left, top: panelEl.style.top });
  }
  if (panelRoot && panelRoot.parentNode) panelRoot.parentNode.removeChild(panelRoot);
  panelRoot = shadowRoot = panelEl = conversationBody = currentResponseBlock = null;
  copyBtn = footerStatus = retryBtn = followupArea = followupInput = followupSend = null;
  accumulatedText = '';
  conversationMessages = [];
  currentHistoryId = null;
}

function abortStream() {
  isStreaming = false;
  if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
  if (stallCheckInterval) { clearInterval(stallCheckInterval); stallCheckInterval = null; }
  if (currentAbortController) { currentAbortController.abort(); currentAbortController = null; }
}

// contextKey passed so we can look up saved position
function buildPanel(btnX, btnY, contextKey) {
  panelRoot = document.createElement('div');
  panelRoot.id = 'ctx-explain-root';
  Object.assign(panelRoot.style, { position: 'fixed', top: '0', left: '0', zIndex: '2147483647', pointerEvents: 'none' });
  document.body.appendChild(panelRoot);

  shadowRoot = panelRoot.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = PANEL_STYLES;
  shadowRoot.appendChild(styleEl);

  // Inject KaTeX CSS into Shadow DOM (fonts referenced via extension URL)
  if (typeof katex !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      const katexLink = document.createElement('link');
      katexLink.rel = 'stylesheet';
      katexLink.href = chrome.runtime.getURL('lib/katex.min.css');
      shadowRoot.appendChild(katexLink);
    } catch (e) { /* extension context invalidated — skip */ }
  }

  panelEl = document.createElement('div');
  panelEl.className = 'panel';
  panelEl.style.pointerEvents = 'all';
  panelEl.innerHTML = `
    <div class="panel-header">
      <span class="logo">✦ Context Explain</span>
      <div class="header-right">
        <button class="retry-btn" title="Retry">↺</button>
        <button class="close-btn" title="Close">×</button>
      </div>
    </div>
    <div class="term-block"></div>
    <div class="conversation-body"></div>
    <div class="panel-footer">
      <div class="footer-actions">
        <button class="copy-btn" disabled>Copy</button>
        <span class="footer-status streaming">Explaining…</span>
      </div>
      <div class="followup-area">
        <textarea class="followup-input" placeholder="Ask a follow-up question…" rows="1"></textarea>
        <button class="followup-send" disabled title="Send">↑</button>
      </div>
    </div>
  `;
  shadowRoot.appendChild(panelEl);

  panelEl.querySelector('.term-block').textContent = currentTerm;
  conversationBody = panelEl.querySelector('.conversation-body');
  copyBtn = panelEl.querySelector('.copy-btn');
  footerStatus = panelEl.querySelector('.footer-status');
  retryBtn = panelEl.querySelector('.retry-btn');
  followupArea = panelEl.querySelector('.followup-area');
  followupInput = panelEl.querySelector('.followup-input');
  followupSend = panelEl.querySelector('.followup-send');

  // Initial response block
  currentResponseBlock = document.createElement('div');
  currentResponseBlock.className = 'response-block';
  currentResponseBlock.innerHTML = '<span class="status-loading">Thinking…</span>';
  conversationBody.appendChild(currentResponseBlock);

  // ── Position: restore saved position or calculate from trigger ──
  const PW = 380, PH = 520, M = 8;
  const saved = contextKey && panelPositions.get(contextKey);
  if (saved) {
    let left = Math.max(M, Math.min(parseInt(saved.left), window.innerWidth  - PW - M));
    let top  = Math.max(M, Math.min(parseInt(saved.top),  window.innerHeight - PH - M));
    panelEl.style.left = left + 'px';
    panelEl.style.top  = top  + 'px';
  } else {
    const spaceBelow = window.innerHeight - btnY;
    const spaceAbove = btnY;
    let top  = spaceBelow >= 220 || spaceBelow >= spaceAbove ? btnY + 10 : btnY - PH - 10;
    let left = btnX - PW + 20;
    top  = Math.max(M, Math.min(top,  window.innerHeight - PH - M));
    left = Math.max(M, Math.min(left, window.innerWidth  - PW - M));
    panelEl.style.left = left + 'px';
    panelEl.style.top  = top  + 'px';
  }

  requestAnimationFrame(() => requestAnimationFrame(() => { if (panelEl) panelEl.classList.add('visible'); }));

  // Close
  panelEl.querySelector('.close-btn').addEventListener('click', removePanel);

  // Retry
  retryBtn.addEventListener('click', () => {
    if (isStreaming) return;
    retryBtn.classList.remove('visible');
    if (currentResponseBlock && conversationBody.contains(currentResponseBlock)) currentResponseBlock.remove();
    currentResponseBlock = document.createElement('div');
    currentResponseBlock.className = 'response-block';
    currentResponseBlock.innerHTML = '<span class="status-loading">Retrying…</span>';
    conversationBody.appendChild(currentResponseBlock);
    conversationBody.scrollTop = conversationBody.scrollHeight;
    if (footerStatus) { footerStatus.textContent = 'Retrying…'; footerStatus.className = 'footer-status streaming'; }
    if (copyBtn) copyBtn.disabled = true;
    followupArea.classList.remove('visible');
    accumulatedText = '';
    startStream();
  });

  // Copy
  copyBtn.addEventListener('click', () => {
    const blocks = conversationBody.querySelectorAll('.response-block');
    const texts = Array.from(blocks).map(b => b.innerText).join('\n\n---\n\n');
    navigator.clipboard.writeText(texts).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = texts;
      Object.assign(ta.style, { position:'fixed', opacity:'0' });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    });
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy'; }, 1800);
  });

  // Follow-up
  followupSend.addEventListener('click', sendFollowup);
  followupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowup(); }
  });
  followupInput.addEventListener('input', () => {
    followupInput.style.height = 'auto';
    followupInput.style.height = Math.min(followupInput.scrollHeight, 90) + 'px';
    if (followupSend) followupSend.disabled = !followupInput.value.trim() || isStreaming;
  });

  // Draggable
  makeDraggable(panelEl, panelEl.querySelector('.panel-header'));
}

// mode: 'explain' | 'ask'
function showPanel(ctx, btnX, btnY, mode) {
  removePanel();
  currentTerm = ctx.selectedText;
  currentContextBefore = ctx.contextBefore;
  currentContextAfter = ctx.contextAfter;
  currentHistoryId = null;

  const contextKey = makeContextKey(ctx.selectedText, ctx.contextBefore, ctx.contextAfter);
  buildPanel(btnX, btnY, contextKey);

  if (mode === 'ask') {
    // Ask mode: skip auto-explain, show input immediately, hide loading block
    if (currentResponseBlock) currentResponseBlock.remove();
    currentResponseBlock = null;
    if (footerStatus) { footerStatus.textContent = 'Ask mode'; footerStatus.className = 'footer-status done'; }
    if (followupArea) followupArea.classList.add('visible');
    // Pre-fill placeholder to indicate context
    if (followupInput) {
      followupInput.placeholder = `Ask about "${ctx.selectedText.slice(0, 40)}${ctx.selectedText.length > 40 ? '…' : ''}"`;
      followupInput.focus();
    }
    // Prime the conversation with a silent system context message for follow-ups
    // First real user message will be what they type
    conversationMessages = [];
    // We'll build the first message when user submits
    accumulatedText = '';
    // Override sendFollowup to handle first message specially in ask mode
    _askModeFirstMessage = true;
  } else {
    // Explain mode (default)
    const userContent = buildInitialPrompt(ctx);
    conversationMessages = [{ role: 'user', content: userContent }];
    accumulatedText = '';
    startStream();
  }
}

// Flag for ask-mode first message
let _askModeFirstMessage = false;
let _askModeQuestion = null; // stores the user's question for ask-mode first turn

function buildInitialPrompt(ctx) {
  return `Selected text: "${ctx.selectedText}"\n\nSurrounding context:\n…${ctx.contextBefore}[${ctx.selectedText}]${ctx.contextAfter}…\n\nPlease explain what "${ctx.selectedText}" means in this context. If it's a technical term, acronym, or concept, explain it clearly. Be focused and practical.`;
}

function buildAskPrompt(ctx, question) {
  return `I'm reading a page and selected this text: "${ctx.selectedText}"\n\nContext: …${ctx.contextBefore}[${ctx.selectedText}]${ctx.contextAfter}…\n\nMy question: ${question}`;
}

// ─── Draggable ────────────────────────────────────────────────────────────────
function makeDraggable(panel, handle) {
  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.close-btn') || e.target.closest('.retry-btn')) return;
    e.preventDefault();

    // Immediately stop entrance transition and lock current rendered position
    // (panel may still be mid-animation when user grabs it)
    const rect = panel.getBoundingClientRect();
    panel.style.transition = 'none';
    panel.style.left = rect.left + 'px';
    panel.style.top  = rect.top  + 'px';
    // Also kill the opacity/transform animation classes so they don't fight us
    panel.classList.add('visible'); // ensure opacity=1

    dragging = true;
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;
    handle.style.cursor = 'grabbing';
  });

  const onMove = (e) => {
    if (!dragging) return;
    let nx = Math.max(4, Math.min(e.clientX - ox, window.innerWidth - 384));
    let ny = Math.max(4, Math.min(e.clientY - oy, window.innerHeight - 60));
    panel.style.left = nx + 'px';
    panel.style.top  = ny + 'px';
  };

  const onUp = () => { dragging = false; handle.style.cursor = 'grab'; };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  // Cleanup on panel removal
  const check = setInterval(() => {
    if (!panelRoot) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      clearInterval(check);
    }
  }, 1000);
}

// ─── Follow-up / Ask-mode send ────────────────────────────────────────────────
function sendFollowup() {
  const question = followupInput ? followupInput.value.trim() : '';
  if (!question || isStreaming) return;

  followupInput.value = '';
  followupInput.style.height = 'auto';
  followupSend.disabled = true;

  if (_askModeFirstMessage) {
    // First message in ask mode: build full contextual prompt
    _askModeFirstMessage = false;
    conversationMessages = [{
      role: 'user',
      content: buildAskPrompt({ selectedText: currentTerm, contextBefore: currentContextBefore, contextAfter: currentContextAfter }, question)
    }];
    // Mark that this is an ask-mode first message so onDone saves it correctly
    _askModeQuestion = question;

    // Show the question as a bubble
    const bubble = document.createElement('div');
    bubble.className = 'question-bubble';
    bubble.textContent = question;
    conversationBody.appendChild(bubble);
  } else {
    conversationMessages.push({ role: 'assistant', content: accumulatedText });
    conversationMessages.push({ role: 'user', content: question });

    const bubble = document.createElement('div');
    bubble.className = 'question-bubble';
    bubble.textContent = question;
    conversationBody.appendChild(bubble);
  }

  currentResponseBlock = document.createElement('div');
  currentResponseBlock.className = 'response-block';
  currentResponseBlock.innerHTML = '<span class="status-loading">Thinking…</span>';
  conversationBody.appendChild(currentResponseBlock);

  conversationBody.scrollTop = conversationBody.scrollHeight;
  if (footerStatus) { footerStatus.textContent = 'Explaining…'; footerStatus.className = 'footer-status streaming'; }
  if (copyBtn) copyBtn.disabled = true;
  followupArea.classList.remove('visible');
  if (retryBtn) retryBtn.classList.remove('visible');
  accumulatedText = '';

  startStream();
}

// ─── Streaming — robust against disconnects ───────────────────────────────────
const STALL_TIMEOUT = 15000;
const HARD_TIMEOUT  = 60000;

// ─── Direct fetch helpers (all in content script — no service worker needed) ──

function defaultModel(provider) {
  if (provider === 'anthropic') return 'claude-3-5-haiku-20241022';
  if (provider === 'deepseek')  return 'deepseek-chat';
  return 'gpt-4o-mini';
}

async function loadConfig() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(
        ['apiProvider','apiKey','apiModel','apiBaseUrl','responseLang'],
        (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('__invalidated__'));
          } else {
            resolve(result);
          }
        }
      );
    } catch (e) {
      reject(new Error('__invalidated__'));
    }
  });
}

function startStream() {
  abortStream();
  isStreaming = true;
  lastChunkTime = Date.now();

  // Hard timeout
  streamTimeout = setTimeout(() => {
    if (!isStreaming) return;
    handleStreamFailure('Request timed out. Click ↺ to retry.');
  }, HARD_TIMEOUT);

  // Stall checker
  stallCheckInterval = setInterval(() => {
    if (!isStreaming) { clearInterval(stallCheckInterval); return; }
    const silent = Date.now() - lastChunkTime;
    if (silent > STALL_TIMEOUT && silent < HARD_TIMEOUT - 2000) {
      if (footerStatus) { footerStatus.textContent = 'Slow response…'; footerStatus.className = 'footer-status stalled'; }
    }
  }, 3000);

  // Run async fetch directly in content script
  runFetch().catch(err => {
    if (err.name === 'AbortError') return; // user closed panel — silent
    if (err.message === '__invalidated__') {
      handleStreamFailure('插件已更新，请刷新页面后重试。\nThe extension was reloaded — please refresh the page.');
      return;
    }
    handleStreamFailure(err.message || 'Request failed.');
  });
}

async function runFetch() {
  const config = await loadConfig();
  const provider   = config.apiProvider || 'openai';
  const apiKey     = config.apiKey || '';
  const model      = config.apiModel  || defaultModel(provider);
  const apiBaseUrl = config.apiBaseUrl || '';
  const lang       = config.responseLang || 'auto';

  if (!apiKey) {
    handleStreamFailure('No API key configured. Click the extension icon to set up.');
    return;
  }

  const langInstruction = lang === 'auto' ? 'the same language as the selected text' : lang;
  const systemPrompt = `You are a knowledgeable and concise expert explainer. The user has selected text from a webpage and wants to understand it better. Explain clearly and be appropriately detailed. Use markdown formatting when helpful (bold for key terms, code blocks for code, bullet points for lists). Respond in ${langInstruction}.`;

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  if (provider === 'anthropic') {
    await fetchAnthropic({ apiKey, model, systemPrompt, messages: conversationMessages, signal });
  } else {
    await fetchOpenAI({ provider, apiKey, apiBaseUrl, model, systemPrompt, messages: conversationMessages, signal });
  }
}

async function fetchOpenAI({ provider, apiKey, apiBaseUrl, model, systemPrompt, messages, signal }) {
  let url;
  if (provider === 'openai')        url = 'https://api.openai.com/v1/chat/completions';
  else if (provider === 'deepseek') url = 'https://api.deepseek.com/v1/chat/completions';
  else                              url = apiBaseUrl.replace(/\/$/, '') + '/chat/completions';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true
    }),
    signal
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let msg = `API error ${resp.status}`;
    try { msg = JSON.parse(txt)?.error?.message || msg; } catch(e) {}
    throw new Error(msg);
  }

  await parseSSE(resp, signal, data => {
    if (data === '[DONE]') return null;
    try { return JSON.parse(data)?.choices?.[0]?.delta?.content || null; } catch { return null; }
  });
}

async function fetchAnthropic({ apiKey, model, systemPrompt, messages, signal }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages, stream: true }),
    signal
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let msg = `API error ${resp.status}`;
    try { msg = JSON.parse(txt)?.error?.message || msg; } catch(e) {}
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', lastEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('event:')) { lastEvent = t.slice(6).trim(); }
      else if (t.startsWith('data:')) {
        if (lastEvent === 'content_block_delta') {
          try {
            const text = JSON.parse(t.slice(5).trim())?.delta?.text;
            if (text && isStreaming) onChunk(text);
          } catch(e) {}
        } else if (lastEvent === 'message_stop') { break; }
        lastEvent = '';
      }
    }
  }
  if (isStreaming) onDone();
}

async function parseSSE(resp, signal, extractor) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const text = extractor(t.slice(5).trim());
      if (text && isStreaming) onChunk(text);
    }
  }
  if (isStreaming) onDone();
}

function onChunk(text) {
  lastChunkTime = Date.now();
  if (footerStatus && footerStatus.className.includes('stalled')) {
    footerStatus.textContent = 'Explaining…';
    footerStatus.className = 'footer-status streaming';
  }
  appendChunk(text);
}

function handleStreamFailure(message) {
  isStreaming = false;
  clearTimeout(streamTimeout); streamTimeout = null;
  clearInterval(stallCheckInterval); stallCheckInterval = null;

  if (currentResponseBlock) {
    const partial = accumulatedText.trim();
    if (partial.length > 20) {
      // Show partial content + error notice
      currentResponseBlock.innerHTML =
        renderMarkdown(partial) +
        `<div style="margin-top:10px;padding:6px 10px;background:rgba(200,80,80,0.07);border-radius:5px;border:1px solid rgba(200,80,80,0.15)">
           <span style="color:#c06060;font-size:12px">⚠ Stream interrupted — partial response shown.</span>
         </div>`;
    } else {
      currentResponseBlock.innerHTML = `<span class="error-msg">${escHtml(message)}</span>`;
    }
  }

  if (footerStatus) { footerStatus.textContent = 'Failed'; footerStatus.className = 'footer-status error-st'; }
  if (retryBtn) retryBtn.classList.add('visible');
  if (followupArea) followupArea.classList.add('visible');
}

// ─── Streaming render: RAF-throttled, zero re-render per chunk ────────────────
let _rafPending = false;
let _streamingTextEl = null;

function appendChunk(text) {
  if (!currentResponseBlock) return;
  accumulatedText += text;

  // First chunk: replace "Thinking…" placeholder with streaming container
  if (!_streamingTextEl) {
    currentResponseBlock.innerHTML = '';
    _streamingTextEl = document.createElement('span');
    _streamingTextEl.style.cssText = 'white-space:pre-wrap;word-break:break-word;';
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    currentResponseBlock.appendChild(_streamingTextEl);
    currentResponseBlock.appendChild(cursor);
  }

  // Throttle DOM writes to one per animation frame (zero regex, zero HTML parsing)
  if (!_rafPending) {
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      if (_streamingTextEl) _streamingTextEl.textContent = accumulatedText;
      if (conversationBody) conversationBody.scrollTop = conversationBody.scrollHeight;
    });
  }
}

async function onDone() {
  if (!isStreaming) return;
  abortStream();

  _streamingTextEl = null;
  _rafPending = false;

  // Full markdown render exactly once, after stream completes
  if (currentResponseBlock) {
    currentResponseBlock.innerHTML = renderMarkdown(accumulatedText);
    renderMermaidBlocks(currentResponseBlock);
  }

  const isInitial = conversationMessages.length === 1;

  if (isInitial && !_askModeQuestion) {
    // Explain mode: first response — save as explanation
    const entry = await saveToHistory(currentTerm, currentContextBefore, currentContextAfter, accumulatedText, []);
    currentHistoryId = entry.id;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      const contextKey = makeContextKey(currentTerm, currentContextBefore, currentContextAfter);
      annotateRange(range, contextKey, entry);
      sel.removeAllRanges();
    }
  } else if (isInitial && _askModeQuestion) {
    // Ask mode: first response — save with empty explanation, then add Q&A as followUp
    const q = _askModeQuestion;
    _askModeQuestion = null;
    const entry = await saveToHistory(currentTerm, currentContextBefore, currentContextAfter, '', []);
    currentHistoryId = entry.id;
    await updateHistoryFollowup(currentHistoryId, q, accumulatedText);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      const contextKey = makeContextKey(currentTerm, currentContextBefore, currentContextAfter);
      annotateRange(range, contextKey, entry);
      sel.removeAllRanges();
    }
  } else {
    // Follow-up done (both modes)
    const lastUserMsg = conversationMessages[conversationMessages.length - 1];
    await updateHistoryFollowup(currentHistoryId, lastUserMsg.content, accumulatedText);
  }

  if (copyBtn) copyBtn.disabled = false;
  if (footerStatus) { footerStatus.textContent = 'Done'; footerStatus.className = 'footer-status done'; }
  if (followupArea) followupArea.classList.add('visible');
  if (followupInput) setTimeout(() => followupInput.focus(), 50);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Shared logic: given the current selection, compute button position and show.
// Returns true if a trigger button was shown.
function tryShowFromSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  const selectedText = sel.toString().trim();
  if (selectedText.length === 0) return false;

  // Skip editable nodes
  const anchorEl = sel.anchorNode?.nodeType === Node.TEXT_NODE
    ? sel.anchorNode.parentElement : sel.anchorNode;
  const focusEl  = sel.focusNode?.nodeType  === Node.TEXT_NODE
    ? sel.focusNode.parentElement  : sel.focusNode;
  if (isEditable(anchorEl) || isEditable(focusEl)) return false;

  try {
    const range = sel.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    let lastRect = null;
    for (let i = rects.length - 1; i >= 0; i--) {
      if (rects[i].width > 0) { lastRect = rects[i]; break; }
    }
    if (!lastRect) lastRect = range.getBoundingClientRect();
    if (!lastRect || lastRect.width === 0) return false;

    const btnX = Math.min(lastRect.right + 4, window.innerWidth - 68);
    const btnY = lastRect.top + (lastRect.height - 28) / 2;
    showTriggerBtn(btnX, btnY);
    return true;
  } catch (err) {
    return false;
  }
}

document.addEventListener('mouseup', (e) => {
  // Ignore clicks inside our own UI
  if (panelEl && e.composedPath().includes(panelEl)) return;
  if (triggerBtn && e.composedPath().includes(triggerBtn)) return;

  // Read selection synchronously before any extension can mutate DOM/Range
  if (!tryShowFromSelection()) {
    // Only hide trigger if no text selected (not if it simply failed to show)
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) removeTriggerBtn();
  }
});

// Fallback: selectionchange fires even when mouseup is swallowed by the page.
// Debounced — we wait for the selection to stabilise after mouse release.
let _selChangeTo = null;
document.addEventListener('selectionchange', () => {
  clearTimeout(_selChangeTo);
  _selChangeTo = setTimeout(() => {
    // Only act if mouse is not currently held down (avoid mid-drag flicker)
    if (_mouseIsDown) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.toString().trim().length === 0) {
      // Selection was cleared — hide trigger
      removeTriggerBtn();
      return;
    }
    tryShowFromSelection();
  }, 120);
});

// Track mouse button state for the selectionchange guard.
// Use capture so we see events even when the page calls stopPropagation.
let _mouseIsDown = false;
document.addEventListener('mousedown', () => { _mouseIsDown = true; }, { capture: true });
document.addEventListener('mouseup',   () => { _mouseIsDown = false; }, { capture: true });

// Close trigger/panel when clicking outside our UI elements
document.addEventListener('mousedown', (e) => {
  if (!triggerBtn && !panelEl) return;
  const path = e.composedPath();
  const onTrigger   = triggerBtn && path.includes(triggerBtn);
  const onPanel     = panelEl    && path.includes(panelEl);
  const onHoverPopup = e.target.closest && e.target.closest('.ctx-explain-hover-popup');
  if (!onTrigger && !onPanel && !onHoverPopup) {
    removeTriggerBtn();
    removePanel();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { removeTriggerBtn(); removePanel(); }
});

// Redraw scrollbar markers on scroll (debounced)
let scrollRedrawTO = null;
window.addEventListener('scroll', () => {
  clearTimeout(scrollRedrawTO);
  scrollRedrawTO = setTimeout(redrawScrollbarMarkers, 80);
}, { passive: true });

// ─── Persistent annotations: restore on page load ────────────────────────────

function restoreAnnotations() {
  const pageUrl = location.href;
  chrome.storage.local.get(['ctxHistory'], (data) => {
    const hist = data.ctxHistory || [];
    // Only entries from this exact URL
    const pageEntries = hist.filter(e => e.url === pageUrl && e.term);
    if (pageEntries.length === 0) return;

    // Wait for body to be populated (DOMContentLoaded may already have fired)
    const doRestore = () => {
      for (const entry of pageEntries) {
        tryRestoreEntry(entry);
      }
      // Redraw scrollbar after all annotations placed
      setTimeout(redrawScrollbarMarkers, 300);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doRestore, { once: true });
    } else {
      // Small delay to let SPA frameworks render content
      setTimeout(doRestore, 400);
    }
  });
}

function tryRestoreEntry(entry) {
  const contextKey = makeContextKey(entry.term, entry.contextBefore || '', entry.contextAfter || '');
  if (pageAnnotations.has(contextKey)) return; // already annotated this session

  const term = entry.term;
  if (!term || term.length < 2) return;

  // Find the text node in the document that matches term + context
  const range = findTextInDocument(term, entry.contextBefore || '', entry.contextAfter || '');
  if (range) {
    annotateRange(range, contextKey, entry);
  }
}

function findTextInDocument(term, ctxBefore, ctxAfter) {
  // Walk all text nodes, find one whose surrounding text matches our context
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        // Skip scripts, styles, our own marks
        if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains('ctx-explain-mark')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Collect candidate nodes whose text contains our term
  const candidates = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.includes(term)) {
      candidates.push(node);
    }
  }

  if (candidates.length === 0) return null;

  // Score each candidate by how well surrounding text matches ctxBefore+ctxAfter
  const ctxSnippetBefore = ctxBefore.slice(-80).trim();
  const ctxSnippetAfter  = ctxAfter.slice(0, 80).trim();

  let best = null, bestScore = -1;

  for (const node of candidates) {
    // Get surrounding text by walking siblings/parent
    const parent = node.parentElement || document.body;
    const fullText = (parent.innerText || parent.textContent || '');
    const termIdx = fullText.indexOf(term);
    if (termIdx === -1) continue;

    const beforeSlice = fullText.substring(Math.max(0, termIdx - 100), termIdx).trim();
    const afterSlice  = fullText.substring(termIdx + term.length, termIdx + term.length + 100).trim();

    // Simple similarity score: count matching words
    const score = wordOverlap(beforeSlice, ctxSnippetBefore) + wordOverlap(afterSlice, ctxSnippetAfter);

    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  if (!best) return null;

  // Build a range around the term within the best text node
  try {
    const idx = best.textContent.indexOf(term);
    if (idx === -1) return null;
    const range = document.createRange();
    range.setStart(best, idx);
    range.setEnd(best, idx + term.length);
    return range;
  } catch (e) {
    return null;
  }
}

function wordOverlap(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  let count = 0;
  for (const w of setA) if (setB.has(w)) count++;
  return count;
}

// Kick off on script load
restoreAnnotations();
