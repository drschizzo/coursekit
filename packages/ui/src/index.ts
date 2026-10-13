// @coursekit/ui — the player: mountCourse, the stages it ships with, and the
// pieces it is made of (for courses that need to compose their own).
// Import the theme once: `import '@coursekit/ui/theme.css'`.

export { mountCourse, type MountOptions, type CourseHandle } from './player.ts';
export { noStage, imageStage, canvasStage, type CanvasScene } from './stages.ts';
export { renderQuiz, type QuizOptions, type QuizResult } from './quiz.ts';
export { highlight } from './highlight.ts';
export { h, esc } from './dom.ts';
