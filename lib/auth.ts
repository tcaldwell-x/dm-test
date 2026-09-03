import { NextResponse } from "next/server";
import { getOAuthConfig, refreshAccessToken } from "./oauth2";
import {
  SESSION_COOKIE,
  cookieOptions,
  encryptJson,
  readSession,
  type Session,
} from "./session";

export async function getLiveSession(): Promise<{ session: Session | null; refreshed: boolean }> {
  const current = await readSession();
  if (!current) return { session: null, refreshed: false };

  const stillValid = current.expiresAt - 60_000 > Date.now();
  if (stillValid) return { session: current, refreshed: false };

  const config = getOAuthConfig();
  if (!current.refreshToken || !config) {
    return { session: null, refreshed: false };
  }

  try {
    const tokens = await refreshAccessToken({
      refreshToken: current.refreshToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    return {
      session: {
        ...current,
        ...tokens,
      },
      refreshed: true,
    };
  } catch {
    return { session: null, refreshed: false };
  }
}

export function applySessionCookie(response: NextResponse, session: Session | null) {
  if (!session) {
    response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
    return response;
  }
  response.cookies.set(SESSION_COOKIE, encryptJson(session), cookieOptions(60 * 60 * 24 * 30));
  return response;
}

export async function requireAccessToken(): Promise<
  { ok: true; token: string; session: Session; refreshed: boolean } | { ok: false; response: NextResponse }
> {
  const { session, refreshed } = await getLiveSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in with X first." }, { status: 401 }),
    };
  }
  return { ok: true, token: session.accessToken, session, refreshed };
}
