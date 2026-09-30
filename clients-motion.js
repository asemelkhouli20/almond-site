/* Time-driven, seamless logo loops. Scroll only controls visibility, never position. */
(() => {
  'use strict';
  if (!window.gsap) return;
  const { gsap } = window;
  let media;
  function destroy() { media?.revert(); media = null; }
  function build() {
    destroy();
    const section = document.querySelector('.clients-band');
    if (!section) return;
    const lanes = [...section.querySelectorAll('.client-lane')];
    const ar = document.documentElement.lang === 'ar';
    lanes.forEach((lane, i) => lane.setAttribute('aria-label',
      ar ? 'شعارات العملاء، الصف ' + (i + 1) : 'Client logos, row ' + (i + 1)));
    media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let visible = false, hovered = false, focused = false, paused = false;
      const records = [];
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'clients-motion-toggle';
      function label() {
        button.textContent = paused ? (ar ? 'تشغيل الحركة' : 'Play motion') : (ar ? 'إيقاف الحركة' : 'Pause motion');
        button.setAttribute('aria-pressed', String(paused));
      }
      function sync() {
        const running = visible && !document.hidden && !hovered && !focused && !paused;
        records.forEach(({ tween }) => running ? tween.play() : tween.pause());
      }
      label(); section.querySelector('.clients-heading').append(button);
      section.classList.add('clients-looping');
      lanes.forEach((lane, i) => {
        const track = lane.querySelector('.client-track');
        const set = track.querySelector('.client-set');
        const clone = set.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true'); clone.setAttribute('inert', '');
        clone.querySelectorAll('img').forEach(img => { img.alt = ''; });
        track.append(clone);
        const reverse = (i === 1) !== (document.documentElement.dir === 'rtl');
        const distance = () => set.getBoundingClientRect().width;
        const tween = gsap.fromTo(track, { x: () => reverse ? -distance() : 0 }, {
          x: () => reverse ? 0 : -distance(), duration: Math.max(1, distance() / 32),
          repeat: -1, ease: 'none', paused: true
        });
        records.push({ lane, track, set, clone, tween, width: distance() });
      });
      const onEnter = () => { hovered = true; sync(); };
      const onLeave = () => { hovered = false; sync(); };
      const onFocus = () => { focused = true; sync(); };
      const onBlur = event => { focused = section.contains(event.relatedTarget); sync(); };
      const toggle = () => { paused = !paused; label(); sync(); };
      section.addEventListener('mouseenter', onEnter);
      section.addEventListener('mouseleave', onLeave);
      section.addEventListener('focusin', onFocus);
      section.addEventListener('focusout', onBlur);
      button.addEventListener('click', toggle);
      document.addEventListener('visibilitychange', sync);
      const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting; sync();
      }) : null;
      if (observer) observer.observe(section); else { visible = true; sync(); }
      const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
        records.forEach(record => {
          const width = record.set.getBoundingClientRect().width;
          if (Math.abs(width - record.width) < 1) return;
          const progress = record.tween.progress();
          record.width = width;
          record.tween.invalidate().duration(Math.max(1, width / 32)).progress(progress);
        });
        sync();
      }) : null;
      records.forEach(record => resize?.observe(record.set));
      return () => {
        observer?.disconnect(); resize?.disconnect();
        section.removeEventListener('mouseenter', onEnter);
        section.removeEventListener('mouseleave', onLeave);
        section.removeEventListener('focusin', onFocus);
        section.removeEventListener('focusout', onBlur);
        document.removeEventListener('visibilitychange', sync);
        button.removeEventListener('click', toggle); button.remove();
        records.forEach(({ tween, clone, track, lane }) => {
          tween.revert(); clone.remove(); track.style.removeProperty('transform'); lane.scrollLeft = 0;
        });
        section.classList.remove('clients-looping');
      };
    });
  }
  document.addEventListener('almond:before-render', destroy);
  document.addEventListener('almond:render', build);
  build();
})();
