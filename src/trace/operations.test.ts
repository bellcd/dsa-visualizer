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
  test('applyOperation swap exchanges two items, ids travelling with them', () => {
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

  test('applyOperation swap of a slot with itself changes nothing', () => {
    expect(apply({ op: 'swap', target: 'a', i: 1, j: 1 })).toEqual({
      ok: true,
      state: state(),
    });
  });

  test('applyOperation set writes the value under the minted id', () => {
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

  test('applyOperation set does not ask for an id when the index is out of bounds', () => {
    let asked = 0;
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 9, value: 1, prev: 1 },
      () => asked++,
    );
    expect(asked).toBe(0);
  });

  test('applyOperation set does not ask for an id when prev is wrong', () => {
    let asked = 0;
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 0, value: 1, prev: 4 },
      () => asked++,
    );
    expect(asked).toBe(0);
  });

  test('applyOperation set asks for one id when valid', () => {
    let asked = 0;
    applyOperation(
      state(),
      { op: 'set', target: 'a', i: 0, value: 1, prev: 5 },
      () => asked++,
    );
    expect(asked).toBe(1);
  });

  test('applyOperation set rejects a wrong prev', () => {
    expect(apply({ op: 'set', target: 'a', i: 0, value: 1, prev: 4 })).toEqual({
      ok: false,
      problem: 'set prev 4 but slot held 5',
    });
  });

  test('applyOperation does not mutate the state it is given', () => {
    const before = state();
    applyOperation(before, { op: 'swap', target: 'a', i: 0, j: 2 }, () => 9);
    applyOperation(
      before,
      { op: 'set', target: 'a', i: 0, value: 0, prev: 5 },
      () => 9,
    );
    expect(before).toEqual(state());
  });

  test('applyOperation compare returns 0 when the slots are equal', () => {
    expect(
      apply({ op: 'compare', target: 'a', i: 0, j: 2, result: 0 }),
    ).toEqual({ ok: true, state: state() });
  });

  test('applyOperation compare returns 1 when slot i is larger', () => {
    expect(
      apply({ op: 'compare', target: 'a', i: 0, j: 1, result: 1 }),
    ).toEqual({ ok: true, state: state() });
  });

  test('applyOperation compare returns -1 when slot i is smaller', () => {
    expect(
      apply({ op: 'compare', target: 'a', i: 1, j: 0, result: -1 }),
    ).toEqual({ ok: true, state: state() });
  });

  test('applyOperation compare rejects a wrong result', () => {
    expect(
      apply({ op: 'compare', target: 'a', i: 0, j: 1, result: -1 }),
    ).toEqual({ ok: false, problem: 'compare result -1 is wrong' });
  });

  test('applyOperation compareValue accepts the result matching the held value', () => {
    expect(
      apply({ op: 'compareValue', target: 'a', i: 1, value: 3, result: -1 }),
    ).toEqual({ ok: true, state: state() });
  });

  test('applyOperation compareValue rejects a wrong result', () => {
    expect(
      apply({ op: 'compareValue', target: 'a', i: 1, value: 3, result: 1 }),
    ).toEqual({ ok: false, problem: 'compareValue result 1 is wrong' });
  });

  const outOfBounds = (op: Operation, index: number) => {
    expect(apply(op)).toEqual({
      ok: false,
      problem: `Index ${index} is out of bounds for 'a' (length 3)`,
    });
  };

  test('applyOperation compare rejects i past the end', () => {
    outOfBounds({ op: 'compare', target: 'a', i: 3, j: 0, result: 1 }, 3);
  });

  test('applyOperation compare rejects j past the end', () => {
    outOfBounds({ op: 'compare', target: 'a', i: 0, j: 3, result: -1 }, 3);
  });

  test('applyOperation compare rejects a negative j', () => {
    outOfBounds({ op: 'compare', target: 'a', i: 0, j: -1, result: 1 }, -1);
  });

  test('applyOperation compareValue rejects a fractional i', () => {
    outOfBounds(
      { op: 'compareValue', target: 'a', i: 0.5, value: 1, result: 1 },
      0.5,
    );
  });

  test('applyOperation swap rejects i past the end', () => {
    outOfBounds({ op: 'swap', target: 'a', i: 3, j: 0 }, 3);
  });

  test('applyOperation swap rejects j past the end', () => {
    outOfBounds({ op: 'swap', target: 'a', i: 0, j: 3 }, 3);
  });

  test('applyOperation set rejects a negative i', () => {
    outOfBounds({ op: 'set', target: 'a', i: -1, value: 1, prev: 1 }, -1);
  });

  test('applyOperation rejects an unknown target', () => {
    expect(apply({ op: 'swap', target: 'zz', i: 0, j: 0 })).toEqual({
      ok: false,
      problem: "Unknown array structure 'zz'",
    });
  });

  test('applyOperation rejects a target that is not an array', () => {
    const tree: State = { t: { kind: 'tree', root: null, nodes: [] } };
    expect(
      applyOperation(tree, { op: 'swap', target: 't', i: 0, j: 0 }, () => 0),
    ).toEqual({ ok: false, problem: "Unknown array structure 't'" });
  });

  test('applyOperation init leaves the state', () => {
    const before = state();
    expect(applyOperation(before, { op: 'init' }, () => 0)).toEqual({
      ok: true,
      state: before,
    });
  });

  test('applyOperation mark leaves the state', () => {
    const before = state();
    expect(applyOperation(before, { op: 'mark' }, () => 0)).toEqual({
      ok: true,
      state: before,
    });
  });

  test('applyOperation done leaves the state', () => {
    const before = state();
    expect(applyOperation(before, { op: 'done' }, () => 0)).toEqual({
      ok: true,
      state: before,
    });
  });
});

describe('bounds rules', () => {
  test('slotProblem accepts the first index', () => {
    expect(slotProblem(3, 0, 'a')).toBeUndefined();
  });

  test('slotProblem accepts the last index', () => {
    expect(slotProblem(3, 2, 'a')).toBeUndefined();
  });

  test('slotProblem rejects an index past the end with a message', () => {
    expect(slotProblem(3, 3, 'a')).toBe(
      "Index 3 is out of bounds for 'a' (length 3)",
    );
  });

  test('slotProblem rejects negative indices', () => {
    expect(slotProblem(3, -1, 'a')).toBeDefined();
  });

  test('slotProblem rejects fractional indices', () => {
    expect(slotProblem(3, 1.5, 'a')).toBeDefined();
  });

  test('positionProblem accepts an in-range position', () => {
    expect(positionProblem(state(), 'a', 2)).toBeUndefined();
  });

  test('positionProblem rejects a position past the end with a message', () => {
    expect(positionProblem(state(), 'a', 3)).toBe(
      "Mark position 3 is out of bounds for 'a' (length 3)",
    );
  });

  test('positionProblem rejects a non-numeric position', () => {
    expect(positionProblem(state(), 'a', 'x')).toBe(
      "Mark position x is out of bounds for 'a' (length 3)",
    );
  });

  test('positionProblem rejects negative positions', () => {
    expect(positionProblem(state(), 'a', -1)).toBeDefined();
  });

  test('positionProblem rejects fractional positions', () => {
    expect(positionProblem(state(), 'a', 0.5)).toBeDefined();
  });

  test('positionProblem reports an unknown array', () => {
    expect(positionProblem(state(), 'zz', 0)).toBe(
      "Unknown array structure 'zz'",
    );
  });

  test('rangeProblem accepts a full range', () => {
    expect(rangeProblem(state(), 'a', 0, 3)).toBeUndefined();
  });

  test('rangeProblem accepts an empty in-range range', () => {
    expect(rangeProblem(state(), 'a', 2, 2)).toBeUndefined();
  });

  test('rangeProblem rejects a range past the end with a message', () => {
    expect(rangeProblem(state(), 'a', 0, 4)).toBe(
      "Range [0, 4) is out of bounds for 'a' (length 3)",
    );
  });

  test('rangeProblem rejects a negative start', () => {
    expect(rangeProblem(state(), 'a', -1, 2)).toBeDefined();
  });

  test('rangeProblem rejects a start after the end', () => {
    expect(rangeProblem(state(), 'a', 2, 1)).toBeDefined();
  });

  test('rangeProblem rejects a fractional start', () => {
    expect(rangeProblem(state(), 'a', 0.5, 2)).toBeDefined();
  });

  test('rangeProblem rejects a fractional end', () => {
    expect(rangeProblem(state(), 'a', 0, 1.5)).toBeDefined();
  });

  test('rangeProblem reports an unknown array', () => {
    expect(rangeProblem(state(), 'zz', 0, 0)).toBe(
      "Unknown array structure 'zz'",
    );
  });
});

describe('statKey and sign', () => {
  test('statKey counts compare as compares', () => {
    expect(statKey({ op: 'compare', target: 'a', i: 0, j: 1, result: 0 })).toBe(
      'compares',
    );
  });

  test('statKey counts compareValue as compares', () => {
    expect(
      statKey({ op: 'compareValue', target: 'a', i: 0, value: 1, result: 0 }),
    ).toBe('compares');
  });

  test('statKey counts swap as swaps', () => {
    expect(statKey({ op: 'swap', target: 'a', i: 0, j: 1 })).toBe('swaps');
  });

  test('statKey counts set as sets', () => {
    expect(statKey({ op: 'set', target: 'a', i: 0, value: 1, prev: 1 })).toBe(
      'sets',
    );
  });

  test('statKey counts init as nothing', () => {
    expect(statKey({ op: 'init' })).toBeUndefined();
  });

  test('statKey counts mark as nothing', () => {
    expect(statKey({ op: 'mark' })).toBeUndefined();
  });

  test('statKey counts done as nothing', () => {
    expect(statKey({ op: 'done' })).toBeUndefined();
  });

  test('sign maps a negative number to -1', () => {
    expect(sign(-7)).toBe(-1);
  });

  test('sign maps zero to 0', () => {
    expect(sign(0)).toBe(0);
  });

  test('sign maps a positive number to 1', () => {
    expect(sign(3)).toBe(1);
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

  const tr = trace(def, { values: [4, 4, 1] });

  test('the Tracer reproduces a hand-written sequence of Operations', () => {
    expect(tr.steps.map((s) => s.operation)).toEqual([
      { op: 'init' },
      { op: 'compare', target: 'a', i: 0, j: 1, result: 0 },
      { op: 'swap', target: 'a', i: 0, j: 1 },
      { op: 'set', target: 'a', i: 2, value: 9, prev: 1 },
      { op: 'swap', target: 'a', i: 1, j: 2 },
      { op: 'done' },
    ]);
  });

  test('the Tracer reproduces a hand-written sequence of States', () => {
    const items = (...pairs: [number, number][]) => ({
      a: {
        kind: 'array',
        items: pairs.map(([id, value]) => ({ id, value })),
      },
    });
    expect(tr.steps.map((s) => s.state)).toEqual([
      items([0, 4], [1, 4], [2, 1]),
      items([0, 4], [1, 4], [2, 1]),
      items([1, 4], [0, 4], [2, 1]),
      items([1, 4], [0, 4], [3, 9]),
      items([1, 4], [3, 9], [0, 4]),
      items([1, 4], [3, 9], [0, 4]),
    ]);
  });

  test('the Tracer reproduces a hand-written Stats count', () => {
    expect(tr.stats).toEqual({ compares: 1, swaps: 2, sets: 1 });
  });
});
