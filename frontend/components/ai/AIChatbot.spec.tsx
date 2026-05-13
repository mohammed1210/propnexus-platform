/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIChatbot from '@/components/ai/AIChatbot';
import { postAIChat } from '@/lib/api';

jest.mock('@/lib/auth', () => ({
  isAuthEnabled: false,
}));

jest.mock('@/lib/flags', () => ({
  FF: { AI_CHAT: true },
}));

jest.mock('@/lib/api', () => ({
  postAIChat: jest.fn(),
}));

const postAIChatMock = postAIChat as jest.MockedFunction<typeof postAIChat>;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  Element.prototype.scrollIntoView = jest.fn();
  postAIChatMock.mockResolvedValue({
    ok: true,
    reply: 'This deal context is loaded.',
    usage: { prompt_tokens: 0, completion_tokens: 0 },
  });
});

describe('AIChatbot property context', () => {
  it('sends the currently viewed property details with chat messages', async () => {
    render(
      <AIChatbot
        property={{
          id: 'prop-123',
          title: 'Central Leeds two-bed flat',
          location: 'Leeds LS1',
          price: 240000,
          bedrooms: 2,
          bathrooms: 1,
          propertyType: 'Flat',
          investmentType: 'Buy-to-let',
          yield_percent: 6.4,
          roi_percent: 12.1,
          description: 'Close to station and business district.',
        } as any}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    expect(screen.getByText(/Central Leeds two-bed flat/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
      target: { value: 'Is this property worth viewing?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(postAIChatMock).toHaveBeenCalledTimes(1));
    const payload = postAIChatMock.mock.calls[0][0];

    expect(payload.context?.property_id).toBe('prop-123');
    expect(payload.context?.area_key).toBe('Leeds LS1');
    expect(payload.context?.summary).toContain('Central Leeds two-bed flat');
    expect(payload.context?.summary).toContain('Price: £240,000');
    expect(payload.context?.summary).toContain('Bedrooms: 2');
    expect(payload.context?.summary).toContain('Bathrooms: 1');
    expect(payload.context?.summary).toContain('Property type: Flat');
    expect(payload.context?.summary).toContain('Investment type: Buy-to-let');
  });

  it('keeps listings-page chat generic and focused on market research', async () => {
    render(<AIChatbot pageMode="listings" />);

    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    expect(screen.getByText(/property trends, area research, sales evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quick prompt: which areas look strongest/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
      target: { value: 'What area trends should I check?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(postAIChatMock).toHaveBeenCalledTimes(1));
    const payload = postAIChatMock.mock.calls[0][0];

    expect(payload.context?.property_id).toBeUndefined();
    expect(payload.context?.area_key).toBe('');
    expect(payload.context?.summary).toContain('Page: Listings search results.');
    expect(payload.context?.summary).toContain('No single property is selected.');
    expect(payload.context?.summary).toContain('property trends, area trends, comparable sales evidence');
  });
});
