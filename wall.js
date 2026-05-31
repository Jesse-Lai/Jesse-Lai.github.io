// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, renderTearoffCard, makeDraggable, FocusOverlay, getOrCreateVideo, animateTo, fadeIn } from "./atoms-renderer.js?v=191";
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

  // Language toggle
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = LANG === 'zh' ? 'EN' : '中';
  window._toggleLang = () => {
    const next = (localStorage.getItem('wall-lang') || 'en') === 'en' ? 'zh' : 'en';
    localStorage.setItem('wall-lang', next);
    location.reload();
  };

  // Apply Chinese fonts when in zh mode
  if (LANG === 'zh') {
    document.documentElement.style.setProperty('--title-font', '"Optima", "PingFang SC", sans-serif');
    document.documentElement.style.setProperty('--body-font', '"Optima", "PingFang SC", sans-serif');
  } else {
    document.documentElement.style.setProperty('--title-font', '"Special Elite", cursive');
    document.documentElement.style.setProperty('--body-font', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
  }

  // Bilingual overrides: keyed by original title
  const i18n = {
    'Hello I\'m Jesse Lai':  { zh: { title: '你好，我是Jesse Lai', body: '微软AI产品设计师，探索人与AI自然交互的未来。' } },
    'Microsoft':             { zh: { title: 'Microsoft', body: 'AI builder at Microsoft' } },
    'Alibaba':               { zh: { title: 'Alibaba', body: '构建AI产品，帮助本地生活服务用户' } },
    'Stand-up Comedian':     { zh: { title: '脱口秀演员', body: '脱口秀是我一生的热爱。把生活的酸甜苦辣变成段子搬上舞台，已经成为我生活不可分割的一部分。' } },
    'Drawing':               { zh: { title: '画画', body: '即将推出' } },
    'Vibe Coding':           { zh: { title: 'Vibe Coding', body: 'Vibe Coding项目合集——用代码构建创意工具和交互体验。' } },
    'Arduino Light':         { zh: { title: 'Arduino交互灯', body: '用Arduino打造的交互灯——硬件与创意的融合。' } },
    'GenUI':                 { en: { title: 'GenUI', body: 'In the AI era, our interaction experiences have regressed — from rich GUIs back to text-based chat. GenUI explores AI-generated interfaces that match the shape of information.' } },
    'AI产品设计原则':          { en: { title: 'AI Design Principles', body: 'A growing collection of AI product design principles, drawing from industry leaders and my own practice.' } },
    'Vibe Coding':           { en: { title: 'Vibe Coding', body: 'A collection of vibe coding projects — building creative tools and interactive experiences with code.' } },
    'Arduino Light':         { en: { title: 'Arduino Light', body: 'An interactive light built with Arduino — merging hardware and creativity.' } },
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
    'Drawing':              { caption: 'Drawing', date: "'25 08 10" },
    'Vibe Coding':          { caption: 'Vibe Coding', date: "'26 05 01" },
    'Arduino Light':        { caption: 'Arduino Light', date: "'26 04 15" },
  };

  // Stamp image overrides
  const stampOverrides = {
    'GenUI': 'genui.webp',
    'AI产品设计原则': 'aidesign.webp',
    'Microsoft': 'Microsoft.webp',
    'Alibaba': 'alibaba.webp',
  };

  const coolStickies = ['Alibaba', 'GenUI', 'AI产品设计原则'];

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
        keywords: entry.keywords, focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
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
        keywords: entry.keywords, focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
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
  const itemGap = isMobile ? gridPad * 1.8 : gridPad;

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
      // Mobile: prefetch first video as blob so it can play without user interaction
      if (isMobile && !window._firstVideoPrefetched) {
        window._firstVideoPrefetched = true;
        fetch(photoItem.videoSrc).then(r => r.blob()).then(blob => {
          window._firstVideoBlob = { src: photoItem.videoSrc, url: URL.createObjectURL(blob) };
        }).catch(() => {});
      }
      if (item.focus) { photoItem.focusData = item.focus; if (item.keywords) photoItem.focusData.description = item.keywords; }
      const b = photoItem.group.getBounds();
      rendered.push({ group: photoItem.group, bounds: b, wallItem: item, focusableItem: photoItem });
    } else if (item.type === 'sticky') {
      const stickyResult = await renderStickyNote(app, 0, 0, { title: item.title, body: item.body, date: item.date }, imgData, atomsConfig.stamp, { colorScheme: item.colorScheme });
      stickyResult.group.scale.set(atomScale);
      const b = stickyResult.group.getBounds();
      const stickyItem = photoSystem.addItem(stickyResult.group, b.width / atomScale, b.height / atomScale);
      if (item.focus) { stickyItem.focusData = item.focus; if (item.keywords) stickyItem.focusData.description = item.keywords; }
      stickyItem._stickyTitle = { tx: stickyResult.titleX, ty: stickyResult.titleY, tw: stickyResult.titleW, th: stickyResult.titleH };
      // Stamp video: swap stamp sprite texture on hover
      if (stickyResult.stampSprite && item.stampSrc) {
        const videoSrc = item.stampSrc.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4');
        stickyItem.videoSrc = videoSrc;
        stickyItem.sprite = stickyResult.stampSprite;
        getOrCreateVideo(videoSrc);
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

  // Save initial positions for shuffle reset
  for (const r of rendered) {
    r.initX = r.group.x;
    r.initY = r.group.y;
  }

  const totalH = Math.max(...colTops) + itemGap + 160; // extra padding for chat bar + tearoff strips
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
      const key = wallItem.title;
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
      const colCenterX = gridOffsetX + (col + 0.5) * colW;
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
    document.getElementById('shuffle-btn')?.classList.add('visible');
  });
  document.getElementById('shuffle-btn')?.addEventListener('click', () => {
    shuffleToInitial();
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
      [6,  '#F6F3EE', '#F8F3E3'],  // morning 6-12
      [12, '#FFFAF2', '#E8CDA3'],  // afternoon 12-18
      [18, '#FCCC83', '#E79648'],  // dusk 18-20
      [20, '#241F44', '#040B24'],  // night 20-6
      [30, '#241F44', '#040B24'],  // night wrap
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
    const autoHour = (() => { const h = new Date().getHours(); return h >= 20 || h < 6 ? 22 : h >= 18 ? 18 : h >= 12 ? 15 : 9; })();
    let timeOverride = autoHour;
    let currentBgColors = getTimeColors(timeOverride);

    // Sunlight overlay elements (null on mobile — removed from DOM)
    const nightGradient = document.getElementById('night-gradient');
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
      app.renderer.background.color = lerpHex(currentBgColors.top, currentBgColors.bottom, p);

      const [cr,cg,cb] = hexToRgb(currentBgColors.top);
      const brightness = (cr + cg + cb) / 3;

      // Right-to-left gradient overlay — stronger at night
      if (nightGradient) {
        const gradAlpha = brightness < 80 ? 0.3 : 0.25;
        nightGradient.style.background = `linear-gradient(to left, rgba(0,0,0,${gradAlpha}) 0%, rgba(0,0,0,0) 50%)`;
      }

      // Perspective: opacity + angle shift with scroll
      if (perspective) {
        const isNight = brightness < 80;
        perspective.style.opacity = isNight ? lerp(0.16, 0.4, p) : lerp(0.12, 0.3, p);
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

      // Hover label color — light on dark backgrounds, dark on light
      photoSystem._labelColor = brightness > 160 ? '#000000' : 'rgba(255,255,255,0.85)';

      // Update UI button colors based on background brightness
      const btnColor = brightness > 160 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
      const btnHover = brightness > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
      const atomsBtn = document.getElementById('atoms-btn');
      const timeBtn = document.getElementById('time-preview');
      const langBtn = document.getElementById('lang-toggle');
      [atomsBtn, timeBtn, langBtn].forEach(el => {
        if (el) { el.style.color = btnColor; el.onmouseenter = () => el.style.color = btnHover; el.onmouseleave = () => el.style.color = btnColor; }
      });
    };

    window.addEventListener('scroll', updateSunProgress, { passive: true });
    updateSunProgress();

    // Expose time preview control
    window._setTimePreview = (hour) => {
      timeOverride = hour;
      currentBgColors = getTimeColors(timeOverride);
      updateSunProgress();
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
      if (cur) photoSystem._showHoverLabel(cur);
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
        // Use blob URL for first video if available
        const blob = window._firstVideoBlob && window._firstVideoBlob.src === cur.videoSrc ? window._firstVideoBlob : null;
        if (blob && !entry.ready) entry.video.src = blob.url;
        // Try to play (works after first user touch on iOS)
        entry.video.currentTime = 0;
        entry.video.play().then(() => {
          if (!entry.texture) {
            entry.texture = PIXI.Texture.from(entry.video, { resourceOptions: { autoPlay: false } });
            entry.ready = true;
          }
          cur._staticTex = cur._staticTex || cur.sprite.texture;
          cur.sprite.texture = entry.texture;
          // After first successful play, fetch all other videos as blobs
          if (!window._videosLoading) {
            window._videosLoading = true;
            snapTargets.forEach(t => {
              if (t.item && t.item.videoSrc && t.item !== cur) {
                const e = getOrCreateVideo(t.item.videoSrc);
                if (!e.ready) {
                  fetch(t.item.videoSrc).then(r => r.blob()).then(blob => {
                    e.video.src = URL.createObjectURL(blob);
                    e.video.load();
                  }).catch(() => {});
                }
              }
            });
          }
        }).catch(() => {});
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

    // Initial snap (no video on first load — iOS requires user interaction)
    scrollToIdx(0);
    


    // Block native scroll completely — JS controls position
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    // Detect swipe direction on touchend
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
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
