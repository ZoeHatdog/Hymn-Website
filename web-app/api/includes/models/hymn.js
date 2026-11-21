const fields = {
    id: { type: "integer", required: true },
    title: { type: "string", required: true },
    author: { type: "string", required: true },
    lyrics: { type: "string", required: true },
    tags: { type: "array", required: true },
    library: { type: "string", required: true },
    link: { type: "string", required: true },
    created_at: { type: "date", required: true },
    updated_at: { type: "date", required: true },
};

exports.fields = fields;
exports.table = "hymns";
exports.primary_key = "id";
exports.default_sort = "id";
exports.schema = "public";