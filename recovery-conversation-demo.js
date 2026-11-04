/* Preset recovery scenario. All files and amounts in this demo are sample data. */
(function(root){
  'use strict';
  const stages = ['reading','blocked','choosing','selected','resuming','done'];
  function createModel(mode='supplement'){
    let stage='reading';
    return {
      get stage(){return stage;},
      reset(){stage='reading';},
      act(action){
        const paths=mode==='retry'?{reading:{finish:'retrying'},retrying:{finish:'verifying',cancel:'paused'},verifying:{finish:'done'},paused:{retry:'retrying'},done:{restart:'reading'}}:mode==='failure'?{reading:{finish:'failed'},failed:{fallback:'alternative'},alternative:{finish:'done'},done:{restart:'reading'}}: {reading:{finish:'blocked'},blocked:{choose:'choosing'},choosing:{select:'selected',cancel:'blocked'},selected:{continue:'resuming',replace:'choosing'},resuming:{finish:'done'},done:{restart:'reading'}};
        const next=paths[stage]?.[action];
        if(!next)return false;
        stage=next;return true;
      },
    };
  }
  function createController({thread,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,mode='supplement'}){
    const model=createModel(mode);
    let active=false,timer=null,generation=0;
    const status=()=>mode==='retry'?({reading:'读取中',retrying:'正在重试 · 第 2 次 / 最多 3 次',verifying:'连接已恢复 · 核对中',paused:'已暂停重试',done:'已完成'})[model.stage]:mode==='failure'?({reading:'检查能力',failed:'暂时无法完成',alternative:'正在整理分镜',done:'替代内容已整理'})[model.stage]:({reading:'读取中',blocked:'等待补充',choosing:'等待补充',selected:'资料已补充',resuming:'核对中',done:'已完成'})[model.stage];
    function body(){
      const stage=model.stage;
      if(mode==='retry'){
        const saved='<p class="recovery-retained"><span aria-hidden="true">✓</span> 已整理供应商名单与风险分类</p>';
        const history='<details class="recovery-history"><summary>查看恢复记录</summary><p>第 1 次读取：服务超时<br>第 2 次读取：连接恢复，继续读取缺失记录</p></details>';
        if(stage==='reading')return '<p>我会对照供应商交付记录，整理风险与应对措施。</p><div class="recovery-tool is-running">读取记录　正在连接供应链资料服务</div>';
        if(stage==='retrying')return `${saved}<p>读取交付记录时服务暂时未响应，正在重试；已整理的内容会保留，无需重新发送要求。</p><div class="recovery-tool is-running">重新连接　正在第 2 次尝试</div><div class="recovery-actions"><button class="recovery-secondary" data-recovery-action="cancel">停止重试</button></div>`;
        if(stage==='paused')return `${saved}<p>已停止重试，交付记录尚未读取。</p><button data-recovery-action="retry">重新尝试</button>`;
        if(stage==='verifying')return `${saved}<p>连接已恢复，接着核对交付记录，只处理刚才未读取的部分。</p>${history}<div class="recovery-tool is-running">核对记录　正在整理风险预案</div>`;
        return `${saved}<p>已完成风险预案整理。重点关注延期交付，提前确认备货与替代供应商。</p>${history}<div class="recovery-result"><span>风险预案 · 示例内容</span><p>交期延误：提前两天核对发货状态<br>供货不足：保留备用供应商与安全库存</p></div><button class="recovery-secondary" data-recovery-action="restart">重播恢复过程</button>`;
      }
      if(mode==='failure'){
        if(stage==='reading')return '<p>我先检查能否把复盘材料生成视频。</p><div class="recovery-tool is-running">检查工具　确认视频生成能力</div>';
        if(stage==='failed')return '<p>当前没有可用的视频生成工具，无法直接交付视频文件。</p><p>可以先把复盘内容整理成分镜和解说稿，供后续制作使用；这不会生成视频。</p><div class="recovery-actions"><button data-recovery-action="fallback">先整理分镜和解说稿</button></div>';
        if(stage==='alternative')return '<p>按你选择的方式，先整理分镜和解说稿。</p><div class="recovery-tool is-running">整理内容　按画面与解说组织复盘材料</div>';
        return '<p>分镜与解说稿已整理，视频文件尚未生成。</p><div class="recovery-result"><span>分镜与解说稿 · 示例内容</span><ol><li>经营概况：展示季度关键指标；解说“先看本季度的经营表现”。</li><li>区域对比：展示各区域差异；解说“关注表现落后的区域与待核实原因”。</li><li>后续行动：展示负责人和时间安排；解说“逐项落实核对与改进计划”。</li></ol></div><button class="recovery-secondary" data-recovery-action="restart">重播处理过程</button>';
      }
      const retained='<p class="recovery-retained"><span aria-hidden="true">✓</span> 已读取推广账单，费用明细与渠道分类已保留</p>';
      if(stage==='reading')return '<p>我先整理各渠道的推广费用，再核对结算口径。</p><div class="recovery-tool is-running">读取文件　正在读取推广账单</div>';
      if(stage==='done')return `${retained}<p>已按补充的结算规则完成核对。示例账单中，服务费单列展示，退款从结算金额中扣除。</p><div class="recovery-result"><span>核对结果 · 示例数据</span><dl><div><dt>推广费用</dt><dd>¥12,000</dd></div><div><dt>退款扣除</dt><dd>−¥800</dd></div><div><dt>应结算</dt><dd>¥11,200</dd></div></dl></div><button class="recovery-secondary" data-recovery-action="restart">重播恢复过程</button>`;
      if(stage==='resuming')return `${retained}<p>已补充结算规则，接着核对退款与服务费，无需重新整理账单。</p><div class="recovery-tool is-running">核对口径　正在处理之前受阻的步骤</div>`;
      return `${retained}<p>账单里没有说明退款和服务费如何结算。缺少结算规则，暂时无法确认最终金额。</p><section class="recovery-request" aria-label="补充结算规则"><strong>需要补充：上月推广结算规则</strong><p>请提供包含退款处理、服务费口径的规则文件。</p>${stage==='selected'?'<div class="recovery-file">▤ 上月推广结算规则.docx <span>资料库示例</span></div><div class="recovery-actions"><button data-recovery-action="continue">继续核对</button><button class="recovery-secondary" data-recovery-action="replace">更换文件</button></div>':'<button data-recovery-action="choose">选择补充文件</button>'}</section>${stage==='choosing'?'<section class="recovery-picker" aria-label="选择示例资料"><div><strong>资料库 · 示例文件</strong><button class="recovery-secondary" data-recovery-action="cancel">取消</button></div><button class="recovery-file-option" data-recovery-action="select"><span>▤ 上月推广结算规则.docx</span><small>包含退款扣除方式与服务费结算说明</small></button></section>':''}`;
    }
    function initial(){return `<section class="recovery-demo" aria-label="任务受阻与恢复演示" data-recovery-mode="${mode}" data-recovery-stage="${model.stage}"><div class="recovery-status" role="status">${status()}</div>${body()}</section>`;}
    function stop(){generation++;if(timer!==null)clearTimer(timer);timer=null;}
    function schedule(){
      stop();
      const token=generation;
      const delays=mode==='retry'?{reading:2200,retrying:3200,verifying:2200}:mode==='failure'?{reading:2200,alternative:2600}:{reading:2200,resuming:2600};
      if(active&&delays[model.stage])timer=setTimer(()=>{if(token!==generation||!active)return;timer=null;act('finish');},delays[model.stage]);
    }
    function render(){
      const panel=thread.querySelector('.recovery-demo');
      if(!panel)return;
      panel.outerHTML=initial();onChange();
    }
    function act(action){if(!active||!model.act(action))return false;render();schedule();return true;}
    function activate(enabled){active=enabled;stop();if(enabled){render();schedule();}}
    thread.addEventListener('click',event=>{
      const button=event.target.closest('[data-recovery-action]');
      if(button&&active)act(button.dataset.recoveryAction);
    });
    return {initial,activate,act,reset(){stop();model.reset();if(active){render();schedule();}},get stage(){return model.stage;}};
  }
  const api={stages,createModel,createController};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CatPawRecoveryDemo=api;
})(typeof window!=='undefined'?window:globalThis);
