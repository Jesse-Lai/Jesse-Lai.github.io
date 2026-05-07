// import { prepareWithSegments, layoutNextLineRange, materializeLineRange } from "@chenglou/pretext";

console.log("wall.js loaded");

(async () => {
  try {
  const W = window.innerWidth;
  let H = Math.max(window.innerHeight, 1200); // min height, will expand for content
  const dpr = window.devicePixelRatio || 1;
  const isMobile = "ontouchstart" in window;

  const app = new PIXI.Application();
  await app.init({
    width: W, height: H,
    resolution: dpr,
    autoDensity: true,
    backgroundColor: 0x000000,
  });
  document.body.appendChild(app.canvas);

  // ─── LOAD & SAMPLE IMAGE ───
  async function loadImagePixels(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await new Promise(r => img.onload = r);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const tex = PIXI.Texture.from(c); return { data: ctx.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height, tex };
  }

  function sampleImage(imageData, w, h, gap) {
    const pixels = imageData.data;
    const points = [];
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        const i = (y * w + x) * 4;
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
        if (a < 128) continue;
        points.push({ nx: x / w, ny: y / h, r, g, b, a });
      }
    }
    return points;
  }

  // ─── TEXT CONTENT ───
  const textContent = "Jesse Lai, Product Designer at Microsoft. Crafting AI-native experiences where technology and humanity converge. Believer in emergent design — systems that grow, adapt, and evolve beyond their creator's intent. Stand-up comedian on open mic nights. Bass fisher on quiet mornings. Building tools that think with you, not for you.";

  const FONT = '72px "Bradford LL", serif';
  const FONT_ITALIC = 'italic 72px "Playfair Display", serif';
  const LINE_HEIGHT = 82;
  const TEXT_COLOR = 0x1a1a1a;
  const LIGHT_BG = 0xf5f2ed;
  const DARK_BG = 0x1a1a1a;
  const LIGHT_TEXT = 0x1a1a1a;
  const DARK_TEXT = 0xf0f0f0;
  let isDark = false;
  const MARGIN = 60;

// ─── STICKER CLASS ───
  class Sticker {
    constructor(imgDataA, imgDataB, x, y, displayScale) {
      this.imgDataA = imgDataA;
      this.imgDataB = imgDataB;
      this.posX = x;
      this.posY = y;
      this.scale = displayScale;
      this.renderW = imgDataA.w * displayScale;
      this.renderH = imgDataA.h * displayScale;

      this.container = new PIXI.Container();
      app.stage.addChild(this.container);

      // Flat sprite (default - no particles until hover/drag)
      this.flatSprite = new PIXI.Sprite(imgDataA.tex);
      this.flatSprite.anchor.set(0.5);
      this.flatSprite.width = this.renderW;
      this.flatSprite.height = this.renderH;
      this.flatSprite.x = 0;
      this.flatSprite.y = 0;
      this.container.addChild(this.flatSprite);

      // Shadow (added externally via addShadow)
      this.shadow = null;
      this.container.x = x;
      this.container.y = y;

      this.particles = [];
      this.activated = false;
      this.state = "idle";
      this.hoverProgress = 0;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
      this.morphProgress = 0;
      this.morphTarget = 0;
      this.morphTimer = null;
      this.currentForm = 0;
    }


    addShadow() {
      const g = new PIXI.Graphics();
      g.rect(-this.renderW/2 + 4, -this.renderH/2 + 4, this.renderW, this.renderH);
      g.fill({ color: 0x000000, alpha: 0.12 });
      this.container.addChildAt(g, 0);
      this.shadow = g;
    }
    activate() {
      if (this.activated || this.noParticles) return;
      this.activated = true;
      this.flatSprite.visible = false;

      const gap = 3;
      const pointsA = sampleImage(this.imgDataA.data, this.imgDataA.w, this.imgDataA.h, gap);
      const pointsB = sampleImage(this.imgDataB.data, this.imgDataB.w, this.imgDataB.h, gap);
      const maxCount = Math.max(pointsA.length, pointsB.length);
      while (pointsA.length < maxCount) pointsA.push(pointsA[Math.floor(Math.random() * pointsA.length)]);
      while (pointsB.length < maxCount) pointsB.push(pointsB[Math.floor(Math.random() * pointsB.length)]);
      for (let i = pointsB.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pointsB[i], pointsB[j]] = [pointsB[j], pointsB[i]];
      }

      const particleScale = this.scale * gap / 2;
      const dotCanvas = document.createElement("canvas");
      dotCanvas.width = 2; dotCanvas.height = 2;
      const dctx = dotCanvas.getContext("2d");
      dctx.fillStyle = "white"; dctx.fillRect(0, 0, 2, 2);
      const dotTexture = PIXI.Texture.from(dotCanvas);

      const renderWB = this.imgDataB.w * this.scale;
      const renderHB = this.imgDataB.h * this.scale;

      for (let i = 0; i < maxCount; i++) {
        const pA = pointsA[i];
        const pB = pointsB[i];
        const lxA = (pA.nx - 0.5) * this.renderW;
        const lyA = (pA.ny - 0.5) * this.renderH;
        const lxB = (pB.nx - 0.5) * renderWB;
        const lyB = (pB.ny - 0.5) * renderHB;

        const sprite = new PIXI.Sprite(dotTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(particleScale);
        sprite.tint = (pA.r << 16) | (pA.g << 8) | pA.b;
        sprite.alpha = pA.a / 255;
        this.container.addChild(sprite);

        this.particles.push({
          sprite,
          lxA, lyA, rA: pA.r, gA: pA.g, bA: pA.b, aA: pA.a,
          lxB, lyB, rB: pB.r, gB: pB.g, bB: pB.b, aB: pB.a,
          lx: lxA, ly: lyA,
          x: this.posX + lxA, y: this.posY + lyA,
          vx: 0, vy: 0,
          nx: pA.nx, ny: pA.ny,
          origR: pA.r, origG: pA.g, origB: pA.b, origA: pA.a,
          isFlipped: false,
        });
      }
      this.container.x = 0;
      this.container.y = 0;
    }

    get bounds() {
      return {
        x: this.posX - this.renderW / 2,
        y: this.posY - this.renderH / 2,
        w: this.renderW,
        h: this.renderH,
      };
    }

    hitTest(mx, my) {
      const b = this.bounds;
      return mx > b.x && mx < b.x + b.w && my > b.y && my < b.y + b.h;
    }

    setHover(isHover) {
      if (this.state === "dragging") return;
      this.state = isHover ? "hover" : "idle";
    }

    startDrag(mx, my) {
      this.state = "dragging";
      this.activate();
      this.dragOffsetX = this.posX - mx;
      this.dragOffsetY = this.posY - my;
      this.hoverProgress = 1;
      // Start morph cycling every 2 seconds
      this.morphTimer = setInterval(() => {
        this.morphTarget = this.morphTarget === 0 ? 1 : 0;
      }, 1000);
    }

    moveDrag(mx, my) {
      if (this.state !== "dragging") return;
      this.posX = mx + this.dragOffsetX;
      this.posY = my + this.dragOffsetY;
    }

    drop() {
      this.state = "idle";
      if (this.morphTimer) { clearInterval(this.morphTimer); this.morphTimer = null; }
      // Lock current form
      this.currentForm = Math.round(this.morphProgress);
      this.morphTarget = this.currentForm;
    }

    update(dt) {
      // If not activated, just update flat sprite position
      if (!this.activated) {
        this.flatSprite.x = 0;
        this.flatSprite.y = 0;
        this.container.x = this.posX;
        this.container.y = this.posY;
        if (this.state === "hover") this.activate();
        if (!this.activated) return;
      }
      const targetHover = (this.state === "hover" || this.state === "dragging") ? 1 : 0;
      this.hoverProgress += (targetHover - this.hoverProgress) * 0.1;

      // Animate morph progress
      this.morphProgress += (this.morphTarget - this.morphProgress) * 0.05;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        // Morph between A and B
        const m = this.morphProgress;
        const currentLx = p.lxA + (p.lxB - p.lxA) * m;
        const currentLy = p.lyA + (p.lyB - p.lyA) * m;
        const cr = Math.round(p.rA + (p.rB - p.rA) * m);
        const cg = Math.round(p.gA + (p.gB - p.gA) * m);
        const cb = Math.round(p.bA + (p.bB - p.bA) * m);
        const ca = p.aA + (p.aB - p.aA) * m;
        if (!p.isFlipped) { p.sprite.tint = (cr << 16) | (cg << 8) | cb; p.sprite.alpha = ca / 255; }
        p.origR = cr; p.origG = cg; p.origB = cb; p.origA = ca;
        p.lx = currentLx; p.ly = currentLy;
        // Update normalized position for peel calculation
        p.nx = currentLx / this.renderW + 0.5;
        p.ny = currentLy / this.renderH + 0.5;
        let tx = this.posX + currentLx;
        let ty = this.posY + currentLy;

        // Corner peel
        if (this.hoverProgress > 0.01) {
          const distFromCorner = Math.sqrt(Math.pow(1 - p.nx, 2) + Math.pow(1 - p.ny, 2));
          const foldRadius = this.hoverProgress * 0.6;
          if (distFromCorner < foldRadius) {
            const foldAmount = (foldRadius - distFromCorner) / foldRadius;
            const foldDist = foldAmount * foldRadius * this.renderW * 0.5;
            tx += -foldDist * 0.7;
            ty += -foldDist * 0.7;
            // Gradient: darker closer to corner
            const shade = Math.floor(240 - foldAmount * 100); // 240 at edge, 140 at corner
            p.sprite.tint = (shade << 16) | (shade << 8) | shade;
            p.sprite.alpha = 0.95;
            p.isFlipped = true;
          } else if (p.isFlipped) {
            p.sprite.tint = (p.origR << 16) | (p.origG << 8) | p.origB;
            p.sprite.alpha = p.origA / 255;
            p.isFlipped = false;
          } else {
            // Front face: expand outward near fold line (paper loosening)
            const proximity = Math.max(0, 1 - (distFromCorner - foldRadius) / 0.4);
            if (proximity > 0) {
              const expand = proximity * this.hoverProgress * 12;
              // Push away from center
              const dirX = p.nx - 0.5;
              const dirY = p.ny - 0.5;
              tx += dirX * expand;
              ty += dirY * expand;
            }
          }
        } else if (p.isFlipped) {
          p.sprite.tint = (p.origR << 16) | (p.origG << 8) | p.origB;
          p.sprite.alpha = p.origA / 255;
          p.isFlipped = false;
        }

        // Physics
        if (this.state === "dragging") {
          // Fluid lag: particles follow with varying delay based on position
          const lag = 0.03 + (p.nx + p.ny) * 0.02; // top-left follows fast, bottom-right lags
          p.vx += (tx - p.x) * lag;
          p.vy += (ty - p.y) * lag;
        } else {
          p.vx += (tx - p.x) * 0.15;
          p.vy += (ty - p.y) * 0.15;

          // Hover: edge particles occasionally detach
          if (this.hoverProgress > 0.5) {
            const edgeness = Math.max(Math.abs(p.nx - 0.5) * 2, Math.abs(p.ny - 0.5) * 2);
            if (edgeness > 0.9 && Math.random() < 0.01) {
              p.vx += (p.nx - 0.5) * 15;
              p.vy += (p.ny - 0.5) * 15;
            }
          }
          p.vy += (ty - p.y) * 0.15;
        }

        // Breathing
        if (this.state === "idle" && this.hoverProgress < 0.05) {
          const time = performance.now() * 0.001;
          p.vx += Math.sin(time * 0.5 + p.lx * 0.01) * 0.003;
          p.vy += Math.cos(time * 0.4 + p.ly * 0.01) * 0.002;
        }

        p.vx *= 0.7; p.vy *= 0.7;
        p.x += p.vx; p.y += p.vy;
        p.sprite.x = p.x; p.sprite.y = p.y;

        // Desk boundary effect: darken + spread particles outside desk
        if (typeof deskBounds !== "undefined") {
          const outLeft = Math.max(0, deskBounds.left - p.x);
          const outRight = Math.max(0, p.x - deskBounds.right);
          const outTop = Math.max(0, deskBounds.top - p.y);
          const outBottom = Math.max(0, p.y - deskBounds.bottom);
          const outDist = Math.max(outLeft, outRight, outTop, outBottom);
          if (outDist > 0) {
            const fade = Math.max(0.3, 1 - outDist / 80);
            p.sprite.alpha = (p.origA / 255) * fade;
            // Spread outward
            const spread = Math.min(outDist * 0.05, 3);
            const dirX = p.x - this.posX;
            const dirY = p.y - this.posY;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            p.vx += (dirX / len) * spread * 0.3;
            p.vy += (dirY / len) * spread * 0.3;
          }
        }
      }
    }
  }

  // ─── TEXT: HYBRID (clean text + particle scatter for displaced) ───
  const textContainer = new PIXI.Container();
  const scatterContainer = new PIXI.Container();
  app.stage.addChild(textContainer);
  app.stage.addChild(scatterContainer);

  // Scatter particle pool
  const SCATTER_POOL_SIZE = 5000;
  const scatterDotCanvas = document.createElement('canvas');
  scatterDotCanvas.width = 2; scatterDotCanvas.height = 2;
  const sdctx = scatterDotCanvas.getContext('2d');
  sdctx.fillStyle = 'white'; sdctx.fillRect(0, 0, 2, 2);
  const scatterDotTex = PIXI.Texture.from(scatterDotCanvas);

  const scatterPool = [];
  for (let i = 0; i < SCATTER_POOL_SIZE; i++) {
    const s = new PIXI.Sprite(scatterDotTex);
    s.anchor.set(0.5); s.scale.set(0.8); s.visible = false;
    scatterContainer.addChild(s);
    scatterPool.push({ sprite: s, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  let scatterIdx = 0;

  function emitScatter(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const p = scatterPool[scatterIdx % SCATTER_POOL_SIZE];
      scatterIdx++;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = (Math.random() - 0.5) * 8;
      p.life = 1;
      p.sprite.visible = true;
      p.sprite.tint = color;
      p.sprite.alpha = 1;
      p.sprite.x = p.x;
      p.sprite.y = p.y;
    }
  }

  // Track previous text line positions to detect displacement
  let prevTextLines = []; // [{x, y, text, width}]

  function layoutText(stickers) {} // disabled - no text
  // ─── DESK BACKGROUND ───
  const deskTex = await PIXI.Assets.load("desk.png");
  const deskSprite = new PIXI.Sprite(deskTex);
  const deskScale = Math.min((W * 0.8) / deskSprite.texture.width, (H * 0.8) / deskSprite.texture.height);
  deskSprite.scale.set(deskScale);
  deskSprite.x = (W - deskSprite.texture.width * deskScale) / 2;
  deskSprite.y = (H - deskSprite.texture.height * deskScale) / 2;
  app.stage.addChild(deskSprite);

  // Desk bounds for particle boundary effects
  const deskBounds = {
    left: deskSprite.x,
    top: deskSprite.y,
    right: deskSprite.x + deskSprite.texture.width * deskScale,
    bottom: deskSprite.y + deskSprite.texture.height * deskScale,
  };

  // ─── LOAD STICKERS ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");
  const imgP1 = await loadImagePixels("photo1.png");
  const imgP2 = await loadImagePixels("photo2.png");
  const imgP3 = await loadImagePixels("photo3.png");

  const deskH = deskSprite.texture.height * deskScale;
  const deskW = deskSprite.texture.width * deskScale;
  const maxH = deskH * 0.45;
  const maxSW = deskW * 0.35;
  const photoMax = deskH * 0.35;
  const photoMaxW = deskW * 0.25;
  const s1Scale = Math.min(maxSW / img1.w, maxH / img1.h);

  const p1Scale = Math.min(photoMaxW / imgP1.w, photoMax / imgP1.h);
  const p2Scale = Math.min(photoMaxW / imgP2.w, photoMax / imgP2.h);
  const p3Scale = Math.min(photoMaxW / imgP3.w, photoMax / imgP3.h);

  const cx = deskBounds.left + deskW / 2;
  const cy = deskBounds.top + deskH / 2;

  const sticker1 = new Sticker(img1, img2, cx, cy, s1Scale);
  const photo1 = new Sticker(imgP1, imgP1, cx - deskW * 0.3, cy - deskH * 0.15, p1Scale);
  const photo2 = new Sticker(imgP2, imgP2, cx + deskW * 0.3, cy - deskH * 0.1, p2Scale);
  const photo3 = new Sticker(imgP3, imgP3, cx + deskW * 0.25, cy + deskH * 0.2, p3Scale);
  const imgP4 = await loadImagePixels("photo4.png");
  const p4Scale = Math.min(photoMaxW / imgP4.w, photoMax / imgP4.h);
  const photo4 = new Sticker(imgP4, imgP4, cx - deskW * 0.25, cy + deskH * 0.2, p4Scale);
  const stickers = [sticker1, photo1, photo2, photo3, photo4];
  [photo1, photo2, photo3, photo4].forEach(p => { p.addShadow(); p.noParticles = true; });

  // Initial text layout
  await document.fonts.ready;
  layoutText(stickers);

  // ─── INTERACTION ───
  const mouse = { x: -9999, y: -9999 };
  let draggedSticker = null;
  let needsTextRelayout = false;

  function getHoveredSticker() {
    for (let i = stickers.length - 1; i >= 0; i--) {
      if (stickers[i].hitTest(mouse.x, mouse.y)) return stickers[i];
    }
    return null;
  }

  function handleClick() {
    console.log("handleClick", mouse.x, mouse.y, "hovered:", getHoveredSticker() ? "yes" : "no");
    if (draggedSticker) {
      draggedSticker.drop();
      draggedSticker = null;
      
      return;
    }
    const hovered = getHoveredSticker();
    if (hovered) {
      hovered.startDrag(mouse.x, mouse.y);
      draggedSticker = hovered;
      app.stage.removeChild(hovered.container);
      app.stage.addChild(hovered.container);
    }
  }

  // Mouse
  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (draggedSticker) {
      draggedSticker.moveDrag(mouse.x, mouse.y);
      
    }
  });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; });
  // window.addEventListener("click", handleClick); // disabled - using mousedown/up instead

  // Mousedown + drag + mouseup support
  window.addEventListener("mousedown", e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!draggedSticker) {
      const hovered = getHoveredSticker();
      if (hovered) {
        hovered.startDrag(mouse.x, mouse.y);
        draggedSticker = hovered;
        app.stage.removeChild(hovered.container);
        app.stage.addChild(hovered.container);
      }
    }
  });
  window.addEventListener("mouseup", () => {
    if (draggedSticker) {
      draggedSticker.drop();
      draggedSticker = null;
      
    }
  });

  // Touch
  let longPressTimer = null, touchMoved = false;
  window.addEventListener("touchstart", e => {
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = false;
    longPressTimer = setTimeout(() => { if (!touchMoved) handleClick(); }, 400);
  });
  window.addEventListener("touchmove", e => {
    if (draggedSticker) e.preventDefault(); // only prevent scroll when dragging
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (draggedSticker) { draggedSticker.moveDrag(mouse.x, mouse.y);  }
  }, { passive: false });
  window.addEventListener("touchend", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (!touchMoved) handleClick();
    else if (draggedSticker) { draggedSticker.drop(); draggedSticker = null;  }
  });

  // ─── ANIMATION LOOP ───
  let relayoutCooldown = 0;
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    const hovered = draggedSticker ? null : getHoveredSticker();
    for (const s of stickers) {
      s.setHover(s === hovered);
      s.update(dt);
    }

    // Cursor
    if (draggedSticker) app.canvas.style.cursor = "grabbing";
    else if (hovered) app.canvas.style.cursor = "pointer";
    else app.canvas.style.cursor = "default";

    // Re-layout text when stickers move (throttled)
    if (needsTextRelayout) {
      relayoutCooldown += dt;
      if (relayoutCooldown > 0.1) {
        layoutText(stickers);
        relayoutCooldown = 0;
        needsTextRelayout = false;
      }
    }

    // Animate scatter particles
    for (const p of scatterPool) {
      if (!p.sprite.visible) continue;
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.95; p.vy *= 0.95;
      p.life -= 0.03;
      p.sprite.x = p.x; p.sprite.y = p.y;
      p.sprite.alpha = Math.max(0, p.life);
      if (p.life <= 0) p.sprite.visible = false;
    }
  });

  // ─── THEME TOGGLE ───

  window.addEventListener('themechange', (e) => {
    isDark = e.detail.dark;
    app.renderer.background.color.setValue(isDark ? DARK_BG : LIGHT_BG);
    layoutText(stickers);
  });

  // ─── RESIZE ───
  let resizeTimer, lastW = W;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastW) > 50) location.reload();
      lastW = window.innerWidth;
    }, 500);
  });
  } catch(e) { console.error("wall.js error:", e); }
})();
