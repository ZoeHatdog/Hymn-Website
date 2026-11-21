import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/view", label: "View" },
  { to: "/add", label: "Add" },
  { to: "/update", label: "Update" },
  { to: "/delete", label: "Delete" },
];

export function Shell() {
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
