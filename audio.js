// Décroissance — son en couches, synthétisé (aucun asset).
// Acte I : deux couches industrielles (trafic, turbines), deux naturelles (vent, oiseaux).
// Acte II : le bourdonnement du réseau, puis la rivière au deuxième chiffre perdu.
// Acte III : le fret (camions, port), puis les insectes au troisième chiffre perdu et les voix au quatrième.
// Le volume de chaque couche est piloté par l'état du jeu, crossfade lent.
(function (root) {
  const FADE = 3.5;
  class Son {
    constructor() { this.ctx = null; this.couches = {}; this.master = null; this.mute = false; this.niveaux = {}; this._oiseauxTimer = null; this._fretTimer = null; }

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
      this.couches.reseau = this._reseau();
      this.couches.eau = this._eau();
      this.couches.fret = this._fret();
      this.couches.insectes = this._insectes();
      this.couches.voix = this._voix();
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

    _reseau() { // bourdonnement du réseau : 50 Hz et ses harmoniques, comme un transformateur
      const ctx = this.ctx, gain = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const pre = ctx.createGain(); pre.gain.value = 0.05;
      for (const [f, a] of [[50, 1], [100, 0.8], [150, 0.35], [250, 0.15]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(lp); o.start();
      }
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3;
      const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(pre.gain); lfo.start();
      lp.connect(pre); pre.connect(gain); gain.connect(this.master);
      return { gain };
    }

    _eau() { // rivière : bruit en bande médium, débit qui ondule lentement
      const ctx = this.ctx, gain = ctx.createGain();
      const src = this._bruit(6, false);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
      const amp = ctx.createGain(); amp.gain.value = 0.07;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
      const lg = ctx.createGain(); lg.gain.value = 0.025; lfo.connect(lg); lg.connect(amp.gain); lfo.start();
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05;
      const lg2 = ctx.createGain(); lg2.gain.value = 300; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
      src.connect(hp); hp.connect(bp); bp.connect(amp); amp.connect(gain); gain.connect(this.master);
      return { gain };
    }

    _fret() { // fret : grondement de poids lourds, avertisseur de recul, corne de navire au loin
      const ctx = this.ctx, gain = ctx.createGain(); gain.connect(this.master);
      const src = this._bruit(4, true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
      const amp = ctx.createGain(); amp.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
      const lg = ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(amp.gain); lfo.start();
      src.connect(lp); lp.connect(amp); amp.connect(gain);
      const signal = () => {
        if (!this.ctx) return;
        const t0 = ctx.currentTime;
        if (Math.random() < 0.35) {   // corne de navire : deux notes graves, longues
          for (const f of [98, 123.5]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
            const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 400;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.035, t0 + 0.3); g.gain.setValueAtTime(0.035, t0 + 1.6); g.gain.linearRampToValueAtTime(0, t0 + 2.2);
            o.connect(flt); flt.connect(g); g.connect(gain); o.start(t0); o.stop(t0 + 2.3);
          }
        } else {   // avertisseur de recul : trois bips
          for (let i = 0; i < 3; i++) {
            const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1150;
            const g = ctx.createGain(), a = t0 + i * 0.9;
            g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.012, a + 0.02); g.gain.setValueAtTime(0.012, a + 0.4); g.gain.linearRampToValueAtTime(0, a + 0.45);
            o.connect(g); g.connect(gain); o.start(a); o.stop(a + 0.5);
          }
        }
        this._fretTimer = setTimeout(signal, 7000 + Math.random() * 12000);
      };
      this._fretTimer = setTimeout(signal, 3000);
      return { gain };
    }

    _insectes() { // grillons : des notes aiguës hachées en trilles, par bouffées
      const ctx = this.ctx, gain = ctx.createGain(); gain.connect(this.master);
      for (const [f, rythme, decalage] of [[4300, 2.1, 0], [4720, 2.6, 0.3], [3950, 1.7, 0.6]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const trille = ctx.createGain(); trille.gain.value = 0.5;   // 0,5 ± 0,5 : la note s'allume et s'éteint
        const tr = ctx.createOscillator(); tr.type = 'square'; tr.frequency.value = 28 + Math.random() * 6;
        const trg = ctx.createGain(); trg.gain.value = 0.5; tr.connect(trg); trg.connect(trille.gain);
        const bouffee = ctx.createGain(); bouffee.gain.value = 0.5;
        const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = rythme;
        const bg = ctx.createGain(); bg.gain.value = 0.5; b.connect(bg); bg.connect(bouffee.gain);
        const out = ctx.createGain(); out.gain.value = 0.012;
        o.connect(trille); trille.connect(bouffee); bouffee.connect(out); out.connect(gain);
        o.start(); tr.start(); b.start(ctx.currentTime + decalage);
      }
      return { gain };
    }

    _voix() { // voix au loin : un murmure de marché, des formants qui vont et viennent
      const ctx = this.ctx, gain = ctx.createGain(); gain.connect(this.master);
      const src = this._bruit(6, false);
      for (const [f, q, rythme, a] of [[420, 6, 0.9, 0.5], [800, 5, 1.3, 0.35], [1350, 7, 1.7, 0.25], [2500, 8, 2.3, 0.15]]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const amp = ctx.createGain(); amp.gain.value = a * 0.05;
        const lfo = ctx.createOscillator(); lfo.frequency.value = rythme;
        const lg = ctx.createGain(); lg.gain.value = a * 0.04; lfo.connect(lg); lg.connect(amp.gain); lfo.start();
        const lfo2 = ctx.createOscillator(); lfo2.frequency.value = rythme * 0.37;
        const lg2 = ctx.createGain(); lg2.gain.value = f * 0.12; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
        src.connect(bp); bp.connect(amp); amp.connect(gain);
      }
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
    // Ponctuel : une région s'éteint — le bourdonnement descend et s'éteint lentement
    extinction() {
      if (!this.ctx || this.mute) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + 3.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0005, t + 3.8);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 4);
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
