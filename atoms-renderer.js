// atoms-renderer.js — Shared atom rendering module
// All atom types are rendered from here. Both atoms.html and wall.js import this.
import { streamChat, chatSync, buildSystemPrompt } from './ai-client.js?v=166';


// ─── Scribble loading animation (Canvas, for AI waiting state) ───
// Continuous hand-drawn loopy scribble with organic feel
// Ref style: https://codepen.io/arvi/pen/RgYZqB
function createScribbleLoader(container) {
  const W = 640, ROW_H = 32, ROWS = 5, PAD = 14;
  const H = ROWS * ROW_H + PAD * 2;
  const STROKE_COLOR = '#fff';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = 'display:block;max-width:640px;width:100%;margin:0 auto;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Pre-generate path with organic loops
  const points = [];
  for (let row = 0; row < ROWS; row++) {
    const baseY = PAD + row * ROW_H + 8;
    const leftX = Math.random() * 5;
    const rightX = W - 20 - Math.random() * 20;
    const rowW = rightX - leftX;
    const goRight = row % 2 === 0;

    // 3-5 loops per row, with varied sizes
    const loopCount = 10 + Math.floor(Math.random() * 5);
    const loops = [];
    for (let i = 0; i < loopCount; i++) {
      const t = (i + 0.3 + Math.random() * 0.4) / loopCount;
      const r = 8 + Math.random() * 10; // bigger loops (8-18px)
      const squash = 0.5 + Math.random() * 0.6; // x-squash for teardrop shape
      const tilt = (Math.random() - 0.5) * 0.4; // random tilt
      loops.push({ t, r, squash, tilt });
    }
    loops.sort((a, b) => a.t - b.t);

    let curX = goRight ? leftX : rightX;
    const dir = goRight ? 1 : -1;

    for (let li = 0; li < loops.length; li++) {
      const lp = loops[li];
      const loopCX = goRight ? leftX + lp.t * rowW : rightX - lp.t * rowW;

      // --- Baseline segment: gentle curve to loop start ---
      const segSteps = 30;
      const drift = (Math.random() - 0.5) * 6; // baseline isn't perfectly straight
      for (let s = 0; s <= segSteps; s++) {
        const frac = s / segSteps;
        const x = curX + (loopCX - curX) * frac;
        // Organic curve: ease into loop with slight arc
        const arch = Math.sin(frac * Math.PI) * drift;
        points.push({ x: x , y: baseY + arch  });
      }

      // --- Loop: teardrop/organic circle ---
      // The pen enters from the travel direction, swings down into a full loop
      const loopSteps = 48; // more steps = smoother
      const { r, squash, tilt } = lp;
      for (let s = 0; s <= loopSteps; s++) {
        const theta = (s / loopSteps) * Math.PI * 2;
        // Teardrop: x-radius varies with theta (narrower at top, wider at bottom)
        const teardropX = Math.sin(theta) * (r * squash) * (1 + 0.3 * Math.sin(theta));
        const teardropY = r * (1 - Math.cos(theta));
        // Apply tilt rotation
        const rx = teardropX * Math.cos(tilt) - teardropY * Math.sin(tilt);
        const ry = teardropX * Math.sin(tilt) + teardropY * Math.cos(tilt);
        points.push({
          x: loopCX + rx * dir ,
          y: baseY + ry        });
      }

      curX = loopCX;
    }

    // Final baseline to row end
    const endX = goRight ? rightX : leftX;
    const finalSteps = 25;
    const finalDrift = (Math.random() - 0.5) * 4;
    for (let s = 0; s <= finalSteps; s++) {
      const frac = s / finalSteps;
      const x = curX + (endX - curX) * frac;
      const arch = Math.sin(frac * Math.PI) * finalDrift;
      points.push({ x: x , y: baseY + arch  });
    }
  }

  const totalPoints = points.length;
  let drawIdx = 0;
  // Slow: ~2-3 points per frame (was 5)
  const POINTS_PER_FRAME = 2;
  let animId = null;
  let destroyed = false;
  let frameCount = 0;

  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function loop() {
    if (destroyed) return;
    frameCount++;
    // Draw every other frame for 50% slowdown
    if (frameCount % 2 === 0) {
      animId = requestAnimationFrame(loop);
      return;
    }

    const end = Math.min(drawIdx + POINTS_PER_FRAME, totalPoints);
    for (let i = drawIdx; i < end; i++) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    drawIdx = end;

    if (drawIdx >= totalPoints) {
      drawIdx = 0;
      ctx.clearRect(0, 0, W, H);
    }

    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  return () => {
    destroyed = true;
    if (animId) cancelAnimationFrame(animId);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}

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

  // Split into tokens: CJK chars individually, non-CJK words by whitespace
  const isCJK = ch => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u3400-\u4dbf]/.test(ch);
  const tokens = text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u3400-\u4dbf]|[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u3400-\u4dbf]+/g) || [];
  const lines = [];
  let curY = areaY;

  let wordIdx = 0;
  while (wordIdx < tokens.length && curY + lh <= areaY + areaH) {
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

    // Fill tokens into this line
    let lineText = '';
    while (wordIdx < tokens.length) {
      const tok = tokens[wordIdx];
      // CJK tokens join without space; others use space
      const needsSpace = lineText && !isCJK(tok[0]) && !isCJK(lineText[lineText.length - 1]);
      const testLine = lineText + (needsSpace ? ' ' : '') + tok;
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

export async function loadImagePixels(src, maxWidth) {
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = src;
  await new Promise(r => img.onload = r);
  let w = img.naturalWidth, h = img.naturalHeight;
  if (maxWidth && w > maxWidth) {
    h = Math.round(h * (maxWidth / w));
    w = maxWidth;
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0,0,w,h), w, h, tex: PIXI.Texture.from(c) };
}

// ─── Video Texture (lazy, cached) ───
const _videoCache = new Map();
export function getOrCreateVideo(videoSrc) {
  if (_videoCache.has(videoSrc)) return _videoCache.get(videoSrc);
  const video = document.createElement('video');
  video.src = videoSrc;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const entry = { video, texture: null, ready: false };
  video.addEventListener('canplay', () => {
    entry.texture = PIXI.Texture.from(video, { resourceOptions: { autoPlay: false } });
    entry.ready = true;
  }, { once: true });
  _videoCache.set(videoSrc, entry);
  return entry;
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

  return { group: wrapper, sprite: sp, shadow, frame, hitTest: (mx,my) => Math.abs(mx-wrapper.x)<pw*0.6 && Math.abs(my-wrapper.y)<(ph+bottomBorder)*0.6 };
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
export async function renderStickyNote(app, x, y, noteData, stampImgData, cfg, opts = {}) {
  // noteData: { title, body, date, stampSrc }
  // opts.colorScheme: 'warm' (default yellow) | 'cool' (light blue)
  const colorScheme = opts.colorScheme || 'warm';
  const palette = colorScheme === 'cool'
    ? { bg: 0xc4e4ff, title: 0x1a2a3a, body: 0x3a4a5a, date: 0x5a7a8a }
    : { bg: 0xfff9c4, title: 0x222222, body: 0x444444, date: 0x666666 };
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
      fontFamily: 'Special Elite', fontSize: 28, fill: palette.title,
      wordWrap: true, wordWrapWidth: noteW - padding*2,
      padding: 8,
    }});
    titleText.x = padding;
    titleText.y = padding;
    wrapper.addChild(titleText);
    titleBottom = padding + titleText.height + 4;
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
      fontSize: 17, fontFamily: 'Special Elite', fill: palette.body,
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
      fontFamily: 'Schoolbell', fontSize: 18, fill: palette.date,
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
    if (child === stampContainer) continue; // stamp is decorative, doesn't affect note rect
    // For text elements, use y + fontSize estimate
    const b = child.y + (child.style ? child.style.fontSize * 1.3 : (child.height || 0));
    if (b > contentBottom) contentBottom = b;
  }
  const noteH = contentBottom + padding * 0.6;

  // Draw background with actual height
  bg.clear();
  bg.roundRect(0, 0, noteW, noteH, 4);
  bg.fill(palette.bg);

  // Draw shadow (same as photo style)
  shadow.clear();
  shadow.roundRect(3, 3, noteW, noteH, 3);
  shadow.fill({color: 0x000000, alpha: 0.12});

  // Resize wrinkle to match note height
  wrinkleSprite.height = noteH;

  // Clamp stamp: don't exceed note bottom, only left/right edges can overflow
  if (stampContainer) {
    const maxStampY = noteH - stampH * 0.85; // keep most of stamp inside
    if (stampContainer.y > maxStampY) stampContainer.y = maxStampY;
    if (stampContainer.y < 0) stampContainer.y = 10; // don't go above top either
  }

  // Random slight rotation (keep subtle — ±1.5°)
  wrapper.rotation = (Math.random() * 3 - 1.5) * Math.PI / 180;

  return {
    group: wrapper,
    noteW, noteH,
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
    const { group, sprite } = await renderPhoto(this.app, imgData, x, y, sc, meta, this.config?.photo);
    this.app.stage.addChild(group);
    const pw = imgData.w*sc, ph = imgData.h*sc;
    const border = pw*0.06, bottomBorder = border*3;
    const photo = {
      group, sprite, imgData, scale: sc, config: meta, clipped: false, splitCooldown: 0,
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
      // Regenerate label if not predefined
      if (!existingClip._presetLabel) { existingClip.label = null; this.generateClipLabel(existingClip); }
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
      const newClip = { clipSprite: clipSp, photos: [targetItem, droppedItem] };
      this.clipGroups.push(newClip);
      // Pre-generate AI label for hover (async, non-blocking)
      this.generateClipLabel(newClip);
    } catch(err) {
      console.error('Failed to load paperclip:', err);
      droppedItem.clipped = false; targetItem.clipped = false;
    }
  }

  async _splitPhotos(clipInfo) {
    this._hideClipHoverLabel(clipInfo);
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

  _stopPhotoVideo(photo) {
    if (!photo._staticTex || !photo.sprite) return;
    const entry = _videoCache.get(photo.videoSrc);
    if (entry) { entry.video.pause(); entry.video.currentTime = 0; }
    photo.sprite.texture = photo._staticTex;
    photo._staticTex = null;
  }

  // ─── Hover label: category + title below atom ───
  _showHoverLabel(photo) {
    if (photo._hoverLabel) return;
    const cfg = photo.config || {};
    const categoryMap = {
      who_i_am: 'About Me',
      design_projects: 'Design Project',
      design_thought: 'Design Thought',
      hobby: 'Hobby',
      vibe_coding: 'Vibe Coding',
    };
    const catText = categoryMap[cfg.category] || '';
    const titleText = (photo.focusData?.title || cfg.caption || cfg.title || '').slice(0, 24);
    if (!catText && !titleText) return;

    const displayText = catText ? `${catText} · ${titleText}` : titleText;
    const s = photo.group.scale.x;
    const label = new PIXI.Text({
      text: displayText,
      style: new PIXI.TextStyle({
        fontFamily: 'Red Hat Mono, monospace',
        fontSize: 11,
        fill: '#999',
        letterSpacing: 0.5,
      }),
    });

    // Position in LOCAL coords — child of photo.group inherits rotation/scale
    label.x = -photo.anchorX;
    label.y = photo.itemH - photo.anchorY + 12 / s;
    label.scale.set(1 / s); // keep text size constant regardless of atom scale

    label.alpha = 0;
    photo.group.addChild(label);
    photo._hoverLabel = label;

    // Fade in
    const fadeIn = () => {
      if (!photo._hoverLabel) return;
      photo._hoverLabel.alpha = Math.min(1, photo._hoverLabel.alpha + 0.1);
      if (photo._hoverLabel.alpha < 1) requestAnimationFrame(fadeIn);
    };
    requestAnimationFrame(fadeIn);
  }

  _hideHoverLabel(photo) {
    if (!photo._hoverLabel) return;
    const label = photo._hoverLabel;
    photo._hoverLabel = null;
    const fadeOut = () => {
      label.alpha -= 0.15;
      if (label.alpha <= 0) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy({ children: true });
        return;
      }
      requestAnimationFrame(fadeOut);
    };
    requestAnimationFrame(fadeOut);
  }

  _makePhotoDraggable(photo) {
    let drag = false, offX = 0, offY = 0;
    let downTime = 0, downX = 0, downY = 0, moved = false;
    let wasHovering = false;
    const hitTest = (mx,my) => {
      // mx, my should already be canvas coords (callers use _canvasY)
      const b = this._getPhotoBounds(photo);
      return mx > b.x && mx < b.x+b.w && my > b.y && my < b.y+b.h;
    };
    const onDown = e => {
      if (photo.clipped || this._activeDrag) return;
      const mx = e.clientX, my = this._canvasY(e.clientY);
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
        this._stopPhotoVideo(photo); this._hideHoverLabel(photo); wasHovering = false;
        drag = true; offX = photo.group.x-mx; offY = photo.group.y-my;
        downTime = Date.now(); downX = mx; downY = my; moved = false;
        this._activeDrag = photo;
        photo.group.scale.set(photo.baseScale * 1.05);
        this.app.stage.removeChild(photo.group);
        this.app.stage.addChild(photo.group);
      }
    };
    const onMove = e => {
      const cmx = e.clientX, cmy = this._canvasY(e.clientY);
      if (drag) {
        photo.group.x = cmx+offX;
        photo.group.y = cmy+offY;
        if (Math.abs(cmx-downX)>5 || Math.abs(cmy-downY)>5) moved = true;
      }
      // Hover scale + cursor
      const hovering = !drag && hitTest(cmx, cmy) && !photo.clipped;
      const targetScale = (hovering || drag ? 1.05 : 1.0) * photo.baseScale;
      const cur = photo.group.scale.x;
      photo.group.scale.set(cur + (targetScale - cur) * 0.15);
      if (hovering) this.canvas.style.cursor = 'pointer';
      // Video hover
      if (hovering && !wasHovering && photo.videoSrc && photo.sprite) {
        const entry = getOrCreateVideo(photo.videoSrc);
        if (entry.ready && entry.texture) {
          photo._staticTex = photo.sprite.texture;
          photo.sprite.texture = entry.texture;
          entry.video.currentTime = 0;
          entry.video.play().catch(() => {});
        }
      } else if (!hovering && wasHovering) {
        this._stopPhotoVideo(photo);
      }
      // Hover label
      if (hovering && !wasHovering) this._showHoverLabel(photo);
      else if (!hovering && wasHovering) this._hideHoverLabel(photo);
      wasHovering = hovering;
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

    // Touch support — mobile: tap only (no drag), desktop: full drag
    if (!('ontouchstart' in window)) {
      // Desktop only: no touch needed
    } else {
      // Mobile: use click event only (touch listeners block iOS scroll)
      this.canvas.addEventListener('click', e => {
        onDown({clientX: e.clientX, clientY: e.clientY});
        setTimeout(() => onUp(), 50);
      });
    }
  }

  // Convert viewport Y to canvas Y (accounts for page scroll)
  _canvasY(clientY) { return clientY + (window.scrollY || 0); }

  // ─── Clip Group Hover Label System ───

  _getClipGroupBounds(cg) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of cg.photos) {
      const b = this._getPhotoBounds(p);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  _getClipLabelColor(cg) {
    const photo = cg.photos.find(p => p.imgData);
    return photo ? sampleDominantColor(photo.imgData) : 0x666666;
  }

  async generateClipLabel(cg) {
    if (cg.label) return;
    const titles = cg.photos.map(p => p.config?.caption || p.focusData?.title || '').filter(Boolean);
    if (!titles.length) { cg.label = 'Collection'; cg.summary = ''; return; }
    try {
      const resp = await chatSync([
        { role: 'user', content: `Describe the theme of these items in 2-3 English words (no quotes, no period): ${titles.join(', ')}` }
      ]);
      cg.label = resp || 'Collection';
    } catch {
      cg.label = 'Collection';
    }
    // Also generate a short summary for the focus overlay
    if (!cg.summary) {
      try {
        cg.summary = await chatSync([
          { role: 'user', content: `In 2 short English sentences, summarize what these items are about: ${titles.join(', ')}. Write as Jesse (first person, warm tone). No quotes, under 30 words total.` }
        ]);
      } catch { cg.summary = titles.join(', '); }
    }
  }

  _showClipHoverLabel(cg) {
    if (cg._hoverArrow || cg._hoverFading) return;
    if (!cg.label) return;

    const count = cg.photos.length;
    const displayText = `${cg.label} · ${count} articles`;

    const label = new PIXI.Text({
      text: displayText,
      style: new PIXI.TextStyle({
        fontFamily: 'Red Hat Mono, monospace',
        fontSize: 11,
        fill: '#999',
        letterSpacing: 0.5,
      }),
    });

    // Anchor to largest-area item (inherits its rotation/scale)
    let largest = cg.photos[0];
    let maxArea = 0;
    for (const p of cg.photos) {
      const area = p.itemW * p.itemH;
      if (area > maxArea) { maxArea = area; largest = p; }
    }

    // Find the lowest world-Y bottom across ALL items in the clip
    let maxWorldBottom = -Infinity;
    for (const p of cg.photos) {
      const b = this._getPhotoBounds(p);
      maxWorldBottom = Math.max(maxWorldBottom, b.y + b.h);
    }

    // Convert that world-Y bottom to largest item's local coords
    // largest.group world position: (largest.group.x, largest.group.y)
    // In local coords, world Y maps via: localY = (worldY - group.y) / scale
    // (ignoring rotation for the offset — rotation is small ±4°)
    const s = largest.group.scale.x;
    const localBottomY = (maxWorldBottom - largest.group.y) / s;

    label.x = -largest.anchorX;
    label.y = localBottomY + 12 / s;
    label.scale.set(1 / s);

    label.alpha = 0;
    largest.group.addChild(label);
    cg._hoverArrow = label;

    // Fade in
    const fadeIn = () => {
      if (!cg._hoverArrow || cg._hoverArrow !== label) return;
      label.alpha = Math.min(1, label.alpha + 0.1);
      if (label.alpha < 1) requestAnimationFrame(fadeIn);
    };
    requestAnimationFrame(fadeIn);
  }

  _hideClipHoverLabel(cg) {
    if (!cg._hoverArrow) return;
    const label = cg._hoverArrow;
    cg._hoverArrow = null;
    cg._hoverFading = true;
    const fadeOut = () => {
      label.alpha -= 0.15;
      if (label.alpha <= 0) {
        if (label.parent) label.parent.removeChild(label);
        label.destroy({ children: true });
        cg._hoverFading = false;
        return;
      }
      requestAnimationFrame(fadeOut);
    };
    requestAnimationFrame(fadeOut);
    // Clean up legacy fields
    if (cg._hoverText) { if (cg._hoverText.parent) cg._hoverText.parent.removeChild(cg._hoverText); cg._hoverText.destroy(); cg._hoverText = null; }
    if (cg._hoverTextMask) { if (cg._hoverTextMask.parent) cg._hoverTextMask.parent.removeChild(cg._hoverTextMask); cg._hoverTextMask.destroy(); cg._hoverTextMask = null; }
  }

  setupMobileScrollHover() {
    let lastCheck = 0;
    const check = () => {
      if (performance.now() - lastCheck < 200) return;
      lastCheck = performance.now();
      const scrollY = window.scrollY || 0;
      const vH = window.innerHeight;
      for (const cg of this.clipGroups) {
        const bounds = this._getClipGroupBounds(cg);
        const visibleTop = Math.max(bounds.y, scrollY);
        const visibleBottom = Math.min(bounds.y + bounds.h, scrollY + vH);
        const visibleRatio = Math.max(0, visibleBottom - visibleTop) / bounds.h;
        if (visibleRatio > 0.5 && !cg._hoverArrow) {
          this._showClipHoverLabel(cg);
        } else if (visibleRatio < 0.1 && cg._hoverArrow) {
          this._hideClipHoverLabel(cg);
        }
      }
    };
    window.addEventListener('scroll', check, { passive: true });
  }

  _buildClipFocusData(cg) {
    const titles = cg.photos.map(p => p.focusData?.title || p.config?.caption || '').filter(Boolean);
    return {
      title: cg.label || 'Collection',
      description: cg.summary || titles.join(', '),
      link: '#',
      linkText: 'Ask AI to summarize',
      article: null,
      _clipPhotos: cg.photos,
    };
  }

  _setupClickHandler() {
    let groupDrag = null, groupOffX = 0, groupOffY = 0, groupDownTime = 0, groupMoved = false;

    this.canvas.addEventListener('mousedown', e => {
      const mx = e.clientX, my = this._canvasY(e.clientY);
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
            groupDownTime = Date.now(); groupMoved = false;
            for (const gp of cg.photos) gp.group.scale.set(gp.baseScale * 1.05);
            return;
          }
        }
      }
    });
    this.canvas.addEventListener('mousemove', e => {
      if (groupDrag) {
        groupMoved = true;
        const dx = e.clientX - groupOffX, dy = e.clientY - groupOffY;
        for (const p of groupDrag.photos) { p.group.x += dx; p.group.y += dy; }
        groupDrag.clipSprite.x += dx; groupDrag.clipSprite.y += dy;
        if (groupDrag.clipSprite._baseY !== undefined) groupDrag.clipSprite._baseY += dy;
        // Move hover label with group
        if (groupDrag._hoverArrow) groupDrag._hoverArrow.position.set(groupDrag._hoverArrow.x + dx, groupDrag._hoverArrow.y + dy);
        if (groupDrag._hoverText) groupDrag._hoverText.position.set(groupDrag._hoverText.x + dx, groupDrag._hoverText.y + dy);
        if (groupDrag._hoverTextMask) groupDrag._hoverTextMask.position.set(groupDrag._hoverTextMask.x + dx, groupDrag._hoverTextMask.y + dy);
        groupOffX = e.clientX; groupOffY = e.clientY;
        return;
      }
      let hovering = false;
      const mx = e.clientX, my = this._canvasY(e.clientY);
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

        // Hover label: show on enter, hide on leave
        if (groupHovered && !cg._hoverArrow) {
          this._showClipHoverLabel(cg);
        } else if (!groupHovered && cg._hoverArrow) {
          this._hideClipHoverLabel(cg);
        }
      }
    });
    this.canvas.addEventListener('mouseup', () => {
      if (groupDrag) {
        for (const gp of groupDrag.photos) gp.group.scale.set(gp.baseScale);
        // Click (not drag) on clip group → open focus overlay
        if (!groupMoved && (Date.now() - groupDownTime) < 200 && this.onFocus) {
          const firstPhoto = groupDrag.photos[0];
          firstPhoto._savedFocusData = firstPhoto.focusData;
          firstPhoto.focusData = this._buildClipFocusData(groupDrag);
          firstPhoto._isClipGroupFocus = true;
          firstPhoto._clipGroupRef = groupDrag;
          this.onFocus(firstPhoto);
        }
      }
      groupDrag = null;
    });

    // Click for clip split (works on both desktop and mobile without blocking scroll)
    this.canvas.addEventListener('click', e => {
      const mx = e.clientX, my = e.clientY;
      for (const cg of [...this.clipGroups]) {
        const cs = cg.clipSprite;
        if (Math.abs(mx-cs.x)<cs.width*0.6 && Math.abs(my-cs.y)<cs.height*0.6) { this._splitPhotos(cg); return; }
      }
    });
  }
}

// ─── Focus Overlay — click-to-detail with paper curl effect ───
export class FocusOverlay {
  constructor(app, contentData, lang) {
    this.app = app;
    this._contentData = contentData || [];
    this._lang = lang || 'en';
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

    // 注册的 wall items（按 key 查找 focusData + meta）
    this._wallItemRegistry = {};
    // wall 上可 focus 的 item 引用（用于从 chat 跳转回 wall focus）
    this._wallFocusItems = [];

    // Wire focus link to open article instead of navigating
    this.linkEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.activeItem?.focusData?.article || this.activeItem?.focusData?._clipPhotos) {
        this.openArticle();
      }
    });
  }

  registerWallItem(src, focusData) {
    this._wallItemRegistry[src] = focusData;
  }

  registerFocusItem(item, key) {
    this._wallFocusItems.push({ item, key });
  }

  // 在文章模式下切换到另一篇文章（保持 overlay + mesh 不动）
  _swapArticle(focusData) {
    if (!this._articleMode || !this._articleWrap) return;
    const article = focusData.article;
    if (!article) return;

    // 清理旧 chat + composer
    this._teardownComposer();
    this._chatContainer = null;

    // 重建文章内容
    let html = '';
    const title = article.title || focusData.title || '';
    if (title) {
      html += `<h1 style="font-family:Special Elite,cursive;font-size:28px;color:#f0f0f0;letter-spacing:0.5px;line-height:1.4;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.08);">${title}</h1>`;
    }
    if (article.sections) {
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

    // 更新 DOM
    this._articleWrap.innerHTML = html;
    this._articleWrap.style.paddingBottom = '160px';
    this._bindImageLightbox();

    // 重建 chat 容器
    const chatContainer = document.createElement('div');
    chatContainer.className = 'article-chat';
    chatContainer.style.display = 'none';
    this._articleWrap.appendChild(chatContainer);
    this._chatContainer = chatContainer;

    // 滚动到顶部 + 重新绑定 composer
    this.overlay.scrollTop = 0;
    this._setupComposer();
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
    // Hide wall composer when focus overlay is open
    const wallComposer = document.getElementById('wall-composer');
    if (wallComposer) wallComposer.style.display = 'none';
    const W = this.app.screen.width;
    const vH = window.innerHeight; // viewport height, NOT canvas height

    this.origX = item.group.x;
    this.origY = item.group.y;
    this.origScale = item.group.scale.x;
    this.origRotation = item.group.rotation || 0;

    // Responsive scale: fit atom + text block centered in viewport
    const topPad = 40;
    const textBlockH = 150;
    const focusGap = 28;
    const maxW = W * 0.75;
    const maxAtomH = vH - topPad * 2 - focusGap - textBlockH;
    const maxScaleW = maxW / item.itemW;
    const maxScaleH = maxAtomH / item.itemH;
    const targetScale = Math.min(1.3, maxScaleW, maxScaleH);

    // Clean up hover labels BEFORE snapshotting stage children (they'd be destroyed but still in bgChildren)
    if (item._isClipGroupFocus && item._clipGroupRef) {
      const cg = item._clipGroupRef;
      if (cg._hoverArrow) { if (cg._hoverArrow.parent) cg._hoverArrow.parent.removeChild(cg._hoverArrow); cg._hoverArrow.destroy(); cg._hoverArrow = null; }
      if (cg._hoverText) { cg._hoverText.mask = null; if (cg._hoverText.parent) cg._hoverText.parent.removeChild(cg._hoverText); cg._hoverText.destroy(); cg._hoverText = null; }
      if (cg._hoverTextMask) { if (cg._hoverTextMask.parent) cg._hoverTextMask.parent.removeChild(cg._hoverTextMask); cg._hoverTextMask.destroy(); cg._hoverTextMask = null; }
      cg._hoverAnimating = false;
    }

    // Wrap background into blur container
    this.bgContainer = new PIXI.Container();
    this.bgChildren = [...this.app.stage.children];
    for (const child of this.bgChildren) this.bgContainer.addChild(child);
    this.bgContainer.filters = [this.blurFilter];
    this.blurFilter.strength = 0;
    this.app.stage.addChild(this.bgContainer);

    // Dim layer (covers full canvas, not just viewport)
    const canvasH = this.app.screen.height;
    this.dimLayer.clear();
    this.dimLayer.rect(0, 0, W, canvasH);
    this.dimLayer.fill({ color: 0x000000, alpha: 0 });
    this.dimLayer.visible = true;
    this.app.stage.addChild(this.dimLayer);
    this._animateDim(0, 0.8, 0, 10, 500);

    // ─── Clip group focus: animate all elements together (no mesh/texture) ───
    if (item._isClipGroupFocus && item.focusData?._clipPhotos) {
      const photos = item.focusData._clipPhotos;
      const cg = item._clipGroupRef;
      const allEls = photos.map(p => p.group);
      if (cg?.clipSprite) allEls.push(cg.clipSprite);

      // Compute current group bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of photos) {
        const s = p.group.scale.x;
        const bx = p.group.x - p.anchorX * s, by = p.group.y - p.anchorY * s;
        minX = Math.min(minX, bx); minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx + p.itemW * s); maxY = Math.max(maxY, by + p.itemH * s);
      }
      if (cg?.clipSprite) {
        const csb = cg.clipSprite.getBounds();
        minX = Math.min(minX, csb.x); minY = Math.min(minY, csb.y);
        maxX = Math.max(maxX, csb.x + csb.width); maxY = Math.max(maxY, csb.y + csb.height);
      }
      const groupW = maxX - minX, groupH = maxY - minY;
      const groupCenterX = minX + groupW / 2, groupCenterY = minY + groupH / 2;

      // Target position: centered in viewport
      const scrollY = window.scrollY || 0;
      const totalContentH = groupH + focusGap + textBlockH;
      const blockTopY = Math.max(topPad, (vH - totalContentH) / 2);
      const targetCenterX = W / 2;
      const targetCenterY = scrollY + blockTopY + groupH / 2;
      const dx = targetCenterX - groupCenterX;
      const dy = targetCenterY - groupCenterY;

      // Save original positions for close
      this._clipOrigPositions = allEls.map(el => ({ el, x: el.x, y: el.y }));
      this._clipGroupRef = cg;
      this.mesh = null; // no mesh for clip groups

      // Move all elements above blur layer
      for (const el of allEls) {
        if (el.parent) el.parent.removeChild(el);
        this.app.stage.addChild(el);
      }

      // Animate all elements together
      const duration = 600;
      const startPositions = allEls.map(el => ({ x: el.x, y: el.y }));
      const startTime = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        for (let i = 0; i < allEls.length; i++) {
          allEls[i].x = startPositions[i].x + dx * ease;
          allEls[i].y = startPositions[i].y + dy * ease;
        }
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      // Position HTML content below
      document.getElementById('focus-content').style.top = (blockTopY + groupH + focusGap) + 'px';

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
      setTimeout(() => this.overlay.classList.add('visible'), duration * 0.7);
      return; // skip normal single-atom mesh flow
    }

    // ─── Single atom focus: extract texture → MeshPlane ───
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
    const localW = tex.width;
    const localH = tex.height;
    mesh.pivot.set(localW / 2, localH / 2);
    mesh.x = this.origX - item.anchorX * this.origScale + meshW / 2;
    mesh.y = this.origY - item.anchorY * this.origScale + meshH / 2;
    mesh.rotation = this.origRotation;
    this.app.stage.addChild(mesh);
    this.mesh = mesh;

    // Store original vertex positions
    const { buffer } = mesh.geometry.getAttribute('aPosition');
    const origPositions = new Float32Array(buffer.data);
    this._origPositions = origPositions;
    const baseW = origPositions[origPositions.length - 2];
    const baseH = origPositions[origPositions.length - 1];
    this._baseW = baseW;
    this._baseH = baseH;

    // Animate: paper curl → fly to center
    const startX = mesh.x, startY = mesh.y;
    const targetW = item.itemW * targetScale;
    const targetH = item.itemH * targetScale;
    const totalContentH = targetH + focusGap + textBlockH;
    const blockTopY = Math.max(topPad, (vH - totalContentH) / 2);
    const atomCenterY = blockTopY + targetH / 2;
    const scrollY = window.scrollY || 0;
    const targetMeshX = W / 2;
    const targetMeshY = scrollY + atomCenterY;
    const startW = meshW, startH = meshH;
    const duration = 1200;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      mesh.x = startX + (targetMeshX - startX) * ease;
      mesh.y = startY + (targetMeshY - startY) * ease;
      mesh.width = startW + (targetW - startW) * ease;
      mesh.height = startH + (targetH - startH) * ease;

      this._applyPaperCurl(buffer, origPositions, baseW, baseH, ease);

      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Position HTML content below the focused element (viewport coords)
    document.getElementById('focus-content').style.top = (blockTopY + targetH + focusGap) + 'px';

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

    // Play video once after fly-in — only for single photo atoms (not clip groups)
    if (item.videoSrc && !item._isClipGroupFocus) {
      setTimeout(() => {
        if (!this.mesh) return;
        const entry = getOrCreateVideo(item.videoSrc);
        if (!entry.ready || !entry.texture) return;

        // Position group at mesh's focus location (mesh stays visible underneath)
        const focusScale = this.mesh.width / item.itemW;
        item.group.scale.set(focusScale);
        item.group.x = this.mesh.x - this.mesh.width / 2 + item.anchorX * focusScale;
        item.group.y = this.mesh.y - this.mesh.height / 2 + item.anchorY * focusScale;
        item.group.rotation = this.mesh.rotation;
        item.group.visible = true;
        this.app.stage.addChild(item.group);

        // Hide only shadow + frame — keep sprite and handwritten text visible
        if (item.shadow) item.shadow.visible = false;
        if (item.frame) item.frame.visible = false;

        // Swap sprite texture — same as wall hover
        item._staticTex = item.sprite.texture;
        item.sprite.texture = entry.texture;
        entry.video.loop = false;
        entry.video.currentTime = 0;
        entry.video.play().catch(() => {});
        this._videoPlaying = true;

        const onEnded = () => {
          entry.video.loop = true;
          if (!this._videoPlaying) return;
          this._cleanupFocusVideo();
        };
        entry.video.addEventListener('ended', onEnded, { once: true });
        this._videoEndedCleanup = () => {
          entry.video.removeEventListener('ended', onEnded);
          entry.video.pause();
          entry.video.currentTime = 0;
          entry.video.loop = true;
        };
      }, duration);
    }
  }

  _cleanupFocusVideo() {
    if (!this._videoPlaying) return;
    const item = this.activeItem;
    if (item) {
      // Restore sprite texture
      if (item._staticTex) {
        item.sprite.texture = item._staticTex;
        item._staticTex = null;
      }
      // Restore hidden shadow + frame
      if (item.shadow) item.shadow.visible = true;
      if (item.frame) item.frame.visible = true;
      item.group.visible = false;
      this.app.stage.removeChild(item.group);
    }
    if (this._videoEndedCleanup) {
      this._videoEndedCleanup();
      this._videoEndedCleanup = null;
    }
    this._videoPlaying = false;
  }

  close() {
    if (!this.activeItem) return;
    this._cleanupFocusVideo();
    const item = this.activeItem;
    // Restore original focusData if this was a clip group focus
    if (item._isClipGroupFocus) {
      if (item._savedFocusData) { item.focusData = item._savedFocusData; delete item._savedFocusData; }
      delete item._isClipGroupFocus;
      delete item._clipGroupRef;
    }
    const mesh = this.mesh;
    this.activeItem = null;
    this.mesh = null;

    this.overlay.classList.remove('visible');
    const currentDim = this._currentDimAlpha ?? 0.8;
    const currentBlur = this._currentDimBlur ?? 10;
    this._animateDim(currentDim, 0, currentBlur, 0, 400);

    // ─── Clip group close: animate elements back to original positions ───
    if (!mesh && this._clipOrigPositions) {
      const origPos = this._clipOrigPositions;
      this._clipOrigPositions = null;
      const duration = 600;
      const startPositions = origPos.map(o => ({ x: o.el.x, y: o.el.y }));
      const startTime = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        for (let i = 0; i < origPos.length; i++) {
          origPos[i].el.x = startPositions[i].x + (origPos[i].x - startPositions[i].x) * ease;
          origPos[i].el.y = startPositions[i].y + (origPos[i].y - startPositions[i].y) * ease;
        }
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      setTimeout(() => {
        // Move elements back into bgContainer's children (stage teardown)
        this.overlay.style.overflowY = 'auto';
        this.overlay.scrollTop = 0;
        this.overlay.style.overflowY = '';
        this.overlay.style.display = 'none';
        this.dimLayer.visible = false;
        if (this.bgContainer) {
          this.app.stage.removeChild(this.dimLayer);
          // Move clip elements back before teardown
          for (const o of origPos) {
            if (o.el.parent) o.el.parent.removeChild(o.el);
            this.bgContainer.addChild(o.el);
          }
          this.app.stage.removeChild(this.bgContainer);
          this.bgContainer.filters = [];
          for (const child of this.bgChildren) this.app.stage.addChild(child);
          this.bgContainer = null;
          this.bgChildren = null;
        }
        const wallComposer = document.getElementById('wall-composer');
        if (wallComposer) wallComposer.style.display = '';
      }, 650);
      return;
    }

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
      // Cleanup: remove mesh, restore original (don't destroy texture — may be shared with clip photos)
      if (mesh.parent) mesh.parent.removeChild(mesh);
      mesh.destroy({ texture: false });
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
      // Restore wall composer
      const wallComposer = document.getElementById('wall-composer');
      if (wallComposer) wallComposer.style.display = '';
    }, 1050);
  }

  // ─── Article Mode (lives inside the focus overlay) ───

  openArticle() {
    if (!this.activeItem) return;

    // Clip group → AI-generated summary article (no mesh)
    if (this.activeItem.focusData?._clipPhotos) {
      this._openClipSummaryArticle();
      return;
    }

    if (!this.mesh) return;
    // Stop focus video if still playing
    this._cleanupFocusVideo();

    const mesh = this.mesh;
    const W = this.app.screen.width;
    this._articleMode = true;
    this._focusMeshX = mesh.x;
    this._focusMeshY = mesh.y;

    // 隐藏文案和按钮
    document.getElementById('focus-content').style.display = 'none';

    // 动画 mesh 上移到顶部（考虑页面滚动）
    const scrollY = window.scrollY || 0;
    const targetX = W / 2;
    const targetY = scrollY + 80 + mesh.height / 2;
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
        // articleWrap is inside fixed overlay, use viewport coords
        const meshBottom = 80 + mesh.height;

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
        articleWrap.style.paddingBottom = '160px';

        // Chat 容器（在文章内容下方）
        const chatContainer = document.createElement('div');
        chatContainer.className = 'article-chat';
        chatContainer.style.display = 'none';
        articleWrap.appendChild(chatContainer);
        this._chatContainer = chatContainer;

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
          this._updateTOCPosition();
        };
        this.overlay.addEventListener('scroll', this._onArticleScroll);

        // Composer 事件绑定
        this._setupComposer();

        // 双 rAF 确保浏览器先渲染初始状态再触发 transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            articleWrap.style.opacity = '1';
            articleWrap.style.transform = 'translateY(0)';

            // Build TOC + bind image lightbox after transition settles
            setTimeout(() => {
              const h2s = articleWrap.querySelectorAll('h2');
              if (h2s.length) {
                const headings = Array.from(h2s).map(el => ({ text: el.textContent, el }));
                this._buildTOC(headings);
              }
              this._bindImageLightbox();
            }, 550);
          });
        });
      }, 400);
    }, duration);
  }

  async _openClipSummaryArticle() {
    const W = this.app.screen.width;
    this._articleMode = true;

    // Get all clip elements and compute their current bounds
    const allEls = this._clipOrigPositions ? this._clipOrigPositions.map(o => o.el) : [];
    let minY = Infinity, maxY = -Infinity;
    for (const el of allEls) {
      const b = el.getBounds ? el.getBounds() : { y: el.y, height: 0 };
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    }
    const groupH = maxY - minY;
    const groupCenterY = (minY + maxY) / 2;

    // Save current positions for returning from article
    this._clipArticlePositions = allEls.map(el => ({ el, x: el.x, y: el.y }));

    document.getElementById('focus-content').style.display = 'none';

    // Animate all clip elements up to near top
    const scrollY = window.scrollY || 0;
    const targetCenterY = scrollY + 80 + groupH / 2;
    const dy = targetCenterY - groupCenterY;
    const duration = 500;
    const startPositions = allEls.map(el => ({ x: el.x, y: el.y }));
    const startTime = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      for (let i = 0; i < allEls.length; i++) {
        allEls[i].y = startPositions[i].y + dy * ease;
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    await new Promise(r => setTimeout(r, duration));
    this._animateDim(0.8, 1.0, 10, 12, 400);

    await new Promise(r => setTimeout(r, 300));
    const data = this.activeItem.focusData;
    const photos = data._clipPhotos || [];
    const meshBottom = 80 + groupH;

    // Article container
    const articleWrap = document.createElement('div');
    articleWrap.style.cssText = `position:absolute;top:${meshBottom + 48}px;left:0;right:0;max-width:640px;margin:0 auto;padding:0 24px 160px;opacity:0;transform:translateY(30px);transition:opacity 0.5s ease,transform 0.5s ease;`;

    // Title
    const title = data.title || 'Collection';
    articleWrap.innerHTML = `<h1 style="font-family:Special Elite,cursive;font-size:28px;color:#f0f0f0;letter-spacing:0.5px;line-height:1.4;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.08);">${title}</h1>`;

    // AI streaming target
    const aiContent = document.createElement('div');
    articleWrap.appendChild(aiContent);

    this.overlay.appendChild(articleWrap);
    this._articleWrap = articleWrap;
    this.overlay.style.overflowY = 'auto';
    requestAnimationFrame(() => { articleWrap.style.opacity = '1'; articleWrap.style.transform = 'translateY(0)'; });

    // Scroll tracking: move clip elements with article scroll
    const baseYs = allEls.map(el => el.y);
    this._onArticleScroll = () => {
      const scrollOff = this.overlay.scrollTop;
      for (let i = 0; i < allEls.length; i++) allEls[i].y = baseYs[i] - scrollOff;
      this._updateTOCPosition();
    };
    this.overlay.addEventListener('scroll', this._onArticleScroll);

    // Build AI prompt — find registry keys for each photo in the clip
    const photoKeys = photos.map(p => {
      const title = p.focusData?.title || p.config?.caption || '';
      for (const [k, v] of Object.entries(this._wallItemRegistry)) {
        if (v.title === title || v.caption === title) return k;
      }
      return null;
    }).filter(Boolean);

    const keyList = photoKeys.map(k => `[[atom:${k}]]`).join(', ');
    const messages = [
      { role: 'system', content: buildSystemPrompt(this._contentData, this._wallItemRegistry, this._lang) },
      { role: 'user', content: `Write a summary article about "${data.title}". You MUST reference ALL of these items using [[atom:KEY]] — do not skip any: ${keyList}. Introduce each one briefly then show it.` },
    ];

    // Show scribble loading animation
    const removeLoader = createScribbleLoader(aiContent);

    // Stream AI response — reuse same parsing as _streamAIResponse (headings, [[atom:key]] refs)
    let currentEl = null;
    let buffer = '';
    let atomBuffer = [];
    const insertedAtoms = new Set();
    let loaderRemoved = false;

    const flushAtomBuffer = () => {
      if (atomBuffer.length === 0) return;
      const keys = [...atomBuffer];
      atomBuffer = [];
      const placeholder = document.createElement('div');
      placeholder.className = 'atom-entry';
      aiContent.appendChild(placeholder);
      if (keys.length === 1) {
        const meta = this._wallItemRegistry[keys[0]];
        if (meta) {
          this._createAtomEntry(meta).then(entry => {
            if (entry) { placeholder.replaceWith(entry.container); }
            else placeholder.remove();
          });
        } else placeholder.remove();
      } else {
        this._createClipEntry(keys).then(entry => {
          if (entry) { placeholder.replaceWith(entry.container); }
          else placeholder.remove();
        });
      }
    };

    const flushText = (text) => {
      if (!text) return;
      flushAtomBuffer();
      if (!currentEl || currentEl.tagName === 'H2') {
        currentEl = document.createElement('p');
        currentEl.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:16px;color:#a0a0a0;line-height:1.85;margin-bottom:24px;';
        aiContent.appendChild(currentEl);
      }
      currentEl.textContent += text;
    };

    await streamChat(
      messages,
      (token) => {
        if (!loaderRemoved) { removeLoader(); loaderRemoved = true; }
        buffer += token;
        while (buffer.length > 0) {
          const headingMatch = buffer.match(/^## (.+?)\n/);
          if (headingMatch) {
            flushAtomBuffer();
            currentEl = document.createElement('h2');
            currentEl.style.cssText = 'font-family:Special Elite,cursive;font-size:20px;color:#e0e0e0;margin:48px 0 16px;line-height:1.4;';
            aiContent.appendChild(currentEl);
            currentEl.textContent = headingMatch[1];
            this._addTOCEntry(headingMatch[1], currentEl);
            buffer = buffer.slice(headingMatch[0].length);
            currentEl = null;
            continue;
          }
          const atomMatch = buffer.match(/\[\[atom:(.+?)\]\]/);
          if (atomMatch) {
            const before = buffer.slice(0, atomMatch.index).replace(/\n/g, ' ').trim();
            if (before) flushText(before);
            if (!insertedAtoms.has(atomMatch[1])) {
              insertedAtoms.add(atomMatch[1]);
              atomBuffer.push(atomMatch[1]);
            }
            buffer = buffer.slice(atomMatch.index + atomMatch[0].length);
            currentEl = null;
            continue;
          }
          // No special pattern found — check for partial matches
          if (buffer.includes('[') || buffer.includes('#')) {
            const safeEnd = Math.min(
              buffer.indexOf('[') >= 0 ? buffer.indexOf('[') : buffer.length,
              buffer.indexOf('#') >= 0 ? buffer.indexOf('#') : buffer.length
            );
            if (safeEnd > 0) {
              flushText(buffer.slice(0, safeEnd).replace(/\n/g, ' '));
              buffer = buffer.slice(safeEnd);
            } else break;
          } else {
            flushText(buffer.replace(/\n/g, ' '));
            buffer = '';
          }
        }
      },
      () => {
        if (buffer) flushText(buffer.replace(/\n/g, ' '));
        flushAtomBuffer();
      }
    );
  }

  // ─── Article TOC ───

  // Refine heading text for TOC: strip noise, fit within ~36 chars (2 lines at 196px/11px mono)
  _tocText(raw) {
    let t = raw
      .replace(/[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{FE00}-\u{FEFF}]/gu, '') // emoji
      .replace(/^[\d]+\.\s*/, '')  // "1. ", "2. "
      .replace(/^(Discover|Details|Define|Develop|Delivery|Background|Overview)\s*[:：]\s*/i, '')
      .replace(/\s*[✅👷🎯💡🔧📦🎙️]+\s*/g, '')  // status emoji
      .trim();
    // Fit in ~36 chars (2 lines). Trim at last word boundary.
    if (t.length > 36) {
      t = t.slice(0, 36).replace(/\s+\S*$/, '');
    }
    return t;
  }

  _buildTOC(headings) {
    this._destroyTOC();
    if (!headings.length) return;

    const toc = document.createElement('div');
    toc.className = 'article-toc';
    this._tocHeadings = headings;

    for (const h of headings) {
      const item = document.createElement('div');
      item.className = 'article-toc-item';
      const bar = document.createElement('div');
      bar.className = 'toc-bar';
      const txt = document.createElement('div');
      txt.className = 'toc-text';
      txt.textContent = this._tocText(h.text);
      item.appendChild(bar);
      item.appendChild(txt);
      item.addEventListener('click', () => {
        const elTop = h.el.getBoundingClientRect().top;
        const overlayTop = this.overlay.getBoundingClientRect().top;
        this.overlay.scrollTo({ top: this.overlay.scrollTop + (elTop - overlayTop) - 80, behavior: 'smooth' });
      });
      toc.appendChild(item);
    }

    document.body.appendChild(toc);
    this._tocEl = toc;

    // Initial position: align with first heading
    this._updateTOCPosition();
  }

  _addTOCEntry(text, el) {
    if (!this._tocEl) {
      this._tocHeadings = [];
      const toc = document.createElement('div');
      toc.className = 'article-toc';
      document.body.appendChild(toc);
      this._tocEl = toc;
    }

    this._tocHeadings.push({ text, el });
    const item = document.createElement('div');
    item.className = 'article-toc-item';
    const bar = document.createElement('div');
    bar.className = 'toc-bar';
    const txt = document.createElement('div');
    txt.className = 'toc-text';
    txt.textContent = this._tocText(text);
    item.appendChild(bar);
    item.appendChild(txt);
    item.addEventListener('click', () => {
      const elTop = el.getBoundingClientRect().top;
      const overlayTop = this.overlay.getBoundingClientRect().top;
      this.overlay.scrollTo({ top: this.overlay.scrollTop + (elTop - overlayTop) - 80, behavior: 'smooth' });
    });
    this._tocEl.appendChild(item);

    // Update position on first entry
    if (this._tocHeadings.length === 1) this._updateTOCPosition();
  }

  _updateTOCPosition() {
    if (!this._tocEl || !this._tocHeadings?.length) return;
    // Align with first <p> paragraph in article, fallback to first heading
    const firstP = this._articleWrap?.querySelector('p');
    const alignEl = firstP || this._tocHeadings[0].el;
    const rect = alignEl.getBoundingClientRect();
    // Clamp: don't go above 80px (below mesh area)
    const top = Math.max(80, rect.top);
    this._tocEl.style.top = top + 'px';

    // Update active state
    const items = this._tocEl.querySelectorAll('.article-toc-item');
    let activeIdx = 0;
    for (let i = this._tocHeadings.length - 1; i >= 0; i--) {
      const hRect = this._tocHeadings[i].el.getBoundingClientRect();
      if (hRect.top <= 120) { activeIdx = i; break; }
    }
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  }

  _destroyTOC() {
    if (this._tocEl) { this._tocEl.remove(); this._tocEl = null; }
    this._tocHeadings = null;
  }

  // ─── Image Lightbox ───

  _bindImageLightbox() {
    if (!this._articleWrap) return;
    const imgs = this._articleWrap.querySelectorAll('img');
    imgs.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openLightbox(img.src);
      });
    });
  }

  _openLightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'img-lightbox';
    const img = document.createElement('img');
    img.src = src;
    lb.appendChild(img);
    document.body.appendChild(lb);
    this._lightboxEl = lb;

    // Fade in
    requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('visible')));

    // Close on click
    lb.addEventListener('click', () => this._closeLightbox());

    // Close on Escape
    this._lightboxKeyHandler = (e) => { if (e.key === 'Escape') this._closeLightbox(); };
    document.addEventListener('keydown', this._lightboxKeyHandler);
  }

  _closeLightbox() {
    if (!this._lightboxEl) return;
    this._lightboxEl.classList.remove('visible');
    const el = this._lightboxEl;
    setTimeout(() => el.remove(), 250);
    this._lightboxEl = null;
    if (this._lightboxKeyHandler) {
      document.removeEventListener('keydown', this._lightboxKeyHandler);
      this._lightboxKeyHandler = null;
    }
  }

  closeArticle() {
    if (!this._articleMode) return;
    this._articleMode = false;

    // 清理 TOC + lightbox
    this._destroyTOC();
    this._closeLightbox();

    // 清理 composer
    this._teardownComposer();
    this._chatContainer = null;

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

  // ─── Article Chat ───

  _setupComposer() {
    const composer = document.getElementById('article-composer');
    const textarea = composer.querySelector('textarea');
    const sendBtn = composer.querySelector('.send-btn');
    composer.style.display = 'block';
    textarea.value = '';
    sendBtn.disabled = true;

    this._composerHandlers = {
      input: () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        sendBtn.disabled = !textarea.value.trim();
      },
      keydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (textarea.value.trim()) this._sendChatMessage(textarea, sendBtn);
        }
      },
      click: () => {
        if (textarea.value.trim()) this._sendChatMessage(textarea, sendBtn);
      }
    };

    textarea.addEventListener('input', this._composerHandlers.input);
    textarea.addEventListener('keydown', this._composerHandlers.keydown);
    sendBtn.addEventListener('click', this._composerHandlers.click);
  }

  _teardownComposer() {
    const composer = document.getElementById('article-composer');
    const textarea = composer.querySelector('textarea');
    const sendBtn = composer.querySelector('.send-btn');
    composer.style.display = 'none';

    if (this._composerHandlers) {
      textarea.removeEventListener('input', this._composerHandlers.input);
      textarea.removeEventListener('keydown', this._composerHandlers.keydown);
      sendBtn.removeEventListener('click', this._composerHandlers.click);
      this._composerHandlers = null;
    }

    // 停止正在进行的 streaming
    if (this._chatAbort) {
      this._chatAbort.abort();
      this._chatAbort = null;
    }
    if (this._streamingTimer) {
      clearTimeout(this._streamingTimer);
      this._streamingTimer = null;
    }

    // 清理 mini atom PIXI apps（不传 true，避免破坏 PIXI 全局共享状态）
    if (this._chatAtomApps) {
      for (const a of this._chatAtomApps) a.destroy();
      this._chatAtomApps = null;
    }
  }

  _sendChatMessage(textarea, sendBtn) {
    const query = textarea.value.trim();
    if (!query) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    // 显示 chat 容器
    this._chatContainer.style.display = '';

    // 用户消息（右对齐）
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `<div class="chat-bubble">${this._escapeHtml(query)}</div>`;
    this._chatContainer.appendChild(userMsg);
    // 发送时强制滚到底部
    this.overlay.scrollTop = this.overlay.scrollHeight;

    // AI 回复占位（左对齐）
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble';
    aiMsg.appendChild(aiBubble);
    this._chatContainer.appendChild(aiMsg);

    this._streamAIResponse(query, aiBubble);
  }

  async _streamAIResponse(query, bubble) {
    const focusData = this.activeItem?.focusData;
    const articleTitle = focusData?.article?.title || focusData?.title || '';
    const contextNote = `The visitor is currently reading the article "${articleTitle}". Answer in that context.`;

    const messages = [
      { role: 'system', content: buildSystemPrompt(this._contentData, this._wallItemRegistry, this._lang) },
      { role: 'system', content: contextNote },
      { role: 'user', content: query },
    ];

    this._chatAbort = new AbortController();
    let currentEl = null;
    let buffer = '';
    let atomBuffer = []; // consecutive atom keys
    const insertedAtoms = new Set();

    const flushAtomBuffer = () => {
      if (atomBuffer.length === 0) return;
      const keys = [...atomBuffer];
      atomBuffer = [];
      // Insert placeholder synchronously, render async
      const placeholder = document.createElement('div');
      placeholder.className = 'atom-entry';
      bubble.appendChild(placeholder);
      if (keys.length === 1) {
        const meta = this._wallItemRegistry[keys[0]];
        if (meta) {
          this._createAtomEntry(meta).then(entry => {
            if (entry) { placeholder.replaceWith(entry.container); this._scrollToBottom(); }
            else placeholder.remove();
          });
        } else placeholder.remove();
      } else {
        this._createClipEntry(keys).then(entry => {
          if (entry) { placeholder.replaceWith(entry.container); this._scrollToBottom(); }
          else placeholder.remove();
        });
      }
    };

    const flushText = (text) => {
      if (!text) return;
      flushAtomBuffer();
      if (!currentEl || currentEl.tagName === 'H2') {
        currentEl = document.createElement('p');
        bubble.appendChild(currentEl);
      }
      currentEl.textContent += text;
      this._scrollToBottom();
    };

    const removeLoader = createScribbleLoader(bubble);
    let loaderRemoved = false;

    await streamChat(
      messages,
      (token) => {
        if (!loaderRemoved) { removeLoader(); loaderRemoved = true; }
        buffer += token;
        while (buffer.length > 0) {
          const headingMatch = buffer.match(/^## (.+?)\n/);
          if (headingMatch) {
            flushAtomBuffer();
            currentEl = document.createElement('h2');
            bubble.appendChild(currentEl);
            currentEl.textContent = headingMatch[1];
            buffer = buffer.slice(headingMatch[0].length);
            currentEl = null;
            this._scrollToBottom();
            continue;
          }
          const atomMatch = buffer.match(/\[\[atom:(.+?)\]\]/);
          if (atomMatch) {
            const before = buffer.slice(0, atomMatch.index).replace(/\n/g, ' ').trim();
            if (before) flushText(before);
            if (!insertedAtoms.has(atomMatch[1])) {
              insertedAtoms.add(atomMatch[1]);
              atomBuffer.push(atomMatch[1]);
            }
            buffer = buffer.slice(atomMatch.index + atomMatch[0].length);
            currentEl = null;
            continue;
          }
          if (buffer.includes('[') || buffer.startsWith('#') || buffer.endsWith('#')) break;
          const nlIdx = buffer.indexOf('\n');
          if (nlIdx >= 0) {
            const chunk = buffer.slice(0, nlIdx).trim();
            if (chunk) flushText(chunk);
            buffer = buffer.slice(nlIdx + 1);
            if (chunk) currentEl = null;
            continue;
          }
          flushText(buffer);
          buffer = '';
        }
      },
      () => {
        if (buffer.trim()) flushText(buffer.trim());
        flushAtomBuffer();
        this._chatAbort = null;
      },
      this._chatAbort.signal,
    );
  }

  async _insertAtomInChat(key, bubble) {
    const meta = this._wallItemRegistry[key];
    if (!meta) return;
    try {
      const entry = await this._createAtomEntry(meta);
      if (entry) {
        bubble.appendChild(entry.container);
        this._scrollToBottom();
      }
    } catch (e) {
      console.warn('Failed to insert atom:', key, e);
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this.overlay;
      // 只在用户已经在底部附近时自动滚动（避免打断手动上滑）
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
  }

  async _openNestedFocus(meta, miniApp, result) {
    if (this._nestedActive) return;
    this._nestedActive = true;
    const focusData = meta;
    const dpr = window.devicePixelRatio || 1;
    const VW = window.innerWidth, VH = window.innerHeight;

    // 1. 计算 atom 在屏幕上的位置（CSS 像素）
    const atomCanvas = miniApp.canvas;
    const canvasRect = atomCanvas.getBoundingClientRect();
    const group = result.group;
    // canvas 中心 = atom 视觉中心（canvas 已裁剪到 atom bounds + padding）
    const atomScreenX = canvasRect.left + canvasRect.width / 2;
    const atomScreenY = canvasRect.top + canvasRect.height / 2;

    // 2. 隐藏原 atom（防穿帮）
    atomCanvas.style.visibility = 'hidden';

    // 3. 新建全屏 PIXI app
    const fsApp = new PIXI.Application();
    await fsApp.init({
      width: VW, height: VH,
      backgroundAlpha: 0, antialias: true,
      resolution: dpr, autoDensity: true,
    });
    fsApp.canvas.style.position = 'fixed';
    fsApp.canvas.style.left = '0';
    fsApp.canvas.style.top = '0';
    fsApp.canvas.style.zIndex = '10002';
    fsApp.canvas.style.pointerEvents = 'auto';
    document.body.appendChild(fsApp.canvas);

    // 4. Dim layer
    const dimLayer = new PIXI.Graphics();
    dimLayer.rect(0, 0, VW, VH);
    dimLayer.fill({ color: 0x000000, alpha: 0 });
    fsApp.stage.addChild(dimLayer);

    // 动画 dim 0 → 0.8
    const dimDuration = 500;
    const dimStart = performance.now();
    const dimTick = () => {
      const t = Math.min(1, (performance.now() - dimStart) / dimDuration);
      dimLayer.clear();
      dimLayer.rect(0, 0, VW, VH);
      dimLayer.fill({ color: 0x000000, alpha: t * 0.8 });
      if (t < 1) requestAnimationFrame(dimTick);
    };
    requestAnimationFrame(dimTick);

    // 5. 提取 texture（跨 renderer 需通过 base64 中转）
    const base64 = await miniApp.renderer.extract.base64(group);
    const tex = await PIXI.Assets.load(base64 + '#' + Date.now());
    const bounds = group.getLocalBounds();
    const meshW = bounds.width;
    const meshH = bounds.height;

    const mesh = new PIXI.MeshPlane({ texture: tex, verticesX: 20, verticesY: 20 });
    mesh.width = meshW;
    mesh.height = meshH;
    mesh.pivot.set(tex.width / 2, tex.height / 2);
    mesh.x = atomScreenX;
    mesh.y = atomScreenY;
    mesh.rotation = group.rotation || 0;
    fsApp.stage.addChild(mesh);

    const { buffer } = mesh.geometry.getAttribute('aPosition');
    const origPositions = new Float32Array(buffer.data);
    const baseW = origPositions[origPositions.length - 2];
    const baseH = origPositions[origPositions.length - 1];

    // 6. 飞到屏幕中心偏上（CSS 像素）
    const targetMeshX = VW / 2;
    const targetMeshY = VH * 0.38;
    const targetScale = 1.3;
    const startX = mesh.x, startY = mesh.y;
    const startW = meshW, startH = meshH;
    const targetW = meshW * targetScale, targetH = meshH * targetScale;
    const duration = 1200;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.x = startX + (targetMeshX - startX) * ease;
      mesh.y = startY + (targetMeshY - startY) * ease;
      mesh.width = startW + (targetW - startW) * ease;
      mesh.height = startH + (targetH - startH) * ease;
      this._applyPaperCurl(buffer, origPositions, baseW, baseH, ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // 7. 显示嵌套 overlay HTML
    const nestedOverlay = document.getElementById('nested-overlay');
    const nestedContent = document.getElementById('nested-content');
    document.getElementById('nested-title').textContent = focusData.title || '';
    document.getElementById('nested-desc').textContent = focusData.description || '';

    const contentTop = VH * 0.38 + (meshH * targetScale) / 2 + 40;
    nestedContent.style.top = contentTop + 'px';

    nestedOverlay.style.display = 'block';
    setTimeout(() => nestedOverlay.classList.add('visible'), duration * 0.7);

    // View story handler
    const nestedLink = document.getElementById('nested-link');
    const onViewStory = (e) => {
      e.preventDefault();
      nestedLink.removeEventListener('click', onViewStory);
      if (focusData.article) this._openNestedArticle(focusData, fsApp, mesh, dimLayer);
    };
    nestedLink.addEventListener('click', onViewStory);

    // Close handler
    const nestedClose = document.getElementById('nested-close');
    const onClose = () => {
      nestedClose.removeEventListener('click', onClose);
      this._closeNested();
    };
    nestedClose.addEventListener('click', onClose);

    this._nestedState = {
      fsApp, mesh, dimLayer, atomCanvas,
      atomScreenX, atomScreenY, meshW, meshH,
      origRotation: group.rotation || 0,
      buffer, origPositions, baseW, baseH,
    };
  }

  _openNestedArticle(focusData, fsApp, mesh, dimLayer) {
    const article = focusData.article;
    if (!article) return;
    const VW = window.innerWidth, VH = window.innerHeight;

    document.getElementById('nested-content').style.display = 'none';

    // mesh 上移到顶部
    const targetX = VW / 2;
    const targetY = 80 + mesh.height / 2;
    const startX = mesh.x, startY = mesh.y;
    const moveDuration = 500;
    const moveStart = performance.now();
    const moveTick = () => {
      const t = Math.min(1, (performance.now() - moveStart) / moveDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.x = startX + (targetX - startX) * ease;
      mesh.y = startY + (targetY - startY) * ease;
      if (t < 1) requestAnimationFrame(moveTick);
    };
    requestAnimationFrame(moveTick);

    setTimeout(() => {
      // 蒙层变全黑
      const blackDuration = 400;
      const blackStart = performance.now();
      const blackTick = () => {
        const t = Math.min(1, (performance.now() - blackStart) / blackDuration);
        dimLayer.clear();
        dimLayer.rect(0, 0, VW, VH);
        dimLayer.fill({ color: 0x000000, alpha: 0.8 + t * 0.2 });
        if (t < 1) requestAnimationFrame(blackTick);
      };
      requestAnimationFrame(blackTick);

      setTimeout(() => {
        const nestedOverlay = document.getElementById('nested-overlay');
        const meshBottom = 80 + mesh.height;

        const articleWrap = document.createElement('div');
        articleWrap.style.cssText = `position:absolute;top:${meshBottom + 48}px;left:0;right:0;max-width:640px;margin:0 auto;padding:0 24px 160px;opacity:0;transform:translateY(30px);transition:opacity 0.5s ease,transform 0.5s ease;`;

        let html = '';
        const title = article.title || focusData.title || '';
        if (title) html += `<h1 style="font-family:Special Elite,cursive;font-size:28px;color:#f0f0f0;letter-spacing:0.5px;line-height:1.4;margin:0 0 32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.08);">${title}</h1>`;
        if (article.sections) {
          for (const s of article.sections) {
            if (s.type === 'subtitle') html += `<h2 style="font-family:Special Elite,cursive;font-size:20px;color:#e0e0e0;margin:48px 0 16px;line-height:1.4;">${s.text}</h2>`;
            else if (s.type === 'text') html += `<p style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:16px;color:#a0a0a0;line-height:1.85;margin-bottom:24px;">${s.text}</p>`;
            else if (s.type === 'image') {
              html += `<img src="${s.src}" alt="${s.alt || ''}" style="width:100%;border-radius:6px;margin:32px 0 8px;">`;
              if (s.caption) html += `<p style="font-family:Red Hat Mono,monospace;font-size:11px;color:#555;text-align:center;margin:0 0 32px;">${s.caption}</p>`;
            }
          }
        }
        articleWrap.innerHTML = html;
        nestedOverlay.appendChild(articleWrap);
        nestedOverlay.style.overflowY = 'auto';
        nestedOverlay.scrollTop = 0;
        document.getElementById('nested-close').style.position = 'fixed';

        // mesh 跟随 scroll
        const meshBaseY = targetY;
        const onScroll = () => { mesh.y = meshBaseY - nestedOverlay.scrollTop; };
        nestedOverlay.addEventListener('scroll', onScroll);
        this._nestedState.onScroll = onScroll;
        this._nestedState.articleWrap = articleWrap;

        requestAnimationFrame(() => requestAnimationFrame(() => {
          articleWrap.style.opacity = '1';
          articleWrap.style.transform = 'translateY(0)';
        }));
      }, 400);
    }, moveDuration);
  }

  _closeNested() {
    const ns = this._nestedState;
    if (!ns) return;
    const { fsApp, mesh, dimLayer, atomCanvas, atomScreenX, atomScreenY, meshW, meshH, buffer, origPositions, baseW, baseH } = ns;
    const VW = window.innerWidth, VH = window.innerHeight;

    // 1. 隐藏 nested overlay HTML
    const nestedOverlay = document.getElementById('nested-overlay');
    nestedOverlay.classList.remove('visible');
    if (ns.articleWrap) ns.articleWrap.remove();
    if (ns.onScroll) nestedOverlay.removeEventListener('scroll', ns.onScroll);
    nestedOverlay.style.overflowY = '';
    document.getElementById('nested-content').style.display = '';
    document.getElementById('nested-close').style.position = '';

    // 2. Dim 淡出
    const currentAlpha = 0.8; // 可能是 1.0 如果在文章模式
    const dimDuration = 400;
    const dimStart = performance.now();
    const dimTick = () => {
      const t = Math.min(1, (performance.now() - dimStart) / dimDuration);
      dimLayer.clear();
      dimLayer.rect(0, 0, VW, VH);
      dimLayer.fill({ color: 0x000000, alpha: currentAlpha * (1 - t) });
      if (t < 1) requestAnimationFrame(dimTick);
    };
    requestAnimationFrame(dimTick);

    // 3. Mesh 飞回原位 + 反向 paper curl
    const startX = mesh.x, startY = mesh.y;
    const startW = mesh.width, startH = mesh.height;
    const duration = 1000;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      mesh.x = startX + (atomScreenX - startX) * ease;
      mesh.y = startY + (atomScreenY - startY) * ease;
      mesh.width = startW + (meshW - startW) * ease;
      mesh.height = startH + (meshH - startH) * ease;

      this._applyPaperCurl(buffer, origPositions, baseW, baseH, 1 - ease);

      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // 4. 动画结束后清理
    setTimeout(() => {
      nestedOverlay.style.display = 'none';
      fsApp.canvas.remove();
      fsApp.destroy();

      if (atomCanvas) atomCanvas.style.visibility = '';

      this._nestedActive = false;
      this._nestedState = null;
    }, 1050);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async _createAtomEntry(meta) {
    // 加载 atoms config（缓存）
    if (!this._atomsConfig) {
      const resp = await fetch('atoms-config.json');
      this._atomsConfig = await resp.json();
    }
    const cfg = this._atomsConfig;

    // 创建独立 mini PIXI app
    const app = new PIXI.Application();
    await app.init({
      width: 300, height: 300,
      backgroundAlpha: 0, antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    // Match wall.js sizing
    const W = window.innerWidth;
    const cols = W < 600 ? 1 : W < 1024 ? 2 : W < 1600 ? 3 : 4;
    const colW = W / cols;
    const atomScale = colW / 480;

    let result;
    if (meta.atomType === 'photo' && meta.src) {
      const imgData = await loadImagePixels(meta.src);
      const targetW = colW * 0.6;
      const scale = targetW / imgData.w;
      result = await renderPhoto(app, imgData, 0, 0, scale, { caption: meta.caption, date: meta.date }, cfg.photo || {});
    } else if (meta.atomType === 'sticky' && meta.stampSrc) {
      const stampImg = await loadImagePixels(meta.stampSrc);
      result = await renderStickyNote(app, 0, 0, { title: meta.title, body: meta.body, date: meta.date }, stampImg, cfg.stamp, { colorScheme: meta.colorScheme });
      result.group.scale.set(atomScale);
    } else if (meta.src) {
      const imgData = await loadImagePixels(meta.src);
      result = await renderStamp(app, imgData, 0, 0, cfg.stamp, { maxW: 250 * atomScale });
    }

    if (!result) { app.destroy(true); return null; }

    app.stage.addChild(result.group);

    // 调整 canvas 尺寸到 atom 实际大小
    const bounds = result.group.getBounds();
    const pad = 8;
    const w = Math.ceil(bounds.width + pad * 2);
    const h = Math.ceil(bounds.height + pad * 2);
    result.group.x = -bounds.x + pad;
    result.group.y = -bounds.y + pad;
    app.renderer.resize(w, h);

    // CSS 尺寸 = 逻辑尺寸（getBounds 和 resize 都用逻辑像素）
    app.canvas.style.width = w + 'px';
    app.canvas.style.height = h + 'px';
    app.canvas.style.display = 'block';
    app.canvas.style.cursor = 'pointer';
    app.canvas.style.margin = '0 auto';

    // 点击 → 打开嵌套 focus
    app.canvas.addEventListener('click', () => this._openNestedFocus(meta, app, result));

    // Video hover for photo atoms
    if (meta.atomType === 'photo' && meta.src && result.sprite) {
      const videoSrc = meta.src.replace(/\.(png|jpg|jpeg|webp)$/i, '.mp4');
      const vEntry = getOrCreateVideo(videoSrc);
      let vHover = false, staticTex = null;
      app.canvas.addEventListener('mouseenter', () => {
        if (vEntry.ready && vEntry.texture && !vHover) {
          vHover = true; staticTex = result.sprite.texture;
          result.sprite.texture = vEntry.texture;
          vEntry.video.currentTime = 0;
          vEntry.video.play().catch(() => {});
        }
      });
      app.canvas.addEventListener('mouseleave', () => {
        if (vHover && staticTex) {
          vHover = false; vEntry.video.pause(); vEntry.video.currentTime = 0;
          result.sprite.texture = staticTex; staticTex = null;
        }
      });
    }

    // 容器
    const container = document.createElement('div');
    container.className = 'atom-entry';
    container.appendChild(app.canvas);

    // 保存引用以便清理
    if (!this._chatAtomApps) this._chatAtomApps = [];
    this._chatAtomApps.push(app);

    return { container, app };
  }

  async _createClipEntry(keys) {
    if (!this._atomsConfig) {
      const resp = await fetch('atoms-config.json');
      this._atomsConfig = await resp.json();
    }
    const cfg = this._atomsConfig;
    const registry = this._wallItemRegistry;

    // Load images for all keys
    const metas = keys.map(k => registry[k]).filter(Boolean);
    if (metas.length < 2) return null;

    const imgDataArray = [];
    for (const meta of metas) {
      const src = (meta.atomType === 'photo' && meta.src) ? meta.src : meta.stampSrc || meta.src;
      if (!src) continue;
      imgDataArray.push(await loadImagePixels(src));
    }
    if (imgDataArray.length < 2) return null;

    const W = window.innerWidth;
    const isPortrait = window.innerHeight > W;
    const maxW = isPortrait ? W * 0.4 : W * 0.12;
    const maxH = maxW * 1.2;

    const app = new PIXI.Application();
    await app.init({
      width: 500, height: 500,
      backgroundAlpha: 0, antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    const result = await renderClip(app, imgDataArray, 0, 0, maxW, maxH, cfg.photo || {});
    app.stage.addChild(result.group);

    const bounds = result.group.getBounds();
    const pad = 12;
    const w = Math.ceil(bounds.width + pad * 2);
    const h = Math.ceil(bounds.height + pad * 2);
    result.group.x = -bounds.x + pad;
    result.group.y = -bounds.y + pad;
    app.renderer.resize(w, h);

    app.canvas.style.width = w + 'px';
    app.canvas.style.height = h + 'px';
    app.canvas.style.display = 'block';
    app.canvas.style.cursor = 'pointer';
    app.canvas.style.margin = '0 auto';

    // Click opens first item's nested focus
    const firstMeta = metas[0];
    app.canvas.addEventListener('click', () => this._openNestedFocus(firstMeta, app, result));

    const container = document.createElement('div');
    container.className = 'atom-entry';
    container.appendChild(app.canvas);

    if (!this._chatAtomApps) this._chatAtomApps = [];
    this._chatAtomApps.push(app);

    return { container, app };
  }
}
