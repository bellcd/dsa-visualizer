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

export function unknownArrayMessage(target: string): string {
  return `Unknown array structure '${target}'`;
}

function indexMessage(length: number, i: number, target: string): string {
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

type Context = {
  state: State;
  items: Item[];
  slot: (i: number) => Item | undefined;
  outOfBounds: (i: number) => Applied;
  withItems: (next: Item[]) => Applied;
};

function applyCompare(
  operation: Extract<Operation, { op: 'compare' | 'compareValue' }>,
  first: Item,
  ctx: Context,
): Applied {
  let other: { value: number };
  if (operation.op === 'compare') {
    const second = ctx.slot(operation.j);
    if (second === undefined) return ctx.outOfBounds(operation.j);
    other = second;
  } else {
    other = { value: operation.value };
  }
  if (sign(first.value - other.value) !== operation.result) {
    return {
      ok: false,
      problem: `${operation.op} result ${operation.result} is wrong`,
    };
  }
  return { ok: true, state: ctx.state };
}

function applySwap(
  operation: Extract<Operation, { op: 'swap' }>,
  first: Item,
  ctx: Context,
): Applied {
  const second = ctx.slot(operation.j);
  if (second === undefined) return ctx.outOfBounds(operation.j);
  const next = [...ctx.items];
  next[operation.i] = second;
  next[operation.j] = first;
  return ctx.withItems(next);
}

function applySet(
  operation: Extract<Operation, { op: 'set' }>,
  first: Item,
  ctx: Context,
  freshId: () => number,
): Applied {
  if (first.value !== operation.prev) {
    return {
      ok: false,
      problem: `set prev ${operation.prev} but slot held ${first.value}`,
    };
  }
  const next = [...ctx.items];
  next[operation.i] = { id: freshId(), value: operation.value };
  return ctx.withItems(next);
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
    return { ok: false, problem: unknownArrayMessage(target) };
  }
  const items = array.items;
  const slot = (i: number): Item | undefined =>
    Number.isInteger(i) ? items[i] : undefined;
  const ctx: Context = {
    state,
    items,
    slot,
    outOfBounds: (i) => ({
      ok: false,
      problem: indexMessage(items.length, i, target),
    }),
    withItems: (next) => ({
      ok: true,
      state: { ...state, [target]: { kind: 'array', items: next } },
    }),
  };

  const first = slot(operation.i);
  if (first === undefined) return ctx.outOfBounds(operation.i);

  if (operation.op === 'compare' || operation.op === 'compareValue') {
    return applyCompare(operation, first, ctx);
  }
  if (operation.op === 'swap') return applySwap(operation, first, ctx);
  return applySet(operation, first, ctx, freshId);
}
