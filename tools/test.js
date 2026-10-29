// Tests du moteur, sans navigateur : reprise des sauvegardes et rapport de session.
// Usage : node tools/test.js
const assert = require('assert');
const E = require('../engine.js');

let passes = 0;
function test(nom, f) { f(); passes++; console.log(`ok  ${nom}`); }

// Le bot prudent du simulateur, réduit à l'essentiel : il ne provoque jamais de coupure.
const ORDRE = ['pub', 'credit', 'aero', 'suv', 'dc', 'ciment', 'charbon', 'autonomie', 'gaz'];
function jouer(s, sec) {
  for (let i = 0; i < sec * 10 && s.ms.fin === null; i++) {
    E.reconvertir(s);
    for (const id of ORDRE) {
      const c = E.canEngage(s, id);
      if (!c.ok || c.coupures.length) continue;
      if (id === 'gaz' && s.hopital !== 'autonome') continue;
      if (id === 'autonomie' && s.sites.charbon.state === 'actif') continue;
      E.engage(s, id);
    }
    E.tick(s, 0.1);
  }
  return s;
}
const allerRetour = (s) => JSON.parse(JSON.stringify(s));   // ce que fait localStorage

test('une sauvegarde faite avant l\'ajout d\'un site se recharge', () => {
  const save = allerRetour(jouer(Object.assign(E.create(), { started: true }), 120));
  delete save.sites.gaz;                         // le site n'existait pas encore au moment de la sauvegarde
  const s = E.migrer(save);
  assert.ok(s, 'migrer ne doit pas renvoyer null');
  assert.strictEqual(s.sites.gaz.state, 'actif');
  assert.doesNotThrow(() => { E.applyOffline(s, 3600); jouer(s, 10); });
});

test('un site retiré depuis la sauvegarde est ignoré', () => {
  const save = allerRetour(E.create());
  save.sites.fantome = { state: 'eteint', progress: 1, regen: 0.5 };
  const s = E.migrer(save);
  assert.ok(!('fantome' in s.sites));
  assert.doesNotThrow(() => E.T(s));
});

test('une sauvegarde illisible renvoie null', () => {
  const bonne = allerRetour(E.create());
  for (const mauvaise of [null, 'texte', {}, { ...bonne, v: 2 }, { ...bonne, E: null }, { ...bonne, sites: null }]) {
    assert.strictEqual(E.migrer(mauvaise), null, JSON.stringify(mauvaise).slice(0, 40));
  }
});

test('une sauvegarde antérieure au rapport prend les valeurs par défaut', () => {
  const save = allerRetour(jouer(Object.assign(E.create(), { started: true }), 60));
  for (const k of ['chrono', 'coMin', 'horsLigne', 'versions', 'debut']) delete save[k];
  const s = E.migrer(save);
  assert.deepStrictEqual(s.chrono, []);
  assert.deepStrictEqual(s.versions, []);
  assert.strictEqual(s.horsLigne, 0);
  assert.strictEqual(s.coMin, s.Co);
  assert.strictEqual(s.debut, null);
  assert.ok(E.rapportTexte(s, 'test').includes('chronologie incomplète'));
});

test('les Mains engagées sont recalculées au chargement', () => {
  const s0 = Object.assign(E.create(), { started: true, K: 900, M: 300 });
  E.engage(s0, 'aero');
  const save = allerRetour(s0);
  save.Meng = 9999;
  assert.strictEqual(E.migrer(save).Meng, E.defs.aero.M);
});

test('la chronologie couvre une partie complète, sans la limite du journal', () => {
  const s = jouer(Object.assign(E.create(), { started: true }), 30 * 60);
  const types = new Set(s.chrono.map(e => e.type));
  for (const t of ['engage', 'ferme', 'reconversion', 'stabilise', 'chiffre', 'fin']) assert.ok(types.has(t), t);
  for (const id of ORDRE) assert.ok(s.chrono.some(e => e.type === 'engage' && e.id === id), id);
  for (let i = 0; i < 250; i++) { s.t += 100; E.relancer(s); }
  assert.strictEqual(s.log.length, 200);
  assert.ok(s.chrono.filter(e => e.type === 'relance').length === 250);
});

test('seules les relances du joueur dans les 20 premières minutes comptent pour le §14', () => {
  const s = E.create();
  s.t = 60; E.relancer(s, false);
  s.t = 300; E.relancer(s, true);
  s.t = 1300; E.relancer(s, false);
  const r = E.rapport(s, 'test');
  assert.strictEqual(r.relances20min, 1);
  assert.strictEqual(r.relances, 2);
  assert.strictEqual(r.relancesConseil, 1);
});

test('le plancher double à chaque relance et se recalcule au chargement', () => {
  const s = E.create();
  for (let i = 0; i < 3; i++) { s.t += 100; E.relancer(s, false); }
  assert.ok(Math.abs(s.plancher - 19.2) < 1e-9, String(s.plancher));
  assert.strictEqual(E.digitsOf(s.plancher), 2);          // trois relances : un chiffre de moins à perdre
  const ancienne = allerRetour(E.create());
  Object.assign(ancienne, { plancher: 2544000, relances: 1, relancesAuto: 0 });   // barème d'avant la décision
  assert.ok(Math.abs(E.migrer(ancienne).plancher - 4.8) < 1e-9);
});

test('le temps hors ligne s\'additionne et les longues absences sont tracées', () => {
  const s = E.create();
  E.applyOffline(s, 100);
  E.applyOffline(s, 3);
  assert.strictEqual(s.horsLigne, 103);
  assert.strictEqual(s.chrono.filter(e => e.type === 'absence').length, 1);
});

test('le rapport contient un JSON valide et toute la chronologie', () => {
  const s = jouer(Object.assign(E.create(), { started: true }), 15 * 60);
  const texte = E.rapportTexte(s, 'abc1234 · 2026-10-21');
  const json = JSON.parse(texte.split('```json\n')[1].split('\n```')[0]);
  assert.strictEqual(json.chrono.length, s.chrono.length);
  assert.strictEqual(json.version, 'abc1234 · 2026-10-21');
  assert.ok(texte.includes('Le nombre a cessé de monter'));
});

// ---- Acte II : le réseau ----
// Un état de début d'acte II : la carte de l'acte I est vide, de quoi financer les chantiers.
function etatActe2() {
  const s = Object.assign(E.create(), { started: true });
  for (const d of E.D.sites) if (E.acteDe(d) === 1 && !d.mesure) s.sites[d.id].state = 'eteint';
  Object.assign(s, { E: 5e8, digits: 9, digitsMin: 9 });
  Object.assign(s.ms, { stabilise: 1, chiffre: 2 });
  E.tick(s, 0.1);          // l'acte II s'ouvre
  Object.assign(s, { paused: 0, K: 900, M: 6000 });
  return s;
}
const types = (ev) => ev.map(e => e.type);

test('l\'acte II s\'ouvre quand la carte de l\'acte I est vidée', () => {
  const s = jouer(Object.assign(E.create(), { started: true }), 30 * 60);
  assert.strictEqual(s.acte, 2);
  assert.ok(s.ms.acte2 !== null && s.chrono.some(e => e.type === 'acte' && e.n === 2));
});

test('le réseau de départ produit 2 200 MW pour 1 900 demandés, et la marge relance la croissance', () => {
  const s = etatActe2();
  const b = E.bilan(s);
  assert.deepStrictEqual([b.prod, b.dem, b.marge], [2200, 1900, 300]);
  assert.ok(Math.abs(E.gRebond(s) - E.D.REBOND * 300 / 2200) < 1e-12);
});

test('fermer la raffinerie arrête la centrale thermique et déleste dans l\'ordre affiché', () => {
  const s = etatActe2();
  const a = E.canEngage(s, 'raffinerie').apercu;
  assert.deepStrictEqual(a.arretes, ['thermique']);
  assert.deepStrictEqual(a.delestes.slice(0, 3), ['acierie', 'chimie', 'commerce']);   // industrie, puis commerces
  const X0 = s.X;
  const ev = E.engage(s, 'raffinerie');
  assert.ok(types(ev).includes('arret') && types(ev).includes('delestage'));
  assert.strictEqual(s.sites.acierie.state, 'coupe');
  assert.ok(s.X > X0);
  assert.ok(E.bilan(s).marge >= 0, 'après délestage, la marge est revenue à zéro ou au-dessus');
  assert.strictEqual(s.noeuds.hopital_orvenne, 'alimente', 'la santé est délestée en dernier');
});

test('la chimie sans filtration UV prive Orvenne d\'eau, et pas après la filtration', () => {
  const s = etatActe2();
  assert.deepStrictEqual(E.canEngage(s, 'chimie').apercu.prives, ['eau']);
  assert.ok(types(E.engage(s, 'chimie')).includes('privation'));
  assert.strictEqual(s.noeuds.eau, 'prive');
  const s2 = etatActe2();
  s2.sites.uv.state = 'fait';
  assert.deepStrictEqual(E.canEngage(s2, 'chimie').apercu.prives, []);
  assert.ok(!types(E.engage(s2, 'chimie')).includes('privation'));
});

test('la sobriété baisse de 30 % la demande des villes', () => {
  const s = etatActe2();
  s.sites.sobriete.state = 'fait';
  assert.strictEqual(E.bilan(s).dem, 1900 - 450 * (1 - E.D.SOBRIETE));
});

test('démolir vite coûte deux fois moins et va deux fois plus vite, mais pollue', () => {
  const s = etatActe2();
  const d = E.defs.acierie;
  E.engage(s, 'acierie', { vite: true });
  assert.strictEqual(s.K, 900 - Math.ceil(d.K / 2));
  assert.strictEqual(s.M, 6000 - Math.ceil(d.M / 2));
  const X0 = s.X;
  let ev = [];
  for (let i = 0; i < (d.dur / 2) * 10 + 5; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.strictEqual(s.sites.acierie.state, 'eteint', 'fermée en la moitié du temps');
  assert.ok(types(ev).includes('pollution') && s.X === X0 + d.rapide.casse && s.sites.acierie.pollue);
  for (let i = 0; i < 6000; i++) E.tick(s, 0.1);
  assert.strictEqual(s.sites.acierie.regen, 0, 'un sol pollué ne se régénère pas');
});

test('un site délesté se démantèle encore, sans compter deux fois ses gens', () => {
  const s = etatActe2();
  E.engage(s, 'raffinerie');                       // déleste l'aciérie
  s.K = 900;
  const E0 = s.E, dep0 = s.deplaces, d = E.defs.acierie;
  assert.ok(E.canEngage(s, 'acierie').ok && E.canEngage(s, 'acierie').restes);
  E.engage(s, 'acierie');
  for (let i = 0; i < d.dur * 10 + 5; i++) E.tick(s, 0.1);
  assert.strictEqual(s.sites.acierie.state, 'eteint');
  assert.ok(s.E < E0 - d.E * (1 - E.D.COUPURE_SITE_E) * 0.99, 'les restes retirent le reste de son Empreinte');
  assert.ok(s.deplaces - dep0 < d.deplaces, 'ses gens sont déjà dans la Casse, pas à reconvertir');
});

test('au deuxième chiffre perdu, la région la plus démantelée s\'éteint', () => {
  const s = etatActe2();
  s.E = 1.9e8;
  E.engage(s, 'acierie');
  let ev = [];
  for (let i = 0; i < E.defs.acierie.dur * 10 + 5; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.ok(types(ev).includes('chiffre'));
  assert.deepStrictEqual(s.regionsEteintes, ['Cherbaix']);
});

test('une fermeture ne fait jamais passer l\'Empreinte sous zéro, et deux chiffres perdus d\'un coup comptent deux fois', () => {
  const s = etatActe2();
  s.E = 1.02e8;                                    // moins que l'aciérie elle-même
  E.engage(s, 'acierie');
  let ev = [];
  for (let i = 0; i < E.defs.acierie.dur * 10 + 5; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.ok(s.E > 0 && s.E >= 1.02e8 * (1 - E.D.RETRAIT_MAX) * 0.99);
  assert.deepStrictEqual(ev.filter(e => e.type === 'chiffre').map(e => e.digits), [8, 7]);
  assert.strictEqual(s.regionsEteintes.length, 2);
});

test('les sauvegardes de l\'acte I et de l\'acte II se reprennent', () => {
  const ancienne = allerRetour(E.create());
  for (const k of ['acte', 'noeuds', 'regionsEteintes']) delete ancienne[k];
  const s = E.migrer(ancienne);
  assert.strictEqual(s.acte, 1);
  assert.strictEqual(s.noeuds.valdrance, 'alimente');
  const s2 = etatActe2();
  E.engage(s2, 'raffinerie');
  const r = E.migrer(allerRetour(s2));
  assert.strictEqual(r.acte, 2);
  assert.strictEqual(r.noeuds.valdrance, s2.noeuds.valdrance);
  assert.strictEqual(r.sites.thermique.sansApport, true);
});

test('le rapport décrit l\'acte II', () => {
  const s = etatActe2();
  E.engage(s, 'raffinerie');
  const texte = E.rapportTexte(s, 'test');
  assert.ok(texte.includes('Acte II ouvert') && texte.includes('Délestage : Aciérie de Cherbaix'));
  const json = JSON.parse(texte.split('```json\n')[1].split('\n```')[0]);
  assert.ok(json.delestages >= 1 && json.acte === 2);
});

// Un état de début d'acte III : les cartes des actes I et II sont vides, la sobriété faite.
function etatActe3(extra) {
  const s = Object.assign(E.create(), { started: true });
  for (const d of E.D.sites) if (E.acteDe(d) <= 2) s.sites[d.id].state = d.mesure ? 'fait' : 'eteint';
  s.hopital = 'autonome';
  Object.assign(s, { acte: 2, E: 1.36e7, digits: 8, digitsMin: 8 });
  Object.assign(s.ms, { stabilise: 1, chiffre: 2, fin: 3, acte2: 3 });
  E.tick(s, 0.1);          // l'acte II est fini, l'acte III s'ouvre
  Object.assign(s, { paused: 0, K: 900, M: 20000, Co: 60 }, extra || {});
  return s;
}
const finir = (s, id) => { for (let i = 0; i < E.defs[id].dur * 10 + 5 && s.sites[id].state === 'chantier'; i++) E.tick(s, 0.1); };

test('l\'acte III s\'ouvre quand la carte de l\'acte II est vidée', () => {
  const s = etatActe3();
  assert.strictEqual(s.acte, 3);
  assert.ok(s.ms.fin2 !== null && s.ms.acte3 !== null);
  assert.ok(s.chrono.some(e => e.type === 'acte' && e.n === 3));
  assert.ok(E.canEngage(s, 'port').ok);
});

test('une fermeture de l\'acte III retire sa part de l\'Empreinte qui reste', () => {
  const s = etatActe3();
  E.engage(s, 'autoroute');
  const avant = s.E;
  const ev = [];
  for (let i = 0; i < E.defs.autoroute.dur * 10 + 5 && s.sites.autoroute.state === 'chantier'; i++) {
    const E0 = s.E; ev.push(...E.tick(s, 0.1));
    if (s.sites.autoroute.state === 'eteint') assert.ok(Math.abs(s.sites.autoroute.Eretire - E0 * E.defs.autoroute.part) / s.sites.autoroute.Eretire < 0.01);
  }
  assert.strictEqual(s.sites.autoroute.state, 'eteint');
  assert.ok(s.E < avant * (1 - E.defs.autoroute.part) * 1.01);
  assert.ok(types(ev).includes('chiffre'), 'sous 10 millions, un chiffre tombe');
});

test('démanteler le port isole ce qu\'il dessert, et leurs chantiers demandent deux fois plus de Mains', () => {
  const s = etatActe3();
  assert.deepStrictEqual(E.canEngage(s, 'port').apercu.isoles, ['cereales', 'elevages', 'peche']);
  const avant = E.canEngage(s, 'peche').cout.M;
  const ev = E.engage(s, 'port');
  assert.deepStrictEqual(ev.find(e => e.type === 'isolement').ids, ['cereales', 'elevages', 'peche']);
  const c = E.canEngage(s, 'peche');
  assert.ok(c.isole && c.cout.M === avant * 2);
  const M0 = s.M;
  E.engage(s, 'peche');
  assert.strictEqual(M0 - s.M, avant * 2);
  assert.ok(s.chrono.some(e => e.type === 'engage' && e.id === 'peche' && e.isole));
  finir(s, 'peche');
  assert.strictEqual(s.M, M0, 'les Mains reviennent à la fermeture');
});

test('deux exploitations fermées à la fois font une pénurie ; la relève et les ceintures la résorbent', () => {
  const s = etatActe3();
  assert.strictEqual(E.vivres(s).prod, 110);
  const a = E.canEngage(s, 'serres').apercu.vivres;
  assert.ok(a.bas >= 100 && a.duree === 0, 'une petite exploitation seule ne fait pas de pénurie');
  assert.ok(E.canEngage(s, 'cereales').apercu.vivres.duree > 0);
  const X0 = s.X, Co0 = s.Co;
  E.engage(s, 'cereales'); E.engage(s, 'elevages');
  let ev = [];
  for (let i = 0; i < 600; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.ok(types(ev).includes('penurie') && s.penurie);
  assert.ok(s.X > X0 && s.penurieX === s.X - X0 && s.Co < Co0);
  for (let i = 0; i < E.D.VIVRES.releveDur * 10; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.ok(types(ev).includes('penurie-fin') && !s.penurie, 'la terre convertie nourrit à nouveau');
  const s2 = etatActe3();
  s2.sites.ceintures.state = 'fait';
  assert.strictEqual(E.vivres(s2).prod, 110 + E.D.VIVRES.ceintures);
  assert.strictEqual(E.canEngage(s2, 'cereales').apercu.vivres.duree, 0, 'avec les ceintures, les céréales se ferment sans pénurie');
});

test('à l\'acte III, la relance importe et réembauche les gens en attente', () => {
  const s = etatActe3();
  s.attente = [{ de: 'acierie', n: 2000, t0: s.t }]; s.deplaces = 2000;
  E.engage(s, 'cereales'); E.engage(s, 'elevages');
  E.tick(s, 0.1);
  assert.ok(s.penurie);
  const r = E.relancer(s);
  assert.strictEqual(r.reembauche, 2000);
  assert.strictEqual(s.deplaces, 0); assert.deepStrictEqual(s.attente, []); assert.strictEqual(s.reembauches, 2000);
  const ev = E.tick(s, 0.1);
  assert.ok(ev.some(e => e.type === 'penurie-fin' && e.import) && !s.penurie);
  const X = s.X;
  for (let i = 0; i < 300; i++) E.tick(s, 0.1);
  assert.strictEqual(s.X, X, 'pas de Casse de pénurie pendant la relance');
  const s2 = etatActe2();
  s2.attente = [{ de: 'acierie', n: 500, t0: s2.t }]; s2.deplaces = 500;
  assert.strictEqual(E.relancer(s2).reembauche, 0, 'avant l\'acte III, la relance ne réembauche personne');
});

test('à l\'acte III, attendre use le Consentement et une formation finie le rend', () => {
  const s = etatActe3({ Co: 50 });
  s.attente = [{ de: 'port', n: 5000, t0: s.t }]; s.deplaces = 5000;
  const Co0 = s.Co;
  for (let i = 0; i < 600; i++) E.tick(s, 0.1);   // une minute
  const attendu = Co0 + E.D.CO_DRIFT * 60 - E.D.CO_ATTENTE * 60 * 5;
  assert.ok(Math.abs(s.Co - attendu) < 0.05, `${s.Co} ≠ ${attendu}`);
  const Co1 = s.Co;
  assert.ok(E.reconvertir(s));
  for (let i = 0; i < E.D.RECONV.dur * 10 + 5; i++) E.tick(s, 0.1);
  const derive = (E.D.CO_DRIFT - E.D.CO_ATTENTE * 4.85) * E.D.RECONV.dur;
  assert.ok(Math.abs(s.Co - (Co1 - E.D.RECONV.co + E.D.CO_FORMES + derive)) < 0.2);
  const s2 = etatActe2();
  s2.Co = 50; s2.attente = [{ de: 'acierie', n: 5000, t0: s2.t }]; s2.deplaces = 5000;
  for (let i = 0; i < 600; i++) E.tick(s2, 0.1);
  assert.ok(s2.Co > 50, 'avant l\'acte III, l\'attente ne coûte rien');
});

test('les centres de formation ouvrent une deuxième place ; le plafond humain borne les Mains', () => {
  const s = etatActe3();
  s.attente = [{ de: 'port', n: 1200, t0: s.t }]; s.deplaces = 1200;
  assert.ok(E.reconvertir(s) && !E.reconvertir(s));
  s.sites.centres.state = 'fait';
  assert.ok(E.reconvertir(s) && !E.reconvertir(s));
  assert.strictEqual(s.formations.length, 2);
  assert.strictEqual(s.deplaces, 600);
  const s2 = etatActe3({ M: E.D.MAINS_MAX - 100 });
  s2.attente = [{ de: 'port', n: 1200, t0: s2.t }]; s2.deplaces = 1200;
  assert.ok(E.reconvertir(s2));
  assert.strictEqual(s2.formations[0].n, 100);
  assert.ok(!E.reconvertir(s2));
});

test('chaque lot montre trois noms stables, aux métiers de son site d\'origine', () => {
  const f = { n: 300, lot: 12, progress: 0, compo: [{ de: 'port', n: 300 }] };
  const a = E.personnes(f, 3), b = E.personnes(f, 3);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 3);
  const metiers = E.D.METIERS.port.flat();
  for (const p of a) { assert.ok(/^\S+ \S+$/.test(p.nom), p.nom); assert.ok(metiers.includes(p.metier), p.metier); }
  assert.notDeepStrictEqual(E.personnes({ ...f, lot: 13 }, 3), a);
  assert.ok(E.personnes({ n: 300, lot: 1, compo: [{ de: null, n: 300 }] }, 1)[0].metier);
});

test('l\'acte III finit quand ses sites sont démantelés, et le rapport le décrit', () => {
  const s = etatActe3({ M: 40000, Co: 90 });
  s.sites.ceintures.state = 'fait';
  let ev = [];
  for (const id of ['cereales', 'elevages', 'peche', 'serres', 'entrepots', 'centrales', 'port', 'autoroute']) {
    s.K = 900; s.Co = 90;
    E.engage(s, id);
    for (let i = 0; i < E.defs[id].dur * 10 + 5 && s.sites[id].state === 'chantier'; i++) ev = ev.concat(E.tick(s, 0.1));
    for (let i = 0; i < E.D.VIVRES.releveDur * 10; i++) ev = ev.concat(E.tick(s, 0.1));
  }
  assert.ok(ev.some(e => e.type === 'fin' && e.acte === 3) && s.ms.fin3 !== null);
  assert.ok(s.E < 1e5 && s.E > 0, `Empreinte ${s.E}`);
  assert.strictEqual(s.penurieX, 0, 'un ordre propre existe : aucune pénurie');
  const texte = E.rapportTexte(s, 'test');
  assert.ok(texte.includes('Acte III ouvert') && texte.includes('Pénuries : 0') && texte.includes('Carte de l\'acte III vidée'));
  const json = JSON.parse(texte.split('```json\n')[1].split('\n```')[0]);
  assert.ok(json.acte === 3 && json.finActe3 !== null && json.chiffresPerdus.length >= 3);
});

test('une sauvegarde d\'avant l\'acte III reprend sa formation et ses gens en attente', () => {
  const ancienne = allerRetour(etatActe2());
  delete ancienne.formations; delete ancienne.attente; delete ancienne.lots;
  ancienne.reconv = { n: 300, progress: 0.5 };
  ancienne.deplaces = 900;
  const s = E.migrer(ancienne);
  assert.deepStrictEqual(s.formations.map(f => [f.n, f.progress]), [[300, 0.5]]);
  assert.deepStrictEqual(s.attente.map(c => [c.de, c.n]), [[null, 900]]);
  const s3 = etatActe3();
  E.engage(s3, 'port');
  s3.attente = [{ de: 'port', n: 400, t0: 1 }, { de: 'inconnu', n: 100, t0: 2 }]; s3.deplaces = 450;
  const r = E.migrer(allerRetour(s3));
  assert.strictEqual(r.attente.reduce((a, c) => a + c.n, 0), 450, 'le total des gens en attente fait foi');
  assert.ok(r.attente.every(c => c.de === null || c.de in E.defs));
  assert.strictEqual(r.acte, 3);
  assert.strictEqual(r.Meng, s3.Meng);
});

console.log(`\n${passes} tests passés`);
