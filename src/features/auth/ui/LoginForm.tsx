'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { Button, Input } from '@/shared/ui';
import { loginSchema, type LoginValues } from '../model/schemas';
import styles from './AuthForm.module.scss';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (values: LoginValues) => {
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      toast.error(result.code ?? result.error);
      return;
    }

    const callbackUrl = searchParams?.get('callbackUrl') ?? '/';
    router.push(callbackUrl);
    router.refresh();
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
