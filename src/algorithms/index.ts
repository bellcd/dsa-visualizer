import type { AlgorithmDef } from '../trace/index.js';
import { demoSwapDef } from './fixtures/demo-swap.js';

export type AnyAlgorithmDef = AlgorithmDef<never, unknown>;

export type AlgorithmGroup = {
  name: string;
  /** Shown in the menu only when `?fixtures` is in the URL. */
  hidden: boolean;
  defs: AnyAlgorithmDef[];
};

/** The ordered list of algorithms the visualizer offers. */
export const registry: AlgorithmGroup[] = [
  { name: 'Algorithms', hidden: false, defs: [] },
  { name: 'Fixtures', hidden: true, defs: [demoSwapDef] },
];

/** True when the URL query string contains `fixtures`. */
export function showFixtures(search: string): boolean {
  return new URLSearchParams(search).has('fixtures');
}

/** The groups the menu shows for a given URL query string. */
export function menuGroups(search: string): AlgorithmGroup[] {
  const fixtures = showFixtures(search);
  return registry.filter((group) => fixtures || !group.hidden);
}
