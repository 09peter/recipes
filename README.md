# Household Recipe Manager

A minimal, mobile-first recipe capture-and-lookup app for a two-person household. Paste an Instagram caption (or share a reel via an iOS Shortcut), and an LLM turns it into a clean, metric, portion-scalable recipe.

Stack: **Vite + React + Tailwind v4** frontend on **Cloudflare Pages**, **Supabase** (Postgres + Edge Functions) backend, **Groq** for free LLM parsing. Everything runs on free tiers — €0/day by design.

---

## Deviations from the PRD (and why)

1. **Groq model changed to `openai/gpt-oss-120b`.** The PRD specified `llama-3.3-70b-versatile`, which Groq deprecated for free/developer tiers on **17 June 2026** (see console.groq.com/docs/deprecations). `openai/gpt-oss-120b` is Groq's recommended replacement, supports forced tool-use, and is free. The model ID is read from an optional `GROQ_MODEL` Edge Function secret, so the next deprecation is a config change, not a redeploy of new code.
2. **`servings_stated_in_source` column added.** The PRD's tool schema returns it and the detail view displays it ("servings not stated in source"), but the PRD's SQL table had no column to store it. Fixed in `supabase/schema.sql`.
3. **Delete button added** (with confirm). The PRD accepts duplicate captures but provided no way to ever remove one.
4. **Client-side title search** on the list screen.
5. **Cooking-mode niceties:** tap-to-check-off ingredients (strikethrough, per-session only, not persisted) and a "Keep screen on" toggle using the Screen Wake Lock API (iOS Safari 16.4+).
6. **`updated_at` trigger** — without it the column silently never updates.
7. **PWA manifest + icon** so "Add to Home Screen" on iPhone gives a standalone full-screen app.
8. **Hash-based routing** (`#/recipe/…`) instead of a router library — zero dependencies and no Cloudflare Pages SPA-redirect configuration needed.

Everything else follows the PRD: same data model, same ingestion pipeline, same prompt and forced tool-use schema, same access-control stance, same non-goals.

---

## Setup checklist

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com) → note the **Project URL** and **anon key** (Settings → API).
2. In the **SQL Editor**, run the contents of `supabase/schema.sql`.

### 2. Groq

1. Sign up at [console.groq.com](https://console.groq.com) (free, no credit card) → create an API key.
2. Store it as an Edge Function secret:
   ```bash
   supabase secrets set GROQ_API_KEY=gsk_...
   ```
   (Or in the dashboard: Edge Functions → Secrets.)
3. Optional: `supabase secrets set GROQ_MODEL=...` to override the default model later.

### 3. Deploy the Edge Function

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy parse-recipe
```

Keep JWT verification **on** (the default) — callers authenticate with the anon key, per the PRD.

### 4. Frontend on Cloudflare Pages

1. Push this repo to Git.
2. Create a Cloudflare Pages project from the repo.
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add build environment variables (note the `VITE_` prefix — Vite only exposes prefixed vars to the client):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
4. Keep the Pages URL unshared — that's the access control.

### 5. Local development

```bash
npm install
cp .env.example .env   # fill in the two values
npm run dev
```

### 6. iOS Shortcut (best-effort auto-capture)

Build manually in the Shortcuts app:

1. **New Shortcut** → enable **Show in Share Sheet**, accept **URLs**.
2. **Get Contents of URL** — input: Shortcut Input (the reel URL). This fetches the page HTML as text.
3. **Match Text** on the result with regex:
   ```
   <meta property="og:description" content="([^"]*)"
   ```
   then **Get Group from Matched Text** (group 1).
4. **If** the match has any value → use it as `raw_text`.
   **Otherwise** → **Ask for Input** ("Paste the caption") and use that.
5. **Get Contents of URL** — Method **POST**, URL:
   ```
   https://<project-ref>.supabase.co/functions/v1/parse-recipe
   ```
   Headers:
   - `Authorization`: `Bearer <SUPABASE_ANON_KEY>`
   - `apikey`: `<SUPABASE_ANON_KEY>`
   - `Content-Type`: `application/json`
   Request body (JSON): `raw_text` = the caption text, `source_url` = Shortcut Input.
6. **Get Dictionary from Input** → **If** it has an `id` → **Show Notification** "Added to Inbox". **Otherwise** → show the `error` value and suggest pasting into the web app manually.

Known fragility (stated in the PRD): the `og:description` scrape is unofficial and Instagram can break it anytime. The Shortcut degrades to a manual-paste prompt; the web app is always the reliable path.

### 7. Keep both URLs unshared

The Cloudflare Pages URL and the Supabase project URL are the access control. RLS with the open anon policy is defense in depth for the anon key that ships in the JS bundle — see PRD §7.

---

## Project structure

```
├── index.html
├── public/                      # manifest + icons (PWA / home screen)
├── src/
│   ├── App.jsx                  # hash router + config guard
│   ├── components/
│   │   ├── RecipeList.jsx       # tabs, search, cards
│   │   ├── RecipeDetail.jsx     # scaling, check-off, wake lock, status, delete
│   │   ├── EditRecipe.jsx       # full edit: fields, ingredients, reorderable steps
│   │   └── AddRecipe.jsx        # manual paste → parse-recipe
│   └── lib/
│       ├── supabase.js          # client + data helpers
│       └── scaling.js           # PRD §6 portion math
└── supabase/
    ├── schema.sql               # table + RLS + updated_at trigger
    └── functions/parse-recipe/  # the one shared ingestion endpoint
```
