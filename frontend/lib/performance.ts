/**
 * Performance Optimization Guidelines for PropNexus
 * 
 * This file documents performance best practices and optimization techniques
 * used throughout the application.
 */

/**
 * Image Optimization Guidelines
 */
export const IMAGE_OPTIMIZATION = {
  /**
   * Next.js Image Component
   * - Always use Next.js Image component for automatic optimization
   * - Specify appropriate sizes for responsive images
   * - Use lazy loading for below-the-fold images
   * - Set priority={true} only for above-the-fold hero images
   */
  NEXT_IMAGE: {
    example: `
      <Image
        src={imageUrl}
        alt="Descriptive alt text"
        width={800}
        height={600}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        loading="lazy"
        priority={false}
      />
    `,
    sizes: {
      mobile: '100vw',
      tablet: '50vw',
      desktop: '33vw',
    },
  },

  /**
   * Image Formats
   * - WebP: Primary format (smaller file size, good browser support)
   * - AVIF: Future format (even smaller, growing support)
   * - JPEG: Fallback for photos
   * - PNG: For images requiring transparency
   */
  FORMATS: {
    preferred: ['webp', 'avif'],
    fallback: ['jpeg', 'png'],
  },

  /**
   * Compression
   * - Use tools like ImageOptim, TinyPNG, or Squoosh
   * - Target quality: 75-85% for photos
   * - Progressive JPEG for better perceived performance
   */
  COMPRESSION: {
    quality: 80,
    progressive: true,
  },

  /**
   * Lazy Loading Strategy
   * - Property cards: lazy load (below fold)
   * - Hero images: priority load (above fold)
   * - Background images: use CSS with lazy loading
   */
  LAZY_LOADING: {
    propertyCards: 'loading="lazy"',
    heroImage: 'priority={true}',
    backgroundImages: 'Use intersection observer',
  },
};

/**
 * CSS Optimization
 */
export const CSS_OPTIMIZATION = {
  /**
   * Tailwind CSS Purging
   * - Ensure purge is enabled in production
   * - Configure content paths correctly
   * - Remove unused utility classes
   */
  TAILWIND: {
    purge: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
      './app/**/*.{js,ts,jsx,tsx}',
    ],
  },

  /**
   * CSS-in-JS Performance
   * - Extract critical CSS
   * - Use CSS modules for component-specific styles
   * - Avoid inline styles when possible
   */
  CRITICAL_CSS: 'Extract and inline above-the-fold CSS',

  /**
   * Animation Performance
   * - Use CSS transforms over position changes
   * - Use will-change sparingly
   * - Prefer opacity and transform for animations
   */
  ANIMATIONS: {
    performant: ['opacity', 'transform'],
    avoid: ['width', 'height', 'top', 'left', 'margin'],
  },
};

/**
 * JavaScript Optimization
 */
export const JS_OPTIMIZATION = {
  /**
   * Code Splitting
   * - Use dynamic imports for large components
   * - Lazy load routes
   * - Split vendor bundles
   */
  CODE_SPLITTING: {
    example: `
      const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
        loading: () => <Loading />,
        ssr: false,
      });
    `,
  },

  /**
   * Bundle Size
   * - Monitor bundle size with webpack-bundle-analyzer
   * - Tree shake unused imports
   * - Use lighter alternatives when possible
   */
  BUNDLE_SIZE: {
    target: {
      initial: '< 200 KB',
      total: '< 1 MB',
    },
  },

  /**
   * Performance Hooks
   * - useMemo for expensive computations
   * - useCallback for function references
   * - React.memo for component memoization
   */
  REACT_OPTIMIZATION: {
    useMemo: 'Expensive calculations',
    useCallback: 'Stable function references',
    memo: 'Prevent unnecessary re-renders',
  },
};

/**
 * Asset Loading
 */
export const ASSET_LOADING = {
  /**
   * Fonts
   * - Use font-display: swap
   * - Preload critical fonts
   * - Limit font variants
   */
  FONTS: {
    display: 'swap',
    preload: 'Critical fonts only',
    variants: 'Limit to 4-5 weights',
  },

  /**
   * Icons
   * - Use SVG sprites or icon fonts
   * - Lazy load icon libraries
   * - Use React Icons with tree shaking
   */
  ICONS: {
    format: 'SVG',
    loading: 'Tree-shaken imports',
  },

  /**
   * Third-party Scripts
   * - Load async/defer when possible
   * - Use Next.js Script component
   * - Self-host when feasible
   */
  SCRIPTS: {
    strategy: 'afterInteractive or lazyOnload',
    example: `
      <Script
        src="https://example.com/script.js"
        strategy="afterInteractive"
      />
    `,
  },
};

/**
 * Network Optimization
 */
export const NETWORK_OPTIMIZATION = {
  /**
   * Caching Strategy
   * - Use appropriate cache headers
   * - Implement service worker for offline support
   * - Use stale-while-revalidate pattern
   */
  CACHING: {
    static: 'Cache-Control: public, max-age=31536000, immutable',
    dynamic: 'Cache-Control: public, max-age=0, must-revalidate',
    api: 'Use SWR or React Query for caching',
  },

  /**
   * API Optimization
   * - Batch requests when possible
   * - Implement pagination
   * - Use GraphQL fragments to fetch only needed data
   * - Implement request deduplication
   */
  API: {
    batching: 'Combine multiple requests',
    pagination: 'Limit 20-50 items per page',
    deduplication: 'Prevent duplicate requests',
  },

  /**
   * CDN Usage
   * - Serve static assets from CDN
   * - Use edge caching for dynamic content
   * - Implement image CDN (Cloudinary, imgix)
   */
  CDN: {
    static: 'All images, CSS, JS',
    dynamic: 'API responses when applicable',
  },
};

/**
 * Rendering Optimization
 */
export const RENDERING_OPTIMIZATION = {
  /**
   * Next.js Rendering Strategies
   * - SSG: Static pages (homepage, pricing)
   * - ISR: Dynamic content with revalidation (listings)
   * - SSR: User-specific content (account, deals)
   * - CSR: Interactive components
   */
  STRATEGIES: {
    SSG: 'Static Generation - Best performance',
    ISR: 'Incremental Static Regeneration - Fresh content',
    SSR: 'Server-Side Rendering - Personalized',
    CSR: 'Client-Side Rendering - Interactive',
  },

  /**
   * Virtual Scrolling
   * - Use for long lists (1000+ items)
   * - Libraries: react-window, react-virtual
   */
  VIRTUAL_SCROLLING: {
    threshold: 1000,
    libraries: ['react-window', 'react-virtual'],
  },
};

/**
 * Database Optimization
 */
export const DATABASE_OPTIMIZATION = {
  /**
   * Query Optimization
   * - Add indexes on frequently queried columns
   * - Use pagination for large result sets
   * - Implement query caching
   * - Use connection pooling
   */
  QUERIES: {
    indexes: ['id', 'created_at', 'location', 'price'],
    pagination: 'LIMIT and OFFSET',
    caching: 'Redis or in-memory cache',
  },
};

/**
 * Monitoring and Metrics
 */
export const MONITORING = {
  /**
   * Core Web Vitals
   * - LCP (Largest Contentful Paint): < 2.5s
   * - FID (First Input Delay): < 100ms
   * - CLS (Cumulative Layout Shift): < 0.1
   */
  CORE_WEB_VITALS: {
    LCP: { target: 2.5, unit: 'seconds' },
    FID: { target: 100, unit: 'milliseconds' },
    CLS: { target: 0.1, unit: 'score' },
  },

  /**
   * Other Metrics
   * - Time to First Byte (TTFB): < 600ms
   * - First Contentful Paint (FCP): < 1.8s
   * - Time to Interactive (TTI): < 3.8s
   */
  METRICS: {
    TTFB: { target: 600, unit: 'milliseconds' },
    FCP: { target: 1.8, unit: 'seconds' },
    TTI: { target: 3.8, unit: 'seconds' },
  },

  /**
   * Tools
   * - Lighthouse: Overall performance audit
   * - WebPageTest: Detailed waterfall analysis
   * - Chrome DevTools: Performance profiling
   * - Vercel Analytics: Real user monitoring
   */
  TOOLS: [
    'Lighthouse',
    'WebPageTest',
    'Chrome DevTools',
    'Vercel Analytics',
    'web-vitals library',
  ],
};

/**
 * Performance Budget
 */
export const PERFORMANCE_BUDGET = {
  /**
   * Page Weight
   * - HTML: < 50 KB
   * - CSS: < 100 KB
   * - JavaScript: < 200 KB (initial)
   * - Images: < 500 KB (per page)
   * - Total: < 1 MB (initial load)
   */
  PAGE_WEIGHT: {
    html: 50,
    css: 100,
    js: 200,
    images: 500,
    total: 1000,
  },

  /**
   * Request Count
   * - Aim for < 50 requests on initial load
   * - Combine assets when possible
   * - Use HTTP/2 multiplexing
   */
  REQUESTS: {
    initial: 50,
    total: 100,
  },
};

/**
 * Performance Checklist
 */
export const PERFORMANCE_CHECKLIST = [
  'Images are optimized and lazy loaded',
  'CSS is minified and purged',
  'JavaScript is code-split and tree-shaken',
  'Fonts are optimized with font-display: swap',
  'Critical CSS is inlined',
  'Third-party scripts are loaded async',
  'API responses are cached',
  'Static assets are served from CDN',
  'Database queries are indexed',
  'Core Web Vitals meet targets',
  'Lighthouse score > 90',
  'Bundle size is within budget',
];

/**
 * Common Performance Issues
 */
export const COMMON_ISSUES = {
  LARGE_IMAGES: 'Unoptimized images slow down page load',
  RENDER_BLOCKING: 'CSS/JS blocking first paint',
  UNUSED_CODE: 'Large bundles with unused code',
  NO_CACHING: 'Repeated network requests',
  LAYOUT_SHIFT: 'Images without dimensions cause CLS',
  LONG_TASKS: 'Heavy JavaScript blocks main thread',
  MEMORY_LEAKS: 'Event listeners not cleaned up',
};
