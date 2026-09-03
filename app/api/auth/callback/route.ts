import { NextResponse } from "next/server";
import { exchangeCode, fetchAuthedUser, getOAuthConfig, getRedirectUri } from "@/lib/oauth2";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  encryptJson,
  readOAuthPending,
} from "@/lib/session";

function homeUrl(request: Request, error?: string) {
  const redirect = getRedirectUri(request);
  const url = new URL("/", redirect);
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const denied = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pending = await readOAuthPending();
  const config = getOAuthConfig();

  const clearOauth = (response: NextResponse) => {
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
    return response;
  };

  if (denied) {
    return clearOauth(NextResponse.redirect(homeUrl(request, denied)));
  }
  if (!config || !code || !state || !pending || pending.state !== state) {
    return clearOauth(NextResponse.redirect(homeUrl(request, "invalid_oauth_state")));
  }

  try {
    const tokens = await exchangeCode({
      code,
      verifier: pending.verifier,
      redirectUri: getRedirectUri(request),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    const user = await fetchAuthedUser(tokens.accessToken);
    const response = NextResponse.redirect(homeUrl(request));
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
    response.cookies.set(
      SESSION_COOKIE,
      encryptJson({ ...tokens, user }),
      cookieOptions(60 * 60 * 24 * 30),
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return clearOauth(NextResponse.redirect(homeUrl(request, message)));
  }
}
