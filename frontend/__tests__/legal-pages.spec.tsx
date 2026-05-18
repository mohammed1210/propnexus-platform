import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import DisclaimerPage from '@/app/(legal)/disclaimer/page';
import PrivacyPage from '@/app/(legal)/privacy/page';
import TermsPage from '@/app/(legal)/terms/page';
import Footer from '@/components/Footer';

describe('legal readiness surfaces', () => {
  it('renders Terms, Privacy and Disclaimer pages', () => {
    let view = render(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/does not provide financial advice/i)).toBeInTheDocument();
    view.unmount();

    view = render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/We do not sell your personal information/i)).toBeInTheDocument();
    view.unmount();

    render(<DisclaimerPage />);
    expect(screen.getByRole('heading', { name: 'Disclaimer' })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated content may be incomplete or inaccurate/i)).toBeInTheDocument();
  });

  it('footer has Terms, Privacy and Disclaimer links', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Disclaimer' })).toHaveAttribute('href', '/disclaimer');
  });

  it('launch audit script exists', () => {
    const script = path.join(process.cwd(), '..', 'scripts', 'launch_audit.sh');
    expect(fs.existsSync(script)).toBe(true);
  });
});
