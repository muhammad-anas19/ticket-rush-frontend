import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/ui/LoginForm';

export const metadata = { title: 'Sign in · TicketRush' };

export default function LoginPage() {
  /**
   * The Suspense boundary is required, not decorative.
   *
   * `LoginForm` calls `useSearchParams()` to read `?callbackUrl=`, and in the App Router that opts the
   * component into client-side rendering for the search params. Without a boundary, `next build` fails
   * with "useSearchParams() should be wrapped in a suspense boundary" — a build-time error, not a
   * runtime one, so it is easy to hit only at deploy.
   */
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
