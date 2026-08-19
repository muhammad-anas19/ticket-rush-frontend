import { ApiError } from './ApiError';

/**
 * Reads the message the backend actually sent. Does not rewrite it.
 *
 * The rule for this project: **the frontend never invents or reworks an error message.** Every
 * message a user sees for a failed request is the string the API returned, verbatim.
 *
 * That is not laziness — it is putting the decision in one place. The backend already decides what
 * is safe to say: `/auth/login` returns a deliberately generic "Invalid email or password" for both
 * a wrong password and an unregistered address, and it pays for a full bcrypt comparison on the
 * unknown-email path so the response TIME does not leak the difference either. When the frontend
 * substituted its own wording it was duplicating a security decision the API owns — and the two
 * could drift, so that the backend tightens a message and the UI keeps showing the old one.
 *
 * Corollary: if a message reads badly to a user, that is a BACKEND bug to fix in the DTO or the
 * exception, not something to paper over here.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Field-level messages from the backend's ValidationPipe — "email must be a valid email
    // address", one per failed constraint. Joined, not summarised: every one is shown.
    if (error.fieldErrors?.length) {
      return error.fieldErrors.join('. ');
    }
    // For a network failure (status 0) this is axios's own text, since no backend was reached to
    // provide one. Still not rewritten — just the truest thing available.
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // Something threw a non-Error. Nothing to read, so this is the only place a literal string is
  // produced — and reaching it means a bug worth finding rather than a message worth polishing.
  return 'Request failed';
}
