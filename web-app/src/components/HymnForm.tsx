import { useState, type FormEvent } from "react";
import { uploadHymnImage } from "../api";
import type { HymnDraft } from "../types";

const emptyDraft: HymnDraft = {
  title: "",
  author: "",
  lyrics: "",
  library: "",
  tags: "",
  link: "",
};

const libraries = ["TBC", "Rejoice"] as const;

const fieldCopy = {
  title: "The title is empty. A hymn is filed under its title.",
  author: "The author is empty. The library records who wrote it.",
  library: "Choose TBC or Rejoice.",
  lyrics: "The lyrics are empty. Type or paste the words of the hymn.",
  link: "That link is not a full URL. Include https://.",
} as const;

interface HymnFormProps {
  hymnId?: string;
  initial?: HymnDraft;
  submitLabel: string;
  onSubmit: (draft: HymnDraft) => Promise<unknown>;
  onSuccess?: () => void;
}

export function HymnForm({ hymnId, initial = emptyDraft, submitLabel, onSubmit, onSuccess }: HymnFormProps) {
  const [draft, setDraft] = useState(initial);
  const [sheet, setSheet] = useState<File | null>(null);
  const [sheetError, setSheetError] = useState("");
  const [uploadState, setUploadState] = useState<"" | "loading" | "success">("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<"" | "error" | "success">("");
  const [saveState, setSaveState] = useState<"" | "loading" | "error" | "success">("");

  function update(name: keyof HymnDraft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    if (saveState === "error" || saveState === "success") {
      setSaveState("");
      setNote("");
      setNoteKind("");
    }
    if (touched[name] && isCheckedField(name)) {
      setErrors((current) => ({ ...current, [name]: validate(name, value) }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      title: validate("title", draft.title),
      author: validate("author", draft.author),
      library: validate("library", draft.library),
      lyrics: validate("lyrics", draft.lyrics),
      link: validate("link", draft.link),
    };
    setTouched({ title: true, author: true, library: true, lyrics: true, link: true });
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setSaveState("");
      setNote("");
      return;
    }

    setSaveState("loading");
    setNote("");
    setNoteKind("");
    try {
      const saved = await onSubmit(draft);
      const id = hymnId || savedId(saved);
      if (sheet) {
        if (!id) {
          throw new Error("The hymn was saved, but the sheet image had nowhere to go.");
        }
        await uploadHymnImage(id, sheet);
        setSheet(null);
      }
      setSaveState("success");
      setNote("Saved.");
      setNoteKind("success");
      onSuccess?.();
    } catch (error) {
      setSaveState("error");
      setNoteKind("error");
      setNote(error instanceof Error ? error.message : "The hymn was not saved. Try again in a moment.");
    }
  }

  const saveText = saveState === "loading" ? "Saving…" : saveState === "success" ? "Saved" : submitLabel;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field
        id="title"
        label="Title"
        value={draft.title}
        required
        error={errors.title}
        success={touched.title && !errors.title}
        onBlur={() => markTouched("title", draft.title)}
        onChange={(value) => update("title", value)}
      />
      <Field
        id="author"
        label="Author"
        value={draft.author}
        required
        error={errors.author}
        success={touched.author && !errors.author}
        onBlur={() => markTouched("author", draft.author)}
        onChange={(value) => update("author", value)}
      />
      <Field
        id="library"
        label="Library"
        value={draft.library}
        required
        options={libraries}
        error={errors.library}
        success={touched.library && !errors.library}
        onBlur={() => markTouched("library", draft.library)}
        onChange={(value) => update("library", value)}
      />
      <Field
        id="tags"
        label="Tags"
        value={draft.tags}
        placeholder="Grace, Salvation"
        onBlur={() => undefined}
        onChange={(value) => update("tags", value)}
      />
      <Field
        id="link"
        label="Reference link"
        type="url"
        value={draft.link}
        placeholder="https://"
        error={errors.link}
        success={touched.link && !errors.link && draft.link.trim().length > 0}
        onBlur={() => markTouched("link", draft.link)}
        onChange={(value) => update("link", value)}
      />
      <Field
        id="lyrics"
        label="Lyrics"
        value={draft.lyrics}
        multiline
        required
        error={errors.lyrics}
        success={touched.lyrics && !errors.lyrics}
        onBlur={() => markTouched("lyrics", draft.lyrics)}
        onChange={(value) => update("lyrics", value)}
      />
      <div className="sheet">
        <label htmlFor="sheet">
          Sheet image
          <span className="field" data-state={sheetError ? "error" : sheet ? "success" : undefined}>
            <input
              id="sheet"
              name="sheet"
              type="file"
              accept=".webp,image/webp"
              aria-describedby="sheet-help"
              onChange={(event) => chooseSheet(event.target.files?.[0] ?? null)}
            />
            <span className="mark" aria-hidden="true" />
          </span>
          <span className="helper" id="sheet-help" data-kind={sheetError ? undefined : "hint"}>
            {sheetError || (sheet ? sheet.name : "Only .webp files.")}
          </span>
        </label>
        <div className="actions">
          <button
            className="btn btn-quiet"
            type="button"
            data-state={uploadState || undefined}
            disabled={!sheet || uploadState === "loading" || saveState === "loading"}
            onClick={() => void uploadSheet()}
          >
            {uploadState === "loading" ? "Uploading…" : uploadState === "success" ? "Uploaded" : "Upload"}
          </button>
        </div>
      </div>
      <p className="form-note" data-kind={noteKind || undefined} role="status">
        {note}
      </p>
      <div className="actions">
        <button className="btn" type="submit" data-state={saveState || undefined} disabled={saveState === "loading"}>
          {saveText}
        </button>
      </div>
    </form>
  );

  function chooseSheet(file: File | null) {
    setUploadState("");
    if (!file) {
      setSheet(null);
      setSheetError("");
      return;
    }
    const problem = webpProblem(file);
    setSheet(problem ? null : file);
    setSheetError(problem);
  }

  async function uploadSheet() {
    const problem = sheet ? webpProblem(sheet) : "Choose a .webp file.";
    if (!sheet || problem) {
      setSheetError(problem);
      return;
    }
    if (!hymnId) {
      setNote("This sheet will upload when you save the hymn.");
      setNoteKind("");
      return;
    }
    setUploadState("loading");
    setNote("");
    setNoteKind("");
    try {
      await uploadHymnImage(hymnId, sheet);
      setSheet(null);
      setUploadState("success");
      setNote("Uploaded.");
      setNoteKind("success");
    } catch (error) {
      setUploadState("");
      setNoteKind("error");
      setNote(error instanceof Error ? error.message : "The sheet was not uploaded.");
    }
  }

  function markTouched(name: keyof typeof fieldCopy, value: string) {
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: validate(name, value) }));
  }
}

function webpProblem(file: File): string {
  const namedWebp = file.name.toLowerCase().endsWith(".webp");
  const typedWebp = file.type === "" || file.type === "image/webp";
  return namedWebp && typedWebp ? "" : "Only .webp files can be uploaded.";
}

function savedId(value: unknown): string {
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return "";
}

function isCheckedField(name: keyof HymnDraft): name is keyof typeof fieldCopy {
  return name === "title" || name === "author" || name === "library" || name === "lyrics" || name === "link";
}

function validate(name: keyof typeof fieldCopy, value: string) {
  if (name === "library") {
    return libraries.includes(value as (typeof libraries)[number]) ? "" : fieldCopy.library;
  }
  if (name === "link") {
    if (!value.trim()) {
      return "";
    }
    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:" ? "" : fieldCopy.link;
    } catch {
      return fieldCopy.link;
    }
  }
  return value.trim() ? "" : fieldCopy[name];
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  options?: readonly string[];
  error?: string;
  success?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function Field({ id, label, value, required, multiline, type = "text", placeholder, options, error, success, onChange, onBlur }: FieldProps) {
  const state = error ? "error" : success ? "success" : undefined;
  const controlProps = {
    id,
    name: id,
    value,
    required,
    placeholder,
    "aria-required": required || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": `${id}-help`,
    onBlur,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };

  return (
    <label htmlFor={id}>
      {label}
      <span className="field" data-state={state}>
        {options ? (
          <select {...controlProps} value={value}>
            <option value="">Choose a library</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea {...controlProps} rows={8} />
        ) : (
          <input {...controlProps} type={type} autoComplete={type === "url" ? "url" : "off"} />
        )}
        <span className="mark" aria-hidden="true" />
      </span>
      <span className="helper" id={`${id}-help`}>
        {error}
      </span>
    </label>
  );
}
