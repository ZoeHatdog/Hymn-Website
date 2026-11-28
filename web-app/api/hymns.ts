import express, { Router, type Response } from "express";
import { requireSession } from "./includes/auth/require.ts";
import { isWebp, putImage, resolveImageUrl } from "./includes/bucket.ts";
import { goodCursor } from "./includes/good_cursor.ts";
import { default_sort, fields, primary_key, schema, table } from "./includes/models/hymn.js";

const hymnModel = { fields, table, primary_key, default_sort, schema };

type HymnRow = Record<string, unknown>;

type HymnBody = {
  title?: unknown;
  author?: unknown;
  lyrics?: unknown;
  library?: unknown;
  page?: unknown;
  link?: unknown;
  tags?: unknown;
};

const hymns = Router();

hymns.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  requireSession(req, res, next);
});

hymns.get("/", async (_req, res) => {
  try {
    const rows = await goodCursor.getAll(hymnModel, undefined, undefined, "title");
    res.json({ success: true, data: rows.map(toSummary) });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

hymns.get("/:id", async (req, res) => {
  try {
    const hymn = await findHymn(req.params.id);
    if (!hymn) {
      sendFailure(res, 404, "That hymn is not in the library.");
      return;
    }
    res.json({ success: true, data: await toHymn(hymn) });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

hymns.post("/", async (req, res) => {
  try {
    const parsed = readHymn(req.body);
    if (parsed.error || !parsed.row) {
      sendFailure(res, 400, parsed.error ?? "The hymn could not be saved.");
      return;
    }
    if (await pageTaken(String(parsed.row.library), Number(parsed.row.page))) {
      sendFailure(res, 409, pageTakenMessage(String(parsed.row.library), Number(parsed.row.page)));
      return;
    }

    const now = goodCursor.buildNestedQuery("CURRENT_TIMESTAMP");
    const inserted = await goodCursor.insert(hymnModel, {
      ...parsed.row,
      created: now,
      updated: now,
    });
    const created = await findHymn(inserted[0]?.id);
    if (!created) {
      sendFailure(res, 500, "The hymn was saved, but it could not be read back.");
      return;
    }
    res.status(201).json({ success: true, data: await toHymn(created) });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

hymns.post("/:id/image", express.raw({ type: "image/webp", limit: "12mb" }), async (req, res) => {
  try {
    const existing = await findHymn(req.params.id);
    if (!existing) {
      sendFailure(res, 404, "That hymn is not in the library.");
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!isWebp(body)) {
      sendFailure(res, 400, "Only .webp files can be uploaded.");
      return;
    }

    const page = asPage(existing.page);
    const library = typeof existing.library === "string" ? existing.library.trim() : "";
    const title = typeof existing.title === "string" ? existing.title.trim() : "";
    if (!library || !title || page == null) {
      sendFailure(res, 400, "Save the library, title, and hymn number before uploading a sheet.");
      return;
    }

    const key = imageKey(library, title, page);
    await putImage(key, body);
    const paths = asTags(existing.imagePaths);
    if (!paths.includes(key)) paths.push(key);
    await goodCursor.update(
      hymnModel,
      { imagePaths: paths, updated: goodCursor.buildNestedQuery("CURRENT_TIMESTAMP") },
      { id: existing.id },
    );
    const updated = await findHymn(existing.id);
    if (!updated) {
      sendFailure(res, 500, "The sheet was stored, but the hymn could not be read back.");
      return;
    }
    res.status(201).json({ success: true, data: await toHymn(updated) });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

hymns.put("/:id", async (req, res) => {
  try {
    const existing = await findHymn(req.params.id);
    if (!existing) {
      sendFailure(res, 404, "That hymn is not in the library.");
      return;
    }

    const parsed = readHymn(req.body);
    if (parsed.error || !parsed.row) {
      sendFailure(res, 400, parsed.error ?? "The hymn could not be saved.");
      return;
    }
    if (await pageTaken(String(parsed.row.library), Number(parsed.row.page), String(existing.id))) {
      sendFailure(res, 409, pageTakenMessage(String(parsed.row.library), Number(parsed.row.page)));
      return;
    }

    await goodCursor.update(
      hymnModel,
      { ...parsed.row, updated: goodCursor.buildNestedQuery("CURRENT_TIMESTAMP") },
      { id: existing.id },
    );
    const updated = await findHymn(existing.id);
    if (!updated) {
      sendFailure(res, 500, "The hymn was saved, but it could not be read back.");
      return;
    }
    res.json({ success: true, data: await toHymn(updated) });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

hymns.delete("/:id", async (req, res) => {
  try {
    const existing = await findHymn(req.params.id);
    if (!existing) {
      sendFailure(res, 404, "That hymn is not in the library.");
      return;
    }

    await goodCursor.delete(hymnModel, { id: existing.id });
    res.json({ success: true, data: { id: String(existing.id) } });
  } catch (error) {
    sendLibraryError(res, error);
  }
});

async function findHymn(rawId: unknown): Promise<HymnRow | null> {
  const id = parseId(rawId);
  if (id == null) {
    return null;
  }
  const rows = await goodCursor.getOne(hymnModel, undefined, { id });
  return rows[0] ?? null;
}

async function pageTaken(library: string, page: number, exceptId?: string): Promise<boolean> {
  const rows = await goodCursor.getOne(hymnModel, undefined, { library, page });
  const found = rows[0];
  if (!found) return false;
  return String(found.id) !== exceptId;
}

function pageTakenMessage(library: string, page: number): string {
  return library + " already has hymn number " + page + ".";
}

function imageKey(library: string, title: string, page: number): string {
  const name = title.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim() + " - " + page;
  return library + "/" + name + "/" + name + ".webp";
}

function parseId(rawId: unknown): string | null {
  const text = Array.isArray(rawId) ? String(rawId[0] ?? "") : String(rawId ?? "");
  const id = text.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return null;
  }
  return id;
}

function readHymn(body: unknown): { row?: HymnRow; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "The hymn details were missing." };
  }

  const input = body as HymnBody;
  const title = requiredText(input.title);
  const author = requiredText(input.author);
  const lyrics = requiredText(input.lyrics);
  if (!title) return { error: "A title is required." };
  if (!author) return { error: "An author is required." };
  if (!lyrics) return { error: "Lyrics are required." };

  const library = optionalText(input.library);
  const link = optionalText(input.link);
  if (library.error) return { error: library.error };
  if (library.value !== "TBC" && library.value !== "Rejoice") {
    return { error: "Choose TBC or Rejoice." };
  }
  if (link.error) return { error: link.error };

  const page = readPage(input.page);
  if (page.error || page.value == null) return { error: page.error ?? "A page number is required." };

  const tags = readTags(input.tags);
  if (tags.error || !tags.value) return { error: tags.error ?? "Tags must be a list of words." };

  return {
    row: {
      title,
      author,
      lyrics,
      library: library.value,
      page: page.value,
      link: link.value,
      tags: tags.value,
    },
  };
}

function readPage(value: unknown): { value?: number; error?: string } {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { error: "A page number is required." };
  }
  return { value: parsed };
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalText(value: unknown): { value: string | null; error?: string } {
  if (value == null) return { value: null };
  if (typeof value !== "string") return { value: null, error: "Optional text fields must be words or empty." };
  const trimmed = value.trim();
  return { value: trimmed.length > 0 ? trimmed : null };
}

function readTags(value: unknown): { value?: string[]; error?: string } {
  if (value == null) return { value: [] };
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    return { error: "Tags must be a list of words." };
  }
  return {
    value: value.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
  };
}

function toSummary(row: HymnRow) {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    author: String(row.author ?? ""),
    library: row.library == null || row.library === "" ? null : String(row.library),
    page: asPage(row.page),
  };
}

async function toHymn(row: HymnRow) {
  return {
    ...toSummary(row),
    lyrics: String(row.lyrics ?? ""),
    imageUrls: await imageUrls(row.imagePaths),
    tags: asTags(row.tags),
    library: row.library == null || row.library === "" ? null : String(row.library),
    link: row.link == null || row.link === "" ? null : String(row.link),
    createdAt: asTimestamp(row.created),
    updatedAt: asTimestamp(row.updated),
  };
}

async function imageUrls(value: unknown): Promise<string[]> {
  const paths = asTags(value);
  return Promise.all(paths.map((path) => resolveImageUrl(path)));
}

function asPage(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag));
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((tag) => String(tag));
    } catch {
      return value
        .replace(/^\{|\}$/g, "")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
  }
  return [];
}

function asTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function sendFailure(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, error });
}

function sendLibraryError(res: Response, error: unknown) {
  console.error(error);
  const denied = error !== null && typeof error === "object" && "Code" in error && error.Code === "AccessDenied";
  if (denied) {
    sendFailure(res, 403, "The bucket refused that file. This account needs permission to store images.");
    return;
  }
  sendFailure(res, 500, "The hymn library could not be reached.");
}

export { hymns };
