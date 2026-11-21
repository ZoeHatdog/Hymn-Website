import type { Hymn, HymnDraft, HymnSummary } from "./types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  let body: ApiSuccess<T> | ApiFailure;
  try {
    body = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new Error("The hymn API returned an unexpected response.");
  }

  if (!response.ok || !body.success) {
    throw new Error(body.success ? "The hymn API rejected that request." : (body.error ?? "The hymn API rejected that request."));
  }

  return body.data;
}

export function listHymns() {
  return request<HymnSummary[]>("/api/hymns");
}

export function getHymn(id: string) {
  return request<Hymn>(`/api/hymns/${encodeURIComponent(id)}`);
}

export function createHymn(draft: HymnDraft) {
  return request<Hymn>("/api/hymns", { method: "POST", body: JSON.stringify(toPayload(draft)) });
}

export function updateHymn(id: string, draft: HymnDraft) {
  return request<Hymn>(`/api/hymns/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(toPayload(draft)),
  });
}

export function removeHymn(id: string) {
  return request<unknown>(`/api/hymns/${encodeURIComponent(id)}`, { method: "DELETE" });
}

function toPayload(draft: HymnDraft) {
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    lyrics: draft.lyrics.trim(),
    library: draft.library.trim() || null,
    link: draft.link.trim() || null,
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  };
}
