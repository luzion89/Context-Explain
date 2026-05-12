<div align="center">

<img src="icons/icon128.png" width="80" alt="Context Explain">

# ✦ Context Explain

**AI-powered contextual explanations, right where you read.**
**在阅读的地方，获得 AI 的语境化解释。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/luzion89/context-explain/releases)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)

[English](#english) · [中文](#中文) · [Download / 下载](https://github.com/luzion89/context-explain/releases/latest)

---

![Context Explain Demo](assets/demo.gif)

</div>

---

<a name="english"></a>

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
| **Ask** | ? | You already know what it is — you have a specific question |

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

<a name="中文"></a>

## ✦ 这是什么？

在任意网页上**划选任意文字**，旁边出现两个小按钮，点击即可获得 AI 解释——AI 理解你选中内容的上下文：前后的句子、页面的话题、文本的语体。

不需要复制粘贴，不需要开新标签页，上下文不会丢失。

---

## 🎯 有什么不同

### 理解语境，而不只是查字典

大多数查词工具把每个词单独处理。Context Explain 会抓取选中文字周围的段落，连同你的选择一起发给 AI。在机器学习论文里查 "Transformer"，得到的是架构解释；在电气工程页面查同一个词，得到的完全不同。

### 两种模式，对应两种意图

| 模式 | 图标 | 适合场景 |
|---|---|---|
| **解释模式** | ✦ | 让 AI 主动解释选中内容 |
| **提问模式** | ? | 你已经知道是什么，但有具体问题想问 |

### 对话可以持续

每次回答结束后，面板底部出现追问输入框。完整的对话历史会随每次追问一起发送——要例子、深入展开、换个更简单的说法……AI 不会失去上下文。

### 划线标注会保留

每个查询过的文字段落，都会获得一条持久的**琥珀色下划线**。刷新页面后，下划线会自动恢复——通过上下文匹配，而不只是词语匹配，所以同一个词在页面不同位置出现时也能精确定位到正确的那个。

### 滚动条小地图

视口右侧出现琥珀色细横条，就像 Chrome 的 Ctrl+F 搜索高亮一样，标记每条注释在整个页面中的位置。一眼扫完全文的阅读痕迹。

### Hover 即可复看，瞬间加载

鼠标悬停任意已标注的文字：**✦** 从缓存直接恢复完整对话（不调用 API，即时加载），**✕** 移除标注并从历史记录中删除。

### 不用 Service Worker，不会断流

Chrome MV3 扩展通常把网络请求路由到 Service Worker，而 Chrome 会在无活动 30 秒后将其终止，导致流式输出中途断掉。Context Explain 把所有 API 调用移到 Content Script 直接发起——Content Script 和页面标签页共存亡，不会被 Chrome 提前终止。

### 流式输出不卡页面

流式阶段每个 chunk 只做 `textContent` 追加——零正则、零 HTML 解析——并通过 `requestAnimationFrame` 节流，合并多个 chunk 到一帧。完整 Markdown 只在流式结束后渲染一次。无论回答多长，页面始终完全响应。

---

## ✨ 功能一览

| | |
|---|---|
| 🤖 **支持的 AI 服务商** | OpenAI · Anthropic Claude · DeepSeek · 任意 OpenAI 兼容 API |
| 💬 **多轮对话** | 完整历史，无限追问 |
| 🖊️ **页面标注** | 琥珀色下划线，刷新后自动恢复 |
| 🗺️ **滚动条标记** | 全页面标注位置小地图 |
| 🪟 **可拖动面板** | 自由移动，按上下文记忆位置 |
| 📚 **查询历史** | 搜索 · 导出 JSON · 单条删除 |
| ⚡ **流式输出** | RAF 节流渲染，Markdown 一次性渲染 |
| 💾 **本地存储** | `chrome.storage.local` + `unlimitedStorage`，最多 2000 条 |
| 🔒 **隐私** | 所有数据本地存储或直发你自己的 API，无第三方服务器 |

---

## 🚀 安装

### 方式一：下载 Release（推荐）

1. 前往 [**Releases 页面**](https://github.com/luzion89/context-explain/releases/latest)
2. 下载 `context-explain-v*.zip`
3. 解压
4. 打开 Chrome → `chrome://extensions` → 开启右上角**开发者模式**
5. 点击**加载已解压的扩展程序** → 选择解压出来的 `context-explain` 文件夹
6. 点击工具栏 **✦** 图标 → 填入 API Key → **保存设置**

### 方式二：克隆源码

```bash
git clone https://github.com/luzion89/context-explain.git
```

然后按上述步骤加载文件夹。

---

## ⚙️ 配置

点击工具栏 **✦** 图标打开设置：

| 字段 | 说明 |
|---|---|
| **Provider（服务商）** | OpenAI / Anthropic / DeepSeek / 自定义 |
| **API Key** | 在对应服务商控制台获取 |
| **Model（模型）** | 留空使用默认值，或填写任意模型名称 |
| **Base URL** | 仅自定义 OpenAI 兼容端点需要填写 |
| **Response Language（回复语言）** | 自动（匹配选中文字语言）或强制指定语言 |

---

## 📖 使用方法

```
1. 在任意网页上划选文字（3–600 字符）
   ↓
2. 选中文字末尾出现两个按钮
   ✦  →  解释模式：AI 立即开始解释
   ?  →  提问模式：打开输入框，直接提问
   ↓
3. 回答在浮动面板中流式显示
   ↓
4. 输出完成后，追问输入框出现，继续对话
   ↓
5. 关闭面板——文字上的琥珀色下划线保留
   ↓
6. 随时 hover 下划线，瞬间重新加载历史对话
```

---

## 🔒 隐私说明

- 选中的文字和上下文**只发送**给你自己配置的 AI 服务商
- 本扩展**不与任何其他服务器通信**
- 所有历史记录通过 `chrome.storage.local` **存储在本地浏览器**
- 无数据收集 · 无追踪分析 · 无账户系统

---

## 🙏 灵感来源

[Select2Explain](https://github.com/luzion89/Select2Explain) —— 直接在阅读界面提供语境化 AI 解释的原始概念。

---

<div align="center">

**If this is useful to you, please consider giving it a ⭐**

**如果这个项目对你有帮助，欢迎点个 ⭐**

</div>
