# Bilan de la phase de test : le cours « Comment fonctionne une fusée »

## Ce qui a été construit

| | lignes | contenu |
|---|---|---|
| Bibliothèque (`packages/*`) | ≈ 4 800 | core, ui, diagrams, exercises, tooling |
| Cours jouet (`courses/demo-mini`) | ≈ 310 | 2 modules, chaque élément du format utilisé une fois |
| Cours fusée (`courses/fusee`) | ≈ 1 400 | 4 modules + épreuve, 14 chapitres, 37 étapes, 14 questions, 9 expériences, 7 explications écrites, 7 exercices, 3 cas cliniques, 5 paires de questions avant/après, 17 termes, 3 fiches |

Répartition du cours fusée : modèle 338 lignes, schémas 341, scène 164, contenu 566. Le contenu
proprement dit (textes, questions, exercices) représente donc environ 40 % du code ; le reste est
le modèle exécutable et ce qui le montre.

Le cours passe les quatre niveaux du vérificateur (`npm run check:fusee` : « ✓ prêt ») et a été
parcouru dans le navigateur : scène animée (pas de tir, vol complet), dix schémas, atelier (calcul
guidé, PRIMM, Parsons).

## Ce qui a bien fonctionné

- **Le format séquentiel.** Écrire `c.step`, `c.ask`, `c.experiment`… dans l’ordre de lecture,
  sans horodatage, est naturel. Les cartes de module, les révisions et les pauses sont placées
  par le compilateur.
- **Le modèle comme source unique.** Tous les chiffres du texte sont calculés (`fr(DV[1])`…) et
  les affirmations (`claims`) sont vérifiées par le modèle. Quand le lanceur a été réglé à
  nouveau, les textes ont suivi sans retouche.
- **La relecture automatique.** Le vérificateur a trouvé, sur le premier jet, deux termes
  employés avant le module qui les introduit et une bonne réponse trop longue. Ces erreurs sont
  exactement celles qu’un auteur (humain ou Claude) laisse passer.
- **Les points d’extension.** Rien dans la bibliothèque ne parle de programmation ou de physique :
  la fusée a utilisé les mêmes types d’exercices (calcul guidé, classement, mise en ordre) que
  n’importe quel sujet, plus deux exercices de code parce que coder le modèle fait partie du sujet.

## Difficultés rencontrées

1. **Régler le modèle a été le plus long.** Le premier lanceur n’atteignait l’orbite pour aucun
   angle de basculement. Il a fallu un script de réglage (balayage des paramètres), un guidage du
   second étage et un arrêt des moteurs à la vitesse orbitale pour obtenir une fenêtre nette :
   orbite de 5 à 8°, vol suborbital en dessous, retombée au-dessus. Sans cette fenêtre, ni
   l’expérience ni les cas cliniques n’ont de sens. **Le modèle doit être écrit et réglé avant
   le contenu.**
2. **La place de la scène.** Le panneau de texte occupe le bas à gauche et le schéma le bas à
   droite ; la première version de la scène dessinait le pas de tir sous le panneau. La zone
   utile n’est documentée nulle part.
3. **Les schémas aux valeurs extrêmes.** Les chevauchements de libellés et deux affichages faux
   (« périgée −6 371 km » pour un vol vertical, une marge calculée sur la vitesse d’impact) ne se
   voyaient qu’en dessinant les schémas avec les réglages extrêmes des expériences. Le parcours
   automatique ne les dessine qu’avec les valeurs du fil du cours.
4. **Naviguer pour tester.** `handle.chapter()` et `handle.next()` s’arrêtent aux questions ;
   vérifier un chapitre précis dans le navigateur demande de répondre aux pauses.
5. **Deux défauts de la bibliothèque**, corrigés : les modules étaient numérotés à partir de 0
   (« Module 0 » dans la barre et la frise), et les titres des cas cliniques n’avaient pas de
   séparateur (« Cas une fusée… »).

## Stabilisation de l’API proposée

| Sujet | Proposition |
|---|---|
| Nombres en français | Déplacer `fr(x, n)` (virgule, espaces fines) dans `@coursekit/core` : chaque cours l’a réécrit. |
| Zone utile de la scène | `CanvasScene.draw` reçoit un rectangle `safe` (la zone non couverte par les panneaux) ; documenter la règle « l’action dans le tiers haut et au centre ». |
| Variantes de schémas | Le parcours dessine chaque schéma d’une expérience aux bornes de ses contrôles, et `coursekit shots` produit les images (navigateur sans tête) pour une relecture visuelle rapide. |
| Mode test du lecteur | `mountCourse(..., { test: true })` : `goto(chapitre, étape)` sans s’arrêter aux pauses, et `window.course.render(diagramme, valeurs)` pour dessiner un schéma isolé. |
| `Claim.check(model)` | Le paramètre n’est jamais utilisé (les cours ferment sur leur modèle) : le retirer. |
| Mémoïsation | Le cache des vols est dans le modèle (`flightOf`) ; documenter ce choix plutôt que `cached()` pour les simulations coûteuses partagées par la scène et les schémas. |
| Script de réglage | `coursekit tune` : un fichier `tune.ts` à côté du modèle, lancé par la CLI, qui affiche les issues sur une grille de paramètres. C’est l’outil qui a manqué. |

Aucune de ces propositions ne casse le format des cours existants.

## Conséquences pour la skill `/generate_course`

La spécification est dans [`skill/generate_course/SKILL.md`](../skill/generate_course/SKILL.md).
Les leçons de ce bilan y sont des règles : modèle d’abord et réglé par balayage, fenêtre de
réussite vérifiée par une `check` du modèle, schémas relus aux valeurs extrêmes, scène dans la
zone utile, vérificateur à zéro erreur avant toute relecture dans le navigateur.
