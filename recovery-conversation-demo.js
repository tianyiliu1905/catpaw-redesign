/* Preset recovery scenario. All files and amounts in this demo are sample data. */
(function(root){
  'use strict';
  const extraPaths={
    auth:{reading:{finish:'blocked'},blocked:{login:'handoff',defer:'deferred'},deferred:{login:'handoff'},handoff:{confirm:'verifying',back:'blocked'},verifying:{finish:'done'},done:{restart:'reading'}},
    receipt:{reading:{finish:'unknown'},unknown:{check:'checking'},checking:{finish:'done'},done:{restart:'reading'}},
    exhausted:{reading:{finish:'retrying'},retrying:{finish:'blocked',cancel:'paused'},blocked:{retry:'retrying',later:'paused',partial:'partial'},paused:{retry:'retrying',resume:'verifying',partial:'partial'},partial:{resume:'verifying'},verifying:{finish:'done'},done:{restart:'reading'}}
  };
  const stages = ['reading','blocked','choosing','selected','resuming','done'];
  function createModel(mode='supplement'){
    let stage='reading',choice='fallback',attempt=0;
    return {
      get stage(){return stage;},
      get choice(){return choice;},
      get attempt(){return attempt;},
      reset(){stage='reading';choice='fallback';attempt=0;},
      act(action){
        const retryMode=['retry','exhausted'].includes(mode);
        if(mode==='retry'&&stage==='retrying'&&(action==='finish'||(action==='retry'&&attempt>4))){attempt++;return true;}
        if(retryMode&&stage==='retrying'&&action==='finish'&&attempt<4){attempt++;return true;}
        const paths=extraPaths[mode] || (mode==='retry'?{reading:{finish:'retrying'},retrying:{finish:'blocked'},blocked:{retry:'retrying'},verifying:{finish:'done'},done:{restart:'reading'}}:mode==='failure'?{reading:{finish:'failed'},failed:{fallback:'alternative',script:'alternative',pause:'paused'},paused:{fallback:'alternative',script:'alternative'},alternative:{finish:'done'},done:{restart:'reading'}}: {reading:{finish:'blocked'},blocked:{choose:'choosing'},choosing:{select:'selected',cancel:'blocked'},selected:{continue:'resuming',replace:'choosing'},resuming:{finish:'done'},done:{restart:'reading'}});
        const next=paths[stage]?.[action];
        if(!next)return false;
        if(mode==='failure'&&['fallback','script'].includes(action))choice=action;
        if(retryMode&&next==='retrying')attempt=1;
        stage=next;return true;
      },
    };
  }
  function createController({thread,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,mode='supplement',stepMotion,actionHost,systemHost}){
    const model=createModel(mode);
    let active=false,timer=null,generation=0;
    const status=()=>extraPaths[mode]?({reading:'处理中',blocked:mode==='auth'?'等待本人登录':'已暂停 · 保留进度',deferred:'已暂停 · 待授权',handoff:'等待本人操作',verifying:'正在继续',unknown:'提交结果待确认',checking:'正在查询回执',retrying:'服务暂时不可用 · 正在重试',paused:'已暂停',partial:'已保留部分结果',done:'已完成'})[model.stage]:mode==='retry'?({reading:'读取中',retrying:'正在重试',verifying:'连接已恢复 · 核对中',blocked:'等待重新尝试',done:'已完成'})[model.stage]:mode==='failure'?({reading:'检查能力',failed:'暂时无法完成',alternative:model.choice==='script'?'正在整理讲解稿':'正在整理分镜',paused:'已暂停',done:'替代内容已整理'})[model.stage]:({reading:'读取中',blocked:'等待补充',choosing:'等待补充',selected:'资料已补充',resuming:'核对中',done:'已完成'})[model.stage];
    function body(){
      const stage=model.stage;
      const button=(action,label)=>`<button data-recovery-action="${action}">${label}</button>`;
      const replay=button('restart','重播处理过程');
      if(mode==='auth'){
        const saved='<p class="recovery-retained">已保留：本月巡检问题清单与更新提纲。</p>';
        if(stage==='reading')return '<p>已整理巡检问题，正在读取资料库中的现行规范。</p><div class="recovery-tool is-running">读取现行规范</div>';
        if(['blocked','handoff','deferred'].includes(stage))return `${saved}<p>企业资料库的登录已失效，读取现行规范这一步已暂停。请在下方输入区完成授权，之后从这里继续。</p>`;
        if(stage==='verifying')return `${saved}<p>登录状态已恢复（演示），继续读取规范并核对更新内容。</p><div class="recovery-tool is-running">续跑：核对现行规范</div>`;
        return '<p>已结合现行规范整理更新建议，原问题清单与提纲沿用，无需重做。</p><div class="recovery-result">巡检流程更新建议 · 示例<br>补充交接记录、异常上报和整改复查步骤。</div>'+replay;
      }
      if(mode==='receipt'){
        if(stage==='reading')return '<p>按你确认的内容提交年度预算调整审批。</p><div class="recovery-tool is-running">提交审批 · 等待回执</div>';
        if(stage==='unknown')return '<section class="recovery-request"><span>尚不能确认是否提交成功</span><p>请求发出后连接中断，审批可能已创建。调整说明与本次提交记录已保留，不会自动重复提交。</p>'+button('check','查询是否已提交')+'</section>';
        if(stage==='checking')return '<p>正在按本次请求标识查询审批系统，只核对结果，不再次提交。</p><div class="recovery-tool is-running">查询审批回执</div>';
        return '<p>已查到本次提交，审批正在等待处理，无需再次提交。</p><div class="recovery-result">审批回执 · 示例<br>编号：YS-2026-031<br>内容：年度预算调整说明<br>状态：待审批</div>'+replay;
      }
      if(['retry','exhausted'].includes(mode)&&['reading','retrying','blocked','paused'].includes(stage)){
        const supplier=mode==='retry';
        const target=supplier?'交付记录':'营销明细';
        const intro=supplier?'我会接着核对交付记录，整理供应链风险与应对建议。':'我会继续读取营销明细，结合销售和客流数据分析指标变化。';
        if(stage==='reading')return `<p>${intro}</p><div class="recovery-tool is-running">读取${target}</div>`;
        if(supplier){
          const notice=model.attempt>4?`<section class="recovery-retry-card" aria-label="持续重试提示"><header><span role="status">连接有点慢，仍在重试中</span><div class="recovery-retry-actions">${button('retry','立即重试')}</div></header><p>前 2 份资料和当前进度都已保留，不用从头开始。我会继续尝试连接，你也可以点击「立即重试」。</p></section>`:'';
          return `<p>${intro}</p><div class="recovery-tool is-running">正在重新连接 · 第 ${model.attempt} 次重试</div>${notice}`;
        }
        const waiting=stage==='retrying';
        return `<p>${intro}</p><section class="recovery-retry-card" aria-label="连接重试进度"><header>${waiting?'<span class="spinner" aria-hidden="true"></span>':recoveryIcon('file')}<span role="status">${waiting?'正在重新连接':'重试已暂停'}</span><small>${waiting?`第 ${model.attempt} 次重试`:''}</small><div class="recovery-retry-actions">${waiting?button('cancel','停止重试'):button('retry','重新尝试')}</div></header>${waiting?`<ol>${Array.from({length:model.attempt-1},(_,i)=>`<li>第 ${i+1} 次重试未连接成功</li>`).join('')}</ol>`:''}</section>`;
      }
      if(mode==='exhausted'){
        const saved='<p class="recovery-retained">已保留：销售与客流数据、指标变化初步汇总。尚缺营销明细。</p>';
        if(stage==='reading')return '<p>销售与客流数据已读取，正在获取营销明细。</p><div class="recovery-tool is-running">读取营销数据</div>';
        if(stage==='retrying')return `${saved}<p>营销数据服务暂时不可用，正在进行最后一次自动重试（3 / 3）。</p><div class="recovery-tool is-running">等待服务恢复</div>`;
        if(stage==='blocked')return `${saved}<section class="recovery-request"><span>自动重试已停止</span><p>3 次尝试仍未成功。继续等待无法保证恢复，已停止请求；暂时不能判断营销活动对指标的影响。</p><div class="recovery-actions">${button('later','稍后继续')}${button('partial','先看已完成部分')}</div></section>`;
        if(stage==='paused')return `${saved}<p>任务已暂停，不会在后台持续重试。准备好后只重试营销明细这一步。</p>${button('resume','重试未完成步骤')}`;
        if(stage==='partial')return `${saved}<div class="recovery-result">初步汇总 · 示例<br>销售和客流变化已完成对齐。营销影响尚未核实，不能作为完整归因结论。</div>${button('resume','重试营销明细')}`;
        if(stage==='verifying')return `${saved}<p>服务已恢复（演示），接着读取营销明细，补全归因分析。</p><div class="recovery-tool is-running">读取未完成的数据</div>`;
        return '<p>已补齐营销明细，合并此前保留的销售与客流分析，完成本次汇总。</p>'+replay;
      }
      if(mode==='retry'){
        const saved='<p class="recovery-retained"><span aria-hidden="true">✓</span> 前 2 份资料已保留：供应商名单、风险分类</p>';
        const history='';
        if(stage==='reading')return '<p>我会对照供应商交付记录，整理风险与应对措施。</p><div class="recovery-tool is-running">读取记录　正在连接供应链资料服务</div>';
        if(stage==='retrying')return `${saved}<p>读取第 3 份交付记录超时，正在重新读取这份文件。</p><div class="recovery-tool is-running">重新连接　正在第 2 次尝试</div><div class="recovery-actions"><button class="recovery-secondary" data-recovery-action="cancel">停止重试</button></div>`;
        if(stage==='paused')return `${saved}<p>已停止重试，交付记录尚未读取。</p><button data-recovery-action="retry">重新尝试</button>`;
        if(stage==='verifying')return `${saved}<p>连接已恢复，接着核对交付记录，只处理刚才未读取的部分。</p>${history}<div class="recovery-tool is-running">核对记录　正在整理风险预案</div>`;
        return `${saved}<p>已完成风险预案整理。重点关注延期交付，提前确认备货与替代供应商。</p>${history}<div class="recovery-result"><span>风险预案 · 示例内容</span><p>交期延误：提前两天核对发货状态<br>供货不足：保留备用供应商与安全库存</p></div><button class="recovery-secondary" data-recovery-action="restart">重播恢复过程</button>`;
      }
      if(mode==='failure'){
        const options=`<div class="recovery-actions">${button('fallback','整理分镜和解说稿')}${button('script','只写解说稿')}${stage==='paused'?'':button('pause','先暂停')}</div>`;
        if(stage==='reading')return '<p>我先检查能否把复盘材料生成视频。</p><div class="recovery-tool is-running">检查工具　确认视频生成能力</div>';
        if(stage==='failed')return '<p>复盘材料已经整理好了，不过我目前还不能直接生成视频。</p><p>我可以先准备分镜和解说词，方便你接着制作；也可以只写一份讲解稿。你想先做哪一种？</p>'+options;
        if(stage==='paused')return '<p>好的，先停在这里。整理好的复盘材料会保留，之后可以继续准备分镜或解说稿。</p>'+options;
        const script=model.choice==='script';
        if(stage==='alternative')return `<p>${script?'好，我先把复盘内容写成可以直接讲述的解说稿。':'好，我把复盘内容按画面和解说配成分镜，方便后续制作。'}</p><div class="recovery-tool is-running">${script?'整理经营复盘解说稿':'按画面与解说整理复盘材料'}</div>`;
        const sections=[
          ['经营概况','季度关键指标与趋势图','先看本季度的经营表现，结合关键指标的变化，梳理本季度取得的进展和需要关注的问题。'],
          ['区域对比','各区域表现对比图','接下来比较各区域的表现，重点关注差异较大的区域。原因尚未核实的部分，留待进一步确认。'],
          ['后续行动','负责人、行动项与时间安排','最后，把需要核对和改进的事项逐项落实，明确负责人和时间安排，持续跟进进展。']
        ];
        return `<p>${script?'解说稿已经整理好，可以作为录音或汇报的起点。':'分镜和解说稿已经整理好，后续制作时可以逐段配上画面。'}视频文件尚未生成。</p><section class="recovery-result recovery-script" aria-label="${script?'解说稿':'分镜与解说稿'}"><header>${script?'经营复盘解说稿':'经营复盘 · 分镜与解说稿'}<small>示例内容</small></header>${sections.map(([title,visual,narration],i)=>`<article><h3><span>0${i+1}</span>${title}</h3>${script?'':`<div><span>画面</span><p>${visual}</p></div>`}<div><span>解说</span><p>${narration}</p></div></article>`).join('')}</section>`;
      }
      const retained='<p class="recovery-retained"><span aria-hidden="true">✓</span> 已读取推广账单，费用明细与渠道分类已保留</p>';
      if(stage==='reading')return '<p>我先整理各渠道的推广费用，再核对结算口径。</p><div class="recovery-tool is-running">读取文件　正在读取推广账单</div>';
      if(stage==='done')return `${retained}<p>已按补充的结算规则完成核对。示例账单中，服务费单列展示，退款从结算金额中扣除。</p><div class="recovery-result"><span>核对结果 · 示例数据</span><dl><div><dt>推广费用</dt><dd>¥12,000</dd></div><div><dt>退款扣除</dt><dd>−¥800</dd></div><div><dt>应结算</dt><dd>¥11,200</dd></div></dl></div><button class="recovery-secondary" data-recovery-action="restart">重播恢复过程</button>`;
      if(stage==='resuming')return `${retained}<p>已补充结算规则，接着核对退款与服务费，无需重新整理账单。</p><div class="recovery-tool is-running">核对口径　正在处理之前受阻的步骤</div>`;
      return `${retained}<p>账单里没有说明退款和服务费如何结算。缺少结算规则，暂时无法确认最终金额。</p><section class="recovery-request" aria-label="补充结算规则"><strong>需要补充：上月推广结算规则</strong><p>请提供包含退款处理、服务费口径的规则文件。</p>${stage==='selected'?'<div class="recovery-file">▤ 上月推广结算规则.docx <span>资料库示例</span></div><div class="recovery-actions"><button data-recovery-action="continue">继续核对</button><button class="recovery-secondary" data-recovery-action="replace">更换文件</button></div>':'<button data-recovery-action="choose">选择补充文件</button>'}</section>${stage==='choosing'?'<section class="recovery-picker" aria-label="选择示例资料"><div><strong>资料库 · 示例文件</strong><button class="recovery-secondary" data-recovery-action="cancel">取消</button></div><button class="recovery-file-option" data-recovery-action="select"><span>▤ 上月推广结算规则.docx</span><small>包含退款扣除方式与服务费结算说明</small></button></section>':''}`;
    }
    function renderSystemBanner(){
      if(!systemHost)return;
      if(!active){if(systemHost.dataset.owner===mode){systemHost.hidden=true;systemHost.innerHTML='';systemHost.closest('.conversation-page')?.classList.remove('has-system-notice');}return;}
      const stage=model.stage;
      const notices=mode==='retry'?{
        retrying:['供应链资料服务连接超时','正在尝试恢复连接'],
        verifying:['连接已恢复','继续读取未完成的资料']
      }:{
        retrying:['营销数据服务暂时不可用','正在尝试恢复连接'],
        blocked:['营销数据服务仍不可用','已有进度保留，可在下方重新尝试'],
        paused:['营销数据服务仍不可用','任务已暂停，已有结果保留'],
        partial:['营销数据暂缺','当前展示部分结果，尚不能完成全部归因'],
        verifying:['营销数据服务已恢复','正从未完成步骤继续（演示）']
      };
      const notice=notices[stage];systemHost.dataset.owner=mode;systemHost.hidden=!notice;
      systemHost.closest('.conversation-page')?.classList.toggle('has-system-notice',!!notice);
      systemHost.innerHTML=notice?`<div class="recovery-system-banner" role="status"><span class="recovery-system-dot" aria-hidden="true"></span><div><span>${notice[0]}</span><small>${notice[1]}</small></div>${notice[2]?`<button data-recovery-action="${notice[2]}">${notice[3]}</button>`:''}</div>`:'';
    }
    function renderActionCard(){
      if(!actionHost)return;
      const stage=model.stage;
      const covered=active&&['blocked','handoff'].includes(stage);
      actionHost.closest?.('.conversation-composer-wrap')?.classList.toggle('has-auth-request',covered);
      // Retain the actual composer under the request overlay, but prevent hidden input.
      for(const child of actionHost.parentElement?.children||[]){
        if(child!==actionHost)child.inert=covered;
      }
      actionHost.hidden=!(active&&['blocked','handoff','deferred','verifying'].includes(stage));
      if(actionHost.hidden){actionHost.innerHTML='';return;}
      const button=(action,label,secondary=false)=>`<button class="${secondary?'recovery-secondary':''}" data-recovery-action="${action}">${label}</button>`;
      const waiting=stage==='handoff';
      const verifying=stage==='verifying';
      actionHost.innerHTML=`<section class="recovery-demo recovery-composer-card" aria-label="企业资料库授权" aria-live="polite">
        <div class="recovery-card-heading"><span class="recovery-card-icon" aria-hidden="true"><img src="./assets/figma-rail-library.svg" alt=""></span><span>${verifying?'已授权，正在继续读取':waiting?'完成登录后，将控制交回 Agent':'需要你授权企业资料库'}</span></div>
        <p>${verifying?'从读取现行规范这一步续跑，已整理的内容会沿用。':waiting?'登录接管演示：实际产品中将打开资料库登录页，由你完成登录或扫码。此处不收集账号信息。':stage==='deferred'?'任务已暂停。方便时完成授权即可接着做，不必重新发送任务。':'读取现行规范需要访问权限。授权后接着处理，问题清单与更新提纲已保留。'}</p>
        ${verifying?'':`<div class="recovery-actions">${waiting?button('back','返回',true)+button('confirm','模拟登录完成'):(stage==='deferred'?'':button('defer','暂不处理',true))+button('login','去授权')}</div>`}
      </section>`;
    }
    const recoveryIcons={
      file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>',
      chevron:'<path d="m6 9 6 6 6-6"/>'
    };
    const recoveryIcon=(name,cls='')=>`<svg viewBox="0 0 24 24" class="ic ${cls}" aria-hidden="true">${recoveryIcons[name]}</svg>`;
    function processPresentation(){
      const stage=model.stage, done=stage==='done';
      const running=['reading','retrying','verifying','checking','alternative'].includes(stage);
      const scenario={
        auth:{steps:['整理巡检问题与提纲','读取现行规范','整理流程更新建议'],completed:1,records:stage==='reading'?['已整理巡检问题与更新提纲']:['已整理巡检问题与更新提纲',...(['verifying','done'].includes(stage)?['登录状态已恢复']:['资料库登录失效，等待本人授权'])],detail:'读取企业资料库中的现行规范；问题清单和提纲保留，授权后继续。'},
        receipt:{steps:['提交已确认的审批材料','核对审批回执'],completed:stage==='reading'?0:1,records:stage==='reading'?['正在提交已确认的材料']:['提交请求已发出',...(done?['已查询到审批回执，状态为待审批']:['连接中断，提交结果待确认'])],detail:'按本次请求标识核对审批状态，不重复提交。'},
        failure:{steps:['检查视频生成能力',model.choice==='script'?'整理解说稿':'整理分镜与解说稿'],completed:stage==='reading'?0:1,records:stage==='reading'?['正在检查可用工具']:['当前没有可用的视频生成工具',...(['alternative','done'].includes(stage)?[model.choice==='script'?'用户已选择只写解说稿':'用户已选择先整理分镜与解说稿']:[])],detail:'当前仅能整理分镜与解说稿，不会生成视频文件。'}
      }[mode];
      const records=scenario?scenario.records:mode==='retry'?(stage==='reading'?['开始连接供应链资料服务']:['已读取供应商名单','已读取风险分类','第 3 份交付记录读取超时',...(['verifying','done'].includes(stage)?['第 2 次连接成功，继续读取交付记录']:[])]):['已读取三月份销售数据','已读取三月份客流数据',...(stage==='reading'?[]:[`营销明细读取超时，已尝试 ${model.attempt} 次重试`]),...(done?['已补齐营销明细并完成归因']:[])];
      const history=records.map(text=>`<li class="stage-completed-item"><span class="stage-completed-icon">${recoveryIcon('file')}</span><span>${text}</span></li>`).join('');
      const statusMarkup=`<details class="stage-thinking recovery-thinking" data-global-state="${running?'reading':'done'}"><summary class="stage-thinking-status"><span class="global-status-paw" aria-hidden="true"></span><strong>${status()}</strong>${recoveryIcon('chevron','stage-thinking-chevron')}</summary><section class="stage-completed" aria-label="执行记录"><ol>${history}</ol></section></details>`;
      const steps=scenario?scenario.steps:mode==='retry'?['读取供应商名单与风险分类','核对交付记录','整理风险预案']:['读取销售与客流数据','补齐营销明细','汇总核心指标归因'];
      const completed=done?steps.length:scenario?scenario.completed:mode==='retry'&&stage==='reading'?0:1;
      const plan=`<details class="stage-plan recovery-plan"><summary class="stage-plan-toggle">${recoveryIcon('list','stage-plan-icon')}<strong>待办任务</strong><span>已完成 ${completed}/${steps.length}</span>${recoveryIcon('chevron','stage-plan-chevron')}</summary><ol>${steps.map((title,i)=>`<li class="stage-plan-step" data-state="${i<completed?'done':running&&i===completed?'current':'pending'}"><span class="stage-plan-number">${running&&i===completed?'<span class="spinner" aria-hidden="true"></span>':`<span class="stage-plan-digit">${i+1}</span>`}</span><span class="stage-plan-title"><span class="stage-plan-title-text">${title}</span></span></li>`).join('')}</ol></details>`;
      const content=body().replace(/<div class="recovery-tool is-running">([^<]+)<\/div>/g,(_,text)=>`<details class="stage-tool-call recovery-tool is-running" data-tool-state="running"><summary><span class="stage-tool-icon">${recoveryIcon('file')}${recoveryIcon('file','stage-tool-shine')}</span><span class="stage-tool-copy"><span class="stage-tool-description">${text}</span></span>${recoveryIcon('chevron','stage-call-chevron')}</summary><div class="stage-call-details">${scenario?scenario.detail:mode==='retry'?'只重试尚未读取的交付记录；供应商名单与风险分类保留。':'只处理营销明细；已读取的销售与客流数据保留。'}</div></details>`);
      return statusMarkup+(done?'':plan)+content;
    }
    function initial(){return `<section class="recovery-demo" aria-label="任务受阻与恢复演示" data-recovery-mode="${mode}" data-recovery-stage="${model.stage}">${['retry','exhausted','auth','receipt','failure'].includes(mode)?processPresentation():`<div class="recovery-status" role="status">${status()}</div>${body()}`}</section>`;}

    function stop(){generation++;if(timer!==null)clearTimer(timer);timer=null;}
    function schedule(){
      stop();
      const token=generation;
      const delays=['retry','exhausted'].includes(mode)?{reading:2200,retrying:8000}:extraPaths[mode]?{reading:2200,retrying:3200,checking:2000,verifying:2200}:mode==='retry'?{reading:2200,retrying:3200,verifying:2200}:mode==='failure'?{reading:2200,alternative:2600}:{reading:2200,resuming:2600};
      if(active&&delays[model.stage])timer=setTimer(()=>{if(token!==generation||!active)return;timer=null;act('finish');},delays[model.stage]);
    }
    let transition=null;
    function cancelTransition(){transition?.cancel();transition=null;}
    function render(animate=false){
      cancelTransition();
      renderActionCard();
      renderSystemBanner();
      const panel=thread.querySelector('.recovery-demo');
      if(!panel)return;
      if(!animate||!stepMotion){panel.outerHTML=initial();onChange(model.stage);return;}
      const text=panel.querySelector(':scope > p');
      const tool=panel.querySelector(':scope > .recovery-tool.is-running');
      const replace=()=>{
        panel.outerHTML=initial();
        const next=thread.querySelector('.recovery-demo');
        const nextTool=next.querySelector(':scope > .recovery-tool.is-running');
        if(tool||nextTool)stepMotion.enter(next.querySelector(':scope > p'),nextTool);
        onChange(model.stage);
      };
      const exit=tool&&stepMotion.exit(text,tool,true);
      if(!exit){replace();return;}
      transition=exit;
      exit.finished.then(()=>{
        if(transition!==exit)return;
        transition=null;
        if(active&&panel.isConnected)replace();
        exit.cancel();
      });
    }
    function act(action){if(!active||!model.act(action))return false;render(true);schedule();return true;}
    function activate(enabled){active=enabled;stop();cancelTransition();if(enabled){render();schedule();}else {renderActionCard();renderSystemBanner();}}
    for(const area of [thread,actionHost,systemHost].filter(Boolean))area.addEventListener('click',event=>{
      const button=event.target.closest('[data-recovery-action]');
      if(button&&active)act(button.dataset.recoveryAction);
    });
    return {initial,activate,act,reset(){stop();model.reset();if(active){render();schedule();}},get stage(){return model.stage;}};
  }
  const api={stages,createModel,createController};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CatPawRecoveryDemo=api;
})(typeof window!=='undefined'?window:globalThis);
