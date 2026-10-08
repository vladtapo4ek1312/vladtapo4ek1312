'use strict';
// ============================================================
//  Звук: синтезированные эффекты и простая фоновая музыка
// ============================================================

const MIDI = n => 440 * Math.pow(2, (n - 69) / 12);
const _ = null;
const MUSIC = {
  menu: {
    bpm: 64, wave: 'sine', bassVol: 0.12,
    bass: [45, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _, 40, _, _, _, _, _, _, _],
    lead: [69, _, 72, _, 76, _, 72, _, 69, _, 72, _, 77, _, 72, _, 67, _, 71, _, 74, _, 71, _, 68, _, 71, _, 76, _, 71, _],
  },
  1: {
    bpm: 74, wave: 'triangle',
    bass: [45, _, 52, _, 45, _, 48, _, 41, _, 48, _, 43, _, 50, _],
    lead: [76, _, _, _, 72, _, _, 74, _, _, 71, _, _, _, 69, _, 72, _, _, _, 76, _, _, 77, _, _, 76, _, 74, _, 72, _],
  },
  2: {
    bpm: 82, wave: 'triangle',
    bass: [38, 45, 50, 45, 34, 41, 46, 41, 36, 43, 48, 43, 33, 40, 45, 40],
    lead: [69, _, _, _, _, _, 65, _, _, _, 67, _, _, _, 64, _, _, _, 74, _, _, _, 72, _, _, 70, _, _, 69, _, _, _],
  },
  3: {
    bpm: 66, wave: 'sawtooth', bassVol: 0.08,
    bass: [40, _, _, 41, _, _, 40, _, 43, _, _, 41, _, _, 40, _],
    lead: [71, _, 72, _, _, _, 71, _, 69, _, _, _, 67, _, 65, _, _, _, 64, _, _, _, 65, _, 67, _, _, _, _, _, _, _],
  },
  4: {
    bpm: 92, wave: 'sine', bassVol: 0.2,
    bass: [36, _, _, _, _, _, _, _, 37, _, _, _, _, _, _, _],
    kick: [1, _, 1, _, _, _, _, _, 1, _, 1, _, _, _, _, _],
    lead: [_, _, _, _, 67, _, _, _, _, _, _, _, 68, _, _, _, _, _, _, _, 63, _, _, _, _, _, _, _, 62, _, _, _],
  },
  boss: {
    bpm: 132, wave: 'sawtooth', bassVol: 0.1,
    bass: [33, 33, 45, 33, 36, 33, 38, 39, 33, 33, 45, 33, 40, 39, 38, 36],
    kick: [1, _, _, _, 1, _, _, _, 1, _, _, _, 1, _, 1, _],
    lead: [_, _, _, _, _, _, _, _, 76, _, 75, _, 72, _, _, _],
  },
  win: {
    bpm: 90, wave: 'triangle',
    bass: [48, _, 55, _, 52, _, 55, _, 53, _, 57, _, 55, _, 59, _],
    lead: [72, 76, 79, 84, _, 79, 76, _, 77, 81, 84, 89, _, 84, 79, _],
  },
};

const Sound = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null,
  muted: store('sp_muted') === '1',
  last: {},
  track: null, pendingTrack: null, step: 0, next: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = 0.3; this.mus.connect(this.master);
      const len = c.sampleRate;
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
      if (typeof Settings !== 'undefined') Settings.apply();
      if (this.pendingTrack) { const t = this.pendingTrack; this.track = null; this.music(t); }
    } catch (e) { this.ctx = null; }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    store('sp_muted', this.muted ? '1' : '0');
  },

  tone(f0, f1, dur, type = 'sine', vol = 0.2, delay = 0, out) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + Math.max(0, delay);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur, vol = 0.2, f0 = 2000, f1 = 300, delay = 0, type = 'lowpass') {
    const c = this.ctx; if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return;
    this.last[name] = now;
    switch (name) {
      case 'shoot': this.tone(560, 300, 0.08, 'sine', 0.1); this.noise(0.04, 0.04, 3000, 900); break;
      case 'splash': this.noise(0.07, 0.06, 1800, 400); break;
      case 'hit': this.tone(190, 90, 0.07, 'square', 0.05); this.noise(0.05, 0.08, 1400, 300); break;
      case 'kill': this.noise(0.28, 0.22, 900, 90); this.tone(130, 40, 0.25, 'sawtooth', 0.08); break;
      case 'hurt': this.tone(420, 120, 0.3, 'sawtooth', 0.16); this.tone(310, 90, 0.32, 'square', 0.08); break;
      case 'coin': this.tone(988, 988, 0.07, 'square', 0.07); this.tone(1319, 1319, 0.28, 'square', 0.07, 0.07); break;
      case 'heart': this.tone(440, 700, 0.16, 'sine', 0.2); this.tone(660, 990, 0.2, 'sine', 0.1, 0.06); break;
      case 'key': this.tone(1800, 1800, 0.05, 'triangle', 0.12); this.tone(2500, 2500, 0.18, 'triangle', 0.1, 0.05); break;
      case 'pickup': this.tone(260, 420, 0.12, 'square', 0.08); break;
      case 'explode': this.noise(0.9, 0.55, 1400, 50); this.tone(90, 28, 0.6, 'sine', 0.45); break;
      case 'door': this.noise(0.22, 0.2, 500, 80); this.tone(95, 55, 0.22, 'square', 0.06); break;
      case 'unlock': this.tone(900, 900, 0.06, 'square', 0.08); this.tone(600, 600, 0.12, 'square', 0.08, 0.06); this.noise(0.15, 0.12, 2000, 400, 0.05); break;
      case 'item': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.13, i * 0.09)); break;
      case 'bad': [400, 330, 260].forEach((f, i) => this.tone(f, f * 0.9, 0.25, 'sawtooth', 0.08, i * 0.12)); break;
      case 'secret': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, f, 0.4, 'sine', 0.12, i * 0.08)); break;
      case 'boss': this.tone(80, 45, 1.3, 'sawtooth', 0.22); this.noise(1.1, 0.18, 400, 60); break;
      case 'roar': this.tone(140, 60, 0.6, 'sawtooth', 0.2); this.noise(0.5, 0.2, 800, 100); break;
      case 'pill': this.tone(300, 620, 0.12, 'sine', 0.18); this.tone(620, 220, 0.18, 'sine', 0.12, 0.12); break;
      case 'laser': this.tone(1200, 300, 0.16, 'sawtooth', 0.06); break;
      case 'brim': this.tone(120, 60, 0.5, 'sawtooth', 0.18); this.noise(0.5, 0.25, 2500, 300); break;
      case 'charge': this.tone(200, 500, 0.1, 'triangle', 0.04); break;
      case 'stomp': this.noise(0.5, 0.5, 600, 40); this.tone(60, 30, 0.5, 'sine', 0.5); break;
      case 'spit': this.noise(0.25, 0.25, 1200, 200, 0, 'bandpass'); this.tone(200, 120, 0.2, 'sawtooth', 0.06); break;
      case 'eShoot': this.tone(320, 200, 0.09, 'triangle', 0.07); break;
      case 'buzz': this.tone(140, 160, 0.25, 'sawtooth', 0.04); break;
      case 'chest': this.tone(300, 300, 0.08, 'square', 0.08); this.tone(450, 450, 0.08, 'square', 0.08, 0.08); this.tone(600, 600, 0.2, 'square', 0.08, 0.16); break;
      case 'menu': this.tone(660, 660, 0.05, 'square', 0.05); break;
      case 'select': this.tone(520, 780, 0.12, 'triangle', 0.12); break;
      case 'death': [330, 262, 220, 165].forEach((f, i) => this.tone(f, f * 0.95, 0.5, 'triangle', 0.15, i * 0.22)); break;
      case 'shield': this.tone(800, 1600, 0.3, 'sine', 0.12); break;
      case 'teleport': this.tone(200, 1600, 0.35, 'sine', 0.15); this.noise(0.35, 0.1, 400, 4000, 0, 'bandpass'); break;
      case 'fire': this.noise(0.3, 0.12, 600, 3000, 0, 'bandpass'); break;
      case 'poop': this.noise(0.15, 0.2, 400, 120); break;
      case 'rock': this.noise(0.3, 0.3, 1000, 120); break;
      case 'trapdoor': this.tone(220, 110, 0.5, 'triangle', 0.15); this.noise(0.4, 0.15, 600, 100); break;
      case 'fall': this.tone(500, 80, 0.7, 'sine', 0.15); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.7, 'triangle', 0.14, i * 0.12)); break;
    }
  },

  music(track) {
    this.pendingTrack = track;
    if (!this.ctx || this.track === track) return;
    this.track = track;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.15;
  },

  updateMusic() {
    const c = this.ctx;
    if (!c || !this.track || this.muted) return;
    const m = MUSIC[this.track];
    if (!m) return;
    const sd = 60 / m.bpm / 2;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.25) {
      const d = this.next - c.currentTime;
      const i = this.step;
      const b = m.bass[i % m.bass.length];
      if (b != null) this.tone(MIDI(b), MIDI(b), sd * 1.9, m.wave || 'triangle', m.bassVol || 0.18, d, this.mus);
      const l = m.lead[i % m.lead.length];
      if (l != null) this.tone(MIDI(l), MIDI(l), sd * 3.2, 'sine', 0.085, d, this.mus);
      if (m.kick && m.kick[i % m.kick.length]) this.tone(120, 38, 0.2, 'sine', 0.35, d, this.mus);
      this.step++;
      this.next += sd;
    }
  },
};
