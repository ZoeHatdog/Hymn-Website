import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getHymn, listHymns, updateHymn } from "../api";
import { HymnForm } from "../components/HymnForm";
import type { HymnDraft, HymnSummary } from "../types";

export function UpdatePage() {
  const { id } = useParams();

  if (!id) {
    return <HymnPicker />;
  }

  return <HymnEditor id={id} />;
}

function HymnPicker() {
  const [hymns, setHymns] = useState<HymnSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading the library…");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    listHymns()
      .then((data) => {
        if (!active) {
          return;
        }
        setHymns(data);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setStatus(error instanceof Error ? error.message : "The hymn list did not load.");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(() => filterHymns(hymns, query), [hymns, query]);

  const message = !ready
    ? status
    : hymns.length === 0 && status !== "Loading the library…"
      ? status
      : shown.length === 1
        ? "1 hymn in the library. Open it to correct the record."
        : `${shown.length} hymns in the library. Open one to correct it.`;

  return (
    <>
      <header className="task-head">
        <h1>Update a hymn.</h1>
        <p className="lede" role="status">
          {query.trim() && ready ? `${shown.length === 1 ? "1 hymn" : `${shown.length} hymns`} match.` : message}
        </p>
      </header>
      <form className="find" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="query">
          Find a hymn
          <span className="field">
            <input
              id="query"
              type="search"
              autoComplete="off"
              placeholder="Title or author"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
      </form>
      <ul className="hymn-list" aria-busy={!ready}>
        {!ready ? <SkeletonRows /> : shown.length === 0 ? <Empty lead={hymns.length === 0 ? "No hymns yet." : "Nothing matches that search."} /> : shown.map((hymn) => (
          <li key={hymn.id}>
            <Link className="row-link" to={`/update/${hymn.id}`}>
              <strong>{hymn.title}</strong>
              <p>{hymn.author}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function HymnEditor({ id }: { id: string }) {
  const [draft, setDraft] = useState<HymnDraft | null>(null);
  const [title, setTitle] = useState("Correct this hymn.");
  const [status, setStatus] = useState("Loading the hymn…");

  useEffect(() => {
    let active = true;
    getHymn(id)
      .then((hymn) => {
        if (!active) {
          return;
        }
        setTitle(hymn.title || "Correct this hymn.");
        setStatus("Correct the record, then save.");
        setDraft({
          title: hymn.title ?? "",
          author: hymn.author ?? "",
          lyrics: hymn.lyrics ?? "",
          library: hymn.library ?? "",
          tags: hymn.tags.join(", "),
          link: hymn.link ?? "",
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setStatus(error instanceof Error ? error.message : "That hymn did not load.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <header className="task-head">
        <h1>{title}</h1>
        <p className="lede" role="status">
          {status}
        </p>
      </header>
      {draft ? (
        <HymnForm key={id} hymnId={id} initial={draft} submitLabel="Save changes" onSubmit={(next) => updateHymn(id, next)} />
      ) : null}
      <div className="actions">
        <Link className="btn btn-quiet" to="/update">
          Back to the list
        </Link>
      </div>
    </>
  );
}

function filterHymns(hymns: HymnSummary[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return hymns;
  }
  return hymns.filter((hymn) => `${hymn.title} ${hymn.author}`.toLowerCase().includes(needle));
}

function SkeletonRows() {
  return (
    <>
      <li className="skeleton" aria-hidden="true">
        <span />
        <span />
      </li>
      <li className="skeleton" aria-hidden="true">
        <span />
        <span />
      </li>
    </>
  );
}

function Empty({ lead }: { lead: string }) {
  return (
    <li className="empty">
      <p>
        <strong>{lead}</strong>
      </p>
      {lead === "No hymns yet." ? (
        <Link className="btn" to="/add">
          Add a hymn
        </Link>
      ) : null}
    </li>
  );
}
