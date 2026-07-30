/**
 * Phase 0 marker. Every stub throws this rather than returning a plausible
 * empty value — a stub that silently returns `[]` or `true` is the kind of thing
 * that gets built on for a week before anyone notices it was never real.
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet — see Phase 1 in ROADMAP.md`);
    this.name = 'NotImplementedError';
  }
}
