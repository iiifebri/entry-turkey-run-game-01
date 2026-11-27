// render.js — ALL canvas drawing for Gobble or Roast!
// Original vector art only: Gus, Farmer Bram, the oven, knives, farm,
// barn and kitchen are arcs, ellipses and polygons. Also draws the HUD
// (hearts, score, distance, corn, farmer alert meter), the title screen,
// pause and both end screens, particles and comic bubbles.

import { FIELD, PALETTE, TUNING } from './config.js';
import { distanceToGate, progressToGate } from './world.js';
import { ovenZone } from './hazards.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buttons = [];

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(s, x, y, size, color, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px system-ui, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  function outlineText(s, x, y, size, fill, stroke, align) {
    ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 7;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = PALETTE.panel;
    ctx.globalAlpha = alpha === undefined ? 0.88 : alpha;
    rr(x, y, w, h, 14);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function button(id, x, y, w, h, label, primary) {
    buttons.push({ id, x, y, w, h });
    ctx.fillStyle = primary ? PALETTE.gold : PALETTE.panel;
    ctx.globalAlpha = primary ? 1 : 0.92;
    rr(x, y, w, h, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = primary ? PALETTE.panel : PALETTE.gold;
    ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 8, 24, primary ? PALETTE.panel : PALETTE.cream, 'center');
  }

  function drawHeart(x, y, s, filled) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.3, y, x - s * 0.7, y - s, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.7, y - s, x + s * 1.3, y, x, y + s * 0.9);
    ctx.closePath();
    ctx.fillStyle = filled ? PALETTE.danger : '#6B5A4A';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panel;
    ctx.stroke();
  }

  function drawCornIcon(x, y, golden, big) {
    const s = big ? 1.5 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (golden) {
      ctx.fillStyle = PALETTE.gold;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#F2C94C';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8A33C';
    ctx.beginPath(); ctx.ellipse(-4, -3, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, 2, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.bush;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-13, 20); ctx.moveTo(8, 12); ctx.lineTo(13, 20); ctx.stroke();
    ctx.restore();
  }

  // ---- characters ----

  function drawTurkeyFigure(t, time) {
    const lift = t.hopT > 0
      ? Math.sin((1 - t.hopT / TUNING.hopTime) * Math.PI) * TUNING.hopLift
      : 0;
    const stretch = t.hopT > 0 ? 1 + 0.12 * Math.sin((1 - t.hopT / TUNING.hopTime) * Math.PI) : 1;
    if (t.hidden && t.hideSpot) {
      // Only feather tips and eyes peek out of the hiding spot.
      const s = t.hideSpot;
      const cx = s.x + s.w / 2;
      ctx.fillStyle = PALETTE.tailRed;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + i * 14, s.y + 4, 7, 12, i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.eyeWhite;
      ctx.beginPath(); ctx.arc(cx - 9, s.y + 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 9, s.y + 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.pupil;
      ctx.beginPath(); ctx.arc(cx - 9, s.y + 12, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 9, s.y + 12, 2.5, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (t.invulnT > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.save();
    ctx.translate(t.x, t.y - lift);
    if (t.sprinting) ctx.rotate(t.faceX * 0.1);
    ctx.scale(1, stretch);
    const step = t.moving ? Math.sin(t.bob) * 8 : 0;
    // Legs.
    ctx.strokeStyle = PALETTE.turkeyFeet;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(-8 + step, 32); ctx.moveTo(8, 18); ctx.lineTo(8 - step, 32); ctx.stroke();
    // Tail fan: five teardrop feathers behind the body.
    const base = t.faceX > 0 ? Math.PI : 0;
    const cols = [PALETTE.tailRed, PALETTE.tailGold, PALETTE.tailBrown, PALETTE.tailGold, PALETTE.tailRed];
    for (let i = -2; i <= 2; i++) {
      const a = base + i * 0.34 + Math.sin(time * 3 + i) * 0.03;
      ctx.save();
      ctx.translate(Math.cos(a) * 26, -8 + Math.sin(a) * 22);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = cols[i + 2];
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.panel;
      ctx.stroke();
      ctx.restore();
    }
    // Body.
    ctx.fillStyle = PALETTE.turkeyBody;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.panel;
    ctx.stroke();
    // Head, beak, wattle, eye.
    ctx.fillStyle = PALETTE.turkeyHead;
    ctx.beginPath(); ctx.arc(t.faceX * 22, -26, 13, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.beak;
    ctx.beginPath();
    ctx.moveTo(t.faceX * 32, -28);
    ctx.lineTo(t.faceX * 46, -23);
    ctx.lineTo(t.faceX * 32, -19);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.wattle;
    ctx.beginPath(); ctx.ellipse(t.faceX * 26, -12, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.eyeWhite;
    ctx.beginPath(); ctx.arc(t.faceX * 26, -30, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.pupil;
    ctx.beginPath(); ctx.arc(t.faceX * 28, -30, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFarmerFigure(f, time) {
    const chasing = f.state === 'CHASE' || f.state === 'CORNERED';
    const searching = f.state === 'SEARCH';
    ctx.save();
    ctx.translate(f.x, f.y);
    // Vision cone is drawn by the caller before the farmer.
    const bob = chasing ? Math.sin(time * 14) * 3 : Math.sin(time * 4) * 1;
    // Boots.
    ctx.fillStyle = PALETTE.boots;
    rr(-16, 26 + bob, 13, 12, 4); ctx.fill();
    rr(3, 26 - bob, 13, 12, 4); ctx.fill();
    // Overalls.
    ctx.fillStyle = PALETTE.overalls;
    rr(-17, -2, 34, 30, 6); ctx.fill();
    // Shirt with plaid cross-hatch.
    ctx.fillStyle = PALETTE.shirt;
    rr(-22, -32, 44, 32, 8); ctx.fill();
    ctx.strokeStyle = '#8A2A1A';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-22 + (i + 1) * 15, -32); ctx.lineTo(-22 + (i + 1) * 15, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -22 + i * 10); ctx.lineTo(22, -22 + i * 10); ctx.stroke();
    }
    // Arms; knife in the right hand.
    ctx.strokeStyle = PALETTE.shirt;
    ctx.lineWidth = 7;
    const armSwing = chasing ? Math.sin(time * 14) * 10 : Math.sin(time * 4) * 3;
    ctx.beginPath(); ctx.moveTo(-20, -26); ctx.lineTo(-30, -2 + armSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -26); ctx.lineTo(30, -2 - armSwing); ctx.stroke();
    const raised = f.state === 'CORNERED';
    ctx.save();
    ctx.translate(30, raised ? -34 : -2 - armSwing);
    ctx.rotate(raised ? -1.1 : 0.5);
    ctx.fillStyle = PALETTE.blade;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -4); ctx.lineTo(26, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.knifeHandle;
    rr(-10, -3, 11, 6, 2); ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(22, -3); ctx.stroke();
    ctx.restore();
    // Head, beard, hat.
    if (searching) ctx.rotate(0.12);
    ctx.fillStyle = PALETTE.skin;
    ctx.beginPath(); ctx.arc(0, -44, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.beard;
    rr(-11, -38, 22, 12, 5); ctx.fill();
    ctx.fillStyle = PALETTE.skin;
    ctx.beginPath(); ctx.arc(-5, -46, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -46, 2, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(0, -56);
    if (chasing) ctx.rotate(-0.18);
    ctx.fillStyle = PALETTE.straw;
    ctx.beginPath(); ctx.ellipse(0, 0, 27, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0); ctx.fill();
    ctx.restore();
    ctx.restore();
    // "?" / "!" bubble.
    if (f.bubble && f.bubbleT > 0) {
      const pop = 1 + 0.15 * Math.sin(time * 16);
      ctx.save();
      ctx.translate(f.x + 34, f.y - 92);
      ctx.scale(pop, pop);
      ctx.fillStyle = f.bubble === '!' ? PALETTE.danger : PALETTE.gold;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = PALETTE.panel;
      ctx.stroke();
      text(f.bubble, 0, 8, 26, PALETTE.panel, 'center');
      ctx.restore();
    }
  }

  function drawVisionCone(f) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.arc(f.x, f.y, f.vision, f.facing - TUNING.visionHalfAngle, f.facing + TUNING.visionHalfAngle);
    ctx.closePath();
    ctx.fillStyle = f.state === 'CHASE' || f.state === 'CORNERED' ? 'rgba(229,83,75,0.20)' : 'rgba(242,201,76,0.16)';
    ctx.fill();
    ctx.strokeStyle = f.state === 'CHASE' ? 'rgba(229,83,75,0.5)' : 'rgba(242,201,76,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // ---- stage scenery ----

  function drawBackground(w) {
    const i = w.stageIndex;
    if (i === 0) {
      const g = ctx.createLinearGradient(0, 0, 0, FIELD.H);
      g.addColorStop(0, PALETTE.skyHigh);
      g.addColorStop(0.16, PALETTE.skyMid);
      g.addColorStop(0.22, PALETTE.skyLow);
      g.addColorStop(0.24, PALETTE.grass);
      g.addColorStop(1, '#5C7A3A');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      // Low sun on the horizon strip.
      ctx.fillStyle = '#FFF3D6';
      ctx.beginPath(); ctx.arc(1080, 140, 26, 0, Math.PI * 2); ctx.fill();
      // Dirt path to the barn door.
      ctx.fillStyle = PALETTE.dirt;
      ctx.fillRect(60, 340, 1160, 100);
      // Grass tufts (fixed positions, no randomness at draw time).
      ctx.strokeStyle = '#5C7A3A';
      ctx.lineWidth = 2;
      for (let k = 0; k < 40; k++) {
        const x = (k * 97) % 1280;
        const y = 190 + (k * 53) % 490;
        if (y > 340 && y < 440) continue;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 9); ctx.moveTo(x + 3, y); ctx.lineTo(x + 7, y - 8); ctx.stroke();
      }
    } else if (i === 1) {
      ctx.fillStyle = PALETTE.barnDark;
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      ctx.fillStyle = '#A9713F';
      ctx.fillRect(0, FIELD.TOP, FIELD.W, FIELD.H - FIELD.TOP);
      ctx.strokeStyle = '#7A4A26';
      ctx.lineWidth = 2;
      for (let y = FIELD.TOP + 48; y < FIELD.H; y += 48) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.W, y); ctx.stroke();
      }
      // Lantern glow.
      const g = ctx.createRadialGradient(640, 190, 10, 640, 190, 320);
      g.addColorStop(0, 'rgba(247,178,103,0.55)');
      g.addColorStop(1, 'rgba(247,178,103,0)');
      ctx.fillStyle = g;
      ctx.fillRect(300, 0, 680, 520);
      ctx.fillStyle = '#2B2118';
      ctx.beginPath(); ctx.arc(640, 190, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(640, 190, 7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.tile;
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      const s = 64;
      ctx.fillStyle = '#EAD9B5';
      for (let y = FIELD.TOP; y < FIELD.H; y += s) {
        for (let x = 0; x < FIELD.W; x += s) {
          if (((x / s) + (y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
        }
      }
      ctx.strokeStyle = PALETTE.grout;
      ctx.lineWidth = 2;
      for (let x = 0; x <= FIELD.W; x += s) { ctx.beginPath(); ctx.moveTo(x, FIELD.TOP); ctx.lineTo(x, FIELD.H); ctx.stroke(); }
      for (let y = FIELD.TOP; y <= FIELD.H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.W, y); ctx.stroke(); }
    }
    if (w.stage.dark > 0) {
      ctx.fillStyle = '#1A0F08';
      ctx.globalAlpha = w.stage.dark;
      ctx.fillRect(0, FIELD.TOP, FIELD.W, FIELD.H - FIELD.TOP);
      ctx.globalAlpha = 1;
    }
  }

  function drawExit(w) {
    const e = w.exit;
    const pulse = 0.6 + 0.4 * Math.sin(w.time * 4);
    ctx.save();
    ctx.fillStyle = w.stageIndex === 2 ? '#3E6B4F' : PALETTE.barnWood;
    rr(e.x - 6, e.y - 8, e.w + 12, e.h + 16, 8);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.panel;
    ctx.stroke();
    ctx.strokeStyle = PALETTE.panel;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.w, e.y + e.h); ctx.moveTo(e.x + e.w, e.y); ctx.lineTo(e.x, e.y + e.h); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    outlineText('EXIT', e.x + e.w / 2, e.y - 16, 24, PALETTE.cream, PALETTE.panel, 'center');
  }

  function drawHideSpot(h, time) {
    if (h.kind === 'hay') {
      ctx.fillStyle = PALETTE.hay;
      ctx.beginPath(); ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.hayDark;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x + 14, h.y + 18); ctx.lineTo(h.x + h.w - 14, h.y + 18); ctx.moveTo(h.x + 10, h.y + 36); ctx.lineTo(h.x + h.w - 10, h.y + 36); ctx.stroke();
      ctx.fillStyle = PALETTE.hayDark;
      ctx.beginPath(); ctx.ellipse(h.x + h.w / 2, h.y + h.h - 6, h.w / 2 - 8, 8, 0, 0, Math.PI); ctx.fill();
    } else if (h.kind === 'bush') {
      ctx.fillStyle = PALETTE.bush;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc(h.x + 18 + k * 24, h.y + h.h / 2, 24, 0, Math.PI * 2); ctx.fill();
      }
    } else if (h.kind === 'barrel') {
      ctx.fillStyle = PALETTE.barrel;
      rr(h.x, h.y, h.w, h.h, 10); ctx.fill();
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x, h.y + 18); ctx.lineTo(h.x + h.w, h.y + 18); ctx.moveTo(h.x, h.y + h.h - 18); ctx.lineTo(h.x + h.w, h.y + h.h - 18); ctx.stroke();
    } else if (h.kind === 'pantry') {
      ctx.fillStyle = PALETTE.pantry;
      rr(h.x, h.y, h.w, h.h, 6); ctx.fill();
      ctx.strokeStyle = '#4A3226';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x, h.y + 36); ctx.lineTo(h.x + h.w, h.y + 36); ctx.moveTo(h.x, h.y + 72); ctx.lineTo(h.x + h.w, h.y + 72); ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(h.x + h.w / 2, h.y + 18, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#C9A227';
      ctx.beginPath(); ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(h.x + 10, h.y + h.h / 2); ctx.lineTo(h.x + h.w - 10, h.y + h.h / 2); ctx.stroke();
    }
  }

  function drawObstacle(o) {
    if (o.kind === 'oven') return; // the oven draws itself
    ctx.fillStyle = o.kind === 'fence' ? PALETTE.fence : o.kind === 'stall' ? PALETTE.barnWood : o.kind === 'counter' || o.kind === 'board' ? PALETTE.counter : PALETTE.barnDark;
    rr(o.x, o.y, o.w, o.h, 6);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.panel;
    ctx.stroke();
    if (o.kind === 'fence') {
      ctx.strokeStyle = '#7A4A26';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x, o.y + o.h / 2); ctx.lineTo(o.x + o.w, o.y + o.h / 2); ctx.stroke();
    }
    if (o.kind === 'board') {
      ctx.fillStyle = '#E8E0D0';
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawOven(w) {
    const o = w.hazards.oven;
    if (!o) return;
    const z = ovenZone(o);
    if (o.phase === 'warn') {
      ctx.fillStyle = 'rgba(255,122,26,' + (0.25 + 0.2 * Math.sin(w.time * 12)) + ')';
      rr(z.x, z.y, z.w, z.h, 10); ctx.fill();
      ctx.strokeStyle = PALETTE.ovenGlow;
      ctx.lineWidth = 4;
      ctx.stroke();
      text('HOT!', z.x + z.w / 2, z.y + 28, 22, PALETTE.ovenGlow, 'center');
    }
    if (o.phase === 'burst') {
      ctx.fillStyle = 'rgba(255,122,26,0.35)';
      rr(z.x, z.y, z.w, z.h, 10); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const fx = z.x + 20 + k * ((z.w - 40) / 4);
        const fh = 34 + Math.sin(w.time * 20 + k * 2) * 10;
        ctx.fillStyle = k % 2 ? '#FFC93C' : PALETTE.ovenGlow;
        ctx.beginPath(); ctx.ellipse(fx, z.y + 44, 14, fh, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = PALETTE.ovenBody;
    rr(o.x, o.y, o.w, o.h, 10); ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.panel;
    ctx.stroke();
    const g = ctx.createRadialGradient(o.x + o.w / 2, o.y + o.h / 2, 4, o.x + o.w / 2, o.y + o.h / 2, 34);
    g.addColorStop(0, o.phase === 'burst' ? '#FFD23C' : PALETTE.ovenGlow);
    g.addColorStop(1, '#7A2E0E');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, 30, 0, Math.PI * 2); ctx.fill();
    if (o.phase === 'idle') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const wy = o.y - 10 - ((w.time * 20) % 30);
      ctx.beginPath(); ctx.arc(o.x + 40, wy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + 60, wy - 8, 5, 0, Math.PI * 2); ctx.fill();
    }
    text('OVEN', o.x + o.w / 2, o.y + o.h + 22, 18, PALETTE.cream, 'center');
  }

  function drawKnife(k) {
    ctx.save();
    ctx.translate(k.x, k.y);
    if (k.kind === 'thrown') {
      ctx.rotate(k.spin);
      ctx.fillStyle = PALETTE.blade;
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(22, -5); ctx.lineTo(22, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PALETTE.knifeHandle;
      rr(-20, -4, 15, 8, 3); ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(18, -3); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(201,206,214,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-k.vx * 0.12, 0); ctx.lineTo(-k.vx * 0.04, 0); ctx.stroke();
      ctx.fillStyle = PALETTE.blade;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(24, -6); ctx.lineTo(24, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PALETTE.knifeHandle;
      rr(-22, -5, 15, 10, 3); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayWorld(w) {
    drawBackground(w);
    drawExit(w);
    // Snares: faint rope loops.
    ctx.strokeStyle = 'rgba(107,63,34,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    for (const s of w.hazards.snares) {
      if (!s.armed) continue;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Corn.
    for (const c of w.corn) {
      if (c.taken) continue;
      const bobY = Math.sin(w.time * 3 + c.x) * 3;
      drawCornIcon(c.x, c.y + bobY, c.golden, c.golden);
    }
    // Pumpkin pie slice.
    if (w.pie && !w.pie.taken) {
      ctx.fillStyle = '#E07A3F';
      ctx.beginPath(); ctx.moveTo(w.pie.x - 16, w.pie.y + 10); ctx.lineTo(w.pie.x + 16, w.pie.y + 10); ctx.lineTo(w.pie.x, w.pie.y - 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Hanging pots.
    for (const p of w.hazards.pots) {
      if (p.fallen) {
        ctx.fillStyle = '#6B6B72';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 26, 16, 8, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = PALETTE.panel;
        ctx.beginPath(); ctx.moveTo(p.x - 10, p.y + 22); ctx.lineTo(p.x + 6, p.y + 30); ctx.stroke();
      } else {
        ctx.strokeStyle = '#4A4A52';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, 96); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#6B6B72';
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4A4A52';
        ctx.beginPath(); ctx.arc(p.x, p.y + 4, 10, 0, Math.PI); ctx.fill();
      }
    }
    for (const h of w.hides) drawHideSpot(h, w.time);
    for (const o of w.obstacles) drawObstacle(o);
    drawOven(w);
    if (w.hazards.warnSlide) {
      ctx.fillStyle = 'rgba(242,201,76,' + (0.5 + 0.4 * Math.sin(w.time * 16)) + ')';
      ctx.beginPath(); ctx.arc(w.hazards.warnSlide.fromLeft ? 20 : FIELD.W - 20, w.hazards.warnSlide.y, 10, 0, Math.PI * 2); ctx.fill();
      text('!', w.hazards.warnSlide.fromLeft ? 20 : FIELD.W - 20, w.hazards.warnSlide.y + 8, 22, PALETTE.panel, 'center');
    }
    for (const k of w.hazards.knives) drawKnife(k);
    drawVisionCone(w.farmer);
    drawFarmerFigure(w.farmer, w.time);
    drawTurkeyFigure(w.turkey, w.time);
    // Particles.
    for (const p of w.particles) {
      ctx.save();
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'feather') {
        ctx.fillStyle = p.vx > 0 ? PALETTE.tailRed : PALETTE.tailGold;
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = '#D9C49A';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // Floating feedback text.
    for (const f of w.floaters) {
      ctx.globalAlpha = 1 - f.t / f.life;
      outlineText(f.text, f.x, f.y, 24, f.color, PALETTE.panel, 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---- HUD ----

  function drawHUD(game) {
    const w = game.world;
    panel(0, 0, FIELD.W, 88, 0.88);
    for (let i = 0; i < 3; i++) drawHeart(34 + i * 42, 40, 15, i < w.turkey.hearts);
    text('SCORE ' + w.score.toLocaleString('en-US'), 160, 48, 28, PALETTE.cream);
    text('STAGE ' + (w.stageIndex + 1) + ' — ' + w.stage.name, FIELD.W / 2, 30, 24, PALETTE.cream, 'center');
    const prog = progressToGate(w);
    ctx.fillStyle = '#4A3226';
    rr(480, 44, 320, 12, 6); ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    rr(480, 44, 320 * prog, 12, 6); ctx.fill();
    text(distanceToGate(w) + ' ft to the gate', FIELD.W / 2, 78, 20, PALETTE.gold, 'center');
    drawCornIcon(1000, 34, false, false);
    text('x ' + w.cornCount, 1022, 42, 24, PALETTE.cream);
    button('pause', 1112, 24, 40, 40, 'II', false);
    button('mute', 1164, 24, 40, 40, game.muted ? 'X' : 'M', false);
    // Farmer alert meter.
    const f = w.farmer;
    const stateColor = f.state === 'PATROL' ? PALETTE.calm : f.state === 'SUSPICIOUS' || f.state === 'SEARCH' ? PALETTE.warn : PALETTE.chase;
    text('FARMER', 420, 116, 20, PALETTE.cream);
    ctx.fillStyle = '#4A3226';
    rr(520, 100, 280, 16, 8); ctx.fill();
    const frac = f.state === 'CHASE' || f.state === 'CORNERED' ? 1 : f.suspicion;
    ctx.fillStyle = stateColor;
    rr(520, 100, 280 * frac, 16, 8); ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panel;
    rr(520, 100, 280, 16, 8); ctx.stroke();
    text(f.state, 812, 116, 20, stateColor);
    if (w.hint) {
      const hw = w.hint.length * 11 + 28;
      panel(FIELD.W / 2 - hw / 2, 668, hw, 36, 0.85);
      text(w.hint, FIELD.W / 2, 692, 22, PALETTE.cream, 'center');
    }
  }

  // ---- screens ----

  function drawTitle(game) {
    const w = game.world;
    drawPlayWorld(w);
    ctx.fillStyle = 'rgba(43,33,24,0.45)';
    ctx.fillRect(0, 0, FIELD.W, FIELD.H);
    const wob = Math.sin(w.time * 2) * 4;
    outlineText('GOBBLE OR ROAST!', FIELD.W / 2, 150 + wob, 68, PALETTE.cream, '#6B3F22', 'center');
    text('The Great Thanksgiving Escape — Gus the turkey vs. Farmer Bram', FIELD.W / 2, 190, 24, PALETTE.gold, 'center');
    panel(340, 240, 600, 190, 0.88);
    text('HOW TO PLAY', 640, 276, 26, PALETTE.gold, 'center');
    text('ARROWS / WASD run  —  SPACE hop  —  SHIFT sprint (loud!)', 640, 314, 22, PALETTE.cream, 'center');
    text('C hides in haystacks, barrels and the pantry', 640, 346, 22, PALETTE.cream, 'center');
    text('Dodge the carving knife — mind the oven', 640, 378, 22, PALETTE.cream, 'center');
    text('Reach the gate, farmyard to kitchen, and ESCAPE!', 640, 410, 22, PALETTE.cream, 'center');
    text('BEST: ' + game.best.score.toLocaleString('en-US') + ' pts — ' + game.best.dist + ' ft', FIELD.W / 2, 470, 24, PALETTE.cream, 'center');
    button('start', 520, 500, 240, 64, 'START', true);
    text('Press SPACE or click START', FIELD.W / 2, 600, 20, PALETTE.cream, 'center');
    button('mute', 1164, 24, 40, 40, game.muted ? 'X' : 'M', false);
  }

  function drawPause(game) {
    ctx.fillStyle = 'rgba(43,33,24,0.7)';
    ctx.fillRect(0, 0, FIELD.W, FIELD.H);
    panel(390, 180, 500, 360, 0.95);
    outlineText('PAUSED', 640, 250, 56, PALETTE.cream, PALETTE.panel, 'center');
    text('ARROWS / WASD run  —  SPACE hop', 640, 300, 22, PALETTE.cream, 'center');
    text('SHIFT sprint (loud!)  —  C hide in a spot', 640, 332, 22, PALETTE.cream, 'center');
    text('P pause  —  M mute  —  R restart', 640, 364, 22, PALETTE.cream, 'center');
    button('resume', 490, 400, 300, 56, 'RESUME', true);
    button('restart', 490, 468, 140, 48, 'RESTART', false);
    button('title', 650, 468, 140, 48, 'TITLE', false);
  }

  function drawStageClear(w) {
    panel(440, 250, 400, 170, 0.92);
    outlineText('STAGE CLEAR!', 640, 310, 44, PALETTE.gold, PALETTE.panel, 'center');
    text('+' + (100 * (w.stageIndex + 1)) + ' pts', 640, 350, 26, PALETTE.cream, 'center');
    text('Next: ' + w.stage.next, 640, 388, 24, PALETTE.cream, 'center');
  }

  function drawEnd(game, won) {
    const w = game.world;
    if (won) {
      const g = ctx.createLinearGradient(0, 0, 0, FIELD.H);
      g.addColorStop(0, '#E07A3F');
      g.addColorStop(0.6, '#F7B267');
      g.addColorStop(0.61, '#7A9A4D');
      g.addColorStop(1, '#5C7A3A');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      ctx.fillStyle = '#3E5C3A';
      for (let k = 0; k < 8; k++) {
        const x = 60 + k * 170;
        ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x + 40, 420); ctx.lineTo(x + 80, 560); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = PALETTE.tile;
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      ctx.fillStyle = PALETTE.counter;
      ctx.fillRect(0, 560, FIELD.W, 160);
    }
    if (won) {
      const gus = { x: 300, y: 520, faceX: 1, faceY: 0, hopT: 0, hopCd: 0, sprinting: false, hidden: false, hideSpot: null, hearts: 3, invulnT: 0, bob: w.time * 3, moving: false };
      drawTurkeyFigure(gus, w.time);
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(360, 490); ctx.lineTo(360, 410); ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.moveTo(360, 410); ctx.lineTo(416, 424); ctx.lineTo(360, 438); ctx.closePath(); ctx.fill();
      text('FREE!', 388, 432, 22, PALETTE.panel, 'center');
      outlineText('ESCAPED!', FIELD.W / 2, 150, 72, PALETTE.cream, '#6B3F22', 'center');
      text('Gus made it to the woods — no Thanksgiving dinner this year!', FIELD.W / 2, 196, 24, PALETTE.cream, 'center');
      panel(440, 230, 400, 220, 0.92);
      text('Corn  ' + game.finalParts.corn + ' pts', 640, 268, 22, PALETTE.cream, 'center');
      text('Bonuses  ' + game.finalParts.bonus + ' pts', 640, 300, 22, PALETTE.cream, 'center');
      text('Stage bonus  ' + game.finalParts.stage + ' pts', 640, 332, 22, PALETTE.cream, 'center');
      text('Escape bonus  ' + game.finalParts.escape + ' pts', 640, 364, 22, PALETTE.cream, 'center');
      text('TOTAL  ' + game.finalScore.toLocaleString('en-US') + ' pts', 640, 404, 26, PALETTE.gold, 'center');
      if (game.newBest) {
        ctx.fillStyle = PALETTE.danger;
        rr(560, 420, 160, 40, 10); ctx.fill();
        text('NEW BEST!', 640, 448, 22, PALETTE.cream, 'center');
      }
      button('playagain', 470, 500, 300, 60, 'PLAY AGAIN', true);
      button('title', 490, 576, 260, 48, 'TITLE', false);
      text('Press R to play again', FIELD.W / 2, 660, 20, PALETTE.cream, 'center');
    } else {
      const bram = { x: 760, y: 430, facing: Math.PI, state: 'PATROL', bubble: '?', bubbleT: 1, dir: -1, stepT: 0 };
      drawFarmerFigure(bram, w.time);
      ctx.fillStyle = '#C9CED6';
      ctx.beginPath(); ctx.ellipse(640, 470, 90, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 3;
      ctx.stroke();
      const gus = { x: 560, y: 480, faceX: 1, faceY: 0, hopT: 0, hopCd: 0, sprinting: false, hidden: false, hideSpot: null, hearts: 0, invulnT: 0, bob: w.time * 3, moving: false };
      drawTurkeyFigure(gus, w.time);
      outlineText('CAUGHT!', FIELD.W / 2, 150, 72, PALETTE.danger, PALETTE.panel, 'center');
      text('Thanksgiving dinner is served... almost. Gus will try again.', FIELD.W / 2, 196, 24, PALETTE.cream, 'center');
      panel(440, 230, 400, 150, 0.92);
      text('SCORE  ' + game.finalScore.toLocaleString('en-US') + ' pts', 640, 278, 24, PALETTE.cream, 'center');
      text('You got ' + game.finalDist + ' ft — the kitchen was so close!', 640, 316, 22, PALETTE.cream, 'center');
      text('BEST  ' + game.best.score.toLocaleString('en-US') + ' pts', 640, 348, 22, PALETTE.gold, 'center');
      button('tryagain', 470, 430, 300, 60, 'TRY AGAIN', true);
      button('title', 490, 506, 260, 48, 'TITLE', false);
      text('Press R to try again', FIELD.W / 2, 580, 20, PALETTE.cream, 'center');
    }
  }

  function draw(game) {
    buttons.length = 0;
    ctx.save();
    ctx.clearRect(0, 0, FIELD.W, FIELD.H);
    const w = game.world;
    if (w.shake > 0) {
      ctx.translate(Math.sin(w.time * 47) * w.shake * 14, Math.cos(w.time * 39) * w.shake * 10);
    }
    if (game.screen === 'title') {
      drawTitle(game);
    } else if (game.screen === 'playing' || game.screen === 'paused') {
      drawPlayWorld(w);
      drawHUD(game);
      if (w.stageClearT > 0) drawStageClear(w);
      if (game.screen === 'paused') drawPause(game);
    } else if (game.screen === 'escaped') {
      drawEnd(game, true);
    } else if (game.screen === 'caught') {
      drawEnd(game, false);
    }
    if (w.flash > 0 && game.screen === 'playing') {
      ctx.strokeStyle = 'rgba(229,83,75,' + Math.min(0.8, w.flash) + ')';
      ctx.lineWidth = 26;
      ctx.strokeRect(0, 0, FIELD.W, FIELD.H);
    }
    ctx.restore();
  }

  return { draw, buttons };
}
