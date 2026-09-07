import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../atoms-renderer-v211.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('  _renderArticleAtom(section) {'), source.indexOf('  _renderImageCarousel(section) {'));
const articleAtoms = new Function(`return new class { ${methods} };`)();

function fixture(lang = 'zh') {
  let finish, destroyed = 0;
  const children = [];
  const placeholder = {
    dataset: { articleAtom: 'deepseek-harness' }, isConnected: true,
    appendChild(child) { children.push(child); },
    replaceChildren(child) { children.splice(0, children.length, child); },
  };
  const root = { querySelectorAll: selector => selector.includes(':not') && placeholder.dataset.atomBound ? [] : [placeholder] };
  const entry = { container: { style: {} }, app: { canvas: { style: {} }, destroy() { destroyed++; } } };
  const meta = { title: 'DeepSeek Harness', atomType: 'sticky' };
  const calls = [];
  const overlay = Object.assign(Object.create(articleAtoms), {
    _lang: lang,
    _wallFocusItems: [{ key: 'DeepSeek Harness', item: { _routeSlug: 'deepseek-harness' } }],
    _wallItemRegistry: { 'DeepSeek Harness': meta },
    _contentData: [],
    _createAtomEntry(...args) { calls.push(args); return new Promise(resolve => { finish = resolve; }); },
  });
  globalThis.document = { createElement: () => ({}) };
  return { overlay, root, placeholder, entry, meta, calls, children,
    finish: () => finish(entry), destroyed: () => destroyed };
}

test('article atoms reuse registered metadata, preserve language and bind only once', async () => {
  for (const lang of ['zh', 'en']) {
    const f = fixture(lang);
    f.overlay._bindArticleAtoms(f.root);
    f.overlay._bindArticleAtoms(f.root);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][0], f.meta);
    assert.deepEqual(f.calls[0][1], { href: `/deepseek-harness/?lang=${lang}`, trackInChat: false });
    assert.equal(f.children[0].href, `/deepseek-harness/?lang=${lang}`);
    f.finish();
    await Promise.resolve();
    assert.equal(f.children[0], f.entry.container);
    f.overlay._disposeArticleAtoms(f.root);
    f.overlay._disposeArticleAtoms(f.root);
    assert.equal(f.destroyed(), 1);
  }
});

test('closing an article while its atom loads releases the late renderer', async () => {
  const f = fixture();
  f.overlay._bindArticleAtoms(f.root);
  f.overlay._disposeArticleAtoms(f.root);
  f.finish();
  await Promise.resolve();
  assert.equal(f.destroyed(), 1);
  assert.notEqual(f.children[0], f.entry.container);
});

test('missing atom metadata leaves a working article link', () => {
  const f = fixture();
  f.overlay._wallFocusItems = [];
  f.overlay._contentData = [{ slug: 'deepseek-harness', title: 'DeepSeek Harness' }];
  f.overlay._bindArticleAtoms(f.root);
  assert.equal(f.calls.length, 0);
  assert.equal(f.children[0].href, '/deepseek-harness/?lang=zh');
  assert.equal(f.children[0].textContent, 'DeepSeek Harness');
});
