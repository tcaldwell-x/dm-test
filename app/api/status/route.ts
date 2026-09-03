import { NextResponse } from "next/server";
import { applySessionCookie, getLiveSession } from "@/lib/auth";
import { getOAuthConfig } from "@/lib/oauth2";

export async function GET() {
  const config = getOAuthConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      signedIn: false,
      user: null,
      error: "Missing X_CLIENT_ID. Add OAuth 2.0 client credentials to the environment.",
    });
  }

  const { session, refreshed } = await getLiveSession();
  const response = NextResponse.json({
    configured: true,
    signedIn: Boolean(session),
    user: session?.user ?? null,
  });
  if (refreshed) applySessionCookie(response, session);
  if (!session) applySessionCookie(response, null);
  return response;
}
