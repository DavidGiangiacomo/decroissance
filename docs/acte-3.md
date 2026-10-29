# Acte III — Les gens

Suite de l'acte II ([#14](https://github.com/DavidGiangiacomo/decroissance/issues/14)), pour [l'issue #15](https://github.com/DavidGiangiacomo/decroissance/issues/15). Contrairement à l'acte II, ce design n'a pas été validé avant d'être codé. Il part du §10 du design doc et de la liste de l'issue, puis il a été réglé au simulateur. Les choix à trancher sont regroupés en fin de page.

## L'idée

« Les Mains deviennent le goulot. Le panneau de reconversion s'ouvre, avec des durées en semaines fictives et des noms. Le Consentement devient volatil. » (§10). Ce que l'acte retire au joueur, selon le §9 : la main-d'œuvre disponible.

À ce stade, la Capacité ne se renouvelle presque plus : 0,45 par seconde à l'ouverture, moins de 0,05 à la fin. Les chantiers de l'acte III coûtent donc peu de Capacité, mais beaucoup de Mains. Ces Mains viennent des gens des sites fermés, qu'il faut former, et former prend du temps.

## Les règles

- **Les gens attendent, par origine.** Chaque fermeture ajoute un groupe à la liste d'attente : « Port de Méraud, 3 200, attend depuis 12 semaines ». Le groupe le plus ancien part en formation en premier. À l'acte III, attendre use le Consentement : 0,4 point par minute et par millier de personnes en attente.
- **Les formations.** Un lot réunit 300 personnes et dure 9 semaines fictives, soit 45 s. Il coûte 1 point de Consentement au départ et, à l'acte III, en rend 2 à l'arrivée. Le Consentement monte donc et descend selon la façon dont on traite les gens. La mesure « Centres de formation » ouvre une deuxième place. Au-delà de 40 000 Mains disponibles, engagées et en formation, plus personne n'est formé (§4). Ce plafond n'est pas atteint à l'acte III.
- **Des noms.** Chaque lot en formation montre trois personnes : un prénom, un nom et le métier qu'elles avaient sur leur site d'origine, par exemple « Rachida Barbier, fondeuse ». Les tirages sont stables, et les listes sont dans `data.js`.
- **La desserte.** Le port de Méraud dessert les céréales, les élevages et la pêche. L'autoroute de la Sère dessert les entrepôts, les centrales d'achat et les serres. Un site qui n'est plus desservi est isolé : son chantier se fait à bras et coûte deux fois plus de Mains. La carte de chaque port et de chaque autoroute dit avant le lancement ce qu'on isolerait. Sélectionner un site fait clignoter sur la carte ce qu'il isolerait.
- **Les vivres.** 100 points couvrent les besoins du pays. Au départ, la production en donne 110 : 30 viennent des petites fermes, qui ne se démantèlent pas, et 80 de l'agro-industrie.
  - Une exploitation cesse de produire dès l'ouverture de son chantier.
  - Sa terre, convertie, rend 90 % de ses vivres en 5 minutes.
  - La mesure « Ceintures maraîchères » ajoute 30 points.
  - Sous 100, c'est la pénurie : chaque point manquant coûte 15 personnes par minute, ajoutées à la Casse, et du Consentement.
  - Avant le lancement, chaque exploitation affiche le point le plus bas qu'atteindraient les vivres, et la durée de la pénurie.
- **La relance, à l'acte III**, devient la « solution raisonnable » du §10. En plus de son effet ordinaire, elle couvre la pénurie par des importations tant qu'elle dure. Elle réembauche aussi tous les gens en attente, qui sortent de la liste : ils ne coûtent plus de Consentement, mais ne deviendront jamais des Mains. La relance du Conseil, sous 20 % de Consentement, fait la même chose. Un joueur qui laisse s'effondrer le Consentement perd donc ses futures Mains.
- **L'Empreinte retirée est une part.** Chaque site de l'acte III retire une part fixe de l'Empreinte qui reste quand il ferme, de 35 à 60 %. Sa carte affiche la part, et ce qu'elle représente aujourd'hui en chiffres pleins. Les huit parts réunies font perdre 2,2 chiffres, de 1,4·10⁷ à 8,5·10⁴ pour le joueur prudent. Les raisons de ce choix sont plus bas.

## Entrée, carte, son, fin

- **L'ouverture.** L'acte s'ouvre quand le réseau est démantelé. Le jeu s'arrête 4 s sur un carton « Acte III — Les gens ». Les huit sites apparaissent sur la même carte, avec la jauge des vivres et le panneau des gens. La tendance du Consentement s'affiche à côté de sa valeur, en points par minute.
- **La carte.** Les liens de desserte sont en pointillés serrés. Un site isolé porte un anneau pointillé. Chaque chiffre perdu éteint encore une région, comme depuis l'acte II. Une fermeture qui fait perdre deux chiffres d'un coup compte deux pertes et éteint deux régions.
- **Le son.**
  - Une couche de fret arrive : grondement de camions, avertisseurs de recul, cornes de navire. Son volume suit la logistique encore active.
  - Au troisième chiffre perdu (7 chiffres restants), les insectes arrivent.
  - Au quatrième (6 chiffres restants), le fret s'éteint et des voix lointaines arrivent.
- **La fin.** L'acte finit quand ses huit sites sont démantelés. Un panneau « Fin de l'acte III — le prototype s'arrête là » reprend les données de l'acte : chiffres perdus, pénuries, réembauchés, chantiers lancés à bras, Casse, relances. Le rapport de session les contient aussi.
- **L'acte II** ne montre plus son propre panneau de fin : son dernier chantier ouvre directement l'acte III. Ses données restent dans le rapport.

## Contenu

La Capacité compte peu : de 30 à 150 par chantier.

| Site | Part de l'Empreinte | Mains | Durée | Gens à reconvertir | Particularité |
|---|---|---|---|---|---|
| Port de Méraud | 55 % | 5 400 | 6 min 30 | 3 200 | dessert les céréales, les élevages et la pêche |
| Autoroute de la Sère | 45 % | 4 200 | 5 min 45 | 1 200 | dessert les entrepôts, les centrales d'achat et les serres |
| Plateforme logistique de Valdrance | 45 % | 4 800 | 5 min 15 | 2 600 | desservie par l'autoroute |
| Centrales d'achat de Cherbaix | 45 % | 4 200 | 5 min 15 | 2 400 | desservies par l'autoroute |
| Céréales irriguées de la plaine | 60 % | 7 800 | 7 min 45 | 1 500 | desservies par le port ; 35 points de vivres |
| Élevages hors-sol de la plaine | 50 % | 6 000 | 6 min 30 | 2 200 | desservis par le port ; 25 points de vivres |
| Serres chauffées d'Orvenne | 35 % | 3 000 | 4 min 30 | 900 | desservies par l'autoroute ; 10 points de vivres |
| Pêche industrielle de Méraud | 40 % | 3 000 | 5 min 15 | 1 400 | desservie par le port ; 10 points de vivres |
| Ceintures maraîchères | mesure | 2 400 | 6 min 30 | — | +30 points de vivres |
| Centres de formation | mesure | 1 800 | 5 min 15 | — | deux lots en formation à la fois |

L'acte ajoute 31 points de Terre rendue possible. Le total possible passe de 22,8 à 53,8 %, ce que vise le §9 pour la fin de l'acte III (55 %).

## Le piège

- **Le port.** Après les céréales, c'est la plus grosse part, et il coûte moins de Mains qu'elles. Le fermer d'abord isole trois sites, dont les céréales, qui passent alors à 15 600 Mains.
- **Les vivres.** Fermer deux exploitations à la fois provoque une pénurie, comme fermer les céréales avant les ceintures.
- **Les gros employeurs.** Les fermer vite remplit la liste d'attente, et l'attente use le Consentement. Le Conseil relance alors et réembauche tout le monde.
- **Le bon ordre** est le suivant. Il est plus lent, et tout se voit à l'écran (R4).
  1. Les centres et les ceintures d'abord.
  2. Les sites desservis avant le port et l'autoroute.
  3. Une exploitation à la fois.
  4. Des formations en continu.

## Pourquoi des parts plutôt que des valeurs fixes

À l'entrée de l'acte III, l'Empreinte varie d'un facteur six selon la façon de jouer : 7,9·10⁶ pour le bot qui démolit vite, 4,8·10⁷ pour le bot pressé, que le Conseil a relancé deux fois à l'acte II. Avec des valeurs fixes calées sur le joueur prudent, deux problèmes se posent :

- le joueur qui a relancé ne perdrait aucun chiffre pendant tout l'acte (I1) ;
- le joueur rapide passerait sous zéro.

Avec des parts, chacun perd environ 2,2 chiffres dans l'acte, à partir de là où il en est. Une relance coûte alors toujours la même chose en Empreinte, environ 6 %, quel que soit le moment. C'est le plancher doublé qui la fait vraiment payer, comme le veut le §8.

Un garde-fou s'ajoute, pour tous les actes : une fermeture ne retire jamais plus de 95 % de ce qui reste. À l'acte II, la dernière fermeture d'un joueur très rapide pouvait faire passer l'Empreinte sous zéro.

## Rythme mesuré

Mesures faites avec `node tools/simulate.js <profil> <réaction>`. Les écarts sont comptés entre deux chiffres perdus successifs, à partir du deuxième.

| Joueur | Réaction | Durée de l'acte III | Écarts entre chiffres | Pénuries | Réembauchés | Chantiers à bras | Relances du Conseil dans l'acte | Empreinte à la fin |
|---|---|---|---|---|---|---|---|---|
| Prudent : mesures d'abord, aucun isolement, aucune pénurie, Consentement au-dessus de 25 | 10 s | 36 min | 12 min 57, 8 min 45, 14 min 16 | 0 | 4 100 | 0 | 1 | 85 479 |
| Prudent | 30 s | 43 min 49 | 18 min 13, 15 min 46 | 0 | 0 | 0 | 0 | 163 111 |
| Prudent | 45 s | 46 min 11 | 30 min 32, 15 min 15 | 0 | 5 700 | 0 | 1 | 518 981 |
| Pressé : la plus grosse part d'abord, sans rien regarder | 10 s | 41 min 05 | 16 min 10, 19 min 30 | 1 802 personnes | 2 000 | 6 | 1 | 347 371 |
| Pressé | 30 s | 40 min 23 | 14 min 01, 20 min 37 | 1 517 personnes | 3 030 | 5 | 1 | 492 308 |
| Vite (comme le prudent à l'acte III) | 10 s | 35 min 50 | 0 s, 23 min 45, 12 min 05 | 0 | 0 | 0 | 0 | 46 976 |

Le bot « vite » perd ses deuxième et troisième chiffres d'un coup, à la dernière fermeture de l'acte II, d'où l'écart nul. Le rythme des actes I et II ne change pas.

Le §9 prévoit pour l'acte III 55 minutes, trois chiffres perdus, une Empreinte qui finit à 6·10⁴ et 55 % de Terre rendue. Au simulateur, l'acte dure 36 à 44 minutes, soit 55 à 65 minutes pour un humain. Le joueur prudent y perd trois chiffres et finit à 8,5·10⁴. Celui qui arrive avec plus d'Empreinte en perd deux. La Terre rendue atteint 36 à 48 % à la fin de l'acte selon les profils, puis continue de monter.

## Points à trancher

1. **L'Empreinte en parts**, plutôt qu'en valeurs fixes comme aux actes I et II. C'est le choix le plus structurant de l'acte : il servira aussi aux actes IV et V.
2. **La relance réembauche tout le monde.** C'est fort : une relance du Conseil a coûté 4 100 Mains futures au bot prudent. Une variante : elle n'en réembaucherait qu'une partie.
3. **Le Consentement arrive bas.** Les bots ouvrent l'acte III vers 23 %, et le Conseil relance au moins une fois pour la plupart des profils. Le prudent à 30 s l'évite. Un humain attentif devrait y arriver, mais il faut le vérifier en playtest.
4. **La pénurie est rude**, à 15 personnes par point et par minute : fermer les céréales et les élevages ensemble, sans les ceintures, coûte environ 1 700 personnes.
5. **Les joueurs très lents dépassent encore le plafond d'I1** : 30 min 32 entre deux chiffres pour le prudent à 45 s, comme à l'acte II.
6. **Le son** est synthétisé en trois couches nouvelles. Il reste à l'écouter.
7. **Hors de cet acte :**
   - les recettes fiscales du §6 ne sont pas modélisées, seuls les emplois apparaissent, sous la forme des gens par site d'origine ;
   - la décision Travail, Réquisition ou Volontariat, viendra avec les décisions ([#18](https://github.com/DavidGiangiacomo/decroissance/issues/18)) ;
   - la Garde, qui absorbera des Mains pour toujours, c'est l'acte IV ([#16](https://github.com/DavidGiangiacomo/decroissance/issues/16)).
