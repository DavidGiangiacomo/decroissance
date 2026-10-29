# Acte II — Le réseau

Design validé dans [l'issue #14](https://github.com/DavidGiangiacomo/decroissance/issues/14), puis réglé dans le moteur avec le simulateur. Cette page décrit ce que le prototype fait, et ce qui a changé par rapport à la proposition.

## L'idée

Jusqu'à l'acte I, l'électricité était abondante et invisible. À l'acte II, elle devient une jauge : ce que les centrales produisent, ce que le pays consomme, et la marge entre les deux. Le joueur ferme à la fois des producteurs et des consommateurs, en gardant la marge juste au-dessus de zéro. C'est « l'électricité abondante » que le §9 retire au joueur, et l'« équilibre qui se dégrade » du §3, au sens propre.

Les quatre points validés :

1. **Le réseau est une jauge commune avec une marge**, et non des liens un à un comme à l'acte I. Tout passe par le poste de la Sère, dessiné au centre de la carte.
2. **Marge positive : rebond.** L'électricité en trop relance la croissance, en proportion de la marge : `g = 1 %/min × marge / production`. Toute la production en trop donnerait 1 %/min.
3. **« Bâclé » est un choix explicite au lancement** : l'aciérie et la chimie ont deux boutons, « Engager » et « Démolir vite ».
4. **Marge négative : délestage, dans un ordre fixe et affiché** sous la jauge : industrie, commerces, villes, puis eau et santé. Le réseau coupe dans cet ordre jusqu'à ce que la marge redevienne positive ou nulle.

## Les règles

- **Bilan.** La production est la somme des producteurs qui tournent ; la demande est celle des consommateurs alimentés. Un site en chantier ne produit ni ne consomme plus : il s'arrête à l'ouverture du chantier, comme à l'acte I.
- **Approvisionnements.** La raffinerie de Méraud fournit le fioul de la centrale thermique d'Orvenne : fermer la raffinerie arrête aussi la centrale. La chimie de la Sère fournit le chlore de l'eau potable d'Orvenne : sans chlore, l'eau est coupée, sauf si la filtration UV est faite.
- **Un site délesté est coupé.** Il s'arrête, perd la moitié de son Empreinte, ses employés passent dans la Casse et le Consentement baisse de 15. Les restes se démantèlent ensuite au coût normal : une coupure coûte de la Casse, jamais de la progression (R4).
- **Un nœud délesté** (une ville, l'eau, le pompage, l'hôpital) ajoute sa Casse et coûte du Consentement. Il revient dès que la marge le permet, les plus vitaux d'abord.
- **Démolition rapide.** Elle divise par deux la durée, la Capacité et les Mains. À la fermeture, la pollution touche des gens (300 pour l'aciérie, 500 pour la chimie, ajoutés à la Casse) et laisse un sol pollué qui ne se régénère pas. Il deviendra un chantier de dépollution à l'acte IV.
- **Tout se voit avant de lancer (R4).** Chaque carte affiche ce que son lancement ferait maintenant au réseau : la nouvelle marge, les sites mis à l'arrêt, les délestages et les privations en cascade. Sélectionner un site fait clignoter sur la carte ce qu'il menace.
- **Mesures.** La filtration UV rend l'eau d'Orvenne indépendante de la chimie. La sobriété réduit de 30 % la demande des deux villes. Sans elle, le barrage seul ne suffit pas aux villes et aux services vitaux (710 MW pour 600) ; avec elle, il leur suffit (575 MW).

## Entrée, chiffres perdus, fin

- L'acte II s'ouvre quand la carte de l'acte I est vidée. Le jeu s'arrête 4 s sur un carton « Acte II — Le réseau », puis les nouveaux sites, le poste et les lignes apparaissent sur la même carte. La jauge du réseau s'affiche sous les ressources.
- Le compteur remonte dès l'ouverture, à cause du rebond : la stabilisation de l'acte I n'était pas acquise.
- Au deuxième chiffre perdu, la région la plus démantelée, mesurée à l'Empreinte retirée, s'éteint sur la carte. Le bourdonnement du réseau disparaît et la rivière arrive. Chaque chiffre perdu ensuite éteint une autre région.
- L'acte finit quand tous ses sites sont démantelés, restes compris. L'acte III s'ouvre alors ([acte-3.md](acte-3.md)) ; les données de l'acte II restent dans le rapport de session : ouverture, deuxième chiffre, coupures et délestages, démolitions qui ont pollué, Casse, relances.

## Contenu

Production de départ : 2 200 MW. Demande : 1 900 MW. Marge : +300 MW, soit un rebond de +0,14 %/min.

| Site | Sur le réseau | Empreinte | Capacité | Mains | Durée | Particularité |
|---|---|---|---|---|---|---|
| Centrale thermique d'Orvenne | produit 1 200 MW | −1,2·10⁸ | 500 | 1 200 | 6 min | brûle le fioul de la raffinerie |
| Raffinerie de Méraud | produit 400 MW, consomme 100 MW | −6·10⁷ | 450 | 800 | 6 min | fournit le fioul de la centrale thermique |
| Aciérie de Cherbaix | consomme 500 MW | −1,7·10⁸ | 700 | 2 000 | 7 min 30 | démolition rapide possible |
| Chimie de la Sère | consomme 300 MW | −1,2·10⁸ | 600 | 1 500 | 6 min | fournit le chlore de l'eau ; démolition rapide possible |
| Zone commerciale d'Orvenne | consomme 150 MW | −2·10⁷ | 250 | 400 | 3 min | |
| Pistes de ski couvertes de Valdrance | consomme 80 MW | −1·10⁷ | 200 | 200 | 2 min 15 | |
| Écrans et éclairage de nuit | consomme 60 MW | −6·10⁶ | 150 | 100 | 1 min 30 | |
| Filtration UV de l'eau d'Orvenne | mesure | 0 | 300 | 300 | 3 min 45 | l'eau ne dépend plus du chlore |
| Sobriété des deux villes | mesure | 0 | 400 | 600 | 4 min 30 | demande des villes −30 % |

Empreinte totale de l'acte : 5,06·10⁸. Les nœuds suivants ne se démantèlent pas, mais peuvent être délestés :

| Nœud | Sur le réseau | Si délesté |
|---|---|---|
| Barrage de la Sère | produit 600 MW | — : c'est le réseau de la fin |
| Valdrance | consomme 250 MW | 1 500 personnes, consentement −12 |
| Orvenne | consomme 200 MW | 1 200 personnes, consentement −12 |
| Pompage de la Sère | consomme 120 MW | 300 personnes, consentement −15 |
| Eau potable d'Orvenne | consomme 80 MW, chlore de la chimie | 400 personnes, consentement −20 |
| Hôpital d'Orvenne | consomme 60 MW | 80 personnes, consentement −25 |

## Son

Une couche s'ajoute à l'ouverture : le bourdonnement du réseau, à 50 Hz et ses harmoniques, dont le volume suit la production fossile. Il s'éteint au deuxième chiffre perdu, et la rivière arrive. Une région qui s'éteint fait un son de chute grave.

## Écarts avec la proposition, et pourquoi

- **La démolition rapide divise aussi la Capacité par deux.** La Capacité est le goulot de l'acte : économiser seulement du temps et des Mains ne tentait personne.
- **Le Consentement a été réglé.** La reconversion coûte 1 point par lot au lieu de 2, l'usure par chantier simultané passe de 1,2 à 0,8 point par minute, et une relance du Conseil rend 15 points. Sans ces changements, le Consentement s'effondrait à l'acte II et le Conseil relançait en boucle.
- **Les sites délestés gardent des restes à démanteler**, et un acte ne finit qu'une fois tous ses sites démantelés. Sinon, une coupure retirait des sites de la partie, ce que R4 interdit.
- **L'Empreinte de l'acte passe de 4,56·10⁸ à 5,06·10⁸.** Avec la première valeur, le joueur pressé ne perdait pas le deuxième chiffre.
- **Les coûts en Capacité ont été baissés d'environ 15 % au réglage**, pour que l'écart entre les deux premiers chiffres tienne sous 25 min (I1). La proposition ne les chiffrait pas.

## Rythme mesuré

Avec `node tools/simulate.js <profil> <réaction>`, où la réaction est l'attente du bot avant chaque action. Le profil vaut pour les deux actes ; « vite » joue l'acte I comme le prudent.

| Joueur | Réaction | Écart entre les deux premiers chiffres | Durée de l'acte II | Coupures et délestages | Pollutions | Casse | Relances du Conseil |
|---|---|---|---|---|---|---|---|
| Prudent : mesures d'abord, aucune coupure | 10 s | 21 min 31 | 16 min 15 | 0 | 0 | 0 | 0 |
| Pressé : la plus grosse Empreinte d'abord | 10 s | 15 min 35 | 10 min 40 | 3 | 0 | 3 400 | 2 |
| Vite : prudent, mais démolit vite | 10 s | 18 min 24 | 13 min 09 | 0 | 2 | 800 | 0 |
| Prudent | 30 s | 20 min 57 | 19 min | 0 | 0 | 0 | 0 |
| Prudent | 45 s | 27 min 33 | 21 min 08 | 0 | 0 | 0 | 0 |
| Pressé | 45 s | pas de deuxième chiffre dans l'acte | 24 min 39 | 3 | 0 | 3 400 | 3 |
| Vite | 45 s | pas de deuxième chiffre dans l'acte | 26 min 17 | 0 | 2 | 800 | 0 |

Démolir vite ne fait pas toujours gagner de temps : fermer les gros consommateurs tôt creuse la marge, et le rebond reprend ce que la vitesse avait fait gagner.

## Points ouverts

- **Les joueurs très lents dépassent le plafond d'I1.** À 45 s de réaction, la lenteur nourrit le rebond : le prudent perd son deuxième chiffre après 27 min 33, et ni le pressé ni le rapide ne le perdent avant la fin de l'acte. C'est voulu, mais il faudra que l'acte III rattrape le rythme.
- **L'acte finit vers 1,4·10⁷** pour le bot prudent, au lieu de 1,1·10⁷ au §9. L'acte III porte la différence : ses sites retirent une part de ce qui reste ([acte-3.md](acte-3.md)).
- **Un rebond minime subsiste à la fin** : avec la sobriété, il reste 25 MW de marge, soit +0,04 %/min. L'acte III pourra s'en servir ou le fermer.
- **Hors de cet acte** : la décision Énergie, Rationnement ou Marché, qui change les règles du délestage, viendra avec les décisions ([#18](https://github.com/DavidGiangiacomo/decroissance/issues/18)) ; les gens comme goulot, c'est l'acte III ([#15](https://github.com/DavidGiangiacomo/decroissance/issues/15)).
