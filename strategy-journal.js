(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  // Static diagrams share the same absolute layout as embedded Demos.
  const demoSelector='.design-slot, .phase-demo-grid, .process-pair';
  function matchingDemos(outgoing,incoming){
    const before=[...outgoing.querySelectorAll(demoSelector)];
    const after=[...incoming.querySelectorAll(demoSelector)];
    if(!before.length||before.length!==after.length)return [];
    const pairs=before.map((element,i)=>[element,after[i]]);
    return pairs.every(([a,b])=>{
      const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
      return x.width>0&&x.height>0&&['left','top','width','height'].every(key=>Math.abs(x[key]-y[key])<2);
    })?pairs:[];
  }
  function textBranches(page,demos){
    const branches=[];
    function walk(parent){
      [...parent.children].forEach(child=>{
        if(demos.includes(child))return;
        if(demos.some(demo=>child.contains(demo)))walk(child);
        else branches.push(child);
      });
    }
    walk(page);return branches;
  }
  function stationaryHeadings(page){
    return [...page.children].filter(node=>node.matches('.topline, .mainline, .story-kicker, h1'));
  }
  function create({stage,canvas,pages,slides,ranges,pointGroups=[],initialIndex=0,onChange,onLayout}){
    const doc=stage.ownerDocument,win=doc.defaultView;
    const reduce=win.matchMedia('(prefers-reduced-motion: reduce)');
    const labels=['发起任务','推进任务','协作迭代'];
    let current=-1,resizeFrame=0,animations=[],transitionTimer=0,transitioning=false;
    let wheelAmount=0,wheelLatched=false,wheelTimer=0,touchStart=null;
    const panels=pages.map(page=>{
      const panel=doc.createElement('div');panel.className='journal-panel';
      panel.hidden=true;page.before(panel);panel.append(page);return panel;
    });
    const header=doc.createElement('header');header.className='journal-header';
    const brand=doc.createElement('button');brand.type='button';brand.className='journal-brand';brand.textContent='CATPAW / 设计策略';brand.setAttribute('aria-label','回到项目开篇');header.append(brand);
    const navigation=doc.createElement('div');navigation.className='journal-navigation';header.append(navigation);
    const nav=doc.createElement('nav');nav.className='journal-chapters';nav.setAttribute('aria-label','设计策略章节');navigation.append(nav);
    const chapterButtons=labels.map((label,i)=>{
      const button=doc.createElement('button');button.type='button';button.className='journal-chapter';button.textContent=label;button.addEventListener('click',()=>seek(ranges[i].start));nav.append(button);return button;
    });
    const pointNav=doc.createElement('nav');pointNav.className='journal-points';pointNav.setAttribute('aria-label','各策略要点');navigation.append(pointNav);
    const pointColumns=pointGroups.map((points,chapter)=>{
      const group=doc.createElement('div');group.className='journal-point-group';group.setAttribute('aria-label',labels[chapter]);pointNav.append(group);
      const buttons=points.map(point=>{
        const button=doc.createElement('button');button.type='button';button.className='journal-point';button.textContent=point.label;
        button.addEventListener('click',()=>seek(point.start));group.append(button);
        return {button,chapter,...point};
      });
      return {group,buttons};
    });
    const pointButtons=pointColumns.flatMap(column=>column.buttons);
    const footer=doc.createElement('footer');footer.className='journal-footer';
    const meter=doc.createElement('div');meter.className='journal-meter';meter.innerHTML='<span></span>';meter.setAttribute('aria-hidden','true');footer.append(meter);
    const indexLabel=doc.createElement('label');indexLabel.className='journal-index';
    const count=doc.createElement('span');count.className='journal-count';indexLabel.append(count);
    const select=doc.createElement('select');select.setAttribute('aria-label','跳转到设计内容');
    slides.forEach((slide,i)=>{
      const option=doc.createElement('option');option.value=String(i);
      option.textContent=slide.supplementary ? pages[i].querySelector('h1').textContent : slide.kind==='action'?`${slide.pointNo} · ${slide.action[0]}`:(slide.title||pages[i].getAttribute('aria-label')||slide.no);
      select.append(option);
    });
    indexLabel.append(select);footer.append(indexLabel);
    const hint=doc.createElement('span');hint.className='journal-hint';hint.textContent='左右 / 上下滑动翻页　→';footer.append(hint);
    stage.before(header);stage.after(footer);
    stage.setAttribute('aria-label','CatPaw 设计策略 · 滑动翻页');stage.tabIndex=0;
    const regularIndices = slides.map((slide, index) => slide.supplementary ? -1 : index).filter(index => index >= 0);
    const researchIndices = slides.map((slide, index) => slide.supplementary ? index : -1).filter(index => index >= 0);
    function step(direction) {
      const route = slides[current]?.supplementary ? researchIndices : regularIndices;
      const position = route.indexOf(current) + direction;
      if (slides[current]?.supplementary && (position < 0 || position >= route.length)) {
        seek(slides.findIndex(slide => slide.no === (direction < 0 ? '2.4' : '2.4-cases')));
        return;
      }
      seek(route[clamp(position, 0, route.length - 1)]);
    }
    function update(){
      if(current<0)return;
      const route = slides[current].supplementary ? researchIndices : regularIndices;
      for (const option of select.options) option.hidden = !route.includes(Number(option.value));
      select.value=String(current);count.textContent=`${slides[current].supplementary ? '补充研究 ' : ''}${String(route.indexOf(current)+1).padStart(2,'0')} / ${route.length}`;
      footer.style.setProperty('--reading-progress',(route.indexOf(current)+1)/route.length);
      const chapter=ranges.findIndex(range=>current>=range.start&&current<range.end);
      pointNav.hidden=chapter<0||!pointButtons.length;
      pointColumns.forEach(({group},i)=>group.setAttribute('data-current',String(i===chapter)));
      pointButtons.forEach(({button,chapter:group,start,end})=>{
        button.hidden=false;
        if(group===chapter&&current>=start&&current<end)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      });
      chapterButtons.forEach((button,i)=>{
        const {start,end}=ranges[i];
        button.style.setProperty('--chapter-progress',clamp((current-start+1)/(end-start),0,1));
        if(current>=start&&current<end)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      });
    }
    function finishTransition(){
      win.clearTimeout(transitionTimer);animations.forEach(animation=>animation.cancel());animations=[];transitioning=false;
      panels.forEach((panel,i)=>{panel.hidden=i!==current;});
      if(current>=0)onLayout(pages[current]);
    }
    function fit(){
      finishTransition();
      const gutter=stage.clientWidth<760?12:32;
      const scale=Math.max(.1,Math.min((stage.clientWidth-gutter*2)/1280,(stage.clientHeight-12)/720));
      canvas.style.setProperty('--journal-scale',scale);
      canvas.style.setProperty('--journal-width',`${1280*scale}px`);
      canvas.style.setProperty('--journal-height',`${720*scale}px`);
      // Use one compact left gutter for the slide content and fixed chrome.
      const contentInset=(stage.clientWidth-1280*scale)/2+48*scale;
      const contentLeft=Math.max(16,contentInset/2);
      canvas.style.setProperty('--journal-panel-left',`${contentLeft-48*scale}px`);
      canvas.style.setProperty('--journal-extra-right',`${Math.max(0,(stage.clientWidth-2*contentLeft)/scale-1232)}px`);
      canvas.style.setProperty('--journal-panel-width',`${stage.clientWidth-2*contentLeft+48*scale}px`);
      header.style.setProperty('--journal-content-left',`${contentLeft}px`);
      footer.style.setProperty('--journal-content-left',`${contentLeft}px`);
      header.style.setProperty('--journal-content-inset',`${contentLeft}px`);
      footer.style.setProperty('--journal-content-inset',`${contentLeft}px`);
      if(current<0)seek(initialIndex,{instant:true});
      else onLayout(pages[current]);
    }
    function seek(index,{instant=false}={}){
      index=clamp(index,0,pages.length-1);
      if(index===current)return;
      const previous=current;
      finishTransition();current=index;
      panels[index].hidden=false;onLayout(pages[index]);onChange(index);update();
      // Only two panels participate in a turn. Other sections stay hidden.
      const incoming=panels[index],outgoing=panels[previous];
      if(previous<0||instant||reduce.matches||Math.abs(index-previous)>1||!incoming.animate){finishTransition();return;}
      transitioning=true;outgoing.hidden=false;
      const direction=index>previous?1:-1,distance=stage.clientWidth;
      const options={duration:480,easing:'cubic-bezier(.22,.75,.22,1)',fill:'both'};
      const textFade={duration:820,easing:'ease-in-out',fill:'both'};
      const demoPairs=matchingDemos(pages[previous],pages[index]);
      const oldDemos=[...pages[previous].querySelectorAll(demoSelector)];
      const newDemos=[...pages[index].querySelectorAll(demoSelector)];
      const oldHeadings=stationaryHeadings(pages[previous]),newHeadings=stationaryHeadings(pages[index]);
      if(oldDemos.length||newDemos.length||oldHeadings.length||newHeadings.length){
        // Never transform a Demo ancestor: it would become a new containing block
        // for absolute-positioned frames, changing their bounds during fitting.
        // Move mismatched Demos themselves; matching Demos only crossfade.
        // Keep real iframes mounted so their scenes do not reload.
        const scale=parseFloat(canvas.style.getPropertyValue('--journal-scale'))||1;
        const move=distance/scale;
        animations=[
          // Headings switch in place; identical titles remain visually continuous.
          ...oldHeadings.map(node=>node.animate([{opacity:0},{opacity:0}],textFade)),
          ...textBranches(pages[previous],[...oldHeadings,...oldDemos]).map(node=>node.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-direction*move}px)`,opacity:0}],options)),
          ...textBranches(pages[index],[...newHeadings,...newDemos]).flatMap(node=>[
            node.animate([{transform:`translateX(${direction*move}px)`},{transform:'translateX(0)'}],options),
            node.animate([{opacity:0},{opacity:1}],textFade)
          ]),
          ...oldDemos.map(node=>node.animate(demoPairs.length
            ?[{opacity:1},{opacity:0}]
            :[{transform:'translateX(0)',opacity:1},{transform:`translateX(${-direction*move}px)`,opacity:0}],options)),
          ...newDemos.map(node=>node.animate(demoPairs.length
            ?[{opacity:0},{opacity:1}]
            :[{transform:`translateX(${direction*move}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],options))
        ];
      }else{
        animations=[
          outgoing.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${-direction*distance}px)`,opacity:0}],options),
          incoming.animate([{transform:`translateX(${direction*distance}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],options),
          ...textBranches(pages[index],[...pages[index].querySelectorAll(demoSelector)]).map(node=>node.animate([{opacity:0},{opacity:1}],textFade))
        ];
      }
      transitionTimer=win.setTimeout(finishTransition,textFade.duration);
    }
    stage.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.target.closest('.wvc-deck-panel,select,input,textarea,[contenteditable=true]'))return;
      event.preventDefault();
      win.clearTimeout(wheelTimer);
      wheelTimer=win.setTimeout(()=>{wheelAmount=0;wheelLatched=false;},200);
      // Consume the entire trackpad momentum tail as one gesture.
      if(wheelLatched||transitioning)return;
      const delta=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1);
      if(Math.sign(delta)!==Math.sign(wheelAmount))wheelAmount=0;
      wheelAmount+=delta;
      if(Math.abs(wheelAmount)>=45){wheelLatched=true;step(Math.sign(wheelAmount));}
    },{passive:false});
    stage.addEventListener('touchstart',event=>{
      touchStart=event.touches.length===1&&!event.target.closest('.wvc-deck-panel,select,input,textarea,button,a,[contenteditable=true]')?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
    },{passive:true});
    stage.addEventListener('touchmove',event=>{if(touchStart&&event.touches.length===1)event.preventDefault();else touchStart=null;},{passive:false});
    stage.addEventListener('touchend',event=>{
      if(!touchStart||transitioning){touchStart=null;return;}
      const touch=event.changedTouches[0];
      if(touch){const dx=touchStart.x-touch.clientX,dy=touchStart.y-touch.clientY,delta=Math.abs(dx)>Math.abs(dy)?dx:dy;if(Math.abs(delta)>=45)step(Math.sign(delta));}
      touchStart=null;
    });
    stage.addEventListener('touchcancel',()=>{touchStart=null;});
    brand.addEventListener('click',()=>seek(0));select.addEventListener('change',()=>seek(Number(select.value)));
    win.addEventListener('resize',()=>{win.cancelAnimationFrame(resizeFrame);resizeFrame=win.requestAnimationFrame(fit);});
    return {fit,seek,step,update};
  }
  const api={create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CatPawStrategyJournal=api;
})(globalThis);
