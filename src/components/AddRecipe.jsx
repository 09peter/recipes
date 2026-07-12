import { useState } from "react";
import { parseRecipe } from "../lib/supabase.js";
import { navigate } from "../App.jsx";

export default function AddRecipe() {
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!rawText.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await parseRecipe(rawText, sourceUrl.trim());
      navigate(`/recipe/${id}`);
    } catch (e) {
      // Leave the pasted text in place so nothing is lost (PRD §5)
      setError(e.message || "Parsing failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-16 pt-8">
      <button onClick={() => navigate("/")} className="text-sm text-olive">
        ← Recipes
      </button>
      <h1 className="mt-3 font-display text-3xl text-olive-deep">Add recipe</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Paste the caption text — hashtags, emoji and all. It gets cleaned up
        automatically.
      </p>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste caption text here"
        rows={12}
        className="mt-4 w-full rounded-2xl border border-line bg-card p-4 text-base leading-relaxed outline-none placeholder:text-ink-soft/60 focus:border-olive"
      />

      <input
        type="url"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="Source link (optional)"
        className="mt-3 w-full rounded-xl border border-line bg-card px-4 py-2.5 text-base outline-none placeholder:text-ink-soft/60 focus:border-olive"
      />

      {error && (
        <p className="mt-4 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          {error} — your pasted text is still here, fix or retry.
        </p>
      )}

      <button
        onClick={submit}
        disabled={!rawText.trim() || busy}
        className="mt-5 w-full rounded-full bg-olive-deep py-3.5 font-medium text-bone disabled:opacity-40 active:bg-olive"
      >
        {busy ? "Parsing…" : "Parse & save to Inbox"}
      </button>
    </div>
  );
}
