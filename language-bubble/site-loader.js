(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.pageReady === 'true') return;
  const main = document.querySelector('main');
  const video = document.querySelector('.portrait-note video');
  main.inert = true;
  main.setAttribute('aria-busy', 'true');

  // Optional resources must never keep the document behind the loading screen.
  // Each waiter removes listeners even when a WebView never emits a media event.
  function mediaReady(media, events, timeout) {
    return new Promise(resolve => {
      let timer;
      const done = () => {
        clearTimeout(timer);
        events.forEach(event => media.removeEventListener(event, done));
        media.removeEventListener('error', done);
        resolve();
      };
      events.forEach(event => media.addEventListener(event, done));
      media.addEventListener('error', done);
      timer = setTimeout(done, timeout);
      if (media.tagName === 'IMG') {
        if (media.complete) done();
      } else if (media.readyState >= 2) done();
    });
  }

  async function prepare() {
    // Keep below-the-fold images lazy. Do not scan every CSS background or wait
    // for document.fonts.ready: either would turn the whole article into a gate.
    const jobs = [...document.querySelectorAll('.hero img')].map(image => mediaReady(image, ['load'], 2500));
    if (video && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData) {
      const ready = mediaReady(video, ['loadeddata', 'canplay'], 1500);
      jobs.push(ready);
      // Use the original MP4 URL for native streaming and WebView compatibility.
      // Playback starts in hero-personal.js after site:ready, never under the overlay.
      video.muted = true;
      video.preload = 'auto';
      try { video.load(); } catch (_) { /* The still portrait remains available. */ }
    }
    let completed = 0;
    await Promise.all(jobs.map(job => job.then(() => {
      if (root.dataset.pageReady === 'true') return;
      const value = Math.round(++completed / jobs.length * 100);
      document.getElementById('loading-bar').style.width = `${value}%`;
      document.getElementById('loading-percent').textContent = `${value}%`;
      document.getElementById('loading-bar-bg').setAttribute('aria-valuenow', value);
    })));
    window.finishSiteLoading();
  }
  prepare().catch(() => window.finishSiteLoading());
})();
