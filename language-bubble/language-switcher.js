(() => {
  'use strict';
  const catalog = window.articleTranslations;
  const switcher = document.querySelector('.language-switcher');
  if (!catalog || !switcher) return;

  // Bind once to existing leaves, preserving links, illustrations and event listeners.
  // Keep the original nodes so switching back restores the Chinese copy exactly.
  const content = [];
  const attributes = [];
  document.querySelectorAll('body *').forEach(element => {
    if (element.closest('script, style, .language-switcher')) return;
    if ([...element.children].every(child => child.tagName === 'BR')) {
      const key = [...element.childNodes].map(node => node.nodeName === 'BR' ? '\n' : node.textContent).join('').trim();
      if (catalog[key]) content.push({ element, key, original: [...element.childNodes] });
    }
  });
  document.querySelectorAll('[alt], [aria-label], meta[name="description"]').forEach(element => {
    for (const name of ['alt', 'aria-label', 'content']) {
      const key = element.getAttribute(name);
      if (catalog[key]) attributes.push({ element, name, key });
    }
  });

  function setLanguage(language) {
    if (!['zh-CN', 'en', 'ko'].includes(language)) return;
    document.documentElement.lang = language;
    content.forEach(({ element, key, original }) => {
      if (language === 'zh-CN') {
        element.replaceChildren(...original);
        return;
      }
      const fragment = document.createDocumentFragment();
      catalog[key][language].split('\n').forEach((line, index) => {
        if (index) fragment.append(document.createElement('br'));
        fragment.append(document.createTextNode(line));
      });
      element.replaceChildren(fragment);
    });
    attributes.forEach(({ element, name, key }) => {
      element.setAttribute(name, language === 'zh-CN' ? key : catalog[key][language]);
    });
    document.querySelectorAll('atomic-design-diagram').forEach(diagram => diagram.setAttribute('lang', language));
    switcher.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    document.getElementById('language-status').textContent = {
      'zh-CN': '已切换为中文', en: 'Article language: English', ko: '한국어로 변경되었습니다',
    }[language];
    // Recalculate scroll and connector geometry after translated text reflows.
    window.dispatchEvent(new Event('resize'));
  }

  switcher.addEventListener('click', event => {
    const button = event.target.closest('button[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
  switcher.hidden = false;
})();
