# Tickets, batch 1

Specs for F1, F2 and the first 10 algorithm tickets, written 2026-11-22. They follow [trace-format.md](trace-format.md). Each one becomes a ticket in the Linear Visualizer team.

---

F1 is split into four tickets. F1a, the npm and TypeScript scaffold, is done.

## F1b: Tooling and CI (S)

**Goal:** the checks every later ticket runs against.

**Already in the repo:** TypeScript 7, `strict`, `.npmrc` with `save-exact=true`, `.nvmrc`, `engines` and `scripts/check-exact-deps`. Keep them.

**Add**
- Biome 2.6.6 for both linting and formatting, with one `biome.json`.
  - The recommended rules, plus `noUndeclaredDependencies` as an error. That rule fails any import of a package that isn't in `package.json`.
  - Scripts: `lint` runs `biome lint`, `format` runs `biome format --write`, and `check` runs `biome ci`.
- Vitest 5.1.0, fast-check 4.10.2, and Stryker 10.1.1 (`@stryker-mutator/core` and `@stryker-mutator/vitest-runner`).
  - A `stryker.config.json` with the Vitest runner and `break` set to 80. Leave out the TypeScript checker plugin.
- Turn on `verbatimModuleSyntax` and `erasableSyntaxOnly` in `tsconfig.json`.
- One placeholder Vitest test, so `npm test` has something to run. Move the `check-exact-deps` tests to Vitest.

**CI** (`.github/workflows/ci.yml`, on pull requests)
- A first job works out whether code changed. A PR that changes only docs or markdown skips the other jobs, but every PR still gets a finished check result.
- Jobs: typecheck, `biome ci`, the exact-versions check, and `npm test`. Install with `npm ci`.
- A Stryker job that runs on changed files under `src/algorithms/` only, and is skipped when there are none.
- A new push to a PR cancels the checks still running on its old commit (`concurrency` with `cancel-in-progress`).

**Accepted when**
- CI is green on the PR.
- A PR that adds an import of an undeclared package fails `biome ci`. Show this in the PR evidence.
- A PR that adds a `^` version fails the exact-versions check.

---

## F1c: Trace core and tracer (M)

**Depends on:** F1b.

**Goal:** the types, tracer and registry an algorithm is written against. Everything here follows `docs/trace-format.md`.

**Types and core** (`src/trace/`)
- The `Trace`, `Step`, `Structure`, `Marks` and `Operation` types, exactly as in trace-format.md. Only `array` is implemented. The other structure kinds are declared but unused.
- `AlgorithmDef<I, R>`, which has:
  - `id`, `name` and `pseudocode: string[]`;
  - `inputFields`, a list of `{ name, kind: 'numberArray' | 'number' | 'choice', options? }` that the UI builds its form from;
  - `validate(input)`, which throws `InputError` with a readable message;
  - `setup(input)`, which returns the initial structures;
  - `run(t, input): R`, which returns the result.
- `trace(def, input, seed?) → Trace`.

**Tracer rules**
- Ids are assigned `0..n-1` by index at setup.
- `swap(i, i)` is allowed. It is recorded and counted.
- `set(i, v)` gives the slot a new, unused id. Copying with an id is out of scope.
- Every operation call (`compare`, `compareValue`, `swap`, `set`, `step`) appends exactly one step. That step carries a deep copy of the state and the current marks.
- `pointer`, `range`, `tag`, `untag`, `setVar` and `depth` (through `enter()` and `exit()`) persist until changed. They create no step of their own, so they appear on the next step.
- `line` persists until changed. `note` applies to the next step only.
- `init` comes from `trace()` before `run`. `done` comes after `run` and carries whatever marks are still pending.
- `stats` counts `compares` (both `compare` and `compareValue`), `swaps` and `sets`.
- These throw errors:
  - an index out of bounds (`RangeError`);
  - a mark on an unknown structure, or a mark out of bounds;
  - more than 10,000 steps (`TraceLimitExceeded`);
  - a `run` that throws.

**Registry** (`src/algorithms/index.ts`)
- An ordered list of defs.
- A fixtures group holds `demo-swap`, a 5-item array that does compares, swaps, every mark type, a note and `depth`. The menu hides that group unless `?fixtures` is in the URL.

**Accepted when**
- Each tracer rule above has its own Vitest test, through `trace()`.
- The Stryker score on `src/trace/` is at least 80%.
- CI is green on the PR.

---

## F1d: Test contract and consistency checker (M)

**Depends on:** F1c.

**Goal:** the one call each algorithm test makes, so that each later ticket is two files plus a registry line.

**Test contract** (`test/contract.ts`)
- Each algorithm test calls `algorithmContract(def, spec)` once. `spec` has these fields:
  - `arbitrary` (a fast-check input generator);
  - `check(input, result)` (correctness against a reference);
  - `guarantee(step, ctx)` (`ctx` holds the input, the step index and the previous step);
  - `bounds(trace, input)`;
  - `examples` (edge-case inputs that are always run);
  - `pinned` (`{ input, stats, result? }` exact snapshots).
- It generates tests for contract items 1–4 in trace-format.md, with 200 fast-check runs.
- Generators: `numberArrays({ min: 0, max: 64, lo: -99, hi: 99 })` and `sortedNumberArrays(...)`.

**Consistency checker** (contract item 2), `checkConsistency(trace)`:
- applying each operation to the previous state reproduces the next snapshot;
- ids are unique within each structure (a permutation when no `set` happened);
- marks are within bounds;
- the trace round-trips through JSON;
- `init` comes first and `done` last;
- the `stats` match the counted operations.

**Accepted when**
- `demo-swap` passes `algorithmContract`.
- The consistency checker catches each case in a set of hand-broken traces: a wrong snapshot, a duplicate id, an out-of-bounds mark, a missing `done`, and wrong `stats`. Each is its own test.
- CI is green on the PR.

---

## F2: Renderer and player (M)

**Depends on:** F1d.

**App:** Vite plus React. It deploys to GitHub Pages from `main`.

**Renderer**
- The renderer is a pure function `renderStep(trace, i)` that returns SVG with no internal state.
- **Array view:**
  - Bars are scaled to the value, with a zero baseline so negative values hang below it. Each bar is labeled with its value.
  - Pointers are labeled arrows under their item.
  - Ranges are labeled bands behind the bars.
  - Tags are fill colors, with a legend.
  - The operation is highlighted: the two items being compared are outlined, the two being swapped are emphasized, and a set item flashes.
- **Side panels:**
  - vars, as a key/value list;
  - the note, in an `aria-live` region;
  - the pseudocode, with `line` highlighted;
  - `depth`, shown as indentation or a badge;
  - `stats` so far.

**Player**
- Controls: play/pause, step back/forward, first/last, a scrubber (range input), speed (0.5×, 1×, 2×, 4×) and a "12 / 87" counter.
- Keys: Space, ← → and Home/End.
- Between steps, items animate by id using FLIP over 200 ms ÷ speed. There is no animation under `prefers-reduced-motion`.

**Input**
- The algorithm picker comes from the registry. The input form comes from `inputFields`, and numbers are comma-separated.
- A "Random" button uses a shown seed.
- `validate` errors show inline. An invalid input never produces a trace.

**URL state**
- The URL carries `?alg=&input=&seed=&step=`, so any step can be shared. This is useful for PR review and the portfolio.

**Theme:** light and dark, from `prefers-color-scheme`, with a toggle.

**Accepted when**
- There are Playwright screenshots of `demo-swap` at its first, middle and last steps. Each is taken in light and dark themes at 1280 px and 390 px widths.
- There are interaction tests for each control and key, URL round-tripping, the validation error display, and reduced motion.
- No horizontal scroll at 390 px.
- The Pages deploy works.

---

## Rules for every algorithm ticket (1–10)

- **Depends on:** F1d and F2.
- **Files:**
  - `src/algorithms/<id>.ts`, which exports the def;
  - `src/algorithms/<id>.test.ts`, which calls `algorithmContract`;
  - one registry line;
  - one Playwright screenshot at a middle step, in light theme at 1280 px.
- **Pseudocode** follows the code's structure line for line, and every step points at a `line`.
- **Input:** unless stated otherwise, `values` holds 0–64 integers in the range −99 to 99.
- **Stryker:** at least 80% on the algorithm file.
- **No new operation types or structure kinds.** If a ticket seems to need one, stop and comment instead.

---

## 1. Linear search (S)

```
Input: values: number[], target: number
Result: index of the first item equal to target, or -1.
One step means: each compareValue of a[i] against target.
Marks: pointer i (scan), range 'checked' [0, i), var target.
Guarantees: at every step, no item in 'checked' equals target; the array is never modified.
Edge cases: empty, target at index 0, target at the last index, target absent, duplicates (returns the first).
Bounds: compares = result + 1 if found, n if absent (exact).
Check: result === values.indexOf(target).
```

## 2. Binary search, leftmost (S)

```
Input: values: number[] sorted ascending (validate rejects unsorted; generator uses sortedNumberArrays), target: number
Result: index of the first item equal to target, or -1.
Algorithm: lo = 0, hi = n; while lo < hi: mid = floor((lo+hi)/2); if a[mid] < target then lo = mid+1 else hi = mid.
           Then if lo < n and a[lo] == target return lo, else -1.
One step means: each compareValue(mid, target) in the loop, plus the final compareValue(lo, target).
Marks: range 'candidates' [lo, hi) (not pointers: hi can be n), pointer mid, var target.
Guarantees: every item before 'candidates' is < target; every item after it is >= target; the array is never modified.
Edge cases: empty, 1 item, target below all, target above all, all equal to target (returns 0), runs of duplicates.
Bounds: compares <= ceil(log2(n + 1)) + 1; 0 when n = 0.
Check: result === values.indexOf(target).
```

## 3. Reverse in place (S)

```
Input: values: number[]
Result: the reversed array.
Algorithm: i = 0, j = n-1; while i < j: swap(i, j); i++; j--.
One step means: each swap.
Marks: pointers i and j (cleared when i >= j), ranges 'done-left' [0, i) and 'done-right' (j, n).
Guarantees: every position in a done range holds the item whose id was at its mirror position n-1-p in the input.
Edge cases: empty, 1 item, 2 items, odd length, even length.
Bounds: swaps = floor(n/2) (exact); compares = 0.
Check: result equals values.toReversed(); final ids are [n-1, ..., 0].
```

## 4. Bubble sort, early exit (S)

```
Input: values: number[]
Result: the sorted array.
Algorithm: for end from n down to 2: swapped = false; for i from 0 to end-2: if a[i] > a[i+1] then swap, swapped = true.
           After the pass, the 'sorted' range grows to [end-1, n); if not swapped, set 'sorted' to [0, n) and stop.
One step means: each compare(i, i+1) and each swap.
Marks: pointer i, range 'sorted' [end, n), var swapped.
Guarantees: at every step, 'sorted' is sorted and every item in it >= every item before it.
Edge cases: empty, 1 item, already sorted (one pass), reverse-sorted, all equal, duplicates.
Bounds: compares <= n(n-1)/2; swaps = number of inversions (exact).
Pinned: [5, 1, 4, 2, 8] → compares 9, swaps 4.
Check: result equals values.toSorted((x, y) => x - y).
```

## 5. Selection sort (S)

```
Input: values: number[]
Result: the sorted array.
Algorithm: for i from 0 to n-2: min = i; for j from i+1 to n-1: if a[j] < a[min] then min = j; if min != i then swap(i, min).
One step means: each compare(j, min) and each swap.
Marks: pointers i, j, min; range 'sorted' [0, i).
Guarantees: at every step, 'sorted' is sorted and every item in it <= every item after it.
Edge cases: empty, 1 item, already sorted (zero swaps), reverse-sorted, all equal, duplicates.
Bounds: compares = n(n-1)/2 (exact); swaps <= n-1.
Pinned: [64, 25, 12, 22, 11] → compares 10, swaps 3.
Check: result equals values.toSorted((x, y) => x - y).
```

## 6. Insertion sort, adjacent swaps (S)

```
Input: values: number[]
Result: the sorted array.
Algorithm: for i from 1 to n-1: j = i; while j > 0 and a[j-1] > a[j]: swap(j-1, j); j--.
           (Swap variant on purpose: the shift variant duplicates an id, which the consistency check rejects.)
One step means: each compare(j-1, j) and each swap.
Marks: pointer 'key' at j (the item being inserted), range 'sorted' [0, i) set at the start of each outer pass, [0, n) at done.
Guarantees: at every step, the items in [0, i] other than the one at 'key' are sorted (with 'key' cleared: 'sorted' is sorted).
Edge cases: empty, 1 item, already sorted (zero swaps), reverse-sorted, all equal, duplicates (stable: equal ids keep their order).
Bounds: swaps = number of inversions (exact); inversions <= compares <= inversions + n - 1.
Check: result equals values.toSorted((x, y) => x - y); for equal values, final ids are in increasing order.
```

## 7. Pair sum, two pointers (S)

```
Input: values: number[] sorted ascending (validate rejects unsorted), target: number (-198..198)
Result: [lo, hi] with lo < hi and a[lo] + a[hi] == target, or null.
Algorithm: lo = 0, hi = n-1; while lo < hi: compare a[lo] with target - a[hi]; equal → return; less → lo++; greater → hi--.
One step means: each compareValue(lo, target - a[hi]), whose note reads "a[lo] + a[hi] = s vs target".
Marks: pointers lo and hi, vars target and sum.
Guarantees: no pair (p, q) with p < q and (p < lo or q > hi) sums to target; the array is never modified.
Edge cases: empty, 1 item, no pair, the pair at both ends, duplicates ([3, 3] with target 6), negatives.
Bounds: compares <= n - 1; 0 when n < 2.
Check: if null, brute force finds no pair; otherwise the pair is valid.
```

## 8. Three-way partition (Dutch national flag) (S)

```
Input: values: number[], pivot: number. The UI preset is values from {0, 1, 2} with pivot 1.
Result: the partitioned array (items < pivot, then == pivot, then > pivot).
Algorithm: low = 0, mid = 0, high = n-1; while mid <= high: r = compareValue(mid, pivot);
           r < 0 → swap(low, mid), low++, mid++; r == 0 → mid++; r > 0 → swap(mid, high), high--.
           Self-swaps are allowed and recorded.
One step means: each compareValue and each swap.
Marks: ranges 'less' [0, low), 'equal' [low, mid), 'unknown' [mid, high+1), 'greater' [high+1, n) (ranges, not pointers: high can be -1);
       pointer mid while mid <= high; var pivot.
Guarantees: the four ranges tile [0, n); each of 'less', 'equal' and 'greater' holds only matching items.
Edge cases: empty, 1 item, all < pivot, all > pivot, all == pivot, pivot not present.
Bounds: compares = n (exact); swaps <= n.
Check: the result is a permutation of the input, in the less/equal/greater order.
```

## 9. Maximum subarray (Kadane) (S)

```
Input: values: number[]
Result: { sum, from, to } for the non-empty subarray [from, to) with the largest sum, or null for empty input.
Algorithm: cur = best = a[0]; start = 0; for i from 1 to n-1: if cur < 0 then cur = a[i], start = i else cur += a[i];
           if cur > best then best = cur, best range = [start, i+1). Ties keep the earliest.
One step means: one t.step() per index (i = 0 included), after cur and best are updated. There are no compares; reads are silent.
Marks: pointer i, range 'current' [start, i+1), range 'best', vars cur and best.
Guarantees: cur = the sum of 'current'; best = the sum of 'best'; best = the maximum subarray sum of a[0..i].
Edge cases: empty (null; only init and done), 1 item, all negative (the largest single item), all zero, alternating signs.
Bounds: steps = n + 2 (exact); compares = 0; swaps = 0.
Check: sum equals the brute-force maximum; the values in [from, to) sum to it; the array is never modified.
```

## 10. Quicksort, Lomuto partition (S)

```
Input: values: number[], pivotChoice: 'last' | 'random' (default 'last'; random uses t.rng and the trace seed)
Result: the sorted array.
Algorithm: sort(lo, hi) with hi inclusive. If lo >= hi: tag the item at lo 'placed' when lo == hi, then return.
           'random' first swaps a random index in [lo, hi] into hi. pivot = a[hi]; i = lo;
           for j from lo to hi-1: if compare(j, hi) <= 0 then swap(i, j), i++. Then swap(i, hi), tag i 'placed',
           then recurse on (lo, i-1) and (i+1, hi). Use t.enter() and t.exit() around each call.
One step means: each compare and each swap.
Marks: range 'part' [lo, hi+1), pointers i, j and pivot (at hi), range 'le' [lo, i), tag 'placed', var pivotValue.
Guarantees: within 'part', the items in [lo, i) are <= pivotValue and the items in [i, j) are > pivotValue;
            every 'placed' item has the value that sorted(input) has at that position; depth <= n.
Edge cases: empty, 1 item, already sorted (worst case for 'last'), reverse-sorted, all equal, duplicates.
Bounds: compares <= n(n-1)/2; the same seed gives an identical trace.
Check: result equals values.toSorted((x, y) => x - y); with pivotChoice 'random', it is correct for many seeds.
```
