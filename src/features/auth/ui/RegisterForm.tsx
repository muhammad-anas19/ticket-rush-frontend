'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { registerUser } from '@/entities/user/api/user.api';
import { ROLE_OPTIONS } from '@/entities/user/model/user.types';
import { getErrorMessage } from '@/shared/api/errorMessage';
import { Button, Input, Select } from '@/shared/ui';
import { registerSchema, type RegisterValues } from '../model/schemas';
import styles from './AuthForm.module.scss';

export function RegisterForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: yupResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { role: 'attendee' },
  });

  const onSubmit = async (values: RegisterValues) => {
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
        // The account was created but the session did not establish. `result.code` carries the
        // backend's own message from the login attempt, relayed as-is.
        toast.error(result.code ?? result.error);
        return;
      }

      router.push('/');
      // Invalidate the router cache so server components re-render with the new session.
      router.refresh();
    } catch (error) {
      /**
       * Every failure surfaces the backend's exact message. No status-code branching, no substituted
       * wording, no field-mapping guesswork.
       *
       * The earlier version rewrote a 409 into its own sentence and attached it to the email field.
       * That looked more polished and was worse: the message the user saw no longer matched the API's,
       * so tightening the backend's wording silently had no effect on the UI, and any status the
       * branch did not anticipate fell through to a generic "Something went wrong".
       *
       * The backend already says what it means — "An account with that email already exists", or the
       * ValidationPipe's per-field messages. Relaying is both simpler and more truthful. If a message
       * reads badly, that is a backend bug to fix in the DTO or the exception.
       */
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
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
