# Outils

## La commande `coursekit`

Installée par `npm install` dans `node_modules/.bin` ; les scripts des cours l’appellent
directement. Depuis la racine : `npx coursekit …`.

| Commande | Effet |
|---|---|
| `coursekit check <course.ts>` | Les quatre niveaux de vérification (ci-dessous). Code de sortie 1 s’il reste une erreur. |
| `coursekit stats <course.ts>` | Modules, chapitres, étapes, questions, expériences, exercices… |
| `coursekit tune <tune.ts>` | Balaye les paramètres du modèle et vérifie les fenêtres attendues. Code de sortie 1 si l’une échoue. |
| `coursekit new <dossier> [titre]` | Un nouveau projet de cours, prêt à lancer et qui passe déjà `check`. |

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

3. **Modèle et affirmations.** `model` : une `check` du modèle échoue. `claim` : un chiffre
   affirmé dans une étape n’est pas confirmé par le modèle.
4. **Exercices et parcours complet.**

   | Règle | Niveau | Ce qui est signalé |
   |---|---|---|
   | `exercise` | erreur | Une solution refusée, un point de départ accepté, un code PRIMM déjà accepté, des valeurs attendues refusées. |
   | `walk` | erreur | Un affichage calculé, un schéma ou un objectif d’expérience qui lève une erreur ; un texte « NaN », « undefined », « Infinity ». |
   | `layout` | remarque | Un texte de schéma qui sort du cadre, ou deux textes superposés. |

   Le parcours dessine chaque schéma avec les valeurs du fil du cours **et** avec chaque contrôle
   des expériences qui l’accompagnent à ses bornes (min et max, activé et désactivé, chaque
   option), puis tous les contrôles à leur minimum et à leur maximum. Les objectifs des
   expériences sont évalués aux mêmes valeurs. La taille des textes est estimée (0,55 × la taille
   de police par caractère) : la règle `layout` vise les vrais débordements, pas le pixel près.

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
large et un écran étroit ; la console ne doit montrer aucune erreur.

Raccourcis du lecteur : Espace (continuer), ← → (étape précédente, suivante), 1 à 4 (répondre),
M (sommaire), L (atelier), G (glossaire), Échap (fermer).
