// Décroissance — MVP acte I — données (géographie fictive : l'Ostrane)
// Valeurs de réglage. Toutes les durées sont en secondes de jeu réelles.
(function (root) {
  const DATA = {
    pays: 'Ostrane',
    E0: 1_000_000_000,   // Empreinte de départ
    K0: 6,              // Capacité/s à E = E0
    KEXP: 0.6,           // K/s = K0 × (E/E0)^KEXP
    KCAP: 900,           // stock de Capacité maximal
    PLANCHER0: 2_400_000,
    TICK: 0.1,           // 10 Hz
    OFFLINE_CAP: 12 * 3600,

    // Bouton Croissance
    RELANCE: { dur: 90, g: 4.0, kMul: 4, speedMul: 2, co: 3, plancherMul: 1.06, autoSeuil: 20, autoCooldown: 240 },

    // Reconversion des déplacés en Mains
    RECONV: { batch: 300, dur: 45, co: 2 },

    // Consentement
    CO_EQ: 70,           // valeur d'équilibre vers laquelle Co dérive
    CO_DRIFT: 0.6 / 60,  // points / s
    CO_HATE: 1.2 / 60,   // points / s perdus par chantier simultané au-delà du premier

    // Pauses
    PAUSE_STABILISE: 3,
    PAUSE_CHIFFRE: 2.2,

    // Sites (E = Empreinte retirée à la clôture ; g = contribution à la croissance, %/min)
    sites: [
      { id: 'pub', nom: 'Régie publicitaire nationale', region: 'Valdrance',
        E: 3.0e6, K: 90, M: 0, dur: 40, g: 0.5, deplaces: 400, co: 0, T: 0.2, regen: 240, kBack: 0,
        court: 'Publicité', x: 236, y: 152,
        desc: 'Affichage, écrans, démarchage. Ne produit rien, fait acheter tout le reste.' },
      { id: 'credit', nom: 'Crédit à la consommation & obsolescence', region: 'Valdrance',
        E: 3.0e6, K: 90, M: 0, dur: 40, g: 0.5, deplaces: 500, co: 0, T: 0.2, regen: 240, kBack: 0,
        court: 'Crédit & obsolescence', x: 350, y: 112,
        desc: 'Paiement en douze fois, garanties qui expirent la veille de la panne.' },
      { id: 'aero', nom: "Aérodrome d'affaires de Valdrance", region: 'Valdrance',
        E: 4.0e6, K: 200, M: 300, dur: 70, g: 0.45, deplaces: 300, co: 4, T: 0.8, regen: 360, kBack: 60,
        court: 'Aérodrome', x: 196, y: 208,
        desc: 'Jets privés et vols de loisir. Une piste de 2 400 m pour quatre-vingts personnes.' },
      { id: 'suv', nom: 'Usine de SUV de Cherbaix', region: 'Cherbaix',
        E: 6.0e6, K: 200, M: 300, dur: 70, g: 0.5, deplaces: 900, co: 4, T: 0.6, regen: 360, kBack: 80,
        court: 'Usine SUV', x: 472, y: 204,
        desc: "Deux tonnes par véhicule. Alimentée par la centrale à charbon voisine." },
      { id: 'dc', nom: "Data center spéculatif d'Orvenne", region: 'Orvenne',
        E: 4.0e6, K: 200, M: 300, dur: 70, g: 0.45, deplaces: 200, co: 4, T: 0.4, regen: 300, kBack: 60,
        court: 'Data center', x: 302, y: 404,
        desc: 'Quarante mégawatts pour des actifs que personne ne réclame.' },
      { id: 'ciment', nom: 'Cimenterie de la Sère', region: 'Vallée de la Sère',
        E: 1.2e8, K: 350, M: 600, dur: 170, g: 0, deplaces: 800, co: 0, T: 1.0, regen: 480, kBack: 200,
        court: 'Cimenterie', x: 336, y: 300,
        desc: 'Clinker, fours à 1 450 °C. Fournit le béton de tout le pays.' },
      { id: 'charbon', nom: 'Centrale à charbon de Cherbaix', region: 'Cherbaix',
        E: 2.0e8, K: 400, M: 1200, dur: 240, g: 0, deplaces: 600, co: 0, T: 1.2, regen: 480, kBack: 100,
        court: 'Centrale charbon', x: 490, y: 288,
        desc: "1 200 MW. Alimente l'usine de SUV et l'hôpital régional de Cherbaix." },
      { id: 'gaz', nom: 'Centrale au gaz de Méraud', region: 'Méraud',
        E: 2.0e8, K: 400, M: 1200, dur: 240, g: 0, deplaces: 400, co: 0, T: 1.0, regen: 480, kBack: 100,
        court: 'Centrale gaz', x: 152, y: 378,
        desc: "Cycle combiné, 900 MW. Secours électrique de l'hôpital de Cherbaix." },
      // Mesure : ne retire rien, ajoute même un peu d'Empreinte. Elle rend l'hôpital indépendant des centrales.
      { id: 'autonomie', mesure: true, nom: "Autonomie de l'hôpital de Cherbaix", region: 'Cherbaix',
        E: -2.0e6, K: 350, M: 300, dur: 90, g: 0, deplaces: 0, co: 0, T: 0, regen: 0, kBack: 0,
        court: 'Autonomie hôpital', x: 420, y: 336,
        desc: 'Solaire, stockage, groupe de secours. Coûte du temps et de la Capacité, ne fait rien baisser.' },
    ],

    // Nœuds qui ne sont pas des chantiers mais dépendent de sites
    noeuds: [
      { id: 'hopital', nom: 'Hôpital régional de Cherbaix', region: 'Cherbaix', casse: 60, co: 30, x: 420, y: 336 },
    ],

    // Graphe : from alimente to. Un dépendant est alimenté tant qu'au moins un de ses alimentants est actif.
    liens: [
      { from: 'charbon', to: 'suv', quoi: 'électricité' },
      { from: 'charbon', to: 'hopital', quoi: 'électricité' },
      { from: 'gaz', to: 'hopital', quoi: 'secours' },
    ],

    // Casse quand un site (chantier) est coupé : ses gens sont perdus, sans reclassement
    COUPURE_SITE_CO: 15,
    COUPURE_SITE_E: 0.5, // fraction de l'Empreinte du site tout de même retirée (il s'arrête, il n'est pas démantelé)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
