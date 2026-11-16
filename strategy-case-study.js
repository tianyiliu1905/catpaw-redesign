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
    let active=-1,queued=false;
    pages.forEach((page,i)=>{
      page.classList.add('case-section');
      page.dataset.caseIndex=i;
      const alias=document.createElement('span');alias.id=slides[i].no;alias.className='case-anchor';page.prepend(alias);
      if(slides[i].kind==='chapter')page.classList.add('case-chapter');
      page.querySelectorAll('.design-slot[data-design-slot]').forEach(figure=>{
        if(figure.querySelector('iframe')&&!page.querySelector('.slide-demo-jump')){
          const link=document.createElement('a');link.className='slide-demo-jump';link.href='./index.html?strategyScene='+encodeURIComponent(slides[i].no);link.target='_blank';link.rel='noopener';link.textContent='打开完整 Demo ↗';figure.after(link);
        }
      });
    });
    function activate(index){
      if(index===active)return;
      active=index;onChange(index);
      // Every section remains readable and interactive in the continuous document.
      pages.forEach(page=>{page.inert=false;page.classList.remove('preparing');});
      const chapter=[...entries].reverse().find(([,start])=>index>=start);
      [...nav.children].forEach(a=>{if(chapter&&a.hash==='#'+slides[chapter[1]].no)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
      pages.slice(Math.max(0,index-1),index+2).forEach(onLayout);
    }
    function seek(index){index=Math.max(0,Math.min(pages.length-1,index));activate(index);pages[index].scrollIntoView({block:'start'});}
    function fit(){pages.forEach(onLayout);}
    function track(){queued=false;const y=window.innerHeight*.35;let index=0;pages.forEach((p,i)=>{if(p.getBoundingClientRect().top<=y)index=i;});activate(index);}
    window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(track);}},{passive:true});
    window.addEventListener('resize',fit);
    stage.setAttribute('aria-label','CatPaw 设计作品集');
    activate(initialIndex);requestAnimationFrame(()=>{fit();if(initialIndex)pages[initialIndex].scrollIntoView();});
    return {seek,fit,update:track,step:delta=>seek(active+delta)};
  };
})();
