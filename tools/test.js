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

console.log(`\n${passes} tests passés`);
