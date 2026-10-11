(() => {
  document.querySelectorAll('.learning-flow').forEach(diagram => {
  const svg = diagram.querySelector('.flow-arrows');
  const steps = [...diagram.querySelectorAll('.flow-step')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  let played = false;
  let visible = false;
  let paths = [];
  let frame;

  // Jesse OS curve drawing, with a longer sweep and rounded arrowhead.
  function connector(start, control, end, returning) {
    const group = document.createElementNS(ns, 'g');
    if (returning) group.classList.add('flow-return');
    const shaft = document.createElementNS(ns, 'path');
    shaft.setAttribute('d', `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`);
    shaft.setAttribute('pathLength', '1');
    const angle = Math.atan2(end.y - control.y, end.x - control.x);
    const head = document.createElementNS(ns, 'path');
    const tip = offset => ({ x: end.x - 10 * Math.cos(angle + offset), y: end.y - 10 * Math.sin(angle + offset) });
    const a = tip(-.55), b = tip(.55);
    const bend = { x: end.x - 3 * Math.cos(angle), y: end.y - 3 * Math.sin(angle) };
    head.setAttribute('d', `M${a.x},${a.y} Q${bend.x},${bend.y} ${end.x},${end.y} Q${bend.x},${bend.y} ${b.x},${b.y}`);
    group.append(shaft, head);
    svg.append(group);
    paths.push({ shaft, head });
  }

  function draw() {
    svg.replaceChildren();
    paths = [];
    const area = diagram.getBoundingClientRect();
    const boxes = steps.map(step => {
      const b = step.getBoundingClientRect();
      return { left: b.left - area.left, right: b.right - area.left, top: b.top - area.top,
        bottom: b.bottom - area.top, x: (b.left + b.right) / 2 - area.left, y: (b.top + b.bottom) / 2 - area.top };
    });
    boxes.slice(0, -1).forEach((a, i) => {
      const b = boxes[i + 1];
      if (Math.abs(a.y - b.y) < 40) {
        const right = b.x > a.x;
        const start = { x: right ? a.right + 3 : a.left - 3, y: a.y };
        const end = { x: right ? b.left - 3 : b.right + 3, y: b.y };
        connector(start, { x: start.x + (end.x - start.x) * .3, y: (start.y + end.y) / 2 + (i % 2 ? 12 : -12) }, end);
      } else {
        const start = { x: a.x, y: a.bottom + 10 };
        const end = { x: b.x, y: b.top - 24 };
        connector(start, { x: (a.x + b.x) / 2 + 30, y: start.y + (end.y - start.y) * .65 }, end);
      }
    });
    if (!played && !reduced.matches) paths.forEach(({ shaft, head }) => {
      shaft.style.strokeDasharray = '1';
      shaft.style.strokeDashoffset = '1';
      head.style.opacity = '0';
    });
    play();
  }

  function play() {
    if (played || !visible || paths.length !== steps.length - 1 || document.documentElement.dataset.pageReady !== 'true') return;
    played = true;
    if (!reduced.matches) steps.forEach((step, index) => {
      step.querySelector('.flow-frame path').animate(
        [{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }],
        { duration: 600, delay: index * 450, fill: 'backwards', easing: 'ease-in-out' }
      );
    });
    paths.forEach(({ shaft, head }, index) => {
      shaft.style.strokeDashoffset = '0';
      head.style.opacity = '1';
      if (reduced.matches) return;
      shaft.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 400, delay: index * 450 + 400, fill: 'backwards', easing: 'ease-in-out' });
      head.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: index * 450 + 800, fill: 'backwards' });
    });
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    play();
    if (played) observer.disconnect();
  }, { threshold: 0, rootMargin: '0px 0px -100px 0px' });
  observer.observe(diagram);
  new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }).observe(diagram);
  window.addEventListener('site:ready', draw, { once: true });
  reduced.addEventListener('change', draw);
  document.fonts.ready.then(draw);
  });
})();
