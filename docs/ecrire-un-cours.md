# Écrire un cours

Ce guide suit l’ordre dans lequel un cours s’écrit. Le cours [`courses/fusee`](../courses/fusee)
sert d’exemple tout du long ; le cours jouet [`courses/demo-mini`](../courses/demo-mini) montre
chaque élément sur un sujet minimal.

- [1. La démarche](#1-la-démarche)
- [2. Le projet](#2-le-projet)
- [3. Le modèle exécutable](#3-le-modèle-exécutable)
- [4. Les schémas](#4-les-schémas)
- [5. La scène](#5-la-scène)
- [6. La déclaration du cours](#6-la-déclaration-du-cours)
- [7. Le contenu](#7-le-contenu)
- [8. L’atelier](#8-latelier)
- [9. Les tests, le glossaire, la boîte à outils](#9-les-tests-le-glossaire-la-boîte-à-outils)
- [10. Les règles de rédaction](#10-les-règles-de-rédaction)
- [11. Vérifier](#11-vérifier)

## 1. La démarche

1. **Une question centrale.** « Comment une fusée atteint-elle l’orbite ? »
2. **Un modèle exécutable du sujet.** Si le sujet est un mécanisme, le cours en construit une
   version miniature qui fonctionne : un simulateur de vol pour une fusée, un mini moteur pour un
   moteur physique, un mini compilateur pour un compilateur. Le modèle est écrit et **réglé avant
   le contenu**.
3. **Des schémas et une scène** qui montrent le modèle.
4. **Le contenu**, écrit dans l’ordre de lecture, dont tous les chiffres viennent du modèle.
5. **La vérification** : `coursekit tune`, `coursekit check`, puis une relecture dans le
   navigateur.

Les principes pédagogiques que le format met en œuvre : une idée par étape ; une question avant
l’explication quand le chapitre corrige une idée fausse ; une prédiction avant chaque
expérience ; des explications écrites comparées à une réponse modèle ; des révisions espacées en
début de module ; des cas cliniques (observer, supposer, corriger, justifier) ; un test de départ
et un test final appariés notion par notion.

## 2. Le projet

```bash
npm run new -- courses/mon-cours "Mon cours"
npm install
npm run dev -w courses/mon-cours
```

| Fichier | Rôle |
|---|---|
| `src/model.ts` | Le modèle exécutable : fonctions pures, sans DOM. |
| `src/tune.ts` | Le réglage du modèle : un balayage de ses paramètres. |
| `src/diagrams.ts` | Les schémas (à créer). |
| `src/stage.ts` | La scène d’arrière-plan : une scène d’exemple dessinée dans la zone utile. |
| `src/course.ts` | La déclaration du cours et son contenu. |
| `src/main.ts` | Le point d’entrée : `mountCourse`, avec la scène de `stage.ts`. |

`package.json` lance le serveur de développement sur un port fixe (`vite --port N
--strictPort`), le premier à partir de 5181 qu’aucun cours voisin n’utilise : deux cours
peuvent tourner en même temps, et l’adresse d’un cours ne change pas.

Le code TypeScript est exécuté tel quel par Node et par Vite : seules les syntaxes « effaçables »
sont permises (pas d’`enum`, pas de `namespace`, pas de propriétés de paramètres de
constructeur), et les imports locaux gardent leur extension (`./model.ts`).

## 3. Le modèle exécutable

Le modèle est la source unique : le texte, les schémas, la scène, les objectifs des expériences
et la correction des exercices l’appellent tous.

```ts
import { memo, type DomainModel } from '@coursekit/core';

export function fly(p: Partial<FlightParams> = {}): Flight { … }   // une simulation

// partagée par la scène et les schémas, appelée à chaque image : calculée une fois par réglage
export const flightOf = memo((v: Record<string, number>) => fly({ … }), { key: (v) => … });

export const model: DomainModel = {
  name: 'lanceur à deux étages',
  checks: [
    { name: 'Tsiolkovsky : Δv = ve·ln(m0/mf)', run: () => (… ? null : 'ln(e) ≠ 1') },
    { name: 'le lanceur nominal atteint l’orbite', run: () => (fly().outcome === 'orbit' ? null : '…') },
  ],
};
```

- Une simulation renvoie des échantillons, des événements et une **issue classée**
  (`'pad' | 'crash' | 'suborbital' | 'orbit'`) : les expériences et les cas cliniques testent
  cette issue.
- Les `checks` vérifient une loi connue, un ordre de grandeur réel et l’issue du réglage nominal.
  Chaque `run()` renvoie `null` si tout va bien, sinon ce qui ne va pas.

### Régler le modèle

Une expérience n’a de sens que si le réglage à trouver existe et se trouve au curseur ; un cas
clinique, que si le défaut produit un symptôme qui lui est propre. On le vérifie avec un fichier
de réglage :

```ts
import { defineTune } from '@coursekit/tooling';
import { flightOf } from './model.ts';

export default defineTune({
  title: 'Basculement (°) : issue du vol',
  grid: { kick: [0, 2, 4, 5, 6, 7, 8, 10, 12, 15] },
  run: (p) => flightOf({ kick: p.kick }),
  show: (r) => r.outcome,
  expect: [
    { label: 'orbite de 5 à 8°', test: (rows) => rows.filter((x) => x.p.kick >= 5 && x.p.kick <= 8).every((x) => x.r.outcome === 'orbit') },
    { label: 'retombe au sol à 12° et plus', test: (rows) => rows.filter((x) => x.p.kick >= 12).every((x) => x.r.outcome === 'crash') },
  ],
});
```

```bash
npm run tune -w courses/mon-cours
```

Un paramètre donne une liste, deux paramètres un tableau ; un fichier peut exporter une liste de
réglages. Les fenêtres de `expect` sont celles que le contenu utilise : la commande échoue si
l’une n’est plus vérifiée, par exemple après une modification du modèle. `{ label, where, ok }`
s’écrit aussi plus court que `test` : « sur les lignes que garde `where`, `ok` est vrai ».

**Un modèle qui tire au hasard** se règle sur plusieurs graines, jamais sur une seule : une
fenêtre trouvée sur une exécution chanceuse ne tient pas devant l’élève qui relance. Le modèle
tire avec `rng(seed)` (`@coursekit/core`) ; le fichier de réglage donne `seeds`, et `run(p, seed)`
tourne pour chaque graine. Les fenêtres s’écrivent alors par graine : « chaque graine », « au
moins 4 sur 5 », « au plus 2 sur 5 » ; chaque case du tableau résume les graines.

```ts
export default defineTune({
  title: 'Cible de SGS',
  grid: { target: [0.1, 0.3, 0.5, 0.7, 0.95] },
  seeds: [1, 2, 3, 4],
  run: (p, seed) => robotOf({ ...p, seed }),
  show: (r) => r.outcome,
  expect: [
    { label: 'maîtrisé de 0,1 à 0,5, chaque graine', where: (p) => p.target <= 0.5, ok: (r) => r.outcome === 'mastered' },
    { label: 'à 0,95 : au moins 3 graines sur 4 échouent la tâche (cas clinique)', where: (p) => p.target === 0.95, ok: (r) => r.outcome === 'easy', atLeast: 3 },
  ],
});
```

Le texte du cours cite alors un taux et son incertitude : `wilson(k, n)` donne l’intervalle de
Wilson à 95 % d’une proportion k / n. Détails : [outils.md](outils.md#le-hasard--seeds).

## 4. Les schémas

Un schéma est une fonction qui dessine dans un espace de 380 × 236 (`DW × DH`) :

```ts
import { fr, type DiagramEnv } from '@coursekit/core';
import { CC, axes, dot, text } from '@coursekit/diagrams';

function forces(ctx: CanvasRenderingContext2D, e: DiagramEnv): void {
  const r = rocketOf(e.v);               // e.v : les valeurs du moment (curseurs compris)
  …
  text(ctx, `poussée / poids = ${fr(twr, 2)}`, 236, 104, CC.fg, 12);
}
export const DIAGRAMS = { forces, … };
```

- `e.t` : secondes depuis l’apparition du schéma (pour animer) ; `e.v` : les valeurs ;
  `e.ptr` : le pointeur dans l’espace du schéma, pendant une expérience déclarée `diag: true`.
- Palette `CC` : orange (`acc`) pour ce qu’on explique, bleu pour la référence, rose pour les
  forces, vert pour ce qui réussit, rouge pour ce qui échoue, `dim` et `faint` pour le décor.
  Les schémas, la scène et les aperçus de l’atelier prennent ces couleurs dans `CC`, jamais en
  recopiant leurs valeurs hexadécimales : c’est la même palette que le thème du lecteur. Les
  couleurs propres au sujet (le ciel, le mur d’un labyrinthe, une population) se nomment dans un
  objet de couleurs du cours.
- Tous les nombres passent par `fr`, `dec` ou `pct`.
- Ne jamais écrire un chiffre à la main : appeler le modèle.
- Les graduations ne doivent pas tomber sous le libellé d’un axe ; le vérificateur signale les
  textes qui sortent du cadre ou se superposent, à toutes les valeurs que prennent les curseurs.

## 5. La scène

La scène remplit le fond de l’écran. coursekit fournit trois scènes :

| Scène | Usage |
|---|---|
| `noStage()` | Pas de fond. |
| `imageStage({ clé: url })` | Une image par scène, pour un sujet sans modèle animé. |
| `canvasStage({ clé: CanvasScene })` | Un canevas animé, typiquement la simulation du modèle. |

```ts
export const stage = () => canvasStage({
  flight: {
    label: 'Le vol complet, au-dessus de la Terre',
    prepare: (s) => flightOf(s),                    // à chaque changement de réglage
    draw(ctx, w, h, t, s, data, safe) { … },        // à chaque image
  },
});
```

Le lecteur transmet `safe`, la **zone utile** : la partie de l’écran qu’aucun panneau ne couvre
(la colonne entre le panneau de texte et le schéma ; sur écran étroit, une bande en haut). Le
fond peut couvrir tout le canevas ; l’action et les grandeurs affichées se placent dans `safe`,
jamais par rapport à `w` et `h`.

Une scène plus lourde (une scène 3D, une application existante) implémente directement
l’interface `Stage` de `@coursekit/core`.

`coursekit check` dessine chaque scène d’un `canvasStage` sans navigateur, avec les réglages de
chaque endroit où le cours la montre et les contrôles des expériences à leurs bornes, dans une
fenêtre large et une fenêtre étroite : une erreur, un « NaN » ou un texte hors de `safe` y sont
signalés. Il faut pour cela que `src/stage.ts` exporte `stage()`, comme ci-dessus.

## 6. La déclaration du cours

```ts
export default defineCourse({
  id: 'fusee', version: 1, language: 'fr',
  title: 'Comment fonctionne une fusée',
  lead: 'Un paragraphe pour la page d’accueil.',
  audience: { level: 'lycée', prerequisites: '…', effort: 'trois à quatre heures' },
  modules: [ … ],                // voir ci-dessous
  glossary: [ … ], toolbox: [ … ], tests: { tools, pre, post },
  diagrams: DIAGRAMS,
  scenes: { pad: 'Le décollage, vu de près', flight: 'Le vol complet' },
  stageKeys: ['thrust', 'payload', 'kick'],   // les valeurs qui changent la scène
  defaults: { thrust: 1, payload: 3000, kick: 6 },
  model,
  exercises,
  workshop,                      // l’atelier : helpers, scénarios, assemblage (section 8)
  rubric: ['Une justification complète décrit le symptôme, la cause et le mécanisme.'],
  content(c) { … },
});
```

- **Modules** : `{ id, title, pitch, goals, summary, kind? }`. `kind` vaut `'core'` (défaut),
  `'exam'` (l’épreuve, hors révisions) ou `'bonus'`. Chaque objectif (`goals`) doit être évalué
  par une question, une expérience ou un exercice ; `summary` est la fiche de synthèse.
- **`version`** : à augmenter quand le contenu change (étapes ajoutées, chapitres déplacés). La
  progression est rangée sous la clé `coursekit:<id>` avec la version du contenu : quand elle
  change, les réponses, les révisions, les expériences et les exercices de l’élève sont gardés,
  seule la position dans le cours repart du début. C’est pourquoi les identifiants des questions,
  des expériences et des exercices ne doivent pas changer d’une version à l’autre.
- **`language`** choisit les textes de l’interface (`fr`, `en` ; le français pour une langue
  sans dictionnaire), le format des nombres et les tournures interdites du vérificateur.
- **`audience.effort`** (« trois à quatre heures ») s’affiche à côté du temps estimé ; le
  vérificateur fait une remarque s’ils s’écartent de plus de 15 %.
- **`labels`** remplace des textes de l’interface (les clés sont celles de `FR`, dans
  `packages/core/src/labels.ts`) ; **`bannedPhrases`** ajoute des tournures interdites à celles du
  vérificateur.
- Les valeurs (`defaults`, `c.set`, `c.stage`, curseurs) sont des nombres. Les clés de
  `stageKeys` sont transmises à la scène ; les autres ne servent qu’aux schémas.

## 7. Le contenu

`content(c)` décrit le cours dans l’ordre de lecture. Le compilateur place les étapes sur la
frise, ajoute les cartes de module, les révisions au début des modules et les étapes qui
précèdent les questions posées avant l’explication.

| Appel | Effet |
|---|---|
| `c.module(id)` | Commence un module (entre deux chapitres). |
| `c.chapter(titre, () => { … })` | Un chapitre ; son corps appelle les fonctions suivantes. |
| `c.step(titre, texte, options?)` | Une étape : une idée, 75 mots au plus. `texte` peut être une fonction (voir ci-dessous). |
| `c.diagram(nom \| null, { arg?, big? })` | Le schéma à partir de l’étape suivante (remis à zéro à chaque chapitre). |
| `c.stage(scène, réglages?)` | La scène à partir de l’étape suivante ; ses réglages finissent avec elle. |
| `c.set(valeurs)` | Des valeurs qui valent jusqu’à la fin du cours. |
| `c.ask(id, question, choix, explication)` | Une question posée **avant** l’explication. |
| `c.question(id, question, choix, explication, { review? })` | Une question à choix ; la bonne réponse est écrite **en premier** (sa position est ensuite tirée). |
| `c.numeric(id, question, valeur, explication, { unit?, tol? })` | Une réponse numérique. |
| `c.order(id, question, éléments, explication)` | Remettre dans l’ordre ; les éléments sont écrits dans le bon ordre. |
| `c.experiment(spec)` | Une expérience (voir ci-dessous). |
| `c.explain(id, consigne, réponseModèle)` | Une explication écrite, comparée ensuite à la réponse modèle. |
| `c.exercise(id \| 'assembly', invitation)` | Une invitation à un exercice de l’atelier. |
| `c.test('pre' \| 'post', invitation)` | Le test de départ ou le test final. |
| `c.clinicCase(spec)` | Un cas clinique : un chapitre entier (voir ci-dessous). |

Options d’une étape : `note` (un aparté), `code` (du code affiché ; `{{clé|min|max|pas}}` devient
une valeur à faire glisser), `hud` (un affichage calculé à partir des valeurs), `tools` (les
fiches de la boîte à outils utiles ici), `dwell` (durée d’animation), `claims` (les chiffres
affirmés, vérifiés par le modèle).

```ts
c.step('Deux étages contre un', `Le premier étage donne ${fr(DV[0] / 1000, 1)} km/s …`, {
  claims: [{ text: 'deux étages : environ 10,1 km/s', check: () => near(sum(DV), 10100, 0.01) || fr(sum(DV)) }],
});
```

`check()` renvoie `true`, ou `false` / un message disant ce que le modèle trouve à la place.

**Les textes paresseux.** Un gabarit comme celui-ci est calculé au chargement du cours : si le
modèle met du temps (un entraînement, des centaines de parties), la page attend avant de
s’afficher. Écrire le texte comme une fonction le calcule à la première lecture de l’étape, puis
le garde :

```ts
c.step('Les positions jamais vues', () => `Sur les autres, la politique choisit un coup optimal ${pct(trainOf({}).netUnseen)} du temps.`);
```

Les `observe` des cas cliniques acceptent aussi une fonction. Le vérificateur écrit tous ces
textes et les vérifie comme les autres. Sans `dwell`, une étape paresseuse anime 12 s
(`LAZY_DWELL`) : sa longueur n’est pas connue à la compilation. Les valeurs calculées au niveau du
module (`const RUN = trainOf({})`) coûtent aussi au chargement : les envelopper dans une fonction
mémoïsée (`memo`) quand seuls des textes paresseux, des `claims` ou des objectifs les lisent.

### Les expériences

```ts
c.experiment({
  title: 'Réglez le basculement',
  prompt: 'Faites varier l’angle de basculement.',
  predict: { question: 'Sans basculement, la fusée…', choices: ['monte puis retombe', 'atteint l’orbite', 'reste dans l’air dense'], answer: 0 },
  controls: [{ type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) }],
  goals: [
    { label: 'Réglez 0° : un vol vertical', test: ({ v }) => v.kick === 0 },
    { label: 'Trouvez un basculement qui mène en orbite', test: ({ v }) => flightOf(v).outcome === 'orbit' },
  ],
  seq: true,           // les objectifs se débloquent l’un après l’autre
  conclusion: 'De 5 à 8° environ, le lanceur atteint l’orbite. …',
});
```

- Une prédiction est obligatoire dès qu’il y a des objectifs, une conclusion aussi.
- Contrôles : `range` (`min`, `max`, `step`, `fmt`, `log`), `toggle` (`on`, `off`), `choice`
  (`options: [{ label, value }]`).
- `diag: true` : le schéma suit le pointeur. `hold: 'step'` : les réglages ne durent que jusqu’à
  l’étape suivante (par défaut, jusqu’à la fin du chapitre).
- Les objectifs fixent des comportements à observer des deux côtés de la fenêtre réglée, pas
  une valeur exacte.

### Les cas cliniques

```ts
c.clinicCase({
  id: 'clin-kick', title: 'une fusée qui retombe après deux minutes',
  scene: 'flight', fault: { kick: 12 },          // le réglage fautif, le temps du cas
  observe: 'La fusée décolle normalement, mais sa trajectoire se couche très vite. …',
  choices: ['le basculement, beaucoup trop fort', 'la poussée, trop forte', 'le second étage, trop lourd'],
  explain: 'Un basculement de 12° couche la trajectoire alors que la fusée est encore dans l’air dense.',
  controls: [ … ],
  goal: { label: 'La fusée atteint l’orbite', test: (v) => flightOf(v).outcome === 'orbit' },
  conclusion: '…',
  justify: 'La réponse modèle : le symptôme, la cause, le mécanisme.',
  exam: false,         // true : un cas d’épreuve, hors révisions
});
```

Le cas devient un chapitre : observer, diagnostiquer (la question), corriger (l’expérience),
justifier (l’explication écrite). `diagram` accepte `{ name, arg }` : le schéma du cas dessine
alors une variante, qui montre le symptôme sans écrire le réglage fautif. Un seul réglage est en défaut, et son symptôme ne doit pas se
confondre avec celui d’un autre réglage.

`coursekit check` le vérifie (règle `clinic`) : avec le réglage fautif, l’objectif est faux ; en
rétablissant **seulement** ce réglage à sa valeur d’avant le cas (`defaults`, `c.set`), il devient
vrai. Attention aux `c.set` d’un chapitre précédent : ils valent jusqu’à la fin du cours, donc
aussi pendant le cas. Pour vérifier aussi le diagnostic, donner `symptom(v)` : ce que l’élève
observe, réduit à une valeur (un mot, une issue, un nombre arrondi).

```ts
  symptom: (v) => flightOf(v).outcome,   // 'crash' avec le défaut
```

Le symptôme du défaut doit différer de celui qu’on obtient en déplaçant, depuis les valeurs
saines, chacun des autres contrôles du cas à ses bornes : sinon, deux causes donnent le même
tableau, et la question de diagnostic n’a pas de réponse. Le fichier de réglage vérifie le reste
(que le défaut est franc, sur chaque graine).

## 8. L’atelier

Les exercices sont déclarés dans `exercises` et proposés dans le parcours par `c.exercise(id)`.

| Type | Champs | Usage |
|---|---|---|
| `calculation` | `intro`, `steps: [{ prompt, value, unit?, tol?, explain }]`, `win` | Un calcul guidé en 2 ou 3 étapes. Tolérance par défaut : 2 %. |
| `classify` | `intro`, `categories`, `items: [{ text, cat, why? }]`, `win` | Ranger des éléments dans des catégories. |
| `sequence` | `intro`, `items` (dans le bon ordre), `explain`, `win` | Remettre dans l’ordre. |
| `code` | `slot`, `sig`, `doc`, `goal`, `solution`, `starter`, `hints` (3), `win`, puis `tests` **ou** `scenarios` | Écrire une fonction du modèle. |

Un exercice de code se vérifie de deux façons :

- `tests: [{ label, run(fn) }]` : des tests purs ; `run` renvoie `null` ou ce qui ne va pas.
- `scenarios` (ceux de l’exercice ou ceux de `workshop.scenarios`) : une simulation exécutée avec
  la fonction de l’élève puis avec la référence, comparées échantillon par échantillon.

Options : `primm` (lire un code donné, prédire, exécuter, examiner, puis le modifier), `parsons`
(remettre les lignes de la solution dans l’ordre avant d’écrire), `preview` (un aperçu en direct),
`chart` (une courbe comparée après « Vérifier »), `standalone` (exclu de l’assemblage).

`workshop` (un champ de `defineCourse`) regroupe les `helpers` mis à
disposition du code de l’élève, les `scenarios` par défaut et la page d’**assemblage**, où toutes
les fonctions écrites par l’élève tournent ensemble (`c.exercise('assembly', …)`).

Le vérificateur exige que chaque solution soit acceptée, que chaque point de départ soit refusé
et que le code PRIMM donné à lire ne soit pas déjà accepté. Dans le navigateur, une boucle du
code de l’élève qui ne se termine pas est arrêtée au bout de 3 secondes, avec un message.

## 9. Les tests, le glossaire, la boîte à outils

**Tests.** `tests.tools` : les outils (une fiche recommandée par question manquée) ;
`tests.pre` : les notions du cours avant le cours ; `tests.post` : les mêmes notions dans d’autres
situations, chaque question liée à sa jumelle par `pair`. Les questions s’écrivent avec
`choice(question, choix, explication)` (bonne réponse en premier) et `numeric(…)`.

**Glossaire.** `{ id, name, forms?, def, tool?, module? }`. La première occurrence d’un terme dans
une étape devient une infobulle. `module` est le module qui l’introduit : le vérificateur refuse
qu’il apparaisse avant.

**Boîte à outils.** Des fiches courtes (3 étapes, 2 questions de contrôle) sur les outils dont le
cours a besoin. `pickCapsules('T4', ['T1', 'Où le cours s’en sert.'])`, importé de
`@coursekit/toolbox`, reprend des fiches de la bibliothèque (T1 vecteurs, T2 produit scalaire, T3 produit en croix, T4 dérivée et taux de
variation, T5 énergie, T6 minimum d’une fonction, T7 systèmes d’équations, T8 nombres flottants) ;
un cours ajoute les siennes au même format.

## 10. Les règles de rédaction

- **Ton.** Clair, précis, pédagogique. Pas de formules choc ni d’accroche, pas de point
  d’exclamation ; le vérificateur refuse « incroyable », « magique », « le secret »… Une phrase
  dit une chose.
- **Une idée par étape**, 75 mots au plus ; le titre nomme l’idée.
- **Chiffres calculés** par le modèle ; les affirmations importantes portent une `claim`.
- **Termes définis** au glossaire, jamais employés avant leur module.
- **Questions.** Des distracteurs plausibles, de la longueur de la bonne réponse, chacun tiré
  d’une idée fausse ; une explication qui dit pourquoi la bonne réponse est juste.
- **La réponse ne se lit pas à l’écran.** Quand une question s’ouvre, l’élève voit l’étape
  qu’elle suit, le schéma et la scène : aucun ne doit donner la réponse. Une question posée
  avant l’explication vient avant `c.diagram` ; une question de vérification fait appliquer la
  notion dans une autre situation plutôt que restituer la phrase qui précède.
- **Une question par notion** dans le fil du cours, plus le couple test de départ / test final.
- **L’effort suit la difficulté.** Un fait tient en une étape ; un mécanisme demande plusieurs
  étapes, un exemple chiffré par le modèle et un schéma qui le montre.
- **Une scène par chapitre**, choisie pour ce qu’il explique ; un schéma n’écrit pas une notion
  avant le texte.
- **Explications écrites.** Une consigne précise et une réponse modèle qui relie cause,
  mécanisme et effet.

## 11. Vérifier

```bash
npm run tune -w courses/mon-cours      # les fenêtres du modèle
npm run check -w courses/mon-cours     # le contenu : viser « ✓ prêt (0 remarque) »
npx coursekit parcours courses/mon-cours/src/course.ts parcours.md   # le cours tel qu’on le lit
npm run dev -w courses/mon-cours       # puis /?shots et une visite complète
```

Le détail des règles et des aides au test : [outils.md](outils.md).
