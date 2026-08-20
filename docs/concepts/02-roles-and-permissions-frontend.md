# Roles and Permissions on the Frontend

How authorisation works in the browser half of this project — and, more importantly, what browser-side
authorisation **is not**.

Backend counterpart: `backend/CLAUDE.md` §7 and `backend/docs/qa/phase-1-auth-understanding-check.md` Q5.

---

## 1. The one rule everything else follows

> **Frontend authorisation is user experience. It is never security.**

Every check in this document can be bypassed in about four seconds:

```bash
# No browser, no JavaScript, no middleware, no hidden buttons.
curl -X POST http://localhost:3001/api/events \
  -H "Authorization: Bearer <any attendee token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"I am not an organiser","venue":"Anywhere", …}'
```

Nothing the frontend did is involved in that request. **The only thing standing between an attendee and
creating an event is `RolesGuard` in NestJS.** Verified: it returns 403.

So what is frontend gating *for*? Two honest answers:

1. **Not offering actions that will fail.** A "Create event" button that always 403s is a bug in the UI,
   not a security feature.
2. **Not rendering a page whose data the user cannot load.** Better to redirect than to show a shell
   full of error states.

Both are about *not wasting the user's time*. Neither protects anything.

**The failure mode to internalise:** hiding a button and calling the endpoint protected. That ships an
open endpoint with a tidy-looking UI, and it is one of the most common real-world authorisation bugs
precisely because it *looks* correct in a browser.

---

## 2. Where the role actually comes from

Follow it end to end, because each hop is a place it could go stale or get lost.

```
Postgres            users.role                      enum: 'organiser' | 'attendee'
   ↓ login
NestJS              JWT claim  { sub, email, role } signed, 15-minute lifetime
   ↓ authorize()
NextAuth jwt cb     token.role                      encrypted into the session cookie
   ↓ session cb
NextAuth session    session.user.role               readable by the browser
   ↓
UI                  useSession() / auth()
```

Two consequences worth stating plainly.

**The role in the browser is a copy, and copies go stale.** It was read from the database at login and
travels in a signed token with a 15-minute life. Demote an organiser and the UI keeps offering organiser
actions until that token refreshes. The API, checking the same claim, has the same staleness — which is
the deliberate trade recorded in the M1 Q&A: no database read per request, at the cost of up to 15
minutes of drift on a two-value role that essentially never changes. A `token_version` column would
close it for one integer comparison, and that is the upgrade path if roles ever become mutable.

**`session.user.role` is a claim, not a fact.** TypeScript says it is a `UserRole`; TypeScript erases at
runtime. If the backend ever returns a role this frontend has not heard of, every
`role === 'organiser'` check silently evaluates false and the user gets an attendee UI with no error
anywhere. `isUserRole()` in `shared/model/roles.ts` exists for validating at that boundary.

### One definition, one place

`UserRole` lives in **`shared/model/roles.ts`** and nowhere else. It was previously declared twice —
in `shared/auth/types.ts` and `entities/user/model/user.types.ts` — and both copies agreed, which is
exactly what makes duplication dangerous: they stay agreeable until someone adds a third role to one of
them, and then the compiler is satisfied while the two halves of the app disagree about what a role is.
P1 shipped this bug with a duplicated `User` interface.

It lives in `shared` because of the FSD import rule: `shared` imports from nothing, and both
`shared/auth` and `entities/user` need it. Putting the canonical copy in `entities` would force
`shared/auth` to import upward.

---

## 3. The four places you can gate, and what each is good for

| Layer | Runs | Good for | Can be bypassed? |
|---|---|---|---|
| **1. Middleware** | Edge, before any rendering | Whole route prefixes | Yes — trivially |
| **2. Server component** | On the server, before HTML exists | Page-level, needs server data | Yes |
| **3. Client component** | In the browser | Showing/hiding controls | Yes |
| **4. The API** | NestJS | **Everything that matters** | **No** |

Only row 4 is a boundary. Rows 1–3 are progressively cheaper ways of being polite.

### Layer 1 — Middleware (`src/middleware.ts` + `shared/auth/config.ts`)

The cheapest gate: it runs at the edge before any component renders, so an unauthorised visitor never
costs you a render.

```ts
if (nextUrl.pathname.startsWith('/organiser')) {
  if (!isLoggedIn) return false;                                  // → /login?callbackUrl=…
  if (auth?.user?.role !== 'organiser') {
    return Response.redirect(new URL('/', nextUrl));              // → home
  }
  return true;
}
```

**The `false` vs `Response.redirect` distinction cost a debugging round, and it is not obvious.**

`false` does not mean "block". It means **"send them to `pages.signIn`"**. So:

- For `/organiser/*` when not signed in, `false` is exactly right — the login page is where they should
  go, and NextAuth adds `?callbackUrl=` so they return afterwards.
- For a signed-in attendee, `false` would send them to a login page they are already past — a dead end
  that reads as a broken app. Hence the explicit redirect home.
- And earlier in the same callback, returning `false` for `/login` itself produced **nothing at all**:
  redirecting `/login` to `/login` is a loop, so NextAuth short-circuits it and renders the page. The
  check silently did nothing.

> The boolean encodes a **destination**, not a permission. When the destination is anything other than
> the login page, say so explicitly. The return type is `boolean | Response` precisely so you can.

**Middleware limits worth knowing:** it runs in the **Edge runtime** — no Node APIs, no database drivers.
So it can read the session cookie but cannot look anything up. That is why this project uses v5's
**split config**: a slim `shared/auth/config.ts` for middleware, and the full config with providers in
`shared/auth/index.ts`.

### Layer 2 — Server component (`app/organiser/events/new/page.tsx`)

```ts
const session = await auth();
if (!session?.user) redirect('/login?callbackUrl=/organiser/events/new');
if (session.user.role !== 'organiser') redirect('/');
```

Runs on the server, so the wrong user **never receives the form markup at all** — strictly better than
rendering it and hiding it client-side, where the HTML is in the page for anyone to read.

This duplicates the middleware check, and that duplication is deliberate: middleware is matched by
pattern and easy to mis-scope, so a page that must not render for the wrong role says so itself. It is
one line and it is the last defence before HTML is produced.

Note `auth()` here, not `useSession()` — server components have no React context and no hooks.

### Layer 3 — Client component (`widgets/session-panel/SessionPanel.tsx`)

```tsx
{(me?.role ?? session?.user.role) === 'organiser' && (
  <Link href="/organiser/events/new"><Button>Create an event</Button></Link>
)}
```

Purely cosmetic: do not offer a link that would redirect or 403.

Two details in that one line:

- **`me?.role ?? session?.user.role`** prefers the value from `GET /api/auth/me`, which reads the
  **database**, over the token claim, which may be 15 minutes old. The session value is the fallback for
  before that query resolves. Freshest-available-wins, with a graceful degradation.
- **Never gate on `role` without also handling `status === 'loading'`.** On a fresh page load the client
  genuinely does not know who anyone is yet, so a bare role check renders the attendee view for a beat
  and then flips — and if you redirect on it, you bounce legitimate organisers to the home page
  intermittently.

### Layer 4 — The API (`backend/src/common/guards/roles.guard.ts`)

```ts
@Post()
@Roles(UserRole.Organiser)
async create(@Body() dto: CreateEventDto, @CurrentUser() user: CurrentUserPayload) { … }
```

**This is the boundary.** It runs regardless of what any browser did, and it is the only layer whose
removal is a vulnerability rather than a UX regression.

---

## 4. Role is not ownership — two independent axes

The single most important idea here, and the one that produces real bugs when missed.

```
ROLE       "are you the KIND of user who may do this?"      → from the token alone
OWNERSHIP  "is THIS SPECIFIC RECORD yours?"                 → needs the row
```

`@Roles(Organiser)` on `PATCH /events/:id` admits **every** organiser — including one editing a rival's
event. Passing the role check is not permission to edit *that* event.

That is why the backend splits them:

| Check | Lives in | Because |
|---|---|---|
| Role | A **guard** | Needs only the token. A guard runs before the handler with nothing loaded. |
| Ownership | The **service** | Needs the row. Doing it in a guard means querying the event twice, or stashing it on the request and coupling the two through mutable state. |

**Conflating them is how IDOR ships.** Verified in M2: a second organiser attempting to edit someone
else's event gets `403 "You can only modify your own events"`, distinct from the role failure's
`403 "Insufficient permissions for this action"`.

### What this means for the frontend

**You cannot reliably check ownership client-side, and should not try.** You would need the resource, and
even holding it, the value you are comparing came from the same server that is about to decide anyway.

So the pattern is: **use ownership to shape the UI, never to authorise.**

```tsx
// Fine — do not offer an edit button on someone else's event.
{event.organiser?.id === session?.user.id && <EditButton eventId={event.id} />}

// The submit still goes to PATCH /events/:id, which re-checks ownership server-side.
```

Currently no frontend component does this, because M2 has no edit UI. When one arrives, that is the
shape.

### 403 vs 404 — and why the frontend should not care

The backend chooses per resource:

- **Events → 403.** They are public; a public listing and detail endpoint already reveal that the id
  exists, so hiding it buys nothing and costs clarity.
- **Orders and holds → 404.** These are private. A 403 would *confirm* the record exists and let someone
  probe for valid ids.

The frontend's job is to **relay whatever message came back**, not to interpret the code. That is why
`shared/api/errorMessage.ts` exists and why no component branches on status to compose its own text — the
backend already decided what is safe to say, and duplicating that decision means the two copies
eventually disagree.

---

## 5. What this project deliberately does not have

- **No permissions table, no `@RequirePermissions`.** Two roles, and the role is a plain enum column
  (`TR-DEC-003`). P1 built the fully normalised
  `users ─< user_roles >─ roles ─< role_permissions >─ permissions` model and it was already learned;
  rebuilding it here would re-derive covered ground at the cost of a session Redis and concurrency need
  more.
- **No client-side permission map.** No `can('events:create')` helper. With two roles and a handful of
  gates, an abstraction would be more code than the thing it abstracts. It becomes worth it when roles
  multiply or permissions become data.
- **Roles are self-selected at signup**, and that is safe *here* for one specific reason: organiser is a
  different **capability**, not a higher **privilege**. An organiser can create their own events and gains
  no access whatsoever to another user's data. In a system where the elevated role could read other
  people's records, letting the client pick it would be textbook privilege escalation.

That last point is worth being able to defend, because "you let users choose their own role?" sounds
alarming until you say why it is not.

---

## 6. Adding a new gated route — the checklist

In order, because the order reflects which layers matter:

1. **Guard the API first.** `@Roles(...)` on the controller, plus an ownership check in the service if
   the route touches a specific record. **Nothing else on this list is security.**
2. **Add the route prefix to `authorized()`** in `shared/auth/config.ts` if it is a whole section.
   Cheapest gate, runs before any render.
3. **Add an `auth()` check in the page** if it is a server component. Ensures the wrong role never
   receives the markup.
4. **Hide the entry point** — the link or button — so the action is never offered.
5. **Verify with curl, not the browser.** A browser test only proves the UI is polite. Hit the endpoint
   directly with a wrong-role token and confirm 403.

Step 5 is the one people skip, and it is the only one that tests the actual boundary.

---

## 7. Anti-patterns

**Hiding a button and calling it protected.** The endpoint is open; the UI is decoration.

**Trusting `session.user.role` for anything but rendering.** It is a claim from a token that may be 15
minutes stale, and the user controls their own browser.

**Duplicating permission logic between frontend and backend.** Two copies of a rule drift, and the
frontend's copy is the one nobody notices is wrong. Keep the rule in the API and let the UI ask.

**Checking role without checking `status === 'loading'`.** Produces a flash of the wrong UI, and if you
redirect on it, intermittent wrong-page bounces for legitimate users.

**Composing your own error text for a 403.** The backend already chose its wording, sometimes for
security reasons (a generic message, a 404 instead of a 403). Overriding it locally re-decides something
that was decided deliberately elsewhere.

---

## 8. Interview framing

**"How do you handle authorisation in your frontend?"**

> "The frontend doesn't authorise — it makes the UI honest about what the API will allow. There are four
> layers: NextAuth middleware for whole route prefixes, an `auth()` check in server components so the
> markup is never produced for the wrong role, conditional rendering to avoid offering actions that would
> fail, and then the actual boundary, which is `RolesGuard` in NestJS. Only the last one is security —
> the other three exist so users don't hit 403s they could have been spared. I verify the boundary with
> curl and a wrong-role token, because a browser test only proves the UI is polite."

**"What's the difference between a role check and an ownership check?"**

> "Different axes. A role answers 'are you the kind of user who may do this', which is answerable from
> the token alone — so it belongs in a guard. Ownership answers 'is this specific record yours', which
> needs the row loaded, so it belongs in the service. `@Roles('organiser')` on `PATCH /events/:id` lets in
> every organiser, including one editing someone else's event. Conflating the two is how IDOR bugs ship —
> and in our case the two failures even return different messages, so they're distinguishable in logs."
