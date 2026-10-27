# Architecture

## Les paquets

```
            ┌──────────────┐
            │     core     │  format, constructeur, frise, lecture, progression,
            └──────┬───────┘  textes de l’interface, nombres
         ┌─────────┼──────────────┐
   ┌─────▼────┐ ┌──▼────────┐     │
   │ diagrams │ │ exercises │     │
   └─────┬────┘ └──┬────────┘     │
   ┌─────▼────┐    │              │
   │ toolbox  │    │              │
   └─────┬────┘    │              │
         └────┬────┴──────────────┤
        ┌─────▼────┐        ┌─────▼────┐
        │    ui    │        │ tooling  │
        └─────┬────┘        └──────────┘
              │  (navigateur)       (Node : check, tune, parcours, new)
        ┌─────▼──────────────────────┐
        │ un cours : courses/<id>    │  modèle, schémas, scène, contenu
        └────────────────────────────┘
```

- **core**, **diagrams** (hors dessin), **toolbox**, **exercises** et **tooling** n’utilisent pas
  le DOM : le vérificateur compile et parcourt un cours dans Node.
- **ui** est le seul paquet qui dépend du navigateur.
- **diagrams** ne contient que des primitives de dessin et la palette ; les fiches de maths et
  leurs schémas sont du contenu, dans **toolbox**.
- Un cours ne dépend que des paquets ; la bibliothèque ne sait rien de ses sujets. Les cours de
  `courses/` sont des exemples : aucun paquet ni aucun test de la bibliothèque ne les importe.

## Du contenu à l’écran

1. **Le contenu** (`content(c)`) appelle le constructeur dans l’ordre de lecture.
2. **`compile(course)`** en fait une `Timeline` : chaque étape reçoit une durée d’animation tirée
   de sa longueur ; chaque pause (question, expérience, explication, atelier, test) est placée
   juste après l’étape qu’elle suit, jamais au début d’une étape ; les cartes de module, les
   révisions et les étapes qui annoncent les questions posées avant l’explication sont ajoutées.
   La frise est ensuite **immuable** : c’est ce que le cours *est*.
3. **Une lecture** (`Reading`) porte ce qu’une lecture de la frise *fait* : l’horloge, la pause
   en cours, et ce que l’élève a fait dans chaque pause (réglages, objectifs, prédiction). Les
   valeurs à un instant sont des couches : `defaults`, `set`, réglages de la scène
   (`Timeline.eval`), puis les expériences en cours (`Reading.eval`). Revenir en arrière oublie
   ce qui a été fait après ; la frise, elle, n’est jamais modifiée.
4. **Le lecteur** (`mountCourse`) fait avancer la lecture, pas à pas par défaut : elle parcourt
   une étape (le schéma et la scène s’animent) puis attend l’élève. À chaque image, il dessine le
   schéma du moment, transmet à la scène les valeurs de `stageKeys`, et lui donne la zone utile
   (`safe`) calculée à partir de la place des panneaux.
5. **La progression** est enregistrée au fur et à mesure (réponses avec degré de confiance,
   révisions espacées, prédictions, expériences, explications, exercices, tests), avec la version
   de son schéma : une nouvelle version du contenu la garde.

## Les sortes de pauses

Une pause (`Stop`) est une union discriminée par `kind` : `try`, `quiz`, `card`, `review`,
`explain`, `lab`, `test`. `STOP_KINDS` dit pour chacune si le lecteur peut la sauter et dans
quelle ligne de l’estimation de durée elle compte. Pour ajouter une sorte de pause :

1. son type dans `timeline.ts` et sa ligne dans `STOP_KINDS` ;
2. son appel dans le constructeur (`builder.ts`) ;
3. le compilateur signale alors chaque `switch` exhaustif à compléter (`assertNever`) : son
   affichage dans le panneau, son repère sur la frise ;
4. ses règles dans le vérificateur et sa place dans `coursekit parcours`.

## Une seule source

| Ce qui est partagé | Où il est défini | Qui le lit |
|---|---|---|
| Les textes de l’interface | `labels.ts` (core), un dictionnaire par langue | le constructeur, le lecteur, les messages de l’atelier |
| La palette | `CC` (diagrams) | les schémas, les scènes, et le thème via `CSS_PALETTE` |
| La place des panneaux | `LAYOUT` (core) | le thème via `layoutCss()`, le vérificateur via `wideSafeArea` |
| Les sortes de pauses | `STOP_KINDS` (core) | la lecture, l’estimation de durée, le panneau |
| Le placement des bonnes réponses | `placeAnswer` (core) | le constructeur, `choice` |

## Les points d’extension

| Point | Ce qu’un cours fournit |
|---|---|
| **Le modèle** (`DomainModel`) | Ses fonctions, ses `checks`. Tout le reste l’appelle. |
| **Les schémas** | Des fonctions `(ctx, env)` dans un espace de 380 × 236, dessinées avec `CC`. |
| **La scène** (`Stage`) | Un canevas (`canvasStage`), des images, ou une implémentation propre (3D, application existante). |
| **Les exercices** | Quatre types sans programmation obligatoire (calcul, classement, ordre) et un type code. |
| **Les textes** | `language` choisit le dictionnaire ; `labels` remplace des textes. |
| **La progression** | Un `ProgressStore` sur mesure (serveur, autre stockage). |
| **Les vérifications** | `checkCourse(course, { extra, skip })` : des règles propres au projet, ou des règles tues. |

## La vérification

`coursekit check` s’appuie sur les mêmes briques que le lecteur : `compile` pour la frise,
`createGlossary` pour l’ordre des termes, les vérifications de `exercises`, `diagramVariants`
pour dessiner chaque schéma aux valeurs que l’élève peut atteindre, et un contexte de canevas
factice qui enregistre les textes tracés. Ses règles sont une liste de vérifications nommées
(`CHECKS`) qui lisent un contexte commun. `coursekit tune` exécute le modèle seul, sur une
grille.

## Les tests et la diffusion

- `npm test` : typage, lint (ESLint), tests unitaires (Vitest : `packages/*/test`), puis
  `check` et `tune` de chaque cours d’exemple. Les tests unitaires ne dépendent d’aucun cours.
- La CI (`.github/workflows/ci.yml`) lance `npm test` à chaque push et pull request ; sur
  `main`, elle construit tous les cours d’exemple (`npm run build:site`) et les publie sur GitHub
  Pages, chacun à sa propre adresse.
