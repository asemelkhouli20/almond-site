/* Content is rendered in HTML for every locale and route. Enhance navigation only. */
(() => {
  'use strict';
  const button=document.querySelector('#menu'),nav=document.querySelector('#navigation');
  if(!button||!nav)return;
  const ar=document.documentElement.lang==='ar';
  function close(focus=false){nav.classList.remove('open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',ar?'فتح القائمة':'Open navigation');if(focus)button.focus();}
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',ar?(open?'إغلاق القائمة':'فتح القائمة'):(open?'Close navigation':'Open navigation'));nav.classList.toggle('open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>close()));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&button.getAttribute('aria-expanded')==='true')close(true);});
  document.addEventListener('click',e=>{if(!e.target.closest('.header'))close();});
  window.matchMedia?.('(min-width:1201px)').addEventListener('change',()=>close());
})();
