import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import MetricExplainer from './MetricExplainer';

describe('MetricExplainer', () => {
  it('explains gross yield with formula and property example', () => {
    render(<MetricExplainer metric="gross_yield" property={{ price: 240000, rent_monthly: 1200 }} />);

    fireEvent.click(screen.getByRole('button', { name: /explain gross yield/i }));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/Monthly rent × 12 ÷ asking price × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/£1,200 × 12 ÷ £240,000 = 6.0%/i)).toBeInTheDocument();
  });

  it('warns investors that ROI proxy is not verified profit', () => {
    render(<MetricExplainer metric="roi_proxy" />);

    fireEvent.click(screen.getByRole('button', { name: /explain roi proxy/i }));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/Estimated annual return ÷ estimated cash invested × 100/i)).toBeInTheDocument();
    expect(screen.getByText(/This is not verified profit/i)).toBeInTheDocument();
  });
});
