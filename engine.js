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
      debut: Date.now(),    // début réel de la partie (null : inconnu, partie antérieure au rapport)
      chrono: [],           // chronologie complète des actions et jalons, sans limite (rapport, épilogue)
      coMin: 100,           // Consentement le plus bas atteint
      horsLigne: 0,         // secondes passées hors ligne ou onglet caché
      versions: [],         // versions du jeu sur lesquelles la partie a été jouée
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

  // Chronologie complète pour le rapport de session et l'épilogue : pas de limite, contrairement au journal.
  function trace(s, type, data) {
    s.chrono.push(Object.assign({ t: Math.round(s.t * 10) / 10, type }, data));
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
    trace(s, 'engage', { id });
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
      trace(s, 'coupure', { id: dep, casse: n.casse });
      ev.push({ type: 'coupure', dep, casse: n.casse });
    } else {
      const d = defs[dep], st = s.sites[dep];
      st.state = 'coupe';
      s.E -= d.E * D.COUPURE_SITE_E;
      s.X += d.deplaces;
      s.Co -= D.COUPURE_SITE_CO;
      log(s, `COUPURE — ${d.nom} à l'arrêt brutal. ${d.deplaces} personnes sans reclassement.`, 'casse');
      trace(s, 'coupure', { id: dep, casse: d.deplaces });
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
    trace(s, 'ferme', { id });
    return [{ type: 'ferme', id }];
  }

  function reconvertir(s) {
    if (s.reconv || s.deplaces <= 0) return false;
    const n = Math.min(D.RECONV.batch, s.deplaces);
    s.deplaces -= n;
    s.reconv = { n, progress: 0 };
    s.Co -= D.RECONV.co;
    trace(s, 'reconversion', { n });
    return true;
  }

  function relancer(s, auto) {
    if (relanceActive(s)) return null;
    s.relanceUntil = s.t + D.RELANCE.dur;
    if (auto) { s.relancesAuto++; s.autoRelanceAt = s.t; log(s, 'Le Conseil a relancé la croissance sans vous.', 'casse'); }
    else { s.relances++; log(s, 'Relance.', 'relance'); }
    s.plancher = Math.round(s.plancher * D.RELANCE.plancherMul);
    s.Co = Math.min(100, s.Co + D.RELANCE.co);
    trace(s, 'relance', { auto: !!auto });
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
    if (s.Co < s.coMin) s.coMin = s.Co;

    // Quelqu'un d'autre appuie sur le bouton
    if (s.Co < D.RELANCE.autoSeuil && !rel && s.t - s.autoRelanceAt > D.RELANCE.autoCooldown) {
      const r = relancer(s, true); if (r) ev.push(r);
    }

    // Stabilisation : la première fois que le nombre cesse de monter
    if (s.ms.stabilise === null && gEff(s) <= 0) {
      s.ms.stabilise = s.t;
      s.paused = D.PAUSE_STABILISE;
      log(s, 'Le nombre a cessé de monter.', 'jalon');
      trace(s, 'stabilise');
      ev.push({ type: 'stabilise' });
    }
    // Perte d'un chiffre : floor(log10(E)) comparé d'un tick à l'autre
    const dg = digitsOf(s.E);
    if (dg < s.digitsMin) {
      s.digitsMin = dg;
      if (s.ms.chiffre === null) s.ms.chiffre = s.t;
      s.paused = D.PAUSE_CHIFFRE;
      log(s, `Un chiffre perdu. ${dg} chiffres restent.`, 'jalon');
      trace(s, 'chiffre', { digits: dg });
      ev.push({ type: 'chiffre', digits: dg });
    }
    s.digits = dg;

    if (s.ms.fin === null && D.sites.every(d => d.mesure || s.sites[d.id].state === 'eteint' || s.sites[d.id].state === 'coupe')) {
      s.ms.fin = s.t;
      log(s, 'Plus rien à démanteler sur cette carte.', 'jalon');
      trace(s, 'fin');
      ev.push({ type: 'fin' });
    }
    return ev;
  }

  // Hors-ligne : seule la régénération avance (plafond 12 h), et le Consentement dérive.
  // Sert aussi au temps passé onglet caché : la partie ne tourne pas pendant ce temps.
  function applyOffline(s, elapsed) {
    elapsed = Math.max(0, elapsed || 0);
    s.horsLigne = (s.horsLigne || 0) + elapsed;
    if (elapsed >= 30) trace(s, 'absence', { duree: Math.round(elapsed) });
    elapsed = Math.min(elapsed, D.OFFLINE_CAP);
    if (elapsed < 5) return null;
    const T0 = T(s);
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'eteint' && st.regen < 1) st.regen = Math.min(1, st.regen + elapsed / d.regen);
    }
    s.Co += Math.sign(D.CO_EQ - s.Co) * Math.min(Math.abs(D.CO_EQ - s.Co), D.CO_DRIFT * elapsed);
    const dT = T(s) - T0;
    if (dT >= 0.05) log(s, `Pendant votre absence (${fmtDur(elapsed)}), la terre a regagné ${dT.toFixed(1).replace('.', ',')} point${dT >= 2 ? 's' : ''}.`, 'ok');
    return { elapsed, dT };
  }

  // --- sauvegarde ---
  // Réconcilie un état enregistré avec les données actuelles : les sites ajoutés depuis la sauvegarde
  // partent de leur état initial, les sites retirés sont ignorés, les champs nouveaux prennent leur
  // valeur par défaut. Renvoie null si la sauvegarde est illisible.
  const ETATS_SITE = ['actif', 'chantier', 'eteint', 'coupe', 'fait'];
  const ETATS_HOPITAL = ['alimente', 'coupe', 'autonome'];
  function migrer(save) {
    if (!save || typeof save !== 'object' || save.v !== 1) return null;
    if (!save.sites || typeof save.sites !== 'object' || !(Number.isFinite(save.E) && save.E > 0)) return null;
    const s = create();
    for (const k of Object.keys(s)) {
      if (k === 'sites' || k === 'ms' || !(k in save)) continue;
      const attendu = s[k] === null ? 'object' : typeof s[k];
      if (save[k] !== null && typeof save[k] !== attendu) continue;   // type inattendu : valeur par défaut
      if (Array.isArray(s[k]) && !Array.isArray(save[k])) continue;
      s[k] = save[k];
    }
    if (save.ms && typeof save.ms === 'object') {
      for (const k of Object.keys(s.ms)) if (Number.isFinite(save.ms[k])) s.ms[k] = save.ms[k];
    }
    for (const id of Object.keys(s.sites)) {
      const st = save.sites[id];
      if (st && ETATS_SITE.includes(st.state)) {
        s.sites[id] = { state: st.state, progress: Number(st.progress) || 0, regen: Number(st.regen) || 0 };
      }
    }
    if (!ETATS_HOPITAL.includes(s.hopital)) s.hopital = 'alimente';
    // Mains engagées : recalculées d'après les chantiers en cours et leurs coûts actuels.
    s.Meng = D.sites.reduce((a, d) => a + (s.sites[d.id].state === 'chantier' ? d.M : 0), 0);
    if (!('coMin' in save)) s.coMin = s.Co;
    if (!('debut' in save)) s.debut = null;
    return s;
  }

  // --- rapport de session (playtests) ---
  const LIMITE_RELANCES = 20 * 60;   // le test secondaire du §14 compte les relances des 20 premières minutes
  function nomDe(id) { return (defs[id] || noeuds[id] || { nom: id }).nom; }

  function rapport(s, version) {
    const relancesJoueur = s.chrono.filter(e => e.type === 'relance' && !e.auto);
    return {
      version: version || null,
      versions: s.versions,
      debut: s.debut ? new Date(s.debut).toISOString() : null,
      chronologieComplete: s.debut !== null,
      tempsJeu: Math.round(s.t),
      horsLigne: Math.round(s.horsLigne || 0),
      stabilisation: s.ms.stabilise,
      premierChiffre: s.ms.chiffre,
      carteVidee: s.ms.fin,
      relances20min: relancesJoueur.filter(e => e.t <= LIMITE_RELANCES).length,
      relances: s.relances,
      relancesConseil: s.relancesAuto,
      coupures: s.chrono.filter(e => e.type === 'coupure').length,
      casse: s.X,
      consentementMin: Math.round(s.coMin),
      empreinte: Math.round(s.E),
      chiffres: s.digits,
      terreRendue: Math.round(T(s) * 10) / 10,
      plancher: s.plancher,
      chrono: s.chrono,
    };
  }

  function ligneChrono(e) {
    switch (e.type) {
      case 'engage': return `Chantier ouvert : ${nomDe(e.id)}`;
      case 'ferme': return `${defs[e.id] && defs[e.id].mesure ? 'Fait' : 'Fermé'} : ${nomDe(e.id)}`;
      case 'coupure': return `Coupure : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'reconversion': return `Reconversion de ${fmt(e.n)} personnes`;
      case 'relance': return e.auto ? 'Relance par le Conseil, sans le joueur' : 'Relance';
      case 'stabilise': return 'Le nombre a cessé de monter';
      case 'chiffre': return `Chiffre perdu, ${e.digits} chiffres restent`;
      case 'fin': return 'Plus rien à démanteler sur cette carte';
      case 'absence': return `Absence de ${fmtDur(e.duree)}`;
      default: return e.type;
    }
  }

  // Texte à copier : un résumé lisible, la chronologie, puis les données brutes en JSON.
  function rapportTexte(s, version) {
    const r = rapport(s, version);
    const quand = (sec) => sec === null ? 'pas encore' : fmtDur(sec);
    const pad = (n) => String(n).padStart(2, '0');
    let debut = 'date inconnue';
    if (s.debut) { const d = new Date(s.debut); debut = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} à ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    const autres = r.versions.filter(v => v !== r.version);
    const lignes = [
      'Décroissance, rapport de session',
      `Version ${r.version || 'inconnue'}${autres.length ? `, partie commencée en ${autres[0]}` : ''}`,
      `Partie commencée le ${debut}, temps de jeu ${fmtDur(r.tempsJeu)}, hors ligne ${fmtDur(r.horsLigne)}`,
      '',
      `- Le nombre a cessé de monter : ${quand(r.stabilisation)}`,
      `- Premier chiffre perdu : ${quand(r.premierChiffre)}`,
      `- Relances dans les 20 premières minutes : ${r.relances20min}`,
      `- Relances au total : ${r.relances}, plus ${r.relancesConseil} par le Conseil`,
      `- Coupures : ${r.coupures}, Casse : ${fmt(r.casse)} personne${r.casse > 1 ? 's' : ''}`,
      `- Consentement minimum : ${r.consentementMin} %`,
      `- Empreinte : ${fmt(r.empreinte)}`,
      `- Terre rendue : ${String(r.terreRendue).replace('.', ',')} %`,
      `- Plancher irréductible : ${fmt(r.plancher)}`,
      `- Carte vidée : ${quand(r.carteVidee)}`,
    ];
    if (!r.chronologieComplete) lignes.push('- Partie commencée avant le rapport : chronologie incomplète');
    lignes.push('', 'Chronologie', '```');
    for (const e of r.chrono) lignes.push(`${fmtDur(e.t).padStart(11)}  ${ligneChrono(e)}`);
    if (!r.chrono.length) lignes.push('(vide)');
    lignes.push('```', '', '```json');
    const champs = Object.entries(r).filter(([k]) => k !== 'chrono').map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    champs.push(`  "chrono": [${r.chrono.length ? '\n' + r.chrono.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ' : ''}]`);
    lignes.push(`{\n${champs.join(',\n')}\n}`, '```');
    return lignes.join('\n');
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
    fmt, fmtDur, fmtSci, migrer, rapport, rapportTexte,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
