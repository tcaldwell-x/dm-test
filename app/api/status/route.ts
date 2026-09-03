import { NextResponse } from "next/server";
import { getConsumer } from "@/lib/oauth1";
import { readSession } from "@/lib/session";

export async function GET() {
  const consumer = getConsumer();
  if (!consumer) {
    return NextResponse.json({
      configured: false,
      signedIn: false,
      user: null,
      error: "Missing X_API_KEY / X_API_SECRET. Add OAuth 1.0a consumer credentials.",
    });
  }

  const session = await readSession();
  return NextResponse.json({
    configured: true,
    signedIn: Boolean(session),
    user: session?.user ?? null,
  });
}
