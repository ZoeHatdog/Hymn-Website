import { Router } from "express";
import { checkLoginCode, issueLoginCode } from "./includes/auth/codes.ts";
import { MailConfigError, sendLoginCode } from "./includes/auth/mail.ts";
import {
  clearOauthStateCookie,
  clearSessionCookie,
  newOauthState,
  oauthStateCookieName,
  oauthStateSetCookie,
  readCookie,
  readRequestSession,
  safeEqual,
  sessionSetCookie,
  setCookies,
  signSession,
} from "./includes/auth/session.ts";

const auth = Router();

const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserUrl = "https://openidconnect.googleapis.com/v1/userinfo";

auth.get("/session", (req, res) => {
  try {
    const session = readRequestSession(req);
    if (!session) {
      res.status(401).json({ success: false, error: "Sign in to open the desk." });
      return;
    }
    res.json({ success: true, data: publicSession(session.email, session.name) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Sign-in is not configured." });
  }
});

auth.post("/logout", (_req, res) => {
  setCookies(res, [clearSessionCookie()]);
  res.json({ success: true, data: {} });
});

auth.post("/code", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ success: false, error: "Enter the email address for the desk." });
    return;
  }
  if (!isAllowed(email)) {
    res.status(403).json({ success: false, error: "That email is not on the desk." });
    return;
  }

  try {
    const issued = issueLoginCode(email);
    if ("error" in issued) {
      res.status(429).json({ success: false, error: "A code was just sent. Wait a minute before asking again." });
      return;
    }
    await sendLoginCode(email, issued.code);
    res.json({ success: true, data: { email } });
  } catch (error) {
    if (error instanceof MailConfigError) {
      res.status(503).json({ success: false, error: "The desk cannot send mail yet. Add the Gmail settings to the env file." });
      return;
    }
    if (isAuthConfigError(error)) {
      res.status(500).json({ success: false, error: "Sign-in is not configured." });
      return;
    }
    console.error(error);
    res.status(502).json({ success: false, error: "The code could not be sent." });
  }
});

auth.post("/code/verify", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    res.status(400).json({ success: false, error: "Enter the email and the 6-digit code." });
    return;
  }
  if (!isAllowed(email)) {
    res.status(403).json({ success: false, error: "That email is not on the desk." });
    return;
  }

  try {
    const result = checkLoginCode(email, code);
    if (result === "expired") {
      res.status(401).json({ success: false, error: "That code has expired. Ask for a new one." });
      return;
    }
    if (result !== "ok") {
      res.status(401).json({ success: false, error: "That code does not match. Try again." });
      return;
    }

    const name = email.split("@")[0] || email;
    setCookies(res, [sessionSetCookie(signSession({ email, name }))]);
    res.json({ success: true, data: publicSession(email, name) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Sign-in is not configured." });
  }
});

auth.get("/google", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    res.redirect("/login?error=google_config");
    return;
  }

  const state = newOauthState();
  setCookies(res, [oauthStateSetCookie(state)]);

  const url = new URL(googleAuthUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  res.redirect(url.toString());
});

auth.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const saved = readCookie(req.headers.cookie, oauthStateCookieName) ?? "";
  setCookies(res, [clearOauthStateCookie()]);

  if (typeof req.query.error === "string") {
    res.redirect("/login?error=google_denied");
    return;
  }
  if (!code || !state || !saved || !safeEqual(state, saved)) {
    res.redirect("/login?error=google_failed");
    return;
  }

  try {
    const profile = await exchangeGoogleCode(code);
    if (!profile) {
      res.redirect("/login?error=google_email");
      return;
    }
    if (!profile.email_verified) {
      res.redirect("/login?error=google_unverified");
      return;
    }
    if (!isAllowed(profile.email)) {
      res.redirect("/login?error=google_not_allowed");
      return;
    }

    const name = profile.name || profile.email.split("@")[0] || profile.email;
    setCookies(res, [sessionSetCookie(signSession({ email: profile.email, name }))]);
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.redirect("/login?error=google_failed");
  }
});

export { auth };

function isAuthConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("AUTH_SECRET");
}

function publicSession(email: string, name: string) {
  return { email, name };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function isAllowed(email: string): boolean {
  const raw = process.env.AUTH_ALLOWED_EMAILS?.trim();
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return allowed.includes(email);
}

type GoogleProfile = {
  email: string;
  email_verified: boolean;
  name: string;
};

async function exchangeGoogleCode(code: string): Promise<GoogleProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured.");
  }

  const tokenResponse = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const profileResponse = await fetch(googleUserUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error(`Google profile request failed (${profileResponse.status}).`);
  }

  const profile = (await profileResponse.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const email = normalizeEmail(profile.email);
  if (!email) return null;
  return {
    email,
    email_verified: profile.email_verified === true,
    name: typeof profile.name === "string" ? profile.name.trim() : "",
  };
}
