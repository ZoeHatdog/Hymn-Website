import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const links = [
  { to: "/view", label: "View" },
  { to: "/add", label: "Add" },
  { to: "/update", label: "Update" },
  { to: "/delete", label: "Delete" },
];

export function Shell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="mast">
        <p className="issue">Library desk</p>
        <NavLink className="wordmark" to="/">
          Hymn desk
        </NavLink>
        <ul className="mast-links">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to}>{link.label}</NavLink>
            </li>
          ))}
        </ul>
        <div className="mast-account">
          <p>{user?.email}</p>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => {
              void signOut().then(() => navigate("/login", { replace: true }));
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="sheet">
        <Outlet />
      </main>
      <footer className="colophon">
        <p className="signoff">Yours, the desk.</p>
        <p className="postscript">Hymn records stay in the library API.</p>
      </footer>
    </>
  );
}
