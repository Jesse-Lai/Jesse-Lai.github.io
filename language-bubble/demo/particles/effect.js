/*
 * Canvas / DOM adaptation of react-particle-effect-button's Export preset.
 * Original: Copyright (c) 2018 Travis Fischer, MIT (see vendor/particle-LICENSE).
 * Preserves easeOutSine, speed, lifetime and oscillation.
 * Current treatment: fine circular particles and a bottom-to-top wipe.
 * Changes: elapsed-time motion; glyph/image sampling; cancellable replay;
 * responsive DPR canvas; no React, anime.js or animation-frame dependency.
 */
(() => {
  const PRESET = Object.freeze({ duration: 800, size: .9, speed: 3, amount: 7, oscillation: 1 });
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  class ExportDissolve {
    constructor(root, onState) {
      this.root = root;
      this.content = root.querySelector('.effect-content');
      this.canvas = root.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.onState = onState;
      this.particles = [];
      this.token = 0;
      this.frame = 0;
      this.state = 'loading';
      this.preparation = null;
      this.capture = null;
    }

    setState(state) {
      this.state = state;
      this.root.dataset.state = state;
      this.onState?.(state);
    }

    async prepare() {
      if (this.preparation) return this.preparation;
      this.preparation = this.captureSource();
      try { await this.preparation; } finally { this.preparation = null; }
    }

    async captureSource() {
      const rect = this.content.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      const image = this.content.querySelector('img');
      if (image) {
        // Images can be sampled directly without re-rendering the DOM.
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(rect.width * 2);
        canvas.height = Math.ceil(rect.height * 2);
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.beginPath();
        ctx.roundRect(0, 0, rect.width, rect.height, 10);
        ctx.clip();
        ctx.drawImage(image, 0, 0, rect.width, rect.height);
        this.capture = canvas;
      } else {
        this.capture = await html2canvas(this.content, {
          backgroundColor: null, scale: 2, logging: false, imageTimeout: 10000,
          onclone: (_document, element) => {
            element.style.clipPath = 'none';
            element.style.visibility = 'visible';
          }
        });
      }
      this.pixels = this.capture.getContext('2d').getImageData(0, 0, this.capture.width, this.capture.height);
      this.buildRows();
      this.sizeCanvas();
    }

    buildRows() {
      // Sample only ink/photograph pixels: empty space never becomes confetti.
      const { width, height, data } = this.pixels;
      const sx = width / this.width;
      const sy = height / this.height;
      this.rows = Array.from({ length: Math.ceil(this.height) }, () => []);
      for (let y = 0; y < this.rows.length; y++) {
        for (let x = 0; x < Math.ceil(this.width); x++) {
          const offset = (Math.min(height - 1, Math.floor(y * sy)) * width + Math.min(width - 1, Math.floor(x * sx))) * 4;
          if (data[offset + 3] > 64) {
            this.rows[y].push({ x, color: `rgb(${data[offset]},${data[offset + 1]},${data[offset + 2]})`, alpha: data[offset + 3] / 255 });
          }
        }
      }
    }

    sizeCanvas() {
      // Export particles may travel ~204 px over their longest lifetime.
      this.padding = 225;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.width + this.padding * 2;
      const h = this.height + this.padding * 2;
      this.canvas.width = Math.ceil(w * this.dpr);
      this.canvas.height = Math.ceil(h * this.dpr);
      Object.assign(this.canvas.style, { width: `${w}px`, height: `${h}px`, left: `${-this.padding}px`, top: `${-this.padding}px` });
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    async play(rate = 1) {
      const token = ++this.token;
      this.stop();
      this.restoreContent();
      this.setState('preparing');
      const rect = this.content.getBoundingClientRect();
      if (!this.capture || Math.abs(rect.width - this.width) > .5 || Math.abs(rect.height - this.height) > .5) {
        await this.prepare();
      }
      if (token !== this.token) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.content.style.visibility = 'hidden';
        this.setState('hidden');
        return;
      }
      this.particles = [];
      this.previousProgress = 0;
      this.start = performance.now();
      this.last = this.start;
      this.rate = rate;
      this.canvas.style.visibility = 'visible';
      this.setState('playing');
      this.frame = requestAnimationFrame(time => this.tick(time));
    }

    emit(previous, progress) {
      const delta = progress - previous;
      const start = Math.max(0, Math.floor((1 - progress) * this.height));
      const end = Math.min(this.rows.length - 1, Math.ceil((1 - previous) * this.height));
      // Equivalent to the original 60 Hz emission formula, independent of fps.
      const elapsedFrames = this.step * 60 / 1000;
      const count = Math.floor(PRESET.amount * (delta * 100 + elapsedFrames));
      const occupied = [];
      for (let y = start; y <= end; y++) if (this.rows[y]?.length) occupied.push(y);
      if (!occupied.length) return;
      for (let i = 0; i < count; i++) {
        const y = occupied[Math.floor(Math.random() * occupied.length)];
        const row = this.rows[y];
        const pixel = row[Math.floor(Math.random() * row.length)];
        this.particles.push({
          x: pixel.x, y, color: pixel.color, alpha: pixel.alpha,
          angle: -Math.PI / 2 + (Math.random() - .5) * Math.PI * .65,
          life: 0, death: 28 + Math.random() * 40,
          size: PRESET.size
        });
      }
    }

    tick(time) {
      const elapsed = (time - this.start) * this.rate;
      this.step = Math.max(0, (time - this.last) * this.rate);
      this.last = time;
      const t = clamp(elapsed / PRESET.duration, 0, 1);
      const progress = Math.sin(t * Math.PI / 2);
      const cut = progress * this.height;
      this.content.style.clipPath = `inset(0 0 ${cut}px 0)`;
      if (progress < 1 || this.previousProgress < 1) this.emit(this.previousProgress, progress);
      this.previousProgress = progress;
      this.draw(this.step * 60 / 1000);
      if (t >= 1 && this.particles.length === 0) {
        this.frame = 0;
        this.content.style.visibility = 'hidden';
        this.canvas.style.visibility = 'hidden';
        this.setState('hidden');
        return;
      }
      this.frame = requestAnimationFrame(next => this.tick(next));
    }

    draw(frames) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      this.particles = this.particles.filter(p => p.life < p.death);
      for (const p of this.particles) {
        p.life += frames;
        if (p.life >= p.death) continue;
        const x = PRESET.speed * p.life;
        const y = PRESET.oscillation * Math.sin(p.life * Math.PI * 2 / 100);
        ctx.save();
        ctx.translate(this.padding + p.x, this.padding + p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = (1 - p.life / p.death) * p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.particles = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.style.visibility = 'hidden';
    }

    restoreContent() {
      this.content.style.clipPath = 'none';
      this.content.style.visibility = 'visible';
    }

    reset() {
      ++this.token;
      this.stop();
      this.restoreContent();
      this.setState('ready');
    }

    destroy() { this.reset(); this.capture = null; this.rows = []; }
  }
  window.ExportDissolve = ExportDissolve;
})();
