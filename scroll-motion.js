/* Reversible, scoped motion. Native scrolling and readable HTML are the baseline. */
(() => {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize:true });
  let media, timer, needsRefresh=false;
  function flush(){if(needsRefresh){needsRefresh=false;ScrollTrigger.refresh(true)}}
  function refresh(){needsRefresh=true;clearTimeout(timer);timer=setTimeout(()=>{if(!ScrollTrigger.isScrolling())flush()},100)}
  ScrollTrigger.addEventListener('scrollEnd',flush);
  function destroy(){clearTimeout(timer);media?.revert();media=null}
  function build(){
    destroy();
    media=gsap.matchMedia();
    media.add({desktop:'(min-width:1001px)',mobile:'(max-width:1000px)',reduced:'(prefers-reduced-motion:reduce)'},context=>{
      if(context.conditions.reduced)return;
      const desktop=context.conditions.desktop,rtl=document.documentElement.dir==='rtl';
      const created=[],headings=[];
      let teamContext;
      document.documentElement.classList.add('scroll-motion');
      const trigger=(element,start='top 94%',end='top 64%')=>({trigger:element,start,end,scrub:desktop ? 0.45 : 0.18,invalidateOnRefresh:true});
      function reveal(targets,distance=24,anchor){
        gsap.utils.toArray(targets).filter(Boolean).forEach(element=>gsap.fromTo(element,
          {y:desktop?distance:Math.min(8,distance*.4),opacity:1},{y:0,opacity:1,ease:'none',scrollTrigger:trigger(anchor||element)}));
      }
      // Whole phrases preserve Arabic letter shaping and natural wrapping.
      gsap.utils.toArray('main h2').forEach(heading=>{
        if(heading.closest('.clients-band,#approach,.service-intro,.faq-intro'))return;
        headings.push([heading,heading.innerHTML]);
        const fragments=[];
        let line=document.createElement('span');line.className='motion-line';
        [...heading.childNodes].forEach(node=>{
          if(node.nodeName==='BR'){fragments.push(line);line=document.createElement('span');line.className='motion-line'}
          else line.appendChild(node);
        });
        fragments.push(line);heading.replaceChildren(...fragments);
        gsap.fromTo(fragments,{yPercent:desktop?16:8,opacity:1},{yPercent:0,opacity:1,stagger:.12,ease:'none',scrollTrigger:trigger(heading,'top 94%','top 60%')});
      });
      function photo(frame,mask=false){
        if(!frame)return;const image=frame.querySelector('img,video');if(!image)return;
        if(desktop&&!frame.matches('.work-image'))gsap.fromTo(image,{scale:1.11,yPercent:-2},{scale:1.04,yPercent:2,ease:'none',scrollTrigger:trigger(frame,'top bottom','bottom top')});
        if(mask&&desktop){
          const curtain=document.createElement('span');curtain.className='motion-curtain';curtain.setAttribute('aria-hidden','true');frame.appendChild(curtain);created.push(curtain);
          gsap.fromTo(curtain,{scaleX:1,transformOrigin:rtl?'left center':'right center'},{scaleX:0,ease:'none',scrollTrigger:trigger(frame,'top 96%','top 62%')});
        }
      }
      function turn(selector,from,to){const element=document.querySelector(selector);if(element)gsap.fromTo(element,{rotation:from},{rotation:to,ease:'none',scrollTrigger:trigger(element.parentElement,'top bottom','bottom top')})}
      // The hero text remains readable; only the video gently follows departure.
      const hero=document.querySelector('.hero'),video=document.querySelector('.hero-video');
      if(video&&desktop)gsap.fromTo(video,{scale:1.02,yPercent:0},{scale:1.06,yPercent:1,ease:'none',scrollTrigger:trigger(hero,'top top','bottom top')});
      const signoff=document.querySelector('.footer-signature span');
      if(signoff)gsap.fromTo(signoff,{yPercent:32},{yPercent:0,ease:'none',scrollTrigger:trigger(signoff.parentElement,'top 98%','bottom 95%')});
      reveal('.clients-heading,.section-index',18);
      reveal('.about-body > p,.value-strip > div');
      reveal('.section-heading:not(#approach .section-heading) .eyebrow,.section-heading:not(#approach .section-heading) > p',20);
      gsap.utils.toArray('.section-heading').forEach(heading=>{
        if(heading.closest('#approach'))return;
        const rule=document.createElement('span');rule.className='section-rule';rule.setAttribute('aria-hidden','true');heading.appendChild(rule);created.push(rule);
        gsap.fromTo(rule,{scaleX:0},{scaleX:1,ease:'none',scrollTrigger:trigger(heading,'top 92%','bottom 65%')});
      });
      gsap.utils.toArray('.work-card').forEach(card=>{
        photo(card.querySelector('.work-image'),false);
        reveal(card,desktop?32:16);
      });
      // Sticky copy keeps a stable frame; only the service list follows the viewport.
      reveal('.service-intro > .eyebrow,.service-intro > p:not(.eyebrow)',20,document.querySelector('#services'));
      // Accordion controls stay still while users interact with them.
      gsap.utils.toArray('.impact-card').forEach(card=>{photo(card.querySelector('figure'));reveal(card.querySelector(':scope > div'))});
      gsap.utils.toArray('.editorial-photo,.content-photo,.service-image').forEach(frame=>{if(!frame.closest('#top'))photo(frame)});
      reveal('.domain-card',28);
      reveal('.editorial-card,.growth-list li,.content-section .section-conclusion',18);
      reveal('.solutions-intro > .eyebrow',18);
      photo(document.querySelector('.partnership figure'),true);
      reveal('.partnership-copy > .eyebrow,.partnership-copy > p:not(.eyebrow),.partnership-copy > ul,.partnership-copy > a',22);
      reveal('.team-toolbar',20);
      function clearTeam(){teamContext?.revert();teamContext=null}
      function buildTeam(){clearTeam();teamContext=gsap.context(()=>reveal('.team-card',26));refresh()}
      document.addEventListener('almond:team-before-render',clearTeam);
      document.addEventListener('almond:team-render',buildTeam);buildTeam();
      // FAQ, tabs and their changing content stay at full contrast and stationary.
      reveal('.contact-top,.contact-intro > p',22);
      // Inputs stay stationary for focus, validation and typing.
      turn('.contact-mark',-12,18);reveal('.footer-top > p',16);
      const progress=document.createElement('div');progress.className='reading-progress';progress.setAttribute('aria-hidden','true');document.body.appendChild(progress);created.push(progress);
      gsap.fromTo(progress,{scaleX:0},{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:true}});refresh();
      return()=>{clearTeam();document.removeEventListener('almond:team-before-render',clearTeam);document.removeEventListener('almond:team-render',buildTeam);created.forEach(element=>element.remove());headings.forEach(([heading,html])=>{heading.innerHTML=html});document.documentElement.classList.remove('scroll-motion')};
    });
  }
  document.addEventListener('almond:before-render',destroy);document.addEventListener('almond:render',build);
  document.addEventListener('almond:layout',refresh);document.addEventListener('almond:audience-render',refresh);
  document.addEventListener('toggle',event=>{if(event.target.matches?.('.service-list details,.faq-list details'))refresh()},true);
  document.addEventListener('load',event=>{if(event.target.matches?.('main img'))refresh()},true);
  document.addEventListener('error',event=>{if(event.target.matches?.('main img'))refresh()},true);
  if('ResizeObserver' in window)new ResizeObserver(refresh).observe(document.querySelector('main'));
  document.fonts?.ready.then(refresh);window.addEventListener('pageshow',refresh);build();
})();
