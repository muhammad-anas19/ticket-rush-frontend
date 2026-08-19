# M1 Frontend — NextAuth: Code Walkthrough

**How this project uses what `concepts/01-nextauth.md` explains.** Read that first.

**Status:** complete and verified live against the real backend. `next-auth@5.0.0-beta.32`, Next 15.5.

---

## 1. What exists

```
frontend/src/
├── shared/auth/
│   ├── config.ts        slim config for middleware (Edge-safe): pages, session strategy, authorized
│   ├── index.ts         full config: Credentials provider, jwt + session callbacks, refresh
│   └── types.ts         module augmentation — Session, User, JWT
├── app/
│   ├── api/auth/[...nextauth]/route.ts   export const { GET, POST } = handlers
│   ├── providers.tsx    SessionProvider wrapping QueryClientProvider
│   ├── page.tsx         renders SessionPanel
│   └── (auth)/
│       ├── layout.tsx   shared card shell (route group — no /auth/ in the URL)
│       ├── login/page.tsx      Suspense boundary + LoginForm
│       └── register/page.tsx   RegisterForm
├── middleware.ts        built from the SLIM config
├── features/auth/
│   ├── model/schemas.ts     Yup: login + register
│   └── ui/{LoginForm,RegisterForm}.tsx
├── entities/user/
│   ├── model/user.types.ts
│   └── api/user.api.ts      registerUser, fetchMe
├── widgets/session-panel/   M1 verification surface
└── shared/ui/{Input,Select}  added for the forms
```

---

## 2. The decisions visible in the code

### Split config, because middleware runs on the Edge

`shared/auth/config.ts` holds only what middleware needs; `shared/auth/index.ts` composes it with the
Credentials provider. Middleware runs in the Edge runtime — no Node APIs, no database drivers — so
importing the full config risks a build failure or a bloated edge bundle. Our provider only uses
`fetch`, so it would *probably* survive; following v5's documented split keeps that an accident rather
than a dependency.

Confirmed by the build output: `ƒ Middleware  86.5 kB`.

### The `jwt` callback stores; the `session` callback shows

This is the whole design, and it is what `TR-DEC-018` rests on:

```ts
jwt:     token.accessToken, token.refreshToken   // both — encrypted into the cookie
session: session.accessToken                      // only one — refreshToken never crosses
```

A stolen 15-minute access token is a bounded incident. A stolen 7-day refresh token is an account
takeover. **One extra line in `session()` would convert one into the other**, which is precisely why
the two are separate functions rather than one.

Verified against the live session endpoint — `accessToken` present, `refreshToken` absent:

```json
{"user":{"email":"…","id":"…","role":"organiser"},
 "expires":"2026-08-24T…","accessToken":"eyJhbGciOiJIUzI1NiIs…"}
```

### Refresh lives server-side, and the race is handled on the backend

`refreshAccessToken()` runs inside the `jwt` callback. There is deliberately **no** 401 → refresh →
retry interceptor in axios — the browser has no refresh token to refresh with.

The race (several server components refreshing at once, all presenting the same token, reuse detection
revoking the family) is handled by the backend's 30-second grace window, `TR-DEC-017`. The browser
trick of one shared in-flight promise does not transfer: the callback runs server-side and may execute
in different processes with separate heaps. Verified in M1 backend testing — five concurrent refreshes
all returned 200.

Two smaller details in that function that matter:

- **`cache: 'no-store'`** on the refresh fetch. Next.js caches `fetch` aggressively by default, and a
  cached refresh response would replay a spent token straight into reuse detection.
- **Refresh 30 seconds early**, not at expiry. Without the skew a request that passes the check can
  still reach the API with a token that expired in flight — likelier than it sounds once clock drift
  between hosts is involved.

### `authorize()` throws a `CredentialsSignin` subclass, not a bare `Error` — and not `null`

`null` is the documented way to fail, and it is right when you have nothing to say. But it **discards
the backend's message**, and this project's rule is that the user sees the API's exact wording. So
`authorize()` throws a small `BackendCredentialsError extends CredentialsSignin` whose `code` carries
the message — see "Errors are relayed, never rewritten" below.

The distinction that matters: the "throwing leaks information" warning is about throwing an **arbitrary
`Error`**, whose message Auth.js may surface on its own error page. A `CredentialsSignin` subclass is
the supported path, and `code` is the field designed to cross that boundary. It is still only safe
because the backend sanitised the message first.

### Login goes through `signIn()`; registration does not

An asymmetry worth understanding rather than tidying away.

`signIn('credentials', …)` routes through NextAuth's own endpoint, which runs `authorize()`, then the
`jwt` callback, then sets the encrypted cookie. **Calling `/auth/login` directly from the form would
return a valid token pair that NextAuth never learns about** — the user holds working credentials and
has no session.

Registration has no such constraint, so `RegisterForm` calls the API and *then* `signIn()`. The cost
is that the password is bcrypt-verified twice, ~500ms total. Accepted: the alternative is a second
NextAuth provider that trusts pre-issued tokens, which is more machinery and a wider trust surface for
one extra hash on a once-per-user path.

### `router.refresh()` after sign-in

Easy to omit and confusing when you do. Server components hold the session, and the router cache still
holds the pre-login render — so without it the UI shows a signed-out state until a manual reload, which
reads as "the login didn't work" when it did.

### `forwardRef` on Input and Select

React Hook Form's `register()` attaches a ref to the underlying native element to read values without
re-rendering per keystroke. A component that swallows the ref **fails silently**: the field never
appears in form values, and validation "passes" because there is nothing to validate.

---

### Errors are relayed, never rewritten

`shared/api/errorMessage.ts` reads the backend's message; nothing in `features/` or `widgets/`
composes its own. Failures surface as **react-hot-toast** toasts showing the API's exact string.

The reason is not brevity — it is that **the backend already owns the decision**. `/auth/login`
returns a deliberately generic "Invalid email or password" for both a wrong password and an
unregistered address, and pays for an equivalent bcrypt comparison on the unknown-email path so the
response *time* cannot distinguish them either. When the form substituted its own wording it was
duplicating a security decision made elsewhere — and the two copies could drift, so that tightening
the API's message silently changed nothing in the UI.

Corollary worth stating: **a badly-worded error is now a backend bug**, fixed in the DTO or the
exception, not patched over in a component.

The earlier `RegisterForm` branched on status codes — rewriting 409 into its own sentence, attaching
it to the email field, and falling through to "Something went wrong" for anything unanticipated. It
looked more polished and was worse on all three counts.

**One thing NextAuth makes genuinely hard here.** `authorize()` returning `null` produces a bare
`CredentialsSignin` error and **discards the backend's message** — NextAuth does not forward arbitrary
text from a credentials check. The single channel it offers is `CredentialsSignin.code`, which lands in
the redirect URL and comes back as `result.code` from `signIn()`. So `authorize()` throws a small
`BackendCredentialsError` carrying the message.

Auth.js warns that `code` reaches a URL and must not hint at anything sensitive. That is satisfied
*because* the backend already sanitised it — verified on the wire, and identical for both failure
causes:

```
wrong password → location: /login?error=CredentialsSignin&code=Invalid+email+or+password
unknown email  → location: /login?error=CredentialsSignin&code=Invalid+email+or+password
```

Two notes on the toasts themselves. They fire from a `useEffect`, not a render body — `toast.error()`
writes to a store outside React, so calling it during render stacks a duplicate on every re-render;
each is given a stable `id` so a repeat replaces rather than piles up. And error toasts carry
`role="alert"` with `aria-live="assertive"`, because a toast that only appears visually is invisible to
the users most likely to need it.

The inline error state in `SessionPanel` is kept **alongside** the toast: the toast is transient and
announced, the inline state is the persistent record of a region that failed to load, which the
three-mandatory-UI-states rule requires. Both render the same unmodified string, so they cannot
disagree.

---

## 3. What surprised me

### Returning `false` from `authorized` did nothing on the login page

The intent was: signed-in users visiting `/login` get sent home. The first version returned
`!isLoggedIn`, which is `false` when signed in. It had no effect — `/login` returned 200.

Because **`false` does not mean "block"; it means "redirect to `pages.signIn`"** — which *is*
`/login`. Redirecting `/login` to `/login` is a loop, so NextAuth short-circuits it and renders the
page. The check silently no-op'd.

The fix is an explicit redirect, which is why the callback's return type is `boolean | Response`:

```ts
if (isAuthPage && isLoggedIn) return Response.redirect(new URL('/', nextUrl));
```

`false` remains correct for genuinely protected routes in M2 — bouncing an unauthenticated visitor to
the login page is exactly what should happen there. The lesson is that the boolean encodes a
*destination*, not a permission.

Verified after the fix: `/login` and `/register` both 302 to `/` when signed in, 200 when signed out.

### `handlers` is an object, not named exports

`export { GET, POST } from '@/shared/auth'` fails — `NextAuth()` returns `{ handlers, auth, signIn,
signOut }`, and the route handlers are inside `handlers`. A route file must export functions literally
named `GET`/`POST`, so they have to be destructured:

```ts
export const { GET, POST } = handlers;
```

### `useSearchParams()` needs a Suspense boundary or the build fails

`LoginForm` reads `?callbackUrl=`. In the App Router that opts the component into client-side
rendering for search params, and **`next build` errors** without a boundary. A build-time failure, not
a runtime one — so it is easy to hit for the first time at deploy.

### The session cookie really is encrypted, not just signed

Worth confirming rather than assuming, because it differs from the access token:

```
segments: 5          (5 = JWE; a plain JWT has 3)
header:   {"alg":"dir","enc":"A256CBC-HS512","kid":"…"}
payload:  unreadable
```

So unlike the API's access token — signed, and readable by anyone who pastes it into jwt.io — the
NextAuth cookie's contents are opaque to the user and to anyone intercepting it. That is what makes it
a safe place for the refresh token.

---

## 4. Verified live

| Check | Result |
|---|---|
| `next build` | ✅ 6 routes, middleware 86.5 kB |
| Typecheck | ✅ clean |
| `GET /api/auth/session` (signed out) | ✅ `null` |
| `GET /api/auth/csrf` | ✅ token issued |
| Register via API | ✅ 201 |
| **NextAuth credentials sign-in** | ✅ 302, `authjs.session-token` set |
| Session exposes `accessToken` | ✅ |
| **Session omits `refreshToken`** | ✅ **`TR-DEC-018` confirmed** |
| Session token → `GET /api/auth/me` | ✅ 200 with real DB data |
| Session cookie is a JWE | ✅ 5 segments, payload unreadable |
| `/login` signed in | ✅ 302 → `/` *(was 200 before the fix)* |
| `/register` signed in | ✅ 302 → `/` |
| `/login` signed out | ✅ 200 |
| **Backend message crosses NextAuth** | ✅ `code=Invalid+email+or+password` |
| **Identical for wrong-password vs unknown-email** | ✅ no enumeration via the message |
| 409 relayed verbatim | ✅ "An account with that email already exists" |
| 400 field errors relayed verbatim | ✅ all three joined, none summarised |
| No hardcoded messages in `features/` or `widgets/` | ✅ grep clean |

The `/auth/me` result is the one that matters: it proves the token was **accepted** by NestJS, not
merely decoded, because that endpoint reads the database rather than echoing the token's claims.

---

## 5. Known gaps

- **The refresh path has not been exercised end to end.** It requires waiting out a 15-minute access
  token, or temporarily setting `JWT_ACCESS_EXPIRES_IN=1m`. P1 found two real bugs by doing exactly
  that, so it is worth doing deliberately before M2 rather than trusting the code.
- **`session.error === 'RefreshTokenError'` renders a banner but does not force a sign-out.** The user
  can sit on a dead session until they click through. A `signOut()` on that condition would be
  tidier.
- **No tests.** M8. Everything above was verified by hand over real HTTP, which is not the same thing.
- **`getSession()` in the axios interceptor is client-only.** Server-side callers must use `auth()` and
  pass the token explicitly. Nothing does yet; M2 will, and the guard clause is there so it fails
  loudly rather than silently sending an unauthenticated request.

---

## 6. Running it

```bash
cd backend  && docker compose up -d && npm run start:dev   # :3001
cd frontend && npm run dev                                  # :3000
```

Requires `AUTH_SECRET` in `frontend/.env.local` (`openssl rand -base64 32`). Visit
http://localhost:3000, create an account, and the panel shows the session, the exposed access token,
the absent refresh token, and a live authenticated `/auth/me` call.
