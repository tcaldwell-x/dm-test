import { NextResponse } from "next/server";
import { authorizeUrl, fetchRequestToken, getConsumer, getRedirectUri } from "@/lib/oauth1";
import { OAUTH_COOKIE, cookieOptions, encryptJson } from "@/lib/session";

export async function GET(request: Request) {
  const consumer = getConsumer();
  if (!consumer) {
    return NextResponse.json(
      { error: "Missing X_API_KEY / X_API_SECRET. Add OAuth 1.0a consumer credentials." },
      { status: 500 },
    );
  }

  try {
    const requestToken = await fetchRequestToken({
      consumerKey: consumer.consumerKey,
      consumerSecret: consumer.consumerSecret,
      callback: getRedirectUri(request),
    });
    const response = NextResponse.redirect(authorizeUrl(requestToken.token));
    response.cookies.set(
      OAUTH_COOKIE,
      encryptJson({ token: requestToken.token, tokenSecret: requestToken.tokenSecret }),
      cookieOptions(10 * 60),
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start OAuth 1.0a login" },
      { status: 500 },
    );
  }
}
