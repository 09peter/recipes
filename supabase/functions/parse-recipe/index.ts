// parse-recipe — the single shared ingestion endpoint (PRD §4.1)
// Input:  { raw_text: string, source_url?: string }
// Output: { id: string } on success, { error: string } on failure.
// A failed parse never inserts a row.

import { createClient } from "npm:@supabase/supabase-js@2";

// The PRD originally specified llama-3.3-70b-versatile, which Groq
// deprecated for free/dev tiers on 2026-06-17. Default is its recommended
// replacement; override with a GROQ_MODEL secret if it gets deprecated too.
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a recipe extraction engine. You will receive raw, messy text copied
from an Instagram caption -- it typically contains hashtags, emoji,
engagement bait ("follow for more!", "save this for later"), and
inconsistent formatting. Extract ONLY the actual recipe by calling the
extract_recipe tool. Rules:

1. Convert all measurements to metric: grams for solids, millilitres for
   liquids, Celsius for temperatures. Use standard culinary approximations
   for volume-to-weight conversions (e.g. 1 cup flour ~ 120 g, 1 cup sugar
   ~ 200 g, 1 tbsp ~ 15 ml, 1 tsp ~ 5 ml, F to C via (F-32) x 5/9). These
   conversions are inherently approximate -- that's expected and fine.

2. Set scalable: false for seasoning-to-taste, garnish, pinches, or
   anything else not meant to scale linearly with servings ("salt to
   taste", "a pinch of nutmeg", "basil for garnish"). For these, set
   amount and unit to null and put the original phrasing in \`note\`.

3. Set scalable: true for every other ingredient, with a numeric amount
   and a metric unit (or unit: null for whole-count items like eggs or
   cloves of garlic).

4. If servings aren't stated in the source, set servings_base to 4 and
   servings_stated_in_source to false. Never fabricate a stated number.

5. If prep/cook time isn't stated, return prep_time_minutes: null rather
   than guessing.

6. Extract steps in order as clear imperative instructions. Strip out all
   hashtags, emoji, and promotional/non-recipe text entirely -- it should
   never appear in title, ingredients, or steps.

7. Always respond by calling extract_recipe. Never respond with plain text.`;

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_recipe",
    description: "Extract a structured recipe from raw Instagram caption text.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        prep_time_minutes: { type: ["integer", "null"] },
        servings_base: { type: "integer" },
        servings_stated_in_source: { type: "boolean" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: ["number", "null"] },
              unit: { type: ["string", "null"] },
              scalable: { type: "boolean" },
              note: { type: ["string", "null"] },
            },
            required: ["name", "scalable"],
          },
        },
        steps: { type: "array", items: { type: "string" } },
      },
      required: [
        "title",
        "ingredients",
        "steps",
        "servings_base",
        "servings_stated_in_source",
      ],
    },
  },
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Reject anything that doesn't hold up as a usable recipe, so a bad model
// response never becomes a broken row (PRD §4.1 step 3).
function validate(parsed: any): string | null {
  if (!parsed || typeof parsed !== "object") return "no structured output";
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    return "missing title";
  }
  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
    return "no ingredients found";
  }
  for (const ing of parsed.ingredients) {
    if (typeof ing?.name !== "string" || typeof ing?.scalable !== "boolean") {
      return "malformed ingredient entry";
    }
  }
  if (
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0 ||
    parsed.steps.some((s: unknown) => typeof s !== "string")
  ) {
    return "no steps found";
  }
  if (!Number.isInteger(parsed.servings_base) || parsed.servings_base < 1) {
    return "invalid servings";
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  let body: { raw_text?: string; source_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body must be JSON" }, 400);
  }

  const rawText = (body.raw_text ?? "").trim();
  if (!rawText) {
    return jsonResponse(
      { error: "No text to parse — paste the caption first." },
      400,
    );
  }

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) {
    return jsonResponse(
      { error: "GROQ_API_KEY secret is not set on the Edge Function." },
      500,
    );
  }

  // 1) Groq extraction with forced tool-use
  let parsed: any;
  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawText },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: {
          type: "function",
          function: { name: "extract_recipe" },
        },
      }),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      console.error("Groq error", groqRes.status, detail);
      return jsonResponse(
        { error: `Recipe parser is unavailable (Groq ${groqRes.status}).` },
        502,
      );
    }

    const completion = await groqRes.json();
    const call = completion.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return jsonResponse(
        { error: "The parser returned no recipe. Try again or edit the text." },
        502,
      );
    }
    parsed = JSON.parse(call.function.arguments);
  } catch (e) {
    console.error("Parse failure", e);
    return jsonResponse(
      { error: "Couldn't parse the model output. Try again." },
      502,
    );
  }

  const problem = validate(parsed);
  if (problem) {
    return jsonResponse(
      { error: `Parse didn't produce a usable recipe (${problem}).` },
      422,
    );
  }

  // 2) Insert. Service role client — runs server-side only, never shipped.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      title: parsed.title.trim(),
      source_url: body.source_url?.trim() || null,
      status: "inbox",
      prep_time_minutes: parsed.prep_time_minutes ?? null,
      servings_base: parsed.servings_base,
      servings_stated_in_source: parsed.servings_stated_in_source,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      raw_capture_text: rawText,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Insert failed", error);
    return jsonResponse({ error: `Couldn't save: ${error.message}` }, 500);
  }

  return jsonResponse({ id: data.id }, 200);
});
