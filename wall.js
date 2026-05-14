// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, makeDraggable, FocusOverlay, getOrCreateVideo } from "./atoms-renderer.js?v=143";

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

  const photoConfigs = [
    { src: 'photo_flowers.png', caption: 'Wildflowers', date: "'25 05 10",
      focus: { title: 'Wildflowers', description: 'Spring wildflowers along the mountain trail. Shot during a weekend hike in Yunnan.', link: '#', linkText: 'View story',
        article: { title: 'Wildflowers in Yunnan', sections: [
          { type: 'text', text: 'There is a trail in northern Yunnan that only exists for two weeks each spring. The snow melts, the soil softens, and then — almost overnight — the entire mountainside erupts in color.' },
          { type: 'subtitle', text: 'The Hike' },
          { type: 'text', text: 'We started at dawn from a small village at 3,200 meters. The air was thin and cold, but the light was extraordinary — that golden, low-angle light that makes everything look like a painting.' },
          { type: 'image', src: 'photo_flowers.png', caption: 'Morning light on the wildflower trail' },
          { type: 'text', text: 'By midday we had climbed another 600 meters. The flowers changed with altitude — first poppies and primroses, then gentians and rhododendrons, and finally, near the ridgeline, tiny alpine blooms I couldn\'t name.' },
          { type: 'subtitle', text: 'What I Learned' },
          { type: 'text', text: 'Photography in the mountains teaches patience. You wait for the cloud to pass, for the wind to still, for the light to shift. The best shots are never the ones you plan — they\'re the ones the mountain gives you.' },
        ]}}},
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08",
      focus: { title: 'Avalanche!', description: 'Caught an avalanche on camera while backcountry skiing in Hokkaido.', link: '#', linkText: 'View story',
        article: { title: 'Avalanche in Hokkaido', sections: [
          { type: 'text', text: 'Hokkaido in February is a different planet. The snow falls sideways, the trees are ghosts, and the backcountry is as quiet as outer space — until it isn\'t.' },
          { type: 'subtitle', text: 'The Moment' },
          { type: 'text', text: 'We were traversing a ridge when we heard it. Not a crack, not a boom — more like a deep exhale. The entire slope below us started to move.' },
          { type: 'image', src: 'photo_avalanche.png', caption: 'The slide, moments after release' },
          { type: 'text', text: 'I had maybe three seconds to react. Instinct said run. Training said document. I held the camera steady for two shots, then we moved laterally along the ridge. The slide passed 200 meters below us.' },
          { type: 'subtitle', text: 'Respect the Mountain' },
          { type: 'text', text: 'Backcountry skiing is a negotiation with risk. You study the snowpack, read the terrain, check the forecast — and still, the mountain can surprise you. That\'s the deal.' },
        ]}}},
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15",
      focus: { title: 'Big catch!', description: 'First time catching a yellowtail off the coast. A perfect summer day on the water.', link: '#', linkText: 'View story',
        article: { title: 'First Yellowtail', sections: [
          { type: 'text', text: 'I\'d been on boats before but never with a rod in my hand and serious intent. My friend said: "You either love fishing or you don\'t. There\'s no middle ground."' },
          { type: 'subtitle', text: 'The Wait' },
          { type: 'text', text: 'Four hours of nothing. The sun moved across the sky, the boat rocked gently, and I started to understand why people fish. It\'s not about the fish.' },
          { type: 'image', src: 'photo_fishing.jpg', caption: 'The yellowtail that changed everything' },
          { type: 'text', text: 'And then the line went tight. Not a gentle tug — a violent, rod-bending strike that nearly pulled me off my feet. Twenty minutes of chaos later, I was holding a yellowtail and grinning like an idiot.' },
        ]}}},
    { src: 'photo_portrait.jpg', caption: 'Me & cat', date: "'25 03 20",
      focus: { title: 'Me & cat', description: 'Portrait with my studio cat. She insists on supervising every design session.', link: '#', linkText: 'View story',
        article: { title: 'The Studio Cat', sections: [
          { type: 'text', text: 'She showed up one Tuesday morning, walked through the open studio door, jumped onto the desk, and sat on my keyboard. That was three years ago. She hasn\'t left.' },
          { type: 'subtitle', text: 'The Routine' },
          { type: 'text', text: 'Every morning: she watches me make coffee, follows me to the desk, and positions herself exactly where she\'ll cause maximum disruption. If I\'m designing, she sits on the trackpad. If I\'m sketching, she sits on the sketchbook.' },
          { type: 'image', src: 'photo_portrait.jpg', caption: 'Supervisor at work' },
          { type: 'text', text: 'I\'ve learned to work around her. Literally. My entire desk layout has evolved to accommodate a cat-sized gap in the center. Clients sometimes hear her in meetings. She has fans.' },
        ]}}},
  ];

  // ─── Scale factor for non-photo atoms (基于列宽) ───
  const cols = W < 600 ? 1 : W < 1024 ? 2 : W < 1600 ? 3 : 4;
  const colW = W / cols;
  const atomScale = colW / 480; // 480px 列宽时 scale=1，更窄则缩小，更宽则放大

  // ─── Define all wall items in display order ───
  // Each entry: { type, ...params }
  const wallItems = [
    { type: 'photo', ...photoConfigs[0] },
    { type: 'photo', ...photoConfigs[1] },
    { type: 'sticky', title: 'Generative UI', body: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', date: "'26 05 12", stampSrc: 'photo_ski.png',
      focus: { title: 'Generative UI', description: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', link: '#', linkText: 'Read more',
        article: { title: 'Generative UI', sections: [
          { type: 'text', text: 'For decades, software interfaces have been hand-crafted: every button, every layout, every interaction designed by a human and frozen in code. AI changed what software can do — but the interfaces stayed the same.' },
          { type: 'subtitle', text: 'The Problem' },
          { type: 'text', text: 'When you ask an AI a complex question, it responds with a wall of text. Bullet points if you\'re lucky. But text is a terrible medium for structured information — comparisons, timelines, data, instructions. We\'re forcing AI output through a straw.' },
          { type: 'subtitle', text: 'The Idea' },
          { type: 'text', text: 'What if the AI could generate the interface itself? Not just the content, but the container. A comparison becomes a table. A process becomes a flowchart. A dataset becomes a visualization. The UI adapts to the answer, not the other way around.' },
          { type: 'text', text: 'This is Generative UI: AI-generated, structured, interactive interfaces that match the shape of the information they carry. Dynamic, not static. Organic, not templated. Every response is a unique design.' },
          { type: 'subtitle', text: 'Four Principles' },
          { type: 'text', text: 'Dynamic — the interface changes with every response. Organic — layouts feel natural, not mechanical. Primitive — built from simple, composable atoms. Symbiotic — human and AI collaborate on the final form.' },
        ]}}},
    { type: 'sticky', title: 'Pegasus', body: 'A winged horse from ancient mythology — symbol of inspiration and the boundless creative spirit.', date: "'26 05 14", stampSrc: 'photo_stamp.png', colorScheme: 'cool' },
    { type: 'photo', ...photoConfigs[2] },
    { type: 'photo', ...photoConfigs[3] },
  ];

  // ─── Grid config ───
  const gridPad = colW * 0.12;

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app);

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
      const stickyStampImg = await loadImagePixels(item.stampSrc);
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
