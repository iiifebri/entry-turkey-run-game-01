// hazards.js — carving knives, the oven, snares and falling pots.
// Every heart-costing hazard telegraphs first: a thrown knife glints and
// whistles 0.5 s before it flies, the oven floor warning glows 0.7 s before
// the burst, a sliding knife shows a glint marker first. A hop dodges a
// knife slide, a snare and an oven burst.

import { FIELD, TUNING } from './config.js';
import { hurtTurkey } from './turkey.js';

export function createHazards(stage, rng) {
  const snares = [];
  for (let i = 0; i < stage.snareCount; i++) {
    snares.push({ x: rng.range(160, 1120), y: rng.range(150, 640), r: 18, armed: true });
  }
  const pots = [];
  for (let i = 0; i < stage.potCount; i++) {
    pots.push({ x: 300 + i * 320, y: 150, r: 16, fallen: false });
  }
  return {
    knives: [],
    warnSlide: null,
    slideT: 3.2,
    oven: stage.oven
      ? { x: 900, y: FIELD.TOP + 4, w: 180, h: 116, phase: 'idle', t: TUNING.ovenIdle }
      : null,
    snares,
    pots,
  };
}

export function ovenZone(o) {
  return { x: o.x - 14, y: o.y + o.h, w: o.w + 28, h: 118 };
}

export function spawnThrownKnife(h, fx, fy, tx, ty) {
  const dx = tx - fx;
  const dy = ty - fy;
  const d = Math.hypot(dx, dy) || 1;
  h.knives.push({
    kind: 'thrown', x: fx, y: fy,
    vx: (dx / d) * TUNING.knifeThrowSpeed, vy: (dy / d) * TUNING.knifeThrowSpeed,
    spin: 0, minD: 9999, dead: false,
  });
}

function closeOneCheck(world, k) {
  if (k.minD < 60 && k.minD > 0) {
    world.score += TUNING.closeOneScore;
    world.parts.bonus += TUNING.closeOneScore;
    world.events.push({ type: 'close' });
    world.floaters.push({ x: world.turkey.x, y: world.turkey.y - 44, text: 'CLOSE ONE! +25', color: '#F2C94C', t: 0, life: 1.1 });
  }
}

export function stepHazards(h, dt, world) {
  const t = world.turkey;

  // Oven: idle -> warning glow -> flame burst -> idle.
  if (h.oven) {
    const o = h.oven;
    o.t -= dt;
    if (o.phase === 'idle' && o.t <= 0) {
      o.phase = 'warn';
      o.t = TUNING.ovenWarn;
    } else if (o.phase === 'warn' && o.t <= 0) {
      o.phase = 'burst';
      o.t = TUNING.ovenBurst;
      world.events.push({ type: 'sizzle' });
    } else if (o.phase === 'burst') {
      if (o.t <= 0) {
        o.phase = 'idle';
        o.t = TUNING.ovenIdle;
      } else if (t.hopT <= 0 && t.invulnT <= 0) {
        const z = ovenZone(o);
        if (t.x > z.x && t.x < z.x + z.w && t.y > z.y && t.y < z.y + z.h) {
          hurtTurkey(t, 1, world, o.x + o.w / 2, o.y + o.h);
        }
      }
    }
  }

  // Knife slides (kitchen): a glint marker warns, then a blade skitters
  // across the floor on a timer.
  if (world.stage.slides) {
    if (h.warnSlide) {
      h.warnSlide.t -= dt;
      if (h.warnSlide.t <= 0) {
        const dir = h.warnSlide.fromLeft ? 1 : -1;
        h.knives.push({
          kind: 'slide', x: dir > 0 ? -30 : FIELD.W + 30, y: h.warnSlide.y,
          vx: dir * TUNING.knifeSlideSpeed, vy: 0,
          spin: 0, minD: 9999, dead: false,
        });
        h.warnSlide = null;
        h.slideT = 3.4;
      }
    } else {
      h.slideT -= dt;
      if (h.slideT <= 0) {
        h.warnSlide = { y: world.rng.range(220, 620), t: 0.5, fromLeft: world.rng.chance(0.5) };
        world.events.push({ type: 'whoosh' });
      }
    }
  }

  // Knives in flight / sliding.
  for (const k of h.knives) {
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.spin += dt * 9;
    const d = Math.hypot(t.x - k.x, t.y - k.y);
    if (d < k.minD) k.minD = d;
    const offField = k.x < -60 || k.x > FIELD.W + 60 || k.y < FIELD.TOP - 40 || k.y > FIELD.BOTTOM + 40;
    const hitWall = world.obstacles.some((o) => k.x > o.x && k.x < o.x + o.w && k.y > o.y && k.y < o.y + o.h);
    if (d < 26 && t.hopT <= 0) {
      if (hurtTurkey(t, 1, world, k.x, k.y)) k.dead = true;
    } else if (offField || hitWall) {
      if (!k.dead) {
        closeOneCheck(world, k);
        world.events.push({ type: 'clatter' });
      }
      k.dead = true;
    }
  }
  h.knives = h.knives.filter((k) => !k.dead);

  // Snares: step in while walking and Gus is stuck for 1.2 s.
  for (const s of h.snares) {
    if (!s.armed || t.hopT > 0 || t.snaredT > 0) continue;
    if (Math.hypot(t.x - s.x, t.y - s.y) < s.r + 10) {
      s.armed = false;
      t.snaredT = TUNING.snareTime;
      world.events.push({ type: 'snare' });
      const f = world.farmer;
      f.lastSeen = { x: t.x, y: t.y };
      f.suspicion = Math.max(f.suspicion, 0.6);
      if (f.state === 'PATROL') {
        f.state = 'SUSPICIOUS';
        f.bubble = '?';
        f.bubbleT = 0.8;
      }
    }
  }

  // Falling pots: sprint past a hanging pot and it crashes, loudly.
  for (const p of h.pots) {
    if (p.fallen || !t.sprinting || !t.moving) continue;
    if (Math.hypot(t.x - p.x, t.y - p.y) < 60) {
      p.fallen = true;
      world.events.push({ type: 'pot' });
      const f = world.farmer;
      f.lastSeen = { x: t.x, y: t.y };
      f.suspicion = Math.max(f.suspicion, 0.7);
      if (f.state === 'PATROL') {
        f.state = 'SUSPICIOUS';
        f.bubble = '?';
        f.bubbleT = 0.8;
      }
    }
  }
}
