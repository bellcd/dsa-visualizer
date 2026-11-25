export type Item = { id: number; value: number };

export type Structure =
  | { kind: 'array'; items: Item[] }
  // Declared for later versions, not implemented by the tracer yet.
  | {
      kind: 'graph';
      directed: boolean;
      nodes: { id: string; label?: string }[];
      edges: { id: string; from: string; to: string; weight?: number }[];
    }
  | {
      kind: 'tree';
      root: string | null;
      nodes: { id: string; value: number; left?: string; right?: string }[];
    }
  | {
      kind: 'table';
      rows: { key: string; value: number | string | null }[];
    };

export type VarValue = number | string | boolean | null;

export type Marks = {
  pointers: Record<string, { target: string; at: number | string }>;
  ranges: Record<string, { target: string; from: number; to: number }>;
  tags: Record<string, { target: string; at: number | string; tag: string }[]>;
  vars: Record<string, VarValue>;
};

export type Operation =
  | { op: 'init' }
  | { op: 'compare'; target: string; i: number; j: number; result: -1 | 0 | 1 }
  | {
      op: 'compareValue';
      target: string;
      i: number;
      value: number;
      result: -1 | 0 | 1;
    }
  | { op: 'swap'; target: string; i: number; j: number }
  | { op: 'set'; target: string; i: number; value: number; prev: number }
  | { op: 'mark' }
  | { op: 'done' };

export type Step = {
  operation: Operation;
  state: Record<string, Structure>;
  marks: Marks;
  line?: number;
  note?: string;
  depth?: number;
};

export type Trace = {
  version: 1;
  algorithm: { id: string; name: string; pseudocode: string[] };
  input: Record<string, unknown>;
  seed?: number;
  steps: Step[];
  result: unknown;
  stats: Record<string, number>;
};

export type InputField = {
  name: string;
  kind: 'numberArray' | 'number' | 'choice';
  options?: string[];
};
