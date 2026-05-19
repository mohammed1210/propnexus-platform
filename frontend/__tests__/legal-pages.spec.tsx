import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import DisclaimerPage from '@/app/(legal)/disclaimer/page';
import CookiesPage from '@/app/(legal)/cookies/page';
import PrivacyPage from '@/app/(legal)/privacy/page';
import TermsPage from '@/app/(legal)/terms/page';
import PricingPage from '@/app/pricing/page';
import Footer from '@/components/Footer';

describe('legal readiness surfaces', () => {
  it('renders Terms, Privacy, Disclaimer and Cookie Policy pages', () => {
    let view = render(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/does not provide financial advice/i)).toBeInTheDocument();
    view.unmount();

    view = render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/We do not sell your personal information/i)).toBeInTheDocument();
    view.unmount();

    view = render(<DisclaimerPage />);
    expect(screen.getByRole('heading', { name: 'Disclaimer' })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated content may be incomplete or inaccurate/i)).toBeInTheDocument();
    view.unmount();

    render(<CookiesPage />);
    expect(screen.getByRole('heading', { name: 'Cookie Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Essential cookies may be used for authentication/i)).toBeInTheDocument();
  });

  it('footer has Terms, Privacy, Disclaimer and Cookie Policy links', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Disclaimer' })).toHaveAttribute('href', '/disclaimer');
    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/cookies');
  });

  it('launch audit script exists', () => {
    const script = path.join(process.cwd(), '..', 'scripts', 'launch_audit.sh');
    expect(fs.existsSync(script)).toBe(true);
  });

  it('pricing page includes launch and investment outcome disclaimers', () => {
    render(<PricingPage />);

    expect(screen.getByText(/does not guarantee profitable deals/i)).toBeInTheDocument();
    expect(screen.getByText(/soft-launch beta/i)).toBeInTheDocument();
  });

  it('property detail page includes the investor brief disclaimer copy', () => {
    const pagePath = path.join(process.cwd(), 'app', 'property', '[id]', 'page.tsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('Investor brief and scores are indicative only');
  });
});
