import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMetaBlock, getShareableEntries, validateEntries } from './generate-atom-pages.mjs';

const atom = (overrides = {}) => ({
  id: 'atom-1',
  slug: 'example-atom',
  title: 'Example & Atom',
  body: 'A useful <b>description</b>.',
  cover_image: 'images/example.webp',
  focus: { article: { title: 'Example & Atom', sections: [] } },
  ...overrides,
});

test('only entries with articles are shareable', () => {
  assert.deepEqual(getShareableEntries([atom(), { title: 'Tearoff', atom: 'tearoff' }]).map(entry => entry.slug), ['example-atom']);
});

test('validates missing, invalid, duplicate, and conflicting slugs', () => {
  assert.throws(() => validateEntries([atom({ slug: undefined })]), /missing a slug/);
  assert.throws(() => validateEntries([atom({ slug: 'Bad Slug' })]), /Invalid slug/);
  assert.throws(() => validateEntries([atom(), atom({ id: 'atom-2' })]), /Duplicate Atom slug/);
  assert.throws(() => validateEntries([atom()], new Set(['example-atom'])), /conflicts/);
  assert.doesNotThrow(() => validateEntries([atom()], new Set(['example-atom']), new Set(['example-atom'])));
});

test('builds crawler-readable canonical and social metadata', () => {
  const meta = buildMetaBlock(atom());
  assert.match(meta, /<title>Example &amp; Atom — JesseOS<\/title>/);
  assert.match(meta, /rel="canonical" href="https:\/\/jesseos\.com\/example-atom\/"/);
  assert.match(meta, /property="og:type" content="article"/);
  assert.match(meta, /property="og:image" content="https:\/\/jesseos\.com\/images\/example\.webp"/);
  assert.match(meta, /content="A useful description\."/);
});
