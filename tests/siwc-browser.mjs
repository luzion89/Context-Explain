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
    return res.end(JSON.stringify({ models: ['fixture-model', 'fixture-model-2', 'fixture-model-10'].map(slug => ({ visibility: 'list', slug })) }));
  }
  if (req.url === '/v1/responses') {
    assert.equal(req.headers.authorization, 'Bearer fixture-token');
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    requests.push(payload);
    if (payload.model !== 'fixture-model') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'Unknown fixture model' } }));
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: {"type":"response.output_text.delta","delta":"Fixture "}\n\n');
    await delay(100);
    return res.end('data: {"type":"response.output_text.delta","delta":"answer"}\n\ndata: {"type":"response.completed"}\n\n');
  }
  if (req.url === '/revoke') return res.end('{}');
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
  const sdkWorker = join(extension, 'siwc/background.js');
  const callbackCase = 'case "callback": return serialize(() => complete(message.query, sender.tab?.id));';
  const workerSource = await readFile(sdkWorker, 'utf8');
  assert.ok(workerSource.includes(callbackCase));
  await writeFile(sdkWorker, workerSource.replace(callbackCase, `case "callback": {
    const fixture = new URLSearchParams(message.query).get("fixture");
    if (fixture === "full") return { sharing: true };
    if (fixture === "identity") return { sharing: false };
    throw new SiwcError("invalid_callback", "模拟授权失败");
  }`));
  const provider = join(extension, 'siwc/provider.js');
  await writeFile(provider, (await readFile(provider, 'utf8'))
    .replace('https://api.openai.com/v1', origin + '/v1')
    .replace('https://auth.openai.com/api/accounts/authorize', origin + '/authorize')
    .replace('https://auth.openai.com/api/accounts/oauth/revoke', origin + '/revoke'));

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
  const callback = await context.newPage();
  const callbackURL = 'chrome-extension://' + id + '/siwc/callback.html';
  for (const [language, fixture, expectedLang, expectedText] of [
    ['Chinese (Simplified)', 'full', 'zh-CN', 'ChatGPT 连接成功，授权成功。'],
    ['English', 'full', 'en', 'ChatGPT connected. Authorization successful.'],
    ['Japanese', 'identity', 'en', 'Signed in to ChatGPT. Plan usage access has not been granted.'],
    ['Korean', 'failure', 'en', 'ChatGPT authorization could not be completed.'],
    ['auto', 'full', 'en', 'ChatGPT connected. Authorization successful.'],
  ]) {
    await settings.goto('chrome-extension://' + id + '/popup.html');
    await settings.evaluate(responseLang => chrome.storage.sync.set({ responseLang }), language);
    await callback.goto(callbackURL + '?fixture=' + fixture);
    await callback.locator('#status[data-result]').waitFor();
    assert.equal(await callback.locator('html').getAttribute('lang'), expectedLang);
    assert.ok((await callback.locator('#status').textContent()).startsWith(expectedText));
    assert.equal(new URL(callback.url()).search, '');
  }
  await callback.close();

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
  assert.equal(await settings.locator('#toggleKey').isVisible(), false);
  await settings.locator('[data-ai-tab=vision]').click();
  assert.ok(await settings.locator('#vision-use-text-config').isDisabled());
  const helpBox = await settings.locator('#vision-reuse-help').boundingBox();
  const labelBox = await settings.locator('label:has(#vision-use-text-config) span').boundingBox();
  assert.ok(Math.abs(helpBox.y + helpBox.height / 2 - labelBox.y - labelBox.height / 2) <= 1);
  await settings.locator('#vision-reuse-help').hover();
  await settings.getByRole('tooltip').filter({ hasText: 'Configure a separate Vision API' }).waitFor();
  await settings.locator('[data-ai-tab=text]').click();

  assert.equal(await settings.locator('.model-label-row:has(label[for=siwc-username]) #siwc-authorize').isVisible(), true);
  const username = await settings.locator('#siwc-username').boundingBox();
  const model = await settings.locator('#apiModel').boundingBox();
  assert.equal(username.width, model.width);
  await settings.locator('#siwc-authorize').click();
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
  assert.deepEqual(await settings.locator('#text-model-list option').evaluateAll(options => options.map(option => option.value)),
    ['fixture-model-10', 'fixture-model-2', 'fixture-model']);

  await settings.locator('#apiModel').fill('unknown-fixture');
  await settings.locator('#test-text-api').click();
  await settings.locator('#test-text-result.error').waitFor({ state: 'visible' });
  await settings.locator('#apiModel').fill('fixture');
  await settings.getByRole('option', { name: 'fixture-model', exact: true }).click();
  await settings.locator('#test-text-api').click();
  await settings.locator('#test-text-result.success').waitFor({ state: 'visible' });
  assert.match(await settings.locator('#test-text-result').textContent(), /Connected — \d+ ms/);
  assert.equal(requests.length, 2);
  assert.equal(requests.at(-1).input[0].content, 'Reply with one word: OK.');
  requests.length = 0;
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
  const remove = settings.locator('.key-wrapper #siwc-disconnect');
  assert.equal(await remove.textContent(), '×');
  await remove.click();
  await remove.waitFor({ state: 'hidden' });
  await settings.waitForFunction(() => document.querySelector('#siwc-username').value === 'Not connected');
  await settings.locator('#provider').selectOption('openai');
  assert.equal(await settings.locator('#apiKey').inputValue(), 'old-key');
  assert.equal(await settings.locator('#apiModel').inputValue(), 'old-model');
  await settings.locator('[data-ai-tab=vision]').click();
  assert.ok(await settings.locator('#vision-use-text-config').isEnabled());
  assert.equal(await settings.locator('#vision-reuse-help').isVisible(), false);

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
