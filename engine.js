// Décroissance — moteur (pur, sans DOM ; utilisable en node pour les simulations et les tests)
// Acte I : faire cesser la croissance, puis perdre un chiffre (le MVP).
// Acte II : le réseau. Production et demande électriques ; marge négative → délestage, marge positive → rebond.
// Acte III : les gens. Les Mains deviennent le goulot : gens en attente, formations, desserte, vivres.
// Acte IV : le legs. Ce qui ne se démantèle pas se garde ; le réseau national est le point de non-retour ;
// les sols se dépolluent au temps réel seul ; le plancher s'affiche.
// Acte V : rendre. Ce qui reste se rend à la main, un geste à la fois ; les équipes restent sur la terre rendue ;
// l'Empreinte s'arrête sur le plancher.
// Les fins : Clore, puis l'inventaire de l'épilogue ; ou Poursuivre, sous le plancher, sans écran de fin.
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
      casseDite: false,     // la définition de la Casse a été donnée, à sa première apparition
      sites: {},            // id -> { state: actif|chantier|eteint|coupe|fait, progress, regen, vite, pollue }
      hopital: 'alimente',  // acte I : alimente | coupe | autonome
      noeuds: {},           // acte II : id -> alimente | deleste | prive
      formations: [],       // lots en formation : { n, progress, lot, compo: [{ de, n }] }
      attente: [],          // gens à reconvertir, par origine, le plus ancien d'abord : { de, n, t0 }
      lots: 0,              // nombre de lots déjà formés ou en formation
      formerEnContinu: false, // acte III : un lot part dès qu'une place se libère
      reembauches: 0,       // acte III : gens réembauchés par une relance au lieu d'être reconvertis
      gardiens: 0,          // acte IV : gens affectés pour toujours à la garde de ce qui ne se démantèle pas
      installes: 0,         // acte V : gens restés sur la terre qu'ils ont rendue, sortis du jeu eux aussi
      issue: null,          // les fins : null tant que rien n'est choisi, puis 'clore' ou 'poursuivre', sans retour
      casseGarde: 0,        // Clore : la Casse des gardes réduites, comptée dans X, que seul l'épilogue révèle
      plancherSurcroit: 1,  // ce dont le plancher a monté après le dernier geste, quand une relance ne peut plus être défaite
      pasFaits: 0,          // Poursuivre : pas déjà faits sous le plancher
      pasEnCours: false,    // Poursuivre : un pas est en cours
      pasProgress: 0,
      inventaireVu: false,  // Clore : l'épilogue a été lu jusqu'au bout
      digitsActe4: 0,       // acte IV : chiffres de l'Empreinte à l'ouverture de l'acte (0 : pas encore ouvert)
      penurie: false,       // acte III : les vivres manquent en ce moment
      penurieX: 0,          // Casse due aux pénuries
      penurieAcc: 0,        // fraction de personne en cours de pénurie
      penurieDepuis: 0,     // penurieX au début de la pénurie en cours
      relanceUntil: -1,
      relances: 0,
      relancesAuto: 0,
      autoRelanceAt: -1e9,
      plancher: D.PLANCHER0,
      digits: 10,
      digitsMin: 10,
      ms: { stabilise: null, chiffre: null, coupure: null, fin: null, acte2: null, fin2: null, acte3: null, fin3: null, acte4: null, fin4: null,
        acte5: null, fin5: null, plancher: null, clore: null, poursuivre: null },
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
    for (const d of D.sites) s.sites[d.id] = { state: 'actif', progress: 0, regen: 0, vite: false, pollue: false };   // et, selon le site : habitants, dosage…
    for (const n of NOEUDS_RESEAU) s.noeuds[n.id] = 'alimente';
    return s;
  }

  const digitsOf = (E) => String(Math.floor(Math.max(1, E))).length;
  const relanceActive = (s) => s.t < s.relanceUntil;

  // --- acte IV : le legs ---
  // Les sols d'un site de l'acte II n'existent que s'il a été démoli trop vite.
  const existe = (s, d) => !d.seulementSi || !!s.sites[d.seulementSi].pollue || s.sites[d.id].state !== 'actif';
  // Après le réseau national, la Capacité ne se renouvelle plus, et le rebond du réseau s'arrête.
  const capaciteFinie = (s) => D.sites.some(d => d.finCapacite && s.sites[d.id].state === 'eteint');
  // Les gardiens se forment sur les places de formation : une garde en formation en occupe une. Une garde demandée
  // quand toutes sont prises attend la première qui se libère, avant tout nouveau lot de reconversion.
  const gardesEnFormation = (s) => D.sites.filter(d => d.garde && s.sites[d.id].state === 'chantier' && !s.sites[d.id].attentePlace).length;
  const gardeEnAttente = (s) => D.sites.some(d => d.garde && s.sites[d.id].state === 'chantier' && s.sites[d.id].attentePlace);
  const placesOccupees = (s) => s.formations.length + gardesEnFormation(s);
  // La part de ce qui reste qui ne sortira de l'Empreinte qu'en étant gardée : ce que retireront ensemble,
  // de l'Empreinte d'aujourd'hui, les gardes qui ne sont pas encore instituées.
  function aGarder(s) {
    let reste = 1;
    for (const d of D.sites) if (d.garde && s.sites[d.id].state !== 'eteint') reste *= 1 - d.part;
    return 1 - reste;
  }
  const fmtPlancher = (p) => (p < 1000 ? String(Math.round(p * 10) / 10).replace('.', ',') : fmt(p));

  // --- acte V : rendre ---
  const GESTES = D.sites.filter(d => d.geste);
  // Un geste à la fois : celui qui est en cours, s'il y en a un.
  const gesteEnCours = (s) => GESTES.find(d => s.sites[d.id].state === 'chantier') || null;
  const gestesFaits = (s) => GESTES.filter(d => s.sites[d.id].state === 'eteint').length;
  // L'Empreinte est-elle arrêtée sur le plancher ? Elle n'ira pas plus bas, quoi qu'on rende.
  const auPlancher = (s) => s.E <= s.plancher * (1 + 1e-9);

  function gSites(s) {
    let g = 0;
    for (const d of D.sites) {
      if (!d.g || acteDe(d) > s.acte) continue;
      const st = s.sites[d.id];
      // Une charge de l'acte IV fuit tant que sa garde n'est pas instituée, formation des gardiens comprise.
      if (st.state === 'actif' || (d.garde && st.state === 'chantier')) g += d.g;
    }
    return g;
  }
  const gEff = (s) => gSites(s) + gRebond(s) + (relanceActive(s) ? D.RELANCE.g : 0);
  const kRate = (s) => (capaciteFinie(s) ? 0 : D.K0 * Math.pow(s.E / D.E0, D.KEXP) * (relanceActive(s) ? D.RELANCE.kMul : 1));

  function T(s) {
    let t = 0;
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'eteint' && !st.pollue) t += d.T * st.regen;
    }
    return t;
  }
  const Tmax = () => D.sites.reduce((a, d) => a + d.T, 0);

  // Chantiers menés de front, qui usent le Consentement. Les sols et la formation des gardiens n'en sont pas.
  function chantiersActifs(s) {
    let n = 0;
    for (const d of D.sites) if (s.sites[d.id].state === 'chantier' && !d.sol && !d.garde) n++;
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
    if (s.acte < 2 || capaciteFinie(s)) return 0;   // sans réseau national, le barrage n'alimente plus que les villes
    const b = bilan(s);
    return b.marge > 0 && b.prod > 0 ? D.REBOND * b.marge / b.prod : 0;
  }

  // --- acte III : les gens, la desserte, les vivres ---
  // Empreinte qu'un site retire en fermant : fixe aux actes I et II ; à l'acte III, une part de ce qui reste.
  const retrait = (s, d) => (d.part ? s.E * d.part : d.E);
  // Retire de l'Empreinte, sans jamais plus de RETRAIT_MAX de ce qui reste, ni sous le plancher ; renvoie ce qui a été retiré.
  function retirer(s, e) {
    const reste = s.E - s.plancher;   // ce qui dépasse du plancher
    const r = Math.max(0, Math.min(e, s.E * D.RETRAIT_MAX, reste));
    if (r > 0 && r === reste) s.E = s.plancher;   // au plancher exactement, sans erreur d'arrondi
    else s.E -= r;
    return r;
  }
  // Ce qu'une fermeture retirerait vraiment aujourd'hui, plancher compris. Le dernier geste de l'acte V retire
  // tout ce qui dépasse encore du plancher.
  const dernierGeste = (s, d) => !!d.geste && GESTES.every(x => x.id === d.id || s.sites[x.id].state === 'eteint');
  function retraitPrevu(s, d) {
    if (dernierGeste(s, d)) return Math.max(0, s.E - s.plancher);
    return Math.max(0, Math.min(retrait(s, d), s.E * D.RETRAIT_MAX, s.E - s.plancher));
  }
  // Un site est isolé quand plus rien ne le dessert : sans port ni autoroute, son chantier se fait à bras.
  const isole = (s, d, arret) => !!d.desservi && d.desservi.every(h => h === arret || s.sites[h].state !== 'actif');
  const dessertes = (id) => D.sites.filter(d => d.desservi && d.desservi.includes(id)).map(d => d.id);

  // Vivres `plus` secondes après maintenant ; `arret` : exploitation supposée lancée maintenant.
  // Une exploitation en chantier ne produit plus ; sa terre, convertie, en rend une part qui monte en releveDur.
  function vivres(s, arret, plus) {
    if (s.acte < 3) return null;
    const V = D.VIVRES, t = s.t + (plus || 0);
    let prod = V.base + (mesureFaite(s, 'ceintures') ? V.ceintures : 0);
    for (const d of D.sites) {
      if (!d.vivres) continue;
      const st = s.sites[d.id];
      if (st.state === 'actif' && d.id !== arret) { prod += d.vivres; continue; }
      const t0 = st.state === 'actif' ? s.t : st.t0;
      const f = Number.isFinite(t0) ? Math.min(1, Math.max(0, (t - t0) / V.releveDur)) : 1;
      prod += d.vivres * V.releve * f;
    }
    return { prod, besoin: V.besoin, marge: prod - V.besoin };
  }
  // Ce qu'un lancement ferait aux vivres : le point le plus bas, combien de temps ils manqueraient,
  // et ce que la pénurie coûterait, en Casse et en Consentement, si rien d'autre ne changeait.
  function apercuVivres(s, id) {
    const V = D.VIVRES, pas = 5;
    let bas = Infinity, duree = 0, casse = 0, co = 0;
    for (let dt = 0; dt <= V.releveDur; dt += pas) {
      const v = vivres(s, id, dt);
      if (v.prod < bas) bas = v.prod;
      if (v.marge < 0) { duree = dt + pas; casse += -v.marge * V.casse * pas; co += -v.marge * V.co * pas; }
    }
    return { bas, besoin: V.besoin, duree, casse: Math.round(casse), co: Math.round(co) };
  }

  // Les gens qui attendent une formation, par origine : le groupe le plus ancien part en formation d'abord.
  function ajouterAttente(s, de, n) {
    if (!(n > 0)) return;
    s.deplaces += n;
    const der = s.attente[s.attente.length - 1];
    if (der && der.de === de && der.t0 === s.t) der.n += n;
    else s.attente.push({ de, n, t0: s.t });
  }
  function prendreAttente(s, n) {
    const compo = [];
    while (n > 0 && s.attente.length) {
      const c = s.attente[0], k = Math.min(n, c.n);
      c.n -= k; n -= k; s.deplaces -= k;
      const der = compo[compo.length - 1];
      if (der && der.de === c.de) der.n += k; else compo.push({ de: c.de, n: k });
      if (c.n <= 0) s.attente.shift();
    }
    return compo;
  }
  const placesFormation = (s) => 1 + (mesureFaite(s, 'centres') ? 1 : 0);
  const enFormation = (s) => s.formations.reduce((a, f) => a + f.n, 0);

  // Des noms : trois personnes de chaque lot, tirées de façon stable du numéro du lot et de leur origine.
  function melange(a, b) {
    let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    x ^= x >>> 13; x = Math.imul(x, 0x27d4eb2d);
    return (x ^ (x >>> 15)) >>> 0;
  }
  function personnes(f, k) {
    const out = [];
    for (let i = 0; i < Math.min(k, f.n); i++) {
      const h = melange(f.lot, i), genre = h % 2 ? 'f' : 'm';
      const prenoms = D.PRENOMS[genre];
      const origine = f.compo && f.compo.length ? f.compo[i % f.compo.length].de : null;
      const metiers = (origine && D.METIERS[origine]) || D.METIERS_COMMUNS;
      const m = metiers[melange(i + 11, f.lot) % metiers.length];
      out.push({
        nom: `${prenoms[melange(f.lot + 7, i) % prenoms.length]} ${D.NOMS[melange(i + 3, f.lot + 101) % D.NOMS.length]}`,
        metier: m[genre === 'f' ? 1 : 0],
      });
    }
    return out;
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
    const d = defs[id];
    if (acteDe(d) >= 3) {   // acte III : l'Empreinte retirée, les sites qu'on isolerait, les vivres
      if (s.acte < 3) return null;
      const isoles = dessertes(id).filter(x => s.sites[x].state === 'actif' && !isole(s, defs[x]) && isole(s, defs[x], id));
      return { retrait: d.mesure ? 0 : retrait(s, d), isoles, vivres: d.vivres ? apercuVivres(s, id) : null, delestes: [], prives: [], arretes: [] };
    }
    if (s.acte < 2 || acteDe(d) < 2) return null;
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

  // La Casse se dit une fois, à sa première apparition : une définition, pas un commentaire (§10).
  const DEFINITION_CASSE = "La Casse compte les personnes touchées pour de bon : licenciées sans reconversion, privées d'électricité, d'eau ou de soins, intoxiquées par une démolition bâclée, mal nourries. Elle ne redescend jamais.";
  function direCasse(s) {
    if (s.casseDite || !(s.X > 0)) return;
    s.casseDite = true;
    log(s, DEFINITION_CASSE, 'def');
  }

  // Ce que coûte une coupure, un délestage ou une privation, avant qu'ils n'aient lieu (R4) :
  // les mêmes nombres que coupure(), delester() et priver(). Un site arrêté net perd ses gens sans reclassement.
  function prixCoupure(id) {
    const d = defs[id];
    if (d) return { casse: d.deplaces || 0, co: D.COUPURE_SITE_CO };
    const n = noeuds[id];
    return { casse: (n && n.casse) || 0, co: (n && n.co) || 0 };
  }
  // Le prix d'un lancement : ce qu'il couperait tout de suite (acte I), délesterait ou priverait (acte II).
  function prixLancement(s, id, c) {
    c = c || canEngage(s, id);
    const a = c.apercu;
    const ids = [...(c.coupures || []), ...(a ? [...(a.delestes || []), ...(a.prives || [])] : [])];
    let casse = 0, co = 0;
    for (const x of ids) { const p = prixCoupure(x); casse += p.casse; co += p.co; }
    return { ids, casse, co, sansReclassement: ids.length > 0 && ids.every(x => !!defs[x]) };
  }
  // Le Conseil relance sous un seuil de Consentement. Ce lancement, ou la fermeture qui suivra, le ferait-il franchir ?
  // Compté avec le Consentement d'aujourd'hui : le jeu ne devine pas ce qu'il deviendra d'ici la fermeture.
  function risqueConseil(s, id, c) {
    const d = defs[id], st = s.sites[id], seuil = D.RELANCE.autoSeuil;
    if (!d || !st || s.Co < seuil) return null;   // déjà sous le seuil : l'affichage du Consentement le dit
    const fermeture = d.co || 0;
    if (st.state === 'chantier') return s.Co - fermeture < seuil ? { quand: 'fermeture', co: fermeture, seuil } : null;
    if (st.state !== 'actif' && st.state !== 'coupe') return null;
    c = c || canEngage(s, id);
    const lancement = prixLancement(s, id, c).co + (c.habitants ? D.HABITANTS.co : 0);
    if (s.Co - lancement < seuil) return { quand: 'lancement', co: lancement, seuil };
    if (s.Co - lancement - fermeture < seuil) return { quand: 'fermeture', co: fermeture, seuil };
    return null;
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
      retirer(s, d.E * D.COUPURE_SITE_E);
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

  // Coût d'un chantier ; la démolition rapide coûte deux fois moins de Capacité et de Mains ; un site isolé, deux fois plus de Mains.
  function cout(d, vite, isol) {
    const M = vite ? Math.ceil(d.M / 2) : d.M;
    return { K: vite ? Math.ceil(d.K / 2) : d.K, M: isol ? M * 2 : M };
  }
  const dureeChantier = (d, st) => (st && st.vite ? d.dur / 2 : st && st.habitants ? d.dur * D.HABITANTS.lent : d.dur);

  function canEngage(s, id, opts) {
    const d = defs[id], st = s.sites[id];
    if (!d) return { ok: false, raisons: ['inconnu'], coupures: [] };
    if (s.issue === 'clore') return { ok: false, raisons: ['clos'], coupures: [] };
    if (acteDe(d) > s.acte) return { ok: false, raisons: ['pas encore'], coupures: [] };
    if (!existe(s, d)) return { ok: false, raisons: ['sans objet'], coupures: [] };
    const restes = st.state === 'coupe' && !d.mesure;   // site coupé : on démantèle ce qu'il en reste (R4)
    if (st.state !== 'actif' && !restes) return { ok: false, raisons: [st.state], coupures: [] };
    if (d.mesure && id === 'autonomie' && s.hopital === 'autonome') return { ok: false, raisons: ['déjà fait'], coupures: [] };
    const isol = isole(s, d);
    let c = cout(d, !!(opts && opts.vite && d.rapide), isol);
    // Acte IV : une garde réduite ou pleine (deux fois plus de gardiens) ; sans Capacité, tout se fait à bras.
    const dosage = d.garde ? (opts && opts.dosage === 'pleine' ? 'pleine' : 'reduite') : null;
    if (dosage === 'pleine') c = { K: c.K, M: c.M * 2 };
    const aBras = acteDe(d) >= 4 && d.K > 0 && s.K < d.K;
    if (aBras) c = { K: 0, M: c.M * D.A_BRAS };
    // Acte V : sans assez de Mains pour l'équipe, les habitants font le geste, plus lentement. Jamais bloqué (R3).
    const habitants = !!d.geste && s.M < c.M;
    if (habitants) c = { K: 0, M: 0 };
    const raisons = [];
    if (s.K < c.K) raisons.push(`Capacité ${Math.floor(s.K)}/${c.K}`);
    if (s.M < c.M) raisons.push(`Mains ${s.M}/${c.M}`);
    if (d.geste && gesteEnCours(s)) raisons.push('un geste à la fois');
    return { ok: raisons.length === 0, raisons, restes, isole: isol, aBras, dosage, habitants, cout: c,
      placeLibre: placesOccupees(s) < placesFormation(s),
      coupures: acteDe(d) === 1 && !restes ? coupuresSi(s, id) : [], apercu: apercu(s, id) };
  }

  function engage(s, id, opts) {
    const c = canEngage(s, id, opts);
    if (!c.ok) return [];
    const d = defs[id], st = s.sites[id];
    const vite = !!(opts && opts.vite && d.rapide);
    const cc = c.cout;
    const desservis = dessertes(id).filter(x => s.sites[x].state === 'actif' && !isole(s, defs[x]));
    s.K -= cc.K;
    s.M -= cc.M; s.Meng += cc.M;
    st.state = 'chantier'; st.progress = 0; st.vite = vite; st.mEng = cc.M; st.restes = !!c.restes; st.isole = c.isole; st.t0 = s.t;
    if (c.aBras) st.aBras = true;
    if (c.habitants) { st.habitants = true; s.Co -= D.HABITANTS.co; }
    if (d.geste) {
      log(s, c.habitants ? `Faute de Mains, les habitants s'y mettent : ${d.nom}. Consentement −${D.HABITANTS.co}.` :
        `Geste lancé : ${d.nom}, ${fmt(cc.M)} personnes.`, 'chantier');
    } else if (d.garde) {
      st.dosage = c.dosage;
      st.attentePlace = !c.placeLibre;
      log(s, `Gardiens en formation : ${d.nom}, garde ${c.dosage === 'pleine' ? 'pleine' : 'réduite'}, ${fmt(cc.M)} personnes${c.aBras ? ', à bras, faute de Capacité' : ''}.` +
        (st.attentePlace ? ' Toutes les places de formation sont prises : ils commenceront à la première qui se libère.' : ''), 'chantier');
    } else {
      log(s, c.restes ? `Chantier ouvert sur les restes : ${d.nom}.` : vite ? `Démolition rapide lancée : ${d.nom}.` :
        d.sol ? `Dépollution lancée : ${d.nom}. Elle avancera à son rythme, même sans vous.` :
        c.isole ? `Chantier ouvert à bras, faute de desserte : ${d.nom}.` : c.aBras ? `Chantier ouvert à bras, faute de Capacité : ${d.nom}.` : `Chantier ouvert : ${d.nom}.`, 'chantier');
    }
    trace(s, 'engage', Object.assign({ id }, vite ? { vite: true } : {}, c.restes ? { restes: true } : {}, c.isole ? { isole: true } : {},
      d.garde ? { dosage: c.dosage } : {}, c.aBras ? { aBras: true } : {}, c.habitants ? { habitants: true } : {}));
    const ev = [{ type: 'engage', id }];
    // Un port ou une autoroute qu'on démantèle isole ce qu'il desservait encore.
    const isoles = desservis.filter(x => isole(s, defs[x]));
    if (isoles.length) {
      log(s, `Isolés : ${isoles.map(x => defs[x].nom).join(', ')}. Leurs chantiers demanderont deux fois plus de Mains.`, 'casse');
      for (const x of isoles) trace(s, 'isolement', { id: x });
      ev.push({ type: 'isolement', ids: isoles });
    }
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
      retirer(s, d.E * D.COUPURE_SITE_E);
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
    let E0;
    if (dernierGeste(s, d)) { E0 = Math.max(0, s.E - s.plancher); if (E0 > 0) s.E = s.plancher; }   // le dernier geste : tout ce qui dépasse encore
    else E0 = retirer(s, st.restes ? d.E * (1 - D.COUPURE_SITE_E) : retrait(s, d));
    st.Eretire = E0;
    s.K = Math.min(D.KCAP, s.K + d.kBack);
    const mEng = Number.isFinite(st.mEng) ? st.mEng : d.M;
    s.Meng -= mEng;
    if (d.garde) s.gardiens += mEng;   // les gardiens ne reviennent jamais dans le jeu
    else if (d.geste) s.installes += mEng;   // l'équipe reste sur la terre qu'elle a rendue
    else s.M += mEng;
    if (!st.restes) ajouterAttente(s, id, d.deplaces);
    s.Co -= d.co;
    if (d.garde) {
      ev[0] = { type: 'garde', id, dosage: st.dosage, gardiens: mEng };
      log(s, `Gardée : ${d.nom}, pour ${fmt(d.ans)} ans. ${fmt(mEng)} gardiens chaque année, pour toujours. Empreinte −${fmt(E0)} (${Math.round(d.part * 100)} % de ce qui restait).`, 'ok');
    } else if (d.geste) {
      log(s, `Rendu : ${d.nom}. ${E0 >= 0.05 ? `Empreinte −${fmtFin(E0)}.` : "L'Empreinte ne bouge plus."} ` +
        (st.habitants ? "Les habitants l'ont fait." : `${fmt(mEng)} personnes restent sur place.`), 'ok');
    } else if (d.sol) {
      if (d.seulementSi) s.sites[d.seulementSi].pollue = false;   // le sol de l'acte II, enfin dépollué, se régénère
      log(s, `Dépollué : ${d.nom}. Empreinte −${fmt(E0)} (${Math.round(d.part * 100)} % de ce qui restait).`, 'ok');
    } else if (st.restes) {
      log(s, `Restes démantelés : ${d.nom}. Empreinte −${fmt(E0)}.`, 'ok');
    } else if (id === 'autonomie') {
      s.hopital = 'autonome';
      log(s, `${d.nom} : l'hôpital ne dépend plus des centrales.`, 'ok');
    } else if (d.mesure) {
      log(s, `Fait : ${d.nom}.`, 'ok');
    } else {
      const part = d.part ? ` (${Math.round(d.part * 100)} % de ce qui restait)` : '';
      log(s, `Fermé : ${d.nom}. Empreinte −${fmt(E0)}${part}${d.deplaces ? `, ${fmt(d.deplaces)} personnes à reconvertir` : ''}.`, 'ok');
    }
    if (d.garde) trace(s, 'garde', Object.assign({ id, dosage: st.dosage, gardiens: mEng }, st.aBras ? { aBras: true } : {}));
    else trace(s, 'ferme', st.restes ? { id, restes: true } : { id });
    if (d.finCapacite) {   // le point de non-retour : choisi par le joueur, jamais déclenché par le récit (§5)
      log(s, `${d.nom} démantelé. La Capacité ne se renouvellera plus.`, 'jalon');
      trace(s, 'non-retour', { id });
      ev.push({ type: 'non-retour', id });
    }
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

  // Un lot part en formation s'il reste une place ; le plafond humain borne les Mains, engagées et en formation comprises.
  function reconvertir(s) {
    if (s.issue === 'clore') return false;
    if (gardeEnAttente(s)) return false;   // une garde qui attend une place passe avant les lots
    if (placesOccupees(s) >= placesFormation(s) || s.deplaces <= 0) return false;
    const place = D.MAINS_MAX - (s.M + s.Meng + enFormation(s));
    const n = Math.min(D.RECONV.batch, s.deplaces, Math.max(0, place));
    if (n <= 0) return false;
    const compo = prendreAttente(s, n);
    s.lots++;
    s.formations.push({ n, progress: 0, lot: s.lots, compo });
    s.Co -= D.RECONV.co;
    trace(s, 'reconversion', { n });
    return true;
  }
  // Remplit toutes les places de formation libres ; renvoie le nombre de lots partis.
  function reconvertirTout(s) {
    let n = 0;
    while (reconvertir(s)) n++;
    return n;
  }
  // En continu, un lot part dès qu'une place se libère, au même coût que d'un clic.
  function formerEnContinu(s, oui) {
    oui = !!oui;
    if (s.formerEnContinu === oui) return;
    s.formerEnContinu = oui;
    trace(s, 'continu', { oui });
    if (oui) reconvertirTout(s);
  }

  function relancer(s, auto) {
    if (relanceActive(s) || s.issue === 'clore') return null;   // une fois la partie close, il n'y a plus de bouton
    s.relanceUntil = s.t + D.RELANCE.dur;
    if (auto) { s.relancesAuto++; s.autoRelanceAt = s.t; log(s, 'Le Conseil a relancé la croissance sans vous.', 'casse'); }
    else { s.relances++; log(s, 'Relance.', 'relance'); }
    s.plancher = s.plancher * D.RELANCE.plancherMul;
    s.Co = Math.min(100, s.Co + (auto ? D.RELANCE.coAuto : D.RELANCE.co));
    trace(s, 'relance', { auto: !!auto });
    // L'Empreinte n'est jamais sous le plancher : s'il passe au-dessus d'elle en doublant, elle y remonte.
    const remontee = s.E < s.plancher;
    if (remontee) {
      const de = s.E;
      s.E = s.plancher;
      if (s.acte >= 4) log(s, `Le plancher double : ${fmtPlancher(s.plancher)}. L'Empreinte y remonte.`, 'relance');   // avant, le plancher ne se montre pas
      trace(s, 'remontee', { de: Math.round(de * 10) / 10, a: Math.round(s.plancher * 10) / 10 });
    }
    let reembauche = 0;
    if (s.acte >= 3 && s.deplaces > 0) {   // l'industrie relancée réembauche ceux qui attendaient : ils ne seront pas reconvertis
      reembauche = s.deplaces;
      s.attente = []; s.deplaces = 0; s.reembauches += reembauche;
      log(s, `La relance réembauche ${fmt(reembauche)} personnes qui attendaient une formation. Elles ne seront pas reconverties.`, 'relance');
      trace(s, 'reembauche', { n: reembauche });
    }
    return { type: 'relance', auto: !!auto, reembauche, plancher: s.plancher, remontee };
  }

  const TITRES_ACTES = { 1: "L'inventaire", 2: 'Le réseau', 3: 'Les gens', 4: 'Le legs', 5: 'Rendre' };
  function ouvrirActe(s, n) {
    s.acte = n;
    s.ms['acte' + n] = s.t;
    s.paused = D.PAUSE_ACTE;
    log(s, `Acte ${CHIFFRES_ROMAINS[n] || n} — ${TITRES_ACTES[n] || ''}.`, 'jalon');
    trace(s, 'acte', { n });
    if (n === 4) {   // le plancher se révèle (R5) : zéro n'est pas possible, et l'essentiel de ce qui reste se garde
      s.digitsActe4 = s.digitsMin;
      log(s, `Le plancher apparaît : ${fmtPlancher(s.plancher)}. L'Empreinte ne descendra jamais en dessous.`, 'jalon');
      log(s, `À garder : ${Math.round(aGarder(s) * 100)} % de ce qui reste. Cela ne se démantèle pas : cela se garde.`, 'jalon');
    }
    if (n === 5) log(s, 'Il ne reste rien à fermer ni à garder. Ce qui reste se rend à la main, un geste à la fois.', 'jalon');
    return [{ type: 'acte', n }, ...equilibrer(s)];
  }

  // Au deuxième chiffre perdu et après, la région la plus démantelée s'éteint sur la carte (§10).
  function eteindreRegion(s) {
    const retire = {};
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (d.mesure || (st.state !== 'eteint' && st.state !== 'coupe')) continue;
      const e = Number.isFinite(st.Eretire) ? st.Eretire : (d.E || 0);
      retire[d.region] = (retire[d.region] || 0) + e;
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

  const acteFini = (s, n) => D.sites.every(d => acteDe(d) !== n || d.mesure || !existe(s, d) || s.sites[d.id].state === 'eteint');

  // --- les fins (§11) ---
  // Tout est rendu : le dernier acte est achevé. Il reste à choisir comment finir.
  const toutRendu = (s) => s.ms['fin' + DERNIER_ACTE] !== null;
  // Le choix se fait l'Empreinte bloquée au plancher : pas pendant une relance.
  const peutChoisir = (s) => toutRendu(s) && !s.issue && !relanceActive(s);
  function monterPlancher(s) {
    s.plancherSurcroit *= s.E / s.plancher;
    s.plancher = s.E;
    log(s, `Il ne reste plus rien à rendre : ce que la relance a ajouté reste. Le plancher monte à ${fmtPlancher(s.plancher)}.`, 'relance');
    trace(s, 'plancher-monte', { plancher: Math.round(s.plancher * 10) / 10 });
  }

  // Clore : sceller. Les gardes réduites se paient alors, en Casse, sans que le jeu l'ait jamais dit (§7) :
  // elle entre dans X, et c'est l'épilogue qui la révèle.
  const sousDosages = (s) => D.sites.filter(d => d.garde).map(d => Object.assign({ id: d.id, dosage: s.sites[d.id].dosage === 'pleine' ? 'pleine' : 'reduite',
    casse: s.sites[d.id].dosage === 'pleine' ? 0 : (d.sousDosage || 0) }, s.sites[d.id].renforcee ? { renforcee: true } : {}));
  // Avant de choisir, une garde réduite peut encore devenir pleine, avec les Mains qui restent : autant de gardiens
  // de plus, pour toujours. Le jeu ne dit pas davantage ce que cela change.
  function peutRenforcer(s, id) {
    const d = defs[id], st = s.sites[id];
    if (!d || !d.garde || !toutRendu(s) || s.issue || st.state !== 'eteint' || st.dosage === 'pleine') return { ok: false, cout: d && d.garde ? d.M : 0 };
    return { ok: s.M >= d.M, cout: d.M };
  }
  function renforcer(s, id) {
    const c = peutRenforcer(s, id);
    if (!c.ok) return null;
    const d = defs[id], st = s.sites[id];
    s.M -= c.cout; s.gardiens += c.cout;
    st.mEng = (Number.isFinite(st.mEng) ? st.mEng : d.M) + c.cout;
    st.dosage = 'pleine'; st.renforcee = true;
    log(s, `Garde renforcée : ${d.nom}. ${fmt(c.cout)} gardiens de plus, pour toujours.`, 'ok');
    trace(s, 'renfort', { id, gardiens: c.cout });
    return { type: 'renfort', id, gardiens: c.cout };
  }

  function clore(s) {
    if (!peutChoisir(s)) return null;
    s.issue = 'clore'; s.ms.clore = s.t;
    trace(s, 'clore');
    for (const g of sousDosages(s)) {
      if (!g.casse) continue;
      s.casseGarde += g.casse; s.X += g.casse;
      trace(s, 'sous-dosage', { id: g.id, casse: g.casse });
    }
    log(s, 'Clos.', 'jalon');
    return { type: 'clore', casseGarde: s.casseGarde };
  }

  // Poursuivre : refuser le plancher. Chaque pas retire une part de ce qui reste et dure le double du précédent.
  // Il n'y a pas d'écran de fin, et plus de Clore.
  function poursuivre(s) {
    if (!peutChoisir(s)) return null;
    s.issue = 'poursuivre'; s.ms.poursuivre = s.t;
    log(s, 'Vous poursuivez, sous le plancher.', 'jalon');
    trace(s, 'poursuivre');
    return { type: 'poursuivre' };
  }
  const dureePas = (s) => D.POURSUIVRE.dur * Math.pow(2, s.pasFaits);
  const retraitPas = (s) => s.E * D.POURSUIVRE.part;
  function lancerPas(s) {
    if (s.issue !== 'poursuivre' || s.pasEnCours) return false;
    s.pasEnCours = true; s.pasProgress = 0;
    return true;
  }
  function finirPas(s) {
    const r = retraitPas(s);
    s.E -= r;
    s.pasFaits++; s.pasEnCours = false; s.pasProgress = 0;
    log(s, `Pas n° ${s.pasFaits} : Empreinte −${fmtPas(r)}. Le suivant durera ${fmtDur(dureePas(s))}.`, 'ok');
    trace(s, 'pas', { n: s.pasFaits, E: s.E });
    return { type: 'pas', n: s.pasFaits, retire: r };
  }

  // --- l'épilogue : « L'inventaire » (§11) ---
  // Un ordre sans Casse pour un acte : celui du joueur, réparé au plus juste. On rejoue ses lancements sur un état
  // sans durées ni coûts ; quand le suivant ferait de la Casse, on prend le premier des siens qui n'en fait pas.
  // Si aucun ne convient, on essaie une mesure qu'il n'a pas faite. `joueur` : [{ id, vite }], dans son ordre.
  function ordrePropre(acte, joueur) {
    const q = create();
    q.acte = acte; q.K = Infinity; q.M = Infinity;
    for (const d of D.sites) if (acteDe(d) < acte) q.sites[d.id].state = d.mesure ? 'fait' : 'eteint';
    if (acte > 1) q.hopital = 'autonome';
    const propre = (id) => {
      const c = canEngage(q, id), a = c.apercu;
      if (c.coupures.length) return false;
      if (!a) return true;
      if ((a.delestes && a.delestes.length) || (a.prives && a.prives.length) || (a.isoles && a.isoles.length)) return false;
      return !(a.vivres && a.vivres.bas < a.vivres.besoin - 1e-9);
    };
    const fermer = (id, force) => {
      const d = defs[id], st = q.sites[id];
      if (force) for (const dep of canEngage(q, id).coupures) { if (dep === 'hopital') q.hopital = 'coupe'; else q.sites[dep].state = 'eteint'; }
      st.state = d.mesure ? 'fait' : 'eteint';
      st.t0 = undefined;   // sa terre a eu le temps de rendre ses vivres
      if (id === 'autonomie') q.hopital = 'autonome';
      if (force) equilibrer(q);
    };
    const restants = joueur.filter(x => defs[x.id] && acteDe(defs[x.id]) === acte && q.sites[x.id].state === 'actif').map(x => ({ id: x.id, vite: !!x.vite }));
    const mesures = D.sites.filter(d => acteDe(d) === acte && d.mesure && !restants.some(x => x.id === d.id)).map(d => d.id);
    const ordre = [];
    while (restants.length) {
      let i = restants.findIndex(x => propre(x.id)), force = false;
      if (i < 0) {
        const m = mesures.findIndex(propre);
        if (m >= 0) { const id = mesures.splice(m, 1)[0]; fermer(id); ordre.push({ id, ajoute: true }); continue; }
        i = 0; force = true;   // aucun ordre n'évite cette Casse
      }
      for (const x of restants.slice(0, i)) x.retarde = true;
      const x = restants.splice(i, 1)[0];
      fermer(x.id, force);
      ordre.push(Object.assign({ id: x.id }, x.retarde ? { retarde: true } : {}, x.vite && defs[x.id].rapide ? { sansVite: true } : {}, force ? { inevitable: true } : {}));
    }
    return ordre;
  }

  // Tout ce qui a été fait, dans l'ordre, acte par acte, d'après la chronologie. Pour les actes I à III, où l'ordre
  // fait la Casse : l'ordre sans Casse, et ce qu'il aurait évité. Puis les gardes, et ce que leur dosage coûte.
  const ACTES_A_ORDRE = [1, 2, 3];
  function inventaire(s) {
    const actes = [];
    for (let n = 1; n <= DERNIER_ACTE; n++) actes.push({ n, titre: TITRES_ACTES[n] || '', lignes: [], casse: 0, coupures: 0, aBras: 0, lots: 0 });
    let a = actes[0], relance = null, penurie = null;
    const lancement = (id) => { for (let i = a.lignes.length - 1; i >= 0; i--) if (a.lignes[i].type === 'engage' && a.lignes[i].id === id) return a.lignes[i]; return null; };
    const dernier = (t) => { const l = a.lignes[a.lignes.length - 1]; return l && l.type === 'engage' && l.t === t ? l : null; };
    const casse = (e, quoi) => {
      const note = { quoi, id: e.id, casse: e.casse || 0 };
      const l = quoi === 'pollution' ? lancement(e.id) : dernier(e.t);
      if (l) l.notes.push(note); else a.lignes.push({ t: e.t, type: 'casse', notes: [note] });
      a.casse += note.casse; a.coupures++;
    };
    for (const e of s.chrono) {
      switch (e.type) {
        case 'acte': a = actes[e.n - 1] || a; break;
        case 'engage': a.lignes.push(Object.assign({ t: e.t, type: 'engage', id: e.id, notes: [] },
          ...['vite', 'restes', 'isole', 'aBras', 'habitants', 'dosage'].map(k => (e[k] ? { [k]: e[k] } : {})))); if (e.isole) a.aBras++; break;
        case 'coupure': case 'delestage': case 'privation': case 'pollution': casse(e, e.type); break;
        case 'isolement': { const l = dernier(e.t); if (l) l.notes.push({ quoi: 'isolement', id: e.id }); break; }
        case 'penurie': penurie = { t: e.t, type: 'penurie', vivres: e.vivres, casse: 0, notes: [] }; a.lignes.push(penurie); a.coupures++; break;
        case 'penurie-fin': if (penurie) { penurie.casse = e.casse || 0; penurie.importee = !!e.import; a.casse += penurie.casse; penurie = null; } break;
        case 'relance': relance = { t: e.t, type: 'relance', auto: !!e.auto, notes: [] }; a.lignes.push(relance); break;
        case 'reembauche': if (relance) relance.reembauche = e.n; break;
        case 'remontee': if (relance) relance.remontee = { de: e.de, a: e.a }; break;
        case 'reconversion': a.lots++; break;
        case 'renfort': a.lignes.push({ t: e.t, type: 'renfort', id: e.id, gardiens: e.gardiens, notes: [] }); break;
        default: break;
      }
    }
    if (penurie) { penurie.casse = s.penurieX - s.penurieDepuis; a.casse += penurie.casse; }   // une pénurie encore en cours
    for (const acte of actes) {
      if (!ACTES_A_ORDRE.includes(acte.n)) continue;
      const joueur = [];
      // Un site coupé puis démantelé en restes compte à la place où ses restes ont été lancés.
      for (const l of acte.lignes) if (l.type === 'engage' && !joueur.some(x => x.id === l.id)) joueur.push({ id: l.id, vite: !!l.vite });
      acte.propre = ordrePropre(acte.n, joueur);
      acte.identique = acte.propre.every((x, i) => !x.ajoute && !x.sansVite && joueur[i] && joueur[i].id === x.id);
      acte.inevitables = acte.propre.filter(x => x.inevitable).length;
    }
    const gardes = sousDosages(s).filter(g => s.sites[g.id].state === 'eteint');
    const casseGardes = gardes.reduce((t, g) => t + g.casse, 0);
    const avant = s.X - (s.casseGarde || 0);
    return { actes, gardes, casseAvant: avant, casseGardes, casseFinale: avant + casseGardes };
  }

  function tick(s, dt) {
    const ev = [];
    if (s.issue === 'clore') {   // la partie est close : plus rien ne bouge, sauf la terre qui finit de repousser
      for (const d of D.sites) {
        const st = s.sites[d.id];
        if (st.state === 'eteint' && st.regen < 1 && !st.pollue && d.regen > 0) st.regen = Math.min(1, st.regen + dt / d.regen);
      }
      return ev;
    }
    direCasse(s);   // une coupure au lancement arrive hors du tick : sa définition suit au tick d'après
    if (s.paused > 0) { s.paused -= dt; return ev; }
    const relAvant = relanceActive(s);
    s.t += dt;
    const rel = relanceActive(s);
    // Quand tout est rendu, ce qu'une relance a ajouté ne peut plus être retiré : à sa fin, le plancher monte jusqu'à l'Empreinte.
    if (relAvant && !rel && toutRendu(s) && s.E > s.plancher) monterPlancher(s);
    const g = gEff(s);
    if (g !== 0) s.E *= Math.exp((g / 100 / 60) * dt);
    s.K = Math.min(D.KCAP, s.K + kRate(s) * dt);

    const speed = rel ? D.RELANCE.speedMul : 1;
    for (const d of D.sites) {   // une garde qui attendait prend la première place de formation libre
      const st = s.sites[d.id];
      if (!d.garde || st.state !== 'chantier' || !st.attentePlace || placesOccupees(s) >= placesFormation(s)) continue;
      st.attentePlace = false;
      log(s, `Une place se libère : les gardiens de ${d.nom} commencent leur formation.`, 'chantier');
    }
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (st.state === 'chantier') {
        if (d.garde && st.attentePlace) continue;
        // Les sols et la formation des gardiens vont à leur rythme : la relance ne les accélère pas.
        st.progress += (dt * (d.sol || d.garde ? 1 : speed)) / dureeChantier(d, st);
        if (st.progress >= 1) ev.push(...close(s, d.id));
      } else if (st.state === 'eteint' && st.regen < 1 && !st.pollue && d.regen > 0) {
        st.regen = Math.min(1, st.regen + dt / d.regen);
      }
    }
    if (s.pasEnCours) {   // Poursuivre : le pas va à son rythme, rien ne l'accélère
      s.pasProgress += dt / dureePas(s);
      if (s.pasProgress >= 1) ev.push(finirPas(s));
    }
    for (const f of s.formations) f.progress += dt / D.RECONV.dur;
    for (const f of s.formations.filter(f => f.progress >= 1)) {
      s.M += f.n;
      if (s.acte >= 3) s.Co += D.CO_FORMES;   // des gens qui retrouvent un métier : l'adhésion revient
      log(s, `${f.n} personnes reconverties.`, 'ok');
      ev.push({ type: 'reconv', n: f.n, lot: f.lot });
    }
    s.formations = s.formations.filter(f => f.progress < 1);
    if (s.formerEnContinu) reconvertirTout(s);
    // Consentement : dérive vers l'équilibre, usure si l'on empile les chantiers
    const n = chantiersActifs(s);
    if (n > 1) s.Co -= D.CO_HATE * (n - 1) * dt;
    if (s.acte >= 3) {
      s.Co -= D.CO_ATTENTE * (s.deplaces / 1000) * dt;   // attendre une formation use l'adhésion
      ev.push(...nourrir(s, dt, rel));
    }
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
    while (dg < s.digitsMin) {   // une fermeture peut faire perdre deux chiffres d'un coup : chacun compte
      const k = --s.digitsMin;
      if (s.ms.chiffre === null) s.ms.chiffre = s.t;
      s.paused = D.PAUSE_CHIFFRE;
      log(s, `Un chiffre perdu. ${k} chiffres restent.`, 'jalon');
      trace(s, 'chiffre', { digits: k });
      ev.push({ type: 'chiffre', digits: k });
      if (k <= 8) ev.push(...eteindreRegion(s));
    }
    s.digits = dg;
    // L'arrêt sur le plancher, la première fois que l'Empreinte l'atteint une fois qu'il est affiché : il n'est pas zéro.
    if (s.acte >= 4 && s.ms.plancher === null && auPlancher(s)) {
      s.ms.plancher = s.t;
      s.paused = D.PAUSE_PLANCHER;
      log(s, `Le nombre s'est arrêté sur le plancher : ${fmtPlancher(s.plancher)}. Il ne descendra plus.`, 'jalon');
      trace(s, 'plancher', { plancher: s.plancher });
      ev.push({ type: 'plancher', plancher: s.plancher });
    }

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
    if (s.acte === 2 && s.ms.fin2 !== null && DERNIER_ACTE >= 3) ev.push(...ouvrirActe(s, 3));
    if (s.acte >= 3 && s.ms.fin3 === null && acteFini(s, 3)) {
      s.ms.fin3 = s.t;
      log(s, 'La carte est vide. Ce qui reste ne se démantèle pas.', 'jalon');
      trace(s, 'fin', { acte: 3 });
      ev.push({ type: 'fin', acte: 3 });
    }
    if (s.acte === 3 && s.ms.fin3 !== null && DERNIER_ACTE >= 4) ev.push(...ouvrirActe(s, 4));
    if (s.acte >= 4 && s.ms.fin4 === null && acteFini(s, 4)) {
      s.ms.fin4 = s.t;
      log(s, "Tout ce qui pouvait l'être est démantelé, dépollué ou gardé. Le reste se rendra à la main.", 'jalon');
      trace(s, 'fin', { acte: 4 });
      ev.push({ type: 'fin', acte: 4 });
    }
    if (s.acte === 4 && s.ms.fin4 !== null && DERNIER_ACTE >= 5) ev.push(...ouvrirActe(s, 5));
    if (s.acte >= 5 && s.ms.fin5 === null && acteFini(s, 5)) {
      s.ms.fin5 = s.t;
      log(s, "Tout est rendu. Il reste le plancher, les gardes, et la Casse.", 'jalon');
      trace(s, 'fin', { acte: 5 });
      ev.push({ type: 'fin', acte: 5 });
    }
    return ev;
  }

  // Vivres : sous les besoins, la pénurie fait de la Casse et use le Consentement, sauf pendant une relance (on importe).
  function nourrir(s, dt, rel) {
    const ev = [], v = vivres(s), V = D.VIVRES;
    const deficit = rel ? 0 : Math.max(0, -v.marge);
    if (deficit > 0) {
      if (!s.penurie) {
        s.penurie = true; s.penurieDepuis = s.penurieX;
        log(s, `PÉNURIE — les vivres ne couvrent plus que ${Math.round(v.prod)} % des besoins.`, 'casse');
        trace(s, 'penurie', { vivres: Math.round(v.prod) });
        ev.push({ type: 'penurie', vivres: v.prod });
      }
      s.penurieAcc += deficit * V.casse * dt;
      s.Co -= deficit * V.co * dt;
      const k = Math.floor(s.penurieAcc);
      if (k > 0) { s.penurieAcc -= k; s.X += k; s.penurieX += k; }
    } else if (s.penurie) {
      s.penurie = false;
      const k = s.penurieX - s.penurieDepuis;
      log(s, rel ? `Les importations couvrent les besoins, le temps de la relance. La pénurie a touché ${fmt(k)} personnes.` :
        `Fin de la pénurie. Elle a touché ${fmt(k)} personnes.`, rel ? 'relance' : 'ok');
      trace(s, 'penurie-fin', { casse: k, import: !!rel });
      ev.push({ type: 'penurie-fin', casse: k, import: !!rel });
    }
    return ev;
  }

  // Hors-ligne : la régénération et la dépollution avancent (plafond 12 h), et le Consentement dérive.
  // Rien ne se démantèle. Sert aussi au temps passé onglet caché : la partie ne tourne pas pendant ce temps.
  function applyOffline(s, elapsed) {
    elapsed = Math.max(0, elapsed || 0);
    s.horsLigne = (s.horsLigne || 0) + elapsed;
    if (elapsed >= 30) trace(s, 'absence', { duree: Math.round(elapsed) });
    elapsed = Math.min(elapsed, D.OFFLINE_CAP);
    if (elapsed < 5) return null;
    const T0 = T(s), E0 = s.E, depollues = [], fini = new Set();
    let sols = 0, pas = null;
    if (s.pasEnCours) {   // Poursuivre : le pas en cours avance sans le joueur, comme les sols ; le suivant l'attendra
      s.pasProgress += elapsed / dureePas(s);
      if (s.pasProgress >= 1) pas = finirPas(s).n;
    }
    for (const d of D.sites) {   // les sols : la seule chose qui progresse sans le joueur (§5)
      const st = s.sites[d.id];
      if (!d.sol || st.state !== 'chantier') continue;
      sols++;
      st.progress += elapsed / dureeChantier(d, st);
      if (st.progress < 1) continue;
      const apres = (st.progress - 1) * dureeChantier(d, st);   // temps écoulé depuis la fin de la dépollution
      close(s, d.id);
      if (d.regen > 0) st.regen = Math.min(1, apres / d.regen);
      fini.add(d.id); depollues.push(d.id);
      if (d.seulementSi) {   // le site de l'acte II, dépollué pendant l'absence, ne repousse que depuis
        const p = defs[d.seulementSi], sp = s.sites[d.seulementSi];
        if (p.regen > 0) sp.regen = Math.min(1, sp.regen + apres / p.regen);
        fini.add(d.seulementSi);
      }
    }
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (!fini.has(d.id) && st.state === 'eteint' && st.regen < 1 && !st.pollue && d.regen > 0) st.regen = Math.min(1, st.regen + elapsed / d.regen);
    }
    s.Co += Math.sign(D.CO_EQ - s.Co) * Math.min(Math.abs(D.CO_EQ - s.Co), D.CO_DRIFT * elapsed);
    const dT = T(s) - T0;
    if (sols) log(s, `Pendant votre absence (${fmtDur(elapsed)}), la dépollution a continué` +
      `${depollues.length ? ` : ${depollues.map(id => defs[id].nom).join(', ')}, terminé${depollues.length > 1 ? 's' : ''}` : ''}.`, 'ok');
    if (dT >= 0.05) log(s, `Pendant votre absence (${fmtDur(elapsed)}), la terre a regagné ${dT.toFixed(1).replace('.', ',')} point${dT >= 2 ? 's' : ''}.`, 'ok');
    if (pas) log(s, `Pendant votre absence (${fmtDur(elapsed)}), le pas n° ${pas} s'est achevé.`, 'ok');
    return { elapsed, dT, sols, depollues, dE: E0 - s.E, pas };
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
        if (Number.isFinite(st.t0)) s.sites[id].t0 = st.t0;
        if (Number.isFinite(st.Eretire)) s.sites[id].Eretire = st.Eretire;
        if (st.isole) s.sites[id].isole = true;
        if (st.aBras) s.sites[id].aBras = true;
        if (st.habitants) s.sites[id].habitants = true;
        if (st.renforcee) s.sites[id].renforcee = true;
        if (st.dosage === 'reduite' || st.dosage === 'pleine') s.sites[id].dosage = st.dosage;
        if (st.attentePlace) s.sites[id].attentePlace = true;
      }
    }
    if (save.noeuds && typeof save.noeuds === 'object') {
      for (const id of Object.keys(s.noeuds)) if (ETATS_NOEUD.includes(save.noeuds[id])) s.noeuds[id] = save.noeuds[id];
    }
    if (!ETATS_HOPITAL.includes(s.hopital)) s.hopital = 'alimente';
    if (!(Number.isInteger(s.acte) && s.acte >= 1 && s.acte <= DERNIER_ACTE)) s.acte = 1;
    s.regionsEteintes = s.regionsEteintes.filter(r => r in D.regions);
    // Formations et gens en attente, validés un à un. Avant l'acte III, une seule formation (reconv) et un seul total.
    const lotValide = (f) => f && typeof f === 'object' && Number.isFinite(f.n) && f.n > 0 && Number.isFinite(f.progress);
    const origine = (de) => (typeof de === 'string' && de in defs ? de : null);
    s.formations = s.formations.filter(lotValide).map(f => ({
      n: f.n, progress: Math.min(0.999, Math.max(0, f.progress)), lot: Number.isInteger(f.lot) ? f.lot : 0,
      compo: Array.isArray(f.compo) ? f.compo.filter(c => c && Number.isFinite(c.n)).map(c => ({ de: origine(c.de), n: c.n })) : [],
    }));
    if (lotValide(save.reconv) && !s.formations.length) {
      s.formations.push({ n: save.reconv.n, progress: Math.min(0.999, Math.max(0, save.reconv.progress)), lot: 0, compo: [] });
    }
    s.lots = Math.max(Number.isInteger(s.lots) ? s.lots : 0, ...s.formations.map(f => f.lot));
    if (!(Number.isFinite(s.deplaces) && s.deplaces >= 0)) s.deplaces = 0;
    s.attente = s.attente.filter(c => c && typeof c === 'object' && Number.isFinite(c.n) && c.n > 0)
      .map(c => ({ de: origine(c.de), n: c.n, t0: Number.isFinite(c.t0) ? c.t0 : s.t }));
    let ecart = s.deplaces - s.attente.reduce((a, c) => a + c.n, 0);   // le total fait foi
    if (ecart > 0) s.attente.unshift({ de: null, n: ecart, t0: s.t });
    while (ecart < 0 && s.attente.length) {
      const c = s.attente[s.attente.length - 1], k = Math.min(-ecart, c.n);
      c.n -= k; ecart += k;
      if (c.n <= 0) s.attente.pop();
    }
    // Mains engagées : recalculées d'après les chantiers en cours.
    s.Meng = D.sites.reduce((a, d) => {
      const st = s.sites[d.id];
      return a + (st.state === 'chantier' ? (Number.isFinite(st.mEng) ? st.mEng : cout(d, st.vite, st.isole).M) : 0);
    }, 0);
    if (!('coMin' in save)) s.coMin = s.Co;
    // Le plancher se déduit des relances : une partie enregistrée avec un autre barème reprend le barème actuel.
    if (!(Number.isFinite(s.plancherSurcroit) && s.plancherSurcroit >= 1)) s.plancherSurcroit = 1;
    s.plancher = D.PLANCHER0 * Math.pow(D.RELANCE.plancherMul, s.relances + s.relancesAuto) * s.plancherSurcroit;
    s.issue = save.issue === 'clore' || save.issue === 'poursuivre' ? save.issue : null;   // null par défaut : la boucle générale l'ignore
    if (!('debut' in save)) s.debut = null;
    return s;
  }

  // --- rapport de session (playtests) ---
  const LIMITE_RELANCES = 20 * 60;   // le test secondaire du §14 compte les relances des 20 premières minutes
  function nomDe(id) { return (defs[id] || noeuds[id] || { nom: id }).nom; }
  const CHIFFRES_ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V'];

  // La Casse par cause, d'après la chronologie : coupures (coupures, délestages, privations), pollutions, pénuries.
  function casseParCause(s) {
    const somme = (types) => s.chrono.filter(e => types.includes(e.type)).reduce((a, e) => a + (e.casse || 0), 0);
    return { coupures: somme(['coupure', 'delestage', 'privation']), pollutions: somme(['pollution']), penuries: s.penurieX, gardes: s.casseGarde || 0 };
  }
  // « 1 200 personnes (coupures et délestages 400, pollutions 800) » : les causes nulles ne sont pas citées.
  function texteCasse(s) {
    const c = casseParCause(s);
    const parts = [['coupures et délestages', c.coupures], ['pollutions', c.pollutions], ['pénuries', c.penuries], ['gardes réduites', c.gardes]].filter(([, n]) => n > 0);
    const total = `${fmt(s.X)} personne${s.X > 1 ? 's' : ''}`;
    return parts.length ? `${total} (${parts.map(([nom, n]) => `${nom} ${fmt(n)}`).join(', ')})` : total;
  }

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
      acte3: s.ms.acte3,
      finActe3: s.ms.fin3,
      acte4: s.ms.acte4,
      finActe4: s.ms.fin4,
      gardes: s.chrono.filter(e => e.type === 'garde').map(e => Object.assign({ id: e.id, dosage: e.dosage, gardiens: e.gardiens, t: e.t }, e.aBras ? { aBras: true } : {},
        s.sites[e.id] && s.sites[e.id].renforcee ? { dosage: 'pleine', gardiens: s.sites[e.id].mEng, renforcee: true } : {})),
      gardiens: s.gardiens,
      acte5: s.ms.acte5,
      finActe5: s.ms.fin5,
      plancherAtteint: s.ms.plancher,
      gestes: s.chrono.filter(e => e.type === 'ferme' && defs[e.id] && defs[e.id].geste).length,
      gestesHabitants: s.chrono.filter(e => e.type === 'engage' && e.habitants).length,
      installes: s.installes,
      reseauNational: (s.chrono.find(e => e.type === 'non-retour') || { t: null }).t,
      chiffresPerdus: pertes.map(e => e.t),
      relances20min: relancesJoueur.filter(e => e.t <= LIMITE_RELANCES).length,
      relances: s.relances,
      relancesConseil: s.relancesAuto,
      issue: s.issue,
      clore: s.ms.clore,
      poursuivre: s.ms.poursuivre,
      pas: s.pasFaits,
      casseGardes: s.casseGarde || 0,
      coupures: nb('coupure') + nb('delestage') + nb('privation'),
      delestages: nb('delestage'),
      pollutions: nb('pollution'),
      penuries: nb('penurie'),
      cassePenurie: s.penurieX,
      reembauches: s.reembauches,
      chantiersIsoles: s.chrono.filter(e => e.type === 'engage' && e.isole).length,
      casse: s.X,
      casseParCause: casseParCause(s),
      consentementMin: Math.round(s.coMin),
      empreinte: s.E < 100 ? Math.round(s.E * 10) / 10 : Math.round(s.E),
      chiffres: s.digits,
      terreRendue: Math.round(T(s) * 10) / 10,
      plancher: s.plancher,
      regionsEteintes: s.regionsEteintes,
      chrono: s.chrono,
    };
  }

  const texteGarde = (g) => `${nomDe(g.id)}, ${g.dosage === 'pleine' ? 'pleine' : 'réduite'}${g.aBras ? ' à bras' : ''}${g.renforcee ? ', renforcée à la fin' : ''} (${fmt(g.gardiens)} gardiens)`;
  function ligneChrono(e) {
    switch (e.type) {
      case 'engage':
        if (defs[e.id] && defs[e.id].geste) return `${e.habitants ? 'Geste lancé par les habitants' : 'Geste lancé'} : ${nomDe(e.id)}`;
        if (e.dosage) return `Gardiens en formation : ${nomDe(e.id)}, garde ${e.dosage === 'pleine' ? 'pleine' : 'réduite'}${e.aBras ? ', à bras' : ''}`;
        if (defs[e.id] && defs[e.id].sol) return `Dépollution lancée : ${nomDe(e.id)}`;
        return e.vite ? `Démolition rapide : ${nomDe(e.id)}` : e.isole ? `Chantier ouvert à bras, isolé : ${nomDe(e.id)}` :
          e.aBras ? `Chantier ouvert à bras, sans Capacité : ${nomDe(e.id)}` : `Chantier ouvert : ${nomDe(e.id)}`;
      case 'garde': return `Garde instituée : ${texteGarde(e)}`;
      case 'non-retour': return 'Point de non-retour : la Capacité ne se renouvellera plus';
      case 'isolement': return `Isolé : ${nomDe(e.id)}`;
      case 'reembauche': return `La relance réembauche ${fmt(e.n)} personnes qui attendaient une formation`;
      case 'penurie': return `Pénurie : les vivres couvrent ${e.vivres} % des besoins`;
      case 'penurie-fin': return e.import ? `Importations pendant la relance : pénurie suspendue, ${fmt(e.casse)} personnes` : `Fin de la pénurie : ${fmt(e.casse)} personnes`;
      case 'ferme': return `${e.restes ? 'Restes démantelés' : defs[e.id] && defs[e.id].geste ? 'Rendu' : defs[e.id] && defs[e.id].mesure ? 'Fait' : defs[e.id] && defs[e.id].sol ? 'Dépollué' : 'Fermé'} : ${nomDe(e.id)}`;
      case 'coupure': return `Coupure : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'delestage': return `Délestage : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'privation': return `Coupure : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'pollution': return `Pollution : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'arret': return `À l'arrêt, faute d'approvisionnement : ${nomDe(e.id)}`;
      case 'retour': return `Rebranché : ${nomDe(e.id)}`;
      case 'reconversion': return `Reconversion de ${fmt(e.n)} personnes`;
      case 'continu': return e.oui ? 'Formation en continu : activée' : 'Formation en continu : arrêtée';
      case 'relance': return e.auto ? 'Relance par le Conseil, sans le joueur' : 'Relance';
      case 'stabilise': return 'Le nombre a cessé de monter';
      case 'plancher': return `Le nombre s'est arrêté sur le plancher : ${fmtPlancher(e.plancher)}`;
      case 'remontee': return `Le plancher double : l'Empreinte remonte de ${fmtFin(e.de)} à ${fmtFin(e.a)}`;
      case 'chiffre': return `Chiffre perdu, ${e.digits} chiffres restent`;
      case 'region': return `${(D.regions[e.region] || { nom: e.region }).nom} s'éteint`;
      case 'acte': return `Acte ${CHIFFRES_ROMAINS[e.n] || e.n}${TITRES_ACTES[e.n] ? ' : ' + TITRES_ACTES[e.n].toLowerCase() : ''}`;
      case 'fin': return e.acte === 5 ? 'Tout est rendu' : e.acte === 4 ? "Tout ce qui pouvait l'être est démantelé, dépollué ou gardé" : e.acte === 3 ? 'La carte est vide : ce qui reste ne se démantèle pas' :
        e.acte === 2 ? 'Plus rien à démanteler sur le réseau' : 'Plus rien à démanteler sur cette carte';
      case 'absence': return `Absence de ${fmtDur(e.duree)}`;
      case 'plancher-monte': return `Plus rien à rendre : le plancher monte à ${fmtPlancher(e.plancher)}`;
      case 'renfort': return `Garde renforcée : ${nomDe(e.id)}, ${fmt(e.gardiens)} gardiens de plus`;
      case 'clore': return 'Clore';
      case 'sous-dosage': return `Garde réduite : ${nomDe(e.id)}, ${fmt(e.casse)} personnes`;
      case 'poursuivre': return 'Poursuivre : le plancher est refusé';
      case 'pas': return `Pas n° ${e.n} : Empreinte ${fmtPas(e.E)}`;
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
    if (r.acte >= 3) {
      lignes.push(`- Acte III ouvert : ${quand(r.acte3)}`);
      if (r.acte >= 4) lignes.push(`- Acte IV ouvert : ${quand(r.acte4)}`);
      if (r.acte >= 5) lignes.push(`- Acte V ouvert : ${quand(r.acte5)}`);
      lignes.push(`- Chiffres perdus : ${r.chiffresPerdus.map(fmtDur).join(', ')}`);
    }
    lignes.push(
      `- Relances dans les 20 premières minutes : ${r.relances20min}`,
      `- Relances au total : ${r.relances}, plus ${r.relancesConseil} par le Conseil`,
      `- Casse : ${texteCasse(s)}`,
      `- Coupures et délestages : ${r.coupures}`,
    );
    if (r.pollutions) lignes.push(`- Démolitions rapides qui ont pollué : ${r.pollutions}`);
    if (r.acte >= 3) {
      lignes.push(`- Pénuries : ${r.penuries}`);
      lignes.push(`- Réembauchés par les relances au lieu d'être reconvertis : ${fmt(r.reembauches)}`);
      lignes.push(`- Chantiers lancés à bras, sur des sites isolés : ${r.chantiersIsoles}`);
    }
    if (r.acte >= 4) {   // le dosage ne se paie qu'à l'épilogue (#20) : le rapport le note en attendant
      lignes.push(`- Gardes : ${r.gardes.length ? r.gardes.map(texteGarde).join(', ') : 'aucune'}`);
      lignes.push(`- Gardiens, pour toujours : ${fmt(r.gardiens)}`);
      lignes.push(`- Réseau national démantelé : ${quand(r.reseauNational)}`);
      lignes.push(`- Empreinte arrêtée sur le plancher : ${quand(r.plancherAtteint)}`);
    }
    if (r.acte >= 5) {
      lignes.push(`- Gestes faits : ${r.gestes} sur ${GESTES.length}, dont ${r.gestesHabitants} par les habitants`);
      lignes.push(`- Restés sur la terre rendue : ${fmt(r.installes)}`);
    }
    lignes.push(
      `- Consentement minimum : ${r.consentementMin} %`,
      `- Empreinte : ${fmtFin(r.empreinte)}`,
      `- Terre rendue : ${String(r.terreRendue).replace('.', ',')} %`,
      `- Plancher irréductible : ${fmtPlancher(r.plancher)}`,
      `- Carte de l'acte I vidée : ${quand(r.carteVidee)}`,
    );
    if (r.acte >= 2) lignes.push(`- Réseau démantelé : ${quand(r.finActe2)}`);
    if (r.acte >= 3) lignes.push(`- Carte de l'acte III vidée : ${quand(r.finActe3)}`);
    if (r.acte >= 4) lignes.push(`- Acte IV achevé : ${quand(r.finActe4)}`);
    if (r.acte >= 5) lignes.push(`- Acte V achevé : ${quand(r.finActe5)}`);
    if (r.issue === 'clore') lignes.push(`- Issue : Clore, à ${quand(r.clore)}`);
    if (r.issue === 'poursuivre') lignes.push(`- Issue : Poursuivre, à ${quand(r.poursuivre)} ; ${r.pas} pas faits sous le plancher`);
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
  const NBSP = '\u00A0';   // espace insécable : un nombre ne se coupe jamais en fin de ligne
  function fmt(n) {
    n = Math.floor(Math.abs(n));
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }
  // Sous 100, l'Empreinte et ce qu'on lui retire se lisent à la décimale : « 4,8 ».
  const fmtFin = (n) => (n < 100 ? (Math.floor(n * 10 + 1e-6) / 10).toFixed(1).replace('.', ',') : fmt(n));
  // Sous le plancher, l'Empreinte se lit à trois chiffres : « 4,32 », puis « 0,871 ».
  const fmtPas = (n) => (n >= 100 ? fmt(n) : String(Number(n.toPrecision(3))).replace('.', ','));
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
    retrait, isole, dessertes, vivres, apercuVivres, placesFormation, enFormation, personnes,
    reconvertirTout, formerEnContinu, casseParCause, texteCasse,
    prixCoupure, prixLancement, risqueConseil, DEFINITION_CASSE,
    existe, capaciteFinie, aGarder, placesOccupees, gardeEnAttente, gardesEnFormation, fmtPlancher,
    toutRendu, peutChoisir, peutRenforcer, renforcer, clore, poursuivre, lancerPas, dureePas, retraitPas, inventaire, ordrePropre, fmtPas,
    GESTES, gesteEnCours, gestesFaits, auPlancher, retraitPrevu, dernierGeste, fmtFin,
    DERNIER_ACTE, TITRES_ACTES,
    fmt, fmtDur, fmtSci, migrer, rapport, rapportTexte,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
