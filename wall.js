(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
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

  // ─── STICKER CLASS ───
  class Sticker {
    constructor(imgData, x, y, displayScale) {
      this.imgW = imgData.w;
      this.imgH = imgData.h;
      this.posX = x; // center position
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
        const lx = (p.nx - 0.5) * this.renderW; // local coords from center
        const ly = (p.ny - 0.5) * this.renderH;

        const sprite = new PIXI.Sprite(dotTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(particleScale);
        sprite.tint = (p.r << 16) | (p.g << 8) | p.b;
        sprite.alpha = p.a / 255;
        this.container.addChild(sprite);

        this.particles.push({
          sprite,
          lx, ly, // local position (relative to sticker center)
          x: this.posX + lx,
          y: this.posY + ly,
          vx: 0, vy: 0,
          nx: p.nx, ny: p.ny, // normalized 0-1
          origR: p.r, origG: p.g, origB: p.b, origA: p.a,
          isFlipped: false,
        });
      }

      // State
      this.state = "idle"; // idle | hover | dragging
      this.hoverProgress = 0; // 0-1 for corner peel
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
    }

    // Check if point is within sticker bounds
    hitTest(mx, my) {
      return mx > this.posX - this.renderW/2 && mx < this.posX + this.renderW/2 &&
             my > this.posY - this.renderH/2 && my < this.posY + this.renderH/2;
    }

    setHover(isHover) {
      if (this.state === "dragging") return;
      this.state = isHover ? "hover" : "idle";
    }

    startDrag(mx, my) {
      this.state = "dragging";
      this.dragOffsetX = this.posX - mx;
      this.dragOffsetY = this.posY - my;
      this.hoverProgress = 1; // keep peel visible during drag
    }

    moveDrag(mx, my) {
      if (this.state !== "dragging") return;
      this.posX = mx + this.dragOffsetX;
      this.posY = my + this.dragOffsetY;
    }

    drop() {
      this.state = "idle";
      // hoverProgress will naturally animate back to 0
    }

    update(dt) {
      // Animate hover progress
      const targetHover = (this.state === "hover" || this.state === "dragging") ? 1 : 0;
      this.hoverProgress += (targetHover - this.hoverProgress) * 0.1;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        // Target position = sticker center + local offset
        let tx = this.posX + p.lx;
        let ty = this.posY + p.ly;

        // Corner peel effect: simulate folding the bottom-right corner
        if (this.hoverProgress > 0.01) {
          // Fold line: diagonal from bottom-right corner
          // Particles past the fold line get "flipped" and turn white (backside)
          const cornerX = p.nx; // 0=left, 1=right
          const cornerY = p.ny; // 0=top, 1=bottom

          // Distance from bottom-right corner (0 at corner, ~1.4 at top-left)
          const distFromCorner = Math.sqrt(Math.pow(1 - cornerX, 2) + Math.pow(1 - cornerY, 2));

          // Fold threshold moves based on hover progress
          const foldRadius = this.hoverProgress * 0.8; // larger fold area

          if (distFromCorner < foldRadius) {
            // This particle is in the folded region
            // Mirror it across the fold line (diagonal)
            const foldAmount = (foldRadius - distFromCorner) / foldRadius;

            // Fold direction: up and to the left (diagonal mirror)
            const foldDist = foldAmount * foldRadius * this.renderW * 0.5;
            tx += -foldDist * 0.7;
            ty += -foldDist * 0.7;

            // Change color to white (backside of sticker)
            p.sprite.tint = 0xf0f0f0;
            p.sprite.alpha = 0.95;
            p.isFlipped = true;
          } else if (p.isFlipped) {
            // Restore original color when unfolded
            p.sprite.tint = (p.origR << 16) | (p.origG << 8) | p.origB;
            p.sprite.alpha = p.origA / 255;
            p.isFlipped = false;
          }
        } else if (p.isFlipped) {
          p.sprite.tint = (p.origR << 16) | (p.origG << 8) | p.origB;
          p.sprite.alpha = p.origA / 255;
          p.isFlipped = false;
        }

        // Dragging: add subtle jitter/lag for organic feel
        if (this.state === "dragging") {
          // Particles slightly lag behind (creates fluid motion)
          const lag = 0.06 + Math.random() * 0.01;
          p.vx += (tx - p.x) * lag;
          p.vy += (ty - p.y) * lag;
        } else {
          // Normal spring
          p.vx += (tx - p.x) * 0.12;
          p.vy += (ty - p.y) * 0.12;
        }

        // Subtle breathing when idle
        if (this.state === "idle" && this.hoverProgress < 0.05) {
          const time = performance.now() * 0.001;
          const breathX = Math.sin(time * 0.5 + p.lx * 0.01) * 0.3;
          const breathY = Math.cos(time * 0.4 + p.ly * 0.01) * 0.2;
          p.vx += breathX * 0.01;
          p.vy += breathY * 0.01;
        }

        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;

        p.sprite.x = p.x;
        p.sprite.y = p.y;
      }
    }
  }

  // ─── LOAD STICKERS ───
  const img1 = await loadImagePixels("sticker.png");
  const img2 = await loadImagePixels("sticker2.png");

  // Layout: place stickers on screen
  const maxH = H * 0.6;
  const s1Scale = Math.min((W * 0.35) / img1.w, maxH / img1.h);
  const s2Scale = Math.min((W * 0.35) / img2.w, maxH / img2.h);

  const sticker1 = new Sticker(img1, W * 0.35, H * 0.5, s1Scale);
  const sticker2 = new Sticker(img2, W * 0.65, H * 0.5, s2Scale);
  const stickers = [sticker1, sticker2];

  console.log(`Sticker1: ${sticker1.particles.length}, Sticker2: ${sticker2.particles.length}`);

  // ─── INTERACTION ───
  const mouse = { x: -9999, y: -9999 };
  let draggedSticker = null;

  function getHoveredSticker() {
    // Check in reverse (top sticker first)
    for (let i = stickers.length - 1; i >= 0; i--) {
      if (stickers[i].hitTest(mouse.x, mouse.y)) return stickers[i];
    }
    return null;
  }

  function handleClick() {
    if (draggedSticker) {
      // Drop
      draggedSticker.drop();
      draggedSticker = null;
      return;
    }

    const hovered = getHoveredSticker();
    if (hovered) {
      hovered.startDrag(mouse.x, mouse.y);
      draggedSticker = hovered;
      // Bring to front
      app.stage.removeChild(hovered.container);
      app.stage.addChild(hovered.container);
    }
  }

  // Mouse events
  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (draggedSticker) draggedSticker.moveDrag(mouse.x, mouse.y);
  });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; });
  window.addEventListener("click", handleClick);

  // Touch events — tap or long press to pick up
  let longPressTimer = null;
  let touchMoved = false;

  window.addEventListener("touchstart", e => {
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = false;

    // Long press: start drag after 400ms
    longPressTimer = setTimeout(() => {
      if (!touchMoved) handleClick();
    }, 400);
  });

  window.addEventListener("touchmove", e => {
    e.preventDefault();
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    touchMoved = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (draggedSticker) draggedSticker.moveDrag(mouse.x, mouse.y);
  }, { passive: false });

  window.addEventListener("touchend", e => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    // Tap (no move): also triggers click
    if (!touchMoved) handleClick();
    // If dragging and lifted finger, drop
    else if (draggedSticker) { draggedSticker.drop(); draggedSticker = null; }
  });

  // ─── ANIMATION LOOP ───
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // Update hover state
    const hovered = draggedSticker ? null : getHoveredSticker();
    for (const s of stickers) {
      s.setHover(s === hovered);
      s.update(dt);
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
})();
