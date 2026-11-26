import { TraceLimitExceeded } from './errors.js';
import { MarkSet } from './marks.js';
import {
  applyOperation,
  arrayIn,
  sign,
  slotProblem,
  statKey,
  unknownArrayMessage,
} from './operations.js';
import type {
  Item,
  Operation,
  State,
  Step,
  Structure,
  VarValue,
} from './types.js';

export const MAX_STEPS = 10_000;

type ArrayStructure = Extract<Structure, { kind: 'array' }>;

// NOTE: The only reads and recording an ArrayHandle gets from its Tracer.
type ArrayPort = {
  items(): readonly Item[];
  record(operation: Operation): void;
};

// NOTE: Mulberry32 is deterministic, so a seed reproduces a trace.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ArrayHandle {
  readonly #port: ArrayPort;
  readonly #name: string;

  constructor(port: ArrayPort, name: string) {
    this.#port = port;
    this.#name = name;
  }

  get length(): number {
    return this.#port.items().length;
  }

  get(i: number): number {
    const items = this.#port.items();
    const problem = slotProblem(items.length, i, this.#name);
    if (problem !== undefined) throw new RangeError(problem);
    return items[i].value;
  }

  compare(i: number, j: number): -1 | 0 | 1 {
    const result = sign(this.get(i) - this.get(j));
    this.#port.record({ op: 'compare', target: this.#name, i, j, result });
    return result;
  }

  compareValue(i: number, value: number): -1 | 0 | 1 {
    const result = sign(this.get(i) - value);
    this.#port.record({
      op: 'compareValue',
      target: this.#name,
      i,
      value,
      result,
    });
    return result;
  }

  swap(i: number, j: number): void {
    this.#port.record({ op: 'swap', target: this.#name, i, j });
  }

  set(i: number, value: number): void {
    const prev = this.get(i);
    this.#port.record({ op: 'set', target: this.#name, i, value, prev });
  }

  values(): number[] {
    return this.#port.items().map((item) => item.value);
  }
}

export type ArrayTracer = Pick<
  Tracer,
  | 'rng'
  | 'array'
  | 'pointer'
  | 'range'
  | 'clearRange'
  | 'tag'
  | 'untag'
  | 'setVar'
  | 'line'
  | 'note'
  | 'step'
  | 'enter'
  | 'exit'
>;

export class Tracer {
  readonly rng: () => number;
  #state: State = {};
  readonly #steps: Step[] = [];
  readonly #stats = { compares: 0, swaps: 0, sets: 0 };
  readonly #marks = new MarkSet(
    (target) => arrayIn(this.#state, target)?.items.length,
  );
  #line: number | undefined;
  #note: string | undefined;
  #depth = 0;
  #nextId = 0;

  constructor(initial: Record<string, number[]>, seed: number | undefined) {
    this.rng = seededRng(seed ?? 0);
    for (const [name, values] of Object.entries(initial)) {
      this.#state[name] = {
        kind: 'array',
        items: values.map((value) => ({ id: this.#freshId(), value })),
      };
    }
    this.#push({ op: 'init' }, this.#state, false);
  }

  #freshId = (): number => this.#nextId++;

  #arrayOf(name: string): ArrayStructure {
    const structure = arrayIn(this.#state, name);
    if (structure === undefined) {
      throw new Error(unknownArrayMessage(name));
    }
    return structure;
  }

  array(name: string): ArrayHandle {
    this.#arrayOf(name);
    return new ArrayHandle(
      {
        items: () => this.#arrayOf(name).items,
        record: (operation) => this.#record(operation),
      },
      name,
    );
  }

  #record(operation: Operation): void {
    const applied = applyOperation(this.#state, operation, this.#freshId);
    if (!applied.ok) throw new RangeError(applied.problem);
    const key = statKey(operation);
    if (key !== undefined) this.#stats[key]++;
    this.#push(operation, applied.state, true);
  }

  #push(operation: Operation, state: State, reserveDone: boolean): void {
    this.#state = state;
    const room = reserveDone ? MAX_STEPS - 1 : MAX_STEPS;
    if (this.#steps.length >= room) throw new TraceLimitExceeded(MAX_STEPS);
    const step: Step = {
      operation,
      state: structuredClone(this.#state),
      marks: this.#marks.snapshot(),
    };
    if (this.#line !== undefined) step.line = this.#line;
    if (this.#note !== undefined) step.note = this.#note;
    if (this.#depth > 0) step.depth = this.#depth;
    this.#note = undefined;
    this.#steps.push(step);
  }

  pointer(name: string, target: string, at: number | string | null): void {
    this.#marks.pointer(name, target, at);
  }

  range(name: string, target: string, from: number, to: number): void {
    this.#marks.range(name, target, from, to);
  }

  clearRange(name: string): void {
    this.#marks.clearRange(name);
  }

  tag(target: string, at: number | string, tag: string): void {
    this.#marks.tag(target, at, tag);
  }

  untag(target: string, at: number | string, tag: string): void {
    this.#marks.untag(target, at, tag);
  }

  setVar(name: string, value: VarValue): void {
    this.#marks.setVar(name, value);
  }

  line(index: number): void {
    this.#line = index;
  }

  note(text: string): void {
    this.#note = text;
  }

  step(): void {
    this.#push({ op: 'mark' }, this.#state, true);
  }

  enter(): void {
    this.#depth++;
  }

  exit(): void {
    if (this.#depth === 0) throw new Error('exit() without a matching enter()');
    this.#depth--;
  }

  finish(): { steps: Step[]; stats: Record<string, number> } {
    this.#push({ op: 'done' }, this.#state, false);
    return { steps: this.#steps, stats: { ...this.#stats } };
  }
}
