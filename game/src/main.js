// main.js — boot, fixed-step loop and screen state machine for Gobble or Roast!
// Screens: title -> playing -> paused -> escaped | caught. Shot mode
// (?shot=start|play|kitchen|end&seed=1) draws a deterministic staged frame
// twice with the real renderer and sets window.__shotReady.

import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, stepWorld, idleWorld } from './world.js';
import { stageShot } from './shots.js';
import { STEP } from './config.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;
const shotMode = shotName === 'start' || shotName === 'play' || shotName === 'kitchen' || shotName === 'end';

const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = shotMode ? null : createAudio();

let screen = 'title';
let world = createWorld(seed);
let best = { score: 0, dist: 0 };
let newBest = false;
let finalScore = 0;
let finalParts = { corn: 0, bonus: 0, stage: 0, escape: 0 };
let finalDist = 0;
let muted = false;
let lastTime = 0;
let acc = 0;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function startGame() {
  const s = Math.floor(Date.now() % 2147483647) || 1;
  world = createWorld(s);
  screen = 'playing';
  newBest = false;
  setStatus('Gus is running! Reach the gate on the right.');
  if (audio) {
    audio.ensure();
    audio.playGobble();
    audio.startAmbience(0);
  }
}

function toTitle() {
  world = createWorld(seed);
  screen = 'title';
  setStatus('Gobble or Roast! Press Space or click Start.');
  if (audio) audio.stopAmbience();
}

function finishRun(won) {
  finalScore = world.score;
  finalParts = { corn: world.parts.corn, bonus: world.parts.bonus, stage: world.parts.stage, escape: world.parts.escape };
  finalDist = world.runDist;
  newBest = false;
  if (world.score > best.score) {
    best.score = world.score;
    newBest = true;
  }
  if (world.runDist > best.dist) best.dist = world.runDist;
  screen = won ? 'escaped' : 'caught';
  setStatus(won ? 'Escaped! Gus made it to the woods.' : 'Caught! Thanksgiving dinner is served... almost.');
  if (audio) audio.stopAmbience();
}

function drainEvents() {
  for (const e of world.events) {
    if (!audio) continue;
    if (e.type === 'step') audio.playStep();
    else if (e.type === 'hop') audio.playHop();
    else if (e.type === 'corn') audio.playCorn();
    else if (e.type === 'golden' || e.type === 'pie' || e.type === 'close') audio.playGoldenCorn();
    else if (e.type === 'hit') audio.playHit();
    else if (e.type === 'caught') audio.playCaught();
    else if (e.type === 'escaped') audio.playFanfare();
    else if (e.type === 'stageclear') audio.playStageClear();
    else if (e.type === 'chase') { audio.playAlert(); audio.playGobble(); }
    else if (e.type === 'suspicious') audio.playSuspicious();
    else if (e.type === 'whoosh') audio.playWhoosh();
    else if (e.type === 'clatter' || e.type === 'snare' || e.type === 'pot') audio.playClatter();
    else if (e.type === 'sizzle') audio.playSizzle();
  }
  world.events.length = 0;
}

function handleClick(click) {
  input.clearMoveTarget();
  for (const b of renderer.buttons) {
    if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
      if (audio) audio.playClick();
      if (b.id === 'start' || b.id === 'playagain' || b.id === 'tryagain' || b.id === 'restart') startGame();
      else if (b.id === 'resume') screen = 'playing';
      else if (b.id === 'title') toTitle();
      else if (b.id === 'pause') screen = screen === 'playing' ? 'paused' : screen;
      else if (b.id === 'mute' && audio) muted = audio.toggleMute();
      return;
    }
  }
}

function update(dt) {
  const acts = input.takeActions();
  if (acts.mute && audio) muted = audio.toggleMute();
  const click = input.consumeClick();
  if (click) handleClick(click);

  if (screen === 'title') {
    idleWorld(world, dt);
    if (acts.confirm) startGame();
    return;
  }
  if (screen === 'playing') {
    if (acts.pause) { screen = 'paused'; return; }
    stepWorld(world, dt, input, acts);
    drainEvents();
    if (audio) audio.update(dt, world.stageIndex);
    if (world.escaped) finishRun(true);
    else if (world.caught) finishRun(false);
    return;
  }
  if (screen === 'paused') {
    if (acts.pause || acts.confirm) screen = 'playing';
    if (acts.restart) startGame();
    if (acts.title) toTitle();
    return;
  }
  // escaped / caught
  if (acts.restart || acts.confirm) startGame();
  else if (acts.title) toTitle();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(250, now - (lastTime || now));
  lastTime = now;
  acc += dtMs / 1000;
  let n = 0;
  while (acc >= STEP && n < 15) {
    update(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 15) acc = 0;
  renderer.draw({
    screen, world, best, muted, newBest, finalScore, finalParts, finalDist,
  });
}

if (shotMode) {
  // Deterministic screenshot mode: no audio, no stored best, no clock.
  const shot = stageShot(shotName, seed);
  screen = shot.screen;
  world = shot.world;
  best = shot.best || best;
  newBest = !!shot.newBest;
  finalScore = shot.finalScore || 0;
  finalParts = shot.world.parts;
  finalDist = shot.finalDist || 0;
  const view = { screen, world, best, muted: false, newBest, finalScore, finalParts, finalDist };
  renderer.draw(view);
  renderer.draw(view);
  window.__shotReady = true;
} else {
  window.addEventListener('pointerdown', () => { if (audio) audio.ensure(); });
  window.addEventListener('keydown', () => { if (audio) audio.ensure(); });
  setStatus('Gobble or Roast! Press Space or click Start.');
  requestAnimationFrame(frame);
}
