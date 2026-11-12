# Acte V — Rendre

Design proposé pour [l'issue #17](https://github.com/DavidGiangiacomo/decroissance/issues/17) et validé le 2026-11-10, puis réglé au simulateur. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition.

## L'idée

À l'entrée de l'acte V, tout ce qui pouvait se fermer est fermé, et tout ce qui devait se garder est gardé. L'Empreinte est entre 7 et 1 000, selon la façon de jouer, et la Capacité ne se renouvelle plus. Il reste la terre elle-même : des routes, des dalles, des ruisseaux busés, des clôtures. Le verbe change une dernière fois : on ne ferme plus, on ne garde plus, on rend. Ce que l'acte retire au joueur, selon le §9 : le reste. Ici, ses Mains.

Les cinq points validés :

1. **Les Mains consommées.** L'équipe d'un geste reste sur la terre qu'elle a rendue et sort du jeu.
2. **Le repli sur les habitants.** Sans assez de Mains, les habitants font le geste, contre du temps et du Consentement. Cela peut mener à une relance du Conseil en toute fin de partie.
3. **L'Empreinte remonte au plancher après une relance**, si elle se retrouve dessous.
4. **Vingt-huit gestes génériques**, quatre par région, plutôt que des lieux nommés un par un.
5. **I1 s'arrête au plancher** : `tools/check.js` ne compte plus le temps sans chiffre perdu quand plus aucun chiffre ne peut tomber.

## Les règles

- **Des gestes, pas des chantiers.** Chaque région demande les quatre mêmes gestes : démonter, débitumer, rouvrir, planter. Sept régions, vingt-huit gestes. Un geste se lance d'un clic et ne coûte aucune Capacité.
- **Un geste à la fois.** Tant qu'un geste est en cours, aucun autre ne se lance. L'ordre est libre.
- **Chaque geste retire une part de ce qui reste**, de 8 à 15 %, comme les sites des actes III et IV. Le compteur descend par dizaines pour qui arrive à plusieurs centaines, par unités pour les autres. Sous 100, l'Empreinte se lit à la décimale : « 4,8 ».
- **L'équipe reste sur place.** Un geste prend une équipe de 300 à 900 Mains. À la fin du geste, elle ne revient pas : elle s'installe sur la terre qu'elle a rendue, et sort du jeu, comme les gardiens. Les vingt-huit gestes demandent 15 400 Mains.
- **Faute de Mains, les habitants.** S'il ne reste pas assez de Mains pour une équipe, les habitants font le geste : deux fois plus long, et 3 points de Consentement, pris au lancement. La carte du geste le dit avant, et prévient si le Consentement passerait sous le seuil du Conseil. Un geste reste donc toujours possible, même sans Mains ni Capacité (R3).
- **L'arrêt sur le plancher.** Aucun geste ne fait passer l'Empreinte sous le plancher. Quand elle l'atteint, le jeu s'arrête 3 s, le son baisse, et le compteur se fige : « au plancher — il ne descendra plus ». Les gestes qui restent ne rendent plus que de la terre, et leur carte le dit.
- **Le dernier geste** retire tout ce qui dépasse encore du plancher, quelle que soit sa part. Un joueur arrivé très haut finit donc lui aussi sur le plancher.
- **La relance** marche toujours : le geste en cours va deux fois plus vite, et le plancher double. Si l'Empreinte se retrouve sous le nouveau plancher, elle y remonte aussitôt, et le journal le dit. Cette règle vaut pour toute la partie ; avant l'acte IV, où le plancher n'est pas encore affiché, elle joue sans être dite.
- **La terre rendue.** Chaque geste rend de 0,4 à 0,9 point de Terre rendue, qui repoussent en deux à quatre minutes. Les vingt-huit gestes en rendent 18,2 : la Terre rendue possible passe de 81,8 à 100 %. Hors ligne, les gestes n'avancent pas ; la terre déjà rendue, elle, continue de repousser.
- **R3 est tenu par les données.** Un geste dure 30 à 45 s, et 90 s au plus quand les habitants le font. Aucune repousse ne dépasse 4 min. Un test le vérifie.

## Entrée, carte, son, fin

- **L'ouverture.** L'acte s'ouvre quand l'acte IV est achevé. Le jeu s'arrête 4 s sur un carton « Acte V — Rendre ». Le panneau « Rendre » s'ouvre en haut de la colonne ; la liste des chantiers se ferme, puisqu'il n'y en a plus.
- **Le panneau.** Une carte par geste, avec sa part, ce qu'elle retirerait aujourd'hui, son équipe, sa durée et la terre qu'elle rend. Sur chaque carte, un bouton par région : il se remplit pendant le geste, puis porte une coche. Une carte dont les sept gestes sont faits se replie.
- **La carte.** Une région reverdit à mesure que ses gestes sont faits et que sa terre repousse, et l'ombre des régions éteintes se lève. Les gestes n'ont pas de repère propre.
- **Le compteur des Mains** dit combien de personnes sont restées sur place, à côté des gardiens.
- **Le son.** Aucune couche nouvelle. Les oiseaux, les insectes et des voix, que l'acte IV avait fait taire, reviennent à mesure des gestes, et la pluie s'éloigne. Chaque geste achevé fait un bruit de terre retournée.
- **La fin.** L'acte finit quand les vingt-huit gestes sont faits. Une section, « Ce qui reste », s'ouvre alors en haut de la colonne. Elle énumère l'Empreinte et le plancher, chaque garde avec sa durée et ses gardiens, les gens restés sur la terre rendue et la Casse, et propose Clore ou Poursuivre : les fins sont décrites dans [fins.md](fins.md). Le rapport de session contient les mêmes données.
- **L'acte IV** ne montre plus son panneau de fin : son dernier élément ouvre directement l'acte V.

## Contenu

| Geste | Ce qu'il défait | Part retirée | Équipe | Durée | Terre rendue | Repousse |
|---|---|---|---|---|---|---|
| Démonter | les dernières lignes, les clôtures, les glissières, les panneaux | 10 % | 400 | 35 s | 0,4 point | 2 min |
| Débitumer | les routes, les parkings, les dalles | 15 % | 900 | 45 s | 0,9 point | 4 min |
| Rouvrir | les ruisseaux busés, les seuils, les berges | 12 % | 600 | 40 s | 0,7 point | 3 min |
| Planter | des haies, des vergers, des bois | 8 % | 300 | 30 s | 0,6 point | 4 min |

Chaque geste existe une fois par région : Valdrance, le bassin de Cherbaix, Méraud, Orvenne, la vallée de la Sère, la plaine de Valdrance, la pointe de Morvel. Les vingt-huit parts réunies laissent 3,5 % de l'Empreinte ; le dernier geste retire le reste, jusqu'au plancher.

## Les arbitrages

- **Où mettre les Mains.** Les habitants coûtent 3 points de Consentement par geste, quelle que soit l'équipe. Un joueur à court de Mains a donc intérêt à les garder pour les petites équipes, et à laisser les grosses aux habitants.
- **Finir vite ou finir bas.** Les gros gestes retirent plus par minute, les petits plus par Main.
- **Relancer.** À ce niveau, une relance ne rend plus de Capacité, et n'accélère que le geste en cours. Elle double le plancher, que le joueur a sous les yeux : s'il était arrivé à 4,8, il remonte à 9,6.
- **Garder réduit ou plein**, choisi à l'acte IV, se paie ici : avec des gardes pleines, il manque de 5 000 à 8 000 Mains.

## Écarts avec la proposition, et pourquoi

- **Un geste à la fois.** La proposition ne le disait pas. Sans cette limite, un joueur lançait les vingt-huit gestes d'un coup et l'acte durait deux minutes. Avec elle, la Terre rendue garde sa pente, et il y a toujours un geste à lancer dans les 90 s (R3).
- **Des durées de 30 à 45 s**, et non de 30 à 90 s. Fait par les habitants, un geste dure le double : il fallait rester sous 90 s.
- **L'Empreinte à la décimale sous 100.** Le plancher vaut 2,4, 4,8 ou 9,6 : en chiffres pleins, le compteur se serait arrêté sur « 4 » à côté d'un plancher de 4,8.
- **L'arrêt sur le plancher peut venir dès l'acte IV.** Un joueur que le Conseil a relancé quatre fois arrive à l'acte V déjà sur son plancher. Le jeu marque alors l'arrêt à l'acte IV, et tout l'acte V ne rend que de la terre.
- **La remontée au plancher vaut aussi pour la relance continue.** Au bout d'une trentaine de relances, le plancher dépasse l'Empreinte ; elle le suit ensuite, et double à chaque relance. Le bot « croissance » finit à 10¹⁶, au-dessus de l'Empreinte de départ, comme le veut le §11.

## Rythme mesuré

Mesures faites avec `node tools/simulate.js <profil> <réaction>`. À l'acte V, les bots attendent leur temps de réaction après la fin de chaque geste. Les prudents prennent les plus petites équipes d'abord, et ne laissent les habitants faire que si le Consentement reste au-dessus de 25. Le pressé prend la plus grosse part d'abord. Les écarts sont comptés depuis le chiffre précédent, celui de l'acte IV compris.

| Joueur | Réaction | Ouverture | Empreinte | Plancher | Mains | Durée | Chiffres perdus | Écarts | Plancher atteint | Gestes par les habitants | Mains à la fin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Prudent | 10 s | 1 h 26 | 36,7 | 4,8 | 16 830 | 22 min 01 | 1 | 9 min 45 | 1 h 41 | 0 | 1 430 |
| Prudent | 30 s | 1 h 34 | 15,3 | 2,4 | 22 430 | 31 min 01 | 1 | 11 min 30 | 1 h 54 | 0 | 7 030 |
| Prudent | 45 s | 1 h 43 | 262 | 4,8 | 16 730 | 37 min 46 | 2 | 19 min 05, 24 min 25 | 2 h 21, au dernier geste | 0 | 1 330 |
| Pressé | 10 s | 1 h 28 | 38,4 | 38,4 | 13 930 | 24 min 30 | 0 | — | dès l'acte IV | 5 | 30 |
| Pressé | 30 s | 1 h 31 | 114 | 19,2 | 14 300 | 32 min 31 | 1 | 5 min 14 | 1 h 48 | 0 | 1 000 |
| Pressé | 45 s | 2 h 19 | 1 007 | 19,2 | 19 430 | 37 min 46 | 2 | 5 min 29, 22 min 55 | 2 h 57, au dernier geste | 0 | 4 030 |
| Vite | 10 s | 1 h 26 | 16,9 | 4,8 | 18 330 | 22 min 01 | 1 | 9 min 40 | 1 h 35 | 0 | 2 930 |
| Vite | 30 s | 1 h 30 | 7,1 | 2,4 | 22 430 | 31 min 01 | 0 | — | 1 h 42 | 0 | 7 030 |
| Vite | 45 s | 1 h 47 | 196 | 4,8 | 17 330 | 37 min 46 | 2 | 15 min 05, 25 min 25 | 2 h 25, au dernier geste | 0 | 1 930 |
| Relance à 2 min | 10 s | 1 h 28 | 181 | 4,8 | 22 430 | 22 min 01 | 2 | 8 min 25, 14 min 55 | 1 h 50, au dernier geste | 0 | 7 030 |
| Relance à 2 min | 30 s | 1 h 34 | 322 | 4,8 | 22 430 | 31 min 01 | 2 | 13 min, 18 min | 2 h 05, au dernier geste | 0 | 7 030 |
| Relance à 2 min | 45 s | 1 h 43 | 825 | 9,6 | 16 730 | 37 min 46 | 2 | 27 min 16, 10 min 30 | 2 h 21, au dernier geste | 0 | 1 330 |
| Prudent, gardes pleines | 10 s | 1 h 26 | 36,7 | 4,8 | 10 030 | 26 min 32 | 1 | 9 min 45 | 1 h 41 | 6 | 30 |
| Pressé, gardes pleines | 10 s | 1 h 28 | 38,4 | 38,4 | 7 130 | 31 min 16 | 0 | — | dès l'acte IV | 20 | 230 |

- L'acte dure 22 min à 10 s de réaction, 31 min à 30 s, 38 min à 45 s. Le §9 en prévoit 35.
- À 10 et 30 s, aucun écart ne dépasse 18 min. À 45 s, deux joueurs passent plus de 25 min sans chiffre perdu (25 min 25 et 27 min 16) : ils dépassaient déjà I1 aux actes II et III.
- Tous finissent sur leur plancher, sauf le pressé aux gardes pleines : ses vingt gestes faits par les habitants lui valent deux relances du Conseil dans l'acte. Son plancher passe de 38,4 à 153,6, et son Empreinte y remonte.
- Les actes I à V se jouent en 1 h 48 pour le bot prudent à 10 s ; le §9 en prévoit 3 h 25. La Terre rendue est à 98 % à la fin de l'acte, à 100 % quatre minutes plus tard.
- `node tools/check.js` passe : le coût d'un point d'Empreinte monte encore (I3), et la Terre rendue reste à moins de 20 % d'une droite pour les treize parties qui démantèlent (I5).

## Points ouverts

1. **Le dernier tiers de l'acte se joue compteur figé.** La plupart des joueurs atteignent le plancher avant la fin : il leur reste de 7 à 19 min de gestes qui ne rendent que de la terre. C'est voulu, mais un playtest dira si ces gestes sont encore faits, et pourquoi.
2. **Les Mains ne manquent presque jamais.** Avec des gardes réduites, tous les bots ont de quoi faire les vingt-huit gestes, sauf le pressé à 10 s. Il en reste de 1 000 à 7 000 à la fin. Le repli sur les habitants ne mord qu'avec des gardes pleines.
3. **Une relance après le dernier geste ne laisse plus l'Empreinte au-dessus du plancher.** Réglé avec les fins : quand tout est rendu, ce qu'une relance ajoute reste, et le plancher monte jusqu'à l'Empreinte ([fins.md](fins.md)).
4. **Les gestes sont les mêmes partout.** Rien ne distingue Méraud de Morvel. Des lieux nommés viendront avec la carte complète ([#21](https://github.com/DavidGiangiacomo/decroissance/issues/21)) et les textes ([#23](https://github.com/DavidGiangiacomo/decroissance/issues/23)).
5. **Le son** n'a qu'un bruit nouveau, à affiner avec le reste ([#22](https://github.com/DavidGiangiacomo/decroissance/issues/22)).
6. **Hors de cet acte :**
   - Clore, Poursuivre et l'épilogue, décrits dans [fins.md](fins.md) ;
   - les décisions ([#18](https://github.com/DavidGiangiacomo/decroissance/issues/18)) ;
   - le mode Croissance, décrit dans [croissance.md](croissance.md).
