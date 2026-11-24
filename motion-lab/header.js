/* Shared background preference for all Motion Lab pages. */
(() => {
 const root=document.documentElement;
 const picker=document.querySelector('.lab-background-picker');
 if(picker){
  const palette={tulips:null,neutral:'#e9e9e7',blue:'#cddfee',mint:'#d3e4da',pink:'#eed7df',slate:'#555e69'};
  let selected='tulips';
  try{const saved=localStorage.getItem('motion-lab-background');if(Object.hasOwn(palette,saved))selected=saved;}catch{}
  function apply(value){
   root.dataset.labBackground=value;
   root.style.setProperty('--lab-background',palette[value]||'#c6dad4');
   root.style.setProperty('--lab-wallpaper',value==='tulips'?'url("../assets/desktop-tulips.png")':'none');
   document.querySelectorAll('[data-lab-background]').forEach(button=>{
    if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.labBackground===value));
   });
  }
  apply(selected);
  picker.addEventListener('click',event=>{
   const button=event.target.closest('button[data-lab-background]');if(!button)return;
   selected=button.dataset.labBackground;apply(selected);
   try{localStorage.setItem('motion-lab-background',selected);}catch{}
   picker.open=false;picker.querySelector('summary').focus({preventScroll:true});
  });
  document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
  window.addEventListener('storage',event=>{if(event.key==='motion-lab-background'&&Object.hasOwn(palette,event.newValue))apply(event.newValue);});
 }

 const caseGrid=document.querySelector('.comparisons, .task-experiments');
 if(caseGrid){
  const cases=[...caseGrid.children].filter(node=>node.matches('.comparison, .task-case'));
  let activeCase=0;
  const chinese=root.lang.startsWith('zh');
  const displayControls=document.createElement('div');
  displayControls.className='control-group lab-display-controls';
  displayControls.innerHTML='<label>Display <select id="caseDisplay"><option value="single">1 animation</option><option value="all">All 4 animations</option></select></label><div class="lab-case-navigation" role="group" aria-label="Switch animation case"><button type="button" id="previousCase" aria-label="Previous animation">←</button><span id="casePosition" role="status" aria-live="polite"></span><button type="button" id="nextCase" aria-label="Next animation">→</button></div>';
  document.querySelector('.lab-chrome .toolbar').append(displayControls);
  const displaySelect=document.getElementById('caseDisplay');
  displaySelect.querySelector('option[value="all"]').textContent=chinese?`全部 ${cases.length} 个样例`:`All ${cases.length} animations`;
  if(chinese){
   displayControls.querySelector('label').firstChild.textContent='显示方式 ';
   displaySelect.querySelector('option[value="single"]').textContent='单个样例';
   displayControls.querySelector('.lab-case-navigation').setAttribute('aria-label','切换样例');
   document.getElementById('previousCase').setAttribute('aria-label','上一个样例');
   document.getElementById('nextCase').setAttribute('aria-label','下一个样例');
  }
  displaySelect.value='all';
  function showCases(){
   const single=displaySelect.value==='single';
   root.dataset.caseView=single?'single':'all';
   caseGrid.classList.toggle('focused',single);
   cases.forEach((panel,index)=>{panel.hidden=single&&index!==activeCase;});
   displayControls.querySelector('.lab-case-navigation').hidden=!single;
   document.getElementById('casePosition').textContent=`${activeCase+1} / ${cases.length}`;
   window.dispatchEvent(new Event('lab-case-change'));
  }
  displaySelect.addEventListener('change',showCases);
  document.getElementById('previousCase').onclick=()=>{activeCase=(activeCase+cases.length-1)%cases.length;showCases();};
  document.getElementById('nextCase').onclick=()=>{activeCase=(activeCase+1)%cases.length;showCases();};
  showCases();
 }
 const sidebar=document.querySelector('.lab-sidebar');
 let sidebarFocus=null;
 document.addEventListener('keydown',event=>{
  if(!event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||event.repeat||event.isComposing)return;
  if(event.code!=='Backslash'&&event.key!=='\\')return;
  event.preventDefault();
  const hidden=root.classList.toggle('lab-sidebar-hidden');
  sidebar.inert=hidden;
  if(hidden){
   if(picker)picker.open=false;
   if(sidebar.contains(document.activeElement)){
    sidebarFocus=document.activeElement;
    const main=document.querySelector('main');
    if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');
    main.focus({preventScroll:true});
   }
  }else if(sidebarFocus?.isConnected){
   sidebarFocus.focus({preventScroll:true});sidebarFocus=null;
  }
 });

})();
