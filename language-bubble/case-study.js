(() => {
  'use strict';
  const toggle = document.getElementById('theme-toggle');
  toggle?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    toggle.querySelector('span').textContent = dark ? '深色' : '浅色';
    toggle.setAttribute('aria-label', dark ? '切换为浅色主题' : '切换为深色主题');
  });
})();
