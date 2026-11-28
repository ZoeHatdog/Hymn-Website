import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export function RequireAuth() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <main className="sheet">
        <p className="empty">Checking the desk.</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
