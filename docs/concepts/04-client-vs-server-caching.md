# Client-side vs server-side caching — the same pattern, a different blast radius

**Standalone concept doc**, the frontend half of M4. The backend half —
[`backend/docs/concepts/04-redis.md`](../../backend/docs/concepts/04-redis.md) — explains cache-aside,
TTL, stampede, and the cache-vs-truth line from the Redis side. This one exists because you already
have a working cache-aside implementation sitting in this codebase and didn't know to call it
that: **TanStack Query**.

This is Q138 in the interview bank, flagged there as the strongest available bridge from something
used daily to something new: *"How does your TanStack Query caching relate conceptually to
server-side caching?"* The honest, complete answer is below.

---

## 1. Yes, it's the same pattern

Look at `useEvent(id)` in this codebase (`entities/event/hooks/useEvents.ts`) next to
`EventsService.findOne(id)` (`backend/src/modules/events/events.service.ts`). Both do exactly the
same three things:

```
1. Check a cache for this key.
2. On a miss, fetch from the real source (the API; Postgres) and store the result.
3. On a HIT, return the cached value without touching the real source at all.
```

That is cache-aside, the entire pattern from `concepts/04-redis.md` Q2 — TanStack Query is a
cache-aside cache, and every `useQuery` call is a `getOrSet`. The query key (`['events', id]`) is the
cache key. `staleTime` is the TTL. `queryClient.invalidateQueries()` is Redis's `DEL`. You've been
running this pattern since M2; you just didn't have the vocabulary for it yet.

---

## 2. Where the two caches actually differ — and it's one thing, not many

Every difference below is a *consequence* of one fact, so learn that fact first:

**TanStack Query's cache lives in ONE browser tab's memory. Redis's cache is shared by every user
hitting the API, across every server instance.**

That's the entire difference. Everything else below is this fact wearing a different costume.

### Blast radius of a stale entry

- **TanStack Query stale entry:** wrong for exactly one person, in exactly one tab, for as long as
  that tab stays open without refetching. Closing the tab, navigating away and back, or a background
  refetch all clear it. The worst case is bounded by one person's session.
- **Redis stale entry:** wrong for *every* user who asks, simultaneously, the instant it goes stale,
  and stays wrong for everyone until the TTL expires or something explicitly invalidates it. Nobody's
  individual action (closing their tab, reloading) fixes it for anyone else.

This is why the *same* question — "can I cache this?" — gets a more conservative answer server-side.
A stale `ticketsRemaining` sitting in one attendee's TanStack Query cache for a few seconds is a much
smaller problem than a stale `ticketsRemaining` sitting in Redis, because the Redis version is wrong
for every attendee looking at that event at once. This project answers "never" for both layers (see
§4), but the *reasoning* isn't symmetric — the server-side "never" is carrying much more weight.

### Invalidation is trivial on one side and a real design problem on the other

When `useCreateHold`'s `onSuccess` fires, it calls:

```ts
void queryClient.invalidateQueries({ queryKey: eventKeys.details() });
void queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
```

This is safe and simple for a reason worth naming: **the tab that made the write is the only tab that
needs telling.** There is no race to worry about, because nothing else is concurrently writing to
*this browser's* cache — one JS heap, one thread, one mutation at a time from this user's own actions.

Contrast `EventsService.update()` on the backend, which has to reach for an explicit `DEL` on the
detail key and a version-bump on the list namespace (`TR-DEC-022`, `TR-DEC-023`) — because *any*
concurrent request from *any* user could be reading or writing that same shared key at the same
moment. Client-side invalidation answers "does the person who just changed this know about it?" —
trivially yes, they caused it. Server-side invalidation has to answer "does *everyone else* know
about it?" — which is the actual hard problem, and why it needed two TR-DEC entries and a version
counter instead of one line.

### Deduplication: free on one side, hand-built on the other

TanStack Query deduplicates automatically. If two components on the same page both call
`useEvent(id)` at the same moment, exactly one network request fires — the library coalesces them for
you, no configuration needed. `CacheService.getOrSet`'s Redis lock (`concepts/04-redis.md` Q4,
`TR-DEC-024`) does the identical job — make N concurrent callers on a cold key resolve to one real
fetch — but had to be written by hand, with a `SETNX` and a poll loop.

The reason for the asymmetry is exactly the mechanism from `concepts/04-redis.md` Q1, one layer up:
**TanStack Query's dedupe is trivial because a single browser tab is a single JS thread** — every
`useQuery` call in that tab runs on the same event loop, so the library can just keep an in-memory map
of "requests currently in flight" and hand out the same promise to every caller. There's no
concurrency to coordinate because there's only one thread issuing the requests in the first place.

Redis's callers are **separate Node processes** (or at least separate concurrent requests handled by
one process's event loop, potentially across multiple horizontally-scaled instances) — there is no
single in-memory map they all already share, because they aren't the same JS heap. Something has to
play that coordinating role from OUTSIDE any one process, and that's exactly what the shared Redis
lock is for. Same problem — "don't let N simultaneous askers redo the same work" — solved for free
by JavaScript's single-threadedness in one case, and solved by hand with an atomic remote lock in the
other, because the atomic single-thread guarantee that made it free doesn't reach across process
boundaries.

---

## 3. Two caches, one request — walking it through for real

Trace what actually happens when an attendee holds a ticket, because the response touches *both*
caches in sequence and it's the clearest way to see them stacked:

```
1. Attendee clicks "Hold a ticket". useCreateHold fires POST /api/holds.
2. Backend: HoldsService.create() — the atomic UPDATE from M3. Writes tickets_committed directly.
   Notice: this NEVER touches the Redis events cache. Not an oversight — see step 5.
3. useCreateHold's onSuccess invalidates THIS TAB's TanStack Query cache for event details/lists.
4. This tab refetches GET /api/events/:id.
5. Backend: EventsService.findOne() checks Redis. The event's STATIC shape (title, venue, price) is
   almost certainly still a cache HIT — nothing about step 2 touched it, because tickets_committed
   was never part of what's cached (TR-DEC-022). But the live committed-count query always runs
   regardless of hit or miss, so this response carries the fresh number from step 2.
6. This tab's TanStack Query cache is repopulated with the correct, live-merged data.
```

**What about every OTHER attendee looking at the same event right now?** Their TanStack Query cache
was never told anything happened — step 3 only invalidates the tab that made the write. But they are
not shown stale availability, because Redis was never asked to cache availability in the first place:
the next time *their* tab naturally refetches (a background refetch, a manual reload, or eventually
M7's WebSocket push replacing the need for either), the backend's live-merge guarantees they get the
true number too. The two caches don't need to coordinate with each other, because the one number that
actually changes (`ticketsCommitted`) was deliberately kept out of both of them where it matters most
— see §4.

---

## 4. The one rule that applies at BOTH layers, unchanged

`concepts/04-redis.md` Q5 states the server-side rule: cache what nobody acts irreversibly on; never
cache what a wrong read gets used to authorise. That rule does not become weaker on the client just
because a stale entry there only affects one person.

**Concretely in this codebase:** `EventResponseDto`'s `ticketsRemaining`/`isSoldOut` are cached at
neither layer as a *stored* value — the backend recomputes them live on every request (§2 above), and
the frontend never does `setQueryData` to optimistically bump a remaining-count based on a guess (see
`useCreateHold`'s comment on exactly this, and the frontend CLAUDE.md's standing rule: *"live
availability updates go into the TanStack cache via `setQueryData`, not by triggering a refetch"* is
about WebSocket-pushed updates from a source that has already re-verified the number server-side — it
is never about a client computing a new count itself and asserting it). A user's own tab is a smaller
blast radius than every tab, but "smaller" is not "safe" — the person in that one tab is the one who's
about to click "pay" based on what the screen says.

---

## Recap

| | TanStack Query | Redis |
|---|---|---|
| Scope of one cached entry | One browser tab | Every user, every server instance |
| TTL knob | `staleTime` / `gcTime` | `EX` / `PX` |
| Invalidation trigger | This tab's own mutation `onSuccess` | Explicit `DEL` + version bump on any write, from anyone |
| Why invalidation is "easy" or "hard" | Easy — the writer already knows | Hard — everyone ELSE has to find out |
| Deduplication of concurrent misses | Free — one JS thread per tab | Hand-built — `SETNX` lock, because callers are separate processes |
| The one rule that never relaxes | Never cache what a wrong read authorises an irreversible action on — at either layer |
