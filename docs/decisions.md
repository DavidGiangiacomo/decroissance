# Les décisions

Design proposé pour [l'issue #18](https://github.com/DavidGiangiacomo/decroissance/issues/18) et validé le 2026-11-24, puis réglé au banc. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition.

## L'idée

Le §7 refuse les améliorations empilables. Il veut des décisions ponctuelles, irréversibles, exclusives par branche : chacune ouvre un moyen et en ferme un autre. Le jeu en compte cinq branches de deux décisions. Chaque branche s'ouvre à l'acte où sa ressource fait goulot.

Les cinq points validés :

1. **Les ouvertures.**
   - Énergie et Dette à l'acte II, Travail et Information à l'acte III, Terre à l'acte IV.
   - Une branche se ferme avec son acte. Sans décision, rien ne change.
2. **Les effets du tableau**, réglés ensuite au banc. Ils comprennent trois lectures du §7 :
   - l'avance des créanciers, pour la « crédibilité » d'Honorer ;
   - le retour de bâton de la Réquisition, chiffré ;
   - le Consentement du Retour à la terre, puisque le Rewilding est décrit par « aucun Consentement gagné ».
3. **Le plafond ×2 (I2) vaut par ressource**, places de formation comprises. Travail agit donc une seule fois, sur le stock de Mains.
4. **L'interface.**
   - Une section en haut de la colonne, deux cartes et une confirmation.
   - Les prix et les comptes à rebours sont affichés.
   - Les textes restent neutres (R1).
5. **Les bots décident selon leur profil**, et peuvent aussi jouer sans décision.

## Les règles

- **Quand.**
  - Une branche s'offre dès l'ouverture de son acte, et tant qu'elle n'est pas tranchée.
  - Aucune ne s'offre à l'acte I, le tutoriel, ni à l'acte V, où tout est déjà joué.
  - Rien ne s'offre en mode Croissance, ni après Clore.
- **Décider.**
  - Une décision ne coûte rien à prendre : son prix est dans ses effets.
  - Elle demande une confirmation, puisqu'elle ne se reprend pas. L'autre décision de la branche se ferme.
  - Le journal la note en gras, avec ses effets.
- **Ne pas décider.** À l'ouverture de l'acte suivant, le journal dit : « Le moment est passé : Énergie, sans décision. » Dans l'inventaire, cette ligne reste dans l'acte où la branche était offerte.
- **Ce que disent les cartes (R4).**
  - Chaque carte donne ses effets avec les nombres du moment. Pour la Réquisition, par exemple : « Mains ×1,8 tout de suite : +3 200, prises parmi les 3 200 personnes qui attendent une formation ».
  - Une décision qui ferait passer le Consentement sous 20 % le dit, comme les cartes de chantier. Le retour de bâton de la Réquisition est compté au moment où il tombera.
- **Les décisions prises** restent listées sous les ressources, avec ce qu'elles laissent à venir :
  - la Capacité contrainte, et pour combien de temps encore ;
  - l'avance de l'acte IV ;
  - le compte à rebours du retour de bâton ;
  - le scandale en attente.
- **Le prix des chantiers suit les décisions.**
  - Avec le Marché, l'aperçu d'un délestage ne compte plus de Consentement, et une Casse 1,5 fois plus lourde.
  - Avec Gérer, la première Casse compte le scandale, « dont 30 de scandale (Gérer) ». Cela vaut aussi pour l'aperçu d'une pénurie à l'acte III.
- **Hors ligne,** les effets continus valent aussi :
  - le retour plus rapide vers 70 % ;
  - la terre qui repousse plus vite ;
  - le Consentement que la terre regagnée rapporte.
- **En mode Croissance,** les branches encore ouvertes disparaissent, et les effets acquis cessent : le mode a ses propres règles.
- **Les traces.**
  - Le rapport de session donne une ligne « Décisions : Énergie, Rationnement à 11 min 50 ; Dette, aucune ; … ».
  - La chronologie et l'inventaire placent chaque décision dans son acte, avec le retour de bâton, le scandale et l'avance des créanciers.
  - Le panneau « Ce qui le fait bouger » compte deux causes nouvelles : « décisions » et « terre rendue ».

## Contenu

| Branche | Acte | Décision | Effets | Texte de la carte |
|---|---|---|---|---|
| Énergie | II | Rationnement | Capacité +35 % jusqu'à la fin de la partie ; Consentement −10 tout de suite | Des quotas d'électricité par foyer et par entreprise, fixés par l'État. |
| | | Marché | Les délestages et les privations ne coûtent plus de Consentement ; leur Casse est 1,5 fois plus lourde | Le prix de l'électricité suit la rareté. Qui ne peut plus payer se coupe lui-même. |
| Dette | II | Amnistie | Capacité +25 % jusqu'à la fin de la partie ; plus aucun financement extérieur | L'Ostrane cesse de rembourser ses créanciers. |
| | | Honorer | Capacité −25 % pendant 40 min ; à l'ouverture de l'acte IV, 500 de Capacité, au-delà du plafond | L'Ostrane rembourse, à chaque échéance. |
| Travail | III | Réquisition | Mains ×1,8 tout de suite, prises parmi ceux qui attendent une formation ; 10 min plus tard, Consentement −20 | Ceux qui attendent une formation sont affectés aux chantiers, sans formation. |
| | | Volontariat | Mains ×1,25 tout de suite, prises de la même façon ; Consentement +10 ; pas de retour de bâton | Ceux qui le veulent rejoignent les chantiers sans attendre leur formation. |
| Information | III | Tout publier | Consentement −20 tout de suite ; ensuite, il revient vers 70 % de 1 point par minute au lieu de 0,6 | Chaque personne touchée est comptée et publiée. |
| | | Gérer | L'usure due à l'attente et aux chantiers menés de front est divisée par deux ; à la première Casse, scandale : Consentement −30, et l'usure redevient normale | La communication accompagne chaque chantier. |
| Terre | IV | Retour à la terre | Mains −30 % tout de suite : ces gens restent sur la terre ; la terre repousse 1,4 fois plus vite ; chaque point de Terre rendue rapporte 0,5 point de Consentement | Des familles reprennent les terres rendues, pour les cultiver. |
| | | Rewilding | La terre repousse 1,1 fois plus vite ; aucun coût humain, aucun Consentement gagné | Les terres rendues sont laissées à elles-mêmes. |

- **« Mains » compte les Mains engagées.** Une décision de Travail prend au plus ceux qui attendent une formation, et jamais au-delà du plafond humain de 40 000. Ceux qu'elle prend ne passent pas par la formation : ils ne rapportent donc pas le point qu'un lot achevé rend.
- **Ceux qui partent cultiver,** avec le Retour à la terre, comptent parmi les gens restés sur la terre rendue, comme les équipes de l'acte V.
- **Le scandale vient de toute Casse nouvelle** : un délestage, une privation, une pénurie ou une pollution. Une Casse déjà faite au moment de décider ne compte pas.

## Le plafond ×2 (I2)

« Toutes ressources confondues » aurait interdit toute décision, puisque les centres de formation doublent déjà les places. Le plafond vaut donc par ressource. `tools/check.js` le mesure sur le moteur, pour la combinaison la plus forte :

| Ressource | Multiplicateur le plus fort | D'où il vient |
|---|---|---|
| Places de formation | ×2 | les centres de formation |
| Capacité par seconde | ×1,69 | Rationnement et Amnistie |
| Retour du Consentement vers 70 % | ×1,67 | Tout publier |
| Usure du Consentement, à l'envers | ×2 | Gérer |
| Repousse de la terre | ×1,4 | Retour à la terre |

Réquisition et Volontariat ajoutent des Mains une seule fois, sur le stock. Ce n'est pas un multiplicateur permanent, et les Mains sont déjà à ×2.

## Écarts avec la proposition, et pourquoi

- **Rationnement coûte 10 points de Consentement, et non 15.**
  - À −15, le bot prudent qui prend ses cinq décisions avait une relance du Conseil à l'acte II, au lieu d'aucune. Cette relance lui rendait 15 points, et l'acte III perdait sa tension : 26 min au lieu de 40, et un Consentement jamais sous 29 %.
  - À −10, le prudent finit sans aucune relance du Conseil, et son Consentement descend à 21 % à l'acte III.
- **L'avance des créanciers dépasse le plafond de 900.** Sinon, le plafond la ramenait à 900 au tick suivant. Au-delà du plafond, la Capacité ne monte plus, mais rien ne la fait redescendre.
- **Le bot lent lance un chantier dans la même réaction qu'un lot de formation.**
  - Avant, chaque lot repoussait son chantier suivant d'un temps de réaction : à 45 s, un bot qui avait des gens à former ne lançait presque plus rien. C'était la principale cause des écarts « joueurs très lents » d'I1.
  - Sans décision, le bot corrigé à 45 s passe au plus 22 min 58 (prudent), 23 min (pressé) et 16 min 55 (rapide) sans chiffre perdu. Avant, c'était 24 min 53, 33 min 31 et 30 min 02.
  - Celui qui relance une fois, à 45 s, passe encore 25 min 35 sans chiffre perdu, au dernier chiffre de l'acte V.
- **Gérer reste à ×0,5 sur l'usure.** À ×0,75, avec Rationnement à −10, le joueur qui relance une fois passait 28 min 46 sans chiffre perdu, à 30 s de réaction.

## Ce que disent les bots

`node tools/simulate.js <profil> <réaction>` fait décider les bots selon leur profil, dès que la branche s'ouvre :
- le prudent, le rapide et celui qui relance une fois prennent Rationnement, Honorer, Volontariat, Gérer et le Retour à la terre ;
- le pressé prend le Marché, l'Amnistie, la Réquisition, Tout publier et le Rewilding ;
- le prudent attend, pour décider, d'avoir la marge de Consentement que la décision coûte.

`DECISIONS=aucune` rejoue la même partie sans décision.

| Joueur | Réaction | Sans décision : fin, relances du Conseil, Casse | Avec ses décisions : fin, relances du Conseil, Casse | Consentement des décisions | Consentement de la terre | Plancher |
|---|---|---|---|---|---|---|
| Prudent | 10 s | 2 h 00, 1, 0 | 1 h 54, 0, 0 | 0 | +23,7 | 2,4 |
| Prudent | 30 s | 2 h 01, 2, 0 | 2 h 06, 0, 0 | 0 | +24,0 | 2,4 |
| Pressé | 10 s | 1 h 50, 4, 4 917 | 1 h 51, 4, 6 211 | −40 | — | 38,4 |
| Pressé | 30 s | 2 h 03, 4, 4 917 | 2 h 02, 3, 6 601 | −40 | — | 19,2 |

La Casse est celle de la clôture, sans les gardes réduites.

Décision par décision, prise seule par le bot à 10 s :

- **Prudent :**
  - Rationnement allonge son acte III à 55 min. Son Consentement, plus bas, le fait attendre, et il passe 30 min 47 sans chiffre perdu.
  - Honorer allonge l'acte II de 4 min et raccourcit l'acte III de 17.
  - Volontariat le fait passer 28 min 25 sans chiffre perdu.
  - Gérer lui évite sa relance du Conseil.
  - Le Retour à la terre lui laisse 861 Mains à la fin, au lieu de 2 730, et fait faire 3 gestes par les habitants.
- **Pressé :**
  - le Marché fait passer sa Casse de 4 917 à 6 515, et ses relances du Conseil de 4 à 2 ;
  - la Réquisition les porte à 7, avec un Consentement à 7 % ;
  - Tout publier fait tomber le Consentement à 6 % à l'acte III.

Les décisions se répondent d'un acte à l'autre :
- **Le Retour à la terre prend les Mains du renfort.** Les bots prudents finissent avec 121 Mains : aucune garde réduite ne peut plus devenir pleine, et l'épilogue leur compte 2 100 personnes. Sans décision, le prudent à 10 s pouvait encore renforcer les galeries et les digues, et n'en payait que 1 200.
- **Le Marché fait la Casse du pressé :** 6 211 personnes à la clôture, contre 4 917 sans décision.

## Vérification

- `node tools/test.js` vérifie, entre autres :
  - les ouvertures et la fermeture des branches ;
  - chaque effet, et le prix annoncé contre le prix payé ;
  - le retour de bâton, le scandale et l'avance au-delà du plafond ;
  - la sauvegarde ;
  - le rapport et l'inventaire.
- `node tools/check.js` mesure I2 par ressource, et fait jouer ses quatorze parties avec les décisions des bots. Trois écarts connus restent sur I1, tous de moins de 2 min :
  - le pressé à 30 s (25 min 45) et à 45 s (26 min 39), au passage de l'acte III à l'acte IV ;
  - celui qui relance une fois à 45 s (25 min 35), au dernier chiffre.

## Points ouverts

1. **Gérer ne coûte rien à qui ne fait pas de Casse,** et le Marché ne lui rapporte rien. Le joueur prudent a donc un choix évident dans deux branches sur cinq. Un playtest dira si cela se sent.
2. **Prises seules, deux décisions font dépasser I1 au bot prudent** : Rationnement, avec 30 min 47 sans chiffre perdu, et Volontariat, avec 28 min 25. Le Consentement plus bas le fait attendre. C'est la même attente que dans le réglage du quatrième playtest ([acte-3.md](acte-3.md)) : un humain peut choisir de ne pas attendre.
3. **Plus de Capacité ne raccourcit pas toujours l'acte II.** Au banc, un bot qui a plus de Capacité ferme plus tôt la centrale thermique, et attend ensuite la chimie.
4. **Le Retour à la terre rend le dosage plus cher.** C'est un lien entre l'acte IV et l'épilogue que le jeu ne dit pas. À voir si c'est voulu.
5. **Les textes** sont provisoires ([#23](https://github.com/DavidGiangiacomo/decroissance/issues/23)).
