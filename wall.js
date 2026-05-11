// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, AtomSticker, renderPhoto, renderClip, renderLure, makeDraggable } from './atoms-renderer.js';

(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, resolution: dpr, autoDensity: true, backgroundColor: 0x0a0a0a });
  document.body.appendChild(app.canvas);

  // Load atoms config
  const configResp = await fetch('atoms-config.json');
  const atomsConfig = await configResp.json();

  await document.fonts.ready;

  // ─── Elements on the wall ───
  const elements = [];
  const destroyers = []; // cleanup handlers

  // Sticker (particle-based, center)
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");
  const stickerScale = Math.min((W*0.25)/img1.w, (H*0.35)/img1.h);
  const sticker1 = new AtomSticker(img1, img2, W*0.5, H*0.45, stickerScale, atomsConfig.sticker);
  app.stage.addChild(sticker1.container);

  // Photos (polaroid style)
  const photoConfigs = [
    { src: 'photo1.png', caption: 'Blackboard', date: "'25 03 12", x: W*0.2, y: H*0.3 },
    { src: 'photo2.png', caption: 'Design notes', date: "'25 04 01", x: W*0.75, y: H*0.25 },
    { src: 'photo3.png', caption: 'Koala friend', date: "'25 04 28", x: W*0.8, y: H*0.65 },
    { src: 'photo4.png', caption: 'Charizard!', date: "'24 12 20", x: W*0.25, y: H*0.7 },
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15", x: W*0.55, y: H*0.75 },
  ];

  for (const pc of photoConfigs) {
    const imgData = await loadImagePixels(pc.src);
    const scale = Math.min((W*0.15)/imgData.w, (H*0.25)/imgData.h);
    const { group, hitTest } = await renderPhoto(app, imgData, pc.x, pc.y, scale, pc, atomsConfig.photo);
    app.stage.addChild(group);
    destroyers.push(makeDraggable(app.canvas, group, hitTest));
    elements.push({ type: 'photo', group });
  }

  // Clip group
  const clipImgs = [];
  for (const src of ['photo6.png']) {
    clipImgs.push(await loadImagePixels(src));
  }
  if (clipImgs.length >= 1) {
    // Add a second image for clip (needs min 2)
    clipImgs.push(await loadImagePixels('photo4.png'));
    const maxCW = W*0.15, maxCH = H*0.22;
    const { group: clipGroup, hitTest: clipHit } = await renderClip(app, clipImgs, W*0.15, H*0.5, maxCW, maxCH, atomsConfig.clip);
    app.stage.addChild(clipGroup);
    destroyers.push(makeDraggable(app.canvas, clipGroup, clipHit));
    elements.push({ type: 'clip', group: clipGroup });
  }

  // Lure
  const { group: lureGroup, hitTest: lureHit } = renderLure(app, W*0.88, H*0.45, atomsConfig.lure);
  app.stage.addChild(lureGroup);
  destroyers.push(makeDraggable(app.canvas, lureGroup, lureHit));
  elements.push({ type: 'lure', group: lureGroup });

  // ─── Sticker interaction ───
  const mouse = { x: -9999, y: -9999 };
  let draggedSticker = null;

  app.canvas.addEventListener("mousemove", e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (draggedSticker) { draggedSticker.moveDrag(mouse.x, mouse.y); }
    else { sticker1.setHover(sticker1.hitTest(mouse.x, mouse.y)); }
  });
  app.canvas.addEventListener("mousedown", e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (sticker1.hitTest(mouse.x, mouse.y)) {
      sticker1.startDrag(mouse.x, mouse.y);
      draggedSticker = sticker1;
      app.stage.removeChild(sticker1.container);
      app.stage.addChild(sticker1.container);
    }
  });
  app.canvas.addEventListener("mouseup", () => {
    if (draggedSticker) { draggedSticker.drop(); draggedSticker = null; }
  });

  // Touch support
  let longPress = null, touchMoved = false;
  window.addEventListener("touchstart", e => {
    const t = e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=false;
    longPress = setTimeout(() => {
      if (!touchMoved && sticker1.hitTest(mouse.x, mouse.y)) {
        sticker1.startDrag(mouse.x, mouse.y); draggedSticker = sticker1;
      }
    }, 400);
  });
  window.addEventListener("touchmove", e => {
    if (draggedSticker) e.preventDefault();
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=true;
    if (longPress) { clearTimeout(longPress); longPress=null; }
    if (draggedSticker) draggedSticker.moveDrag(mouse.x, mouse.y);
  }, { passive: false });
  window.addEventListener("touchend", () => {
    if (longPress) { clearTimeout(longPress); longPress=null; }
    if (draggedSticker) { draggedSticker.drop(); draggedSticker=null; }
  });

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS/1000, 0.05);
    sticker1.update(dt);
  });
})();
