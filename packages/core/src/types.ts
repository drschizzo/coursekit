// The shape of a course: what an author (a person, or Claude through the
// /generate_course skill) writes, and what the player and the tools read.
//
// A course is data. The only code in it is what has to be code: a live
// read-out computed from the current values, the test of an experiment's
// goal, a diagram, a domain model.

/** Live values: shared by the diagrams, the read-outs and (some of them) the stage. */
export type Vals = Record<string, number>;

// ---------------------------------------------------------------- questions

export type QuizKind = 'choice' | 'number' | 'order';
export type Confidence = 0 | 1 | 2; // au hasard · hésitant · sûr

export interface QuizSpec {
  question: string;
  kind: QuizKind;
  /** choice: the answers as displayed; order: the steps in the correct order */
  choices: string[];
  /** choice: index of the correct answer in `choices` */
  answer: number;
  /** number: expected value, tolerance (absolute) and unit */
  value?: number;
  tol?: number;
  unit?: string;
  explain: string;
}

// ------------------------------------------------------------------ modules

export interface ModuleDef {
  id: string;
  title: string;
  /** one or two sentences: what the module is about */
  pitch: string;
  /** what the learner will be able to do at the end (each one must be assessed) */
  goals: string[];
  /** the summary sheet: what to remember */
  summary: string[];
  /** 'core' (default) modules make the course; the exam and bonus modules are apart */
  kind?: 'core' | 'exam' | 'bonus';
}

// ----------------------------------------------------------------- glossary

export interface Term {
  id: string;
  /** the name shown in the glossary */
  name: string;
  /** spellings looked for in the text (the name is always included) */
  forms?: string[];
  def: string;
  /** toolbox capsule that explains the underlying maths */
  tool?: string;
  /** module where the term is introduced: it must not appear before */
  module?: string;
}

// ------------------------------------------------------------------ toolbox

export interface CapsuleStep { title: string; text: string; code?: string; diagram?: string }

export interface Capsule {
  id: string;
  title: string;
  /** what the learner will be able to do */
  goal: string;
  /** where the course uses it */
  used: string;
  steps: CapsuleStep[];
  /** two questions to check the tool is in hand */
  check: QuizSpec[];
}

// -------------------------------------------------------------------- tests

export interface TestItem {
  id: string;
  /** the skill measured, shown in the results */
  skill: string;
  /** part A of the start test: the capsule recommended when it is missed */
  tool?: string;
  /** final test: the id of the start-test item measuring the same skill */
  pair?: string;
  q: QuizSpec;
}

export interface Tests {
  /** start test, part A: the mathematical (or other) tools */
  tools?: TestItem[];
  /** start test, part B: the course's notions, before the course */
  pre?: TestItem[];
  /** final test: the same notions, in other situations */
  post?: TestItem[];
}

// --------------------------------------------------------------- experiments

export interface Control {
  type: 'range' | 'toggle' | 'choice';
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  fmt?: (v: number) => string;
  /** toggle */
  on?: number;
  off?: number;
  /** choice */
  options?: { label: string; value: number }[];
  help?: string;
  /** range: the slider moves on a logarithmic scale */
  log?: boolean;
}

export interface Goal { label: string; test(x: { v: Vals; ptr: { x: number; y: number } | null; hits: Set<string> }): boolean }

/** A prediction the learner commits to before an experiment. */
export interface Predict { question: string; choices: string[]; answer?: number }

export interface ExperimentSpec {
  id?: string;
  title: string;
  prompt: string;
  /** required when there are goals: the learner predicts before experimenting */
  predict?: Predict;
  controls?: Control[];
  goals?: Goal[];
  /** what should have been observed, shown once the goals are reached */
  conclusion?: string;
  /** goals unlock one after the other */
  seq?: boolean;
  /** the diagram reacts to the pointer */
  diag?: boolean;
  /** how long the settings hold: to the end of the chapter (default) or to the next step */
  hold?: 'chapter' | 'step';
  /** a diagnosis question just before served as the prediction (clinic cases) */
  afterDiagnosis?: boolean;
}

// ------------------------------------------------------------------- steps

export interface StepOptions {
  /** an aside: an example, a detail, something to look at */
  note?: string;
  /** code shown under the text; {{key|min|max|step}} becomes a draggable value */
  code?: string;
  /** live read-out computed from the current values */
  hud?: (v: Vals) => string;
  /** how many of the course's pipeline layers are lit */
  layers?: number;
  /** toolbox capsules this step relies on (« Rappel » buttons) */
  tools?: string[];
  /** seconds the clock runs through this step before waiting (default: from the length) */
  dwell?: number;
  /** figures stated in the text, checked by running the domain model */
  claims?: Claim[];
}

/** A figure stated in a step, checked by running the course's model. */
export interface Claim { text: string; check(model: unknown): boolean | string }

// ---------------------------------------------------------------- the stage

/**
 * What fills the background: a 3D scene, a 2D simulation, an image, nothing.
 * The player calls `show` when the scene changes and `update` when its
 * settings change.
 */
export interface Stage {
  mount(el: HTMLElement): void;
  show(scene: string, settings: Vals): void | Promise<void>;
  update(settings: Vals): void;
  status(): { busy: boolean; label: string; progress?: number };
  /** the learner may orbit / pan the view; reset brings back the authored view */
  resetView?(): void;
  dispose(): void;
}

// -------------------------------------------------------------- the model

export interface ParamSpec { key: string; label: string; unit?: string; min?: number; max?: number; value: number }

/** A property the model must have: a law, a conservation, a limit case. */
export interface ModelCheck { name: string; run(): string | null }

/**
 * A small executable model of the subject. Diagrams, stages, experiments and
 * exercises read it; the checks and the claims run it.
 */
export interface DomainModel {
  name: string;
  params?: ParamSpec[];
  checks: ModelCheck[];
  [k: string]: unknown;
}

// --------------------------------------------------------------- exercises

/** The common part of every exercise; the kinds add their own fields. */
export interface ExerciseBase {
  id: string;
  /** module (id) the exercise belongs to */
  module: string;
  title: string;
  kind: string;
}

// ------------------------------------------------------------------- course

export interface Labels { [key: string]: string }

export interface CourseDef {
  id: string;
  version: number;
  language: string;
  title: string;
  /** one paragraph for the home page */
  lead: string;
  audience: { level: string; prerequisites: string; effort?: string };
  modules: ModuleDef[];
  glossary?: Term[];
  toolbox?: Capsule[];
  tests?: Tests;
  /** the steps of the course's pipeline, lit progressively (optional) */
  layers?: string[];
  /** diagram name → drawing function (see @coursekit/diagrams) */
  diagrams?: Record<string, (ctx: CanvasRenderingContext2D, env: DiagramEnv) => void>;
  /** value keys that reach the stage; the others are diagram-only */
  stageKeys?: string[];
  /** stage scene labels (badge) */
  scenes?: Record<string, string>;
  /** initial values */
  defaults?: Vals;
  model?: DomainModel;
  exercises?: ExerciseBase[];
  /** text of the assessment grid, shown on the home page and in the exam */
  rubric?: string[];
  /** overrides of the interface texts */
  labels?: Labels;
  /** forbidden phrasings, checked by the content lint (on top of the defaults) */
  bannedPhrases?: string[];
  content(c: import('./builder.ts').Builder): void;
}

export interface DiagramEnv {
  /** seconds since the diagram appeared (keeps running in pauses) */
  t: number;
  v: Vals;
  ptr: { x: number; y: number } | null;
  hits: Set<string>;
  arg?: string;
  model?: DomainModel;
}
