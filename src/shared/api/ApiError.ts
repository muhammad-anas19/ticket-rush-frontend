/**
 * One error type for every failure, so UI code has exactly one shape to handle.
 *
 * Without this, components branch on axios internals — `error.response?.data?.message`,
 * `error.request`, `error.message` — and each one gets it slightly differently. The
 * normalisation happens once, in the axios interceptor.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the server. */
    public readonly status: number,
    /** Field-level validation messages from the backend, when present. */
    public readonly fieldErrors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Distinguishes "the server said no" from "the server was never reached". They need
   * different UI: a validation error is the user's to fix, a network failure gets a retry
   * button. Collapsing both into "something went wrong" is how you get a retry button on a
   * 422.
   */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
