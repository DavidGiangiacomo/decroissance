// Décroissance — son en couches, synthétisé (aucun asset).
// Deux couches industrielles (trafic, turbines), deux naturelles (vent, oiseaux).
// Le volume de chaque couche est piloté par l'état du jeu, crossfade lent.
(function (root) {
  const FADE = 3.5;
  class Son {
    constructor() { this.ctx = null; this.couches = {}; this.master = null; this.mute = false; this.niveaux = {}; this._oiseauxTimer = null; }

    init() {
      if (this.ctx) return;
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return;
      const ctx = this.ctx = new C();
      this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
      this.couches.trafic = this._trafic();
      this.couches.turbines = this._turbines();
      this.couches.vent = this._vent();
      this.couches.oiseaux = this._oiseaux();
      for (const k in this.couches) this.couches[k].gain.gain.value = 0;
      if (ctx.state === 'suspended') ctx.resume();
    }

    _bruit(sec, brun) {
      const ctx = this.ctx, n = Math.floor(sec * ctx.sampleRate);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (brun) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.start();
      return src;
    }

    _trafic() { // rumeur de trafic : bruit brun, passe-bas, ondulation lente
      const ctx = this.ctx, gain = ctx.createGain();
      const src = this._bruit(4, true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
      const lfoG = ctx.createGain(); lfoG.gain.value = 90; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
      const pre = ctx.createGain(); pre.gain.value = 0.55;
      src.connect(lp); lp.connect(pre); pre.connect(gain); gain.connect(this.master);
      return { gain };
    }

    _turbines() { // bourdon de turbines : deux dents de scie qui battent + fondamentale
      const ctx = this.ctx, gain = ctx.createGain();
      const pre = ctx.createGain(); pre.gain.value = 0.045;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      for (const f of [55, 55.5, 110.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
      const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = 82.4; const sg = ctx.createGain(); sg.gain.value = 0.6; s.connect(sg); sg.connect(lp); s.start();
      lp.connect(pre); pre.connect(gain); gain.connect(this.master);
      return { gain };
    }

    _vent() { // vent : bruit blanc en passe-bande, souffle irrégulier
      const ctx = this.ctx, gain = ctx.createGain();
      const src = this._bruit(5, false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.45;
      const amp = ctx.createGain(); amp.gain.value = 0.10;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(amp.gain); lfo.start();
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.023; const lg2 = ctx.createGain(); lg2.gain.value = 260; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
      src.connect(bp); bp.connect(amp); amp.connect(gain); gain.connect(this.master);
      return { gain };
    }

    _oiseaux() { // oiseaux : petits glissandos aléatoires
      const ctx = this.ctx, gain = ctx.createGain(); gain.connect(this.master);
      const chirp = () => {
        if (!this.ctx) return;
        const t0 = ctx.currentTime;
        const n = 1 + Math.floor(Math.random() * 4);
        const base = 2200 + Math.random() * 1800;
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator(); o.type = 'sine';
          const g = ctx.createGain(); g.gain.value = 0;
          const t = t0 + i * (0.09 + Math.random() * 0.08);
          o.frequency.setValueAtTime(base + Math.random() * 400, t);
          o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.06);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.12);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.13);
          o.connect(g); g.connect(gain); o.start(t); o.stop(t + 0.16);
        }
        this._oiseauxTimer = setTimeout(chirp, 700 + Math.random() * 3200);
      };
      chirp();
      return { gain };
    }

    // Niveaux cibles des couches selon l'état
    applique(niv, fade) {
      if (!this.ctx) return;
      this.niveaux = niv;
      const t = this.ctx.currentTime;
      for (const k in this.couches) {
        const g = this.couches[k].gain.gain;
        const v = this.mute ? 0 : (niv[k] || 0);
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + (fade == null ? FADE : fade));
      }
    }
    setMute(m) { this.mute = m; this.applique(this.niveaux, 0.4); }

    // Ponctuel : la perte d'un chiffre — un coup sourd, bas, qui s'éteint lentement
    chute() {
      if (!this.ctx || this.mute) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.4);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 2.6);
    }
    // Ponctuel : coupure — un claquement sec puis une alarme brève
    coupure() {
      if (!this.ctx || this.mute) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = this._bruit(0.3, false); const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      src.connect(g); g.connect(this.master); src.stop(t + 0.3);
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 880; const og = ctx.createGain();
        const a = t + 0.4 + i * 0.5; og.gain.setValueAtTime(0, a); og.gain.linearRampToValueAtTime(0.05, a + 0.02); og.gain.linearRampToValueAtTime(0, a + 0.28);
        o.connect(og); og.connect(this.master); o.start(a); o.stop(a + 0.3);
      }
    }
    // Ponctuel : le silence de la stabilisation — tout baisse 3 s, puis revient
    silence(sec) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, g = this.master.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.25, t + 0.6); g.setValueAtTime(0.25, t + sec - 0.8); g.linearRampToValueAtTime(0.9, t + sec + 1.5);
    }
  }
  root.Son = Son;
})(window);
