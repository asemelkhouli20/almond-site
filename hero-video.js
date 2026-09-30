/* Silent licensed stock footage, loaded only when visible and appropriate to play. */
(() => {
  'use strict';
  const video = document.querySelector('#heroVideo');
  const button = document.querySelector('.hero-video-toggle');
  if (!video || !button) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let visible = false;
  let userPaused = false;
  let explicitPlayback = false;
  let loaded = false;
  let failed = false;
  let ready = document.readyState === 'complete';
  let playPending = false;
  video.muted = true;
  function label() {
    const ar = document.documentElement.lang === 'ar';
    const playing = !video.paused;
    button.setAttribute('aria-label', playing ? (ar ? 'إيقاف الفيديو مؤقتاً' : 'Pause video') : (ar ? 'تشغيل الفيديو' : 'Play video'));
    button.classList.toggle('is-playing',playing);
    video.setAttribute('aria-label', ar ? 'مشاهد توضيحية حقيقية لمتطوع يغرس شجرة' : 'Stock footage of a volunteer planting a tree');
  }
  function load() {
    if (loaded) return;
    const source = video.querySelector('source');
    source.src = window.innerWidth <= 700 ? source.dataset.mobileSrc : source.dataset.src;
    loaded = true;
    video.load();
  }
  function sync() {
    const automatic = ready && !reduced.matches && !connection?.saveData && !/^(slow-)?2g$/.test(connection?.effectiveType || '');
    if (failed || !visible || document.hidden || userPaused || !(automatic || explicitPlayback)) {
      video.pause();
      return;
    }
    load();
    if (playPending || !video.paused) return;
    playPending = true;
    const attempt = video.play();
    if (attempt) attempt.then(() => {
      if (!visible || document.hidden || userPaused) video.pause();
    }).catch(() => { label(); }).finally(() => { playPending = false; });
    else playPending = false;
  }
  button.addEventListener('click', () => {
    if (video.paused) { userPaused = false; explicitPlayback = true; sync(); }
    else { userPaused = true; video.pause(); }
  });
  video.addEventListener('play', label);
  video.addEventListener('pause', label);
  function fallback() {
    failed = true; button.hidden = true; video.hidden = true;
    const frame = video.closest('.hero-visual');
    frame.style.backgroundImage = 'url("' + video.poster + '")';
    frame.style.backgroundSize = 'cover'; frame.style.backgroundPosition = 'center';
  }
  video.addEventListener('error', fallback);
  video.querySelector('source').addEventListener('error', fallback);
  document.addEventListener('almond:render', label);
  document.addEventListener('visibilitychange', sync);
  connection?.addEventListener?.('change', sync);
  function enableAutomatic() {
    const enable = () => { ready = true; sync(); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(enable, {timeout:1500});
    else setTimeout(enable, 150);
  }
  if (ready) enableAutomatic(); else window.addEventListener('load', enableAutomatic, {once:true});
  reduced.addEventListener('change', () => { explicitPlayback = false; sync(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.1 });
    observer.observe(video);
  } else { visible = true; sync(); }
  label();
})();
