---
name: generate_course
description: Génère un cours interactif complet avec la bibliothèque coursekit à partir d'un sujet (« /generate_course comment fonctionne une fusée »). À utiliser quand l'utilisateur demande de créer, d'écrire ou de générer un cours, une formation ou un module d'apprentissage interactif sur un sujet.
---

# /generate_course

Produit un projet de cours coursekit prêt à être suivi : un modèle exécutable du sujet, des
schémas et une scène qui le montrent, un contenu séquentiel (étapes, questions, expériences,
explications écrites, exercices, cas cliniques, tests avant/après), vérifié par `coursekit check`,
validé contre une source indépendante et relu dans le navigateur.

Viser un cours **plus profond, pas plus gros** : peu d’idées, reprises sous plusieurs angles,
et des résultats qui tiennent quand on change la graine ou l’implémentation. Exemple complet :
`courses/alphazero` (README, `validation/README.md`, `src/tune.ts`).

Un cours complet, vérifié et réglé peut encore être mauvais à suivre. Les quatre défauts qu’on
trouve en le suivant en entier, et que les règles ci-dessous préviennent :

1. **L’effort mal réparti** : les idées faciles reviennent sans cesse (test de départ, question
   d’ouverture, prédiction, objectif d’expérience, cas clinique), les idées difficiles sont dites
   en une phrase. → la carte de difficulté (§ 1) et ses budgets (§ 6).
2. **La réponse à l’écran** : la question s’ouvre sous l’étape qui vient de la donner, ou à côté
   d’un schéma qui l’imprime. → § 6, « Questions », et la règle `spoiler` (§ 7).
3. **La scène d’un autre chapitre** : une scène reste affichée d’un chapitre à l’autre, ou montre
   un résultat que le cours n’a pas encore expliqué. → le tableau des chapitres (§ 2) et § 5.
4. **La progression brouillée** : un chapitre s’appuie sur une notion, un résultat ou un schéma
   d’un chapitre suivant. → ce que chaque chapitre suppose (§ 2), la règle `term-early` (§ 7).

Entrée : le sujet, en langage naturel. Le reste a des valeurs par défaut.

## 0. Cadrer (sans bloquer)

Déduire de la demande, sinon prendre les valeurs par défaut et les annoncer en une ligne :

| | défaut |
|---|---|
| public | lycée |
| langue | celle de la demande |
| durée | 3 à 4 heures (4 modules + épreuve) |
| dossier | `courses/<id>` dans le dépôt coursekit, `<id>` tiré du sujet |

Ne poser une question que si le sujet est ambigu au point de changer le modèle (« les fusées » :
la propulsion ? l’histoire spatiale ?).

## 1. Analyser le sujet

Écrire (pour soi, dans le carnet de travail) :

- **La question centrale** à laquelle le cours répond, en une phrase.
- **Les idées-clés** : 4 à 6 concepts seuils (ceux qui changent la façon de voir le sujet),
  chacun repris dans au moins deux modules. Le README du cours les nomme.
- **La carte des notions** : 10 à 20 notions, leurs dépendances, l’ordre d’introduction. Chaque
  notion sert une idée-clé ; couper les faits décoratifs (dates, records, anecdotes) qui n’en
  servent aucune.
- **Les idées fausses courantes** (au moins 5) : chacune deviendra **une** question « avant »
  du test, **ou** une question posée avant l’explication (`c.ask`), **ou** un cas clinique — pas
  les trois. La même idée fausse posée trois fois avec les mêmes mots n’approfondit rien.
- **Les outils mathématiques ou autres** nécessaires : ceux de `MATH_CAPSULES` (T1–T8) et ceux à
  écrire (une fiche = 3 étapes + 2 questions).
- **La carte de difficulté.** Pour chaque notion, un niveau :

  | niveau | ce que c’est | exemple (`courses/alphazero`) | budget dans le cours |
  |---|---|---|---|
  | 1 | un fait, une définition | « AlphaZero part des seules règles » | une étape ; au plus une question hors des tests |
  | 2 | une relation entre deux grandeurs | « le bonus diminue avec les visites » | une ou deux étapes, une question d’application |
  | 3 | un mécanisme à plusieurs pièces, ou un résultat contre-intuitif | « plus de simulations corrigent le biais des parties au hasard » ; « la somme du façonnage par potentiel ne dépend que du départ » | au moins trois étapes, un exemple chiffré par le modèle, un schéma qui montre le **mécanisme** (pas seulement le résultat), une question qui le fait appliquer |

  Les niveaux 3 sont le cœur du cours : les lister à part, et vérifier en fin d’écriture qu’aucun
  n’est expliqué en une phrase. Une étape de niveau 3 dit *pourquoi*, sur un cas que l’élève
  peut suivre pas à pas (deux parcours de l’écrou, Φ à chaque pas, les deux totaux), avant la
  règle générale.

### Les sources

- Pour toute méthode publiée que le modèle reproduit, lire la **source primaire** (l’article,
  pas un résumé) et en reprendre la formule exacte et les hyperparamètres ; citer la section.
- Chaque chiffre publié va dans `FACTS` avec sa source en commentaire (auteur, année, section).
  Ces chiffres sont cités, jamais recalculés.
- Une source faible (page de projet sans article ni auteurs, billet non relu) est signalée
  comme telle dans le cours, à l’endroit où on s’en sert.

### Le modèle exécutable

Règle principale : **si le sujet est un mécanisme, le cours en construit une version miniature
qui fonctionne.**

| Sujet | Modèle |
|---|---|
| un moteur physique | un mini moteur (intégration, collisions, contraintes) |
| une fusée | un simulateur de vol (poussée, masse variable, étages, atmosphère, orbite) |
| un compilateur | un mini compilateur (lexer, parseur, évaluation) |
| le cœur humain | un modèle de pression et de débit dans les cavités |
| l’inflation | un modèle prix / masse monétaire / production |
| un sujet sans mécanisme (histoire, littérature) | un modèle de données (chronologie, relations) ou pas de modèle, et `imageStage` |

Le modèle est une petite bibliothèque TypeScript pure (pas de DOM), 150 à 400 lignes, que les
schémas, la scène, les expériences, les exercices et les chiffres du texte appellent tous.
Préférer une **version échantillonnée fidèle** de l’algorithme (les mêmes étapes, en petit) à un
modèle « en moyenne » inventé ; aucune constante ad hoc sans justification écrite à côté
(source, loi, ou réglage documenté dans `tune.ts`). Tout aléa passe par un générateur à graine.
Si le cours enseigne à programmer le mécanisme (« comment fonctionne un moteur physique »), les
fonctions centrales du modèle deviennent des exercices de code et la page d’assemblage fait
tourner les fonctions de l’élève ensemble. Sinon, les exercices sont des calculs guidés, des
classements et des mises en ordre.

## 2. Planifier

- 3 à 5 modules `core` + un module `exam`. Chaque module : un titre, un `pitch` d’une phrase,
  2 ou 3 `goals` **évaluables** (chacun vérifié par au moins une question, une expérience ou un
  exercice), un `summary` de 3 ou 4 phrases, un **budget de durée** (45 à 60 min) et les
  idées-clés qu’il reprend. Un module qui dépasse son budget perd des étapes, pas des idées.
- 2 à 4 chapitres par module ; 2 à 5 étapes par chapitre.
- **Le tableau des chapitres**, écrit avant le contenu (dans le carnet de travail), une ligne par
  chapitre :

  | chapitre | notions (niveau) | ce qu’il suppose connu | scène | schéma(s) | question | expérience |
  |---|---|---|---|---|---|---|

  - *ce qu’il suppose connu* : chaque élément vient d’un chapitre **précédent**. Un chapitre ne
    montre pas un résultat d’un chapitre suivant (dans `courses/alphazero`, la première version
    montrait au module 2 les mesures d’un réseau entraîné par auto-jeu, expliqué au module 3).
    Introduire un mécanisme sur le plus petit modèle qui le montre (le réseau à deux paramètres)
    avant le modèle complet (le réseau d’AlphaZero), puis reprendre l’idée sur le second.
  - *scène* : celle qui montre ce que **ce** chapitre explique, choisie pour lui. Une scène qui
    reste du chapitre précédent est un choix à refaire. Une scène par mécanisme est courante
    (l’arbre de jeu, des parties au hasard rejouées, l’arbre de la recherche, un réseau, le robot)
    ; plusieurs chapitres peuvent partager une scène, avec des réglages (`c.stage(clé, { … })`)
    qui la mettent au point du chapitre.
  - *question* : de quel type (application, calcul, transfert, inférence) ; la restitution d’une
    phrase qu’on vient de lire n’en est pas une (§ 6).
- Une explication écrite (`c.explain`) par module au moins, avec une réponse modèle complète.
- 1 ou 2 cas cliniques **à la fin du module dont ils mobilisent les notions**, 1 cas d’épreuve
  dans le module `exam` : un réglage fautif → un symptôme observable → 3 causes possibles →
  correction → justification. Le réglage fautif d’un cas n’est pas celui qu’une expérience du
  même module vient de faire trouver : le diagnostic serait une redite. Partager les réglages :
  l’expérience fait explorer l’un (le bruit à la racine), le cas fait diagnostiquer l’autre (la
  température) ; ou l’expérience explore un côté de la fenêtre (cible de 0,05 à 0,6), le cas
  l’autre (cible à 0,95).
- Au moins un **diagnostic différentiel** : le même symptôme, deux causes, départagées par une
  preuve que l’élève produit (plusieurs graines, un balayage, une mesure). Exemple : un robot qui
  plafonne par récompense mal façonnée (à chaque graine) ou par effondrement (à certaines).
- Tests : 3 questions d’outils (`tools`, chacune liée à une fiche), 5 questions « avant » (`pre`),
  chacune liée à une idée fausse et à une idée-clé, 5 questions « après » (`post`) appariées une
  à une (`pair`), posées dans une autre situation.

## 3. Créer le projet

```bash
npm run new -- courses/<id> "<titre>"
npm install
```

Le cours est un espace de travail npm : `npm test`, `npm run check`, `npm run tune` et
`npm run build` à la racine l’incluent sans autre déclaration. `coursekit new` donne déjà un port
fixe et libre au serveur de développement (`vite --port 518x --strictPort` dans
`courses/<id>/package.json`), une scène d’exemple (`src/stage.ts`) et un `main.ts` qui la monte.
Compléter le `README.md` créé (plan des modules, modèle, simplifications), sur le modèle
de `courses/fusee/README.md`.

Fichiers : `src/model.ts`, `src/tune.ts`, `src/diagrams.ts`, `src/stage.ts`, `src/course.ts`,
`src/main.ts`. S’inspirer de `courses/fusee`, qui utilise tous les éléments du format. La
référence du format est `docs/ecrire-un-cours.md` ; celle de l’API, `docs/reference.md`.

Le cours n’utilise que l’API publique des paquets ; il ne modifie jamais la bibliothèque
(`packages/`). Les pratiques d’organisation à suivre :

- **Une seule déclaration.** `export default defineCourse({ …, model, exercises, workshop, … })` :
  l’atelier (`workshop` : helpers, scénarios, assemblage) est un champ du cours, comme le modèle.
- **Les imports par paquet.** Les primitives de dessin et la palette `CC` viennent de
  `@coursekit/diagrams` ; les fiches de maths (`pickCapsules`) de `@coursekit/toolbox` ; les
  nombres (`fr`, `dec`, `pct`) et les questions (`choice`, `numeric`) de `@coursekit/core`.
- **La palette partagée.** Schémas, scène et aperçus de l’atelier dessinent avec `CC` (orange,
  bleu, vert, rouge…), jamais avec leurs valeurs hexadécimales : c’est la palette du lecteur.
  Les couleurs propres au sujet (un ciel, un sol, un mur) se nomment dans un objet de couleurs du
  cours (`COL`).
- **La langue.** `language: 'fr'` (ou `'en'`) choisit les textes de l’interface, le format des
  nombres et les tournures interdites ; `labels` ne sert qu’à remplacer un texte de l’interface
  qui ne convient pas au sujet. Les textes du cours (étapes, questions, schémas) sont écrits
  dans cette langue.
- **Des identifiants stables.** La progression de l’élève est rangée par identifiant de question,
  d’expérience et d’exercice : `version` s’augmente quand le contenu change, mais les
  identifiants existants ne changent pas (sinon les réponses de l’élève sont perdues).

## 4. Écrire et régler le modèle — avant tout contenu

1. Écrire `model.ts` : constantes, fonctions pures, une fonction de simulation qui renvoie des
   échantillons, des événements et une **issue** classée (`'orbit' | 'crash' | …`). Les seuils
   qui définissent les issues sont des constantes du modèle, lues par les schémas, la scène et
   le texte : une seule source de vérité.
2. Ajouter `model: DomainModel` avec des `checks` : une loi connue (cas limite exact), un ordre
   de grandeur réel, et **l’issue du réglage nominal**.
3. Écrire `src/tune.ts` avec `defineTune({ grid, run, show, expect })` et le lancer
   (`npm run tune -w courses/<id>`). Il
   imprime l’issue pour chaque combinaison (un tableau pour deux paramètres). Régler jusqu’à
   obtenir, pour chaque expérience et chaque cas clinique prévus :
   - une **fenêtre de réussite** nette et assez large pour être trouvée au curseur ;
   - un échec distinct de chaque côté (trop peu / trop), avec un symptôme visible ;
   - pour chaque cas clinique, un réglage fautif dont le symptôme ne se confond pas avec celui
     d’un autre réglage.

   Un modèle aléatoire se règle sur **au moins 4 graines** : une fenêtre n’est retenue que si
   elle tient pour chaque graine, ou pour une proportion annoncée (« au moins 4 graines sur
   5 »), et le cours dit cette proportion. Un résultat de match se donne avec son intervalle de
   confiance (Wilson à 95 %), jamais seul.
4. Écrire chaque fenêtre dans `expect` du fichier de réglage, et ajouter une `check` du modèle
   pour l’issue nominale.
5. Envelopper la simulation partagée par la scène et les schémas dans `memo(...)`.
6. **Un modèle qui tire au hasard** tire avec `rng(seed)` de `@coursekit/core` et se règle sur
   plusieurs graines : `seeds: [1, 2, 3, 4, 5]` dans `defineTune`, `run(p, seed)`, et des
   fenêtres par graine (`{ label, where, ok }` pour « chaque graine », `atLeast` / `atMost` pour
   « au moins / au plus k sur n »). Jamais une fenêtre réglée sur une seule graine. Un taux mesuré
   sur n parties se cite avec son intervalle `wilson(k, n)`.
7. **Valider contre une source indépendante**, pour chaque partie du modèle qui le permet (au
   moins une) : une implémentation tierce (ex. OpenSpiel), une solution exacte ou un tableau
   publié. Dans `validation/` : un `README.md` (ce qui est comparé, le protocole, le tableau des
   résultats, ce que la comparaison a corrigé, comment reproduire, ce qui n’est pas couvert), le
   script et ses résultats bruts. Recopier les résultats de référence dans `src/` et ajouter une
   `check` qui compare (par exemple : les intervalles se recouvrent). Un désaccord est un
   signal, pas un bruit : en chercher la cause (dans `courses/alphazero`, il a révélé un biais
   d’ordre des coups) avant de toucher aux paramètres.

**Honnêteté.** Si le jouet ne reproduit pas un effet de la source (ex. SGS peu sensible à la
cible), le cours le dit et explique pourquoi, au lieu de forcer les paramètres.

Ne pas passer à la section 5 tant que le balayage ne donne pas ces fenêtres sur toutes les graines.

## 5. Schémas et scène

- **Un schéma par idée**, dessiné dans l’espace `DW × DH` (380 × 236) avec les primitives de
  `@coursekit/diagrams` et la palette `CC` (orange : ce qu’on explique ; bleu : la référence ;
  rose : forces ; vert : réussi ; rouge : échec). Chaque schéma lit `e.v` et appelle le modèle ;
  aucun chiffre écrit à la main ; les nombres passent par `fr`, `dec`, `pct` de `@coursekit/core`.
- Axes : pas de graduation sous le libellé de l’axe ; libellés courts.
- **Scène** (`canvasStage`) : le fond peut couvrir tout le canevas, mais l’action et les
  grandeurs affichées restent dans `safe`, le rectangle passé à `draw(ctx, w, h, t, réglages,
  données, safe)` : la zone qu’aucun panneau ne couvre. Positionner tout en fonction de `safe`,
  jamais de `w` et `h`.
- `stageKeys` : les valeurs qui changent la scène ; les autres ne servent qu’aux schémas. Une
  expérience dont un contrôle fait partie de `stageKeys` anime la scène : la descente de
  gradient fait bouger les deux paramètres du réseau de la scène, le nombre de simulations fait
  grandir l’arbre.
- **Un schéma ne précède pas le texte.** Il n’écrit pas un terme du glossaire avant l’étape qui
  l’introduit, ni un résultat que le chapitre n’a pas encore établi. Un schéma qui dévoile ses
  parties au fil des étapes prend un `arg` (`c.diagram('detour', { arg: '4n' })` : la ligne des
  points de proximité, puis `'4p'` : celle du potentiel).
- **Un schéma suit le curseur quand une prédiction porte sur lui.** Une courbe de résultats
  (force selon les simulations, apprentissage selon les parties) se dessine jusqu’à la valeur
  courante seulement, et l’expérience part du bas (`c.stage('tree', { sims: 10 })`) : la
  prédiction se fait avant que la courbe ne soit à l’écran.
- **Le schéma d’un cas clinique montre le symptôme, pas le réglage.** Un `arg` (`diagram:
  { name: 'explore', arg: 'case' }`) retire du schéma la ligne qui écrit les réglages (« coups
  tirés au hasard : 0 », « proximité, w = 4 ») et garde ce que l’élève observerait.

## 6. Écrire le contenu

Le contenu s’écrit dans l’ordre de lecture avec le constructeur (`c.module`, `c.chapter`,
`c.step`, `c.ask`, `c.question`, `c.numeric`, `c.order`, `c.experiment`, `c.explain`,
`c.exercise`, `c.test`, `c.clinicCase`, `c.diagram`, `c.stage`, `c.set`).

### Règles de rédaction

- **Ton.** Clair, précis, pédagogique. Pas de formules choc, pas d’accroche, pas de point
  d’exclamation, pas de « incroyable », « magique », « le secret »… Une phrase dit une chose.
- **Une idée par étape**, 75 mots au plus. Le titre nomme l’idée.
- **L’effort suit la difficulté** (la carte du § 1). Une notion de niveau 1 tient en une étape ;
  ne pas la reposer en question d’ouverture, en prédiction et en objectif d’expérience. Une
  notion de niveau 3 a ses étapes : l’intuition, l’exemple chiffré suivi pas à pas, la règle,
  sa conséquence ou sa limite. Signe d’alerte : une subordonnée qui explique un mécanisme
  (« les estimations se corrigent de niveau en niveau ») ; elle demande une étape et un schéma.
- **Chaque comparaison ou cause affirmée est mesurée.** « La politique se trompe davantage sur
  les positions jamais vues » doit avoir sa `claim` et sa fenêtre dans `tune.ts` ; sinon, la
  retirer. Dans `courses/alphazero`, la mesure a montré que c’était faux pour la politique et
  vrai pour la valeur : le texte dit maintenant ce que le modèle montre.
- **Chiffres calculés.** Tout résultat du texte vient du modèle (gabarit `${fr(...)}`) et toute
  affirmation chiffrée importante porte une `claim` vérifiée par le modèle. Les données d’un
  énoncé (« 100 parties », « c = 5 ») peuvent s’écrire ; les résultats, jamais.
- **Calcul coûteux dans le texte.** Les gabarits ordinaires sont évalués au chargement de la
  page : pas d’entraînement ni de balayage dedans. Quand un résultat coûte (un entraînement, des
  centaines de parties), écrire le texte comme une fonction, `c.step(titre, () => \`…\`)` (et
  `observe: () => …` d’un cas clinique) : il est calculé à l’affichage ; ne pas calculer ces
  valeurs au niveau du module.
- **Glossaire.** Chaque terme technique a une entrée avec le `module` qui l’introduit ; il
  n’apparaît pas dans un texte avant ce module (le vérificateur le contrôle).
- **Questions.** La bonne réponse est écrite en premier (le constructeur la déplace). Les
  distracteurs sont plausibles, de même longueur que la bonne réponse, et chacun correspond à une
  idée fausse identifiée. L’explication dit pourquoi la bonne réponse est juste.
- **La réponse ne se lit pas à l’écran.** Quand une question s’ouvre, l’élève voit le texte de
  l’étape qu’elle suit, le schéma et la scène. Aucun des trois ne doit contenir la réponse : ni
  le nombre (« après 2 coups : 72 positions » sous « combien de positions après deux coups ? »),
  ni la phrase (« elle remplace les parties au hasard » juste au-dessus de « la valeur
  remplace… »), ni l’ordre (les quatre phases dessinées en boîtes sous « remettez les phases dans
  l’ordre »). Remèdes : poser la question avant `c.diagram` (le schéma du chapitre arrive
  après la question d’ouverture), passer à `c.diagram(null)` ou à un autre schéma pour l’étape qui
  précède la question, ou changer la question.
- **Appliquer, pas restituer.** Une question qui reprend la phrase de l’étape précédente ne
  vérifie que la lecture. La poser dans une autre situation (« le parent passe de 100 à 400
  visites : que devient le bonus ? »), faire calculer, faire inférer d’une observation (« où le
  joueur parfait trouvera-t-il une erreur ? »). Les questions de restitution sont pour les
  révisions, pas pour le fil du cours.
- **Pas de doublon.** Une notion n’est interrogée qu’une fois dans le fil du cours, plus le
  couple test de départ / test final. La question d’ouverture ne répète pas le test de départ, la
  prédiction de l’expérience ne répète pas la question d’ouverture, un calcul guidé de l’atelier
  ne refait pas la question numérique qui le précède. Le test final pose sa notion dans une autre
  situation que sa jumelle, avec d’autres mots. La règle `repeat` (§ 7) signale les doublons.
- **Avant d’expliquer, demander** (`c.ask`) au début des chapitres qui corrigent une idée
  fausse, avant le schéma du chapitre. Une question d’ouverture porte sur ce qui surprend (« le
  coin, qui perd, aura-t-il une moyenne plus basse au hasard ? »), pas sur ce qui se devine.
- **Expériences.** Toujours une prédiction (`predict`), des objectifs progressifs (`seq: true`)
  qui font explorer les deux côtés de la fenêtre, et une conclusion qui dit ce qu’il fallait
  observer. La prédiction porte sur ce que ni l’étape précédente ni le schéma n’ont montré : soit
  l’expérience vient avant l’étape qui donne le résultat, soit elle demande une conséquence
  (« à partir de quel poids le robot force-t-il l’écrou ? » après le calcul du détour). Les
  valeurs de départ des contrôles font partie des options offertes, et le schéma y est lisible
  (pas « 8 sur 8 plafonnent » pour un réglage absent des choix).
- **Cas cliniques.** `coursekit check` exige que l’objectif soit faux avec le réglage fautif et
  vrai en rétablissant ce seul réglage (attention aux `c.set` antérieurs, qui valent aussi pendant
  le cas). Donner `symptom(v)` (l’issue observée) : aucun autre contrôle du cas ne doit donner le
  même symptôme. Le texte `observe` donne la preuve qui départage (« toutes les graines », « deux
  fois moins de parties différentes ») ; le titre du cas ne recopie pas l’objectif d’une
  expérience ; le schéma du cas ne montre que le symptôme (§ 5).
- **Explications écrites.** Une consigne précise (« Expliquez pourquoi… ») et une réponse modèle
  qui relie la cause, le mécanisme et l’effet.
- **Exercices.** Calcul guidé : 2 ou 3 étapes avec les valeurs du modèle. Code : signature,
  documentation des arguments, objectif, solution, point de départ refusé, trois indices (le
  dernier n’est pas la solution), PRIMM pour le premier exercice de code d’un cours, Parsons pour
  les fonctions longues, scénarios comparés à la référence.
- **Fiches de la boîte à outils** référencées par les étapes qui en ont besoin (`tools`).

## 7. Vérifier

1. `npm run typecheck`, `npm run lint`, `npm run tune -w courses/<id>` puis
   `npm run check -w courses/<id>` (ou `npm test` pour tout le dépôt, ce que lance aussi la CI). Corriger jusqu’à
   « ✓ prêt (0 remarque) » : les remarques `layout` (texte hors du cadre, textes superposés,
   trouvées en dessinant chaque schéma aux bornes des expériences), `stage-layout` (texte de scène
   hors de `safe`, sur un écran large ou étroit) et `effort` (durée annoncée loin de l’estimation)
   se corrigent aussi, comme les trois remarques qui lisent l’écran :
   - `spoiler` : la réponse d’une question, d’une prédiction ou d’un diagnostic se lit dans le
     schéma, la scène ou l’étape affichée au-dessus ; le réglage fautif d’un cas est écrit sur
     son schéma ou sa scène ;
   - `term-early` : un schéma ou une scène écrit un terme du glossaire avant son module, ou
     avant toute étape qui l’emploie ;
   - `repeat` : deux questions (fil du cours, prédictions, tests, calculs guidés) posent la même
     chose avec les mêmes mots, ou une question finale reprend les mots de sa jumelle.
   Ces règles sont des heuristiques : elles trouvent le chiffre, l’ordre ou les mots, pas le sens.
   Les corriger en changeant le cours, jamais en reformulant pour leur échapper. Ne jamais
   affaiblir une règle du vérificateur pour passer.
2. **Lire le cours tel que l’élève le voit** : `npx coursekit parcours src/course.ts parcours.md`
   (depuis `courses/<id>`) écrit, dans l’ordre, chaque étape avec les textes du schéma et de la
   scène affichés à côté, chaque question avec sa réponse, chaque expérience avec sa prédiction,
   ses objectifs et sa conclusion. Le relire en entier, puis le faire relire par **un agent qui ne
   connaît rien du cours** (outil Agent), avec cette consigne et ce fichier seulement :

   > Tu es un élève de fin de lycée qui suit ce cours d’un bout à l’autre. Relève, avec la ligne :
   > (1) chaque question dont la réponse se lit dans l’étape au-dessus, le schéma ou la scène ;
   > (2) chaque question de pure restitution ; (3) les idées répétées plus de deux fois et les
   > idées difficiles expliquées en une ou deux phrases ; (4) chaque scène ou schéma qui ne
   > correspond pas à ce que dit l’étape ; (5) chaque notion, chiffre ou résultat employé avant
   > d’être expliqué ; (6) chaque saut de difficulté entre deux étapes. Ne propose pas de
   > réécriture : liste les défauts, du plus grave au moins grave.

   Corriger chaque défaut retenu, puis relancer `check` et `parcours`.
3. Lancer le serveur de développement (onglet de terminal) et ouvrir le cours dans le navigateur
   intégré :
   - ouvrir `/?shots` : la grille de tous les schémas, aux valeurs du fil du cours et aux
     bornes des expériences ; chercher les valeurs absurdes (le vérificateur ne lit pas le sens) ;
   - mesurer le chargement : la page est utilisable en moins de 2 s ; sinon, chercher le calcul
     lourd exécuté à l’import (gabarits de texte, constantes du modèle) ;
   - parcourir chaque chapitre avec `window.course.goto(chapitre, étape)` (les pauses précédentes
     comptent comme faites ; `window.course.pauses(false)` pour toutes les passer) ; capturer la
     scène et le schéma, sur un écran large et sur un écran étroit (la scène et ses grandeurs
     restent lisibles dans `safe`) ;
   - ouvrir l’atelier : faire chaque calcul guidé, la séquence PRIMM, le Parsons ;
   - vérifier la console dans un **onglet neuf** : aucune erreur (les erreurs du rechargement à
     chaud persistent dans un onglet ouvert et trompent).
4. Relire tous les textes une fois, à voix basse : ton, une idée par étape, termes définis.

## 8. Livrer

Commit du dossier du cours (la CI le publie avec les autres sur GitHub Pages une fois sur
`main`, à l’adresse `…/<id>/`), puis un compte rendu court : la question centrale, les idées-clés,
le plan des modules, le modèle et ses fenêtres réglées (avec le nombre de graines), ce que la
validation a comparé et corrigé, ce que la relecture indépendante a trouvé et ce qui en a été
corrigé, les statistiques de `coursekit stats`, la commande pour lancer
le cours, et ce qui reste incertain (approximations du modèle, effets non reproduits, sources
faibles, notions laissées de côté).

## Liste de contrôle finale

- [ ] 4 à 6 idées-clés, chacune reprise dans au moins deux modules ; un budget par module.
- [ ] Carte de difficulté écrite ; chaque notion de niveau 3 a au moins trois étapes, un exemple
      chiffré, un schéma du mécanisme et une question d’application ; aucune notion de niveau 1
      interrogée plus d’une fois hors des tests.
- [ ] Tableau des chapitres écrit : chaque chapitre ne suppose que des chapitres précédents, et a
      sa scène choisie pour lui.
- [ ] Chaque méthode reproduite suit sa source primaire ; chaque chiffre de `FACTS` a sa source.
- [ ] Le modèle a des `checks`, dont l’issue nominale et chaque fenêtre utilisée.
- [ ] Fenêtres aléatoires vérifiées sur au moins 4 graines ; matchs avec intervalle de confiance.
- [ ] `validation/` : README, script, résultats, et une `check` qui compare.
- [ ] Au moins un diagnostic différentiel ; chaque question « avant » liée à une idée fausse et
      à une idée-clé.
- [ ] Chaque objectif de module est évalué.
- [ ] Chaque question « après » a sa jumelle « avant ».
- [ ] Chaque expérience a une prédiction et une conclusion.
- [ ] Chaque module a une explication écrite.
- [ ] Les cas cliniques ont un seul réglage fautif et un symptôme qui lui est propre ; chacun
      est à la fin du module qu’il mobilise ; son réglage n’est pas celui qu’une expérience vient
      de faire trouver ; son schéma montre le symptôme, pas le réglage.
- [ ] Aucune réponse à l’écran à l’ouverture d’une question ; aucune question de restitution dans
      le fil du cours ; aucune question en double.
- [ ] Chaque comparaison ou cause affirmée par le texte a sa `claim` et sa fenêtre.
- [ ] Aucun résultat écrit à la main dans les textes ; aucun calcul lourd dans les gabarits.
- [ ] `coursekit tune` : toutes les fenêtres attendues vérifiées.
- [ ] `coursekit check` : prêt, 0 remarque (dont `spoiler`, `term-early`, `repeat`).
- [ ] `npm run lint` et `npm run typecheck` passent ; les couleurs de la palette passent par `CC` ;
      `workshop` déclaré dans `defineCourse`.
- [ ] `coursekit parcours` relu en entier, et par un agent sans contexte ; ses défauts corrigés.
- [ ] Chargement sous 2 s ; grille `?shots` relue ; scène dans `safe` sur écran étroit ;
      console sans erreur dans un onglet neuf.
