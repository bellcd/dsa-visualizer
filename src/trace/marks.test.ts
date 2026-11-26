import { describe, expect, test } from 'vitest';
import { MarkSet } from './marks.js';

const lengths: Record<string, number> = { a: 3, b: 1 };
const marks = () => new MarkSet((target) => lengths[target]);

describe('pointer', () => {
  test('sets, moves and clears a pointer', () => {
    const m = marks();
    m.pointer('i', 'a', 0);
    expect(m.snapshot().pointers).toEqual({ i: { target: 'a', at: 0 } });
    m.pointer('i', 'a', 2);
    expect(m.snapshot().pointers).toEqual({ i: { target: 'a', at: 2 } });
    m.pointer('i', 'a', null);
    expect(m.snapshot().pointers).toEqual({});
  });

  test('clearing a pointer that is not set is fine', () => {
    const m = marks();
    m.pointer('i', 'a', null);
    expect(m.snapshot().pointers).toEqual({});
  });

  test('accepts the first and last position', () => {
    const m = marks();
    m.pointer('i', 'a', 0);
    m.pointer('j', 'a', 2);
    expect(Object.keys(m.snapshot().pointers)).toEqual(['i', 'j']);
  });

  test.each([
    [3, "Mark position 3 is out of bounds for 'a' (length 3)"],
    [-1, "Mark position -1 is out of bounds for 'a' (length 3)"],
    [0.5, "Mark position 0.5 is out of bounds for 'a' (length 3)"],
    ['x', "Mark position x is out of bounds for 'a' (length 3)"],
  ])('rejects position %s with a RangeError', (at, message) => {
    const m = marks();
    expect(() => m.pointer('i', 'a', at)).toThrow(new RangeError(message));
  });

  test('throws on an unknown structure, even when clearing', () => {
    const m = marks();
    const message = "Unknown array structure 'zz'";
    expect(() => m.pointer('i', 'zz', 0)).toThrow(new Error(message));
    expect(() => m.pointer('i', 'zz', null)).toThrow(new Error(message));
  });

  test('a failed call changes nothing', () => {
    const m = marks();
    m.pointer('i', 'a', 1);
    expect(() => m.pointer('i', 'a', 9)).toThrow(RangeError);
    expect(m.snapshot().pointers).toEqual({ i: { target: 'a', at: 1 } });
  });
});

describe('range', () => {
  test('sets, replaces and clears a range', () => {
    const m = marks();
    m.range('r', 'a', 1, 3);
    expect(m.snapshot().ranges).toEqual({ r: { target: 'a', from: 1, to: 3 } });
    m.range('r', 'a', 3, 3);
    expect(m.snapshot().ranges).toEqual({ r: { target: 'a', from: 3, to: 3 } });
    m.clearRange('r');
    expect(m.snapshot().ranges).toEqual({});
  });

  test('accepts a full range and an empty range at the end', () => {
    const m = marks();
    m.range('full', 'a', 0, 3);
    m.range('empty', 'a', 3, 3);
    expect(Object.keys(m.snapshot().ranges)).toEqual(['full', 'empty']);
  });

  test.each([
    [0, 4, 'Range [0, 4)'],
    [-1, 2, 'Range [-1, 2)'],
    [2, 1, 'Range [2, 1)'],
    [0.5, 2, 'Range [0.5, 2)'],
    [0, 1.5, 'Range [0, 1.5)'],
  ])('rejects [%s, %s) with a RangeError', (from, to, start) => {
    const m = marks();
    expect(() => m.range('r', 'a', from, to)).toThrow(
      new RangeError(`${start} is out of bounds for 'a' (length 3)`),
    );
    expect(m.snapshot().ranges).toEqual({});
  });

  test('throws on an unknown structure', () => {
    expect(() => marks().range('r', 'zz', 0, 0)).toThrow(
      new Error("Unknown array structure 'zz'"),
    );
  });

  test('clearRange checks nothing', () => {
    const m = marks();
    m.clearRange('never-set');
    expect(m.snapshot().ranges).toEqual({});
  });
});

describe('tag and untag', () => {
  test('tag adds once per spot', () => {
    const m = marks();
    m.tag('a', 0, 'seen');
    m.tag('a', 0, 'seen');
    m.tag('a', 1, 'seen');
    m.tag('b', 0, 'seen');
    expect(m.snapshot().tags).toEqual({
      seen: [
        { target: 'a', at: 0, tag: 'seen' },
        { target: 'a', at: 1, tag: 'seen' },
        { target: 'b', at: 0, tag: 'seen' },
      ],
    });
  });

  test('untag removes one spot and drops an emptied tag', () => {
    const m = marks();
    m.tag('a', 0, 'seen');
    m.tag('a', 1, 'seen');
    m.untag('a', 0, 'seen');
    expect(m.snapshot().tags).toEqual({
      seen: [{ target: 'a', at: 1, tag: 'seen' }],
    });
    m.untag('a', 1, 'seen');
    expect(m.snapshot().tags).toEqual({});
  });

  test('untag of a spot or tag that is not set does nothing', () => {
    const m = marks();
    m.tag('a', 0, 'seen');
    m.untag('a', 2, 'seen');
    m.untag('a', 0, 'other');
    expect(m.snapshot().tags).toEqual({
      seen: [{ target: 'a', at: 0, tag: 'seen' }],
    });
  });

  test('tag rejects a bad position and leaves the tags alone', () => {
    const m = marks();
    const message = "Mark position 3 is out of bounds for 'a' (length 3)";
    expect(() => m.tag('a', 3, 't')).toThrow(new RangeError(message));
    expect(() => m.tag('a', -1, 't')).toThrow(RangeError);
    expect(m.snapshot().tags).toEqual({});
  });

  test('tag and untag throw on an unknown structure', () => {
    const m = marks();
    const message = "Unknown array structure 'zz'";
    expect(() => m.tag('zz', 0, 't')).toThrow(new Error(message));
    expect(() => m.untag('zz', 0, 't')).toThrow(new Error(message));
  });
});

describe('setVar', () => {
  test('sets and overwrites variables', () => {
    const m = marks();
    m.setVar('k', 1);
    m.setVar('flag', true);
    m.setVar('k', null);
    expect(m.snapshot().vars).toEqual({ k: null, flag: true });
  });
});

describe('snapshot', () => {
  test('is a copy that later calls do not change', () => {
    const m = marks();
    m.pointer('i', 'a', 0);
    m.tag('a', 0, 't');
    const before = m.snapshot();
    m.pointer('i', 'a', 1);
    m.tag('a', 1, 't');
    expect(before.pointers).toEqual({ i: { target: 'a', at: 0 } });
    expect(before.tags.t).toHaveLength(1);
  });

  test('checks positions against the lengths as they are now', () => {
    const live: Record<string, number> = { a: 1 };
    const m = new MarkSet((target) => live[target]);
    expect(() => m.pointer('i', 'a', 2)).toThrow(RangeError);
    live.a = 3;
    m.pointer('i', 'a', 2);
    expect(m.snapshot().pointers.i?.at).toBe(2);
  });
});
