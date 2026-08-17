'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { registerUser } from '@/entities/user/api/user.api';
import { ROLE_OPTIONS } from '@/entities/user/model/user.types';
import { ApiError } from '@/shared/api/ApiError';
import { Button, Input, Select } from '@/shared/ui';
import { registerSchema, type RegisterValues } from '../model/schemas';
import styles from './AuthForm.module.scss';

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { role: 'attendee' },
  });

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);

    try {
      // Two steps, deliberately. The backend returns a token pair here, but NextAuth knows nothing
      // about it — only `authorize()` can establish a session. So we register, then sign in.
      //
      // The cost is that the password is bcrypt-verified twice (~500ms total). Accepted: the
      // alternative is a second NextAuth provider that trusts pre-issued tokens, which is more
      // machinery and a wider trust surface for one extra hash on a once-per-user path.
      await registerUser({
        email: values.email,
        password: values.password,
        role: values.role,
      });

      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        // The account exists but the session did not establish. Say so precisely rather than
        // "registration failed" — retrying registration would now hit a 409 and confuse them further.
        setFormError('Account created, but sign-in failed. Please try signing in.');
        return;
      }

      router.push('/');
      // Invalidate the router cache so server components re-render with the new session.
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 is attributable to a specific field, so attach it there rather than to the form.
        // A banner saying "email already registered" makes the user hunt for which field is wrong.
        //
        // Note registration DOES leak that an address is taken, and unavoidably so — the user has to
        // be told why it failed. Login is where enumeration must be prevented, and it is.
        if (error.status === 409) {
          setError('email', { message: 'An account with that email already exists' });
          return;
        }

        // Field-level messages from the backend's ValidationPipe. Shown as a banner because mapping
        // them back to fields would mean parsing English, and any mismatch between the Yup schema and
        // the backend DTO is a bug to fix rather than paper over at runtime.
        if (error.fieldErrors?.length) {
          setFormError(error.fieldErrors.join('. '));
          return;
        }

        setFormError(error.message);
        return;
      }

      setFormError('Something went wrong. Please try again.');
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <div className={styles.banner} role="alert">
          {formError}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {/* Self-selected role. Safe here only because organiser is a different CAPABILITY, not a
          higher privilege — an organiser can create their own events and gains no access to anyone
          else's data (TR-DEC-003). In a system where the elevated role could read other people's
          records, letting the client pick it would be textbook privilege escalation. */}
      <Select
        label="How will you use TicketRush?"
        options={ROLE_OPTIONS}
        error={errors.role?.message}
        {...register('role')}
      />

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className={styles.footer}>
        Already have an account?{' '}
        <Link className={styles.link} href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
