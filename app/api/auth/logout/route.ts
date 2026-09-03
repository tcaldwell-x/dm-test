import { NextResponse } from "next/server";
import { OAUTH_COOKIE, SESSION_COOKIE, cookieOptions } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0));
  return response;
}
