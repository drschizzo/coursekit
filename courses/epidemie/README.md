# Comment une épidémie se propage

Un cours de niveau lycée (3 à 4 heures) : pourquoi une épidémie démarre, accélère, s’arrête
d’elle-même, et comment la vaccination et la réduction des contacts la freinent.

| Module | Contenu |
|---|---|
| 1. Une contagion qui se multiplie | R0 = contacts × probabilité × durée, générations, croissance exponentielle, temps de doublement. |
| 2. Le modèle SIR | Susceptibles, contagieux, rétablis ; R effectif et pic ; taille finale ; un pas du modèle à programmer. |
| 3. Freiner l’épidémie | Les trois leviers de R0, la vaccination, le seuil d’immunité collective. |
| 4. Aplatir la courbe | Les lits d’hôpital, la force et le moment des mesures ; deux cas cliniques. |
| Épreuve | Un cas à diagnostiquer seul, le test final. |

Le modèle ([src/model.ts](src/model.ts)) est un modèle SIR d’une ville de 100 000 habitants,
intégré par pas d’un dixième de jour : R0 = 2,4 (10 contacts par jour, probabilité 0,03,
8 jours contagieux), vaccination au départ, réduction des contacts à partir d’un jour donné,
200 lits d’hôpital pour 2 % des contagieux. Ses contrôles vérifient la taille finale
(z = 1 − e^(−R0·z)), le pic (1 − (1 + ln R0)/R0), le seuil 1 − 1/R0 et le temps de doublement.
Ses fenêtres (pas d’épidémie sous 5 contacts, seuil de vaccination, date limite des mesures,
symptômes propres à chaque cas clinique) sont vérifiées par [src/tune.ts](src/tune.ts).

```bash
npm run dev -w courses/epidemie        # depuis la racine du dépôt, http://localhost:5183
npm run tune -w courses/epidemie
npm run check -w courses/epidemie
npm run build -w courses/epidemie      # site statique dans dist/
```

Simplifications : population homogène (chacun rencontre n’importe qui au hasard), pas de
période d’incubation, immunité définitive, maladie imaginaire, mesures qui durent jusqu’à la fin
de l’année, besoins en lits proportionnels au nombre de contagieux.
