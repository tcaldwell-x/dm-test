import { NextResponse } from "next/server";
import { applySessionCookie, requireAccessToken } from "@/lib/auth";
import { callXApi, type ProxyRequest } from "@/lib/x-client";

const ALLOWED_PATHS = [
  /^\/1\.1\/account\/verify_credentials\.json$/,
  /^\/1\.1\/users\/show\.json$/,
  /^\/1\.1\/users\/lookup\.json$/,
  /^\/1\.1\/direct_messages\/events\/new\.json$/,
  /^\/1\.1\/direct_messages\/events\/show\.json$/,
  /^\/1\.1\/direct_messages\/events\/list\.json$/,
  /^\/1\.1\/direct_messages\/events\/destroy\.json$/,
  /^\/1\.1\/direct_messages\/mark_read\.json$/,
  /^\/1\.1\/direct_messages\/indicate_typing\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/new\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/show\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/list\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/update\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/destroy\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/rules\/new\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/rules\/show\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/rules\/list\.json$/,
  /^\/1\.1\/direct_messages\/welcome_messages\/rules\/destroy\.json$/,
  /^\/1\.1\/custom_profiles\/new\.json$/,
  /^\/1\.1\/custom_profiles\/list\.json$/,
  /^\/1\.1\/custom_profiles\/destroy\.json$/,
  /^\/1\.1\/custom_profiles\/[^/]+\.json$/,
  /^\/1\.1\/feedback\/create\.json$/,
  /^\/1\.1\/feedback\/show\/[^/]+\.json$/,
  /^\/1\.1\/feedback\/events\.json$/,
  /^\/1\.1\/feedback\/submit\/[^/]+\.json$/,
  /^\/1\.1\/feedback\/dismiss\/[^/]+\.json$/,
  /^\/1\.1\/media\/upload\.json$/,
  /^\/2\/users\/me$/,
  /^\/2\/users\/by\/username\/[^/]+$/,
];

function isAllowed(path: string, host: string): boolean {
  if (host !== "api.twitter.com" && host !== "upload.twitter.com") return false;
  if (host === "upload.twitter.com") {
    return path === "/1.1/media/upload.json";
  }
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

export async function POST(request: Request) {
  const auth = await requireAccessToken();
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as ProxyRequest;
  const host = payload.host ?? "api.twitter.com";

  if (!payload.path || !payload.method) {
    return NextResponse.json({ error: "method and path are required" }, { status: 400 });
  }
  if (!isAllowed(payload.path, host)) {
    return NextResponse.json({ error: `Path not allowed: ${payload.path}` }, { status: 400 });
  }

  try {
    const result = await callXApi(payload, auth.token);
    const response = NextResponse.json(result);
    if (auth.refreshed) applySessionCookie(response, auth.session);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 },
    );
  }
}
