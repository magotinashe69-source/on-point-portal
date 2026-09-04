import type { Config } from "tailwindcss";

/* ===========================================================================
   DESIGN TOKEN LAYER
   ---------------------------------------------------------------------------
   Built by Tailwind 3.4.17 (see postcss.config.js). This is a v3 config —
   NOT v4 `@theme`. `@tailwindcss/vite` is present in package.json but is not
   registered in vite.config.ts and does nothing.

   Structure:
     - PRIMITIVES  (this file): spacing, type, radius, the Carbon grey ramp
                                and the brand hues. Raw, unopinionated values.
     - SEMANTICS   (client/src/index.css): which primitive plays which role,
                                per theme. shadcn reads these via CSS vars.

   Colour rule: every semantic colour stays `hsl(var(--x) / <alpha-value>)`.
   The CSS vars MUST remain bare HSL channel triplets ("218 53% 26%"), never
   hex — the codebase uses opacity modifiers (bg-primary/10, border-gold/30)
   in ~90 places and they break silently the moment a var holds a hex value.
   =========================================================================== */

/* ---------------------------------------------------------------------------
   SPACING — IBM Carbon spacing scale, the only sanctioned step values.
   Carbon's scale and the brief are the same 13 numbers, and they all land on
   Tailwind's native 4px-based keys, so `p-4` is still 16px and no correct
   call site had to move.
   ---------------------------------------------------------------------------
     key    px    rem       Carbon
     0.5     2    0.125     $spacing-01
     1       4    0.25      $spacing-02
     2       8    0.5       $spacing-03
     3      12    0.75      $spacing-04
     4      16    1         $spacing-05
     6      24    1.5       $spacing-06
     8      32    2         $spacing-07
     10     40    2.5       $spacing-08
     12     48    3         $spacing-09
     16     64    4         $spacing-10
     20     80    5         $spacing-11
     24     96    6         $spacing-12
     40    160   10         $spacing-13
   --------------------------------------------------------------------------- */
const SPACING = {
  "0.5": "0.125rem",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "40": "10rem",
} as const;

/* Shape primitives, not scale steps. `0` and `1px` are not design decisions. */
const SPACING_PRIMITIVES = { "0": "0px", px: "1px" } as const;

/* ---------------------------------------------------------------------------
   LEGACY SPACING — NOT DESIGN TOKENS. DO NOT USE IN NEW CODE.
   ---------------------------------------------------------------------------
   328 existing utility uses across 56 class names sit on steps outside the
   Carbon scale. Deleting these keys does not raise an error — Tailwind simply
   stops emitting the class and the layout silently collapses. They are kept
   here, quarantined and greppable, so the scale can be enforced by fixing call
   sites rather than by breaking 26 screens in one commit.

   Burn-down, largest first:
     h-5 / w-5            136 uses   20px icons  -> h-6 w-6 (24px, Carbon icon size)
     *-1.5                 65 uses    6px        -> 4px (key 1) or 8px (key 2)
     h-3.5 / w-3.5         24 uses   14px        -> 16px (key 4)
     h-9 / w-9 / min-w-9   20 uses   36px        -> 32px (key 8) or 40px (key 10)
     *-2.5                 14 uses   10px        -> 8px (key 2) or 12px (key 3)
     *-5                   18 uses   20px        -> 16px (key 4) or 24px (key 6)
     *-7                    9 uses   28px        -> 24px (key 6) or 32px (key 8)
     *-11                   5 uses   44px        -> 40px (key 10) or 48px (key 12)
     max-h-48/52/64/96, w-48/56/64/72, h-14/48/56  -> arbitrary values or key 40
   Roughly half live in client/src/components/ui/* (vendored shadcn) and half
   in app code; the shadcn half is regenerated on upgrade, so fix app code first.
   --------------------------------------------------------------------------- */
const LEGACY_SPACING = {
  "1.5": "0.375rem",
  "2.5": "0.625rem",
  "3.5": "0.875rem",
  "5": "1.25rem",
  "7": "1.75rem",
  "9": "2.25rem",
  "11": "2.75rem",
  "14": "3.5rem",
  "48": "12rem",
  "52": "13rem",
  "56": "14rem",
  "64": "16rem",
  "72": "18rem",
  "96": "24rem",
} as const;

/* ---------------------------------------------------------------------------
   TYPE — IBM Carbon type scale. Every step carries its own line-height and
   letter-spacing, per Carbon's productive type styles.

   Carbon specifies letter-spacing in px and only tightens the small steps:
   0.32px at 12px, 0.16px at 14px, 0 from 16px up. Sizes and line-heights are
   rem so browser font-size settings still work.

   Both naming schemes resolve to the same values. The Carbon names are the
   real tokens; the t-shirt keys are aliases so the 499 existing `text-*` uses
   pick up Carbon metrics with no edit.
   --------------------------------------------------------------------------- */
type Step = [string, { lineHeight: string; letterSpacing: string }];
const step = (size: string, lh: string, ls: string): Step => [size, { lineHeight: lh, letterSpacing: ls }];

const CARBON_TYPE = {
  /* 12 / 16 / 0.32 */
  "caption-01":         step("0.75rem", "1rem", "0.32px"),
  "label-01":           step("0.75rem", "1rem", "0.32px"),
  "helper-01":          step("0.75rem", "1rem", "0.32px"),
  /* 14 / 18 / 0.16 — compact */
  "body-compact-01":    step("0.875rem", "1.125rem", "0.16px"),
  "heading-compact-01": step("0.875rem", "1.125rem", "0.16px"),
  /* 14 / 20 / 0.16 */
  "body-01":            step("0.875rem", "1.25rem", "0.16px"),
  "heading-01":         step("0.875rem", "1.25rem", "0.16px"),
  /* 16 / 22 / 0 — compact */
  "body-compact-02":    step("1rem", "1.375rem", "0px"),
  "heading-compact-02": step("1rem", "1.375rem", "0px"),
  /* 16 / 24 / 0 */
  "body-02":            step("1rem", "1.5rem", "0px"),
  "heading-02":         step("1rem", "1.5rem", "0px"),
  /* headings */
  "heading-03":         step("1.25rem", "1.75rem", "0px"),   /* 20 / 28 */
  "heading-04":         step("1.75rem", "2.25rem", "0px"),   /* 28 / 36 */
  "heading-05":         step("2rem", "2.5rem", "0px"),       /* 32 / 40 */
  "heading-06":         step("2.625rem", "3.125rem", "0px"), /* 42 / 50 */
  "heading-07":         step("3.375rem", "4rem", "0px"),     /* 54 / 64 */
} as const;

/* Aliases: existing t-shirt sizes -> nearest Carbon step. */
const TYPE_ALIASES = {
  xs:    CARBON_TYPE["caption-01"],   /* 12 / 16 / 0.32 */
  sm:    CARBON_TYPE["body-01"],      /* 14 / 20 / 0.16 */
  base:  CARBON_TYPE["body-02"],      /* 16 / 24 / 0    */
  lg:    CARBON_TYPE["heading-03"],   /* 20 / 28 / 0    */
  xl:    step("1.5rem", "2rem", "0px"),        /* 24 / 32 — Carbon scale step */
  "2xl": CARBON_TYPE["heading-04"],   /* 28 / 36 / 0    */
  "3xl": CARBON_TYPE["heading-05"],   /* 32 / 40 / 0    */
  "4xl": CARBON_TYPE["heading-06"],   /* 42 / 50 / 0    */
  "5xl": CARBON_TYPE["heading-07"],   /* 54 / 64 / 0    */
  "6xl": step("4.25rem", "4.875rem", "0px"),   /* 68 / 78 — Carbon scale step */
  "7xl": step("4.75rem", "5.375rem", "0px"),   /* 76 / 86 — Carbon scale step */
} as const;

/* ---------------------------------------------------------------------------
   GREY — IBM Carbon grey ramp, verbatim. Primitives: literal, never themed.
   Semantic roles pick from this ramp per theme in index.css.
   --------------------------------------------------------------------------- */
const CARBON_GREY = {
  10: "#f4f4f4",
  20: "#e0e0e0",
  30: "#c6c6c6",
  40: "#a8a8a8",
  50: "#8d8d8d",
  60: "#6f6f6f",
  70: "#525252",
  80: "#393939",
  90: "#262626",
  100: "#161616",
} as const;

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    /* Replaced, not extended — this is what makes the scale a scale. */
    spacing: { ...SPACING_PRIMITIVES, ...SPACING, ...LEGACY_SPACING },
    fontSize: { ...TYPE_ALIASES, ...CARBON_TYPE },

    /* Exactly two radius values. `none` and `full` are shape primitives
       (square / pill), not steps on the scale. md, xl, 2xl and 3xl are
       aliases so the 220 existing `rounded-*` uses keep resolving. */
    borderRadius: {
      none: "0px",
      sm: "var(--radius-sm)",   /*  4px */
      md: "var(--radius-sm)",   /*  alias -> sm */
      lg: "var(--radius-lg)",   /*  8px */
      xl: "var(--radius-lg)",   /*  alias -> lg */
      "2xl": "var(--radius-lg)",/*  alias -> lg */
      "3xl": "var(--radius-lg)",/*  alias -> lg */
      full: "9999px",
    },

    extend: {
      colors: {
        /* --- Primitives ------------------------------------------------- */
        grey: CARBON_GREY,

        /* Brand, token-driven so each theme can shift lightness.
           `gold` is full-strength #BF9000 for deliberate CTAs; the softer
           gold surface lives on `accent` below. */
        navy: "hsl(var(--brand-navy) / <alpha-value>)",
        gold: {
          DEFAULT: "hsl(var(--brand-gold) / <alpha-value>)",
          foreground: "hsl(var(--brand-gold-foreground) / <alpha-value>)",
          /* `text-gold-ink` - gold dark enough to read on a light surface. */
          ink: "hsl(var(--brand-gold-ink) / <alpha-value>)",
        },

        /* --- Semantics (shadcn contract — names unchanged) -------------- */
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)",
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
