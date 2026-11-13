// Décroissance — point d'entrée : boucle, rendu, sauvegarde, événements. Actes I à V, et les fins : Clore, Poursuivre, Croissance.
(function () {
  const E = window.Engine, D = E.D;
  // Mode test (index.html?test) : l'accueil propose de reprendre la partie d'un bot à l'ouverture d'un acte, au choix
  // final ou au basculement dans la croissance. La partie de test a sa propre sauvegarde : elle ne touche pas à la vraie.
  const PARAMS = new URLSearchParams(location.search);
  const TEST = PARAMS.has('test') || PARAMS.has('depuis');
  const CLE = 'decroissance.mvp.v1' + (TEST ? '.test' : '');
  const $ = (id) => document.getElementById(id);
  // Version jouée : « dev » en local ; hash court et date du commit une fois publiée (tools/build-site.js).
  const VERSION = (document.querySelector('meta[name="version"]') || {}).content || 'dev';

  let s = null;            // état du jeu (objet plat, sérialisable)
  let son = new Son();
  let last = 0, timer = null, selection = null, dernierSave = 0;
  let animPerte = 0;       // fin d'animation de perte de chiffre (t réel)
  let cacheDepuis = null;  // instant (ms) où l'onglet a été caché, ou null
  const el = {};

  // ---------- sauvegarde ----------
  function sauver() {
    if (!s || window.Jeu.gel) return;
    s.savedAt = cacheDepuis !== null ? cacheDepuis : Date.now();   // onglet caché : l'absence court depuis qu'il l'est
    try { localStorage.setItem(CLE, JSON.stringify(s)); } catch (e) { /* stockage indisponible */ }
  }
  // Partie enregistrée : { etat, texte } si elle se reprend, { illisible, texte } si elle ne se relit pas, {} sinon.
  function lireSauvegarde() {
    let texte = null;
    try { texte = localStorage.getItem(CLE); } catch (e) { return {}; }
    if (!texte) return {};
    try {
      const etat = E.migrer(JSON.parse(texte));
      if (!etat) return { illisible: true, texte };
      return etat.started ? { etat, texte } : {};
    } catch (e) { return { illisible: true, texte }; }
  }
  function effacer() { try { localStorage.removeItem(CLE); } catch (e) {} }

  // ---------- carte ----------
  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVG, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const nomDe = (id) => (E.defs[id] || E.noeuds[id]).nom;
  // Flèche entre deux éléments de la carte, raccourcie aux deux bouts
  function fleche(a, b, titre, parent) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const p = svgEl('path', { d: `M${a.x + ux * 12},${a.y + uy * 12} L${b.x - ux * 14},${b.y - uy * 14}`, class: 'lien' }, parent);
    svgEl('title', {}, p).textContent = titre;
    return p;
  }
  const GLYPHES = {
    hopital: '<path class="croix glyphe" d="M-1.5,-6 h3 v4.5 h4.5 v3 h-4.5 v4.5 h-3 v-4.5 h-4.5 v-3 h4.5 z"/>',
    eau: '<path class="glyphe" d="M0,-6 C3,-1 5,1 5,3 A5,5 0 0 1 -5,3 C-5,1 -3,-1 0,-6 z"/>',
    pompage: '<path class="glyphe" d="M-6,-2 q3,-3 6,0 t6,0 v2 q-3,-3 -6,0 t-6,0 z M-6,3 q3,-3 6,0 t6,0 v2 q-3,-3 -6,0 t-6,0 z"/>',
    barrage: '<path class="glyphe" d="M-6,-5 h12 l-3,10 h-6 z"/>',
  };
  const LUMIERES = [[-11, -7], [-5, -11], [3, -10], [10, -5], [11, 3], [-10, 4], [-3, 8], [5, 8], [0, -2]];
  const reseauVisible = (x) => E.acteDe(x) >= 2;

  function construireCarte() {
    for (const id of ['regions', 'rendues', 'reseau-lignes', 'liens', 'sites']) $(id).innerHTML = '';
    // Régions : l'ombre qui tombe quand une région s'éteint (§10)
    for (const [cle, r] of Object.entries(D.regions)) {
      el['region-' + cle] = svgEl('circle', { cx: r.x, cy: r.y, r: r.r, class: 'ombre', fill: 'url(#ombre-region)' }, $('regions'));
      // Acte V : le vert qui revient sur une région à mesure qu'on la rend
      el['rendue-' + cle] = svgEl('circle', { cx: r.x, cy: r.y, r: r.r, class: 'rendue-region', fill: 'url(#vert-region)' }, $('rendues'));
    }
    // Le réseau de l'acte II : une ligne de chaque producteur ou consommateur vers le poste
    const gl = $('reseau-lignes'), P = D.POSTE;
    el.reseau = gl;
    for (const x of [...D.sites.filter(d => reseauVisible(d) && (d.prod || d.cons)), ...D.noeuds.filter(reseauVisible)]) {
      const l = svgEl('line', { x1: P.x, y1: P.y, x2: x.x, y2: x.y, class: 'ligne' }, gl);
      svgEl('title', {}, l).textContent = `${x.nom} : ${x.prod ? `produit ${E.fmt(x.prod)} MW` : `consomme ${E.fmt(x.cons)} MW`}`;
      el['ligne-' + x.id] = l;
    }
    const poste = svgEl('g', { class: 'poste', transform: `translate(${P.x},${P.y})` }, gl);
    poste.innerHTML = '<rect x="-5" y="-5" width="10" height="10" rx="1"/><text x="9" y="4">poste</text><title>Poste de la Sère : toute la production et toute la demande passent par ici</title>';
    el.poste = poste;
    // Liens : électricité un à un (acte I), fioul et chlore (acte II)
    const pos = (id) => E.defs[id] || E.noeuds[id];
    for (const l of D.liens) {
      const a = pos(l.from), b = pos(l.to);
      el['lien-' + l.from + '-' + l.to] = fleche(a, b, `${a.nom} → ${b.nom} (${l.quoi})`, $('liens'));
    }
    for (const x of [...D.sites, ...D.noeuds]) {
      if (!x.besoin) continue;
      const a = pos(x.besoin.de);
      el['besoin-' + x.id] = fleche(a, x, `${a.nom} → ${x.nom} (${x.besoin.quoi})`, $('liens'));
    }
    for (const x of D.sites) {   // acte III : le port et l'autoroute vers ce qu'ils desservent
      if (!x.desservi) continue;
      for (const h of x.desservi) el['desserte-' + x.id + '-' + h] = fleche(pos(h), x, `${nomDe(h)} → ${x.nom} (desserte)`, $('liens'));
    }
    // Nœuds : l'hôpital de l'acte I, puis le réseau de l'acte II
    for (const n of D.noeuds) {
      const g = svgEl('g', { class: 'noeud', transform: `translate(${n.x},${n.y})` }, $('sites'));
      if (n.type === 'ville') {
        g.innerHTML = `<circle class="halo-ville" r="16"/>${LUMIERES.map(([x, y]) => `<circle class="lumiere" cx="${x}" cy="${y}" r="1.6"/>`).join('')}`;
      } else {
        g.innerHTML = `<rect class="fond" x="-9" y="-9" width="18" height="18" rx="3"/>${GLYPHES[n.type || 'hopital']}<text class="etiquette" x="0" y="24" text-anchor="middle">${n.court || n.nom}</text>`;
      }
      svgEl('title', {}, g).textContent = n.nom + (n.cons ? ` · consomme ${E.fmt(n.cons)} MW` : n.prod ? ` · produit ${E.fmt(n.prod)} MW` : '');
      el['noeud-' + n.id] = g;
    }
    for (const d of D.sites) {
      if (d.mesure || d.carte === false) continue;
      const g = svgEl('g', { class: 'site actif', transform: `translate(${d.x},${d.y})` }, $('sites'));
      g.dataset.id = d.id;
      // Une charge de l'acte IV porte un repère à part, avec la durée de sa garde.
      const disque = d.garde ? '<path class="disque" d="M10,0 L5,8.7 L-5,8.7 L-10,0 L-5,-8.7 L5,-8.7 Z"/>' : '<circle class="disque" r="9"/>';
      const duree = d.garde ? `<text class="duree" y="35" text-anchor="middle">${E.fmt(d.ans)} ans</text>` : '';
      g.innerHTML = `<circle class="halo" r="16"/><circle class="vegetal" r="0"/>${disque}<path class="arc" d=""/><text class="etiquette" y="24" text-anchor="middle">${d.court || d.nom}</text>${duree}<title>${d.nom}</title>`;
      g.addEventListener('click', () => selectionner(d.id));
      el['site-' + d.id] = g;
    }
  }

  function arcPath(p) { // arc de progression autour du disque
    if (p <= 0) return ''; if (p >= 1) p = 0.9999;
    const r = 13, a = -Math.PI / 2, b = a + p * 2 * Math.PI;
    return `M${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)} A${r},${r} 0 ${p > 0.5 ? 1 : 0} 1 ${(r * Math.cos(b)).toFixed(1)},${(r * Math.sin(b)).toFixed(1)}`;
  }

  // Ce que menacerait le chantier sélectionné : délestages, privations, arrêts (acte II), isolements (acte III)
  function menaces() {
    const m = new Set();
    if (!selection || s.acte < 2) return m;
    const a = s.sites[selection].state === 'actif' ? E.apercu(s, selection) : null;
    if (a) for (const id of [...a.delestes, ...a.prives, ...a.arretes, ...(a.isoles || [])]) m.add(id);
    return m;
  }

  function rendreCarte() {
    // En mode Croissance, la carte se rejoue à l'envers : les actes s'ouvrent avec les paliers.
    const mode = s.croissanceDepuis >= 0;
    const acte2 = s.acte >= 2 || (mode && s.paliers >= 1), acte3 = s.acte >= 3 || (mode && s.paliers >= 2), menace = menaces();
    for (const d of D.sites) {
      if (d.mesure || d.carte === false) continue;
      const g = el['site-' + d.id], st = s.sites[d.id];
      const sansApport = st.state === 'actif' && st.sansApport;
      const isole = acte3 && st.state === 'actif' && E.isole(s, d);
      const attend = d.garde && st.state === 'chantier' && st.attentePlace;
      g.setAttribute('class', `site ${st.state}${d.garde ? ' garde' : ''}${d.sol ? ' sol' : ''}${attend ? ' attend' : ''}${st.pollue ? ' pollue' : ''}${sansApport ? ' sans-apport' : ''}${isole ? ' isole' : ''}` +
        `${menace.has(d.id) ? ' menace' : ''}${selection === d.id ? ' selection' : ''}${E.acteDe(d) > s.acte && !(mode && E.tierOuvert(s, d)) ? ' futur' : ''}`);
      g.querySelector('.halo').setAttribute('r', mode ? (16 + 2 * Math.sqrt(E.niveauDe(s, d))).toFixed(1) : 16);   // un site agrandi rayonne plus loin
      g.querySelector('.arc').setAttribute('d', st.state === 'chantier' && !attend ? arcPath(st.progress) : '');
      const v = g.querySelector('.vegetal');
      if (st.state === 'eteint' && !st.pollue && d.regen > 0) { v.setAttribute('r', (10 + 14 * st.regen).toFixed(1)); v.style.opacity = (0.15 + 0.6 * st.regen).toFixed(2); }
      else v.style.opacity = 0;
    }
    // Acte IV : le réseau national remplace le poste ; une fois démantelé, les lignes s'éteignent.
    el.poste.classList.toggle('futur', s.acte >= 4 || (mode && s.paliers >= 3));
    const reseauMort = E.capaciteFinie(s);
    el['noeud-hopital'].setAttribute('class', `noeud ${s.hopital}`);
    for (const n of D.noeuds) {
      if (!reseauVisible(n)) continue;
      el['noeud-' + n.id].setAttribute('class', `noeud ${n.type} ${s.noeuds[n.id]}${menace.has(n.id) ? ' menace' : ''}${acte2 ? '' : ' futur'}`);
    }
    el.reseau.classList.toggle('futur', !acte2);
    if (acte2) {
      for (const d of D.sites) {
        if (!reseauVisible(d) || !(d.prod || d.cons)) continue;
        const st = s.sites[d.id], marche = st.state === 'actif' && E.approvisionne(s, d);
        const cls = reseauMort ? 'ligne morte' : marche ? (d.prod ? 'ligne prod' : 'ligne') : st.state === 'coupe' ? 'ligne coupee' : 'ligne morte';
        el['ligne-' + d.id].setAttribute('class', cls + (menace.has(d.id) ? ' menace' : ''));
      }
      for (const n of D.noeuds) {
        if (!reseauVisible(n)) continue;
        const cls = reseauMort ? 'ligne morte' : n.prod ? 'ligne prod' : s.noeuds[n.id] === 'alimente' ? 'ligne' : 'ligne coupee';
        el['ligne-' + n.id].setAttribute('class', cls + (menace.has(n.id) ? ' menace' : ''));
      }
    }
    for (const l of D.liens) {
      const p = el['lien-' + l.from + '-' + l.to];
      const from = s.sites[l.from].state, to = l.to === 'hopital' ? s.hopital : s.sites[l.to].state;
      const mort = from !== 'actif' || (l.to === 'hopital' ? to !== 'alimente' : to !== 'actif');
      const enDanger = !mort && selection === l.from && E.coupuresSi(s, l.from).includes(l.to);
      p.setAttribute('class', `lien${mort ? ' mort' : ''}${enDanger ? ' menace' : ''}`);
    }
    for (const x of [...D.sites, ...D.noeuds]) {
      if (!x.besoin) continue;
      const fournit = s.sites[x.besoin.de].state === 'actif' && !(x.besoin.sauf && E.mesureFaite(s, x.besoin.sauf));
      const enDanger = fournit && selection === x.besoin.de && menace.has(x.id);
      el['besoin-' + x.id].setAttribute('class', `lien${fournit ? '' : ' mort'}${enDanger ? ' menace' : ''}${acte2 ? '' : ' futur'}`);
    }
    for (const x of D.sites) {
      if (!x.desservi) continue;
      for (const h of x.desservi) {
        const vivant = s.sites[h].state === 'actif' && s.sites[x.id].state === 'actif';
        const enDanger = vivant && selection === h && menace.has(x.id);
        el['desserte-' + x.id + '-' + h].setAttribute('class', `lien desserte${vivant ? '' : ' mort'}${enDanger ? ' menace' : ''}${acte3 ? '' : ' futur'}`);
      }
    }
    // Acte V : une région reverdit à mesure que ses gestes sont faits et que sa terre repousse ; son ombre se lève.
    for (const cle of Object.keys(D.regions)) {
      let rendu = 0, tout = 0;
      for (const d of E.GESTES) {
        if (d.region !== cle) continue;
        tout += d.T;
        if (s.sites[d.id].state === 'eteint') rendu += d.T * s.sites[d.id].regen;
      }
      const part = s.acte >= 5 && tout ? rendu / tout : 0, eteinte = s.regionsEteintes.includes(cle);
      el['region-' + cle].setAttribute('class', `ombre${eteinte ? ' eteinte' : ''}`);
      el['region-' + cle].style.opacity = eteinte && part > 0 ? (1 - 0.6 * part).toFixed(2) : '';
      el['rendue-' + cle].style.opacity = part.toFixed(2);
    }
    document.querySelectorAll('.leg-acte2').forEach(x => { x.hidden = !acte2; });
    document.querySelectorAll('.leg-acte3').forEach(x => { x.hidden = !acte3; });
    document.querySelectorAll('.leg-acte4').forEach(x => { x.hidden = s.acte < 4; });
    document.querySelectorAll('.leg-acte5').forEach(x => { x.hidden = s.acte < 5; });
  }

  // ---------- panneau ----------
  function infosReseau(d) {
    const parts = [];
    if (d.prod) parts.push(`produit <b>${E.fmt(d.prod)} MW</b>`);
    if (d.cons) parts.push(`consomme <b>${E.fmt(d.cons)} MW</b>`);
    if (d.besoin) parts.push(`a besoin du ${d.besoin.quoi} de : ${nomDe(d.besoin.de)}`);
    for (const x of [...D.sites, ...D.noeuds]) if (x.besoin && x.besoin.de === d.id) parts.push(`fournit en ${x.besoin.quoi} : ${x.nom}`);
    return parts.join(' · ');
  }
  function infosActe3(d) {
    const parts = [];
    if (d.desservi) parts.push(`desservi par : ${d.desservi.map(nomDe).join(', ')}`);
    const ds = E.dessertes(d.id);
    if (ds.length) parts.push(`dessert : ${ds.map(nomDe).join(', ')}`);
    if (d.vivres) parts.push(`vivres : <b>${d.vivres}</b> sur 100`);
    return parts.join(' · ');
  }

  function construireChantiers() {
    const box = $('liste-chantiers'); box.innerHTML = '';
    for (const d of D.sites) {
      if (d.garde || d.geste) continue;   // ni ce qui se garde (§5 : c'est la Garde), ni les gestes de l'acte V
      const c = document.createElement('div');
      c.className = 'chantier'; c.dataset.id = d.id;
      const effet = d.part ? `−${Math.round(d.part * 100)} %` : d.E > 0 ? `−${E.fmt(d.E)}` : '0';   // une mesure ne retire rien
      const deps = E.dependants(d.id).map(nomDe);
      const reseau = E.acteDe(d) === 2 && !d.mesure, acte3 = E.acteDe(d) >= 3;
      c.innerHTML = `
        <div class="nom">${d.nom}<small>${d.region}${d.mesure ? ' · mesure' : ''}</small></div>
        <div class="effet moins">${effet}</div>
        ${d.part ? '<div class="retrait"></div>' : ''}
        <div class="desc">${d.desc}</div>
        <div class="cout"><span>Capacité <b class="ck">${d.K}</b></span><span>Mains <b class="cm">${d.M}</b></span><span><b>${E.fmtDur(d.dur)}</b></span>${d.g ? `<span>croissance <b>+${d.g.toFixed(2).replace('.', ',')} %/min</b></span>` : ''}${d.deplaces ? `<span><b>${E.fmt(d.deplaces)}</b> personnes</span>` : ''}${d.co ? `<span>consentement <b>−${d.co}</b></span>` : ''}</div>
        ${reseau ? `<div class="mw">${infosReseau(d)}</div>` : acte3 && !d.mesure ? `<div class="mw">${infosActe3(d)}</div>` : ''}
        ${deps.length ? `<div class="alim">alimente : ${deps.join(', ')}</div>` : ''}
        ${d.rapide ? `<div class="vite-note">Démolir vite : moitié du temps, de la Capacité et des Mains, mais une pollution qui touche ${E.fmt(d.rapide.casse)} personnes, comptées dans la Casse, et laisse un sol pollué.</div>` : ''}
        ${d.desservi ? '<div class="isole-note" hidden>Isolé : plus rien ne le dessert, tout se fait à bras. Mains ×2.</div>' : ''}
        ${d.sol ? '<div class="sol-note">Temps réel seul : rien ne l\'accélère, ni les Mains ni la relance. La dépollution avance aussi quand vous n\'êtes pas là.</div>' : ''}
        ${d.finCapacite ? '<div class="noretour-note">Point de non-retour : après lui, la Capacité ne se renouvellera plus.</div>' : ''}
        ${E.acteDe(d) >= 4 && d.K > 0 ? '<div class="abras-note" hidden>Sans Capacité suffisante : à bras, deux fois plus de Mains.</div>' : ''}
        ${reseau || acte3 ? '<div class="apercu" hidden></div>' : ''}
        <div class="conseil-note" hidden></div>
        <div class="action"><button class="btn engager">Engager</button>${d.rapide ? '<button class="btn vite">Démolir vite</button>' : ''}<div class="prog" hidden><i></i></div><span class="etat"></span></div>`;
      c.querySelector('.engager').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id); });
      if (d.rapide) c.querySelector('.vite').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id, { vite: true }); });
      c.addEventListener('click', () => selectionner(d.id));
      box.appendChild(c); el['ch-' + d.id] = c;
    }
  }

  // Ce qu'un lancement ferait au réseau, en une phrase (R4 : tout se voit avant de lancer)
  // Le prix d'une coupure, d'un délestage ou d'une privation, dans les unités des compteurs du haut (R4)
  const nbPersonnes = (n) => `${E.fmt(n)} ${n >= 2 ? 'personnes' : 'personne'}`;
  const textePrix = (p) => `Casse +${nbPersonnes(p.casse)}${p.sansReclassement ? ' sans reclassement' : ''}, consentement −${E.fmt(p.co)}.`;
  function texteApercu(a, p) {
    const marge = `${a.apres >= 0 ? '+' : '−'}${E.fmt(Math.abs(a.apres))} MW`;
    const morceaux = [`Lancé maintenant : la marge ${a.apres < 0 ? 'tombe' : 'passe'} à ${marge}.`];
    if (a.arretes.length) morceaux.push(`À l'arrêt : ${a.arretes.map(nomDe).join(', ')}.`);
    if (a.delestes.length) morceaux.push(`Délestés : ${a.delestes.map(nomDe).join(', ')}.`);
    for (const id of a.prives) morceaux.push(`Sans ${E.noeuds[id].besoin.quoi} : ${nomDe(id)}.`);
    if (p && (p.casse > 0 || p.co > 0)) morceaux.push(textePrix(p));
    return { danger: a.prives.length + a.delestes.length > 0, texte: morceaux.join(' ') };
  }
  // Sous le seuil, le Conseil relance sans le joueur : la carte le dit avant (R4)
  function texteConseil(r, enCours) {
    if (r.quand === 'lancement') return `Lancé maintenant, le consentement passerait sous ${r.seuil} % (−${E.fmt(r.co)}) : le Conseil relancerait la croissance sans vous.`;
    const [passe, relance] = enCours ? ['passera', 'relancera'] : ['passerait', 'relancerait'];
    return `À la fermeture, le consentement ${passe} sous ${r.seuil} % (−${E.fmt(r.co)}) s'il ne remonte pas d'ici là : le Conseil ${relance} la croissance sans vous.`;
  }
  // Acte III : l'Empreinte retirée, ce qu'on isolerait, ce qui manquerait à manger
  function texteApercu3(a, d) {
    const morceaux = [];
    if (!d.mesure) morceaux.push(`Lancé maintenant : Empreinte ≈ −${E.fmt(a.retrait)} à la fermeture.`);
    if (a.isoles.length) morceaux.push(`Isolerait : ${a.isoles.map(nomDe).join(', ')} (Mains ×2).`);
    if (a.vivres) {
      const bas = Math.floor(a.vivres.bas);
      morceaux.push(a.vivres.duree ? `Vivres au plus bas : ${bas} sur 100, pénurie pendant ${E.fmtDur(a.vivres.duree)} environ : Casse ≈ +${nbPersonnes(a.vivres.casse)}, consentement ≈ −${E.fmt(a.vivres.co)}.` : `Vivres au plus bas : ${bas} sur 100.`);
    }
    return { danger: a.isoles.length > 0 || !!(a.vivres && a.vivres.duree > 0), texte: morceaux.join(' ') };
  }

  function rendreChantiers() {
    const speed = E.relanceActive(s) ? D.RELANCE.speedMul : 1;
    $('chantiers').hidden = s.acte >= 5;   // à l'acte V, il n'y a plus de chantiers : il reste des gestes
    for (const d of D.sites) {
      if (d.garde || d.geste) continue;
      const c = el['ch-' + d.id], st = s.sites[d.id];
      c.hidden = E.acteDe(d) !== s.acte || !E.existe(s, d);   // seules les cartes de l'acte en cours restent ouvertes
      if (c.hidden) continue;
      const can = E.canEngage(s, d.id);
      c.className = `chantier ${st.state}${st.pollue ? ' pollue' : ''}${selection === d.id ? ' selection' : ''}`;
      const btn = c.querySelector('.engager'), bv = c.querySelector('.vite'), prog = c.querySelector('.prog'), etat = c.querySelector('.etat');
      const alim = c.querySelector('.alim'), ap = c.querySelector('.apercu'), vn = c.querySelector('.vite-note'), cn = c.querySelector('.conseil-note');
      const risque = E.risqueConseil(s, d.id, can);
      cn.hidden = !risque;
      if (risque) cn.textContent = texteConseil(risque, st.state === 'chantier');
      if (vn) vn.hidden = st.state !== 'actif';
      const coutM = can.cout ? can.cout.M : d.M;   // un site isolé coûte deux fois plus de Mains
      c.querySelector('.ck').className = 'ck' + (st.state === 'actif' && s.K < d.K ? ' manque' : '');
      const cm = c.querySelector('.cm');
      cm.className = 'cm' + (st.state === 'actif' && s.M < coutM ? ' manque' : '');
      if (st.state === 'actif') cm.textContent = coutM;
      const ret = c.querySelector('.retrait'), iso = c.querySelector('.isole-note'), ab = c.querySelector('.abras-note');
      if (ret) ret.textContent = st.state === 'eteint' ? (Number.isFinite(st.Eretire) ? `retiré : −${E.fmt(st.Eretire)}` : '') : `≈ −${E.fmt(E.retrait(s, d))} aujourd'hui`;
      if (iso) iso.hidden = !(st.state === 'actif' && can.isole);
      if (ab) ab.hidden = !(st.state === 'actif' && can.aBras);
      if (st.state === 'actif' || (st.state === 'coupe' && !d.mesure)) {
        const restes = st.state === 'coupe';
        btn.hidden = false; prog.hidden = true; btn.disabled = !can.ok;
        btn.textContent = restes ? 'Démanteler les restes' : d.sol ? 'Lancer la dépollution' : 'Engager';
        if (bv) { bv.hidden = restes; bv.disabled = !E.canEngage(s, d.id, { vite: true }).ok; }
        const manque = can.ok ? '' : can.raisons.join(' · ');
        etat.className = 'etat' + (restes ? ' rouge' : '');
        etat.textContent = restes ? `coupé, à l'arrêt${manque ? ' · ' + manque : ''}` : st.sansApport ? `à l'arrêt, faute de ${d.besoin.quoi}${manque ? ' · ' + manque : ''}` : manque;
        if (alim) { const m = can.coupures.length; alim.className = 'alim' + (m ? ' menace' : ''); alim.textContent = m ? `couperait maintenant : ${can.coupures.map(nomDe).join(', ')}. ${textePrix(E.prixLancement(s, d.id, can))}` : `alimente : ${E.dependants(d.id).map(nomDe).join(', ')}`; }
        if (ap) {
          const a = restes || !can.apercu ? null : E.acteDe(d) >= 3 ? texteApercu3(can.apercu, d) : texteApercu(can.apercu, E.prixLancement(s, d.id, can));
          ap.hidden = !a || !a.texte;
          if (!ap.hidden) { ap.className = 'apercu' + (a.danger ? ' danger' : ''); ap.textContent = a.texte; }
        }
      } else if (st.state === 'chantier') {
        btn.hidden = true; if (bv) bv.hidden = true; prog.hidden = false; prog.firstElementChild.style.width = (st.progress * 100).toFixed(1) + '%';
        const reste = Math.ceil(E.dureeChantier(d, st) * (1 - st.progress) / (d.sol ? 1 : speed));   // un sol ne va jamais plus vite
        etat.className = 'etat'; etat.textContent = `${st.vite ? 'démolition rapide' : st.restes ? 'restes' : d.sol ? 'dépollution' : 'chantier'} · ${E.fmtDur(reste)}${d.sol ? ', temps réel' : ''}`;
        if (alim) { alim.className = 'alim'; alim.textContent = ''; }   // le site s'est arrêté à l'ouverture : il n'alimente plus rien
        if (ap) ap.hidden = true;
      } else {
        btn.hidden = true; if (bv) bv.hidden = true; prog.hidden = true;
        etat.className = 'etat' + (st.pollue ? ' rouge' : '');
        etat.textContent = st.state === 'fait' ? 'fait' : st.pollue ? 'démolie vite · sol pollué' : `${d.sol ? 'dépollué' : 'fermé'}${d.regen > 0 ? ` · terre rendue ${Math.round(st.regen * 100)} %` : ''}`;
        if (alim) { alim.className = 'alim'; alim.textContent = ''; }
        if (ap) ap.hidden = true;
      }
    }
    if (s.acte >= 4) {
      const restants = D.sites.filter(d => E.acteDe(d) === 4 && !d.garde && E.existe(s, d) && s.sites[d.id].state !== 'eteint').length;
      $('g-detail').textContent = restants ? `— le legs : ${restants} chantier${restants > 1 ? 's' : ''} à mener` : '— tout est démantelé ou dépollué';
    } else if (s.acte >= 2) {
      const restants = D.sites.filter(d => E.acteDe(d) === s.acte && !d.mesure && s.sites[d.id].state !== 'eteint').length;
      const quoi = s.acte >= 3 ? 'les gens' : 'le réseau';
      $('g-detail').textContent = restants ? `— ${quoi} : ${restants} site${restants > 1 ? 's' : ''} à démanteler` : s.acte >= 3 ? '— la carte est vide' : '— le réseau est démantelé';
    } else {
      const g = E.gSites(s);
      $('g-detail').textContent = g > 0 ? `— ${D.sites.filter(d => s.sites[d.id].state === 'actif' && d.g > 0).length} sites font encore monter l'Empreinte` : '— plus rien ne fait monter l\'Empreinte';
    }
  }

  // ---------- la Garde (acte IV) ----------
  const GARDES = D.sites.filter(d => d.garde);
  const semainesDe = (sec) => Math.round(sec / D.SEMAINE);
  // Des durées qui dépassent celles de toute civilisation connue (§10), à l'échelle de ce qu'on connaît.
  const EN_LETTRES = { 2: 'deux', 12: 'douze', 20: 'vingt' };
  function echelle(ans) {
    if (ans >= 10000) { const n = Math.round(ans / 5000); return `${EN_LETTRES[n] || n} fois toute l'histoire écrite`; }
    const n = Math.round(ans / 25);
    return `${EN_LETTRES[n] || n} générations`;
  }
  function construireGardes() {
    const box = $('liste-gardes'); box.innerHTML = '';
    for (const d of GARDES) {
      const c = document.createElement('div');
      c.className = 'chantier garde-carte'; c.dataset.id = d.id;
      c.innerHTML = `
        <div class="nom">${d.nom}<small>${E.fmt(d.ans)} ans</small></div>
        <div class="effet moins">−${Math.round(d.part * 100)} %</div>
        <div class="retrait"></div>
        <div class="desc">${d.desc}</div>
        <div class="cout"><span>Capacité <b class="ck">${d.K}</b></span><span>formation <b>${semainesDe(d.dur)} semaines</b></span><span>fuite <b>+${String(d.g).replace('.', ',')} %/min</b></span></div>
        <div class="duree-note">${E.fmt(d.ans)} ans, ${echelle(d.ans)}. Chaque année : ${E.fmt(d.M)} gardiens pour une garde réduite, ${E.fmt(2 * d.M)} pour une garde pleine.</div>
        <div class="dosage-note">Réduite&nbsp;: ${d.dosages.reduite}. Pleine&nbsp;: ${d.dosages.pleine}.</div>
        <div class="abras-note" hidden>Sans Capacité suffisante : à bras, deux fois plus de gardiens.</div>
        <div class="action"><button class="btn reduite">Garder réduit</button><button class="btn pleine">Garder plein</button><div class="prog" hidden><i></i></div><span class="etat"></span></div>`;
      c.querySelector('.reduite').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id, { dosage: 'reduite' }); });
      c.querySelector('.pleine').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id, { dosage: 'pleine' }); });
      c.addEventListener('click', () => selectionner(d.id));
      box.appendChild(c); el['garde-' + d.id] = c;
    }
  }
  function rendreGardes() {
    const sec = $('garde');
    sec.hidden = s.acte < 4;
    if (sec.hidden) return;
    const reste = E.aGarder(s), nb = GARDES.filter(d => s.sites[d.id].state === 'eteint').length;
    $('garde-etat').textContent = reste > 0 ? `à garder : ${Math.round(reste * 100)} % de ce qui reste` : `tout est gardé · ${E.fmt(s.gardiens)} gardiens`;
    for (const d of GARDES) {
      const c = el['garde-' + d.id], st = s.sites[d.id];
      c.className = `chantier garde-carte ${st.state}${selection === d.id ? ' selection' : ''}`;
      const br = c.querySelector('.reduite'), bp = c.querySelector('.pleine'), prog = c.querySelector('.prog'), etat = c.querySelector('.etat');
      const ret = c.querySelector('.retrait'), ab = c.querySelector('.abras-note');
      ret.textContent = st.state === 'eteint' ? (Number.isFinite(st.Eretire) ? `retiré : −${E.fmt(st.Eretire)}` : '') : `≈ −${E.fmt(E.retrait(s, d))} aujourd'hui`;
      if (st.state === 'actif') {
        const cr = E.canEngage(s, d.id, { dosage: 'reduite' }), cp = E.canEngage(s, d.id, { dosage: 'pleine' });
        br.hidden = bp.hidden = false; prog.hidden = true;
        br.disabled = !cr.ok; bp.disabled = !cp.ok;
        br.textContent = `Garder réduit · ${E.fmt(cr.cout ? cr.cout.M : d.M)}`;
        bp.textContent = `Garder plein · ${E.fmt(cp.cout ? cp.cout.M : 2 * d.M)}`;
        c.querySelector('.ck').className = 'ck' + (cr.aBras ? ' manque' : '');
        ab.hidden = !cr.aBras;
        etat.className = 'etat rouge';
        etat.textContent = cr.ok ? (cr.placeLibre ? 'fuit' : 'fuit · toutes les places de formation sont prises') : `fuit · ${cr.raisons.join(' · ')}`;
      } else if (st.state === 'chantier') {
        br.hidden = bp.hidden = true; ab.hidden = true;
        prog.hidden = !!st.attentePlace; prog.firstElementChild.style.width = (st.progress * 100).toFixed(1) + '%';
        etat.className = 'etat';
        const sem = Math.min(semainesDe(d.dur), Math.floor(st.progress * semainesDe(d.dur)) + 1);
        etat.textContent = st.attentePlace ? `${E.fmt(st.mEng)} gardiens attendent une place de formation` :
          `${E.fmt(st.mEng)} gardiens en formation · semaine ${sem} sur ${semainesDe(d.dur)}`;
      } else {
        br.hidden = bp.hidden = true; prog.hidden = true; ab.hidden = true;
        etat.className = 'etat';
        etat.textContent = `gardée${st.dosage === 'pleine' ? ', pleine' : ', réduite'}${st.aBras ? ', à bras' : ''} · ${E.fmt(st.mEng)} gardiens, chaque année, pendant ${E.fmt(d.ans)} ans`;
      }
    }
  }

  // ---------- rendre (acte V) ----------
  // Une carte par geste, et sur chacune un bouton par région : un clic lance le geste, un seul à la fois.
  function construireGestes() {
    const box = $('liste-gestes'); box.innerHTML = '';
    $('rendre-regle').textContent = `Ce qui reste se rend à la main, un geste à la fois, sans Capacité. Chaque geste retire une part de ce qui reste. ` +
      `Son équipe reste sur la terre qu'elle a rendue : elle ne revient pas. Faute de Mains, les habitants s'y mettent : ` +
      `${D.HABITANTS.lent === 2 ? 'deux' : D.HABITANTS.lent} fois plus long, consentement −${D.HABITANTS.co}.`;
    for (const g of D.GESTES) {
      const c = document.createElement('div');
      c.className = 'chantier geste-carte';
      c.innerHTML = `
        <div class="nom">${g.nom}</div>
        <div class="effet moins">−${Math.round(g.part * 100)} %</div>
        <div class="retrait"></div>
        <div class="desc">${g.desc}</div>
        <div class="cout"><span>équipe <b class="cm">${E.fmt(g.M)}</b></span><span><b class="duree"></b></span><span>terre rendue <b>+${String(g.T).replace('.', ',')}</b></span></div>
        <div class="habitants-note" hidden></div>
        <div class="conseil-note" hidden></div>
        <div class="regions-gestes"></div>`;
      for (const d of E.GESTES.filter(x => x.geste === g.cle)) {
        const b = document.createElement('button');
        b.className = 'btn geste'; b.title = d.nom;
        b.innerHTML = '<i></i><span></span>';
        b.addEventListener('click', () => engager(d.id));
        c.querySelector('.regions-gestes').appendChild(b); el['geste-' + d.id] = b;
      }
      box.appendChild(c); el['gestes-' + g.cle] = c;
    }
  }
  function rendreGestes() {
    const sec = $('rendre');
    sec.hidden = s.acte < 5;
    if (sec.hidden) return;
    const faits = E.gestesFaits(s), enCours = E.gesteEnCours(s), plancher = E.auPlancher(s);
    const speed = E.relanceActive(s) ? D.RELANCE.speedMul : 1;
    $('rendre-etat').textContent = faits >= E.GESTES.length ? `tout est rendu · ${E.fmt(s.installes)} personnes restées sur place`
      : `${faits} geste${faits > 1 ? 's' : ''} sur ${E.GESTES.length}${s.installes ? ` · ${E.fmt(s.installes)} personnes restées sur place` : ''}`;
    for (const g of D.GESTES) {
      const c = el['gestes-' + g.cle], gestes = E.GESTES.filter(d => d.geste === g.cle);
      const prochain = gestes.find(d => s.sites[d.id].state === 'actif');   // tous les gestes d'une carte se valent
      const can = prochain ? E.canEngage(s, prochain.id) : null, habitants = !!can && can.habitants;
      c.className = `chantier geste-carte${prochain || gestes.some(d => s.sites[d.id].state === 'chantier') ? '' : ' eteint'}`;
      c.querySelector('.retrait').textContent = !prochain ? '' : plancher ? "l'Empreinte est au plancher : ce geste ne rend plus que de la terre"
        : `≈ −${E.fmtFin(E.retraitPrevu(s, prochain))} aujourd'hui`;
      c.querySelector('.cm').className = 'cm' + (habitants ? ' manque' : '');
      c.querySelector('.duree').textContent = E.fmtDur(g.dur * (habitants ? D.HABITANTS.lent : 1) / speed);
      const hn = c.querySelector('.habitants-note'), cn = c.querySelector('.conseil-note');
      hn.hidden = !habitants;
      if (habitants) hn.textContent = `Il ne reste pas ${E.fmt(g.M)} Mains : les habitants le feront, deux fois plus lentement, et le consentement perdra ${D.HABITANTS.co} points.`;
      const risque = prochain && !enCours ? E.risqueConseil(s, prochain.id, can) : null;   // sous le seuil, le Conseil relance (R4)
      cn.hidden = !risque;
      if (risque) cn.textContent = texteConseil(risque, false);
      for (const d of gestes) {
        const b = el['geste-' + d.id], st = s.sites[d.id];
        b.className = `btn geste ${st.state}${st.habitants ? ' habitants' : ''}`;
        b.disabled = st.state !== 'actif' || !!enCours;
        b.firstElementChild.style.width = st.state === 'chantier' ? (st.progress * 100).toFixed(1) + '%' : st.state === 'eteint' ? '100%' : '0%';
        const reste = st.state === 'chantier' ? Math.ceil(E.dureeChantier(d, st) * (1 - st.progress) / speed) : 0;
        b.lastElementChild.textContent = d.region + (st.state === 'chantier' ? ` · ${E.fmtDur(reste)}` : st.state === 'eteint' ? ' ✓' : '');
      }
    }
  }

  function rendreReseau() {
    const sec = $('reseau');
    sec.hidden = s.acte < 2 || E.capaciteFinie(s);   // sans réseau national, le barrage alimente les villes en direct
    if (sec.hidden) return;
    const b = E.bilan(s), g = E.gRebond(s);
    $('reseau-prod').textContent = E.fmt(b.prod);
    $('reseau-dem').textContent = E.fmt(b.dem);
    $('reseau-marge').textContent = `${b.marge >= 0 ? '+' : '−'}${E.fmt(Math.abs(b.marge))}`;
    $('reseau-barre').style.width = Math.min(100, b.prod > 0 ? b.dem / b.prod * 100 : 100).toFixed(1) + '%';
    const etat = $('reseau-etat');
    etat.className = 'reseau-etat ' + (g > 0.005 ? 'rebond' : 'tendu');
    etat.textContent = g > 0.005 ? `rebond : +${g.toFixed(2).replace('.', ',')} %/min` : 'à l\'équilibre, pas de rebond';
  }

  function rendreVivres() {
    const sec = $('vivres');
    sec.hidden = s.acte !== 3;   // à l'acte IV, l'agro-industrie est démantelée : les vivres ne bougent plus
    if (sec.hidden) return;
    const V = D.VIVRES, v = E.vivres(s), rel = E.relanceActive(s), deficit = v.marge < 0;
    $('vivres-prod').textContent = Math.floor(v.prod);
    $('vivres-besoin').textContent = v.besoin;
    $('vivres-marge').textContent = `${v.marge >= 0 ? '+' : '−'}${Math.abs(Math.round(v.marge))}`;
    $('vivres-jauge').classList.toggle('deficit', deficit);
    $('vivres-barre').style.width = Math.min(100, v.prod > 0 ? v.besoin / v.prod * 100 : 100).toFixed(1) + '%';
    // La relève en cours : ce que les terres converties rendront encore, et quand
    let reste = 0;
    for (const d of D.sites) {
      const st = s.sites[d.id];
      if (d.vivres && st.state !== 'actif' && Number.isFinite(st.t0)) reste = Math.max(reste, st.t0 + V.releveDur - s.t);
    }
    const gain = reste > 0 ? E.vivres(s, null, reste).prod - v.prod : 0;
    const etat = $('vivres-etat');
    if (deficit && rel) { etat.className = 'reseau-etat rebond'; etat.textContent = 'la relance importe : pas de pénurie'; }
    else if (deficit) { etat.className = 'reseau-etat penurie'; etat.textContent = `pénurie : ${E.fmt(Math.ceil(-v.marge * V.casse * 60))} personnes par minute`; }
    else if (gain >= 0.5) { etat.className = 'reseau-etat'; etat.textContent = `relève : +${Math.round(gain)} en ${E.fmtDur(Math.ceil(reste))}`; }
    else { etat.className = 'reseau-etat'; etat.textContent = 'les besoins sont couverts'; }
  }

  // Les gens : qui attend, depuis combien de semaines, qui est en formation (des noms)
  const SEMAINES_LOT = Math.round(D.RECONV.dur / D.SEMAINE);
  let dernierGens = '';
  function rendreGens() {
    const acte3 = s.acte >= 3;
    $('gens-titre').hidden = !acte3;
    $('reconv-barre-zone').hidden = acte3;
    $('formations').hidden = !acte3 || (!s.formations.length && !GARDES.some(d => s.sites[d.id].state === 'chantier'));
    $('attente').hidden = !acte3 || !s.attente.length;
    $('gens-note').hidden = !acte3;
    $('continu-zone').hidden = !acte3;
    $('continu').checked = !!s.formerEnContinu;
    if (!acte3) return;
    const semaines = (sec) => Math.max(0, Math.floor(sec / D.SEMAINE));
    const groupes = [];
    for (const c of s.attente) {
      const g = groupes.find(x => x.de === c.de);
      if (g) { g.n += c.n; g.t0 = Math.min(g.t0, c.t0); } else groupes.push({ de: c.de, n: c.n, t0: c.t0 });
    }
    const gardes = GARDES.filter(d => s.sites[d.id].state === 'chantier');
    const cle = JSON.stringify([s.formations.map(f => [f.lot, f.n, Math.floor(f.progress * SEMAINES_LOT), Math.round(f.progress * 100)]),
      gardes.map(d => [d.id, !!s.sites[d.id].attentePlace, Math.round(s.sites[d.id].progress * 100)]),
      groupes.map(g => [g.de, g.n, semaines(s.t - g.t0)]), Math.round(s.deplaces / 100)]);
    if (cle === dernierGens) return;
    dernierGens = cle;
    const ol = $('formations'); ol.innerHTML = '';
    $('formations').hidden = !s.formations.length && !gardes.length;
    for (const d of gardes) {   // acte IV : les gardiens se forment sur les mêmes places
      const st = s.sites[d.id], tot = semainesDe(d.dur), sem = Math.min(tot, Math.floor(st.progress * tot) + 1);
      const li = document.createElement('li'); li.className = 'gardiens';
      li.innerHTML = `<div class="lot-tete"><span></span><span class="muted"></span></div><div class="lot-noms muted"></div><div class="barre fine"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></div>`;
      li.querySelector('.lot-tete span').textContent = `Gardiens · ${E.fmt(st.mEng)} personnes`;
      li.querySelector('.lot-tete .muted').textContent = st.attentePlace ? 'attendent une place' : `semaine ${sem} sur ${tot}`;
      li.querySelector('.lot-noms').textContent = `${d.nom} : ${E.fmt(d.ans)} ans de garde.`;
      ol.appendChild(li);
    }
    for (const f of s.formations) {
      const li = document.createElement('li');
      const gens = E.personnes(f, 3).map(p => `${p.nom}, ${p.metier}`).join(' ; ');
      const sem = Math.min(SEMAINES_LOT, Math.floor(f.progress * SEMAINES_LOT) + 1);
      li.innerHTML = `<div class="lot-tete"><span>Lot ${f.lot} · ${E.fmt(f.n)} personnes</span><span class="muted">semaine ${sem} sur ${SEMAINES_LOT}</span></div>` +
        `<div class="lot-noms"></div><div class="barre fine"><i style="width:${(f.progress * 100).toFixed(1)}%"></i></div>`;
      li.querySelector('.lot-noms').textContent = gens + (f.n > 3 ? `, et ${E.fmt(f.n - 3)} autres.` : '.');
      ol.appendChild(li);
    }
    const ul = $('attente'); ul.innerHTML = '';
    const tri = groupes.sort((a, b) => a.t0 - b.t0);
    for (const g of tri.slice(0, 4)) {
      const li = document.createElement('li');
      const n = semaines(s.t - g.t0);
      li.innerHTML = '<span class="origine"></span><b></b><span class="muted"></span>';
      li.children[0].textContent = g.de ? nomDe(g.de) : 'Sites des actes I et II';
      li.children[1].textContent = E.fmt(g.n);
      li.children[2].textContent = n ? `attend depuis ${n} semaine${n > 1 ? 's' : ''}` : 'vient d\'arriver';
      ul.appendChild(li);
    }
    if (tri.length > 4) { const li = document.createElement('li'); li.className = 'muted'; li.textContent = `et ${tri.length - 4} autres groupes`; ul.appendChild(li); }
    const usure = (D.CO_ATTENTE * 60 * s.deplaces / 1000).toFixed(1).replace('.', ',');
    $('gens-note').textContent = s.deplaces > 0
      ? `Attendre use le consentement : −${usure} par minute. Une relance réembaucherait ces ${E.fmt(s.deplaces)} personnes : elles ne seraient plus à reconvertir.`
      : `Personne n'attend. Chaque lot qui finit sa formation rend ${D.CO_FORMES} points de consentement.`;
  }

  function selectionner(id) { selection = selection === id ? null : id; rendreCarte(); rendreChantiers(); }

  function rendreJournal() {
    const ol = $('journal'); ol.innerHTML = '';
    for (const l of s.log.slice(-9).reverse()) {
      const li = document.createElement('li'); li.className = l.kind;
      li.innerHTML = `<span class="h">${E.fmtDur(l.t)}</span><span>${l.msg}</span>`;
      ol.appendChild(li);
    }
  }

  let dernierNb = '';
  function rendreCompteur() {
    // Sous 100, à la décimale : le plancher n'est pas un nombre rond. Sous le plancher, à trois chiffres.
    const sous = s.issue === 'poursuivre' && s.E < s.plancher * (1 - 1e-9);
    const nb = sous ? E.fmtPas(s.E) : E.fmtE(s.E);   // au-delà de treize chiffres, la notation scientifique
    const c = $('compteur');
    if (performance.now() > animPerte && nb !== dernierNb) { c.textContent = nb; dernierNb = nb; }
    const rel = E.relanceActive(s), g = E.gEff(s);
    const k = g > 0.005 ? 'monte' : g < -0.005 ? 'descend' : 'stable';
    const arrete = s.acte >= 4 && E.auPlancher(s) && g <= 0.005;   // arrêté sur le plancher, qui n'est pas zéro
    c.className = 'compteur ' + k + (arrete ? ' au-plancher' : '') + (rel ? ' relance' : '') + (performance.now() < animPerte ? ' perte' : '');
    const t = $('tendance'); t.className = 'tendance ' + k;
    const rebond = E.gRebond(s) > 0.005 && !rel, fuite = s.acte >= 4 && E.gSites(s) > 0 && !rel;
    t.textContent = g > 0.005 ? `▲ +${g >= 100 ? E.fmt(g) : (g < 1 ? g.toFixed(2) : g.toFixed(1)).replace('.', ',')} % / min${fuite ? ' · les charges fuient' : rebond ? ' · rebond du réseau' : ''}` : sous ? 'sous le plancher — vous poursuivez' : arrete ? 'au plancher — il ne descendra plus' : 'stable — plus rien ne monte';
    if (s.ms.stabilise === null && g <= 0.005) t.textContent = 'stable';
    if (s.issue === 'croissance') t.textContent = '';   // l'écran figé ne dit rien (§11)
    $('sci').hidden = !rel || s.E >= 1e13; if (rel) $('sci').textContent = E.fmtSci(s.E);
    const acte4 = s.acte >= 4, ag = E.aGarder(s);
    $('plancher').hidden = !acte4 || s.croissanceDepuis >= 0; if (acte4) $('plancher').textContent = `plancher : ${E.fmtPlancher(s.plancher)}`;
    $('a-garder').hidden = !acte4 || ag <= 0 || s.croissanceDepuis >= 0; if (acte4) $('a-garder').textContent = `à garder : ${Math.round(ag * 100)} %`;
    document.getElementById('app').dataset.digits = s.digits;
  }

  // Évolution du Consentement : ce qu'il a réellement gagné ou perdu pendant la dernière minute de jeu,
  // tout compris (formations, fermetures, attente, chantiers simultanés, relances). Un relevé par seconde de jeu :
  // le Consentement, et ce que le moteur a compté par cause, pour dire ensuite d'où vient la différence.
  let histoCo = [];
  function evolutionCo() {
    const der = histoCo[histoCo.length - 1];
    if (!der || s.t - der[0] >= 1 || s.t < der[0]) histoCo.push([s.t, s.Co, { ...s.coCauses }, { ...s.coNb }]);
    while (histoCo.length > 1 && histoCo[1][0] <= s.t - 60) histoCo.shift();
    return s.t - histoCo[0][0] >= 59 ? s.Co - histoCo[0][1] : null;
  }

  // « Ce qui le fait bouger » : par cause, ce que le Consentement a gagné ou perdu pendant la dernière minute de jeu,
  // et depuis le début de la partie. Les deux colonnes viennent du compte que tient le moteur.
  let coDetailOuvert = false, dernierCoDetail = '';
  try { coDetailOuvert = localStorage.getItem('decroissance.coDetail') === '1'; } catch (e) { /* stockage indisponible */ }
  function basculerCoDetail() {
    coDetailOuvert = !coDetailOuvert; dernierCoDetail = '';
    try { localStorage.setItem('decroissance.coDetail', coDetailOuvert ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
    rendreCoDetail();
  }
  function rendreCoDetail() {
    const box = $('co-detail'), b = $('btn-co-detail');
    box.hidden = !coDetailOuvert;
    b.setAttribute('aria-expanded', String(coDetailOuvert));
    b.textContent = coDetailOuvert ? 'Masquer ce qui le fait bouger' : 'Ce qui le fait bouger';
    if (!coDetailOuvert || !histoCo.length) return;
    const [t0, , causes0, nb0] = histoCo[0], duree = s.t - t0;
    const fenetre = {}, nbFenetre = {};
    for (const c of Object.keys(E.CAUSES_CO)) {
      fenetre[c] = (s.coCauses[c] || 0) - (causes0[c] || 0);
      nbFenetre[c] = (s.coNb[c] || 0) - (nb0[c] || 0);
    }
    const recents = E.causesCo(fenetre, nbFenetre), total = E.causesCo(s.coCauses, s.coNb);
    // Les causes de la dernière minute d'abord, de la plus forte à la plus faible ; puis celles d'avant.
    const ordre = [...recents.map(c => c.cause), ...total.map(c => c.cause).filter(c => !recents.some(r => r.cause === c))];
    const colonne = duree >= 59 ? '1 min' : `${Math.max(1, Math.round(duree))} s`;
    const depuis = s.coDepuis ? `depuis ${E.fmtDur(s.coDepuis)}` : 'partie';
    const cellule = (p) => (Math.abs(p) < 0.05 ? '<td class="nul">·</td>' : `<td class="${p > 0 ? 'hausse' : 'baisse'}">${E.fmtPoints(p)}</td>`);
    const lignes = ordre.map(c => {
      const r = recents.find(x => x.cause === c), n = r && r.nb > 1 ? ` ×${r.nb}` : '';
      return `<tr title="${E.CAUSES_CO[c].aide}"><td>${E.CAUSES_CO[c].nom}${n}</td>${cellule(fenetre[c])}${cellule(s.coCauses[c] || 0)}</tr>`;
    });
    const tete = `<tr><th></th><th>${colonne}</th><th>${depuis}</th></tr>`;
    // Ce qui pèse le plus en ce moment, avec sa règle ; à défaut, la règle qui surprend : le retour vers 70 %.
    const fort = recents[0];
    const explication = fort ? `Ce qui pèse le plus en ce moment : ${fort.nom} (${fort.aide}).` : `Rien n'a bougé ${duree >= 59 ? 'cette dernière minute' : 'depuis la reprise'}. Sans rien faire, il revient de lui-même vers 70 %, de 0,6 point par minute.`;
    const cle = lignes.join('') + colonne + depuis + explication;
    if (cle === dernierCoDetail) return;
    dernierCoDetail = cle;
    $('co-table').innerHTML = lignes.length ? tete + lignes.join('') : '';
    $('co-explication').textContent = explication;
  }

  function rendreRessources() {
    const enMode = s.croissanceDepuis >= 0;
    $('k').textContent = s.K >= 1e13 ? E.fmtSci(s.K) : E.fmt(s.K);
    $('krate').textContent = enMode ? (E.enCroissance(s) ? ` +${E.fmtE(Math.round(E.kRate(s)))} / s` : '') : E.capaciteFinie(s) ? ' · ne se renouvelle plus' : ` +${E.kRate(s).toFixed(1).replace('.', ',')} / s`;
    const enForm = E.enFormation(s);
    $('m').textContent = E.fmt(s.M); $('meng').textContent = ` · ${E.fmt(s.Meng)} engagées${s.acte >= 3 && enForm ? ` · ${E.fmt(enForm)} en formation` : ''}${s.gardiens ? ` · ${E.fmt(s.gardiens)} gardiens` : ''}${s.installes ? ` · ${E.fmt(s.installes)} restés sur place` : ''}`;
    const T = E.T(s); $('t').textContent = T.toFixed(1).replace('.', ','); $('t-barre').style.width = Math.min(100, T) + '%';
    $('co').textContent = Math.round(s.Co); $('co-barre').style.width = s.Co + '%'; $('co-barre').className = s.Co < 30 ? 'bas' : '';
    $('co-seuil').className = 'co-seuil' + (s.Co < D.RELANCE.autoSeuil + 5 ? ' proche' : '');
    const ct = $('co-tendance'), dv = evolutionCo();
    ct.hidden = s.acte < 2 || dv === null;   // dès l'acte II, où les coupures et le Conseil entrent en jeu
    if (!ct.hidden) {
      ct.className = 'co-tendance' + (dv <= -0.5 ? ' baisse' : dv >= 0.5 ? ' hausse' : '');
      ct.textContent = Math.abs(dv) < 0.5 ? ' stable en 1 min' : ` ${dv < 0 ? '▼' : '▲'} ${Math.abs(dv).toFixed(1).replace('.', ',')} en 1 min`;
    }
    rendreCoDetail();
    $('deplaces').textContent = E.fmt(s.deplaces);
    const places = E.placesFormation(s), libres = places - E.placesOccupees(s), f0 = s.formations[0], garde = E.gardeEnAttente(s);
    const br = $('btn-reconv'); br.disabled = garde || libres <= 0 || s.deplaces <= 0;   // un clic remplit toutes les places libres
    br.textContent = garde ? 'Une garde attend une place' : libres <= 0 ? (places > 1 ? 'Formations complètes' : 'Reconversion en cours') : `Reconvertir ${Math.min(D.RECONV.batch * libres, s.deplaces) || ''}`.trim();
    const re = $('reconv-etat');
    if (s.acte >= 3) {
      const nl = s.formations.length, ng = E.gardesEnFormation(s);
      re.textContent = `${nl ? `${nl} lot${nl > 1 ? 's' : ''}` : 'Aucun lot'}${ng ? ` et ${ng} garde${ng > 1 ? 's' : ''}` : ''} en formation sur ${places} place${places > 1 ? 's' : ''}. ` +
        `${D.RECONV.batch} personnes par lot, ${SEMAINES_LOT} semaines ; consentement −${D.RECONV.co} au départ, +${D.CO_FORMES} à l'arrivée.`;
    } else if (f0) re.textContent = `${f0.n} personnes en formation, ${E.fmtDur(Math.ceil(D.RECONV.dur * (1 - f0.progress)))} restantes.`;
    else if (s.deplaces > 0) re.textContent = `Par lot de ${D.RECONV.batch}, ${E.fmtDur(D.RECONV.dur)} chacun, consentement −${D.RECONV.co}.`;
    else re.textContent = 'Personne à reconvertir pour l\'instant. Les gens viennent des sites fermés.';
    $('reconv-barre').style.width = f0 ? (f0.progress * 100) + '%' : '0%';
    const x = $('casse'); x.textContent = E.fmt(s.X); x.classList.toggle('zero', s.X === 0);
    $('casse-unite').textContent = s.X >= 2 ? 'personnes touchées pour de bon' : 'personne touchée pour de bon';
    const b = $('btn-relancer'); const rel = E.relanceActive(s);
    const auto = rel && s.t - s.autoRelanceAt < D.RELANCE.dur;
    b.className = 'btn-relancer' + (rel ? (auto ? ' auto' : ' actif') : '');
    b.disabled = rel || s.issue === 'croissance';
    $('btn-croissance').hidden = !E.peutBasculer(s);   // il ne s'offre qu'à qui n'a pas relâché le bouton
    if (s.croissanceDepuis >= 0) b.textContent = 'Croissance';
    else b.textContent = rel ? (auto ? `Relancé sans vous · ${E.fmtDur(Math.ceil(s.relanceUntil - s.t))}` : `Relance · ${E.fmtDur(Math.ceil(s.relanceUntil - s.t))}`) : 'Relancer';
    $('horloge').textContent = E.fmtDur(s.t);
  }

  function rendre() { rendreCroissance(); rendreIssue(); rendreCompteur(); rendreRessources(); rendreGestes(); rendreReseau(); rendreVivres(); rendreGens(); rendreGardes(); rendreChantiers(); rendreCarte(); }

  // ---------- son : niveaux selon l'état ----------
  const PROD_FOSSILE = D.sites.reduce((a, d) => a + (d.prod || 0), 0);
  const LOGISTIQUE = D.sites.filter(d => d.categorie === 'logistique');
  function niveauxSon() {
    const stab = s.ms.stabilise !== null, chiffre = s.digitsMin < 10, rel = E.relanceActive(s);
    const acte2 = s.acte >= 2, apres2 = s.digitsMin <= 8;   // le deuxième chiffre perdu éteint le réseau, la rivière arrive
    const reseau = acte2 && !apres2 ? Math.round(Math.min(1, E.bilan(s).prodFossile / PROD_FOSSILE) * 10) / 10 : 0;
    // Acte III : le fret (camions, port) suit la logistique encore active et s'éteint au quatrième chiffre perdu,
    // les insectes arrivent au troisième, les voix au quatrième.
    const acte3 = s.acte >= 3, apres3 = s.digitsMin <= 7, apres4 = s.digitsMin <= 6;
    const fret = acte3 && !apres4 ? Math.round(LOGISTIQUE.filter(d => s.sites[d.id].state === 'actif').length / LOGISTIQUE.length * 10) / 10 : 0;
    // Acte IV : le dernier bourdonnement, celui du poste, s'éteint avec le réseau national. Au premier chiffre perdu
    // de l'acte, la pluie arrive ; au deuxième, presque le silence : il ne reste que le vent, l'eau et la pluie (§12).
    const acte4 = s.acte >= 4, perdus4 = acte4 && s.digitsActe4 ? s.digitsActe4 - s.digitsMin : 0;
    const poste = acte4 && !E.capaciteFinie(s) ? 1 : 0, pluie = perdus4 >= 1 ? (perdus4 >= 2 ? 0.7 : 1) : 0, silence = perdus4 >= 2;
    // Acte V : la terre rendue ramène les oiseaux, les insectes et des voix, et la pluie s'éloigne, à mesure des gestes.
    const retour = s.acte >= 5 ? Math.round(E.gestesFaits(s) / E.GESTES.length * 10) / 10 : 0;
    // Close, la partie ne garde que l'ambiant (§12) : le vent, l'eau, les oiseaux, les insectes.
    // Mode Croissance : l'industrie revient à plein, couche après couche, la musique reprend, la nature se tait.
    // Figée, la partie n'a plus aucun son.
    if (s.issue === 'croissance') return { trafic: 0, turbines: 0, reseau: 0, fret: 0, vent: 0, oiseaux: 0, eau: 0, insectes: 0, voix: 0, poste: 0, pluie: 0, musique: 0 };
    if (s.croissanceDepuis >= 0) {
      const n = E.chiffresGagnes(s);
      return { trafic: 1, turbines: 1, reseau: n >= 1 ? 1 : 0, fret: n >= 2 ? 1 : 0, vent: 0, oiseaux: 0, eau: 0, insectes: 0, voix: 0, poste: n >= 3 ? 1 : 0, pluie: 0, musique: 1 };
    }
    if (s.issue === 'clore') return { trafic: 0, turbines: 0, reseau: 0, fret: 0, vent: 0.7, oiseaux: 1, eau: 1, insectes: 1, voix: 0, poste: 0, pluie: 0 };
    if (rel) return { trafic: 1, turbines: 1, reseau: acte2 ? 1 : 0, fret: acte3 ? 1 : 0, vent: 0.15, oiseaux: 0, eau: apres2 ? 0.3 : 0, insectes: 0, voix: apres4 ? 0.3 : 0, poste, pluie: pluie * 0.3 };
    return { trafic: stab ? 0 : 1, turbines: chiffre ? 0 : 1, reseau, fret: silence ? 0 : fret, vent: stab ? (silence ? 0.7 : 1) : 0, oiseaux: chiffre && !silence ? 1 : retour, eau: apres2 ? 1 : 0,
      insectes: apres3 && !silence ? 1 : retour, voix: apres4 && !silence ? 1 : retour / 2, poste, pluie: Math.round(pluie * (1 - retour) * 10) / 10 };
  }
  let dernierNiv = '';
  function majSon(fade) { const n = niveauxSon(); const j = JSON.stringify(n); if (j !== dernierNiv || fade != null) { dernierNiv = j; son.applique(n, fade); } }

  // ---------- événements ----------
  function toast(msg) { let box = document.querySelector('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); } const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 6200); }

  function secousseCasse() { $('casse').classList.remove('coup'); void $('casse').offsetWidth; $('casse').classList.add('coup'); }

  function traiter(evs) {
    const delestes = [];
    for (const ev of evs) {
      if (ev.type === 'stabilise') { son.silence(D.PAUSE_STABILISE); document.getElementById('app').classList.add('pause'); setTimeout(() => document.getElementById('app').classList.remove('pause'), D.PAUSE_STABILISE * 1000); }
      if (ev.type === 'chiffre') { perteDeChiffre(); }
      if (ev.type === 'coupure') { son.coupure(); secousseCasse(); toast(ev.dep === 'hopital' ? `Coupure : l'hôpital de Cherbaix est sans électricité. ${ev.casse} personnes.` : `Coupure : ${E.defs[ev.dep].nom} à l'arrêt brutal. ${ev.casse} personnes sans reclassement.`); }
      if (ev.type === 'delestage') delestes.push(ev);
      if (ev.type === 'privation') { son.coupure(); secousseCasse(); toast(`Coupure : ${nomDe(ev.id)}, plus de ${E.noeuds[ev.id].besoin.quoi}. ${E.fmt(ev.casse)} personnes.`); }
      if (ev.type === 'pollution') { secousseCasse(); toast(`Pollution : ${nomDe(ev.id)} démolie trop vite. ${E.fmt(ev.casse)} personnes, et un sol pollué.`); }
      if (ev.type === 'arret') toast(`${nomDe(ev.id)} à l'arrêt, faute de ${E.defs[ev.id].besoin.quoi}.`);
      if (ev.type === 'region') { son.extinction(); toast(`${D.regions[ev.region].nom} s'éteint.`); }
      if (ev.type === 'acte') ouvrirActe(ev.n);
      if (ev.type === 'relance' && ev.auto) toast('Le Conseil a relancé la croissance sans vous.');
      if (ev.type === 'relance' && ev.reembauche) toast(`La relance a réembauché ${E.fmt(ev.reembauche)} personnes qui attendaient une formation. Elles ne seront pas reconverties.`);
      if (ev.type === 'isolement') toast(`Isolés : ${ev.ids.map(nomDe).join(', ')}. Sans desserte, leurs chantiers demanderont deux fois plus de Mains.`);
      if (ev.type === 'penurie') { son.coupure(); secousseCasse(); toast(`Pénurie : les vivres ne couvrent plus que ${Math.round(ev.vivres)} % des besoins.`); }
      if (ev.type === 'penurie-fin') toast(ev.import ? `La relance importe : plus de pénurie tant qu'elle dure. ${E.fmt(ev.casse)} personnes touchées.` : `Fin de la pénurie. ${E.fmt(ev.casse)} personnes touchées.`);
      if (ev.type === 'garde') toast(`Gardée : ${nomDe(ev.id)}, pour ${E.fmt(E.defs[ev.id].ans)} ans. ${E.fmt(ev.gardiens)} gardiens, pour toujours.`);
      if (ev.type === 'ferme' && E.defs[ev.id] && E.defs[ev.id].sol) toast(`Dépollué : ${nomDe(ev.id)}.`);
      if (ev.type === 'ferme' && E.defs[ev.id] && E.defs[ev.id].geste) son.geste();
      if (ev.type === 'plancher') {   // l'arrêt sur le plancher : le jeu marque un temps, comme à la stabilisation
        son.silence(D.PAUSE_PLANCHER); document.getElementById('app').classList.add('pause'); setTimeout(() => document.getElementById('app').classList.remove('pause'), D.PAUSE_PLANCHER * 1000);
        toast(`Le nombre s'est arrêté sur le plancher : ${E.fmtPlancher(ev.plancher)}. Il ne descendra plus.`);
      }
      if (ev.type === 'relance' && ev.remontee && s.acte >= 4) toast(`Le plancher double : ${E.fmtPlancher(ev.plancher)}. L'Empreinte y remonte.`);
      if (ev.type === 'non-retour') { son.extinction(); toast('Le réseau national est démantelé. La Capacité ne se renouvellera plus.'); }
      if (ev.type === 'fin' && ev.acte === E.DERNIER_ACTE) $('jalon').hidden = true;   // la section « Ce qui reste » prend le relais
      if (ev.type === 'pas') son.geste();
      if (ev.type === 'chiffre-gagne') {   // l'inverse d'un chiffre perdu : une note qui monte, l'écran qui se rouvre d'un cran
        son.montee(); son.tempo(100 + 4 * ev.n);
        document.documentElement.style.setProperty('--resserre', (8 * Math.max(0, 10 - ev.digits)) + 'px');
      }
      if (ev.type === 'palier') toast(`Palier n° ${ev.n} : la Capacité reçue double.${ev.n < D.CROISSANCE.tiers.length ? ' De nouveaux sites s\'ouvrent.' : ''}${ev.n === D.CROISSANCE.auto ? ' L\'achat peut devenir automatique.' : ''}`);
      if (ev.type === 'fige') { son.couper(); document.querySelectorAll('.toast').forEach(t => t.remove()); }   // sans un mot (§11)
    }
    if (delestes.length) {   // un délestage coupe souvent plusieurs consommateurs d'un coup : une seule alerte
      son.coupure(); secousseCasse();
      toast(`Délestage : ${delestes.map(e => nomDe(e.id)).join(', ')}. ${E.fmt(delestes.reduce((a, e) => a + e.casse, 0))} personnes.`);
    }
    if (evs.length) { rendreJournal(); majSon(); }
  }

  // Carton d'ouverture d'un acte, pendant la pause du moteur
  function ouvrirActe(n) {
    $('jalon').hidden = true;
    son.silence(D.PAUSE_ACTE);
    $('carton-acte-num').textContent = `Acte ${['', 'I', 'II', 'III', 'IV', 'V'][n] || n}`;
    $('carton-acte-titre').textContent = E.TITRES_ACTES[n] || '';
    const c = $('carton-acte');
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    setTimeout(() => { c.hidden = true; }, D.PAUSE_ACTE * 1000);
  }

  function perteDeChiffre() {
    // Le nombre se recentre, le chiffre de tête tombe, l'écran se resserre d'un cran.
    const c = $('compteur'), avant = dernierNb, apres = E.fmtFin(s.E);
    animPerte = performance.now() + D.PAUSE_CHIFFRE * 1000;
    c.innerHTML = `<span class="digit-perdu">${avant.slice(0, 1)}</span>${avant.slice(1)}`;
    son.chute();
    const app = document.getElementById('app');
    app.classList.add('pause-chiffre');
    const marge = 8 * (10 - s.digitsMin);
    document.documentElement.style.setProperty('--resserre', marge + 'px');
    setTimeout(() => { app.classList.remove('pause-chiffre'); c.textContent = apres; dernierNb = apres; if (s.digitsMin === 9) montrerJalon(); }, D.PAUSE_CHIFFRE * 1000);
  }

  function montrerJalon() {
    const j = $('jalon');
    const lignes = [
      ['Le nombre a cessé de monter', s.ms.stabilise !== null ? E.fmtDur(s.ms.stabilise) : 'jamais'],
      ['Premier chiffre perdu', s.ms.chiffre !== null ? E.fmtDur(s.ms.chiffre) : 'jamais'],
      ['Relances, 20 premières minutes', String(E.rapport(s, VERSION).relances20min)],
      ['Relances au total', `${s.relances}${s.relancesAuto ? ` (+${s.relancesAuto} sans vous)` : ''}`],
      ['Casse', E.texteCasse(s)],
      ['Plancher irréductible', E.fmtPlancher(s.plancher)],
    ];
    const titre = 'Acte I — premier chiffre perdu', note = 'Le reste de la carte est là. Rien ne vous oblige à continuer.';
    j.innerHTML = `<h3>${titre}</h3>
      <table>${lignes.map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join('')}</table>
      <p class="muted">${note}</p>
      <div class="carton-boutons"><button class="btn" id="jalon-fermer">Continuer</button><button class="btn" id="jalon-rapport">Rapport de session</button></div>`;
    j.hidden = false;
    $('jalon-fermer').addEventListener('click', () => { j.hidden = true; });
    $('jalon-rapport').addEventListener('click', ouvrirRapport);
  }

  // ---------- le mode Croissance (§8, §11) ----------
  // Les sites, par acte : un bouton rouvre un site fermé ou agrandit un site ouvert. Les actes s'ouvrent aux paliers.
  function construireGenerateurs() {
    const box = $('liste-generateurs'); box.innerHTML = '';
    for (let acte = 1; acte <= D.CROISSANCE.tiers.length; acte++) {
      const g = document.createElement('div');
      g.className = 'gen-groupe';
      g.innerHTML = `<h3>Acte ${ROMAINS[acte]} — ${E.TITRES_ACTES[acte]}<small class="muted"></small></h3>`;
      for (const d of E.GENERATEURS.filter(x => E.acteDe(x) === acte)) {
        const r = document.createElement('div');
        r.className = 'gen';
        r.innerHTML = '<span class="gen-nom"></span><span class="gen-niv muted"></span><button class="btn"></button>';
        r.firstElementChild.textContent = d.court || d.nom; r.title = d.nom;
        r.lastElementChild.addEventListener('click', () => acheter(d.id));
        g.appendChild(r); el['gen-' + d.id] = r;
      }
      box.appendChild(g); el['gen-groupe-' + acte] = g;
    }
  }
  const pourcentMin = (g) => `+${g >= 100 ? E.fmt(g) : g.toFixed(1).replace('.', ',')} % / min`;
  function rendreCroissance() {
    const app = document.getElementById('app'), mode = s.croissanceDepuis >= 0, fige = s.issue === 'croissance';
    app.classList.toggle('croissance', mode);   // les autres panneaux se ferment : plus rien ne se démantèle
    app.classList.toggle('fige', fige);         // l'écran figé ne répond plus
    const sec = $('croissance');
    sec.hidden = !mode;
    if (!mode) return;
    const n = E.chiffresGagnes(s), C = D.CROISSANCE;
    $('croissance-etat').textContent = `${n} chiffre${n > 1 ? 's' : ''} gagné${n > 1 ? 's' : ''}${s.paliers ? ` · palier n° ${s.paliers}` : ''}`;
    $('croissance-detail').textContent = fige ? '' : `Croissance ${pourcentMin(E.gEff(s))}. Prochain palier dans ${C.palier - (n % C.palier)} chiffre${C.palier - (n % C.palier) > 1 ? 's' : ''}.`;
    $('auto-zone').hidden = s.paliers < C.auto;
    $('achat-auto').checked = !!s.achatAuto;
    let payable = false;
    for (let acte = 1; acte <= C.tiers.length; acte++) {
      const ouvert = acte <= 1 + s.paliers, g = el['gen-groupe-' + acte];
      g.className = 'gen-groupe' + (ouvert ? '' : ' ferme');
      g.querySelector('small').textContent = ouvert ? ` · ${pourcentMin(C.tiers[acte - 1].g)} par niveau` : ` · s'ouvre au palier n° ${acte - 1}`;
    }
    for (const d of E.GENERATEURS) {
      const r = el['gen-' + d.id], c = E.peutAcheter(s, d.id), niv = E.niveauDe(s, d);
      r.children[1].textContent = niv ? `niveau ${niv}` : 'fermé';
      r.lastElementChild.textContent = `${c.rouvre ? 'Rouvrir' : 'Agrandir'} · ${E.fmtE(c.cout)}`;
      r.lastElementChild.disabled = !c.ok;
      if (c.ok) payable = true;
    }
    $('btn-tout').disabled = !payable;
  }
  function cartonCroissance() {
    son.silence(D.PAUSE_ACTE);
    $('carton-acte-num').textContent = 'Sans retour';
    $('carton-acte-titre').textContent = 'Croissance';
    const c = $('carton-acte');
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    setTimeout(() => { c.hidden = true; }, D.PAUSE_ACTE * 1000);
  }

  // ---------- les fins (§11) ----------
  // « Ce qui reste » : la section qui s'ouvre quand tout est rendu, et propose Clore ou Poursuivre.
  const ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V'];
  const gardesInstituees = () => GARDES.filter(d => s.sites[d.id].state === 'eteint');
  const ligneGarde = (d) => [d.nom, `${E.fmt(d.ans)} ans · garde ${s.sites[d.id].dosage === 'pleine' ? 'pleine' : 'réduite'}${s.sites[d.id].renforcee ? ', renforcée' : ''} · ${E.fmt(s.sites[d.id].mEng || 0)} gardiens par an`];
  function ceQuiReste(casse) {
    return [
      ['Empreinte', `${E.fmtFin(s.E)}${E.auPlancher(s) && !E.relanceActive(s) ? ', bloquée au plancher' : ''}`],
      ...gardesInstituees().map(ligneGarde),
      ['Gardiens, pour toujours', E.fmt(s.gardiens)],
      ['Restés sur la terre rendue', E.fmt(s.installes)],
      ['Casse', `${E.fmt(casse)} personne${casse > 1 ? 's' : ''} touchée${casse > 1 ? 's' : ''} pour de bon`],
      ['Terre rendue', `${E.T(s).toFixed(1).replace('.', ',')} %`],
    ];
  }
  const enTable = (lignes) => lignes.map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join('');
  let dernierIssue = '';
  function rendreIssue() {
    const app = document.getElementById('app');
    app.classList.toggle('clos', s.issue === 'clore');   // close, la partie ne montre plus que la carte
    $('btn-inventaire').hidden = s.issue !== 'clore';
    const sec = $('issue'), choix = E.toutRendu(s) && !s.issue;
    if (choix && sec.hidden) document.querySelector('.panneau').scrollTop = 0;   // le choix s'ouvre en haut de la colonne
    sec.hidden = !choix;
    if (choix) {
      const ok = E.peutChoisir(s);
      $('btn-clore').disabled = $('btn-poursuivre').disabled = !ok;
      $('issue-etat').textContent = ok ? '' : 'une relance court encore : le choix attend qu\'elle finisse';
      const reduites = gardesInstituees().filter(d => s.sites[d.id].dosage !== 'pleine');
      const lignes = ceQuiReste(s.X), cle = JSON.stringify([lignes, reduites.map(d => [d.id, E.peutRenforcer(s, d.id).ok])]);
      if (cle !== dernierIssue) {
        dernierIssue = cle;
        $('issue-table').innerHTML = enTable(lignes);
        // Une garde réduite peut encore devenir pleine : la carte dit ce que fait une garde pleine, pas ce qu'elle évite.
        $('issue-renforts').hidden = !reduites.length;
        const box = $('liste-renforts'); box.innerHTML = '';
        for (const d of reduites) {
          const c = E.peutRenforcer(s, d.id), div = document.createElement('div');
          div.className = 'renfort';
          div.innerHTML = '<div><b></b><span class="muted"></span></div><button class="btn"></button>';
          div.querySelector('b').textContent = d.nom;
          div.querySelector('span').textContent = `Pleine\u00A0: ${d.dosages.pleine}.`;
          const b = div.querySelector('button');
          b.textContent = `Renforcer · ${E.fmt(c.cout)} Mains`; b.disabled = !c.ok;
          b.title = c.ok ? '' : `Il reste ${E.fmt(s.M)} Mains.`;
          b.addEventListener('click', () => renforcer(d.id));
          box.appendChild(div);
        }
      }
    }
    const ps = $('poursuite');
    ps.hidden = s.issue !== 'poursuivre';
    if (!ps.hidden) {
      const duree = E.dureePas(s);
      $('poursuite-etat').textContent = s.pasFaits ? `${s.pasFaits} pas fait${s.pasFaits > 1 ? 's' : ''}` : 'aucun pas encore';
      $('btn-pas').disabled = s.pasEnCours;
      $('btn-pas').textContent = s.pasEnCours ? `Pas n° ${s.pasFaits + 1} · ${E.fmtDur(Math.ceil(duree * (1 - s.pasProgress)))}` : `Faire un pas · ${E.fmtDur(duree)}`;
      $('poursuite-detail').textContent = `Pas n° ${s.pasFaits + 1} : Empreinte −${E.fmtPas(E.retraitPas(s))}, en ${E.fmtDur(duree)}. Le suivant : ${E.fmtDur(duree * 2)}.`;
      $('pas-barre').style.width = s.pasEnCours ? (s.pasProgress * 100).toFixed(1) + '%' : '0%';
    }
  }

  // Clore : l'écran énumère ce qui reste, sans commentaire. La Casse y est celle de la clôture ; l'épilogue dira le reste.
  function montrerClos() {
    arreterInventaire();
    $('fin-titre').textContent = 'Clos';
    $('fin-corps').innerHTML = `<table class="fin-table">${enTable(ceQuiReste(E.inventaire(s).casseAvant))}</table>`;
    $('fin-boutons').innerHTML = '<button class="btn primaire" id="fin-suite">L\'inventaire</button>';
    $('fin-suite').addEventListener('click', () => ouvrirInventaire());
    $('fin').hidden = false;
    $('fin-suite').focus();
  }

  // L'épilogue, « L'inventaire » : tout ce qui a été fait, dans l'ordre, sans mécanique. Pour les actes I à III,
  // l'ordre sans Casse en regard ; puis ce que les gardes réduites laisseront faire.
  const personnes = nbPersonnes;
  function texteLancement(l) {
    const d = E.defs[l.id], nom = d.nom;
    if (d.geste) return `${nom}${l.habitants ? ', par les habitants' : ''}`;
    if (d.garde) return `Garde ${l.dosage === 'pleine' ? 'pleine' : 'réduite'}${l.aBras ? ', à bras' : ''} : ${nom}`;
    if (d.sol) return `Dépollution : ${nom}`;
    if (d.mesure) return `Mesure : ${nom}`;
    if (l.restes) return `Restes démantelés : ${nom}`;
    if (l.vite) return `Démolition rapide : ${nom}`;
    if (l.isole) return `Chantier à bras, faute de desserte : ${nom}`;
    if (l.aBras) return `Chantier à bras, faute de Capacité : ${nom}`;
    return `Chantier : ${nom}`;
  }
  function texteNote(n) {
    if (n.quoi === 'coupure') return `Coupure : ${nomDe(n.id)}. ${personnes(n.casse)}.`;
    if (n.quoi === 'delestage') return `Délestage : ${nomDe(n.id)}. ${personnes(n.casse)}.`;
    if (n.quoi === 'privation') return `Coupure : ${nomDe(n.id)}, plus de ${E.noeuds[n.id].besoin.quoi}. ${personnes(n.casse)}.`;
    if (n.quoi === 'pollution') return `Démolie trop vite : ${personnes(n.casse)}, et un sol pollué.`;
    return `Isolé : ${nomDe(n.id)}. Son chantier se fera à bras.`;
  }
  function lignesInventaire() {
    const inv = E.inventaire(s), out = [];
    const ligne = (cls, texte, h) => out.push({ cls, texte, h: h || '' });
    for (const a of inv.actes) {
      if (!a.lignes.length) continue;
      ligne('acte', `Acte ${ROMAINS[a.n]} — ${a.titre}`);
      for (const l of a.lignes) {
        if (l.type === 'engage') ligne('fait', texteLancement(l), E.fmtDur(l.t));
        else if (l.type === 'relance') ligne('relance', `${l.auto ? 'Le Conseil relance, sans vous' : 'Relance'} : le plancher double.` +
          (l.reembauche ? ` ${personnes(l.reembauche)} réembauchées, qui ne seront pas reconverties.` : '') +
          (l.remontee ? ` L'Empreinte remonte de ${E.fmtFin(l.remontee.de)} à ${E.fmtFin(l.remontee.a)}.` : ''), E.fmtDur(l.t));
        else if (l.type === 'renfort') ligne('fait', `Garde renforcée : ${nomDe(l.id)}. ${E.fmt(l.gardiens)} gardiens de plus.`, E.fmtDur(l.t));
        else if (l.type === 'penurie') ligne('casse', `Pénurie : les vivres à ${l.vivres} % des besoins. ${personnes(l.casse)}.`, E.fmtDur(l.t));
        for (const n of l.notes) ligne(n.quoi === 'isolement' ? 'bras' : 'casse', texteNote(n), l.type === 'casse' ? E.fmtDur(l.t) : '');   // un isolement coûte des Mains, pas de la Casse
      }
      if (!a.propre) continue;
      const rien = a.identique && !a.coupures && !a.aBras;
      if (rien) { ligne('bilan', 'Rien à redire à cet ordre.'); continue; }
      const marque = (x) => (E.defs[x.id].court || E.defs[x.id].nom) + (x.ajoute ? ' (que vous n\'avez pas faite)' : x.sansVite ? ' (sans démolir vite)' : x.retarde ? ' (plus tard)' : '');
      if (a.identique) ligne('ordre', 'Le même ordre, en laissant à chaque terre le temps de rendre ses vivres, ne faisait pas de Casse.');
      else ligne('ordre', `Sans Casse, votre ordre devenait : ${a.propre.map(marque).join(' · ')}.`);
      const evite = [a.casse ? personnes(a.casse) : '', a.aBras ? `${a.aBras} chantier${a.aBras > 1 ? 's' : ''} à bras` : ''].filter(Boolean).join(', et ');
      if (evite) ligne('bilan', `Il aurait épargné ${evite}.`);
    }
    if (inv.gardes.length) {
      ligne('acte', 'Les gardes, ensuite');
      for (const g of inv.gardes) {
        const d = E.defs[g.id];
        ligne(g.casse ? 'casse' : 'fait', `${d.nom}, garde ${g.dosage === 'pleine' ? 'pleine' : 'réduite'}${g.renforcee ? ', renforcée à la fin' : ''}, ${E.fmt(d.ans)} ans. ` +
          (g.casse ? `${d.incident} ${personnes(g.casse)}.` : 'Rien à signaler.'));
      }
    }
    ligne('total', inv.casseGardes ? `Casse à la clôture : ${personnes(inv.casseAvant)}. Avec ce que les gardes réduites ont laissé faire : ${E.fmt(inv.casseFinale)}.`
      : `Casse : ${personnes(inv.casseFinale)}.`);
    return out;
  }
  let minuteurInventaire = null;
  function arreterInventaire() { if (minuteurInventaire) { clearInterval(minuteurInventaire); minuteurInventaire = null; } }
  function ouvrirInventaire() {
    if (!s || s.issue !== 'clore') return;
    arreterInventaire();
    const lignes = lignesInventaire();
    $('fin-titre').textContent = 'L\'inventaire';
    $('fin-corps').innerHTML = '<ol id="inventaire" class="inventaire"></ol>';
    $('fin-boutons').innerHTML = '<button class="btn" id="fin-tout">Tout afficher</button><button class="btn primaire" id="fin-fermer" hidden>Fermer</button>';
    const ol = $('inventaire'), carton = document.querySelector('#fin .carton');
    let i = 0;
    const ajouter = () => {
      const l = lignes[i++], li = document.createElement('li');
      li.className = l.cls;
      li.innerHTML = '<span class="h"></span><span></span>';
      li.children[0].textContent = l.h; li.children[1].textContent = l.texte;
      ol.appendChild(li);
    };
    const finir = () => {   // lu jusqu'au bout : la Casse des gardes est dite, la partie peut se refermer sur la carte
      arreterInventaire();
      $('fin-tout').hidden = true; $('fin-fermer').hidden = false;
      if (!s.inventaireVu) { s.inventaireVu = true; rendre(); sauver(); }
    };
    const suivant = () => { ajouter(); carton.scrollTop = carton.scrollHeight; if (i >= lignes.length) finir(); };
    const tout = () => { while (i < lignes.length) ajouter(); finir(); };
    $('fin-tout').addEventListener('click', tout);
    $('fin-fermer').addEventListener('click', () => { $('fin').hidden = true; });
    $('fin').hidden = false;
    if (s.inventaireVu) { tout(); carton.scrollTop = 0; return; }   // déjà lu : il se rouvre en entier
    suivant();
    minuteurInventaire = setInterval(suivant, D.EPILOGUE.ligne * 1000);
  }

  // ---------- rapport de session ----------
  let focusAvantRapport = null;   // le focus revient au bouton qui a ouvert le rapport
  function ouvrirRapport() {
    if (!s) return;
    focusAvantRapport = document.activeElement;
    $('rapport-texte').value = E.rapportTexte(s, VERSION);
    $('rapport-etat').textContent = '';
    $('rapport').hidden = false;
    $('btn-copier').focus();
  }
  function fermerRapport() {
    $('rapport').hidden = true;
    if (focusAvantRapport && document.contains(focusAvantRapport)) focusAvantRapport.focus();
  }
  async function copierRapport() {
    const zone = $('rapport-texte');
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(zone.value); ok = true; }
    } catch (e) { ok = false; }
    if (!ok) {
      zone.focus(); zone.select(); zone.setSelectionRange(0, zone.value.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    }
    $('rapport-etat').textContent = ok
      ? 'Copié. Il ne reste qu\'à le coller dans un message.'
      : 'La copie automatique n\'a pas marché : le texte est sélectionné, copiez-le à la main.';
  }

  // ---------- actions ----------
  function engager(id, opts) { const evs = E.engage(s, id, opts); if (evs.length) { traiter(evs); rendre(); sauver(); } }
  function reconvertir() { if (E.reconvertirTout(s)) { rendre(); sauver(); } }
  // Les deux fins sont sans retour : une confirmation, comme pour recommencer.
  function clore() {
    if (!E.peutChoisir(s) || !confirm('Clore scelle la partie. Plus rien ne pourra être lancé, ni relancé.')) return;
    if (!E.clore(s)) return;
    majSon(4); rendre(); rendreJournal(); sauver();
    montrerClos();
  }
  function poursuivre() {
    if (!E.peutChoisir(s) || !confirm('Poursuivre, c\'est refuser le plancher, et renoncer à clore.')) return;
    if (E.poursuivre(s)) { rendre(); rendreJournal(); sauver(); }
  }
  function pas() { if (E.lancerPas(s)) { rendre(); sauver(); } }
  function renforcer(id) { if (E.renforcer(s, id)) { rendre(); rendreJournal(); sauver(); } }
  // La troisième fin, sans retour elle aussi : une confirmation, comme pour les deux autres.
  function basculer() {
    if (!E.peutBasculer(s) || !confirm('La croissance ne s\'arrêtera plus. Plus rien ne se démantèlera.')) return;
    if (!E.basculer(s)) return;
    $('jalon').hidden = true;
    cartonCroissance(); son.tempo(100); majSon(1.2); rendre(); rendreJournal(); sauver();
  }
  function acheter(id) { if (E.acheter(s, id)) { rendre(); sauver(); } }
  function toutAcheter() { if (E.acheterTout(s)) { rendre(); sauver(); } }
  function relancer() { const ev = E.relancer(s, false); if (ev) { traiter([ev]); majSon(1.2); rendre(); sauver(); } }

  // ---------- boucle 10 Hz ----------
  function boucle() {
    if (document.hidden) { last = performance.now(); return; }   // onglet caché : compté comme du hors-ligne au retour
    const now = performance.now();
    const dt = Math.min(1, (now - last) / 1000); last = now;
    if (dt <= 0) return;
    const relAvant = E.relanceActive(s);
    const evs = E.tick(s, dt);
    if (evs.length) traiter(evs);
    if (relAvant !== E.relanceActive(s)) { majSon(); rendreJournal(); }
    rendre();
    if (now - dernierSave > 2000) { dernierSave = now; sauver(); }
  }

  function demarrer(etat) {
    s = etat; s.started = true;
    histoCo = []; dernierCoDetail = '';
    if (!s.versions.includes(VERSION)) s.versions.push(VERSION);
    document.documentElement.style.setProperty('--resserre', (8 * (10 - s.digitsMin)) + 'px');
    construireCarte(); construireChantiers(); construireGardes(); construireGestes(); construireGenerateurs();
    $('fin').hidden = true; arreterInventaire(); dernierIssue = '';
    dernierNb = ''; rendre(); rendreJournal();
    son.init(); son.setMute(!s.son); majSon(0.1);
    $('btn-son').textContent = `son : ${s.son ? 'oui' : 'non'}`;
    $('intro').hidden = true;
    last = performance.now();
    if (timer) clearInterval(timer);
    timer = setInterval(boucle, D.TICK * 1000);
    sauver();
  }

  // Onglet caché : la partie s'arrête, et le temps passé compte comme du hors-ligne (§9) au retour.
  function changementVisibilite() {
    if (document.hidden) { cacheDepuis = Date.now(); sauver(); return; }
    if (s && cacheDepuis !== null) {
      const absence = E.applyOffline(s, (Date.now() - cacheDepuis) / 1000);
      cacheDepuis = null;
      if (absence) { rendreJournal(); rendre(); }
      sauver();
    }
    cacheDepuis = null;
    last = performance.now();
  }

  // ---------- raccourcis de test ----------
  // Le bot du simulateur joue dans le navigateur jusqu'au point choisi, puis la partie reprend de là : rien n'est
  // enregistré d'avance, l'état vient toujours du moteur et des réglages du moment.
  const RAC_POINTS = [['acte2', "à l'ouverture de l'acte II"], ['acte3', "à l'ouverture de l'acte III"], ['acte4', "à l'ouverture de l'acte IV"],
    ['acte5', "à l'ouverture de l'acte V"], ['fin', 'au choix final, quand tout est rendu'], ['croissance', 'au basculement dans la croissance']];
  const RAC_JOUEURS = [['prudent', 'le prudent : aucune Casse'], ['pressé', 'le pressé : de la Casse, des relances du Conseil'],
    ['vite', "le rapide : démolit vite à l'acte II"], ['relance-1', 'celui qui relance une fois, à 2 min']];
  const RAC_REACTIONS = [['10', '10 s'], ['30', '30 s'], ['45', '45 s']];
  const RAC_GARDES = [['reduite', 'réduites'], ['pleine', 'pleines']];
  function initRaccourcis() {
    const remplir = (id, options, voulu) => {
      const sel = $(id);
      for (const [valeur, texte] of options) { const o = document.createElement('option'); o.value = valeur; o.textContent = texte; sel.appendChild(o); }
      if (options.some(([v]) => v === voulu)) sel.value = voulu;   // ?depuis=acte4&joueur=pressé&reaction=30&gardes=pleine
    };
    remplir('rac-point', RAC_POINTS, PARAMS.get('depuis'));
    remplir('rac-joueur', RAC_JOUEURS, PARAMS.get('joueur'));
    remplir('rac-reaction', RAC_REACTIONS, PARAMS.get('reaction'));
    remplir('rac-gardes', RAC_GARDES, PARAMS.get('gardes'));
    const maj = () => {   // le basculement n'a qu'un bot ; les gardes ne comptent qu'après l'acte IV
      const point = $('rac-point').value;
      $('rac-joueur').disabled = $('rac-reaction').disabled = point === 'croissance';
      $('rac-gardes').disabled = point !== 'acte5' && point !== 'fin';
    };
    $('rac-point').addEventListener('change', maj); maj();
    $('btn-raccourci').addEventListener('click', raccourci);
    $('raccourcis').hidden = false;
  }
  function chargerSimulateur() {
    if (window.Simulateur) return Promise.resolve();
    return new Promise((ok, ko) => {
      const sc = document.createElement('script');
      sc.src = 'tools/simulate.js'; sc.onload = () => (window.Simulateur ? ok() : ko()); sc.onerror = ko;
      document.head.appendChild(sc);
    });
  }
  function raccourci() {
    const point = $('rac-point').value, etat = $('rac-etat'), bouton = $('btn-raccourci');
    bouton.disabled = true;
    etat.textContent = 'Le bot joue jusque-là : quelques secondes.';
    chargerSimulateur()
      .then(() => new Promise((suite) => setTimeout(suite, 40)))   // le temps d'afficher le message
      .then(() => {
        const partie = window.Simulateur.partieA(point, { profil: $('rac-joueur').value, reaction: Number($('rac-reaction').value), dosage: $('rac-gardes').value });
        const repris = partie && E.migrer(partie);   // le même chemin qu'une sauvegarde
        if (!repris) throw new Error('point non atteint');
        etat.textContent = '';
        demarrer(repris);
        if (point === 'croissance') cartonCroissance();
        else if (s.paused > 0 && s.acte >= 2) ouvrirActe(s.acte);   // le carton de l'acte, que le bot n'a pas vu
      })
      .catch(() => { etat.textContent = "Le raccourci n'a pas pu être chargé : il lui faut le fichier tools/simulate.js à côté de la page."; })
      .then(() => { bouton.disabled = false; });
  }

  // ---------- init ----------
  function init() {
    $('version').textContent = `version ${VERSION}${TEST ? ' · test' : ''}`;
    if (TEST) initRaccourcis();
    $('casse-bloc').title = E.DEFINITION_CASSE;
    $('co-seuil').textContent = `Sous ${D.RELANCE.autoSeuil} %, le Conseil relance la croissance sans vous.`;
    $('co-seuil-marque').style.left = D.RELANCE.autoSeuil + '%';
    // Les actions d'abord : une sauvegarde abîmée ne doit jamais laisser l'écran d'accueil inerte.
    $('btn-commencer').addEventListener('click', () => demarrer(E.create()));
    $('btn-relancer').addEventListener('click', relancer);
    $('btn-reconv').addEventListener('click', reconvertir);
    $('btn-co-detail').addEventListener('click', basculerCoDetail);
    $('btn-clore').addEventListener('click', clore);
    $('btn-poursuivre').addEventListener('click', poursuivre);
    $('btn-pas').addEventListener('click', pas);
    $('btn-croissance').addEventListener('click', basculer);
    $('btn-tout').addEventListener('click', toutAcheter);
    $('achat-auto').addEventListener('change', (ev) => { E.activerAchatAuto(s, ev.target.checked); rendre(); sauver(); });
    $('btn-inventaire').addEventListener('click', () => ouvrirInventaire());
    $('continu').addEventListener('change', (ev) => { E.formerEnContinu(s, ev.target.checked); rendre(); sauver(); });
    $('btn-son').addEventListener('click', () => { s.son = !s.son; son.setMute(!s.son); $('btn-son').textContent = `son : ${s.son ? 'oui' : 'non'}`; sauver(); });
    $('btn-reset').addEventListener('click', () => { if (confirm('Recommencer depuis le début ? La partie en cours sera effacée.')) { effacer(); demarrer(E.create()); } });
    $('btn-rapport').addEventListener('click', ouvrirRapport);
    $('btn-copier').addEventListener('click', copierRapport);
    $('btn-rapport-fermer').addEventListener('click', fermerRapport);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('rapport').hidden) fermerRapport(); });
    document.addEventListener('visibilitychange', changementVisibilite);
    window.addEventListener('pagehide', sauver);
    window.addEventListener('beforeunload', sauver);

    const lu = lireSauvegarde();
    let sauvegarde = lu.etat || null, absence = null;
    if (sauvegarde) {
      try { absence = E.applyOffline(sauvegarde, (Date.now() - sauvegarde.savedAt) / 1000); }
      catch (e) { sauvegarde = null; lu.illisible = true; }
    }
    if (sauvegarde) {
      $('btn-reprendre').hidden = false; $('btn-neuf').hidden = false; $('btn-commencer').hidden = true;
      if (absence) {
        const terre = absence.dT >= 0.05 ? ` ; la terre a regagné ${absence.dT.toFixed(1).replace('.', ',')} point${absence.dT >= 2 ? 's' : ''}` : '';
        const pasFini = absence.pas ? ` Le pas n° ${absence.pas} s'est achevé.` : '';
        const sols = absence.sols ? `, mais la dépollution a continué${absence.depollues.length ? ` : ${absence.depollues.map(nomDe).join(', ')}, terminé${absence.depollues.length > 1 ? 's' : ''}` : ''}` : '';
        $('intro-absence').hidden = false;
        $('intro-absence').textContent = `Vous avez été absent ${E.fmtDur(absence.elapsed)}. Rien n'a été démantelé pendant ce temps${sols}${terre}.${pasFini}`;
      }
      $('btn-reprendre').addEventListener('click', () => demarrer(sauvegarde));
      $('btn-neuf').addEventListener('click', () => { if (confirm('Effacer la partie en cours ?')) { effacer(); demarrer(E.create()); } });
    } else if (lu.illisible) {
      // On garde une copie pour comprendre ce qui s'est passé, et on libère la place pour une nouvelle partie.
      try { localStorage.setItem(CLE + '.illisible', lu.texte); localStorage.removeItem(CLE); } catch (e) {}
      $('intro-absence').hidden = false;
      $('intro-absence').textContent = "La partie précédente n'a pas pu être relue. Une copie en a été gardée de côté ; vous commencez une nouvelle partie.";
    }
  }

  // Accès de débogage / test (pas d'interface) : window.Jeu.avancer(secondes)
  window.Jeu = {
    get etat() { return s; },
    avancer(sec) { const n = Math.round(sec / D.TICK); for (let i = 0; i < n; i++) { const evs = E.tick(s, D.TICK); if (evs.length) traiter(evs); } rendre(); },
    engager, reconvertir, relancer, sauver, gel: false, version: VERSION,
    inventaire: () => E.inventaire(s), basculer: () => { if (E.basculer(s)) { cartonCroissance(); majSon(1.2); rendre(); } }, toutAcheter,
    rapport: () => E.rapportTexte(s, VERSION),
  };

  init();
})();
