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
        toast.error(result.code ?? result.error);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (error) {
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
