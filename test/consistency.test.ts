import { describe, expect, test } from 'vitest';
import { demoSwapDef } from '../src/algorithms/fixtures/demo-swap.js';
import { type Trace, trace } from '../src/trace/index.js';
import { checkConsistency } from './consistency.js';

const good = (): Trace => trace(demoSwapDef, { values: [5, 1, 4, 2, 3] });

const broken = (mutate: (t: Trace) => void): string => {
  const t = good();
  mutate(t);
  return checkConsistency(t).join('\n');
};

function stepAt(t: Trace, i: number) {
  const step = t.steps[i];
  if (step === undefined) throw new Error(`no step ${i}`);
  return step;
}

function itemsAt(t: Trace, i: number) {
  const s = stepAt(t, i).state.a;
  if (s?.kind !== 'array') throw new Error('no array');
  return s.items;
}

function itemAt(t: Trace, i: number, k: number) {
  const item = itemsAt(t, i)[k];
  if (item === undefined) throw new Error('no item');
  return item;
}

describe('checkConsistency', () => {
  test('accepts a sound trace', () => {
    expect(checkConsistency(good())).toEqual([]);
  });

  test('catches a wrong snapshot', () => {
    const problems = broken((t) => {
      itemAt(t, 2, 0).value = 12345;
    });
    expect(problems).toMatch(/step 2: state is not/);
  });

  test('catches a duplicate id', () => {
    const problems = broken((t) => {
      itemAt(t, 1, 1).id = itemAt(t, 1, 0).id;
    });
    expect(problems).toMatch(/step 1: duplicate id in 'a'/);
  });

  test('catches ids that are not a permutation when no set happened', () => {
    const problems = broken((t) => {
      t.steps = t.steps.slice(0, 2).concat(t.steps.slice(-1));
      t.stats = { compares: 1, swaps: 0, sets: 0 };
      itemAt(t, 1, 0).id = 99;
    });
    expect(problems).toMatch(/not a permutation/);
  });

  test('catches an out-of-bounds mark', () => {
    const problems = broken((t) => {
      stepAt(t, 1).marks.pointers.i = { target: 'a', at: 5 };
    });
    expect(problems).toMatch(/step 1: pointer 'i' is out of bounds/);
  });

  test('catches an out-of-bounds range', () => {
    const problems = broken((t) => {
      stepAt(t, 1).marks.ranges.sorted = { target: 'a', from: 2, to: 6 };
    });
    expect(problems).toMatch(/range 'sorted' is out of bounds/);
  });

  test('catches a missing done', () => {
    const problems = broken((t) => {
      t.steps.pop();
    });
    expect(problems).toMatch(/last step is not done/);
  });

  test('catches wrong stats', () => {
    const problems = broken((t) => {
      t.stats.compares = 7;
    });
    expect(problems).toMatch(/stats\.compares is 7, counted 2/);
  });

  test('catches a missing init', () => {
    const problems = broken((t) => {
      stepAt(t, 0).operation = { op: 'mark' };
    });
    expect(problems).toMatch(/first step is not init/);
  });

  test('catches a trace that does not round-trip through JSON', () => {
    const problems = broken((t) => {
      stepAt(t, 1).note = undefined;
    });
    expect(problems).toMatch(/does not round-trip through JSON/);
  });
});
