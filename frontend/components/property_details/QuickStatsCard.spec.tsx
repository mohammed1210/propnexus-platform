import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import QuickStatsCard from './QuickStatsCard';

describe('QuickStatsCard metric fallback behavior', () => {
  it('uses property Yield/ROI when override props are omitted', () => {
    render(
      <QuickStatsCard
        property={{
          title: 'Deal',
          price: 220000,
          yield_percent: 6.4,
          roi_percent: 9.1,
        }}
      />,
    );

    expect(screen.getByText('6.4%')).toBeInTheDocument();
    expect(screen.getByText('9.1%')).toBeInTheDocument();
  });
});
