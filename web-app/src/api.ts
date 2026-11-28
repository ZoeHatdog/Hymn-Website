import type { Hymn, HymnDraft, HymnSummary } from "./types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error?: string;
}

export type DeskUser = {
  email: string;
  name: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof File) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
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

export function currentSession() {
  return request<DeskUser>("/api/auth/session");
}

export function requestLoginCode(email: string) {
  return request<{ email: string }>("/api/auth/code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyLoginCode(email: string, code: string) {
  return request<DeskUser>("/api/auth/code/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function endSession() {
  return request<unknown>("/api/auth/logout", { method: "POST" });
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

export function uploadHymnImage(id: string, file: File) {
  return request<Hymn>(`/api/hymns/${encodeURIComponent(id)}/image`, {
    method: "POST",
    body: file,
    headers: {
      Accept: "application/json",
      "Content-Type": "image/webp",
      "X-File-Name": file.name,
    },
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
