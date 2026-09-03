import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dm_session";
export const OAUTH_COOKIE = "dm_oauth";

export type SessionUser = {
  id: string;
  screenName: string;
  name: string;
  avatar?: string;
};

export type Session = {
  token: string;
  tokenSecret: string;
  user: SessionUser;
};

export type OAuthPending = {
  token: string;
  tokenSecret: string;
};

function secretKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.X_API_SECRET ||
    process.env.TWITTER_API_SECRET ||
    process.env.X_API_KEY;
  if (!secret) {
    throw new Error("Set SESSION_SECRET or X_API_SECRET to encrypt login cookies.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptJson<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const session = decryptJson<Session>(value);
  if (!session?.token || !session.tokenSecret || !session.user?.id) return null;
  return session;
}

export async function readOAuthPending(): Promise<OAuthPending | null> {
  const store = await cookies();
  const value = store.get(OAUTH_COOKIE)?.value;
  if (!value) return null;
  return decryptJson<OAuthPending>(value);
}
