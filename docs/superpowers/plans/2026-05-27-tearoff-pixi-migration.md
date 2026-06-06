# Tearoff Card: DOM → PixiJS Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the tearoff card from a DOM overlay to a PixiJS-rendered atom, consistent with photo and sticky note atoms.

**Architecture:** Create `renderTearoffCard()` in `atoms-renderer.js` following the same pattern as `renderStickyNote()` — PIXI.Container with Graphics backgrounds, Text elements, and canvas-based paper texture. Strips use PIXI.Graphics masks for tear edges. Interactive hover/click uses PhotoSystem's canvas event model. Card integrates into masonry layout via `photoSystem.addItem()`.

**Tech Stack:** PixiJS v8 (Graphics, Text, Sprite, Container, Masks), Canvas 2D for paper texture + SVG doodle rasterization

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `atoms-renderer.js` | Modify (add ~200 lines) | New `renderTearoffCard()` export + SVG-to-sprite helper |
| `wall.js` | Modify (~340 lines removed, ~30 added) | Replace DOM card block with `renderTearoffCard()` call + PhotoSystem integration |
| `index.html` | Modify (remove ~5 lines) | Remove `#tearoff-card` hide/show in focus overlay, keep `#paper-texture` SVG filter for DOM use elsewhere |

---

### Task 1: Add SVG-to-Sprite helper in atoms-renderer.js

Doodles (robot, cat, star, etc.) are SVG paths. PixiJS can't render SVG directly. We need a helper that rasterizes an SVG string to a PIXI.Sprite via offscreen canvas.

**Files:**
- Modify: `atoms-renderer.js:6` (add after `generatePaperTexture`)

- [ ] **Step 1: Add `svgToSprite` helper**

```javascript
// Add after generatePaperTexture function (around line 31)

function svgToSprite(svgStr, w, h) {
  return new Promise((resolve) => {
    const blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(new PIXI.Sprite(PIXI.Texture.from(c)));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add atoms-renderer.js
git commit -m "feat: add svgToSprite helper for rasterizing SVG doodles to PixiJS sprites"
```

---

### Task 2: Create `renderTearoffCard()` — static structure (bg, text, robot, paper texture)

Build the card body as a PIXI.Container with: shadow, paper texture background, title, subtitle, robot doodle. No strips yet.

**Files:**
- Modify: `atoms-renderer.js` (add after `renderStickyNote`, around line 910)

- [ ] **Step 1: Add renderTearoffCard export**

```javascript
export async function renderTearoffCard(app, x, y, prompts) {
  const cardW = 280;
  const padding = 20;
  const bodyH = 150;
  const jointH = 12;
  const stripH = 100;
  const stripW = cardW / prompts.length;
  const totalH = bodyH + jointH + stripH;

  const wrapper = new PIXI.Container();
  wrapper.x = x; wrapper.y = y;

  // ── Shadow ──
  const shadow = new PIXI.Graphics();
  shadow.roundRect(3, 3, cardW, totalH, 3);
  shadow.fill({color: 0x000000, alpha: 0.12});
  wrapper.addChild(shadow);

  // ── Paper texture background (full card) ──
  const paperCanvas = await generatePaperTexture(cardW, totalH);
  if (paperCanvas) {
    const tex = PIXI.Texture.from(paperCanvas);
    const paperSprite = new PIXI.Sprite(tex);
    paperSprite.width = cardW;
    paperSprite.height = totalH;
    wrapper.addChild(paperSprite);
  }

  // ── Title ──
  const titleText = new PIXI.Text({text: 'Grab a strip\nfor your agent', style: {
    fontFamily: 'Special Elite', fontSize: 28, fill: 0x1a1a1a,
    align: 'center', wordWrap: true, wordWrapWidth: cardW - padding * 2, padding: 8,
  }});
  titleText.anchor.set(0.5, 0);
  titleText.x = cardW / 2;
  titleText.y = padding;
  wrapper.addChild(titleText);
  wrapper._titleText = titleText;

  // ── Subtitle ──
  const subtitleText = new PIXI.Text({text: 'A secret key designed for agents', style: {
    fontFamily: 'Special Elite', fontSize: 17, fill: 0x999999,
    align: 'center', wordWrap: true, wordWrapWidth: cardW - padding * 2, padding: 6,
  }});
  subtitleText.anchor.set(0.5, 0);
  subtitleText.x = cardW / 2;
  subtitleText.y = titleText.y + titleText.height + 4;
  wrapper.addChild(subtitleText);
  wrapper._subtitleText = subtitleText;

  // ── Robot doodle (rasterized SVG) ──
  const jit = () => (Math.random() - 0.5) * 2.5;
  const jLine = (x1,y1,x2,y2) => {
    const mx=(x1+x2)/2+jit()*2, my=(y1+y2)/2+jit()*2;
    return `M${x1+jit()},${y1+jit()} Q${mx},${my} ${x2+jit()},${y2+jit()}`;
  };
  const jCircle = (cx,cy,r) => {
    const pts=[];
    for(let a=0;a<=Math.PI*2+0.4;a+=0.3) pts.push(`${cx+r*Math.cos(a)+jit()},${cy+r*Math.sin(a)+jit()}`);
    return `M${pts[0]} C${pts.slice(1).join(' ')}`;
  };
  const jRect = (bx,by,bw,bh) => [jLine(bx,by,bx+bw,by),jLine(bx+bw,by,bx+bw,by+bh),jLine(bx+bw,by+bh,bx,by+bh),jLine(bx,by+bh,bx,by)].join(' ');
  const botParts = [
    jRect(14,15,32,27), jLine(30,15,30,8), jCircle(30,6,3),
    jCircle(23,25,4), jCircle(37,25,4),
    [jLine(22,35,26,37),jLine(26,37,30,35),jLine(30,35,34,37),jLine(34,37,38,35)].join(' '),
    [jLine(10,23,14,23),jLine(46,23,50,23)].join(' '),
    [jLine(10,31,14,31),jLine(46,31,50,31)].join(' '),
  ];
  const botSvgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    ${botParts.map(d => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
  </svg>`;
  const botSprite = await svgToSprite(botSvgStr, 60, 60);
  if (botSprite) {
    botSprite.x = cardW - 60 - 12;
    botSprite.y = 8;
    wrapper.addChild(botSprite);
  }

  // ── Dotted dividers between strips ──
  const dividers = new PIXI.Graphics();
  for (let i = 1; i < prompts.length; i++) {
    const dx = i * stripW;
    for (let dy = bodyH; dy < totalH; dy += 6) {
      dividers.rect(dx - 1, dy, 2, 3);
    }
  }
  dividers.fill(0xdddddd);
  wrapper.addChild(dividers);

  // ── Strip labels (vertical text, rasterized via canvas) ──
  const stripLabels = [];
  for (let i = 0; i < prompts.length; i++) {
    const label = prompts[i].label;
    // Render vertical text via offscreen canvas
    const lc = document.createElement('canvas');
    const fontSize = 9;
    const lw = stripW;
    const lh = stripH;
    lc.width = lw; lc.height = lh;
    const lctx = lc.getContext('2d');
    lctx.save();
    lctx.translate(lw / 2 + fontSize / 2, lh / 2);
    lctx.rotate(Math.PI / 2);
    lctx.font = `${fontSize}px "Red Hat Mono", monospace`;
    lctx.fillStyle = '#666';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(label, 0, 0);
    lctx.restore();
    const labelSprite = new PIXI.Sprite(PIXI.Texture.from(lc));
    labelSprite.x = i * stripW;
    labelSprite.y = bodyH + jointH;
    wrapper.addChild(labelSprite);
    stripLabels.push(labelSprite);
  }

  // ── Store metadata ──
  wrapper._cardW = cardW;
  wrapper._totalH = totalH;
  wrapper._bodyH = bodyH;
  wrapper._jointH = jointH;
  wrapper._stripH = stripH;
  wrapper._stripW = stripW;
  wrapper._prompts = prompts;
  wrapper._stripLabels = stripLabels;

  // Random slight rotation
  wrapper.rotation = (Math.random() * 3 - 1.5) * Math.PI / 180;

  return { group: wrapper, cardW, cardH: totalH };
}
```

- [ ] **Step 2: Commit**

```bash
git add atoms-renderer.js
git commit -m "feat: add renderTearoffCard with paper texture, title, robot doodle, strip labels"
```

---

### Task 3: Wire up renderTearoffCard in wall.js and remove DOM implementation

Replace the entire DOM card block (wall.js:223-559) with a call to `renderTearoffCard()` + `photoSystem.addItem()`.

**Files:**
- Modify: `wall.js:2` (add `renderTearoffCard` to import)
- Modify: `wall.js:223-559` (replace DOM block)

- [ ] **Step 1: Update import**

In `wall.js:2`, add `renderTearoffCard` to the import:

```javascript
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, renderTearoffCard, makeDraggable, FocusOverlay, getOrCreateVideo, animateTo, fadeIn } from "./atoms-renderer.js?v=178";
```

- [ ] **Step 2: Replace DOM tearoff block**

Replace everything from `// ─── Tear-off card (DOM overlay) ───` (line 223) through the closing `}` of the block scope (line 559) with:

```javascript
  // ─── Tear-off card (PixiJS atom) ───
  const tearoffPrompts = [
    { label: 'Context', text: 'Jesse Lai is a product designer at Microsoft AI with 6+ years of experience. He designs AI-native interfaces.' },
    { label: 'Style', text: 'Jesse values organic, dynamic design. His portfolio uses PixiJS particles and hand-drawn aesthetics.' },
    { label: 'Projects', text: 'Key projects: Food Delivery Service (Eleme), AI Merchant Assistant, GenUI framework, Review Analysis.' },
    { label: 'Contact', text: 'Visit jesselai.com to see interactive portfolio. Ask about GenUI or AI product design.' },
    { label: 'Collab', text: 'Jesse explores AI-native design patterns. He calls it GenUI — generative UI that replaces text-only AI.' },
  ];
  {
    const tearCol = colTops.indexOf(Math.min(...colTops));
    const tearX = (tearCol + 0.5) * colW;
    const tearY = colTops[tearCol];

    const tearResult = await renderTearoffCard(app, 0, 0, tearoffPrompts);
    tearResult.group.scale.set(atomScale);
    const tearItem = photoSystem.addItem(tearResult.group, tearResult.cardW, tearResult.cardH);

    // Position in masonry grid (same pattern as sticky notes)
    const b = tearResult.group.getBounds();
    const boundsW = tearResult.cardW * atomScale;
    tearResult.group.x = tearX - boundsW / 2;
    tearResult.group.y = tearY;

    rendered.push({ group: tearResult.group, bounds: b, wallItem: { type: 'tearoff' }, focusableItem: tearItem });

    const cardH = tearResult.cardH * atomScale;
    colTops[tearCol] += cardH + gridPad;
  }
```

- [ ] **Step 3: Remove tearoff-card references from atoms-renderer.js FocusOverlay**

In `atoms-renderer.js`, remove the 3 places where `tearoff-card` is hidden/shown (added earlier in this session). Search for `tearoff-card` and remove those lines:

- Line ~1778: remove `const tearoffCard = document.getElementById('tearoff-card'); if (tearoffCard) tearoffCard.style.display = 'none';`
- Line ~2109: remove `const tearoffCard = document.getElementById('tearoff-card'); if (tearoffCard) tearoffCard.style.display = '';`
- Line ~2177: remove `const tearoffCard = document.getElementById('tearoff-card'); if (tearoffCard) tearoffCard.style.display = '';`

- [ ] **Step 4: Commit**

```bash
git add wall.js atoms-renderer.js
git commit -m "feat: replace DOM tearoff card with PixiJS atom via renderTearoffCard"
```

---

### Task 4: Add strip click-to-copy interactivity

Strips need click handling: copy prompt text to clipboard, animate strip away, show toast. This uses PhotoSystem's canvas event model — we add a custom click handler on the wrapper that hit-tests individual strip regions.

**Files:**
- Modify: `atoms-renderer.js` (inside `renderTearoffCard`, after strip labels)

- [ ] **Step 1: Add click interactivity to renderTearoffCard**

Add before `return { group: wrapper, ... }` at end of `renderTearoffCard`:

```javascript
  // ── Strip click interactivity ──
  // Track torn state per strip
  const tornState = new Array(prompts.length).fill(false);

  // Click handler — called from PhotoSystem's canvas mouseup
  wrapper._handleStripClick = (localX, localY) => {
    // Check if click is in strip area
    if (localY < bodyH + jointH || localY > totalH) return false;
    const stripIdx = Math.floor(localX / stripW);
    if (stripIdx < 0 || stripIdx >= prompts.length || tornState[stripIdx]) return false;

    tornState[stripIdx] = true;
    navigator.clipboard.writeText(prompts[stripIdx].text).catch(() => {});

    // Animate strip label away
    const label = stripLabels[stripIdx];
    const startY = label.y;
    const startAlpha = 1;
    const startTime = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / 600);
      const ease = 1 - Math.pow(1 - t, 3);
      label.y = startY + ease * 60;
      label.alpha = startAlpha * (1 - ease);
      label.rotation = ease * 0.08;
      if (t < 1) requestAnimationFrame(tick);
      else label.visible = false;
    };
    requestAnimationFrame(tick);

    // Show toast (temporary PIXI.Text)
    const toast = new PIXI.Text({text: 'Copied! Paste to your AI \u2192', style: {
      fontFamily: 'Red Hat Mono', fontSize: 11, fill: 0xffffff, padding: 4,
    }});
    const toastBg = new PIXI.Graphics();
    toastBg.roundRect(0, 0, toast.width + 28, toast.height + 12, 4);
    toastBg.fill({color: 0x000000, alpha: 0.7});
    const toastGroup = new PIXI.Container();
    toastGroup.addChild(toastBg);
    toast.x = 14; toast.y = 6;
    toastGroup.addChild(toast);
    toastGroup.x = cardW / 2 - (toast.width + 28) / 2;
    toastGroup.y = totalH + 10;
    toastGroup.alpha = 0;
    wrapper.addChild(toastGroup);

    // Fade in then out
    const toastStart = performance.now();
    const toastTick = () => {
      const elapsed = performance.now() - toastStart;
      if (elapsed < 300) { toastGroup.alpha = elapsed / 300; requestAnimationFrame(toastTick); }
      else if (elapsed < 1500) { toastGroup.alpha = 1; requestAnimationFrame(toastTick); }
      else if (elapsed < 1800) { toastGroup.alpha = 1 - (elapsed - 1500) / 300; requestAnimationFrame(toastTick); }
      else { wrapper.removeChild(toastGroup); toastGroup.destroy({children: true}); }
    };
    requestAnimationFrame(toastTick);

    return true;
  };
```

- [ ] **Step 2: Hook into PhotoSystem click path in wall.js**

In `wall.js`, after the tearoff card is created and added to PhotoSystem, add a click interceptor. After `rendered.push(...)`:

```javascript
    // Override click behavior for tearoff strips
    tearItem._customClick = (canvasX, canvasY) => {
      const g = tearResult.group;
      // Convert canvas coords to local group coords
      const localX = (canvasX - g.x) / g.scale.x;
      const localY = (canvasY - g.y) / g.scale.y;
      return g._handleStripClick(localX, localY);
    };
```

Then in `atoms-renderer.js`, in `_makePhotoDraggable`'s mouseup handler (where `wasClick` is checked), add before the `this.onFocus` call:

```javascript
        // Check for custom click handler (e.g. tearoff strips)
        if (photo._customClick && photo._customClick(cmx, cmy)) return;
```

- [ ] **Step 3: Commit**

```bash
git add atoms-renderer.js wall.js
git commit -m "feat: add strip click-to-copy with tear animation and toast for tearoff card"
```

---

### Task 5: Verify and clean up

- [ ] **Step 1: Remove stale CSS/HTML**

In `index.html`, remove the `@keyframes tearoff` animation (no longer needed — it was for DOM strips):

```css
/* Remove this block: */
@keyframes tearoff {
  0% { transform: rotate(0deg) translateY(0); opacity: 1; }
  30% { transform: rotate(2deg) translateY(4px); }
  60% { transform: rotate(-3deg) translateY(20px); opacity: 0.8; }
  100% { transform: rotate(5deg) translateY(60px); opacity: 0; }
}
```

- [ ] **Step 2: Bump cache version**

In `index.html`, bump the wall.js version query string:

```html
<script type="module" src="wall.js?v=188"></script>
```

- [ ] **Step 3: Test in browser**

1. Open `localhost:8000/index.html`
2. Verify tearoff card renders with paper texture, title, subtitle, robot doodle
3. Verify card is draggable (same as other atoms)
4. Verify card gets blurred when focus overlay opens (no longer floating above)
5. Click a strip → verify clipboard copy + tear animation + toast
6. Verify masonry layout positions card correctly among other atoms

- [ ] **Step 4: Commit**

```bash
git add index.html atoms-renderer.js wall.js
git commit -m "chore: clean up DOM tearoff remnants, bump cache version"
```
