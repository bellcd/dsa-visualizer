import { describe, expect, test } from 'vitest';
import { type AlgorithmDef, trace } from './index.js';
import {
  applyOperation,
  positionProblem,
  rangeProblem,
  sign,
  slotProblem,
  statKey,
} from './operations.js';
import type { Operation, State } from './types.js';

const state = (): State => ({
  a: {
    kind: 'array',
    items: [
      { id: 0, value: 5 },
      { id: 1, value: 2 },
      { id: 2, value: 5 },
    ],
  },
  b: { kind: 'array', items: [{ id: 3, value: 9 }] },
});

const apply = (op: Operation, next = 10) =>
  applyOperation(state(), op, () => next);

describe('applyOperation', () => {
  test('swap exchanges two items, ids travelling with them', () => {
    expect(apply({ op: 'swap', target: 'a', i: 0, j: 1 })).toEqual({
      ok: true,
      state: {
        a: {
          kind: 'array',
          items: [
            { id: 1, value: 2 },
            { id: 0, value: 5 },
            { id: 2, value: 5 },
          ],
        },
        b: state().b,
      },
    });
  });

  test('swapping a slot with itself changes nothing', () => {
    expect(apply({ op: 'swap', target: 'a', i: 1, j: 1 })).toEqual({
      ok: true,
      state: state(),
    });
  });

  test('set writes the value under the minted id', () => {
    expect(
      apply({ op: 'set', target: 'a', i: 2, value: 7, prev: 5 }, 42),
    ).toEqual({
      ok: true,
      state: {
        a: {
          kind: 'array',
          items: [
            { id: 0, value: 5 },
            { id: 1, value: 2 },
            { id: 42, value: 7 },
          ],
        },
        b: state().b,
      },
    });
  });

  test('set only asks for an id when it is valid', () => {
    let asked = 0;
    const freshId = () => asked++;
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 9, value: 1, prev: 1 },
      freshId,
    );
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 0, value: 1, prev: 4 },
      freshId,
    );
    expect(asked).toBe(0);
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 0, value: 1, prev: 5 },
      freshId,
    );
    expect(asked).toBe(1);
  });

  test('set rejects a wrong prev', () => {
    expect(apply({ op: 'set', target: 'a', i: 0, value: 1, prev: 4 })).toEqual({
      ok: false,
      problem: 'set prev 4 but slot held 5',
    });
  });

  test('does not mutate the state it is given', () => {
    const before = state();
    applyOperation(before, { op: 'swap', target: 'a', i: 0, j: 2 }, () => 9);
    applyOperation(
      before,
      { op: 'set', target: 'a', i: 0, value: 0, prev: 5 },
      () => 9,
    );
    expect(before).toEqual(state());
  });

  test.each([
    [0, 2, 0],
    [0, 1, 1],
    [1, 0, -1],
  ] as const)('compare of slots %i and %i is %i', (i, j, result) => {
    expect(apply({ op: 'compare', target: 'a', i, j, result })).toEqual({
      ok: true,
      state: state(),
    });
  });

  test('compare rejects a wrong result', () => {
    expect(
      apply({ op: 'compare', target: 'a', i: 0, j: 1, result: -1 }),
    ).toEqual({ ok: false, problem: 'compare result -1 is wrong' });
  });

  test('compareValue checks against the held value', () => {
    expect(
      apply({ op: 'compareValue', target: 'a', i: 1, value: 3, result: -1 }),
    ).toEqual({ ok: true, state: state() });
    expect(
      apply({ op: 'compareValue', target: 'a', i: 1, value: 3, result: 1 }),
    ).toEqual({ ok: false, problem: 'compareValue result 1 is wrong' });
  });

  const outOfBounds: [Operation, number][] = [
    [{ op: 'compare', target: 'a', i: 3, j: 0, result: 1 }, 3],
    [{ op: 'compare', target: 'a', i: 0, j: 3, result: -1 }, 3],
    [{ op: 'compare', target: 'a', i: 0, j: -1, result: 1 }, -1],
    [{ op: 'compareValue', target: 'a', i: 0.5, value: 1, result: 1 }, 0.5],
    [{ op: 'swap', target: 'a', i: 3, j: 0 }, 3],
    [{ op: 'swap', target: 'a', i: 0, j: 3 }, 3],
    [{ op: 'set', target: 'a', i: -1, value: 1, prev: 1 }, -1],
  ];

  test.each(outOfBounds)('%j is out of bounds', (op, index) => {
    expect(apply(op)).toEqual({
      ok: false,
      problem: `Index ${index} is out of bounds for 'a' (length 3)`,
    });
  });

  test('an unknown target is a problem', () => {
    expect(apply({ op: 'swap', target: 'zz', i: 0, j: 0 })).toEqual({
      ok: false,
      problem: "Unknown array structure 'zz'",
    });
  });

  test('a target that is not an array is a problem', () => {
    const tree: State = { t: { kind: 'tree', root: null, nodes: [] } };
    expect(
      applyOperation(tree, { op: 'swap', target: 't', i: 0, j: 0 }, () => 0),
    ).toEqual({ ok: false, problem: "Unknown array structure 't'" });
  });

  test.each(['init', 'mark', 'done'] as const)('%s leaves the state', (op) => {
    const before = state();
    expect(applyOperation(before, { op }, () => 0)).toEqual({
      ok: true,
      state: before,
    });
  });
});

describe('bounds rules', () => {
  test('slotProblem', () => {
    expect(slotProblem(3, 0, 'a')).toBeUndefined();
    expect(slotProblem(3, 2, 'a')).toBeUndefined();
    expect(slotProblem(3, 3, 'a')).toBe(
      "Index 3 is out of bounds for 'a' (length 3)",
    );
    expect(slotProblem(3, -1, 'a')).toBeDefined();
    expect(slotProblem(3, 1.5, 'a')).toBeDefined();
  });

  test('positionProblem', () => {
    expect(positionProblem(state(), 'a', 2)).toBeUndefined();
    expect(positionProblem(state(), 'a', 3)).toBe(
      "Mark position 3 is out of bounds for 'a' (length 3)",
    );
    expect(positionProblem(state(), 'a', 'x')).toBe(
      "Mark position x is out of bounds for 'a' (length 3)",
    );
    expect(positionProblem(state(), 'a', -1)).toBeDefined();
    expect(positionProblem(state(), 'a', 0.5)).toBeDefined();
    expect(positionProblem(state(), 'zz', 0)).toBe(
      "Unknown array structure 'zz'",
    );
  });

  test('rangeProblem', () => {
    expect(rangeProblem(state(), 'a', 0, 3)).toBeUndefined();
    expect(rangeProblem(state(), 'a', 2, 2)).toBeUndefined();
    expect(rangeProblem(state(), 'a', 0, 4)).toBe(
      "Range [0, 4) is out of bounds for 'a' (length 3)",
    );
    expect(rangeProblem(state(), 'a', -1, 2)).toBeDefined();
    expect(rangeProblem(state(), 'a', 2, 1)).toBeDefined();
    expect(rangeProblem(state(), 'a', 0.5, 2)).toBeDefined();
    expect(rangeProblem(state(), 'a', 0, 1.5)).toBeDefined();
    expect(rangeProblem(state(), 'zz', 0, 0)).toBe(
      "Unknown array structure 'zz'",
    );
  });
});

describe('statKey and sign', () => {
  test('statKey names the stat each operation counts', () => {
    expect(statKey({ op: 'compare', target: 'a', i: 0, j: 1, result: 0 })).toBe(
      'compares',
    );
    expect(
      statKey({ op: 'compareValue', target: 'a', i: 0, value: 1, result: 0 }),
    ).toBe('compares');
    expect(statKey({ op: 'swap', target: 'a', i: 0, j: 1 })).toBe('swaps');
    expect(statKey({ op: 'set', target: 'a', i: 0, value: 1, prev: 1 })).toBe(
      'sets',
    );
    for (const op of ['init', 'mark', 'done'] as const) {
      expect(statKey({ op })).toBeUndefined();
    }
  });

  test('sign', () => {
    expect([sign(-7), sign(0), sign(3)]).toEqual([-1, 0, 1]);
  });
});

describe('pinned trace', () => {
  const def: AlgorithmDef<{ values: number[] }, unknown> = {
    id: 'pin',
    name: 'Pin',
    pseudocode: [],
    inputFields: [{ name: 'values', kind: 'numberArray' }],
    validate: () => {},
    setup: (input) => ({ a: input.values }),
    run: (t) => {
      const a = t.array('a');
      a.compare(0, 1);
      a.swap(0, 1);
      a.set(2, 9);
      a.swap(1, 2);
    },
  };

  test('the Tracer reproduces a hand-written sequence of States', () => {
    const tr = trace(def, { values: [4, 4, 1] });
    const items = (...pairs: [number, number][]) => ({
      a: {
        kind: 'array',
        items: pairs.map(([id, value]) => ({ id, value })),
      },
    });
    expect(tr.steps.map((s) => s.operation)).toEqual([
      { op: 'init' },
      { op: 'compare', target: 'a', i: 0, j: 1, result: 0 },
      { op: 'swap', target: 'a', i: 0, j: 1 },
      { op: 'set', target: 'a', i: 2, value: 9, prev: 1 },
      { op: 'swap', target: 'a', i: 1, j: 2 },
      { op: 'done' },
    ]);
    expect(tr.steps.map((s) => s.state)).toEqual([
      items([0, 4], [1, 4], [2, 1]),
      items([0, 4], [1, 4], [2, 1]),
      items([1, 4], [0, 4], [2, 1]),
      items([1, 4], [0, 4], [3, 9]),
      items([1, 4], [3, 9], [0, 4]),
      items([1, 4], [3, 9], [0, 4]),
    ]);
    expect(tr.stats).toEqual({ compares: 1, swaps: 2, sets: 1 });
  });
});
