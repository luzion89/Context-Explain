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
const saveBtnEl       = $('saveBtn');
const statusMsgEl     = $('statusMsg');
const toggleKeyEl     = $('toggleKey');
const fieldBaseUrl    = $('fieldBaseUrl');
const keyHintEl       = $('keyHint');
const modelHintEl     = $('modelHint');

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

// ─── Settings: Provider UI ────────────────────────────────────────────────────
function updateProviderUI(p) {
  const info = PROVIDER_DEFAULTS[p] || PROVIDER_DEFAULTS.custom;
  apiModelEl.placeholder = info.placeholder;
  modelHintEl.textContent = info.hint;
  keyHintEl.textContent = 'Get your key at ' + info.keyHint;
  fieldBaseUrl.classList.toggle('visible', p === 'custom');
}

providerEl.addEventListener('change', () => updateProviderUI(providerEl.value));

toggleKeyEl.addEventListener('click', () => {
  const show = apiKeyEl.type === 'password';
  apiKeyEl.type = show ? 'text' : 'password';
  toggleKeyEl.textContent = show ? 'hide' : 'show';
});

// ─── Settings: Load ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(
    ['apiProvider','apiKey','apiModel','apiBaseUrl','responseLang'],
    (data) => {
      const p = data.apiProvider || 'openai';
      providerEl.value = p;
      apiKeyEl.value = data.apiKey || '';
      apiModelEl.value = data.apiModel || '';
      apiBaseUrlEl.value = data.apiBaseUrl || '';
      responseLangEl.value = data.responseLang || 'auto';
      updateProviderUI(p);
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
  }, () => {
    if (chrome.runtime.lastError) showStatus('Error: ' + chrome.runtime.lastError.message, 'warn');
    else showStatus('Settings saved!', 'success');
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
    const preview = (entry.explanation || '').replace(/[#*`>\n]/g, ' ').replace(/\s+/g,' ').trim().slice(0, 100);
    const fuCount = (entry.followUps || []).length;
    return `<div class="hist-item" data-id="${entry.id}">
      <div class="hist-item-main">
        <div class="hist-term">${escHtml(entry.term)}</div>
        <div class="hist-preview">${escHtml(preview)}</div>
        <div class="hist-meta">
          <span class="hist-time">${formatTs(entry.ts)}</span>
          <span class="hist-site">${escHtml(hostnameOf(entry.url))}</span>
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
  let html = `<div class="detail-explanation">${mdToSimpleHtml(entry.explanation || '')}</div>`;

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
  // Minimal markdown for history detail view
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);border-radius:5px;padding:8px 10px;font-size:11.5px;overflow-x:auto;margin:6px 0;color:#c8f0a8"><code>$1</code></pre>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8d5a8">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(232,160,48,0.1);color:#e8d5a8;padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}
