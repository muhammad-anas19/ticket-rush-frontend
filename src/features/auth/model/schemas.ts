import * as yup from 'yup';

import type { UserRole } from '@/entities/user/model/user.types';

/**
 * Validation lives here, not inline in the components, so the same rules are reusable and testable.
 *
 * **Client validation is UX, never a security control.** Every rule below is enforced again by the
 * backend's DTOs and its global ValidationPipe, because anyone can bypass this entirely with curl.
 * The point of duplicating it is instant feedback without a round trip — not protection.
 *
 * Note the rules mirror the backend's deliberately, including the 72-character password ceiling.
 * A mismatch means either a field the UI accepts and the API rejects (a confusing 400 the form
 * cannot attribute to a field) or the reverse (a rule that silently does nothing).
 */

export const loginSchema = yup.object({
  email: yup.string().required('Email is required').email('Enter a valid email address'),
  password: yup.string().required('Password is required'),
});

export type LoginValues = yup.InferType<typeof loginSchema>;

export const registerSchema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    // Matches the backend exactly. 72 is not arbitrary — it is bcrypt's input boundary, and anything
    // past it is SILENTLY IGNORED. Rejecting is far better than truncating: the user finds out, and
    // nobody later believes a 100-character passphrase bought them extra security.
    .max(72, 'Password must be at most 72 characters'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    // Purely client-side — the backend has no idea this field exists, and shouldn't. It catches typos
    // in a value the user cannot see, which is exactly the kind of thing worth a round trip to avoid.
    .oneOf([yup.ref('password')], 'Passwords do not match'),
  role: yup
    .mixed<UserRole>()
    .required('Choose how you will use TicketRush')
    .oneOf(['organiser', 'attendee'], 'Choose a valid role'),
});

export type RegisterValues = yup.InferType<typeof registerSchema>;
