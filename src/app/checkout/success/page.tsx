import { Suspense } from 'react';

import { CheckoutResult } from '@/widgets/checkout-result/CheckoutResult';

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutResult />
    </Suspense>
  );
}
