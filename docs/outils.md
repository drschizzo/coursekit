# Outils

## La commande `coursekit`

Installée par `npm install` dans `node_modules/.bin` ; les scripts des cours l’appellent
directement. Depuis la racine : `npx coursekit …`.

| Commande | Effet |
|---|---|
| `coursekit check <course.ts>` | Les quatre niveaux de vérification (ci-dessous), avec les scènes de `stage.ts` s’il est à côté. Code de sortie 1 s’il reste une erreur. |
| `coursekit stats <course.ts>` | Modules, chapitres, étapes, questions, expériences, exercices… |
| `coursekit parcours <course.ts> [sortie.md]` | Le cours tel que l’élève le voit, en Markdown et dans l’ordre de lecture : chaque étape avec les textes du schéma et de la scène affichés à côté, chaque question avec sa réponse, chaque expérience avec sa prédiction, ses objectifs et sa conclusion, les cas cliniques et les tests. Pour relire le cours d’un bout à l’autre, ou le faire relire par quelqu’un qui ne le connaît pas. |
| `coursekit tune <tune.ts>` | Balaye les paramètres du modèle et vérifie les fenêtres attendues. Code de sortie 1 si l’une échoue. |
| `coursekit new <dossier> [titre]` | Un nouveau projet de cours, prêt à lancer et qui passe déjà `check` et `tune` : modèle, réglage sur plusieurs graines, scène, contenu, et un port de développement fixe que n’utilise aucun cours voisin (à partir de 5181). |

Scripts de la racine :

| Script | Effet |
|---|---|
| `npm test` | Typage, test des règles du vérificateur, `check` et `tune` de tous les cours. |
| `npm run check` / `npm run tune` / `npm run build` | La même commande dans chaque cours. |
| `npm run dev:fusee`, `npm run dev:epidemie`, `npm run dev:demo` | Le serveur de développement d’un cours. |
| `npm run new -- courses/<id> "<titre>"` | `coursekit new`. |
| `npm run archive` | Une archive `coursekit-<version>.tar.gz` du dernier commit (voir [diffusion.md](diffusion.md)). |

## `coursekit check`

1. **Compilation.** Le constructeur refuse un contenu mal formé : module inconnu, chapitre hors
   d’un module, identifiant en double, expérience à objectifs sans prédiction ou sans conclusion.
2. **Relecture pédagogique.**

   | Règle | Niveau | Ce qui est signalé |
   |---|---|---|
   | `step-length` | erreur | Une étape de plus de 75 mots. |
   | `tone` | erreur | Un point d’exclamation, une tournure interdite (« incroyable », « magique », « le secret »… et `bannedPhrases`). |
   | `term-order` | erreur | Un terme du glossaire employé avant le module qui l’introduit. |
   | `link` | erreur | Une fiche, un schéma, une scène, un exercice, un module ou un test inconnus. |
   | `timing` | erreur | Une pause qui commence en même temps qu’une étape. |
   | `offered` | erreur | Un exercice jamais proposé dans le parcours. |
   | `answer-length` | erreur | Une bonne réponse nettement plus longue que les autres choix. |
   | `answer-position` | erreur | Des bonnes réponses mal réparties entre les positions. |
   | `test-pair` | erreur | Une question du test final sans jumelle au test de départ. |
   | `summary` | erreur | Un module sans fiche de synthèse. |
   | `assessed` | remarque | Un module sans question. |
   | `explain` | remarque | Un module (après le premier) sans explication écrite. |
   | `effort` | remarque | La durée annoncée (`audience.effort`) s’écarte de plus de 15 % de l’estimation de la page d’accueil (`courseMinutes`). |

   La durée annoncée est lue en toutes lettres ou en chiffres : « trois à quatre heures »,
   « 90 min », « une heure et demie », « two to three hours ». Une formule sans durée (« en une
   séance ») n’est pas comparée. L’estimation compte une minute par étape, 1,5 par question, 4 par
   expérience, 3 par explication écrite ou révision, 10 par exercice ou test (`EFFORT`), hors
   modules bonus ; `coursekit check` l’affiche dans ses statistiques.

3. **Modèle, affirmations et cas cliniques.** `model` : une `check` du modèle échoue. `claim` : un
   chiffre affirmé dans une étape n’est pas confirmé par le modèle. `clinic` (erreur) : un cas
   clinique ne se diagnostique pas ou ne se répare pas. Pour chaque cas, le vérificateur prend les
   valeurs du cas (avec le réglage fautif) et les valeurs **saines** : les mêmes, le réglage
   fautif rétabli à sa valeur d’avant le cas (`defaults` et `c.set`, sans les réglages de la
   scène du cas). Il exige :

   - qu’avec le réglage fautif, l’objectif (`goal`) soit faux ;
   - qu’en rétablissant **seulement** le réglage fautif, il devienne vrai ;
   - que chaque clé de `fault` ait un contrôle dans le cas ;
   - si le cas donne un `symptom(v)` : que le symptôme du défaut diffère de celui qu’on obtient en
     déplaçant, depuis les valeurs saines, chacun des **autres** contrôles du cas à ses bornes
     (ses options, pour un choix). Sinon, l’élève ne peut pas distinguer le défaut des
     distracteurs. Les symptômes sont comparés après `JSON.stringify`.
4. **Exercices et parcours complet.**

   | Règle | Niveau | Ce qui est signalé |
   |---|---|---|
   | `exercise` | erreur | Une solution refusée, un point de départ accepté, un code PRIMM déjà accepté, des valeurs attendues refusées. |
   | `walk` | erreur | Un affichage calculé, un schéma, un texte paresseux ou un objectif d’expérience qui lève une erreur ; un texte « NaN », « undefined », « Infinity ». |
   | `layout` | remarque | Un texte de schéma qui sort du cadre, ou deux textes superposés. |
   | `stage` | erreur | Une scène qui lève une erreur (préparation ou dessin), ou qui écrit « NaN », « Infinity »… ; la scène du cours qui ne se charge pas. |
   | `stage-layout` | remarque | Un texte de scène hors de la zone utile (`safe`), ou deux textes de scène superposés. |
   | `spoiler` | remarque | La réponse d’une question, d’une prédiction ou d’un diagnostic se lit à l’écran quand elle s’ouvre : dans le schéma, la scène, ou l’étape affichée au-dessus. Le réglage fautif d’un cas clinique écrit sur son schéma ou sa scène. |
   | `term-early` | remarque | Un terme du glossaire écrit par un schéma ou une scène avant son module, ou avant toute étape (ou question) qui l’emploie. |
   | `repeat` | remarque | Deux questions du cours (fil, prédictions, tests, étapes de calculs guidés) qui partagent au moins la moitié de leurs mots ; une question finale qui reprend les mots de sa jumelle. |

   Le parcours dessine chaque schéma avec les valeurs du fil du cours **et** avec chaque contrôle
   des expériences qui l’accompagnent à ses bornes (min et max, activé et désactivé, chaque
   option), puis tous les contrôles à leur minimum et à leur maximum. Les objectifs des
   expériences sont évalués aux mêmes valeurs. La taille des textes est estimée (0,55 × la taille
   de police par caractère) : la règle `layout` vise les vrais débordements, pas le pixel près.

   Les textes paresseux (`c.step(titre, () => texte)`) sont écrits par le vérificateur comme à leur
   première lecture, puis relus par toutes les règles (longueur, ton, termes, nombres).

   **Les scènes.** Quand `stage.ts` se trouve à côté du fichier du cours et exporte `stage()` (ou
   un export par défaut) qui renvoie un `canvasStage`, chaque scène est préparée avec les réglages
   de chaque endroit où le cours la montre, et avec chaque contrôle des expériences qui y passent
   (s’il fait partie de `stageKeys`) à ses bornes. Elle est dessinée par `mockContext` dans deux
   fenêtres (`SAFE_ZONES`), à t = 0 ; 1,5 ; 6 et 40 s :

   | Fenêtre | Canevas | Zone utile `safe` |
   |---|---|---|
   | large | 1440 × 900 | x 440, y 72, 560 × 740 (entre le texte et le schéma) |
   | étroite | 390 × 844 | x 8, y 64, 374 × 300 (une bande sous les panneaux du haut) |

   Un même défaut n’est signalé qu’une fois par scène et par fenêtre, même si les chiffres du
   texte changent.

   **Ce qui est à l’écran** (`spoiler`, `term-early`). Pour chaque question, prédiction et
   diagnostic, le vérificateur dessine le schéma et la scène avec les valeurs de ce moment (les
   courbes différées de `cachedMaybe` comprises) et prend le texte de l’étape affichée au-dessus.
   Il y cherche : pour une réponse numérique, un nombre égal à la tolérance près (les nombres
   courants, 0, 1, 3 ou 0,5, sont ignorés) ; pour une mise en ordre, tous les éléments dans
   l’ordre ; pour un choix, un nombre de la bonne réponse qu’aucun autre choix n’a, ou au moins
   60 % de ses mots, nettement plus que pour les autres choix ; pour un cas clinique, le libellé
   du contrôle fautif avec sa valeur, ou « clé = valeur ». Ce sont des heuristiques : elles
   trouvent un chiffre ou des mots, pas une réponse qu’on devine en regardant une courbe. Le
   remède est dans le cours (poser la question avant le schéma, changer de schéma, faire
   appliquer au lieu de restituer), pas dans une reformulation qui leur échappe. Un fond qui dépasse `safe` est normal ; un texte, non. Les textes tracés sous
   une transformation (`translate`, `rotate`, `scale`) ne sont pas mesurés. Depuis du code :
   `checkCourse(course, { stage: stage() })`.

Un cours est diffusable à « ✓ prêt (0 remarque) ». Ne jamais affaiblir une règle pour passer.

## `coursekit tune`

```ts
import { defineTune } from '@coursekit/tooling';

export default [
  defineTune({
    title: 'Charge utile (kg) × basculement (°)',
    grid: { payload: [2000, 3000, 4000, 5000, 6000], kick: [4, 5, 6, 7, 8] },
    run: (p) => flightOf(p),
    show: (r) => r.outcome,
    expect: [
      { label: '6 t ne passe à aucun angle', test: (rows) => rows.filter((x) => x.p.payload === 6000).every((x) => x.r.outcome !== 'orbit') },
    ],
  }),
];
```

```
Charge utile (kg) × basculement (°)

payload \ kick    4      5      6      7      8
2000              orbite orbite orbite orbite orbite
3000              subo   orbite orbite orbite orbite
…
✓ 6 t ne passe à aucun angle
```

Un paramètre : une ligne par valeur ; deux : un tableau ; trois ou plus : une ligne par
combinaison. `test` renvoie `true`, `false`, ou un message.

### Le hasard : `seeds`

Un modèle qui tire au hasard (auto-jeu, apprentissage par renforcement, simulation bruitée)
n’est pas réglé sur une seule exécution : une fenêtre réglée sur une graine chanceuse ne tient
pas. `seeds` donne la liste des graines ; `run(p, seed)` est appelé pour chaque combinaison et
chaque graine (sans `seeds`, une fois, avec la graine 1). Le modèle tire avec `rng(seed)` de
`@coursekit/core`.

```ts
import { defineTune } from '@coursekit/tooling';

export default defineTune({
  title: 'Auto-jeu : bruit à la racine × coups tirés',
  grid: { noise: [0, 0.5], temp: [0, 2, 9] },
  seeds: [1, 2, 3, 4, 5],
  run: (p, seed) => train({ ...p, seed }),
  show: (r) => r.outcome,
  expect: [
    // « chaque graine » : sans atLeast ni atMost
    { label: 'sans tirage des coups, aucune graine ne gagne', where: (p) => p.temp === 0, ok: (r) => r.outcome !== 'unbeatable' },
    // « au moins k sur n », « au plus k sur n »
    { label: 'nominal : au moins 4 graines sur 5', where: (p) => p.noise === 0.5 && p.temp === 9, ok: (r) => r.outcome === 'unbeatable', atLeast: 4 },
    { label: 'sans bruit : au plus 2 graines sur 5', where: (p) => p.noise === 0 && p.temp === 9, ok: (r) => r.outcome === 'unbeatable', atMost: 2 },
    // une fenêtre écrite sur toutes les lignes : x.runs donne un résultat par graine
    { label: 'parties plus variées que sans tirage, graine par graine', test: (rows) => … },
  ],
});
```

```
Auto-jeu : bruit à la racine × coups tirés
5 graines : 1, 2, 3, 4, 5

noise \ temp    0                 2                 9
0               weak              weak ×4 · good ×1 good ×3 · weak ×2
0.5             weak              weak ×3 · good ×2 good ×4 · weak ×1
```

- Une fenêtre **par graine** s’écrit `{ label, where?, ok(r, p), atLeast?, atMost? }` : sur chaque
  combinaison que garde `where` (toutes par défaut), `ok` doit tenir pour chaque graine, ou pour
  au moins `atLeast` / au plus `atMost` d’entre elles. En cas d’échec, le message dit où et
  combien : `noise = 0.5 · temp = 9 : 3/5`. Sans `seeds`, chaque ligne compte pour une graine :
  `{ label, where, ok }` remplace `rows.filter(…).every(…)`.
- Une fenêtre **sur les lignes** garde la forme `{ label, test(rows) }` ; chaque ligne porte `p`,
  `r` (le résultat de la première graine) et `runs` (un résultat par graine, dans l’ordre de
  `seeds`).
- Chaque case **résume les graines** à partir de `show` (`summarize`) : la valeur quand toutes
  s’accordent, les effectifs quand il y a peu de valeurs différentes (`good ×4 · weak ×1`), la
  médiane et l’étendue pour des nombres (`0.42 [0.38–0.51]`). `summary(runs, p)` remplace ce
  résumé.
- Les proportions mesurées sur n parties se comparent avec leur intervalle : `wilson(k, n)`
  (`@coursekit/core`) donne l’intervalle de Wilson à 95 %.

## Dans le navigateur

Avec `mountCourse(host, course, { stage, dev: import.meta.env.DEV })`, le lecteur est exposé en
développement comme `window.course` :

| Aide | Effet |
|---|---|
| `/?shots` (adresse) ou `course.shots()` | La grille de tous les schémas, aux valeurs du fil du cours et aux bornes des expériences, légendés. Échap pour fermer. |
| `course.goto(chapitre, étape?)` | Aller à une étape ; les pauses précédentes comptent comme faites. |
| `course.pauses(false)` | Passer toutes les questions et expériences (comme le bouton « Questions et exercices »). |
| `course.render(schéma, valeurs?, t?)` | Un `<canvas>` avec un schéma seul. |
| `course.next()`, `course.prev()`, `course.list()` | Étape suivante, précédente, liste des chapitres. |
| `course.tl`, `course.prog` | La frise compilée, la progression enregistrée. |

Relecture conseillée avant diffusion : `/?shots`, puis chaque chapitre avec `goto`, sur un écran
large et un écran étroit ; la console ne doit montrer aucune erreur. Les textes de scène hors de
la zone utile sont déjà signalés par `coursekit check` (`stage-layout`) : la relecture vérifie
le reste (lisibilité, contraste, ce que montre l’animation).

Raccourcis du lecteur : Espace (continuer), ← → (étape précédente, suivante), 1 à 4 (répondre),
M (sommaire), L (atelier), G (glossaire), Échap (fermer).
