# Atrium — AI Interview Studio

A clean, single-file web app for running AI-assisted interviews end-to-end:

- **Admin** dashboard: create interview slots, manage candidates, review AI analyses, download reports.
- **Candidate** flow: enter via invite code → upload resume → device check → record video answers to AI-generated questions → download a copy.
- **Claude-powered**: questions are tailored to the candidate's resume; the final analysis scores technical skill, communication, problem-solving, depth of experience, role fit, and delivery quality.

Everything is one `index.html` file. No build step. Deploys anywhere static hosting works.

---

## 1. Quick local run

```bash
# 1. Open the folder
cd atrium-interview-studio

# 2. Serve it (any static server works)
python3 -m http.server 8080
# or
npx serve .
```

Open <http://localhost:8080>. Default admin login:

```
username: admin
password: admin123
```

Change it immediately in **Settings → Admin account**.

---

## 2. Connect an AI provider

The app supports two providers, switchable in **Admin → Settings → AI provider**.

### Option A — Google Gemini (free, recommended)

1. Go to <https://aistudio.google.com/apikey> (sign in with any Google account).
2. Click **Create API key** → copy it. No credit card required.
3. In the app: **Settings → Provider: Google Gemini**, paste the key, pick a model:
   - **Gemini 2.5 Flash** — balanced, recommended.
   - **Gemini 2.5 Flash-Lite** — fastest & highest free quota (1000 requests/day).
   - **Gemini 2.5 Pro** — best reasoning, but only ~100 requests/day on free tier.
4. Click **Test connection** → should say "Connection OK ✓".

Current free tier (May 2026): roughly 5–15 requests/minute and 100–1000 requests/day depending on model. More than enough for typical interview volumes (1 interview ≈ 8–12 requests).

### Option B — Anthropic Claude (paid)

1. Get a key at <https://console.anthropic.com> → Settings → API Keys. Add credit to your account.
2. In the app: **Settings → Provider: Anthropic Claude**, paste the key, pick a model (Sonnet 4.6 is the sweet spot).
3. Test connection.

### Both providers: direct vs. proxy mode

- **Direct from browser** (default): the API key lives in your browser's `localStorage`. Easy. Fine for trying it out on your own machine. **Don't** use this if untrusted people can reach the admin page.
- **Through a proxy server** (recommended for production): `proxy-server.js` (included) keeps the key on a server you control. It supports both Gemini and Claude — set `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` as server env vars.

```bash
# Run the proxy locally (Gemini only)
GEMINI_API_KEY=AIza... node proxy-server.js
# Or both providers
GEMINI_API_KEY=... ANTHROPIC_API_KEY=... node proxy-server.js
# Proxy now on http://localhost:8787/llm
```

In the app: **Settings → Mode → "Through a proxy server"**, paste `http://localhost:8787/llm`, save.

Deploy the proxy to Vercel/Render/Fly/Railway/your VPS. Set the API keys as server env vars and set `ALLOW_ORIGIN` to your frontend domain.

---

## 3. Deploy to GitHub Pages (free, fastest)

```bash
# In an empty directory:
git init
# Drop index.html + proxy-server.js + this README into the folder.
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/atrium-interview-studio.git
git push -u origin main
```

Then on GitHub:

1. Repo → **Settings → Pages**.
2. **Source**: Deploy from a branch.
3. **Branch**: `main`, folder `/ (root)`. Save.
4. Wait ~30 seconds. Your site is live at `https://<you>.github.io/atrium-interview-studio/`.

> GitHub Pages serves static files only, so use **proxy mode** if you want to host the proxy too — deploy that part to Vercel/Render/Fly separately.

## 3b. Deploy to Vercel (1 command, hosts proxy + frontend)

```bash
npm i -g vercel
vercel
# answer the prompts; framework: Other
```

Add an Environment Variable: `ANTHROPIC_API_KEY`. To run the proxy as a Vercel Function, move `proxy-server.js` to `api/claude.js` and slightly adapt the handler signature, or keep it as a separate service.

## 3c. Deploy to Netlify

Drag-and-drop the folder onto <https://app.netlify.com/drop>. Done.

---

## 4. How it works

| Stage | Tech |
| --- | --- |
| UI | Single HTML file, vanilla JS, no framework |
| State | `localStorage` (per-browser). Export/import via Settings. |
| Resume parsing | PDF.js in-browser, plain text fallback |
| Camera/mic capture | `getUserMedia` + `MediaRecorder` (WebM/VP9) |
| Live transcription | Web Speech API (Chrome/Edge); typed fallback otherwise |
| Question generation | Gemini or Claude — adaptive to resume + role + level |
| Scoring | Gemini or Claude — JSON-structured rubric across 6 axes |

### Evaluation rubric (0–100 each, plus a 0–100 overall)

- **Technical skills** — domain accuracy and depth
- **Communication** — clarity, structure, vocabulary
- **Problem solving** — decomposition and reasoning
- **Depth of experience** — substance behind claims
- **Role fit** — alignment to role and level
- **Delivery quality** — articulation, completeness, professionalism

You can swap models per session in Settings. For Gemini: Pro for best reasoning, Flash for balanced (default), Flash-Lite for fast/cheap screening. For Claude: Opus for the most rigorous calibration, Sonnet for balanced (default), Haiku for fast/cheap screening.

---

## 5. Candidate experience

1. Recruiter shares a link like `https://yoursite/?code=AB12CD`.
2. Candidate lands on the invitation page, fills in details.
3. Uploads a resume (PDF/TXT). Extracted text only — never sent as binary.
4. Camera/mic device check.
5. Interview: one question at a time, video recording, live transcript, optional typed notes. Configurable time per question.
6. On submission: **a prompt asks the candidate to download their recordings** to local disk (recordings are blobs in memory — not uploaded anywhere).

> Recordings are deliberately **not** stored on a server here. If you want server storage, add an upload step in `finalize()` (search for that function in `index.html`).

---

## 6. Admin experience

- **Dashboard** with totals + two tabs: Interview Slots and Candidate Sessions.
- Click any candidate → full evaluation view: overall score, axis scores, strengths, concerns, communication notes, technical notes, Q&A transcript with video playback.
- **Download HTML report** per candidate for sharing with the hiring panel.
- **Export all data** (JSON) for backup or migration.

---

## 7. Security checklist before going live

- [ ] Change the default admin password.
- [ ] Switch to proxy mode and host the proxy with `ANTHROPIC_API_KEY` as a server-side env var.
- [ ] Set `ALLOW_ORIGIN` on the proxy to your exact frontend domain.
- [ ] Put the site behind HTTPS (GitHub Pages, Vercel, and Netlify give you this automatically).
- [ ] If you store candidate recordings, add a privacy notice + retention policy.
- [ ] For multiple recruiters, replace the single-admin model with proper auth (Auth0/Clerk/Firebase) — the current model is intended for a single hiring manager.

---

## 8. File layout

```
.
├── index.html         # the entire app
├── proxy-server.js    # optional Claude API proxy (Node, no deps)
└── README.md
```

That's it. Three files.

---

## 9. Customization

- **Brand name**: search `Atrium` in `index.html` and rename.
- **Colors**: change the CSS custom properties at the top of `<style>`. The accent is `--accent: #2F4F4F` (deep slate-green); swap for any hex.
- **Fonts**: change the Google Fonts `<link>` and the `font-family` rules.
- **Rubric axes**: edit the JSON schema in the `analyzeSession()` system prompt.

---

## 10. License

MIT. Use freely.
