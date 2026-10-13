# Historique des versions

## 0.1.0 — première diffusion restreinte

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
- `courses/demo-mini` : cours jouet couvrant chaque élément du format.

### Skill

- `skill/generate_course` : spécification de `/generate_course <sujet>`.
