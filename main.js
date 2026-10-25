// Décroissance — point d'entrée : boucle, rendu, sauvegarde, événements. Actes I et II.
(function () {
  const E = window.Engine, D = E.D;
  const CLE = 'decroissance.mvp.v1';
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
    for (const id of ['regions', 'reseau-lignes', 'liens', 'sites']) $(id).innerHTML = '';
    // Régions : l'ombre qui tombe quand une région s'éteint (§10)
    for (const [cle, r] of Object.entries(D.regions)) {
      el['region-' + cle] = svgEl('circle', { cx: r.x, cy: r.y, r: r.r, class: 'ombre', fill: 'url(#ombre-region)' }, $('regions'));
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
      if (d.mesure) continue;
      const g = svgEl('g', { class: 'site actif', transform: `translate(${d.x},${d.y})` }, $('sites'));
      g.dataset.id = d.id;
      g.innerHTML = `<circle class="halo" r="16"/><circle class="vegetal" r="0"/><circle class="disque" r="9"/><path class="arc" d=""/><text class="etiquette" y="24" text-anchor="middle">${d.court || d.nom}</text><title>${d.nom}</title>`;
      g.addEventListener('click', () => selectionner(d.id));
      el['site-' + d.id] = g;
    }
  }

  function arcPath(p) { // arc de progression autour du disque
    if (p <= 0) return ''; if (p >= 1) p = 0.9999;
    const r = 13, a = -Math.PI / 2, b = a + p * 2 * Math.PI;
    return `M${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)} A${r},${r} 0 ${p > 0.5 ? 1 : 0} 1 ${(r * Math.cos(b)).toFixed(1)},${(r * Math.sin(b)).toFixed(1)}`;
  }

  // Ce que menacerait le chantier sélectionné : délestages, privations, arrêts (acte II)
  function menaces() {
    const m = new Set();
    if (!selection || s.acte < 2) return m;
    const a = s.sites[selection].state === 'actif' ? E.apercu(s, selection) : null;
    if (a) for (const id of [...a.delestes, ...a.prives, ...a.arretes]) m.add(id);
    return m;
  }

  function rendreCarte() {
    const acte2 = s.acte >= 2, menace = menaces();
    for (const d of D.sites) {
      if (d.mesure) continue;
      const g = el['site-' + d.id], st = s.sites[d.id];
      const sansApport = st.state === 'actif' && st.sansApport;
      g.setAttribute('class', `site ${st.state}${st.pollue ? ' pollue' : ''}${sansApport ? ' sans-apport' : ''}` +
        `${menace.has(d.id) ? ' menace' : ''}${selection === d.id ? ' selection' : ''}${E.acteDe(d) > s.acte ? ' futur' : ''}`);
      g.querySelector('.arc').setAttribute('d', st.state === 'chantier' ? arcPath(st.progress) : '');
      const v = g.querySelector('.vegetal');
      if (st.state === 'eteint' && !st.pollue) { v.setAttribute('r', (10 + 14 * st.regen).toFixed(1)); v.style.opacity = (0.15 + 0.6 * st.regen).toFixed(2); }
      else v.style.opacity = 0;
    }
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
        const cls = marche ? (d.prod ? 'ligne prod' : 'ligne') : st.state === 'coupe' ? 'ligne coupee' : 'ligne morte';
        el['ligne-' + d.id].setAttribute('class', cls + (menace.has(d.id) ? ' menace' : ''));
      }
      for (const n of D.noeuds) {
        if (!reseauVisible(n)) continue;
        const cls = n.prod ? 'ligne prod' : s.noeuds[n.id] === 'alimente' ? 'ligne' : 'ligne coupee';
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
    for (const cle of Object.keys(D.regions)) el['region-' + cle].setAttribute('class', `ombre${s.regionsEteintes.includes(cle) ? ' eteinte' : ''}`);
    document.querySelectorAll('.leg-acte2').forEach(x => { x.hidden = !acte2; });
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

  function construireChantiers() {
    const box = $('liste-chantiers'); box.innerHTML = '';
    for (const d of D.sites) {
      const c = document.createElement('div');
      c.className = 'chantier'; c.dataset.id = d.id;
      const effet = d.E > 0 ? `−${E.fmt(d.E)}` : d.E < 0 ? `+${E.fmt(-d.E)}` : '0';
      const deps = E.dependants(d.id).map(nomDe);
      const reseau = E.acteDe(d) >= 2 && !d.mesure;
      c.innerHTML = `
        <div class="nom">${d.nom}<small>${d.region}${d.mesure ? ' · mesure' : ''}</small></div>
        <div class="effet ${d.E >= 0 ? 'moins' : 'plus'}">${effet}</div>
        <div class="desc">${d.desc}</div>
        <div class="cout"><span>Capacité <b class="ck">${d.K}</b></span><span>Mains <b class="cm">${d.M}</b></span><span><b>${E.fmtDur(d.dur)}</b></span>${d.g ? `<span>croissance <b>+${d.g.toFixed(2).replace('.', ',')} %/min</b></span>` : ''}${d.deplaces ? `<span><b>${E.fmt(d.deplaces)}</b> personnes</span>` : ''}${d.co ? `<span>consentement <b>−${d.co}</b></span>` : ''}</div>
        ${reseau ? `<div class="mw">${infosReseau(d)}</div>` : ''}
        ${deps.length ? `<div class="alim">alimente : ${deps.join(', ')}</div>` : ''}
        ${d.rapide ? `<div class="vite-note">Démolir vite : moitié du temps, de la Capacité et des Mains, mais une pollution qui touche ${E.fmt(d.rapide.casse)} personnes et laisse un sol pollué.</div>` : ''}
        ${reseau ? '<div class="apercu" hidden></div>' : ''}
        <div class="action"><button class="btn engager">Engager</button>${d.rapide ? '<button class="btn vite">Démolir vite</button>' : ''}<div class="prog" hidden><i></i></div><span class="etat"></span></div>`;
      c.querySelector('.engager').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id); });
      if (d.rapide) c.querySelector('.vite').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id, { vite: true }); });
      c.addEventListener('click', () => selectionner(d.id));
      box.appendChild(c); el['ch-' + d.id] = c;
    }
  }

  // Ce qu'un lancement ferait au réseau, en une phrase (R4 : tout se voit avant de lancer)
  function texteApercu(a) {
    const marge = `${a.apres >= 0 ? '+' : '−'}${E.fmt(Math.abs(a.apres))} MW`;
    const morceaux = [`Lancé maintenant : la marge ${a.apres < 0 ? 'tombe' : 'passe'} à ${marge}.`];
    if (a.arretes.length) morceaux.push(`À l'arrêt : ${a.arretes.map(nomDe).join(', ')}.`);
    if (a.delestes.length) morceaux.push(`Délestés : ${a.delestes.map(nomDe).join(', ')}.`);
    for (const id of a.prives) morceaux.push(`Sans ${E.noeuds[id].besoin.quoi} : ${nomDe(id)}.`);
    return { danger: a.prives.length + a.delestes.length > 0, texte: morceaux.join(' ') };
  }

  function rendreChantiers() {
    const speed = E.relanceActive(s) ? D.RELANCE.speedMul : 1;
    for (const d of D.sites) {
      const c = el['ch-' + d.id], st = s.sites[d.id];
      c.hidden = E.acteDe(d) !== s.acte;   // seules les cartes de l'acte en cours restent ouvertes
      if (c.hidden) continue;
      const can = E.canEngage(s, d.id);
      c.className = `chantier ${st.state}${st.pollue ? ' pollue' : ''}${selection === d.id ? ' selection' : ''}`;
      const btn = c.querySelector('.engager'), bv = c.querySelector('.vite'), prog = c.querySelector('.prog'), etat = c.querySelector('.etat');
      const alim = c.querySelector('.alim'), ap = c.querySelector('.apercu'), vn = c.querySelector('.vite-note');
      if (vn) vn.hidden = st.state !== 'actif';
      c.querySelector('.ck').className = 'ck' + (st.state === 'actif' && s.K < d.K ? ' manque' : '');
      c.querySelector('.cm').className = 'cm' + (st.state === 'actif' && s.M < d.M ? ' manque' : '');
      if (st.state === 'actif' || (st.state === 'coupe' && !d.mesure)) {
        const restes = st.state === 'coupe';
        btn.hidden = false; prog.hidden = true; btn.disabled = !can.ok;
        btn.textContent = restes ? 'Démanteler les restes' : 'Engager';
        if (bv) { bv.hidden = restes; bv.disabled = !E.canEngage(s, d.id, { vite: true }).ok; }
        const manque = can.ok ? '' : can.raisons.join(' · ');
        etat.className = 'etat' + (restes ? ' rouge' : '');
        etat.textContent = restes ? `coupé, à l'arrêt${manque ? ' · ' + manque : ''}` : st.sansApport ? `à l'arrêt, faute de ${d.besoin.quoi}${manque ? ' · ' + manque : ''}` : manque;
        if (alim) { const m = can.coupures.length; alim.className = 'alim' + (m ? ' menace' : ''); alim.textContent = m ? `couperait maintenant : ${can.coupures.map(nomDe).join(', ')}` : `alimente : ${E.dependants(d.id).map(nomDe).join(', ')}`; }
        if (ap) {
          ap.hidden = restes || !can.apercu;
          if (!ap.hidden) { const a = texteApercu(can.apercu); ap.className = 'apercu' + (a.danger ? ' danger' : ''); ap.textContent = a.texte; }
        }
      } else if (st.state === 'chantier') {
        btn.hidden = true; if (bv) bv.hidden = true; prog.hidden = false; prog.firstElementChild.style.width = (st.progress * 100).toFixed(1) + '%';
        const reste = Math.ceil(E.dureeChantier(d, st) * (1 - st.progress) / speed);
        etat.className = 'etat'; etat.textContent = `${st.vite ? 'démolition rapide' : st.restes ? 'restes' : 'chantier'} · ${E.fmtDur(reste)}`;
        if (ap) ap.hidden = true;
      } else {
        btn.hidden = true; if (bv) bv.hidden = true; prog.hidden = true;
        etat.className = 'etat' + (st.pollue ? ' rouge' : '');
        etat.textContent = st.state === 'fait' ? 'fait' : st.pollue ? 'démolie vite · sol pollué' : `fermé · terre rendue ${Math.round(st.regen * 100)} %`;
        if (alim) { alim.className = 'alim'; alim.textContent = ''; }
        if (ap) ap.hidden = true;
      }
    }
    if (s.acte >= 2) {
      const restants = D.sites.filter(d => E.acteDe(d) === 2 && !d.mesure && s.sites[d.id].state !== 'eteint').length;
      $('g-detail').textContent = restants ? `— le réseau : ${restants} site${restants > 1 ? 's' : ''} à démanteler` : '— le réseau est démantelé';
    } else {
      const g = E.gSites(s);
      $('g-detail').textContent = g > 0 ? `— ${D.sites.filter(d => s.sites[d.id].state === 'actif' && d.g > 0).length} sites font encore monter l'Empreinte` : '— plus rien ne fait monter l\'Empreinte';
    }
  }

  function rendreReseau() {
    const sec = $('reseau');
    sec.hidden = s.acte < 2;
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
    const nb = E.fmt(s.E);
    const c = $('compteur');
    if (performance.now() > animPerte && nb !== dernierNb) { c.textContent = nb; dernierNb = nb; }
    const rel = E.relanceActive(s), g = E.gEff(s);
    const k = g > 0.005 ? 'monte' : g < -0.005 ? 'descend' : 'stable';
    c.className = 'compteur ' + k + (rel ? ' relance' : '') + (performance.now() < animPerte ? ' perte' : '');
    const t = $('tendance'); t.className = 'tendance ' + k;
    const rebond = E.gRebond(s) > 0.005 && !rel;
    t.textContent = g > 0.005 ? `▲ +${(g < 1 ? g.toFixed(2) : g.toFixed(1)).replace('.', ',')} % / min${rebond ? ' · rebond du réseau' : ''}` : 'stable — plus rien ne monte';
    if (s.ms.stabilise === null && g <= 0.005) t.textContent = 'stable';
    $('sci').hidden = !rel; if (rel) $('sci').textContent = E.fmtSci(s.E);
    document.getElementById('app').dataset.digits = s.digits;
  }

  function rendreRessources() {
    $('k').textContent = Math.floor(s.K); $('krate').textContent = ` +${E.kRate(s).toFixed(1).replace('.', ',')} / s`;
    $('m').textContent = E.fmt(s.M); $('meng').textContent = ` · ${E.fmt(s.Meng)} engagées`;
    const T = E.T(s); $('t').textContent = T.toFixed(1).replace('.', ','); $('t-barre').style.width = Math.min(100, T) + '%';
    $('co').textContent = Math.round(s.Co); $('co-barre').style.width = s.Co + '%'; $('co-barre').className = s.Co < 30 ? 'bas' : '';
    $('deplaces').textContent = E.fmt(s.deplaces);
    const br = $('btn-reconv'); br.disabled = !!s.reconv || s.deplaces <= 0;
    br.textContent = s.reconv ? 'Reconversion en cours' : `Reconvertir ${Math.min(D.RECONV.batch, s.deplaces) || ''}`.trim();
    const re = $('reconv-etat');
    if (s.reconv) re.textContent = `${s.reconv.n} personnes en formation, ${E.fmtDur(Math.ceil(D.RECONV.dur * (1 - s.reconv.progress)))} restantes.`;
    else if (s.deplaces > 0) re.textContent = `Par lot de ${D.RECONV.batch}, ${E.fmtDur(D.RECONV.dur)} chacun, consentement −${D.RECONV.co}.`;
    else re.textContent = 'Personne à reconvertir pour l\'instant. Les gens viennent des sites fermés.';
    $('reconv-barre').style.width = s.reconv ? (s.reconv.progress * 100) + '%' : '0%';
    const x = $('casse'); x.textContent = E.fmt(s.X); x.classList.toggle('zero', s.X === 0);
    const b = $('btn-relancer'); const rel = E.relanceActive(s);
    const auto = rel && s.t - s.autoRelanceAt < D.RELANCE.dur;
    b.className = 'btn-relancer' + (rel ? (auto ? ' auto' : ' actif') : '');
    b.disabled = rel;
    b.textContent = rel ? (auto ? `Relancé sans vous · ${E.fmtDur(Math.ceil(s.relanceUntil - s.t))}` : `Relance · ${E.fmtDur(Math.ceil(s.relanceUntil - s.t))}`) : 'Relancer';
    $('horloge').textContent = E.fmtDur(s.t);
  }

  function rendre() { rendreCompteur(); rendreRessources(); rendreReseau(); rendreChantiers(); rendreCarte(); }

  // ---------- son : niveaux selon l'état ----------
  const PROD_FOSSILE = D.sites.reduce((a, d) => a + (d.prod || 0), 0);
  function niveauxSon() {
    const stab = s.ms.stabilise !== null, chiffre = s.digitsMin < 10, rel = E.relanceActive(s);
    const acte2 = s.acte >= 2, apres2 = s.digitsMin <= 8;   // le deuxième chiffre perdu éteint le réseau, la rivière arrive
    const reseau = acte2 && !apres2 ? Math.round(Math.min(1, E.bilan(s).prodFossile / PROD_FOSSILE) * 10) / 10 : 0;
    if (rel) return { trafic: 1, turbines: 1, reseau: acte2 ? 1 : 0, vent: 0.15, oiseaux: 0, eau: apres2 ? 0.3 : 0 };
    return { trafic: stab ? 0 : 1, turbines: chiffre ? 0 : 1, reseau, vent: stab ? 1 : 0, oiseaux: chiffre ? 1 : 0, eau: apres2 ? 1 : 0 };
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
      if (ev.type === 'fin' && ev.acte === 2) montrerJalon('fin2');
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
    $('carton-acte-titre').textContent = n === 2 ? 'Le réseau' : '';
    const c = $('carton-acte');
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    setTimeout(() => { c.hidden = true; }, D.PAUSE_ACTE * 1000);
  }

  function perteDeChiffre() {
    // Le nombre se recentre, le chiffre de tête tombe, l'écran se resserre d'un cran.
    const c = $('compteur'), avant = dernierNb, apres = E.fmt(s.E);
    animPerte = performance.now() + D.PAUSE_CHIFFRE * 1000;
    c.innerHTML = `<span class="digit-perdu">${avant.slice(0, 1)}</span>${avant.slice(1)}`;
    son.chute();
    const app = document.getElementById('app');
    app.classList.add('pause-chiffre');
    const marge = 8 * (10 - s.digitsMin);
    document.documentElement.style.setProperty('--resserre', marge + 'px');
    setTimeout(() => { app.classList.remove('pause-chiffre'); c.textContent = apres; dernierNb = apres; if (s.digitsMin === 9) montrerJalon('chiffre'); }, D.PAUSE_CHIFFRE * 1000);
  }

  function montrerJalon(kind) {
    const j = $('jalon');
    const lignes = [
      ['Le nombre a cessé de monter', s.ms.stabilise !== null ? E.fmtDur(s.ms.stabilise) : 'jamais'],
      ['Premier chiffre perdu', s.ms.chiffre !== null ? E.fmtDur(s.ms.chiffre) : 'jamais'],
      ['Relances, 20 premières minutes', String(E.rapport(s, VERSION).relances20min)],
      ['Relances au total', `${s.relances}${s.relancesAuto ? ` (+${s.relancesAuto} sans vous)` : ''}`],
      ['Casse', `${E.fmt(s.X)} personnes`],
      ['Plancher irréductible', E.fmt(s.plancher)],
    ];
    let titre = 'Acte I — premier chiffre perdu', note = 'Le reste de la carte est là. Rien ne vous oblige à continuer.';
    if (kind === 'fin2') {
      const r = E.rapport(s, VERSION);
      lignes.splice(0, lignes.length,
        ['Acte II ouvert', E.fmtDur(r.acte2)],
        ['Deuxième chiffre perdu', r.deuxiemeChiffre !== null ? E.fmtDur(r.deuxiemeChiffre) : 'pas encore'],
        ['Coupures et délestages', String(r.coupures)],
        ['Démolitions rapides qui ont pollué', String(r.pollutions)],
        ['Casse', `${E.fmt(s.X)} personnes`],
        ['Relances au total', `${s.relances}${s.relancesAuto ? ` (+${s.relancesAuto} sans vous)` : ''}`],
        ['Empreinte restante', E.fmt(s.E)],
        ['Terre rendue', `${E.T(s).toFixed(1).replace('.', ',')} % — continue sans vous`]);
      titre = 'Fin de l\'acte II — le prototype s\'arrête là';
      note = 'Le réseau tient sur le barrage. La suite, ce sont les gens : ce sera l\'acte III.';
    }
    j.innerHTML = `<h3>${titre}</h3>
      <table>${lignes.map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join('')}</table>
      <p class="muted">${note}</p>
      <div class="carton-boutons"><button class="btn" id="jalon-fermer">${kind === 'fin2' ? 'Fermer' : 'Continuer'}</button><button class="btn" id="jalon-rapport">Rapport de session</button></div>`;
    j.hidden = false;
    $('jalon-fermer').addEventListener('click', () => { j.hidden = true; });
    $('jalon-rapport').addEventListener('click', ouvrirRapport);
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
  function reconvertir() { if (E.reconvertir(s)) { rendre(); sauver(); } }
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
    if (!s.versions.includes(VERSION)) s.versions.push(VERSION);
    document.documentElement.style.setProperty('--resserre', (8 * (10 - s.digitsMin)) + 'px');
    construireCarte(); construireChantiers();
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

  // ---------- init ----------
  function init() {
    $('version').textContent = `version ${VERSION}`;
    // Les actions d'abord : une sauvegarde abîmée ne doit jamais laisser l'écran d'accueil inerte.
    $('btn-commencer').addEventListener('click', () => demarrer(E.create()));
    $('btn-relancer').addEventListener('click', relancer);
    $('btn-reconv').addEventListener('click', reconvertir);
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
        $('intro-absence').hidden = false;
        $('intro-absence').textContent = `Vous avez été absent ${E.fmtDur(absence.elapsed)}. Rien n'a été démantelé pendant ce temps${terre}.`;
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
    rapport: () => E.rapportTexte(s, VERSION),
  };

  init();
})();
