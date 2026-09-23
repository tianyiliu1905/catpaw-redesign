/* ============================================================
   CatPaw Desktop — 交互
   ============================================================ */
(function () {
  'use strict';

  const timeGreeting = document.getElementById('timeGreeting');

  function updateTimeGreeting() {
    const hour = new Date().getHours();
    let greeting = '晚上好，';
    if (hour >= 5 && hour < 11) greeting = '早上好，';
    else if (hour >= 11 && hour < 13) greeting = '中午好，';
    else if (hour >= 13 && hour < 18) greeting = '下午好，';
    timeGreeting.textContent = greeting;
  }

  updateTimeGreeting();
  setInterval(updateTimeGreeting, 60 * 1000);

  /* ---------- 1. 侧边栏折叠 / 展开 ---------- */
  const win = document.getElementById('window');
  const collapseBtn = document.getElementById('toggleSidebar');
  const expandBtn = document.getElementById('expandSidebar');

  function setCollapsed(collapsed) {
    win.classList.toggle('collapsed', collapsed);
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    expandBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  collapseBtn.addEventListener('click', () => setCollapsed(true));
  expandBtn.addEventListener('click', () => setCollapsed(false));

  // ⌘/Ctrl + B 切换
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      setCollapsed(!win.classList.contains('collapsed'));
    }
  });

  setCollapsed(false);

  /* ---------- 1.5 拍平后的任务 / 文件夹列表 ---------- */
  const TASK_LIMIT = 6;   // 任务区默认最多展示的条数

  const looseTasksEl  = document.getElementById('looseTasks');
  const expandTasksBtn = looseTasksEl.querySelector('[data-expand-tasks]');
  // 父任务即使下挂 SubAgent，也只占任务列表中的一个名额；
  // 子任务由父任务负责显隐，不参与顶层「展示 6 条」的计数。
  const looseTasks = Array.from(looseTasksEl.children)
    .filter((item) => item.matches('.task, [data-agent-task]'));
  const groups     = Array.from(document.querySelectorAll('[data-group]'));
  const labelTasks   = document.getElementById('labelTasks');
  const labelFolders = document.getElementById('labelFolders');

  let tasksExpanded = false;   // 任务区是否已展开全部

  /* 所有原场景任务按 DOM 顺序进入同一列表，超出上限的部分统一折叠。 */
  function renderTasks() {
    looseTasks.forEach((task, index) => {
      task.hidden = !tasksExpanded && index >= TASK_LIMIT;
    });

const shown = looseTasks.length;
const overflow = Math.max(0, shown - TASK_LIMIT);
expandTasksBtn.hidden = overflow === 0;
// 标题展示顶层任务总数；SubAgent 归属于父任务，不重复计数。
labelTasks.textContent = `任务 (${shown})`;
// 按钮只表达展开状态；剩余数量不在操作文案中重复展示。
expandTasksBtn.textContent = tasksExpanded ? '收起' : '展开';

labelTasks.hidden = shown === 0;
  }

  expandTasksBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tasksExpanded = !tasksExpanded;
    renderTasks();
    refreshClipped();
  });

  /* 父任务可以编排多个 SubAgent。展开按钮位于任务链接内部，因此同时拦住
     默认跳转和冒泡，只切换子任务区域，不误触父任务本身。 */
  function toggleAgentTasks(control) {
    const taskGroup = control.closest('[data-agent-task]');
    if (!taskGroup) return;
    const expanded = taskGroup.classList.toggle('is-expanded');
    control.setAttribute('aria-expanded', String(expanded));
    control.setAttribute('aria-label', `${expanded ? '收起' : '展开'} SubAgent 任务`);
    requestAnimationFrame(refreshClipped);
  }

  looseTasksEl.addEventListener('click', (e) => {
    const control = e.target.closest('[data-toggle-agents]');
    if (!control) return;
    e.preventDefault();
    e.stopPropagation();
    toggleAgentTasks(control);
  });

  looseTasksEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const control = e.target.closest('[data-toggle-agents]');
    if (!control) return;
    e.preventDefault();
    e.stopPropagation();
    toggleAgentTasks(control);
  });

/* 原场景文件夹全部进入同一列表，并沿用各自的折叠交互。 */
function renderGroups() {
groups.forEach((group) => {
group.hidden = false;
});
labelFolders.hidden = groups.length === 0;
}

  /* ---------- 1.7 文件夹数据源 ----------
     侧边栏分组、归属选择器共用同一份数据，避免两处文案各写各的。
     default 为兜底文件夹：不归属任何场景，任何场景下都可选，且不可删除。 */
  /* repo 字段标记该文件夹关联了代码仓库，其 branches 决定分支选择器是否出现。
     分支能力跟着「文件夹有没有仓库」走，而非跟着场景走：
     开发场景下也可能存在纯文档文件夹，那里不该出现分支。 */
  /* path 是该文件夹在磁盘上的真实位置，目前仅作为数据留存。
     files 是其内容，type 决定宫格里画哪种缩略图。

     type 为 folder 的项可再带 files，构成下一层。
     结构是递归的：渲染时只看「当前节点的 files」，
     因此嵌多少层都由同一套代码处理，不需要为深度做特例。
     不带 files 的文件夹视为空目录。

     带 preview 的项可在面板内就地打开（决策 2）。preview.kind 决定用哪个
     渲染器，其余字段是该渲染器的输入：
       markdown → text（原文，前端现渲染）
       image    → art （内联 SVG，不引用外部图片）
       html     → html（完整文档，塞进 iframe 的 srcdoc）
     三者都是纯字符串，不发任何请求——脱离本机、双击打开也能显示。
     没有 preview 的项保持只读占位，点开给一句说明而非空白。 */

  /* -- 示例产物 --
     全部内联成字符串或结构，不落成独立文件。这样整个原型只有
     index.html / styles.css / app.js 三个文件，打包发给别人
     或直接双击打开都能完整显示：没有 fetch，就没有
     file:// 协议下的跨域限制，也不会出现「少带了一个资源」。 */

  // 文档：用得上标题、列表、引用、代码、分隔线，覆盖渲染器的各条分支
  const DEMO_MD = [
    '# 门店履约异常｜排查记录',
    '',
    '> 2026-09-21 下午，上海虹桥店。本文由 CatPaw 自动整理自当次对话。',
    '',
    '## 结论',
    '',
    '异常集中在 **17:00–19:00** 的晚高峰，与运力缺口高度重合，',
    '并非系统故障。建议优先补运力，而不是改派单策略。',
    '',
    '## 关键发现',
    '',
    '- 超时订单 **128** 单，占当日总量的 6.2%',
    '- 其中 83% 集中在晚高峰两小时内',
    '- 同商圈另外两家门店同期未出现同等幅度的波动',
    '- 渠道侧数据在 13:45 之后未再更新，需人工复核',
    '',
    '## 下一步',
    '',
    '1. 晚高峰时段前置增配 2 名骑手',
    '2. 对超时订单做一次逐单归因，确认无系统性派单偏差',
    '3. 与渠道方确认数据延迟原因',
    '',
    '---',
    '',
    '核对口径时可直接跑这段：',
    '',
    '```',
    'SELECT store_id, COUNT(*) AS late_cnt',
    'FROM   fulfillment_order',
    'WHERE  biz_date = \'2026-07-27\'',
    '  AND  delivered_at > promised_at',
    'GROUP  BY store_id',
    'ORDER  BY late_cnt DESC;',
    '```',
    '',
    '相关明细见 `门店履约异常明细.xlsx`。',
  ].join('\n');

  /* 图片：画一张「截图」而不是放真实位图。
     位图要么外链、要么内嵌一长串 base64，前者破坏离线可分发，
     后者会让源码里多出几十 KB 不可读的字符。
     SVG 是文本，可读、可改、体积小，且缩放到任何尺寸都清晰。 */
  const DEMO_PNG =
    `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" role="img"` +
    ` aria-label="应用界面截图">` +
    `<defs><linearGradient id="shotSky" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#eaf2fb"/><stop offset="1" stop-color="#f4eef8"/>` +
    `</linearGradient></defs>` +
    `<rect width="640" height="400" fill="url(#shotSky)"/>` +
    // 窗口外壳：三颗灯 + 标题栏，一眼读出「这是一张软件截图」
    `<rect x="40" y="36" width="560" height="328" rx="10" fill="#fff"` +
    ` stroke="#dfe4ec" stroke-width="1.5"/>` +
    `<path d="M40 46a10 10 0 0 1 10-10h540a10 10 0 0 1 10 10v26H40z" fill="#f2f5f9"/>` +
    `<circle cx="62" cy="54" r="5" fill="#f4bcbc"/>` +
    `<circle cx="80" cy="54" r="5" fill="#f6dfb0"/>` +
    `<circle cx="98" cy="54" r="5" fill="#bfe3c4"/>` +
    // 左侧栏
    `<rect x="40" y="72" width="132" height="292" fill="#fafbfd"/>` +
    [96, 124, 152, 180].map((y, i) =>
      `<rect x="58" y="${y}" width="${[84, 68, 76, 58][i]}" height="8" rx="4"` +
      ` fill="${i === 0 ? '#9db7dd' : '#dde3ec'}"/>`
    ).join('') +
    // 主区标题与两张指标卡
    `<rect x="196" y="98" width="150" height="12" rx="6" fill="#9aa5b6"/>` +
    `<rect x="196" y="128" width="170" height="74" rx="8" fill="#f7f9fc" stroke="#e5eaf2"/>` +
    `<rect x="382" y="128" width="170" height="74" rx="8" fill="#f7f9fc" stroke="#e5eaf2"/>` +
    `<rect x="216" y="150" width="62" height="10" rx="5" fill="#c2cbd8"/>` +
    `<rect x="216" y="170" width="92" height="16" rx="6" fill="#5b93e0"/>` +
    `<rect x="402" y="150" width="62" height="10" rx="5" fill="#c2cbd8"/>` +
    `<rect x="402" y="170" width="76" height="16" rx="6" fill="#8fb8ea"/>` +
    // 折线区：给这张「截图」一个内容焦点
    `<rect x="196" y="218" width="356" height="122" rx="8" fill="#f7f9fc" stroke="#e5eaf2"/>` +
    `<path d="M220 318l56-34 48 18 56-52 52 28 46-40" fill="none" stroke="#3b82e0"` +
    ` stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  /* 网页：一份完整的独立文档，含 <style>，不引用任何外部资源。
     它会被整段塞进 iframe 的 srcdoc，因此必须自带样式，
     宿主页面的 CSS 进不去 iframe。 */
  const DEMO_HTML = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>门店履约异常看板</title>',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    '  color:#1d1d1f;background:#f5f7fa;padding:18px}',
    'h1{font-size:16px;letter-spacing:-.2px}',
    '.sub{color:#86868b;font-size:12px;margin:4px 0 16px}',
    '.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
    '.kpi{background:#fff;border:1px solid #e6e9ef;border-radius:9px;padding:12px}',
    '.kpi .k{font-size:12px;color:#86868b}',
    '.kpi .v{font-size:16px;font-weight:600;margin-top:4px;letter-spacing:-.4px}',
    '.kpi .d{font-size:12px;margin-top:2px}',
    '.up{color:#d1483f}.down{color:#1a7f44}',
    '.card{background:#fff;border:1px solid #e6e9ef;border-radius:9px;padding:12px}',
    '.card h2{font-size:14px;margin-bottom:12px}',
    '.bars{display:flex;align-items:flex-end;gap:10px;height:120px}',
    '.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}',
    '.bar i{display:block;width:100%;border-radius:4px 4px 0 0;background:#cfe0f6}',
    '.bar.peak i{background:#3b82e0}',
    '.bar span{font-size:12px;color:#86868b}',
    'table{width:100%;border-collapse:collapse;margin-top:12px}',
    'th,td{text-align:left;padding:8px;border-bottom:1px solid #eef1f5;font-size:12px}',
    'th{color:#86868b;font-weight:500;font-size:12px}',
    'td.num{text-align:right;font-variant-numeric:tabular-nums}',
    '.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px}',
    '.tag.bad{background:#fdeceb;color:#d1483f}',
    '.tag.ok{background:#e8f6ed;color:#1a7f44}',
    'footer{margin-top:12px;color:#a1a1a6;font-size:12px}',
    '</style></head><body>',
    '<h1>门店履约异常看板</h1>',
    '<p class="sub">上海虹桥店 · 业务日 2026-07-27 · 数据截至 13:45</p>',
    '<div class="kpis">',
    '  <div class="kpi"><div class="k">超时订单</div><div class="v">128</div>',
    '    <div class="d up">较昨日 +32</div></div>',
    '  <div class="kpi"><div class="k">履约准时率</div><div class="v">93.8%</div>',
    '    <div class="d up">较昨日 -1.6pt</div></div>',
    '  <div class="kpi"><div class="k">平均送达</div><div class="v">34<small>min</small></div>',
    '    <div class="d down">较昨日 -2min</div></div>',
    '</div>',
    '<div class="card">',
    '  <h2>分时段超时单量</h2>',
    '  <div class="bars">',
    // 柱高直接写成百分比：这份文档要能独立打开，不该依赖 JS 现算
    '    <div class="bar"><i style="height:18%"></i><span>11时</span></div>',
    '    <div class="bar"><i style="height:26%"></i><span>13时</span></div>',
    '    <div class="bar"><i style="height:22%"></i><span>15时</span></div>',
    '    <div class="bar peak"><i style="height:86%"></i><span>17时</span></div>',
    '    <div class="bar peak"><i style="height:100%"></i><span>18时</span></div>',
    '    <div class="bar"><i style="height:40%"></i><span>20时</span></div>',
    '  </div>',
    '  <table>',
    '    <thead><tr><th>时段</th><th class="num">超时单</th><th class="num">占比</th><th>判定</th></tr></thead>',
    '    <tbody>',
    '      <tr><td>17:00–18:00</td><td class="num">41</td><td class="num">32.0%</td>',
    '        <td><span class="tag bad">运力缺口</span></td></tr>',
    '      <tr><td>18:00–19:00</td><td class="num">65</td><td class="num">50.8%</td>',
    '        <td><span class="tag bad">运力缺口</span></td></tr>',
    '      <tr><td>其余时段</td><td class="num">22</td><td class="num">17.2%</td>',
    '        <td><span class="tag ok">正常波动</span></td></tr>',
    '    </tbody>',
    '  </table>',
    '</div>',
    '<footer>由 CatPaw 生成 · 该页面为静态产物，可离线打开</footer>',
    '</body></html>',
  ].join('\n');

  const FOLDERS = [
    {
      id: 'default', name: '默认文件夹', scope: null, isDefault: true,
      path: '~/CatPaw/默认文件夹',
      files: [
        { name: '季度经营复盘.pptx', type: 'ppt', artifact: true, preview: { kind: 'ppt' } },
        { name: '门店履约分析.docx', type: 'word', artifact: true },
        { name: '门店履约异常明细.xlsx', type: 'excel', artifact: true },
        {
          name: '门店履约异常看板.html', type: 'html', artifact: true,
          preview: { kind: 'html', html: DEMO_HTML },
        },
        {
          name: '履约异常趋势.png', type: 'png', artifact: true,
          preview: { kind: 'image', art: DEMO_PNG },
        },
        {
          name: '系统文件示例', type: 'folder', system: true,
          files: [
            { name: 'README.md', type: 'code', preview: { kind: 'markdown', text: DEMO_MD } },
            { name: 'index.html', type: 'code', preview: { kind: 'html', html: DEMO_HTML } },
            { name: 'styles.css', type: 'code' },
            { name: 'app.js', type: 'code' },
            { name: 'component.jsx', type: 'code' },
            { name: 'main.ts', type: 'code' },
            { name: 'App.tsx', type: 'code' },
            { name: 'Component.vue', type: 'code' },
            { name: 'Widget.svelte', type: 'code' },
            { name: 'config.json', type: 'code' },
            { name: 'layout.xml', type: 'code' },
            { name: 'pipeline.yaml', type: 'code' },
            { name: 'settings.toml', type: 'code' },
            { name: 'runtime.ini', type: 'code' },
            { name: '.env', type: 'code' },
            { name: '.gitignore', type: 'code' },
            { name: 'Dockerfile', type: 'code' },
            { name: 'query.sql', type: 'code' },
            { name: 'schema.graphql', type: 'code' },
            { name: 'analysis.py', type: 'code' },
            { name: 'Service.java', type: 'code' },
            { name: 'Main.kt', type: 'code' },
            { name: 'server.go', type: 'code' },
            { name: 'lib.rs', type: 'code' },
            { name: 'index.php', type: 'code' },
            { name: 'task.rb', type: 'code' },
            { name: 'View.swift', type: 'code' },
            { name: 'main.c', type: 'code' },
            { name: 'engine.cpp', type: 'code' },
            { name: 'types.h', type: 'code' },
            { name: 'Program.cs', type: 'code' },
            { name: 'deploy.sh', type: 'code' },
            { name: 'logo.svg', type: 'code' },
            { name: 'notes.txt', type: 'code' },
          ],
        },
      ],
    },
    {
      id: 'retail', name: '服务零售', scope: 'office',
      path: '~/CatPaw/服务零售',
      files: [
        { name: 'nocode生成效果文件备份',    type: 'folder' },
        { name: 'CONTEXT-PROMPT.md',        type: 'doc' },
        { name: '医药代表备案推文-产品推广优化稿.docx', type: 'doc' },
        { name: 'case_100.csv',             type: 'sheet' },
        { name: '下载',                      type: 'folder' },
        { name: 'TSStubbingSessions',       type: 'folder' },
        { name: '门店履约异常明细.xlsx',      type: 'sheet' },
        { name: '封面图-终稿.png',           type: 'image' },
      ],
    },
    {
      id: 'reports', name: '经营月报', scope: 'office',
      path: '~/CatPaw/经营月报',
      files: [
        { name: '2026-Q1',                  type: 'folder' },
        { name: '三月份核心指标归因.docx',    type: 'doc' },
        { name: '区域对比明细.xlsx',          type: 'sheet' },
        { name: '人效对比图.png',            type: 'image' },
      ],
    },
    {
      id: 'nocode_fe', name: 'nocode_fe', scope: 'dev',
      repo: 'fe/nocode-web',
      path: '~/Developer/nocode-web',
      files: [
        { name: 'src',                      type: 'folder' },
        { name: 'public',                   type: 'folder' },
        { name: 'index.html',               type: 'code' },
        { name: 'vite.config.ts',           type: 'code' },
        { name: 'package.json',             type: 'code' },
        { name: 'README.md',                type: 'doc' },
        { name: 'preview.png',              type: 'image' },
      ],
      branches: [
        { name: 'main',                   current: true },
        { name: 'develop' },
        { name: 'feature/radius-tokens',  ahead: 3 },
        { name: 'feature/inline-chat',    ahead: 12 },
        { name: 'hotfix/login-refresh',   ahead: 1 },
      ],
    },
    {
      id: 'infra', name: '基建与部署', scope: 'dev',
      repo: 'infra/deploy-pipeline',
      path: '~/Developer/deploy-pipeline',
      files: [
        { name: 'charts',                   type: 'folder' },
        { name: 'scripts',                  type: 'folder' },
        { name: 'Dockerfile',               type: 'code' },
        { name: 'pipeline.yaml',            type: 'code' },
        { name: '灰度发布策略.md',           type: 'doc' },
      ],
      branches: [
        { name: 'main',              current: true },
        { name: 'release/v2.4' },
        { name: 'feature/gray-rollout', ahead: 5 },
      ],
    },
    {
      id: 'mtd_skills', name: 'mtd_skills', scope: 'design',
      path: '~/CatPaw/mtd_skills',
      files: [
        { name: 'components',               type: 'folder' },
        { name: 'SKILL.md',                 type: 'doc' },
        { name: '组件索引.csv',              type: 'sheet' },
      ],
    },
    {
      id: 'brand', name: '品牌视觉', scope: 'design',
      path: '~/CatPaw/品牌视觉',
      files: [
        { name: '主视觉提案',                type: 'folder' },
        { name: 'Logo 使用规范.docx',        type: 'doc' },
        { name: 'KV-节点运营-横版.png',       type: 'image' },
        { name: 'KV-节点运营-竖版.png',       type: 'image' },
        { name: '色板映射表.xlsx',            type: 'sheet' },
      ],
    },
  ];

  /* 拍平后展示全部文件夹，默认文件夹仍恒在首位。 */
  function foldersForScope(scope) {
    if (scope === 'all') return FOLDERS.slice();
    return FOLDERS.filter((f) => f.isDefault || f.scope === scope);
  }

  /* ---------- 1.75 摘要文件列表 ----------
     浮窗展示的始终是输入框下方选中的归属文件夹，不再是写死的工程目录。
     「我把任务存到哪」与「摘要里看到什么」因此指向同一个对象。 */
  const fileGrid = document.getElementById('fileGrid');
  const recentFiles = document.getElementById('recentFiles');
const summaryExpandRecent = document.getElementById('summaryExpandRecent');
const MAX_RECENT_FILES = 12;
const RECENT_VISIBLE_COUNT = 6;
let recentFilesExpanded = false;

  /* 最近记录最多保留 12 条，默认展示前 6 条；展开后展示全部记录。 */
  function seedRecentFiles() {
    const entries = [];
    const visit = (nodes, chain) => {
      (nodes || []).forEach((node) => {
        const nextChain = chain.concat(node);
        if (node.type === 'folder') visit(node.files, nextChain);
        else entries.push({ node, chain: nextChain, opened: '刚刚' });
      });
    };
    FOLDERS.forEach((folder) => visit(folder.files, [folder]));
    return entries.slice(0, MAX_RECENT_FILES);
  }

  let recentOpenedFiles = seedRecentFiles();

  /* 缩略图按类型绘制。不画品牌化的「Word / Excel」标志，
     因为文件可能来自任何工具；改用「纸张 + 内容骨架」这一层抽象，
     让人先认出「这是一篇文档 / 一张表 / 一段代码」，再去读文件名。

     渐变在宫格顶部只定义一次。若写进每个缩略图内部，
     一屏几十个元素就会出现几十个同名 id——HTML 不允许 id 重复。 */
  const GRADIENT_DEFS =
    `<svg class="f-defs" aria-hidden="true">` +
    `<linearGradient id="fgFolder" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#8fd0f7"/><stop offset="1" stop-color="#3c9ae8"/>` +
    `</linearGradient>` +
    `<linearGradient id="fgImage" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#cfe3f5"/><stop offset="1" stop-color="#eadcf0"/>` +
    `</linearGradient>` +
    `</svg>`;

  const THUMBS = {
    /* PPT 缩略图直接绘制首屏封面，让用户在打开前就能辨认内容；不使用参考截图或外链图片。 */
    ppt: () =>
      `<svg class="f-ppt-preview" viewBox="0 0 88 50" aria-hidden="true">` +
      `<defs><linearGradient id="pptCover" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#718b9f"/><stop offset=".42" stop-color="#dce3e8"/>` +
      `<stop offset=".43" stop-color="#314655"/><stop offset="1" stop-color="#101b25"/>` +
      `</linearGradient></defs>` +
      `<rect x=".5" y=".5" width="87" height="49" rx="3" fill="url(#pptCover)" stroke="#d6dae0"/>` +
      `<path d="M54 6h25v16H54z" fill="#12212d" opacity=".86"/>` +
      `<path d="M8 44 43 31l35 13" fill="#18242e" opacity=".76"/>` +
      `<rect x="17" y="18" width="54" height="14" rx="1.5" fill="none" stroke="#77a9f4" stroke-width=".8"/>` +
      `<text x="44" y="23.5" text-anchor="middle" font-size="5.4" font-weight="700" fill="#fff">季度经营复盘</text>` +
      `<text x="44" y="29" text-anchor="middle" font-size="4.6" font-weight="600" fill="#fff">稳增长 · 提效率</text>` +
      `<rect x="4" y="4" width="15" height="7" rx="2" fill="#e86f3c"/>` +
      `<text x="11.5" y="9" text-anchor="middle" font-size="4.2" font-weight="700" fill="#fff">PPT</text>` +
      `</svg>`,
    word: () => productFile('W', '#3478d4', '<path d="M11 20h24M11 25h24M11 30h17"/>'),
    excel: () => productFile('X', '#2d9b62', '<path d="M11 19h24v16H11zM11 24h24M11 29h24M19 19v16M27 19v16"/>'),
    html: () => productFile('HTML', '#e76f3c', '<path d="m17 22-5 5 5 5M29 22l5 5-5 5M26 18l-6 18"/>'),
    png: () =>
      `<svg class="f-img" viewBox="0 0 56 44" aria-hidden="true">` +
      `<rect width="56" height="44" rx="4" fill="url(#fgImage)"/>` +
      `<circle cx="42" cy="12" r="5" fill="#fff" opacity=".75"/>` +
      `<path d="M0 44l17-17 11 11 9-8 19 14z" fill="#93b8d8" opacity=".85"/>` +
      `<rect x="4" y="4" width="20" height="10" rx="3" fill="#fff" opacity=".9"/>` +
      `<text x="14" y="11.5" text-anchor="middle" font-size="7" font-weight="700" fill="#667085">PNG</text>` +
      `</svg>`,

    folder: () =>
      `<svg class="f-folder" viewBox="0 0 58 46" aria-hidden="true">` +
      // 后层：露出顶部一条，做出「一沓」的厚度
      `<path d="M2 8a4 4 0 0 1 4-4h14l5 5h27a4 4 0 0 1 4 4v5H2z" fill="#6fbdf0"/>` +
      // 前层：主体
      `<rect x="2" y="11" width="54" height="33" rx="4" fill="url(#fgFolder)"/>` +
      `</svg>`,

    doc: () =>
      page(
        // 首行加深当标题，其余是正文；每三行短一截，模拟段落收尾
        `<rect class="f-line accent" x="8" y="14" width="22" height="2.4" rx="1.2"/>` +
        [20, 25, 30, 35, 40, 45].map((y, i) =>
          `<rect class="f-line" x="8" y="${y}" width="${i % 3 === 2 ? 20 : 30}" height="1.8" rx=".9"/>`
        ).join('')
      ),

    sheet: () =>
      page(
        `<rect class="f-cell head" x="8" y="14" width="30" height="6" rx="1"/>` +
        [22, 30, 38, 46].map((y) =>
          `<rect class="f-cell" x="8" y="${y}" width="30" height="6" rx="1"/>`
        ).join('') +
        // 两道白缝把色带切成三列，否则只会被读成堆叠的段落
        `<rect x="17.5" y="14" width="1.2" height="38" fill="#fff"/>` +
        `<rect x="27.5" y="14" width="1.2" height="38" fill="#fff"/>`
      ),

    code: () =>
      page(
        // 缩进错落是代码区别于正文的唯一线索，行宽必须不齐
        [[8, 14, 14], [12, 19, 18], [12, 24, 12], [8, 29, 20], [12, 34, 16], [8, 39, 10]]
          .map(([x, y, w], i) =>
            `<rect class="f-code${i % 3 === 0 ? ' accent' : ''}" x="${x}" y="${y}" width="${w}" height="2.2" rx="1.1"/>`
          ).join('')
      ),

    image: () =>
      `<svg class="f-img" viewBox="0 0 56 44" aria-hidden="true">` +
      `<rect width="56" height="44" rx="3" fill="url(#fgImage)"/>` +
      // 远山 + 太阳：比相机图标更接近「一张真实缩略图」的样子
      `<circle cx="42" cy="12" r="5" fill="#fff" opacity=".75"/>` +
      `<path d="M0 44l17-17 11 11 9-8 19 14z" fill="#93b8d8" opacity=".85"/>` +
      `</svg>`,
  };

  function productFile(label, color, inner) {
    return `<svg class="f-product" viewBox="0 0 46 58" aria-hidden="true">` +
      `<path d="M2 4a3 3 0 0 1 3-3h22l17 16.5V54a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#fff" stroke="#dcdce2"/>` +
      `<path d="M27 1l17 16.5H30a3 3 0 0 1-3-3z" fill="#ececed"/>` +
      `<rect x="6" y="8" width="${label.length > 2 ? 21 : 15}" height="8" rx="2" fill="${color}"/>` +
      `<text x="${label.length > 2 ? 16.5 : 13.5}" y="14" text-anchor="middle" font-size="5.8" font-weight="700" fill="#fff">${label}</text>` +
      `<g fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</g>` +
      `</svg>`;
  }

  /* 所有纸张类共用同一张页面底板，只有内部骨架不同。
     右上角切角是「纸」的通用符号，缺了它就只是个白方块。 */
  function page(inner) {
    return (
      `<svg class="f-page" viewBox="0 0 46 58" aria-hidden="true">` +
      `<path d="M2 4a3 3 0 0 1 3-3h22l17 16.5V54a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z"` +
      ` fill="#fff" stroke="#dcdce2" stroke-width="1"/>` +
      // 折角：用比页面略深的灰填充，做出翻起的一角
      `<path d="M27 1l17 16.5H30a3 3 0 0 1-3-3z" fill="#ececed"/>` +
      inner +
      `</svg>`
    );
  }

  /* 摘要只展示当前归属文件夹的首层产物；路径数组继续用于把点击条目
     交给工具工作区时保留完整来源链。 */
  let filePath = [];

  function currentNode() {
    return filePath[filePath.length - 1] || null;
  }

  function rememberRecentFile(node, chain) {
    if (!node || node.type === 'folder') return;
    recentOpenedFiles = recentOpenedFiles.filter((entry) => entry.node !== node);
    recentOpenedFiles.unshift({ node, chain: chain.slice(), opened: '刚刚' });
    recentOpenedFiles = recentOpenedFiles.slice(0, MAX_RECENT_FILES);
    renderRecentFiles();
  }

  function renderRecentFiles() {
    if (!recentOpenedFiles.length) {
      recentFiles.innerHTML = '<p class="recent-empty">还没有打开过文件</p>';
      summaryExpandRecent.hidden = true;
      return;
    }
    const visibleCount = recentFilesExpanded ? MAX_RECENT_FILES : RECENT_VISIBLE_COUNT;
    const visibleFiles = recentOpenedFiles.slice(0, visibleCount);
    recentFiles.innerHTML = GRADIENT_DEFS + visibleFiles.map((entry, index) => {
      const type = artifactType(entry.node);
      const thumb = (THUMBS[type] || THUMBS.doc)();
      return `<button class="fitem recent-file" type="button" data-recent-index="${index}"` +
        ` data-file-type="${type || 'file'}" title="${esc(entry.node.name)}">` +
        `<span class="fthumb">${thumb}</span>` +
        `<span class="fname">${esc(entry.node.name)}</span>` +
        `</button>`;
    }).join('');
    summaryExpandRecent.hidden = recentOpenedFiles.length <= RECENT_VISIBLE_COUNT;
    summaryExpandRecent.textContent = recentFilesExpanded ? '收起' : '展开更多';
    summaryExpandRecent.setAttribute('aria-expanded', String(recentFilesExpanded));
  }

  function artifactType(node) {
    const name = String(node?.name || '').toLowerCase();
    if (/\.pptx?$/.test(name)) return 'ppt';
    if (/\.docx?$/.test(name)) return 'word';
    if (/\.xlsx?$/.test(name)) return 'excel';
    if (/\.html?$/.test(name)) return 'html';
    if (/\.png$/.test(name)) return 'png';
    return null;
  }

  function isArtifactNode(node) {
    return Boolean(artifactType(node));
  }

  function renderFileGrid(folder) {
    const files = (folder.files || [])
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => isArtifactNode(f));
    if (!files.length) {
      fileGrid.innerHTML = `<p class="file-empty">这个文件夹还是空的</p>`;
      return;
    }

    /* 文件夹排在文件前面，与 Finder 的默认排序一致。
       排序会打乱与原数组的对应关系，故先把原下标绑在每一项上，
       再写进 data-file-index 供点击时回查。
       sort 用的是稳定排序，同类项之间维持原有次序。 */
    const sorted = files;

    fileGrid.innerHTML = GRADIENT_DEFS + sorted
      .map(({ f, i }) => {
        const type = artifactType(f);
        const thumb = (THUMBS[type] || THUMBS.doc)();
        return (
          `<button class="fitem" data-file-type="${type}"` +
          ` data-file-index="${i}" title="${f.name}">` +
          `<span class="fthumb">${thumb}</span>` +
          `<span class="fname">${f.name}</span>` +
          `</button>`
        );
      })
      .join('');
  }

  /* -- 预览 --
     三种渲染器共用同一个容器，由 preview.kind 分派。
     容器与宫格互斥：同一时刻面板里只有一样东西，
     不做「左边列表右边预览」的双栏——460px 宽分成两半后两边都不好用。

     所有内容都是本地字符串，没有一次网络请求。
     这是「打包发给别人也能正常显示」的前提：一旦改成 fetch 外部文件，
     file:// 协议下会被同源策略拦掉，对方双击打开只会看到空白。 */

  /* 文本插进 HTML 前一律先过这里。
     示例数据是我们自己写的，但渲染器不该对输入做这种假设——
     将来接上真实文件后，文件名与正文都来自外部。 */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* 极简 Markdown → HTML。
     只认这份原型用得上的语法：标题、列表、引用、代码块、行内强调、分隔线。
     不引第三方库是刻意的：引一个就意味着多一个外部文件，
     整份原型也就不再是「三个文件、双击即开」。

     逐行扫描而非一次性正则替换：列表与代码块是跨行的结构，
     需要记住「上一行属于哪个块」，单行正则表达不了这种状态。 */
  function renderMarkdown(src) {
    const lines = String(src).split('\n');
    const out = [];
    let listType = null;    // 当前是否在 ul / ol 里
    let inCode = false;     // 当前是否在 ``` 围栏内
    let codeBuf = [];

    // 行内标记在最后统一处理：强调与代码片段不跨行，无需状态
    const inline = (t) =>
      esc(t)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+?)`/g, '<code>$1</code>');

    const closeList = () => {
      if (listType) { out.push(`</${listType}>`); listType = null; }
    };
    const openList = (type) => {
      if (listType !== type) { closeList(); out.push(`<${type}>`); listType = type; }
    };

    lines.forEach((raw) => {
      const line = raw.replace(/\s+$/, '');

      // 代码围栏优先：栏内的 # 与 - 是代码，不是标题和列表
      if (/^```/.test(line)) {
        if (inCode) {
          out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        return;
      }
      if (inCode) { codeBuf.push(raw); return; }

      if (!line) { closeList(); return; }

      if (/^---+$/.test(line)) { closeList(); out.push('<hr>'); return; }

      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeList();
        const lv = h[1].length;
        out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
        return;
      }

      if (/^>\s?/.test(line)) {
        closeList();
        out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
        return;
      }

      const ul = line.match(/^[-*]\s+(.*)$/);
      if (ul) { openList('ul'); out.push(`<li>${inline(ul[1])}</li>`); return; }

      const ol = line.match(/^\d+\.\s+(.*)$/);
      if (ol) { openList('ol'); out.push(`<li>${inline(ol[1])}</li>`); return; }

      closeList();
      out.push(`<p>${inline(line)}</p>`);
    });

    // 文档可能以未闭合的列表或围栏结尾，收尾时补上
    closeList();
    if (inCode && codeBuf.length) {
      out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
    }
    return out.join('\n');
  }

  const PREVIEWS = {
    /* PPT：参考桌面演示文稿编辑器，直接展示可辨认的编辑态，而不是文件占位。 */
    ppt: () => `<div class="pv-ppt" aria-label="季度经营复盘演示文稿预览">
      <header class="ppt-appbar">
        <span class="ppt-traffic"><i></i><i></i><i></i></span>
        <span class="ppt-app-icon">P</span>
        <strong>季度经营复盘</strong>
        <span class="ppt-app-name">演示文稿</span>
        <em>已保存</em>
        <span class="ppt-app-actions">播放　分享　下载　•••</span>
      </header>
      <nav class="ppt-ribbon" aria-label="演示文稿工具栏">
        <span>开始</span><span>插入</span><span>设计</span><span>切换</span><span>动画</span><span>放映</span><span>审阅</span><span>视图</span>
        <b>格式</b>
      </nav>
      <div class="ppt-editor">
        <aside class="ppt-slides" aria-label="幻灯片缩略图">
          <button class="ppt-thumb active"><i>1</i><span class="ppt-thumb-cover"><b>季度经营复盘</b><small>2026 Q3</small></span></button>
          <button class="ppt-thumb"><i>2</i><span><b>核心经营指标</b><small class="ppt-mini-kpis">18.4%　92.6%</small></span></button>
          <button class="ppt-thumb"><i>3</i><span><b>区域业绩表现</b><small class="ppt-mini-chart"></small></span></button>
          <button class="ppt-thumb"><i>4</i><span><b>门店优秀案例</b><small class="ppt-mini-cards"></small></span></button>
          <button class="ppt-thumb"><i>5</i><span><b>下一步行动</b><small>聚焦增长 · 提升履约</small></span></button>
        </aside>
        <main class="ppt-workspace">
          <div class="ppt-formatbar"><b>AI 排版</b><span>B</span><i>I</i><u>U</u><span>24</span><span>思源黑体</span><span>↕</span><span>≡</span><span>•••</span></div>
          <article class="ppt-slide">
            <div class="ppt-cover-visual"><span class="ppt-screen"></span><span class="ppt-keyboard"></span></div>
            <div class="ppt-title-selection"><i></i><i></i><i></i><i></i><h1>季度经营复盘<br><strong>稳增长 · 提效率</strong></h1></div>
            <p>服务零售事业部　·　2026 Q3</p>
            <small>CATPAW GENERATED</small>
          </article>
          <div class="ppt-notes"><b>备注</b><span>本季度核心指标保持稳健增长，履约效率和门店经营质量持续改善。</span></div>
        </main>
      </div>
      <footer class="ppt-status"><span>幻灯片 1 / 5　　简体中文</span><span>▦　▤　　−　 72%　＋</span></footer>
    </div>`,

    /* 文档：渲染成排版后的富文本，而不是显示源码。
       用户要的是「这篇文档写了什么」，不是「它的标记长什么样」。 */
    markdown: (p) => `<article class="md">${renderMarkdown(p.text)}</article>`,

    /* 图片：居中、留出周边留白，并压在浅色棋盘格上。
       棋盘格是图像工具里表达「这块是透明的」的通用符号，
       顺带也把图片的边界从白色面板里划了出来。 */
    image: (p) => `<div class="pv-image">${p.art}</div>`,

    /* 网页：srcdoc 而非 src。
       src 要指向一个真实 URL，在 file:// 下会撞上同源策略；
       srcdoc 是把整份文档作为字符串交给 iframe，不涉及任何请求，
       因此本地双击打开也能正常渲染。

       sandbox 留空值：默认即禁用脚本、表单与顶层跳转。
       预览是「看一眼产物」，不该让这份文档反过来操纵宿主页面。 */
    html: (p) =>
      `<iframe class="pv-frame" sandbox srcdoc="${esc(p.html).replace(/"/g, '&quot;')}"` +
      ` title="网页预览"></iframe>`,
  };

  /* 没有 preview 数据的文件：给一句说明，而不是留白。
     空白会被读成「加载失败」，而这里的事实是「这类文件还没接渲染器」。 */
  function previewFallback(node) {
    return (
      `<div class="pv-empty">` +
      `<svg viewBox="0 0 24 24" class="pv-empty-ic">` +
      `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>` +
      `<path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>` +
      `<p class="pv-empty-title">${esc(node.name)}</p>` +
      `<p class="pv-empty-desc">这类文件的预览还没接上，可先在系统中打开</p>` +
      `</div>`
    );
  }

function renderSummaryContents() {
const hasActiveTask = document.querySelector('.main')?.classList.contains('conversation-open');
const folder = currentNode();
if (!hasActiveTask) fileGrid.innerHTML = '<p class="summary-empty">无</p>';
else if (folder) renderFileGrid(folder);
renderRecentFiles();
}

  /* 换了归属文件夹就是换了一棵树，层级栈必须重置到根。
     不重置的话，面板会停在上一个文件夹的子目录里，
     而那个节点已经不属于当前选中的树了。 */
  function resetFilePane() {
    const folder = FOLDERS.find((f) => f.id === folderByScope[currentScope]);
    if (!folder) return;
    filePath = [folder];
    renderSummaryContents();
  }

  /* ---------- 1.8 归属文件夹选择器 ---------- */
  const folderPicker  = document.getElementById('folderPicker');
  const folderBtn     = document.getElementById('folderBtn');
  const folderBtnName = document.getElementById('folderBtnName');
  const folderMenu    = document.getElementById('folderMenu');

  // 拍平后的通用列表共享一份文件夹选择状态
  const folderByScope = { all: 'default' };

  function setFolderOpen(open) {
    folderPicker.classList.toggle('open', open);
    folderBtn.setAttribute('aria-expanded', String(open));
  }

  function selectFolder(id) {
    folderByScope[currentScope] = id;
    renderFolderPicker(currentScope);
    // 换了文件夹就换了仓库，分支控件需跟着重算显隐与选项
    renderBranchPicker();
    // 换了树，回到新树的根
    resetFilePane();
    if (typeof renderToolTree === 'function') {
      toolTreeExpanded.clear();
      toolTreeExpanded.add('root');
      renderToolTree();
    }
    setFolderOpen(false);
  }

  /* 重建选项列表并同步按钮文案；选中项失效时回落到默认文件夹。 */
  function renderFolderPicker(scope) {
    const list = foldersForScope(scope);
    let activeId = folderByScope[scope];
    if (!list.some((f) => f.id === activeId)) {
      activeId = 'default';
      folderByScope[scope] = activeId;
    }

    folderBtnName.textContent = list.find((f) => f.id === activeId).name;

    folderMenu.innerHTML =
      list
        .map(
          (f, i) =>
            `<button class="folder-opt${f.id === activeId ? ' active' : ''}"` +
            ` role="option" aria-selected="${f.id === activeId}"` +
            ` data-folder-id="${f.id}"${f.isDefault && i === 0 ? ' data-divider' : ''}>` +
            `<svg viewBox="0 0 24 24" class="ic"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>` +
            `<span class="folder-opt-name">${f.name}</span>` +
            `<svg viewBox="0 0 24 24" class="ic tick"><path d="M20 6 9 17l-5-5"/></svg>` +
            `</button>`
        )
        .join('') +
      /* 列表之外的两个出口：
         「选择文件夹」通向系统目录，用于把外部已有目录纳入进来；
         「新建文件夹」就地造一个新的。
         两者都不是「选中某项」，故与上方列表用分隔线断开，且不参与选中态。
         具体交互后续再补。 */
      `<div class="folder-menu-foot">` +
      `<button class="folder-act" data-folder-act="pick">` +
      `<svg viewBox="0 0 24 24" class="ic"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="m9 13 3 3 3-3"/></svg>` +
      `<span>选择文件夹…</span>` +
      `</button>` +
      `<button class="folder-act" data-folder-act="create">` +
      `<svg viewBox="0 0 24 24" class="ic"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M9 13h6"/><path d="M12 10v6"/></svg>` +
      `<span>新建文件夹</span>` +
      `</button>` +
      `</div>`;
  }

  folderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setBranchOpen(false);
    setFolderOpen(!folderPicker.classList.contains('open'));
  });

  folderMenu.addEventListener('click', (e) => {
    const opt = e.target.closest('.folder-opt');
    if (!opt) return;
    e.stopPropagation();
    selectFolder(opt.dataset.folderId);
  });

  document.addEventListener('click', (e) => {
    if (!folderPicker.contains(e.target)) setFolderOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setFolderOpen(false);
  });

  /* ---------- 1.9 分支选择器 ----------
     只有关联了代码仓库的文件夹才有分支概念，因此这个控件随归属文件夹出现或消失。
     分支属于仓库而非场景，故按文件夹 id 记忆，切走再切回仍停在原分支。 */
  const branchPicker  = document.getElementById('branchPicker');
  const branchBtn     = document.getElementById('branchBtn');
  const branchBtnName = document.getElementById('branchBtnName');
  const branchMenu    = document.getElementById('branchMenu');

  const branchByFolder = {};   // { 文件夹 id: 分支名 }

  function setBranchOpen(open) {
    branchPicker.classList.toggle('open', open);
    branchBtn.setAttribute('aria-expanded', String(open));
  }

  function selectBranch(name) {
    branchByFolder[folderByScope[currentScope]] = name;
    renderBranchPicker();
    setBranchOpen(false);
  }

  /* 依据当前选中的文件夹决定显隐与选项 */
  function renderBranchPicker() {
    const folder = FOLDERS.find((f) => f.id === folderByScope[currentScope]);
    const branches = folder && folder.branches;

    // 没有仓库就整个控件收起，而不是留一个空的禁用按钮占位
    if (!branches || !branches.length) {
      branchPicker.hidden = true;
      setBranchOpen(false);
      return;
    }
    branchPicker.hidden = false;

    // 首次进入该文件夹时落在仓库的当前分支上
    let active = branchByFolder[folder.id];
    if (!branches.some((b) => b.name === active)) {
      active = (branches.find((b) => b.current) || branches[0]).name;
      branchByFolder[folder.id] = active;
    }

    branchBtnName.textContent = active;

    branchMenu.innerHTML =
      `<div class="branch-menu-head">${folder.repo}</div>` +
      branches
        .map((b) => {
          // current 标记仓库自身的默认分支，ahead 提示相对主干的领先提交数
          const meta = b.current
            ? '<span class="branch-meta">默认</span>'
            : b.ahead
            ? `<span class="branch-meta">+${b.ahead}</span>`
            : '';
          return (
            `<button class="branch-opt${b.name === active ? ' active' : ''}"` +
            ` role="option" aria-selected="${b.name === active}" data-branch="${b.name}">` +
            `<svg viewBox="0 0 24 24" class="ic"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>` +
            `<span class="branch-opt-name">${b.name}</span>` +
            meta +
            `<svg viewBox="0 0 24 24" class="ic tick"><path d="M20 6 9 17l-5-5"/></svg>` +
            `</button>`
          );
        })
        .join('');
  }

  branchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setFolderOpen(false);
    setBranchOpen(!branchPicker.classList.contains('open'));
  });

  branchMenu.addEventListener('click', (e) => {
    const opt = e.target.closest('.branch-opt');
    if (!opt) return;
    e.stopPropagation();
    selectBranch(opt.dataset.branch);
  });

  document.addEventListener('click', (e) => {
    if (!branchPicker.contains(e.target)) setBranchOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setBranchOpen(false);
  });

  // 场景筛选已移除；统一作用域用于共享文件夹选择状态。
  let currentScope = 'all';
  // 当前一级 Prompt 分类；切换分类时保留，让推荐案例继续围绕用户意图。
  let selectedPromptCategory = null;

  function initializeFlatSidebar() {
    tasksExpanded = false;
    renderTasks();
    renderGroups();
    renderFolderPicker(currentScope);
    renderBranchPicker();
    resetFilePane();
    renderCases(currentScope);
    setFolderOpen(false);
    setBranchOpen(false);
    refreshClipped();
  }

  initializeFlatSidebar();

  /* ---------- 2. 分组折叠 ----------
     使用 0fr → 1fr 的网格轨道过渡，避免读取 scrollHeight 和强制回流。
     内容高度发生变化时由浏览器直接插值，连续点击也不会卡在中间高度。 */
  document.querySelectorAll('[data-group]').forEach((group) => {
    const head = group.querySelector('[data-toggle-group]');
    const body = group.querySelector('.group-body');
    const inner = document.createElement('div');
    inner.className = 'group-body-inner';
    while (body.firstChild) inner.appendChild(body.firstChild);
    body.appendChild(inner);
    head.setAttribute('aria-expanded', String(!group.classList.contains('folded')));

    head.addEventListener('click', () => {
      const folded = group.classList.toggle('folded');
      head.setAttribute('aria-expanded', String(!folded));
      requestAnimationFrame(refreshClipped);
    });
  });

  /* ---------- 3. 展开显示 / 收起 ----------
     附加任务自身也采用网格轨道动画；收起时内容不会先消失再留下空白。 */
  document.querySelectorAll('[data-expand]').forEach((btn) => {
    const wrap = btn.parentElement.querySelector('[data-more]');
    if (!wrap) return;
    const inner = document.createElement('div');
    inner.className = 'more-wrap-inner';
    while (wrap.firstChild) inner.appendChild(wrap.firstChild);
    wrap.appendChild(inner);
    btn.setAttribute('aria-expanded', String(!wrap.classList.contains('hidden')));

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = wrap.classList.toggle('hidden');
      btn.textContent = hidden ? '展开' : '收起';
      btn.setAttribute('aria-expanded', String(!hidden));
      requestAnimationFrame(refreshClipped);
    });
  });

  /* ---------- 3.5 任务名溢出检测 ----------
     只给真正被裁切的文本加右侧渐隐；未溢出的保持完整收尾。
     容差 1px 用于规避亚像素导致的误判。 */
  function refreshClipped() {
    document.querySelectorAll('.task-name').forEach((el) => {
      el.classList.toggle('is-clipped', el.scrollWidth - el.clientWidth > 1);
    });
  }

  // 字体异步加载完成后宽度会变，需重算
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshClipped);
  }
  window.addEventListener('resize', refreshClipped);

  /* ---------- 3.6 行内悬停操作 ----------
     任务 hover → 三点；文件夹 hover → 新建任务 + 三点。
     显隐与位置全交给 CSS，这里只负责注入结构与接管点击。

     任务是 <a>，HTML 不允许在链接里再嵌按钮，因此操作用
     span[role=button] 而非 <button>，避免落到非法的嵌套结构上。 */
  const DOTS_SVG =
    '<svg viewBox="0 0 24 24" class="ic dots"><circle cx="12" cy="12" r="1.6"/>' +
    '<circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="12" r="1.6"/></svg>';
  const PLUS_SVG =
    '<svg viewBox="0 0 24 24" class="ic"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

  function makeAct(action, label, svg) {
    return (
      `<span class="row-act" role="button" tabindex="0"` +
      ` data-act="${action}" title="${label}" aria-label="${label}">${svg}</span>`
    );
  }

  /* 任务：只有一个「更多」出口，点开是下面那张菜单 */
  document.querySelectorAll('.task').forEach((task) => {
    const acts = document.createElement('span');
    acts.className = 'row-acts';
    acts.innerHTML = makeAct('task-more', '更多', DOTS_SVG);
    task.appendChild(acts);
  });

  /* 文件夹：「更多」在右，「新建任务」在其左。
     高频动作靠近内容、低频的管理动作压在最外侧边缘。 */
  document.querySelectorAll('.group-head').forEach((head) => {
    const acts = document.createElement('span');
    acts.className = 'row-acts';
    acts.innerHTML =
      makeAct('folder-new-task', '新建任务', PLUS_SVG) +
      makeAct('folder-more', '更多', DOTS_SVG);
    head.appendChild(acts);
  });

  /* -- 三点菜单 --
     挂在 <body> 下并用 fixed 定位，而不是塞进任务行里。
     侧边栏的滚动容器设了 overflow，菜单若是行的子节点，
     超出容器的部分会被直接裁掉——列表底部那几行的菜单将只剩上半截。

     全局只建一个菜单实例：内容对每一行都一样，
     差别只在「作用于谁」，这一点由 menuRow 单独记着即可。 */
  const TASK_MENU = [
    // 置顶与「在文件夹显示」都是定位类动作，排在前面
    { act: 'pin',    label: '置顶',
      svg: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' },
    { act: 'reveal', label: '在文件夹显示',
      svg: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' },
    // 重命名与删除是改变任务本身的动作，与上两项分栏
    { act: 'rename', label: '重命名', divider: true,
      svg: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>' },
    // 删除标红：它不可撤销，需要在按下之前就与其余项区分开
    { act: 'delete', label: '删除任务', danger: true,
      svg: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' },
  ];

  const rowMenu = document.createElement('div');
  rowMenu.className = 'row-menu';
  rowMenu.setAttribute('role', 'menu');
  rowMenu.hidden = true;
  rowMenu.innerHTML = TASK_MENU.map((m) =>
    `<button class="row-menu-item${m.danger ? ' danger' : ''}"` +
    ` role="menuitem" data-menu-act="${m.act}"${m.divider ? ' data-divider' : ''}>` +
    `<svg viewBox="0 0 24 24" class="ic">${m.svg}</svg>` +
    `<span>${m.label}</span>` +
    `</button>`
  ).join('');
  document.body.appendChild(rowMenu);

  // 菜单当前作用于哪一行。关掉时置空，避免拿着一个已失效的引用
  let menuRow = null;

  function closeRowMenu() {
    if (rowMenu.hidden) return;
    rowMenu.classList.remove('open');
    rowMenu.hidden = true;
    // 触发行的驻留高亮跟着撤掉
    if (menuRow) menuRow.classList.remove('menu-open');
    menuRow = null;
  }

  /* 菜单锚在三点按钮下方，右缘对齐按钮右缘。
     先放出来再量：hidden 的元素量不到尺寸，拿到的会是 0，
     贴边判断因此永远不成立。量完再放开 visibility，不会看到中间态。 */
  function openRowMenu(actBtn, row) {
    menuRow = row;
    row.classList.add('menu-open');

    rowMenu.hidden = false;
    rowMenu.style.visibility = 'hidden';
    rowMenu.style.left = '0px';
    rowMenu.style.top  = '0px';
    /* 入场动画的 scale(.97) 也会作用在测量结果上——量到的宽高比实际
       小 3%，右对齐会因此偏出几个像素。测量期间先抹平，量完再交还给 CSS。 */
    rowMenu.style.transform = 'none';

    const btn = actBtn.getBoundingClientRect();
    const menu = rowMenu.getBoundingClientRect();
    const M = 8;   // 与视口边缘至少留这么多

    // 右缘对齐触发按钮；左侧装不下时改为左对齐，始终贴着触发点
    let left = btn.right - menu.width;
    if (left < M) left = btn.left;
    left = Math.min(left, window.innerWidth - menu.width - M);
    left = Math.max(M, left);

    // 默认向下展开；下方装不下就翻到按钮上方，而不是让菜单顶出视口
    let top = btn.bottom + 4;
    if (top + menu.height > window.innerHeight - M) {
      top = btn.top - menu.height - 4;
    }
    top = Math.max(M, top);

    rowMenu.style.left = `${Math.round(left)}px`;
    rowMenu.style.top  = `${Math.round(top)}px`;
    // 把 transform 交还给 CSS，菜单回到起始的收拢态
    rowMenu.style.transform = '';
    rowMenu.style.visibility = '';
    // 下一帧再加 open：起止状态落在同一帧的话过渡不会发生
    requestAnimationFrame(() => rowMenu.classList.add('open'));
  }

  /* 统一在容器上接管：操作按钮位于任务链接与文件夹折叠区之内，
     必须拦住冒泡，否则点三点会顺带触发「打开任务 / 折叠文件夹」。 */
  function handleRowAct(e) {
    const act = e.target.closest('.row-act');
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();

    const row = act.closest('.task, .group-head');

    if (act.dataset.act === 'task-more') {
      // 再点一次已展开的那行即收起，与绝大多数菜单的行为一致
      if (menuRow === row) { closeRowMenu(); return; }
      closeRowMenu();
      openRowMenu(act, row);
      return;
    }

    closeRowMenu();
    const name = row
      ? (row.querySelector('.task-name, .group-name') || {}).textContent
      : '';
    console.log('[CatPaw] 行内操作：', act.dataset.act, '→', name);
  }

  rowMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.row-menu-item');
    if (!item) return;
    const name = menuRow
      ? (menuRow.querySelector('.task-name') || {}).textContent
      : '';
    console.log('[CatPaw] 任务菜单：', item.dataset.menuAct, '→', name);
    closeRowMenu();
  });

  /* 点别处关闭。走捕获阶段：handleRowAct 会 stopPropagation，
     冒泡阶段的监听收不到那次点击，从一行切到另一行时旧菜单就关不掉。 */
  document.addEventListener('mousedown', (e) => {
    if (rowMenu.contains(e.target) || e.target.closest('.row-act')) return;
    closeRowMenu();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRowMenu();
  });

  /* 菜单是 fixed 定位的，一滚动就会脱离它所属的那一行。
     与其追着重算位置，不如直接关掉——滚动本身就意味着离开了当前上下文。
     捕获阶段监听，否则滚的是侧边栏内部容器时收不到事件。 */
  window.addEventListener('scroll', closeRowMenu, true);
  window.addEventListener('resize', closeRowMenu);

  const sidebarEl = document.getElementById('sidebar');

  sidebarEl.addEventListener('click', handleRowAct);

  // span[role=button] 不自带键盘语义，需显式补 Enter / Space
  sidebarEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('.row-act')) return;
    handleRowAct(e);
  });

  /* ---------- 4. 输入框：自适应高度 + 焦点态 + 发送态 ---------- */
  const prompt = document.getElementById('prompt');
  const card = document.getElementById('composerCard');
  const sendBtn = document.getElementById('sendBtn');
  const promptChip = document.getElementById('promptChip');
  const promptChipText = document.getElementById('promptChipText');
  const promptChipClear = document.getElementById('promptChipClear');
  const promptChipSourceIcon = document.getElementById('promptChipSourceIcon');
  let promptGuide = '';

  function autoResize() {
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 200) + 'px';
  }

  function refreshSendState() {
    sendBtn.disabled = prompt.value.trim().length === 0 && !promptGuide;
  }

  function setPromptGuide(text = '', label = text, iconMarkup = '') {
    promptGuide = text;
    promptChipText.textContent = label;
    promptChipSourceIcon.innerHTML = iconMarkup;
    promptChip.hidden = !text;
    refreshSendState();
  }

  prompt.addEventListener('input', () => {
    autoResize();
    refreshSendState();
  });

  // Enter 发送，Shift+Enter 换行
  prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });

  sendBtn.addEventListener('click', submit);

  function submit() {
    const text = prompt.value.trim();
    if (!text && !promptGuide) return;
    console.log('[CatPaw] 提交需求：', `${promptGuide}${text}`);
    prompt.value = '';
    setPromptGuide('');
    autoResize();
    refreshSendState();
  }

  /* 点击主区空白处聚焦输入框 */
  card.addEventListener('click', (e) => {
    if (e.target === card) prompt.focus();
  });

  /* ---------- 5. 两级 Prompt 推荐 ---------- */
  const primaryPrompts = document.getElementById('primaryPrompts');
  const primaryPromptButtons = Array.from(primaryPrompts.querySelectorAll('.pill'));
  const secondaryPrompts = document.getElementById('secondaryPrompts');
  const casesEl = document.getElementById('cases');

  function updatePromptScrollEdges(row) {
    const maxScroll = row.scrollWidth - row.clientWidth;
    row.classList.toggle('can-scroll-left', row.scrollLeft > 1);
    row.classList.toggle('can-scroll-right', maxScroll > 1 && row.scrollLeft < maxScroll - 1);
  }

  [primaryPrompts, secondaryPrompts].forEach((row) => {
    row.addEventListener('scroll', () => updatePromptScrollEdges(row), { passive: true });
    row.addEventListener('wheel', (event) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const maxScroll = row.scrollWidth - row.clientWidth;
      if (maxScroll <= 1 || (delta < 0 && row.scrollLeft <= 0) ||
          (delta > 0 && row.scrollLeft >= maxScroll - 1)) return;
      event.preventDefault();
      row.scrollBy({ left: delta, behavior: 'smooth' });
    }, { passive: false });
    row.addEventListener('focusin', (event) => {
      if (event.target.matches('button')) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  });
  const promptRowsResizeObserver = new ResizeObserver(() => {
    updatePromptScrollEdges(primaryPrompts);
    updatePromptScrollEdges(secondaryPrompts);
  });
  promptRowsResizeObserver.observe(primaryPrompts);
  promptRowsResizeObserver.observe(secondaryPrompts);
  requestAnimationFrame(() => updatePromptScrollEdges(primaryPrompts));
  let promptTransitionTimer = null;
  let caseTransitionTimer = null;

  function promptCategoryData() {
    return {
      dashboard: {
        guide: '帮我创建数据看板：',
        tag: '数据看板',
        secondary: [
          '创建销售业绩数据看板',
          '创建营销投放效果看板',
          '创建项目进度与风险看板',
          '创建用户增长分析看板',
          '创建财务收支与预算看板',
        ],
        cases: [
          { kind: 'dashboard', type: '销售看板', title: '全国销售业绩驾驶舱', prompt: '汇总全国各区域销售额、目标达成率、同比增长和重点商品表现，制作支持区域与时间筛选的销售业绩看板。' },
          { kind: 'dashboard', type: '营销看板', title: '全渠道投放效果看板', prompt: '整合各营销渠道的曝光、点击、转化和投入产出数据，制作可对比渠道效果与趋势的营销投放看板。' },
          { kind: 'dashboard', type: '项目看板', title: '重点项目风险监控台', prompt: '按项目展示里程碑进度、资源投入、延期风险和待解决事项，制作项目进度与风险看板。' },
          { kind: 'dashboard', type: '增长看板', title: '用户增长分析中心', prompt: '围绕新增、活跃、留存、转化和用户分层制作增长分析看板，并突出关键变化与异常。' },
        ],
      },
      files: {
        guide: '帮我整理文件：',
        tag: '整理文件',
        secondary: ['按项目归档工作文件', '批量规范文件命名', '整理会议材料与纪要', '清理重复和过期文件', '生成文件目录与摘要'],
        cases: [
          { kind: 'article', type: '文件清单', title: '季度项目资料归档', prompt: '按项目、季度和文件类型整理现有资料，统一命名并输出清晰的归档目录与文件清单。' },
          { kind: 'code', type: '整理规则', title: '批量文件命名规范', prompt: '根据文件内容与日期生成统一命名规则，识别不规范文件名并给出批量重命名方案。' },
          { kind: 'article', type: '会议资料', title: '经营会议材料合集', prompt: '汇总本月经营会议的议程、演示稿、纪要和行动项，按会议日期整理并生成索引。' },
          { kind: 'dashboard', type: '存储分析', title: '重复文件清理报告', prompt: '扫描重复、过期和大体积文件，按风险与可释放空间分类，生成可执行的清理建议。' },
        ],
      },
      slides: {
        guide: '帮我制作幻灯片：',
        tag: '幻灯片',
        secondary: ['制作季度经营复盘汇报', '制作项目方案汇报', '制作产品发布演示', '制作培训课程课件', '制作品牌提案'],
        cases: [
          { kind: 'deck', type: '经营汇报', title: 'Q2 经营复盘演示', prompt: '制作第二季度经营复盘演示，包含目标达成、业务亮点、问题归因和下一季度行动计划。' },
          { kind: 'deck', type: '项目提案', title: '增长项目立项方案', prompt: '制作增长项目立项汇报，说明机会判断、用户洞察、实施路径、资源需求和预期收益。' },
          { kind: 'deck', type: '产品发布', title: '新品发布会演示稿', prompt: '制作新品发布演示稿，突出用户痛点、核心卖点、产品体验和上市节奏，整体简洁有冲击力。' },
          { kind: 'deck', type: '培训课件', title: '新人业务培训课件', prompt: '制作新人业务培训课件，覆盖业务全景、关键流程、常用工具、典型案例和课后练习。' },
        ],
      },
      article: {
        guide: '帮我写推文：',
        tag: '写推文',
        secondary: ['撰写产品功能上新推文', '撰写活动招募推文', '撰写行业洞察长文', '撰写客户案例故事', '撰写品牌节日推文'],
        cases: [
          { kind: 'article', type: '产品推文', title: '智能报表功能上新', prompt: '撰写智能报表新功能推文，说明核心能力、典型使用场景和操作入口，语言清晰有吸引力。' },
          { kind: 'article', type: '活动推文', title: '年度伙伴大会招募', prompt: '撰写年度伙伴大会招募推文，突出活动价值、嘉宾阵容、议程亮点和报名方式。' },
          { kind: 'article', type: '行业洞察', title: '本地生活趋势观察', prompt: '围绕本地生活行业近期变化撰写洞察文章，包含趋势判断、数据依据、案例分析和行动建议。' },
          { kind: 'article', type: '客户案例', title: '连锁品牌增长故事', prompt: '以真实叙事方式撰写连锁品牌增长案例，呈现挑战、解决过程、关键成果和可复用经验。' },
        ],
      },
    };
  }

  function renderSecondaryPrompts(category) {
    const data = promptCategoryData()[category];
    if (!data) {
      secondaryPrompts.hidden = true;
      secondaryPrompts.innerHTML = '';
      return;
    }
    secondaryPrompts.innerHTML = data.secondary.map((label, index) =>
      `<button class="secondary-prompt" type="button" data-secondary-index="${index}"` +
      ` style="animation-delay:${index * 55}ms">${label}</button>`
    ).join('');
    secondaryPrompts.hidden = false;
    secondaryPrompts.scrollLeft = 0;
    requestAnimationFrame(() => updatePromptScrollEdges(secondaryPrompts));
  }

  function transitionCases() {
    clearTimeout(caseTransitionTimer);
    casesEl.classList.add('is-changing');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    caseTransitionTimer = setTimeout(() => {
      renderCases(currentScope);
      casesEl.classList.remove('is-changing');
    }, delay);
  }

  function setPromptCategory(category) {
    clearTimeout(promptTransitionTimer);
    const isClearing = selectedPromptCategory === category;
    selectedPromptCategory = isClearing ? null : category;

    primaryPromptButtons.forEach((button) => {
      const selected = button.dataset.promptCategory === selectedPromptCategory;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    if (isClearing) {
      secondaryPrompts.hidden = true;
      secondaryPrompts.innerHTML = '';
      primaryPrompts.classList.remove('has-selection', 'is-transitioning');
      setPromptGuide('');
    } else {
      primaryPrompts.classList.add('is-transitioning');
      const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
      promptTransitionTimer = setTimeout(() => {
        primaryPrompts.classList.remove('is-transitioning');
        primaryPrompts.classList.add('has-selection');
        renderSecondaryPrompts(category);
      }, delay);
      const data = promptCategoryData()[category];
      const sourceButton = primaryPromptButtons.find((button) => button.dataset.promptCategory === category);
      const sourceIcon = sourceButton?.querySelector('.ic')?.outerHTML || '';
      setPromptGuide(data.guide, data.tag, sourceIcon);
      prompt.focus();
    }
    transitionCases();
  }

  primaryPrompts.addEventListener('click', (event) => {
    const button = event.target.closest('.pill');
    if (button) setPromptCategory(button.dataset.promptCategory);
  });

  secondaryPrompts.addEventListener('click', (event) => {
    const button = event.target.closest('.secondary-prompt');
    if (!button || !selectedPromptCategory) return;
    const item = promptCategoryData()[selectedPromptCategory].secondary[Number(button.dataset.secondaryIndex)];
    // 一级分类保留为简短 Tag，二级推荐作为可继续编辑的普通文本写入输入框。
    prompt.value = item;
    autoResize();
    refreshSendState();
    prompt.focus();
    prompt.setSelectionRange(prompt.value.length, prompt.value.length);
  });

  promptChipClear.addEventListener('click', (event) => {
    event.stopPropagation();
    // 一级 Prompt 已整行退出后，通过清除输入区 Tag 返回默认推荐态。
    if (selectedPromptCategory) setPromptCategory(selectedPromptCategory);
    else setPromptGuide('');
    prompt.focus();
  });

  /* ---------- 5.2 案例 ----------
     解决的是「只给 prompt，产出得等」这件事：卡片上画的就是成品，
     点开直接看，中间没有生成过程。

     因此案例必须是预先备好的静态产物，而非现场跑一遍。
     点击后走工具台的文件面板（决策 2：文件就地预览，不跳浏览器）。

     默认内容跨原场景混合展示；选择一级 Prompt 后按意图切换案例。

     -- 为什么这两组数据写成函数而非 const --
     初始化路径会在本节定义之前调用 renderCases。
     const 不提升，彼时读它会落进暂时性死区并抛错，
     而这一抛会中断整个脚本——表现不是「案例区空白」，
     而是侧边栏行操作、标签条等后续模块全部不再初始化。
     函数声明整体提升，因此无论放在哪一节都能被提前调用。 */

  /* 缩略图沿用决策 7 的抽象层级：画「内容形态」，不截图、不绑品牌。
     截图在小尺寸下会糊，且每换一个案例就得重新出图；
     这里的图形是矢量的，缩放到任何尺寸都清晰。

     每个缩略图撑满卡片的 16:10 画框，用 viewBox 统一坐标系，
     卡片宽度变化时内部元素等比缩放，不需要各自适配。 */
  function caseThumbs() {
   return {
    // 看板：左侧柱形 + 右侧折线，一眼是「一屏数据」
    dashboard: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      // 顶部标题条与两张指标卡
      `<rect x="10" y="9" width="42" height="5" rx="2.5" fill="#c9c9ce"/>` +
      `<rect x="10" y="20" width="30" height="20" rx="3" fill="#fff" stroke="#e4e4e8"/>` +
      `<rect x="44" y="20" width="30" height="20" rx="3" fill="#fff" stroke="#e4e4e8"/>` +
      `<rect x="14" y="26" width="16" height="3" rx="1.5" fill="#8f8f96"/>` +
      `<rect x="48" y="26" width="16" height="3" rx="1.5" fill="#8f8f96"/>` +
      // 柱形图：灰阶为主，最高值用主题绿强调
      `<rect x="10" y="46" width="64" height="44" rx="3" fill="#fff" stroke="#e4e4e8"/>` +
      `<rect x="17" y="72" width="7" height="12" rx="1.5" fill="#d4d4d8"/>` +
      `<rect x="28" y="64" width="7" height="20" rx="1.5" fill="#b7b7bd"/>` +
      `<rect x="39" y="56" width="7" height="28" rx="1.5" fill="#4bcc7a"/>` +
      `<rect x="50" y="66" width="7" height="18" rx="1.5" fill="#d4d4d8"/>` +
      // 折线图
      `<rect x="80" y="20" width="70" height="70" rx="3" fill="#fff" stroke="#e4e4e8"/>` +
      `<path d="M88 74l14-12 12 7 14-20 14 9" fill="none" stroke="#4bcc7a" stroke-width="2.4"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`,

    // 推文：一张竖排图文，顶部配图、下面是正文块
    article: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      `<rect x="40" y="8" width="80" height="84" rx="4" fill="#fff" stroke="#e4e4e8"/>` +
      // 头图
      `<path d="M46 14h68v22H46z" fill="#e9e9ec"/>` +
      `<circle cx="104" cy="21" r="4" fill="#4bcc7a" opacity=".9"/>` +
      `<path d="M46 36l14-11 10 7 8-6 36 14z" fill="#bfc0c5" opacity=".9"/>` +
      // 标题与正文
      `<rect x="46" y="42" width="46" height="4" rx="2" fill="#85858c"/>` +
      [50, 57, 64, 71, 78].map((y, i) =>
        `<rect x="46" y="${y}" width="${i === 4 ? 40 : 68}" height="3" rx="1.5" fill="#d4d4d8"/>`
      ).join('') +
      `</svg>`,

    // 幻灯片：一张主页 + 后面叠两张，表达「一套」而非「一张」
    deck: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      `<rect x="34" y="16" width="92" height="58" rx="4" fill="#ededf0" stroke="#e4e4e8"/>` +
      `<rect x="29" y="22" width="92" height="58" rx="4" fill="#f5f5f6" stroke="#e4e4e8"/>` +
      `<rect x="24" y="28" width="92" height="58" rx="4" fill="#fff" stroke="#dedee2"/>` +
      `<rect x="32" y="37" width="40" height="5" rx="2.5" fill="#85858c"/>` +
      `<rect x="32" y="47" width="58" height="3" rx="1.5" fill="#d4d4d8"/>` +
      `<rect x="32" y="54" width="50" height="3" rx="1.5" fill="#d4d4d8"/>` +
      `<rect x="32" y="64" width="18" height="14" rx="2" fill="#dedee2"/>` +
      `<rect x="54" y="64" width="18" height="14" rx="2" fill="#4bcc7a"/>` +
      `<rect x="76" y="64" width="18" height="14" rx="2" fill="#dedee2"/>` +
      `</svg>`,

    // 网页：带浏览器外壳，与「文档」区分开
    web: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      `<rect x="18" y="14" width="124" height="72" rx="5" fill="#fff" stroke="#dedee2"/>` +
      `<path d="M18 19a5 5 0 0 1 5-5h114a5 5 0 0 1 5 5v7H18z" fill="#ededf0"/>` +
      `<circle cx="27" cy="20" r="2" fill="#c8c8cd"/>` +
      `<circle cx="34" cy="20" r="2" fill="#c8c8cd"/>` +
      `<circle cx="41" cy="20" r="2" fill="#4bcc7a"/>` +
      `<rect x="26" y="34" width="52" height="6" rx="3" fill="#85858c"/>` +
      `<rect x="26" y="46" width="72" height="3" rx="1.5" fill="#d4d4d8"/>` +
      `<rect x="26" y="53" width="60" height="3" rx="1.5" fill="#d4d4d8"/>` +
      `<rect x="26" y="64" width="28" height="10" rx="5" fill="#4bcc7a"/>` +
      `<rect x="104" y="34" width="30" height="40" rx="3" fill="#e7e7ea"/>` +
      `</svg>`,

    // 代码：编辑器窗口，左侧行号栏
    code: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      `<rect x="18" y="14" width="124" height="72" rx="5" fill="#fff" stroke="#dedee2"/>` +
      `<path d="M18 19a5 5 0 0 1 5-5h114a5 5 0 0 1 5 5v6H18z" fill="#ededf0"/>` +
      `<rect x="18" y="25" width="14" height="61" fill="#f5f5f6"/>` +
      [33, 41, 49, 57, 65, 73].map((y, i) =>
        `<rect x="${38 + (i % 3) * 6}" y="${y}" width="${[46, 34, 54, 28, 42, 30][i]}"` +
        ` height="3" rx="1.5" fill="${i === 3 ? '#4bcc7a' : i % 3 === 0 ? '#8f8f96' : '#d4d4d8'}"/>`
      ).join('') +
      `</svg>`,

    // 视觉稿：画板上的构图，用色块而非线条
    visual: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f7f8"/>` +
      `<rect x="30" y="12" width="100" height="76" rx="4" fill="#fff" stroke="#dedee2"/>` +
      `<circle cx="62" cy="40" r="16" fill="#dff3e6"/>` +
      `<rect x="74" y="30" width="44" height="20" rx="3" fill="#d7d7db"/>` +
      `<rect x="42" y="62" width="76" height="4" rx="2" fill="#4bcc7a"/>` +
      `<rect x="42" y="71" width="52" height="4" rx="2" fill="#d4d4d8"/>` +
      `</svg>`,
   };
  }

  /* 保留原场景案例池作为内容来源；默认跨池取样，Prompt 选中后按意图展示。
     prompt 会在详情弹窗中完整展示，并可通过「做同款」直接带回输入框。 */
  function caseData() {
   return {
    office: [
      { kind: 'dashboard', type: '数据看板', title: '门店履约异常看板', prompt: '汇总本月各门店的履约数据，按区域、异常类型和影响程度制作一份可筛选的数据看板，并突出需要优先处理的问题。' },
      { kind: 'article', type: '推广推文', title: '医药代表备案推广稿', prompt: '面向医药代表撰写一篇备案服务推广稿，说明办理流程、所需材料和常见问题，语气专业可信，适合公众号发布。' },
      { kind: 'deck', type: '演示文稿', title: 'Q1 经营复盘汇报', prompt: '根据第一季度经营数据制作一份管理层复盘汇报，包含目标达成、关键增长点、问题归因和下一季度行动计划。' },
      { kind: 'article', type: '分析报告', title: '客户反馈洞察报告', prompt: '整理近期客户反馈，归纳高频问题、情绪倾向和核心诉求，并给出按优先级排序的产品改进建议。' },
    ],
    dev: [
      { kind: 'web', type: '应用开发', title: 'NoCode 组件文档站', prompt: '为 NoCode 组件库制作一个清晰易查的文档网站，包含组件分类、交互示例、参数说明和复制代码入口。' },
      { kind: 'code', type: '代码配置', title: '灰度发布流水线配置', prompt: '生成一份支持分批放量、自动健康检查、失败回滚和发布通知的灰度发布流水线配置。' },
      { kind: 'dashboard', type: '监控看板', title: '服务健康度监控台', prompt: '制作服务健康度监控台，展示可用率、响应时延、错误率和告警趋势，并支持按服务与时间范围筛选。' },
      { kind: 'code', type: '技术方案', title: '接口性能优化方案', prompt: '分析订单查询接口的性能瓶颈，给出缓存、数据库索引、并发控制和可观测性方面的优化方案与示例代码。' },
    ],
    design: [
      { kind: 'visual', type: '网页设计', title: '节点运营主视觉', prompt: '设计一张节点运营活动主视觉，突出限时氛围与核心权益，构图简洁有冲击力，并适配横版活动页面。' },
      { kind: 'deck', type: '设计提案', title: '品牌升级提案', prompt: '制作一份品牌升级提案，梳理品牌现状、设计策略、核心视觉语言和多场景应用示例。' },
      { kind: 'web', type: '交互原型', title: '设计系统组件预览', prompt: '搭建设计系统组件预览页，覆盖基础控件、状态变化、组合示例和设计规范，整体风格简洁统一。' },
      { kind: 'visual', type: '界面设计', title: '会员中心焕新方案', prompt: '重新设计会员中心首页，强化等级权益、成长进度和常用服务入口，输出兼顾信息效率与品牌感的界面方案。' },
    ],
   };
  }

  function visibleCaseData(scope) {
    const category = selectedPromptCategory && promptCategoryData()[selectedPromptCategory];
    if (category) return category.cases;
    const cases = caseData();
    return cases[scope] || [cases.office[0], cases.dev[0], cases.design[0], cases.office[1]];
  }

  function renderCases(scope) {
    const casesEl = document.getElementById('cases');
    if (!casesEl) return;
    const THUMBS_MAP = caseThumbs();
    const list = visibleCaseData(scope);
    casesEl.innerHTML =
      `<div class="cases-head">` +
      `<span class="cases-title">看看别人做出了什么</span>` +
      `</div>` +
      `<div class="cases-row">` +
      list.map((c, i) =>
        `<button class="case" data-case-index="${i}" aria-label="查看案例：${c.title}"` +
        // 错峰入场：与导航项的场景切换动画同一手法
        ` style="animation-delay:${i * 70}ms">` +
        `<span class="cthumb">${(THUMBS_MAP[c.kind] || THUMBS_MAP.article)()}</span>` +
        `<span class="cmeta">` +
        `<span class="ctype">${c.type}</span>` +
        `<span class="ctitle">${c.title}</span>` +
        `</span>` +
        `</button>`
      ).join('') +
      `</div>`;
  }

  /* ---------- 5.5 右上角摘要浮窗与工具抽屉 ---------- */
  const content = document.getElementById('content');
  const workbench = document.getElementById('workbench');
  const outputToggle = document.getElementById('toggleOutputs');
  const summaryToggleSlot = document.querySelector('.summary-toggle-slot');
  const summaryPopover = document.getElementById('summaryPopover');
  const summaryArtifactsSection = document.getElementById('summaryArtifactsSection');
  const summaryArtifactsDivider = document.getElementById('summaryArtifactsDivider');
  const wbToggle = document.getElementById('toggleWorkbench');
  const wbExpandToggle = document.getElementById('toggleWorkbenchExpand');
  const wbPanes = Array.from(workbench.querySelectorAll('.wb-pane'));
  const workspaceTabs = document.getElementById('workspaceTabs');
  const workspaceCreate = document.getElementById('workspaceCreate');
  const workspaceAdd = document.getElementById('workspaceAdd');
  const workspaceCreateMenu = document.getElementById('workspaceCreateMenu');
  const urlInput = document.getElementById('urlInput');
  const toolFileTree = document.getElementById('toolFileTree');
  const toolTreeSearch = document.getElementById('toolTreeSearch');
  const toolTreeSearchClear = document.getElementById('toolTreeSearchClear');
  const toolTreeClose = document.getElementById('toolTreeClose');
  const toolTreeReopen = document.getElementById('toolTreeReopen');
  const toolFileModeToggle = document.getElementById('toolFileModeToggle');
  const toolFilePreviewTitle = document.getElementById('toolFilePreviewTitle');
  const toolFilePreviewBody = document.getElementById('toolFilePreviewBody');
  const openWith = document.getElementById('openWith');
  const openWithPrimary = document.getElementById('openWithPrimary');
  const openWithPrimaryIcon = document.getElementById('openWithPrimaryIcon');
  const openWithToggle = document.getElementById('openWithToggle');
  const openWithMenu = document.getElementById('openWithMenu');
  const fullscreenChat = document.getElementById('fullscreenChat');
  const fullscreenChatInput = document.getElementById('fullscreenChatInput');
  const fullscreenChatSend = document.getElementById('fullscreenChatSend');
  const toolFolderPicker = document.getElementById('toolFolderPicker');
  const toolFolderBtn = document.getElementById('toolFolderBtn');
  const toolFolderName = document.getElementById('toolFolderName');
  const toolFolderMenu = document.getElementById('toolFolderMenu');

  const WORKSPACE_META = {
    files: {
      title: '文件夹',
      icon: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    },
    file: {
      title: '打开文件',
      icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    },
    browser: {
      title: '新标签页',
      icon: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    },
    terminal: {
      title: '终端',
      icon: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
    },
  };
  const WORKSPACE_CLOSE = '<svg viewBox="0 0 24 24" class="ic"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  let workspaceSeq = 0;
  let openWorkspaces = [{
    id: 'file-default',
    kind: 'file',
    title: '打开文件',
    node: null,
    chain: [],
    path: null,
    treeVisible: true,
    previewMode: 'source',
  }];
  let activeWorkspace = 'file-default';

  function saveActiveWorkspaceState() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    if (!item) return;
    if (item.kind === 'browser') {
      item.url = urlInput.value;
    }
  }

  let rightPanel = null;
  let workbenchExpanded = false;

  function syncFullscreenChat() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const visible = workbenchExpanded && rightPanel === 'tools' && item?.kind === 'file' && Boolean(item.node);
    fullscreenChat.hidden = !visible;
  }

  function setWorkbenchExpanded(expanded) {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const canExpandFile = rightPanel === 'tools' && item?.kind === 'file';
    workbenchExpanded = Boolean(expanded && canExpandFile);
    content.classList.toggle('wb-expanded', workbenchExpanded);
    content.classList.toggle('wb-file-active', canExpandFile);
    wbExpandToggle.disabled = !canExpandFile;
    wbExpandToggle.setAttribute('aria-pressed', String(workbenchExpanded));
    wbExpandToggle.title = workbenchExpanded ? '退出文件全屏' : '全屏显示文件';
    wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
    syncFullscreenChat();
    requestAnimationFrame(syncSummaryTriggerPosition);
  }

  function usesWideFilePreview(node) {
    return Boolean(node) && ['ppt', 'html', 'png', 'excel'].includes(artifactType(node));
  }

  function syncWorkbenchWidth() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const isActiveFile = rightPanel === 'tools' && item?.kind === 'file';
    const folderOpen = isActiveFile && item.treeVisible !== false;
    content.classList.toggle('wb-folder-open', folderOpen);
    content.classList.toggle('wb-preview-wide', isActiveFile && usesWideFilePreview(item.node));
  }

  function syncSummaryTriggerPosition() {
    const main = document.querySelector('.main');
    if (rightPanel !== 'tools' || workbenchExpanded || !main || !summaryToggleSlot) {
      summaryToggleSlot?.style.removeProperty('--summary-trigger-right');
      content.style.removeProperty('--summary-float-left');
      content.style.removeProperty('--summary-float-top');
      summaryPopover.style.removeProperty('position');
      summaryPopover.style.removeProperty('left');
      summaryPopover.style.removeProperty('top');
      summaryPopover.style.removeProperty('right');
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const mainRightInset = contentRect.right - mainRect.right;

    // 先提交 icon 的新位置；随后读取矩形会得到已经移动后的最终坐标。
    summaryToggleSlot.style.setProperty('--summary-trigger-right', `${Math.max(16, mainRightInset + 16)}px`);
    const triggerRect = outputToggle.getBoundingClientRect();
    const floatWidth = summaryPopover.hidden ? 344 : summaryPopover.getBoundingClientRect().width;
    const minLeft = mainRect.left + 16;
    const maxLeft = Math.max(minLeft, mainRect.right - floatWidth - 16);
    const left = Math.min(maxLeft, Math.max(minLeft, triggerRect.right - floatWidth));
    const top = triggerRect.bottom + 8;

    // 浮窗使用视口坐标直接跟随摘要按钮的右下角，并严格夹紧在左侧主区。
    summaryPopover.style.setProperty('position', 'fixed', 'important');
    summaryPopover.style.setProperty('left', `${left}px`, 'important');
    summaryPopover.style.setProperty('top', `${top}px`, 'important');
    summaryPopover.style.setProperty('right', 'auto', 'important');
  }

  function setRightPanel(panel) {
    const next = panel || null;
    if (next === 'tools' && openWorkspaces.length === 0) ensureDefaultFileWorkspace();
    rightPanel = next;
    syncWorkbenchWidth();
    const open = Boolean(next);
    content.classList.toggle('wb-open', open);
    workbench.dataset.panel = next || '';
    setWorkbenchExpanded(workbenchExpanded);
    workbench.setAttribute('aria-hidden', String(!open));
    wbToggle.setAttribute('aria-expanded', String(next === 'tools'));
    wbToggle.title = next === 'tools' ? '收起工具' : '工具';
    requestAnimationFrame(() => {
      syncSummaryTriggerPosition();
      requestAnimationFrame(syncSummaryTriggerPosition);
    });
  }

  const summaryTriggerResizeObserver = new ResizeObserver(syncSummaryTriggerPosition);
  summaryTriggerResizeObserver.observe(content);
  summaryTriggerResizeObserver.observe(document.querySelector('.main'));
  window.addEventListener('resize', syncSummaryTriggerPosition);

  function setWorkbench(open) {
    if (!open) {
      rightPanel = null;
      content.classList.remove('wb-open', 'wb-folder-open', 'wb-preview-wide', 'wb-expanded', 'wb-file-active');
      workbenchExpanded = false;
      wbExpandToggle.disabled = true;
      wbExpandToggle.setAttribute('aria-pressed', 'false');
      wbExpandToggle.title = '全屏显示文件';
      wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
      workbench.dataset.panel = '';
      workbench.setAttribute('aria-hidden', 'true');
      wbToggle.setAttribute('aria-expanded', 'false');
      wbToggle.title = '工具';
      fullscreenChat.hidden = true;
      return;
    }
    if (rightPanel !== 'tools') setRightPanel('tools');
  }

  function renderWorkspaceTabs() {
    workspaceTabs.innerHTML = openWorkspaces.map((item) => {
      const meta = WORKSPACE_META[item.kind];
      return `<div class="workspace-tab${item.id === activeWorkspace ? ' active' : ''}" role="tab" tabindex="0"` +
        ` data-workspace-tab="${item.id}" data-workspace-kind="${item.kind}"` +
        ` data-workspace-empty="${item.kind === 'file' && !item.node}"` +
        ` aria-selected="${item.id === activeWorkspace}" title="${esc(item.title)}">` +
        `<svg viewBox="0 0 24 24" class="ic">${meta.icon}</svg>` +
        `<span class="workspace-tab-title">${esc(item.title)}</span>` +
        `<button class="workspace-tab-close" type="button" title="关闭" aria-label="关闭 ${esc(item.title)}">${WORKSPACE_CLOSE}</button>` +
        `</div>`;
    }).join('');
  }

  function activateWorkspace(id, saveCurrent = true) {
    const item = openWorkspaces.find((workspace) => workspace.id === id);
    if (!item) return;
    if (saveCurrent) saveActiveWorkspaceState();
    activeWorkspace = id;
    renderWorkspaceTabs();
    workbench.classList.remove('file-split', 'file-preview-only');
    syncWorkbenchWidth();
    setWorkbenchExpanded(workbenchExpanded);
    wbPanes.forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === item.kind));
    if (item.kind === 'browser') {
      urlInput.value = item.url || '';
      requestAnimationFrame(() => urlInput.focus());
    }
    if (item.kind === 'file') renderToolFileWorkspace(item);
    syncFullscreenChat();
  }

  function makeFileWorkspace(overrides = {}) {
    workspaceSeq += 1;
    return {
      id: `file-${workspaceSeq}`,
      kind: 'file',
      title: '打开文件',
      node: null,
      chain: [],
      path: null,
      treeVisible: true,
      previewMode: 'source',
      ...overrides,
    };
  }

  function ensureDefaultFileWorkspace() {
    if (openWorkspaces.length > 0) return openWorkspaces[0];
    const item = makeFileWorkspace();
    openWorkspaces.push(item);
    activeWorkspace = item.id;
    activateWorkspace(item.id, false);
    return item;
  }

  function createWorkspace(kind) {
    if (!WORKSPACE_META[kind] || kind === 'files') return;
    const sameKindCount = openWorkspaces.filter((item) => item.kind === kind).length;
    let title = WORKSPACE_META[kind].title;
    if (sameKindCount && kind !== 'file') title = `${title} ${sameKindCount + 1}`;
    let item;
    if (kind === 'file') {
      item = makeFileWorkspace();
    } else {
      workspaceSeq += 1;
      item = {
        id: `${kind}-${workspaceSeq}`,
        kind,
        title,
        url: kind === 'browser' ? '' : undefined,
      };
    }
    openWorkspaces.push(item);
    setWorkspaceCreate(false);
    activateWorkspace(item.id);
    if (kind === 'browser') urlInput.value = '';
  }

  function closeWorkspace(id) {
    const index = openWorkspaces.findIndex((item) => item.id === id);
    if (index === -1) return;

    const closingActiveWorkspace = activeWorkspace === id;
    openWorkspaces.splice(index, 1);

    // 关闭按钮始终真正移除对应页签；最后一张被移除时同时收起面板。
    // 下次主动打开工具面板时再提供新的空白文件页签，不恢复已关闭内容。
    if (openWorkspaces.length === 0) {
      activeWorkspace = null;
      renderWorkspaceTabs();
      setWorkbench(false);
      return;
    }

    if (closingActiveWorkspace) {
      const nextWorkspace = openWorkspaces[Math.min(index, openWorkspaces.length - 1)];
      activeWorkspace = nextWorkspace.id;
      activateWorkspace(activeWorkspace, false);
    } else {
      renderWorkspaceTabs();
    }
  }

  function setWorkspaceCreate(open) {
    workspaceCreate.classList.toggle('open', open);
    workspaceCreateMenu.hidden = !open;
    workspaceAdd.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => workspaceCreateMenu.querySelector('.workspace-create-item').focus());
  }

  wbExpandToggle.addEventListener('click', () => setWorkbenchExpanded(!workbenchExpanded));
  fullscreenChatInput.addEventListener('input', () => {
    fullscreenChatInput.style.height = 'auto';
    fullscreenChatInput.style.height = `${Math.min(fullscreenChatInput.scrollHeight, 112)}px`;
    fullscreenChatSend.disabled = !fullscreenChatInput.value.trim();
  });
  fullscreenChatInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (!fullscreenChatInput.value.trim()) return;
    fullscreenChatInput.value = '';
    fullscreenChatInput.style.height = 'auto';
    fullscreenChatSend.disabled = true;
  });
  fullscreenChatSend.addEventListener('click', () => {
    if (!fullscreenChatInput.value.trim()) return;
    fullscreenChatInput.value = '';
    fullscreenChatInput.style.height = 'auto';
    fullscreenChatSend.disabled = true;
  });
function setSummaryOpen(open) {
  // 工具区已打开时先用当前左侧主区边界定位，再显示摘要浮窗，避免沿用旧的静态位置。
  syncSummaryTriggerPosition();
  summaryPopover.hidden = !open;
  content.classList.toggle('summary-open', open);
  outputToggle.setAttribute('aria-expanded', String(open));
  outputToggle.classList.toggle('active', open);
  if (open) renderSummaryContents();
  requestAnimationFrame(syncSummaryTriggerPosition);
}

  outputToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setSummaryOpen(summaryPopover.hidden);
  });
  summaryPopover.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => setSummaryOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || summaryPopover.hidden) return;
    setSummaryOpen(false);
    outputToggle.focus();
  });

  wbToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const toolsOpen = content.classList.contains('wb-open') && workbench.dataset.panel === 'tools';
    setRightPanel(toolsOpen ? null : 'tools');
  });
  workspaceAdd.addEventListener('click', (e) => {
    e.stopPropagation();
    setWorkspaceCreate(!workspaceCreate.classList.contains('open'));
  });
  workspaceCreateMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-create-workspace]');
    if (item) createWorkspace(item.dataset.createWorkspace);
  });
  workspaceTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-workspace-tab]');
    if (!tab) return;
    const key = tab.dataset.workspaceTab;
    if (e.target.closest('.workspace-tab-close')) closeWorkspace(key);
    else activateWorkspace(key);
  });
  workspaceTabs.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.target.closest('.workspace-tab-close')) return;
    const tab = e.target.closest('[data-workspace-tab]');
    if (!tab) return;
    e.preventDefault();
    activateWorkspace(tab.dataset.workspaceTab);
  });
  document.addEventListener('click', (e) => {
    if (!workspaceCreate.contains(e.target)) setWorkspaceCreate(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setWorkspaceCreate(false);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      const toolsOpen = content.classList.contains('wb-open') && workbench.dataset.panel === 'tools';
      setRightPanel(toolsOpen ? null : 'tools');
    }
  });
  /* 工具文件夹只展示当前任务所在的根目录，顶部切换器与输入框下方的
     归属选择共享状态。代码文件使用编辑器社区常见的文件类型字形。 */
  const toolTreeExpanded = new Set(['root', 'root.5']);
  let activeFilePath = null;
  let toolTreeQuery = '';
  const TREE_ICONS = {
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  };

  function fileExtension(name) {
    const lower = String(name || '').toLowerCase();
    if (lower === 'dockerfile') return 'docker';
    if (lower === '.env' || lower === '.gitignore') return lower.slice(1);
    const match = lower.match(/\.([^.]+)$/);
    return match ? match[1] : 'file';
  }

  function treeIconForNode(node) {
    if (node.type === 'folder') return { kind: 'folder', icon: TREE_ICONS.folder, label: '' };
    const ext = fileExtension(node.name);
    const labels = {
      javascript: 'JS', typescript: 'TS', jsx: 'JS', tsx: 'TS',
      html: '<>', css: '#', scss: '#', less: '#',
      markdown: '↓', md: '↓', json: '{}', xml: '<>', yaml: 'Y', yml: 'Y',
      toml: 'T', ini: 'I', env: 'E', gitignore: 'G', docker: '◆',
      python: 'Py', py: 'Py', java: 'J', kt: 'K', go: 'Go', rs: 'Rs',
      php: 'php', rb: 'Rb', swift: 'S', c: 'C', h: 'H', cpp: 'C+', cs: 'C#',
      sql: 'DB', graphql: '◇', sh: '$_', bash: '$_', zsh: '$_',
      png: '▧', jpg: '▧', jpeg: '▧', gif: '▧', webp: '▧', svg: '◇',
      txt: 'T', doc: 'W', docx: 'W', pdf: 'PDF', file: '·',
    };
    return { kind: ext, icon: TREE_ICONS.file, label: labels[ext] || ext.slice(0, 3).toUpperCase() };
  }

  function activeToolFolder() {
    return FOLDERS.find((folder) => folder.id === folderByScope[currentScope]) || FOLDERS[0];
  }

  function treeNodeAtPath(path) {
    const indices = path === 'root' ? [] : path.replace(/^root\.?/, '').split('.').filter(Boolean).map(Number);
    const root = activeToolFolder();
    const chain = [root];
    let node = root;
    for (const index of indices) {
      node = (node.files || [])[index];
      if (!node) return null;
      chain.push(node);
    }
    return { node, chain };
  }

  function nodeMatchesTreeQuery(node) {
    if (!toolTreeQuery) return true;
    if (String(node.name || '').toLocaleLowerCase().includes(toolTreeQuery)) return true;
    return node.type === 'folder' && (node.files || []).some(nodeMatchesTreeQuery);
  }

  function renderToolTreeNodes(nodes, parentPath, depth) {
    return nodes.map((node, index) => ({ node, index }))
      .filter(({ node }) => nodeMatchesTreeQuery(node))
      .map(({ node, index }) => {
        const path = `${parentPath}.${index}`;
        const isFolder = node.type === 'folder';
        const expanded = isFolder && (Boolean(toolTreeQuery) || toolTreeExpanded.has(path));
        const children = isFolder && expanded
          ? `<div role="group">${renderToolTreeNodes(node.files || [], path, depth + 1)}</div>`
          : '';
        const icon = treeIconForNode(node);
        return `<div class="tool-tree-node">` +
          `<button type="button" role="treeitem" data-tree-path="${path}"` +
          ` data-tree-folder="${isFolder}" aria-expanded="${isFolder ? String(expanded) : ''}"` +
          ` class="tool-tree-row${!isFolder && `${activeToolFolder().id}:${path}` === activeFilePath ? ' selected' : ''}"` +
          ` style="--tree-depth:${depth}" title="${esc(node.name)}">` +
          `<svg viewBox="0 0 24 24" class="tool-tree-chevron${isFolder ? '' : ' blank'}"><path d="m9 18 6-6-6-6"/></svg>` +
          `<span class="tool-tree-file-icon" data-file-kind="${icon.kind}"><svg viewBox="0 0 24 24" class="tool-tree-icon">${icon.icon}</svg><i>${esc(icon.label)}</i></span>` +
          `<span>${esc(node.name)}</span>` +
          `</button>${children}</div>`;
      }).join('');
  }

  function renderToolFolderPicker() {
    const active = activeToolFolder();
    toolFolderName.textContent = active.name;
    toolFolderBtn.title = active.path;
    toolFolderMenu.innerHTML = FOLDERS.map((folder) =>
      `<button class="tool-folder-option${folder.id === active.id ? ' active' : ''}" type="button" role="option"` +
      ` aria-selected="${folder.id === active.id}" data-tool-folder-id="${folder.id}">` +
      `<svg viewBox="0 0 24 24" class="ic">${TREE_ICONS.folder}</svg>` +
      `<span><strong>${esc(folder.name)}</strong><small>${esc(folder.path)}</small></span>` +
      `</button>`
    ).join('');
  }

  function setToolFolderOpen(open) {
    toolFolderPicker.classList.toggle('open', open);
    toolFolderMenu.hidden = !open;
    toolFolderBtn.setAttribute('aria-expanded', String(open));
  }

function renderToolTree() {
const folder = activeToolFolder();
const expanded = Boolean(toolTreeQuery) || toolTreeExpanded.has('root');
const childrenHtml = expanded ? renderToolTreeNodes(folder.files || [], 'root', 1) : '';
const children = expanded && childrenHtml ? `<div role="group">${childrenHtml}</div>` : '';
const empty = toolTreeQuery && !childrenHtml
? `<div class="tool-tree-empty">没有匹配“${esc(toolTreeSearch.value.trim())}”的文件</div>`
: '';
toolFileTree.innerHTML = `<div class="tool-tree-node tool-tree-root">` +
`<button class="tool-tree-row" type="button" role="treeitem" data-tree-path="root"` +
` data-tree-folder="true" aria-expanded="${expanded}" style="--tree-depth:0" title="${esc(folder.path)}">` +
`<svg viewBox="0 0 24 24" class="tool-tree-chevron"><path d="m9 18 6-6-6-6"/></svg>` +
`<span class="tool-tree-file-icon" data-file-kind="folder"><svg viewBox="0 0 24 24" class="tool-tree-icon">${TREE_ICONS.folder}</svg></span>` +
`<span>${esc(folder.name)}</span>` +
`</button>${children}${empty}</div>`;
renderToolFolderPicker();
}

/* 文件树右键菜单挂到 body，避免被目录面板的 overflow 裁切。 */
const TREE_CONTEXT_ITEMS = [
{ act: 'chat', label: '添加到对话', svg: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M12 7v8M8 11h8"/>' },
{ act: 'copy-path', label: '复制路径', divider: true, svg: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
{ act: 'copy-relative-path', label: '复制相对路径', svg: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
{ act: 'reveal', label: '在 Finder 中显示', svg: '<path d="M2 7.5V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2z"/><path d="M2 10h20"/>' },
{ act: 'rename', label: '重命名', divider: true, svg: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>' },
{ act: 'delete', label: '删除', svg: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' },
];
const treeContextMenu = document.createElement('div');
treeContextMenu.className = 'row-menu tree-context-menu';
treeContextMenu.setAttribute('role', 'menu');
treeContextMenu.hidden = true;
treeContextMenu.innerHTML = TREE_CONTEXT_ITEMS.map((item) =>
`<button class="row-menu-item" type="button" role="menuitem" data-tree-context-act="${item.act}"${item.divider ? ' data-divider' : ''}>` +
`<svg viewBox="0 0 24 24" class="ic">${item.svg}</svg><span>${item.label}</span></button>`
).join('');
document.body.appendChild(treeContextMenu);

let treeContextTarget = null;
let treeContextRow = null;

function closeTreeContextMenu() {
if (treeContextMenu.hidden) return;
treeContextMenu.classList.remove('open');
treeContextMenu.hidden = true;
if (treeContextRow) treeContextRow.classList.remove('context-open');
treeContextTarget = null;
treeContextRow = null;
}

function openTreeContextMenu(event, row, target, path) {
closeTreeContextMenu();
closeRowMenu();
treeContextTarget = { ...target, path };
treeContextRow = row;
row.classList.add('context-open');

treeContextMenu.hidden = false;
treeContextMenu.style.visibility = 'hidden';
treeContextMenu.style.left = '0px';
treeContextMenu.style.top = '0px';
treeContextMenu.style.transform = 'none';
const rect = treeContextMenu.getBoundingClientRect();
const margin = 8;
let left = Math.min(event.clientX, window.innerWidth - rect.width - margin);
let top = Math.min(event.clientY, window.innerHeight - rect.height - margin);
left = Math.max(margin, left);
top = Math.max(margin, top);
treeContextMenu.style.left = `${Math.round(left)}px`;
treeContextMenu.style.top = `${Math.round(top)}px`;
treeContextMenu.style.transform = '';
treeContextMenu.style.visibility = '';
requestAnimationFrame(() => treeContextMenu.classList.add('open'));
}

function treeRelativePath(target) {
return target.chain.slice(1).map((item) => item.name).join('/');
}

async function copyTreePath(text) {
try {
await navigator.clipboard.writeText(text);
} catch (error) {
console.warn('[CatPaw] 无法复制文件路径：', error);
}
}

function appendFileToConversation(node) {
const value = `@${node.name} `;
let input = prompt;
if (!fullscreenChat.hidden) input = fullscreenChatInput;
else if (!conversationPage.hidden) input = conversationPrompt;
input.value = `${input.value}${input.value && !/\s$/.test(input.value) ? ' ' : ''}${value}`;
input.dispatchEvent(new Event('input', { bubbles: true }));
input.focus();
}

function removeTreeNode(path) {
const indices = path.replace(/^root\.?/, '').split('.').filter(Boolean).map(Number);
if (!indices.length) return;
let parent = activeToolFolder();
for (const index of indices.slice(0, -1)) parent = (parent.files || [])[index];
if (!parent?.files) return;
parent.files.splice(indices.at(-1), 1);
}

function sourceForNode(node) {
    const preview = node.preview;
    if (preview && preview.kind === 'html') return preview.html;
    if (preview && preview.kind === 'markdown') return preview.text;
    if (preview && preview.kind === 'image') {
      return `<!-- ${node.name}\n二进制图片文件不提供文本源码预览。 -->`;
    }
    return `// ${node.name}\n// 当前原型未载入该文件的源码内容。`;
  }

  function renderSourcePreview(node) {
    const lines = sourceForNode(node).split('\n');
    return `<ol class="source-preview">${lines.map((line) => `<li><code>${esc(line) || ' '}</code></li>`).join('')}</ol>`;
  }

  const TOOL_FILE_EMPTY = `<div class="tool-file-preview-empty" role="status">
    <svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
    <strong>尚未选择文件</strong>
    <span>从右侧文件夹中选择一个文件打开</span>
  </div>`;

  function currentFileWorkspace() {
    return openWorkspaces.find((workspace) => workspace.id === activeWorkspace && workspace.kind === 'file');
  }

  function supportsRenderedPreview(node) {
    return node?.preview && (node.preview.kind === 'html' || node.preview.kind === 'markdown');
  }

  const OPEN_WITH_ICONS = {
    browser: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#edf5ff" stroke="#3180dd"/><path d="M12 2.5c3 3 4.4 6.1 4.4 9.5S15 18.5 12 21.5C9 18.5 7.6 15.4 7.6 12S9 5.5 12 2.5ZM2.5 12h19" fill="none" stroke="#3180dd" stroke-width="1.4"/></svg>',
    word: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#2b69c9"/><path d="M7 7.5 9.3 17h1.9l1.5-5.6 1.5 5.6h1.9L18 7.5h-2l-1 6-1.5-6h-1.7l-1.6 6-1.1-6Z" fill="#fff"/></svg>',
    excel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#218354"/><path d="m7 7.5 3.1 4.4L6.8 17h2.5l2.1-3.5 2.2 3.5h2.6l-3.5-5.2 3.1-4.3h-2.5l-1.8 2.9-1.9-2.9Z" fill="#fff"/></svg>',
    powerpoint: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#d84a2f"/><path d="M7 7.5h4.2c2.5 0 4 1.3 4 3.5 0 2.3-1.7 3.7-4.2 3.7H9.2V17H7Zm2.2 1.8v3.6h1.7c1.3 0 2.1-.6 2.1-1.8s-.8-1.8-2.1-1.8Z" fill="#fff"/></svg>',
    ide: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#25262b"/><path d="m9.5 8-4 4 4 4M14.5 8l4 4-4 4" fill="none" stroke="#74d99f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#202124"/><path d="m6.5 8.5 3.5 3.5-3.5 3.5M12 16h5.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    finder: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#66aaf4"/><path d="M12 2v20M8.2 8.2c.9-1.8 2.1-3.1 3.8-4.3M7.5 14.5c2.8 2.3 6.2 2.3 9 0" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="8.1" cy="10.2" r=".8" fill="#173b75"/><circle cx="15.9" cy="10.2" r=".8" fill="#173b75"/></svg>',
    preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#557de8"/><path d="M6.5 15.5 10 12l2.5 2.5 2-2 3 3M15.5 8.5h.01" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function openWithConfig(node) {
    const ext = fileExtension(node?.name || '');
    if (['html', 'htm'].includes(ext)) return { primary: 'browser', label: '浏览器', apps: [['ide', 'CatPaw IDE'], ['browser', 'Safari']] };
    if (['ppt', 'pptx'].includes(ext)) return { primary: 'powerpoint', label: 'PowerPoint', apps: [['preview', 'Keynote'], ['ide', 'CatPaw IDE']] };
    if (['doc', 'docx'].includes(ext)) return { primary: 'word', label: 'Word', apps: [['preview', 'Pages'], ['ide', 'CatPaw IDE']] };
    if (['xls', 'xlsx'].includes(ext)) return { primary: 'excel', label: 'Excel', apps: [['preview', 'Numbers'], ['ide', 'CatPaw IDE']] };
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf'].includes(ext)) return { primary: 'preview', label: '预览', apps: [['ide', 'CatPaw IDE']] };
    return { primary: 'ide', label: 'CatPaw IDE', apps: [['terminal', 'Terminal']] };
  }

  function setOpenWithMenu(open) {
    openWith.classList.toggle('open', open);
    openWithMenu.hidden = !open;
    openWithToggle.setAttribute('aria-expanded', String(open));
  }

  function renderOpenWith(node) {
    openWith.hidden = !node;
    if (!node) {
      setOpenWithMenu(false);
      return;
    }
    const config = openWithConfig(node);
    openWith.dataset.primaryApp = config.label;
    openWithPrimaryIcon.innerHTML = OPEN_WITH_ICONS[config.primary];
    openWithPrimary.title = `使用 ${config.label} 打开`;
    openWithPrimary.setAttribute('aria-label', openWithPrimary.title);
    openWithMenu.innerHTML = config.apps.map(([icon, label]) =>
      `<button class="open-with-item" type="button" role="menuitem" data-open-with-app="${esc(label)}">` +
      `<span class="open-with-app-icon">${OPEN_WITH_ICONS[icon]}</span>` +
      `<span class="open-with-item-label">${esc(label)}</span></button>`
    ).join('') +
      `<button class="open-with-item" type="button" role="menuitem" data-open-with-action="reveal" data-divider>` +
      `<span class="open-with-app-icon">${OPEN_WITH_ICONS.finder}</span>` +
      `<span class="open-with-item-label">在文件夹中打开</span></button>`;
  }

  function renderToolFileWorkspace(item) {
    if (!item || item.kind !== 'file') return;
    const treeVisible = item.treeVisible !== false;
    const canToggleMode = supportsRenderedPreview(item.node);
    const hasVisualPreview = Boolean(item.node?.preview && PREVIEWS[item.node.preview.kind]);
    if (canToggleMode && item.previewMode !== 'source') item.previewMode = 'rendered';
    if (item.node?.preview?.kind === 'image' && item.previewMode !== 'artifact') item.previewMode = 'rendered';
    workbench.classList.toggle('file-split', treeVisible);
    workbench.classList.toggle('file-preview-only', !treeVisible);
    syncWorkbenchWidth();
toolTreeReopen.hidden = treeVisible;
toolTreeReopen.setAttribute('aria-pressed', String(treeVisible));
toolFileModeToggle.hidden = !canToggleMode;
    toolFileModeToggle.textContent = item.previewMode === 'source' ? '预览效果' : '编辑代码';
    toolFileModeToggle.setAttribute('aria-pressed', String(item.previewMode === 'source'));
    activeFilePath = treeVisible ? item.path || null : null;
    toolFilePreviewTitle.textContent = item.node ? item.node.name : '选择文件';
    renderOpenWith(item.node);
    if (!item.node) toolFilePreviewBody.innerHTML = TOOL_FILE_EMPTY;
    else if (hasVisualPreview && item.previewMode !== 'source') {
      toolFilePreviewBody.innerHTML = PREVIEWS[item.node.preview.kind](item.node.preview);
    } else if (item.previewMode === 'artifact') {
      toolFilePreviewBody.innerHTML = previewFallback(item.node);
    } else {
      toolFilePreviewBody.innerHTML = renderSourcePreview(item.node);
    }
    toolFilePreviewBody.scrollTop = 0;
    renderToolTree();
  }

  function openFileWorkspace(node, chain, options) {
    // 目录树、产物面板和对话产物共用同一组页签。同一个文件再次打开时
    // 激活已有页签；不同文件各占一张，并一直保留到用户手动关闭。
    let item = openWorkspaces.find((workspace) => workspace.kind === 'file' && workspace.node === node);
    if (!item) {
      item = openWorkspaces.find((workspace) => workspace.kind === 'file' && !workspace.node);
    }
    if (!item) {
      item = makeFileWorkspace();
      openWorkspaces.push(item);
    }

    item.node = node;
    item.chain = chain.slice();
    item.path = options.path;
    item.title = node.name;
    item.treeVisible = options.treeVisible;
    item.previewMode = options.previewMode;
    rememberRecentFile(node, chain);

    if (rightPanel !== 'tools') setRightPanel('tools');
    activateWorkspace(item.id);
    return item;
  }

  function openToolFile(node, chain, path) {
    openFileWorkspace(node, chain, {
      path,
      treeVisible: true,
      previewMode: node?.preview ? 'rendered' : 'source',
    });
  }

  function openArtifactPreview(node, chain) {
    openFileWorkspace(node, chain, {
      path: null,
      treeVisible: false,
      previewMode: 'artifact',
    });
  }

  let toolTreeScrollTimer;
  toolFileTree.addEventListener('scroll', () => {
    toolFileTree.classList.add('is-scrolling');
    clearTimeout(toolTreeScrollTimer);
    toolTreeScrollTimer = setTimeout(() => toolFileTree.classList.remove('is-scrolling'), 650);
  }, { passive: true });

  toolTreeSearch.addEventListener('input', () => {
    toolTreeQuery = toolTreeSearch.value.trim().toLocaleLowerCase();
    toolTreeSearchClear.hidden = !toolTreeQuery;
    renderToolTree();
  });

  toolTreeSearchClear.addEventListener('click', () => {
    toolTreeSearch.value = '';
    toolTreeQuery = '';
    toolTreeSearchClear.hidden = true;
    renderToolTree();
    toolTreeSearch.focus();
  });

  toolFileModeToggle.addEventListener('click', () => {
    const item = currentFileWorkspace();
    if (!item || !supportsRenderedPreview(item.node)) return;
    item.previewMode = item.previewMode === 'source' ? 'rendered' : 'source';
    renderToolFileWorkspace(item);
  });

  function currentFileAbsolutePath() {
    const item = currentFileWorkspace();
    if (!item?.node) return '';
    const folder = item.chain?.[0] || activeToolFolder();
    const relativePath = (item.chain || []).slice(1).map((node) => node.name).join('/') || item.node.name;
    return `${folder.path.replace(/\/$/, '')}/${relativePath}`;
  }

  function openCurrentFileWith(appName) {
    const item = currentFileWorkspace();
    if (!item?.node) return;
    console.log(`[CatPaw] 使用 ${appName} 打开：`, currentFileAbsolutePath());
    setOpenWithMenu(false);
  }

  openWithPrimary.addEventListener('click', () => openCurrentFileWith(openWith.dataset.primaryApp));
  openWithToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpenWithMenu(openWithMenu.hidden);
  });
  openWithMenu.addEventListener('click', (event) => {
    const target = event.target.closest('[data-open-with-app], [data-open-with-action]');
    if (!target) return;
    event.stopPropagation();
    if (target.dataset.openWithAction === 'reveal') {
      console.log('[CatPaw] 在 Finder 中显示：', currentFileAbsolutePath());
      setOpenWithMenu(false);
      return;
    }
    openCurrentFileWith(target.dataset.openWithApp);
  });
  document.addEventListener('click', (event) => {
    if (!openWith.contains(event.target)) setOpenWithMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || openWithMenu.hidden) return;
    setOpenWithMenu(false);
    openWithToggle.focus();
  });

toolFileTree.addEventListener('click', (e) => {
const row = e.target.closest('[data-tree-path]');
if (!row) return;
closeTreeContextMenu();
const path = row.dataset.treePath;
const target = treeNodeAtPath(path);
if (!target) return;
if (row.dataset.treeFolder === 'true') {
if (toolTreeExpanded.has(path)) toolTreeExpanded.delete(path);
else toolTreeExpanded.add(path);
renderToolTree();
return;
}
openToolFile(target.node, target.chain, `${activeToolFolder().id}:${path}`);
});

toolFileTree.addEventListener('contextmenu', (e) => {
const row = e.target.closest('[data-tree-path]');
if (!row || row.dataset.treeFolder === 'true') return;
const path = row.dataset.treePath;
const target = treeNodeAtPath(path);
if (!target) return;
e.preventDefault();
e.stopPropagation();
openTreeContextMenu(e, row, target, path);
});

treeContextMenu.addEventListener('click', async (e) => {
const item = e.target.closest('[data-tree-context-act]');
if (!item || !treeContextTarget) return;
const target = treeContextTarget;
const node = target.node;
const relativePath = treeRelativePath(target);
const absolutePath = `${activeToolFolder().path.replace(/\/$/, '')}/${relativePath}`;
closeTreeContextMenu();

switch (item.dataset.treeContextAct) {
case 'chat':
appendFileToConversation(node);
break;
case 'copy-path':
await copyTreePath(absolutePath);
break;
case 'copy-relative-path':
await copyTreePath(relativePath);
break;
case 'reveal':
console.log('[CatPaw] 在 Finder 中显示：', absolutePath);
break;
case 'rename': {
const nextName = window.prompt('重命名文件', node.name)?.trim();
if (!nextName || nextName === node.name) break;
node.name = nextName;
openWorkspaces.forEach((workspace) => {
if (workspace.node === node) workspace.title = nextName;
});
renderWorkspaceTabs();
const active = currentFileWorkspace();
if (active) renderToolFileWorkspace(active);
else renderToolTree();
break;
}
case 'delete':
if (!window.confirm(`确定删除“${node.name}”吗？`)) break;
removeTreeNode(target.path);
openWorkspaces.forEach((workspace) => {
if (workspace.node !== node) return;
workspace.node = null;
workspace.chain = [];
workspace.path = null;
workspace.title = '打开文件';
workspace.previewMode = 'source';
});
renderWorkspaceTabs();
const active = currentFileWorkspace();
if (active) renderToolFileWorkspace(active);
else renderToolTree();
break;
default:
break;
}
});

document.addEventListener('mousedown', (e) => {
if (!treeContextMenu.contains(e.target)) closeTreeContextMenu();
}, true);
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') closeTreeContextMenu();
});
window.addEventListener('scroll', closeTreeContextMenu, true);
window.addEventListener('resize', closeTreeContextMenu);

  toolFolderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setToolFolderOpen(!toolFolderPicker.classList.contains('open'));
  });

  toolFolderMenu.addEventListener('click', (e) => {
    const option = e.target.closest('[data-tool-folder-id]');
    if (!option) return;
    selectFolder(option.dataset.toolFolderId);
    setToolFolderOpen(false);
  });

  document.addEventListener('click', (e) => {
    if (!toolFolderPicker.contains(e.target)) setToolFolderOpen(false);
  });

toolTreeClose.addEventListener('click', () => {
const item = currentFileWorkspace();
if (!item) return;
item.treeVisible = false;
renderToolFileWorkspace(item);
});

toolTreeReopen.addEventListener('click', () => {
const item = currentFileWorkspace();
if (!item) return;
item.treeVisible = true;
// 展开目录只改变布局，不改变当前文件的渲染方式。
renderToolFileWorkspace(item);
});

  renderToolTree();
  activateWorkspace('file-default', false);

  /* ---------- 5.6 案例详情弹窗 ----------
     所有卡片共用一个 dialog：卡片只保存当前场景内的索引，打开时再从
     单一数据源读取标题、类型、Prompt 和视觉图，避免在 DOM 中复制长文本。 */
  const caseDialog = document.getElementById('caseDialog');
  const caseDialogClose = document.getElementById('caseDialogClose');
  const caseDialogVisual = document.getElementById('caseDialogVisual');
  const caseDialogType = document.getElementById('caseDialogType');
  const caseDialogTitle = document.getElementById('caseDialogTitle');
  const caseDialogPrompt = document.getElementById('caseDialogPrompt');
  const caseDialogPrimary = document.getElementById('caseDialogPrimary');
  let activeCase = null;
  let caseReturnFocus = null;

  function openCaseDialog(item, trigger) {
    if (!item) return;
    const thumbs = caseThumbs();
    activeCase = item;
    caseReturnFocus = trigger;
    caseDialogVisual.innerHTML = (thumbs[item.kind] || thumbs.article)();
    caseDialogType.textContent = item.type;
    caseDialogTitle.textContent = item.title;
    caseDialogPrompt.textContent = item.prompt;
    caseDialog.showModal();
  }

  function closeCaseDialog() {
    if (!caseDialog.open) return;
    caseDialog.close();
  }

  document.addEventListener('click', (e) => {
    const caseCard = e.target.closest('.case');
    if (!caseCard) return;
    const item = visibleCaseData(currentScope)[Number(caseCard.dataset.caseIndex)];
    openCaseDialog(item, caseCard);
  });

  caseDialogClose.addEventListener('click', closeCaseDialog);
  caseDialog.addEventListener('click', (e) => {
    if (e.target === caseDialog) closeCaseDialog();
  });
  caseDialog.addEventListener('close', () => {
    if (caseReturnFocus && caseReturnFocus.isConnected) caseReturnFocus.focus();
    caseReturnFocus = null;
  });

  caseDialogPrimary.addEventListener('click', () => {
    if (!activeCase) return;
    prompt.value = activeCase.prompt;
    closeCaseDialog();
    autoResize();
    refreshSendState();
    requestAnimationFrame(() => {
      prompt.focus();
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    });
  });

  /* 摘要浮窗中的两个列表始终同时展示；点击任一文件后关闭浮窗，
     并复用工具工作区已有的文件预览。 */
  summaryExpandRecent.addEventListener('click', () => {
    recentFilesExpanded = !recentFilesExpanded;
    renderRecentFiles();
  });

  recentFiles.addEventListener('click', (e) => {
    const item = e.target.closest('[data-recent-index]');
    if (!item) return;
    const entry = recentOpenedFiles[Number(item.dataset.recentIndex)];
    if (!entry) return;
    setSummaryOpen(false);
    openArtifactPreview(entry.node, entry.chain);
  });

  fileGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.fitem');
    if (!item) return;

    const node = (currentNode().files || [])[Number(item.dataset.fileIndex)];
    if (!node || node.type === 'folder') return;
    setSummaryOpen(false);
    openArtifactPreview(node, filePath.concat(node));
  });

  /* ---------- 5.6 示例对话 ----------
     选中左侧指定任务后，首页让位给一轮对话；对话和产物面板打开的文件
     统一进入右侧页签，并在本次对话中保留到用户手动关闭。 */
  const mainView = document.querySelector('.main');
  const conversationPage = document.getElementById('conversationPage');
  const conversationThread = document.getElementById('conversationThread');
  const conversationScroll = document.getElementById('conversationScroll');
  const conversationPrompt = document.getElementById('conversationPrompt');
  const conversationComposer = document.getElementById('conversationComposer');
  const conversationSend = document.getElementById('conversationSend');
  const conversationTask = document.getElementById('demoConversationTask');
  const conversationTaskTitle = document.getElementById('conversationTaskTitle');
  const conversationArtifact = document.getElementById('conversationArtifact');
  const newTaskNav = document.getElementById('newTaskNav');

  function setConversationOpen(open) {
    mainView.classList.toggle('conversation-open', open);
    conversationPage.hidden = !open;
    conversationTask.setAttribute('aria-current', open ? 'page' : 'false');
    if (open && conversationTaskTitle) {
      conversationTaskTitle.textContent = conversationTask.querySelector('.task-name')?.textContent.trim() || '当前任务';
    }
if (!summaryPopover.hidden) renderSummaryContents();
if (open) {
      setWorkbench(false);
      requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
    }
  }

  function resizeConversationPrompt() {
    conversationPrompt.style.height = 'auto';
    conversationPrompt.style.height = `${Math.min(conversationPrompt.scrollHeight, 130)}px`;
    conversationSend.disabled = !conversationPrompt.value.trim();
  }

  function sendConversationMessage() {
    const text = conversationPrompt.value.trim();
    if (!text) return;
    conversationThread.insertAdjacentHTML('beforeend',
      `<div class="conversation-message user-message"><div class="message-bubble">${esc(text)}</div></div>`);
    conversationPrompt.value = '';
    resizeConversationPrompt();
    requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
  }

  conversationTask.addEventListener('click', (e) => {
    if (e.target.closest('[data-toggle-agents], .row-acts, .row-act')) return;
    e.preventDefault();
    setConversationOpen(true);
  });
  newTaskNav.addEventListener('click', (e) => {
    e.preventDefault();
    setConversationOpen(false);
    requestAnimationFrame(() => prompt.focus());
  });
  conversationPrompt.addEventListener('input', resizeConversationPrompt);
  conversationPrompt.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    sendConversationMessage();
  });
  conversationSend.addEventListener('click', sendConversationMessage);
  conversationArtifact.addEventListener('click', () => {
    const node = FOLDERS[0].files.find((file) => file.name === '门店履约异常看板.html');
    if (node) openArtifactPreview(node, [FOLDERS[0], node]);
  });

  /* ---------- 5.6 浏览器工作区 ---------- */
  function navigate(input) {
    const q = input.trim();
    if (!q) return;
    const isUrl = /^(https?:\/\/|[\w-]+\.[a-z]{2,})/i.test(q);
    const title = isUrl ? q.replace(/^https?:\/\//, '').split('/')[0] : q;
    urlInput.value = isUrl ? q : `搜索：${q}`;
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace && workspace.kind === 'browser');
    if (item) {
      item.title = title;
      item.url = urlInput.value;
      const tabTitle = workspaceTabs.querySelector(`[data-workspace-tab="${item.id}"] .workspace-tab-title`);
      if (tabTitle) tabTitle.textContent = title;
    }
    console.log('[CatPaw] 浏览器', isUrl ? '打开' : '搜索', '：', q);
  }

  urlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    navigate(urlInput.value);
  });

  const SITES = { Google: 'https://www.google.com', GitHub: 'https://github.com', 学城: 'https://km.sankuai.com' };
  workbench.querySelectorAll('.wb-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const url = SITES[chip.textContent.trim()];
      if (url) navigate(url);
    });
  });

  // ⌘/Ctrl + T 与加号里的「浏览器」保持同一语义。
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
      if (rightPanel !== 'tools') return;
      e.preventDefault();
      createWorkspace('browser');
      urlInput.value = '';
    }
  });

  setWorkbench(false);

  /* ---------- 5.7 手机端下载 ---------- */
  const mobileEntry = document.getElementById('mobileEntry');
  const mobileBtn = document.getElementById('mobileBtn');

  function setMobilePop(open) {
    mobileEntry.classList.toggle('open', open);
    mobileBtn.setAttribute('aria-expanded', String(open));
  }

  mobileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobilePop(!mobileEntry.classList.contains('open'));
  });

  // 悬停预览
  let hoverTimer = null;
  mobileEntry.addEventListener('mouseenter', () => {
    hoverTimer = setTimeout(() => setMobilePop(true), 340);
  });
  mobileEntry.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
  });

  // 点击外部 / Esc 关闭
  document.addEventListener('click', (e) => {
    if (!mobileEntry.contains(e.target)) setMobilePop(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMobilePop(false);
  });

  /* ---------- 6. 交通灯（侧边栏 / 主区两处） ---------- */
  document.querySelectorAll('.light.close').forEach((btn) => {
    btn.addEventListener('click', () => {
      win.style.transition = 'opacity .2s ease, transform .2s ease';
      win.style.opacity = '0';
      win.style.transform = 'scale(.98)';
      setTimeout(() => {
        win.style.opacity = '';
        win.style.transform = '';
      }, 700);
    });
  });

  /* 初始化 */
  autoResize();
  refreshSendState();
  refreshClipped();
})();
