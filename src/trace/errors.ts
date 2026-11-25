export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export class TraceLimitExceeded extends Error {
  constructor(limit: number) {
    super(`The trace would exceed ${limit} steps`);
    this.name = 'TraceLimitExceeded';
  }
}
