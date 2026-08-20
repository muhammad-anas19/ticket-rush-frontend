import * as yup from 'yup';

/**
 * Client validation is UX, never a security control — every rule here is enforced again by the backend's
 * DTO, because anyone can bypass this with curl. The point is instant feedback without a round trip.
 *
 * The rules mirror `CreateEventDto` deliberately. A mismatch means either a field the UI accepts and the
 * API rejects (a 400 the form cannot attribute to any field) or the reverse (a rule that silently does
 * nothing).
 *
 * Note the form works in **major units** — the user types `19.99` — and converts to integer cents at
 * submit. That conversion is the one boundary where money changes representation, and it lives in
 * `shared/lib/money.ts` with a single tested implementation.
 */
export const createEventSchema = yup.object({
  title: yup
    .string()
    .required('Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),

  description: yup.string().max(5000, 'Description must be at most 5000 characters').default(''),

  venue: yup
    .string()
    .required('Venue is required')
    .min(3, 'Venue must be at least 3 characters')
    .max(200, 'Venue must be at most 200 characters'),

  /**
   * `datetime-local` gives a string with NO timezone — `2026-09-01T20:00`. That is genuinely ambiguous:
   * it means 8pm wherever the user happens to be.
   *
   * The form treats it as the user's LOCAL wall time (which is what they meant when they typed it) and
   * converts to a UTC ISO string at submit via `new Date(value).toISOString()`. Sending the bare string
   * would make Postgres guess using the SERVER's timezone — so it would work on a laptop in Karachi and
   * be five hours wrong on a UTC production host.
   */
  startsAtLocal: yup
    .string()
    .required('Start date and time is required')
    .test('is-future', 'The event must start in the future', (value) => {
      if (!value) return false;
      return new Date(value).getTime() > Date.now();
    }),

  /**
   * Entered in MAJOR units — dollars — because asking a human to type 1999 for $19.99 guarantees
   * mistakes. Converted to integer cents at submit.
   *
   * Two decimal places max, enforced here rather than left to rounding: if someone types `19.999` the
   * conversion would silently round to 2000 and charge a cent more than they intended. Better to reject
   * and let them decide.
   */
  priceMajor: yup
    .number()
    .typeError('Price must be a number')
    .required('Price is required')
    .min(0, 'Price cannot be negative')
    .max(21_474_836, 'Price is implausibly high')
    .test('two-decimals', 'Price can have at most 2 decimal places', (value) =>
      value === undefined ? true : Number.isInteger(Math.round(value * 100)),
    ),

  totalTickets: yup
    .number()
    .typeError('Capacity must be a number')
    .required('Capacity is required')
    .integer('Capacity must be a whole number')
    .min(1, 'There must be at least 1 ticket')
    .max(1_000_000, 'Capacity is implausibly high'),
});

export type CreateEventValues = yup.InferType<typeof createEventSchema>;
