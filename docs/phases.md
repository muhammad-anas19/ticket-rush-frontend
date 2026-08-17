# Frontend — Module Plan

Built **after** the matching backend slice in each module (`backend/docs/phases.md`). The frontend
never leads; it consumes an API that already exists and has been verified over real HTTP.

**Stack.** Next.js App Router · TypeScript · Feature-Sliced Design (`TR-DEC-005`) · SCSS modules with
the 7-1 architecture and the strict `em` rule · **NextAuth** (`TR-DEC-001`) · axios · TanStack Query ·
React Hook Form + Yup.

**Scope discipline.** No design work. Plain, lightly styled. Nobody is going to look at it. Every hour
on visual polish is an hour not spent on the five technologies this project exists to teach.

---

## Status

| Module | Understanding check | Implementation |
|---|---|---|
| M0 | n/a — all covered ground | ✅ Complete & verified (see `backend/docs/walkthroughs/m0-foundation-code-walkthrough.md`) |
| M1 | ✅ Graded (`backend/docs/qa/phase-1-auth-understanding-check.md` Q6–Q10) | ✅ Complete & verified — [walkthroughs/m1-auth-code-walkthrough.md](walkthroughs/m1-auth-code-walkthrough.md) · [concepts/01-nextauth.md](concepts/01-nextauth.md) |
| M2 | ◄ next | not started |
| M3–M8 | not started | not started |

Frontend understanding checks are asked when the backend half of that module is complete, so the API
being consumed is real and concrete rather than hypothetical.

**M0 had no gate** — FSD, SCSS modules, TanStack Query and RHF+Yup are all recorded as already
practiced, and scaffolding them introduces no new concept. **M1 does have one**: NextAuth is new, and
`TR-DEC-001` makes it the sole session layer, which is a bigger commitment than "add a library."

---

## M0 — Foundation

Next.js + TypeScript scaffold, ESLint, Prettier. The six FSD folders, empty. SCSS 7-1 with tokens,
mixins, reset, and the `em` rule enforced from the first component. A handful of `shared/ui` atoms —
`Button`, `Input`, `Select`, `Skeleton`, `Badge` — ported from P1 rather than rewritten. The axios
client in `shared/api` with a base URL and an error normaliser reading the backend's envelope.
`QueryClientProvider` wired in `app/`.

**Checkpoint.** A page renders, an atom is styled, and axios reaches the backend's `/health`.

---

## M1 — Auth

**The NextAuth module.** Credentials provider calling the backend's `/api/auth/login`; the `jwt`
callback storing `accessToken`/`refreshToken` and handling refresh on expiry; the `session` callback
exposing what the client needs (`TR-DEC-002`); `SessionProvider` in `app/`; middleware protecting
routes. Register and login forms with React Hook Form + Yup. An axios request interceptor attaching
`Authorization: Bearer` from the session.

**The trap to handle deliberately, not discover.** Several components refreshing at once means the
second presents an already-rotated refresh token, which a backend with reuse detection treats as
theft and answers by killing the session. Solved with a single in-flight refresh promise — the same
shape P1 used in its axios interceptor, relocated into NextAuth's `jwt` callback.

**Docs.** `concepts/01-nextauth.md` is the substantial one, and the user has never used NextAuth:
what it actually is; JWT vs database session strategies; what the `jwt` and `session` callbacks are
for and when each runs; how the Credentials provider differs from OAuth providers; `SessionProvider`
and `useSession`; server-side session access in the App Router; and precisely where NextAuth ends and
your own API's auth begins.

---

## M2 — Events

`entities/event/` complete: `model/`, `api/`, `hooks/`. A public list with pagination reflected in URL
query params. An event detail page. An organiser create/edit form in RHF + Yup, with price entered in
currency and submitted as **integer cents** — a boundary conversion worth getting right once, in one
place, with a test. `features/create-event/`, `widgets/event-list/`.

---

## M3 ★ — Holds

`entities/hold/`. A hold button firing a mutation and invalidating the event query. A countdown timer
driven by the server's `expiresAt`, **never by a client-side clock started at render** — clock skew
and a backgrounded tab both break the naive version. Sold-out and hold-expired states handled
explicitly rather than collapsing into a generic error.

---

## M4 ★ — Redis

Little visible UI. A small debug panel reading the cache hit ratio, and a section in the concepts doc
drawing the line between **TanStack Query's client-side cache and Redis's server-side cache** — same
cache-aside idea, different blast radius, different invalidation problem. That comparison is Q138 in
the interview bank, and it's the strongest available bridge from something used daily to something
new.

**Docs.** `concepts/04-client-vs-server-caching.md`

---

## M5 ★ — Stripe

A checkout button redirecting to the Stripe-hosted Checkout Session. Success and cancel pages.
`/me/tickets`.

**The point to internalise.** The success page **cannot be trusted** to mean payment succeeded — a
user can navigate to it directly. It is a UI convenience; the webhook is the source of truth. So the
success page polls or subscribes for the order's real status rather than asserting it. This is
exactly *why* webhooks exist rather than client callbacks (Q155).

---

## M6 ★ — Queues

`/me/tickets` reading rows produced asynchronously by the consumer. The UI has to tolerate a ticket
that **doesn't exist yet** a second after payment — the honest consequence of asynchronous
fulfilment, and the reason the success page shows a pending state instead of an empty table.

---

## M7 ★ — Realtime

A Socket.IO client in `shared/`, joining `event:{id}` on mount and leaving on unmount. Live
availability pushed into the TanStack Query cache with `setQueryData` rather than triggering a
refetch — a socket message that causes an HTTP request has saved nothing. Reconnect handling and
re-authentication on reconnect.

**The experiment lives here:** two tabs against two API instances, watching one go stale before the
Redis adapter is added.

---

## M8 — Tests

Deferred until M0–M7 run end to end. No test framework is configured yet, so this includes setup
(Vitest or Jest + React Testing Library), not only writing tests.

---

## End-of-module protocol

1. Update the learning tracker.
2. Write the walkthrough against the code that actually shipped, including what surprised you.
3. Confirm the checkpoint.
4. Only then does the next module's understanding check begin.
