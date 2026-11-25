/* Continuous portfolio reading, using the existing content and scene renderers. */
(function(){
  const original=CatPawStrategyJournal.create;
  CatPawStrategyJournal.create=function(options){
    if(!document.documentElement.classList.contains('case-study-view'))return original(options);
    const {stage,canvas,pages,slides,ranges,onChange,onLayout,initialIndex}=options;
    document.body.insertAdjacentHTML('afterbegin','<header class="case-tools"><a href="#evolution">CATPAW / 设计策略</a><a href="./index.html" target="_blank" rel="noopener">打开 Demo ↗</a></header><nav class="case-nav" aria-label="项目章节"></nav>');
    const nav=document.querySelector('.case-nav');
    const entries=[['项目背景',0],['设计总览',slides.findIndex(s=>s.kind==='overview')],...ranges.map((r,i)=>[['发起任务','推进任务','协作迭代'][i],r.start])];
    entries.forEach(([label,index])=>{if(index<0)return;const a=document.createElement('a');a.href='#'+slides[index].no;a.textContent=label;nav.append(a);});
    canvas.querySelector('[data-process-tabs]').setAttribute('aria-orientation','vertical');
    let active=-1,queued=false;
    pages.forEach((page,i)=>{
      page.classList.add('case-section');
      page.querySelectorAll('.design-slot .demo-slot-body iframe[data-src]').forEach(frame=>{
        const src=new URL(frame.dataset.src,document.baseURI);
        src.searchParams.set('slideBackdrop','outer');
        frame.dataset.src=src.href;
      });
      page.dataset.caseIndex=i;
      const alias=document.createElement('span');alias.id=slides[i].no;alias.className='case-anchor';page.prepend(alias);
      if(slides[i].kind==='chapter')page.classList.add('case-chapter');
      const routeMap=page.querySelector('.interruption-route-map');
      if(routeMap){
        const design=page.querySelector('.design-slot');
        const comparison=document.createElement('div');
        comparison.className='interruption-comparison';
        design.before(comparison);
        comparison.append(routeMap,design);
      }
    });
    function createActionRow(items,label){
      const row=document.createElement('div');
      row.className='case-action-row';
      row.tabIndex=0;
      row.setAttribute('role','region');
      row.setAttribute('aria-label',label);
      items[0].before(row);
      row.append(...items);
      row.addEventListener('scroll',scheduleTrack,{passive:true});
      return row;
    }
    function createTitledActionRow(items,label){
      const row=createActionRow(items,label);
      const intro=document.createElement('header');
      intro.className='slide';
      intro.append(items[0].querySelector('.mainline'),items[0].querySelector('h1'));
      row.before(intro);
      items.slice(1).forEach(page=>page.querySelectorAll('.mainline,h1').forEach(node=>node.remove()));
      const copyBlocks=items.map(page=>page.querySelector('.left-content'));
      const alignDemos=new ResizeObserver(()=>{
        const height=Math.max(...copyBlocks.map(block=>block.offsetHeight));
        copyBlocks.forEach(block=>{block.style.marginBottom=(28+height-block.offsetHeight)+'px';});
      });
      copyBlocks.forEach(block=>alignDemos.observe(block));
    }
    createTitledActionRow(pages.filter((_,i)=>slides[i].pointNo==='1.1'),'直观了解功能 · 左右滑动查看任务入口和案例成品');
    const processActions=pages.filter((_,i)=>{
      const slide=slides[i];
      return slide.pointNo==='2.1'&&slide.kind==='action';
    });
    createTitledActionRow(processActions,'清晰掌握进展 · 左右滑动查看工作初始、工作中、后台运行和工作结束');
    const recoveryActions=pages.filter((_,i)=>slides[i].pointNo==='2.3'&&slides[i].kind==='action');
    createActionRow(recoveryActions,'顺畅恢复任务 · 左右滑动查看三个设计动作');

    const interruptionPages=pages.filter(page=>page.classList.contains('interruption-action-slide'));
    const interruptionRow=createActionRow(interruptionPages,'灵活调整方向 · 左右滑动查看三个设计动作');
    interruptionRow.classList.add('case-interruption-row');
    const sharedConcern=interruptionPages[0].querySelector('.user-concern');
    sharedConcern.classList.add('case-interruption-concern');
    sharedConcern.querySelector('p').textContent='“我想随时暂停看看进度再继续，漏了要求也能先记下来，或者让它马上按新要求做。”';
    interruptionRow.before(sharedConcern);
    interruptionPages.forEach(page=>{
      page.querySelectorAll(':scope > .mainline, :scope > h1, .user-concern').forEach(node=>node.remove());
    });
    const greetingPages=pages.filter((_,i)=>slides[i].pointNo==='1.3'&&slides[i].kind==='action');
    const greetingRow=createActionRow(greetingPages,'轻松表达需求 · 左右滑动查看三个设计动作');
    greetingRow.classList.add('case-greeting-row');
    const intro=document.createElement('header');
    intro.className='slide case-greeting-intro';
    const firstGreeting=greetingPages[0];
    intro.append(firstGreeting.querySelector('.mainline'),firstGreeting.querySelector('h1'),firstGreeting.querySelector('.user-concern'));
    intro.querySelector('.user-concern p').textContent=slides[Number(firstGreeting.dataset.caseIndex)].question;
    greetingPages.slice(1).forEach(page=>{
      page.querySelectorAll(':scope > .mainline,:scope > h1,.user-concern').forEach(node=>node.remove());
    });
    greetingRow.before(intro);

    // Keep previews level when either description wraps to another line.
    const descriptions=greetingPages.map(page=>page.querySelector('.action-detail'));
    const resizeDescriptions=new ResizeObserver(()=>{
      const height=Math.max(...descriptions.map(node=>node.getBoundingClientRect().height));
      greetingRow.style.setProperty('--description-height',height+'px');
    });
    descriptions.forEach(node=>resizeDescriptions.observe(node));

    function activate(index){
      if(index===active)return;
      active=index;onChange(index);
      // Every section remains readable and interactive in the continuous document.
      pages.forEach(page=>{page.inert=false;page.classList.remove('preparing');});
      const chapter=index<ranges[ranges.length-1].end&&[...entries].reverse().find(([,start])=>index>=start);
      [...nav.children].forEach(a=>{if(chapter&&a.hash==='#'+slides[chapter[1]].no)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
      pages.slice(Math.max(0,index-1),index+2).forEach(onLayout);
    }
    function seek(index){index=Math.max(0,Math.min(pages.length-1,index));activate(index);pages[index].scrollIntoView({block:'start',inline:'start'});}
    function fit(){pages.forEach(onLayout);}
    function track(){queued=false;const y=window.innerHeight*.35;let index=0;pages.forEach((p,i)=>{const rect=p.getBoundingClientRect();if(rect.top>y)return;const row=p.parentElement;if(row.classList.contains('case-action-row')&&Math.abs(rect.left-row.getBoundingClientRect().left)>(rect.width+24)/2)return;index=i;});activate(index);}
    function scheduleTrack(){if(!queued){queued=true;requestAnimationFrame(track);}}
    window.addEventListener('scroll',scheduleTrack,{passive:true});
    window.addEventListener('resize',fit);
    stage.setAttribute('aria-label','CatPaw 设计作品集');
    activate(initialIndex);requestAnimationFrame(()=>{fit();if(initialIndex)pages[initialIndex].scrollIntoView({block:'start',inline:'start'});});
    return {seek,fit,update:track,step:delta=>seek(active+delta)};
  };
})();
