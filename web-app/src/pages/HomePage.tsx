import { Link } from "react-router-dom";

const tasks = [
  {
    to: "/view",
    title: "View a hymn",
    detail: "Open a hymn and read the words.",
  },
  {
    to: "/add",
    title: "Add a hymn",
    detail: "File a title, an author, and the words.",
  },
  {
    to: "/update",
    title: "Update a hymn",
    detail: "Open a record and correct it.",
  },
  {
    to: "/delete",
    title: "Delete a hymn",
    detail: "Take a hymn out of the library.",
  },
];

export function HomePage() {
  return (
    <>
      <p className="open">Read, file, correct, or remove a hymn.</p>
      <ul className="index">
        {tasks.map((task) => (
          <li key={task.to}>
            <Link to={task.to}>
              <strong>{task.title}</strong>
              <span>{task.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
