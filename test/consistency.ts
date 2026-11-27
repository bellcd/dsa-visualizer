import type {
  Item,
  Operation,
  State,
  Step,
  Trace,
} from '../src/trace/index.js';

const sign = (n: number): -1 | 0 | 1 => {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
};

const byNumber = (a: number, b: number) => a - b;

function itemsOf(state: State, target: string): Item[] | undefined {
  const s = state[target];
  return s?.kind === 'array' ? s.items : undefined;
}

type Slot = (index: number) => Item | undefined;

function expectCompare(params: {
  operation: Extract<Operation, { op: 'compare' | 'compareValue' }>;
  slot: Slot;
  problems: string[];
  at: string;
}) {
  const { operation, slot, problems, at } = params;
  const left = slot(operation.i);
  const right =
    operation.op === 'compare' ? slot(operation.j) : { value: operation.value };
  if (left === undefined || right === undefined) {
    problems.push(`${at}: ${operation.op} index out of bounds`);
  } else if (sign(left.value - right.value) !== operation.result) {
    problems.push(`${at}: ${operation.op} result ${operation.result} is wrong`);
  }
}

function expectSwap(params: {
  operation: Extract<Operation, { op: 'swap' }>;
  slot: Slot;
  items: Item[];
  problems: string[];
  at: string;
}) {
  const { operation, slot, items, problems, at } = params;
  const first = slot(operation.i);
  const second = slot(operation.j);
  if (first === undefined || second === undefined) {
    problems.push(`${at}: swap index out of bounds`);
    return;
  }
  items[operation.i] = second;
  items[operation.j] = first;
}

function expectSet(params: {
  operation: Extract<Operation, { op: 'set' }>;
  slot: Slot;
  next: Step;
  items: Item[];
  seen: Map<string, Set<number>>;
  problems: string[];
  at: string;
}) {
  const { operation, slot, next, items, seen, problems, at } = params;
  const old = slot(operation.i);
  if (old === undefined) {
    problems.push(`${at}: set index out of bounds`);
    return;
  }
  if (old.value !== operation.prev) {
    problems.push(
      `${at}: set prev ${operation.prev} but slot held ${old.value}`,
    );
  }
  const id = itemsOf(next.state, operation.target)?.[operation.i]?.id;
  if (id === undefined || seen.get(operation.target)?.has(id)) {
    problems.push(`${at}: set did not give the slot a new id`);
  } else {
    items[operation.i] = { id, value: operation.value };
  }
}

// NOTE: `seen` tracks all past ids, since a `set` must mint an id never used.
function applyOperation(
  prev: Step,
  next: Step,
  seen: Map<string, Set<number>>,
  problems: string[],
  at: string,
): State {
  const expected = structuredClone(prev.state);
  const operation = next.operation;
  if (operation.op === 'init') {
    problems.push(`${at}: 'init' after step 0`);
    return expected;
  }
  if (operation.op === 'mark' || operation.op === 'done') return expected;
  const items = itemsOf(expected, operation.target);
  if (items === undefined) {
    problems.push(`${at}: unknown array '${operation.target}'`);
    return expected;
  }
  const slot: Slot = (index) =>
    Number.isInteger(index) ? items[index] : undefined;
  if (operation.op === 'compare' || operation.op === 'compareValue') {
    expectCompare({ operation, slot, problems, at });
  } else if (operation.op === 'swap') {
    expectSwap({ operation, slot, items, problems, at });
  } else {
    expectSet({ operation, slot, next, items, seen, problems, at });
  }
  return expected;
}

function checkMarks(step: Step, at: string, problems: string[]) {
  const { marks, state } = step;
  const inBounds = (target: string, pos: number | string) => {
    const items = itemsOf(state, target);
    return (
      items !== undefined &&
      typeof pos === 'number' &&
      Number.isInteger(pos) &&
      pos >= 0 &&
      pos < items.length
    );
  };
  for (const [name, p] of Object.entries(marks.pointers)) {
    if (!inBounds(p.target, p.at)) {
      problems.push(`${at}: pointer '${name}' is out of bounds`);
    }
  }
  for (const [name, r] of Object.entries(marks.ranges)) {
    const len = itemsOf(state, r.target)?.length;
    if (
      len === undefined ||
      !Number.isInteger(r.from) ||
      !Number.isInteger(r.to) ||
      r.from < 0 ||
      r.from > r.to ||
      r.to > len
    ) {
      problems.push(`${at}: range '${name}' is out of bounds`);
    }
  }
  for (const [name, list] of Object.entries(marks.tags)) {
    for (const tag of list) {
      if (!inBounds(tag.target, tag.at)) {
        problems.push(`${at}: tag '${name}' is out of bounds`);
      }
    }
  }
}

// NOTE: JSON.stringify silently drops undefined and functions, so walk instead.
function isPlainJson(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isPlainJson);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    return (
      (proto === Object.prototype || proto === null) &&
      Object.values(value).every(isPlainJson)
    );
  }
  return false;
}

function roundTrips(trace: Trace): boolean {
  const text = JSON.stringify(trace);
  return JSON.stringify(JSON.parse(text)) === text;
}

function sortedIds(state: State): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, s] of Object.entries(state)) {
    if (s.kind === 'array') out[name] = s.items.map((i) => i.id).sort(byNumber);
  }
  return out;
}

type Counts = { compares: number; swaps: number; sets: number };

function countOperation(operation: Operation, counts: Counts) {
  const kind = operation.op;
  if (kind === 'compare' || kind === 'compareValue') counts.compares++;
  else if (kind === 'swap') counts.swaps++;
  else if (kind === 'set') counts.sets++;
}

function trackIds(
  step: Step,
  at: string,
  seen: Map<string, Set<number>>,
  problems: string[],
) {
  for (const [name, s] of Object.entries(step.state)) {
    if (s.kind !== 'array') continue;
    const ids = s.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      problems.push(`${at}: duplicate id in '${name}'`);
    }
    const known = seen.get(name) ?? new Set<number>();
    for (const id of ids) known.add(id);
    seen.set(name, known);
  }
}

function checkStats(trace: Trace, counts: Counts, problems: string[]) {
  for (const key of ['compares', 'swaps', 'sets'] as const) {
    if (trace.stats[key] !== counts[key]) {
      problems.push(
        `stats.${key} is ${trace.stats[key]}, counted ${counts[key]}`,
      );
    }
  }
  const extra = Object.keys(trace.stats).filter((k) => !(k in counts));
  if (extra.length > 0) problems.push(`unexpected stats: ${extra.join(', ')}`);
}

function checkShape(trace: Trace, problems: string[]) {
  if (!isPlainJson(trace) || !roundTrips(trace)) {
    problems.push('trace does not round-trip through JSON');
  }
  if (trace.steps[0]?.operation.op !== 'init') {
    problems.push('first step is not init');
  }
  if (trace.steps[trace.steps.length - 1]?.operation.op !== 'done') {
    problems.push('last step is not done');
  }
}

export function checkConsistency(trace: Trace): string[] {
  const problems: string[] = [];
  checkShape(trace, problems);
  const first = trace.steps[0];
  if (first === undefined) return problems;

  const counts: Counts = { compares: 0, swaps: 0, sets: 0 };
  const seen = new Map<string, Set<number>>();
  const initialIds = JSON.stringify(sortedIds(first.state));
  let sawSet = false;

  trackIds(first, 'step 0', seen, problems);
  checkMarks(first, 'step 0', problems);

  let prev = first;
  for (const [k, next] of trace.steps.entries()) {
    if (k === 0) continue;
    const at = `step ${k}`;
    countOperation(next.operation, counts);
    sawSet ||= next.operation.op === 'set';
    const expected = applyOperation(prev, next, seen, problems, at);
    if (JSON.stringify(expected) !== JSON.stringify(next.state)) {
      problems.push(
        `${at}: state is not the previous state plus the operation`,
      );
    }
    trackIds(next, at, seen, problems);
    checkMarks(next, at, problems);
    if (!sawSet && JSON.stringify(sortedIds(next.state)) !== initialIds) {
      problems.push(`${at}: ids are not a permutation of the initial ids`);
    }
    prev = next;
  }

  checkStats(trace, counts, problems);
  return problems;
}
