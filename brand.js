(()=>{
'use strict';
const copy=JSON.parse(document.querySelector('#ui-copy').textContent);
const nav=document.querySelector('#main-nav'),menu=document.querySelector('#menu-toggle');
function close(focus=false){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',copy.menu);if(focus)menu.focus()}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?copy.close:copy.menu)});
nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open'))close(true)});
document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))close()});
matchMedia('(min-width:851px)').addEventListener('change',e=>{if(e.matches)close()});
document.querySelectorAll('.motion-toggle').forEach(button=>button.addEventListener('click',()=>{const paused=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?copy.resume:copy.pause);button.closest('.client-band').classList.toggle('paused',paused)}));
const filters=[...document.querySelectorAll('[data-filter]')],cases=[...document.querySelectorAll('.case-study')];
function filter(value){filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===value)));let count=0;cases.forEach(c=>{c.hidden=value!=='all'&&c.dataset.sector!==value;if(!c.hidden)count++});const status=document.querySelector('.filter-status');if(status)status.textContent=count+' '+copy.results;window.ScrollTrigger?.refresh()}
filters.forEach(b=>b.addEventListener('click',()=>filter(b.dataset.filter)));
function openHash(){const id=decodeURIComponent(location.hash.slice(1));if(!id)return;const el=document.getElementById(id);if(el?.matches('.service-list details'))el.open=true;if(el?.matches('.case-study'))filter('all')}
openHash();window.addEventListener('hashchange',openHash);
const tracks=[...document.querySelectorAll('.logo-track')];
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('offscreen',!entry.isIntersecting)));tracks.forEach(track=>observer.observe(track));}
document.addEventListener('visibilitychange',()=>tracks.forEach(track=>{track.style.animationPlayState=document.hidden?'paused':''}));
if(!window.gsap||!window.ScrollTrigger)return;
gsap.registerPlugin(ScrollTrigger);ScrollTrigger.config({ignoreMobileResize:true});
const mm=gsap.matchMedia();
mm.add({desktop:'(min-width:851px)',mobile:'(max-width:850px)',reduce:'(prefers-reduced-motion:reduce)'},({conditions})=>{
 if(conditions.reduce)return;
 gsap.from('.hero-content>*,.inner-hero .eyebrow,.inner-hero h1',{y:22,duration:1,stagger:.1,ease:'power3.out',clearProps:'transform'});
 gsap.utils.toArray('.section-heading,.intro-text,.project-card,.why-items>div,.sector,.person,.portfolio-item,.work-moments figure,.scene-grid figure,.about-answers>div,.feature-copy').forEach(el=>{
  gsap.fromTo(el,{y:conditions.desktop?32:16},{y:0,ease:'none',scrollTrigger:{trigger:el,start:'top 96%',end:'top 72%',scrub:.5}});
 });
 // Image motion stays inside its frame and starts only as that frame enters view.
 gsap.utils.toArray('.feature-layout figure>div,.intro-photo picture,.purpose-layout figure,.about-photo picture,.service-photo>picture').forEach(frame=>{
  const photo=frame.querySelector('img');if(!photo)return;
  gsap.fromTo(photo,{scale:1.045},{scale:1,ease:'none',scrollTrigger:{trigger:frame,start:'top 95%',end:'bottom 35%',scrub:.6}});
 });
 gsap.utils.toArray('.capability-grid').forEach(grid=>gsap.from(grid.children,{y:24,opacity:0,duration:.65,stagger:.09,ease:'power2.out',clearProps:'transform,opacity',scrollTrigger:{trigger:grid,start:'top 88%',once:true}}));
 const signature=document.querySelector('.footer-signature');
 if(signature){
  gsap.fromTo(signature.querySelector('.diamond-mark'),{rotation:-12,y:18},{rotation:0,y:0,ease:'none',scrollTrigger:{trigger:signature,start:'top bottom',end:'bottom 82%',scrub:.5}});
  gsap.fromTo('.signature-line',{scaleX:.35},{scaleX:1,ease:'none',scrollTrigger:{trigger:signature,start:'top bottom',end:'bottom 82%',scrub:.5}});
 }

});
let timer;function refresh(){clearTimeout(timer);timer=setTimeout(()=>ScrollTrigger.refresh(),120)}
document.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&!e.target.classList.contains('is-animating'))refresh()},true);
document.addEventListener('almond:layout',refresh);document.fonts?.ready.then(refresh);window.addEventListener('load',refresh,{once:true});
})();
