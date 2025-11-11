/**
 * Accessibility Configuration & Guidelines
 * 
 * This file documents the accessibility standards and patterns used throughout PropNexus.
 * Follow these guidelines when creating or modifying UI components.
 */

export const A11Y_STANDARDS = {
  /**
   * WCAG 2.1 Level AA Compliance Requirements
   */
  WCAG_LEVEL: 'AA',
  
  /**
   * Color Contrast Ratios
   * - Normal text (< 18pt): 4.5:1 minimum
   * - Large text (>= 18pt or 14pt bold): 3:1 minimum
   * - UI components and graphics: 3:1 minimum
   */
  COLOR_CONTRAST: {
    NORMAL_TEXT: 4.5,
    LARGE_TEXT: 3,
    UI_COMPONENTS: 3,
  },

  /**
   * Focus Indicators
   * - Visible focus indicator with at least 2px outline
   * - High contrast against background
   * - Use focus-visible for keyboard-only focus
   */
  FOCUS: {
    OUTLINE_WIDTH: '2px',
    OUTLINE_OFFSET: '2px',
    RING_WIDTH: '2',
  },

  /**
   * Interactive Element Sizes
   * - Minimum touch target: 44x44px (mobile)
   * - Minimum click target: 24x24px (desktop)
   */
  TARGET_SIZE: {
    MOBILE_MIN: 44,
    DESKTOP_MIN: 24,
  },

  /**
   * Keyboard Navigation
   * - All interactive elements must be keyboard accessible
   * - Logical tab order (left to right, top to bottom)
   * - No keyboard traps
   * - Skip links for main content
   */
  KEYBOARD: {
    TAB: 'Navigate forward',
    SHIFT_TAB: 'Navigate backward',
    ENTER: 'Activate button/link',
    SPACE: 'Activate button/checkbox',
    ESCAPE: 'Close modal/dialog',
    ARROW_KEYS: 'Navigate within component (radio, select, etc.)',
  },
};

/**
 * ARIA Patterns and Best Practices
 */
export const ARIA_PATTERNS = {
  /**
   * Button
   * - Use semantic <button> element
   * - Add aria-label for icon-only buttons
   * - Use aria-pressed for toggle buttons
   * - Use aria-disabled instead of disabled when needed for screen readers
   */
  BUTTON: {
    iconOnly: '<button aria-label="Close dialog">×</button>',
    toggle: '<button aria-pressed="false">Mute</button>',
    loading: '<button aria-busy="true">Loading...</button>',
  },

  /**
   * Modal/Dialog
   * - role="dialog"
   * - aria-modal="true"
   * - aria-labelledby or aria-label
   * - Focus trap within dialog
   * - Return focus on close
   */
  MODAL: {
    pattern: `
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">Dialog Title</h2>
        <button aria-label="Close dialog">×</button>
        <!-- Content -->
      </div>
    `,
  },

  /**
   * Form Controls
   * - Always associate labels with inputs
   * - Use aria-describedby for help text
   * - Use aria-invalid and aria-errormessage for errors
   * - Use fieldset/legend for radio groups
   */
  FORM: {
    input: '<label for="email">Email</label><input id="email" type="email" />',
    withHelp: `
      <label for="password">Password</label>
      <input id="password" type="password" aria-describedby="pwd-help" />
      <span id="pwd-help">Must be at least 8 characters</span>
    `,
    withError: `
      <input id="username" aria-invalid="true" aria-errormessage="username-error" />
      <span id="username-error" role="alert">Username is required</span>
    `,
  },

  /**
   * Navigation
   * - Use <nav> with aria-label
   * - Use aria-current for active page
   * - Use aria-expanded for dropdowns
   */
  NAV: {
    primary: '<nav aria-label="Primary navigation">',
    link: '<a href="/page" aria-current="page">Current Page</a>',
    dropdown: '<button aria-expanded="false" aria-controls="menu">Menu</button>',
  },

  /**
   * Lists
   * - Use semantic list elements (ul, ol, dl)
   * - Don't override list-style: none without role="list" if needed
   */
  LIST: {
    unordered: '<ul role="list">',
    ordered: '<ol role="list">',
  },

  /**
   * Images
   * - Always include alt text
   * - Use empty alt="" for decorative images
   * - Use aria-hidden="true" for icon images with adjacent text
   */
  IMAGE: {
    meaningful: '<img src="..." alt="Description of image content" />',
    decorative: '<img src="..." alt="" aria-hidden="true" />',
    iconWithText: '<FiIcon aria-hidden="true" /> Save',
  },

  /**
   * Skip Links
   * - First element in document
   * - Links to main content
   * - Visible on focus
   */
  SKIP_LINK: `
    <a href="#main" class="sr-only focus:not-sr-only">
      Skip to main content
    </a>
  `,
};

/**
 * Screen Reader Only Utilities
 */
export const SR_ONLY_CLASSES = {
  tailwind: 'sr-only focus:not-sr-only',
  css: `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
    
    .sr-only:focus {
      position: static;
      width: auto;
      height: auto;
      padding: inherit;
      margin: inherit;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
  `,
};

/**
 * Testing Checklist
 */
export const TESTING_CHECKLIST = {
  KEYBOARD: [
    'Can navigate to all interactive elements using Tab',
    'Can activate all buttons and links with Enter/Space',
    'Can close modals with Escape',
    'Focus order is logical',
    'No keyboard traps',
    'Skip links work correctly',
  ],
  
  SCREEN_READER: [
    'All images have appropriate alt text',
    'Forms have associated labels',
    'Buttons have descriptive text or aria-label',
    'Landmarks are properly labeled',
    'Dynamic content changes are announced',
    'Error messages are announced',
  ],
  
  VISUAL: [
    'Sufficient color contrast (4.5:1 for text)',
    'Focus indicators are visible',
    'Content is readable at 200% zoom',
    'No content is conveyed by color alone',
    'Text can be resized without breaking layout',
  ],
  
  AUTOMATED: [
    'Run axe-core or similar tool',
    'Check with Lighthouse accessibility audit',
    'Validate HTML',
    'Test with multiple screen readers',
  ],
};

/**
 * Common Accessibility Issues to Avoid
 */
export const COMMON_ISSUES = {
  MISSING_ALT: 'Images without alt attributes',
  UNLABELED_INPUTS: 'Form inputs without associated labels',
  LOW_CONTRAST: 'Text with insufficient contrast ratio',
  KEYBOARD_TRAP: 'User cannot escape component with keyboard',
  MISSING_FOCUS: 'No visible focus indicator',
  ICON_ONLY_BUTTON: 'Icon button without aria-label',
  FAKE_BUTTON: 'div or span with onClick instead of button',
  AUTO_PLAY: 'Video/audio autoplays without user control',
  MISSING_LANG: 'HTML without lang attribute',
  SKIP_HEADING: 'Heading hierarchy is not sequential',
};

/**
 * Resources
 */
export const RESOURCES = {
  WCAG: 'https://www.w3.org/WAI/WCAG21/quickref/',
  ARIA_PRACTICES: 'https://www.w3.org/WAI/ARIA/apg/',
  AXE_CORE: 'https://www.deque.com/axe/',
  LIGHTHOUSE: 'https://developers.google.com/web/tools/lighthouse',
  A11Y_PROJECT: 'https://www.a11yproject.com/',
};
