import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/shared/styles/index.scss';
import { CacheDebugPanel } from '@/widgets/cache-debug-panel/CacheDebugPanel';
import { SiteHeader } from '@/widgets/site-header/SiteHeader';
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
        <Providers>
          {/*
            Inside Providers because SiteHeader calls useSession(), which needs SessionProvider above
            it. Outside, it would render as permanently signed out.
          */}
          <SiteHeader />
          {children}
          {/*
            M4's debug panel — position: fixed, so it belongs at the root rather than one page.
            It reads a server-wide counter (every client's requests move it, not just this tab's),
            so mounting it once here is right regardless of which route is active.
          */}
          <CacheDebugPanel />
        </Providers>
      </body>
    </html>
  );
}
