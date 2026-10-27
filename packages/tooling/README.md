# @coursekit/tooling

La commande `coursekit` :

```bash
coursekit new courses/mon-cours "Mon cours"   # un projet prêt à lancer
coursekit tune src/tune.ts                    # régler le modèle
coursekit check src/course.ts                 # vérifier le contenu
coursekit stats src/course.ts
coursekit parcours src/course.ts parcours.md  # le cours tel que l’élève le lit
```

et ses fonctions (`checkCourse`, `CHECKS`, `defineTune`, `runTune`, `mockContext`, `parcours`).
`checkCourse(course, { extra, skip })` accepte des vérifications propres au projet et fait taire
des règles. `test/faulty.ts` est un cours rempli de défauts, avec sa scène :
`test/tooling.test.ts` (lancé par `npm run test:unit`) vérifie que chaque règle les trouve, et
teste les textes paresseux, les graines de `defineTune`, `rng`, `wilson`, la lecture de la durée
annoncée et le port de `coursekit new`.

Voir [docs/outils.md](../../docs/outils.md).
