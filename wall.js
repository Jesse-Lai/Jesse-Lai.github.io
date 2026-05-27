// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, makeDraggable, FocusOverlay, getOrCreateVideo, animateTo, fadeIn } from "./atoms-renderer.js?v=178";
import { WallArticle } from "./wall-article.js?v=151";

(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, W < 768 ? 2 : Infinity);

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, antialias: true, resolution: dpr, autoDensity: true, backgroundColor: 0xFFFDFA });
  document.body.appendChild(app.canvas);
  app.canvas.style.touchAction = "pan-y";
  // On mobile: completely remove PixiJS event system listeners to allow native scroll
  const isTouchDevice = 'ontouchstart' in window;
  if (isTouchDevice && app.renderer.events) {
    app.renderer.events.setTargetElement(null);
    // Also remove global listeners PixiJS registered on window/document
    app.renderer.events.destroy();
  }
  app.stage.sortableChildren = true;
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
  const contentResp = await fetch('content.json');
  const contentData = await contentResp.json();
  setProgress(12);

  // ─── Language ───
  const LANG = localStorage.getItem('wall-lang') || 'en';

  // Bilingual overrides: keyed by original title
  const i18n = {
    'Hello I\'m Jesse Lai':  { zh: { title: '你好，我是Jesse Lai', body: '微软AI产品设计师，探索人与AI自然交互的未来。' } },
    'My Story':              { zh: { title: '我的故事', body: '微软AI产品设计师，6年以上AI产品设计经验，涵盖B2C和B2B。' } },
    'Food Delivery Service': { zh: { title: '外卖配送服务', body: '饿了么是中国知名外卖平台。我缩短了商家入驻流程，改进了任务奖励系统，帮助商家运营并提高存活率。' } },
    'AI Merchant Assistant': { zh: { title: 'AI商家助手', body: '我分析了生成式AI对饿了么商家在线咨询服务的影响，设计并构建了对话式助手，提升商家咨询体验。' } },
    'Review Analysis':       { zh: { title: '评价分析', body: '评价分析对外卖商家运营至关重要。我发现用户很少使用该功能，通过设计研究找到原因并提出创新方案。' } },
    'Stand-up Comedian':     { zh: { title: '脱口秀演员', body: '脱口秀是我一生的热爱。把生活的酸甜苦辣变成段子搬上舞台，已经成为我生活不可分割的一部分。' } },
    'Fishing':               { zh: { title: '钓鱼', body: '清晨的第一竿：安静得只剩水面在呼吸。今天的战利品：不大，但足够让人开心一整天。' } },
    'Drawing':               { zh: { title: '画画', body: '即将推出' } },
    'GenUI':                 { en: { title: 'GenUI', body: 'In the AI era, our interaction experiences have regressed — from rich GUIs back to text-based chat. GenUI explores AI-generated interfaces that match the shape of information.' } },
    'AI产品设计原则':          { en: { title: 'AI Design Principles', body: 'A growing collection of AI product design principles, drawing from industry leaders and my own practice.' } },
    '播客分享':               { en: { title: 'Podcast', body: 'Jesse\'s podcast recommendations — notable episodes, key insights, and ideas worth sharing.' } },
  };

  function t(entry, field) {
    const override = i18n[entry.title];
    if (override && override[LANG] && override[LANG][field]) return override[LANG][field];
    return entry[field] || '';
  }

  // Photo captions (Schoolbell font, always English) + dates
  const photoCaptions = {
    'Hello I\'m Jesse Lai': { caption: 'Hello I\'m Jesse Lai', date: "'25 03 20" },
    'Stand-up Comedian':    { caption: 'Stand-up Comedian', date: "'26 01 15" },
    'Fishing':              { caption: 'Fishing', date: "'25 06 15" },
    'Drawing':              { caption: 'Drawing', date: "'25 08 10" },
    '播客分享':              { caption: 'Podcast', date: "'26 03 01" },
  };

  // Stamp image overrides
  const stampOverrides = {
    'GenUI': 'photo_stamp.webp',
    'My Story': 'stamp_mystory.png',
    'Food Delivery Service': 'photo_ski.webp',
    'AI Merchant Assistant': 'AI-Merchant-Assistant.webp',
    'Review Analysis': 'review.webp',
  };

  const coolStickies = ['AI Merchant Assistant', 'Review Analysis', 'GenUI', 'AI产品设计原则'];

  const wallItems = [];
  for (const entry of contentData) {
    if (entry.atom === 'photo' && entry.cover_image) {
      const pc = photoCaptions[entry.title] || { caption: entry.title, date: '' };
      wallItems.push({
        type: 'photo',
        category: entry.category,
        src: entry.cover_image,
        caption: pc.caption,
        date: pc.date,
        focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
      });
    } else if (entry.atom === 'sticky') {
      wallItems.push({
        type: 'sticky',
        category: entry.category,
        title: t(entry, 'title') || entry.title,
        body: t(entry, 'body') || entry.body || '',
        date: entry.title === 'GenUI' ? "'26 04 20" : entry.title === 'AI产品设计原则' ? "'26 03 15" : "'26 05 01",
        stampSrc: stampOverrides[entry.title] || entry.cover_image || 'stamp1.webp',
        colorScheme: coolStickies.includes(entry.title) ? 'cool' : 'warm',
        focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
      });
    }
  }

  // ─── Scale factor for non-photo atoms ───
  const cols = W < 600 ? 1 : W < 1024 ? 2 : W < 1600 ? 3 : 4;
  const colW = W / cols;
  const atomScale = colW / 480;

  // ─── Grid config ───
  const gridPad = colW * 0.216;

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app, contentData, LANG);

  setProgress(15);

  // ─── Step 1: Parallel preload all images, then render sequentially ───
  const rendered = []; // { group, bounds, wallItem, focusableItem }
  const totalItems = wallItems.length;

  // Phase 1: Preload all images in parallel
  // Note: photos don't use maxWidth here — addPhoto loads its own texture internally,
  // we only need the original dimensions to calculate photoScale correctly.
  const preloads = wallItems.map(item => {
    if (item.type === 'photo') return loadImagePixels(item.src);
    if (item.type === 'sticky' && item.stampSrc) return loadImagePixels(item.stampSrc, isMobile ? 400 : undefined);
    if (item.type === 'stamp') return loadImagePixels(item.src, isMobile ? 400 : undefined);
    return null;
  });
  setProgress(20);
  const preloaded = await Promise.all(preloads);
  setProgress(50);

  // Phase 2: Render sequentially (PIXI requires ordered operations)
  for (let i = 0; i < wallItems.length; i++) {
    const item = wallItems[i];
    const imgData = preloaded[i];
    if (item.type === 'photo') {
      const targetW = colW * 0.6;
      const photoScale = targetW / imgData.w;
      const photoItem = await photoSystem.addPhoto(item.src, 0, 0, photoScale, item);
      photoItem.videoSrc = item.src.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4');
      getOrCreateVideo(photoItem.videoSrc);
      if (item.focus) photoItem.focusData = item.focus;
      const b = photoItem.group.getBounds();
      rendered.push({ group: photoItem.group, bounds: b, wallItem: item, focusableItem: photoItem });
    } else if (item.type === 'sticky') {
      const stickyResult = await renderStickyNote(app, 0, 0, { title: item.title, body: item.body, date: item.date }, imgData, atomsConfig.stamp, { colorScheme: item.colorScheme });
      stickyResult.group.scale.set(atomScale);
      const b = stickyResult.group.getBounds();
      const stickyItem = photoSystem.addItem(stickyResult.group, b.width / atomScale, b.height / atomScale);
      if (item.focus) stickyItem.focusData = item.focus;
      stickyItem._stickyTitle = { tx: stickyResult.titleX, ty: stickyResult.titleY, tw: stickyResult.titleW, th: stickyResult.titleH };
      rendered.push({ group: stickyResult.group, bounds: b, wallItem: item, focusableItem: stickyItem });
    } else if (item.type === 'stamp') {
      const stampResult = await renderStamp(app, imgData, 0, 0, atomsConfig.stamp);
      stampResult.group.scale.set(atomScale);
      const b = stampResult.group.getBounds();
      photoSystem.addItem(stampResult.group, stampResult.stampW, stampResult.stampH);
      rendered.push({ group: stampResult.group, bounds: b, wallItem: item, focusableItem: null });
    }
    setProgress(50 + ((i + 1) / totalItems) * 40);
  }

  // ─── Step 2: Masonry layout using actual bounds ───
  const colTops = new Array(cols).fill(gridPad);
  const renderedItems = [];

  for (const r of rendered) {
    const col = colTops.indexOf(Math.min(...colTops));
    const colCenterX = (col + 0.5) * colW;
    const boundsW = r.bounds.width;
    const boundsH = r.bounds.height;

    // 元素中心对齐到列中心：
    // group.x 需要设成什么值，才能让 bounds 水平居中于 colCenterX？
    // bounds.x = group.x + (bounds.x - oldGroup.x)，即 bounds 左边缘相对于 group 有固定偏移
    const offsetX = r.bounds.x - r.group.x; // bounds 左边缘相对于 group.x 的偏移
    const offsetY = r.bounds.y - r.group.y; // bounds 上边缘相对于 group.y 的偏移

    r.group.x = colCenterX - boundsW / 2 - offsetX;
    r.group.y = colTops[col] - offsetY;

    colTops[col] += boundsH + gridPad;

    if (r.focusableItem) renderedItems.push({ wallItem: r.wallItem, focusableItem: r.focusableItem });
  }

  // Save initial positions for shuffle reset
  for (const r of rendered) {
    r.initX = r.group.x;
    r.initY = r.group.y;
  }

  // ─── Tear-off card (DOM overlay) ───
  const tearoffPrompts = [
    { label: 'Context', text: 'Jesse Lai is a product designer at Microsoft AI with 6+ years of experience. He designs AI-native interfaces.' },
    { label: 'Style', text: 'Jesse values organic, dynamic design. His portfolio uses PixiJS particles and hand-drawn aesthetics.' },
    { label: 'Projects', text: 'Key projects: Food Delivery Service (Eleme), AI Merchant Assistant, GenUI framework, Review Analysis.' },
    { label: 'Contact', text: 'Visit jesselai.com to see interactive portfolio. Ask about GenUI or AI product design.' },
    { label: 'Collab', text: 'Jesse explores AI-native design patterns. He calls it GenUI — generative UI that replaces text-only AI.' },
  ];
  {
    const tearCol = colTops.indexOf(Math.min(...colTops));
    const tearX = (tearCol + 0.5) * colW;
    const tearW = 220 * atomScale;
    const tearY = colTops[tearCol];

    // Generate tear edges
    function genTearEdge(steps = 12) {
      const pts = [];
      for (let i = 0; i <= steps; i++) pts.push({ x: (i / steps) * 100, y: 30 + Math.random() * 70 });
      return pts;
    }
    function stripClipPath(tearPts, tearH) {
      const top = tearPts.map(p => `${p.x}% ${(p.y / 100) * tearH}px`);
      return `polygon(${top.join(', ')}, 100% 100%, 0% 100%)`;
    }
    function stubClipPath(tearPts) {
      const bottom = [...tearPts].reverse().map(p => `${p.x}% ${p.y}%`);
      return `polygon(0% 0%, 100% 0%, ${bottom.join(', ')})`;
    }
    const tearH = 10;

    const card = document.createElement('div');
    const cardBaseW = 280;
    card.style.cssText = `position:absolute;z-index:2;pointer-events:auto;font-family:Red Hat Mono,monospace;filter:drop-shadow(3px 3px 0px rgba(0,0,0,0.12));display:flex;flex-direction:column;cursor:grab;`;
    card.style.width = cardBaseW + 'px';
    card.style.transform = `scale(${atomScale})`;
    card.style.transformOrigin = 'top left';
    card.style.left = `${tearX - (cardBaseW * atomScale) / 2}px`;
    card.style.top = `${tearY}px`;

    const cardBody = document.createElement('div');
    cardBody.style.cssText = 'background:#fff;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-radius:2px 2px 0 0;min-height:150px;position:relative;';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Special Elite,cursive;font-size:16px;color:#1a1a1a;text-align:center;line-height:1.3;display:inline-block;';
    titleEl.innerHTML = 'Grab a strip<br>for your agent';
    const subtitleEl = document.createElement('div');
    subtitleEl.style.cssText = 'font-size:10px;color:#999;text-align:center;letter-spacing:0.5px;';
    subtitleEl.textContent = 'A secret key designed for agents';
    cardBody.appendChild(titleEl);
    cardBody.appendChild(subtitleEl);
    card.appendChild(cardBody);

    // Hand-drawn circle on title — triggered on hover
    titleEl.style.position = 'relative';
    let circleSvg = null;
    cardBody.addEventListener('mouseenter', () => {
      if (circleSvg) return;
      const svgNS = 'http://www.w3.org/2000/svg';
      const w = titleEl.offsetWidth + 16, h = titleEl.offsetHeight + 12;
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;overflow:visible;`;
      const cx = w/2, cy = h/2, rx = w/2 - 2, ry = h/2 - 2;
      // Hand-drawn ellipse via rough path with slight randomness
      const pts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.3; a += 0.15) {
        const jx = (Math.random() - 0.5) * 2.5, jy = (Math.random() - 0.5) * 2.5;
        pts.push(`${cx + rx * Math.cos(a) + jx},${cy + ry * Math.sin(a) + jy}`);
      }
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M${pts[0]} C${pts.slice(1).join(' ')}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(0,0,0,0.35)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.style.animation = 'rough-draw 0.8s ease forwards';
      titleEl.appendChild(svg);
      circleSvg = svg;
    });
    cardBody.addEventListener('mouseleave', () => {
      if (circleSvg) { circleSvg.remove(); circleSvg = null; }
    });

    const jointsEl = document.createElement('div');
    jointsEl.style.cssText = `display:flex;width:${cardBaseW}px;margin-top:-1px;`;
    card.appendChild(jointsEl);

    const stripsEl = document.createElement('div');
    stripsEl.style.cssText = `display:flex;width:${cardBaseW}px;margin-top:-1px;`;
    card.appendChild(stripsEl);

    // Toast
    const toast = document.createElement('div');
    toast.style.cssText = 'position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;font-size:11px;padding:6px 14px;border-radius:4px;pointer-events:none;opacity:0;transition:opacity 0.3s;white-space:nowrap;';
    card.appendChild(toast);

    // Drag
    let dragOff = null;
    cardBody.addEventListener('mousedown', e => {
      const rect = card.getBoundingClientRect();
      dragOff = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      card.style.cursor = 'grabbing';
      card.style.zIndex = '100';
    });
    window.addEventListener('mousemove', e => {
      if (!dragOff) return;
      card.style.left = (e.clientX - dragOff.x) + 'px';
      card.style.top = (e.clientY + window.scrollY - dragOff.y) + 'px';
      card.style.transform = `scale(${atomScale})`;
    });
    window.addEventListener('mouseup', () => {
      if (!dragOff) return;
      dragOff = null;
      card.style.cursor = 'grab';
      card.style.zIndex = '2';
    });

    // SVG doodle paths (hand-drawn style via slight jitter)
    const doodlePaths = [
      // Cat
      'M20 10 C14 10 8 15 8 21 C8 27 14 32 20 32 C26 32 32 27 32 21 C32 15 26 10 20 10Z M12 12 L9 5 L16 10 M28 12 L31 5 L24 10 M16 19 L16 20 M24 19 L24 20 M20 23 L18 25 M20 23 L22 25',
      // Star
      'M20 6 L23 15 L33 15 L25 21 L28 31 L20 25 L12 31 L15 21 L7 15 L17 15 Z',
      // Heart
      'M20 32 C20 32 6 23 6 14 C6 8 11 5 15 8 C18 10 20 14 20 14 C20 14 22 10 25 8 C29 5 34 8 34 14 C34 23 20 32 20 32Z',
      // Music note
      'M15 8 L15 28 C15 31 11 33 9 31 C7 29 9 26 12 26 C13 26 14 27 15 28 M15 8 L29 5 L29 25 C29 28 25 30 23 28 C21 26 23 23 26 23 C27 23 28 24 29 25',
      // Fish
      'M7 20 C7 14 13 10 20 10 C27 10 33 14 33 20 C33 26 27 30 20 30 C13 30 7 26 7 20Z M33 20 L39 14 L39 26 Z M14 18 C14 17 15 17 15 18 C15 19 14 19 14 18',
    ];

    // Create SVG doodle with stroke-dashoffset draw animation
    function createDoodleSVG(pathData) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '40'); svg.setAttribute('height', '40');
      svg.setAttribute('viewBox', '0 0 40 40');
      svg.style.cssText = 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);writing-mode:horizontal-tb;pointer-events:none;overflow:visible;';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#999');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.style.animation = 'rough-draw 0.6s ease forwards';
      return svg;
    }

    let doodleIdx = 0;
    for (const p of tearoffPrompts) {
      const tearEdge = genTearEdge();
      const myDoodlePath = doodlePaths[doodleIdx % doodlePaths.length];
      doodleIdx++;

      const joint = document.createElement('div');
      const stripW = cardBaseW / tearoffPrompts.length;
      joint.style.cssText = `width:${stripW}px;flex-shrink:0;height:12px;background:#fff;`;
      jointsEl.appendChild(joint);

      const strip = document.createElement('div');
      strip.style.cssText = `background:#fff;background-clip:padding-box;border-left:2px dotted #ddd;width:${stripW}px;flex-shrink:0;box-sizing:border-box;text-align:center;padding:12px 2px;cursor:pointer;position:relative;writing-mode:vertical-rl;text-orientation:mixed;font-size:9px;color:#666;letter-spacing:0.3px;line-height:1.3;min-height:100px;transition:transform 0.3s ease,filter 0.3s ease;overflow:hidden;`;
      strip.textContent = p.label;

      let doodleSvg = null;
      strip.addEventListener('mouseenter', () => {
        if (strip.dataset.torn) return;
        strip.style.clipPath = stripClipPath(tearEdge, tearH);
        joint.style.clipPath = stubClipPath(tearEdge);
        strip.style.transform = 'translateY(8px)';
        strip.style.filter = 'drop-shadow(1px 2px 3px rgba(0,0,0,0.15))';
        strip.style.zIndex = '10';
        // Draw rough doodle with stroke animation
        if (!doodleSvg) {
          doodleSvg = createDoodleSVG(myDoodlePath);
          strip.appendChild(doodleSvg);
        }
      });
      strip.addEventListener('mouseleave', () => {
        if (strip.dataset.torn) return;
        // Remove doodle
        if (doodleSvg) { doodleSvg.remove(); doodleSvg = null; }
        strip.style.transform = '';
        strip.style.filter = '';
        strip.style.zIndex = '';
        // Wait for transition to finish before removing tear edges
        strip.addEventListener('transitionend', function once() {
          strip.removeEventListener('transitionend', once);
          if (!strip.matches(':hover') && !strip.dataset.torn) {
            strip.style.clipPath = '';
            joint.style.clipPath = '';
          }
        });
      });
      strip.addEventListener('click', () => {
        if (strip.dataset.torn) return;
        strip.dataset.torn = '1';
        strip.style.clipPath = stripClipPath(tearEdge, tearH);
        joint.style.clipPath = stubClipPath(tearEdge);
        navigator.clipboard.writeText(p.text).catch(() => {});
        strip.style.animation = 'tearoff 0.6s ease-out both';
        strip.style.transformOrigin = '50% 0%';
        strip.style.zIndex = '10';
        strip.style.filter = 'drop-shadow(1px 2px 3px rgba(0,0,0,0.2))';
        toast.textContent = 'Copied! Paste to your AI →';
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 1500);
        setTimeout(() => {
          strip.style.visibility = 'hidden';
          const title = cardBody.querySelector('div');
          title.innerHTML = 'Ripped! Now paste<br>to your AI';
          cardBody.querySelectorAll('div')[1].textContent = 'Ask anything about me — your agent will know';
        }, 600);
      });
      stripsEl.appendChild(strip);
    }
    stripsEl.querySelector('div').style.borderLeft = 'none';

    document.body.appendChild(card);
    const cardH = cardBaseW * 1.1 * atomScale; // approximate height
    colTops[tearCol] += cardH + gridPad;
  }

  // 如果内容超过视口高度，扩展 canvas
  const totalH = Math.max(...colTops) + gridPad + 80; // +80 for chat bar
  const contentH = Math.max(totalH, H); // Save for resize handler
  app.renderer.resize(W, Math.max(totalH, H));
  app.canvas.style.height = Math.max(totalH, H) + 'px';
  if (totalH > H) {
    document.body.style.overflowY = 'auto';
    app.canvas.style.touchAction = 'pan-y';
  }

  // 注册所有有文章的 wall items，供 chat 推荐使用
  for (const { wallItem, focusableItem } of renderedItems) {
    if (wallItem.focus?.article && focusableItem) {
      const key = wallItem.src || wallItem.title;
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
    }
  }
  photoSystem.onFocus = (item) => focusOverlay.open(item);

  // ─── Reveal: hide loading, show canvas ───
  setProgress(100);
  app.stage.visible = true;
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
    }, 300);
  }

  // ─── Mobile scroll hover for clip labels ───
  if ('ontouchstart' in window) photoSystem.setupMobileScrollHover();

  // ─── Wall Article (composer + AI narrative) ───
  const wallArticle = new WallArticle(focusOverlay, contentData, LANG);
  wallArticle.setupComposer();
  // Update composer placeholder for language
  const wcTextarea = document.querySelector('#wall-composer textarea');
  if (wcTextarea) wcTextarea.placeholder = LANG === 'zh' ? '问Jesse任何问题...' : 'Ask Jesse anything...';

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

    // Group items by category
    const categories = ['who_i_am', 'design_projects', 'design_thought', 'hobby'];
    const groups = {};
    for (const cat of categories) groups[cat] = [];
    for (const r of rendered) {
      const cat = r.wallItem.category;
      if (groups[cat]) groups[cat].push(r);
    }

    // Refresh bounds (items may have been moved by masonry or dragged)
    for (const r of rendered) r.bounds = r.group.getBounds();

    // Pre-compute final masonry positions for each category group / single
    const colTopsNew = new Array(cols).fill(gridPad);
    const catLayout = {}; // cat -> { targetX, targetY } for the first item's top-left

    // First pass: compute each group's bounding size and assign masonry slot
    for (const cat of categories) {
      const items = groups[cat];
      if (!items.length) continue;
      // Use first item's bounds as representative size
      const b0 = items[0].group.getBounds();
      const col = colTopsNew.indexOf(Math.min(...colTopsNew));
      const colCenterX = (col + 0.5) * colW;
      catLayout[cat] = {
        targetX: colCenterX - b0.width / 2,
        targetY: colTopsNew[col],
        boundsOffX: b0.x - items[0].group.x,
        boundsOffY: b0.y - items[0].group.y,
      };
      colTopsNew[col] += b0.height + gridPad;
    }

    // Sort each category: largest item area first (bottom of stack), smallest on top
    // Use itemW * itemH (photo = frame size, sticky = note body) not getBounds (includes shadow/stamp overflow)
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

    // Fly ALL items directly to final position
    const allFlyAnims = [];
    for (const cat of categories) {
      const items = groups[cat];
      if (!items.length || !catLayout[cat]) continue;
      const layout = catLayout[cat];
      // First item (largest) flies to the masonry slot
      const target0 = items[0];
      const tx0 = layout.targetX - layout.boundsOffX;
      const ty0 = layout.targetY - layout.boundsOffY;
      allFlyAnims.push(animateTo(target0.group, tx0, ty0, 600));
      // Other items (progressively smaller) fly to same position
      for (let i = 1; i < items.length; i++) {
        const r = items[i];
        const tx = layout.targetX - (r.bounds.x - r.group.x);
        const ty = layout.targetY - (r.bounds.y - r.group.y);
        allFlyAnims.push(animateTo(r.group, tx, ty, 600));
      }
    }
    await Promise.all(allFlyAnims);

    // Merge groups and assign predefined labels
    const categoryLabels = {
      who_i_am: 'About Me',
      design_projects: 'Design Work',
      design_thought: 'Design Thinking',
      hobby: 'Life & Hobbies',
    };
    await Promise.all(categories.map(async cat => {
      const items = groups[cat];
      if (items.length < 2) return;
      const target = items[0];
      for (let i = 1; i < items.length; i++) {
        await photoSystem._mergePhotos(items[i].focusableItem, target.focusableItem);
      }
      // Set predefined label on the newly created clip group
      const cg = photoSystem.clipGroups.find(c => c.photos.includes(target.focusableItem));
      if (cg) cg.label = categoryLabels[cat] || cat;
    }));

    // Resize canvas if needed
    const newH = Math.max(...colTopsNew) + gridPad;
    app.renderer.resize(W, Math.max(newH, window.innerHeight)); app.canvas.style.height = Math.max(newH, window.innerHeight) + "px";
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
    app.renderer.resize(W, Math.max(totalH, window.innerHeight)); app.canvas.style.height = Math.max(totalH, window.innerHeight) + "px";
  }

  // Wire buttons
  document.getElementById('organize-btn')?.addEventListener('click', () => {
    organizeByCategory();
  });
  document.getElementById('shuffle-btn')?.addEventListener('click', () => {
    shuffleToInitial();
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

    const bgStops = [
      [0, '#F6F3EE'], [0.5, '#FCCC83'], [1.0, '#DB7A2A']
    ];

    // Sunlight overlay elements (null on mobile — removed from DOM)
    const perspective = document.querySelector('#sunlight-overlay .perspective');
    const shuttersEl = document.querySelector('#sunlight-overlay .shutters');
    const shutterEls = document.querySelectorAll('#sunlight-overlay .shutter');
    const root = document.documentElement;

    const updateSunProgress = () => {
      const scrollY = window.scrollY || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, scrollY / maxScroll));

      // Background color
      app.renderer.background.color = lerpColorStops(p, bgStops);

      // Perspective: opacity + angle shift with scroll
      if (perspective) {
        perspective.style.opacity = lerp(0.12, 0.3, p);
        const m00 = lerp(0.75, 0.8333, p);
        const m01 = lerp(-0.0625, 0.0833, p);
        const m03 = lerp(0.0008, 0.0003, p);
        perspective.style.transform = `matrix3d(${m00},${m01},0,${m03}, 0,1,0,0, 0,0,1,0, 0,0,0,1)`;
      }

      // Blinds: gap shrinks, shutters grow as you scroll down
      if (shuttersEl) shuttersEl.style.gap = lerp(42, 14, p) + 'px';
      shutterEls.forEach(s => s.style.height = lerp(28, 60, p) + 'px');

      // Shadow & bounce light colors
      root.style.setProperty('--shadow', lerpColorStops(p, [[0, '#1a1917'], [1, '#030307']]));
    };

    window.addEventListener('scroll', updateSunProgress, { passive: true });
    updateSunProgress();
  }
})();
