# 📖 PageStep

A calm, personal **reading-habit tracker** — a Progressive Web App you add to your
iPhone home screen. Pick a book, log reading sessions (by timer or by hand), and
grow a small daily goal that steps up as you stay consistent. No accounts, no
backend, no nagging.

- **Library** — search millions of books via the [Open Library API](https://openlibrary.org/dev/docs/api/search), or add one manually.
- **Log sessions** — a big *Start Reading* timer, or quick manual entry of minutes/pages.
- **Progressive goals** — start at 10 min/day; hit your goal *5 of any 7 days* and it
  steps up (10 → 15 → 20 → 30 → 45 → 60). Fully configurable.
- **Levels** — you level up each time you sustain the goal. Shown as a ring on Home & Progress.
- **Gentle by design** — a *4 of 7 days* weekly view instead of an all-or-nothing streak,
  a soft consistency counter (never shaming), and a little confetti when you hit the day's goal.
- **Works offline** — installs to the home screen and opens full-screen; you can log
  sessions with no signal.

Everything is stored locally in your browser (`localStorage`). Your data never leaves your device.

---

## Tech

Plain **HTML / CSS / JavaScript** — no build step, no framework, no dependencies.
Just static files you can host anywhere.

```
index.html          app shell + PWA meta tags
manifest.json       PWA manifest (name, colors, icons, standalone)
sw.js               service worker (offline caching of the app shell)
css/styles.css      styling
js/store.js         localStorage data layer (DB-migration-friendly shape)
js/api.js           Open Library search wrapper
js/goals.js         goals / leveling / progression engine
js/ui.js            small DOM helpers (modals, toasts, celebration)
js/app.js           views + navigation
icons/              app icons (192 / 512 / apple-touch)
```

---

## Run locally

Because it uses a service worker and `fetch`, open it through a local web server
(not by double-clicking the file):

```bash
cd BookTracking
python3 -m http.server 8000
# then visit http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

---

## Deploy to GitHub Pages

1. **Create a repo** and push these files to it:

   ```bash
   cd BookTracking
   git init
   git add .
   git commit -m "PageStep PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Enable Pages:** on GitHub go to **Settings → Pages**. Under *Build and
   deployment*, set **Source: Deploy from a branch**, **Branch: `main`**,
   **Folder: `/ (root)`**, then **Save**.

3. Wait ~1 minute. Your app is live at:

   ```
   https://<your-username>.github.io/<your-repo>/
   ```

   > All paths in this project are **relative** (`./js/app.js`, `./sw.js`, …), so it
   > works correctly from a repo subpath like `/your-repo/` with no changes.
   > A `.nojekyll` file is included so GitHub Pages serves every file as-is.

### Updating after changes

When you change any app-shell file, bump `CACHE_VERSION` in [`sw.js`](sw.js)
(e.g. `pagestep-v2` → `pagestep-v3`) and push. That tells the service worker to
drop the old cache and fetch the new files.

---

## Add to your iPhone home screen

1. Open the deployed URL in **Safari** on your iPhone (must be Safari — Chrome on
   iOS can't install PWAs).
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. PageStep now has its own icon and opens **full-screen** — no
   Safari address bar.

To back up or move your data, use **Progress → Export my data** (downloads a JSON
file) and **Import data** on the other device.

---

## Configuring goals

**Progress → ⚙ Goal settings** lets you change:

- **Goal unit** — minutes or pages.
- **Current daily goal** — the target you're working toward now.
- **Days required** & **window** — the "N of M days" rule for levelling up
  (default **5 of 7**).

The goal ladders live in [`js/store.js`](js/store.js) (`laddersByMetric`) if you
want to customise the rungs.

---

## Data model (for a future backend)

The store is intentionally relational so it maps cleanly onto a database like
Supabase later:

| localStorage        | future table    | notes                                   |
|---------------------|-----------------|-----------------------------------------|
| `books[]`           | `books`         | one row per book                        |
| `sessions[]`        | `sessions`      | one row per session, `bookId` → FK      |
| `goals` / `progress`| `user_settings` | a single per-user row                   |
| `goals.history[]`   | `goal_changes`  | goal value over time (for fair "met" days) |

To migrate: read the JSON from **Export**, insert rows per the table map above,
and swap the `Store` module's read/write calls for API calls. No view code needs
to change.

---

## License

Personal project — do whatever you like with it. 🌿
