# Validation indépendante

Ce dossier vérifie le modèle du cours contre **OpenSpiel**, la bibliothèque de jeux et
d'algorithmes de DeepMind : une implémentation écrite par d'autres, qui ne partage aucune ligne
de code avec `src/model.ts`.

## Ce qui est comparé

- l'arbre complet du morpion : 549 946 nœuds dans les deux implémentations ;
- la valeur minimax du plateau vide : nulle dans les deux ;
- la force de la recherche Monte-Carlo pure (une partie au hasard par feuille, coup le plus
  visité, sans MCTS-Solver) : 100 parties contre un joueur parfait qui choisit au hasard parmi
  ses coups optimaux, la moitié en jouant X.

Le protocole est le même des deux côtés ; seuls les tirages diffèrent. Le modèle vérifie à chaque
`coursekit check` que, pour chaque réglage, les intervalles de Wilson à 95 % se recouvrent
(`src/openspiel.ts` contient les résultats d'OpenSpiel).

Défaites sur 100 parties, avec l'intervalle à 95 % :

| Réglage | Ce cours | OpenSpiel |
|---|---|---|
| 10 simulations, c = 5 | 73 (64–81) | 69 (59–77) |
| 25 simulations, c = 5 | 48 (38–58) | 53 (43–62) |
| 50 simulations, c = 5 | 36 (27–46) | 39 (30–49) |
| 100 simulations, c = 5 | 25 (18–34) | 27 (19–36) |
| 200 simulations, c = 5 | 15 (9–23) | 18 (12–27) |
| 400 simulations, c = 5 | 6 (3–12) | 10 (6–17) |
| 800 simulations, c = 5 | 3 (1–8) | 1 (0–5) |
| 1200 simulations, c = 5 | 1 (0–5) | 1 (0–5) |
| 1600 simulations, c = 5 | 0 (0–4) | 0 (0–4) |
| 3200 simulations, c = 5 | 0 (0–4) | 0 (0–4) |
| 1 600 simulations, c = 0 | 53 (43–62) | 51 (41–61) |
| 1 600 simulations, c = 0.1 | 20 (13–29) | 19 (13–28) |
| 1 600 simulations, c = 0.5 | 6 (3–12) | 15 (9–23) |
| 1 600 simulations, c = 1.5 | 1 (0–5) | 4 (2–10) |
| 1 600 simulations, c = 3 | 0 (0–4) | 2 (1–7) |
| 1 600 simulations, c = 10 | 0 (0–4) | 0 (0–4) |
| 1 600 simulations, c = 25 | 1 (0–5) | 0 (0–4) |
| 1 600 simulations, c = 50 | 11 (6–19) | 9 (5–16) |
| 1 600 simulations, c = 100 | 15 (9–23) | 17 (11–26) |

## Ce que la comparaison a corrigé

1. **Un biais d'ordre.** Notre première version départageait les égalités en faveur des
   premières cases du plateau. OpenSpiel mélange les coups avant de les développer. Avec une
   exploration très forte, les visites sont presque égales et ce biais favorisait, par hasard,
   de bons coups : 15 défaites contre 66 à c = 100. Les coups sont maintenant mélangés.
2. **Une différence de règle.** La fonction `puct_value` d'OpenSpiel note un enfant terminal
   par son résultat exact, sans bonus d'exploration ; avec un c grand, une victoire immédiate
   n'est alors visitée qu'une fois. La règle d'AlphaZero, celle du cours, applique le même score
   à tous les enfants. Le script compare donc aussi OpenSpiel avec la règle d'AlphaZero
   (`puct_az`) : c'est cette comparaison qui figure ci-dessus.
3. **Le réglage nominal.** À c = 1,5, OpenSpiel perd 4 parties sur 100 : l'ancien réglage était à
   la limite. Le cours utilise c = 5, où les deux implémentations ne perdent aucune partie.

## Reproduire

```bash
python3 -m venv venv && ./venv/bin/pip install open_spiel
./venv/bin/python validation/openspiel_mcts.py > validation/openspiel.json
```

Puis recopier les nombres dans `src/openspiel.ts` et lancer `npm run check -w courses/alphazero`.

## Ce que cette validation ne couvre pas

- l'auto-jeu avec réseau et le robot : OpenSpiel propose un AlphaZero, mais il dépend de
  TensorFlow ou JAX et d'un autre réseau ; les résultats de ces parties du cours reposent sur
  leurs propres vérifications (`src/tune.ts`, sur 4 à 8 graines) et sur les théorèmes qu'elles
  illustrent (façonnage par potentiel, variance d'une récompense binaire) ;
- les chiffres publiés (`FACTS`) : ils sont cités, avec leur source, et non recalculés. La source
  d'AlphaNIST est une page de projet sans article ni auteurs ; la formule de SGS vient de
  l'article de Zhang et al. (arXiv 2610.12465, section 3.2).
