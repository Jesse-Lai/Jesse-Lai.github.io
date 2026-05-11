// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, AtomSticker, renderPhoto, renderClip, renderLure, makeDraggable } from './atoms-renderer.js?v=2';

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

  // ─── State ───
  const photos = []; // { group, imgData, scale, config, clipped: false, clipGroup: null }
  const clipGroups = []; // { group, photos: [photoA, photoB], clipSprite }
  const otherElements = [];

  // ─── Animate helper ───
  function animateTo(group, tx, ty, duration=300) {
    const sx=group.x, sy=group.y;
    const start=performance.now();
    return new Promise(resolve => {
      function tick() {
        const t=Math.min(1,(performance.now()-start)/duration);
        const ease=1-Math.pow(1-t,3); // ease-out cubic
        group.x=sx+(tx-sx)*ease;
        group.y=sy+(ty-sy)*ease;
        if(t<1) requestAnimationFrame(tick); else resolve();
      }
      tick();
    });
  }

  // ─── Overlap detection ───
  function getPhotoBounds(p) {
    const pw=p.imgData.w*p.scale, ph=p.imgData.h*p.scale;
    const border=pw*0.06, bottomBorder=border*3;
    const totalW=pw+border*2, totalH=ph+border+bottomBorder;
    return { x:p.group.x-totalW/2, y:p.group.y-totalH/2, w:totalW, h:totalH };
  }

  function overlapRatio(a, b) {
    const ax2=a.x+a.w, ay2=a.y+a.h, bx2=b.x+b.w, by2=b.y+b.h;
    const ox=Math.max(0,Math.min(ax2,bx2)-Math.max(a.x,b.x));
    const oy=Math.max(0,Math.min(ay2,by2)-Math.max(a.y,b.y));
    const overlap=ox*oy;
    const smaller=Math.min(a.w*a.h, b.w*b.h);
    return smaller>0 ? overlap/smaller : 0;
  }

  // ─── Clip merge ───
  async function mergePhotos(photoA, photoB) {
    if(photoA.clipped || photoB.clipped) return;
    photoA.clipped=true; photoB.clipped=true;

    // Animate both to midpoint, stacked
    const mx=(photoA.group.x+photoB.group.x)/2;
    const my=(photoA.group.y+photoB.group.y)/2;
    await Promise.all([
      animateTo(photoA.group, mx-4, my+4),
      animateTo(photoB.group, mx+4, my-4),
    ]);

    // Load and place paperclip SVG
    const clipTex = await PIXI.Assets.load({src:'paperclip.svg', data:{resolution:4}});
    const clipSp = new PIXI.Sprite(clipTex);
    const pw=photoA.imgData.w*photoA.scale;
    const clipScale = Math.min(pw*0.15/clipSp.texture.width, pw*0.35/clipSp.texture.height);
    clipSp.scale.set(clipScale);
    clipSp.anchor.set(0.5, 0.5);
    clipSp.x = mx - pw*0.35;
    clipSp.y = my - photoA.imgData.h*photoA.scale*0.4;
    clipSp.eventMode = 'static';
    clipSp.cursor = 'pointer';
    clipSp.alpha = 0;
    clipSp.zIndex = 9999;
    app.stage.addChild(clipSp);

    // Fade in clip
    const fadeIn = () => new Promise(resolve => {
      const start=performance.now();
      function tick(){
        const t=Math.min(1,(performance.now()-start)/200);
        clipSp.alpha=t;
        if(t<1) requestAnimationFrame(tick); else resolve();
      }
      tick();
    });
    await fadeIn();

    const clipInfo = { clipSprite: clipSp, photos: [photoA, photoB] };
    clipGroups.push(clipInfo);

    // Click clip to split
    clipSp.on('pointerdown', () => splitPhotos(clipInfo));
  }

  // ─── Clip split ───
  async function splitPhotos(clipInfo) {
    const {clipSprite, photos: [photoA, photoB]} = clipInfo;

    // Fade out clip
    const fadeOut = () => new Promise(resolve => {
      const start=performance.now();
      function tick(){
        const t=Math.min(1,(performance.now()-start)/200);
        clipSprite.alpha=1-t;
        if(t<1) requestAnimationFrame(tick); else resolve();
      }
      tick();
    });
    await fadeOut();
    app.stage.removeChild(clipSprite);

    // Animate photos apart
    const cx=photoA.group.x, cy=photoA.group.y;
    const spread=80+Math.random()*40;
    const angle=Math.random()*Math.PI*2;
    await Promise.all([
      animateTo(photoA.group, cx+Math.cos(angle)*spread, cy+Math.sin(angle)*spread),
      animateTo(photoB.group, cx-Math.cos(angle)*spread, cy-Math.sin(angle)*spread),
    ]);

    photoA.clipped=false;
    photoB.clipped=false;
    const idx=clipGroups.indexOf(clipInfo);
    if(idx>=0) clipGroups.splice(idx,1);
  }

  // ─── Photo drag with overlap check ───
  function makePhotoDraggable(canvas, photo) {
    let drag=false, offX=0, offY=0;
    const hitTest = (mx,my) => {
      const pw=photo.imgData.w*photo.scale, ph=photo.imgData.h*photo.scale;
      return Math.abs(mx-photo.group.x)<pw*0.6 && Math.abs(my-photo.group.y)<ph*0.6;
    };
    const onDown = e => {
      if(photo.clipped) return;
      const mx=e.clientX, my=e.clientY;
      if(hitTest(mx,my)) {
        drag=true; offX=photo.group.x-mx; offY=photo.group.y-my;
        // Bring to front
        app.stage.removeChild(photo.group);
        app.stage.addChild(photo.group);
      }
    };
    const onMove = e => {
      if(!drag) return;
      photo.group.x=e.clientX+offX;
      photo.group.y=e.clientY+offY;
    };
    const onUp = () => {
      if(!drag) return;
      drag=false;
      // Check overlap with other photos
      const boundsA=getPhotoBounds(photo);
      for(const other of photos) {
        if(other===photo || other.clipped || photo.clipped) continue;
        const boundsB=getPhotoBounds(other);
        if(overlapRatio(boundsA, boundsB)>0.2) {
          mergePhotos(photo, other);
          break;
        }
      }
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
  }

  // ─── Create photos ───
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
    const { group } = await renderPhoto(app, imgData, pc.x, pc.y, scale, pc, atomsConfig.photo);
    app.stage.addChild(group);
    const photo = { group, imgData, scale, config: pc, clipped: false };
    photos.push(photo);
    makePhotoDraggable(app.canvas, photo);
  }

  // ─── Sticker ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");
  const stickerScale = Math.min((W*0.25)/img1.w, (H*0.35)/img1.h);
  const sticker1 = new AtomSticker(img1, img2, W*0.5, H*0.45, stickerScale, atomsConfig.sticker);
  app.stage.addChild(sticker1.container);

  // ─── Lure ───
  const { group: lureGroup, hitTest: lureHit } = renderLure(app, W*0.88, H*0.45, atomsConfig.lure);
  app.stage.addChild(lureGroup);
  makeDraggable(app.canvas, lureGroup, lureHit);

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
