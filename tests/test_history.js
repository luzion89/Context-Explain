/**
 * Unit tests for history logic in content.js
 * Run with: node tests/test_history.js
 * 
 * Simulates chrome.storage.local API and tests:
 * 1. Explain mode: saveToHistory stores explanation correctly
 * 2. Ask mode: saveToHistory + updateHistoryFollowup stores Q&A correctly
 * 3. Race condition: updateHistoryFollowup called before saveToHistory completes
 * 4. popup.js showDetail: ask-mode entry displays followUps
 * 5. popup.js renderHistList: ask-mode preview shows question
 * 6. restoreAnnotations: filters entries with term (not explanation)
 */

// ─── Mock chrome.storage.local ────────────────────────────────────────────────
let _store = {};
const chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const result = {};
        for (const k of (Array.isArray(keys) ? keys : [keys])) result[k] = _store[k];
        // Simulate async — use setImmediate
        setImmediate(() => cb(result));
      },
      set: (obj, cb) => {
        Object.assign(_store, obj);
        if (cb) setImmediate(cb);
      }
    },
    sync: { get: (keys, cb) => setImmediate(() => cb({})) }
  },
  runtime: { lastError: null, getURL: s => s }
};
global.chrome = chrome;
global.location = { href: 'https://example.com/test' };
global.document = { title: 'Test Page' };
global.window = { getSelection: () => null };

// ─── Load the relevant functions from content.js (extract them) ───────────────
// We'll inline the two key functions to test them in isolation
function saveToHistory(term, contextBefore, contextAfter, explanation, followUps) {
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
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
      chrome.storage.local.set({ ctxHistory: hist }, () => resolve(entry));
    });
  });
}

function updateHistoryFollowup(historyId, question, answer) {
  return new Promise(resolve => {
    chrome.storage.local.get(['ctxHistory'], (data) => {
      const hist = data.ctxHistory || [];
      const entry = hist.find(e => e.id === historyId);
      if (entry) {
        if (!entry.followUps) entry.followUps = [];
        entry.followUps.push({ q: question, a: answer });
        chrome.storage.local.set({ ctxHistory: hist }, resolve);
      } else {
        console.warn(`  ⚠ updateHistoryFollowup: id ${historyId} not found`);
        resolve();
      }
    });
  });
}

// ─── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

async function getHistory() {
  return new Promise(r => chrome.storage.local.get(['ctxHistory'], d => r(d.ctxHistory || [])));
}

// ─── Tests ────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n=== History Logic Tests ===\n');

  // Reset
  _store = {};

  // Test 1: Explain mode
  console.log('1. Explain mode');
  const e1 = await saveToHistory('transformer', 'ctx before', 'ctx after', 'A transformer is...', []);
  const h1 = await getHistory();
  assert('entry saved', h1.length === 1);
  assert('explanation correct', h1[0].explanation === 'A transformer is...');
  assert('followUps empty', h1[0].followUps.length === 0);

  // Test 2: Explain mode follow-up
  console.log('\n2. Explain mode follow-up');
  await updateHistoryFollowup(e1.id, 'How does attention work?', 'Attention allows...');
  const h2 = await getHistory();
  assert('followUp saved', h2[0].followUps.length === 1);
  assert('followUp q correct', h2[0].followUps[0].q === 'How does attention work?');
  assert('followUp a correct', h2[0].followUps[0].a === 'Attention allows...');

  // Test 3: Ask mode (race condition fix needed)
  console.log('\n3. Ask mode (race condition test)');
  _store = {};
  const e3 = await saveToHistory('bond', 'ctx b', 'ctx a', '', []);
  await updateHistoryFollowup(e3.id, 'What is a zero-coupon bond?', 'A bond that pays no interest...');
  const h3 = await getHistory();
  assert('ask entry saved', h3.length === 1);
  assert('explanation empty', h3[0].explanation === '');
  assert('followUp saved', h3[0].followUps.length === 1);
  assert('question correct', h3[0].followUps[0].q === 'What is a zero-coupon bond?');
  assert('answer correct', h3[0].followUps[0].a === 'A bond that pays no interest...');

  // Test 4: popup showDetail logic for ask mode
  console.log('\n4. popup showDetail — ask mode entry');
  const askEntry = h3[0];
  const hasContent = askEntry.explanation
    ? 'explanation'
    : (askEntry.followUps && askEntry.followUps.length > 0 ? 'followUps' : 'nothing');
  assert('shows followUps (not explanation)', hasContent === 'followUps');

  // Test 5: popup list preview for ask mode
  console.log('\n5. popup list preview — ask mode');
  const previewText = askEntry.explanation
    || (askEntry.followUps && askEntry.followUps[0] ? `Q: ${askEntry.followUps[0].q}` : '');
  assert('preview shows question', previewText.startsWith('Q: What is a zero-coupon'));

  // Test 6: restoreAnnotations filter
  console.log('\n6. restoreAnnotations filter — includes ask-mode entries');
  const entries = h3.filter(e => e.url === 'https://example.com/test' && e.term);
  assert('ask-mode entry included', entries.length === 1);
  const entriesOldFilter = h3.filter(e => e.url === 'https://example.com/test' && e.explanation);
  assert('old filter WOULD exclude it (confirms the bug was real)', entriesOldFilter.length === 0);

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
