// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, AtomSticker, PhotoSystem } from "./atoms-renderer.js?v=4";

(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, antialias: true, resolution: dpr, autoDensity: true, backgroundColor: 0x0a0a0a });
  document.body.appendChild(app.canvas);
  app.stage.sortableChildren = true;

  const configResp = await fetch('atoms-config.json');
  const atomsConfig = await configResp.json();
  await document.fonts.ready;

  // ─── Photo System (shared behavior from atoms-renderer) ───
  const photoSystem = new PhotoSystem(app, app.canvas, atomsConfig);

  const photoConfigs = [
    { src: 'photo_flowers.png', caption: 'Wildflowers', date: "'25 05 10", x: W*0.2, y: H*0.3 },
    { src: 'photo2.png', caption: 'Design notes', date: "'25 04 01", x: W*0.75, y: H*0.25 },
    { src: 'photo_ski.png', caption: 'Powder day', date: "'25 01 15", x: W*0.8, y: H*0.65 },
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08", x: W*0.25, y: H*0.7 },
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15", x: W*0.55, y: H*0.75 },
  ];

  for (const pc of photoConfigs) {
    await photoSystem.addPhoto(pc.src, pc.x, pc.y, null, pc);
  }

  // ─── Sticker ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");
  const stickerScale = Math.min((W*0.25)/img1.w, (H*0.35)/img1.h);
  const sticker1 = new AtomSticker(img1, img2, W*0.5, H*0.45, stickerScale, atomsConfig.sticker);
  app.stage.addChild(sticker1.container);

  // ─── Sticker interaction ───
  const mouse = { x:-9999, y:-9999 };
  let draggedSticker = null;

  app.canvas.addEventListener("mousemove", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
    if(draggedSticker) draggedSticker.moveDrag(mouse.x,mouse.y);
    else sticker1.setHover(sticker1.hitTest(mouse.x,mouse.y));
  });
  app.canvas.addEventListener("mousedown", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
    if(sticker1.hitTest(mouse.x,mouse.y)){
      sticker1.startDrag(mouse.x,mouse.y);
      draggedSticker=sticker1;
      app.stage.removeChild(sticker1.container);
      app.stage.addChild(sticker1.container);
    }
  });
  app.canvas.addEventListener("mouseup", () => {
    if(draggedSticker){draggedSticker.drop();draggedSticker=null;}
  });

  // Touch
  let longPress=null, touchMoved=false;
  window.addEventListener("touchstart", e => {
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=false;
    longPress=setTimeout(()=>{
      if(!touchMoved&&sticker1.hitTest(mouse.x,mouse.y)){sticker1.startDrag(mouse.x,mouse.y);draggedSticker=sticker1;}
    },400);
  });
  window.addEventListener("touchmove", e => {
    if(draggedSticker) e.preventDefault();
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=true;
    if(longPress){clearTimeout(longPress);longPress=null;}
    if(draggedSticker) draggedSticker.moveDrag(mouse.x,mouse.y);
  },{passive:false});
  window.addEventListener("touchend", () => {
    if(longPress){clearTimeout(longPress);longPress=null;}
    if(draggedSticker){draggedSticker.drop();draggedSticker=null;}
  });

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt=Math.min(ticker.deltaMS/1000,0.05);
    sticker1.update(dt);
  });
})();
