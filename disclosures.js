/* Native details remain usable without this enhancement or Web Animations. */
(()=>{
'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let running=0,previousAnchor='';
function lock(){if(running++===0){previousAnchor=document.documentElement.style.overflowAnchor;document.documentElement.style.overflowAnchor='none'}}
function unlock(){if(--running===0)document.documentElement.style.overflowAnchor=previousAnchor}
document.querySelectorAll('.service-list details,.faq details,.person details').forEach(details=>{
 const summary=details.querySelector('summary');
 let animation=null,wanted=details.open;
 function settle(){
  const old=animation;animation=null;if(old){old.onfinish=null;old.cancel();unlock()}
  details.open=wanted;details.style.height='';details.classList.remove('is-animating');
  summary.setAttribute('aria-expanded',String(wanted));
  document.dispatchEvent(new Event('almond:layout'));
 }
 summary.setAttribute('aria-expanded',String(!!details.open));
 summary.addEventListener('click',event=>{
  if(event.target.closest('a,button,input'))return;
  if(reduced.matches||typeof details.animate!=='function')return;
  event.preventDefault();
  const start=details.getBoundingClientRect().height;
  wanted=animation?!wanted:!details.open;
  if(animation){animation.onfinish=null;animation.cancel();animation=null;unlock()}
  lock();details.classList.add('is-animating');
  details.style.height='';details.open=wanted;
  const end=details.getBoundingClientRect().height;
  details.open=true;details.style.height=start+'px';
  summary.setAttribute('aria-expanded',String(wanted));
  animation=details.animate([{height:start+'px'},{height:end+'px'}],{duration:280,easing:'cubic-bezier(.22,.68,.3,1)',fill:'forwards'});
  animation.onfinish=settle;
 });
 details.addEventListener('toggle',()=>{if(!animation){wanted=details.open;summary.setAttribute('aria-expanded',String(!!wanted))}});
 reduced.addEventListener('change',()=>{if(animation&&reduced.matches)settle()});
 window.addEventListener('resize',()=>{if(animation)settle()},{passive:true});
});
})();
