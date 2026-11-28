export const fields = {
    id: { type: "string", required: true },
    title: { type: "string", required: true },
    author: { type: "string", required: true },
    lyrics: { type: "string", required: true },
    imagePaths: { type: "array", required: false },
    tags: { type: "array", required: true },
    library: { type: "string", required: true },
    link: { type: "string", required: true },
    created: { type: "date", required: true },
    updated: { type: "date", required: true },
};

export const table = "Hymn";
export const primary_key = "id";
export const default_sort = "id";
export const schema = "public";
