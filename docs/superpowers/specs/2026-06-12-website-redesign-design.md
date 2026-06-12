# Website + Brand Redesign — "Clinical" Design System

**Date:** 2026-06-12
**Status:** Approved (direction + design system + homepage structure approved by William in brainstorming session; remaining sections finalized under delegated authority)
**Scope:** All of `packages/web` (every page + component), brand assets (logo mark, favicon, OG image). One pass.

## 1. Why

The v1.0 site shipped with the "NOX-family aesthetic": near-black mesh-gradient hero cards, purple brand (`#5039bd`/`#7a5cff`/`#c794ff`), ember orange, grain textures, dot-grids, glass pill nav, shine-sweep buttons, gradient text, chip marquees and italic-serif accent words. William's verdict: it feels "vibe coded" — too dark, too purple, too many effects.

Target: clean, modern, minimalistic, modelled on **superpower.com**, whose system we analysed extensively (live screenshots + computed-style extraction, 2026-06-12):

- One grotesque typeface (NB International Pro), **weight 400 for every heading**, tight tracking (≈ −2%)
- Tailwind-zinc neutral palette; white + `#fafafa` section alternation
- ONE accent (vermillion `#fc5f2b`) used on ~13 elements across a 14,700px-tall page
- Pill buttons, weight 400, zero shadows/gradients
- Tokenized radii (0.25–2.5rem), cards at ~12px
- ~1200px container, ~560px text measure, 75–200px section padding
- Quiet components: striped feature tables, numbered editorial indexes (01–04), hairline dividers
- Photography carries all warmth; UI chrome stays neutral

## 2. Decisions from brainstorming (locked)

| Question | Decision |
|---|---|
| Scope | Everything, one pass: marketing pages + onboard/account flows + brand assets |
| Light vs dark | **Fully light site.** Dark only in small elements (buttons, text). No dark hero, no dark footer, no dark code panels |
| Imagery | **Product-led with a hint of abstract.** Real product output (cited answer card, tool names, stats) is the visual anchor; one barely-there abstract citation-graph motif allowed in the hero |
| Direction | **A — "Clinical": Switzer + vermillion on zinc** (chosen over Ledger green and Civic cobalt in rendered comparison) |

## 3. Design system

### 3.1 Typography

- **Switzer** (Fontshare, ITF Free Font License — free for commercial use, self-hosted via `next/font/local`, variable woff2, weights 400/500 used) — replaces Hanken Grotesk. CSS var `--font-sans`.
- **Geist Mono** (Google Fonts via `next/font/google`) — replaces IBM Plex Mono. Used for: tool names, citations, code, stat labels, eyebrow/section labels. CSS var `--font-mono`.
- **Instrument Serif is deleted.** No serif, no italic accent words anywhere.

Scale (desktop → fluid clamp):

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| display (h1) | clamp(2.5rem, 5vw, 3.5rem) | 400 | −0.022em | line-height 1.04 |
| h2 | clamp(1.6rem, 3vw, 2.25rem) | 400 | −0.02em | line-height 1.1 |
| h3 | 1.125rem | 500 | −0.01em | card titles, UI emphasis |
| body | 0.9375rem (15px) | 400 | 0 | line-height 1.55, color `#3f3f46` |
| secondary | 0.875rem | 400 | 0 | color `#71717a` |
| label/eyebrow | 0.6875rem mono | 400–500 | +0.08em uppercase | color `#a1a1aa` |

Rules: **no bold headlines** (≥600 reserved for nothing above h3 weight 500); hierarchy from size + space.

### 3.2 Color

Neutrals (zinc):

```
ink (text):        #18181b
body text:         #3f3f46
secondary:         #71717a
tertiary/captions: #a1a1aa
border-strong:     #d4d4d8
border:            #e4e4e7
fill:              #f4f4f5
section-alt:       #fafafa
page:              #ffffff
```

Accent — vermillion, budgeted at "a few small elements per screen":

```
brand:       #fa520f   (dots, logo, small markers)
brand-text:  #c2410c   (text on light, citation chip text, mono tool names)
brand-200:   #ffd9c4   (rare borders)
brand-50:    #fff3ec   (citation chip fill)
```

Where the accent appears: citation chips, status dots, the logo, link hover, mono tool-name labels. **Never** button fills, backgrounds, gradients, or large areas. Deleted: all purples, `--night`, `--ember` as a second accent, every mesh/radial gradient, grain, dot-grid.

Semantic: error `#dc2626`, success `#16a34a` (forms only, sparingly). Focus rings: `#18181b` (2px), not vermillion.

### 3.3 Components

- **Buttons** — pill (9999px), weight 400, flat: `btn-primary` ink bg/white text (hover `#3f3f46`); `btn-outline` white bg/ink text/`#d4d4d8` border (hover border `#a1a1aa`); `btn-fill` `#f4f4f5` bg. No shine sweep, no translate-on-hover, no colored shadows.
- **Cards** — white bg + 1px `#e4e4e7` border, radius 12px, padding 1.5rem; or `#fafafa` fill with `#f4f4f5` border. Optional shadow at most `0 1px 2px rgba(0,0,0,0.03)`. No hover lift, no backdrop blur.
- **Citation chips** — radius 5px (not pills), `#fff3ec` bg, `#c2410c` mono text, 5px vermillion dot. The signature brand element.
- **Code blocks** — `#fafafa` bg, `#e4e4e7` border, radius 10px, Geist Mono 12–13px, `#3f3f46` text. **No black panels.**
- **Tables (striped)** — superpower pattern: alternating white/`#fafafa` rows, mono first column, secondary-color description column. Used for the retrieval-tool list, privacy schema fields.
- **Numbered index** — right-aligned editorial list with mono `01…04` numerals and hairline dividers.
- **Accordions (FAQ)** — no boxes: hairline `#f4f4f5` dividers, `+` rotates 45° on open, zinc only.
- **Badges** — mono uppercase 9–10px in pill, `#f4f4f5`/`#3f3f46` (neutral) or `#fff3ec`/`#c2410c` (accent).

### 3.4 Motion

- Entrance reveal: opacity 0→1 + translateY 8px→0, 0.5s ease-out, staggered via `--reveal-delay`. **No blur filter.**
- Scroll-triggered reveals: keep `@supports (animation-timeline: view())` block, same simplified animation.
- Hover: color/border-color transitions only (0.2s).
- Deleted: btnShine, chipMarquee, shimmer, floatSlow, grain, card hover translate.
- `prefers-reduced-motion` support retained.

### 3.5 Layout

- Container: `max-w-6xl` (1152px) — unchanged.
- Text measure: subcopy capped ~`max-w-xl`.
- Section rhythm: `py-20 sm:py-28` (white) alternating with `#fafafa` full-bleed bands (no more rounded floating dark cards — sections run edge-to-edge with internal container).
- Nav height ~4rem, content offset accordingly.

## 4. Brand assets

- **Mark:** vermillion `#fa520f` rounded square (radius ≈ 28% of side), containing the **citation-chip motif in white**: a small filled circle (the dot) + a rounded horizontal bar (the reference text), vertically centered. Semantics: the brand IS a citation. Replaces the purple square with orbiting circles.
- **Wordmark:** `ato-mcp` in Switzer 500, ink, −0.01em. Mark sits left of wordmark in nav/footer.
- **Favicon:** `app/icon.svg` redrawn to the new mark.
- **OG image (`app/opengraph-image.tsx`):** white field, mark + wordmark top-left, display-size headline "Your AI agent, fluent in Australian tax", a row of 3 citation chips, stat line in mono at bottom. Switzer loaded into `ImageResponse`.
- ~~apple-icon / PWA icons~~ — out of scope (none exist today).

## 5. Page-by-page

### 5.1 Homepage (`app/page.tsx`) — structure approved via wireframe

1. **Nav** — full-width white bar, hairline `#e4e4e7` bottom border that appears on scroll (no floating glass pill, no width morph). Logo left, links center-right, ink pill CTA. Mobile: plain white dropdown sheet, hairline borders.
2. **Hero (white)** — two-column ≥lg (text 1.1fr / demo 0.9fr): eyebrow with vermillion dot (`v1.0 · open source · MIT`), display headline **"Your AI agent, fluent in Australian tax"** (plain — no italic, no colored period), subcopy (existing copy minus "Not vibes."), ink + outline pills, mono install hint. **Demo card** = the product answer rendered as a *white* card: hairline border, radius 14px, mono header `claude · ato-mcp connected`, question in mono secondary, answer text `#3f3f46`, vermillion citation chips, resolved-citations footer line. *Abstract hint:* one faint SVG citation-graph (hairline zinc-200 edges, 3–4 nodes, one vermillion dot at 30% opacity) positioned behind/right of the demo card. Subtle: invisible unless looked for.
3. **Hero stat strip** — replaces the chip marquee: hairline-top row of 3 inline stats (number 19–21px ink, mono label below in tertiary): 29,181 ATO documents · 2,127 public rulings · 13 MCP tools.
4. **How it works (NEW, white)** — centered h2 + 4 numbered cards (mono numeral, micro-illustration area in `#f4f4f5` showing a product fragment — install command / wizard step / config line / cited answer): Install → Onboard → Connect → Ask.
5. **The corpus** — left h2 "The whole landscape, indexed" + body; grid: 3 stat cards (white, hairline, plain ink numerals — **no gradient text**) + right-rail numbered index (Guidance 01 / Statute 02 / Rulings 03 / Citation graph 04 with one-line descriptions). Existing six STATS consolidated: hero strip takes doc-count/rulings/tools; corpus cards take chunks/ITAA sections/citation edges.
6. **Workflow tools (`#fafafa` band)** — h2 "Workflows that know who's asking" + 2×2 white cards: mono tool name in `#c2410c`, h3 500 title, body secondary. Same copy as today.
7. **Retrieval layer** — within the same band: striped table, mono tool name column + description column, 9 rows: search / get_definition / get_threshold / get_doc / get_doc_anchors / get_chunks / fetch / stats / get_user_facts. Link to docs.
8. **Modes (white)** — h2 "Your tax data, your terms", two hairline cards (Local / Hosted), neutral + accent badges, light code blocks, check-row underneath: ✓ identical shared tool core ✓ MIT licensed ✓ sha256-verified releases.
9. **Privacy (white, centered statement)** — superpower "$10,000 → $199" treatment: eyebrow, big centered weight-400 statement "The privacy policy is generated from the database schema — so it can't lie.", subcopy, outline pill → /privacy.
10. **FAQ** — same six questions, hairline-divider accordions, no boxes.
11. **Final CTA (`#fafafa` band)** — centered h2 "Two minutes to a tax-fluent agent", subline, ink pill + outline pill. No dark mesh.
12. **Footer (white)** — hairline top border, 3 columns (blurb / Product / Trust), legal row. **Giant gradient wordmark deleted.** Not-tax-advice line retained.

JSON-LD, metadata, FAQ schema: unchanged. Copy edits limited to: headline simplification, removing "Not vibes.", removing italic emphasis. Section `id`s (`#tools`, `#modes`) retained for nav anchors.

### 5.2 Docs (`app/docs/page.tsx`)
Same tokens: h1 400, mono tool names in `#c2410c`, light code blocks, striped parameter tables if present, hairline section dividers. No structural change.

### 5.3 Privacy + Terms (`app/privacy`, `app/terms`)
Schema-driven structure untouched (contract test `test/privacy-contract.test.tsx` must stay green). Restyle: field tables → striped-table component, cards → hairline, headings → weight 400. No dark elements.

### 5.4 Onboard wizard (`app/onboard/*`, `components/FactsWizard.tsx`, `ModeCard.tsx`, `InstallSnippet.tsx`)
- Step indicator: mono numerals + hairline progress.
- Inputs: white, `#d4d4d8` border, radius 10px, focus ring 2px ink; labels 13px 500; helper text secondary; errors `#dc2626`.
- ModeCard: hairline card, neutral/accent badges (mirrors homepage Modes).
- InstallSnippet: light code block + ink "copy" pill.
- Wizard CTAs: ink pill primary / outline back.

### 5.5 Account (`app/account/*`, `DeleteAccountClient.tsx`)
Hairline cards, striped table for facts review, ink pills; delete flow: outline button with `#dc2626` text/border + confirm step unchanged.

### 5.6 not-found
Centered: mono `404` eyebrow, h2 400, outline pill home.

## 6. Implementation notes

- `globals.css` rewritten: tokens (`:root` vars for the palettes above), base typography, `.btn-*` (3 variants), `.card`, `.chip`, `.code-block`, `.table-striped`, `.eyebrow`, `.reveal`/`.reveal-scroll`, reduced-motion block. Target ≤ ~140 lines. Everything else (mesh, grain, dotgrid, card-night, term, marquee, wordmark, grad-text, btnShine) deleted.
- `tailwind.config.ts`: zinc-aliased semantic colors (`ink`, `body`, `secondary`, `line`, `fill`, `alt`, `brand.{DEFAULT,text,200,50}`), font vars, remove chipMarquee/shimmer/floatSlow keyframes.
- `layout.tsx`: Switzer via `next/font/local` (woff2 files committed under `app/fonts/`), Geist Mono via `next/font/google`, Instrument Serif + Hanken Grotesk + IBM Plex Mono removed. Metadata untouched.
- Switzer variable woff2 (~100–200 KB) downloaded from Fontshare; license file noted in repo (`app/fonts/LICENSE-switzer.txt` or comment).
- OG image: `ImageResponse` loads Switzer woff (ArrayBuffer) — verify < 1MB edge bundle constraint isn't violated (og route runs default runtime here, fine on Node).
- Grep-audit at the end: no `mesh-`, `grain`, `card-night`, `grad-text`, `btn-solid`, `#5039bd`, `#7a5cff`, `#c794ff`, `#05030f`, `font-serif` references anywhere in `packages/web`.

## 7. Non-goals

- No copy rewrite beyond the listed edits; no IA changes beyond the new How-it-works section and marquee→stat-strip swap.
- No new pages, no blog, no dark-mode toggle (site is light-only by decision).
- No animation library (CSS only, as today).
- No changes to backend, MCP package, or pipeline.
- README/repo badges and npm package branding: out of scope this pass.

## 8. Testing & verification

1. `pnpm --filter @ato-mcp/web test` — privacy contract test green.
2. `pnpm --filter @ato-mcp/web build` — clean build, no missing-font errors.
3. Playwright screenshot sweep (desktop 1440 + mobile 390) of /, /docs, /privacy, /terms, /onboard, /account (logged-out state), 404 — visual review against this spec.
4. Grep-audit per §6.
5. Lighthouse sanity on / (fonts self-hosted, no CLS from font swap — `display: swap` + size-adjust if needed).
