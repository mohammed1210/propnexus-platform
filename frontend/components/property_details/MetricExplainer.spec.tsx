import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MetricExplainer from './MetricExplainer';

describe('MetricExplainer', () => {
  it('opens on click and explains gross yield with formula and property example', async () => {
    render(<MetricExplainer metric="gross_yield" property={{ price: 240000, rent_monthly: 1200 }} />);

    fireEvent.click(screen.getByRole('button', { name: /explain gross yield/i }));

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/Monthly rent × 12 ÷ asking price × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/£1,200 × 12 ÷ £240,000 = 6.0%/i)).toBeInTheDocument();
  });

  it('warns investors that ROI proxy is not verified profit', async () => {
    render(<MetricExplainer metric="roi_proxy" />);

    fireEvent.click(screen.getByRole('button', { name: /explain roi proxy/i }));

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/Estimated annual return ÷ estimated cash invested × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/This is not verified profit/i)).toBeInTheDocument();
  });

  it('closes when Escape is pressed', async () => {
    render(<MetricExplainer metric="gross_yield" />);

    fireEvent.click(screen.getByRole('button', { name: /explain gross yield/i }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('renders the tooltip through a portal without changing wrapper layout', async () => {
    const { container } = render(<MetricExplainer metric="gross_yield" />);

    fireEvent.click(screen.getByRole('button', { name: /explain gross yield/i }));
    const tooltip = await screen.findByRole('tooltip');

    expect(document.body).toContainElement(tooltip);
    expect(container).not.toContainElement(tooltip);
    expect(tooltip).toHaveClass('fixed');
  });
});
