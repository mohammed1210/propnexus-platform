// frontend/lib/flags.ts
export const flag = (name: string, fallback = false): boolean => {
  const val = process.env[name];
  if (val === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
};

export const FF = {
  AI_CHAT: flag("NEXT_PUBLIC_FEATURE_AI_CHATBOT", false),
  DEAL_SCORE: flag("NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE", false),
  OFF_MARKET: flag("NEXT_PUBLIC_FEATURE_OFF_MARKET", false),
  PROPERTY_EXPORTS: flag("NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS", false),
  TRADESMEN: flag("NEXT_PUBLIC_FEATURE_TRADESMEN", false),
  // Default-on: these panels are part of the core property details experience.
  AREA_INTEL: flag("NEXT_PUBLIC_FEATURE_AREA_INTEL", true),
  COMPS: flag("NEXT_PUBLIC_FEATURE_COMPS", true),
};
