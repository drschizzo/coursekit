# coursekit

coursekit sert à créer des **cours interactifs** qui se suivent dans un navigateur : un texte
découpé en petites étapes, accompagné de schémas animés, de questions, d’expériences où l’élève
fait varier des réglages, et d’exercices. Chaque chiffre et chaque schéma du cours sont calculés
par une petite simulation du sujet, ce qui permet de vérifier automatiquement que le cours ne
dit rien de faux.

Le dépôt contient la bibliothèque, six cours d’exemple et une skill pour Claude Code,
`/generate_course`, qui écrit un cours complet à partir d’un sujet.

Deux des cours d’exemple sont en ligne et peuvent être suivis sans rien installer :

- [Comment fonctionne une fusée](https://cute-sherbet-6a072d.netlify.app/)
- [Comment une épidémie se propage](https://fluffy-cupcake-34e88b.netlify.app/), écrit avec
  `/generate_course`

Ce README a deux parties :

- [**Partie 1 : créer un cours avec Claude**](#partie-1--créer-un-cours-avec-claude), pour
  créer un cours, le tester et le mettre en ligne sans entrer dans le code ;
- [**Partie 2 : le projet en détail**](#partie-2--le-projet-en-détail), pour écrire un cours à
  la main ou faire évoluer la bibliothèque.

---

# Partie 1 : créer un cours avec Claude

Cette partie suppose seulement de savoir ouvrir un terminal et y taper une commande. Les
commandes sont à taper telles quelles, dans le dossier du projet.

## 1. Installer les outils

Trois logiciels sont nécessaires :

| Logiciel | Où le trouver | Pour vérifier qu’il est installé |
|---|---|---|
| Git | https://git-scm.com | `git --version` |
| Node.js, version 22.18 ou plus récente | https://nodejs.org (prendre la version « LTS ») | `node --version` |
| Claude Code | https://claude.com/claude-code | `claude --version` |

Claude Code demande un compte Claude avec un abonnement qui l’inclut, ou une clé d’API. Après
l’installation de Node.js, il faut fermer et rouvrir le terminal pour que la commande `npm` soit
reconnue.

## 2. Récupérer le projet

```bash
git clone https://github.com/drschizzo/coursekit.git
cd coursekit
npm install
```

`npm install` télécharge ce dont le projet a besoin. Il suffit de le faire une fois, puis à
nouveau après chaque mise à jour du projet ou création d’un cours.

## 3. Regarder un cours d’exemple

Avant d’en créer un, il est utile de voir à quoi ressemble un cours terminé. Le plus simple est
d’ouvrir une des versions en ligne : [la fusée](https://cute-sherbet-6a072d.netlify.app/) ou
[l’épidémie](https://fluffy-cupcake-34e88b.netlify.app/). On peut aussi lancer un cours sur sa
machine :

```bash
npm run dev:fusee
```

Puis ouvrir http://localhost:5182 dans un navigateur. Pour arrêter, revenir dans le terminal
et appuyer sur `Ctrl+C`.

| Commande | Cours | Adresse |
|---|---|---|
| `npm run dev:fusee` | « Comment fonctionne une fusée » : poussée, fusée à étages, vol jusqu’à l’orbite (lycée, 3 à 4 h). | http://localhost:5182 |
| `npm run dev:epidemie` | « Comment une épidémie se propage » : R0, modèle SIR, vaccination, aplatir la courbe (lycée, 3 à 4 h). Écrit avec `/generate_course`. | http://localhost:5183 |
| `npm run dev:demo` | Un petit cours sur la chute d’un objet, qui montre chaque élément possible d’un cours. | http://localhost:5181 |

Le cours s’ouvre sur sa page d’accueil ; « Commencer le cours » lance la visite pas à pas.

## 4. Créer un cours

Les cours se créent avec la skill `/generate_course`. Une skill est un fichier d’instructions
que Claude Code lit quand on l’appelle ; celle-ci décrit comment écrire un cours coursekit : la
démarche, les règles de rédaction et les vérifications à faire. Elle est fournie avec le projet
et Claude Code la trouve tout seul quand il est lancé dans le dossier du projet : il n’y a rien
à installer.

Dans le dossier du projet, lancer Claude Code :

```bash
claude
```

Puis taper la commande suivie du sujet :

```
/generate_course comment fonctionne un volcan
```

On peut préciser le public, la durée ou la langue dans la même phrase, par exemple
`/generate_course la photosynthèse, pour des élèves de collège, environ 2 heures`. Sans
précision, le cours vise des lycéens et dure 3 à 4 heures.

Claude crée alors le dossier `courses/<nom-du-cours>`, écrit la simulation du sujet, les
schémas, les textes, les questions et les exercices, puis vérifie le tout et corrige ce qui ne
va pas. Cela prend du temps : le cours sur les épidémies a demandé environ 20 minutes avec le
modèle Opus 5.5 en niveau de réflexion moyen. Pendant ce temps, Claude peut demander
l’autorisation de lancer certaines commandes. À la fin, il donne un compte rendu : le plan du cours, ce qui a été
vérifié, et la commande pour le lancer.

## 5. Tester et retoucher le cours

Pour suivre le cours soi-même (en remplaçant `<nom-du-cours>` par le nom du dossier créé) :

```bash
npm run dev -w courses/<nom-du-cours>
```

Le terminal affiche l’adresse à ouvrir dans le navigateur (par exemple http://localhost:5173).

Pour modifier le cours, il suffit de le demander à Claude dans la même session, en langage
courant : « dans le module 2, ajoute une question sur la pression du magma », « le chapitre sur
les séismes est trop long, coupe-le en deux », « le schéma des plaques est difficile à lire sur
un téléphone ». Claude relance les vérifications après chaque modification.

On peut aussi lancer la vérification soi-même :

```bash
npm run check -w courses/<nom-du-cours>
```

Elle se termine par « ✓ prêt (0 remarque) » quand le cours est prêt à être diffusé. Sinon, elle
liste ce qui pose problème ; on peut copier cette liste dans Claude Code pour qu’il corrige.

## 6. Mettre le cours en ligne

Un cours se transforme en un petit site, sans serveur ni base de données :

```bash
npm run build -w courses/<nom-du-cours>
```

Le site est dans le dossier `courses/<nom-du-cours>/dist`. Pour le regarder avant de le mettre
en ligne : `npm run preview -w courses/<nom-du-cours>`.

Le contenu de `dist` se dépose tel quel chez n’importe quel hébergeur de sites statiques, dans
n’importe quel dossier. Trois possibilités simples :

- **Netlify** (gratuit pour cet usage) : créer un compte sur https://www.netlify.com, choisir
  d’ajouter un site en le déployant manuellement, puis glisser le dossier `dist` dans la page.
  Netlify donne une adresse du type `https://nom-choisi.netlify.app` à transmettre aux élèves.
- **Un hébergement existant** (site d’un établissement, hébergement personnel) : copier le
  contenu de `dist` dans un dossier du site, par exemple avec un logiciel FTP. Le cours est
  alors à l’adresse de ce dossier.
- **GitHub Pages**, pour un dépôt (ou un fork) sur GitHub : la CI du projet construit et publie
  automatiquement tous les cours du dossier `courses/` à chaque mise à jour de `main`, chacun à
  l’adresse `https://<compte>.github.io/<dépôt>/<nom-du-cours>/`. Il suffit de l’activer une
  fois (voir [docs/diffusion.md](docs/diffusion.md#tous-les-cours-dexemple-sur-github-pages)).

Pour mettre en ligne une nouvelle version du cours, relancer `npm run build` et déposer à
nouveau le dossier `dist`.

La progression de chaque élève est enregistrée dans son propre navigateur : rien n’est envoyé à
un serveur, et un élève qui change d’appareil ou de navigateur repart du début. La page
d’accueil permet à l’élève d’exporter sa progression dans un fichier.

Les cours créés peuvent être diffusés librement. coursekit est sous licence MIT (voir
[LICENSE](LICENSE)) : la seule condition est de garder la mention de copyright et le texte de
la licence dans les copies du code de coursekit.

## En cas de problème

- **`npm` ou `node` n’est pas reconnu** : Node.js n’est pas installé, ou le terminal a été
  ouvert avant son installation. Le fermer et le rouvrir.
- **« Port … is already in use »** : le cours tourne déjà dans un autre terminal. Utiliser
  celui-ci, ou l’arrêter avec `Ctrl+C` avant de relancer.
- **Une erreur pendant `npm install` ou au lancement d’un cours** : la copier dans Claude Code
  et lui demander de l’expliquer ou de la corriger.

---

# Partie 2 : le projet en détail

Cette partie s’adresse à ceux qui veulent écrire un cours à la main ou modifier la
bibliothèque. Elle suppose de connaître TypeScript et npm.

## Le principe

Un cours coursekit repose sur un **modèle exécutable du sujet** : une petite bibliothèque
TypeScript sans DOM (un simulateur de vol pour la fusée, un modèle SIR pour l’épidémie). Les
schémas, la scène animée en arrière-plan, les expériences, les exercices et les chiffres du
texte l’appellent tous ; aucun chiffre n’est écrit à la main.

Le cours lui-même est un fichier TypeScript qui se lit dans l’ordre du cours :

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

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| [`packages/core`](packages/core) | Le format d’un cours, le constructeur, la frise et sa lecture, la progression enregistrée, les textes de l’interface (français, anglais), les nombres. Sans DOM. |
| [`packages/diagrams`](packages/diagrams) | Les primitives de dessin des schémas, la palette, le cache. |
| [`packages/toolbox`](packages/toolbox) | Les fiches mathématiques de la boîte à outils et leurs schémas. |
| [`packages/exercises`](packages/exercises) | Les types d’exercices de l’atelier et leur vérification. Sans DOM. |
| [`packages/ui`](packages/ui) | Le lecteur (`mountCourse`), les scènes fournies, le thème. |
| [`packages/tooling`](packages/tooling) | La commande `coursekit` : `check`, `tune`, `stats`, `parcours`, `new`. |
| [`courses/fusee`](courses/fusee) | Un cours complet : comment fonctionne une fusée. |
| [`courses/epidemie`](courses/epidemie) | Un cours complet écrit avec `/generate_course` : comment une épidémie se propage. |
| [`courses/demo-mini`](courses/demo-mini) | Un cours jouet qui utilise chaque élément du format une fois. |
| `courses/alphazero`, `courses/nca`, `courses/permutants` | D’autres cours d’exemple : AlphaZero, les automates cellulaires neuronaux, les permutations. |
| [`scripts/build-site.ts`](scripts/build-site.ts), [`.github/workflows`](.github/workflows) | La CI et la publication des cours d’exemple sur GitHub Pages. |
| [`.claude/skills/generate_course`](.claude/skills/generate_course) | La skill Claude Code `/generate_course`. |
| [`docs`](docs) | La documentation. |

Les paquets et les cours sont des *workspaces* npm. Il n’y a pas d’étape de compilation : Node
(22.18 ou plus récent) et Vite exécutent directement les sources TypeScript.

## Commandes

```bash
npm install
npm test                                  # typage, lint, tests unitaires, check et tune de tous les cours
npm run build:site                        # tous les cours d’exemple en un site, dans _site/
npm run dev:fusee                         # un cours d’exemple (aussi dev:epidemie, dev:demo)
npm run new -- courses/mon-cours "Mon cours"
npm run dev -w courses/mon-cours          # serveur de développement d’un cours
npm run check -w courses/mon-cours        # vérification complète
npm run tune -w courses/mon-cours         # réglage du modèle
npm run build -w courses/mon-cours        # site statique dans courses/mon-cours/dist/
npx coursekit stats courses/mon-cours/src/course.ts
```

En développement, la console du navigateur donne accès au lecteur : `window.course.list()`
liste les chapitres, `window.course.goto(chapitre, étape)` y saute, et l’adresse `/?shots`
affiche tous les schémas aux valeurs du cours et aux bornes des expériences.

## Écrire un cours à la main

```bash
npm run new -- courses/mon-cours "Mon cours"
npm install
npm run dev -w courses/mon-cours
```

`coursekit new` crée un cours minimal qui passe déjà la vérification. L’ordre de travail
conseillé :

1. écrire le modèle (`src/model.ts`) et ses contrôles ;
2. le régler avec `src/tune.ts` et `npm run tune`, jusqu’à ce que les situations que le cours
   veut montrer existent bien dans le modèle ;
3. dessiner les schémas et la scène ;
4. écrire le contenu (`src/course.ts`) ;
5. vérifier avec `npm run check` jusqu’à « ✓ prêt (0 remarque) », puis relire dans le
   navigateur.

Le guide [docs/ecrire-un-cours.md](docs/ecrire-un-cours.md) détaille chaque étape et les règles
de rédaction ; le cours `courses/fusee` sert d’exemple tout du long.

## La skill `/generate_course`

[`.claude/skills/generate_course/SKILL.md`](.claude/skills/generate_course/SKILL.md) suit la même démarche que le
guide : cadrer le sujet, analyser ses notions et les idées fausses courantes, écrire et régler
le modèle, planifier les modules, écrire le contenu, vérifier (`tune`, `check`, `/?shots`,
visite dans le navigateur) et livrer un compte rendu. Elle se termine par une liste de contrôle.

La skill décrit le format et les outils tels qu’ils sont : un changement du format d’un cours
ou des règles du vérificateur doit y être reporté. Le cours `courses/epidemie` est un exemple
de ce qu’elle produit.

Elle est dans le dossier `.claude/skills/` du dépôt, où Claude Code cherche les skills d’un
projet : elle est disponible dans toute session ouverte dans le dépôt. Pour s’en servir
ailleurs, copier le dossier `generate_course` dans `~/.claude/skills/` (pour toutes les
sessions de l’utilisateur) ou dans le `.claude/skills/` d’un autre projet.

## Faire évoluer la bibliothèque

Les conventions sont dans [CONTRIBUTING.md](CONTRIBUTING.md). Les points principaux :

- `core` et `exercises` ne dépendent pas du DOM ; seul `ui` dépend du navigateur ;
- aucune dépendance d’exécution : les paquets n’utilisent que la plateforme (DOM, Canvas 2D) ;
- une nouvelle règle du vérificateur s’accompagne d’un défaut dans
  `packages/tooling/test/faulty.ts` qui la déclenche ;
- un changement du format met à jour la documentation, la skill et le `CHANGELOG.md` ;
- les cours du dépôt sont des exemples : ils illustrent la bonne façon de se servir de la
  bibliothèque, sont mis à jour à chacun de ses changements, et doivent rester à « ✓ prêt
  (0 remarque) » ; les tests unitaires de la bibliothèque n’en dépendent pas ;
- la CI lance `npm test` à chaque push et pull request, et publie les cours d’exemple sur GitHub
  Pages depuis `main`.

## Documentation

- [Écrire un cours](docs/ecrire-un-cours.md) : la démarche, le format, les règles de rédaction.
- [Référence](docs/reference.md) : l’API de chaque paquet.
- [Outils](docs/outils.md) : `coursekit check`, `tune`, `stats`, `new`, et les aides au test dans le navigateur.
- [Architecture](docs/architecture.md) : comment les paquets s’assemblent.
- [Diffusion](docs/diffusion.md) : utiliser coursekit dans un autre projet, publier un cours, conditions de diffusion.
- [Contribuer](CONTRIBUTING.md) · [Historique des versions](CHANGELOG.md)

## Statut

Version 0.1.0, sous licence MIT (voir [LICENSE](LICENSE)). Les paquets ne sont pas publiés sur
npm : ils sont marqués `private` et s’utilisent depuis le dépôt (voir
[docs/diffusion.md](docs/diffusion.md)).
