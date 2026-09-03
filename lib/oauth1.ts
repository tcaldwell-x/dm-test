import crypto from "node:crypto";
import type { SessionUser } from "./session";

export type OAuthCredentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

export function getConsumer(): { consumerKey: string; consumerSecret: string } | null {
  const consumerKey = process.env.X_API_KEY ?? process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.X_API_SECRET ?? process.env.TWITTER_API_SECRET;
  if (!consumerKey || !consumerSecret) return null;
  return { consumerKey, consumerSecret };
}

export function getRedirectUri(request: Request): string {
  if (process.env.X_REDIRECT_URI) return process.env.X_REDIRECT_URI;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/api/auth/callback`;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

export function signOAuth1(input: {
  method: string;
  url: string;
  credentials: OAuthCredentials;
  extraParams?: Record<string, string>;
}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: input.credentials.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  if (input.credentials.token) {
    oauth.oauth_token = input.credentials.token;
  }
  for (const [key, value] of Object.entries(input.extraParams ?? {})) {
    if (key.startsWith("oauth_")) oauth[key] = value;
  }

  const url = new URL(input.url);
  const params: Record<string, string> = { ...oauth, ...input.extraParams };
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  const baseUrl = `${url.origin}${url.pathname}`;
  const baseString = [
    input.method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(input.credentials.consumerSecret)}&${percentEncode(
    input.credentials.tokenSecret,
  )}`;
  oauth.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
    .join(", ")}`;
}

function parseForm(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const next: Record<string, string> = {};
  params.forEach((value, key) => {
    next[key] = value;
  });
  return next;
}

export async function fetchRequestToken(input: {
  consumerKey: string;
  consumerSecret: string;
  callback: string;
}): Promise<{ token: string; tokenSecret: string }> {
  const url = "https://api.x.com/oauth/request_token";
  const extraParams = { oauth_callback: input.callback };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: signOAuth1({
        method: "POST",
        url,
        credentials: {
          consumerKey: input.consumerKey,
          consumerSecret: input.consumerSecret,
          token: "",
          tokenSecret: "",
        },
        extraParams,
      }),
    },
  });
  const text = await response.text();
  const parsed = parseForm(text);
  if (!response.ok || !parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(text || "Failed to get request token");
  }
  return { token: parsed.oauth_token, tokenSecret: parsed.oauth_token_secret };
}

export function authorizeUrl(requestToken: string): string {
  return `https://api.x.com/oauth/authorize?oauth_token=${encodeURIComponent(requestToken)}`;
}

export async function fetchAccessToken(input: {
  consumerKey: string;
  consumerSecret: string;
  requestToken: string;
  requestTokenSecret: string;
  verifier: string;
}): Promise<{ token: string; tokenSecret: string; userId?: string; screenName?: string }> {
  const url = "https://api.x.com/oauth/access_token";
  const extraParams = { oauth_verifier: input.verifier };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: signOAuth1({
        method: "POST",
        url,
        credentials: {
          consumerKey: input.consumerKey,
          consumerSecret: input.consumerSecret,
          token: input.requestToken,
          tokenSecret: input.requestTokenSecret,
        },
        extraParams,
      }),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ oauth_verifier: input.verifier }).toString(),
  });
  const text = await response.text();
  const parsed = parseForm(text);
  if (!response.ok || !parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(text || "Failed to get access token");
  }
  return {
    token: parsed.oauth_token,
    tokenSecret: parsed.oauth_token_secret,
    userId: parsed.user_id,
    screenName: parsed.screen_name,
  };
}

export async function fetchAuthedUser(credentials: OAuthCredentials): Promise<SessionUser> {
  const url = "https://api.x.com/1.1/account/verify_credentials.json?skip_status=true&include_entities=false";
  const response = await fetch(url, {
    headers: {
      Authorization: signOAuth1({
        method: "GET",
        url,
        credentials,
      }),
    },
  });
  const json = (await response.json()) as {
    id_str?: string;
    screen_name?: string;
    name?: string;
    profile_image_url_https?: string;
    errors?: { message?: string }[];
  };
  if (!response.ok || !json.id_str || !json.screen_name) {
    throw new Error(json.errors?.[0]?.message || "Failed to load signed-in user");
  }
  return {
    id: json.id_str,
    screenName: json.screen_name,
    name: json.name ?? json.screen_name,
    avatar: json.profile_image_url_https,
  };
}
