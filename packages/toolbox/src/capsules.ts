// The library of toolbox capsules: short lessons on the mathematical tools
// that courses rely on, each with an interactive diagram (see ./tools.ts)
// and two check questions. A course picks the ones it needs and adds its own.
// Taken from avbd's course/toolbox.ts.

import { placed, type Capsule, type QuizSpec } from '@coursekit/core';

const choice = (question: string, choices: string[], answer: number, explain: string): QuizSpec => ({ question, kind: 'choice', choices, answer, explain });
const num = (question: string, value: number, explain: string, unit = '', tol?: number): QuizSpec => ({ question, kind: 'number', choices: [], answer: 0, value, unit, tol, explain });

export const MATH_CAPSULES: Capsule[] = [
  {
    id: 'T1', title: 'Les vecteurs',
    goal: 'Additionner deux vecteurs, multiplier un vecteur par un nombre, calculer une longueur.',
    used: 'Positions, vitesses et forces sont des vecteurs.',
    steps: [
      { title: 'Un vecteur, deux nombres', diagram: 'vectors', text: 'En deux dimensions, un vecteur est un couple de nombres u = (ux ; uy). Il représente un déplacement : ux selon l’axe horizontal, uy selon l’axe vertical. Une position, une vitesse ou une force s’écrivent toutes ainsi.' },
      { title: 'Addition et multiplication par un nombre', diagram: 'vectors', text: 'Pour additionner deux vecteurs, on additionne leurs composantes : u + v = (ux + vx ; uy + vy). Sur le schéma, on enchaîne les deux déplacements. Pour multiplier un vecteur par un nombre k, on multiplie chaque composante : k·u = (k·ux ; k·uy).', code: 'x ← x + h·v     // la position avance de h fois la vitesse' },
      { title: 'Longueur et vecteur unitaire', text: 'La longueur (ou norme) d’un vecteur se calcule avec le théorème de Pythagore : |u| = √(ux² + uy²). Un vecteur de longueur 1 est dit unitaire. On obtient un vecteur unitaire en divisant un vecteur par sa longueur. Une direction se représente souvent par un vecteur unitaire.', code: 'const L = Math.hypot(ux, uy);   // √(ux² + uy²)\nconst nx = ux / L, ny = uy / L; // vecteur unitaire' },
    ],
    check: [
      num('Quelle est la longueur du vecteur (6 ; 8) ?', 10, '√(6² + 8²) = √(36 + 64) = √100 = 10.'),
      choice('Une vitesse v = (2 ; −1) m/s agit pendant h = 0,5 s. De combien la position change-t-elle ?', ['(1 ; −0,5)', '(4 ; −2)', '(2,5 ; −0,5)', '(1 ; 0,5)'], 0, 'Le déplacement vaut h·v = 0,5 × (2 ; −1) = (1 ; −0,5).'),
    ],
  },
  {
    id: 'T2', title: 'Le produit scalaire',
    goal: 'Calculer un produit scalaire et l’interpréter comme une longueur mesurée dans une direction.',
    used: 'Mesurer une longueur dans une direction donnée (projection).',
    steps: [
      { title: 'La formule', text: 'Le produit scalaire de deux vecteurs est un nombre : u · v = ux·vx + uy·vy. Par exemple, (2 ; 1) · (3 ; −4) = 2×3 + 1×(−4) = 2.', code: 'const d = ux * vx + uy * vy;' },
      { title: 'Mesurer dans une direction', diagram: 'dotproj', text: 'Si n est un vecteur unitaire, p · n est la longueur de p mesurée dans la direction de n : c’est la longueur de la projection de p sur la droite qui porte n. Le résultat est négatif si p pointe du côté opposé à n. Déplacez la souris pour le vérifier.' },
      { title: 'Un usage courant', text: 'Pour savoir de combien un point s’est déplacé dans une direction donnée, par exemple vers le haut d’une pente, on calcule le produit scalaire de son déplacement avec le vecteur unitaire de cette direction. Le même calcul sert à décomposer une force en une partie le long d’une surface et une partie perpendiculaire.', code: 'd = (p2 − p1) · n   // déplacement le long de n' },
    ],
    check: [
      num('Calculez (3 ; −2) · (4 ; 5).', 2, '3×4 + (−2)×5 = 12 − 10 = 2.'),
      choice('n est unitaire et p · n = −0,3. Que peut-on dire ?', ['p a une composante de longueur 0,3 dans la direction opposée à n', 'p a une longueur de 0,3', 'p est perpendiculaire à n', 'n n’est pas unitaire'], 0, 'Le produit scalaire avec un vecteur unitaire mesure la composante dans cette direction ; le signe négatif indique le sens opposé.'),
    ],
  },
  {
    id: 'T3', title: 'Le produit en croix en 2D',
    goal: 'Calculer le moment d’une force en 2D et interpréter son signe.',
    used: 'Le moment d’une force, l’effet de rotation d’une poussée.',
    steps: [
      { title: 'La formule', text: 'En 2D, on associe à deux vecteurs r et F le nombre r × F = rx·Fy − ry·Fx. On l’appelle produit en croix (ou produit vectoriel en 2D). Il est nul quand r et F sont parallèles.', code: 'const tau = rx * Fy - ry * Fx;' },
      { title: 'Le moment d’une force', diagram: 'cross2d', text: 'Si r va du centre de masse au point où s’applique la force F, alors τ = r × F est le moment de la force : il mesure son effet de rotation. τ > 0 fait tourner dans le sens trigonométrique, τ < 0 dans le sens horaire. Déplacez la souris : quand la force passe par le centre de masse, τ = 0.' },
      { title: 'Le bras de levier', text: 'Pour une poussée de direction n appliquée au point r de l’objet, le nombre r × n indique de combien cette poussée fait tourner l’objet. On l’appelle le bras de levier : il est le plus grand quand la poussée est perpendiculaire à r.', code: 'const levier = rx * ny - ry * nx;' },
    ],
    check: [
      num('r = (1 ; 2) et F = (3 ; 0). Calculez r × F = rx·Fy − ry·Fx.', -6, '1×0 − 2×3 = −6 : la force fait tourner l’objet dans le sens horaire.'),
      choice('Une force est dirigée exactement vers le centre de masse. Que vaut son moment ?', ['0', 'il est maximal', 'il vaut la norme de la force', 'il est négatif'], 0, 'r et F sont alors parallèles : rx·Fy − ry·Fx = 0. La force ne fait pas tourner l’objet.'),
    ],
  },
  {
    id: 'T4', title: 'Dérivée et taux de variation',
    goal: 'Relier vitesse moyenne, dérivée et approximation sur un petit intervalle.',
    used: 'Le calcul pas à pas d’un mouvement, les pentes et les vitesses.',
    steps: [
      { title: 'Le taux de variation', text: 'Si une position passe de x₁ à x₂ pendant une durée Δt, la vitesse moyenne vaut (x₂ − x₁)/Δt. C’est le taux de variation de la position. Un programme peut ainsi calculer une vitesse à partir de deux positions successives.', code: 'v = (x_fin - x_debut) / h' },
      { title: 'La dérivée', diagram: 'slope', text: 'Quand Δt devient très petit, le taux de variation tend vers la dérivée x′(t) : c’est la pente de la tangente à la courbe. Sur le schéma, la droite rose est la tangente, et la droite orange relie deux points séparés d’une durée h.' },
      { title: 'L’approximation utilisée par Euler', text: 'Sur un petit intervalle h, on peut approcher x(t + h) par x(t) + h·x′(t). Comme x′ est la vitesse, cela donne x ← x + h·v. De même, la vitesse avance de h fois l’accélération. C’est exactement la méthode d’Euler.', code: 'x(t + h) ≈ x(t) + h·x′(t)' },
    ],
    check: [
      num('Une voiture passe de x = 10 m à x = 25 m en 3 s. Quelle est sa vitesse moyenne, en m/s ?', 5, '(25 − 10) / 3 = 5 m/s.', 'm/s'),
      choice('x(t) = 3 m et x′(t) = 2 m/s. Quelle approximation de x(t + 0,1) donne la méthode d’Euler ?', ['3,2 m', '3,02 m', '5 m', '2,3 m'], 0, 'x(t) + h·x′(t) = 3 + 0,1 × 2 = 3,2 m.'),
    ],
  },
  {
    id: 'T5', title: 'Énergie',
    goal: 'Calculer une énergie cinétique, de pesanteur ou de ressort, et relier énergie et équilibre.',
    used: 'Les échanges d’énergie et les équilibres.',
    steps: [
      { title: 'Trois énergies', text: 'Énergie cinétique : Ec = ½·m·v². Énergie potentielle de pesanteur : Ep = m·g·z, où z est la hauteur. Énergie d’un ressort de raideur k, allongé ou comprimé de d : ½·k·d².', code: 'Ec = 0.5 * m * v * v\nEp = m * g * z\nEressort = 0.5 * k * d * d' },
      { title: 'Échanges d’énergie', diagram: 'energy', text: 'Sans frottement, l’énergie totale se conserve : une bille qui descend dans un bol transforme son énergie potentielle en énergie cinétique, puis l’inverse en remontant. Sur le schéma, la barre verte (le total) reste constante.' },
      { title: 'Énergie et équilibre', text: 'Un système au repos se trouve là où son énergie potentielle est minimale : la bille finit au fond du bol si le frottement lui fait perdre son énergie cinétique. Chercher un minimum d’énergie est une méthode de calcul très utilisée en physique.' },
    ],
    check: [
      num('Un ressort de raideur k = 200 N/m est comprimé de 0,1 m. Quelle est son énergie, en joules ?', 1, '½ × 200 × 0,1² = ½ × 200 × 0,01 = 1 J.', 'J'),
      num('Une caisse de 2 kg se déplace à 3 m/s. Quelle est son énergie cinétique, en joules ?', 9, '½ × 2 × 3² = 9 J.', 'J'),
    ],
  },
  {
    id: 'T6', title: 'Minimum d’une fonction',
    goal: 'Trouver le minimum d’une parabole et comprendre la méthode de Newton.',
    used: 'Chercher le minimum d’une fonction, la méthode de Newton.',
    steps: [
      { title: 'La dérivée s’annule au minimum', text: 'Au minimum d’une fonction dérivable, la tangente est horizontale : la dérivée vaut zéro. Pour f(x) = (x − 3)² + 1, on a f′(x) = 2(x − 3), qui s’annule pour x = 3 : le minimum vaut f(3) = 1.' },
      { title: 'Le minimum d’une parabole', text: 'Pour f(x) = ½·a·x² + b·x avec a > 0, la dérivée vaut a·x + b. Elle s’annule pour x = −b/a. Retenez cette forme : « moins la pente divisée par la courbure ». Elle se généralise à plusieurs variables avec des vecteurs et des matrices.', code: 'x_min = -b / a    // pente en 0 : b ; courbure : a' },
      { title: 'La méthode de Newton', diagram: 'newton1d', text: 'Si la fonction n’est pas une parabole, on la remplace autour du point actuel par la parabole de même pente f′(x) et de même courbure f″(x), puis on va au minimum de cette parabole : x ← x − f′(x)/f″(x). On recommence jusqu’à ce que x ne bouge presque plus.', code: 'x = x - df(x) / d2f(x);' },
    ],
    check: [
      num('Pour quelle valeur de x la fonction f(x) = (x − 3)² + 1 est-elle minimale ?', 3, 'f′(x) = 2(x − 3) s’annule pour x = 3.'),
      num('Au point actuel, f′(x) = 6 et f″(x) = 2. Quel déplacement propose la méthode de Newton ?', -3, 'Δ = −f′/f″ = −6/2 = −3.'),
    ],
  },
  {
    id: 'T7', title: 'Systèmes d’équations',
    goal: 'Résoudre un petit système d’équations et lire l’écriture H·Δ = r.',
    used: 'Résoudre plusieurs équations à la fois.',
    steps: [
      { title: 'Deux équations, deux inconnues', diagram: 'system2', text: 'Le système 2x + y = 5 et x − y = 1 se résout par substitution : la seconde équation donne x = 1 + y ; en remplaçant dans la première, 2(1 + y) + y = 5, donc y = 1 et x = 2. Graphiquement, c’est le point où les deux droites se croisent.' },
      { title: 'L’écriture avec une matrice', text: 'On range les coefficients dans un tableau H (une matrice) et les inconnues dans Δ. Le système s’écrit H·Δ = r. Ce n’est qu’une notation compacte : chaque ligne de la matrice correspond à une équation.', code: '| 2   1 |   | x |   | 5 |\n| 1  −1 | · | y | = | 1 |' },
      { title: 'Trois inconnues ou plus', text: 'Avec trois équations à trois inconnues, la méthode est la même que la substitution : on élimine une inconnue après l’autre. Les programmes utilisent une fonction qui fait ce calcul, quel que soit le nombre d’inconnues.', code: 'const [x, y, z] = resoudre(H, r);' },
    ],
    check: [
      num('Résolvez x + y = 7 et x − y = 3. Que vaut x ?', 5, 'En additionnant les deux équations : 2x = 10, donc x = 5 (et y = 2).'),
      choice('Dans l’écriture H·Δ = r d’un système de trois équations, que contient Δ ?', ['les trois inconnues', 'les trois seconds membres', 'les neuf coefficients', 'la solution déjà calculée de r'], 0, 'Δ est le vecteur des inconnues ; H contient les coefficients et r les seconds membres.'),
    ],
  },
  {
    id: 'T8', title: 'Les nombres à virgule flottante',
    goal: 'Comprendre la précision limitée des calculs en flottants 32 bits.',
    used: 'La précision limitée des calculs faits par un ordinateur.',
    steps: [
      { title: 'La notation scientifique', diagram: 'float', text: 'Un ordinateur stocke un nombre réel comme en notation scientifique : quelques chiffres significatifs et un exposant. Un flottant 32 bits garde environ sept chiffres significatifs, un flottant 64 bits environ seize.' },
      { title: 'Une précision relative', text: 'Près de 1, on distingue des écarts d’environ un dix-millionième. Près de 1 000, d’environ un dix-millième seulement. L’erreur est proportionnelle à la taille du nombre. Ajouter un très petit nombre à un très grand peut donc ne rien changer.', code: '100 000 000 + 1 → 100 000 000   (en flottants 32 bits)' },
      { title: 'L’ordre des opérations', text: 'Comme chaque opération arrondit son résultat, (a + b) + c et a + (b + c) peuvent donner des résultats légèrement différents. Un programme qui additionne les mêmes nombres dans un autre ordre n’obtient donc pas toujours exactement la même somme.' },
    ],
    check: [
      choice('En flottants 32 bits, que vaut (100 000 000 + 1) − 100 000 000 ?', ['0', '1', '100 000 001', 'une erreur'], 0, 'Près de cent millions, deux flottants voisins sont séparés de 8 : ajouter 1 ne change rien, et la soustraction donne 0.'),
      choice('Avec environ sept chiffres significatifs, quel est l’ordre de grandeur de la plus petite différence visible près de 1 000 ?', ['un dix-millième', 'un dix-millionième', 'un millième de milliardième', 'une unité'], 0, '1 000 × 10⁻⁷ = 10⁻⁴ : un dix-millième.'),
    ],
  },
];

/**
 * Picks capsules from the library, in the order given. Each one is an id, or
 * [id, used] to say where this course uses the tool.
 */
export const pickCapsules = (...picks: (string | [string, string])[]): Capsule[] => picks.map((p) => {
  const [id, used] = typeof p === 'string' ? [p, undefined] : p;
  const c = MATH_CAPSULES.find((x) => x.id === id);
  if (!c) throw new Error(`fiche inconnue : ${id}`);
  // the right answers are written first in the library: place them
  return { ...c, used: used ?? c.used, check: c.check.map(placed) };
});
