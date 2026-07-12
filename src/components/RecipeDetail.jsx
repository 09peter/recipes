import { useEffect, useRef, useState } from "react";
import {
  fetchRecipe,
  updateRecipe,
  deleteRecipe,
} from "../lib/supabase.js";
import { MULTIPLIERS, scaledAmount } from "../lib/scaling.js";
import { navigate } from "../App.jsx";
import EditRecipe from "./EditRecipe.jsx";

export default function RecipeDetail({ id }) {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchRecipe(id).then(setRecipe).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="px-5 pt-8">
        <button onClick={() => navigate("/")} className="text-sm text-olive">
          ← Recipes
        </button>
        <p className="mt-6 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          Couldn't load this recipe: {error}
        </p>
      </div>
    );

  if (!recipe)
    return <p className="pt-16 text-center text-ink-soft">Loading…</p>;

  if (editing)
    return (
      <EditRecipe
        recipe={recipe}
        onDone={(updated) => {
          if (updated) setRecipe(updated);
          setEditing(false);
        }}
      />
    );

  return (
    <ViewRecipe
      recipe={recipe}
      onEdit={() => setEditing(true)}
      onChange={setRecipe}
    />
  );
}

function ViewRecipe({ recipe, onEdit, onChange }) {
  const [multiplier, setMultiplier] = useState(1);
  const [checked, setChecked] = useState(() => new Set());
  const [tick, setTick] = useState(0); // re-triggers the amount pulse
  const [busy, setBusy] = useState(false);

  function setMult(m) {
    setMultiplier(m);
    setTick((t) => t + 1);
  }

  function toggleChecked(i) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function toggleStatus() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateRecipe(recipe.id, {
        status: recipe.status === "inbox" ? "approved" : "inbox",
      });
      onChange(updated);
    } catch (e) {
      alert(`Couldn't update status: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete “${recipe.title}”? This can't be undone.`)) return;
    try {
      await deleteRecipe(recipe.id);
      navigate("/");
    } catch (e) {
      alert(`Couldn't delete: ${e.message}`);
    }
  }

  const serves = Math.round(recipe.servings_base * multiplier * 10) / 10;

  return (
    <div className="px-5 pb-24 pt-8">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-sm text-olive">
          ← Recipes
        </button>
        <div className="flex items-center gap-4">
          <WakeLockToggle />
          <button onClick={onEdit} className="text-sm font-medium text-olive">
            Edit
          </button>
        </div>
      </div>

      <h1 className="mt-4 font-display text-3xl leading-tight text-olive-deep">
        {recipe.title}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        {recipe.prep_time_minutes != null && (
          <span className="font-amount">{recipe.prep_time_minutes} min</span>
        )}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-olive underline underline-offset-2"
          >
            Source ↗
          </a>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            recipe.status === "approved"
              ? "bg-olive/15 text-olive-deep"
              : "bg-saffron-soft text-ink"
          }`}
        >
          {recipe.status === "approved" ? "Approved" : "Inbox"}
        </span>
      </div>

      {/* Signature element: the portions dial */}
      <div className="mt-6 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tracking-wide text-ink-soft uppercase">
            Portions
          </span>
          <span className="font-display text-lg text-olive-deep">
            Serves {serves}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {MULTIPLIERS.map((m) => (
            <button
              key={m}
              onClick={() => setMult(m)}
              className={`flex-1 rounded-xl py-2.5 font-amount text-sm transition-colors ${
                multiplier === m
                  ? "bg-olive-deep text-saffron"
                  : "bg-bone text-ink-soft active:bg-line/60"
              }`}
            >
              {m}×
            </button>
          ))}
        </div>
        {!recipe.servings_stated_in_source && (
          <p className="mt-2.5 text-xs text-ink-soft">
            Servings weren't stated in the source — 4 is an assumption.
          </p>
        )}
      </div>

      <h2 className="mt-8 font-display text-xl text-olive-deep">Ingredients</h2>
      <p className="mt-1 text-xs text-ink-soft">Tap to check off as you go.</p>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
        {recipe.ingredients.map((ing, i) => {
          const amount = scaledAmount(ing, multiplier);
          const done = checked.has(i);
          return (
            <li key={i}>
              <button
                onClick={() => toggleChecked(i)}
                className="flex w-full items-baseline gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`mt-0.5 inline-block h-4 w-4 shrink-0 self-center rounded-full border ${
                    done ? "border-olive bg-olive" : "border-line"
                  }`}
                />
                <span
                  className={`flex-1 ${done ? "text-ink-soft line-through" : ""}`}
                >
                  {ing.name}
                  {ing.note && (
                    <span className="text-ink-soft"> — {ing.note}</span>
                  )}
                </span>
                {amount && (
                  <span
                    key={tick}
                    className={`amount-tick shrink-0 px-1 font-amount text-sm ${
                      done ? "text-ink-soft/60" : "text-olive-deep"
                    }`}
                  >
                    {amount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 font-display text-xl text-olive-deep">Steps</h2>
      <ol className="mt-3 space-y-4">
        {recipe.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 font-amount text-sm text-saffron">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 space-y-3">
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="w-full rounded-full bg-olive-deep py-3.5 font-medium text-bone disabled:opacity-40 active:bg-olive"
        >
          {recipe.status === "inbox" ? "Approve recipe" : "Move back to Inbox"}
        </button>
        <button
          onClick={remove}
          className="w-full rounded-full border border-danger/30 py-3 text-sm font-medium text-danger active:bg-danger/10"
        >
          Delete recipe
        </button>
      </div>
    </div>
  );
}

/**
 * Keeps the phone screen on while cooking. Uses the Screen Wake Lock API
 * (supported in iOS Safari 16.4+). Re-acquires the lock when returning to
 * the tab, since the OS releases it on tab switch.
 */
function WakeLockToggle() {
  const [on, setOn] = useState(false);
  const lockRef = useRef(null);
  const supported = "wakeLock" in navigator;

  useEffect(() => {
    if (!on) return;
    let cancelled = false;

    async function acquire() {
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        if (!cancelled) setOn(false);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [on]);

  if (!supported) return null;

  return (
    <button
      onClick={() => setOn((v) => !v)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        on ? "bg-saffron text-ink" : "bg-line/60 text-ink-soft"
      }`}
    >
      {on ? "Screen stays on" : "Keep screen on"}
    </button>
  );
}
