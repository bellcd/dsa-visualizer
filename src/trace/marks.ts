import { slotProblem, unknownArrayMessage } from './operations.js';
import type { Marks, VarValue } from './types.js';

type LengthOf = (target: string) => number | undefined;

function positionProblem(
  length: number,
  target: string,
  at: number | string,
): string | undefined {
  if (typeof at === 'number' && slotProblem(length, at, target) === undefined) {
    return undefined;
  }
  return `Mark position ${String(at)} is out of bounds for '${target}' (length ${length})`;
}

function rangeProblem(
  length: number,
  target: string,
  from: number,
  to: number,
): string | undefined {
  if (
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    from <= to &&
    to <= length
  ) {
    return undefined;
  }
  return `Range [${from}, ${to}) is out of bounds for '${target}' (length ${length})`;
}

export class MarkSet {
  readonly #lengthOf: LengthOf;
  readonly #marks: Marks = { pointers: {}, ranges: {}, tags: {}, vars: {} };

  constructor(lengthOf: LengthOf) {
    this.#lengthOf = lengthOf;
  }

  #lengthFor(target: string): number {
    const length = this.#lengthOf(target);
    if (length === undefined) throw new Error(unknownArrayMessage(target));
    return length;
  }

  #checkAt(target: string, at: number | string): void {
    const problem = positionProblem(this.#lengthFor(target), target, at);
    if (problem !== undefined) throw new RangeError(problem);
  }

  pointer(name: string, target: string, at: number | string | null): void {
    if (at === null) {
      this.#lengthFor(target);
      delete this.#marks.pointers[name];
      return;
    }
    this.#checkAt(target, at);
    this.#marks.pointers[name] = { target, at };
  }

  range(name: string, target: string, from: number, to: number): void {
    const problem = rangeProblem(this.#lengthFor(target), target, from, to);
    if (problem !== undefined) throw new RangeError(problem);
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
    this.#lengthFor(target);
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

  snapshot(): Marks {
    return structuredClone(this.#marks);
  }
}
