# Les fins — Clore, Poursuivre, et l'épilogue

Design proposé pour [l'issue #20](https://github.com/DavidGiangiacomo/decroissance/issues/20) et validé le 2026-11-11. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition. La troisième fin du §11, Croissance, reste à faire ([#19](https://github.com/DavidGiangiacomo/decroissance/issues/19)).

## L'idée

Au dernier geste de l'acte V, tout est rendu : l'Empreinte est sur le plancher, la carte est verte. Il reste à dire comment finir. Le §11 veut trois issues, aucune présentée comme la bonne, et aucun score.

Les six points validés :

1. **Clore est irréversible, et efface le bouton Relancer.** I6 vaut donc jusqu'à Clore.
2. **Les gardes réduites se paient à l'épilogue**, en Casse, sans que le jeu l'ait dit avant. Un joueur sans Casse en aura donc une, sauf s'il a gardé plein.
3. **L'ordre de référence est celui du joueur, réparé au plus juste**, et non un ordre idéal calculé à part.
4. **Poursuivre est irréversible** : plus de Clore ensuite, donc pas d'épilogue.
5. **Les pas de Poursuivre avancent hors ligne.** Une relance ramène l'Empreinte au plancher, doublé.
6. **L'épilogue défile à une ligne toutes les 4 s**, avec un bouton pour tout afficher.

## Les règles

- **Ce qui reste.** Quand le dernier geste est fait, une section s'ouvre en haut de la colonne. Elle énumère l'Empreinte, chaque garde avec sa durée et ses gardiens par an, les gens restés sur la terre rendue, la Casse et la Terre rendue. Elle propose deux boutons : Clore, Poursuivre. Le bouton Relancer reste à sa place, comme toujours.
- **Le choix se fait l'Empreinte bloquée au plancher.** Tant qu'une relance court, les deux boutons attendent.
- **Quand tout est rendu, ce qu'une relance ajoute reste.** Plus aucun geste ne peut le retirer : à la fin de la relance, le plancher monte jusqu'à l'Empreinte. L'écran final montre donc toujours une Empreinte bloquée au plancher (§11).
- **Clore** scelle la partie, après une confirmation.
  - Plus rien ne se lance ni ne se relance, et le temps de jeu s'arrête. Seule la terre finit de repousser.
  - Un écran, « Clos », énumère ce qui reste, sans commentaire. La Casse y est celle de la clôture.
  - L'épilogue suit. Quand il se referme, il ne reste que la carte : ni compteur, ni bouton, ni panneau. Le pied de page garde le rapport de session, l'inventaire, et de quoi recommencer.
  - Le son ne garde que l'ambiant : le vent, l'eau, les oiseaux, les insectes (§12).
- **L'épilogue, « L'inventaire ».** Tout ce qui a été fait, dans l'ordre, acte par acte : chaque chantier, chaque mesure, chaque garde, chaque geste, chaque relance, avec l'heure. La Casse est rangée sous le lancement qui l'a causée.
  - Les lignes viennent une à une, toutes les 4 s : cinq à six minutes pour une partie de bot. Un bouton les affiche toutes.
  - Une fois lu jusqu'au bout, l'inventaire se rouvre en entier.
- **L'ordre sans Casse**, pour les actes I à III, où l'ordre fait la Casse. Le moteur rejoue les lancements du joueur, dans son ordre, sans durées ni coûts.
  - Quand le suivant ferait de la Casse, il prend le premier des siens qui n'en fait pas. Les lancements sautés sont marqués « plus tard ».
  - Si aucun ne convient, il essaie une mesure que le joueur n'a pas faite, et la marque.
  - Une démolition rapide devient une démolition normale.
  - Un site coupé puis démantelé en restes compte à la place où ses restes ont été lancés.

  L'inventaire donne cet ordre et ce qu'il aurait épargné, en personnes et en chantiers à bras. Si l'ordre du joueur était propre, il dit seulement : « Rien à redire à cet ordre. »
- **Le prix du dosage.** Chaque garde réduite ajoute de la Casse, comptée à Clore et dite à la fin de l'épilogue, avec ce qui l'a faite. Une garde pleine n'ajoute rien. C'est l'erreur que le joueur n'a jamais su avoir commise (§11).
- **Poursuivre** refuse le plancher, après une confirmation. Il n'y a plus de Clore, et aucun écran de fin.
  - Chaque pas retire un dixième de ce qui reste, sous le plancher, et dure le double du précédent : 1 min, 2 min, 4 min.
  - Un pas se lance d'un clic, un seul à la fois. Rien ne l'accélère, pas même la relance. Il avance hors ligne, comme les sols, dans la limite de douze heures ; le suivant attend le joueur.
  - Sous le plancher, l'Empreinte se lit à trois chiffres : « 3,89 », puis « 0,871 ».
  - Une relance double le plancher, et l'Empreinte y remonte : tout le chemin fait est perdu. Les pas suivants ne repartent pas de 1 min.

## Contenu

| Garde réduite | Casse à l'épilogue | Ce qui l'a faite |
|---|---|---|
| Combustibles usés de la pointe de Morvel, 100 000 ans | 1 200 personnes | une piscine de refroidissement mal suivie, faute de monde |
| Galeries du bassin de Cherbaix, 10 000 ans | 600 personnes | une pompe arrêtée tout un hiver |
| Digues de la Sère, 300 ans | 300 personnes | une crue centennale, sur un tronçon que plus personne n'inspectait |

Trois gardes réduites coûtent 2 100 personnes. Trois gardes pleines coûtent 5 300 gardiens de plus, pris sur les Mains de l'acte V.

| Poursuivre | Durée du pas | Temps cumulé | Empreinte restante |
|---|---|---|---|
| 1er pas | 1 min | 1 min | 90 % |
| 5e pas | 16 min | 31 min | 59 % |
| 8e pas | 2 h 08 | 4 h 15 | 43 % |
| 10e pas | 8 h 32 | 17 h 03 | 35 % |

## Écarts avec la proposition, et pourquoi

- **Une confirmation avant Clore et avant Poursuivre.** Les deux sont sans retour, et un clic de trop finirait la partie. C'est la même boîte que pour recommencer.
- **Le choix est une section de la colonne, pas un panneau qui s'ouvre.** Il reste là tant que le joueur n'a pas choisi, y compris après un rechargement.
- **L'isolement n'est pas compté comme de la Casse.** Un site isolé se démantèle à bras, pour deux fois plus de Mains : l'ordre réparé l'évite, et l'inventaire le compte à part.
- **Les pas de Poursuivre ne repartent pas de 1 min après une relance.** La relance fait perdre le chemin, pas le prix.
- **Le resserrement de l'écran est borné sur un écran étroit.** À neuf chiffres perdus, il prenait 144 px sur un téléphone de 390 px, et l'en-tête débordait pendant une relance.

## Ce que disent les bots

`node tools/simulate.js` affiche, à la fin de chaque partie, ce que dirait l'épilogue.

| Joueur | Casse à la clôture | Ordre à redire | Ce que l'ordre réparé aurait épargné | Avec les gardes réduites |
|---|---|---|---|---|
| Prudent, 10 s | 0 | aucun | — | 2 100 |
| Relance à 2 min, 10 s | 0 | aucun | — | 2 100 |
| Vite, 10 s | 800 | acte II : l'aciérie et la chimie, sans démolir vite | 800 personnes | 2 900 |
| Pressé, 10 s | 5 202 | acte II : la filtration UV et la sobriété à faire, la centrale thermique et la raffinerie plus tard ; acte III : les ceintures maraîchères à faire, le port et l'autoroute plus tard | 3 400 personnes, puis 1 802 personnes et 6 chantiers à bras | 7 302 |
| Pressé, 30 s | 4 917 | les mêmes actes | 3 400 personnes, puis 1 517 personnes et 5 chantiers à bras | 7 017 |

- Pour tous les bots, l'ordre réparé ne fait aucune Casse : toute la Casse d'ordre était évitable (R4).
- L'inventaire compte 77 lignes pour le prudent et 90 pour le pressé : cinq et six minutes de défilement.

## Vérification

- `tools/check.js` vérifie que Clore ne fait qu'ajouter de la Casse (I4).
- I4 et I6 demandent que la Casse et le bouton Relancer restent à l'écran. Ils valent jusqu'à Clore : une partie close ne montre plus que la carte, comme le veut le §11.

## Points ouverts

1. **Le prix du dosage est rude pour le joueur prudent.** Il finit sans Casse, et l'épilogue lui en compte 2 100. C'est voulu, mais les trois nombres sont une première passe.
2. **Garder plein reste un pari aveugle.** Rien, avant l'épilogue, ne dit ce qu'une garde pleine apporte. Un joueur qui rejoue le saura : à voir si la deuxième partie y gagne ou y perd.
3. **Poursuivre n'a pas d'autre contenu que l'attente.** Un pas par clic, de plus en plus long. Le §11 le veut ainsi ; un playtest dira si quelqu'un va au-delà du cinquième pas.
4. **L'ordre réparé dépend de l'ordre du joueur.** Deux joueurs qui font la même Casse ne lisent pas le même ordre. Il ne dit pas non plus si un autre ordre aurait été plus rapide.
5. **Les textes** des trois incidents et de l'inventaire sont provisoires ([#23](https://github.com/DavidGiangiacomo/decroissance/issues/23)).
6. **Hors de ces deux fins :**
   - la fin Croissance et le mode qui y mène ([#19](https://github.com/DavidGiangiacomo/decroissance/issues/19)) ;
   - les décisions ([#18](https://github.com/DavidGiangiacomo/decroissance/issues/18)), qui entreront dans l'inventaire.
