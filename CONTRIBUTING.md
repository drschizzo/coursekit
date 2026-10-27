# Contribuer

## Mettre en place

```bash
nvm use            # Node 22.18 ou plus récent (.nvmrc)
npm install
npm test           # typage, lint, tests unitaires, check et tune de tous les cours
```

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/core` | Format, constructeur, frise, lecture, progression, textes de l’interface. **Sans DOM.** |
| `packages/diagrams` | Primitives de dessin des schémas, palette, cache. |
| `packages/toolbox` | Les fiches mathématiques de la boîte à outils et leurs schémas (du contenu). |
| `packages/exercises` | Types d’exercices et vérifications. **Sans DOM.** |
| `packages/ui` | Le lecteur ; seul paquet qui dépend du navigateur. |
| `packages/tooling` | `coursekit check`, `tune`, `stats`, `parcours`, `new` ; `test/` contient le cours défectueux qui fait réagir chaque règle. |
| `packages/*/test` | Les tests unitaires (Vitest). Ils n’importent aucun cours d’exemple. |
| `courses/*` | Les cours d’exemple : ils montrent comment se servir de la bibliothèque. `npm test` les vérifie aussi (`check`, `tune`). |
| `scripts/build-site.ts` | Construit tous les cours d’exemple en un site (`_site/`), publié sur GitHub Pages par la CI. |
| `.github/workflows/ci.yml` | La CI : `npm test` à chaque push et pull request ; sur `main`, publication des cours. |
| `docs/` | La documentation. |
| `.claude/skills/generate_course` | La skill `/generate_course`. |

## Conventions de code

- TypeScript exécuté sans compilation : uniquement des syntaxes effaçables (`erasableSyntaxOnly`) :
  pas d’`enum`, de `namespace`, ni de propriétés de paramètres de constructeur ; les imports
  locaux gardent l’extension `.ts` ; les imports de types utilisent `import type`.
- Pas de dépendance d’exécution : les paquets n’utilisent que la plateforme (DOM, Canvas 2D).
- `npm run lint` (ESLint) doit passer ; un `any` se justifie dans les tests et les cours, pas
  dans les paquets.
- Pas de texte d’interface en dur : chaque texte vu par l’élève est une clé de
  `packages/core/src/labels.ts`, dans `FR` **et** `EN` (un test vérifie qu’elles ont les mêmes
  clés). Pas de couleur en dur : la palette `CC`.
- Commentaires en anglais, en tête de fichier (ce que fait le fichier et d’où il vient) et sur les
  points qui ne se lisent pas dans le code. Textes destinés aux élèves en français.
- Deux espaces, fins de ligne LF (`.editorconfig`).

## Modifier la bibliothèque

- Toute nouvelle règle du vérificateur s’accompagne d’un défaut dans
  `packages/tooling/test/faulty.ts` et de son nom dans `test/tooling.test.ts`.
- Un changement de `core` ou d’`exercises` s’accompagne de tests dans `packages/*/test`.
- Une nouvelle sorte de pause : voir [docs/architecture.md](docs/architecture.md#les-sortes-de-pauses).
- Un changement de la forme de la progression enregistrée augmente `PROGRESS_SCHEMA` et ajoute
  une migration dans `MIGRATIONS` (`packages/core/src/progress.ts`).
- Un changement qui touche le format d’un cours met à jour `docs/ecrire-un-cours.md`,
  `docs/reference.md`, la skill (`.claude/skills/generate_course/SKILL.md`) et le `CHANGELOG.md`.
- Les cours d’exemple sont mis à jour pour illustrer chaque changement de la bibliothèque, et
  doivent rester à « ✓ prêt (0 remarque) » ; vérifier aussi dans le navigateur
  (`npm run dev:fusee`, puis `/?shots` et une visite avec `window.course.goto`).

## Commits

Un commit par changement cohérent, avec un message qui dit ce qui change et pourquoi.
