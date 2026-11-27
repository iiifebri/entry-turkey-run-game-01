// farmer.js — Farmer Bram's AI: PATROL / SUSPICIOUS / CHASE / SEARCH / CORNERED.
// He has eyesight (a drawn vision cone, blocked by obstacles and hiding
// spots), hearing (sprinting Gus is loud) and a memory: when he loses Gus he
// searches Gus's last seen position and checks hiding spots one by one.
// Chase is 1.15x Gus's walk but slower than Gus's sprint, so a chase is
// always escapable by sprinting and always lost by walking.

import { TUNING } from './config.js';
import { collideMove, clampToFloor, hurtTurkey } from './turkey.js';
import { spawnThrownKnife } from './hazards.js';

export function createFarmer(stage, wps, x, y) {
  return {
    x, y, state: 'PATROL', suspicion: 0,
    wps, wp: 0, pauseT: 0, facing: 0, dir: 1,
    chaseT: 0, loseT: 0, lastSeen: { x, y },
    searchQueue: [], searchI: 0, searchWaitT: 0, searchTarget: null,
    lungeT: 0, lungePhase: '',
    throwCd: 1.2, throwsUsed: 0,
    bubble: '', bubbleT: 0, stepT: 0,
    speed: stage.patrolSpeed, vision: TUNING.visionRange, hearing: TUNING.sprintHearing,
  };
}

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  const a = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const b = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return a >= 0 && a <= 1 && b >= 0 && b <= 1;
}

function segmentHitsRect(x1, y1, x2, y2, o) {
  if (x1 > o.x && x1 < o.x + o.w && y1 > o.y && y1 < o.y + o.h) return true;
  if (x2 > o.x && x2 < o.x + o.w && y2 > o.y && y2 < o.y + o.h) return true;
  return segmentsCross(x1, y1, x2, y2, o.x, o.y, o.x + o.w, o.y)
    || segmentsCross(x1, y1, x2, y2, o.x + o.w, o.y, o.x + o.w, o.y + o.h)
    || segmentsCross(x1, y1, x2, y2, o.x + o.w, o.y + o.h, o.x, o.y + o.h)
    || segmentsCross(x1, y1, x2, y2, o.x, o.y + o.h, o.x, o.y);
}

export function hasLineOfSight(f, tx, ty, world) {
  for (const o of world.obstacles) {
    if (o.blocksSight && segmentHitsRect(f.x, f.y, tx, ty, o)) return false;
  }
  for (const h of world.hides) {
    if (segmentHitsRect(f.x, f.y, tx, ty, h)) return false;
  }
  return true;
}

export function farmerSeesTurkey(f, world) {
  const t = world.turkey;
  if (t.hidden) return false;
  const dx = t.x - f.x;
  const dy = t.y - f.y;
  const d = Math.hypot(dx, dy);
  if (d > f.vision) return false;
  const ang = Math.atan2(dy, dx);
  let diff = ang - f.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > TUNING.visionHalfAngle) return false;
  return hasLineOfSight(f, t.x, t.y, world);
}

function moveToward(f, tx, ty, speed, dt, world) {
  const dx = tx - f.x;
  const dy = ty - f.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  collideMove(f, (dx / d) * speed * dt, (dy / d) * speed * dt, world.obstacles, 22);
  clampToFloor(f, 22);
  f.facing = Math.atan2(dy, dx);
  f.dir = dx >= 0 ? 1 : -1;
  f.stepT -= dt;
  return d < 14;
}

function enterChase(f, world) {
  f.state = 'CHASE';
  f.suspicion = 1;
  f.bubble = '!';
  f.bubbleT = 0.9;
  f.throwsUsed = 0;
  f.throwCd = 1.2;
  f.chaseT = 0;
  f.loseT = 0;
  world.events.push({ type: 'chase' });
}

function startSearch(f, world) {
  f.state = 'SEARCH';
  f.bubble = '?';
  f.bubbleT = 0.8;
  f.searchI = 0;
  f.searchWaitT = 0;
  f.searchTarget = { x: f.lastSeen.x, y: f.lastSeen.y, spot: null };
  const spots = world.hides.slice();
  const queue = world.rng.shuffle(spots);
  // hideSeenSpot is the spot object when Bram saw Gus slip in, or the
  // string 'unseen' / null when he did not: only an object goes first.
  if (world.hideSeenSpot && typeof world.hideSeenSpot === 'object') {
    const seen = world.hideSeenSpot;
    const rest = queue.filter((s) => s !== seen);
    f.searchQueue = [seen].concat(rest);
  } else {
    f.searchQueue = queue;
  }
}

// Patrol-only step, used for the title screen's idle farmyard.
export function patrolStep(f, dt, world) {
  if (f.pauseT > 0) { f.pauseT -= dt; return; }
  const wp = f.wps[f.wp];
  if (moveToward(f, wp.x, wp.y, f.speed, dt, world)) {
    f.wp = (f.wp + 1) % f.wps.length;
    f.pauseT = 0.6;
  }
}

export function stepFarmer(f, dt, world) {
  const t = world.turkey;
  const stage = world.stage;
  if (f.bubbleT > 0) f.bubbleT -= dt;
  const sees = farmerSeesTurkey(f, world);
  const dist = Math.hypot(t.x - f.x, t.y - f.y);

  if (f.state === 'PATROL') {
    if (sees) f.suspicion += dt * TUNING.suspicionFill * stage.suspicionRate;
    if (t.sprinting && t.moving && dist < f.hearing) f.suspicion += dt * 0.5;
    if (!sees && !(t.sprinting && dist < f.hearing)) f.suspicion -= dt * TUNING.suspicionDecay;
    f.suspicion = Math.max(0, Math.min(1, f.suspicion));
    if (f.suspicion >= 1) {
      enterChase(f, world);
    } else if (f.suspicion > 0.3) {
      f.state = 'SUSPICIOUS';
      f.bubble = '?';
      f.bubbleT = 0.8;
      world.events.push({ type: 'suspicious' });
    } else {
      patrolStep(f, dt, world);
    }
    return;
  }

  if (f.state === 'SUSPICIOUS') {
    if (sees) {
      f.lastSeen = { x: t.x, y: t.y };
      f.facing = Math.atan2(t.y - f.y, t.x - f.x);
      f.suspicion += dt * TUNING.suspicionFill * stage.suspicionRate;
    } else {
      f.facing = Math.atan2(f.lastSeen.y - f.y, f.lastSeen.x - f.x);
      f.suspicion -= dt * TUNING.suspicionDecay;
    }
    f.suspicion = Math.max(0, Math.min(1, f.suspicion));
    if (f.suspicion >= 1) enterChase(f, world);
    else if (f.suspicion <= 0.05) { f.state = 'PATROL'; f.suspicion = 0; }
    return;
  }

  if (f.state === 'CHASE') {
    f.chaseT += dt;
    if (sees) {
      f.loseT = 0;
      f.lastSeen = { x: t.x, y: t.y };
    } else {
      f.loseT += dt;
    }
    if (f.loseT > TUNING.chaseLoseTime) { startSearch(f, world); return; }
    // Cornered: Gus trapped against a wall with Bram close -> knife lunge.
    const nearWall = t.x < 100 || t.x > 1180 || t.y < 130 || t.y > 660;
    if (dist < TUNING.lungeRange && nearWall) {
      f.state = 'CORNERED';
      f.lungePhase = 'windup';
      f.lungeT = TUNING.lungeWindup;
      f.bubble = '!';
      f.bubbleT = 0.7;
      return;
    }
    moveToward(f, t.x, t.y, TUNING.chaseSpeed + world.stageIndex * TUNING.chaseBonusPerStage, dt, world);
    f.throwCd -= dt;
    if (f.throwCd <= 0 && f.throwsUsed < stage.throwsPerChase) {
      f.throwsUsed += 1;
      f.throwCd = 2.4;
      spawnThrownKnife(world.hazards, f.x + f.dir * 24, f.y - 8, t.x, t.y);
      world.events.push({ type: 'whoosh' });
    }
    return;
  }

  if (f.state === 'SEARCH') {
    if (!f.searchTarget) {
      if (f.searchI >= f.searchQueue.length) {
        f.state = 'PATROL';
        f.suspicion = 0;
        return;
      }
      const spot = f.searchQueue[f.searchI];
      f.searchTarget = { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2, spot };
    }
    const tgt = f.searchTarget;
    if (f.searchWaitT > 0) {
      f.searchWaitT -= dt;
      if (f.searchWaitT <= 0) {
        if (tgt.spot && t.hidden && t.hideSpot === tgt.spot) {
          enterChase(f, world);
          return;
        }
        f.searchI += 1;
        f.searchTarget = null;
      }
      return;
    }
    if (moveToward(f, tgt.x, tgt.y, f.speed * 1.25, dt, world)) {
      f.searchWaitT = TUNING.searchSpotTime;
    }
    return;
  }

  if (f.state === 'CORNERED') {
    f.facing = Math.atan2(t.y - f.y, t.x - f.x);
    f.lungeT -= dt;
    if (f.lungeT > 0) return;
    if (f.lungePhase === 'windup') {
      const d2 = Math.hypot(t.x - f.x, t.y - f.y);
      if (d2 < TUNING.lungeHitRange && t.hopT <= 0) {
        hurtTurkey(t, 1, world, f.x, f.y);
      } else if (d2 < TUNING.lungeHitRange + 40) {
        world.score += TUNING.closeOneScore;
        world.parts.bonus += TUNING.closeOneScore;
        world.events.push({ type: 'close' });
        world.floaters.push({ x: t.x, y: t.y - 44, text: 'CLOSE ONE! +25', color: '#F2C94C', t: 0, life: 1.1 });
      }
      f.lungePhase = 'recover';
      f.lungeT = 0.4;
      return;
    }
    f.state = sees ? 'CHASE' : 'SEARCH';
    if (f.state === 'SEARCH') startSearch(f, world);
  }
}
