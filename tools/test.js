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
  s.E = E.defs.acierie.E + 2e7;   // la fermeture fait passer sous 10⁸, sans descendre sous 10⁷
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

test('un clic remplit toutes les places libres ; en continu, un lot part dès qu\'une place se libère', () => {
  const s = etatActe3({ Co: 60 });
  s.sites.centres.state = 'fait';
  s.attente = [{ de: 'port', n: 2000, t0: s.t }]; s.deplaces = 2000;
  assert.strictEqual(E.reconvertirTout(s), 2);
  assert.strictEqual(s.Co, 60 - 2 * E.D.RECONV.co);
  assert.strictEqual(E.reconvertirTout(s), 0, 'plus de place libre');
  E.formerEnContinu(s, true);
  assert.ok(s.chrono.some(e => e.type === 'continu' && e.oui));
  for (let i = 0; i < E.D.RECONV.dur * 10 + 5; i++) E.tick(s, 0.1);
  assert.strictEqual(s.formations.length, 2, 'les deux places sont reprises sans clic');
  assert.strictEqual(s.chrono.filter(e => e.type === 'reconversion').length, 4);
  E.formerEnContinu(s, false);
  for (let i = 0; i < E.D.RECONV.dur * 10 + 5; i++) E.tick(s, 0.1);
  assert.strictEqual(s.formations.length, 0, 'à l\'arrêt, plus rien ne part tout seul');
  const r = E.migrer(allerRetour(Object.assign(s, { formerEnContinu: true })));
  assert.strictEqual(r.formerEnContinu, true);
});

test('le rapport sépare la Casse par cause', () => {
  const s = etatActe2();
  s.sites.uv.state = 'actif';
  E.engage(s, 'chimie', { vite: true });                 // l'eau d'Orvenne est coupée : 400
  for (let i = 0; i < E.defs.chimie.dur * 5 + 5; i++) E.tick(s, 0.1);   // la démolition rapide pollue : 500
  const c = E.casseParCause(s);
  assert.deepStrictEqual(c, { coupures: 400, pollutions: 500, penuries: 0 });
  assert.strictEqual(c.coupures + c.pollutions + c.penuries, s.X);
  const texte = E.rapportTexte(s, 'test');
  assert.ok(texte.includes('- Casse : 900 personnes (coupures et délestages 400, pollutions 500)'), texte.split('\n').find(l => l.includes('Casse')));
  assert.ok(texte.includes('- Coupures et délestages : 1'));
  assert.strictEqual(E.texteCasse(E.create()), '0 personne');
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
  assert.ok(json.finActe3 !== null && json.chiffresPerdus.length >= 3);
  assert.ok(json.acte === 4 && json.acte4 !== null, 'l\'acte IV s\'ouvre dans la foulée');
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

// ---- La Casse et le Conseil se voient avant de lancer (playtest n°3) ----
test('le prix affiché d\'une coupure est celui qu\'elle coûte, en Casse et en consentement', () => {
  const s = Object.assign(E.create(), { started: true, K: 5000, M: 5000 });
  const c = E.canEngage(s, 'charbon');
  assert.ok(c.coupures.length > 0, 'au départ, le charbon alimente encore quelque chose');
  const p = E.prixLancement(s, 'charbon', c);
  assert.ok(p.casse > 0 && p.co > 0);
  const X0 = s.X, Co0 = s.Co;
  E.engage(s, 'charbon');
  assert.strictEqual(s.X - X0, p.casse);
  assert.strictEqual(Co0 - s.Co, p.co);
});

test('l\'aperçu d\'un délestage annonce sa Casse et son consentement', () => {
  const s = etatActe2();
  const c = E.canEngage(s, 'thermique');
  const p = E.prixLancement(s, 'thermique', c);
  assert.ok(c.apercu.delestes.includes('acierie') && p.casse >= E.defs.acierie.deplaces);
  const X0 = s.X, Co0 = s.Co;
  E.engage(s, 'thermique');
  E.tick(s, 0.1);
  const usure = Co0 - s.Co - p.co;   // un tick de dérive et d'usure, en plus des délestages
  assert.strictEqual(s.X - X0, p.casse);
  assert.ok(Math.abs(usure) < 0.1, `consentement : annoncé −${p.co}, perdu ${(Co0 - s.Co).toFixed(2)}`);
});

test('à la première Casse, le journal dit ce qu\'elle compte, une seule fois', () => {
  const s = Object.assign(E.create(), { started: true, K: 5000, M: 5000 });
  E.tick(s, 0.1);
  assert.ok(!s.log.some(l => l.kind === 'def'), 'pas de définition tant qu\'il n\'y a pas de Casse');
  E.engage(s, 'charbon');
  E.tick(s, 0.1); E.tick(s, 0.1);
  const def = s.log.filter(l => l.kind === 'def');
  assert.strictEqual(def.length, 1);
  assert.strictEqual(def[0].msg, E.DEFINITION_CASSE);
  const r = E.migrer(allerRetour(s));
  E.tick(r, 0.1);
  assert.strictEqual(r.log.filter(l => l.kind === 'def').length, 1, 'une partie rechargée ne la répète pas');
  const ancienne = allerRetour(s);
  delete ancienne.casseDite; ancienne.log = [];
  const a = E.migrer(ancienne);
  E.tick(a, 0.1);
  assert.strictEqual(a.log.filter(l => l.kind === 'def').length, 1, 'une partie d\'avant ce changement la reçoit une fois');
});

test('la carte avertit quand un lancement ou une fermeture ferait passer le consentement sous le seuil du Conseil', () => {
  const seuil = E.D.RELANCE.autoSeuil, co = E.defs.aero.co;
  const s = Object.assign(E.create(), { started: true, K: 5000, M: 5000 });
  s.Co = seuil + co + 1;
  assert.strictEqual(E.risqueConseil(s, 'aero', E.canEngage(s, 'aero')), null);
  s.Co = seuil + co - 1;
  assert.deepStrictEqual(E.risqueConseil(s, 'aero', E.canEngage(s, 'aero')), { quand: 'fermeture', co, seuil });
  E.engage(s, 'aero');
  assert.strictEqual(E.risqueConseil(s, 'aero').quand, 'fermeture', 'la carte le redit pendant le chantier');
  for (let i = 0; i < 6000 && s.sites.aero.state === 'chantier'; i++) E.tick(s, 0.1);
  assert.strictEqual(s.relancesAuto, 1, 'le Conseil relance bien à la fermeture annoncée');
  assert.strictEqual(E.risqueConseil(s, 'aero'), null, 'plus rien à annoncer sur un site fermé');
  const s2 = Object.assign(E.create(), { started: true, K: 5000, M: 5000, Co: seuil + 10 });
  assert.strictEqual(E.risqueConseil(s2, 'charbon', E.canEngage(s2, 'charbon')).quand, 'lancement', 'une coupure coûte tout de suite');
  s2.Co = seuil - 1;
  assert.strictEqual(E.risqueConseil(s2, 'aero', E.canEngage(s2, 'aero')), null, 'déjà sous le seuil : l\'affichage du consentement le dit');
});

test('l\'aperçu d\'une pénurie annonce à peu près la Casse qu\'elle fera', () => {
  const s = etatActe3();
  const c = E.canEngage(s, 'cereales');
  assert.ok(c.ok, c.raisons.join(', '));
  const v = c.apercu.vivres;
  assert.ok(v.duree > 0 && v.casse > 0 && v.co > 0);
  const X0 = s.X;
  E.engage(s, 'cereales');
  for (let i = 0; i < 400 * 10; i++) E.tick(s, 0.1);
  const vraie = s.X - X0;
  assert.ok(Math.abs(vraie - v.casse) <= 0.1 * vraie, `annoncé ${v.casse}, fait ${vraie}`);
});

// ---- Acte IV : le legs ----
// Un état de début d'acte IV : les cartes des actes I à III sont vides, les centres de formation faits.
function etatActe4(extra) {
  const s = Object.assign(E.create(), { started: true });
  for (const d of E.D.sites) if (E.acteDe(d) <= 3) s.sites[d.id].state = d.mesure ? 'fait' : 'eteint';
  s.hopital = 'autonome';
  Object.assign(s, { acte: 3, E: 3e4, digits: 5, digitsMin: 5 });
  Object.assign(s.ms, { stabilise: 1, chiffre: 2, fin: 3, acte2: 3, fin2: 4, acte3: 4 });
  E.tick(s, 0.1);          // l'acte III est fini, l'acte IV s'ouvre
  Object.assign(s, { paused: 0, K: 900, M: 20000, Co: 60 }, extra || {});
  return s;
}
const jusquA = (s, cond, max) => { let ev = []; for (let i = 0; i < (max || 36000) && !cond(); i++) ev = ev.concat(E.tick(s, 0.1)); return ev; };

test('l\'acte IV s\'ouvre quand la carte de l\'acte III est vidée, et le plancher apparaît', () => {
  const s = etatActe4();
  assert.strictEqual(s.acte, 4);
  assert.ok(s.ms.fin3 !== null && s.ms.acte4 !== null && s.digitsActe4 === 5);
  assert.ok(s.log.some(l => l.msg.startsWith('Le plancher apparaît : 2,4')));
  assert.ok(Math.abs(E.aGarder(s) - (1 - 0.3 * 0.45 * 0.6)) < 1e-9, `à garder ${E.aGarder(s)}`);
  assert.ok(s.log.some(l => l.msg.startsWith('À garder : 92 %')));
});

test('les charges fuient tant qu\'elles ne sont pas gardées, et seulement à l\'acte IV', () => {
  const debut = E.create();
  assert.ok(Math.abs(E.gSites(debut) - 2.4) < 1e-9, 'à l\'acte I, les charges ne comptent pas encore');
  const s = etatActe4();
  assert.ok(Math.abs(E.gSites(s) - 0.5) < 1e-9, `fuite ${E.gSites(s)}`);
  const E0 = s.E;
  for (let i = 0; i < 600; i++) E.tick(s, 0.1);
  assert.ok(s.E > E0, 'le compteur remonte');
  E.engage(s, 'digues');
  assert.ok(Math.abs(E.gSites(s) - 0.5) < 1e-9, 'la charge fuit encore pendant la formation des gardiens');
  jusquA(s, () => s.sites.digues.state === 'eteint');
  assert.ok(Math.abs(E.gSites(s) - 0.4) < 1e-9, 'une fois gardée, elle ne fuit plus');
});

test('une garde coûte de la Capacité une fois, et des gardiens pour toujours', () => {
  const s = etatActe4();
  const c = E.canEngage(s, 'combustibles');
  assert.ok(c.ok && c.dosage === 'reduite' && !c.aBras && c.cout.K === 400 && c.cout.M === 3000);
  const M0 = s.M, K0 = s.K;
  E.engage(s, 'combustibles');
  assert.strictEqual(s.M, M0 - 3000);
  assert.ok(Math.abs(s.K - (K0 - 400)) < 1e-9);
  assert.strictEqual(E.chantiersActifs(s), 0, 'former des gardiens n\'est pas un chantier de plus');
  const avant = s.E;
  const ev = jusquA(s, () => s.sites.combustibles.state === 'eteint');
  assert.ok(ev.some(e => e.type === 'garde' && e.id === 'combustibles' && e.dosage === 'reduite' && e.gardiens === 3000));
  assert.strictEqual(s.gardiens, 3000);
  assert.strictEqual(s.Meng, 0);
  assert.ok(s.M <= M0 - 3000 + 1, 'les gardiens ne reviennent pas dans les Mains');
  const part = s.sites.combustibles.Eretire / (s.E + s.sites.combustibles.Eretire);
  assert.ok(Math.abs(part - 0.7) < 0.001 && s.E < avant, `la garde retire 70 % de ce qui reste : ${part}`);
  assert.ok(s.chrono.some(e => e.type === 'garde' && e.id === 'combustibles'));
});

test('une garde pleine demande deux fois plus de gardiens ; sans Capacité, tout se fait à bras', () => {
  const s = etatActe4();
  assert.strictEqual(E.canEngage(s, 'galeries', { dosage: 'pleine' }).cout.M, 3000);
  s.K = 100;
  const c = E.canEngage(s, 'galeries', { dosage: 'pleine' });
  assert.ok(c.aBras && c.cout.K === 0 && c.cout.M === 6000, JSON.stringify(c.cout));
  const r = E.canEngage(s, 'reseau');
  assert.ok(r.aBras && r.cout.K === 0 && r.cout.M === 5000, 'le réseau national aussi');
  assert.ok(!E.canEngage(s, 'pfas').aBras, 'un sol ne coûte pas de Capacité');
  E.engage(s, 'galeries', { dosage: 'pleine' });
  jusquA(s, () => s.sites.galeries.state === 'eteint');
  assert.strictEqual(s.gardiens, 6000);
  assert.ok(E.rapportTexte(s, 'test').includes(`Galeries du bassin de Cherbaix, pleine à bras (${E.fmt(6000)} gardiens)`));
});

test('les gardiens se forment sur une place de formation ; une garde qui attend passe avant les lots', () => {
  const s = etatActe4();
  s.attente = [{ de: 'reseau', n: 3000, t0: s.t }]; s.deplaces = 3000;
  assert.strictEqual(E.placesFormation(s), 2);
  E.reconvertirTout(s);
  assert.strictEqual(s.formations.length, 2);
  E.engage(s, 'digues');
  assert.ok(s.sites.digues.attentePlace, 'toutes les places sont prises');
  assert.ok(E.gardeEnAttente(s) && !E.reconvertir(s), 'aucun lot ne part tant qu\'une garde attend');
  const p0 = s.sites.digues.progress;
  for (let i = 0; i < 100; i++) E.tick(s, 0.1);
  assert.strictEqual(s.sites.digues.progress, p0, 'sans place, la formation n\'avance pas');
  jusquA(s, () => !s.sites.digues.attentePlace, 600);
  assert.ok(!s.sites.digues.attentePlace && E.gardesEnFormation(s) === 1);
  assert.strictEqual(E.placesOccupees(s), 1 + s.formations.length, 'la garde occupe une place libérée');
  s.formerEnContinu = true;
  E.tick(s, 0.1);
  assert.strictEqual(E.placesOccupees(s), 2, 'en continu, un lot reprend l\'autre place');
});

test('le réseau national est le point de non-retour : plus de Capacité, plus de rebond', () => {
  const s = etatActe4();
  assert.ok(E.kRate(s) > 0 && E.gRebond(s) > 0);
  const c = E.canEngage(s, 'reseau');
  assert.ok(c.ok && c.cout.K === 300 && c.cout.M === 2500);
  E.engage(s, 'reseau');
  const ev = jusquA(s, () => s.sites.reseau.state === 'eteint');
  assert.ok(ev.some(e => e.type === 'non-retour'));
  assert.ok(E.capaciteFinie(s) && E.kRate(s) === 0 && E.gRebond(s) === 0);
  assert.ok(s.deplaces >= 1500, 'ses gens attendent une reconversion');
  E.relancer(s);
  assert.strictEqual(E.kRate(s), 0, 'même une relance n\'y change rien');
});

test('les sols se dépolluent au temps réel seul, hors ligne compris', () => {
  const s = etatActe4();
  E.engage(s, 'pfas');
  E.relancer(s);
  for (let i = 0; i < 100; i++) E.tick(s, 0.1);
  assert.ok(Math.abs(s.sites.pfas.progress - 10 / E.defs.pfas.dur) < 1e-6, 'la relance ne l\'accélère pas');
  assert.strictEqual(E.chantiersActifs(s), 0, 'un sol n\'use pas le Consentement');
  const E0 = s.E;
  const r = E.applyOffline(s, E.defs.pfas.dur);
  assert.ok(r.sols === 1 && r.depollues.includes('pfas'));
  assert.strictEqual(s.sites.pfas.state, 'eteint');
  assert.ok(s.E < E0 * 0.31, 'la dépollution retire sa part hors ligne');
  assert.ok(s.log.some(l => l.msg.includes('la dépollution a continué')));
  const ev = E.tick(s, 0.1);
  assert.ok(ev.some(e => e.type === 'chiffre'), 'le chiffre tombe au retour');
});

test('les sols pollués à l\'acte II n\'existent que si une démolition rapide les a pollués', () => {
  const s = etatActe4();
  assert.ok(!E.existe(s, E.defs['sol-acierie']) && E.canEngage(s, 'sol-acierie').raisons[0] === 'sans objet');
  const p = etatActe4();
  p.sites.acierie.pollue = true;
  assert.ok(E.existe(p, E.defs['sol-acierie']));
  E.engage(p, 'sol-acierie');
  jusquA(p, () => p.sites['sol-acierie'].state === 'eteint');
  assert.ok(!p.sites.acierie.pollue, 'dépollué, le sol de l\'aciérie se régénère enfin');
  for (let i = 0; i < 100; i++) E.tick(p, 0.1);
  assert.ok(p.sites.acierie.regen > 0);
});

test('l\'Empreinte ne descend jamais sous le plancher', () => {
  const s = etatActe4({ E: 3 });
  E.engage(s, 'nitrates');
  jusquA(s, () => s.sites.nitrates.state === 'eteint');
  assert.ok(s.E >= s.plancher - 1e-9, `E ${s.E}, plancher ${s.plancher}`);
});

test('l\'acte IV finit quand tout est gardé, démantelé et dépollué, et le rapport le décrit', () => {
  const s = etatActe4({ M: 40000 });
  let ev = [];
  for (const id of ['decharges', 'pfas', 'nitrates']) E.engage(s, id);
  for (const id of ['combustibles', 'galeries', 'digues', 'reseau']) {
    E.engage(s, id);
    ev = ev.concat(jusquA(s, () => s.sites[id].state === 'eteint'));
  }
  ev = ev.concat(jusquA(s, () => s.ms.fin4 !== null));
  assert.ok(ev.some(e => e.type === 'fin' && e.acte === 4) && s.ms.fin4 !== null);
  assert.ok(s.E < 3e4 * 0.01, `l'acte fait perdre plus de deux chiffres : ${s.E}`);
  for (let i = 0; i < 9100; i++) E.tick(s, 0.1);   // la terre des sols repousse ensuite, en quinze minutes
  assert.ok(E.T(s) > 81, `la Terre rendue approche 82 % : ${E.T(s)}`);
  const texte = E.rapportTexte(s, 'test');
  for (const t of ['Acte IV ouvert', 'Gardes : Combustibles usés de la pointe de Morvel, réduite', `Gardiens, pour toujours : ${E.fmt(5300)}`, 'Réseau national démantelé', 'Acte IV achevé', 'Garde instituée', 'Dépollué', 'Point de non-retour'])
    assert.ok(texte.includes(t), t);
  const json = JSON.parse(texte.split('```json\n')[1].split('\n```')[0]);
  assert.ok(json.acte === 4 && json.finActe4 !== null && json.gardes.length === 3 && json.gardiens === 5300);
});

test('une sauvegarde d\'avant l\'acte IV se reprend, et une garde en cours aussi', () => {
  const ancienne = allerRetour(etatActe3());
  for (const k of ['gardiens', 'digitsActe4']) delete ancienne[k];
  for (const id of ['combustibles', 'galeries', 'digues', 'reseau', 'decharges', 'pfas', 'nitrates', 'sol-acierie', 'sol-chimie']) delete ancienne.sites[id];
  const a = E.migrer(ancienne);
  assert.ok(a && a.acte === 3 && a.gardiens === 0 && a.sites.combustibles.state === 'actif');
  assert.doesNotThrow(() => jouer(a, 5));
  const s = etatActe4();
  s.attente = [{ de: null, n: 600, t0: s.t }]; s.deplaces = 600;
  E.reconvertirTout(s);
  E.engage(s, 'combustibles', { dosage: 'pleine' });
  const r = E.migrer(allerRetour(s));
  assert.ok(r.acte === 4 && r.sites.combustibles.dosage === 'pleine' && r.sites.combustibles.attentePlace);
  assert.strictEqual(r.Meng, 6000);
  assert.strictEqual(r.digitsActe4, 5);
});

console.log(`\n${passes} tests passés`);
