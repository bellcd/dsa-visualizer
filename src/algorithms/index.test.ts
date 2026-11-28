import { describe, expect, test } from 'vitest';
import { InputError, trace } from '../trace/index.js';
import { demoSwapDef } from './fixtures/demo-swap.js';
import { menuGroups, registry, showFixtures } from './index.js';

describe('registry', () => {
  test('holds demo-swap in a hidden fixtures group', () => {
    const fixtures = registry.find((g) => g.hidden);
    expect(fixtures?.defs.map((d) => d.id)).toEqual(['demo-swap']);
    expect(registry.filter((g) => !g.hidden).flatMap((g) => g.defs)).toEqual(
      [],
    );
  });

  test('menuGroups hides the fixtures group when the URL has no ?fixtures', () => {
    expect(menuGroups('').map((g) => g.name)).toEqual(['Algorithms']);
    expect(menuGroups('?x=1').map((g) => g.hidden)).toEqual([false]);
  });

  test('menuGroups shows the fixtures group when the URL has ?fixtures', () => {
    expect(menuGroups('?fixtures').map((g) => g.hidden)).toEqual([false, true]);
    expect(menuGroups('?a=1&fixtures').map((g) => g.name)).toContain(
      'Fixtures',
    );
  });

  test('showFixtures is true when the query string has fixtures', () => {
    expect(showFixtures('?fixtures')).toBe(true);
  });

  test('showFixtures is false for a similar but different parameter', () => {
    expect(showFixtures('?fixture')).toBe(false);
  });
});

describe('demo-swap', () => {
  const recordedTrace = trace(demoSwapDef, { values: [5, 1, 4, 2, 3] });

  test('demo-swap does compares, a swap, a compareValue, a set and a mark step', () => {
    const ops = recordedTrace.steps.map((s) => s.operation.op);
    expect(ops).toEqual([
      'init',
      'compare',
      'swap',
      'compareValue',
      'mark',
      'set',
      'done',
    ]);
    expect(recordedTrace.stats).toEqual({ compares: 2, swaps: 1, sets: 1 });
    expect(recordedTrace.result).toEqual([1, 5, 4, 2, 4]);
  });

  test('demo-swap attaches its note to the first compare step only', () => {
    expect(recordedTrace.steps[1]?.note).toBe('compare the first two');
    expect(
      recordedTrace.steps.filter((s) => s.note !== undefined),
    ).toHaveLength(1);
  });

  test('demo-swap marks two pointers and clears one of them', () => {
    expect(recordedTrace.steps[1]?.marks.pointers).toEqual({
      i: { target: 'a', at: 0 },
      j: { target: 'a', at: 1 },
    });
    expect(recordedTrace.steps[4]?.marks.pointers).toEqual({
      i: { target: 'a', at: 0 },
    });
  });

  test('demo-swap holds the third value in a var', () => {
    expect(recordedTrace.steps[1]?.marks.vars).toEqual({ held: 4 });
  });

  test('demo-swap marks a sorted range', () => {
    expect(recordedTrace.steps[3]?.marks.ranges).toEqual({
      sorted: { target: 'a', from: 0, to: 2 },
    });
  });

  test('demo-swap tags a spot and then removes the tag', () => {
    expect(recordedTrace.steps[3]?.marks.tags).toEqual({
      visited: [{ target: 'a', at: 4, tag: 'visited' }],
    });
    expect(recordedTrace.steps[4]?.marks.tags).toEqual({});
  });

  test('demo-swap is one level deep from the compareValue until the exit', () => {
    expect(recordedTrace.steps.map((s) => s.depth)).toEqual([
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      undefined,
    ]);
  });

  test('demo-swap moves the pseudocode line as it goes', () => {
    expect(recordedTrace.steps.map((s) => s.line)).toEqual([
      undefined,
      0,
      1,
      2,
      2,
      3,
      3,
    ]);
  });

  test('demo-swap compares a[2] with the held value', () => {
    expect(recordedTrace.steps[3]?.operation).toMatchObject({
      op: 'compareValue',
      i: 2,
      value: 4,
    });
  });

  test('demo-swap skips the swap when already ordered', () => {
    const t2 = trace(demoSwapDef, { values: [1, 5, 4, 2, 3] });
    expect(t2.stats.swaps).toBe(0);
  });

  test('demo-swap skips the swap when the first two values are equal', () => {
    const t2 = trace(demoSwapDef, { values: [3, 3, 4, 2, 3] });
    expect(t2.stats.swaps).toBe(0);
  });

  test('demo-swap describes itself for the menu and the input form', () => {
    expect(demoSwapDef.name).toBe('Demo: swap');
    expect(demoSwapDef.pseudocode).toEqual([
      'compare a[0] with a[1]',
      'swap a[0], a[1]',
      'compare a[2] with the held value',
      'write the held value to a[4]',
    ]);
    expect(demoSwapDef.inputFields).toEqual([
      { name: 'values', kind: 'numberArray' },
    ]);
  });

  test('demo-swap needs exactly 5 values', () => {
    expect(() => trace(demoSwapDef, { values: [1] })).toThrow(InputError);
    expect(() => trace(demoSwapDef, { values: [1] })).toThrow(
      'demo-swap needs exactly 5 values',
    );
  });
});
