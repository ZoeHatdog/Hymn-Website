import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AddPage } from "./pages/AddPage";
import { DeletePage } from "./pages/DeletePage";
import { HomePage } from "./pages/HomePage";
import { UpdatePage } from "./pages/UpdatePage";
import { ViewPage } from "./pages/ViewPage";

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="view" element={<ViewPage />} />
        <Route path="view/:id" element={<ViewPage />} />
        <Route path="add" element={<AddPage />} />
        <Route path="update" element={<UpdatePage />} />
        <Route path="update/:id" element={<UpdatePage />} />
        <Route path="delete" element={<DeletePage />} />
      </Route>
    </Routes>
  );
}
