import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { requestLoginCode, verifyLoginCode } from "../api";
import { useAuth } from "../auth";

const googleErrors: Record<string, string> = {
  google_config: "Google sign-in is not configured yet. Add the client id and secret to the env file.",
  google_denied: "Google sign-in was cancelled.",
  google_email: "Google did not share an email address.",
  google_unverified: "That Google email is not verified.",
  google_not_allowed: "That email is not on the desk.",
  google_failed: "Google sign-in did not complete. Try again.",
};

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<"" | "error" | "success">("");
  const [pending, setPending] = useState(false);

  const googleError = googleErrors[params.get("error") ?? ""] ?? "";
  const shownNote = note || googleError;
  const shownKind = noteKind || (googleError ? "error" : "");

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNote("");
    setNoteKind("");
    try {
      await requestLoginCode(email);
      setSent(true);
      setNote("The code is on its way to that inbox.");
      setNoteKind("success");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The code could not be sent.");
      setNoteKind("error");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNote("");
    setNoteKind("");
    try {
      const session = await verifyLoginCode(email, code);
      setUser(session);
      navigate("/", { replace: true });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That code could not be checked.");
      setNoteKind("error");
      setPending(false);
    }
  }

  return (
    <>
      <header className="mast">
        <p className="issue">Library desk</p>
        <Link className="wordmark" to="/">
          Hymn desk
        </Link>
      </header>
      <main className="sheet">
        <div className="task-head">
          <h1>Sign in</h1>
          <p className="lede">The desk takes an email, then a code from that inbox. There is no password.</p>
        </div>

        {user === undefined ? (
          <p className="empty">Checking the desk.</p>
        ) : (
          <>
            <form onSubmit={sent ? verify : sendCode}>
              <label>
                Email
                <span className="field">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    disabled={sent || pending}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </span>
              </label>

              {sent ? (
                <label>
                  Code
                  <span className="field">
                    <input
                      className="code-input"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={code}
                      disabled={pending}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </span>
                </label>
              ) : null}

              <p className="form-note" data-kind={shownKind || undefined} role={shownKind === "error" ? "alert" : undefined}>
                {shownNote}
              </p>

              <div className="actions">
                <button className="btn" type="submit" disabled={pending} data-state={pending ? "loading" : undefined}>
                  {pending ? "Working" : sent ? "Sign in" : "Send code"}
                </button>
                {sent ? (
                  <button
                    className="btn btn-quiet"
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setSent(false);
                      setCode("");
                      setNote("");
                      setNoteKind("");
                    }}
                  >
                    Use a different email
                  </button>
                ) : null}
              </div>
            </form>

            <p className="login-or">or</p>
            <a className="btn btn-quiet btn-block" href="/api/auth/google">
              Continue with Google
            </a>
          </>
        )}
      </main>
      <footer className="colophon">
        <p className="signoff">Yours, the desk.</p>
        <p className="postscript">The code arrives by Gmail and expires in ten minutes.</p>
      </footer>
    </>
  );
}
