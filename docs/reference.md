# Référence

Les paquets exposent leurs sources TypeScript (`exports` pointe sur `src/index.ts`) : ils
s’utilisent avec un outil qui comprend TypeScript (Vite, Node ≥ 22.18). Les types complets, avec
leurs commentaires, sont dans `packages/*/src`. Cette page liste ce qu’un cours utilise.

- [@coursekit/core](#coursekitcore)
- [@coursekit/diagrams](#coursekitdiagrams)
- [@coursekit/exercises](#coursekitexercises)
- [@coursekit/ui](#coursekitui)
- [@coursekit/tooling](#coursekittooling)

## @coursekit/core

Sans DOM : un cours peut être compilé, parcouru et vérifié partout.

### Écrire un cours

| Export | Description |
|---|---|
| `defineCourse(def: CourseDef): CourseDef` | Identité typée : `export default defineCourse({ … })`. |
| `CourseDef` | `id`, `version`, `language`, `title`, `lead`, `audience`, `modules`, `glossary?`, `toolbox?`, `tests?`, `layers?`, `diagrams?`, `stageKeys?`, `scenes?`, `defaults?`, `model?`, `exercises?`, `rubric?`, `labels?`, `bannedPhrases?`, `content(c: Builder)`. |
| `Builder` | Les appels de `content(c)` : `module`, `chapter`, `step`, `diagram`, `stage`, `set`, `ask`, `question`, `numeric`, `order`, `experiment`, `explain`, `exercise`, `test`, `clinicCase`. Voir [ecrire-un-cours.md](ecrire-un-cours.md#7-le-contenu). |
| `Text` | `string \| (() => string)` : le texte d’une étape (`c.step`) ou l’`observe` d’un cas clinique ; une fonction est appelée à la première lecture, puis son texte est gardé. |
| `LAZY_DWELL` | 12 : les secondes d’animation d’une étape paresseuse sans `dwell`. |
| `ModuleDef` | `{ id, title, pitch, goals, summary, kind?: 'core' \| 'exam' \| 'bonus' }`. |
| `StepOptions` | `{ note?, code?, hud?, layers?, tools?, dwell?, claims? }`. |
| `Claim` | `{ text, check(): boolean \| string }`. |
| `ExperimentSpec`, `Control`, `Goal`, `Predict` | Les expériences et leurs contrôles. |
| `ClinicCase` | `{ id, title, scene, fault, observe: Text, choices, explain, controls, goal, conclusion, justify, exam?, diagram?, symptom?(v) }`. `symptom` : ce que l’élève observe, réduit à une valeur ; le vérificateur exige qu’aucun autre contrôle du cas ne donne le même. |
| `Term`, `Capsule`, `CapsuleStep`, `Tests`, `TestItem`, `QuizSpec` | Glossaire, fiches, tests, questions. |
| `DomainModel`, `ModelCheck`, `ParamSpec` | Le modèle : `{ name, params?, checks: { name, run(): string \| null }[], … }`. |
| `Stage`, `Rect` | L’interface d’une scène : `mount`, `show`, `update`, `layout?(safe)`, `status`, `resetView?`, `dispose`. |
| `DiagramEnv` | Ce que reçoit un schéma : `{ t, v, ptr, hits, arg?, model? }`. |
| `Vals` | `Record<string, number>` : les valeurs du cours. |

### Questions

| Export | Description |
|---|---|
| `choice(question, choix, explication): QuizSpec` | Bonne réponse écrite en premier, placée ensuite à une position tournante. |
| `numeric(question, valeur, explication, { unit?, tol? }): QuizSpec` | Réponse numérique (tolérance : 2 % par défaut). |
| `placed(q)` | Place la bonne réponse d’une question déjà écrite. |

### Nombres, mémoïsation

| Export | Description |
|---|---|
| `fr(x, n = 0)` | `12 345,6`, `−0,5` : virgule décimale, espace fine insécable entre les milliers. |
| `fmtNumber(x, n, langue)` | `fr` pour le français, `Intl` sinon. |
| `dec(n)` | Un formateur de contrôle : `fmt: dec(1)`. |
| `pct(x)` | `0.25` → `25 %`. |
| `memo(fn, { key?, max? })` | Une version de `fn` qui garde ses derniers résultats (64 par défaut) ; `.clear()`. Pour une simulation partagée par la scène et les schémas. |

### Hasard et statistiques

| Export | Description |
|---|---|
| `rng(seed): () => number` | Un générateur pseudo-aléatoire à graine (mulberry32), uniforme dans [0, 1) : la même graine donne la même suite. Le modèle tire avec lui pour que chaque exécution soit reproductible. |
| `wilson(k, n, z = 1.96): [number, number]` | L’intervalle de Wilson (95 % par défaut) d’une proportion k / n : ce que peut valoir le vrai taux, vu la chance de n essais. Reste dans [0, 1], même pour k = 0 ou k = n. |

### Compilation et frise

| Export | Description |
|---|---|
| `compile(course): Timeline` | Le contenu placé sur la frise. |
| `Timeline` | `caps` (étapes), `chapters`, `stops` (pauses), `diags`, `scenes`, `modules`, `duration` ; `eval(t)`, `stageVals(t)`, `diagAt(t)`, `chapterAt(t)`… |
| `diagramVariants(tl)` | Chaque schéma avec les valeurs du fil du cours et les contrôles de ses expériences à leurs bornes. |
| `controlBounds(control)` | Les valeurs extrêmes d’un contrôle. |
| `Stop.clinic` | Sur l’expérience d’un cas clinique : `{ id, fault, symptom? }`, lu par le vérificateur. |
| `Caption.lazy` | L’étape a un texte paresseux ; `text` est écrit à sa première lecture. |
| `dwellOf(texte)` | La durée d’animation par défaut d’une étape. |

### Progression, glossaire, libellés

| Export | Description |
|---|---|
| `Progress`, `browserStore()`, `ProgressStore` | La progression enregistrée (réponses, révisions espacées de Leitner, expériences, explications, exercices, tests), dans `localStorage` sous `coursekit:<id>:v<version>`. Un `ProgressStore` sur mesure permet un autre stockage. |
| `moduleStats`, `EFFORT`, `fmtMinutes` | Les durées estimées affichées par la page d’accueil. |
| `courseMinutes(tl, exercices)` | La durée estimée du cours entier, hors modules bonus, en minutes. |
| `effortMinutes(texte): [min, max] \| null` | Les minutes que dit une durée annoncée (« trois à quatre heures » → [180, 240]) ; `null` sans durée. |
| `createGlossary(terms)` | Recherche des termes dans un texte (`find`) et mise en infobulles (`rich`). |
| `labelsFor(remplacements)`, `FR` | Les textes de l’interface et leurs remplacements par `labels`. |

## @coursekit/diagrams

| Export | Description |
|---|---|
| `DW`, `DH` | L’espace de dessin d’un schéma : 380 × 236. |
| `CC` | La palette : `fg`, `dim`, `faint`, `grid`, `acc`, `blue`, `pink`, `green`, `red`, `violet`. |
| `line`, `arrow`, `circle`, `dot`, `text`, `panel`, `axes` | Primitives de dessin. |
| `alpha(hex, a)`, `clamp`, `clamp01`, `mix`, `sstep`, `PI` | Couleurs et calculs. |
| `camFor`, `camIn`, `px`, `py`, `unpx`, `unpy`, `Cam` | Une caméra monde (mètres, y vers le haut) → schéma. |
| `cached(clé, calcul)`, `cachedMaybe(clé, calcul)`, `beginBudget(n)` | Un cache pour ce qu’un schéma calcule ; `cachedMaybe` étale les calculs d’une courbe sur plusieurs images. |
| `MATH_CAPSULES`, `pickCapsules(...ids)` | Les fiches T1 à T8 ; `[id, 'où le cours s’en sert']` personnalise la ligne d’usage. |
| `TOOL_DIAGRAMS` | Les schémas de ces fiches. |

## @coursekit/exercises

Sans DOM : le lecteur les affiche, le vérificateur les contrôle.

| Export | Description |
|---|---|
| `Exercise` | `CodeExercise \| CalculationExercise \| ClassifyExercise \| SequenceExercise`. |
| `CodeExercise` | `slot`, `sig`, `doc`, `goal`, `solution`, `starter`, `hints`, `win`, `tests?`, `scenarios?`, `chart?`, `primm?`, `parsons?`, `preview?`, `standalone?`. |
| `TestCase`, `Scenario`, `Primm`, `Impl` | Tests purs, scénarios comparés à la référence, lecture guidée, ensemble de fonctions. |
| `WorkshopConfig` | `{ helpers?, scenarios?, assembly?: { title, intro, scenarios?, chart?, preview? } }`. |
| `choiceQ` | `choice` de core, pour les questions PRIMM. |
| `verifyCode`, `verifyAssembly`, `verifyCalculation`, `verifyClassify`, `verifySequence` | Les vérifications, utilisées par l’atelier et par `coursekit check`. |
| `compile`, `buildImpl`, `compareScenarios`, `primmDefinesSlot` | Les briques de ces vérifications. |

## @coursekit/ui

Importer le thème une fois : `import '@coursekit/ui/theme.css'`.

| Export | Description |
|---|---|
| `mountCourse(host, course, options?): CourseHandle` | Le lecteur complet : page d’accueil, visite, pauses, atelier, tests, glossaire, fiches, révisions. |
| `MountOptions` | `{ stage?, store?, autostart?, dev? }` ; `dev` active `/?shots`. |
| `CourseHandle` | `next`, `prev`, `chapter`, `goto`, `pauses`, `render`, `shots`, `list`, `tl`, `prog`, `destroy`. Voir [outils.md](outils.md#dans-le-navigateur). |
| `noStage()`, `imageStage(images, libellés?)`, `canvasStage(scènes)` | Les scènes fournies. `canvasStage` garde ses scènes lisibles (`stage.scenes`) : `coursekit check` les dessine. |
| `CanvasScene` | `{ label?, prepare?(réglages), draw(ctx, w, h, t, réglages, données, safe) }`. |
| `renderQuiz`, `highlight`, `h`, `esc` | Briques réutilisables pour composer une interface. |

## @coursekit/tooling

| Export | Description |
|---|---|
| `checkCourse(course, { stage? }): Report` | Les vérifications de `coursekit check` ; `Report = { course, findings, stats, ok }`. Avec `stage` (un `canvasStage`), les scènes sont dessinées dans les fenêtres de `SAFE_ZONES`. |
| `SAFE_ZONES` | Les deux fenêtres (large, étroite) et leur zone utile où sont dessinées les scènes. |
| `defineTune(spec)`, `runTune(spec)` | Les fichiers de réglage de `coursekit tune` : `{ title?, grid, seeds?, run(p, seed), show?, summary?, expect? }`. |
| `TuneExpect` | `{ label, test(rows) }` (sur les lignes : `p`, `r`, `runs`) ou `{ label, where?(p), ok(r, p), atLeast?, atMost? }` (par graine : chaque graine par défaut). Voir [outils.md](outils.md#le-hasard--seeds). |
| `summarize(textes)` | Le résumé des graines d’une case : la valeur commune, les effectifs, ou la médiane et l’étendue. |
| `mockContext(w?, h?)` | Un contexte de canevas (380 × 236 par défaut) qui ne dessine rien et enregistre les textes tracés. |
| bin `coursekit` | `check`, `stats`, `tune`, `new`. |
