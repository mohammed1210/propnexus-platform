import { fireEvent, render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('home page hero search', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('routes URL input to /analyse with sourceUrl query', () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/analyse a deal from a url, postcode, or location/i), {
      target: { value: 'https://example.com/listing/123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyse deal/i }));

    expect(mockPush).toHaveBeenCalledWith('/analyse?sourceUrl=https%3A%2F%2Fexample.com%2Flisting%2F123');
  });

  it('routes postcode or location input to /analyse with location query', () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/analyse a deal from a url, postcode, or location/i), {
      target: { value: 'Leeds LS1 4AB' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyse deal/i }));

    expect(mockPush).toHaveBeenCalledWith('/analyse?location=Leeds+LS1+4AB');
  });
});
