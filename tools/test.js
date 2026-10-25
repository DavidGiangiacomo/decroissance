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
  s.E = 1.02e8;
  E.engage(s, 'acierie');
  let ev = [];
  for (let i = 0; i < E.defs.acierie.dur * 10 + 5; i++) ev = ev.concat(E.tick(s, 0.1));
  assert.ok(types(ev).includes('chiffre'));
  assert.deepStrictEqual(s.regionsEteintes, ['Cherbaix']);
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

console.log(`\n${passes} tests passés`);
