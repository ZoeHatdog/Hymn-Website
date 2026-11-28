import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { dismissNotice, holdNotice, releaseNotice, reportError, subscribeNotices, type Notice, type NoticeKind } from "../notices";

const kindLabel: Record<NoticeKind, string> = {
  success: "Done",
  error: "Problem",
  notice: "Note",
};

export function ErrorNotices() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => subscribeNotices(setItems), []);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportError(event.message || "Something went wrong.");
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportError(reason instanceof Error ? reason.message : "Something went wrong.");
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="notices" aria-label="Notifications">
      {items.map((item) => (
        <div
          key={item.id}
          className="notice"
          data-kind={item.kind}
          data-leaving={item.leaving ? "true" : undefined}
          role={item.kind === "error" ? "alert" : "status"}
          onMouseEnter={() => holdNotice(item.id)}
          onMouseLeave={() => releaseNotice(item.id)}
          onFocus={() => holdNotice(item.id)}
          onBlur={() => releaseNotice(item.id)}
        >
          <span className="notice-kind">{kindLabel[item.kind]}</span>
          <button type="button" onClick={() => dismissNotice(item.id)} aria-label={`Dismiss ${kindLabel[item.kind].toLowerCase()}`}>
            <span aria-hidden="true">×</span>
          </button>
          <p className="notice-text">{item.message}</p>
        </div>
      ))}
    </div>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { failed: boolean };

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportError(error.message || "The desk hit an unexpected error.");
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="sheet">
          <p className="lede">The desk hit an unexpected error. Reload the page to continue.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
