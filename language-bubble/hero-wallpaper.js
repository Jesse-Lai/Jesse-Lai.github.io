(() => {
  'use strict';
  const stages = Array.from(document.querySelectorAll('.wallpaper-stage'));
  if (!stages.length) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const previousStyles = new WeakMap();

  function update() {
    frame = 0;
    // clientWidth excludes a classic scrollbar, so the reveal cannot overflow.
    const width = document.documentElement.clientWidth;
    // Measure every stage before writing styles to avoid repeated layouts.
    const measurements = stages.map(stage => ({ stage, bounds: stage.getBoundingClientRect() }));
    for (const { stage, bounds } of measurements) {
      stage.classList.toggle('is-expanding', !reducedMotion.matches);
      if (reducedMotion.matches) continue;
      const gutter = Math.max(0, (width - bounds.width) / 2);
      const start = Math.min(bounds.top + window.scrollY, window.innerHeight * .85);
      const end = Math.min(window.innerHeight * .12, start - 1);
      const progress = Math.max(0, Math.min(1, (start - bounds.top) / (start - end)));
      const eased = progress * progress * (3 - 2 * progress);
      const inset = (gutter * (1 - eased)).toFixed(3);
      const roundness = (1 - eased).toFixed(4);
      const style = `${width}:${inset}:${roundness}`;
      if (style === previousStyles.get(stage)) continue;
      previousStyles.set(stage, style);
      stage.style.setProperty('--wallpaper-width', `${width}px`);
      stage.style.setProperty('--wallpaper-inset', `${inset}px`);
      stage.style.setProperty('--wallpaper-roundness', roundness);
    }
  }

  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('pageshow', requestUpdate);
  window.addEventListener('load', requestUpdate, { once: true });
  reducedMotion.addEventListener('change', requestUpdate);
  const resizeObserver = new ResizeObserver(requestUpdate);
  stages.forEach(stage => resizeObserver.observe(stage));
  update();
})();
