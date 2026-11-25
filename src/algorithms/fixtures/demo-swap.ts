import { type AlgorithmDef, InputError } from '../../trace/index.js';

type Input = { values: number[] };

/** A fixture that exercises every operation and mark type once. */
export const demoSwapDef: AlgorithmDef<Input, number[]> = {
  id: 'demo-swap',
  name: 'Demo: swap',
  pseudocode: [
    'compare a[0] with a[1]',
    'swap a[0], a[1]',
    'compare a[2] with the held value',
    'write the held value to a[4]',
  ],
  inputFields: [{ name: 'values', kind: 'numberArray' }],
  validate(input) {
    if (input.values.length !== 5) {
      throw new InputError('demo-swap needs exactly 5 values');
    }
  },
  setup: (input) => ({ a: input.values }),
  run(t, input) {
    const a = t.array('a');
    t.line(0);
    t.pointer('i', 'a', 0);
    t.pointer('j', 'a', 1);
    t.setVar('held', input.values[2] ?? 0);
    t.note('compare the first two');
    const first = a.compare(0, 1);
    t.line(1);
    if (first > 0) a.swap(0, 1);
    t.enter();
    t.range('sorted', 'a', 0, 2);
    t.tag('a', 4, 'visited');
    t.line(2);
    a.compareValue(2, a.get(0));
    t.untag('a', 4, 'visited');
    t.pointer('j', 'a', null);
    t.step();
    t.exit();
    t.line(3);
    a.set(4, a.get(2));
    return a.values();
  },
};
