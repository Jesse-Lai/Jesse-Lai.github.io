(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  // ─── PIXI APP ───
  const app = new PIXI.Application();
  await app.init({
    width: W, height: H,
    resolution: dpr,
    autoDensity: true,
    backgroundColor: 0x000000,
  });
  document.body.appendChild(app.canvas);

  // ─── LOAD IMAGE & SAMPLE PIXELS ───
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "sticker.png";
  await new Promise(r => img.onload = r);

  // Draw image to offscreen canvas to read pixels
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const offCanvas = document.createElement("canvas");
  offCanvas.width = imgW;
  offCanvas.height = imgH;
  const octx = offCanvas.getContext("2d");
  octx.drawImage(img, 0, 0);
  const imageData = octx.getImageData(0, 0, imgW, imgH);
  const pixels = imageData.data;

  // ─── CREATE 1px DOT TEXTURE ───
  const dotSize = 2; // 2x2 for slight coverage overlap
  const dotCanvas = document.createElement("canvas");
  dotCanvas.width = dotSize;
  dotCanvas.height = dotSize;
  const dctx = dotCanvas.getContext("2d");
  dctx.fillStyle = "white";
  dctx.fillRect(0, 0, dotSize, dotSize);
  const dotTexture = PIXI.Texture.from(dotCanvas);

  // ─── PARTICLE CONTAINER ───
  // Scale image to fit screen (max 80% of viewport)
  const maxW = W * 0.6;
  const maxH = H * 0.8;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  const offsetX = (W - renderW) / 2;
  const offsetY = (H - renderH) / 2;

  // Sample every pixel (or subsample for performance)
  // For a ~400x500 image, every pixel = ~200k particles. Use gap=1 for full fidelity.
  const gap = 1; // pixel-perfect
  const container = new PIXI.Container();
  app.stage.addChild(container);

  const particleData = [];

  for (let y = 0; y < imgH; y += gap) {
    for (let x = 0; x < imgW; x += gap) {
      const i = (y * imgW + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];

      // Skip fully transparent pixels
      if (a < 10) continue;

      const sprite = new PIXI.Sprite(dotTexture);
      sprite.anchor.set(0.5);
      sprite.x = offsetX + x * scale;
      sprite.y = offsetY + y * scale;
      sprite.scale.set(scale * gap / dotSize * 1.05); // slight overlap to avoid gaps
      sprite.tint = (r << 16) | (g << 8) | b;
      sprite.alpha = a / 255;
      container.addChild(sprite);

      particleData.push({
        sprite,
        originX: sprite.x,
        originY: sprite.y,
        x: sprite.x,
        y: sprite.y,
        vx: 0,
        vy: 0,
      });
    }
  }

  console.log(`Particles: ${particleData.length}`);

  // ─── MOUSE INTERACTION ───
  const mouse = { x: -9999, y: -9999 };
  const interactRadius = 80;
  const pushForce = 8;

  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; });

  // ─── ANIMATION LOOP ───
  app.ticker.add((ticker) => {
    const mx = mouse.x, my = mouse.y;
    const rSq = interactRadius * interactRadius;
    const checkRadius = interactRadius + 50; // slightly larger check area
    const checkSq = checkRadius * checkRadius;

    for (let i = 0; i < particleData.length; i++) {
      const p = particleData[i];

      // Skip particles that are stationary and far from mouse
      if (Math.abs(p.vx) < 0.01 && Math.abs(p.vy) < 0.01) {
        const dx2 = p.originX - mx, dy2 = p.originY - my;
        if (dx2 * dx2 + dy2 * dy2 > checkSq) continue;
      }

      const dx = p.x - mx, dy = p.y - my;
      const distSq = dx * dx + dy * dy;

      if (distSq < rSq && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const t = 1 - dist / interactRadius;
        const force = t * t * pushForce;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // Spring back to origin
      p.vx += (p.originX - p.x) * 0.02;
      p.vy += (p.originY - p.y) * 0.02;

      // Damping
      p.vx *= 0.88;
      p.vy *= 0.88;

      p.x += p.vx;
      p.y += p.vy;

      p.sprite.x = p.x;
      p.sprite.y = p.y;
    }
  });
})();
