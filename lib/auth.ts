import { NextResponse } from "next/server";
import { getConsumer, type OAuthCredentials } from "./oauth1";
import {
  SESSION_COOKIE,
  cookieOptions,
  encryptJson,
  readSession,
  type Session,
} from "./session";

export function applySessionCookie(response: NextResponse, session: Session | null) {
  if (!session) {
    response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
    return response;
  }
  response.cookies.set(SESSION_COOKIE, encryptJson(session), cookieOptions(60 * 60 * 24 * 30));
  return response;
}

export async function requireUserAuth(): Promise<
  { ok: true; credentials: OAuthCredentials; session: Session } | { ok: false; response: NextResponse }
> {
  const consumer = getConsumer();
  const session = await readSession();
  if (!consumer) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing X_API_KEY / X_API_SECRET." },
        { status: 500 },
      ),
    };
  }
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in with X first." }, { status: 401 }),
    };
  }
  return {
    ok: true,
    session,
    credentials: {
      consumerKey: consumer.consumerKey,
      consumerSecret: consumer.consumerSecret,
      token: session.token,
      tokenSecret: session.tokenSecret,
    },
  };
}
