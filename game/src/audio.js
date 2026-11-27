// audio.js — WebAudio synth cues only, no audio files, no network.
// One named function per cue from the design. The context is created on the
// first user gesture (autoplay policy) and never in shot mode. Mute lives in
// memory for the session. The noise buffer is generated with a fixed-seed
// LCG, so no Math.random anywhere.

export function createAudio() {
  let ctx = null;
  let noiseBuf = null;
  let muted = false;
  let ambience = null;
  let chirpT = 9;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 987654321;
      for (let i = 0; i < len; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        d[i] = (s / 4294967296) * 2 - 1;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(f0, f1, dur, type, vol, delay) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, filterType, f0, f1, vol, delay) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    ensure,
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopAmbience();
      return muted;
    },
    // Footsteps: short filtered-noise tick, pitch wobbles step to step.
    playStep() { noise(0.08, 'lowpass', 800, 700, 0.12); },
    playHop() { tone(300, 600, 0.12, 'sine', 0.2); },
    // The signature gob-gob-gob: three rapid square blips with vibrato.
    playGobble() {
      tone(220, 200, 0.1, 'square', 0.16);
      tone(180, 165, 0.1, 'square', 0.16, 0.11);
      tone(160, 140, 0.13, 'square', 0.16, 0.22);
    },
    playAlert() {
      tone(392, 392, 0.25, 'sawtooth', 0.2);
      tone(466, 466, 0.25, 'sawtooth', 0.2, 0.22);
      noise(0.3, 'highpass', 1200, 1200, 0.08);
    },
    playSuspicious() { tone(440, 660, 0.2, 'sine', 0.12); },
    playWhoosh() { noise(0.3, 'bandpass', 400, 2400, 0.2); },
    playClatter() {
      tone(1200, 1200, 0.06, 'triangle', 0.14);
      tone(900, 900, 0.06, 'triangle', 0.12, 0.07);
      tone(1500, 1500, 0.08, 'triangle', 0.12, 0.14);
    },
    playSizzle() {
      noise(0.5, 'highpass', 2000, 3000, 0.18);
      tone(90, 60, 0.4, 'sine', 0.25);
    },
    playHit() {
      tone(120, 70, 0.25, 'sine', 0.3);
      tone(220, 80, 0.4, 'sawtooth', 0.18, 0.02);
    },
    // Sad trombone: three descending notes, comic not scary.
    playCaught() {
      tone(330, 330, 0.3, 'sawtooth', 0.18);
      tone(294, 294, 0.3, 'sawtooth', 0.18, 0.32);
      tone(262, 196, 0.5, 'sawtooth', 0.18, 0.64);
    },
    playFanfare() {
      tone(523, 523, 0.2, 'triangle', 0.2);
      tone(659, 659, 0.2, 'triangle', 0.2, 0.18);
      tone(784, 784, 0.2, 'triangle', 0.2, 0.36);
      tone(1046, 1046, 0.35, 'triangle', 0.22, 0.54);
      noise(0.15, 'highpass', 3000, 3000, 0.08, 0.54);
    },
    playCorn() { tone(880, 1320, 0.08, 'sine', 0.18); },
    playGoldenCorn() {
      tone(1046, 1046, 0.18, 'sine', 0.18);
      tone(1568, 1568, 0.25, 'sine', 0.16, 0.1);
    },
    playStageClear() {
      tone(523, 523, 0.15, 'triangle', 0.2);
      tone(659, 659, 0.15, 'triangle', 0.2, 0.15);
      tone(784, 784, 0.25, 'triangle', 0.22, 0.3);
    },
    playClick() { tone(1000, 1000, 0.03, 'square', 0.1); },
    startAmbience(stageIndex) {
      if (!ensure() || muted) return;
      this.stopAmbience();
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = stageIndex === 2 ? 300 : 500;
      const g = ctx.createGain();
      g.gain.value = stageIndex === 2 ? 0.05 : 0.035;
      src.connect(flt);
      flt.connect(g);
      g.connect(ctx.destination);
      src.start();
      let hum = null;
      if (stageIndex === 2) {
        hum = ctx.createOscillator();
        hum.type = 'sine';
        hum.frequency.value = 60;
        const hg = ctx.createGain();
        hg.gain.value = 0.02;
        hum.connect(hg);
        hg.connect(ctx.destination);
        hum.start();
      }
      ambience = { src, hum };
    },
    stopAmbience() {
      if (!ambience) return;
      try { ambience.src.stop(); } catch (e) { /* already stopped */ }
      if (ambience.hum) { try { ambience.hum.stop(); } catch (e) { /* already stopped */ } }
      ambience = null;
    },
    // Called every frame: a distant bird chirp now and then on the farmyard.
    update(dt, stageIndex) {
      if (!ctx || muted || stageIndex !== 0) return;
      chirpT -= dt;
      if (chirpT <= 0) {
        chirpT = 8 + (ctx.currentTime % 7);
        tone(2400, 2900, 0.07, 'sine', 0.05);
        tone(2600, 3100, 0.06, 'sine', 0.04, 0.12);
      }
    },
  };
}
