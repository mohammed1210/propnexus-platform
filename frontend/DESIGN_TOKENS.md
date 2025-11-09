# PropNexus Design Token System

## Overview

This document outlines the design token system and utility classes for the PropNexus platform. The design system provides a unified foundation for building consistent, accessible, and polished user interfaces.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Border Radius](#border-radius)
6. [Shadows](#shadows)
7. [Component Utilities](#component-utilities)
8. [Dark Mode](#dark-mode)
9. [Best Practices](#best-practices)

---

## Getting Started

All design tokens are defined in `/frontend/styles/design-tokens.css` and are automatically available throughout the application via the global CSS import in `globals.css`.

### Usage Options

You can use design tokens in three ways:

1. **CSS Variables**: Direct usage in CSS/SCSS files
2. **Utility Classes**: Pre-built classes for common patterns
3. **Tailwind Classes**: Extended Tailwind config with token-based values

### Example

```css
/* CSS Variables */
.my-component {
  color: var(--pnx-primary);
  padding: var(--pnx-space-4);
  border-radius: var(--pnx-radius-md);
}

/* Utility Classes */
<button className="btn-primary">Click me</button>

/* Tailwind Classes */
<div className="bg-primary text-white p-4 rounded-md">Content</div>
```

---

## Color System

### Primary Colors

Primary colors are used for main actions, links, and brand elements.

| Token | Value (Light) | Value (Dark) | Usage |
|-------|---------------|--------------|-------|
| `--pnx-primary-50` | #eff6ff | - | Lightest background |
| `--pnx-primary-500` | #0ea5e9 | #38bdf8 | Main primary |
| `--pnx-primary-600` | #0284c7 | - | Hover state |
| `--pnx-primary-900` | #0c4a6e | - | Darkest |

**CSS Variables:**
```css
--pnx-primary (Main)
--pnx-primary-50 through --pnx-primary-900 (Shades)
```

**Utility Classes:**
```html
<span className="text-primary-500">Primary text</span>
<div className="bg-primary">Primary background</div>
```

### Secondary Colors

Secondary colors are used for supporting UI elements and neutral states.

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-secondary-50` | #f9fafb | Light backgrounds |
| `--pnx-secondary-500` | #6b7280 | Body text |
| `--pnx-secondary-900` | #111827 | Dark elements |

### Semantic Colors

Colors that convey meaning and status.

#### Success
- `--pnx-success-50` through `--pnx-success-700`
- Main: `--pnx-success` (#22c55e light, #34d399 dark)
- Usage: Success messages, completed states, positive metrics

#### Warning
- `--pnx-warning-50` through `--pnx-warning-700`
- Main: `--pnx-warning` (#f59e0b light, #fbbf24 dark)
- Usage: Warning messages, caution states, important notices

#### Error
- `--pnx-error-50` through `--pnx-error-700`
- Main: `--pnx-error` (#ef4444 light, #f87171 dark)
- Usage: Error messages, validation failures, destructive actions

#### Info
- `--pnx-info-50` through `--pnx-info-700`
- Main: `--pnx-info` (#3b82f6 light, #60a5fa dark)
- Usage: Informational messages, tips, neutral notifications

### Text Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--pnx-text-primary` | #1a202c | #f1f5f9 | Main body text |
| `--pnx-text-secondary` | #4a5568 | #cbd5e1 | Secondary text |
| `--pnx-text-muted` | #718096 | #94a3b8 | Muted/subtle text |
| `--pnx-text-inverse` | #ffffff | #0a0e1a | Inverse text |
| `--pnx-text-disabled` | #a0aec0 | #64748b | Disabled text |

### Surface Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--pnx-surface` | #ffffff | #0b0b0e | Main surface |
| `--pnx-surface-2` | #f8fafc | #0f1116 | Secondary surface |
| `--pnx-surface-elevated` | #ffffff | rgba(26, 31, 58, 0.9) | Elevated surfaces |
| `--pnx-surface-subtle` | rgba(255, 255, 255, 0.6) | rgba(15, 22, 41, 0.4) | Subtle overlay |

### Border Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--pnx-border` | #e2e8f0 | rgba(148, 163, 184, 0.2) | Default border |
| `--pnx-border-primary` | rgba(99, 102, 241, 0.1) | rgba(99, 102, 241, 0.2) | Primary border |
| `--pnx-border-subtle` | #f1f5f9 | rgba(148, 163, 184, 0.05) | Subtle divider |
| `--pnx-border-strong` | #cbd5e1 | rgba(148, 163, 184, 0.3) | Strong separator |

---

## Typography

### Typography Scale

We provide a comprehensive type scale with utility classes for common text styles.

#### Display Text

Large, impactful text for hero sections and major headings.

```html
<h1 className="text-display-xl">Display Extra Large</h1>
<!-- 72px / 4.5rem, bold, tight leading -->

<h1 className="text-display-lg">Display Large</h1>
<!-- 60px / 3.75rem, bold, tight leading -->
```

**CSS Variables:**
- `--pnx-text-7xl` (72px)
- `--pnx-text-6xl` (60px)

#### Headings

```html
<h1 className="text-h1">Heading 1</h1>
<!-- 48px / 3rem, bold -->

<h2 className="text-h2">Heading 2</h2>
<!-- 36px / 2.25rem, bold -->

<h3 className="text-h3">Heading 3</h3>
<!-- 30px / 1.875rem, semibold -->

<h4 className="text-h4">Heading 4</h4>
<!-- 24px / 1.5rem, semibold -->
```

#### Body Text

```html
<p className="text-body">Regular body text</p>
<!-- 16px / 1rem, normal weight -->

<p className="text-body-sm">Small body text</p>
<!-- 14px / 0.875rem, normal weight -->

<span className="text-caption">Caption text</span>
<!-- 12px / 0.75rem, muted color -->
```

### Font Families

```css
--pnx-font-sans: ui-sans-serif, system-ui, 'Segoe UI', ...
--pnx-font-mono: ui-monospace, 'SF Mono', Monaco, ...
```

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-font-normal` | 400 | Body text |
| `--pnx-font-medium` | 500 | Emphasized text |
| `--pnx-font-semibold` | 600 | Headings, buttons |
| `--pnx-font-bold` | 700 | Strong emphasis |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-leading-none` | 1 | Tight, single line |
| `--pnx-leading-tight` | 1.25 | Headlines |
| `--pnx-leading-snug` | 1.375 | Subheadings |
| `--pnx-leading-normal` | 1.5 | Body text |
| `--pnx-leading-relaxed` | 1.625 | Comfortable reading |
| `--pnx-leading-loose` | 2 | Spacious |

### Responsive Typography

Typography automatically scales down on mobile devices:

```css
@media (max-width: 768px) {
  .text-display-xl → 48px (from 72px)
  .text-display-lg → 36px (from 60px)
  .text-h1 → 36px (from 48px)
  .text-h2 → 30px (from 36px)
  .text-h3 → 24px (from 30px)
}
```

---

## Spacing

Our spacing scale is based on a 4px base unit for consistent rhythm throughout the UI.

### Spacing Scale

| Token | Value | Pixels |
|-------|-------|--------|
| `--pnx-space-0` | 0 | 0px |
| `--pnx-space-1` | 0.25rem | 4px |
| `--pnx-space-2` | 0.5rem | 8px |
| `--pnx-space-3` | 0.75rem | 12px |
| `--pnx-space-4` | 1rem | 16px |
| `--pnx-space-5` | 1.25rem | 20px |
| `--pnx-space-6` | 1.5rem | 24px |
| `--pnx-space-8` | 2rem | 32px |
| `--pnx-space-10` | 2.5rem | 40px |
| `--pnx-space-12` | 3rem | 48px |
| `--pnx-space-16` | 4rem | 64px |
| `--pnx-space-20` | 5rem | 80px |
| `--pnx-space-24` | 6rem | 96px |
| `--pnx-space-32` | 8rem | 128px |

### Usage Examples

```css
/* CSS Variables */
.component {
  padding: var(--pnx-space-4); /* 16px */
  margin-bottom: var(--pnx-space-6); /* 24px */
  gap: var(--pnx-space-2); /* 8px */
}

/* Tailwind Classes */
<div className="p-4 mb-6 gap-2">
  Content
</div>
```

---

## Border Radius

Consistent border radius values for visual harmony.

### Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-radius-none` | 0 | Sharp corners |
| `--pnx-radius-sm` | 0.25rem (4px) | Subtle rounding |
| `--pnx-radius` | 0.5rem (8px) | Default |
| `--pnx-radius-md` | 0.625rem (10px) | Medium rounding |
| `--pnx-radius-lg` | 0.75rem (12px) | Large elements |
| `--pnx-radius-xl` | 1rem (16px) | Cards |
| `--pnx-radius-2xl` | 1.5rem (24px) | Large cards |
| `--pnx-radius-full` | 9999px | Pills, circles |

### Component-Specific Radius

| Token | Value | Component |
|-------|-------|-----------|
| `--pnx-btn-radius` | 10px | Buttons |
| `--pnx-card-radius` | 12px | Cards |
| `--pnx-input-radius` | 10px | Input fields |
| `--pnx-badge-radius` | 9999px | Badges |

### Usage Examples

```css
/* CSS Variables */
.button {
  border-radius: var(--pnx-btn-radius);
}

.card {
  border-radius: var(--pnx-card-radius);
}

/* Tailwind Classes */
<button className="rounded-md">Button</button>
<div className="rounded-xl">Card</div>
```

---

## Shadows

A layered shadow system for depth and elevation.

### Shadow Scale

| Class | Token | Usage |
|-------|-------|-------|
| `.shadow-subtle` | `--pnx-shadow-subtle` | Very subtle, barely visible |
| `.shadow-xs` | `--pnx-shadow-xs` | Minimal depth |
| `.shadow-sm` | `--pnx-shadow-sm` | Slight elevation |
| `.shadow-md` | `--pnx-shadow-md` | Medium elevation (cards) |
| `.shadow-lg` | `--pnx-shadow-lg` | High elevation (modals) |
| `.shadow-xl` | `--pnx-shadow-xl` | Very high (dropdowns) |
| `.shadow-2xl` | `--pnx-shadow-2xl` | Maximum elevation |

### Usage Examples

```html
<!-- Utility Classes -->
<div className="shadow-subtle">Subtle shadow</div>
<div className="card shadow-md">Card with medium shadow</div>
<div className="shadow-lg">High elevation</div>

<!-- CSS Variables -->
<style>
  .my-component {
    box-shadow: var(--pnx-shadow-md);
  }
</style>
```

### Dark Mode Shadows

Shadows are automatically more prominent in dark mode for better contrast.

---

## Component Utilities

Pre-built utility classes for common UI patterns.

### Buttons

#### Primary Button

```html
<button className="btn-primary">
  Primary Action
</button>
```

**Features:**
- Sky blue background (`--pnx-primary`)
- White text
- Medium shadow
- Hover animation
- Focus ring

#### Secondary Button

```html
<button className="btn-secondary">
  Secondary Action
</button>
```

**Features:**
- Dark gray background (`--pnx-secondary`)
- Light text
- Medium shadow
- Hover animation

#### Ghost Button

```html
<button className="btn-ghost">
  Ghost Action
</button>
```

**Features:**
- Transparent background
- Subtle border
- Hover effect with accent color
- No shadow by default

### Input Fields

```html
<input type="text" className="input-field" placeholder="Enter text..." />
```

**Features:**
- Consistent height (42px)
- Border with transition
- Focus ring
- Hover effect
- Disabled state styling

### Cards

```html
<div className="card">
  <h3>Card Title</h3>
  <p>Card content goes here...</p>
</div>
```

**Features:**
- Glass-morphism effect
- Border and shadow
- Hover animation (lift)
- Backdrop blur
- Responsive padding

### Badges

#### Standard Badge

```html
<span className="badge">Default</span>
<span className="badge badge-primary">Primary</span>
<span className="badge badge-success">Success</span>
<span className="badge badge-warning">Warning</span>
<span className="badge badge-danger">Danger</span>
<span className="badge badge-info">Info</span>
```

#### Metric Badge

```html
<span className="badge-metric">
  <span>ROI:</span>
  <strong>12.5%</strong>
</span>
```

**Use for:** Displaying key metrics, KPIs, and statistics

### Pills

```html
<span className="pill">Tag</span>
<span className="pill">Category</span>
```

**Use for:** Tags, categories, filters

---

## Dark Mode

Our design system fully supports dark mode with automatic token switching.

### Activation

Dark mode is activated via the `dark` class on the root element:

```html
<html className="dark">
  <!-- Dark mode active -->
</html>
```

### Token Behavior

All design tokens automatically adapt to dark mode:

```css
/* Light Mode */
:root {
  --pnx-surface: #ffffff;
  --pnx-text-primary: #1a202c;
}

/* Dark Mode */
.dark {
  --pnx-surface: #0b0b0e;
  --pnx-text-primary: #f1f5f9;
}
```

### Dark Mode Best Practices

1. **Use Semantic Tokens**: Always use semantic tokens (`--pnx-surface`, `--pnx-text-primary`) instead of hardcoded colors
2. **Test Both Modes**: Always test your components in both light and dark modes
3. **Contrast**: Ensure adequate contrast in both modes (WCAG AA minimum)
4. **Images**: Provide dark mode alternatives for logos and branded images when necessary

---

## Best Practices

### 1. Token Naming

- Use semantic names over literal values
- Follow the `--pnx-` prefix convention
- Use descriptive suffixes (`-hover`, `-active`, `-disabled`)

### 2. Consistency

```css
/* ✅ Good - Uses design tokens */
.component {
  padding: var(--pnx-space-4);
  color: var(--pnx-text-primary);
  border-radius: var(--pnx-radius-md);
}

/* ❌ Bad - Magic numbers */
.component {
  padding: 17px;
  color: #333333;
  border-radius: 9px;
}
```

### 3. Utility Classes First

When possible, use utility classes before writing custom CSS:

```html
<!-- ✅ Good -->
<button className="btn-primary">Click me</button>

<!-- ❌ Less ideal -->
<button className="my-custom-button">Click me</button>
<style>
  .my-custom-button {
    /* Reimplementing btn-primary */
  }
</style>
```

### 4. Responsive Design

- Mobile-first approach
- Use provided responsive breakpoints
- Typography scales automatically

### 5. Accessibility

- All tokens support high contrast mode
- Focus rings are built into button utilities
- Color choices meet WCAG AA standards minimum
- Reduced motion preferences are respected

### 6. Performance

- Tokens use CSS custom properties (fast)
- Minimal specificity for easy overrides
- No JavaScript required for theme switching

---

## Z-Index Scale

Consistent layering system:

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-z-base` | 0 | Base layer |
| `--pnx-z-dropdown` | 1000 | Dropdowns |
| `--pnx-z-sticky` | 1020 | Sticky headers |
| `--pnx-z-fixed` | 1030 | Fixed elements |
| `--pnx-z-modal-backdrop` | 1040 | Modal backdrop |
| `--pnx-z-modal` | 1050 | Modals |
| `--pnx-z-popover` | 1060 | Popovers |
| `--pnx-z-tooltip` | 1070 | Tooltips |
| `--pnx-z-toast` | 9998 | Toast notifications |
| `--pnx-z-max` | 9999 | Absolute top |

---

## Transitions

Consistent animation timing:

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-transition-fast` | 150ms | Quick interactions |
| `--pnx-transition-base` | 200ms | Default |
| `--pnx-transition-slow` | 300ms | Smooth transitions |
| `--pnx-transition-slower` | 500ms | Emphasis |

### Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `--pnx-ease-in` | cubic-bezier(0.4, 0, 1, 1) | Acceleration |
| `--pnx-ease-out` | cubic-bezier(0, 0, 0.2, 1) | Deceleration |
| `--pnx-ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Both |

---

## Examples

### Building a Feature Card

```html
<div className="card">
  <div className="flex items-center gap-3 mb-4">
    <span className="badge badge-primary">New</span>
    <h3 className="text-h3">Feature Title</h3>
  </div>
  
  <p className="text-body mb-4">
    Description of the feature goes here with proper body text styling.
  </p>
  
  <div className="flex gap-2">
    <button className="btn-primary">Learn More</button>
    <button className="btn-ghost">Dismiss</button>
  </div>
</div>
```

### Creating a Form

```html
<form className="space-y-4">
  <div>
    <label className="text-body-sm font-medium mb-2 block">
      Email Address
    </label>
    <input 
      type="email" 
      className="input-field" 
      placeholder="you@example.com"
    />
  </div>
  
  <div>
    <label className="text-body-sm font-medium mb-2 block">
      Message
    </label>
    <textarea 
      className="input-field" 
      rows="4"
      placeholder="Your message..."
    ></textarea>
  </div>
  
  <button type="submit" className="btn-primary">
    Send Message
  </button>
</form>
```

### Metric Display

```html
<div className="flex gap-3">
  <span className="badge-metric">
    <span className="text-muted">ROI:</span>
    <strong className="text-success">+15.2%</strong>
  </span>
  
  <span className="badge-metric">
    <span className="text-muted">Yield:</span>
    <strong className="text-primary">8.5%</strong>
  </span>
  
  <span className="badge-metric">
    <span className="text-muted">Cash Flow:</span>
    <strong className="text-info">£2,400</strong>
  </span>
</div>
```

---

## Support

For questions or issues with the design system:

1. Check this documentation first
2. Review the source code in `/frontend/styles/design-tokens.css`
3. Consult the team or open a discussion

## Version History

- **v1.0.0** (Current) - Initial design token system with comprehensive utilities

---

**Last Updated:** 2025-11-09
