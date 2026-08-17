import { SessionPanel } from '@/widgets/session-panel/SessionPanel';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>TicketRush</h1>
        <p className={styles.subtitle}>
          Module 1 — auth. NextAuth session, Bearer header, authenticated API call.
        </p>
      </header>

      <SessionPanel />
    </main>
  );
}
