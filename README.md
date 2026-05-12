<div align="center">

<img src="icons/icon128.png" width="80" alt="Context Explain">

# ✦ Context Explain

**AI-powered contextual explanations, right where you read.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/luzion89/context-explain/releases)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)

English · [中文](README_ZH.md) · [Download](https://github.com/luzion89/context-explain/releases/latest)

---

![Context Explain Demo](assets/demo.gif)

</div>

---

## ✦ What is Context Explain?

Highlight **any word, phrase, or passage** on any webpage. Two small buttons appear. Click to get an instant AI explanation that understands exactly where you are — the sentences before and after, the topic of the page, the register of the text.

No copy-paste. No new tabs. No context lost.

---

## 🎯 Why it's different

### Context-aware, not dictionary-aware

Most lookup tools treat every word in isolation. Context Explain captures the surrounding passage and sends it to the AI alongside your selection. "Transformer" on a machine learning paper gets an architecture explanation. "Transformer" on an electrical engineering page gets something entirely different.

### Two modes for two intents

| Mode | Icon | When to use |
|---|---|---|
| **Explain** | ✦ | You want the AI to explain the selection for you |
| **Ask** | ? | You want to ask your own question about the selected passage |

**Explain mode** is for when you encounter something unfamiliar — a term, concept, acronym, or passage you don't fully understand. Select it and click ✦. The AI immediately explains it in context, without you needing to formulate a question.

**Ask mode** is for when you already understand what the text says, but have a specific follow-up in mind — for example: *"Is this argument logically sound?"*, *"What are the counterarguments to this?"*, *"Can you give a real-world example of this?"*, or *"How does this compare to X?"* Select the relevant passage, click **?**, and type exactly what you want to know.

### It keeps talking

After every response, a follow-up input appears at the bottom of the panel. The full conversation is maintained — ask for examples, go deeper, request a simpler explanation. The AI never loses track.

### Annotations that stick

Every queried passage receives a persistent **amber underline**. Refresh the page — the underlines come back. Context Explain re-locates each passage using context-matching, not just the word itself, so the correct occurrence is always highlighted even when the same phrase appears multiple times.

### Scrollbar minimap

Thin amber tick marks appear on the right edge of the viewport — exactly like Chrome's Ctrl+F highlights — showing the position of every annotated passage in the full document. Scan an entire article's annotation density at a glance.

### Hover to revisit, instantly

Hover any annotated passage: **✦** reopens the full conversation from cache (no API call, instant), **✕** removes the annotation and deletes the history entry.

### No service worker — no dropped connections

Chrome MV3 extensions route background requests through a service worker that Chrome terminates after 30 seconds of inactivity. Context Explain makes all API calls directly from the content script — which lives as long as the tab — so streams never drop mid-response.

### Streaming that doesn't freeze the page

During streaming, new chunks are appended as plain `textContent` — zero regex, zero HTML parsing per chunk. Full Markdown renders exactly once when the stream completes. The page stays responsive at all times, even on very long responses.

---

## ✨ Feature overview

| | |
|---|---|
| 🤖 **AI Providers** | OpenAI · Anthropic Claude · DeepSeek · any OpenAI-compatible API |
| 💬 **Multi-turn** | Full conversation history, unlimited follow-ups |
| 🖊️ **Annotations** | Persistent amber underlines, restored after page reload |
| 🗺️ **Scrollbar markers** | Viewport minimap of all annotated positions |
| 🪟 **Draggable panel** | Freely repositionable, remembers position per context |
| 📚 **History** | Search · Export JSON · Delete individual entries |
| ⚡ **Streaming** | RAF-throttled render, Markdown on completion only |
| 💾 **Storage** | `chrome.storage.local` + `unlimitedStorage`, up to 2000 entries |
| 🔒 **Privacy** | All data stays local or goes to your own API — no third-party servers |

---

## 🚀 Installation

### Option 1 — Download the latest release (recommended)

1. Go to [**Releases**](https://github.com/luzion89/context-explain/releases/latest)
2. Download `context-explain-v*.zip`
3. Unzip it
4. Open Chrome → `chrome://extensions` → enable **Developer mode**
5. Click **Load unpacked** → select the unzipped `context-explain` folder
6. Click **✦** in your toolbar → enter your API key → **Save**

### Option 2 — Clone and run

```bash
git clone https://github.com/luzion89/context-explain.git
```

Then load the folder via **Load unpacked** as above.

---

## ⚙️ Setup

Click the **✦** toolbar icon to open settings:

| Field | Notes |
|---|---|
| **Provider** | OpenAI / Anthropic / DeepSeek / Custom |
| **API Key** | Your key from the provider's dashboard |
| **Model** | Leave blank to use the default, or specify any model name |
| **Base URL** | Only for custom OpenAI-compatible endpoints |
| **Response Language** | Auto (matches selected text) or force a language |

### Recommended models by use case

| Use case | Provider | Model |
|---|---|---|
| Fast everyday lookups | OpenAI | `gpt-4o-mini` |
| Richer explanations | Anthropic | `claude-3-5-sonnet-20241022` |
| Cost-effective | DeepSeek | `deepseek-chat` |

---

## 📖 How to use

```
1. Select any text on any webpage (3–600 chars)
   ↓
2. Two buttons appear at the end of the selection
   ✦  →  Explain mode: AI explains immediately
   ?  →  Ask mode: type your own question
   ↓
3. Response streams in the floating panel
   ↓
4. Follow-up input appears when done — keep the conversation going
   ↓
5. Close the panel — amber underline stays on the text
   ↓
6. Hover the underline anytime to reopen the explanation instantly
```

---

## 🔒 Privacy

- Selected text and surrounding context are sent **only** to the API provider you configure
- This extension does **not** communicate with any server other than your chosen AI provider
- All history is stored **locally** in your browser via `chrome.storage.local`
- No analytics · No telemetry · No accounts · No data collection

---

## 🙏 Inspired by

[Select2Explain](https://github.com/luzion89/Select2Explain) — the original concept of bringing context-aware AI explanations directly onto the reading surface.

---

<div align="center">

**If this is useful to you, please consider giving it a ⭐**

</div>
