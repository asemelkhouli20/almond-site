(() => {
 'use strict';
 const copy=JSON.parse(document.querySelector('#direction-copy').textContent);
 const menu=document.querySelector('#menu'),nav=document.querySelector('#site-nav');
 function close(focus=false){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',copy.menu);if(focus)menu.focus();}
 menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?copy.closeMenu:copy.menu)});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open'))close(true)});
 document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))close()});
 matchMedia('(min-width:801px)').addEventListener('change',e=>{if(e.matches)close()});
 document.querySelectorAll('[data-open-project]').forEach(a=>a.addEventListener('click',()=>{const details=document.querySelector(a.getAttribute('href'));details.open=true;details.querySelector('summary').focus({preventScroll:true})}));
 const form=document.querySelector('#enquiry'),fields=[...form.querySelectorAll('input,textarea')],status=document.querySelector('#form-status');
 function validate(field){const value=field.value.trim();let error='';if(!value)error=copy.required;else if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))error=copy.emailError;else if(field.type==='tel'&&!/^[+()\d\s.-]{7,40}$/.test(value))error=copy.phoneError;else if(field.minLength>0&&value.length<field.minLength)error=copy.short;field.setAttribute('aria-invalid',String(!!error));document.getElementById(field.id+'-error').textContent=error;return !error;}
 fields.forEach(field=>{field.addEventListener('blur',()=>{if(field.value||field.getAttribute('aria-invalid')==='true')validate(field)});field.addEventListener('input',()=>{if(field.getAttribute('aria-invalid')==='true')validate(field)})});
 form.addEventListener('submit',event=>{event.preventDefault();const valid=fields.map(validate).every(Boolean);status.textContent=valid?copy.saved:copy.invalid;status.dataset.state=valid?'preview':'error';if(!valid)fields.find(f=>f.getAttribute('aria-invalid')==='true')?.focus();else status.focus({preventScroll:true});});
 form.querySelector('[type=submit]').disabled=false;
 // Progressive, reversible movement. No invisible initial text or scroll hijacking.
 if(!window.gsap||!window.ScrollTrigger)return;
 gsap.registerPlugin(ScrollTrigger);ScrollTrigger.config({ignoreMobileResize:true});
 const mm=gsap.matchMedia();
 mm.add({desktop:'(min-width:801px)',reduced:'(prefers-reduced-motion:reduce)'},context=>{
  if(context.conditions.reduced)return;
  const desktop=context.conditions.desktop;
  gsap.fromTo('.hero h1',{y:14},{y:0,duration:.85,ease:'power3.out'});
  gsap.fromTo('.hero-picture-frame',{y:20},{y:0,duration:1.1,ease:'power3.out'});
  if(desktop)gsap.fromTo('.hero-picture-frame img',{scale:1.06,yPercent:-1},{scale:1.06,yPercent:1,ease:'none',scrollTrigger:{trigger:'.hero-picture-frame',start:'top bottom',end:'bottom top',scrub:.6}});
  gsap.utils.toArray('.section-head,.project,.contact-intro').forEach(el=>gsap.fromTo(el,{y:desktop?28:10},{y:0,ease:'none',scrollTrigger:{trigger:el,start:'top 96%',end:'top 68%',scrub:.4}}));
 });
 let refreshTimer;
 function refresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>ScrollTrigger.refresh(),100)}
 document.addEventListener('toggle',e=>{if(e.target.matches('.project-details'))refresh()},true);
 document.fonts?.ready.then(refresh);window.addEventListener('load',refresh,{once:true});
})();
