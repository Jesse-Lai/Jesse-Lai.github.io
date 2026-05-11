// wall.js — Main view, uses atoms-renderer.js

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
  async function mergePhotos(droppedPhoto, targetPhoto) {
    // Find if target is already in a clip group
    let existingClip = clipGroups.find(cg => cg.photos.includes(targetPhoto));
    
    if (existingClip) {
      // Add to existing clip group
      droppedPhoto.clipped = true;
      existingClip.photos.push(droppedPhoto);
      const idx = existingClip.photos.length - 1;
      await animateTo(droppedPhoto.group, targetPhoto.group.x + idx*4, targetPhoto.group.y - idx*4);
      // Move clip sprite to top
      existingClip.clipSprite.x = existingClip.photos[0].group.x - existingClip.photos[0].imgData.w*existingClip.photos[0].scale*0.35;
      existingClip.clipSprite.y = existingClip.photos[0].group.y - existingClip.photos[0].imgData.h*existingClip.photos[0].scale*0.4;
      return;
    }
    
    if (droppedPhoto.clipped || targetPhoto.clipped) return;
    droppedPhoto.clipped = true; targetPhoto.clipped = true;

    // Animate both to midpoint, stacked
    const mx = (droppedPhoto.group.x + targetPhoto.group.x) / 2;
    const my = (droppedPhoto.group.y + targetPhoto.group.y) / 2;
    await Promise.all([
      animateTo(targetPhoto.group, mx - 4, my + 4),
      animateTo(droppedPhoto.group, mx + 4, my - 4),
    ]);

    // Load and place paperclip SVG
    try {
      const clipTex = await PIXI.Assets.load({src:'paperclip.svg', data:{resolution:4}});
      const clipSp = new PIXI.Sprite(clipTex);
      const pw = droppedPhoto.imgData.w * droppedPhoto.scale;
      const clipScale = Math.min(pw*0.2/clipSp.texture.width, pw*0.4/clipSp.texture.height);
      clipSp.scale.set(clipScale);
      clipSp.anchor.set(0.5, 0.5);
      clipSp.x = mx - pw*0.35;
      clipSp.y = my - droppedPhoto.imgData.h*droppedPhoto.scale*0.4;
      clipSp.eventMode = 'static';
      clipSp.cursor = 'pointer';
      clipSp.alpha = 0;
      clipSp.zIndex = 9999;
      app.stage.addChild(clipSp);

      // Fade in
      await new Promise(resolve => {
        const start = performance.now();
        (function tick() {
          const t = Math.min(1, (performance.now()-start)/200);
          clipSp.alpha = t;
          if (t<1) requestAnimationFrame(tick); else resolve();
        })();
      });

      const clipInfo = { clipSprite: clipSp, photos: [targetPhoto, droppedPhoto] };
      clipGroups.push(clipInfo);
      // Click handled via canvas mousedown below
    } catch(err) {
      console.error('Failed to load paperclip:', err);
      droppedPhoto.clipped = false; targetPhoto.clipped = false;
    }
  }

  // ─── Clip split ───
  async function splitPhotos(clipInfo) {
    const {clipSprite, photos: clipPhotos} = clipInfo;

    // Fade out clip
    await new Promise(resolve => {
      const start=performance.now();
      (function tick(){
        const t=Math.min(1,(performance.now()-start)/200);
        clipSprite.alpha=1-t;
        if(t<1) requestAnimationFrame(tick); else resolve();
      })();
    });
    app.stage.removeChild(clipSprite);
    clipSprite.destroy();

    // Animate all photos apart in a circle
    const cx=clipPhotos[0].group.x, cy=clipPhotos[0].group.y;
    const spread=80+Math.random()*40;
    const angleStep=Math.PI*2/clipPhotos.length;
    const baseAngle=Math.random()*Math.PI*2;
    await Promise.all(clipPhotos.map((p,i) => 
      animateTo(p.group, cx+Math.cos(baseAngle+angleStep*i)*spread, cy+Math.sin(baseAngle+angleStep*i)*spread)
    ));

    clipPhotos.forEach(p => p.clipped=false);
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
    { src: 'photo_flowers.png', caption: 'Wildflowers', date: "'25 05 10", x: W*0.2, y: H*0.3 },
    { src: 'photo2.png', caption: 'Design notes', date: "'25 04 01", x: W*0.75, y: H*0.25 },
    { src: 'photo_ski.png', caption: 'Powder day', date: "'25 01 15", x: W*0.8, y: H*0.65 },
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08", x: W*0.25, y: H*0.7 },
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
    // Check clip click first (generous hit area around clip sprite)
    for (const cg of [...clipGroups]) {
      const cs = cg.clipSprite;
      const hitRadius = 40;
      if (Math.abs(mouse.x - cs.x) < hitRadius && Math.abs(mouse.y - cs.y) < hitRadius) {
        console.log('Clip clicked, splitting');
        splitPhotos(cg);
        return;
      }
    }
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
