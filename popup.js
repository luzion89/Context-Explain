/* ============================================================
   Context Explain — popup.js
   ============================================================ */

const PROVIDER_DEFAULTS = {
  openai:    { placeholder: 'gpt-4o-mini',                hint: 'e.g. gpt-4o, gpt-4o-mini',             keyHint: 'platform.openai.com' },
  anthropic: { placeholder: 'claude-3-5-haiku-20241022',  hint: 'e.g. claude-opus-4-5, claude-3-5-haiku',keyHint: 'console.anthropic.com' },
  deepseek:  { placeholder: 'deepseek-chat',              hint: 'e.g. deepseek-chat, deepseek-reasoner', keyHint: 'platform.deepseek.com' },
  custom:    { placeholder: 'model-name',                 hint: 'Model name your API accepts',           keyHint: 'Your custom API key' },
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const providerEl      = $('provider');
const apiKeyEl        = $('apiKey');
const apiModelEl      = $('apiModel');
const apiBaseUrlEl    = $('apiBaseUrl');
const responseLangEl  = $('responseLang');
const themeSelectEl   = $('theme-select');
const translateLangEl = $('translate-lang');
const saveBtnEl       = $('saveBtn');
const statusMsgEl     = $('statusMsg');
const toggleKeyEl     = $('toggleKey');
const fieldBaseUrl    = $('baseUrlGroup');
const keyHintEl       = $('keyHint');
const modelHintEl     = $('modelHint');

// ─── Vision API DOM refs ──────────────────────────────────────────────────────
const visionEnabledEl      = $('vision-enabled');
const visionEndpointEl     = $('vision-endpoint');
const visionKeyEl          = $('vision-key');
const visionModelEl        = $('vision-model');
const visionUseTextEl      = $('vision-use-text-config');

// ─── Theme ────────────────────────────────────────────────────────────────────
const _sysDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
  const resolved = (theme === 'system')
    ? (_sysDark.matches ? 'dark' : 'light')
    : theme;
  document.body.dataset.theme = resolved;
}

_sysDark.addEventListener('change', () => {
  if (themeSelectEl && themeSelectEl.value === 'system') {
    applyTheme('system');
  }
});

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('page-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

// ─── AI Settings sub-tab switching ───────────────────────────────────────────
document.querySelectorAll('.ai-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ai-tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('ai-tab-' + btn.dataset.aiTab)?.classList.add('active');
  });
});

// ─── Settings: Provider UI ────────────────────────────────────────────────────
function updateProviderUI(p) {
  const info = PROVIDER_DEFAULTS[p] || PROVIDER_DEFAULTS.custom;
  apiModelEl.placeholder = info.placeholder;
  modelHintEl.textContent = info.hint;
  keyHintEl.textContent = 'Get your key at ' + info.keyHint;
  fieldBaseUrl.style.display = p === 'custom' ? '' : 'none';
}

providerEl.addEventListener('change', () => updateProviderUI(providerEl.value));

toggleKeyEl.addEventListener('click', () => {
  const show = apiKeyEl.type === 'password';
  apiKeyEl.type = show ? 'text' : 'password';
  toggleKeyEl.textContent = show ? 'hide' : 'show';
});

// ─── Vision API: key toggle ───────────────────────────────────────────────────
$('vision-key-toggle')?.addEventListener('click', () => {
  const inp = $('vision-key');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
});

// ─── Vision API: "Use Text API config" checkbox ───────────────────────────────
visionUseTextEl.addEventListener('change', function() {
  const endpointEl = $('vision-endpoint');
  const keyEl = $('vision-key');
  if (this.checked) {
    endpointEl.value = $('apiBaseUrl')?.value || '';
    keyEl.value = $('apiKey')?.value || '';
    endpointEl.disabled = true;
    keyEl.disabled = true;
  } else {
    endpointEl.disabled = false;
    keyEl.disabled = false;
  }
});

// ─── Settings: Load ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(
    ['apiProvider','apiKey','apiModel','apiBaseUrl','responseLang','theme','translateLang',
     'visionEnabled','visionApiEndpoint','visionApiKey','visionApiModel','visionUseTextConfig'],
    (data) => {
      const p = data.apiProvider || 'openai';
      providerEl.value = p;
      apiKeyEl.value = data.apiKey || '';
      apiModelEl.value = data.apiModel || '';
      apiBaseUrlEl.value = data.apiBaseUrl || '';
      responseLangEl.value = data.responseLang || 'auto';
      const theme = data.theme || 'system';
      themeSelectEl.value = theme;
      applyTheme(theme);
      translateLangEl.value = data.translateLang || 'Chinese (Simplified)';
      updateProviderUI(p);

      // Vision settings
      visionEnabledEl.checked   = data.visionEnabled || false;
      visionEndpointEl.value    = data.visionApiEndpoint || '';
      visionKeyEl.value         = data.visionApiKey || '';
      visionModelEl.value       = data.visionApiModel || '';
      visionUseTextEl.checked   = data.visionUseTextConfig || false;
      if (data.visionUseTextConfig) {
        visionEndpointEl.disabled = true;
        visionKeyEl.disabled = true;
      }
    }
  );
});

// ─── Settings: Save ───────────────────────────────────────────────────────────
let statusTO = null;
function showStatus(msg, type) {
  statusMsgEl.textContent = msg;
  statusMsgEl.className = 'status-msg ' + (type || '');
  if (statusTO) clearTimeout(statusTO);
  if (type === 'success') statusTO = setTimeout(() => {
    statusMsgEl.textContent = '';
    statusMsgEl.className = 'status-msg';
  }, 2200);
}

saveBtnEl.addEventListener('click', () => {
  const provider  = providerEl.value;
  const apiKey    = apiKeyEl.value.trim();
  const apiModel  = apiModelEl.value.trim();
  const apiBaseUrl = apiBaseUrlEl.value.trim();

  if (!apiKey) {
    apiKeyEl.classList.add('warning');
    showStatus('API key is required.', 'warn');
    apiKeyEl.focus();
    return;
  }
  apiKeyEl.classList.remove('warning');

  if (provider === 'custom' && !apiBaseUrl) {
    apiBaseUrlEl.classList.add('warning');
    showStatus('Base URL required for custom providers.', 'warn');
    apiBaseUrlEl.focus();
    return;
  }
  apiBaseUrlEl.classList.remove('warning');

  chrome.storage.sync.set({
    apiProvider: provider,
    apiKey,
    apiModel: apiModel || PROVIDER_DEFAULTS[provider]?.placeholder || 'gpt-4o-mini',
    apiBaseUrl,
    responseLang: responseLangEl.value,
    theme: themeSelectEl.value,
    translateLang: translateLangEl.value,
    // Vision settings — when 'Use Text API config' is checked, persist the
    // resolved text-API values so content.js can read visionApiKey directly.
    visionEnabled:       visionEnabledEl.checked,
    visionApiEndpoint:   visionUseTextEl.checked ? apiBaseUrl : visionEndpointEl.value.trim(),
    visionApiKey:        visionUseTextEl.checked ? apiKey     : visionKeyEl.value.trim(),
    visionApiModel:      visionModelEl.value.trim(),
    visionUseTextConfig: visionUseTextEl.checked,
  }, () => {
    if (chrome.runtime.lastError) showStatus('Error: ' + chrome.runtime.lastError.message, 'warn');
    else {
      applyTheme(themeSelectEl.value);
      showStatus('Settings saved!', 'success');
    }
  });
});

// ─── History ──────────────────────────────────────────────────────────────────
let allHistory = [];
let filterQuery = '';

function formatTs(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function loadHistory() {
  showHistList();
  chrome.storage.local.get(['ctxHistory'], (data) => {
    allHistory = data.ctxHistory || [];
    renderHistList(allHistory);
  });
}

function renderHistList(items) {
  const list = $('historyList');
  const q = filterQuery.toLowerCase();
  const filtered = q ? items.filter(e =>
    e.term.toLowerCase().includes(q) || (e.explanation || '').toLowerCase().includes(q)
  ) : items;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="hist-empty"><div class="hist-empty-icon">◎</div>${q ? 'No results for "' + filterQuery + '"' : 'No history yet.<br>Select text on any page to get started.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(entry => {
    const previewText = entry.explanation
      || (entry.followUps && entry.followUps[0] ? `Q: ${entry.followUps[0].q}` : '');
    const preview = previewText.replace(/[#*`>\n]/g, ' ').replace(/\s+/g,' ').trim().slice(0, 100);
    const fuCount = (entry.followUps || []).length;
    const modeBadge = entry.mode === 'translate'
      ? `<span class="hist-followup-badge" title="Translation">⇌</span>`
      : entry.mode === 'ask'
        ? `<span class="hist-followup-badge" title="Ask">?</span>`
        : entry.mode === 'image'
          ? `<span class="hist-followup-badge" title="Image">🖼</span>`
          : '';
    return `<div class="hist-item" data-id="${entry.id}">
      <div class="hist-item-main">
        <div class="hist-term">${escHtml(entry.term)}</div>
        <div class="hist-preview">${escHtml(preview)}</div>
        <div class="hist-meta">
          <span class="hist-time">${formatTs(entry.ts)}</span>
          <span class="hist-site">${escHtml(hostnameOf(entry.url))}</span>
          ${modeBadge}
          ${fuCount > 0 ? `<span class="hist-followup-badge">+${fuCount} Q</span>` : ''}
        </div>
      </div>
      <button class="hist-delete-btn" data-id="${entry.id}" title="Delete">✕</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.hist-item').forEach(el => {
    // Click on main area → detail view
    el.querySelector('.hist-item-main').addEventListener('click', () => {
      const id = el.dataset.id;
      const entry = filtered.find(e => e.id === id);
      if (entry) showDetail(entry);
    });
    // Click on delete btn → remove entry
    el.querySelector('.hist-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.id;
      deleteHistoryEntry(id);
    });
  });
}

function deleteHistoryEntry(id) {
  allHistory = allHistory.filter(e => e.id !== id);
  chrome.storage.local.set({ ctxHistory: allHistory }, () => {
    renderHistList(allHistory);
  });
}

function showDetail(entry) {
  $('hist-list-view').style.display = 'none';
  const dv = $('hist-detail-view');
  dv.classList.add('active');

  $('detailTerm').textContent = entry.term;
  $('detailDate').textContent = formatTs(entry.ts);

  const body = $('detailBody');
  // explanation is empty for ask-mode entries; followUps holds the Q&A
  let html = '';

  // Show image thumbnail for image-mode entries
  if (entry.mode === 'image' && entry.imageUrl) {
    html += `<div style="margin-bottom:12px;text-align:center">
      <a href="${escHtml(entry.imageUrl)}" target="_blank" rel="noopener" title="Click to view full image">
        <img src="${escHtml(entry.imageUrl)}" style="max-width:100%;max-height:140px;object-fit:contain;border-radius:6px;border:1px solid var(--border);cursor:zoom-in"
             onerror="this.style.display='none'">
      </a>
    </div>`;
  }

  html += entry.explanation
    ? `<div class="detail-explanation">${mdToSimpleHtml(entry.explanation)}</div>`
    : '';

  if (entry.followUps && entry.followUps.length > 0) {
    html += `<div class="detail-qa">`;
    entry.followUps.forEach(fu => {
      html += `<div class="detail-q">${escHtml(fu.q)}</div>
               <div class="detail-a">${mdToSimpleHtml(fu.a || '')}</div>`;
    });
    html += `</div>`;
  }

  html += `<div class="detail-url">From: <a href="${escHtml(entry.url)}" target="_blank">${escHtml(hostnameOf(entry.url))}</a> — ${escHtml(entry.pageTitle || '')}</div>`;
  body.innerHTML = html;
  renderMermaidIn(body);
}

function showHistList() {
  $('hist-list-view').style.display = '';
  const dv = $('hist-detail-view');
  dv.classList.remove('active');
}

$('btnBack').addEventListener('click', showHistList);

// ─── History: search ──────────────────────────────────────────────────────────
$('histSearch').addEventListener('input', (e) => {
  filterQuery = e.target.value;
  renderHistList(allHistory);
});

// ─── History: export ──────────────────────────────────────────────────────────
$('btnExport').addEventListener('click', () => {
  const json = JSON.stringify(allHistory, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `context-explain-history-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

// ─── History: clear ───────────────────────────────────────────────────────────
$('btnClear').addEventListener('click', () => {
  if (!confirm('Clear all explanation history? This cannot be undone.')) return;
  chrome.storage.local.set({ ctxHistory: [] }, () => {
    allHistory = [];
    renderHistList([]);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function mdToSimpleHtml(text) {
  if (!text) return '';

  // Extract LaTeX before marked processes it
  const maths = [];
  const ph = (display, tex) => { maths.push({ display, tex }); return `MATHPH${maths.length-1}MATHPH`; };
  let t = text;
  t = t.replace(/\$\$([\s\S]+?)\$\$/g,  (_, x) => ph(true,  x));
  t = t.replace(/\\\[([\s\S]+?)\\\]/g,   (_, x) => ph(true,  x));
  t = t.replace(/\\\(([^]*?)\\\)/g,       (_, x) => ph(false, x));
  t = t.replace(/(?<![\\$])\$([^$\n]{1,200}?)\$(?!\d)/g, (_, x) => ph(false, x));

  const renderer = new marked.Renderer();
  renderer.code = ({ text: code, lang }) => {
    if (lang === 'mermaid') {
      const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<div class="mermaid-block" data-raw="${escaped}"><div class="mermaid-loading">⟳ Rendering diagram…</div></div>`;
    }
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<pre style="background:rgba(0,0,0,0.3);border-radius:5px;padding:8px 10px;font-size:11.5px;overflow-x:auto;margin:6px 0;color:#c8f0a8"><code>${escaped}</code></pre>`;
  };

  let html;
  try { html = marked.parse(t, { gfm: true, breaks: false, renderer }); }
  catch (e) { html = `<p>${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`; }

  if (typeof katex !== 'undefined') {
    html = html.replace(/MATHPH(\d+)MATHPH/g, (_, i) => {
      const { display, tex } = maths[+i];
      try { return katex.renderToString(tex, { displayMode: display, throwOnError: false }); }
      catch { return `<code>${tex}</code>`; }
    });
  } else {
    html = html.replace(/MATHPH(\d+)MATHPH/g, (_, i) => `<code>${maths[+i].tex}</code>`);
  }
  return html;
}

// ─── API Connection Test ───────────────────────────────────────────────────────
const TEST_TIMEOUT_MS = 10000;

function classifyApiError(e, status) {
  if (e.name === 'AbortError') return 'Request timed out (10s). Check your endpoint URL and network.';
  if (status === 401) return 'Authentication failed (401). Check your API key.';
  if (status === 403) return 'Access forbidden (403). Check API key permissions.';
  if (status === 404) return 'Endpoint not found (404). Check the API base URL.';
  if (status === 429) return 'Rate limited (429). Please try again later.';
  if (status >= 500) return `Server error (${status}). The API provider may have issues.`;
  if (e.message?.includes('Failed to fetch')) return 'Network error. Check your internet connection and endpoint URL.';
  return `Connection failed: ${(e.message || 'Unknown error').substring(0, 200)}`;
}

async function runApiTest(btn, resultEl, endpoint, apiKey, model, isVision) {
  if (btn.dataset.testing === '1') return;
  btn.dataset.testing = '1';
  btn.textContent = '⟳';
  btn.className = 'btn-model-check spinning';
  resultEl.style.display = 'none';
  resultEl.className = 'test-inline-result';

  const resetBtn = (success) => {
    btn.textContent = success ? '✓' : '✗';
    btn.className = 'btn-model-check ' + (success ? 'check-success' : 'check-error');
    btn.dataset.testing = '';
    setTimeout(() => {
      btn.textContent = '✓';
      btn.className = 'btn-model-check';
    }, 4000);
  };

  const showResult = (success, message) => {
    resultEl.style.display = 'block';
    resultEl.className = 'test-inline-result ' + (success ? 'success' : 'error');
    resultEl.textContent = (success ? '✓ ' : '✗ ') + message;
    resetBtn(success);
  };

  if (!endpoint) { showResult(false, 'Endpoint is not configured.'); return; }
  if (!apiKey)   { showResult(false, 'API key is not configured.');  return; }
  if (!model)    { showResult(false, 'Model is not configured.');     return; }

  let url;
  try { url = new URL(endpoint.replace(/\/$/, '') + '/chat/completions'); }
  catch { showResult(false, 'Invalid endpoint URL format.'); return; }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  const startTime = Date.now();
  let httpStatus = null;

  try {
    const TEST_IMAGE_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

    const messages = isVision ? [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: TEST_IMAGE_B64 } },
        { type: 'text', text: 'Describe this image in 3 words.' }
      ]
    }] : [{
      role: 'user',
      content: 'Reply with exactly: OK'
    }];

    const resp = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages, max_tokens: 10, stream: false }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    httpStatus = resp.status;
    const latency = Date.now() - startTime;

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('[Context Explain] API test error:', resp.status, body);
      let detail = '';
      try {
        const parsed = JSON.parse(body);
        detail = parsed?.error?.message || '';
        // Some providers (e.g. OpenRouter) include more detail in metadata
        const meta = parsed?.error?.metadata;
        if (meta) {
          const extra = meta.raw || meta.details || JSON.stringify(meta);
          if (extra && extra !== '{}') detail += (detail ? ' — ' : '') + extra;
        }
      } catch {}
      throw Object.assign(new Error(detail || `HTTP ${resp.status}`), { status: resp.status });
    }

    const json = await resp.json().catch(() => null);
    console.log('[Context Explain] API test success:', json);
    if (!json?.choices?.[0]) throw new Error('Unexpected response structure from API.');

    const timestamp = new Date().toLocaleTimeString();
    showResult(true, `Connected — ${latency}ms (${timestamp})`);

  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[Context Explain] API test exception:', e);
    showResult(false, classifyApiError(e, e.status || httpStatus));
  }
}

// Wire up test buttons after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  $('test-text-api')?.addEventListener('click', () => {
    const provider = providerEl.value;
    let endpoint = apiBaseUrlEl.value.trim();
    if (!endpoint) {
      const defaults = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com/v1', deepseek: 'https://api.deepseek.com/v1' };
      endpoint = defaults[provider] || '';
    }
    runApiTest(
      $('test-text-api'),
      $('test-text-result'),
      endpoint,
      apiKeyEl.value.trim(),
      (apiModelEl.value || PROVIDER_DEFAULTS[provider]?.placeholder || '').trim(),
      false
    );
  });

  $('test-vision-api')?.addEventListener('click', () => {
    const endpoint = visionUseTextEl.checked
      ? (apiBaseUrlEl.value.trim() || (() => {
          const defaults = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com/v1', deepseek: 'https://api.deepseek.com/v1' };
          return defaults[providerEl.value] || '';
        })())
      : visionEndpointEl.value.trim();
    const apiKey = visionUseTextEl.checked ? apiKeyEl.value.trim() : visionKeyEl.value.trim();
    runApiTest(
      $('test-vision-api'),
      $('test-vision-result'),
      endpoint,
      apiKey,
      visionModelEl.value.trim(),
      true
    );
  });
});

// ─── Mermaid via sandboxed iframe (bypasses popup CSP) ───────────────────────
let _sandboxIframe = null;
let _sandboxReady = false;
let _sandboxQueue = []; // [{id, code, resolve}]
let _pendingRenders = {}; // id → {el, resolve}

function getSandbox() {
  if (_sandboxIframe) return _sandboxIframe;
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('mermaid-sandbox.html');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  _sandboxIframe = iframe;

  window.addEventListener('message', (e) => {
    const { id, svg, error } = e.data || {};
    if (!id || !_pendingRenders[id]) return;
    const { el } = _pendingRenders[id];
    delete _pendingRenders[id];
    if (svg) {
      el.innerHTML = svg;
      el.removeAttribute('data-raw');
    } else {
      el.innerHTML = `<pre style="color:#d06060;font-size:11px">Mermaid: ${error||'render failed'}</pre>`;
    }
  });

  iframe.addEventListener('load', () => {
    _sandboxReady = true;
    _sandboxQueue.forEach(({ id, code, el }) => {
      _pendingRenders[id] = { el };
      iframe.contentWindow.postMessage({ id, code }, '*');
    });
    _sandboxQueue = [];
  });

  return iframe;
}

function renderMermaidIn(container) {
  const blocks = container.querySelectorAll('.mermaid-block[data-raw]');
  if (!blocks.length) return;

  const iframe = getSandbox();
  blocks.forEach((el, i) => {
    const code = el.dataset.raw.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    const id = `mp${Date.now()}${i}`;
    if (_sandboxReady) {
      _pendingRenders[id] = { el };
      iframe.contentWindow.postMessage({ id, code }, '*');
    } else {
      _sandboxQueue.push({ id, code, el });
    }
  });
}
