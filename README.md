# coursekit

coursekit sert à écrire des **cours interactifs** dont chaque chiffre, chaque schéma et chaque
expérience viennent d’un **modèle exécutable du sujet** : une petite simulation que l’élève fait
varier et que les outils vérifient.

Un cours coursekit est un fichier TypeScript qui se lit dans l’ordre du cours :

```ts
c.chapter('Décoller', () => {
  c.stage('pad');                       // la scène animée en arrière-plan
  c.diagram('forces');                  // le schéma qui accompagne le texte
  c.step('Deux forces au départ', `… le rapport poussée / poids vaut ${fr(twr, 2)} …`, {
    claims: [{ text: 'rapport 1,33', check: () => near(twr, 1.33) }],   // vérifié par le modèle
  });
  c.experiment({ title: 'Réglez la poussée', predict: { … }, controls: [ … ], goals: [ … ], conclusion: '…' });
  c.question('q-twr', 'Une fusée a un rapport de 1,2. Son accélération ?', ['environ 2 m/s²', …], '…');
  c.exercise('twr', 'Dans l’atelier, calculez le rapport poussée / poids du lanceur.');
});
```

Le lecteur en fait une visite pas à pas, avec des questions posées avant l’explication, des
expériences avec prédiction, des explications écrites comparées à une réponse modèle, un atelier
(calculs guidés, classements, mises en ordre, code), des cas cliniques à diagnostiquer, des
révisions espacées, un test de départ et un test final appariés, un glossaire et des fiches de
synthèse.

Le vérificateur (`coursekit check`) relit le cours avant toute diffusion : longueur et ton des
textes, termes employés avant d’être introduits, bonnes réponses trop longues ou mal réparties,
liens cassés, affirmations chiffrées démenties par le modèle, exercices dont la solution est
refusée, schémas qui débordent aux valeurs extrêmes.

## Démarrer

Node 22.18 ou plus récent (le code TypeScript est exécuté directement par Node).

```bash
npm install
npm test                 # typage, règles du vérificateur, vérification et réglage des cours
```

## Lancer les cours d’exemple

Le dépôt contient trois cours. Chacun se lance depuis la racine du dépôt, après `npm install`,
et s’ouvre dans le navigateur à l’adresse indiquée :

| Commande | Cours | Adresse |
|---|---|---|
| `npm run dev:fusee` | « Comment fonctionne une fusée » : poussée, fusée à étages, vol jusqu’à l’orbite (lycée, 3 à 4 h). | http://localhost:5182 |
| `npm run dev:epidemie` | « Comment une épidémie se propage » : R0, modèle SIR, vaccination, aplatir la courbe (lycée, 3 à 4 h). Écrit avec `/generate_course`. | http://localhost:5183 |
| `npm run dev:demo` | Le cours jouet : la chute d’un objet, avec chaque élément du format une fois. | http://localhost:5181 |

Le cours s’ouvre sur sa page d’accueil ; « Commencer le cours » lance la visite pas à pas. Les mêmes
commandes existent pour chaque cours, avec `-w courses/<cours>` :

```bash
npm run check -w courses/epidemie    # relit le cours (textes, affirmations, exercices, bornes)
npm run tune -w courses/epidemie     # vérifie les fenêtres de réglage du modèle
npm run build -w courses/epidemie    # site statique dans courses/epidemie/dist/
```

Dans la console du navigateur, `window.course.list()` liste les chapitres et
`window.course.goto(chapitre, étape)` y saute ; `/?shots` affiche tous les schémas.

Créer un cours :

```bash
npm run new -- courses/mon-cours "Mon cours"
npm install
npm run dev -w courses/mon-cours
```

Puis lire [docs/ecrire-un-cours.md](docs/ecrire-un-cours.md).

## Contenu du dépôt

| Dossier | Contenu |
|---|---|
| [`packages/core`](packages/core) | Le format d’un cours, le constructeur, la frise, la progression enregistrée, les nombres en français. Sans DOM. |
| [`packages/diagrams`](packages/diagrams) | Les primitives de dessin des schémas, le cache, les fiches mathématiques de la boîte à outils. |
| [`packages/exercises`](packages/exercises) | Les types d’exercices de l’atelier et leur vérification. Sans DOM. |
| [`packages/ui`](packages/ui) | Le lecteur (`mountCourse`), les scènes fournies, le thème. |
| [`packages/tooling`](packages/tooling) | La commande `coursekit` : `check`, `tune`, `stats`, `new`. |
| [`courses/fusee`](courses/fusee) | Un cours complet : comment fonctionne une fusée (lycée, 3 à 4 h). |
| [`courses/epidemie`](courses/epidemie) | Un cours complet écrit avec `/generate_course` : comment une épidémie se propage (lycée, 3 à 4 h). |
| [`courses/demo-mini`](courses/demo-mini) | Un cours jouet qui utilise chaque élément du format une fois. |
| [`skill/generate_course`](skill/generate_course) | La skill Claude `/generate_course <sujet>`, qui écrit un cours complet avec coursekit. |
| [`docs`](docs) | La documentation. |

## Documentation

- [Écrire un cours](docs/ecrire-un-cours.md) : la démarche, le format, les règles de rédaction.
- [Référence](docs/reference.md) : l’API de chaque paquet.
- [Outils](docs/outils.md) : `coursekit check`, `tune`, `stats`, `new`, et les aides au test dans le navigateur.
- [Architecture](docs/architecture.md) : comment les paquets s’assemblent.
- [Diffusion](docs/diffusion.md) : installer coursekit, publier un cours, conditions de diffusion.
- [Contribuer](CONTRIBUTING.md) · [Historique des versions](CHANGELOG.md)

## Statut

Version 0.1.0, diffusion restreinte. Les paquets sont marqués `private` : ils ne sont pas publiés
sur npm et ne peuvent pas l’être par erreur. Voir [LICENSE](LICENSE) et
[docs/diffusion.md](docs/diffusion.md).
