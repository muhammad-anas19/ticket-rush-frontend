# NextAuth (Auth.js)

**Concepts doc — the technology itself.** No TicketRush code here; it should make sense to someone who
has never seen this repo. For how we wire it, read the M1 frontend walkthrough. For the graded Q&A
this remediates, see `backend/docs/qa/phase-1-auth-understanding-check.md` Q6–Q10.

Written against **next-auth v5 (5.0.0-beta.32)**. Where v4 differs materially it is called out,
because most tutorials and existing codebases are still v4 and mixing the two is a genuine source of
confusion.

---

## 1. What NextAuth actually is

**It is a session manager, not an identity provider.**

That sentence is the whole thing. NextAuth's job is:

1. Run a sign-in flow (OAuth dance, magic link, or your own credential check).
2. Turn the result into a **session** the browser carries.
3. Give your app a way to read that session on the server and on the client.
4. Refresh or expire the session.

What it does *not* do is store users, hash passwords, or decide what anyone is allowed to do. With an
OAuth provider it delegates identity to Google or GitHub; with a separate backend API it delegates to
that. Either way, NextAuth holds the cookie.

Understanding this cleanly prevents the most common architectural confusion: people expect NextAuth to
be "auth", find it does not manage their users table, and conclude it is broken.

### The pieces

| Piece | What it does |
|---|---|
| **Providers** | How someone proves who they are. OAuth (Google, GitHub), Email (magic link), or **Credentials** (you check it yourself). |
| **Session strategy** | Where session state lives — an encrypted cookie (`jwt`) or a database row (`database`). |
| **Callbacks** | Hooks where you shape the token and the session. `jwt` and `session` are the two that matter. |
| **Adapter** | An optional database layer for users, accounts and sessions. Required for the `database` strategy. |
| **Route handler** | A catch-all API route that serves NextAuth's own endpoints (`/api/auth/*`). |

---

## 2. Session strategies: where the state physically lives

### `jwt` — state in an encrypted cookie

The entire session is serialised, **encrypted**, and stored in a cookie in the user's browser.
Reading a session means decrypting that cookie. Nothing is stored server-side.

Note *encrypted*, not merely signed. NextAuth uses a **JWE** (JSON Web Encryption, A256GCM with the
key derived from your secret via HKDF), so unlike an ordinary JWT the contents are **not readable** by
the user or by anyone who intercepts the cookie. That is a meaningful difference from the access token
your API issues, which is signed only and readable by anyone.

```
Browser cookie:  authjs.session-token = <JWE blob>
Server storage:  none
Reading it:      decrypt with the secret
```

### `database` — state in a row

The cookie holds an opaque session ID. The real session lives in a `sessions` table, reached through
an **Adapter** (Prisma, Drizzle, TypeORM, and others).

```
Browser cookie:  authjs.session-token = <random id>
Server storage:  sessions row
Reading it:      SELECT by that id
```

### Choosing between them

| | `jwt` | `database` |
|---|---|---|
| Read cost | Decrypt a cookie | One query per session read |
| Server-side revocation | **Not possible** without building your own denylist | `DELETE` the row |
| "My active sessions" UI | Not possible | Trivial |
| Size limit | ~4 KB cookie ceiling | Unbounded |
| Needs an Adapter | No | **Yes** |
| Scales to many instances | Trivially — no shared store | Needs the database |

**The forcing constraint most people miss:** the **Credentials provider only supports the `jwt`
strategy.** It is not a performance preference you get to weigh — with Credentials, `database` is
unavailable.

The reason is structural. With OAuth, NextAuth owns user creation: it receives a profile from Google
and, via the Adapter, creates or links a user row it can then attach a session row to. With
Credentials, NextAuth never manages users — yours live wherever you keep them — so there is no
adapter-managed user record for a session row to point at.

**What you give up by being forced into `jwt`:** server-side revocation. A `jwt` session cookie is
self-contained and valid until it expires. You cannot invalidate it from the server without adding
your own denylist — which reintroduces exactly the shared state the strategy avoided.

That is the same tradeoff as a stateless access token, one layer up. If your API also issues
stateless tokens, you now have **two** independent credentials with the same staleness property, and
revoking someone's access properly means dealing with both.

---

## 3. The two callbacks

This is the part that most repays understanding, because getting it wrong produces a failure that
looks like something else entirely.

### `jwt({ token, user, account, trigger, session })`

Runs whenever the token is **created or updated**. Server-side only.

- **At sign-in**, with `user` and `account` populated. This is the *only* time they are.
- **On every subsequent session read**, when the cookie is decoded and re-encoded.

**Its return value is what gets encrypted into the cookie.** This is **storage**.

### `session({ session, token })`

Runs whenever the session is **read** — `useSession()`, `getSession()`, `auth()`. It receives the
decoded token and returns the object your application sees.

**Its return value is what the caller gets.** This is a **view**.

### Why they are separate, and why it is load-bearing

Because you regularly want to **store something you do not want to expose.**

The canonical case: a refresh token. It must be persisted so the `jwt` callback can use it on the next
run, and it must never reach the browser — because a stolen refresh token is an account takeover while
a stolen short-lived access token is a bounded incident.

```ts
async jwt({ token, user }) {
  if (user) {
    token.accessToken  = user.accessToken;
    token.refreshToken = user.refreshToken;   // stored, encrypted in the cookie
  }
  return token;
}

async session({ session, token }) {
  session.accessToken = token.accessToken;    // exposed to the client
  // refreshToken deliberately NOT copied — stays server-side
  return session;
}
```

One object is what you keep. The other is what you show. Collapse them into one function and that
distinction becomes inexpressible.

### The failure mode if you confuse them

If you set something only in `session` and never touch `jwt`:

`session` has no data source other than `token`. So the value is `undefined`, always — and the failure
is **misleading**:

- Sign-in *appears* to succeed. The redirect happens.
- The UI shows the user as logged in; `useSession()` returns a session object.
- Then every API call goes out with no `Authorization` header and comes back **401**.

Which looks like a backend problem, a token-expiry problem, or a CORS problem. It is none of those.

### `trigger` and `session` parameters

`jwt` also receives `trigger` (`'signIn'` | `'signUp'` | `'update'`) and, when triggered by an update,
the data passed to `update()` client-side. That is how you refresh session data without making the
user sign in again — e.g. after they change their name.

---

## 4. The secret

**v5 calls it `AUTH_SECRET`. v4 called it `NEXTAUTH_SECRET`.** v5 still reads the old name, which is
why you see both in tutorials.

**What it does:** encrypts and signs NextAuth's own session cookie (the JWE above). It also protects
NextAuth's built-in CSRF token and any email-verification tokens.

**What it is not:** the secret your backend API uses to sign its own tokens. Two secrets, two systems:

```
AUTH_SECRET        → encrypts the NextAuth session cookie      (owned by the Next.js app)
JWT_ACCESS_SECRET  → signs the access token your API issues     (owned by the API)
```

**If it changes while users are logged in:** every existing cookie becomes undecryptable, so everyone
is silently signed out. An availability problem, not a security one — but rotate it deliberately, not
by accident during a deploy.

**If it leaks:** an attacker can **forge a session cookie for any user** — construct a token claiming
`sub: <victim>`, encrypt it with the secret, and NextAuth accepts it. No password required. Treat it
as a signing key.

**A useful consequence of keeping the two secrets separate.** If `AUTH_SECRET` leaks but your API's
signing secret does not, the attacker gets a *convincing but hollow* session: they are "logged in" to
the Next.js UI, but the forged cookie contains no valid API access token, so every real request 401s.
That is genuine defence in depth, and it exists only because the two systems do not share a secret.

Generate one properly: `openssl rand -base64 32`.

---

## 5. The Credentials provider, and the warning

NextAuth's docs discourage Credentials. Worth knowing exactly what the warning is about, because the
answer changes depending on your architecture.

**The concern is password ownership.** Using Credentials means *you* store and verify passwords, and
the maintainers' view is that most teams get that wrong — weak hashing, no rate limiting, no reset
flow, no MFA, no breach detection. NextAuth's value proposition is delegating identity to someone who
has solved all that. Credentials opts out of the proposition.

There is a technical limitation bundled in: Credentials cannot use the `database` strategy (§2), and
cannot participate in account linking.

**When the warning does not really apply.** If password verification happens in a **separate backend**
that already has a hashing service, validation, and a users table, then your `authorize()` function is
a thin HTTP client — it POSTs credentials to your API and returns whatever came back. NextAuth never
sees a password hash. The "you'll get password handling wrong" concern is aimed at people implementing
the check *inside* `authorize()` against a database they wired themselves.

**What still applies:** you own the whole password lifecycle, and NextAuth helps with none of it. And
in that architecture you are using perhaps 20% of the library — session-cookie management,
`useSession()`, and a sensible place to put refresh logic. Being clear-eyed about that is better than
pretending NextAuth is doing more than it is.

```ts
Credentials({
  credentials: { email: {}, password: {} },
  async authorize(creds) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (!res.ok) return null;            // null → sign-in fails
    const { user, accessToken, refreshToken } = await res.json();
    return { ...user, accessToken, refreshToken };   // flows into jwt() as `user`
  },
})
```

Two details in there that catch people:

- **Return `null` to fail, don't throw.** A thrown error surfaces differently and, in v5, can leak
  through the error page. `null` produces a clean `CredentialsSignin` error.
- **Whatever you return becomes `user` in the `jwt` callback** — and only on that first call. If you
  do not copy it onto `token` there, it is gone.

---

## 6. Token refresh, and the race that bites everyone

With a separate API, your access token expires long before the NextAuth session does. The standard
place to handle that is the `jwt` callback, because it is the only callback that can modify what gets
persisted.

```ts
async jwt({ token, user }) {
  if (user) { /* first sign-in: store everything */ }

  if (Date.now() < token.accessTokenExpiresAt) return token;   // still valid

  return refreshAccessToken(token);   // expired: rotate
}
```

### The race

Several server components read the session concurrently. The access token has just expired. The `jwt`
callback fires in each of them, and each calls your refresh endpoint with the same refresh token.

If your API **rotates refresh tokens and detects reuse** — which is the correct design — then:

1. One request wins. The old token is marked spent, a new one issued.
2. The others arrive with the now-spent token.
3. **Reuse detection fires.** The whole token family is revoked.
4. The user is hard-signed-out mid-page-load, and your logs record a token theft that never happened.

It is intermittent — only in the narrow window after expiry, only when several components read at once
— so it presents as "users randomly get logged out sometimes."

### Why the browser-side fix does not transfer

In a browser you would deduplicate with a module-level promise:

```ts
let refreshPromise: Promise<...> | null = null;   // works in ONE tab, ONE module instance
```

Every caller shares that heap, so exactly one refresh happens. The `jwt` callback runs **on the
server**, which breaks the assumption three ways:

1. Multiple server components in a single render can each trigger it.
2. In serverless or multi-instance deployments, concurrent requests may run in **different processes** —
   separate heaps, so a module-level promise dedupes within a process, not across them.
3. You do not control when NextAuth invokes the callback; session reads you did not write drive it.

### The fixes, ranked

| Approach | Verdict |
|---|---|
| **Grace window on the API** — accept a just-rotated token for N seconds and return a valid pair | Best. Solves this *and* the lost-response case with one mechanism. N small (15–30s). |
| Distributed lock (Redis) keyed on the token family | Correct across instances. Heavier. The right answer at scale. |
| Module-level promise | Helps the single-instance case, free, incomplete. Fine as an extra layer. |
| Stop rotating refresh tokens | Removes the security property, not the race. No. |

The grace window has a cost worth stating: for N seconds after a rotation the old token still works, so
a thief racing the legitimate client wins. Bounded by keeping N short.

**Related failure the same fix covers:** a client refreshes, the server commits the rotation, and the
response is lost — sleeping laptop, dropped wifi. The client retries with a token the server has
already spent. Indistinguishable from theft on the wire. You cannot reliably tell them apart, so you
choose which error to prefer: a certain false logout for a real user, or a bounded replay window.

---

## 7. Reading the session

### v5

One universal helper, which is the main reason to prefer v5 with the App Router:

```ts
import { auth } from '@/auth';

// Server components, route handlers, server actions, middleware — all the same call
const session = await auth();
```

```tsx
'use client';
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
// status: 'loading' | 'authenticated' | 'unauthenticated'
```

`useSession()` needs a `<SessionProvider>` above it. Server-side `auth()` does not.

### v4, for comparison

```ts
import { getServerSession } from 'next-auth/next';
const session = await getServerSession(authOptions);   // must pass config every time
```

Separate helpers for pages, route handlers and middleware, and the config has to be threaded through.
That awkwardness is what v5 set out to remove.

### `status === 'loading'` matters more than it looks

On a fresh page load the client genuinely does not know yet whether a session exists. A component that
gates on `authenticated` alone, without checking `loading`, flashes a false signed-out state for the
instant before resolution — and if you redirect on that, you bounce logged-in users to the login page
intermittently.

---

## 8. Protecting routes

Two layers, and they do different jobs.

### Middleware — runs before the page

```ts
// middleware.ts
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

Runs at the edge, before any rendering. Cheapest place to redirect an unauthenticated visitor, and it
prevents the page shell rendering at all.

**Its limits are worth knowing.** Middleware runs in the Edge runtime — no Node APIs, no database
drivers. If your `authorized` logic needs a database, it cannot run there. That is why v5 documents a
**split config**: a slim `auth.config.ts` with only what middleware needs, and the full config
(providers, adapters) used everywhere else.

### A layout or page check — the real boundary

Middleware is a routing convenience, not the security boundary. The actual boundary is the API: your
backend must reject unauthorised requests regardless of what the frontend rendered. A client-side
redirect is UX; it is not access control, and treating it as such is how people ship "protected" pages
whose data is fetchable by anyone.

---

## 9. What to expect when things break

| Symptom | Usual cause |
|---|---|
| Signed in, but every API call 401s | Token set in `session` but never in `jwt` (§3) |
| Everyone signed out after a deploy | `AUTH_SECRET` changed or unset |
| `useSession()` returns null in a client component | No `<SessionProvider>` above it |
| Random intermittent sign-outs | The refresh race (§6) |
| Sign-in silently fails, no error | `authorize()` threw instead of returning `null` |
| Session data goes stale after an update | `jwt` returns early before applying `trigger === 'update'` |
| Cookie too large | Too much stashed in the token; the ~4 KB ceiling |

---

## 10. Interview mapping

| Bank Q | Topic | Section |
|---|---|---|
| — | Session cookie vs token in JS; XSS vs CSRF | §2, and Q3 of the M1 Q&A |
| Q152 | Authenticating a connection at the handshake | §7 — where the token actually lives |
| Q100 | Idempotency and safe retries | §6 — the grace window is idempotency applied to refresh |
| Q131 | Validate at the boundary; types erase at runtime | §5 — `authorize()` returns `any`-shaped JSON |

**The two answers most worth rehearsing:**

- *"Why NextAuth if your API already does auth?"* — It manages the session cookie, not identity. With
  a separate backend it is doing session storage, `useSession()`, and a place to put refresh logic. If
  we wanted Google sign-in it would be earning a lot more of its keep.
- *"How do you handle token refresh?"* — In the `jwt` callback, with a grace window on the API, because
  concurrent server-side refreshes would otherwise trip reuse detection and revoke the session. The
  browser trick of one shared in-flight promise does not work server-side across processes.
