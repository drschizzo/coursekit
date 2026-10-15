# AlphaGo, AlphaZero et AlphaNIST

Un cours de niveau lycée (4 à 5 heures) sur l’apprentissage par la recherche et par l’expérience :
d’AlphaGo et AlphaZero jusqu’à [AlphaNIST](https://alpha-nist.github.io/), qui reprend la même
philosophie pour un bras robotique qui assemble des pièces.

Question centrale : comment un programme apprend-il seul à jouer au go mieux que les champions,
et comment la même idée apprend-elle à un robot à assembler des pièces ?

| Module | Contenu |
|---|---|
| 1. Chercher dans un arbre de jeu | Positions, coups, arbre de jeu du morpion (compté en entier) ; minimax et le joueur parfait ; facteur de branchement, taille des arbres des échecs et du go, fonction d’évaluation. |
| 2. La recherche Monte-Carlo | Parties au hasard et leur biais ; les quatre temps d’une simulation ; le score PUCT, exploration et exploitation (exercice de code PRIMM) ; la rétropropagation (exercice de code Parsons) ; la force selon le nombre de simulations ; page d’assemblage. |
| 3. AlphaGo et AlphaZero | Réseau de politique et réseau de valeur ; AlphaGo (apprentissage supervisé puis par renforcement, le coup 37) ; la boucle d’auto-jeu, le bruit d’exploration ; AlphaGo Zero et AlphaZero, sans connaissance humaine. |
| 4. AlphaNIST : du plateau de jeu au robot | Le plateau d’assemblage NIST ; récompense binaire contre récompense dense ; états de départ et échantillonnage guidé par le succès (SGS) ; comportements émergents, limites ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul (une récompense dense trop forte), le test final. |

Le modèle ([src/model.ts](src/model.ts)) fait tourner trois machines miniatures :

- le **morpion** : l’arbre complet (255 168 parties, 5 478 positions, 549 946 nœuds, vérifiés),
  minimax et le joueur parfait ;
- la **recherche Monte-Carlo** avec la règle PUCT d’AlphaZero, évaluée par des parties au hasard,
  puis un **AlphaZero miniature** : deux tables (politique et valeur, partagées entre positions
  symétriques) à la place des réseaux, apprises par auto-jeu avec bruit de Dirichlet à la racine
  et tirage des coups selon les visites ; sa force est mesurée exactement contre le joueur parfait ;
- un **assemblage robotique** en cinq sous-étapes (saisir, orienter, approcher, aligner, insérer),
  entraîné en espérance depuis des états de départ tirés uniformément, seulement au début de la
  tâche, ou par SGS (une bosse en forme de loi Bêta autour d’un taux de succès visé, avec un
  plancher), avec une récompense binaire ou dense ; l’orientation peut se faire en forçant l’écrou
  ou en le reposant pour le reprendre.

Les fenêtres réglées dans [src/tune.ts](src/tune.ts) :

| Réglage | Fenêtre |
|---|---|
| MCTS pur, simulations par coup (c = 1,5) | perd souvent jusqu’à 50, ne perd presque jamais dès 1 200 (sur 40 parties contre le joueur parfait) |
| MCTS pur, constante c (1 600 simulations) | perd souvent à 0, perd encore à 0,1 et à 100, ne perd presque jamais de 1,5 à 25 |
| Auto-jeu, bruit d’exploration (600 parties) | sans bruit : 3 parties distinctes, battable (cas clinique) ; dès 0,5 : imbattable |
| Robot, échantillonneur (250 itérations) | tâche complète seule : bloqué ; uniforme : trop lent ; SGS : maîtrisé |
| Robot, cible de SGS | maîtrisé de 0,05 à 0,6 ; trop lent à 0,02 ; dès 0,7, réussit l’entraînement et échoue la tâche (cas clinique à 0,95) |
| Robot, poids de la récompense dense | 0 : maîtrisé, l’écrou est repris ; dès 0,6 : plafonne vers 40 %, ne le reprend jamais (cas d’épreuve) |

Les résultats publiés (AlphaGo, AlphaGo Zero, AlphaZero, AlphaNIST, SGS) sont cités dans `FACTS`,
jamais recalculés.

```bash
npm run dev -w courses/alphazero     # http://localhost:5188
npm run tune -w courses/alphazero
npm run check -w courses/alphazero
npm run build -w courses/alphazero   # site statique dans dist/
```

Simplifications : des tables à la place des réseaux de neurones (elles ne généralisent pas) ; un
bruit d’exploration uniforme (Dirichlet de paramètre 1) ; le morpion à la place du go ; le robot est
une chaîne de probabilités entraînée en espérance, sans physique ni capteurs, et le signal
d’apprentissage d’une récompense binaire est pris proportionnel à P(1 − P) ; la récompense dense ne
pénalise que le détour de la reprise. Notions laissées de côté : l’architecture des réseaux
(convolutions, résidus), la descente de gradient, le passage de la simulation au robot réel,
l’ordre de montage de plusieurs pièces.
