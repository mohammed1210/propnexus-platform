import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import InfoDisclaimer from './InfoDisclaimer';

describe('InfoDisclaimer', () => {
  it('renders accessible label and copy', () => {
    render(<InfoDisclaimer label="AI disclaimer">Scores are indicative only.</InfoDisclaimer>);

    expect(screen.getByLabelText('AI disclaimer')).toBeInTheDocument();
    expect(screen.getByText('Scores are indicative only.')).toBeInTheDocument();
  });
});
