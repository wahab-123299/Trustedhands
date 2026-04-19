export type Tier = 'bronze' | 'silver' | 'gold';

export interface TierLimits {
  maxJobValue: number;
  requiresId: boolean;
  escrowSplits: number[]; // Percentages per milestone
}

export const TIER_CONFIG: Record<Tier, TierLimits> = {
  bronze: {
    maxJobValue: 10000,
    requiresId: false,
    escrowSplits: [100], // 100% upfront
  },
  silver: {
    maxJobValue: 50000,
    requiresId: true,
    escrowSplits: [50, 50], // 50% upfront, 50% completion
  },
  gold: {
    maxJobValue: Infinity,
    requiresId: true,
    escrowSplits: [25, 25, 25, 25], // 4 milestones
  },
};

export function useTier(user: any) {
  const tier: Tier = user?.verificationTier || 'bronze';
  
  return {
    tier,
    config: TIER_CONFIG[tier],
    canPostJob: (amount: number) => amount <= TIER_CONFIG[tier].maxJobValue,
    needsUpgrade: (amount: number) => amount > TIER_CONFIG[tier].maxJobValue,
  };
}