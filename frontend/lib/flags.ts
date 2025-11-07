// frontend/lib/flags.ts
export const flag = (name: string, fallback = false): boolean => {
  const val = process.env[name];
  if (val === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
};

export const FF = {
  AI_CHAT: flag("NEXT_PUBLIC_FEATURE_AI_CHATBOT", false),
  DEAL_SCORE: flag("NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE", false),
  AREA_INTEL: flag("NEXT_PUBLIC_FEATURE_AREA_INTEL", false),
  COMPS: flag("NEXT_PUBLIC_FEATURE_COMPS", false),
};
