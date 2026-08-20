import { EventDetail } from '@/widgets/event-detail/EventDetail';

/**
 * `params` is a Promise in Next 15 and must be awaited — it was a plain object in 14. Reading
 * `params.id` directly still "works" via a deprecation shim and then breaks on upgrade.
 */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetail id={id} />;
}
