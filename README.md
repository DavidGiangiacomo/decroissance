# Décroissance — MVP (acte I)

Prototype falsifiable du §14 du design doc : un seul écran, l'acte I, une géographie fictive (l'**Ostrane** : une côte, le fleuve la Sère, le bassin minier de Cherbaix, deux métropoles, Valdrance et Orvenne, le port de Méraud).

Aucune dépendance, aucun build. Ouvrir `index.html` dans un navigateur (ou `python3 -m http.server` puis http://localhost:8000). Le son est synthétisé en WebAudio, il n'y a aucun fichier audio.

## Ce que le MVP contient

- **L'Empreinte en chiffres pleins, en hausse au lancement** (+2,4 %/min). Elle a son propre taux de croissance `g`, somme des contributions des sites encore actifs. L'objectif de l'acte I est de la faire *s'arrêter*, pas de la faire baisser.
- **8 sites** démantelables une fois chacun, plus une **mesure** (autonomie de l'hôpital) qui ne retire rien et ajoute même un peu d'Empreinte.
- **Graphe minimal, 3 dépendances** : la centrale à charbon alimente l'usine de SUV et l'hôpital régional ; la centrale au gaz est le secours de l'hôpital. Le graphe est dessiné sur la carte ; sélectionner un site fait clignoter en rouge ce qu'il couperait maintenant.
- **Coupure → Casse** : fermer une centrale alors que quelque chose en dépend encore coupe le dépendant. La Casse est en gens, en haut à droite, en permanence, et ne redescend jamais.
- **Capacité** dérivée de l'Empreinte : `K/s = K₀ × (E/E₀)^0,6`. **Mains** jamais exponentielles : elles viennent des gens déplacés par les fermetures, à reconvertir par lots de 300 en 45 s réelles, contre un peu de Consentement.
- **Terre rendue** : linéaire en temps réel, par site fermé. La carte verdit site par site. Continue hors ligne (plafond 12 h) ; le démantèlement, lui, ne progresse pas hors ligne.
- **Bouton Relancer** visible dès la première seconde, fonctionnel : 90 s de croissance +4 %/min, Capacité ×4, chantiers ×2, et un peu de Consentement. Chaque relance rehausse le plancher irréductible de 6 %. **Sous 20 % de Consentement, le Conseil relance sans vous.**
- **Deux couches sonores retirées, deux ajoutées** : la rumeur de trafic s'éteint quand le nombre cesse de monter, et le vent arrive ; les turbines s'éteignent au premier chiffre perdu, et les oiseaux arrivent. Une relance ramène l'industrie à plein volume.
- **Les deux moments testés** : la stabilisation (le jeu s'arrête 3 s, le son baisse) et la perte du premier chiffre (le chiffre de tête tombe, l'écran se resserre d'un cran, coup sourd). Un panneau affiche ensuite les données du test : temps jusqu'à l'arrêt, temps jusqu'au chiffre, nombre de relances, Casse, plancher.
- Sauvegarde JSON en `localStorage`, tick à 10 Hz, état en objet plat (`engine.js` est pur et tourne aussi en node).

## Fichiers

| Fichier | Rôle |
|---|---|
| `data.js` | toutes les valeurs de réglage : sites, graphe, constantes |
| `engine.js` | moteur pur (création, tick, engagement, coupures, relance, hors-ligne, formats) |
| `audio.js` | couches sonores synthétisées et sons ponctuels |
| `main.js` | rendu, carte SVG, sauvegarde, boucle |
| `index.html`, `style.css` | l'écran unique |
| `tools/simulate.js` | joueur automatique pour régler le rythme sans navigateur |

```
node tools/simulate.js prudent 10     # bot prudent, 10 s de réaction par action
node tools/simulate.js pressé 10      # ignore les avertissements de coupure
node tools/simulate.js relance-1 10   # une relance à 2 min
node tools/simulate.js croissance     # relance en continu
```

Avec un bot prudent à 10 s de réaction : stabilisation vers 3 min, premier chiffre vers 6 min 30, carte vidée vers 12 min. Un humain sera plus lent d'un facteur 1,5 environ, soit une session de 15 à 20 min.

Crochet de test dans la console : `Jeu.avancer(secondes)`, `Jeu.etat`, `Jeu.engager(id)`, `Jeu.relancer()`.

## Protocole de test (§14)

1. Faire jouer 20 min sans rien expliquer, son allumé.
2. Noter la réaction à deux instants : quand le compteur cesse de monter, et quand il perd son premier chiffre. Si aucun des deux ne fait rien au testeur, le concept ne tient pas.
3. Compter les appuis sur **Relancer** (affiché dans le panneau de fin d'acte). Zéro = bouton pas assez tentant ; dix = pas d'autre stratégie viable.

## Écarts avec le design doc, et pourquoi

- **Les valeurs d'Empreinte des sites de l'acte I sont bien plus petites** que la table du §5 (3 à 6 millions au lieu de 30 à 80). Avec les valeurs du doc, la première fermeture fait passer sous 10⁹ à la 40ᵉ seconde, avant toute stabilisation : le premier chiffre serait perdu par accident et reviendrait. Avec les valeurs retenues, les fermetures de l'acte I sont réellement englouties par la croissance, et le premier chiffre tombe avec le premier chantier lourd (la cimenterie, −120 millions), une fois le nombre arrêté. C'est le retune que le doc annonçait.
- **Le site s'arrête à l'ouverture du chantier**, pas à sa clôture : sa contribution à la croissance cesse et les coupures sont évaluées immédiatement (la centrale est éteinte pour être démontée). L'Empreinte, la récupération de Capacité et les déplacés restent appliqués à la clôture.
- **Une mesure** (autonomie de l'hôpital) a été ajoutée pour qu'il existe une bonne séquence, plus lente que la séquence intuitive, permettant de fermer les deux centrales sans coupure.
- Le plancher irréductible est affiché dans le panneau de fin d'acte, pas dans l'interface courante (il n'est révélé qu'à l'acte IV).
