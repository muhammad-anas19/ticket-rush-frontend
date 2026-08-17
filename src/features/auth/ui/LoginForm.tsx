'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@/shared/ui';
import { loginSchema, type LoginValues } from '../model/schemas';
import styles from './AuthForm.module.scss';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(loginSchema),
    // Validate on blur rather than on every keystroke. `onChange` shows "Enter a valid email address"
    // while someone is still typing the third character of their address, which reads as the form
    // arguing with you.
    mode: 'onBlur',
  });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);

    /**
     * `signIn('credentials', ...)` — NOT a direct POST to the backend.
     *
     * The distinction matters: `signIn` routes through NextAuth's own endpoint, which runs
     * `authorize()`, then the `jwt` callback, then sets the encrypted session cookie. Calling
     * `/auth/login` directly would return a valid token pair that NextAuth never learns about — the
     * user would hold working credentials and have no session.
     *
     * `redirect: false` so we handle the outcome here rather than letting NextAuth navigate. A
     * redirect on failure would lose the error, and we want it rendered against this form.
     */
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      // Deliberately generic, mirroring the backend. It does not distinguish an unregistered address
      // from a wrong password — and neither does the backend's response time, which pays for a bcrypt
      // comparison either way. Being more helpful here would hand an attacker a user-enumeration
      // oracle the API went out of its way to close.
      setFormError('Invalid email or password');
      return;
    }

    // Return the user where they were originally headed. Middleware appends this when it bounces an
    // unauthenticated visitor off a protected route.
    const callbackUrl = searchParams?.get('callbackUrl') ?? '/';
    router.push(callbackUrl);
    // Server components hold the session, so the router cache must be invalidated or the page renders
    // with the pre-login session. Without this the UI shows a signed-out state until a manual reload —
    // a genuinely confusing "the login didn't work" bug when it did.
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* role="alert" so a screen reader announces the failure rather than it being visual-only. */}
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
        // Tells a password manager this is a sign-in, not a new password — without it, managers
        // routinely offer to generate a new one on the login form.
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className={styles.footer}>
        No account?{' '}
        <Link className={styles.link} href="/register">
          Create one
        </Link>
      </p>
    </form>
  );
}
