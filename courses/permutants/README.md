# Les mondes de La Cité des permutants

Un cours pour les lecteurs du roman de Greg Egan, *La Cité des permutants* (*Permutation City*,
1994), à partir de la fin du lycée (3 à 4 heures). Il explique les notions de simulation et
d’automate cellulaire du roman, surtout celles de la seconde partie (chapitre 23 à l’épilogue) :
l’Élysium, univers d’ordinateurs bâti sur l’automate TVC ; le Cosmoplexe, une physique jouet qui
tourne en son sein ; les Lambertiens, qui finissent par expliquer leur monde sans leurs créateurs.

Question centrale : comment un univers fait de règles peut-il en contenir un autre, et pourquoi
la découverte des Lambertiens défait-elle celui qui les fait tourner ?

| Module | Contenu |
|---|---|
| 1. Des univers faits de règles | Automate cellulaire élémentaire, numéro d’une règle (exercice de code PRIMM) ; antécédents, configurations jardin d’Éden, règles réversibles, l’argument de Durham ; l’expérience de Paul et la théorie de la poussière : une histoire mélangée se remet en ordre par la règle (exercice de code Parsons). |
| 2. L’Élysium, un univers d’ordinateurs | Constructeur et ordinateur universels, pourquoi six dimensions ; le lancement et les simulations emboîtées (ralentissement 250) ; une matrice qui croît comme un cristal contre le Temps standard ; les 24 pyramides ; la Cité et la RV composite ; Peer, la machine finie et la Nation solipsiste. |
| 3. Le Cosmoplexe et la planète Lambert | 32 atomes en couleurs fausses, ce qui manque à cette physique, la conservation des atomes ; trois milliards d’années, un seul ancêtre, le déterminisme ; le bord du monde (tore ou frontière ouverte) ; agir sans tricher : la couche limite, l’atome rouge et le vaisseau. |
| 4. La guerre des explications | La danse lambertienne ; la longueur d’une explication en bits (classique, équations de champ, créateurs) ; le contact, l’horloge qu’on ne peut plus ralentir, le rejet des règles TVC (un monde éternel) ; l’implosion de la Cité, l’évacuation, le monde de Riemann, « il ne peut y avoir de dieux » ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul (une Copie qui sent un saut), le test final. |

Le modèle ([src/model.ts](src/model.ts)) fait tourner des versions miniatures des mondes du
roman :

- un **automate cellulaire élémentaire** sur un anneau (les 256 règles), le décompte des
  antécédents de chaque configuration (jardins d’Éden, règles réversibles), le cycle où finit
  toute machine finie, et une machine qui grandit ;
- la **poussière** : une histoire de la règle 30 calculée par tranches dans un ordre mélangé,
  remise en ordre par la seule règle, et ce que fait un instant jamais calculé ;
- le **bord du Cosmoplexe** : une bande où des atomes avancent selon la règle 184 (qui les
  conserve), une couche limite hors des lois, une injection à l’intérieur (loi violée, ou
  écriture ignorée quand les règles sont défendues) ou par le bord ; un bilan thermique où la
  lumière quitte le volume ou revient (tore) ;
- la **matrice TVC** : (1 000 + 2t)³ processeurs contre une demande qui croît avec le Temps
  standard, en t^a ; les ralentissements emboîtés ;
- la **compétition des explications** : longueur en bits de la théorie classique, des équations
  de champ et de l’histoire des créateurs, selon la précision des abondances mesurées.

Les chiffres cités du roman sont dans `BOOK` (jamais recalculés), les constantes des modèles
jouets dans `TOY`. Les fenêtres des expériences et des cas cliniques (règles sans jardin
d’Éden, histoire intacte ou cassée, boucle avant 2^N cycles, surplus ou manque de processeurs,
porte de la couche limite, aqua liquide ou bouillante, seuil des équations de champ) sont
vérifiées par [src/tune.ts](src/tune.ts).

```bash
npm run dev -w courses/permutants        # depuis la racine du dépôt, http://localhost:5187
npm run tune -w courses/permutants
npm run check -w courses/permutants
npm run build -w courses/permutants      # site statique dans dist/
```

Simplifications : le TVC et le Cosmoplexe sont remplacés par des automates à une dimension ; la
règle 184 tient lieu de physique qui conserve les atomes ; le bilan thermique suit une seule
grandeur (la lumière stockée dans le volume) et l’aqua a une fenêtre liquide fixée par le
modèle ; l’accélération du Temps standard en puissance du temps est une hypothèse du cours ; les
longueurs en bits des théories sont des valeurs choisies pour placer le seuil, pas tirées du
roman ; le « défense des règles » après l’arrivée des Lambertiens est un interrupteur qui
reproduit le récit, pas un mécanisme. La théorie de la poussière est présentée comme l’hypothèse
du roman, non comme un fait.
