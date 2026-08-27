import { ApiError } from './ApiError';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors?.length) {
      return error.fieldErrors.join('. ');
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}
