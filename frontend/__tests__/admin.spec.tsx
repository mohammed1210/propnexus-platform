import { describe, it, expect, jest } from '@jest/globals';

// Mock the Supabase server module
jest.mock('@/lib/supabaseServer', () => ({
  supabaseServer: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          count: 3,
          error: null,
          data: [
            { price_id: 'price_pro', status: 'active' },
            { price_id: 'price_investor', status: 'active' },
            { price_id: 'price_pro', status: 'active' },
          ],
        })),
      })),
    })),
  })),
}));

describe('Admin Dashboard', () => {
  it('should export admin page component', async () => {
    // This test verifies the module can be imported
    // More detailed tests would require mocking the entire Next.js server component environment
    const AdminPage = await import('@/app/admin/page');
    expect(AdminPage).toBeDefined();
    expect(typeof AdminPage.default).toBe('function');
  });

  it('should have correct metadata', async () => {
    const AdminPage = await import('@/app/admin/page');
    expect(AdminPage.metadata).toBeDefined();
    expect(AdminPage.metadata.title).toBe('Admin • PropNexus');
  });
});
