# Le mode Croissance, et la troisième fin

Design proposé pour [l'issue #19](https://github.com/DavidGiangiacomo/decroissance/issues/19) et validé le 2026-11-11, puis réglé avec un banc d'essai. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition. Les deux autres fins sont dans [fins.md](fins.md).

## L'idée

Le bouton Relancer marche, et le jeu ne le punit pas sur le moment (§8). Qui ne le relâche jamais peut décider de ne plus l'arrêter. La partie bascule alors dans un autre jeu : un incrémental classique, généreux, où la carte se rejoue à l'envers. Dix minutes plus tard, l'écran se fige sur une Empreinte supérieure à celle du départ, et la partie se ferme sans un mot (§11).

Avant ce mode, relancer en continu ne faisait qu'un nombre qui double : +4 % par minute, une Capacité plafonnée à 900, et une Empreinte qui suivait le plancher jusqu'à 10¹⁶ en 52 relances.

Les six points validés :

1. **Un bouton explicite**, « Ne plus arrêter », plutôt qu'un basculement automatique.
2. **Les générateurs sont les sites de la carte**, qui se rallume et perd son vert.
3. **Aucune Casse nouvelle** dans ce mode.
4. **Dix minutes, sans que le joueur le sache.**
5. **Pas d'épilogue** : la partie se ferme sans un mot.
6. **Une musique synthétisée.**

## Les règles

- **Le basculement.** Une relance du joueur lancée moins de 30 s après la fin de la précédente s'enchaîne avec elle. À la troisième relance enchaînée, un second bouton apparaît à côté de Relancer : « Ne plus arrêter ». Il reste offert tant que cette relance court, et 30 s après. Il fait basculer la partie, après une confirmation, sans retour.
  - Il s'offre à n'importe quel acte, y compris quand tout est rendu, ou en poursuivant. Une partie close ne bascule plus.
  - Les relances du Conseil ne s'enchaînent pas.
- **Tout s'arrête.** Les chantiers en cours sont abandonnés, et tout le monde est réembauché : plus de Mains, plus personne à reconvertir. Plus rien ne se démantèle, ne se garde ni ne se rend. Il n'y a plus de relance à lancer : elle ne s'arrête plus.
- **L'Empreinte s'emballe.** La croissance passe de +4 à +500 % par minute dès le basculement : un chiffre de plus toutes les 28 s. Chaque niveau de chaque site en ajoute.
- **La Capacité n'a plus de plafond.** Elle vaut 30 par seconde au basculement, puis suit l'Empreinte, comme toujours : quatre fois plus à chaque chiffre gagné.
- **Les sites sont des générateurs.** Les trente sites de la carte, des actes I à IV, s'achètent en Capacité.
  - Un site fermé se rouvre : il repart au niveau 1, et la terre qu'il avait rendue est reprise.
  - Un site ouvert s'agrandit d'un niveau.
  - Chaque niveau coûte quatre fois le précédent.
  - Un bouton achète tout ce qui est payable, le moins cher d'abord.
- **Les paliers.** Tous les trois chiffres gagnés, la Capacité reçue double. Les trois premiers paliers ouvrent les sites des actes II, III et IV. Au deuxième, l'achat peut devenir automatique.
- **Chaque chiffre gagné** rejoue à l'envers la perte d'un chiffre : une note monte, l'écran se rouvre d'un cran, une région éteinte se rallume, et une couche sonore industrielle revient.
- **Aucun frottement.** Le Consentement monte de 20 points par minute, jusqu'à 100. Il n'y a ni délestage, ni pénurie, ni relance du Conseil, ni Casse nouvelle. La Casse déjà faite reste affichée.
- **La Terre rendue retombe**, site rouvert après site rouvert. Le jeu le montre sans le commenter.
- **La fin.** Dix minutes après le basculement, et pas avant que l'Empreinte ait dépassé celle du départ, l'écran se fige. Plus rien ne bouge ni ne répond, le son se coupe, les messages s'effacent. Il n'y a ni texte, ni écran de fin, ni épilogue. Le pied de page garde le rapport de session et de quoi recommencer.

## Entrée, carte, son

- **Le carton.** Au basculement, le jeu s'arrête 4 s sur un carton « Sans retour — Croissance ».
- **Le panneau.** Les autres panneaux se ferment. Il reste les ressources et un panneau « Croissance » : la croissance du moment, le prochain palier, le bouton « Tout acheter », la case de l'achat automatique, et les sites par acte, avec leur niveau et le prix du suivant.
- **Le compteur.** Au-delà de treize chiffres, l'Empreinte passe en notation scientifique : « 2,27·10²⁷ ».
- **La carte.** Les sites rouverts se rallument, et leur halo grandit avec leur niveau. Les actes II à IV apparaissent sur la carte avec leurs paliers, pour qui a basculé avant de les avoir atteints.
- **Le son.** Le trafic et les turbines reviennent à plein, puis le réseau, le fret et le poste, un par chiffre gagné. La nature se tait. La musique reprend (§8) : un arpège majeur, dont le tempo monte de quatre battements par minute à chaque chiffre gagné.

## Contenu

| Acte | Sites | Ouvert | Premier niveau | Croissance par niveau |
|---|---|---|---|---|
| I — L'inventaire | 8 | au basculement | 200 de Capacité | +0,55 %/min |
| II — Le réseau | 7 | au palier n° 1 | 75 000 | +0,75 %/min |
| III — Les gens | 8 | au palier n° 2 | 10 millions | +0,95 %/min |
| IV — Le legs | 7 | au palier n° 3 | 1,2 milliard | +1,2 %/min |

Les mesures et les gestes ne sont pas des générateurs.

## Écarts avec la proposition, et pourquoi

- **Aux paliers, seule la Capacité reçue double**, et non « tout ». Quand la croissance doublait aussi, l'Empreinte atteignait 10²⁵⁰ en 90 s : chaque palier rapprochait le suivant, sans fin. Avec la Capacité seule, un palier vaut un demi-niveau de plus par site, et le rythme reste lisible.
- **Chaque niveau coûte quatre fois le précédent**, et non une fois et demie comme dans le genre. La Capacité quadruple à chaque chiffre gagné : à ce prix, chaque site gagne environ un niveau par chiffre.
- **Une confirmation avant de basculer**, comme avant Clore et Poursuivre.
- **Le bouton s'offre dès le lancement de la troisième relance**, soit trois minutes après la première, et non une fois les trois relances écoulées.
- **La terre des gestes n'est pas reprise.** Un joueur qui bascule après avoir tout rendu garde 18 points de Terre rendue : les gestes ne sont pas des sites, et ne se rouvrent pas.
- **Une partie qui poursuit peut encore basculer.** La proposition disait « à n'importe quel acte » ; rien ne justifiait de fermer cette porte-là.

## Rythme mesuré

Mesures faites avec un banc d'essai : deux entrées dans le mode, et quatre façons d'acheter. `node tools/simulate.js croissance` joue la première ligne.

| Entrée | Façon d'acheter | Chiffres gagnés en dix minutes | Empreinte à l'écran figé | Terre rendue |
|---|---|---|---|---|
| Acte I, à 3 min | tout, tout le temps | 32 | 1,2·10⁴¹ | 0 % |
| Acte I, à 3 min | tout, toutes les 30 s | 31 | 1,1·10⁴⁰ | 0 % |
| Acte I, à 3 min | rien | 22 | 8,6·10³¹ | 0 % |
| Tout rendu, Empreinte à 43 | tout, tout le temps | 31 | 8,6·10³² | 18 % |
| Tout rendu, Empreinte à 43 | rien | 22 | 2,2·10²³ | 100 % |

- **Les paliers** tombent à 1 min 16, 2 min 33, 3 min 46, 4 min 53, 5 min 54, 6 min 47, 7 min 35, 8 min 19, 8 min 59 et 9 min 36 : un par minute au début, un toutes les 40 s à la fin.
- **Les chiffres** tombent toutes les 28 s au début, toutes les 12 s à la fin.
- **L'entrée ne change presque rien** : la croissance et la Capacité se comptent depuis le basculement.
- **La partie la plus courte dure 13 min** : trois minutes de relances, dix de croissance.
- `node tools/check.js` joue le mode comme une quatorzième partie. I1, I3 et I5 ne s'y appliquent pas ; I2 non plus, puisque c'est le jeu où le joueur devient puissant. I4 et I6 tiennent : la Casse ne baisse pas, et le bouton reste à l'écran.

## Points ouverts

1. **Acheter change peu.** Sans rien acheter, le joueur gagne 22 chiffres ; en achetant tout, 32. La croissance de départ pèse plus que les niveaux. C'est le prix d'un rythme qui ne s'emballe pas ; un playtest dira si acheter se sent assez.
2. **Après le deuxième palier, il n'y a plus rien à faire.** L'achat automatique s'offre à 2 min 33 ; il reste sept minutes à regarder. Le genre le veut ainsi, mais le §11 demande que ce soit « réellement agréable à jouer ».
3. **La musique et les sons n'ont pas été écoutés.** Ils sont synthétisés ; leur justesse est à juger à l'oreille ([#22](https://github.com/DavidGiangiacomo/decroissance/issues/22)).
4. **Relancer sans jamais basculer reste le chemin le plus rapide** pour tout démanteler : 1 h 16 contre 1 h 48 pour le joueur prudent, sans Casse. Le plancher est le seul prix. C'est une question d'équilibrage, à rapprocher de [#9](https://github.com/DavidGiangiacomo/decroissance/issues/9).
5. **Hors de cette proposition :**
   - la mise en scène de la relance du Conseil comme « pic de malaise » (§8), qui figure dans l'issue ;
   - le playtest dédié à ce mode ;
   - le hors-ligne : le mode n'avance pas quand le joueur n'est pas là.
