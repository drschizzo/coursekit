# @coursekit/tooling

La commande `coursekit` :

```bash
coursekit new courses/mon-cours "Mon cours"   # un projet prêt à lancer
coursekit tune src/tune.ts                    # régler le modèle
coursekit check src/course.ts                 # vérifier le contenu
coursekit stats src/course.ts
```

et ses fonctions (`checkCourse`, `defineTune`, `runTune`, `mockContext`).
`test/faulty.ts` est un cours rempli de défauts : `node test/run.ts` vérifie que chaque règle
les trouve.

Voir [docs/outils.md](../../docs/outils.md).
