import { describe, expect, it } from 'vitest';
import {
  EN, FR, PROGRESS_SCHEMA, Progress, Reading, STOP_KINDS, captionText, compile, courseMinutes, defineCourse, fmtValue, labelsFor,
  memoryStore, moduleCounts, placeAnswer, sanitizeProgress, tr, type StopOf,
} from '../src/index.ts';
import fixture from './fixture.ts';

const tl = compile(fixture);
const stop = <K extends keyof typeof STOP_KINDS>(kind: K, id?: string) => tl.stops.find((s) => s.kind === kind && (!id || s.id === id)) as StopOf<K>;

describe('compile', () => {
  it('places every pause after a step, never at its start', () => {
    for (const st of tl.stops) expect(tl.caps.some((c) => Math.abs(c.t - st.t) < 1e-3)).toBe(false);
  });

  it('writes the module cards and the review that opens the second module', () => {
    expect(tl.stops.filter((s) => s.kind === 'card').map((s) => (s as StopOf<'card'>).from)).toEqual([-1, 0, 1, 2]);
    expect(stop('review').module).toBe(1);
  });

  it('gives each pause its module, and each question the module it is asked in', () => {
    expect(stop('quiz', 'q1').quiz.module).toBe(0);
    expect(stop('quiz', 'q2').quiz.module).toBe(2);
    expect(stop('quiz', 'q2').quiz.review).toBe(false); // an exam question does not come back
  });

  it('keeps an experiment\'s settings to the end of its chapter', () => {
    expect(stop('try').until).toBeCloseTo(tl.chapters[1].t);
  });

  it('writes a lazy text on first reading, once', () => {
    let n = 0;
    const lazy = compile(defineCourse({
      ...fixture,
      content(c) { c.module('m1'); c.chapter('C', () => { c.step('S', () => { n++; return 'texte'; }); }); },
    }));
    expect(n).toBe(0);
    expect(captionText(lazy.caps[0])).toBe('texte');
    expect(captionText(lazy.caps[0])).toBe('texte');
    expect(n).toBe(1);
  });

  it('refuses malformed content', () => {
    expect(() => compile(defineCourse({ ...fixture, content(c) { c.module('nope'); } }))).toThrow(/module inconnu/);
    expect(() => compile(defineCourse({ ...fixture, content(c) { c.module('m1'); c.chapter('C', () => { c.step('S', 't'); c.question('q', '?', ['a', 'b'], '—'); c.question('q', '?', ['a', 'b'], '—'); }); } }))).toThrow(/double/);
  });
});

describe('timeline queries', () => {
  it('finds the step, the chapter and the next step by binary search', () => {
    const c = tl.caps[2];
    expect(tl.capAt(c.t + 0.01)).toBe(2);
    expect(tl.nextStepT(c.t + 0.01)).toBe(tl.caps[3].t);
    expect(tl.nextStepT(tl.caps[tl.caps.length - 1].t + 0.01)).toBeNull();
    expect(tl.chapterAt(tl.chapters[1].t + 0.01)).toBe(1);
    expect(tl.sceneAt(0)?.key).toBe('scene');
  });

  it('evaluates the authored values, and only the stage keys somebody set', () => {
    expect(tl.eval(0).a).toBe(2);
    expect(tl.eval(tl.duration - 0.01).b).toBe(20);
    expect(tl.stageVals(0)).toEqual({ a: 2 });
  });
});

describe('Reading', () => {
  it('leaves the compiled timeline unchanged', () => {
    const before = JSON.stringify(tl.stops);
    const r = new Reading(tl);
    r.enterStop(stop('try'));
    r.state(stop('try')).ov.a = 5;
    r.editLive('a', 3, tl.duration, { title: 'live', prompt: '' });
    expect(JSON.stringify(tl.stops)).toBe(before);
  });

  it('applies an experiment\'s settings while it holds, then forgets them on a jump back', () => {
    const r = new Reading(tl);
    const e = stop('try');
    r.enterStop(e);
    r.state(e).ov.a = 5;
    expect(r.eval(e.t).a).toBe(5);
    r.resume();
    expect(r.eval(e.t + 0.5).a).toBe(5);
    expect(r.eval(e.until + 1).a).toBe(2);
    r.resetStops(0);
    expect(r.eval(e.t + 0.5).a).toBe(2);
    // the pauses before it are asked again: the opening card first
    expect(r.stopBetween(0, e.t)?.kind).toBe('card');
  });

  it('never asks a live-edit pause again after a jump back (regression)', () => {
    const r = new Reading(tl);
    r.t = tl.caps[1].t + 1;
    const live = r.editLive('a', 4, tl.caps[2].t, { title: 'live', prompt: '' })!;
    expect(r.isLive(live)).toBe(true);
    expect(r.eval(r.t).a).toBe(4);
    r.resume();
    r.resetStops(0);
    // between the two steps, the only pause left is the course's own experiment
    const found = r.stopBetween(tl.caps[1].t, tl.caps[2].t);
    expect(found?.id).toBe('e1');
    expect(r.eval(live.t).a).toBe(2);
  });

  it('does not let a live edit replace another kind of pause', () => {
    const r = new Reading(tl);
    r.enterStop(stop('quiz', 'q1'));
    expect(r.editLive('a', 4, tl.duration, { title: 'live', prompt: '' })).toBeNull();
    expect(r.stop?.id).toBe('q1');
  });

  it('skips the skippable pauses only, and leaves the one the learner is in', () => {
    const r = new Reading(tl);
    r.enterStop(stop('quiz', 'q1'));
    r.setPauses(false);
    expect(r.stop).toBeNull();
    expect(r.stopBetween(0, tl.duration)?.kind).toBe('card');
    const t = stop('test');
    expect(r.stopBetween(t.t - 0.01, t.t)?.kind).toBe('test');
  });
});

describe('Progress', () => {
  it('saves under a schema, and keeps the answers when the content changes', () => {
    const store = memoryStore();
    const p = new Progress('c', 1, store);
    p.answer('q1', true, 2);
    p.setT(42);
    p.save();
    expect((store.load('coursekit:c') as { schema: number }).schema).toBe(PROGRESS_SCHEMA);
    const next = new Progress('c', 2, store);
    expect(next.d.quiz.q1).toBe(1);
    expect(next.d.lastT).toBe(0); // the times of the old content point nowhere now
  });

  it('migrates the progress saved before schemas, and drops its old key', () => {
    const store = memoryStore();
    store.save('coursekit:c:v3', { lastT: 12, maxT: 12, quiz: { q: 1 }, sessions: 2 });
    const p = new Progress('c', 3, store);
    expect(p.d.quiz.q).toBe(1);
    expect(p.d.lastT).toBe(12);
    expect(store.load('coursekit:c:v3')).toBeNull();
  });

  it('ignores the fields of the wrong shape', () => {
    const d = sanitizeProgress({ lastT: 'x', quiz: [1], sessions: 3, stepMode: false });
    expect(d.lastT).toBe(0);
    expect(d.quiz).toEqual({});
    expect(d.sessions).toBe(3);
    expect(d.stepMode).toBe(false);
  });

  it('brings a question back sooner when it was missed than when it was sure', () => {
    const p = new Progress('c', 1, memoryStore());
    p.answer('sure', true, 2);
    p.answer('sure', true, 2); // right and sure twice: box 2, back in two sessions
    p.answer('missed', false, 2);
    p.newSession();
    expect(p.due(['sure', 'missed'])).toEqual(['missed']);
  });
});

describe('effort', () => {
  it('counts every pause in the line its kind says', () => {
    const c = moduleCounts(tl, 0, []);
    expect(c.pauses.question).toBe(1);
    expect(c.pauses.experiment).toBe(1);
    expect(courseMinutes(tl, [{ id: 'e', module: 'm1' }])).toBeGreaterThan(courseMinutes(tl, []));
  });
});

describe('labels', () => {
  it('has every French text in English too', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(FR).sort());
  });

  it('picks the course\'s language, and fills values and plurals', () => {
    const fr = labelsFor('fr-CA');
    const en = labelsFor('en', { next: 'Go' });
    expect(en.next).toBe('Go');
    expect(tr(fr, 'calcBad', { n: 1 })).toBe('1 étape à revoir.');
    expect(tr(fr, 'calcBad', { n: 2 })).toBe('2 étapes à revoir.');
    expect(tr(en, 'calcBad', { n: 0 })).toBe('0 steps to check again.');
    expect(labelsFor('de').next).toBe(FR.next);
  });
});

describe('numbers and questions', () => {
  it('formats a value in the course\'s language', () => {
    expect(fmtValue(0.125, 'fr')).toBe('0,125');
    expect(fmtValue(0.125, 'en')).toBe('0.125');
    expect(fmtValue(Infinity)).toBe('∞');
  });

  it('moves the right answer to the given position', () => {
    const q = placeAnswer('?', ['bon', 'a', 'b'], '—', 2);
    expect(q.choices[q.answer]).toBe('bon');
    expect(q.answer).toBe(2);
  });
});
