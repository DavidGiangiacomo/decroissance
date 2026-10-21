// Décroissance — MVP acte I — point d'entrée : boucle, rendu, sauvegarde, événements.
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
  function construireCarte() {
    const gl = $('liens'), gs = $('sites');
    gl.innerHTML = ''; gs.innerHTML = '';
    const pos = (id) => E.defs[id] || E.noeuds[id];
    for (const l of D.liens) {
      const a = pos(l.from), b = pos(l.to);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M${a.x + ux * 12},${a.y + uy * 12} L${b.x - ux * 14},${b.y - uy * 14}`);
      p.setAttribute('class', 'lien'); p.dataset.from = l.from; p.dataset.to = l.to;
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${a.nom} → ${b.nom} (${l.quoi})`; p.appendChild(title);
      gl.appendChild(p); el['lien-' + l.from + '-' + l.to] = p;
    }
    for (const n of D.noeuds) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'noeud'); g.setAttribute('transform', `translate(${n.x},${n.y})`);
      g.innerHTML = `<rect class="fond" x="-9" y="-9" width="18" height="18" rx="3"/><path class="croix" d="M-1.5,-6 h3 v4.5 h4.5 v3 h-4.5 v4.5 h-3 v-4.5 h-4.5 v-3 h4.5 z"/><text class="etiquette" x="0" y="24" text-anchor="middle">${n.nom}</text>`;
      gs.appendChild(g); el['noeud-' + n.id] = g;
    }
    for (const d of D.sites) {
      if (d.mesure) continue;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'site actif'); g.setAttribute('transform', `translate(${d.x},${d.y})`);
      g.dataset.id = d.id;
      const court = d.court || d.nom;
      g.innerHTML = `<circle class="halo" r="16"/><circle class="vegetal" r="0"/><circle class="disque" r="9"/><path class="arc" d=""/><text class="etiquette" y="24" text-anchor="middle">${court}</text><title>${d.nom}</title>`;
      g.addEventListener('click', () => selectionner(d.id));
      gs.appendChild(g); el['site-' + d.id] = g;
    }
  }

  function arcPath(p) { // arc de progression autour du disque
    if (p <= 0) return ''; if (p >= 1) p = 0.9999;
    const r = 13, a = -Math.PI / 2, b = a + p * 2 * Math.PI;
    return `M${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)} A${r},${r} 0 ${p > 0.5 ? 1 : 0} 1 ${(r * Math.cos(b)).toFixed(1)},${(r * Math.sin(b)).toFixed(1)}`;
  }

  function rendreCarte() {
    for (const d of D.sites) {
      if (d.mesure) continue;
      const g = el['site-' + d.id], st = s.sites[d.id];
      g.setAttribute('class', `site ${st.state}${selection === d.id ? ' selection' : ''}`);
      g.querySelector('.arc').setAttribute('d', st.state === 'chantier' ? arcPath(st.progress) : '');
      const v = g.querySelector('.vegetal');
      if (st.state === 'eteint') { v.setAttribute('r', (10 + 14 * st.regen).toFixed(1)); v.style.opacity = (0.15 + 0.6 * st.regen).toFixed(2); }
      else v.style.opacity = 0;
    }
    const h = el['noeud-hopital'];
    h.setAttribute('class', `noeud ${s.hopital}`);
    for (const l of D.liens) {
      const p = el['lien-' + l.from + '-' + l.to];
      const from = s.sites[l.from].state, to = l.to === 'hopital' ? s.hopital : s.sites[l.to].state;
      const mort = from !== 'actif' || (l.to === 'hopital' ? to !== 'alimente' : to !== 'actif');
      const menace = !mort && selection === l.from && E.coupuresSi(s, l.from).includes(l.to);
      p.setAttribute('class', `lien${mort ? ' mort' : ''}${menace ? ' menace' : ''}`);
    }
  }

  // ---------- panneau ----------
  function construireChantiers() {
    const box = $('liste-chantiers'); box.innerHTML = '';
    for (const d of D.sites) {
      const c = document.createElement('div');
      c.className = 'chantier'; c.dataset.id = d.id;
      const effet = d.E >= 0 ? `−${E.fmt(d.E)}` : `+${E.fmt(-d.E)}`;
      const deps = E.dependants(d.id).map(id => (E.defs[id] || E.noeuds[id]).nom);
      c.innerHTML = `
        <div class="nom">${d.nom}<small>${d.region}${d.mesure ? ' · mesure' : ''}</small></div>
        <div class="effet ${d.E >= 0 ? 'moins' : 'plus'}">${effet}</div>
        <div class="desc">${d.desc}</div>
        <div class="cout"><span>Capacité <b class="ck">${d.K}</b></span><span>Mains <b class="cm">${d.M}</b></span><span><b>${E.fmtDur(d.dur)}</b></span>${d.g ? `<span>croissance <b>+${d.g.toFixed(2).replace('.', ',')} %/min</b></span>` : ''}${d.deplaces ? `<span><b>${d.deplaces}</b> personnes</span>` : ''}${d.co ? `<span>consentement <b>−${d.co}</b></span>` : ''}</div>
        ${deps.length ? `<div class="alim">alimente : ${deps.join(', ')}</div>` : ''}
        <div class="action"><button class="btn engager">Engager</button><div class="prog" hidden><i></i></div><span class="etat"></span></div>`;
      c.querySelector('.engager').addEventListener('click', (ev) => { ev.stopPropagation(); engager(d.id); });
      c.addEventListener('click', () => selectionner(d.id));
      box.appendChild(c); el['ch-' + d.id] = c;
    }
  }

  function rendreChantiers() {
    for (const d of D.sites) {
      const c = el['ch-' + d.id], st = s.sites[d.id];
      const can = E.canEngage(s, d.id);
      c.className = `chantier ${st.state}${selection === d.id ? ' selection' : ''}`;
      const btn = c.querySelector('.engager'), prog = c.querySelector('.prog'), etat = c.querySelector('.etat'), alim = c.querySelector('.alim');
      c.querySelector('.ck').className = 'ck' + (st.state === 'actif' && s.K < d.K ? ' manque' : '');
      c.querySelector('.cm').className = 'cm' + (st.state === 'actif' && s.M < d.M ? ' manque' : '');
      if (st.state === 'actif') {
        btn.hidden = false; prog.hidden = true; btn.disabled = !can.ok;
        etat.className = 'etat'; etat.textContent = can.ok ? '' : can.raisons.join(' · ');
        if (alim) { const m = can.coupures.length; alim.className = 'alim' + (m ? ' menace' : ''); alim.textContent = m ? `couperait maintenant : ${can.coupures.map(id => (E.defs[id] || E.noeuds[id]).nom).join(', ')}` : `alimente : ${E.dependants(d.id).map(id => (E.defs[id] || E.noeuds[id]).nom).join(', ')}`; }
      } else if (st.state === 'chantier') {
        btn.hidden = true; prog.hidden = false; prog.firstElementChild.style.width = (st.progress * 100).toFixed(1) + '%';
        const reste = Math.ceil(d.dur * (1 - st.progress) / (E.relanceActive(s) ? D.RELANCE.speedMul : 1));
        etat.className = 'etat'; etat.textContent = `chantier · ${E.fmtDur(reste)}`;
      } else {
        btn.hidden = true; prog.hidden = true;
        etat.className = 'etat' + (st.state === 'coupe' ? ' rouge' : '');
        etat.textContent = st.state === 'eteint' ? `fermé · terre rendue ${Math.round(st.regen * 100)} %` : st.state === 'fait' ? 'fait' : 'coupé — à l\'arrêt, jamais démantelé';
        if (alim) { alim.className = 'alim'; alim.textContent = ''; }
      }
    }
    const g = E.gSites(s);
    $('g-detail').textContent = g > 0 ? `— ${D.sites.filter(d => s.sites[d.id].state === 'actif' && d.g > 0).length} sites font encore monter l'Empreinte` : '— plus rien ne fait monter l\'Empreinte';
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
    t.textContent = g > 0.005 ? `▲ +${g.toFixed(1).replace('.', ',')} % / min` : 'stable — plus rien ne monte';
    if (s.ms.stabilise === null && g <= 0.005) t.textContent = 'stable';
    $('sci').hidden = !rel; if (rel) $('sci').textContent = E.fmtSci(s.E);
    document.getElementById('app').dataset.digits = s.digits;
  }

  function rendreRessources() {
    $('k').textContent = Math.floor(s.K); $('krate').textContent = ` +${E.kRate(s).toFixed(1).replace('.', ',')} / s`;
    $('m').textContent = E.fmt(s.M); $('meng').textContent = ` · ${E.fmt(s.Meng)} engagées`;
    const T = E.T(s); $('t').textContent = T.toFixed(1).replace('.', ','); $('t-barre').style.width = Math.min(100, T / E.Tmax() * 100) + '%';
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

  function rendre() { rendreCompteur(); rendreRessources(); rendreChantiers(); rendreCarte(); }

  // ---------- son : niveaux selon l'état ----------
  function niveauxSon() {
    const stab = s.ms.stabilise !== null, chiffre = s.digitsMin < 10, rel = E.relanceActive(s);
    if (rel) return { trafic: 1, turbines: 1, vent: 0.15, oiseaux: 0 };
    return { trafic: stab ? 0 : 1, turbines: chiffre ? 0 : 1, vent: stab ? 1 : 0, oiseaux: chiffre ? 1 : 0 };
  }
  let dernierNiv = '';
  function majSon(fade) { const n = niveauxSon(); const j = JSON.stringify(n); if (j !== dernierNiv || fade != null) { dernierNiv = j; son.applique(n, fade); } }

  // ---------- événements ----------
  function toast(msg) { let box = document.querySelector('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); } const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 6200); }

  function traiter(evs) {
    for (const ev of evs) {
      if (ev.type === 'stabilise') { son.silence(D.PAUSE_STABILISE); document.getElementById('app').classList.add('pause'); setTimeout(() => document.getElementById('app').classList.remove('pause'), D.PAUSE_STABILISE * 1000); }
      if (ev.type === 'chiffre') { perteDeChiffre(); }
      if (ev.type === 'coupure') { son.coupure(); $('casse').classList.remove('coup'); void $('casse').offsetWidth; $('casse').classList.add('coup'); toast(ev.dep === 'hopital' ? `Coupure : l'hôpital de Cherbaix est sans électricité. ${ev.casse} personnes.` : `Coupure : ${E.defs[ev.dep].nom} à l'arrêt brutal. ${ev.casse} personnes sans reclassement.`); }
      if (ev.type === 'relance' && ev.auto) toast('Le Conseil a relancé la croissance sans vous.');
      if (ev.type === 'fin') montrerJalon('fin');
    }
    if (evs.length) { rendreJournal(); majSon(); }
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
    if (kind === 'fin') lignes.push(['Empreinte restante', E.fmt(s.E)], ['Terre rendue', `${E.T(s).toFixed(1).replace('.', ',')} % — continue sans vous`]);
    j.innerHTML = `<h3>${kind === 'fin' ? 'Fin de la carte — le prototype s\'arrête là' : 'Acte I — premier chiffre perdu'}</h3>
      <table>${lignes.map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join('')}</table>
      <p class="muted">${kind === 'fin' ? 'Le reste de ce qui est écrit ne se démantèle pas : il se garde. Ce sera l\'acte IV.' : 'Le reste de la carte est là. Rien ne vous oblige à continuer.'}</p>
      <div class="carton-boutons"><button class="btn" id="jalon-fermer">${kind === 'fin' ? 'Fermer' : 'Continuer'}</button><button class="btn" id="jalon-rapport">Rapport de session</button></div>`;
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
  function engager(id) { const evs = E.engage(s, id); if (evs.length) { traiter(evs); rendre(); sauver(); } }
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
