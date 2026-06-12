# Website + Brand Redesign Implementation Plan — "Clinical" Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the NOX dark-mesh/purple aesthetic across all of `packages/web` (and brand assets) with the approved "Clinical" system: Switzer + Geist Mono, Tailwind-zinc neutrals on white, single vermillion accent, fully light, product-led.

**Architecture:** One foundation commit establishes tokens (fonts, Tailwind palette, `globals.css` component classes); every subsequent task restyles one surface using ONLY that vocabulary. No new dependencies; CSS-only motion. Spec: `docs/superpowers/specs/2026-06-12-website-redesign-design.md`.

**Tech Stack:** Next.js 15 App Router, Tailwind 3.4, next/font (local Switzer + Google Geist Mono), next/og ImageResponse, vitest.

---

## Design-system vocabulary (the contract for every task)

**Tailwind colors:** use built-in `zinc` scale directly (it IS the extracted superpower palette: zinc-900 `#18181b` text, zinc-700 `#3f3f46` body, zinc-500 `#71717a` secondary, zinc-400 `#a1a1aa` tertiary, zinc-300 `#d4d4d8` strong border, zinc-200 `#e4e4e7` border, zinc-100 `#f4f4f5` fill, zinc-50 `#fafafa` alt section). Extend only `brand`: DEFAULT `#fa520f`, text `#c2410c`, 200 `#ffd9c4`, 50 `#fff3ec`.

**Component classes (globals.css `@layer components`):**

| Class | Renders |
|---|---|
| `.btn` + `.btn-primary` | pill, zinc-900 bg, white text, hover zinc-700 |
| `.btn` + `.btn-outline` | pill, white bg, zinc-900 text, zinc-300 border, hover border zinc-400 |
| `.btn` + `.btn-fill` | pill, zinc-100 bg, zinc-900 text, hover zinc-200 |
| `.card` | white bg, zinc-200 1px border, rounded-xl (12px) |
| `.chip` / `.chip-dot` | citation chip: brand-50 bg, brand-text mono text, 5px radius, vermillion dot |
| `.code-block` | zinc-50 bg, zinc-200 border, rounded-[10px], mono 12–13px zinc-700 |
| `.eyebrow` | mono 11px uppercase tracking-[0.08em] zinc-400 |
| `.input` / `.label` | white input, zinc-300 border, rounded-[10px], focus ring 2px zinc-900; label 13px 500 zinc-900 |
| `.badge` / `.badge-accent` | mono 10px uppercase pill: zinc-100/zinc-700 · brand-50/brand-text |
| `.reveal` / `.reveal-scroll` | fade + 8px rise, 0.5s, stagger via `--reveal-delay`; view-timeline variant |

**Typography rules:** h1/h2 `font-normal` + `tracking-tight2` (−0.022em) / `tracking-tight1` (−0.02em); h3 `font-medium`; never `font-bold`/`font-semibold` on headings; body 15px zinc-700; no `font-serif` anywhere.

**Forbidden (grep-audit at end):** `mesh-night`, `mesh-dark-band`, `grain`, `dotgrid`, `card-night`, `card-light`, `grad-text`, `btn-solid`, `btn-ghost-dark`, `btn-ghost-light`, `term`, `marquee`, `wordmark`, `font-serif`, `Instrument_Serif`, `Hanken_Grotesk`, `IBM_Plex_Mono`, `#5039bd`, `#7a5cff`, `#c794ff`, `#05030f`, `#ff9a3c`, `text-blue-600`, `bg-blue-6`, `bg-gray-900`, `text-gray-`, `bg-amber-50`, emoji icons (📬 ✅ ⚠️ ⬤).

---

### Task 1: Fonts — download Switzer, wire next/font

**Files:**
- Create: `packages/web/app/fonts/Switzer-Variable.woff2` (+ `Switzer-Regular.otf`, `Switzer-Medium.otf` for the OG image), `packages/web/app/fonts/LICENSE.txt`
- Modify: `packages/web/app/layout.tsx`

- [ ] **Step 1: Download Switzer from Fontshare**

```bash
cd /tmp && curl -sL -o switzer.zip "https://api.fontshare.com/v2/fonts/download/switzer" && unzip -o switzer.zip -d switzer-dist && find switzer-dist -name "*.woff2" -o -name "*.otf" -o -name "*.ttf" | head -30
```

Expected: zip extracts with `Switzer-Variable.woff2` (or per-weight files) + OTF/TTF statics. Copy `Switzer-Variable.woff2`, `Switzer-Regular.otf`, `Switzer-Medium.otf` and the bundled license into `packages/web/app/fonts/`. If the variable woff2 is absent, use `Switzer-Regular.woff2` + `Switzer-Medium.woff2` as a two-file `next/font/local` `src` array instead.

- [ ] **Step 2: Replace font setup in `layout.tsx`**

```tsx
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";

const sans = localFont({
  src: "./fonts/Switzer-Variable.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
```

Remove `Hanken_Grotesk`, `Instrument_Serif`, `IBM_Plex_Mono` imports and the `serif` const. `<html className={`${sans.variable} ${mono.variable}`}>`. Body: `bg-white font-sans text-zinc-900 antialiased`. Content offset `pt-16` (nav is h-16). Metadata/JSON-LD untouched.

- [ ] **Step 3: Build to verify fonts resolve** — `pnpm --filter @ato-mcp/web build` → compiles (page code still uses old classes; that's fine, CSS classes are not type-checked).

- [ ] **Step 4: Commit** — `feat(web): Switzer + Geist Mono font foundation`

### Task 2: Tokens — rewrite `globals.css` + `tailwind.config.ts`

**Files:**
- Modify: `packages/web/app/globals.css` (full rewrite), `packages/web/tailwind.config.ts` (full rewrite)

- [ ] **Step 1: `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        brand: { DEFAULT: "#fa520f", text: "#c2410c", 200: "#ffd9c4", 50: "#fff3ec" },
      },
      letterSpacing: { tight1: "-0.02em", tight2: "-0.022em" },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: `globals.css`** — full rewrite per the vocabulary table above (~135 lines): `:root` ease vars; html white + smooth scroll; `::selection` brand/white; `@layer components` for `.btn .btn-primary .btn-outline .btn-fill .card .chip .chip-dot .code-block .eyebrow .input .label .badge .badge-accent`; `.reveal` keyframes (opacity 0→1, translateY 8px→0, 0.5s ease-out, `--reveal-delay`); `.reveal-scroll` inside `@supports (animation-timeline: view())`; `prefers-reduced-motion` kill-switch. Delete everything else (mesh, grain, dotgrid, card-light/night, term, chip glow, marquee, wordmark, grad-text, btnShine, shimmer, floatSlow).

- [ ] **Step 3: Commit** — `feat(web): Clinical design tokens — zinc + vermillion, flat components`

### Task 3: Brand assets — icon + OG image

**Files:**
- Modify: `packages/web/app/icon.svg`, `packages/web/app/opengraph-image.tsx`

- [ ] **Step 1: `icon.svg`** — citation-chip mark: vermillion rounded square + white dot + white rounded bar:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none">
  <rect x="1" y="1" width="30" height="30" rx="8.5" fill="#fa520f"/>
  <circle cx="10.5" cy="16" r="2.6" fill="#ffffff"/>
  <rect x="15" y="13.9" width="7.5" height="4.2" rx="2.1" fill="#ffffff"/>
</svg>
```

- [ ] **Step 2: `opengraph-image.tsx`** — white field, mark + wordmark + neutral pill top; headline "Your AI agent, fluent in Australian tax" (Switzer 500, 64px, −2 tracking, zinc-900); subline zinc-500; bottom row of 3 citation chips (brand-50 bg, brand-text) + mono stat line. Load fonts via `fetch(new URL("./fonts/Switzer-Regular.otf", import.meta.url))` and `Switzer-Medium.otf`, pass as `fonts: [{name:"Switzer", data, weight:400}, …]`. Keep `runtime = "edge"`, same `size`/`alt`/`contentType`.

- [ ] **Step 3: Verify + commit** — `pnpm --filter @ato-mcp/web build`; commit `feat(web): citation-chip brand mark + light OG image`.

### Task 4: Nav + Footer

**Files:**
- Modify: `packages/web/components/site/Nav.tsx`, `packages/web/components/site/Footer.tsx`

- [ ] **Step 1: Nav** — full-width white header, `h-16`, container `max-w-6xl`; logo = new mark SVG (20px, same geometry as icon.svg) + `ato-mcp` 500; links 13px zinc-500 hover zinc-900; CTA `.btn .btn-primary px-4 py-2 text-[13px]`; scrolled state only toggles `border-b border-zinc-200` (keep the scroll listener, drop width/pill morph). Mobile: same hamburger logic, white panel, hairline borders, no blur.
- [ ] **Step 2: Footer** — `border-t border-zinc-200 bg-white`, 3-column grid (blurb / Product / Trust — same links), `.eyebrow` column headings, 13px zinc-500 links hover zinc-900, legal row with both © and ATO-terms lines, not-tax-advice line kept. Delete giant `.wordmark` element and `bg-night`.
- [ ] **Step 3: Commit** — `feat(web): light nav + footer`

### Task 5: Homepage rewrite

**Files:**
- Modify: `packages/web/app/page.tsx` (full rewrite of JSX; constants + JSON-LD + copy retained except listed edits)

Sections per spec §5.1 (constants `WORKFLOWS`/`FAQS` unchanged; `RULING_CHIPS` deleted; `STATS` split):

- [ ] **Step 1: Hero** — two-col `lg:grid-cols-[1.05fr_0.95fr]`; eyebrow `v1.0 · open source · MIT` with brand dot; h1 `text-[clamp(2.5rem,5vw,3.5rem)] font-normal tracking-tight2 leading-[1.04]` text "Your AI agent, fluent in Australian tax" (no italic/serif/colored period); subcopy (drop "Not vibes." sentence) `max-w-xl text-[15px] text-zinc-500`; `.btn-primary` + `.btn-outline`; mono hint line. Demo card = white `.card rounded-[14px] p-6`: mono header `claude · ato-mcp connected`, mono question zinc-400, answer paragraphs zinc-700 (keep current copy), `.chip` citations, footer line `resolved 4 citations · deduction_discovery → 32 categories` mono zinc-400. Behind it: `CitationGraphMotif` aria-hidden SVG — 4 nodes (3 zinc-200, 1 brand at 0.3 opacity), hairline zinc-200 connecting lines, absolute, `hidden lg:block`.
- [ ] **Step 2: Hero stat strip** — `border-t border-zinc-100` row: 29,181 ATO documents / 2,127 public rulings / 13 MCP tools — number 20px tracking-tight1, mono 11px zinc-400 label.
- [ ] **Step 3: How it works (new)** — centered h2 + sub; 4 `.card p-5` with mono numeral, `bg-zinc-50` illustration area containing real product fragments (`npm i -g @ato-mcp/mcp` / wizard radio fragment / `claude mcp add ato-mcp` / one-line cited answer with `.chip`), h3 + one-liner.
- [ ] **Step 4: Corpus** — left h2 "The whole landscape, indexed" + body; grid `lg:grid-cols-[1fr_240px]`: 3 stat `.card` (224,585 chunks / 4,638 ITAA sections / 23,267 citation edges — plain zinc-900 numerals) + right numbered index (Guidance 01 / Statute 02 / Rulings 03 / Citation graph 04, hairline dividers, mono numerals) with one-line descriptions.
- [ ] **Step 5: Workflows band** — full-bleed `bg-zinc-50 border-y border-zinc-100`, inner container; h2 + intro (copy kept); 2×2 `.card p-6`: mono tool name `text-brand-text`, h3 `font-medium`, body zinc-500.
- [ ] **Step 6: Retrieval table** — same band: `.card overflow-hidden p-0` striped rows (`odd:bg-zinc-50`… implemented as mapped rows with conditional bg), 9 rows `search / get_chunks / get_doc / get_doc_anchors / get_definition / get_threshold / fetch / stats / get_user_facts` with one-line descriptions from `lib/tools-meta.ts` summaries (shortened), mono name column. Docs link below.
- [ ] **Step 7: Modes** — h2 "Your tax data, your terms"; two `.card p-7` (Local `.badge` offline / Hosted `.badge-accent` zero download), copy kept, `.code-block` snippets (same commands), check-row `✓ identical shared tool core · ✓ MIT licensed · ✓ sha256-verified releases` 13px zinc-500.
- [ ] **Step 8: Privacy statement** — centered: `.eyebrow` with brand dot "Privacy, by construction"; h2 `max-w-2xl mx-auto` "The privacy policy is generated from the database schema — so it can't lie."; subcopy; `.btn-outline` → /privacy.
- [ ] **Step 9: FAQ** — same questions; `<details>` with `border-b border-zinc-100` only (no boxes), summary 15px `font-medium`, `+` zinc-400 rotates 45° on open, answer zinc-500.
- [ ] **Step 10: Final CTA** — `bg-zinc-50 border-t border-zinc-100` band, centered h2 "Two minutes to a tax-fluent agent", sub, `.btn-primary` + `.btn-outline` (GitHub).
- [ ] **Step 11: Verify + commit** — `pnpm --filter @ato-mcp/web build`; commit `feat(web): homepage in Clinical system`.

### Task 6: Docs page

**Files:** Modify: `packages/web/app/docs/page.tsx`

- [ ] Restyle with the vocabulary: h1 `font-normal tracking-tight2` (drop serif-italic "install"); `.eyebrow`; section h2s `text-xl font-medium tracking-tight1`; install cards → `.card p-6` with `.badge`/`.badge-accent`; all `<pre>` → `.code-block`; tool cards → `.card p-5` with mono name `text-brand-text`; example pre → `.code-block`; "more" cards → `.card p-5`; quote line loses `font-serif italic`; links `text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900`. Metadata/JSON-LD untouched. Build + commit `feat(web): docs page restyle`.

### Task 7: Privacy + Terms

**Files:** Modify: `packages/web/app/privacy/page.tsx`, `packages/web/app/terms/page.tsx`

- [ ] Both: `← Home` link zinc-500 hover zinc-900; h1 `text-3xl font-normal tracking-tight1 text-zinc-900`; h2 `text-lg font-medium`; body `text-zinc-700 text-[15px]`; links zinc-900 underline (no blue). Privacy field table → striped: wrapper `.card p-0 overflow-hidden`, header row `bg-zinc-50 .eyebrow`-style, rows `data-field={key}` PRESERVED (contract test), alternating `bg-zinc-50/60`, mono field names zinc-900, descriptions zinc-500, no cell borders (hairline row dividers). Run `pnpm --filter @ato-mcp/web test` → privacy contract green. Commit `feat(web): legal pages restyle`.

### Task 8: Onboard flow

**Files:** Modify: `packages/web/app/onboard/page.tsx`, `onboard/mode/page.tsx`, `onboard/facts/page.tsx`, `onboard/install/page.tsx`, `components/ModeCard.tsx`, `components/InstallSnippet.tsx`, `components/FactsWizard.tsx`

Mapping (applies everywhere): `text-3xl font-bold text-gray-900` → `text-3xl font-normal tracking-tight1 text-zinc-900`; `text-gray-600` → `text-zinc-500`; inputs/selects → `.input`; labels → `.label`; checkboxes → `h-4 w-4 rounded border-zinc-300 accent-zinc-900`; primary buttons (blue/green) → `.btn .btn-primary w-full`; secondary → `.btn .btn-outline`; error text `text-red-600 bg-red-50 border-red-200` → `text-[13px] text-[#dc2626] bg-white border border-[#dc2626]/30 rounded-[10px] px-3 py-2`; remove emojis (📬 ✅) — replace with `.eyebrow` line (e.g. `CHECK YOUR EMAIL`).

- [ ] **onboard/page.tsx** — disclaimer box: `rounded-xl border border-zinc-200 bg-zinc-50 p-5`, heading 13px 500 zinc-900, body 13px zinc-600; submitted state: eyebrow + h1 400 + zinc-500 copy.
- [ ] **ModeCard.tsx** — `.card p-6 text-left transition-colors` + `cursor-pointer hover:border-zinc-400`; recommended: `border-zinc-900` + `.badge` "Recommended" (ink pill `bg-zinc-900 text-white`) floating top; features list `✓` zinc-400 (not green); button `.btn .btn-primary w-full mt-6`.
- [ ] **FactsWizard.tsx** — step segments `bg-zinc-900` active / `bg-zinc-200`; all step h2s `text-lg font-medium tracking-tight1`; inputs per mapping; nav buttons `.btn-outline` back / `.btn-primary` next + submit (green-600 deleted); saved state: eyebrow `SAVED` + h2 400 + `.btn-primary` continue; "Step n of 6" mono 12px zinc-400.
- [ ] **InstallSnippet.tsx** — dark `bg-gray-900` pres → `.code-block` (relative) with copy button `.btn .btn-fill px-2.5 py-1 text-[11px] absolute top-2 right-2`; token notice → `rounded-[10px] border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-text`; detected state → `text-[13px] text-zinc-900 border border-zinc-200 rounded-[10px] bg-zinc-50 px-4 py-3` with `✓`; waiting state → mono zinc-400 with `animate-pulse` brand dot.
- [ ] **mode/facts/install pages** — heading mapping; links → zinc underline style.
- [ ] Build + commit `feat(web): onboarding flow restyle`.

### Task 9: Account + not-found

**Files:** Modify: `packages/web/app/account/page.tsx`, `account/facts/edit/page.tsx`, `components/DeleteAccountClient.tsx`, `app/not-found.tsx`

- [ ] **account/page.tsx** — `bg-gray-50` → `bg-white`; sections → `.card p-6`; h1/h2 per mapping; FactItem labels zinc-400 12px / values zinc-900 14px; "Edit facts" link zinc underline; danger zone: `.card` with `border-[#dc2626]/25`, h2 `text-[#dc2626] font-medium`, delete link `.btn .btn-outline` with `text-[#dc2626] border-[#dc2626]/40`.
- [ ] **DeleteAccountClient.tsx** — `bg-gray-50` → white; card → `.card p-8`; drop ⚠️ emoji → eyebrow `DELETE ACCOUNT`; destructive buttons: `w-full rounded-full bg-[#dc2626] px-4 py-2.5 text-sm text-white hover:bg-[#b91c1c]` (pill to match system); cancel `.btn .btn-outline w-full`.
- [ ] **not-found.tsx** — white, centered `min-h-[70vh]`: mono eyebrow `404 · NOT ASSESSABLE` (brand-text), h1 400 "This page is not deductible." (no serif/italic), zinc-500 copy, `.btn-primary` home + `.btn-outline` docs.
- [ ] Build + commit `feat(web): account + 404 restyle`.

### Task 10: Verification sweep + handoff

- [ ] **Grep audit** — `grep -rnE "mesh-|grain|dotgrid|card-night|card-light|grad-text|btn-solid|btn-ghost|font-serif|5039bd|7a5cff|c794ff|05030f|ff9a3c|text-blue-600|bg-blue-|bg-gray-900|bg-amber-50|Instrument|Hanken|Plex" packages/web/app packages/web/components packages/web/tailwind.config.ts` → zero hits.
- [ ] **Tests + typecheck + build** — `pnpm --filter @ato-mcp/web test && pnpm --filter @ato-mcp/web typecheck && pnpm --filter @ato-mcp/web build` → all green.
- [ ] **Screenshot sweep** — `pnpm --filter @ato-mcp/web dev` (port 3001) + Playwright script: 1440×900 and 390×844 of `/`, `/docs`, `/privacy`, `/terms`, `/onboard`, 404. Review each against spec; fix regressions found.
- [ ] **HANDOFF.md** — add redesign entry (what changed, where the spec lives).
- [ ] Final commit + push branch `feat/clinical-redesign`, open PR (do not merge).

## Self-review
- Spec coverage: §3 tokens→Tasks 1–2; §4 brand→Task 3; §5.1→Tasks 4–5; §5.2→6; §5.3→7; §5.4→8; §5.5/5.6→9; §6 audit + §8 testing→10. ✔
- No placeholders: every task names exact files, classes, and copy decisions. ✔
- Type consistency: only class vocabulary + existing props; no new TS types introduced. ✔
