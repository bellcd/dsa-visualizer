import { TraceLimitExceeded } from './errors.js';
import type { Marks, Operation, Step, Structure, VarValue } from './types.js';

export const MAX_STEPS = 10_000;

type ArrayStructure = Extract<Structure, { kind: 'array' }>;

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

function sign(n: number): -1 | 0 | 1 {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
}

export class ArrayHandle {
  readonly #tracer: Tracer;
  readonly #name: string;

  constructor(tracer: Tracer, name: string) {
    this.#tracer = tracer;
    this.#name = name;
  }

  get length(): number {
    return this.#tracer.arrayOf(this.#name).items.length;
  }

  get(i: number): number {
    return this.#tracer.itemAt(this.#name, i).value;
  }

  compare(i: number, j: number): -1 | 0 | 1 {
    const result = sign(this.get(i) - this.get(j));
    this.#tracer.record({
      op: 'compare',
      target: this.#name,
      i,
      j,
      result,
    });
    return result;
  }

  compareValue(i: number, value: number): -1 | 0 | 1 {
    const result = sign(this.get(i) - value);
    this.#tracer.record({
      op: 'compareValue',
      target: this.#name,
      i,
      value,
      result,
    });
    return result;
  }

  swap(i: number, j: number): void {
    const items = this.#tracer.arrayOf(this.#name).items;
    const a = this.#tracer.itemAt(this.#name, i);
    const b = this.#tracer.itemAt(this.#name, j);
    items[i] = b;
    items[j] = a;
    this.#tracer.record({ op: 'swap', target: this.#name, i, j });
  }

  set(i: number, value: number): void {
    const items = this.#tracer.arrayOf(this.#name).items;
    const prev = this.#tracer.itemAt(this.#name, i).value;
    items[i] = { id: this.#tracer.freshId(), value };
    this.#tracer.record({ op: 'set', target: this.#name, i, value, prev });
  }

  values(): number[] {
    return this.#tracer.arrayOf(this.#name).items.map((item) => item.value);
  }
}

export class Tracer {
  readonly rng: () => number;
  readonly #state: Record<string, Structure> = {};
  readonly #steps: Step[] = [];
  readonly #stats = { compares: 0, swaps: 0, sets: 0 };
  #marks: Marks = { pointers: {}, ranges: {}, tags: {}, vars: {} };
  #line: number | undefined;
  #note: string | undefined;
  #depth = 0;
  #nextId = 0;

  constructor(initial: Record<string, number[]>, seed: number | undefined) {
    this.rng = seededRng(seed ?? 0);
    for (const [name, values] of Object.entries(initial)) {
      this.#state[name] = {
        kind: 'array',
        items: values.map((value) => ({ id: this.freshId(), value })),
      };
    }
    this.#push({ op: 'init' }, false);
  }

  /** @internal */
  freshId(): number {
    return this.#nextId++;
  }

  /** @internal */
  arrayOf(name: string): ArrayStructure {
    const structure = this.#state[name];
    if (structure === undefined || structure.kind !== 'array') {
      throw new Error(`Unknown array structure '${name}'`);
    }
    return structure;
  }

  /** @internal */
  itemAt(name: string, i: number) {
    const items = this.arrayOf(name).items;
    const item = Number.isInteger(i) ? items[i] : undefined;
    if (item === undefined) {
      throw new RangeError(
        `Index ${i} is out of bounds for '${name}' (length ${items.length})`,
      );
    }
    return item;
  }

  array(name: string): ArrayHandle {
    this.arrayOf(name);
    return new ArrayHandle(this, name);
  }

  /** @internal */
  record(operation: Operation): void {
    if (operation.op === 'compare' || operation.op === 'compareValue') {
      this.#stats.compares++;
    } else if (operation.op === 'swap') {
      this.#stats.swaps++;
    } else if (operation.op === 'set') {
      this.#stats.sets++;
    }
    this.#push(operation, true);
  }

  #push(operation: Operation, reserveDone: boolean): void {
    const room = reserveDone ? MAX_STEPS - 1 : MAX_STEPS;
    if (this.#steps.length >= room) throw new TraceLimitExceeded(MAX_STEPS);
    const step: Step = {
      operation,
      state: structuredClone(this.#state),
      marks: structuredClone(this.#marks),
    };
    if (this.#line !== undefined) step.line = this.#line;
    if (this.#note !== undefined) step.note = this.#note;
    if (this.#depth > 0) step.depth = this.#depth;
    this.#note = undefined;
    this.#steps.push(step);
  }

  #checkAt(target: string, at: number | string): void {
    const length = this.arrayOf(target).items.length;
    if (
      typeof at !== 'number' ||
      !Number.isInteger(at) ||
      at < 0 ||
      at >= length
    ) {
      throw new RangeError(
        `Mark position ${String(at)} is out of bounds for '${target}' (length ${length})`,
      );
    }
  }

  pointer(name: string, target: string, at: number | string | null): void {
    if (at === null) {
      delete this.#marks.pointers[name];
      return;
    }
    this.#checkAt(target, at);
    this.#marks.pointers[name] = { target, at };
  }

  range(name: string, target: string, from: number, to: number): void {
    const length = this.arrayOf(target).items.length;
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from > to ||
      to > length
    ) {
      throw new RangeError(
        `Range [${from}, ${to}) is out of bounds for '${target}' (length ${length})`,
      );
    }
    this.#marks.ranges[name] = { target, from, to };
  }

  clearRange(name: string): void {
    delete this.#marks.ranges[name];
  }

  tag(target: string, at: number | string, tag: string): void {
    this.#checkAt(target, at);
    const list = this.#marks.tags[tag] ?? [];
    if (!list.some((entry) => entry.target === target && entry.at === at)) {
      list.push({ target, at, tag });
    }
    this.#marks.tags[tag] = list;
  }

  untag(target: string, at: number | string, tag: string): void {
    const list = this.#marks.tags[tag];
    if (list === undefined) return;
    const kept = list.filter(
      (entry) => !(entry.target === target && entry.at === at),
    );
    if (kept.length === 0) delete this.#marks.tags[tag];
    else this.#marks.tags[tag] = kept;
  }

  setVar(name: string, value: VarValue): void {
    this.#marks.vars[name] = value;
  }

  line(index: number): void {
    this.#line = index;
  }

  note(text: string): void {
    this.#note = text;
  }

  step(): void {
    this.#push({ op: 'mark' }, true);
  }

  enter(): void {
    this.#depth++;
  }

  exit(): void {
    if (this.#depth === 0) throw new Error('exit() without a matching enter()');
    this.#depth--;
  }

  /** @internal */
  finish(): { steps: Step[]; stats: Record<string, number> } {
    this.#push({ op: 'done' }, false);
    return { steps: this.#steps, stats: { ...this.#stats } };
  }
}
