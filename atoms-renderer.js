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




// ─── Stamp perforation mask (shared) ───
// Draws rectangle with semi-circles CUT INTO edges (like real postage stamps)
function createStampMask(w, h, toothR, toothSpacing) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  const ctx = c.getContext('2d');

  // Full white rectangle
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);

  // Cut semi-circles along edges (circles centered ON the edge → half inside, half outside)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'black';
  for (let x = toothSpacing / 2; x < w; x += toothSpacing) {
    ctx.beginPath(); ctx.arc(x, 0, toothR, 0, Math.PI * 2); ctx.fill(); // top
    ctx.beginPath(); ctx.arc(x, h, toothR, 0, Math.PI * 2); ctx.fill(); // bottom
  }
  for (let y = toothSpacing / 2; y < h; y += toothSpacing) {
    ctx.beginPath(); ctx.arc(0, y, toothR, 0, Math.PI * 2); ctx.fill(); // left
    ctx.beginPath(); ctx.arc(w, y, toothR, 0, Math.PI * 2); ctx.fill(); // right
  }

  const sprite = new PIXI.Sprite(PIXI.Texture.from(c));
  return sprite;
}

// ─── Render Stamp (standalone atom) ───
export async function renderStamp(app, stampImgData, x, y, cfg, options) {
  const wrapper = new PIXI.Container();
  wrapper.x = x; wrapper.y = y;

  // Size adapts to image aspect ratio
  const maxStampW = options?.maxW ?? 250;
  const imgRatio = stampImgData.h / stampImgData.w;
  const stampW = Math.min(maxStampW, stampImgData.w * 0.3);
  const stampH = stampW * imgRatio;

  const toothR = cfg?.style?.toothRadius ?? 4;
  const toothSp = cfg?.style?.toothSpacing ?? 14;

  // Shadow with same perforated shape, offset
  const shadowMask = createStampMask(stampW, stampH, toothR, toothSp);
  const shadowGroup = new PIXI.Container();
  shadowGroup.x = 1.2; shadowGroup.y = 1.2;
  const shadowFill = new PIXI.Graphics();
  shadowFill.rect(0, 0, stampW, stampH);
  shadowFill.fill({color: 0x000000, alpha: 0.12});
  shadowGroup.addChild(shadowFill);
  shadowGroup.addChild(shadowMask);
  shadowGroup.mask = shadowMask;
  wrapper.addChild(shadowGroup);

  // Masked content group (image clipped by perforated mask directly)
  const masked = new PIXI.Container();
  wrapper.addChild(masked);

  // Stamp image fills entire area, mask punches holes at edges
  const stampSprite = new PIXI.Sprite(stampImgData.tex);
  stampSprite.width = stampW;
  stampSprite.height = stampH;
  masked.addChild(stampSprite);

  // Perforated edge mask
  const perf = createStampMask(stampW, stampH, toothR, toothSp);
  masked.addChild(perf);
  masked.mask = perf;

  // Slight random rotation
  wrapper.rotation = (Math.random() * 10 - 5) * Math.PI / 180;

  return {
    group: wrapper, stampW, stampH,
    hitTest: (mx, my) => Math.abs(mx - wrapper.x - stampW/2) < stampW*0.6 && Math.abs(my - wrapper.y - stampH/2) < stampH*0.6,
  };
}

// ─── Render Sticky Note ───
export async function renderStickyNote(app, x, y, noteData, stampImgData, cfg) {
  // noteData: { title, body, date, stampSrc }
  const wrapper = new PIXI.Container();
  wrapper.x = x; wrapper.y = y;

  const noteW = 280;
  const padding = 20;

  // Shadow (same style as photo — simple offset roundRect)
  const shadow = new PIXI.Graphics();
  wrapper.addChildAt(shadow, 0);

  // Background
  const bg = new PIXI.Graphics();
  wrapper.addChild(bg);

  // ── Title (always at top, no wrapping around obstacles) ──
  let titleBottom = padding;
  let bodyBottom = titleBottom;
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

  // ── Stamp (lower area, random position) — reuses renderStamp() ──
  let stampRect = null;
  let stampW = 0, stampH = 0;
  let stampContainer = null;
  if (stampImgData) {
    const stampResult = await renderStamp(app, stampImgData, 0, 0, cfg, { maxW: 160 });
    stampContainer = stampResult.group;
    stampW = stampResult.stampW;
    stampH = stampResult.stampH;

    // Random position near an edge (not center)
    const edge = Math.floor(Math.random() * 4); // 0=right, 1=bottom, 2=left, 3=bottom-right
    let sx, sy;
    if (edge === 0) { // right edge
      sx = noteW - stampW * (0.6 + Math.random()*0.2);
      sy = 60 + Math.random() * 120;
    } else if (edge === 1) { // bottom edge
      sx = padding + Math.random() * (noteW - stampW - padding);
      sy = 200 - stampH * (0.3 + Math.random()*0.3);
    } else if (edge === 2) { // left edge
      sx = -stampW * (0.1 + Math.random()*0.15);
      sy = 60 + Math.random() * 120;
    } else { // bottom-right corner
      sx = noteW - stampW * (0.7 + Math.random()*0.2);
      sy = 200 - stampH * (0.2 + Math.random()*0.3);
    }
    stampContainer.x = sx;
    stampContainer.y = sy;
    // renderStamp already applies random rotation
    wrapper.addChild(stampContainer);
    stampRect = {x: sx, y: sy, w: stampW, h: stampH};
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
    // Track bottom of body text
    if (bodyLines.length > 0) {
      const lastLine = bodyLines[bodyLines.length - 1];
      bodyBottom = lastLine.y + (lastLine.fontSize || 17) * 1.4;
    }
  }

  // ── Date (always below body text and stamp) ──
  if (noteData.date) {
    const dateText = new PIXI.Text({text: noteData.date, style: {
      fontFamily: 'Schoolbell', fontSize: 18, fill: 0x666666,
      padding: 6,
    }});
    // Place below the lowest content (body text or stamp)
    let lowestY = bodyBottom;
    if (stampRect) lowestY = Math.max(lowestY, stampRect.y + stampRect.h);
    dateText.x = padding + Math.random() * 20;
    dateText.y = lowestY + 8;
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
    // Broad, gentle creases (low frequency, large areas)
    const crease1 = Math.sin(x * 0.012 + y * 0.008) * Math.sin(x * 0.006 - y * 0.01);
    const crease2 = Math.sin(x * 0.02 - y * 0.015) * 0.5;
    const noise = (Math.random() - 0.5) * 4;
    const val = 128 + crease1 * 25 + crease2 * 15 + noise;
    imgData2.data[i] = val;
    imgData2.data[i+1] = val;
    imgData2.data[i+2] = val;
    imgData2.data[i+3] = 30; // subtle
  }
  wctx.putImageData(imgData2, 0, 0);
  const wrinkleTex = PIXI.Texture.from(wrinkleCanvas);
  const wrinkleSprite = new PIXI.Sprite(wrinkleTex);
  wrinkleSprite.width = noteW;
  wrinkleSprite.blendMode = 'multiply';
  wrapper.addChild(wrinkleSprite);
  // Move stamp above wrinkle so it is not affected by texture
  if (stampContainer) { wrapper.removeChild(stampContainer); wrapper.addChild(stampContainer); }

  // Calculate actual content height from known content positions
  let contentBottom = titleBottom; // at least title height
  // Check body text lines
  for (const child of wrapper.children) {
    if (child === bg || child === shadow || child === wrinkleSprite) continue;
    if (child === stampContainer) {
      // Use actual stamp position + height (not rotated bounds)
      const sb = stampContainer.y + stampH;
      if (sb > contentBottom) contentBottom = sb;
      continue;
    }
    // For text elements, use y + fontSize estimate
    const b = child.y + (child.style ? child.style.fontSize * 1.3 : (child.height || 0));
    if (b > contentBottom) contentBottom = b;
  }
  const noteH = contentBottom + padding * 0.6;

  // Draw background with actual height
  bg.clear();
  bg.roundRect(0, 0, noteW, noteH, 4);
  bg.fill(0xfff9c4);

  // Draw shadow (same as photo style)
  shadow.clear();
  shadow.roundRect(3, 3, noteW, noteH, 3);
  shadow.fill({color: 0x000000, alpha: 0.12});

  // Resize wrinkle to match note height
  wrinkleSprite.height = noteH;

  // Stamp is above wrinkle layer - inside is bright, outside against dark bg looks natural

  // Random slight rotation (keep subtle — ±1.5°)
  wrapper.rotation = (Math.random() * 3 - 1.5) * Math.PI / 180;

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
    const pw = imgData.w*sc, ph = imgData.h*sc;
    const border = pw*0.06, bottomBorder = border*3;
    const photo = {
      group, imgData, scale: sc, config: meta, clipped: false, splitCooldown: 0,
      // anchor = offset from group origin (photo center) to bounds top-left
      itemW: pw+border*2, itemH: ph+border+bottomBorder,
      anchorX: pw/2 + border, anchorY: ph/2 + border,
      baseScale: 1.0, // group.scale base value (may be overridden externally)
    };
    this.photos.push(photo);
    this._makePhotoDraggable(photo);
    return photo;
  }

  // Add any pre-rendered atom (sticky note, stamp, etc.) into the clip system
  addItem(group, w, h) {
    this.app.stage.addChild(group);
    const item = {
      group, clipped: false, splitCooldown: 0,
      itemW: w, itemH: h,
      anchorX: 0, anchorY: 0, // group origin is top-left for these atoms
      baseScale: group.scale.x, // preserve initial scale set externally
    };
    this.photos.push(item);
    this._makePhotoDraggable(item);
    return item;
  }

  _getPhotoBounds(p) {
    const s = p.group.scale.x;
    return {
      x: p.group.x - p.anchorX * s,
      y: p.group.y - p.anchorY * s,
      w: p.itemW * s,
      h: p.itemH * s,
    };
  }

  _overlapRatio(a, b) {
    const ax2=a.x+a.w, ay2=a.y+a.h, bx2=b.x+b.w, by2=b.y+b.h;
    const ox = Math.max(0, Math.min(ax2,bx2)-Math.max(a.x,b.x));
    const oy = Math.max(0, Math.min(ay2,by2)-Math.max(a.y,b.y));
    const overlap = ox*oy;
    const smaller = Math.min(a.w*a.h, b.w*b.h);
    return smaller>0 ? overlap/smaller : 0;
  }

  async _mergePhotos(droppedItem, targetItem) {
    let existingClip = this.clipGroups.find(cg => cg.photos.includes(targetItem));
    if (existingClip) {
      droppedItem.clipped = true;
      existingClip.photos.push(droppedItem);
      const firstBounds = this._getPhotoBounds(existingClip.photos[0]);
      const dBounds = this._getPhotoBounds(droppedItem);
      await animateTo(droppedItem.group, firstBounds.x + droppedItem.anchorX, firstBounds.y + droppedItem.anchorY);
      existingClip.clipSprite.x = firstBounds.x + firstBounds.w * 0.15;
      existingClip.clipSprite.y = firstBounds.y;
      return;
    }
    if (droppedItem.clipped || targetItem.clipped) return;
    droppedItem.clipped = true; targetItem.clipped = true;

    const tBounds = this._getPhotoBounds(targetItem);
    // Align dropped item's top-left to target's top-left
    await Promise.all([
      animateTo(targetItem.group, targetItem.group.x, targetItem.group.y),
      animateTo(droppedItem.group, tBounds.x + droppedItem.anchorX, tBounds.y + droppedItem.anchorY),
    ]);

    try {
      const clipTex = await PIXI.Assets.load({src:'paperclip.svg', data:{resolution:4}});
      const clipSp = new PIXI.Sprite(clipTex);
      const smaller = Math.min(tBounds.w, tBounds.h);
      const clipScale = Math.min(smaller*0.35/clipSp.texture.width, smaller*0.5/clipSp.texture.height);
      clipSp.scale.set(clipScale);
      clipSp.anchor.set(0.5, 0.5);
      clipSp.x = tBounds.x + tBounds.w * 0.15;
      const clipTargetY = tBounds.y;
      clipSp.y = clipTargetY - 30;
      clipSp.alpha = 0;
      clipSp.zIndex = 9999;
      this.app.stage.addChild(clipSp);
      // Slide in from above + fade in
      await Promise.all([animateTo(clipSp, clipSp.x, clipTargetY, 300), fadeIn(clipSp, 300)]);
      this.clipGroups.push({ clipSprite: clipSp, photos: [targetItem, droppedItem] });
    } catch(err) {
      console.error('Failed to load paperclip:', err);
      droppedItem.clipped = false; targetItem.clipped = false;
    }
  }

  async _splitPhotos(clipInfo) {
    const { clipSprite, photos: clipPhotos } = clipInfo;
    // Slide up + fade out
    await Promise.all([
      animateTo(clipSprite, clipSprite.x, clipSprite.y - 30, 250),
      fadeOut(clipSprite, 250),
    ]);
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
    let downTime = 0, downX = 0, downY = 0, moved = false;
    const hitTest = (mx,my) => {
      const b = this._getPhotoBounds(photo);
      return mx > b.x && mx < b.x+b.w && my > b.y && my < b.y+b.h;
    };
    const onDown = e => {
      if (photo.clipped || this._activeDrag) return;
      const mx = e.clientX, my = e.clientY;
      // Check this item is the topmost hit
      let topPhoto = null;
      for (const p of this.photos) {
        if (p.clipped) continue;
        const b = this._getPhotoBounds(p);
        if (mx > b.x && mx < b.x+b.w && my > b.y && my < b.y+b.h) {
          if (!topPhoto || this.app.stage.children.indexOf(p.group) > this.app.stage.children.indexOf(topPhoto.group)) {
            topPhoto = p;
          }
        }
      }
      if (topPhoto !== photo) return;
      if (hitTest(mx,my)) {
        drag = true; offX = photo.group.x-mx; offY = photo.group.y-my;
        downTime = Date.now(); downX = mx; downY = my; moved = false;
        this._activeDrag = photo;
        photo.group.scale.set(photo.baseScale * 1.05);
        this.app.stage.removeChild(photo.group);
        this.app.stage.addChild(photo.group);
      }
    };
    const onMove = e => {
      if (drag) {
        photo.group.x = e.clientX+offX;
        photo.group.y = e.clientY+offY;
        if (Math.abs(e.clientX-downX)>5 || Math.abs(e.clientY-downY)>5) moved = true;
      }
      // Hover scale + cursor
      const hovering = !drag && hitTest(e.clientX, e.clientY) && !photo.clipped;
      const targetScale = (hovering || drag ? 1.05 : 1.0) * photo.baseScale;
      const cur = photo.group.scale.x;
      photo.group.scale.set(cur + (targetScale - cur) * 0.15);
      if (hovering) this.canvas.style.cursor = 'pointer';
    };
    const onUp = e => {
      if (!drag) return;
      const wasClick = !moved && (Date.now() - downTime) < 200;
      drag = false;
      this._activeDrag = null;
      photo.group.scale.set(photo.baseScale);

      // Click → focus overlay
      if (wasClick && photo.focusData && this.onFocus) {
        this.onFocus(photo);
        return;
      }

      if (photo.clipped) return;
      const boundsA = this._getPhotoBounds(photo);
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
        if (Math.abs(mx-cs.x)<cs.width*0.6 && Math.abs(my-cs.y)<cs.height*0.6) {
          this._splitPhotos(cg);
          return;
        }
      }
      // Check click on clipped items (drag whole group)
      for (const cg of this.clipGroups) {
        for (const p of cg.photos) {
          const b = this._getPhotoBounds(p);
          if (mx>b.x && mx<b.x+b.w && my>b.y && my<b.y+b.h) {
            groupDrag = cg;
            groupOffX = mx; groupOffY = my;
            for (const gp of cg.photos) gp.group.scale.set(gp.baseScale * 1.05);
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
        if (groupDrag.clipSprite._baseY !== undefined) groupDrag.clipSprite._baseY += dy;
        groupOffX = e.clientX; groupOffY = e.clientY;
        return;
      }
      let hovering = false;
      const mx = e.clientX, my = e.clientY;
      for (const p of this.photos) {
        if (p.clipped) continue;
        const b = this._getPhotoBounds(p);
        if (mx>b.x && mx<b.x+b.w && my>b.y && my<b.y+b.h) { hovering = true; break; }
      }
      if (!hovering) {
        for (const cg of this.clipGroups) {
          const cs = cg.clipSprite;
          if (Math.abs(mx-cs.x)<cs.width*0.6 && Math.abs(my-cs.y)<cs.height*0.6) { hovering = true; break; }
          for (const p of cg.photos) {
            const b = this._getPhotoBounds(p);
            if (mx>b.x && mx<b.x+b.w && my>b.y && my<b.y+b.h) { hovering = true; break; }
          }
          if (hovering) break;
        }
      }
      this.canvas.style.cursor = hovering ? 'pointer' : 'default';
      for (const cg of this.clipGroups) {
        const cs = cg.clipSprite;
        const clipHovered = Math.abs(mx-cs.x)<cs.width*0.6 && Math.abs(my-cs.y)<cs.height*0.6;
        // Clip lifts up when hovered to hint it's clickable
        if (cs._baseY === undefined) cs._baseY = cs.y;
        const targetY = clipHovered ? cs._baseY - 8 : cs._baseY;
        cs.y += (targetY - cs.y) * 0.15;

        let groupHovered = clipHovered;
        if (!groupHovered) {
          for (const p of cg.photos) {
            const b = this._getPhotoBounds(p);
            if (mx>b.x && mx<b.x+b.w && my>b.y && my<b.y+b.h) { groupHovered = true; break; }
          }
        }
        for (const p of cg.photos) { const ts = (groupHovered || groupDrag===cg ? 1.05 : 1.0) * p.baseScale; const c=p.group.scale.x; p.group.scale.set(c+(ts-c)*0.15); }
      }
    });
    this.canvas.addEventListener('mouseup', () => { if(groupDrag){ for(const gp of groupDrag.photos) gp.group.scale.set(gp.baseScale); } groupDrag = null; });

    // Touch tap for clip split
    this.canvas.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      if (!t) return;
      const mx = t.clientX, my = t.clientY;
      for (const cg of [...this.clipGroups]) {
        const cs = cg.clipSprite;
        if (Math.abs(mx-cs.x)<cs.width*0.6 && Math.abs(my-cs.y)<cs.height*0.6) { this._splitPhotos(cg); return; }
      }
    });
  }
}

// ─── Focus Overlay — click-to-detail with paper curl effect ───
export class FocusOverlay {
  constructor(app) {
    this.app = app;
    this.overlay = document.getElementById('focus-overlay');
    this.backdrop = document.getElementById('focus-backdrop');
    this.titleEl = document.getElementById('focus-title');
    this.descEl = document.getElementById('focus-desc');
    this.linkEl = document.getElementById('focus-link');
    this.closeBtn = document.getElementById('focus-close');
    this.activeItem = null;
    this.mesh = null;
    this.origX = 0; this.origY = 0; this.origScale = 1;

    this.dimLayer = new PIXI.Graphics();
    this.dimLayer.visible = false;
    this.blurFilter = new PIXI.BlurFilter({ strength: 0, quality: 4 });

    this.backdrop.addEventListener('click', () => {
      if (this._articleMode) this.closeArticle();
      else this.close();
    });
    this.closeBtn.addEventListener('click', () => {
      if (this._articleMode) this.closeArticle();
      else this.close();
    });

    // Article element (lives inside overlay)
    this.articleEl = document.getElementById('focus-article');
    this._articleMode = false;
    this._heroImg = null;

    // Wire focus link to open article instead of navigating
    this.linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.activeItem?.focusData?.article) {
        this.openArticle();
      }
    });
  }

  _animateDim(fromAlpha, toAlpha, fromBlur, toBlur, duration) {
    const start = performance.now();
    const W = this.app.screen.width, H = this.app.screen.height;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const alpha = fromAlpha + (toAlpha - fromAlpha) * ease;
      const blur = fromBlur + (toBlur - fromBlur) * ease;
      this.dimLayer.clear();
      this.dimLayer.rect(0, 0, W, H);
      this.dimLayer.fill({ color: 0x000000, alpha });
      this.blurFilter.strength = blur;
      this._currentDimAlpha = alpha;
      this._currentDimBlur = blur;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Paper curl: a single wave sweeping from bottom-right to top-left
  // progress = 0 (flat) → 1 (wave has fully passed through entire sheet)
  _applyPaperCurl(buffer, origPositions, baseW, baseH, progress) {
    const waveWidth = 1.2;  // width of the wave bump (wider = gentler, more gradual)
    const liftStrength = 0.06; // how high the wave lifts (fraction of baseH)
    const xPull = 0.04; // horizontal pull strength

    for (let i = 0; i < origPositions.length; i += 2) {
      const ox = origPositions[i], oy = origPositions[i + 1];
      const nx = ox / baseW;
      const ny = oy / baseH;

      // Distance from bottom-right corner, normalized 0-1
      const dist = Math.sqrt((1 - nx) * (1 - nx) + (1 - ny) * (1 - ny)) / 1.414;

      // Wave front travels from 0 to 1 + waveWidth (so it fully exits the sheet)
      const waveFront = progress * (1 + waveWidth);
      const delta = waveFront - dist;

      // Single smooth sine bump
      let lift = 0;
      if (delta > 0 && delta < waveWidth) {
        lift = Math.sin(delta / waveWidth * Math.PI) * liftStrength;
      }

      buffer.data[i] = ox - lift * baseW * xPull * (1 - nx);
      buffer.data[i + 1] = oy - lift * baseH;
    }
    buffer.update();
  }

  open(item) {
    if (this.activeItem) return;
    this.activeItem = item;
    this.overlay.scrollTop = 0;
    const W = this.app.screen.width, H = this.app.screen.height;

    this.origX = item.group.x;
    this.origY = item.group.y;
    this.origScale = item.group.scale.x;
    this.origRotation = item.group.rotation || 0;

    // Target center position (pivot is at mesh center, so target = screen center)
    const targetScale = 1.3;

    // Wrap background into blur container
    this.bgContainer = new PIXI.Container();
    this.bgChildren = [...this.app.stage.children];
    for (const child of this.bgChildren) this.bgContainer.addChild(child);
    this.bgContainer.filters = [this.blurFilter];
    this.blurFilter.strength = 0;
    this.app.stage.addChild(this.bgContainer);

    // Dim layer
    this.dimLayer.clear();
    this.dimLayer.rect(0, 0, W, H);
    this.dimLayer.fill({ color: 0x000000, alpha: 0 });
    this.dimLayer.visible = true;
    this.app.stage.addChild(this.dimLayer);
    this._animateDim(0, 0.8, 0, 10, 500);

    // Extract texture from the item group
    const tex = this.app.renderer.extract.texture(item.group);
    const meshW = item.itemW * this.origScale;
    const meshH = item.itemH * this.origScale;

    // Hide original, remove from bg
    this.bgContainer.removeChild(item.group);
    item.group.visible = false;

    // Create MeshPlane with pivot at center for clean rotation
    const mesh = new PIXI.MeshPlane({ texture: tex, verticesX: 20, verticesY: 20 });
    mesh.width = meshW;
    mesh.height = meshH;
    // Pivot must use LOCAL (geometry) coordinates, not display size
    // MeshPlane native size comes from the texture dimensions
    const localW = tex.width;
    const localH = tex.height;
    mesh.pivot.set(localW / 2, localH / 2);
    // mesh.x/y is now the visual center of the mesh
    // top-left = origX - anchorX*scale, so center = top-left + meshW/2
    mesh.x = this.origX - item.anchorX * this.origScale + meshW / 2;
    mesh.y = this.origY - item.anchorY * this.origScale + meshH / 2;
    mesh.rotation = this.origRotation;
    this.app.stage.addChild(mesh);
    this.mesh = mesh;

    // Store original vertex positions (these use the INITIAL mesh dimensions)
    const { buffer } = mesh.geometry.getAttribute('aPosition');
    const origPositions = new Float32Array(buffer.data);
    this._origPositions = origPositions;
    // Base dimensions for curl normalization — FIXED, never changes
    const baseW = origPositions[origPositions.length - 2]; // last vertex x = mesh native width
    const baseH = origPositions[origPositions.length - 1]; // last vertex y = mesh native height
    this._baseW = baseW;
    this._baseH = baseH;

    // Animate: paper curl → fly to center → flatten + rotation to 0
    const startX = mesh.x, startY = mesh.y;
    const startRot = this.origRotation;
    const targetW = item.itemW * targetScale;
    const targetH = item.itemH * targetScale;
    // With pivot at center, target x/y IS the screen center
    const targetMeshX = W / 2;
    const targetMeshY = H * 0.38;
    const startW = meshW, startH = meshH;
    const duration = 1200;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      // Position, size & rotation interpolation
      mesh.x = startX + (targetMeshX - startX) * ease;
      mesh.y = startY + (targetMeshY - startY) * ease;
      mesh.width = startW + (targetW - startW) * ease;
      mesh.height = startH + (targetH - startH) * ease;
      // 保持原始角度，不归零

      // Wave sweeps from bottom-right to top-left over the duration
      this._applyPaperCurl(buffer, origPositions, baseW, baseH, ease);

      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Position HTML content below the focused element
    const scaledH = item.itemH * targetScale;
    const bottomY = H * 0.38 + scaledH / 2;
    document.getElementById('focus-content').style.top = (bottomY + 40) + 'px';

    // Populate HTML
    const data = item.focusData;
    this.titleEl.textContent = data.title || '';
    this.descEl.textContent = data.description || '';
    if (data.link) {
      this.linkEl.href = data.link;
      this.linkEl.textContent = data.linkText || 'View';
      this.linkEl.style.display = '';
    } else {
      this.linkEl.style.display = 'none';
    }

    this.overlay.style.display = 'block';
    // Show text/button when fly-in animation is ~70% done
    setTimeout(() => this.overlay.classList.add('visible'), duration * 0.7);
  }

  close() {
    if (!this.activeItem) return;
    const item = this.activeItem;
    const mesh = this.mesh;
    this.activeItem = null;
    this.mesh = null;

    this.overlay.classList.remove('visible');
    // dim 可能是 0.8（普通 focus）或 1.0（从文章关闭）
    const currentDim = this._currentDimAlpha ?? 0.8;
    const currentBlur = this._currentDimBlur ?? 10;
    this._animateDim(currentDim, 0, currentBlur, 0, 400);

    if (!mesh) return;
    const { buffer } = mesh.geometry.getAttribute('aPosition');
    const origPositions = this._origPositions;
    const baseW = this._baseW, baseH = this._baseH;

    // Animate back: flatten → curl → arrive at original position + restore rotation
    const startX = mesh.x, startY = mesh.y;
    const startW = mesh.width, startH = mesh.height;
    const targetRot = this.origRotation;
    const targetW = item.itemW * this.origScale;
    const targetH = item.itemH * this.origScale;
    // Target position accounts for pivot at center
    const targetX = this.origX - item.anchorX * this.origScale + targetW / 2;
    const targetY = this.origY - item.anchorY * this.origScale + targetH / 2;
    const duration = 1000;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      mesh.x = startX + (targetX - startX) * ease;
      mesh.y = startY + (targetY - startY) * ease;
      mesh.width = startW + (targetW - startW) * ease;
      mesh.height = startH + (targetH - startH) * ease;
      // 角度始终保持不变

      // Reverse wave: progress goes from 1 back to 0
      this._applyPaperCurl(buffer, origPositions, baseW, baseH, 1 - ease);

      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);

    setTimeout(() => {
      // Cleanup: remove mesh, restore original
      if (mesh.parent) mesh.parent.removeChild(mesh);
      mesh.destroy();
      item.group.visible = true;
      item.group.x = this.origX;
      item.group.y = this.origY;
      item.group.scale.set(this.origScale);

      this.overlay.style.overflowY = 'auto';
      this.overlay.scrollTop = 0;
      this.overlay.style.overflowY = '';
      this.overlay.style.display = 'none';
      this.dimLayer.visible = false;
      if (this.bgContainer) {
        this.app.stage.removeChild(this.dimLayer);
        this.app.stage.removeChild(this.bgContainer);
        this.bgContainer.filters = [];
        for (const child of this.bgChildren) this.app.stage.addChild(child);
        this.bgContainer = null;
        this.bgChildren = null;
      }
    }, 1050);
  }

  // ─── Article Mode (lives inside the focus overlay) ───

  openArticle() {
    if (!this.activeItem || !this.mesh) return;
    const mesh = this.mesh;
    const W = this.app.screen.width;
    this._articleMode = true;
    this._focusMeshX = mesh.x;
    this._focusMeshY = mesh.y;

    // 隐藏文案和按钮
    document.getElementById('focus-content').style.display = 'none';

    // 动画 mesh 上移到顶部
    const targetX = W / 2;
    const targetY = 80 + mesh.height / 2;
    const startX = mesh.x, startY = mesh.y;
    const duration = 500;
    const startTime = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.x = startX + (targetX - startX) * ease;
      mesh.y = startY + (targetY - startY) * ease;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // 上移结束后，蒙层变全黑
    setTimeout(() => {
      this._animateDim(0.8, 1.0, 10, 12, 400);

      // 蒙层变黑后，构建文章内容容器
      setTimeout(() => {
        const data = this.activeItem.focusData;
        const article = data.article;
        const meshBottom = targetY + mesh.height / 2;

        // 文章容器，定位在 mesh 下方
        const articleWrap = document.createElement('div');
        articleWrap.style.cssText = `position:absolute;top:${meshBottom + 48}px;left:0;right:0;max-width:640px;margin:0 auto;padding:0 24px 80px;opacity:0;transform:translateY(30px);transition:opacity 0.5s ease,transform 0.5s ease;`;

        // 标题
        let html = '';
        const title = article?.title || data.title || '';
        if (title) {
          html += `<h1 style="font-family:Special Elite,cursive;font-size:28px;color:#f0f0f0;letter-spacing:0.5px;line-height:1.4;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.08);">${title}</h1>`;
        }

        // 文章正文
        if (article?.sections) {
          for (const section of article.sections) {
            if (section.type === 'subtitle') {
              html += `<h2 style="font-family:Special Elite,cursive;font-size:20px;color:#e0e0e0;margin:48px 0 16px;line-height:1.4;">${section.text}</h2>`;
            } else if (section.type === 'text') {
              html += `<p style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:16px;color:#a0a0a0;line-height:1.85;margin-bottom:24px;">${section.text}</p>`;
            } else if (section.type === 'image') {
              html += `<img src="${section.src}" alt="${section.alt || ''}" style="width:100%;border-radius:6px;margin:32px 0 8px;">`;
              if (section.caption) {
                html += `<p style="font-family:Red Hat Mono,monospace;font-size:11px;color:#555;text-align:center;margin:0 0 32px;">${section.caption}</p>`;
              }
            }
          }
        }

        articleWrap.innerHTML = html;
        this.overlay.appendChild(articleWrap);
        this._articleWrap = articleWrap;

        // 先让 overlay 可滚动，再重置滚动位置（scrollTop 在非 auto 时无效）
        this.overlay.style.overflowY = 'auto';
        this.overlay.scrollTop = 0;
        this.closeBtn.style.position = 'fixed';

        // mesh 跟随 overlay 滚动
        this._articleMeshBaseY = targetY;
        this._onArticleScroll = () => {
          mesh.y = this._articleMeshBaseY - this.overlay.scrollTop;
        };
        this.overlay.addEventListener('scroll', this._onArticleScroll);

        // 双 rAF 确保浏览器先渲染初始状态再触发 transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            articleWrap.style.opacity = '1';
            articleWrap.style.transform = 'translateY(0)';
          });
        });
      }, 400);
    }, duration);
  }

  closeArticle() {
    if (!this._articleMode) return;
    this._articleMode = false;
    // 移除 scroll 监听
    if (this._onArticleScroll) {
      this.overlay.removeEventListener('scroll', this._onArticleScroll);
      this._onArticleScroll = null;
    }

    // 清理文章内容
    if (this._articleWrap) {
      this._articleWrap.remove();
      this._articleWrap = null;
    }
    this.overlay.scrollTop = 0;
    this.overlay.style.overflowY = '';
    this.closeBtn.style.position = '';
    document.getElementById('focus-content').style.display = '';

    // 把 mesh 归位到 focus 中心（scroll 可能偏移了）
    if (this.mesh) {
      this.mesh.y = this._focusMeshY;
      this.mesh.x = this._focusMeshX;
    }

    // 直接调用 close()，从全黑蒙层 → 飞回 wall
    this.close();
  }
}
