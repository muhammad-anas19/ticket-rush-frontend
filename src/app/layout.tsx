import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/shared/styles/index.scss';
import { SiteHeader } from '@/widgets/site-header/SiteHeader';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TicketRush',
  description: 'Live event ticketing',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
