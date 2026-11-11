// Vérifie les invariants d'équilibrage du §9 du design doc (issue #11) : les bots du simulateur jouent, et chaque
// invariant mesurable est comparé à son seuil. Sort en erreur si l'un d'eux est cassé.
// Usage : node tools/check.js
const fs = require('fs'), path = require('path');
const E = require('../engine.js');
const { simuler } = require('./simulate.js');
const D = E.D;

const SEUILS = {
  I1: 25 * 60,   // secondes : jamais plus longtemps sans chiffre perdu (#4)
  I2: 2,         // aucun multiplicateur permanent au-delà, cumul compris
  I5: 20,        // % de la Terre rendue finale : écart maximal à la droite la plus proche. La cible du §9 s'en écarte de 4 %.
};

// Les parties jouées : chaque joueur du simulateur à 10, 30 et 45 s de réaction, et la relance continue.
// La relance continue est un autre jeu (§8, usage 3) : I1 et I3 ne s'y appliquent pas.
const PARTIES = [];
for (const profil of ['prudent', 'pressé', 'vite', 'relance-1']) for (const reaction of [10, 30, 45]) PARTIES.push({ profil, reaction });
PARTIES.push({ profil: 'croissance', reaction: 0, autreJeu: true });
const nomPartie = (p) => (p.reaction ? `${p.profil} ${p.reaction} s` : p.profil);

// Écarts connus : des invariants déjà cassés par le réglage actuel, et documentés. Ils ne font pas échouer la
// vérification tant que la mesure reste sous `plafond`. Elle échoue si l'un d'eux s'aggrave, et aussi s'il se
// résorbe : il faut alors retirer sa ligne, pour que le seuil normal s'applique de nouveau.
const ECARTS_CONNUS = [
  { inv: 'I1', partie: 'prudent 45 s', plafond: 28 * 60, ref: 'joueurs très lents, docs/acte-2.md' },
  { inv: 'I1', partie: 'pressé 45 s', plafond: 35 * 60, ref: 'joueurs très lents, docs/acte-3.md' },
  { inv: 'I1', partie: 'vite 45 s', plafond: 33 * 60, ref: 'joueurs très lents, docs/acte-2.md' },
  { inv: 'I1', partie: 'relance-1 45 s', plafond: 37 * 60, ref: 'joueurs très lents, docs/acte-2.md' },
  { inv: 'I1', partie: 'vite 30 s', plafond: 26 * 60, ref: "transition vers l'acte IV, docs/acte-4.md" },
];

// ---- mesures ----

// I1 : le plus long moment sans chiffre perdu, du début de la partie à `fin` : le dernier instant où un chiffre
// pouvait encore tomber. Une fois l'Empreinte au plancher, il n'en reste plus à perdre.
function plusLongSansChiffre(pertes, fin) {
  const bornes = [0, ...pertes, fin];
  let duree = 0, rang = 0;
  for (let i = 1; i < bornes.length; i++) if (bornes[i] - bornes[i - 1] > duree) { duree = bornes[i] - bornes[i - 1]; rang = i; }
  return { duree, rang, dernier: rang === bornes.length - 1 };   // rang : celui du chiffre attendu ; dernier : il n'est pas venu
}

// I5 : écart maximal de la courbe à la droite des moindres carrés, en % de la valeur finale. points : [temps, valeur].
function ecartDroite(points) {
  const n = points.length, fin = points[n - 1][1];
  if (n < 3 || !(fin > 0)) return 0;
  const mt = points.reduce((a, p) => a + p[0], 0) / n, mv = points.reduce((a, p) => a + p[1], 0) / n;
  let stv = 0, stt = 0;
  for (const [t, v] of points) { stv += (t - mt) * (v - mv); stt += (t - mt) * (t - mt); }
  const pente = stv / stt, origine = mv - pente * mt;
  return 100 * Math.max(...points.map(([t, v]) => Math.abs(v - (origine + pente * t)))) / fin;
}

// Fait jouer une partie et relève, pas à pas, ce que chaque invariant demande.
function mesurer(partie) {
  const dt = D.TICK;
  const cout = {}, retire = {};          // I3 : Capacité et Mains engagées, Empreinte retirée, par acte
  const baisses = [];                    // I4 : les instants où la Casse a baissé
  const terre = [[0, 0]];                // I5 : la Terre rendue, toutes les 10 s de temps réel
  const relance = { essais: 0, actes: new Set(), echecs: [] };   // I6
  let ticks = 0, casse = 0;
  let finChiffres = 0;                   // I1 : le dernier instant où un chiffre pouvait encore tomber
  const acteDuSite = (id) => E.acteDe(E.defs[id]);
  const ajouter = (o, acte, n) => { o[acte] = (o[acte] || 0) + n; };
  const suivreCasse = (s) => { if (s.X < casse) baisses.push(s.t); casse = s.X; };
  // I6 : sur une copie de la partie, la relance doit répondre, ramener la croissance, et ne rien effacer de la Casse.
  function essayerRelance(s) {
    if (E.relanceActive(s)) return;   // une relance court déjà : le bouton attend qu'elle finisse
    const c = structuredClone(s);
    const r = E.relancer(c, false);
    relance.essais++; relance.actes.add(s.acte);
    if (!r || !E.relanceActive(c) || !(E.gEff(c) > 0)) relance.echecs.push(s.t);
    if (c.X < s.X) baisses.push(s.t);
  }
  const suivi = {
    engage(s, id, c) {
      // Un geste de l'acte V demande son équipe, que ce soient des Mains ou, faute de Mains, les habitants.
      ajouter(cout, acteDuSite(id), c.K + (E.defs[id].geste ? E.defs[id].M : c.M));
      suivreCasse(s);
    },
    pas(s, evs) {
      ticks++;
      suivreCasse(s);
      if (E.digitsOf(s.E) > E.digitsOf(s.plancher)) finChiffres = s.t;   // au plancher, plus rien ne peut tomber
      if (ticks % 100 === 0) terre.push([ticks * dt, E.T(s)]);
      if (ticks === 1 || ticks % 150 === 0 || evs.length) essayerRelance(s);
      for (const ev of evs) {
        if (ev.type === 'ferme' || ev.type === 'garde') ajouter(retire, acteDuSite(ev.id), s.sites[ev.id].Eretire || 0);
        // Un site coupé ou délesté perd une part de son Empreinte sans rien coûter : elle compte dans son acte.
        const coupe = ev.type === 'coupure' ? ev.dep : ev.type === 'delestage' ? ev.id : null;
        if (coupe && E.defs[coupe]) ajouter(retire, acteDuSite(coupe), E.defs[coupe].E * D.COUPURE_SITE_E);
      }
    },
  };
  const { s } = simuler({ profil: partie.profil, reaction: partie.reaction, suivi });
  terre.push([ticks * dt, E.T(s)]);

  // I4 : ni une sauvegarde rechargée, ni douze heures hors ligne n'effacent la Casse.
  const recharge = E.migrer(JSON.parse(JSON.stringify(s)));
  const sauvegarde = !!recharge && recharge.X === s.X;
  if (recharge) E.applyOffline(recharge, D.OFFLINE_CAP);
  const horsLigne = !!recharge && recharge.X >= s.X;
  // Clore ne fait qu'en ajouter : celle des gardes réduites.
  const clos = structuredClone(s);
  for (let i = 0; i < 3000 && !E.peutChoisir(clos); i++) E.tick(clos, dt);
  const cloture = !E.clore(clos) || clos.X >= s.X;

  // I6 : les relances que le joueur ou le Conseil ont vraiment faites comptent aussi, chacune dans son acte.
  const acteA = (t) => 1 + Object.keys(E.TITRES_ACTES).filter(a => a > 1 && s.ms['acte' + a] != null && s.ms['acte' + a] <= t).length;
  for (const e of s.chrono) if (e.type === 'relance') relance.actes.add(acteA(e.t));

  const pertes = s.chrono.filter(e => e.type === 'chiffre').map(e => e.t);
  const actes = [];
  // Un acte qui coûte sans plus rien retirer, parce que l'Empreinte est au plancher : un coût par point sans borne.
  for (let a = 1; a <= E.DERNIER_ACTE; a++) actes.push(retire[a] > 0 ? (cout[a] || 0) / retire[a] * 1e6 : cout[a] > 0 ? Infinity : null);
  return {
    nom: nomPartie(partie), autreJeu: !!partie.autreJeu,
    finie: s.ms['fin' + (E.DERNIER_ACTE === 1 ? '' : E.DERNIER_ACTE)] !== null, duree: s.t,
    pertes, sansChiffre: plusLongSansChiffre(pertes, Math.max(finChiffres, pertes.length ? pertes[pertes.length - 1] : 0)),
    coutParActe: actes,
    casse: { baisses, sauvegarde, horsLigne, cloture },
    terre: { ecart: ecartDroite(terre), fin: E.T(s) },
    relance: { essais: relance.essais, actes: relance.actes.size, echecs: relance.echecs },
  };
}

// I2 : les multiplicateurs permanents en faveur du joueur. Aujourd'hui, un seul : les places de formation, que les
// centres de formation doublent. Les décisions du §7 (#18) s'ajouteront ici, branche par branche, cumul compris.
function multiplicateurs() {
  const sans = E.create(), avec = E.create();
  for (const d of D.sites) if (d.mesure) avec.sites[d.id].state = 'fait';
  return [{ nom: 'places de formation, avec les centres', facteur: E.placesFormation(avec) / E.placesFormation(sans) }];
}

// I4 et I6, côté écran : le compteur de Casse et le bouton Relancer sont dans la page, et rien ne les masque.
// Les deux valent jusqu'à Clore : une partie close ne montre plus que la carte (§11).
// Vérification du code, pas du rendu : une règle de style.css ou un masquage indirect lui échappent.
function affichage(id, fichiers) {
  const html = fichiers['index.html'], js = fichiers['main.js'];
  const balise = (html.match(new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`)) || [null])[0];
  if (!balise) return `#${id} est absent de index.html`;
  if (/\shidden\b|display:\s*none/.test(balise)) return `#${id} est masqué dans index.html`;
  if (id.startsWith('btn-') && /\sdisabled\b/.test(balise)) return `#${id} est désactivé dans index.html`;
  if (new RegExp(`\\$\\('${id}'\\)\\.(hidden|style\\.(display|visibility))\\s*=`).test(js)) return `main.js masque #${id}`;
  return null;
}
function lireFichiers() {
  const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  return { 'index.html': lire('index.html'), 'main.js': lire('main.js') };
}

// ---- jugement ----

const nombre = (x) => (x < 100 ? x.toFixed(1).replace('.', ',') : E.fmt(Number(x.toPrecision(3))));
const pourcent = (x) => `${x.toFixed(1).replace('.', ',')} %`;
const RANGS = ['', '1er', '2e', '3e', '4e', '5e', '6e', '7e', '8e', '9e'];

// Compare une mesure à son seuil, en tenant compte des écarts connus. Renvoie { etat: ok | connu | echec, texte }.
function comparer(inv, partie, valeur, format, detail, connus) {
  const connu = (connus || ECARTS_CONNUS).find(c => c.inv === inv && c.partie === partie);
  const texte = `${format(valeur)}${detail ? ` ${detail}` : ''}`;
  if (valeur <= SEUILS[inv]) {
    return connu ? { etat: 'echec', texte: `${texte} : l'invariant tient de nouveau. Retirer cet écart connu de tools/check.js.` } : { etat: 'ok', texte };
  }
  if (!connu) return { etat: 'echec', texte: `${texte}, pour ${format(SEUILS[inv])} au plus` };
  if (valeur > connu.plafond) return { etat: 'echec', texte: `${texte} : l'écart connu s'aggrave (plafond ${format(connu.plafond)} ; ${connu.ref})` };
  return { etat: 'connu', texte: `${texte}, plafond ${format(connu.plafond)} (${connu.ref})` };
}

// Juge les mesures. Renvoie les sections du rapport : { titre, lignes: [{ etat, nom, texte }] }.
// etat : ok, connu (écart connu, sous son plafond), echec, ou info (sans objet).
function juger(mesures, opts) {
  opts = opts || {};
  const connus = opts.connus || ECARTS_CONNUS;
  const sections = [];
  const section = (titre) => { const lignes = []; sections.push({ titre, lignes }); return (etat, nom, texte) => lignes.push({ etat, nom, texte }); };
  const inachevees = mesures.filter(m => !m.finie);

  // I1
  let ligne = section(`I1 — jamais plus de ${E.fmtDur(SEUILS.I1)} sans chiffre perdu`);
  for (const m of mesures) {
    if (m.autreJeu) { ligne('info', m.nom, 'sans objet : la relance continue est un autre jeu (§8)'); continue; }
    const g = m.sansChiffre, n = m.pertes.length;
    const ou = g.dernier ? `après le ${RANGS[n] || n + 'e'} chiffre` : `avant le ${RANGS[g.rang] || g.rang + 'e'} chiffre`;
    const moyenne = n ? ` ; ${n} chiffres, un toutes les ${E.fmtDur(m.duree / n)} en moyenne` : ' ; aucun chiffre perdu';
    const r = comparer('I1', m.nom, g.duree, E.fmtDur, `au plus, ${ou}`, connus);
    ligne(r.etat, m.nom, r.texte + (r.etat === 'echec' ? '' : moyenne));
  }

  // I2
  ligne = section(`I2 — aucun multiplicateur permanent au-delà de ×${SEUILS.I2}`);
  for (const x of opts.multiplicateurs || multiplicateurs()) {
    ligne(x.facteur <= SEUILS.I2 ? 'ok' : 'echec', x.nom, `×${String(x.facteur).replace('.', ',')}`);
  }
  ligne('info', 'décisions du §7', 'pas encore dans le jeu (#18) : rien à mesurer');

  // I3
  ligne = section("I3 — le coût d'un point d'Empreinte croît d'acte en acte (Capacité et Mains engagées par million de points retirés)");
  for (const m of mesures) {
    if (m.autreJeu) { ligne('info', m.nom, 'sans objet : la relance continue est un autre jeu (§8)'); continue; }
    const c = m.coutParActe, suite = c.map(x => (x === null ? '—' : x === Infinity ? 'sans borne' : nombre(x))).join(' → ');
    // Au plancher, le coût par point n'a plus de borne : il ne recule pas, même deux actes de suite.
    const recul = c.findIndex((x, i) => i > 0 && (x === null || c[i - 1] === null || (x <= c[i - 1] && x !== Infinity)));
    if (recul > 0) ligne('echec', m.nom, `${suite} : l'acte ${recul + 1} ne coûte pas plus cher par point que l'acte ${recul}`);
    else ligne('ok', m.nom, suite);
  }

  // I4
  ligne = section('I4 — la Casse ne redescend jamais');
  let fautes = 0;
  for (const m of mesures) {
    const k = m.casse;
    if (k.baisses.length) { fautes++; ligne('echec', m.nom, `la Casse a baissé ${k.baisses.length} fois, d'abord à ${E.fmtDur(k.baisses[0])}`); }
    if (!k.sauvegarde) { fautes++; ligne('echec', m.nom, 'une sauvegarde rechargée ne rend pas la même Casse'); }
    if (!k.horsLigne) { fautes++; ligne('echec', m.nom, 'la Casse baisse hors ligne'); }
    if (k.cloture === false) { fautes++; ligne('echec', m.nom, 'la Casse baisse à la clôture'); }
  }
  if (!fautes) ligne('ok', `${mesures.length} parties`, "aucune baisse d'un pas à l'autre, ni après une relance, une sauvegarde rechargée, 12 h hors ligne ou la clôture");
  const fichiers = opts.fichiers || lireFichiers();
  let defaut = affichage('casse-bloc', fichiers) || affichage('casse', fichiers);
  ligne(defaut ? 'echec' : 'ok', 'affichage', defaut || "le compteur est dans la page, et rien dans le code ne le masque");

  // I5
  ligne = section(`I5 — la Terre rendue est quasi linéaire en temps réel : au plus ${SEUILS.I5} % d'écart à la droite la plus proche`);
  for (const m of mesures) {
    const r = comparer('I5', m.nom, m.terre.ecart, pourcent, '', connus);
    ligne(r.etat, m.nom, r.texte);
  }

  // I6
  ligne = section('I6 — le bouton Relancer reste visible et fonctionnel');
  fautes = 0;
  for (const m of mesures) {
    const r = m.relance;
    if (r.echecs.length) { fautes++; ligne('echec', m.nom, `la relance n'a pas répondu ${r.echecs.length} fois sur ${r.essais}, d'abord à ${E.fmtDur(r.echecs[0])}`); }
    else if (m.finie && r.actes < E.DERNIER_ACTE) { fautes++; ligne('echec', m.nom, `la relance n'a été vue que dans ${r.actes} des ${E.DERNIER_ACTE} actes`); }
  }
  const essais = mesures.reduce((a, m) => a + m.relance.essais, 0);
  if (!fautes) ligne('ok', `${mesures.length} parties`, `la relance répond et ramène la croissance aux ${E.fmt(essais)} instants essayés, dans chacun des ${E.DERNIER_ACTE} actes, hors relance en cours`);
  defaut = affichage('btn-relancer', fichiers);
  ligne(defaut ? 'echec' : 'ok', 'affichage', defaut || "le bouton est dans la page, et rien dans le code ne le masque");

  // Une partie qui ne va pas au bout laisse des mesures incomplètes : c'est une erreur, pas un invariant tenu.
  if (inachevees.length) {
    ligne = section('Parties');
    for (const m of inachevees) ligne('echec', m.nom, `la partie ne finit pas : arrêtée à ${E.fmtDur(m.duree)}`);
  }
  return sections;
}

const compter = (sections, etat) => sections.reduce((a, sec) => a + sec.lignes.filter(l => l.etat === etat).length, 0);

function afficher(sections) {
  const MARQUES = { ok: 'ok   ', connu: 'connu', echec: 'ÉCHEC', info: '—    ' };
  for (const sec of sections) {
    const large = Math.max(...sec.lignes.map(l => l.nom.length));
    console.log(`\n${sec.titre}`);
    for (const l of sec.lignes) console.log(`  ${MARQUES[l.etat]}  ${l.nom.padEnd(large)}  ${l.texte}`);
  }
}

if (require.main === module) {
  console.log(`Invariants du §9 : ${PARTIES.length} parties jouées par les bots de tools/simulate.js.`);
  const sections = juger(PARTIES.map(mesurer));
  afficher(sections);
  const echecs = compter(sections, 'echec'), connus = compter(sections, 'connu');
  const suite = connus ? ` ${connus} écart${connus > 1 ? 's' : ''} connu${connus > 1 ? 's' : ''}, sous ${connus > 1 ? 'leur' : 'son'} plafond.` : '';
  console.log(echecs ? `\n${echecs} vérification${echecs > 1 ? 's' : ''} en échec.${suite}` : `\nTous les invariants mesurables tiennent.${suite}`);
  process.exit(echecs ? 1 : 0);
}

module.exports = { SEUILS, PARTIES, ECARTS_CONNUS, mesurer, juger, compter, plusLongSansChiffre, ecartDroite, affichage, multiplicateurs };
