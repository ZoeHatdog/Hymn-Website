import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getHymn, listHymns } from "../api";
import { hymnChoice, hymnMatch } from "../hymnLabel";
import type { Hymn, HymnSummary } from "../types";

export function ViewPage() {
  const { id } = useParams();

  if (!id) {
    return <HymnPicker />;
  }

  return <HymnReader id={id} />;
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

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return hymns;
    }
    return hymns.filter((hymn) => hymnMatch(hymn, needle));
  }, [hymns, query]);

  const message = !ready
    ? status
    : hymns.length === 0 && status !== "Loading the library…"
      ? status
      : query.trim()
        ? `${shown.length === 1 ? "1 hymn" : `${shown.length} hymns`} match.`
        : shown.length === 1
          ? "1 hymn in the library. Open it to read."
          : `${shown.length} hymns in the library. Open one to read.`;

  return (
    <>
      <header className="task-head">
        <h1>View a hymn.</h1>
        <p className="lede" role="status">
          {message}
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
              placeholder="Title, library, or number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
      </form>
      <ul className="hymn-list" aria-busy={!ready}>
        {!ready ? (
          <SkeletonRows />
        ) : shown.length === 0 ? (
          <li className="empty">
            <p>
              <strong>{hymns.length === 0 ? "No hymns yet." : "Nothing matches that search."}</strong>
            </p>
            {hymns.length === 0 ? (
              <Link className="btn" to="/add">
                Add a hymn
              </Link>
            ) : null}
          </li>
        ) : (
          shown.map((hymn) => (
            <li key={hymn.id}>
              <Link className="row-link" to={`/view/${hymn.id}`}>
                <strong>{hymn.title}</strong>
                <p>{hymnChoice(hymn)}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

function HymnReader({ id }: { id: string }) {
  const [hymn, setHymn] = useState<Hymn | null>(null);
  const [status, setStatus] = useState("Loading the hymn…");

  useEffect(() => {
    let active = true;
    setHymn(null);
    setStatus("Loading the hymn…");
    getHymn(id)
      .then((data) => {
        if (!active) {
          return;
        }
        setHymn(data);
        setStatus("");
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

  const facts = hymn
    ? [hymn.page == null ? "" : `No. ${hymn.page}`, hymn.author, hymn.library, hymn.tags.length > 0 ? hymn.tags.join(", ") : ""]
        .filter((item): item is string => Boolean(item))
    : [];

  return (
    <>
      <header className="task-head">
        <h1>{hymn?.title || "View a hymn."}</h1>
        <p className="lede" role="status">
          {status || facts.join(" · ")}
        </p>
      </header>
      {hymn ? (
        <>
          <p className="lyrics">{hymn.lyrics}</p>
          {hymn.link ? (
            <p className="reference">
              <a href={hymn.link}>Reference</a>
            </p>
          ) : null}
          {hymn.imageUrls.length > 0 ? (
            <div className="score">
              {hymn.imageUrls.map((url, index) => (
                <img key={url} src={url} alt={`Sheet music, page ${index + 1}`} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <div className="actions">
        <Link className="btn btn-quiet" to="/view">
          Back to the list
        </Link>
      </div>
    </>
  );
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
