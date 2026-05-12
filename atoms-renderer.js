// atoms-renderer.js — Shared atom rendering module
// All atom types are rendered from here. Both atoms.html and wall.js import this.


// ─── Animation utility ───
export function animateTo(obj, tx, ty, duration=300) {
  const sx=obj.x, sy=obj.y;
  const start=performance.now();
  return new Promise(resolve => {
    (function tick() {
      const t=Math.min(1,(performance.now()-start)/duration);
      const ease=1-Math.pow(1-t,3);
      obj.x=sx+(tx-sx)*ease;
      obj.y=sy+(ty-sy)*ease;
      if(t<1) requestAnimationFrame(tick); else resolve();
    })();
  });
}

export function fadeOut(obj, duration=200) {
  const sa=obj.alpha;
  const start=performance.now();
  return new Promise(resolve => {
    (function tick() {
      const t=Math.min(1,(performance.now()-start)/duration);
      obj.alpha=sa*(1-t);
      if(t<1) requestAnimationFrame(tick); else resolve();
    })();
  });
}

export function fadeIn(obj, duration=200) {
  obj.alpha=0;
  const start=performance.now();
  return new Promise(resolve => {
    (function tick() {
      const t=Math.min(1,(performance.now()-start)/duration);
      obj.alpha=t;
      if(t<1) requestAnimationFrame(tick); else resolve();
    })();
  });
}


// ─── Text Layout with obstacle avoidance (reusable) ───
// obstacles: [{x, y, w, h}] in local coords
// Returns array of {text, x, y} line objects
export function layoutTextWithObstacles(text, options) {
  const {
    areaX = 0, areaY = 0, areaW = 200, areaH = 300,
    fontSize = 17, fontFamily = 'Special Elite', lineHeight = null,
    fill = 0x444444, obstacles = [],
  } = options;

  const lh = lineHeight || fontSize * 1.4;
  // Create offscreen canvas for text measurement
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = `${fontSize}px ${fontFamily}`;

  const words = text.split(/\s+/);
  const lines = [];
  let curY = areaY;

  let wordIdx = 0;
  while (wordIdx < words.length && curY + lh <= areaY + areaH) {
    // Determine available width at this Y, considering obstacles
    let lineX = areaX;
    let lineW = areaW;

    for (const obs of obstacles) {
      // Check if this line overlaps with obstacle vertically
      if (curY + lh > obs.y && curY < obs.y + obs.h) {
        // Obstacle overlaps this line
        if (obs.x <= areaX + areaW/2) {
          // Obstacle on left side — text starts after obstacle
          const obstacleRight = obs.x + obs.w;
          if (obstacleRight > lineX) {
            lineX = obstacleRight + 8;
            lineW = areaX + areaW - lineX;
          }
        } else {
          // Obstacle on right side — text ends before obstacle
          const obstacleLeft = obs.x;
          lineW = Math.min(lineW, obstacleLeft - lineX - 8);
        }
      }
    }

    if (lineW < fontSize * 6) {
      // Too narrow, skip this line
      curY += lh;
      continue;
    }

    // Fill words into this line
    let lineText = '';
    while (wordIdx < words.length) {
      const testLine = lineText ? lineText + ' ' + words[wordIdx] : words[wordIdx];
      const measured = mctx.measureText(testLine);
      if (measured.width > lineW && lineText) break;
      lineText = testLine;
      wordIdx++;
    }

    if (lineText) {
      lines.push({ text: lineText, x: lineX, y: curY, fontSize, fontFamily, fill });
    }
    curY += lh;
  }

  return lines;
}

// Render laid out lines as PIXI.Text objects into a container
export function renderTextLines(container, lines, options = {}) {
  const { padding = 0 } = options;
  const textObjects = [];
  for (const line of lines) {
    const t = new PIXI.Text({text: line.text, style: {
      fontFamily: line.fontFamily,
      fontSize: line.fontSize,
      fill: line.fill,
      padding: padding || line.fontSize * 0.2,
    }});
    t.x = line.x;
    t.y = line.y;
    container.addChild(t);
    textObjects.push(t);
  }
  return textObjects;
}

// ─── Utilities ───
export function sampleImage(imageData, w, h, gap) {
  const pixels = imageData.data, points = [];
  for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) {
    const i = (y * w + x) * 4;
    if (pixels[i+3] < 30) continue;
    points.push({ nx:x/w, ny:y/h, r:pixels[i], g:pixels[i+1], b:pixels[i+2], a:pixels[i+3] });
  }
  return points;
}

export async function loadImagePixels(src) {
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = src;
  await new Promise(r => img.onload = r);
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0,0,c.width,c.height), w: c.width, h: c.height, tex: PIXI.Texture.from(c) };
}

export function sampleDominantColor(imgData) {
  const px = imgData.data.data;
  let rT=0,gT=0,bT=0,count=0;
  const step = Math.max(1, Math.floor(px.length / 4 / 500));
  for(let i=0;i<px.length;i+=step*4){
    if(px[i+3]<128) continue;
    rT+=px[i]; gT+=px[i+1]; bT+=px[i+2]; count++;
  }
  if(!count) return 0x555555;
  const r=Math.round(rT/count), g=Math.round(gT/count), b=Math.round(bT/count);
  // Convert to HSL, maximize saturation, darken slightly
  const rn=r/255,gn=g/255,bn=b/255;
  const cmax=Math.max(rn,gn,bn),cmin=Math.min(rn,gn,bn),delta=cmax-cmin;
  let h=0;
  if(delta>0){
    if(cmax===rn) h=((gn-bn)/delta)%6;
    else if(cmax===gn) h=(bn-rn)/delta+2;
    else h=(rn-gn)/delta+4;
    h=Math.round(h*60); if(h<0) h+=360;
  }
  // Max saturation, lightness ~0.4 for vivid marker look
  const s=1.0, l=0.36;
  const c2=(1-Math.abs(2*l-1))*s;
  const x=c2*(1-Math.abs((h/60)%2-1));
  const m=l-c2/2;
  let r1,g1,b1;
  if(h<60){r1=c2;g1=x;b1=0;}
  else if(h<120){r1=x;g1=c2;b1=0;}
  else if(h<180){r1=0;g1=c2;b1=x;}
  else if(h<240){r1=0;g1=x;b1=c2;}
  else if(h<300){r1=x;g1=0;b1=c2;}
  else{r1=c2;g1=0;b1=x;}
  const fr=Math.round((r1+m)*255),fg=Math.round((g1+m)*255),fb=Math.round((b1+m)*255);
  return (fr<<16)|(fg<<8)|fb;
}

// ─── Draggable mixin ───
export function makeDraggable(canvas, group, hitTest) {
  let drag=false, offX=0, offY=0;
  const onDown = e => {
    const mx = e.clientX ?? e.touches?.[0]?.clientX;
    const my = e.clientY ?? e.touches?.[0]?.clientY;
    if (hitTest(mx, my)) { drag=true; offX=group.x-mx; offY=group.y-my; }
  };
  const onMove = e => {
    if (!drag) return;
    const mx = e.clientX ?? e.touches?.[0]?.clientX;
    const my = e.clientY ?? e.touches?.[0]?.clientY;
    group.x = mx+offX; group.y = my+offY;
  };
  const onUp = () => { drag=false; };
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  return { destroy() {
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseup', onUp);
  }};
}

// ─── AtomSticker (particle-based) ───
export class AtomSticker {
  constructor(imgA, imgB, x, y, scale, cfg) {
    this.posX = x; this.posY = y; this.scale = scale;
    this.renderW = imgA.w*scale; this.renderH = imgA.h*scale;
    this.cfg = cfg || {};
    this.container = new PIXI.Container();
    this.flatSprite = new PIXI.Sprite(imgA.tex);
    this.flatSprite.anchor.set(0.5);
    this.flatSprite.width = this.renderW; this.flatSprite.height = this.renderH;
    this.container.addChild(this.flatSprite);
    this.container.x = x; this.container.y = y;
    this.particles = []; this.activated = false;
    this.state = "idle"; this.hoverProgress = 0;
    this.dragOffsetX = 0; this.dragOffsetY = 0;
    this.morphProgress = 0; this.morphTarget = 0;
    this.morphTimer = null; this.currentForm = 0;
    this.imgDataA = imgA; this.imgDataB = imgB || imgA;
    this.noParticles = !(cfg?.behavior?.hasParticles ?? true);
  }
  get bounds() { return { x:this.posX-this.renderW/2, y:this.posY-this.renderH/2, w:this.renderW, h:this.renderH }; }
  hitTest(mx,my) { const b=this.bounds; return mx>b.x&&mx<b.x+b.w&&my>b.y&&my<b.y+b.h; }
  setHover(h) { if (this.state!=="dragging") this.state=h?"hover":"idle"; }
  startDrag(mx,my) {
    this.activate(); this.state="dragging";
    this.dragOffsetX=this.posX-mx; this.dragOffsetY=this.posY-my; this.hoverProgress=1;
    const interval = this.cfg?.behavior?.morphInterval || 1000;
    if (this.cfg?.behavior?.hasMorph) {
      this.morphTimer = setInterval(() => { this.morphTarget = this.morphTarget===0?1:0; }, interval);
    }
  }
  moveDrag(mx,my) { this.posX=mx+this.dragOffsetX; this.posY=my+this.dragOffsetY; }
  drop() {
    this.state="idle";
    if (this.morphTimer) { clearInterval(this.morphTimer); this.morphTimer=null; }
    this.currentForm = this.morphProgress>0.5?1:0; this.morphTarget=this.currentForm;
  }
  activate() {
    if (this.activated||this.noParticles) return;
    this.activated=true; this.flatSprite.visible=false;
    const gap = this.cfg?.style?.particleGap || 3;
    const pA=sampleImage(this.imgDataA.data,this.imgDataA.w,this.imgDataA.h,gap);
    const pB=sampleImage(this.imgDataB.data,this.imgDataB.w,this.imgDataB.h,gap);
    const mc=Math.max(pA.length,pB.length);
    while(pA.length<mc) pA.push(pA[Math.floor(Math.random()*pA.length)]);
    while(pB.length<mc) pB.push(pB[Math.floor(Math.random()*pB.length)]);
    for(let i=pB.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pB[i],pB[j]]=[pB[j],pB[i]];}
    const ps=this.scale*gap/2*(this.cfg?.style?.particleScale||1);
    const dc=document.createElement("canvas");dc.width=2;dc.height=2;
    const dctx=dc.getContext("2d");dctx.fillStyle="white";dctx.fillRect(0,0,2,2);
    const dt=PIXI.Texture.from(dc);
    const rwB=this.imgDataB.w*this.scale,rhB=this.imgDataB.h*this.scale;
    for(let i=0;i<mc;i++){
      const a=pA[i],b=pB[i];
      const lxA=(a.nx-0.5)*this.renderW,lyA=(a.ny-0.5)*this.renderH;
      const lxB=(b.nx-0.5)*rwB,lyB=(b.ny-0.5)*rhB;
      const sp=new PIXI.Sprite(dt);sp.anchor.set(0.5);sp.scale.set(ps);
      sp.tint=(a.r<<16)|(a.g<<8)|a.b;sp.alpha=a.a/255;
      this.container.addChild(sp);
      this.particles.push({sprite:sp,lxA,lyA,rA:a.r,gA:a.g,bA:a.b,aA:a.a,lxB,lyB,rB:b.r,gB:b.g,bB:b.b,aB:b.a,lx:lxA,ly:lyA,x:this.posX+lxA,y:this.posY+lyA,vx:0,vy:0,nx:a.nx,ny:a.ny,origR:a.r,origG:a.g,origB:a.b,origA:a.a,isFlipped:false});
    }
    this.container.x=0;this.container.y=0;
  }
  update(dt) {
    const hs = this.cfg?.behavior?.hoverScale || 1.05;
    const ts=(this.state==="hover"||this.state==="dragging")?hs:1.0;
    const cs=this.container.scale.x;
    this.container.scale.set(cs+(ts-cs)*0.1);
    if(!this.activated){this.container.x=this.posX;this.container.y=this.posY;if(this.state==="hover")this.activate();if(!this.activated)return;}
    const th=(this.state==="hover"||this.state==="dragging")?1:0;
    this.hoverProgress+=(th-this.hoverProgress)*0.1;
    this.morphProgress+=(this.morphTarget-this.morphProgress)*0.05;
    const damping = this.cfg?.behavior?.springDamping || 0.7;
    const stiffness = this.cfg?.behavior?.springStiffness || 0.15;
    const expandFactor = this.cfg?.behavior?.expandOnHover || 12;
    const doPeel = this.cfg?.behavior?.cornerPeel !== false;
    for(const p of this.particles){
      const m=this.morphProgress;
      const clx=p.lxA+(p.lxB-p.lxA)*m,cly=p.lyA+(p.lyB-p.lyA)*m;
      const cr=Math.round(p.rA+(p.rB-p.rA)*m),cg=Math.round(p.gA+(p.gB-p.gA)*m),cb=Math.round(p.bA+(p.bB-p.bA)*m);
      p.lx=clx;p.ly=cly;p.nx=clx/this.renderW+0.5;p.ny=cly/this.renderH+0.5;
      let tx=this.posX+clx,ty=this.posY+cly;
      if(doPeel){const fr=0.6,dc2=Math.sqrt((1-p.nx)**2+(1-p.ny)**2);if(dc2<fr){const fa=(fr-dc2)/fr,hp=this.hoverProgress;tx-=2*(1-p.nx)*fa*hp*this.renderW*0.3;ty-=2*(1-p.ny)*fa*hp*this.renderH*0.3;}}
      if(this.hoverProgress>0.01&&expandFactor>0){tx+=(p.nx-0.5)*expandFactor*this.hoverProgress;ty+=(p.ny-0.5)*expandFactor*this.hoverProgress;}
      p.vx+=(tx-p.x)*stiffness;p.vy+=(ty-p.y)*stiffness;
      p.vx*=damping;p.vy*=damping;
      p.x+=p.vx;p.y+=p.vy;
      p.sprite.x=p.x;p.sprite.y=p.y;
      p.sprite.tint=(cr<<16)|(cg<<8)|cb;
      p.sprite.alpha=(p.aA+(p.aB-p.aA)*m)/255;
    }
  }
}

// ─── Render Photo (Polaroid) ───
export async function renderPhoto(app, imgData, x, y, scale, imgCfg, cfg) {
  const wrapper = new PIXI.Container();
  wrapper.x = x; wrapper.y = y;
  const pw = imgData.w*scale, ph = imgData.h*scale;
  const border = pw*0.06;
  const bottomBorder = border*3;

  // Shadow (outside mask so it's visible)
  const shadow = new PIXI.Graphics();
  shadow.roundRect(-pw/2-border+3, -ph/2-border+3, pw+border*2, ph+border+bottomBorder, 3);
  shadow.fill({color:0x000000, alpha:0.12});
  wrapper.addChild(shadow);

  // Inner group (masked)
  const group = new PIXI.Container();
  wrapper.addChild(group);

  // White frame
  const frame = new PIXI.Graphics();
  frame.roundRect(-pw/2-border, -ph/2-border, pw+border*2, ph+border+bottomBorder, 3);
  frame.fill(0xf5f5f0);
  group.addChild(frame);

  // No mask — text positioned precisely within bounds

  // Photo sprite
  const sp = new PIXI.Sprite(imgData.tex);
  sp.anchor.set(0.5, 0);
  sp.width = pw; sp.height = ph;
  sp.y = -ph/2;
  group.addChild(sp);

  // Handwritten text
  const caption = imgCfg?.caption || '';
  const date = imgCfg?.date || '';
  const textColor = sampleDominantColor(imgData);
  const fontSize1 = Math.max(20, pw*0.10);
  const fontSize2 = Math.max(16, pw*0.08);
  const bottomSafe = border * 0.2;
  const frameBottom = ph/2 + bottomBorder;
  const capY = frameBottom - bottomSafe - fontSize1*1.3 - fontSize2*1.3;
  const dateY = frameBottom - bottomSafe - fontSize2*1.3;
  const textRot = (Math.random()*6-3) * Math.PI/180;

  if (caption) {
    const capText = new PIXI.Text({text:caption, style:{fontFamily:'Schoolbell', fontSize:fontSize1, fill:textColor, padding:fontSize1*0.3}});
    capText.x = -pw/2 + border*0.5 + Math.random()*pw*0.1;
    capText.y = capY;
    capText.rotation = textRot;
    capText.alpha = 1.0;
    group.addChild(capText);
  }
  if (date) {
    const dateText = new PIXI.Text({text:date, style:{fontFamily:'Schoolbell', fontSize:fontSize2, fill:textColor, padding:fontSize2*0.3}});
    dateText.x = -pw/2 + border*0.8 + Math.random()*pw*0.15;
    dateText.y = dateY;
    dateText.rotation = textRot + (Math.random()-0.5)*0.02;
    dateText.alpha = 0.95;
    group.addChild(dateText);
  }

  // Rotation
  wrapper.rotation = (Math.random()*8-4) * Math.PI/180;

  return { group: wrapper, hitTest: (mx,my) => Math.abs(mx-wrapper.x)<pw*0.6 && Math.abs(my-wrapper.y)<(ph+bottomBorder)*0.6 };
}

// ─── Render Clip ───
export async function renderClip(app, images, x, y, maxW, maxH, cfg) {
  const group = new PIXI.Container();
  group.x = x; group.y = y;

  // Render each image as a polaroid photo (reuses renderPhoto)
  const photoContainers = [];
  const origPositions = [];

  for (let i=0; i<images.length; i++) {
    const img = images[i];
    const sc = Math.min(maxW/img.w, maxH/img.h);
    const offX = i*5, offY = i*7;
    const posX = offX, posY = offY;
    const { group: photoGroup } = await renderPhoto(app, img, posX, posY, sc, {caption:'',date:''}, cfg);
    // Override rotation to be slight random
    photoGroup.rotation = (Math.random()*8-4)*Math.PI/180;
    group.addChild(photoGroup);
    photoContainers.push(photoGroup);
    origPositions.push({x: posX, y: posY});
  }
  const photoSprites = photoContainers; // alias for toggle logic

  // Paperclip SVG
  const clipTex = await PIXI.Assets.load({src:'paperclip.svg', data:{resolution:4}});
  const clipSp = new PIXI.Sprite(clipTex);
  const clipScale = Math.min(maxW*0.25/clipSp.texture.width, maxH*0.55/clipSp.texture.height);
  clipSp.scale.set(clipScale);
  clipSp.x = -maxW/2+8;
  clipSp.y = -maxH/2 - clipSp.texture.height*clipScale*0.25;
  group.addChild(clipSp);

  // Group shadow
  const clipShadow = new PIXI.Graphics();
  clipShadow.roundRect(-maxW/2+1.5, -maxH/2+1.5, maxW, maxH, 2);
  clipShadow.fill({color:0x000000, alpha:0.06});
  group.addChildAt(clipShadow, 0);

  // Split/merge toggle
  let isSplit = false;
  const splitSpread = 70;

  async function toggleSplit() {
    isSplit = !isSplit;
    if (isSplit) {
      await fadeOut(clipSp);
      // Move each photo out of group into stage as independent element
      const angleStep = Math.PI*2/photoSprites.length;
      const baseAngle = Math.random()*Math.PI*2;
      const spread = 80;
      for (let i=0; i<photoSprites.length; i++) {
        const sp = photoSprites[i];
        // Convert local position to world position
        const wx = group.x + sp.x;
        const wy = group.y + sp.y;
        group.removeChild(sp);
        sp.x = wx; sp.y = wy;
        app.stage.addChild(sp);
        // Add individual drag
        const dragState = {drag:false, offX:0, offY:0};
        const onDown = e => {
          const pw = sp.width, ph = sp.height;
          if (Math.abs(e.clientX-sp.x)<pw*0.6 && Math.abs(e.clientY-sp.y)<ph*0.6) {
            dragState.drag=true; dragState.offX=sp.x-e.clientX; dragState.offY=sp.y-e.clientY;
            app.stage.removeChild(sp); app.stage.addChild(sp);
          }
        };
        const onMove = e => { if(dragState.drag){sp.x=e.clientX+dragState.offX;sp.y=e.clientY+dragState.offY;} };
        const onUp = () => { dragState.drag=false; };
        app.canvas.addEventListener('mousedown',onDown);
        app.canvas.addEventListener('mousemove',onMove);
        app.canvas.addEventListener('mouseup',onUp);
        splitCleanups.push(()=>{app.canvas.removeEventListener('mousedown',onDown);app.canvas.removeEventListener('mousemove',onMove);app.canvas.removeEventListener('mouseup',onUp);});
      }
      // Animate spread
      await Promise.all(photoSprites.map((sp,i) => 
        animateTo(sp, sp.x + Math.cos(baseAngle+angleStep*i)*spread, sp.y + Math.sin(baseAngle+angleStep*i)*spread)
      ));
    } else {
      // Remove drag listeners
      splitCleanups.forEach(fn=>fn()); splitCleanups.length=0;
      // Move photos back into group
      for (let i=0; i<photoSprites.length; i++) {
        const sp = photoSprites[i];
        app.stage.removeChild(sp);
        sp.x = origPositions[i].x; sp.y = origPositions[i].y;
        group.addChild(sp);
      }
      await fadeIn(clipSp);
    }
  }
  const splitCleanups = [];

  // Click detection via canvas (shared approach)
  const clipHitTest = (mx, my) => {
    const worldX = group.x + clipSp.x;
    const worldY = group.y + clipSp.y;
    return Math.abs(mx - worldX) < 40 && Math.abs(my - worldY) < 40;
  };

  return { 
    group, 
    clipSprite: clipSp, 
    photoSprites,
    toggleSplit,
    clipHitTest,
    hitTest: (mx,my) => Math.abs(mx-group.x)<maxW*0.7 && Math.abs(my-group.y)<maxH*0.7 
  };
}


// ─── Render Sticky Note ───
export async function renderStickyNote(app, x, y, noteData, stampImgData, cfg) {
  // noteData: { title, body, date, stampSrc }
  const wrapper = new PIXI.Container();
  wrapper.x = x; wrapper.y = y;

  const noteW = 280;
  const padding = 20;

  // Background and shadow will be drawn after content height is known
  const bg = new PIXI.Graphics();
  wrapper.addChild(bg);
  const shadow = new PIXI.Graphics();
  wrapper.addChildAt(shadow, 0);

  // ── Title (always at top, no wrapping around obstacles) ──
  let titleBottom = padding;
  if (noteData.title) {
    const titleText = new PIXI.Text({text: noteData.title, style: {
      fontFamily: 'Special Elite', fontSize: 28, fill: 0x222222,
      wordWrap: true, wordWrapWidth: noteW - padding*2,
      padding: 8,
    }});
    titleText.x = padding;
    titleText.y = padding;
    wrapper.addChild(titleText);
    titleBottom = padding + 40;
  }

  // ── Body text with obstacle avoidance (wraps around stamp) ──
  // Build obstacles list from stamp position (calculated below)

  // ── Stamp (lower area, random position) ──
  let stampRect = null;
  if (stampImgData) {
    const stampContainer = new PIXI.Container();
    const stampW = 165, stampH = 135;
    const stampBorder = 7;
    const holeR = 2.5, holeSpacing = 11;


    const stampSprite = new PIXI.Sprite(stampImgData.tex);
    stampSprite.x = stampBorder;
    stampSprite.y = stampBorder;
    stampSprite.width = stampW - stampBorder*2;
    stampSprite.height = stampH - stampBorder*2;
    stampContainer.addChild(stampSprite);

    // Perforated edges
    const perf = new PIXI.Graphics();
    perf.rect(0, 0, stampW, stampH);
    perf.fill(0xffffff);
    for (let hx = holeSpacing/2; hx < stampW; hx += holeSpacing) {
      perf.circle(hx, 0, holeR); perf.cut();
      perf.circle(hx, stampH, holeR); perf.cut();
    }
    for (let hy = holeSpacing/2; hy < stampH; hy += holeSpacing) {
      perf.circle(0, hy, holeR); perf.cut();
      perf.circle(stampW, hy, holeR); perf.cut();
    }
    stampContainer.mask = perf;
    stampContainer.addChild(perf);

    // Random position in lower half
    const stampMinY = 80;
    const stampMaxY = 300 - stampH * 0.5; // allow bottom overflow
    const stampMinX = padding - stampW * 0.15; // allow left overflow
    const stampMaxX = noteW - stampW * 0.7; // allow right overflow
    stampContainer.x = stampMinX + Math.random() * (stampMaxX - stampMinX);
    stampContainer.y = stampMinY + Math.random() * (stampMaxY - stampMinY);
    stampContainer.rotation = (Math.random() * 10 - 5) * Math.PI / 180;
    wrapper.addChild(stampContainer);
    stampRect = {x: stampContainer.x, y: stampContainer.y, w: stampW, h: stampH};
  }

  // ── Now render body text, wrapping around stamp obstacle ──
  if (noteData.body) {
    const obstacles = stampRect ? [stampRect] : [];
    const bodyLines = layoutTextWithObstacles(noteData.body, {
      areaX: padding, areaY: titleBottom,
      areaW: noteW - padding*2,
      areaH: 250 - titleBottom, // max text area before stamp
      fontSize: 17, fontFamily: 'Special Elite', fill: 0x444444,
      obstacles,
    });
    renderTextLines(wrapper, bodyLines);
  }

  // ── Date (in whitespace, avoid stamp) ──
  if (noteData.date) {
    const dateText = new PIXI.Text({text: noteData.date, style: {
      fontFamily: 'Schoolbell', fontSize: 18, fill: 0x666666,
      padding: 6,
    }});
    // Try bottom-left, if stamp is there try other spots
    let dx = padding + Math.random()*20;
    let dy = (stampRect ? stampRect.y + stampRect.h + 8 : 200);
    if (stampRect && dx < stampRect.x + stampRect.w && dx + 80 > stampRect.x && dy < stampRect.y + stampRect.h && dy + 20 > stampRect.y) {
      // Stamp overlaps bottom-left, put date above stamp or top-right area
      dy = noteH * 0.5 + Math.random() * 30;
      if (stampRect.x < noteW/2) dx = noteW - padding - 80;
    }
    dateText.x = dx;
    dateText.y = dy;
    dateText.rotation = (Math.random() * 6 - 3) * Math.PI / 180;
    wrapper.addChild(dateText);
  }

  // Wrinkle/crease texture overlay
  const wrinkleCanvas = document.createElement('canvas');
  wrinkleCanvas.width = noteW;
  wrinkleCanvas.height = 400; // will be cropped by noteH later
  const wctx = wrinkleCanvas.getContext('2d');
  // Generate subtle noise/crease pattern
  const imgData2 = wctx.createImageData(noteW, 400);
  for (let i = 0; i < imgData2.data.length; i += 4) {
    const x = (i/4) % noteW;
    const y = Math.floor((i/4) / noteW);
    // Subtle diagonal creases
    const crease1 = Math.sin(x * 0.05 + y * 0.03) * Math.sin(x * 0.02 - y * 0.04);
    const crease2 = Math.sin(x * 0.08 - y * 0.06) * 0.5;
    const noise = (Math.random() - 0.5) * 8;
    const val = 128 + crease1 * 20 + crease2 * 10 + noise;
    imgData2.data[i] = val;
    imgData2.data[i+1] = val;
    imgData2.data[i+2] = val;
    imgData2.data[i+3] = 25; // very subtle
  }
  wctx.putImageData(imgData2, 0, 0);
  const wrinkleTex = PIXI.Texture.from(wrinkleCanvas);
  const wrinkleSprite = new PIXI.Sprite(wrinkleTex);
  wrinkleSprite.width = noteW;
  wrinkleSprite.blendMode = 'multiply';
  wrapper.addChild(wrinkleSprite);

  // Calculate actual content height
  let contentBottom = padding;
  for (const child of wrapper.children) {
    if (child === bg || child === shadow) continue;
    const b = child.y + (child.height || 0);
    if (b > contentBottom) contentBottom = b;
  }
  const noteH = contentBottom + padding;

  // Draw background and shadow with actual height
  bg.clear();
  bg.roundRect(0, 0, noteW, noteH, 4);
  bg.fill(0xfff9c4);
  shadow.clear();
  shadow.roundRect(3, 3, noteW, noteH, 4);
  shadow.fill({color:0x000000, alpha:0.1});

  // Random slight rotation
  wrapper.rotation = (Math.random() * 6 - 3) * Math.PI / 180;

  return {
    group: wrapper,
    hitTest: (mx, my) => { const h = wrapper.height; return Math.abs(mx - wrapper.x - noteW/2) < noteW*0.6 && Math.abs(my - wrapper.y - h/2) < h*0.6; },
  };
}

// ─── Render Lure ───
export function renderLure(app, x, y, cfg) {
  const group = new PIXI.Container();
  group.x = x; group.y = y;
  const bw = cfg?.style?.bodyWidth||28, bh = cfg?.style?.bodyHeight||80;
  const W = app.screen.width, H = app.screen.height;
  const sc = Math.min(W*0.15/bw, H*0.3/bh);

  const ring = new PIXI.Graphics();
  ring.circle(0,-bh*sc/2-8*sc,5*sc);
  ring.setStrokeStyle({width:2*sc,color:0x888888}); ring.stroke();
  group.addChild(ring);

  const body = new PIXI.Graphics();
  body.ellipse(0,0,bw*sc/2,bh*sc/2);
  body.fill(parseInt((cfg?.style?.bodyColor||'#cc3333').replace('#',''),16));
  group.addChild(body);

  const accent = new PIXI.Graphics();
  accent.ellipse(0,0,bw*sc/4,bh*sc/3);
  accent.fill({color:parseInt((cfg?.style?.bodyAccent||'#ffcc33').replace('#',''),16),alpha:0.5});
  group.addChild(accent);

  const eye = new PIXI.Graphics();
  eye.circle(bw*sc/5,-bh*sc/5,3*sc);
  eye.fill(0xffffff);
  eye.circle(bw*sc/5,-bh*sc/5,1.5*sc);
  eye.fill(0x000000);
  group.addChild(eye);

  const hook = new PIXI.Graphics();
  hook.setStrokeStyle({width:2*sc,color:parseInt((cfg?.style?.hookColor||'#888888').replace('#',''),16),cap:'round'});
  hook.moveTo(0,bh*sc/2); hook.lineTo(0,bh*sc/2+15*sc);
  hook.moveTo(-6*sc,bh*sc/2+15*sc); hook.quadraticCurveTo(-8*sc,bh*sc/2+25*sc,0,bh*sc/2+15*sc);
  hook.moveTo(6*sc,bh*sc/2+15*sc); hook.quadraticCurveTo(8*sc,bh*sc/2+25*sc,0,bh*sc/2+15*sc);
  hook.moveTo(0,bh*sc/2+15*sc); hook.quadraticCurveTo(0,bh*sc/2+26*sc,-3*sc,bh*sc/2+20*sc);
  hook.stroke();
  group.addChild(hook);

  return { group, hitTest: (mx,my) => Math.abs(mx-group.x)<bw*sc && Math.abs(my-group.y)<bh*sc };
}
// ─── PhotoSystem — manages photos with clip merge/split behavior ───
export class PhotoSystem {
  constructor(app, canvas, atomsConfig) {
    this.app = app;
    this.canvas = canvas;
    this.config = atomsConfig;
    this.photos = [];
    this.clipGroups = [];
    this._activeDrag = null; // only one photo dragged at a time
    this._setupClickHandler();
  }

  async addPhoto(imgSrc, x, y, scale, meta) {
    const imgData = await loadImagePixels(imgSrc);
    const sc = scale || Math.min(200/imgData.w, 300/imgData.h);
    const { group } = await renderPhoto(this.app, imgData, x, y, sc, meta, this.config?.photo);
    this.app.stage.addChild(group);
    const photo = { group, imgData, scale: sc, config: meta, clipped: false, splitCooldown: 0 };
    this.photos.push(photo);
    this._makePhotoDraggable(photo);
    return photo;
  }

  _getPhotoBounds(p) {
    const pw = p.imgData.w*p.scale, ph = p.imgData.h*p.scale;
    const border = pw*0.06, bottomBorder = border*3;
    const totalW = pw+border*2;
    const totalH = ph+border+bottomBorder;
    // Frame is NOT vertically centered: top = -ph/2-border, bottom = ph/2+bottomBorder
    const top = p.group.y - ph/2 - border;
    const left = p.group.x - pw/2 - border;
    return { x: left, y: top, w: totalW, h: totalH };
  }

  _overlapRatio(a, b) {
    const ax2=a.x+a.w, ay2=a.y+a.h, bx2=b.x+b.w, by2=b.y+b.h;
    const ox = Math.max(0, Math.min(ax2,bx2)-Math.max(a.x,b.x));
    const oy = Math.max(0, Math.min(ay2,by2)-Math.max(a.y,b.y));
    const overlap = ox*oy;
    const smaller = Math.min(a.w*a.h, b.w*b.h);
    return smaller>0 ? overlap/smaller : 0;
  }

  async _mergePhotos(droppedPhoto, targetPhoto) {
    let existingClip = this.clipGroups.find(cg => cg.photos.includes(targetPhoto));
    if (existingClip) {
      droppedPhoto.clipped = true;
      existingClip.photos.push(droppedPhoto);
      // Align top-left to first photo
      const first = existingClip.photos[0];
      const fPw = first.imgData.w*first.scale;
      const fPh = first.imgData.h*first.scale;
      const fBorder = fPw*0.06;
      const firstTop = first.group.y - fPh/2 - fBorder;
      const firstLeft = first.group.x - fPw/2 - fBorder;
      const dPw2 = droppedPhoto.imgData.w*droppedPhoto.scale;
      const dPh2 = droppedPhoto.imgData.h*droppedPhoto.scale;
      const dBorder2 = dPw2*0.06;
      await animateTo(droppedPhoto.group, firstLeft + dPw2/2 + dBorder2, firstTop + dPh2/2 + dBorder2);
      // Update clip position
      existingClip.clipSprite.x = firstLeft + fPw * 0.15;
      existingClip.clipSprite.y = firstTop;
      return;
    }
    if (droppedPhoto.clipped || targetPhoto.clipped) return;
    droppedPhoto.clipped = true; targetPhoto.clipped = true;

    // Align top-left: simple calculation from group center coords
    // Top of a photo = group.y - ph/2 - border
    // Left of a photo = group.x - pw/2 - border
    const tPw = targetPhoto.imgData.w*targetPhoto.scale;
    const tPh = targetPhoto.imgData.h*targetPhoto.scale;
    const tBorder = tPw*0.06;
    const dPw = droppedPhoto.imgData.w*droppedPhoto.scale;
    const dPh = droppedPhoto.imgData.h*droppedPhoto.scale;
    const dBorder = dPw*0.06;
    // Target top/left in world coords
    const targetTop = targetPhoto.group.y - tPh/2 - tBorder;
    const targetLeft = targetPhoto.group.x - tPw/2 - tBorder;
    // Dropped needs: group.y such that its top = targetTop
    const droppedCy = targetTop + dPh/2 + dBorder;
    const droppedCx = targetLeft + dPw/2 + dBorder;
    await Promise.all([
      animateTo(targetPhoto.group, targetPhoto.group.x, targetPhoto.group.y), // stays
      animateTo(droppedPhoto.group, droppedCx, droppedCy),
    ]);


    try {
      const clipTex = await PIXI.Assets.load({src:'paperclip.svg', data:{resolution:4}});
      const clipSp = new PIXI.Sprite(clipTex);
      const pw = droppedPhoto.imgData.w * droppedPhoto.scale;
      const ph = droppedPhoto.imgData.h * droppedPhoto.scale;
      const border = pw*0.06;
      const clipScale = Math.min(pw*0.35/clipSp.texture.width, ph*0.5/clipSp.texture.height);
      clipSp.scale.set(clipScale);
      clipSp.anchor.set(0.5, 0.5);
      // Top-left corner, protruding above photos
      clipSp.x = targetLeft + tPw * 0.15;
      clipSp.y = targetTop;
      clipSp.alpha = 0;
      clipSp.zIndex = 9999;
      this.app.stage.addChild(clipSp);
      await fadeIn(clipSp);
      const clipInfo = { clipSprite: clipSp, photos: [targetPhoto, droppedPhoto] };
      this.clipGroups.push(clipInfo);
    } catch(err) {
      console.error('Failed to load paperclip:', err);
      droppedPhoto.clipped = false; targetPhoto.clipped = false;
    }
  }

  async _splitPhotos(clipInfo) {
    const { clipSprite, photos: clipPhotos } = clipInfo;
    await fadeOut(clipSprite);
    this.app.stage.removeChild(clipSprite);
    clipSprite.destroy();

    const cx = clipPhotos[0].group.x, cy = clipPhotos[0].group.y;
    const spread = 60 + Math.random()*40;
    const angleStep = Math.PI*2 / clipPhotos.length;
    const baseAngle = Math.random()*Math.PI*2;
    await Promise.all(clipPhotos.map((p,i) =>
      animateTo(p.group, cx+Math.cos(baseAngle+angleStep*i)*spread, cy+Math.sin(baseAngle+angleStep*i)*spread)
    ));
    clipPhotos.forEach(p => { p.clipped = false; p.splitCooldown = Date.now()+500; });
    const idx = this.clipGroups.indexOf(clipInfo);
    if (idx>=0) this.clipGroups.splice(idx, 1);
  }

  _makePhotoDraggable(photo) {
    let drag = false, offX = 0, offY = 0;
    const hitTest = (mx,my) => {
      const pw = photo.imgData.w*photo.scale, ph = photo.imgData.h*photo.scale;
      return Math.abs(mx-photo.group.x)<pw*0.6 && Math.abs(my-photo.group.y)<ph*0.6;
    };
    const onDown = e => {
      if (photo.clipped || this._activeDrag) return;
      const mx = e.clientX, my = e.clientY;
      // Check this photo is the topmost hit
      let topPhoto = null;
      for (const p of this.photos) {
        if (p.clipped) continue;
        const pw2 = p.imgData.w*p.scale, ph2 = p.imgData.h*p.scale;
        if (Math.abs(mx-p.group.x)<pw2*0.6 && Math.abs(my-p.group.y)<ph2*0.6) {
          if (!topPhoto || this.app.stage.children.indexOf(p.group) > this.app.stage.children.indexOf(topPhoto.group)) {
            topPhoto = p;
          }
        }
      }
      if (topPhoto !== photo) return;
      if (hitTest(mx,my)) {
        drag = true; offX = photo.group.x-mx; offY = photo.group.y-my;
        this._activeDrag = photo;
        photo.group.scale.set(1.05);
        this.app.stage.removeChild(photo.group);
        this.app.stage.addChild(photo.group);
      }
    };
    const onMove = e => {
      if (drag) {
        photo.group.x = e.clientX+offX;
        photo.group.y = e.clientY+offY;
      }
      // Hover scale + cursor
      const hovering = !drag && hitTest(e.clientX, e.clientY) && !photo.clipped;
      const targetScale = hovering || drag ? 1.05 : 1.0;
      const cur = photo.group.scale.x;
      photo.group.scale.set(cur + (targetScale - cur) * 0.15);
      if (hovering) this.canvas.style.cursor = 'pointer';
    };
    const onUp = () => {
      if (!drag) return;
      drag = false;
      this._activeDrag = null;
      // Reset scale
      photo.group.scale.set(1.0);
      if (photo.clipped) return;
      const boundsA = this._getPhotoBounds(photo);
      // Check overlap with unclipped photos (new merge)
      for (const other of this.photos) {
        if (other===photo || photo.clipped) continue;
        if (photo.splitCooldown && Date.now()<photo.splitCooldown) continue;
        if (other.splitCooldown && Date.now()<other.splitCooldown) continue;
        const boundsB = this._getPhotoBounds(other);
        if (this._overlapRatio(boundsA, boundsB)>0.2) {
          this._mergePhotos(photo, other);
          return;
        }
      }
    };
    this.canvas.addEventListener('mousedown', onDown);
    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseup', onUp);

    // Touch support
    let longPress = null, touchMoved = false;
    this.canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchMoved = false;
      longPress = setTimeout(() => {
        if (!touchMoved) onDown({clientX:t.clientX, clientY:t.clientY});
      }, 300);
    });
    this.canvas.addEventListener('touchmove', e => {
      touchMoved = true;
      if (longPress) { clearTimeout(longPress); longPress = null; }
      if (drag) {
        e.preventDefault();
        const t = e.touches[0];
        onMove({clientX:t.clientX, clientY:t.clientY});
      }
    }, {passive:false});
    this.canvas.addEventListener('touchend', () => {
      if (longPress) { clearTimeout(longPress); longPress = null; }
      onUp();
    });
  }

  _setupClickHandler() {
    let groupDrag = null, groupOffX = 0, groupOffY = 0;

    this.canvas.addEventListener('mousedown', e => {
      const mx = e.clientX, my = e.clientY;
      // Check clip click (split)
      for (const cg of [...this.clipGroups]) {
        const cs = cg.clipSprite;
        if (Math.abs(mx-cs.x)<60 && Math.abs(my-cs.y)<60) {
          this._splitPhotos(cg);
          return;
        }
      }
      // Check click on clipped photos (drag whole group)
      for (const cg of this.clipGroups) {
        for (const p of cg.photos) {
          const pw = p.imgData.w*p.scale, ph = p.imgData.h*p.scale;
          if (Math.abs(mx-p.group.x)<pw*0.6 && Math.abs(my-p.group.y)<ph*0.6) {
            groupDrag = cg;
            groupOffX = mx; groupOffY = my;
            // Scale up group
            for (const gp of cg.photos) gp.group.scale.set(1.05);
            return;
          }
        }
      }
    });
    this.canvas.addEventListener('mousemove', e => {
      if (groupDrag) {
        const dx = e.clientX - groupOffX, dy = e.clientY - groupOffY;
        for (const p of groupDrag.photos) { p.group.x += dx; p.group.y += dy; }
        groupDrag.clipSprite.x += dx; groupDrag.clipSprite.y += dy;
        groupOffX = e.clientX; groupOffY = e.clientY;
        return;
      }
      // Cursor: check if hovering any interactive element
      let hovering = false;
      const mx = e.clientX, my = e.clientY;
      for (const p of this.photos) {
        if (p.clipped) continue;
        const pw = p.imgData.w*p.scale, ph = p.imgData.h*p.scale;
        if (Math.abs(mx-p.group.x)<pw*0.6 && Math.abs(my-p.group.y)<ph*0.6) { hovering = true; break; }
      }
      if (!hovering) {
        for (const cg of this.clipGroups) {
          const cs = cg.clipSprite;
          if (Math.abs(mx-cs.x)<60 && Math.abs(my-cs.y)<60) { hovering = true; break; }
          for (const p of cg.photos) {
            const pw = p.imgData.w*p.scale, ph = p.imgData.h*p.scale;
            if (Math.abs(mx-p.group.x)<pw*0.6 && Math.abs(my-p.group.y)<ph*0.6) { hovering = true; break; }
          }
          if (hovering) break;
        }
      }
      this.canvas.style.cursor = hovering ? 'pointer' : 'default';
      // Hover scale for clipped groups
      for (const cg of this.clipGroups) {
        let groupHovered = false;
        for (const p of cg.photos) {
          const pw2 = p.imgData.w*p.scale, ph2 = p.imgData.h*p.scale;
          if (Math.abs(mx-p.group.x)<pw2*0.6 && Math.abs(my-p.group.y)<ph2*0.6) { groupHovered = true; break; }
        }
        const ts = groupHovered || groupDrag===cg ? 1.05 : 1.0;
        for (const p of cg.photos) { const c=p.group.scale.x; p.group.scale.set(c+(ts-c)*0.15); }
      }
    });
    this.canvas.addEventListener('mouseup', () => { if(groupDrag){ for(const gp of groupDrag.photos) gp.group.scale.set(1.0); } groupDrag = null; });

    // Touch tap for clip split
    this.canvas.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      if (!t) return;
      const mx = t.clientX, my = t.clientY;
      for (const cg of [...this.clipGroups]) {
        const cs = cg.clipSprite;
        if (Math.abs(mx-cs.x)<60 && Math.abs(my-cs.y)<60) { this._splitPhotos(cg); return; }
      }
    });
  }
}
