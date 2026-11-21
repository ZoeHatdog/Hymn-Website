import { useState } from "react";
import { createHymn } from "../api";
import { HymnForm } from "../components/HymnForm";

export function AddPage() {
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <header className="task-head">
        <h1>Add a hymn.</h1>
        <p className="lede">Title, author, and lyrics are required.</p>
      </header>
      <HymnForm
        key={formKey}
        submitLabel="Save hymn"
        onSubmit={createHymn}
        onSuccess={() => setFormKey((key) => key + 1)}
      />
    </>
  );
}
