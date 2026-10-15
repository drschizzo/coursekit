# AlphaGo, AlphaZero et AlphaNIST

Un cours de fin de lycée (4 à 5 heures) sur l'apprentissage par la recherche et par l'expérience,
d'AlphaGo et AlphaZero jusqu'à [AlphaNIST](https://alpha-nist.github.io/), qui reprend la même
philosophie pour un bras robotique qui assemble des pièces.

Question centrale : comment un programme apprend-il seul à jouer au go mieux que les champions,
et comment la même idée apprend-elle à un robot à assembler des pièces ?

Cinq idées-clés reviennent dans chaque module : **chercher améliore ce qu'on sait** ; **explorer
ou exploiter** ; **une estimation est biaisée ou bruitée** ; **généraliser** ; **attribuer le
mérite**.

| Module | Contenu |
|---|---|
| 1. Chercher | Arbre de jeu et minimax ; parties au hasard (biais) et intervalle de confiance (bruit) ; les quatre temps de la recherche Monte-Carlo ; le score PUCT et la constante d'exploration ; la force selon le nombre de simulations, vérifiée contre OpenSpiel. Exercices de code : PUCT (PRIMM), rétropropagation (Parsons), assemblage. |
| 2. Apprendre une intuition | Politique et valeur ; descente de gradient sur un réseau de valeur à deux paramètres (taux d'apprentissage) ; un réseau qui généralise aux positions jamais vues, contrairement à une table. |
| 3. Apprendre en jouant contre soi | D'AlphaGo à AlphaZero ; la boucle d'auto-jeu ; la recherche améliore la politique (mesuré) ; bruit à la racine et température, sur 5 graines. |
| 4. AlphaNIST : du jeu au robot | Récompense rare et variance P(1 − P) ; SGS avec la formule de l'article ; points de proximité contre façonnage par potentiel (Ng et al., 1999) ; attribution du mérite, base de référence, effondrement sur 8 graines ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul (une récompense de proximité trop forte, à distinguer d'un effondrement par les graines), le test final. |

## Le modèle

[src/model.ts](src/model.ts) fait tourner :

- le **morpion** : l'arbre complet, minimax, le joueur parfait ;
- la **recherche Monte-Carlo** avec la règle PUCT d'AlphaZero, coups mélangés à l'expansion ; ses
  matchs de 100 parties sont donnés avec leur intervalle de Wilson à 95 % ;
- une **descente de gradient** sur v = a × (menaces) + b, entraîné sur les 4 520 positions non
  finies, comparée au minimum des moindres carrés ;
- un **AlphaZero miniature** : un réseau 18 → 32 → (politique, valeur), entraîné par descente de
  gradient stochastique sur les parties d'auto-jeu (8 symétries, tampon de 4 000 exemples, pas
  décroissant), avec bruit de Dirichlet à la racine et température ; mesures exactes contre le
  joueur parfait, part de coups optimaux de la politique et de la recherche, généralisation aux
  positions jamais rencontrées ;
- un **robot** : cinq sous-étapes, quatre variantes de pièce (dont une défectueuse), un horizon
  fixe ; REINFORCE avec retour à venir et base de référence apprise ; SGS avec le noyau et les
  réglages de l'article (t = 0,5, κ = 1, ε = 10⁻⁴, T = 2, H = 100) ; récompense binaire, points de
  proximité, ou façonnage par potentiel ; mesure de la variance du gradient.

Les fenêtres réglées dans [src/tune.ts](src/tune.ts) doivent tenir **pour chaque graine** listée :

| Réglage | Fenêtre |
|---|---|
| MCTS pur, simulations (c = 5) | perd souvent jusqu'à 50 ; au plus 1 sur 100 dès 1 600 (avec intervalles) |
| MCTS pur, constante c | perd souvent à 0 ; au plus 1 sur 100 de 3 à 10 ; perd encore à 0,1 et 100 |
| Auto-jeu, bruit × température (5 graines) | nominal : ≥ 4 graines sous 5 % ; sans température : aucune (cas clinique) ; sans bruit : ≤ 2 |
| Auto-jeu nominal | la recherche choisit nettement plus souvent un coup optimal que la politique ; la politique bat le hasard sur les positions jamais vues |
| Descente de gradient, η | trop lent ≤ 0,03 ; minimum de 0,1 à 0,65 ; diverge ≥ 0,7 |
| Robot, tirage | uniforme : trop lent ; SGS : maîtrisé ; tâche complète seule : bloqué |
| Robot, cible de SGS | maîtrisé de 0,1 à 0,5 ; ≥ 0,9 : réussit l'entraînement, échoue la tâche (cas clinique) |
| Robot, récompense | proximité, w ≥ 3 : plafonne à chaque graine (cas d'épreuve) ; potentiel : jamais |
| Robot, pas × lot × base (8 graines) | pas 256, lots de 4 : ≥ 2 graines plafonnent ; pas 64, lots de 4 : la base l'évite |
| Variance du gradient | la base la réduit d'au moins 15 % ; le potentiel bien dosé aussi |

Validation indépendante : [validation/README.md](validation/README.md) (OpenSpiel, DeepMind).

```bash
npm run dev -w courses/alphazero     # http://localhost:5188
npm run tune -w courses/alphazero
npm run check -w courses/alphazero
npm run build -w courses/alphazero   # site statique dans dist/
```

Simplifications : le morpion à la place du go ; un réseau d'une couche ; un bruit de Dirichlet de
paramètre 1 ; le robot est une chaîne de probabilités sans physique ni capteurs ; REINFORCE au lieu
de PPO. Le mécanisme proposé pour l'échec des récompenses denses d'AlphaNIST est plausible, pas
démontré. Notions laissées de côté : la rétropropagation du gradient dans un réseau profond, PPO
en détail, le passage de la simulation au robot réel, l'ordre de montage de plusieurs pièces.
