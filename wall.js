import { prepareWithSegments, layoutNextLineRange, materializeLineRange } from "@chenglou/pretext";

console.log("wall.js loaded");

(async () => {
  try {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const isMobile = "ontouchstart" in window;

  const app = new PIXI.Application();
  await app.init({
    width: W, height: H,
    resolution: dpr,
    autoDensity: true,
    backgroundColor: 0xf5f2ed,
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
    return { data: ctx.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height };
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
      this.posX = x;
      this.posY = y;
      this.scale = displayScale;
      this.renderW = imgDataA.w * displayScale;
      this.renderH = imgDataA.h * displayScale;

      const gap = 3;
      const pointsA = sampleImage(imgDataA.data, imgDataA.w, imgDataA.h, gap);
      const pointsB = sampleImage(imgDataB.data, imgDataB.w, imgDataB.h, gap);

      // Pad to same length
      const maxCount = Math.max(pointsA.length, pointsB.length);
      while (pointsA.length < maxCount) pointsA.push(pointsA[Math.floor(Math.random() * pointsA.length)]);
      while (pointsB.length < maxCount) pointsB.push(pointsB[Math.floor(Math.random() * pointsB.length)]);
      // Shuffle B for interesting transitions
      for (let i = pointsB.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pointsB[i], pointsB[j]] = [pointsB[j], pointsB[i]];
      }

      this.container = new PIXI.Container();
      app.stage.addChild(this.container);

      this.particles = [];
      const particleScale = displayScale * gap / 2;

      const dotCanvas = document.createElement("canvas");
      dotCanvas.width = 2; dotCanvas.height = 2;
      const dctx = dotCanvas.getContext("2d");
      dctx.fillStyle = "white"; dctx.fillRect(0, 0, 2, 2);
      const dotTexture = PIXI.Texture.from(dotCanvas);

      const renderWB = imgDataB.w * displayScale;
      const renderHB = imgDataB.h * displayScale;

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
          // State A
          lxA, lyA, rA: pA.r, gA: pA.g, bA: pA.b, aA: pA.a,
          // State B
          lxB, lyB, rB: pB.r, gB: pB.g, bB: pB.b, aB: pB.a,
          // Current
          lx: lxA, ly: lyA,
          x: x + lxA, y: y + lyA,
          vx: 0, vy: 0,
          nx: pA.nx, ny: pA.ny,
          origR: pA.r, origG: pA.g, origB: pA.b, origA: pA.a,
          isFlipped: false,
        });
      }

      this.state = "idle";
      this.hoverProgress = 0;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;

      // Morph state
      this.morphProgress = 0; // 0 = A, 1 = B
      this.morphTarget = 0;
      this.morphTimer = null;
      this.currentForm = 0; // 0=A, 1=B - which form is shown when dropped
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
      this.dragOffsetX = this.posX - mx;
      this.dragOffsetY = this.posY - my;
      this.hoverProgress = 1;
      // Start morph cycling every 2 seconds
      this.morphTimer = setInterval(() => {
        this.morphTarget = this.morphTarget === 0 ? 1 : 0;
      }, 2000);
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
          p.vx += (tx - p.x) * 0.12;
          p.vy += (ty - p.y) * 0.12;

          // Hover: edge particles occasionally detach
          if (this.hoverProgress > 0.5) {
            const edgeness = Math.max(Math.abs(p.nx - 0.5) * 2, Math.abs(p.ny - 0.5) * 2);
            if (edgeness > 0.9 && Math.random() < 0.01) {
              p.vx += (p.nx - 0.5) * 15;
              p.vy += (p.ny - 0.5) * 15;
            }
          }
          p.vy += (ty - p.y) * 0.12;
        }

        // Breathing
        if (this.state === "idle" && this.hoverProgress < 0.05) {
          const time = performance.now() * 0.001;
          p.vx += Math.sin(time * 0.5 + p.lx * 0.01) * 0.003;
          p.vy += Math.cos(time * 0.4 + p.ly * 0.01) * 0.002;
        }

        p.vx *= 0.82; p.vy *= 0.82;
        p.x += p.vx; p.y += p.vy;
        p.sprite.x = p.x; p.sprite.y = p.y;
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

  function layoutText(stickers) {
    textContainer.removeChildren();

    const prepared = prepareWithSegments(textContent, FONT);
    const exclusions = stickers.map(s => s.bounds);
    const fullLeft = MARGIN;
    const fullRight = W - MARGIN;
    const textColor = isDark ? DARK_TEXT : LIGHT_TEXT;

    const textStyle = new PIXI.TextStyle({
      fontFamily: '"Bradford LL", serif',
      fontSize: 72,
      fontWeight: '400',
      fill: textColor,
      wordWrap: false,
    });

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = MARGIN;
    let done = false;
    const newTextLines = [];

    while (y < H - MARGIN && !done) {
      const lineTop = y;
      const lineBottom = y + LINE_HEIGHT;
      let spans = [{ left: fullLeft, right: fullRight }];

      for (const exc of exclusions) {
        if (exc.y >= lineBottom || exc.y + exc.h <= lineTop) continue;
        const sLeft = exc.x - 15;
        const sRight = exc.x + exc.w + 15;
        const newSpans = [];
        for (const span of spans) {
          if (sRight <= span.left || sLeft >= span.right) {
            newSpans.push(span);
          } else {
            if (sLeft > span.left + 80) newSpans.push({ left: span.left, right: sLeft });
            if (sRight < span.right - 80) newSpans.push({ left: sRight, right: span.right });
          }
        }
        spans = newSpans;
      }

      if (spans.length === 0) { y += LINE_HEIGHT; continue; }

      for (const span of spans) {
        const lineWidth = span.right - span.left;
        if (lineWidth < 80) continue;
        const range = layoutNextLineRange(prepared, cursor, lineWidth);
        if (range === null) { done = true; break; }
        const line = materializeLineRange(prepared, range);
        if (line.text.trim()) {
          const t = new PIXI.Text({ text: line.text.trim(), style: textStyle });
          t.x = span.left; t.y = y;
          textContainer.addChild(t);
          newTextLines.push({ x: span.left, y, text: line.text.trim() });
        }
        cursor = range.end;
      }
      y += LINE_HEIGHT;
    }

    // Emit scatter particles for displaced text
    const hexColor = isDark ? 0xf0f0f0 : 0x1a1a1a;
    for (const old of prevTextLines) {
      // Check if this old line position is now blocked by a sticker
      let blocked = false;
      for (const exc of exclusions) {
        if (old.y < exc.y + exc.h && old.y + LINE_HEIGHT > exc.y &&
            old.x < exc.x + exc.w && old.x + 200 > exc.x) {
          blocked = true; break;
        }
      }
      if (blocked) {
        // Emit scatter particles along this line
        for (let cx = old.x; cx < old.x + 200; cx += 8) {
          emitScatter(cx, old.y + LINE_HEIGHT / 2, hexColor);
        }
      }
    }
    prevTextLines = newTextLines;
  }

  // ─── LOAD STICKERS ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");

  const maxH = H * 0.35;
  const s1Scale = Math.min((W * 0.25) / img1.w, maxH / img1.h);
  const s2Scale = Math.min((W * 0.25) / img2.w, maxH / img2.h);

  const sticker1 = new Sticker(img1, img2, W * 0.5, H * 0.5, s1Scale);
  const stickers = [sticker1];

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
    if (draggedSticker) {
      draggedSticker.drop();
      draggedSticker = null;
      needsTextRelayout = true;
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
      needsTextRelayout = true;
    }
  });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; });
  window.addEventListener("click", handleClick);

  // Touch
  let longPressTimer = null, touchMoved = false;
  window.addEventListener("touchstart", e => {
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = false;
    longPressTimer = setTimeout(() => { if (!touchMoved) handleClick(); }, 400);
  });
  window.addEventListener("touchmove", e => {
    e.preventDefault();
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (draggedSticker) { draggedSticker.moveDrag(mouse.x, mouse.y); needsTextRelayout = true; }
  }, { passive: false });
  window.addEventListener("touchend", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (!touchMoved) handleClick();
    else if (draggedSticker) { draggedSticker.drop(); draggedSticker = null; needsTextRelayout = true; }
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
