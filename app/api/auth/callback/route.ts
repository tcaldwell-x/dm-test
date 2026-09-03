import { NextResponse } from "next/server";
import { fetchAccessToken, fetchAuthedUser, getConsumer, getRedirectUri } from "@/lib/oauth1";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  encryptJson,
  readOAuthPending,
} from "@/lib/session";

function homeUrl(request: Request, error?: string) {
  const url = new URL("/", getRedirectUri(request));
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const denied = url.searchParams.get("denied");
  const oauthToken = url.searchParams.get("oauth_token");
  const verifier = url.searchParams.get("oauth_verifier");
  const pending = await readOAuthPending();
  const consumer = getConsumer();

  const clearOauth = (response: NextResponse) => {
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
    return response;
  };

  if (denied) {
    return clearOauth(NextResponse.redirect(homeUrl(request, "access_denied")));
  }
  if (!consumer || !oauthToken || !verifier || !pending || pending.token !== oauthToken) {
    return clearOauth(NextResponse.redirect(homeUrl(request, "invalid_oauth_state")));
  }

  try {
    const access = await fetchAccessToken({
      consumerKey: consumer.consumerKey,
      consumerSecret: consumer.consumerSecret,
      requestToken: pending.token,
      requestTokenSecret: pending.tokenSecret,
      verifier,
    });
    const user = await fetchAuthedUser({
      consumerKey: consumer.consumerKey,
      consumerSecret: consumer.consumerSecret,
      token: access.token,
      tokenSecret: access.tokenSecret,
    });
    const response = NextResponse.redirect(homeUrl(request));
    response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
    response.cookies.set(
      SESSION_COOKIE,
      encryptJson({ token: access.token, tokenSecret: access.tokenSecret, user }),
      cookieOptions(60 * 60 * 24 * 30),
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return clearOauth(NextResponse.redirect(homeUrl(request, message)));
  }
}
