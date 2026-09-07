import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const content = JSON.parse(readFileSync(new URL('content.json', root), 'utf8'));
const article = content.find(item => item.slug === 'deepseek-harness').focus.article;
const renderer = readFileSync(new URL('atoms-renderer-v211.js', root), 'utf8');
const demo = readFileSync(new URL('demos/reasoning-detail-slider.html', root), 'utf8');

for (const lang of ['zh', 'en']) {
  test(`${lang} article plan uses the interactive demo instead of the recording`, () => {
    const base = lang === 'en'
      ? (article.sections_en_latest || article.sections_en || article.sections_latest || article.sections)
      : (article.sections_latest || article.sections);
    const sections = article[`notion_${lang}`].map(item => typeof item === 'number' ? base[item] : { type: item[0], text: item[1] });
    const demos = sections.filter(section => section.type === 'interactive');
    assert.equal(demos.length, 1);
    assert.equal(demos[0].src, 'demos/reasoning-detail-slider.html?v=1');
    assert.equal(demos[0].aspectRatio, '736 / 520');
    assert(existsSync(new URL(demos[0].src.split('?')[0], root)));
    assert(!sections.some(section => section.src?.includes('deepseek-cot-levels.mp4')));
  });
}

test('interactive media renders a labelled, isolated iframe with existing media spacing', () => {
  const method = renderer.slice(renderer.indexOf('  _renderArticleInteractive(section) {'), renderer.indexOf('  _renderArticleVideo(section) {'));
  const render = new Function(`return ({ ${method} });`)()._renderArticleInteractive;
  const html = render({ src: 'demos/reasoning-detail-slider.html?v=1', title: '思维链可读', aspectRatio: '736 / 520' });
  assert.match(html, /title="思维链可读"/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.match(html, /aspect-ratio:736 \/ 520/);
  assert.match(html, /margin:32px 0 40px/);
  assert.doesNotMatch(html, /<video|autoplay|loop/);
  assert.equal((renderer.match(/html \+= this\._renderArticleInteractive\(section\);/g) || []).length, 2, 'Both initial article rendering and article swaps support the demo');
});

test('prototype retains all three levels, manual input and original reveal animation', () => {
  for (const label of ['简洁', '专业', '深入']) assert(demo.includes(`name: '${label}'`));
  assert.match(demo, /range\.addEventListener\('input', update\)/);
  assert.match(demo, /min="1" max="3" step="1" value="2"/);
  assert.match(demo, /detail-character-reveal 220ms/);
  assert.match(demo, /detail-highlight\.detail-tag-reveal/);
  assert.match(demo, /prefers-reduced-motion: reduce/);
  assert.match(demo, /data:image\/jpeg;base64,/);
  assert.doesNotMatch(demo, /setInterval|autoplay|<video/);
});
