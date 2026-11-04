// Décroissance — données (géographie fictive : l'Ostrane). Acte I : le MVP ; acte II : le réseau (issue #14) ;
// acte III : les gens (issue #15).
// Valeurs de réglage. Toutes les durées sont en secondes de jeu réelles.
(function (root) {
  const DATA = {
    pays: 'Ostrane',
    E0: 1_000_000_000,   // Empreinte de départ
    K0: 6,              // Capacité/s à E = E0
    KEXP: 0.6,           // K/s = K0 × (E/E0)^KEXP
    KCAP: 900,           // stock de Capacité maximal
    PLANCHER0: 2.4,         // plancher irréductible : un seul chiffre (issue #4), doublé à chaque relance
    TICK: 0.1,           // 10 Hz
    OFFLINE_CAP: 12 * 3600,

    // Bouton Croissance
    // coAuto : quand le Conseil relance sans vous, la croissance rachète l'adhésion (et sort de la spirale).
    RELANCE: { dur: 90, g: 4.0, kMul: 4, speedMul: 2, co: 3, coAuto: 15, plancherMul: 2, autoSeuil: 20, autoCooldown: 240 },

    // Reconversion des déplacés en Mains
    RECONV: { batch: 300, dur: 45, co: 1 },

    // Consentement
    CO_EQ: 70,           // valeur d'équilibre vers laquelle Co dérive
    CO_DRIFT: 0.6 / 60,  // points / s
    CO_HATE: 0.8 / 60,   // points / s perdus par chantier simultané au-delà du premier

    // Pauses
    PAUSE_STABILISE: 3,
    PAUSE_CHIFFRE: 2.2,
    PAUSE_ACTE: 4,       // carton d'ouverture d'un acte

    // Acte II : le réseau. Production et demande en MW ; la marge entre les deux fait tout.
    REBOND: 1,           // %/min de croissance quand toute la production est en trop (marge / production = 1)
    DELESTAGE: ['industrie', 'commerce', 'ville', 'vital'],   // ordre du délestage, affiché au joueur
    SOBRIETE: 0.7,       // part de la demande des villes qui reste après la mesure de sobriété
    POSTE: { x: 270, y: 296 },   // poste électrique où convergent les lignes du réseau, sur la carte

    // Acte III : les gens. Les Mains deviennent le goulot, le Consentement devient volatil.
    SEMAINE: 5,              // secondes réelles par semaine fictive (formations, attente)
    MAINS_MAX: 40000,        // plafond humain : Mains disponibles, engagées et en formation
    CO_ATTENTE: 0.4 / 60,    // points / s perdus par millier de personnes qui attendent une formation
    CO_FORMES: 2,            // points rendus quand un lot finit sa formation
    // Vivres, en points : 100 couvre les besoins du pays. Une exploitation qu'on démantèle cesse de produire à
    // l'ouverture du chantier, et sa terre, convertie, en rend `releve` en `releveDur` s. Sous 100 : pénurie.
    VIVRES: { besoin: 100, base: 30, ceintures: 30, releve: 0.9, releveDur: 300, casse: 15 / 60, co: 0.1 / 60 },

    // Régions de la carte. Au deuxième chiffre perdu, la plus démantelée s'éteint.
    regions: {
      'Valdrance': { nom: 'Valdrance', x: 250, y: 150, r: 125 },
      'Cherbaix': { nom: 'Le bassin de Cherbaix', x: 485, y: 250, r: 95 },
      'Méraud': { nom: 'Méraud', x: 120, y: 375, r: 85 },
      'Orvenne': { nom: 'Orvenne', x: 265, y: 425, r: 90 },
      'Vallée de la Sère': { nom: 'La vallée de la Sère', x: 345, y: 300, r: 85 },
      'Plaine': { nom: 'La plaine de Valdrance', x: 140, y: 270, r: 80 },
    },

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
        court: 'Data center', x: 318, y: 394,
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

      // ---- Acte II : le réseau. prod / cons en MW ; categorie fixe la place dans l'ordre de délestage. ----
      { id: 'thermique', acte: 2, nom: "Centrale thermique d'Orvenne", region: 'Orvenne', categorie: 'production',
        prod: 1200, besoin: { de: 'raffinerie', quoi: 'fioul' },
        E: 1.2e8, K: 500, M: 1200, dur: 360, g: 0, deplaces: 600, co: 0, T: 3, regen: 900, kBack: 150,
        court: 'Thermique', x: 176, y: 424,
        desc: '1 200 MW au fioul lourd. La plus grosse production du réseau, et la plus sale.' },
      { id: 'raffinerie', acte: 2, nom: 'Raffinerie de Méraud', region: 'Méraud', categorie: 'production',
        prod: 400, cons: 100,
        E: 6e7, K: 450, M: 800, dur: 360, g: 0, deplaces: 1100, co: 0, T: 3, regen: 900, kBack: 200,
        court: 'Raffinerie', x: 96, y: 346,
        desc: "Produit son propre courant, 400 MW, et le fioul de la centrale thermique d'Orvenne." },
      { id: 'acierie', acte: 2, nom: 'Aciérie de Cherbaix', region: 'Cherbaix', categorie: 'industrie',
        cons: 500, rapide: { casse: 300 },
        E: 1.7e8, K: 700, M: 2000, dur: 450, g: 0, deplaces: 2400, co: 4, T: 5, regen: 900, kBack: 300,
        court: 'Aciérie', x: 526, y: 246,
        desc: "Hauts-fourneaux et laminoirs. Le premier consommateur d'électricité du pays." },
      { id: 'chimie', acte: 2, nom: 'Chimie de la Sère', region: 'Vallée de la Sère', categorie: 'industrie',
        cons: 300, rapide: { casse: 500 },
        E: 1.2e8, K: 600, M: 1500, dur: 360, g: 0, deplaces: 1500, co: 4, T: 4, regen: 900, kBack: 250,
        court: 'Chimie', x: 372, y: 388,
        desc: "Engrais, solvants, chlore. Le chlore de l'eau potable d'Orvenne vient d'ici." },
      { id: 'commerce', acte: 2, nom: "Zone commerciale d'Orvenne", region: 'Orvenne', categorie: 'commerce',
        cons: 150,
        E: 2e7, K: 250, M: 400, dur: 180, g: 0, deplaces: 900, co: 3, T: 1.2, regen: 600, kBack: 50,
        court: 'Commerces', x: 364, y: 432,
        desc: "Quarante hectares de parkings et de galeries, climatisés toute l'année." },
      { id: 'ski', acte: 2, nom: 'Pistes de ski couvertes de Valdrance', region: 'Valdrance', categorie: 'commerce',
        cons: 80,
        E: 1e7, K: 200, M: 200, dur: 135, g: 0, deplaces: 150, co: 2, T: 0.8, regen: 600, kBack: 30,
        court: 'Ski couvert', x: 166, y: 132,
        desc: "De la neige à −5 °C sous un toit, en plaine, toute l'année." },
      { id: 'ecrans', acte: 2, nom: 'Écrans et éclairage de nuit', region: 'Valdrance', categorie: 'commerce',
        cons: 60,
        E: 6e6, K: 150, M: 100, dur: 90, g: 0, deplaces: 80, co: 2, T: 0.4, regen: 600, kBack: 20,
        court: 'Écrans de nuit', x: 402, y: 152,
        desc: 'Façades lumineuses, vitrines et parkings éclairés pour personne.' },
      // Mesures de l'acte II : elles ne retirent rien, elles rendent la suite possible.
      { id: 'uv', acte: 2, mesure: true, effet: 'uv', nom: "Filtration UV de l'eau d'Orvenne", region: 'Orvenne',
        E: 0, K: 300, M: 300, dur: 225, g: 0, deplaces: 0, co: 0, T: 0, regen: 0, kBack: 0,
        court: 'Filtration UV', x: 282, y: 430,
        desc: "L'eau potable d'Orvenne ne dépendra plus du chlore de la chimie. Ne fait rien baisser." },
      { id: 'sobriete', acte: 2, mesure: true, effet: 'sobriete', nom: 'Sobriété des deux villes', region: 'Valdrance',
        E: 0, K: 400, M: 600, dur: 270, g: 0, deplaces: 0, co: 5, T: 0, regen: 0, kBack: 0,
        court: 'Sobriété', x: 280, y: 140,
        desc: "Chauffage, éclairage, horaires : la demande de Valdrance et d'Orvenne baisse de 30 %. Ne fait rien baisser." },

      // ---- Acte III : les gens. part = part de l'Empreinte restante que le site retire en fermant ;
      //      desservi = ce qui l'approvisionne (sans lui, le chantier se fait à bras) ; vivres = points de vivres produits. ----
      { id: 'port', acte: 3, nom: 'Port de Méraud', region: 'Méraud', categorie: 'logistique',
        part: 0.55, K: 70, M: 5400, dur: 390, g: 0, deplaces: 3200, co: 6, T: 3, regen: 900, kBack: 150,
        court: 'Port', x: 66, y: 400,
        desc: 'Terminaux à conteneurs, silos et quais vraquiers. Les céréales partent par ici, le soja des élevages arrive par ici.' },
      { id: 'autoroute', acte: 3, nom: 'Autoroute de la Sère', region: 'Vallée de la Sère', categorie: 'logistique',
        part: 0.45, K: 60, M: 4200, dur: 345, g: 0, deplaces: 1200, co: 5, T: 3, regen: 900, kBack: 100,
        court: 'Autoroute', x: 398, y: 292,
        desc: "Deux fois trois voies le long de la Sère. Les entrepôts, les serres et les centrales d'achat vivent de ses camions." },
      { id: 'entrepots', acte: 3, nom: 'Plateforme logistique de Valdrance', region: 'Valdrance', categorie: 'logistique',
        desservi: ['autoroute'], part: 0.45, K: 50, M: 4800, dur: 315, g: 0, deplaces: 2600, co: 4, T: 2, regen: 720, kBack: 60,
        court: 'Entrepôts', x: 392, y: 206,
        desc: 'Six cent mille mètres carrés sous tôle. Livré en deux heures, renvoyé le lendemain.' },
      { id: 'centrales', acte: 3, nom: "Centrales d'achat de Cherbaix", region: 'Cherbaix', categorie: 'logistique',
        desservi: ['autoroute'], part: 0.45, K: 50, M: 4200, dur: 315, g: 0, deplaces: 2400, co: 4, T: 2, regen: 720, kBack: 40,
        court: "Centrales d'achat", x: 470, y: 380,
        desc: 'Trois enseignes, un seul fichier de fournisseurs. Tout ce qui se vend dans le pays passe par leurs quais.' },
      { id: 'cereales', acte: 3, nom: 'Céréales irriguées de la plaine', region: 'Plaine', categorie: 'agro',
        desservi: ['port'], vivres: 35, part: 0.6, K: 40, M: 7800, dur: 465, g: 0, deplaces: 1500, co: 4, T: 9, regen: 900, kBack: 20,
        court: 'Céréales', x: 118, y: 250,
        desc: "Douze mille hectares de maïs arrosé tout l'été, pour l'export. Il faut y remettre des haies, des rotations et des gens." },
      { id: 'elevages', acte: 3, nom: 'Élevages hors-sol de la plaine', region: 'Plaine', categorie: 'agro',
        desservi: ['port'], vivres: 25, part: 0.5, K: 40, M: 6000, dur: 390, g: 0, deplaces: 2200, co: 5, T: 5, regen: 720, kBack: 20,
        court: 'Élevages', x: 186, y: 300,
        desc: 'Porcs et volailles par centaines de milliers, nourris au soja débarqué à Méraud.' },
      { id: 'serres', acte: 3, nom: "Serres chauffées d'Orvenne", region: 'Orvenne', categorie: 'agro',
        desservi: ['autoroute'], vivres: 10, part: 0.35, K: 30, M: 3000, dur: 270, g: 0, deplaces: 900, co: 3, T: 3, regen: 600, kBack: 30,
        court: 'Serres', x: 432, y: 452,
        desc: 'Tomates et fraises en janvier, sous quarante hectares de verre chauffé.' },
      { id: 'peche', acte: 3, nom: 'Pêche industrielle de Méraud', region: 'Méraud', categorie: 'agro',
        desservi: ['port'], vivres: 10, part: 0.4, K: 30, M: 3000, dur: 315, g: 0, deplaces: 1400, co: 4, T: 4, regen: 900, kBack: 40,
        court: 'Pêche', x: 34, y: 452,
        desc: "Chalutiers-usines et criée automatisée. La mer d'Ostrane se vide plus vite qu'elle ne se remplit." },
      // Mesures de l'acte III
      { id: 'ceintures', acte: 3, mesure: true, effet: 'ceintures', nom: 'Ceintures maraîchères', region: 'Orvenne',
        E: 0, K: 100, M: 2400, dur: 390, g: 0, deplaces: 0, co: 0, T: 0, regen: 0, kBack: 0,
        court: 'Ceintures maraîchères', x: 0, y: 0,
        desc: "Du maraîchage autour de Valdrance et d'Orvenne : 30 points de vivres de plus. Ne fait rien baisser." },
      { id: 'centres', acte: 3, mesure: true, effet: 'centres', nom: 'Centres de formation', region: 'Valdrance',
        E: 0, K: 150, M: 1800, dur: 315, g: 0, deplaces: 0, co: 0, T: 0, regen: 0, kBack: 0,
        court: 'Centres de formation', x: 0, y: 0,
        desc: 'Des formateurs, des ateliers, des places : deux lots en formation à la fois. Ne fait rien baisser.' },
    ],

    // Nœuds qui ne sont pas des chantiers mais dépendent de sites
    noeuds: [
      { id: 'hopital', nom: 'Hôpital régional de Cherbaix', region: 'Cherbaix', casse: 60, co: 30, x: 420, y: 336 },
      // Acte II : le réseau. Ces nœuds ne se démantèlent pas ; les consommateurs peuvent être délestés.
      { id: 'barrage', acte: 2, type: 'barrage', court: 'Barrage', nom: 'Barrage de la Sère', region: 'Vallée de la Sère', prod: 600, x: 486, y: 93 },
      { id: 'valdrance', acte: 2, type: 'ville', categorie: 'ville', nom: 'Valdrance', region: 'Valdrance', cons: 250, casse: 1500, co: 12, x: 294, y: 156 },
      { id: 'orvenne', acte: 2, type: 'ville', categorie: 'ville', nom: 'Orvenne', region: 'Orvenne', cons: 200, casse: 1200, co: 12, x: 264, y: 428 },
      { id: 'pompage', acte: 2, type: 'pompage', categorie: 'vital', court: 'Pompage', nom: 'Pompage de la Sère', region: 'Vallée de la Sère', cons: 120, casse: 300, co: 15, x: 322, y: 222 },
      { id: 'eau', acte: 2, type: 'eau', categorie: 'vital', court: 'Eau potable', nom: "Eau potable d'Orvenne", region: 'Orvenne', cons: 80, casse: 400, co: 20,
        besoin: { de: 'chimie', quoi: 'chlore', sauf: 'uv' }, x: 300, y: 436 },
      { id: 'hopital_orvenne', acte: 2, type: 'hopital', categorie: 'vital', court: 'Hôpital', nom: "Hôpital d'Orvenne", region: 'Orvenne', cons: 60, casse: 80, co: 25, x: 210, y: 398 },
    ],

    // Graphe : from alimente to. Un dépendant est alimenté tant qu'au moins un de ses alimentants est actif.
    liens: [
      { from: 'charbon', to: 'suv', quoi: 'électricité' },
      { from: 'charbon', to: 'hopital', quoi: 'électricité' },
      { from: 'gaz', to: 'hopital', quoi: 'secours' },
    ],

    // Acte III : des noms. Chaque lot en formation en montre trois, tirés de ces listes et des métiers du site d'origine.
    PRENOMS: {
      f: ['Mireille', 'Joëlle', 'Nadia', 'Sandrine', 'Fatou', 'Inès', 'Leïla', 'Ana', 'Samia', 'Chloé', 'Amina', 'Josiane',
        'Malika', 'Sylvie', 'Nathalie', 'Agnès', 'Aïcha', 'Lucie', 'Rachida', 'Élodie', 'Céline', 'Monique', 'Yasmina', 'Martine'],
      m: ['Karim', 'Thierry', 'Sébastien', 'Grégoire', 'Marek', 'Yannick', 'Hervé', 'Bruno', 'Patrice', 'Didier', 'Rémi', 'Kevin',
        'Pascal', 'Mehdi', 'Jordan', 'Olivier', 'Franck', 'Antoine', 'Gilles', 'Tomasz', 'Mamadou', 'Ludovic', 'Farid', 'Jean-Luc'],
    },
    NOMS: ['Aubrac', 'Benali', 'Tissier', 'Morvan', 'Lefèvre', 'Diallo', 'Kowalski', 'Garnier', 'Haddad', 'Roux', 'Marchetti',
      'Nguyen', 'Perrin', 'Ferreira', 'Lambert', 'Mercier', 'Bouaziz', 'Caron', 'Duval', 'Fontaine', 'Girard', 'Hamon', 'Jacquet',
      'Leroux', 'Masson', 'Ndiaye', 'Picard', 'Renaud', 'Sanchez', 'Texier', 'Vidal', 'Weber', 'Barbier', 'Colin', 'Dumont', 'Faure'],
    // Métiers par site d'origine : [masculin, féminin]
    METIERS: {
      pub: [['commercial', 'commerciale'], ['afficheur', 'afficheuse']],
      credit: [['conseiller clientèle', 'conseillère clientèle'], ['télévendeur', 'télévendeuse']],
      aero: [['agent de piste', 'agente de piste'], ['pilote', 'pilote']],
      suv: [['monteur', 'monteuse'], ['peintre carrossier', 'peintre carrossière']],
      dc: [['technicien de salle', 'technicienne de salle'], ['administrateur réseau', 'administratrice réseau']],
      ciment: [['opérateur de four', 'opératrice de four'], ['conducteur de broyeur', 'conductrice de broyeur']],
      charbon: [['chauffeur de chaudière', 'chauffeuse de chaudière'], ['mécanicien', 'mécanicienne']],
      gaz: [['technicien de turbine', 'technicienne de turbine'], ['électricien', 'électricienne']],
      thermique: [['conducteur de chaudière', 'conductrice de chaudière'], ['électricien', 'électricienne']],
      raffinerie: [['opérateur de raffinage', 'opératrice de raffinage'], ['chaudronnier', 'chaudronnière']],
      acierie: [['fondeur', 'fondeuse'], ['lamineur', 'lamineuse']],
      chimie: [['opérateur de synthèse', 'opératrice de synthèse'], ['laborantin', 'laborantine']],
      commerce: [['vendeur', 'vendeuse'], ['caissier', 'caissière']],
      ski: [['perchiste', 'perchiste'], ['moniteur', 'monitrice']],
      ecrans: [['électricien', 'électricienne'], ["poseur d'enseignes", "poseuse d'enseignes"]],
      port: [['docker', 'docker'], ['grutier', 'grutière'], ['agent de quai', 'agente de quai']],
      autoroute: [["agent d'exploitation", "agente d'exploitation"], ['péagiste', 'péagiste']],
      entrepots: [['préparateur de commandes', 'préparatrice de commandes'], ['cariste', 'cariste']],
      centrales: [['acheteur', 'acheteuse'], ['chauffeur poids lourd', 'chauffeuse poids lourd']],
      cereales: [["conducteur d'engins agricoles", "conductrice d'engins agricoles"], ['irrigant', 'irrigante']],
      elevages: [['éleveur', 'éleveuse'], ['technicien sanitaire', 'technicienne sanitaire']],
      serres: [['ouvrier de serre', 'ouvrière de serre'], ['chauffagiste', 'chauffagiste']],
      peche: [['marin pêcheur', 'marin pêcheuse'], ['mareyeur', 'mareyeuse']],
    },
    METIERS_COMMUNS: [['ouvrier', 'ouvrière'], ['technicien', 'technicienne'], ['opérateur', 'opératrice'], ['magasinier', 'magasinière']],

    // Casse quand un site (chantier) est coupé : ses gens sont perdus, sans reclassement
    COUPURE_SITE_CO: 15,
    COUPURE_SITE_E: 0.5, // fraction de l'Empreinte du site tout de même retirée (il s'arrête, il n'est pas démantelé)
    RETRAIT_MAX: 0.95,   // une fermeture ne retire jamais plus que cette part de ce qui reste : l'Empreinte ne passe pas sous zéro
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
