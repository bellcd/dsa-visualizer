import type { Item, Operation, State, Structure } from './types.js';

type ArrayStructure = Extract<Structure, { kind: 'array' }>;

type Applied = { ok: true; state: State } | { ok: false; problem: string };

type StatKey = 'compares' | 'swaps' | 'sets';

export function sign(n: number): -1 | 0 | 1 {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
}

export function arrayIn(
  state: State,
  target: string,
): ArrayStructure | undefined {
  const structure = state[target];
  return structure?.kind === 'array' ? structure : undefined;
}

export function indexMessage(
  length: number,
  i: number,
  target: string,
): string {
  return `Index ${i} is out of bounds for '${target}' (length ${length})`;
}

export function slotProblem(
  length: number,
  i: number,
  target: string,
): string | undefined {
  if (Number.isInteger(i) && i >= 0 && i < length) return undefined;
  return indexMessage(length, i, target);
}

export function positionProblem(
  state: State,
  target: string,
  at: number | string,
): string | undefined {
  const length = arrayIn(state, target)?.items.length;
  if (length === undefined) return `Unknown array structure '${target}'`;
  if (typeof at !== 'number' || slotProblem(length, at, target) !== undefined) {
    return `Mark position ${String(at)} is out of bounds for '${target}' (length ${length})`;
  }
  return undefined;
}

export function rangeProblem(
  state: State,
  target: string,
  from: number,
  to: number,
): string | undefined {
  const length = arrayIn(state, target)?.items.length;
  if (length === undefined) return `Unknown array structure '${target}'`;
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

export function statKey(operation: Operation): StatKey | undefined {
  switch (operation.op) {
    case 'compare':
    case 'compareValue':
      return 'compares';
    case 'swap':
      return 'swaps';
    case 'set':
      return 'sets';
    default:
      return undefined;
  }
}

export function applyOperation(
  state: State,
  operation: Operation,
  freshId: () => number,
): Applied {
  if (
    operation.op === 'init' ||
    operation.op === 'mark' ||
    operation.op === 'done'
  ) {
    return { ok: true, state };
  }
  const { target } = operation;
  const array = arrayIn(state, target);
  if (array === undefined) {
    return { ok: false, problem: `Unknown array structure '${target}'` };
  }
  const items = array.items;
  const slot = (i: number): Item | undefined =>
    Number.isInteger(i) ? items[i] : undefined;
  const outOfBounds = (i: number): Applied => ({
    ok: false,
    problem: indexMessage(items.length, i, target),
  });
  const withItems = (next: Item[]): Applied => ({
    ok: true,
    state: { ...state, [target]: { kind: 'array', items: next } },
  });

  const first = slot(operation.i);
  if (first === undefined) return outOfBounds(operation.i);

  if (operation.op === 'compare' || operation.op === 'compareValue') {
    const secondIndex = operation.op === 'compare' ? operation.j : 0;
    const other =
      operation.op === 'compare'
        ? slot(secondIndex)
        : { value: operation.value };
    if (other === undefined) return outOfBounds(secondIndex);
    if (sign(first.value - other.value) !== operation.result) {
      return {
        ok: false,
        problem: `${operation.op} result ${operation.result} is wrong`,
      };
    }
    return { ok: true, state };
  }

  const next = [...items];
  if (operation.op === 'swap') {
    const second = slot(operation.j);
    if (second === undefined) return outOfBounds(operation.j);
    next[operation.i] = second;
    next[operation.j] = first;
    return withItems(next);
  }

  if (first.value !== operation.prev) {
    return {
      ok: false,
      problem: `set prev ${operation.prev} but slot held ${first.value}`,
    };
  }
  next[operation.i] = { id: freshId(), value: operation.value };
  return withItems(next);
}
