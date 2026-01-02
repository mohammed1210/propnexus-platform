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
    it('returns correctly capitalized plan labels', () => {
      expect(getPlanLabel('free')).toBe('Free');
      expect(getPlanLabel('pro')).toBe('Pro');
      expect(getPlanLabel('investor')).toBe('Investor');
    });
  });

  describe('getPlanArticle', () => {
    it('returns correct article for each plan', () => {
      expect(getPlanArticle('free')).toBe('a');
      expect(getPlanArticle('pro')).toBe('a');
      expect(getPlanArticle('investor')).toBe('an');
    });
  });

  describe('getUpgradeMessage', () => {
    it('generates correct upgrade messages', () => {
      expect(getUpgradeMessage('free')).toBe('This feature requires a Free plan.');
      expect(getUpgradeMessage('pro')).toBe('This feature requires a Pro plan.');
      expect(getUpgradeMessage('investor')).toBe('This feature requires an Investor plan.');
    });

    it('uses correct article based on plan', () => {
      const proMessage = getUpgradeMessage('pro');
      expect(proMessage).toContain('a Pro');

      const investorMessage = getUpgradeMessage('investor');
      expect(investorMessage).toContain('an Investor');
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
