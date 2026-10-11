(() => {
  // Cubic corners meet the straight edges with zero curvature. Unlike a
  // circular border-radius, the curve eases into each edge (also in WebKit).
  function smoothPath(width, height, radius) {
    const r = Math.min(radius * 1.5, width / 2, height / 2);
    return `path('M ${r} 0 H ${width-r} C ${width} 0 ${width} 0 ${width} ${r}
      V ${height-r} C ${width} ${height} ${width} ${height} ${width-r} ${height}
      H ${r} C 0 ${height} 0 ${height} 0 ${height-r}
      V ${r} C 0 0 0 0 ${r} 0 Z')`.replace(/\n\s*/g, ' ');
  }

  const radii = new WeakMap();
  const observer = new ResizeObserver(entries => {
    for (const {target} of entries) {
      const {width, height} = target.getBoundingClientRect();
      if (!width || !height) continue;
      target.style.setProperty('--smooth-clip', smoothPath(width, height, radii.get(target)));
      target.classList.add('smooth-corners');
    }
  });
  for (const element of document.querySelectorAll('.stage, .prompt, .part-label, .parts button, .loading button')) {
    radii.set(element, parseFloat(getComputedStyle(element).borderTopLeftRadius));
    observer.observe(element);
  }
})();
