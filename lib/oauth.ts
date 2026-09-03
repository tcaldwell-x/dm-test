import crypto from "node:crypto";

export type OAuthCredentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

export function getCredentials(): OAuthCredentials | null {
  const consumerKey = process.env.X_API_KEY ?? process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.X_API_SECRET ?? process.env.TWITTER_API_SECRET;
  const token = process.env.X_ACCESS_TOKEN ?? process.env.TWITTER_ACCESS_TOKEN;
  const tokenSecret =
    process.env.X_ACCESS_TOKEN_SECRET ?? process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    return null;
  }

  return { consumerKey, consumerSecret, token, tokenSecret };
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
    oauth_token: input.credentials.token,
    oauth_version: "1.0",
  };

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
