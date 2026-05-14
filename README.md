<div align="center">

<img src="icons/icon128.png" width="80" alt="Context Explain">

# ✦ Context Explain

**AI-powered contextual explanations, right where you read.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/luzion89/context-explain/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/luzion89/context-explain/releases)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)

English · [中文](README_ZH.md) · [Download](https://github.com/luzion89/context-explain/releases/latest)

---

![Context Explain Demo](assets/demo.gif)

</div>

---

## ✦ What is Context Explain?

Highlight **any word, phrase, or passage** on any webpage. Three small buttons appear. Click to get an instant AI explanation that understands exactly where you are — the sentences before and after, the topic of the page, the register of the text.

Right-click any **image** to ask the AI what it shows, or pose a specific question about it.

No copy-paste. No new tabs. No context lost.

---

## 🆕 What's new in v2.0.0

| # | Feature | Summary |
|---|---|---|
| 1 | 🖼️ **Vision / Image Analysis** | Right-click any image → explain or ask about it using a separate Vision API |
| 2 | ⇌ **Translate mode** | Third button on text selection — translates + explains context in 1–2 sentences |
| 3 | ↔️ **Resizable panel** | Drag any of 5 edges/corners to resize; size remembered across sessions |
| 4 | 📌 **Pin panel** | Keep the panel open while clicking elsewhere on the page |
| 5 | ↻ **Retry button** | Re-run the last query if the stream fails or gives an unsatisfying answer |
| 6 | 🔍 **History search & images** | Full-text search across all entries; image entries show a thumbnail |
| 7 | ⚙️ **Unified AI Settings** | Text API and Vision API in tabbed sub-panels; inline ✓ test-connection button |
| 8 | 🌐 **UI localization** | Settings interface language follows your Response Language setting |
| 9 | 📊 **Markdown table borders** | Properly rendered table borders in panel and history detail view |
| 10 | 🎨 **Theme & polish** | Separate Translation Target Language; dark-mode WCAG contrast; Enter submits follow-up |

---

## 🎯 Why it's different

### Context-aware, not dictionary-aware

Most lookup tools treat every word in isolation. Context Explain captures the surrounding passage and sends it to the AI alongside your selection. "Transformer" on a machine learning paper gets an architecture explanation. "Transformer" on an electrical engineering page gets something entirely different.

### Three modes for three intents

| Mode | Icon | When to use |
|---|---|---|
| **Explain** | ✦ | AI explains the selection in context immediately |
| **Ask** | ？ | Type your own question about the selected passage |
| **Translate** | ⇌ | Translate + a brief contextual note in 1–2 sentences |

**Explain mode** is for when you encounter something unfamiliar — a term, concept, acronym, or passage you don't fully understand.

**Ask mode** is for specific follow-ups: *"Is this argument logically sound?"*, *"What are the counterarguments?"*, *"How does this compare to X?"*

**Translate mode** not only translates into your configured target language, but also adds a short note explaining any cultural or contextual nuance the translation alone might miss.

### Vision / Image Analysis

Right-click any image on any page. The context menu offers:
- **◆ Explain this image** — AI describes and explains what the image shows
- **？ Ask about this image** — type a specific question about the image

Vision uses a **separate API configuration** (endpoint, key, model) — so you can use a vision-capable model (e.g. GPT-4o, Claude 3, OpenRouter) for images while keeping a fast text model for selections.

### It keeps talking

After every response, a follow-up input appears at the bottom of the panel. Press **Enter** to submit, **Ctrl+Enter** for a newline. The full conversation is maintained — ask for examples, go deeper, request a simpler explanation.

### Resizable & pinnable panel

Drag any of **5 resize handles** (bottom-left corner, bottom-right corner, left edge, right edge, bottom edge) to resize the panel exactly as needed. Your size **and** position are both saved across sessions.

**📌 Pin the panel** to keep it open while you scroll, click links, or read other parts of the page. Useful for side-by-side reference.

### Renders everything the AI returns

- **Markdown** — headings, bold/italic, tables (with borders), ordered/unordered lists, blockquotes, inline code, fenced code blocks (powered by [marked.js](https://marked.github.io/marked/))
- **Math formulas** — LaTeX rendered inline and as display blocks via [KaTeX](https://katex.org/): $3x_1 + 5x_2 \leq 12$
- **Diagrams** — Mermaid flow charts, sequence diagrams, class diagrams, and more, rendered as SVG directly in the panel

### Annotations that stick

Every queried passage receives a persistent **amber underline**. Refresh the page — the underlines come back. Context Explain re-locates each passage using context-matching, so the correct occurrence is always highlighted even when the same phrase appears multiple times.

### Scrollbar minimap

Thin amber tick marks appear on the right edge of the viewport — exactly like Chrome's Ctrl+F highlights — showing the position of every annotated passage in the full document.

### Hover to revisit, instantly

Hover any annotated passage: **✦** reopens the full conversation from cache (no API call, instant), **✕** removes the annotation and deletes the history entry.

### Works everywhere, including with Immersive Translate

Context Explain coexists with [Immersive Translate](https://immersivetranslate.com/) and other page-modifying extensions. Selection detection uses both `mouseup` and `selectionchange` events, with synchronous Range capture before any DOM mutation can invalidate it.

### API calls in the content script — no dropped streams

v2 uses a minimal service worker solely for registering the right-click context menu (a Chrome MV3 requirement). All AI API calls are made directly from the content script — which lives as long as the tab — so streams never drop mid-response due to the 30-second service worker idle timeout.

---

## ✨ Feature overview

| | |
|---|---|
| 🤖 **AI Providers** | OpenAI · Anthropic Claude · DeepSeek · any OpenAI-compatible API |
| 🖼️ **Vision** | Image explanation & Q&A via separate Vision API config |
| ⇌ **Translate mode** | Translate + brief context note; configurable target language |
| 💬 **Multi-turn** | Full conversation history, unlimited follow-ups |
| 📐 **Math rendering** | KaTeX — inline and display LaTeX |
| 🔀 **Diagrams** | Mermaid — flow charts, sequence diagrams, class diagrams, Gantt, and more |
| 📝 **Markdown** | Full GFM via marked.js — tables with borders, task lists, code blocks |
| 🖊️ **Annotations** | Persistent amber underlines, restored after page reload |
| 🗺️ **Scrollbar markers** | Viewport minimap of all annotated positions |
| 🪟 **Panel** | Draggable, resizable (5 handles), pinnable — position & size saved |
| 📌 **Pin** | Keep panel open while interacting with the page |
| ↻ **Retry** | Re-run last query on failure or dissatisfaction |
| 📚 **History** | Full-text search · Export JSON · Delete individual entries · Image thumbnails |
| ⚡ **Streaming** | RAF-throttled render, Markdown on completion only |
| 💾 **Storage** | `chrome.storage.local` + `unlimitedStorage`, up to 2000 entries |
| 🌐 **UI Localization** | Settings UI in EN / 简体中文 / 日本語 / 한국어 |
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

Click the **✦** toolbar icon to open settings. Settings are organized into tabs:

### Text API

| Field | Notes |
|---|---|
| **Provider** | OpenAI / Anthropic / DeepSeek / Custom |
| **API Key** | Your key from the provider's dashboard |
| **Model** | Leave blank for default, or type any model name — use **✓** to test the connection inline |
| **Base URL** | Only for custom OpenAI-compatible endpoints |
| **Response Language** | Auto (matches selected text) or force a language |
| **Translation Target Language** | Language used in Translate ⇌ mode |

### Vision API

| Field | Notes |
|---|---|
| **Vision Endpoint** | Any OpenAI-compatible vision endpoint (e.g. `https://api.openai.com/v1`) |
| **Vision API Key** | Key for the vision endpoint |
| **Vision Model** | e.g. `gpt-4o`, `claude-3-5-sonnet`, or an OpenRouter model — use **✓** to test |

### Recommended models

| Use case | Provider | Model |
|---|---|---|
| Fast everyday lookups | OpenAI | `gpt-4o-mini` |
| Richer explanations | Anthropic | `claude-3-5-sonnet-20241022` |
| Cost-effective | DeepSeek | `deepseek-chat` |
| Image analysis | OpenAI | `gpt-4o` |
| Image via OpenRouter | OpenRouter | `google/gemini-flash-1.5` |

---

## 📖 How to use

### Text selection

```
1. Select any text on any webpage — a single character, a term, or a full paragraph
   ↓
2. Three buttons appear at the end of the selection
   ✦  →  Explain mode: AI explains immediately
   ？  →  Ask mode: type your own question
   ⇌  →  Translate mode: translation + brief contextual note
   ↓
3. Response streams in the floating panel
   Math, diagrams, and tables render automatically
   ↓
4. Follow-up input appears when done — press Enter to submit, Ctrl+Enter for newline
   ↓
5. Close the panel — amber underline stays on the text
   ↓
6. Hover the underline anytime to reopen the full conversation instantly
```

### Image analysis

```
1. Right-click any image on any webpage
   ↓
2. Choose from the context menu:
   ◆ Explain this image  →  AI describes and explains the image
   ？ Ask about this image  →  type a specific question about the image
   ↓
3. Response streams in the floating panel — same panel, same follow-up flow
```

### Panel controls

| Control | Action |
|---|---|
| **Drag title bar** | Move the panel |
| **Drag edge/corner handles** | Resize the panel (5 handles: SW, SE, left, right, bottom) |
| **📌 Pin button** | Keep panel open when clicking elsewhere |
| **↻ Retry button** | Re-run the last query |
| **✕ Close** | Close the panel (annotation stays) |

---

## 🔒 Privacy

- Selected text, surrounding context, and images are sent **only** to the API providers you configure
- This extension does **not** communicate with any server other than your chosen AI provider(s)
- All history is stored **locally** in your browser via `chrome.storage.local`
- No analytics · No telemetry · No accounts · No data collection

---

## 🙏 Inspired by

[Select2Explain](https://github.com/luzion89/Select2Explain) — the original concept of bringing context-aware AI explanations directly onto the reading surface.

---

<div align="center">

**If this is useful to you, please consider giving it a ⭐**

</div>
