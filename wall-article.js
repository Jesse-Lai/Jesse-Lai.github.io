// wall-article.js — Wall-level composer + AI-generated JesseOS article
import { streamChat, buildSystemPrompt } from './ai-client.js?v=166';
import { createScribbleLoader } from './atoms-renderer.js?v=177';

export class WallArticle {
  constructor(focusOverlay, contentData, lang) {
    this.focusOverlay = focusOverlay;
    this.contentData = contentData;
    this.lang = lang || 'en';
    this.canvas = document.querySelector('canvas');
    this.overlay = document.getElementById('wall-article');
    this.content = document.getElementById('wall-article-content');
    this.closeBtn = document.getElementById('wall-article-close');
    this.composerEl = document.getElementById('wall-composer');
    this.atomsBtn = document.getElementById('atoms-btn');
    this._abortController = null;
    this._atomApps = [];
    this._pendingAtoms = []; // atom insertions queued during streaming
    this.isOpen = false;

    this.closeBtn.addEventListener('click', () => this.close());
  }

  setupComposer() {
    const textarea = this.composerEl.querySelector('textarea');
    const sendBtn = this.composerEl.querySelector('.send-btn');

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      sendBtn.disabled = !textarea.value.trim();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) this._send(textarea, sendBtn);
      }
    });

    sendBtn.addEventListener('click', () => {
      if (textarea.value.trim()) this._send(textarea, sendBtn);
    });
  }

  _send(textarea, sendBtn) {
    const query = textarea.value.trim();
    if (!query) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;
    this.open(query);
  }

  open(query) {
    this.isOpen = true;
    this.canvas.classList.add('faded');
    this.composerEl.style.display = 'none';
    if (this.atomsBtn) this.atomsBtn.style.display = 'none';
    this.overlay.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.overlay.classList.add('visible'));
    });
    this.overlay.scrollTop = 0;

    // User message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `<div class="chat-bubble">${this._escapeHtml(query)}</div>`;
    this.content.appendChild(userMsg);

    this._callAI(query);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
    for (const a of this._atomApps) a.destroy();
    this._atomApps = [];
    this._pendingAtoms = [];
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.content.innerHTML = '';
    }, 400);
    this.canvas.classList.remove('faded');
    this.composerEl.style.display = '';
    if (this.atomsBtn) this.atomsBtn.style.display = '';
  }

  async _callAI(query) {
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    aiMsg.appendChild(bubble);
    this.content.appendChild(aiMsg);

    this._abortController = new AbortController();
    const removeLoader = createScribbleLoader(bubble);
    let loaderRemoved = false;
    let currentEl = null;
    let buffer = '';
    let atomBuffer = [];
    const insertedAtoms = new Set();

    const flushAtomBuffer = () => {
      if (atomBuffer.length === 0) return;
      const keys = [...atomBuffer];
      atomBuffer = [];
      const placeholder = document.createElement('div');
      placeholder.className = 'atom-entry';
      bubble.appendChild(placeholder);
      if (keys.length === 1) {
        const meta = this.focusOverlay._wallItemRegistry[keys[0]];
        if (meta) {
          this.focusOverlay._createAtomEntry(meta).then(entry => {
            if (entry) { placeholder.replaceWith(entry.container); this._atomApps.push(entry.app); this._scrollToBottom(); }
            else placeholder.remove();
          });
        } else placeholder.remove();
      } else {
        this.focusOverlay._createClipEntry(keys).then(entry => {
          if (entry) { placeholder.replaceWith(entry.container); this._atomApps.push(entry.app); this._scrollToBottom(); }
          else placeholder.remove();
        });
      }
    };

    const flushText = (text) => {
      if (!text) return;
      flushAtomBuffer();
      if (!currentEl || currentEl.tagName === 'H2') {
        currentEl = document.createElement('p');
        bubble.appendChild(currentEl);
      }
      currentEl.textContent += text;
      this._scrollToBottom();
    };

    const messages = [
      { role: 'system', content: buildSystemPrompt(this.contentData, this.focusOverlay._wallItemRegistry, this.lang) },
      { role: 'user', content: query },
    ];

    await streamChat(
      messages,
      (token) => {
        if (!loaderRemoved) { removeLoader(); loaderRemoved = true; }
        buffer += token;
        while (buffer.length > 0) {
          const headingMatch = buffer.match(/^## (.+?)\n/);
          if (headingMatch) {
            flushAtomBuffer();
            currentEl = document.createElement('h2');
            bubble.appendChild(currentEl);
            currentEl.textContent = headingMatch[1];
            buffer = buffer.slice(headingMatch[0].length);
            currentEl = null;
            this._scrollToBottom();
            continue;
          }

          const atomMatch = buffer.match(/\[\[atom:(.+?)\]\]/);
          if (atomMatch) {
            const before = buffer.slice(0, atomMatch.index);
            if (before.replace(/\n/g, '').trim()) flushText(before.replace(/\n/g, ' ').trim());
            const key = atomMatch[1];
            if (!insertedAtoms.has(key)) {
              insertedAtoms.add(key);
              atomBuffer.push(key);
            }
            buffer = buffer.slice(atomMatch.index + atomMatch[0].length);
            currentEl = null;
            continue;
          }

          if (buffer.includes('[') || buffer.startsWith('#') || buffer.endsWith('#')) break;

          const nlIdx = buffer.indexOf('\n');
          if (nlIdx >= 0) {
            const chunk = buffer.slice(0, nlIdx).trim();
            if (chunk) flushText(chunk);
            buffer = buffer.slice(nlIdx + 1);
            if (chunk) currentEl = null;
            continue;
          }

          flushText(buffer);
          buffer = '';
        }
      },
      () => {
        if (buffer.trim()) flushText(buffer.trim());
        flushAtomBuffer();
        this._abortController = null;
      },
      this._abortController.signal,
    );
  }


  _scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this.overlay;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
