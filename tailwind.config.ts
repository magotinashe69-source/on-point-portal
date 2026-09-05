import type { Config } from "tailwindcss";

/* ---------------------------------------------------------------------------
   SPACING — the closed list from ONPOINT_UI_SPEC.md S2.
   ---------------------------------------------------------------------------
   Thirteen values: 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160px.
   These REPLACE Tailwind's default scale rather than extending it, which is
   what makes S2 enforceable: a step that is not on the list simply has no
   class to reach for.

   Ported from the design-tokens-and-error-states branch; the burn-down counts
   below were recomputed against this tree.
   --------------------------------------------------------------------------- */
const SPACING_PRIMITIVES = { "0": "0px", px: "1px" } as const;

const SPACING = {
  "0.5": "0.125rem",  /*   2px */
  "1":   "0.25rem",   /*   4px */
  "2":   "0.5rem",    /*   8px */
  "3":   "0.75rem",   /*  12px */
  "4":   "1rem",      /*  16px */
  "6":   "1.5rem",    /*  24px */
  "8":   "2rem",      /*  32px */
  "10":  "2.5rem",    /*  40px */
  "12":  "3rem",      /*  48px */
  "16":  "4rem",      /*  64px */
  "20":  "5rem",      /*  80px */
  "24":  "6rem",      /*  96px */
  "40":  "10rem",     /* 160px */
} as const;

/* ---------------------------------------------------------------------------
   LEGACY SPACING — NOT DESIGN TOKENS. DO NOT USE IN NEW CODE.
   ---------------------------------------------------------------------------
   342 existing utility uses across 13 class names sit on steps outside the
   list above. Deleting these keys does not raise an error — Tailwind simply
   stops emitting the class and the layout silently collapses. They are kept
   here, quarantined and greppable, so the scale can be enforced by fixing
   call sites rather than by breaking 26 screens in one commit.

   Burn-down, largest first (counts measured in this tree):
     *-5              163 uses   20px  -> 16px (key 4) or 24px (key 6)
     *-1.5             72 uses    6px  -> 4px  (key 1) or 8px  (key 2)
     *-3.5             30 uses   14px  -> 16px (key 4)
     *-9               24 uses   36px  -> 32px (key 8) or 40px (key 10)
     *-2.5             23 uses   10px  -> 8px  (key 2) or 12px (key 3)
     *-7               11 uses   28px  -> 24px (key 6) or 32px (key 8)
     *-14               5 uses   56px  -> 48px (key 12) or 64px (key 16)
     *-11               4 uses   44px  -> 40px (key 10) or 48px (key 12)
     max-h-48/64/96,
     w-52/72            10 uses        -> key 40, or an arbitrary value
   Roughly half live in client/src/components/ui/* (vendored shadcn) and half
   in app code; the shadcn half is regenerated on upgrade, so fix app code
   first. Key "56" is carried for shadcn's benefit and is unused in app code.
   --------------------------------------------------------------------------- */
const LEGACY_SPACING = {
  "1.5": "0.375rem",
  "2.5": "0.625rem",
  "3.5": "0.875rem",
  "5":   "1.25rem",
  "7":   "1.75rem",
  "9":   "2.25rem",
  "11":  "2.75rem",
  "14":  "3.5rem",
  "48":  "12rem",
  "52":  "13rem",
  "56":  "14rem",
  "64":  "16rem",
  "72":  "18rem",
  "96":  "24rem",
} as const;

/* ---------------------------------------------------------------------------
   TYPE — the Carbon steps, each with its own line-height (S3).
   ---------------------------------------------------------------------------
   Added to `extend`, NOT replacing Tailwind's own sizes: these are new class
   names (text-label-01, text-body-compact-01 ...) so nothing already written
   changes. Their branch also remapped text-sm / text-lg / text-2xl onto this
   scale, which restyles every screen at once; that is a separate decision and
   is deliberately not taken here.

   Each entry is [size, { lineHeight, letterSpacing }] so a step can never be
   used without the leading it was designed with.
   --------------------------------------------------------------------------- */
const step = (size: string, line: string, tracking: string) =>
  [size, { lineHeight: line, letterSpacing: tracking }] as const;

const CARBON_TYPE = {
  "caption-01":         step("0.75rem", "1rem", "0.32px"),      /* 12 / 16 */
  "label-01":           step("0.75rem", "1rem", "0.32px"),      /* 12 / 16 */
  "helper-01":          step("0.75rem", "1rem", "0.32px"),      /* 12 / 16 */
  "body-compact-01":    step("0.875rem", "1.125rem", "0.16px"), /* 14 / 18 */
  "heading-compact-01": step("0.875rem", "1.125rem", "0.16px"), /* 14 / 18 */
  "body-01":            step("0.875rem", "1.25rem", "0.16px"),  /* 14 / 20 */
  "heading-01":         step("0.875rem", "1.25rem", "0.16px"),  /* 14 / 20 */
  "body-compact-02":    step("1rem", "1.375rem", "0px"),        /* 16 / 22 */
  "heading-compact-02": step("1rem", "1.375rem", "0px"),        /* 16 / 22 */
  "body-02":            step("1rem", "1.5rem", "0px"),          /* 16 / 24 */
  "heading-02":         step("1rem", "1.5rem", "0px"),          /* 16 / 24 */
  "heading-03":         step("1.25rem", "1.75rem", "0px"),      /* 20 / 28 */
  "heading-04":         step("1.75rem", "2.25rem", "0px"),      /* 28 / 36 */
  "heading-05":         step("2rem", "2.5rem", "0px"),          /* 32 / 40 */
} as const;

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Not inside `extend`: these REPLACE Tailwind's defaults, which is the
    // point. A value off the scale has no class, so S2 and S4 hold by
    // construction rather than by review.
    spacing: { ...SPACING_PRIMITIVES, ...SPACING, ...LEGACY_SPACING },
    borderRadius: {
      none: "0px",
      sm: "var(--radius-sm)",    /* 4px */
      md: "var(--radius-sm)",    /* alias -> sm */
      lg: "var(--radius-lg)",    /* 8px */
      xl: "var(--radius-lg)",    /* alias -> lg */
      "2xl": "var(--radius-lg)", /* alias -> lg */
      "3xl": "var(--radius-lg)", /* alias -> lg */
      full: "9999px",
    },
    extend: {
      fontSize: { ...CARBON_TYPE },
      colors: {
        // Flat / base colors (regular buttons)
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
          border: "var(--sidebar-accent-border)"
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
