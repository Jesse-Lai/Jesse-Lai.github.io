// Article recordings only download and play when they enter the visible area.
const bindings = new WeakMap();

export function disposeArticleMedia(container) {
  const binding = bindings.get(container);
  if (!binding) return;
  binding.observer?.disconnect();
  document.removeEventListener('visibilitychange', binding.onVisibilityChange);
  binding.disposed = true;
  for (const video of binding.videos) {
    video.pause();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
  }
  bindings.delete(container);
}

export function bindArticleMedia(container) {
  disposeArticleMedia(container);
  const firstImage = container.querySelector('img');
  if (firstImage) {
    firstImage.loading = 'eager';
    firstImage.fetchPriority = 'high';
  }
  const videos = Array.from(container.querySelectorAll('video[data-article-src]'));
  if (!videos.length) return;
  const visible = new Set();
  const binding = { videos, disposed: false, observer: null, onVisibilityChange: null };
  const hydrate = (video, preload = 'metadata') => {
    if (video.hasAttribute('src')) return;
    if (video.dataset.articlePoster) video.poster = video.dataset.articlePoster;
    video.src = video.dataset.articleSrc;
    video.preload = preload;
    video.load();
  };
  const updatePlayback = video => {
    if (binding.disposed || document.hidden || !visible.has(video)) {
      video.pause();
      return;
    }
    hydrate(video);
    if (video.dataset.articleAutoplay !== 'true') return;
    video.muted = true;
    video.defaultMuted = true;
    video.play()?.then(() => {
      // A play promise can resolve after a scroll, tab switch or article close.
      if (binding.disposed || document.hidden || !visible.has(video)) video.pause();
    }).catch(() => {
      if (!binding.disposed && visible.has(video)) video.controls = true;
    });
  };
  binding.onVisibilityChange = () => videos.forEach(updatePlayback);
  document.addEventListener('visibilitychange', binding.onVisibilityChange);
  bindings.set(container, binding);
  if (!('IntersectionObserver' in window)) {
    // Older browsers still get a usable player, without downloading every clip.
    for (const video of videos) {
      hydrate(video, 'none');
      video.controls = true;
    }
    return;
  }
  binding.observer = new IntersectionObserver(entries => {
    for (const { target: video, isIntersecting } of entries) {
      if (isIntersecting) visible.add(video);
      else visible.delete(video);
      updatePlayback(video);
    }
  });
  videos.forEach(video => binding.observer.observe(video));
}
