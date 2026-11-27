// turkey.js — Gus the turkey: run, hop, sprint, hide, hearts.
// Movement is top-down and free; collisions slide along obstacle rects.
// hurtTurkey() is the single place a heart is lost: knockback, a 1.5 s
// invulnerability window and a burst of feathers, so one mistake can never
// chain into two hearts.

import { FIELD, TUNING } from './config.js';

export function createTurkey(x, y) {
  return {
    x, y, dir: 1, faceX: 1, faceY: 0,
    hopT: 0, hopCd: 0, sprinting: false,
    hidden: false, hideSpot: null,
    hearts: 3, invulnT: 0, snaredT: 0,
    stepT: 0, bob: 0, dustT: 0, moving: false,
    kbx: 0, kby: 0, radius: 20,
  };
}

function circleHitsRect(cx, cy, r, o) {
  const qx = Math.max(o.x, Math.min(cx, o.x + o.w));
  const qy = Math.max(o.y, Math.min(cy, o.y + o.h));
  const dx = cx - qx;
  const dy = cy - qy;
  return dx * dx + dy * dy < r * r;
}

// Axis-separated slide: try the full move, then x-only, then y-only.
export function collideMove(e, dx, dy, obstacles, radius) {
  const tryX = e.x + dx;
  const tryY = e.y + dy;
  if (!obstacles.some((o) => circleHitsRect(tryX, tryY, radius, o))) {
    e.x = tryX; e.y = tryY;
    return;
  }
  if (!obstacles.some((o) => circleHitsRect(tryX, e.y, radius, o))) {
    e.x = tryX;
    return;
  }
  if (!obstacles.some((o) => circleHitsRect(e.x, tryY, radius, o))) {
    e.y = tryY;
  }
}

export function clampToFloor(e, radius) {
  e.x = Math.max(FIELD.LEFT + radius, Math.min(FIELD.RIGHT - radius, e.x));
  e.y = Math.max(FIELD.TOP + radius, Math.min(FIELD.BOTTOM - radius, e.y));
}

function spotAt(world, x, y) {
  for (const h of world.hides) {
    if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) return h;
  }
  return null;
}

export function stepTurkey(t, dt, input, acts, world) {
  if (t.hopCd > 0) t.hopCd -= dt;
  if (t.hopT > 0) t.hopT -= dt;
  if (t.invulnT > 0) t.invulnT -= dt;
  if (t.snaredT > 0) t.snaredT -= dt;
  if (t.kbx !== 0 || t.kby !== 0) {
    collideMove(t, t.kbx * dt, t.kby * dt, world.obstacles, t.radius);
    t.kbx *= 0.86;
    t.kby *= 0.86;
    if (Math.abs(t.kbx) < 8) t.kbx = 0;
    if (Math.abs(t.kby) < 8) t.kby = 0;
  }

  // Hiding: C (or S when not walking down) toggles hide inside a spot.
  if (acts.hide) {
    if (t.hidden) {
      t.hidden = false;
      t.hideSpot = null;
      world.hideSeenSpot = null;
    } else {
      const spot = spotAt(world, t.x, t.y);
      if (spot) {
        t.hidden = true;
        t.hideSpot = spot;
        world.hideSeenSpot = null;
        world.events.push({ type: 'hide' });
      }
    }
  }
  if (t.hidden) {
    t.moving = false;
    t.sprinting = false;
    t.bob += dt * 2;
    return;
  }

  if (acts.hop && t.hopCd <= 0 && t.snaredT <= 0) {
    t.hopT = TUNING.hopTime;
    t.hopCd = TUNING.hopCooldown;
    world.events.push({ type: 'hop' });
  }

  const dir = input.direction(t.x, t.y);
  t.moving = (dir.x !== 0 || dir.y !== 0) && t.snaredT <= 0;
  t.sprinting = t.moving && input.sprintHeld();
  if (t.moving) {
    const speed = t.sprinting ? TUNING.sprintSpeed : TUNING.walkSpeed;
    collideMove(t, dir.x * speed * dt, dir.y * speed * dt, world.obstacles, t.radius);
    clampToFloor(t, t.radius);
    if (dir.x !== 0) { t.faceX = dir.x > 0 ? 1 : -1; t.dir = t.faceX; }
    if (dir.y !== 0) t.faceY = dir.y > 0 ? 1 : -1;
    t.bob += dt * (t.sprinting ? 15 : 9);
    t.stepT -= dt;
    if (t.stepT <= 0) {
      t.stepT = t.sprinting ? 0.2 : 0.32;
      world.events.push({ type: 'step' });
    }
    if (t.sprinting) {
      t.dustT -= dt;
      if (t.dustT <= 0) {
        t.dustT = 0.09;
        world.particles.push({
          kind: 'dust', x: t.x - t.faceX * 22, y: t.y + 16,
          vx: -t.faceX * 30, vy: -14, t: 0, life: 0.5, rot: 0, vr: 0,
        });
      }
    }
  } else {
    t.bob += dt * 3;
  }
}

// Lose one heart (unless invulnerable). Returns true when a heart was lost.
export function hurtTurkey(t, amount, world, sx, sy) {
  if (t.invulnT > 0 || t.hearts <= 0) return false;
  t.hearts -= amount;
  t.invulnT = TUNING.invulnTime;
  t.hidden = false;
  t.hideSpot = null;
  world.hideSeenSpot = null;
  const dx = t.x - sx;
  const dy = t.y - sy;
  const d = Math.hypot(dx, dy) || 1;
  t.kbx = (dx / d) * 260;
  t.kby = (dy / d) * 260;
  world.shake = 0.35;
  world.flash = 0.5;
  world.events.push({ type: 'hit', hearts: t.hearts });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    world.particles.push({
      kind: 'feather', x: t.x, y: t.y - 10,
      vx: Math.cos(a) * 130, vy: Math.sin(a) * 130 - 50,
      t: 0, life: 0.8, rot: a, vr: 4,
    });
  }
  return true;
}
