/* ============================================================
   CatPaw Desktop — 交互
   ============================================================ */
(function () {
  'use strict';
  let artifactSelection;
  const strategyScene = new URLSearchParams(window.location.search).get('strategyScene');
  let strategyDemoActive = false;

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
    collapseBtn.title = collapsed ? '展开侧边栏' : '折叠侧边栏';
    collapseBtn.setAttribute('aria-label', collapseBtn.title);
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

  collapseBtn.addEventListener('click', () => setCollapsed(!win.classList.contains('collapsed')));
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
  const looseTasks = Array.from(looseTasksEl.children).filter((item) => item.matches('.task'));
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
  const folderStorageEmpty = document.getElementById('folderStorageEmpty');
const folderStoragePicker = document.getElementById('folderStoragePicker');
const folderStorageBtn = document.getElementById('folderStorageBtn');
const folderStorageLabel = document.getElementById('folderStorageLabel');
const folderStorageMenu = document.getElementById('folderStorageMenu');
const folderStorageOptions = Array.from(folderStorageMenu.querySelectorAll('[data-folder-storage]'));
let folderStorage = 'cloud';

function setFolderStorageOpen(open) {
folderStorageMenu.hidden = !open;
folderStorageBtn.setAttribute('aria-expanded', String(open));
}

function syncFolderStorage() {
folderStorageLabel.textContent = folderStorage === 'local' ? '本地' : '云端';
folderStorageBtn.setAttribute('aria-label', `文件夹位置：${folderStorageLabel.textContent}`);
folderStorageOptions.forEach((button) => button.setAttribute('aria-checked', String(button.dataset.folderStorage === folderStorage)));
folderGroupsEl.classList.toggle('storage-hidden', folderStorage === 'local');
folderStorageEmpty.hidden = folderStorage !== 'local' || toggleFoldersSection.getAttribute('aria-expanded') !== 'true';
requestAnimationFrame(refreshClipped);
}
folderStorageBtn.addEventListener('click', (event) => {
event.stopPropagation();
const opening = folderStorageMenu.hidden;
setFolderOpen(false);
setBranchOpen(false);
closeAccessMenus();
setFolderStorageOpen(opening);
});
folderStorageMenu.addEventListener('click', (event) => {
const option = event.target.closest('[data-folder-storage]');
if (!option) return;
folderStorage = option.dataset.folderStorage;
syncFolderStorage();
setFolderStorageOpen(false);
folderStorageBtn.focus();
});
document.addEventListener('click', (event) => {
if (!folderStoragePicker.contains(event.target)) setFolderStorageOpen(false);
});
document.addEventListener('keydown', (event) => {
if (event.key !== 'Escape' || folderStorageMenu.hidden) return;
setFolderStorageOpen(false);
folderStorageBtn.focus();
});

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
    syncFolderStorage();
  });
  syncFolderStorage();

  let tasksExpanded = false;   // 任务区是否已展开全部

  /* 所有原场景任务按 DOM 顺序进入同一列表，超出上限的部分统一折叠。 */
  function renderTasks() {
    looseTasks.forEach((task, index) => {
      task.hidden = !tasksExpanded && index >= TASK_LIMIT;
    });

    const shown = looseTasks.length;
    const overflow = Math.max(0, shown - TASK_LIMIT);
    expandTasksBtn.hidden = overflow === 0;
    // 标题展示任务总数，子 Agent 只在对应对话中展示。
    labelTasks.textContent = `置顶 (${shown})`;
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
        ...window.ArtifactEditingDemo.files(),
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
  const workbenchLandingRecentList = document.getElementById('workbenchLandingRecentList');
const MAX_RECENT_FILES = 12;

  /* 最近文件记录供右文件面板和添加文件菜单使用。 */
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
renderWorkbenchLandingRecents();
  }

  function renderWorkbenchLandingRecents() {
    const entries = recentOpenedFiles.slice(0, 8);
    workbenchLandingRecentList.innerHTML = entries.length ? entries.map((entry, index) =>
      `<button class="workbench-landing-file" type="button" data-landing-recent="${index}" title="${esc(entry.node.name)}">` +
      `<span class="workbench-landing-file-icon">${summaryArtifactIcon(artifactType(entry.node))}</span>` +
      `<span class="workbench-landing-file-name">${esc(entry.node.name)}</span></button>`
    ).join('') : '<p class="workbench-landing-empty">还没有打开过文件</p>';
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

function summaryArtifactIcon(type) {
const icon = { word: 'doc', png: 'image' }[type] || type || 'doc';
return `<img src="assets/artifact-${icon}.svg" alt="" aria-hidden="true">`;
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
fileGrid.innerHTML = files
.map(({ f, i }) => {
const type = artifactType(f);
const thumb = summaryArtifactIcon(type);
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
        ${section.paragraphs.map((text, paragraphIndex) => `<p contenteditable="${preview.referenceDemo ? 'false' : 'true'}" ${preview.referenceDemo ? '' : 'role="textbox" aria-multiline="true"'}
          aria-label="${esc(section.heading)}第 ${paragraphIndex + 1} 段" data-word-section="${sectionIndex}" data-word-paragraph="${paragraphIndex}" spellcheck="false">${esc(text)}</p>`).join('')}
      </section>`).join('');
    return `<div class="pv-office pv-word" aria-label="文档演示预览">
      <div class="office-toolbar">${preview.referenceDemo ? '<span>划选文字后，添加到对话提出修改要求</span>' : '<span>开始</span><span>插入</span><span>布局</span><span>审阅</span>'}<span class="office-status" aria-live="polite">${item.officeEdited ? '已编辑 · 当前会话' : '已保存'}</span></div>
      <div class="word-layout"><nav class="word-outline" aria-label="文档大纲"><strong>大纲</strong>${preview.sections.map((section, index) => `<button type="button" data-word-jump="${index}">${esc(section.heading)}</button>`).join('')}</nav>
        <div class="word-canvas"><article class="word-page" style="--office-zoom:${zoom / 100}"><h1>${esc(preview.title)}</h1><div class="word-subtitle">${esc(preview.subtitle || '上海虹桥店 · 2026 年 9 月 21 日')}</div><hr>${sections}<footer>由 CatPaw 生成 · 演示文档</footer></article></div></div>
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
      <div class="office-toolbar">${preview.referenceDemo ? '<span>拖动选择单元格区域，添加到对话</span>' : '<span>开始</span><span>插入</span><span>数据</span><span>公式</span>'}<span class="office-status" aria-live="polite">${item.officeEdited ? '已编辑 · 当前会话' : '已保存'}</span></div>
      <div class="excel-actions"><label>查找 <input type="search" data-excel-filter placeholder="筛选当前工作表" value="${esc(item.officeFilter || '').replace(/"/g, '&quot;')}"></label>${preview.referenceDemo ? '' : '<button type="button" data-excel-add>＋ 添加一行</button>'}<span>${rows.length} / ${sheet.rows.length} 行</span></div>
      <div class="excel-formula"><span data-excel-address>选择单元格</span><span class="excel-fx">ƒx</span><output data-excel-value>选中单元格后显示内容</output></div>
      <div class="excel-scroll"><table class="excel-grid"><thead><tr><th class="excel-corner"></th>${letters.map(letter => `<th>${letter}</th>`).join('')}</tr><tr><th class="excel-row-number">${preview.referenceDemo ? '1' : '#'}</th>${sheet.columns.map(name => `<th class="excel-column-name">${esc(name)}</th>`).join('')}</tr></thead><tbody>${rows.map(({ row, rowIndex }) => `<tr><th class="excel-row-number">${rowIndex + (preview.referenceDemo ? 2 : 1)}</th>${row.map((_, columnIndex) => `<td tabindex="0" data-excel-row="${rowIndex}" data-excel-column="${columnIndex}" data-excel-address="${letters[columnIndex]}${rowIndex + (preview.referenceDemo ? 2 : 1)}" title="${preview.referenceDemo ? '选择后添加到对话' : columnIndex === 5 && sheet.name === '异常明细' ? '根据超时单 ÷ 订单量自动计算' : '双击编辑'}">${esc(spreadsheetCell(sheet, rowIndex, columnIndex))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="excel-tabs" role="tablist" aria-label="工作表">${preview.sheets.map((entry, index) => `<button type="button" role="tab" data-excel-sheet="${index}" aria-selected="${index === sheetIndex}" class="${index === sheetIndex ? 'active' : ''}">${esc(entry.name)}</button>`).join('')}</div>
      <div class="office-footer"><span>工作表 ${sheetIndex + 1} / ${preview.sheets.length}</span><span>${sheet.name === '异常明细' ? '超时率按订单量自动计算 · ' : ''}更改仅保存在当前会话</span></div>
    </div>`;
  }

  const PREVIEWS = {
    word: (preview, item) => renderWordPreview(preview, item),
    excel: (preview, item) => renderExcelPreview(preview, item),
    /* PPT：参考桌面演示文稿编辑器，直接展示可辨认的编辑态，而不是文件占位。 */
    ppt: (preview,item) => preview.referenceDemo ? window.ArtifactEditingDemo.renderPpt(preview,item) : `<div class="pv-ppt" aria-label="季度经营复盘演示文稿预览">
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
const scheduled = hasActiveTask && scheduledRunTasks.has(activeConversationTask);
document.getElementById('scheduledSummary').hidden = !scheduled;
document.getElementById('standardSummary').hidden = false;
if (scheduled) {
  renderScheduledRunList();
}
document.getElementById('summaryArtifactsTitle').textContent = scheduled ? '本次运行产物' : '当前任务产物';
const folder = currentNode();
if (!hasActiveTask) fileGrid.innerHTML = '<p class="summary-empty">无</p>';
else if (scheduled) renderFileGrid({ files: conversationExamples.get(activeConversationTask)?.fileNodes || [] });
else if (folder) renderFileGrid(folder);
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
    setFolderStorageOpen(false);
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
    setFolderStorageOpen(false);
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

  const sidebarSearchButton = document.getElementById('searchSidebar');
  const sidebarSearchPanel = document.getElementById('sidebarSearchPanel');
  const sidebarSearchInput = document.getElementById('sidebarSearchInput');
  const sidebarSearchResults = document.getElementById('sidebarSearchResults');

  function closeSidebarSearch(restoreFocus = false) {
    if (sidebarSearchPanel.hidden) return;
    sidebarSearchPanel.hidden = true;
    sidebarSearchButton.setAttribute('aria-expanded', 'false');
    sidebarSearchInput.value = '';
    sidebarSearchResults.replaceChildren();
    if (restoreFocus) sidebarSearchButton.focus();
  }

  function renderSidebarSearch() {
    const query = sidebarSearchInput.value.trim().toLocaleLowerCase();
    sidebarSearchResults.replaceChildren();
    if (!query) return;
    const matches = [...document.querySelectorAll('#looseTasks .task, #folderGroups .group, #folderGroups .group .task')]
      .filter((item) => {
        const name = item.matches('.group') ? item.querySelector('.group-name') : item.querySelector('.task-name');
        return name?.textContent.toLocaleLowerCase().includes(query);
      });
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.textContent = '没有找到匹配的任务或文件夹';
      sidebarSearchResults.append(empty);
      return;
    }
    matches.forEach((item) => {
      const isFolder = item.matches('.group');
      const button = document.createElement('button');
      const name = document.createElement('span');
      const category = document.createElement('small');
      button.type = 'button';
      name.textContent = item.querySelector(isFolder ? '.group-name' : '.task-name').textContent.trim();
      category.textContent = isFolder ? '文件夹' : item.dataset.taskType === 'scheduled' ? '定时任务' : '任务';
      button.append(name, category);
      button.addEventListener('click', () => {
        if (item.closest('#looseTasks')) {
          if (item.hidden) {
            tasksExpanded = true;
            renderTasks();
          }
          if (looseTasksEl.classList.contains('folded')) toggleTasksSection.click();
        } else {
          if (folderStorage === 'local') {
            folderStorage = 'cloud';
            syncFolderStorage();
          }
          if (folderGroupsEl.hidden) toggleFoldersSection.click();
          if (folderLayout === 'time' || (!isFolder && !showAllFolderTasks)) {
            folderLayout = 'project';
            if (!isFolder) showAllFolderTasks = true;
            applyFolderSort();
          }
          const group = isFolder ? item : item.closest('.group');
          if (!isFolder && group.classList.contains('folded')) group.querySelector('[data-toggle-group]').click();
          if (item.closest('.more-wrap.hidden')) item.closest('.group-body').querySelector('[data-expand]')?.click();
        }
        closeSidebarSearch();
        requestAnimationFrame(() => {
          item.scrollIntoView({ block: 'nearest' });
          (isFolder ? item.querySelector('[data-toggle-group]') : item).focus();
          refreshClipped();
        });
      });
      sidebarSearchResults.append(button);
    });
  }

  sidebarSearchButton.addEventListener('click', () => {
    if (!sidebarSearchPanel.hidden) {
      closeSidebarSearch(true);
      return;
    }
    sidebarSearchPanel.hidden = false;
    sidebarSearchButton.setAttribute('aria-expanded', 'true');
    renderSidebarSearch();
    sidebarSearchInput.focus();
  });
  sidebarSearchInput.addEventListener('input', renderSidebarSearch);
  document.addEventListener('click', (event) => {
    if (!sidebarSearchPanel.contains(event.target) && !sidebarSearchButton.contains(event.target)) closeSidebarSearch();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sidebarSearchPanel.hidden) {
      event.preventDefault();
      closeSidebarSearch(true);
    }
  });

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
      task.style.order = folderLayout === 'time'
        ? String(folderOrder === 'created'
          ? -taskIndex++
          : minutes === null ? 100000 + taskIndex++ : minutes)
        : '';
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

  function attachTaskActions(task) {
    const acts = document.createElement('span');
    acts.className = 'row-acts';
    acts.innerHTML = makeAct('task-more', '更多', DOTS_SVG);
    task.appendChild(acts);
  }
  document.querySelectorAll('.task').forEach(attachTaskActions);

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

     普通任务沿用通用菜单，定时任务使用专属菜单；左侧只建一个菜单实例，
     menuRow 记录当前作用的任务。 */
  const TASK_MENU = [
    { act: 'pin', label: '置顶',
      svg: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' },
    { act: 'rename', label: '重命名',
      svg: '<path d="M5 21h14M6 14l9.5-9.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>' },
    { act: 'copy-directory', label: '复制工作目录', divider: true,
      svg: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>' },
    { act: 'copy-id', label: '复制会话 ID',
      svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
    { act: 'delete', label: '删除', divider: true, danger: true,
      svg: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' },
  ];
  const SCHEDULED_TASK_MENU = [
    TASK_MENU[0],
    { act: 'edit-scheduled', label: '编辑定时任务', svg: TASK_MENU[1].svg },
    TASK_MENU[4],
  ];
  const taskHomes = new WeakMap();
  const taskIds = new WeakMap();
  let nextTaskId = 1;
  document.querySelectorAll('.task').forEach((task) => {
    if (!taskHomes.has(task)) taskHomes.set(task, { parent: task.parentElement, next: task.nextSibling });
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

    rowMenu.innerHTML = renderTaskMenu(row.dataset.taskType === 'scheduled' ? SCHEDULED_TASK_MENU : TASK_MENU, 'data-menu-act');
    rowMenu.querySelector('[data-menu-act="pin"] span').textContent = row.dataset.pinned === 'true' ? '取消置顶' : '置顶';
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
        setFolderStorageOpen(false);
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

const safeHouseCard = document.getElementById('composerCard');
const safeHouseSweep = safeHouseCard.querySelector('.safe-house-sweep');
const safeHouseSweepPath = safeHouseSweep.querySelector('path');
// 将 540px 的扫光分成短弧段，使透明度渐变能跟着圆角一起转弯。
const safeHouseSweepSegments = Array.from({ length: 45 }, (_, index) => {
  const segment = index ? safeHouseSweepPath.cloneNode() : safeHouseSweepPath;
  segment.style.setProperty('--safe-house-sweep-segment-length', index === 44 ? '12px' : '12.75px');
  segment.style.setProperty('--safe-house-sweep-segment-position', `${index * 12}px`);
  segment.style.opacity = String(Math.sin(Math.PI * index / 44) ** 1.4);
  if (index) safeHouseSweep.append(segment);
  return segment;
});
function syncSafeHouseSweepPath() {
const { width, height } = safeHouseSweep.getBoundingClientRect();
if (!width || !height) return;
const radius = Math.min(parseFloat(getComputedStyle(safeHouseCard).borderTopLeftRadius) || 0, width / 2 - 1, height / 2 - 1);
const arcRadius = Math.max(0, radius - 1);
const x = width - 1;
const y = height - radius;
// 从白卡左下圆角与绿色工具条左边缘相接处起步，尺寸变化时保持对齐。
const cardRect = safeHouseCard.getBoundingClientRect();
const footRect = homeComposerFoot.getBoundingClientRect();
const arcStartX = Math.max(1, Math.min(radius, footRect.left - cardRect.left));
const arcStartY = y + Math.sqrt(Math.max(0, arcRadius ** 2 - (radius - arcStartX) ** 2));
// 右下圆角与工具条右边缘相接处，与左侧起点对称。
const arcEndX = Math.max(width - radius, Math.min(x, footRect.right - cardRect.left));
const arcEndY = y + Math.sqrt(Math.max(0, arcRadius ** 2 - (arcEndX - (width - radius)) ** 2));
safeHouseSweep.setAttribute('viewBox', `0 0 ${width} ${height}`);
const path = `M ${arcStartX} ${arcStartY} A ${arcRadius} ${arcRadius} 0 0 1 1 ${y} V ${radius} A ${arcRadius} ${arcRadius} 0 0 1 ${radius} 1 H ${width - radius} A ${arcRadius} ${arcRadius} 0 0 1 ${x} ${radius} V ${y} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEndX} ${arcEndY}`;
safeHouseSweepSegments.forEach(segment => segment.setAttribute('d', path));
safeHouseSweep.style.setProperty('--safe-house-sweep-distance', `${safeHouseSweepPath.getTotalLength()}px`);
}
new ResizeObserver(syncSafeHouseSweepPath).observe(safeHouseCard);

function toggleSafeHouse() {
const active = safeHouseToggle.getAttribute('aria-pressed') !== 'true';
if (active) syncSafeHouseSweepPath();
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
  const homeGoalTag = document.getElementById('homeGoalTag');
  const hero = document.querySelector('.hero');
  const greeting = document.getElementById('homeGreeting');
  const promptHint = document.getElementById('promptHint');
  const hintExamples = ['帮我做一份报告…', '帮我做一个演示文稿…', '帮我整理表格数据…', '帮我搭建一个网站…'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hintIndex = 0;
  let hintInterval = null;
  let hintTransition = null;
  let promptGuide = '';
  const greetingTitle = greeting.querySelector('.greeting-title');
  const greetingBubble = greeting.querySelector('.greeting-bubble');
  // 正常布局最窄文字区约 261px；22px 字号、-0.5px 字距下，12 个全角字约 258.5px。
  // 问候文案连同标点最多 12 字，保留原字号与固定中心，不做动态缩放。
  const greetingMessages = {
    develop: ['想做网站还是应用？', '有什么想做出来的小想法？', '准备给谁使用？', '想解决什么问题？'],
    analyze: ['想从数据里发现什么？', '有哪个指标让你在意？', '数据里最关心什么？', '看整体，还是找原因？'],
    create: ['海报、PPT 还是文案？', '这次想做一份什么作品？', '有主题或参考吗？', '想把什么想法表达出来？'],
    research: ['有什么想了解的？', '查资料，还是解答问题？', '说说你的问题吧。', '有什么需要弄明白的？'],
    apps: ['想做什么样的 App？', '这个应用准备给谁用？', '最想要什么功能？', '想让应用帮你做什么？'],
    websites: ['想拥有一个怎样的网站？', '这个网站准备展示什么？', '有喜欢的网站风格吗？', '网站主要用来做什么？'],
    slides: ['这份汇报想讲什么？', '这次汇报的重点是什么？', '先说说主题也可以。', '这份汇报准备给谁听？'],
  };
  const defaultGreetingMessages = [
    '今天想做点什么？',
    '说说今天想完成的事吧。',
    '有什么想法？我在听。',
    '从一个小想法开始也可以。',
    '有什么工作想一起理理？',
    '先说个大致方向吧。',
    '有什么事卡住了吗？',
    '把手头的事说给我听听吧。',
  ];
  const lastGreetingByContext = new Map();
  let selectedPromptGreeting = null;
  let currentGreetingMessage = '';
  let currentGreetingContext = '';
  function stopGreetingTyping() {
    greetingBubble.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
  }

  function showGreetingBubble(category = selectedPromptCategory) {
    const context = selectedPromptGreeting ? `prompt:${selectedPromptGreeting}` : greetingMessages[category] ? category : 'default';
    // 同一次聚焦期间保持稳定；重新进入时再抽取，并避开上一次的问候。
    if (!greetingBubble.hidden && currentGreetingMessage && context === currentGreetingContext) return;
    const messages = selectedPromptGreeting ? [selectedPromptGreeting] : greetingMessages[category] || defaultGreetingMessages;
    const alternatives = messages.filter(message => message !== lastGreetingByContext.get(context));
    const candidates = alternatives.length ? alternatives : messages;
    const message = candidates[Math.floor(Math.random() * candidates.length)];
    lastGreetingByContext.set(context, message);
    currentGreetingContext = context;
    hero.classList.add('is-engaged');
    greetingTitle.hidden = true;
    greetingBubble.hidden = false;
    if (message === currentGreetingMessage) return;
    currentGreetingMessage = message;
    greetingBubble.setAttribute('aria-label', message);
    if (reducedMotion.matches) {
      greetingBubble.textContent = message;
      return;
    }
    const segmenter = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
      : null;
    const characters = segmenter
      ? Array.from(segmenter.segment(message), ({ segment }) => segment)
      : Array.from(message);
    // 长句也在接近同一时间内写完，避免逐字动画拖成明显的等待。
    const characterInterval = Math.min(52, 560 / Math.max(1, characters.length - 1));
    const fragment = document.createDocumentFragment();
    characters.forEach((character, index) => {
      const span = document.createElement('span');
      span.className = 'greeting-ink-char';
      span.textContent = character;
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--ink-delay', `${Math.round(index * characterInterval)}ms`);
      fragment.appendChild(span);
    });
    greetingBubble.replaceChildren(fragment);
  }

  function stopPromptHint() {
    clearInterval(hintInterval);
    clearTimeout(hintTransition);
    hintInterval = null;
    promptHint.classList.remove('is-changing');
    hero.classList.remove('is-awaiting-input');
  }

  function startPromptHint() {
    if (hero.classList.contains('is-engaged') || prompt.value) return;
    hero.classList.add('is-awaiting-input');
    if (hintInterval || reducedMotion.matches) return;
    hintInterval = setInterval(() => {
      if (document.hidden) return;
      promptHint.classList.add('is-changing');
      hintTransition = setTimeout(() => {
        hintIndex = (hintIndex + 1) % hintExamples.length;
        promptHint.textContent = hintExamples[hintIndex];
        promptHint.classList.remove('is-changing');
      }, 220);
    }, 3400);
  }

  prompt.addEventListener('focus', () => {
    stopPromptHint();
    showGreetingBubble();
  });
  function restoreHomeGreeting() {
    if (selectedPromptCategory || !hero.classList.contains('is-engaged')) return;
    stopGreetingTyping();
    currentGreetingMessage = '';
    hero.classList.remove('is-engaged');
    greetingTitle.hidden = false;
    greetingBubble.hidden = true;
    greetingBubble.textContent = '';
    if (document.activeElement === prompt) prompt.blur();
    startPromptHint();
  }
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.composer')) restoreHomeGreeting();
  });
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('.composer')) restoreHomeGreeting();
  });
  reducedMotion.addEventListener('change', () => {
    stopPromptHint();
    startPromptHint();
    if (reducedMotion.matches && !greetingBubble.hidden) {
      stopGreetingTyping();
      greetingBubble.textContent = currentGreetingMessage;
    }
  });
  startPromptHint();

  function autoResize() {
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 200) + 'px';
  }

  function refreshSendState() {
    sendBtn.disabled = prompt.value.trim().length === 0 && (homeGoalTag.hidden ? !promptGuide && !selectedLibraryFiles?.get(prompt)?.length && !selectedSkills?.get(prompt)?.length : true);
  }

function setPromptGuide(text = '', label = text, iconMarkup = '') {
if (text && !homeGoalTag.hidden) setGoalMode(prompt, false);
promptGuide = text;
    promptChipText.textContent = label;
    promptChipSourceIcon.innerHTML = iconMarkup;
    promptChip.hidden = !text || !homeGoalTag.hidden;
    syncComposerTags(prompt);
    autoResize();
    refreshSendState();
  }

  prompt.addEventListener('input', () => {
    stopPromptHint();
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
    if (!text && (!promptGuide || !homeGoalTag.hidden) && !selectedLibraryFiles.get(prompt).length && !selectedSkills.get(prompt).length) return;
    if (!homeGoalTag.hidden) {
      if (!text) return;
      updateGoal(prompt, text);
      setGoalMode(prompt, false);
    }
    const skillReferences = selectedSkills.get(prompt).map(name => `skill:${name}`).join(' ');
    console.log('[CatPaw] 提交需求：', [promptGuide + text, skillReferences].filter(Boolean).join(' '), selectedLibraryFiles.get(prompt).map(entry => entry.node.name));
    prompt.value = '';
    clearSkillTags(prompt);
    clearLibraryFileCards(prompt);
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
  const primaryPromptButtons = Array.from(primaryPrompts.querySelectorAll('[data-prompt-category]'));
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
  let heroLayoutAnimation = null;
  let heroChildAnimations = [];

  function animateHeroReflow(update) {
    // The centered hero changes height when prompt suggestions replace the cards.
    // Track its children too: on narrow layouts the greeting itself grows.
    const movingChildren = [greeting, hero.querySelector('.composer'), document.getElementById('promptRecommendations')];
    const previousTop = hero.getBoundingClientRect().top;
    const previousChildOffsets = movingChildren.map(child => child.getBoundingClientRect().top - previousTop);
    heroLayoutAnimation?.cancel();
    heroChildAnimations.forEach(animation => animation.cancel());
    heroChildAnimations = [];
    update();
    if (reducedMotion.matches || strategyScene) return;
    const nextTop = hero.getBoundingClientRect().top;
    const nextChildOffsets = movingChildren.map(child => child.getBoundingClientRect().top - nextTop);
    const timing = { duration: 360, easing: 'cubic-bezier(.22,.68,0,1)' };
    const offset = previousTop - nextTop;
    if (Math.abs(offset) >= 1) {
      const restingTransform = getComputedStyle(hero).transform;
      heroLayoutAnimation = hero.animate([
        { transform: `translateY(${offset}px) ${restingTransform === 'none' ? '' : restingTransform}` },
        { transform: restingTransform },
      ], timing);
    }
    movingChildren.forEach((child, index) => {
      const childOffset = previousChildOffsets[index] - nextChildOffsets[index];
      if (Math.abs(childOffset) < 1) return;
      const restingTransform = getComputedStyle(child).transform;
      heroChildAnimations.push(child.animate([
        { transform: `translateY(${childOffset}px) ${restingTransform === 'none' ? '' : restingTransform}` },
        { transform: restingTransform },
      ], timing));
    });
  }

  function promptCategoryData() {
    const pptScenarios = [
      { label: '财报解读', title: '泡泡玛特业绩分析', theme: 'finance', greeting: '财报里的信息有点多？', prompt: '解读泡泡玛特财报，制作一份业绩分析 PPT，数据图表为主、克制专业风。' },
      { label: '工作总结', title: '季度工作总结汇报', theme: 'summary', greeting: '这个季度辛苦啦。', prompt: '季度工作总结汇报 PPT，简约商务风，含业绩回顾、亮点、不足、下季计划。' },
      { label: '新品发布会', title: '新产品发布会演示', theme: 'launch', greeting: '新品有哪些亮点？', prompt: '新产品发布会演示 PPT，科技感暗调，含痛点、产品亮点、演示、发售信息。' },
      { label: '培训课件', title: '新员工入职培训', theme: 'onboarding', greeting: '给新人准备份指南吧。', prompt: '新员工入职培训课件 PPT，清爽分模块、多图示少文字，含文化、制度、流程。' },
    ];
    const websiteScenarios = [
      { label: '企业网站首页', theme: 'corporate', greeting: '想展示企业的哪些优势？', prompt: '创建一个企业网站，风格要大气、商务、专业。设计一个完整的企业网站首页，包括导航栏、hero 区域、服务介绍、公司优势、客户评价等部分。' },
      { label: '电商网页', theme: 'shop', greeting: '复古波普风很有趣呀。', prompt: '设计一个复古波普艺术风格的电商网页，背景使用鲜艳的橙色和粉色撞色，融入漫画风格的圆点图案和手绘插图。商品展示区以波普画框形式呈现，按钮带有手写字体和跳跃动画。整体风格活泼有趣，适合潮流服饰或艺术品销售。' },
      { label: '电商运营后台', theme: 'commerce', greeting: '日常运营有哪些忙碌的事？', prompt: '设计一个现代化电商运营后台，背景为纯白，顶部导航使用渐变主题色（#4F46E5 → #2563EB）。订单处理采用卡片流设计，商品管理支持拖拽排序。数据分析区使用动态仪表盘，支持多维度筛选。整体风格简洁高效。' },
      { label: '话题社区', theme: 'community', greeting: '想让大家在这里聊些什么？', prompt: '参考微博的能力和布局生成一个暗黑色调的话题社区。' },
    ];
    const appScenarios = [
      { label: '健身打卡', theme: 'fitness', greeting: '做个健身打卡应用吧。', prompt: '设计并开发一个健身打卡 App，动感高对比配色，含训练计划、打卡日历、数据统计、成就徽章。' },
      { label: '国风阅读', theme: 'reading', greeting: '国风阅读很有韵味呀。', prompt: '设计并开发一个国风阅读 App，宣纸米底 + 水墨留白，含书架、翻页阅读器、书签笔记、书城推荐。' },
      { label: '露营装备租赁', theme: 'camping', greeting: '让露营准备更轻松吧。', prompt: '设计并开发一个露营装备租赁 App，户外大地色系，含装备浏览、租赁下单、取还日期、订单管理。' },
      { label: '宠物健康管理', theme: 'petcare', greeting: '毛孩子值得细心照顾呀。', prompt: '设计并开发一款宠物健康管理 App，温馨圆润的暖橙色系，含宠物档案、疫苗/驱虫提醒、健康日记、附近宠物服务。' },
    ];
    return {
      develop: {
        guide: '帮我做一个网站或应用：',
        tag: '网站和应用',
        secondary: [
          { label: '搭建网站', greeting: '聊聊你想做的网站吧。', prompt: '帮我搭建一个 [网站类型]，面向 [目标用户]，包含 [页面和核心功能]，风格为 [视觉风格]。' },
          { label: '制作网页应用', greeting: '有什么想变轻松的事？', prompt: '帮我做一个 [网页应用类型]，用于 [目标场景]，需要 [核心功能]。请先梳理方案，再完成可运行版本。' },
          { label: '开发手机应用', greeting: '想做什么样的应用？', prompt: '帮我设计并开发一个 [手机应用类型]，面向 [目标用户]，需要 [核心功能与页面]。' },
          { label: '优化现有网站或应用', greeting: '哪里用着不太顺心？', prompt: '检查 [网站或应用]，找出最影响体验或性能的问题，按优先级优化并验证。' },
        ],
        cases: [
          { kind: 'web', type: '网站开发', title: websiteScenarios[0].label, theme: websiteScenarios[0].theme, prompt: websiteScenarios[0].prompt },
          { kind: 'web', type: '网站开发', title: websiteScenarios[1].label, theme: websiteScenarios[1].theme, prompt: websiteScenarios[1].prompt },
          { kind: 'app', type: 'App 开发', title: appScenarios[0].label, theme: appScenarios[0].theme, prompt: appScenarios[0].prompt },
          { kind: 'app', type: 'App 开发', title: appScenarios[1].label, theme: appScenarios[1].theme, prompt: appScenarios[1].prompt },
        ],
      },
      analyze: {
        guide: '帮我分析数据：',
        tag: '分析数据',
        secondary: [
          { label: '找出指标变化原因', greeting: '有哪个指标让你在意？', prompt: '分析 [时间范围] 的 [核心指标] 为什么变化，对比相关维度，区分事实与推测，并给出可执行建议。' },
          { label: '做经营日报或周报', greeting: '日报还是周报？', prompt: '根据 [数据或报表] 生成一份 [日报或周报]，总结关键指标、异常变化、原因和下一步建议。' },
          { label: '整理并分析表格', greeting: '表格再多也可以慢慢理。', prompt: '整理我提供的表格，核对数据口径，分析 [关注的问题]，用清晰的表格和结论呈现。' },
          { label: '分析市场和竞品', greeting: '想了解哪个市场和竞品？', prompt: '调研 [行业或商圈] 的市场与竞品，标注信息来源，梳理趋势、机会和应对动作。' },
        ],
        cases: [caseData().office[0], caseData().office[1], caseData().office[3], caseData().dev[2]],
      },
      create: {
        guide: '帮我设计或创作：',
        tag: '设计与创作',
        secondary: [
          { label: '设计海报与图片', greeting: '有什么喜欢的主题和风格？', prompt: '为 [产品或活动] 设计一张海报，突出 [核心信息]，面向 [目标人群]，风格为 [视觉风格]。' },
          { label: '制作汇报 PPT', greeting: '一起把这次汇报准备好吧。', prompt: '根据 [主题或材料] 制作一份面向 [受众] 的 PPT，重点呈现 [关键信息]，做到结构清晰、图表易读。' },
          { label: '写活动文案', greeting: '想让大家记住什么？', prompt: '围绕 [活动或产品] 写 [渠道] 的推广文案，包含标题、卖点、正文和明确的行动引导。' },
          { label: '设计品牌视觉', greeting: '希望品牌给人什么感觉？', prompt: '为 [品牌或产品] 设计视觉方案，说明配色、字体、图形风格和适用场景。' },
        ],
        cases: [
          caseData().design[0],
          caseData().design[3],
          { kind: 'deck', type: 'PPT 制作', title: pptScenarios[1].title, theme: pptScenarios[1].theme, prompt: pptScenarios[1].prompt },
          caseData().design[1],
        ],
      },
      research: {
        guide: '帮我查找或解答：',
        tag: '查找与解答',
        secondary: [
          { label: '查资料并标来源', greeting: '想查些什么资料？', prompt: '查找 [主题] 的可靠资料，优先使用官方或一手来源，整理关键结论并附上来源链接。' },
          { label: '解答业务问题', greeting: '有什么还没想明白的？', prompt: '解释 [业务概念或问题]，结合我的场景给出易理解的说明和下一步建议。' },
          { label: '对比不同方案', greeting: '几个方案有点难选？', prompt: '对比 [方案 A] 和 [方案 B] 在成本、适用场景和风险上的差异，给出推荐及依据。' },
          { label: '读文档提炼重点', greeting: '文档太长没空细看？', prompt: '阅读我提供的 [文档或链接]，提炼要点、待确认事项和可执行的下一步。' },
        ],
        cases: [caseData().office[1], caseData().office[3], caseData().dev[3], caseData().design[1]],
      },
      apps: {
        guide: '帮我设计并开发 App：',
        tag: 'App 设计与开发',
        secondary: appScenarios,
        cases: appScenarios.map(({ label, theme, prompt }) => ({ kind: 'app', type: 'App 设计与开发', title: label, theme, prompt })),
      },
      websites: {
        guide: '帮我开发网站：',
        tag: '网站开发',
        secondary: websiteScenarios,
        cases: websiteScenarios.map(({ label, theme, prompt }) => ({ kind: 'web', type: '网站开发', title: label, theme, prompt })),
      },
      slides: {
        guide: '帮我制作 PPT：',
        tag: 'PPT 制作',
        secondary: pptScenarios,
        cases: pptScenarios.map(({ title, theme, prompt }) => ({ kind: 'deck', type: 'PPT 制作', title, theme, prompt })),
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
    secondaryPrompts.innerHTML = data.secondary.map((item, index) =>
      `<button class="secondary-prompt" type="button" data-secondary-index="${index}"` +
      ` style="animation-delay:${index * 55}ms">${esc(typeof item === 'string' ? item : item.label)}</button>`
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

  function setPromptCategory(category, focusPrompt = true) {
    clearTimeout(promptTransitionTimer);
    const isClearing = selectedPromptCategory === category;
    animateHeroReflow(() => {
      selectedPromptCategory = isClearing ? null : category;
      selectedPromptGreeting = null;

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
        showGreetingBubble(null);
        if (focusPrompt) prompt.focus();
      } else {
        stopPromptHint();
        showGreetingBubble(category);
        primaryPrompts.classList.add('is-transitioning');
        const delay = reducedMotion.matches ? 0 : 200;
        promptTransitionTimer = setTimeout(() => {
          animateHeroReflow(() => {
            primaryPrompts.classList.remove('is-transitioning');
            primaryPrompts.classList.add('has-selection');
            renderSecondaryPrompts(category);
          });
        }, delay);
        const data = promptCategoryData()[category];
        const sourceButton = primaryPromptButtons.find((button) => button.dataset.promptCategory === category);
        const sourceIcon = sourceButton?.querySelector('.ic')?.outerHTML || '';
        setPromptGuide(data.guide, data.tag, sourceIcon);
        if (focusPrompt) prompt.focus();
      }
      transitionCases();
    });
  }

  primaryPrompts.addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt-category]');
    if (button) setPromptCategory(button.dataset.promptCategory);
  });

  secondaryPrompts.addEventListener('click', (event) => {
    const button = event.target.closest('.secondary-prompt');
    if (!button || !selectedPromptCategory) return;
    const item = promptCategoryData()[selectedPromptCategory].secondary[Number(button.dataset.secondaryIndex)];
    // 一级分类保留为简短 Tag；带完整提示词的二级推荐填入提示词，其余沿用按钮文案。
    animateHeroReflow(() => {
      selectedPromptGreeting = typeof item === 'string' ? null : item.greeting || null;
      showGreetingBubble(selectedPromptCategory);
      prompt.value = typeof item === 'string' ? item : item.prompt;
      autoResize();
      refreshSendState();
      prompt.focus();
    });
    prompt.setSelectionRange(prompt.value.length, prompt.value.length);
  });

  promptChipClear.addEventListener('click', (event) => {
    event.stopPropagation();
    // 一级 Prompt 已整行退出后，通过清除输入区 Tag 返回默认推荐态。
    if (selectedPromptCategory) setPromptCategory(selectedPromptCategory);
    else {
      setPromptGuide('');
      prompt.focus();
    }
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
    if (item.kind === 'app' && item.theme) {
      const appPreviews = {
        fitness: `<div class="artifact-app-top"><small>周五 · 10 月 09 日</small><b>练好每一天 <span>◉</span></b></div><section class="artifact-app-hero"><small>今日训练计划　/　第 3 周</small><h3>继续突破<br>自己的纪录。</h3><p>全身力量 · 35 分钟 · 中级</p><strong>开始训练　↗</strong><span class="artifact-app-hero-mark">↗</span></section><section class="artifact-app-section"><h4>打卡日历 <small>本周已完成 4 天</small></h4><div class="artifact-app-calendar"><span>一<b>5</b></span><span>二<b>6</b></span><span>三<b>7</b></span><span>四<b>8</b></span><span>五<b>9</b></span><span>六<b>10</b></span><span>日<b>11</b></span></div></section><section class="artifact-app-section"><h4>训练数据 <small>查看统计 ↗</small></h4><div class="artifact-app-stats"><article><small>累计训练</small><strong>24<em>天</em></strong></article><article><small>本周时长</small><strong>168<em>分钟</em></strong></article></div><div class="artifact-app-note">✦　坚持达人徽章已解锁　<span>查看成就 ↗</span></div></section>`,
        reading: `<div class="artifact-app-top"><small>纸上有山河</small><b>墨间书屋 <span>☰</span></b></div><section class="artifact-app-hero"><small>正在读 · 第三卷</small><h3>读书如行远路，<br>亦见山河。</h3><p>给自己一段安静的阅读时光。</p><strong>继续阅读　→</strong><span class="artifact-app-hero-mark">山</span></section><section class="artifact-app-section"><h4>我的书架 <small>全部书籍 ↗</small></h4><div class="artifact-app-books"><article><b>山海经</b><small>已读 68%</small></article><article><b>人间词话</b><small>已读 32%</small></article><article><b>浮生六记</b><small>尚未阅读</small></article></div></section><section class="artifact-app-section"><h4>今日书摘 <small>笔记 12 则</small></h4><blockquote>“且将新火试新茶，诗酒趁年华。”<small>—— 苏轼 · 望江南</small></blockquote><div class="artifact-app-note">书城荐读　<span>翻开更多好书 ↗</span></div></section>`,
        camping: `<div class="artifact-app-top"><small>去野 · 租装备</small><b>出发去户外 <span>⌕</span></b></div><section class="artifact-app-hero"><small>本周精选 / 野趣计划</small><h3>带上热爱，<br>即刻出发。</h3><p>好装备轻松租，周末说走就走。</p><strong>探索装备　↗</strong><span class="artifact-app-hero-mark">▲</span></section><section class="artifact-app-section"><h4>选择取还日期 <small>修改日期 ↗</small></h4><div class="artifact-app-dates"><span>取件　<b>10月17日 · 周六</b></span><span>还件　<b>10月19日 · 周一</b></span></div></section><section class="artifact-app-section"><h4>人气装备 <small>查看全部 ↗</small></h4><div class="artifact-app-gear"><article><div>△</div><strong>山野双人帐</strong><small>¥ 68 / 天　·　可下单</small></article><article><div>☼</div><strong>露营氛围灯</strong><small>¥ 18 / 天　·　可下单</small></article></div><div class="artifact-app-note">我的租赁订单　<span>查看进度 ↗</span></div></section>`,
        petcare: `<div class="artifact-app-top"><small>陪伴每一个健康日常</small><b>早安，毛孩子 <span>♡</span></b></div><section class="artifact-app-hero"><small>宠物档案 / 2 岁 3 个月</small><h3>豆包今天<br>也要元气满满！</h3><p>金毛犬 · 最近体重 24.5 kg</p><strong>查看健康档案　↗</strong><span class="artifact-app-hero-mark">✿</span></section><section class="artifact-app-section"><h4>健康提醒 <small>全部提醒 ↗</small></h4><div class="artifact-app-reminders"><article><b>疫苗接种</b><span>10月15日 · 还有 6 天</span></article><article><b>体外驱虫</b><span>10月28日 · 还有 19 天</span></article></div></section><section class="artifact-app-section"><h4>健康日记 <small>记录今天 +</small></h4><div class="artifact-app-note">今天精神不错，饭也吃光啦！　<span>查看日记 ↗</span></div><h4>附近宠物服务</h4><div class="artifact-app-nearby">⌖　附近的宠物医院　<span>1.2 km ↗</span></div></section>`,
      };
      return `<div class="case-artifact case-artifact-app artifact-app-${item.theme}"><div class="artifact-app-scroll"${thumbnail ? '' : ' tabindex="0" aria-label="滚动查看 App 预览"'}><div class="artifact-app-phone"><div class="artifact-app-status">9:41 <span>●●● ▰</span></div>${appPreviews[item.theme]}<nav class="artifact-app-nav"><span>⌂<small>首页</small></span><span>▦<small>${item.theme === 'reading' ? '书城' : item.theme === 'camping' ? '分类' : '发现'}</small></span><span>◷<small>${item.theme === 'petcare' ? '日记' : '记录'}</small></span><span>◉<small>我的</small></span></nav></div></div></div>`;
    }
    if (item.kind === 'web' && item.theme) {
      const websitePreviews = {
        corporate: `<header class="artifact-site-nav"><strong>ATLAS<span> / GROUP</span></strong><span>首页　关于我们　服务领域　客户案例　联系我们</span><b>预约咨询 ↗</b></header><section class="artifact-site-hero"><small>ATLAS GROUP　/　SINCE 2008</small><h3>以专业洞见<br>驱动企业增长。</h3><p>连接战略、技术与执行，为每一次关键决策创造长期价值。</p><b>了解我们的服务　↗</b></section><section class="artifact-site-section"><small>OUR SERVICES / 服务领域</small><h4>面向未来的综合解决方案</h4><div class="artifact-site-grid"><article><span>01 /</span><h4>战略咨询</h4><p>从洞察到落地，明确增长方向。</p></article><article><span>02 /</span><h4>数字化转型</h4><p>让技术成为业务的核心竞争力。</p></article><article><span>03 /</span><h4>运营赋能</h4><p>以高效协同推动组织持续进化。</p></article></div></section><section class="artifact-site-proof"><strong>18 年</strong><strong>500+ 客户</strong><strong>30+ 行业</strong></section><section class="artifact-site-quote">“专业可靠的团队，让复杂挑战变成清晰可执行的路径。”<small>— 合作客户评价</small></section>`,
        shop: `<header class="artifact-pop-nav"><strong>POP! MART</strong><span>新鲜上架　 /　 街头服饰　 /　 艺术玩物</span><b>购物袋 (2)</b></header><section class="artifact-pop-hero"><small>NEW DROP!　 ✳　 2026 EDITION</small><h3>大胆一点，<br>好玩一点！</h3><p>穿上灵感，逛进色彩的世界。</p><b>立即开逛 ↗</b><span class="artifact-pop-sticker">WOW!</span></section><section class="artifact-pop-products"><h4>本周超人气 <span>✷ HAND PICKED</span></h4><div class="artifact-pop-grid"><article><div>✳</div><strong>涂鸦撞色 T 恤</strong><span>¥ 199</span></article><article><div>★</div><strong>复古波普帽</strong><span>¥ 129</span></article><article><div>✦</div><strong>画框帆布袋</strong><span>¥ 89</span></article></div></section>`,
        commerce: `<header class="artifact-admin-nav"><strong>✦　云选 · 运营中心</strong><span>总览　订单　商品　营销　数据分析</span><b>运营管理员　◉</b></header><div class="artifact-admin-layout"><aside><b>工作台</b><span>▦　数据总览</span><span>▤　订单处理</span><span>▧　商品管理</span><span>◫　营销中心</span><span>◷　客户管理</span></aside><main><small>工作台 / 数据总览</small><h3>运营总览 <span>近 7 天　⌄</span></h3><div class="artifact-admin-metrics"><article>成交金额<strong>¥ 328,490</strong><small>↗ 18.6%</small></article><article>待处理订单<strong>128</strong><small>今日新增 34</small></article><article>访客数<strong>25,680</strong><small>↗ 12.3%</small></article></div><div class="artifact-admin-panels"><section><h4>交易趋势　<small>渠道 ⌄　地区 ⌄</small></h4><div class="artifact-admin-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></section><section><h4>订单处理　<small>查看全部 ↗</small></h4><p>待付款　<span>36 单</span></p><p>待发货　<span>58 单</span></p><p>售后处理中　<span>12 单</span></p></section></div><section class="artifact-admin-products"><h4>商品管理　<small>拖拽调整排序　↕</small></h4><p>⠿　春季新品系列　<span>在售 · 1,204 件</span></p></section></main></div>`,
        community: `<div class="artifact-social-layout"><aside><strong>✳　热议</strong><span>⌂　首页</span><span>#　发现</span><span>♧　关注</span><span>✉　消息</span><b>＋ 发布动态</b></aside><main><header><strong>热门话题</strong><span>为你推荐　 /　 关注动态</span></header><div class="artifact-social-compose">分享你的新鲜事…… <b>发布 ↗</b></div><article><small>●　城市观察家　·　2 小时前</small><h4># 周末去哪里玩 #</h4><p>收集城市里值得一逛的小店和展览。你最想推荐哪一处？</p><footer>♡ 1.2k　↪ 268　◉ 83</footer></article><article><small>●　设计灵感站　·　4 小时前</small><h4># 今日灵感 #</h4><p>来分享一个最近让你眼前一亮的设计细节。</p><footer>♡ 896　↪ 154　◉ 47</footer></article></main><aside class="artifact-social-trending"><strong>正在热议</strong><p><b>01</b>　城市生活新提案 <small>248万讨论</small></p><p><b>02</b>　我的周末片单 <small>167万讨论</small></p><p><b>03</b>　创作者日常 <small>86万讨论</small></p></aside></div>`,
      };
      return `<div class="case-artifact case-artifact-web artifact-website artifact-website-${item.theme}"><div class="artifact-web-scroll" tabindex="0" aria-label="滚动查看网页预览">${websitePreviews[item.theme]}</div></div>`;
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
      const pptExamples = {
        finance: { eyebrow: 'FINANCIAL REVIEW / 01', subtitle: '从营收结构到增长质量', insight: '用图表读懂业绩', measures: ['营收趋势', '业务结构', '增长动因'], next: '值得关注的三个问题', steps: ['核心业务表现', '区域与渠道变化', '风险与后续展望'] },
        summary: { eyebrow: 'QUARTERLY REVIEW / 02', subtitle: '回顾成果，明确下一步', insight: '季度工作一览', measures: ['业绩回顾', '关键亮点', '改进空间'], next: '下季度行动计划', steps: ['聚焦重点目标', '补齐协作短板', '按阶段复盘成效'] },
        launch: { eyebrow: 'PRODUCT LAUNCH / 03', subtitle: '让下一次体验，领先一步', insight: '从痛点到产品亮点', measures: ['用户痛点', '产品亮点', '现场演示'], next: '发布与发售信息', steps: ['产品正式亮相', '体验与演示', '发售安排'] },
        onboarding: { eyebrow: 'WELCOME ABOARD / 04', subtitle: '从第一天，走进新的团队', insight: '入职学习地图', measures: ['团队文化', '基本制度', '协作流程'], next: '快速开启你的旅程', steps: ['认识团队与文化', '熟悉工作制度', '掌握日常流程'] },
      };
      const example = pptExamples[item.theme];
      if (example) {
        const slides = [
          `<div class="artifact-ppt-cover"><small>${example.eyebrow}</small><div class="artifact-ppt-cover-body"><span>CATPAW / PRESENTATION</span><h3>${title}</h3><p>${example.subtitle}</p></div><div class="artifact-ppt-cover-graphic" aria-hidden="true"><i></i><i></i><i></i></div><footer>演示示例 <span>01 / 03</span></footer></div>`,
          `<div class="artifact-ppt-detail"><small>${example.eyebrow}</small><h3>${example.insight}</h3><div class="artifact-ppt-visual"><div class="artifact-ppt-chart" aria-label="示意图表"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="artifact-ppt-metrics">${example.measures.map((label, index) => `<div><b>0${index + 1}</b><strong>${label}</strong><span>重点内容</span></div>`).join('')}</div></div><footer>结构示意 · 非实际数据 <span>02 / 03</span></footer></div>`,
          `<div class="artifact-ppt-detail artifact-ppt-outro"><small>${example.eyebrow}</small><h3>${example.next}</h3><div class="artifact-ppt-steps">${example.steps.map((step, index) => `<div><span>0${index + 1}</span><strong>${step}</strong><i aria-hidden="true"></i></div>`).join('')}</div><footer>演示示例 <span>03 / 03</span></footer></div>`,
        ];
        return `<div class="case-artifact case-artifact-deck artifact-ppt-${item.theme}"><div class="artifact-deck-pages"${thumbnail ? '' : ' tabindex="0" aria-label="滚动查看幻灯片"'}>${(thumbnail ? slides.slice(0, 1) : slides).map(slide => `<div class="artifact-slide">${slide}</div>`).join('')}</div></div>`;
      }
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
      return `<div class="case-artifact case-artifact-deck"><div class="artifact-deck-pages"${thumbnail ? '' : ' tabindex="0" aria-label="滚动查看幻灯片"'}>${(thumbnail ? slides.slice(0, 1) : slides).map(slide => `<div class="artifact-slide">${slide}</div>`).join('')}</div></div>`;
    }
    if (item.kind === 'code') {
      return `<div class="case-artifact case-artifact-code"><div class="artifact-code-body"><div class="artifact-code-tree">▾ analytics<br>　▸ orders<br>　▸ reports<br>　<span>analyze.py</span></div><pre><code><span># ${title}</span>\nfrom collections import defaultdict\n\ndef analyze(orders):\n    by_station = defaultdict(list)\n    for order in orders:\n        key = order["station_id"]\n        by_station[key].append(order)\n\n    return {station: {\n        "orders": len(items),\n        "late_rate": sum(\n            item["is_late"] for item in items\n        ) / len(items),\n    } for station, items in by_station.items()}\n\n<span># 示例结构：实际分析需校验数据口径</span></code></pre></div></div>`;
    }
    const isPromo = /推文|推广/.test(item.title);
    const isLogistics = /配送|物流|签收/.test(item.title);
    const isArchive = /资料|归档/.test(item.title);
    return `<div class="case-artifact case-artifact-document"><div class="artifact-document-scroll" tabindex="0" aria-label="滚动查看文档预览"><article class="artifact-page"><div class="artifact-page-meta">${isPromo ? '餐饮品牌 / 推广内容' : isArchive ? '业务资料 / 归档目录' : isLogistics ? '物流服务 / 案例文档' : '市场行业 / 分析报告'}</div><h3>${title}</h3><p class="artifact-page-lead">${isPromo ? '从城市餐桌出发，发现值得尝试的好味道。' : isArchive ? '按城市、日期和业务环节归类材料，让信息更易查找。' : isLogistics ? '聚焦履约体验与站点协同，梳理可执行的改善路径。' : '从消费场景与品类变化出发，梳理市场信号与行动建议。'}</p><div class="artifact-page-rule"></div><h4>${isPromo ? '一、活动亮点' : isArchive ? '一、资料范围' : '一、背景与研究范围'}</h4><p>${isPromo ? '汇聚城市里的特色餐厅与当季菜单，在不同街区发现适合聚会、工作餐和周末休闲的餐饮选择。' : isArchive ? '汇总门店巡检、经营会议或市场调研的材料，核对版本、来源与时间，形成统一目录。' : isLogistics ? '围绕配送时效、运力供需与异常订单，按城市和时段梳理问题，明确关键指标口径。' : '围绕餐饮消费市场，观察价格带、热门品类与到店场景的变化，明确分析范围与数据口径。'}</p><h4>${isPromo ? '二、参与方式' : isArchive ? '二、归档清单' : '二、关键发现'}</h4><ol><li>${isPromo ? '选择感兴趣的街区与餐饮主题。' : isArchive ? '按城市与业务环节整理原始文件。' : '汇总可用数据与资料，校验来源和统计口径。'}</li><li>${isPromo ? '浏览参与商家、活动时段与菜单信息。' : isArchive ? '标记重复版本与缺失的附件。' : '识别高频变化、区域差异及其影响范围。'}</li><li>${isPromo ? '查看活动规则并按页面提示参与。' : isArchive ? '建立可检索目录和待补齐清单。' : '区分事实与推测，提出分阶段行动建议。'}</li></ol><div class="artifact-page-note">说明：这是页面示例，文中的趋势与数值需以实际调研数据为准。</div><h4>三、下一步建议</h4><p><strong>聚焦高价值场景</strong><br>按城市与消费时段筛选重点机会，结合真实反馈验证判断。</p><p><strong>建立复盘机制</strong><br>持续跟踪用户体验、订单变化与执行结果，定期调整策略。</p><div class="artifact-page-footer">CATPAW · 内容示例 <span>01 / 01</span></div></article></div></div>`;
  }

  /* 保留原场景案例池作为默认内容来源；未选择 Prompt 分类时展示不同类型的案例。
     prompt 会在详情弹窗中完整展示，并可通过「做同款」直接带回输入框。 */
  function caseData() {
   return {
    office: [
      { kind: 'dashboard', type: '物流数据看板', title: '同城配送履约异常看板', prompt: '汇总本月各配送站点的订单、准时率和超时原因，按城市、时段与异常等级制作明细看板，突出需要优先处理的站点。' },
      { kind: 'article', type: '分析报告', title: '餐饮趋势报告', prompt: '整理近期餐饮消费市场资料，分析价格带、品类和消费场景的变化，注明数据来源并给出餐饮品牌可执行的建议。' },
      { kind: 'deck', type: 'PPT 制作', title: '餐饮 Q1 经营复盘', prompt: '根据第一季度连锁餐饮经营数据制作管理层复盘，包含门店表现、营收与客单价变化、成本问题和下一季度行动计划。' },
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
      { kind: 'deck', type: 'PPT 制作', title: '餐饮品牌市场拓展提案', prompt: '制作餐饮品牌进入新城市的市场提案，梳理目标客群、竞品格局、品牌定位和渠道策略。' },
      { kind: 'web', type: '活动网页', title: '城市美食节活动页面', prompt: '设计可滚动的城市美食节活动网页，展示主题餐厅、活动日程、报名入口和合作商家信息。' },
      { kind: 'visual', type: '品牌视觉', title: '餐饮品牌秋季上新视觉', prompt: '为餐饮品牌设计秋季新品推广视觉，突出产品特色、季节氛围和清晰的购买行动入口。' },
    ],
   };
  }

  function visibleCaseData(scope) {
    const category = selectedPromptCategory && promptCategoryData()[selectedPromptCategory];
    if (category) return category.cases;
    const cases = caseData();
    return cases[scope] || [
      promptCategoryData().develop.cases[2],
      promptCategoryData().analyze.cases[0],
      promptCategoryData().create.cases[0],
      promptCategoryData().research.cases[0],
    ];
  }

  function renderCases(scope) {
    const casesEl = document.getElementById('cases');
    if (!casesEl) return;
    const iconByKind = {
      dashboard: 'html', article: 'doc', deck: 'ppt',
      web: 'html', app: 'html', code: 'html', visual: 'image',
    };
    const list = visibleCaseData(scope);
    casesEl.innerHTML =
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
  const conversationPage = document.getElementById('conversationPage');
  const outputToggle = document.getElementById('toggleOutputs');
  const scheduledPanelToggle = document.getElementById('toggleScheduledPanel');
  const summaryArtifactBadge = document.getElementById('summaryArtifactBadge');
  const summaryToggleSlot = document.querySelector('.summary-toggle-slot');
  const summaryPopover = document.getElementById('summaryPopover');
  const summaryArtifactsSection = document.getElementById('summaryArtifactsSection');
  const wbToggle = document.getElementById('toggleWorkbench');
  const wbExpandToggle = document.getElementById('toggleWorkbenchExpand');
  const fileTreeToggle = document.getElementById('toggleFileTree');
  const wbPanes = Array.from(workbench.querySelectorAll('.wb-pane'));
  const workbenchLanding = document.getElementById('workbenchLanding');
  const workbenchLandingRecentToggle = document.getElementById('workbenchLandingRecentToggle');
  const conversationPageHome = conversationPage.parentNode;
  const conversationPageNextSibling = conversationPage.nextSibling;
  const workspaceTabs = document.getElementById('workspaceTabs');
  const workspaceCreate = document.getElementById('workspaceCreate');
  const workspaceAdd = document.getElementById('workspaceAdd');
  const workspaceCreateMenu = document.getElementById('workspaceCreateMenu');
  const urlInput = document.getElementById('urlInput');
  const toolFileTree = document.getElementById('toolFileTree');
  const toolTreeSearch = document.getElementById('toolTreeSearch');
  const toolTreeSearchClear = document.getElementById('toolTreeSearchClear');
  const toolFileModeToggle = document.getElementById('toolFileModeToggle');
  const toolFileShare = document.getElementById('toolFileShare');
const toolFileEditSave = document.getElementById('toolFileEditSave');
const toolFileEditDiscard = document.getElementById('toolFileEditDiscard');
const fileCloseOverlay = document.getElementById('fileCloseOverlay');
const fileCloseDescription = document.getElementById('fileCloseDescription');
const fileCloseCancel = document.getElementById('fileCloseCancel');
const fileCloseDiscard = document.getElementById('fileCloseDiscard');
const fileCloseSave = document.getElementById('fileCloseSave');
  const toolFilePreviewTitle = document.getElementById('toolFilePreviewTitle');
  const toolFilePreviewBody = document.getElementById('toolFilePreviewBody');
const fileActions = document.getElementById('fileActions');
const fileActionsTrigger = document.getElementById('fileActionsTrigger');
const fileActionsMenu = document.getElementById('fileActionsMenu');
const fileDetailsDialog = document.getElementById('fileDetailsDialog');
const fileDetailsTitle = document.getElementById('fileDetailsTitle');
const fileDetailsContent = document.getElementById('fileDetailsContent');
  const fullscreenChat = document.getElementById('fullscreenChat');
  const fullscreenChatInput = document.getElementById('fullscreenChatInput');
  const fullscreenChatSend = document.getElementById('fullscreenChatSend');
  const fullscreenChatAttach = document.getElementById('fullscreenChatAttach');
  const artifactShareDialog = document.getElementById('artifactShareDialog');
  const toolFolderPicker = document.getElementById('toolFolderPicker');
  const toolFolderBtn = document.getElementById('toolFolderBtn');
  const toolFolderName = document.getElementById('toolFolderName');
  const toolFolderMenu = document.getElementById('toolFolderMenu');

  const CONVERSATION_TAB_ID = 'conversation';
  const WORKSPACE_META = {
    conversation: {
      title: '对话',
      icon: '<path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3.5 20l1.3-4A8 8 0 1 1 20 11.5Z"/>',
    },
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
    implicit: true,
    title: '打开文件',
    node: null,
    chain: [],
    path: null,
    previewMode: 'source',
  }];
  let activeWorkspace = 'file-default';
  // 文件目录树由独立入口打开；工具面板默认只显示当前工作区。
  let fileTreeVisible = false;

  function syncFileTreeToggle() {
    const active = content.classList.contains('wb-open') &&
      !content.classList.contains('wb-auto-collapsed') &&
      (rightPanel === 'tree' || ((rightPanel === 'tools' || rightPanel === 'landing') && fileTreeVisible));
    const label = active ? '收起文件目录树' : '显示文件目录树';
    fileTreeToggle.setAttribute('aria-pressed', String(active));
    fileTreeToggle.title = label;
    fileTreeToggle.setAttribute('aria-label', label);
  }

  function saveActiveWorkspaceState() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    if (!item) return;
    if (item.kind === 'browser') {
      item.url = urlInput.value;
    }
  }

  let rightPanel = null;
let workbenchExpanded = false;
let fullscreenConversationActive = false;

  function syncFullscreenChat() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const visible = content.classList.contains('wb-expanded') && !fullscreenConversationActive && rightPanel === 'tools' && item?.kind === 'file' && Boolean(item.node);
    fullscreenChat.hidden = !visible;
  }

  let summaryRestoreFrame = 0;
  function waitForMainRestored() {
    if (content.classList.contains('wb-expanded') || rightPanel !== 'tools') return;
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
    const canExpand = rightPanel === 'tools' && (openWorkspaces.length > 0 || !conversationPage.hidden);
    const wasExpanded = workbenchExpanded;
    workbenchExpanded = Boolean(expanded && canExpand);
    if (wasExpanded && !workbenchExpanded && content.classList.contains('wb-scheduled-overlay')) {
      content.classList.remove('wb-scheduled-overlay');
      setRightPanel('scheduled');
      return;
    }
    content.classList.toggle('wb-file-active', canExpand);
    syncAdaptiveLayout();
    if (wasExpanded && !workbenchExpanded && !openWorkspaces.length) setRightPanel('landing');
    requestAnimationFrame(syncSummaryTriggerPosition);
    requestAnimationFrame(syncResizeLayout);
  }

  function syncWorkbenchWidth() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    content.classList.toggle('wb-file-workspace', rightPanel === 'tools' && ['file', 'browser', 'terminal'].includes(item?.kind) || rightPanel === 'landing' && fileTreeVisible);
    requestAnimationFrame(syncResizeLayout);
  }

  /* 两级分栏只记录用户设置的像素宽度；布局变化时夹紧，不覆盖原始偏好。 */
  const panelResizer = document.getElementById('panelResizer');
  const treeResizer = document.getElementById('treeResizer');
  let preferredPanelWidths = { file: null, compact: null, landing: null, tree: null };
  let preferredTreeWidth = null;
  let activeResize = null;
  const PANEL_EXPAND_OVERDRAG = 32;

  function panelWidthKey() { return rightPanel === 'tree' || rightPanel === 'scheduled' ? 'tree' : content.classList.contains('wb-file-workspace') ? 'file' : rightPanel === 'landing' ? 'landing' : 'compact'; }
  function desiredPanelWidth(width, sidebarWidth) {
    const root = getComputedStyle(document.documentElement);
    const key = panelWidthKey();
    return preferredPanelWidths[key] ?? (key === 'tree' ? parseFloat(root.getPropertyValue('--workbench-tree-only-w'))
      : key === 'landing' ? parseFloat(root.getPropertyValue('--workbench-landing-w'))
      : key === 'file' ? Math.min(parseFloat(root.getPropertyValue('--workbench-folder-w')), (width - sidebarWidth) * .62)
      : parseFloat(root.getPropertyValue('--workbench-w')));
  }
  function panelBounds() {
    const available = content.clientWidth;
    const mainMin = Math.min(320, available);
    const panelMin = Math.min(panelWidthKey() === 'tree' ? 180 : panelWidthKey() === 'file' ? 360 : 300, available - mainMin);
    return { min: panelMin, max: Math.max(panelMin, available - mainMin) };
  }
  function treeBounds(available = workbench.clientWidth) {
    const previewMin = Math.min(240, Math.floor(available * .52));
    const treeMin = Math.min(180, available - previewMin);
    return { min: treeMin, max: Math.max(treeMin, available - previewMin) };
  }
  function clampWidth(value, bounds) { return Math.round(Math.min(bounds.max, Math.max(bounds.min, value))); }

  // 右面板已打开时优先保留它；双栏放不下就临时以全屏工作区呈现。
  // 窗口变宽后恢复分栏，不改写用户手动放大和拖拽的偏好。
  function syncAdaptiveLayout() {
    if (!adaptiveLayoutReady) return;
    const width = win.clientWidth;
    const mainMin = Math.min(320, width);
    const root = getComputedStyle(document.documentElement);
    const sidebarRailWidth = parseFloat(root.getPropertyValue('--sidebar-rail-w'));
    const sidebarDesired = win.classList.contains('collapsed') ? sidebarRailWidth
      : Math.min(480, preferredSidebarWidth ?? parseFloat(root.getPropertyValue('--sidebar-w')));
    const panelOpen = content.classList.contains('wb-open');
    const panelDesired = panelOpen ? desiredPanelWidth(width, sidebarDesired) : 0;
    const wasFullPanel = content.classList.contains('wb-expanded');
    const fullPanel = panelOpen && (workbenchExpanded || width - sidebarDesired - panelDesired < mainMin);
    if (!fullPanel && content.classList.contains('wb-scheduled-overlay')) {
      content.classList.remove('wb-scheduled-overlay');
      queueMicrotask(() => {
        if (rightPanel === 'tools' && !content.classList.contains('wb-expanded')) setRightPanel('scheduled');
      });
    }
    if (fullPanel !== wasFullPanel && workbench.classList.contains('file-split')) keepWorkbenchVisibleDuringTransition();
    content.classList.toggle('wb-expanded', fullPanel);
    if (!fullPanel || rightPanel !== 'tools') fullscreenConversationActive = false;
    content.classList.toggle('wb-conversation-active', fullPanel && fullscreenConversationActive);
    if (fullPanel && rightPanel === 'tools' && !conversationPage.hidden) {
      if (conversationPage.parentNode !== workbench) workbench.append(conversationPage);
    } else if (conversationPage.parentNode !== conversationPageHome) {
      conversationPageHome.insertBefore(conversationPage, conversationPageNextSibling);
    }
    if (fullPanel !== wasFullPanel) {
      requestAnimationFrame(syncSummaryTriggerPosition);
      cancelAnimationFrame(summaryRestoreFrame);
      if (wasFullPanel && !fullPanel && rightPanel === 'tools') {
        content.classList.add('wb-restoring');
        summaryRestoreFrame = requestAnimationFrame(waitForMainRestored);
      } else content.classList.remove('wb-restoring');
      renderWorkspaceTabs();
      syncFullscreenChat();
    }
    const canExpand = rightPanel === 'tools' && (openWorkspaces.length > 0 || !conversationPage.hidden);
    wbExpandToggle.disabled = !canExpand;
    wbExpandToggle.setAttribute('aria-pressed', String(fullPanel));
    wbExpandToggle.title = workbenchExpanded ? '退出全屏工作区' : fullPanel ? '固定全屏工作区' : '放大工作区';
    wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
    const availableRight = Math.max(0, width - sidebarDesired - mainMin);
    const rightCandidate = Math.min(panelDesired, availableRight);
    const leftCandidate = Math.min(sidebarDesired, Math.max(0, width - rightCandidate - mainMin));
    const leftWidth = fullPanel
      ? width - sidebarDesired >= (panelWidthKey() === 'file' ? 360 : 300) ? sidebarDesired : 0
      : leftCandidate >= 188 ? leftCandidate : 0;
    const rightWidth = fullPanel ? Math.max(0, width - leftWidth) : rightCandidate;
    if (sidebarResizePointer === null && !win.classList.contains('collapsed')) {
      win.style.setProperty('--user-sidebar-w', `${Math.round(leftWidth)}px`);
      sidebarResizer.setAttribute('aria-valuenow', String(Math.round(leftWidth)));
    }
    if (panelOpen && !fullPanel) {
      const previewWidth = activeResize?.kind === 'panel' ? activeResize.previewWidth : null;
      content.style.setProperty('--user-panel-w', `${Math.round(previewWidth ?? rightWidth)}px`);
    } else if (!panelOpen) content.style.removeProperty('--user-panel-w');
    const leftHidden = sidebarResizePointer === null && !win.classList.contains('collapsed') && leftWidth === 0;
    content.classList.remove('wb-auto-collapsed');
    win.classList.toggle('sidebar-auto-collapsed', leftHidden);
    workbench.setAttribute('aria-hidden', String(!panelOpen));
    syncFileTreeToggle();
  }

  function syncResizeLayout() {
    syncAdaptiveLayout();
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    const panelActive = content.classList.contains('wb-open') && !content.classList.contains('wb-expanded') && !content.classList.contains('wb-auto-collapsed');
    const bounds = panelBounds();
    const treeActive = content.classList.contains('wb-open') && workbench.classList.contains('file-split') && (rightPanel === 'tools' || rightPanel === 'landing');
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
    if (rightPanel && content.classList.contains('wb-expanded') && !conversationPage.hidden &&
        !content.classList.contains('wb-auto-collapsed')) {
      const triggerRect = outputToggle.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const floatWidth = Math.min(326, Math.max(0, contentRect.width - 32));
      const left = Math.max(contentRect.left + 16,
        Math.min(triggerRect.right - floatWidth, contentRect.right - floatWidth - 16));
      summaryPopover.style.setProperty('position', 'fixed', 'important');
      summaryPopover.style.setProperty('left', `${left}px`, 'important');
      summaryPopover.style.setProperty('top', `${triggerRect.bottom + 8}px`, 'important');
      summaryPopover.style.setProperty('right', 'auto', 'important');
      summaryPopover.style.setProperty('width', `${floatWidth}px`, 'important');
      return;
    }
    if (!rightPanel || !content.classList.contains('wb-open') ||
        content.classList.contains('wb-expanded') || content.classList.contains('wb-auto-collapsed') ||
        !main || !summaryToggleSlot) {
      summaryPopover.style.removeProperty('position');
      summaryPopover.style.removeProperty('left');
      summaryPopover.style.removeProperty('top');
      summaryPopover.style.removeProperty('right');
      summaryPopover.style.removeProperty('width');
      return;
    }

    const mainRect = main.getBoundingClientRect();
    const triggerRect = outputToggle.getBoundingClientRect();
    const floatWidth = Math.min(326, Math.max(0, mainRect.width - 32));
    const minLeft = mainRect.left + 16;
    const maxLeft = Math.max(minLeft, mainRect.right - floatWidth - 16);
    const left = Math.min(maxLeft, Math.max(minLeft, triggerRect.right - floatWidth));
    const top = triggerRect.bottom + 8;

    // 所有右侧面板共用视口坐标，摘要跟随入口并保持在对话主区内。
    summaryPopover.style.setProperty('position', 'fixed', 'important');
    summaryPopover.style.setProperty('left', `${left}px`, 'important');
    summaryPopover.style.setProperty('top', `${top}px`, 'important');
    summaryPopover.style.setProperty('right', 'auto', 'important');
    summaryPopover.style.setProperty('width', `${floatWidth}px`, 'important');
  }

  let panelSwitchTimer;
  function keepWorkbenchVisibleDuringTransition() {
    content.classList.add('wb-panel-switch');
    clearTimeout(panelSwitchTimer);
    // 过渡结束后恢复首次打开时的防抖显示规则；无动画或减弱动态效果时也能清理。
    panelSwitchTimer = setTimeout(() => content.classList.remove('wb-panel-switch'), 500);
  }
  content.addEventListener('transitionend', (event) => {
    if (event.target !== content || event.propertyName !== 'grid-template-columns') return;
    clearTimeout(panelSwitchTimer);
    content.classList.remove('wb-panel-switch');
  });

  function setRightPanel(panel) {
    const next = panel || null;
    if (next !== 'tools') content.classList.remove('wb-scheduled-overlay');
    const opening = Boolean(next) && (!content.classList.contains('wb-open') || content.classList.contains('wb-auto-collapsed'));
    if (next && rightPanel && next !== rightPanel && !opening) keepWorkbenchVisibleDuringTransition();
    if (!next) {
      clearTimeout(panelSwitchTimer);
      content.classList.remove('wb-panel-switch');
    }
    if (next === 'tools' && openWorkspaces.length === 0 && !workbenchExpanded) ensureDefaultFileWorkspace();
    rightPanel = next;
    syncScheduledPanelToggle();
    syncWorkbenchWidth();
    const instantFileOpen = opening && content.classList.contains('wb-file-workspace');
    if (instantFileOpen) content.classList.add('wb-opening');
    const open = Boolean(next);
    content.classList.toggle('wb-open', open);
    workbench.dataset.panel = next || '';
    syncAdaptiveLayout();
    setWorkbenchExpanded(workbenchExpanded);
    workbench.setAttribute('aria-hidden', String(!open || content.classList.contains('wb-auto-collapsed')));
    wbToggle.setAttribute('aria-expanded', String(next === 'tools' || next === 'landing'));
    wbToggle.title = next === 'tools' || next === 'landing' ? '收起工具' : '工具';
    syncFileTreeToggle();
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
      scheduledPanelToggle.setAttribute('aria-expanded', 'false');
      scheduledPanelToggle.classList.remove('active');
      clearTimeout(panelSwitchTimer);
      rightPanel = null;
      content.classList.remove('wb-open', 'wb-file-workspace', 'wb-expanded', 'wb-file-active', 'wb-conversation-active', 'wb-panel-switch', 'wb-scheduled-overlay');
      if (conversationPage.parentNode !== conversationPageHome) conversationPageHome.insertBefore(conversationPage, conversationPageNextSibling);
      workbenchExpanded = false;
      fullscreenConversationActive = false;
      renderWorkspaceTabs();
      syncAdaptiveLayout();
      wbExpandToggle.disabled = true;
      wbExpandToggle.setAttribute('aria-pressed', 'false');
      wbExpandToggle.title = '放大工作区';
      wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
      workbench.dataset.panel = '';
      workbench.setAttribute('aria-hidden', 'true');
      wbToggle.setAttribute('aria-expanded', 'false');
      wbToggle.title = '工具';
      syncFileTreeToggle();
      fullscreenChat.hidden = true;
      syncSummaryTriggerPosition();
      requestAnimationFrame(syncResizeLayout);
      return;
    }
    if (rightPanel !== 'tools') setRightPanel('tools');
  }

  function renderWorkspaceTabs() {
    const conversationAvailable = rightPanel === 'tools' && content.classList.contains('wb-expanded') && !conversationPage.hidden;
    const tabs = conversationAvailable
      ? [{ id: CONVERSATION_TAB_ID, kind: 'conversation', title: '对话' }, ...openWorkspaces]
      : openWorkspaces;
    workspaceTabs.innerHTML = tabs.map((item) => {
      const meta = WORKSPACE_META[item.kind];
      const isConversation = item.id === CONVERSATION_TAB_ID;
      const selected = isConversation ? fullscreenConversationActive : !fullscreenConversationActive && item.id === activeWorkspace;
      return `<div class="workspace-tab${selected ? ' active' : ''}" role="tab" tabindex="0"` +
        ` data-workspace-tab="${item.id}" data-workspace-kind="${item.kind}"` +
        ` data-workspace-empty="${item.kind === 'file' && !item.node}"` +
        ` aria-selected="${selected}" title="${esc(item.title)}">` +
        (item.kind === 'file' && item.node && fileExtension(item.node.name) === 'pdf'
          ? `<span class="workspace-tab-pdf-icon" aria-hidden="true">PDF</span>`
          : `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${meta.icon}</svg>`) +
        `<span class="workspace-tab-title">${esc(item.title)}${item.sourceDraft !== undefined && item.sourceDraft !== sourceForNode(item.node) ? ' •' : ''}</span>` +
        (isConversation ? '' : `<button class="workspace-tab-close" type="button" title="关闭" aria-label="关闭 ${esc(item.title)}">${WORKSPACE_CLOSE}</button>`) +
        `</div>`;
    }).join('');
  }

  function activateWorkspace(id, saveCurrent = true) {
    artifactSelection?.cancel();
    if (id === CONVERSATION_TAB_ID) {
      if (rightPanel !== 'tools' || !content.classList.contains('wb-expanded') || conversationPage.hidden) return;
      saveActiveWorkspaceState();
      fullscreenConversationActive = true;
      content.classList.add('wb-conversation-active');
      renderWorkspaceTabs();
      syncFullscreenChat();
      return;
    }
    const item = openWorkspaces.find((workspace) => workspace.id === id);
    if (!item) return;
    if (saveCurrent) saveActiveWorkspaceState();
    setFileActionsMenu(false);
    if (content.classList.contains('wb-scheduled-overlay')) {
      content.classList.remove('wb-scheduled-overlay');
      syncScheduledPanelToggle();
    }
    fullscreenConversationActive = false;
    content.classList.remove('wb-conversation-active');
    activeWorkspace = id;
    if (item.kind === 'terminal') fileTreeVisible = false;
    renderWorkspaceTabs();
    workbench.classList.toggle('file-split', fileTreeVisible);
    workbench.classList.toggle('file-preview-only', !fileTreeVisible);
    syncWorkbenchWidth();
    setWorkbenchExpanded(workbenchExpanded);
    wbPanes.forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === item.kind));
    if (item.kind === 'browser') {
      urlInput.value = item.url || '';
      if (!saveCurrent || document.activeElement === workspaceAdd || document.activeElement?.closest('.workspace-create-menu')) {
        requestAnimationFrame(() => urlInput.focus());
      }
    }
    if (item.kind === 'file') renderToolFileWorkspace(item);
    syncFileTreeToggle();
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
    const item = makeFileWorkspace({ implicit: true });
    openWorkspaces.push(item);
    activeWorkspace = item.id;
    activateWorkspace(item.id, false);
    return item;
  }

  function createWorkspace(kind, { replaceImplicitFile = false } = {}) {
    if (!WORKSPACE_META[kind] || kind === 'files') return;
    if (replaceImplicitFile && openWorkspaces.length === 1) {
      const [onlyWorkspace] = openWorkspaces;
      if (onlyWorkspace.kind === 'file' && onlyWorkspace.implicit && !onlyWorkspace.node && onlyWorkspace.sourceDraft === undefined) {
        openWorkspaces = [];
        activeWorkspace = null;
      }
    }
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
    if (id === CONVERSATION_TAB_ID) return;
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

    // 关闭最后一张工具页签时退出工作区，回到原本的对话页（或首页）。
    if (openWorkspaces.length === 0) {
      activeWorkspace = null;
      fileTreeVisible = false;
      workbench.classList.remove('file-split', 'tree-revealed');
      workbench.classList.add('file-preview-only');
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
    if (confirmed) workspaceTabs.querySelector(`[data-workspace-tab="${fullscreenConversationActive ? CONVERSATION_TAB_ID : activeWorkspace}"]`)?.focus();
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
    fullscreenChatSend.disabled = !fullscreenChatInput.value.trim() && !artifactSelection?.entries().length;
  });
  fullscreenChatInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    sendFullscreenFileRequest();
  });
  fullscreenChatSend.addEventListener('click', sendFullscreenFileRequest);
  fullscreenChatAttach.addEventListener('click', () => {
    const node = currentFileWorkspace()?.node;
    if (node) {
      fullscreenChatInput.value = `${fullscreenChatInput.value.trimEnd()}${fullscreenChatInput.value ? ' ' : ''}@${node.name} `;
      fullscreenChatInput.dispatchEvent(new Event('input', { bubbles: true }));
      fullscreenChatInput.focus();
    }
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
function isScheduledPanelOpen() {
  return rightPanel === 'scheduled' || content.classList.contains('wb-scheduled-overlay');
}
function syncScheduledPanelToggle() {
  const open = isScheduledPanelOpen();
  scheduledPanelToggle.setAttribute('aria-expanded', String(open));
  scheduledPanelToggle.classList.toggle('active', open);
}
function setScheduledPanelOpen(open) {
  if (conversationPage.hidden || !scheduledRunTasks.has(activeConversationTask)) return;
  // 放大的文件工作区保留所有文件页签，只切回对话页签显示定时任务侧栏。
  if (rightPanel === 'tools' && content.classList.contains('wb-expanded')) {
    content.classList.toggle('wb-scheduled-overlay', open);
    syncScheduledPanelToggle();
    if (open) {
      renderSummaryContents();
      activateWorkspace(CONVERSATION_TAB_ID);
    }
    return;
  }
  if (open) {
    renderSummaryContents();
    setRightPanel('scheduled');
  } else if (rightPanel === 'scheduled') setRightPanel(null);
}

  outputToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setSummaryOpen(summaryPopover.hidden);
  });
  scheduledPanelToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setScheduledPanelOpen(!isScheduledPanelOpen());
  });
  // 摘要可与首页、对话和右侧工作区并用，点击页面其他区域不改变其开关状态。
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.getElementById('scheduledMoreMenu').hidden) {
      setScheduledMoreOpen(false);
      scheduledMore.focus();
      return;
    }
    if (event.key !== 'Escape' || (summaryPopover.hidden && !isScheduledPanelOpen())) return;
    if (!summaryPopover.hidden) {
      setSummaryOpen(false);
      outputToggle.focus();
    } else {
      setScheduledPanelOpen(false);
      scheduledPanelToggle.focus();
    }
  });

  function toggleToolsPanel() {
    const panelVisible = content.classList.contains('wb-open') && !content.classList.contains('wb-auto-collapsed');
    if (panelVisible && (rightPanel === 'tools' || rightPanel === 'landing')) {
      // 只关闭工具内容；已打开的目录树仍以独立右栏保留。
      setRightPanel(fileTreeVisible ? 'tree' : null);
      return;
    }
    fileTreeVisible = panelVisible && rightPanel === 'tree';
    workbench.classList.toggle('file-split', fileTreeVisible);
    workbench.classList.toggle('file-preview-only', !fileTreeVisible);
    renderWorkbenchLandingRecents();
    setRightPanel('landing');
  }

  wbToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleToolsPanel();
  });
  workbenchLanding.addEventListener('click', (event) => {
    const create = event.target.closest('[data-landing-create]');
    if (create) {
      if (create.dataset.landingCreate === 'file') {
        let emptyFile = openWorkspaces.find((item) => item.kind === 'file' && !item.node);
        fileTreeVisible = true;
        if (!emptyFile) {
          createWorkspace('file');
          emptyFile = currentFileWorkspace();
        }
        emptyFile.implicit = false;
        setRightPanel('tools');
        activateWorkspace(emptyFile.id);
      } else {
        setRightPanel('tools');
        createWorkspace(create.dataset.landingCreate, { replaceImplicitFile: true });
      }
      return;
    }
    const recent = event.target.closest('[data-landing-recent]');
    if (recent) {
      const entry = recentOpenedFiles[Number(recent.dataset.landingRecent)];
      if (entry) openArtifactPreview(entry.node, entry.chain);
    }
  });
  workbenchLandingRecentToggle.addEventListener('click', () => {
    const expanded = workbenchLandingRecentToggle.getAttribute('aria-expanded') !== 'true';
    workbenchLandingRecentToggle.setAttribute('aria-expanded', String(expanded));
    workbenchLandingRecentList.hidden = !expanded;
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
      toggleToolsPanel();
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
{ act: 'modify', label: '对话修改', svg: '<path d="M4 18.5V21h2.5L18.9 8.6a2.1 2.1 0 0 0-3-3L3.5 18Z"/><path d="m13.8 7.7 3 3"/>' },
{ act: 'share', label: '分享产物', svg: '<path d="M12 16V3m-4 4 4-4 4 4"/><path d="M4 13v5a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5"/>' },
{ act: 'template', label: '存为模版', svg: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8"/>' },
{ act: 'chat', label: '添加到对话', svg: '<path d="M7.5 3.5h9A4.5 4.5 0 0 1 21 8v6.5a4.5 4.5 0 0 1-4.5 4.5h-1.7l-2.2 1.8a1 1 0 0 1-1.2 0L9.2 19H7.5A4.5 4.5 0 0 1 3 14.5V8a4.5 4.5 0 0 1 4.5-4.5Z"/><path d="M12 8.5v6M9 11.5h6"/>' },
{ act: 'copy-path', label: '复制路径', divider: true, svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
{ act: 'copy-relative-path', label: '复制相对路径', svg: '<path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/>' },
{ act: 'reveal', label: '在 Finder 中显示', svg: '<path d="M3 11.2V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v1.4"/><path d="M3.2 11.2h17.6c1.2 0 1.7.8 1.4 2l-.8 5c-.3 1.8-1.1 2.6-2.7 2.6H5.3c-1.6 0-2.4-.8-2.7-2.6l-.8-5c-.3-1.2.2-2 1.4-2Z"/><path d="M9.5 16h5"/>' },
{ act: 'rename', label: '重命名', divider: true, svg: '<path d="M5 21h14M6 14l9.5-9.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>' },
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

treeContextMenu.querySelectorAll('[data-tree-context-act="modify"], [data-tree-context-act="share"], [data-tree-context-act="template"]').forEach(button => {
  button.hidden = !isArtifactNode(target.node);
});
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

  const FILE_ACTION_ICONS = {
    chat: '<path d="M7.5 3.5h9A4.5 4.5 0 0 1 21 8v6.5a4.5 4.5 0 0 1-4.5 4.5h-1.7l-2.2 1.8a1 1 0 0 1-1.2 0L9.2 19H7.5A4.5 4.5 0 0 1 3 14.5V8a4.5 4.5 0 0 1 4.5-4.5Z"/><path d="M12 8.5v6M9 11.5h6"/>',
    reveal: '<path d="M3 9V7.5A3.5 3.5 0 0 1 6.5 4h2.6a1.5 1.5 0 0 1 1.1.5l1.6 1.8h5.7A3.5 3.5 0 0 1 21 9.8v6.7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5Z"/><path d="M3 10.5h18"/>',
    default: '<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/>',
    open: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M3 9h18"/>',
  };

  function renderFileActionsMenu(view = 'main') {
    const node = currentFileWorkspace()?.node;
    if (!node) return;
    const config = openWithConfig(node);
    if (view === 'apps') {
      fileActionsMenu.setAttribute('aria-label', '打开方式');
      fileActionsMenu.innerHTML = `<button class="file-actions-item" type="button" role="menuitem" data-file-action="back">` +
        `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span class="file-actions-label">打开方式</span></button>` +
        config.apps.map(([icon, label]) => `<button class="file-actions-item" type="button" role="menuitem" data-file-app="${esc(label)}">` +
          `<span class="file-actions-app-icon">${OPEN_WITH_ICONS[icon]}</span><span class="file-actions-label">${esc(label)}</span></button>`).join('');
      return;
    }
    fileActionsMenu.setAttribute('aria-label', '文件操作');
    fileActionsMenu.innerHTML = [
      ['chat', '添加到对话'],
      ['reveal', '在文件夹显示'],
      ['default', '默认打开方式', config.label],
      ['open', '打开方式', '›'],
    ].map(([action, label, detail], index) => `<button class="file-actions-item" type="button" role="menuitem" data-file-action="${action}"${index === 2 ? ' data-divider' : ''}>` +
      `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${FILE_ACTION_ICONS[action]}</svg>` +
      `<span class="file-actions-label">${label}</span>${detail ? `<span class="file-actions-detail">${esc(detail)}</span>` : ''}</button>`).join('');
  }

  function setFileActionsMenu(open) {
    fileActions.classList.toggle('open', open);
    fileActionsMenu.hidden = !open;
    fileActionsTrigger.setAttribute('aria-expanded', String(open));
    if (open) renderFileActionsMenu();
  }

  function renderToolFileWorkspace(item) {
    if (!item || item.kind !== 'file') return;
    artifactSelection?.cancel();
    const treeVisible = fileTreeVisible;
    const canToggleMode = supportsRenderedPreview(item.node);
    const hasVisualPreview = Boolean(item.node?.preview && PREVIEWS[item.node.preview.kind]);
    if (canToggleMode && item.previewMode !== 'source') item.previewMode = 'rendered';
    if (item.node?.preview?.kind === 'image' && item.previewMode !== 'artifact') item.previewMode = 'rendered';
    workbench.classList.toggle('file-split', treeVisible);
    workbench.classList.toggle('file-preview-only', !treeVisible);
    syncWorkbenchWidth();
    requestAnimationFrame(syncResizeLayout);
    syncFileTreeToggle();
    const editing = canToggleMode && item.previewMode === 'source';
    toolFileModeToggle.hidden = !canToggleMode || editing;
    toolFileModeToggle.textContent = '编辑代码';
    toolFileEditSave.hidden = !editing;
    toolFileEditDiscard.hidden = !editing;
    toolFileEditSave.disabled = !editing;
    toolFileShare.hidden = editing || !isArtifactNode(item.node);
    setFileActionsMenu(false);
    activeFilePath = treeVisible ? item.path || null : null;
    toolFilePreviewTitle.textContent = item.node ? item.node.name : '选择文件';
    fileActions.hidden = editing || !item.node;
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
    // 对话产物和摘要产物都是预览入口：先关闭共享目录树，再激活文件页签。
    fileTreeVisible = false;
    openFileWorkspace(node, chain, {
      path: null,
      previewMode: 'artifact',
    });
  }

  function taskForArtifact(chain) {
    const name = chain?.at(-1)?.name;
    return [...conversationExamples].find(([, example]) => example.folderId === chain?.[0]?.id && example.files.includes(name))?.[0] || null;
  }

  function sendFullscreenFileRequest() {
    const text = fullscreenChatInput.value.trim();
    const item = currentFileWorkspace();
    const references = artifactSelection?.entries().slice() || [];
    if ((!text && !references.length) || !item?.node) return;
    const task = taskForArtifact(item.chain);
    if (!task) {
      window.alert('此文件尚未关联到示例任务，无法发送到任务对话。输入内容已保留。');
      return;
    }
    const scrollPosition = toolFilePreviewBody.scrollTop;
    if (activeConversationTask !== task || conversationPage.hidden) {
      setConversationOpen(true, task);
      openArtifactPreview(item.node, item.chain);
      setWorkbenchExpanded(true);
      toolFilePreviewBody.scrollTop = scrollPosition;
    }
    const reference = `@${item.node.name}`;
    const message = { text: text.startsWith(reference) ? text.slice(reference.length).trim() : text,
      attachments: references.length ? [] : [{ node: item.node, chain: item.chain }], references };
    beginConversationTurn(message);
    artifactSelection?.clear();
    fullscreenChatInput.value = '';
    fullscreenChatInput.dispatchEvent(new Event('input', { bubbles: true }));
    fullscreenChatInput.focus();
  }

  function modifyArtifact(node, chain) {
    const task = taskForArtifact(chain);
    if (!task) {
      window.alert('此文件尚未关联到示例任务，当前原型无法将修改要求发往对话。');
      return;
    }
    setSummaryOpen(false);
    setConversationOpen(true, task);
    openArtifactPreview(node, chain);
    if (content.classList.contains('wb-expanded')) {
      // 主动全屏阅读时保留原预览；先收起工具区，让对话输入可见。
      setWorkbench(false);
    } else {
      setWorkbenchExpanded(false);
    }
    conversationPrompt.value = `${conversationPrompt.value.trimEnd()}${conversationPrompt.value ? '\n' : ''}@${node.name} 请修改：`;
    resizeConversationPrompt();
    conversationPrompt.focus();
    conversationPrompt.setSelectionRange(conversationPrompt.value.length, conversationPrompt.value.length);
  }

  const artifactShareAccess = document.getElementById('artifactShareAccess');
  const artifactSharePeople = document.getElementById('artifactSharePeople');
  const artifactShareHome = document.getElementById('artifactShareHome');
  const artifactShareMembers = document.getElementById('artifactShareMembers');
  const artifactShareBack = document.getElementById('artifactShareBack');
  const artifactShareClose = document.getElementById('artifactShareClose');
  const artifactShareTitle = document.getElementById('artifactShareTitle');
  const artifactShareMemberCount = document.getElementById('artifactShareMemberCount');
  const artifactShareMemberList = document.getElementById('artifactShareMemberList');
  const artifactShareMemberFeedback = document.getElementById('artifactShareMemberFeedback');
  const artifactSharePermission = document.getElementById('artifactSharePermission');
  const artifactShareFeedback = document.getElementById('artifactShareFeedback');
  const exampleShareMembers = [
    { name: '李白', avatar: '李', color: 'blue' },
    { name: '王安石', avatar: '王', color: 'indigo' },
    { name: '柳宗元', avatar: '柳', color: 'pink' }
  ];
  let shareMembers = [];

  function renderShareMembers() {
    artifactShareMemberCount.textContent = `成员 · ${shareMembers.length}位`;
    artifactShareMemberList.innerHTML = shareMembers.map((member, index) =>
      `<li class="share-member-row"><span class="share-avatar ${member.color}" aria-hidden="true">${member.avatar}</span>` +
      `<span class="share-member-name">${member.name}</span>` +
      `<button class="share-member-remove" type="button" data-share-member-index="${index}" aria-label="移除${member.name}">` +
      `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg></button></li>`
    ).join('');
    if (!shareMembers.length) artifactShareMemberList.innerHTML = '<li class="share-member-empty">暂无成员</li>';
    artifactSharePeople.innerHTML = shareMembers.slice(0, 2).map((member) =>
      `<span class="share-avatar ${member.color}" aria-hidden="true">${member.avatar}</span>`
    ).join('') + (shareMembers.length > 2 ? `<span class="share-avatar extra" aria-hidden="true">+${shareMembers.length - 2}</span>` : '') +
      `<span class="share-access-names">${shareMembers.length ? shareMembers.slice(0, 2).map((member) => member.name).join('、') + (shareMembers.length > 2 ? '等人' : '') : '暂无成员'}</span>`;
  }

  function setShareView(view) {
    const isMembers = view === 'members';
    artifactShareHome.hidden = isMembers;
    artifactShareMembers.hidden = !isMembers;
    artifactShareBack.hidden = !isMembers;
    artifactShareClose.hidden = isMembers;
    artifactShareTitle.textContent = isMembers ? '成员列表' : '分享';
    artifactShareAccess.setAttribute('aria-expanded', String(isMembers));
    (isMembers ? artifactShareBack : artifactShareAccess).focus({ preventScroll: true });
  }

  function shareArtifact(node) {
    document.getElementById('artifactShareFile').textContent = node.name;
    document.getElementById('artifactShareFileIcon').innerHTML = summaryArtifactIcon(artifactType(node));
    shareMembers = exampleShareMembers.map((member) => ({ ...member }));
    renderShareMembers();
    artifactSharePermission.value = 'view';
    artifactShareFeedback.hidden = true;
    artifactShareFeedback.textContent = '';
    artifactShareMemberFeedback.hidden = true;
    artifactShareMemberFeedback.textContent = '';
    artifactShareHome.hidden = false;
    artifactShareMembers.hidden = true;
    artifactShareBack.hidden = true;
    artifactShareClose.hidden = false;
    artifactShareTitle.textContent = '分享';
    artifactShareAccess.setAttribute('aria-expanded', 'false');
    artifactShareDialog.showModal();
  }
  toolFileShare.addEventListener('click', () => {
    const node = currentFileWorkspace()?.node;
    if (isArtifactNode(node)) shareArtifact(node);
  });
  artifactShareAccess.addEventListener('click', () => setShareView('members'));
  artifactShareBack.addEventListener('click', () => setShareView('home'));
  artifactShareMemberList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-share-member-index]');
    if (!button) return;
    const index = Number(button.dataset.shareMemberIndex);
    const [removed] = shareMembers.splice(index, 1);
    if (!removed) return;
    renderShareMembers();
    artifactShareMemberFeedback.textContent = `已从当前预览移除${removed.name}，实际访问权限未更改。`;
    artifactShareMemberFeedback.hidden = false;
    const nextButton = artifactShareMemberList.querySelectorAll('.share-member-remove')[Math.min(index, shareMembers.length - 1)];
    (nextButton || artifactShareBack).focus({ preventScroll: true });
  });
  function showShareFeedback(message) {
    artifactShareFeedback.textContent = message;
    artifactShareFeedback.hidden = false;
  }
  artifactSharePermission.addEventListener('change', () => {
    showShareFeedback(`已选择${artifactSharePermission.selectedOptions[0].textContent}（仅用于界面预览，实际权限未更改）。`);
  });
  artifactShareDialog.querySelectorAll('[data-share-channel]').forEach((button) => {
    button.addEventListener('click', () => showShareFeedback(`当前原型尚未接入${button.dataset.shareChannel}分享，未发送文件。`));
  });
  document.getElementById('artifactShareCopy').addEventListener('click', () => {
    showShareFeedback('当前原型尚未生成文件分享链接，未复制任何内容。');
  });
  artifactShareClose.addEventListener('click', () => artifactShareDialog.close());
  artifactShareDialog.addEventListener('click', (event) => {
    if (event.target === artifactShareDialog) artifactShareDialog.close();
  });
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
    if (cell && !item.node.preview.referenceDemo) selectExcelCell(cell);
  });

  function selectExcelCell(cell) {
    toolFilePreviewBody.querySelector('.excel-grid td.selected')?.classList.remove('selected');
    cell.classList.add('selected');
    toolFilePreviewBody.querySelector('[data-excel-address]:not(td)').textContent = cell.dataset.excelAddress;
    toolFilePreviewBody.querySelector('[data-excel-value]').textContent = cell.textContent;
  }

  function editExcelCell(cell) {
    const item = currentFileWorkspace();
    if (item?.node?.preview?.referenceDemo) return;
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

  function showFileDetails(title, body) {
    fileDetailsTitle.textContent = title;
    fileDetailsContent.innerHTML = body;
    fileDetailsDialog.showModal();
  }

  function pathForFile(folder, node, parent = 'root') {
    for (const [index, child] of (folder.files || []).entries()) {
      const path = `${parent}.${index}`;
      if (child === node) return path;
      const nested = pathForFile(child, node, path);
      if (nested) return nested;
    }
    return null;
  }

  function revealCurrentFile() {
    const item = currentFileWorkspace();
    if (!item?.node) return;
    const folder = item.chain?.[0] || activeToolFolder();
    const path = pathForFile(folder, item.node);
    if (!path) {
      showFileDetails('在文件夹显示', '<p>当前原型没有此文件对应的目录位置，暂时无法定位。</p>');
      return;
    }
    if (folder.id !== activeToolFolder().id) selectFolder(folder.id);
    // 展开文件所在的层级，并在右侧目录树中选中对应条目。
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i += 1) toolTreeExpanded.add(parts.slice(0, i).join('.'));
    item.path = `${folder.id}:${path}`;
    fileTreeVisible = true;
    keepWorkbenchVisibleDuringTransition();
    renderToolFileWorkspace(item);
    requestAnimationFrame(() => toolFileTree.querySelector('.tool-tree-row.selected')?.scrollIntoView({ block: 'nearest' }));
  }

  function openCurrentFileWith(appName) {
    const item = currentFileWorkspace();
    if (!item?.node) return;
    showFileDetails('打开文件', `<p>将使用 ${esc(appName)} 打开「${esc(item.node.name)}」。</p><p>当前是交互原型，尚未连接本地应用，未实际打开文件。</p>`);
  }

  fileActionsTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setFileActionsMenu(fileActionsMenu.hidden);
    if (!fileActionsMenu.hidden) fileActionsMenu.querySelector('[role="menuitem"]')?.focus();
  });
  fileActionsMenu.addEventListener('click', (event) => {
    const target = event.target.closest('[data-file-app], [data-file-action]');
    if (!target) return;
    event.stopPropagation();
    const item = currentFileWorkspace();
    if (!item?.node) return;
    const action = target.dataset.fileAction;
    if (action === 'open' || action === 'back') {
      renderFileActionsMenu(action === 'open' ? 'apps' : 'main');
      fileActionsMenu.querySelector('[role="menuitem"]')?.focus();
      return;
    }
    setFileActionsMenu(false);
    if (target.dataset.fileApp) openCurrentFileWith(target.dataset.fileApp);
    else if (action === 'chat') appendFileToConversation(item.node);
    else if (action === 'reveal') revealCurrentFile();
    else if (action === 'default') openCurrentFileWith(openWithConfig(item.node).label);
  });
  fileActionsMenu.addEventListener('keydown', (event) => {
    const items = Array.from(fileActionsMenu.querySelectorAll('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && fileActionsMenu.getAttribute('aria-label') === '打开方式') {
      event.preventDefault();
      renderFileActionsMenu();
      fileActionsMenu.querySelector('[data-file-action="open"]')?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!fileActions.contains(event.target)) setFileActionsMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || fileActionsMenu.hidden) return;
    setFileActionsMenu(false);
    fileActionsTrigger.focus();
  });
  document.getElementById('fileDetailsClose').addEventListener('click', () => fileDetailsDialog.close());
  fileDetailsDialog.addEventListener('click', (event) => {
    if (event.target === fileDetailsDialog) fileDetailsDialog.close();
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
case 'modify':
modifyArtifact(node, target.chain);
break;
case 'share':
shareArtifact(node);
break;
case 'template':
createTemplateFromArtifact(node, target.chain);
break;
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

  fileTreeToggle.addEventListener('click', () => {
    const panelVisible = content.classList.contains('wb-open') && !content.classList.contains('wb-auto-collapsed');
    if (rightPanel === 'tree' && panelVisible) {
      setRightPanel(null);
      return;
    }
    if (rightPanel === 'landing' && panelVisible) {
      fileTreeVisible = !fileTreeVisible;
      if (fileTreeVisible) keepWorkbenchVisibleDuringTransition();
      workbench.classList.toggle('file-split', fileTreeVisible);
      workbench.classList.toggle('file-preview-only', !fileTreeVisible);
      syncWorkbenchWidth();
      syncResizeLayout();
      return;
    }
    if (rightPanel === 'tools' && panelVisible) {
      fileTreeVisible = !fileTreeVisible;
      if (fileTreeVisible) keepWorkbenchVisibleDuringTransition();
      if (currentFileWorkspace()) renderToolFileWorkspace(currentFileWorkspace());
      else {
        workbench.classList.toggle('file-split', fileTreeVisible);
        workbench.classList.toggle('file-preview-only', !fileTreeVisible);
        syncResizeLayout();
      }
      return;
    }
    // 未打开工具工作区时只呈现文件树，不附带页签或预览。
    renderToolTree();
    setRightPanel('tree');
  });

  renderToolTree();
  activateWorkspace('file-default', false);
  renderWorkbenchLandingRecents();

  /* ---------- 5.6 案例详情弹窗 ----------
     所有卡片共用一个 dialog：卡片只保存当前场景内的索引，打开时再从
     单一数据源读取标题、类型、Prompt 和视觉图，避免在 DOM 中复制长文本。 */
  const caseDialog = document.getElementById('caseDialog');
  const caseDialogClose = document.getElementById('caseDialogClose');
  const caseDialogVisual = document.getElementById('caseDialogVisual');
  const caseDialogType = document.getElementById('caseDialogType');
  const caseDialogTitle = document.getElementById('caseDialogTitle');
  const caseDialogPrompt = document.getElementById('caseDialogPrompt');
  const caseDialogPromptCopy = document.getElementById('caseDialogPromptCopy');
  const caseDialogSkill = document.getElementById('caseDialogSkill');
  const caseDialogSkillAction = document.getElementById('caseDialogSkillAction');
  const caseDialogSkillUse = document.getElementById('caseDialogSkillUse');
  const caseDialogArtifact = document.getElementById('caseDialogArtifact');
  const caseDialogArtifactIcon = document.getElementById('caseDialogArtifactIcon');
  const caseIconByKind = { dashboard: 'excel', article: 'doc', deck: 'ppt', web: 'html', app: 'html', code: 'html', visual: 'image' };
  const caseDialogDownload = document.getElementById('caseDialogDownload');
  const caseDialogAttach = document.getElementById('caseDialogAttach');
  const caseDialogPrimary = document.getElementById('caseDialogPrimary');
  const caseSkills = {
    dashboard: 'data-analysis', article: 'docx', deck: 'pptx',
    web: 'website-development', app: 'app-development', code: 'code-development', visual: 'visual-design',
  };
  let activeCase = null;
  let caseReturnFocus = null;
  let casePromptCopyTimer;

  caseDialogPromptCopy.addEventListener('click', async () => {
    if (!activeCase) return;
    try {
      await navigator.clipboard.writeText(caseDialogPrompt.textContent);
      caseDialogPromptCopy.title = '已复制';
      caseDialogPromptCopy.setAttribute('aria-label', 'Prompt 已复制');
    } catch (error) {
      caseDialogPromptCopy.title = '复制失败';
      caseDialogPromptCopy.setAttribute('aria-label', '复制失败，请重试');
    }
    clearTimeout(casePromptCopyTimer);
    casePromptCopyTimer = setTimeout(() => {
      caseDialogPromptCopy.title = '复制 Prompt';
      caseDialogPromptCopy.setAttribute('aria-label', '复制 Prompt');
    }, 2000);
  });

  function updateCaseSkillAction() {
    const skill = caseDialogSkill.textContent;
    const installed = installedAddItems.skill.includes(skill);
    caseDialogSkillAction.querySelector('path').setAttribute('d', installed ? 'm5 12 4.5 4.5L19 7' : 'M12 5v14M5 12h14');
    caseDialogSkillAction.disabled = installed;
    caseDialogSkillAction.title = installed ? '已安装' : '安装';
    caseDialogSkillAction.setAttribute('aria-label', installed ? `${skill}已安装` : `安装${skill}`);
  }

  caseDialogSkillAction.addEventListener('click', () => {
    const skill = caseDialogSkill.textContent;
    if (!activeCase || installedAddItems.skill.includes(skill)) return;
    installedAddItems.skill.push(skill);
    updateCaseSkillAction();
  });

  caseDialogSkillUse.addEventListener('click', () => {
    if (!activeCase) return;
    const skill = caseDialogSkill.textContent;
    if (!installedAddItems.skill.includes(skill)) installedAddItems.skill.push(skill);
    const input = conversationPage.hidden ? prompt : conversationPrompt;
    addSkillTag(input, skill);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeCaseDialog();
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  function openCaseDialog(item, trigger) {
    if (!item) return;
    activeCase = item;
    if (!caseDialog.open) caseReturnFocus = trigger;
    caseDialogVisual.innerHTML = caseArtifact(item);
    caseDialogVisual.dataset.kind = item.kind;
    caseDialogType.textContent = item.type;
    caseDialogTitle.textContent = item.title;
    caseDialogSkill.textContent = caseSkills[item.kind] || 'content-creation';
    updateCaseSkillAction();
    caseDialogSkillUse.setAttribute('aria-label', `立即使用${caseDialogSkill.textContent}`);
    caseDialogPrompt.textContent = item.prompt;
    clearTimeout(casePromptCopyTimer);
    caseDialogPromptCopy.title = '复制 Prompt';
    caseDialogPromptCopy.setAttribute('aria-label', '复制 Prompt');
    caseDialogArtifact.textContent = item.title;
    caseDialogArtifactIcon.src = `assets/artifact-${caseIconByKind[item.kind] || 'doc'}.svg`;
    document.querySelectorAll('.case.is-selected').forEach(card => card.classList.remove('is-selected'));
    if (trigger?.classList.contains('case')) trigger.classList.add('is-selected');
    if (!caseDialog.open) caseDialog.showModal();
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

  function casePreviewHtml(item) {
    const css = [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules].filter(rule => rule.selectorText === ':root' || /artifact-|case-artifact/.test(rule.cssText)).map(rule => rule.cssText); }
      catch (_) { return []; }
    }).join('\n');
    const markup = caseArtifact(item);
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(item.title)}</title><style>${css}\nbody{margin:0;padding:32px;background:#f6f6f8;font-family:Arial,sans-serif}.case-artifact{width:min(720px,100%);height:640px;margin:auto}</style><div id="preview">${markup}</div></html>`;
  }

  caseDialogDownload.addEventListener('click', () => {
    if (!activeCase) return;
    const url = URL.createObjectURL(new Blob([casePreviewHtml(activeCase)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeCase.title.replace(/[\\/:*?"<>|]/g, '-')}-预览.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function attachCaseArtifact(item, input) {
    const entries = selectedLibraryFiles.get(input);
    const caseKey = `${item.kind}:${item.title}:${item.prompt}`;
    if (entries.some(entry => entry.caseKey === caseKey)) return;
    const node = {
      name: `${item.title.replace(/[\\/:*?"<>|]/g, '-')}-预览.html`,
      type: 'html',
      preview: { kind: 'html', html: casePreviewHtml(item) },
    };
    entries.push({ node, chain: [node], caseKey });
    renderLibraryFileCards(input);
  }

  caseDialogAttach.addEventListener('click', () => {
    if (!activeCase) return;
    const input = conversationPage.hidden ? prompt : conversationPrompt;
    attachCaseArtifact(activeCase, input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeCaseDialog();
    input.focus();
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
    const skill = caseDialogSkill.textContent;
    if (!installedAddItems.skill.includes(skill)) installedAddItems.skill.push(skill);
    setPromptGuide('');
    prompt.value = activeCase.prompt;
    clearSkillTags(prompt);
    addSkillTag(prompt, skill);
    attachCaseArtifact(activeCase, prompt);
    prompt.dispatchEvent(new Event('input', { bubbles: true }));
    closeCaseDialog();
    requestAnimationFrame(() => {
      prompt.focus();
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    });
  });

  /* 点击摘要中的产物后关闭浮窗，并复用工具工作区已有的文件预览。 */

  function openFileFromSummary(node, chain) {
    setSummaryOpen(false);
    openArtifactPreview(node, chain);
  }

  function handleSummaryFileClick(event) {
    const row = event.target.closest('.summary-file-row');
    if (!row || !fileGrid.contains(row)) return;
    const scheduled = !conversationPage.hidden && scheduledRunTasks.has(activeConversationTask);
    const example = scheduled ? conversationExamples.get(activeConversationTask) : null;
    const node = scheduled ? example?.fileNodes?.[Number(row.dataset.fileIndex)] : currentNode()?.files?.[Number(row.dataset.fileIndex)];
    const folder = scheduled ? FOLDERS.find(entry => entry.id === example.folderId) : null;
    const entry = node && { node, chain: scheduled ? [folder, node] : filePath.concat(node) };
    if (!entry?.node) return;
    const more = event.target.closest('.summary-file-more');
    if (more) {
      const rect = more.getBoundingClientRect();
      openTreeContextMenu({ clientX: rect.right, clientY: rect.bottom + 4, above: rect.top - 4 }, row, { node: entry.node, chain: entry.chain });
      return;
    }
    if (event.target.closest('.fitem')) openFileFromSummary(entry.node, entry.chain);
  }

  fileGrid.addEventListener('click', handleSummaryFileClick);

  /* ---------- 5.6 示例对话 ----------
     选中左侧指定任务后，首页让位给对应对话；对话和产物面板打开的文件
     统一进入右侧页签，并在本次对话中保留到用户手动关闭。 */
const mainView = document.querySelector('.main');
  const conversationThread = document.getElementById('conversationThread');
  const conversationScroll = document.getElementById('conversationScroll');
  const conversationTurnNav = document.getElementById('conversationTurnNav');
  const conversationPrompt = document.getElementById('conversationPrompt');
  const conversationGoalTag = document.getElementById('conversationGoalTag');
  const conversationComposer = document.getElementById('conversationComposer');
  const conversationSend = document.getElementById('conversationSend');
  const conversationTask = document.getElementById('demoConversationTask');
  const retailConversationTask = document.getElementById('retailFirstConversationTask');
  const membershipResearchTask = document.getElementById('membershipResearchTask');
  const scheduledReportTask = document.getElementById('scheduledReportTask');
  const conversationSubagents = [
    { work: '合并各门店履约明细', state: 'done', detail: '已按订单与门店归并明细，统一事件时间字段，供后续异常识别和核验使用。' },
    { work: '定位异常订单的集中时段', state: 'running', detail: '正在对照订单事件日志，定位超时与出餐延迟的集中时段；未核实的原因暂不写成结论。' },
    { work: '复核履约指标统计口径', state: 'running', detail: '正在核对订单去重、时间戳对齐及分时段阈值，确保看板与异常明细的统计口径一致。' },
  ];
  const artifactEditingTask = document.getElementById('artifactEditingTask');
  const conversationExamples = new Map([
    [artifactEditingTask, {
      folderId:'default',
      turns:[{prompt:'把季度经营数据和复盘要点整理成汇报 PPT，附上经营数据表和复盘说明，方便我继续调整。',
        reply:'已整理好季度复盘初稿，按经营概况、区域表现和行动计划组织，共 5 页。华东区域履约率偏低，具体原因仍需核对。\n\n打开产物后，可以选择 PPT 页面或框选局部、选中表格区域、划选文档文字，再点击「添加到对话」，围绕所选内容提出修改要求。'}],
      files:['季度经营复盘.pptx','季度经营数据.xlsx','季度经营复盘说明.docx'],
    }],
    [conversationTask, {
      folderId: 'default',
      goal: '基于订单履约事件日志建立可复算的异常识别流程：按订单 ID 去重，对齐接单、到店、出餐与交接时间戳；超时阈值按时段和门店配置，缺失时间戳单列待核验。输出异常明细时保留原始事件 ID、规则版本、优先级计算依据和责任方待确认标记，确保看板指标可追溯到明细。',
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
          prompt: '基于订单履约事件日志建立可复算的异常识别流程：按订单 ID 去重，对齐接单、到店、出餐与交接时间戳；超时阈值按时段和门店配置，缺失时间戳单列待核验。输出异常明细时保留原始事件 ID、规则版本、优先级计算依据和责任方待确认标记，确保看板指标可追溯到明细。',
          isGoal: true,
          reply: '目标已设置。后续统计与产物将沿用这套事件口径；缺失字段不会被推断为确定的责任归属。',
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
          prompt: '这是异常趋势截图，帮我核对晚高峰的变化。',
          attachments: ['履约异常趋势.png'],
          reply: '从截图看，17:00–19:00 的超时单量明显抬升。我会对照订单事件日志确认峰值和实际超时单量，不把截图中的视觉趋势直接当作统计结论。',
        },
        {
          prompt: '明细表和分析文档也发你了，结合两份材料给出处理建议。',
          attachments: ['门店履约异常明细.xlsx', '门店履约分析.docx'],
          reply: '收到两份文件。我会先核对明细表中的订单和时间戳，再对照分析文档中的结论；存在缺失记录的订单单独标记，不直接归责。',
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
          prompt: '结合前面发的趋势图和异常明细文件，确认哪些门店需要优先跟进。',
          reply: '',
        },
      ],
      files: ['门店履约异常看板.html', '门店履约异常明细.xlsx', '门店履约分析.docx'],
    }],
    [membershipResearchTask, {
      folderId: 'default',
      turns: [
        { prompt: '调研竞品在会员权益上的差异，看看我们还缺什么。',
          reply: '我先按价格、折扣、积分和专属服务整理了竞品会员权益。初稿中有些权益属于限时活动，且各品牌会员等级不同，目前只能作为线索，不能直接判断谁更有优势。' },
        { prompt: '别只列权益。把入会门槛、权益使用条件和限制也放到一起比；过期活动不要算常驻权益。',
          reply: '已把一次性活动单列，并按会员等级、入会成本、使用门槛、有效期和适用渠道统一口径。原先“竞品折扣力度更大”的判断缺少同等级、同渠道证据，已改为待核实。' },
        { prompt: '这样好一些。结论别笼统说我们落后，要指出哪个用户场景缺权益、依据是什么。',
          reply: '已按新客入会、老客复购和高频用户三个场景重写差异：每条判断都附上对比口径和证据状态；缺少公开规则的权益保留“待核实”，不推断实际可用性。' },
        { prompt: '这一版可以，口径和结论都比之前清楚多了。',
          reply: '好的，这版会保留可比口径、用户场景和待核实项，方便后续查看。' },
      ],
      files: [],
    }],
    [retailConversationTask, {
      folderId: 'retail',
      prompt: '请配置并校验 AI 工具约束文件，整理成一份报告。',
      reply: '已完成 AI 工具约束文件的配置与校验，并生成配置报告。',
      files: ['AI 工具约束配置报告.docx'],
    }],
  ]);
  const scheduledRunSpecs = [
    { date: '2026-09-28 09:00', status: 'new', period: '9 月 21 日至 9 月 27 日', brief: '已完成本周门店履约数据汇总与异常复盘，形成下周跟进清单。', result: '履约数据汇总与异常复盘', risk: '晚高峰配送超时仍需观察', next: '逐单核对异常原因并更新看板', completed: 4, pending: 2, reply: '已生成本周工作周报。完成门店履约数据汇总、异常订单复盘与跟进清单整理；晚高峰配送超时仍需观察。下周将逐单核对异常原因并更新看板。' },
    { date: '2026-09-25 09:00', status: '', period: '9 月 18 日至 9 月 24 日', brief: '完成门店履约异常梳理和供应商报价对比，待核对晚高峰运力波动。', result: '履约异常梳理与供应商报价对比', risk: '晚高峰运力波动', next: '核对订单明细与责任方', completed: 3, pending: 2, reply: '已生成工作周报：完成门店履约异常梳理和供应商报价对比；风险是晚高峰运力波动，下周继续核对订单明细与责任方。' },
    { date: '2026-09-21 09:00', status: '', period: '9 月 14 日至 9 月 20 日', brief: '完成履约数据汇总和异常订单复盘，配送高峰超时问题仍需跟进。', result: '履约数据汇总与异常订单复盘', risk: '配送高峰超时', next: '核对异常原因并更新看板', completed: 3, pending: 1, reply: '已生成本周工作周报。主要成果是完成履约数据汇总、复盘异常订单并整理后续跟进清单；配送高峰的超时问题仍需持续观察。下周计划是核对异常原因并更新看板。' },
    { date: '2026-09-17 10:41', status: '', period: '9 月 10 日至 9 月 16 日', brief: '门店数据清洗和周报模板调整已完成，部分历史记录仍需补齐。', result: '门店数据清洗与周报模板调整', risk: '部分历史记录缺少时间戳', next: '补齐记录后复核异常比例', completed: 2, pending: 1, reply: '已汇总工作进度：门店数据清洗和周报模板调整已完成；部分历史记录缺少时间戳，建议下周补齐后再确认异常比例。' },
    { date: '2026-09-14 09:00', status: '', period: '9 月 7 日至 9 月 13 日', brief: '形成供应链风险预案初稿并整理门店巡检记录，待确认供应商交期。', result: '供应链预案与门店巡检记录', risk: '供应商交期尚未确认', next: '统一巡检字段并推进预案评审', completed: 2, pending: 2, reply: '本周完成供应链风险预案初稿与门店巡检记录整理。待跟进事项包括供应商交期确认和巡检表字段统一；下周继续推进预案评审。' },
    { date: '2026-09-07 09:00', status: '', period: '8 月 31 日至 9 月 6 日', brief: '完成任务范围确认和周报模板搭建，下一周开始按门店跟踪进度。', result: '任务范围确认与周报模板搭建', risk: '暂无阻塞风险', next: '按门店和项目跟踪进度', completed: 2, pending: 0, reply: '首期工作周报已生成：完成任务范围确认和周报模板搭建；暂无阻塞风险。下周开始按门店和项目跟踪进度。' },
  ];
  const scheduledRuns = scheduledRunSpecs.map((run, index) => {
    const day = run.date.slice(8, 10);
    const artifactName = `${run.date.slice(0, 4)}年${run.date.slice(5, 7)}月Week${Math.ceil(Number(day) / 7)}数据-${run.date.slice(5, 7)}${day}.xlsx`;
    const artifactNode = {
      name: artifactName, type: 'excel', artifact: true,
      preview: { kind: 'excel', sheets: [
        { name: '工作概览', columns: ['统计周期', '主要成果', '完成事项', '待跟进事项'], rows: [[run.period, run.result, String(run.completed), String(run.pending)]] },
        { name: '风险与计划', columns: ['问题风险', '下周计划'], rows: [[run.risk, run.next]] },
      ] },
    };
    FOLDERS.find(folder => folder.id === 'default').files.push(artifactNode);
    const task = index === 2 ? scheduledReportTask : document.createElement('a');
    if (task !== scheduledReportTask) {
      const name = document.createElement('span');
      name.className = 'task-name';
      name.textContent = scheduledReportTask.querySelector('.task-name').textContent;
      task.append(name);
    }
    const time = `${run.date.slice(0, 10)}T${run.date.slice(11)}:00+08:00`;
    conversationExamples.set(task, {
      folderId: 'default',
      turns: [{
        prompt: `请生成${run.period}的工作周报，汇总工作进度、主要成果、问题风险和下周计划。`,
        reply: `${run.reply}\n\n已生成产物：${artifactName}。`,
        sentAt: time,
      }],
      files: [artifactName],
      fileNodes: [artifactNode],
    });
    return { ...run, task, artifactNode };
  });
  const scheduledRunTasks = new Set(scheduledRuns.map(run => run.task));
  const createdScheduledTasks = new Map();
  // 总览页的示例任务沿用现有定时任务数据结构，因此卡片、侧栏和对话指向同一任务。
  const scheduledPageSeedSpecs = [
    { name:'整理门店异常跟进日报', schedule:'工作日 19:00', description:'整理今天的工作日志、对话和产物，汇总已完成事项与明日待办，生成简洁的工作日报。', reply:'今天的工作日报已生成：已整理门店履约数据与异常跟进记录，明日继续核对晚高峰订单。', state:'running', runDate:'10月21日 19:00' },
    { name:'提醒今日会议与待办', schedule:'每日 08:30', description:'每天早上汇总今日日程、临近截止的任务和需要提前准备的资料，给出一份简短提醒。', reply:'今日日程已整理：优先处理门店履约复盘、供应商报价确认与下午的项目沟通。', runDate:'10月22日 08:30' },
    { name:'汇总供应链项目进展', schedule:'每周一 10:00', description:'每周汇总各项目的完成进度、阻塞问题与下一步行动，列出需要我确认的事项。', reply:'本周项目进展已整理：门店履约复盘进入核验阶段，供应链预案待评审。', state:'warning', runDate:'10月19日 10:00' },
    { name:'提醒核对上月经营数据', schedule:'每月 1 日 09:00', description:'每月提醒我核对上月经营数据、待完成事项和本月关键节点。', reply:'月度经营提醒已准备，待启用后按月运行。', paused:true },
  ];
  scheduledPageSeedSpecs.forEach((spec) => {
    const task = document.createElement('a');
    task.className = 'task flush scheduled-page-seed';
    task.href = '#';
    task.dataset.taskType = 'scheduled';
    task.dataset.openConversation = '';
    task.innerHTML = '<span class="task-name"></span><span class="task-state"></span>';
    task.querySelector('.task-name').textContent = spec.name;
    looseTasksInner.append(task);
    taskHomes.set(task, { parent:task.parentElement, next:task.nextSibling });
    taskIds.set(task, `demo-scheduled-${nextTaskId++}`);
    createdScheduledTasks.set(task, {
      name:spec.name, description:spec.description, schedule:spec.schedule,
      folderId:'default', push:false, channels:[], paused:Boolean(spec.paused), demoState:spec.state || '', demoRunDate:spec.runDate || '',
    });
    scheduledRunTasks.add(task);
    conversationExamples.set(task, {
      folderId:'default', turns:[{ prompt:spec.description, reply:spec.reply }], files:[],
    });
  });
  const weeklyReportPrompt = '请以本周一至周日为统计周期，汇总与门店经营、履约、供应商协作相关的任务、对话和产物，生成工作周报。先按项目列出已完成事项、关键进展和结果，注明数据口径与来源；再整理未完成事项、异常订单、延期原因和责任人，区分已解决、待跟进与需要我确认的项目。对同比或环比变化给出解释，不要凭空补全缺失数据。提出下周三项优先行动，写明完成时间、依赖条件和风险应对。附上一页摘要，将明细整理为可查看的表格，保持表达简洁。';
  const legacyScheduledConfig = {
    description: weeklyReportPrompt,
    schedule: '每周一 09:00', folderId: 'default', push: false, channels: ['feishu'], feishuRecipients: ['yibao'],
  };
  let selectedScheduledTask = scheduledReportTask;
  renderToolTree();
  function scheduledRunLabel(dateText) {
    const runDate = new Date(`${dateText.replace(' ', 'T')}:00+08:00`);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - runDate) / 60000);
    if (elapsedMinutes >= 0 && elapsedMinutes < 60) return `${Math.max(1, elapsedMinutes)}分钟前`;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const runDay = new Date(runDate.getFullYear(), runDate.getMonth(), runDate.getDate());
    if (day - runDay === 86400000) return `昨天 ${dateText.slice(11)}`;
    return `${Number(dateText.slice(5, 7))}月${Number(dateText.slice(8, 10))}日 ${dateText.slice(11)}`;
  }
  function renderScheduledRunList() {
    const hasUnreadRun = scheduledRuns.some(run => run.status === 'new');
    const sidebarState = scheduledReportTask.querySelector('.task-state');
    let unreadDot = sidebarState.querySelector('.dot-new');
    if (hasUnreadRun && !unreadDot) {
      unreadDot = document.createElement('i');
      unreadDot.className = 'dot-new';
      unreadDot.setAttribute('role', 'img');
      unreadDot.setAttribute('aria-label', '新消息');
      unreadDot.title = '新消息';
      sidebarState.append(unreadDot);
    } else if (!hasUnreadRun) {
      unreadDot?.remove();
    }
    if (hasUnreadRun) scheduledReportTask.dataset.state = 'new';
    else delete scheduledReportTask.dataset.state;
    if (createdScheduledTasks.has(selectedScheduledTask)) {
      const runDate = createdScheduledTasks.get(selectedScheduledTask)?.demoRunDate;
      document.getElementById('scheduledRunList').innerHTML = runDate
        ? `<div class="scheduled-run is-current"><button class="scheduled-run-open" type="button" data-scheduled-demo-run aria-current="page"><span>${esc(runDate)}</span></button></div>`
        : '<p class="scheduled-run-empty">尚无运行记录</p>';
      return;
    }
    document.getElementById('scheduledRunList').innerHTML = scheduledRuns.map((run, index) =>
      `<div class="scheduled-run${activeConversationTask === run.task ? ' is-current' : ''}">` +
      `<button class="scheduled-run-open" type="button" data-scheduled-run="${index}"` +
      `${activeConversationTask === run.task ? ' aria-current="page"' : ''}>` +
      `<span>${esc(scheduledRunLabel(run.date))}</span>` +
      `<span class="scheduled-run-status" aria-hidden="true">${run.status === 'running' ? '<img class="is-loading" src="assets/scheduled-panel-loading.svg" alt="">' : run.status === 'new' ? '<img src="assets/scheduled-panel-status.svg" alt="">' : ''}</span></button>` +
      `<button class="scheduled-run-more" type="button" data-scheduled-run-more="${index}" title="更多操作" aria-label="${esc(scheduledRunLabel(run.date))}运行记录的更多操作">` +
      '<img src="assets/scheduled-panel-more.svg" alt="" width="16" height="16"></button></div>'
    ).join('');
  }
  document.getElementById('scheduledRunList').addEventListener('click', event => {
    if (event.target.closest('[data-scheduled-demo-run]')) {
      setConversationOpen(true, selectedScheduledTask);
      return;
    }
    const row = event.target.closest('[data-scheduled-run]');
    if (!row) return;
    const run = scheduledRuns[Number(row.dataset.scheduledRun)];
    selectedScheduledTask = scheduledReportTask;
    if (run) setConversationOpen(true, run.task);
  });
  const scheduledEdit = document.getElementById('scheduledEdit');
  const scheduledMore = document.getElementById('scheduledMore');
  const scheduledMoreMenu = document.getElementById('scheduledMoreMenu');
  const scheduledEnabled = document.getElementById('scheduledEnabled');
  function setScheduledMoreOpen(open) {
    scheduledMoreMenu.hidden = !open;
    scheduledMore.setAttribute('aria-expanded', String(open));
  }
  function runScheduledTaskNow(task) {
    const config = createdScheduledTasks.get(task) || legacyScheduledConfig;
    if (config.paused || config.terminated || config.demoState === 'running') return;
    const run = task === scheduledReportTask ? scheduledRuns[0] : null;
    config.demoState = 'running';
    if (run) run.status = 'running';
    setConversationOpen(true, run ? run.task : task);
    setScheduledPanelOpen(true);
    renderScheduledRunList();
    renderScheduledOverview();
    setTimeout(() => {
      if (!task.isConnected) return;
      config.demoState = '';
      const now = new Date();
      config.demoRunDate = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (run) run.status = activeConversationTask === run.task && !conversationPage.hidden ? '' : 'new';
      if (selectedScheduledTask === task) showScheduledTaskDetails(task);
      renderScheduledRunList();
      renderScheduledOverview();
    }, 900);
  }
  document.getElementById('scheduledRunNow').addEventListener('click', () => runScheduledTaskNow(selectedScheduledTask));
  scheduledMore.addEventListener('click', event => {
    event.stopPropagation();
    setScheduledMoreOpen(scheduledMoreMenu.hidden);
  });
  document.addEventListener('click', event => {
    if (!scheduledMoreMenu.hidden && !event.target.closest('#scheduledMoreMenu')) setScheduledMoreOpen(false);
  });
  const scheduledEditForm = document.getElementById('scheduledEditForm');
  const scheduledEditDrawer = document.getElementById('scheduledEditDrawer');
  const scheduledEditBackdrop = document.getElementById('scheduledEditBackdrop');
  const scheduledPushEnabled = document.getElementById('scheduledPushEnabled');
  const scheduledChannelSetup = document.getElementById('scheduledChannelSetup');
  const scheduledChannelManual = document.getElementById('scheduledChannelManual');
  const scheduledChannelQr = document.getElementById('scheduledChannelQr');
  const scheduledChannelFeedback = document.getElementById('scheduledChannelFeedback');
  const scheduledFeishuPanel = document.getElementById('scheduledChannelFeishu');
  const scheduledChannelBinding = document.getElementById('scheduledChannelBinding');
  const scheduledChannelMethods = document.getElementById('scheduledChannelMethods');
  const scheduledFeishuSearch = document.getElementById('scheduledFeishuSearch');
  const scheduledFeishuSelectedOnly = document.getElementById('scheduledFeishuSelectedOnly');
  const scheduledFeishuRecipientRows = Array.from(document.querySelectorAll('.scheduled-feishu-recipient'));
  const scheduledChannelNames = { feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉' };
  const scheduledChannelOrder = Object.keys(scheduledChannelNames);
  const scheduledChannelInputs = Array.from(scheduledEditDrawer.querySelectorAll('[data-scheduled-channel]'));
  const scheduledChannelExpandButtons = Array.from(scheduledEditDrawer.querySelectorAll('[data-scheduled-expand]'));
  const scheduledChannelSelectionFeedback = document.getElementById('scheduledChannelSelectionFeedback');
  const scheduledConnections = new Map();
  const scheduledConnectionMethods = new Map([['feishu', 'qr'], ['wecom', 'qr'], ['dingtalk', 'qr']]);
  let selectedScheduledChannels = new Set(['feishu']);
  let expandedScheduledChannel = 'feishu';
  let selectedFeishuRecipients = new Set(['yibao']);
  let feishuConnected = true;
  let scheduledDrawerMode = 'edit';
  let scheduledEditReturnFocus = null;
  const scheduledProjectSelect = scheduledEditForm.elements.namedItem('project');
  scheduledProjectSelect.innerHTML = FOLDERS.map(folder => `<option value="${esc(folder.id)}">${esc(folder.name)}</option>`).join('');
  function updateScheduledFieldCounts() {
    document.getElementById('scheduledNameCount').textContent = `${scheduledEditForm.elements.namedItem('name').value.length}/100`;
    document.getElementById('scheduledPromptCount').textContent = `${scheduledEditForm.elements.namedItem('prompt').value.length}/20000`;
    document.getElementById('scheduledDrawerSubmit').disabled = !scheduledEditForm.elements.namedItem('name').value.trim() || !scheduledEditForm.elements.namedItem('prompt').value.trim();
  }
  function updateScheduledCustomRows() {
    const repeat = scheduledEditForm.elements.namedItem('repeat').value;
    document.getElementById('scheduledCustomRows').hidden = repeat !== '自定义';
    const cadence = scheduledEditForm.elements.namedItem('cadence').value;
    document.getElementById('scheduledIntervalUnit').textContent = cadence === '每周' ? '周' : cadence === '每月' ? '个月' : '天';
  }
  function setScheduledConnectionMethod(method) {
    if (!scheduledChannelNames[expandedScheduledChannel]) return;
    scheduledConnectionMethods.set(expandedScheduledChannel, method);
    scheduledChannelQr.hidden = method !== 'qr';
    scheduledChannelManual.hidden = method !== 'manual';
    document.getElementById('scheduledQrFeedback').textContent = '';
    scheduledEditDrawer.querySelectorAll('[data-scheduled-method]').forEach(button =>
      button.setAttribute('aria-selected', String(button.dataset.scheduledMethod === method)));
  }
  function renderScheduledFeishuRecipients() {
    const query = scheduledFeishuSearch.value.trim().toLocaleLowerCase();
    let visible = 0;
    scheduledFeishuRecipientRows.forEach(row => {
      const selected = selectedFeishuRecipients.has(row.dataset.recipientId);
      row.querySelector('input').checked = selected;
      row.hidden = (scheduledFeishuSelectedOnly.checked && !selected) || !row.textContent.toLocaleLowerCase().includes(query);
      if (!row.hidden) visible++;
    });
    document.getElementById('scheduledFeishuSelectedCount').textContent = selectedFeishuRecipients.size;
    const empty = document.getElementById('scheduledFeishuEmpty');
    empty.textContent = scheduledFeishuSelectedOnly.checked && !selectedFeishuRecipients.size ? '还没有选择接收方' : '没有符合条件的接收方';
    empty.hidden = visible > 0;
  }
  function scheduledDeliverySummary(config) {
    if (!config.push) return '妙手内通知';
    const channels = (config.channels ?? [config.channel]).filter(channel => scheduledChannelNames[channel]);
    if (!channels.length) return '妙手内通知';
    const connectedChannels = new Set(config.connectedChannels || []);
    const labels = channels.map(channel => channel === 'feishu'
      ? `飞书 ${config.feishuRecipients?.length ?? 1} 个接收方`
      : `${scheduledChannelNames[channel]}${connectedChannels.has(channel) ? '已绑定' : '待绑定'}`);
    return `妙手内通知 · ${labels.join('、')}`;
  }
  function renderScheduledChannels() {
    scheduledChannelInputs.forEach(input => { input.checked = selectedScheduledChannels.has(input.dataset.scheduledChannel); });
    scheduledChannelExpandButtons.forEach(button => {
      const active = expandedScheduledChannel === button.dataset.scheduledExpand;
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('tabindex', active ? '0' : '-1');
      button.setAttribute('aria-label', `查看${scheduledChannelNames[button.dataset.scheduledExpand]}设置`);
      button.setAttribute('aria-controls', button.dataset.scheduledExpand === 'feishu' && feishuConnected ? 'scheduledChannelFeishu' : 'scheduledChannelBinding');
    });
    scheduledFeishuPanel.hidden = expandedScheduledChannel !== 'feishu' || !feishuConnected;
    const bindingChannel = expandedScheduledChannel === 'feishu' && feishuConnected ? null : expandedScheduledChannel;
    scheduledChannelBinding.hidden = !bindingChannel;
    scheduledChannelMethods.hidden = !bindingChannel;
    if (bindingChannel) {
      const channelName = scheduledChannelNames[bindingChannel];
      scheduledChannelBinding.setAttribute('aria-label', `${channelName}绑定`);
      scheduledChannelMethods.setAttribute('aria-label', `${channelName}绑定方式`);
      document.getElementById('scheduledQrActivate').setAttribute('aria-label', `演示扫码绑定${channelName}`);
      document.getElementById('scheduledBotIdHelp').textContent = bindingChannel === 'wecom'
        ? '企微机器人的 Bot ID，在企微客户端工作台 → 智能机器人模块中查看'
        : `在${channelName}机器人设置中查看 Bot ID`;
      document.getElementById('scheduledBotHelp').textContent = `如何获取${channelName} Bot ID 和 Bot Secret？`;
      const connection = scheduledConnections.get(bindingChannel) || {};
      for (const key of ['botId', 'botSecret']) scheduledEditForm.elements.namedItem(key).value = connection[key] || '';
      scheduledChannelFeedback.textContent = '';
      document.getElementById('scheduledQrFeedback').textContent = '';
      setScheduledConnectionMethod(scheduledConnectionMethods.get(bindingChannel) || 'qr');
    }
  }
  function setScheduledChannels(channels) {
    selectedScheduledChannels = new Set(channels.filter(channel => scheduledChannelNames[channel]));
    expandedScheduledChannel = scheduledChannelOrder.find(channel => selectedScheduledChannels.has(channel)) || 'feishu';
    renderScheduledChannels();
  }
  const scheduledPromptDisplay = document.getElementById('scheduledPromptDisplay');
  const scheduledDescription = document.getElementById('scheduledDescription');
  const scheduledPromptToggle = document.getElementById('scheduledPromptToggle');
  function syncScheduledPromptToggle() {
    if (!scheduledPromptDisplay.getClientRects().length) return;
    // Measure the full text at the current panel width without painting an intermediate layout.
    scheduledPromptDisplay.classList.add('measuring');
    const fullHeight = scheduledDescription.scrollHeight;
    scheduledPromptDisplay.classList.remove('measuring');
    const lineHeight = parseFloat(getComputedStyle(scheduledDescription).lineHeight);
    const overflows = fullHeight > lineHeight * 4 + 1;
    if (!overflows) scheduledPromptDisplay.classList.remove('expanded');
    scheduledPromptToggle.hidden = !overflows;
    const expanded = scheduledPromptDisplay.classList.contains('expanded');
    scheduledPromptToggle.setAttribute('aria-expanded', String(expanded));
    scheduledPromptToggle.textContent = expanded ? '收起提示词' : '展开全部';
  }
  function setScheduledPrompt(description) {
    scheduledDescription.textContent = description;
    scheduledPromptDisplay.classList.remove('expanded');
    scheduledPromptToggle.setAttribute('aria-expanded', 'false');
    syncScheduledPromptToggle();
  }
  scheduledPromptToggle.addEventListener('click', () => {
    scheduledPromptDisplay.classList.toggle('expanded');
    syncScheduledPromptToggle();
  });
  let scheduledPromptWidth = 0;
  new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width > 0 && width !== scheduledPromptWidth) {
      scheduledPromptWidth = width;
      syncScheduledPromptToggle();
    }
  }).observe(scheduledPromptDisplay);
  function showScheduledTaskDetails(task) {
    selectedScheduledTask = createdScheduledTasks.has(task) ? task : scheduledReportTask;
    const config = createdScheduledTasks.get(selectedScheduledTask);
    if (config) {
      document.getElementById('scheduledName').textContent = config.name;
      setScheduledPrompt(config.description);
      document.getElementById('scheduledTime').textContent = config.schedule;
      document.getElementById('scheduledProjectSummary').textContent = FOLDERS.find(folder => folder.id === config.folderId)?.name || '默认文件夹';
      document.getElementById('scheduledDeliverySummary').textContent = scheduledDeliverySummary(config);
    } else {
      document.getElementById('scheduledName').textContent = scheduledReportTask.querySelector('.task-name').textContent;
      setScheduledPrompt(legacyScheduledConfig.description);
      document.getElementById('scheduledTime').textContent = legacyScheduledConfig.schedule;
      document.getElementById('scheduledProjectSummary').textContent = FOLDERS.find(folder => folder.id === legacyScheduledConfig.folderId)?.name || '默认文件夹';
      document.getElementById('scheduledDeliverySummary').textContent = scheduledDeliverySummary(legacyScheduledConfig);
    }
    const state = config || legacyScheduledConfig;
    scheduledEnabled.setAttribute('aria-checked', String(!state.paused && !state.terminated));
    scheduledEnabled.textContent = state.paused ? '启用定时任务' : '停用定时任务';
    scheduledEnabled.disabled = Boolean(state.terminated);
    document.getElementById('scheduledRunNow').disabled = Boolean(state.paused || state.terminated || state.demoState === 'running');
    renderScheduledRunList();
  }
  function setScheduledEditing(editing, mode = 'edit') {
    scheduledEdit.setAttribute('aria-expanded', String(editing && mode === 'edit'));
    if (editing) {
      scheduledDrawerMode = mode;
      scheduledEditDrawer.dataset.mode = mode;
      scheduledEditReturnFocus = document.activeElement;
      const config = createdScheduledTasks.get(selectedScheduledTask);
      const creating = mode === 'create';
      document.getElementById('scheduledEditTitle').textContent = creating ? '创建定时任务' : '编辑定时任务';
      document.getElementById('scheduledDrawerIntro').textContent = creating ? '创建自动执行的定时任务，任务会在后台运行。' : '设置自动执行的定时任务，任务会在后台运行。';
      document.getElementById('scheduledDrawerSubmit').textContent = creating ? '创建' : '保存';
      scheduledEditForm.elements.namedItem('name').value = creating ? '' : config?.name || document.getElementById('scheduledName').textContent;
      scheduledEditForm.elements.namedItem('prompt').value = creating ? '' : config?.description || legacyScheduledConfig.description;
      scheduledProjectSelect.value = creating ? 'default' : config?.folderId || conversationExamples.get(scheduledReportTask).folderId || 'default';
      const timeText = creating ? '每日 09:00' : config?.schedule || legacyScheduledConfig.schedule;
      scheduledEditForm.elements.namedItem('repeat').value = creating || timeText.startsWith('自定义') ? '自定义' : timeText.match(/每日|工作日|每周|每月/)?.[0] || '每日';
      scheduledEditForm.elements.namedItem('cadence').value = config?.cadence || '每天';
      scheduledEditForm.elements.namedItem('interval').value = config?.interval || '1';
      scheduledEditForm.elements.namedItem('time').value = timeText.match(/\d{2}:\d{2}/)?.[0] || '09:00';
      updateScheduledCustomRows();
      scheduledPushEnabled.checked = creating ? true : config?.push ?? legacyScheduledConfig.push;
      scheduledChannelSetup.hidden = !scheduledPushEnabled.checked;
      scheduledConnectionMethods.set('feishu', 'qr');
      scheduledConnectionMethods.set('wecom', 'qr');
      scheduledConnectionMethods.set('dingtalk', 'qr');
      selectedFeishuRecipients = new Set(creating ? [] : config?.feishuRecipients ?? legacyScheduledConfig.feishuRecipients);
      feishuConnected = !creating && (config?.feishuConnected ?? selectedFeishuRecipients.size > 0);
      scheduledFeishuSearch.value = '';
      scheduledFeishuSelectedOnly.checked = false;
      document.getElementById('scheduledFeishuFeedback').textContent = '';
      scheduledChannelSelectionFeedback.textContent = '';
      renderScheduledFeishuRecipients();
      const savedChannels = config?.channels ?? (config?.channel ? [config.channel] : legacyScheduledConfig.channels ?? [legacyScheduledConfig.channel]);
      setScheduledChannels(creating ? ['feishu'] : savedChannels);
      updateScheduledFieldCounts();
      scheduledEditDrawer.inert = false;
      scheduledEditDrawer.setAttribute('aria-hidden', 'false');
      scheduledEditBackdrop.hidden = false;
      scheduledEditDrawer.querySelector('.scheduled-drawer-scroll').scrollTop = 0;
      requestAnimationFrame(() => {
        if (scheduledEditDrawer.inert) return;
        scheduledEditDrawer.classList.add('open');
        scheduledEditForm.elements.namedItem('name').focus({ preventScroll: true });
      });
    } else {
      scheduledEditDrawer.classList.remove('open');
      scheduledEditDrawer.inert = true;
      scheduledEditDrawer.setAttribute('aria-hidden', 'true');
      scheduledEditBackdrop.hidden = true;
      if (scheduledEditReturnFocus?.isConnected) scheduledEditReturnFocus.focus({ preventScroll: true });
      scheduledEditReturnFocus = null;
    }
  }
  scheduledEdit.addEventListener('click', () => {
    setScheduledMoreOpen(false);
    setScheduledEditing(!scheduledEditDrawer.classList.contains('open'));
  });
  document.getElementById('scheduledEditClose').addEventListener('click', () => setScheduledEditing(false));
  document.getElementById('scheduledEditCancel').addEventListener('click', () => setScheduledEditing(false));
  scheduledEditBackdrop.addEventListener('click', () => setScheduledEditing(false));
  scheduledEditDrawer.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setScheduledEditing(false); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(scheduledEditDrawer.querySelectorAll('button, input, select, textarea'))
      .filter(element => !element.disabled && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  scheduledEditForm.elements.namedItem('name').addEventListener('input', updateScheduledFieldCounts);
  scheduledEditForm.elements.namedItem('prompt').addEventListener('input', updateScheduledFieldCounts);
  scheduledEditForm.elements.namedItem('repeat').addEventListener('change', updateScheduledCustomRows);
  scheduledEditForm.elements.namedItem('cadence').addEventListener('change', updateScheduledCustomRows);
  document.getElementById('scheduledTemplateButton').addEventListener('click', () => {
    scheduledEditForm.elements.namedItem('name').value = '每周工作周报';
    scheduledEditForm.elements.namedItem('prompt').value = weeklyReportPrompt;
    scheduledEditForm.elements.namedItem('repeat').value = '每周';
    updateScheduledCustomRows();
    updateScheduledFieldCounts();
  });
  scheduledPushEnabled.addEventListener('change', () => { scheduledChannelSetup.hidden = !scheduledPushEnabled.checked; });
  scheduledChannelInputs.forEach(input => input.addEventListener('change', () => {
    const channel = input.dataset.scheduledChannel;
    if (input.checked) {
      selectedScheduledChannels.add(channel);
      expandedScheduledChannel = channel;
    } else {
      selectedScheduledChannels.delete(channel);
    }
    scheduledChannelSelectionFeedback.textContent = '';
    renderScheduledChannels();
  }));
  scheduledChannelExpandButtons.forEach(button => button.addEventListener('click', () => {
    expandedScheduledChannel = button.dataset.scheduledExpand;
    scheduledChannelSelectionFeedback.textContent = '';
    renderScheduledChannels();
  }));
  scheduledChannelExpandButtons.forEach((button, index) => button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = scheduledChannelExpandButtons[(index + (event.key === 'ArrowRight' ? 1 : -1) + scheduledChannelExpandButtons.length) % scheduledChannelExpandButtons.length];
    next.click();
    next.focus();
  }));
  document.getElementById('scheduledQrActivate').addEventListener('click', () => {
    if (!expandedScheduledChannel) return;
    if (expandedScheduledChannel === 'feishu') {
      feishuConnected = true;
      selectedFeishuRecipients.add('yibao');
      renderScheduledFeishuRecipients();
      renderScheduledChannels();
      document.getElementById('scheduledFeishuFeedback').textContent = '演示绑定成功，请选择接收方。';
      return;
    }
    const connection = scheduledConnections.get(expandedScheduledChannel) || {};
    scheduledConnections.set(expandedScheduledChannel, { ...connection, connected: true });
    document.getElementById('scheduledQrFeedback').textContent = '演示绑定成功。';
  });
  scheduledEditDrawer.querySelectorAll('[data-scheduled-method]').forEach(button =>
    button.addEventListener('click', () => setScheduledConnectionMethod(button.dataset.scheduledMethod)));
  scheduledFeishuSearch.addEventListener('input', renderScheduledFeishuRecipients);
  scheduledFeishuSearch.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
  scheduledFeishuSelectedOnly.addEventListener('change', renderScheduledFeishuRecipients);
  scheduledFeishuRecipientRows.forEach(row => row.querySelector('input').addEventListener('change', event => {
    if (event.currentTarget.checked) selectedFeishuRecipients.add(row.dataset.recipientId);
    else selectedFeishuRecipients.delete(row.dataset.recipientId);
    document.getElementById('scheduledFeishuFeedback').textContent = '';
    renderScheduledFeishuRecipients();
  }));
  document.getElementById('scheduledFeishuHelp').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('scheduledFeishuFeedback').textContent = '请先在飞书中添加接收方，再回到这里选择。此页面展示示例接收方。';
  });
  document.getElementById('scheduledBotHelp').addEventListener('click', event => {
    event.preventDefault();
    scheduledChannelFeedback.textContent = `请在${scheduledChannelNames[expandedScheduledChannel]}的机器人设置中获取 Bot ID 和 Bot Secret。此页面仅演示绑定流程。`;
  });
  for (const key of ['botId', 'botSecret']) {
    scheduledEditForm.elements.namedItem(key).addEventListener('input', () => {
      const draft = Object.fromEntries(['botId', 'botSecret'].map(field =>
        [field, scheduledEditForm.elements.namedItem(field).value]));
      if (expandedScheduledChannel) {
        const connection = scheduledConnections.get(expandedScheduledChannel) || {};
        scheduledConnections.set(expandedScheduledChannel, { ...connection, ...draft });
      }
      scheduledChannelFeedback.textContent = '';
    });
  }
  scheduledEditForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = scheduledEditForm.elements.namedItem('name').value.trim();
    const description = scheduledEditForm.elements.namedItem('prompt').value.trim();
    const time = scheduledEditForm.elements.namedItem('time').value;
    const repeat = scheduledEditForm.elements.namedItem('repeat').value;
    const cadence = scheduledEditForm.elements.namedItem('cadence').value;
    const interval = Math.max(1, Number(scheduledEditForm.elements.namedItem('interval').value) || 1);
    const schedule = repeat === '自定义' ? `自定义 · ${cadence}，每隔 ${interval}${cadence === '每周' ? '周' : cadence === '每月' ? '个月' : '天'} ${time}` : `${repeat} ${time}`;
    if (!name || !description || !time) return;
    if (scheduledPushEnabled.checked && !selectedScheduledChannels.size) {
      scheduledChannelSelectionFeedback.textContent = '请至少选择一个推送频道。';
      scheduledChannelInputs[0].focus();
      return;
    }
    if (scheduledPushEnabled.checked && selectedScheduledChannels.has('feishu') && !feishuConnected) {
      const method = scheduledConnectionMethods.get('feishu');
      const connection = scheduledConnections.get('feishu') || {};
      if (method === 'qr') {
        expandedScheduledChannel = 'feishu';
        renderScheduledChannels();
        document.getElementById('scheduledQrFeedback').textContent = '请先扫码绑定飞书。';
        document.getElementById('scheduledQrActivate').focus();
        return;
      }
      if (!connection.botId?.trim() || !connection.botSecret?.trim()) {
        expandedScheduledChannel = 'feishu';
        renderScheduledChannels();
        scheduledChannelFeedback.textContent = '请填写 Bot ID 和 Bot Secret。';
        scheduledEditForm.elements.namedItem(!connection.botId?.trim() ? 'botId' : 'botSecret').focus();
        return;
      }
      feishuConnected = true;
      selectedFeishuRecipients.add('yibao');
    }
    if (scheduledPushEnabled.checked && selectedScheduledChannels.has('feishu') && !selectedFeishuRecipients.size) {
      expandedScheduledChannel = 'feishu';
      renderScheduledChannels();
      document.getElementById('scheduledFeishuFeedback').textContent = '请至少选择一个飞书接收方。';
      return;
    }
    for (const channel of ['wecom', 'dingtalk']) {
      if (!scheduledPushEnabled.checked || !selectedScheduledChannels.has(channel)) continue;
      const connection = scheduledConnections.get(channel) || {};
      if (scheduledConnectionMethods.get(channel) === 'qr') {
        if (connection.connected) continue;
        expandedScheduledChannel = channel;
        renderScheduledChannels();
        document.getElementById('scheduledQrFeedback').textContent = `请先扫码绑定${scheduledChannelNames[channel]}。`;
        document.getElementById('scheduledQrActivate').focus();
        return;
      }
      if (!connection.botId?.trim() || !connection.botSecret?.trim()) {
        expandedScheduledChannel = channel;
        renderScheduledChannels();
        scheduledChannelFeedback.textContent = '请填写 Bot ID 和 Bot Secret。';
        scheduledEditForm.elements.namedItem(!connection.botId?.trim() ? 'botId' : 'botSecret').focus();
        return;
      }
    }
    const deliveryConfig = {
      push: scheduledPushEnabled.checked,
      channels: scheduledChannelOrder.filter(channel => selectedScheduledChannels.has(channel)),
      feishuRecipients: [...selectedFeishuRecipients],
      feishuConnected,
      connectedChannels: ['wecom', 'dingtalk'].filter(channel => {
        const connection = scheduledConnections.get(channel) || {};
        return selectedScheduledChannels.has(channel) && (connection.connected || (connection.botId?.trim() && connection.botSecret?.trim()));
      }),
    };
    if (scheduledDrawerMode === 'create') {
      const task = document.createElement('a');
      task.className = 'task flush';
      task.href = '#';
      task.dataset.taskType = 'scheduled';
      task.dataset.openConversation = '';
      task.innerHTML = `<span class="task-name"></span><span class="task-state" title="定时任务"><svg class="task-schedule-icon" viewBox="0 0 24 24" role="img" aria-label="定时任务"><path d="m5.5 5.5-2 2M18.5 5.5l2 2"/><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 2"/></svg></span>`;
      attachTaskActions(task);
      task.querySelector('.task-name').textContent = name;
      scheduledReportTask.after(task);
      taskHomes.set(task, { parent: task.parentElement, next: task.nextSibling });
      taskIds.set(task, `demo-conversation-${nextTaskId++}`);
      const config = { name, description, schedule, cadence, interval, folderId: scheduledProjectSelect.value, ...deliveryConfig };
      createdScheduledTasks.set(task, config);
      scheduledRunTasks.add(task);
      conversationExamples.set(task, { folderId: config.folderId, turns: [{ prompt: description, reply: '定时任务已创建。首次运行后，结果会显示在这条对话中。' }], files: [] });
      task.addEventListener('click', e => {
        if (e.target.closest('.row-acts, .row-act')) return;
        e.preventDefault();
        showScheduledTaskDetails(task);
        setConversationOpen(true, task);
      });
      setScheduledEditing(false);
      showScheduledTaskDetails(task);
      setConversationOpen(true, task);
      setScheduledPanelOpen(true);
      renderScheduledOverview();
      refreshClipped();
      return;
    }
    if (createdScheduledTasks.has(selectedScheduledTask)) {
      const config = { ...createdScheduledTasks.get(selectedScheduledTask), name, description, schedule, cadence, interval, folderId: scheduledProjectSelect.value, ...deliveryConfig };
      createdScheduledTasks.set(selectedScheduledTask, config);
      selectedScheduledTask.querySelector('.task-name').textContent = name;
      conversationExamples.get(selectedScheduledTask).folderId = config.folderId;
      showScheduledTaskDetails(selectedScheduledTask);
      if (activeConversationTask === selectedScheduledTask) updateConversationTaskTitle(selectedScheduledTask);
      setScheduledEditing(false);
      renderScheduledOverview();
      refreshClipped();
      return;
    }
    document.getElementById('scheduledName').textContent = name;
    setScheduledPrompt(description);
    document.getElementById('scheduledTime').textContent = schedule;
    Object.assign(legacyScheduledConfig, { description, schedule, folderId: scheduledProjectSelect.value, ...deliveryConfig });
    document.getElementById('scheduledProjectSummary').textContent = scheduledProjectSelect.selectedOptions[0]?.textContent || '默认文件夹';
    scheduledRuns.forEach(run => { run.task.querySelector('.task-name').textContent = name; });
    const previousFolder = FOLDERS.find(folder => folder.id === conversationExamples.get(scheduledReportTask).folderId);
    const nextFolder = FOLDERS.find(folder => folder.id === scheduledProjectSelect.value);
    if (previousFolder && nextFolder && previousFolder !== nextFolder) {
      previousFolder.files = previousFolder.files.filter(node => !scheduledRuns.some(run => run.artifactNode === node));
      scheduledRuns.forEach(run => nextFolder.files.push(run.artifactNode));
      renderToolTree();
    }
    scheduledRuns.forEach(run => { conversationExamples.get(run.task).folderId = scheduledProjectSelect.value; });
    document.getElementById('scheduledDeliverySummary').textContent = scheduledDeliverySummary(legacyScheduledConfig);
    if (scheduledRunTasks.has(activeConversationTask)) updateConversationTaskTitle(activeConversationTask);
    setScheduledEditing(false);
    renderScheduledOverview();
    refreshClipped();
  });
  scheduledEnabled.addEventListener('click', event => {
    const button = event.currentTarget;
    const enabled = button.getAttribute('aria-checked') !== 'true';
    const config = createdScheduledTasks.get(selectedScheduledTask) || legacyScheduledConfig;
    config.paused = !enabled;
    showScheduledTaskDetails(selectedScheduledTask);
    renderScheduledOverview();
    setScheduledMoreOpen(false);
  });
  // 示例轮次跨越数天；真实发送的时间在进入对话时记录，而不是入队时记录。
  const demoTurnMinutesAgo = [4320, 4260, 2880, 2820, 1440, 1380, 360, 180, 40, 4];
  const conversationThreads = new Map();
  const conversationComposerDrafts = new Map();
  const startedConversationDemos = new Set();
  const conversationGoals = new Map();
  let activeConversationTask = null;
  function updateSummaryArtifactBadge() {
    const scheduled = mainView.classList.contains('conversation-open') && scheduledRunTasks.has(activeConversationTask);
    content.classList.toggle('scheduled-conversation', scheduled);
    const count = conversationPage.hidden ? 0 : (conversationExamples.get(activeConversationTask)?.files.length || 0);
    summaryArtifactBadge.hidden = count === 0;
    summaryArtifactBadge.textContent = count ? String(count) : '';
    outputToggle.title = '摘要';
    outputToggle.setAttribute('aria-label', count ? `摘要，${count} 个产物` : '摘要');
    summaryPopover.setAttribute('aria-label', '摘要');
  }
  const conversationTaskTitle = document.getElementById('conversationTaskTitle');
  function updateConversationTaskTitle(task) {
    const name = task.querySelector('.task-name')?.textContent.trim() || '当前任务';
    const scheduledRun = scheduledRuns.find(run => run.task === task);
    conversationTaskTitle.textContent = scheduledRun ? `${name} · ${scheduledRun.date}` : name;
  }
  const conversationTaskMore = document.getElementById('conversationTaskMore');
  const conversationTaskFeedback = document.getElementById('conversationTaskFeedback');
  // 预置进展只用于演示；阶段说明与执行状态分开，便于后续接入真实事件。
  let disclosureMode = 'work';
  try { disclosureMode = localStorage.getItem('catpaw-disclosure-mode') === 'development' ? 'development' : 'work'; } catch (_) { /* Preview may disallow storage. */ }
  const disclosureSettings = document.getElementById('disclosureSettings');
  const disclosureSettingsTrigger = document.querySelector('.settings-nav');
  disclosureSettings.querySelector(`[name="disclosureMode"][value="${disclosureMode}"]`).checked = true;
  disclosureSettingsTrigger.addEventListener('click', (event) => {
    event.preventDefault();
    disclosureSettings.showModal();
  });
  document.getElementById('disclosureSettingsClose').addEventListener('click', () => disclosureSettings.close());
  disclosureSettings.addEventListener('change', (event) => {
    if (event.target.name !== 'disclosureMode') return;
    disclosureMode = event.target.value === 'development' ? 'development' : 'work';
    try { localStorage.setItem('catpaw-disclosure-mode', disclosureMode); } catch (_) { /* Keep the current choice for this session. */ }
    const panel = conversationThread.querySelector('.conversation-stage-demo');
    if (panel) updateConversationStage(panel, Number(panel.dataset.stageFrame), panel.querySelector('.stage-plan-toggle')?.getAttribute('aria-expanded') === 'true');
  });
  disclosureSettings.addEventListener('close', () => disclosureSettingsTrigger.focus());
  const conversationStageFrames = [
    {
      acknowledgement: '明白，你希望结合趋势图和异常明细，找出需要优先跟进的门店，并明确处理顺序。我会整理优先级依据和跟进建议，缺失记录及责任归属会保留为待确认项。',
      stage: 'plan', planCompleted: 0,
    },
    {
      stage: 'work', planCompleted: 0,
      progress: '正在读取趋势图、异常明细和分析文档，确认文件与字段是否齐全。',
      tool: '读取文件', toolIcon: 'file', technical: '打开趋势图、门店履约异常明细.xlsx 和门店履约分析.docx，检查订单 ID、门店及时间字段。',
      detail: '正在读取三份资料并检查可用字段。',
      call: { name: 'read_file', input: { files: ['趋势图.png', '门店履约异常明细.xlsx', '门店履约分析.docx'] } },
      completed: '已读取趋势图、异常明细和分析文档',
    },
    {
      stage: 'work', planCompleted: 0,
      progress: '正在按订单去重并核对接单、到店、出餐和交接时间，单列缺失记录。',
      tool: '表格分析', toolIcon: 'table', technical: '按订单 ID 去重，检查接单、到店、出餐和交接时间戳；缺失值不参与确定性归因。',
      detail: '正在核对订单和时间字段，标出缺失记录。',
      call: { name: 'python', input: { code: 'df = pd.read_excel("门店履约异常明细.xlsx")\ndf = df.drop_duplicates(subset=["订单 ID"])\ntime_fields = ["接单时间", "到店时间", "出餐时间", "交接时间"]\nmissing_records = df[df[time_fields].isna().any(axis=1)]' } },
      completed: '已核对订单口径，并标出缺失时间戳',
    },
    {
      stage: 'work', planCompleted: 1,
      progress: '正在比较超时时长、影响订单数和重复发生情况，筛选需要优先跟进的异常。',
      tool: '数据分析', toolIcon: 'chart', technical: '按超时时长、影响订单数和重复发生次数比较异常；缺失时间戳记录单独保留。',
      detail: '正在比较异常持续时间、影响范围和重复发生情况。',
      call: { name: 'python', input: { code: 'priority = df.sort_values(\n    ["超时时长", "影响订单数", "重复发生次数"],\n    ascending=False\n).head(5)' } },
      completed: '已比较异常的影响范围和重复情况',
    },
    {
      stage: 'work', planCompleted: 1,
      progress: '正在对照筛选结果与分析文档的结论，检查优先级是否有遗漏或矛盾。',
      tool: '读取文档', toolIcon: 'document', technical: '读取门店履约分析.docx 的结论段，逐项对照异常明细中的门店、时段与订单数量。',
      detail: '正在把筛选结果与分析文档交叉核对。',
      call: { name: 'read_file', input: { path: '门店履约分析.docx', section: '结论与建议' } },
      completed: '已对照分析文档复核优先级',
    },
    {
      stage: 'work', planCompleted: 2,
      progress: '正在整理优先异常的跟进顺序，并标注仍需人工确认的事项。',
      tool: '整理结果', toolIcon: 'list', technical: '汇总优先跟进的 5 条异常，列出门店侧处理顺序和待确认的责任归属。',
      detail: '正在整理 5 条优先异常和处理建议。',
      call: { name: 'python', input: { code: 'recommendations = priority.copy()\nrecommendations["责任归属"] = "待人工确认"\nrecommendations.to_excel("门店履约异常明细.xlsx", index=False)' } },
      completed: '已整理 5 条优先异常和处理顺序',
    },
    {
      stage: 'work', planCompleted: 2,
      progress: '正在逐项复核建议与原始记录的对应关系，避免把推测写成结论。',
      tool: '结果检查', toolIcon: 'check', technical: '检查每条建议与异常明细的对应关系；保留待确认责任方和缺失时间戳。',
      detail: '正在复核建议与原始记录的对应关系。',
      call: { name: 'python', input: { code: 'assert recommendations["订单 ID"].isin(df["订单 ID"]).all()\nassert recommendations["责任归属"].eq("待人工确认").all()\nassert len(recommendations) == 5' } },
      completed: '已复核建议依据和待确认事项',
    },
    {
      stage: 'done', planCompleted: 3,
      summary: '已按统一口径核对资料，筛出需要优先跟进的 5 条异常，并整理了门店侧处理顺序。建议先核对重复超时和晚高峰异常集中的门店，再排查出餐延迟。',
      caveat: '缺失时间戳与责任归属仍需结合原始记录和门店反馈人工确认。',
    },
  ];
  const conversationStagePlan = [
    { title: '核对资料与统计口径' },
    { title: '比较门店跟进优先级' },
    { title: '整理建议与待确认项' },
  ];
  const stageToolIcons = {
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
    file: '<path d="M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11M3 14h18"/>',
    chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-7"/><path d="M17 6h3v3"/>',
    document: '<path d="M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>',
    check: '<circle cx="11" cy="11" r="7"/><path d="m8 11 2 2 4-4m2.3 7.3L21 21"/>',
  };

  function completedStageCount(frame) {
    return frame.planCompleted;
  }

  function renderStageToolCall(frame, development) {
    const icon = stageToolIcons[frame.call.name === 'python' ? 'code' : frame.toolIcon];
    return `<details class="stage-tool-call" data-tool-state="running"${development ? ' open' : ''}><summary aria-label="${esc(frame.call.name)}，运行中，查看调用参数"><span class="stage-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" class="ic">${icon}</svg><svg viewBox="0 0 24 24" class="ic stage-tool-shine">${icon}</svg></span><span class="stage-tool-copy"><strong>${esc(frame.call.name)}</strong><span class="stage-tool-description">${esc(frame.detail)}</span></span><svg viewBox="0 0 24 24" class="ic stage-call-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="stage-call-details"><p>${esc(frame.technical)}</p><span class="stage-call-label">调用参数</span><pre><code>${esc(JSON.stringify(frame.call.input, null, 2))}</code></pre></div></details>`;
  }

  function renderStageAcknowledgement(text) {
    const characters = Array.from(text);
    const fragments = [];
    for (let index = 0; index < characters.length; index += 6) fragments.push(characters.slice(index, index + 6).join(''));
    const interval = 1100 / Math.max(1, fragments.length - 1);
    return fragments.map((fragment, index) => `<span class="stage-ink-fragment" style="--ink-delay:${120 + Math.round(index * interval)}ms">${esc(fragment)}</span>`).join('');
  }

  function renderConversationStageBody(frameIndex, planOpen = frameIndex === 0, newCompletedIndex = -1, thinkingOpen = false) {
    const frame = conversationStageFrames[frameIndex];
    const before = frame.stage === 'plan';
    const done = frame.stage === 'done';
    const development = disclosureMode === 'development';
    const completedCount = completedStageCount(frame);
    const check = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>';
    const plan = conversationStagePlan.map((step, index) => {
      const state = before ? 'pending' : index < completedCount ? 'done' : index === completedCount ? 'current' : 'pending';
      const label = state === 'done' ? '已完成' : state === 'current' ? '进行中' : '待开始';
      return `<li class="stage-plan-step" data-state="${state}" aria-label="${esc(step.title)}，${label}"${state === 'current' ? ' aria-current="step"' : ''}><span class="stage-plan-number" aria-hidden="true">${state === 'done' ? check : `<span class="stage-plan-digit">${index + 1}</span>`}</span><span class="stage-plan-title">${esc(step.title)}</span></li>`;
    }).join('');
    const planMarkup = `<div class="stage-plan" data-collapsed="${!planOpen}" aria-label="Agent 的待办任务"><button class="stage-plan-toggle" type="button" aria-expanded="${planOpen}" aria-controls="stagePlanBody"><svg viewBox="0 0 24 24" class="ic stage-plan-icon" aria-hidden="true">${stageToolIcons.list}</svg><strong>待办任务</strong><span>已完成 ${completedCount}/${conversationStagePlan.length}</span><svg viewBox="0 0 24 24" class="ic stage-plan-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="stage-plan-body" id="stagePlanBody"${planOpen ? '' : ' inert'}><ol>${plan}</ol></div></div>`;
    const completedEvents = before ? [] : conversationStageFrames.slice(1, frameIndex);
    const completedItems = completedEvents.map((event, index) => `<li class="stage-completed-item${index === newCompletedIndex ? ' is-new' : ''}"><span class="stage-completed-check" aria-hidden="true">${check}</span><span class="stage-completed-text">${esc(event.completed)}</span><span class="stage-completed-tool">${esc(event.call.name)}</span></li>`).join('');
    const completedMarkup = completedEvents.length
      ? `<div class="stage-thinking-details" id="stageThinkingDetails"${thinkingOpen ? '' : ' inert'}><div class="stage-thinking-details-inner"><section class="stage-completed" aria-label="已完成的过程"><ol>${completedItems}</ol></section></div></div>`
      : '';
    const currentMarkup = before || done ? '' : `<section class="stage-current" role="status" aria-live="polite" aria-atomic="true"><p>${esc(frame.progress)}</p>${renderStageToolCall(frame, development)}</section>`;
    const resultName = '门店履约异常明细.xlsx';
    const resultMarkup = done ? `<section class="stage-summary" aria-label="工作总结"><p>${esc(frame.summary)}${esc(frame.caveat)}</p></section><section class="stage-output" aria-label="产物"><div class="conversation-artifacts is-single stage-result-artifacts" aria-label="本轮产物">${renderConversationArtifact(resultName, conversationExamples.get(conversationTask).files.indexOf(resultName))}</div></section>` : '';
    const thinkingStatus = `<strong>${done ? '思考完成' : '正在思考'}</strong><span class="stage-elapsed" aria-label="已用时间">0秒</span>`;
    const thinkingMarkup = `<div class="stage-thinking">${completedEvents.length
      ? `<button class="stage-thinking-status stage-thinking-toggle" type="button" aria-expanded="${thinkingOpen}" aria-controls="stageThinkingDetails">${thinkingStatus}<svg viewBox="0 0 24 24" class="ic stage-thinking-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>${completedMarkup}`
      : `<div class="stage-thinking-status">${thinkingStatus}</div>`}</div>`;
    return thinkingMarkup + (before ? `<article class="md conversation-reply stage-acknowledgement"><p>${renderStageAcknowledgement(frame.acknowledgement)}</p></article>` : '') + planMarkup + currentMarkup + resultMarkup;
  }

  function renderConversationStage(entering = false) {
    return `<section class="conversation-stage-demo${entering ? ' is-entering' : ''}" data-stage-frame="0" data-started-at="${Date.now()}" aria-label="对话进度演示">${renderConversationStageBody(0)}</section>`;
  }

  let stageAutoTimer = null;
  let stageAdvanceTimer = null;
  let stageClockTimer = null;
  function formatStageElapsed(seconds) {
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}分${seconds % 60}秒` : `${seconds}秒`;
  }
  function updateStageClock(panel) {
    const elapsed = panel.querySelector('.stage-elapsed');
    if (!elapsed) return;
    const startedAt = Number(panel.dataset.startedAt) || Date.now();
    const endedAt = Number(panel.dataset.finishedAt) || Date.now();
    const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    elapsed.textContent = formatStageElapsed(seconds);
  }
  function syncStageClock() {
    clearInterval(stageClockTimer);
    stageClockTimer = null;
    if (strategyScene && !strategyDemoActive) return;
    const panel = conversationPage.hidden || activeConversationTask !== conversationTask
      ? null : conversationThread.querySelector('.conversation-stage-demo');
    if (!panel) return;
    updateStageClock(panel);
    if (conversationStageFrames[Number(panel.dataset.stageFrame)]?.stage === 'done') return;
    stageClockTimer = setInterval(() => {
      if (panel.isConnected && !conversationPage.hidden && activeConversationTask === conversationTask) updateStageClock(panel);
      else syncStageClock();
    }, 1000);
  }
  function scheduleStageAutoAdvance(panel) {
    clearTimeout(stageAutoTimer);
    if (strategyScene) return; // The active slide owns the presentation timeline.
    if (!panel || panel.classList.contains('is-entering') || conversationPage.hidden || activeConversationTask !== conversationTask) return;
    const frameIndex = Number(panel.dataset.stageFrame);
    if (frameIndex >= conversationStageFrames.length - 1) return;
    const duration = frameIndex === 0 ? 6000 : 5000;
    stageAutoTimer = setTimeout(() => {
      if (panel.isConnected && !conversationPage.hidden && activeConversationTask === conversationTask && Number(panel.dataset.stageFrame) === frameIndex) {
        advanceConversationStage(panel, frameIndex + 1);
      }
    }, duration);
  }

  function updateConversationStage(panel, frameIndex, planOpen = frameIndex === 0, thinkingOpen = panel.querySelector('.stage-thinking-toggle')?.getAttribute('aria-expanded') === 'true') {
    clearTimeout(stageAutoTimer);
    const previousEvents = Math.max(0, Number(panel.dataset.stageFrame) - 1);
    const nextEvents = Math.max(0, frameIndex - 1);
    if (frameIndex === 0 && Number(panel.dataset.stageFrame) === conversationStageFrames.length - 1) {
      panel.dataset.startedAt = String(Date.now());
      delete panel.dataset.finishedAt;
      thinkingOpen = false;
      panel.classList.toggle('is-entering', !reducedMotion.matches);
    }
    if (conversationStageFrames[frameIndex].stage === 'done') panel.dataset.finishedAt = String(Date.now());
    panel.dataset.stageFrame = String(frameIndex);
    panel.innerHTML = renderConversationStageBody(frameIndex, planOpen, nextEvents > previousEvents ? nextEvents - 1 : -1, thinkingOpen);
    syncStageDemoControls();
    conversationThreads.set(conversationTask, conversationThread.innerHTML);
    scheduleStageAutoAdvance(panel);
  }

  function advanceConversationStage(panel, next, immediate = false) {
    clearTimeout(stageAutoTimer);
    if (stageAdvanceTimer) return;
    if (!immediate && Number(panel.dataset.stageFrame) === 0 && next === 1 && !reducedMotion.matches) {
      const plan = panel.querySelector('.stage-plan');
      plan.dataset.collapsed = 'true';
      plan.querySelector('.stage-plan-toggle').setAttribute('aria-expanded', 'false');
      plan.querySelector('.stage-plan-body').inert = true;
      stageDemoAdvance.disabled = true;
      stageAdvanceTimer = setTimeout(() => {
        stageAdvanceTimer = null;
        stageDemoAdvance.disabled = false;
        if (panel.isConnected) updateConversationStage(panel, next);
      }, 280);
      return;
    }
    updateConversationStage(panel, next);
  }

  const stageDemoControls = document.getElementById('stageDemoControls');
  const stageDemoAdvance = document.getElementById('stageDemoAdvance');
  function syncStageDemoControls() {
    syncStageClock();
    const panel = conversationThread.querySelector('.conversation-stage-demo');
    stageDemoControls.hidden = conversationPage.hidden || activeConversationTask !== conversationTask || !panel || panel.classList.contains('is-entering');
    if (stageDemoControls.hidden) return;
    const index = Number(panel.dataset.stageFrame);
    const phase = index === 0 ? 1 : conversationStageFrames[index].stage === 'done' ? 3 : 2;
    const action = index === 0 ? '开始工作 →' : phase === 3
      ? '重播演示 ↺' : index === conversationStageFrames.length - 2 ? '查看结果 →' : '演示下一步 →';
    stageDemoAdvance.textContent = `${phase}/3 · ${action}`;
  }

  stageDemoAdvance.addEventListener('click', () => {
    const panel = conversationThread.querySelector('.conversation-stage-demo');
    if (!panel || activeConversationTask !== conversationTask) return;
    const next = (Number(panel.dataset.stageFrame) + 1) % conversationStageFrames.length;
    advanceConversationStage(panel, next, true);
  });
  conversationThread.addEventListener('click', (event) => {
    const toggle = event.target.closest('.stage-thinking-toggle');
    if (!toggle) return;
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.nextElementSibling.inert = !open;
    conversationThreads.set(activeConversationTask, conversationThread.innerHTML);
  });
  conversationThread.addEventListener('click', (event) => {
    const toggle = event.target.closest('.stage-plan-toggle');
    if (!toggle) return;
    const plan = toggle.closest('.stage-plan');
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    plan.dataset.collapsed = String(!open);
    plan.querySelector('.stage-plan-body').inert = !open;
    conversationThreads.set(activeConversationTask, conversationThread.innerHTML);
  });
  conversationThread.addEventListener('animationend', (event) => {
    if (!event.target.matches('.conversation-stage-demo.is-entering .stage-plan-step:last-child')) return;
    const panel = event.target.closest('.conversation-stage-demo');
    panel.classList.remove('is-entering');
    syncStageDemoControls();
    conversationThreads.set(conversationTask, conversationThread.innerHTML);
    scheduleStageAutoAdvance(panel);
  });

  const conversationProgressTasks = [
    { name: '汇总本周门店履约明细', state: 'done' },
    { name: '生成履约异常看板', state: 'done' },
    { name: '持续监测新增异常订单', state: 'running' },
  ];
  function renderConversationProgress() {
    const done = conversationProgressTasks.filter((item) => item.state === 'done').length;
    const items = conversationProgressTasks.map(({ name, state }) => {
      const icon = state === 'done'
        ? '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.2 12 2.6 2.6 5-5"/></svg>'
        : '<span class="spinner" aria-hidden="true"></span>';
      return `<div class="conversation-activity-link conversation-progress-item" data-task-state="${state}" aria-label="${esc(name)}，${state === 'done' ? '已完成' : '进行中'}"><span class="conversation-activity-icon">${icon}</span><span class="conversation-status-name">${esc(name)}</span></div>`;
    }).join('');
    return `<section class="conversation-progress" aria-label="任务进度"><button class="conversation-activity-link conversation-progress-toggle" type="button" aria-expanded="false" aria-controls="conversationProgressItems"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 6h2m3 0h11M4 12h2m3 0h11M4 18h2m3 0h11"/></svg><span>进度 ${done}/${conversationProgressTasks.length}</span><svg viewBox="0 0 24 24" class="ic conversation-progress-chevron" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button><div class="conversation-progress-items" id="conversationProgressItems" aria-hidden="true" inert><div class="conversation-progress-items-content">${items}</div></div></section>`;
  }
  function moveConversationProgressToLatestTurn() {
    const progress = conversationThread.querySelector('.conversation-progress');
    const content = conversationThread.querySelector('.assistant-message:last-child .assistant-content');
    if (progress && content) {
      const next = content.querySelector('.conversation-message-meta, .conversation-activity');
      if (next) next.before(progress);
      else content.append(progress);
    }
  }
  conversationThread.addEventListener('click', (event) => {
    const trigger = event.target.closest('.conversation-progress-toggle');
    if (!trigger || !conversationThread.contains(trigger)) return;
    const expanded = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(expanded));
    const items = trigger.nextElementSibling;
    items.inert = !expanded;
    items.setAttribute('aria-hidden', String(!expanded));
  });
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
    const menuTask = scheduledRunTasks.has(activeConversationTask) && !createdScheduledTasks.has(activeConversationTask) ? scheduledReportTask : activeConversationTask;
    conversationTaskMenu.querySelector('[data-conversation-act="pin"] span').textContent = menuTask.dataset.pinned === 'true' ? '取消置顶' : '置顶';
    conversationTaskMenu.hidden = false;
    conversationTaskMenu.classList.add('open');
    conversationTaskMore.setAttribute('aria-expanded', 'true');
    const button = conversationTaskMore.getBoundingClientRect();
    placeWindowMenu(conversationTaskMenu, button.left, button.bottom + 4, button.top - 4);
    conversationTaskMenu.querySelector('button')?.focus();
  });

  async function runTaskMenuAction(action, task) {
    const scheduled = scheduledRunTasks.has(task);
    const container = scheduled && !createdScheduledTasks.has(task) ? scheduledReportTask : task;
    const nameEl = container.querySelector('.task-name');
    const isCurrentConversation = task === activeConversationTask || scheduled && !createdScheduledTasks.has(task) && scheduledRunTasks.has(activeConversationTask) && !createdScheduledTasks.has(activeConversationTask);
    if (action === 'pin') {
      const pinned = container.dataset.pinned !== 'true';
      container.dataset.pinned = String(pinned);
      if (pinned) container.parentElement.prepend(container);
      else {
        const home = taskHomes.get(container);
        home.parent.insertBefore(container, home.next?.parentNode === home.parent ? home.next : null);
      }
      if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback(pinned ? '已置顶' : '已取消置顶');
    } else if (action === 'edit-scheduled' && scheduled) {
      setConversationOpen(true, container);
      setScheduledPanelOpen(true);
      container.querySelector('[data-act="task-more"]')?.focus({ preventScroll: true });
      setScheduledEditing(true);
    } else if (action === 'rename') {
      const name = window.prompt('重命名任务', nameEl.textContent)?.trim();
      if (name) {
        nameEl.textContent = name;
        if (scheduled && !createdScheduledTasks.has(task)) {
          scheduledRuns.forEach(run => { run.task.querySelector('.task-name').textContent = name; });
          document.getElementById('scheduledName').textContent = name;
        } else if (createdScheduledTasks.has(task)) {
          createdScheduledTasks.get(task).name = name;
          if (isCurrentConversation) document.getElementById('scheduledName').textContent = name;
        }
        if (isCurrentConversation) {
          if (scheduled) updateConversationTaskTitle(activeConversationTask);
          else conversationTaskTitle.textContent = name;
        }
        refreshClipped();
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback('已重命名');
      }
    } else if (action === 'copy-directory' || action === 'copy-id') {
      const folderId = container.closest('[data-folder]')?.dataset.folder || 'default';
      const text = action === 'copy-id' ? taskIds.get(container) : FOLDERS.find((folder) => folder.id === folderId)?.path;
      try {
        await navigator.clipboard.writeText(text);
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback(action === 'copy-id' ? '会话 ID 已复制' : '工作目录已复制');
      } catch (error) {
        if (isCurrentConversation && !conversationPage.hidden) showConversationFeedback('复制失败，请检查剪贴板权限');
      }
    } else if (action === 'delete' && window.confirm(`确定删除“${nameEl.textContent}”吗？`)) {
      if (isCurrentConversation && !conversationPage.hidden) setConversationOpen(false);
      if (createdScheduledTasks.has(task)) {
        createdScheduledTasks.delete(task);
        scheduledRunTasks.delete(task);
        conversationExamples.delete(task);
      }
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

  function renderConversationSubagents() {
    return `<div class="conversation-subagents" aria-label="子 Agent 调取">` +
      `<button class="conversation-activity-link conversation-subagent-toggle" type="button" aria-expanded="false" aria-controls="conversationSubagentItems">` +
      `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="9" y="3" width="6" height="6" rx="2"/><rect x="3.5" y="16.5" width="5" height="4.5" rx="1.8"/><rect x="15.5" y="16.5" width="5" height="4.5" rx="1.8"/><path d="M12 9v3.5M6 16.5v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>` +
      `<span class="conversation-activity-label">正在调取子agent</span>` +
      `<svg viewBox="0 0 24 24" class="ic conversation-subagent-chevron" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>` +
      `<div class="conversation-subagent-items" id="conversationSubagentItems" aria-hidden="true" inert><div class="conversation-subagent-items-content">` +
      conversationSubagents.map((agent, index) => {
        const done = agent.state === 'done';
        const icon = done
          ? '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.2 12 2.6 2.6 5-5"/></svg>'
          : '<span class="spinner" aria-hidden="true"></span>';
        const state = done ? '已完成' : '进行中';
        return `<button class="conversation-activity-link conversation-subagent" type="button" data-subagent-index="${index}" aria-expanded="false" aria-controls="conversationSubagentDetail-${index}" aria-label="${esc(agent.work)}，${state}，展开详情">` +
          `<span class="conversation-activity-icon${done ? ' is-done' : ''}" aria-hidden="true">${icon}</span>` +
          `<span class="conversation-activity-detail">${esc(agent.work)}</span>` +
          `<svg viewBox="0 0 24 24" class="ic conversation-subagent-detail-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>` +
          `<div class="conversation-subagent-detail" id="conversationSubagentDetail-${index}" aria-hidden="true" inert hidden>` +
          `<span class="conversation-status-state ${done ? 'is-done' : 'is-running'}">` +
          (done ? '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>已完成' : '<span class="spinner" aria-hidden="true"></span>正在调取子 Agent') +
          `</span><p>${esc(agent.detail)}</p></div>`;
      }).join('') + `</div></div></div>`;
  }

  function renderConversationArtifact(name, index) {
      const extension = name.split('.').pop().toLowerCase();
      const icon = artifactIconByExtension[extension] || 'doc';
      return `<div class="conversation-artifact" data-artifact-index="${index}">` +
        `<button class="conversation-artifact-open" type="button" data-artifact-open aria-label="打开产物：${esc(name)}">` +
        `<span class="conversation-artifact-icon"><img src="assets/artifact-${icon}.svg" alt="" aria-hidden="true"></span>` +
        `<span class="conversation-artifact-info"><strong>${esc(name)}</strong><small>查看产物</small></span></button>` +
        `<button class="conversation-artifact-more" type="button" aria-label="${esc(name)}的更多操作" aria-haspopup="menu" aria-expanded="false" aria-controls="conversationArtifactMenu">` +
        `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g></svg></button></div>`;
  }

  function renderConversationArtifacts(task) {
    const example = conversationExamples.get(task);
    const conversationArtifacts = conversationThread.querySelector('#conversationArtifacts');
    if (!conversationArtifacts) return;
    conversationArtifacts.classList.toggle('is-single', example.files.length === 1);
    conversationArtifacts.innerHTML = example.files.map(renderConversationArtifact).join('');
  }

  const messageAttachments = new Map();
  let nextMessageAttachmentId = 0;
  const localAttachmentUrls = new Set();
  window.addEventListener('pagehide', () => localAttachmentUrls.forEach(url => URL.revokeObjectURL(url)));

  function prepareLocalImage(entry) {
    const { node, localFile } = entry;
    if (!localFile || node.preview || !(localFile.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(node.name))) return;
    const url = URL.createObjectURL(localFile);
    localAttachmentUrls.add(url);
    node.preview = { kind: 'image', art: `<img src="${esc(url)}" alt="">` };
  }

  function renderSentAttachment(entry) {
    const { node } = entry;
    prepareLocalImage(entry);
    const id = String(++nextMessageAttachmentId);
    messageAttachments.set(id, entry);
    const image = node.preview?.kind === 'image';
    const name = esc(node.name);
    const nameAttr = name.replace(/"/g, '&quot;');
    if (image) return `<button class="conversation-sent-image" type="button" data-message-attachment="${id}" aria-label="预览图片：${nameAttr}" title="预览图片：${nameAttr}"><span class="conversation-sent-image-art" aria-hidden="true">${node.preview.art}</span><span class="conversation-sent-image-name">${name}</span></button>`;
    const extension = node.name.split('.').pop().toLowerCase();
    const icon = artifactIconByExtension[extension] || 'doc';
    return `<button class="conversation-sent-file" type="button" data-message-attachment="${id}" aria-label="预览文件：${nameAttr}" title="预览文件：${nameAttr}"><img src="assets/artifact-${icon}.svg" alt="" aria-hidden="true"><span class="conversation-sent-file-copy"><strong>${name}</strong><small>${entry.localFile ? '本地文件' : '资料库文件'} · 点击预览</small></span><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
  }

  function renderUserMessage(text, attachments = [], isGoal = false, suggestSop = false, references = []) {
    const bubble = text ? `<div class="message-bubble">${isGoal ? conversationGoalLabel : ''}${esc(text)}</div>` : '';
    const cards = attachments.length ? `<div class="conversation-sent-attachments">${attachments.map(renderSentAttachment).join('')}</div>` : '';
    const suggestion = suggestSop ? '<div class="conversation-sop-suggestion"><span>是否沉淀 SOP？</span><button type="button" data-sop-accept aria-label="确认沉淀 SOP" title="确认沉淀 SOP"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg></button></div>' : '';
    return `<div class="conversation-message user-message"><div class="conversation-message-body">${artifactSelection?.renderSent(references) || ''}${bubble}${cards}${suggestion}${renderMessageMeta('user')}</div></div>`;
  }

  function formatConversationTurnTime(date, now = new Date()) {
    const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = Math.round((today - day) / 86400000);
    const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (daysAgo === 0) return clock;
    if (daysAgo > 0 && daysAgo < 7) return `${new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date)} ${clock}`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  }

  function renderConversationTurnTime(date) {
    return `<time class="conversation-turn-time" datetime="${date.toISOString()}" title="${date.toLocaleString('zh-CN')}">${formatConversationTurnTime(date)}</time>`;
  }

  function refreshConversationTurnTimes() {
    conversationThread.querySelectorAll('.conversation-turn-time').forEach(time => {
      time.textContent = formatConversationTurnTime(new Date(time.dateTime));
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshConversationTurnTimes();
  });

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
      const question = turn.querySelector('.message-bubble')?.textContent.trim() || turn.querySelector('.artifact-reference-comment')?.textContent.trim() || turn.querySelector('.artifact-reference-copy strong')?.textContent.trim() || turn.querySelector('[data-message-attachment]')?.getAttribute('aria-label') || '对话';
      const answer = turn.nextElementSibling?.querySelector('.assistant-content')?.textContent.trim() || '';
      return `<button class="conversation-turn" type="button" data-turn-index="${index}" aria-label="跳转到第 ${index + 1} 轮：${esc(question)}">` +
        `<span class="conversation-turn-preview" aria-hidden="true"><strong>${esc(question)}</strong>${answer ? `<br>${esc(answer.slice(0, 90))}${answer.length > 90 ? '…' : ''}` : ''}</span></button>`;
    }).join('');
    updateConversationTurnNav();
  }

  let conversationScrollTimer;
  conversationScroll.addEventListener('scroll', () => {
    conversationScroll.classList.add('is-scrolling');
    clearTimeout(conversationScrollTimer);
    conversationScrollTimer = setTimeout(() => conversationScroll.classList.remove('is-scrolling'), 650);
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
      top:conversationScroll.scrollTop + (turn.previousElementSibling?.matches('.conversation-turn-time') ? turn.previousElementSibling : turn).getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top - 16,
      behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });

  const conversationGoalLabel = '<span class="conversation-message-goal-label"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.7"/><path d="M12 2.2V6m0 12v3.8M2.2 12H6m12 0h3.8"/></svg>目标</span>';
  const messageCopyIcon = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M3 15.5V5.8A2.8 2.8 0 0 1 5.8 3h8.4A2.8 2.8 0 0 1 17 5.8V6M3 15.5A2.5 2.5 0 0 0 5.5 18H8"/><rect x="8" y="9" width="13" height="12" rx="3"/></svg>';
  const messageLikeIcon = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4.3 10h4.9l3.1-5.9a1.6 1.6 0 0 1 3 1v3.4h3.5a2.1 2.1 0 0 1 2 2.6l-1.6 7a2.5 2.5 0 0 1-2.4 1.9H4.3A1.3 1.3 0 0 1 3 18.7v-7.4A1.3 1.3 0 0 1 4.3 10ZM7 10v10"/></svg>';
  const messageDislikeIcon = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><g transform="rotate(180 12 12)"><path d="M4.3 10h4.9l3.1-5.9a1.6 1.6 0 0 1 3 1v3.4h3.5a2.1 2.1 0 0 1 2 2.6l-1.6 7a2.5 2.5 0 0 1-2.4 1.9H4.3A1.3 1.3 0 0 1 3 18.7v-7.4A1.3 1.3 0 0 1 4.3 10ZM7 10v10"/></g></svg>';

  function renderMessageMeta(role) {
    const buttons = `<button type="button" data-message-action="copy" title="复制" aria-label="复制${role === 'user' ? '消息' : '回复'}">${messageCopyIcon}</button>` +
      (role === 'assistant' ? `<button type="button" data-message-action="like" title="赞" aria-label="赞" aria-pressed="false">${messageLikeIcon}</button>` +
      `<button type="button" data-message-action="dislike" title="踩" aria-label="踩" aria-pressed="false">${messageDislikeIcon}</button>` : '');
    return `<div class="conversation-message-meta">${buttons}</div>`;
  }

  conversationThread.addEventListener('click', event => {
    const button = event.target.closest('[data-message-attachment]');
    if (!button) return;
    const entry = messageAttachments.get(button.dataset.messageAttachment);
    if (entry) openArtifactPreview(entry.node, entry.chain);
  });

  conversationThread.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-message-action]');
    if (!button || !conversationThread.contains(button)) return;
    const message = button.closest('.conversation-message');
    if (button.dataset.messageAction === 'copy') {
      const content = message.matches('.user-message') ? message.querySelector('.message-bubble') : message.querySelector('.assistant-content');
      const text = message.matches('.user-message')
        ? [content ? Array.from(content.childNodes).filter(node => !node.classList?.contains('conversation-message-goal-label')).map(node => node.textContent).join('').trim() : '',
          ...Array.from(message.querySelectorAll('[data-message-attachment]'), card => messageAttachments.get(card.dataset.messageAttachment)?.node.name).filter(Boolean),
          ...Array.from(message.querySelectorAll('.artifact-sent-references .artifact-reference-copy'), card => card.innerText.trim())].filter(Boolean).join('\n')
        : Array.from(content.children).filter(node => !node.matches('.conversation-message-meta, .conversation-artifacts, .conversation-subagents, .conversation-progress, .conversation-activity')).map(node => node.innerText.trim()).filter(Boolean).join('\n\n');
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showConversationFeedback('已复制');
      } catch (error) {
        showConversationFeedback('复制失败，请检查剪贴板权限');
      }
      return;
    }
    const wasPressed = button.getAttribute('aria-pressed') === 'true';
    message.querySelectorAll('[data-message-action="like"], [data-message-action="dislike"]').forEach(action => action.setAttribute('aria-pressed', 'false'));
    button.setAttribute('aria-pressed', String(!wasPressed));
  });

  let scheduledPageMode = false;
  function setConversationOpen(open, task = activeConversationTask || conversationTask) {
    if (open && scheduledRunTasks.has(task)) showScheduledTaskDetails(task);
    closeAccessMenus();
    closeConversationArtifactMenu();
    if (!open) closeConversationTaskMenu();
    if (open && activeConversationTask !== task) {
      if (activeConversationTask) setGoalMode(conversationPrompt, false);
      if (activeConversationTask) {
        conversationThreads.set(activeConversationTask, conversationThread.innerHTML);
        conversationComposerDrafts.set(activeConversationTask, conversationPrompt.value);
      }
      activeConversationTask = task;
      conversationPrompt.value = conversationComposerDrafts.has(task) ? conversationComposerDrafts.get(task) :
        (task === conversationTask && !startedConversationDemos.has(task) ? conversationExamples.get(task).turns.at(-1).prompt : '');
      resizeConversationPrompt();
      const example = conversationExamples.get(task);
      if (conversationThreads.has(task)) {
        conversationThread.innerHTML = conversationThreads.get(task);
      } else {
        const allTurns = example.turns || [{ prompt: example.prompt, reply: example.reply }];
        const turns = task === conversationTask && !startedConversationDemos.has(task) ? allTurns.slice(0, -1) : allTurns;
        const openedAt = new Date();
        conversationThread.innerHTML = turns.map(({ prompt, reply, isGoal, attachments = [], sentAt }, index) =>
          renderConversationTurnTime(sentAt ? new Date(sentAt) : new Date(openedAt.getTime() - (task === conversationTask ? (demoTurnMinutesAgo[index] ?? 4) : 45) * 60000)) +
          renderUserMessage(prompt, attachments.map(name => {
            const folder = FOLDERS.find(entry => entry.id === example.folderId);
            const node = folder?.files.find(file => file.name === name);
            return node ? { node, chain: [folder, node] } : null;
          }).filter(Boolean), isGoal, task === membershipResearchTask && index === turns.length - 1) +
          `<div class="conversation-message assistant-message"><div class="assistant-content">${reply ? `<article class="md conversation-reply">${renderMarkdown(reply)}</article>` : ''}` +
          (example.files.length && index === (task === conversationTask ? allTurns.length - 2 : turns.length - 1) ? '<div class="conversation-artifacts" id="conversationArtifacts" aria-label="对话产物"></div>' : '') +
          (task === conversationTask && startedConversationDemos.has(task) && index === turns.length - 1 ? renderConversationStage() : '') +
          (reply ? renderMessageMeta('assistant') : '') +
          '</div></div>'
        ).join('');
      }
      if (task === conversationTask) {
        const stage = conversationThread.querySelector('.conversation-stage-demo');
        if (stage) {
          stage.classList.remove('is-entering');
          const frameIndex = Number(stage.dataset.stageFrame);
          const planToggle = stage.querySelector('.stage-plan-toggle');
          const planOpen = planToggle ? planToggle.getAttribute('aria-expanded') === 'true' : frameIndex === 0;
          stage.innerHTML = renderConversationStageBody(frameIndex, planOpen);
        }
      }
      refreshConversationTurnTimes();
      renderConversationArtifacts(task);
      const folder = FOLDERS.find((entry) => entry.id === example.folderId);
      if (folder) selectFolder(folder.id);
    }
    artifactSelection?.taskChanged();
    mainView.classList.toggle('conversation-open', open);
    conversationPage.hidden = !open;
    if (!open || task !== conversationTask) clearTimeout(stageAutoTimer);
    syncStageDemoControls();
    if (!open && workbenchExpanded) setWorkbenchExpanded(false);
    if (!open && !summaryPopover.hidden) setSummaryOpen(false);
    if (rightPanel === 'scheduled' && (!open || !scheduledRunTasks.has(task))) setRightPanel(null);
    if (content.classList.contains('wb-scheduled-overlay') && (!open || !scheduledRunTasks.has(task))) {
      content.classList.remove('wb-scheduled-overlay');
      syncScheduledPanelToggle();
    }
    updateSummaryArtifactBadge();
    document.querySelectorAll('.sidebar-scroll .task[aria-current]').forEach(item => item.removeAttribute('aria-current'));
    const selectedSidebarTask = open && scheduledRunTasks.has(activeConversationTask) && !createdScheduledTasks.has(activeConversationTask)
      ? scheduledReportTask : open ? activeConversationTask : null;
    selectedSidebarTask?.setAttribute('aria-current', 'page');
    if (scheduledPageMode) document.getElementById('homeNav').removeAttribute('aria-current');
    else document.getElementById('homeNav').setAttribute('aria-current', 'page');
    if (scheduledPageMode) document.getElementById('scheduledPageNav').setAttribute('aria-current', 'page');
    else document.getElementById('scheduledPageNav').removeAttribute('aria-current');
    document.getElementById('scheduledPage').hidden = !scheduledPageMode || open;
    document.querySelectorAll('.scheduled-sidebar-row[aria-current]').forEach(row => row.removeAttribute('aria-current'));
    if (scheduledPageMode && open && scheduledRunTasks.has(task)) {
      const canonicalTask = createdScheduledTasks.has(task) ? task : scheduledReportTask;
      document.querySelectorAll('.scheduled-sidebar-row').forEach(row => {
        if (scheduledPageTasks[Number(row.dataset.scheduledPageIndex)] === canonicalTask) row.setAttribute('aria-current', 'page');
      });
    }
    if (open) updateConversationTaskTitle(task);
    if (content.classList.contains('wb-expanded')) renderWorkspaceTabs();
    if (!summaryPopover.hidden || isScheduledPanelOpen()) renderSummaryContents();
    if (open) {
      if (task === conversationTask) scheduleStageAutoAdvance(conversationThread.querySelector('.conversation-stage-demo'));
      const keepScheduledPanel = scheduledRunTasks.has(task) &&
        (rightPanel === 'scheduled' && !content.classList.contains('wb-expanded') ||
          rightPanel === 'tools' && content.classList.contains('wb-scheduled-overlay'));
      if (!keepScheduledPanel) setWorkbench(false);
      renderConversationTurnNav();
      requestAnimationFrame(() => {
        conversationScroll.scrollTop = task === conversationTask || task === membershipResearchTask ? conversationScroll.scrollHeight : 0;
        updateConversationTurnNav();
      });
    }
  }

  const scheduledPage = document.getElementById('scheduledPage');
  const scheduledSidebarPinned = document.getElementById('scheduledSidebarPinned');
  const scheduledSidebarScroll = document.getElementById('scheduledSidebarScroll');
  const scheduledSidebarList = document.getElementById('scheduledSidebarList');
  const scheduledTemplateGrid = document.getElementById('scheduledTemplateGrid');
  let scheduledPageTasks = [];
  const scheduledPageTemplates = [
    { name:'每日工作日报', description:'整理今日的工作日志，生成日报摘要。', prompt:'整理今天的任务、对话和产物，生成一份简洁的工作日报，列出已完成事项、待处理问题和明日计划。', repeat:'工作日', time:'19:00' },
    { name:'每周工作周报', description:'汇总本周进度、成果与下周计划。', prompt:weeklyReportPrompt, repeat:'每周', time:'09:00' },
    { name:'每日日程提醒', description:'汇总今日日程与待办，准时提醒。', prompt:'每天早上汇总今日日程、临近截止的任务和需要提前准备的资料，给出一份简短提醒。', repeat:'每日', time:'08:30' },
    { name:'每周项目进展', description:'回顾项目进度与待确认事项。', prompt:'每周汇总各项目的完成进度、阻塞问题与下一步行动，列出需要我确认的事项。', repeat:'每周', time:'10:00' },
    { name:'月度经营提醒', description:'按月提醒关键经营节点。', prompt:'每月提醒我核对上月经营数据、待完成事项和本月关键节点。', repeat:'每月', time:'09:00' },
    { name:'每周资料整理', description:'整理一周新增资料和产物。', prompt:'每周整理新增资料和工作产物，按项目归档并标出需要复核的内容。', repeat:'每周', time:'17:00' },
  ];
  const scheduledTemplateIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z"/><path d="M14 2.5v4h4M8 12h8M8 16h6"/></svg>';
  const scheduledPageMenu = document.createElement('div');
  scheduledPageMenu.className = 'scheduled-page-action-menu';
  scheduledPageMenu.setAttribute('role', 'menu');
  scheduledPageMenu.hidden = true;
  scheduledPageMenu.innerHTML = [
    ['run', '立即运行'], ['edit', '编辑'], ['history', '查看运行记录'], ['pause', '暂停任务'], ['delete', '删除任务'],
  ].map(([action, label]) => `<button type="button" role="menuitem" data-scheduled-page-action="${action}"><img src="assets/scheduled-menu-${action}.svg" alt="" width="16" height="16"><span>${label}</span></button>`).join('');
  document.body.append(scheduledPageMenu);
  let scheduledPageMenuTask = null;

  function scheduledOverviewTasks() {
    const all = [scheduledReportTask, ...document.querySelectorAll('.sidebar-scroll .task[data-task-type="scheduled"]')];
    return [...new Set(all)].filter(task => task.isConnected).sort((a, b) => Number(b.dataset.pinned === 'true') - Number(a.dataset.pinned === 'true'));
  }
  function renderScheduledTemplates() {
    scheduledTemplateGrid.innerHTML = scheduledPageTemplates.map((item, index) =>
      `<button class="scheduled-template-card" type="button" data-scheduled-template="${index}"><span class="scheduled-template-icon">${scheduledTemplateIcon}</span><span class="scheduled-template-copy"><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small></span></button>`
    ).join('');
  }
  function renderScheduledOverview() {
    scheduledPageTasks = scheduledOverviewTasks();
    const sidebarGroups = [
      { label:'启用中', rows:[] },
      { label:'已暂停', rows:[] },
      { label:'已终止', rows:[] },
    ];
    scheduledPageTasks.forEach((task, index) => {
      const name = task.querySelector('.task-name')?.textContent.trim() || '定时任务';
      const config = createdScheduledTasks.get(task) || legacyScheduledConfig;
      const groupIndex = config.terminated ? 2 : config.paused ? 1 : 0;
      const current = !conversationPage.hidden && scheduledRunTasks.has(activeConversationTask) &&
        (createdScheduledTasks.has(activeConversationTask) ? activeConversationTask : scheduledReportTask) === task;
      const unread = task === scheduledReportTask && scheduledRuns.some(run => run.status === 'new');
      sidebarGroups[groupIndex].rows.push(`<div class="scheduled-sidebar-row" data-scheduled-page-index="${index}"${current ? ' aria-current="page"' : ''}><button type="button" data-scheduled-page-open="${index}" title="${esc(name)}"><span class="scheduled-sidebar-title">${esc(name)}</span><span class="scheduled-sidebar-schedule">${esc(config.schedule || '每日 09:00')}</span></button>${unread ? '<span class="scheduled-sidebar-state"><i class="dot-new" role="img" aria-label="新消息"></i></span>' : ''}<button class="scheduled-sidebar-row-more" type="button" data-scheduled-page-more="${index}" aria-label="${esc(name)}的更多操作"><img src="assets/scheduled-panel-more.svg" alt=""></button></div>`);
    });
    scheduledSidebarList.innerHTML = sidebarGroups.map(group =>
      `<section class="scheduled-sidebar-group" aria-label="${group.label}"><div class="section-label"><span>${group.label}</span></div>${group.rows.join('') || '<p class="scheduled-sidebar-empty">暂无任务</p>'}</section>`
    ).join('');
  }
  function setScheduledPageMode(enabled) {
    scheduledPageMode = enabled;
    win.classList.toggle('scheduled-view', enabled);
    document.querySelector('.project-title').textContent = enabled ? '定时任务' : '我的项目';
    document.querySelector('.sidebar-pinned').hidden = enabled;
    document.querySelector('.sidebar-scroll').hidden = enabled;
    scheduledSidebarPinned.hidden = !enabled;
    scheduledSidebarScroll.hidden = !enabled;
    if (enabled) document.getElementById('scheduledPageNav').setAttribute('aria-current', 'page');
    else document.getElementById('scheduledPageNav').removeAttribute('aria-current');
    if (enabled) {
      renderScheduledOverview();
      if (win.classList.contains('collapsed')) setCollapsed(false);
      setConversationOpen(false);
      setRightPanel(null);
      scheduledSidebarScroll.scrollTop = 0;
    } else {
      scheduledPage.hidden = true;
      document.getElementById('homeNav').setAttribute('aria-current', 'page');
    }
  }
  function openScheduledOverviewTask(index) {
    const task = scheduledPageTasks[index];
    if (!task) return;
    setConversationOpen(true, task === scheduledReportTask ? scheduledRuns[0].task : task);
    renderScheduledOverview();
  }
  function closeScheduledPageMenu() {
    scheduledPageMenu.hidden = true;
    scheduledPageMenuTask = null;
  }
  function openScheduledPageMenu(button, index) {
    const task = scheduledPageTasks[index];
    if (!task) return;
    scheduledPageMenuTask = task;
    const config = createdScheduledTasks.get(task) || legacyScheduledConfig;
    const pauseButton = scheduledPageMenu.querySelector('[data-scheduled-page-action="pause"]');
    pauseButton.querySelector('span').textContent = config.paused ? '启用任务' : '暂停任务';
    pauseButton.querySelector('img').src = config.paused ? 'assets/scheduled-menu-run.svg' : 'assets/scheduled-menu-pause.svg';
    pauseButton.disabled = Boolean(config.terminated);
    scheduledPageMenu.querySelector('[data-scheduled-page-action="run"]').disabled = Boolean(config.paused || config.terminated || config.demoState === 'running');
    scheduledPageMenu.hidden = false;
    const rect = button.getBoundingClientRect();
    placeWindowMenu(scheduledPageMenu, rect.right - scheduledPageMenu.offsetWidth, rect.bottom + 4, rect.top - 4);
    scheduledPageMenu.querySelector('button:not(:disabled)')?.focus();
  }
  [scheduledPage, scheduledSidebarScroll].forEach(area => area.addEventListener('click', event => {
    const more = event.target.closest('[data-scheduled-page-more]');
    if (more) { event.stopPropagation(); openScheduledPageMenu(more, Number(more.dataset.scheduledPageMore)); return; }
    const open = event.target.closest('[data-scheduled-page-open]');
    if (open) openScheduledOverviewTask(Number(open.dataset.scheduledPageOpen));
  }));
  scheduledPageMenu.addEventListener('click', event => {
    const action = event.target.closest('[data-scheduled-page-action]')?.dataset.scheduledPageAction;
    const task = scheduledPageMenuTask;
    if (!action || !task) return;
    closeScheduledPageMenu();
    if (action === 'run') {
      runScheduledTaskNow(task);
    } else if (action === 'history') {
      openScheduledOverviewTask(scheduledPageTasks.indexOf(task));
      setScheduledPanelOpen(true);
      document.getElementById('scheduledRunList').scrollIntoView({ block:'nearest' });
    } else if (action === 'pause') {
      const config = createdScheduledTasks.get(task) || legacyScheduledConfig;
      config.paused = !config.paused;
      if (selectedScheduledTask === task) showScheduledTaskDetails(task);
      renderScheduledOverview();
    } else {
      void runTaskMenuAction(action === 'edit' ? 'edit-scheduled' : action, task).then(renderScheduledOverview);
    }
  });
  document.addEventListener('pointerdown', event => { if (!scheduledPageMenu.contains(event.target) && !event.target.closest('[data-scheduled-page-more]')) closeScheduledPageMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeScheduledPageMenu(); });
  window.addEventListener('scroll', closeScheduledPageMenu, true);
  document.getElementById('scheduledPageNav').addEventListener('click', event => { event.preventDefault(); setScheduledPageMode(true); });
  document.getElementById('scheduledSidebarCreate').addEventListener('click', () => setScheduledEditing(true, 'create'));
  scheduledTemplateGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-scheduled-template]');
    if (!button) return;
    const template = scheduledPageTemplates[Number(button.dataset.scheduledTemplate)];
    setScheduledEditing(true, 'create');
    scheduledEditForm.elements.namedItem('name').value = template.name;
    scheduledEditForm.elements.namedItem('prompt').value = template.prompt;
    scheduledEditForm.elements.namedItem('repeat').value = template.repeat;
    scheduledEditForm.elements.namedItem('time').value = template.time;
    updateScheduledCustomRows();
    updateScheduledFieldCounts();
  });
  renderScheduledTemplates();
  renderScheduledOverview();
  new MutationObserver(() => { if (scheduledPageMode) renderScheduledOverview(); }).observe(looseTasksInner, { childList:true, subtree:true, characterData:true });

function resizeConversationPrompt() {
conversationPrompt.style.height = 'auto';
conversationPrompt.style.height = `${Math.min(conversationPrompt.scrollHeight, 130)}px`;
    conversationSend.disabled = !conversationPrompt.value.trim() && ((!selectedLibraryFiles?.get(conversationPrompt)?.length && !selectedSkills?.get(conversationPrompt)?.length) || !conversationGoalTag.hidden);
}

function beginConversationTurn(message) {
  const text = typeof message === 'string' ? message : message.text;
  const attachments = typeof message === 'string' ? [] : message.attachments || [];
  const references = typeof message === 'string' ? [] : message.references || [];
  const receipt = references.length
    ? `已收到针对「${references.map(ref => `${ref.fileName} · ${ref.label}`).join('」、「')}」的修改意见。当前为交互演示，尚未连接生成服务，产物内容没有改变。`
    : '已记录消息。当前原型未连接生成服务，文件内容没有更新；可继续查看原产物或补充要求。';
  conversationThread.insertAdjacentHTML('beforeend',
    renderConversationTurnTime(new Date()) + renderUserMessage(text, attachments, false, false, references) +
    `<div class="conversation-message assistant-message"><div class="assistant-content"><p class="conversation-prototype-receipt">${esc(receipt)}</p>${renderMessageMeta('assistant')}</div></div>`);
  moveConversationProgressToLatestTurn();
  renderConversationTurnNav();
  requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
}

  function sendConversationMessage() {
  const text = conversationPrompt.value.trim();
  const files = selectedLibraryFiles.get(conversationPrompt);
    if (!text && !files.length && !selectedSkills.get(conversationPrompt).length && !artifactSelection?.entries().length) return;
  if (!conversationGoalTag.hidden) {
    if (!text) return;
    updateGoal(conversationPrompt, text);
    conversationThread.insertAdjacentHTML('beforeend',
      renderConversationTurnTime(new Date()) + renderUserMessage(text, [], true) +
      `<div class="conversation-message assistant-message"><div class="assistant-content"><p>目标已设置，后续对话将以此为约束。</p>${renderMessageMeta('assistant')}</div></div>`);
    moveConversationProgressToLatestTurn();
    setGoalMode(conversationPrompt, false);
    renderConversationTurnNav();
    requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
    conversationPrompt.value = '';
    resizeConversationPrompt();
    return;
  }
    const message = {
      text: [text, ...selectedSkills.get(conversationPrompt).map(name => `skill:${name}`)].filter(Boolean).join(' '),
      attachments: [...files],
      references: artifactSelection?.entries().slice() || [],
    };
  if (activeConversationTask === conversationTask && !startedConversationDemos.has(conversationTask)) {
    startedConversationDemos.add(conversationTask);
    conversationThread.insertAdjacentHTML('beforeend',
      renderConversationTurnTime(new Date()) + renderUserMessage(message.text, message.attachments, false, false, message.references) +
      `<div class="conversation-message assistant-message"><div class="assistant-content">${renderConversationStage(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)}</div></div>`);
    renderConversationTurnNav();
    syncStageDemoControls();
    if (reducedMotion.matches) scheduleStageAutoAdvance(conversationThread.querySelector('.conversation-stage-demo'));
    requestAnimationFrame(() => {
      const sentMessage = Array.from(conversationThread.querySelectorAll('.user-message')).at(-1);
      if (!sentMessage) return;
      conversationScroll.scrollTop += sentMessage.getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top - 12;
    });
  } else {
    beginConversationTurn(message);
  }
    conversationPrompt.value = '';
    artifactSelection?.clear();
    clearSkillTags(conversationPrompt);
    clearLibraryFileCards(conversationPrompt);
  resizeConversationPrompt();
}

  conversationExamples.forEach((example, task) => {
    task.addEventListener('click', (e) => {
      if (e.target.closest('.row-acts, .row-act')) return;
      e.preventDefault();
      setConversationOpen(true, task);
    });
  });
  function returnHome(event) {
    event.preventDefault();
    setScheduledPageMode(false);
    setConversationOpen(false);
  }
  document.getElementById('homeNav').addEventListener('click', returnHome);
  document.getElementById('railBrand').addEventListener('click', returnHome);
  document.getElementById('railTasksNav').addEventListener('click', (event) => {
    event.preventDefault();
    if (scheduledPageMode) {
      setScheduledPageMode(false);
      setConversationOpen(false);
    }
    if (win.classList.contains('collapsed')) setCollapsed(false);
    document.querySelector('.sidebar-scroll').scrollTop = 0;
  });
  newTaskNav.addEventListener('click', (e) => {
    e.preventDefault();
    setScheduledPageMode(false);
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
    const trigger = event.target.closest('.conversation-subagent-toggle');
    if (!trigger || !conversationThread.contains(trigger)) return;
    const expanded = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(expanded));
    const items = trigger.nextElementSibling;
    items.inert = !expanded;
    items.setAttribute('aria-hidden', String(!expanded));
  });
  conversationThread.addEventListener('click', (event) => {
    const button = event.target.closest('[data-subagent-index]');
    if (!button || activeConversationTask !== conversationTask) return;
    const agent = conversationSubagents[Number(button.dataset.subagentIndex)];
    if (!agent) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    const detail = button.nextElementSibling;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', `${agent.work}，${agent.state === 'done' ? '已完成' : '进行中'}，${expanded ? '收起' : '展开'}详情`);
    detail.hidden = !expanded;
    detail.inert = !expanded;
    detail.setAttribute('aria-hidden', String(!expanded));
  });
  conversationThread.addEventListener('click', (event) => {
    const trigger = event.target.closest('.conversation-activity-thinking');
    if (!trigger || !conversationThread.contains(trigger)) return;
    const expanded = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(expanded));
    const details = trigger.nextElementSibling;
    details.inert = !expanded;
    details.setAttribute('aria-hidden', String(!expanded));
  });
  conversationThread.addEventListener('click', (event) => {
    const button = event.target.closest('[data-read-file]');
    if (!button || activeConversationTask !== conversationTask) return;
    const example = conversationExamples.get(activeConversationTask);
    const folder = FOLDERS.find((entry) => entry.id === example.folderId);
    const node = folder?.files.find((file) => file.name === button.dataset.readFile);
    if (node) {
      anchorConversationToArtifact(button);
      openArtifactPreview(node, [folder, node]);
    }
  });
  const conversationArtifactMenu = document.createElement('div');
  conversationArtifactMenu.id = 'conversationArtifactMenu';
  conversationArtifactMenu.className = 'row-menu conversation-artifact-menu';
  conversationArtifactMenu.setAttribute('role', 'menu');
  conversationArtifactMenu.hidden = true;
  document.body.appendChild(conversationArtifactMenu);
  let artifactMenuTrigger = null;
  let artifactMenuTarget = null;

  function conversationArtifactTarget(card) {
    const example = conversationExamples.get(activeConversationTask);
    const folder = FOLDERS.find((entry) => entry.id === example?.folderId);
    const name = example?.files[Number(card.dataset.artifactIndex)];
    const node = example?.fileNodes?.[Number(card.dataset.artifactIndex)] || folder?.files.find((file) => file.name === name);
    return node ? { node, chain: [folder, node], card } : null;
  }

  function closeConversationArtifactMenu(restoreFocus = false) {
    if (conversationArtifactMenu.hidden) return;
    conversationArtifactMenu.hidden = true;
    conversationArtifactMenu.classList.remove('open');
    artifactMenuTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && artifactMenuTrigger?.isConnected) artifactMenuTrigger.focus();
    artifactMenuTrigger = null;
    artifactMenuTarget = null;
  }

  function renderConversationArtifactMenu(view = 'main') {
    const node = artifactMenuTarget.node;
    const config = openWithConfig(node);
    if (view === 'apps') {
      conversationArtifactMenu.setAttribute('aria-label', `打开「${node.name}」的方式`);
      conversationArtifactMenu.innerHTML = `<button class="row-menu-item" type="button" role="menuitem" data-artifact-action="back"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>打开方式</span></button>` +
        `<button class="row-menu-item" type="button" role="menuitem" data-artifact-app="${esc(config.label)}" data-divider><span class="conversation-artifact-app-icon">${OPEN_WITH_ICONS[config.primary]}</span><span>${esc(config.label)}</span></button>` +
        config.apps.map(([icon, label]) => `<button class="row-menu-item" type="button" role="menuitem" data-artifact-app="${esc(label)}"><span class="conversation-artifact-app-icon">${OPEN_WITH_ICONS[icon]}</span><span>${esc(label)}</span></button>`).join('');
      return;
    }
    conversationArtifactMenu.setAttribute('aria-label', `「${node.name}」的文件操作`);
    conversationArtifactMenu.innerHTML = [
      ['open', '打开', FILE_ACTION_ICONS.open],
      ['apps', '打开方式', FILE_ACTION_ICONS.default],
      ['chat', '添加到对话', FILE_ACTION_ICONS.chat],
      ['share', '分享', '<path d="M12 16V3m-4 4 4-4 4 4"/><path d="M4 13v5a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5"/>'],
      ['download', '下载', '<path d="M12 3.5v10.8m-4.5-3.3 3.8 3.8a1 1 0 0 0 1.4 0l3.8-3.8"/><path d="M3 15.5v2.2a2.8 2.8 0 0 0 2.8 2.8h12.4a2.8 2.8 0 0 0 2.8-2.8v-2.2"/>'],
    ].map(([action, label, icon]) => `<button class="row-menu-item" type="button" role="menuitem" data-artifact-action="${action}"${action === 'chat' ? ' data-divider' : ''}><svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${icon}</svg><span>${label}</span>${action === 'apps' ? '<span class="conversation-artifact-menu-chevron" aria-hidden="true">›</span>' : ''}</button>`).join('');
  }

  function positionConversationArtifactMenu() {
    const rect = artifactMenuTrigger.getBoundingClientRect();
    conversationArtifactMenu.style.visibility = 'hidden';
    conversationArtifactMenu.style.transform = 'none';
    const bounds = menuBounds();
    const left = rect.right - conversationArtifactMenu.offsetWidth < bounds.left ? rect.left : rect.right - conversationArtifactMenu.offsetWidth;
    placeWindowMenu(conversationArtifactMenu, left, rect.bottom + 4, rect.top - 4);
    conversationArtifactMenu.style.transform = '';
    conversationArtifactMenu.style.visibility = '';
  }

  function downloadConversationArtifact(node) {
    const preview = node.preview;
    const text = preview?.kind === 'html' ? preview.html : preview?.kind === 'markdown' ? preview.text : null;
    if (typeof text !== 'string') {
      showFileDetails('下载文件', `<p>「${esc(node.name)}」目前只有演示预览，没有可下载的原始文件，未开始下载。</p>`);
      return;
    }
    const type = preview.kind === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8';
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = node.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  conversationThread.addEventListener('click', (event) => {
    const more = event.target.closest('.conversation-artifact-more');
    if (more && conversationThread.contains(more)) {
      event.stopPropagation();
      if (artifactMenuTrigger === more && !conversationArtifactMenu.hidden) { closeConversationArtifactMenu(); return; }
      closeConversationArtifactMenu();
      const target = conversationArtifactTarget(more.closest('.conversation-artifact'));
      if (!target) return;
      closeRowMenu();
      closeTreeContextMenu();
      closeConversationTaskMenu();
      artifactMenuTrigger = more;
      artifactMenuTarget = target;
      renderConversationArtifactMenu();
      conversationArtifactMenu.hidden = false;
      more.setAttribute('aria-expanded', 'true');
      positionConversationArtifactMenu();
      requestAnimationFrame(() => conversationArtifactMenu.classList.add('open'));
      conversationArtifactMenu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
      return;
    }
    const button = event.target.closest('[data-artifact-open]');
    if (!button || !activeConversationTask) return;
    const target = conversationArtifactTarget(button.closest('.conversation-artifact'));
    if (target) {
      closeConversationArtifactMenu();
      anchorConversationToArtifact(target.card);
      openArtifactPreview(target.node, target.chain);
    }
  });

  conversationArtifactMenu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-artifact-action], [data-artifact-app]');
    if (!item || !artifactMenuTarget) return;
    const action = item.dataset.artifactAction;
    if (action === 'apps' || action === 'back') {
      renderConversationArtifactMenu(action === 'apps' ? 'apps' : 'main');
      positionConversationArtifactMenu();
      conversationArtifactMenu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
      return;
    }
    const { node, chain, card } = artifactMenuTarget;
    closeConversationArtifactMenu();
    if (item.dataset.artifactApp) showFileDetails('打开文件', `<p>将使用 ${esc(item.dataset.artifactApp)} 打开「${esc(node.name)}」。</p><p>当前是交互原型，尚未连接本地应用，未实际打开文件。</p>`);
    else if (action === 'open') { anchorConversationToArtifact(card); openArtifactPreview(node, chain); }
    else if (action === 'chat') appendFileToConversation(node);
    else if (action === 'share') shareArtifact(node);
    else if (action === 'download') downloadConversationArtifact(node);
  });
  conversationArtifactMenu.addEventListener('keydown', (event) => {
    const items = Array.from(conversationArtifactMenu.querySelectorAll('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && conversationArtifactMenu.querySelector('[data-artifact-action="back"]')) {
      event.preventDefault();
      renderConversationArtifactMenu();
      positionConversationArtifactMenu();
      conversationArtifactMenu.querySelector('[data-artifact-action="apps"]')?.focus({ preventScroll: true });
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!conversationArtifactMenu.contains(event.target) && !event.target.closest('.conversation-artifact-more')) closeConversationArtifactMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeConversationArtifactMenu(true);
  });
  window.addEventListener('resize', () => closeConversationArtifactMenu());
  window.addEventListener('scroll', () => closeConversationArtifactMenu(), true);

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
  const libraryFileCards = new Map([
    [prompt, document.getElementById('homeFileCards')],
    [conversationPrompt, document.getElementById('conversationFileCards')],
  ]);
  const selectedLibraryFiles = new Map([...libraryFileCards.keys()].map(input => [input, []]));
  const addTriggers = Array.from(document.querySelectorAll('.composer-add-trigger'));
  let activeAddTrigger = null;
  let addMenuPage = 'root';
  let addSubmenuTimer;
  const addLabels = { skill: '技能', expert: '专家', mcp: 'MCP' };
  // 原型没有实际广场接口：专家和 MCP 预置已添加示例，新增项保留在当前会话状态中。
  const installedAddItems = { skill: [], expert: ['数据开发', '产品顾问', '数据分析师', '前端工程师'], mcp: ['日历连接器', '文件系统连接器', '浏览器连接器'] };
  const legacySkillNames = {
    '数据分析': 'data-analysis', '文档写作': 'docx', '文档总结': 'document-summary',
    '网页制作': 'website-development', 'PPT 制作': 'pptx', 'App 设计与开发': 'app-development',
    '代码开发': 'code-development', '视觉设计': 'visual-design', '产品分析': 'product-analysis',
    'Docx': 'docx', 'PDF': 'pdf', 'skill creator': 'skill-creator',
  };
  function normalizeSkillName(name) {
    const clean = String(name || '').trim().replace(/^(?:@技能:|@?skill:)/i, '');
    return legacySkillNames[clean] || clean;
  }
  const skillTagContainers = new Map([
    [prompt, document.getElementById('homeSkillTags')],
    [conversationPrompt, document.getElementById('conversationSkillTags')],
  ]);
  const selectedSkills = new Map([...skillTagContainers.keys()].map(input => [input, []]));
  const skillTagIcon = '<svg viewBox="0 0 24 24" class="ic composer-skill-icon" aria-hidden="true"><rect x="3" y="3.5" width="18" height="17" rx="5.5"/><path d="M7.6 8v8M11.6 8v8M15.6 8l1.6 8"/></svg>';
  const skillTagClearIcon = '<svg viewBox="0 0 24 24" class="ic composer-skill-clear-icon" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5m0-11-11 11"/></svg>';
  function syncComposerTags(input) {
    const tags = input.parentElement.querySelector('.composer-inline-tags');
    const width = tags.offsetWidth;
    const wrapped = width > input.clientWidth - (input === conversationPrompt ? 82 : 72);
    input.parentElement.classList.toggle('has-wrapped-tags', wrapped);
    input.style.setProperty('--composer-tags-indent', width && !wrapped ? `${width + 8}px` : '0px');
  }
  function renderSkillTags(input) {
    const container = skillTagContainers.get(input);
    const skills = selectedSkills.get(input);
    container.replaceChildren(...skills.map((name, index) => {
      const tag = document.createElement('span');
      tag.className = 'composer-skill-tag';
      tag.title = `skill:${name}`;
      tag.innerHTML = `<button class="composer-skill-tag-clear" type="button" data-skill-remove="${index}" title="移除技能">${skillTagIcon}${skillTagClearIcon}</button><span></span>`;
      tag.querySelector('button').setAttribute('aria-label', `移除技能：${name}`);
      tag.querySelector('span').textContent = `skill:${name}`;
      return tag;
    }));
    container.hidden = !skills.length;
    syncComposerTags(input);
  }
  function addSkillTag(input, name) {
    const skillName = normalizeSkillName(name);
    if (!skillName || selectedSkills.get(input).includes(skillName)) return;
    selectedSkills.get(input).push(skillName);
    renderSkillTags(input);
  }
  function clearSkillTags(input) {
    selectedSkills.get(input).length = 0;
    renderSkillTags(input);
  }
  window.addEventListener('resize', () => skillTagContainers.forEach((_, input) => syncComposerTags(input)));
  skillTagContainers.forEach((container, input) => container.addEventListener('click', event => {
    const button = event.target.closest('[data-skill-remove]');
    if (!button) return;
    selectedSkills.get(input).splice(Number(button.dataset.skillRemove), 1);
    renderSkillTags(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }));
  const connectorTrays = new Map([
    [prompt, document.getElementById('connectorTray')],
    [conversationPrompt, document.getElementById('conversationConnectorTray')],
  ]);
  const selectedConnectors = new Map([...connectorTrays.keys()].map(input => [input, new Set()]));
  function activeConnectors() {
    return selectedConnectors.get(addTarget()) || selectedConnectors.get(prompt);
  }
  const galleryExamples = {
    skill: ['document-summary', 'data-analysis', 'website-development'],
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
  let selectedExpert = '数据分析师';
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
      expertMenu.innerHTML = installedAddItems.expert.map((name, index) => `<button class="expert-switch-item" type="button" role="menuitemradio" aria-checked="${name === selectedExpert}" data-expert-index="${index}">${expertAvatar(name)}${expertOptionCopy(name)}${name === selectedExpert ? '<span class="expert-selected-label">已选</span>' : ''}</button>`).join('');
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
  let slashDialogTarget = null;
  addDialog.className = 'composer-add-dialog';
  addDialog.setAttribute('aria-label', '选择要添加的信息');
  document.body.appendChild(addDialog);
  let dialogPage = 'library';
  let dialogFolder = null;
  let dialogQuery = '';
  const addIcons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    file: '<path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a2 2 0 0 0-.6-1.4l-5-5A2 2 0 0 0 13 3Z"/><path d="M14 3.5V7a2 2 0 0 0 2 2h3.5"/>',
    local: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
    library: '<path d="M12 6.3c-2.1-1.5-4.7-1.8-7.4-1.2A2.1 2.1 0 0 0 3 7.2v11.2c0 .7.7 1.2 1.4 1 2.8-.7 5.5-.3 7.6 1.1 2.1-1.4 4.8-1.8 7.6-1.1.7.2 1.4-.3 1.4-1V7.2a2.1 2.1 0 0 0-1.6-2.1c-2.7-.6-5.3-.3-7.4 1.2Z"/><path d="M12 6.3v14.2M6 9.3c.8-.1 1.6 0 2.4.2M6 12.6c.8-.1 1.6 0 2.4.2"/>',
    skill: '<rect x="3" y="3.5" width="18" height="17" rx="5.5"/><path d="M7.6 8v8M11.6 8v8M15.6 8l1.6 8"/>',
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
    if (label.startsWith('skill:')) addSkillTag(input, label.slice(6));
    else input.value += `${input.value && !/\s$/.test(input.value) ? ' ' : ''}@${label} `;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeAddMenu();
    input.focus();
  }
  function renderLibraryFileCards(input) {
    const container = libraryFileCards.get(input);
    const entries = selectedLibraryFiles.get(input);
    container.hidden = entries.length === 0;
    container.innerHTML = entries.map((entry, index) => {
const { node } = entry;
prepareLocalImage(entry);
const type = artifactType(node) || node.type;
const image = /\.(?:png|jpe?g|gif|webp|svg)$/i.test(node.name) || ['image', 'png'].includes(node.type);
const art = image && node.preview?.kind === 'image' ? node.preview.art : null;
const preview = art ? (entry.localFile ? art : `<img src="data:image/svg+xml,${encodeURIComponent(art)}" alt="">`) : (THUMBS[type] || THUMBS[image ? 'image' : 'doc'])();
      return `<div class="composer-file-card" title="${esc(node.name).replace(/"/g, '&quot;')}"><span class="composer-file-preview" aria-hidden="true">${preview}</span><span class="composer-file-name">${esc(node.name)}</span><button class="composer-file-remove" type="button" data-library-file-remove="${index}" aria-label="移除文件：${esc(node.name).replace(/"/g, '&quot;')}" title="移除文件"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5m0-11-11 11"/></svg></button></div>`;
    }).join('');
  }
  libraryFileCards.forEach((container, input) => container.addEventListener('click', event => {
    const remove = event.target.closest('[data-library-file-remove]');
    if (!remove) return;
    selectedLibraryFiles.get(input).splice(Number(remove.dataset.libraryFileRemove), 1);
    renderLibraryFileCards(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }));
  function attachLibraryFile(entry) {
    const input = addTarget();
    if (!input || !entry) return;
    const entries = selectedLibraryFiles.get(input);
    if (!entries.some(item => item.node === entry.node)) entries.push(entry);
    renderLibraryFileCards(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeAddMenu();
    input.focus();
  }
  function clearLibraryFileCards(input) {
    selectedLibraryFiles.get(input).length = 0;
    renderLibraryFileCards(input);
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
      ? items.map((name, index) => `<button class="composer-add-item${kind === 'mcp' && activeConnectors().has(name) ? ' is-selected' : ''}" type="button" data-add-installed="${index}"${kind === 'mcp' || kind === 'expert' ? ` aria-pressed="${kind === 'expert' ? name === selectedExpert : activeConnectors().has(name)}"` : ''}>${kind === 'expert' ? expertAvatar(name) : kind === 'mcp' ? connectorAvatar(name) : addIcon(kind)}${kind === 'expert' ? expertOptionCopy(name) : `<span>${esc(name)}</span>`}${kind === 'expert' && name === selectedExpert ? '<span class="expert-selected-label">已选</span>' : ''}${kind === 'mcp' ? `<span class="composer-add-check" aria-hidden="true">${activeConnectors().has(name) ? '✓' : ''}</span>` : ''}</button>`).join('')
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
      addSubmenu.innerHTML = `<label class="composer-search-field">${addIcon('search')}<input class="composer-add-input" id="composerAddSearch" type="search" aria-label="搜索已添加的${addLabels[kind]}" placeholder="搜索已添加的${addLabels[kind]}" autocomplete="off"></label><div class="composer-add-list"></div><div class="composer-add-divider" aria-hidden="true"></div><button class="composer-add-item composer-add-more" type="button" data-add-open-dialog="${kind}">${addIcon(kind)}<span>${kind === 'skill' ? '管理技能' : `去广场添加更多${addLabels[kind]}`}</span>${addIcon('chevron', 'composer-add-chevron')}</button>`;
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
      + `<label class="composer-search-field">${addIcon('search')}<input class="composer-add-input composer-dialog-search" type="search" aria-label="搜索${isLibrary ? '资料库文件' : title}" placeholder="搜索${isLibrary ? '全部文件' : '广场' + addLabels[dialogPage]}" value="${esc(dialogQuery)}" autocomplete="off"></label>`
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
    if (slashDialogTarget) {
      const input = slashDialogTarget;
      slashDialogTarget = null;
      closeAddMenu();
      input.focus();
      return;
    }
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
      attachLibraryFile(entry);
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
    if (kind === 'goal') openGoalInput(activeAddTrigger);
    else if (['file', 'skill', 'expert', 'mcp'].includes(kind)) showAddSubmenu(kind, true);
  });
  addSubmenu.addEventListener('click', event => {
    event.stopPropagation();
    const libraryButton = event.target.closest('[data-add-library]');
    if (libraryButton) {
      const entry = addSubmenu._libraryEntries[Number(libraryButton.dataset.addLibrary)];
      attachLibraryFile(entry);
      return;
    }
    const installedButton = event.target.closest('[data-add-installed]');
    if (installedButton) {
      const name = addSubmenu._visibleInstalled[Number(installedButton.dataset.addInstalled)];
      if (name && addMenuPage === 'mcp') toggleConnector(installedButton, addSubmenu);
      else if (name && addMenuPage === 'expert') {
        selectExpert(name);
        closeAddMenu();
      } else if (name) appendAddReference(`skill:${name}`);
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
      if (input === conversationPrompt) {
        files.forEach(file => {
          const node = { name: file.name, type: file.type };
          selectedLibraryFiles.get(input).push({ node, chain: [node], localFile: file });
        });
        renderLibraryFileCards(input);
      } else {
        files.forEach(file => {
          input.value += `${input.value && !/\s$/.test(input.value) ? ' ' : ''}@${file.name} `;
        });
      }
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

  /* 首页与对话输入框共用的 / 快捷菜单；原型未接入的功能不伪装成已执行。 */
  const slashMenu = document.createElement('div');
  slashMenu.id = 'composerSlashMenu';
  slashMenu.className = 'composer-slash-menu';
  slashMenu.setAttribute('role', 'menu');
  slashMenu.setAttribute('aria-label', '快捷功能');
  slashMenu.hidden = true;
  document.body.appendChild(slashMenu);
  const slashInputs = [prompt, conversationPrompt];
  const slashCommands = [
    { id: 'goal', label: 'Goal', description: '设置为任务持续努力实现的目标', icon: 'goal' },
    { id: 'new-chat', label: '新对话', description: '开始一个新的对话', icon: 'new-chat' },
    { id: 'settings', label: '打开设置', description: '查看应用设置', icon: 'settings' },
    { id: 'skills-gallery', label: 'Skills 广场', description: '浏览并添加 Skills', icon: 'skill' },
    { id: 'create-command', label: '创建快捷指令', description: '管理自定义快捷指令', icon: 'write' },
    { id: 'update', label: '更新妙手', description: '检查并安装最新版本', icon: 'refresh' },
    { id: 'pet', label: '宠物', description: '唤起桌面宠物', icon: 'pet' },
  ];
  const slashIcons = {
    'new-chat': '<path d="M7.5 3.5h9A4.5 4.5 0 0 1 21 8v6.5a4.5 4.5 0 0 1-4.5 4.5h-1.7l-2.2 1.8a1 1 0 0 1-1.2 0L9.2 19H7.5A4.5 4.5 0 0 1 3 14.5V8a4.5 4.5 0 0 1 4.5-4.5Z"/><path d="M12 8.5v6M9 11.5h6"/>',
    settings: '<path d="M10.1 3.5Q10.3 3 10.9 3h2.2q.6 0 .8.5l1 2.2q.9.3 1.6.9l1.8-.9q.6-.3 1 .3l1.7 2.9q.3.6-.3 1l-1.8 1q.2 1.1 0 2.2l1.8 1q.6.4.3 1l-1.7 2.9q-.4.6-1 .3l-1.8-.9q-.7.6-1.6.9l-1 2.2q-.2.5-.8.5h-2.2q-.6 0-.8-.5l-1-2.2q-.9-.3-1.6-.9l-1.8.9q-.6.3-1-.3L3 15q-.3-.6.3-1l1.8-1q-.2-1.1 0-2.2l-1.8-1q-.6-.4-.3-1l1.7-2.9q.4-.6 1-.3l1.8.9q.7-.6 1.6-.9Z"/><circle cx="12" cy="12" r="3"/>',
    write: '<path d="M5 21h14M6 14l9.5-9.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
    refresh: '<g transform="translate(0 -.5)"><path d="M20.5 10a9 9 0 1 0 .5 4M20.5 5.5V10H16"/></g>',
    pet: '<path d="M5 9.2V5.5l3.2 2.1a9.3 9.3 0 0 1 7.6 0L19 5.5v3.7a7.5 7.5 0 0 1 1.5 4.6c0 4.1-3.5 7-8.5 7s-8.5-2.9-8.5-7A7.5 7.5 0 0 1 5 9.2Z"/><path d="M9 14h.01M15 14h.01M12 16.6v.1"/>',
    shortcuts: '<rect x="3" y="4" width="18" height="16" rx="5"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  };
  const slashIcon = kind => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${addIcons[kind] || slashIcons[kind]}</svg>`;
  let slashInput = null;
  let slashMatch = null;
  let slashPage = 'root';
  let slashActive = 0;
  let slashDismissed = null;
  function slashToken(input) {
    if (input.selectionStart !== input.selectionEnd) return null;
    const before = input.value.slice(0, input.selectionStart);
    const match = /(^|\s)\/([^\s/]*)$/u.exec(before);
    return match ? { start: before.length - match[2].length - 1, end: before.length, query: match[2] } : null;
  }
  function closeSlashMenu(dismiss = false) {
    if (dismiss && slashInput && slashMatch) slashDismissed = { input: slashInput, start: slashMatch.start, text: slashInput.value };
    slashMenu.hidden = true;
    slashInput?.setAttribute('aria-expanded', 'false');
    slashInput?.removeAttribute('aria-activedescendant');
    slashInput = null;
    slashMatch = null;
    slashPage = 'root';
  }
  function placeSlashMenu() {
    if (!slashInput || slashMenu.hidden) return;
    const anchor = slashInput.closest('.composer-card, .conversation-composer').getBoundingClientRect();
    const bounds = win.getBoundingClientRect();
    slashMenu.style.width = `${Math.min(500, anchor.width, bounds.width - 16)}px`;
    const width = slashMenu.offsetWidth;
    const height = slashMenu.offsetHeight;
    slashMenu.style.left = `${Math.max(bounds.left + 8, Math.min(anchor.left, bounds.right - width - 8))}px`;
    slashMenu.style.top = `${anchor.top - height - 6 >= bounds.top + 8 ? anchor.top - height - 6 : Math.max(bounds.top + 8, Math.min(anchor.bottom + 6, bounds.bottom - height - 8))}px`;
  }
  function setSlashActive(index) {
    const options = [...slashMenu.querySelectorAll('[data-slash-action]')];
    if (!options.length) { slashInput?.removeAttribute('aria-activedescendant'); return; }
    slashActive = (index + options.length) % options.length;
    options.forEach((option, i) => option.classList.toggle('is-active', i === slashActive));
    slashInput?.setAttribute('aria-activedescendant', options[slashActive].id);
    options[slashActive].scrollIntoView({ block: 'nearest' });
  }
  function slashRow(id, label, description, icon, next = false) {
    return `<button id="slash-option-${id}" class="composer-slash-item" type="button" role="menuitem" tabindex="-1" data-slash-action="${id}"${next ? ' aria-haspopup="menu"' : ''}>${slashIcon(icon)}<span class="composer-slash-copy"><strong>${esc(label)}</strong><small>${esc(description)}</small></span>${next ? addIcon('chevron', 'composer-slash-chevron') : ''}</button>`;
  }
  function renderSlashMenu() {
    if (!slashInput) return;
    const query = slashPage === 'root' ? slashMatch.query.toLocaleLowerCase() : '';
    const matches = ({ label, description }) => `${label} ${description}`.toLocaleLowerCase().includes(query);
    let rows;
    if (slashPage === 'shortcuts') {
      rows = slashCommands.filter(matches).map(({ id, label, description, icon }) => slashRow(id, label, description, icon)).join('');
    } else if (slashPage === 'skills') {
      slashMenu._skills = installedAddItems.skill;
      rows = slashMenu._skills.map((name, index) => slashRow(`skill-${index}`, name, '添加到当前对话', 'skill')).join('');
      rows += slashRow('manage-skills', '管理技能', '浏览并添加 Skills', 'skill');
    } else {
      rows = [
        { id: 'skills', label: '技能', description: '选择已添加的 Skills', icon: 'skill' },
        { id: 'shortcuts', label: '快捷功能', description: '打开常用操作', icon: 'shortcuts' },
      ].filter(matches).map(({ id, label, description, icon }) => slashRow(id, label, description, icon, true)).join('');
      if (query && !rows) rows = slashCommands.filter(matches).map(({ id, label, description, icon }) => slashRow(id, label, description, icon)).join('');
    }
    slashMenu.innerHTML = (slashPage === 'root' ? '' : `<div class="composer-slash-heading"><button class="composer-slash-back" type="button" data-slash-back aria-label="返回上一级">${addIcon('back')}</button><span>${slashPage === 'skills' ? '技能' : '快捷功能'}</span></div>`)
      + (rows || '<p class="composer-add-empty">没有匹配的功能</p>')
      + '<p class="composer-slash-notice" role="status" aria-live="polite" hidden></p>';
    slashActive = 0;
    setSlashActive(0);
    placeSlashMenu();
  }
  function updateSlashMenu(input) {
    if (document.activeElement !== input || input.closest('.conversation-page')?.hidden) { if (slashInput === input) closeSlashMenu(); return; }
    const token = slashToken(input);
    if (!token || (slashDismissed?.input === input && slashDismissed.start === token.start && slashDismissed.text === input.value)) {
      if (slashInput === input) closeSlashMenu();
      return;
    }
    slashDismissed = null;
    if (slashInput !== input || slashMatch?.start !== token.start) {
      closeSlashMenu();
      closeAddMenu();
      slashInput = input;
      slashPage = 'root';
    }
    slashMatch = token;
    input.setAttribute('aria-expanded', 'true');
    slashMenu.hidden = false;
    renderSlashMenu();
  }
  function consumeSlashToken() {
    const input = slashInput;
    const { start, end } = slashMatch;
    closeSlashMenu();
    input.setRangeText('', start, end, 'start');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    return input;
  }
  function activateSlashAction(action) {
    if (action === 'skills' || action === 'shortcuts') { slashPage = action; renderSlashMenu(); return; }
    if (action === 'manage-skills' || action === 'skills-gallery') {
      const input = consumeSlashToken();
      slashDialogTarget = input;
      activeAddTrigger = input.closest('.composer-card, .conversation-composer').querySelector('.composer-add-trigger');
      addMenuPage = 'skill';
      openAddDialog('skill');
      return;
    }
    if (action.startsWith('skill-')) {
      const name = slashMenu._skills[Number(action.slice(6))];
      if (name) { const input = consumeSlashToken(); addSkillTag(input, name); input.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    if (action === 'goal') {
      const input = consumeSlashToken();
      setGoalMode(input, true);
    } else if (action === 'new-chat') {
      consumeSlashToken();
      newTaskNav.click();
    } else {
      const notice = slashMenu.querySelector('.composer-slash-notice');
      notice.hidden = false;
      notice.textContent = '此功能暂未接入原型';
      placeSlashMenu();
    }
  }
  slashInputs.forEach(input => {
    input.setAttribute('aria-haspopup', 'menu');
    input.setAttribute('aria-controls', slashMenu.id);
    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', event => { if (!event.isComposing) updateSlashMenu(input); });
    input.addEventListener('compositionend', () => updateSlashMenu(input));
    input.addEventListener('click', () => updateSlashMenu(input));
    input.addEventListener('keyup', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) updateSlashMenu(input); });
    input.addEventListener('keydown', event => {
      if (slashMenu.hidden || slashInput !== input || event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeSlashMenu(true); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSlashActive(slashActive + (event.key === 'ArrowDown' ? 1 : -1)); }
      else if (event.key === 'ArrowLeft' && slashPage !== 'root') { event.preventDefault(); slashPage = 'root'; renderSlashMenu(); }
      else if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'ArrowRight' && slashMenu.querySelectorAll('[data-slash-action]')[slashActive]?.hasAttribute('aria-haspopup'))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const action = slashMenu.querySelectorAll('[data-slash-action]')[slashActive]?.dataset.slashAction;
        if (action) activateSlashAction(action);
      }
    }, true);
  });
  slashMenu.addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
  slashMenu.addEventListener('pointermove', event => {
    const item = event.target.closest('[data-slash-action]');
    if (item && !item.classList.contains('is-active')) setSlashActive([...slashMenu.querySelectorAll('[data-slash-action]')].indexOf(item));
  });
  slashMenu.addEventListener('click', event => {
    const item = event.target.closest('[data-slash-action]');
    if (item) activateSlashAction(item.dataset.slashAction);
    else if (event.target.closest('[data-slash-back]')) { slashPage = 'root'; renderSlashMenu(); slashInput.focus(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!slashMenu.hidden && !slashMenu.contains(event.target) && event.target !== slashInput) closeSlashMenu(true);
  });
  slashInputs.forEach(input => input.addEventListener('blur', () => {
    requestAnimationFrame(() => { if (slashInput === input && document.activeElement !== input && !slashMenu.contains(document.activeElement)) closeSlashMenu(); });
  }));
  window.addEventListener('resize', placeSlashMenu);
  window.addEventListener('scroll', event => { if (!slashMenu.contains(event.target)) placeSlashMenu(); }, true);

  // 目标使用输入框内的单次输入模式；发送时记录为当前任务目标，而非普通提问。
  function setGoalMode(input, enabled) {
    const tag = input === conversationPrompt ? conversationGoalTag : homeGoalTag;
    tag.hidden = !enabled;
    input.placeholder = enabled ? '描述具体的技术目标、约束与验收口径' : input === conversationPrompt ? '继续对话' : '描述你的需求，输出专业结果';
    if (input === prompt) {
      promptChip.hidden = enabled || !promptGuide;
      syncComposerTags(input);
      autoResize();
      refreshSendState();
    } else {
      syncComposerTags(input);
      resizeConversationPrompt();
    }
    if (enabled) input.focus();
  }
  function openGoalInput(trigger) {
    if (!trigger) return;
    const input = trigger.closest('.conversation-page') ? conversationPrompt : prompt;
    closeAddMenu();
    setGoalMode(input, true);
  }
  document.querySelectorAll('.composer-goal-summary').forEach(trigger => trigger.addEventListener('click', () => openGoalInput(trigger)));
  document.querySelectorAll('.composer-goal-tag-clear').forEach(button => button.addEventListener('click', () => {
    const input = button.closest('.conversation-page') ? conversationPrompt : prompt;
    setGoalMode(input, false);
    input.focus();
  }));
  function updateGoal(input, value) {
    if (input === conversationPrompt && activeConversationTask) {
      conversationGoals.set(activeConversationTask, value || null);
    } else if (value) conversationGoals.set(input, value);
    else conversationGoals.delete(input);
    if (input === conversationPrompt) {
      if (!summaryPopover.hidden) renderSummaryContents();
      return;
    }
    const summary = document.querySelector('.composer-row .composer-goal-summary');
    summary.textContent = `目标 · ${value}`;
    summary.title = `设置新目标：${value}`;
    summary.setAttribute('aria-label', `设置新目标：${value}`);
    summary.hidden = !value;
  }

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
  let templateDraftSource = null;
  let templateReturnFocus = null;

  function normalizeTemplate(value) {
    if (!value || typeof value !== 'object' || typeof value.title !== 'string' || typeof value.prompt !== 'string'
      || !value.title.trim() || !value.prompt.trim()) return null;
    const list = items => Array.isArray(items) ? items.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 20) : [];
    return {
      id: crypto.randomUUID(), title: value.title.trim().slice(0, 60),
      description: typeof value.description === 'string' ? value.description.trim().slice(0, 120) : '',
      prompt: value.prompt.trim().slice(0, 10000), skills: list(value.skills).map(normalizeSkillName), mcps: list(value.mcps),
      expert: typeof value.expert === 'string' ? value.expert.trim().slice(0, 60) : '',
      resources: list(value.resources),
      sop: value.sop && ['whole', 'revision'].includes(value.sop.scope)
        ? { scope: value.sop.scope, when: String(value.sop.when || '').slice(0, 1000),
          inputs: String(value.sop.inputs || '').slice(0, 1000), steps: String(value.sop.steps || '').slice(0, 3000),
          checks: String(value.sop.checks || '').slice(0, 1000) } : null,
      source: value.source && typeof value.source === 'object' && typeof value.source.file === 'string'
        ? { file: value.source.file.slice(0, 180), type: String(value.source.type || '').slice(0, 30), task: String(value.source.task || '').slice(0, 80) }
        : null,
    };
  }
  const exampleTemplates = [
    { title: '每周经营复盘', description: '汇总指标变化，形成可执行的周度复盘', prompt: '汇总本周经营指标，对比上周和目标，找出关键变化与异常，分析可能原因，并按优先级列出下周行动。', skills: ['data-analysis', 'docx'], mcps: [], expert: '数据分析师', resources: [], example: true },
    { title: '项目资料整理', description: '把零散材料整理成目录和摘要', prompt: '按照项目、日期和文件类型整理资料，识别重复及缺失项，输出清晰的目录与重点内容摘要。', skills: ['document-summary'], mcps: ['文件系统连接器'], expert: '', resources: [], example: true },
    { title: '产品方案评审', description: '用固定检查项快速审阅新方案', prompt: '审阅产品方案，梳理用户场景、关键流程、异常分支、依赖与风险，并列出待确认问题和改进建议。', skills: ['product-analysis'], mcps: [], expert: '产品顾问', resources: [], example: true },
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
      const tags = [...(item.source ? [`来源 · ${item.source.file} · ${item.source.type || '文件'}`] : []),
        ...item.skills.map(name => `skill:${name}`), ...item.mcps.map(name => `MCP · ${name}`),
        ...(item.expert ? [`专家 · ${item.expert}`] : []), ...(item.resources.length ? [`资料 · ${item.resources.length} 项（仅本机）`] : [])];
      const sop = item.sop ? `<details class="template-sop-detail"><summary>${item.sop.scope === 'revision' ? '修改方法' : '任务方法'} · 查看步骤和验收标准</summary><p><strong>适用：</strong>${esc(item.sop.when)}</p><p><strong>需要：</strong>${esc(item.sop.inputs)}</p><p><strong>步骤：</strong>${esc(item.sop.steps)}</p><p><strong>验收：</strong>${esc(item.sop.checks)}</p></details>` : '';
      return `<article class="template-item" data-template-id="${esc(item.id)}"><div class="template-item-main"><span class="template-item-mark" aria-hidden="true">✳</span><div><h3>${esc(item.title)}${item.example ? '<span class="template-example-tag">示例</span>' : ''}</h3><p>${esc(item.description || item.prompt)}</p><div class="template-tags">${tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div></div>${sop}<div class="template-item-actions"><button type="button" data-template-action="use">使用</button><button type="button" data-template-action="edit">编辑</button><button type="button" data-template-action="duplicate">复制</button><button type="button" data-template-action="share">分享</button><button type="button" class="template-danger" data-template-action="delete">删除</button></div></article>`;
    }).join('') : '<div class="template-empty"><span aria-hidden="true">✳</span><h3>把常用流程变成自己的模版</h3><p>组合 Prompt、Skill、MCP、专家和资料；使用时仍可在输入框里调整。</p><button type="button" class="template-create" data-template-action="new">创建第一个模版</button></div>';
  }
  function showTemplateList() {
    templateForm.hidden = true;
    document.getElementById('templateSourceField').hidden = true;
    templateToolbar.hidden = false;
    templateList.hidden = false;
    editingTemplateId = null;
    templateDraftSource = null;
    renderTemplates();
  }
  function editTemplate(item = null) {
    templateMessage('');
    templateForm.reset();
    editingTemplateId = item?.id || null;
    templateDraftSource = item?.source || null;
    document.getElementById('templateSourceField').hidden = !templateDraftSource;
    templateForm.elements.sourceFile.value = templateDraftSource?.file || '';
    document.getElementById('templateFormTitle').textContent = item ? '编辑模版' : '新建模版';
    if (item) for (const name of ['title', 'description', 'prompt', 'skills', 'mcps', 'expert', 'resources']) {
      templateForm.elements[name].value = Array.isArray(item[name]) ? item[name].join('，') : item[name];
    }
    templateToolbar.hidden = true;
    templateList.hidden = true;
    templateForm.hidden = false;
    templateForm.elements.title.focus();
  }
  function createTemplateFromArtifact(node, chain) {
    if (!isArtifactNode(node)) return;
    const task = taskForArtifact(chain);
    const example = task && conversationExamples.get(task);
    const lastPrompt = example?.turns?.findLast(turn => turn.reply && /已完成|已整理/.test(turn.reply))?.prompt || example?.prompt || '';
    const promptDraft = lastPrompt ? `${lastPrompt}\n\n请生成${node.name.split('.').pop()?.toUpperCase() || '同类型'}产物。` : `参考${node.name}生成同类型产物。`;
    const source = { file: node.name, type: artifactType(node) || '文件', task: task?.querySelector('.task-name')?.textContent.trim() || '' };
    templateReturnFocus = document.activeElement;
    templateMessage('');
    templateDialog.showModal();
    editTemplate({ title: `${node.name.replace(/\.[^.]+$/, '')}生成流程`.slice(0, 60),
      description: `基于${node.name}的可编辑生成流程`, prompt: promptDraft,
      skills: [], mcps: [], expert: '', resources: [], source });
    templateDraftSource = source;
    document.getElementById('templateFormTitle').textContent = '从产物保存模版';
    templateMessage('请检查并删改 Prompt 和引用；仅保存生成方法与来源，不保存产物内容或完整对话。');
  }
  const sopDialog = document.getElementById('sopDialog');
  const sopForm = document.getElementById('sopForm');
  const sopEvidence = document.getElementById('sopEvidence');
  const sopFormStatus = document.getElementById('sopFormStatus');
  let sopReturnFocus = null;
  let sopScope = 'whole';
  let sopDrafts = {};
  let editingSopId = null;
  // 演示数据：只针对会员权益调研这段已写明的示例对话，不推断任意真实任务。
  const membershipSopDrafts = {
    whole: {
      title: '会员权益竞品调研',
      when: '需要比较同类会员产品，找出具体用户场景中的权益差异时。',
      inputs: '本方和竞品的会员等级、公开权益规则、使用条件及有效期；缺失项由用户补充或标为待核实。',
      steps: '1. 按会员等级、入会成本、适用渠道、使用门槛和有效期统一口径。\n2. 区分常驻权益与限时活动，不把不可比项目直接排序。\n3. 按新客入会、老客复购和高频用户场景比较差异。\n4. 每条结论附上来源及证据状态，列出待核实项。',
      checks: '对比条件一致；没有把过期活动当常驻权益；结论指向具体用户场景；不确定项明确标记。',
      prompt: '请基于我提供的会员权益规则，比较本方与竞品在具体用户场景中的权益差异。先核对会员等级、入会成本、使用门槛、适用渠道和有效期；限时活动与常驻权益分开列出。结论逐条说明证据及待核实信息，不要在口径不同时直接判断谁更有优势。',
      evidence: '参考了初稿中口径不齐的问题、后续对使用条件与活动有效期的修正，以及最终按用户场景表达差异的认可。',
    },
    revision: {
      title: '修正会员权益对比的口径与结论',
      when: '已有一份权益对比初稿，但结论过于笼统或把不同等级、限时活动混在一起比较时。',
      inputs: '待修改的对比初稿及可核对的权益规则；没有目标初稿时不能直接套用。',
      steps: '1. 找出初稿中混入的限时活动、等级不一致和缺少条件的判断。\n2. 补齐入会门槛、权益使用限制、渠道和有效期，无法核实的标为待核实。\n3. 保留有依据的内容，撤回无证据的强结论。\n4. 改写为“哪个用户场景缺什么权益、依据是什么”。',
      checks: '未将过期活动作为常驻权益；修改前后判断可追溯；每条差异有适用场景、对比口径和证据状态。',
      prompt: '请修改我提供的会员权益对比初稿，而不是重新从零生成。先核对各会员等级、使用门槛、适用渠道和有效期；将限时活动单列，撤回缺少同口径证据的结论。保留已有可靠内容，按用户场景说明权益差异及依据，并标出待核实项。',
      evidence: '参考了“过期活动不要算常驻权益”和“指出哪个用户场景缺权益、依据是什么”两次修改及最后的认可；不是仅复制最后一句话。',
    },
  };
  function captureSopDraft() {
    const fields = sopForm.elements;
    sopDrafts[sopScope] = Object.fromEntries(['title', 'when', 'inputs', 'steps', 'checks', 'prompt'].map(name => [name, fields[name].value]));
  }
  function showSopScope(scope) {
    sopScope = scope;
    const draft = sopDrafts[scope] || membershipSopDrafts[scope];
    for (const name of ['title', 'when', 'inputs', 'steps', 'checks', 'prompt']) sopForm.elements[name].value = draft[name];
    sopEvidence.innerHTML = `<strong>草稿依据 · 示例复盘</strong><p>${esc(membershipSopDrafts[scope].evidence)}</p>`;
    sopFormStatus.hidden = true;
  }
  const sopRequest = '请回顾刚才这项任务的对话，把真正有效的做法沉淀成一份可复用的 SOP 草稿，先给我确认，不要直接保存。';
  conversationThread.addEventListener('click', event => {
    const button = event.target.closest('[data-sop-accept]');
    if (!button || activeConversationTask !== membershipResearchTask) return;
    button.closest('.conversation-sop-suggestion').remove();
    const draft = membershipSopDrafts.revision;
    const reply = [
      '这是一份待你确认的 SOP 草稿。我回看了初稿、两次修改和最终认可，重点保留了对比口径与结论的修正方法。',
      '',
      `### ${draft.title}`,
      '',
      `**适用场景**：${draft.when}`,
      '',
      `**需要提供**：${draft.inputs}`,
      '',
      `**步骤**：\n${draft.steps}`,
      '',
      `**验收标准**：${draft.checks}`,
      '',
      '如果范围不对，可以继续告诉我希望保留哪种做法；确认前不会保存。',
    ].join('\n');
    conversationThread.insertAdjacentHTML('beforeend',
      renderConversationTurnTime(new Date()) + renderUserMessage(sopRequest) +
      `<div class="conversation-message assistant-message"><div class="assistant-content"><article class="md conversation-reply">${renderMarkdown(reply)}</article>` +
      '<p class="conversation-sop-demo-note">原型示例回复：草稿预置，尚未连接模型，不代表已真实回溯对话。</p>' +
      '<button class="conversation-sop-review" type="button" data-sop-review>审阅并保存草稿</button>' +
      `${renderMessageMeta('assistant')}</div></div>`);
    renderConversationTurnNav();
    requestAnimationFrame(() => { conversationScroll.scrollTop = conversationScroll.scrollHeight; });
  });
  conversationThread.addEventListener('click', event => {
    const button = event.target.closest('[data-sop-review]');
    if (!button || activeConversationTask !== membershipResearchTask) return;
    sopReturnFocus = button;
    editingSopId = null;
    sopDialog.querySelector('#sopDialogTitle').textContent = '审阅 SOP 草稿';
    sopDialog.querySelector('.sop-scope').hidden = false;
    sopDrafts = {};
    sopForm.reset();
    showSopScope('revision');
    sopDialog.showModal();
  });
  sopForm.addEventListener('change', event => {
    if (event.target.name !== 'scope') return;
    captureSopDraft();
    showSopScope(event.target.value);
  });
  function editSopTemplate(item) {
    templateReturnFocus = null;
    templateDialog.close();
    sopReturnFocus = null;
    editingSopId = item.id;
    sopScope = item.sop.scope;
    sopForm.reset();
    sopDialog.querySelector('#sopDialogTitle').textContent = '编辑已保存的方法';
    sopDialog.querySelector('.sop-scope').hidden = true;
    sopDrafts = { [sopScope]: { title: item.title, when: item.sop.when, inputs: item.sop.inputs,
      steps: item.sop.steps, checks: item.sop.checks, prompt: item.prompt } };
    showSopScope(sopScope);
    sopEvidence.innerHTML = '<strong>修改保存内容</strong><p>下次使用以这里确认后的版本为准；原对话和文件仍不会附带。</p>';
    sopDialog.showModal();
  }
  document.getElementById('sopClose').addEventListener('click', () => sopDialog.close());
  document.getElementById('sopCancel').addEventListener('click', () => sopDialog.close());
  sopDialog.addEventListener('click', event => { if (event.target === sopDialog) sopDialog.close(); });
  sopDialog.addEventListener('close', () => {
    if (editingSopId) {
      editingSopId = null;
      showTemplateList();
      templateDialog.showModal();
      templateDialog.querySelector('.template-close').focus();
    } else if (sopReturnFocus?.isConnected) sopReturnFocus.focus();
    sopReturnFocus = null;
  });
  sopForm.addEventListener('submit', event => {
    event.preventDefault();
    const fields = sopForm.elements;
    const values = Object.fromEntries(['title', 'when', 'inputs', 'steps', 'checks', 'prompt'].map(name => [name, fields[name].value.trim()]));
    if (!values.prompt) {
      sopForm.querySelector('.sop-prompt').open = true;
      fields.prompt.focus();
      sopFormStatus.textContent = '请填写下次使用的任务指令。';
      sopFormStatus.hidden = false;
      return;
    }
    const previous = editingSopId ? templates.find(value => value.id === editingSopId) : null;
    const item = normalizeTemplate({
      title: values.title, description: values.when, prompt: values.prompt,
      skills: previous?.skills || [], mcps: previous?.mcps || [], expert: previous?.expert || '', resources: previous?.resources || [],
      sop: { scope: sopScope, when: values.when, inputs: values.inputs, steps: values.steps, checks: values.checks },
    });
    if (!item) return;
    if (previous) templates[templates.indexOf(previous)] = { ...item, id: previous.id };
    else templates.unshift(item);
    const persisted = saveTemplates();
    editingSopId = null;
    templateReturnFocus = sopReturnFocus;
    sopReturnFocus = null;
    sopDialog.close();
    showTemplateList();
    templateMessage(persisted ? '已保存任务方法；再次使用时会回填可编辑指令，文件与原对话不会附带。' : '仅在本次页面会话中可用；存储失败，请不要将其视为已持久保存。');
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
      source: templateDraftSource && fields.sourceFile.value.trim() ? { ...templateDraftSource, file: fields.sourceFile.value.trim() } : null,
      sop: editingTemplateId ? templates.find(value => value.id === editingTemplateId)?.sop : null,
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
    else if (item && action === 'edit') {
      if (item.sop) editSopTemplate(item);
      else editTemplate(item);
    }
    else if (item && action === 'duplicate') {
      templates.unshift({ ...item, id: crypto.randomUUID(), example: false, title: `${item.title}（副本）`.slice(0, 60), skills: [...item.skills], mcps: [...item.mcps], resources: [...item.resources], sop: item.sop ? { ...item.sop } : null });
      saveTemplates(); renderTemplates(); templateMessage('已复制模版。');
    } else if (item && action === 'delete') {
      if (!window.confirm(`删除模版「${item.title}」？此操作不能撤销。`)) return;
      templates = templates.filter(value => value.id !== item.id);
      saveTemplates(); renderTemplates(); templateMessage('模版已删除。');
    } else if (item && action === 'use') {
      if (item.sop && !conversationPage.hidden) setConversationOpen(false);
      const references = [...item.mcps.map(name => `@MCP:${name}`),
        ...(item.expert ? [`@专家:${item.expert}`] : []), ...item.resources.map(name => `@${name}`)];
      const inputHint = item.sop ? (item.sop.scope === 'revision' ? '[请添加待修改的初稿和必要资料]' : '[请添加这次任务所需的资料]') : '';
      prompt.value = `${inputHint ? `${inputHint}\n\n` : ''}${item.prompt}${references.length ? `\n\n${references.join(' ')}` : ''}`;
      setPromptGuide('');
      clearSkillTags(prompt);
      item.skills.forEach(name => addSkillTag(prompt, name));
      autoResize(); refreshSendState();
      templateDialog.close();
      requestAnimationFrame(() => { prompt.focus(); prompt.setSelectionRange(prompt.value.length, prompt.value.length); });
    } else if (item && action === 'share') {
      if (!window.confirm('将导出模版 JSON（不是在线分享），包含任务指令、SOP 步骤与验收标准（如有）、Skill、MCP、专家名称及来源产物信息；资料引用不会导出。请检查内容不包含敏感信息。继续？')) return;
      const { title, description, prompt: instruction, skills, mcps, expert, source, sop } = item;
      const payload = { format: 'catpaw-template', version: 1, template: { title, description, prompt: instruction, skills, mcps, expert, source, sop } };
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

  artifactSelection = window.ArtifactEditingDemo.create({
    root:toolFilePreviewBody,
    getWorkspace:currentFileWorkspace,
    getTask:()=>activeConversationTask,
    taskForArtifact,
    ensureTask:task=>{
      if(task && (conversationPage.hidden || activeConversationTask!==task)) {
        const item=currentFileWorkspace(), expanded=workbenchExpanded;
        setConversationOpen(true,task);
        if(item?.node) openArtifactPreview(item.node,item.chain);
        if(expanded) setWorkbenchExpanded(true);
      }
    },
    renderWorkspace:renderToolFileWorkspace,
    referencesChanged:()=>fullscreenChatInput.dispatchEvent(new Event('input', {bubbles:true})),
    focusComposer:()=>{
      const item=currentFileWorkspace();
      const owner=taskForArtifact(item?.chain);
      if(owner && (conversationPage.hidden || owner!==activeConversationTask)) setConversationOpen(true,owner);
      const input=fullscreenChat.hidden ? conversationPrompt : fullscreenChatInput;
      input.focus();
    },
    openReference:ref=>{
      if(ref.task && (conversationPage.hidden || activeConversationTask!==ref.task)) setConversationOpen(true,ref.task);
      openArtifactPreview(ref.node,ref.chain);
    },
    feedback:showConversationFeedback,
  });

  /* 初始化 */
  autoResize();
  refreshSendState();
  refreshClipped();
  // Presentation scenes reuse the real interactions, and only play while their slide is active.
  if (strategyScene && window.CatPawStrategyScenes.scenes[strategyScene]) {
    const sceneParams = new URLSearchParams(window.location.search);
    const snapshotFrame = sceneParams.get('strategyPanel') === 'process' && strategyScene === '2.1' &&
      ['0', '3', '7'].includes(sceneParams.get('strategyFrame')) ? Number(sceneParams.get('strategyFrame')) : null;
    const frameReady = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const report = type => window.parent.postMessage({ type, scene: strategyScene }, '*');
    function stopStrategyDemo() {
      strategyDemoActive = false;
      document.documentElement.classList.remove('strategy-demo-active');
      clearTimeout(stageAutoTimer);
      clearTimeout(stageAdvanceTimer);
      stageAdvanceTimer = null;
      clearInterval(stageClockTimer);
      clearTimeout(promptTransitionTimer);
      clearTimeout(caseTransitionTimer);
      stopPromptHint();
      stopGreetingTyping();
      document.querySelectorAll('.conversation-stage-demo.is-entering').forEach(panel => panel.classList.remove('is-entering'));
    }
    function resetStrategyDemo() {
      strategyDemoActive = true;
      document.documentElement.classList.add('strategy-demo-active');
      document.documentElement.dataset.theme = 'light';
      document.querySelectorAll('.strategy-demo-focus').forEach(el => el.classList.remove('strategy-demo-focus'));
      caseReturnFocus = null;
      closeCaseDialog();
      if (disclosureSettings.open) disclosureSettings.close();
      disclosureMode = 'work';
      disclosureSettings.querySelector('[value="work"]').checked = true;
      setSummaryOpen(false);
      artifactSelection.clear();
      setConversationOpen(false);
      setWorkbench(false);
      setCollapsed(false);
      preferredPanelWidths.file = null;
      if (selectedPromptCategory) setPromptCategory(selectedPromptCategory, false);
      prompt.value = '';
      clearSkillTags(prompt);
      clearLibraryFileCards(prompt);
      setPromptGuide('');
      restoreHomeGreeting();
      autoResize();
      refreshSendState();
      stopPromptHint();
      conversationThread.querySelector('.conversation-stage-demo')?.remove();
    }
    function selectStrategyCategory(category) {
      if (selectedPromptCategory !== category) setPromptCategory(category, false);
      // Commit the target layout before the deck reveals this iframe.
      clearTimeout(promptTransitionTimer);
      clearTimeout(caseTransitionTimer);
      primaryPrompts.classList.remove('is-transitioning');
      primaryPrompts.classList.add('has-selection');
      renderSecondaryPrompts(category);
      renderCases(currentScope);
      casesEl.classList.remove('is-changing');
    }
    function showStrategyProcess(frameIndex, thinking = false) {
      setConversationOpen(true, conversationTask);
      let panel = conversationThread.querySelector('.conversation-stage-demo');
      if (!panel) {
        const request = conversationExamples.get(conversationTask).turns.at(-1).prompt;
        conversationThread.innerHTML = renderUserMessage(request, []) +
          `<div class="conversation-message assistant-message"><div class="assistant-content">${renderConversationStage()}</div></div>`;
        panel = conversationThread.querySelector('.conversation-stage-demo');
        conversationPrompt.value = '';
        resizeConversationPrompt();
        renderConversationTurnNav();
      }
      updateConversationStage(panel, frameIndex, frameIndex === 0, thinking);
      return panel;
    }
    function showStrategyProcessSnapshot(frameIndex) {
      document.documentElement.classList.add('strategy-process-panel');
      let panel = document.getElementById('strategyProcessPanel');
      if (!panel) {
        panel = document.createElement('section');
        panel.id = 'strategyProcessPanel';
        panel.className = 'conversation-stage-demo';
        panel.setAttribute('aria-label', '任务进程设计 Demo');
        document.body.append(panel);
      }
      // Use the same renderer as the conversation; hold each phase for comparison.
      panel.dataset.stageFrame = String(frameIndex);
      panel.innerHTML = renderConversationStageBody(frameIndex, frameIndex === 0);
      panel.classList.toggle('is-entering', frameIndex === 0 && !reducedMotion.matches);
      panel.querySelector('.stage-elapsed').textContent = formatStageElapsed(frameIndex === 0 ? 0 : frameIndex === 3 ? 12 : 32);
    }
    function reserveStrategySplit() {
      // Reserve a readable conversation column at the deck's fixed 1200 px viewport.
      // The normal adaptive layout would otherwise promote this preview to full screen.
      const sidebarWidth = parseFloat(getComputedStyle(win).getPropertyValue('--user-sidebar-w')) || 320;
      preferredPanelWidths.file = Math.max(360, win.clientWidth - sidebarWidth - 340);
    }
    function showStrategyArtifact(kind = 'ppt', expanded = false) {
      setConversationOpen(true, artifactEditingTask);
      if (!expanded) reserveStrategySplit();
      const example = conversationExamples.get(artifactEditingTask);
      const folder = FOLDERS.find(entry => entry.id === example.folderId);
      const node = folder.files.find(file => example.files.includes(file.name) && file.preview?.kind === kind);
      openArtifactPreview(node, [folder, node]);
      const item = currentFileWorkspace();
      item.referenceSlide = 2;
      item.pptSelection = null;
      item.pptMode = 'ai';
      renderToolFileWorkspace(item);
      setWorkbenchExpanded(expanded);
    }
    async function presentStrategyStep(step) {
      document.querySelectorAll('.strategy-demo-focus').forEach(el => el.classList.remove('strategy-demo-focus'));
      let processPanel = null;
      switch (step.action) {
        case 'home': break;
        case 'greeting': showGreetingBubble(); break;
        case 'category': selectStrategyCategory(step.category); break;
        case 'case':
          selectStrategyCategory('analyze');
          openCaseDialog(visibleCaseData(currentScope)[0]);
          break;
        case 'reuse': caseDialogPrimary.click(); break;
        case 'suggestion':
          selectStrategyCategory('create');
          secondaryPrompts.querySelector('[data-secondary-index="1"]').click();
          break;
        case 'process':
          if (snapshotFrame !== null) showStrategyProcessSnapshot(step.frame);
          else processPanel = showStrategyProcess(step.frame, step.thinking);
          break;
        case 'mode-settings':
          processPanel = showStrategyProcess(3);
          disclosureSettings.showModal();
          break;
        case 'development':
          disclosureSettings.close();
          disclosureMode = 'development'; // This scene does not persist a user setting.
          disclosureSettings.querySelector('[value="development"]').checked = true;
          processPanel = showStrategyProcess(step.frame);
          break;
        case 'result-file': {
          const example = conversationExamples.get(conversationTask);
          const folder = FOLDERS.find(entry => entry.id === example.folderId);
          const node = folder.files.find(file => file.name === '门店履约异常明细.xlsx');
          reserveStrategySplit();
          openArtifactPreview(node, [folder, node]);
          break;
        }
        case 'artifact-conversation': setConversationOpen(true, artifactEditingTask); break;
        case 'artifact-side': showStrategyArtifact(step.kind); break;
        case 'artifact-full': showStrategyArtifact(step.kind, true); break;
        case 'select-page':
          showStrategyArtifact('ppt');
          toolFilePreviewBody.querySelector('.reference-slide').click();
          break;
        case 'reference-page':
          showStrategyArtifact('ppt');
          toolFilePreviewBody.querySelector('[data-ppt-action="reference"]').click();
          conversationPrompt.value = '请把这一页的区域差异讲得更清楚，保留原始数据。';
          resizeConversationPrompt();
          break;
        case 'reference-another':
          toolFilePreviewBody.querySelector('[data-reference-slide="4"]').click();
          toolFilePreviewBody.querySelector('[data-ppt-action="reference"]').click();
          conversationPrompt.value = '第 3 页突出区域差异，第 5 页补充对应行动，保留原始数据。';
          resizeConversationPrompt();
          break;
      }
      await frameReady();
      if (!strategyDemoActive) return;
      if (processPanel) conversationScroll.scrollTop += processPanel.getBoundingClientRect().top - conversationScroll.getBoundingClientRect().top - 18;
      if (step.focus) document.querySelector(step.focus)?.classList.add('strategy-demo-focus');
    }
    const player = window.CatPawStrategyScenes.createPlayer({
      scene: strategyScene, snapshotFrame, reset: resetStrategyDemo, present: presentStrategyStep,
      stop: stopStrategyDemo, ready: () => report('catpaw:scene-prepared'),
    });
    window.addEventListener('message', event => {
      if (event.source !== window.parent || event.data?.scene !== strategyScene) return;
      if (event.data.type === 'catpaw:scene-activate') player.activate();
      if (event.data.type === 'catpaw:scene-preview') player.preview();
      if (event.data.type === 'catpaw:scene-deactivate') player.deactivate();
    });
    document.addEventListener('keydown', event => {
      if (!strategyDemoActive || window.parent === window || !['ArrowRight','ArrowDown','PageDown',' ','ArrowLeft','ArrowUp','PageUp','Home','End'].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage({ type: 'catpaw:scene-key', scene: strategyScene, key: event.key }, '*');
    }, true);
    window.addEventListener('pagehide', () => player.deactivate());
    stopStrategyDemo();
    report('catpaw:scene-ready');
    if (window.parent === window) player.activate();
  }
})();
