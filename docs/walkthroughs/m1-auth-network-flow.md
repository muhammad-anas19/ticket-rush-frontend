# M1 — What actually goes over the network during auth

Traced against the real running app with DevTools open. Every claim here was read from
`node_modules/next-auth/react.js` or observed on the wire — not from the docs.

Companion to [m1-auth-code-walkthrough.md](m1-auth-code-walkthrough.md). Concepts in
[../concepts/01-nextauth.md](../concepts/01-nextauth.md).

---

## 1. Signing in with wrong credentials — four calls

All four return **200**, which is the first surprising thing.

| # | Request | Size | Time | Why it happens |
|---|---|---|---|---|
| 1 | `GET /api/auth/providers` | 0.5 kB | 68 ms | Look up the provider list |
| 2 | `GET /api/auth/csrf` | 0.4 kB | 57 ms | Fetch a CSRF token for the POST |
| 3 | `POST /api/auth/callback/credentials` | 0.4 kB | **410 ms** | The actual sign-in attempt |
| 4 | `GET /api/auth/session` | 0.3 kB | 59 ms | Re-read the session afterwards |

All four go to **localhost:3000** — the Next.js app, not the NestJS API. The browser never talks to
:3001 during sign-in. NestJS is called *server-to-server* from inside `authorize()`, which is why the
request to `/auth/login` does not appear in the network tab at all.

---

### Call 1 — `GET /api/auth/providers`

`signIn()` starts by fetching the configured providers:

```js
const providers = await getProviders();
if (!provider || !providers[provider]) { /* redirect to the default sign-in page */ }
const providerType = providers[provider].type;
const signInUrl = `${baseUrl}/${providerType === 'credentials' ? 'callback' : 'signin'}/${provider}`;
```

Two things it needs this for:

1. **Validating the provider id.** If `signIn('credentails')` were misspelled, it bails to NextAuth's
   own sign-in page rather than POSTing into nothing.
2. **Choosing the URL path** — the interesting part. The provider's `type` decides whether the POST
   goes to `/callback/…` or `/signin/…`. Credentials providers use **`/callback/`**, because from
   NextAuth's perspective submitting a password is the same *step* as returning from an OAuth redirect:
   the moment identity gets established. OAuth providers hit `/signin/` first, to be sent off to Google.

That is why call 3 is `callback/credentials` rather than `signin/credentials` — a detail that reads like
a mistake until you know it is derived from this call.

**One round trip purely to learn a string we already know.** Cheap and browser-cached, but worth
recognising as library generality rather than necessity.

---

### Call 2 — `GET /api/auth/csrf`

Fetches the token that call 3 must include in its body. Full explanation in §3 — the short version is
that NextAuth's own endpoints are **cookie-authenticated**, so unlike our NestJS API they genuinely do
need CSRF protection, and NextAuth implements it for us.

The response is small and dull:

```json
{"csrfToken":"baedbd99d7c5c33c95d76c8361b84e287b7fb050acb551…"}
```

It also **sets the `authjs.csrf-token` cookie** if one is not already present. That cookie and this
returned value are the two halves of the double-submit pattern.

---

### Call 3 — `POST /api/auth/callback/credentials` · **410 ms**

The real sign-in. Note the form encoding and the unusual header:

```
Content-Type: application/x-www-form-urlencoded
X-Auth-Return-Redirect: 1

csrfToken=…&email=…&password=…&callbackUrl=http://localhost:3000/login
```

`X-Auth-Return-Redirect: 1` is what makes this usable from JavaScript. Without it the endpoint answers
with a real **302** and the browser navigates away, losing everything. With it, the server returns
**200 plus a JSON body containing the URL it would have redirected to** — so `signIn()` can inspect the
outcome and hand it back to your code.

#### Why 410 ms — the one number worth reading

Inside this single request the Next.js server runs `authorize()`, which calls
`POST http://localhost:3001/api/auth/login`. NestJS then performs a **bcrypt comparison at cost 12**,
which is roughly 250 ms **by design**.

So 410 ms breaks down as roughly: bcrypt ~250 ms, plus two HTTP round trips, plus JSON handling.

That number is M1's deliberate slowness made visible. It is also why `POST /auth/login` is a
denial-of-service vector: unauthenticated, expensive by design, and the cost is paid *before* the
request can be rejected.

Note it takes ~410 ms **even though the credentials were wrong** — an unknown email still burns an
equivalent comparison, so response timing cannot be used to enumerate registered addresses.

#### Why it returns 200 on a failed login

The source explains it:

```js
const data = await res.json();
const error = new URL(data.url).searchParams.get('error') ?? undefined;
const code  = new URL(data.url).searchParams.get('code')  ?? undefined;
```

**The HTTP status describes the transport, not the authentication outcome.** The server successfully
processed a request and successfully produced an answer — the answer being "these credentials are
wrong". That answer lives in the returned URL's query string:

```
/login?error=CredentialsSignin&code=Invalid+email+or+password
```

`error` is a fixed category. **`code` is our backend's own message**, put there by the
`BackendCredentialsError` thrown in `authorize()` — the one channel NextAuth provides for getting text
out of a credentials check. `LoginForm` reads `result.code` and passes it straight to the toast, which
is why the screenshot shows the API's exact wording rather than something invented on the client.

---

### Call 4 — `GET /api/auth/session` — even though the login failed

One line of the source is the reason:

```js
if (res.ok) {
    await __NEXTAUTH._getSession({ event: 'storage' });
}
```

`res.ok` is true because call 3 returned **200**. NextAuth cannot tell from the status that the sign-in
failed, so it refetches the session unconditionally. That request decrypts the session cookie, runs our
`session` callback, and returns `null` because no session was created.

**So it is a wasted round trip on the failure path** — harmless, and now explicable rather than
mysterious. On a *successful* login the same call is essential: it is what populates `useSession()` so
every component re-renders as signed in.

---

## 2. What happens on sign-out

`signOut()` makes **two** calls — and until this trace, quietly failed to do the most important part.

```js
const csrfToken = await getCsrfToken();                       // 1. GET /api/auth/csrf
const res = await fetch(`${baseUrl}/signout`, {               // 2. POST /api/auth/signout
  method: 'post',
  headers: { 'X-Auth-Return-Redirect': '1' },
  body: new URLSearchParams({ csrfToken, callbackUrl }),
});
broadcast().postMessage({ event: 'session', data: { trigger: 'signout' } });
```

| # | Request | What it does |
|---|---|---|
| 1 | `GET /api/auth/csrf` | Sign-out is a state change, so it needs a token too — see §3 |
| 2 | `POST /api/auth/signout` | Clears `authjs.session-token` with an expired `Set-Cookie` |

Then `broadcast()` posts to a **BroadcastChannel**, which is how *other open tabs* learn about it
without polling. Sign out in one tab and a second tab updates itself.

### The bug this trace exposed

A cleared cookie is only half a logout. **Nothing was telling our NestJS backend anything**, so the
refresh-token family stayed live in Postgres for its full 7 days. Measured against the database:

```
after sign-in:          live refresh tokens = 2
session after signOut:  null                     ← looks logged out
after signOut:          live refresh tokens = 2  ← still valid for 7 days
```

That is exactly the failure logout exists to prevent, and precisely the P1 bug this project's notes
warn about — *logout appeared to work and never revoked anything server-side*.

**Fix 1** — an `events.signOut` hook in `shared/auth/index.ts`. It receives the decoded token, the only
place the refresh token is still reachable at sign-out time, and calls the backend's
`POST /auth/logout` to revoke the family.

**Fix 2, the deeper one.** After fix 1 there was *still* one live token, belonging to a **second
family**:

```
family 80c10f52…  revoked_reason = (none)   ← created by REGISTER, never revoked
family 515175c7…  revoked_reason = logout   ← created by SIGN-IN, revoked correctly
```

`POST /auth/register` was returning a token pair. `RegisterForm` cannot use it — NextAuth only mints a
session through `authorize()`, so it registers and then calls `signIn()`, discarding whatever register
returned. That discarded pair was **a live credential nobody held and nothing would ever revoke**,
because logout revokes the family of the token it *has*, which is the sign-in family.

**Every signup leaked one live refresh-token family for 7 days.**

Fixed at the source: `/auth/register` now returns the user only. Issuing a credential that no client
consumes is pure liability.

Verified end to end:

```
register  → live tokens = 0     (was 1)
sign in   → live tokens = 1
sign out  → live tokens = 0     (was 2),  revoked_reason = logout
```

### Still missing, named honestly

- If the `events.signOut` fetch fails — backend down mid-logout — the error is swallowed so the cookie
  still clears, trading a definite local failure for a possible remote one. The original bug then
  applies for up to 7 days. A periodic sweep of expired and orphaned tokens is on the M8 list.
- `signOut()` ends **one** family, so other devices stay signed in. Correct and deliberate — "log out
  everywhere" is a different feature that would revoke by `user_id`.

---

## 3. What CSRF actually is

Worth being precise about, because this project deliberately has CSRF protection in one place and
deliberately none in another, and that looks inconsistent until you see why.

### The attack

**CSRF is cross-site request forgery.** You are logged into `yourbank.com`. You visit `evil.com`, which
contains:

```html
<form action="https://yourbank.com/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="5000">
</form>
<script>document.forms[0].submit()</script>
```

Your browser sends that POST **and attaches your `yourbank.com` cookies automatically**, because that is
what cookies do — the browser does not care which site initiated the request. The bank sees a properly
authenticated request and performs the transfer.

**The attacker never reads anything.** They cannot see your cookie and cannot see the response. They do
not need to. They only need the browser to *send* the credential on their behalf.

That property has a name worth knowing: **ambient authority**. A cookie is attached without the page
asking, so any page can spend it.

### Why our NestJS API needs no CSRF protection

Because it authenticates with `Authorization: Bearer <token>`, and **a browser never attaches that
header automatically.** JavaScript must set it explicitly, and JavaScript on `evil.com` cannot read a
token held in our origin's memory.

So a forged cross-origin request to our API arrives with **no credentials at all** and is simply a 401.
Not "defended against" — structurally not applicable.

That is one half of the trade in `TR-DEC-001`: we gave up httpOnly's XSS protection and got CSRF
immunity for free. P1 needed a `csrf_token` cookie, a `CsrfGuard`, an axios interceptor, and route
exemptions to reach the same safety with cookies — and still shipped two bugs doing it.

### Why NextAuth's own endpoints DO need it

The part that looks contradictory and is not.

NextAuth's endpoints — `/api/auth/callback/credentials`, `/api/auth/signout` — are **cookie-based**.
They read `authjs.session-token` and `authjs.csrf-token` from cookies, so they have exactly the ambient
authority problem above. Unprotected, `evil.com` could POST to `/api/auth/signout` and log you out, or
attempt sign-ins on your behalf.

So: **the API we built is CSRF-immune; the auth library in front of it is not, and protects itself.**
Both statements are true at once.

### The double-submit cookie pattern

NextAuth's defence, and the reason for calls 2 and 4 above:

1. `GET /api/auth/csrf` sets a cookie **and** returns the token value in the body.
2. Every state-changing POST must include that value **in its body**.
3. The server compares body value against cookie value. Mismatch or missing → rejected.

Why it works, in one sentence: **`evil.com` can cause your browser to send our cookie, but cannot
*read* it** — the same-origin policy stops that — so it cannot put the matching value in the body.

The attacker can forge the request. They cannot forge the *pair*.

NextAuth's cookie is `authjs.csrf-token`, and it is deliberately **not** `httpOnly`, because its own
JavaScript has to read it. That is not a weakness: a CSRF token is not a secret the way a session token
is. Its only job is to be unavailable to *other origins*, which the same-origin policy already
guarantees.

### Related, and routinely confused with it

- **`SameSite` cookies** are a second, independent layer. `SameSite=Lax` — the modern browser default —
  stops cookies being sent on most cross-site POSTs, which kills the classic attack outright. Double
  submit is defence in depth for what `Lax` does not cover and for older browsers.
- **CORS is not this.** CORS governs whether JavaScript may *read a response*. CSRF is about a request
  being *sent* with credentials. A CSRF attack does not need to read anything, so CORS does not stop it.
  Confusing the two is extremely common — see the M0 walkthrough, where a request from a disallowed
  origin still returned 200 with a full body.
- **CSRF is not XSS.** XSS runs code *on your site* and can therefore do anything you can, including
  reading a CSRF token. **CSRF protection does not survive XSS**, and is not meant to.

---

## 4. Quick reference

```
SIGN IN  (all to :3000 — the browser never touches :3001)
  GET  /api/auth/providers             validate provider id, derive callback-vs-signin path
  GET  /api/auth/csrf                  double-submit token + cookie
  POST /api/auth/callback/credentials  ~410ms — bcrypt(12) runs inside this
        └─ server-side only: POST :3001/api/auth/login    ← invisible in DevTools
  GET  /api/auth/session               refetched even on failure, because the status was 200

SIGN OUT
  GET  /api/auth/csrf                  state change, needs a token
  POST /api/auth/signout               expires the session cookie
        └─ events.signOut → POST :3001/api/auth/logout    ← revokes the family (added after a real bug)
  BroadcastChannel                     other tabs update without polling
```

**Three things to take away:**

1. A **200** on `/callback/credentials` does not mean the login worked. The outcome is in the returned
   URL's query string, not the status code.
2. **410 ms is bcrypt**, deliberately — and it is paid even for a wrong password, so timing cannot
   enumerate accounts.
3. A cleared cookie is **not** a logout. Anything the server issued has to be revoked at the server.
