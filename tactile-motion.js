/* Local pointer feedback. No global cursor, scroll hijacking, or animation loop. */
(() => {
  'use strict';
  if (!window.gsap) return;
  const { gsap } = window;
  let media, entered = false;
  function destroy() { media?.revert(); media = null; }
  function build() {
    destroy();
    media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (entered || window.scrollY > window.innerHeight * .5) return;
      entered = true;
      const content = document.querySelector('.hero-content');
      const mediaFrame = document.querySelector('.hero-media');
      // Text stays fully visible from the first render; only its position settles.
      if(content)gsap.fromTo(content, { y: 18 }, { y: 0, duration: .85, ease: 'power3.out' });
      if(mediaFrame)gsap.fromTo(mediaFrame, { y: 30 }, { y: 0, duration: 1.05, ease: 'power3.out' });
    });
    media.add('(min-width:1101px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion: no-preference)', () => {
      const cleanup = [];
      function track(surface, target, settings) {
        if (!surface || !target) return;
        const motions = Object.entries(settings).map(([key, limit]) => ({
          key, limit, move: gsap.quickTo(target, key, { duration: .5, ease: 'power3.out' })
        }));
        const reset = () => motions.forEach(item => item.move(0));
        const move = event => {
          if (event.pointerType && event.pointerType !== 'mouse') return;
          // Read on movement: correct even while native scrolling changes the bounds.
          const rect = surface.getBoundingClientRect();
          const x = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / Math.max(1, rect.width) - .5));
          const y = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / Math.max(1, rect.height) - .5));
          motions.forEach(item => item.move((item.key === 'y' || item.key === 'rotationX' ? y : x) * item.limit));
        };
        surface.addEventListener('pointermove', move, { passive: true });
        surface.addEventListener('pointerleave', reset);
        surface.addEventListener('pointercancel', reset);
        surface.addEventListener('focusout', reset);
        window.addEventListener('blur', reset);
        cleanup.push(() => {
          surface.removeEventListener('pointermove', move);
          surface.removeEventListener('pointerleave', reset);
          surface.removeEventListener('pointercancel', reset);
          surface.removeEventListener('focusout', reset);
          window.removeEventListener('blur', reset);
          motions.forEach(item => item.move.tween.kill());
        });
      }
      document.querySelectorAll('.btn .action-icon').forEach(arrow => track(arrow.closest('.btn'), arrow, { x: 10, y: 8 }));
      return () => cleanup.forEach(fn => fn());
    });
  }
  document.addEventListener('almond:before-render', destroy);
  document.addEventListener('almond:render', build);
  build();
})();
