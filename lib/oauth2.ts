import crypto from "node:crypto";
import type { Session, SessionUser } from "./session";

export const OAUTH_SCOPES = [
  "tweet.read",
  "users.read",
  "dm.read",
  "dm.write",
  "offline.access",
].join(" ");

export function getOAuthConfig() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId) return null;
  return { clientId, clientSecret };
}

export function getRedirectUri(request: Request): string {
  if (process.env.X_REDIRECT_URI) return process.env.X_REDIRECT_URI;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/api/auth/callback`;
}

export function createPkce(): { verifier: string; challenge: string; state: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function authorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

type TokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  scope?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function tokenHeaders(clientId: string, clientSecret?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }
  return headers;
}

async function postToken(body: URLSearchParams, clientId: string, clientSecret?: string) {
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: tokenHeaders(clientId, clientSecret),
    body,
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Token exchange failed");
  }
  return json;
}

export async function exchangeCode(input: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
}): Promise<Pick<Session, "accessToken" | "refreshToken" | "expiresAt">> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
    client_id: input.clientId,
  });
  const json = await postToken(body, input.clientId, input.clientSecret);
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
  };
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
}): Promise<Pick<Session, "accessToken" | "refreshToken" | "expiresAt">> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
  });
  const json = await postToken(body, input.clientId, input.clientSecret);
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token ?? input.refreshToken,
    expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
  };
}

export async function fetchAuthedUser(accessToken: string): Promise<SessionUser> {
  const response = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await response.json()) as {
    data?: { id?: string; name?: string; username?: string; profile_image_url?: string };
    detail?: string;
    title?: string;
  };
  if (!response.ok || !json.data?.id || !json.data.username) {
    throw new Error(json.detail || json.title || "Failed to load signed-in user");
  }
  return {
    id: json.data.id,
    screenName: json.data.username,
    name: json.data.name ?? json.data.username,
    avatar: json.data.profile_image_url,
  };
}

export async function revokeToken(token: string, clientId: string, clientSecret?: string) {
  const body = new URLSearchParams({
    token,
    token_type_hint: "access_token",
    client_id: clientId,
  });
  await fetch("https://api.x.com/2/oauth2/revoke", {
    method: "POST",
    headers: tokenHeaders(clientId, clientSecret),
    body,
  }).catch(() => undefined);
}
