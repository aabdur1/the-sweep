# Dark Mode — Design Spec

**Status:** approved
**Date:** 2026-05-02
**Aesthetic direction:** Inverted Parchment

## Goal

Add a dark variant of the editorial broadsheet aesthetic that follows OS preference by default and offers a manual override. Preserve the project's identity (cream + navy + Pantone red + Pantone blue, three-Plex fonts) — dark mode is a transposition of the same palette, not a redesign.

The design system note in `CLAUDE.md` explicitly warns: "needs its own design pass, not just inverted colors." This spec is that design pass.

## Aesthetic — "Inverted Parchment"

The existing deep navy ink (`#0F1A2E`) becomes the page. The existing parchment cream (`#F1E9D2`) becomes the writing. Pantone red and Pantone blue stay as the accent system, lifted slightly so they don't chromatically vibrate on navy.

The metaphor is a civic ledger — leather-bound records book, technical drawing on blueprint paper. Editorial identity stays intact: same fonts, same star motif, same heavy borders, same Section I/II/III/IV structure. Only the page color shifts.

## Architecture

### Detection

A class on `<html>` controls everything: `<html class="dark">` activates dark mode; absence of the class is light mode (the default).

`:root.dark { ... }` overrides the existing palette CSS variables. This reuses the same mechanic the print stylesheet ships with (`@media print { :root { ... } }`), so we keep one consistent palette-override system instead of inventing a parallel one.

### State machine

```
Initial load (synchronous, before React mounts):
  saved = localStorage['sweep.theme']
  if saved === 'dark' → applyMode('dark')
  else if saved === 'light' → applyMode('light')
  else if matchMedia('(prefers-color-scheme: dark)').matches → applyMode('dark')
  else → applyMode('light')

User clicks toggle:
  next = current === 'dark' ? 'light' : 'dark'
  localStorage['sweep.theme'] = next
  applyMode(next)

OS preference change:
  if localStorage['sweep.theme'] is unset:
    applyMode(new OS pref)
  else:
    ignore  (user has explicitly chosen)
```

Where `applyMode(mode)` adds or removes `.dark` on `document.documentElement`.

### Avoiding the wrong-mode flash

The detection script must run **before React mounts and before any styled content paints**, otherwise users get a millisecond of light-mode chrome before dark-mode kicks in. The fix: inline the detection script in `index.html` immediately after the `<title>`/`<meta>` block, in the `<head>`. Inline JS executes synchronously; React's `main.tsx` only loads after.

### Modules

- **`src/lib/theme.ts`** — pure. Exports `getInitialMode()`, `applyMode(mode)`, `subscribeToSystemPref(cb)`, `persistMode(mode)`, `clearPersistedMode()`. No React imports.
- **`src/hooks/useTheme.ts`** — React hook. Reads current mode from `document.documentElement.classList`, subscribes to system pref changes when un-overridden, returns `{ mode, toggle }`.
- **`src/components/ThemeToggle.tsx`** — small button rendered top-right in the masthead. Calls `useTheme().toggle()`.

## Palette tokens

Add this block to `src/index.css` next to the existing `:root` declaration:

```css
:root.dark {
  --cream:        #0F1A2E;
  --cream-dark:   #1A2540;
  --ink:          #F1E9D2;
  --ink-soft:     #D4C9A8;
  --chicago-red:  #E54B66;
  --red-deep:     #D6647A;
  --chicago-blue: #6BCBEC;
  --blue-deep:    #8FD7EE;
  --rule:         #D4C9A8;
}
```

### Calibration notes

- **Lifted red** (`#E54B66` from `#C8102E`). The original Pantone red sits too close in luminance to navy; pairing them at small text sizes creates a visible chromatic shimmer. Desaturating the red toward salmon resolves the vibration without losing "urgency" cues.
- **Lifted blue** (`#6BCBEC` from `#41B6E6`). The original blue is also slightly muddied on navy. Pulling it toward a cooler cyan keeps the calm-state contrast crisp.
- **`--ink-soft: #D4C9A8`** clears WCAG AA contrast at 7.5:1 against `--cream: #0F1A2E`, which keeps marginalia and footnote body copy legible.

## Tint tokens (for inline-style backgrounds)

A handful of components hardcode hex backgrounds inline (`style={{ background: '#FAEBEB' }}`) that don't read CSS vars. Without intervention these would stay light-pink rectangles on a navy page in dark mode.

Add three semantic tint tokens to `:root` and `:root.dark`:

```css
:root {
  --tint-urgency: #FAEBEB;   /* hot card bg — light pink (current sweep urgency) */
  --tint-calm:    #E5F4FB;   /* cool card bg — light cyan (current calm state) */
  --tint-card:    #FAF4E0;   /* warm card bg — pale cream (current routine cards) */
}
:root.dark {
  --tint-urgency: #2A1620;   /* deep wine — urgent without glare */
  --tint-calm:    #142A38;   /* deep teal-navy — sits one step above page */
  --tint-card:    #1A2540;   /* matches --cream-dark — invisible "card" against page table */
}
```

Then replace each inline-hex site with the matching var. Inventory verified against the codebase:

| File | Line | Current | Replace with |
|---|---|---|---|
| `NextSweepHero.tsx` | 26 | `'#E5F4FB'` (Season Concluded panel) | `'var(--tint-calm)'` |
| `NextSweepHero.tsx` | 45 | `bg = isUrgent ? '#FAEBEB' : '#E5F4FB'` | `bg = isUrgent ? 'var(--tint-urgency)' : 'var(--tint-calm)'` |
| `RoutinePickups.tsx` | 44 | `'#FAF4E0'` (recycling card) | `'var(--tint-card)'` |
| `RoutinePickups.tsx` | 61 | `'#FAF4E0'` (garbage card) | `'var(--tint-card)'` |
| `RoutinePickups.tsx` | 80 | `'#FAEBEB'` (holiday-shift alert) | `'var(--tint-urgency)'` |
| `ErrorPanel.tsx` | 28 | `'#FAEBEB'` (error panel ground) | `'var(--tint-urgency)'` |
| `AddressInput.tsx` | 101 | `'#FAF4E0'` (form panel ground) | `'var(--tint-card)'` |

Seven inline-style sites total. Surgical edit, no Tailwind `dark:` proliferation.

## Grain texture

The `.grain` utility currently uses red + navy rgba dots over a cream ground. On dark mode those dots vanish (the rgba opacities are tuned for cream). Add a dark variant:

```css
:root.dark .grain {
  background-image:
    radial-gradient(rgba(241,233,210,0.05) 1px, transparent 1px),
    radial-gradient(rgba(229,75,102,0.05) 1px, transparent 1px);
  background-size: 3px 3px, 7px 7px;
  background-position: 0 0, 1px 2px;
}
```

Cream + red dots at slightly higher opacity, sized identically to light mode.

## Toggle component

### Placement

Top-right of the masthead's banner element, positioned `absolute` inside the relative-positioned masthead container. Aligns visually with the existing volume / date / season meta block on the left.

### Appearance

A `<button>` containing a single `<ChicagoStar size={14}>`:

- **Light mode**: filled star (current ChicagoStar render), `text-chicago-red` color, `aria-label="Switch to dark mode"`
- **Dark mode**: outlined star (new prop), same `text-chicago-red`, `aria-label="Switch to light mode"`

The "lit by day, dark by night" symbolism ties into the existing four-stars motif without inventing new iconography.

### `ChicagoStar` extension

Add an optional `outlined?: boolean` prop. When `true`, the SVG's `<path>` switches from `fill="currentColor"` to `fill="none" stroke="currentColor" strokeWidth="1.5"`. No size or shape changes. The component stays single-file.

### Hover/focus states

`hover:scale-110 transition-transform duration-150` to match other masthead-level button affordances. Visible focus ring for keyboard users (`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chicago-red`).

## Print interaction

The existing `@media print { :root { ... } }` block in `src/index.css` overrides palette tokens for print regardless of the `<html class="dark">` state. Print's media query specificity wins. **The printed almanac stays B&W whether the user prints from light or dark mode.** No additional print-stylesheet changes required; verify visually in print preview.

## Files

| File | Change |
|---|---|
| `index.html` | Add inline pre-mount detection script in `<head>` |
| `src/index.css` | `:root.dark` block + tint tokens (light + dark) + `.grain` dark variant |
| `src/lib/theme.ts` | **New.** Pure module: `getInitialMode`, `applyMode`, `persistMode`, `clearPersistedMode`, `subscribeToSystemPref` |
| `src/hooks/useTheme.ts` | **New.** React hook wrapping `theme.ts` |
| `src/components/ThemeToggle.tsx` | **New.** Star-button toggle |
| `src/components/ChicagoStar.tsx` | Add `outlined?: boolean` prop |
| `src/components/Masthead.tsx` | Render `<ThemeToggle />` top-right inside the banner |
| `src/components/NextSweepHero.tsx` | 2 inline tints → tint vars |
| `src/components/RoutinePickups.tsx` | 3 inline tints → tint vars |
| `src/components/ErrorPanel.tsx` | 1 inline tint → tint var |
| `src/components/AddressInput.tsx` | 1 inline tint → tint var |
| `CLAUDE.md` | Document dark mode in Design system + move from Backlog to Shipped |

12 files, all small edits. No new npm packages.

## Out of scope (intentionally)

- **Tri-state toggle ("system / light / dark").** The auto-default + manual-override pattern covers the 99% case. Tri-state adds UI without proportional value.
- **Per-component dark redesign beyond palette transposition.** The aesthetic decision was "dark mode = palette swap." Targeted patches if anything looks wrong after implementation, but no upfront component re-skinning.
- **Animated mode transitions.** Instant switches read more honest than fading. Pro-grade dark-mode toggles avoid transitions.
- **Per-page mode (e.g., always-dark print preview).** Print is already B&W via the `@media print` override.

## Verification

Manual smoke at the canonical address (`1819 S California Ave` → Ward 25 §03) under both modes:

1. **Default mode auto-detects** OS preference. Toggle once: localStorage now persists `'dark'` (or `'light'`); refresh keeps the choice.
2. **Toggle visible** in masthead top-right at all viewport sizes. Filled star = light, outlined star = dark.
3. **Palette transposes correctly:** masthead, hero (urgent + calm states), routine pickups, almanac filter chips, almanac date pills, holiday-shift alerts, marginalia + tooltip, footnotes, footer all read the new palette without stranded light-mode hex backgrounds.
4. **Grain texture** is visible on dark page (parchment grain reads against navy).
5. **Print preview** in dark mode renders pure B&W broadsheet (same as light-mode print).
6. **No FOUC** on hard reload — page paints in the correct mode immediately.
7. **OS pref tracking**: with localStorage cleared, flipping the OS dark-mode setting updates the page live without a refresh.
