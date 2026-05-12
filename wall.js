// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem } from "./atoms-renderer.js?v=49";

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
  // Preload Schoolbell font before rendering
  try {
    await document.fonts.load('24px Schoolbell');
  } catch(e) {}
  // Double-check: wait until font is actually available
  let fontRetries = 0;
  while (fontRetries < 20 && !document.fonts.check('24px Schoolbell')) {
    await new Promise(r => setTimeout(r, 100));
    fontRetries++;
  }

  // ─── Photo System (shared behavior from atoms-renderer) ───
  const photoSystem = new PhotoSystem(app, app.canvas, atomsConfig);

  const isMobile = W < 768;
  const isPortrait = H > W;

  const photoConfigs = [
    { src: 'photo_flowers.png', caption: 'Wildflowers', date: "'25 05 10" },
    { src: 'photo2.png', caption: 'Design notes', date: "'25 04 01" },
    { src: 'photo_ski.png', caption: 'Powder day', date: "'25 01 15" },
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08" },
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15" },
    { src: 'photo_portrait.jpg', caption: 'Me & cat', date: "'25 03 20" },
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
      {x: W*0.2, y: H*0.3}, {x: W*0.75, y: H*0.25}, {x: W*0.8, y: H*0.65},
      {x: W*0.25, y: H*0.7}, {x: W*0.55, y: H*0.75}, {x: W*0.45, y: H*0.35},
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
    await photoSystem.addPhoto(pc.src, pc.x, pc.y, photoScale, pc);
  }


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
