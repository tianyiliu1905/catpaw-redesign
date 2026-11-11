(function () {
  const cases = [
    { id:'compare', title:'供应商报价对比', task:'查看三家供应商的报价和交期', prompt:'三家供应商：恒川 ¥47,200、12 天；青禾 ¥43,200、18 天；立衡 ¥50,400、9 天。预算 ¥48,000，14 天内到货。让我切换查看每家的报价、交期，以及与要求的差额。', category:'信息展示', value:'切换对象，查看详情', check:'点选供应商，下方显示对应报价、交期和差额。' },
    { id:'budget', title:'套菜预算试算', task:'调整人数与预算，判断套菜是否超支', prompt:'给 20 人、2 桌（每桌 10 人）的套菜做预算试算。两桌合计热菜 ¥3,000、凉菜 ¥800、主食与饮品 ¥600。总预算可在 ¥3,000 到 ¥6,000 间调整，默认 ¥4,800。用餐人数可在 10 到 30 人间调整，每桌最多 10 人，费用按 ¥220/人试算（热菜 ¥150、凉菜 ¥40、主食与饮品 ¥30）。让我同时调整人数和预算，查看结余或超支。', category:'交互试算', value:'直接改条件，立即看到影响', check:'调整人数会按 ¥220/人重算费用，并按每桌最多 10 人安排桌数，再调整预算查看结余。' },
    { id:'diagnose', title:'履约异常定位', task:'找到最值得先核查的履约环节', prompt:'复盘 100 笔订单，接单 100 笔，到店 94 笔，出餐 80 笔，交接 76 笔。做一张可点击的履约漏斗，点环节能看到与上一步的差值和下一步核查建议。', category:'逐层查看', value:'点开环节，定位差异', check:'点选漏斗环节，查看订单差值与核查建议。' }
  ];
  const money = value => '¥' + value.toLocaleString('en-US');
  const replyCopy = {
    compare: ['先对照预算和交期，再整理每家的差额。', '生成方案比较卡', '恒川是唯一同时满足预算和交期的方案，比预算少 ¥800，提前 2 天到货。切换供应商即可查看详情。'],
    budget: ['先按人数计算桌数和费用，再对照总预算展示结余。', '生成预算试算器', '预计支出 ¥4,400。按默认预算还剩 ¥400，可以调整人数和预算，查看桌数、支出与结余如何变化。'],
    diagnose: ['先比较相邻环节的差值，再把核查建议放到对应环节。', '生成可交互的履约漏斗', '到店到出餐少了 14 笔，是流失最多的一步。可以点其他环节查看差值和核查建议。']
  };
  const replyTimers = new WeakMap();
  const replyRenderers = new WeakMap();
  let conversationBridge = {};
  let displayFormat = 'widget';
  const demoControls = document.createElement('div');
  demoControls.className = 'wvc-demo-controls';
  demoControls.hidden = true;
  demoControls.setAttribute('role', 'group');
  demoControls.setAttribute('aria-label', 'Widget 对比演示');
  demoControls.innerHTML = `<div class="wvc-format" role="group" aria-label="回复展示方式">
    <button type="button" data-wvc-format="widget" aria-pressed="true">Widget</button>
    <button type="button" data-wvc-format="text" aria-pressed="false">Markdown</button>
  </div><button type="button" class="wvc-replay" data-wvc-replay aria-label="重播回复过程" title="重播回复过程">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg><span>重播</span>
  </button>`;
  document.body.appendChild(demoControls);

  function activeReply() {
    return Array.from(document.querySelectorAll('.main.conversation-open #conversationThread [data-wvc-reply]')).at(-1) || null;
  }

  function syncControls() {
    const root = activeReply();
    demoControls.hidden = !root;
    if (!root) return;
    const plainText = investigationItems(root).length > 0;
    demoControls.querySelector('.wvc-format').hidden = plainText;
    for (const button of demoControls.querySelectorAll('[data-wvc-format]')) {
      button.setAttribute('aria-pressed', String(button.dataset.wvcFormat === displayFormat));
      button.disabled = plainText || root.dataset.wvcPhase !== '3';
    }
    for (const panel of root.querySelectorAll('[data-wvc-format-panel]')) {
      panel.hidden = panel.dataset.wvcFormatPanel !== displayFormat;
    }
  }
  const suppliers = [['恒川制造',47200,12,'符合条件'],['青禾供应',43200,18,'超期 4 天'],['立衡工厂',50400,9,'超预算 ¥2,400']];
  const stages = [['接单',100,'核查接单时间戳是否齐全。'],['到店',94,'核对接单后未到店的 6 笔订单。'],['出餐',80,'优先核对这 14 笔订单的到店与出餐时间戳。'],['交接',76,'核对已出餐但未交接的 4 笔订单。']];

  function renderSupplierDetail(index) {
    const [name, price, days, status] = suppliers[index];
    const priceGap = 48000 - price;
    const deliveryGap = 14 - days;
    return `<div class="wvc-supplier-heading"><strong>${name}</strong><span class="widget-badge" data-status="${index === 0 ? 'success' : 'warning'}">${status}</span></div>
      <dl>
        <div><dt>总报价</dt><dd>${money(price)}</dd><dd class="wvc-secondary">${priceGap >= 0 ? '低于预算' : '超出预算'} ${money(Math.abs(priceGap))}</dd></div>
        <div><dt>交期</dt><dd>${days} 天</dd><dd class="wvc-secondary">${deliveryGap >= 0 ? '提前' : '超期'} ${Math.abs(deliveryGap)} 天</dd></div>
      </dl>`;
  }

  function render(id) {
    const item = cases.find(entry => entry.id === id);
    let content;
    if (id === 'compare') {
      content = `<div class="wvc-constraints">预算 ¥48,000 · 14 天内到货</div>
        <div class="wvc-options" role="group" aria-label="查看供应商详情">
          ${suppliers.map(([name], index) => `<button type="button" class="widget-card" data-wvc-supplier="${index}" data-selected="${index === 0}" aria-pressed="${index === 0}">${name}</button>`).join('')}
        </div>
        <div class="wvc-supplier-detail" data-wvc-result aria-live="polite">${renderSupplierDetail(0)}</div>`;
    } else if (id === 'budget') {
      content = `<div class="wvc-budget widget-metric"><label for="wvc-guests">用餐人数</label><output for="wvc-guests" data-wvc-guests-output>20 人 · 2 桌</output><input id="wvc-guests" type="range" min="10" max="30" value="20" step="1"><div class="wvc-scale"><span>10 人</span><span>30 人</span></div></div><p class="wvc-serving-rule">按 ¥220 / 人试算 · 热菜150 / 凉菜40 / 主食与饮品30 · 每桌最多10人</p><div class="wvc-budget widget-metric"><label for="wvc-budget">总预算</label><output class="widget-metric-value" for="wvc-budget">¥4,800</output><input id="wvc-budget" type="range" min="3000" max="6000" value="4800" step="100"><div class="wvc-scale"><span>¥3,000</span><span>¥6,000</span></div></div><div class="wvc-actions"><span>预计支出 <b data-wvc-expense>¥4,400</b></span><strong class="widget-badge" data-status="success" data-wvc-result aria-live="polite">结余 ¥400</strong></div><div class="wvc-budget-charts">
        <figure class="wvc-cost-chart"><figcaption data-wvc-cost-caption>费用构成 · 2 桌 / 20 人</figcaption><div class="wvc-cost-stack" role="img" aria-label="热菜3000元，占68.2%；凉菜800元，占18.2%；主食与饮品600元，占13.6%"><i style="flex:3000"></i><i style="flex:800"></i><i style="flex:600"></i></div><ul class="wvc-cost-legend"><li><i></i>热菜 <b data-wvc-cost="150">¥3,000</b> <span>68.2%</span></li><li><i></i>凉菜 <b data-wvc-cost="40">¥800</b> <span>18.2%</span></li><li><i></i>主食与饮品 <b data-wvc-cost="30">¥600</b> <span>13.6%</span></li></ul></figure>
        <figure class="wvc-budget-comparison"><figcaption>预算与支出</figcaption><div class="wvc-budget-bar"><span>预算</span><div class="wvc-bar-track"><i data-wvc-budget-bar style="width:72.7273%"></i></div><span data-wvc-budget-label>¥4,800</span></div><div class="wvc-budget-bar"><span>支出</span><div class="wvc-bar-track"><i class="wvc-expense-bar" style="width:66.6667%"></i></div><span data-wvc-expense>¥4,400</span></div><p data-wvc-budget-ratio>预计支出占预算 91.7%</p></figure>
      </div>`;
    } else {
      content = `<div class="wvc-funnel-summary"><div class="widget-metric"><b class="widget-metric-value">76%</b><span class="widget-metric-label">完成交接</span></div><div class="widget-metric"><strong class="widget-metric-value">−14 笔</strong><span class="widget-metric-label">最大流失 · 到店至出餐</span></div></div>
        <div class="wvc-stages" role="group" aria-label="履约环节">
          ${stages.map(([name,count],index)=>`<button type="button" data-wvc-stage="${index}" aria-pressed="${index===2}">
            <span>${name}</span><span class="wvc-stage-track"><i style="--wvc-width:${count}%" aria-hidden="true"></i></span><b>${count}</b>
          </button>`).join('')}
        </div><p data-wvc-result aria-live="polite"><strong>到店 → 出餐 · 减少 14 笔</strong><br>${stages[2][2]}</p>`;
    }
    return `<section class="wvc-widget widget-card" data-wvc-case="${id}" aria-label="${item.title}"><h3>${item.title}</h3>${content}</section>`;
  }

  function renderReply(id) {
    return `<section class="wvc-reply" data-wvc-reply="${id}" data-wvc-phase="0"><div data-wvc-process></div><div data-wvc-answer></div></section>`;
  }

  function renderTextTable(headers, rows) {
    return `<div class="wvc-text-table"><table>
      <thead><tr>${headers.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, ...cells]) => `<tr><th scope="row">${label}</th>
        ${cells.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderTextReply(id) {
    if (id === 'compare') {
      const rows = suppliers.map(([name, price, days, status]) => [name, money(price), `${days} 天`, status]);
      return `<p><strong>建议选恒川制造。</strong>它是唯一满足 ¥48,000 预算和 14 天交期的供应商，低于预算 ¥800，提前 2 天到货。</p>
        ${renderTextTable(['供应商', '总报价', '交期', '与要求对照'], rows)}`;
    }
    if (id === 'budget') {
      return `<p>20 人、2 桌套菜预计支出 <strong>¥4,400</strong>。按默认预算 ¥4,800 计算，还剩 <strong>¥400</strong>。</p>
        ${renderTextTable(['费用项', '预计支出'], [['热菜（20 人 × ¥150）', '¥3,000'], ['凉菜（20 人 × ¥40）', '¥800'], ['主食与饮品（20 人 × ¥30）', '¥600']])}
        <p>按 ¥220/人试算，每桌最多 10 人。17 人安排 2 桌，共 ¥3,740，按 ¥4,800 预算结余 ¥1,060。人数可在 10–30 人间调整，预算可在 ¥3,000–¥6,000 间调整。</p>`;
    }
    const rows = stages.map(([name, count, detail], index) => [
      name, `${count} 笔`, index ? `少 ${stages[index - 1][1] - count} 笔` : '起点', detail
    ]);
    return `<p><strong>优先核查到店 → 出餐。</strong>这个环节比上一步少了 14 笔，是流失最多的一步。100 笔订单中，最终有 76 笔完成交接。</p>
      ${renderTextTable(['环节', '订单数', '比上一步', '核查建议'], rows)}`;
  }

  function renderDiagnosisResult() {
    const csv = '\uFEFF环节,订单数,较上一步减少\r\n接单,100,0\r\n到店,94,6\r\n出餐,80,14\r\n交接,76,4\r\n';
    const download = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    return `<div class="wvc-diagnosis-result">
      <section class="wvc-diagnosis-copy" aria-label="分析结论"><p><strong>建议先核查到店到出餐这一段。</strong>94 笔到店订单中，有 14 笔未进入出餐，占 14.9%，是全流程差值最大的环节。各环节的订单数和差值已整理在下方 CSV 中。</p></section>
      <div class="conversation-artifact wvc-result-file"><a class="conversation-artifact-open" href="${download}" download="履约环节汇总.csv"><span class="conversation-artifact-icon"><img src="assets/artifact-excel.svg" alt="" aria-hidden="true"></span><span class="conversation-artifact-info"><strong>履约环节汇总.csv</strong><small>下载产物 · 示例数据</small></span></a><span class="wvc-file-download" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg></span></div>
      ${render('diagnose')}
      <section class="wvc-diagnosis-copy" aria-label="核查说明"><p>当前汇总数据只能定位差异。需要结合订单明细确认取消、漏记或实际延误，再判断具体原因。</p></section>
      <section class="wvc-widget widget-card wvc-investigation" aria-label="选择下一步核查内容"><h3>下一步核查</h3><p>选择要核查的内容，整理成后续任务。</p>
        <label><input type="checkbox" value="核对到店与出餐时间戳" checked>核对到店与出餐时间戳</label>
        <label><input type="checkbox" value="检查取消、退款及漏记记录" checked>检查取消、退款及漏记记录</label>
        <label><input type="checkbox" value="按门店与时段比较差异">按门店与时段比较差异</label>
        <div class="wvc-actions"><span data-wvc-investigation-status role="status">已选 2 项</span><button type="button" data-variant="primary" data-wvc-investigation-confirm>生成核查清单</button></div>
        <ol data-wvc-investigation-plan hidden></ol>
      </section>
    </div>`;
  }

  function renderResult(id) {
    if (id === 'diagnose') return renderDiagnosisResult();
    return `<div class="wvc-final-result"><section class="stage-summary" aria-label="工作总结"><p>${replyCopy[id][2]}</p></section>${render(id)}</div>`;
  }

  const investigationChoices = [
    {label:'核对到店与出餐时间戳',source:'订单编号、到店时间、出餐时间及状态记录',method:'逐笔核对到店但未进入出餐的 14 笔记录，区分缺失时间戳与实际等待过长。'},
    {label:'检查取消、退款及漏记记录',source:'取消、退款记录及订单状态变更日志',method:'按订单编号交叉核对取消、退款与出餐记录，标出能解释环节差值的记录及待补证据。'},
    {label:'按门店与时段比较差异',source:'门店、订单时段及各环节数量明细',method:'按门店与时段汇总到店到出餐的差值，列出需要优先复核的分组。'}
  ];
  const escapeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function investigationItems(root) {
    try {
      const values = JSON.parse(root.dataset.wvcInvestigationItems || '[]');
      return investigationChoices.filter(item => Array.isArray(values) && values.includes(item.label));
    } catch (_) { return []; }
  }
  function renderInvestigationReply(values) {
    const selected = investigationChoices.filter(item => values.includes(item.label)).map(item => item.label);
    return renderReply('diagnose').replace('data-wvc-phase="0"',
      `data-wvc-phase="0" data-wvc-investigation-items="${escapeText(JSON.stringify(selected))}"`);
  }
  function renderInvestigationPlan(items) {
    return `<article class="md conversation-reply wvc-investigation-text" aria-label="核查清单">
      <h3>核查清单</h3><p>按你选择的 ${items.length} 项整理如下，先准备资料，再逐项核对。</p>
      <ol>${items.map(item => `<li><strong>${item.label}</strong><p>所需资料：${item.source}</p><p>核查方法：${item.method}</p></li>`).join('')}</ol>
      <p>这是一份核查安排。尚未提供订单明细，不能确认差值来自取消、漏记还是实际延误。</p>
    </article>`;
  }

  const replyExits = new WeakMap();
  function updateReply(root, phase, renderStage, stepMotion) {
    const id = root.dataset.wvcReply;
    const item = cases.find(entry => entry.id === id);
    const items = investigationItems(root);
    const isInvestigation = items.length > 0;
    const [acknowledgement, tool] = isInvestigation
      ? [`我会沿用刚才的履约分析，把你选择的 ${items.length} 项整理为核查清单，列明所需资料和核查方法。`, '生成核查清单']
      : replyCopy[id];
    const process = root.querySelector('[data-wvc-process]');
    const answer = root.querySelector('[data-wvc-answer]');
    const animate = phase > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousHeight = animate ? root.getBoundingClientRect().height : 0;
    const expandedCalls = Array.from(process.querySelectorAll('[data-stage-completed-call][open]'),
      call => call.dataset.stageCompletedCall);
    const previousText = process.querySelector('.stage-current > p');
    const markup = renderStage(root, phase, {
      acknowledgement, tool, task:isInvestigation ? '整理已选核查事项' : item.task, title:isInvestigation ? '核查清单' : item.title,
      plainText:isInvestigation, modules:isInvestigation ? [] : id === 'diagnose' ? ['chart', 'interactive'] : ['interactive']
    });
    const template = document.createElement('template');
    template.innerHTML = markup;
    const nextText = template.content.querySelector('.stage-current > p');
    const sameText = phase !== 0 && previousText && nextText?.textContent === previousText.textContent;
    if (sameText) nextText.replaceWith(previousText);
    process.replaceChildren(template.content);
    for (const call of process.querySelectorAll('[data-stage-completed-call]')) {
      call.open = expandedCalls.includes(call.dataset.stageCompletedCall);
    }
    root.dataset.wvcPhase = String(phase);
    if (phase === 0 || phase === 3) {
      answer.innerHTML = phase !== 3 ? '' : isInvestigation ? renderInvestigationPlan(items) : `
        <div class="stage-result" data-wvc-format-panel="widget">${renderResult(id)}</div>
        <article class="md conversation-reply" data-wvc-format-panel="text" hidden>${renderTextReply(id)}</article>`;
    }
    syncControls();
    conversationBridge.replyChanged?.(root);
    if (animate) {
      animateReplyTransition(root, previousHeight, phase === 3 ? answer : null);
      stepMotion?.enter(sameText ? null : nextText, process.querySelector('.stage-current > .stage-tool-call'));
    }
  }

  function animateReplyTransition(root, previousHeight, incoming) {
    const height = root.getBoundingClientRect().height;
    const easing = 'cubic-bezier(.22,.68,0,1)';
    if (Math.abs(height - previousHeight) > 1) {
      root.animate([
        { height: `${previousHeight}px`, overflow: 'clip' },
        { height: `${height}px`, overflow: 'clip' }
      ], { duration: 320, easing });
    }
    incoming?.animate([
      { opacity: 0, transform: 'translateY(5px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 240, delay: 60, easing, fill: 'backwards' });
  }

  function playReply(root, renderStage, {replay = false, stepMotion} = {}) {
    if (!root) return;
    replyRenderers.set(root, {renderStage, stepMotion});
    if (replay) {
      clearTimeout(replyTimers.get(root));
      replyTimers.delete(root);
      replyExits.get(root)?.cancel();
      replyExits.delete(root);
    }
    if (replyTimers.has(root) || replyExits.has(root)) return;
    syncControls();
    if (replay || !root.dataset.startedAt) {
      delete root.dataset.planExpanded;
      root.dataset.startedAt = String(Date.now());
      updateReply(root, 0, renderStage, stepMotion);
    }
    const phase = Number(root.dataset.wvcPhase);
    if (phase === 3) return;
    const timer = setTimeout(() => {
      replyTimers.delete(root);
      if (!root.isConnected || root.closest('[hidden]')) return;
      const next = () => {
        if (!root.isConnected || root.closest('[hidden]')) return;
        updateReply(root, phase + 1, renderStage, stepMotion);
        playReply(root, renderStage, {stepMotion});
      };
      const exit = stepMotion?.exit(root.querySelector('.stage-current > p'),
        root.querySelector('.stage-current > .stage-tool-call'), phase === 2);
      if (!exit) return next();
      replyExits.set(root, exit);
      exit.finished.then(() => {
        if (replyExits.get(root) !== exit) return;
        replyExits.delete(root);
        next();
        exit.cancel();
      });
    }, [1800, 1500, 1800][phase]);
    replyTimers.set(root, timer);
  }

  document.addEventListener('input', event => {
    if (event.target.matches('.wvc-investigation input')) {
      const card = event.target.closest('.wvc-investigation');
      for (const input of card.querySelectorAll('input')) input.toggleAttribute('checked', input.checked);
      const count = card.querySelectorAll('input:checked').length;
      card.querySelector('[data-wvc-investigation-status]').textContent = '已选 ' + count + ' 项';
      card.querySelector('[data-wvc-investigation-confirm]').disabled = count === 0;
      card.querySelector('[data-wvc-investigation-plan]').hidden = true;
      conversationBridge.replyChanged?.(card);
      return;
    }
    if (!event.target.matches('.wvc-budget input')) return;
    const slider = event.target;
    const widget = slider.closest('[data-wvc-case]');
    const budget = widget.querySelector('#wvc-budget').valueAsNumber;
    const guests = widget.querySelector('#wvc-guests').valueAsNumber;
    const tables = Math.ceil(guests / 10);
    const expense = guests * 220;
    slider.setAttribute('value', slider.value);
    widget.querySelector('output[for="wvc-budget"]').textContent = money(budget);
    widget.querySelector('[data-wvc-guests-output]').textContent = guests + ' 人 · ' + tables + ' 桌';
    for (const label of widget.querySelectorAll('[data-wvc-expense]')) label.textContent = money(expense);
    for (const label of widget.querySelectorAll('[data-wvc-cost]')) label.textContent = money(Number(label.dataset.wvcCost) * guests);
    widget.querySelector('[data-wvc-cost-caption]').textContent = '费用构成 · ' + tables + ' 桌 / ' + guests + ' 人';
    widget.querySelector('.wvc-cost-stack').setAttribute('aria-label',
      '热菜' + guests * 150 + '元，占68.2%；凉菜' + guests * 40 + '元，占18.2%；主食与饮品' + guests * 30 + '元，占13.6%');
    const result = widget.querySelector('[data-wvc-result]');
    result.textContent = (budget < expense ? '超支 ' : '结余 ') + money(Math.abs(budget - expense));
    result.dataset.status = budget < expense ? 'warning' : 'success';
    widget.querySelector('[data-wvc-budget-bar]').style.width = (budget / 6600 * 100) + '%';
    widget.querySelector('.wvc-expense-bar').style.width = (expense / 6600 * 100) + '%';
    widget.querySelector('[data-wvc-budget-label]').textContent = money(budget);
    widget.querySelector('[data-wvc-budget-ratio]').textContent = '预计支出占预算 ' + (expense / budget * 100).toFixed(1) + '%';
    widget.querySelector('.wvc-budget-comparison').dataset.status = result.dataset.status;
  });
  document.addEventListener('click', event => {
    const investigate = event.target.closest('[data-wvc-investigation-confirm]');
    if (investigate) {
      const card = investigate.closest('.wvc-investigation');
      if (investigate.disabled || card.dataset.submitted === 'true') return;
      const selected = Array.from(card.querySelectorAll('input:checked'), input => input.value);
      if (!selected.length) return;
      if (card.closest('#conversationThread')) {
        if (!conversationBridge.submitInvestigation?.(selected, card)) return;
        card.dataset.submitted = 'true';
        investigate.disabled = true;
        investigate.textContent = '已发送';
        for (const input of card.querySelectorAll('input')) input.disabled = true;
        card.querySelector('[data-wvc-investigation-plan]').hidden = true;
        card.querySelector('[data-wvc-investigation-status]').textContent = '已发送到对话';
        conversationBridge.replyChanged?.(card);
        return;
      }
      const plan = card.querySelector('[data-wvc-investigation-plan]');
      plan.replaceChildren(...Array.from(card.querySelectorAll('input:checked'), input => {
        const row = document.createElement('li');
        row.textContent = input.value;
        return row;
      }));
      plan.hidden = false;
      card.querySelector('[data-wvc-investigation-status]').textContent = '核查清单已整理';
      return;
    }
    const deckFormat = event.target.closest('[data-wvc-deck-format]');
    if (deckFormat) {
      const card = deckFormat.closest('.wvc-deck-case');
      if (!card) return;
      for (const button of card.querySelectorAll('[data-wvc-deck-format]')) {
        button.setAttribute('aria-pressed', String(button === deckFormat));
      }
      for (const panel of card.querySelectorAll('[data-wvc-deck-panel]')) {
        panel.hidden = panel.dataset.wvcDeckPanel !== deckFormat.dataset.wvcDeckFormat;
      }
      return;
    }
    const format = event.target.closest('[data-wvc-format]');
    if (format) {
      if (format.disabled || !demoControls.contains(format)) return;
      displayFormat = format.dataset.wvcFormat;
      syncControls();
      return;
    }
    if (event.target.closest('[data-wvc-replay]')?.closest('.wvc-demo-controls')) {
      const root = activeReply();
      const renderer = root && replyRenderers.get(root);
      if (renderer) playReply(root, renderer.renderStage, {replay:true, stepMotion:renderer.stepMotion});
      return;
    }
    const button = event.target.closest('[data-wvc-supplier], [data-wvc-stage]');
    if (!button) return;
    const widget = button.closest('[data-wvc-case]');
    const result = widget.querySelector('[data-wvc-result]');
    const selector = button.hasAttribute('data-wvc-stage') ? '[data-wvc-stage]' : '[data-wvc-supplier]';
    for (const option of widget.querySelectorAll(selector)) {
      const selected = String(option === button);
      option.setAttribute('aria-pressed', selected);
      if (selector === '[data-wvc-supplier]') option.dataset.selected = selected;
    }
    if (selector === '[data-wvc-supplier]') {
      result.innerHTML = renderSupplierDetail(Number(button.dataset.wvcSupplier));
      return;
    }
    const index = Number(button.dataset.wvcStage);
    const [name,count,detail] = stages[index];
    const previous = stages[index - 1];
    const title = previous ? previous[0] + ' → ' + name + ' · 减少 ' + (previous[1] - count) + ' 笔' : name + ' · ' + count + ' 笔';
    result.innerHTML = '<strong>' + title + '</strong><br>' + detail;
  });
  window.CatPawWidgetCases = { cases, render, renderResult, renderTextReply, renderReply, renderInvestigationReply, playReply, syncControls, connectConversation(bridge) { conversationBridge = bridge; } };
})();
