---
name: generate_course
description: Génère un cours interactif complet avec la bibliothèque coursekit à partir d'un sujet (« /generate_course comment fonctionne une fusée »). À utiliser quand l'utilisateur demande de créer, d'écrire ou de générer un cours, une formation ou un module d'apprentissage interactif sur un sujet.
---

# /generate_course

Produit un projet de cours coursekit prêt à être suivi : un modèle exécutable du sujet, des
schémas et une scène qui le montrent, un contenu séquentiel (étapes, questions, expériences,
explications écrites, exercices, cas cliniques, tests avant/après), vérifié par `coursekit check`
et relu dans le navigateur.

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
- **La carte des notions** : 10 à 20 notions, leurs dépendances, l’ordre d’introduction.
- **Les idées fausses courantes** (au moins 5) : chacune deviendra une question « avant » du
  test, une question posée avant l’explication (`c.ask`) ou un cas clinique.
- **Les outils mathématiques ou autres** nécessaires : ceux de `MATH_CAPSULES` (T1–T8) et ceux à
  écrire (une fiche = 3 étapes + 2 questions).

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
Si le cours enseigne à programmer le mécanisme (« comment fonctionne un moteur physique »), les
fonctions centrales du modèle deviennent des exercices de code et la page d’assemblage fait
tourner les fonctions de l’élève ensemble. Sinon, les exercices sont des calculs guidés, des
classements et des mises en ordre.

## 2. Planifier

- 3 à 5 modules `core` + un module `exam`. Chaque module : un titre, un `pitch` d’une phrase,
  2 ou 3 `goals` **évaluables** (chacun vérifié par au moins une question, une expérience ou un
  exercice), un `summary` de 3 ou 4 phrases.
- 2 à 4 chapitres par module ; 2 à 5 étapes par chapitre.
- Pour chaque chapitre, choisir : le schéma, la scène, la question posée avant l’explication,
  l’expérience (avec prédiction), la question de vérification, l’exercice éventuel.
- Une explication écrite (`c.explain`) par module au moins, avec une réponse modèle complète.
- 2 cas cliniques à la fin du dernier module, 1 cas d’épreuve dans le module `exam` : un réglage
  fautif → un symptôme observable → 3 causes possibles → correction → justification.
- Tests : 3 questions d’outils (`tools`, chacune liée à une fiche), 5 questions « avant » (`pre`)
  sur les idées fausses, 5 questions « après » (`post`) appariées une à une (`pair`), posées
  dans une autre situation.

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

## 4. Écrire et régler le modèle — avant tout contenu

1. Écrire `model.ts` : constantes, fonctions pures, une fonction de simulation qui renvoie des
   échantillons, des événements et une **issue** classée (`'orbit' | 'crash' | …`).
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
4. Écrire chaque fenêtre dans `expect` du fichier de réglage, et ajouter une `check` du modèle
   pour l’issue nominale.
5. Envelopper la simulation partagée par la scène et les schémas dans `memo(...)`.
6. **Un modèle qui tire au hasard** tire avec `rng(seed)` de `@coursekit/core` et se règle sur
   plusieurs graines : `seeds: [1, 2, 3, 4, 5]` dans `defineTune`, `run(p, seed)`, et des
   fenêtres par graine (`{ label, where, ok }` pour « chaque graine », `atLeast` / `atMost` pour
   « au moins / au plus k sur n »). Jamais une fenêtre réglée sur une seule graine. Un taux mesuré
   sur n parties se cite avec son intervalle `wilson(k, n)`.

Ne pas passer à l’étape 5 tant que le balayage ne donne pas ces fenêtres.

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
- `stageKeys` : les valeurs qui changent la scène ; les autres ne servent qu’aux schémas.

## 6. Écrire le contenu

Le contenu s’écrit dans l’ordre de lecture avec le constructeur (`c.module`, `c.chapter`,
`c.step`, `c.ask`, `c.question`, `c.numeric`, `c.order`, `c.experiment`, `c.explain`,
`c.exercise`, `c.test`, `c.clinicCase`, `c.diagram`, `c.stage`, `c.set`).

### Règles de rédaction

- **Ton.** Clair, précis, pédagogique. Pas de formules choc, pas d’accroche, pas de point
  d’exclamation, pas de « incroyable », « magique », « le secret »… Une phrase dit une chose.
- **Une idée par étape**, 75 mots au plus. Le titre nomme l’idée.
- **Chiffres calculés.** Tout chiffre du texte vient du modèle (gabarit `${fr(...)}`) et toute
  affirmation chiffrée importante porte une `claim` vérifiée par le modèle. Quand le calcul est
  coûteux (un entraînement, des centaines de parties), écrire le texte comme une fonction,
  `c.step(titre, () => \`…\`)` (et `observe: () => …` d’un cas clinique) : il est calculé à
  l’affichage, pas au chargement de la page ; ne pas calculer ces valeurs au niveau du module.
- **Glossaire.** Chaque terme technique a une entrée avec le `module` qui l’introduit ; il
  n’apparaît pas dans un texte avant ce module (le vérificateur le contrôle).
- **Questions.** La bonne réponse est écrite en premier (le constructeur la déplace). Les
  distracteurs sont plausibles, de même longueur que la bonne réponse, et chacun correspond à une
  idée fausse identifiée. L’explication dit pourquoi la bonne réponse est juste.
- **Avant d’expliquer, demander** (`c.ask`) au début des chapitres qui corrigent une idée
  fausse.
- **Expériences.** Toujours une prédiction (`predict`), des objectifs progressifs (`seq: true`)
  qui font explorer les deux côtés de la fenêtre, et une conclusion qui dit ce qu’il fallait
  observer.
- **Cas cliniques.** `coursekit check` exige que l’objectif soit faux avec le réglage fautif et
  vrai en rétablissant ce seul réglage (attention aux `c.set` antérieurs, qui valent aussi pendant
  le cas). Donner `symptom(v)` (l’issue observée) : aucun autre contrôle du cas ne doit donner le
  même symptôme.
- **Explications écrites.** Une consigne précise (« Expliquez pourquoi… ») et une réponse modèle
  qui relie la cause, le mécanisme et l’effet.
- **Exercices.** Calcul guidé : 2 ou 3 étapes avec les valeurs du modèle. Code : signature,
  documentation des arguments, objectif, solution, point de départ refusé, trois indices (le
  dernier n’est pas la solution), PRIMM pour le premier exercice de code d’un cours, Parsons pour
  les fonctions longues, scénarios comparés à la référence.
- **Fiches de la boîte à outils** référencées par les étapes qui en ont besoin (`tools`).

## 7. Vérifier

1. `npm run typecheck`, `npm run tune -w courses/<id>` puis `npm run check -w courses/<id>`
   (ou `npm test` pour tout le dépôt). Corriger jusqu’à
   « ✓ prêt (0 remarque) » : les remarques `layout` (texte hors du cadre, textes superposés,
   trouvées en dessinant chaque schéma aux bornes des expériences), `stage-layout` (texte de scène
   hors de `safe`, sur un écran large ou étroit) et `effort` (durée annoncée loin de l’estimation)
   se corrigent aussi. Ne jamais
   affaiblir une règle du vérificateur pour passer.
2. Lancer le serveur de développement (onglet de terminal) et ouvrir le cours dans le navigateur
   intégré :
   - ouvrir `/?shots` : la grille de tous les schémas, aux valeurs du fil du cours et aux
     bornes des expériences ; chercher les valeurs absurdes (le vérificateur ne lit pas le sens) ;
   - parcourir chaque chapitre avec `window.course.goto(chapitre, étape)` (les pauses précédentes
     comptent comme faites ; `window.course.pauses(false)` pour toutes les passer) ; capturer la
     scène et le schéma, sur un écran large et un écran étroit ;
   - ouvrir l’atelier : faire chaque calcul guidé, la séquence PRIMM, le Parsons ;
   - vérifier la console : aucune erreur.
3. Relire tous les textes une fois, à voix basse : ton, une idée par étape, termes définis.

## 8. Livrer

Commit du dossier du cours, puis un compte rendu court : la question centrale, le plan des
modules, le modèle et ses fenêtres réglées, les statistiques de `coursekit stats`, la commande
pour lancer le cours, et ce qui reste incertain (approximations du modèle, notions laissées de
côté).

## Liste de contrôle finale

- [ ] Le modèle a des `checks`, dont l’issue nominale et chaque fenêtre utilisée.
- [ ] Chaque objectif de module est évalué.
- [ ] Chaque question « après » a sa jumelle « avant ».
- [ ] Chaque expérience a une prédiction et une conclusion.
- [ ] Chaque module a une explication écrite.
- [ ] Les cas cliniques ont un seul réglage fautif et un symptôme qui lui est propre.
- [ ] Aucun chiffre écrit à la main dans les textes.
- [ ] `coursekit tune` : toutes les fenêtres attendues vérifiées.
- [ ] `coursekit check` : prêt, 0 remarque.
- [ ] Grille `?shots` relue ; scène dans `safe` ; console sans erreur.
