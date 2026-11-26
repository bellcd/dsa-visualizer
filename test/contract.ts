import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  type AlgorithmDef,
  type Step,
  type Trace,
  trace,
} from '../src/trace/index.js';
import { checkConsistency } from './consistency.js';

const RUNS = 200;

type Range = { min: number; max: number; lo: number; hi: number };

export function numberArrays({
  min,
  max,
  lo,
  hi,
}: Range): fc.Arbitrary<number[]> {
  return fc.array(fc.integer({ min: lo, max: hi }), {
    minLength: min,
    maxLength: max,
  });
}

export function sortedNumberArrays(range: Range): fc.Arbitrary<number[]> {
  return numberArrays(range).map((values) => values.sort((a, b) => a - b));
}

type Ctx<I> = { input: I; index: number; prev: Step | undefined };

type ContractSpec<I, R> = {
  arbitrary: fc.Arbitrary<I>;
  // NOTE: Throws (e.g. via `expect`) when the result is wrong for the input.
  check(input: I, result: R): void;
  // NOTE: Throws when an algorithm-specific guarantee fails at a step.
  guarantee(step: Step, ctx: Ctx<I>): void;
  // NOTE: Throws when the trace's stats exceed the bound for the input.
  bounds(trace: Trace, input: I): void;
  // NOTE: Edge-case inputs that always run, besides the generated ones.
  examples: I[];
  // NOTE: Exact snapshots for known inputs.
  pinned: { input: I; stats: Record<string, number>; result?: R }[];
};

export function algorithmContract<I extends Record<string, unknown>, R>(
  def: AlgorithmDef<I, R>,
  spec: ContractSpec<I, R>,
): void {
  const property = (body: (input: I) => void) => () => {
    fc.assert(fc.property(spec.arbitrary, body), {
      numRuns: RUNS,
      examples: spec.examples.map((input) => [input]),
    });
  };
  const run = (input: I): Trace<R> => trace(def, input);

  describe(`${def.id} contract`, () => {
    test(
      '1. the result is correct',
      property((input) => {
        spec.check(input, run(input).result);
      }),
    );

    test(
      '2. the trace is consistent',
      property((input) => {
        expect(checkConsistency(run(input))).toEqual([]);
      }),
    );

    test(
      '3. the guarantees hold on every step',
      property((input) => {
        const { steps } = run(input);
        steps.forEach((step, index) => {
          spec.guarantee(step, { input, index, prev: steps[index - 1] });
        });
      }),
    );

    test(
      '4. the counts stay within bounds',
      property((input) => {
        spec.bounds(run(input), input);
      }),
    );

    test.each(spec.pinned.map((p) => [JSON.stringify(p.input), p] as const))(
      '4. pinned counts: %s',
      (_name, pinned) => {
        const tr = run(pinned.input);
        expect(tr.stats).toEqual(pinned.stats);
        if ('result' in pinned) expect(tr.result).toEqual(pinned.result);
      },
    );
  });
}
