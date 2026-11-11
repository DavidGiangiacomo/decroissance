// Tests du moteur, sans navigateur : actes II à V, les fins, reprise des sauvegardes, rapport de session,
// et le jugement de la vérification des invariants (tools/check.js).
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
  assert.deepStrictEqual(c, { coupures: 400, pollutions: 500, penuries: 0, gardes: 0 });
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
  assert.ok(json.acte === 5 && json.finActe4 !== null && json.gardes.length === 3 && json.gardiens === 5300);   // l'acte V s'est ouvert
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

// ---- Acte V : rendre ----
// Un état de début d'acte V : tout est fermé, gardé, dépollué et repoussé ; il reste les gestes.
function etatActe5(extra) {
  const s = Object.assign(E.create(), { started: true });
  for (const d of E.D.sites) if (E.acteDe(d) <= 4) Object.assign(s.sites[d.id], { state: d.mesure ? 'fait' : 'eteint', regen: 1 });
  s.hopital = 'autonome';
  Object.assign(s, { acte: 4, E: 60, digits: 2, digitsMin: 2, digitsActe4: 5 });
  Object.assign(s.ms, { stabilise: 1, chiffre: 2, fin: 3, acte2: 3, fin2: 4, acte3: 4, fin3: 5, acte4: 5 });
  E.tick(s, 0.1);          // l'acte IV est fini, l'acte V s'ouvre
  Object.assign(s, { paused: 0, K: 0, M: 20000, Co: 60 }, extra || {});
  return s;
}
const GESTES = E.GESTES.map(d => d.id);
const faire = (s, id) => { const ev = E.engage(s, id); return ev.concat(jusquA(s, () => s.sites[id].state === 'eteint', 3000)); };

test('l\'acte V s\'ouvre quand l\'acte IV est achevé : vingt-huit gestes, quatre par région', () => {
  const s = etatActe5();
  assert.ok(s.acte === 5 && s.ms.fin4 !== null && s.ms.acte5 !== null);
  assert.strictEqual(E.DERNIER_ACTE, 5);
  assert.strictEqual(GESTES.length, 28);
  for (const r of Object.keys(E.D.regions)) assert.strictEqual(E.GESTES.filter(d => d.region === r).length, 4, r);
  for (const id of GESTES) assert.ok(E.canEngage(s, id).ok, id);
  assert.ok(Math.abs(E.Tmax() - 100) < 1e-6, `la Terre rendue possible atteint 100 % : ${E.Tmax()}`);
  assert.ok(s.chrono.some(e => e.type === 'acte' && e.n === 5));
});

test('un geste à la fois ; la relance le fait aller deux fois plus vite', () => {
  const s = etatActe5();
  E.engage(s, 'planter-valdrance');
  const c = E.canEngage(s, 'planter-orvenne');
  assert.ok(!c.ok && c.raisons.includes('un geste à la fois'));
  assert.deepStrictEqual(E.engage(s, 'planter-orvenne'), []);
  jusquA(s, () => s.sites['planter-valdrance'].state === 'eteint', 3000);
  assert.ok(Math.abs(s.t - s.ms.acte5 - 30) < 0.3, `30 s : ${s.t - s.ms.acte5}`);
  assert.ok(E.canEngage(s, 'planter-orvenne').ok);
  const t0 = s.t;
  E.relancer(s); E.engage(s, 'planter-orvenne');
  jusquA(s, () => s.sites['planter-orvenne'].state === 'eteint', 3000);
  assert.ok(Math.abs(s.t - t0 - 15) < 0.3, `15 s pendant une relance : ${s.t - t0}`);
});

test('un geste retire sa part de ce qui reste, et son équipe reste sur la terre rendue', () => {
  const s = etatActe5();
  const ev = faire(s, 'debitumer-cherbaix');
  assert.ok(Math.abs(s.E - 60 * 0.85) < 1e-9, `−15 % : ${s.E}`);
  assert.ok(s.M === 19100 && s.Meng === 0 && s.installes === 900, 'les 900 ne reviennent pas');
  assert.ok(ev.some(e => e.type === 'ferme' && e.id === 'debitumer-cherbaix'));
  assert.ok(s.log.some(l => l.msg.includes('900 personnes restent sur place')));
  for (let i = 0; i < 2500; i++) E.tick(s, 0.1);   // la terre repousse en quatre minutes
  assert.ok(Math.abs(E.T(s) - (E.Tmax() - 18.2 + 0.9)) < 1e-6, `+0,9 point : ${E.T(s)}`);
});

test('sans assez de Mains, les habitants font le geste : deux fois plus long, et le Consentement paie', () => {
  const s = etatActe5({ M: 500 });
  const c = E.canEngage(s, 'rouvrir-meraud');
  assert.ok(c.ok && c.habitants && c.cout.M === 0 && c.cout.K === 0);
  assert.ok(!E.canEngage(s, 'planter-meraud').habitants, 'une équipe de 300 est encore possible');
  const t0 = s.t;
  E.engage(s, 'rouvrir-meraud');
  assert.ok(Math.abs(s.Co - 57) < 1e-9 && s.M === 500 && s.Meng === 0, 'consentement −3, aucune Main engagée');
  jusquA(s, () => s.sites['rouvrir-meraud'].state === 'eteint', 3000);
  assert.ok(Math.abs(s.t - t0 - 80) < 0.3, `80 s au lieu de 40 : ${s.t - t0}`);
  assert.ok(s.M === 500 && s.installes === 0 && Math.abs(s.E - 60 * 0.88) < 1e-9, 'la part est retirée, personne ne s\'installe');
  assert.ok(s.chrono.some(e => e.type === 'engage' && e.id === 'rouvrir-meraud' && e.habitants));
  assert.ok(E.rapportTexte(s, 'test').includes('Geste lancé par les habitants : Rouvrir, Méraud'));
});

test('R3 : jamais bloqué, aucun geste de plus de 90 s, aucune repousse de plus de 4 min', () => {
  for (const d of E.GESTES) {
    assert.ok(d.dur * E.D.HABITANTS.lent <= 90, `${d.id} : ${d.dur * E.D.HABITANTS.lent} s par les habitants`);
    assert.ok(d.regen <= 240, `${d.id} : repousse en ${d.regen} s`);
    assert.strictEqual(d.K, 0, 'sans Capacité');
  }
  const s = etatActe5({ M: 0, K: 0, Co: 0 });   // plus rien : ni Mains, ni Capacité, ni Consentement
  for (const id of GESTES) {
    assert.ok(E.canEngage(s, id).ok, `${id} doit rester possible`);
    faire(s, id);
  }
  assert.ok(s.ms.fin5 !== null);
});

test('le Conseil est annoncé avant un geste que feraient les habitants', () => {
  const s = etatActe5({ M: 0, Co: 22 });
  const r = E.risqueConseil(s, 'planter-plaine');
  assert.ok(r && r.quand === 'lancement' && r.co === 3 && r.seuil === 20);
  assert.strictEqual(E.risqueConseil(etatActe5({ Co: 22 }), 'planter-plaine'), null, 'avec une équipe, rien à craindre');
});

test('l\'Empreinte s\'arrête sur le plancher, qui n\'est pas zéro ; les gestes suivants ne rendent plus que de la terre', () => {
  const s = etatActe5({ E: 2.6 });
  assert.ok(Math.abs(E.retraitPrevu(s, 'x' && E.defs['debitumer-sere']) - 0.2) < 1e-9, 'la carte annonce ce qui sera vraiment retiré');
  let ev = faire(s, 'debitumer-sere');
  ev = ev.concat(E.tick(s, 0.1));
  assert.strictEqual(s.E, 2.4);
  assert.ok(E.auPlancher(s) && s.ms.plancher !== null && s.paused > 0, 'le jeu marque un temps');
  assert.strictEqual(ev.filter(e => e.type === 'plancher').length, 1);
  s.paused = 0;
  const T0 = E.T(s);
  ev = faire(s, 'planter-sere');
  for (let i = 0; i < 2500; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.strictEqual(s.E, 2.4);
  assert.ok(E.T(s) > T0 + 1.4, 'la terre, elle, continue de revenir');
  assert.ok(!ev.some(e => e.type === 'plancher'), 'l\'arrêt ne se marque qu\'une fois');
  assert.ok(s.log.some(l => l.msg.includes("L'Empreinte ne bouge plus")));
});

test('le dernier geste retire tout ce qui dépasse encore du plancher', () => {
  const s = etatActe5({ E: 1000 });
  for (const id of GESTES.slice(0, -1)) faire(s, id);
  const dernier = GESTES[GESTES.length - 1];
  assert.ok(s.E > s.plancher * 5, `les parts seules n'y suffisent pas : ${s.E}`);
  assert.ok(E.dernierGeste(s, E.defs[dernier]));
  assert.ok(Math.abs(E.retraitPrevu(s, E.defs[dernier]) - (s.E - 2.4)) < 1e-9);
  faire(s, dernier);
  assert.strictEqual(s.E, 2.4);
});

test('une relance double le plancher ; si l\'Empreinte se retrouve dessous, elle y remonte', () => {
  const s = etatActe5({ E: 3 });
  const ev = E.relancer(s);
  assert.ok(s.plancher === 4.8 && s.E === 4.8 && ev.plancher === 4.8);
  assert.ok(s.chrono.some(e => e.type === 'remontee' && e.de === 3 && e.a === 4.8));
  assert.ok(s.log.some(l => l.msg.includes("L'Empreinte y remonte")));
  const haut = etatActe5({ E: 500 });
  E.relancer(haut);
  assert.ok(haut.E === 500 && !haut.chrono.some(e => e.type === 'remontee'), 'au-dessus du plancher, rien ne change');
  const debut = Object.assign(E.create(), { started: true });
  E.relancer(debut);
  assert.strictEqual(debut.E, E.D.E0);
  // Tant que le plancher n'est pas révélé, la remontée ne se dit pas.
  const cache = Object.assign(E.create(), { started: true, E: 3 });
  E.relancer(cache);
  assert.ok(cache.E === 4.8 && !cache.log.some(l => l.msg.includes('plancher')));
});

test('l\'acte V finit quand tout est rendu : l\'Empreinte est au plancher, la Terre rendue à 100 %, et le rapport le décrit', () => {
  const s = etatActe5({ M: 9000 });   // de quoi faire une partie des gestes ; les habitants font le reste
  let ev = [];
  const parEquipe = [...E.GESTES].sort((a, b) => a.M - b.M).map(d => d.id);
  for (const id of parEquipe) ev = ev.concat(faire(s, id));
  ev = ev.concat(E.tick(s, 0.1));
  assert.ok(ev.some(e => e.type === 'fin' && e.acte === 5) && s.ms.fin5 !== null);
  assert.ok(E.auPlancher(s) && s.E === s.plancher);
  assert.ok(s.M === 500 && s.installes === 8500, `les Mains sont restées sur place : ${s.M}, ${s.installes}`);   // 7 × 300, 7 × 400, 6 × 600
  for (let i = 0; i < 2500; i++) E.tick(s, 0.1);
  assert.ok(Math.abs(E.T(s) - 100) < 1e-6, `Terre rendue : ${E.T(s)}`);
  const texte = E.rapportTexte(s, 'test');
  const habitants = s.chrono.filter(e => e.type === 'engage' && e.habitants).length;
  assert.ok(habitants > 0 && habitants < 28);
  for (const t of ['Acte V ouvert', `Gestes faits : 28 sur 28, dont ${habitants} par les habitants`, `Restés sur la terre rendue : ${E.fmt(s.installes)}`,
    'Empreinte arrêtée sur le plancher', 'Acte V achevé', 'Rendu : Planter, Valdrance', 'Tout est rendu', `- Empreinte : ${E.fmtFin(s.E)}`])
    assert.ok(texte.includes(t), t);
  const json = JSON.parse(texte.split('```json\n')[1].split('\n```')[0]);
  assert.ok(json.acte === 5 && json.finActe5 !== null && json.gestes === 28 && json.gestesHabitants === habitants && json.installes === s.installes && json.plancherAtteint !== null);
});

test('hors ligne, un geste n\'avance pas ; la terre rendue, elle, repousse', () => {
  const s = etatActe5();
  faire(s, 'planter-morvel');
  E.engage(s, 'rouvrir-morvel');
  for (let i = 0; i < 100; i++) E.tick(s, 0.1);
  const p = s.sites['rouvrir-morvel'].progress, E0 = s.E;
  E.applyOffline(s, 3600);
  assert.strictEqual(s.sites['rouvrir-morvel'].progress, p);
  assert.strictEqual(s.E, E0);
  assert.strictEqual(s.sites['planter-morvel'].regen, 1);
});

test('une sauvegarde d\'avant l\'acte V se reprend, et un geste des habitants en cours aussi', () => {
  const ancienne = allerRetour(etatActe5());
  Object.assign(ancienne, { acte: 4 });
  for (const k of ['installes']) delete ancienne[k];
  for (const k of ['acte5', 'fin5', 'plancher']) delete ancienne.ms[k];
  for (const id of GESTES) delete ancienne.sites[id];
  const a = E.migrer(ancienne);
  assert.ok(a && a.acte === 4 && a.installes === 0 && a.sites['planter-valdrance'].state === 'actif');
  const ev = E.tick(a, 0.1);
  assert.ok(a.acte === 5 && ev.some(e => e.type === 'acte' && e.n === 5), 'la partie finie à l\'acte IV reprend à l\'acte V');
  const s = etatActe5({ M: 0 });
  E.engage(s, 'debitumer-plaine');
  for (let i = 0; i < 100; i++) E.tick(s, 0.1);
  const r = E.migrer(allerRetour(s));
  assert.ok(r.acte === 5 && r.sites['debitumer-plaine'].habitants && r.Meng === 0);
  jusquA(r, () => r.sites['debitumer-plaine'].state === 'eteint', 3000);
  assert.ok(Math.abs(r.t - r.ms.acte5 - 90) < 0.3, `90 s en tout : ${r.t - r.ms.acte5}`);
});

test('sous 100, l\'Empreinte se lit à la décimale', () => {
  assert.strictEqual(E.fmtFin(2.4), '2,4');
  assert.strictEqual(E.fmtFin(2.4 * 2 * 2 * 2 * 2), '38,4');
  assert.strictEqual(E.fmtFin(9.96), '9,9');
  assert.strictEqual(E.fmtFin(0.04), '0,0');
  assert.strictEqual(E.fmtFin(1234.5), `1${' '}234`);
});

// ---- Les fins : Clore, Poursuivre, l'épilogue ----
// Tout est rendu : les vingt-huit gestes sont faits, l'Empreinte est sur le plancher. Les gardes sont réduites.
function etatFin(extra) {
  const s = etatActe5();
  for (const id of GESTES) Object.assign(s.sites[id], { state: 'eteint', regen: 1 });
  s.E = s.plancher;
  E.tick(s, 0.1);
  Object.assign(s, { paused: 0 }, extra || {});
  return s;
}
const { simuler } = require('./simulate.js');

test('quand tout est rendu, le choix s\'ouvre, l\'Empreinte bloquée au plancher : pas pendant une relance', () => {
  const s = etatFin();
  assert.ok(s.ms.fin5 !== null && E.toutRendu(s) && E.peutChoisir(s) && s.issue === null);
  assert.ok(!E.toutRendu(etatActe5()) && !E.peutChoisir(etatActe5()));
  E.relancer(s);
  assert.ok(!E.peutChoisir(s));
  assert.strictEqual(E.clore(s), null);
  assert.strictEqual(E.poursuivre(s), null);
  assert.strictEqual(s.issue, null);
});

test('après le dernier geste, ce qu\'une relance ajoute reste : le plancher monte jusqu\'à l\'Empreinte', () => {
  const s = etatFin();
  E.relancer(s);
  assert.ok(s.plancher === 4.8 && s.E === 4.8, 'le plancher double, l\'Empreinte y remonte');
  for (let i = 0; i < 950; i++) E.tick(s, 0.1);
  assert.ok(!E.relanceActive(s) && s.E > 5 && s.E < 5.2, `la relance a ajouté 6 % : ${s.E}`);
  assert.ok(s.plancher === s.E && E.auPlancher(s) && E.peutChoisir(s));
  assert.ok(s.chrono.some(e => e.type === 'plancher-monte'));
  const r = E.migrer(allerRetour(s));
  assert.ok(Math.abs(r.plancher - s.E) < 1e-9 && E.auPlancher(r), 'le plancher monté survit à une sauvegarde');
  E.relancer(r);
  assert.ok(Math.abs(r.plancher - 2 * s.E) < 1e-9, 'la relance suivante double ce plancher-là');
  // Tant qu'il reste des gestes, ils peuvent encore retirer ce qu'une relance ajoute : le plancher ne bouge pas.
  const avant = etatActe5();
  E.relancer(avant);
  for (let i = 0; i < 950; i++) E.tick(avant, 0.1);
  assert.ok(avant.plancher === 4.8 && avant.plancherSurcroit === 1);
});

test('Clore scelle la partie : plus de relance, plus rien à lancer, le temps s\'arrête ; la terre finit de repousser', () => {
  const s = etatFin();
  s.sites['planter-morvel'].regen = 0.5;
  const ev = E.clore(s);
  assert.ok(ev && ev.type === 'clore' && s.issue === 'clore' && s.ms.clore === s.t);
  assert.strictEqual(E.relancer(s), null);
  assert.strictEqual(E.poursuivre(s), null);
  assert.strictEqual(E.clore(s), null);
  s.deplaces = 600; s.attente = [{ de: null, n: 600, t0: s.t }];
  assert.strictEqual(E.reconvertir(s), false);
  for (const d of E.D.sites) assert.ok(!E.canEngage(s, d.id).ok, d.id);
  const t0 = s.t, E0 = s.E, Co = s.Co;
  let evs = [];
  for (let i = 0; i < 1300; i++) evs = evs.concat(E.tick(s, 0.1));
  assert.ok(s.t === t0 && s.E === E0 && s.Co === Co && evs.length === 0);
  assert.strictEqual(s.sites['planter-morvel'].regen, 1);
});

test('à Clore, chaque garde réduite ajoute sa Casse, que le jeu n\'avait pas dite ; une garde pleine n\'ajoute rien', () => {
  const s = etatFin({ X: 400 });
  assert.deepStrictEqual(E.inventaire(s).gardes.map(g => g.casse), [1200, 600, 300]);
  assert.ok(E.inventaire(s).casseAvant === 400 && E.inventaire(s).casseFinale === 2500);
  assert.strictEqual(E.clore(s).casseGarde, 2100);
  assert.ok(s.X === 2500 && s.casseGarde === 2100);
  assert.strictEqual(E.casseParCause(s).gardes, 2100);
  assert.ok(E.texteCasse(s).includes(`gardes réduites ${E.fmt(2100)}`));
  const inv = E.inventaire(s);
  assert.ok(inv.casseAvant === 400 && inv.casseGardes === 2100 && inv.casseFinale === 2500, 'l\'inventaire dit la même chose avant et après Clore');
  assert.strictEqual(s.chrono.filter(e => e.type === 'sous-dosage').length, 3);
  const mixte = etatFin();
  mixte.sites.combustibles.dosage = 'pleine';
  assert.strictEqual(E.clore(mixte).casseGarde, 900);
  const pleines = etatFin();
  for (const id of ['combustibles', 'galeries', 'digues']) pleines.sites[id].dosage = 'pleine';
  assert.ok(E.clore(pleines).casseGarde === 0 && pleines.X === 0);
  assert.ok(E.rapportTexte(s, 'test').includes('Issue : Clore'));
});

test('Poursuivre : chaque pas retire un dixième de ce qui reste et dure le double du précédent ; plus de Clore', () => {
  const s = etatFin();
  assert.strictEqual(E.lancerPas(s), false, 'pas de pas sans avoir choisi');
  assert.ok(E.poursuivre(s) && s.issue === 'poursuivre');
  assert.strictEqual(E.clore(s), null);
  assert.ok(E.dureePas(s) === 60 && Math.abs(E.retraitPas(s) - 0.24) < 1e-12);
  assert.ok(E.lancerPas(s) && !E.lancerPas(s), 'un pas à la fois');
  let t0 = s.t;
  const ev = jusquA(s, () => !s.pasEnCours, 3000);
  assert.ok(Math.abs(s.t - t0 - 60) < 0.3 && ev.some(e => e.type === 'pas' && e.n === 1));
  assert.ok(Math.abs(s.E - 2.16) < 1e-12 && s.pasFaits === 1 && E.dureePas(s) === 120);
  E.relancer(s);   // rien n'accélère un pas, pas même la relance
  s.E = 2.16; s.plancher = 2.4;
  t0 = s.t; E.lancerPas(s);
  jusquA(s, () => !s.pasEnCours, 3000);
  assert.ok(Math.abs(s.t - t0 - 120) < 0.3 && s.pasFaits === 2 && E.dureePas(s) === 240);
  assert.ok(E.rapportTexte(s, 'test').includes('Issue : Poursuivre') && E.rapportTexte(s, 'test').includes('2 pas faits sous le plancher'));
});

test('Poursuivre : le pas avance hors ligne ; une relance ramène l\'Empreinte au plancher, doublé', () => {
  const s = etatFin();
  E.poursuivre(s); E.lancerPas(s);
  E.applyOffline(s, 30);
  assert.ok(s.pasEnCours && Math.abs(s.pasProgress - 0.5) < 1e-9);
  const a = E.applyOffline(s, 3600);
  assert.ok(!s.pasEnCours && s.pasFaits === 1 && a.pas === 1 && Math.abs(s.E - 2.16) < 1e-12, 'le pas finit ; le suivant attend le joueur');
  E.relancer(s);
  assert.ok(s.plancher === 4.8 && s.E === 4.8, 'tout le chemin fait est perdu');
});

test('l\'ordre sans Casse est celui du joueur, réparé au plus juste', () => {
  const ids = (o) => o.map(x => x.id + (x.ajoute ? '+' : '') + (x.retarde ? '↓' : '') + (x.sansVite ? '~' : '') + (x.inevitable ? '!' : ''));
  // Acte I : la centrale à charbon d'abord, sans jamais rendre l'hôpital autonome.
  const acte1 = ['charbon', 'gaz', 'pub', 'credit', 'aero', 'suv', 'dc', 'ciment'].map(id => ({ id }));
  assert.deepStrictEqual(ids(E.ordrePropre(1, acte1)), ['gaz', 'pub', 'credit', 'aero', 'suv', 'dc', 'ciment', 'autonomie+', 'charbon↓']);
  // Un ordre déjà propre revient tel quel.
  const propre1 = ['pub', 'credit', 'aero', 'suv', 'dc', 'ciment', 'charbon', 'autonomie', 'gaz'];
  assert.deepStrictEqual(ids(E.ordrePropre(1, propre1.map(id => ({ id })))), propre1);
  // Acte II : la production d'abord, sans mesures. Un ordre sans Casse existe, avec les mêmes sites.
  const acte2 = ['thermique', 'raffinerie', 'acierie', 'chimie', 'commerce', 'ski', 'ecrans'].map(id => ({ id }));
  const o2 = E.ordrePropre(2, acte2);
  assert.ok(!o2.some(x => x.inevitable), ids(o2).join(' '));
  for (const x of acte2) assert.ok(o2.some(y => y.id === x.id), x.id);
  assert.ok(o2.findIndex(x => x.id === 'uv') < o2.findIndex(x => x.id === 'chimie'), 'la filtration UV avant la chimie');
  // Démolir vite : le même site, sans la pollution.
  assert.deepStrictEqual(ids(E.ordrePropre(2, [{ id: 'uv' }, { id: 'sobriete' }, { id: 'commerce' }, { id: 'ecrans' }, { id: 'ski' }, { id: 'chimie', vite: true }, { id: 'acierie', vite: true }, { id: 'raffinerie' }, { id: 'thermique' }])),
    ['uv', 'sobriete', 'commerce', 'ecrans', 'ski', 'chimie~', 'acierie~', 'raffinerie', 'thermique']);
  // Acte III : le port d'abord isolerait ce qu'il dessert ; les céréales sans les ceintures feraient une pénurie.
  const o3 = E.ordrePropre(3, ['port', 'cereales', 'elevages', 'peche', 'autoroute', 'entrepots', 'centrales', 'serres'].map(id => ({ id })));
  assert.ok(!o3.some(x => x.inevitable), ids(o3).join(' '));
  assert.ok(o3.findIndex(x => x.id === 'port') > o3.findIndex(x => x.id === 'peche'), 'le port après ce qu\'il dessert');
  assert.ok(o3.some(x => x.id === 'ceintures' && x.ajoute));
});

test('l\'inventaire reprend tout ce qui a été fait, acte par acte, avec la Casse à sa place', () => {
  const { s } = simuler({ profil: 'pressé', reaction: 10 });
  jusquA(s, () => E.peutChoisir(s), 2000);
  const inv = E.inventaire(s);
  assert.strictEqual(inv.actes.length, 5);
  assert.ok(inv.actes[0].identique && inv.actes[0].casse === 0, 'acte I : rien à redire');
  const a2 = inv.actes[1], a3 = inv.actes[2];
  assert.ok(a2.casse === 3400 && a2.coupures === 3 && !a2.identique && a2.inevitables === 0);
  assert.strictEqual(a2.propre.filter(x => !x.ajoute).length, 7, 'les sept sites de l\'acte, restes compris');
  assert.ok(a2.lignes.some(l => l.type === 'engage' && l.notes.some(n => n.quoi === 'delestage' && n.casse > 0)), 'un délestage est rangé sous le lancement qui l\'a causé');
  assert.ok(a3.casse === s.penurieX && a3.lignes.filter(l => l.type === 'penurie').length === 3 && a3.aBras === 6);
  assert.ok(inv.actes[1].lignes.concat(a3.lignes).some(l => l.type === 'relance' && l.auto), 'les relances du Conseil y sont');
  assert.ok(inv.actes[3].propre === undefined && inv.actes[4].propre === undefined && inv.actes[4].lignes.length === 28);
  assert.ok(inv.actes[4].lignes.some(l => l.habitants));
  assert.strictEqual(inv.actes.reduce((t, a) => t + a.casse, 0), s.X, 'toute la Casse de la partie y est');
  assert.ok(inv.casseAvant === s.X && inv.casseFinale === s.X + 2100);
  assert.ok(E.clore(s) && s.X === inv.casseFinale);
  // Le joueur prudent : aucun ordre à redire, aucune Casse, sauf celle des gardes réduites.
  const p = simuler({ profil: 'prudent', reaction: 10 }).s;
  const ip = E.inventaire(p);
  assert.ok(ip.actes.slice(0, 3).every(a => a.identique && a.casse === 0) && ip.casseAvant === 0 && ip.casseFinale === 2100);
});

test('une partie close ou poursuivie se reprend ; une sauvegarde d\'avant les fins aussi', () => {
  const clos = etatFin(); E.clore(clos);
  const c = E.migrer(allerRetour(clos));
  assert.ok(c.issue === 'clore' && c.casseGarde === 2100 && c.X === 2100 && c.ms.clore === clos.ms.clore);
  assert.strictEqual(E.relancer(c), null);
  const suite = etatFin(); E.poursuivre(suite); E.lancerPas(suite);
  for (let i = 0; i < 300; i++) E.tick(suite, 0.1);
  const p = E.migrer(allerRetour(suite));
  assert.ok(p.issue === 'poursuivre' && p.pasEnCours && Math.abs(p.pasProgress - 0.5) < 0.01 && p.pasFaits === 0);
  const ancienne = allerRetour(etatFin());
  for (const k of ['issue', 'casseGarde', 'plancherSurcroit', 'pasFaits', 'pasEnCours', 'pasProgress']) delete ancienne[k];
  for (const k of ['clore', 'poursuivre']) delete ancienne.ms[k];
  const a = E.migrer(ancienne);
  assert.ok(a.issue === null && a.casseGarde === 0 && a.plancherSurcroit === 1 && a.pasFaits === 0 && !a.pasEnCours && E.peutChoisir(a));
  assert.strictEqual(E.migrer(Object.assign(allerRetour(etatFin()), { issue: 'autre' })).issue, null);
});

test('sous le plancher, l\'Empreinte se lit à trois chiffres', () => {
  assert.strictEqual(E.fmtPas(2.16), '2,16');
  assert.strictEqual(E.fmtPas(0.08712), '0,0871');
  assert.strictEqual(E.fmtPas(38.4), '38,4');
});

// ---- Ce que les cartes annoncent, le moteur le fait (issue #35) ----
test('aucun site n\'annonce d\'ajouter de l\'Empreinte : le moteur ne le ferait pas', () => {
  for (const d of E.D.sites) assert.ok(d.part > 0 || d.E >= 0, `${d.id} : E = ${d.E}`);
});

test('l\'autonomie de l\'hôpital ne retire rien et n\'ajoute rien à l\'Empreinte', () => {
  const s = Object.assign(E.create(), { started: true, K: 900, M: 5000 });
  for (const d of E.D.sites) if (d.g) s.sites[d.id].state = 'eteint';   // plus de croissance : seule la mesure peut faire bouger l'Empreinte
  assert.strictEqual(E.defs.autonomie.E, 0);
  E.engage(s, 'autonomie');
  const avant = s.E;
  for (let i = 0; i < 2000 && s.sites.autonomie.state === 'chantier'; i++) E.tick(s, 0.1);
  assert.ok(s.sites.autonomie.state === 'fait' && s.hopital === 'autonome');
  assert.strictEqual(s.E, avant);
  assert.strictEqual(s.sites.autonomie.Eretire, 0);
});

// ---- Vérification des invariants (tools/check.js) : le jugement, sur des mesures fabriquées ----
const C = require('./check.js');
const PAGE = { 'index.html': '<button id="btn-relancer" class="btn-relancer">Relancer</button><div id="casse-bloc" class="casse"><span id="casse">0</span></div>', 'main.js': '' };
// Une partie où tout tient ; `extra` y casse un invariant.
function partieSaine(extra) {
  return Object.assign({
    nom: 'témoin', autreJeu: false, finie: true, duree: 5400,
    pertes: [600, 1800, 3000, 4200, 5400], sansChiffre: C.plusLongSansChiffre([600, 1800, 3000, 4200, 5400], 5400),
    coutParActe: [12, 19, 9000, 400000, 5e8],
    casse: { baisses: [], sauvegarde: true, horsLigne: true, cloture: true },
    terre: { ecart: 12, fin: 65 },
    relance: { essais: 400, actes: 5, echecs: [] },
  }, extra);
}
const jugement = (extra, opts) => C.juger([partieSaine(extra)], Object.assign({ fichiers: PAGE, connus: [], multiplicateurs: [{ nom: 'témoin', facteur: 2 }] }, opts));
const enEchec = (sections) => sections.flatMap(sec => sec.lignes.filter(l => l.etat === 'echec').map(() => sec.titre.slice(0, 2)));

test('la vérification passe quand tous les invariants tiennent', () => {
  assert.deepStrictEqual(enEchec(jugement()), []);
});

test('chaque invariant cassé fait échouer la vérification', () => {
  const pertes = [600, 1800, 3400, 4200, 5400];   // 26 min 40 entre le 2e et le 3e chiffre
  assert.deepStrictEqual(enEchec(jugement({ pertes, sansChiffre: C.plusLongSansChiffre(pertes, 5400) })), ['I1']);
  assert.deepStrictEqual(enEchec(jugement({}, { multiplicateurs: [{ nom: 'témoin', facteur: 2.5 }] })), ['I2']);
  assert.deepStrictEqual(enEchec(jugement({ coutParActe: [12, 11, 9000, 400000, 5e8] })), ['I3']);
  assert.deepStrictEqual(enEchec(jugement({ coutParActe: [12, 19, 9000, 400000, 3e5] })), ['I3']);
  assert.deepStrictEqual(enEchec(jugement({ casse: { baisses: [1200], sauvegarde: true, horsLigne: true } })), ['I4']);
  assert.deepStrictEqual(enEchec(jugement({ casse: { baisses: [], sauvegarde: false, horsLigne: true } })), ['I4']);
  assert.deepStrictEqual(enEchec(jugement({ casse: { baisses: [], sauvegarde: true, horsLigne: true, cloture: false } })), ['I4']);
  assert.deepStrictEqual(enEchec(jugement({ terre: { ecart: 21, fin: 65 } })), ['I5']);
  assert.deepStrictEqual(enEchec(jugement({ relance: { essais: 400, actes: 5, echecs: [3000] } })), ['I6']);
  assert.deepStrictEqual(enEchec(jugement({ relance: { essais: 400, actes: 4, echecs: [] } })), ['I6']);
  assert.deepStrictEqual(enEchec(jugement({ finie: false })), ['Pa']);   // une partie qui ne finit pas
});

test('la relance continue est un autre jeu : I1 et I3 ne s\'y appliquent pas', () => {
  const pertes = [600];
  const m = { autreJeu: true, pertes, sansChiffre: C.plusLongSansChiffre(pertes, 5400), coutParActe: [12, 19, 60, null, null] };
  assert.deepStrictEqual(enEchec(jugement(m)), []);
  assert.deepStrictEqual(enEchec(jugement(Object.assign(m, { terre: { ecart: 30, fin: 65 } }))), ['I5']);
});

test('au plancher, le coût d\'un point n\'a plus de borne : I3 tient, même deux actes de suite', () => {
  assert.deepStrictEqual(enEchec(jugement({ coutParActe: [12, 19, 9000, 400000, Infinity] })), []);
  assert.deepStrictEqual(enEchec(jugement({ coutParActe: [12, 19, 9000, Infinity, Infinity] })), []);
  assert.deepStrictEqual(enEchec(jugement({ coutParActe: [12, 19, 9000, Infinity, 5e8] })), ['I3']);
});

test('un écart connu passe sous son plafond, échoue s\'il s\'aggrave, et aussi s\'il se résorbe', () => {
  const connus = [{ inv: 'I1', partie: 'témoin', plafond: 28 * 60, ref: 'test' }];
  const avec = (ecart) => { const pertes = [600, 600 + ecart]; return jugement({ pertes, sansChiffre: C.plusLongSansChiffre(pertes, 600 + ecart) }, { connus }); };
  assert.strictEqual(C.compter(avec(27 * 60), 'connu'), 1);
  assert.deepStrictEqual(enEchec(avec(27 * 60)), []);
  assert.deepStrictEqual(enEchec(avec(29 * 60)), ['I1']);
  assert.deepStrictEqual(enEchec(avec(20 * 60)), ['I1']);
});

test('les mesures : le plus long moment sans chiffre, l\'écart à la droite', () => {
  assert.deepStrictEqual(C.plusLongSansChiffre([600, 1800], 2000), { duree: 1200, rang: 2, dernier: false });
  assert.deepStrictEqual(C.plusLongSansChiffre([600], 2600), { duree: 2000, rang: 2, dernier: true });   // rien après le dernier chiffre
  assert.deepStrictEqual(C.plusLongSansChiffre([], 900), { duree: 900, rang: 1, dernier: true });
  const droite = [], marche = [];
  for (let t = 0; t <= 100; t++) { droite.push([t, 3 * t]); marche.push([t, t < 50 ? 0 : 100]); }
  assert.ok(C.ecartDroite(droite) < 1e-9);
  assert.ok(C.ecartDroite(marche) > 20);
});

test('l\'affichage : la Casse et le bouton Relancer sont dans la page, et rien ne les masque', () => {
  assert.strictEqual(C.affichage('btn-relancer', PAGE), null);
  assert.strictEqual(C.affichage('casse-bloc', PAGE), null);
  const page = (html, js) => ({ 'index.html': html, 'main.js': js || '' });
  assert.ok(C.affichage('btn-relancer', page('<p>rien</p>')));
  assert.ok(C.affichage('btn-relancer', page('<button id="btn-relancer" hidden>Relancer</button>')));
  assert.ok(C.affichage('btn-relancer', page('<button id="btn-relancer" disabled>Relancer</button>')));
  assert.ok(C.affichage('casse-bloc', page(PAGE['index.html'], "$('casse-bloc').hidden = s.X === 0;")));
  assert.ok(enEchec(jugement({}, { fichiers: page('<div id="casse-bloc"><span id="casse">0</span></div>') })).includes('I6'));
});

test('les écarts connus désignent des parties qui existent, au-dessus du seuil', () => {
  const noms = C.PARTIES.map(p => (p.reaction ? `${p.profil} ${p.reaction} s` : p.profil));
  for (const c of C.ECARTS_CONNUS) {
    assert.ok(noms.includes(c.partie), c.partie);
    assert.ok(c.plafond > C.SEUILS[c.inv], `${c.inv} ${c.partie}`);
  }
});

console.log(`\n${passes} tests passés`);
