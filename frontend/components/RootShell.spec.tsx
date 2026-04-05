import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

let mockPathname = '/';

jest.mock('next/navigation', () => {
  const actual = jest.requireActual<Record<string, unknown>>('next/navigation');
  return {
    ...actual,
    usePathname: () => mockPathname,
  };
});

jest.mock('@/components/ThemeProvider', () => ({
  ThemeProvider: function MockThemeProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
}));
jest.mock('@/components/EnvValidator', () => function MockEnvValidator() {
  return null;
});

jest.mock('@/components/Header', () => function MockHeader() {
  return <div>Site Header</div>;
});
jest.mock('@/components/Footer', () => function MockFooter() {
  return (
    <footer data-site-footer="true">
      <div>Product</div>
      <div>Company</div>
      <div>Legal</div>
    </footer>
  );
});
jest.mock('@/components/BackToTop', () => function MockBackToTop() {
  return <div>Back to top</div>;
});
jest.mock('@/components/ui/UiOverlaysClient', () => function MockUiOverlaysClient() {
  return <div>Overlay UI</div>;
});
jest.mock('sonner', () => ({
  Toaster: function MockToaster() {
    return <div>Toast UI</div>;
  },
}));

import RootShell from './RootShell';

describe('RootShell', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('keeps the standard site shell for normal routes', () => {
    const { container } = render(
      <RootShell>
        <div>Normal page content</div>
      </RootShell>,
    );

    expect(screen.getByText('Site Header')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(container.querySelector('[data-site-shell="default"]')).toBeTruthy();
  });

  it('uses a print-only shell for deal-pack routes', () => {
    mockPathname = '/property/prop-123/deal-pack';

    const { container } = render(
      <RootShell>
        <div>Deal pack body</div>
      </RootShell>,
    );

    expect(screen.getByText('Deal pack body')).toBeInTheDocument();
    expect(screen.queryByText('Site Header')).not.toBeInTheDocument();
    expect(screen.queryByText('Product')).not.toBeInTheDocument();
    expect(screen.queryByText('Company')).not.toBeInTheDocument();
    expect(screen.queryByText('Legal')).not.toBeInTheDocument();
    expect(container.querySelector('[data-print-only-shell="deal-pack"]')).toBeTruthy();
    expect(container.querySelector('[data-site-shell="default"]')).toBeFalsy();
  });
});
