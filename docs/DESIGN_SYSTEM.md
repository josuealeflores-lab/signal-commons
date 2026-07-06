# Design System

## Visual references

The approved direction is in:

- `references/brand-guide.png`
- `references/dashboard-mockup.png`

Treat these images as visual intent, not pixel-perfect implementation specifications. Preserve the identity and hierarchy while improving accessibility, responsiveness, and realistic data density.

## Brand essence

- Transparent
- Investigative
- Accessible
- Human-in-the-loop
- Evidence-based
- Public-interest

## Mission line

> Turning scattered public signals into clear, source-linked intelligence about emerging AI companies shaping essential sectors.

## Color tokens

Use CSS variables and verify accessible contrast.

```css
--color-deep-teal: #0e5e5b;
--color-indigo-navy: #1b2a6b;
--color-soft-green: #4caf7d;
--color-warm-gold: #f2b735;
--color-light-gray: #f2f4f7;
--color-slate-gray: #6b7280;
--color-ink: #101828;
--color-surface: #ffffff;
--color-border: #dfe5ec;
```

The mockup is not permission to use low-contrast pale text. Adjust tokens where needed for WCAG AA.

## Typography

Use an open, highly readable sans-serif available through the application’s font system. Inter is the preferred direction.

- Display/page headings: semibold or bold
- Section headings: semibold
- Body/UI: regular
- Data values: semibold with tabular numerals where available

## Logo

The logo concept combines:

- a radar/signal motif;
- network nodes;
- shared public knowledge;
- a beacon or point of discovery.

For the MVP, extract or recreate a simple SVG inspired by the approved reference. Do not raster-crop the full brand guide as the application logo. Keep the mark original and simple enough to work at favicon size.

## Sector icon system

All seven sectors receive equal icon size and card treatment:

- Politics & Civic Technology — civic dome / public forum
- Government Operations — public building / operational workflow
- Agriculture — sprout / field
- Healthcare — medical cross
- Education — graduation cap / book
- Nonprofits — joined hands / heart
- Climate & Energy — wind, sun, grid, or leaf-energy symbol

Icons must have text labels and cannot be the only means of identifying a sector.

## Evidence semantics

Evidence strength is semantic, not decorative.

- High — green treatment plus “High” text
- Medium — gold treatment plus “Medium” text
- Low — neutral/slate treatment plus “Low” text
- Disputed — distinct warning treatment plus “Disputed” text

Do not rely on red/green alone. Include an icon or label.

## Layout principles

1. Show evidence clearly.
2. Label uncertainty.
3. Make discovery easy.
4. Keep public impact visible.
5. Give all seven sectors equal first-level prominence.
6. Prefer calm editorial density to futuristic decoration.

## Dashboard layout

Desktop order:

1. navigation;
2. title and description;
3. demo-data notice;
4. KPI summary cards;
5. equal seven-sector overview;
6. emerging list, activity chart, and research-queue preview;
7. company spotlight, evidence explainer, platform principles;
8. footer.

On smaller screens, stack sections in the same semantic order. Do not squeeze seven cards into unreadable miniatures; use a two-column grid or horizontally scrollable region with a visible label and keyboard support.

## Voice and tone

- plain language;
- curious but rigorous;
- specific about evidence;
- never hype without evidence;
- readable by non-experts;
- candid about uncertainty and missing information.

Preferred:

> A new county pilot provides early evidence of public-sector adoption. The customer has not yet published outcome data.

Avoid:

> This disruptive startup is revolutionizing government forever.

## Accessibility

- WCAG 2.2 AA target;
- visible focus states;
- keyboard-operable menus, filters, dialogs, and review actions;
- semantic headings;
- accessible names for icons;
- chart has a text summary or data table;
- do not encode status using color only;
- support reduced motion;
- sufficient touch targets;
- responsive text without clipping.
