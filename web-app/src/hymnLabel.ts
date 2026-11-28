import type { HymnSummary } from "./types";

export function hymnChoice(hymn: HymnSummary): string {
  const number = hymn.page == null ? "" : `No. ${hymn.page}`;
  return [hymn.library, number, hymn.author].filter((part) => part).join(" · ");
}

export function hymnMatch(hymn: HymnSummary, needle: string): boolean {
  return `${hymn.title} ${hymn.author} ${hymn.library ?? ""} ${hymn.page ?? ""}`.toLowerCase().includes(needle);
}
