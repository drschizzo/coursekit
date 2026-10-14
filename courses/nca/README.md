# Raisonner avec des automates cellulaires neuronaux

Un cours de fin de lycée (spécialité NSI) ou de début de licence (3 à 4 heures) sur l’article
« Reasoning with Neural Cellular Automata » (Etcheverry et al., 2026,
[arXiv 2609.36126](https://arxiv.org/abs/2609.36126)) : comment une grille de cellules qui ne
voient que leurs voisines résout un labyrinthe ou une grille de contraintes.

| Module | Contenu |
|---|---|
| 1. Des cellules qui ne voient que leurs voisines | Automate cellulaire, voisinage 3 × 3, propagation d’une case par pas, taux de mise à jour ; l’automate cellulaire neuronal (canaux, perception, réseau partagé) et le compte de ses paramètres. |
| 2. Résoudre un labyrinthe | La vague d’exploration, l’élagage des impasses ; la règle d’une cellule à programmer (PRIMM) ; nombre de pas et labyrinthes plus grands avec la même règle. |
| 3. Le hasard qui aide | Une grille de contraintes : mises à jour synchrones qui clignotent, minimum local (couture) et bruit passager, essais en parallèle et élagage des niches ; la règle de couleur à programmer (Parsons). |
| 4. Apprendre la règle, économiser le calcul | Rétropropagation dans le temps, réservoir d’échantillons, perturbations ; calcul adaptatif et réparation de dégâts ; ARC-AGI-1 et sudoku en pixels ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul, le test final. |

Le modèle ([src/model.ts](src/model.ts)) contient deux automates écrits à la main qui respectent
les contraintes de l’article (voisinage local, même règle partout, mises à jour au hasard avec
p = 0,8) :

- un **labyrinthe** parfait (tiré au hasard, côtés 9 à 61) résolu par deux règles : une case
  libre devient atteinte quand une voisine l’est, une case atteinte avec au plus une voisine
  vivante meurt. Calcul adaptatif (les cellules sûres se mettent à jour avec un taux plus
  faible) et dégâts (trois disques remis à zéro) ;
- une **grille 10 × 10 à deux couleurs** où deux voisines ne doivent pas avoir la même couleur :
  une cellule change de couleur si au moins la moitié de ses voisines ont la sienne ; bruit
  pendant une partie du déroulement ; K essais en parallèle choisis par le nombre de conflits.

Il contient aussi les formules du compte des paramètres (qui retrouve les 10 000 et 41 000 du
tableau 1), de l’élagage des niches (annexe B.6) et de l’âge des états du réservoir, et les
résultats de l’article (`PAPER`), cités sans être recalculés. Ses fenêtres (exploration puis
élagage selon D, taille du labyrinthe, taux des cellules sûres, grille qui clignote, coincée,
résolue ou agitée par le bruit, essais en parallèle, part de problèmes neufs) sont vérifiées par
[src/tune.ts](src/tune.ts).

```bash
npm run dev -w courses/nca        # depuis la racine du dépôt, http://localhost:5186
npm run tune -w courses/nca
npm run check -w courses/nca
npm run build -w courses/nca      # site statique dans dist/
```

Simplifications : les règles sont écrites à la main, pas apprises ; l’état d’une cellule est
discret (atteinte, morte ; une couleur) au lieu d’un vecteur de canaux ; une cellule « sûre » est
une cellule dont la dernière mise à jour n’a rien changé (l’article utilise la confiance de sa
sortie) ; la grille de contraintes remplace le sudoku ; le bruit inverse une couleur au lieu
d’ajouter un bruit gaussien. Les nombres de pas de ces règles exactes sont bien plus petits que
ceux des NCA apprises. L’entraînement (rétropropagation dans le temps) n’est pas simulé.
