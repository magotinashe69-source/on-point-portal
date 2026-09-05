# ONPOINT_UI_SPEC.md

**The design specification for the On Point Homework Portal.**

Version 1, 5 September 2026. This is the file Claude Code must read before writing any UI. Rules here are not suggestions.

---

## 0. Three things to settle first

### 0.1 The brand has three colour stories

| Where | Colours |
|---|---|
| The logo | Red and navy |
| The website | Navy and gold |
| Graduation sashes | Navy and orange |

**Pick one and hold it everywhere.** Inconsistent brand colour is itself a signal that nobody was in charge.

**My recommendation: red and navy**, taken from the logo. Reasons: the logo is the fixed asset, red gives you a stronger accent than gold at small sizes, and gold on white fails contrast checks in body text. Gold survives as a third colour for celebration moments on the student side only.

**Approximate values read from the logo** — verify these with a colour picker on the actual file, do not trust my reading of a JPEG:
- Navy: around `#1B3A6B`
- Red: around `#D0021B`

### 0.2 The login is not safe

The student login says: *"Enter your name exactly as registered and create a password."*

That means anyone who knows a learner's name can claim that account before the child does — and then has their marks and photo answers.

Student names are not secret. They are on class lists, on WhatsApp groups, on the graduation programme.

**Fix before design work:** teacher issues a one-time code, or the account is pre-created and the teacher hands out a first password. Not "name plus whatever password you type."

### 0.3 Never publish real learner names

The screenshots contain a real child's name. Fine for our conversation, but do not use these on the public site, in a pitch deck, or in an app store listing. Use fake names for anything public.

---

## 1. Colour tokens

**Primary — navy.** Headers, primary buttons, headings, links.
**Accent — red.** Sparingly. One or two things per screen.
**Neutrals — Carbon grey ramp.** Everything else.

**Four states, four colours, nothing else:**

| State | Treatment |
|---|---|
| Not handed in | Neutral grey |
| Handed in, awaiting review | Navy |
| Late | Red |
| Marked | Green |

Gold is permitted **only** on student celebration moments — level-up, streak milestone. Never on staff screens, never in body text.

**Rules:**
- No raw hex anywhere outside this token file
- No colour that does not map to a defined state or the brand
- One gradient in the entire product: the main page hero, navy to a slightly deeper navy. Nowhere else.

---

## 2. Spacing

Thirteen values, closed list: **2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160px.**

Arbitrary Tailwind values (`p-[13px]`, `mt-[27px]`) are banned. If a value you need is not on this list, use the nearest one.

---

## 3. Typography

**Sora** for headings. **DM Sans** for body and tables.

Each step carries its own line-height. Never a global 1.5.

Hierarchy comes from **size and weight only**. Colouring individual words in a heading is banned.

Load only the weights actually in use.

---

## 4. Shape

- Two border radius values maximum
- **Pick two of three** on any element: shadow, radius, border. Never all three.
- Staff screens: borders and radius, essentially no shadow
- Student screens: may use shadow more freely

---

## 5. Components

Eight reusable components. Do not create a new variant of something that already exists.

Button · Input · Card · Table · Badge · Dialog · SideNav · Dropdown

**Buttons:** text says exactly what happens. No arrows appended to labels. No emoji. No exclamation marks.

---

## 6. Icons

Lucide only. One size, one stroke width per context.

**Banned:** `Sparkles`, `Zap`, `Rocket`, `Brain`. These four are the strongest AI signature in the library.

**No emoji anywhere in the UI.** Not in buttons, not in headings, not as a streak indicator. The flame emoji on the student dashboard goes.

---

## 7. Density

**This is the rule that separates real software from vibecoded software.**

> Real apps are dense with real information. Vibecoded apps are sparse with big decorative containers.

**Cards must not hold a single number.** The current student dashboard has one number per card, stacked, so a child scrolls past six near-empty boxes. Group them into one compact block.

**Table rows carry six pieces of real information**, not two. Grade Book row: learner, class, assignment, handed in, mark, date.

**Carbon row heights:** 24, 32, 40, 48, 64px. Pick by how many rows the user needs to see at once. A Grade Book with fifty learners uses a tight row; a homework list with descriptions uses a tall one.

---

## 8. Required states

**Every screen that loads data needs four states.** A screen with only the success state is unfinished.

| State | Requirement |
|---|---|
| Loading | Skeleton matching the real layout, not a spinner |
| Empty | Explains why it's empty and what to do next |
| Error | Says what went wrong and how to fix it. Does not apologise. Retries without reloading the page |
| No results | Separate from empty. "No learners match this filter" ≠ "No assignments set yet" |

### The all-zeros problem

A new student currently sees: Level 0, 0/500 XP, 0 day streak, 0 submitted, 0 marked. Six zeros.

**This is the empty state and it must be designed as one.** A first-day student should see what to do, not a scoreboard of nothing.

Replace with: their name, the number of assignments waiting, and one clear action. XP and streaks appear once there is something to show.

---

## 9. Two skins

**Shared:** all tokens above.

**Staff skin** — Grade Book, admin, reports. Dense, quiet, tight rows, small type, almost no colour. Teachers want speed and legibility.

**Student skin** — homework, results, XP, games. Same tokens, larger type, more colour, more motion. Warm means colour and generous type. **Warm does not mean clipart.** No mascots, no stock illustrations, no emoji.

---

## 10. Imagery

**Allowed:**
- Screenshots of the actual product
- Real photographs of On Point — the school, learners, staff
- Lucide icons
- Simple shapes in brand colours

**Banned:**
- Stock illustrations from any library
- AI-generated images
- Mascots and cartoon characters
- Decorative background images

**Before publishing photographs of children:** written parental consent for those specific children. Not optional for a school.

**Performance:** WebP, smaller variant for phones, lazy-load below the fold. Users are on Android phones in Tete on mobile data. Target under 1 MB per page.

---

## 11. Copy

- Say what happens. No "adventure", "buddy", "journey"
- No exclamation marks unless something is genuinely worth celebrating
- An action keeps its name through the flow: "Hand in" produces "Handed in"
- Errors explain and instruct; they do not apologise
- Empty screens invite an action
- Match the age — Stage 3 and Form 2 need different words
- **Singular and plural must agree.** "1 marks" is currently wrong on the question screen

---

## 12. Accessibility

- Visible keyboard focus on every interactive element
- Body text meets contrast requirements — this is why gold is not a text colour
- Skeletons carry `aria-busy` and a screen-reader label
- Every input has a real label, not just a placeholder
- Motion respects `prefers-reduced-motion`

---

## 13. Hard rules for Claude Code

1. Read this file before writing any UI
2. Never invent a colour, size or spacing value
3. No arbitrary Tailwind values
4. No raw hex outside the token file
5. Use the eight components; do not create new variants
6. Every data screen ships all four states
7. No emoji in the UI
8. No `Sparkles`, `Zap`, `Rocket`, `Brain`
9. Cards carry grouped information, not a single number
10. One gradient in the product, in the main page hero only

**Before committing:** grep for `#` and `px]` outside the token file. Any hit is drift.

---

## 14. Screen-by-screen status

| Screen | Status |
|---|---|
| Grade Book | Rebuilt in Phase 4 |
| Main page | Phase 5 — see `ONPOINT_PHASE5_MAIN_PAGE.md` |
| Student login | Needs the security fix first, then: remove the arrow from the Login button, move the password reveal inside the field, left-align the labels |
| Student dashboard | Needs the all-zeros empty state, the streak emoji removed, and the six sparse cards grouped |
| Assignment detail | Density is good. Fix "1 marks" |
| Remaining teacher screens | Phase 6 |
| Remaining student screens | Phase 7 |

---

## 15. Still open

- Exact navy and red hex, confirmed with a colour picker on the logo file
- `tailwind.config.ts` or CSS `@theme` — which builds your CSS
- Confirmation that Sora actually applied on the deployed site

---

## The one committed idea

Every real product has one thing that is genuinely its own.

Yours is not a mascot or an illustration. It is that **On Point is a real Cambridge school in Bairro Chingodzi with real children who graduate.** The photograph proves the school. The screenshots prove the software. No competitor can copy either.

Build everything around that.
