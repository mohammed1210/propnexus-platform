// Demo page to showcase design tokens
// This can be accessed at /design-tokens-demo during development

import React from 'react';

export default function DesignTokensDemo() {
  return (
    <div className="min-h-screen p-8 space-y-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-display-lg mb-4">Design Token System</h1>
        <p className="text-body text-secondary-600 dark:text-secondary-400 mb-8">
          Comprehensive design system for PropNexus platform
        </p>

        {/* Typography */}
        <section className="card space-y-4">
          <h2 className="text-h2">Typography Scale</h2>
          <div className="space-y-2">
            <p className="text-display-xl">Display XL - Hero Text</p>
            <p className="text-display-lg">Display Large - Section Hero</p>
            <p className="text-h1">Heading 1 - Main Page Title</p>
            <p className="text-h2">Heading 2 - Section Title</p>
            <p className="text-h3">Heading 3 - Subsection</p>
            <p className="text-h4">Heading 4 - Card Title</p>
            <p className="text-body">Body - Regular paragraph text for content</p>
            <p className="text-body-sm">Body Small - Secondary information</p>
            <p className="text-caption">Caption - Tiny helper text or metadata</p>
          </div>
        </section>

        {/* Buttons */}
        <section className="card space-y-4">
          <h2 className="text-h2">Button Variants</h2>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary">Primary Button</button>
            <button className="btn-secondary">Secondary Button</button>
            <button className="btn-ghost">Ghost Button</button>
          </div>
        </section>

        {/* Input Fields */}
        <section className="card space-y-4">
          <h2 className="text-h2">Input Fields</h2>
          <div className="space-y-3 max-w-md">
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter your email..."
            />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Disabled input" 
              disabled
            />
          </div>
        </section>

        {/* Badges */}
        <section className="card space-y-4">
          <h2 className="text-h2">Badges & Pills</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge">Default</span>
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-success">Success</span>
              <span className="badge badge-warning">Warning</span>
              <span className="badge badge-danger">Danger</span>
              <span className="badge badge-info">Info</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="pill">Tag</span>
              <span className="pill">Category</span>
              <span className="pill">Filter</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-metric">
                <span className="text-muted">ROI:</span>
                <strong className="text-success-600">+12.5%</strong>
              </span>
              <span className="badge-metric">
                <span className="text-muted">Yield:</span>
                <strong className="text-primary-600">8.5%</strong>
              </span>
              <span className="badge-metric">
                <span className="text-muted">Cash Flow:</span>
                <strong className="text-info-600">£2,400</strong>
              </span>
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section className="card space-y-4">
          <h2 className="text-h2">Shadow System</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="shadow-subtle p-4 bg-white dark:bg-secondary-800 rounded-lg text-center">
              <p className="text-body-sm font-semibold">Subtle</p>
            </div>
            <div className="shadow-sm p-4 bg-white dark:bg-secondary-800 rounded-lg text-center">
              <p className="text-body-sm font-semibold">Small</p>
            </div>
            <div className="shadow-md p-4 bg-white dark:bg-secondary-800 rounded-lg text-center">
              <p className="text-body-sm font-semibold">Medium</p>
            </div>
            <div className="shadow-lg p-4 bg-white dark:bg-secondary-800 rounded-lg text-center">
              <p className="text-body-sm font-semibold">Large</p>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="card space-y-4">
          <h2 className="text-h2">Color Palette</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-h4 mb-2">Primary</h3>
              <div className="flex gap-2">
                <div className="w-16 h-16 bg-primary-100 rounded"></div>
                <div className="w-16 h-16 bg-primary-300 rounded"></div>
                <div className="w-16 h-16 bg-primary-500 rounded"></div>
                <div className="w-16 h-16 bg-primary-700 rounded"></div>
                <div className="w-16 h-16 bg-primary-900 rounded"></div>
              </div>
            </div>
            
            <div>
              <h3 className="text-h4 mb-2">Semantic Colors</h3>
              <div className="flex gap-2">
                <div className="w-16 h-16 bg-success-500 rounded"></div>
                <div className="w-16 h-16 bg-warning-500 rounded"></div>
                <div className="w-16 h-16 bg-error-500 rounded"></div>
                <div className="w-16 h-16 bg-info-500 rounded"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Card Example */}
        <section className="space-y-4">
          <h2 className="text-h2">Card Examples</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-h3 mb-2">Property Insight</h3>
              <p className="text-body mb-4">
                This property shows strong investment potential with excellent location and growth prospects.
              </p>
              <div className="flex gap-2">
                <button className="btn-primary">View Details</button>
                <button className="btn-ghost">Save</button>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-h3">Market Analysis</h3>
                <span className="badge badge-success">Active</span>
              </div>
              <p className="text-body-sm text-secondary-600 dark:text-secondary-400 mb-4">
                Real-time market data and trends for informed decision making.
              </p>
              <div className="flex gap-3">
                <span className="badge-metric">
                  <span className="text-muted">Growth:</span>
                  <strong className="text-success-600">+8%</strong>
                </span>
                <span className="badge-metric">
                  <span className="text-muted">Demand:</span>
                  <strong className="text-info-600">High</strong>
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
