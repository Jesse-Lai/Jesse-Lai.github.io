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
  const MARGIN = 60;

  // ─── STICKER CLASS ───
  class Sticker {
    constructor(imgData, x, y, displayScale) {
      this.imgW = imgData.w;
      this.imgH = imgData.h;
      this.posX = x;
      this.posY = y;
      this.scale = displayScale;
      this.renderW = imgData.w * displayScale;
      this.renderH = imgData.h * displayScale;

      const gap = 3;
      const points = sampleImage(imgData.data, imgData.w, imgData.h, gap);

      this.container = new PIXI.Container();
      app.stage.addChild(this.container);

      this.particles = [];
      const particleScale = displayScale * gap / 2;

      const dotCanvas = document.createElement("canvas");
      dotCanvas.width = 2; dotCanvas.height = 2;
      const dctx = dotCanvas.getContext("2d");
      dctx.fillStyle = "white";
      dctx.fillRect(0, 0, 2, 2);
      const dotTexture = PIXI.Texture.from(dotCanvas);

      for (const p of points) {
        const lx = (p.nx - 0.5) * this.renderW;
        const ly = (p.ny - 0.5) * this.renderH;

        const sprite = new PIXI.Sprite(dotTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(particleScale);
        sprite.tint = (p.r << 16) | (p.g << 8) | p.b;
        sprite.alpha = p.a / 255;
        this.container.addChild(sprite);

        this.particles.push({
          sprite, lx, ly,
          x: this.posX + lx, y: this.posY + ly,
          vx: 0, vy: 0,
          nx: p.nx, ny: p.ny,
          origR: p.r, origG: p.g, origB: p.b, origA: p.a,
          isFlipped: false,
        });
      }

      this.state = "idle";
      this.hoverProgress = 0;
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
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
    }

    moveDrag(mx, my) {
      if (this.state !== "dragging") return;
      this.posX = mx + this.dragOffsetX;
      this.posY = my + this.dragOffsetY;
    }

    drop() { this.state = "idle"; }

    update(dt) {
      const targetHover = (this.state === "hover" || this.state === "dragging") ? 1 : 0;
      this.hoverProgress += (targetHover - this.hoverProgress) * 0.1;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        let tx = this.posX + p.lx;
        let ty = this.posY + p.ly;

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
          }
        } else if (p.isFlipped) {
          p.sprite.tint = (p.origR << 16) | (p.origG << 8) | p.origB;
          p.sprite.alpha = p.origA / 255;
          p.isFlipped = false;
        }

        // Physics
        if (this.state === "dragging") {
          p.vx += (tx - p.x) * 0.06;
          p.vy += (ty - p.y) * 0.06;
        } else {
          p.vx += (tx - p.x) * 0.12;
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

  // ─── TEXT LAYOUT WITH PRETEXT ───
  const textContainer = new PIXI.Container();
  app.stage.addChild(textContainer);

  // We'll use a PIXI.Text for simplicity first, then re-layout with pretext
  let textGraphics = null;

  function layoutText(stickers) {
    textContainer.removeChildren();
    console.log("layoutText called");

    const prepared = prepareWithSegments(textContent, FONT);
    const exclusions = stickers.map(s => s.bounds);
    const fullLeft = MARGIN;
    const fullRight = W - MARGIN;

    const textStyle = new PIXI.TextStyle({
      fontFamily: '"Bradford LL", serif',
      fontSize: 72,
      fontWeight: '400',
      fill: TEXT_COLOR,
      wordWrap: false,
    });

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = MARGIN;

    while (y < H - MARGIN) {
      const lineTop = y;
      const lineBottom = y + LINE_HEIGHT;

      // Find available horizontal spans for this line
      // Start with full width, then subtract sticker overlaps
      let spans = [{ left: fullLeft, right: fullRight }];

      for (const exc of exclusions) {
        if (exc.y >= lineBottom || exc.y + exc.h <= lineTop) continue;
        // This sticker overlaps this line — split spans
        const sLeft = exc.x - 15;
        const sRight = exc.x + exc.w + 15;
        const newSpans = [];
        for (const span of spans) {
          if (sRight <= span.left || sLeft >= span.right) {
            newSpans.push(span); // no overlap
          } else {
            // Split: left part and right part
            if (sLeft > span.left + 80) newSpans.push({ left: span.left, right: sLeft });
            if (sRight < span.right - 80) newSpans.push({ left: sRight, right: span.right });
          }
        }
        spans = newSpans;
      }

      if (spans.length === 0) {
        y += LINE_HEIGHT;
        continue;
      }

      // Fill text into each available span on this line
      for (const span of spans) {
        const lineWidth = span.right - span.left;
        if (lineWidth < 80) continue;

        const range = layoutNextLineRange(prepared, cursor, lineWidth);
        if (range === null) break;

        const line = materializeLineRange(prepared, range);
        if (line.text.trim()) {
          const text = new PIXI.Text({ text: line.text.trim(), style: textStyle });
          text.x = span.left;
          text.y = y;
          textContainer.addChild(text);
        }
        cursor = range.end;
      }

      // Check if we've exhausted all text
      // check done via range === null below

      y += LINE_HEIGHT;
    }
  }

  // ─── LOAD STICKERS ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");

  const maxH = H * 0.35;
  const s1Scale = Math.min((W * 0.25) / img1.w, maxH / img1.h);
  const s2Scale = Math.min((W * 0.25) / img2.w, maxH / img2.h);

  const sticker1 = new Sticker(img1, W * 0.75, H * 0.3, s1Scale);
  const sticker2 = new Sticker(img2, W * 0.7, H * 0.7, s2Scale);
  const stickers = [sticker1, sticker2];

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
      if (relayoutCooldown > 0.05) { // max 20 relayouts/sec
        layoutText(stickers);
        relayoutCooldown = 0;
        needsTextRelayout = false;
      }
    }
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
