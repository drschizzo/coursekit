# Diffusion

coursekit est diffusé **de manière restreinte** : aux personnes à qui l’accès est donné, sans
publication sur un registre npm public. Les paquets sont marqués `"private": true` : `npm
publish` les refuse, ce qui évite une publication par erreur. Les conditions d’utilisation sont
dans [LICENSE](../LICENSE).

## Obtenir coursekit

Deux façons, au choix de la personne qui diffuse :

- **Un accès au dépôt Git privé.** `git clone <adresse du dépôt>`, puis `npm install`.
- **Une archive.** `npm run archive` produit `coursekit-<version>.tar.gz` à partir du dernier
  commit (les fichiers non commités n’y sont pas). L’archive se transmet par un canal privé.

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

Le cours publié contient le code de la bibliothèque. Diffuser un cours à des élèves est
l’usage prévu de coursekit ; diffuser la bibliothèque elle-même suit les conditions de
[LICENSE](../LICENSE).

## La skill Claude `/generate_course`

[`skill/generate_course/SKILL.md`](../skill/generate_course/SKILL.md) décrit à Claude comment
écrire un cours complet avec coursekit. Pour l’installer dans Claude Code, copier le dossier
dans les skills de l’utilisateur ou du projet :

```bash
mkdir -p ~/.claude/skills
cp -R skill/generate_course ~/.claude/skills/
```

Puis, dans une session ouverte sur le dépôt coursekit : `/generate_course comment fonctionne
une fusée`. Voir [skill/README.md](../skill/README.md).

## Versions

La version (0.1.0) est commune à tous les paquets. Les changements sont notés dans
[CHANGELOG.md](../CHANGELOG.md). Avant la version 1.0, une version mineure peut modifier
l’API ; le changelog dit alors comment adapter un cours.
