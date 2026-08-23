# Frontend — Module Plan

Built **after** the matching backend slice in each module (`backend/docs/phases.md`). The frontend never
leads; it consumes an API that already exists and has been verified over real HTTP.

**Stack.** Next.js 15 App Router · TypeScript · Feature-Sliced Design (`TR-DEC-005`) · SCSS modules,
7-1 architecture, strict `em` rule · **NextAuth v5** (`TR-DEC-001`) · axios · TanStack Query ·
React Hook Form + Yup · react-hot-toast.

**Scope discipline.** No design work. Plain, lightly styled. Nobody is going to look at it. Every hour
on visual polish is an hour not spent on the five technologies this project exists to teach.

---

## Status

| Module | Understanding check | Implementation |
|---|---|---|
| M0 | n/a — all covered ground | ✅ Complete & verified |
| M1 | ✅ Graded (`backend/docs/qa/phase-1-auth-understanding-check.md` Q6–Q10) | ✅ Complete & verified — [walkthroughs/m1-auth-code-walkthrough.md](walkthroughs/m1-auth-code-walkthrough.md) · [concepts/01-nextauth.md](concepts/01-nextauth.md) · [walkthroughs/m1-auth-network-flow.md](walkthroughs/m1-auth-network-flow.md) |
| M2 | n/a — covered ground (FSD, RHF+Yup, TanStack) | ✅ Complete & verified (see `backend/docs/walkthroughs/m2-events-code-walkthrough.md`) |
| M3 | ⛔ blocked on the **backend M3 gate** — Q9 of the M2 check was unanswered | ✅ Complete — `HoldTicket`, `useHold`, deadline-driven `useCountdown` (undocumented; no walkthrough written yet) |
| M4 | n/a — client-side cache-aside is TanStack Query, already in daily use | ✅ Complete & verified — [concepts/04-client-vs-server-caching.md](concepts/04-client-vs-server-caching.md) · `CacheDebugPanel` widget |
| M5–M8 | not started | not started |

**Why M0 and M2 had no gate:** FSD, SCSS modules, TanStack Query and RHF+Yup are all recorded as already
practiced in P1, and scaffolding or reusing them introduces no new concept. **M1 did have one** — NextAuth
was new, and `TR-DEC-001` makes it the sole session layer, which is a bigger commitment than adding a
library. **M3 is gated on the backend**, because the frontend slice is meaningless until the atomic
inventory logic exists.

---

## Conventions that apply to every module

**FSD layers, and the rule that gives them meaning.** `app` → `pages` → `widgets` → `features` →
`entities` → `shared`. Lower layers never import from higher ones; same-layer cross-imports are
forbidden; `shared` imports from nothing. That last constraint is load-bearing, not pedantry — it is why
`UserRole` lives in `shared/model/roles.ts` rather than `entities/user`, since `shared/auth` needs it and
may not import upward.

**Every entity gets the same three folders**: `model/` (types), `api/` (axios calls), `hooks/`
(`useQuery`/`useMutation`). Query keys and their matching invalidation live in **exactly one place per
entity**. P1 refactored to this late after inline keys drifted out of sync with their invalidations —
a failure that is silent, because the mutation succeeds and the list just does not update.

**Three mandatory UI states** for every data-consuming component: skeleton loading shaped like the final
content (never a full-page spinner), an empty state, and an error state.

**Errors are relayed, never rewritten.** `shared/api/errorMessage.ts` reads the backend's message and
nothing composes its own. The backend already decides what is safe to say — `/auth/login` returns a
deliberately generic message backed by matched response timing — so substituting local wording duplicates
a security decision made elsewhere, and the copies drift.

**A badly-worded error is a backend bug**, fixed in the DTO or exception, not patched in a component.

---

## M0 — Foundation ✅

**Shipped.** Next.js + TypeScript scaffold. The six FSD folders. SCSS 7-1 with tokens, mixins, reset, and
the `em` rule enforced from the first component — root font-size declared exactly once, at `16px`, so the
whole scale is adjustable from one value. `shared/ui` atoms: `Button`, `Input`, `Select`, `Skeleton`,
`Badge`. Axios client in `shared/api` with envelope unwrapping and an `ApiError` normaliser.
`QueryClientProvider` in `app/providers.tsx`.

**Two details worth remembering.**

`QueryClient` is created inside `useState`, not as a module constant — a module-level client is created
once per *server process* and would be shared across every concurrent user's SSR request, serving one
visitor's cached data to another.

`mutations: { retry: false }`. Auto-retrying a mutation can create a second hold or charge twice, and in
this domain that is not hypothetical.

**Checkpoint met.** A page renders, atoms are styled, axios reaches the backend across CORS.

---

## M1 — Auth ✅

**Shipped.** NextAuth v5 with a Credentials provider calling `POST /api/auth/login`; the `jwt` callback
persisting both tokens and refreshing 30 seconds early; the `session` callback exposing **only** the
access token; `SessionProvider`; middleware from the split config; register and login forms in RHF + Yup;
an axios request interceptor attaching `Authorization: Bearer` from the session.

**The decision that shaped it.** `TR-DEC-018` — the refresh token is persisted in the encrypted session
cookie and **never** copied into `session`. A stolen 15-minute access token is a bounded incident; a
stolen 7-day refresh token is an account takeover. One extra line in `session()` converts one into the
other, which is exactly why the two callbacks are separate functions.

**Three things that surprised us**, all documented in the walkthrough:

- Returning `false` from `authorized` to bounce signed-in users off `/login` **did nothing** — `false`
  means "redirect to the login page", which was the page they were already on, so NextAuth
  short-circuited the loop and rendered it.
- `handlers` is an object, so `export { GET, POST } from '@/shared/auth'` fails; they must be destructured.
- `useSearchParams()` fails the **build** without a Suspense boundary — a build-time error, easy to hit
  first at deploy.

**And two real security bugs found by tracing the network tab**, both fixed (`TR-DEC-020`):

1. `signOut()` cleared the cookie and revoked **nothing** — the refresh-token family stayed live in
   Postgres for 7 days. Fixed with an `events.signOut` hook calling the backend's logout.
2. `POST /auth/register` returned a token pair the NextAuth client **cannot use**, in a different token
   family from the sign-in one, so logout never touched it. **Every signup leaked a live credential.**
   Fixed at the source: register returns the user only.

**Docs.** [concepts/01-nextauth.md](concepts/01-nextauth.md) is the substantial one — session strategies
and why Credentials forces `jwt`, the two callbacks, `AUTH_SECRET`, the refresh race and why the
browser's shared-promise fix does not transfer server-side.
[walkthroughs/m1-auth-network-flow.md](walkthroughs/m1-auth-network-flow.md) traces every call a sign-in
makes and explains CSRF.

---

## M2 — Events ✅

**Shipped.**

```
entities/event/{model,api,hooks,ui}/   types, axios calls, query hooks, EventCard
features/create-event/{model,ui}/      Yup schema + RHF form
widgets/event-list/                    search, pagination, three UI states
widgets/event-detail/
shared/lib/money.ts                    the ONE currency conversion boundary
app/events/[id]/page.tsx
app/organiser/events/new/page.tsx      server-side role gate
```

**URL as state.** Page and search live in query params, not `useState`. That buys three concrete things:
shareable URLs, working back/forward, and a refresh that keeps your place. Search is mirrored into local
state and debounced 400ms before hitting the URL, because writing on every keystroke would push a history
entry and fire a request per character.

**Money crosses representation in exactly one file.** The form takes dollars; storage takes integer cents.
`majorToCents` uses `Math.round`, not `floor` — `19.99 * 100` is `1998.9999999999998` in IEEE 754, so
flooring silently charges a cent less. The same float behaviour that made integer cents necessary bites
again in the conversion itself.

**Time crosses in exactly one place too.** `datetime-local` gives a string with no timezone, so the form
treats it as local wall time and converts with `toISOString()` at submit. Sending the bare string makes
Postgres guess using the *server's* zone — works on a laptop in Karachi, five hours wrong on a UTC host.

**Query keys are hierarchical** (`eventKeys.all` → `lists()` → `list(params)`), so one
`invalidateQueries({ queryKey: eventKeys.all })` covers every cached page and search term. TanStack
matches key **prefixes**, which is what makes that work without enumerating.

**`placeholderData: (previous) => previous`** keeps the current page visible while the next loads, dimmed
via a `.stale` class, instead of flashing skeletons on every page change.

**Docs.** [concepts/02-roles-and-permissions-frontend.md](concepts/02-roles-and-permissions-frontend.md)
— the four gating layers, why only the API is a boundary, and role versus ownership.

---

## M3 ★ — Holds *(blocked on the backend gate)*

`entities/hold/`. A hold button firing a mutation and invalidating the event query.

**The countdown timer must be driven by the server's `expiresAt`**, never a client clock started at
render. Two things break the naive version: clock skew between the user's machine and the server, and a
backgrounded tab, where browsers throttle timers to once a minute or stop them entirely.

Sold-out and hold-expired handled as **distinct explicit states**, not collapsed into a generic error —
"someone bought the last ticket while you were deciding" and "your hold ran out" need different words and
different next actions.

**And the frontend must expect to lose the race.** With an atomic conditional UPDATE on the backend, a
hold request can legitimately fail because someone else won by milliseconds. That is not an error
condition to apologise for; it is the normal operation of a system with finite inventory, and the UI has
to say so gracefully.

---

## M4 ★ — Redis

Little visible UI. A small debug panel reading the cache hit ratio, and a concepts doc drawing the line
between **TanStack Query's client-side cache and Redis's server-side cache** — the same cache-aside idea
with a different blast radius and a different invalidation problem. One is per-browser and disposable;
the other is shared by every user, so a stale entry is wrong for everyone at once.

That comparison is Q138 in the interview bank, and it is the strongest available bridge from something
used daily to something new.

**The availability count is deliberately not cached.** A stale event title is cosmetic; a stale
availability count is a correctness bug, because someone acts on it.

**Complete.** `widgets/cache-debug-panel/CacheDebugPanel.tsx`, mounted in the root layout — polls
`GET /api/cache/stats` every 5s (`refetchIntervalInBackground: true` so it keeps moving even
unfocused), showing hit ratio and raw hit/miss counts. Confirmed rendering server-side (`curl` on the
running dev server showed the panel's markup in the initial HTML) and picking up real numbers from
the live backend. No new entity folder — this isn't one of the five domain entities, and forcing a
`model/api/hooks` split on a five-line debug fetch would be the pattern applied because it exists
rather than because anything needs it.

**Docs.** [concepts/04-client-vs-server-caching.md](concepts/04-client-vs-server-caching.md) — the
TanStack-Query-vs-Redis comparison in full, including why deduplicating concurrent requests was free
on one side and had to be hand-built with a Redis lock on the other.

---

## M5 ★ — Stripe

A checkout button redirecting to the hosted Checkout Session. Success and cancel pages. `/me/tickets`.

**The success page cannot be trusted.** A user can navigate straight to it, and Stripe's redirect proves
only that a browser was pointed somewhere — not that money moved. It is a UI convenience; **the webhook
is the source of truth**. So the page polls or subscribes for the order's real status rather than
asserting success.

That is precisely *why* webhooks exist rather than client callbacks (Q155), and building the page
correctly is the cheapest way to internalise it.

---

## M6 ★ — Queues

`/me/tickets` reading rows produced asynchronously by a consumer.

**The UI has to tolerate a ticket that does not exist yet** a second after payment. That is the honest
consequence of asynchronous fulfilment, not a bug to hide — and it is why the success page shows a pending
state rather than an empty table. An empty table says "you have no tickets", which is a lie in the
seconds before the consumer runs.

---

## M7 ★ — Realtime

A Socket.IO client in `shared/`, joining `event:{id}` on mount and leaving on unmount.

**Live availability goes into the TanStack cache via `setQueryData`, not by triggering a refetch.** A
socket message that causes an HTTP request has saved nothing — you have paid for a persistent connection
and then polled anyway.

Handshake authentication, and reconnect handling — plus re-auth on reconnect, since a socket that
reconnects after a token expiry must not silently continue as an anonymous connection.

**The experiment lives here:** two tabs against two API instances, watching one go stale before
`@socket.io/redis-adapter` is added.

---

## M8 — Tests

Deferred until M0–M7 run end to end. **No test framework is configured yet**, so this module includes
setup (Vitest or Jest + React Testing Library), not only writing tests.

Highest-value targets, in order:
1. **`money.ts`** — the conversion boundary. Pure functions, trivial to test, and a bug there is a money
   bug.
2. **The Yup schemas** — cheap, and they encode rules that must match the backend's DTOs.
3. **`EventList`'s three states** — loading, empty, error, plus the empty-vs-no-search-results distinction.
4. **The `getErrorMessage` relay** — that a backend message reaches the toast unmodified.

---

## End-of-module protocol

1. Update the learning tracker.
2. Write the walkthrough against the code that **actually shipped**, including what surprised you.
3. Confirm the checkpoint.
4. Only then does the next module's understanding check begin.
