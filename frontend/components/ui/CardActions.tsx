'use client';

import * as React from 'react';
import Button from '@/components/ui/Button';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** How to align the row */
  align?: 'left' | 'right' | 'between';
  /** Preset buttons (optional). If provided, a button will render. */
  onSave?: () => void | Promise<void>;
  onPdf?: () => void | Promise<void>;
  onCrm?: () => void | Promise<void>;
  /** Button size for the preset actions */
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
};

/**
 * Consistent actions row used inside cards/sections.
 * - Renders optional preset actions (Save / Deal Pack / Export to CRM)
 * - Also works as a simple flex wrapper for custom children
 * - Handles wrapping on small screens and spacing between buttons
 */
export default function CardActions({
  align = 'left',
  size = 'md',
  className = '',
  onSave,
  onPdf,
  onCrm,
  children,
  ...rest
}: Props) {
  const justify =
    align === 'right' ? 'justify-end' : align === 'between' ? 'justify-between' : 'justify-start';

  const hasPresets = Boolean(onSave || onPdf || onCrm);

  return (
    <div
      className={`mt-2 flex flex-wrap ${justify} gap-2 sm:gap-3 items-center ${className}`}
      {...rest}
    >
      {hasPresets && (
        <>
          {onSave && (
            <Button
              variant="primary"
              size={size}
              onClick={onSave}
              aria-label="Save deal"
              title="Save deal"
            >
              <span className="mr-1">💾</span> Save Deal
            </Button>
          )}

          {onPdf && (
            <Button
              variant="secondary"
              size={size}
              onClick={onPdf}
              aria-label="Download deal pack"
              title="Download deal pack"
            >
              <span className="mr-1">🗂️</span> Deal Pack (v2)
            </Button>
          )}

          {onCrm && (
            <Button
              variant="ghost"
              size={size}
              onClick={onCrm}
              aria-label="Export to CRM"
              title="Export to CRM"
            >
              <span className="mr-1">🔗</span> Export to CRM
            </Button>
          )}
        </>
      )}

      {/* Any custom buttons/links passed in */}
      {children}
    </div>
  );
}
