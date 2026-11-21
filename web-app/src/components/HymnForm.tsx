import { useState, type FormEvent } from "react";
import type { HymnDraft } from "../types";

const emptyDraft: HymnDraft = {
  title: "",
  author: "",
  lyrics: "",
  library: "",
  tags: "",
  link: "",
};

const fieldCopy = {
  title: "The title is empty. A hymn is filed under its title.",
  author: "The author is empty. The library records who wrote it.",
  lyrics: "The lyrics are empty. Type or paste the words of the hymn.",
  link: "That link is not a full URL. Include https://.",
} as const;

interface HymnFormProps {
  initial?: HymnDraft;
  submitLabel: string;
  onSubmit: (draft: HymnDraft) => Promise<unknown>;
  onSuccess?: () => void;
}

export function HymnForm({ initial = emptyDraft, submitLabel, onSubmit, onSuccess }: HymnFormProps) {
  const [draft, setDraft] = useState(initial);
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
      lyrics: validate("lyrics", draft.lyrics),
      link: validate("link", draft.link),
    };
    setTouched({ title: true, author: true, lyrics: true, link: true });
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
      await onSubmit(draft);
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
        placeholder="Rejoice"
        onBlur={() => undefined}
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

  function markTouched(name: keyof typeof fieldCopy, value: string) {
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: validate(name, value) }));
  }
}

function isCheckedField(name: keyof HymnDraft): name is keyof typeof fieldCopy {
  return name === "title" || name === "author" || name === "lyrics" || name === "link";
}

function validate(name: keyof typeof fieldCopy, value: string) {
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
  error?: string;
  success?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function Field({ id, label, value, required, multiline, type = "text", placeholder, error, success, onChange, onBlur }: FieldProps) {
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
        {multiline ? <textarea {...controlProps} rows={8} /> : <input {...controlProps} type={type} autoComplete={type === "url" ? "url" : "off"} />}
        <span className="mark" aria-hidden="true" />
      </span>
      <span className="helper" id={`${id}-help`}>
        {error}
      </span>
    </label>
  );
}
