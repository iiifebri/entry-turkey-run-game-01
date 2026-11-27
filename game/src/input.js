// input.js — keyboard + mouse state for Gobble or Roast!
// Keys are held state; takeActions() returns edge-triggered actions once per
// frame and clears them. Mouse click-and-hold sets a move target Gus runs
// toward; a single click point is exposed for button hits.

import { FIELD } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const edge = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let clickPoint = null;
  let moveTarget = null;

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (FIELD.W / r.width),
      y: (clientY - r.top) * (FIELD.H / r.height),
    };
  }
  function onKeyDown(e) {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    if (!e.repeat) edge.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); mouse.down = false; }
  function onMouseDown(e) {
    const p = toLogical(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.down = true;
    clickPoint = p;
    moveTarget = p;
  }
  function onMouseUp() { mouse.down = false; }
  function onMouseMove(e) {
    const p = toLogical(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y;
    if (mouse.down) moveTarget = p;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);

  return {
    mouse,
    direction(tx, ty) {
      let x = 0;
      let y = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
      if (x === 0 && y === 0 && moveTarget) {
        const dx = moveTarget.x - tx;
        const dy = moveTarget.y - ty;
        const d = Math.hypot(dx, dy);
        if (d < 14) {
          moveTarget = null;
        } else {
          x = dx / d;
          y = dy / d;
        }
      }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    },
    sprintHeld() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() {
      const a = {
        hop: edge.has('Space'),
        pause: edge.has('KeyP') || edge.has('Escape'),
        hide: edge.has('KeyC') || (edge.has('KeyS') && !keys.has('ArrowDown')),
        confirm: edge.has('Space') || edge.has('Enter'),
        mute: edge.has('KeyM'),
        restart: edge.has('KeyR'),
        title: edge.has('KeyT'),
      };
      edge.clear();
      return a;
    },
    consumeClick() {
      const c = clickPoint;
      clickPoint = null;
      return c;
    },
    clearMoveTarget() { moveTarget = null; },
  };
}
