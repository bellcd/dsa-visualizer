import { describe, expect, test } from 'vitest';
import {
  type AlgorithmDef,
  type ArrayTracer,
  InputError,
  MAX_STEPS,
  TraceLimitExceeded,
  trace,
} from './index.js';

type Input = { values: number[] };

function def(
  run: (t: ArrayTracer, input: Input) => unknown,
  extra: Partial<AlgorithmDef<Input, unknown>> = {},
): AlgorithmDef<Input, unknown> {
  return {
    id: 'test',
    name: 'Test',
    pseudocode: ['one', 'two'],
    inputFields: [{ name: 'values', kind: 'numberArray' }],
    validate: () => {},
    setup: (input) => ({ a: input.values }),
    run,
    ...extra,
  };
}

const run = (
  values: number[],
  fn: (t: ArrayTracer) => unknown,
  seed?: number,
) => trace(def(fn), { values }, seed);

const ops = (values: number[], fn: (t: ArrayTracer) => unknown) =>
  run(values, fn).steps.map((s) => s.operation.op);

describe('trace()', () => {
  test('builds the envelope from the def and input', () => {
    const tr = trace(
      def(() => 'r'),
      { values: [3] },
      7,
    );
    expect(tr.version).toBe(1);
    expect(tr.algorithm).toEqual({
      id: 'test',
      name: 'Test',
      pseudocode: ['one', 'two'],
    });
    expect(tr.input).toEqual({ values: [3] });
    expect(tr.seed).toBe(7);
    expect(tr.result).toBe('r');
  });

  test('omits seed when none is given, and the trace survives JSON', () => {
    const tr = run([2, 1], (t) => t.array('a').swap(0, 1));
    expect('seed' in tr).toBe(false);
    expect(JSON.parse(JSON.stringify(tr))).toEqual(tr);
  });

  test('trace() copies the input and the pseudocode', () => {
    const values = [1, 2];
    const d = def(() => 0);
    const tr = trace(d, { values });
    values.push(3);
    d.pseudocode.push('three');
    expect(tr.input).toEqual({ values: [1, 2] });
    expect(tr.algorithm.pseudocode).toEqual(['one', 'two']);
  });

  test('validate runs first, and its InputError propagates', () => {
    let ran = false;
    const d = def(
      () => {
        ran = true;
      },
      {
        validate: () => {
          throw new InputError('need numbers');
        },
      },
    );
    expect(() => trace(d, { values: [] })).toThrow(InputError);
    expect(() => trace(d, { values: [] })).toThrow('need numbers');
    expect(ran).toBe(false);
  });

  test('InputError and TraceLimitExceeded are named errors', () => {
    expect(new InputError('x').name).toBe('InputError');
    expect(new TraceLimitExceeded(5).name).toBe('TraceLimitExceeded');
    expect(new TraceLimitExceeded(5).message).toContain('5');
  });
});

describe('ids', () => {
  test('ids are assigned 0..n-1 by index at setup', () => {
    const tr = run([9, 9, 9], () => 0);
    expect(tr.steps[0]?.state.a).toEqual({
      kind: 'array',
      items: [
        { id: 0, value: 9 },
        { id: 1, value: 9 },
        { id: 2, value: 9 },
      ],
    });
  });

  test('ids follow the items through a swap', () => {
    const tr = run([5, 6], (t) => t.array('a').swap(0, 1));
    expect(tr.steps[1]?.state.a).toEqual({
      kind: 'array',
      items: [
        { id: 1, value: 6 },
        { id: 0, value: 5 },
      ],
    });
  });
});

describe('init and done', () => {
  test('init is steps[0], before run, with no marks', () => {
    const tr = run([1], (t) => {
      t.setVar('x', 1);
      t.line(1);
      t.array('a').swap(0, 0);
    });
    expect(tr.steps[0]).toEqual({
      operation: { op: 'init' },
      state: { a: { kind: 'array', items: [{ id: 0, value: 1 }] } },
      marks: { pointers: {}, ranges: {}, tags: {}, vars: {} },
    });
  });

  test('done is last, after run, carrying the pending marks', () => {
    const tr = run([1, 2], (t) => {
      t.array('a').swap(0, 1);
      t.pointer('i', 'a', 1);
      t.setVar('x', 'late');
      t.note('bye');
      t.line(1);
    });
    expect(tr.steps.map((s) => s.operation.op)).toEqual([
      'init',
      'swap',
      'done',
    ]);
    const done = tr.steps[2];
    expect(done?.marks.pointers).toEqual({ i: { target: 'a', at: 1 } });
    expect(done?.marks.vars).toEqual({ x: 'late' });
    expect(done?.note).toBe('bye');
    expect(done?.line).toBe(1);
    expect(done?.state).toEqual(tr.steps[1]?.state);
  });

  test('an empty run is just init and done', () => {
    expect(ops([], () => 0)).toEqual(['init', 'done']);
  });
});

describe('operations append exactly one step', () => {
  test('compare appends exactly one step', () => {
    const tr = run([1, 2], (t) => {
      expect(t.array('a').compare(0, 1)).toBe(-1);
      expect(t.array('a').compare(1, 0)).toBe(1);
      expect(t.array('a').compare(1, 1)).toBe(0);
    });
    expect(tr.steps.slice(1, 4).map((s) => s.operation)).toEqual([
      { op: 'compare', target: 'a', i: 0, j: 1, result: -1 },
      { op: 'compare', target: 'a', i: 1, j: 0, result: 1 },
      { op: 'compare', target: 'a', i: 1, j: 1, result: 0 },
    ]);
    expect(tr.steps).toHaveLength(5);
  });

  test('compareValue appends exactly one step', () => {
    const tr = run([4], (t) => {
      const a = t.array('a');
      expect([
        a.compareValue(0, 9),
        a.compareValue(0, 1),
        a.compareValue(0, 4),
      ]).toEqual([-1, 1, 0]);
    });
    expect(tr.steps[1]?.operation).toEqual({
      op: 'compareValue',
      target: 'a',
      i: 0,
      value: 9,
      result: -1,
    });
    expect(tr.steps).toHaveLength(5);
  });

  test('swap appends exactly one step', () => {
    const tr = run([1, 2, 3], (t) => t.array('a').swap(0, 2));
    expect(tr.steps[1]?.operation).toEqual({
      op: 'swap',
      target: 'a',
      i: 0,
      j: 2,
    });
    expect(tr.steps).toHaveLength(3);
  });

  test('set appends exactly one step', () => {
    const tr = run([1, 2], (t) => t.array('a').set(1, 8));
    expect(tr.steps[1]?.operation).toEqual({
      op: 'set',
      target: 'a',
      i: 1,
      value: 8,
      prev: 2,
    });
    expect(tr.steps).toHaveLength(3);
  });

  test('step appends exactly one step', () => {
    const tr = run([1], (t) => {
      t.step();
      t.step();
    });
    expect(tr.steps.map((s) => s.operation.op)).toEqual([
      'init',
      'mark',
      'mark',
      'done',
    ]);
  });

  test('each step carries a deep copy of the state and the marks', () => {
    const tr = run([1, 2], (t) => {
      const a = t.array('a');
      t.pointer('i', 'a', 0);
      t.tag('a', 0, 'seen');
      a.swap(0, 1);
      t.pointer('i', 'a', 1);
      t.tag('a', 1, 'seen');
      a.swap(0, 1);
    });
    const [init, s1, s2] = tr.steps;
    expect(init?.state.a).not.toBe(s1?.state.a);
    expect(s1?.state).not.toEqual(s2?.state === s1?.state ? null : undefined);
    expect(s1?.state.a).toEqual({
      kind: 'array',
      items: [
        { id: 1, value: 2 },
        { id: 0, value: 1 },
      ],
    });
    expect(s2?.state.a).toEqual(init?.state.a);
    expect(s1?.marks.pointers.i?.at).toBe(0);
    expect(s1?.marks.tags.seen).toHaveLength(1);
    expect(s2?.marks.pointers.i?.at).toBe(1);
    expect(s2?.marks.tags.seen).toHaveLength(2);
    expect(s1?.marks).not.toBe(s2?.marks);
  });
});

describe('swap(i, i)', () => {
  test('swap(i, i) is recorded and counted, and changes nothing', () => {
    const tr = run([7, 8], (t) => t.array('a').swap(1, 1));
    expect(tr.steps[1]?.operation).toEqual({
      op: 'swap',
      target: 'a',
      i: 1,
      j: 1,
    });
    expect(tr.steps[1]?.state).toEqual(tr.steps[0]?.state);
    expect(tr.stats.swaps).toBe(1);
  });
});

describe('set(i, v)', () => {
  test('set(i, v) gives the slot a new, unused id', () => {
    const tr = run([1, 2, 3], (t) => {
      const a = t.array('a');
      a.set(0, 10);
      a.set(0, 11);
      a.set(2, 12);
    });
    const ids = (n: number): number[] => {
      const a = tr.steps[n]?.state.a;
      return a?.kind === 'array' ? a.items.map((x) => x.id) : [];
    };
    expect(ids(1)).toEqual([3, 1, 2]);
    expect(ids(2)).toEqual([4, 1, 2]);
    expect(ids(3)).toEqual([4, 1, 5]);
    expect(tr.result).toBeUndefined();
  });
});

describe('marks and Steps', () => {
  test('pointer, range, tag, untag, setVar create no step of their own', () => {
    expect(
      ops([1, 2], (t) => {
        t.pointer('i', 'a', 0);
        t.range('r', 'a', 0, 1);
        t.clearRange('r');
        t.tag('a', 0, 't');
        t.untag('a', 0, 't');
        t.setVar('v', 1);
        t.enter();
        t.exit();
        t.line(0);
        t.note('n');
      }),
    ).toEqual(['init', 'done']);
  });

  test('each Step carries a copy of the marks as they were', () => {
    const tr = run([1, 2, 3], (t) => {
      t.pointer('i', 'a', 0);
      t.step();
      t.pointer('i', 'a', 2);
      t.step();
    });
    expect(tr.steps.map((s) => s.marks.pointers)).toEqual([
      {},
      { i: { target: 'a', at: 0 } },
      { i: { target: 'a', at: 2 } },
      { i: { target: 'a', at: 2 } },
    ]);
  });
});

describe('marks and State lengths', () => {
  test('marks are bounds-checked against the live length of the structure', () => {
    expect(() => run([1, 2], (t) => t.pointer('i', 'a', 2))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2, 3], (t) => t.pointer('i', 'a', 2))).not.toThrow();
    expect(() => run([1, 2], (t) => t.range('r', 'a', 0, 3))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.tag('a', 2, 't'))).toThrow(RangeError);
  });

  test('a mark on an unknown structure throws', () => {
    expect(() => run([1], (t) => t.pointer('i', 'nope', 0))).toThrow('nope');
  });

  test('array() of an unknown structure throws', () => {
    expect(() => run([1], (t) => t.array('nope'))).toThrow('nope');
  });
});

describe('depth', () => {
  test('depth from enter and exit persists until changed, and zero is omitted', () => {
    const tr = run([1], (t) => {
      t.step();
      t.enter();
      t.enter();
      t.step();
      t.exit();
      t.step();
      t.exit();
      t.step();
    });
    expect(tr.steps.map((s) => s.depth)).toEqual([
      undefined,
      undefined,
      2,
      1,
      undefined,
      undefined,
    ]);
    expect(
      tr.steps.every((s) => !('depth' in s) || s.depth !== undefined),
    ).toBe(true);
  });

  test('exit() without a matching enter() throws', () => {
    expect(() => run([1], (t) => t.exit())).toThrow('enter');
  });
});

describe('line and note', () => {
  test('line persists until changed', () => {
    const tr = run([1], (t) => {
      t.step();
      t.line(0);
      t.step();
      t.step();
      t.line(1);
      t.step();
    });
    expect(tr.steps.map((s) => s.line)).toEqual([
      undefined,
      undefined,
      0,
      0,
      1,
      1,
    ]);
  });

  test('line 0 is kept on the step rather than treated as unset', () => {
    const tr = run([1], (t) => {
      t.line(0);
      t.step();
    });
    expect(tr.steps[1]).toHaveProperty('line', 0);
  });

  test('note applies to the next step only', () => {
    const tr = run([1, 2], (t) => {
      t.note('first');
      t.array('a').swap(0, 1);
      t.step();
      t.note('');
      t.step();
    });
    expect(tr.steps.map((s) => s.note)).toEqual([
      undefined,
      'first',
      undefined,
      '',
      undefined,
    ]);
  });
});

describe('stats', () => {
  test('stats count compares (both kinds), swaps and sets', () => {
    const tr = run([1, 2, 3], (t) => {
      const a = t.array('a');
      a.compare(0, 1);
      a.compareValue(0, 5);
      a.compareValue(1, 5);
      a.swap(0, 1);
      a.swap(1, 1);
      a.set(0, 1);
      t.step();
      a.get(0);
      a.values();
    });
    expect(tr.stats).toEqual({ compares: 3, swaps: 2, sets: 1 });
  });

  test('stats are all zero for an empty run', () => {
    expect(run([], () => 0).stats).toEqual({ compares: 0, swaps: 0, sets: 0 });
  });
});

describe('reads', () => {
  test('array reads (length, get, values) reflect the current state, silently', () => {
    const seen: unknown[] = [];
    const tr = run([4, 5], (t) => {
      const a = t.array('a');
      a.swap(0, 1);
      seen.push(a.length, a.get(0), a.values());
      return a.values();
    });
    expect(seen).toEqual([2, 5, [5, 4]]);
    expect(tr.result).toEqual([5, 4]);
    expect(tr.steps).toHaveLength(3);
  });

  test('array values() returns a copy', () => {
    const tr = run([1, 2], (t) => {
      t.array('a').values().reverse();
      return t.array('a').values();
    });
    expect(tr.result).toEqual([1, 2]);
  });
});

describe('rng', () => {
  const draws = (seed?: number): number[] => {
    let out: number[] = [];
    run(
      [],
      (t) => {
        out = [t.rng(), t.rng(), t.rng()];
      },
      seed,
    );
    return out;
  };

  test('rng is deterministic for a seed and differs between seeds', () => {
    expect(draws(1)).toEqual(draws(1));
    expect(draws(1)).not.toEqual(draws(2));
    expect(draws()).toEqual(draws(0));
  });

  test('rng yields numbers in [0, 1) that vary', () => {
    const d = draws(42);
    expect(d.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(d).size).toBe(3);
  });
});

describe('errors', () => {
  test('an index out of bounds is a RangeError', () => {
    expect(() => run([1, 2], (t) => t.array('a').get(2))).toThrow(RangeError);
    expect(() => run([1, 2], (t) => t.array('a').get(-1))).toThrow(RangeError);
    expect(() => run([1, 2], (t) => t.array('a').get(0.5))).toThrow(RangeError);
    expect(() => run([1, 2], (t) => t.array('a').compare(0, 2))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.array('a').compare(2, 0))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.array('a').compareValue(2, 0))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.array('a').swap(0, 2))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.array('a').swap(2, 0))).toThrow(
      RangeError,
    );
    expect(() => run([1, 2], (t) => t.array('a').set(2, 0))).toThrow(
      RangeError,
    );
  });

  test('a failed operation records nothing and changes nothing', () => {
    const seen: number[][] = [];
    expect(() =>
      run([1, 2], (t) => {
        const a = t.array('a');
        try {
          a.swap(0, 5);
        } catch {
          seen.push(a.values());
        }
        a.set(7, 1);
      }),
    ).toThrow(RangeError);
    expect(seen).toEqual([[1, 2]]);
  });

  test('more than 10,000 steps throws TraceLimitExceeded', () => {
    const steps = (n: number) =>
      trace(
        def((t) => {
          for (let k = 0; k < n; k++) t.step();
        }),
        { values: [] },
      );
    expect(steps(MAX_STEPS - 2).steps).toHaveLength(MAX_STEPS);
    expect(() => steps(MAX_STEPS - 1)).toThrow(TraceLimitExceeded);
    expect(() => steps(MAX_STEPS * 2)).toThrow(TraceLimitExceeded);
  });

  test('a run that throws makes trace() throw the same error', () => {
    const boom = new Error('boom');
    expect(() =>
      run([1], (t) => {
        t.step();
        throw boom;
      }),
    ).toThrow(boom);
  });
});
