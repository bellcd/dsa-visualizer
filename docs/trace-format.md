# Visualizer trace format, v1 (draft 2026-11-22)

This is a draft for the DSA visualizer, the factory's first project. It moves into the visualizer's own public repo once that exists. It contains nothing private.

## Decided

| Question | Decision |
|---|---|
| What a step holds | The **event** (what just happened) **plus a full snapshot** of the state after it, plus marks and a note. The renderer is stateless: `render(trace, i)`. |
| How algorithms produce it | A **tracer helper**. Algorithms call `t.compare`, `t.swap` and so on, and the tracer records the event and snapshot. Algorithms never build step objects by hand. |
| Who writes algorithms | **The factory writes them all.** You write the specs and review PRs as an interviewer would. |
| Stack | **TypeScript everywhere.** Traces are generated live in the browser, so users can type their own input. Vitest for unit tests, fast-check for property tests, Stryker for mutation tests, Playwright for screenshots. |

## Defaults I chose (overrule any of them)

1. **A snapshot holds several named structures, starting in v1.** `state` is a map from a name to a structure, such as `{ a: array, buf: array }`. Every event names its `target`. Sorting an array uses only `a`. Merge sort, counting sort, heap sort (array plus a tree view) and Dijkstra (a graph, a queue and a distance table) need more than one structure. Adding this later would break every trace.
2. **Items have stable ids.** An array item is `{ id, value }`, not a bare value. That lets the renderer animate a swap even when values repeat (FLIP between snapshots).
3. **Marks attach to the next event.** Setting a pointer, range, tag, variable, note or pseudocode line doesn't create a step of its own. These changes wait and are folded into the next recorded event. `t.step()` flushes them explicitly, for a "look at this" step that has no operation.
4. **Reads aren't events.** `t.get(i)` is silent, because reads are noise in playback. Comparisons are events, because they are what the lesson is about.
5. **Every algorithm has numbered pseudocode lines,** and each step can point at one (`line`). The renderer highlights that line. Quiz mode can later ask "what's the next line?"
6. **Algorithms are deterministic.** A randomized algorithm takes `t.rng`, which is seeded from the trace's `seed`.
7. **A trace is capped at 10,000 steps.** Past that, the tracer throws `TraceLimitExceeded`. The UI caps input at 64 items for arrays and 30 nodes for graphs.
8. **A trace is plain JSON:** no `Map`, no `undefined`, no functions. A test round-trips every trace through `JSON.stringify` and `JSON.parse`.

## Shape

```ts
type Trace = {
  version: 1;
  algorithm: { id: string; name: string; pseudocode: string[] };
  input: Record<string, unknown>;          // e.g. { values: [5, 1, 4] }
  seed?: number;
  steps: Step[];                            // steps[0] is the 'init' event
  result: unknown;                          // e.g. the sorted array, or a found index (or -1)
  stats: Record<string, number>;            // e.g. { compares: 10, swaps: 4 }
};

type Step = {
  event: Event;
  state: Record<string, Structure>;         // full snapshot after the event
  marks: Marks;                             // full marks after the event (not a diff)
  line?: number;                            // index into pseudocode
  note?: string;                            // e.g. "9 > 4, swap"
  depth?: number;                           // recursion depth, for merge sort and quicksort
};

type Structure =
  | { kind: 'array'; items: { id: number; value: number }[] }
  // v2+, sketched so v1 doesn't paint us into a corner:
  | { kind: 'graph'; directed: boolean; nodes: { id: string; label?: string }[];
      edges: { id: string; from: string; to: string; weight?: number }[] }
  | { kind: 'tree'; root: string | null; nodes: { id: string; value: number; left?: string; right?: string }[] }
  | { kind: 'table'; rows: { key: string; value: number | string | null }[] };  // e.g. distances

type Marks = {
  pointers: Record<string, { target: string; at: number | string }>;   // i, j, lo, hi, pivot
  ranges:   Record<string, { target: string; from: number; to: number }>; // [from, to), e.g. sorted suffix
  tags:     Record<string, { target: string; at: number | string; tag: string }[]>; // e.g. visited
  vars:     Record<string, number | string | boolean | null>;        // e.g. key, pivotValue, best
};
```

### Array events (v1)

| op | fields | meaning |
|---|---|---|
| `init` | n/a | Initial state. Always `steps[0]`. |
| `compare` | `target, i, j, result` (-1, 0 or 1) | Compares two items. |
| `compareValue` | `target, i, value, result` | Compares an item with a held value (a pivot, a key, a search target). |
| `swap` | `target, i, j` | Swaps two items. |
| `set` | `target, i, value, prev` | Writes a value. The slot gets a new id. Copying an item with its id comes with the multi-structure tickets. |
| `mark` | n/a | Marks or a note changed with no operation (`t.step()`). |
| `done` | n/a | The final step. |

Graph, tree and table events (`visit`, `relax`, `enqueue`, `insert` and so on) arrive with the first M ticket that needs them.

## Tracer API (array)

```ts
function bubbleSort(t: ArrayTracer) {
  const a = t.array('a');
  for (let end = a.length; end > 1; end--) {
    t.range('sorted', 'a', end, a.length);
    for (let i = 0; i + 1 < end; i++) {
      t.pointer('i', 'a', i); t.line(2);
      if (a.compare(i, i + 1) > 0) { t.line(3); a.swap(i, i + 1); }
    }
  }
  return a.values();
}

export const bubbleSortDef: AlgorithmDef<{ values: number[] }> = {
  id: 'bubble-sort',
  name: 'Bubble sort',
  pseudocode: ['for end from n down to 2', '  for i from 0 to end-2', '    if a[i] > a[i+1]', '      swap a[i], a[i+1]'],
  inputFields: [{ name: 'values', kind: 'numberArray' }],
  validate: () => {},
  setup: (input) => ({ a: input.values }),
  run: bubbleSort,                        // run returns the result
};
```

`ArrayTracer` gives you `array(name)`. That returns `length`, `get(i)`, `compare(i, j)`, `compareValue(i, v)`, `swap(i, j)`, `set(i, v)` and `values()`. The tracer itself has `pointer`, `range`, `tag`, `untag`, `setVar`, `line`, `note`, `step`, `rng` and `depth` (with `enter()` and `exit()`). Passing `null` to `pointer` or `range` clears the mark.

Pass an `AlgorithmDef` to `trace(def, input, seed?)` to get a `Trace`. A registry lists all the defs. The UI builds its algorithm menu from the registry.

## Test contract (every algorithm ticket must pass all five)

1. **The result is correct.** fast-check generates inputs (including empty arrays, one item, duplicates, already-sorted and reverse-sorted), and the result is checked against a reference such as `toSorted` or `indexOf`.
2. **The trace is consistent.** This generic test is written once, in the foundation ticket. Applying each event to the previous snapshot must reproduce the next snapshot. Ids are preserved (a permutation stays a permutation). Every mark points inside the bounds of its structure. The trace round-trips through JSON. `steps[0]` is `init` and the last step is `done`.
3. **Algorithm-specific invariants hold on every step.** These come from your spec. For bubble sort, at every step the `sorted` range is sorted and holds the largest items.
4. **Counts stay within bounds.** `stats` must not exceed the textbook bound for the input. For bubble sort that's `compares ≤ n(n-1)/2`. Known small inputs are pinned to exact counts with snapshot tests.
5. **The mutation score is at least 80%** on the algorithm file (Stryker, run in CI on the changed files).

The renderer is tested separately: Playwright screenshots at fixed steps of fixed traces, in both light and dark themes.

## What a ticket spec looks like (what you write)

```
Algorithm: Linear search        Size: S
Input: values: number[] (0..64 items, -99..99), target: number
Result: index of the first item equal to target, or -1.
One step means: each compareValue of a[i] against target.
Marks: pointer i (scan), range 'checked' [0, i), var target.
Invariants: at every step, no item in 'checked' equals target; the array is never modified.
Edge cases: empty, target at index 0, target at the last index, target absent, duplicates (returns the first).
Bounds: compares = result + 1 if found, n if absent (exact).
```

## Build order

**Foundation (M, M):**
- **F1:** types, `ArrayTracer`, `trace()`, the registry, the generic consistency test (contract item 2), and the JSON schema check.
- **F2:** an SVG bar renderer with play, pause and step controls, a scrubber, and the pseudocode panel; Playwright screenshot setup.

**The first ~10 S tickets (array only, one structure):**
1. Linear search
2. Binary search
3. Reverse in place
4. Bubble sort
5. Selection sort
6. Insertion sort
7. Two-pointer pair sum (sorted input)
8. Dutch national flag (3-way partition)
9. Kadane's maximum subarray (uses `vars` and `ranges`)
10. Quicksort, Lomuto partition (`depth`, seeded pivot as a variant)

**Next (S/M, multi-structure):** counting sort (`a` plus `count`), merge sort (`a` plus `buf`, recursion), then heap sort (an array plus a tree view of the same items). Graph algorithms (BFS, DFS, Dijkstra) are the first M batch. Each one adds its structure's events and renderer.

**Later (L):** side-by-side comparison of two traces on the same input, quiz mode (predict the next event or line), and the HTML-in-Canvas renderer spike behind a feature check.
