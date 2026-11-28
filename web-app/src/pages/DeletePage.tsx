import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listHymns, removeHymn } from "../api";
import { reportNotice, reportSuccess } from "../notices";
import { hymnChoice, hymnMatch } from "../hymnLabel";
import type { HymnSummary } from "../types";

export function DeletePage() {
  const [hymns, setHymns] = useState<HymnSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading the library…");
  const [ready, setReady] = useState(false);
  const [armedId, setArmedId] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [failedId, setFailedId] = useState("");

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

  const count = shown.length === 1 ? "1 hymn" : `${shown.length} hymns`;
  const message = !ready
    ? status
    : query.trim()
      ? `${count} match.`
      : hymns.length === 0 && status !== "Loading the library…"
        ? status
        : `${count} in the library. The second click confirms a delete.`;

  async function deleteHymn(hymn: HymnSummary) {
    if (armedId !== hymn.id) {
      setArmedId(hymn.id);
      setFailedId("");
      reportNotice(`Click Delete again to remove “${hymn.title}”.`);
      return;
    }
    setPendingId(hymn.id);
    setFailedId("");
    try {
      await removeHymn(hymn.id);
      setHymns((current) => current.filter((item) => item.id !== hymn.id));
      setArmedId("");
      reportSuccess(`“${hymn.title}” is removed.`);
    } catch (error) {
      setFailedId(hymn.id);
      setStatus(error instanceof Error ? error.message : "That hymn was not deleted.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <>
      <header className="task-head">
        <h1>Delete a hymn.</h1>
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
          shown.map((hymn) => {
            const pending = pendingId === hymn.id;
            const failed = failedId === hymn.id;
            const armed = armedId === hymn.id;
            const state = pending ? "loading" : failed ? "error" : undefined;
            return (
              <li key={hymn.id}>
                <div>
                  <strong>{hymn.title}</strong>
                  <p>{hymnChoice(hymn)}</p>
                </div>
                <button
                  className="btn btn-quiet"
                  type="button"
                  data-state={state}
                  disabled={pending}
                  onClick={() => deleteHymn(hymn)}
                >
                  {pending ? "Deleting…" : armed ? "Confirm delete" : "Delete"}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </>
  );
}
