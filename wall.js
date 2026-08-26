// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, renderTearoffCard, makeDraggable, FocusOverlay, getOrCreateVideo, loadAllVideosSequentially, animateTo, fadeIn } from "./atoms-renderer-v211.js?v=228";
import { WallArticle } from "./wall-article.js?v=152";

(async () => {
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  const sab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
  const W = window.innerWidth;
  const H = window.innerHeight + sat + sab;
  const dpr = Math.min(window.devicePixelRatio || 1, W < 768 ? 2 : Infinity);

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, antialias: true, resolution: dpr, autoDensity: true, backgroundColor: 0xFFFDFA });
  document.body.appendChild(app.canvas);
  app.canvas.style.touchAction = "pan-y";
  if (sat > 0) app.canvas.style.marginTop = `-${sat}px`;
  // On mobile: completely remove PixiJS event system listeners to allow native scroll
  const isTouchDevice = 'ontouchstart' in window;
  if (isTouchDevice && app.renderer.events) {
    app.renderer.events.setTargetElement(null);
    // Also remove global listeners PixiJS registered on window/document
    app.renderer.events.destroy();
  }
  app.stage.sortableChildren = true;
  app.stage.y = sat; // Offset stage content into safe area (canvas extends behind status bar)
  app.stage.visible = false; // Hide until fully loaded

  // Loading progress helpers
  const loadingBar = document.getElementById('loading-bar');
  const loadingPct = document.getElementById('loading-percent');
  const loadingScreen = document.getElementById('loading-screen');
  function setProgress(pct) {
    const p = Math.round(Math.min(100, Math.max(0, pct)));
    if (loadingBar) loadingBar.style.width = p + '%';
    if (loadingPct) loadingPct.textContent = p + '%';
  }
  setProgress(5);

  const configResp = await fetch('atoms-config.json');
  const atomsConfig = await configResp.json();
  setProgress(8);
  // Preload fonts before rendering
  try {
    await Promise.all([
      document.fonts.load('24px Schoolbell'),
      document.fonts.load('24px Special Elite'),
    ]);
  } catch(e) {}
  let fontRetries = 0;
  while (fontRetries < 20 && (!document.fonts.check('24px Schoolbell') || !document.fonts.check('24px Special Elite'))) {
    await new Promise(r => setTimeout(r, 100));
    fontRetries++;
  }

  // ─── Photo System (shared behavior from atoms-renderer) ───
  const photoSystem = new PhotoSystem(app, app.canvas, atomsConfig);

  const isMobile = W < 768;
  const isPortrait = H > W;

  // ─── Load content from Notion-synced content.json ───
  const contentResp = await fetch('content.json', { cache: 'no-store' });
  const contentData = await contentResp.json();
  const contentBySlug = new Map(contentData.filter(entry => entry.slug).map(entry => [entry.slug, entry]));
  setProgress(12);

  // ─── Language ───
  const pageUrl = new URL(window.location.href);
  const sharedLang = pageUrl.searchParams.get('lang');
  const storedLang = localStorage.getItem('wall-lang');
  const LANG = ['en', 'zh'].includes(sharedLang)
    ? sharedLang
    : (['en', 'zh'].includes(storedLang) ? storedLang : 'en');

  // Keep the active language in the URL so copied/shared links always open
  // in the sender's language. URL language wins over the recipient's local
  // preference, and legacy links are upgraded without dropping other params.
  localStorage.setItem('wall-lang', LANG);
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  if (sharedLang !== LANG) {
    pageUrl.searchParams.set('lang', LANG);
    history.replaceState(history.state, '', `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
  }

  function urlForPath(path) {
    const url = new URL(window.location.href);
    url.pathname = path;
    url.searchParams.set('lang', LANG);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  // Language toggle
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = LANG === 'zh' ? 'EN' : '中';

  function applyLangFonts(lang) {
    if (lang === 'zh') {
      document.documentElement.style.setProperty('--title-font', '"Optima", "PingFang SC", sans-serif');
      document.documentElement.style.setProperty('--body-font', '"Optima", "PingFangTC-light", sans-serif');
      document.documentElement.style.setProperty('--atom-font', '"Optima", "PingFangTC-light", sans-serif');
      document.documentElement.style.setProperty('--tearoff-font', '"PF HuTu", sans-serif');
    } else {
      document.documentElement.style.setProperty('--title-font', '"Special Elite", cursive');
      document.documentElement.style.setProperty('--body-font', '"Red Hat Mono", monospace');
      document.documentElement.style.setProperty('--atom-font', '"Special Elite", cursive');
      document.documentElement.style.setProperty('--tearoff-font', '"Special Elite", cursive');
    }
  }

  // ─── Analytics tracking helper ───
  const track = (event, data) => { if (window.umami) umami.track(event, data); };

  window._toggleLang = () => {
    const next = LANG === 'en' ? 'zh' : 'en';
    localStorage.setItem('wall-lang', next);
    track('lang-toggle', { lang: next });
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('lang', next);
    history.replaceState(history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    location.reload();
  };

  applyLangFonts(LANG);

  // Bilingual overrides: keyed by original title
  const i18n = {
    'Hello I\u2019m Jesse Lai':  {
      zh: { title: '你好，我是Jesse Lai', body: '微软AI产品设计师，探索人与AI自然交互的未来。' },
      en: { title: 'Hello I\u2019m Jesse Lai', body: 'AI Product Designer at Microsoft, exploring the future of natural human-AI interaction.' }
    },
    'Microsoft': {
      zh: { title: 'Microsoft', body: 'AI builder，与全球的团队一起设计 ToC 和 ToB 的Copilot' },
      en: { title: 'Microsoft', body: 'AI-native builder, shaping consumer and enterprise Copilot experiences with global teams.' }
    },
    'Alibaba': {
      zh: { title: 'Alibaba', body: '在大语言模型兴起的早期，设计帮助小商家做好\u201c吃\u201d的 AI 产品' },
      en: { title: 'Alibaba', body: 'In the early days of LLMs, I designed AI products behind every better bite.' }
    },
    'Stand-up Comedian': {
      zh: { title: '脱口秀演员', body: '脱口秀是我一生的热爱。把生活的酸甜苦辣变成段子搬上舞台，已经成为我生活不可分割的一部分。' },
      en: { title: 'Stand-up Comedian', body: 'Stand-up comedy is a lifelong passion. Turning life\'s highs and lows into jokes on stage has become an inseparable part of my life.' }
    },
    'Drawing': {
      zh: { title: '画画', body: '用画笔记录生活中的美好瞬间。' },
      en: { title: 'Drawing', body: 'Capturing beautiful moments in life with a brush.' }
    },
    'Vibe Coding': {
      zh: { title: 'Vibe Coding', body: 'Vibe Coding项目合集——用代码构建创意工具和交互体验。' },
      en: { title: 'Vibe Coding', body: 'A collection of vibe coding projects — building creative tools and interactive experiences with code.' }
    },
    'Arduino Light': {
      zh: { title: '天生创造者', body: '用Arduino打造的交互灯——硬件与创意的融合。' },
      en: { title: 'Born Builder', body: 'An interactive light built with Arduino — merging hardware and creativity.' }
    },
    'GenUI 设计指南': {
      zh: { title: 'GenUI 设计指南', body: '关于生成式UI，我的个人思考和总结，写得挺生动的' },
      en: { title: 'Designing for GenUI', body: 'My personal take on Generative UI—an engaging summary of ideas, observations, and lessons learned.' }
    },
    'AI产品设计原则': {
      zh: { title: 'AI产品设计原则', body: 'AI产品设计原则，以及这个网站会如何跟着模型迭代' },
      en: { title: 'My AI Design Principles', body: 'My AI product design principles, and how this website will evolve with model iterations.' }
    },
    'DeepSeek Harness': {
      zh: { title: 'DeepSeek Harness', body: '从设计一个 Agent，到设计一套可复用、可组合的创造系统。' },
      en: { title: 'DeepSeek Harness', body: 'From designing one agent to designing a reusable, composable creation system.' }
    },
    'Born Builder': {
      zh: { title: '天生创造者', body: '这个项目提醒我——我是一个创造者。无论是否在AI时代，让东西活起来都让我兴奋！' },
      en: { title: 'Born Builder', body: 'This project reminds me — I\'m a builder. Whether or not we\'re in the AI era, making things come to life excites me!' }
    },
  };

  function t(entry, field) {
    const override = i18n[entry.title];
    if (override && override[LANG] && override[LANG][field]) return override[LANG][field];
    return entry[field] || '';
  }

  // Photo captions (Schoolbell font, always English) + dates
  const photoCaptions = {
    'Hello I\u2019m Jesse Lai': { caption: 'Hello I\u2019m Jesse Lai', date: "" },
    'Stand-up Comedian':    { caption: 'Stand-up Comedian', date: "06 28 '23" },
    'Drawing':              { caption: 'Drawing', date: "12 20 '15" },
    'Vibe Coding':          { caption: 'Vibe Coding', date: "05 26 '25" },
    'Arduino Light':        { caption: 'Born Builder', date: "09 20 '16" },
  };

  // Focus overlay description overrides (bilingual)
  const focusDesc = {
    'Hello I\u2019m Jesse Lai': { zh: '嗨👋 我喜欢做各种好玩的东西！', en: 'Hi 👋 I love making all kinds of fun things!' },
    'Microsoft': { zh: '在微软，我做了各种Copilot，等等… 它们好像都长一个样！', en: 'At Microsoft, I worked on various Copilots and so on... they all seem to look the same!' },
    'Alibaba': { zh: '在阿里，我除了送外卖，还观察骑手怎么送外卖…', en: 'At Alibaba, besides delivering food, I also observe how couriers deliver food…' },
    'Vibe Coding': { zh: 'Vibe coding一年来，感觉找回了9岁那个下午，自己做了艘电动玩具船，在水上跑起来的兴奋感', en: 'After a year of vibe coding, it feels like I\'ve rediscovered that afternoon when I was nine, the excitement of building an electric toy boat and watching it run across the water.' },
    'Arduino Light': { zh: '快10年前的课程作业，但它提醒我——我是一个builder，把东西做出来就让我兴奋。', en: 'A school project from nearly 10 years ago, but it reminds me — I\'m a builder. Making things come to life is what excites me.' },
    'Born Builder': { zh: '快10年前的课程作业，但它提醒我——我是一个builder，把东西做出来就让我兴奋。', en: 'A school project from nearly 10 years ago, but it reminds me — I\'m a builder. Making things come to life is what excites me.' },
    'Stand-up Comedian': { zh: '脱口秀和设计有很多共通之处：都需要敏锐的观察力，都需要不断迭代打磨。', en: 'Stand-up comedy and design share a lot in common: both demand keen observation, and both require constant iteration and refinement.' },
    'Drawing': { zh: '画画让我进入心流，经常一不小心就发现已经天亮了。这些古法绘画作品，绝不含AI。', en: 'Drawing puts me in a flow state — I\'d often look up and realize it was already morning. These artworks are 100% hand-made, zero AI.' },
    'GenUI 设计指南': { zh: '为什么Figma不再能设计GenUI？这篇聊聊生成式UI的形态、行为，以及我自己的工作流。', en: 'Why can\'t Figma design GenUI anymore? This article explores the forms and behaviors of generative UI, plus my own workflow.' },
    'AI产品设计原则': { zh: '做AI产品就像钓鱼——来太早或太晚都没有收获，要在模型能力的边界处让产品发光。', en: 'Building AI products is like fishing — timing is everything. The product should shine right at the frontier of what models can do.' },
    'DeepSeek Harness': { zh: '从 Session 原子到插件生态：设计一套开放、可复用、可组合的创造系统。', en: 'From Session atoms to a plugin ecosystem: an open, reusable, composable creation system.' },
  };

  // Stamp image overrides
  const stampOverrides = {
    'GenUI 设计指南': 'genui.webp',
    'AI产品设计原则': 'aidesign.webp',
    'DeepSeek Harness': 'hands.webp',
    'Microsoft': 'Microsoft.webp',
    'Alibaba': 'alibaba.webp',
  };

  const coolStickies = ['Alibaba', 'GenUI 设计指南', 'AI产品设计原则', 'DeepSeek Harness'];

  const wallItems = [];
  for (const entry of contentData) {
    if (entry.atom === 'photo' && entry.cover_image) {
      const pc = photoCaptions[entry.title] || { caption: entry.title, date: '' };
      wallItems.push({
        type: 'photo',
        slug: entry.slug,
        category: entry.category,
        src: entry.cover_image,
        videoSrc: entry.video_src === null ? null : (entry.video_src || entry.cover_image.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4')),
        caption: pc.caption,
        date: pc.date,
        keywords: entry.keywords, focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
      });
    } else if (entry.atom === 'sticky') {
      wallItems.push({
        type: 'sticky',
        slug: entry.slug,
        category: entry.category,
        title: t(entry, 'title') || entry.title,
        body: t(entry, 'body') || entry.body || '',
        date: ({ 'GenUI 设计指南': "11 20 '25", 'AI产品设计原则': "05 20 '26", 'DeepSeek Harness': "08 23 '26", 'Microsoft': "02 27 '25", 'Alibaba': "06 29 '20" })[entry.title] || "05 01 '26",
        stampSrc: stampOverrides[entry.title] || entry.cover_image || 'stamp1.webp',
        videoSrc: entry.video_src === null ? null : (entry.video_src || (stampOverrides[entry.title] || entry.cover_image || 'stamp1.webp').replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4')),
        colorScheme: coolStickies.includes(entry.title) ? 'cool' : 'warm',
        _origTitle: entry.title, keywords: entry.keywords, focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
      });
    } else if (entry.atom === 'tearoff') {
      wallItems.push({ type: 'tearoff', category: entry.category });
    }
  }

  // ─── Scale factor for non-photo atoms ───
  // remoteCols: what the remote would use (1/2/3/4); cols: capped at 3
  // colW uses remoteCols so atom size matches remote's 4-col sizing on wide screens
  const remoteCols = W < 600 ? 1 : W < 1024 ? 2 : W < 1600 ? 3 : 4;
  const cols = Math.min(remoteCols, 3);
  const colW = W / remoteCols;
  const gridOffsetX = (W - colW * cols) / 2;
  const atomScale = colW / 480;

  // ─── Grid config ───
  const gridPad = colW * 0.216;
  // Mobile: extra top padding so first atom sits near vertical center of screen
  const topPad = isMobile ? H * 0.25 : gridPad;
  // Mobile: wider gap between atoms
  const itemGap = isMobile ? gridPad * 1.4 : gridPad;

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app, contentData, LANG, photoSystem);
  const routeItems = new Map();
  const SITE_ORIGIN = 'https://jesseos.com';
  const HOME_DESCRIPTION = "Jesse Lai's personal space for AI product design, creative coding, and experiments.";

  function getRouteSlug() {
    const parts = decodeURIComponent(window.location.pathname).split('/').filter(Boolean);
    return parts.length === 1 && contentBySlug.has(parts[0]) ? parts[0] : null;
  }

  function setMetaContent(selector, value) {
    const element = document.head.querySelector(selector);
    if (element) element.setAttribute('content', value);
  }

  function getShareDescription(entry) {
    const raw = entry?.focus?.description || entry?.body || entry?.title || HOME_DESCRIPTION;
    const text = String(raw).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
  }

  function updatePageMeta(entry = null) {
    const articleTitle = (LANG === 'en' && entry?.focus?.article?.title_en)
      ? entry.focus.article.title_en
      : (entry?.focus?.article?.title || entry?.focus?.title || entry?.title);
    const pageTitle = articleTitle ? `${articleTitle} — JesseOS` : 'JesseOS';
    const description = entry ? getShareDescription(entry) : HOME_DESCRIPTION;
    const url = entry ? `${SITE_ORIGIN}/${entry.slug}/` : `${SITE_ORIGIN}/`;
    const image = entry?.cover_image ? new URL(entry.cover_image, `${SITE_ORIGIN}/`).href : `${SITE_ORIGIN}/photo_portrait.webp`;

    document.title = pageTitle;
    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:type"]', entry ? 'article' : 'website');
    setMetaContent('meta[property="og:title"]', articleTitle || 'JesseOS');
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:image"]', image);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[name="twitter:title"]', articleTitle || 'JesseOS');
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="twitter:image"]', image);
  }

  function dismissActiveArticle() {
    if (focusOverlay.activeItem || focusOverlay._articleMode) focusOverlay.dismiss();
  }

  function openRoute(slug) {
    const route = routeItems.get(slug);
    if (!route) return;
    updatePageMeta(route.entry);

    if (focusOverlay._closing) {
      setTimeout(() => openRoute(slug), 80);
      return;
    }
    if (focusOverlay.activeItem === route.item) return;
    if (focusOverlay.activeItem) {
      dismissActiveArticle();
      setTimeout(() => openRoute(slug), 1100);
      return;
    }
    focusOverlay.open(route.item);
  }

  function navigateToAtom(item) {
    const slug = item?._routeSlug;
    if (!slug || item._isClipGroupFocus) {
      focusOverlay.open(item);
      return;
    }
    const entry = contentBySlug.get(slug);
    history.pushState({ jesseAtom: true, slug, fromWall: true }, '', urlForPath(`/${slug}/`));
    updatePageMeta(entry);
    focusOverlay.open(item);
  }

  focusOverlay.onCloseRequest = () => {
    const slug = getRouteSlug();
    if (!slug) {
      dismissActiveArticle();
      return;
    }
    if (history.state?.jesseAtom && history.state?.fromWall) {
      history.back();
      return;
    }
    history.replaceState({ jesseHome: true }, '', urlForPath('/'));
    updatePageMeta();
    dismissActiveArticle();
  };

  window.addEventListener('popstate', () => {
    const slug = getRouteSlug();
    if (slug) {
      openRoute(slug);
      return;
    }
    updatePageMeta();
    dismissActiveArticle();
  });

  setProgress(15);

  // ─── Step 1: Parallel preload all images, then render sequentially ───
  const rendered = []; // { group, bounds, wallItem, focusableItem }
  const totalItems = wallItems.length;

  // Phase 1: Preload all images in parallel
  const preloads = wallItems.map(item => {
    if (item.type === 'photo') return loadImagePixels(item.src);
    if (item.type === 'sticky' && item.stampSrc) return loadImagePixels(item.stampSrc, isMobile ? 400 : undefined);
    if (item.type === 'stamp') return loadImagePixels(item.src, isMobile ? 400 : undefined);
    return null;
  });
  setProgress(20);
  const preloaded = await Promise.all(preloads);
  setProgress(50);

  // Pre-fetch all video blobs during loading (parallel with atom rendering, no decode)
  const allVideoSrcs = contentData
    .filter(e => e.cover_image)
    .map(e => e.video_src === null ? null : (e.video_src || e.cover_image.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4')))
    .filter(Boolean);
  Promise.all(allVideoSrcs.map(async src => {
    const entry = getOrCreateVideo(src);
    if (!entry.blobUrl) {
      try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        entry.blobUrl = URL.createObjectURL(blob);
        entry.video.src = entry.blobUrl;
        console.log('[prefetch] blob ready:', src);
      } catch(e) { console.error('[prefetch] failed:', src, e); }
    }
  }));

  // Phase 2: Render sequentially (PIXI requires ordered operations)
  for (let i = 0; i < wallItems.length; i++) {
    const item = wallItems[i];
    const imgData = preloaded[i];
    if (item.type === 'photo') {
      const targetW = colW * 0.6;
      const photoScale = targetW / imgData.w;
      const photoItem = await photoSystem.addPhoto(item.src, 0, 0, photoScale, item, imgData);
      photoItem.videoSrc = item.videoSrc;
      if (photoItem.videoSrc) getOrCreateVideo(photoItem.videoSrc);
      if (item.focus) { photoItem.focusData = item.focus; const fd = focusDesc[item.caption] || focusDesc[item.title]; photoItem.focusData.description = fd ? fd[LANG] : (item.keywords || item.focus.description); }
      const b = photoItem.group.getBounds();
      rendered.push({ group: photoItem.group, bounds: b, wallItem: item, focusableItem: photoItem });
    } else if (item.type === 'sticky') {
      const stickyResult = await renderStickyNote(app, 0, 0, { title: item.title, body: item.body, date: item.date }, imgData, atomsConfig.stamp, { colorScheme: item.colorScheme });
      stickyResult.group.scale.set(atomScale);
      const b = stickyResult.group.getBounds();
      const stickyItem = photoSystem.addItem(stickyResult.group, b.width / atomScale, b.height / atomScale);
      stickyItem.config = { category: item.category, caption: item.title };
      if (item.focus) { stickyItem.focusData = item.focus; stickyItem.focusData.title = item.title; const fd = focusDesc[item._origTitle] || focusDesc[item.title]; stickyItem.focusData.description = fd ? fd[LANG] : (item.keywords || item.focus.description); }
      stickyItem._stickyTitle = { tx: stickyResult.titleX, ty: stickyResult.titleY, tw: stickyResult.titleW, th: stickyResult.titleH };
      // Stamp video: swap stamp sprite texture on hover
      if (stickyResult.stampSprite && item.videoSrc) {
        stickyItem.videoSrc = item.videoSrc;
        stickyItem.sprite = stickyResult.stampSprite;
        getOrCreateVideo(item.videoSrc);
      }
      rendered.push({ group: stickyResult.group, bounds: b, wallItem: item, focusableItem: stickyItem });
    } else if (item.type === 'stamp') {
      const stampResult = await renderStamp(app, imgData, 0, 0, atomsConfig.stamp);
      stampResult.group.scale.set(atomScale);
      const b = stampResult.group.getBounds();
      photoSystem.addItem(stampResult.group, stampResult.stampW, stampResult.stampH);
      rendered.push({ group: stampResult.group, bounds: b, wallItem: item, focusableItem: null });
    } else if (item.type === 'tearoff') {
      const tearResult = await renderTearoffCard(app, 0, 0, atomsConfig.tearoff);
      tearResult.group.scale.set(atomScale);
      const b = tearResult.group.getBounds();
      photoSystem.addItem(tearResult.group, b.width / atomScale, b.height / atomScale);
      rendered.push({ group: tearResult.group, bounds: b, wallItem: item, focusableItem: null });
    }
    setProgress(50 + ((i + 1) / totalItems) * 40);
  }

  // ─── Step 2: Masonry layout using actual bounds ───
  const colTops = new Array(cols).fill(topPad);
  const renderedItems = [];

  for (const r of rendered) {
    const col = colTops.indexOf(Math.min(...colTops));
    const colCenterX = gridOffsetX + (col + 0.5) * colW;
    const boundsW = r.bounds.width;
    const boundsH = r.bounds.height;

    // 元素中心对齐到列中心：
    // group.x 需要设成什么值，才能让 bounds 水平居中于 colCenterX？
    // bounds.x = group.x + (bounds.x - oldGroup.x)，即 bounds 左边缘相对于 group 有固定偏移
    const offsetX = r.bounds.x - r.group.x; // bounds 左边缘相对于 group.x 的偏移
    const offsetY = r.bounds.y - r.group.y; // bounds 上边缘相对于 group.y 的偏移

    r.group.x = colCenterX - boundsW / 2 - offsetX;
    r.group.y = colTops[col] - offsetY;

    colTops[col] += boundsH + itemGap;

    if (r.focusableItem) renderedItems.push({ wallItem: r.wallItem, focusableItem: r.focusableItem });
  }

  // Rotate the three existing visual slots after masonry has laid out the
  // wall, so each atom lands at the exact position shown in the previous
  // layout: DeepSeek → GenUI → AI Principles → DeepSeek.
  const renderedItemKey = item => item.wallItem._origTitle || item.wallItem.caption || item.wallItem.title;
  const findRenderedItem = title => rendered.find(item => renderedItemKey(item) === title);
  const genuiRendered = findRenderedItem('GenUI 设计指南');
  const aiPrinciplesRendered = findRenderedItem('AI产品设计原则');
  const deepSeekRendered = findRenderedItem('DeepSeek Harness');
  if (genuiRendered && aiPrinciplesRendered && deepSeekRendered) {
    const genuiBounds = genuiRendered.group.getBounds();
    const aiPrinciplesBounds = aiPrinciplesRendered.group.getBounds();
    const deepSeekBounds = deepSeekRendered.group.getBounds();

    const moveToSlot = (item, slotBounds) => {
      const itemBounds = item.group.getBounds();
      item.group.x += slotBounds.x + slotBounds.width / 2 - (itemBounds.x + itemBounds.width / 2);
      item.group.y += slotBounds.y - itemBounds.y;
    };

    moveToSlot(deepSeekRendered, genuiBounds);
    moveToSlot(genuiRendered, aiPrinciplesBounds);
    moveToSlot(aiPrinciplesRendered, deepSeekBounds);
  }

  // Save initial positions for shuffle reset
  for (const r of rendered) {
    r.initX = r.group.x;
    r.initY = r.group.y;
  }

  const totalH = Math.max(...colTops) + itemGap + 160; // extra padding for chat bar + tearoff strips
  const contentH = Math.max(totalH + sat + sab, H); // Save for resize handler
  app.renderer.resize(W, Math.max(totalH + sat + sab, H));
  app.canvas.style.height = Math.max(totalH + sat + sab, H) + 'px';
  if (totalH > H) {
    document.body.style.overflowY = 'auto';
    app.canvas.style.touchAction = 'pan-y';
  }


  // 注册所有有文章的 wall items，供 chat 推荐使用
  for (const { wallItem, focusableItem } of renderedItems) {
    if (wallItem.focus?.article && focusableItem) {
      const key = wallItem.title || wallItem.caption || wallItem.slug;
      focusOverlay.registerWallItem(key, {
        ...wallItem.focus,
        caption: wallItem.caption,
        date: wallItem.date,
        stampSrc: wallItem.stampSrc,
        atomType: wallItem.type,
        src: wallItem.src,
        title: wallItem.title,
        body: wallItem.body,
        colorScheme: wallItem.colorScheme,
      });
      focusOverlay.registerFocusItem(focusableItem, key);
      if (wallItem.slug) {
        focusableItem._routeSlug = wallItem.slug;
        routeItems.set(wallItem.slug, { item: focusableItem, entry: contentBySlug.get(wallItem.slug) });
      }
    }
  }
  photoSystem.onFocus = (item) => {
    track('atom-click', { title: item.focusData?.title || '' });
    navigateToAtom(item);
  };

  // ─── Load all video blobs sequentially (ordered by atom position, top first) ───
  const videoSrcsByPosition = rendered
    .filter(r => r.focusableItem && r.focusableItem.videoSrc)
    .sort((a, b) => a.group.y - b.group.y)
    .map(r => r.focusableItem.videoSrc);
  loadAllVideosSequentially(videoSrcsByPosition);

  // ─── Reveal: hide loading, show canvas ───
  setProgress(100);
  app.stage.visible = true;
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
    }, 300);
  }

  const initialSlug = getRouteSlug();
  if (initialSlug) {
    history.replaceState({ jesseAtom: true, slug: initialSlug, direct: true }, '', window.location.href);
    setTimeout(() => openRoute(initialSlug), loadingScreen ? 360 : 0);
  } else if (window.location.pathname === '/') {
    history.replaceState({ jesseHome: true }, '', window.location.href);
    updatePageMeta();
  }

  // ─── Mobile scroll hover for clip labels ───
  if ('ontouchstart' in window) photoSystem.setupMobileScrollHover();

  // ─── Wall Article (composer + AI narrative) ───
  const wallArticle = new WallArticle(focusOverlay, contentData, LANG);
  wallArticle.setupComposer();
  // Update composer placeholder for language
  const wcInput = document.querySelector('#wall-composer .composer-input');
  if (wcInput) wcInput.dataset.placeholder = LANG === 'zh' ? '问Jesse任何问题...' : 'Ask anything about Jesse...';

  const mouse = { x:-9999, y:-9999 };

  app.canvas.addEventListener("mousemove", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
  });
  app.canvas.addEventListener("mousedown", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
  });
  app.canvas.addEventListener("mouseup", () => {
  });

  // Touch
  let longPress=null, touchMoved=false;
  window.addEventListener("touchstart", e => {
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=false;
    longPress=setTimeout(()=>{
    },400);
  });
  window.addEventListener("touchmove", e => {
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=true;
    if(longPress){clearTimeout(longPress);longPress=null;}
  },{passive:false});
  window.addEventListener("touchend", () => {
    if(longPress){clearTimeout(longPress);longPress=null;}
  });

  // ─── Resize handler ───
  window.addEventListener('resize', () => {
    const newW = window.innerWidth;
    // Never shrink below original content height
    const newH = Math.max(window.innerHeight, contentH);
    app.renderer.resize(newW, newH);
    app.canvas.style.height = newH + 'px';
  });

  // ─── Organize by Category ───
  async function organizeByCategory() {
    // Split all existing clips in parallel
    await Promise.all([...photoSystem.clipGroups].map(cg => photoSystem._splitPhotos(cg)));
    await new Promise(r => setTimeout(r, 300));

    // Group items by category (only mergeable items with focusableItem)
    // Non-mergeable items (tearoff, stamp) stay as standalone masonry entries
    const categories = ['who_i_am', 'design_projects', 'design_thought', 'hobby'];
    const groups = {};
    const standalone = [];
    for (const cat of categories) groups[cat] = [];
    for (const r of rendered) {
      const cat = r.wallItem.category;
      if (!r.focusableItem) {
        standalone.push(r);
      } else if (groups[cat]) {
        groups[cat].push(r);
      }
    }

    // Sort each category: largest item area first (bottom of stack), smallest on top
    for (const cat of categories) {
      groups[cat].sort((a, b) => {
        const areaA = (a.focusableItem?.itemW || 0) * (a.focusableItem?.itemH || 0);
        const areaB = (b.focusableItem?.itemW || 0) * (b.focusableItem?.itemH || 0);
        return areaB - areaA;
      });
    }

    // Set z-order: largest (index 0) at bottom, smallest on top
    for (const cat of categories) {
      const items = groups[cat];
      for (const r of items) {
        app.stage.removeChild(r.group);
        app.stage.addChild(r.group);
      }
    }

    // Build masonry entries: category groups + standalone items
    for (const r of rendered) r.bounds = r.group.getBounds();
    const masonryEntries = [];
    for (const cat of categories) {
      const items = groups[cat];
      if (!items.length) continue;
      masonryEntries.push({ type: 'group', cat, items, bounds: items[0].bounds });
    }
    for (const r of standalone) {
      masonryEntries.push({ type: 'standalone', items: [r], bounds: r.bounds });
    }

    // Pre-compute masonry target positions
    const colTopsNew = new Array(cols).fill(gridPad);
    for (const entry of masonryEntries) {
      const b = entry.bounds;
      const col = colTopsNew.indexOf(Math.min(...colTopsNew));
      const colCenterX = gridOffsetX + (col + 0.5) * colW;
      entry.targetX = colCenterX - b.width / 2;
      entry.targetY = colTopsNew[col];
      colTopsNew[col] += b.height + gridPad;
    }

    // Fly ALL items to their masonry target position
    const allFlyAnims = [];
    for (const entry of masonryEntries) {
      for (const r of entry.items) {
        const tx = entry.targetX - (r.bounds.x - r.group.x);
        const ty = entry.targetY - (r.bounds.y - r.group.y);
        allFlyAnims.push(animateTo(r.group, tx, ty, 600));
      }
    }
    await Promise.all(allFlyAnims);

    // Merge category groups and assign predefined labels
    const categoryLabels = {
      who_i_am: 'About Me',
      design_projects: 'Design Work',
      design_thought: 'Design Thinking',
      hobby: 'Life & Hobbies',
    };
    await Promise.all(masonryEntries.filter(e => e.type === 'group').map(async entry => {
      const items = entry.items;
      if (items.length < 2) return;
      const target = items[0];
      for (let i = 1; i < items.length; i++) {
        await photoSystem._mergePhotos(items[i].focusableItem, target.focusableItem);
      }
      const cg = photoSystem.clipGroups.find(c => c.photos.includes(target.focusableItem));
      if (cg) cg.label = categoryLabels[entry.cat] || entry.cat;
    }));

    // Resize canvas if needed
    const newH = Math.max(...colTopsNew) + gridPad;
    app.renderer.resize(W, Math.max(newH + sat + sab, H)); app.canvas.style.height = Math.max(newH + sat + sab, H) + "px";
  }

  // ─── Shuffle: reset to initial wall layout ───
  async function shuffleToInitial() {
    // Split all existing clips in parallel
    await Promise.all([...photoSystem.clipGroups].map(cg => photoSystem._splitPhotos(cg)));
    await new Promise(r => setTimeout(r, 300));

    // Animate all items back to initial positions
    const anims = [];
    for (const r of rendered) {
      anims.push(animateTo(r.group, r.initX, r.initY, 600));
    }
    await Promise.all(anims);

    // Resize canvas
    const totalH = Math.max(...colTops) + gridPad + 80;
    app.renderer.resize(W, Math.max(totalH + sat + sab, H)); app.canvas.style.height = Math.max(totalH + sat + sab, H) + "px";
  }

  // Wire buttons
  document.getElementById('organize-btn')?.addEventListener('click', () => {
    organizeByCategory();
    track('organize-click');
    document.getElementById('shuffle-btn')?.classList.add('visible');
  });
  document.getElementById('shuffle-btn')?.addEventListener('click', () => {
    shuffleToInitial();
    track('shuffle-click');
    document.getElementById('shuffle-btn')?.classList.remove('visible');
  });

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt=Math.min(ticker.deltaMS/1000,0.05);
  });

  // ─── Scroll-driven background color gradient ───
  {
    const hexToRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const rgbToHex = (r,g,b) => '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
    const lerp = (a,b,t) => a + (b - a) * t;
    const lerpColorStops = (t, stops) => {
      if (t <= stops[0][0]) return stops[0][1];
      if (t >= stops[stops.length-1][0]) return stops[stops.length-1][1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i][0] && t <= stops[i+1][0]) {
          const local = (t - stops[i][0]) / (stops[i+1][0] - stops[i][0]);
          const a = hexToRgb(stops[i][1]), b = hexToRgb(stops[i+1][1]);
          return rgbToHex(lerp(a[0],b[0],local), lerp(a[1],b[1],local), lerp(a[2],b[2],local));
        }
      }
      return stops[stops.length-1][1];
    };

    // ── Time-of-day color: top & bottom per period, lerp between periods + scroll ──
    const timeColorStops = [
      [6,  '#F6F3EE', '#E79648'],  // day 6-18
      [18, '#F6F3EE', '#E79648'],  // day end
      [20, '#1D183B', '#02091D'],  // night 20-6
      [30, '#1D183B', '#02091D'],  // night wrap
    ];
    const lerpHex = (hexA, hexB, t) => {
      const a = hexToRgb(hexA), b = hexToRgb(hexB);
      return rgbToHex(lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t));
    };
    const getTimeColors = (overrideHour) => {
      const h = overrideHour !== undefined ? overrideHour : new Date().getHours() + new Date().getMinutes() / 60;
      const t = h < 6 ? h + 24 : h;
      for (let i = 0; i < timeColorStops.length - 1; i++) {
        if (t >= timeColorStops[i][0] && t <= timeColorStops[i+1][0]) {
          const local = (t - timeColorStops[i][0]) / (timeColorStops[i+1][0] - timeColorStops[i][0]);
          return {
            top: lerpHex(timeColorStops[i][1], timeColorStops[i+1][1], local),
            bottom: lerpHex(timeColorStops[i][2], timeColorStops[i+1][2], local),
          };
        }
      }
      return { top: timeColorStops[0][1], bottom: timeColorStops[0][2] };
    };
    const darken = (hex, amount) => {
      const [r,g,b] = hexToRgb(hex);
      return rgbToHex(r * (1-amount), g * (1-amount), b * (1-amount));
    };

    // Default to current hour's time period
    const autoHour = (() => { const h = new Date().getHours(); return h >= 20 || h < 6 ? 22 : 9; })();
    let timeOverride = autoHour;
    let currentBgColors = getTimeColors(timeOverride);

    // Sunlight overlay elements (null on mobile — removed from DOM)
    const nightGradient = document.querySelector('#night-gradient > .gradient-bg');
    const perspective = document.querySelector('#sunlight-overlay .perspective');
    const shuttersEl = document.querySelector('#sunlight-overlay .shutters');
    const shutterEls = document.querySelectorAll('#sunlight-overlay .shutter');
    const barEls = document.querySelectorAll('#sunlight-overlay .bar');
    const root = document.documentElement;

    const updateSunProgress = () => {
      const scrollY = window.scrollY || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, scrollY / maxScroll));

      // Background color — lerp between top and bottom based on scroll
      const currentColor = lerpHex(currentBgColors.top, currentBgColors.bottom, p);
      app.renderer.background.color = currentColor;
      document.documentElement.style.backgroundColor = currentColor;
      document.body.style.backgroundColor = currentColor;

      const [cr,cg,cb] = hexToRgb(currentBgColors.top);
      const brightness = (cr + cg + cb) / 3;

      // Right-to-left gradient overlay — deepens on scroll
      if (nightGradient) {
        const gradAlpha = brightness < 80
          ? 0.2 + 0.15 * p    // night: 0.2 → 0.35
          : 0.1 + 0.2 * p;    // day:  0.1 → 0.3
        nightGradient.style.background = `linear-gradient(to left, rgba(0,0,0,${gradAlpha}) 0%, rgba(0,0,0,0) 50%)`;
      }

      // Perspective: opacity + angle shift with scroll
      if (perspective) {
        const isNight = brightness < 80;
        perspective.style.opacity = isNight ? lerp(0.16, 0.5, p) : lerp(0.12, 0.4, p);
        perspective.style.mixBlendMode = isNight ? 'multiply' : 'soft-light';
        const m00 = lerp(0.75, 0.8333, p);
        const m01 = lerp(-0.0625, 0.0833, p);
        const m03 = lerp(0.0008, 0.0003, p);
        perspective.style.transform = `matrix3d(${m00},${m01},0,${m03}, 0,1,0,0, 0,0,1,0, 0,0,0,1)`;
      }

      // Blinds: gap shrinks, shutters grow as you scroll down
      if (shuttersEl) shuttersEl.style.gap = lerp(42, 14, p) + 'px';
      shutterEls.forEach(s => {
        s.style.height = lerp(28, 60, p) + 'px';
        // Night: override shutter color directly, bypassing blend mode issues
        if (brightness < 80) {
          s.style.backgroundColor = '#04040f';
          s.style.mixBlendMode = 'normal';
        } else {
          s.style.backgroundColor = '';
          s.style.mixBlendMode = '';
        }
      });
      barEls.forEach(b => {
        if (brightness < 80) {
          b.style.backgroundColor = '#04040f';
          b.style.mixBlendMode = 'normal';
        } else {
          b.style.backgroundColor = '';
          b.style.mixBlendMode = '';
        }
      });

      // Shadow & bounce light colors — adaptive darken + saturation boost
      // Dark backgrounds: less darken to preserve color; light backgrounds: more darken
      const darkenAmt = brightness < 80 ? 0.5 : 0.85;
      const darkened = darken(currentBgColors.top, darkenAmt);
      const [dr,dg,db] = hexToRgb(darkened);
      const avg = (dr + dg + db) / 3;
      const boost = brightness < 80 ? 3 : 1;
      const sr = Math.min(255, Math.max(0, avg + (dr - avg) * boost));
      const sg = Math.min(255, Math.max(0, avg + (dg - avg) * boost));
      const sb = Math.min(255, Math.max(0, avg + (db - avg) * boost));
      root.style.setProperty('--shadow', rgbToHex(sr, sg, sb));

      // Night mode class — drives dark mode for all non-wall overlays
      document.documentElement.classList.toggle('night-mode', brightness < 80);

      // Hover label color — light on dark backgrounds, dark on light
      photoSystem._labelColor = brightness > 160 ? '#000000' : 'rgba(255,255,255,0.85)';

      // Update UI button colors based on background brightness
      const btnColor = brightness > 160 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
      const btnHover = brightness > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
      const atomsBtn = document.getElementById('atoms-btn');
      const timeBtn = document.getElementById('time-toggle');
      const langBtn = document.getElementById('lang-toggle');
      [atomsBtn, timeBtn, langBtn].forEach(el => {
        if (el) { el.style.color = btnColor; el.onmouseenter = () => el.style.color = btnHover; el.onmouseleave = () => el.style.color = btnColor; }
      });
    };

    window.addEventListener('scroll', updateSunProgress, { passive: true });
    updateSunProgress();

    // Expose time preview control
    window._toggleTime = () => {
      const isNight = timeOverride >= 20 || (timeOverride < 6);
      timeOverride = isNight ? 9 : 22;
      currentBgColors = getTimeColors(timeOverride);
      // Force night-mode class to match new time immediately
      document.documentElement.classList.toggle('night-mode', timeOverride >= 20 || timeOverride < 6);
      updateSunProgress();
      const sun = document.getElementById('time-icon-sun');
      const moon = document.getElementById('time-icon-moon');
      if (sun) sun.style.display = timeOverride === 9 ? '' : 'none';
      if (moon) moon.style.display = timeOverride === 22 ? '' : 'none';
    };
  }

  // ─── Mobile: TikTok-style snap scroll ───
  if ('ontouchstart' in window) {
    const snapTargets = rendered.map(r => ({
      y: r.group.y - 40,
      item: r.focusableItem,  // may be null for tearoff
      group: r.group,
      baseScale: r.group.scale.x,
    }));
    let currentSnapIdx = 0;
    let touchStartY = 0;
    let isAnimating = false;

    const activateItem = (idx) => {
      // Deactivate previous
      if (currentSnapIdx >= 0 && currentSnapIdx < snapTargets.length) {
        const prevTarget = snapTargets[currentSnapIdx];
        const prev = prevTarget.item;
        if (prev) {
          photoSystem._hideHoverLabel(prev);
          photoSystem._stopPhotoVideo(prev);
        }
        // Animate scale down for all atom types
        const restoreScale = prevTarget.baseScale;
        const prevGroup = prevTarget.group;
        const animDown = () => {
          const s = prevGroup.scale.x;
          const next = s + (restoreScale - s) * 0.12;
          prevGroup.scale.set(next);
          if (Math.abs(next - restoreScale) > 0.001) requestAnimationFrame(animDown);
          else prevGroup.scale.set(restoreScale);
        };
        requestAnimationFrame(animDown);
      }
      currentSnapIdx = idx;
      if (idx < 0 || idx >= snapTargets.length) return;
      // Activate current
      const curTarget = snapTargets[idx];
      const cur = curTarget.item;
      if (cur && !document.body.classList.contains('focus-active')) photoSystem._showHoverLabel(cur);
      // Animate scale up for all atom types
      const targetScale = curTarget.baseScale * 1.10;
      const curGroup = curTarget.group;
      const animScale = () => {
        const s = curGroup.scale.x;
        const next = s + (targetScale - s) * 0.12;
        curGroup.scale.set(next);
        if (Math.abs(next - targetScale) > 0.001) requestAnimationFrame(animScale);
        else curGroup.scale.set(targetScale);
      };
      requestAnimationFrame(animScale);
      if (cur && cur.videoSrc && cur.sprite) {
        const entry = getOrCreateVideo(cur.videoSrc);
        console.log('[activate]', cur.videoSrc, 'ready:', entry.ready, 'texture:', !!entry.texture);
        const playAndSwap = () => {
          console.log('[play]', cur.videoSrc, 'calling play()');
          entry.video.currentTime = 0;
          entry.video.play().then(() => {
            console.log('[play] OK:', cur.videoSrc);
            if (!entry.texture) {
              entry.texture = PIXI.Texture.from(entry.video, { resourceOptions: { autoPlay: false } });
              entry.ready = true;
            }
            cur._staticTex = cur._staticTex || cur.sprite.texture;
            cur.sprite.texture = entry.texture;
            if (window.umami) umami.track("video-play", { src: cur.videoSrc });
          }).catch(e => console.error('[play] FAIL:', cur.videoSrc, e?.message || e));
        };
        if (entry.ready) {
          playAndSwap();
        } else {
          console.log('[activate] not ready, waiting canplay:', cur.videoSrc);
          // Video blob not downloaded yet — play when ready (only if still current atom)
          entry.video.addEventListener('canplay', () => {
            console.log('[canplay] fired:', cur.videoSrc, 'stillCurrent:', currentSnapIdx === idx);
            if (currentSnapIdx === idx) playAndSwap();
          }, { once: true });
        }
      }
    };

    const scrollToIdx = (idx) => {
      if (idx < 0 || idx >= snapTargets.length || isAnimating) return;
      isAnimating = true;
      const targetY = Math.max(0, snapTargets[idx].y - window.innerHeight * 0.3);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
      activateItem(idx);
      setTimeout(() => { isAnimating = false; }, 500);
    };

    // Initial snap
    scrollToIdx(0);

    // Block native scroll completely — JS controls position
    // But allow scrolling inside focus overlay (article mode) or wall-article
    const _isOverlayOpen = () =>
      document.body.classList.contains('focus-active') ||
      document.getElementById('wall-article')?.classList.contains('visible');

    document.addEventListener('touchmove', (e) => {
      if (_isOverlayOpen()) return;
      e.preventDefault();
    }, { passive: false });

    // Detect swipe direction on touchend
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (_isOverlayOpen()) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      const threshold = 30;
      if (Math.abs(dy) < threshold) return;
      if (dy > 0 && currentSnapIdx < snapTargets.length - 1) {
        scrollToIdx(currentSnapIdx + 1);
      } else if (dy < 0 && currentSnapIdx > 0) {
        scrollToIdx(currentSnapIdx - 1);
      }
    }, { passive: true });
  }
})();
