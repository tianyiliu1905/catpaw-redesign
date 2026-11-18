# CatPaw Desktop UI · 项目交接指南

这是 CatPaw 桌面端 Agent 的可交互设计原型，以及配套的设计策略作品集、Design System 和动效实验。**主产品入口是根目录的 `index.html`；设计汇报入口是 `design-strategy-slides.html`。** 修改主项目请在根目录源码中进行，不要误改 `dist/`、`release-v2/` 或 `_deploy/` 的副本。

本文按 2026-11-18 的本地目录整理。部分实验、打包和发布目录未被 Git 跟踪，换机器后不一定存在；以实际文件和 `git status` 为准。旧版详细体验说明保留在 [历史 README](docs/README-legacy-20261104.md)，其中任务顺序、入口和功能边界可能已过时。

## 1. 先打开这几个入口

以下文件链接随项目移动仍有效。在本地服务器启动后，也可以使用右列地址。

| 入口 | 用途 | 本地预览 |
| --- | --- | --- |
| **[index.html](index.html)** | **主 Demo**：首页、任务对话、摘要、文件预览、子智能体、后台进程、消息队列 | [主 Demo](http://localhost:8000/index.html) |
| **[design-strategy-slides.html](design-strategy-slides.html)** | **PPT / 设计策略作品集**：背景、研究、设计动作与嵌入式 Demo；实际是 HTML，不是 `.pptx` | [设计汇报](http://localhost:8000/design-strategy-slides.html#1.1) |
| **[catpaw-design-system.html](catpaw-design-system.html)** | **Design System 展示页**：设计规范与视觉参考 | [Design System](http://localhost:8000/catpaw-design-system.html) |
| [assets/generated-subagents/index.html](assets/generated-subagents/index.html) | 自动生成的子智能体头像及尺寸预览 | [头像预览](http://localhost:8000/assets/generated-subagents/index.html) |
| [motion-lab/index.html](motion-lab/index.html) | 动效对照实验；Text & tools 中的 Slide up 是主 Demo 工具 / 任务轮换的参考 | [动效实验](http://localhost:8000/motion-lab/index.html) |
| [icon-preview.html](icon-preview.html) | 图标、Keyline 与尺寸对照实验 | [图标预览](http://localhost:8000/icon-preview.html) |

### 启动

在项目根目录执行：

```sh
python3 -m http.server 8000
```

浏览器打开 `http://localhost:8000/index.html`。端口被占用时换端口，并同步替换上述链接中的端口。

主 Demo 是原生 HTML / CSS / JavaScript，**根目录没有 npm 安装和构建步骤**。界面终端里的命令、日志不等于本项目启动命令。`experiments/` 中的独立项目可能有自己的 `package.json`，须按它们的说明运行。

也可直接打开 HTML 文件，但推荐 HTTP：`file://` 下剪贴板、存储、登录和跨文件访问可能受浏览器限制。Node.js 用于检查、测试和头像生成，头像脚本要求 Node.js 18+；主 Demo 浏览本身不依赖 Node 服务。

## 2. 主 Demo 的代码入口

```text
index.html
 ├─ styles.css + 各功能模块 CSS
 └─ WorkBuddy Cloud SDK（远程、可选）
    ├─ catpaw-cloud-config.js
    └─ catpaw-cloud.js
       └─ APP_SCRIPTS 按顺序加载功能模块、strategy-scenes.js、app.js 等
```

| 文件 | 负责什么 / 何时修改 |
| --- | --- |
| [index.html](index.html) | 静态结构、左侧任务入口与 ID、主区域、输入框、工作区、弹窗；CSS 和启动脚本引用 |
| [app.js](app.js) | 主交互和演示数据：任务切换、对话渲染、文件树、预览、摘要、后台悬浮列表、阶段演示、版本记录等 |
| [styles.css](styles.css) | 主应用语义 token、字体、主题、组件、布局、响应式及动画；文件较长，存在后置覆盖，修改前搜全同名选择器 |
| [catpaw-cloud.js](catpaw-cloud.js) | 云登录 / 同步与应用启动门；**`APP_SCRIPTS` 是主 JS 加载清单，顺序敏感** |
| [catpaw-cloud-config.js](catpaw-cloud-config.js) | 云服务公开配置；不是 AI 推理配置，不要在此填入私密密钥 |
| [strategy-scenes.js](strategy-scenes.js) | 汇报页与主 Demo 共用的场景编号、动作和播放时序 |

### 找功能时优先搜索这些名字

用函数 / 选择器搜索比记行号可靠。`app.js` 是大文件，先定位目标再阅读相邻代码。

| 要改的内容 | 搜索关键词 / 位置 |
| --- | --- |
| 文件夹和示例文件 | `FOLDERS` |
| 对话列表与预置内容 | `demoConversationTask`、`conversationExamples`、`conversationThreads` |
| 第一条对话的过程演示 | `conversationStageFrames`、`renderConversationStage`、`renderStageCallDetails` |
| 子智能体 / 后台进程 | `backgroundAgentTask`、`backgroundProcessTask`、`backgroundMixedTask`、`backgroundDemoPartial`、`background-agent-disclosure` |
| 摘要与数量 | `renderSummaryContents`、`renderSummaryAgents` |
| 头像选择及子智能体页签 | `demoAgentAvatarSrc`、`subagent` |
| 版本记录 / 修改摘要 | `artifact-history`、`renderEarlierTurnArtifacts`、`hasVersionDemoHistory` |
| 左侧轮次刻度和悬浮预览 | `conversation-turn-preview`、`conversation-turn-artifacts`、`updateConversationTurnNav` |
| 回复下复制、赞、踩、时间 | `renderMessageMeta`、`conversation-message-meta`、`conversation-reply-time` |
| 工具与任务文字轮换 | `stage-tool`、`backgroundTaskStepTimer`，并对照 `motion-lab/` |

### 主要演示路径

- **整理本周门店履约异常明细**：多轮对话、工具调用、过程状态、产物与版本追溯。第一条对话是主线演示，修改它后检查发送到完成的完整过程。
- **主对话完成，子智能体后台核查**：后台子智能体、悬浮胶囊、展开列表、子智能体对话。演示控件包含不同数量及部分完成场景。
- **后台进程 · 悬浮提示**：后台进程列表、终端日志预览、不消耗积分提示。
- **子智能体与后台进程 · 悬浮提示**：混合任务；当前设计展示 3 个子智能体与 1 个后台进程。
- **消息队列 · 补充与引导**：执行中补充要求、编辑 / 删除队列项及引导发送。
- **把季度复盘要点汇总成幻灯片**：产物预览、编辑、选区引用与批注。
- 异常、供应商对比、澄清等示例由各自模块提供。任务显示顺序会调整，定位时用名称或 HTML ID，不依赖“第几个”。

### 拆分出的功能模块

同名 `.js` / `.css` 通常分别管逻辑和样式：

| 模块 | 用途 |
| --- | --- |
| `artifact-editing-demo.*` | PPT / Excel / Word 选区、引用和批注 |
| `ppt-workbar.*` | **Demo 内的 PPT 产物编辑工具**，不是设计汇报页面 |
| `recovery-conversation-demo.*` | 异常与恢复对话 |
| `clarification-demo.*` | 提问、补充信息与澄清 |
| `conversation-queue-demo.*` | 消息队列与中途干预 |
| `supplier-conversation-demo.*` | 供应商比较可视化回复 |
| `widget-value-cases.*` | Widget 回复案例及汇报页示例 |
| `capability-market.*` | 专家、技能等能力市场 |
| `library-page.*` | 资料库 |
| `nocode-page.*` | 应用页 |
| `credits-demo.*` | 积分相关界面 |
| `desktop-pet-demo.*` | 独立桌宠 / 会议场景，汇报中也会引用 |

## 3. PPT / 设计策略作品集

**用户说“PPT”“slide”“作品集”时，首先找 [design-strategy-slides.html](design-strategy-slides.html)。** 不要与 Demo 内的“季度经营复盘.pptx”混淆，后者是产品产物样例。

当前根元素带 `journal-view case-study-view`，默认是**连续滚动的作品集阅读模式**。旧翻页实现仍保留，但历史文档中的 `?view=journal` 不能当作已验证的模式开关。

| 文件 | 作用 |
| --- | --- |
| `design-strategy-slides.html` | 汇报内容、数据、页面模板、内联样式、嵌入 Demo 及基础激活逻辑 |
| `strategy-case-study.css` / `.js` | 当前连续阅读布局、侧边章节导航、滚动激活 |
| `strategy-journal.css` / `.js` | 原滑动翻页布局与过渡；连续阅读实现接管其 `create` 入口 |
| `slide-layout.css` | 幻灯片局部排版规则 |
| `strategy-scenes.js` | Demo 场景映射和自动演示步骤；同时被主 Demo 使用 |

汇报使用 iframe 嵌入 `index.html?strategyScene=...`，并通过消息协调场景。**嵌入演示不是截图，主 Demo 的改动可能影响 PPT。** 反过来，改汇报文案不等于改了 Demo。

- `#1.1` 等 hash 是汇报内容锚点；Demo 使用 `?strategyScene=1.1` 等查询参数，两者不是同一种路由。
- 场景编号沿用过往策略编排，不要仅凭编号猜含义。修改前对照 `strategy-scenes.js` 与 `app.js` 中的场景处理。
- 改内容：先搜汇报中的标题文字；改布局：检查内联 CSS、`slide-layout.css`、`strategy-case-study.css` 的覆盖顺序。
- 改联动：同时检查场景定义、主 Demo 的动作处理和汇报 iframe 参数。
- `decision-deck.html` 是另一份设计材料，不是当前默认汇报入口。

## 4. Design System：展示页与实际 token 要分开看

| 层级 | 文件 | 说明 |
| --- | --- | --- |
| 规范展示 | [catpaw-design-system.html](catpaw-design-system.html) | 给人阅读的规范页；改这里不会自动修改整个 Demo |
| 主应用实际样式 | [styles.css](styles.css) | `:root` 中 `--ds-*` 语义 token、旧别名如 `--text-*` / `--gray-*`，以及暗色主题 |
| Widget token / 基础样式 | [assets/widget-design-system.css](assets/widget-design-system.css) | 生成文件，主要作用域是 `.quote-ui`、`.wvc-widget` |
| Widget 主应用适配 | [widget-catpaw-components.css](widget-catpaw-components.css) | CatPaw 组件外观适配 |
| Widget 规范与试验 | [widget-guidelines-audit/](widget-guidelines-audit/) | 规范检查、style-lab、基线 / 调整版及生成来源；不是主应用入口 |

优先复用已有语义变量，避免同一层级灰色或字号各写一套。token 别名不一定同号对应，例如 `--text-2` 的实际颜色应查定义，不能由名称猜。

`assets/widget-design-system.css` 的生成入口：

```sh
python3 widget-guidelines-audit/build-demo-design-system.py
```

它读取 `widget-guidelines-audit/style-lab/adjusted-export.json` 和 `style-lab/adjusted/ui-sdk/packages/widget/src/design-system/widgetDesignSystem.ts`。**先确认这些源文件存在，再生成；只改生成结果，下次生成可能覆盖。** 主应用 token 与 Widget token 分开维护，修改共享设计规范后需分别核对。

## 5. 子智能体头像与动效

- [scripts/generate-subagent-avatars.mjs](scripts/generate-subagent-avatars.mjs)：可复现的 SVG 生成器；受约束的色相 / 明度 / 彩度，随机椭圆组合及形体归一化。
- [scripts/subagent-expressions.mjs](scripts/subagent-expressions.mjs)：眼睛、嘴、表情大小与位置。
- [scripts/subagent-geometric.mjs](scripts/subagent-geometric.mjs)：几何构成实验分支，不是当前默认淡彩表情形象。
- [assets/generated-subagents/](assets/generated-subagents/)：生成的 SVG、`manifest.json`、`palette.json` 和预览页。主 Demo 引用其中资源，当前头像选择入口在 `demoAgentAvatarSrc`。
- `assets/subagent-tool.svg` 是工具调用的通用子 Agent 图标，与彩色个体头像不同。

```sh
node scripts/generate-subagent-avatars.mjs --help
# 在临时目录试验，避免立即覆盖正式头像
node scripts/generate-subagent-avatars.mjs --seed catpaw --count 24 --out /tmp/catpaw-subagent-preview
# 确认效果后才重新生成正式资源
node scripts/generate-subagent-avatars.mjs --seed catpaw --count 24
```

不要只手改生成 SVG 却遗漏脚本。头像文件编号与 seed 不完全相同，预览顺序有调整，应查 manifest 和实际资源。

`motion-lab/` 是独立实验，详见其 [README](motion-lab/README.md)。修改实验不会自动同步主 Demo；选定效果后需移植并核对主应用的缩放、滚动、展开收起和减少动态效果设置。

## 6. 其他目录和设计资料

| 文件 / 目录 | 定位 |
| --- | --- |
| `assets/` | 主应用及演示素材；包含 SVG、图像、生成头像与 Widget 样式，不宜整体删减 |
| `tests/` | Node 原生测试；很多使用 DOM doubles 或源码契约检查，不能替代浏览器视觉验收 |
| `scripts/` | 头像生成与表情 / 几何模块 |
| `packages/` | 已生成 ZIP 包，属于某一时刻快照，不会随源码自动更新 |
| `dist/`、`release-v2/`、`_deploy/` | 发布 / 分发副本；不是默认开发源，请先确认其用途再更新 |
| `experiments/` | 独立实验，如 OpenUI Agent、B 端表单；进入后先读当地 README / AGENTS.md |
| `reference-board/` | 参考材料与独立展示，见其 README |
| `purchase-request-form/`、`stock_screen/`、`sites/` | 其他样例 / 独立产物，不是主 Demo 启动所需入口 |
| `*-art-preview.html`、`genui-probe.html`、`subagent-motion-comparison.html`、`hangzhou-weekend-planner.html`、`sales-dashboard.html` | 独立预览、研究或生成案例，不能根据“也是 HTML”就当成主页面 |
| `.catpaw/`、`.workbuddy/`、`.openai/` 等 | 工具工作数据 / 元信息；不应混作产品源码或默认打包内容 |

设计理由与背景优先看：

- [DESIGN_REVIEW_STRATEGIES.md](DESIGN_REVIEW_STRATEGIES.md)：设计策略与研究材料。
- [DECISIONS.md](DECISIONS.md)：设计取舍和历史决策；注意已替代方案。
- [design.md](design.md)：界面与交互约定。
- [PANEL_INTERACTION_ANIMATIONS.md](PANEL_INTERACTION_ANIMATIONS.md)：面板、拖拽和动效约定。
- [INFORMATION_DISCLOSURE_FLOW.md](INFORMATION_DISCLOSURE_FLOW.md)：信息披露流程。
- [HOMEPAGE_CASES_RESEARCH.md](HOMEPAGE_CASES_RESEARCH.md)、[CATDESK_GENUI_OBSERVATIONS.md](CATDESK_GENUI_OBSERVATIONS.md)：案例与 GenUI 研究。

这些资料可能早于最新界面。发生差异时，结合当前任务要求、源码和实际演示确认，不要把历史方案直接恢复进去。

## 7. 原型边界和数据保存

这是设计原型，工具调用、子智能体执行、百分比、后台终端日志及产物生成主要是本地模拟，**不代表真实 AI 推理、命令执行或本机文件修改**。部分浏览器交互（复制、文件选择、导出、存储）可以真实发生，应以对应处理函数为准。

与早期版本不同，项目已有**可选 WorkBuddy 云登录与数据同步层**：资料库、NoCode 应用、能力市场自定义项、我的模版这四类 localStorage 数据可同步。它不等于接入 Agent 服务。云服务不可用时有本地启动回退；实际云端可用性取决于网络、账号和配置。

对话、演示阶段和很多编辑状态仍主要在内存中，刷新可能重置。不同 origin 的 localStorage 不共享，`file://`、localhost 不同端口与线上环境的状态可能不同。不要为排查问题直接清空用户全部存储。

## 8. 接手修改与验证

1. 先 `git status --short`，识别已有修改与未跟踪文件；不要覆盖他人工作。
2. 从目标入口重现，再按上面的索引定位源码。主应用启动异常先检查控制台、`catpaw-cloud.js` 的加载顺序和 `app.js` 初始化。
3. 小范围修改。CSS 要检查后置覆盖；主 JS 要注意声明顺序，避免初始化时访问尚未赋值的变量。
4. 更新相关资源 URL 的 `?v=` 缓存标记：CSS 在 `index.html`；主 JS 在 `catpaw-cloud.js` 的 `APP_SCRIPTS`；必要时同步更新 HTML 对 loader 的版本号。
5. 做语法 / diff 检查，再跑相关功能测试和浏览器操作；改了主 Demo 还要看引用该场景的汇报页面。

```sh
node --check app.js
node --check catpaw-cloud.js
node --check strategy-scenes.js
git diff --check

# 根据改动选择测试，不必每次全跑
node --test tests/background-demo-state.test.cjs
node --test tests/agent-transmission.test.cjs
node --test tests/strategy-scenes.test.cjs tests/strategy-journal.test.cjs
node --test tests/artifact-editing-demo.test.cjs tests/ppt-workbar.test.cjs

# 完整逻辑回归（需要逐项查看失败原因）
node --test tests/*.test.cjs
```

至少人工检查：任务能否进入、单个 / 多个 / 混合后台任务、悬浮列表展开收起与滚动、右侧工作区开关、产物版本预览、最新回复操作区，以及窄窗口布局。仅语法检查通过不能说明动效与视觉已正确。

### 打包和交付

- **只交主 Demo**：保留 `index.html`、它引用的 CSS、`APP_SCRIPTS` 中的 JS、云启动 / 配置文件和所需 assets；继续追踪 JS 生成的 iframe / 资源引用，不能只收集 HTML 中的静态链接。
- **同时交设计汇报**：还需保留 `design-strategy-slides.html`、`strategy-*`、`slide-layout.css`、Widget 相关文件及汇报引用的独立 Demo（如桌宠）。
- **源码交接**：保留本 README、设计资料、生成脚本和测试；实验可单独交付。不要默认把缓存、录屏、Git 内部目录、旧 ZIP 和发布副本一起打包。
- `packages/` 下的旧 ZIP 不等于最新源码。交付前重新打包，并从解压目录启动服务器检查，避免资源路径只在原工作目录下有效。
