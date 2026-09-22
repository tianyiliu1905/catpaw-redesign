/* ============================================================
   CatPaw Desktop — 交互
   ============================================================ */
(function () {
  'use strict';

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

  /* ---------- 1.4 产品模式筛选 ----------
     「通用」展示拍平后的完整能力入口；「智能掌柜」隐藏通用扩展入口。 */
  const sidebar = document.getElementById('sidebar');
  const modePicker = document.getElementById('modePicker');
  const modeTrigger = document.getElementById('modeTrigger');
  const modeTriggerName = document.getElementById('modeTriggerName');
  const modeMenu = document.getElementById('modeMenu');
  const modeOptions = Array.from(modeMenu.querySelectorAll('.mode-option'));

  function setModeMenuOpen(open) {
    modePicker.classList.toggle('open', open);
    modeMenu.hidden = !open;
    modeTrigger.setAttribute('aria-expanded', String(open));
  }

  function selectMode(mode) {
    const selected = modeOptions.find((option) => option.dataset.mode === mode);
    if (!selected) return;

    modeOptions.forEach((option) => {
      const on = option === selected;
      option.classList.toggle('selected', on);
      option.setAttribute('aria-selected', String(on));
    });
    modeTriggerName.textContent = selected.querySelector('span').textContent;
    sidebar.dataset.mode = mode;
    setModeMenuOpen(false);
  }

  modeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setModeMenuOpen(!modePicker.classList.contains('open'));
  });

  modeMenu.addEventListener('click', (e) => {
    const option = e.target.closest('.mode-option');
    if (!option) return;
    e.stopPropagation();
    selectMode(option.dataset.mode);
    modeTrigger.focus();
  });

  modePicker.addEventListener('keydown', (e) => {
    const open = modePicker.classList.contains('open');
    const activeIndex = modeOptions.indexOf(document.activeElement);

    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setModeMenuOpen(false);
      modeTrigger.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const selectedIndex = modeOptions.findIndex((option) => option.classList.contains('selected'));

      if (!open) {
        setModeMenuOpen(true);
        modeOptions[Math.max(0, selectedIndex)].focus();
        return;
      }

      const step = e.key === 'ArrowDown' ? 1 : -1;
      const fromIndex = activeIndex === -1 ? selectedIndex : activeIndex;
      modeOptions[(fromIndex + step + modeOptions.length) % modeOptions.length].focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!modePicker.contains(e.target)) setModeMenuOpen(false);
  });

  selectMode('general');

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
    // 收起时提示还有多少条，展开后只需给出回收入口
    expandTasksBtn.textContent = tasksExpanded ? '收起' : `展开（${overflow}）`;

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
      syncGroupHeight(group);
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

  /* -- 三份示例产物 --
     全部内联成字符串，不落成独立文件。这样整个原型只有
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
    'body{font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    '  color:#1d1d1f;background:#f5f7fa;padding:18px}',
    'h1{font-size:17px;letter-spacing:-.2px}',
    '.sub{color:#86868b;font-size:11.5px;margin:4px 0 14px}',
    '.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
    '.kpi{background:#fff;border:1px solid #e6e9ef;border-radius:9px;padding:10px 11px}',
    '.kpi .k{font-size:11px;color:#86868b}',
    '.kpi .v{font-size:20px;font-weight:600;margin-top:3px;letter-spacing:-.4px}',
    '.kpi .d{font-size:11px;margin-top:2px}',
    '.up{color:#d1483f}.down{color:#1a7f44}',
    '.card{background:#fff;border:1px solid #e6e9ef;border-radius:9px;padding:12px}',
    '.card h2{font-size:12.5px;margin-bottom:10px}',
    '.bars{display:flex;align-items:flex-end;gap:10px;height:120px}',
    '.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}',
    '.bar i{display:block;width:100%;border-radius:4px 4px 0 0;background:#cfe0f6}',
    '.bar.peak i{background:#3b82e0}',
    '.bar span{font-size:10.5px;color:#86868b}',
    'table{width:100%;border-collapse:collapse;margin-top:12px}',
    'th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #eef1f5;font-size:12px}',
    'th{color:#86868b;font-weight:500;font-size:11px}',
    'td.num{text-align:right;font-variant-numeric:tabular-nums}',
    '.tag{display:inline-block;padding:1px 6px;border-radius:999px;font-size:10.5px}',
    '.tag.bad{background:#fdeceb;color:#d1483f}',
    '.tag.ok{background:#e8f6ed;color:#1a7f44}',
    'footer{margin-top:12px;color:#a1a1a6;font-size:10.5px}',
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
        {
          name: '未命名对话记录.md', type: 'doc',
          preview: { kind: 'markdown', text: DEMO_MD },
        },
        {
          name: '门店履约异常看板.html', type: 'web',
          preview: { kind: 'html', html: DEMO_HTML },
        },
        {
          name: '草稿箱', type: 'folder',
          files: [
            // 再嵌一层，用来验证多级回退而非只能退一步
            {
              name: '待整理', type: 'folder',
              files: [
                { name: '会议速记-0918.md',     type: 'doc' },
                { name: '毛稿拼图.png',          type: 'image' },
              ],
            },
            { name: '提纲-未完成.md',         type: 'doc' },
            { name: '素材清单.csv',            type: 'sheet' },
            { name: '参考截图.png',            type: 'image' },
          ],
        },
        {
          name: '截图 2026-09-21.png', type: 'image',
          preview: { kind: 'image', art: DEMO_PNG },
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

  /* ---------- 1.75 工具台「文件夹」面板 ----------
     面板展示的始终是输入框下方选中的那个归属文件夹，不再是写死的工程目录。
     「我把任务存到哪」与「我在文件面板里看到什么」因此指向同一个对象。 */
  const fileLoc     = document.getElementById('fileLoc');
  const fileBack    = document.getElementById('fileBack');
  const fileFwd     = document.getElementById('fileFwd');
  const fileGrid         = document.getElementById('fileGrid');
  const fileView         = document.getElementById('fileView');
  const recentFiles      = document.getElementById('recentFiles');
  const outputCategories = Array.from(document.querySelectorAll('[data-output-category]'));
  const fileLayoutToggle = document.getElementById('fileLayoutToggle');
  let fileLayout = 'grid';
  let outputCategory = 'current';
  let recentPreviewEntry = null;
  let recentOpenedFiles = [
    { node: FOLDERS[0].files[1], chain: [FOLDERS[0], FOLDERS[0].files[1]], opened: '刚刚' },
    { node: FOLDERS[3].files[4], chain: [FOLDERS[3], FOLDERS[3].files[4]], opened: '12 分钟前' },
    { node: FOLDERS[1].files[2], chain: [FOLDERS[1], FOLDERS[1].files[2]], opened: '1 小时前' },
  ];

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

  /* -- 层级导航 --
     filePath 是一条从根文件夹往下的节点链，末项即当前所在位置。
     只存节点引用而非 id：嵌套项没有 id，且同名文件夹可能出现在不同层，
     靠名字定位会认错人。

     末项不一定是目录——打开一个文件时，该文件节点同样入栈。
     「打开文件」与「进入子目录」因此是同一个动作：都是往下走一层，
     区别只在这一层用宫格渲染还是用预览器渲染。
     好处是左箭头不需要为「关闭预览」单开一条分支，
     它始终只做一件事：出栈一层。

     为什么不是浏览器式的前进 / 后退历史：
     这是一棵目录树，「上一级」是结构上的父节点，唯一确定；
     若做成访问历史，从 A/B 跳到 C/D 后按左箭头会回到 A/B，
     与图标上的「向上」语义相悖。因此左箭头 = 出栈一层。

     右箭头是后退的逆操作，因此 fileForward 也是一个栈而非单个节点：
     连退两层后再连进两层，应回到原位。
     若只存一个，第二次后退会覆掉第一次的记录，深的那一层就找不回来了。

     一旦从别处重新下钻，这条待重做的路径整条失效，需清空。 */
  let filePath = [];
  let fileForward = [];

  function currentNode() {
    return filePath[filePath.length - 1] || null;
  }

  function rememberRecentFile(node, chain) {
    if (!node || node.type === 'folder') return;
    recentOpenedFiles = recentOpenedFiles.filter((entry) => entry.node !== node);
    recentOpenedFiles.unshift({ node, chain: chain.slice(), opened: '刚刚' });
    recentOpenedFiles = recentOpenedFiles.slice(0, 8);
    if (outputCategory === 'recent' && !recentPreviewEntry) renderRecentFiles();
  }

  /* 往下走一层：子目录与文件走同一条路径 */
  function enterNode(node) {
    filePath.push(node);
    // 走了新的岔路，原先记下的「可重做」路径不再成立
    fileForward = [];
    if (node.type !== 'folder') rememberRecentFile(node, filePath);
    renderFilePane();
  }

  /* 回上一级；最近打开的文件预览优先返回最近列表。 */
  function fileGoBack() {
    if (outputCategory === 'recent' && recentPreviewEntry) {
      recentPreviewEntry = null;
      renderFilePane();
      return;
    }
    if (filePath.length <= 1) return;
    fileForward.push(filePath.pop());
    renderFilePane();
  }

  /* 重新进入刚退出的那一层 */
  function fileGoForward() {
    if (!fileForward.length) return;
    filePath.push(fileForward.pop());
    renderFilePane();
  }

  /* 只写当前这一层的名字，不铺完整路径：
     路径中间的层级既不可点也无处可去，写出来只是噪声，
     层级移动交给左右两颗箭头。
     打开文件后这里显示的是文件名——标题位始终回答「我此刻在看什么」。 */
  function renderFileLoc() {
    const node = currentNode();
    if (!node) return;
    fileLoc.textContent = node.name;
    fileLoc.title = node.name;
    // 在根目录就无处可退；没有待重做的路径就无处可进
    fileBack.disabled = filePath.length <= 1;
    fileFwd.disabled  = !fileForward.length;
  }

  const FILE_LAYOUT_ICONS = {
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  };

  function syncFileLayout() {
    const isList = fileLayout === 'list';
    fileGrid.classList.toggle('is-list', isList);
    fileLayoutToggle.setAttribute('aria-pressed', String(isList));
    fileLayoutToggle.setAttribute('aria-label', isList ? '切换到宫格视图' : '切换到列表视图');
    fileLayoutToggle.title = isList ? '切换到宫格视图' : '切换到列表视图';
    fileLayoutToggle.querySelector('svg').innerHTML = isList ? FILE_LAYOUT_ICONS.grid : FILE_LAYOUT_ICONS.list;
  }

  function recentFileIcon(type) {
    if (type === 'image') return '<path d="M4 4h16v16H4z"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/>';
    if (type === 'sheet') return '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>';
    if (type === 'code') return '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>';
    if (type === 'web') return '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
    return '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>';
  }

  function renderRecentFiles() {
    if (!recentOpenedFiles.length) {
      recentFiles.innerHTML = '<p class="recent-empty">还没有打开过文件</p>';
      return;
    }
    recentFiles.innerHTML = recentOpenedFiles.map((entry, index) => {
      const location = entry.chain.slice(0, -1).map((node) => node.name).join(' / ');
      return `<button class="recent-file" type="button" data-recent-index="${index}" title="${esc(entry.node.name)}">` +
        `<span class="recent-file-symbol"><svg viewBox="0 0 24 24" class="ic">${recentFileIcon(entry.node.type)}</svg></span>` +
        `<span class="recent-file-copy"><strong>${esc(entry.node.name)}</strong><small>${esc(location)}</small></span>` +
        `<time>${entry.opened}</time>` +
        `</button>`;
    }).join('');
  }

  function syncOutputCategories() {
    outputCategories.forEach((button) => {
      const active = button.dataset.outputCategory === outputCategory;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function selectOutputCategory(category) {
    if (category !== 'current' && category !== 'recent') return;
    outputCategory = category;
    recentPreviewEntry = null;
    syncOutputCategories();
    renderFilePane();
  }

  function openRecentFile(entry) {
    if (!entry) return;
    rememberRecentFile(entry.node, entry.chain);
    recentPreviewEntry = recentOpenedFiles[0];
    outputCategory = 'recent';
    syncOutputCategories();
    renderFilePane();
  }

  function renderFileGrid(folder) {
    const files = folder.files || [];
    if (!files.length) {
      fileGrid.innerHTML = `<p class="file-empty">这个文件夹还是空的</p>`;
      return;
    }

    /* 文件夹排在文件前面，与 Finder 的默认排序一致。
       排序会打乱与原数组的对应关系，故先把原下标绑在每一项上，
       再写进 data-file-index 供点击时回查。
       sort 用的是稳定排序，同类项之间维持原有次序。 */
    const sorted = files
      .map((f, i) => ({ f, i }))
      .sort((a, b) => (a.f.type === 'folder' ? 0 : 1) - (b.f.type === 'folder' ? 0 : 1));

    fileGrid.innerHTML = GRADIENT_DEFS + sorted
      .map(({ f, i }) => {
        const thumb = (THUMBS[f.type] || THUMBS.doc)();
        return (
          `<button class="fitem" data-file-type="${f.type}"` +
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

  function renderFileView(node) {
    const p = node.preview;
    const render = p && PREVIEWS[p.kind];
    fileView.innerHTML = render ? render(p) : previewFallback(node);
    // 每次换文件都从顶部开始读，不带着上一篇的滚动位置
    fileView.scrollTop = 0;
  }

  /* 重画当前所在的那一层。
     目录画宫格，文件画预览——两者是同一个位置上的两种形态，
     因此显隐在一处统一切换，不散落到各个调用点。 */
  function renderFilePane() {
    syncOutputCategories();

    if (outputCategory === 'recent') {
      fileFwd.hidden = true;
      fileLayoutToggle.hidden = true;
      fileGrid.hidden = true;
      if (recentPreviewEntry) {
        fileLoc.textContent = recentPreviewEntry.node.name;
        fileLoc.title = recentPreviewEntry.node.name;
        fileBack.hidden = false;
        fileBack.disabled = false;
        recentFiles.hidden = true;
        fileView.hidden = false;
        renderFileView(recentPreviewEntry.node);
      } else {
        fileLoc.textContent = '最近打开的文件';
        fileLoc.title = '最近打开的文件';
        fileBack.hidden = true;
        fileView.hidden = true;
        fileView.innerHTML = '';
        recentFiles.hidden = false;
        renderRecentFiles();
      }
      return;
    }

    recentFiles.hidden = true;
    fileBack.hidden = false;
    fileFwd.hidden = false;
    const node = currentNode();
    if (!node) return;
    renderFileLoc();

    const isFolder = node.type === 'folder' || !filePath.length || node === filePath[0];

    if (isFolder) {
      renderFileGrid(node);
      fileGrid.hidden = false;
      fileView.hidden = true;
      fileView.innerHTML = '';   // 放掉 iframe，不让它在后台继续留着
      fileLayoutToggle.hidden = false;
      syncFileLayout();
      return;
    }

    fileGrid.hidden = true;
    fileView.hidden = false;
    fileLayoutToggle.hidden = true;
    renderFileView(node);
  }

  /* 换了归属文件夹就是换了一棵树，层级栈必须重置到根。
     不重置的话，面板会停在上一个文件夹的子目录里，
     而那个节点已经不属于当前选中的树了。 */
  function resetFilePane() {
    const folder = FOLDERS.find((f) => f.id === folderByScope[currentScope]);
    if (!folder) return;
    filePath = [folder];
    fileForward = [];
    if (outputCategory === 'current') renderFilePane();
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

  /* ---------- 2. 分组折叠 ---------- */
  document.querySelectorAll('[data-group]').forEach((group) => {
    const head = group.querySelector('[data-toggle-group]');
    const body = group.querySelector('.group-body');

    // 初始化显式高度，保证首次过渡有值可算
    body.style.height = body.scrollHeight + 'px';

    head.addEventListener('click', () => {
      const folded = group.classList.contains('folded');
      if (folded) {
        group.classList.remove('folded');
        body.style.height = body.scrollHeight + 'px';
      } else {
        body.style.height = body.scrollHeight + 'px';
        // 强制回流后再收起，触发动画
        void body.offsetHeight;
        group.classList.add('folded');
      }
    });
  });

  /* 内容变化后同步高度；散落任务不在分组内，直接跳过 */
  function syncGroupHeight(group) {
    if (!group) return;
    const body = group.querySelector('.group-body');
    if (body && !group.classList.contains('folded')) {
      body.style.height = body.scrollHeight + 'px';
    }
  }

  /* ---------- 3. 展开显示 / 收起 ---------- */
  document.querySelectorAll('[data-expand]').forEach((btn) => {
    const wrap = btn.parentElement.querySelector('[data-more]');
    if (!wrap) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = wrap.classList.toggle('hidden');
      btn.textContent = hidden ? '展开显示' : '收起';
      syncGroupHeight(btn.closest('[data-group]'));
      // 新展开的项尚未检测过溢出
      refreshClipped();
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
  let promptGuide = '';

  function autoResize() {
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 200) + 'px';
  }

  function refreshSendState() {
    sendBtn.disabled = prompt.value.trim().length === 0 && !promptGuide;
  }

  function setPromptGuide(text = '', label = text) {
    promptGuide = text;
    promptChipText.textContent = label;
    promptChip.hidden = !text;
    refreshSendState();
  }

  prompt.addEventListener('input', () => {
    autoResize();
    refreshSendState();
  });

  prompt.addEventListener('focus', () => card.classList.add('focus'));
  prompt.addEventListener('blur', () => card.classList.remove('focus'));

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
      setPromptGuide(data.guide, data.tag);
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
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      // 顶部标题条与两张指标卡
      `<rect x="10" y="9" width="42" height="5" rx="2.5" fill="#c3ccda"/>` +
      `<rect x="10" y="20" width="30" height="20" rx="3" fill="#fff" stroke="#e3e8f0"/>` +
      `<rect x="44" y="20" width="30" height="20" rx="3" fill="#fff" stroke="#e3e8f0"/>` +
      `<rect x="14" y="26" width="16" height="3" rx="1.5" fill="#8aa0c4"/>` +
      `<rect x="48" y="26" width="16" height="3" rx="1.5" fill="#8aa0c4"/>` +
      // 柱形图
      `<rect x="10" y="46" width="64" height="44" rx="3" fill="#fff" stroke="#e3e8f0"/>` +
      `<rect x="17" y="72" width="7" height="12" rx="1.5" fill="#9cc2f0"/>` +
      `<rect x="28" y="64" width="7" height="20" rx="1.5" fill="#6aa5ea"/>` +
      `<rect x="39" y="56" width="7" height="28" rx="1.5" fill="#3b82e0"/>` +
      `<rect x="50" y="66" width="7" height="18" rx="1.5" fill="#9cc2f0"/>` +
      // 折线图
      `<rect x="80" y="20" width="70" height="70" rx="3" fill="#fff" stroke="#e3e8f0"/>` +
      `<path d="M88 74l14-12 12 7 14-20 14 9" fill="none" stroke="#3b82e0" stroke-width="2.4"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`,

    // 推文：一张竖排图文，顶部配图、下面是正文块
    article: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      `<rect x="40" y="8" width="80" height="84" rx="4" fill="#fff" stroke="#e3e8f0"/>` +
      // 头图
      `<path d="M46 14h68v22H46z" fill="#dce8f7"/>` +
      `<circle cx="104" cy="21" r="4" fill="#fff" opacity=".8"/>` +
      `<path d="M46 36l14-11 10 7 8-6 36 14z" fill="#9cc2f0" opacity=".9"/>` +
      // 标题与正文
      `<rect x="46" y="42" width="46" height="4" rx="2" fill="#8f9aad"/>` +
      [50, 57, 64, 71, 78].map((y, i) =>
        `<rect x="46" y="${y}" width="${i === 4 ? 40 : 68}" height="3" rx="1.5" fill="#d3d8e0"/>`
      ).join('') +
      `</svg>`,

    // 幻灯片：一张主页 + 后面叠两张，表达「一套」而非「一张」
    deck: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      `<rect x="34" y="16" width="92" height="58" rx="4" fill="#eef2f8" stroke="#e3e8f0"/>` +
      `<rect x="29" y="22" width="92" height="58" rx="4" fill="#f4f7fb" stroke="#e3e8f0"/>` +
      `<rect x="24" y="28" width="92" height="58" rx="4" fill="#fff" stroke="#dde4ee"/>` +
      `<rect x="32" y="37" width="40" height="5" rx="2.5" fill="#8f9aad"/>` +
      `<rect x="32" y="47" width="58" height="3" rx="1.5" fill="#d3d8e0"/>` +
      `<rect x="32" y="54" width="50" height="3" rx="1.5" fill="#d3d8e0"/>` +
      `<rect x="32" y="64" width="18" height="14" rx="2" fill="#cfe0f6"/>` +
      `<rect x="54" y="64" width="18" height="14" rx="2" fill="#9cc2f0"/>` +
      `<rect x="76" y="64" width="18" height="14" rx="2" fill="#cfe0f6"/>` +
      `</svg>`,

    // 网页：带浏览器外壳，与「文档」区分开
    web: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      `<rect x="18" y="14" width="124" height="72" rx="5" fill="#fff" stroke="#dde4ee"/>` +
      `<path d="M18 19a5 5 0 0 1 5-5h114a5 5 0 0 1 5 5v7H18z" fill="#eef2f8"/>` +
      `<circle cx="27" cy="20" r="2" fill="#d3d8e0"/>` +
      `<circle cx="34" cy="20" r="2" fill="#d3d8e0"/>` +
      `<circle cx="41" cy="20" r="2" fill="#d3d8e0"/>` +
      `<rect x="26" y="34" width="52" height="6" rx="3" fill="#8f9aad"/>` +
      `<rect x="26" y="46" width="72" height="3" rx="1.5" fill="#d3d8e0"/>` +
      `<rect x="26" y="53" width="60" height="3" rx="1.5" fill="#d3d8e0"/>` +
      `<rect x="26" y="64" width="28" height="10" rx="5" fill="#3b82e0"/>` +
      `<rect x="104" y="34" width="30" height="40" rx="3" fill="#dce8f7"/>` +
      `</svg>`,

    // 代码：编辑器窗口，左侧行号栏
    code: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      `<rect x="18" y="14" width="124" height="72" rx="5" fill="#fff" stroke="#dde4ee"/>` +
      `<path d="M18 19a5 5 0 0 1 5-5h114a5 5 0 0 1 5 5v6H18z" fill="#eef2f8"/>` +
      `<rect x="18" y="25" width="14" height="61" fill="#f4f7fb"/>` +
      [33, 41, 49, 57, 65, 73].map((y, i) =>
        `<rect x="${38 + (i % 3) * 6}" y="${y}" width="${[46, 34, 54, 28, 42, 30][i]}"` +
        ` height="3" rx="1.5" fill="${i % 3 === 0 ? '#8aa0c4' : '#d3d8e0'}"/>`
      ).join('') +
      `</svg>`,

    // 视觉稿：画板上的构图，用色块而非线条
    visual: () =>
      `<svg class="cthumb-art" viewBox="0 0 160 100" aria-hidden="true">` +
      `<rect width="160" height="100" fill="#f7f9fc"/>` +
      `<rect x="30" y="12" width="100" height="76" rx="4" fill="#fff" stroke="#dde4ee"/>` +
      `<circle cx="62" cy="40" r="16" fill="#f3d0e0"/>` +
      `<rect x="74" y="30" width="44" height="20" rx="3" fill="#cfe0f6"/>` +
      `<rect x="42" y="62" width="76" height="4" rx="2" fill="#8f9aad"/>` +
      `<rect x="42" y="71" width="52" height="4" rx="2" fill="#d3d8e0"/>` +
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
      { kind: 'web', type: '网页', title: 'NoCode 组件文档站', prompt: '为 NoCode 组件库制作一个清晰易查的文档网站，包含组件分类、交互示例、参数说明和复制代码入口。' },
      { kind: 'code', type: '代码配置', title: '灰度发布流水线配置', prompt: '生成一份支持分批放量、自动健康检查、失败回滚和发布通知的灰度发布流水线配置。' },
      { kind: 'dashboard', type: '监控看板', title: '服务健康度监控台', prompt: '制作服务健康度监控台，展示可用率、响应时延、错误率和告警趋势，并支持按服务与时间范围筛选。' },
      { kind: 'code', type: '技术方案', title: '接口性能优化方案', prompt: '分析订单查询接口的性能瓶颈，给出缓存、数据库索引、并发控制和可观测性方面的优化方案与示例代码。' },
    ],
    design: [
      { kind: 'visual', type: '视觉设计', title: '节点运营主视觉', prompt: '设计一张节点运营活动主视觉，突出限时氛围与核心权益，构图简洁有冲击力，并适配横版活动页面。' },
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

  /* ---------- 5.5 右侧抽屉：产物与工具 ---------- */
  const content = document.getElementById('content');
  const workbench = document.getElementById('workbench');
  const outputToggle = document.getElementById('toggleOutputs');
  const wbToggle = document.getElementById('toggleWorkbench');
  const wbExpandToggle = document.getElementById('toggleWorkbenchExpand');
  const wbPanes = Array.from(workbench.querySelectorAll('.wb-pane'));
  const workspaceTabs = document.getElementById('workspaceTabs');
  const workspaceCreate = document.getElementById('workspaceCreate');
  const workspaceAdd = document.getElementById('workspaceAdd');
  const workspaceCreateMenu = document.getElementById('workspaceCreateMenu');
  const urlInput = document.getElementById('urlInput');
  const toolFileTree = document.getElementById('toolFileTree');
  const toolTreeClose = document.getElementById('toolTreeClose');
  const toolTreeReopen = document.getElementById('toolTreeReopen');
  const toolFilePreviewTitle = document.getElementById('toolFilePreviewTitle');
  const toolFilePreviewBody = document.getElementById('toolFilePreviewBody');
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

  function setWorkbenchExpanded(expanded) {
    workbenchExpanded = Boolean(expanded && rightPanel);
    content.classList.toggle('wb-expanded', workbenchExpanded);
    wbExpandToggle.disabled = !rightPanel;
    wbExpandToggle.setAttribute('aria-pressed', String(workbenchExpanded));
    wbExpandToggle.title = workbenchExpanded ? '退出全屏面板' : '全屏显示面板';
    wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
  }

  function syncWorkbenchWidth() {
    const item = openWorkspaces.find((workspace) => workspace.id === activeWorkspace);
    const folderOpen = rightPanel === 'tools' && item?.kind === 'file' && item.treeVisible !== false;
    content.classList.toggle('wb-folder-open', folderOpen);
  }

  function setRightPanel(panel) {
    const next = panel === rightPanel ? null : panel;
    if (next === 'tools' && openWorkspaces.length === 0) ensureDefaultFileWorkspace();
    rightPanel = next;
    syncWorkbenchWidth();
    const open = Boolean(next);
    content.classList.toggle('wb-open', open);
    workbench.dataset.panel = next || '';
    setWorkbenchExpanded(workbenchExpanded);
    workbench.setAttribute('aria-hidden', String(!open));
    outputToggle.setAttribute('aria-expanded', String(next === 'outputs'));
    wbToggle.setAttribute('aria-expanded', String(next === 'tools'));
    outputToggle.title = next === 'outputs' ? '收起产物' : '产物';
    wbToggle.title = next === 'tools' ? '收起工具' : '工具';
  }

  function setWorkbench(open) {
    if (!open) {
      rightPanel = null;
      content.classList.remove('wb-open', 'wb-folder-open', 'wb-expanded');
      workbenchExpanded = false;
      wbExpandToggle.disabled = true;
      wbExpandToggle.setAttribute('aria-pressed', 'false');
      wbExpandToggle.title = '全屏显示面板';
      wbExpandToggle.setAttribute('aria-label', wbExpandToggle.title);
      workbench.dataset.panel = '';
      workbench.setAttribute('aria-hidden', 'true');
      outputToggle.setAttribute('aria-expanded', 'false');
      wbToggle.setAttribute('aria-expanded', 'false');
      outputToggle.title = '产物';
      wbToggle.title = '工具';
      return;
    }
    if (rightPanel !== 'tools') setRightPanel('tools');
  }

  function renderWorkspaceTabs() {
    workspaceTabs.innerHTML = openWorkspaces.map((item) => {
      const meta = WORKSPACE_META[item.kind];
      return `<div class="workspace-tab${item.id === activeWorkspace ? ' active' : ''}" role="tab" tabindex="0"` +
        ` data-workspace-tab="${item.id}" data-workspace-kind="${item.kind}"` +
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
    wbPanes.forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === item.kind));
    if (item.kind === 'browser') {
      urlInput.value = item.url || '';
      requestAnimationFrame(() => urlInput.focus());
    }
    if (item.kind === 'file') renderToolFileWorkspace(item);
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
  outputToggle.addEventListener('click', () => setRightPanel('outputs'));
  wbToggle.addEventListener('click', () => setRightPanel('tools'));
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
      if (rightPanel === 'tools') setWorkbench(false);
      else setRightPanel('tools');
    }
  });
  /* 工具文件夹只展示当前任务所在的根目录，顶部切换器与输入框下方的
     归属选择共享状态。目录图标沿用 Lucide 线性语言，不引入实心色块。 */
  const toolTreeExpanded = new Set(['root']);
  let activeFilePath = null;
  const TREE_ICONS = {
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  };

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

  function renderToolTreeNodes(nodes, parentPath, depth) {
    return nodes.map((node, index) => {
      const path = `${parentPath}.${index}`;
      const isFolder = node.type === 'folder';
      const expanded = isFolder && toolTreeExpanded.has(path);
      const children = isFolder && expanded
        ? `<div role="group">${renderToolTreeNodes(node.files || [], path, depth + 1)}</div>`
        : '';
      return `<div class="tool-tree-node">` +
        `<button type="button" role="treeitem" data-tree-path="${path}"` +
        ` data-tree-folder="${isFolder}" aria-expanded="${isFolder ? String(expanded) : ''}"` +
        ` class="tool-tree-row${!isFolder && `${activeToolFolder().id}:${path}` === activeFilePath ? ' selected' : ''}"` +
        ` style="--tree-depth:${depth}" title="${esc(node.name)}">` +
        `<svg viewBox="0 0 24 24" class="tool-tree-chevron${isFolder ? '' : ' blank'}"><path d="m9 18 6-6-6-6"/></svg>` +
        `<svg viewBox="0 0 24 24" class="tool-tree-icon">${TREE_ICONS[isFolder ? 'folder' : 'file']}</svg>` +
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
    const expanded = toolTreeExpanded.has('root');
    const children = expanded
      ? `<div role="group">${renderToolTreeNodes(folder.files || [], 'root', 1)}</div>`
      : '';
    toolFileTree.innerHTML = `<div class="tool-tree-node tool-tree-root">` +
      `<button class="tool-tree-row" type="button" role="treeitem" data-tree-path="root"` +
      ` data-tree-folder="true" aria-expanded="${expanded}" style="--tree-depth:0" title="${esc(folder.path)}">` +
      `<svg viewBox="0 0 24 24" class="tool-tree-chevron"><path d="m9 18 6-6-6-6"/></svg>` +
      `<svg viewBox="0 0 24 24" class="tool-tree-icon">${TREE_ICONS.folder}</svg>` +
      `<span>${esc(folder.name)}</span>` +
      `</button>${children}</div>`;
    renderToolFolderPicker();
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

  function renderToolFileWorkspace(item) {
    if (!item || item.kind !== 'file') return;
    const treeVisible = item.treeVisible !== false;
    workbench.classList.toggle('file-split', treeVisible);
    workbench.classList.toggle('file-preview-only', !treeVisible);
    syncWorkbenchWidth();
    toolTreeReopen.hidden = treeVisible;
    activeFilePath = treeVisible ? item.path || null : null;
    toolFilePreviewTitle.textContent = item.node ? item.node.name : '选择文件';
    if (!item.node) toolFilePreviewBody.innerHTML = TOOL_FILE_EMPTY;
    else toolFilePreviewBody.innerHTML = renderSourcePreview(item.node);
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
      previewMode: 'source',
    });
  }

  function openArtifactPreview(node, chain) {
    openFileWorkspace(node, chain, {
      path: null,
      treeVisible: false,
      previewMode: 'artifact',
    });
  }

  toolFileTree.addEventListener('click', (e) => {
    const row = e.target.closest('[data-tree-path]');
    if (!row) return;
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
    item.previewMode = 'source';
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

  /* 宫格点击：文件夹与文件都走 enterNode，往下走一层。
     两者的差别交给 renderFilePane 去分派，这里不做判断——
     点击处理只负责「去哪」，不负责「长什么样」。

     宫格每次重渲染都会换掉内部节点，故在容器上做委托，
     不给单个格子绑监听。

     排过序后 DOM 顺序与数据顺序不再一致，
     因此用渲染时写入的下标回查原节点，而不是拿名字去 find——
     同一层里出现同名项时，按名字找会拿错。 */
  outputCategories.forEach((button) => {
    button.addEventListener('click', () => selectOutputCategory(button.dataset.outputCategory));
  });

  recentFiles.addEventListener('click', (e) => {
    const item = e.target.closest('[data-recent-index]');
    if (!item) return;
    const entry = recentOpenedFiles[Number(item.dataset.recentIndex)];
    if (entry) openArtifactPreview(entry.node, entry.chain);
  });

  fileGrid.addEventListener('click', (e) => {
    const item = e.target.closest('.fitem');
    if (!item) return;

    const node = (currentNode().files || [])[Number(item.dataset.fileIndex)];
    if (!node) return;
    if (node.type === 'folder') enterNode(node);
    else openArtifactPreview(node, filePath.concat(node));
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
  const conversationArtifact = document.getElementById('conversationArtifact');
  const newTaskNav = document.getElementById('newTaskNav');

  function setConversationOpen(open) {
    mainView.classList.toggle('conversation-open', open);
    conversationPage.hidden = !open;
    conversationTask.classList.toggle('current-conversation', open);
    conversationTask.setAttribute('aria-current', open ? 'page' : 'false');
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
    if (e.target.closest('[data-toggle-agents]')) return;
    e.preventDefault();
    setConversationOpen(true);
  });
  newTaskNav.addEventListener('click', (e) => {
    e.preventDefault();
    setConversationOpen(false);
    requestAnimationFrame(() => prompt.focus());
  });
  conversationPrompt.addEventListener('input', resizeConversationPrompt);
  conversationPrompt.addEventListener('focus', () => conversationComposer.classList.add('focus'));
  conversationPrompt.addEventListener('blur', () => conversationComposer.classList.remove('focus'));
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

  fileBack.addEventListener('click', fileGoBack);
  fileFwd.addEventListener('click', fileGoForward);
  fileLayoutToggle.addEventListener('click', () => {
    fileLayout = fileLayout === 'grid' ? 'list' : 'grid';
    syncFileLayout();
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
