# Référence

Les paquets exposent leurs sources TypeScript (`exports` pointe sur `src/index.ts`) : ils
s’utilisent avec un outil qui comprend TypeScript (Vite, Node ≥ 22.18). Les types complets, avec
leurs commentaires, sont dans `packages/*/src`. Cette page liste ce qu’un cours utilise.

- [@coursekit/core](#coursekitcore)
- [@coursekit/diagrams](#coursekitdiagrams)
- [@coursekit/toolbox](#coursekittoolbox)
- [@coursekit/exercises](#coursekitexercises)
- [@coursekit/ui](#coursekitui)
- [@coursekit/tooling](#coursekittooling)

## @coursekit/core

Sans DOM : un cours peut être compilé, parcouru et vérifié partout.

### Écrire un cours

| Export | Description |
|---|---|
| `defineCourse(def)` | Identité typée : `export default defineCourse({ … })`. Le type des exercices et de l’atelier est déduit de `exercises` et `workshop`. |
| `CourseDef<E, W>` | `id`, `version`, `language`, `title`, `lead`, `audience`, `modules`, `glossary?`, `toolbox?`, `tests?`, `layers?`, `diagrams?`, `stageKeys?`, `scenes?`, `defaults?`, `model?`, `exercises?: E[]`, `workshop?: W`, `rubric?`, `labels?`, `bannedPhrases?`, `content(c: Builder)`. `@coursekit/exercises` fournit `Course`, le type complet. |
| `Builder` | Les appels de `content(c)` : `module`, `chapter`, `step`, `diagram`, `stage`, `set`, `ask`, `question`, `numeric`, `order`, `experiment`, `explain`, `exercise`, `test`, `clinicCase`. Voir [ecrire-un-cours.md](ecrire-un-cours.md#7-le-contenu). |
| `Text` | `string \| (() => string)` : le texte d’une étape (`c.step`) ou l’`observe` d’un cas clinique ; une fonction est appelée à la première lecture, puis son texte est gardé. |
| `LAZY_DWELL` | 12 : les secondes d’animation d’une étape paresseuse sans `dwell`. |
| `ModuleDef` | `{ id, title, pitch, goals, summary, kind?: 'core' \| 'exam' \| 'bonus' }`. |
| `StepOptions` | `{ note?, code?, hud?, layers?, tools?, dwell?, claims? }`. |
| `Claim` | `{ text, check(): boolean \| string }`. |
| `ExperimentSpec`, `Control`, `Goal`, `Predict` | Les expériences et leurs contrôles. |
| `ClinicCase` | `{ id, title, scene, fault, observe: Text, choices, explain, controls, goal, conclusion, justify, exam?, diagram?: string \| { name, arg? }, symptom?(v) }`. `diagram` avec `arg` : une variante du schéma, qui montre le symptôme sans le réglage fautif. `symptom` : ce que l’élève observe, réduit à une valeur ; le vérificateur exige qu’aucun autre contrôle du cas ne donne le même. |
| `Term`, `Capsule`, `CapsuleStep`, `Tests`, `TestItem`, `QuizSpec` | Glossaire, fiches, tests, questions. |
| `DomainModel`, `ModelCheck`, `ParamSpec` | Le modèle : `{ name, params?, checks: { name, run(): string \| null }[], … }`. |
| `Stage`, `StageStatus`, `Rect` | L’interface d’une scène : `mount`, `show`, `update`, `layout?(safe)`, `status(): { busy, label, progress? }`, `resetView?`, `dispose`. |
| `DiagramEnv` | Ce que reçoit un schéma : `{ t, v, ptr, hits, arg?, model? }`. |
| `Vals` | `Record<string, number>` : les valeurs du cours. |

### Questions

| Export | Description |
|---|---|
| `choice(question, choix, explication): QuizSpec` | Bonne réponse écrite en premier, placée ensuite à une position tournante. |
| `numeric(question, valeur, explication, { unit?, tol? }): QuizSpec` | Réponse numérique (tolérance : 2 % par défaut, `toleranceOf`). |
| `placed(q)` | Place la bonne réponse d’une question déjà écrite. |
| `placeAnswer(question, choix, explication, position)` | La même chose à une position donnée (le constructeur s’en sert avec son propre compteur). |

### Nombres, mémoïsation

| Export | Description |
|---|---|
| `fr(x, n = 0)` | `12 345,6`, `−0,5` : virgule décimale, espace fine insécable entre les milliers. |
| `fmtNumber(x, n, langue)` | `fr` pour le français, `Intl` sinon. |
| `fmtValue(x, langue, chiffres = 6)` | Une valeur avec les chiffres qu’il lui faut (`0,125`, `3`) : réponses attendues, écarts. |
| `parseNumber(texte)` | Un nombre tapé par l’élève, avec une virgule ou un point. |
| `dec(n, langue = 'fr')` | Un formateur de contrôle : `fmt: dec(1)`. |
| `pct(x, langue = 'fr')` | `0.25` → `25 %`. |
| `memo(fn, { key?, max? })` | Une version de `fn` qui garde ses derniers résultats (64 par défaut) ; `.clear()`. Pour une simulation partagée par la scène et les schémas. |

### Hasard et statistiques

| Export | Description |
|---|---|
| `rng(seed): () => number` | Un générateur pseudo-aléatoire à graine (mulberry32), uniforme dans [0, 1) : la même graine donne la même suite. Le modèle tire avec lui pour que chaque exécution soit reproductible. |
| `wilson(k, n, z = 1.96): [number, number]` | L’intervalle de Wilson (95 % par défaut) d’une proportion k / n : ce que peut valoir le vrai taux, vu la chance de n essais. Reste dans [0, 1], même pour k = 0 ou k = n. |

### Compilation et frise

| Export | Description |
|---|---|
| `compile(course): Timeline` | Le contenu placé sur la frise. La frise ne change plus ensuite. |
| `Timeline` | `caps` (étapes), `chapters`, `stops` (pauses), `diags`, `scenes`, `modules`, `duration` ; `eval(t)`, `stageVals(t)` (les valeurs écrites par le cours), `diagAt(t)`, `chapterAt(t)`, `capAt(t)`, `capsOfChapter(i)`… |
| `Reading` | Une lecture de la frise : l’horloge (`t`, `playing`, `held`, `stepMode`, `pauses`), la pause en cours (`stop`), et ce que l’élève y a fait (`state(stop)` : réglages, objectifs atteints, prédiction). `eval(t)` ajoute aux valeurs du cours celles des expériences ; `enterStop`, `resume`, `resetStops(t)`, `stopBetween(t0, t1)`, `setPauses`, `editLive`. |
| `Stop` | Une union discriminée par `kind` : `TryStop` (`until`, `prompt`, `controls`, `goals?`, `predict?`, `conclusion?`, `clinic?`), `QuizStop` (`quiz`), `CardStop` (`from`, `to`), `ReviewStop`, `ExplainStop` (`explain`), `LabStop` (`lab`, `prompt`), `TestStop` (`test`, `prompt`). `StopOf<'quiz'>` désigne l’un d’eux. |
| `STOP_KINDS` | Ce que chaque sorte de pause est : `skippable` (le bouton « Questions et exercices » la saute) et sa ligne dans l’estimation de durée. Ajouter une sorte commence ici ; `assertNever` signale les `switch` à compléter. |
| `TryStop.clinic` | Sur l’expérience d’un cas clinique : `{ id, fault, symptom? }`, lu par le vérificateur. |
| `captionText(caption)` | Le texte d’une étape ; un texte paresseux (`source` est une fonction) est écrit à sa première lecture, puis gardé. |
| `diagramVariants(tl)` | Chaque schéma avec les valeurs du fil du cours et les contrôles de ses expériences à leurs bornes. |
| `controlBounds(control)` | Les valeurs extrêmes d’un contrôle. |
| `dwellOf(texte)` | La durée d’animation par défaut d’une étape. |
| `LAYOUT`, `layoutCss()`, `wideSafeArea(w, h)` | La place des panneaux sur un grand écran : le lecteur l’écrit en variables CSS, le vérificateur en tire la zone utile des scènes. |

### Progression, glossaire, libellés

| Export | Description |
|---|---|
| `Progress`, `browserStore()`, `memoryStore()`, `ProgressStore` | La progression enregistrée (réponses, révisions espacées de Leitner, expériences, explications, exercices, tests), dans `localStorage` sous `coursekit:<id>`, avec la version de son schéma (`PROGRESS_SCHEMA`) et celle du contenu. Une nouvelle version du contenu garde les réponses et ne remet à zéro que la position dans le cours ; une progression d’avant les schémas (`coursekit:<id>:v<n>`) est reprise. Un `ProgressStore` sur mesure permet un autre stockage. |
| `sanitizeProgress(données)` | Ce qui, dans des données relues, a la bonne forme ; le reste revient à sa valeur vide. |
| `moduleReview(tl, prog, module)`, `homeReview(tl, prog)` | Les questions d’une révision : celle qui ouvre un module, celle de la page d’accueil. |
| `moduleCounts`, `moduleStats`, `EFFORT`, `fmtMinutes` | Ce que contient un module, sa durée estimée, et l’avancement de l’élève. |
| `courseMinutes(tl, exercices)` | La durée estimée du cours entier, hors modules bonus, en minutes. |
| `effortMinutes(texte): [min, max] \| null` | Les minutes que dit une durée annoncée (« trois à quatre heures » → [180, 240]) ; `null` sans durée. |
| `createGlossary(terms)` | Recherche des termes dans un texte (`find`) et mise en infobulles (`rich`). |
| `labelsFor(langue, remplacements)`, `FR`, `EN`, `DICTIONARIES` | Les textes de l’interface dans la langue du cours (`language` ; le français à défaut), puis les remplacements de `labels`. |
| `tr(L, clé, valeurs)` | Un texte avec ses valeurs : `{n}` est remplacé, `{s:n}` donne la marque du pluriel quand `n` en demande une. |

## @coursekit/diagrams

| Export | Description |
|---|---|
| `DW`, `DH` | L’espace de dessin d’un schéma : 380 × 236. |
| `CC` | La palette : `fg`, `dim`, `faint`, `grid`, `acc`, `blue`, `pink`, `green`, `red`, `violet`. Un cours prend ces couleurs dans `CC` (schémas, scène, aperçus) au lieu de recopier leurs valeurs. |
| `CSS_PALETTE` | La même palette en variables CSS (`--accent`, `--good`…), écrites par le lecteur : le thème et les schémas partagent ainsi une seule source. |
| `line`, `arrow`, `circle`, `dot`, `text`, `panel`, `axes` | Primitives de dessin. |
| `alpha(hex, a)`, `clamp`, `clamp01`, `mix`, `sstep`, `PI` | Couleurs et calculs. |
| `camFor`, `camIn`, `px`, `py`, `unpx`, `unpy`, `Cam` | Une caméra monde (mètres, y vers le haut) → schéma. |
| `cached(clé, calcul)`, `cachedMaybe(clé, calcul)`, `beginBudget(n, portée)`, `clearCache(portée)` | Un cache pour ce qu’un schéma calcule ; `cachedMaybe` étale les calculs d’une courbe sur plusieurs images. Le lecteur donne l’identifiant du cours comme portée : deux cours d’une même page ne partagent rien. |

## @coursekit/toolbox

Du contenu, à part des primitives de dessin.

| Export | Description |
|---|---|
| `MATH_CAPSULES`, `pickCapsules(...ids)` | Les fiches T1 à T8 ; `[id, 'où le cours s’en sert']` personnalise la ligne d’usage. |
| `TOOL_DIAGRAMS` | Les schémas de ces fiches, connus d’office du lecteur et du vérificateur. |

## @coursekit/exercises

Sans DOM : le lecteur les affiche, le vérificateur les contrôle.

| Export | Description |
|---|---|
| `Course` | `CourseDef<Exercise, WorkshopConfig>` : ce que prennent `mountCourse` et `checkCourse`. |
| `Exercise` | `CodeExercise \| CalculationExercise \| ClassifyExercise \| SequenceExercise`. |
| `CodeExercise` | `slot`, `sig`, `doc`, `goal`, `solution`, `starter`, `hints`, `win`, `tests?`, `scenarios?`, `chart?`, `primm?`, `parsons?`, `preview?`, `standalone?`. |
| `TestCase`, `Scenario`, `Primm`, `Impl` | Tests purs, scénarios comparés à la référence, lecture guidée, ensemble de fonctions. |
| `WorkshopConfig` | `{ helpers?, scenarios?, assembly?: { title, intro, scenarios?, chart?, preview? } }`. |
| `choiceQ` | `choice` de core, pour les questions PRIMM. |
| `verifyCode`, `verifyAssembly`, `verifyCalculation`, `verifyClassify`, `verifySequence` | Les vérifications, utilisées par l’atelier et par `coursekit check`. Leur dernier argument, `L` (les textes du cours), donne la langue des messages ; `Verdict.reason` vaut `'compile'` quand le code ne compile pas. |
| `compile`, `buildImpl`, `compareScenarios`, `primmDefinesSlot` | Les briques de ces vérifications. |
| `guardLoops(source)`, `LOOP_LIMIT_S` | Chaque boucle du code de l’élève est surveillée : au-delà de 3 s d’un appel, elle s’arrête avec un message au lieu de figer la page. |

## @coursekit/ui

Importer le thème une fois : `import '@coursekit/ui/theme.css'`.

| Export | Description |
|---|---|
| `mountCourse(host, course, options?): CourseHandle` | Le lecteur complet : page d’accueil, visite, pauses, atelier, tests, glossaire, fiches, révisions. |
| `MountOptions` | `{ stage?, store?, autostart?, dev? }` ; `dev` active `/?shots`. |
| `CourseHandle` | `next`, `prev`, `chapter`, `goto`, `pauses`, `render`, `shots`, `list`, `tl`, `reading`, `prog`, `destroy`. Voir [outils.md](outils.md#dans-le-navigateur). |
| `noStage()`, `imageStage(images, libellés?)`, `canvasStage(scènes)` | Les scènes fournies. `canvasStage` garde ses scènes lisibles (`stage.scenes`) : `coursekit check` les dessine. |
| `CanvasScene` | `{ label?, prepare?(réglages), draw(ctx, w, h, t, réglages, données, safe) }`. |
| `renderQuiz`, `highlight`, `h`, `esc` | Briques réutilisables pour composer une interface. |

## @coursekit/tooling

| Export | Description |
|---|---|
| `checkCourse(course, { stage?, extra?, skip? }): Report` | Les vérifications de `coursekit check` ; `Report = { course, findings, stats, ok }`. Avec `stage` (un `canvasStage`), les scènes sont dessinées dans les fenêtres de `SAFE_ZONES`. `extra` ajoute des vérifications propres au projet, `skip` fait taire des règles par leur nom. |
| `CHECKS`, `Check`, `CheckContext` | Les vérifications de la bibliothèque, chacune `{ name, run(x) }` ; `x` donne le cours compilé, ses exercices, ses textes, son glossaire, et `err` / `warn` pour signaler. |
| `BANNED` | Les tournures à éviter, par langue ; `bannedPhrases` s’y ajoute. |
| `SAFE_ZONES` | Les deux fenêtres (large, étroite) et leur zone utile où sont dessinées les scènes. |
| `defineTune(spec)`, `runTune(spec)` | Les fichiers de réglage de `coursekit tune` : `{ title?, grid, seeds?, run(p, seed), show?, summary?, expect? }`. |
| `TuneExpect` | `{ label, test(rows) }` (sur les lignes : `p`, `r`, `runs`) ou `{ label, where?(p), ok(r, p), atLeast?, atMost? }` (par graine : chaque graine par défaut). Voir [outils.md](outils.md#le-hasard--seeds). |
| `summarize(textes)` | Le résumé des graines d’une case : la valeur commune, les effectifs, ou la médiane et l’étendue. |
| `mockContext(w?, h?)` | Un contexte de canevas (380 × 236 par défaut) qui ne dessine rien et enregistre les textes tracés. |
| `parcours(course, scenes?): string` | Le cours en Markdown, dans l’ordre de lecture, avec ce que le schéma et la scène affichent à chaque étape (`coursekit parcours`). |
| `screenReader(course, tl, scenes?)` | Ce que l’élève a à l’écran à un instant `t` : `{ step, diagram, scene }`, chacun avec ses textes. Lu par les règles `spoiler` et `term-early`. |
| bin `coursekit` | `check`, `stats`, `parcours`, `tune`, `new`. |
