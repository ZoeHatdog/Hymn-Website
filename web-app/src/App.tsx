import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { RequireAuth } from "./components/RequireAuth";
import { Shell } from "./components/Shell";
import { AddPage } from "./pages/AddPage";
import { DeletePage } from "./pages/DeletePage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { UpdatePage } from "./pages/UpdatePage";
import { ViewPage } from "./pages/ViewPage";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="view" element={<ViewPage />} />
            <Route path="view/:id" element={<ViewPage />} />
            <Route path="add" element={<AddPage />} />
            <Route path="update" element={<UpdatePage />} />
            <Route path="update/:id" element={<UpdatePage />} />
            <Route path="delete" element={<DeletePage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
