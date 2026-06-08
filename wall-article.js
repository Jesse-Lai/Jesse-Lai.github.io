// wall-article.js — Wall-level composer + AI-generated JesseOS article
import { streamChat, buildSystemPrompt } from './ai-client.js?v=166';
import { createScribbleLoader } from './atoms-renderer.js?v=204';

const SEND_SVG = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4.284 10.296A1 1 0 0 0 5.709 11.7L11 6.33V20a1 1 0 1 0 2 0V6.336l5.285 5.364a1 1 0 0 0 1.425-1.404l-6.823-6.924a1.25 1.25 0 0 0-1.78 0l-6.823 6.924Z" fill="currentColor"/></svg>';
const STOP_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

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
    this._chatHistory = [];
    this.isOpen = false;

    this.closeBtn.addEventListener('click', () => this.close());
  }

  setupComposer() {
    const input = this.composerEl.querySelector('.composer-input');
    const sendBtn = this.composerEl.querySelector('.send-btn');

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      sendBtn.disabled = !input.textContent.trim();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.textContent.trim() && !sendBtn.classList.contains('streaming')) this._send(input, sendBtn);
      }
    });

    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('streaming')) {
        if (this._abortController) { this._abortController.abort(); this._abortController = null; }
        this._restoreComposer(input, sendBtn);
        return;
      }
      if (input.textContent.trim()) this._send(input, sendBtn);
    });
  }

  _send(input, sendBtn) {
    const query = input.textContent.trim();
    if (!query) return;
    input.textContent = '';
    input.style.height = 'auto';
    this._setStreaming(sendBtn, true);
    if (this.isOpen) {
      // Follow-up question in existing conversation
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-msg user';
      userMsg.innerHTML = `<div class="chat-bubble">${this._escapeHtml(query)}</div>`;
      this.content.appendChild(userMsg);
      this._scrollToBottom(true);
      this._callAI(query);
    } else {
      this.open(query);
    }
  }

  open(query) {
    this.isOpen = true;
    this._chatHistory = [];
    this.canvas.classList.add('faded');
    if (this.atomsBtn) { this._atomsBtnWasVisible = this.atomsBtn.style.display !== 'none'; this.atomsBtn.style.display = 'none'; }
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

  _setStreaming(sendBtn, streaming) {
    if (streaming) {
      sendBtn.classList.add('streaming');
      sendBtn.disabled = false;
      sendBtn.innerHTML = STOP_SVG;
    } else {
      sendBtn.classList.remove('streaming');
      sendBtn.innerHTML = SEND_SVG;
    }
  }

  _restoreComposer(input, sendBtn) {
    this._setStreaming(sendBtn, false);
    sendBtn.disabled = !input.textContent.trim();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._chatHistory = [];
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
    if (this.atomsBtn) this.atomsBtn.style.display = this._atomsBtnWasVisible ? '' : 'none';
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
    let fullResponse = '';
    let atomBuffer = [];
    const insertedAtoms = new Set();

    const flushAtomBuffer = () => {
      if (atomBuffer.length === 0) return;
      const keys = [...atomBuffer];
      atomBuffer = [];

      // Check if ALL atoms are photos — only then use clip layout
      const registry = this.focusOverlay._wallItemRegistry;
      const allPhotos = keys.length > 1 && keys.every(k => registry[k]?.atomType === 'photo');

      if (allPhotos) {
        const placeholder = document.createElement('div');
        placeholder.className = 'atom-entry';
        bubble.appendChild(placeholder);
        this.focusOverlay._createClipEntry(keys).then(entry => {
          if (entry) { placeholder.replaceWith(entry.container); this._atomApps.push(entry.app); this._scrollToBottom(); }
          else placeholder.remove();
        });
      } else {
        // Render each atom individually
        for (const key of keys) {
          const meta = registry[key];
          if (!meta) continue;
          const placeholder = document.createElement('div');
          placeholder.className = 'atom-entry';
          bubble.appendChild(placeholder);
          this.focusOverlay._createAtomEntry(meta).then(entry => {
            if (entry) { placeholder.replaceWith(entry.container); this._atomApps.push(entry.app); this._scrollToBottom(); }
            else placeholder.remove();
          });
        }
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

    this._chatHistory.push({ role: 'user', content: query });
    const messages = [
      { role: 'system', content: buildSystemPrompt(this.contentData, this.focusOverlay._wallItemRegistry, this.lang) },
      ...this._chatHistory,
    ];

    await streamChat(
      messages,
      (token) => {
        if (!loaderRemoved) { removeLoader(); loaderRemoved = true; }
        fullResponse += token;
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
        this._chatHistory.push({ role: 'assistant', content: fullResponse });
        const sb = this.composerEl.querySelector('.send-btn');
        const ta = this.composerEl.querySelector('.composer-input');
        if (sb && ta) this._restoreComposer(ta, sb);
      },
      this._abortController.signal,
      { userInitiated: true },
    );
  }


  _scrollToBottom(force) {
    requestAnimationFrame(() => {
      const el = this.overlay;
      if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
