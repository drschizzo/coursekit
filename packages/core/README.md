# @coursekit/core

Le format d’un cours et tout ce qui se calcule sans navigateur : le constructeur (`content(c)`),
la compilation en frise immuable (`compile`), sa lecture (`Reading` : l’horloge, la pause en
cours, ce que l’élève y a fait), la progression enregistrée et versionnée (`Progress`), les
textes de l’interface par langue (`labelsFor`, `tr`), le glossaire, les questions (`choice`,
`numeric`), les nombres (`fr`, `fmtNumber`, `dec`, `pct`), la mémoïsation (`memo`), la place
des panneaux (`LAYOUT`) et les variantes de schémas (`diagramVariants`).

```ts
import { defineCourse, fr, memo } from '@coursekit/core';
```

Voir [docs/reference.md](../../docs/reference.md#coursekitcore) et
[docs/ecrire-un-cours.md](../../docs/ecrire-un-cours.md).
