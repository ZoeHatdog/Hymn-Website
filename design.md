# Design — Hymn desk

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

The palette, type, and hymn record come from the hymn app packages
(`shared-themes`, `shared-types`). The website `packages` folder is empty.

## Genre
editorial

## Macrostructure family
- Marketing pages: Index-First. The landing page is the index of tasks.
- App pages: the same masthead and letter close, with one task (add, update, or delete) in a single column. No enrichment.

## Theme
- `--color-paper`   oklch(98.3% 0.004 236.5)
- `--color-paper-2` oklch(96.2% 0.008 250)
- `--color-ink`     oklch(25.7% 0.09 268)
- `--color-ink-2`   oklch(35.4% 0.131 265.2)
- `--color-rule`    oklch(86.9% 0.019 250.6)
- `--color-accent`  oklch(59.6% 0.119 90.6)
- `--color-focus`   oklch(35.4% 0.131 265.2)

Primary actions use `--color-primary` (brand blue), not the gold accent.
Gold is a hairline under the masthead only.

## Typography
- Display: Besley, weight 700, style normal
- Body:    Noto Sans, weight 400
- Display tracking: -0.02em
- Type scale anchor: `--text-display` = 2.25rem (the package display size)

## Spacing
4-point named scale. The values are in `web-app/public/tokens.css`. Pages must use named
tokens (`var(--space-md)`), never raw values.

## Motion
- Easings: cubic-bezier(0.16, 1, 0.3, 1) named `--ease-out`
- Reveal pattern: none
- Reduced-motion fallback: no transform; opacity stays put

## Microinteractions stance
- Silent success. The button reads “Saved”. No toast.
- Hover delay is not used. Focus rings appear at 0ms.
- Delete asks for a second click on the same button, because the API cannot undo.

## CTA voice
- Primary CTA: filled brand blue, 10px radius, “Save hymn”
- Secondary CTA: outline ink, same radius, “Delete” / “Back to the list”

## Per-page allowances
- Marketing pages: typography only.
- App pages: no enrichment. The form or the hymn list is the page.

## What pages MUST share
- The wordmark “Hymn desk”.
- Besley + Noto Sans.
- Brand blue buttons and the gold masthead rule.
- The letter-close footer.

## What pages MAY differ on
- Whether the body is the task index, a form, or a hymn list.

## Exports

### tokens.css
See `web-app/public/tokens.css`.

### Tailwind v4 `@theme`
```css
@theme {
  --color-paper: oklch(98.3% 0.004 236.5);
  --color-ink: oklch(25.7% 0.09 268);
  --color-accent: oklch(59.6% 0.119 90.6);
  --color-primary: oklch(35.4% 0.131 265.2);
  --font-display: "Besley", serif;
  --font-body: "Noto Sans", sans-serif;
  --spacing-md: 1.25rem;
  --text-md: 1.125rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`
```json
{
  "color": {
    "paper": { "$value": "oklch(98.3% 0.004 236.5)", "$type": "color" },
    "ink": { "$value": "oklch(25.7% 0.09 268)", "$type": "color" },
    "accent": { "$value": "oklch(59.6% 0.119 90.6)", "$type": "color" },
    "primary": { "$value": "oklch(35.4% 0.131 265.2)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Besley", "$type": "fontFamily" },
    "body": { "$value": "Noto Sans", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1.25rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables
```css
:root {
  --background: 98.3% 0.004 236.5;
  --foreground: 25.7% 0.09 268;
  --primary: 35.4% 0.131 265.2;
  --primary-foreground: 100% 0 0;
  --muted: 86.9% 0.019 250.6;
  --muted-foreground: 45% 0.06 262;
  --border: 86.9% 0.019 250.6;
  --input: 86.9% 0.019 250.6;
  --ring: 35.4% 0.131 265.2;
  --radius: 10px;
}
```
