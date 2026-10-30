/* Third conversation: structured, visual replies using a local quotation sample. */
(function (root) {
  'use strict';
  const suppliers = Object.freeze([
    { id:'a', name:'恒川制造', label:'均衡交付', price:118, days:12, quality:4.7, history:[90,92,94,95,96,96] },
    { id:'b', name:'青禾供应', label:'价格优势', price:108, days:18, quality:4.3, history:[93,94,95,94,93,94] },
    { id:'c', name:'立衡工厂', label:'快速交付', price:126, days:9, quality:4.8, history:[87,90,91,94,95,97] },
  ].map(item => Object.freeze({ ...item, history:Object.freeze(item.history) })));
  const defaults = Object.freeze({ quantity:400, budget:50000, deadline:14 });
  const followUps = Object.freeze([
    { id:'sample', label:'确认样品与规格', detail:'核对材质、尺寸与验收标准' },
    { id:'payment', label:'复核付款条件', detail:'确认预付款比例与结算周期' },
    { id:'delivery', label:'书面确认交期', detail:'约定到货日期与延期处理方式' },
  ]);
  const formats = Object.freeze([
    { id:'brief', label:'决策摘要', detail:'先看推荐与取舍' },
    { id:'compare', label:'数据对照', detail:'并排查看三家差异' },
    { id:'schedule', label:'交付排期', detail:'按时间安排后续行动' },
  ]);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const money = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits:2 }).format(value);
  const amount = value => `${money(value)} 元`;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 2 2 4-4M12 7h8M4 14l2 2 4-4M12 14h8M4 21l2 2 4-4M12 21h8" transform="translate(0 -2)"/></svg>';

  function validateConditions(input) {
    const values = Object.fromEntries(['quantity','budget','deadline'].map(key => [key, Number(input[key])]));
    const errors = {};
    if (!Number.isInteger(values.quantity) || values.quantity < 1 || values.quantity > 10000) errors.quantity = '采购数量请填写 1–10,000 之间的整数。';
    if (!Number.isFinite(values.budget) || values.budget <= 0 || values.budget > 10000000) errors.budget = '预算请填写大于 0、不超过 10,000,000 的金额。';
    if (!Number.isInteger(values.deadline) || values.deadline < 1 || values.deadline > 120) errors.deadline = '交期请填写 1–120 天之间的整数。';
    return { values, errors, valid:Object.keys(errors).length === 0 };
  }
  function evaluateSuppliers(conditions) {
    return suppliers.map(item => {
      const total = Math.round(item.price * conditions.quantity * 100) / 100;
      const overBudget = Math.max(0, Math.round((total - conditions.budget) * 100) / 100);
      const late = Math.max(0, item.days - conditions.deadline);
      return { ...item, total, overBudget, late, eligible:!overBudget && !late };
    });
  }
  function makeSession(id, conditions) {
    const checked = validateConditions(conditions);
    if (!checked.valid) throw new Error('Invalid procurement conditions');
    return { id, conditions:{ ...checked.values }, selected:null, metric:'price', format:'brief', followUps:[], notes:[], revision:0 };
  }
  function updateSession(session, action) {
    if (action.type === 'supplier' && suppliers.some(item => item.id === action.value)) session.selected = action.value;
    else if (action.type === 'metric' && ['price','delivery','trend'].includes(action.value)) session.metric = action.value;
    else if (action.type === 'format' && formats.some(item => item.id === action.value)) session.format = action.value;
    else if (action.type === 'follow-up' && followUps.some(item => item.id === action.value)) {
      session.followUps = action.checked ? [...new Set([...session.followUps, action.value])] : session.followUps.filter(id => id !== action.value);
    } else if (action.type === 'note' && String(action.value).trim()) session.notes.push(String(action.value).trim().slice(0, 2000));
    else return false;
    if (action.type !== 'metric') session.revision += 1;
    return true;
  }
  function conclusion(session) {
    const rows = evaluateSuppliers(session.conditions);
    const eligible = rows.filter(item => item.eligible).sort((a,b) => a.total - b.total);
    return eligible.length
      ? `${eligible.length} 家同时满足预算与交期，${eligible[0].name}是其中总价最低的方案。`
      : '目前没有同时满足预算与交期的方案。可以调整采购条件，或选择一家进一步确认取舍。';
  }
  function tradeoff(item) {
    const risks = [item.overBudget ? `超出预算 ${amount(item.overBudget)}` : '', item.late ? `晚于要求 ${item.late} 天` : ''].filter(Boolean);
    return risks.join('；') || '符合当前预算与交期';
  }
  function conditionsText(conditions) {
    return `${conditions.quantity} 件、预算 ${amount(conditions.budget)}、${conditions.deadline} 天内到货`;
  }
  function renderConditions(id, values = defaults, errors = {}) {
    const field = (key, label, suffix, max, step = '1') => `<label class="quote-field" for="${id}-${key}"><span>${label}</span><span class="quote-input-wrap"><input id="${id}-${key}" name="${key}" type="number" min="${step}" max="${max}" step="${step}" value="${escape(values[key])}" required${errors[key] ? ` aria-invalid="true" aria-describedby="${id}-${key}-error"` : ''}><span>${suffix}</span></span>${errors[key] ? `<span class="quote-error" id="${id}-${key}-error">${escape(errors[key])}</span>` : ''}</label>`;
    return `<section class="quote-ui quote-conditions" data-quote-conditions="${id}" aria-label="确认采购条件">
      <div class="quote-heading"><strong>先确认这次采购的条件</strong><span class="quote-muted">采购样例 · 含税含运</span></div>
      <form data-quote-form="conditions" novalidate><div class="quote-fields">${field('quantity','采购数量','件',10000)}${field('budget','预算上限','元',10000000,'0.01')}${field('deadline','最晚到货','天内',120)}</div>
      <div class="quote-footer"><span class="quote-muted">可以直接修改，比较结果会按这些条件计算。</span><button class="quote-button quote-primary" type="submit">按这些条件对比 <span aria-hidden="true">→</span></button></div></form>
    </section>`;
  }
  function renderConfirmed(id, values) {
    return `<section class="quote-ui quote-confirmed" data-quote-conditions="${id}"><span>${icon}已按 ${escape(conditionsText(values))} 对比</span><button class="quote-link" type="button" data-quote-edit="${id}">修改条件</button></section>`;
  }
  function renderComparison(rows, selected, group = null) {
    return `<div class="quote-comparison">${rows.map((item, index) => {
      const details = `<span class="quote-supplier-heading"><strong>${String.fromCharCode(65 + index)} · ${item.name}</strong><span class="quote-muted">${item.label}</span></span>
        <dl><div><dt>含税单价</dt><dd>${amount(item.price)}</dd></div><div><dt>采购总价</dt><dd>${amount(item.total)}</dd></div><div><dt>交货周期</dt><dd>${item.days} 天</dd></div><div><dt>样品评分</dt><dd>${item.quality.toFixed(1)} / 5</dd></div></dl>
        <span class="quote-fit${item.eligible ? ' is-fit' : ''}">${item.eligible ? '✓ ' : ''}${tradeoff(item)}</span>`;
      return group ? `<label class="quote-supplier${selected === item.id ? ' is-selected' : ''}"><input type="radio" name="${group}-supplier" value="${item.id}" data-quote-choice="supplier"${selected === item.id ? ' checked' : ''}>${details}<span class="quote-select-caption">${selected === item.id ? '已选，继续整理建议' : '选择这家供应商'}</span></label>`
        : `<div class="quote-supplier${selected === item.id ? ' is-selected' : ''}">${details}${selected === item.id ? '<span class="quote-select-caption">本次选择</span>' : ''}</div>`;
    }).join('')}</div>`;
  }
  function renderChart(session) {
    const rows = evaluateSuppliers(session.conditions);
    if (session.metric === 'trend') {
      const grid = [80,90,100].map(value => `<line x1="38" x2="486" y1="${130-(value-80)*5}" y2="${130-(value-80)*5}"/><text x="0" y="${135-(value-80)*5}">${value}%</text>`).join('');
      const lines = rows.map((item,index) => `<polyline class="quote-series quote-series-${item.id}" points="${item.history.map((value,i) => `${40+i*88},${130-(value-80)*5}`).join(' ')}"${index === 1 ? ' stroke-dasharray="6 4"' : index === 2 ? ' stroke-dasharray="2 4"' : ''}/>`).join('');
      return `<div class="quote-chart" aria-label="近六周准时交付率趋势"><svg class="quote-trend" viewBox="0 0 500 166" role="img" aria-label="近六周准时交付率：${rows.map(item => `${item.name}从${item.history[0]}%到${item.history.at(-1)}%`).join('；')}"><g class="quote-grid">${grid}</g>${lines}${[1,2,3,4,5,6].map((week,i) => `<text x="${40+i*88}" y="160" text-anchor="middle">${week} 周</text>`).join('')}</svg><div class="quote-legend">${rows.map(item => `<span class="quote-legend-${item.id}">${item.name} · ${item.history.at(-1)}%</span>`).join('')}</div><p class="quote-muted">六周履约样例。虚线区分供应商；历史准时率不代表本次交付承诺。</p></div>`;
    }
    const delivery = session.metric === 'delivery';
    const maximum = Math.max(...rows.map(item => delivery ? item.days : item.total), delivery ? session.conditions.deadline : session.conditions.budget);
    return `<div class="quote-chart" aria-label="${delivery ? '交货周期' : '采购总价'}对比">${rows.map(item => `<div class="quote-bar-row"><span>${item.name}</span><div class="quote-bar-track"><span class="quote-bar quote-series-${item.id}" style="width:${((delivery ? item.days : item.total)/maximum*100).toFixed(2)}%"></span></div><strong>${delivery ? `${item.days} 天` : amount(item.total)}</strong></div>`).join('')}<p class="quote-muted">${delivery ? `按确认下单后计算，要求 ${session.conditions.deadline} 天内到货。` : `按 ${session.conditions.quantity} 件计算，预算上限 ${amount(session.conditions.budget)}。`}</p></div>`;
  }
  function renderFormatOptions(session) {
    return `<fieldset class="quote-section"><legend>你想怎样呈现这份建议？</legend><p class="quote-muted">选一个更方便你向同事解释的方式。</p><div class="quote-formats">${formats.map(format => `<label class="quote-format${format.id === session.format ? ' is-selected' : ''}"><input type="radio" name="${session.id}-format" value="${format.id}" data-quote-choice="format"${format.id === session.format ? ' checked' : ''}>
      <span class="quote-mini quote-mini-${format.id}" aria-hidden="true">${format.id === 'brief' ? '<b>采购建议</b><i></i><i></i><em>推荐与取舍</em>' : format.id === 'compare' ? '<b>三家对照</b><span><i></i><i></i><i></i></span><em>报价 · 交期</em>' : '<b>交付安排</b><span><i></i><i></i><i></i></span><em>确认 → 到货</em>'}</span>
      <strong>${format.label}</strong><span class="quote-muted">${format.detail}</span></label>`).join('')}</div></fieldset>`;
  }
  function renderResults(session) {
    const rows = evaluateSuppliers(session.conditions);
    const eligible = rows.filter(item => item.eligible);
    const lowest = Math.min(...rows.map(item => item.total));
    return `<section class="quote-ui quote-results" data-quote-session="${session.id}" aria-label="供应商报价对比">
      <div class="quote-heading"><strong>三家供应商，同一口径比较</strong><button class="quote-link" type="button" data-quote-adjust="${session.id}">调整条件</button></div>
      <p class="quote-conclusion">${conclusion(session)}</p><div class="quote-metrics"><div><span>同时满足条件</span><strong>${eligible.length} 家</strong></div><div><span>最低总价</span><strong>${amount(lowest)}</strong></div><div><span>最快交货</span><strong>${Math.min(...rows.map(item => item.days))} 天</strong></div></div>
      <form data-quote-form="result" novalidate><fieldset class="quote-section"><legend>选一家继续讨论</legend>${renderComparison(rows, session.selected, session.id)}</fieldset>
      <section class="quote-section" aria-label="数据图表"><div class="quote-chart-heading"><strong>换个角度看差异</strong><div class="quote-segments" role="group" aria-label="图表指标">${[['price','报价'],['delivery','交期'],['trend','履约趋势']].map(([id,label]) => `<button type="button" data-quote-metric="${id}" aria-pressed="${id === session.metric}">${label}</button>`).join('')}</div></div>${renderChart(session)}</section>
      <fieldset class="quote-section"><legend>这些事项，要一起放进后续安排吗？</legend><div class="quote-follow-ups">${followUps.map(item => `<label><input type="checkbox" value="${item.id}" data-quote-choice="follow-up"${session.followUps.includes(item.id) ? ' checked' : ''}><span><strong>${item.label}</strong><span class="quote-muted">${item.detail}</span></span></label>`).join('')}</div></fieldset>
      ${renderFormatOptions(session)}${session.notes.length ? `<div class="quote-note"><strong>补充要求</strong>${session.notes.map(note => `<p>${escape(note)}</p>`).join('')}</div>` : ''}
      <div class="quote-footer"><span class="quote-muted" data-quote-selection-status role="status">${session.selected ? `已选 ${suppliers.find(item => item.id === session.selected).name} · ${session.followUps.length} 项跟进` : '选择供应商后，可整理成采购建议。'}</span><button type="submit" class="quote-button quote-primary">整理采购建议 <span aria-hidden="true">→</span></button></div></form>
    </section>`;
  }
  function generateReport(session) {
    const rows = evaluateSuppliers(session.conditions);
    const selected = rows.find(item => item.id === session.selected);
    if (!selected) throw new Error('请先选择一家供应商。');
    const format = formats.find(item => item.id === session.format);
    const tasks = followUps.filter(item => session.followUps.includes(item.id));
    const overview = `本次选择 ${selected.name}：${session.conditions.quantity} 件，共 ${amount(selected.total)}，交货周期 ${selected.days} 天。${tradeoff(selected)}。`;
    const comparison = rows.map(item => `${item.name}：${amount(item.total)} / ${item.days} 天`).join('；');
    const notes = session.notes.length ? `\n补充要求：${session.notes.join('；')}` : '';
    const taskText = tasks.length ? `\n跟进事项：${tasks.map(item => item.label).join('、')}` : '';
    const text = `采购建议 · ${format.label}\n${conditionsText(session.conditions)}\n${overview}\n${comparison}${taskText}${notes}\n以上基于采购样例报价。`;
    const followUpList = tasks.length ? `<div class="quote-report-tasks"><strong>接下来跟进</strong><ol>${tasks.map(item => `<li>${item.label}<span class="quote-muted">${item.detail}</span></li>`).join('')}</ol></div>` : '';
    const milestones = [
      { day:0, label:'现在', text:'核对规格、报价与条款' },
      { day:0, label:'确认后', text:'书面确认下单与交付日期' },
      { day:selected.days, label:`第 ${selected.days} 天`, text:'预计到货，安排验收' },
      { day:session.conditions.deadline, label:`第 ${session.conditions.deadline} 天`, text:'本次要求的到货期限', muted:true },
    ].sort((a,b) => a.day - b.day);
    const schedule = `<div class="quote-timeline">${milestones.map(item => `<div${item.muted ? ' class="quote-muted"' : ''}><span>${item.label}</span><strong>${item.text}</strong></div>`).join('')}</div>`;
    const main = session.format === 'compare' ? renderComparison(rows, session.selected) : session.format === 'schedule' ? schedule : `<div class="quote-report-metrics"><div><span>供应商</span><strong>${selected.name}</strong></div><div><span>采购总价</span><strong>${amount(selected.total)}</strong></div><div><span>交货周期</span><strong>${selected.days} 天</strong></div></div><p>${selected.eligible ? `预算还可留出 ${amount(session.conditions.budget-selected.total)}，交期比要求提前 ${session.conditions.deadline-selected.days} 天。` : `需要继续确认的取舍：${tradeoff(selected)}。`}</p>`;
    return { text, prompt:`选择 ${selected.name}，用「${format.label}」整理建议${tasks.length ? `，加上${tasks.map(item => item.label).join('、')}` : ''}。`, html:`<p>已根据你的选择整理好采购建议${tasks.length ? `，保留了 ${tasks.length} 项后续跟进` : ''}。</p><section class="quote-ui quote-report" data-quote-report="${session.id}-${session.revision}" aria-label="${format.label}"><div class="quote-heading"><strong>${format.label}</strong><span class="quote-muted">采购样例 · ${conditionsText(session.conditions)}</span></div><p class="quote-conclusion">${overview}</p>${main}${followUpList}${notes ? `<div class="quote-note"><strong>补充要求</strong>${session.notes.map(note => `<p>${escape(note)}</p>`).join('')}</div>` : ''}<div class="quote-footer"><button type="button" class="quote-link" data-quote-adjust="${session.id}">继续调整条件</button><button type="button" class="quote-button" data-quote-copy="${session.id}-${session.revision}">复制建议</button><span class="quote-muted" data-quote-copy-status role="status"></span></div></section>` };
  }
  function createController({ container, isActive, appendTurn, persist = () => {} }) {
    const sessions = new Map();
    const conditions = new Map();
    const reports = new Map();
    let serial = 0;
    let current = null;
    let pendingNotes = [];
    function newConditions(values = defaults) {
      const id = `quote-conditions-${++serial}`;
      conditions.set(id, { ...values });
      return renderConditions(id, values);
    }
    function refresh(session, focusSelector) {
      const area = container.querySelector(`[data-quote-session="${session.id}"]`);
      if (!area) return;
      area.outerHTML = renderResults(session);
      if (focusSelector) container.querySelector(`[data-quote-session="${session.id}"] ${focusSelector}`)?.focus({ preventScroll:true });
    }
    function publishReport(session) {
      const report = generateReport(session);
      const key = `${session.id}-${session.revision}`;
      if (reports.has(key)) {
        container.querySelector(`[data-quote-report="${key}"]`)?.scrollIntoView({ block:'center', behavior:'smooth' });
        return;
      }
      reports.set(key, report.text);
      appendTurn(report.prompt, report.html);
    }
    container.addEventListener('input', event => {
      if (!isActive()) return;
      const area = event.target.closest('[data-quote-conditions]');
      if (area && event.target.matches('input[name]')) {
        conditions.get(area.dataset.quoteConditions)[event.target.name] = event.target.value;
        event.target.setAttribute('value', event.target.value);
      }
    });
    container.addEventListener('change', event => {
      if (!isActive()) return;
      const input = event.target.closest('[data-quote-choice]');
      const session = sessions.get(input?.closest('[data-quote-session]')?.dataset.quoteSession);
      if (!session) return;
      updateSession(session, { type:input.dataset.quoteChoice, value:input.value, checked:input.checked });
      current = session;
      refresh(session, `[data-quote-choice="${input.dataset.quoteChoice}"][value="${input.value}"]`);
      persist();
    });
    container.addEventListener('submit', event => {
      const form = event.target.closest('[data-quote-form]');
      if (!form || !isActive()) return;
      event.preventDefault();
      if (form.dataset.quoteForm === 'conditions') {
        const area = form.closest('[data-quote-conditions]');
        const id = area.dataset.quoteConditions;
        const values = Object.fromEntries(new FormData(form));
        const validation = validateConditions(values);
        conditions.set(id, values);
        if (!validation.valid) {
          area.outerHTML = renderConditions(id, values, validation.errors);
          container.querySelector(`[data-quote-conditions="${id}"] [aria-invalid="true"]`)?.focus();
          persist();
          return;
        }
        const session = makeSession(`quote-result-${++serial}`, validation.values);
        session.notes = current ? [...current.notes] : [...pendingNotes];
        pendingNotes = [];
        conditions.set(id, session.conditions);
        current = session;
        sessions.set(session.id, session);
        area.outerHTML = renderConfirmed(id, session.conditions);
        appendTurn(`按 ${conditionsText(session.conditions)} 对比，先看看哪家合适。`, `<p>我把报价、交期和样品评分放在一起。${conclusion(session)}先选方案，再决定哪些事项需要继续跟进。</p>${renderResults(session)}`);
      } else {
        const session = sessions.get(form.closest('[data-quote-session]')?.dataset.quoteSession);
        if (!session) return;
        if (!session.selected) {
          const status = form.querySelector('[data-quote-selection-status]');
          status.textContent = '先选择一家供应商，再整理建议。';
          status.classList.add('quote-error');
          form.querySelector('[data-quote-choice="supplier"]')?.focus();
          return;
        }
        publishReport(session);
      }
      persist();
    });
    container.addEventListener('click', async event => {
      const button = event.target.closest('[data-quote-metric], [data-quote-adjust], [data-quote-edit], [data-quote-copy], [data-quote-generate]');
      if (!button || !isActive()) return;
      if (button.dataset.quoteMetric) {
        const session = sessions.get(button.closest('[data-quote-session]')?.dataset.quoteSession);
        if (!session) return;
        updateSession(session, { type:'metric', value:button.dataset.quoteMetric });
        refresh(session, `[data-quote-metric="${button.dataset.quoteMetric}"]`);
      } else if (button.dataset.quoteGenerate) {
        const session = sessions.get(button.dataset.quoteGenerate);
        if (session?.selected) publishReport(session);
      } else if (button.dataset.quoteCopy) {
        const status = button.closest('.quote-report').querySelector('[data-quote-copy-status]');
        try {
          await root.navigator.clipboard.writeText(reports.get(button.dataset.quoteCopy));
          status.textContent = '已复制';
        } catch (_) { status.textContent = '暂时无法复制，请选中文字复制。'; }
      } else {
        const session = sessions.get(button.dataset.quoteAdjust);
        const values = session?.conditions || conditions.get(button.dataset.quoteEdit) || defaults;
        if (session) current = session;
        appendTurn('我想再调整一下采购条件。', `<p>可以，改好下面的条件后，我会重新对比。</p>${newConditions(values)}`);
      }
      persist();
    });
    return {
      initial:newConditions,
      reset() {
        sessions.clear();
        conditions.clear();
        reports.clear();
        serial = 0;
        current = null;
        pendingNotes = [];
      },
      replyToText(text) {
        if (current) { updateSession(current, { type:'note', value:text }); refresh(current); }
        else pendingNotes.push(String(text).trim().slice(0, 2000));
        return `<p>已保留这条补充要求，会放进后续的采购建议。${current?.selected ? `当前选择是 ${suppliers.find(item => item.id === current.selected).name}。` : ''}如果要改变预算、数量或交期，可以在采购条件里直接修改。</p>${current?.selected ? `<div class="quote-ui quote-follow-up"><div class="quote-footer"><button type="button" class="quote-link" data-quote-adjust="${current.id}">调整采购条件</button><button type="button" class="quote-button quote-primary" data-quote-generate="${current.id}">更新采购建议</button></div></div>` : ''}`;
      },
    };
  }
  const api = Object.freeze({ suppliers, defaults, followUps, formats, validateConditions, evaluateSuppliers, makeSession, updateSession, conclusion, renderConditions, renderResults, generateReport, createController });
  root.CatPawSupplierDemo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
