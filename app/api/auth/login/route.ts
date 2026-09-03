import { NextResponse } from "next/server";
import { authorizeUrl, createPkce, getOAuthConfig, getRedirectUri } from "@/lib/oauth2";
import { OAUTH_COOKIE, cookieOptions, encryptJson } from "@/lib/session";

export async function GET(request: Request) {
  const config = getOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Missing X_CLIENT_ID. Add OAuth 2.0 client credentials to the environment." },
      { status: 500 },
    );
  }

  const pkce = createPkce();
  const url = authorizeUrl({
    clientId: config.clientId,
    redirectUri: getRedirectUri(request),
    state: pkce.state,
    challenge: pkce.challenge,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(
    OAUTH_COOKIE,
    encryptJson({ state: pkce.state, verifier: pkce.verifier }),
    cookieOptions(10 * 60),
  );
  return response;
}
