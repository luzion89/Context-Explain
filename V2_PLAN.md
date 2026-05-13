# Context Explain — v2 开发计划

> 生成日期：2026-05-13  
> 当前版本：v1.0.0  
> 目标版本：v2.0.0

---

## 项目现状摘要

| 维度 | 现状 |
|------|------|
| 架构 | Content Script（主逻辑）+ Popup（Settings/History）+ Service Worker（最简） |
| 流式渲染 | RAF 限帧，plain text 流式，完成后统一 Markdown 渲染 |
| Storage | `chrome.storage.sync`（设置）+ `chrome.storage.local`（历史，上限 2000 条） |
| UI 隔离 | Shadow DOM（content panel）+ 固定 380×520px |
| 主题 | 硬编码深色：`#080810` 背景，`#e8a030` 强调色，`#d4d0c8` 文字 |
| API 支持 | OpenAI / Anthropic / DeepSeek / Custom（OpenAI 兼容） |
| 交互模式 | Explain + Ask（文本选择触发） |
| 无 | 主题系统、图片识别、右键菜单、键盘隔离、resize handle、pin 功能、翻译功能 |

---

## 分支策略

```
main                      ← 稳定发布分支，禁止直接开发
  └── release/v2          ← v2 集成分支，每个 feature 完成后合并到此
        ├── feature/v2-theme-system
        ├── feature/v2-contrast-polish
        ├── feature/v2-popup-pin
        ├── feature/v2-popup-resize
        ├── feature/v2-keyboard-isolation
        ├── feature/v2-translate
        ├── feature/v2-image-api-settings
        ├── feature/v2-image-context-menu
        ├── feature/v2-image-popup-qa
        └── feature/v2-api-test
```

---

## Issue 列表与开发顺序

推荐开发顺序基于以下原则：
1. **基础设施先行**：主题系统为所有 UI 的前提
2. **独立功能优先**：键盘隔离、pin、resize 互不依赖
3. **新 API 链路后做**：图片功能依赖 Vision API 配置
4. **翻译复用已有链路**：在文本 API 稳定后实现

| 顺序 | Issue 编号 | 标题 | 分支 |
|------|-----------|------|------|
| 1 | #v2-01 | 主题系统 | `feature/v2-theme-system` |
| 2 | #v2-02 | 文字可读性与对比度优化 | `feature/v2-contrast-polish` |
| 3 | #v2-03 | Popup 键盘事件隔离 | `feature/v2-keyboard-isolation` |
| 4 | #v2-04 | Popup 钉住（Pin）功能 | `feature/v2-popup-pin` |
| 5 | #v2-05 | Popup 拖拽调整大小与位置持久化 | `feature/v2-popup-resize` |
| 6 | #v2-06 | 上下文翻译功能 | `feature/v2-translate` |
| 7 | #v2-07 | 图片识别 Vision API 配置 | `feature/v2-image-api-settings` |
| 8 | #v2-08 | 图片右键菜单 | `feature/v2-image-context-menu` |
| 9 | #v2-09 | 图片解释与问答 Popup | `feature/v2-image-popup-qa` |
| 10 | #v2-10 | API 连接测试功能 | `feature/v2-api-test` |

---

## 详细 Issue 规格

---

### Issue #v2-01：主题系统

**分支名：** `feature/v2-theme-system`

#### 背景

当前 popup.html/popup.js 与 content.js 中的 Shadow DOM 样式全部使用硬编码颜色值（`#080810`、`#e8a030` 等）。用户无法切换主题，也无法跟随系统色彩模式。

#### 功能描述

- 实现 CSS Custom Properties（变量）体系，覆盖所有颜色。
- 支持三种主题模式：`system`（跟随系统）、`light`（浅色）、`dark`（深色）。
- Settings 页面新增"Theme"选项区，三选一。
- 主题选择持久化到 `chrome.storage.sync`（key: `theme`）。
- popup.html 和 content script Shadow DOM 都使用同一套变量名。
- 跟随系统时监听 `window.matchMedia('(prefers-color-scheme: dark)')`，动态切换。
- 设计时考虑未来添加第 4、5 种主题的扩展性（建议 `data-theme` attribute + 独立变量块）。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `popup.html` | 新增 CSS 变量块，`data-theme` 属性；新增主题选择 UI |
| `popup.js` | 读取/保存 `theme` 设置；`applyTheme()` 函数 |
| `content.js` | Shadow DOM 样式中硬编码颜色替换为 CSS 变量；`applyThemeToPanels()` |

#### 依赖关系

- **对当前功能的依赖：** Settings 保存逻辑（`chrome.storage.sync`）
- **对其他 Issue 的依赖：** 无（基础设施，其他 Issue 均依赖此项）
- **其他 Issue 对本 Issue 的依赖：** #v2-02 依赖本项完成的变量体系

#### 对其他功能的潜在影响

- 替换 content.js 中所有硬编码颜色为 CSS 变量时，需确保 Shadow DOM 内变量作用域正确（Shadow DOM 需要在 shadow root 内定义变量或通过 `host` 继承）。
- 不得破坏 Mermaid iframe、KaTeX 渲染样式。

#### 实现建议

```css
/* Light theme */
:host([data-theme="light"]), [data-theme="light"] {
  --bg-base: #f5f4f0;
  --bg-surface: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #555;
  --accent: #b07010;
  --border: rgba(0,0,0,0.1);
  --input-bg: #fafaf8;
  --error: #c0392b;
  --success: #27ae60;
}

/* Dark theme */
:host([data-theme="dark"]), [data-theme="dark"] {
  --bg-base: #080810;
  --bg-surface: #0e0e18;
  --text-primary: #d4d0c8;
  --text-secondary: #8a8680;
  --accent: #e8a030;
  --border: rgba(255,255,255,0.08);
  --input-bg: #0e0e18;
  --error: #d06060;
  --success: #5a9e6f;
}
```

- 在 popup.html `<body>` 上设置 `data-theme`；在 Shadow DOM `:host` 上设置。
- `applyTheme(theme)` 逻辑：若为 `system`，检测 `prefers-color-scheme` 结果，设置对应值；否则直接设置。
- 监听系统主题变化：`matchMedia.addEventListener('change', handler)`。
- Settings 中 Theme 选项建议用 radio group 或 select，存储值为 `'system' | 'light' | 'dark'`。

#### 测试方法

1. 切换主题后，popup 背景/文字颜色立即变化。
2. 重开 popup，主题仍保留。
3. 设置"跟随系统"后，在 macOS 系统偏好中切换外观，popup 和 content panel 随之变化。
4. content script 的 Shadow DOM panel 与 popup 颜色一致。
5. 所有现有功能（Explain/Ask/History）外观正常。

#### 验收条件

- [ ] Settings 页面有可用的主题选择器。
- [ ] popup 和 content panel 都随主题切换。
- [ ] 持久化：重启浏览器/重载扩展后主题不丢失。
- [ ] 跟随系统模式动态响应。
- [ ] 所有 CSS 颜色均通过变量控制，无遗留硬编码值（排除图标/SVG/外部资源）。

#### 潜在风险

- Shadow DOM 内 CSS 变量继承机制：需在 shadow root stylesheet 内定义 `:host` 变量，或在 `shadowRoot.host` 上设置 `data-theme`。
- 多个 content panel 同时存在时，主题需要同步更新（遍历所有 `panelRoot`）。

---

### Issue #v2-02：文字可读性与对比度优化

**分支名：** `feature/v2-contrast-polish`

#### 背景

当前 settings 页面（popup.html）文字与背景对比度不足，尤其是 label、placeholder、hint 文案。深色主题下部分区域视觉层次不清晰。v2 主题系统建立后，需要系统性优化所有交互元素的对比度。

#### 功能描述

- 以 #v2-01 建立的 CSS 变量为基础，补充/调整所有交互元素的颜色 token。
- 覆盖范围：input、textarea、select、button、label、placeholder、error、loading、disabled、hover/focus/active 状态。
- 确保浅色和深色主题下 WCAG AA 对比度（正文 ≥ 4.5:1，大字 ≥ 3:1）。
- popup.html（settings + history）和 content script panel 均适用。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `popup.html` | 调整各元素颜色/对比度 |
| `content.js` | Shadow DOM 内对比度调整 |

#### 依赖关系

- **依赖：** #v2-01（主题系统 CSS 变量已建立）
- **被依赖：** #v2-07 图片 API 配置 UI（复用相同样式规范）

#### 实现建议

新增 token：
```css
--text-hint: ...          /* placeholder, hint 文案 */
--text-disabled: ...      /* disabled 状态文字 */
--btn-primary-bg: ...     /* 主按钮背景 */
--btn-primary-text: ...   /* 主按钮文字 */
--focus-ring: ...         /* 焦点轮廓 */
--input-border-focus: ... /* 输入框聚焦边框 */
```

使用工具（如 colourcontrast.cc）验证每个颜色对。

#### 测试方法

1. 浅色/深色主题下，逐一检查 popup settings 页面所有 UI 元素对比度。
2. 使用 Chrome DevTools Accessibility 面板或 axe 插件检测对比度问题。
3. 检查 disabled 状态、placeholder、error 提示文案可读性。

#### 验收条件

- [ ] 浅色主题下所有文字清晰可读。
- [ ] 深色主题下所有文字清晰可读。
- [ ] 主要正文对比度 ≥ 4.5:1（按 WCAG AA）。
- [ ] input/textarea/button 的 focus 状态有清晰视觉反馈。
- [ ] 不影响 Explain/Ask/History/Markdown 渲染。

#### 潜在风险

- 调整颜色时可能影响已有视觉风格；需保留品牌感（amber 强调色）。

---

### Issue #v2-03：Popup 键盘事件隔离

**分支名：** `feature/v2-keyboard-isolation`

#### 背景

在 GitHub 等网页上，全局键盘事件监听会拦截按键。用户在 content script 注入的 popup 输入框中输入时，例如输入 `t`、`s`、`g` 等，会触发 GitHub 的快捷键（跳转到 Issues、搜索等），严重影响使用体验。

#### 功能描述

- 当焦点位于 popup 内 `input`、`textarea`、`contenteditable` 元素时，阻止 `keydown`、`keypress`、`keyup` 事件传播到宿主页面。
- 使用 `stopPropagation()`；对于已被宿主注册 `capture` 监听的情况，使用 `stopImmediatePropagation()`。
- 不调用 `preventDefault()`（保留正常输入、复制粘贴、输入法组合输入）。
- 例外：允许 `Escape` 键穿透（用于关闭 popup）。
- 只在 Shadow DOM 内的输入元素上生效，不影响宿主页面其他区域。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `content.js` | 在 Shadow DOM 内 input/textarea 上附加键盘事件监听；`setupKeyboardIsolation(shadowRoot)` |

#### 依赖关系

- **依赖：** 无（可独立实现）
- **影响：** #v2-04（pin）、#v2-05（resize）中新增的输入区域需同样适用

#### 实现建议

```javascript
function setupKeyboardIsolation(shadowRoot) {
  const handler = (e) => {
    if (e.key === 'Escape') return; // 允许 Escape 穿透以关闭 panel
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  
  // 在 shadow root 级别捕获，覆盖所有输入元素
  shadowRoot.addEventListener('keydown', handler, true);
  shadowRoot.addEventListener('keypress', handler, true);
  shadowRoot.addEventListener('keyup', handler, true);
}
```

- 使用 capture 模式（第三个参数 `true`）在事件下行阶段拦截，比冒泡更早。
- 在 `createPanel()` / Shadow DOM 初始化时调用 `setupKeyboardIsolation(shadowRoot)`。

#### 测试方法

1. **GitHub 页面**：打开 popup 输入框，输入 `t`、`g`、`s`、`?` 等，确认不触发 GitHub 快捷键。
2. **输入法**：使用中文输入法，确认组合输入正常（不被拦截）。
3. **复制粘贴**：Ctrl/Cmd+C/V/X/A 在 popup 内正常。
4. **方向键/Enter/退格**：在 textarea 内正常工作。
5. **Escape**：按 Escape 能关闭 popup（穿透到关闭逻辑）。
6. **Popup 外**：关闭 popup 后，GitHub 快捷键恢复正常。

#### 验收条件

- [ ] GitHub 页面 popup 输入框中输入不触发 GitHub 快捷键。
- [ ] 复制/粘贴/删除/方向键/Enter 正常。
- [ ] 输入法组合输入正常。
- [ ] Popup 外键盘事件不受影响。
- [ ] Escape 可关闭 popup。

#### 潜在风险

- 某些网站用 `capture` 阶段监听键盘；Shadow DOM 事件从 shadow root 向外传播时，`stopImmediatePropagation` 在 shadow boundary 内有效，但需验证不同浏览器行为。
- 不应影响 follow-up textarea 的正常多行输入。

---

### Issue #v2-04：Popup 钉住（Pin）功能

**分支名：** `feature/v2-popup-pin`

#### 背景

当前 popup 面板点击外部即自动关闭（`mousedown` 事件检测）。对于需要参考 popup 同时操作页面的场景（如复制解释内容、对照原文），自动关闭行为很不便。

#### 功能描述

- Popup header 新增一个"钉住"按钮（📌 图标或 SVG）。
- 默认未钉住：点击 popup 外部，popup 关闭（保持现有行为）。
- 钉住后：点击 popup 外部，popup 不关闭。
- 钉住状态在 header 有视觉反馈（按钮高亮/填充）。
- 以下情况一定关闭 popup（无论是否钉住）：
  - 用户点击 ✕ 关闭按钮。
  - 用户触发新的 Explain/Ask/Translate/图片解释（新 popup 替换旧 popup）。
- Pin 状态不持久化（每次新建 popup 默认未钉住），除非测试后认为持久化更合理。
- 不得在钉住时堆叠多个 popup。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `content.js` | `isPinned` 变量；pin 按钮 HTML；外部点击检测逻辑加 `isPinned` 判断 |

#### 依赖关系

- **依赖：** 无（可独立，建议在 #v2-01 之后以获得正确主题样式）
- **影响：** 所有触发新 panel 的路径都需要检查并强制关闭旧 panel

#### 实现建议

```javascript
let isPinned = false;

// 点击 pin 按钮
pinBtn.addEventListener('click', () => {
  isPinned = !isPinned;
  pinBtn.classList.toggle('active', isPinned);
});

// 外部点击检测（现有逻辑）
document.addEventListener('mousedown', (e) => {
  if (isPinned) return; // 钉住时忽略
  if (!panelEl?.contains(e.target)) closePanel();
}, true);

// 强制关闭（不管是否钉住）
function forceClosePanel() {
  isPinned = false;
  closePanel();
}
// 所有新查询入口都调用 forceClosePanel() 而非 closePanel()
```

#### 测试方法

1. 未钉住：点击 popup 外部，popup 关闭。
2. 钉住后：点击 popup 外部，popup 不关闭。
3. 钉住后：点击 ✕ 关闭按钮，popup 关闭。
4. 钉住后：划线触发新 Explain，旧 popup 消失，新 popup 出现（无堆叠）。
5. Pin 按钮有正确的视觉状态反馈。

#### 验收条件

- [ ] Pin 按钮可用，有活跃/非活跃视觉反馈。
- [ ] 未钉住时外部点击关闭（保持原有行为）。
- [ ] 钉住后外部点击不关闭。
- [ ] 关闭按钮始终有效。
- [ ] 新查询时旧 popup 正确替换。

#### 潜在风险

- 需要梳理 `content.js` 中所有调用 `closePanel()`/`removePanel()` 的路径，确保统一。
- Trigger button 点击时的关闭逻辑需正确处理（先关旧、再开新）。

---

### Issue #v2-05：Popup 拖拽调整大小与位置持久化

**分支名：** `feature/v2-popup-resize`

#### 背景

当前 content script panel 是固定 380px 宽，最大高度 520px，位置按鼠标点击位置计算，不可自定义，关闭后位置丢失。对于需要查看较长解释或长时间使用的用户，缺乏灵活性。

#### 功能描述

- Popup 左下角和右下角显示 resize handle（拖拽图标）。
- 拖拽 handle 可改变 popup 宽度和高度。
- 最小尺寸：`320 × 220` px。
- 最大尺寸：当前 viewport 的 `90%`。
- Popup 支持拖拽 header 移动位置（已有功能，需保留并与 resize 协调）。
- 调整完成后（mouseup），将位置和尺寸保存到 `chrome.storage.local`（key: `panelGeometry`）。
- 下次打开 popup 时读取 `panelGeometry`，恢复尺寸和位置。
- 如果保存的位置超出当前 viewport，自动修正到可见范围内（clamp）。
- 不影响 popup 内容滚动、streaming、错误显示。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `content.js` | 新增 resize handle HTML/CSS；`setupResize()` 函数；`savePanelGeometry()`；`restorePanelGeometry()` |

#### 依赖关系

- **依赖：** 无（可独立；建议在 #v2-01 之后）
- **影响：** 需确认现有 header 拖拽逻辑与 resize 不冲突

#### 实现建议

```javascript
function setupResize(panelEl) {
  const handles = panelEl.querySelectorAll('.ctx-resize-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startW = panelEl.offsetWidth, startH = panelEl.offsetHeight;
      const startLeft = parseInt(panelEl.style.left);
      const isSW = handle.classList.contains('ctx-resize-sw');

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = isSW ? startW - dx : startW + dx;
        let newH = startH + dy;
        newW = Math.max(320, Math.min(newW, window.innerWidth * 0.9));
        newH = Math.max(220, Math.min(newH, window.innerHeight * 0.9));
        panelEl.style.width = newW + 'px';
        panelEl.style.height = newH + 'px';
        if (isSW) panelEl.style.left = (startLeft + dx) + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        savePanelGeometry(panelEl);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}
```

#### 测试方法

1. 拖拽右下角 handle，panel 宽度和高度随鼠标变化。
2. 拖拽左下角 handle，panel 宽度从左侧扩展，高度变化。
3. 尝试拖到最小尺寸以下，panel 不低于 320×220。
4. 关闭 panel 后重新打开，尺寸和位置恢复。
5. 在小窗口浏览器中，保存的大尺寸被自动修正。
6. Panel 内容在不同尺寸下正常滚动显示。
7. 现有 header 拖拽移动功能正常。

#### 验收条件

- [ ] 左下/右下角有可见 resize handle。
- [ ] 拖拽改变 panel 尺寸，有最小/最大约束。
- [ ] 关闭后重开，尺寸/位置恢复。
- [ ] Viewport 超出时自动 clamp。
- [ ] 不影响 streaming、Markdown 渲染、错误信息显示。

#### 潜在风险

- `mousemove`/`mouseup` 监听注册在 `document` 上，需在 `mouseup` 时正确清理。
- 与现有 header 拖拽逻辑共用 `document` 级别事件，需注意不互相干扰。
- Shadow DOM 内的 handle 元素需要穿透到 `document` 级别的 mousemove（因为鼠标可能移出 shadow boundary）。

---

### Issue #v2-06：上下文翻译功能

**分支名：** `feature/v2-translate`

#### 背景

当前用户划线后只有 Explain 和 Ask 两个入口。对于只需要快速翻译的场景，Explain 过于冗长，缺乏专门的翻译功能。

#### 功能描述

- 触发按钮区新增第三个按钮：🌐 Translate（或合适图标）。
- Settings 页面新增翻译目标语言配置（select），持久化到 `chrome.storage.sync`（key: `translateLang`），默认 `'Chinese (Simplified)'`。
- Translate 模式下，构建专门的翻译 prompt，并在同一次 AI 请求中要求模型处理以下逻辑：
  - 若选中文本不是目标语言，输出结合上下文的自然翻译，简洁直接。
  - 若选中文本已是目标语言，不重复翻译，而是给出简短语境解释。
- 翻译 prompt 包含：选中文本、上下文前后文、页面标题、URL、目标语言。
- 不在插件内做语言检测，不额外调用 AI。
- 翻译输出应简洁，不输出长篇解释。
- 不破坏 Explain 和 Ask 功能。
- Translate 结果也保存到 history（标记 `mode: 'translate'`）。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `content.js` | 新增 Translate 按钮；`buildTranslatePrompt()`；模式枚举增加 `'translate'` |
| `popup.html` | Settings 新增目标语言选择 UI |
| `popup.js` | 读取/保存 `translateLang` |

#### 依赖关系

- **依赖：** #v2-01（主题）、#v2-02（对比度），其余可独立
- **被依赖：** 无

#### 实现建议

**Translate System Prompt：**
```
You are a precise translator and language expert.
Target language: {translateLang}

Rules:
1. If the selected text is NOT in {translateLang}, provide a natural translation 
   that fits the context. Be concise. No lengthy explanations.
2. If the selected text IS already in {translateLang}, provide a brief contextual 
   note: meaning in this context, tone, connotation, or more natural expression.
3. For single words: give contextually appropriate translation/meaning.
4. For phrases: give natural expression.
5. For sentences: give complete natural translation.
6. For multi-sentence text: preserve paragraph structure.
7. Do NOT add meta-commentary — just provide the result.
```

#### 测试方法

1. 划线后出现三个按钮：Explain、Ask、Translate。
2. 点击 Translate，返回简洁翻译结果（非长篇解释）。
3. 选中目标语言文本（如中文），Translate 返回语境解释而非重复翻译。
4. Settings 中更改目标语言后，翻译目标变化。
5. Explain/Ask 行为不变。
6. 翻译结果出现在 History 中。
7. API 失败时有错误提示。

#### 验收条件

- [ ] 触发区显示三个按钮。
- [ ] Translate 返回简洁翻译/语境解释。
- [ ] Settings 目标语言持久化。
- [ ] Explain/Ask 功能不变。
- [ ] 翻译结果保存到 History。
- [ ] API 失败有错误提示。

#### 潜在风险

- 三个按钮可能在小屏幕或文本靠近边缘时位置受限，需更新按钮组定位逻辑。
- 需确保 `mode: 'translate'` 在 history 中正确区分显示。

---

### Issue #v2-07：图片识别 Vision API 配置

**分支名：** `feature/v2-image-api-settings`

#### 背景

v2 新增图片解释/问答功能，需要独立的 Vision API 配置（可能使用不同模型/端点）。Settings 页面需要提供相关配置 UI，配置需要持久化且安全存储。

#### 功能描述

- Settings 页面新增"Vision API"配置区，包含：
  - **Enable Image Analysis**：开关（checkbox），控制图片右键菜单功能是否激活。
  - **Vision API Endpoint**：URL input（支持 OpenAI-compatible 格式）。
  - **Vision API Key**：password input，带 show/hide 切换，默认不明文显示。
  - **Vision Model**：text input，placeholder 如 `gpt-4o`、`gemini-pro-vision`。
  - **Request Format**：select，`openai-compatible`（默认）。
- API key 存储在 `chrome.storage.sync`。
- 配置缺失时，图片解释功能给出清晰提示，不静默失败。
- 支持保存、读取、清除配置。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `popup.html` | 新增 Vision API 配置区域 |
| `popup.js` | 读取/保存 Vision API 配置 |

#### 依赖关系

- **依赖：** #v2-01（主题）、#v2-02（对比度）
- **被依赖：** #v2-08（图片右键菜单）、#v2-09（图片 popup）、#v2-10（API 测试）

#### Storage Keys

```javascript
{
  visionEnabled: true,
  visionApiEndpoint: 'https://api.openai.com/v1',
  visionApiKey: 'sk-...',
  visionApiModel: 'gpt-4o',
  visionRequestFormat: 'openai-compatible'
}
```

#### 验收条件

- [ ] Vision API 配置区在 Settings 可见可用。
- [ ] 配置可保存、读取、清除。
- [ ] API key 默认不明文展示。
- [ ] Enable 开关可控制图片功能开/关。

#### 潜在风险

- settings 页面已有较多内容，添加新区域需注意布局不过于拥挤。

---

### Issue #v2-08：图片右键菜单

**分支名：** `feature/v2-image-context-menu`

#### 背景

当前扩展没有 context menu 功能。v2 需要在图片上右键时，显示图片解释/问答选项。Chrome MV3 中 context menu 需要通过 `chrome.contextMenus` API 在 background script 中注册。

#### 功能描述

- `background.js` 注册 context menu 项目，使用 `contexts: ['image']`：
  - **◆ Explain this image**
  - **? Ask about this image**
- 点击后，background 通过 `chrome.tabs.sendMessage` 通知 content script，传递图片 URL。
- Content script 接收消息后处理图片并显示图片解释 popup。
- 处理异常：跨域图片、懒加载图片、无效图片 URL、权限不足。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `manifest.json` | 添加 `contextMenus` 权限 |
| `background.js` | 注册 context menu；监听 `onClicked`；向 content script 发消息 |
| `content.js` | 监听 `chrome.runtime.onMessage`；`handleImageContextMenu()` |

#### 依赖关系

- **依赖：** #v2-07（Vision API 配置）
- **被依赖：** #v2-09（图片 popup 展示逻辑）

#### 实现建议

```javascript
// background.js - 注册 context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'explain-image',
    title: '◆ Explain this image',
    contexts: ['image']
  });
  chrome.contextMenus.create({
    id: 'ask-image',
    title: '? Ask about this image',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: 'IMAGE_CONTEXT_MENU',
    action: info.menuItemId,
    srcUrl: info.srcUrl,
    pageUrl: info.pageUrl
  });
});
```

#### 验收条件

- [ ] 图片右键出现两个选项。
- [ ] 点击后 content script 收到消息。
- [ ] 非图片区域不出现选项。
- [ ] 扩展重载后正常。

#### 潜在风险

- `onInstalled` 在扩展更新时触发，建议同时在 `onStartup` 中注册（Chrome 会自动去重）。
- `info.srcUrl` 在某些 iframe 内图片可能为空。

---

### Issue #v2-09：图片解释与问答 Popup

**分支名：** `feature/v2-image-popup-qa`

#### 背景

图片右键菜单触发后，需要在页面上显示图片解释或问答 popup，复用现有 panel 架构，通过 Vision API 进行图片分析。

#### 功能描述

- 复用现有 Shadow DOM panel 架构，新增图片模式。
- Popup 顶部/侧边显示引用的图片缩略图（可点击放大查看，即 lightbox）。
- Explain 模式：自动发送图片 + 解释 prompt，流式返回结果。
- Ask 模式：显示输入框，用户输入问题后发送图片 + 问题。
- Vision API 调用采用 OpenAI-compatible vision 格式（base64 或 URL）。
- 处理异常：跨域图片、Vision API 未配置、图片过大、API 返回错误。
- 图片在解释窗口和 history 详情窗口中点击可放大（lightbox）。
- 图片解释结果保存到 History（标记 `mode: 'image'`，保存图片 URL）。
- 不破坏文本 Explain/Ask 功能。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `content.js` | `showImagePanel()`；`fetchVisionAPI()`；图片 base64 转换；lightbox |
| `popup.js` | History 详情页显示图片缩略图，支持放大 |

#### 依赖关系

- **依赖：** #v2-07（Vision API 配置）、#v2-08（图片 URL 传递）

#### 图片数据获取策略

```javascript
async function getImageData(srcUrl) {
  try {
    const resp = await fetch(srcUrl, { mode: 'cors' });
    const blob = await resp.blob();
    return { type: 'base64', data: await blobToBase64(blob) };
  } catch (e) {
    // 跨域失败，降级使用 URL
    return { type: 'url', url: srcUrl };
  }
}
```

#### 验收条件

- [ ] 图片 Explain/Ask popup 可用，显示缩略图。
- [ ] 流式返回解释结果。
- [ ] 图片可点击放大（lightbox）。
- [ ] History 显示图片条目，图片可放大。
- [ ] API 未配置有清晰提示。
- [ ] 跨域/无效图片有合理处理。
- [ ] 文本功能不受影响。

#### 潜在风险

- base64 图片不应存入 `chrome.storage.local`（过大），只存 URL。
- 部分网站图片有防盗链，base64 获取会失败；需优雅降级。
- Vision API 响应格式与文本 API 不同，需独立处理。

---

### Issue #v2-10：API 连接测试功能

**分支名：** `feature/v2-api-test`

#### 背景

用户配置 API 后无法验证配置是否正确，只有在实际使用时才发现错误，体验差。Settings 页面需要提供 "Test Connection" 按钮，执行轻量级真实 API 请求来验证配置。

#### 功能描述

- **文本 API** 配置区新增 `Test Connection` 按钮。
- **Vision API** 配置区新增独立的 `Test Connection` 按钮。
- 文本 API 测试：发送 prompt `Reply with exactly: OK`。
- Vision API 测试：发送内置极小 base64 测试图片（1×1 像素白色 PNG），prompt `Describe this image in 3 words.`。
- 测试结果显示：成功/失败 + 延迟（ms）+ HTTP status + 简短错误原因 + 测试时间。
- 测试过程按钮显示 loading 状态，禁止重复点击。
- Timeout：10 秒。
- 不在 UI/日志/console 中泄露完整 API key。
- 完整错误分类覆盖：401/403/404/429/5xx/网络失败/超时/JSON 解析失败等。

#### 涉及文件/模块

| 文件 | 改动内容 |
|------|---------|
| `popup.html` | 每个 API 配置区新增 Test 按钮 + 结果显示区 |
| `popup.js` | `testTextApi()`；`testVisionApi()`；`classifyError()` |

#### 依赖关系

- **依赖：** #v2-07（Vision API 配置区存在后才能加 Vision 测试按钮）
- **建议在最后实现**（依赖配置 UI 已稳定）

#### 测试用资源

测试图片（1×1 白色 PNG base64）：
```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==
```

#### 验收条件

- [ ] 文本 API 配置区有 Test 按钮，可用。
- [ ] Vision API 配置区有 Test 按钮，可用。
- [ ] 成功显示延迟。
- [ ] 各类失败有用户可理解的错误提示。
- [ ] Timeout 10 秒。
- [ ] 测试中按钮 disabled，不重复请求。
- [ ] 不泄露完整 API key。
- [ ] 不影响正常 Explain/Translate/Image 功能。

#### 潜在风险

- Popup 中的 `fetch()` 受 popup 的 CSP 限制；自签名证书会失败（需提示用户）。
- Vision API 测试的 base64 图片若极小，部分模型可能返回奇怪结果，但不影响连接测试本身。

---

## 推荐开发顺序总结

```
1. [#v2-01] 主题系统               → 基础设施，所有 UI 改动的前提
2. [#v2-02] 对比度优化             → 在主题系统基础上打磨
3. [#v2-03] 键盘事件隔离           → 独立，修复高频痛点
4. [#v2-04] Popup Pin              → 独立功能，较小改动
5. [#v2-05] Popup Resize           → 较大改动，独立
6. [#v2-06] 翻译功能               → 复用现有文本 API 链路
7. [#v2-07] Vision API 配置        → 图片功能的前置条件
8. [#v2-08] 图片右键菜单           → 依赖 #v2-07
9. [#v2-09] 图片解释/问答 Popup    → 依赖 #v2-07 #v2-08
10. [#v2-10] API 连接测试          → 放最后，所有配置 UI 稳定后实现
```

---

## 最终合并检查清单（release/v2 → main）

- [ ] 文本选择解释（Explain）
- [ ] 文本选择问答（Ask）
- [ ] 文本选择翻译（Translate）
- [ ] Popup 显示/关闭
- [ ] Popup Pin 功能
- [ ] Popup Resize（左下/右下）
- [ ] Popup 位置/大小持久化与恢复
- [ ] Settings 保存（文本 API + Vision API + 翻译语言 + 主题）
- [ ] 主题切换（浅色/深色/跟随系统）
- [ ] 跟随系统主题动态响应
- [ ] 键盘事件隔离（GitHub 页面验证）
- [ ] 图片右键菜单（普通页面 + GitHub）
- [ ] 图片 Explain 功能
- [ ] 图片 Ask 功能
- [ ] 图片 History 保存与展示
- [ ] 图片放大（lightbox）
- [ ] API 连接测试（文本 + Vision）
- [ ] 历史记录（搜索/删除/导出）
- [ ] 注解标记（页面 annotation 恢复）
- [ ] Chrome extension reload 后全功能正常
- [ ] 至少在普通网页和 GitHub 页面完整测试

---

## v2 版本变更说明

- **版本号：** `2.0.0`
- **新增权限：** `contextMenus`
- **新增 storage keys：** `theme`、`translateLang`、`visionEnabled`、`visionApiEndpoint`、`visionApiKey`、`visionApiModel`、`visionRequestFormat`、`panelGeometry`
- **向后兼容：** 所有 storage keys 均为新增，不修改现有 keys，旧用户升级后无数据丢失
