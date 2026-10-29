# Décroissance — design doc

*Concept n°3 du document « Douze concepts de jeux incrémentaux ».*
*Format visé : partie unique, 3 h à 3 h 30, pas de prestige. Références de cadrage : Universal Paperclips (l'arc, la fin sèche), Le démon de Maxwell (la courbe adverse), Frostpunk (l'arbitrage moral sans bonne réponse).*

---

## 1. Thèse

Un incrémental classique demande : *jusqu'où peux-tu monter ?*
Celui-ci demande : *jusqu'où peux-tu descendre sans casser quoi que ce soit ?*

Trois inversions, et elles sont mécaniques, pas décoratives :

- **Le compteur maître descend.** L'Empreinte part de 1,0·10⁹ et doit rejoindre son plancher. L'événement de récompense n'est pas un chiffre gagné, c'est **un chiffre perdu**.
- **L'outil est la matière.** On démantèle l'industrie avec l'énergie de l'industrie. Chaque fermeture réduit la capacité de fermer la suivante. Le jeu devient plus dur à mesure qu'il avance — exactement l'inverse de la courbe de puissance du genre.
- **La croissance reste disponible.** Un bouton *Croissance* est visible dès la première minute, il fonctionne réellement, il donne l'exponentielle et le plaisir attendus. Il est le vrai adversaire du jeu, et il ne triche jamais.

Ce qui monte, et c'est la seule chose : **la Terre rendue**. Lentement, linéairement, sans multiplicateur. C'est la barre de progression réelle du jeu.

**Objectif rare dans le genre : finir à zéro sans casse.** Et le jeu s'arrangera pour qu'aucun des deux ne soit tout à fait atteignable.

---

## 2. Fiction

On hérite. Pas de conquête, pas de fondation : une passation. Un pays industriel de taille moyenne, une géographie fictive mais plausible (côte, fleuve, bassin minier, deux métropoles), et un mandat d'une durée non précisée pour le démanteler proprement.

Le joueur n'a ni nom ni parti. Il n'a qu'une console d'inventaire et un pouvoir d'arbitrage. Personne dans le jeu ne dit jamais que la décroissance est une bonne idée : c'est le point de départ, pas la thèse. Ce qui est en jeu est la **manière**.

Ce que la partie finit par établir (arc en §10) : le zéro n'existe pas. Sous un certain seuil, il reste une charge irréductible — des combustibles usés, des sols, des digues, des molécules — qui ne se démantèle pas et qui se **garde**. Le dernier acte fait basculer le verbe du jeu de *fermer* à *transmettre*. On ne termine pas un démantèlement, on institue une garde et on la lègue à des gens qui n'existent pas encore.

Note de ton : ni effondrement esthétique, ni utopie solaire. Le registre est administratif et concret — des mégawatts, des hectares, des trains de nuit, des listes de personnes à reclasser. La fin est forte parce qu'elle est comptable.

---

## 3. Boucle de jeu

**Boucle courte (10–40 s)**

```
Choisir un site sur la carte
      ↓ engager  Capacité (K) + Mains (M)
   Chantier (durée réelle, 20 s → 6 min)
      ↓
   Empreinte (E) baisse
      ↓ effets simultanés
 +Matériaux (K ponctuel)  +Terre rendue (T)
 −Capacité/s (le site produisait)   +Déplacés (dette en M)
      ↓ si l'ordre était mauvais
   Coupure → Casse (X, irréversible) → −Consentement
```

**Boucle moyenne (5–15 min)** — Régler deux rapports, jamais empiler. Le rapport **K/M** (une machine sans équipe ne démonte rien, une équipe sans énergie non plus) et le rapport **débit/Consentement** (aller vite consomme l'adhésion, aller lentement laisse l'Empreinte recroître). Le joueur ne cherche pas un optimum, il tient un équilibre qui se dégrade.

**Boucle longue (30–60 min)** — Un acte. Chaque acte retire au joueur un moyen dont il avait pris l'habitude : l'électricité abondante, puis la main-d'œuvre disponible, puis le carburant, puis l'idée même de terminer.

---

## 4. Ressources

| Ressource | Rôle | Trajectoire sur la partie | Affichage |
|---|---|---|---|
| **Empreinte** (E) | ce qui reste à démanteler | 1,0·10⁹ → plancher ≈ 2,4, un seul chiffre | toujours en chiffres pleins, jamais en notation scientifique |
| **Capacité** (K) | énergie, machines, capitaux mobilisables | dérivée de E : décroît avec elle | flux + stock |
| **Mains** (M) | travail humain qualifié disponible | 0 → ~40 000, plafond dur | entier, à échelle humaine |
| **Terre rendue** (T) | hectares, cours d'eau, air | 0 → 100 %, linéaire | pourcentage + carte |
| **Casse** (X) | dommages irréversibles causés | 0 souhaité, ne redescend jamais | compteur permanent, en haut à droite |
| **Consentement** (Co) | adhésion de la population | 100 % → variable | jauge |

**Règle structurante n°1** — `K/s = K₀ × (E/E₀)^0,6`. La capacité vient de ce qu'on détruit. Sublinéaire : au début, on démantèle 20 % de l'Empreinte avec une abondance confortable ; les derniers 2 % se font quasiment à la main. **La fin de partie est le moment le plus contraint, pas le plus puissant.**

**Règle structurante n°2** — E possède **son propre taux de croissance** `g`, positif au lancement (+2,4 %/min effectif). Tant que `g > 0`, tout démantèlement est englouti. L'acte I n'est pas de faire baisser le nombre : c'est de le faire **s'arrêter de monter**. C'est le tutoriel, et il apprend l'inversion en huit minutes sans une ligne d'explication.

**Règle structurante n°3** — les Mains ne sont jamais exponentielles. On ne double pas une équipe de soudeurs en achetant un upgrade ; on reconvertit des gens, ça prend du temps réel et ça consomme du Consentement. Le plafond humain est le vrai goulot de la seconde moitié.

---

## 5. Chantiers (les générateurs inversés)

Il n'y a pas de bâtiments à empiler. Il y a **une carte de sites**, chacun démantelable une seule fois, chacun avec un profil de coût et de conséquences.

| # | Type de site | E retirée | Coût K | Coût M | Durée | Récupération | Risque | Acte |
|---|---|---|---|---|---|---|---|---|
| 1 | **Publicité, crédit, obsolescence** | −3,0·10⁷ | faible | nul | 30 s | — | aucun | I |
| 2 | **Surcapacité** (aviation loisir, SUV, data centers spéculatifs) | −8,0·10⁷ | faible | faible | 45 s | +K | Co −4 | I |
| 3 | **Cimenteries, chimie lourde** | −1,2·10⁸ | moyen | moyen | 2 min | +++K (ferraille) | pollution si bâclé | II |
| 4 | **Centrales fossiles** | −2,0·10⁸ | moyen | élevé | 3 min | +K | **coupure** si ordre faux | II |
| 5 | **Logistique, port, autoroutes** | −9,0·10⁷ | élevé | élevé | 3 min | +K | isole des sites | III |
| 6 | **Agro-industrie** | −1,1·10⁸ | faible | **très élevé** | 5 min | +T massif | famine si trop vite | III |
| 7 | **Le réseau lui-même** | −6,0·10⁷ | élevé | moyen | 4 min | — | −K/s permanent | IV |
| 8 | **Nucléaire** | non démantelable | — | — | — | — | — | IV |
| 9 | **Sols, décharges, PFAS** | −4,0·10⁷ | nul | faible | **temps réel seul** | +T | — | IV–V |

*(Valeurs de première passe, à retuner sur prototype — voir invariants §9.)*

Trois sites méritent un mot :

**Le réseau (7)** est le premier chantier qui coûte plus qu'il ne rapporte, définitivement. Le joueur doit démonter son propre outil. Après lui, plus aucune montée en puissance n'est possible : c'est le point de non-retour du jeu, et il est choisi volontairement par le joueur, pas déclenché par le récit.

**Le nucléaire (8)** n'apparaît jamais dans la liste des chantiers. Il apparaît dans un panneau qui n'existait pas avant l'acte IV : **la Garde** (§7).

**Les sols (9)** ne s'accélèrent avec rien. Aucune décision, aucun multiplicateur, aucune main supplémentaire ne réduit la durée d'une phytoremédiation. Le seul intrant est le temps réel — y compris hors ligne. C'est la seule chose du jeu qui progresse mieux quand le joueur n'est pas là.

---

## 6. L'ordre — la mécanique centrale

La carte n'est pas une liste, c'est un **graphe de dépendances**. Chaque site en alimente d'autres : électricité, eau, pièces, emplois, nourriture.

- Fermer un site dont un hôpital, une station de pompage ou une filière alimentaire dépend encore → **coupure** → Casse, irréversible, chiffrée en gens.
- Fermer dans le bon ordre → la dépendance s'est éteinte d'elle-même, le chantier est propre, et il **libère** des Mains et des matériaux pour le suivant.

Le graphe est toujours lisible à l'écran, jamais caché : le jeu ne teste pas la mémoire, il teste la **patience**. La bonne séquence est presque toujours plus lente que la séquence intuitive, et le joueur la voit. C'est là que se joue toute la tension.

À chaque acte, le graphe se recompose : les liens disparus laissent place à des liens qu'on ne voyait pas (les emplois, puis les recettes fiscales, puis les savoir-faire). **Ce qui reste est de plus en plus tenu.**

---

## 7. Décisions et Garde (l'arbre d'upgrades, inversé)

### Décisions

Pas d'améliorations empilables. **Des décisions ponctuelles, irréversibles, mutuellement exclusives par branche.** Chacune ouvre un moyen et en ferme un autre.

| Branche | Décision A | Décision B (exclusive) |
|---|---|---|
| Énergie | **Rationnement** — +35 % K utile, Co −15 | **Marché** — K stable, Casse répartie sur les plus pauvres, Co intact |
| Travail | **Réquisition** — M ×1,8 immédiat | **Volontariat** — M ×1,25, mais Co +10 et pas de retour de bâton |
| Dette | **Amnistie** — libère K, plus aucun financement extérieur | **Honorer** — K contraint pendant 40 min, crédibilité en acte IV |
| Terre | **Retour à la terre** — T ×1,4, M −30 % | **Rewilding** — T ×1,1 sans coût humain, mais aucun Consentement gagné |
| Information | **Tout publier** — Casse visible de tous : Co −20 immédiat, +2 %/min ensuite | **Gérer** — Co stable, effondrement brutal si une coupure survient |

**Plafond dur : aucun cumul de multiplicateurs ne peut dépasser ×2 sur toute la partie.** Le joueur n'aura jamais de moment de puissance. C'est un invariant (§9, I2), pas un réglage.

### La Garde (acte IV)

Un panneau apparaît. On y affecte **définitivement** de la Capacité et des Mains à la surveillance perpétuelle de ce qui ne se démantèle pas. Ces ressources ne reviennent jamais dans l'économie du jeu.

C'est l'anti-upgrade : le seul « achat » du genre où l'on paie pour perdre du débit à jamais. Chaque garde instituée porte une durée affichée en années — 300, 10 000, 100 000 — et un coût récurrent qui continue de courir après la fin de la partie.

Sous-doser la Garde augmente la Casse **après** l'écran de fin, dans l'épilogue. Le jeu ne le dit pas avant.

---

## 8. Le bouton Croissance

En haut de l'écran, dès la première seconde, un bouton lisible : **Relancer**.

- Il fonctionne. Vraiment. Il rend `g` positif, K explose, les chantiers deviennent triviaux, les compteurs montent, la notation scientifique apparaît, la musique reprend.
- Il est **optimal à court terme** dans à peu près toutes les situations. Relancer 4 minutes pour financer trois chantiers difficiles est un bon calcul, et le jeu ne le punit pas immédiatement.
- Chaque relance rehausse le plancher irréductible de façon permanente : il double. Trois relances le font passer à deux chiffres, et coûtent donc un chiffre perdu sur la partie.

Trois usages, trois lectures :

1. **Jamais** — partie la plus dure, plancher le plus bas.
2. **Ponctuel** — l'usage attendu, l'arbitrage central du jeu.
3. **Continu** — le jeu devient un incrémental classique, agréable, gras, avec des e47 et des multiplicateurs partout. Il se termine autrement (§11).

**Et si le Consentement tombe sous 20 %, quelqu'un d'autre appuie sur le bouton.** Le joueur voit son propre écran repartir à la hausse sans l'avoir décidé. C'est le pic de malaise du jeu, l'équivalent structurel de la Contradiction dans *La langue morte*.

---

## 9. Courbes, invariants, rythme

### Rythme cible

| Acte | Temps cumulé | Empreinte | Chiffres perdus dans l'acte | Terre rendue | Ce qu'on perd |
|---|---|---|---|---|---|
| I — L'inventaire | 0–20 min | 1,0·10⁹ → 6·10⁸ | 1 | 4 % | l'illusion que c'est simple |
| II — Le réseau | 20–55 min | 6·10⁸ → 1,1·10⁷ | 1 | 22 % | l'électricité abondante |
| III — Les gens | 55–110 min | 1,1·10⁷ → 6·10⁴ | 3 | 55 % | la main-d'œuvre disponible |
| IV — Le legs | 110–170 min | 6·10⁴ → 60 | 3 | 82 % | l'idée de terminer |
| V — Rendre | 170–205 min | 60 → plancher ≈ 2,4 | 1 | 100 % | le reste |

Neuf chiffres perdus au total, un toutes les 22 min environ : vers 12, 34, 56, 78, 100, 122, 144, 166 et 188 min. Les relances en retirent un, environ toutes les trois.

### Invariants d'équilibrage

À ne jamais casser au retuning :

- **I1** — Un chiffre perdu toutes les 20 à 25 min en moyenne, **jamais plus de 25 min sans**. Depuis 1,0·10⁹, on ne peut perdre que neuf chiffres : sur 205 min, la moyenne ne descend pas sous 20 min. C'est l'événement de récompense principal, il doit être rythmé comme un déblocage d'upgrade.
- **I2** — Aucun multiplicateur permanent ne dépasse ×2, cumul compris. Le joueur ne devient jamais puissant.
- **I3** — Le coût marginal d'un point d'Empreinte croît de façon monotone du début à la fin. **La courbe de difficulté du jeu monte quand la courbe du genre descend.**
- **I4** — La Casse est irréversible, toujours affichée, jamais rattrapable. Aucune décision ne l'efface.
- **I5** — **La Terre rendue progresse de façon quasi linéaire en temps réel.** C'est la seule courbe linéaire du jeu et la seule que le joueur ressent vraiment. Tout le reste s'équilibre autour d'elle.
- **I6** — Le bouton Croissance reste visible et fonctionnel de la première à la dernière minute.

I5 est l'invariant maître, comme dans *La langue morte* : la vraie barre de progression n'est pas un nombre, c'est la carte qui verdit et le son qui change (§12). Si elle avance irrégulièrement, le jeu paraît calé même quand l'Empreinte tombe.

### Hors-ligne

Inversion complète de la convention du genre :

- **Démantèlement : 0 %.** Rien ne se démonte sans personne pour le décider.
- **Dépollution et régénération : 100 %, plafonné à 12 h.** Ce sont les seuls processus qui n'ont pas besoin du joueur.
- **Consentement : dérive lente vers sa valeur d'équilibre.** Une partie laissée en plan revient parfois plus calme, parfois pas.

Le message est mécanique, jamais énoncé : *ce qui répare marche mieux quand on n'y touche pas.*

---

## 10. Arc narratif — 5 actes

**Acte I — L'inventaire.** L'écran affiche 1,0·10⁹ et **le nombre monte**. Le joueur ferme des sites et le nombre continue de monter. Premier vrai objectif du jeu : amener `g` à zéro. Quand le compteur se stabilise pour la première fois — pas quand il baisse, quand il *s'arrête* — le jeu marque un temps d'arrêt de trois secondes. C'est la première récompense, et elle est en creux.

**Acte II — Le réseau.** Le graphe de dépendances s'ouvre. Première coupure quasi certaine, première Casse, premier compteur qui ne redescendra jamais. Le jeu ne commente pas. Deuxième chiffre perdu à l'Empreinte, vers la 35ᵉ minute : la carte s'éteint sur toute une région et une couche sonore disparaît.

*Prototype : l'acte II tel que validé et réglé est décrit dans [acte-2.md](acte-2.md).*

**Acte III — Les gens.** Les Mains deviennent le goulot. Le panneau de reconversion s'ouvre, avec des durées en semaines fictives et des noms. Le Consentement devient volatil. C'est l'acte où le bouton Croissance cesse d'être une curiosité et devient une solution raisonnable.

*Prototype : l'acte III, proposé et réglé, est décrit dans [acte-3.md](acte-3.md).*

**Acte IV — Le legs.** Le compteur ralentit brutalement, et le joueur comprend pourquoi : sous 6·10⁴, l'essentiel de ce qui reste ne se démantèle pas. La Garde s'ouvre. Le verbe change. On passe des chantiers aux siècles, et le jeu affiche pour la première fois des durées qui dépassent celles de toute civilisation connue.

**Acte V — Rendre.** Capacité résiduelle quasi nulle, chaque geste compte, tout est manuel. La carte est presque verte. Le compteur descend par dizaines, puis par unités. Et il s'arrête sur le plancher, qui n'est pas zéro et ne le sera jamais.

---

## 11. Fins

Sur l'écran final, l'Empreinte est bloquée au plancher. Trois issues, aucune présentée comme la bonne, aucun score.

- **Clore** — sceller. L'écran énumère ce qui reste : chaque garde, sa durée, son coût annuel, et la Casse figée, en gens. Puis la carte, verte, sans interface. Le jeu ne remercie pas.
- **Poursuivre** — refuser le plancher. Le jeu ne se termine pas. Chaque point d'Empreinte coûte le double du précédent, la courbe devient asymptotique, on peut y passer des heures et ne jamais atteindre zéro. Aucun écran de fin n'existe pour cette branche.
- **Croissance** — accessible à tout moment si l'on a laissé le bouton faire son travail. Dix minutes d'incrémental classique, généreux, avec les multiplicateurs, les e47 et tout le confort du genre. Puis l'écran se fige sur une Empreinte supérieure à celle du début, et la partie se ferme sans un mot. **Cette fin doit être réellement agréable à jouer**, sinon l'argument du jeu ne vaut rien.

**Épilogue (après *Clore*)** — « L'inventaire ». Quinze minutes sans mécanique : la liste de tout ce qui a été fait, dans l'ordre, avec en regard **l'ordre optimal que le joueur n'a pas suivi** et le nombre de coupures qu'il aurait évitées. Y compris les erreurs qu'il n'a jamais su avoir commises. Coût de production quasi nul (les données existent déjà), valeur émotionnelle importante.

---

## 12. Interface, son, production d'assets

**Écran unique**, trois zones :

- **Gauche (60 %) — la carte.** Sites en trois états : *actif* (chaud, animé), *éteint* (gris, inerte, encore là), *rendu* (vert, la végétation revient par étapes visibles). Les liens du graphe sont dessinés et s'éteignent avec les sites.
- **Haut — le compteur.** L'Empreinte en très grand, en chiffres pleins. **La perte d'un chiffre est une animation dédiée** : le nombre se recentre, l'écran se resserre d'un cran. C'est le seul moment spectaculaire du jeu, et il arrive neuf fois au plus, une fois de moins environ toutes les trois relances.
- **Droite (40 %) — chantiers, décisions, Mains, Garde, Casse.** La Casse est en permanence à l'écran, en haut, sans possibilité de la masquer.

**Le son est la vraie barre de progression.** Une nappe composée de couches — trafic, turbines, alarmes, ventilation, fret — et chaque chiffre perdu **retire une couche** et en ajoute une autre : vent, oiseaux, eau, voix. En fin de partie, il ne reste que l'ambiant. Un joueur qui coupe le son perd la moitié du jeu ; c'est assumé.

**Coût de production réel** : la carte et le graphe (≈ 60 sites, données structurées, pas d'art lourd), et surtout **le design sonore en couches** — 8 à 10 couches industrielles, autant de naturelles, avec crossfades. Le budget du jeu est le son, pas le texte ni le code. Écriture : ~1 200 mots seulement (descriptions de sites, décisions, épilogue), soit trois fois moins que *La langue morte*.

---

## 13. Risques

| | Risque | Réponse |
|---|---|---|
| R1 | **Le jeu passe pour un tract.** Le sujet est politique, la mécanique risque d'être lue comme une morale. | Le bouton Croissance fonctionne réellement et n'est jamais puni sur le moment ; la Casse peut venir de la fermeture autant que du maintien ; aucun texte du jeu ne dit que la décroissance est souhaitable. Le jeu simule un mandat, il ne défend pas une thèse. |
| R2 | **Des nombres qui descendent ne produisent pas de dopamine.** | Trois réponses cumulées : l'événement du chiffre perdu (I1), la couche sonore retirée, et la Terre rendue linéaire (I5). Si ces trois-là ne suffisent pas, le concept ne tient pas — c'est précisément ce que teste le MVP. |
| R3 | **La fin la plus dure = frustration en fin de partie**, au moment où les joueurs abandonnent le plus. | La difficulté finale est en *gestes*, jamais en *attente* : jamais plus de 90 s sans action possible, aucun mur de temps réel supérieur à 4 min en acte V. |
| R4 | **Le graphe de dépendances devient un casse-tête punitif.** | Il est toujours visible, jamais mémoriel ; la bonne séquence est calculable à vue ; une coupure coûte de la Casse mais **jamais de la progression**. |
| R5 | **Le plancher irréductible frustre l'objectif annoncé** (« finir à zéro »). | Il doit être *révélé* comme le sujet du jeu à l'acte IV, pas subi comme un mur. Le pitch initial promet zéro : c'est le joueur qui découvre que la promesse était fausse, et c'est le retournement principal du récit. |

---

## 14. MVP falsifiable

Un week-end, un seul écran, acte I seulement :

- 8 sites, graphe minimal (3 dépendances), Empreinte affichée en chiffres pleins **et en hausse au lancement**
- Objectif unique : ramener `g` à zéro, puis perdre le premier chiffre
- Deux couches sonores retirées, deux ajoutées
- Une seule coupure possible, avec la Casse qui apparaît et ne redescend plus
- Bouton Croissance présent et fonctionnel

**Le test** : est-ce que l'instant où le compteur cesse de monter, puis l'instant où il perd son premier chiffre, font quelque chose au joueur ? Si ces deux moments ne provoquent rien, le concept ne tient pas et les cinq actes ne le sauveront pas. Tout le reste du document est le développement de ces deux sensations.

Test secondaire, presque aussi important : **combien de fois le testeur appuie sur Croissance en 20 minutes.** Zéro fois = le bouton est mal calibré (pas assez tentant). Dix fois = le jeu n'a pas d'autre stratégie viable.

---

## 15. Notes d'implémentation

- Même socle que le prototype *Langue morte* : tick à 10 Hz, état en objet plat, sauvegarde JSON en `localStorage`.
- `E` en flottant ; **la détection de perte de chiffre se fait sur `Math.floor(Math.log10(E))`**, comparée d'un tick à l'autre — c'est ce qui déclenche l'animation, la couche sonore et la sauvegarde d'un jalon.
- Le graphe en liste d'adjacence `{ site_id, alimente[], alimenté_par[], état }` ; la validité d'un chantier est un simple parcours des dépendances encore actives. La « bonne séquence » de l'épilogue est un tri topologique calculé à la fin, pas prévu à l'avance.
- Les chantiers sont des tâches en file avec durée réelle, coût engagé à l'ouverture, effets appliqués à la clôture (pas de remboursement en cas d'annulation).
- Son : une couche = une boucle audio indépendante, volume piloté par le nombre de chiffres restants. Précharger, crossfade de 2 s.
- Hors-ligne : ne simuler que les processus de la classe `régénération`, avec plafond à 12 h, au chargement.

---

## À trancher ensuite

1. **Géographie fictive ou réelle ?** Nommer de vraies centrales ancre le propos mais expose le jeu à la lecture pamphlétaire (R1) et à des ennuis. Recommandation : pays fictif, sites plausibles, aucune référence nommée. **Tranché** : pays fictif, l'Ostrane.
2. **Valeur du plancher irréductible** et son barème de rehaussement par relance. C'est le paramètre qui décide de tout l'équilibrage de l'acte V. **Tranché** (issue #4) : plancher ≈ 2,4, doublé à chaque relance.
3. **Le bouton Croissance : visible dès t=0 ou débloqué à l'acte II ?** Dès t=0 est plus fort thématiquement, plus risqué en tutoriel.
4. **Prototyper le MVP §14 avant toute autre chose** — et le tester à côté du MVP *Langue morte* pour choisir lequel des deux concepts va au bout. **Fait** : MVP joué, go pour Décroissance le 2026-10-24 (issue #13).
