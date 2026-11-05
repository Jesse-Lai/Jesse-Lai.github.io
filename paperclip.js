// Both SVGs share the same 124 × 124 coordinate space. The front SVG keeps
// only the wire in front of the paper; the complete back SVG sits behind it.
const CLIP_SIZE = 124;
// Highest y of the front mask's two cut edges is 55.1156. Keep every paper
// corner below that line, with 2 SVG units of overlap for antialiasing.
const PAPER_START = 57.12;

export async function createPaperclip(size) {
  const [top, bottom] = await Promise.all(['paperclip-top.svg', 'paperclip-bottom.svg'].map(file =>
    PIXI.Assets.load({ src: new URL(file, import.meta.url).href, data: { resolution: 4 } })
  ));
  const clipSprite = new PIXI.Sprite(top);
  const clipBottom = new PIXI.Sprite(bottom);
  for (const sprite of [clipBottom, clipSprite]) {
    sprite.anchor.set(0.5);
    sprite.width = size;
    sprite.height = size;
    sprite.eventMode = 'none';
  }
  return { clipSprite, clipBottom };
}

// Bounds of the actual paper, in its parent's coordinates. Include rotation,
// scale and pivot, but exclude shadows, captions and hover decorations.
export function getPaperBounds(item) {
  const { group, anchorX, anchorY, itemW, itemH } = item;
  const corners = [[0, 0], [itemW, 0], [itemW, itemH], [0, itemH]].map(([x, y]) =>
    group.parent.toLocal({ x: x - anchorX, y: y - anchorY }, group)
  );
  const x = Math.min(...corners.map(p => p.x));
  const y = Math.min(...corners.map(p => p.y));
  return {
    x, y,
    w: Math.max(...corners.map(p => p.x)) - x,
    h: Math.max(...corners.map(p => p.y)) - y,
  };
}

export function layoutPaperclip(clipInfo) {
  const { clipSprite, clipBottom, photos } = clipInfo;
  const bounds = photos.map(getPaperBounds);
  const left = Math.max(...bounds.map(b => b.x));
  const right = Math.min(...bounds.map(b => b.x + b.w));
  const top = Math.min(...bounds.map(b => b.y));
  const size = clipSprite.width;
  const x = left + Math.max(size * 0.55, (right - left) * 0.15);
  const baseY = top + size * (0.5 - PAPER_START / CLIP_SIZE);
  clipSprite.position.set(x, baseY + (clipInfo._lift || 0));
  clipSprite._baseY = baseY;
  clipBottom.position.copyFrom(clipSprite.position);
}

export function stackPaperclip(clipInfo, parent) {
  // Keep the entire stack contiguous, including when a new item was dragged
  // above the front wire or a focused collection returns to the wall.
  parent.addChild(clipInfo.clipBottom);
  for (const photo of clipInfo.photos) parent.addChild(photo.group);
  parent.addChild(clipInfo.clipSprite);
}
