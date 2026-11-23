# v2.3 阅读器兼容性验证

## v2.3.1 点击翻页修复

BookOrbit 在章节文档的捕获阶段接收点击，并把点击坐标转成阅读器翻页动作。v2.3.0 在按钮目标阶段才拦截，因而无法阻止已排程的翻页。v2.3.1 将扩展界面上的点击留在其 Shadow DOM 内，并隔离界面的触摸和焦点事件。

Chrome 夹具同时运行 BookOrbit 原版的 Foliate 渲染器、输入处理和选区处理。旧版点击解释后会收到一条阅读器翻页消息。新版验证解释、提问、翻译和追问期间页面位置保持稳定，并验证点击正文仍能正常翻页。弹窗版本直接读取 Manifest，页面类型与选区限制见 README。 [BookOrbit 输入处理源码](https://github.com/bookorbit/bookorbit/blob/e60ab43f6f4c859050a090c2e4a2427d65495193/client/src/features/reader/epub/composables/useFoliateInput.ts)

## 根因与处理优先级

| 优先级 | 已确认问题 | 复现与处理 |
| --- | --- | --- |
| P0 | 旧版内容脚本只注入顶层。顶层 `Selection` 不包含子文档的 Range | 用旧版打开测试页并选中最内层 iframe 的文字，没有操作按钮。在 MV3 中启用 `all_frames` 和 `match_origin_as_fallback`。Chrome 对这类动态文档按发起方来源匹配，`<all_urls>` 已满足路径通配要求，`match_about_blank` 不再另配。保留 `document_end` 和原有权限。 |
| P0 | Foliate 在沙箱 iframe 内加载独立章节，分页后 iframe 可能远宽于可视区。EPUB XHTML 的 XML 解析器还会拒绝部分面板 HTML | 使用 BookOrbit 自带的 Foliate 打开双章节 EPUB。每个 frame 读取自身 Range，在同源允许时将可视区裁剪到祖先视口，并用 HTML 模板生成 XHTML 内的面板。CFI 由 BookOrbit 的页面代码计算，扩展的隔离脚本未接入该接口。 |
| P1 | 旧版在正文中搜索首个匹配项，重复选词会错配，点击后重新读选区也可能碰到 DOM 更新 | 选第二个 `bank`，旧版请求使用第一个 `bank` 的河岸语境。新版按两个 Range 边界取相邻可见文字，保留段落间隔。失效后使用附近的引文和前后文匹配，无法唯一定位时只保留所选文字。 |
| P1 | frame 的临时 URL 无法重开，原有历史写入在多个 frame 下可能互相覆盖 | 用 `blob:` 章节发起解释，保存顶层网页 URL 和标题。可恢复的普通 iframe 额外保存实际 frame URL。历史变更由 service worker 串行处理。EPUB、PDF 文本层、临时文档和 Shadow DOM 不包裹原文节点。 |
| P1 | bilibili 的评论位于开放式 Shadow DOM。微信读书测试章节的正文没有产生原生文字 Range | 实测 B 站评论可显示按钮并打开提问。微信读书测试章节的阅读区有可见 Canvas，拖选后浏览器原生选区长度为 0。扩展仅处理浏览器公开的 DOM 选区。 |

Chrome 会根据站点访问权限、frame 源及页面类型决定是否注入。关闭扩展网站访问权限、受限内页和内置 PDF 查看器可导致探测失败。扫描件、图片和只有 Canvas 像素的页面没有原生文本 Range。封闭式 Shadow DOM 无法安全定位内部文本。各站点的不同版本和阅读模式需要分别验证。 [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) · [BookOrbit EPUB Selection 实现](https://github.com/bookorbit/bookorbit/blob/e60ab43f6f4c859050a090c2e4a2427d65495193/client/src/features/reader/epub/composables/useFoliateSelection.ts)

## 自动化命令

使用 Node.js 22.13 或更高版本、支持 `Extensions.loadUnpacked` 的 Chrome 和 `playwright-core`。浏览器使用临时配置，自动化 AI 请求仅发送到本机的模拟流式端点。省略 `BOOKORBIT_SOURCE` 可单独跑通用网页测试。

```sh
node tests/test_history.js
npm install --prefix /tmp/ctx-browser playwright-core
git clone https://github.com/bookorbit/bookorbit.git /tmp/ctx-bookorbit
git -C /tmp/ctx-bookorbit checkout e60ab43f6f4c859050a090c2e4a2427d65495193
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
PLAYWRIGHT_CORE=/tmp/ctx-browser/node_modules/playwright-core \
BOOKORBIT_SOURCE=/tmp/ctx-bookorbit node tests/reader-compat.mjs
```

Chrome 158.0.8127.37 中通过 8 组浏览器回归检查，涵盖普通网页、跨节点选区、嵌套与动态 frame、开放及封闭 Shadow DOM、HTML PDF 文本层、两种失效选区降级、真实 EPUB 分页与切章、历史下划线恢复和删除、图片请求以及受限页面防护。原有历史逻辑检查 15 项通过。模拟端点验证了流式请求和追问，实站未发送 AI 请求。

如需复核旧版，在合并基线 `bc4f6f5` 的归档目录中保留旧扩展，再把目录绝对路径传给同一脚本的 `BASELINE_EXTENSION`。

## 实站复核步骤

1. 在 `chrome://extensions` 加载本仓库，刷新已打开的网页和阅读器标签页。用正常网页先确认解释、提问、翻译和追问都可工作。
2. 登录自己的 BookOrbit 实例，打开有可选文字的 EPUB。在出现重复短语的段落中拖选后一次，确认解释使用当前段落的语境。发送两次追问，翻到同一章下一页和另一章节后重复尝试。检查点击扩展三种操作都不会翻页，关闭面板后点击正文边缘仍会正常翻页。检查 BookOrbit 原生高亮菜单仍可使用，以及扩展历史链接返回同一本书。独立 Chrome 配置中实站跳转到 `/login?redirect=/`，因此未验证已登录的完整界面。测试使用的 Foliate `paginator.js` 与实站公开资产的 SHA-256 均为 `82c0090ee6f22ab7dd25638e5e3c4c68e8c3981bd711b4ae6be0281dda26eb16`。
3. 打开已测试的 B 站视频并滚动到评论区。拖选评论正文，检查出现一组按钮，再打开提问。已在实站完成拖选及打开面板，实站未发送 AI 请求。 [bilibili 视频](https://www.bilibili.com/video/BV1jKsq6cEEP/)
4. 打开微信读书已测试的第一章，在正文拖选后于开发者工具执行 `document.getSelection().toString()`。本次这一章节的 Canvas 上拖选返回空字符串，扩展无原生选区可读取。登录后的其他书籍和阅读模式可用同样步骤核对。 [微信读书测试章节](https://weread.qq.com/web/reader/49432980720c671f4941767kd2d32c50249d2ddea18fb39)
5. 在实际 PDF.js 查看器中打开含文字的 PDF，解释并追问一段可选文字。然后在 Chrome 内置 PDF 查看器和 `chrome://version` 确认扩展不会注入选区界面。带 HTML 文本层的本地夹具已测，第三方 PDF 查看器的文本顺序和页面样式仍需按站复核。

## 已知边界

跨域 frame 的 UI 受自身视口及外部容器裁剪，扩展无法读取跨域容器的布局。很小的同源 frame 使用紧凑面板。浏览器隔离的页面无法在原地显示操作按钮。延迟渲染或重新排版的普通网页可能无法自动找回历史下划线，历史对话仍可在弹窗打开。下一步优先复核实站原生高亮菜单及其他 PDF 查看器，按需要评估由阅读器公开的稳定定位接口。
