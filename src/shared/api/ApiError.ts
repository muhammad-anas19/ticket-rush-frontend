export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

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
