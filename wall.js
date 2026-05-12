// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, makeDraggable, FocusOverlay } from "./atoms-renderer.js?v=105";

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
      focus: { title: 'Wildflowers', description: 'Spring wildflowers along the mountain trail. Shot during a weekend hike in Yunnan.', link: '#', linkText: 'View story' }},
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08",
      focus: { title: 'Avalanche!', description: 'Caught an avalanche on camera while backcountry skiing in Hokkaido.', link: '#', linkText: 'View story' }},
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15",
      focus: { title: 'Big catch!', description: 'First time catching a yellowtail off the coast. A perfect summer day on the water.', link: '#', linkText: 'View story' }},
    { src: 'photo_portrait.jpg', caption: 'Me & cat', date: "'25 03 20",
      focus: { title: 'Me & cat', description: 'Portrait with my studio cat. She insists on supervising every design session.', link: '#', linkText: 'View story' }},
  ];

  // Layout: mobile portrait = vertical stack, desktop = scattered
  if (isPortrait) {
    const padding = W * 0.1;
    const photoW = W * 0.6;
    let curY = padding + photoW * 0.8;
    for (let i=0; i<photoConfigs.length; i++) {
      const pc = photoConfigs[i];
      pc.x = W * 0.5 + (Math.random()-0.5) * W * 0.08;
      pc.y = curY;
      curY += photoW * 1.4 + padding * 0.5;
    }
    // Extend canvas height if needed
    const totalH = curY + padding;
    if (totalH > H) {
      app.renderer.resize(W, totalH);
      document.body.style.overflow = 'auto';
    }
  } else {
    const positions = [
      {x: W*0.15, y: H*0.3}, {x: W*0.8, y: H*0.65},
      {x: W*0.2, y: H*0.7}, {x: W*0.45, y: H*0.3},
    ];
    for (let i=0; i<photoConfigs.length; i++) {
      photoConfigs[i].x = positions[i].x;
      photoConfigs[i].y = positions[i].y;
    }
  }

  for (const pc of photoConfigs) {
    const imgData = await loadImagePixels(pc.src);
    const targetW = isPortrait ? W*0.55 : W*0.13;
    const photoScale = targetW / imgData.w;
    const photoItem = await photoSystem.addPhoto(pc.src, pc.x, pc.y, photoScale, pc);
    if (pc.focus) photoItem.focusData = pc.focus;
  }

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app);
  photoSystem.onFocus = (item) => focusOverlay.open(item);

  // ─── Sticky Note (stamp = photo_ski.png) — registered in PhotoSystem for clip ───
  const stickyStampImg = await loadImagePixels('photo_ski.png');
  const stickyResult = await renderStickyNote(
    app, isPortrait ? W*0.2 : W*0.6, isPortrait ? H*0.5 : H*0.55,
    { title: 'Generative UI', body: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', date: "'26 05 12" },
    stickyStampImg, atomsConfig.stamp
  );
  const stickyBounds = stickyResult.group.getBounds();
  const stickyItem = photoSystem.addItem(stickyResult.group, stickyBounds.width, stickyBounds.height);
  stickyItem.focusData = { title: 'Generative UI', description: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', link: '#', linkText: 'Read more' };

  // ─── Standalone Stamp (photo2.png) — registered in PhotoSystem for clip ───
  const stampImg = await loadImagePixels('photo2.png');
  const stampResult = await renderStamp(
    app, stampImg, isPortrait ? W*0.6 : W*0.75, isPortrait ? H*0.3 : H*0.35, atomsConfig.stamp
  );
  photoSystem.addItem(stampResult.group, stampResult.stampW, stampResult.stampH);

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

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt=Math.min(ticker.deltaMS/1000,0.05);
  });
})();
