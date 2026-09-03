import { NextResponse } from "next/server";
import { getOAuthConfig, revokeToken } from "@/lib/oauth2";
import { OAUTH_COOKIE, SESSION_COOKIE, cookieOptions, readSession } from "@/lib/session";

export async function POST() {
  const session = await readSession();
  const config = getOAuthConfig();
  if (session && config) {
    await revokeToken(session.accessToken, config.clientId, config.clientSecret);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
  return response;
}
