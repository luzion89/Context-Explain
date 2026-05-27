/* ============================================================
   Context Explain — content.js
   ============================================================ */

// ─── Keyboard Event Isolation ────────────────────────────────────────────────
// Prevents keyboard events inside the Shadow DOM panel from leaking to the page.

function setupKeyboardIsolation(shadowRoot) {
  const handler = (e) => {
    if (e.key === 'Escape') return; // allow panel close
    if (e.key === 'Enter') return;  // allow textarea submit / newline handling
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Do NOT call preventDefault() — preserve typing, copy/paste, IME
  };
  // Use capture phase (true) to intercept before any other shadow-root listeners
  shadowRoot.addEventListener('keydown', handler, true);
  shadowRoot.addEventListener('keypress', handler, true);
  shadowRoot.addEventListener('keyup', handler, true);
}

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


function getThemeVarsCSS() {
  return `
  :host([data-theme="dark"]) {
    --bg-base: #080810;
    --bg-surface: #0e0e18;
    --bg-panel: rgba(10,10,20,0.97);
    --text-primary: #d4d0c8;
    --text-secondary: #8a8680;
    --text-hint: #7e7b76;
    --accent: #e8a030;
    --accent-dim: rgba(232,160,48,0.18);
    --accent-border: rgba(232,160,48,0.22);
    --border: rgba(255,255,255,0.08);
    --input-bg: #0e0e18;
    --error: #d06060;
    --success: #5a9e6f;
    --code-bg: rgba(232,160,48,0.1);
    --code-text: #e8d5a8;
    --scrollbar: rgba(232,160,48,0.18);
    --text-disabled: #3a3830;
    --btn-primary-text: #0a0a0c;
    --focus-ring: rgba(232,160,48,0.5);
    --input-border: rgba(255,255,255,0.1);
    --input-border-focus: rgba(232,160,48,0.55);
    --surface-hover: rgba(255,255,255,0.04);
  }

  :host([data-theme="light"]) {
    --bg-base: #f0ede8;
    --bg-surface: #faf8f5;
    --bg-panel: rgba(250,248,245,0.97);
    --text-primary: #1c1a18;
    --text-secondary: #5c5852;
    --text-hint: #9c9890;
    --accent: #c07818;
    --accent-dim: rgba(192,120,24,0.12);
    --accent-border: rgba(192,120,24,0.25);
    --border: rgba(0,0,0,0.1);
    --input-bg: #ffffff;
    --error: #c0392b;
    --success: #27ae60;
    --code-bg: rgba(192,120,24,0.08);
    --code-text: #7a4010;
    --scrollbar: rgba(192,120,24,0.2);
    --text-disabled: #b0aca8;
    --btn-primary-text: #0a0a0c;
    --focus-ring: rgba(192,120,24,0.45);
    --input-border: rgba(0,0,0,0.15);
    --input-border-focus: rgba(192,120,24,0.5);
    --surface-hover: rgba(0,0,0,0.04);
  }
  `;
}

const PANEL_STYLES = getThemeVarsCSS() + `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { all: initial; }

  .panel {
    position: fixed;
    background: var(--bg-panel);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--accent-border);
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
  .panel.has-geometry { max-height: none; }

  .panel-inner {
    display: flex; flex-direction: column; flex: 1; min-height: 0;
  }

  .ctx-resize-handle {
    position: absolute; opacity: 0; transition: opacity 0.2s;
    z-index: 10;
  }
  .ctx-resize-handle:hover { opacity: 1; }

  /* Corner handles */
  .ctx-resize-sw { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; }
  .ctx-resize-se { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; }
  .ctx-resize-sw::after,
  .ctx-resize-se::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 10px; height: 10px;
    border: 1.5px solid var(--accent-border);
    border-radius: 0 0 0 6px;
    border-top: none;
    border-right: none;
  }
  .ctx-resize-sw::after { left: 4px; }
  .ctx-resize-se::after { right: 4px; transform: scaleX(-1); }

  /* Edge handles — visible indicator: a short centered line */
  .ctx-resize-e  { top: 16px; right: -3px; width: 6px; bottom: 16px; cursor: ew-resize; }
  .ctx-resize-w  { top: 16px; left: -3px;  width: 6px; bottom: 16px; cursor: ew-resize; }
  .ctx-resize-s  { left: 16px; bottom: -3px; height: 6px; right: 16px; cursor: ns-resize; }

  .ctx-resize-e::after,
  .ctx-resize-w::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 2px; height: 24px;
    border-radius: 2px;
    background: var(--accent-border);
  }
  .ctx-resize-s::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 24px; height: 2px;
    border-radius: 2px;
    background: var(--accent-border);
  }

  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }
  .panel-header:active { cursor: grabbing; }

  .logo { color: var(--accent); font-family: 'SF Mono','Fira Code',monospace; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }

  .header-right { display: flex; align-items: center; gap: 6px; }

  .retry-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: transparent; border: none; color: var(--text-hint); font-size: 13px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s;
    display: none;
  }
  .retry-btn.visible { display: flex; }
  .retry-btn:hover { color: var(--accent); background: var(--surface-hover); }

  .pin-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: transparent; border: none;
    color: var(--text-secondary); font-size: 17px; line-height: 1;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s; padding: 0; flex-shrink: 0;
  }
  .pin-btn:hover { color: var(--accent); background: var(--accent-dim); }
  .pin-btn.active { color: var(--accent); background: var(--accent-dim); }

  .close-btn {
    width: 22px; height: 22px; border-radius: 50%;
    background: transparent; border: none; color: var(--text-hint); font-size: 17px; line-height: 1;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s; flex-shrink: 0;
  }
  .close-btn:hover { color: var(--accent); background: var(--surface-hover); }

  .term-block {
    padding: 9px 14px;
    background: var(--code-bg);
    border-left: 3px solid var(--accent);
    font-family: 'SF Mono','Fira Code',monospace;
    color: var(--text-primary); font-size: 12px; font-weight: 600; line-height: 1.5;
    white-space: pre-wrap; word-break: break-word;
    /* max-height = padding-top(9) + 4 lines × 18px + padding-bottom(9) = 90px — no half-lines */
    max-height: 90px; overflow-y: auto;
    flex-shrink: 0;
    scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent;
  }
  .term-block::-webkit-scrollbar { width: 3px; }
  .term-block::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 2px; }

  .conversation-body {
    padding: 0; overflow-y: auto; flex: 1; min-height: 0;
    scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent;
  }
  .conversation-body::-webkit-scrollbar { width: 4px; }
  .conversation-body::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 2px; }

  .response-block {
    padding: 13px 15px; color: var(--text-primary); line-height: 1.75; font-size: 13.5px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    word-break: break-word; border-bottom: 1px solid var(--border);
  }
  .response-block:last-child { border-bottom: none; }
  .response-block p { margin: 0 0 8px; }
  .response-block p:last-child { margin-bottom: 0; }
  .response-block .para-break { height: 6px; }
  .response-block h1 { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 10px 0 6px; }
  .response-block h2 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 10px 0 5px; }
  .response-block h3 { font-size: 13px; font-weight: 700; color: var(--code-text); margin: 8px 0 4px; }
  .response-block strong { color: var(--text-primary); font-weight: 600; }
  .response-block em { color: var(--text-secondary); font-style: italic; }
  .response-block del { opacity: 0.5; text-decoration: line-through; }
  .response-block a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-border); }
  .response-block a:hover { border-bottom-color: var(--accent); }
  .response-block code {
    font-family: 'SF Mono','Fira Code',monospace; font-size: 11.5px;
    background: var(--code-bg); color: var(--code-text);
    padding: 1px 5px; border-radius: 3px; border: 1px solid var(--accent-border);
  }
  .response-block pre.code-block {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 6px; padding: 11px 13px; overflow-x: auto; margin: 8px 0; position: relative;
  }
  .response-block pre.code-block code {
    background: none; border: none; padding: 0; font-size: 11.5px; color: var(--text-primary);
    display: block; line-height: 1.6; white-space: pre;
  }
  .response-block .code-lang { position: absolute; top: 6px; right: 10px; font-size: 10px; color: var(--text-hint); font-family: 'SF Mono',monospace; }
  .response-block ul, .response-block ol { padding-left: 18px; margin: 6px 0; }
  .response-block li { margin: 3px 0; }
  .response-block blockquote { border-left: 3px solid var(--accent-border); padding-left: 11px; margin: 6px 0; color: var(--text-secondary); font-style: italic; }
  .response-block .katex-display { margin: 10px 0; overflow-x: auto; }
  .response-block .katex { font-size: 1em; color: var(--code-text); }
  .response-block .math-fallback { background: var(--code-bg); color: var(--code-text); padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }
  .response-block .mermaid-block { margin: 10px 0; text-align: center; }
  .response-block .mermaid-block svg { max-width: 100%; height: auto; border-radius: 6px; }
  .response-block .mermaid-loading { color: var(--text-secondary); font-size: 12px; padding: 12px 0; }
  .response-block .mermaid-error { color: var(--error); font-size: 11.5px; white-space: pre-wrap; }
  .response-block hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
  .response-block table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12.5px; }
  .response-block th { background: var(--code-bg); color: var(--code-text); font-weight: 600; padding: 6px 10px; border: 1px solid var(--input-border); text-align: left; }
  .response-block td { padding: 5px 10px; border: 1px solid var(--input-border); color: var(--text-primary); }
  .response-block tr:nth-child(even) { background: var(--surface-hover); }

  .status-loading { color: var(--text-hint); font-style: italic; font-size: 13px; }
  .cursor-blink {
    display: inline-block; width: 2px; height: 1em; background: var(--accent);
    vertical-align: text-bottom; margin-left: 2px;
    animation: blink 0.75s step-end infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .error-msg { color: var(--error); font-size: 13px; line-height: 1.5; }

  .question-bubble {
    padding: 9px 15px;
    background: var(--accent-dim);
    border-left: 2px solid var(--accent-border);
    border-bottom: 1px solid var(--accent-border);
    font-size: 12.5px; color: var(--text-secondary);
    font-style: italic; word-break: break-word;
  }

  /* ── Footer ── */
  .panel-footer { flex-shrink: 0; border-top: 1px solid var(--border); }
  .footer-actions { display: flex; align-items: center; padding: 8px 14px; gap: 8px; border-bottom: 1px solid var(--border); }
  .copy-btn {
    padding: 4px 13px; border-radius: 20px;
    border: 1px solid var(--accent-border); background: transparent;
    color: var(--accent); font-size: 11.5px; font-weight: 500; cursor: pointer;
    font-family: -apple-system, sans-serif; transition: background 0.15s, color 0.15s;
  }
  .copy-btn:hover:not(:disabled) { background: var(--accent); color: #0a0a0c; }
  .copy-btn:disabled { opacity: 0.3; cursor: default; }
  .recap-btn {
    padding: 4px 10px; border-radius: 20px;
    border: 1px solid var(--border); background: transparent;
    color: var(--text-secondary); font-size: 11.5px; font-weight: 500; cursor: pointer;
    font-family: -apple-system, sans-serif; transition: background 0.15s, color 0.15s;
  }
  .recap-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--text-primary); }
  .recap-btn:disabled { opacity: 0.3; cursor: default; }

  .footer-status { font-size: 11px; color: var(--text-secondary); flex-grow: 1; text-align: right; letter-spacing: 0.02em; }
  .footer-status.done { color: var(--success); }
  .footer-status.error-st { color: var(--error); }
  .footer-status.streaming { color: var(--text-secondary); }
  .footer-status.stalled { color: var(--accent); }

  /* ── Follow-up ── */
  .followup-area { display: none; padding: 9px 10px 10px; gap: 7px; align-items: flex-end; }
  .followup-area.visible { display: flex; }
  .followup-input {
    flex: 1; background: var(--input-bg);
    border: 1px solid var(--input-border); border-radius: 8px;
    color: var(--text-primary); font-size: 12.5px; font-family: -apple-system, sans-serif;
    padding: 7px 10px; resize: none; outline: none;
    /* line-height: 1.6 → 12.5×1.6=20px/line; 1-line height = 7+20+7+2(border)=36px */
    line-height: 1.6; min-height: 36px; max-height: 96px; overflow-y: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .followup-input::placeholder { color: var(--text-hint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .followup-input:focus { border-color: var(--input-border-focus); box-shadow: 0 0 0 3px var(--focus-ring); }
  .followup-send {
    width: 32px; height: 36px; flex-shrink: 0; border-radius: 8px;
    background: var(--accent); border: none; color: #0a0a0c; font-size: 13px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, opacity 0.15s; font-weight: 400;
  }
  .followup-send:hover { filter: brightness(1.1); }
  .followup-send:disabled { opacity: 0.3; cursor: default; }
`;

// ─── Theme helpers ────────────────────────────────────────────────────────────
const _panelSysDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme(theme) {
  if (theme === 'system') return _panelSysDark.matches ? 'dark' : 'light';
  return theme;
}

// Pre-load theme so trigger buttons use correct colors before panel is built
try {
  chrome.storage.sync.get(['theme'], (data) => {
    if (!chrome.runtime.lastError) _cachedTheme = data.theme || 'system';
  });
} catch (e) { /* extension context invalidated */ }

function applyThemeToPanel(host, theme) {
  host.dataset.theme = resolveTheme(theme);
}

// ─── State ────────────────────────────────────────────────────────────────────
let triggerBtn = null;       // now a wrapper div containing two buttons
let panelRoot = null;
let shadowRoot = null;
let panelEl = null;
let conversationBody = null;
let _cachedTheme = 'system'; // cached resolved theme for trigger button colors
let currentResponseBlock = null;
let copyBtn = null;
let recapBtn = null;
let footerStatus = null;
let retryBtn = null;
let followupArea = null;
let followupInput = null;
let followupSend = null;
let isPinned = false;
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
let _savedSelectionRange = null; // range saved at trigger-click time for annotation

// Panel position memory: contextKey -> {left, top}
const panelPositions = new Map();

// ─── Page annotation state ────────────────────────────────────────────────────
// Map: contextKey -> { term, explanation, followUps, nodes: [<mark el>], scrollMarkers: [el] }
const pageAnnotations = new Map();
let scrollbarCanvas = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHostButtonColors() {
  const isLight = resolveTheme(_cachedTheme) === 'light';
  return {
    bg: isLight ? '#f5f3ef' : '#0f0f11',
    accentColor: isLight ? '#c07818' : '#e8a030',
    accentBorder: isLight ? 'rgba(192,120,24,0.6)' : 'rgba(232,160,48,0.6)',
    askColor: isLight ? '#2563eb' : '#a8c8f0',
    askBorder: isLight ? 'rgba(37,99,235,0.45)' : 'rgba(120,180,255,0.45)',
    viewBg: isLight ? '#f5f3ef' : '#0f0f11',
    viewBorder: isLight ? 'rgba(192,120,24,0.65)' : 'rgba(232,160,48,0.65)',
    viewColor: isLight ? '#c07818' : '#e8a030',
    removeBg: isLight ? '#f5f3ef' : '#0f0f11',
    removeBorder: isLight ? 'rgba(192,80,80,0.45)' : 'rgba(200,80,80,0.45)',
    removeColor: isLight ? 'rgba(192,80,80,0.8)' : 'rgba(200,80,80,0.7)',
  };
}

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
function saveToHistory(term, contextBefore, contextAfter, explanation, followUps, mode) {
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2),
    ts: Date.now(),
    url: location.href,
    pageTitle: document.title,
    term, contextBefore, contextAfter,
    explanation,
    followUps: followUps || [],
    mode: mode || 'explain'
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
    // NOTE: These buttons are injected into the host page DOM (not Shadow DOM).
    // Colors resolved dynamically from current panel theme.
    const hbc = getHostButtonColors();
    viewBtn.textContent = '✦';
    viewBtn.title = 'View explanation';
    Object.assign(viewBtn.style, {
      width: '26px', height: '26px',
      padding: '0',
      borderRadius: '13px',
      background: hbc.viewBg,
      border: `1.5px solid ${hbc.viewBorder}`,
      color: hbc.viewColor,
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
      background: hbc.removeBg,
      border: `1.5px solid ${hbc.removeBorder}`,
      color: hbc.removeColor,
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
  forceClosePanel();

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
      currentResponseBlock.dataset.md = entry.explanation;
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
      block.dataset.md = fu.a;
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
  if (recapBtn) recapBtn.disabled = false;
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

  // NOTE: These buttons are injected into the host page DOM (not Shadow DOM).
  // CSS variables don't propagate here. Colors resolved from current theme.
  const hbc = getHostButtonColors();
  const btnStyle = {
    width: '30px',
    height: '26px',
    borderRadius: '13px',
    background: hbc.bg,
    border: `1.5px solid ${hbc.accentBorder}`,
    color: hbc.accentColor,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 3px 12px rgba(0,0,0,0.55)',
    padding: '0',
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
  askBtn.className = 'ctx-ask-btn';
  Object.assign(askBtn.style, {
    ...btnStyle,
    fontSize: '13px',
    fontWeight: '700',
    color: hbc.askColor,
    border: `1.5px solid ${hbc.askBorder}`,
  });

  const askLabel = makeTooltip('Ask');
  askBtn.appendChild(askLabel);

  askBtn.addEventListener('mouseenter', () => { askLabel.style.opacity = '1'; askLabel.style.transform = 'translateX(-50%) translateY(0)'; });
  askBtn.addEventListener('mouseleave', () => { askLabel.style.opacity = '0'; askLabel.style.transform = 'translateX(-50%) translateY(-3px)'; });

  wrap.appendChild(explainBtn);
  wrap.appendChild(askBtn);

  // ── Translate button ──
  const translateBtn = document.createElement('button');
  translateBtn.innerHTML = '⇌';
  translateBtn.title = 'Translate';
  Object.assign(translateBtn.style, btnStyle);

  const translateLabel = makeTooltip('Translate');
  translateBtn.appendChild(translateLabel);

  translateBtn.addEventListener('mouseenter', () => { translateLabel.style.opacity = '1'; translateLabel.style.transform = 'translateX(-50%) translateY(0)'; });
  translateBtn.addEventListener('mouseleave', () => { translateLabel.style.opacity = '0'; translateLabel.style.transform = 'translateX(-50%) translateY(-3px)'; });

  wrap.appendChild(translateBtn);

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

  translateBtn.addEventListener('click', e => {
    e.stopPropagation();
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) return;
    const ctx = extractContext(sel);
    removeTriggerBtn();
    showPanel(ctx, x, y, 'translate');
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
  _currentMode = 'explain';
  _pendingTranslateCtx = null;
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
function buildPanel(btnX, btnY, contextKey, mode) {
  panelRoot = document.createElement('div');
  panelRoot.id = 'ctx-explain-root';
  Object.assign(panelRoot.style, { position: 'fixed', top: '0', left: '0', zIndex: '2147483647', pointerEvents: 'none' });
  document.body.appendChild(panelRoot);

  shadowRoot = panelRoot.attachShadow({ mode: 'open' });
  setupKeyboardIsolation(shadowRoot);

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
    <div class="panel-inner">
      <div class="panel-header">
        <span class="logo">✦ Context Explain</span>
        <div class="header-right">
          <button class="retry-btn" title="Retry">↺</button>
          <button class="pin-btn" title="Pin panel"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375l-.508.508a.5.5 0 0 1-.707 0l-2.5-2.5a.5.5 0 0 1-.707 0l-1 1a.5.5 0 0 1-.707-.707l1-1a.5.5 0 0 1 0-.707l-2.5-2.5a.5.5 0 0 1 0-.707l.508-.508c.688-.688 1.673-.766 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.134a2.772 2.772 0 0 1-.039-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg></button>
          <button class="close-btn" title="Close">×</button>
        </div>
      </div>
      <div class="term-block"></div>
      <div class="conversation-body"></div>
      <div class="panel-footer">
        <div class="footer-actions">
          <button class="copy-btn" disabled>Copy</button>
          <button class="recap-btn" disabled title="Summarize key points of this conversation">Recap</button>
          <span class="footer-status streaming">Explaining…</span>
        </div>
        <div class="followup-area">
          <textarea class="followup-input" placeholder="Ask a follow-up question…" rows="1"></textarea>
          <button class="followup-send" disabled title="Send">➤</button>
        </div>
      </div>
    </div>
    <div class="ctx-resize-sw ctx-resize-handle"></div>
    <div class="ctx-resize-se ctx-resize-handle"></div>
    <div class="ctx-resize-e ctx-resize-handle"></div>
    <div class="ctx-resize-w ctx-resize-handle"></div>
    <div class="ctx-resize-s ctx-resize-handle"></div>
  `;
  shadowRoot.appendChild(panelEl);

  // ── Apply theme ──
  // Use _cachedTheme (pre-loaded from storage at init) so the panel renders
  // with the correct theme immediately, without waiting for an async callback.
  applyThemeToPanel(panelRoot, _cachedTheme);
  try {
    chrome.storage.sync.get(['theme'], (data) => {
      if (chrome.runtime.lastError) return;
      const t = data.theme || 'system';
      _cachedTheme = t;
      applyThemeToPanel(panelRoot, t);
    });
  } catch (e) { /* extension context invalidated */ }

  panelEl.querySelector('.term-block').textContent = currentTerm;
  conversationBody = panelEl.querySelector('.conversation-body');
  copyBtn = panelEl.querySelector('.copy-btn');
  recapBtn = panelEl.querySelector('.recap-btn');
  footerStatus = panelEl.querySelector('.footer-status');
  retryBtn = panelEl.querySelector('.retry-btn');
  followupArea = panelEl.querySelector('.followup-area');

  // Detect manual scroll: if user scrolls up during streaming, stop auto-scroll
  _userScrolled = false;
  conversationBody.addEventListener('scroll', () => {
    if (!isStreaming) return;
    const distFromBottom = conversationBody.scrollHeight - conversationBody.scrollTop - conversationBody.clientHeight;
    // If more than 40px from bottom, user scrolled up intentionally
    _userScrolled = distFromBottom > 40;
  });
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

  // Pin
  const pinBtn = panelEl.querySelector('.pin-btn');
  pinBtn.addEventListener('click', () => {
    isPinned = !isPinned;
    pinBtn.classList.toggle('active', isPinned);
    pinBtn.title = isPinned ? 'Unpin panel' : 'Pin panel';
  });

  // Retry
  retryBtn.addEventListener('click', () => {
    if (isStreaming) return;
    retryBtn.classList.remove('visible');
    if (currentResponseBlock && conversationBody.contains(currentResponseBlock)) currentResponseBlock.remove();
    currentResponseBlock = document.createElement('div');
    currentResponseBlock.className = 'response-block';
    currentResponseBlock.innerHTML = '<span class="status-loading">Retrying…</span>';
    conversationBody.appendChild(currentResponseBlock);
    _userScrolled = false; conversationBody.scrollTop = conversationBody.scrollHeight;
    if (footerStatus) { footerStatus.textContent = 'Retrying…'; footerStatus.className = 'footer-status streaming'; }
    if (copyBtn) copyBtn.disabled = true;
  if (recapBtn) recapBtn.disabled = true;
    followupArea.classList.remove('visible');
    accumulatedText = '';
    startStream();
  });

  // Copy
  copyBtn.addEventListener('click', () => {
    // Walk all children in order, picking up question-bubbles and response-blocks
    const parts = [];

    // Add the selected term as a blockquote at the top
    if (currentTerm && currentTerm !== 'Image') {
      parts.push(`> ${currentTerm.replace(/\n/g, '\n> ')}`);
    }

    conversationBody.querySelectorAll('.question-bubble, .response-block').forEach(el => {
      if (el.classList.contains('question-bubble')) {
        parts.push(`> **${el.textContent.trim()}**`);
      } else {
        parts.push(el.dataset.md || el.innerText);
      }
    });
    const texts = parts.join('\n\n');
    const pageRef = `*Source: [${document.title || location.href}](${location.href})*`;
    const finalText = texts + '\n\n' + pageRef;
    navigator.clipboard.writeText(finalText).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = finalText;
      Object.assign(ta.style, { position:'fixed', opacity:'0' });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    });
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy'; }, 1800);
  });

  // Recap
  recapBtn.addEventListener('click', () => {
    if (isStreaming) return;
    const recapPrompt = 'Please recap the key points of our conversation so far. Summarize: (1) the core concept or question we explored, (2) the most important insights or answers, (3) any follow-up questions I asked and what we clarified. Be concise and use bullet points where helpful.';
    if (followupInput) {
      followupInput.value = recapPrompt;
      sendFollowup();
    }
  });

  // Follow-up
  followupSend.addEventListener('click', sendFollowup);
  followupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); sendFollowup(); }
    // Ctrl+Enter or Shift+Enter = newline (default behavior)
  });
  followupInput.addEventListener('input', () => {
    followupInput.style.height = 'auto';
    followupInput.style.height = Math.min(followupInput.scrollHeight, 96) + 'px';
    if (followupSend) followupSend.disabled = !followupInput.value.trim() || isStreaming;
  });

  // Draggable
  makeDraggable(panelEl, panelEl.querySelector('.panel-header'));

  // Resize handles + geometry persistence
  setupResize(panelEl);
  restorePanelGeometry(panelEl, mode === 'translate');
}

function forceClosePanel() {
  isPinned = false;
  removePanel();
}

// mode: 'explain' | 'ask' | 'translate'
function showPanel(ctx, btnX, btnY, mode) {
  forceClosePanel();
  currentTerm = ctx.selectedText;
  currentContextBefore = ctx.contextBefore;
  currentContextAfter = ctx.contextAfter;
  currentHistoryId = null;

  // Save the current selection range now, before it can be modified by panel interactions
  const _sel = window.getSelection();
  _savedSelectionRange = (_sel && _sel.rangeCount > 0) ? _sel.getRangeAt(0).cloneRange() : null;

  const contextKey = makeContextKey(ctx.selectedText, ctx.contextBefore, ctx.contextAfter);
  buildPanel(btnX, btnY, contextKey, mode);

  if (mode === 'ask') {
    // Ask mode: skip auto-explain, show input immediately, hide loading block
    if (currentResponseBlock) currentResponseBlock.remove();
    currentResponseBlock = null;
    if (footerStatus) { footerStatus.textContent = 'Ask mode'; footerStatus.className = 'footer-status done'; }
    if (followupArea) followupArea.classList.add('visible');
    // Pre-fill placeholder to indicate context
    if (followupInput) {
      followupInput.placeholder = `Ask about "${ctx.selectedText.slice(0, 15)}${ctx.selectedText.length > 15 ? '…' : ''}"`;
      followupInput.focus();
    }
    // Prime the conversation with a silent system context message for follow-ups
    // First real user message will be what they type
    conversationMessages = [];
    // We'll build the first message when user submits
    accumulatedText = '';
    // Override sendFollowup to handle first message specially in ask mode
    _askModeFirstMessage = true;
  } else if (mode === 'translate') {
    // Translate mode: auto-stream like explain, but different prompt + status
    if (footerStatus) { footerStatus.textContent = 'Translating…'; footerStatus.className = 'footer-status streaming'; }
    _currentMode = 'translate';
    const userContent = buildTranslatePromptPlaceholder(ctx);
    conversationMessages = [{ role: 'user', content: userContent }];
    accumulatedText = '';
    startStream();
  } else {
    // Explain mode (default)
    _currentMode = 'explain';
    const userContent = buildInitialPrompt(ctx);
    conversationMessages = [{ role: 'user', content: userContent }];
    accumulatedText = '';
    startStream();
  }
}

// Flag for ask-mode first message
let _askModeFirstMessage = false;
let _askModeQuestion = null; // stores the user's question for ask-mode first turn
let _currentMode = 'explain'; // 'explain' | 'translate'

function buildInitialPrompt(ctx) {
  return `Selected text: "${ctx.selectedText}"\n\nSurrounding context:\n…${ctx.contextBefore}[${ctx.selectedText}]${ctx.contextAfter}…\n\nPlease explain what "${ctx.selectedText}" means in this context. If it's a technical term, acronym, or concept, explain it clearly. Be focused and practical.`;
}

// Placeholder: the real prompt is built in runFetch after loading translateLang from storage.
// We store ctx so runFetch can build it.
let _pendingTranslateCtx = null;
function buildTranslatePromptPlaceholder(ctx) {
  _pendingTranslateCtx = ctx;
  // Return a temporary placeholder; runFetch will replace conversationMessages before sending
  return '__translate_placeholder__';
}

function buildTranslatePrompt(ctx, targetLang) {
  const { selectedText, contextBefore, contextAfter } = ctx;
  return `I am reading a webpage and selected the following text:

"${selectedText}"

Surrounding context:
…${contextBefore}[${selectedText}]${contextAfter}…

Target language: ${targetLang}

Your task: translate and briefly explain the selected text in ${targetLang}. Keep the response short — no lengthy essays.

Format your response as follows:
1. **Translation** (or **Meaning** if it's already in ${targetLang} or has no clean equivalent): provide the natural translation or meaning in ${targetLang}.
2. **Context**: 1–2 sentences explaining what this word/phrase means in the specific context above — its role, connotation, tone, or why this translation fits. Do not repeat the translation verbatim; add value.

Rules:
- If the text is a single common word with an obvious translation, keep the Context note to one short sentence.
- If the text is idiomatic, cultural, or jargon-heavy, prioritize the explanation over a literal translation.
- If the text is already in ${targetLang}, skip the Translation line and go straight to explaining its meaning and nuance in context.
- For multi-sentence passages, translate naturally then briefly note any key nuance.
- Never output preamble like "Here is the translation:" or "Sure!".
- Write entirely in ${targetLang}.`;
}

function buildAskPrompt(ctx, question) {
  return `I'm reading a page and selected this text: "${ctx.selectedText}"\n\nContext: …${ctx.contextBefore}[${ctx.selectedText}]${ctx.contextAfter}…\n\nMy question: ${question}`;
}

// ─── Resize handles ───────────────────────────────────────────────────────────
function setupResize(panelEl) {
  const MIN_W = 380, MIN_H = 380;
  panelEl.querySelectorAll('.ctx-resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startW = panelEl.offsetWidth, startH = panelEl.offsetHeight;
      const startLeft = parseFloat(panelEl.style.left) || 0;
      const startTop  = parseFloat(panelEl.style.top)  || 0;

      const isSW = handle.classList.contains('ctx-resize-sw');
      const isSE = handle.classList.contains('ctx-resize-se');
      const isE  = handle.classList.contains('ctx-resize-e');
      const isW  = handle.classList.contains('ctx-resize-w');
      const isS  = handle.classList.contains('ctx-resize-s');

      const resizeW = isSW || isSE || isE || isW;
      const resizeH = isSW || isSE || isS;
      const fromLeft = isSW || isW;

      let animFrame = null;

      const onMove = (ev) => {
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(() => {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          const maxW = window.innerWidth * 0.9;
          const maxH = window.innerHeight * 0.9;

          if (resizeW) {
            let newW = fromLeft ? startW - dx : startW + dx;
            newW = Math.max(MIN_W, Math.min(newW, maxW));
            panelEl.style.width = newW + 'px';
            if (fromLeft) {
              panelEl.style.left = (startLeft - (newW - startW)) + 'px';
            }
          }
          if (resizeH) {
            let newH = startH + dy;
            newH = Math.max(MIN_H, Math.min(newH, maxH));
            panelEl.style.height = newH + 'px';
          }
          panelEl.classList.add('has-geometry');
        });
      };
      const onUp = () => {
        if (animFrame) cancelAnimationFrame(animFrame);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        savePanelGeometry(panelEl);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

async function savePanelGeometry(panelEl) {
  try {
    const geo = {
      x: parseFloat(panelEl.style.left) || 0,
      y: parseFloat(panelEl.style.top) || 0,
      w: panelEl.offsetWidth,
      h: panelEl.offsetHeight
    };
    await chrome.storage.local.set({ panelGeometry: geo });
  } catch (e) { /* storage unavailable */ }
}

async function restorePanelGeometry(panelEl, positionOnly = false) {
  try {
    const { panelGeometry: g } = await chrome.storage.local.get('panelGeometry');
    if (!g) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const MIN_W = 380, MIN_H = 380;
    const w = positionOnly ? MIN_W : Math.max(MIN_W, Math.min(g.w || MIN_W, vw * 0.9));
    const h = positionOnly ? MIN_H : Math.max(MIN_H, Math.min(g.h || MIN_H, vh * 0.9));
    const x = Math.max(0, Math.min(g.x || 0, vw - w));
    const y = Math.max(0, Math.min(g.y || 0, vh - h));
    panelEl.style.width = w + 'px';
    panelEl.style.height = h + 'px';
    panelEl.style.left = x + 'px';
    panelEl.style.top = y + 'px';
    panelEl.classList.add('has-geometry');
  } catch (e) { /* storage unavailable */ }
}

// ─── Draggable ────────────────────────────────────────────────────────────────
function makeDraggable(panel, handle) {
  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.close-btn') || e.target.closest('.retry-btn') || e.target.closest('.pin-btn')) return;
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

  const onUp = () => { dragging = false; handle.style.cursor = 'grab'; savePanelGeometry(panelEl); };

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

  _userScrolled = false; conversationBody.scrollTop = conversationBody.scrollHeight;
  if (footerStatus) { footerStatus.textContent = 'Explaining…'; footerStatus.className = 'footer-status streaming'; }
  if (copyBtn) copyBtn.disabled = true;
  if (recapBtn) recapBtn.disabled = true;
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
        ['apiProvider','apiKey','apiModel','apiBaseUrl','responseLang','translateLang'],
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
  const translateLang = config.translateLang || 'Chinese (Simplified)';

  if (!apiKey) {
    handleStreamFailure('No API key configured. Click the extension icon to set up.');
    return;
  }

  let systemPrompt;
  if (_currentMode === 'translate') {
    // Replace placeholder with real translate prompt now that we have translateLang
    if (_pendingTranslateCtx) {
      conversationMessages = [{
        role: 'user',
        content: buildTranslatePrompt(_pendingTranslateCtx, translateLang)
      }];
      _pendingTranslateCtx = null;
    }
    systemPrompt = `You are a precise translator and language expert. Follow the user's instructions exactly. Be concise.`;
  } else {
    const langInstruction = lang === 'auto' ? 'the same language as the selected text' : lang;
    systemPrompt = `You are a knowledgeable and concise expert explainer. The user has selected text from a webpage and wants to understand it better. Explain clearly and be appropriately detailed. Use markdown formatting when helpful (bold for key terms, code blocks for code, bullet points for lists). Respond in ${langInstruction}.`;
  }

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
           <span style="color:var(--error);font-size:12px">⚠ Stream interrupted — partial response shown.</span>
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
let _userScrolled = false; // true when user has manually scrolled up during streaming

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
      if (conversationBody && !_userScrolled) conversationBody.scrollTop = conversationBody.scrollHeight;
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
    currentResponseBlock.dataset.md = accumulatedText;
    renderMermaidBlocks(currentResponseBlock);
  }

  const isInitial = conversationMessages.length === 1;

  if (isInitial && !_askModeQuestion) {
    // Explain/translate mode: first response — save as explanation
    const entry = await saveToHistory(currentTerm, currentContextBefore, currentContextAfter, accumulatedText, [], _currentMode);
    currentHistoryId = entry.id;

    const contextKey = makeContextKey(currentTerm, currentContextBefore, currentContextAfter);
    if (_savedSelectionRange) {
      annotateRange(_savedSelectionRange, contextKey, entry);
      _savedSelectionRange = null;
      window.getSelection()?.removeAllRanges();
    }
  } else if (isInitial && _askModeQuestion) {
    // Ask mode: first response — save with empty explanation, then add Q&A as followUp
    const q = _askModeQuestion;
    _askModeQuestion = null;
    const entry = await saveToHistory(currentTerm, currentContextBefore, currentContextAfter, '', [], 'ask');
    currentHistoryId = entry.id;
    await updateHistoryFollowup(currentHistoryId, q, accumulatedText);

    const contextKey2 = makeContextKey(currentTerm, currentContextBefore, currentContextAfter);
    if (_savedSelectionRange) {
      annotateRange(_savedSelectionRange, contextKey2, entry);
      _savedSelectionRange = null;
      window.getSelection()?.removeAllRanges();
    }
  } else {
    // Follow-up done (both modes)
    const lastUserMsg = conversationMessages[conversationMessages.length - 1];
    await updateHistoryFollowup(currentHistoryId, lastUserMsg.content, accumulatedText);
  }

  if (copyBtn) copyBtn.disabled = false;
  if (recapBtn) recapBtn.disabled = false;
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
    if (isPinned) return;
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

// Normalize whitespace for fuzzy text matching (collapse \n and multiple spaces)
function normalizeWS(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function findTextInDocument(term, ctxBefore, ctxAfter) {
  const normTerm = normalizeWS(term);
  if (!normTerm) return null;

  // ── Helper: collect all visible text nodes ──────────────────────────────────
  function getTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains('ctx-explain-mark')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  // ── Single-node path (no newlines in term) ──────────────────────────────────
  if (!term.includes('\n')) {
    const textNodes = getTextNodes();
    const ctxSnippetBefore = normalizeWS(ctxBefore.slice(-80));
    const ctxSnippetAfter  = normalizeWS(ctxAfter.slice(0, 80));
    let best = null, bestScore = -1;

    for (const node of textNodes) {
      const normNodeText = normalizeWS(node.textContent);
      if (!normNodeText.includes(normTerm)) continue;

      const parent = node.parentElement || document.body;
      const fullText = normalizeWS(parent.innerText || parent.textContent || '');
      const termIdx = fullText.indexOf(normTerm);
      if (termIdx === -1) continue;

      const beforeSlice = fullText.substring(Math.max(0, termIdx - 100), termIdx);
      const afterSlice  = fullText.substring(termIdx + normTerm.length, termIdx + normTerm.length + 100);
      const score = wordOverlap(beforeSlice, ctxSnippetBefore) + wordOverlap(afterSlice, ctxSnippetAfter);

      if (score > bestScore) { bestScore = score; best = node; }
    }

    if (!best) return null;

    try {
      const idx = best.textContent.indexOf(term.trim());
      if (idx === -1) return null;
      const range = document.createRange();
      range.setStart(best, idx);
      range.setEnd(best, idx + term.trim().length);
      return range;
    } catch (e) { return null; }
  }

  // ── Multi-line path: term spans multiple text nodes ─────────────────────────
  // Split by newlines, take first and last non-empty chunks as anchors
  const lines = term.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  const firstChunk = lines[0];
  const lastChunk  = lines[lines.length - 1];

  const textNodes = getTextNodes();

  // Find all nodes containing the first chunk
  const startCandidates = textNodes.filter(n => n.textContent.includes(firstChunk));
  const endCandidates   = textNodes.filter(n => n.textContent.includes(lastChunk));

  if (startCandidates.length === 0 || endCandidates.length === 0) return null;

  const ctxSnippetBefore = normalizeWS(ctxBefore.slice(-80));
  const ctxSnippetAfter  = normalizeWS(ctxAfter.slice(0, 80));

  let bestRange = null, bestScore = -1;

  for (const startNode of startCandidates) {
    const startIdx = startNode.textContent.indexOf(firstChunk);
    if (startIdx === -1) continue;

    for (const endNode of endCandidates) {
      // endNode must come after startNode in document order
      if (startNode === endNode && firstChunk === lastChunk) continue;
      const pos = startNode.compareDocumentPosition(endNode);
      if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING) && startNode !== endNode) continue;

      const endIdx = endNode.textContent.indexOf(lastChunk);
      if (endIdx === -1) continue;

      // Score using context around start node
      const parent = startNode.parentElement || document.body;
      const fullText = normalizeWS(parent.innerText || parent.textContent || '');
      const normFirst = normalizeWS(firstChunk);
      const fi = fullText.indexOf(normFirst);
      const beforeSlice = fi >= 0 ? fullText.substring(Math.max(0, fi - 100), fi) : '';
      const score = wordOverlap(beforeSlice, ctxSnippetBefore);

      if (score > bestScore) {
        bestScore = score;
        try {
          const range = document.createRange();
          range.setStart(startNode, startIdx);
          range.setEnd(endNode, endIdx + lastChunk.length);
          bestRange = range;
        } catch (e) {}
      }
    }
  }

  return bestRange;
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

// ─── Listen for theme changes from popup ─────────────────────────────────────
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.theme) return;
    const newTheme = changes.theme.newValue || 'system';
    _cachedTheme = newTheme;
    if (panelRoot) {
      applyThemeToPanel(panelRoot, newTheme);
    }
    // Re-apply colors to trigger buttons if currently visible
    if (triggerBtn) {
      const hbc = getHostButtonColors();
      triggerBtn.querySelectorAll('button').forEach(btn => {
        btn.style.background = hbc.bg;
        btn.style.border = `1.5px solid ${hbc.accentBorder}`;
        btn.style.color = btn.classList.contains('ctx-ask-btn') ? hbc.askColor : hbc.accentColor;
      });
    }
  });
} catch (e) { /* extension context invalidated */ }

// ─── Image module-level state ─────────────────────────────────────────────────
let _imageUrl = null;
let _imageSrcUrl = null;
let _visionCfg = null;

// ─── Image Context Menu Handler ───────────────────────────────────────────────
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'DELETE_ANNOTATION') {
      // Remove amber underline for a deleted history entry
      const { term, contextBefore, contextAfter } = msg;
      const contextKey = makeContextKey(term, contextBefore || '', contextAfter || '');
      removeAnnotation(contextKey);
      return;
    }
    if (msg.type !== 'IMAGE_CONTEXT_MENU') return;

    const action = msg.action; // 'explain-image' | 'ask-image'
    const mode = action === 'explain-image' ? 'image-explain' : 'image-ask';

    if (msg.error || !msg.srcUrl) {
      showImageError(msg.error || 'Could not determine image URL.');
      return;
    }

    handleImageContextMenu(msg.srcUrl, mode);
  });
}

function validateVisionConfig(cfg) {
  if (!cfg.visionEnabled) return 'Image analysis is disabled. Please enable it in the extension Settings.';
  if (!cfg.visionApiEndpoint) return 'Vision API endpoint is not configured. Please check Settings.';
  if (!cfg.visionApiKey) return 'Vision API key is not configured. Please check Settings.';
  if (!cfg.visionApiModel) return 'Vision model is not configured. Please check Settings.';
  return null;
}

async function handleImageContextMenu(srcUrl, mode) {
  let visionCfg;
  try {
    visionCfg = await new Promise((res, rej) => {
      chrome.storage.sync.get(
        ['visionEnabled','visionApiEndpoint','visionApiKey','visionApiModel'],
        (data) => {
          if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
          else res(data);
        }
      );
    });
  } catch (e) {
    showImageError('Could not load settings.');
    return;
  }

  const cfgError = validateVisionConfig(visionCfg);
  if (cfgError) {
    showImageError(cfgError);
    return;
  }

  showImagePanel(srcUrl, mode, visionCfg);
}

function showImageError(message) {
  forceClosePanel();
  if (!panelRoot) {
    panelRoot = document.createElement('div');
    Object.assign(panelRoot.style, {
      position: 'fixed', zIndex: '2147483647',
      top: '80px', right: '20px',
    });
    document.body.appendChild(panelRoot);
  }
  shadowRoot = panelRoot.attachShadow({ mode: 'open' });
  setupKeyboardIsolation(shadowRoot);

  const style = document.createElement('style');
  style.textContent = getThemeVarsCSS() + `
    .err-panel {
      font-family: -apple-system, sans-serif;
      background: var(--bg-panel); border: 1px solid var(--accent-border);
      border-radius: 10px; padding: 14px 16px;
      color: var(--error); font-size: 13px; line-height: 1.5;
      max-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: flex; align-items: flex-start; gap: 10px;
    }
    .err-close { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; padding: 0; flex-shrink: 0; }
    .err-close:hover { color: var(--text-primary); }
  `;
  const div = document.createElement('div');
  div.className = 'err-panel';
  div.innerHTML = `<span>⚠ ${message}</span><button class="err-close" title="Close">×</button>`;
  shadowRoot.appendChild(style);
  shadowRoot.appendChild(div);
  applyThemeToPanel(panelRoot, 'system');

  div.querySelector('.err-close').addEventListener('click', removePanel);
  panelEl = div;
}

async function showImagePanel(srcUrl, mode, visionCfg) {
  forceClosePanel();

  currentTerm = 'Image';
  currentContextBefore = '';
  currentContextAfter = '';
  conversationMessages = [];
  accumulatedText = '';
  isStreaming = false;
  _currentMode = mode; // 'image-explain' | 'image-ask'
  _imageUrl = srcUrl;
  _imageSrcUrl = srcUrl;
  _visionCfg = visionCfg;

  const x = window.innerWidth - 420;
  const y = 80;

  buildPanel(x, y);

  // Replace term-block with image thumbnail
  const termBlock = panelEl.querySelector('.term-block');
  if (termBlock) {
    termBlock.innerHTML = '';
    termBlock.style.padding = '8px 14px';
    const thumb = document.createElement('img');
    thumb.src = srcUrl;
    thumb.alt = 'Referenced image';
    Object.assign(thumb.style, {
      maxWidth: '100%', maxHeight: '140px', objectFit: 'contain',
      borderRadius: '6px', cursor: 'zoom-in', display: 'block',
      margin: '0 auto', border: '1px solid var(--border)'
    });
    thumb.addEventListener('click', () => showLightbox(srcUrl));
    thumb.addEventListener('error', () => {
      termBlock.textContent = '⚠ Image preview unavailable';
      termBlock.style.color = 'var(--text-hint)';
      termBlock.style.fontSize = '12px';
    });
    termBlock.appendChild(thumb);
  }

  const footerStatus = panelEl.querySelector('.footer-status');

  if (mode === 'image-explain') {
    if (footerStatus) { footerStatus.textContent = 'Analyzing image…'; footerStatus.className = 'footer-status streaming'; }
    // Clear the default "Thinking…" block created by buildPanel — runImageFetch creates its own
    if (currentResponseBlock && currentResponseBlock.parentNode) {
      currentResponseBlock.remove();
      currentResponseBlock = null;
    }
    runImageFetch();
  } else {
    // Ask mode
    if (footerStatus) { footerStatus.textContent = ''; footerStatus.className = 'footer-status'; }
    const convBody = panelEl.querySelector('.conversation-body');
    if (convBody) convBody.innerHTML = '';
    const sendBtn = panelEl.querySelector('.followup-send');
    const textarea = panelEl.querySelector('.followup-input');
    if (textarea) textarea.placeholder = 'Ask something about this image…';
    if (followupArea) followupArea.classList.add('visible');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.onclick = () => sendImageFollowup();
    }
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); sendImageFollowup(); }
        // Ctrl+Enter or Shift+Enter = newline (default behavior)
      });
      setTimeout(() => textarea.focus(), 100);
    }
  }
}

async function getImageData(srcUrl) {
  try {
    const resp = await fetch(srcUrl, { mode: 'cors', cache: 'force-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();

    // SVG is not supported by vision APIs — rasterize to PNG via canvas first
    if (blob.type === 'image/svg+xml' || srcUrl.split('?')[0].toLowerCase().endsWith('.svg')) {
      const svgText = await blob.text();
      const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      const pngDataUrl = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          // Use natural size, capped at 1024px wide to keep payload reasonable
          const scale = img.naturalWidth > 1024 ? 1024 / img.naturalWidth : 1;
          const w = Math.round((img.naturalWidth || 400) * scale);
          const h = Math.round((img.naturalHeight || 200) * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          // White background so math renders on a clean bg
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          res(canvas.toDataURL('image/png'));
        };
        img.onerror = rej;
        img.src = svgDataUrl;
      });
      return { type: 'base64', url: pngDataUrl };
    }

    return await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res({ type: 'base64', url: reader.result });
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch {
    return { type: 'url', url: srcUrl };
  }
}

async function runImageFetch(userQuestion) {
  if (isStreaming) return;
  isStreaming = true;
  accumulatedText = '';

  const convBody = panelEl?.querySelector('.conversation-body');
  const footerStatus = panelEl?.querySelector('.footer-status');
  const sendBtn = panelEl?.querySelector('.followup-send');
  const copyBtnEl = panelEl?.querySelector('.copy-btn');
  const recapBtnEl = panelEl?.querySelector('.recap-btn');

  const msgBlock = document.createElement('div');
  msgBlock.className = 'response-block';
  const streamEl = document.createElement('div');
  streamEl.className = 'streaming-text';
  streamEl.style.cssText = 'white-space:pre-wrap;word-break:break-word;';
  msgBlock.appendChild(streamEl);
  if (convBody) convBody.appendChild(msgBlock);

  if (footerStatus) { footerStatus.textContent = 'Analyzing…'; footerStatus.className = 'footer-status streaming'; }
  if (sendBtn) sendBtn.disabled = true;
  if (copyBtnEl) copyBtnEl.disabled = true;
    if (recapBtnEl) recapBtnEl.disabled = true;

  try {
    const imgData = await getImageData(_imageSrcUrl);

    const prompt = userQuestion
      ? userQuestion
      : 'Please explain what is shown in this image. Be clear and informative.';

    const imageContent = { type: 'image_url', image_url: { url: imgData.url } };

    const userMessage = {
      role: 'user',
      content: [imageContent, { type: 'text', text: prompt }]
    };

    if (!userQuestion) {
      conversationMessages = [userMessage];
    } else {
      conversationMessages.push({ role: 'assistant', content: accumulatedText });
      conversationMessages.push(userMessage);
    }

    const controller = new AbortController();
    currentAbortController = controller;

    // Read responseLang for image analysis
    const { responseLang: imgLang = 'auto' } = await chrome.storage.sync.get('responseLang').catch(() => ({}));
    const langInstruction = imgLang === 'auto' ? '' : ` Respond in ${imgLang}.`;

    const endpoint = (_visionCfg.visionApiEndpoint || '').replace(/\/$/, '') + '/chat/completions';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _visionCfg.visionApiKey
      },
      body: JSON.stringify({
        model: _visionCfg.visionApiModel,
        messages: [
          { role: 'system', content: `You are a helpful image analysis assistant. Be clear and informative.${langInstruction}` },
          ...conversationMessages
        ],
        stream: true
      }),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let errMsg;
      try { errMsg = JSON.parse(errText)?.error?.message; } catch {}
      throw new Error(errMsg || `API error ${resp.status}`);
    }

    // Stream response manually (image fetch manages its own accumulated text)
    const imgAccumBefore = accumulatedText;
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
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (chunk && isStreaming) {
            accumulatedText += chunk;
            streamEl.textContent = accumulatedText;
            if (convBody) convBody.scrollTop = convBody.scrollHeight;
          }
        } catch {}
      }
    }

    isStreaming = false;
    if (streamEl && msgBlock.contains(streamEl)) {
      streamEl.remove();
      msgBlock.innerHTML = renderMarkdown(accumulatedText);
      msgBlock.dataset.md = accumulatedText;
      renderMermaidBlocks(msgBlock);
    }
    if (footerStatus) { footerStatus.textContent = 'Done'; footerStatus.className = 'footer-status done'; }
    if (copyBtnEl) copyBtnEl.disabled = false;
    if (recapBtnEl) recapBtnEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (followupArea) followupArea.classList.add('visible');
    if (followupInput) setTimeout(() => followupInput.focus(), 50);

    // Save to history
    const histEntry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2,8),
      ts: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      term: 'Image',
      contextBefore: '',
      contextAfter: '',
      explanation: accumulatedText,
      followUps: [],
      mode: 'image',
      imageUrl: _imageSrcUrl
    };
    try {
      const { ctxHistory = [] } = await chrome.storage.local.get('ctxHistory');
      ctxHistory.unshift(histEntry);
      if (ctxHistory.length > 2000) ctxHistory.length = 2000;
      await chrome.storage.local.set({ ctxHistory });
    } catch {}

    currentHistoryId = histEntry.id;

  } catch (err) {
    isStreaming = false;
    if (err.name === 'AbortError') return;
    if (streamEl && msgBlock.contains(streamEl)) streamEl.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'error-msg';
    errDiv.textContent = '⚠ ' + (err.message || 'Request failed');
    msgBlock.appendChild(errDiv);
    if (footerStatus) { footerStatus.textContent = 'Failed'; footerStatus.className = 'footer-status error-st'; }
    if (sendBtn) sendBtn.disabled = false;
  }
}

function sendImageFollowup() {
  const textarea = panelEl?.querySelector('.followup-input');
  if (!textarea) return;
  const question = textarea.value.trim();
  if (!question || isStreaming) return;
  textarea.value = '';

  const convBody = panelEl?.querySelector('.conversation-body');
  if (convBody) {
    const qBlock = document.createElement('div');
    qBlock.className = 'question-bubble';
    qBlock.textContent = question;
    convBody.appendChild(qBlock);
    convBody.scrollTop = convBody.scrollHeight;
  }

  runImageFetch(question);
}

function showLightbox(imgUrl) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', zIndex: '2147483647',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'zoom-out'
  });
  const img = document.createElement('img');
  img.src = imgUrl;
  Object.assign(img.style, {
    maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
    borderRadius: '4px', boxShadow: '0 4px 32px rgba(0,0,0,0.8)'
  });
  overlay.appendChild(img);

  const closeLightbox = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    overlay.remove();
    document.removeEventListener('keydown', escHandler);
  };

  // Intercept mousedown on the overlay so the panel-close listener never fires
  overlay.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });
  overlay.addEventListener('click', closeLightbox);

  const escHandler = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(overlay);
}
