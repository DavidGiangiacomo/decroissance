// Simulation hors navigateur : un joueur automatique joue les actes I, II et III.
// node tools/simulate.js [profil] [réaction en s]
//   profils : prudent (par défaut), pressé, vite (prudent, mais démolit vite à l'acte II),
//             relance-1 (une relance à 2 min), croissance (relance en continu)
//   ex. : node tools/simulate.js prudent 10        node tools/simulate.js pressé 10
const E = require('../engine.js');
const D = E.D;

const profil = process.argv[2] || 'prudent';
const reaction = Number(process.argv[3] || 0); // secondes d'attente avant chaque action (simule un humain)
const ordreActe1 = ['pub', 'credit', 'aero', 'suv', 'dc', 'ciment', 'charbon', 'autonomie', 'gaz'];

const s = E.create();
s.started = true;
const dt = 0.1;
const marks = [];
let prochainAction = 0, relanceFaite = 0, maxE = s.E, minEavantStab = Infinity, rebond = 0;
const quand = (t) => E.fmtDur(t).padStart(11);

// Acte I : le joueur du MVP, inchangé. « Vite » y joue comme le prudent.
function choixActe1() {
  const prudent = profil === 'prudent' || profil === 'vite';
  for (const id of ordreActe1) {
    const c = E.canEngage(s, id);
    if (!c.ok) continue;
    if (prudent && c.coupures.length) continue;
    if (prudent && id === 'gaz' && s.hopital !== 'autonome') continue;
    if (prudent && id === 'autonomie' && s.sites.charbon.state === 'actif') continue;
    return { id };
  }
  return null;
}

// Acte II. Prudent : fait les mesures dès qu'il peut, puis la plus grosse Empreinte sans coupure.
// Pressé : la plus grosse Empreinte finançable, sans regarder la jauge, sans mesures.
// Vite : comme prudent, mais démolit vite tout ce qui peut l'être.
function choixActe2() {
  const restants = D.sites.filter(d => E.acteDe(d) === 2 && (s.sites[d.id].state === 'actif' || (s.sites[d.id].state === 'coupe' && !d.mesure)));
  if (profil !== 'pressé') {
    for (const d of restants.filter(d => d.mesure)) if (E.canEngage(s, d.id).ok) return { id: d.id };
  }
  for (const d of restants.filter(d => !d.mesure).sort((a, b) => b.E - a.E)) {
    const opts = profil === 'vite' && d.rapide ? { vite: true } : undefined;
    const c = E.canEngage(s, d.id, opts);
    if (!c.ok) continue;
    if (profil !== 'pressé' && (c.apercu.delestes.length || c.apercu.prives.length)) continue;
    return { id: d.id, opts };
  }
  return null;
}

// Acte III. Prudent : les mesures d'abord, puis la plus grosse part de l'Empreinte qui n'isole rien, ne crée pas
// de pénurie et laisse le Consentement au-dessus de 25 (il attend sinon que l'adhésion revienne).
// Pressé : la plus grosse part finançable, sans regarder ni la desserte, ni les vivres, ni le Consentement.
function choixActe3() {
  const restants = D.sites.filter(d => E.acteDe(d) === 3 && s.sites[d.id].state === 'actif');
  if (profil !== 'pressé') {
    for (const d of restants.filter(d => d.mesure)) if (E.canEngage(s, d.id).ok) return { id: d.id };
  }
  for (const d of restants.filter(d => !d.mesure).sort((a, b) => b.part - a.part)) {
    const c = E.canEngage(s, d.id);
    if (!c.ok) continue;
    if (profil !== 'pressé') {
      if (c.apercu.isoles.length || (c.apercu.vivres && c.apercu.vivres.bas < c.apercu.vivres.besoin)) continue;
      if (s.Co - d.co < 25) continue;
    }
    return { id: d.id };
  }
  return null;
}

let coMin3 = Infinity, mainsMax = 0, finDeux = null;   // finDeux : Casse, rebond et régions à la fin de l'acte II
for (let i = 0; i < 150 * 60 * 10; i++) {
  // À l'acte III, le prudent ne lance pas de formation qui ferait passer le Consentement sous le seuil du Conseil.
  const formerOk = s.acte < 3 || profil === 'pressé' || s.Co - D.RECONV.co >= D.RELANCE.autoSeuil + 0.5;
  if (s.t >= prochainAction && formerOk && E.reconvertir(s)) prochainAction = s.t + reaction;
  while (s.t >= prochainAction) {
    const choix = s.acte === 1 ? choixActe1() : s.acte === 2 ? choixActe2() : choixActe3();
    if (!choix) break;
    const ev = E.engage(s, choix.id, choix.opts);
    prochainAction = s.t + reaction;
    const casse = ev.filter(e => e.type === 'coupure' || e.type === 'delestage' || e.type === 'privation' || e.type === 'isolement');
    marks.push(`${quand(s.t)}  ${choix.opts ? 'démolition rapide' : 'engage'} ${choix.id}  E=${E.fmt(s.E)}  M=${s.M} attente=${s.deplaces} Co=${s.Co.toFixed(0)}` +
      (casse.length ? `  ${casse.map(e => `${e.type.toUpperCase()} ${e.id || e.dep || e.ids.join('+')}`).join(', ')}` : ''));
  }
  if (profil === 'relance-1' && s.t > 120 && !relanceFaite) { E.relancer(s); relanceFaite++; marks.push(`${quand(s.t)}  RELANCE`); }
  if (profil === 'croissance' && !E.relanceActive(s)) { E.relancer(s); }
  const avant = s.E, gReb = E.gRebond(s);
  const evs = E.tick(s, dt);
  if (s.paused <= 0 && gReb > 0) rebond += avant * (Math.exp(gReb / 100 / 60 * dt) - 1);
  for (const ev of evs) {
    if (['stabilise', 'chiffre', 'acte', 'fin', 'relance', 'ferme', 'pollution', 'region', 'arret', 'retour', 'penurie', 'penurie-fin'].includes(ev.type))
      marks.push(`${quand(s.t)}  ${ev.type.toUpperCase()} ${ev.id || ev.region || ev.digits || ev.n || ''}${ev.reembauche ? ` réembauche ${ev.reembauche}` : ''}  E=${E.fmt(s.E)}  K=${Math.floor(s.K)} M=${s.M} attente=${s.deplaces} Co=${s.Co.toFixed(0)} X=${E.fmt(s.X)}`);
  }
  if (s.E > maxE) maxE = s.E;
  if (s.ms.stabilise === null && s.E < minEavantStab) minEavantStab = s.E;
  if (s.acte >= 3) { coMin3 = Math.min(coMin3, s.Co); mainsMax = Math.max(mainsMax, s.M + s.Meng + E.enFormation(s)); }
  if (s.ms.fin2 !== null && !finDeux) finDeux = { casse: s.X, rebond, regions: [...s.regionsEteintes] };
  if (s.ms.fin3 !== null && s.t - s.ms.fin3 > 5) break;
}

const r = E.rapport(s, 'simulation');
const pertes = s.chrono.filter(e => e.type === 'chiffre').map(e => e.t);
console.log(marks.join('\n'));
console.log('---');
console.log(`profil=${profil}  réaction=${reaction} s  E max=${E.fmt(maxE)}  E min avant stabilisation=${E.fmt(minEavantStab)}`);
console.log(`acte I   stabilisation=${r.stabilisation !== null ? E.fmtDur(r.stabilisation) : '—'}  premier chiffre=${r.premierChiffre !== null ? E.fmtDur(r.premierChiffre) : '—'}  carte vidée=${r.carteVidee !== null ? E.fmtDur(r.carteVidee) : '—'}`);
if (r.acte2 !== null) {
  const ecart = pertes.length > 1 ? pertes[1] - pertes[0] : null;
  console.log(`acte II  ouvert=${E.fmtDur(r.acte2)}  deuxième chiffre=${r.deuxiemeChiffre !== null ? E.fmtDur(r.deuxiemeChiffre) : '—'}` +
    `  écart avec le premier=${ecart !== null ? E.fmtDur(ecart) : '—'}  réseau démantelé=${r.finActe2 !== null ? E.fmtDur(r.finActe2) : '—'}` +
    `  durée de l'acte=${r.finActe2 !== null ? E.fmtDur(r.finActe2 - r.acte2) : '—'}`);
  const f2 = finDeux || { casse: r.casse, rebond, regions: r.regionsEteintes };
  console.log(`         coupures et délestages=${r.coupures}  pollutions=${r.pollutions}  Casse=${E.fmt(f2.casse)}  rebond=+${E.fmt(f2.rebond)}  régions éteintes=${f2.regions.join(', ') || '—'}`);
}
if (r.acte3 !== null) {
  const ecarts = pertes.slice(1).map((t, i) => E.fmtDur(t - pertes[i]));
  console.log(`acte III ouvert=${E.fmtDur(r.acte3)}  carte vidée=${r.finActe3 !== null ? E.fmtDur(r.finActe3) : '—'}  durée de l'acte=${r.finActe3 !== null ? E.fmtDur(r.finActe3 - r.acte3) : '—'}` +
    `  chiffres perdus=${pertes.map(E.fmtDur).join(', ')}  écarts=${ecarts.join(', ')}`);
  console.log(`         pénuries=${r.penuries} (${E.fmt(r.cassePenurie)} personnes)  réembauchés=${E.fmt(r.reembauches)}  chantiers isolés=${r.chantiersIsoles}` +
    `  Co min acte III=${coMin3.toFixed(0)}  Mains au plus haut=${E.fmt(mainsMax)}  en attente à la fin=${E.fmt(s.deplaces)}` +
    `  relances du Conseil dans l'acte=${s.chrono.filter(e => e.type === 'relance' && e.auto && e.t >= r.acte3).length}`);
}
console.log(`fin      E=${E.fmt(s.E)}  Co=${s.Co.toFixed(0)}  T=${E.T(s).toFixed(1)}/${E.Tmax().toFixed(1)}  relances=${r.relances}  relances du Conseil=${r.relancesConseil}`);
