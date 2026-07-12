import { useState } from "react";
import { updateRecipe } from "../lib/supabase.js";

export default function EditRecipe({ recipe, onDone }) {
  const [title, setTitle] = useState(recipe.title);
  const [prepTime, setPrepTime] = useState(recipe.prep_time_minutes ?? "");
  const [servings, setServings] = useState(recipe.servings_base);
  const [ingredients, setIngredients] = useState(
    recipe.ingredients.map((i) => ({ note: null, ...i })),
  );
  const [steps, setSteps] = useState(recipe.steps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function patchIngredient(i, patch) {
    setIngredients((prev) =>
      prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)),
    );
  }

  function moveStep(i, dir) {
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    if (busy) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Title can't be empty.");
      return;
    }
    const cleanIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        amount: i.amount === "" || i.amount === null ? null : Number(i.amount),
        unit: i.unit?.trim() || null,
        scalable: !!i.scalable,
        ...(i.note?.trim() ? { note: i.note.trim() } : {}),
      }));
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (cleanIngredients.length === 0 || cleanSteps.length === 0) {
      setError("A recipe needs at least one ingredient and one step.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await updateRecipe(recipe.id, {
        title: cleanTitle,
        prep_time_minutes: prepTime === "" ? null : Number(prepTime),
        servings_base: Number(servings) || 1,
        ingredients: cleanIngredients,
        steps: cleanSteps,
      });
      onDone(updated);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const inputCls =
    "rounded-xl border border-line bg-card px-3 py-2 text-base outline-none focus:border-olive";

  return (
    <div className="px-5 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <button onClick={() => onDone(null)} className="text-sm text-olive">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-bone disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      <h1 className="mt-4 font-display text-2xl text-olive-deep">Edit recipe</h1>

      {error && (
        <p className="mt-4 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}

      <label className="mt-5 block text-xs font-medium tracking-wide text-ink-soft uppercase">
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`mt-1.5 w-full ${inputCls}`}
      />

      <div className="mt-4 flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium tracking-wide text-ink-soft uppercase">
            Prep time (min)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            className={`mt-1.5 w-full ${inputCls}`}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium tracking-wide text-ink-soft uppercase">
            Base servings
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className={`mt-1.5 w-full ${inputCls}`}
          />
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg text-olive-deep">Ingredients</h2>
      <div className="mt-3 space-y-3">
        {ingredients.map((ing, i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex gap-2">
              <input
                value={ing.name}
                onChange={(e) => patchIngredient(i, { name: e.target.value })}
                placeholder="Name"
                className={`min-w-0 flex-1 ${inputCls}`}
              />
              <button
                onClick={() =>
                  setIngredients((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="shrink-0 px-2 text-danger"
                aria-label={`Remove ${ing.name || "ingredient"}`}
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={ing.amount ?? ""}
                onChange={(e) => patchIngredient(i, { amount: e.target.value })}
                placeholder="Amount"
                className={`w-24 ${inputCls}`}
              />
              <input
                value={ing.unit ?? ""}
                onChange={(e) => patchIngredient(i, { unit: e.target.value })}
                placeholder="Unit"
                className={`w-16 ${inputCls}`}
              />
              <label className="ml-auto flex items-center gap-1.5 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={!!ing.scalable}
                  onChange={(e) =>
                    patchIngredient(i, { scalable: e.target.checked })
                  }
                  className="h-4 w-4 accent-olive-deep"
                />
                Scales
              </label>
            </div>
            <input
              value={ing.note ?? ""}
              onChange={(e) => patchIngredient(i, { note: e.target.value })}
              placeholder="Note (e.g. to taste)"
              className={`mt-2 w-full ${inputCls}`}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          setIngredients((prev) => [
            ...prev,
            { name: "", amount: null, unit: null, scalable: true, note: null },
          ])
        }
        className="mt-3 text-sm font-medium text-olive"
      >
        + Add ingredient
      </button>

      <h2 className="mt-8 font-display text-lg text-olive-deep">Steps</h2>
      <div className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-amount text-xs text-saffron">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex gap-1 text-ink-soft">
                <button
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  className="px-2 disabled:opacity-25"
                  aria-label="Move step up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="px-2 disabled:opacity-25"
                  aria-label="Move step down"
                >
                  ↓
                </button>
                <button
                  onClick={() =>
                    setSteps((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="px-2 text-danger"
                  aria-label="Remove step"
                >
                  ✕
                </button>
              </div>
            </div>
            <textarea
              value={step}
              onChange={(e) =>
                setSteps((prev) =>
                  prev.map((s, idx) => (idx === i ? e.target.value : s)),
                )
              }
              rows={2}
              className={`mt-2 w-full ${inputCls}`}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => setSteps((prev) => [...prev, ""])}
        className="mt-3 text-sm font-medium text-olive"
      >
        + Add step
      </button>
    </div>
  );
}
