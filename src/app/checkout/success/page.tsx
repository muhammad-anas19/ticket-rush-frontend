import { Suspense } from 'react';

import { CheckoutResult } from '@/widgets/checkout-result/CheckoutResult';

// Suspense is required, not decorative: CheckoutResult calls useSearchParams() to read
// `?orderId=`, and in the App Router that needs a boundary or `next build` FAILS — the same
// trap `app/page.tsx` already names for `EventList`.
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutResult />
    </Suspense>
  );
}
