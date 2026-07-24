import { fireEvent, render, screen } from '@testing-library/react';

import AnalysePage from '@/app/analyse/page';

const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

describe('/analyse page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams.delete('sourceUrl');
    mockSearchParams.delete('location');
  });

  it('renders the manual deal intake form and legal-safe copy', () => {
    render(<AnalysePage />);

    expect(screen.getByRole('heading', { name: /analyse any uk property deal before you offer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /deal details/i })).toBeInTheDocument();
    expect(screen.getByText(/speed up entry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/listing\/source url optional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/property title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address\/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate deal pack/i })).toBeInTheDocument();
    expect(screen.getByText(/does not scrape or copy third-party listing pages in this flow/i)).toBeInTheDocument();
    expect(screen.getAllByText(/listing urls are treated as user-provided references only/i).length).toBeGreaterThan(0);
  });

  it('prefills sourceUrl and postcode-like location query params', () => {
    mockSearchParams.set('sourceUrl', 'https://example.com/listing/123');
    mockSearchParams.set('location', 'LS1 4AB');

    render(<AnalysePage />);

    expect(screen.getByLabelText(/listing\/source url optional/i)).toHaveValue('https://example.com/listing/123');
    expect(screen.getByLabelText(/postcode/i)).toHaveValue('LS1 4AB');
    expect(screen.getByLabelText(/address\/location/i)).toHaveValue('');
  });

  it('prefills a location-like query into the location field', () => {
    mockSearchParams.set('location', 'Leeds city centre');

    render(<AnalysePage />);

    expect(screen.getByLabelText(/address\/location/i)).toHaveValue('Leeds city centre');
  });

  it('extracts blank fields from pasted text without overwriting typed fields', () => {
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText(/property title/i), { target: { value: 'Typed title' } });
    fireEvent.change(screen.getByLabelText(/quick import text optional/i), {
      target: {
        value: 'Fantastic 2 bedroom flat in Leeds LS1 4AB\nAsking price £250,000\nRent £1,400 pcm\n1 bathroom',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /extract details/i }));

    expect(screen.getByText(/details extracted\. please review before analysing\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/property title/i)).toHaveValue('Typed title');
    expect(screen.getByLabelText(/postcode/i)).toHaveValue('LS1 4AB');
    expect(screen.getByLabelText(/asking price/i)).toHaveValue('250000');
    expect(screen.getByLabelText(/estimated monthly rent/i)).toHaveValue('1400');
  });

  it('shows a fallback message when the pasted text yields little data', () => {
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText(/quick import text optional/i), {
      target: { value: 'hello there' },
    });
    fireEvent.click(screen.getByRole('button', { name: /extract details/i }));

    expect(screen.getByText(/we could not detect much from that text/i)).toBeInTheDocument();
  });
});
