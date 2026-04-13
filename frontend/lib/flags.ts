// frontend/lib/flags.ts
export const flag = (name: string, fallback = false): boolean => {
  const val = process.env[name];
  if (val === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(val).toLowerCase());
};

const LAUNCH_FLAG_CONFIG = {
  AI_CHAT: { env: 'NEXT_PUBLIC_FEATURE_AI_CHATBOT', default: false },
  DEAL_SCORE: { env: 'NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE', default: false },
  AI_SCORE_BREAKDOWN: { env: 'NEXT_PUBLIC_FEATURE_AI_SCORE_BREAKDOWN', default: false },
  OFF_MARKET: { env: 'NEXT_PUBLIC_FEATURE_OFF_MARKET', default: false },
  DEAL_PACK: {
    env: 'NEXT_PUBLIC_FEATURE_DEAL_PACK',
    aliases: ['NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS'],
    default: false,
  },
  CRM_EXPORT: {
    env: 'NEXT_PUBLIC_FEATURE_CRM_EXPORT',
    aliases: ['NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS'],
    default: false,
  },
  TRADESMEN: { env: 'NEXT_PUBLIC_FEATURE_TRADESMEN', default: false },
  AREA_INTEL: { env: 'NEXT_PUBLIC_FEATURE_AREA_INTEL', default: true },
  COMPS: { env: 'NEXT_PUBLIC_FEATURE_COMPS', default: true },
} as const;

export type LaunchFlagName = keyof typeof LAUNCH_FLAG_CONFIG;

export const launchFlag = (name: LaunchFlagName): boolean => {
  const config = LAUNCH_FLAG_CONFIG[name];
  const names = [config.env, ...(config.aliases ?? [])];

  for (const envName of names) {
    const value = process.env[envName];
    if (value !== undefined) {
      return flag(envName, config.default);
    }
  }

  return config.default;
};

export const FF = Object.freeze({
  AI_CHAT: launchFlag('AI_CHAT'),
  DEAL_SCORE: launchFlag('DEAL_SCORE'),
  AI_SCORE_BREAKDOWN: launchFlag('AI_SCORE_BREAKDOWN'),
  OFF_MARKET: launchFlag('OFF_MARKET'),
  DEAL_PACK: launchFlag('DEAL_PACK'),
  CRM_EXPORT: launchFlag('CRM_EXPORT'),
  TRADESMEN: launchFlag('TRADESMEN'),
  AREA_INTEL: launchFlag('AREA_INTEL'),
  COMPS: launchFlag('COMPS'),
});
