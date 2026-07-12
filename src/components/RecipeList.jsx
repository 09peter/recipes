import { useEffect, useMemo, useState } from "react";
import { fetchRecipes } from "../lib/supabase.js";
import { navigate } from "../App.jsx";

const TABS = [
  { key: "inbox", label: "Inbox" },
  { key: "approved", label: "Approved" },
];

export default function RecipeList() {
  const [recipes, setRecipes] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(
    () => sessionStorage.getItem("recipe-tab") || "approved",
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchRecipes().then(setRecipes).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    sessionStorage.setItem("recipe-tab", tab);
  }, [tab]);

  const visible = useMemo(() => {
    if (!recipes) return [];
    const q = query.trim().toLowerCase();
    return recipes.filter(
      (r) => r.status === tab && (!q || r.title.toLowerCase().includes(q)),
    );
  }, [recipes, tab, query]);

  const counts = useMemo(() => {
    const c = { inbox: 0, approved: 0 };
    for (const r of recipes ?? []) c[r.status] += 1;
    return c;
  }, [recipes]);

  return (
    <div className="px-5 pb-28 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl text-olive-deep">Recipes</h1>
      </header>

      <div className="mt-5 flex rounded-full border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-olive-deep text-bone"
                : "text-ink-soft active:bg-line/50"
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className={`ml-1.5 font-amount text-xs ${
                  tab === t.key ? "text-saffron" : "text-ink-soft/70"
                }`}
              >
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search recipes"
        className="mt-3 w-full rounded-xl border border-line bg-card px-4 py-2.5 text-base outline-none placeholder:text-ink-soft/60 focus:border-olive"
      />

      {error && (
        <p className="mt-6 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          Couldn't load recipes: {error}
        </p>
      )}

      {recipes === null && !error && (
        <p className="mt-8 text-center text-ink-soft">Loading…</p>
      )}

      {recipes !== null && visible.length === 0 && !error && (
        <div className="mt-12 text-center text-ink-soft">
          {query ? (
            <p>No matches for “{query}”.</p>
          ) : tab === "inbox" ? (
            <p>
              Inbox is empty. Share a reel via the Shortcut or add one below.
            </p>
          ) : (
            <p>Nothing approved yet. Review the Inbox and approve keepers.</p>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-2.5">
        {visible.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => navigate(`/recipe/${r.id}`)}
              className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition-colors active:bg-saffron-soft"
            >
              <span className="font-display text-lg leading-snug text-ink">
                {r.title}
              </span>
              {r.prep_time_minutes != null && (
                <span className="mt-1 block font-amount text-xs text-ink-soft">
                  {r.prep_time_minutes} min
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => navigate("/add")}
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-olive-deep px-6 py-3.5 font-medium text-bone shadow-lg shadow-olive-deep/25 active:bg-olive"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-xl leading-none">+</span> Add recipe
      </button>
    </div>
  );
}
