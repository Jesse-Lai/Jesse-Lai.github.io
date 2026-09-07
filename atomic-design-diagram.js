// Shape interpolation is powered by Flubber 0.4.2 (MIT):
// https://github.com/veltman/flubber

const FLUBBER_SRC = 'lib/flubber.min.js';
const BACKGROUND_SRC = 'content_images/deepseek-atomic-bg.webp';
const CIRCLE_SRC = 'content_images/deepseek-atomic-circle.svg';
const TRIANGLE_SRC = 'content_images/deepseek-atomic-triangle.svg';
const STAR_SRC = 'content_images/deepseek-atomic-star.svg';

let flubberReady;

function loadFlubber() {
  if (window.flubber) return Promise.resolve(window.flubber);
  if (flubberReady) return flubberReady;

  flubberReady = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-atomic-flubber]');
    const script = existing || document.createElement('script');
    const onLoad = () => window.flubber
      ? resolve(window.flubber)
      : reject(new Error('Flubber loaded without exposing its browser API.'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load Flubber.')), { once: true });
    if (!existing) {
      script.src = new URL(FLUBBER_SRC, document.baseURI).href;
      script.dataset.atomicFlubber = '';
      document.head.appendChild(script);
    }
  });

  return flubberReady;
}

function sampleCircle(circle, placement, points = 160) {
  const cx = Number(circle.getAttribute('cx'));
  const cy = Number(circle.getAttribute('cy'));
  const r = Number(circle.getAttribute('r'));
  return Array.from({ length: points }, (_, index) => {
    const angle = -Math.PI / 2 + (index / points) * Math.PI * 2;
    return [
      placement.x + cx + Math.cos(angle) * r,
      placement.y + cy + Math.sin(angle) * r,
    ];
  });
}

function samplePath(pathData, placement, points = 180) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;visibility:hidden;';
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const length = path.getTotalLength();
  const ring = Array.from({ length: points }, (_, index) => {
    const point = path.getPointAtLength((index / points) * length);
    return [placement.x + point.x, placement.y + point.y];
  });
  svg.remove();
  return ring;
}

function sampleRoundedRect({ x, y, width, height, radius }, pointsPerCorner = 36) {
  const corners = [
    { cx: x + width - radius, cy: y + radius, start: -Math.PI / 2 },
    { cx: x + width - radius, cy: y + height - radius, start: 0 },
    { cx: x + radius, cy: y + height - radius, start: Math.PI / 2 },
    { cx: x + radius, cy: y + radius, start: Math.PI },
  ];

  return corners.flatMap(corner => Array.from({ length: pointsPerCorner }, (_, index) => {
    const angle = corner.start + (index / pointsPerCorner) * (Math.PI / 2);
    return [corner.cx + Math.cos(angle) * radius, corner.cy + Math.sin(angle) * radius];
  }));
}

async function loadSvgShape(src, placement) {
  const response = await fetch(new URL(src, document.baseURI));
  if (!response.ok) throw new Error(`Unable to load ${src}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  const circle = doc.querySelector('circle');
  if (circle) return sampleCircle(circle, placement);
  const path = doc.querySelector('path');
  if (!path) throw new Error(`No shape found in ${src}`);
  return samplePath(path.getAttribute('d'), placement);
}

const TEMPLATE = document.createElement('template');

TEMPLATE.innerHTML = `
  <style>
    @font-face {
      font-family: 'MFBoHeHaiYanNoncommercial';
      src: local('MFBoHeHaiYanNoncommercial');
      font-style: normal;
      font-weight: 400;
    }

    :host {
      display: block;
      width: 100%;
      margin: 32px 0 0;
      color-scheme: light;
    }

    * { box-sizing: border-box; }

    .scene {
      position: relative;
      container-type: inline-size;
      width: 100%;
      aspect-ratio: 16 / 9;
      margin: 0;
      overflow: hidden;
      border-radius: 6px;
      background: #827f61;
      isolation: isolate;
    }

    .background-reference {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      user-select: none;
    }

    .draggable-group {
      position: absolute;
      z-index: 1;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .draggable-group.dragging {
      cursor: grabbing;
    }

    .atom-cluster {
      left: 8.10546875%;
      top: 34.15798611%;
      width: 19.53125%;
    }

    .atom-cluster.docked {
      display: none;
    }

    .atom-card {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
    }

    .card-surface,
    .morph-svg {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }

    .morph-svg { overflow: visible; }
    .goo-layer { opacity: .085; }
    .goo-tail { opacity: .72; }
    .goo-body { opacity: 1; }
    .shape-main { fill: #a9d7ff; fill-opacity: .2; }
    .loading .morph-svg { opacity: 0; }

    .cluster-label {
      position: absolute;
      z-index: 3;
      margin: 0;
      color: #fff;
      font-family: 'MFBoHeHaiYanNoncommercial', 'PF PinFan HuTu', sans-serif;
      font-size: max(9px, 2cqw);
      font-style: normal;
      font-weight: 400;
      line-height: 1;
      letter-spacing: .06em;
      text-align: center;
      white-space: nowrap;
      text-shadow: 0 1px 4px rgba(0, 0, 0, .22);
      pointer-events: none;
    }

    .atom-label {
      left: 8.10546875%;
      top: 73.05%;
      width: 19.53125%;
    }

    .application-cluster {
      left: 33.85%;
      top: 14.45%;
      width: 60.65%;
    }

    .application-grid {
      --col-1: 33.333fr;
      --col-2: 33.334fr;
      --col-3: 33.333fr;
      --col-4: 0fr;
      --row-1: 50fr;
      --row-2: 50fr;
      --split-x1: 33.333%;
      --split-x2: 66.667%;
      --split-x3: 75%;
      --split-y: 50%;
      position: relative;
      display: grid;
      grid-template-columns: var(--col-1) var(--col-2) var(--col-3);
      grid-template-rows: var(--row-1) var(--row-2);
      width: 100%;
      aspect-ratio: 1312 / 888;
      padding: 1.1%;
      gap: clamp(2px, .55cqw, 4px);
      overflow: hidden;
      border-radius: 2.1%;
      background: #e9e9e9;
    }

    .application-grid.has-docked-atom {
      grid-template-columns: var(--col-1) var(--col-2) var(--col-3) var(--col-4);
    }

    .application-grid.drop-ready {
      box-shadow: 0 0 0 3px rgba(169, 215, 255, .9), 0 0 24px rgba(169, 215, 255, .55);
    }

    .application-tile {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      margin: 0;
      overflow: hidden;
      border-radius: 4.5%;
      background: #fff;
    }

    .application-tile img,
    .application-tile .square-shape {
      display: block;
      width: 70%;
      height: 70%;
      object-fit: contain;
      pointer-events: none;
    }

    .application-tile .triangle-shape { width: 76%; height: 76%; }
    .application-tile .star-shape { width: 78%; height: 78%; }

    .application-tile.docked-atom {
      cursor: grab;
      touch-action: none;
    }

    .application-tile.docked-atom:active { cursor: grabbing; }

    .application-tile.docked-atom .atom-card {
      width: 82%;
      aspect-ratio: 1;
      overflow: visible;
    }

    .application-tile.docked-atom .card-surface {
      display: none;
    }

    .square-shape {
      border-radius: 9%;
      background: rgba(169, 215, 255, .2);
      box-shadow: inset 0 0 36px rgba(169, 215, 255, .45);
    }

    .splitter {
      position: absolute;
      z-index: 5;
      touch-action: none;
    }

    .splitter::after {
      content: '';
      position: absolute;
      border-radius: 999px;
      background: rgba(169, 215, 255, 0);
    }

    .splitter:hover::after,
    .splitter:focus-visible::after,
    .splitter.resizing::after {
      background: rgba(169, 215, 255, .9);
    }

    .splitter.vertical {
      top: 1.1%;
      bottom: 1.1%;
      width: 14px;
      margin-left: -7px;
      cursor: col-resize;
    }

    .splitter.vertical::after {
      inset: 4px 6px;
    }

    .splitter.horizontal {
      left: 1.1%;
      right: 1.1%;
      height: 14px;
      margin-top: -7px;
      cursor: row-resize;
    }

    .splitter.horizontal::after {
      inset: 6px 4px;
    }

    .splitter-x1 { left: var(--split-x1); }
    .splitter-x2 { left: var(--split-x2); }
    .splitter-x3 { left: var(--split-x3); display: none; }
    .application-grid.has-docked-atom .splitter-x3 { display: block; }
    .splitter-y { top: var(--split-y); }

    .application-label {
      left: 33.85%;
      top: 90.87%;
      width: 60.65%;
    }

    .transfer-overlay {
      position: absolute;
      inset: 0;
      z-index: 8;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .goo-layer { display: none; }
    }
  </style>

  <figure class="scene loading" role="img">
    <img class="background-reference" alt="" draggable="false">
    <div class="draggable-group atom-cluster" data-draggable="atom">
      <div class="atom-card" aria-hidden="true">
        <img class="card-surface" src="content_images/deepseek-atomic-card.svg" alt="" draggable="false">
        <svg class="morph-svg" viewBox="0 0 400 400" aria-hidden="true">
          <defs>
            <filter id="goo" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur"/>
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"/>
            </filter>
            <filter id="inner-glow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
              <feFlood flood-color="#A9D7FF" flood-opacity=".45" result="glow"/>
              <feComposite in="glow" in2="SourceAlpha" operator="in" result="glowMask"/>
              <feGaussianBlur in="glowMask" stdDeviation="25" result="softGlow"/>
              <feComposite in="softGlow" in2="SourceAlpha" operator="in" result="innerGlow"/>
              <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="innerGlow"/></feMerge>
            </filter>
          </defs>
          <g class="goo-layer" filter="url(#goo)">
            <path class="goo-tail" fill="#A9D7FF"></path>
            <path class="goo-body" fill="#A9D7FF"></path>
          </g>
          <path class="shape-main" filter="url(#inner-glow)"></path>
        </svg>
      </div>
    </div>
    <div class="draggable-group application-cluster" data-draggable="application">
      <div class="application-grid">
        <div class="application-tile"><img src="content_images/deepseek-atomic-circle.svg" alt="" draggable="false"></div>
        <div class="application-tile"><img class="triangle-shape" src="content_images/deepseek-atomic-triangle.svg" alt="" draggable="false"></div>
        <div class="application-tile"><img src="content_images/deepseek-atomic-circle.svg" alt="" draggable="false"></div>
        <div class="application-tile"><img class="triangle-shape" src="content_images/deepseek-atomic-triangle.svg" alt="" draggable="false"></div>
        <div class="application-tile"><span class="square-shape"></span></div>
        <div class="application-tile"><img class="star-shape" src="content_images/deepseek-atomic-star.svg" alt="" draggable="false"></div>
        <div class="splitter vertical splitter-x1" data-splitter="x1" role="separator" aria-label="调整第一列宽度" tabindex="0"></div>
        <div class="splitter vertical splitter-x2" data-splitter="x2" role="separator" aria-label="调整第二列宽度" tabindex="0"></div>
        <div class="splitter vertical splitter-x3" data-splitter="x3" role="separator" aria-label="调整第三列宽度" tabindex="0"></div>
        <div class="splitter horizontal splitter-y" data-splitter="y" role="separator" aria-label="调整上下区域高度" tabindex="0"></div>
      </div>
    </div>
    <p class="cluster-label atom-label">原子组件</p>
    <p class="cluster-label application-label">应用场景</p>
  </figure>
`;

class AtomicDesignDiagram extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(TEMPLATE.content.cloneNode(true));
    this._frame = 0;
    this._animationStart = 0;
    this._dragZ = 1;
    this._atomDocked = false;
  }

  connectedCallback() {
    const scene = this.shadowRoot.querySelector('.scene');
    const background = this.shadowRoot.querySelector('.background-reference');
    const isEnglish = (this.getAttribute('lang') || document.documentElement.lang).toLowerCase().startsWith('en');
    background.src = BACKGROUND_SRC;
    scene.setAttribute('aria-label', isEnglish
      ? 'Drag the atomic component into or out of the responsive application layout.'
      : '原子组件可拖入或拖出响应式应用场景，分隔线可调整各区域大小。');
    this._setupInteractions();
    if (!this._started) {
      this._started = true;
      this._startAnimation();
    }
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._frame);
    this._frame = 0;
    this._started = false;
    this._interactionAbort?.abort();
  }

  _setupInteractions() {
    this._interactionAbort?.abort();
    this._interactionAbort = new AbortController();
    const { signal } = this._interactionAbort;
    const scene = this.shadowRoot.querySelector('.scene');
    const grid = this.shadowRoot.querySelector('.application-grid');
    const atomGroup = this.shadowRoot.querySelector('.atom-cluster');
    const atomCard = this.shadowRoot.querySelector('.atom-card');
    const state = { columns: 3, x1: 33.333, x2: 66.667, x3: 75, y: 50 };

    const applyGrid = () => {
      grid.style.setProperty('--col-1', `${state.x1}fr`);
      grid.style.setProperty('--col-2', `${state.x2 - state.x1}fr`);
      grid.style.setProperty('--col-3', `${(state.columns === 4 ? state.x3 : 100) - state.x2}fr`);
      grid.style.setProperty('--col-4', `${state.columns === 4 ? 100 - state.x3 : 0}fr`);
      grid.style.setProperty('--row-1', `${state.y}fr`);
      grid.style.setProperty('--row-2', `${100 - state.y}fr`);
      grid.style.setProperty('--split-x1', `${state.x1}%`);
      grid.style.setProperty('--split-x2', `${state.x2}%`);
      grid.style.setProperty('--split-x3', `${state.x3}%`);
      grid.style.setProperty('--split-y', `${state.y}%`);
    };

    const updateSplit = (kind, value) => {
      const minimum = state.columns === 4 ? 14 : 18;
      if (kind === 'x1') state.x1 = Math.min(state.x2 - minimum, Math.max(minimum, value));
      if (kind === 'x2') {
        const maximum = state.columns === 4 ? state.x3 - minimum : 82;
        state.x2 = Math.min(maximum, Math.max(state.x1 + minimum, value));
      }
      if (kind === 'x3' && state.columns === 4) {
        state.x3 = Math.min(86, Math.max(state.x2 + minimum, value));
      }
      if (kind === 'y') state.y = Math.min(75, Math.max(25, value));
      applyGrid();
    };

    const pointInsideGrid = event => {
      const rect = grid.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };

    const captureTileRects = () => new Map(
      [...grid.querySelectorAll('.application-tile')].map(tile => [tile, tile.getBoundingClientRect()]),
    );

    const dockAtom = () => {
      if (this._atomDocked) return;
      const sourceRect = atomCard.getBoundingClientRect();
      const before = captureTileRects();
      const tile = document.createElement('div');
      tile.className = 'application-tile docked-atom';
      tile.dataset.dockedAtom = '';
      tile.setAttribute('aria-label', '拖出原子组件');
      grid.insertBefore(tile, grid.querySelector('.splitter'));
      tile.appendChild(atomCard);
      atomGroup.classList.add('docked');
      grid.classList.add('has-docked-atom');
      grid.classList.remove('drop-ready');
      this._atomDocked = true;
      state.columns = 4;
      state.x1 = 25;
      state.x2 = 50;
      state.x3 = 75;
      applyGrid();
      const targetRect = atomCard.getBoundingClientRect();
      this._animateTileReflow(before, [{ element: atomCard, fromRect: sourceRect, toRect: targetRect }]);
      this._animateFlubberTransfer(sourceRect, targetRect);
    };

    const undockAtom = tile => {
      if (!this._atomDocked) return;
      const sourceRect = atomCard.getBoundingClientRect();
      const before = captureTileRects();
      const sceneRect = scene.getBoundingClientRect();
      const atomSize = sceneRect.width * .1953125;
      const left = Math.min(
        sceneRect.width - atomSize,
        Math.max(0, sourceRect.left + sourceRect.width / 2 - sceneRect.left - atomSize / 2),
      );
      const top = Math.min(
        sceneRect.height - atomSize,
        Math.max(0, sourceRect.top + sourceRect.height / 2 - sceneRect.top - atomSize / 2),
      );
      atomGroup.appendChild(atomCard);
      atomGroup.classList.remove('docked');
      atomGroup.style.left = `${(left / sceneRect.width) * 100}%`;
      atomGroup.style.top = `${(top / sceneRect.height) * 100}%`;
      tile.remove();
      grid.classList.remove('has-docked-atom', 'drop-ready');
      this._atomDocked = false;
      state.columns = 3;
      state.x1 = 33.333;
      state.x2 = 66.667;
      state.x3 = 75;
      applyGrid();
      this._animateTileReflow(before);
      this._animateFlubberTransfer(sourceRect, atomCard.getBoundingClientRect());
    };

    const beginGroupDrag = (group, event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const sceneRect = scene.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = groupRect.left - sceneRect.left;
      const startTop = groupRect.top - sceneRect.top;
      const isAtom = group === atomGroup;
      group.style.zIndex = String(++this._dragZ);
      group.classList.add('dragging');

      const move = moveEvent => {
        const maxLeft = Math.max(0, sceneRect.width - groupRect.width);
        const maxTop = Math.max(0, sceneRect.height - groupRect.height);
        const left = Math.min(maxLeft, Math.max(0, startLeft + moveEvent.clientX - startX));
        const top = Math.min(maxTop, Math.max(0, startTop + moveEvent.clientY - startY));
        group.style.left = `${(left / sceneRect.width) * 100}%`;
        group.style.top = `${(top / sceneRect.height) * 100}%`;
        if (isAtom && !this._atomDocked) {
          grid.classList.toggle('drop-ready', pointInsideGrid(moveEvent));
        }
      };

      const finish = endEvent => {
        group.classList.remove('dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        const shouldDock = isAtom && !this._atomDocked
          && endEvent?.type === 'pointerup' && pointInsideGrid(endEvent);
        grid.classList.remove('drop-ready');
        if (shouldDock) dockAtom();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish, { once: true });
      window.addEventListener('pointercancel', finish, { once: true });
    };

    this.shadowRoot.querySelectorAll('[data-draggable]').forEach(group => {
      group.addEventListener('pointerdown', event => {
        if (event.target.closest('.splitter, [data-docked-atom]')) return;
        beginGroupDrag(group, event);
      }, { signal });
    });

    grid.addEventListener('pointerdown', event => {
      const tile = event.target.closest('[data-docked-atom]');
      if (!tile || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      undockAtom(tile);
      beginGroupDrag(atomGroup, event);
    }, { signal });

    this.shadowRoot.querySelectorAll('[data-splitter]').forEach(splitter => {
      const kind = splitter.dataset.splitter;
      splitter.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        splitter.setPointerCapture(event.pointerId);
        splitter.classList.add('resizing');
        const move = moveEvent => {
          const rect = grid.getBoundingClientRect();
          const value = kind === 'y'
            ? ((moveEvent.clientY - rect.top) / rect.height) * 100
            : ((moveEvent.clientX - rect.left) / rect.width) * 100;
          updateSplit(kind, value);
        };
        const finish = () => {
          splitter.classList.remove('resizing');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', finish);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish, { once: true });
        window.addEventListener('pointercancel', finish, { once: true });
      }, { signal });

      splitter.addEventListener('keydown', event => {
        const directions = { ArrowLeft: -2, ArrowRight: 2, ArrowUp: -2, ArrowDown: 2 };
        if (!(event.key in directions)) return;
        if (kind === 'y' && !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        if (kind !== 'y' && !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        if (kind === 'x3' && state.columns !== 4) return;
        event.preventDefault();
        updateSplit(kind, state[kind] + directions[event.key]);
      }, { signal });
    });
  }

  _animateTileReflow(beforeRects, extraTransitions = []) {
    const transitions = [];
    beforeRects.forEach((before, tile) => {
      if (!tile.isConnected || tile.matches('[data-docked-atom]')) return;
      transitions.push({ element: tile, fromRect: before, toRect: tile.getBoundingClientRect() });
    });
    this._animateFlubberElements([...transitions, ...extraTransitions]);
  }

  async _animateFlubberElements(transitions) {
    if (!transitions.length) return;
    try {
      const flubber = await loadFlubber();
      if (!this.isConnected) return;
      const scene = this.shadowRoot.querySelector('.scene');
      const sceneRect = scene.getBoundingClientRect();
      const helper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      helper.setAttribute('viewBox', `0 0 ${sceneRect.width} ${sceneRect.height}`);
      helper.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;visibility:hidden;pointer-events:none;';
      scene.appendChild(helper);
      const items = transitions.map(({ element, fromRect, toRect }) => {
        const local = rect => ({
          x: rect.left - sceneRect.left,
          y: rect.top - sceneRect.top,
          width: rect.width,
          height: rect.height,
          radius: Math.max(3, Math.min(rect.width, rect.height) * .045),
        });
        const from = local(fromRect);
        const to = local(toRect);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        helper.appendChild(path);
        element.style.transformOrigin = '0 0';
        element.style.willChange = 'transform';
        return {
          element,
          path,
          to,
          interpolate: flubber.interpolate(
            sampleRoundedRect(from, 20),
            sampleRoundedRect(to, 20),
            { maxSegmentLength: 3 },
          ),
        };
      });
      const started = performance.now();
      const duration = 360;
      const draw = now => {
        const linear = Math.min(1, (now - started) / duration);
        const eased = .5 - Math.cos(Math.PI * linear) / 2;
        items.forEach(item => {
          if (!item.element.isConnected) return;
          item.path.setAttribute('d', item.interpolate(eased));
          const box = item.path.getBBox();
          item.element.style.transform = `translate(${box.x - item.to.x}px, ${box.y - item.to.y}px) scale(${box.width / Math.max(1, item.to.width)}, ${box.height / Math.max(1, item.to.height)})`;
        });
        if (linear < 1 && helper.isConnected) {
          requestAnimationFrame(draw);
        } else {
          items.forEach(({ element }) => {
            element.style.removeProperty('transform');
            element.style.removeProperty('transform-origin');
            element.style.removeProperty('will-change');
          });
          helper.remove();
        }
      };
      requestAnimationFrame(draw);
    } catch (error) {
      console.error('[atomic-design-diagram layout]', error);
    }
  }

  async _animateFlubberTransfer(fromRect, toRect) {
    try {
      const flubber = await loadFlubber();
      if (!this.isConnected) return;
      const scene = this.shadowRoot.querySelector('.scene');
      const sceneRect = scene.getBoundingClientRect();
      const toLocalRect = rect => ({
        x: rect.left - sceneRect.left,
        y: rect.top - sceneRect.top,
        width: rect.width,
        height: rect.height,
        radius: Math.max(4, Math.min(rect.width, rect.height) * .12),
      });
      const from = toLocalRect(fromRect);
      const to = toLocalRect(toRect);
      const interpolate = flubber.interpolate(
        sampleRoundedRect(from, 28),
        sampleRoundedRect(to, 28),
        { maxSegmentLength: 3 },
      );
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.classList.add('transfer-overlay');
      svg.setAttribute('viewBox', `0 0 ${sceneRect.width} ${sceneRect.height}`);
      path.setAttribute('fill', '#A9D7FF');
      path.setAttribute('fill-opacity', '.34');
      path.style.filter = 'blur(5px)';
      svg.appendChild(path);
      scene.appendChild(svg);
      const started = performance.now();
      const duration = 360;
      const draw = now => {
        const linear = Math.min(1, (now - started) / duration);
        const eased = .5 - Math.cos(Math.PI * linear) / 2;
        path.setAttribute('d', interpolate(eased));
        path.setAttribute('fill-opacity', String(.34 * (1 - linear * .72)));
        if (linear < 1 && svg.isConnected) requestAnimationFrame(draw);
        else svg.remove();
      };
      requestAnimationFrame(draw);
    } catch (error) {
      console.error('[atomic-design-diagram transfer]', error);
    }
  }

  async _startAnimation() {
    try {
      const flubber = await loadFlubber();
      const [circle, triangle, star] = await Promise.all([
        loadSvgShape(CIRCLE_SRC, { x: 60, y: 60 }),
        loadSvgShape(TRIANGLE_SRC, { x: 53.076, y: 69.5 }),
        loadSvgShape(STAR_SRC, { x: 42.5335, y: 49.1155 }),
      ]);
      const square = sampleRoundedRect({ x: 64, y: 64, width: 272, height: 272, radius: 24 });
      const shapes = [circle, triangle, star, square];
      const interpolators = shapes.map((shape, index) => flubber.interpolate(
        shape,
        shapes[(index + 1) % shapes.length],
        { maxSegmentLength: 3 },
      ));

      const main = this.shadowRoot.querySelector('.shape-main');
      const gooBody = this.shadowRoot.querySelector('.goo-body');
      const gooTail = this.shadowRoot.querySelector('.goo-tail');
      const scene = this.shadowRoot.querySelector('.scene');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const morphDuration = 300;
      const holdDuration = 1000;
      const segmentDuration = morphDuration + holdDuration;

      main.setAttribute('d', interpolators[0](0));
      gooBody.setAttribute('d', interpolators[0](0));
      gooTail.setAttribute('d', interpolators[0](0));
      scene.classList.remove('loading');
      if (reducedMotion) return;

      this._animationStart = performance.now();
      const draw = now => {
        if (!this.isConnected) return;
        const elapsed = (now - this._animationStart) % (segmentDuration * interpolators.length);
        // The first rAF timestamp can precede performance.now() by a fraction.
        // Clamp both ends so every frame uses a real interpolator.
        const index = Math.max(
          0,
          Math.min(
            interpolators.length - 1,
            Math.floor(elapsed / segmentDuration),
          ),
        );
        const segmentElapsed = elapsed % segmentDuration;
        const linearT = Math.min(1, segmentElapsed / morphDuration);
        const easedT = .5 - Math.cos(Math.PI * linearT) / 2;
        const tailLinearT = Math.min(1, Math.max(0, (segmentElapsed - morphDuration * .056) / morphDuration));
        const tailT = .5 - Math.cos(Math.PI * tailLinearT) / 2;
        const path = interpolators[index](easedT);
        main.setAttribute('d', path);
        gooBody.setAttribute('d', path);
        gooTail.setAttribute('d', interpolators[index](tailT));
        this._frame = requestAnimationFrame(draw);
      };
      this._frame = requestAnimationFrame(draw);
    } catch (error) {
      console.error('[atomic-design-diagram]', error);
    }
  }
}

if (!customElements.get('atomic-design-diagram')) {
  customElements.define('atomic-design-diagram', AtomicDesignDiagram);
}
