import { NextResponse } from "next/server";
import { getCredentials } from "@/lib/oauth";
import { callXApi } from "@/lib/x-client";

export async function GET() {
  const credentials = getCredentials();
  if (!credentials) {
    return NextResponse.json({
      configured: false,
      user: null,
      error: "Missing X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, or X_ACCESS_TOKEN_SECRET.",
    });
  }

  try {
    const result = await callXApi({
      method: "GET",
      path: "/1.1/account/verify_credentials.json",
      query: { skip_status: "true", include_entities: "false" },
    });

    if (!result.ok) {
      return NextResponse.json({
        configured: true,
        user: null,
        error: result.body,
        status: result.status,
      });
    }

    const user = result.body as {
      id_str?: string;
      screen_name?: string;
      name?: string;
      profile_image_url_https?: string;
    };

    return NextResponse.json({
      configured: true,
      user: {
        id: user.id_str,
        screenName: user.screen_name,
        name: user.name,
        avatar: user.profile_image_url_https,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        user: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
