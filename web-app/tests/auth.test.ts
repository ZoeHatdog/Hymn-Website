import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { resetLoginCodes } from "../api/includes/auth/codes.ts";
import { readSession, signSession } from "../api/includes/auth/session.ts";

class MailConfigError extends Error {
  constructor() {
    super("Gmail is not configured.");
    this.name = "MailConfigError";
  }
}

const sendLoginCode = jest.fn(async (_email: string, _code: string) => undefined);

jest.unstable_mockModule("../api/includes/auth/mail.ts", () => ({
  MailConfigError,
  sendLoginCode,
}));

const { auth } = await import("../api/auth.ts");

function testApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", auth);
  return app;
}

beforeEach(() => {
  resetLoginCodes();
  sendLoginCode.mockReset();
  sendLoginCode.mockImplementation(async () => undefined);
  delete process.env.AUTH_ALLOWED_EMAILS;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function configureGoogle() {
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";
}

function mockGoogle(profile: Record<string, unknown>) {
  const original = globalThis.fetch;
  globalThis.fetch = jest.fn(async (url: string | URL) => {
    const target = String(url);
    if (target.includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    return new Response(JSON.stringify(profile), { status: 200 });
  }) as typeof fetch;
  return original;
}

function sessionFrom(cookies: string[] | undefined) {
  const session = (cookies ?? []).find((cookie) => cookie.startsWith("hymn_session=")) ?? "";
  const token = /hymn_session=([^;]+)/.exec(session)?.[1] ?? "";
  return decodeURIComponent(token);
}

describe("email code", () => {
  const app = testApp();

  it("sends a code and signs in with it", async () => {
    const sent = await request(app).post("/api/auth/code").send({ email: "Keeper@Example.com" });

    expect(sent.status).toBe(200);
    expect(sent.body.data.email).toBe("keeper@example.com");
    expect(sendLoginCode).toHaveBeenCalledTimes(1);
    const code = sendLoginCode.mock.calls[0]?.[1];
    expect(code).toMatch(/^\d{6}$/);

    const verified = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });

    expect(verified.status).toBe(200);
    expect(verified.body.data).toEqual({ email: "keeper@example.com", name: "keeper" });
    const cookie = verified.headers["set-cookie"]?.[0] ?? "";
    const token = /hymn_session=([^;]+)/.exec(cookie)?.[1];
    expect(readSession(decodeURIComponent(token ?? ""))?.email).toBe("keeper@example.com");

    const session = await request(app).get("/api/auth/session").set("Cookie", cookie.split(";")[0] ?? "");
    expect(session.status).toBe(200);
    expect(session.body.data.email).toBe("keeper@example.com");
  });

  it("rejects a code that does not match", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const verified = await request(app).post("/api/auth/code/verify").send({
      email: "keeper@example.com",
      code: "000000",
    });

    expect(verified.status).toBe(401);
    expect(verified.body.error).toBe("That code does not match. Try again.");
  });

  it("waits before sending another code", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const again = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });

    expect(again.status).toBe(429);
  });

  it("refuses an email that is not on the desk", async () => {
    process.env.AUTH_ALLOWED_EMAILS = "other@example.com";
    const response = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });

    expect(response.status).toBe(403);
    expect(sendLoginCode).not.toHaveBeenCalled();
  });

  it("reports when Gmail is not configured", async () => {
    sendLoginCode.mockImplementation(async () => {
      throw new MailConfigError();
    });
    const response = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("cannot send mail");
  });

  it("rejects an empty, missing, or malformed email", async () => {
    const bodies = [{}, { email: "" }, { email: "   " }, { email: "keeper" }, { email: "keeper@desk" }, { email: 1 }];

    for (const body of bodies) {
      const response = await request(app).post("/api/auth/code").send(body);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Enter the email address for the desk.");
    }
    expect(sendLoginCode).not.toHaveBeenCalled();
  });

  it("trims the code and still accepts it", async () => {
    await request(app).post("/api/auth/code").send({ email: "  Keeper@Example.com  " });
    const code = sendLoginCode.mock.calls[0]?.[1] ?? "";

    const verified = await request(app).post("/api/auth/code/verify").send({
      email: " keeper@example.com ",
      code: `  ${code}  `,
    });

    expect(verified.status).toBe(200);
    expect(verified.body.data.email).toBe("keeper@example.com");
  });

  it("rejects a code that is missing, short, long, or not digits", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const attempts = [{}, { code: "" }, { code: "12345" }, { code: "1234567" }, { code: "12ab56" }, { code: 123456 }];

    for (const extra of attempts) {
      const response = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", ...extra });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Enter the email and the 6-digit code.");
    }
  });

  it("rejects a code that was never requested", async () => {
    const response = await request(app).post("/api/auth/code/verify").send({
      email: "keeper@example.com",
      code: "123456",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("That code does not match. Try again.");
  });

  it("rejects a code sent to a different email", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const code = sendLoginCode.mock.calls[0]?.[1];

    const response = await request(app).post("/api/auth/code/verify").send({ email: "other@example.com", code });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("That code does not match. Try again.");
  });

  it("refuses to use the same code twice", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const code = sendLoginCode.mock.calls[0]?.[1];
    const first = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });
    const second = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    expect(second.body.error).toBe("That code does not match. Try again.");
  });

  it("drops the code after five wrong attempts", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const code = String(sendLoginCode.mock.calls[0]?.[1]);
    const wrong = code === "000000" ? "000001" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code: wrong });
      expect(response.status).toBe(401);
    }

    const burned = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });
    expect(burned.status).toBe(401);
    expect(burned.body.error).toBe("That code does not match. Try again.");
  });

  it("expires the code after ten minutes", async () => {
    const now = 1_700_000_000_000;
    const clock = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
      const code = sendLoginCode.mock.calls[0]?.[1];
      clock.mockReturnValue(now + 10 * 60 * 1000 + 1);

      const response = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("That code has expired. Ask for a new one.");
    } finally {
      clock.mockRestore();
    }
  });

  it("replaces the code once a minute has passed and retires the old one", async () => {
    const now = 1_700_000_000_000;
    const clock = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
      const firstCode = sendLoginCode.mock.calls[0]?.[1];
      clock.mockReturnValue(now + 60_000);

      const again = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
      const secondCode = sendLoginCode.mock.calls[1]?.[1];
      const stale = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code: firstCode });
      const current = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code: secondCode });

      expect(again.status).toBe(200);
      expect(stale.status).toBe(401);
      expect(current.status).toBe(200);
    } finally {
      clock.mockRestore();
    }
  });

  it("keeps the resend wait even when mail fails", async () => {
    sendLoginCode.mockImplementation(async () => {
      throw new Error("smtp down");
    });

    const failed = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const again = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });

    expect(failed.status).toBe(502);
    expect(failed.body.error).toBe("The code could not be sent.");
    expect(again.status).toBe(429);
  });

  it("allows an address on the list after trimming and lowercasing", async () => {
    process.env.AUTH_ALLOWED_EMAILS = " Other@Example.com , keeper@example.com ";
    const response = await request(app).post("/api/auth/code").send({ email: "Keeper@Example.com" });

    expect(response.status).toBe(200);
  });

  it("refuses to verify an email that is not on the desk", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const code = sendLoginCode.mock.calls[0]?.[1];
    process.env.AUTH_ALLOWED_EMAILS = "other@example.com";

    const response = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("That email is not on the desk.");
  });

  it("reports that sign-in is not configured when the secret is too short", async () => {
    const saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "too-short";
    try {
      const response = await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Sign-in is not configured.");
    } finally {
      process.env.AUTH_SECRET = saved;
    }
  });
});

describe("google oauth", () => {
  const app = testApp();

  it("sends the keeper to login when Google is not configured", async () => {
    const response = await request(app).get("/api/auth/google");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login?error=google_config");
  });

  it("signs in from the Google callback", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";
    const fetchMock = jest.fn(async (url: string | URL) => {
      const target = String(url);
      if (target.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ email: "Keeper@Example.com", email_verified: true, name: "Keeper" }),
        { status: 200 },
      );
    });
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const response = await request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "state-token" })
        .set("Cookie", "hymn_oauth_state=state-token");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/");
      const cookies = response.headers["set-cookie"] ?? [];
      const session = cookies.find((cookie) => cookie.startsWith("hymn_session=")) ?? "";
      const token = /hymn_session=([^;]+)/.exec(session)?.[1];
      expect(readSession(decodeURIComponent(token ?? ""))).toMatchObject({
        email: "keeper@example.com",
        name: "Keeper",
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a callback whose state does not match", async () => {
    configureGoogle();

    const response = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code", state: "other-state" })
      .set("Cookie", "hymn_oauth_state=state-token");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login?error=google_failed");
  });

  it("starts Google sign-in with a state cookie", async () => {
    configureGoogle();

    const response = await request(app).get("/api/auth/google");
    const location = new URL(response.headers.location ?? "");
    const stateCookie = (response.headers["set-cookie"] ?? []).find((cookie) => cookie.startsWith("hymn_oauth_state=")) ?? "";
    const state = /hymn_oauth_state=([^;]+)/.exec(stateCookie)?.[1];

    expect(response.status).toBe(302);
    expect(location.host).toBe("accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3001/api/auth/google/callback");
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("state")).toBe(decodeURIComponent(state ?? ""));
    expect(stateCookie).toContain("HttpOnly");
  });

  it("treats a blank client id as missing Google config", async () => {
    process.env.GOOGLE_CLIENT_ID = "   ";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";

    const response = await request(app).get("/api/auth/google");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login?error=google_config");
  });

  it("treats a denied Google prompt as cancelled", async () => {
    const response = await request(app)
      .get("/api/auth/google/callback")
      .query({ error: "access_denied", state: "state-token" })
      .set("Cookie", "hymn_oauth_state=state-token");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login?error=google_denied");
  });

  it("rejects a callback with no saved state", async () => {
    configureGoogle();

    const response = await request(app).get("/api/auth/google/callback").query({ code: "auth-code", state: "state-token" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login?error=google_failed");
  });

  it.each([
    ["no email", {}, "/login?error=google_email"],
    ["an unverified email", { email: "keeper@example.com", email_verified: false, name: "Keeper" }, "/login?error=google_unverified"],
  ])("rejects a Google profile with %s", async (_label, profile, location) => {
    configureGoogle();
    const original = mockGoogle(profile);

    try {
      const response = await request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "state-token" })
        .set("Cookie", "hymn_oauth_state=state-token");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(location);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a Google account that is not on the desk", async () => {
    configureGoogle();
    process.env.AUTH_ALLOWED_EMAILS = "other@example.com";
    const original = mockGoogle({ email: "keeper@example.com", email_verified: true, name: "Keeper" });

    try {
      const response = await request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "state-token" })
        .set("Cookie", "hymn_oauth_state=state-token");

      expect(response.headers.location).toBe("/login?error=google_not_allowed");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("uses the mailbox name when Google does not send a display name", async () => {
    configureGoogle();
    const original = mockGoogle({ email: "keeper@example.com", email_verified: true, name: "  " });

    try {
      const response = await request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "state-token" })
        .set("Cookie", "hymn_oauth_state=state-token");
      const session = sessionFrom(response.headers["set-cookie"]);

      expect(response.headers.location).toBe("/");
      expect(readSession(session)).toMatchObject({ email: "keeper@example.com", name: "keeper" });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns to login when Google refuses the code exchange", async () => {
    configureGoogle();
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => new Response("no", { status: 400 })) as typeof fetch;

    try {
      const response = await request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "state-token" })
        .set("Cookie", "hymn_oauth_state=state-token");

      expect(response.headers.location).toBe("/login?error=google_failed");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns to login when the client secret is missing", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";
    delete process.env.GOOGLE_CLIENT_SECRET;

    const response = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code", state: "state-token" })
      .set("Cookie", "hymn_oauth_state=state-token");

    expect(response.headers.location).toBe("/login?error=google_failed");
  });
});

describe("session", () => {
  const app = testApp();

  it("asks for sign-in when no cookie is present", async () => {
    const response = await request(app).get("/api/auth/session");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Sign in to open the desk.");
  });

  it("rejects a cookie whose signature was changed", async () => {
    const token = signSession({ email: "keeper@example.com", name: "Keeper" });
    const [body, signature] = token.split(".");
    const flipped = `${signature?.slice(0, -1)}${signature?.endsWith("a") ? "b" : "a"}`;

    const response = await request(app).get("/api/auth/session").set("Cookie", `hymn_session=${body}.${flipped}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Sign in to open the desk.");
  });

  it("rejects an expired session", async () => {
    const now = 1_700_000_000_000;
    const token = signSession({ email: "keeper@example.com", name: "Keeper" }, now);
    const clock = jest.spyOn(Date, "now").mockReturnValue(now + 14 * 24 * 60 * 60 * 1000);
    try {
      const response = await request(app).get("/api/auth/session").set("Cookie", `hymn_session=${token}`);
      expect(response.status).toBe(401);
    } finally {
      clock.mockRestore();
    }
  });

  it("sets an httpOnly session cookie", async () => {
    await request(app).post("/api/auth/code").send({ email: "keeper@example.com" });
    const code = sendLoginCode.mock.calls[0]?.[1];
    const verified = await request(app).post("/api/auth/code/verify").send({ email: "keeper@example.com", code });
    const cookie = verified.headers["set-cookie"]?.[0] ?? "";

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });
});

describe("logout", () => {
  const app = testApp();

  it("clears the session cookie", async () => {
    const response = await request(app).post("/api/auth/logout");
    const cookie = response.headers["set-cookie"]?.[0] ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("hymn_session=");
    expect(cookie).toContain("Max-Age=0");
  });
});
