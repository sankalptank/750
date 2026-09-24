# 750 — a private 750-words-a-day site you host yourself

Three files:

- `index.html` — the whole app. Drop it at `sankalptank.com/750/index.html`.
- `firestore.rules` — locks the database so only you can read your entries.
- `worker.js` — optional. A tiny Cloudflare Worker that lets the "Summarize with AI" button work without exposing an API key in the page.

Everything (writing, word counts, streaks, the mindset/feeling/topic stats) runs in the browser. Only the AI summary leaves your machine, and only when you press the button.

## 1. Firebase (login + storage) — about 10 minutes

1. Go to https://console.firebase.google.com → **Add project** (Analytics off is fine).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Then open **Settings → Authorized domains** and add `sankalptank.com`.
3. **Build → Firestore Database → Create database** (production mode, pick a region near you).
4. In Firestore → **Rules**, paste the contents of `firestore.rules`. Replace `you@gmail.com` with your Google address (you can list several). Publish.
5. **Project settings (gear) → Your apps → Web (</>)** → register the app. Copy the `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`, `appId`) into the `FIREBASE_CONFIG` block at the top of `index.html`'s script.
6. Optional: set `ALLOWED_EMAILS = ["you@gmail.com"]` in the same block so the sign-in screen rejects other accounts too. (The Firestore rules are the real lock; this is just a nicer message.)

Free tier limits are far beyond what one person writing daily will ever hit.

## 2. Host it

It's a single static file. Any static host works (Netlify, Vercel, GitHub Pages, Cloudflare Pages, an S3 bucket, your existing site). Put `index.html` in a `750/` folder so it lives at `sankalptank.com/750/`. There's no build step.

## 3. AI summaries (optional)

1. Get an API key from https://console.anthropic.com.
2. Create a Worker at https://dash.cloudflare.com → Workers & Pages → Create → paste `worker.js`.
3. In the worker's **Settings → Variables and Secrets** add:
   - `ANTHROPIC_API_KEY` (secret)
   - `FIREBASE_API_KEY` (secret) — same value as `apiKey` in your Firebase config
   - `ALLOWED_EMAILS` (secret) — `you@gmail.com`
   - `ALLOWED_ORIGIN` (variable) — `https://sankalptank.com`
   - `MODEL` (optional) — defaults to `claude-sonnet-4-6`; change if that model is retired
4. Copy the worker URL (e.g. `https://seven-fifty.yourname.workers.dev`) into `AI_ENDPOINT` in `index.html`.

The worker checks the Firebase login token with Google before calling the model, so nobody can use your key through it.

## How it behaves

- **Goal**: 750 words a day. The rule across the top of the page fills as you write and turns green at 750. Write as much as you want past that.
- **Day reset**: Settings → "Day resets at", 12:00 am to 6:00 am. Writing at 1 am with a 3 am reset counts for yesterday.
- **Streak**: consecutive days at 750+. Today doesn't break the streak until the day rolls over.
- **Repairs**: a 1500-word day earns one repair, which covers the most recent missed day before it. Unused repairs show as "banked" next to the streak.
- **Stats** (button under the editor): words-over-time chart, words per minute, distractions (times you left the tab before hitting 750), minutes to 750, and the mindset/feeling/topic/time/sense/pronoun breakdowns. The breakdowns are word-list based, like the original site — a rough mirror, not a diagnosis. Timing stats only record on the day you're writing; you can still edit old days.
- **Autosave** every ~1 second; ⌘S / Ctrl+S forces it. A copy is also kept in the browser in case the connection drops, and it is restored next time you open that day.
- **History**: month grid, click any day to read or edit it. With AI set up, a Summaries box under the grid summarizes any week (Sunday to Saturday) or the whole month; results are saved so you only pay once.
- **Import**: Settings → Import past entries. Takes a 750words.com export (.txt), this site's own .json, or .txt/.md files named by date or split by `## YYYY-MM-DD` headings. Existing days with more words are kept unless you tick Replace.
- **Export**: Settings → download everything as JSON.
- **Privacy**: the page is `noindex`; Firestore rules restrict reads to your own account; the AI worker only accepts your account. Entries never touch any server except your own Firebase project (and the model, only for summaries you request).
