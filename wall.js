// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, makeDraggable, FocusOverlay, getOrCreateVideo } from "./atoms-renderer.js?v=151";
import { WallArticle } from "./wall-article.js?v=151";

(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, antialias: true, resolution: dpr, autoDensity: true, backgroundColor: 0x0a0a0a });
  document.body.appendChild(app.canvas);
  app.canvas.style.touchAction = "pan-y";
  app.stage.sortableChildren = true;

  const configResp = await fetch('atoms-config.json');
  const atomsConfig = await configResp.json();
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

  // ─── Language ───
  const LANG = localStorage.getItem('wall-lang') || 'en';

  // Bilingual overrides: keyed by original title
  const i18n = {
    'Hello I\'m Jesse Lai':  { zh: { title: '你好，我是Jesse Lai', body: '微软AI产品设计师，探索人与AI自然交互的未来。' } },
    'Resume':                { zh: { title: '简历', body: '微软AI产品设计师，6年以上AI产品设计经验，涵盖B2C和B2B。' } },
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
    'GenUI': 'photo_stamp.png',
    'Resume': 'resume.png',
    'Food Delivery Service': 'photo_ski.png',
    'AI Merchant Assistant': 'AI-Merchant-Assistant.png',
    'Review Analysis': 'review.png',
  };

  const coolStickies = ['AI Merchant Assistant', 'Review Analysis', 'GenUI', 'AI产品设计原则'];

  const wallItems = [];
  for (const entry of contentData) {
    if (entry.atom === 'photo' && entry.cover_image) {
      const pc = photoCaptions[entry.title] || { caption: entry.title, date: '' };
      wallItems.push({
        type: 'photo',
        src: entry.cover_image,
        caption: pc.caption,
        date: pc.date,
        focus: entry.focus || { title: entry.title, description: entry.body || entry.title, link: '#', linkText: 'Read more', article: { title: entry.title, sections: (entry.full_text || []).map(t => ({type:'text',text:t})) } },
      });
    } else if (entry.atom === 'sticky') {
      wallItems.push({
        type: 'sticky',
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
  const gridPad = colW * 0.12;

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app, contentData, LANG);

  // ─── Step 1: Render all items at (0,0) to get actual bounds ───
  const rendered = []; // { group, bounds, wallItem, focusableItem }
  for (const item of wallItems) {
    if (item.type === 'photo') {
      const imgData = await loadImagePixels(item.src);
      const targetW = colW * 0.6;
      const photoScale = targetW / imgData.w;
      const photoItem = await photoSystem.addPhoto(item.src, 0, 0, photoScale, item);
      photoItem.videoSrc = item.src.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4');
      getOrCreateVideo(photoItem.videoSrc);
      if (item.focus) photoItem.focusData = item.focus;
      const b = photoItem.group.getBounds();
      rendered.push({ group: photoItem.group, bounds: b, wallItem: item, focusableItem: photoItem });
    } else if (item.type === 'sticky') {
      const stickyStampImg = item.stampSrc ? await loadImagePixels(item.stampSrc) : null;
      const stickyResult = await renderStickyNote(app, 0, 0, { title: item.title, body: item.body, date: item.date }, stickyStampImg, atomsConfig.stamp, { colorScheme: item.colorScheme });
      stickyResult.group.scale.set(atomScale);
      const b = stickyResult.group.getBounds();
      const stickyItem = photoSystem.addItem(stickyResult.group, b.width / atomScale, b.height / atomScale);
      if (item.focus) stickyItem.focusData = item.focus;
      rendered.push({ group: stickyResult.group, bounds: b, wallItem: item, focusableItem: stickyItem });
    } else if (item.type === 'stamp') {
      const stampImg = await loadImagePixels(item.src);
      const stampResult = await renderStamp(app, stampImg, 0, 0, atomsConfig.stamp);
      stampResult.group.scale.set(atomScale);
      const b = stampResult.group.getBounds();
      photoSystem.addItem(stampResult.group, stampResult.stampW, stampResult.stampH);
      rendered.push({ group: stampResult.group, bounds: b, wallItem: item, focusableItem: null });
    }
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

  // 如果内容超过视口高度，扩展 canvas
  const totalH = Math.max(...colTops) + gridPad;
  if (totalH > H) {
    app.renderer.resize(W, totalH);
    document.body.style.overflow = 'auto';
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

  // ─── Wall Article (composer + AI narrative) ───
  const wallArticle = new WallArticle(focusOverlay, contentData, LANG);
  wallArticle.setupComposer();
  // Update composer placeholder for language
  const wcTextarea = document.querySelector('#wall-composer textarea');
  if (wcTextarea) wcTextarea.placeholder = LANG === 'zh' ? '问我任何关于Jesse的问题...' : 'Ask me anything about Jesse...';

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
    const newH = window.innerHeight;
    app.renderer.resize(newW, newH);
  });

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt=Math.min(ticker.deltaMS/1000,0.05);
  });
})();
