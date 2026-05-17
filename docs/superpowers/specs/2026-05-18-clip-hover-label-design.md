# Clip Group Hover Label — Design Spec

## Overview
When hovering a clip group, show a hand-drawn arrow animating down from the group, followed by a descriptive label fading in. On mobile, trigger via scroll visibility instead of hover.

## Label Source
- **Organize groups** (by category): Predefined labels in wall.js
  - `who_i_am` → "About Me"
  - `design_projects` → "Design Work"
  - `design_thought` → "Design Thinking"
  - `hobby` → "Life & Hobbies"
- **Manual drag-merge groups**: AI-generated at merge time via `streamChat`
  - Prompt: "Describe the theme of these items in 2-3 English words: [titles]"
  - Cached on `cg.label` — one request per group lifetime

## Visual Design
- **Arrow**: PIXI.Graphics bezier curve, stroke-dasharray animation over 0.5s
  - Starts at clipGroup bounds bottom-center, curves down ~40px
  - Stroke color = first photo's `sampleDominantColor()`, or `0x666666` if no photos
- **Text**: PIXI.Text, Schoolbell font, same color as arrow
  - Positioned below arrow endpoint, centered
- **Elements added to app.stage** (not inside group — avoids affecting getBounds/drag)
- **References stored on clipGroup**: `cg._hoverArrow`, `cg._hoverText`

## Interaction — PC
- Hover detection in existing `_setupClickHandler` mousemove loop
- On hover enter: draw arrow (stroke animation 0.5s) → fade in text (0.3s)
- On hover leave: fade out both together (0.3s), then remove from stage

## Interaction — Mobile
- Scroll listener checks clipGroup visibility each frame (debounced)
- Trigger when 50%+ of group bounds visible in viewport
- First entry: play arrow + text animation
- Scroll out: fade out
- Re-entry: replay animation

## Files Modified
- `atoms-renderer.js` — hover detection, arrow/text rendering, animation, mobile scroll
- `wall.js` — pass predefined labels on organize, trigger AI label on manual merge
- `ai-client.js` — add `chatSync()` helper (collect streamed tokens into single string)

## Cache Bust
Bump `?v=` in wall.js, index.html, atoms.html after changes.
