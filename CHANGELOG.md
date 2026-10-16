# Historique des versions

## Non publié

### Bibliothèque

- **tooling** : trois règles qui lisent l’écran de l’élève — `spoiler` (la réponse d’une question,
  d’une prédiction ou d’un diagnostic se lit dans le schéma, la scène ou l’étape au-dessus ; le
  réglage fautif d’un cas écrit sur son schéma), `term-early` (un terme montré par un schéma ou
  une scène avant d’être introduit), `repeat` (deux questions qui posent la même chose) ;
  `coursekit parcours`, le cours en Markdown tel que l’élève le voit ; `screenReader`.
- **core** : le schéma d’un cas clinique accepte `{ name, arg }`.

### Cours

- `courses/alphazero` (version 4) : relu en entier. Les questions dont la réponse était à l’écran
  sont déplacées ou changées ; les idées faciles ne sont plus reposées ; les mécanismes difficiles
  ont leurs étapes, leur exemple chiffré et leur schéma (le biais corrigé par la recherche, le
  bonus en √N, le détour et la somme du façonnage par potentiel, la variance P(1 − P), la base de
  référence) ; une scène par mécanisme (arbre du morpion, parties au hasard, réseau de neurones) ;
  la généralisation montrée au module 2 sur le petit réseau, avant l’auto-jeu ; chaque cas
  clinique à la fin du module qu’il mobilise.

### Skill

- `generate_course` : carte de difficulté et budgets, tableau des chapitres (ce que chacun
  suppose, sa scène), règles sur les questions (pas de réponse à l’écran, pas de restitution, pas
  de doublon), place des cas cliniques, relecture du `parcours` par un agent sans contexte.

## 0.1.0 — première version

Publication sur GitHub sous licence MIT.

### Bibliothèque

- **core** : format séquentiel des cours (`defineCourse`, constructeur `content(c)`), compilation
  en frise, progression enregistrée avec révisions espacées, glossaire, libellés remplaçables ;
  `fr`, `fmtNumber`, `dec`, `pct` ; `memo` ; `diagramVariants` et `controlBounds` ; interface
  `Stage` avec `layout(safe)`.
- **diagrams** : primitives de dessin, palette, caméra, cache ; fiches T1 à T8 et leurs schémas.
- **exercises** : calcul guidé, classement, mise en ordre, code (tests ou scénarios, PRIMM,
  Parsons, assemblage) et leurs vérifications.
- **ui** : `mountCourse` (accueil, visite pas à pas, pauses, atelier, tests, glossaire, fiches,
  révisions), `noStage`, `imageStage`, `canvasStage` ; zone utile de la scène ; aides au test
  `goto`, `pauses`, `render`, `shots` et l’adresse `/?shots`.
- **tooling** : `coursekit check` (compilation, relecture pédagogique, modèle et affirmations,
  exercices, parcours aux bornes des expériences avec contrôle des textes), `coursekit tune`,
  `coursekit stats`, `coursekit new`.

### Cours

- `courses/fusee` : « Comment fonctionne une fusée », 4 modules et une épreuve.
- `courses/epidemie` : « Comment une épidémie se propage », 4 modules et une épreuve, écrit avec
  `/generate_course`.
- `courses/demo-mini` : cours jouet couvrant chaque élément du format.

### Skill

- `.claude/skills/generate_course` : spécification de `/generate_course <sujet>`, disponible
  dans toute session Claude Code ouverte dans le dépôt.
