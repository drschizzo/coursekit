# Architecture

## Les paquets

```
            ┌──────────────┐
            │     core     │  format, constructeur, frise, progression, nombres
            └──────┬───────┘
         ┌─────────┼──────────┐
   ┌─────▼────┐ ┌──▼────────┐ │
   │ diagrams │ │ exercises │ │
   └─────┬────┘ └──┬────────┘ │
         └────┬────┴──────────┤
        ┌─────▼────┐    ┌─────▼────┐
        │    ui    │    │ tooling  │
        └─────┬────┘    └──────────┘
              │  (navigateur)      (Node : check, tune, new)
        ┌─────▼──────────────────────┐
        │ un cours : courses/<id>    │  modèle, schémas, scène, contenu
        └────────────────────────────┘
```

- **core**, **diagrams** (hors dessin), **exercises** et **tooling** n’utilisent pas le DOM : le
  vérificateur compile et parcourt un cours dans Node.
- **ui** est le seul paquet qui dépend du navigateur.
- Un cours ne dépend que des paquets ; la bibliothèque ne sait rien de ses sujets.

## Du contenu à l’écran

1. **Le contenu** (`content(c)`) appelle le constructeur dans l’ordre de lecture.
2. **`compile(course)`** en fait une `Timeline` : chaque étape reçoit une durée d’animation tirée
   de sa longueur ; chaque pause (question, expérience, explication, atelier, test) est placée
   juste après l’étape qu’elle suit, jamais au début d’une étape ; les cartes de module, les
   révisions et les étapes qui annoncent les questions posées avant l’explication sont ajoutées.
   Les valeurs (`defaults`, `set`, réglages d’une scène, curseurs d’une expérience) sont des
   couches évaluées à chaque instant (`eval(t)`).
3. **Le lecteur** (`mountCourse`) fait avancer une horloge, pas à pas par défaut : elle parcourt
   une étape (le schéma et la scène s’animent) puis attend l’élève. À chaque image, il dessine le
   schéma du moment avec `eval(t)`, transmet à la scène les valeurs de `stageKeys`, et lui donne
   la zone utile (`safe`) calculée à partir de la place des panneaux.
4. **La progression** est enregistrée au fur et à mesure (réponses avec degré de confiance,
   révisions espacées, prédictions, expériences, explications, exercices, tests).

## Les quatre points d’extension

| Point | Ce qu’un cours fournit |
|---|---|
| **Le modèle** (`DomainModel`) | Ses fonctions, ses `checks`. Tout le reste l’appelle. |
| **Les schémas** | Des fonctions `(ctx, env)` dans un espace de 380 × 236. |
| **La scène** (`Stage`) | Un canevas (`canvasStage`), des images, ou une implémentation propre (3D, application existante). |
| **Les exercices** | Quatre types sans programmation obligatoire (calcul, classement, ordre) et un type code. |

## La vérification

`coursekit check` s’appuie sur les mêmes briques que le lecteur : `compile` pour la frise,
`createGlossary` pour l’ordre des termes, les vérifications de `exercises`, `diagramVariants`
pour dessiner chaque schéma aux valeurs que l’élève peut atteindre, et un contexte de canevas
factice qui enregistre les textes tracés. `coursekit tune` exécute le modèle seul, sur une grille.

## Origine

coursekit a été extrait du cours intégré au projet avbd (« Anatomie d’un moteur physique ») :
le lecteur, la frise, les pauses, l’atelier, les fiches, les révisions et le vérificateur en
viennent. Le format séquentiel (sans horodatage), le modèle comme point d’extension, les types
d’exercices sans code, le réglage et les contrôles aux bornes ont été ajoutés pour que la
bibliothèque convienne à n’importe quel sujet. Le cours fusée a servi de premier test ; ce qu’il a
appris est dans [bilan.md](bilan.md).
