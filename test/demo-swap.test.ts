import { expect } from 'vitest';
import { demoSwapDef } from '../src/algorithms/fixtures/demo-swap.js';
import { algorithmContract, numberArrays } from './contract.js';

const byValue = (a: number, b: number) => a - b;

algorithmContract(demoSwapDef, {
  arbitrary: numberArrays({ min: 5, max: 5 }).map((values) => ({ values })),
  check({ values }, result) {
    const [a = 0, b = 0, c = 0, d = 0] = values;
    expect(result).toEqual(a > b ? [b, a, c, d, c] : [a, b, c, d, c]);
  },
  guarantee(step, { input }) {
    // Only a `set` changes the multiset of values.
    const a = step.state.a;
    if (a?.kind !== 'array') throw new Error('expected array a');
    if (step.operation.op === 'set' || step.operation.op === 'done') return;
    expect(a.items.map((item) => item.value).sort(byValue)).toEqual(
      [...input.values].sort(byValue),
    );
  },
  bounds(tr) {
    expect(tr.stats.compares).toBe(2);
    expect(tr.stats.swaps).toBeLessThanOrEqual(1);
    expect(tr.stats.sets).toBe(1);
  },
  examples: [
    { values: [0, 0, 0, 0, 0] },
    { values: [2, 1, 0, -1, -2] },
    { values: [-99, 99, -99, 99, -99] },
  ],
  pinned: [
    {
      input: { values: [5, 1, 4, 2, 3] },
      stats: { compares: 2, swaps: 1, sets: 1 },
      result: [1, 5, 4, 2, 4],
    },
    {
      input: { values: [1, 5, 4, 2, 3] },
      stats: { compares: 2, swaps: 0, sets: 1 },
    },
  ],
});
