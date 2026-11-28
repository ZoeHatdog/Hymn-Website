import { createHash, randomInt } from "node:crypto";
import { authSecret, safeEqual } from "./session.ts";

const lifetimeMs = 10 * 60 * 1000;
const resendMs = 60 * 1000;
const maxAttempts = 5;

type LoginCode = {
  hash: string;
  expires: number;
  attempts: number;
  sentAt: number;
};

const codes = new Map<string, LoginCode>();

export function issueLoginCode(email: string, now = Date.now()): { code: string } | { error: "wait" } {
  const current = codes.get(email);
  if (current && now - current.sentAt < resendMs) {
    return { error: "wait" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, {
    hash: hashCode(email, code),
    expires: now + lifetimeMs,
    attempts: 0,
    sentAt: now,
  });
  return { code };
}

export function checkLoginCode(email: string, code: string, now = Date.now()): "ok" | "invalid" | "expired" {
  const entry = codes.get(email);
  if (!entry) return "invalid";
  if (now > entry.expires) {
    codes.delete(email);
    return "expired";
  }

  entry.attempts += 1;
  const matches = safeEqual(entry.hash, hashCode(email, code));
  if (!matches) {
    if (entry.attempts >= maxAttempts) codes.delete(email);
    return "invalid";
  }

  codes.delete(email);
  return "ok";
}

export function resetLoginCodes() {
  codes.clear();
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${authSecret()}:${email}:${code}`).digest("base64url");
}
