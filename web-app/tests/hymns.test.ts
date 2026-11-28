import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import type { Router } from "express";
import { signSession } from "../api/includes/auth/session.ts";
import { isWebp } from "../api/includes/bucket.ts";

type Row = Record<string, unknown> & { id: string };

const store = new Map<string, Row>();
const getAll = jest.fn(async () => [...store.values()]);
const getOne = jest.fn(async (_model: unknown, _params: unknown, criteria: { id: string }) => {
  const found = store.get(criteria.id);
  return found ? [found] : [];
});
const insert = jest.fn(async (_model: unknown, values: Record<string, unknown>) => {
  const id = "created-id";
  store.set(id, hymn(id, { ...values, imagePaths: [] }));
  return [{ id }];
});
const update = jest.fn(async (_model: unknown, values: Record<string, unknown>, criteria: { id: string }) => {
  const current = store.get(criteria.id);
  if (!current) return [];
  store.set(criteria.id, hymn(criteria.id, { ...current, ...values, updated: new Date("2024-01-01T00:00:00.000Z") }));
  return [{ id: criteria.id }];
});
const remove = jest.fn(async (_model: unknown, criteria: { id: string }) => {
  store.delete(criteria.id);
  return { rows: [] };
});
const putImage = jest.fn(async (_key: string, _body: Buffer) => undefined);

jest.unstable_mockModule("../api/includes/good_cursor.ts", () => ({
  goodCursor: {
    getAll,
    getOne,
    insert,
    update,
    delete: remove,
    buildNestedQuery: (sql: string) => ({ type: "sql", value: sql }),
  },
}));

jest.unstable_mockModule("../api/includes/bucket.ts", () => ({
  isWebp: (body: Buffer) =>
    body.length > 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP",
  putImage,
  resolveImageUrl: async (value: string) => `https://signed.test/${encodeURIComponent(value)}`,
}));

const { hymns } = await import("../api/hymns.ts");

const draft = {
  title: "Amazing Grace",
  author: "John Newton",
  lyrics: "Amazing grace, how sweet the sound",
  library: "TBC",
  link: "https://example.test/grace",
  tags: ["grace"],
};

const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");

function hymn(id: string, extra: Record<string, unknown> = {}): Row {
  return {
    id,
    title: "Amazing Grace",
    author: "John Newton",
    lyrics: "Amazing grace, how sweet the sound",
    imagePaths: ["TBC/grace.webp"],
    tags: ["grace"],
    library: "TBC",
    link: null,
    created: new Date("2020-01-01T00:00:00.000Z"),
    updated: new Date("2020-01-02T00:00:00.000Z"),
    ...extra,
  };
}

function keeperCookie() {
  return `hymn_session=${signSession({ email: "keeper@example.com", name: "Keeper" })}`;
}

function testApp(router: Router) {
  const app = express();
  app.use(express.json());
  app.use("/api/hymns", router);
  return app;
}

beforeEach(() => {
  store.clear();
  store.set("hymn1", hymn("hymn1"));
  putImage.mockClear();
});

describe("webp", () => {
  it("accepts a webp file and rejects other bytes", () => {
    expect(isWebp(webp)).toBe(true);
    expect(isWebp(Buffer.from("not a webp"))).toBe(false);
  });
});

describe("hymn CRUD", () => {
  const app = testApp(hymns);

  it("lists hymns", async () => {
    const response = await request(app).get("/api/hymns");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([{ id: "hymn1", title: "Amazing Grace", author: "John Newton" }]);
  });

  it("reads one hymn", async () => {
    const response = await request(app).get("/api/hymns/hymn1");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "hymn1",
      title: "Amazing Grace",
      library: "TBC",
      imageUrls: ["https://signed.test/TBC%2Fgrace.webp"],
    });
  });

  it("returns 404 when the hymn is missing", async () => {
    const response = await request(app).get("/api/hymns/missing");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("That hymn is not in the library.");
  });

  it("refuses to create a hymn without a session", async () => {
    const response = await request(app).post("/api/hymns").send(draft);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Sign in to change the library.");
    expect(store.has("created-id")).toBe(false);
  });

  it("creates a hymn", async () => {
    const response = await request(app).post("/api/hymns").set("Cookie", keeperCookie()).send(draft);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ id: "created-id", title: "Amazing Grace", library: "TBC" });
    expect(store.has("created-id")).toBe(true);
  });

  it("rejects a library other than TBC or Rejoice", async () => {
    const response = await request(app).post("/api/hymns").set("Cookie", keeperCookie()).send({ ...draft, library: "Other" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Choose TBC or Rejoice.");
  });

  it("rejects a hymn with no title", async () => {
    const response = await request(app).post("/api/hymns").set("Cookie", keeperCookie()).send({ ...draft, title: " " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("A title is required.");
  });

  it("updates a hymn", async () => {
    const response = await request(app)
      .put("/api/hymns/hymn1")
      .set("Cookie", keeperCookie())
      .send({ ...draft, title: "Corrected title", library: "Rejoice" });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Corrected title");
    expect(response.body.data.library).toBe("Rejoice");
    expect(store.get("hymn1")?.title).toBe("Corrected title");
  });

  it("deletes a hymn", async () => {
    const response = await request(app).delete("/api/hymns/hymn1").set("Cookie", keeperCookie());

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: "hymn1" });
    expect(store.has("hymn1")).toBe(false);

    const missing = await request(app).get("/api/hymns/hymn1");
    expect(missing.status).toBe(404);
  });
});

describe("webp upload", () => {
  const app = testApp(hymns);

  it("stores a webp sheet on the hymn", async () => {
    const response = await request(app)
      .post("/api/hymns/hymn1/image")
      .set("Cookie", keeperCookie())
      .set("Content-Type", "image/webp")
      .set("X-File-Name", "sheet.webp")
      .send(webp);

    expect(response.status).toBe(201);
    expect(putImage).toHaveBeenCalledTimes(1);
    const [key, body] = putImage.mock.calls[0] as [string, Buffer];
    expect(key).toMatch(/^uploads\/hymn1\/sheet-\d+\.webp$/);
    expect(body.equals(webp)).toBe(true);
    expect(response.body.data.imageUrls).toHaveLength(2);
  });

  it("rejects a file that is not webp", async () => {
    const response = await request(app)
      .post("/api/hymns/hymn1/image")
      .set("Cookie", keeperCookie())
      .set("Content-Type", "image/webp")
      .set("X-File-Name", "notes.png")
      .send(Buffer.from("not a webp"));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Only .webp files can be uploaded.");
    expect(putImage).not.toHaveBeenCalled();
  });

  it("returns 404 when the hymn for the sheet does not exist", async () => {
    const response = await request(app)
      .post("/api/hymns/missing/image")
      .set("Cookie", keeperCookie())
      .set("Content-Type", "image/webp")
      .send(webp);

    expect(response.status).toBe(404);
    expect(putImage).not.toHaveBeenCalled();
  });
});
