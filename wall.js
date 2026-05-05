(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new PIXI.Application();
  await app.init({
    width: W, height: H,
    resolution: dpr,
    autoDensity: true,
    backgroundColor: 0x000000,
  });
  document.body.appendChild(app.canvas);

  // ─── PROGRAMMATIC STICKER GENERATION ───
  function generateSticker1(text) {
    const w = 556, h = 616;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");

    // Background: transparent
    ctx.clearRect(0, 0, w, h);

    // ── Arch shape (rounded top, flat bottom) ──
    const archX = 45, archY = 20, archW = 466, archH = 520;
    const archR = archW / 2; // full semicircle top
    ctx.beginPath();
    ctx.moveTo(archX, archY + archR);
    ctx.arc(archX + archR, archY + archR, archR, Math.PI, 0); // top semicircle
    ctx.lineTo(archX + archW, archY + archH);
    ctx.lineTo(archX, archY + archH);
    ctx.closePath();
    ctx.fillStyle = "#1f4a50"; // dark teal
    ctx.fill();

    // ── Three-petal flower (trefoil) ──
    const cx = w / 2, cy = 310;
    const petalR = 95;
    const petalDist = 55;

    ctx.fillStyle = "#f0e6d3"; // cream/white
    // Top petal
    ctx.beginPath();
    ctx.ellipse(cx, cy - petalDist, petalR * 0.85, petalR, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bottom-left petal
    ctx.beginPath();
    ctx.ellipse(cx - petalDist * 0.9, cy + petalDist * 0.5, petalR * 0.85, petalR, Math.PI * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Bottom-right petal
    ctx.beginPath();
    ctx.ellipse(cx + petalDist * 0.9, cy + petalDist * 0.5, petalR * 0.85, petalR, -Math.PI * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // ── Orange starburst center ──
    ctx.fillStyle = "#e8611a";
    const starCx = cx, starCy = cy + 10;
    const outerR = 38, innerR = 22;
    const points = 10;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const sx = starCx + Math.cos(angle) * r;
      const sy = starCy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // ── Text strip at bottom ──
    const stripY = archY + archH;
    const stripH = 70;
    ctx.fillStyle = "#e8e0cf";
    ctx.fillRect(archX, stripY, archW, stripH);

    // Main text
    ctx.fillStyle = "#1f4a50";
    ctx.font = "bold 36px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text || "JESSE LAI", cx, stripY + stripH / 2);

    // ── Small labels: "26" and "MI." ──
    ctx.font = "bold 22px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    ctx.fillStyle = "#1f4a50";
    ctx.textAlign = "center";
    ctx.fillText("26", archX + 60, archY + archR - 60);
    ctx.fillText("MI.", archX + archW - 60, archY + archR - 60);

    return { data: ctx.getImageData(0, 0, w, h), w, h };
  }

  // ─── LOAD STICKER 2 (still from image for now) ───
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

  // Sample pixels → array of {x, y, r, g, b, a} in normalized coords (0-1)
  function sampleImage(imageData, w, h, gap) {
    const pixels = imageData.data;
    const points = [];
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        const i = (y * w + x) * 4;
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
        if (a < 128) continue; // sharp edge: skip semi-transparent
        points.push({ nx: x / w, ny: y / h, r, g, b, a });
      }
    }
    return points;
  }

  // ─── GENERATE STICKERS ───
  const img1 = generateSticker1("");
  const img2 = await loadImagePixels("sticker2.png");

  const gap = 3; // 3x3 sampling for smooth performance
  const points1 = sampleImage(img1.data, img1.w, img1.h, gap);
  const points2 = sampleImage(img2.data, img2.w, img2.h, gap);

  console.log(`Sticker1: ${points1.length}, Sticker2: ${points2.length}`);

  // Use the larger set as particle count
  const maxCount = Math.max(points1.length, points2.length);

  // Pad smaller array by recycling points
  while (points1.length < maxCount) points1.push(points1[Math.floor(Math.random() * points1.length)]);
  while (points2.length < maxCount) points2.push(points2[Math.floor(Math.random() * points2.length)]);

  // Shuffle points2 for more interesting transitions
  for (let i = points2.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points2[i], points2[j]] = [points2[j], points2[i]];
  }

  // ─── LAYOUT: both stickers centered in same position ───
  const margin = 40;
  const availW = W - margin * 2;
  const availH = H - margin * 2;

  const scale1 = Math.min(availW / img1.w, availH / img1.h) * 0.7;
  const offset1X = (W - img1.w * scale1) / 2;
  const offset1Y = (H - img1.h * scale1) / 2;

  const scale2 = Math.min(availW / img2.w, availH / img2.h) * 0.7;
  const offset2X = (W - img2.w * scale2) / 2;
  const offset2Y = (H - img2.h * scale2) / 2;

  // Convert normalized coords to screen coords
  function toScreen1(p) { return { x: offset1X + p.nx * img1.w * scale1, y: offset1Y + p.ny * img1.h * scale1 }; }
  function toScreen2(p) { return { x: offset2X + p.nx * img2.w * scale2, y: offset2Y + p.ny * img2.h * scale2 }; }

  // ─── DOT TEXTURE (1x1 pixel, sharp) ───
  const dotCanvas = document.createElement("canvas");
  dotCanvas.width = 2; dotCanvas.height = 2;
  const dctx = dotCanvas.getContext("2d");
  dctx.fillStyle = "white";
  dctx.fillRect(0, 0, 2, 2);
  const dotTexture = PIXI.Texture.from(dotCanvas);

  // ─── CREATE PARTICLES ───
  const container = new PIXI.Container();
  app.stage.addChild(container);

  const particles = [];
  const particleScale = scale1 * gap / 2; // exact pixel size, no overlap

  for (let i = 0; i < maxCount; i++) {
    const p1 = points1[i];
    const pos = toScreen1(p1);

    const sprite = new PIXI.Sprite(dotTexture);
    sprite.anchor.set(0.5);
    sprite.x = pos.x;
    sprite.y = pos.y;
    sprite.scale.set(particleScale);
    sprite.tint = (p1.r << 16) | (p1.g << 8) | p1.b;
    sprite.alpha = p1.a / 255;
    container.addChild(sprite);

    particles.push({
      sprite,
      x: pos.x, y: pos.y,
      vx: 0, vy: 0,
      // State A (sticker 1)
      ax: pos.x, ay: pos.y,
      ar: p1.r, ag: p1.g, ab: p1.b, aa: p1.a,
      // State B (sticker 2)
      bx: toScreen2(points2[i]).x, by: toScreen2(points2[i]).y,
      br: points2[i].r, bg: points2[i].g, bb: points2[i].b, ba: points2[i].a,
    });
  }

  console.log(`Total particles: ${maxCount}`);

  // ─── STATE: morph timing ───
  let targetB = false;
  let morphProgress = 0; // 0 = A, 1 = B
  let morphStart = null;
  let morphFrom = 0;
  let morphTo = 0;
  const morphDuration = 1000; // ms

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function startMorph(toB) {
    if (targetB === toB) return;
    targetB = toB;
    morphFrom = morphProgress;
    morphTo = toB ? 1 : 0;
    morphStart = performance.now();
  }

  // ─── MOUSE ───
  const mouse = { x: -9999, y: -9999 };
  window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; });

  // Detect hover on sticker area (centered)
  function isOverSticker() {
    const sw = Math.max(img1.w * scale1, img2.w * scale2);
    const sh = Math.max(img1.h * scale1, img2.h * scale2);
    const cx = W / 2, cy = H / 2;
    return mouse.x > cx - sw/2 && mouse.x < cx + sw/2 &&
           mouse.y > cy - sh/2 && mouse.y < cy + sh/2;
  }

  // ─── ANIMATION ───
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // Determine target
    const shouldBeB = isOverSticker();
    startMorph(shouldBeB);

    // Update morph progress with timer
    if (morphStart !== null) {
      const elapsed = performance.now() - morphStart;
      const t = Math.min(elapsed / morphDuration, 1);
      morphProgress = morphFrom + (morphTo - morphFrom) * easeOutCubic(t);
      if (t >= 1) morphStart = null; // done
    }

    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Interpolate target position and color
      const tx = p.ax + (p.bx - p.ax) * morphProgress;
      const ty = p.ay + (p.by - p.ay) * morphProgress;

      // Spring to target
      p.vx += (tx - p.x) * 0.08;
      p.vy += (ty - p.y) * 0.08;
      p.vx *= 0.82;
      p.vy *= 0.82;
      p.x += p.vx;
      p.y += p.vy;

      p.sprite.x = p.x;
      p.sprite.y = p.y;

      // Interpolate color
      const r = Math.round(p.ar + (p.br - p.ar) * morphProgress);
      const g = Math.round(p.ag + (p.bg - p.ag) * morphProgress);
      const b = Math.round(p.ab + (p.bb - p.ab) * morphProgress);
      p.sprite.tint = (r << 16) | (g << 8) | b;

      const a = p.aa + (p.ba - p.aa) * morphProgress;
      p.sprite.alpha = a / 255;
    }
  });

  // ─── RESIZE ───
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nW = window.innerWidth;
      if (Math.abs(nW - W) > 50) location.reload();
    }, 500);
  });
})();
