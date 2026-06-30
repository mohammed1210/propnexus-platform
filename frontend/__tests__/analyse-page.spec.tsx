import { render, screen } from '@testing-library/react';

import AnalysePage from '@/app/analyse/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('/analyse page', () => {
  it('renders the manual deal intake form and legal-safe copy', () => {
    render(<AnalysePage />);

    expect(screen.getByRole('heading', { name: /analyse any uk property deal before you offer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/listing\/source url optional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/property title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address\/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate deal pack/i })).toBeInTheDocument();
    expect(screen.getByText(/does not scrape or copy third-party listing pages in this flow/i)).toBeInTheDocument();
  });
});
