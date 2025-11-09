# PropNexus Styles Directory

This directory contains the styling infrastructure for the PropNexus platform.

## Files Overview

### Core Files

- **`design-tokens.css`** - 🎨 **Main design token system** (NEW - v1.0.0)
  - 640+ design tokens for colors, spacing, typography, shadows, and more
  - Full light/dark mode support
  - Utility classes for common UI patterns
  - **Primary reference for all styling decisions**
  - See `/frontend/DESIGN_TOKENS.md` for complete documentation

- **`globals.css`** - Global styles and CSS resets
  - Imports design-tokens.css
  - Form control baselines
  - Focus ring management
  - Accessibility utilities

- **`components.css`** - Legacy component utilities (Tailwind @layer)
  - Card utilities
  - Panel variants
  - Row/grid utilities
  - Being gradually migrated to use design tokens

- **`ux-tokens.css`** - Additional UX utilities
  - Calculator components
  - Gated content utilities
  - Print styles
  - Animation utilities

- **`theme.css`** - Theme-specific gradients and effects
  - AI-focused gradients
  - Floating orb animations
  - Page wrapper utilities

- **`homepage-hero.css`** - Homepage-specific hero section styles

## Usage Priority

When styling components, use in this order:

1. **Design Token Utilities** - Use `.btn-primary`, `.card`, `.badge`, etc.
2. **Tailwind + Design Tokens** - Use Tailwind classes that reference tokens (e.g., `bg-primary`, `text-h2`)
3. **CSS Variables** - Use `var(--pnx-*)` for custom styling
4. **Custom CSS** - Only when necessary, still using design tokens

## Example Usage

```tsx
// ✅ Best - Using utility classes
<button className="btn-primary">Click me</button>
<div className="card shadow-md">Content</div>

// ✅ Good - Tailwind + tokens
<div className="bg-primary text-white p-4 rounded-md">
  <h1 className="text-h1">Title</h1>
</div>

// ✅ Acceptable - CSS variables for custom styling
<div style={{ 
  padding: 'var(--pnx-space-4)',
  color: 'var(--pnx-text-primary)'
}}>
  Content
</div>

// ❌ Avoid - Magic numbers and hardcoded colors
<div style={{ padding: '17px', color: '#333' }}>
  Content
</div>
```

## Documentation

- **Complete Guide**: `/frontend/DESIGN_TOKENS.md`
- **Demo Page**: Visit `/design-tokens-demo` in development mode
- **Source**: `/frontend/styles/design-tokens.css`

## Design Token Categories

- **Colors**: Primary, secondary, semantic, text, surface, border
- **Spacing**: 0-32 scale (4px increments)
- **Typography**: Display, headings, body text with responsive behavior
- **Radius**: Component-specific border radius values
- **Shadows**: 8-level elevation system
- **Components**: Pre-built utilities for buttons, inputs, cards, badges
- **Z-Index**: Consistent layering scale
- **Transitions**: Standard timing and easing functions

## Dark Mode

All design tokens automatically switch in dark mode via the `.dark` class on the root element. No additional configuration needed.

```tsx
// Automatically adapts to dark mode
<div className="bg-surface text-primary border-border">
  Theme-aware content
</div>
```

## Contributing

When adding new styles:

1. Check if a design token exists for your use case
2. Use existing utilities when possible
3. If creating new utilities, add them to `design-tokens.css`
4. Document new patterns in `DESIGN_TOKENS.md`
5. Ensure dark mode compatibility
6. Test accessibility (contrast, focus states, reduced motion)

## Migration Notes

We're gradually migrating from ad-hoc styling to the design token system. Legacy files will be refactored over time to use the new system.

---

**Last Updated**: 2025-11-09
