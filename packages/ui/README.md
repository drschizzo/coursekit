# @coursekit/ui

Le lecteur d’un cours, dans le navigateur.

```ts
import '@coursekit/ui/theme.css';
import { mountCourse, canvasStage } from '@coursekit/ui';

const handle = mountCourse(document.getElementById('app')!, course, { stage: stage(), dev: import.meta.env.DEV });
```

`mountCourse` gère la page d’accueil, la visite pas à pas, les questions, expériences et
explications, l’atelier, les tests, le glossaire, les fiches et les révisions. Scènes fournies :
`noStage`, `imageStage`, `canvasStage`.

Voir [docs/reference.md](../../docs/reference.md#coursekitui) et
[docs/outils.md](../../docs/outils.md#dans-le-navigateur).
