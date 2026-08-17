# CLAUDE.md — TicketRush frontend

Next.js App Router · TypeScript · Feature-Sliced Design · SCSS modules · NextAuth · axios ·
TanStack Query · React Hook Form + Yup

Shared project context, the working protocol, and the module plan are in
[../CLAUDE.md](../CLAUDE.md). Architecture decisions are in [../DECISIONS.md](../DECISIONS.md).
Module detail is in [docs/phases.md](docs/phases.md).

**Scope discipline:** no design work. Plain and lightly styled. Nobody is going to look at it. Every
hour on visual polish is an hour not spent on the five technologies this project exists to teach.

---

## 1. Feature-Sliced Design

```
src/
├── app/        Next routing, layouts, providers (SessionProvider, QueryClientProvider)
├── pages/      Page compositions
├── widgets/    Standalone blocks combining features + entities
├── features/   User interactions producing business value
├── entities/   Domain: model/ (types), api/ (axios), hooks/ (useQuery/useMutation), ui/
└── shared/     UI atoms, SCSS tokens, axios client, socket client, utilities — imports from nothing
```

| Layer | May import from |
|---|---|
| `app` | everything below |
| `pages` | `widgets`, `features`, `entities`, `shared` |
| `widgets` | `features`, `entities`, `shared` |
| `features` | `entities`, `shared` |
| `entities` | `shared` |
| `shared` | **nothing** |

**Strict import rule:** lower layers never import from higher ones, and same-layer cross-imports are
forbidden. **Nothing else lives at `src/` root.** P1's real tree violated this — FSD layers sitting
beside legacy `components/`, `context/`, `lib/`, `types/`. Don't repeat it (`TR-DEC-005`).

**Every entity gets the same three folders**, no exceptions: `model/` (types), `api/` (axios calls),
`hooks/` (`useQuery`/`useMutation`). Query keys and their matching invalidation live in **exactly one
place per entity** — never inline in a page component. P1 learned this the hard way and refactored to
it late; here it is the starting position.

Entities in this project: `event`, `hold`, `order`, `ticket`, `user`.

---

## 2. Naming

- **Components and UI files:** PascalCase. Stylesheets: `ComponentName.module.scss`.
- **Hooks, utils, services:** camelCase — `useEventAvailability.ts`, `formatCents.ts`.
- **FSD slice folders:** kebab-case — `create-hold`, `event-list`.
- **Types:** PascalCase, no `I` prefix. `EventSummary`, never `IEvent`.
- **SCSS classes:** BEM-ish kebab-case — `.event-card`, `.event-card__title`,
  `.event-card--sold-out`.
- One component per file. Prop interfaces explicitly declared and exported alongside the component.

---

## 3. Styling

### SCSS 7-1 architecture

```
src/shared/styles/
├── abstracts/     _variables.scss, _mixins.scss, _functions.scss   (no compiled output)
├── base/          _reset.scss, _typography.scss
├── layout/        grid, page shells
├── themes/        light / dark tokens
└── index.scss
```

### The `em` rule (strict)

Root `html`/`body` font-size is declared **once** as `16px` in `base/_typography.scss`.

> **No explicit `px` for font-size, padding, margin, width, or height in component modules.** All
> sizing in `em`, so components scale proportionally with their container's font-size.
> **Only exceptions:** hairline borders (`1px solid`) and box-shadow blur/spread.

Be deliberate about **compounding** — `em` is relative to the element's *own* computed font-size,
inherited from its parent. `0.875em` inside a container already at `0.8em` computes to `0.7em`
(11.2px). Nested wrappers that each set a font-size shrink text unintentionally.

### Design tokens (`shared/styles/abstracts/_variables.scss`)

HSL, exposed as CSS custom properties for runtime theme switching.

```scss
$color-primary-50:  hsl(225, 100%, 96%);
$color-primary-500: hsl(225, 73%, 57%);   // brand accent
$color-primary-700: hsl(225, 68%, 42%);

$color-neutral-900: hsl(222, 47%, 11%);   // background
$color-neutral-800: hsl(217, 33%, 17%);   // card / surface
$color-neutral-700: hsl(215, 25%, 27%);   // borders / dividers
$color-neutral-400: hsl(215, 16%, 57%);   // muted body text
$color-neutral-100: hsl(210, 40%, 98%);   // headings / high contrast

$color-success: hsl(142, 71%, 45%);
$color-warning: hsl(38, 92%, 50%);
$color-danger:  hsl(359, 68%, 60%);
$color-info:    hsl(199, 89%, 48%);
```

| Scale | Values |
|---|---|
| Font size | `xs .75em` · `sm .875em` · `md 1em` · `lg 1.125em` · `xl 1.5em` · `2xl 2em` |
| Spacing | `3xs .125em` · `2xs .25em` · `xs .5em` · `sm .75em` · `md 1em` · `lg 1.5em` · `xl 2em` · `2xl 3em` |
| Radius | `sm .25em` · `md .375em` · `lg .5em` · `full 9999em` |

### Base atoms (`shared/ui/`)

`Button` (primary/secondary/ghost/danger × sm/md/lg, with a loading state) · `Input` · `Select` ·
`Checkbox` · `Badge` · `Card` · `Skeleton` (block/text/circle) · `ModalShell` · `DrawerShell`.

Each handles default, hover, focus ring, disabled, and error states. Port from P1 rather than
rewriting.

### When a shared component is justified

> Only when it abstracts shared **interactive behavior** — pagination, sorting, focus trapping,
> keyboard handling, transition logic.

Two screens that merely *look* similar but carry different domain logic must stay separate
compositions over shared atoms. Merging them produces a brittle abstraction and a props explosion.

---

## 4. Data and state

### Three mandatory UI states

Every data-consuming component implements all three. **Full-page spinners are forbidden** for widget
or table data.

1. **Loading** — `Skeleton` blocks matching the final layout, not a spinner.
2. **Empty** — icon, title, description, and an action, when `data.length === 0`.
3. **Error** — banner with the failure reason and a Retry action.

### State ownership

| Tier | Home | Example |
|---|---|---|
| Server state | **TanStack Query** — never mirrored into a global store | event list, availability |
| URL state | query params via `useSearchParams()`/`useRouter()` | `?page=2&search=jazz` |
| UI state | local `useState` | `isModalOpen`, `activeTab` |
| Session | NextAuth `useSession()` | current user, role |

All search, filter, sort, and page values live in the URL so views are shareable and browser
back/forward work. React Context is only for genuinely cross-cutting concerns, never as a
prop-drilling shortcut for a localised feature.

### Forms

React Hook Form + Yup via `@hookform/resolvers`. **Use `Controller`, not `register`**, for the custom
`shared/ui` inputs — `register` relies on an uncontrolled native input ref, which custom components
don't expose.

**Convert at the boundary.** Price is entered in currency and submitted in **integer cents**; the
form does that conversion explicitly, in one place, with a test. Getting this wrong is a money bug.

---

## 5. Auth — NextAuth

NextAuth owns the browser session entirely (`TR-DEC-001`). The P1 auth architecture — httpOnly
cookies issued by NestJS, CSRF double-submit, an axios 401→refresh→retry interceptor — **does not
apply here**.

```
Credentials provider → POST /api/auth/login (NestJS)
                     → { user, accessToken, refreshToken } in the response body
                     → jwt callback stores them in NextAuth's encrypted httpOnly session cookie
                     → session callback exposes accessToken to the client
                     → axios request interceptor attaches Authorization: Bearer
```

**`TR-DEC-002` — the access token is readable by client JavaScript.** This is the project's weakest
security posture and it was chosen deliberately, to keep axios and TanStack Query talking directly to
NestJS. The stricter alternative is a full BFF where every call goes through a Next route handler and
no token ever reaches the browser. Know which one you built and why.

**The trap to handle deliberately, not discover:** several components refreshing at once means the
second presents an already-rotated refresh token, which a backend with reuse detection reads as theft
and answers by killing the session. Solve it with a single in-flight refresh promise inside the `jwt`
callback. P1 hit exactly this in its axios interceptor.

---

## 6. Accessibility baseline — before any component is complete

- [ ] Every interactive control is Tab-reachable with a **visible focus ring**.
- [ ] `Escape` closes modals, drawers, and dropdowns.
- [ ] Inputs have an associated `<label>` or `aria-label`.
- [ ] Semantic elements — `<table>/<thead>/<th>/<td>`, and `<button>`, never `<div onClick>`.
- [ ] WCAG AA contrast (4.5:1 for normal text).

---

## 7. Hard-won lessons from P1

**Normalise at the API boundary, and test through the UI.** The backend returned a nested `role`
object where the frontend's type said flat string. TypeScript's structural typing didn't catch it —
the mismatch only mattered once the value was *rendered* — and months of curl testing never rendered
anything. It surfaced as `Objects are not valid as a React child` the first time real data reached
JSX. Every entity gets an explicit adapter in `entities/<x>/api/`, applied at every call site.

**A missing route guard is invisible when components degrade gracefully.** A dashboard rendered
fully for unauthenticated visitors for most of that project, unnoticed because the Topbar fell back
to placeholder text instead of breaking. Guard on **both** `isLoading` and `isAuthenticated` — the
first covers the window before the session is known (otherwise you flash a false logged-out state),
the second covers the window after it's known but before the redirect commits.

**Parallel 401s trigger parallel refreshes and look like theft.** Five widgets load at once, all get
401, all call refresh; the first rotates the token and the rest present a consumed one. A single
module-level in-flight promise fixes it; cap retries at one per request so a genuinely dead token
fails instead of looping.

**Don't reinvent a library you're about to import.** P1's hand-rolled `fetchClient` and `useApiQuery`
had each started reimplementing pieces of axios and TanStack Query before being replaced. If a
utility is growing interceptors, retries, or a cache, that's the signal.

---

## 8. Project-specific frontend traps

Flagged now so they aren't discovered late:

- **The countdown timer must be driven by the server's `expiresAt`**, not a client-side clock started
  at render. Clock skew and a backgrounded tab both break the naive version.
- **The Stripe success page cannot be trusted.** A user can navigate to it directly. It is a UI
  convenience; the webhook is the source of truth. Poll or subscribe for the order's real status
  rather than asserting success. This is *why* webhooks exist rather than client callbacks.
- **A ticket may not exist yet** a second after payment — that is the honest consequence of
  asynchronous fulfilment. Show a pending state, not an empty table.
- **Live availability updates go into the TanStack cache via `setQueryData`**, not by triggering a
  refetch. A socket message that causes an HTTP request has saved nothing.
