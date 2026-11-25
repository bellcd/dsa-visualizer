import { Tracer } from './tracer.js';
import type { InputField, Trace } from './types.js';

export type AlgorithmDef<
  I extends Record<string, unknown> = Record<string, unknown>,
  R = unknown,
> = {
  id: string;
  name: string;
  pseudocode: string[];
  inputFields: InputField[];
  validate(input: I): void;
  setup(input: I): Record<string, number[]>;
  run(t: Tracer, input: I): R;
};

export function trace<I extends Record<string, unknown>, R>(
  def: AlgorithmDef<I, R>,
  input: I,
  seed?: number,
): Trace {
  def.validate(input);
  const t = new Tracer(def.setup(input), seed);
  const result = def.run(t, input);
  const { steps, stats } = t.finish();
  const out: Trace = {
    version: 1,
    algorithm: {
      id: def.id,
      name: def.name,
      pseudocode: [...def.pseudocode],
    },
    input: structuredClone(input),
    steps,
    result,
    stats,
  };
  if (seed !== undefined) out.seed = seed;
  return out;
}
