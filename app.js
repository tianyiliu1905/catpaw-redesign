/* ============================================================
   CatPaw Desktop — 交互
   ============================================================ */
(function () {
  'use strict';

  const themeButtons = document.querySelectorAll('[data-set-theme]');
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme)));
    try { localStorage.setItem('catpaw-theme', theme); } catch (_) { /* Keep switching without storage. */ }
  }
  const initialTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  themeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.setTheme === initialTheme));
    button.addEventListener('click', () => setTheme(button.dataset.setTheme));
  });

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

  // body 下的 fixed 菜单不受应用窗口 overflow 裁切，定位时必须使用白色窗口而非浏览器视口。
  function menuBounds() {
    const rect = win.getBoundingClientRect();
    // 为菜单阴影预留空间，避免菜单本体在窗口内而阴影仍渗入外层灰区。
    const inset = 32;
    return {
      left: rect.left + inset,
      top: rect.top + inset,
      right: rect.right - inset,
      bottom: rect.bottom - inset,
    };
  }

  function placeWindowMenu(menu, x, below, above) {
    const bounds = menuBounds();
    menu.style.maxWidth = `${Math.max(0, bounds.right - bounds.left)}px`;
    menu.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top)}px`;
    menu.style.overflow = 'auto';
    const rect = menu.getBoundingClientRect();
    const left = Math.max(bounds.left, Math.min(x, bounds.right - rect.width));
    const top = below + rect.height <= bounds.bottom ? below : above - rect.height;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(Math.max(bounds.top, Math.min(top, bounds.bottom - rect.height)))}px`;
  }

  const collapseBtn = document.getElementById('toggleSidebar');
  const expandBtn = document.getElementById('expandSidebar');
  const conversationExpandBtn = document.getElementById('expandSidebarFromConversation');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const SIDEBAR_COLLAPSE_THRESHOLD = 156;
  let preferredSidebarWidth = null;
  let sidebarResizePointer = null;
  let sidebarCollapseReady = false;
  let adaptiveLayoutReady = false;

  function sidebarBounds() {
    const available = win.clientWidth;
    const mainContent = document.getElementById('content');
    const rightWidth = mainContent.classList.contains('wb-open') && !mainContent.classList.contains('wb-expanded') &&
      !mainContent.classList.contains('wb-auto-collapsed')
      ? parseFloat(mainContent.style.getPropertyValue('--user-panel-w')) || 0 : 0;
    return { min: 188, max: Math.max(188, Math.min(480, available - rightWidth - 320)) };
  }

  function syncSidebarWidth() {
    if (win.classList.contains('collapsed')) return;
    const bounds = sidebarBounds();
    const defaultWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'));
    const width = Math.round(Math.min(bounds.max, Math.max(bounds.min, preferredSidebarWidth ?? defaultWidth)));
    win.style.setProperty('--user-sidebar-w', `${width}px`);
    sidebarResizer.setAttribute('aria-valuemin', '0');
    sidebarResizer.setAttribute('aria-valuemax', String(bounds.max));
    sidebarResizer.setAttribute('aria-valuenow', String(width));
  }

  function setCollapsed(collapsed) {
    win.classList.toggle('collapsed', collapsed);
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    expandBtn.setAttribute('aria-expanded', String(!collapsed));
    conversationExpandBtn.setAttribute('aria-expanded', String(!collapsed));
    if (adaptiveLayoutReady) syncAdaptiveLayout();
    else if (!collapsed) syncSidebarWidth();
  }

  function finishSidebarResize(event) {
    if (sidebarResizePointer === null || (event && event.pointerId !== sidebarResizePointer)) return;
    const pointerId = sidebarResizePointer;
    sidebarResizePointer = null;
    const collapse = event?.type === 'pointerup' && sidebarCollapseReady &&
      preferredSidebarWidth !== null && preferredSidebarWidth < SIDEBAR_COLLAPSE_THRESHOLD;
    sidebarCollapseReady = false;
    if (sidebarResizer.hasPointerCapture?.(pointerId)) sidebarResizer.releasePointerCapture(pointerId);
    win.classList.remove('is-resizing');
    document.body.classList.remove('is-resizing-panels');
    if (collapse) {
      preferredSidebarWidth = null;
      requestAnimationFrame(() => setCollapsed(true));
    } else {
      preferredSidebarWidth = Math.max(sidebarBounds().min, preferredSidebarWidth ?? sidebarBounds().min);
      syncAdaptiveLayout();
    }
  }

  sidebarResizer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || win.classList.contains('collapsed') || win.classList.contains('sidebar-auto-collapsed')) return;
    event.preventDefault();
    // 只有从最小宽度开始的下一次拖拽，才能越过断点收起侧边栏。
    sidebarCollapseReady = Number(sidebarResizer.getAttribute('aria-valuenow')) <= sidebarBounds().min;
    sidebarResizePointer = event.pointerId;
    sidebarResizer.setPointerCapture(event.pointerId);
    win.classList.add('is-resizing');
    document.body.classList.add('is-resizing-panels');
  });
  sidebarResizer.addEventListener('pointermove', (event) => {
    if (sidebarResizePointer !== event.pointerId) return;
    const width = event.clientX - win.getBoundingClientRect().left;
    const bounds = sidebarBounds();
    preferredSidebarWidth = Math.min(bounds.max, Math.max(sidebarCollapseReady ? 0 : bounds.min, width));
    win.style.setProperty('--user-sidebar-w', `${preferredSidebarWidth}px`);
    sidebarResizer.setAttribute('aria-valuenow', String(Math.round(preferredSidebarWidth)));
  });
  sidebarResizer.addEventListener('pointerup', finishSidebarResize);
  sidebarResizer.addEventListener('pointercancel', finishSidebarResize);
  sidebarResizer.addEventListener('lostpointercapture', finishSidebarResize);
  sidebarResizer.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const bounds = sidebarBounds();
    if (event.key === 'Home' || (event.key === 'ArrowLeft' && Number(sidebarResizer.getAttribute('aria-valuenow')) <= bounds.min)) {
      preferredSidebarWidth = null;
      setCollapsed(true);
      (document.getElementById('conversationPage').hidden ? expandBtn : conversationExpandBtn).focus();
      return;
    }
    const current = Number(sidebarResizer.getAttribute('aria-valuenow'));
    preferredSidebarWidth = event.key === 'End' ? bounds.max : Math.min(bounds.max, Math.max(bounds.min, current + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 32 : 16)));
    syncAdaptiveLayout();
  });
  const sidebarLayoutObserver = new ResizeObserver(() => {
    if (adaptiveLayoutReady) syncAdaptiveLayout();
  });
  sidebarLayoutObserver.observe(win);

  collapseBtn.addEventListener('click', () => setCollapsed(true));
  expandBtn.addEventListener('click', () => setCollapsed(false));
  conversationExpandBtn.addEventListener('click', () => setCollapsed(false));

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
  const looseTasksInner = document.createElement('div');
  looseTasksInner.className = 'loose-tasks-inner';
  while (looseTasksEl.firstChild) looseTasksInner.appendChild(looseTasksEl.firstChild);
  looseTasksEl.appendChild(looseTasksInner);
  const groups     = Array.from(document.querySelectorAll('[data-group]'));
  const labelTasks   = document.getElementById('labelTasks');
  const labelFolders = document.getElementById('labelFolders');
  const toggleTasksSection = document.getElementById('toggleTasksSection');
  const toggleFoldersSection = document.getElementById('toggleFoldersSection');
  const folderGroupsEl = document.getElementById('folderGroups');

  function setSectionExpanded(button, content, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
    content.hidden = !expanded;
    requestAnimationFrame(refreshClipped);
  }

  toggleTasksSection.addEventListener('click', () => {
    const expanded = toggleTasksSection.getAttribute('aria-expanded') !== 'true';
    toggleTasksSection.setAttribute('aria-expanded', String(expanded));
    looseTasksEl.classList.toggle('folded', !expanded);
    looseTasksEl.inert = !expanded;
    requestAnimationFrame(refreshClipped);
  });
  toggleFoldersSection.addEventListener('click', () => {
    setSectionExpanded(toggleFoldersSection, folderGroupsEl, folderGroupsEl.hidden);
  });

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

toggleTasksSection.parentElement.hidden = shown === 0;
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
toggleFoldersSection.parentElement.hidden = groups.length === 0;
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
        { name: '门店履约分析.docx', type: 'word', artifact: true, preview: {
          kind: 'word', title: '门店履约分析', sections: [
            { heading: '一、分析概览', paragraphs: ['本报告汇总门店履约异常情况，聚焦晚高峰时段的超时订单与运力匹配问题。以下为可编辑的演示数据。', '观察周期：2026 年 9 月 21 日；分析范围：上海虹桥店及周边商圈。'] },
            { heading: '二、核心发现', paragraphs: ['当日超时订单 128 单，占订单总量的 6.2%。其中 83% 集中于 17:00–19:00，峰值时段骑手供给不足。', '同商圈另外两家门店没有出现相同幅度波动，初步排除平台级派单异常。'] },
            { heading: '三、行动建议', paragraphs: ['晚高峰前置增配 2 名骑手，连续观察 7 天的超时率与单均配送时长。', '逐单核对异常订单，并与渠道方确认 13:45 后的数据延迟原因。'] },
          ],
        } },
        { name: '门店履约异常明细.xlsx', type: 'excel', artifact: true, preview: {
          kind: 'excel', sheets: [
            { name: '异常明细', columns: ['日期', '门店', '时段', '订单量', '超时单', '超时率', '主要原因'], rows: [
              ['09-21', '上海虹桥店', '11:00–13:00', '318', '11', '', '午间集中下单'],
              ['09-21', '上海虹桥店', '17:00–19:00', '452', '106', '', '晚高峰运力不足'],
              ['09-21', '上海虹桥店', '19:00–21:00', '281', '11', '', '个别订单延迟'],
              ['09-21', '静安寺店', '17:00–19:00', '306', '13', '', '天气影响'],
              ['09-21', '徐家汇店', '17:00–19:00', '295', '9', '', '正常波动'],
            ] },
            { name: '行动跟踪', columns: ['事项', '负责人', '截止日期', '状态', '备注'], rows: [
              ['晚高峰增配骑手', '配送运营', '09-22', '进行中', '计划增配 2 人'],
              ['超时订单逐单复核', '门店经理', '09-23', '待开始', '优先核对高峰时段'],
              ['核查渠道数据延迟', '数据团队', '09-24', '已完成', '确认上游延迟'],
            ] },
          ],
        } },
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
        { name: 'AI 工具约束配置报告.docx', type: 'word', artifact: true, preview: {
          kind: 'word', title: 'AI 工具约束配置报告', sections: [
            { heading: '配置概览', paragraphs: ['已梳理 AI 工具的权限边界、文件访问范围与执行约束。'] },
            { heading: '校验结果', paragraphs: ['配置项检查完成，关键约束均已生效。'] },
          ],
        } },
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
    /* PPT 与其他办公文件共用纸张图示，不在概览中绘制封面缩略图。 */
    ppt: () => productFile('P', '#e76f3c', '<rect x="10" y="20" width="27" height="17" rx="1"/><path d="M15 42h17"/>'),
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
      return `<div class="summary-file-row" data-recent-index="${index}">` +
        `<button class="fitem recent-file" type="button" data-file-type="${type || 'file'}" title="${esc(entry.node.name)}">` +
        `<span class="fthumb">${thumb}</span><span class="fname">${esc(entry.node.name)}</span></button>` +
        `<button class="summary-file-more" type="button" aria-label="更多操作：${esc(entry.node.name)}" aria-haspopup="menu" title="更多操作">` +
        `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g></svg></button></div>`;
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

    // 保留文件夹中的原顺序，同时携带原下标供摘要操作回查同一节点。
    fileGrid.innerHTML = GRADIENT_DEFS + files
      .map(({ f, i }) => {
        const type = artifactType(f);
        const thumb = (THUMBS[type] || THUMBS.doc)();
        return (
          `<div class="summary-file-row" data-file-index="${i}">` +
          `<button class="fitem" type="button" data-file-type="${type}" title="${esc(f.name)}">` +
          `<span class="fthumb">${thumb}</span><span class="fname">${esc(f.name)}</span></button>` +
          `<button class="summary-file-more" type="button" aria-label="更多操作：${esc(f.name)}" aria-haspopup="menu" title="更多操作">` +
          `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g></svg></button></div>`
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

  function spreadsheetCell(sheet, row, column) {
    if (sheet.name === '异常明细' && column === 5) {
      const orders = Number(sheet.rows[row]?.[3]) || 0;
      const late = Number(sheet.rows[row]?.[4]) || 0;
      return orders ? `${(late / orders * 100).toFixed(1)}%` : '—';
    }
    return String(sheet.rows[row]?.[column] ?? '');
  }

  function renderWordPreview(preview, item) {
    const zoom = item.officeZoom || 100;
    const sections = preview.sections.map((section, sectionIndex) => `
      <section class="word-section" id="word-section-${sectionIndex}">
        <h2>${esc(section.heading)}</h2>
        ${section.paragraphs.map((text, paragraphIndex) => `<p contenteditable="true" role="textbox" aria-multiline="true"
          aria-label="${esc(section.heading)}第 ${paragraphIndex + 1} 段" data-word-section="${sectionIndex}" data-word-paragraph="${paragraphIndex}" spellcheck="false">${esc(text)}</p>`).join('')}
      </section>`).join('');
    return `<div class="pv-office pv-word" aria-label="文档演示预览">
      <div class="office-toolbar"><span>开始</span><span>插入</span><span>布局</span><span>审阅</span><span class="office-status" aria-live="polite">${item.officeEdited ? '已编辑 · 当前会话' : '已保存'}</span></div>
      <div class="word-layout"><nav class="word-outline" aria-label="文档大纲"><strong>大纲</strong>${preview.sections.map((section, index) => `<button type="button" data-word-jump="${index}">${esc(section.heading)}</button>`).join('')}</nav>
        <div class="word-canvas"><article class="word-page" style="--office-zoom:${zoom / 100}"><h1>${esc(preview.title)}</h1><div class="word-subtitle">上海虹桥店 · 2026 年 9 月 21 日</div><hr>${sections}<footer>由 CatPaw 生成 · 演示文档</footer></article></div></div>
      <div class="office-footer"><span>第 1 页 · 共 1 页</span><div class="office-zoom"><button type="button" data-office-zoom="-10" aria-label="缩小文档">−</button><span>${zoom}%</span><button type="button" data-office-zoom="10" aria-label="放大文档">＋</button></div></div>
    </div>`;
  }

  function renderExcelPreview(preview, item) {
    const sheetIndex = Math.min(item.officeSheet || 0, preview.sheets.length - 1);
    const sheet = preview.sheets[sheetIndex];
    const query = (item.officeFilter || '').toLocaleLowerCase();
    const rows = sheet.rows.map((row, rowIndex) => ({ row, rowIndex }))
      .filter(({ row, rowIndex }) => !query || sheet.columns.some((_, columnIndex) => spreadsheetCell(sheet, rowIndex, columnIndex).toLocaleLowerCase().includes(query)));
    const letters = sheet.columns.map((_, index) => String.fromCharCode(65 + index));
    return `<div class="pv-office pv-excel" aria-label="表格演示预览">
      <div class="office-toolbar"><span>开始</span><span>插入</span><span>数据</span><span>公式</span><span class="office-status" aria-live="polite">${item.officeEdited ? '已编辑 · 当前会话' : '已保存'}</span></div>
      <div class="excel-actions"><label>查找 <input type="search" data-excel-filter placeholder="筛选当前工作表" value="${esc(item.officeFilter || '').replace(/"/g, '&quot;')}"></label><button type="button" data-excel-add>＋ 添加一行</button><span>${rows.length} / ${sheet.rows.length} 行</span></div>
      <div class="excel-formula"><span data-excel-address>选择单元格</span><span class="excel-fx">ƒx</span><output data-excel-value>选中单元格后显示内容</output></div>
      <div class="excel-scroll"><table class="excel-grid"><thead><tr><th class="excel-corner"></th>${letters.map(letter => `<th>${letter}</th>`).join('')}</tr><tr><th class="excel-row-number">#</th>${sheet.columns.map(name => `<th class="excel-column-name">${esc(name)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ row, rowIndex }) => `<tr><th class="excel-row-number">${rowIndex + 1}</th>${row.map((_, columnIndex) => `<td tabindex="0" data-excel-row="${rowIndex}" data-excel-column="${columnIndex}" data-excel-address="${letters[columnIndex]}${rowIndex + 1}" title="${columnIndex === 5 && sheet.name === '异常明细' ? '根据超时单 ÷ 订单量自动计算' : '双击编辑'}">${esc(spreadsheetCell(sheet, rowIndex, columnIndex))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="excel-tabs" role="tablist" aria-label="工作表">${preview.sheets.map((entry, index) => `<button type="button" role="tab" data-excel-sheet="${index}" aria-selected="${index === sheetIndex}" class="${index === sheetIndex ? 'active' : ''}">${esc(entry.name)}</button>`).join('')}</div>
      <div class="office-footer"><span>工作表 ${sheetIndex + 1} / ${preview.sheets.length}</span><span>超时率按订单量自动计算 · 更改仅保存在当前会话</span></div>
    </div>`;
  }

  const PREVIEWS = {
    word: (preview, item) => renderWordPreview(preview, item),
    excel: (preview, item) => renderExcelPreview(preview, item),
    /* PPT：参考桌面演示文稿编辑器，直接展示可辨认的编辑态，而不是文件占位。 */
    ppt: () => `<div class="pv-ppt" aria-label="季度经营复盘演示文稿预览">
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
      `<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/>` +
      `<path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/></svg>` +
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

  function fitUpwardMenu(menu, trigger) {
    menu.style.maxHeight = `${Math.max(0, trigger.getBoundingClientRect().top - 16)}px`;
  }

  function setFolderOpen(open) {
    if (open) fitUpwardMenu(folderMenu, folderBtn);
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
            `<svg viewBox="0 0 24 24" class="ic"><path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/></svg>` +
            `<span class="folder-opt-name">${f.name}</span>` +
            `<svg viewBox="0 0 24 24" class="ic tick"><path d="m5 12 4.5 4.5L19 7"/></svg>` +
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
      `<svg viewBox="0 0 24 24" class="ic"><path d="M3 11.2V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v1.4"/><path d="M3.2 11.2h17.6c1.2 0 1.7.8 1.4 2l-.8 5c-.3 1.8-1.1 2.6-2.7 2.6H5.3c-1.6 0-2.4-.8-2.7-2.6l-.8-5c-.3-1.2.2-2 1.4-2Z"/><path d="M9.5 16h5"/></svg>` +
      `<span>选择文件夹…</span>` +
      `</button>` +
      `<button class="folder-act" data-folder-act="create">` +
      `<svg viewBox="0 0 24 24" class="ic"><path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M12 10.5v6M9 13.5h6"/></svg>` +
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
    if (open) fitUpwardMenu(branchMenu, branchBtn);
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
            `<svg viewBox="0 0 24 24" class="ic"><path d="M6 3v12M18 9a9 9 0 0 1-9 9"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/></svg>` +
            `<span class="branch-opt-name">${b.name}</span>` +
            meta +
            `<svg viewBox="0 0 24 24" class="ic tick"><path d="m5 12 4.5 4.5L19 7"/></svg>` +
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
  let caseThumbResizeObserver = null;

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

  /* ---------- 2. 分组折叠与文件夹操作 ---------- */
  function initSidebarGroup(group) {
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
      updateToggleAllFolders();
      requestAnimationFrame(refreshClipped);
    });
  }
  groups.forEach(initSidebarGroup);

  const toggleAllFolders = document.getElementById('toggleAllFolders');
  const folderSortButton = document.getElementById('folderSortButton');
  const folderSortMenu = document.getElementById('folderSortMenu');
  let folderLayout = 'project';
  let folderOrder = 'updated';
  let showAllFolderTasks = true;
  const folderSequence = new Map(groups.map((group, index) => [group, index]));
  const folderUpdateSequence = new Map(groups.map((group, index) => [group, index]));

  function updateToggleAllFolders() {
    const allFolded = groups.length > 0 && groups.every((group) => group.classList.contains('folded'));
    const label = allFolded ? '全部展开' : '全部收起';
    toggleAllFolders.title = label;
    toggleAllFolders.setAttribute('aria-label', label);
    toggleAllFolders.dataset.allFolded = String(allFolded);
  }
  toggleAllFolders.addEventListener('click', () => {
    if (folderLayout === 'time') { folderLayout = 'project'; applyFolderSort(); }
    const shouldFold = groups.some((group) => !group.classList.contains('folded'));
    groups.forEach((group) => {
      group.classList.toggle('folded', shouldFold);
      group.querySelector('[data-toggle-group]').setAttribute('aria-expanded', String(!shouldFold));
    });
    updateToggleAllFolders();
    requestAnimationFrame(refreshClipped);
  });

  function closeFolderSort() {
    folderSortMenu.hidden = true;
    folderSortButton.setAttribute('aria-expanded', 'false');
  }
  folderSortButton.addEventListener('click', () => {
    const open = folderSortMenu.hidden;
    if (!open) { closeFolderSort(); return; }
    folderSortMenu.hidden = false;
    const button = folderSortButton.getBoundingClientRect();
    const menu = folderSortMenu.getBoundingClientRect();
    folderSortMenu.style.left = `${Math.max(8, Math.min(button.right - menu.width, window.innerWidth - menu.width - 8))}px`;
    folderSortMenu.style.top = `${button.bottom + menu.height + 8 <= window.innerHeight ? button.bottom + 5 : Math.max(8, button.top - menu.height - 5)}px`;
    folderSortButton.setAttribute('aria-expanded', 'true');
  });
  function applyFolderSort() {
    folderGroupsEl.classList.toggle('time-list', folderLayout === 'time');
    folderGroupsEl.classList.toggle('show-all', showAllFolderTasks);
    groups.sort((a, b) => folderOrder === 'created'
      ? folderSequence.get(b) - folderSequence.get(a)
      : folderUpdateSequence.get(a) - folderUpdateSequence.get(b));
    groups.forEach((group) => folderGroupsEl.appendChild(group));
    // 时间列表脱离文件夹标题，按示例任务所显示的相对时间排序；无时间的任务保持原顺序。
    let taskIndex = 0;
    folderGroupsEl.querySelectorAll('.group .task').forEach((task) => {
      const time = task.querySelector('.task-time')?.textContent?.trim();
      const match = time?.match(/^(\d+)([hmd])$/);
      const minutes = match ? Number(match[1]) * ({ m: 1, h: 60, d: 1440 }[match[2]]) : null;
      task.style.order = String(folderOrder === 'created'
        ? -taskIndex++
        : minutes === null ? 100000 + taskIndex++ : minutes);
    });
    folderSortMenu.querySelectorAll('[data-folder-layout]').forEach((item) => item.setAttribute('aria-checked', String(item.dataset.folderLayout === folderLayout)));
    folderSortMenu.querySelectorAll('[data-folder-order]').forEach((item) => item.setAttribute('aria-checked', String(item.dataset.folderOrder === folderOrder)));
    folderSortMenu.querySelector('[data-folder-show-all]').setAttribute('aria-checked', String(showAllFolderTasks));
    requestAnimationFrame(refreshClipped);
  }
  folderSortMenu.addEventListener('click', (e) => {
    const option = e.target.closest('.folder-sort-option');
    if (!option) return;
    if (option.dataset.folderLayout) folderLayout = option.dataset.folderLayout;
    if (option.dataset.folderOrder) folderOrder = option.dataset.folderOrder;
    if (option.hasAttribute('data-folder-show-all')) showAllFolderTasks = !showAllFolderTasks;
    applyFolderSort();
    closeFolderSort();
    folderSortButton.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!folderSortMenu.contains(e.target) && e.target !== folderSortButton && !folderSortButton.contains(e.target)) closeFolderSort();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !folderSortMenu.hidden) { closeFolderSort(); folderSortButton.focus(); }
  });
  window.addEventListener('resize', closeFolderSort);
  window.addEventListener('scroll', closeFolderSort, true);

  updateToggleAllFolders();
  applyFolderSort();

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
    '<svg viewBox="0 0 24 24" class="ic dots"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g></svg>';
  const PLUS_SVG =
    '<svg viewBox="0 0 24 24" class="ic"><path d="M12 5v14M5 12h14"/></svg>';

  function makeAct(action, label, svg) {
    return (
      `<span class="row-act" role="button" tabindex="0"` +
      ` data-act="${action}" title="${label}" aria-label="${label}">${svg}</span>`
    );
  }

  /* 普通任务保留「更多」操作，SubAgent 只显示执行状态。 */
  document.querySelectorAll('.task:not(.subagent-task)').forEach((task) => {
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

     左侧任务与对话标题共用菜单项；左侧只建一个菜单实例，
     差别由 menuRow 记录当前作用的任务。 */
  const TASK_MENU = [
    { act: 'pin', label: '置顶',
      svg: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' },
    { act: 'rename', label: '重命名',
      svg: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>' },
    { act: 'copy-directory', label: '复制工作目录', divider: true,
      svg: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>' },
    { act: 'copy-id', label: '复制会话 ID',
      svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
    { act: 'delete', label: '删除', divider: true, danger: true,
      svg: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' },
  ];
  const taskHomes = new WeakMap();
  const taskIds = new WeakMap();
  let nextTaskId = 1;
  document.querySelectorAll('.task').forEach((task) => {
    const container = task.matches('.task-parent') ? task.closest('[data-agent-task]') : task;
    if (!taskHomes.has(container)) taskHomes.set(container, { parent: container.parentElement, next: container.nextSibling });
    taskIds.set(task, task.id === 'demoConversationTask' ? 'demo-conversation-store-fulfillment' : `demo-conversation-${nextTaskId++}`);
  });

  function renderTaskMenu(items, attribute) {
    return items.map(({ act, label, svg, divider, danger }) =>
      `<button type="button" role="menuitem" class="row-menu-item${danger ? ' danger' : ''}" ${attribute}="${act}"${divider ? ' data-divider' : ''}>` +
      `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${svg}</svg><span>${label}</span></button>`
    ).join('');
  }

  const rowMenu = document.createElement('div');
  rowMenu.className = 'row-menu';
  rowMenu.setAttribute('role', 'menu');
  rowMenu.hidden = true;
  rowMenu.innerHTML = renderTaskMenu(TASK_MENU, 'data-menu-act');
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

    rowMenu.querySelector('[data-menu-act="pin"] span').textContent = (row.matches('.task-parent') ? row.closest('[data-agent-task]') : row).dataset.pinned === 'true' ? '取消置顶' : '置顶';
    rowMenu.hidden = false;
    rowMenu.style.visibility = 'hidden';
    rowMenu.style.left = '0px';
    rowMenu.style.top  = '0px';
    /* 入场动画的 scale(.97) 也会作用在测量结果上——量到的宽高比实际
       小 3%，右对齐会因此偏出几个像素。测量期间先抹平，量完再交还给 CSS。 */
    rowMenu.style.transform = 'none';

    const btn = actBtn.getBoundingClientRect();
    const menu = rowMenu.getBoundingClientRect();
    const bounds = menuBounds();
    // 默认与按钮右缘对齐；若超出白色窗口左边界，改为左对齐。
    const left = btn.right - menu.width < bounds.left ? btn.left : btn.right - menu.width;
    placeWindowMenu(rowMenu, left, btn.bottom + 4, btn.top - 4);
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
    const item = e.target.closest('[data-menu-act]');
    if (!item || !menuRow) return;
    const task = menuRow;
    closeRowMenu();
    void runTaskMenuAction(item.dataset.menuAct, task);
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

  /* 两处输入框分别维护访问模式；安全屋仅用于主页创建任务。 */
  const accessPickers = Array.from(document.querySelectorAll('[data-access-picker]'));
  const safeHouseToggle = document.getElementById('safeHouseToggle');
  const homeComposerFoot = safeHouseToggle.closest('.composer-foot');

  function closeAccessMenus(except = null) {
    accessPickers.forEach((picker) => {
      if (picker === except) return;
      picker.querySelector('.access-menu').hidden = true;
      picker.querySelector('.foot-item').setAttribute('aria-expanded', 'false');
    });
  }

  function selectAccessMode(picker, option, pageName, restoreFocus = true) {
    const trigger = picker.querySelector('.foot-item');
    const menu = picker.querySelector('.access-menu');
    picker.querySelector('[data-access-label]').textContent = option.textContent;
    trigger.setAttribute('aria-label', `${pageName}访问模式：${option.textContent}`);
    menu.querySelectorAll('[data-access-mode]').forEach((item) => {
      item.setAttribute('aria-checked', String(item.dataset.accessMode === option.dataset.accessMode));
    });
    closeAccessMenus();
    if (restoreFocus) trigger.focus();
  }

  accessPickers.forEach((picker) => {
    const trigger = picker.querySelector('.foot-item');
    const menu = picker.querySelector('.access-menu');
    const pageName = picker.closest('.conversation-page') ? '对话' : '主页';
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = menu.hidden;
      closeAccessMenus();
      if (opening) {
        setFolderOpen(false);
        setBranchOpen(false);
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
    menu.addEventListener('click', (event) => {
      const option = event.target.closest('[data-access-mode]');
      if (!option) return;
      selectAccessMode(picker, option, pageName);
    });
  });

  function toggleSafeHouse() {
    const active = safeHouseToggle.getAttribute('aria-pressed') !== 'true';
    safeHouseToggle.setAttribute('aria-pressed', String(active));
    homeComposerFoot.classList.toggle('safe-house-active', active);
    homeComposerFoot.closest('.composer').classList.toggle('safe-house-active', active);
    closeAccessMenus();
  }
  safeHouseToggle.addEventListener('click', toggleSafeHouse);

  const footMore = homeComposerFoot.querySelector('.composer-foot-more');
  const footMoreTrigger = footMore.querySelector('.composer-foot-more-trigger');
  const footMoreMenu = footMore.querySelector('.composer-foot-more-menu');
  const homeAccessPicker = homeComposerFoot.querySelector('[data-access-picker]');
  function syncFootMore() {
    const mode = homeAccessPicker.querySelector('[data-access-mode][aria-checked="true"]').dataset.accessMode;
    footMoreMenu.querySelectorAll('[data-foot-access-mode]').forEach((item) => {
      item.setAttribute('aria-checked', String(item.dataset.footAccessMode === mode));
    });
    footMoreMenu.querySelector('[data-foot-safe-house]').setAttribute('aria-checked', safeHouseToggle.getAttribute('aria-pressed'));
  }
  function closeFootMore(restoreFocus = false) {
    if (footMoreMenu.hidden) return;
    footMoreMenu.hidden = true;
    footMoreTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && getComputedStyle(footMore).display !== 'none') footMoreTrigger.focus();
  }
  footMoreTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!footMoreMenu.hidden) { closeFootMore(); return; }
    closeAccessMenus();
    setFolderOpen(false);
    setBranchOpen(false);
    syncFootMore();
    footMoreMenu.hidden = false;
    footMoreTrigger.setAttribute('aria-expanded', 'true');
    footMoreMenu.querySelector('button').focus();
  });
  footMoreMenu.addEventListener('click', (event) => {
    const mode = event.target.closest('[data-foot-access-mode]');
    const safeHouse = event.target.closest('[data-foot-safe-house]');
    if (!mode && !safeHouse) return;
    event.stopPropagation();
    if (mode) selectAccessMode(homeAccessPicker, homeAccessPicker.querySelector(`[data-access-mode="${mode.dataset.footAccessMode}"]`), '主页', false);
    else toggleSafeHouse();
    syncFootMore();
    closeFootMore(true);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-access-picker]')) closeAccessMenus();
    if (!footMore.contains(event.target)) closeFootMore();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAccessMenus();
    if (!footMoreMenu.hidden) { event.preventDefault(); closeFootMore(true); }
  });
  new ResizeObserver(() => {
    if (getComputedStyle(footMore).display === 'none') closeFootMore();
  }).observe(homeComposerFoot.closest('.main'));

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
    prompt.style.setProperty('--prompt-chip-indent', text ? `${promptChip.getBoundingClientRect().width + 8}px` : '0px');
    autoResize();
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
          '创建餐饮门店经营看板',
          '创建物流履约时效看板',
          '创建市场投放效果看板',
          '创建用户复购分析看板',
          '创建连锁餐饮成本分析看板',
        ],
        cases: [
          { kind: 'dashboard', type: '餐饮数据看板', title: '连锁餐饮门店经营看板', prompt: '汇总各区域餐饮门店的订单量、营业额、客单价和翻台率，对比目标与上期，突出经营异常门店并支持区域筛选。' },
          { kind: 'dashboard', type: '物流数据看板', title: '同城配送履约时效看板', prompt: '按城市、时段和配送站点分析配送量、准时率、平均配送时长和超时原因，标记需要优先处理的站点。' },
          { kind: 'dashboard', type: '市场数据看板', title: '餐饮品牌投放效果看板', prompt: '整合餐饮品牌在各渠道的曝光、到店、核销和投入产出数据，比较活动转化与预算效率。' },
          { kind: 'dashboard', type: '用户分析看板', title: '外卖用户复购分析看板', prompt: '按新老客、城市和品类分析外卖用户首购、复购、留存及客单价，识别复购下滑的关键人群。' },
        ],
      },
      files: {
        guide: '帮我整理文件：',
        tag: '整理文件',
        secondary: ['按项目归档工作文件', '批量规范文件命名', '整理会议材料与纪要', '清理重复和过期文件', '生成文件目录与摘要'],
        cases: [
          { kind: 'article', type: '资料目录', title: '餐饮门店巡检资料归档', prompt: '按城市、门店和巡检日期归档餐饮门店的巡检照片、整改记录和验收材料，输出资料目录与缺失项清单。' },
          { kind: 'code', type: '整理规则', title: '物流签收单批量命名规则', prompt: '根据运单号、站点和签收日期制定物流签收单命名规则，识别重复文件并给出批量重命名方案。' },
          { kind: 'article', type: '会议资料', title: '餐饮区域经营会议资料', prompt: '汇总区域餐饮经营会议的指标表、汇报稿、纪要和行动项，按会议日期与议题建立索引。' },
          { kind: 'dashboard', type: '资料分析', title: '市场调研资料清理看板', prompt: '扫描市场调研资料中的重复版本、过期报告和缺少来源的文件，生成分类统计与清理建议。' },
        ],
      },
      slides: {
        guide: '帮我制作幻灯片：',
        tag: '幻灯片',
        secondary: ['制作餐饮季度经营复盘', '制作物流提效方案汇报', '制作市场行业趋势汇报', '制作门店培训课件', '制作餐饮品牌营销提案'],
        cases: [
          { kind: 'deck', type: '经营汇报', title: '连锁餐饮 Q2 经营复盘', prompt: '制作连锁餐饮第二季度经营复盘，展示营业额、门店表现、客单价变化、成本问题和下季度行动计划。' },
          { kind: 'deck', type: '物流提案', title: '同城配送高峰期提效方案', prompt: '制作同城配送高峰期提效汇报，说明订单波峰、运力缺口、调度策略、资源投入和预期履约改善。' },
          { kind: 'deck', type: '行业汇报', title: '现制饮品市场趋势简报', prompt: '制作现制饮品行业趋势简报，梳理消费场景、价格带、品类创新、渠道变化及市场机会。' },
          { kind: 'deck', type: '培训课件', title: '餐饮门店高峰运营培训', prompt: '制作餐饮门店高峰期运营课件，覆盖备餐、排班、出餐协同、异常处理与课后演练。' },
        ],
      },
      article: {
        guide: '帮我写推文：',
        tag: '写推文',
        secondary: ['撰写餐饮新品上市推文', '撰写城市美食节活动推文', '撰写餐饮行业趋势长文', '撰写物流服务客户故事', '撰写品牌节日推广稿'],
        cases: [
          { kind: 'article', type: '餐饮推文', title: '秋季餐饮新品上市推文', prompt: '为连锁餐饮品牌撰写秋季新品上市推文，介绍口味亮点、适用场景和到店体验，引导读者了解活动。' },
          { kind: 'article', type: '活动推文', title: '城市美食节招募推文', prompt: '撰写城市美食节商家招募推文，说明参与权益、报名方式、活动节奏和适合的餐饮商家类型。' },
          { kind: 'article', type: '行业洞察', title: '餐饮消费市场趋势观察', prompt: '围绕餐饮消费市场近期变化撰写洞察文章，梳理价格带、消费场景、品类和渠道趋势，并区分事实与判断。' },
          { kind: 'article', type: '客户案例', title: '餐饮品牌同城配送增长故事', prompt: '撰写餐饮品牌优化同城配送服务的案例故事，呈现履约挑战、协同过程、结果指标和可复用经验。' },
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

  /* 旧版抽象缩略图保留作历史参考；当前案例统一使用下方有内容的示例产物。
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

  /* 案例预览使用有内容的示例产物，而非抽象占位图。首页缩略图与详情共用同一份结构。 */
  function caseArtifact(item, thumbnail = false) {
    const title = esc(item.title);
    if (item.kind === 'dashboard') {
      const isLogistics = /配送|履约|站点/.test(item.title);
      const isRestaurant = !/投放|市场|用户复购|资料清理/.test(item.title) && /餐饮|门店/.test(item.title);
      const isUser = /用户复购/.test(item.title);
      const isArchive = /资料清理/.test(item.title);
      const rows = isLogistics
        ? [['北京 · 朝阳站', '248', '94.8%', '高峰运力不足', '高'], ['上海 · 静安站', '196', '96.2%', '商家出餐慢', '中'], ['广州 · 天河站', '182', '98.1%', '地址异常', '低'], ['成都 · 春熙站', '163', '95.4%', '天气影响', '高']]
        : isRestaurant
          ? [['北京 · 朝阳门店', '248', '104.8%', '高峰排队', '高'], ['上海 · 静安门店', '196', '96.2%', '备货延迟', '中'], ['广州 · 天河门店', '182', '108.1%', '无异常', '低'], ['成都 · 春熙门店', '163', '95.4%', '排班不足', '高']]
          : isUser
            ? [['北京 · 新客', '248', '28.4%', '首购流失', '高'], ['上海 · 老客', '196', '42.2%', '频次下降', '中'], ['广州 · 新客', '182', '36.1%', '无异常', '低'], ['成都 · 老客', '163', '29.4%', '券后流失', '高']]
            : isArchive
              ? [['餐饮调研报告', '248', '84.8%', '版本重复', '中'], ['物流时效资料', '196', '76.2%', '来源缺失', '高'], ['品类研究资料', '182', '98.1%', '无异常', '低'], ['区域市场简报', '163', '85.4%', '资料过期', '中']]
              : [['短视频投放', '248', '8.4%', '成本偏高', '高'], ['本地搜索', '196', '12.2%', '素材疲劳', '中'], ['社群活动', '182', '16.1%', '无异常', '低'], ['达人合作', '163', '9.4%', '核销偏低', '高']];
      const category = isLogistics ? '物流分析 / 配送履约' : isRestaurant ? '餐饮分析 / 门店经营' : isUser ? '数据分析 / 用户复购' : isArchive ? '市场研究 / 资料管理' : '市场分析 / 投放与转化';
      const dimension = isLogistics ? '配送站点' : isRestaurant ? '门店' : isUser ? '用户分层' : isArchive ? '资料类别' : '投放渠道';
      const volume = isLogistics ? '配送量' : isRestaurant ? '订单量' : isUser ? '用户数' : isArchive ? '文件数' : '线索量';
      const rate = isLogistics ? '准时率' : isRestaurant ? '达成率' : isUser ? '复购率' : isArchive ? '有效率' : '转化率';
      return `<div class="case-artifact case-artifact-sheet"><div class="artifact-sheet-body"><div class="artifact-sheet-eyebrow">${category}</div><h3>${title}</h3><p>更新于 09:30 · ${isLogistics ? '全国 4 个站点' : isRestaurant ? '全国 4 家门店' : `4 个${dimension}`}</p><div class="artifact-metrics"><div><small>${isLogistics ? '配送订单量' : isRestaurant ? '门店订单量' : isUser ? '活跃用户数' : isArchive ? '资料总数' : '活动曝光量'}</small><strong>${isLogistics ? '12,486' : isRestaurant ? '8,624' : isUser ? '24,860' : isArchive ? '789' : '186,420'}</strong><em>↑ 8.2%</em></div><div><small>${isLogistics ? '准时送达率' : isRestaurant ? '营业额达成率' : isUser ? '30 日复购率' : isArchive ? '资料有效率' : '到店转化率'}</small><strong>${isLogistics ? '96.4%' : isRestaurant ? '108.6%' : isUser ? '38.2%' : isArchive ? '86.4%' : '12.8%'}</strong><em>↑ 1.3%</em></div><div><small>待处理异常</small><strong>${isLogistics ? '126' : isRestaurant ? '24' : isUser ? '18' : isArchive ? '42' : '38'}</strong><em class="alert">需关注</em></div></div><div class="artifact-chart"><div class="artifact-chart-heading">${isLogistics ? '各站点准时率趋势' : isRestaurant ? '各门店营收趋势' : isUser ? '分层用户复购趋势' : isArchive ? '资料有效率趋势' : '各渠道转化趋势'} <span>近 7 日</span></div><div class="artifact-bars">${[56,68,61,78,70,89,82,93,75,86,95,88].map((n,i) => `<i style="height:${n}%;${i > 8 ? 'background:#38a873' : ''}"></i>`).join('')}</div><div class="artifact-chart-axis">周一 <span>周三</span><span>周五</span><span>今日</span></div></div><div class="artifact-table-wrap"><div class="artifact-table-title">${isLogistics ? '配送站点异常明细' : isRestaurant ? '门店经营明细' : isUser ? '用户分层明细' : isArchive ? '资料清理明细' : '渠道投放明细'} <span>共 ${rows.length} 条</span></div><table><thead><tr><th>${dimension}</th><th>${volume}</th><th>${rate}</th><th>异常类型</th><th>级别</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell,i) => `<td${i === 4 ? ' class="artifact-level"' : ''}>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
    }
    if (item.kind === 'web') {
      const festival = /美食节/.test(item.title);
      return `<div class="case-artifact case-artifact-web"><div class="artifact-web-scroll" tabindex="0" aria-label="滚动查看网页预览"><div class="artifact-web-header"><strong>${festival ? '城市美食节' : '餐饮消费观察'} <span>2026</span></strong><span>首页　 ${festival ? '活动日程　 合作商家' : '行业趋势　 品类洞察'}</span></div><div class="artifact-web-layout"><aside><b>${festival ? '活动导航' : '市场洞察'}</b><span class="selected">${festival ? '本周精选' : '消费概览'}</span><span>${festival ? '主题餐厅' : '热门品类'}</span><span>${festival ? '活动日程' : '价格带'}</span><span>${festival ? '合作商家' : '区域机会'}</span><b>更多内容</b><span>数据与说明</span></aside><main><span class="artifact-web-crumb">${festival ? '城市活动 / 餐饮生活' : '市场行业 / 餐饮消费'}</span><h3>${title}</h3><p>${festival ? '发现街区好味道，逛一场属于城市的美食节。' : '从价格带、品类与消费场景出发，观察本地餐饮的新变化。'}</p><h4>${festival ? '本周活动亮点' : '品类热度观察'}</h4><div class="artifact-web-demo"><span class="primary">${festival ? '查看活动日程' : '现制饮品 ↑ 18%'}</span><span>${festival ? '街区主题餐厅' : '快餐简餐 ↑ 12%'}</span></div><h4>${festival ? '逛吃路线' : '价格带变化'}</h4><p>${festival ? '从午间简餐到夜间小食，按街区和时间发现适合自己的餐饮活动。' : '高性价比套餐与特色单品同步增长，工作日午餐和周末聚餐呈现不同选择。'}</p><div class="artifact-web-demo muted"><span>${festival ? '午市 · 主题套餐' : '20–40 元 · 日常简餐'}</span><span>${festival ? '晚市 · 街区夜食' : '60–100 元 · 聚会餐饮'}</span></div><h4>${festival ? '合作商家' : '区域机会'}</h4><table><tr><th>城市</th><th>${festival ? '特色主题' : '热门场景'}</th><th>关注度</th></tr><tr><td>北京</td><td>${festival ? '胡同小馆' : '工作日午餐'}</td><td>较高</td></tr><tr><td>上海</td><td>${festival ? '创意融合菜' : '周末聚餐'}</td><td>上升</td></tr><tr><td>广州</td><td>${festival ? '岭南风味' : '下午茶'}</td><td>稳定</td></tr></table><h4>说明</h4><p>本页为交互示例，图表和数值均为演示数据，不代表真实市场结论。</p></main></div></div></div>`;
    }
    if (item.kind === 'visual') {
      const festival = /美食节/.test(item.title);
      return `<div class="case-artifact case-artifact-visual"><div class="artifact-poster"><div class="artifact-poster-top"><span>${festival ? 'CITY FOOD FESTIVAL' : 'SEASONAL MENU'}</span><span>2026 / AUTUMN</span></div><div class="artifact-poster-orbit"><span></span></div><div class="artifact-poster-copy"><small>${festival ? '一城好味 · 限时开席' : '餐饮品牌秋季企划'}</small><h3>${festival ? '把城市，<br>吃个遍。' : '秋天的第一口<br>好味道。'}</h3><p>${festival ? '探索街区餐厅与城市限定菜单' : '当季新品 · 现在尝鲜'}</p><strong>${festival ? '查看活动 ↗' : '了解新品 ↗'}</strong></div><div class="artifact-poster-bottom">${festival ? 'TASTE THE CITY' : 'TASTE THE SEASON'} <span>01 — 04</span></div></div></div>`;
    }
    if (item.kind === 'deck') {
      const isDelivery = /配送/.test(item.title);
      const isMarket = /市场|饮品|拓展/.test(item.title);
      const metrics = isDelivery ? [['配送订单', '+18%'], ['准时送达', '96%'], ['超时占比', '4%']]
        : isMarket ? [['品类关注', '+18%'], ['新客占比', '34%'], ['复购意向', '42%']]
          : [['营收达成', '108%'], ['订单增长', '+18%'], ['复购提升', '+12%']];
      const actions = isDelivery ? ['优化高峰时段站点排班', '对异常订单做原因归类', '按城市复盘配送时效']
        : isMarket ? ['筛选值得验证的价格带', '走访重点城市和消费场景', '小范围测试新品与渠道组合']
          : ['优化高峰时段门店协同', '关注单店营收与成本变化', '跟踪客群反馈与复购变化'];
      const slides = [
        `<div class="artifact-slide-cover"><small>CATPAW / BUSINESS REVIEW</small><h3>${title}</h3><p>洞察趋势 · 识别机会 · 推动行动</p><span>2026 · 业务分析示例</span></div>`,
        `<div class="artifact-slide-analysis"><small>01 / KEY METRICS</small><h3>${isDelivery ? '配送高峰表现' : isMarket ? '市场趋势一览' : '门店经营表现'}</h3><div>${metrics.map(([label, value]) => `<span>${label}<strong>${value}</strong></span>`).join('')}</div><p>示例数据：对比不同区域与时段，识别重点业务机会。</p></div>`,
        `<div class="artifact-slide-plan"><small>02 / NEXT STEPS</small><h3>下一阶段行动</h3><p>${isDelivery ? '围绕物流履约持续改善' : isMarket ? '从市场观察走向小范围验证' : '围绕餐饮经营持续改善'}</p><ol>${actions.map(action => `<li>${action}</li>`).join('')}</ol></div>`,
      ];
      const previews = [
        `<span class="artifact-deck-thumb-cover"><small>CATPAW / BUSINESS REVIEW</small><strong>${title}</strong></span>`,
        `<span class="artifact-deck-thumb-analysis"><small>01 / KEY METRICS</small><strong>${isDelivery ? '配送高峰表现' : isMarket ? '市场趋势一览' : '门店经营表现'}</strong><i></i><i></i><i></i></span>`,
        `<span class="artifact-deck-thumb-plan"><small>02 / NEXT STEPS</small><strong>下一阶段行动</strong><i></i><i></i><i></i></span>`,
      ];
      return `<div class="case-artifact case-artifact-deck"><div class="artifact-slide" data-slide="0">${slides[0]}</div>${thumbnail ? '' : `<div class="artifact-deck-carousel" aria-label="幻灯片轮播"><div class="artifact-deck-thumbs">${previews.map((preview, index) => `<button class="artifact-deck-thumb" type="button" data-slide-index="${index}" aria-label="查看第 ${index + 1} 页" aria-current="${index === 0 ? 'true' : 'false'}">${preview}</button>`).join('')}</div><div class="artifact-deck-controls"><button type="button" data-slide-step="-1" aria-label="上一页" disabled>‹</button><span class="artifact-slide-count">1 / ${slides.length}</span><button type="button" data-slide-step="1" aria-label="下一页">›</button></div></div><div class="artifact-slide-data" hidden>${slides.map(slide => `<template>${slide}</template>`).join('')}</div>`}</div>`;
    }
    if (item.kind === 'code') {
      return `<div class="case-artifact case-artifact-code"><div class="artifact-code-body"><div class="artifact-code-tree">▾ analytics<br>　▸ orders<br>　▸ reports<br>　<span>analyze.py</span></div><pre><code><span># ${title}</span>\nfrom collections import defaultdict\n\ndef analyze(orders):\n    by_station = defaultdict(list)\n    for order in orders:\n        key = order["station_id"]\n        by_station[key].append(order)\n\n    return {station: {\n        "orders": len(items),\n        "late_rate": sum(\n            item["is_late"] for item in items\n        ) / len(items),\n    } for station, items in by_station.items()}\n\n<span># 示例结构：实际分析需校验数据口径</span></code></pre></div></div>`;
    }
    const isPromo = /推文|推广/.test(item.title);
    const isLogistics = /配送|物流|签收/.test(item.title);
    const isArchive = /资料|归档/.test(item.title);
    return `<div class="case-artifact case-artifact-document"><div class="artifact-document-scroll" tabindex="0" aria-label="滚动查看文档预览"><article class="artifact-page"><div class="artifact-page-meta">${isPromo ? '餐饮品牌 / 推广内容' : isArchive ? '业务资料 / 归档目录' : isLogistics ? '物流服务 / 案例文档' : '市场行业 / 分析报告'}</div><h3>${title}</h3><p class="artifact-page-lead">${isPromo ? '从城市餐桌出发，发现值得尝试的好味道。' : isArchive ? '按城市、日期和业务环节归类材料，让信息更易查找。' : isLogistics ? '聚焦履约体验与站点协同，梳理可执行的改善路径。' : '从消费场景与品类变化出发，梳理市场信号与行动建议。'}</p><div class="artifact-page-rule"></div><h4>${isPromo ? '一、活动亮点' : isArchive ? '一、资料范围' : '一、背景与研究范围'}</h4><p>${isPromo ? '汇聚城市里的特色餐厅与当季菜单，在不同街区发现适合聚会、工作餐和周末休闲的餐饮选择。' : isArchive ? '汇总门店巡检、经营会议或市场调研的材料，核对版本、来源与时间，形成统一目录。' : isLogistics ? '围绕配送时效、运力供需与异常订单，按城市和时段梳理问题，明确关键指标口径。' : '围绕餐饮消费市场，观察价格带、热门品类与到店场景的变化，明确分析范围与数据口径。'}</p><h4>${isPromo ? '二、参与方式' : isArchive ? '二、归档清单' : '二、关键发现'}</h4><ol><li>${isPromo ? '选择感兴趣的街区与餐饮主题。' : isArchive ? '按城市与业务环节整理原始文件。' : '汇总可用数据与资料，校验来源和统计口径。'}</li><li>${isPromo ? '浏览参与商家、活动时段与菜单信息。' : isArchive ? '标记重复版本与缺失的附件。' : '识别高频变化、区域差异及其影响范围。'}</li><li>${isPromo ? '查看活动规则并按页面提示参与。' : isArchive ? '建立可检索目录和待补齐清单。' : '区分事实与推测，提出分阶段行动建议。'}</li></ol><div class="artifact-page-note">说明：这是页面示例，文中的趋势与数值需以实际调研数据为准。</div><h4>三、下一步建议</h4><p><strong>聚焦高价值场景</strong><br>按城市与消费时段筛选重点机会，结合真实反馈验证判断。</p><p><strong>建立复盘机制</strong><br>持续跟踪用户体验、订单变化与执行结果，定期调整策略。</p><div class="artifact-page-footer">CATPAW · 内容示例 <span>01 / 01</span></div></article></div></div>`;
  }

  /* 保留原场景案例池作为内容来源；默认跨池取样，Prompt 选中后按意图展示。
     prompt 会在详情弹窗中完整展示，并可通过「做同款」直接带回输入框。 */
  function caseData() {
   return {
    office: [
      { kind: 'dashboard', type: '物流数据看板', title: '同城配送履约异常看板', prompt: '汇总本月各配送站点的订单、准时率和超时原因，按城市、时段与异常等级制作明细看板，突出需要优先处理的站点。' },
      { kind: 'article', type: '分析报告', title: '餐饮趋势报告', prompt: '整理近期餐饮消费市场资料，分析价格带、品类和消费场景的变化，注明数据来源并给出餐饮品牌可执行的建议。' },
      { kind: 'deck', type: '演示文稿', title: '餐饮 Q1 经营复盘', prompt: '根据第一季度连锁餐饮经营数据制作管理层复盘，包含门店表现、营收与客单价变化、成本问题和下一季度行动计划。' },
      { kind: 'article', type: '用户洞察报告', title: '外卖用户反馈洞察报告', prompt: '整理近期外卖用户关于配送时效、餐品品质与售后的反馈，归纳高频问题并给出按影响程度排序的改进建议。' },
    ],
    dev: [
      { kind: 'web', type: '网页', title: '餐饮趋势洞察', prompt: '制作可滚动的餐饮消费趋势网页，呈现品类热度、价格带、消费场景与区域机会，并标明示例数据口径。' },
      { kind: 'code', type: '数据处理脚本', title: '配送异常订单归因脚本', prompt: '编写处理配送订单明细的脚本，按站点、时段与异常类型归因超时订单，输出可复核的汇总结果。' },
      { kind: 'dashboard', type: '物流监控看板', title: '即时配送站点健康度看板', prompt: '制作即时配送站点健康度看板，展示订单量、准时率、运力缺口和异常趋势，并支持按城市及时间筛选。' },
      { kind: 'code', type: '分析方案', title: '餐饮订单高峰预测方案', prompt: '分析餐饮订单高峰期的历史数据，给出节假日特征、需求预测、误差监测和运力调度的实现方案。' },
    ],
    design: [
      { kind: 'visual', type: '视觉设计', title: '城市美食节主视觉', prompt: '为城市美食节设计活动主视觉，突出本地餐饮特色与限时活动信息，适配横版活动页面。' },
      { kind: 'deck', type: '市场提案', title: '餐饮品牌市场拓展提案', prompt: '制作餐饮品牌进入新城市的市场提案，梳理目标客群、竞品格局、品牌定位和渠道策略。' },
      { kind: 'web', type: '活动网页', title: '城市美食节活动页面', prompt: '设计可滚动的城市美食节活动网页，展示主题餐厅、活动日程、报名入口和合作商家信息。' },
      { kind: 'visual', type: '品牌视觉', title: '餐饮品牌秋季上新视觉', prompt: '为餐饮品牌设计秋季新品推广视觉，突出产品特色、季节氛围和清晰的购买行动入口。' },
    ],
   };
  }

  function visibleCaseData(scope) {
    const category = selectedPromptCategory && promptCategoryData()[selectedPromptCategory];
    if (category) return category.cases;
    const cases = caseData();
    return cases[scope] || [cases.office[2], cases.dev[0], cases.design[0], cases.office[1]];
  }

  function renderCases(scope) {
    const casesEl = document.getElementById('cases');
    if (!casesEl) return;
    const iconByKind = {
      dashboard: 'html', article: 'doc', deck: 'ppt',
      web: 'html', code: 'html', visual: 'image',
    };
    const list = visibleCaseData(scope);
    casesEl.innerHTML =
      `<div class="cases-head">` +
      `<span class="cases-title">看看别人做出了什么</span>` +
      `<button class="cases-template-entry" type="button" id="openTemplates" aria-haspopup="dialog"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h6"/></svg>我的模版</button>` +
      `</div>` +
      `<div class="cases-row">` +
      list.map((c, i) =>
        `<button class="case" data-case-index="${i}" aria-label="查看案例：${c.title}"` +
        // 错峰入场：与导航项的场景切换动画同一手法
        ` style="animation-delay:${i * 70}ms">` +
        `<span class="cthumb">${caseArtifact(c, true)}</span>` +
        `<span class="cmeta">` +
        `<span class="ctype"><img src="assets/artifact-${iconByKind[c.kind] || 'doc'}.svg" alt="" aria-hidden="true">${c.type}</span>` +
        `<span class="ctitle">${c.title}</span>` +
        `</span>` +
        `</button>`
      ).join('') +
      `</div>`;
    casesEl.querySelectorAll('.cthumb').forEach(frame => {
      frame.style.setProperty('--artifact-scale', frame.clientWidth / 460);
      caseThumbResizeObserver?.observe(frame);
    });
  }

  caseThumbResizeObserver = new ResizeObserver(entries => {
    entries.forEach(({ target }) => {
      target.style.setProperty('--artifact-scale', target.clientWidth / 460);
    });
  });
  document.querySelectorAll('#cases .cthumb').forEach(frame => caseThumbResizeObserver.observe(frame));

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
const toolFileEditSave = document.getElementById('toolFileEditSave');
const toolFileEditDiscard = document.getElementById('toolFileEditDiscard');
const fileCloseOverlay = document.getElementById('fileCloseOverlay');
const fileCloseDescription = document.getElementById('fileCloseDescription');
const fileCloseCancel = document.getElementById('fileCloseCancel');
const fileCloseDiscard = document.getElementById('fileCloseDiscard');
const fileCloseSave = document.getElementById('fileCloseSave');
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
      icon: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>',
    },
    file: {
      title: '打开文件',
      icon: '<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/>',
    },
    browser: {
      title: '新标签页',
      icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9c2.5-2.5 3.8-5.5 3.8-9S14.5 5.5 12 3Z"/>',
    },
    terminal: {
      title: '终端',
      icon: '<rect x="3" y="4" width="18" height="16" rx="5"/><path d="m7 9 3 3-3 3m6 0h4"/>',
    },
  };
  const WORKSPACE_CLOSE = '<svg viewBox="0 0 24 24" class="ic"><path d="M6.5 6.5 17.5 17.5m0-11-11 11"/></svg>';
  let workspaceSeq = 0;
  let openWorkspaces = [{
    id: 'file-default',
    kind: 'file',
    title: '打开文件',
    node: null,
    chain: [],
    path: null,
    previewMode: 'source',
  }];
  let activeWorkspace = 'file-default';
  // 文件目录树是右侧工作区的共享布局状态，不随文件页签切换恢复旧值。
  let fileTreeVisible = true;

  function saveActiveWorkspaceState() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    if (!item) return;
    if (item.kind === 'browser') {
      item.url = urlInput.value;
    }
  }

  let rightPanel = null;
  let workbenchExpanded = false;
  let compactPanelRequested = false;

  function syncFullscreenChat() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const visible = workbenchExpanded && rightPanel === 'tools' && item?.kind === 'file' && Boolean(item.node);
    fullscreenChat.hidden = !visible;
  }

  let summaryRestoreFrame = 0;
  function waitForMainRestored() {
    if (workbenchExpanded || rightPanel !== 'tools') return;
    const mainRight = document.querySelector('.main').getBoundingClientRect().right;
    const triggerRight = summaryToggleSlot.getBoundingClientRect().right;
    if (mainRight >= triggerRight + 15) {
      content.classList.remove('wb-restoring');
      syncSummaryTriggerPosition();
    } else {
      summaryRestoreFrame = requestAnimationFrame(waitForMainRestored);
    }
  }

  function setWorkbenchExpanded(expanded) {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const canExpandFile = rightPanel === 'tools' && item?.kind === 'file';
    const wasExpanded = workbenchExpanded;
    workbenchExpanded = Boolean(expanded && canExpandFile);
    cancelAnimationFrame(summaryRestoreFrame);
    if (wasExpanded && !workbenchExpanded && rightPanel === 'tools') {
      content.classList.add('wb-restoring');
      summaryRestoreFrame = requestAnimationFrame(waitForMainRestored);
    } else {
      content.classList.remove('wb-restoring');
    }
    content.classList.toggle('wb-file-active', canExpandFile);
    syncAdaptiveLayout();
    wbExpandToggle.disabled = !canExpandFile;
    wbExpandToggle.setAttribute('aria-pressed', String(workbenchExpanded));
    wbExpandToggle.title = workbenchExpanded ? '退出文件全屏' : '全屏显示文件';
    wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
    syncFullscreenChat();
    requestAnimationFrame(syncSummaryTriggerPosition);
    requestAnimationFrame(syncResizeLayout);
  }

  function syncWorkbenchWidth() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    content.classList.toggle('wb-file-workspace', rightPanel === 'tools' && item?.kind === 'file');
    requestAnimationFrame(syncResizeLayout);
  }

  /* 两级分栏只记录用户设置的像素宽度；布局变化时夹紧，不覆盖原始偏好。 */
  const panelResizer = document.getElementById('panelResizer');
  const treeResizer = document.getElementById('treeResizer');
  let preferredPanelWidths = { file: null, compact: null };
  let preferredTreeWidth = null;
  let activeResize = null;
  const PANEL_EXPAND_OVERDRAG = 32;

  function panelWidthKey() { return content.classList.contains('wb-file-workspace') ? 'file' : 'compact'; }
  function desiredPanelWidth(width, sidebarWidth) {
    const root = getComputedStyle(document.documentElement);
    return preferredPanelWidths[panelWidthKey()] ?? (panelWidthKey() === 'file'
      ? Math.min(parseFloat(root.getPropertyValue('--workbench-folder-w')), (width - sidebarWidth) * .62)
      : parseFloat(root.getPropertyValue('--workbench-w')));
  }
  function panelBounds() {
    const available = content.clientWidth;
    const mainMin = Math.min(320, available);
    const panelMin = Math.min(panelWidthKey() === 'file' ? 360 : 300, available - mainMin);
    return { min: panelMin, max: Math.max(panelMin, available - mainMin) };
  }
  function treeBounds(available = workbench.clientWidth) {
    const previewMin = Math.min(240, Math.floor(available * .52));
    const treeMin = Math.min(180, available - previewMin);
    return { min: treeMin, max: Math.max(treeMin, available - previewMin) };
  }
  function clampWidth(value, bounds) { return Math.round(Math.min(bounds.max, Math.max(bounds.min, value))); }

  // 窗口收窄时依次让出右侧工具区、左侧边栏，最后才压缩对话区。
  // 不改写用户的开关与拖拽偏好，窗口重新变宽时可以自然恢复。
  function syncAdaptiveLayout() {
    if (!adaptiveLayoutReady) return;
    const width = win.clientWidth;
    const mainMin = Math.min(320, width);
    const root = getComputedStyle(document.documentElement);
    const sidebarDesired = win.classList.contains('collapsed') ? 0
      : Math.min(480, preferredSidebarWidth ?? parseFloat(root.getPropertyValue('--sidebar-w')));
    const panelOpen = content.classList.contains('wb-open');
    const panelDesired = panelOpen ? desiredPanelWidth(width, sidebarDesired) : 0;
    // 窄窗口中主动打开工具区时，空间不足以保留完整双栏就让它替代对话区；
    // 被动缩窄仍按右栏优先自动收起，且手动文件全屏状态保持独立。
    const compactFull = panelOpen && compactPanelRequested && width - sidebarDesired - panelDesired < 320;
    if (compactPanelRequested && !compactFull) compactPanelRequested = false;
    const fullPanel = panelOpen && (workbenchExpanded || compactFull);
    content.classList.toggle('wb-expanded', fullPanel);
    const availableRight = Math.max(0, width - sidebarDesired - mainMin);
    const rightCandidate = Math.min(panelDesired, availableRight);
    const leftCandidate = Math.min(sidebarDesired, Math.max(0, width - rightCandidate - mainMin));
    const leftWidth = fullPanel
      ? width - sidebarDesired >= (panelWidthKey() === 'file' ? 360 : 300) ? sidebarDesired : 0
      : leftCandidate >= 188 ? leftCandidate : 0;
    const rightWidth = fullPanel ? Math.max(0, width - leftWidth)
      : rightCandidate >= (panelWidthKey() === 'file' ? 360 : 300) ? rightCandidate : 0;
    if (sidebarResizePointer === null && !win.classList.contains('collapsed')) {
      win.style.setProperty('--user-sidebar-w', `${Math.round(leftWidth)}px`);
      sidebarResizer.setAttribute('aria-valuenow', String(Math.round(leftWidth)));
    }
    if (panelOpen && !fullPanel) {
      const previewWidth = activeResize?.kind === 'panel' ? activeResize.previewWidth : null;
      content.style.setProperty('--user-panel-w', `${Math.round(previewWidth ?? rightWidth)}px`);
    } else if (!panelOpen) content.style.removeProperty('--user-panel-w');
    const rightHidden = panelOpen && !fullPanel && rightWidth === 0;
    const leftHidden = sidebarResizePointer === null && !win.classList.contains('collapsed') && leftWidth === 0;
    content.classList.toggle('wb-auto-collapsed', rightHidden);
    win.classList.toggle('sidebar-auto-collapsed', leftHidden);
    workbench.setAttribute('aria-hidden', String(!panelOpen || rightHidden));
  }

  function syncResizeLayout() {
    syncAdaptiveLayout();
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    const panelActive = content.classList.contains('wb-open') && !content.classList.contains('wb-expanded') && !content.classList.contains('wb-auto-collapsed');
    const bounds = panelBounds();
    const treeActive = content.classList.contains('wb-open') && workbench.classList.contains('file-split') && rightPanel === 'tools';
    if (treeActive) {
      // 面板打开时用目标宽度计算目录树，不让它随网格过渡从 0 宽逐帧长出来。
      const targetWidth = content.classList.contains('wb-expanded') ? content.clientWidth
        : panelActive && activeResize?.kind !== 'panel'
          ? parseFloat(content.style.getPropertyValue('--user-panel-w'))
          : workbench.clientWidth;
      const treeLimits = treeBounds(targetWidth);
      const fallback = content.classList.contains('wb-expanded') && !mobile
        ? Math.min(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--workbench-folder-w')) * .4, content.clientWidth * .248)
        : targetWidth * .4;
      const treeWidth = clampWidth(preferredTreeWidth ?? fallback, treeLimits);
      workbench.style.setProperty('--user-tree-w', `${treeWidth}px`);
      // 目录树不随外层网格移动；面板到达目标宽度后一次性显示完整内容。
      workbench.classList.toggle('tree-revealed', activeResize?.kind === 'panel' ||
        workbench.clientWidth >= targetWidth - 1);
      treeResizer.setAttribute('aria-valuemin', String(treeLimits.min));
      treeResizer.setAttribute('aria-valuemax', String(treeLimits.max));
      treeResizer.setAttribute('aria-valuenow', String(treeWidth));
    } else {
      workbench.style.removeProperty('--user-tree-w');
      workbench.classList.remove('tree-revealed');
    }
    if (panelActive) {
      const panelWidth = Math.round(workbench.getBoundingClientRect().width);
      panelResizer.setAttribute('aria-valuemin', String(bounds.min));
      panelResizer.setAttribute('aria-valuemax', String(bounds.max));
      panelResizer.setAttribute('aria-valuenow', String(panelWidth));
    }
  }
  function endResize(event) {
    if (!activeResize) return;
    const { element, pointerId, expandOnRelease } = activeResize;
    activeResize = null;
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    content.classList.remove('is-resizing');
    workbench.classList.remove('is-resizing');
    document.body.classList.remove('is-resizing-panels');
    if (event?.type === 'pointerup' && expandOnRelease) {
      requestAnimationFrame(() => setWorkbenchExpanded(true));
    } else {
      syncResizeLayout();
    }
  }
  function setupResizer(element, kind) {
    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !content.classList.contains('wb-open') ||
          (kind === 'panel' && (content.classList.contains('wb-expanded') || content.classList.contains('wb-auto-collapsed'))) ||
          (kind === 'tree' && !workbench.classList.contains('file-split'))) return;
      event.preventDefault();
      endResize();
      const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
      const expandReady = kind === 'panel' && item?.kind === 'file' &&
        Math.round(workbench.getBoundingClientRect().width) >= panelBounds().max - 1;
      activeResize = { element, kind, pointerId: event.pointerId, expandReady };
      element.setPointerCapture(event.pointerId);
      content.classList.toggle('is-resizing', kind === 'panel');
      workbench.classList.toggle('is-resizing', kind === 'tree');
      document.body.classList.add('is-resizing-panels');
    });
    element.addEventListener('pointermove', (event) => {
      if (!activeResize || activeResize.element !== element || activeResize.pointerId !== event.pointerId) return;
      if (kind === 'panel') {
        const rawWidth = content.getBoundingClientRect().right - event.clientX;
        const bounds = panelBounds();
        // 首次到达最大宽度即吸附；只有从断点重新拖动，才允许越过它进入全屏。
        activeResize.previewWidth = Math.max(bounds.min, Math.min(activeResize.expandReady ? content.clientWidth : bounds.max, rawWidth));
        activeResize.expandOnRelease = activeResize.expandReady && rawWidth > bounds.max + PANEL_EXPAND_OVERDRAG;
        preferredPanelWidths[panelWidthKey()] = clampWidth(rawWidth, bounds);
      } else {
        preferredTreeWidth = clampWidth(workbench.getBoundingClientRect().right - event.clientX, treeBounds());
      }
      syncResizeLayout();
    });
    element.addEventListener('pointerup', endResize);
    element.addEventListener('pointercancel', endResize);
    element.addEventListener('lostpointercapture', endResize);
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const bounds = kind === 'panel' ? panelBounds() : treeBounds();
      const current = kind === 'panel' ? workbench.getBoundingClientRect().width : document.querySelector('.wb-pane[data-pane="files"]').getBoundingClientRect().width;
      const target = event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : current + (event.key === 'ArrowLeft' ? 1 : -1) * (event.shiftKey ? 32 : 16);
      if (kind === 'panel') preferredPanelWidths[panelWidthKey()] = clampWidth(target, bounds);
      else preferredTreeWidth = clampWidth(target, bounds);
      syncResizeLayout();
    });
  }
  setupResizer(panelResizer, 'panel');
  setupResizer(treeResizer, 'tree');
  adaptiveLayoutReady = true;
  syncAdaptiveLayout();
  const layoutResizeObserver = new ResizeObserver(syncResizeLayout);
  layoutResizeObserver.observe(content);
  layoutResizeObserver.observe(workbench);
  window.addEventListener('resize', () => { endResize(); syncResizeLayout(); });

  function syncSummaryTriggerPosition() {
    const main = document.querySelector('.main');
    if (rightPanel !== 'tools' || content.classList.contains('wb-expanded') || !main || !summaryToggleSlot) {
      content.style.removeProperty('--summary-float-left');
      content.style.removeProperty('--summary-float-top');
      summaryPopover.style.removeProperty('position');
      summaryPopover.style.removeProperty('left');
      summaryPopover.style.removeProperty('top');
      summaryPopover.style.removeProperty('right');
      return;
    }

    const mainRect = main.getBoundingClientRect();
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
    const opening = Boolean(next) && (!content.classList.contains('wb-open') || content.classList.contains('wb-auto-collapsed'));
    if (next === 'tools' && openWorkspaces.length === 0) ensureDefaultFileWorkspace();
    rightPanel = next;
    syncWorkbenchWidth();
    const instantFileOpen = opening && content.classList.contains('wb-file-workspace');
    if (instantFileOpen) content.classList.add('wb-opening');
    const open = Boolean(next);
    content.classList.toggle('wb-open', open);
    if (opening) {
      const width = win.clientWidth;
      const root = getComputedStyle(document.documentElement);
      const sidebarWidth = win.classList.contains('collapsed') ? 0
        : Math.min(480, preferredSidebarWidth ?? parseFloat(root.getPropertyValue('--sidebar-w')));
      compactPanelRequested = width - sidebarWidth - desiredPanelWidth(width, sidebarWidth) < 320;
    }
    if (!next) compactPanelRequested = false;
    workbench.dataset.panel = next || '';
    syncAdaptiveLayout();
    setWorkbenchExpanded(workbenchExpanded);
    workbench.setAttribute('aria-hidden', String(!open || content.classList.contains('wb-auto-collapsed')));
    wbToggle.setAttribute('aria-expanded', String(next === 'tools'));
    wbToggle.title = next === 'tools' ? '收起工具' : '工具';
    if (instantFileOpen) {
      syncResizeLayout();
      requestAnimationFrame(() => content.classList.remove('wb-opening'));
    }
    requestAnimationFrame(() => {
      syncResizeLayout();
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
      content.classList.remove('wb-open', 'wb-file-workspace', 'wb-expanded', 'wb-file-active');
      workbenchExpanded = false;
      compactPanelRequested = false;
      syncAdaptiveLayout();
      wbExpandToggle.disabled = true;
      wbExpandToggle.setAttribute('aria-pressed', 'false');
      wbExpandToggle.title = '全屏显示文件';
      wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
      workbench.dataset.panel = '';
      workbench.setAttribute('aria-hidden', 'true');
      wbToggle.setAttribute('aria-expanded', 'false');
      wbToggle.title = '工具';
      fullscreenChat.hidden = true;
      requestAnimationFrame(syncResizeLayout);
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
        `<span class="workspace-tab-title">${esc(item.title)}${item.sourceDraft !== undefined && item.sourceDraft !== sourceForNode(item.node) ? ' •' : ''}</span>` +
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

  let pendingCloseWorkspaceId = null;
  let closeDialogReturnFocus = null;

  function dismissFileCloseDialog(restoreFocus = true) {
    fileCloseOverlay.hidden = true;
    pendingCloseWorkspaceId = null;
    if (restoreFocus && closeDialogReturnFocus?.isConnected) closeDialogReturnFocus.focus();
    closeDialogReturnFocus = null;
  }

  function closeWorkspace(id, confirmed = false) {
    const index = openWorkspaces.findIndex((item) => item.id === id);
    if (index === -1) return;
    const item = openWorkspaces[index];
    if (!confirmed && item.kind === 'file' && item.sourceDraft !== undefined) {
      pendingCloseWorkspaceId = id;
      closeDialogReturnFocus = document.activeElement;
      fileCloseDescription.textContent = `“${item.title}”正在编辑。关闭前要保存更改吗？`;
      fileCloseOverlay.hidden = false;
      fileCloseCancel.focus();
      return;
    }

    const closingActiveWorkspace = activeWorkspace === id;
    openWorkspaces.splice(index, 1);

    // 关闭按钮始终真正移除对应页签；最后一张被移除时同时收起面板。
    // 下次主动打开工具面板时再提供新的空白文件页签，不恢复已关闭内容。
    if (openWorkspaces.length === 0) {
      activeWorkspace = null;
      renderWorkspaceTabs();
      setWorkbench(false);
      if (confirmed) wbToggle.focus();
      return;
    }

    if (closingActiveWorkspace) {
      const nextWorkspace = openWorkspaces[Math.min(index, openWorkspaces.length - 1)];
      activeWorkspace = nextWorkspace.id;
      activateWorkspace(activeWorkspace, false);
    } else {
      renderWorkspaceTabs();
    }
    if (confirmed) workspaceTabs.querySelector(`[data-workspace-tab="${activeWorkspace}"]`)?.focus();
  }

  fileCloseCancel.addEventListener('click', () => dismissFileCloseDialog());
  fileCloseDiscard.addEventListener('click', () => {
    const id = pendingCloseWorkspaceId;
    dismissFileCloseDialog(false);
    closeWorkspace(id, true);
  });
  fileCloseSave.addEventListener('click', () => {
    const id = pendingCloseWorkspaceId;
    const item = openWorkspaces.find((workspace) => workspace.id === id);
    if (!item || !saveFileDraft(item)) {
      dismissFileCloseDialog();
      return;
    }
    dismissFileCloseDialog(false);
    closeWorkspace(id, true);
  });
  fileCloseOverlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissFileCloseDialog();
    } else if (event.key === 'Tab') {
      const buttons = [fileCloseCancel, fileCloseDiscard, fileCloseSave];
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        fileCloseSave.focus();
      } else if (!event.shiftKey && index === buttons.length - 1) {
        event.preventDefault();
        fileCloseCancel.focus();
      }
    }
  });

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
  else closeTreeContextMenu();
  requestAnimationFrame(syncSummaryTriggerPosition);
}

  outputToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setSummaryOpen(summaryPopover.hidden);
  });
  // 摘要可与首页、对话和右侧工作区并用，点击页面其他区域不改变其开关状态。
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || summaryPopover.hidden) return;
    setSummaryOpen(false);
    outputToggle.focus();
  });

  wbToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const toolsOpen = content.classList.contains('wb-open') && !content.classList.contains('wb-auto-collapsed') && workbench.dataset.panel === 'tools';
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
      const toolsOpen = content.classList.contains('wb-open') && !content.classList.contains('wb-auto-collapsed') && workbench.dataset.panel === 'tools';
      setRightPanel(toolsOpen ? null : 'tools');
    }
  });
  /* 工具文件夹只展示当前任务所在的根目录，顶部切换器与输入框下方的
     归属选择共享状态。代码文件使用编辑器社区常见的文件类型字形。 */
  const toolTreeExpanded = new Set(['root', 'root.5']);
  let activeFilePath = null;
  let toolTreeQuery = '';
  const TREE_ICONS = {
    folder: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>',
    file: '<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/>',
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
          `<svg viewBox="0 0 24 24" class="tool-tree-chevron${isFolder ? '' : ' blank'}"><path d="m9 6 6 6-6 6"/></svg>` +
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
`<svg viewBox="0 0 24 24" class="tool-tree-chevron"><path d="m9 6 6 6-6 6"/></svg>` +
`<span class="tool-tree-file-icon" data-file-kind="folder"><svg viewBox="0 0 24 24" class="tool-tree-icon">${TREE_ICONS.folder}</svg></span>` +
`<span>${esc(folder.name)}</span>` +
`</button>${children}${empty}</div>`;
renderToolFolderPicker();
}

/* 文件树右键菜单挂到 body，避免被目录面板的 overflow 裁切。 */
const TREE_CONTEXT_ITEMS = [
{ act: 'chat', label: '添加到对话', svg: '<path d="M7.5 3.5h9A4.5 4.5 0 0 1 21 8v6.5a4.5 4.5 0 0 1-4.5 4.5h-1.7l-2.2 1.8a1 1 0 0 1-1.2 0L9.2 19H7.5A4.5 4.5 0 0 1 3 14.5V8a4.5 4.5 0 0 1 4.5-4.5Z"/><path d="M12 8.5v6M9 11.5h6"/>' },
{ act: 'copy-path', label: '复制路径', divider: true, svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
{ act: 'copy-relative-path', label: '复制相对路径', svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
{ act: 'reveal', label: '在 Finder 中显示', svg: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>' },
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

function openTreeContextMenu(event, row, target, path = null) {
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
placeWindowMenu(treeContextMenu, event.clientX, event.clientY, event.above ?? event.clientY - 4);
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

function sourceForNode(node) {
if (!node) return '';
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
    <svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/></svg>
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
    const treeVisible = fileTreeVisible;
    const canToggleMode = supportsRenderedPreview(item.node);
    const hasVisualPreview = Boolean(item.node?.preview && PREVIEWS[item.node.preview.kind]);
    if (canToggleMode && item.previewMode !== 'source') item.previewMode = 'rendered';
    if (item.node?.preview?.kind === 'image' && item.previewMode !== 'artifact') item.previewMode = 'rendered';
    workbench.classList.toggle('file-split', treeVisible);
    workbench.classList.toggle('file-preview-only', !treeVisible);
    syncWorkbenchWidth();
    requestAnimationFrame(syncResizeLayout);
toolTreeReopen.hidden = treeVisible;
toolTreeReopen.setAttribute('aria-pressed', String(treeVisible));
    const editing = canToggleMode && item.previewMode === 'source';
    toolFileModeToggle.hidden = !canToggleMode || editing;
    toolFileModeToggle.textContent = '编辑代码';
    toolFileEditSave.hidden = !editing;
    toolFileEditDiscard.hidden = !editing;
    toolFileEditSave.disabled = !editing;
    if (editing) setOpenWithMenu(false);
    activeFilePath = treeVisible ? item.path || null : null;
    toolFilePreviewTitle.textContent = item.node ? item.node.name : '选择文件';
    renderOpenWith(item.node);
    openWith.hidden = editing || !item.node;
    if (!item.node) toolFilePreviewBody.innerHTML = TOOL_FILE_EMPTY;
    else if (hasVisualPreview && item.previewMode !== 'source') {
      toolFilePreviewBody.innerHTML = PREVIEWS[item.node.preview.kind](item.node.preview, item);
    } else if (item.previewMode === 'artifact') {
      toolFilePreviewBody.innerHTML = previewFallback(item.node);
    } else if (editing) {
      toolFilePreviewBody.innerHTML = '<textarea class="source-editor" aria-label="编辑文件源码" spellcheck="false"></textarea>';
      toolFilePreviewBody.querySelector('.source-editor').value = item.sourceDraft ?? sourceForNode(item.node);
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
    if (item.sourceDraft === undefined) item.previewMode = options.previewMode;
    rememberRecentFile(node, chain);

    if (rightPanel !== 'tools') setRightPanel('tools');
    activateWorkspace(item.id);
    return item;
  }

  function openToolFile(node, chain, path) {
    openFileWorkspace(node, chain, {
      path,
      previewMode: node?.preview ? 'rendered' : 'source',
    });
  }

  function openArtifactPreview(node, chain) {
    openFileWorkspace(node, chain, {
      path: null,
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
    item.sourceDraft = sourceForNode(item.node);
    item.previewMode = 'source';
    renderToolFileWorkspace(item);
    toolFilePreviewBody.querySelector('.source-editor')?.focus();
  });

  toolFilePreviewBody.addEventListener('click', (event) => {
    const item = currentFileWorkspace();
    if (!item?.node?.preview) return;
    const jump = event.target.closest('[data-word-jump]');
    if (jump) toolFilePreviewBody.querySelector(`#word-section-${jump.dataset.wordJump}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const zoom = event.target.closest('[data-office-zoom]');
    if (zoom) {
      item.officeZoom = Math.min(140, Math.max(70, (item.officeZoom || 100) + Number(zoom.dataset.officeZoom)));
      toolFilePreviewBody.querySelector('.word-page').style.setProperty('--office-zoom', item.officeZoom / 100);
      toolFilePreviewBody.querySelector('.office-zoom span').textContent = `${item.officeZoom}%`;
    }
    const sheetButton = event.target.closest('[data-excel-sheet]');
    if (sheetButton) {
      item.officeSheet = Number(sheetButton.dataset.excelSheet);
      item.officeFilter = '';
      renderToolFileWorkspace(item);
    }
    if (event.target.matches('[data-excel-add]')) {
      const sheet = item.node.preview.sheets[item.officeSheet || 0];
      sheet.rows.push(sheet.columns.map(() => ''));
      item.officeFilter = '';
      item.officeEdited = true;
      renderToolFileWorkspace(item);
      toolFilePreviewBody.querySelector(`[data-excel-row="${sheet.rows.length - 1}"][data-excel-column="0"]`)?.focus();
    }
    const cell = event.target.closest('.excel-grid td[data-excel-address]');
    if (cell) selectExcelCell(cell);
  });

  function selectExcelCell(cell) {
    toolFilePreviewBody.querySelector('.excel-grid td.selected')?.classList.remove('selected');
    cell.classList.add('selected');
    toolFilePreviewBody.querySelector('[data-excel-address]:not(td)').textContent = cell.dataset.excelAddress;
    toolFilePreviewBody.querySelector('[data-excel-value]').textContent = cell.textContent;
  }

  function editExcelCell(cell) {
    const item = currentFileWorkspace();
    if (!item || cell.dataset.excelColumn === '5' && (item.officeSheet || 0) === 0) return;
    if (cell.querySelector('input')) return;
    selectExcelCell(cell);
    const sheet = item.node.preview.sheets[item.officeSheet || 0];
    const row = Number(cell.dataset.excelRow);
    const column = Number(cell.dataset.excelColumn);
    const input = document.createElement('input');
    input.className = 'excel-cell-input';
    input.value = sheet.rows[row][column];
    cell.textContent = '';
    cell.append(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      if (commit && input.value !== sheet.rows[row][column]) {
        sheet.rows[row][column] = input.value;
        item.officeEdited = true;
      }
      renderToolFileWorkspace(item);
      const next = toolFilePreviewBody.querySelector(`[data-excel-row="${row}"][data-excel-column="${column}"]`);
      next?.focus();
      if (next) selectExcelCell(next);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        finish(event.key === 'Enter');
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  toolFilePreviewBody.addEventListener('dblclick', (event) => {
    const cell = event.target.closest('.excel-grid td');
    if (cell) editExcelCell(cell);
  });
  toolFilePreviewBody.addEventListener('keydown', (event) => {
    if (event.target.matches('.excel-grid td') && (event.key === 'Enter' || event.key === 'F2')) {
      event.preventDefault();
      editExcelCell(event.target);
    }
  });

  toolFilePreviewBody.addEventListener('input', (event) => {
    if (event.target.matches('[data-excel-filter]')) {
      const item = currentFileWorkspace();
      item.officeFilter = event.target.value;
      const caret = event.target.selectionStart;
      renderToolFileWorkspace(item);
      const filter = toolFilePreviewBody.querySelector('[data-excel-filter]');
      filter.focus();
      filter.setSelectionRange(caret, caret);
      return;
    }
    const paragraph = event.target.closest('[data-word-paragraph]');
    if (paragraph) {
      const item = currentFileWorkspace();
      item.node.preview.sections[Number(paragraph.dataset.wordSection)].paragraphs[Number(paragraph.dataset.wordParagraph)] = paragraph.textContent;
      item.officeEdited = true;
      toolFilePreviewBody.querySelector('.office-status').textContent = '已编辑 · 当前会话';
      return;
    }
    if (!event.target.matches('.source-editor')) return;
    const item = currentFileWorkspace();
    if (!item) return;
    item.sourceDraft = event.target.value;
    renderWorkspaceTabs();
  });

  function saveFileDraft(item) {
    if (item?.sourceDraft === undefined || !supportsRenderedPreview(item.node)) return false;
    const preview = item.node.preview;
    if (preview.kind === 'html') preview.html = item.sourceDraft;
    else preview.text = item.sourceDraft;
    delete item.sourceDraft;
    item.previewMode = 'rendered';
    return true;
  }

  toolFileEditSave.addEventListener('click', () => {
    const item = currentFileWorkspace();
    if (!saveFileDraft(item)) return;
    renderWorkspaceTabs();
    renderToolFileWorkspace(item);
  });

  toolFileEditDiscard.addEventListener('click', () => {
    const item = currentFileWorkspace();
    if (!item || !supportsRenderedPreview(item.node)) return;
    delete item.sourceDraft;
    item.previewMode = 'rendered';
    renderWorkspaceTabs();
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
const absolutePath = `${target.chain[0].path.replace(/\/$/, '')}/${relativePath}`;
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
renderSummaryContents();
break;
}
case 'delete':
if (!window.confirm(`确定删除“${node.name}”吗？`)) break;
const parent = target.chain.at(-2);
const index = parent?.files?.indexOf(node) ?? -1;
if (index < 0) break;
parent.files.splice(index, 1);
recentOpenedFiles = recentOpenedFiles.filter((entry) => entry.node !== node);
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
renderSummaryContents();
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
  fileTreeVisible = false;
  renderToolFileWorkspace(item);
});

toolTreeReopen.addEventListener('click', () => {
const item = currentFileWorkspace();
if (!item) return;
  fileTreeVisible = true;
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
  const caseDialogSkill = document.getElementById('caseDialogSkill');
  const caseDialogSkillAction = document.getElementById('caseDialogSkillAction');
  const caseDialogArtifact = document.getElementById('caseDialogArtifact');
  const caseDialogArtifactIcon = document.getElementById('caseDialogArtifactIcon');
  const caseIconByKind = { dashboard: 'excel', article: 'doc', deck: 'ppt', web: 'html', code: 'html', visual: 'image' };
  const caseDialogDownload = document.getElementById('caseDialogDownload');
  const caseDialogRelated = document.getElementById('caseDialogRelated');
  const caseDialogPrimary = document.getElementById('caseDialogPrimary');
  const caseSkills = {
    dashboard: '数据分析', article: '文档写作', deck: '幻灯片制作',
    web: '网页制作', code: '代码开发', visual: '视觉设计',
  };
  let activeCase = null;
  let caseReturnFocus = null;

  function updateCaseSkillAction() {
    const skill = caseDialogSkill.textContent;
    const installed = installedAddItems.skill.includes(skill);
    caseDialogSkillAction.textContent = installed ? '已有' : '添加';
    caseDialogSkillAction.disabled = installed;
    caseDialogSkillAction.setAttribute('aria-label', installed ? `${skill}已添加` : `添加${skill}`);
  }

  caseDialogSkillAction.addEventListener('click', () => {
    const skill = caseDialogSkill.textContent;
    if (!activeCase || installedAddItems.skill.includes(skill)) return;
    installedAddItems.skill.push(skill);
    updateCaseSkillAction();
  });

  function similarCases(item) {
    const all = [...Object.values(caseData()).flat(),
      ...Object.values(promptCategoryData()).flatMap(category => category.cases)];
    const unique = [...new Map(all.map(candidate => [candidate.title, candidate])).values()]
      .filter(candidate => candidate.title !== item.title);
    return unique.sort((a, b) => Number(b.kind === item.kind) - Number(a.kind === item.kind)).slice(0, 3);
  }

  function openCaseDialog(item, trigger) {
    if (!item) return;
    activeCase = item;
    if (!caseDialog.open) caseReturnFocus = trigger;
    caseDialogVisual.innerHTML = caseArtifact(item);
    caseDialogVisual.dataset.kind = item.kind;
    caseDialogType.textContent = item.type;
    caseDialogTitle.textContent = item.title;
    caseDialogSkill.textContent = caseSkills[item.kind] || '内容创作';
    updateCaseSkillAction();
    caseDialogPrompt.textContent = item.prompt;
    caseDialogArtifact.textContent = `${item.title} · HTML 示例预览`;
    caseDialogArtifactIcon.src = `assets/artifact-${caseIconByKind[item.kind] || 'doc'}.svg`;
    document.querySelectorAll('.case.is-selected').forEach(card => card.classList.remove('is-selected'));
    if (trigger?.classList.contains('case')) trigger.classList.add('is-selected');
    caseDialogRelated.querySelectorAll('.cthumb').forEach(frame => caseThumbResizeObserver.unobserve(frame));
    caseDialogRelated.replaceChildren(...similarCases(item).map(candidate => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'case-dialog-related-item';
      button.setAttribute('aria-label', `查看案例：${candidate.title}`);
      button.innerHTML = `<span class="cthumb">${caseArtifact(candidate, true)}</span><span class="case-dialog-related-title">${esc(candidate.title)}</span>`;
      button.addEventListener('click', () => {
        openCaseDialog(candidate);
        caseDialogClose.focus();
      });
      return button;
    }));
    if (!caseDialog.open) caseDialog.showModal();
    caseDialogRelated.querySelectorAll('.cthumb').forEach(frame => {
      frame.style.setProperty('--artifact-scale', frame.clientWidth / 460);
      caseThumbResizeObserver.observe(frame);
    });
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

  caseDialogVisual.addEventListener('click', event => {
    const control = event.target.closest('[data-slide-step], [data-slide-index]');
    if (!control) return;
    const deck = control.closest('.case-artifact-deck');
    const stage = deck.querySelector('.artifact-slide');
    const slides = [...deck.querySelectorAll('.artifact-slide-data template')];
    const index = control.hasAttribute('data-slide-index') ? Number(control.dataset.slideIndex)
      : Math.max(0, Math.min(slides.length - 1, Number(stage.dataset.slide) + Number(control.dataset.slideStep)));
    stage.replaceChildren(slides[index].content.cloneNode(true));
    stage.dataset.slide = index;
    deck.querySelector('.artifact-slide-count').textContent = `${index + 1} / ${slides.length}`;
    deck.querySelector('[data-slide-step="-1"]').disabled = index === 0;
    deck.querySelector('[data-slide-step="1"]').disabled = index === slides.length - 1;
    deck.querySelectorAll('[data-slide-index]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.slideIndex) === index)));
  });

  caseDialogDownload.addEventListener('click', () => {
    if (!activeCase) return;
    const css = [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules].filter(rule => rule.selectorText === ':root' || /artifact-|case-artifact/.test(rule.cssText)).map(rule => rule.cssText); }
      catch (_) { return []; }
    }).join('\n');
    const markup = caseArtifact(activeCase);
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(activeCase.title)}</title><style>${css}\nbody{margin:0;padding:32px;background:#f6f6f8;font-family:Arial,sans-serif}.case-artifact{width:min(460px,100%);height:520px;margin:auto}</style><div id="preview">${markup}</div><script>document.addEventListener('click',e=>{const b=e.target.closest('[data-slide-step],[data-slide-index]');if(!b)return;const d=b.closest('.case-artifact-deck'),s=d.querySelector('.artifact-slide'),a=[...d.querySelectorAll('template')],i=b.hasAttribute('data-slide-index')?Number(b.dataset.slideIndex):Math.max(0,Math.min(a.length-1,Number(s.dataset.slide)+Number(b.dataset.slideStep)));s.innerHTML=a[i].innerHTML;s.dataset.slide=i;d.querySelector('.artifact-slide-count').textContent=(i+1)+' / '+a.length;d.querySelector('[data-slide-step="-1"]').disabled=i===0;d.querySelector('[data-slide-step="1"]').disabled=i===a.length-1;d.querySelectorAll('[data-slide-index]').forEach(t=>t.setAttribute('aria-current',String(Number(t.dataset.slideIndex)===i)))})<\/script></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeCase.title.replace(/[\\/:*?"<>|]/g, '-')}-预览.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  caseDialogClose.addEventListener('click', closeCaseDialog);
  caseDialog.addEventListener('click', (e) => {
    if (e.target === caseDialog) closeCaseDialog();
  });
  caseDialog.addEventListener('close', () => {
    document.querySelectorAll('.case.is-selected').forEach(card => card.classList.remove('is-selected'));
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

  function openFileFromSummary(node, chain) {
    setSummaryOpen(false);
    fileTreeVisible = false;
    openArtifactPreview(node, chain);
  }

  function handleSummaryFileClick(event, list) {
    const row = event.target.closest('.summary-file-row');
    if (!row || !list.contains(row)) return;
    const node = currentNode()?.files?.[Number(row.dataset.fileIndex)];
    const entry = list === recentFiles
      ? recentOpenedFiles[Number(row.dataset.recentIndex)]
      : node && { node, chain: filePath.concat(node) };
    if (!entry?.node) return;
    const more = event.target.closest('.summary-file-more');
    if (more) {
      const rect = more.getBoundingClientRect();
      openTreeContextMenu({ clientX: rect.right, clientY: rect.bottom + 4, above: rect.top - 4 }, row, { node: entry.node, chain: entry.chain });
      return;
    }
    if (event.target.closest('.fitem')) openFileFromSummary(entry.node, entry.chain);
  }

  recentFiles.addEventListener('click', (event) => handleSummaryFileClick(event, recentFiles));
  fileGrid.addEventListener('click', (event) => handleSummaryFileClick(event, fileGrid));

  /* ---------- 5.6 示例对话 ----------
     选中左侧指定任务后，首页让位给对应对话；对话和产物面板打开的文件
     统一进入右侧页签，并在本次对话中保留到用户手动关闭。 */
  const mainView = document.querySelector('.main');
  const conversationPage = document.getElementById('conversationPage');
  const conversationThread = document.getElementById('conversationThread');
  const conversationScroll = document.getElementById('conversationScroll');
  const conversationTurnNav = document.getElementById('conversationTurnNav');
  const conversationPrompt = document.getElementById('conversationPrompt');
  const conversationComposer = document.getElementById('conversationComposer');
  const conversationSend = document.getElementById('conversationSend');
  const conversationTask = document.getElementById('demoConversationTask');
  const retailConversationTask = document.getElementById('retailFirstConversationTask');
  const conversationExamples = new Map([
    [conversationTask, {
      folderId: 'default',
      turns: [
        {
          prompt: '帮我整理本周门店履约异常明细，并标出需要优先处理的问题。',
          reply: [
            '## 本周门店履约异常 · 初步汇总',
            '',
            '我先按异常类型和影响范围梳理了本周记录。**共 18 条异常**，其中 5 条建议优先核实；这个优先级不是只按出现次数排序，还考虑超时时长、受影响订单数和重复发生情况。',
            '',
            '### 异常分布',
            '',
            '- **配送超时（9 条）**：主要集中在晚高峰，需区分骑手到店晚和门店交接等待。',
            '- **商家出餐延迟（6 条）**：集中在订单量较高的门店，高峰期备餐排队值得进一步排查。',
            '- **其他原因（3 条）**：先保留原始记录，待补齐原因后再归类。',
            '',
            '### 建议的处理顺序',
            '',
            '1. 优先复核重复超时的门店，核对异常时间和交接记录。',
            '2. 对照配送到店时间与实际出餐时间，确认延误发生在哪个环节。',
            '3. 在明细表中标注负责人和跟进状态，再汇总到看板供后续追踪。',
            '',
            '> 目前的原因归属仍是初步判断，责任方需以订单记录和门店反馈核实为准。',
            '',
            '我会保留每条记录的 `异常时间`、`影响订单数` 和 `待核实原因`，方便你继续追问或调整优先级。',
          ].join('\n'),
        },
        {
          prompt: '先看看整体有多少条异常，主要集中在哪些环节？',
          reply: '本周共记录 18 条履约异常：配送超时 9 条、商家出餐延迟 6 条、其他原因 3 条。超时问题主要出现在晚高峰，出餐延迟则集中在订单量较高的门店。',
        },
        {
          prompt: '把需要优先处理的单独挑出来，别只按异常次数排序。',
          reply: '结合超时时长、受影响订单数和重复发生情况，筛出 5 条高优先级异常。其中 3 条与配送衔接有关，2 条与出餐延迟有关；其余 13 条可以纳入日常跟进。',
        },
        {
          prompt: '这 5 条能再区分一下原因和责任方吗？',
          reply: '可以。配送类问题中，2 条发生在骑手接单后到店阶段，1 条是门店交接等待过长；出餐类问题集中在高峰时段备餐排队。明细里会保留异常时间、门店、影响订单和待核实责任方，避免把尚未确认的原因写成定论。',
        },
        {
          prompt: '给我一个门店侧能直接执行的处理顺序。',
          reply: '建议先联系涉及重复超时的门店核对交接记录，再与配送侧复盘晚高峰到店时间；随后排查两家出餐延迟门店的备餐排班。每项问题都可以在明细表中补充负责人和跟进状态。',
        },
        {
          prompt: '好，做成看板、异常明细表和一份分析文档，我要方便继续跟进。',
          reply: '已完成整理。本周共发现 18 条履约异常，其中 5 条需要优先处理，主要集中在配送超时和商家出餐延迟。看板展示整体分布，明细表列出优先级与跟进信息，分析文档汇总原因及处理建议。',
        },
        {
          prompt: '再看一下异常明细文件，确认哪些门店需要优先跟进。',
          reply: '',
        },
      ],
      files: ['门店履约异常看板.html', '门店履约异常明细.xlsx', '门店履约分析.docx'],
    }],
    [retailConversationTask, {
      folderId: 'retail',
      prompt: '请配置并校验 AI 工具约束文件，整理成一份报告。',
      reply: '已完成 AI 工具约束文件的配置与校验，并生成配置报告。',
      files: ['AI 工具约束配置报告.docx'],
    }],
  ]);
  const conversationThreads = new Map();
  let activeConversationTask = null;
  const conversationTaskTitle = document.getElementById('conversationTaskTitle');
  const conversationTaskMore = document.getElementById('conversationTaskMore');
  const conversationTaskFeedback = document.getElementById('conversationTaskFeedback');
  const conversationAgentItems = document.getElementById('conversationAgentItems');
  const conversationAgentSummary = document.getElementById('conversationAgentSummary');
  const conversationAiTaskItems = document.getElementById('conversationAiTaskItems');
  const conversationAiTaskSummary = document.getElementById('conversationAiTaskSummary');
  const conversationStatusStack = conversationPage.querySelector('.conversation-status-stack');
  // 状态条浮在滚动区之上；用它的可见高度为消息末尾预留可滚动空间。
  const conversationStatusObserver = new ResizeObserver(() => {
    conversationScroll.style.setProperty('--conversation-status-clearance', `${conversationStatusStack.getBoundingClientRect().height}px`);
  });
  conversationStatusObserver.observe(conversationStatusStack);
  const aiTasks = Array.from(conversationAiTaskItems.querySelectorAll('.conversation-status-item'));
  const runningAiTasks = aiTasks.filter((item) => item.querySelector('.is-running')).length;
  conversationAiTaskSummary.textContent = `共 ${aiTasks.length} 项 · ${runningAiTasks} 项进行中`;
  const statusSpinner = '<span class="spinner" aria-hidden="true"></span>';
  const statusCheck = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>';

  function renderConversationAgents() {
    const agents = Array.from(activeConversationTask?.closest('[data-agent-task]')?.querySelectorAll('.subagent-task') || []);
    conversationAgentSummary.textContent = `使用了 ${agents.length} 个子 Agent`;
    conversationAgentItems.innerHTML = agents.map((agent) => {
      const running = agent.dataset.state === 'running';
      const name = agent.querySelector('.task-name').textContent.trim();
      return `<button class="conversation-status-item" type="button" aria-pressed="false">` +
        `<span class="conversation-status-name">${esc(name)}</span>` +
        `<span class="conversation-status-state ${running ? 'is-running' : 'is-done'}">` +
        `${running ? statusSpinner : statusCheck}${running ? '进行中' : '已完成'}</span></button>`;
    }).join('');
  }

  conversationStatusStack.addEventListener('click', (event) => {
    const trigger = event.target.closest('.conversation-status-trigger');
    if (trigger) {
      const expanded = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(expanded));
      document.getElementById(trigger.getAttribute('aria-controls')).hidden = !expanded;
      return;
    }
    const item = event.target.closest('.conversation-status-item');
    if (item) item.setAttribute('aria-pressed', String(item.getAttribute('aria-pressed') !== 'true'));
  });
  renderConversationAgents();

  const conversationTaskMenu = document.createElement('div');
  conversationTaskMenu.id = 'conversationTaskMenu';
  conversationTaskMenu.className = 'row-menu';
  conversationTaskMenu.setAttribute('role', 'menu');
  conversationTaskMenu.hidden = true;
  conversationTaskMenu.innerHTML = renderTaskMenu(TASK_MENU, 'data-conversation-act');
  document.body.appendChild(conversationTaskMenu);
  let conversationFeedbackTimer;

  function closeConversationTaskMenu(restoreFocus = false) {
    if (conversationTaskMenu.hidden) return;
    conversationTaskMenu.hidden = true;
    conversationTaskMenu.classList.remove('open');
    conversationTaskMore.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !conversationPage.hidden) conversationTaskMore.focus();
  }

  function showConversationFeedback(message) {
    conversationTaskFeedback.textContent = message;
    clearTimeout(conversationFeedbackTimer);
    conversationFeedbackTimer = setTimeout(() => { conversationTaskFeedback.textContent = ''; }, 2500);
  }

  conversationTaskMore.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!conversationTaskMenu.hidden) { closeConversationTaskMenu(); return; }
    closeRowMenu();
    const container = activeConversationTask.matches('.task-parent') ? activeConversationTask.closest('[data-agent-task]') : activeConversationTask;
    conversationTaskMenu.querySelector('[data-conversation-act="pin"] span').textContent = container.dataset.pinned === 'true' ? '取消置顶' : '置顶';
    conversationTaskMenu.hidden = false;
    conversationTaskMenu.classList.add('open');
    conversationTaskMore.setAttribute('aria-expanded', 'true');
    const button = conversationTaskMore.getBoundingClientRect();
    placeWindowMenu(conversationTaskMenu, button.left, button.bottom + 4, button.top - 4);
    conversationTaskMenu.querySelector('button')?.focus();
  });

  async function runTaskMenuAction(action, task) {
    const container = task.matches('.task-parent') ? task.closest('[data-agent-task]') : task;
    const nameEl = task.querySelector('.task-name');
    const isCurrentConversation = task === activeConversationTask;
    if (action === 'pin') {
      const pinned = container.dataset.pinned !== 'true';
      container.dataset.pinned = String(pinned);
      if (pinned) container.parentElement.prepend(container);
      else {
        const home = taskHomes.get(container);
        home.parent.insertBefore(container, home.next?.parentNode === home.parent ? home.next : null);
      }
      if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback(pinned ? '已置顶' : '已取消置顶');
    } else if (action === 'rename') {
      const name = window.prompt('重命名任务', nameEl.textContent)?.trim();
      if (name) {
        nameEl.textContent = name;
        if (isCurrentConversation) conversationTaskTitle.textContent = name;
        refreshClipped();
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback('已重命名');
      }
    } else if (action === 'copy-directory' || action === 'copy-id') {
      const folderId = task.closest('[data-folder]')?.dataset.folder || 'default';
      const text = action === 'copy-id' ? taskIds.get(task) : FOLDERS.find((folder) => folder.id === folderId)?.path;
      try {
        await navigator.clipboard.writeText(text);
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback(action === 'copy-id' ? '会话 ID 已复制' : '工作目录已复制');
      } catch (error) {
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback('复制失败，请检查剪贴板权限');
      }
    } else if (action === 'delete' && window.confirm(`确定删除“${nameEl.textContent}”吗？`)) {
      if (isCurrentConversation && !conversationPage.hidden) setConversationOpen(false);
      container.remove();
      refreshClipped();
    }
  }

  conversationTaskMenu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-conversation-act]')?.dataset.conversationAct;
    if (!action) return;
    closeConversationTaskMenu();
    void runTaskMenuAction(action, activeConversationTask);
    if (!conversationPage.hidden) conversationTaskMore.focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!conversationTaskMenu.contains(event.target) && !conversationTaskMore.contains(event.target)) closeConversationTaskMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeConversationTaskMenu(true);
  });
  window.addEventListener('resize', () => closeConversationTaskMenu());
  window.addEventListener('scroll', () => closeConversationTaskMenu(), true);
  const newTaskNav = document.getElementById('newTaskNav');

  const artifactIconByExtension = {
    doc: 'doc', docx: 'doc', xls: 'excel', xlsx: 'excel', csv: 'excel',
    html: 'html', htm: 'html', png: 'image', jpg: 'image', jpeg: 'image',
    gif: 'image', webp: 'image', md: 'markdown', pdf: 'pdf', ppt: 'ppt', pptx: 'ppt',
  };

  function renderConversationArtifacts(task) {
    const example = conversationExamples.get(task);
    const conversationArtifacts = conversationThread.querySelector('#conversationArtifacts');
    conversationArtifacts.classList.toggle('is-single', example.files.length === 1);
    conversationArtifacts.innerHTML = example.files.map((name, index) => {
      const extension = name.split('.').pop().toLowerCase();
      const icon = artifactIconByExtension[extension] || 'doc';
      return `<button class="conversation-artifact" type="button" data-artifact-index="${index}" aria-label="查看产物：${esc(name)}">` +
        `<span class="conversation-artifact-icon"><img src="assets/artifact-${icon}.svg" alt="" aria-hidden="true"></span>` +
        `<span><strong>${esc(name)}</strong><small>查看产物</small></span>` +
        `<svg viewBox="0 0 24 24" class="ic conversation-artifact-arrow" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
    }).join('');
  }

  function conversationTurns() {
    return Array.from(conversationThread.querySelectorAll('.user-message'));
  }

  function updateConversationTurnNav(previewIndex = -1) {
    const turns = conversationTurns();
    if (turns.length < 2 || conversationTurnNav.hidden) return;
    const buttons = Array.from(conversationTurnNav.querySelectorAll('.conversation-turn'));
    const position = conversationScroll.getBoundingClientRect().top + conversationScroll.clientHeight * .32;
    let activeIndex = 0;
    turns.forEach((turn, index) => {
      if (turn.getBoundingClientRect().top <= position) activeIndex = index;
    });
    if (conversationScroll.scrollTop + conversationScroll.clientHeight >= conversationScroll.scrollHeight - 2) {
      activeIndex = turns.length - 1;
    }
    buttons.forEach((button, index) => {
      button.classList.toggle('is-completed', index < activeIndex);
      button.classList.toggle('is-active', index === activeIndex);
      button.classList.toggle('is-previewed', index === previewIndex);
      button.classList.toggle('is-preview-neighbor', Math.abs(index - previewIndex) === 1 && previewIndex >= 0);
      if (index === activeIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function renderConversationTurnNav() {
    const turns = conversationTurns();
    conversationTurnNav.hidden = turns.length < 2;
    conversationTurnNav.innerHTML = turns.length < 2 ? '' : turns.map((turn, index) => {
      const question = turn.querySelector('.message-bubble')?.textContent.trim() || '对话';
      const answer = turn.nextElementSibling?.querySelector('.assistant-content')?.textContent.trim() || '';
      return `<button class="conversation-turn" type="button" data-turn-index="${index}" aria-label="跳转到第 ${index + 1} 轮：${esc(question)}">` +
        `<span class="conversation-turn-preview" aria-hidden="true"><strong>${esc(question)}</strong>${answer ? `<br>${esc(answer.slice(0, 90))}${answer.length > 90 ? '…' : ''}` : ''}</span></button>`;
    }).join('');
    updateConversationTurnNav();
  }

  conversationScroll.addEventListener('scroll', () => {
    const hovered = conversationTurnNav.querySelector('.conversation-turn:hover, .conversation-turn:focus-visible');
    updateConversationTurnNav(hovered ? Number(hovered.dataset.turnIndex) : -1);
  }, { passive:true });
  conversationTurnNav.addEventListener('pointerover', (event) => {
    const button = event.target.closest('.conversation-turn');
    if (button) updateConversationTurnNav(Number(button.dataset.turnIndex));
  });
  conversationTurnNav.addEventListener('pointerleave', () => updateConversationTurnNav());
  conversationTurnNav.addEventListener('focusin', (event) => {
    const button = event.target.closest('.conversation-turn');
    if (button) updateConversationTurnNav(Number(button.dataset.turnIndex));
  });
  conversationTurnNav.addEventListener('focusout', () => requestAnimationFrame(() => {
    if (!conversationTurnNav.contains(document.activeElement)) updateConversationTurnNav();
  }));
  conversationTurnNav.addEventListener('click', (event) => {
    const button = event.target.closest('.conversation-turn');
    if (!button) return;
    const turn = conversationTurns()[Number(button.dataset.turnIndex)];
    if (turn) conversationScroll.scrollTo({
      top:conversationScroll.scrollTop + turn.getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top - 16,
      behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });

  function setConversationOpen(open, task = activeConversationTask || conversationTask) {
    closeAccessMenus();
    if (!open) closeConversationTaskMenu();
    if (open && activeConversationTask !== task) {
      if (activeConversationTask) conversationThreads.set(activeConversationTask, conversationThread.innerHTML);
      activeConversationTask?.setAttribute('aria-current', 'false');
      activeConversationTask = task;
      const example = conversationExamples.get(task);
      if (conversationThreads.has(task)) {
        conversationThread.innerHTML = conversationThreads.get(task);
      } else {
        const turns = example.turns || [{ prompt: example.prompt, reply: example.reply }];
        conversationThread.innerHTML = turns.map(({ prompt, reply }, index) =>
          `<div class="conversation-message user-message"><div class="message-bubble">${esc(prompt)}</div></div>` +
          `<div class="conversation-message assistant-message"><div class="assistant-content">${reply ? `<article class="md conversation-reply">${renderMarkdown(reply)}</article>` : ''}` +
          (index === (task === conversationTask ? turns.length - 2 : turns.length - 1) ? '<div class="conversation-artifacts" id="conversationArtifacts" aria-label="对话产物"></div>' : '') +
          (task === conversationTask && index === turns.length - 1 ? `<div class="conversation-activity" role="status" aria-label="已读取文件，正在思考"><div class="conversation-activity-file"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/></svg><span>已读取文件</span><span class="conversation-activity-filename">门店履约异常明细.xlsx</span></div><div class="conversation-activity-thinking"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></svg><span>正在思考</span></div></div>` : '') +
          '</div></div>'
        ).join('');
      }
      renderConversationArtifacts(task);
      const folder = FOLDERS.find((entry) => entry.id === example.folderId);
      if (folder) selectFolder(folder.id);
      conversationStatusStack.hidden = task !== conversationTask;
    }
    if (open) renderConversationAgents();
    mainView.classList.toggle('conversation-open', open);
    conversationPage.hidden = !open;
    activeConversationTask?.setAttribute('aria-current', open ? 'page' : 'false');
    if (open) conversationTaskTitle.textContent = task.querySelector('.task-name')?.textContent.trim() || '当前任务';
    if (!summaryPopover.hidden) renderSummaryContents();
    if (open) {
      setWorkbench(false);
      renderConversationTurnNav();
      requestAnimationFrame(() => {
        conversationScroll.scrollTop = task === conversationTask ? conversationScroll.scrollHeight : 0;
        updateConversationTurnNav();
      });
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
    renderConversationTurnNav();
    conversationPrompt.value = '';
    resizeConversationPrompt();
    requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
  }

  conversationExamples.forEach((example, task) => {
    task.addEventListener('click', (e) => {
      if (e.target.closest('[data-toggle-agents], .row-acts, .row-act')) return;
      e.preventDefault();
      setConversationOpen(true, task);
    });
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
  let stopArtifactScrollAnchor = null;
  function anchorConversationToArtifact(button) {
    stopArtifactScrollAnchor?.();
    const top = button.getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top;
    const previousOverflowAnchor = conversationScroll.style.overflowAnchor;
    conversationScroll.style.overflowAnchor = 'none';
    let frame;
    let active = true;
    const keepPosition = () => {
      if (!active) return;
      if (!button.isConnected) { stop(); return; }
      const currentTop = button.getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top;
      conversationScroll.scrollTop += currentTop - top;
      updateConversationTurnNav();
      frame = requestAnimationFrame(keepPosition);
    };
    const stop = () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      content.removeEventListener('transitionend', onTransitionEnd);
      conversationScroll.removeEventListener('wheel', stop);
      conversationScroll.removeEventListener('touchstart', stop);
      conversationScroll.style.overflowAnchor = previousOverflowAnchor;
      if (stopArtifactScrollAnchor === stop) stopArtifactScrollAnchor = null;
    };
    const onTransitionEnd = (event) => {
      if (event.target === content && event.propertyName === 'grid-template-columns') stop();
    };
    const timeout = setTimeout(stop, 500);
    content.addEventListener('transitionend', onTransitionEnd);
    conversationScroll.addEventListener('wheel', stop, { passive: true });
    conversationScroll.addEventListener('touchstart', stop, { passive: true });
    stopArtifactScrollAnchor = stop;
    frame = requestAnimationFrame(keepPosition);
  }
  conversationThread.addEventListener('click', (event) => {
    const button = event.target.closest('[data-artifact-index]');
    if (!button || !activeConversationTask) return;
    const example = conversationExamples.get(activeConversationTask);
    const folder = FOLDERS.find((entry) => entry.id === example.folderId);
    const node = folder?.files.find((file) => file.name === example.files[Number(button.dataset.artifactIndex)]);
    if (node) {
      anchorConversationToArtifact(button);
      openArtifactPreview(node, [folder, node]);
    }
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

  /* ---------- 输入框添加信息：首页与对话页共用一个分级菜单 ---------- */
  const addMenu = document.createElement('div');
  addMenu.className = 'composer-add-menu';
  addMenu.id = 'composerAddMenu';
  addMenu.setAttribute('role', 'menu');
  addMenu.setAttribute('aria-label', '添加信息');
  addMenu.hidden = true;
  document.body.appendChild(addMenu);
  const addSubmenu = document.createElement('div');
  addSubmenu.className = 'composer-add-menu composer-add-submenu';
  addSubmenu.id = 'composerAddSubmenu';
  addSubmenu.setAttribute('role', 'menu');
  addSubmenu.setAttribute('aria-label', '添加信息子菜单');
  addSubmenu.hidden = true;
  document.body.appendChild(addSubmenu);
  const addFileInput = document.createElement('input');
  addFileInput.type = 'file';
  addFileInput.multiple = true;
  addFileInput.hidden = true;
  document.body.appendChild(addFileInput);
  const attachedLocalFiles = new WeakMap();
  const addTriggers = Array.from(document.querySelectorAll('.composer-add-trigger'));
  let activeAddTrigger = null;
  let addMenuPage = 'root';
  let addSubmenuTimer;
  const addLabels = { skill: '技能', expert: '专家', mcp: 'MCP' };
  // 原型没有实际广场接口：专家和 MCP 预置已添加示例，新增项保留在当前会话状态中。
  const installedAddItems = { skill: [], expert: ['数据开发', '产品顾问', '数据分析师', '前端工程师'], mcp: ['日历连接器', '文件系统连接器', '浏览器连接器'] };
  const connectorTrays = new Map([
    [prompt, document.getElementById('connectorTray')],
    [conversationPrompt, document.getElementById('conversationConnectorTray')],
  ]);
  const selectedConnectors = new Map([...connectorTrays.keys()].map(input => [input, new Set()]));
  function activeConnectors() {
    return selectedConnectors.get(addTarget()) || selectedConnectors.get(prompt);
  }
  const galleryExamples = {
    skill: ['文档总结', '数据分析', '网页制作'],
    expert: ['设计顾问', '内容策划', '自动化工程师'],
    mcp: ['知识库连接器', '项目管理连接器', '数据库连接器'],
  };
  // 沿用网站·NoCode 图标的耳朵与脸部轮廓，用面色和底色区分专家。
  const expertLooks = {
    '数据开发': 'data',
    '产品顾问': 'product',
    '数据分析师': 'analysis',
    '前端工程师': 'frontend',
    '设计顾问': 'design',
    '内容策划': 'content',
    '自动化工程师': 'automation',
  };
  const expertDescriptions = {
    '数据开发': '搭建数据流程，处理复杂数据任务',
    '产品顾问': '梳理用户需求，完善产品方案',
    '数据分析师': '洞察数据变化，提炼业务结论',
    '前端工程师': '实现页面交互，优化使用体验',
    '设计顾问': '打磨视觉方案，统一设计语言',
    '内容策划': '规划内容结构，写出清晰表达',
    '自动化工程师': '串联工具流程，减少重复操作',
  };
  function expertOptionCopy(name) {
    return `<span class="expert-option-copy"><strong>${esc(name)}</strong><small title="${esc(expertDescriptions[name] || '协助完成专业任务')}">${esc(expertDescriptions[name] || '协助完成专业任务')}</small></span>`;
  }
  function expertAvatar(name) {
    const palette = expertLooks[name] || expertLooks['数据开发'];
    return `<svg class="expert-avatar" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="var(--expert-${palette}-background)"/><path d="M4.2 24V12.3c0-3.4 1-6.5 2.8-8.9l2 3.4a8.5 8.5 0 0 1 6.4-.5l1.3-2.9c2 2.8 3.3 5.6 3.3 8.9 0 3.2-1.2 5.3-3.2 6.1-.5.2-.6.5-.6 1V24Z" fill="var(--expert-${palette}-face)"/><circle cx="10.6" cy="11.7" r="1" fill="var(--expert-${palette}-accent)"/><circle cx="15.8" cy="11.4" r="1" fill="var(--expert-${palette}-accent)"/></svg>`;
  }
  // 连接器使用各自的服务头像，不把所有 MCP 都画成同一个通用插头。
  const connectorLooks = {
    '日历连接器': ['#e8f0ff', '<rect x="6" y="7" width="12" height="11" rx="2" fill="white" stroke="#4285f4" stroke-width="1.5"/><path d="M6 10h12M9 5.5v3M15 5.5v3" fill="none" stroke="#4285f4" stroke-width="1.5" stroke-linecap="round"/><path d="m10 14 1.4 1.4 2.8-3" fill="none" stroke="#34a853" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'],
    '文件系统连接器': ['#fff2db', '<path d="M4.5 8a2 2 0 0 1 2-2h4l1.7 1.8h5.3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" fill="#f5b841"/><path d="M4.5 10.5h15v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" fill="#f8cd70"/>'],
    '浏览器连接器': ['#e5f3ff', '<circle cx="12" cy="12" r="7.8" fill="#278ee5"/><path d="M4.7 10.8h14.6M12 4.3c-2.5 2-3.6 4.6-3.6 7.7s1.1 5.7 3.6 7.7c2.5-2 3.6-4.6 3.6-7.7S14.5 6.3 12 4.3Z" fill="none" stroke="white" stroke-width="1.25"/><path d="M6.1 15.6h11.8" stroke="white" stroke-width="1.2"/>'],
    '知识库连接器': ['#f0eafd', '<path d="M5 5.5c2.7-1.2 5-1 7 .4 2-1.4 4.3-1.6 7-.4v12.8c-2.7-1.2-5-1-7 .4-2-1.4-4.3-1.6-7-.4Z" fill="#9068d2"/><path d="M12 6v12.5M7 9h3M14 9h3M7 12h3M14 12h3" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round"/>'],
    '项目管理连接器': ['#fff0e8', '<rect x="5" y="5" width="14" height="14" rx="3" fill="#f28a4c"/><path d="M9 9h6M9 12h4M9 15h6" stroke="white" stroke-width="1.6" stroke-linecap="round"/>'],
    '数据库连接器': ['#e2f6f2', '<ellipse cx="12" cy="7" rx="6.3" ry="2.5" fill="#2fb89b"/><path d="M5.7 7v9.5c0 1.4 2.8 2.5 6.3 2.5s6.3-1.1 6.3-2.5V7" fill="#2fb89b"/><path d="M5.7 11.7c0 1.4 2.8 2.5 6.3 2.5s6.3-1.1 6.3-2.5" fill="none" stroke="white" stroke-width="1.2"/>'],
  };
  function connectorAvatar(name) {
    const look = connectorLooks[name];
    if (!look) {
      const hue = [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 0);
      return `<span class="connector-avatar connector-avatar-fallback" style="--connector-hue:${hue}" aria-hidden="true">${esc(name.replace(/连接器$/, '').slice(0, 1))}</span>`;
    }
    return `<svg class="connector-avatar" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="${look[0]}"/>${look[1]}</svg>`;
  }
  const expertTriggers = [...document.querySelectorAll('.chip-agent')];
  let selectedExpert = '数据开发';
  let activeExpertTrigger = null;
  const expertMenu = document.createElement('div');
  expertMenu.className = 'expert-switch-menu';
  expertMenu.id = 'expertSwitchMenu';
  expertMenu.setAttribute('role', 'menu');
  expertMenu.setAttribute('aria-label', '选择专家');
  expertMenu.hidden = true;
  document.body.appendChild(expertMenu);
  function updateExpertTriggers() {
    expertTriggers.forEach(trigger => {
      const chip = trigger.closest('.expert-chip');
      trigger.querySelector('.avatar').innerHTML = selectedExpert ? expertAvatar(selectedExpert) : '';
      trigger.querySelector('.expert-name').textContent = selectedExpert || '选择专家';
      trigger.setAttribute('aria-label', selectedExpert ? `切换专家，当前：${selectedExpert}` : '选择专家');
      chip.dataset.expertSelected = String(Boolean(selectedExpert));
      chip.querySelector('.expert-clear').disabled = !selectedExpert;
    });
  }
  function selectExpert(name) {
    selectedExpert = name;
    updateExpertTriggers();
  }
  function closeExpertMenu(restoreFocus = false) {
    expertMenu.hidden = true;
    activeExpertTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) activeExpertTrigger?.focus();
    activeExpertTrigger = null;
  }
  function placeExpertMenu() {
    if (!activeExpertTrigger || expertMenu.hidden) return;
    const trigger = activeExpertTrigger.getBoundingClientRect();
    const width = expertMenu.offsetWidth;
    const height = expertMenu.offsetHeight;
    expertMenu.style.left = `${Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8))}px`;
    expertMenu.style.top = `${trigger.top - height - 6 >= 8 ? trigger.top - height - 6 : Math.min(trigger.bottom + 6, window.innerHeight - height - 8)}px`;
  }
  updateExpertTriggers();
  document.querySelectorAll('.expert-clear').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    selectExpert(null);
    closeExpertMenu();
    button.closest('.expert-chip').querySelector('.chip-agent').focus();
  }));
  expertTriggers.forEach(trigger => {
    trigger.setAttribute('aria-controls', expertMenu.id);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      if (activeExpertTrigger === trigger) { closeExpertMenu(); return; }
      closeExpertMenu();
      activeExpertTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      expertMenu.innerHTML = installedAddItems.expert.map((name, index) => `<button class="expert-switch-item" type="button" role="menuitemradio" aria-checked="${name === selectedExpert}" data-expert-index="${index}">${expertAvatar(name)}${expertOptionCopy(name)}${name === selectedExpert ? '<span class="expert-switch-current">✓</span>' : ''}</button>`).join('');
      expertMenu.hidden = false;
      placeExpertMenu();
      (expertMenu.querySelector('[aria-checked="true"]') || expertMenu.querySelector('.expert-switch-item'))?.focus();
    });
  });
  expertMenu.addEventListener('click', event => {
    const option = event.target.closest('[data-expert-index]');
    if (!option) return;
    selectExpert(installedAddItems.expert[Number(option.dataset.expertIndex)]);
    closeExpertMenu(true);
  });
  document.addEventListener('click', event => {
    if (!expertMenu.hidden && !expertMenu.contains(event.target) && !event.target.closest('.chip-agent')) closeExpertMenu();
  });
  expertMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeExpertMenu(true); }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...expertMenu.querySelectorAll('[data-expert-index]')];
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  });
  window.addEventListener('resize', placeExpertMenu);
  const addDialog = document.createElement('dialog');
  addDialog.className = 'composer-add-dialog';
  addDialog.setAttribute('aria-label', '选择要添加的信息');
  document.body.appendChild(addDialog);
  let dialogPage = 'library';
  let dialogFolder = null;
  let dialogQuery = '';
  const addIcons = {
    file: '<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/>',
    local: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
    library: '<path d="M12 6.3c-2.1-1.5-4.7-1.8-7.4-1.2A2.1 2.1 0 0 0 3 7.2v11.2c0 .7.7 1.2 1.4 1 2.8-.7 5.5-.3 7.6 1.1 2.1-1.4 4.8-1.8 7.6-1.1.7.2 1.4-.3 1.4-1V7.2a2.1 2.1 0 0 0-1.6-2.1c-2.7-.6-5.3-.3-7.4 1.2Z"/><path d="M12 6.3v14.2M6 9.3c.8-.1 1.6 0 2.4.2M6 12.6c.8-.1 1.6 0 2.4.2"/>',
    skill: '<path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4Z"/>',
    expert: '<path d="M12 6.1c-1.5-2.5-5.4-2.8-6.8.2-.5 1-.5 2.1-.1 3.1-1.8 1.7-2 4.2-.5 6-.2 2.7 1.6 4.7 4 4.7 1.7 0 2.8-1.1 3.4-2.5.6 1.4 1.7 2.5 3.4 2.5 2.4 0 4.2-2 4-4.7 1.5-1.8 1.3-4.3-.5-6 .4-1 .4-2.1-.1-3.1-1.4-3-5.3-2.7-6.8-.2Z"/><path d="M12 6.1v11.5M8.9 14.2q1.55-2 3.1 0 1.55-2 3.1 0"/>',
    mcp: '<path d="M2.6 11.3 10.8 3.2a3.54 3.54 0 0 1 5 5L11 13"/><path d="m13.2 5.7-5.4 5.4a3.5 3.5 0 0 0 4.9 4.9l5.3-5.3"/><path d="M15.8 8.2a3.54 3.54 0 0 1 5 5l-7.7 7.7 1.7 1.7"/>',
    goal: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.7"/><path d="M12 2.2V6m0 12v3.8M2.2 12H6m12 0h3.8"/>',
    back: '<path d="m11 5-7 7 7 7M4 12h16"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
  };
  function addIcon(kind, extraClass = '') {
    return `<svg viewBox="0 0 24 24" class="ic ${extraClass}" aria-hidden="true">${addIcons[kind]}</svg>`;
  }
  function renderConnectorTray(input) {
    const tray = connectorTrays.get(input);
    const names = [...selectedConnectors.get(input)];
    tray.hidden = names.length === 0;
    tray.innerHTML = names.map(name => `<button class="connector-token" type="button" data-connector-name="${esc(name)}" aria-label="断开${esc(name)}" title="${esc(name)} · 已连接，点击断开">${connectorAvatar(name)}<span class="connector-status-dot" aria-hidden="true"></span></button>`).join('');
  }
  connectorTrays.forEach((tray, input) => tray.addEventListener('click', event => {
    const token = event.target.closest('[data-connector-name]');
    if (!token) return;
    selectedConnectors.get(input).delete(token.dataset.connectorName);
    renderConnectorTray(input);
    if (activeAddTrigger && addTarget() === input && addMenuPage === 'mcp' && !addSubmenu.hidden) renderAddList(addSubmenu.querySelector('.composer-add-input')?.value.trim() || '');
  }));
  function addItem(kind, label, next = false) {
    const submenuAttrs = next && kind !== 'library' ? ` aria-haspopup="menu" aria-controls="${addSubmenu.id}" aria-expanded="${addMenuPage === kind}"` : '';
    return `<button class="composer-add-item" type="button" role="menuitem" data-add-kind="${kind}"${submenuAttrs}>${addIcon(kind)}<span>${esc(label)}</span>${next ? addIcon('chevron', 'composer-add-chevron') : ''}</button>`;
  }
  function addTarget() {
    return activeAddTrigger?.closest('.conversation-page') ? conversationPrompt : prompt;
  }
  function appendAddReference(label) {
    const input = addTarget();
    if (!input) return;
    input.value += `${input.value && !/\s$/.test(input.value) ? ' ' : ''}@${label} `;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeAddMenu();
    input.focus();
  }
  function closeAddMenu(restoreFocus = false) {
    clearTimeout(addSubmenuTimer);
    addMenu.hidden = true;
    addSubmenu.hidden = true;
    if (activeAddTrigger) activeAddTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) activeAddTrigger?.focus();
    activeAddTrigger = null;
    addMenuPage = 'root';
  }
  function renderAddList(query = '') {
    const kind = addMenuPage;
    const list = addSubmenu.querySelector('.composer-add-list');
    if (!list || !addLabels[kind]) return;
    const items = installedAddItems[kind].filter(name => name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    list.innerHTML = items.length
      ? items.map((name, index) => `<button class="composer-add-item${kind === 'mcp' && activeConnectors().has(name) ? ' is-selected' : ''}" type="button" data-add-installed="${index}"${kind === 'mcp' || kind === 'expert' ? ` aria-pressed="${kind === 'expert' ? name === selectedExpert : activeConnectors().has(name)}"` : ''}>${kind === 'expert' ? expertAvatar(name) : kind === 'mcp' ? connectorAvatar(name) : addIcon(kind)}${kind === 'expert' ? expertOptionCopy(name) : `<span>${esc(name)}</span>`}${kind === 'expert' && name === selectedExpert ? '<small class="composer-add-selected">已选</small>' : ''}${kind === 'mcp' ? `<span class="composer-add-check" aria-hidden="true">${activeConnectors().has(name) ? '✓' : ''}</span>` : ''}</button>`).join('')
      : `<p class="composer-add-empty">${query ? '没有匹配的' + addLabels[kind] : '还没有添加' + addLabels[kind]}</p>`;
    addSubmenu._visibleInstalled = items;
    placeAddSubmenu();
  }
  function renderAddMenu() {
    addMenu.innerHTML = addItem('file', '添加文件', true) + addItem('skill', '技能', true)
      + `<button class="composer-add-item composer-add-goal" type="button" role="menuitem" data-add-kind="goal">${addIcon('goal')}<span>目标</span><small>对话任务持续实现的目标</small></button>`
      + '<div class="composer-add-divider" role="separator" aria-label="分组"></div>'
      + addItem('expert', '专家', true) + addItem('mcp', 'MCP', true);
  }
  function renderAddSubmenu() {
    if (addMenuPage === 'root') { addSubmenu.hidden = true; return; }
    const back = addItem('back', '返回');
    if (addMenuPage === 'file') {
      addSubmenu.innerHTML = addItem('local', '上传本地文件') + addItem('library', '从资料库添加', true);
    } else if (addMenuPage === 'library') {
      const entries = recentOpenedFiles.slice(0, 5);
      addSubmenu._libraryEntries = entries;
      addSubmenu.innerHTML = back + '<div class="composer-add-section">最近打开</div>'
        + (entries.length ? entries.map((entry, index) => `<button class="composer-add-item composer-add-file" type="button" data-add-library="${index}">${addIcon('file')}<span title="${esc(entry.node.name)}">${esc(entry.node.name)}</span><small>${esc(entry.chain.slice(0, -1).map(node => node.name).join(' / '))}</small></button>`).join('') : '<p class="composer-add-empty">还没有最近打开的文件</p>')
        + `<div class="composer-add-divider" aria-hidden="true"></div><button class="composer-add-item composer-add-more" type="button" data-add-open-dialog="library">${addIcon('library')}<span>浏览全部资料库文件</span>${addIcon('chevron', 'composer-add-chevron')}</button>`;
    } else if (addLabels[addMenuPage]) {
      const kind = addMenuPage;
      addSubmenu.innerHTML = `<input class="composer-add-input" id="composerAddSearch" type="search" aria-label="搜索已添加的${addLabels[kind]}" placeholder="搜索已添加的${addLabels[kind]}" autocomplete="off"><div class="composer-add-list"></div><div class="composer-add-divider" aria-hidden="true"></div><button class="composer-add-item composer-add-more" type="button" data-add-open-dialog="${kind}">${addIcon(kind)}<span>去广场添加更多${addLabels[kind]}</span>${addIcon('chevron', 'composer-add-chevron')}</button>`;
      renderAddList();
    }
    addSubmenu.hidden = false;
    addMenu.querySelectorAll('[aria-haspopup="menu"]').forEach(item => {
      item.setAttribute('aria-expanded', String(item.dataset.addKind === (addMenuPage === 'library' ? 'file' : addMenuPage)));
    });
    placeAddSubmenu();
  }
  function showAddSubmenu(kind, focus = false) {
    clearTimeout(addSubmenuTimer);
    if (addMenuPage !== kind || addSubmenu.hidden) {
      addMenuPage = kind;
      renderAddSubmenu();
    }
    if (focus) addSubmenu.querySelector(addLabels[kind] ? '.composer-add-input' : 'button')?.focus();
  }
  function hideAddSubmenu() {
    clearTimeout(addSubmenuTimer);
    addMenuPage = 'root';
    addSubmenu.hidden = true;
    addMenu.querySelectorAll('[aria-haspopup="menu"]').forEach(item => item.setAttribute('aria-expanded', 'false'));
  }
  function libraryEntries() {
    const entries = [];
    const visit = (nodes, chain) => (nodes || []).forEach(node => {
      const path = chain.concat(node);
      if (node.type === 'folder') visit(node.files, path);
      else entries.push({ node, chain: path });
    });
    FOLDERS.forEach(folder => visit(folder.files, [folder]));
    return entries;
  }
  function renderAddDialog() {
    const isLibrary = dialogPage === 'library';
    const title = isLibrary ? '从资料库添加' : `添加${addLabels[dialogPage]}`;
    addDialog.innerHTML = `<div class="composer-dialog-head"><div><h2>${title}</h2><p>${isLibrary ? '选择文件，添加到当前对话' : '广场示例 · 添加后可在加号菜单中使用'}</p></div><button type="button" class="composer-dialog-close" data-dialog-close aria-label="关闭">×</button></div>`
      + `<input class="composer-add-input composer-dialog-search" type="search" aria-label="搜索${isLibrary ? '资料库文件' : title}" placeholder="搜索${isLibrary ? '全部文件' : '广场' + addLabels[dialogPage]}" value="${esc(dialogQuery)}" autocomplete="off">`
      + '<div class="composer-dialog-results"></div>';
    renderAddDialogResults();
  }
  function renderAddDialogResults() {
    const container = addDialog.querySelector('.composer-dialog-results');
    if (!container) return;
    if (dialogPage === 'library') {
      const all = libraryEntries();
      const nodes = dialogQuery ? all.filter(entry => entry.node.name.toLocaleLowerCase().includes(dialogQuery.toLocaleLowerCase()))
        : dialogFolder ? all.filter(entry => entry.chain[0] === dialogFolder) : all;
      const folders = !dialogQuery && !dialogFolder ? `<div class="composer-add-section">文件夹</div>${FOLDERS.map((folder, index) => `<button type="button" class="composer-dialog-row" data-dialog-folder="${index}">${addIcon('file')}<span>${esc(folder.name)}</span>${addIcon('chevron')}</button>`).join('')}` : '';
      container.innerHTML = (dialogFolder && !dialogQuery ? `<button type="button" class="composer-dialog-back" data-dialog-back>${addIcon('back')} 全部文件夹</button>` : '')
        + folders + `<div class="composer-add-section">${dialogQuery ? '搜索结果' : dialogFolder ? esc(dialogFolder.name) : '全部文件'}</div>`
        + (nodes.length ? nodes.map(entry => `<button type="button" class="composer-dialog-row" data-dialog-file="${all.indexOf(entry)}">${addIcon('file')}<span>${esc(entry.node.name)}<small>${esc(entry.chain.slice(0, -1).map(node => node.name).join(' / '))}</small></span>${addIcon('chevron')}</button>`).join('') : '<p class="composer-add-empty">没有找到文件</p>');
      addDialog._libraryEntries = all;
    } else {
      const examples = galleryExamples[dialogPage].filter(name => name.toLocaleLowerCase().includes(dialogQuery.toLocaleLowerCase()));
      container.innerHTML = examples.length ? examples.map(name => `<div class="composer-dialog-row">${dialogPage === 'expert' ? expertAvatar(name) : dialogPage === 'mcp' ? connectorAvatar(name) : addIcon(dialogPage)}${dialogPage === 'expert' ? expertOptionCopy(name) : `<span>${esc(name)}</span>`}<button type="button" class="composer-dialog-install" data-dialog-install="${esc(name)}" ${installedAddItems[dialogPage].includes(name) ? 'disabled' : ''}>${installedAddItems[dialogPage].includes(name) ? '已添加' : '添加'}</button></div>`).join('') : '<p class="composer-add-empty">没有匹配的结果</p>';
    }
  }
  function openAddDialog(page) {
    dialogPage = page;
    dialogFolder = null;
    dialogQuery = '';
    addMenu.hidden = true;
    addSubmenu.hidden = true;
    renderAddDialog();
    addDialog.showModal();
    addDialog.querySelector('.composer-dialog-search')?.focus();
  }
  function returnFromAddDialog() {
    if (!activeAddTrigger) return;
    addMenu.hidden = false;
    renderAddMenu();
    placeAddMenu();
    renderAddSubmenu();
    (addSubmenu.hidden ? addMenu : addSubmenu).querySelector('.composer-add-input, button')?.focus();
  }
  addDialog.addEventListener('close', returnFromAddDialog);
  addDialog.addEventListener('input', event => {
    if (!event.target.matches('.composer-dialog-search')) return;
    dialogQuery = event.target.value.trim();
    renderAddDialogResults();
  });
  addDialog.addEventListener('click', event => {
    if (event.target === addDialog || event.target.closest('[data-dialog-close]')) { addDialog.close(); return; }
    const folder = event.target.closest('[data-dialog-folder]');
    if (folder) { dialogFolder = FOLDERS[Number(folder.dataset.dialogFolder)]; renderAddDialogResults(); return; }
    if (event.target.closest('[data-dialog-back]')) { dialogFolder = null; renderAddDialogResults(); return; }
    const file = event.target.closest('[data-dialog-file]');
    if (file) {
      const entry = addDialog._libraryEntries[Number(file.dataset.dialogFile)];
      addDialog.close();
      if (entry) appendAddReference(entry.node.name);
      return;
    }
    const install = event.target.closest('[data-dialog-install]');
    if (install && !install.disabled) {
      installedAddItems[dialogPage].push(install.dataset.dialogInstall);
      renderAddDialogResults();
    }
  });
  function placeAddMenu() {
    if (!activeAddTrigger || addMenu.hidden) return;
    const trigger = activeAddTrigger.getBoundingClientRect();
    const bounds = win.getBoundingClientRect();
    const width = addMenu.getBoundingClientRect().width;
    const height = addMenu.getBoundingClientRect().height;
    addMenu.style.left = `${Math.max(bounds.left + 8, Math.min(trigger.left, bounds.right - width - 8))}px`;
    addMenu.style.top = `${trigger.top - height - 6 >= bounds.top + 8 ? trigger.top - height - 6 : Math.min(trigger.bottom + 6, bounds.bottom - height - 8)}px`;
    placeAddSubmenu();
  }
  function placeAddSubmenu() {
    if (!activeAddTrigger || addMenu.hidden || addSubmenu.hidden) return;
    const bounds = win.getBoundingClientRect();
    const parent = addMenu.getBoundingClientRect();
    const width = addSubmenu.getBoundingClientRect().width;
    const height = addSubmenu.getBoundingClientRect().height;
    const right = parent.right + 6;
    addSubmenu.style.left = `${right + width <= bounds.right - 8 ? right : Math.max(bounds.left + 8, parent.left - width - 6)}px`;
    addSubmenu.style.top = `${Math.max(bounds.top + 8, Math.min(parent.top, bounds.bottom - height - 8))}px`;
  }
  addTriggers.forEach(trigger => {
    trigger.setAttribute('aria-controls', addMenu.id);
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      if (activeAddTrigger === trigger && !addMenu.hidden) { closeAddMenu(); return; }
      closeAddMenu();
      activeAddTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      addMenuPage = 'root';
      addMenu.hidden = false;
      renderAddMenu();
      placeAddMenu();
      addMenu.querySelector('.composer-add-input, button')?.focus();
    });
  });
  addMenu.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const item = event.target.closest('[data-add-kind]');
    if (!item || !addMenu.contains(item) || item.contains(event.relatedTarget)) return;
    const kind = item.dataset.addKind;
    if (['file', 'skill', 'expert', 'mcp'].includes(kind)) showAddSubmenu(kind);
    else hideAddSubmenu();
  });
  addMenu.addEventListener('pointerleave', event => {
    if (addSubmenu.contains(event.relatedTarget)) return;
    clearTimeout(addSubmenuTimer);
    addSubmenuTimer = setTimeout(() => {
      if (!addSubmenu.contains(document.activeElement)) hideAddSubmenu();
    }, 180);
  });
  addSubmenu.addEventListener('pointerenter', () => clearTimeout(addSubmenuTimer));
  addSubmenu.addEventListener('pointerleave', event => {
    if (addMenu.contains(event.relatedTarget)) return;
    clearTimeout(addSubmenuTimer);
    addSubmenuTimer = setTimeout(() => {
      if (!addSubmenu.contains(document.activeElement)) hideAddSubmenu();
    }, 180);
  });
  addMenu.addEventListener('click', event => {
    event.stopPropagation();
    const kind = event.target.closest('[data-add-kind]')?.dataset.addKind;
    if (kind === 'goal') openGoalDialog(activeAddTrigger);
    else if (['file', 'skill', 'expert', 'mcp'].includes(kind)) showAddSubmenu(kind, true);
  });
  addSubmenu.addEventListener('click', event => {
    event.stopPropagation();
    const libraryButton = event.target.closest('[data-add-library]');
    if (libraryButton) {
      const entry = addSubmenu._libraryEntries[Number(libraryButton.dataset.addLibrary)];
      if (entry) appendAddReference(entry.node.name);
      return;
    }
    const installedButton = event.target.closest('[data-add-installed]');
    if (installedButton) {
      const name = addSubmenu._visibleInstalled[Number(installedButton.dataset.addInstalled)];
      if (name && addMenuPage === 'mcp') toggleConnector(installedButton, addSubmenu);
      else if (name && addMenuPage === 'expert') {
        selectExpert(name);
        closeAddMenu();
      } else if (name) appendAddReference(`${addLabels[addMenuPage]}:${name}`);
      return;
    }
    const dialogButton = event.target.closest('[data-add-open-dialog]');
    if (dialogButton) { openAddDialog(dialogButton.dataset.addOpenDialog); return; }
    const kind = event.target.closest('[data-add-kind]')?.dataset.addKind;
    if (kind === 'back') {
      if (addMenuPage === 'library') showAddSubmenu('file', true);
      else hideAddSubmenu();
    } else if (kind === 'local') addFileInput.click();
    else if (kind === 'library') showAddSubmenu('library', true);
  });
  addFileInput.addEventListener('change', () => {
    const files = Array.from(addFileInput.files || []);
    if (files.length && activeAddTrigger) {
      const input = addTarget();
      attachedLocalFiles.set(input, [...(attachedLocalFiles.get(input) || []), ...files]);
      files.forEach(file => {
        input.value += `${input.value && !/\s$/.test(input.value) ? ' ' : ''}@${file.name} `;
      });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      closeAddMenu();
      input.focus();
    }
    addFileInput.value = '';
  });
  function toggleConnector(button, menu) {
    const name = menu._visibleInstalled[Number(button.dataset.addInstalled)];
    if (!name) return;
    const connectors = activeConnectors();
    if (connectors.has(name)) connectors.delete(name);
    else connectors.add(name);
    renderConnectorTray(addTarget());
    renderAddList(menu.querySelector('.composer-add-input')?.value.trim() || '');
    menu.querySelectorAll('[data-add-installed]')[Number(button.dataset.addInstalled)]?.focus();
  }
  addSubmenu.addEventListener('input', event => {
    if (event.target.matches('#composerAddSearch')) renderAddList(event.target.value.trim());
  });
  [addMenu, addSubmenu].forEach(menu => menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (menu === addSubmenu && addMenuPage !== 'root') {
        const kind = addMenuPage === 'library' ? 'file' : addMenuPage;
        hideAddSubmenu();
        addMenu.querySelector(`[data-add-kind="${kind}"]`)?.focus();
      } else closeAddMenu(true);
    } else if (menu === addMenu && event.key === 'ArrowRight') {
      const kind = event.target.closest('[data-add-kind]')?.dataset.addKind;
      if (['file', 'skill', 'expert', 'mcp'].includes(kind)) { event.preventDefault(); showAddSubmenu(kind, true); }
    } else if (menu === addSubmenu && event.key === 'ArrowLeft') {
      event.preventDefault();
      const kind = addMenuPage === 'library' ? 'file' : addMenuPage;
      hideAddSubmenu();
      addMenu.querySelector(`[data-add-kind="${kind}"]`)?.focus();
    }
  }));
  document.addEventListener('click', event => {
    if (!addMenu.hidden && !addMenu.contains(event.target) && !addSubmenu.contains(event.target) && !event.target.closest('.composer-add-trigger')) closeAddMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !addMenu.hidden) closeAddMenu(true);
  });
  window.addEventListener('resize', placeAddMenu);

  // 目标属于对话能力配置，不作为 @信息 插入消息正文。
  const goalDialog = document.createElement('dialog');
  goalDialog.className = 'composer-goal-dialog';
  goalDialog.setAttribute('aria-label', '设置对话目标');
  document.body.appendChild(goalDialog);
  const conversationGoals = new Map();
  let goalTrigger = null;
  function openGoalDialog(trigger) {
    if (!trigger) return;
    const input = trigger.closest('.conversation-page') ? conversationPrompt : prompt;
    closeAddMenu();
    goalTrigger = trigger;
    goalDialog.innerHTML = `<form method="dialog" class="composer-goal-form"><div class="composer-dialog-head"><div><h2>对话目标</h2><p>让 CatPaw 在后续对话中持续关注这个目标</p></div><button type="button" class="composer-dialog-close" data-goal-close aria-label="关闭">×</button></div><label for="composerGoalText">目标内容</label><textarea id="composerGoalText" rows="4" placeholder="例如：持续追踪门店履约异常，给出可执行的改进建议"></textarea><div class="composer-goal-actions"><button type="button" class="composer-goal-clear" data-goal-clear>移除目标</button><button type="submit" class="composer-goal-save">保存目标</button></div></form>`;
    goalDialog.querySelector('textarea').value = conversationGoals.get(input) || '';
    goalDialog.querySelector('[data-goal-clear]').disabled = !conversationGoals.has(input);
    goalDialog.showModal();
    goalDialog.querySelector('textarea').focus();
  }
  document.querySelectorAll('.composer-goal-summary').forEach(trigger => trigger.addEventListener('click', () => openGoalDialog(trigger)));
  function updateGoal(input, value) {
    if (value) conversationGoals.set(input, value);
    else conversationGoals.delete(input);
    const summary = input === conversationPrompt
      ? document.querySelector('.conversation-composer-actions .composer-goal-summary')
      : document.querySelector('.composer-row .composer-goal-summary');
    summary.textContent = `目标 · ${value}`;
    summary.title = `编辑对话目标：${value}`;
    summary.setAttribute('aria-label', `编辑对话目标：${value}`);
    summary.hidden = !value;
  }
  goalDialog.addEventListener('submit', event => {
    event.preventDefault();
    const input = goalTrigger.closest('.conversation-page') ? conversationPrompt : prompt;
    updateGoal(input, goalDialog.querySelector('textarea').value.trim());
    goalDialog.close();
  });
  goalDialog.addEventListener('click', event => {
    if (event.target === goalDialog || event.target.closest('[data-goal-close]')) goalDialog.close();
    if (event.target.closest('[data-goal-clear]')) {
      updateGoal(goalTrigger.closest('.conversation-page') ? conversationPrompt : prompt, '');
      goalDialog.close();
    }
  });
  goalDialog.addEventListener('close', () => {
    if (goalTrigger?.isConnected) goalTrigger.focus();
    goalTrigger = null;
  });

  /* ---------- 5.8 自定义模版：本机配置与可移植分享 ---------- */
  const templateDialog = document.getElementById('templateDialog');
  const templateList = document.getElementById('templateList');
  const templateForm = document.getElementById('templateForm');
  const templateToolbar = document.getElementById('templateToolbar');
  const templateImport = document.getElementById('templateImport');
  const templateStatus = document.getElementById('templateStatus');
  const templateStorageKey = 'catpaw-custom-templates-v1';
  let templates = [];
  let editingTemplateId = null;
  let templateReturnFocus = null;

  function normalizeTemplate(value) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.prompt !== 'string'
      || !value.title.trim() || !value.prompt.trim()) return null;
    const list = items => Array.isArray(items) ? items.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 20) : [];
    return {
      id: crypto.randomUUID(), title: value.title.trim().slice(0, 60),
      description: typeof value.description === 'string' ? value.description.trim().slice(0, 120) : '',
      prompt: value.prompt.trim().slice(0, 10000), skills: list(value.skills), mcps: list(value.mcps),
      expert: typeof value.expert === 'string' ? value.expert.trim().slice(0, 60) : '',
      resources: list(value.resources),
    };
  }
  const exampleTemplates = [
    { title: '每周经营复盘', description: '汇总指标变化，形成可执行的周度复盘', prompt: '汇总本周经营指标，对比上周和目标，找出关键变化与异常，分析可能原因，并按优先级列出下周行动。', skills: ['数据分析', '文档写作'], mcps: [], expert: '数据分析师', resources: [], example: true },
    { title: '项目资料整理', description: '把零散材料整理成目录和摘要', prompt: '按照项目、日期和文件类型整理资料，识别重复及缺失项，输出清晰的目录与重点内容摘要。', skills: ['文档总结'], mcps: ['文件系统连接器'], expert: '', resources: [], example: true },
    { title: '产品方案评审', description: '用固定检查项快速审阅新方案', prompt: '审阅产品方案，梳理用户场景、关键流程、异常分支、依赖与风险，并列出待确认问题和改进建议。', skills: ['产品分析'], mcps: [], expert: '产品顾问', resources: [], example: true },
  ];
  try {
    const saved = localStorage.getItem(templateStorageKey);
    const stored = saved === null ? exampleTemplates : JSON.parse(saved);
    if (Array.isArray(stored)) templates = stored.map(value => {
      const item = normalizeTemplate(value);
      return item && { ...item, id: typeof value.id === 'string' ? value.id : item.id, example: value.example === true };
    }).filter(Boolean);
    if (saved === null) localStorage.setItem(templateStorageKey, JSON.stringify(templates));
  } catch (_) { /* 存储不可用时仍可在本次会话使用。 */ }

  function templateMessage(text) {
    templateStatus.textContent = text;
    templateStatus.hidden = !text;
  }
  function saveTemplates() {
    try { localStorage.setItem(templateStorageKey, JSON.stringify(templates)); return true; }
    catch (_) { templateMessage('当前环境无法持久保存，模版仅在本次页面会话中可用。'); return false; }
  }
  function renderTemplates() {
    templateList.innerHTML = templates.length ? templates.map(item => {
      const tags = [...item.skills.map(name => `Skill · ${name}`), ...item.mcps.map(name => `MCP · ${name}`),
        ...(item.expert ? [`专家 · ${item.expert}`] : []), ...(item.resources.length ? [`资料 · ${item.resources.length} 项（仅本机）`] : [])];
      return `<article class="template-item" data-template-id="${esc(item.id)}"><div class="template-item-main"><span class="template-item-mark" aria-hidden="true">✳</span><div><h3>${esc(item.title)}${item.example ? '<span class="template-example-tag">示例</span>' : ''}</h3><p>${esc(item.description || item.prompt)}</p><div class="template-tags">${tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div></div></div><div class="template-item-actions"><button type="button" data-template-action="use">使用</button><button type="button" data-template-action="edit">编辑</button><button type="button" data-template-action="duplicate">复制</button><button type="button" data-template-action="share">分享</button><button type="button" class="template-danger" data-template-action="delete">删除</button></div></article>`;
    }).join('') : '<div class="template-empty"><span aria-hidden="true">✳</span><h3>把常用流程变成自己的模版</h3><p>组合 Prompt、Skill、MCP、专家和资料；使用时仍可在输入框里调整。</p><button type="button" class="template-create" data-template-action="new">创建第一个模版</button></div>';
  }
  function showTemplateList() {
    templateForm.hidden = true;
    templateToolbar.hidden = false;
    templateList.hidden = false;
    editingTemplateId = null;
    renderTemplates();
  }
  function editTemplate(item = null) {
    templateMessage('');
    templateForm.reset();
    editingTemplateId = item?.id || null;
    document.getElementById('templateFormTitle').textContent = item ? '编辑模版' : '新建模版';
    if (item) for (const name of ['title', 'description', 'prompt', 'skills', 'mcps', 'expert', 'resources']) {
      templateForm.elements[name].value = Array.isArray(item[name]) ? item[name].join('，') : item[name];
    }
    templateToolbar.hidden = true;
    templateList.hidden = true;
    templateForm.hidden = false;
    templateForm.elements.title.focus();
  }
  document.getElementById('cases').addEventListener('click', event => {
    if (!event.target.closest('#openTemplates')) return;
    templateReturnFocus = event.target.closest('#openTemplates');
    templateMessage('');
    showTemplateList();
    templateDialog.showModal();
  });
  document.getElementById('templateClose').addEventListener('click', () => templateDialog.close());
  templateDialog.addEventListener('click', event => { if (event.target === templateDialog) templateDialog.close(); });
  templateDialog.addEventListener('close', () => {
    if (templateReturnFocus?.isConnected) templateReturnFocus.focus();
    templateReturnFocus = null;
  });
  const splitTemplateField = value => value.split(/[,，\n]/).map(part => part.trim()).filter(Boolean);
  templateForm.addEventListener('submit', event => {
    event.preventDefault();
    const fields = templateForm.elements;
    const item = normalizeTemplate({
      title: fields.title.value, description: fields.description.value, prompt: fields.prompt.value,
      skills: splitTemplateField(fields.skills.value), mcps: splitTemplateField(fields.mcps.value),
      expert: fields.expert.value, resources: splitTemplateField(fields.resources.value),
    });
    if (!item) return;
    if (editingTemplateId) {
      const index = templates.findIndex(value => value.id === editingTemplateId);
      if (index < 0) return;
      templates[index] = { ...item, id: editingTemplateId, example: templates[index].example };
    } else templates.unshift(item);
    templateMessage('模版已保存。');
    saveTemplates();
    showTemplateList();
  });
  templateDialog.addEventListener('click', event => {
    const button = event.target.closest('[data-template-action]');
    if (!button) return;
    const action = button.dataset.templateAction;
    const item = templates.find(value => value.id === button.closest('[data-template-id]')?.dataset.templateId);
    if (action === 'new') editTemplate();
    else if (action === 'back') showTemplateList();
    else if (action === 'import') templateImport.click();
    else if (item && action === 'edit') editTemplate(item);
    else if (item && action === 'duplicate') {
      templates.unshift({ ...item, id: crypto.randomUUID(), example: false, title: `${item.title}（副本）`.slice(0, 60), skills: [...item.skills], mcps: [...item.mcps], resources: [...item.resources] });
      saveTemplates(); renderTemplates(); templateMessage('已复制模版。');
    } else if (item && action === 'delete') {
      if (!window.confirm(`删除模版「${item.title}」？此操作不能撤销。`)) return;
      templates = templates.filter(value => value.id !== item.id);
      saveTemplates(); renderTemplates(); templateMessage('模版已删除。');
    } else if (item && action === 'use') {
      const references = [...item.skills.map(name => `@技能:${name}`), ...item.mcps.map(name => `@MCP:${name}`),
        ...(item.expert ? [`@专家:${item.expert}`] : []), ...item.resources.map(name => `@${name}`)];
      prompt.value = `${item.prompt}${references.length ? `\n\n${references.join(' ')}` : ''}`;
      setPromptGuide('');
      autoResize(); refreshSendState();
      templateDialog.close();
      requestAnimationFrame(() => { prompt.focus(); prompt.setSelectionRange(prompt.value.length, prompt.value.length); });
    } else if (item && action === 'share') {
      if (!window.confirm('将导出 Prompt、Skill、MCP 和专家名称；资料引用不会导出。请确认 Prompt 本身不包含敏感内容。继续？')) return;
      const { title, description, prompt: instruction, skills, mcps, expert } = item;
      const payload = { format: 'catpaw-template', version: 1, template: { title, description, prompt: instruction, skills, mcps, expert } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[\\/:*?"<>|]/g, '-')}-模版.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      templateMessage('分享文件已导出；本机资料引用未包含在内。');
    }
  });
  templateImport.addEventListener('change', async () => {
    const file = templateImport.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('文件过大');
      const payload = JSON.parse(await file.text());
      if (payload.format !== 'catpaw-template' || payload.version !== 1) throw new Error('格式不匹配');
      const imported = normalizeTemplate(payload.template);
      if (!imported) throw new Error('缺少模版名称或 Prompt');
      imported.resources = [];
      templates.unshift(imported);
      saveTemplates(); renderTemplates(); templateMessage(`已导入「${imported.title}」，可先编辑再使用。`);
    } catch (error) { templateMessage(`导入失败：${error.message}`); }
    templateImport.value = '';
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
