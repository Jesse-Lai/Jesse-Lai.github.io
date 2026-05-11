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
  const s=1.0, l=0.4;
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
    const capText = new PIXI.Text({text:caption, style:{fontFamily:'Schoolbell', fontSize:fontSize1, fill:textColor}});
    capText.x = -pw/2 + border*0.5 + Math.random()*pw*0.1;
    capText.y = capY;
    capText.rotation = textRot;
    capText.alpha = 0.9;
    group.addChild(capText);
  }
  if (date) {
    const dateText = new PIXI.Text({text:date, style:{fontFamily:'Schoolbell', fontSize:fontSize2, fill:textColor}});
    dateText.x = -pw/2 + border*0.8 + Math.random()*pw*0.15;
    dateText.y = dateY;
    dateText.rotation = textRot + (Math.random()-0.5)*0.02;
    dateText.alpha = 0.85;
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

  // Track photo sprites for split animation
  const photoSprites = [];
  const origPositions = [];

  for (let i=0; i<images.length; i++) {
    const img = images[i];
    const sc = Math.min(maxW/img.w, maxH/img.h);
    const rot = (Math.random()*8-4)*Math.PI/180;
    const offX = i*4, offY = i*6;
    const sh = new PIXI.Graphics();
    sh.roundRect(2,2,img.w*sc,img.h*sc,2);
    sh.fill({color:0,alpha:0.1});
    sh.x=-maxW/2+offX; sh.y=-maxH/2+offY; sh.rotation=rot;
    group.addChild(sh);
    const sp = new PIXI.Sprite(img.tex);
    sp.width=img.w*sc; sp.height=img.h*sc;
    sp.x=-maxW/2+offX; sp.y=-maxH/2+offY; sp.rotation=rot;
    group.addChild(sp);
    photoSprites.push(sp);
    origPositions.push({x: -maxW/2+offX, y: -maxH/2+offY});
  }

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
      // Fade out clip
      await fadeOut(clipSp);
      // Spread photos
      const angleStep = Math.PI*2/photoSprites.length;
      const baseAngle = Math.random()*Math.PI*2;
      await Promise.all(photoSprites.map((sp,i) => 
        animateTo(sp, origPositions[i].x + Math.cos(baseAngle+angleStep*i)*splitSpread, 
                      origPositions[i].y + Math.sin(baseAngle+angleStep*i)*splitSpread)
      ));
    } else {
      // Gather photos back
      await Promise.all(photoSprites.map((sp,i) => 
        animateTo(sp, origPositions[i].x, origPositions[i].y)
      ));
      // Fade in clip
      await fadeIn(clipSp);
    }
  }

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
