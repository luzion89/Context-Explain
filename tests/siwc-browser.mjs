// Run with PLAYWRIGHT_CORE set to the installed playwright-core module.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const tmp = await mkdtemp(join(tmpdir(), 'ctx-siwc-'));
const extension = join(tmp, 'extension');
const requests = [];
const server = createServer(async (req, res) => {
  if (req.url === '/v1/models') {
    assert.equal(req.headers.authorization, 'Bearer fixture-token');
    return res.end(JSON.stringify({ models: [{ visibility: 'list', slug: 'fixture-model' }] }));
  }
  if (req.url === '/v1/responses') {
    assert.equal(req.headers.authorization, 'Bearer fixture-token');
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {"type":"response.output_text.delta","delta":"Fixture "}\n\n');
    await delay(100);
    return res.end('data: {"type":"response.output_text.delta","delta":"answer"}\n\ndata: {"type":"response.completed"}\n\n');
  }
  if (req.url === '/authorize') return res.end('<title>Fixture authorization</title>');
  res.setHeader('Content-Type', 'text/html');
  res.end('<p id="quote">A fixture passage for Context Explain.</p>');
});
async function until(check, description) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  assert.fail('Timed out waiting for ' + description);
}
let chrome;
let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const root = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const files = ['manifest.json', 'background.js', manifest.background.service_worker,
    ...manifest.content_scripts[0].js.filter(path => !path.startsWith('lib/')),
    'popup.html', 'popup.js', 'mermaid-sandbox.html', 'icons', 'lib', 'siwc'];
  for (const path of files) await cp(new URL(path, root), join(extension, path), { recursive: true });
  const provider = join(extension, 'siwc/provider.js');
  await writeFile(provider, (await readFile(provider, 'utf8'))
    .replace('https://api.openai.com/v1', origin + '/v1')
    .replace('https://auth.openai.com/api/accounts/authorize', origin + '/authorize'));

  const profile = join(tmp, 'profile');
  chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-first-run', '--enable-unsafe-extension-debugging',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    port = (await readFile(portFile, 'utf8').catch(() => '')).split('\n')[0];
    if (!port) await delay(100);
  }
  assert.ok(port, 'Chrome launched');
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
  const cdp = await browser.newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
  const context = browser.contexts()[0];
  context.setDefaultTimeout(7000);
  const settings = await context.newPage();
  const errors = [];
  settings.on('pageerror', error => errors.push(error.message));
  const settingsUrl = 'chrome-extension://' + id + '/popup.html';
  await settings.goto(settingsUrl);
  await settings.evaluate(() => chrome.storage.sync.set({ apiKey: 'old-key', apiModel: 'old-model' }));
  await settings.reload();
  await settings.locator('#provider').selectOption('openai-siwc');
  assert.equal(await settings.locator('#siwc-username').isDisabled(), true);
  assert.equal(await settings.locator('#apiKey').isVisible(), false);
  assert.equal(await settings.locator('label[for=siwc-username]').textContent(), 'Username');
  const authorizationTab = context.waitForEvent('page');
  await settings.locator('#toggleKey').click();
  const auth = await authorizationTab;
  await auth.waitForURL(origin + '/authorize?*');
  assert.equal(new URL(auth.url()).searchParams.get('agent_name_hint'), 'Context Explain');
  await auth.close();

  // Seed the SDK store with a synthetic account so no real OAuth credentials or quota are used.
  await settings.evaluate(async () => {
    const { saveProfiles } = await import(chrome.runtime.getURL('siwc/store.js'));
    await saveProfiles({ activeProfileId: 'fixture', profiles: [{ id: 'fixture', status: 'connected',
      identity: { name: 'Fixture User' }, session: { accessToken: 'fixture-token', expiresAt: Date.now() + 3600000 }
    }] });
  });
  await settings.reload();
  await settings.locator('#provider').selectOption('openai-siwc');
  await settings.waitForFunction(() => document.querySelector('#siwc-username').value === 'Fixture User');
  await settings.locator('#fetch-text-models').click();
  await settings.locator('#text-model-list option[value=fixture-model]').waitFor({ state: 'attached' });
  await settings.locator('#test-text-api').click();
  await settings.waitForFunction(() => document.querySelector('#test-text-result').textContent === 'Connected');
  await settings.locator('#saveBtn').click();
  await until(() => settings.evaluate(async () => (await chrome.storage.sync.get('apiProvider')).apiProvider === 'openai-siwc'), 'saved provider');

  const page = await context.newPage();
  await page.goto(origin);
  await page.locator('#quote').evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.locator('#ctx-explain-trigger button').first().click();
  await page.locator('#ctx-explain-root .response-block').getByText('Fixture answer').waitFor();
  const history = () => settings.evaluate(async () => (await chrome.storage.local.get('ctxHistory')).ctxHistory || []);
  await until(async () => (await history())[0]?.explanation === 'Fixture answer', 'saved explanation');
  const input = page.locator('#ctx-explain-root .followup-input');
  await input.fill('Please elaborate');
  await page.locator('#ctx-explain-root .followup-send').click();
  await until(async () => (await history())[0]?.followUps[0]?.q === 'Please elaborate', 'saved follow-up');
  assert.deepEqual(requests.map(({ model, store }) => [model, store]), [['fixture-model', false], ['fixture-model', false]]);
  assert.deepEqual(requests[1].input.map(message => message.role), ['user', 'assistant', 'user']);
  assert.equal(requests[1].input.at(-1).content, 'Please elaborate');
  await settings.locator('#provider').selectOption('openai');
  assert.equal(await settings.locator('#apiKey').inputValue(), 'old-key');
  assert.equal(await settings.locator('#apiModel').inputValue(), 'old-model');
  assert.deepEqual(errors, []);
  console.log('SIWC Chrome integration passed: authorization launch, account display, models, streaming, follow-up, history and BYOK.');
} finally {
  await browser?.close();
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    const exit = once(chrome, 'exit');
    chrome.kill();
    await exit;
  }
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
