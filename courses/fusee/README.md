# Comment fonctionne une fusée

Un cours de niveau lycée (3 à 4 heures) : de la poussée des moteurs jusqu’à l’orbite.

| Module | Contenu |
|---|---|
| 1. Pousser pour monter | Action et réaction, poussée, rapport poussée / poids, masse qui diminue ; un pas de vol vertical à programmer. |
| 2. L’équation de la fusée | Δv, équation de Tsiolkovsky, étages ; le Δv d’un lanceur à programmer. |
| 3. Tourner autour de la Terre | Le canon de Newton, la vitesse orbitale, apogée et périgée. |
| 4. Le vol jusqu’à l’orbite | Traînée, pression dynamique, basculement, bilan des pertes ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul, le test final. |

Le modèle ([src/model.ts](src/model.ts)) simule un lanceur à deux étages au-dessus d’une Terre
ronde : poussée, masse variable, atmosphère exponentielle, traînée, basculement, second étage
guidé, arrêt des moteurs à la vitesse orbitale. Ses fenêtres (orbite de 5 à 8° de basculement,
charge utile maximale, poussée minimale) sont vérifiées par [src/tune.ts](src/tune.ts).

```bash
npm run dev:fusee                    # depuis la racine du dépôt, http://localhost:5182
npm run tune -w courses/fusee
npm run check -w courses/fusee
npm run build -w courses/fusee       # site statique dans dist/
```

Simplifications : vol dans un plan, Terre sans rotation, pas de vent, moteurs à poussée
constante, coefficient de traînée constant.
