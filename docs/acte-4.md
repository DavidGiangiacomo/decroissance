# Acte IV — Le legs

Design proposé et validé dans [l'issue #16](https://github.com/DavidGiangiacomo/decroissance/issues/16), puis réglé au simulateur. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition.

## L'idée

À l'entrée de l'acte IV, l'Empreinte est entre 10⁴ et 10⁶, selon la façon de jouer. L'essentiel de ce qui reste ne se démantèle pas : des combustibles usés, des galeries de mine, des digues. Cela se garde. Le verbe du jeu change : on ne ferme plus, on institue des gardes, et l'on paie pour perdre du débit à jamais (§7). Ce que l'acte retire au joueur, selon le §9 : l'idée de terminer.

Les sept points validés :

1. **La Garde.** Elle retire de l'Empreinte ce qu'elle tient, contre de la Capacité et des gardiens perdus pour toujours. Les gardiens se forment sur les places de formation. Avant d'être gardées, les charges fuient.
2. **Le dosage, réduit ou plein.** Son prix n'apparaîtra qu'à l'épilogue.
3. **Le réseau national, point de non-retour** : après lui, la Capacité ne se renouvelle plus.
4. **Les sols au temps réel seul**, hors ligne compris.
5. **Le plancher affiché dès l'ouverture de l'acte**, avec la part « à garder ».
6. **Des parts de l'Empreinte**, comme à l'acte III : cela tranche aussi le point 1 de [#31](https://github.com/DavidGiangiacomo/decroissance/issues/31).
7. **Le Consentement qui remonte hors ligne** reste tel quel.

## Les règles

- **Le plancher se révèle.** À l'ouverture de l'acte, deux nombres apparaissent sous le compteur :
  - le plancher irréductible, 2,4 doublé par chaque relance du joueur ou du Conseil ;
  - la part « à garder », par exemple 92 %.

  L'Empreinte ne descend jamais sous le plancher : le moteur l'interdit. Si une relance fait passer le plancher au-dessus d'elle, elle y remonte ([acte-5.md](acte-5.md)). Le joueur découvre que zéro n'est pas possible, et pourquoi (R5).
- **Ce qui reste fuit.** Trois charges apparaissent sur la carte, avec la durée de leur garde : les digues de la Sère, les galeries du bassin de Cherbaix, et les combustibles usés de la pointe de Morvel, une centrale qu'aucune liste de chantiers n'avait montrée (§5). Tant qu'une charge n'est pas gardée, elle fait remonter l'Empreinte, comme les sites de l'acte I : +0,5 % par minute pour les trois. Le compteur, qui tombait par moitiés à l'acte III, s'arrête net, voire remonte.
- **La part « à garder »** est ce que les gardes pas encore instituées retireront ensemble de l'Empreinte d'aujourd'hui. Les parts se multiplient : 1 − 0,3 × 0,45 × 0,6, soit 92 % à l'ouverture.
- **La Garde est un panneau à part.** Ce qui se garde n'apparaît jamais dans la liste des chantiers (§5).
  - **Le coût :** une garde coûte de la Capacité une fois, et des gardiens pour toujours. Les gardiens sortent des Mains et ne reviennent jamais.
  - **La formation :** les gardiens se forment sur une place de formation, comme un lot de reconversion. Une garde demandée quand toutes les places sont prises attend la première qui se libère, et passe avant les lots suivants.
  - **L'effet :** une fois la garde instituée, la charge cesse de fuir et sort de l'Empreinte, pour sa part de ce qui reste.
  - **L'affichage :** chaque garde montre sa durée, rapportée à ce qu'on connaît (« 100 000 ans, vingt fois toute l'histoire écrite »), et les gardiens qu'elle coûtera chaque année.
- **Le dosage.** Chaque garde s'institue réduite ou pleine. Les deux arrêtent la fuite ; la pleine demande deux fois plus de gardiens. Le jeu ne dit pas ce qu'elle apporte de plus : la différence se paiera à l'épilogue, en Casse (§7, [#20](https://github.com/DavidGiangiacomo/decroissance/issues/20)). En attendant, le rapport de session note le dosage de chaque garde.
- **Sans Capacité, à bras.** À ce niveau d'Empreinte, la Capacité ne se renouvelle plus que de quelques points par minute : c'est le stock du début d'acte qui paie. Une garde ou un chantier de l'acte qui n'a plus assez de Capacité se fait à bras, avec deux fois plus de gardiens ou de Mains. La carte le dit avant le lancement.
- **Le réseau national, point de non-retour.** C'est le dernier chantier industriel : les lignes à très haute tension et le poste de la Sère. Il retire beaucoup, et le joueur choisit quand le lancer (§5). Quand il est démantelé :
  - la Capacité ne se renouvelle plus jamais, même pendant une relance ;
  - le rebond du réseau s'arrête : le barrage alimente les villes en direct ;
  - les lignes s'éteignent sur la carte, et la section du réseau disparaît.
- **Les sols, au temps réel seul.** Trois dépollutions, plus une par site de l'acte II démoli trop vite :
  - une fois lancées, elles avancent à leur rythme : ni les Mains ni la relance ne les accélèrent ;
  - elles avancent aussi hors ligne, dans la limite de douze heures. C'est la seule chose du jeu qui progresse quand le joueur n'est pas là. Une dépollution qui finit pendant l'absence retire sa part, et le chiffre tombe au retour ;
  - elles ne comptent pas comme des chantiers menés de front : elles n'usent pas le Consentement ;
  - une fois finies, leur terre repousse en quinze minutes : la Terre rendue possible monte à 81,8 % (§9 : 82 %).
- **La relance** marche toujours, mais n'aide presque plus : la Capacité se renouvelle à peine, puis plus du tout, et ni les sols ni les gardiens ne vont plus vite. Elle double toujours le plancher, désormais affiché, et réembauche toujours ceux qui attendaient une formation.

## Entrée, carte, son, fin

- **L'ouverture.** L'acte s'ouvre quand la carte de l'acte III est vidée. Le jeu s'arrête 4 s sur un carton « Acte IV — Le legs ». Le journal dit le plancher et la part à garder. Le panneau de la Garde s'ouvre ; la section des vivres se ferme, puisque l'agro-industrie est démantelée.
- **La carte.**
  - Les trois charges portent un hexagone et la durée de leur garde. Il est ambré tant qu'elles fuient, bleu une fois gardées.
  - La centrale de la pointe de Morvel apparaît sur la côte est.
  - Le réseau national prend la place du poste ; une fois démantelé, les lignes s'éteignent.
  - Les sols de l'acte II n'ont pas de repère propre : leur site, brun tant qu'il est pollué, verdit une fois dépollué.
- **Le son.**
  - À l'ouverture, un dernier bourdonnement grave arrive, celui du poste de la Sère. Il s'éteint avec le réseau national.
  - Au premier chiffre perdu de l'acte, la pluie arrive.
  - Au deuxième, presque le silence : les oiseaux, les insectes, les voix et le fret se taisent. Il ne reste que le vent, l'eau et la pluie (§12).
- **La fin.** L'acte finit quand les trois charges sont gardées, le réseau national démantelé et les sols dépollués. Son dernier élément ouvre directement l'acte V. Les données de l'acte, chaque garde, sa durée, son dosage et ses gardiens par an, sont reprises par le panneau de fin de l'acte V et par le rapport de session.
- **L'acte III** ne montre plus son panneau de fin : son dernier chantier ouvre directement l'acte IV.

## Contenu

| Élément | Nature | Part retirée | Coût | Durée | Particularité |
|---|---|---|---|---|---|
| Combustibles usés de la pointe de Morvel | garde, 100 000 ans | 70 % | Capacité 400 ; 3 000 gardiens, ou 6 000 pour une garde pleine | formation : 9 min, 108 semaines | fuite +0,25 %/min |
| Galeries du bassin de Cherbaix | garde, 10 000 ans | 55 % | 250 ; 1 500 ou 3 000 gardiens | 7 min, 84 semaines | fuite +0,15 %/min |
| Digues de la Sère | garde, 300 ans | 40 % | 150 ; 800 ou 1 600 gardiens | 5 min, 60 semaines | fuite +0,1 %/min |
| Réseau national | chantier, point de non-retour | 60 % | Capacité 300, 2 500 Mains | 7 min | 1 500 personnes à reconvertir, consentement −5 |
| Décharges de Valdrance | sol | 65 % | 400 Mains, rendues à la fin | 20 min de temps réel | 8 points de Terre rendue |
| PFAS de la Sère | sol | 70 % | 400 Mains | 25 min | 9 points |
| Nitrates de la plaine | sol | 65 % | 400 Mains | 15 min | 8 points |
| Sols de l'aciérie, de la chimie | sol, si démolie vite à l'acte II | 30 % | 300 Mains | 10 min | le site pollué se régénère enfin |

Les sept parts réunies laissent 0,12 % de l'Empreinte : l'acte fait perdre 2,9 chiffres, un peu plus avec les sols de l'acte II. Sans gardes pleines ni travail à bras, il coûte 5 300 gardiens.

## Les arbitrages

- **La Capacité du début d'acte.** Elle ne suffit pas à tout : les gardes et le réseau en demandent 1 100, le stock plafonne à 900. Ce qu'on paie en premier se fait avec, le reste se fait à bras.
- **Le réseau tôt ou tard.** Le démonter tôt retire 60 % tout de suite, mais consomme 300 de Capacité, et ferme pour toujours la porte d'une relance qui en rendrait.
- **Garder réduit ou plein.** Réduit garde des Mains pour l'acte V, qui se fera à la main (§10). Plein, c'est payer pour l'avenir, sans savoir quoi : le prix d'une garde réduite ne se dit qu'à l'épilogue ([fins.md](fins.md)).
- **Les places de formation.** Les gardiens et les gens à reconvertir se disputent les mêmes places. Une garde demandée passe avant les lots, mais elle attend qu'une place se libère.
- **Les sols tôt.** Les lancer tard, c'est attendre : ils ne vont pas plus vite. C'est aussi l'acte où partir fait avancer la partie.

## Écarts avec la proposition, et pourquoi

- **Des durées plus longues.** La proposition ne donnait pas de durée à la formation des gardiens, et prévoyait des sols de 10 à 15 min. Au premier réglage, l'acte durait 15 min et ses chiffres tombaient à 2 min d'écart, plus vite qu'à l'acte III, alors que le §10 veut que le compteur « ralentisse brutalement ». Les gardiens se forment maintenant en 5 à 9 min, les sols prennent 15 à 25 min, et le réseau national 7 min au lieu de 5.
- **Le réseau national se fait aussi à bras.** Sinon, un joueur qui dépense sa Capacité pour les gardes ne pourrait plus le démanteler avant des heures : à ce niveau, elle ne se renouvelle plus que de quelques points par minute. Une coupure coûte de la Casse, jamais de la progression (R4) ; il en va de même pour la Capacité.
- **Une garde attend une place, et passe avant les lots.** Sans cela, « Former en continu » occuperait toutes les places et aucune garde ne pourrait jamais commencer.
- **La fuite continue pendant la formation des gardiens**, et ne s'arrête qu'à l'institution de la garde.
- **Le rebond du réseau s'arrête avec le réseau national.** Le petit rebond qui restait depuis l'acte II (+0,04 %/min) disparaît avec lui.
- **Les décharges sont à Valdrance**, et non à Cherbaix, pour que la carte reste lisible autour du bassin.

## Rythme mesuré

Mesures faites avec `node tools/simulate.js <profil> <réaction>`. Les bots prudents lancent les sols d'abord, puis les gardes, la plus grosse fuite d'abord, et le réseau national en dernier, sans jamais descendre sous 25 de Consentement. Le pressé prend la plus grosse part d'abord, sans rien regarder. Tous instituent des gardes réduites ; `DOSAGE=pleine` les rend pleines, sans changer le rythme. Les écarts sont comptés depuis le chiffre précédent, celui de l'acte III compris.

| Joueur | Réaction | Ouverture | Empreinte à l'ouverture | Durée | Chiffres perdus | Écarts | Gardes à bras | Gardiens | Relances du Conseil dans l'acte | Plancher | Empreinte à la fin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Prudent | 10 s | 1 h 01 | 29 183 | 25 min 20 | 3 | 13 min 25, 5 min 55, 11 min 34 | galeries | 6 800 | 0 | 4,8 | 36 |
| Prudent | 30 s | 1 h 08 | 11 999 | 26 min 15 | 3 | 22 min 30, 1 min, 7 min 45 | — | 5 300 | 0 | 2,4 | 15 |
| Prudent | 45 s | 1 h 17 | 194 783 | 26 min | 3 | 11 min 45, 5 min, 5 min | — | 5 300 | 1 | 4,8 | 262 |
| Pressé | 10 s | 1 h 03 | 20 811 | 25 min 10 | 3 | 13 min 05, 7 min 50, 5 min 39 | galeries | 6 800 | 1 | 38,4 | 38, au plancher |
| Pressé | 30 s | 1 h 05 | 86 705 | 26 min | 3 | 21 min, 16 min 45, 4 min 45 | galeries | 6 800 | 0 | 19,2 | 114 |
| Pressé | 45 s | 1 h 45 | 709 758 | 34 min | 2 | 18 min 15, 11 min | galeries | 6 800 | 0 | 19,2 | 1 007 |
| Vite | 10 s | 1 h 00 | 25 839 | 25 min 30 | 3 | 9 min 40, 2 min 05, 9 min 09 | — | 5 300 | 1 | 4,8 | 16 |
| Vite | 45 s | 1 h 20 | 297 695 | 27 min 15 | 3 | 14 min 37, 15 s, 7 min | — | 5 300 | 0 | 4,8 | 196 |
| Relance à 2 min | 10 s | 1 h 02 | 143 440 | 25 min 30 | 3 | 18 min 36, 8 min 54, 6 min 39 | — | 5 300 | 0 | 4,8 | 181 |

- Aucun écart du tableau ne dépasse 25 min (I1). Le plus long, 22 min 30, est celui de la transition pour le prudent à 30 s : la première fermeture de l'acte IV ne peut pas venir avant 5 min, le temps de former les gardiens des digues.
- Le pressé à 10 s finit sur son plancher : quatre relances du Conseil l'ont porté à 38,4. Ses relances lui coûtent exactement ce que le §8 annonce.
- Les actes I à IV se jouent en 1 h 26 pour le bot prudent à 10 s, le §9 en prévoit 2 h 50. La Terre rendue atteint 63 à 65 % à la fin de l'acte, puis 81,8 % un quart d'heure plus tard, quand la terre des sols a repoussé.

## Points ouverts

1. **Le dosage a maintenant un prix.** À Clore, chaque garde réduite ajoute de la Casse, que l'épilogue révèle : 300 personnes pour les digues, 600 pour les galeries, 1 200 pour les combustibles ([fins.md](fins.md)). Une garde pleine n'ajoute rien.
2. **La fin de l'acte attend la dernière dépollution.** Après la dernière garde, il peut rester une dizaine de minutes sans autre geste que de reconvertir. C'est voulu (« les sols tôt », et l'absence fait avancer la partie), mais un playtest dira si c'est vécu comme une attente ou comme une invitation à partir. R3, qui borne les murs de temps réel à 4 min, vise l'acte V.
3. **Les gardiens ne comptent pas dans le plafond humain** de 40 000 Mains. Ce plafond n'est pas atteint.
4. **Le Consentement qui remonte hors ligne** est gardé tel quel (point 7). Avec les sols, partir devient une stratégie : à observer.
5. **Le rapide à 30 s dépasse I1 de 46 s**, hors du tableau ci-dessus. Il finit l'acte III à 11 259, juste au-dessus de 10⁴, et son premier sol n'est dépollué que 15 min après l'ouverture de l'acte IV : 25 min 46 séparent son cinquième et son sixième chiffre. `tools/check.js`, qui l'a trouvé, le tient pour un écart connu (§9 du design doc).
6. **Hors de cet acte :**
   - l'acte V, « Rendre », où le compteur descend jusqu'au plancher : il est décrit dans [acte-5.md](acte-5.md) ;
   - l'épilogue et les fins, où se paie le dosage : ils sont décrits dans [fins.md](fins.md) ;
   - les décisions ([#18](https://github.com/DavidGiangiacomo/decroissance/issues/18)), dont la crédibilité « en acte IV » de la branche Dette ;
   - passer l'acte II en parts ([#31](https://github.com/DavidGiangiacomo/decroissance/issues/31), point 1), qui reste à faire.
