# ✦ Context Explain

> Highlight any text on any webpage. Get an instant AI explanation — with full surrounding context.

![Context Explain Demo](assets/demo.gif)

---

## What is this?

Context Explain is a Chrome extension that lets you select any word, phrase, or passage on any webpage and immediately get an AI-powered explanation of what it means **in that specific context**.

Unlike looking something up in a dictionary or copy-pasting into ChatGPT, Context Explain understands where the term appears — the sentences before and after it — so the explanation is always relevant, never generic.

---

## Why it's different

### 1. Context-aware explanations, not dictionary lookups

Most tools explain a term in isolation. Context Explain captures ~400 characters of surrounding text and passes it to the AI alongside your selection. Ask about "transformer" on an ML paper and you get an architecture explanation. Ask the same word on a blog post about electric vehicles and you get something entirely different.

### 2. Two interaction modes

**Explain mode (✦)** — One click, the AI immediately explains what you selected.

**Ask mode (?)** — Skip the explanation. The panel opens with an input field so you can ask your own question directly about the selected text and its context. Useful when you already understand the term but want to dig deeper.

### 3. Conversation continues

After the initial explanation, a follow-up input appears at the bottom of the panel. Ask clarifying questions, request examples, go deeper — the full conversation history is sent to the AI so it never loses context.

### 4. Persistent page annotations

Every queried passage gets a subtle **amber underline** on the page. These annotations survive page refreshes — Context Explain re-locates the exact passage using context-matching on page load, not just the word itself, so the right occurrence is always highlighted even when the same phrase appears multiple times.

### 5. Scrollbar position markers

Thin amber tick marks appear on the right edge of the screen at the position of every annotated passage — similar to how Chrome shows Ctrl+F matches. Scan an entire article's annotation density at a glance.

### 6. Hover to revisit

Hover over any annotated passage and two icon buttons appear: **✦** to reopen the full conversation history, and **✕** to remove the annotation and delete it from history.

### 7. Zero latency after first query

Reopening a previously queried passage loads instantly from local cache — no API call, no spinner. The complete conversation including all follow-ups is restored immediately.

### 8. Draggable panel, position memory

The explanation panel is draggable. For passages you revisit, the panel reappears in the same position where you last closed it — it remembers per context key, not just per word.

### 9. No service worker — no reliability issues

Chrome MV3 extensions typically route background requests through a service worker that Chrome kills after 30 seconds of inactivity. Context Explain moves all API communication directly into the content script, which lives as long as the tab does. No dropped connections, no mid-stream failures.

### 10. Streaming with zero render cost

Streaming responses render with `requestAnimationFrame` throttling and plain `textContent` appends during streaming — no regex, no HTML parsing per chunk. Full Markdown is rendered exactly once when the stream completes. The page stays fully responsive at all times.

### 11. Full conversation history

Every query is saved to `chrome.storage.local` (with `unlimitedStorage` permission — no size cap). The popup's History tab lets you search, review, and export everything. Individual entries can be deleted from the list or directly from the annotation on the page.

---

## Features at a glance

| Feature | Details |
|---|---|
| **AI Providers** | OpenAI, Anthropic (Claude), DeepSeek, any OpenAI-compatible API |
| **Modes** | Explain / Ask |
| **Multi-turn** | Full conversation history sent on every follow-up |
| **Annotations** | Persistent amber underlines, restored on page reload |
| **Scrollbar markers** | Amber ticks showing annotation positions |
| **Panel** | Draggable, position-memorized per context |
| **History** | Search, export JSON, delete individual entries |
| **Streaming** | RAF-throttled, Markdown rendered once on completion |
| **Storage** | `chrome.storage.local` + `unlimitedStorage`, up to 2000 entries |

---

## Installation

### From source (developer mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `context-explain` folder
5. Click the **✦** icon in your toolbar
6. Enter your API key and choose a provider → **Save Settings**

### Supported providers

| Provider | Default model | Where to get a key |
|---|---|---|
| OpenAI | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com) |
| Anthropic | `claude-3-5-haiku-20241022` | [console.anthropic.com](https://console.anthropic.com) |
| DeepSeek | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com) |
| Custom | any | your own endpoint |

---

## How to use

1. **Select any text** on any webpage (3–600 characters)
2. Two small buttons appear at the end of your selection:
   - **✦** — Explain mode: AI immediately explains in context
   - **?** — Ask mode: type your own question about the selection
3. The panel streams the response in real time
4. When done, a follow-up input appears — keep the conversation going
5. Close the panel — the amber underline stays on the text
6. **Hover the underline** to reopen the explanation instantly

---

## Privacy

- Your text and surrounding context are sent to whichever AI API you configure
- Nothing is sent to any third-party server by this extension
- All history is stored locally in your browser via `chrome.storage.local`
- No analytics, no telemetry, no accounts

---

## Inspired by

[Select2Explain](https://github.com/luzion89/Select2Explain) — the original idea of context-aware AI explanations directly on the page.

---

## License

MIT
