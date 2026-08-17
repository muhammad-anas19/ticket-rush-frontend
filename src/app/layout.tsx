import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/shared/styles/index.scss';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TicketRush',
  description: 'Live event ticketing',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang` is not decorative: screen readers use it to pick pronunciation rules.
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
