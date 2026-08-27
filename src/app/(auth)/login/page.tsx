import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/ui/LoginForm';

export const metadata = { title: 'Sign in · TicketRush' };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
