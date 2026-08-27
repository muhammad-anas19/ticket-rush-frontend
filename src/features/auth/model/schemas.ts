import * as yup from 'yup';

import type { UserRole } from '@/entities/user/model/user.types';

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
    .max(72, 'Password must be at most 72 characters'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
  role: yup
    .mixed<UserRole>()
    .required('Choose how you will use TicketRush')
    .oneOf(['organiser', 'attendee'], 'Choose a valid role'),
});

export type RegisterValues = yup.InferType<typeof registerSchema>;
