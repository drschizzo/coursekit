# @coursekit/diagrams

Pour dessiner les schémas d’un cours dans un espace de 380 × 236 : primitives (`line`, `arrow`,
`text`, `axes`…), palette `CC` (partagée avec le thème du lecteur par `CSS_PALETTE`), caméra
monde → schéma, cache des calculs coûteux. Les fiches mathématiques de la boîte à outils sont
dans [`@coursekit/toolbox`](../toolbox).

```ts
import { CC, axes, dot, text } from '@coursekit/diagrams';
```

Voir [docs/reference.md](../../docs/reference.md#coursekitdiagrams).
