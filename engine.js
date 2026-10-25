// Décroissance — moteur (pur, sans DOM ; utilisable en node pour les simulations et les tests)
// Acte I : faire cesser la croissance, puis perdre un chiffre (le MVP).
// Acte II : le réseau. Production et demande électriques ; marge négative → délestage, marge positive → rebond.
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.DATA;

  const defs = {};
  for (const s of D.sites) defs[s.id] = s;
  const noeuds = {};
  for (const n of D.noeuds) noeuds[n.id] = n;
  const acteDe = (x) => x.acte || 1;
  const NOEUDS_RESEAU = D.noeuds.filter(n => acteDe(n) >= 2);
  const DERNIER_ACTE = Math.max(...D.sites.map(acteDe));

  function create() {
    const s = {
      v: 1,
      t: 0,                 // secondes de jeu (le hors-ligne n'avance pas t)
      acte: 1,
      E: D.E0,
      K: 0,
      M: 0,                 // Mains disponibles
      Meng: 0,              // Mains engagées sur des chantiers
      deplaces: 0,          // personnes à reconvertir
      Co: 100,
      X: 0,                 // Casse, en gens, irréversible
      sites: {},            // id -> { state: actif|chantier|eteint|coupe|fait, progress, regen, vite, pollue }
      hopital: 'alimente',  // acte I : alimente | coupe | autonome
      noeuds: {},           // acte II : id -> alimente | deleste | prive
      reconv: null,         // { n, progress }
      relanceUntil: -1,
      relances: 0,
      relancesAuto: 0,
      autoRelanceAt: -1e9,
      plancher: D.PLANCHER0,
      digits: 10,
      digitsMin: 10,
      ms: { stabilise: null, chiffre: null, coupure: null, fin: null, acte2: null, fin2: null },
      regionsEteintes: [],
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
    for (const d of D.sites) s.sites[d.id] = { state: 'actif', progress: 0, regen: 0, vite: false, pollue: false };
    for (const n of NOEUDS_RESEAU) s.noeuds[n.id] = 'alimente';
    return s;
  }

  const digitsOf = (E) => String(Math.floor(Math.max(1, E))).length;
  const relanceActive = (s) => s.t < s.relanceUntil;

  function gSites(s) {
    let g = 0;
    for (const d of D.sites) if (d.g && s.sites[d.id].state === 'actif') g += d.g;
    return g;
  }
  const gEff = (s) => gSites(s) + gRebond(s) + (relanceActive(s) ? D.RELANCE.g : 0);
  const kRate = (s) => D.K0 * Math.pow(s.E / D.E0, D.KEXP) * (relanceActive(s) ? D.RELANCE.kMul : 1);

  function T(s) {
    let t = 0;
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'eteint' && !st.pollue) t += d.T * st.regen;
    }
    return t;
  }
  const Tmax = () => D.sites.reduce((a, d) => a + d.T, 0);

  function chantiersActifs(s) {
    let n = 0;
    for (const id in s.sites) if (s.sites[id].state === 'chantier') n++;
    return n;
  }

  // --- graphe de l'acte I : liens un à un ---
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

  // --- réseau de l'acte II : une jauge commune ---
  const mesureFaite = (s, id) => !!s.sites[id] && s.sites[id].state === 'fait';
  // Ce dont un site ou un nœud a besoin (fioul, chlore) lui parvient-il ? `arret` : site supposé arrêté.
  function approvisionne(s, x, arret) {
    const b = x.besoin;
    if (!b) return true;
    if (b.sauf && mesureFaite(s, b.sauf)) return true;
    return b.de !== arret && s.sites[b.de].state === 'actif';
  }
  // Un site de l'acte II tourne-t-il, et donc produit ou consomme ?
  function tourne(s, d, arret) {
    return d.id !== arret && s.sites[d.id].state === 'actif' && approvisionne(s, d, arret);
  }
  function demandeNoeud(s, n) {
    if (!n.cons) return 0;
    return n.cons * (n.type === 'ville' && mesureFaite(s, 'sobriete') ? D.SOBRIETE : 1);
  }
  const noeudConsomme = (s, n, arret) => !!n.cons && s.noeuds[n.id] === 'alimente' && approvisionne(s, n, arret);

  // Bilan du réseau : production, demande, marge. `arret` simule le lancement d'un chantier sur ce site.
  function bilan(s, arret) {
    if (s.acte < 2) return null;
    let prod = 0, dem = 0, prodFossile = 0;
    for (const d of D.sites) {
      if (acteDe(d) < 2 || !tourne(s, d, arret)) continue;
      if (d.prod) { prod += d.prod; prodFossile += d.prod; }
      if (d.cons) dem += d.cons;
    }
    for (const n of NOEUDS_RESEAU) {
      if (n.prod) prod += n.prod;
      if (noeudConsomme(s, n, arret)) dem += demandeNoeud(s, n);
    }
    return { prod, dem, marge: prod - dem, prodFossile };
  }

  // Rebond : l'électricité en trop relance la croissance, en proportion de la marge.
  function gRebond(s) {
    if (s.acte < 2) return 0;
    const b = bilan(s);
    return b.marge > 0 && b.prod > 0 ? D.REBOND * b.marge / b.prod : 0;
  }

  // Consommateurs à délester, dans l'ordre affiché, pour ramener la marge à zéro ou au-dessus.
  function planDelestage(s, marge, arret) {
    const plan = [];
    for (const cat of D.DELESTAGE) {
      for (const d of D.sites) {
        if (marge >= 0) return plan;
        if (acteDe(d) < 2 || d.categorie !== cat || !d.cons || !tourne(s, d, arret)) continue;
        plan.push(d.id); marge += d.cons;
      }
      for (const n of NOEUDS_RESEAU) {
        if (marge >= 0) return plan;
        if (n.categorie !== cat || !noeudConsomme(s, n, arret)) continue;
        plan.push(n.id); marge += demandeNoeud(s, n);
      }
    }
    return plan;
  }

  // Ce qu'un lancement de chantier ferait au réseau, avant de le lancer : tout se voit (R4).
  function apercu(s, id) {
    if (s.acte < 2 || acteDe(defs[id]) < 2) return null;
    const avant = bilan(s).marge;
    if (defs[id].mesure) return { avant, apres: avant, delestes: [], prives: [], arretes: [] };
    const arretes = D.sites.filter(x => acteDe(x) >= 2 && x.besoin && x.besoin.de === id && tourne(s, x)).map(x => x.id);
    const prives = NOEUDS_RESEAU.filter(n => n.besoin && s.noeuds[n.id] === 'alimente' && approvisionne(s, n) && !approvisionne(s, n, id)).map(n => n.id);
    const apres = bilan(s, id).marge;
    const delestes = planDelestage(s, apres, id);
    // En cascade : un fournisseur délesté prive aussi ceux qui dépendent de lui
    for (const n of NOEUDS_RESEAU) {
      if (!n.besoin || prives.includes(n.id) || delestes.includes(n.id) || s.noeuds[n.id] !== 'alimente') continue;
      const perdu = delestes.includes(n.besoin.de) || arretes.includes(n.besoin.de);
      if (perdu && !(n.besoin.sauf && mesureFaite(s, n.besoin.sauf))) prives.push(n.id);
    }
    return { avant, apres, delestes, prives, arretes };
  }

  function log(s, msg, kind) {
    s.log.push({ t: Math.floor(s.t), msg, kind: kind || '' });
    if (s.log.length > 200) s.log.shift();
  }

  // Chronologie complète pour le rapport de session et l'épilogue : pas de limite, contrairement au journal.
  function trace(s, type, data) {
    s.chrono.push(Object.assign({ t: Math.round(s.t * 10) / 10, type }, data));
  }

  function marquerCoupure(s) { if (s.ms.coupure === null) s.ms.coupure = s.t; }

  function delester(s, id) {
    const d = defs[id];
    if (d) {   // industrie ou commerce : arrêt brutal, comme une coupure de l'acte I
      s.sites[id].state = 'coupe';
      s.E -= d.E * D.COUPURE_SITE_E;
      s.X += d.deplaces;
      s.Co -= D.COUPURE_SITE_CO;
      log(s, `DÉLESTAGE — ${d.nom} à l'arrêt brutal. ${fmt(d.deplaces)} personnes sans reclassement.`, 'casse');
      trace(s, 'delestage', { id, casse: d.deplaces });
      marquerCoupure(s);
      return [{ type: 'delestage', id, casse: d.deplaces }];
    }
    const n = noeuds[id];
    s.noeuds[id] = 'deleste';
    s.X += n.casse;
    s.Co -= n.co;
    log(s, `DÉLESTAGE — ${n.nom} sans électricité. ${fmt(n.casse)} personnes.`, 'casse');
    trace(s, 'delestage', { id, casse: n.casse });
    marquerCoupure(s);
    return [{ type: 'delestage', id, casse: n.casse }];
  }

  function priver(s, n) {
    s.noeuds[n.id] = 'prive';
    s.X += n.casse;
    s.Co -= n.co;
    log(s, `COUPURE — ${n.nom} : plus de ${n.besoin.quoi}. ${fmt(n.casse)} personnes.`, 'casse');
    trace(s, 'privation', { id: n.id, casse: n.casse });
    marquerCoupure(s);
    return [{ type: 'privation', id: n.id, casse: n.casse }];
  }

  function rebrancher(s, n) {
    s.noeuds[n.id] = 'alimente';
    log(s, `${n.nom} est rebranché.`, 'ok');
    trace(s, 'retour', { id: n.id });
    return [{ type: 'retour', id: n.id }];
  }

  // Applique au réseau les conséquences de l'état courant : arrêts, privations, délestages, retours.
  function equilibrer(s) {
    const ev = [];
    if (s.acte < 2) return ev;
    for (const d of D.sites) {   // arrêt faute de combustible : le bilan le compte déjà, on le signale une fois
      const st = s.sites[d.id];
      if (acteDe(d) < 2 || !d.besoin || st.state !== 'actif' || st.sansApport || approvisionne(s, d)) continue;
      st.sansApport = true;
      log(s, `${d.nom} à l'arrêt, faute de ${d.besoin.quoi}.`, 'casse');
      trace(s, 'arret', { id: d.id });
      ev.push({ type: 'arret', id: d.id });
    }
    for (const n of NOEUDS_RESEAU) {   // privation : un nœud dont l'approvisionnement manque
      if (!n.besoin) continue;
      const ok = approvisionne(s, n);
      if (!ok && s.noeuds[n.id] === 'alimente') ev.push(...priver(s, n));
      else if (ok && s.noeuds[n.id] === 'prive') ev.push(...rebrancher(s, n));
    }
    let b = bilan(s);
    if (b.marge < 0) {
      for (const id of planDelestage(s, b.marge)) ev.push(...delester(s, id));
      b = bilan(s);
    }
    for (const cat of [...D.DELESTAGE].reverse()) {   // retours : les plus vitaux d'abord, si la marge le permet
      for (const n of [...NOEUDS_RESEAU].reverse()) {
        if (n.categorie !== cat || s.noeuds[n.id] !== 'deleste' || !approvisionne(s, n)) continue;
        if (b.marge - demandeNoeud(s, n) < 0) continue;
        ev.push(...rebrancher(s, n));
        b = bilan(s);
      }
    }
    return ev;
  }

  // Coût d'un chantier ; la démolition rapide coûte deux fois moins de Capacité et de Mains.
  function cout(d, vite) { return { K: vite ? Math.ceil(d.K / 2) : d.K, M: vite ? Math.ceil(d.M / 2) : d.M }; }
  const dureeChantier = (d, st) => (st && st.vite ? d.dur / 2 : d.dur);

  function canEngage(s, id, opts) {
    const d = defs[id], st = s.sites[id];
    if (!d) return { ok: false, raisons: ['inconnu'], coupures: [] };
    if (acteDe(d) > s.acte) return { ok: false, raisons: ['pas encore'], coupures: [] };
    const restes = st.state === 'coupe' && !d.mesure;   // site coupé : on démantèle ce qu'il en reste (R4)
    if (st.state !== 'actif' && !restes) return { ok: false, raisons: [st.state], coupures: [] };
    if (d.mesure && id === 'autonomie' && s.hopital === 'autonome') return { ok: false, raisons: ['déjà fait'], coupures: [] };
    const c = cout(d, !!(opts && opts.vite && d.rapide));
    const raisons = [];
    if (s.K < c.K) raisons.push(`Capacité ${Math.floor(s.K)}/${c.K}`);
    if (s.M < c.M) raisons.push(`Mains ${s.M}/${c.M}`);
    return { ok: raisons.length === 0, raisons, restes, coupures: acteDe(d) === 1 && !restes ? coupuresSi(s, id) : [], apercu: apercu(s, id) };
  }

  function engage(s, id, opts) {
    const c = canEngage(s, id, opts);
    if (!c.ok) return [];
    const d = defs[id], st = s.sites[id];
    const vite = !!(opts && opts.vite && d.rapide);
    const cc = cout(d, vite);
    s.K -= cc.K;
    s.M -= cc.M; s.Meng += cc.M;
    st.state = 'chantier'; st.progress = 0; st.vite = vite; st.mEng = cc.M; st.restes = !!c.restes;
    log(s, c.restes ? `Chantier ouvert sur les restes : ${d.nom}.` : vite ? `Démolition rapide lancée : ${d.nom}.` : `Chantier ouvert : ${d.nom}.`, 'chantier');
    trace(s, 'engage', Object.assign({ id }, vite ? { vite: true } : {}, c.restes ? { restes: true } : {}));
    const ev = [{ type: 'engage', id }];
    // Le site s'arrête à l'ouverture du chantier : ce qu'il alimentait est coupé si rien d'autre ne l'alimente.
    for (const dep of c.coupures) ev.push(...coupure(s, id, dep));
    ev.push(...equilibrer(s));
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
    marquerCoupure(s);
    return ev;
  }

  function close(s, id) {
    const d = defs[id], st = s.sites[id];
    const ev = [{ type: 'ferme', id }];
    st.state = d.mesure ? 'fait' : 'eteint';
    st.progress = 1;
    // Les restes d'un site coupé : la coupure en a déjà retiré une part, ses gens sont déjà comptés dans la Casse.
    const E0 = st.restes ? d.E * (1 - D.COUPURE_SITE_E) : d.E;
    s.E -= E0;
    s.K = Math.min(D.KCAP, s.K + d.kBack);
    const mEng = Number.isFinite(st.mEng) ? st.mEng : d.M;
    s.M += mEng; s.Meng -= mEng;
    if (!st.restes) s.deplaces += d.deplaces;
    s.Co -= d.co;
    if (st.restes) {
      log(s, `Restes démantelés : ${d.nom}. Empreinte −${fmt(E0)}.`, 'ok');
    } else if (id === 'autonomie') {
      s.hopital = 'autonome';
      log(s, `${d.nom} : l'hôpital ne dépend plus des centrales.`, 'ok');
    } else if (d.mesure) {
      log(s, `Fait : ${d.nom}.`, 'ok');
    } else {
      log(s, `Fermé : ${d.nom}. Empreinte −${fmt(d.E)}${d.deplaces ? `, ${fmt(d.deplaces)} personnes à reconvertir` : ''}.`, 'ok');
    }
    trace(s, 'ferme', st.restes ? { id, restes: true } : { id });
    if (st.vite && d.rapide) {   // démoli vite : la pollution reste, le sol ne se régénère pas avant l'acte IV
      st.pollue = true;
      s.X += d.rapide.casse;
      log(s, `POLLUTION — ${d.nom} démolie trop vite. ${fmt(d.rapide.casse)} personnes, et un sol pollué.`, 'casse');
      trace(s, 'pollution', { id, casse: d.rapide.casse });
      ev.push({ type: 'pollution', id, casse: d.rapide.casse });
    }
    ev.push(...equilibrer(s));
    return ev;
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
    s.plancher = s.plancher * D.RELANCE.plancherMul;
    s.Co = Math.min(100, s.Co + (auto ? D.RELANCE.coAuto : D.RELANCE.co));
    trace(s, 'relance', { auto: !!auto });
    return { type: 'relance', auto: !!auto };
  }

  function ouvrirActe(s, n) {
    s.acte = n;
    s.ms['acte' + n] = s.t;
    s.paused = D.PAUSE_ACTE;
    log(s, n === 2 ? 'Acte II — Le réseau.' : `Acte ${n}.`, 'jalon');
    trace(s, 'acte', { n });
    return [{ type: 'acte', n }, ...equilibrer(s)];
  }

  // Au deuxième chiffre perdu et après, la région la plus démantelée s'éteint sur la carte (§10).
  function eteindreRegion(s) {
    const retire = {};
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (!d.mesure && (st.state === 'eteint' || st.state === 'coupe')) retire[d.region] = (retire[d.region] || 0) + d.E;
    }
    const choix = Object.keys(D.regions)
      .filter(r => !s.regionsEteintes.includes(r))
      .sort((a, b) => (retire[b] || 0) - (retire[a] || 0))[0];
    if (!choix) return [];
    s.regionsEteintes.push(choix);
    log(s, `${D.regions[choix].nom} s'éteint.`, 'jalon');
    trace(s, 'region', { region: choix });
    return [{ type: 'region', region: choix }];
  }

  const acteFini = (s, n) => D.sites.every(d => acteDe(d) !== n || d.mesure || s.sites[d.id].state === 'eteint');

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
        st.progress += (dt * speed) / dureeChantier(d, st);
        if (st.progress >= 1) ev.push(...close(s, d.id));
      } else if (st.state === 'eteint' && st.regen < 1 && !st.pollue) {
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
      if (dg <= 8) ev.push(...eteindreRegion(s));
    }
    s.digits = dg;

    if (s.ms.fin === null && acteFini(s, 1)) {
      s.ms.fin = s.t;
      log(s, 'Plus rien à démanteler sur cette carte.', 'jalon');
      trace(s, 'fin');
      ev.push({ type: 'fin', acte: 1 });
    }
    if (s.acte === 1 && s.ms.fin !== null && DERNIER_ACTE >= 2) ev.push(...ouvrirActe(s, 2));
    if (s.acte >= 2) {
      ev.push(...equilibrer(s));
      if (s.ms.fin2 === null && acteFini(s, 2)) {
        s.ms.fin2 = s.t;
        log(s, 'Plus rien à démanteler sur le réseau.', 'jalon');
        trace(s, 'fin', { acte: 2 });
        ev.push({ type: 'fin', acte: 2 });
      }
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
      if (st.state === 'eteint' && st.regen < 1 && !st.pollue) st.regen = Math.min(1, st.regen + elapsed / d.regen);
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
  const ETATS_NOEUD = ['alimente', 'deleste', 'prive'];
  function migrer(save) {
    if (!save || typeof save !== 'object' || save.v !== 1) return null;
    if (!save.sites || typeof save.sites !== 'object' || !(Number.isFinite(save.E) && save.E > 0)) return null;
    const s = create();
    for (const k of Object.keys(s)) {
      if (k === 'sites' || k === 'ms' || k === 'noeuds' || !(k in save)) continue;
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
        s.sites[id] = {
          state: st.state, progress: Number(st.progress) || 0, regen: Number(st.regen) || 0,
          vite: !!st.vite, pollue: !!st.pollue, sansApport: !!st.sansApport, restes: !!st.restes,
        };
        if (Number.isFinite(st.mEng)) s.sites[id].mEng = st.mEng;
      }
    }
    if (save.noeuds && typeof save.noeuds === 'object') {
      for (const id of Object.keys(s.noeuds)) if (ETATS_NOEUD.includes(save.noeuds[id])) s.noeuds[id] = save.noeuds[id];
    }
    if (!ETATS_HOPITAL.includes(s.hopital)) s.hopital = 'alimente';
    if (!(Number.isInteger(s.acte) && s.acte >= 1 && s.acte <= DERNIER_ACTE)) s.acte = 1;
    s.regionsEteintes = s.regionsEteintes.filter(r => r in D.regions);
    // Mains engagées : recalculées d'après les chantiers en cours.
    s.Meng = D.sites.reduce((a, d) => {
      const st = s.sites[d.id];
      return a + (st.state === 'chantier' ? (Number.isFinite(st.mEng) ? st.mEng : cout(d, st.vite).M) : 0);
    }, 0);
    if (!('coMin' in save)) s.coMin = s.Co;
    // Le plancher se déduit des relances : une partie enregistrée avec un autre barème reprend le barème actuel.
    s.plancher = D.PLANCHER0 * Math.pow(D.RELANCE.plancherMul, s.relances + s.relancesAuto);
    if (!('debut' in save)) s.debut = null;
    return s;
  }

  // --- rapport de session (playtests) ---
  const LIMITE_RELANCES = 20 * 60;   // le test secondaire du §14 compte les relances des 20 premières minutes
  function nomDe(id) { return (defs[id] || noeuds[id] || { nom: id }).nom; }
  const CHIFFRES_ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V'];

  function rapport(s, version) {
    const relancesJoueur = s.chrono.filter(e => e.type === 'relance' && !e.auto);
    const pertes = s.chrono.filter(e => e.type === 'chiffre');
    const nb = (type) => s.chrono.filter(e => e.type === type).length;
    return {
      version: version || null,
      versions: s.versions,
      debut: s.debut ? new Date(s.debut).toISOString() : null,
      chronologieComplete: s.debut !== null,
      tempsJeu: Math.round(s.t),
      horsLigne: Math.round(s.horsLigne || 0),
      acte: s.acte,
      stabilisation: s.ms.stabilise,
      premierChiffre: s.ms.chiffre,
      carteVidee: s.ms.fin,
      acte2: s.ms.acte2,
      deuxiemeChiffre: pertes.length > 1 ? pertes[1].t : null,
      finActe2: s.ms.fin2,
      relances20min: relancesJoueur.filter(e => e.t <= LIMITE_RELANCES).length,
      relances: s.relances,
      relancesConseil: s.relancesAuto,
      coupures: nb('coupure') + nb('delestage') + nb('privation'),
      delestages: nb('delestage'),
      pollutions: nb('pollution'),
      casse: s.X,
      consentementMin: Math.round(s.coMin),
      empreinte: Math.round(s.E),
      chiffres: s.digits,
      terreRendue: Math.round(T(s) * 10) / 10,
      plancher: s.plancher,
      regionsEteintes: s.regionsEteintes,
      chrono: s.chrono,
    };
  }

  function ligneChrono(e) {
    switch (e.type) {
      case 'engage': return e.vite ? `Démolition rapide : ${nomDe(e.id)}` : `Chantier ouvert : ${nomDe(e.id)}`;
      case 'ferme': return `${e.restes ? 'Restes démantelés' : defs[e.id] && defs[e.id].mesure ? 'Fait' : 'Fermé'} : ${nomDe(e.id)}`;
      case 'coupure': return `Coupure : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'delestage': return `Délestage : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'privation': return `Coupure : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'pollution': return `Pollution : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'arret': return `À l'arrêt, faute d'approvisionnement : ${nomDe(e.id)}`;
      case 'retour': return `Rebranché : ${nomDe(e.id)}`;
      case 'reconversion': return `Reconversion de ${fmt(e.n)} personnes`;
      case 'relance': return e.auto ? 'Relance par le Conseil, sans le joueur' : 'Relance';
      case 'stabilise': return 'Le nombre a cessé de monter';
      case 'chiffre': return `Chiffre perdu, ${e.digits} chiffres restent`;
      case 'region': return `${(D.regions[e.region] || { nom: e.region }).nom} s'éteint`;
      case 'acte': return `Acte ${CHIFFRES_ROMAINS[e.n] || e.n}${e.n === 2 ? ' : le réseau' : ''}`;
      case 'fin': return e.acte === 2 ? 'Plus rien à démanteler sur le réseau' : 'Plus rien à démanteler sur cette carte';
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
    ];
    if (r.acte >= 2) {
      lignes.push(`- Acte II ouvert : ${quand(r.acte2)}`);
      lignes.push(`- Deuxième chiffre perdu : ${quand(r.deuxiemeChiffre)}`);
    }
    lignes.push(
      `- Relances dans les 20 premières minutes : ${r.relances20min}`,
      `- Relances au total : ${r.relances}, plus ${r.relancesConseil} par le Conseil`,
      `- Coupures et délestages : ${r.coupures}, Casse : ${fmt(r.casse)} personne${r.casse > 1 ? 's' : ''}`,
    );
    if (r.pollutions) lignes.push(`- Démolitions rapides qui ont pollué : ${r.pollutions}`);
    lignes.push(
      `- Consentement minimum : ${r.consentementMin} %`,
      `- Empreinte : ${fmt(r.empreinte)}`,
      `- Terre rendue : ${String(r.terreRendue).replace('.', ',')} %`,
      `- Plancher irréductible : ${fmt(r.plancher)}`,
      `- Carte de l'acte I vidée : ${quand(r.carteVidee)}`,
    );
    if (r.acte >= 2) lignes.push(`- Réseau démantelé : ${quand(r.finActe2)}`);
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
  const NBSP = ' ';
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
    gSites, gEff, gRebond, kRate, relanceActive, T, Tmax, chantiersActifs, digitsOf, alimentants, dependants, estAlimente,
    bilan, apercu, planDelestage, approvisionne, acteDe, cout, dureeChantier, mesureFaite,
    fmt, fmtDur, fmtSci, migrer, rapport, rapportTexte,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
