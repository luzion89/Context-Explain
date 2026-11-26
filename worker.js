import './background.js';
import { registerSiwcBackground } from './siwc/background.js';

registerSiwcBackground({
  appName: chrome.runtime.getManifest().name,
  pages: ['popup.html'],
  async allowTabStream(sender) {
    if (sender?.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) ||
        !/^(https?:|file:|about:|blob:)/.test(sender.url || '')) return false;
    const { apiProvider } = await chrome.storage.sync.get('apiProvider');
    return apiProvider === 'openai-siwc';
  },
});
