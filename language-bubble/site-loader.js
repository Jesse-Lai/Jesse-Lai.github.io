(() => {
  'use strict';
  const root = document.documentElement;
  const screen = document.getElementById('loading-screen');
  const main = document.querySelector('main');
  const bar = document.getElementById('loading-bar');
  const progress = document.getElementById('loading-bar-bg');
  const percent = document.getElementById('loading-percent');
  const video = document.querySelector('.portrait-note video');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  main.inert = true;
  main.setAttribute('aria-busy', 'true');

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function bounded(promise, label, ms = 45000) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })
    ]).finally(() => clearTimeout(timer));
  }
  function imageReady(image) {
    image.loading = 'eager';
    return bounded(image.decode(), 'Image loading timed out');
  }
  async function videoReady() {
    // Download the whole clip: canplay alone only guarantees the first frames.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let blob;
    try {
      const response = await fetch(video.querySelector('source').src, { signal: controller.signal });
      if (!response.ok) throw new Error(`Video HTTP ${response.status}`);
      blob = await response.blob();
    } finally { clearTimeout(timer); }
    const objectURL = URL.createObjectURL(blob);
    try {
      await bounded(new Promise((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener('loadeddata', loaded);
          video.removeEventListener('error', failed);
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Video decoding failed')); };
        video.addEventListener('loadeddata', loaded);
        video.addEventListener('error', failed);
        video.preload = 'auto';
        video.src = objectURL;
        video.load();
      }), 'Video decoding timed out');
      video.currentTime = 0;
    } catch (error) {
      URL.revokeObjectURL(objectURL);
      throw error;
    }
  }
  async function prepare() {
    // Include CSS backgrounds and pseudo-elements; keep the asset list in CSS.
    const backgrounds = new Set();
    for (const element of main.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const css = getComputedStyle(element, pseudo).backgroundImage;
        for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) backgrounds.add(match[1]);
      }
    }
    const images = [...document.images].map(imageReady);
    for (const url of backgrounds) {
      const image = new Image();
      image.src = url;
      images.push(imageReady(image));
    }
    const interactiveDiagrams = [...document.querySelectorAll('atomic-design-diagram')].map(diagram =>
      bounded(customElements.whenDefined('atomic-design-diagram').then(() => diagram.ready), 'Interactive diagram loading timed out')
    );
    const jobs = [videoReady(), ...images, ...interactiveDiagrams,
      bounded(Promise.all([
        document.fonts.load('16px Inter'), document.fonts.load('24px Manrope'),
        document.fonts.load('24px Schoolbell'), document.fonts.load('13px "Red Hat Mono"')
      ]).then(() => document.fonts.ready), 'Fonts loading timed out')];
    let completed = 0;
    await Promise.all(jobs.map(job => job.then(() => {
      completed++;
      const value = Math.round(completed / jobs.length * 100);
      bar.style.width = `${value}%`;
      percent.textContent = `${value}%`;
      progress.setAttribute('aria-valuenow', value);
    })));
    await delay(reducedMotion.matches ? 0 : 300);
    // Reveal under the fading overlay, but do not consume the video's first pass.
    root.classList.remove('is-loading');
    screen.classList.add('hidden');
    await delay(reducedMotion.matches ? 0 : 600);
    screen.remove();
    main.inert = false;
    main.removeAttribute('aria-busy');
    root.dataset.pageReady = 'true';
    window.dispatchEvent(new Event('site:ready'));
  }
  prepare().catch(error => {
    console.error('Page preparation failed:', error);
    document.getElementById('loading-error').hidden = false;
  });
})();
