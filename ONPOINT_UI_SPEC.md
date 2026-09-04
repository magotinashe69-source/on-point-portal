# On Point — UI Specification

How screens in this app are built: the tokens they draw from, the two skins, the
components they are assembled from, and the states every one of them must have.

Companion documents: **`AUDIT.md`** (what the screens looked like before this
work and what was fixed), **`CLAUDE.md`** (house style, stack, how to work here).

---

## How to read this

Not everything here is built. Each section is marked:

| Mark | Meaning |
|---|---|
| **BUILT** | In the code now. Use it. |
| **PARTIAL** | Exists but not adopted everywhere. Use it in new work; migrate when you touch old work. |
| **PLANNED** | Specified here, not yet implemented. Do not assume it exists. |

Treat **BUILT** sections as rules and **PLANNED** sections as the agreed design
for when someone gets to them.

---

## 1. Foundations — the token layer · **BUILT**

Tailwind **3.4.17** builds the CSS. This is a v3 config, not v4 `@theme`.
(`@tailwindcss/vite` is in `package.json` but is never registered in
`vite.config.ts` and does nothing — see §8.)

Two files, two jobs:

- **`tailwind.config.ts`** — the *shape*: which utility names exist. Colours are
  indirection only: `hsl(var(--primary) / <alpha-value>)`.
- **`client/src/index.css`** — the *values*: `:root` (light), `.dark` (dark), and
  scope blocks.

### 1.1 The one rule that will bite you

Every colour variable is a **bare HSL channel triplet** — `218.3 52.7% 25.7%` —
never a hex string.

```css
--primary: 218.3 52.7% 25.7%;   /* correct */
--primary: #1F3864;             /* breaks ~90 call sites, silently */
```

The config wraps them as `hsl(var(--x) / <alpha-value>)`, which is what makes
`bg-primary/10`, `border-gold/30` and friends work. A hex value here does not
error — the opacity modifiers just stop working.

Brand triplets are given to one decimal place because they round-trip *exactly*
to the brand hex. Rounding to whole numbers drifts navy to `#1F3965` and gold to
`#C29100` — i.e. not the brand colours.

### 1.2 Spacing — IBM Carbon scale

The only sanctioned step values. They all land on Tailwind's native 4px keys, so
`p-4` is still 16px.

| Key | px | Carbon |
|---|---|---|
| `0.5` | 2 | `$spacing-01` |
| `1` | 4 | `$spacing-02` |
| `2` | 8 | `$spacing-03` |
| `3` | 12 | `$spacing-04` |
| `4` | 16 | `$spacing-05` |
| `6` | 24 | `$spacing-06` |
| `8` | 32 | `$spacing-07` |
| `10` | 40 | `$spacing-08` |
| `12` | 48 | `$spacing-09` |
| `16` | 64 | `$spacing-10` |
| `20` | 80 | `$spacing-11` |
| `24` | 96 | `$spacing-12` |
| `40` | 160 | `$spacing-13` |

`0` and `px` are shape primitives, not steps.

> **Not yet enforced.** 328 uses across 56 class names sit outside this scale and
> are quarantined in `LEGACY_SPACING` in `tailwind.config.ts` with a burn-down
> list. Deleting a spacing key does **not** raise an error — Tailwind stops
> emitting the class and the layout silently collapses — which is why they were
> quarantined rather than removed. **Do not use a legacy key in new code.**

### 1.3 Type — IBM Carbon scale

**Typefaces.** **Sora** for headings and display text, **DM Sans** for body,
**JetBrains Mono** for the three monospace spots.

| Family | Token | Utility | Applied to |
|---|---|---|---|
| Sora | `--font-heading` | `font-heading` | `h1`–`h6` and every `text-heading-*` token, automatically |
| DM Sans | `--font-sans` | `font-sans` | `body` — i.e. everything else |
| JetBrains Mono | `--font-mono` | `font-mono` | Pasted input, chart tooltips, the recording timer |

Headings are wired in `@layer base` on **both** routes to a heading — the real
elements *and* the Carbon heading tokens, since a card title is often a `<div>`
carrying `text-heading-03` rather than an `<h3>`. Nothing needs a `font-*` class
to get the right face. Use `font-heading` only for display text that is not a
heading element (the wordmark, the landing stat numbers, the match shout).

**Weights are loaded, not assumed.** Only these are downloaded:

| Family | Weights | Why those |
|---|---|---|
| Sora | 600, 700, 800 | Headings are semibold / bold / extrabold |
| DM Sans | 400, 500, 600, 700 | 500 is the most-used weight in the app (129 uses) |
| JetBrains Mono | 400, 500, 700 | The only weights paired with `font-mono` |

Do not add a weight to markup without adding it to the link in
`client/index.html` — an unloaded weight is silently faked by the browser.

No italic axes are loaded. The app has two italic uses; the browser slants them
rather than doubling the download.

Every step carries its own line-height *and* letter-spacing. Carbon tightens only
the small steps: `0.32px` at 12px, `0.16px` at 14px, `0` from 16px up.

| Token | px / line-height / tracking | Use |
|---|---|---|
| `text-caption-01` `text-label-01` `text-helper-01` | 12 / 16 / 0.32 | Captions, field labels, helper text |
| `text-body-compact-01` `text-heading-compact-01` | 14 / 18 / 0.16 | Dense UI — table cells, staff lists |
| `text-body-01` `text-heading-01` | 14 / 20 / 0.16 | Default body |
| `text-body-compact-02` `text-heading-compact-02` | 16 / 22 / 0 | Dense, larger |
| `text-body-02` `text-heading-02` | 16 / 24 / 0 | Reading text, student body |
| `text-heading-03` | 20 / 28 / 0 | Card titles |
| `text-heading-04` | 28 / 36 / 0 | Page titles |
| `text-heading-05` | 32 / 40 / 0 | Hero |
| `text-heading-06` | 42 / 50 / 0 | Marketing |
| `text-heading-07` | 54 / 64 / 0 | Marketing |

**Carbon names are the real tokens.** The t-shirt keys (`text-sm`, `text-base`,
`text-lg` …) are aliases onto the same values, so all 517 existing uses picked up
Carbon metrics without an edit. Prefer the Carbon name in new code — it says what
the text *is*, not how big it is.

Arbitrary sizes (`text-[10px]`, `text-[11px]`) bypass the scale entirely and
still exist in 12 places (10 in pages, 2 in vendored components). They map onto
`text-caption-01` / `text-label-01`.

### 1.4 Colour

**Carbon grey ramp**, verbatim, as `grey-10` … `grey-100`. Primitives — literal,
never themed. Semantic roles pick from the ramp per theme.

| | Light (`:root`) | Dark (`.dark`) |
|---|---|---|
| `--background` | grey-10 `#f4f4f4` | grey-100 `#161616` |
| `--foreground` | grey-100 | grey-10 |
| `--card` | white | grey-90 `#262626` |
| `--muted` | grey-20 `#e0e0e0` | grey-80 `#393939` |
| `--muted-foreground` | grey-70 `#525252` | grey-30 `#c6c6c6` |
| `--border` | grey-20 | grey-80 |
| `--input` | grey-30 | grey-70 |

**Brand.** Navy `#1F3864` and gold `#BF9000`, per `CLAUDE.md`.

| Token | Utility | Light | Dark | Use |
|---|---|---|---|---|
| `--brand-navy` | `bg-navy` `text-navy` | `#1F3864` | `#6B90D1` | Primary actions, brand surfaces. Also drives `--primary`. |
| `--brand-gold` | `bg-gold` | `#BF9000` | `#F4C025` | Accent **fills** — badges, CTAs, highlights |
| `--brand-gold-foreground` | `text-gold-foreground` | grey-100 | grey-100 | Text **on** gold |
| `--brand-gold-ink` | `text-gold-ink` | `#8F6C00` | `#F4C025` | Gold **text** on a light surface |

> **Gold is a fill colour, not a text colour.** `#BF9000` is 2.91:1 on white and
> 2.73:1 on cream — it fails WCAG even at the lenient 3:1 large-text floor. Write
> with `text-gold-ink` (4.57:1), and put `text-gold-foreground` on gold fills
> (6.21:1). Never `text-white` on gold.

Every pair in the palette meets **WCAG AA or better**; the tightest is dark-mode
primary at 5.63:1. Check any new pair before shipping it.

### 1.5 Radius — two values

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` (and `rounded-md`) | `--radius-sm` 4px | Controls, inputs, badges, table cells |
| `rounded-lg` (and `rounded-xl`, `2xl`, `3xl`) | `--radius-lg` 8px | Cards, dialogs, panels |
| `rounded-none` / `rounded-full` | 0 / pill | Shape primitives, not scale steps |

The extra key names are aliases onto the same two values so existing markup keeps
working. There are two radii in the system, not six.

---

## 2. The two skins · **PLANNED**

The app serves two audiences with opposite needs, and one visual language has
been serving both badly.

|  | **Staff** | **Student** |
|---|---|---|
| Goal | Get through 30 submissions without fatigue | Feel welcome; read comfortably |
| Character | Dense and quiet | Warmer and larger |
| Screens | `/teacher/*` | `/student/*` |
| Base type | `body-compact-01` (14/18) | `body-02` (16/24) |
| Control heights | 32 / 40 | 40 / 48 |
| Table rows | Carbon `sm` 32 or `md` 40 | Carbon `lg` 48 |
| Dominant spacing | steps `2` `3` `4` (8/12/16) | steps `4` `6` `8` (16/24/32) |
| Radius | `rounded-sm` 4px | `rounded-lg` 8px |
| Colour | Grey ramp carries the UI. Navy for the one primary action. Gold at most once per screen. | Navy and gold used generously; categorical colour allowed |
| Motion | None beyond state changes | Playful is fine |

The landing page is neither — it keeps its own `.op-landing` scope (§2.2).

### 2.1 Mechanism

Skins are **token overrides on a scope class**, exactly like the `.op-landing`
block already in `index.css`. A skin never overrides a *utility*; it changes what
the tokens resolve to for its subtree.

```
<div class="skin-staff">      →  everything inside reads staff tokens
<div class="skin-student">    →  everything inside reads student tokens
```

Applied once, at the layout root of each area — not per component.

A skin owns exactly these variables. Anything else it touches is a bug:

```css
.skin-staff {
  --ui-font-size:   0.875rem;  --ui-line-height: 1.125rem;  --ui-tracking: 0.16px;
  --control-h-sm:   2rem;      /* 32 */
  --control-h-md:   2.5rem;    /* 40 */
  --row-h:          2.5rem;    /* 40 — Carbon md */
  --radius-sm: 4px; --radius-lg: 4px;
}
.skin-student {
  --ui-font-size:   1rem;      --ui-line-height: 1.5rem;    --ui-tracking: 0px;
  --control-h-sm:   2.5rem;    /* 40 */
  --control-h-md:   3rem;      /* 48 */
  --row-h:          3rem;      /* 48 — Carbon lg */
  --radius-sm: 4px; --radius-lg: 8px;
}
```

**Why variables and not size props:** a skin has to reach components it does not
render — a `Dialog` portalled to `document.body`, a `Select` dropdown. Passing a
size prop down every tree is not workable; a token read at paint time is.

Implementing this needs one change to the components in §3: replace the
hardcoded `min-h-9` / `h-9` with `min-h-[var(--control-h-md)]` and give the vars
sane fallbacks in `:root` so unskinned areas keep today's appearance.

### 2.2 Existing scope: `.op-landing` · **BUILT**

The landing page is deliberately light in both themes. It cannot simply use
`bg-navy`, because `--brand-navy` *lightens* in dark mode to sit on a dark
ground — which on a forced-light page is unreadable. `.op-landing` re-declares
the brand and surface tokens at their light values for that subtree.

This is the working precedent for §2.1. Read it before building the skins.

---

## 3. The eight components

Every screen is assembled from these. If you need something not here, say so
before hand-rolling it — a ninth component is a decision, not an accident.

| # | Component | File | Status | Notes |
|---|---|---|---|---|
| 1 | Button | `ui/button.tsx` | **BUILT** | 33 files — the most-used component. Heights 32 / **36** / 40, see §3.2 |
| 2 | Input | `ui/input.tsx` | **BUILT** | 14 files. `h-9` (36) |
| 3 | Card | `ui/card.tsx` | **BUILT** | 22 files |
| 4 | Table | `ui/table.tsx` | **PARTIAL** | Vendored, **zero imports** — three pages hand-roll `<table>` |
| 5 | Badge | `ui/badge.tsx` | **BUILT** | 17 files. `default` `secondary` `destructive` `outline` |
| 6 | Dialog | `ui/dialog.tsx` | **BUILT** | 7 files. Use `AlertDialog` for destructive confirms |
| 7 | SideNav | `ui/sidebar.tsx` | **PLANNED** | Vendored, **zero imports**; app currently uses a sticky top bar |
| 8 | Dropdown | `ui/dropdown-menu.tsx` | **PLANNED** | Vendored, **zero imports**; the app uses `Select` (12 files) for every menu |

### 3.1 Adoption gaps to close

**Table.** `teacher/gradebook.tsx`, `teacher/reports.tsx` and `teacher/export.tsx`
each hand-roll `<table>` with their own header, zebra-striping and padding. They
should move to `ui/table.tsx` so row height follows §4 and the skins.

**SideNav.** Nothing uses it. The `--sidebar-*` tokens exist and are themed, but
every screen navigates via a sticky top bar and a "Back to Dashboard" link. Adopt
it for `/teacher/*` (which has 8+ destinations) or delete the tokens — the
current half-state is misleading.

**Dropdown.** Also zero imports. Every menu in the app is a `Select` (12 files),
including cases that are really *actions* rather than *choices* — a row's
edit/reset/delete controls are three separate icon buttons because there is no
adopted menu. Either adopt `DropdownMenu` for action menus and keep `Select` for
value choices, or drop it from this list and say `Select` is the eighth
component. **Decide before building the skins**, since it changes what needs a
`--control-h` treatment.

> Three of the eight — Table, SideNav, Dropdown — are vendored but unused. This
> list is therefore **an agreement about what to use**, not a description of what
> is used today. The gap is the work.

### 3.2 Control height — a real conflict to resolve

shadcn's default heights are **32 / 36 / 40**. Carbon's are **32 / 40 / 48**.
The 36px middle step is off the Carbon spacing scale entirely — it is
`min-h-9`, a quarantined legacy key (§1.2).

The skins in §2.1 resolve this: staff gets 32/40, student gets 40/48, and nothing
lands on 36. **Doing that also burns down ~20 legacy `h-9` / `w-9` uses**, so the
two pieces of work should be done together.

### 3.3 Rules that apply to all eight

- **Never** put a raw colour on a component. No `style={{ color: '#...' }}`, no
  `text-[#BF9000]`. Use a token.
- **Never** `text-white` on gold (§1.4).
- Destructive actions use `AlertDialog`, never `window.confirm`. Three call sites
  still use `window.confirm` and should be migrated.
- Icons are 16px (`h-4 w-4`) or 24px (`h-6 w-6`). 20px (`h-5 w-5`) is a legacy
  key with 136 uses awaiting burn-down.

---

## 4. Table row height — Carbon rules · **PARTIAL**

Carbon defines five row heights. All five sit on the Carbon spacing scale (§1.2),
which is a useful check that a row height is legitimate:

| Carbon size | Height | Spacing step | When |
|---|---|---|---|
| `xs` | 24px | `$spacing-06` | Extreme density. Text only. No interactive content. |
| `sm` | 32px | `$spacing-07` | Dense comparison across many rows. |
| `md` | 40px | `$spacing-08` | **Staff default.** Comfortable scanning; fits a 32px control. |
| `lg` | 48px | `$spacing-09` | **Carbon's default. Student default.** Roomy; touch-friendly. |
| `xl` | 64px | `$spacing-10` | Two lines of content per row. |

**Rules**

1. **One height per table.** Never mix row heights within a table.
2. **Interactive content sets a floor.** A row containing a button, checkbox or
   input must be `md` (40) or taller. A 32px control cannot sit inside a 32px row
   with any padding left. `xs` and `sm` are text-only.
3. **Header matches body.** The header row takes the same height as body rows.
   (`ui/table.tsx` currently hardcodes `h-12` = 48px = `lg`.)
4. **Density is a screen decision, not a table decision.** Take it from the skin
   (`--row-h`), so every table on a staff screen agrees.
5. **Vertical padding is derived, not chosen.** Set the row height and centre the
   content; do not set the height *via* padding.
6. **Numbers right-align and use `tabular-nums`.** Scores, marks and counts.
   Already done in `gradebook.tsx` and `submission-review.tsx`.

---

## 5. Every screen has three states · **BUILT**

This is the hardest rule in this document and the one most often broken. Before
this work, **22 of 26 screens** reported a dropped connection, a 500 and an
expired login identically to "no data" — a teacher saw "No assignments yet" when
the truth was "we could not ask the server".

A screen that loads data has **four** render branches, in this order:

```jsx
{isLoading  ? <Spinner />
 : isError  ? <QueryError error={error} what="your assignments" onRetry={refetch} />
 : filtersHidEverything ? <NoMatch onClear={clearFilters} />
 : items.length === 0   ? <Empty />
 :                        <List />}
```

### 5.1 Loading

A centred spinner, or a skeleton where the shape is known. Per-widget where
widgets load independently — do not block a whole page on its slowest query.

**A form in edit mode must not render before its data arrives.** It shows
create-mode defaults and then snaps, and on a slow connection someone starts
typing into the wrong record.

### 5.2 Empty — two different states

Distinguishing these is mandatory.

| | Copy | Action |
|---|---|---|
| **Genuinely empty** | "No lessons yet" | The primary CTA — *Add lesson* |
| **Filtered to nothing** | "No lessons match these filters. You have 40." | *Clear filters* |

"Add your first lesson" shown to a teacher with 40 lessons and a narrow filter is
a bug. It requires knowing the collection size *before* filtering — so keep
**scoping** (what this user may see) and **user filters** (what they chose)
as separate passes:

```js
const available = all.filter(scopeRules);          // not the user's choice
const filtered  = available.filter(userFilters);   // the user's choice
```

### 5.3 Error

Use **`components/QueryError.tsx`**. Do not hand-roll one.

```jsx
<QueryError error={error} what="the Grade Book" onRetry={() => refetch()} role="teacher" />
```

It branches on 401 / 403 / 404 / 409 / 5xx / network with its own copy, offering
*Sign in again* on an expired login and *Try again* otherwise. `describeError()`
is exported for mutation toasts.

**Rules**

- **Never let a fallback impersonate real data.** `statsData?.xp?.level ?? 0`
  renders a failed fetch as a real student with 0 XP. Show an em-dash or a note.
  This was the single worst defect found in the audit.
- **Every mutation gets an `onError`.** A failed save must never be silent.
  Also check `data.success === false` — a rejection is not an exception.
- Reference implementations: `teacher/submission-review.tsx` (status-specific
  copy), `teacher/gradebook.tsx` (error vs empty vs filtered).

### 5.4 Error boundaries are a different thing

`QueryError` handles a failed *fetch*. `PageErrorBoundary` / `ErrorBoundary`
handle a *render crash*. A screen doing real work wants both. Only four screens
currently have a boundary.

---

## 6. Checklist for a new screen

- [ ] Wrapped in the right skin (§2) — `/teacher/*` staff, `/student/*` student
- [ ] Assembled from the eight components (§3); nothing hand-rolled
- [ ] Loading, empty-genuine, empty-filtered and error branches all present (§5)
- [ ] Every mutation has `onError` **and** a `success === false` check
- [ ] No raw hex, no `text-[...]`, no spacing key outside §1.2
- [ ] Carbon type token, not a t-shirt alias, for anything new
- [ ] Any new colour pair checked for WCAG AA
- [ ] Tables follow §4; one row height, numbers `tabular-nums`
- [ ] Destructive actions use `AlertDialog`, not `window.confirm`
- [ ] Renders correctly in both light and dark

---

## 7. Non-goals

- **Not a component library.** shadcn/ui is vendored into
  `client/src/components/ui/`. Upstream changes are pulled in, not forked.
- **Not a marketing style guide.** The landing page has its own scope (§2.2).
- **Not internationalised yet.** `CLAUDE.md` asks that display text stay easy to
  extract for a later Portuguese translation — group user-facing strings, avoid
  burying them in awkward places.

---

## 8. Known debt

Tracked in full in `AUDIT.md`; the parts that affect this spec:

| Item | Effect on this spec |
|---|---|
| 328 legacy spacing uses | §1.2 is sanctioned but not enforced |
| `h-9` (36px) controls | Blocks §3.2 until the skins land |
| `h-5 w-5` icons, 136 uses | Blocks the 16/24 icon rule in §3.3 |
| Table hand-rolled on 3 pages | Blocks §4 |
| SideNav + Dropdown unused, sidebar tokens themed | §3 items 7 and 8 are agreements, not descriptions |
| 12 arbitrary `text-[…]` uses | Bypass §1.3 |
| `window.confirm` on 3 screens | Breaks §3.3 |
| ~~Poppins + Playfair Display fully loaded~~ | Fixed: Playfair was downloaded in full and used zero times. Latin font faces 22 → 10. |
| `@tailwindcss/vite` installed but inert | Tailwind **3.4.17** builds the CSS; the package is an abandoned v4 migration and should be removed before it misleads someone |
| `lateDays` always `0` server-side | A stub column; do not render it until it is computed |
