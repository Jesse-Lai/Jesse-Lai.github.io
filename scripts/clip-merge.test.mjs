import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function fixture(filename) {
  const source = readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
  const methods = source.slice(source.indexOf('  _mergePhotos(droppedItem, targetItem) {'), source.indexOf('  _splitPhotos(clipInfo) {'));
  const alignments = [], fades = [], created = [];
  const bounds = item => ({ x: item.group.x, y: item.group.y, w: 200, h: 240 });
  const animate = (group, x, y) => {
    if (!group.paper) { Object.assign(group, { x, y }); return Promise.resolve(); }
    return new Promise(resolve => alignments.push(() => { Object.assign(group, { x, y }); resolve(); }));
  };
  let failLoad = false;
  const create = async () => {
    if (failLoad) throw new Error('Simulated SVG load failure');
    const clip = { clipSprite: { x: 0, y: 0 }, clipBottom: { x: 0, y: 0 } };
    created.push(clip);
    return clip;
  };
  const system = new Function('getPaperBounds', 'animateTo', 'createPaperclip', 'stackPaperclip', 'layoutPaperclip', 'fadeIn', 'fadeOut', 'console',
    `return new class { ${methods} };`)(bounds, animate, create, () => {}, () => {},
    async layer => { fades.push('in'); layer.alpha = 1; },
    async layer => { fades.push('out'); layer.alpha = 0; }, { error() {} });
  Object.assign(system, {
    app: { stage: {} }, clipGroups: [], _clearHoverLabelImmediate() {},
    generatedLabels: 0, generateClipLabel() { this.generatedLabels++; },
  });
  const photo = index => ({ clipped: false, baseScale: 1,
    group: { paper: true, x: index * 30, y: index * 40, scale: { set() {} } } });
  return { system, photo, alignments, fades, created, failLoad: () => { failLoad = true; } };
}

for (const filename of ['atoms-renderer-v211.js', 'atoms-renderer.js']) {
  test(`${filename}: a category reveals its clip once, after every sheet settles`, async () => {
    for (const count of [2, 3, 4, 6]) {
      const f = fixture(filename), photos = Array.from({ length: count }, (_, i) => f.photo(i));
      const merging = f.system._mergePhotoGroup(photos, { label: 'Design Work' });
      assert.equal(f.alignments.length, count - 1);
      for (const settle of f.alignments) {
        assert.equal(f.created.length, 0, 'No partial stack should show a clip');
        settle();
        await Promise.resolve();
      }
      const clip = await merging;
      assert.equal(f.created.length, 1);
      assert.deepEqual(f.fades, ['in', 'in'], 'Each half appears once, with no intervening disappearance');
      assert.deepEqual(clip.photos, photos);
      assert.equal(clip.label, 'Design Work');
      assert.equal(f.system.generatedLabels, 0, 'Category labels must not race an AI label');
      assert.ok(photos.every(p => p.clipped));
    }
  });

  test(`${filename}: manual additions preserve the group and category label`, async () => {
    const f = fixture(filename), photos = [f.photo(0), f.photo(1), f.photo(2)];
    const first = f.system._mergePhotoGroup(photos.slice(0, 2), { label: 'Life & Hobbies' });
    f.alignments.shift()();
    const clip = await first;
    const append = f.system._mergePhotos(photos[2], photos[1]);
    await f.system._mergePhotos(photos[2], photos[0]); // duplicate drop while merging
    await Promise.resolve();
    f.alignments.shift()();
    assert.equal(await append, clip);
    assert.equal(f.created.length, 1);
    assert.deepEqual(clip.photos, photos);
    assert.equal(clip.label, 'Life & Hobbies');
    assert.equal(f.system.generatedLabels, 0);
    assert.deepEqual(f.fades, ['in', 'in', 'out', 'out', 'in', 'in']);
  });

  test(`${filename}: a failed clip load releases the entire category`, async () => {
    const f = fixture(filename), photos = [f.photo(0), f.photo(1), f.photo(2)];
    f.failLoad();
    const merging = f.system._mergePhotoGroup(photos);
    f.alignments.forEach(settle => settle());
    await merging;
    assert.ok(photos.every(p => !p.clipped));
    assert.equal(f.system.clipGroups.length, 0);
  });
}
