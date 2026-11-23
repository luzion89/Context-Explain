/**
 * Runs the unpacked extension in a temporary Chrome profile.
 * See README_ZH.md for the runner and optional BookOrbit fixture.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const bookOrbit = process.env.BOOKORBIT_SOURCE && resolve(process.env.BOOKORBIT_SOURCE);
const foliate = bookOrbit && join(bookOrbit, 'client/public/assets/foliate');
const readerInputDir = bookOrbit && join(bookOrbit, 'client/src/features/reader/epub/composables');
const readerInput = new Map();
if (readerInputDir) {
  for (const name of ['useFoliateInput', 'useFoliateSelection']) {
    const source = await readFile(join(readerInputDir, name + '.ts'), 'utf8');
    readerInput.set('/reader-input/' + name + '.js', stripTypeScriptTypes(source));
  }
}
const baseline = process.env.BASELINE_EXTENSION;
const extensionDir = process.env.EXTENSION_DIR || root;
const trigger = '#ctx-explain-trigger';
const panel = '#ctx-explain-root';
const requests = [];

const pageText = '<title>Fixture</title><main><p>First bank means river.</p>' +
  '<p id="sample">Finance <i>bank</i> holds money <b>bank</b> today.</p>' +
  '<p aria-hidden="true">HIDDEN CONTEXT</p><p id="adjacent">Adjacent paragraph.</p></main>';
const childText = '<p id="child">Before <b>iframe phrase</b> after.</p>';
const readerPage = `<title>Fixture Book</title><style>body{margin:0}foliate-view{display:block;width:760px;height:400px}</style>
  <foliate-view></foliate-view><script type="module">
  import '/foliate/view.js';
  import { useFoliateInput } from '/reader-input/useFoliateInput.js';
  import { useFoliateSelection } from '/reader-input/useFoliateSelection.js';
  const view = document.querySelector('foliate-view');
  const selection = useFoliateSelection(() => view);
  const input = useFoliateInput(() => view, undefined, selection.handleSelectionEnd,
    selection.handleSelectionChange, undefined, selection.handleInteractionStart, selection.handleInteractionEnd);
  window.readerClicks = 0;
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.data?.type === 'foliate-click') window.readerClicks++;
  });
  view.addEventListener('load', ({detail}) => {
    window.chapter = detail.doc;
    input.attachIframeClicks(detail.doc);
  });
  await view.open('/fixture.epub');
  await view.init({showTextStart:true});
  window.view = view;
  </script>`;

async function makeEpub() {
  const JSZip = require('../lib/jszip.min.js');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0"
    xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>
    <rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('book.opf', `<?xml version="1.0"?><package version="3.0" unique-identifier="testid"
    xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixture Book</dc:title><dc:language>en</dc:language><dc:identifier id="testid">fixture</dc:identifier>
    </metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="one"/><itemref idref="two"/></spine></package>`);
  for (const [file, chapter] of [['one', 'One'], ['two', 'Two']]) {
    zip.file(file + '.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">
      <head><title>Chapter ${chapter}</title></head><body><p id="start" style="text-align: right; margin-top: 96px">Opening <b>Chapter ${chapter}</b> starts here.</p>
      ${Array.from({ length: 95 }, (_, i) => `<p>Page paragraph number ${i}, with enough text to make this chapter span several pages.</p>`).join('')}
      </body></html>`);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

function makePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream'
  ];
  let pdf = '%PDF-1.4\n';
  let xref = 'xref\n0 5\n0000000000 65535 f \n';
  for (const [i, object] of objects.entries()) {
    xref += String(pdf.length).padStart(10, '0') + ' 00000 n \n';
    pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n';
  }
  return pdf + xref + 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + pdf.length + '\n%%EOF\n';
}

const epub = foliate ? await makeEpub() : null;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/chat/completions') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    if (req.method === 'OPTIONS') return res.end();
    let body = '';
    for await (const buffer of req) body += buffer;
    requests.push(JSON.parse(body).messages);
    const content = 'Fixture answer.\n\n```mermaid\ngraph TD; A-->B\n```';
    res.setHeader('Content-Type', 'text/event-stream');
    return res.end('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n');
  }
  if (readerInput.has(path)) {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(readerInput.get(path));
  }
  if (foliate && /^\/foliate\/[\w./-]+\.js$/.test(path) && !path.includes('..')) {
    try {
      const data = await readFile(join(foliate, path.slice('/foliate/'.length)));
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(data);
    } catch { res.writeHead(404); return res.end(); }
  }
  if (path === '/fixture.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    return res.end(makePdf());
  }
  if (path === '/fixture.epub' && epub) {
    res.setHeader('Content-Type', 'application/epub+zip');
    return res.end(epub);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const frames = '<iframe id="nested" width="420" height="210" src="/nested"></iframe>' +
    '<iframe id="blank" width="420" height="210" src="about:blank"></iframe>' +
    '<iframe id="srcdoc" width="420" height="210" srcdoc="' + childText.replaceAll('"', '&quot;') + '"></iframe>' +
    '<iframe id="blob" width="420" height="210" sandbox="allow-same-origin allow-scripts"></iframe>' +
    `<iframe id="cross" width="420" height="210" src="http://127.0.0.1:${server.address().port}/child"></iframe>` +
    '<style>iframe{display:block;margin:8px}</style>' +
    `<script>const fillBlank=()=>{blank.contentDocument.body.innerHTML=${JSON.stringify(childText)}};
      blank.addEventListener('load', fillBlank); if (blank.contentDocument?.body) fillBlank();
      blob.src=URL.createObjectURL(new Blob([${JSON.stringify(childText)}],{type:'text/html'}));</script>`;
  const pages = {
    '/': pageText + frames,
    '/child': childText,
    '/nested': '<iframe id="inner" width="380" height="160" src="/child"></iframe>',
    '/special': '<p id="open"></p><p id="closed"></p><p id="stale">Before <b>stale phrase</b> after.</p>' +
      '<div class="textLayer"><p id="pdf">PDF before <b>PDF phrase</b> after PDF.</p></div>' +
      `<script>for (const [id,mode] of [['open','open'],['closed','closed']]) {
        const shadow = document.getElementById(id).attachShadow({mode});
        shadow.innerHTML = '<span>Shadow before <b>shadow phrase</b> after.</span>';
        if (mode === 'closed') window.closedTestNode = shadow.querySelector('b').firstChild;
      }</script>`,
    '/reader': readerPage
  };
  res.end('<!DOCTYPE html>' + (pages[path] || ''));
});
server.listen(0, '0.0.0.0');
await once(server, 'listening');
const origin = 'http://localhost:' + server.address().port;
const apiBaseUrl = origin.replace('localhost', '127.0.0.1') + '/api';
const profile = await mkdtemp(join(tmpdir(), 'ctx-browser-'));
const child = spawn(chrome, [
  '--headless=new', '--no-first-run', '--disable-default-apps', '--window-size=1280,950',
  '--remote-debugging-port=0', '--enable-unsafe-extension-debugging',
  '--user-data-dir=' + profile, 'about:blank'
], { stdio: 'ignore' });
const exited = once(child, 'exit');
let browser;
let passed = 0;

async function until(check, label) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(70);
  }
  assert.fail(label);
}

async function select(frame, selector, start = 0, end, toSelector = selector) {
  await frame.locator(selector).scrollIntoViewIfNeeded();
  await frame.evaluate(({ selector, start, end, toSelector }) => {
    function node(path) {
      const el = path.startsWith('#open ') ?
        document.querySelector('#open').shadowRoot.querySelector(path.slice(6)) : document.querySelector(path);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        if (text.data.trim()) return text;
      }
      throw new Error('No text found in ' + path);
    }
    const from = node(selector), to = node(toSelector);
    document.defaultView.focus();
    const range = document.createRange();
    range.setStart(from, start);
    range.setEnd(to, end ?? to.length);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, { selector, start, end, toSelector });
}

async function action(frame, index) {
  await frame.locator(trigger).locator('button').nth(index).click();
}

async function ask(frame, text) {
  const input = frame.locator(panel + ' textarea');
  await input.fill(text);
  await frame.locator(panel + ' .followup-send').click();
}

function pass(name) {
  console.log('✓ ' + name);
  passed++;
}

try {
  await until(() => readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => ''), 'Chrome debugging port');
  const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
  const cdp = await browser.newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: baseline || extensionDir });
  const context = browser.contexts()[0];
  const settings = await context.newPage();
  settings.setDefaultTimeout(7000);
  await settings.goto('chrome-extension://' + id + '/popup.html');
  await settings.evaluate(apiBaseUrl => chrome.storage.sync.set({
    apiProvider: 'custom', apiBaseUrl, apiKey: 'fixture-key', apiModel: 'fixture', responseLang: 'English'
  }), apiBaseUrl);
  const getHistory = () => settings.evaluate(async () => (await chrome.storage.local.get('ctxHistory')).ctxHistory || []);
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
  await page.goto(origin);
  const nested = page.frameLocator('#nested').frameLocator('#inner');
  const nestedFrame = () => nested.locator('#child b').elementHandle().then(node => node.ownerFrame());

  if (baseline) {
    await select(await nestedFrame(), '#child b');
    await sleep(500);
    assert.equal(await nested.locator(trigger).count(), 0);
    await select(page, '#sample b');
    await action(page, 0);
    await until(() => requests.length, 'baseline request');
    assert.match(requests[0].at(-1).content, /First \[bank\] means river/);
    pass('baseline reproduced missing iframe injection and wrong repeated occurrence');
  } else {
    await select(page, '#sample b');
    await action(page, 0);
    await until(async () => (await getHistory()).length === 1, 'web history saved');
    await page.locator(panel + ' .mermaid-block svg').waitFor();
    const entry = (await getHistory())[0];
    assert.match(entry.contextBefore, /Finance bank holds money $/);
    assert.match(entry.contextAfter, /^ today\.\nAdjacent paragraph\./);
    assert.doesNotMatch(entry.contextAfter, /HIDDEN/);
    await ask(page, 'first follow-up');
    await until(async () => (await getHistory())[0].followUps.length === 1, 'follow-up saved');
    await page.reload();
    await page.locator('#sample .ctx-explain-mark').waitFor();
    assert.equal(await page.locator('#sample .ctx-explain-mark').textContent(), 'bank');
    await settings.locator('[data-tab=history]').click();
    await settings.locator('#histSearch').fill('first follow-up');
    await until(() => settings.locator('.hist-item').count(), 'history search matched follow-up');
    pass('top page, repeated text, visible adjacent context, Mermaid, follow-up and history search/restore');

    await select(page, '#sample i', 0, 4, '#sample b');
    await action(page, 2);
    await until(async () => (await getHistory()).length === 2, 'multi-node translation saved');
    assert.equal((await getHistory())[0].term, 'bank holds money bank');
    assert.equal((await getHistory())[0].mode, 'translate');
    await page.reload();
    await select(page, '#sample b');
    await page.locator(trigger).waitFor();
    await select(await nestedFrame(), '#child b');
    await nested.locator(trigger).waitFor();
    await until(async () => !(await page.locator(trigger).count()), 'top trigger removed');
    const beforeFrame = requests.length;
    await action(nested, 1);
    assert.equal(requests.length, beforeFrame);
    await ask(nested, 'one frame request');
    await until(async () => (await getHistory()).length === 3, 'iframe history saved');
    assert.equal(requests.length, beforeFrame + 1);
    const frameEntry = (await getHistory())[0];
    assert.equal(frameEntry.frameUrl, origin + '/child');
    assert.equal(frameEntry.url, origin + '/');
    pass('multi-node translation and nested iframe ask with one request and one active trigger');

    for (const name of ['blank', 'srcdoc', 'blob', 'cross']) {
      const locator = page.frameLocator('#' + name);
      await page.locator('#' + name).scrollIntoViewIfNeeded();
      const frame = await (await locator.locator('body').elementHandle()).ownerFrame();
      await select(frame, '#child b').catch(error => { throw new Error(name + ': ' + error.message); });
      await locator.locator(trigger).waitFor({ timeout: 7000 });
      const previous = (await getHistory()).length;
      await action(locator, 0);
      await until(async () => (await getHistory()).length === previous + 1, name + ' explain saved');
      const saved = (await getHistory())[0];
      assert.equal(saved.url, origin + '/');
      assert.equal(saved.frameUrl, name === 'cross' ? origin.replace('localhost', '127.0.0.1') + '/child' : '');
      assert.equal(saved.term, 'iframe phrase');
      if (name === 'blob') assert.equal(await locator.locator('.ctx-explain-mark').count(), 0);
    }
    await page.evaluate(() => {
      const old = document.querySelector('#blob');
      const replacement = old.cloneNode();
      replacement.src = '/child';
      old.replaceWith(replacement);
    });
    const replacement = page.frameLocator('#blob');
    await page.locator('#blob').scrollIntoViewIfNeeded();
    const replacementFrame = await (await replacement.locator('#child').elementHandle()).ownerFrame();
    assert.equal(await replacement.locator(panel).count(), 0);
    await select(replacementFrame, '#child b');
    await replacement.locator(trigger).waitFor();
    assert.equal(await replacement.locator(trigger).count(), 1);
    pass('about:blank, srcdoc, sandboxed blob, cross-origin and dynamic frame replacement');

    await page.goto(origin + '/special');
    await select(page, '#open b');
    await action(page, 1);
    assert.equal(await page.locator(panel + ' .term-block').textContent(), 'shadow phrase');
    await page.locator(panel + ' .close-btn').click();
    await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(window.closedTestNode);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
    });
    await sleep(250);
    assert.equal(await page.locator(trigger).count(), 0);
    await select(page, '#pdf b');
    await action(page, 0);
    await until(async () => (await getHistory())[0].sourceType === 'pdf-text-layer', 'PDF text layer saved');
    assert.equal(await page.locator('.textLayer .ctx-explain-mark').count(), 0);
    await page.locator(panel + ' .close-btn').click();

    await select(page, '#stale b');
    await page.locator(trigger).waitFor();
    await page.evaluate(trigger => {
      const parent = document.querySelector('#stale');
      parent.querySelector('b').replaceWith(parent.querySelector('b').cloneNode(true));
      document.querySelector(trigger).shadowRoot.querySelector('button').click();
    }, trigger);
    await until(async () => (await getHistory())[0].contextQuality === 'quote', 'stale Range relocated by text quote');
    await page.reload();
    await select(page, '#stale b');
    await page.locator(trigger).waitFor();
    await page.evaluate(trigger => {
      document.querySelector('#stale').replaceChildren('Unrelated text');
      document.querySelector(trigger).shadowRoot.querySelector('button').click();
    }, trigger);
    await page.locator(panel).getByText('Surrounding context is unavailable.', { exact: false }).waitFor();
    await until(async () => (await getHistory())[0].contextQuality === 'selection-only', 'selection-only history saved');
    assert.equal((await getHistory())[0].contextBefore, '');
    pass('open and closed Shadow DOM, PDF text layer, quote recovery and selection-only fallback');

    if (foliate) {
      await page.goto(origin + '/reader');
      await page.waitForFunction(() => window.view && window.chapter?.querySelector('#start'));
      async function selectChapter(selector) {
        await page.evaluate(selector => {
          const doc = window.chapter;
          const node = doc.querySelector(selector).firstChild;
          doc.defaultView.focus();
          const range = doc.createRange();
          range.setStart(node, 0);
          range.setEnd(node, node.length);
          doc.getSelection().removeAllRanges();
          doc.getSelection().addRange(range);
        }, selector);
        const chapter = page.frames().find(frame => frame.url().startsWith('blob:'));
        assert.ok(chapter);
        return chapter;
      }
      let chapter = await selectChapter('#start b');
      const firstCfi = await page.evaluate(() => window.view.lastLocation.cfi);
      await action(chapter, 0);
      await sleep(450); // BookOrbit defers single-click navigation by 300 ms.
      assert.equal(await page.evaluate(() => window.readerClicks), 0, 'Explain click reached BookOrbit navigation');
      assert.equal(await page.evaluate(() => window.view.lastLocation.cfi), firstCfi);
      await until(async () => (await getHistory())[0].sourceType === 'epub', 'BookOrbit EPUB history saved');
      const book = (await getHistory())[0];
      assert.equal(book.pageTitle, 'Fixture Book');
      assert.equal(book.url, origin + '/reader');
      assert.equal(book.frameUrl, '');
      assert.match(book.contextAfter, /^ starts here/);
      assert.equal(await chapter.locator('.ctx-explain-mark').count(), 0);
      await ask(chapter, 'EPUB follow-up');
      await until(async () => (await getHistory())[0].followUps.length === 1, 'BookOrbit EPUB follow-up saved');
      await ask(chapter, 'Second EPUB follow-up');
      await until(async () => (await getHistory())[0].followUps.length === 2, 'BookOrbit second EPUB follow-up saved');
      assert.ok(requests.at(-1).some(message => message.content === 'EPUB follow-up'));
      await chapter.locator(panel + ' .close-btn').click();
      await sleep(450);
      assert.equal(await page.evaluate(() => window.readerClicks), 0, 'Panel interactions reached BookOrbit navigation');
      assert.equal(await page.evaluate(() => window.view.lastLocation.cfi), firstCfi);
      const reader = await page.locator('foliate-view').boundingBox();
      await page.mouse.click(reader.x + reader.width - 28, reader.y + reader.height / 2);
      await page.waitForFunction(previous => window.view.lastLocation?.cfi !== previous, firstCfi);
      assert.equal(await page.evaluate(() => window.readerClicks), 1, 'Native page click should still reach the reader');
      await page.evaluate(() => {
        const doc = window.chapter;
        const iframe = doc.defaultView.frameElement.getBoundingClientRect();
        const viewport = window.view.getBoundingClientRect();
        const visible = [...doc.querySelectorAll('p:not(#start)')].find(p => {
          const range = doc.createRange();
          range.setStart(p.firstChild, 0);
          range.setEnd(p.firstChild, 12);
          const r = range.getBoundingClientRect();
          return r.left + iframe.left >= viewport.left + 5 && r.right + iframe.left < viewport.right - 5 &&
            r.top + iframe.top >= viewport.top + 5 && r.bottom + iframe.top < viewport.bottom - 5;
        });
        if (!visible) throw new Error('No paragraph visible after turning the page');
        visible.id = 'after-page';
      });
      chapter = await selectChapter('#after-page');
      await action(chapter, 1);
      await chapter.locator(panel + ' .followup-input').waitFor();
      const pin = chapter.locator(panel + ' .pin-btn');
      await pin.press('Space');
      assert.ok(await pin.evaluate(button => button.classList.contains('active')));
      await sleep(450);
      assert.equal(await page.evaluate(() => window.readerClicks), 1, 'Ask click reached BookOrbit navigation');
      await page.evaluate(() => window.view.goTo(1));
      chapter = await selectChapter('#start b');
      await action(chapter, 2);
      await until(async () => (await getHistory())[0].term === 'Chapter Two', 'BookOrbit next chapter translation');
      await sleep(450);
      assert.equal(await page.evaluate(() => window.readerClicks), 1, 'Translate click reached BookOrbit navigation');
      pass('BookOrbit native input and EPUB, stable explain/ask/translate panel, follow-ups, native page turn and chapter change');
    }

    await page.goto(origin);
    await select(page, '#adjacent');
    await action(page, 0);
    await page.locator('#adjacent .ctx-explain-mark').waitFor();
    await settings.evaluate(async () => {
      const history = (await chrome.storage.local.get('ctxHistory')).ctxHistory;
      const entry = history.find(entry => entry.term === 'Adjacent paragraph.');
      await changeHistory('delete', entry.id);
    });
    await page.locator('#adjacent .ctx-explain-mark').waitFor({ state: 'detached' });
    assert.ok(!(await getHistory()).some(entry => entry.term === 'Adjacent paragraph.'));
    pass('history deletion also removes the source underline');

    await page.bringToFront();
    await settings.evaluate(async apiBaseUrl => {
      await chrome.storage.sync.set({visionEnabled:true, visionApiEndpoint:apiBaseUrl,
        visionApiKey:'fixture-key', visionApiModel:'fixture'});
      const [active] = await chrome.tabs.query({active:true,currentWindow:true});
      await chrome.tabs.sendMessage(active.id, { type:'IMAGE_CONTEXT_MENU', action:'ask-image',
        srcUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }, {frameId:0});
    }, apiBaseUrl);
    await page.locator(panel + ' .term-block img').waitFor();
    await ask(page, 'What does the fixture show?');
    await until(async () => (await getHistory())[0].mode === 'image', 'image response stored');
    assert.equal(requests.at(-1).at(-1).content[0].type, 'image_url');
    pass('image panel, multimodal request and history');
    await settings.locator('[data-tab=settings]').click();
    const manifestVersion = await settings.evaluate(() => chrome.runtime.getManifest().version);
    assert.equal(await settings.locator('.footer-version').textContent(), 'v' + manifestVersion);
    assert.doesNotMatch(await settings.locator('#page-settings').innerText(), /Selection compatibility|选区兼容性/);
    for (const url of ['chrome://version/', origin + '/fixture.pdf']) {
      await page.goto(url);
      if (url.endsWith('.pdf')) assert.equal(await page.evaluate(() => document.contentType), 'application/pdf');
      await page.bringToFront();
      const receiver = await settings.evaluate(async () => {
        const [target] = await chrome.tabs.query({ active: true, currentWindow: true });
        return chrome.tabs.sendMessage(target.id, {
          type: 'IMAGE_CONTEXT_MENU', error: 'Unexpected extension UI'
        }, { frameId: 0 }).then(() => 'available', () => 'unavailable');
      });
      assert.equal(receiver, 'unavailable');
    }
    pass('manifest-driven popup version, no settings compatibility notice, and no UI in protected pages');
  }
  console.log(passed + ' browser checks passed');
} finally {
  if (browser) {
    const cdp = await browser.newBrowserCDPSession().catch(() => null);
    await cdp?.send('Browser.close').catch(() => {});
  }
  child.kill();
  await exited.catch(() => {});
  await rm(profile, { recursive: true, force: true });
  server.close();
}
