import { render, screen } from '@testing-library/react';
import SuccessPage from '@/app/success/page';

describe('/success page', () => {
  it('renders a safe checkout-complete state with a session id', async () => {
    render(await SuccessPage({ searchParams: Promise.resolve({ session_id: 'cs_test_123' }) }));

    expect(screen.getByRole('heading', { name: /checkout complete/i })).toBeInTheDocument();
    expect(screen.getByText(/your subscription is being activated/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to account/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: /analyse a deal/i })).toHaveAttribute('href', '/analyse');
    expect(screen.getByRole('link', { name: /view pricing/i })).toHaveAttribute('href', '/pricing');
  });

  it('renders safely without a session id', async () => {
    render(await SuccessPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: /checkout complete/i })).toBeInTheDocument();
    expect(screen.getByText(/no checkout reference was included/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to account/i })).toHaveAttribute('href', '/account');
  });
});
