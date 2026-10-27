# Diffusion

coursekit est distribué sous licence MIT (voir [LICENSE](../LICENSE)), depuis son dépôt
GitHub. Les paquets ne sont pas publiés sur npm : ils sont marqués `"private": true`, ce qui
évite une publication par erreur, et s’utilisent depuis le dépôt.

## Obtenir coursekit

- **Depuis GitHub.** `git clone https://github.com/drschizzo/coursekit.git`, puis `npm install`.
- **Une archive.** `npm run archive` produit `coursekit-<version>.tar.gz` à partir du dernier
  commit (les fichiers non commités n’y sont pas), pour une copie sans l’historique Git.

Prérequis : Node 22.18 ou plus récent (voir `.nvmrc`) et npm 10 ou plus récent. Aucune
compilation : Node et Vite exécutent directement les sources TypeScript.

```bash
npm install
npm test           # tout doit passer avant d’écrire un cours
```

## Écrire ses cours

### Dans le dépôt coursekit

Le plus simple : les cours vivent dans `courses/`, à côté du cours fusée.

```bash
npm run new -- courses/mon-cours "Mon cours"
npm install
npm run dev -w courses/mon-cours
```

### Dans un autre projet

Les paquets se résolvent par les *workspaces* npm. Placer coursekit dans le projet (sous-module
Git, copie de l’archive ou lien symbolique), puis déclarer ses paquets comme espaces de travail :

```json
{
  "name": "mes-cours",
  "private": true,
  "type": "module",
  "workspaces": ["coursekit/packages/*", "cours/*"],
  "devDependencies": { "vite": "^6.4.1", "typescript": "^5.9.3" }
}
```

```bash
node coursekit/packages/tooling/src/cli.ts new cours/mon-cours "Mon cours"
npm install
npm run dev -w cours/mon-cours
```

Pour le contrôle de types, reprendre le `tsconfig.json` de coursekit en adaptant `include`.
Pour disposer de `/generate_course` dans ce projet, copier `coursekit/.claude/skills/generate_course`
dans son dossier `.claude/skills/`.

Les dépendances entre paquets (`"@coursekit/core": "*"`) ne se résolvent qu’ainsi : une
installation paquet par paquet depuis des archives `npm pack` ne fonctionne pas.

## Publier un cours

Un cours se construit en site statique :

```bash
npm run check -w courses/mon-cours     # « ✓ prêt (0 remarque) »
npm run build -w courses/mon-cours     # → courses/mon-cours/dist/
npm run preview -w courses/mon-cours   # pour le vérifier
```

`dist/` contient une page HTML, un fichier JavaScript et une feuille de style, avec des chemins
relatifs : il se dépose sur n’importe quel hébergement statique, dans n’importe quel dossier.
Aucun serveur n’est nécessaire. La progression de chaque élève reste dans son navigateur
(`localStorage`) ; il peut l’exporter en JSON depuis la page d’accueil.

### Tous les cours d’exemple, sur GitHub Pages

La CI du dépôt (`.github/workflows/ci.yml`) lance `npm test` à chaque push et pull request. Sur
`main`, une fois les tests passés, elle construit tous les cours de `courses/` avec
`npm run build:site` et les publie sur GitHub Pages, chacun à sa propre adresse :

```
https://<compte>.github.io/<dépôt>/            la liste des cours
https://<compte>.github.io/<dépôt>/fusee/      un cours
```

Il faut l’activer une fois : dans le dépôt GitHub, *Settings → Pages → Build and deployment →
Source : GitHub Actions*. Dans un fork, la même CI publie les cours du fork.

Le cours publié contient le code de la bibliothèque. La licence MIT demande seulement de
garder la mention de copyright et le texte de la licence dans les copies du code de coursekit.

## Versions

La version (0.1.0) est commune à tous les paquets. Les changements sont notés dans
[CHANGELOG.md](../CHANGELOG.md). Avant la version 1.0, une version mineure peut modifier
l’API ; le changelog dit alors comment adapter un cours.
