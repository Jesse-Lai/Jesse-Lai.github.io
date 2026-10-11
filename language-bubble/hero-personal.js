(() => {
  'use strict';
  const intro = document.querySelector('.hero-intro');
  const note = document.querySelector('.portrait-note');
  const space = document.querySelector('.portrait-space');
  const light = document.querySelector('.hero-light-perspective');
  const video = note.querySelector('video');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  let pageLoaded = document.documentElement.dataset.pageReady === 'true';
  let introPlayback = !reducedMotion.matches;
  let autoplayBlocked = false;
  let hovering = false;
  let playingByClick = false;
  let x = 0;
  let y = 0;
  let drag = null;
  let suppressClick = false;
  let frame = 0;

  // Keep the rotated / enlarged frame inside the intro (its own row on phones).
  function move(nextX, nextY) {
    const angle = 2.5 * Math.PI / 180;
    const width = (note.offsetWidth * Math.cos(angle) + note.offsetHeight * Math.sin(angle)) * 1.05;
    const height = (note.offsetHeight * Math.cos(angle) + note.offsetWidth * Math.sin(angle)) * 1.05;
    const origin = space.getBoundingClientRect();
    const bounds = (matchMedia('(max-width: 760px)').matches ? space : intro).getBoundingClientRect();
    const centerX = origin.left + origin.width / 2;
    const centerY = origin.top + origin.height / 2;
    const minX = Math.min(0, bounds.left + width / 2 - centerX);
    const maxX = Math.max(0, bounds.right - width / 2 - centerX);
    const minY = Math.min(0, bounds.top + height / 2 - centerY);
    const maxY = Math.max(0, bounds.bottom - height / 2 - centerY);
    x = Math.max(minX, Math.min(maxX, nextX));
    y = Math.max(minY, Math.min(maxY, nextY));
    note.style.setProperty('--note-x', `${x}px`);
    note.style.setProperty('--note-y', `${y}px`);
  }

  function updateMotion() {
    const resting = !pageLoaded || !inView || document.hidden;
    intro.classList.toggle('is-resting', resting);
    if (pageLoaded && !resting && !reducedMotion.matches && (introPlayback || hovering || playingByClick)) {
      // The initial playback is a single pass, even if the pointer is over it.
      video.loop = !introPlayback;
      video.muted = true;
      const playback = video.play();
      playback?.catch(error => {
        if (error.name === 'AbortError') return;
        autoplayBlocked = error.name === 'NotAllowedError';
        introPlayback = false;
        note.classList.remove('is-playing');
      });
    } else {
      video.pause();
      note.classList.remove('is-playing');
      // Resume an interrupted first pass instead of starting it over.
      if (!introPlayback && video.readyState > 0) video.currentTime = 0;
    }
  }
  video.addEventListener('playing', () => {
    autoplayBlocked = false;
    if (pageLoaded && inView && !document.hidden && !reducedMotion.matches && (introPlayback || hovering || playingByClick)) {
      note.classList.add('is-playing');
    } else { updateMotion(); }
  });
  video.addEventListener('ended', () => {
    introPlayback = false;
    hovering = false;
    playingByClick = false;
    updateMotion();
  });
  video.addEventListener('error', () => note.classList.remove('is-playing'));
  note.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovering = true; updateMotion(); }
  });
  note.addEventListener('pointerleave', () => { hovering = false; updateMotion(); });
  note.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (introPlayback) {
      introPlayback = false;
      hovering = false;
      // A WebView may still be waiting for a gesture. Treat the first tap as play.
      playingByClick = video.paused;
    } else {
      playingByClick = !playingByClick;
    }
    updateMotion();
  });
  note.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, moved: false };
    note.setPointerCapture(event.pointerId);
    note.classList.add('is-dragging');
  });
  note.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) move(drag.x + dx, drag.y + dy);
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    drag = null;
    note.classList.remove('is-dragging');
    if (note.hasPointerCapture(event.pointerId)) note.releasePointerCapture(event.pointerId);
  }
  note.addEventListener('pointerup', endDrag);
  note.addEventListener('pointercancel', endDrag);
  note.addEventListener('lostpointercapture', endDrag);
  note.addEventListener('keydown', event => {
    const directions = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (directions[event.key]) {
      event.preventDefault();
      const [dx, dy] = directions[event.key];
      move(x + dx, y + dy);
    } else if (event.key === 'Escape') {
      move(0, 0);
      introPlayback = false;
      playingByClick = false;
      hovering = false;
      updateMotion();
    }
  });

  // The wall's scroll-driven sun angle and shutter spacing, limited to the hero.
  function updateLight() {
    frame = 0;
    if (!inView || document.hidden) return;
    const p = reducedMotion.matches ? 0 : Math.min(1, Math.max(0, -intro.getBoundingClientRect().top / intro.offsetHeight));
    light.style.opacity = String(.12 + .16 * p);
    light.style.transform = `matrix3d(${.75 + .0833 * p},${-.0625 + .1458 * p},0,${.0008 - .0005 * p}, 0,1,0,0, 0,0,1,0, 0,0,0,1)`;
    light.style.setProperty('--shutter-gap', `${42 - 28 * p}px`);
    light.style.setProperty('--shutter-height', `${28 + 32 * p}px`);
  }
  function requestLightUpdate() { if (!frame) frame = requestAnimationFrame(updateLight); }
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateMotion();
    if (inView) requestLightUpdate();
  });
  observer.observe(intro);
  document.addEventListener('visibilitychange', () => { updateMotion(); requestLightUpdate(); });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) introPlayback = false;
    updateMotion(); requestLightUpdate();
  });
  window.addEventListener('site:ready', () => { pageLoaded = true; updateMotion(); }, { once: true });
  document.addEventListener('WeixinJSBridgeReady', () => {
    if (autoplayBlocked && !reducedMotion.matches) {
      autoplayBlocked = false;
      introPlayback = true;
      updateMotion();
    }
  }, { once: true });
  window.addEventListener('scroll', requestLightUpdate, { passive: true });
  window.addEventListener('resize', () => { move(x, y); requestLightUpdate(); }, { passive: true });
  requestLightUpdate();
})();
