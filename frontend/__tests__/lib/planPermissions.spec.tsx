// frontend/__tests__/lib/planPermissions.spec.ts
import { describe, it, expect } from '@jest/globals';
import { hasAccess, getPlanLabel, getPlanArticle, getUpgradeMessage } from '@/lib/planPermissions';
import type { UserPlan } from '@/lib/useUserPlan';

describe('planPermissions', () => {
  describe('hasAccess', () => {
    it('allows access when user plan meets or exceeds required plan', () => {
      // Free tier tests
      expect(hasAccess('free', 'free')).toBe(true);
      expect(hasAccess('free', 'pro')).toBe(false);
      expect(hasAccess('free', 'investor')).toBe(false);

      // Pro tier tests
      expect(hasAccess('pro', 'free')).toBe(true);
      expect(hasAccess('pro', 'pro')).toBe(true);
      expect(hasAccess('pro', 'investor')).toBe(false);

      // Investor tier tests
      expect(hasAccess('investor', 'free')).toBe(true);
      expect(hasAccess('investor', 'pro')).toBe(true);
      expect(hasAccess('investor', 'investor')).toBe(true);
    });

    it('handles edge cases gracefully', () => {
      // Same plan always has access
      const plans: UserPlan[] = ['free', 'pro', 'investor'];
      plans.forEach((plan) => {
        expect(hasAccess(plan, plan)).toBe(true);
      });
    });
  });

  describe('getPlanLabel', () => {
    it('returns launch-plan labels for the existing backend tiers', () => {
      expect(getPlanLabel('free')).toBe('Free');
      expect(getPlanLabel('pro')).toBe('Investor Starter');
      expect(getPlanLabel('investor')).toBe('Investor Pro');
    });
  });

  describe('getPlanArticle', () => {
    it('returns an article based on the public plan label', () => {
      expect(getPlanArticle('free')).toBe('a');
      expect(getPlanArticle('pro')).toBe('an');
      expect(getPlanArticle('investor')).toBe('an');
    });
  });

  describe('getUpgradeMessage', () => {
    it('generates launch-tier upgrade messages', () => {
      expect(getUpgradeMessage('free')).toBe('Upgrade to Free to unlock this feature.');
      expect(getUpgradeMessage('pro')).toBe('Upgrade to Investor Starter to unlock this feature.');
      expect(getUpgradeMessage('investor')).toBe('Upgrade to Investor Pro to unlock this feature.');
    });

    it('uses the launch plan label in the upgrade copy', () => {
      const proMessage = getUpgradeMessage('pro');
      expect(proMessage).toContain('Investor Starter');

      const investorMessage = getUpgradeMessage('investor');
      expect(investorMessage).toContain('Investor Pro');
    });
  });

  describe('plan hierarchy', () => {
    it('enforces correct plan hierarchy: investor > pro > free', () => {
      // Test upgrade paths
      expect(hasAccess('free', 'pro')).toBe(false); // Need to upgrade
      expect(hasAccess('pro', 'investor')).toBe(false); // Need to upgrade

      // Test downgrade tolerance (higher plans can access lower content)
      expect(hasAccess('pro', 'free')).toBe(true);
      expect(hasAccess('investor', 'pro')).toBe(true);
      expect(hasAccess('investor', 'free')).toBe(true);
    });
  });
});
