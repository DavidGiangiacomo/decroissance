// Décroissance — MVP acte I — moteur (pur, sans DOM ; utilisable en node pour les simulations)
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DATA;

  const defs = {};
  for (const s of D.sites) defs[s.id] = s;
  const noeuds = {};
  for (const n of D.noeuds) noeuds[n.id] = n;

  function create() {
    const s = {
      v: 1,
      t: 0,                 // secondes de jeu (le hors-ligne n'avance pas t)
      E: D.E0,
      K: 0,
      M: 0,                 // Mains disponibles
      Meng: 0,              // Mains engagées sur des chantiers
      deplaces: 0,          // personnes à reconvertir
      Co: 100,
      X: 0,                 // Casse, en gens, irréversible
      sites: {},            // id -> { state: actif|chantier|eteint|coupe, progress, regen }
      hopital: 'alimente',  // alimente | coupe | autonome
      reconv: null,         // { n, progress }
      relanceUntil: -1,
      relances: 0,
      relancesAuto: 0,
      autoRelanceAt: -1e9,
      plancher: D.PLANCHER0,
      digits: 10,
      digitsMin: 10,
      ms: { stabilise: null, chiffre: null, coupure: null, fin: null },
      paused: 0,
      log: [],
      savedAt: Date.now(),
      started: false,
      son: true,
    };
    for (const d of D.sites) s.sites[d.id] = { state: 'actif', progress: 0, regen: 0 };
    return s;
  }

  const digitsOf = (E) => String(Math.floor(Math.max(1, E))).length;
  const relanceActive = (s) => s.t < s.relanceUntil;

  function gSites(s) {
    let g = 0;
    for (const d of D.sites) if (s.sites[d.id].state === 'actif') g += d.g;
    return g;
  }
  const gEff = (s) => gSites(s) + (relanceActive(s) ? D.RELANCE.g : 0);
  const kRate = (s) => D.K0 * Math.pow(s.E / D.E0, D.KEXP) * (relanceActive(s) ? D.RELANCE.kMul : 1);

  function T(s) {
    let t = 0;
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'eteint') t += d.T * st.regen;
    }
    return t;
  }
  const Tmax = () => D.sites.reduce((a, d) => a + d.T, 0);

  function chantiersActifs(s) {
    let n = 0;
    for (const id in s.sites) if (s.sites[id].state === 'chantier') n++;
    return n;
  }

  // --- graphe ---
  function alimentants(id) { return D.liens.filter(l => l.to === id).map(l => l.from); }
  function dependants(id) { return D.liens.filter(l => l.from === id).map(l => l.to); }
  function estAlimente(s, id, sauf) {
    if (id === 'hopital' && s.hopital === 'autonome') return true;
    return alimentants(id).some(f => f !== sauf && s.sites[f].state === 'actif');
  }
  // Dépendants qui seraient coupés si `id` s'arrêtait maintenant
  function coupuresSi(s, id) {
    const out = [];
    for (const dep of dependants(id)) {
      const vivant = dep === 'hopital' ? s.hopital === 'alimente' : s.sites[dep].state === 'actif';
      if (vivant && !estAlimente(s, dep, id)) out.push(dep);
    }
    return out;
  }

  function log(s, msg, kind) {
    s.log.push({ t: Math.floor(s.t), msg, kind: kind || '' });
    if (s.log.length > 200) s.log.shift();
  }

  function canEngage(s, id) {
    const d = defs[id], st = s.sites[id];
    const raisons = [];
    if (!d) return { ok: false, raisons: ['inconnu'] };
    if (st.state !== 'actif') return { ok: false, raisons: [st.state] };
    if (d.mesure && id === 'autonomie' && s.hopital === 'autonome') return { ok: false, raisons: ['déjà fait'] };
    if (s.K < d.K) raisons.push(`Capacité ${Math.floor(s.K)}/${d.K}`);
    if (s.M < d.M) raisons.push(`Mains ${s.M}/${d.M}`);
    return { ok: raisons.length === 0, raisons, coupures: coupuresSi(s, id) };
  }

  function engage(s, id) {
    const c = canEngage(s, id);
    if (!c.ok) return [];
    const d = defs[id], st = s.sites[id];
    const ev = [];
    s.K -= d.K;
    s.M -= d.M; s.Meng += d.M;
    st.state = 'chantier'; st.progress = 0;
    log(s, `Chantier ouvert : ${d.nom}.`, 'chantier');
    ev.push({ type: 'engage', id });
    // Le site s'arrête à l'ouverture du chantier : ce qu'il alimentait est coupé si rien d'autre ne l'alimente.
    for (const dep of c.coupures) ev.push(...coupure(s, id, dep));
    return ev;
  }

  function coupure(s, feeder, dep) {
    const ev = [];
    if (dep === 'hopital') {
      const n = noeuds.hopital;
      s.hopital = 'coupe';
      s.X += n.casse;
      s.Co -= n.co;
      log(s, `COUPURE — ${n.nom} sans électricité. ${n.casse} personnes.`, 'casse');
      ev.push({ type: 'coupure', dep, casse: n.casse });
    } else {
      const d = defs[dep], st = s.sites[dep];
      st.state = 'coupe';
      s.E -= d.E * D.COUPURE_SITE_E;
      s.X += d.deplaces;
      s.Co -= D.COUPURE_SITE_CO;
      log(s, `COUPURE — ${d.nom} à l'arrêt brutal. ${d.deplaces} personnes sans reclassement.`, 'casse');
      ev.push({ type: 'coupure', dep, casse: d.deplaces });
    }
    if (s.ms.coupure === null) s.ms.coupure = s.t;
    return ev;
  }

  function close(s, id) {
    const d = defs[id], st = s.sites[id];
    st.state = d.mesure ? 'fait' : 'eteint';
    st.progress = 1;
    s.E -= d.E;
    s.K = Math.min(D.KCAP, s.K + d.kBack);
    s.M += d.M; s.Meng -= d.M;
    s.deplaces += d.deplaces;
    s.Co -= d.co;
    if (id === 'autonomie') {
      s.hopital = 'autonome';
      log(s, `${d.nom} : l'hôpital ne dépend plus des centrales.`, 'ok');
    } else {
      log(s, `Fermé : ${d.nom}. Empreinte −${fmt(d.E)}${d.deplaces ? `, ${d.deplaces} personnes à reconvertir` : ''}.`, 'ok');
    }
    return [{ type: 'ferme', id }];
  }

  function reconvertir(s) {
    if (s.reconv || s.deplaces <= 0) return false;
    const n = Math.min(D.RECONV.batch, s.deplaces);
    s.deplaces -= n;
    s.reconv = { n, progress: 0 };
    s.Co -= D.RECONV.co;
    return true;
  }

  function relancer(s, auto) {
    if (relanceActive(s)) return null;
    s.relanceUntil = s.t + D.RELANCE.dur;
    if (auto) { s.relancesAuto++; s.autoRelanceAt = s.t; log(s, 'Le Conseil a relancé la croissance sans vous.', 'casse'); }
    else { s.relances++; log(s, 'Relance.', 'relance'); }
    s.plancher = Math.round(s.plancher * D.RELANCE.plancherMul);
    s.Co = Math.min(100, s.Co + D.RELANCE.co);
    return { type: 'relance', auto: !!auto };
  }

  function tick(s, dt) {
    const ev = [];
    if (s.paused > 0) { s.paused -= dt; return ev; }
    s.t += dt;
    const rel = relanceActive(s);
    const g = gEff(s);
    if (g !== 0) s.E *= Math.exp((g / 100 / 60) * dt);
    s.K = Math.min(D.KCAP, s.K + kRate(s) * dt);

    const speed = rel ? D.RELANCE.speedMul : 1;
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'chantier') {
        st.progress += (dt * speed) / d.dur;
        if (st.progress >= 1) ev.push(...close(s, d.id));
      } else if (st.state === 'eteint' && st.regen < 1) {
        st.regen = Math.min(1, st.regen + dt / d.regen);
      }
    }
    if (s.reconv) {
      s.reconv.progress += dt / D.RECONV.dur;
      if (s.reconv.progress >= 1) {
        s.M += s.reconv.n;
        log(s, `${s.reconv.n} personnes reconverties.`, 'ok');
        ev.push({ type: 'reconv', n: s.reconv.n });
        s.reconv = null;
      }
    }
    // Consentement : dérive vers l'équilibre, usure si l'on empile les chantiers
    const n = chantiersActifs(s);
    if (n > 1) s.Co -= D.CO_HATE * (n - 1) * dt;
    s.Co += Math.sign(D.CO_EQ - s.Co) * Math.min(Math.abs(D.CO_EQ - s.Co), D.CO_DRIFT * dt);
    s.Co = Math.max(0, Math.min(100, s.Co));

    // Quelqu'un d'autre appuie sur le bouton
    if (s.Co < D.RELANCE.autoSeuil && !rel && s.t - s.autoRelanceAt > D.RELANCE.autoCooldown) {
      const r = relancer(s, true); if (r) ev.push(r);
    }

    // Stabilisation : la première fois que le nombre cesse de monter
    if (s.ms.stabilise === null && gEff(s) <= 0) {
      s.ms.stabilise = s.t;
      s.paused = D.PAUSE_STABILISE;
      log(s, 'Le nombre a cessé de monter.', 'jalon');
      ev.push({ type: 'stabilise' });
    }
    // Perte d'un chiffre : floor(log10(E)) comparé d'un tick à l'autre
    const dg = digitsOf(s.E);
    if (dg < s.digitsMin) {
      s.digitsMin = dg;
      if (s.ms.chiffre === null) s.ms.chiffre = s.t;
      s.paused = D.PAUSE_CHIFFRE;
      log(s, `Un chiffre perdu. ${dg} chiffres restent.`, 'jalon');
      ev.push({ type: 'chiffre', digits: dg });
    }
    s.digits = dg;

    if (s.ms.fin === null && D.sites.every(d => d.mesure || s.sites[d.id].state === 'eteint' || s.sites[d.id].state === 'coupe')) {
      s.ms.fin = s.t;
      log(s, 'Plus rien à démanteler sur cette carte.', 'jalon');
      ev.push({ type: 'fin' });
    }
    return ev;
  }

  // Hors-ligne : seule la régénération avance (plafond 12 h), et le Consentement dérive.
  function applyOffline(s, elapsed) {
    elapsed = Math.max(0, Math.min(elapsed, D.OFFLINE_CAP));
    if (elapsed < 5) return null;
    const T0 = T(s);
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'eteint' && st.regen < 1) st.regen = Math.min(1, st.regen + elapsed / d.regen);
    }
    s.Co += Math.sign(D.CO_EQ - s.Co) * Math.min(Math.abs(D.CO_EQ - s.Co), D.CO_DRIFT * elapsed);
    const dT = T(s) - T0;
    if (dT > 0.005) log(s, `Pendant votre absence (${fmtDur(elapsed)}), la terre a regagné ${dT.toFixed(1).replace('.', ',')} point${dT >= 2 ? 's' : ''}.`, 'ok');
    return { elapsed, dT };
  }

  // --- formats ---
  const NBSP = ' ';
  function fmt(n) {
    n = Math.floor(Math.abs(n));
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }
  function fmtDur(sec) {
    sec = Math.floor(sec);
    if (sec < 60) return `${sec} s`;
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return `${m} min${s ? ` ${String(s).padStart(2, '0')} s` : ''}`;
    const h = Math.floor(m / 60);
    return `${h} h ${String(m % 60).padStart(2, '0')}`;
  }
  function fmtSci(n) {
    const e = Math.floor(Math.log10(n));
    const m = n / Math.pow(10, e);
    return `${m.toFixed(2).replace('.', ',')}·10${sup(e)}`;
  }
  function sup(n) {
    const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(c => map[c] || c).join('');
  }

  const Engine = {
    D, defs, noeuds, create, tick, engage, canEngage, coupuresSi, reconvertir, relancer, applyOffline,
    gSites, gEff, kRate, relanceActive, T, Tmax, chantiersActifs, digitsOf, alimentants, dependants, estAlimente,
    fmt, fmtDur, fmtSci,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
