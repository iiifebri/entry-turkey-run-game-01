// world.js — stage layouts, the run itself, score and distance.
// Three stages (Farmyard -> Barn -> Kitchen), each a single screen with its
// own obstacles, hiding spots, corn and exit. stepWorld() is the one place
// turkey, farmer and hazards advance together; it emits events the main loop
// turns into sounds and screen changes.

import { createRandom } from './random.js';
import { FIELD, STAGES, TUNING, FT_PER_PX } from './config.js';
import { createTurkey, stepTurkey } from './turkey.js';
import { createFarmer, stepFarmer, patrolStep } from './farmer.js';
import { createHazards, stepHazards } from './hazards.js';

const STAGE_FT = Math.round((1214 - 80) * FT_PER_PX);

export function createWorld(seed) {
  const rng = createRandom(seed);
  const w = {
    seed, rng,
    stageIndex: 0, stage: STAGES[0],
    turkey: null, farmer: null, hazards: null,
    obstacles: [], hides: [], corn: [], pie: null,
    exit: { x: 1214, y: 330, w: 42, h: 120 },
    particles: [], floaters: [],
    score: 0, cornCount: 0,
    parts: { corn: 0, bonus: 0, stage: 0, escape: 0 },
    time: 0, stageClearT: 0, finalExit: false,
    events: [], shake: 0, flash: 0,
    hint: '', hintT: 0,
    escaped: false, caught: false, escapedCount: 0,
    hideSeenSpot: null, runDist: 0,
  };
  buildStage(w, 0);
  return w;
}

function scatterCorn(w, count, rng) {
  const corn = [];
  for (let i = 0; i < count; i++) {
    corn.push({
      x: 190 + (i % 7) * 150 + rng.range(-24, 24),
      y: 170 + Math.floor(i / 7) * 300 + rng.range(-46, 46),
      taken: false, golden: false,
    });
  }
  return corn;
}

export function buildStage(w, i) {
  const rng = w.rng;
  const hearts = w.turkey ? w.turkey.hearts : 3;
  w.stageIndex = i;
  w.stage = STAGES[i];
  w.stageClearT = 0;
  w.finalExit = false;
  w.hideSeenSpot = null;
  w.turkey = createTurkey(80, 380);
  w.turkey.hearts = hearts;
  w.floaters = [];

  if (i === 0) {
    // Farmyard: fences, haystacks, bushes, long sightlines.
    w.obstacles = [
      { x: 200, y: 100, w: 300, h: 18, kind: 'fence', blocksSight: false },
      { x: 700, y: 100, w: 300, h: 18, kind: 'fence', blocksSight: false },
      { x: 200, y: 676, w: 300, h: 18, kind: 'fence', blocksSight: false },
      { x: 700, y: 676, w: 300, h: 18, kind: 'fence', blocksSight: false },
      { x: 560, y: 300, w: 18, h: 140, kind: 'fence', blocksSight: false },
    ];
    w.hides = [
      { x: 300, y: 220, w: 84, h: 64, kind: 'hay' },
      { x: 640, y: 520, w: 84, h: 64, kind: 'hay' },
      { x: 980, y: 240, w: 84, h: 64, kind: 'hay' },
      { x: 420, y: 560, w: 84, h: 64, kind: 'bush' },
      { x: 1080, y: 520, w: 84, h: 64, kind: 'bush' },
    ];
    w.corn = scatterCorn(w, 14, rng);
    w.corn.push({ x: 950, y: 380, taken: false, golden: true });
    w.pie = null;
    w.farmer = createFarmer(STAGES[0],
      [{ x: 300, y: 200 }, { x: 950, y: 200 }, { x: 950, y: 520 }, { x: 300, y: 520 }],
      700, 300);
  } else if (i === 1) {
    // Barn: stalls and beams, fewer hiding spots, darker light.
    w.obstacles = [
      { x: 240, y: 130, w: 120, h: 90, kind: 'stall', blocksSight: true },
      { x: 240, y: 500, w: 120, h: 90, kind: 'stall', blocksSight: true },
      { x: 760, y: 130, w: 120, h: 90, kind: 'stall', blocksSight: true },
      { x: 760, y: 500, w: 120, h: 90, kind: 'stall', blocksSight: true },
      { x: 560, y: 330, w: 20, h: 180, kind: 'beam', blocksSight: false },
    ];
    w.hides = [
      { x: 450, y: 220, w: 84, h: 64, kind: 'barrel' },
      { x: 900, y: 540, w: 84, h: 64, kind: 'barrel' },
      { x: 150, y: 360, w: 84, h: 64, kind: 'hay' },
    ];
    w.corn = scatterCorn(w, 14, rng);
    w.corn.push({ x: 700, y: 360, taken: false, golden: true });
    w.pie = null;
    w.farmer = createFarmer(STAGES[1],
      [{ x: 300, y: 240 }, { x: 950, y: 240 }, { x: 950, y: 480 }, { x: 300, y: 480 }],
      640, 360);
  } else {
    // Kitchen: counters, the oven, the carving board, the pantry.
    w.obstacles = [
      { x: 180, y: 130, w: 260, h: 70, kind: 'counter', blocksSight: true },
      { x: 180, y: 540, w: 260, h: 70, kind: 'counter', blocksSight: true },
      { x: 560, y: 130, w: 180, h: 70, kind: 'board', blocksSight: true },
      { x: 560, y: 540, w: 220, h: 80, kind: 'table', blocksSight: true },
      { x: 900, y: 100, w: 180, h: 116, kind: 'oven', blocksSight: true },
    ];
    w.hides = [
      { x: 120, y: 300, w: 70, h: 110, kind: 'pantry' },
      { x: 1080, y: 560, w: 80, h: 60, kind: 'sack' },
    ];
    w.corn = scatterCorn(w, 12, rng);
    w.corn.push({ x: 700, y: 400, taken: false, golden: true });
    w.pie = { x: 150, y: 460, taken: false };
    w.farmer = createFarmer(STAGES[2],
      [{ x: 320, y: 260 }, { x: 980, y: 260 }, { x: 980, y: 480 }, { x: 320, y: 480 }],
      640, 300);
  }
  w.farmer.vision = TUNING.visionRange + w.escapedCount * 15;
  w.hazards = createHazards(STAGES[i], rng);
  w.exit = { x: 1214, y: 330, w: 42, h: 120 };
}

export function setStage(w, i) {
  buildStage(w, i);
}

function updateParticles(w, dt) {
  for (const p of w.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
    p.rot += p.vr * dt;
  }
  w.particles = w.particles.filter((p) => p.t < p.life);
  for (const f of w.floaters) {
    f.t += dt;
    f.y -= 30 * dt;
  }
  w.floaters = w.floaters.filter((f) => f.t < f.life);
}

function distanceToGate(w) {
  return Math.max(0, Math.round((w.exit.x - w.turkey.x) * FT_PER_PX));
}

export function progressToGate(w) {
  return Math.max(0, Math.min(1, (w.turkey.x - 80) / (w.exit.x - 80)));
}

// Title-screen idle: the farmyard lives while the menu is up.
export function idleWorld(w, dt) {
  w.time += dt;
  patrolStep(w.farmer, dt, w);
  updateParticles(w, dt);
}

export function stepWorld(w, dt, input, acts) {
  w.time += dt;
  if (w.shake > 0) w.shake -= dt;
  if (w.flash > 0) w.flash -= dt;

  // Stage-clear card: freeze play, then advance (or escape).
  if (w.stageClearT > 0) {
    w.stageClearT -= dt;
    updateParticles(w, dt);
    if (w.stageClearT <= 0) {
      if (w.finalExit) {
        w.escaped = true;
        w.parts.escape = TUNING.escapeScore;
        w.score += TUNING.escapeScore;
        w.events.push({ type: 'escaped' });
      } else {
        w.escapedCount += 1;
        buildStage(w, w.stageIndex + 1);
        w.events.push({ type: 'stage-start' });
      }
    }
    return;
  }

  stepTurkey(w.turkey, dt, input, acts, w);

  // Did Bram see Gus slip into a hiding spot? That decides search order.
  if (w.turkey.hidden && w.hideSeenSpot === null && w.turkey.hideSpot) {
    const f = w.farmer;
    const dx = w.turkey.x - f.x;
    const dy = w.turkey.y - f.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let diff = ang - f.facing;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    w.hideSeenSpot = (d < f.vision && Math.abs(diff) < TUNING.visionHalfAngle)
      ? w.turkey.hideSpot
      : 'unseen';
  }

  stepFarmer(w.farmer, dt, w);
  stepHazards(w.hazards, dt, w);

  // Corn pickup.
  for (const c of w.corn) {
    if (c.taken) continue;
    if (Math.hypot(w.turkey.x - c.x, w.turkey.y - c.y) < 30) {
      c.taken = true;
      w.cornCount += 1;
      const pts = c.golden ? TUNING.goldenScore : TUNING.cornScore;
      w.score += pts;
      w.parts.corn += pts;
      w.floaters.push({ x: c.x, y: c.y - 20, text: '+' + pts, color: '#F2C94C', t: 0, life: 0.9 });
      w.events.push({ type: c.golden ? 'golden' : 'corn' });
    }
  }

  // Pumpkin pie slice: +1 heart, once per run.
  if (w.pie && !w.pie.taken && Math.hypot(w.turkey.x - w.pie.x, w.turkey.y - w.pie.y) < 32) {
    w.pie.taken = true;
    w.turkey.hearts = Math.min(3, w.turkey.hearts + 1);
    w.floaters.push({ x: w.pie.x, y: w.pie.y - 24, text: '+1 HEART', color: '#E5534B', t: 0, life: 1.1 });
    w.events.push({ type: 'pie' });
  }

  // Reached the exit?
  const t = w.turkey;
  if (t.x + t.radius > w.exit.x && t.y > w.exit.y && t.y < w.exit.y + w.exit.h) {
    if (w.stageIndex >= 2) {
      w.finalExit = true;
      w.stageClearT = 1.2;
      w.events.push({ type: 'stageclear' });
    } else {
      const bonus = 100 * (w.stageIndex + 1);
      w.score += bonus;
      w.parts.stage += bonus;
      w.stageClearT = 3;
      w.events.push({ type: 'stageclear' });
    }
    return;
  }

  // Contextual hint, only when it matters.
  w.hintT -= dt;
  const f = w.farmer;
  if (f.state === 'CHASE') {
    w.hint = 'RUN! Sprint with SHIFT!';
    w.hintT = 0.5;
  } else if ((f.state === 'SUSPICIOUS' || f.state === 'SEARCH') && spotNear(w, t.x, t.y)) {
    w.hint = 'HIDE! Press C in the hiding spot';
    w.hintT = 0.5;
  } else if (w.hazards.knives.some((k) => Math.abs(k.y - t.y) < 40 && Math.abs(k.x - t.x) < 120)) {
    w.hint = 'HOP! Press SPACE';
    w.hintT = 0.5;
  } else if (w.hintT <= 0) {
    w.hint = '';
  }

  w.runDist = w.stageIndex * STAGE_FT + Math.max(0, Math.round((t.x - 80) * FT_PER_PX));
  updateParticles(w, dt);

  if (t.hearts <= 0 && !w.caught) {
    w.caught = true;
    w.events.push({ type: 'caught' });
  }
}

function spotNear(w, x, y) {
  for (const h of w.hides) {
    if (Math.hypot(h.x + h.w / 2 - x, h.y + h.h / 2 - y) < 120) return true;
  }
  return false;
}

export { distanceToGate };
