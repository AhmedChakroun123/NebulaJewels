/* ═══════════════════════════════════════════════════════════
   NEBULA JEWELS  ·  audio.js
   Web Audio synthesis — no external files needed
═══════════════════════════════════════════════════════════ */
'use strict';

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(ctx.destination);
    } catch(e) { enabled = false; }
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setEnabled(v) { enabled = v; if (masterGain) masterGain.gain.value = v ? 0.7 : 0; }

  function tone(freq, type, vol, attack, sustain, release, delay = 0) {
    if (!enabled || !ctx) return;
    try {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();

      o.type = type;
      o.frequency.setValueAtTime(freq, t);

      f.type = 'lowpass';
      f.frequency.setValueAtTime(freq * 4, t);
      f.Q.value = 0.7;

      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, t + attack + sustain);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + sustain + release);

      o.connect(f); f.connect(g); g.connect(masterGain);
      o.start(t);
      o.stop(t + attack + sustain + release + 0.05);
    } catch(e) {}
  }

  function chord(freqs, type, vol, attack, sustain, release, delay = 0) {
    freqs.forEach((f, i) => tone(f, type, vol, attack, sustain, release, delay + i * 0.018));
  }

  // ── SOUND LIBRARY ────────────────────────────────────────

  function playMatch(count, combo) {
    init(); resume();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    const base = notes[Math.min(Math.floor(combo / 2), notes.length - 1)];
    const vol = Math.min(0.12 + combo * 0.02, 0.22);

    // fundamental
    tone(base, 'sine', vol, 0.005, 0.04, 0.25);
    // overtone shimmer
    tone(base * 2.01, 'sine', vol * 0.35, 0.01, 0.02, 0.2);
    tone(base * 3.02, 'sine', vol * 0.15, 0.015, 0.01, 0.15);

    // extra notes for longer matches
    for (let i = 1; i < Math.min(count - 2, 4); i++) {
      const f = base * (1 + i * 0.125);
      tone(f, 'sine', vol * 0.6, 0.005, 0.03, 0.18, i * 0.035);
    }

    if (combo >= 3) {
      tone(base * 4, 'triangle', vol * 0.25, 0.01, 0.05, 0.3, 0.04);
    }
  }

  function playCombo(n) {
    init(); resume();
    const freqs = [
      [],
      [],
      [523,659,784],       // 2x
      [659,784,1047],      // 3x
      [784,1047,1319],     // 4x
      [1047,1319,1568],    // 5x
      [1319,1568,2093],    // 6x+
    ];
    const f = freqs[Math.min(n, freqs.length - 1)];
    if (f.length) chord(f, 'triangle', 0.14, 0.01, 0.08, 0.4);
    // big sweep
    if (n >= 4) {
      tone(2093, 'sine', 0.2, 0.02, 0.12, 0.6, 0.05);
      tone(2793, 'sine', 0.1, 0.03, 0.08, 0.5, 0.1);
    }
  }

  function playSwap() {
    init(); resume();
    tone(480, 'sine', 0.07, 0.005, 0.01, 0.1);
    tone(600, 'sine', 0.05, 0.005, 0.01, 0.1, 0.04);
  }

  function playInvalid() {
    init(); resume();
    tone(220, 'sawtooth', 0.06, 0.005, 0.03, 0.15);
    tone(190, 'sawtooth', 0.04, 0.005, 0.03, 0.12, 0.04);
  }

  function playSelect() {
    init(); resume();
    tone(880, 'sine', 0.06, 0.003, 0.01, 0.08);
  }

  function playSpecial() {
    init(); resume();
    const sweep = [400, 600, 900, 1200, 1800];
    sweep.forEach((f, i) => tone(f, 'sine', 0.1, 0.005, 0.02, 0.2, i * 0.025));
  }

  function playWin() {
    init(); resume();
    const melody = [523,659,784,1047,1319,1568,2093];
    melody.forEach((f, i) => {
      tone(f, 'sine', 0.16, 0.01, 0.1, 0.5, i * 0.065);
      tone(f * 1.5, 'triangle', 0.06, 0.01, 0.06, 0.3, i * 0.065 + 0.02);
    });
  }

  function playLose() {
    init(); resume();
    [440, 380, 320, 260, 200].forEach((f, i) => tone(f, 'sawtooth', 0.09, 0.01, 0.08, 0.25, i * 0.09));
  }

  function playLevelStart() {
    init(); resume();
    chord([261.63, 329.63, 392.00], 'sine', 0.1, 0.02, 0.1, 0.5);
    tone(523.25, 'triangle', 0.08, 0.01, 0.05, 0.4, 0.1);
  }

  function playPowerup() {
    init(); resume();
    [600,800,1100,1600].forEach((f,i)=>tone(f,'triangle',0.12,0.005,0.04,0.2,i*0.03));
  }

  return {
    init, resume, setEnabled,
    playMatch, playCombo, playSwap, playInvalid, playSelect,
    playSpecial, playWin, playLose, playLevelStart, playPowerup,
  };
})();
