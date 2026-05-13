// wall.js — Main view, uses atoms-renderer.js
import { loadImagePixels, PhotoSystem, renderStamp, renderStickyNote, makeDraggable, FocusOverlay } from "./atoms-renderer.js?v=109";

(async () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new PIXI.Application();
  await app.init({ width: W, height: H, antialias: true, resolution: dpr, autoDensity: true, backgroundColor: 0x0a0a0a });
  document.body.appendChild(app.canvas);
  app.canvas.style.touchAction = "pan-y";
  app.stage.sortableChildren = true;

  const configResp = await fetch('atoms-config.json');
  const atomsConfig = await configResp.json();
  // Preload fonts before rendering
  try {
    await Promise.all([
      document.fonts.load('24px Schoolbell'),
      document.fonts.load('24px Special Elite'),
    ]);
  } catch(e) {}
  let fontRetries = 0;
  while (fontRetries < 20 && (!document.fonts.check('24px Schoolbell') || !document.fonts.check('24px Special Elite'))) {
    await new Promise(r => setTimeout(r, 100));
    fontRetries++;
  }

  // ─── Photo System (shared behavior from atoms-renderer) ───
  const photoSystem = new PhotoSystem(app, app.canvas, atomsConfig);

  const isMobile = W < 768;
  const isPortrait = H > W;

  const photoConfigs = [
    { src: 'photo_flowers.png', caption: 'Wildflowers', date: "'25 05 10",
      focus: { title: 'Wildflowers', description: 'Spring wildflowers along the mountain trail. Shot during a weekend hike in Yunnan.', link: '#', linkText: 'View story',
        article: { title: 'Wildflowers in Yunnan', sections: [
          { type: 'text', text: 'There is a trail in northern Yunnan that only exists for two weeks each spring. The snow melts, the soil softens, and then — almost overnight — the entire mountainside erupts in color.' },
          { type: 'subtitle', text: 'The Hike' },
          { type: 'text', text: 'We started at dawn from a small village at 3,200 meters. The air was thin and cold, but the light was extraordinary — that golden, low-angle light that makes everything look like a painting.' },
          { type: 'image', src: 'photo_flowers.png', caption: 'Morning light on the wildflower trail' },
          { type: 'text', text: 'By midday we had climbed another 600 meters. The flowers changed with altitude — first poppies and primroses, then gentians and rhododendrons, and finally, near the ridgeline, tiny alpine blooms I couldn\'t name.' },
          { type: 'subtitle', text: 'What I Learned' },
          { type: 'text', text: 'Photography in the mountains teaches patience. You wait for the cloud to pass, for the wind to still, for the light to shift. The best shots are never the ones you plan — they\'re the ones the mountain gives you.' },
        ]}}},
    { src: 'photo_avalanche.png', caption: 'Avalanche!', date: "'25 02 08",
      focus: { title: 'Avalanche!', description: 'Caught an avalanche on camera while backcountry skiing in Hokkaido.', link: '#', linkText: 'View story',
        article: { title: 'Avalanche in Hokkaido', sections: [
          { type: 'text', text: 'Hokkaido in February is a different planet. The snow falls sideways, the trees are ghosts, and the backcountry is as quiet as outer space — until it isn\'t.' },
          { type: 'subtitle', text: 'The Moment' },
          { type: 'text', text: 'We were traversing a ridge when we heard it. Not a crack, not a boom — more like a deep exhale. The entire slope below us started to move.' },
          { type: 'image', src: 'photo_avalanche.png', caption: 'The slide, moments after release' },
          { type: 'text', text: 'I had maybe three seconds to react. Instinct said run. Training said document. I held the camera steady for two shots, then we moved laterally along the ridge. The slide passed 200 meters below us.' },
          { type: 'subtitle', text: 'Respect the Mountain' },
          { type: 'text', text: 'Backcountry skiing is a negotiation with risk. You study the snowpack, read the terrain, check the forecast — and still, the mountain can surprise you. That\'s the deal.' },
        ]}}},
    { src: 'photo_fishing.jpg', caption: 'Big catch!', date: "'25 06 15",
      focus: { title: 'Big catch!', description: 'First time catching a yellowtail off the coast. A perfect summer day on the water.', link: '#', linkText: 'View story',
        article: { title: 'First Yellowtail', sections: [
          { type: 'text', text: 'I\'d been on boats before but never with a rod in my hand and serious intent. My friend said: "You either love fishing or you don\'t. There\'s no middle ground."' },
          { type: 'subtitle', text: 'The Wait' },
          { type: 'text', text: 'Four hours of nothing. The sun moved across the sky, the boat rocked gently, and I started to understand why people fish. It\'s not about the fish.' },
          { type: 'image', src: 'photo_fishing.jpg', caption: 'The yellowtail that changed everything' },
          { type: 'text', text: 'And then the line went tight. Not a gentle tug — a violent, rod-bending strike that nearly pulled me off my feet. Twenty minutes of chaos later, I was holding a yellowtail and grinning like an idiot.' },
        ]}}},
    { src: 'photo_portrait.jpg', caption: 'Me & cat', date: "'25 03 20",
      focus: { title: 'Me & cat', description: 'Portrait with my studio cat. She insists on supervising every design session.', link: '#', linkText: 'View story',
        article: { title: 'The Studio Cat', sections: [
          { type: 'text', text: 'She showed up one Tuesday morning, walked through the open studio door, jumped onto the desk, and sat on my keyboard. That was three years ago. She hasn\'t left.' },
          { type: 'subtitle', text: 'The Routine' },
          { type: 'text', text: 'Every morning: she watches me make coffee, follows me to the desk, and positions herself exactly where she\'ll cause maximum disruption. If I\'m designing, she sits on the trackpad. If I\'m sketching, she sits on the sketchbook.' },
          { type: 'image', src: 'photo_portrait.jpg', caption: 'Supervisor at work' },
          { type: 'text', text: 'I\'ve learned to work around her. Literally. My entire desk layout has evolved to accommodate a cat-sized gap in the center. Clients sometimes hear her in meetings. She has fans.' },
        ]}}},
  ];

  // ─── Scale factor for non-photo atoms ───
  const atomScale = isPortrait ? W / 600 : W / 1920;

  // ─── Define all wall items in display order ───
  // Each entry: { type, ...params }
  const wallItems = [
    { type: 'photo', ...photoConfigs[0] },
    { type: 'photo', ...photoConfigs[1] },
    { type: 'sticky', title: 'Generative UI', body: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', date: "'26 05 12", stampSrc: 'photo_ski.png',
      focus: { title: 'Generative UI', description: 'GenUI replaces inefficient text-only AI responses with AI-generated, structured, interactive interfaces.', link: '#', linkText: 'Read more',
        article: { title: 'Generative UI', sections: [
          { type: 'text', text: 'For decades, software interfaces have been hand-crafted: every button, every layout, every interaction designed by a human and frozen in code. AI changed what software can do — but the interfaces stayed the same.' },
          { type: 'subtitle', text: 'The Problem' },
          { type: 'text', text: 'When you ask an AI a complex question, it responds with a wall of text. Bullet points if you\'re lucky. But text is a terrible medium for structured information — comparisons, timelines, data, instructions. We\'re forcing AI output through a straw.' },
          { type: 'subtitle', text: 'The Idea' },
          { type: 'text', text: 'What if the AI could generate the interface itself? Not just the content, but the container. A comparison becomes a table. A process becomes a flowchart. A dataset becomes a visualization. The UI adapts to the answer, not the other way around.' },
          { type: 'text', text: 'This is Generative UI: AI-generated, structured, interactive interfaces that match the shape of the information they carry. Dynamic, not static. Organic, not templated. Every response is a unique design.' },
          { type: 'subtitle', text: 'Four Principles' },
          { type: 'text', text: 'Dynamic — the interface changes with every response. Organic — layouts feel natural, not mechanical. Primitive — built from simple, composable atoms. Symbiotic — human and AI collaborate on the final form.' },
        ]}}},
    { type: 'stamp', src: 'photo2.png' },
    { type: 'photo', ...photoConfigs[2] },
    { type: 'photo', ...photoConfigs[3] },
  ];

  // ─── Layout ───
  if (isPortrait) {
    // Vertical stack: all items flow top to bottom, centered
    const padding = W * 0.1;
    const photoW = W * 0.55;
    let curY = padding + photoW * 0.6;
    for (const item of wallItems) {
      item.x = W * 0.5 + (Math.random()-0.5) * W * 0.08;
      item.y = curY;
      if (item.type === 'photo') {
        curY += photoW * 1.4 + padding * 0.3;
      } else if (item.type === 'sticky') {
        curY += 280 * atomScale * 1.4 + padding * 0.3;
      } else if (item.type === 'stamp') {
        curY += 250 * atomScale * 1.2 + padding * 0.3;
      }
    }
    const totalH = curY + padding;
    if (totalH > H) {
      app.renderer.resize(W, totalH);
      document.body.style.overflow = 'auto';
    }
  } else {
    // Desktop: scattered positions
    const positions = [
      {x: W*0.15, y: H*0.3},  // photo 0
      {x: W*0.45, y: H*0.3},  // photo 1
      {x: W*0.6,  y: H*0.55}, // sticky
      {x: W*0.75, y: H*0.35}, // stamp
      {x: W*0.2,  y: H*0.7},  // photo 2
      {x: W*0.8,  y: H*0.65}, // photo 3
    ];
    for (let i = 0; i < wallItems.length; i++) {
      wallItems[i].x = positions[i].x;
      wallItems[i].y = positions[i].y;
    }
  }

  // ─── Render all items ───
  for (const item of wallItems) {
    if (item.type === 'photo') {
      const imgData = await loadImagePixels(item.src);
      const targetW = isPortrait ? W * 0.55 : W * 0.13;
      const photoScale = targetW / imgData.w;
      const photoItem = await photoSystem.addPhoto(item.src, item.x, item.y, photoScale, item);
      if (item.focus) photoItem.focusData = item.focus;
    } else if (item.type === 'sticky') {
      const stickyStampImg = await loadImagePixels(item.stampSrc);
      const stickyResult = await renderStickyNote(
        app, item.x, item.y,
        { title: item.title, body: item.body, date: item.date },
        stickyStampImg, atomsConfig.stamp
      );
      stickyResult.group.scale.set(atomScale);
      const stickyBounds = stickyResult.group.getBounds();
      const stickyItem = photoSystem.addItem(stickyResult.group, stickyBounds.width / atomScale, stickyBounds.height / atomScale);
      if (item.focus) stickyItem.focusData = item.focus;
    } else if (item.type === 'stamp') {
      const stampImg = await loadImagePixels(item.src);
      const stampResult = await renderStamp(app, stampImg, item.x, item.y, atomsConfig.stamp);
      stampResult.group.scale.set(atomScale);
      photoSystem.addItem(stampResult.group, stampResult.stampW, stampResult.stampH);
    }
  }

  // ─── Focus Overlay ───
  const focusOverlay = new FocusOverlay(app);
  photoSystem.onFocus = (item) => focusOverlay.open(item);

  const mouse = { x:-9999, y:-9999 };

  app.canvas.addEventListener("mousemove", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
  });
  app.canvas.addEventListener("mousedown", e => {
    mouse.x=e.clientX; mouse.y=e.clientY;
  });
  app.canvas.addEventListener("mouseup", () => {
  });

  // Touch
  let longPress=null, touchMoved=false;
  window.addEventListener("touchstart", e => {
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=false;
    longPress=setTimeout(()=>{
    },400);
  });
  window.addEventListener("touchmove", e => {
    const t=e.touches[0]; mouse.x=t.clientX; mouse.y=t.clientY; touchMoved=true;
    if(longPress){clearTimeout(longPress);longPress=null;}
  },{passive:false});
  window.addEventListener("touchend", () => {
    if(longPress){clearTimeout(longPress);longPress=null;}
  });

  // ─── Resize handler ───
  window.addEventListener('resize', () => {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    app.renderer.resize(newW, newH);
  });

  // ─── Ticker ───
  app.ticker.add(ticker => {
    const dt=Math.min(ticker.deltaMS/1000,0.05);
  });
})();
