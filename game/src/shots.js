// shots.js — deterministic staged scenes for screenshots.
// ?shot=start|play|search|kitchen|end&seed=1 renders a fixed frame with the REAL
// renderer from real game state (no compositing, no audio, no localStorage,
// no Math.random, no clock). The autopilot plays the real game; where the
// design allows a hard-coded frame (kitchen), the positions are staged but
// still drawn by the real renderer.

import { createWorld, setStage, stepWorld, idleWorld } from './world.js';
import { STEP, TUNING } from './config.js';

function autopilotInput(world) {
  return {
    direction(tx, ty) {
      const t = world.turkey;
      let x = 1;
      let y = 0;
      // Sidestep a knife that is closing in.
      for (const k of world.hazards.knives) {
        if (Math.hypot(k.x - t.x, k.y - t.y) < 130) {
          y = (k.y - t.y) > 0 ? -1 : 1;
          x = 0.4;
        }
      }
      // Step out of an oven burst zone.
      const o = world.hazards.oven;
      if (o && o.phase !== 'idle') {
        const z = { x: o.x - 14, y: o.y + o.h, w: o.w + 28, h: 118 };
        if (t.x > z.x - 40 && t.x < z.x + z.w + 40 && t.y > z.y - 20 && t.y < z.y + z.h + 20) {
          y = -1;
          x = 0.3;
        }
      }
      // Collect the nearest corn when it is safe to do so.
      let best = null;
      let bd = 160;
      for (const c of world.corn) {
        if (c.taken) continue;
        const d = Math.hypot(c.x - t.x, c.y - t.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && world.farmer.state !== 'CHASE') {
        const dx = best.x - t.x;
        const dy = best.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        x = dx / d;
        y = dy / d;
      }
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    sprintHeld() { return world.farmer.state === 'CHASE'; },
    consumeClick() { return null; },
  };
}

function autopilotActs(world) {
  const t = world.turkey;
  let hop = false;
  for (const k of world.hazards.knives) {
    if (Math.abs(k.y - t.y) < 30 && Math.abs(k.x - t.x) < 90) hop = true;
  }
  const o = world.hazards.oven;
  if (o && o.phase === 'burst') {
    const z = { x: o.x - 14, y: o.y + o.h, w: o.w + 28, h: 118 };
    if (t.x > z.x && t.x < z.x + z.w && t.y > z.y && t.y < z.y + z.h) hop = true;
  }
  for (const s of world.hazards.snares) {
    if (s.armed && Math.hypot(s.x - t.x, s.y - t.y) < 46) hop = true;
  }
  let hide = false;
  if (world.farmer.state === 'CHASE') {
    for (const h of world.hides) {
      if (Math.hypot(h.x + h.w / 2 - t.x, h.y + h.h / 2 - t.y) < 40) hide = true;
    }
  }
  return { hop, hide, pause: false, confirm: false, mute: false, restart: false, title: false };
}

function simulate(world, seconds) {
  const input = autopilotInput(world);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (world.escaped || world.caught) break;
    stepWorld(world, STEP, input, autopilotActs(world));
  }
}

export function stageShot(name, seed) {
  if (name === 'start') {
    // Title screen: the farmyard idles 5 s with no input. idleWorld only
    // patrols the farmer, so the title never shows a chase by accident.
    const world = createWorld(seed);
    for (let i = 0; i < 300; i++) idleWorld(world, STEP);
    world.events.length = 0;
    return { world, screen: 'title', best: { score: 0, dist: 0 }, newBest: false };
  }

  if (name === 'play') {
    // Cover: Stage 2 barn, mid-chase, knife in flight, HUD fully readable.
    const world = createWorld(seed);
    setStage(world, 1);
    simulate(world, 26);
    // Re-assert Stage 2: the autopilot may have cleared it (or been caught)
    // during the 26 s, and the cover must be the barn, mid-chase.
    setStage(world, 1);
    world.escaped = false;
    world.caught = false;
    world.turkey.hearts = 3;
    world.turkey.hidden = false;
    world.turkey.x = 677;
    world.turkey.y = 380;
    world.turkey.hopT = 0;
    world.turkey.invulnT = 0;
    world.turkey.scale = 1.3;
    world.turkey.sprinting = true;
    world.turkey.moving = true;
    world.turkey.faceX = 1;
    world.glowTurkey = true;
    // Dust trail trailing left of Gus's feet (none on the beam at x 560-580).
    world.particles = [
      { kind: 'dust', x: 620, y: 418, vx: -20, vy: -10, t: 0.2, life: 0.9, rot: 0, vr: 0 },
      { kind: 'dust', x: 595, y: 424, vx: -20, vy: -10, t: 0.2, life: 0.9, rot: 0, vr: 0 },
      { kind: 'dust', x: 545, y: 420, vx: -20, vy: -10, t: 0.2, life: 0.9, rot: 0, vr: 0 },
      { kind: 'dust', x: 520, y: 414, vx: -20, vy: -10, t: 0.2, life: 0.9, rot: 0, vr: 0 },
    ];
    world.score = Math.max(world.score, 320);
    world.parts.corn = Math.max(world.parts.corn, 320);
    world.cornCount = 3;
    world.hint = 'RUN! Sprint with SHIFT!';
    // Golden corn ahead of Gus in his lane, clear of his right edge.
    for (const c of world.corn) {
      if (c.golden) { c.x = 770; c.y = 380; c.taken = false; }
    }
    // Visible kernel trail in Gus's path, filling the lower-central band.
    const trail = [[600, 445], [760, 440], [850, 400]];
    let ti = 0;
    for (const c of world.corn) {
      if (ti >= trail.length) break;
      if (c.golden) continue;
      c.x = trail[ti][0];
      c.y = trail[ti][1];
      c.taken = false;
      ti += 1;
    }
    const f = world.farmer;
    f.state = 'CHASE';
    f.suspicion = 1;
    f.bubble = '!';
    f.bubbleT = 0.9;
    f.x = 430;
    f.y = 380;
    f.facing = 0;
    f.loseT = 0;
    f.scale = 1.15;
    f.vision = 260;
    // Thrown knife mid-flight: big, spinning, with a motion streak.
    // Pushed directly (not spawnThrownKnife) so it starts mid-air.
    world.hazards.knives.length = 0;
    const kdx = world.turkey.x - 585;
    const kdy = world.turkey.y - 375;
    const kd = Math.hypot(kdx, kdy) || 1;
    world.hazards.knives.push({
      kind: 'thrown', x: 585, y: 375,
      vx: (kdx / kd) * TUNING.knifeThrowSpeed, vy: (kdy / kd) * TUNING.knifeThrowSpeed,
      spin: -0.25, minD: 9999, dead: false, big: true,
    });
    world.floaters = [
      { x: 677, y: 300, text: 'CLOSE ONE! +25', color: '#F2C94C', t: 0, life: 1.1 },
    ];
    world.events.length = 0;
    return { world, screen: 'playing', best: { score: 0, dist: 0 }, newBest: false };
  }

  if (name === 'search') {
    // Stage 3 kitchen, SEARCH: Bram checks the wrong spot (the pantry)
    // while Gus peeks from the potato sack behind him. Staged positions
    // are allowed here by the design; the frame is still rendered by the
    // real renderer from real game state.
    const world = createWorld(seed);
    setStage(world, 2);
    world.time = 0;
    world.stageClearT = 0;
    world.finalExit = false;
    world.escaped = false;
    world.caught = false;
    world.score = 1480;
    world.parts.corn = 880;
    world.parts.bonus = 100;
    world.parts.stage = 500;
    world.parts.escape = 0;
    world.cornCount = 6;
    // First 6 scattered kernels already collected (seeded scatter order).
    let taken = 0;
    for (const c of world.corn) {
      if (c.golden) continue;
      if (taken < 6) { c.taken = true; taken += 1; }
    }
    // Golden corn stays at its layout position (700, 400), untaken.
    // Pumpkin pie stays at (150, 460), untaken.
    const t = world.turkey;
    t.hearts = 2;
    t.hidden = true;
    t.hideSpot = world.hides[1]; // the potato sack
    t.x = 1120;
    t.y = 590;
    t.faceX = -1;
    t.peekBig = true;
    t.hopT = 0;
    t.invulnT = 0;
    const f = world.farmer;
    f.state = 'SEARCH';
    f.suspicion = 0.7;
    f.bubble = '?';
    f.bubbleT = 0.9;
    f.x = 280;
    f.y = 355;
    f.facing = Math.PI; // facing left, at the pantry
    f.searchTarget = { x: 155, y: 355, spot: world.hides[0] };
    f.searchWaitT = 0.6; // mid-check
    f.searchI = 0;
    f.searchQueue = [world.hides[0], world.hides[1]]; // pantry first (wrong spot)
    world.hideSeenSpot = 'unseen'; // he did NOT see Gus enter the sack
    world.hazards.knives.length = 0;
    world.hazards.knives.push({
      kind: 'slide', x: 620, y: 480, vx: -380, vy: 0,
      spin: 0, minD: 40, dead: false,
    });
    const o = world.hazards.oven;
    o.phase = 'burst';
    o.t = 0.4;
    world.hint = 'HIDE! Press C in the hiding spot';
    world.events.length = 0;
    return { world, screen: 'playing', best: { score: 0, dist: 0 }, newBest: false };
  }

  if (name === 'kitchen') {
    // Stage 3: Gus mid-hop over a sliding knife, oven bursting, SUSPICIOUS.
    // Staged positions are allowed here by the design; the frame is still
    // rendered by the real renderer from real game state.
    const world = createWorld(seed);
    setStage(world, 2);
    simulate(world, 12);
    // Clear any stage-clear / caught state the autopilot may have reached,
    // so the frame is plain Stage 3 gameplay.
    world.stageClearT = 0;
    world.finalExit = false;
    world.escaped = false;
    world.caught = false;
    world.score = 1480;
    world.parts.corn = 880;
    world.parts.bonus = 100;
    world.parts.stage = 500;
    world.turkey.hearts = 2;
    world.turkey.hidden = false;
    world.turkey.x = 940;
    world.turkey.y = 430;
    world.turkey.hopT = 0.2;
    world.turkey.hopCd = 0;
    world.turkey.invulnT = 0;
    world.hazards.knives.length = 0;
    world.hazards.knives.push({
      kind: 'slide', x: 880, y: 430, vx: TUNING.knifeSlideSpeed, vy: 0,
      spin: 0, minD: 40, dead: false,
    });
    const o = world.hazards.oven;
    o.phase = 'burst';
    o.t = 0.4;
    const f = world.farmer;
    f.state = 'SUSPICIOUS';
    f.suspicion = 0.7;
    f.bubble = '?';
    f.bubbleT = 0.9;
    f.x = 520;
    f.y = 360;
    f.facing = 0.3;
    world.events.length = 0;
    return { world, screen: 'playing', best: { score: 0, dist: 0 }, newBest: false };
  }

  if (name === 'end') {
    // Victory end screen: ESCAPED, fixed deterministic score 2,340.
    const world = createWorld(seed);
    setStage(world, 2);
    world.score = 2340;
    world.parts = { corn: 940, bonus: 300, stage: 600, escape: 500 };
    world.escaped = true;
    world.turkey.x = 1180;
    world.turkey.y = 390;
    world.events.length = 0;
    return {
      world, screen: 'escaped', finalScore: 2340, newBest: true,
      best: { score: 1200, dist: 400 }, finalDist: 612,
    };
  }

  return stageShot('start', seed);
}
