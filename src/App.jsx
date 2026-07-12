import { useEffect, useState } from "react";
import { configMissing } from "./lib/supabase.js";
import RecipeList from "./components/RecipeList.jsx";
import RecipeDetail from "./components/RecipeDetail.jsx";
import AddRecipe from "./components/AddRecipe.jsx";

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "add") return { screen: "add" };
  if (hash.startsWith("recipe/"))
    return { screen: "detail", id: hash.slice("recipe/".length) };
  return { screen: "list" };
}

export function navigate(path) {
  window.location.hash = path;
}

export default function App() {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (configMissing) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-display text-2xl text-olive-deep">Not configured yet</h1>
        <p className="mt-3 text-ink-soft">
          Set <code className="font-amount">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-amount">VITE_SUPABASE_ANON_KEY</code> as build
          environment variables, then rebuild. See the README setup checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg min-h-dvh">
      {route.screen === "list" && <RecipeList />}
      {route.screen === "detail" && <RecipeDetail id={route.id} key={route.id} />}
      {route.screen === "add" && <AddRecipe />}
    </div>
  );
}
