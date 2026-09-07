// Simulation hors navigateur : un joueur automatique joue l'acte I.
// node tools/simulate.js [prudent|pressé|croissance|relance-1]
const E = require('../engine.js');
const D = E.D;

const profil = process.argv[2] || 'prudent';
const reaction = Number(process.argv[3] || 0); // secondes d'attente avant chaque action (simule un humain)
let prochainAction = 0;
const ordre = ['pub', 'credit', 'aero', 'suv', 'dc', 'ciment', 'charbon', 'autonomie', 'gaz'];

const s = E.create();
const dt = 0.1;
const marks = [];
let relanceFaite = 0;
let maxE = s.E;
let minEavantStab = Infinity;

for (let i = 0; i < 30 * 60 * 10; i++) {
  if (s.t >= prochainAction) { if (E.reconvertir(s)) prochainAction = s.t + reaction; }
  for (const id of ordre) {
    if (s.t < prochainAction) break;
    const c = E.canEngage(s, id);
    if (!c.ok) continue;
    if (profil === 'prudent' && c.coupures.length) continue;
    if (profil === 'prudent' && id === 'gaz' && s.hopital !== 'autonome') continue;
    if (profil === 'prudent' && id === 'autonomie' && s.sites.charbon.state === 'actif') continue;
    const ev = E.engage(s, id);
    prochainAction = s.t + reaction;
    marks.push(`${E.fmtDur(s.t)}  engage ${id}  E=${E.fmt(s.E)}  g=${E.gSites(s).toFixed(2)}` + (ev.some(e => e.type === 'coupure') ? '  COUPURE' : ''));
  }
  if (profil === 'relance-1' && s.t > 120 && !relanceFaite) { E.relancer(s); relanceFaite++; marks.push(`${E.fmtDur(s.t)}  RELANCE`); }
  if (profil === 'croissance' && !E.relanceActive(s)) { E.relancer(s); }
  const evs = E.tick(s, dt);
  for (const ev of evs) {
    if (['stabilise', 'chiffre', 'coupure', 'fin', 'relance', 'ferme'].includes(ev.type))
      marks.push(`${E.fmtDur(s.t)}  ${ev.type.toUpperCase()} ${ev.id || ev.dep || ''}  E=${E.fmt(s.E)}  K=${Math.floor(s.K)} M=${s.M}/${s.Meng} dep=${s.deplaces} Co=${s.Co.toFixed(0)} X=${s.X} T=${E.T(s).toFixed(2)}`);
  }
  if (s.E > maxE) maxE = s.E;
  if (s.ms.stabilise === null && s.E < minEavantStab) minEavantStab = s.E;
  if (s.ms.fin !== null && s.t - s.ms.fin > 5) break;
}
console.log(marks.join('\n'));
console.log('---');
console.log(`profil=${profil}  E max=${E.fmt(maxE)}  E min avant stabilisation=${E.fmt(minEavantStab)}  marge=${E.fmt(minEavantStab - 1e9)}`);
console.log(`stabilisation=${s.ms.stabilise !== null ? E.fmtDur(s.ms.stabilise) : '—'}  premier chiffre=${s.ms.chiffre !== null ? E.fmtDur(s.ms.chiffre) : '—'}  fin=${s.ms.fin !== null ? E.fmtDur(s.ms.fin) : '—'}  E final=${E.fmt(s.E)}  X=${s.X}  Co=${s.Co.toFixed(0)}  T=${E.T(s).toFixed(1)}/${E.Tmax()}`);
