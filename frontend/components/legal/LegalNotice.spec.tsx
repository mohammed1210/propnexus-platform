import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import LegalNotice from './LegalNotice';

describe('LegalNotice', () => {
  it('renders title and copy', () => {
    render(<LegalNotice title="Due diligence">Verify source data before making an offer.</LegalNotice>);

    expect(screen.getByText('Due diligence')).toBeInTheDocument();
    expect(screen.getByText('Verify source data before making an offer.')).toBeInTheDocument();
  });
});
