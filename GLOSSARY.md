# dsa-visualizer

## Recording

**Algorithm**:
One visualizable procedure, such as bubble sort or binary search, with its name, pseudocode, input fields and the code that runs it.
_Avoid_: Def, visualization

**Trace**:
The complete record of one algorithm run on one input: every step, the result and the stats.
_Avoid_: Recording, log, history

**Tracer**:
The recorder an algorithm runs against. The algorithm performs operations through it, and the tracer turns each one into a step.
_Avoid_: Recorder, logger

**Step**:
One moment of playback: an operation, the state after it, the marks, and optionally a pseudocode line and a note.
_Avoid_: Frame, tick

**Operation**:
What a step shows the algorithm doing, such as a compare, a swap or a set.
_Avoid_: Event, action, op (outside code)

**State**:
The full contents of every structure after a step's operation.
_Avoid_: Snapshot, frame

**Structure**:
One named thing an algorithm works on, such as the array `a` or a buffer `buf`. A state holds one or more.
_Avoid_: Data, container

**Item**:
One element of an array structure: a value with an id that follows it through swaps, so equal values stay distinguishable.

**Mark**:
Something drawn over the structures to point a part out: a pointer, a range, a tag or a variable.
_Avoid_: Highlight, annotation

**Note**:
A short explanation attached to a single step, such as "9 > 4, swap".
_Avoid_: Caption, comment

**Stats**:
Counts of operations over a whole trace, such as compares and swaps.
_Avoid_: Metrics, counters

## Specifying and testing

**Spec**:
The description of one algorithm ticket: input, result, what one step means, marks, guarantees, edge cases and bounds.
_Avoid_: Requirements, brief

**Guarantee**:
A property of one algorithm that holds at every step of every trace, such as "the sorted range holds the largest items". Stricter than a loop invariant, which holds only at the start of each iteration.
_Avoid_: Invariant

**Bound**:
The most operations an algorithm may count for an input, usually the textbook figure, such as at most n(n-1)/2 compares for bubble sort.
_Avoid_: Limit, budget

**Test contract**:
The five checks every algorithm passes: correct result, consistent trace, guarantees, bounds, and a mutation score of at least 80%.

**Consistent trace**:
A trace in which applying each operation to the previous state reproduces the next state exactly.

## Playing back

**Registry**:
The ordered list of algorithms the visualizer offers. The menu is built from it.
_Avoid_: Catalog, index

**Renderer**:
The part that draws one step of a trace. It holds no state of its own between steps.
_Avoid_: View, player
