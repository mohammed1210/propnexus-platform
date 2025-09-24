// frontend/__tests__/investment-summary.spec.tsx
import { render, screen, waitFor } from '@testing-library/react'
import InvestmentSummary from '@/components/property_details/InvestmentSummary'

// Mock the whole api module with a writable function
jest.mock('@/lib/api', () => ({
  postAiSummary: jest.fn(),
}))

import { postAiSummary } from '@/lib/api'

describe('InvestmentSummary', () => {
  it('renders text summary without charts', async () => {
    (postAiSummary as jest.Mock).mockResolvedValue({
      summary: 'Test summary',
      bullets: ['One', 'Two'],
    })

    // Pass the minimal props your component expects
    render(
      <InvestmentSummary
        property={{
          title: 'Title',
          location: 'UB8',
          price: 300000,
        }}
      />
    )

    await waitFor(() => screen.getByTestId('investment-summary-text'))
    expect(screen.getByTestId('investment-summary-text').textContent).toMatch(/Test summary/)
    // sanity check: no charts
    expect(screen.queryByRole('img')).toBeNull()
    expect(document.querySelector('.chart')).toBeNull()
  })
})
