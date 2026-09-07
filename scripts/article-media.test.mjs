import test from 'node:test';
import assert from 'node:assert/strict';
import { bindArticleMedia, disposeArticleMedia } from '../article-media.js';

function fixture({ autoplay = true, observer = true, pendingPlay = false } = {}) {
  let notify, visibility, finishPlay;
  const attributes = new Map();
  const video = {
    dataset: { articleSrc: 'demo.mp4', articlePoster: 'demo.jpg', articleAutoplay: String(autoplay) },
    paused: true, loads: 0, plays: 0,
    hasAttribute: name => attributes.has(name),
    removeAttribute: name => attributes.delete(name),
    set src(value) { attributes.set('src', value); },
    load() { this.loads++; },
    pause() { this.paused = true; },
    play() {
      this.plays++;
      if (!pendingPlay) { this.paused = false; return Promise.resolve(); }
      return new Promise(resolve => { finishPlay = () => { this.paused = false; resolve(); }; });
    },
  };
  const image = { loading: 'lazy' };
  const container = { querySelector: () => image, querySelectorAll: () => [video] };
  globalThis.document = {
    hidden: false,
    addEventListener: (name, callback) => { visibility = callback; },
    removeEventListener: (name, callback) => { if (visibility === callback) visibility = null; },
  };
  let disconnected = false;
  globalThis.IntersectionObserver = class {
    constructor(callback) { notify = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  globalThis.window = observer ? { IntersectionObserver } : {};
  return { container, video, image, attributes,
    intersect: isIntersecting => notify([{ target: video, isIntersecting }]),
    hide: () => { document.hidden = true; visibility(); },
    finish: () => finishPlay(),
    disconnected: () => disconnected,
    hasVisibilityListener: () => Boolean(visibility),
  };
}

test('offscreen recordings have no source; visible clips load, play and pause offscreen', async () => {
  const f = fixture();
  bindArticleMedia(f.container);
  assert.equal(f.attributes.has('src'), false);
  assert.equal(f.image.loading, 'eager');
  f.intersect(true);
  await Promise.resolve();
  assert.equal(f.attributes.get('src'), 'demo.mp4');
  assert.equal(f.video.poster, 'demo.jpg');
  assert.equal(f.video.paused, false);
  f.intersect(false);
  assert.equal(f.video.paused, true);
  disposeArticleMedia(f.container);
  assert.equal(f.attributes.has('src'), false);
  assert(f.disconnected());
  assert.equal(f.hasVisibilityListener(), false);
});

test('an in-flight play cannot keep playing after the tab hides or article closes', async () => {
  for (const action of ['hide', 'close']) {
    const f = fixture({ pendingPlay: true });
    bindArticleMedia(f.container);
    f.intersect(true);
    if (action === 'hide') f.hide();
    else disposeArticleMedia(f.container);
    f.finish();
    await Promise.resolve();
    assert.equal(f.video.paused, true);
    disposeArticleMedia(f.container);
  }
});

test('manual WeChat players hydrate on visibility without autoplay', () => {
  const f = fixture({ autoplay: false });
  bindArticleMedia(f.container);
  f.intersect(true);
  assert.equal(f.attributes.get('src'), 'demo.mp4');
  assert.equal(f.video.plays, 0);
  disposeArticleMedia(f.container);
});

test('browsers without IntersectionObserver retain manual playback and preload none', () => {
  const f = fixture({ observer: false });
  bindArticleMedia(f.container);
  assert.equal(f.attributes.get('src'), 'demo.mp4');
  assert.equal(f.video.preload, 'none');
  assert.equal(f.video.controls, true);
  assert.equal(f.video.plays, 0);
  disposeArticleMedia(f.container);
});
