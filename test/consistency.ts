import type { Item, State, Step, Trace } from '../src/trace/index.js';

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

// NOTE: `seen` tracks all past ids, since a `set` must mint an id never used.
function applyOperation(
  prev: Step,
  next: Step,
  seen: Map<string, Set<number>>,
  problems: string[],
  at: string,
): State {
  const expected = structuredClone(prev.state);
  const op = next.operation;
  if (op.op === 'init') {
    problems.push(`${at}: 'init' after step 0`);
    return expected;
  }
  if (op.op === 'mark' || op.op === 'done') return expected;
  const items = itemsOf(expected, op.target);
  if (items === undefined) {
    problems.push(`${at}: unknown array '${op.target}'`);
    return expected;
  }
  const slot = (i: number) => (Number.isInteger(i) ? items[i] : undefined);
  if (op.op === 'compare' || op.op === 'compareValue') {
    const a = slot(op.i);
    const b = op.op === 'compare' ? slot(op.j) : { value: op.value };
    if (a === undefined || b === undefined) {
      problems.push(`${at}: ${op.op} index out of bounds`);
    } else if (sign(a.value - b.value) !== op.result) {
      problems.push(`${at}: ${op.op} result ${op.result} is wrong`);
    }
  } else if (op.op === 'swap') {
    const a = slot(op.i);
    const b = slot(op.j);
    if (a === undefined || b === undefined) {
      problems.push(`${at}: swap index out of bounds`);
    } else {
      items[op.i] = b;
      items[op.j] = a;
    }
  } else {
    const old = slot(op.i);
    if (old === undefined) {
      problems.push(`${at}: set index out of bounds`);
    } else {
      if (old.value !== op.prev) {
        problems.push(`${at}: set prev ${op.prev} but slot held ${old.value}`);
      }
      const id = itemsOf(next.state, op.target)?.[op.i]?.id;
      if (id === undefined || seen.get(op.target)?.has(id)) {
        problems.push(`${at}: set did not give the slot a new id`);
      } else {
        items[op.i] = { id, value: op.value };
      }
    }
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

export function checkConsistency(trace: Trace): string[] {
  const problems: string[] = [];
  const { steps } = trace;

  if (!isPlainJson(trace) || !roundTrips(trace)) {
    problems.push('trace does not round-trip through JSON');
  }
  if (steps[0]?.operation.op !== 'init') {
    problems.push('first step is not init');
  }
  if (steps.at(-1)?.operation.op !== 'done') {
    problems.push('last step is not done');
  }
  const first = steps[0];
  if (first === undefined) return problems;

  const counts = { compares: 0, swaps: 0, sets: 0 };
  const seen = new Map<string, Set<number>>();
  const initialIds = JSON.stringify(sortedIds(first.state));
  let sawSet = false;

  const trackIds = (step: Step, at: string) => {
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
  };

  trackIds(first, 'step 0');
  checkMarks(first, 'step 0', problems);

  let prev = first;
  for (const [k, next] of steps.entries()) {
    if (k === 0) continue;
    const at = `step ${k}`;
    const op = next.operation.op;
    if (op === 'compare' || op === 'compareValue') counts.compares++;
    else if (op === 'swap') counts.swaps++;
    else if (op === 'set') {
      counts.sets++;
      sawSet = true;
    }
    const expected = applyOperation(prev, next, seen, problems, at);
    if (JSON.stringify(expected) !== JSON.stringify(next.state)) {
      problems.push(
        `${at}: state is not the previous state plus the operation`,
      );
    }
    trackIds(next, at);
    checkMarks(next, at, problems);
    if (!sawSet && JSON.stringify(sortedIds(next.state)) !== initialIds) {
      problems.push(`${at}: ids are not a permutation of the initial ids`);
    }
    prev = next;
  }

  for (const key of ['compares', 'swaps', 'sets'] as const) {
    if (trace.stats[key] !== counts[key]) {
      problems.push(
        `stats.${key} is ${trace.stats[key]}, counted ${counts[key]}`,
      );
    }
  }
  const extra = Object.keys(trace.stats).filter((k) => !(k in counts));
  if (extra.length > 0) problems.push(`unexpected stats: ${extra.join(', ')}`);
  return problems;
}
