import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const CONTENT_PATH = join(PROJECT_ROOT, 'content.json');
const TEMPLATE_PATH = join(PROJECT_ROOT, 'index.html');
const MANIFEST_PATH = join(PROJECT_ROOT, '.atom-pages.generated.json');
const SITE_ORIGIN = 'https://jesseos.com';
const META_PATTERN = /\s*<!-- ATOM_PAGE_META_START -->[\s\S]*?<!-- ATOM_PAGE_META_END -->/;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shareTitle(entry) {
  return entry.focus?.article?.title || entry.focus?.title || entry.title;
}

function shareDescription(entry) {
  const raw = entry.focus?.description || entry.body || entry.title || '';
  const text = String(raw).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
}

export function getShareableEntries(content) {
  return content.filter(entry => entry.focus?.article);
}

export function validateEntries(entries, existingNames = new Set(), previousSlugs = new Set()) {
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.slug) throw new Error(`Shareable Atom "${entry.title || entry.id}" is missing a slug.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) {
      throw new Error(`Invalid slug "${entry.slug}". Use lowercase ASCII letters, numbers, and single hyphens.`);
    }
    if (seen.has(entry.slug)) throw new Error(`Duplicate Atom slug "${entry.slug}".`);
    if (existingNames.has(entry.slug) && !previousSlugs.has(entry.slug)) {
      throw new Error(`Atom slug "${entry.slug}" conflicts with an existing top-level path.`);
    }
    if (!entry.cover_image) throw new Error(`Shareable Atom "${entry.title || entry.slug}" is missing cover_image.`);
    seen.add(entry.slug);
  }
  return seen;
}

export function buildMetaBlock(entry) {
  const title = shareTitle(entry);
  const pageTitle = `${title} — JesseOS`;
  const description = shareDescription(entry);
  const url = `${SITE_ORIGIN}/${entry.slug}/`;
  const image = new URL(entry.cover_image, `${SITE_ORIGIN}/`).href;

  return `
  <!-- ATOM_PAGE_META_START -->
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="JesseOS">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <!-- ATOM_PAGE_META_END -->`;
}

async function readPreviousManifest() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    return new Set(Array.isArray(manifest.slugs) ? manifest.slugs : []);
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw new Error(`Cannot read ${MANIFEST_PATH}: ${error.message}`);
  }
}

export async function generateAtomPages() {
  const [contentText, template, topLevelEntries, previousSlugs] = await Promise.all([
    readFile(CONTENT_PATH, 'utf8'),
    readFile(TEMPLATE_PATH, 'utf8'),
    readdir(PROJECT_ROOT, { withFileTypes: true }),
    readPreviousManifest(),
  ]);
  if (!META_PATTERN.test(template)) throw new Error('index.html is missing Atom page metadata markers.');

  const content = JSON.parse(contentText);
  const entries = getShareableEntries(content);
  const existingNames = new Set(topLevelEntries.map(item => item.name));
  const currentSlugs = validateEntries(entries, existingNames, previousSlugs);

  for (const oldSlug of previousSlugs) {
    if (!currentSlugs.has(oldSlug)) await rm(join(PROJECT_ROOT, oldSlug), { recursive: true, force: true });
  }

  for (const entry of entries) {
    const outputDir = join(PROJECT_ROOT, entry.slug);
    const outputHtml = template.replace(META_PATTERN, buildMetaBlock(entry));
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'index.html'), outputHtml);
  }

  const slugs = [...currentSlugs].sort();
  await writeFile(MANIFEST_PATH, `${JSON.stringify({ slugs }, null, 2)}\n`);
  return slugs;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  const slugs = await generateAtomPages();
  console.log(`Generated ${slugs.length} Atom pages: ${slugs.join(', ')}`);
}
