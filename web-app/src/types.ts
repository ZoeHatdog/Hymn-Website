export interface HymnSummary {
  id: string;
  title: string;
  author: string;
}

export interface Hymn {
  id: string;
  title: string;
  author: string;
  lyrics: string;
  imageUrls: string[];
  tags: string[];
  library: string | null;
  link: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HymnDraft {
  title: string;
  author: string;
  lyrics: string;
  library: string;
  tags: string;
  link: string;
}
