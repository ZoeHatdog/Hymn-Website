import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const sessionCookieName = "hymn_session";
export const oauthStateCookieName = "hymn_oauth_state";

const sessionSeconds = 60 * 60 * 24 * 14;
const stateSeconds = 60 * 10;

export type DeskSession = {
  email: string;
  name: string;
  exp: number;
};

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 16) {
    throw new Error("AUTH_SECRET must be at least 16 characters.");
  }
  return secret;
}

export function signSession(input: { email: string; name: string }, now = Date.now()): string {
  const payload: DeskSession = {
    email: input.email,
    name: input.name,
    exp: now + sessionSeconds * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token: string | undefined, now = Date.now()): DeskSession | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", authSecret()).update(body).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DeskSession;
    if (!payload.email || !payload.name || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readRequestSession(req: Request): DeskSession | null {
  return readSession(readCookie(req.headers.cookie, sessionCookieName));
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function newOauthState(): string {
  return randomBytes(24).toString("base64url");
}

export function sessionSetCookie(token: string): string {
  return `${sessionCookieName}=${encodeURIComponent(token)}; ${cookieFlags(sessionSeconds)}`;
}

export function clearSessionCookie(): string {
  return `${sessionCookieName}=; ${cookieFlags(0)}`;
}

export function oauthStateSetCookie(state: string): string {
  return `${oauthStateCookieName}=${encodeURIComponent(state)}; ${cookieFlags(stateSeconds)}`;
}

export function clearOauthStateCookie(): string {
  return `${oauthStateCookieName}=; ${cookieFlags(0)}`;
}

export function setCookies(res: Response, cookies: string[]) {
  for (const cookie of cookies) {
    res.append("Set-Cookie", cookie);
  }
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cookieFlags(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
