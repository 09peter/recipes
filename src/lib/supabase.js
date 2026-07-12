import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configMissing = !url || !anonKey;

export const supabase = configMissing ? null : createClient(url, anonKey);

export async function fetchRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, status, prep_time_minutes, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchRecipe(id) {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecipe(id, patch) {
  const { data, error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export async function parseRecipe(rawText, sourceUrl) {
  const { data, error } = await supabase.functions.invoke("parse-recipe", {
    body: { raw_text: rawText, source_url: sourceUrl || null },
  });
  if (error) {
    // Try to surface the function's own error message instead of a generic one
    let message = error.message;
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep original message */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data; // { id }
}
