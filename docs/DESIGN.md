# 技能树学习 — Design System
> A warm, paper-like workspace for AI-powered skill tree learning. Ivory canvas, near-black ink, and a single dusty-blue accent.

**Theme:** light + dark

The interface reads like a quiet study desk: a warm off-white canvas under near-black text, with hairline borders that frame content like printed margins. Color is rationed to a single dusty-blue accent, used only for emphasis and interactive states. Typography carries the brand: a literary serif for headlines and a humanist sans for UI. Components are flat, border-defined, and gently rounded — the system avoids drop shadows in favor of surface contrast and subtle borders.

## Principles

- **Paper, not glass.** The base canvas feels like cream paper; cards sit on top in pure white or warm parchment.
- **Ink-first hierarchy.** Near-black text on a warm background provides almost all visual structure.
- **One accent.** Dust blue is the only chromatic color; everything else is neutral.
- **Flat & bordered.** No drop shadows; depth comes from borders and background shifts.
- **Generous whitespace.** Section gaps are large; cards breathe with 20–32px padding.

## Tokens — Colors

### Semantic Palette (Light)

| Name | Value | Tailwind Token | Role |
|------|-------|----------------|------|
| Canvas | `#faf9f5` | `bg-canvas` | Page background — warm off-white |
| Surface | `#ffffff` | `bg-surface` | Cards, inputs, elevated containers |
| Elevated | `#f0eee6` | `bg-elevated` | Hover washes, toggle tracks, muted zones |
| Interactive | `#f5f4ef` | `bg-interactive` | Subtle interactive backgrounds |
| Overlay | `rgba(20,20,19,0.4)` | `bg-overlay` | Modal backdrops |
| Ink | `#141413` | `text-ink` | Primary text, active outlines |
| Secondary | `#3d3d3a` | `text-secondary` | Secondary text, labels |
| Muted | `#73726c` | `text-muted` | Helper text, inactive nav items |
| Placeholder | `#9c9a92` | `text-placeholder` | Input placeholders |
| Border | `#dedcd1` | `border-border` | Hairline borders, card edges |
| Border Strong | `#cdcbc1` | `border-border-strong` | Hover borders, dividers |
| Accent | `#ccdbe8` | `bg-accent` | Sole chromatic accent — badges, status, highlights |
| Accent Text | `#1f1e1d` | `text-accent-text` | Text on accent backgrounds |
| Danger | `#c9372d` | `text-danger` | Errors, destructive actions |
| Success | `#2d6a4f` | `text-success` | Completed / success states |
| Code Background | `#f0eee6` | `bg-code-bg` | Inline / block code backgrounds |

### Semantic Palette (Dark)

| Name | Value | Tailwind Token | Role |
|------|-------|----------------|------|
| Canvas | `#131311` | `bg-canvas` | Dark page background |
| Surface | `#1c1c19` | `bg-surface` | Dark cards and inputs |
| Elevated | `#252522` | `bg-elevated` | Dark hover / muted surfaces |
| Interactive | `#2a2a26` | `bg-interactive` | Dark interactive backgrounds |
| Overlay | `rgba(10,10,9,0.65)` | `bg-overlay` | Dark modal backdrops |
| Ink | `#f5f4ef` | `text-ink` | Dark-mode primary text |
| Secondary | `#d8d7d0` | `text-secondary` | Dark-mode secondary text |
| Muted | `#a3a29b` | `text-muted` | Dark-mode helper text |
| Placeholder | `#73726c` | `text-placeholder` | Dark-mode placeholders |
| Border | `#363632` | `border-border` | Dark hairline borders |
| Border Strong | `#4a4a44` | `border-border-strong` | Dark hover borders |
| Accent | `#4a6fa5` | `bg-accent` | Dark accent (deeper slate blue) |
| Accent Text | `#e8f0f8` | `text-accent-text` | Text on dark accent |
| Danger | `#ef4444` | `text-danger` | Dark-mode errors |
| Success | `#4ade80` | `text-success` | Dark-mode success |
| Code Background | `#1f1f1c` | `bg-code-bg` | Dark code backgrounds |

### Legacy Aliases

For historical compatibility, the old Claude-style aliases are still mapped to the semantic tokens:

- `--color-ivory-canvas` → `--bg-canvas`
- `--color-pure-white` → `--bg-surface`
- `--color-warm-parchment` → `--bg-elevated`
- `--color-ink-black` → `--text-primary`
- `--color-charcoal` → `--text-secondary`
- `--color-warm-slate` → `#3d3d3a`
- `--color-stone-gray` → `--text-muted`
- `--color-pewter` → `--text-placeholder`
- `--color-linen-border` → `--border-default`
- `--color-cool-stone` → `#b7b7b5`
- `--color-dust-blue` → `--accent`

## Tokens — Typography

### Font Families

| Token | Font | Role |
|-------|------|------|
| `--font-anthropic-serif` | Source Serif 4 | Headlines, page titles, card titles |
| `--font-anthropic-sans` | Plus Jakarta Sans | UI text, body, buttons, labels |
| `--font-mono` | JetBrains Mono | Code examples, inline code |

### Type Scale

| Role | Size | Line Height | Token |
|------|------|-------------|-------|
| caption | 11px | 1.5 | `--text-caption` |
| body | 15px | 1.63 | `--text-body` |
| subheading | 18px | 1.56 | `--text-subheading` |
| heading-sm | 24px | 1.33 | `--text-heading-sm` |
| heading | 30px | 1.33 | `--text-heading` |
| display | 56px | 1.2 | `--text-display` |

### Weights

- **330** — Large serif display (page title, hero).
- **400** — Body and card descriptions.
- **430** — Button labels and emphasized UI text.
- **500** — Labels, tab text, small headings.
- **600** — Badges, uppercase labels.

## Tokens — Spacing & Shapes

**Base unit:** 8px

### Spacing Scale

| Token | Value |
|-------|-------|
| `--spacing-8` | 8px |
| `--spacing-16` | 16px |
| `--spacing-24` | 24px |
| `--spacing-32` | 32px |
| `--spacing-40` | 40px |
| `--spacing-48` | 48px |
| `--spacing-64` | 64px |
| `--spacing-80` | 80px |
| `--spacing-96` | 96px |

### Border Radius

| Element | Value | Token |
|---------|-------|-------|
| buttons, inputs, nav items, small toggles | 9.6px | `--radius-lg` |
| cards, modals, dialogs | 16px | `--radius-2xl` |
| large containers | 24px | `--radius-3xl` |
| hero panels | 32px | `--radius-3xl-2` |
| fully rounded (avatars, status dots) | 9999px | `rounded-full` |

## Layout

- **Default page max-width:** 1200px, centered with `mx-auto` and `px-6`.
- **Fullscreen layout:** `h-screen` with `overflow-hidden`; the single-page skill tree fills the entire viewport and the nav stretches full-width.
- **Section gap:** 40px (`mb-10`).
- **Card grid:** 3 columns on large screens, 2 on small screens, gap 16px.

## Components

### AppButton

Primary interactive button. Radius 9.6px, font-weight 500.

| Variant | Style |
|---------|-------|
| `primary` | `bg-secondary text-surface hover:bg-ink` — filled dark CTA |
| `secondary` | `bg-surface text-ink border-border hover:border-strong hover:bg-elevated` |
| `soft` | `bg-canvas text-secondary border-border hover:border-strong hover:text-ink hover:bg-elevated` |
| `ghost` | `bg-transparent text-muted hover:text-ink hover:bg-elevated` |
| `danger` | `bg-danger text-surface hover:opacity-90` |

Sizes:
- `sm` — `px-4 py-1.5 text-[14px]`
- `md` — `px-5 py-2 text-[15px]`
- `lg` — `px-6 py-3 text-[16px]`

### AppInput

- `bg-surface` fill, `border-border` 1px border, 9.6px radius.
- `px-4 py-2.5` padding, 15px `text-ink`.
- Placeholder in `text-placeholder`.
- Focus: `border-strong`, no ring or shadow.
- Label: 13px, weight 500, `text-secondary`.
- Error message: 13px `text-danger`.

### AppSkeleton

Loading placeholders using `animate-pulse` and `bg-elevated`.

| Variant | Usage |
|---------|-------|
| `text` | Stacked lines for paragraph placeholders |
| `card` | Single rounded rectangle |
| `dashboard-cards` | 3-column grid of realistic card skeletons |
| `circle` | Avatar / icon placeholders |

Dashboard skeleton cards use `h-36`, `border border-border bg-surface p-5`, and contain header/body/footer bars to mimic real cards.

### AppNav

- Sticky top, `h-14`, `border-b border-border`, `bg-canvas/90 backdrop-blur`.
- Left: brand title in serif 18px weight 330.
- Right (authenticated): 仪表盘 link, 设置 link, ThemeToggle icon, UserMenu.
- Right (guest): 登录 link, 注册 primary button, ThemeToggle.
- Default inner container max-width 1200px; on fullscreen routes it stretches full-width.

### UserMenu

- Trigger: ghost button with User icon, username, and chevron.
- Dropdown: rounded 12px, `bg-surface border-border`, user info divider, settings link, logout button.
- Logout item uses `hover:bg-danger-bg hover:text-danger`.

### ThemeToggle

- Icon-only ghost trigger (sun / moon / monitor) with tooltip showing current mode.
- Dropdown offers 白天 / 黑夜 / 系统 options.

### AppToast

- Fixed top-center, max-width-md.
- Rounded 9.6px, border, no shadow.
- Types:
  - `success`: `border-success/30 bg-success-bg text-success`
  - `error`: `border-danger/30 bg-danger-bg text-danger`
  - `info`: `border-accent/30 bg-accent/10 text-accent-text`

### AppConfirmDialog

- Centered modal over `bg-overlay`.
- `max-w-[400px]`, 16px radius, `bg-surface border-border p-6`.
- Title in serif 18px; message in 14px muted; Cancel + Confirm buttons.

### DashboardHeader

- Page title: serif 30px weight 330 `text-ink`.
- Subtitle: 15px `text-muted`.

### DashboardSkillCard

- `rounded-[16px] border border-border bg-surface p-5`.
- Hover: `hover:border-strong hover:bg-elevated`.
- Title in serif 18px; type badge (ENTRY/EXPERT/INTERVIEW); description line-clamp-2.
- Delete button appears on group-hover.

### CurrentLearningCard

- Same card shell as skill card.
- Header: title + status badge (未开始 / 学习中 / 已完成 / 跳过).
- Description + optional "最近学习" line.
- Bottom: progress bar (`h-2 rounded-full bg-elevated`) with accent fill and percentage.

### RecommendationCard

- Same 16px bordered card shell.
- Title, description, reason, match tags, keyword tags.
- CTA: `AppButton variant="secondary" size="sm"`.

### Tree FlowNode

- Fixed size: `h-[190px] w-[340px]`, `rounded-[16px]`, `bg-surface border`.
- Left vertical stripe by level:
  - root: ink
  - L1: secondary
  - L2: accent
- Top badge: `L1` / `L2`, small rounded pill.
- Title: serif 18px; description: 14px muted line-clamp-2.
- Bottom-right action button: 初始化 / 分析 / 详情.
- Right-middle collapse toggle: circular `+/-` button, half-outside the node card.
- Selected / highlighted state: dashed ink outline with 3px offset.
- Status dot for learning progress (accent / success / muted).

### Tree DirectoryPanel

- Left collapsible sidebar, `w-[280px]` open, `w-[44px]` collapsed.
- `bg-surface border-r border-border`.
- Tree of L1 / L2 nodes; selected item gets `bg-accent/10 text-ink`.

### L2ContentPanel (Drawer)

- Right-side drawer, `w-[50vw] min-w-[560px] max-w-[720px]`, `bg-surface`.
- Header: level badge + serif 26px title + close button.
- Tabs: 概念 / 代码演示 / 练习题, underline active indicator.
- Main content scrollable.
- Footer: learning-status buttons (未开始 / 学习中 / 已完成 / 跳过).

## Learning Status Colors

| Status | Dot | Badge | Button |
|--------|-----|-------|--------|
| 未开始 | transparent | `bg-elevated text-secondary` | `bg-ink text-surface` |
| 学习中 | `bg-accent` | `bg-accent/10 text-accent-text` | `bg-accent text-accent-text` |
| 已完成 | `bg-success` | `bg-success/10 text-success` | `bg-success text-surface` |
| 跳过 | `bg-muted` | `bg-muted/10 text-muted` | `bg-muted text-surface` |

## Dark Mode

Dark mode is driven by `data-theme="dark"` on `<html>` and CSS variable overrides. The `useTheme` composable persists the choice (`light` / `dark` / `system`) in a cookie and applies the attribute on both client and server. All components use the semantic Tailwind tokens, so they automatically adapt.

## Do's and Don'ts

### Do
- Use the semantic tokens (`bg-canvas`, `text-ink`, `border-border`) instead of hard-coded hex values.
- Use `font-anthropic-serif` for page and card titles; `font-anthropic-sans` for body and UI.
- Use 9.6px radius for interactive elements and 16px for cards.
- Use `border-border` 1px borders for cards and containers.
- Keep the palette nearly monochrome; use `bg-accent` only for emphasis, badges, and learning status.
- Respect `prefers-reduced-motion` when adding animations.

### Don't
- Do not use drop shadows on cards or buttons — the system is flat and border-defined.
- Do not introduce new chromatic colors beyond the dusty-blue accent.
- Do not use bold (700+) weights for headings; 330–500 is the range.
- Do not use pure black (`#000000`) for text; `text-ink` is the correct near-black.
- Do not hard-code light-mode colors; always use semantic tokens so dark mode works.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Backgrounds */
  --bg-canvas: #faf9f5;
  --bg-surface: #ffffff;
  --bg-elevated: #f0eee6;
  --bg-interactive: #f5f4ef;
  --bg-overlay: rgba(20, 20, 19, 0.4);

  /* Text */
  --text-primary: #141413;
  --text-secondary: #3d3d3a;
  --text-muted: #73726c;
  --text-placeholder: #9c9a92;

  /* Borders */
  --border-default: #dedcd1;
  --border-strong: #cdcbc1;
  --border-subtle: rgba(222, 220, 209, 0.6);

  /* Accent */
  --accent: #ccdbe8;
  --accent-hover: #b9cce0;
  --accent-text: #1f1e1d;
  --accent-subtle: rgba(204, 219, 232, 0.5);

  /* Feedback */
  --danger: #c9372d;
  --danger-bg: #fef2f2;
  --success: #2d6a4f;
  --success-bg: #f0fdf4;

  /* Code */
  --code-bg: #f0eee6;
  --code-text: #1f1e1d;
}

[data-theme="dark"] {
  --bg-canvas: #131311;
  --bg-surface: #1c1c19;
  --bg-elevated: #252522;
  --bg-interactive: #2a2a26;
  --bg-overlay: rgba(10, 10, 9, 0.65);

  --text-primary: #f5f4ef;
  --text-secondary: #d8d7d0;
  --text-muted: #a3a29b;
  --text-placeholder: #73726c;

  --border-default: #363632;
  --border-strong: #4a4a44;
  --border-subtle: rgba(54, 54, 50, 0.6);

  --accent: #4a6fa5;
  --accent-hover: #5a82bd;
  --accent-text: #e8f0f8;
  --accent-subtle: rgba(74, 111, 165, 0.25);

  --danger: #ef4444;
  --danger-bg: #3f1a1a;
  --success: #4ade80;
  --success-bg: #1a3322;

  --code-bg: #1f1f1c;
  --code-text: #e8e7e2;
}
```

### Tailwind v4 Theme

```css
@theme {
  /* Semantic surface colors */
  --color-canvas: var(--bg-canvas);
  --color-surface: var(--bg-surface);
  --color-elevated: var(--bg-elevated);
  --color-interactive: var(--bg-interactive);
  --color-overlay: var(--bg-overlay);

  /* Semantic text colors */
  --color-ink: var(--text-primary);
  --color-secondary: var(--text-secondary);
  --color-muted: var(--text-muted);
  --color-placeholder: var(--text-placeholder);

  /* Semantic border colors */
  --color-border: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-border-subtle: var(--border-subtle);

  /* Semantic accent colors */
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-text: var(--accent-text);
  --color-accent-subtle: var(--accent-subtle);

  /* Semantic feedback colors */
  --color-danger: var(--danger);
  --color-danger-bg: var(--danger-bg);
  --color-success: var(--success);
  --color-success-bg: var(--success-bg);

  /* Semantic code colors */
  --color-code-bg: var(--code-bg);
  --color-code-text: var(--code-text);

  /* Typography */
  --font-anthropic-serif: 'Source Serif 4', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
  --font-anthropic-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Scale */
  --text-caption: 11px;
  --leading-caption: 1.5;
  --text-body: 15px;
  --leading-body: 1.63;
  --text-subheading: 18px;
  --leading-subheading: 1.56;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.33;
  --text-heading: 30px;
  --leading-heading: 1.33;
  --text-display: 56px;
  --leading-display: 1.2;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;

  /* Border radius */
  --radius-lg: 9.6px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
  --radius-3xl-2: 32px;
}
```
