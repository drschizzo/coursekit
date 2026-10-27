# Historique des versions

## Non publié

### Architecture

- **core** : la frise compilée est immuable ; une lecture (`Reading`) porte l’horloge, la pause
  en cours et ce que l’élève y a fait. Corrige une pause fantôme « Modifiez la valeur » qui
  revenait après un retour en arrière.
- **core** : les pauses sont une union discriminée (`TryStop`, `QuizStop`…) décrite par
  `STOP_KINDS` ; les `switch` sur leur sorte sont exhaustifs (`assertNever`).
- **core** : les textes de l’interface ont un dictionnaire par langue (`FR`, `EN`), choisi par
  `language` ; `tr` remplit les valeurs et les pluriels. Plus aucun texte d’interface en dur dans
  `ui` ni dans les messages de l’atelier.
- **core** : la progression enregistrée a un schéma versionné (`PROGRESS_SCHEMA`, migrations),
  rangé sous `coursekit:<id>` ; une nouvelle version du contenu garde les réponses de l’élève.
  La progression enregistrée sous l’ancienne clé est reprise.
- **core** : les révisions (`moduleReview`, `homeReview`) et l’estimation de durée
  (`moduleCounts`) quittent le lecteur ; recherches binaires dans la frise ; `LAYOUT`, la place
  des panneaux, partagée par le thème et le vérificateur.
- **toolbox** : nouveau paquet pour les fiches de maths et leurs schémas, qui quittent
  `diagrams`.
- **diagrams** : `CSS_PALETTE` (le thème lit la palette `CC`) ; cache des schémas par cours.
- **exercises** : les boucles du code de l’élève s’arrêtent au bout de 3 s au lieu de figer la
  page ; `Course`, le type complet d’un cours ; `Verdict.reason`.
- **tooling** : le vérificateur est une liste de vérifications nommées (`CHECKS`), complétée par
  `extra` et filtrée par `skip` ; les tournures interdites dépendent de la langue.
- **Outillage** : ESLint, Vitest (tests de `core`, `exercises`, `tooling`, sans dépendre des
  cours d’exemple), CI GitHub Actions, publication des cours d’exemple sur GitHub Pages
  (`npm run build:site`).

### Adapter un cours

- `export default Object.assign(course, { workshop })` → `workshop` dans `defineCourse({ … })`.
- `pickCapsules` s’importe de `@coursekit/toolbox` (ajouter `"@coursekit/toolbox": "*"` aux
  dépendances du cours).
- Les couleurs de la palette s’écrivent `CC.acc`, `CC.blue`… au lieu de leur valeur.
- Code qui lisait l’état de lecture sur la frise (`tl.stop`, `tl.t`, `st.ov`) : il est sur
  `handle.reading` (`reading.stop`, `reading.t`, `reading.state(st).ov`).
- `ProgressStore.load/save` manipulent une valeur quelconque (le schéma l’enveloppe) ;
  `labelsFor(langue, remplacements)` ; `renderQuiz(el, q, L, options)`.

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
