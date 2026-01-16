import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";

function parseDisableAuthFlag(v: unknown) {
  const raw = String(v ?? "");
  const parsed = raw === "1" || raw.toLowerCase() === "true";
  return { raw, parsed };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { raw: disableAuthRaw, parsed: disableAuthParsed } = parseDisableAuthFlag(
    process.env.NEXT_PUBLIC_DISABLE_AUTH
  );

  const isAuthEnabledClient = !disableAuthParsed;
  const isAuthEnabled =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !!process.env.CLERK_SECRET_KEY;

  let whoami: any = { userId: null, sessionId: null, email: null };

  try {
    const a = getAuth(req);
    whoami = {
      userId: a.userId ?? null,
      sessionId: a.sessionId ?? null,
      email: null,
    };
  } catch (e: any) {
    whoami = {
      userId: null,
      sessionId: null,
      email: null,
      error: e?.message || String(e),
    };
  }

  res.status(200).json({
    disableAuthRaw,
    disableAuthParsed,
    isAuthEnabled,
    isAuthEnabledClient,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    whoami,
  });
}
