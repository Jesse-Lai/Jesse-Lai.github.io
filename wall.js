// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem } from "./atoms-renderer.js?v=5";

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
  // Preload Schoolbell font before rendering
  await new Promise(r => {
    const testEl = document.createElement('span');
    testEl.style.fontFamily = 'Schoolbell';
    testEl.style.position = 'absolute';
    testEl.style.visibility = 'hidden';
    testEl.textContent = 'test';
    document.body.appendChild(testEl);
    document.fonts.ready.then(() => { document.body.removeChild(testEl); r(); });
  });

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
