# Décroissance — prototype (actes I à V)

Prototype du [design doc](docs/design-doc.md) : un seul écran, une géographie fictive (l'**Ostrane** : une côte, le fleuve la Sère, le bassin minier de Cherbaix, deux métropoles, Valdrance et Orvenne, le port de Méraud). L'acte I est le MVP falsifiable du §14. L'acte II, « Le réseau », s'ouvre quand la carte de l'acte I est vidée ; il est décrit dans [docs/acte-2.md](docs/acte-2.md). L'acte III, « Les gens », s'ouvre quand le réseau est démantelé ; il est décrit dans [docs/acte-3.md](docs/acte-3.md). L'acte IV, « Le legs », s'ouvre quand la carte de l'acte III est vidée ; il est décrit dans [docs/acte-4.md](docs/acte-4.md). L'acte V, « Rendre », s'ouvre quand tout est gardé, démantelé et dépollué ; il est décrit dans [docs/acte-5.md](docs/acte-5.md). Deux des trois fins, Clore et Poursuivre, sont décrites dans [docs/fins.md](docs/fins.md) ; la troisième, Croissance, et le mode qui y mène, dans [docs/croissance.md](docs/croissance.md).

Aucune dépendance, aucun build. Ouvrir `index.html` dans un navigateur (ou `python3 -m http.server` puis http://localhost:8000). Le son est synthétisé en WebAudio, il n'y a aucun fichier audio.

## En ligne

Le jeu est publié sur GitHub Pages à chaque push sur `main` : https://davidgiangiacomo.github.io/decroissance/

Le workflow `.github/workflows/pages.yml` lance `node tools/build-site.js`, qui copie les fichiers du jeu dans `_site/` et y inscrit la version jouée : le hash court et la date du commit. Le pied de page du jeu l'affiche, pour savoir quelle version chaque testeur a jouée. En local, il affiche « version dev ».

Prérequis, une seule fois : dans les réglages du dépôt, *Pages → Build and deployment → Source* doit être sur **GitHub Actions**.

## L'acte I : ce que le MVP contient

- **L'Empreinte en chiffres pleins, en hausse au lancement** (+2,4 %/min). Elle a son propre taux de croissance `g`, somme des contributions des sites encore actifs. L'objectif de l'acte I est de la faire *s'arrêter*, pas de la faire baisser.
- **8 sites** démantelables une fois chacun, plus une **mesure** (autonomie de l'hôpital) qui ne retire rien : elle coûte du temps, de la Capacité et des Mains.
- **Graphe minimal, 3 dépendances** : la centrale à charbon alimente l'usine de SUV et l'hôpital régional ; la centrale au gaz est le secours de l'hôpital. Le graphe est dessiné sur la carte ; sélectionner un site fait clignoter en rouge ce qu'il couperait maintenant.
- **Coupure → Casse** : fermer une centrale alors que quelque chose en dépend encore coupe le dépendant. La Casse compte les personnes touchées pour de bon. Elle est en haut à droite, en permanence, et ne redescend jamais. Chaque carte en donne le prix avant le lancement, et le journal la définit à sa première apparition.
- **Capacité** dérivée de l'Empreinte : `K/s = K₀ × (E/E₀)^0,6`. **Mains** jamais exponentielles : elles viennent des gens déplacés par les fermetures, à reconvertir par lots de 300 en 45 s réelles, contre un peu de Consentement.
- **Terre rendue** : linéaire en temps réel, par site fermé. La carte verdit site par site. Continue hors ligne (plafond 12 h) ; le démantèlement, lui, ne progresse pas hors ligne.
- **Bouton Relancer** visible dès la première seconde, fonctionnel : 90 s de croissance +4 %/min, Capacité ×4, chantiers ×2, et un peu de Consentement. Chaque relance double le plancher irréductible, fixé à un seul chiffre : trois relances coûtent un chiffre perdu sur la partie. **Sous 20 % de Consentement, le Conseil relance sans vous** : le seuil est marqué sous la jauge, et une carte prévient quand son lancement ou sa fermeture le ferait franchir.
- **Deux couches sonores retirées, deux ajoutées** : la rumeur de trafic s'éteint quand le nombre cesse de monter, et le vent arrive ; les turbines s'éteignent au premier chiffre perdu, et les oiseaux arrivent. Une relance ramène l'industrie à plein volume.
- **Les deux moments testés** : la stabilisation (le jeu s'arrête 3 s, le son baisse) et la perte du premier chiffre (le chiffre de tête tombe, l'écran se resserre d'un cran, coup sourd). Un panneau affiche ensuite les données du test : temps jusqu'à l'arrêt, temps jusqu'au chiffre, nombre de relances, Casse, plancher.
- Sauvegarde JSON en `localStorage`, tick à 10 Hz, état en objet plat (`engine.js` est pur et tourne aussi en node). Une partie enregistrée avec une autre liste de sites se reprend quand même ; une sauvegarde illisible mène à une nouvelle partie, avec une copie gardée de côté. Un onglet caché compte comme du temps hors ligne.
- **Rapport de session** : le bouton « rapport » du pied de page copie les temps des deux moments, les relances des 20 premières minutes, le Consentement minimum, la Casse par cause, la version jouée et toute la chronologie de la partie, en texte suivi d'un bloc JSON.

## L'acte II : le réseau

Détail, contenu et réglages dans [docs/acte-2.md](docs/acte-2.md).

- **Le réseau électrique devient une jauge** : production, demande et marge, sous les ressources. Sept nouveaux sites, deux mesures, et des nœuds qui ne se démantèlent pas (le barrage, les deux villes, l'eau, le pompage, l'hôpital d'Orvenne), tous reliés au poste de la Sère sur la même carte.
- **Marge positive : rebond.** L'électricité en trop relance la croissance, jusqu'à 1 %/min quand toute la production est en trop. Le compteur remonte dès l'ouverture de l'acte.
- **Marge négative : délestage**, dans un ordre fixe et affiché : industrie, commerces, villes, puis eau et santé. Un site délesté perd la moitié de son Empreinte, ses employés passent dans la Casse, et ses restes se démantèlent ensuite au coût normal.
- **Approvisionnements** : la raffinerie fournit le fioul de la centrale thermique, la chimie le chlore de l'eau potable d'Orvenne, sauf si la filtration UV est faite. Chaque carte dit, avant le lancement, ce qu'il ferait au réseau, et ce que cela coûterait en Casse et en Consentement.
- **Démolir vite** : l'aciérie et la chimie peuvent se démolir en deux fois moins de temps, de Capacité et de Mains, au prix d'une pollution (de la Casse et un sol qui ne se régénère pas).
- **Deuxième chiffre perdu** : la région la plus démantelée s'éteint sur la carte, le bourdonnement du réseau s'arrête, la rivière arrive. Chaque chiffre suivant éteint une autre région.
- À côté du Consentement s'affiche ce qu'il a gagné ou perdu pendant la dernière minute de jeu, tout compris.
- **Ce qui le fait bouger** : un lien sous la jauge ouvre le détail, cause par cause, pour la dernière minute et pour toute la partie. On y voit ce qui ne se voit nulle part ailleurs : sans rien faire, il revient de lui-même vers 70 %, de 0,6 point par minute. Les fermetures, les coupures, les relances et les formations achevées le disent aussi dans le journal. Le rapport de session reprend les totaux par cause.
- Le rapport de session reprend les données de l'acte : deuxième chiffre, coupures et délestages, démolitions qui ont pollué, régions éteintes.

## L'acte III : les gens

Détail, contenu, réglages et points à trancher dans [docs/acte-3.md](docs/acte-3.md).

- **Les Mains deviennent le goulot.** Huit sites (le port, l'autoroute, deux sites logistiques, quatre exploitations agricoles) coûtent beaucoup de Mains et peu de Capacité, qui ne se renouvelle presque plus. Chacun retire une part de l'Empreinte qui reste : 35 à 60 %.
- **Les gens attendent, par origine**, en semaines fictives. À l'acte III, attendre use le Consentement ; un lot de 300 qui finit sa formation en rend. Chaque lot en formation montre trois noms et leurs anciens métiers. Les centres de formation ouvrent une deuxième place. Un clic remplit toutes les places libres ; l'option « former en continu » relance les lots sans clic.
- **La desserte** : le port et l'autoroute desservent six sites. Un site isolé se démantèle à bras, pour deux fois plus de Mains.
- **Les vivres** : une jauge de 100 points. Une exploitation qu'on démantèle cesse de produire ; sa terre convertie rend 90 % en cinq minutes. Sous 100, la pénurie fait de la Casse chaque minute. Les ceintures maraîchères ajoutent 30 points.
- **La relance devient raisonnable** : elle importe les vivres qui manquent, et réembauche les gens en attente, qui ne deviendront jamais des Mains.
- Le son ajoute le fret, puis les insectes et des voix. Le rapport de session reprend les données de l'acte : chiffres perdus, pénuries, réembauchés, chantiers lancés à bras.

## L'acte IV : le legs

Détail, contenu, arbitrages et réglages dans [docs/acte-4.md](docs/acte-4.md).

- **Le plancher se révèle** : sous le compteur, le plancher irréductible et la part de ce qui reste « à garder ». L'Empreinte ne descend jamais sous le plancher.
- **La Garde**, un panneau à part : trois charges fuient et font remonter l'Empreinte tant qu'elles ne sont pas gardées (digues, 300 ans ; galeries, 10 000 ans ; combustibles usés, 100 000 ans). Une garde coûte de la Capacité une fois, et des gardiens pour toujours, formés sur les places de formation. Réduite ou pleine : la différence se paiera à l'épilogue.
- **Le réseau national**, point de non-retour : après lui, la Capacité ne se renouvelle plus, et le rebond s'arrête.
- **Les sols** se dépolluent au temps réel seul, hors ligne compris : rien ne les accélère. S'y ajoutent les sols pollués par les démolitions rapides de l'acte II.
- Sans Capacité, tout se fait à bras : deux fois plus de gardiens ou de Mains.
- Le son ajoute le bourdonnement du poste, qui s'éteint avec le réseau national, puis la pluie, puis presque le silence. Le rapport de session reprend les gardes, leur dosage, les gardiens et le plancher.

## L'acte V : rendre

Détail, contenu, arbitrages et réglages dans [docs/acte-5.md](docs/acte-5.md).

- **Des gestes, pas des chantiers** : démonter, débitumer, rouvrir, planter, dans chacune des sept régions. Vingt-huit gestes, un clic chacun, un seul à la fois, sans Capacité. Chacun retire 8 à 15 % de ce qui reste.
- **Les Mains restent sur la terre rendue** : l'équipe d'un geste, 300 à 900 personnes, ne revient pas. Faute de Mains, les habitants font le geste : deux fois plus long, et 3 points de Consentement.
- **L'Empreinte s'arrête sur le plancher**, qui n'est pas zéro. Le jeu marque un temps, le compteur se fige, et les gestes qui restent ne rendent plus que de la terre, jusqu'à 100 %. Sous 100, l'Empreinte se lit à la décimale.
- **La relance** double toujours le plancher. Si l'Empreinte se retrouve dessous, elle y remonte.
- La carte reverdit région par région. Le son ramène les oiseaux, les insectes et des voix à mesure des gestes.

## Les fins : Clore, Poursuivre

Détail, contenu et points ouverts dans [docs/fins.md](docs/fins.md). La troisième fin, Croissance, a sa section plus bas.

- **Ce qui reste** : au dernier geste, une section énumère le plancher, les gardes, les gens restés sur place et la Casse, et propose deux choix sans retour.
- **Clore** scelle la partie : plus rien ne se lance ni ne se relance. Un écran énumère ce qui reste, puis vient l'épilogue, puis il ne reste que la carte.
- **L'épilogue, « L'inventaire »** : tout ce qui a été fait, dans l'ordre, une ligne toutes les 4 s. Le rapport de session dit comment il a été lu : ligne à ligne, affiché d'un coup, ou pas jusqu'au bout. Pour les actes I à III, l'ordre du joueur réparé au plus juste pour ne faire aucune Casse, et ce qu'il aurait épargné.
- **Le prix des gardes réduites**, que le jeu n'avait jamais dit : 300, 600 et 1 200 personnes de Casse, comptées à la clôture et révélées à la fin de l'épilogue.
- **Renforcer une garde** : avant de choisir, une garde réduite peut devenir pleine avec les Mains qui restent. La carte de chaque garde dit ce que fait chaque dosage, pas ce qu'il coûte.
- **Poursuivre** refuse le plancher : chaque pas retire un dixième de ce qui reste et dure le double du précédent, hors ligne compris. Il n'y a plus de Clore, ni d'écran de fin.
- **Quand tout est rendu, ce qu'une relance ajoute reste** : le plancher monte jusqu'à l'Empreinte.

## Le mode Croissance

Détail, contenu, réglage et points ouverts dans [docs/croissance.md](docs/croissance.md).

- **« Ne plus arrêter »** : à la troisième relance enchaînée, un second bouton apparaît à côté de Relancer. Il fait basculer la partie, sans retour, à n'importe quel acte.
- **La carte se rejoue à l'envers** : les trente sites deviennent des générateurs. Un site fermé se rouvre, un site ouvert s'agrandit, et chaque niveau ajoute de la croissance. Tout se paie en Capacité, qui n'a plus de plafond.
- **L'Empreinte s'emballe** : +500 % par minute dès le basculement, plus de 30 chiffres gagnés en dix minutes, en notation scientifique.
- **Des paliers** tous les trois chiffres gagnés : la Capacité reçue double, les sites de l'acte suivant s'ouvrent, puis l'achat devient automatique.
- **Aucun frottement** : le Consentement monte à 100, tout le monde est réembauché, aucune Casse nouvelle. La Terre rendue retombe.
- **La fin** : dix minutes après le basculement, l'écran se fige et le son se coupe. Ni texte, ni épilogue.
- Le son ramène les couches industrielles une à une, et une musique dont le tempo monte avec les chiffres gagnés.

## Fichiers

| Fichier | Rôle |
|---|---|
| `docs/design-doc.md` | le design doc complet, référence des sections citées ici et dans les issues |
| `docs/acte-2.md` | l'acte II tel que validé et réglé : règles, contenu, écarts, rythme mesuré |
| `docs/acte-3.md` | l'acte III proposé et réglé : règles, contenu, piège, rythme mesuré, points à trancher |
| `docs/acte-4.md` | l'acte IV tel que validé et réglé : règles, contenu, arbitrages, écarts, rythme mesuré |
| `docs/acte-5.md` | l'acte V tel que validé et réglé : règles, contenu, arbitrages, écarts, rythme mesuré, points ouverts |
| `docs/fins.md` | Clore, Poursuivre et l'épilogue tels que validés : règles, contenu, écarts, ce que disent les bots, points ouverts |
| `docs/croissance.md` | le mode Croissance et la troisième fin tels que validés : règles, contenu, écarts, rythme mesuré, points ouverts |
| `data.js` | toutes les valeurs de réglage : sites, graphe, réseau, vivres, gardes et sols, gestes, régions, noms et métiers, constantes |
| `engine.js` | moteur pur (création, tick, engagement, coupures, réseau, gens et formations, vivres, gardes, sols, gestes, plancher, fins et inventaire de l'épilogue, mode Croissance, relance, hors-ligne, formats) |
| `audio.js` | couches sonores synthétisées et sons ponctuels |
| `main.js` | rendu, carte SVG, sauvegarde, boucle |
| `index.html`, `style.css` | l'écran unique |
| `tools/simulate.js` | joueur automatique pour régler le rythme sans navigateur ; il dit aussi ce que dirait l'épilogue. La page le charge en mode test, pour reprendre la partie d'un bot |
| `tools/build-site.js` | prépare le site publié sur GitHub Pages, simulateur compris, et y inscrit la version |
| `tools/test.js` | tests du moteur : actes II à V, fins, mode Croissance, reprise des sauvegardes, rapport de session, jugement des invariants |
| `tools/check.js` | vérifie les invariants I1 à I6 du §9 sur quatorze parties jouées par les bots, et sort en erreur si l'un d'eux est cassé |
| `.github/workflows/pages.yml` | publie le jeu sur GitHub Pages à chaque push sur `main` |
| `.github/workflows/tests.yml` | lance les tests et la vérification des invariants sur chaque pull request, et sur `main` |

```
node tools/simulate.js prudent 10     # bot prudent, 10 s de réaction par action
node tools/simulate.js pressé 10      # ignore les avertissements : coupures, réseau, desserte, vivres
node tools/simulate.js vite 10        # prudent, mais démolit vite à l'acte II
node tools/simulate.js relance-1 10   # une relance à 2 min
node tools/simulate.js relance-continue   # relance sans arrêt, sans jamais basculer
node tools/simulate.js croissance 5   # relance sans arrêt, puis « Ne plus arrêter » : le mode Croissance
DOSAGE=pleine node tools/simulate.js prudent 10   # gardes pleines à l'acte IV
node tools/test.js                    # tests du moteur
node tools/check.js                   # invariants I1 à I6 du §9, sur quatorze parties (45 s environ)
```

Les deux dernières commandes tournent sur chaque pull request. Ce que `tools/check.js` mesure, ses seuils et les écarts connus du réglage actuel sont décrits au §9 du [design doc](docs/design-doc.md), « Vérification automatique ».

Avec un bot prudent à 10 s de réaction : stabilisation vers 3 min, premier chiffre vers 6 min 30, carte vidée vers 12 min, deuxième chiffre vers 27 min, troisième chiffre et réseau démantelé vers 28 min, deux chiffres de plus et la fin de l'acte III vers 1 h 01, trois chiffres et la fin de l'acte IV vers 1 h 26, puis le dernier chiffre, le plancher et la fin de l'acte V vers 1 h 48. Un humain sera plus lent d'un facteur 1,5 environ : 15 à 20 min pour l'acte I, 40 à 45 min pour les deux premiers actes, 1 h 30 environ pour les trois premiers, un peu plus de 2 h pour les quatre, 2 h 40 environ pour les cinq.

Crochet de test dans la console : `Jeu.avancer(secondes)`, `Jeu.etat`, `Jeu.engager(id)`, `Jeu.relancer()`, `Jeu.inventaire()`, `Jeu.basculer()`, `Jeu.toutAcheter()`.

## Raccourcis de test

Atteindre l'acte IV demande une heure de jeu, et la fin 1 h 48. Pour tester un acte ou une fin sans rejouer ce qui précède, ouvrir le jeu en mode test : `index.html?test`, ou https://davidgiangiacomo.github.io/decroissance/?test en ligne.

- **L'accueil propose alors de reprendre la partie d'un bot** : à l'ouverture de l'acte II, III, IV ou V, au choix final quand tout est rendu, ou au basculement dans la croissance.
- **Le bot se choisit** : le prudent, le pressé, le rapide ou celui qui relance une fois, à 10, 30 ou 45 s de réaction, avec des gardes réduites ou pleines. Le pressé arrive avec de la Casse et des relances du Conseil ; le prudent, sans.
- **Le bot joue dans le navigateur**, en une à deux secondes, avec le moteur et les réglages du moment : aucun état n'est enregistré d'avance.
- **La partie de test a sa propre sauvegarde.** Elle ne touche pas à la vraie, et se reprend en rouvrant le jeu en mode test.
- **Le rapport de session le dit** : « Raccourci de test : partie reprise d'un bot », avec le bot et le point de reprise. Ce qui précède n'a pas été joué par le joueur.
- **Un lien peut porter les choix**, qui sont alors présélectionnés : `?depuis=acte4&joueur=pressé&reaction=30&gardes=pleine`. Les points sont `acte2` à `acte5`, `fin` et `croissance`.

Sans `?test`, rien de tout cela n'apparaît : le lien normal reste celui à envoyer aux testeurs naïfs.

## Protocole de test (§14)

1. Envoyer le lien du jeu en ligne et faire jouer 20 min sans rien expliquer, son allumé.
2. Noter la réaction à deux instants : quand le compteur cesse de monter, et quand il perd son premier chiffre. Si aucun des deux ne fait rien au testeur, le concept ne tient pas.
3. Récupérer le rapport de session : bouton « rapport » en pied de page, puis « Copier le rapport ». Il compte les appuis sur **Relancer** des 20 premières minutes. Zéro = bouton pas assez tentant ; dix = pas d'autre stratégie viable.
4. Coller le rapport en commentaire de [l'issue des playtests](https://github.com/DavidGiangiacomo/decroissance/issues/8).
5. Pour l'acte II, noter la réaction à la première coupure et au deuxième chiffre perdu, quand une région s'éteint.
6. Pour l'acte III, noter si le testeur lit les noms, s'il regarde la jauge des vivres avant de fermer une exploitation, et s'il appuie sur Relancer quand le Consentement baisse.
7. Pour l'acte V, noter la réaction quand le compteur s'arrête sur le plancher, et si le testeur fait encore les gestes qui restent une fois le compteur figé.
8. Pour les fins, noter laquelle le testeur choisit et pourquoi, s'il lit l'inventaire ou l'affiche d'un coup, et sa réaction à la Casse des gardes réduites.
9. Pour le mode Croissance, le faire jouer à part, à quelqu'un qui ne joue que lui : noter s'il le trouve agréable, s'il achète encore une fois l'achat automatique offert, et sa réaction quand l'écran se fige.

## Écarts avec le design doc, et pourquoi

- **Les valeurs d'Empreinte des sites de l'acte I sont bien plus petites** que la table du §5 (3 à 6 millions au lieu de 30 à 80). Avec les valeurs du doc, la première fermeture fait passer sous 10⁹ à la 40ᵉ seconde, avant toute stabilisation : le premier chiffre serait perdu par accident et reviendrait. Avec les valeurs retenues, les fermetures de l'acte I sont réellement englouties par la croissance, et le premier chiffre tombe avec le premier chantier lourd (la cimenterie, −120 millions), une fois le nombre arrêté. C'est le retune que le doc annonçait.
- **Le site s'arrête à l'ouverture du chantier**, pas à sa clôture : sa contribution à la croissance cesse et les coupures sont évaluées immédiatement (la centrale est éteinte pour être démontée). L'Empreinte, la récupération de Capacité et les déplacés restent appliqués à la clôture.
- **Une mesure** (autonomie de l'hôpital) a été ajoutée pour qu'il existe une bonne séquence, plus lente que la séquence intuitive, permettant de fermer les deux centrales sans coupure.
- Le plancher irréductible est affiché dans le panneau de fin d'acte, pas dans l'interface courante (il n'est révélé qu'à l'acte IV).
- Pour l'acte II, les écarts avec la proposition validée et le rythme mesuré sont dans [docs/acte-2.md](docs/acte-2.md).
- Pour l'acte III, le design, ses écarts avec le §9 et les points à trancher sont dans [docs/acte-3.md](docs/acte-3.md).
- Pour les actes IV et V, les écarts avec les propositions validées sont dans [docs/acte-4.md](docs/acte-4.md) et [docs/acte-5.md](docs/acte-5.md).
