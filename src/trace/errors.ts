/** Thrown by `validate` when the input is unusable; the message is shown to the user. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

/** Thrown when a run would record more steps than a trace may hold. */
export class TraceLimitExceeded extends Error {
  constructor(limit: number) {
    super(`The trace would exceed ${limit} steps`);
    this.name = 'TraceLimitExceeded';
  }
}
