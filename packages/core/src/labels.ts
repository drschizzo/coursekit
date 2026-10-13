// Interface texts. French by default; a course overrides any of them through
// `labels`. The builder uses a few of them for the steps it writes itself
// (the review at the start of a module, the question asked first, the
// clinic), the player uses the rest.

export const FR = {
  // steps written by the builder
  reviewTitle: 'Révision',
  reviewText: 'Avant de commencer ce module, répondez à quelques questions sur les modules précédents. Les questions que vous aviez manquées, ou auxquelles vous aviez répondu au hasard, sont choisies en priorité.',
  askTitle: 'Une question pour commencer',
  askText: 'Avant de lire l’explication, réfléchissez à cette question. Il n’est pas nécessaire de connaître la réponse : la suite du chapitre l’explique.',
  clinicObserve: 'Observer',
  clinicObserveNote: 'Faites tourner la vue si la scène le permet. Avant de passer à l’étape suivante, formulez une hypothèse.',
  clinicQuestion: 'Quelle est la cause la plus probable ?',
  clinicFix: 'Corriger',
  clinicFixText: 'Modifiez un réglage à la fois, en commençant par celui de votre hypothèse. Observez le résultat en entier avant de juger.',
  clinicFixTitle: 'Corrigez',
  clinicFixPrompt: 'Un seul réglage est en cause. Les autres sont à leur valeur habituelle : si vous les modifiez, remettez-les ensuite.',
  clinicJustify: 'Justifier',
  clinicJustifyText: 'Expliquez maintenant, par écrit, ce qui se passait et pourquoi votre correction fonctionne. Comparez ensuite avec la réponse modèle.',
  clinicJustifyPrompt: 'Décrivez le symptôme, la cause et son rôle, puis le mécanisme : pourquoi la valeur fautive produisait ce symptôme, et pourquoi la correction le supprime.',
  clinicCase: 'Cas',
  examCase: 'Épreuve · cas',
  explainTitle: 'Expliquez avec vos mots',
  // player
  next: 'Suivant ▶',
  prev: '◀ Précédent',
  continue: 'Continuer ▶',
  skip: 'Passer',
  later: 'Plus tard',
  stepMode: 'Pas à pas',
  pauses: 'Questions et exercices',
  glossary: 'Glossaire',
  menu: '☰ Sommaire',
  workshop: '</> Atelier',
  quit: 'Quitter le cours',
  module: 'Module',
  exam: 'Épreuve finale',
  bonus: 'Bonus',
  step: 'étape',
  reminder: 'Rappel',
} as const;

export type LabelKey = keyof typeof FR;
export type LabelSet = Record<LabelKey, string>;

export function labelsFor(over?: Record<string, string>): LabelSet {
  return { ...FR, ...(over ?? {}) } as LabelSet;
}
