import * as yup from 'yup';

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

  startsAtLocal: yup
    .string()
    .required('Start date and time is required')
    .test('is-future', 'The event must start in the future', (value) => {
      if (!value) return false;
      return new Date(value).getTime() > Date.now();
    }),

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
