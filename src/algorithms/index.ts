import type { AlgorithmDef } from '../trace/index.js';
import { demoSwapDef } from './fixtures/demo-swap.js';

export type AnyAlgorithmDef = AlgorithmDef<never, unknown>;

export type AlgorithmGroup = {
  name: string;
  // NOTE: Hidden groups show in the menu only when `?fixtures` is in the URL.
  hidden: boolean;
  defs: AnyAlgorithmDef[];
};

export const registry: AlgorithmGroup[] = [
  { name: 'Algorithms', hidden: false, defs: [] },
  { name: 'Fixtures', hidden: true, defs: [demoSwapDef] },
];

export function showFixtures(search: string): boolean {
  return new URLSearchParams(search).has('fixtures');
}

export function menuGroups(search: string): AlgorithmGroup[] {
  const fixtures = showFixtures(search);
  return registry.filter((group) => fixtures || !group.hidden);
}
