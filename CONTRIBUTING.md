# Contribuer

## Mettre en place

```bash
nvm use            # Node 22.18 ou plus récent (.nvmrc)
npm install
npm test           # typage, règles du vérificateur, check et tune de tous les cours
```

## Organisation

| Dossier | Contenu |
|---|---|
| `packages/core` | Format, constructeur, frise, progression. **Sans DOM.** |
| `packages/diagrams` | Dessin des schémas, fiches de la boîte à outils. |
| `packages/exercises` | Types d’exercices et vérifications. **Sans DOM.** |
| `packages/ui` | Le lecteur ; seul paquet qui dépend du navigateur. |
| `packages/tooling` | `coursekit check`, `tune`, `stats`, `new` ; `test/` contient le cours défectueux qui fait réagir chaque règle. |
| `courses/*` | Les cours. Ils servent aussi de tests d’intégration. |
| `docs/` | La documentation. |
| `.claude/skills/generate_course` | La skill `/generate_course`. |

## Conventions de code

- TypeScript exécuté sans compilation : uniquement des syntaxes effaçables (`erasableSyntaxOnly`) :
  pas d’`enum`, de `namespace`, ni de propriétés de paramètres de constructeur ; les imports
  locaux gardent l’extension `.ts` ; les imports de types utilisent `import type`.
- Pas de dépendance d’exécution : les paquets n’utilisent que la plateforme (DOM, Canvas 2D).
- Commentaires en anglais, en tête de fichier (ce que fait le fichier et d’où il vient) et sur les
  points qui ne se lisent pas dans le code. Textes destinés aux élèves en français.
- Deux espaces, fins de ligne LF (`.editorconfig`).

## Modifier la bibliothèque

- Toute nouvelle règle du vérificateur s’accompagne d’un défaut dans
  `packages/tooling/test/faulty.ts` et de son nom dans `test/run.ts`.
- Un changement qui touche le format d’un cours met à jour `docs/ecrire-un-cours.md`,
  `docs/reference.md`, la skill (`.claude/skills/generate_course/SKILL.md`) et le `CHANGELOG.md`.
- Les deux cours doivent rester à « ✓ prêt (0 remarque) » ; vérifier aussi dans le navigateur
  (`npm run dev:fusee`, puis `/?shots` et une visite avec `window.course.goto`).

## Commits

Un commit par changement cohérent, avec un message qui dit ce qui change et pourquoi.
