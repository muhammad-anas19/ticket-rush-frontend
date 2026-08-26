import Link from 'next/link';

import { Button } from '@/shared/ui';
import styles from './page.module.scss';

// Stripe's `cancel_url` carries no query param (see `OrdersService.createCheckoutSession()`), so
// this page can't say WHICH hold was abandoned — only that checkout was. If the hold is still
// active, the event page's own countdown/Pay button are exactly where to retry from.
export default function CheckoutCancelPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Checkout cancelled</h1>
        <p className={styles.muted}>
          You were not charged. If your hold is still active, you can go back and try paying
          again — otherwise you&apos;ll need to hold a ticket again first.
        </p>
        <Link href="/">
          <Button>Back to events</Button>
        </Link>
      </div>
    </main>
  );
}
